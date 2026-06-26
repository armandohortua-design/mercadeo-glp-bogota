const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'crm_database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error abriendo base de datos', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite.');
    db.run(`CREATE TABLE IF NOT EXISTS prospectos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT,
      correo TEXT,
      telefono TEXT,
      direccion TEXT,
      ocupacion TEXT,
      empresa TEXT,
      linkedin TEXT,
      proyectos_interes TEXT,
      forma_contacto TEXT,
      broker_asignado TEXT,
      presupuesto_usd REAL,
      estado TEXT DEFAULT 'Lead Nuevo',
      canal TEXT DEFAULT 'Web',
      notas TEXT,
      historial TEXT,
      fecha_registro TEXT,
      fecha_ultima_actividad TEXT
    )`, (err) => {
      if (err) console.error('Error creando tabla prospectos', err);
    });

    db.run(`CREATE TABLE IF NOT EXISTS brokers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      empresa TEXT,
      zona TEXT,
      telefono TEXT,
      email TEXT,
      estado TEXT DEFAULT 'activo'
    )`, (err) => {
      if (err) console.error('Error creando tabla brokers', err);
    });

    db.run(`CREATE TABLE IF NOT EXISTS activos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto TEXT NOT NULL,
      unidad TEXT NOT NULL,
      metros_cuadrados REAL,
      habitaciones INTEGER,
      precio_usd REAL,
      estado TEXT DEFAULT 'Disponible',
      detalles TEXT
    )`, (err) => {
      if (err) console.error('Error creando tabla activos', err);
    });

    db.run(`CREATE TABLE IF NOT EXISTS bitacora (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      cliente TEXT,
      correo TEXT,
      whatsapp TEXT,
      proyecto TEXT,
      canal TEXT,
      correoCliente TEXT,
      correoAdmin TEXT,
      borradorCreado TEXT,
      mensaje TEXT
    )`, (err) => {
      if (err) console.error('Error creando tabla bitacora', err);
    });
  }
});

module.exports = db;
