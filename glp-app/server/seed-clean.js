/**
 * seed-clean.js — Borra todos los prospectos de prueba
 * Solo elimina registros con notas = '[SEED-TEST]'
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = require('./db');
const TENANT_ID = 'tenant-glp-001';
const SEED_TAG  = '[SEED-TEST]';

async function clean() {
  const { rowCount } = await pool.query(
    `DELETE FROM prospectos WHERE tenant_id = $1 AND notas = $2`,
    [TENANT_ID, SEED_TAG]
  );
  console.log(`\n🗑️  ${rowCount} prospectos de prueba eliminados.\n`);
  await pool.end();
}

clean().catch(e => { console.error(e); process.exit(1); });
