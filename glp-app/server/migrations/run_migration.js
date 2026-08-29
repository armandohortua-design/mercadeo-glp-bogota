/**
 * Seed: inserta los 18 proyectos GLP en la tabla projects de Supabase.
 * Uso: node server/migrations/run_migration.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // Primero verificar cuántos proyectos hay ya
    const { rows: existing } = await pool.query(
      "SELECT COUNT(*) FROM projects WHERE tenant_id = 'tenant-glp-001'"
    );
    const count = parseInt(existing[0].count);
    if (count > 0) {
      console.log(`ℹ️  Ya existen ${count} proyectos para tenant-glp-001.`);
      console.log('   Para reimportar, borra primero: DELETE FROM projects WHERE tenant_id = \'tenant-glp-001\';');
      await pool.end();
      return;
    }

    console.log('⏳ Insertando 18 proyectos GLP en Supabase...');
    const sql = fs.readFileSync(path.join(__dirname, '002_seed_projects.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ 18 proyectos insertados correctamente en Supabase');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detalle:', err.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
