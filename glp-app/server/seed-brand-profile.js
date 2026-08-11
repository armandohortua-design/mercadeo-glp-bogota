/**
 * seed-brand-profile.js — Guarda el perfil de marca GLP en BD
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = require('./db');

const TENANT_ID = 'tenant-glp-001';

const profile = {
  audiencias: [
    'Colombianos 35-55 años con capital disponible ($50K-$500K USD)',
    'Empresarios e independientes que buscan dolarizar patrimonio',
    'Inversionistas con experiencia en finca raíz local buscando diversificar',
    'Profesionales jóvenes 28-38 aspiracionales (primera inversión internacional)',
  ],
  tonos: [
    'Experto y sólido en lo financiero (datos duros, % reales, cifras)',
    'Aspiracional y visual en el gancho (imágenes mentales de vida y libertad)',
    'Directo y sin adornos — confianza sin arrogancia',
    'Sofisticado pero accesible — no corporativo genérico',
  ],
  objetivos: [
    'Construir autoridad y confianza antes de vender',
    'Generar leads directos (DM / link en bio / formulario)',
    'Nutrir prospectos ya en el CRM (top-of-mind)',
    'Rebatir objeciones sin mencionarlas directamente',
  ],
  objeciones: [
    '¿Es seguro llevar plata a otro país? → Panamá dolarizado, banca top-10 mundial, Ley de Exención Predial',
    '¿Cómo lo manejo con la DIAN? → Activos en el exterior son legales y declarables; GLP asesora',
    '¿Y si el proyecto no se entrega? → Solo constructores con historial verificado y fiducia de garantía',
    '¿Puedo usarlo o es solo para arrendar? → Doble beneficio: uso propio + renta garantizada',
  ],
  activos_visuales: [
    'Renders y fotos profesionales de proyectos (Ocean Reef Park, Ventu, Santa María, Playa Caracol)',
    'Video drone de zonas: Punta Pacífica, Costa del Este, Playa Caracol',
    'Fotos del equipo en eventos y reuniones con clientes',
    'Infografías de rentabilidad y comparativas de mercado',
  ],
  diferenciadores: [
    'Exención predial por 20 años en todos los proyectos nuevos',
    'Rentabilidad neta superior al 8% anual en USD',
    'Panamá dolarizado — sin riesgo cambiario',
    'GLP solo trabaja proyectos con fiducia de garantía',
    'Asesoría integral: desde selección hasta declaración en Colombia',
  ],
  hashtags_instagram: [
    '#GLP', '#PanamaRealEstate', '#InversionInmobiliaria', '#DolarizaTuPatrimonio',
    '#PanamáInversión', '#WealthManagement', '#InversionEnDolares', '#GlpWealthManagement',
    '#OceanReefPark', '#VentuPanama', '#PuntaPacifica', '#CostaDelEste',
    '#LibertadFinanciera', '#InvierteEnPanama', '#PatrimonioEnDolares',
  ],
  hashtags_linkedin: [
    '#InversionInmobiliaria', '#WealthManagement', '#PanamaRealEstate', '#GLP',
    '#PatrimonioDolarizado', '#RealEstatePanama', '#InversionInternacional',
    '#FinanzasPersonales', '#Inmobiliaria', '#InversionInteligente',
  ],
  hashtags_whatsapp: [],
  cta_principal: 'Escríbenos PANAMÁ al DM y te enviamos el análisis completo de rentabilidad',
  propuesta_valor: 'GLP Wealth Management conecta a inversionistas colombianos con los mejores proyectos inmobiliarios de Panamá: rentabilidad en dólares, exención predial por 20 años y acompañamiento integral desde la compra hasta la declaración tributaria en Colombia.',
  notas_adicionales: '',
};

async function run() {
  await pool.query(
    `INSERT INTO settings (tenant_id, key, data, updated_at)
     VALUES ($1, 'brand_profile', $2, NOW())
     ON CONFLICT (tenant_id, key) DO UPDATE SET data = $2, updated_at = NOW()`,
    [TENANT_ID, JSON.stringify(profile)]
  );
  console.log('✅ Brand profile guardado correctamente en BD');
  console.log(`   Audiencias: ${profile.audiencias.length}`);
  console.log(`   Diferenciadores: ${profile.diferenciadores.length}`);
  console.log(`   Objeciones: ${profile.objeciones.length}`);
  console.log(`   Hashtags IG: ${profile.hashtags_instagram.length}`);
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
