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
    console.log('⏳ Ejecutando migración 003_agent_state.sql...');
    const sql = fs.readFileSync(path.join(__dirname, '003_agent_state.sql'), 'utf8');
    await pool.query(sql);

    // Verificar que las tablas existen
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('camilo_insights','valeria_drafts','isabella_scripts')
      ORDER BY table_name
    `);
    console.log('✅ Tablas creadas:', rows.map(r => r.table_name).join(', '));

    // Verificar columnas nuevas en prospectos
    const { rows: cols } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'prospectos'
        AND column_name IN ('sara_auto_email_sent','sara_cold_alert_sent')
    `);
    console.log('✅ Columnas en prospectos:', cols.map(r => r.column_name).join(', '));

    console.log('\n✅ Migración 003 completada sin errores.');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    if (err.detail) console.error('   Detalle:', err.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
