/**
 * carteraMonitor.js — Alertas proactivas de cobranza (cuentas que cruzan a mora)
 * Mismo patrón que legalAlertMonitor.js: escanea `carteras` cada 24h, detecta cuentas cuyo
 * riesgo pasó a rojo (usando la MISMA regla que el semáforo real del Panel de Mando y que
 * el agente Andrea — ver comentarios en /api/agents/chat, rama CARTERA) y notifica por
 * correo al equipo interno con el monto y cliente reales, en vez de esperar a que alguien
 * entre a preguntarle a Andrea o revisar el Panel de Mando.
 */

const pool = require('./db');
const nodemailer = require('nodemailer');

const TENANT_ID = 'tenant-glp-001';

async function notifyAdminCarteraAlert({ prospectName, proyecto, montoMora, cuotasEnMora }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!adminEmail || !smtpUser || !smtpPass) return;

  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({
      from: `"CRM · Cartera" <${smtpUser}>`,
      to: adminEmail,
      subject: `🔴 Nueva cuenta en mora — ${prospectName} · ${proyecto}`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:#DC2626;color:#fff;padding:20px;text-align:center">
            <h2 style="margin:0;letter-spacing:1px">🔴 CUENTA EN MORA</h2>
            <p style="margin:4px 0;font-size:12px;opacity:.85">${new Date().toLocaleString('es-CO')} · Capital Brokers Properties</p>
          </div>
          <div style="padding:24px;background:#fff">
            <p style="color:#374151;line-height:1.6;font-size:15px">
              <strong>${prospectName}</strong> (${proyecto}) tiene <strong>${cuotasEnMora}</strong> cuota(s)
              vencida(s) por un total de <strong>$${montoMora.toLocaleString()}</strong>.
            </p>
            <div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:14px;margin-top:16px">
              <p style="margin:0;font-size:13px;color:#991B1B"><strong>Acción recomendada:</strong> Ingresa al CRM → Cartera → busca a ${prospectName} y gestiona el cobro, o pídele a Andrea (Cartera → Preguntar a Andrea) que redacte un correo de cobranza.</p>
            </div>
            <p style="color:#9ca3af;font-size:11px;margin-top:20px">Alerta generada automáticamente por el monitor de cartera del CRM.</p>
          </div>
        </div>`
    });
    console.log(`[Cartera] 📧 Notificado — mora nueva de ${prospectName}`);
  } catch (err) {
    console.error('[Cartera] Error enviando email:', err.message);
  }
}

// Evita reenviar el mismo aviso (misma cartera) dentro de las últimas 48h.
async function alertaExistente(carteraId) {
  const { rows } = await pool.query(`
    SELECT id FROM cartera_alerts
    WHERE tenant_id = $1 AND cartera_id = $2 AND created_at > NOW() - INTERVAL '48 hours'
  `, [TENANT_ID, carteraId]);
  return rows.length > 0;
}

async function detectCarteraAlerts() {
  console.log('[Cartera] Escaneando cuentas en mora...');
  let alertasCreadas = 0;
  const hoyC = new Date().toISOString().slice(0, 10);

  try {
    const { rows } = await pool.query(
      `SELECT id, prospecto_nombre, proyecto, cuotas FROM carteras WHERE tenant_id = $1`,
      [TENANT_ID]
    );

    for (const row of rows) {
      const cuotas = Array.isArray(row.cuotas) ? row.cuotas : [];
      // Misma regla que el semáforo real (ver calcRiesgo en el frontend y el agente
      // Andrea): monto > 0 excluye cuotas placeholder en $0 nunca completadas.
      const vencidas = cuotas.filter(q => q.monto > 0 && q.estado !== 'pagada' &&
        (q.estado === 'vencida' || (q.estado === 'pendiente' && q.fecha_vencimiento < hoyC)));
      if (vencidas.length === 0) continue;

      if (await alertaExistente(row.id)) continue;

      const montoMora = vencidas.reduce((s, q) => s + Number(q.monto || 0), 0);
      await pool.query(
        `INSERT INTO cartera_alerts (tenant_id, cartera_id, monto_mora, cuotas_en_mora, created_at)
         VALUES ($1,$2,$3,$4,NOW())`,
        [TENANT_ID, row.id, montoMora, vencidas.length]
      );

      await notifyAdminCarteraAlert({
        prospectName: row.prospecto_nombre, proyecto: row.proyecto,
        montoMora, cuotasEnMora: vencidas.length,
      });
      alertasCreadas++;
    }

    console.log(alertasCreadas === 0
      ? '[Cartera] ✅ Sin cuentas nuevas en mora.'
      : `[Cartera] 🔴 ${alertasCreadas} alerta(s) de mora enviada(s).`);
    return alertasCreadas;
  } catch (err) {
    console.error('[Cartera] Error en detección:', err.message);
    return 0;
  }
}

function startCarteraMonitor() {
  const INTERVAL = 24 * 60 * 60 * 1000; // cada 24h
  console.log('[Cartera] Monitor de alertas de mora iniciado — análisis cada 24h.');
  detectCarteraAlerts();
  setInterval(detectCarteraAlerts, INTERVAL);
}

module.exports = { startCarteraMonitor, detectCarteraAlerts };
