const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const TENANT_ID = 'tenant-glp-001';

const DEFAULT_BUSINESS_CONFIG = {
  stageProb: {
    'Contacto Inicial': 0.05, 'Calificación': 0.15, 'Presentación': 0.30,
    'Negociación': 0.60, 'Cierre': 0.85, 'Post-venta': 1.0, 'Lead Frío': 0.02,
  },
  avgDaysPerStage: {
    'Contacto Inicial': 14, 'Calificación': 21, 'Presentación': 30,
    'Negociación': 45, 'Cierre': 20, 'Lead Frío': 60,
  },
  saraThresholds: {
    'Contacto Inicial': { tibio: 2, frio: 5, critico: 10 },
    'Calificación':     { tibio: 3, frio: 7, critico: 14 },
    'Presentación':     { tibio: 4, frio: 8, critico: 15 },
    'Negociación':      { tibio: 2, frio: 4, critico: 7 },
    'Cierre':           { tibio: 1, frio: 2, critico: 4 },
    'Post-venta':       { tibio: 14, frio: 30, critico: 60 },
  },
};

const SEED_BROKERS = [
  { nombre: 'Patricia Vargas', empresa: 'Coldwell Banker', zona: 'Bogotá Norte', telefono: '+57 310 555 1234', email: 'patricia@coldwellbanker.co', estado: 'activo' },
  { nombre: 'Santiago Mesa', empresa: 'Independiente', zona: 'Bogotá – Chapinero', telefono: '+57 311 555 2345', email: 'santiago.mesa@gmail.com', estado: 'activo' },
  { nombre: 'Rodrigo Fernández', empresa: 'Banco Privado', zona: 'Medellín', telefono: '+57 312 555 3456', email: 'rodrigo.f@bancoprivado.co', estado: 'activo' },
  { nombre: 'Valentina Ospina', empresa: 'Ospina & Restrepo', zona: 'Bogotá – Usaquén', telefono: '+57 313 555 4567', email: 'valentina@ospinarestrepo.co', estado: 'activo' },
  { nombre: 'Andrés Morales', empresa: 'BBVA Wealth', zona: 'Bogotá Centro', telefono: '+57 314 555 5678', email: 'andres.morales@bbva.co', estado: 'activo' },
  { nombre: 'Camila Restrepo', empresa: 'Keller Williams', zona: 'Cali', telefono: '+57 315 555 6789', email: 'camila.r@kw.co', estado: 'inactivo' },
  { nombre: 'Felipe Londoño', empresa: 'Grupo Bolívar', zona: 'Barranquilla', telefono: '+57 316 555 7890', email: 'felipe.l@grupobolivar.co', estado: 'activo' },
];

async function run() {
  try {
    console.log('⏳ Ejecutando migración 004_brokers_and_config.sql...');
    const sql = fs.readFileSync(path.join(__dirname, '004_brokers_and_config.sql'), 'utf8');
    await pool.query(sql);

    const { rows: existing } = await pool.query('SELECT COUNT(*)::int AS c FROM brokers WHERE tenant_id = $1', [TENANT_ID]);
    if (existing[0].c === 0) {
      console.log('🌱 Sembrando brokers iniciales...');
      for (const b of SEED_BROKERS) {
        await pool.query(
          `INSERT INTO brokers (tenant_id, nombre, empresa, zona, telefono, email, estado) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [TENANT_ID, b.nombre, b.empresa, b.zona, b.telefono, b.email, b.estado]
        );
      }
      console.log(`✅ ${SEED_BROKERS.length} brokers sembrados.`);
    } else {
      console.log(`ℹ️  Ya existen ${existing[0].c} brokers, no se siembra de nuevo.`);
    }

    const { rows: cfgExisting } = await pool.query('SELECT tenant_id FROM business_config WHERE tenant_id = $1', [TENANT_ID]);
    if (cfgExisting.length === 0) {
      console.log('🌱 Sembrando reglas de negocio por defecto...');
      await pool.query(
        `INSERT INTO business_config (tenant_id, config) VALUES ($1, $2::jsonb)`,
        [TENANT_ID, JSON.stringify(DEFAULT_BUSINESS_CONFIG)]
      );
      console.log('✅ business_config sembrado.');
    } else {
      console.log('ℹ️  Ya existe business_config para este tenant, no se sobreescribe.');
    }

    console.log('\n✅ Migración 004 completada sin errores.');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    if (err.detail) console.error('   Detalle:', err.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
