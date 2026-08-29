/**
 * seed-test.js  — Datos de prueba GLP CRM
 * Inserta ~40 prospectos realistas para validar todos los módulos.
 * Para borrarlos: node server/seed-clean.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = require('./db');

const TENANT_ID = 'tenant-glp-001';
const SEED_TAG  = '[SEED-TEST]'; // marca en notas para identificar y borrar

const BROKERS   = ['Patricia Vargas', 'Santiago Mesa', 'Rodrigo Fernández', 'Valentina Ospina', 'Andrés Morales', 'Felipe Londoño'];
const PROYECTOS = ['Ocean Reef Park', 'The Tides', 'Beachwalk', 'Armonía', 'Ipanema', 'Surfside', 'The Palms', 'Bosco', 'Seashore'];
const CANALES   = ['Email', 'Web', 'Evento', 'Chatbot SARA'];
const ESTADOS   = ['Contacto Inicial', 'Calificado', 'Presentación', 'Negociación', 'Cierre', 'Post-venta', 'Lead Frío'];
const PESOS_ESTADO = [3, 4, 3, 2, 2, 1, 2]; // distribución relativa

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickWeighted(arr, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const prospectos = [
  // --- Patricia Vargas (Coldwell Banker) ---
  { nombre:'Carlos',      apellido:'Gutiérrez',    correo:'carlos.gutierrez@gmail.com',    telefono:'+57 300 111 0001', broker:'Patricia Vargas', proyecto:['Ocean Reef Park'],         estado:'Post-venta',      canal:'Email',        presupuesto:1500000, dias:85 },
  { nombre:'Diana',       apellido:'Herrera',      correo:'diana.herrera@outlook.com',     telefono:'+57 300 111 0002', broker:'Patricia Vargas', proyecto:['The Tides'],               estado:'Negociación',     canal:'Evento',       presupuesto:320000,  dias:60 },
  { nombre:'Jorge',       apellido:'Salcedo',      correo:'jorge.salcedo@empresa.co',      telefono:'+57 300 111 0003', broker:'Patricia Vargas', proyecto:['Ocean Reef Park','The Tides'], estado:'Calificado', canal:'Web',          presupuesto:950000,  dias:45 },
  { nombre:'Lucía',       apellido:'Bermúdez',     correo:'lucia.bermudez@hotmail.com',    telefono:'+57 300 111 0004', broker:'Patricia Vargas', proyecto:['Beachwalk'],              estado:'Presentación',    canal:'Chatbot SARA', presupuesto:280000,  dias:30 },
  { nombre:'Hernando',    apellido:'Parra',        correo:'hernando.parra@yahoo.com',      telefono:'+57 300 111 0005', broker:'Patricia Vargas', proyecto:['The Palms'],              estado:'Lead Frío',       canal:'Email',        presupuesto:500000,  dias:88 },
  { nombre:'Marcela',     apellido:'Torres',       correo:'marcela.torres@gmail.com',      telefono:'+57 300 111 0006', broker:'Patricia Vargas', proyecto:['Surfside'],               estado:'Contacto Inicial',canal:'Web',          presupuesto:210000,  dias:10 },

  // --- Santiago Mesa (Independiente) ---
  { nombre:'Roberto',     apellido:'Castaño',      correo:'roberto.castano@gmail.com',     telefono:'+57 311 222 0001', broker:'Santiago Mesa',   proyecto:['Armonía'],                estado:'Cierre',          canal:'Referido',     presupuesto:450000,  dias:70 },
  { nombre:'María Isabel',apellido:'Rodríguez',    correo:'mariaisabel.r@outlook.com',     telefono:'+57 311 222 0002', broker:'Santiago Mesa',   proyecto:['Ipanema'],                estado:'Negociación',     canal:'Email',        presupuesto:380000,  dias:55 },
  { nombre:'Felipe',      apellido:'Acosta',       correo:'facosta@empresa.co',            telefono:'+57 311 222 0003', broker:'Santiago Mesa',   proyecto:['Beachwalk','Armonía'],    estado:'Calificado',      canal:'Evento',       presupuesto:300000,  dias:40 },
  { nombre:'Catalina',    apellido:'Moreno',       correo:'catalina.moreno@gmail.com',     telefono:'+57 311 222 0004', broker:'Santiago Mesa',   proyecto:['The Tides'],              estado:'Presentación',    canal:'Chatbot SARA', presupuesto:340000,  dias:25 },
  { nombre:'Samuel',      apellido:'Ospina',       correo:'samuelo@hotmail.com',           telefono:'+57 311 222 0005', broker:'Santiago Mesa',   proyecto:['Surfside'],               estado:'Contacto Inicial',canal:'Web',          presupuesto:220000,  dias:7  },

  // --- Rodrigo Fernández (Banco Privado) ---
  { nombre:'Andrés Felipe',apellido:'Martínez',    correo:'afmartinez@bbva.com',           telefono:'+57 312 333 0001', broker:'Rodrigo Fernández', proyecto:['Ocean Reef Park'],      estado:'Calificado',      canal:'Email',        presupuesto:800000,  dias:50 },
  { nombre:'Gabriela',    apellido:'Varón',        correo:'gabriela.varon@gmail.com',      telefono:'+57 312 333 0002', broker:'Rodrigo Fernández', proyecto:['Bosco'],                estado:'Negociación',     canal:'Evento',       presupuesto:420000,  dias:65 },
  { nombre:'Tomás',       apellido:'Echeverri',    correo:'tomas.e@empresa.co',            telefono:'+57 312 333 0003', broker:'Rodrigo Fernández', proyecto:['Seashore'],             estado:'Presentación',    canal:'Web',          presupuesto:190000,  dias:35 },
  { nombre:'Pilar',       apellido:'Londoño',      correo:'pilar.londono@outlook.com',     telefono:'+57 312 333 0004', broker:'Rodrigo Fernández', proyecto:['Ipanema','Bosco'],      estado:'Lead Frío',       canal:'Chatbot SARA', presupuesto:350000,  dias:80 },
  { nombre:'Mauricio',    apellido:'Ríos',         correo:'mauricio.rios@yahoo.com',       telefono:'+57 312 333 0005', broker:'Rodrigo Fernández', proyecto:['The Palms'],            estado:'Post-venta',      canal:'Email',        presupuesto:600000,  dias:75 },

  // --- Valentina Ospina (Ospina & Restrepo) ---
  { nombre:'Laura',       apellido:'Sánchez',      correo:'laura.sanchez@gmail.com',       telefono:'+57 313 444 0001', broker:'Valentina Ospina',proyecto:['Beachwalk'],              estado:'Cierre',          canal:'Referido',     presupuesto:270000,  dias:62 },
  { nombre:'Gustavo',     apellido:'Peña',         correo:'gustavo.pena@empresa.co',       telefono:'+57 313 444 0002', broker:'Valentina Ospina',proyecto:['Armonía','Seashore'],     estado:'Negociación',     canal:'Email',        presupuesto:410000,  dias:48 },
  { nombre:'Natalia',     apellido:'Quintero',     correo:'natalia.q@hotmail.com',         telefono:'+57 313 444 0003', broker:'Valentina Ospina',proyecto:['The Tides'],              estado:'Calificado',      canal:'Web',          presupuesto:330000,  dias:33 },
  { nombre:'Alejandro',   apellido:'Gómez',        correo:'alejandro.gomez@gmail.com',     telefono:'+57 313 444 0004', broker:'Valentina Ospina',proyecto:['Surfside'],               estado:'Contacto Inicial',canal:'Chatbot SARA', presupuesto:240000,  dias:15 },
  { nombre:'Claudia',     apellido:'Ramírez',      correo:'claudia.ramirez@outlook.com',   telefono:'+57 313 444 0005', broker:'Valentina Ospina',proyecto:['Bosco'],                  estado:'Presentación',    canal:'Evento',       presupuesto:380000,  dias:28 },

  // --- Andrés Morales (BBVA Wealth) ---
  { nombre:'Juan Pablo',  apellido:'Castro',       correo:'jp.castro@bbvawealth.co',       telefono:'+57 314 555 0001', broker:'Andrés Morales',  proyecto:['Ocean Reef Park'],        estado:'Post-venta',      canal:'Email',        presupuesto:1200000, dias:90 },
  { nombre:'Isabella',    apellido:'Montoya',      correo:'isabella.montoya@gmail.com',    telefono:'+57 314 555 0002', broker:'Andrés Morales',  proyecto:['The Palms','Ipanema'],    estado:'Negociación',     canal:'Evento',       presupuesto:490000,  dias:58 },
  { nombre:'Sergio',      apellido:'Valencia',     correo:'sergio.v@empresa.co',           telefono:'+57 314 555 0003', broker:'Andrés Morales',  proyecto:['Beachwalk'],              estado:'Calificado',      canal:'Web',          presupuesto:260000,  dias:42 },
  { nombre:'Verónica',    apellido:'Lozano',       correo:'veronica.lozano@hotmail.com',   telefono:'+57 314 555 0004', broker:'Andrés Morales',  proyecto:['Armonía'],                estado:'Presentación',    canal:'Chatbot SARA', presupuesto:310000,  dias:22 },
  { nombre:'Cristian',    apellido:'Muñoz',        correo:'cristian.munoz@gmail.com',      telefono:'+57 314 555 0005', broker:'Andrés Morales',  proyecto:['Seashore'],               estado:'Lead Frío',       canal:'Email',        presupuesto:185000,  dias:82 },
  { nombre:'Paola',       apellido:'Jiménez',      correo:'paola.jimenez@yahoo.com',       telefono:'+57 314 555 0006', broker:'Andrés Morales',  proyecto:['Bosco'],                  estado:'Contacto Inicial',canal:'Web',          presupuesto:200000,  dias:5  },

  // --- Felipe Londoño (Grupo Bolívar) ---
  { nombre:'Eduardo',     apellido:'Silva',        correo:'eduardo.silva@grupobolivar.co', telefono:'+57 316 666 0001', broker:'Felipe Londoño',  proyecto:['Surfside','The Tides'],   estado:'Cierre',          canal:'Referido',     presupuesto:730000,  dias:72 },
  { nombre:'Daniela',     apellido:'Cardona',      correo:'daniela.cardona@gmail.com',     telefono:'+57 316 666 0002', broker:'Felipe Londoño',  proyecto:['The Palms'],              estado:'Calificado',      canal:'Email',        presupuesto:350000,  dias:53 },
  { nombre:'Nicolás',     apellido:'Agudelo',      correo:'nicolas.agudelo@outlook.com',   telefono:'+57 316 666 0003', broker:'Felipe Londoño',  proyecto:['Ipanema'],                estado:'Presentación',    canal:'Evento',       presupuesto:290000,  dias:38 },
  { nombre:'Adriana',     apellido:'Bustamante',   correo:'adriana.b@empresa.co',          telefono:'+57 316 666 0004', broker:'Felipe Londoño',  proyecto:['Ocean Reef Park'],        estado:'Negociación',     canal:'Web',          presupuesto:820000,  dias:47 },
  { nombre:'Ricardo',     apellido:'Mendoza',      correo:'ricardo.mendoza@gmail.com',     telefono:'+57 316 666 0005', broker:'Felipe Londoño',  proyecto:['Bosco','Armonía'],        estado:'Contacto Inicial',canal:'Chatbot SARA', presupuesto:230000,  dias:12 },

  // --- Sin broker asignado (casos entrantes nuevos) ---
  { nombre:'Sofía',       apellido:'Jaramillo',    correo:'sofia.jaramillo@gmail.com',     telefono:'+57 300 777 0001', broker:null,              proyecto:['Beachwalk'],              estado:'Contacto Inicial',canal:'Chatbot SARA', presupuesto:250000,  dias:3  },
  { nombre:'Martín',      apellido:'Cárdenas',     correo:'martin.cardenas@outlook.com',   telefono:'+57 300 777 0002', broker:null,              proyecto:['The Tides'],              estado:'Lead Frío',       canal:'Web',          presupuesto:180000,  dias:20 },
];

async function seed() {
  console.log(`\n🌱 Insertando ${prospectos.length} prospectos de prueba en tenant ${TENANT_ID}...\n`);

  let ok = 0;
  for (const p of prospectos) {
    try {
      await pool.query(`
        INSERT INTO prospectos
          (tenant_id, nombre, apellido, correo, telefono, proyectos_interes, forma_contacto,
           broker_asignado, estado, canal, presupuesto_usd, notas, fecha_registro, fecha_ultima_actividad)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$13)
      `, [
        TENANT_ID,
        p.nombre,
        p.apellido,
        p.correo,
        p.telefono,
        JSON.stringify(p.proyecto),
        'Pagina Web',
        p.broker,
        p.estado,
        p.canal,
        p.presupuesto,
        SEED_TAG,
        daysAgo(p.dias),
      ]);
      console.log(`  ✅ ${p.nombre} ${p.apellido} — ${p.estado} — ${p.broker || 'Sin asignar'}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${p.nombre} ${p.apellido}: ${e.message || e.detail || e.code || JSON.stringify(e)}`);
    }
  }

  console.log(`\n✅ ${ok}/${prospectos.length} prospectos insertados.`);
  console.log(`🗑️  Para borrarlos: node server/seed-clean.js\n`);
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
