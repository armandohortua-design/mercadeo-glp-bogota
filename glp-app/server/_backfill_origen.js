require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const updates = [
    ["UPDATE drafts SET origen='reactivacion_alerta' WHERE origen IS NULL AND project = 'Reactivación'"],
    ["UPDATE drafts SET origen='cobranza_cartera' WHERE origen IS NULL AND project = 'Cartera'"],
    ["UPDATE drafts SET origen='correo_entrante' WHERE origen IS NULL AND project ILIKE '%correo entrante%'"],
    ["UPDATE drafts SET origen='seguimiento_sara' WHERE origen IS NULL AND destinatario IS NOT NULL AND id LIKE 'draft-%' AND project ~ '\['"], // proyectos_interes JSON array => from process-prospects
    ["UPDATE drafts SET origen='solicitud_cliente' WHERE origen IS NULL"],
  ];
  for (const [sql] of updates) {
    const r = await pool.query(sql);
    console.log(sql.slice(0,60), '->', r.rowCount);
  }
  const { rows } = await pool.query('SELECT origen, COUNT(*) FROM drafts GROUP BY origen ORDER BY 2 DESC');
  console.log(rows);
  await pool.end();
})();
