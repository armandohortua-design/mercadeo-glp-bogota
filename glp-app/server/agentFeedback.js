/**
 * agentFeedback.js — Loop de feedback humano sobre lo que generan los agentes.
 *
 * Cada vez que un usuario APRUEBA (tal cual o editado antes) o DESCARTA un artefacto que
 * generó un agente (borrador de correo, insight de mercado, copy, guion de video), se
 * registra la decisión — sin pedir motivo, solo la decisión final (ver discusión con el
 * usuario). Esto es la única señal real de si un agente está funcionando bien: antes no
 * existía ningún rastro de qué pasaba con lo que un agente producía después de generarlo.
 */

const pool = require('./db');
const nodemailer = require('nodemailer');

const TENANT_ID = 'tenant-glp-001';

async function ensureSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_feedback (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        decided_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS edited_by_human BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE valeria_drafts ADD COLUMN IF NOT EXISTS edited_by_human BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE isabella_scripts ADD COLUMN IF NOT EXISTS edited_by_human BOOLEAN DEFAULT false`);
  } catch (e) { console.warn('agent_feedback schema check:', e.message); }
}
ensureSchema();

// origen/origen_agentivo de cada tabla → qué agente generó ese artefacto. Solo se registra
// feedback de lo que un AGENTE generó — un borrador o contenido creado manualmente por un
// humano no pasa por este loop, no hay "calidad de agente" que medir ahí.
const ORIGEN_A_AGENTE = { cobranza_ia: 'CARTERA', legal_ia: 'LEGAL', sara_ia: 'SARA' };

function agentePorOrigenDraft(origen) { return ORIGEN_A_AGENTE[origen] || null; }

async function registrar(tenantId, agent, artifactType, artifactId, decision, decidedBy) {
  if (!agent) return; // artefacto no generado por un agente — no hay nada que medir
  await pool.query(
    `INSERT INTO agent_feedback (tenant_id, agent, artifact_type, artifact_id, decision, decided_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
    [tenantId, agent, artifactType, String(artifactId), decision, decidedBy || null]
  );
}

async function metrics(tenantId) {
  const { rows } = await pool.query(
    `SELECT agent, decision, COUNT(*)::int AS n FROM agent_feedback WHERE tenant_id = $1 GROUP BY agent, decision`,
    [tenantId]
  );
  const porAgente = {};
  rows.forEach(r => {
    porAgente[r.agent] ??= { approved_as_is: 0, approved_edited: 0, discarded: 0, total: 0 };
    porAgente[r.agent][r.decision] = r.n;
    porAgente[r.agent].total += r.n;
  });
  Object.values(porAgente).forEach(m => {
    m.pctDescartado = m.total > 0 ? Math.round((m.discarded / m.total) * 100) : 0;
    m.pctEditado = m.total > 0 ? Math.round((m.approved_edited / m.total) * 100) : 0;
    m.pctAprobadoTalCual = m.total > 0 ? Math.round((m.approved_as_is / m.total) * 100) : 0;
  });
  return porAgente;
}

// ── Monitor: si un agente empeora de golpe (su % de descarte se dispara), avisar ────────
// Compara los últimos 7 días contra los 7 anteriores — necesita al menos 5 decisiones en
// la ventana reciente para no disparar con una sola muestra ruidosa.
async function tasaDescarte(tenantId, agent, desdeHoras, hastaHoras) {
  const { rows } = await pool.query(
    `SELECT decision, COUNT(*)::int AS n FROM agent_feedback
     WHERE tenant_id = $1 AND agent = $2
       AND created_at > NOW() - INTERVAL '${Number(desdeHoras)} hours'
       AND created_at <= NOW() - INTERVAL '${Number(hastaHoras)} hours'
     GROUP BY decision`,
    [tenantId, agent]
  );
  const total = rows.reduce((s, r) => s + r.n, 0);
  const descartados = rows.find(r => r.decision === 'discarded')?.n || 0;
  return { total, pct: total > 0 ? (descartados / total) * 100 : 0 };
}

async function notifyAdmin({ agent, pctAntes, pctAhora, total }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!adminEmail || !smtpUser || !smtpPass) return;
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({
      from: `"CRM · Calidad de Agentes" <${smtpUser}>`,
      to: adminEmail,
      subject: `⚠️ ${agent} está siendo descartado mucho más de lo normal`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:#DC2626;color:#fff;padding:20px;text-align:center">
            <h2 style="margin:0;letter-spacing:1px">⚠️ CALIDAD DE AGENTE EN CAÍDA</h2>
            <p style="margin:4px 0;font-size:12px;opacity:.85">${new Date().toLocaleString('es-CO')} · Capital Brokers - Real Estate</p>
          </div>
          <div style="padding:24px;background:#fff">
            <p style="color:#374151;line-height:1.6;font-size:15px">
              El agente <strong>${agent}</strong> pasó de un <strong>${Math.round(pctAntes)}%</strong> de descarte
              (7 días anteriores) a <strong>${Math.round(pctAhora)}%</strong> (últimos 7 días), sobre ${total} decisión(es) recientes.
            </p>
            <div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:14px;margin-top:16px">
              <p style="margin:0;font-size:13px;color:#991B1B"><strong>Acción recomendada:</strong> Revisa el Panel de Agentes IA → Calidad de Agentes y los últimos borradores descartados de ${agent} — puede ser un cambio de datos, un prompt desalineado, o una integración rota.</p>
            </div>
          </div>
        </div>`
    });
    console.log(`[Calidad] 📧 Notificado — ${agent} en caída de calidad`);
  } catch (err) {
    console.error('[Calidad] Error enviando email:', err.message);
  }
}

async function detectFeedbackAlerts() {
  console.log('[Calidad] Evaluando tasa de descarte de cada agente...');
  const agentes = ['SARA', 'CAMILO', 'SOFIA', 'VALERIA', 'ISABELLA', 'CARTERA', 'LEGAL'];
  for (const agent of agentes) {
    try {
      const reciente = await tasaDescarte(TENANT_ID, agent, 24 * 7, 0);
      const anterior = await tasaDescarte(TENANT_ID, agent, 24 * 14, 24 * 7);
      if (reciente.total < 5) continue; // muestra insuficiente, evita falsos positivos
      const salto = reciente.pct - anterior.pct;
      if (salto >= 30 && reciente.pct >= 40) {
        await notifyAdmin({ agent, pctAntes: anterior.pct, pctAhora: reciente.pct, total: reciente.total });
      }
    } catch (err) { console.error(`[Calidad] Error evaluando ${agent}:`, err.message); }
  }
  console.log('[Calidad] ✅ Evaluación de calidad completada.');
}

function startFeedbackMonitor() {
  const INTERVAL = 24 * 60 * 60 * 1000;
  console.log('[Calidad] Monitor de calidad de agentes iniciado — análisis cada 24h.');
  detectFeedbackAlerts();
  setInterval(detectFeedbackAlerts, INTERVAL);
}

module.exports = { registrar, agentePorOrigenDraft, metrics, startFeedbackMonitor, detectFeedbackAlerts, ensureSchema };
