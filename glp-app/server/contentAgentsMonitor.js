/**
 * contentAgentsMonitor.js — Alertas proactivas para los 4 agentes de contenido/inteligencia
 * (Camilo, Sofía, Valeria, Isabella). Mismo patrón que legalAlertMonitor.js/carteraMonitor.js:
 * escanea cada 24h, detecta una condición real con datos del CRM (no inventada), y notifica
 * por correo al equipo interno — nunca publica/envía nada por sí solo, solo avisa.
 *
 * Usa una tabla genérica `agent_alerts` (agent, alert_key, detalle) en vez de una tabla nueva
 * por agente — los 4 monitores comparten la misma lógica de dedup (no repetir el mismo aviso
 * en <48h), así que reusarla evita 4 tablas casi idénticas.
 */

const pool = require('./db');
const nodemailer = require('nodemailer');

const TENANT_ID = 'tenant-glp-001';

async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_alerts (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        alert_key TEXT NOT NULL,
        detalle TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('agent_alerts table check:', e.message); }
}

async function alertaExistente(agent, alertKey, horas = 48) {
  const { rows } = await pool.query(
    `SELECT id FROM agent_alerts WHERE tenant_id = $1 AND agent = $2 AND alert_key = $3 AND created_at > NOW() - INTERVAL '${Number(horas)} hours'`,
    [TENANT_ID, agent, alertKey]
  );
  return rows.length > 0;
}

async function registrarAlerta(agent, alertKey, detalle) {
  await pool.query(
    `INSERT INTO agent_alerts (tenant_id, agent, alert_key, detalle, created_at) VALUES ($1,$2,$3,$4,NOW())`,
    [TENANT_ID, agent, alertKey, detalle]
  );
}

async function notifyAdmin({ agentLabel, color, emoji, subject, mensaje, accion }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!adminEmail || !smtpUser || !smtpPass) return;

  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({
      from: `"CRM · ${agentLabel}" <${smtpUser}>`,
      to: adminEmail,
      subject: `${emoji} ${subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:${color};color:#fff;padding:20px;text-align:center">
            <h2 style="margin:0;letter-spacing:1px">${emoji} ${agentLabel.toUpperCase()}</h2>
            <p style="margin:4px 0;font-size:12px;opacity:.85">${new Date().toLocaleString('es-CO')} · Capital Brokers Properties</p>
          </div>
          <div style="padding:24px;background:#fff">
            <p style="color:#374151;line-height:1.6;font-size:15px">${mensaje}</p>
            <div style="background:#F8FAFC;border-left:4px solid ${color};padding:14px;margin-top:16px">
              <p style="margin:0;font-size:13px;color:#334155"><strong>Acción recomendada:</strong> ${accion}</p>
            </div>
            <p style="color:#9ca3af;font-size:11px;margin-top:20px">Alerta generada automáticamente por el monitor de agentes IA del CRM.</p>
          </div>
        </div>`
    });
    console.log(`[${agentLabel}] 📧 Notificado — ${subject}`);
  } catch (err) {
    console.error(`[${agentLabel}] Error enviando email:`, err.message);
  }
}

// ── CAMILO: objeción repetida (mismo tipo/proyecto) 3+ veces en los últimos 7 días ─────────
// Señal de que un mismo obstáculo de mercado se está volviendo sistemático, no un caso aislado.
async function detectCamiloAlerts() {
  console.log('[Camilo] Escaneando objeciones de mercado repetidas...');
  let creadas = 0;
  try {
    const { rows } = await pool.query(
      `SELECT tipo, proyecto, COUNT(*)::int AS n
       FROM broker_objections
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
       GROUP BY tipo, proyecto HAVING COUNT(*) >= 3 ORDER BY n DESC`,
      [TENANT_ID]
    ).catch(() => ({ rows: [] }));

    for (const row of rows) {
      const alertKey = `objecion:${row.tipo}:${row.proyecto || 'general'}`;
      if (await alertaExistente('CAMILO', alertKey)) continue;

      const titulo = `Objeción "${row.tipo}" repetida ${row.n} veces en ${row.proyecto || 'varios proyectos'} (últimos 7 días)`;
      const id = `insight-monitor-${Date.now()}-${creadas}`;
      await pool.query(
        `INSERT INTO camilo_insights (id, tenant_id, titulo, resumen, tipo, impacto, status, fecha, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'mercado','alto','nuevo',$5,NOW(),NOW())`,
        [id, TENANT_ID, titulo, `El monitor detectó ${row.n} reportes de objeción "${row.tipo}" en ${row.proyecto || 'varios proyectos'} en los últimos 7 días — posible obstáculo sistemático, no un caso aislado.`, new Date().toISOString().slice(0, 10)]
      );
      await registrarAlerta('CAMILO', alertKey, titulo);
      await notifyAdmin({
        agentLabel: 'Camilo', color: '#7C3AED', emoji: '📊',
        subject: `Patrón de mercado detectado — ${row.tipo}`,
        mensaje: `${titulo}. Se publicó un insight en el Panel de Camilo, pendiente de revisión.`,
        accion: 'Ingresa al CRM → Agentes IA → Camilo y revisa el insight antes de decidir una acción comercial.',
      });
      creadas++;
    }
    console.log(creadas === 0 ? '[Camilo] ✅ Sin patrones nuevos.' : `[Camilo] 📊 ${creadas} insight(s) nuevo(s) publicado(s).`);
  } catch (err) { console.error('[Camilo] Error en detección:', err.message); }
}

// ── SOFÍA: prospectos de alto presupuesto sin perfil psicográfico, >3 días de antigüedad ───
async function detectSofiaAlerts() {
  console.log('[Sofía] Escaneando prospectos de alto valor sin perfil...');
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.nombre, p.apellido, p.presupuesto_usd
       FROM prospectos p LEFT JOIN sofia_profiles sp ON sp.prospecto_id = p.id
       WHERE p.tenant_id = $1 AND sp.prospecto_id IS NULL
         AND p.presupuesto_usd >= 150000 AND p.fecha_registro < NOW() - INTERVAL '3 days'`,
      [TENANT_ID]
    );
    if (rows.length === 0) { console.log('[Sofía] ✅ Sin prospectos de alto valor pendientes de perfilar.'); return; }

    const alertKey = `sin_perfil:${rows.map(r => r.id).sort().join(',')}`;
    if (await alertaExistente('SOFIA', alertKey, 24)) return;

    const detalle = rows.map(r => `${r.nombre} ${r.apellido} ($${Number(r.presupuesto_usd).toLocaleString()})`).join(', ');
    await registrarAlerta('SOFIA', alertKey, detalle);
    await notifyAdmin({
      agentLabel: 'Sofía', color: '#DB2777', emoji: '🧠',
      subject: `${rows.length} cliente(s) de alto presupuesto sin perfil psicográfico`,
      mensaje: `Llevan más de 3 días registrados sin perfil: <strong>${detalle}</strong>.`,
      accion: 'Ingresa al CRM → Agentes IA → Sofía y pídele que los perfile con base en su consulta original.',
    });
    console.log(`[Sofía] 🧠 ${rows.length} cliente(s) sin perfil notificado(s).`);
  } catch (err) { console.error('[Sofía] Error en detección:', err.message); }
}

// ── VALERIA: insight de alto impacto de Camilo sin contenido creado en 72h ─────────────────
async function detectValeriaAlerts() {
  console.log('[Valeria] Escaneando insights sin contenido asociado...');
  let creadas = 0;
  try {
    const { rows } = await pool.query(
      `SELECT id, titulo, tipo FROM camilo_insights
       WHERE tenant_id = $1 AND impacto = 'alto' AND status = 'nuevo' AND created_at < NOW() - INTERVAL '72 hours'`,
      [TENANT_ID]
    );
    for (const row of rows) {
      const alertKey = `insight_sin_contenido:${row.id}`;
      if (await alertaExistente('VALERIA', alertKey, 24 * 7)) continue;

      await registrarAlerta('VALERIA', alertKey, row.titulo);
      await notifyAdmin({
        agentLabel: 'Valeria', color: '#D97706', emoji: '📝',
        subject: `Insight de alto impacto sin contenido — ${row.titulo}`,
        mensaje: `El insight "<strong>${row.titulo}</strong>" (Camilo, impacto alto) lleva más de 72h sin convertirse en contenido de campaña.`,
        accion: 'Ingresa al CRM → Agentes IA → Valeria y pídele un borrador de copy basado en ese insight.',
      });
      creadas++;
    }
    console.log(creadas === 0 ? '[Valeria] ✅ Sin insights pendientes de convertir en contenido.' : `[Valeria] 📝 ${creadas} alerta(s) enviada(s).`);
  } catch (err) { console.error('[Valeria] Error en detección:', err.message); }
}

// ── ISABELLA: guiones "pending" estancados más de 5 días sin aprobar ───────────────────────
async function detectIsabellaAlerts() {
  console.log('[Isabella] Escaneando guiones estancados en aprobación...');
  try {
    const { rows } = await pool.query(
      `SELECT id, asunto FROM isabella_scripts
       WHERE tenant_id = $1 AND status = 'pending' AND created_at < NOW() - INTERVAL '5 days'`,
      [TENANT_ID]
    );
    if (rows.length === 0) { console.log('[Isabella] ✅ Sin guiones estancados.'); return; }

    for (const row of rows) {
      const alertKey = `guion_estancado:${row.id}`;
      if (await alertaExistente('ISABELLA', alertKey, 24 * 5)) continue;

      await registrarAlerta('ISABELLA', alertKey, row.asunto);
      await notifyAdmin({
        agentLabel: 'Isabella', color: '#0891B2', emoji: '🎬',
        subject: `Guion sin aprobar hace más de 5 días — ${row.asunto || row.id}`,
        mensaje: `El guion "<strong>${row.asunto || row.id}</strong>" sigue en estado "pending" hace más de 5 días.`,
        accion: 'Ingresa al CRM → Agentes IA → Isabella y apruébalo o descártalo para no perder el calendario de producción.',
      });
    }
    console.log(`[Isabella] 🎬 ${rows.length} guion(es) estancado(s) notificado(s).`);
  } catch (err) { console.error('[Isabella] Error en detección:', err.message); }
}

function startContentAgentsMonitor() {
  const INTERVAL = 24 * 60 * 60 * 1000; // cada 24h
  console.log('[Agentes IA] Monitor de Camilo/Sofía/Valeria/Isabella iniciado — análisis cada 24h.');
  ensureTable().then(() => {
    detectCamiloAlerts();
    detectSofiaAlerts();
    detectValeriaAlerts();
    detectIsabellaAlerts();
  });
  setInterval(() => {
    detectCamiloAlerts();
    detectSofiaAlerts();
    detectValeriaAlerts();
    detectIsabellaAlerts();
  }, INTERVAL);
}

module.exports = { startContentAgentsMonitor, detectCamiloAlerts, detectSofiaAlerts, detectValeriaAlerts, detectIsabellaAlerts };
