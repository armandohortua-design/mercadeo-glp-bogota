/**
 * legalAlertMonitor.js — Alertas proactivas de trámites legales (Reserva/Promesa/Escritura)
 * Mismo patrón que crisisDetector.js: escanea legal_docs cada 24h, calcula vencido/urgente/
 * estancado (misma lógica que ya corre en el navegador, CRMDashboard.tsx ~17475-17498) y
 * notifica por correo al equipo interno con contexto real (cliente, documento, fecha).
 */

const pool = require('./db');
const nodemailer = require('nodemailer');

const TENANT_ID = 'tenant-glp-001';

// pg devuelve columnas DATE como objetos Date — String(date) da "Thu Aug 20 2026..." (con una
// 'T' mayúscula dentro de "Thu"!), así que .split('T') corta mal. toISOString() es seguro.
const fmtDateOnly = (v) => {
  if (!v) return v;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v).split('T')[0];
};

// Mismo catálogo de documentos que PHASES en CRMDashboard.tsx (~17379-17409) —
// duplicado aquí porque el backend no puede importar código del frontend.
const DOC_LABELS = {
  carta_reserva: 'Carta de Reserva',
  pago_separacion: 'Comprobante de Pago Separación',
  due_diligence: 'Due Diligence Inicial (Identidad)',
  propuesta_comercial: 'Propuesta Comercial Firmada',
  promesa_compraventa: 'Promesa de Compraventa',
  cert_tradicion: 'Certificado de Tradición y Libertad',
  estudio_titulo: 'Estudio de Títulos',
  paz_salvo: 'Paz y Salvo Administración',
  poder_notarial: 'Poder Notarial (si aplica)',
  escritura_publica: 'Escritura Pública Notariada',
  registro_rph: 'Registro en Registro Público',
  dian_documentos: 'Declaración DIAN / OFAC',
  acta_entrega: 'Acta de Entrega del Inmueble',
  llaves: 'Entrega de Llaves y Manuales',
};

async function notifyAdminLegalAlert({ tipo, prospectName, docLabel, dueDate, daysVal }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!adminEmail || !smtpUser || !smtpPass) return;

  const CFG = {
    vencido:   { color: '#DC2626', emoji: '🚨', label: 'Documento vencido' },
    urgente:   { color: '#D97706', emoji: '⚠️', label: 'Vence pronto' },
    estancado: { color: '#3B82F6', emoji: '🧊', label: 'Firma estancada' },
  }[tipo];

  const detalle = tipo === 'vencido'
    ? `venció hace ${daysVal} día(s) (fecha límite: ${dueDate})`
    : tipo === 'urgente'
    ? `vence en ${daysVal} día(s) (fecha límite: ${dueDate})`
    : `lleva ${daysVal} día(s) enviado a firma sin respuesta`;

  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({
      from: `"CRM GLP · Trámites" <${smtpUser}>`,
      to: adminEmail,
      subject: `${CFG.emoji} ${CFG.label} — ${prospectName} · ${docLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:${CFG.color};color:#fff;padding:20px;text-align:center">
            <h2 style="margin:0;letter-spacing:1px">${CFG.emoji} ${CFG.label.toUpperCase()}</h2>
            <p style="margin:4px 0;font-size:12px;opacity:.85">${new Date().toLocaleString('es-CO')} · GLP Wealth Management</p>
          </div>
          <div style="padding:24px;background:#fff">
            <p style="color:#374151;line-height:1.6;font-size:15px">
              El trámite de <strong>${prospectName}</strong> tiene el documento
              <strong>${docLabel}</strong> que ${detalle}.
            </p>
            <div style="background:#FFF7ED;border-left:4px solid ${CFG.color};padding:14px;margin-top:16px">
              <p style="margin:0;font-size:13px;color:#92400E"><strong>Acción recomendada:</strong> Ingresa al CRM → Legal & Cierre → busca a ${prospectName} y da seguimiento al documento antes de que afecte la fecha de entrega.</p>
            </div>
            <p style="color:#9ca3af;font-size:11px;margin-top:20px">Alerta generada automáticamente por el monitor de trámites de GLP CRM.</p>
          </div>
        </div>`
    });
    console.log(`[Legal] 📧 Notificado — ${tipo} en ${docLabel} de ${prospectName}`);
  } catch (err) {
    console.error('[Legal] Error enviando email:', err.message);
  }
}

// Evita reenviar el mismo aviso (mismo prospecto+doc+tipo) dentro de las últimas 48h.
async function alertaExistente(prospectoId, docKey, tipo) {
  const { rows } = await pool.query(`
    SELECT id FROM legal_alerts
    WHERE tenant_id = $1 AND prospecto_id = $2 AND doc_key = $3 AND tipo = $4
    AND created_at > NOW() - INTERVAL '48 hours'
  `, [TENANT_ID, prospectoId, docKey, tipo]);
  return rows.length > 0;
}

async function detectLegalAlerts() {
  console.log('[Legal] Escaneando documentos de trámites...');
  let alertasCreadas = 0;
  const today = new Date();

  try {
    const { rows } = await pool.query(`
      SELECT ld.*, p.nombre, p.apellido
      FROM legal_docs ld
      JOIN prospectos p ON p.id = ld.prospecto_id
      WHERE ld.tenant_id = $1
    `, [TENANT_ID]);

    for (const row of rows) {
      const docLabel = DOC_LABELS[row.doc_key] || row.doc_key;
      const prospectName = `${row.nombre} ${row.apellido || ''}`.trim();
      const activo = row.status !== 'firmado' && row.status !== 'archivado';

      let tipo = null, daysVal = 0, dueDate = null;

      if (row.due_date && activo) {
        const diff = (new Date(row.due_date).getTime() - today.getTime()) / 86400000;
        if (diff < 0) { tipo = 'vencido'; daysVal = Math.abs(Math.round(diff)); }
        else if (diff < 7) { tipo = 'urgente'; daysVal = Math.round(diff); }
        dueDate = fmtDateOnly(row.due_date);
      }
      if (!tipo && row.sign_sent_date && row.status === 'en_revision') {
        const days = (today.getTime() - new Date(row.sign_sent_date).getTime()) / 86400000;
        if (days > 7) { tipo = 'estancado'; daysVal = Math.round(days); }
      }
      if (!tipo) continue;

      if (await alertaExistente(row.prospecto_id, row.doc_key, tipo)) continue;

      await pool.query(`
        INSERT INTO legal_alerts (tenant_id, prospecto_id, doc_key, tipo, created_at)
        VALUES ($1,$2,$3,$4,NOW())
      `, [TENANT_ID, row.prospecto_id, row.doc_key, tipo]);

      await notifyAdminLegalAlert({ tipo, prospectName, docLabel, dueDate, daysVal });
      alertasCreadas++;
    }

    console.log(alertasCreadas === 0
      ? '[Legal] ✅ Sin alertas nuevas de trámites.'
      : `[Legal] 🚨 ${alertasCreadas} alerta(s) de trámites enviada(s).`);
    return alertasCreadas;
  } catch (err) {
    console.error('[Legal] Error en detección:', err.message);
    return 0;
  }
}

function startLegalAlertMonitor() {
  const INTERVAL = 24 * 60 * 60 * 1000; // cada 24h
  console.log('[Legal] Monitor de alertas de trámites iniciado — análisis cada 24h.');
  detectLegalAlerts();
  setInterval(detectLegalAlerts, INTERVAL);
}

module.exports = { startLegalAlertMonitor, detectLegalAlerts };
