/**
 * fix-activity-dates.js — Recalibra fecha_ultima_actividad de los prospectos existentes
 * para que la actividad reciente sea coherente con su etapa y no todos disparen alerta CRÍTICA.
 * Referencia de umbrales: server/prospectMonitor.js (THRESHOLDS)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = require('./db');

const TENANT_ID = 'tenant-glp-001';

// Días máximos de inactividad permitidos por etapa (por debajo del umbral "frío" de prospectMonitor.js)
const MAX_DIAS = {
  'Contacto Inicial': 4,
  'Calificación':      6,
  'Presentación':       7,
  'Negociación':        3,
  'Cierre':             1,
  'Post-venta':         20,
  'Lead Frío':          45, // se mantiene "frío" intencionalmente, pero no descontrolado
};

function randDays(max) { return Math.floor(Math.random() * (max + 1)); }

async function run() {
  const { rows } = await pool.query(
    `SELECT id, estado FROM prospectos WHERE tenant_id = $1`,
    [TENANT_ID]
  );
  console.log(`\n🔧 Recalibrando fecha_ultima_actividad de ${rows.length} prospectos...\n`);

  let ok = 0;
  for (const p of rows) {
    const max = MAX_DIAS[p.estado] ?? 5;
    const dias = randDays(max);
    const fecha = new Date(Date.now() - dias * 86400000).toISOString();
    try {
      await pool.query(
        `UPDATE prospectos SET fecha_ultima_actividad = $1 WHERE id = $2 AND tenant_id = $3`,
        [fecha, p.id, TENANT_ID]
      );
      ok++;
    } catch (e) {
      console.error(`  ❌ id=${p.id}: ${e.message}`);
    }
  }
  console.log(`✅ ${ok}/${rows.length} prospectos recalibrados.\n`);
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
