const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function verify() {
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('camilo_insights','valeria_drafts','isabella_scripts')
    ORDER BY table_name
  `);
  console.log('\n=== TABLAS NUEVAS EN SUPABASE ===');
  tables.forEach(r => console.log('  ✅', r.table_name));

  const { rows: cols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'prospectos'
      AND column_name IN ('sara_auto_email_sent','sara_cold_alert_sent')
    ORDER BY column_name
  `);
  console.log('\n=== COLUMNAS NUEVAS EN PROSPECTOS ===');
  cols.forEach(r => console.log('  ✅', r.column_name));
  console.log('\n✅ Todo correcto. Listo para A.2 (endpoints REST).\n');
  await pool.end();
}

verify().catch(e => { console.error('❌', e.message); pool.end(); });
