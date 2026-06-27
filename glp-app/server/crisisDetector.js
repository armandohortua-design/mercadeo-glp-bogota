/**
 * crisisDetector.js — Motor de Detección de Crisis de Ventas GLP
 * Monitorea KPIs cada 24h contra baseline histórico.
 * Dispara alertas en crisis_alerts cuando cualquier métrica cae.
 */

const pool = require('./db');

const TENANT_ID = 'tenant-glp-001';

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
