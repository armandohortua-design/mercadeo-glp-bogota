// Importador de inventario de unidades desde el Excel consolidado de listas de precios GLP.
// El archivo trae 11 "proyectos" en su hoja 01_Inventario, pero el catálogo del CRM tiene
// proyectos más granulares (p.ej. "Playa Caracol" en el Excel se reparte en 7 sub-proyectos
// del catálogo: Surfside, Beachwalk, etc.). Este módulo hace ese mapeo antes de guardar.
const XLSX = require('xlsx');

// Proyectos del Excel que mapean 1 a 1 con el nombre del catálogo. IMPORTANTE: el valor
// debe ser EXACTAMENTE el `name` del proyecto en PROJECTS (CRMDashboard.tsx) — un nombre
// que no coincide crea un proyecto "fantasma" invisible en el CRM: la importación reporta
// éxito, pero la tarjeta real del proyecto nunca ve esos datos. Esto pasó con 'Bosco'
// (catálogo: 'Bosco di Santa Maria') y 'Oceana' (mapeaba a 'Ocena' por error de tipeo,
// catálogo real: 'Oceana') — cualquier cambio de precio importado para esos dos proyectos
// se perdía en un bucket fantasma que ninguna tarjeta mostraba. Verificar contra el listado
// de PROJECTS[].name en CRMDashboard.tsx antes de agregar/editar una entrada aquí.
const DIRECT_MAP = {
  'Armonía': 'Armonía',
  'Ventu': 'Ventu',
  'Oceana': 'Oceana',
  'Ipanema': 'Ipanema',
  'Bosco': 'Bosco di Santa Maria',
  'Ocean Reef Park': 'Ocean Reef Park',
};

// "Ocean Reef Islands" en el Excel es un proyecto con 2 torres; cada torre es su propio
// proyecto en el catálogo del CRM.
const OCEAN_REEF_ISLANDS_MAP = {
  'club residences': 'O Club Residences',
  'the palms beach resort': 'The Palms',
};

// "Playa Caracol" en el Excel agrupa 7 sub-proyectos del catálogo por el nombre de la
// torre/subproyecto. Primer patrón que haga match, gana.
const PLAYA_CARACOL_MAP = [
  [/the tides/i, 'The Tides'],
  [/^olas/i, 'Olas del Mar'],
  [/surfside/i, 'Surfside'],
  [/^bw/i, 'Beachwalk'],
  [/brisas/i, 'Brisas del Mar'],
  [/villas/i, 'Aires del Mar'],
];

// Proyectos del Excel que no se comercializan / no van en el catálogo del CRM.
// Lagoon Residences y Promenade: aún no existen en el catálogo.
// Seashore Reserve: dado de baja — ya no se ofrece.
const EXCLUDED_PROJECTS = new Set(['Lagoon Residences', 'Promenade', 'Seashore Reserve']);

function resolveProjectName(excelProyecto, subproyecto) {
  if (EXCLUDED_PROJECTS.has(excelProyecto)) return { name: null, reason: 'excluido' };
  if (DIRECT_MAP[excelProyecto]) return { name: DIRECT_MAP[excelProyecto] };
  if (excelProyecto === 'Ocean Reef Islands') {
    const key = (subproyecto || '').trim().toLowerCase();
    if (OCEAN_REEF_ISLANDS_MAP[key]) return { name: OCEAN_REEF_ISLANDS_MAP[key] };
    return { name: null, reason: `subproyecto sin mapear: "${subproyecto}"` };
  }
  if (excelProyecto === 'Playa Caracol') {
    const match = PLAYA_CARACOL_MAP.find(([re]) => re.test(subproyecto || ''));
    if (match) return { name: match[1] };
    return { name: null, reason: `torre sin mapear: "${subproyecto}"` };
  }
  return { name: null, reason: 'proyecto desconocido' };
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDateOnly(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return null; // fechas tipo texto ("Junio 2026") no se pueden normalizar de forma confiable
}

// Parsea el buffer del Excel y devuelve { unidades, resumen } — resumen trae cuántas filas
// se mapearon por proyecto y cuáles se omitieron (y por qué), para mostrárselo al admin
// antes/después de confirmar la importación.
function parseInventario(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames.find(n => n.includes('Inventario')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  // La hoja trae 2 filas de título antes del encabezado real (fila 3).
  const rows = XLSX.utils.sheet_to_json(ws, { range: 2, defval: null });

  const unidades = [];
  const omitidas = [];
  const porProyecto = {};

  rows.forEach((row, idx) => {
    const excelProyecto = row['Proyecto'];
    if (!excelProyecto) return;
    const subproyecto = row['Subproyecto / Torre'];
    const { name: proyectoApp, reason } = resolveProjectName(excelProyecto, subproyecto);
    if (!proyectoApp) {
      omitidas.push({ fila: idx + 4, proyecto: excelProyecto, subproyecto, razon: reason });
      return;
    }
    porProyecto[proyectoApp] = (porProyecto[proyectoApp] || 0) + 1;
    const estadoRaw = (row['Estado'] || '').toString().trim().toLowerCase();
    const estado = estadoRaw === 'disponible' || estadoRaw === 'no indicado' || !estadoRaw ? 'disponible'
      : estadoRaw === 'vendido' ? 'vendida'
      : estadoRaw === 'reservado' ? 'reservada'
      : estadoRaw === 'bloqueado' ? 'bloqueada'
      : 'disponible';

    unidades.push({
      proyecto: proyectoApp,
      proyecto_excel: excelProyecto,
      subproyecto_torre: subproyecto || null,
      tipo: row['Tipo de activo'] || null,
      subtipo: row['Subtipo'] || null,
      configuracion: row['Configuración'] || null,
      unidad: (row['Unidad'] || '').toString().trim() || `s-${idx}`,
      piso: row['Piso / Nivel'] != null ? row['Piso / Nivel'].toString() : null,
      vista: row['Vista / Ubicación de unidad'] || null,
      modelo: row['Tipo / Modelo'] || null,
      etapa_fase: row['Etapa / Fase'] || null,
      recamaras: toNumber(row['Recámaras']),
      banos: toNumber(row['Baños']),
      area_cerrada: toNumber(row['Área cerrada (m²)']),
      area_abierta: toNumber(row['Área abierta (m²)']),
      area_rooftop: toNumber(row['Área rooftop / extra abierta (m²)']),
      patio: toNumber(row['Patio (m²)']),
      area_lote: toNumber(row['Área lote (m²)']),
      area_total: toNumber(row['Área total (m²)']),
      estacionamientos: toNumber(row['Estacionamientos']),
      precio_base: toNumber(row['Precio base / lista (USD)']),
      adicionales: toNumber(row['Adicionales / mejoras (USD)']),
      precio_final: toNumber(row['Precio final (USD)']),
      mantenimiento_mes: toNumber(row['Mantenimiento mensual (USD)']),
      estado,
      fecha_lista: toDateOnly(row['Fecha de lista']),
      archivo_fuente: row['Archivo fuente'] || null,
    });
  });

  return {
    unidades,
    resumen: {
      totalFilas: rows.filter(r => r['Proyecto']).length,
      importadas: unidades.length,
      omitidas: omitidas.length,
      porProyecto,
      detalleOmitidas: omitidas.slice(0, 50),
    },
  };
}

module.exports = { parseInventario };
