/**
 * crisisDetector.js — Motor de Detección de Crisis de Ventas GLP
 * Monitorea KPIs cada 24h contra baseline histórico.
 * Dispara alertas en crisis_alerts cuando cualquier métrica cae.
 */

const pool = require('./db');
const nodemailer = require('nodemailer');

const TENANT_ID = 'tenant-glp-001';

// C.1: Notificación al admin cuando se detecta una crisis GRAVE
async function notifyAdminCrisisGrave({ nivel, titulo, descripcion, tipo, metricaActual, metricaBaseline, variacionPct }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpUser   = process.env.SMTP_USER;
  const smtpPass   = process.env.SMTP_PASS;
  if (!adminEmail || !smtpUser || !smtpPass) return;

  const colorNivel  = nivel === 'grave' ? '#DC2626' : nivel === 'moderada' ? '#F59E0B' : '#6B7280';
  const emojiNivel  = nivel === 'grave' ? '🚨' : nivel === 'moderada' ? '⚠️' : '📊';
  const labelTipo   = { prospectos_nuevos: 'Prospectos Nuevos', estancamiento: 'Estancamiento de Embudo', valor_pipeline: 'Valor del Pipeline' }[tipo] || tipo;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: `"CRM GLP · Alertas" <${smtpUser}>`,
      to: adminEmail,
      subject: `${emojiNivel} CRISIS ${nivel.toUpperCase()} detectada — ${labelTipo}`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:${colorNivel};color:#fff;padding:20px;text-align:center">
            <h2 style="margin:0;letter-spacing:2px">${emojiNivel} ALERTA DE CRISIS ${nivel.toUpperCase()}</h2>
            <p style="margin:4px 0;font-size:12px;opacity:.85">${new Date().toLocaleString('es-CO')} · GLP Wealth Management</p>
          </div>
          <div style="padding:24px;background:#fff">
            <h3 style="color:${colorNivel};margin-top:0">${titulo}</h3>
            <p style="color:#374151;line-height:1.6">${descripcion}</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin:20px 0">
              <tr style="background:#f3f4f6">
                <th style="padding:10px;text-align:left">Métrica</th>
                <th style="padding:10px;text-align:right">Valor actual</th>
                <th style="padding:10px;text-align:right">Baseline</th>
                <th style="padding:10px;text-align:right">Variación</th>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #eee">${labelTipo}</td>
                <td style="padding:10px;text-align:right;border-bottom:1px solid #eee;font-weight:700;color:${colorNivel}">${typeof metricaActual === 'number' && metricaActual > 1000 ? '$' + metricaActual.toLocaleString() : metricaActual}</td>
                <td style="padding:10px;text-align:right;border-bottom:1px solid #eee">${typeof metricaBaseline === 'number' && metricaBaseline > 1000 ? '$' + Number(metricaBaseline).toLocaleString() : Number(metricaBaseline).toFixed(1)}</td>
                <td style="padding:10px;text-align:right;border-bottom:1px solid #eee;color:${colorNivel};font-weight:700">${Number(variacionPct).toFixed(1)}%</td>
              </tr>
            </table>
            <div style="background:#FFF7ED;border-left:4px solid ${colorNivel};padding:14px;margin-bottom:20px">
              <p style="margin:0;font-size:13px;color:#92400E"><strong>Acción recomendada:</strong> Ingresa al CRM → Dashboard → Panel de Crisis para ver el análisis completo y activar la Respuesta Coordinada del equipo de agentes.</p>
            </div>
            <p style="color:#9ca3af;font-size:11px">Esta alerta fue generada automáticamente por el motor de detección de crisis de GLP CRM. Solo se notifica en niveles GRAVE.</p>
          </div>
        </div>`
    });
    console.log(`[Crisis] 📧 Admin notificado — crisis ${nivel.toUpperCase()} en ${tipo}`);
  } catch (err) {
    console.error('[Crisis] Error enviando email al admin:', err.message);
  }
}

// Umbrales de variación negativa para cada nivel
// (porcentaje de caída respecto al baseline)
const THRESHOLDS = {
  leve:     -15,  // caída entre 15% y 30%
  moderada: -30,  // caída entre 30% y 50%
  grave:    -50,  // caída superior al 50%
};

function getNivel(variacionPct) {
  if (variacionPct <= THRESHOLDS.grave)    return 'grave';
  if (variacionPct <= THRESHOLDS.moderada) return 'moderada';
  if (variacionPct <= THRESHOLDS.leve)     return 'leve';
  return null;
}

/**
 * Calcula el baseline de prospectos nuevos:
 * promedio semanal de las últimas 4 semanas (excluyendo la semana actual)
 */
async function getBaselineProspectosNuevos() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE fecha_registro >= NOW() - INTERVAL '14 days' AND fecha_registro < NOW() - INTERVAL '7 days')  AS s2,
      COUNT(*) FILTER (WHERE fecha_registro >= NOW() - INTERVAL '21 days' AND fecha_registro < NOW() - INTERVAL '14 days') AS s3,
      COUNT(*) FILTER (WHERE fecha_registro >= NOW() - INTERVAL '28 days' AND fecha_registro < NOW() - INTERVAL '21 days') AS s4,
      COUNT(*) FILTER (WHERE fecha_registro >= NOW() - INTERVAL '7 days')                                                   AS actual
    FROM prospectos
    WHERE tenant_id = $1
  `, [TENANT_ID]);

  const r = rows[0];
  const semanas = [Number(r.s2), Number(r.s3), Number(r.s4)].filter(n => n > 0);
  const baseline = semanas.length > 0
    ? semanas.reduce((a, b) => a + b, 0) / semanas.length
    : Number(r.actual) || 1;

  return { actual: Number(r.actual), baseline };
}

/**
 * Detecta estancamiento: prospectos en Contacto Inicial o Calificación
 * sin cambio de etapa en más de 10 días (respecto a semana anterior)
 */
async function getBaselineEstancamiento() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE fecha_ultima_actividad < NOW() - INTERVAL '10 days' AND estado IN ('Contacto Inicial','Calificación')) AS estancados_actual,
      COUNT(*) FILTER (WHERE fecha_ultima_actividad BETWEEN NOW() - INTERVAL '17 days' AND NOW() - INTERVAL '10 days' AND estado IN ('Contacto Inicial','Calificación')) AS estancados_semana_ant
    FROM prospectos
    WHERE tenant_id = $1 AND estado NOT IN ('Post-venta','Perdido','Cierre')
  `, [TENANT_ID]);

  const r = rows[0];
  return {
    actual: Number(r.estancados_actual),
    baseline: Number(r.estancados_semana_ant) || 0,
  };
}

/**
 * Valor total del pipeline en Negociación + Cierre esta semana vs semana anterior
 */
async function getBaselineValorPipeline() {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(presupuesto_usd) FILTER (WHERE estado IN ('Negociación','Cierre')), 0) AS valor_actual,
      COALESCE(SUM(presupuesto_usd) FILTER (WHERE estado IN ('Negociación','Cierre') AND fecha_ultima_actividad >= NOW() - INTERVAL '14 days' AND fecha_ultima_actividad < NOW() - INTERVAL '7 days'), 0) AS valor_semana_ant
    FROM prospectos
    WHERE tenant_id = $1
  `, [TENANT_ID]);

  const r = rows[0];
  return {
    actual: Number(r.valor_actual),
    baseline: Number(r.valor_semana_ant) || Number(r.valor_actual) || 1,
  };
}

/**
 * Verifica si ya existe una alerta activa reciente del mismo tipo (evita duplicados)
 */
async function alertaExistente(tipo) {
  const { rows } = await pool.query(`
    SELECT id FROM crisis_alerts
    WHERE tenant_id = $1 AND tipo = $2 AND status NOT IN ('resuelta','descartada')
    AND created_at > NOW() - INTERVAL '48 hours'
  `, [TENANT_ID, tipo]);
  return rows.length > 0;
}

async function detectCrisis() {
  console.log('[Crisis] Iniciando análisis de KPIs de ventas...');
  let alertasCreadas = 0;

  try {
    // ── MÉTRICA 1: Prospectos nuevos ────────────────────────
    const pn = await getBaselineProspectosNuevos();
    const varPN = pn.baseline > 0 ? ((pn.actual - pn.baseline) / pn.baseline) * 100 : 0;
    const nivelPN = getNivel(varPN);

    if (nivelPN && !(await alertaExistente('prospectos_nuevos'))) {
      const id = `crisis-pn-${Date.now()}`;
      await pool.query(`
        INSERT INTO crisis_alerts (id, tenant_id, tipo, nivel, titulo, descripcion, metrica_actual, metrica_baseline, variacion_pct, status, created_at, updated_at)
        VALUES ($1,$2,'prospectos_nuevos',$3,$4,$5,$6,$7,$8,'nueva',NOW(),NOW())
      `, [
        id, TENANT_ID, nivelPN,
        `📉 Caída de prospectos nuevos — ${Math.abs(varPN).toFixed(0)}% menos esta semana`,
        `Esta semana ingresaron ${pn.actual} prospectos nuevos. El promedio de las últimas 3 semanas fue ${pn.baseline.toFixed(1)}. Caída de ${Math.abs(varPN).toFixed(1)}%.`,
        pn.actual, pn.baseline, varPN
      ]);
      console.log(`[Crisis] ⚠️ ALERTA ${nivelPN.toUpperCase()}: Prospectos nuevos (${varPN.toFixed(1)}%)`);
      if (nivelPN === 'grave') {
        await notifyAdminCrisisGrave({ nivel: nivelPN, titulo: `📉 Caída de prospectos nuevos — ${Math.abs(varPN).toFixed(0)}% menos esta semana`, descripcion: `Esta semana ingresaron ${pn.actual} prospectos nuevos. El promedio de las últimas 3 semanas fue ${pn.baseline.toFixed(1)}. Caída de ${Math.abs(varPN).toFixed(1)}%.`, tipo: 'prospectos_nuevos', metricaActual: pn.actual, metricaBaseline: pn.baseline, variacionPct: varPN });
      }
      alertasCreadas++;
    }

    // ── MÉTRICA 2: Estancamiento en embudo ──────────────────
    const est = await getBaselineEstancamiento();
    // Crisis si los estancados aumentaron más del 30% respecto a semana anterior
    const varEst = est.baseline > 0 ? ((est.actual - est.baseline) / est.baseline) * 100 : 0;
    const nivelEst = est.actual > 0 && varEst >= 30
      ? (varEst >= 80 ? 'grave' : varEst >= 50 ? 'moderada' : 'leve')
      : null;

    if (nivelEst && !(await alertaExistente('estancamiento'))) {
      const id = `crisis-est-${Date.now()}`;
      await pool.query(`
        INSERT INTO crisis_alerts (id, tenant_id, tipo, nivel, titulo, descripcion, metrica_actual, metrica_baseline, variacion_pct, status, created_at, updated_at)
        VALUES ($1,$2,'estancamiento',$3,$4,$5,$6,$7,$8,'nueva',NOW(),NOW())
      `, [
        id, TENANT_ID, nivelEst,
        `🧊 Embudo estancado — ${est.actual} prospectos sin movimiento +10 días`,
        `Hay ${est.actual} prospectos en etapas tempranas sin actividad en más de 10 días. La semana anterior eran ${est.baseline}. Aumento del ${varEst.toFixed(1)}%.`,
        est.actual, est.baseline, varEst
      ]);
      console.log(`[Crisis] ⚠️ ALERTA ${nivelEst.toUpperCase()}: Estancamiento de embudo (${varEst.toFixed(1)}% más que semana ant.)`);
      if (nivelEst === 'grave') {
        await notifyAdminCrisisGrave({ nivel: nivelEst, titulo: `🧊 Embudo estancado — ${est.actual} prospectos sin movimiento +10 días`, descripcion: `Hay ${est.actual} prospectos en etapas tempranas sin actividad en más de 10 días. La semana anterior eran ${est.baseline}. Aumento del ${varEst.toFixed(1)}%.`, tipo: 'estancamiento', metricaActual: est.actual, metricaBaseline: est.baseline, variacionPct: varEst });
      }
      alertasCreadas++;
    }

    // ── MÉTRICA 3: Valor del pipeline ───────────────────────
    const vp = await getBaselineValorPipeline();
    const varVP = vp.baseline > 0 ? ((vp.actual - vp.baseline) / vp.baseline) * 100 : 0;
    const nivelVP = getNivel(varVP);

    if (nivelVP && !(await alertaExistente('valor_pipeline'))) {
      const id = `crisis-vp-${Date.now()}`;
      await pool.query(`
        INSERT INTO crisis_alerts (id, tenant_id, tipo, nivel, titulo, descripcion, metrica_actual, metrica_baseline, variacion_pct, status, created_at, updated_at)
        VALUES ($1,$2,'valor_pipeline',$3,$4,$5,$6,$7,$8,'nueva',NOW(),NOW())
      `, [
        id, TENANT_ID, nivelVP,
        `💸 Pipeline de cierre cayó — $${vp.actual.toLocaleString()} vs $${vp.baseline.toLocaleString()} USD`,
        `El valor total en Negociación y Cierre es $${vp.actual.toLocaleString()} USD. La semana anterior fue $${vp.baseline.toLocaleString()} USD. Variación: ${varVP.toFixed(1)}%.`,
        vp.actual, vp.baseline, varVP
      ]);
      console.log(`[Crisis] ⚠️ ALERTA ${nivelVP.toUpperCase()}: Valor pipeline (${varVP.toFixed(1)}%)`);
      if (nivelVP === 'grave') {
        await notifyAdminCrisisGrave({ nivel: nivelVP, titulo: `💸 Pipeline de cierre cayó — $${vp.actual.toLocaleString()} vs $${vp.baseline.toLocaleString()} USD`, descripcion: `El valor total en Negociación y Cierre es $${vp.actual.toLocaleString()} USD. La semana anterior fue $${vp.baseline.toLocaleString()} USD. Variación: ${varVP.toFixed(1)}%.`, tipo: 'valor_pipeline', metricaActual: vp.actual, metricaBaseline: vp.baseline, variacionPct: varVP });
      }
      alertasCreadas++;
    }

    if (alertasCreadas === 0) {
      console.log('[Crisis] ✅ KPIs dentro de rangos normales. Sin alertas nuevas.');
    } else {
      console.log(`[Crisis] 🚨 ${alertasCreadas} alerta(s) de crisis creada(s). Admin debe revisar.`);
    }

    return alertasCreadas;
  } catch (err) {
    console.error('[Crisis] Error en detección:', err.message);
    return 0;
  }
}

function startCrisisDetector() {
  const INTERVAL = 24 * 60 * 60 * 1000; // cada 24h
  console.log('[Crisis] Motor de detección de crisis iniciado — análisis cada 24h.');
  detectCrisis(); // primera ejecución inmediata
  setInterval(detectCrisis, INTERVAL);
}

module.exports = { startCrisisDetector, detectCrisis };
