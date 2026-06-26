import { useState } from "react";

const C = {
  navy:"#0d2a5e", blue:"#1a4fae", light:"#4a90d9",
  gold:"#c9a84c", amber:"#8a6820", green:"#2e7d5e",
  red:"#c03030", cream:"#faf8f3",
};

const fmt=(n,d=0)=>Number(n).toLocaleString("es-CO",{maximumFractionDigits:d});
const usd=n=>"$"+fmt(n);
const pct=n=>Number(n).toFixed(1)+"%";

const TABS=[
  "🏠 Dashboard","📋 Plan de Negocios","📣 Plan de Mercado",
  "📊 Tablero KPI","🤝 Red de Aliados","🎨 Piezas Publicitarias",
  "🧮 Calculadora ROI","🏗️ Portafolio GLP","👥 Prospectos","📅 Presupuesto Eventos",
  "🧑‍💼 Brokers","🤖 Agentes IA"
];

// ── STYLES ───────────────────────────────────────────────
const card=(x={})=>({background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"20px 24px",marginBottom:16,...x});
const sec=(c=C.navy)=>({fontSize:16,fontWeight:500,margin:"20px 0 10px",color:c,borderLeft:`4px solid ${C.gold}`,paddingLeft:12});
const TH={background:C.navy,color:"#fff",padding:"8px 12px",textAlign:"left",fontWeight:500,fontSize:12};
const TD={padding:"8px 12px",borderBottom:"0.5px solid var(--color-border-tertiary)",verticalAlign:"top",fontSize:12};
const mtc={background:"var(--color-background-secondary)",borderRadius:8,padding:"14px 16px",textAlign:"center"};
const tag=(bg,c)=>({display:"inline-block",padding:"3px 10px",borderRadius:12,fontSize:11,fontWeight:600,background:bg,color:c});

// ── DATA ─────────────────────────────────────────────────
const PROYECCIONES=[
  {año:"Año 1 (S2)",sc:[{tx:4,t:165000,c:33000,n:13000},{tx:6,t:180000,c:54000,n:34000},{tx:10,t:200000,c:100000,n:78000}]},
  {año:"Año 2",sc:[{tx:10,t:190000,c:95000,n:65000},{tx:18,t:220000,c:198000,n:163000},{tx:28,t:250000,c:350000,n:305000}]},
  {año:"Año 3",sc:[{tx:16,t:210000,c:168000,n:128000},{tx:30,t:240000,c:360000,n:310000},{tx:50,t:270000,c:675000,n:595000}]},
];

const PIPELINE=[
  {e:"Prospecto Frío",n:42,c:"#4a90d9"},
  {e:"Lead Calificado",n:18,c:C.blue},
  {e:"Reunión Agendada",n:8,c:C.navy},
  {e:"Propuesta Enviada",n:4,c:C.amber},
  {e:"Due Diligence",n:2,c:C.gold},
  {e:"Cierre / Promesa",n:1,c:C.green},
];

const ALIADOS=[
  {tipo:"Firmas de Abogados (Tributario/Patrimonial)",icono:"⚖️",existe:true,
   perfil:"Socios de firmas medianas y grandes con clientes empresariales de alto patrimonio. Ya estructuran el patrimonio de sus clientes — solo les falta el activo internacional.",
   propuesta:"Ser 'Aliado GLP': 0.5% del valor de cierre por referido + invitaciones a GLP Investment Evening + material técnico actualizado para uso con sus clientes. Colombia Tax Law Group los capacita y respalda.",
   guion:"'Cuando estructuras el patrimonio de un cliente, ¿tiene activos en dólares fuera de Colombia? GLP es la respuesta que le faltaba a tu oferta — y yo te pago por presentármelo.'",
   sla:"Reunión de presentación en 7 días · Acuerdo firmado en 15 días",kpi:"Referidos/mes, % conversión referido→cierre"},
  {tipo:"Sociedad Fiduciaria",icono:"🏦",existe:true,
   perfil:"Administra patrimonios HNWI. Sus departamentos de planeación patrimonial y sucesoral son aliados naturales: la Fundación de Interés Privado panameña complementa perfectamente la oferta fiduciaria local.",
   propuesta:"Co-presentación de producto: 'Fideicomiso local + activo dolarizado en Panamá'. La fiduciaria referencia; nosotros cerramos y les damos 0.5% del cierre + visibilidad como aliados GLP.",
   guion:"'Tus clientes fiduciarios tienen todo en COP. Nosotros les ofrecemos el complemento internacional: propiedad en USD, exención predial 20 años y residencia panameña desde $300K. Lo hacemos juntos.'",
   sla:"Presentación al director de planeación patrimonial en 10 días",kpi:"Leads referidos/mes por fiduciaria"},
  {tipo:"Banca de Inversión",icono:"📈",existe:true,
   perfil:"Mesa de dinero y equipo de wealth con clientes UHNW. La propuesta inmobiliaria internacional diversifica el portafolio sin competir con sus productos de renta fija o variable.",
   propuesta:"GLP como activo alternativo dolarizado dentro del portafolio que ya gestionan. 0.5–0.75% por referido. Presentación ante el comité de inversiones con carta oficial de GLP.",
   guion:"'Tus clientes ya tienen renta fija y variable en dólares. Les falta la porción inmobiliaria dolarizada. GLP tiene 40 años de track record — retornos de 7–9% anual en USD.'",
   sla:"Reunión con director de wealth en 15 días",kpi:"AUM referido hacia GLP"},
  {tipo:"Firmas Comisionistas de Bolsa",icono:"📉",existe:true,
   perfil:"Manejan carteras individuales e institucionales. Buscan activos alternativos para diversificar portafolios. Nichos objetivo: clientes con patrimonio >$200K USD en acciones y bonos.",
   propuesta:"GLP como activo real dolarizado fuera del mercado de capitales. Co-evento exclusivo: 'Inversiones alternativas: inmobiliario en Panamá'. Comisión 0.5% por referido.",
   guion:"'¿Cuántos de tus clientes tienen toda su riqueza en el mercado de capitales? Llevarlos a activos reales en Panamá los protege — y tú te llevas el 0.5% del cierre.'",
   sla:"Evento conjunto en Mes 3",kpi:"Clientes referidos/comisionista/trimestre"},
  {tipo:"Corredores de Bolsa (Personas Naturales)",icono:"👤",existe:true,
   perfil:"Redes personales de clientes HNWI. Alta velocidad de respuesta. Canal con menos fricción para primeros cierres. Motivación principal: comisión directa en USD.",
   propuesta:"Comisión 1% por referido que cierre (el más alto del canal). Material personalizado con su nombre como 'asesor autorizado GLP'. Acceso al grupo WhatsApp de aliados.",
   guion:"'Te ofrezco el producto más diferenciado del mercado hoy: inmobiliario en USD en Panamá con GLP. 1% de comisión por cierre. Tu red + mi producto = ganamos los dos. ¿Cuándo nos vemos?'",
   sla:"Firma de acuerdo de referidos en 7 días",kpi:"Referidos/corredor/mes"},
  {tipo:"Contadores y Asesores Tributarios Independientes",icono:"🧾",existe:false,
   perfil:"Asesoran a empresarios de alto patrimonio en declaración de renta. Momento natural para introducir planificación internacional.",
   propuesta:"Sesión técnica gratuita de Colombia Tax Law Group: 'Activos en el exterior y DIAN 2025: cómo asesorar a tus clientes'. A cambio, acceso a leads. Comisión 0.5% por referido.",
   guion:"'Quiero hacerte una sesión técnica sobre activos en Panamá y DIAN — sin costo, Colombia Tax Law Group la da. Tú te llevas el conocimiento y, si hay interés de tus clientes, te pago.'",
   sla:"Sesión técnica agendada en 10 días",kpi:"Sesiones realizadas, leads generados/contador"},
  {tipo:"Family Offices Bogotá",icono:"🏛️",existe:false,
   perfil:"Gestionan patrimonio de familias colombianas de alto nivel. Tickets altos ($500K–$3M). Acceso vía red personal de los tres socios.",
   propuesta:"Reunión privada 1-a-1. Propuesta de co-inversión: varios clientes en una o varias unidades GLP. Estructura FIP panameña para optimización sucesoral.",
   guion:"'Tenemos proyectos GLP con tickets desde $300K hasta $3M en USD. ¿Tu family tiene exposición inmobiliaria internacional? Esta podría ser la pieza que falta en el portafolio.'",
   sla:"Reunión privada en 10 días · Primera propuesta en 15 días",kpi:"Family offices activos, AUM referido"},
  {tipo:"Clústeres Empresariales y Gremios",icono:"🤝",existe:false,
   perfil:"Cámara de Comercio, Andi, Acopi, Acolfa (capítulo Bogotá). Acceso a audiencias masivas de empresarios que buscan diversificación.",
   propuesta:"Ponencia gratuita de María Fernanda Larrazábal + Juan José Giraldo: 'Cómo el empresario colombiano diversifica en dólares en 2026'. Sin comisión. A cambio: acceso a base de datos.",
   guion:"'Quiero hacer una charla de 45 minutos para tus asociados sobre diversificación patrimonial internacional. Cero costo para la agremiación. Traemos los números y el producto.'",
   sla:"Ponencia agendada en Mes 2–3",kpi:"Asistentes/evento, leads calificados generados"},
];

const FASES=[
  {f:"FASE 1",p:"Meses 1–3",t:"Estructuración y Acuerdos",c:C.navy,items:[
    "Firma definitiva contrato representación GLP — exclusividad Bogotá (en curso)",
    "Onboarding María Fernanda Larrazábal como líder comercial ($3,000 USD/mes)",
    "Colombia Tax Law Group: revisión contrato GLP, manual DIAN/Banrep 2025",
    "Abogado panameño aliado: revisión acuerdo y ley local Panamá",
    "Elaborar Guía del Inversionista: flujo de capital, Formulario 160, Res. 204/2025",
    "Formalizar los 5 aliados ya identificados (firmas abogados, fiduciaria, banca inv., comisionistas, corredores)",
    "Viaje de activación a Panamá: socios tripartita + visita proyectos GLP en sitio",
  ],kpi:"Contrato GLP firmado · Líder comercial activa · 5 aliados firmados · Manual cliente listo"},
  {f:"FASE 2",p:"Meses 3–5",t:"Plataforma Comercial",c:C.blue,items:[
    "GLP entrega materiales publicitarios desde Panamá (cubre costos de diseño)",
    "Microsite (glpbogota.com.co): portafolio, calculadora retorno USD, formulario leads",
    "CRM (HubSpot/Pipedrive): etapas, SLA <5 min, tablero diario para María Fernanda",
    "Kit del Aliado: brochure GLP + acuerdo referidos + ficha de comisiones",
    "Sesión técnica Colombia Tax Law Group para aliados: 'DIAN, Banrep y activos en el exterior 2026' (gancho comercial, no técnica pura)",
    "LinkedIn activo: Armando Hortua 2x/semana + María Fernanda 1x/semana",
    "WhatsApp Business: grupos por segmento con plantillas Meta aprobadas",
  ],kpi:"Microsite activo · CRM configurado · Kit aliado listo · Sesión técnica realizada"},
  {f:"FASE 3",p:"Meses 5–9",t:"Lanzamiento y Primeros Cierres",c:C.gold,items:[
    "Evento 'GLP Investment Evening' — 60 invitados, Club El Nogal / Sofitel Bogotá",
    "Email mensual a base de datos consolidada de los tres socios",
    "Ampliar red: 3–5 contadores tributarios independientes + 2–3 family offices nuevos",
    "Gran Salón Inmobiliario Corferias 20–23 Agosto 2026: stand GLP + agenda privada preagendada",
    "Tour de Inversión Panamá Mes 7: 4–8 inversionistas, 3 días, GLP cubre alojamiento",
    "María Fernanda lidera el seguimiento diario del pipeline y reporte semanal a socios",
  ],kpi:"Primer evento 60+ asistentes · 1ra promesa mes 6 · Gran Salón ejecutado · Tour realizado"},
  {f:"FASE 4",p:"Mes 9+",t:"Escalamiento",c:C.green,items:[
    "Eventos trimestrales Bogotá + expansión Medellín (Colombia Tax Law Group) y Cali",
    "Tours de inversión semestrales (mínimo 2/año) con GLP",
    "Vehículo de co-inversión: FIP o fondo privado para tickets $1M+ (varios clientes)",
    "Property management post-compra: administración, Airbnb/Booking, dividendos en USD",
    "Ampliar portafolio con 1–2 desarrolladores panameños adicionales de primer nivel",
    "Programa de referidos formalizado: portal de seguimiento de comisiones por aliado",
  ],kpi:"18+ cierres/año · Red aliados 20+ activos · Vehículo co-inversión estructurado"},
];

// ── AD PIECES ────────────────────────────────────────────
const ADS=[
  {id:"linkedin1",plat:"LinkedIn",formato:"Post / Artículo semanal",
   bg:`linear-gradient(135deg,${C.navy},${C.blue})`,tc:"#fff",
   badge:"Grupo Los Pueblos · Bogotá",badgeBg:"rgba(201,168,76,0.2)",badgeC:C.gold,
   titulo:"Su patrimonio merece un pasaporte.",
   cuerpo:"Mientras el peso colombiano acumula presiones, los activos en USD en Panamá generan rentas de hasta 9% anual con exención predial de 20 años.\n\nNosotros somos la representación oficial de Grupo Los Pueblos en Bogotá. 40 años construyendo Panamá. Todo el respaldo legal y fiscal desde Colombia.",
   cta:"Agendar consulta privada →"},
  {id:"linkedin2",plat:"LinkedIn",formato:"Carrusel 8 slides — Armando Hortua",
   bg:`linear-gradient(135deg,#0a1e45,${C.navy})`,tc:"#fff",
   badge:"Capital Brokers SAS",badgeBg:"rgba(255,255,255,0.08)",badgeC:"rgba(255,255,255,0.7)",
   titulo:"¿Por qué el dinero inteligente está en Panamá?\n(Y el tuyo debería estarlo también)",
   cuerpo:"Slide 1: USD 208M de capital colombiano fluyeron a Panamá en Q3 2025 (Banrep).\nSlide 2: Rentabilidad bruta alquiler: 7.8% anual en USD.\nSlide 3: Exención predial 20 años en proyectos GLP.\nSlide 4: Residencia panameña desde $300K en 30 días.\nSlide 5: Precio prom. Ciudad Panamá: USD 1,804/m².\nSlide 6: GLP: Albrook Mall, Ocean Reef Islands, +60 proyectos.\nSlide 7: Nosotros somos su puerta de entrada desde Bogotá.\nSlide 8: CTA — 'Agenda tu consulta'",
   cta:"Ver todos los datos →"},
  {id:"linkedin_mf",plat:"LinkedIn",formato:"Post personal — María Fernanda Larrazábal",
   bg:`linear-gradient(135deg,#061230,${C.blue})`,tc:"#fff",
   badge:"Líder Comercial GLP Bogotá",badgeBg:"rgba(201,168,76,0.15)",badgeC:C.gold,
   titulo:"Dejé Expocredit para hacer esto.\nY no me arrepiento.",
   cuerpo:"Durante años ayudé a colombianos a financiar sueños en COP. Hoy los ayudo a proteger su patrimonio en dólares — con el respaldo de Grupo Los Pueblos Panamá y el acompañamiento legal de Colombia Tax Law Group.\n\nSi tienes capital y te preguntas cómo diversificarlo fuera de Colombia, hablemos.",
   cta:"Escríbeme →"},
  {id:"instagram",plat:"Instagram",formato:"Feed cuadrado + Story 9:16",
   bg:`linear-gradient(160deg,#061230,${C.navy} 55%,${C.blue})`,tc:"#fff",
   badge:"@glpbogota",badgeBg:"rgba(255,255,255,0.1)",badgeC:"rgba(255,255,255,0.75)",
   titulo:"Bogotá es donde vives.\nPanamá es donde inviertes.",
   cuerpo:"USD · Sin riesgo cambiario · Renta 7–9% anual\nResidencia desde $300K · GLP: 40 años construyendo Panamá\nCapital Brokers · Colombia Tax Law Group · Grupo Valverde",
   cta:"Descubrir proyectos →"},
  {id:"tiktok",plat:"TikTok / Reels",formato:"Video 30 seg — guión completo",
   bg:`linear-gradient(160deg,#050510,${C.navy} 50%,rgba(201,168,76,0.12))`,tc:"#fff",
   badge:"Educación financiera · GLP Bogotá",badgeBg:"rgba(201,168,76,0.12)",badgeC:C.gold,
   titulo:"¿Sabías que Colombia es el mayor\ninversor en finca raíz panameña?",
   cuerpo:"USD 208M de capital colombiano fluyeron a Panamá en solo un trimestre.\nLos que saben ya se movieron.\nNosotros te mostramos cómo hacerlo — con respaldo legal, orden fiscal y acompañamiento completo desde Bogotá.",
   cta:"Comenta 'PANAMÁ' y te enviamos la guía →"},
  {id:"whatsapp",plat:"WhatsApp Business",formato:"Mensaje automático de bienvenida",
   bg:`linear-gradient(135deg,#f0f9f4,#e8f5e9)`,tc:C.navy,
   badge:"Respuesta garantizada < 5 min",badgeBg:"rgba(46,125,94,0.1)",badgeC:C.green,
   titulo:"Hola, soy María Fernanda de GLP Bogotá 👋",
   cuerpo:"Somos la representación oficial de Grupo Los Pueblos Panamá en Colombia.\n\nTe acompañamos en todo el proceso: desde elegir el proyecto hasta estructurar tu inversión con orden legal y fiscal.\n\n¿En qué rango de inversión estás pensando?",
   cta:"Responde con tu disponibilidad"},
  {id:"email",plat:"Email Marketing",formato:"Newsletter mensual — encabezado",
   bg:`linear-gradient(135deg,${C.cream},#f0e8d0)`,tc:C.navy,
   badge:"GLP Bogotá · Solo para aliados y clientes",badgeBg:"rgba(201,168,76,0.12)",badgeC:C.amber,
   titulo:"Mercado GLP Panamá · Abril 2026",
   cuerpo:"Precio prom. USD 1,804/m² (+2.38% interanual) · Rentabilidad bruta alquiler: 7.8% promedio · Construcción Panamá enero 2026: +29.3% vs enero 2025 (INEC) · Zona premium: USD 2,700–4,150/m².\n\nFundamentos sólidos. La ventana sigue abierta.",
   cta:"Ver análisis completo →"},
  {id:"evento",plat:"Evento Presencial",formato:"Invitación digital — diseño GLP Panamá",
   bg:`linear-gradient(160deg,${C.navy},#0a1e45 60%,#061230)`,tc:"#fff",
   badge:"By Capital Brokers · Colombia Tax Law Group · Grupo Valverde",badgeBg:"rgba(201,168,76,0.2)",badgeC:C.gold,
   titulo:"GLP Investment Evening\nBogotá · 2026",
   cuerpo:"Una noche exclusiva para inversionistas de alto patrimonio. Proyectos dolarizados en Panamá, estructura fiscal y migratoria, y la oportunidad de conocer al equipo GLP. Cupos limitados: solo 60 personas.",
   cta:"Reservar mi lugar →"},
];

// ── LEGAL GANCHO (Colombia Tax Law Group) ───────────────
const LEGAL_GANCHOS=[
  {titulo:"'Invierta en Panamá sin sustos con la DIAN'",
   desc:"El gancho comercial más poderoso para el bogotano analítico. Colombia Tax Law Group se encarga de toda la parte normativa — el cliente solo necesita decidir qué proyecto le gusta.",
   puntos:["Declaración de activos en el exterior: nosotros la manejamos con usted","Transferencia internacional: cero fricción, cero sorpresas bancarias","Estructura correcta desde el primer día: evita sanciones futuras","Sin doble tributación: lo que gana en Panamá, lo declara bien aquí"],
   cta:"Consulta de diagnóstico gratuita con Colombia Tax Law Group",
   color:C.blue},
  {titulo:"'Compre bien estructurado desde el inicio'",
   desc:"Mensaje para family offices y clientes de alto patrimonio. La estructura correcta hoy evita problemas sucesorales y tributarios mañana.",
   puntos:["Titularidad: ¿persona natural, sociedad panameña o FIP?","Flujo de capital: cómo enviar los dólares de forma correcta y rápida","Herencia: su inversión en Panamá puede pasar a sus hijos sin fricciones","Residencia: $300K y su familia tiene base legal en Panamá"],
   cta:"Revisión patrimonial 1-a-1 con Colombia Tax Law Group",
   color:C.navy},
  {titulo:"'No improvise con el Banco de la República'",
   desc:"Para el cliente que ya intentó invertir en el exterior y se frenó por el proceso bancario. Este es el argumento que desbloquea esas objeciones.",
   puntos:["Acompañamos el proceso de declaración de cambio paso a paso","Resolución DIAN 204/2025: ya sabemos cómo cumplirla sin estrés","Banco aliado con FX: transferimos sus dólares de forma ágil y legal","SLA de respuesta legal: 24 horas para dudas de documentos"],
   cta:"Primera consulta sin costo — Colombia Tax Law Group",
   color:C.green},
];

// ── GAUGE ────────────────────────────────────────────────
function Gauge({val,meta,inv=false}){
  const p=Math.min(100,Math.round((val/meta)*100));
  const ok=inv?val<=meta:val>=meta;
  const c=ok?C.green:p>=70&&!inv?C.gold:C.red;
  return(
    <div style={{height:6,borderRadius:3,background:"var(--color-border-tertiary)",overflow:"hidden",marginTop:4}}>
      <div style={{height:"100%",borderRadius:3,width:p+"%",background:c,transition:"width .6s"}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// CALCULADORA FINANCIERA GLP v2 — ANÁLISIS INSTITUCIONAL
// ══════════════════════════════════════════════════════════

// ── DATOS DE PROYECTOS (fuente: v3 COMPLETO + datos GLP) ─
const INVESTOR_PROFILES=[
  {id:"renta",label:"💰 Rentas",short:"Flujo de caja máximo",
   desc:"Prioriza el mayor Cap Rate y retorno operativo neto en USD. Proyectos con alta demanda local y baja vacancia.",
   color:"#2e7d5e",bg:"rgba(46,125,94,0.08)",
   projects:["Panama Viejo Residences","Bayside Resort Panamá","Playa Dorada","Ocean Front","Olas del Mar","Aires del Mar – Playa Caracol"]},
  {id:"disfrute",label:"🏖️ Rentas + Disfrute",short:"Segunda residencia con renta",
   desc:"Balance entre renta y uso personal. Segunda residencia en playa con opción de arrendamiento largo plazo en temporada baja.",
   color:"#1a4fae",bg:"rgba(26,79,174,0.08)",
   projects:["The Tides – Playa Caracol","Surfside","BeachWalk Resort Playa Caracol","Ipanema Panamá"]},
  {id:"patrimonial",label:"🛡️ Protección Patrimonial",short:"Plusvalía y preservación de capital",
   desc:"Activos premium con alta plusvalía, exclusividad y demanda de arrendatario ultra estable. Cap Rate más conservador compensado por apreciación.",
   color:"#8a6820",bg:"rgba(138,104,32,0.08)",
   projects:["Ocean Reef Park","Oceana Residences & Skyhomes, Panamá","Bosco di Santa María","The Palms","Ventu"]},
];

const PROJECTS_DB={
  "Panama Viejo Residences":{
    zone:"Ciudad de Panamá — Panamá Viejo / Costa del Este",zoneShort:"Panamá Viejo",
    investorType:"renta",minPrice:120000,areaMin:58,areaMax:90,bedrooms:"2 rec.",parking:"1 puesto",
    construction:"Nueva entrega (2022–2025)",rentSuggest:950,rentM2Min:10,rentM2Max:14,
    priceM2Min:1500,priceM2Max:2200,capRateMin:6.5,capRateMax:8.0,vacancyDef:6,
    velocityGLP:"0.5–1 mes",velocityZone:"1–2 meses",velAdvantage:"Alta positiva",
    condominioMes:200,
    appreciationDef:3.2,appreciationNote:"Panamá Viejo ha mostrado valorización consistente del 3–5% anual impulsada por su proximidad a Costa del Este y el bajo inventario de producto nuevo en este precio.",
    amenities:["Piscina y área social","Gimnasio moderno","Coworking y área de estudio","Seguridad 24/7","Parque infantil","BBQ y terrazas comunes"],
    nearby:["Costa del Este (5–10 min) — hub financiero","Corredor Sur (5 min)","Ruinas de Panamá Viejo (2 min)","Centros comerciales Vía Brasil (15 min)","Hospital Pacifica Salud (15 min)"],
    airport:"Aeropuerto Internacional de Tocumen: 20 min",transport:"Corredor Sur + buses urbanos + Uber",
    schools:"Colegio Isaac Rabin (15 min), Colegio Agustín Moscoso",
    tenant:{type:"Profesional local, familia joven colombiana/panameña",duration:"1–2 años",risk:"Bajo–Medio",mora:"Bajo",notes:"Producto compacto 2BR de mayor absorción en el segmento. Exigir declaración de renta o contrato de trabajo. Historial crediticio."},
    comparables:[
      {name:"Panama Viejo Res. (GLP) ⭐",age:"2022–2025 / Nuevo",area:"58–90",rentMin:10,rentMax:14,vac:"5–8%",vel:"0.5–1 mes"},
      {name:"Pacific Park Residences",age:"2019 / 6 años",area:"60–100",rentMin:9,rentMax:13,vac:"6–9%",vel:"1–1.5 mes"},
      {name:"Torres de San Francisco",age:"2014 / 11 años",area:"70–150",rentMin:10,rentMax:14,vac:"7–10%",vel:"1.5–2.5 mes"},
      {name:"Nuevo Arraijan Towers",age:"2021 / 4 años",area:"65–120",rentMin:7,rentMax:10,vac:"5–8%",vel:"1–2 mes"},
    ],
    risks:"Sobreoferta moderada en producto de 2BR en Costa del Este. Riesgo bajo para este proyecto por precio de entrada muy competitivo.",
    analystNote:"Mejor Cap Rate del portafolio urbano. Inquilino estable, alta velocidad de colocación. Producto ideal para inversionista colombiano de primer ticket.",
  },
  "Bayside Resort Panamá":{
    zone:"Panamá Oeste — Arraiján / Pacífico (20 km del centro)",zoneShort:"Bayside / Arraiján",
    investorType:"renta",minPrice:150000,areaMin:80,areaMax:400,bedrooms:"3 rec. (casas y aptos)",parking:"1–2 puestos",
    construction:"Desarrollo activo (2020–2026)",rentSuggest:800,rentM2Min:8,rentM2Max:12,
    priceM2Min:1200,priceM2Max:2000,capRateMin:6.0,capRateMax:8.5,vacancyDef:8,
    velocityGLP:"1.5–2.5 meses",velocityZone:"2–3 meses",velAdvantage:"Leve positiva",
    condominioMes:250,
    appreciationDef:3.0,appreciationNote:"Zona en desarrollo con infraestructura creciente. Valorización estimada 3–4% anual ligada a expansión de vías y servicios en Arraiján–Pacífico.",
    amenities:["Acceso privado a playa","Club house y beach club","Piscinas familiares y adultos","Canchas deportivas (tenis, fútbol, voley playa)","Parques y senderos","Gimnasio y spa","Supermercado interno","Seguridad perimetral 24/7"],
    nearby:["Centro de Panamá (20 km / ~30 min por Corredor)","Coronado (30 min)","Supermercados Rey, PriceSmart en Arraiján"],
    airport:"Tocumen: 45–55 min | Albrook: 25 min",transport:"Corredor Sur. Vehículo propio recomendado.",
    schools:"Colegios en Arraiján y La Chorrera (15–20 min)",
    tenant:{type:"Familia resort, pareja activa, inversor de renta",duration:"6–24 meses",risk:"Medio",mora:"Medio",notes:"Mayor distancia al centro puede generar rotación. Concepto resort diferencial reduce la competencia. Perfil casero = menor daño al inmueble."},
    comparables:[
      {name:"Bayside Resort (GLP) ⭐",age:"2020–2026 / Activo",area:"80–400",rentMin:8,rentMax:12,vac:"6–10%",vel:"1.5–2.5 mes"},
      {name:"Villa del Rey (Arraiján)",age:"2017 / 8 años",area:"80–160",rentMin:6,rentMax:9,vac:"6–10%",vel:"1.5–2.5 mes"},
      {name:"Residencial El Pacífico",age:"2015 / 10 años",area:"70–140",rentMin:6,rentMax:9,vac:"6–10%",vel:"1.5–3 mes"},
      {name:"Vistas del Mar II",age:"2018 / 7 años",area:"75–150",rentMin:7,rentMax:10,vac:"6–9%",vel:"1.5–2 mes"},
    ],
    risks:"Mayor vacancia por distancia al centro. Concepto diferencial de resort mitiga este riesgo. Precio de entrada muy competitivo.",
    analystNote:"Excelente opción por precio de entrada bajo y concepto diferencial. Estrategia mixta (familiar + inversor) maximiza ocupación.",
  },
  "Playa Dorada":{
    zone:"Playa Dorada, Arraiján — Panamá Oeste (30 min del centro)",zoneShort:"Playa Dorada",
    investorType:"renta",minPrice:180000,areaMin:80,areaMax:160,bedrooms:"2–3 rec.",parking:"1–2 puestos",
    construction:"Multi-fase (2015–2023)",rentSuggest:700,rentM2Min:6,rentM2Max:10,
    priceM2Min:1100,priceM2Max:1800,capRateMin:6.5,capRateMax:8.5,vacancyDef:8,
    velocityGLP:"1.5–2.5 meses",velocityZone:"2.5–4 meses",velAdvantage:"Positiva (+1 mes)",
    condominioMes:180,
    appreciationDef:3.0,appreciationNote:"Zona de playa accesible con demanda predominantemente local. Valorización estable 3–4% anual sostenida por el déficit de producto de playa cerca de la ciudad.",
    amenities:["Club de playa privado","Piscinas y recreación","Parque infantil","Senderos y zonas verdes","Seguridad 24/7","Cancha deportiva"],
    nearby:["Arraiján y La Chorrera (servicios completos)","Corredor Sur / Interamericana","Centro de Panamá (30–40 min)"],
    airport:"Tocumen: 45–55 min | Albrook: 25 min",transport:"Interamericana. Buses y transporte público disponibles.",
    schools:"Colegios en Arraiján y La Chorrera",
    tenant:{type:"Familia local, empleados zona Pacífico, primera inversión internacional",duration:"1–2 años",risk:"Bajo–Medio",mora:"Bajo–Medio",notes:"Mercado local de clase media-alta con ingreso estable. Mayor demanda que oferta en este precio. Depositar 1 mes."},
    comparables:[
      {name:"Playa Dorada (GLP) ⭐",age:"2015–2023 / Multi-fase",area:"80–160",rentMin:6,rentMax:10,vac:"6–10%",vel:"1.5–2.5 mes"},
      {name:"Club de Playa Arraiján",age:"2018 / 7 años",area:"70–140",rentMin:5,rentMax:9,vac:"7–12%",vel:"2–3 mes"},
      {name:"Residencias Costa Pacífica",age:"2016 / 9 años",area:"75–150",rentMin:5,rentMax:9,vac:"8–13%",vel:"2–3 mes"},
      {name:"Playa Veracruz Residences",age:"2019 / 6 años",area:"65–130",rentMin:5,rentMax:8,vac:"7–12%",vel:"2–3 mes"},
    ],
    risks:"Demanda local más sensible a ciclos económicos. Baja dependencia de expatriados reduce riesgo de temporada.",
    analystNote:"El mejor precio de entrada del portafolio. Vacancia baja por precio accesible. Ideal primer ticket Colombia.",
  },
  "Ocean Front":{
    zone:"Playa Dorada, Arraiján — Panamá Oeste",zoneShort:"Ocean Front / Playa Dorada",
    investorType:"renta",minPrice:180000,areaMin:60,areaMax:120,bedrooms:"1–2 rec.",parking:"1 puesto",
    construction:"Moderno (2018–2023)",rentSuggest:750,rentM2Min:6,rentM2Max:10,
    priceM2Min:1100,priceM2Max:1800,capRateMin:6.5,capRateMax:8.5,vacancyDef:8,
    velocityGLP:"1.5–2 meses",velocityZone:"2.5–4 meses",velAdvantage:"Positiva (+1 mes)",
    condominioMes:170,
    appreciationDef:3.0,appreciationNote:"Misma zona que Playa Dorada. El producto de 1BR ofrece el mayor yield por m² del portafolio. Valorización 3–4% anual.",
    amenities:["Acceso directo a playa","Club privado y piscinas","Gimnasio","Seguridad 24/7","Zonas verdes"],
    nearby:["Arraiján (servicios)","La Chorrera (20 min)","Centro de Panamá (30–40 min)"],
    airport:"Tocumen: 45–55 min",transport:"Interamericana. Transporte público.",
    schools:"Colegios en Arraiján",
    tenant:{type:"Primera vivienda, familia local, profesional joven",duration:"1–2 años",risk:"Bajo–Medio",mora:"Bajo–Medio",notes:"1BR tiene mayor rotación pero menor vacancia efectiva. Verificar historial crediticio. Exigir 1 mes depósito."},
    comparables:[
      {name:"Ocean Front (GLP) ⭐",age:"2018–2023 / Moderno",area:"60–120",rentMin:6,rentMax:10,vac:"6–10%",vel:"1.5–2 mes"},
      {name:"Las Brisas de Arraiján",age:"2014 / 11 años",area:"70–130",rentMin:5,rentMax:8,vac:"9–14%",vel:"2.5–4 mes"},
      {name:"Pacífico Oeste Club",age:"2015 / 10 años",area:"80–160",rentMin:5,rentMax:8,vac:"10–15%",vel:"3–4.5 mes"},
    ],
    risks:"Dependencia de demanda local. 1BR ofrece mejor yield por m² del portafolio.",
    analystNote:"Entrada más accesible del portafolio. El 1BR maximiza el Cap Rate neto.",
  },
  "Olas del Mar":{
    zone:"Playa Caracol, Chame — Pacífico Panameño",zoneShort:"Olas del Mar / Playa Caracol",
    investorType:"renta",minPrice:320000,areaMin:95,areaMax:160,bedrooms:"2–3 rec.",parking:"1 puesto",
    construction:"Moderno (2018–2023)",rentSuggest:1050,rentM2Min:8,rentM2Max:11,
    priceM2Min:1500,priceM2Max:2200,capRateMin:6.0,capRateMax:8.0,vacancyDef:11,
    velocityGLP:"2.5–3.5 meses",velocityZone:"3–5 meses",velAdvantage:"Neutral",
    condominioMes:220,
    appreciationDef:3.5,appreciationNote:"Playa Caracol lidera la valorización de segunda residencia en el Pacífico panameño. Proyectos nuevos han mostrado 4–6% de valorización anual. Este es un proyecto de generación anterior con 3.5% estimado.",
    amenities:["Piscina con vista al mar","Zona de BBQ y lounge","Área social y salón de eventos","Seguridad 24/7","Parque infantil"],
    nearby:["Coronado (20 min) — supermercados y servicios","Chame (10 min)","Ciudad de Panamá (70 min)"],
    airport:"Tocumen: 95 min",transport:"Panamericana.",schools:"Colegios en Coronado.",
    tenant:{type:"Familia panameña, pareja, segunda residencia",duration:"6–12 meses",risk:"Medio",mora:"Medio",notes:"Demanda local con variabilidad de ingreso. Exigir depósito 2 meses en contratos >$1,000. Mayor demanda en temporada seca."},
    comparables:[
      {name:"Olas del Mar (GLP) ⭐",age:"2018–2023 / Moderno",area:"80–160",rentMin:8,rentMax:11,vac:"8–14%",vel:"2.5–3.5 mes"},
      {name:"Playa Caracol Club Res.",age:"2016 / 9 años",area:"70–150",rentMin:8,rentMax:12,vac:"10–16%",vel:"3–4 mes"},
      {name:"Coronado Golf Residences",age:"2012 / 13 años",area:"90–200",rentMin:7,rentMax:11,vac:"10–15%",vel:"3–5 mes"},
      {name:"Bijao Beach Club Res.",age:"2010 / 15 años",area:"80–200",rentMin:7,rentMax:12,vac:"12–20%",vel:"4–6 mes"},
    ],
    risks:"Mayor vacancia en temporada de lluvias (mayo–noviembre). Cap Rate compensa la estacionalidad.",
    analystNote:"Mejor Cap Rate en zona playa. Demanda de familias panameñas con segunda residencia.",
  },
  "Aires del Mar – Playa Caracol":{
    zone:"Playa Caracol, Chame — Pacífico Panameño",zoneShort:"Aires del Mar / Playa Caracol",
    investorType:"renta",minPrice:210000,areaMin:70,areaMax:150,bedrooms:"1–2 rec.",parking:"1 puesto",
    construction:"Moderno (2018–2022)",rentSuggest:1000,rentM2Min:8,rentM2Max:12,
    priceM2Min:1600,priceM2Max:2400,capRateMin:5.8,capRateMax:7.8,vacancyDef:11,
    velocityGLP:"2–3.5 meses",velocityZone:"3–5 meses",velAdvantage:"Neutral",
    condominioMes:200,
    appreciationDef:3.5,appreciationNote:"Zona Playa Caracol con valorización de 3.5–5% anual para proyectos en fases más recientes. Producto más antiguo estabiliza la apreciación.",
    amenities:["Vista directa al océano","Piscinas y área social","Parques infantiles","Espacios verdes y jardines","Seguridad 24/7"],
    nearby:["Coronado (20 min)","Ciudad de Panamá (70 min)"],
    airport:"Tocumen: 95 min",transport:"Panamericana.",schools:"Colegios en Coronado (20 min).",
    tenant:{type:"Familia, segunda residencia accesible",duration:"6–12 meses",risk:"Medio",mora:"Medio",notes:"Precio accesible en zona playa genera demanda constante. Contratos más cortos por perfil vacacional."},
    comparables:[
      {name:"Aires del Mar (GLP) ⭐",age:"2018–2022 / Moderno",area:"80–150",rentMin:8,rentMax:12,vac:"8–14%",vel:"2–3.5 mes"},
      {name:"Gorgona Surf Resort",age:"2017 / 8 años",area:"60–140",rentMin:6,rentMax:10,vac:"12–18%",vel:"3–5 mes"},
      {name:"Coronado Golf Residences",age:"2012 / 13 años",area:"90–200",rentMin:7,rentMax:11,vac:"10–15%",vel:"3–5 mes"},
    ],
    risks:"Estacionalidad playa. Producto más antiguo que competencia directa GLP.",
    analystNote:"Buen valor de entrada. Renta más estable en temporada seca (diciembre–abril).",
  },
  "The Tides – Playa Caracol":{
    zone:"Playa Caracol, Chame — Resort Premium",zoneShort:"The Tides / Playa Caracol",
    investorType:"disfrute",minPrice:320000,areaMin:120,areaMax:280,bedrooms:"2–3 rec. (casas y townhouses)",parking:"2 puestos (garaje)",
    construction:"Nueva entrega (2022–2026)",rentSuggest:1500,rentM2Min:10,rentM2Max:16,
    priceM2Min:2200,priceM2Max:3500,capRateMin:5.5,capRateMax:7.5,vacancyDef:10,
    velocityGLP:"2–3 meses",velocityZone:"3–5 meses",velAdvantage:"Positiva (+1.5 mes)",
    condominioMes:350,
    appreciationDef:4.5,appreciationNote:"The Tides es el proyecto de más reciente construcción en Playa Caracol. Los proyectos nuevos en esta zona han mostrado valorización del 4–6% anual, impulsada por la demanda de expatriados y trabajadores remotos que reemplaza el mercado vacacional.",
    amenities:["1.2 km de playa blanca privada","Surf club y escuela de surf","3 piscinas (adultos, familia, infinity)","Restaurante y beach bar con vista al mar","Senderos naturales y ciclismo","Gimnasio y yoga deck","Áreas de BBQ y fogata","Seguridad 24/7"],
    nearby:["Coronado (20 min) — supermercados, servicios, farmacias","El Valle de Antón (40 min)","Chame (10 min)","Ciudad de Panamá (65–75 min)"],
    airport:"Tocumen: 90–100 min | Albrook: 60 min",transport:"Panamericana. Vehículo propio indispensable. Buses interurbanos disponibles.",
    schools:"Colegios privados en Coronado (20 min)",
    tenant:{type:"Familia con segunda residencia, expatriado trabajador remoto",duration:"6–12 meses renovable",risk:"Bajo",mora:"Bajo",notes:"Expat remoto = contrato 6–12 meses renovable. Alta calidad de inquilino. Estrategia mixta largo plazo + corta estadía puede elevar el cap rate bruto al 9–12%."},
    comparables:[
      {name:"The Tides (GLP) ⭐",age:"2022–2026 / Nuevo",area:"120–280",rentMin:10,rentMax:16,vac:"7–12%",vel:"2–3 mes"},
      {name:"Playa Caracol Club Res.",age:"2016 / 9 años",area:"70–150",rentMin:8,rentMax:12,vac:"10–16%",vel:"3–4 mes"},
      {name:"Coronado Golf Residences",age:"2012 / 13 años",area:"90–200",rentMin:7,rentMax:11,vac:"10–15%",vel:"3–5 mes"},
      {name:"Bijao Beach Club Res.",age:"2010 / 15 años",area:"80–200",rentMin:7,rentMax:12,vac:"12–20%",vel:"4–6 mes"},
    ],
    risks:"Vacancia mayor en temporada de lluvias (mayo–noviembre). Indispensable vehículo propio. Estrategia mixta recomendada.",
    analystNote:"Premium de playa. Playa privada 1.2km. Amenidades resort. Modalidad mixta puede elevar cap rate al 9–12%.",
  },
  "Surfside":{
    zone:"Playa Caracol, Chame — Resort + Aparthotel",zoneShort:"Surfside / Playa Caracol",
    investorType:"disfrute",minPrice:190000,areaMin:60,areaMax:200,bedrooms:"1–2 rec.",parking:"1–2 puestos",
    construction:"Moderno (2019–2024)",rentSuggest:1300,rentM2Min:10,rentM2Max:14,
    priceM2Min:2000,priceM2Max:3000,capRateMin:5.8,capRateMax:7.5,vacancyDef:10,
    velocityGLP:"2–3 meses",velocityZone:"3–5 meses",velAdvantage:"Positiva (+1 mes)",
    condominioMes:300,
    appreciationDef:4.0,appreciationNote:"Playa Caracol Premium. El componente aparthotel eleva la valorización al ser un activo mixto (residencial + turístico). Estimado 4–5% anual.",
    amenities:["Playa privada y club de playa","Aparthotel con conserjería","Piscinas y jacuzzi","Restaurante y bar de playa","Surf lounge","Gimnasio","Seguridad 24/7","Parqueaderos cubiertos"],
    nearby:["Coronado (20 min)","Chame (10 min)","Ciudad de Panamá (70 min)"],
    airport:"Tocumen: 95 min",transport:"Panamericana. Vehículo propio.",
    schools:"Colegios en Coronado y La Chorrera.",
    tenant:{type:"Inversor mixto, temporadista, familia segunda residencia",duration:"6–12 meses LP / corta estadía",risk:"Bajo (LP)",mora:"Bajo",notes:"Programa de renta gestionada del proyecto reduce carga al propietario. Inquilino de corta estadía filtrado por administración del aparthotel."},
    comparables:[
      {name:"Surfside (GLP) ⭐",age:"2019–2024 / Reciente",area:"65–200",rentMin:10,rentMax:14,vac:"8–12%",vel:"2–3 mes"},
      {name:"Playa Corona Residences",age:"2015 / 10 años",area:"80–180",rentMin:7,rentMax:11,vac:"10–16%",vel:"3–5 mes"},
      {name:"Gorgona Surf Resort",age:"2017 / 8 años",area:"60–140",rentMin:6,rentMax:10,vac:"12–18%",vel:"3–5 mes"},
    ],
    risks:"Estacionalidad. Componente aparthotel mitiga vacancia efectiva.",
    analystNote:"Componente aparthotel permite renta gestionada con menor carga administrativa para el propietario.",
  },
  "BeachWalk Resort Playa Caracol":{
    zone:"Playa Caracol, Chame — Wellness Resort",zoneShort:"BeachWalk / Playa Caracol",
    investorType:"disfrute",minPrice:230000,areaMin:75,areaMax:180,bedrooms:"2 rec.",parking:"1–2 puestos",
    construction:"Nuevo (2022–2025)",rentSuggest:1300,rentM2Min:9,rentM2Max:14,
    priceM2Min:1800,priceM2Max:2800,capRateMin:5.5,capRateMax:7.5,vacancyDef:10,
    velocityGLP:"2–3 meses",velocityZone:"3–5 meses",velAdvantage:"Positiva (+1 mes)",
    condominioMes:280,
    appreciationDef:4.0,appreciationNote:"Proyecto nuevo en Playa Caracol con enfoque wellness. La demanda de turismo de bienestar impulsa valorización diferencial estimada en 4–5% anual.",
    amenities:["Frente directo al océano Pacífico","Pabellón de masajes y wellness spa","Piscina paisajística","Gimnasio exterior y yoga deck","Áreas de juegos y zonas verdes","BBQ y descanso al aire libre","Acceso controlado"],
    nearby:["Coronado (20 min)","Chame (10 min)","Ciudad de Panamá (70 min)"],
    airport:"Tocumen: 95 min",transport:"Panamericana. Vehículo propio.",
    schools:"Colegios en Coronado.",
    tenant:{type:"Pareja bienestar, retirado internacional",duration:"12–36 meses",risk:"Muy bajo",mora:"Muy bajo",notes:"Retirado internacional = contrato largo y pago puntual. Pensión o ingresos pasivos estables. Programa Pensionado Panamá atrae este perfil."},
    comparables:[
      {name:"BeachWalk Resort (GLP) ⭐",age:"2022–2025 / Nuevo",area:"85–180",rentMin:9,rentMax:14,vac:"8–13%",vel:"2–3 mes"},
      {name:"Playa Caracol Club Res.",age:"2016 / 9 años",area:"70–150",rentMin:8,rentMax:12,vac:"10–16%",vel:"3–4 mes"},
      {name:"Bijao Beach Club Res.",age:"2010 / 15 años",area:"80–200",rentMin:7,rentMax:12,vac:"12–20%",vel:"4–6 mes"},
    ],
    risks:"Estacionalidad. Nicho bienestar reduce volatilidad de demanda.",
    analystNote:"Enfoque wellness diferencia este proyecto. Inquilino retirado = contrato largo. Baja carga de gestión.",
  },
  "Ipanema Panamá":{
    zone:"Costa del Mar / Costa del Este — Ciudad de Panamá",zoneShort:"Ipanema / Costa del Mar",
    investorType:"disfrute",minPrice:280000,areaMin:85,areaMax:250,bedrooms:"1–2 rec. + Penthouses",parking:"1–2 puestos",
    construction:"Moderno (2019–2024)",rentSuggest:1600,rentM2Min:12,rentM2Max:18,
    priceM2Min:2000,priceM2Max:3500,capRateMin:6.0,capRateMax:7.5,vacancyDef:6,
    velocityGLP:"1–2 meses",velocityZone:"1.5–2.5 meses",velAdvantage:"Neutral",
    condominioMes:280,
    appreciationDef:4.0,appreciationNote:"Costa del Este es el hub corporativo y financiero de Panamá. Proyectos recientes en la zona han mostrado valorización de 4–6% anual sostenida por demanda corporativa estructural.",
    amenities:["Piscina con vista al mar","Gimnasio moderno","Salón de eventos y co-working","BBQ y lounge al aire libre","Seguridad 24/7","Área de mascotas y parque infantil"],
    nearby:["Costa del Este (3–5 min) — hub financiero principal","Corredor Sur (inmediato)","Los Pueblos, Vía Brasil (10 min)","Hospital Pacifica Salud (10 min)"],
    airport:"Tocumen: 20–25 min",transport:"Corredor Sur. Uber y taxis.",
    schools:"Colegio Isaac Rabin (10 min), Oxford International (15 min)",
    tenant:{type:"Ejecutivo, inversor, familia con hijos en etapa escolar",duration:"1–2 años",risk:"Bajo–Medio",mora:"Bajo",notes:"Perfil mixto. Costa del Este atrae corporativos. Verificar contrato de trabajo o actividad económica."},
    comparables:[
      {name:"Ipanema Panamá (GLP) ⭐",age:"2019–2024 / Reciente",area:"75–250",rentMin:12,rentMax:18,vac:"5–8%",vel:"1–2 mes"},
      {name:"Quantum Costa del Este",age:"2016 / 9 años",area:"80–200",rentMin:12,rentMax:16,vac:"6–9%",vel:"1.5–2.5 mes"},
      {name:"Riviera Bay Tower",age:"2020 / 5 años",area:"75–200",rentMin:12,rentMax:16,vac:"5–8%",vel:"1.5–2.5 mes"},
      {name:"Metropolitan Park Res.",age:"2012 / 13 años",area:"100–280",rentMin:10,rentMax:14,vac:"8–12%",vel:"2.5–4 mes"},
    ],
    risks:"Sobreoferta en Costa del Este para producto sin amenidades diferenciales. GLP compite con vista al mar y diseño moderno.",
    analystNote:"Balance rendimiento/plusvalía. Demanda corporativa sólida. Costa del Este es el mercado más líquido de Panamá.",
  },
  "Ocean Reef Park":{
    zone:"Islas Artificiales del Pacífico — Punta Pacífica, Ciudad de Panamá",zoneShort:"Ocean Reef / Islas Artificiales",
    investorType:"patrimonial",minPrice:1500000,areaMin:200,areaMax:600,bedrooms:"2–4 rec. + Penthouses",parking:"2–4 puestos + bodega",
    construction:"Activo en desarrollo (2015–en curso)",rentSuggest:7000,rentM2Min:22,rentM2Max:32,
    priceM2Min:4500,priceM2Max:7500,capRateMin:5.0,capRateMax:6.5,vacancyDef:4,
    velocityGLP:"0.5–1 mes",velocityZone:"1–2 meses",velAdvantage:"Alta positiva (+1 mes)",
    condominioMes:700,
    appreciationDef:5.5,appreciationNote:"Ocean Reef Islands es el activo más escaso y premium de Panamá. Las islas artificiales tienen un suministro absolutamente limitado. Valorización histórica documentada de 6–8% anual. Se usa 5.5% como estimado conservador para la proyección.",
    amenities:["Marina privada (180+ muelles, 40–200 pies)","Club náutico y yacht club","Piscinas infinity y jacuzzis con vista al océano","Canchas de tenis, squash, baloncesto, voleibol","Centro de deportes acuáticos","Spa, sauna y wellness center","Gimnasio de alta gama","Helipadres privados","Supermercado y tiendas onsite","Seguridad 24/7 acceso vehicular controlado","Restaurantes y beach club"],
    nearby:["Multiplaza Pacific (5 min) — centro comercial premium","Hospital Nacional, Paitilla, Clínica San Fernando (10 min)","Corredor Sur (acceso directo, 5 min al aeropuerto)","Miraflores, Casco Viejo, Cinta Costera (15 min)"],
    airport:"Tocumen: 30–35 min | Albrook: 20 min",transport:"Corredor Sur con acceso privilegiado. Sin Metro cercano.",
    schools:"International School of Panama (20 min), Balboa Academy (15 min), The British School (25 min)",
    tenant:{type:"Diplomático, HNWI, ejecutivo C-Level",duration:"1–3 años (contrato empresa)",risk:"Muy bajo",mora:"Muy bajo",notes:"Empresa paga directamente. Referencia bancaria obligatoria. Depósito negociable 1–2 meses. Demanda captiva sin comparables directos."},
    comparables:[
      {name:"Ocean Reef Park (GLP) ⭐",age:"2015–en curso / Activo",area:"200–600",rentMin:22,rentMax:32,vac:"3–5%",vel:"0.5–1 mes"},
      {name:"Trump Ocean Club Res.",age:"2011 / 14 años",area:"100–400",rentMin:18,rentMax:28,vac:"5–8%",vel:"1–2 mes"},
      {name:"JW Marriott Residences",age:"2018 / 7 años",area:"120–350",rentMin:20,rentMax:30,vac:"4–6%",vel:"1–2 mes"},
      {name:"Altamira Tower PH",age:"2014 / 11 años",area:"150–280",rentMin:16,rentMax:24,vac:"6–9%",vel:"1.5–2.5 mes"},
      {name:"Destiny — Torres Américas",age:"2010 / 15 años",area:"80–250",rentMin:14,rentMax:20,vac:"6–9%",vel:"1.5–3 mes"},
    ],
    risks:"Cap Rate menor compensado por plusvalía y exclusividad absoluta. Producto sin comparables directos en Latinoamérica.",
    analystNote:"Trophy asset. Diplomáticos y C-Level con contrato pagado por empresa. Demanda captiva. La escasez de producto equivalente garantiza valorización estructural.",
  },
  "Oceana Residences & Skyhomes, Panamá":{
    zone:"Santa María Golf & Country Club — Ciudad de Panamá",zoneShort:"Oceana / Santa María Golf",
    investorType:"patrimonial",minPrice:850000,areaMin:150,areaMax:350,bedrooms:"1–3 rec. + Skyhomes",parking:"1–3 puestos + visitantes",
    construction:"Nuevo (2022–2026 — entrega activa)",rentSuggest:3500,rentM2Min:20,rentM2Max:25,
    priceM2Min:3500,priceM2Max:5500,capRateMin:4.7,capRateMax:6.0,vacancyDef:4,
    velocityGLP:"1–2 meses",velocityZone:"1.5–2.5 meses",velAdvantage:"Moderada (+0.5 mes)",
    condominioMes:550,
    appreciationDef:5.0,appreciationNote:"Santa María Golf & Country Club es la única comunidad masterplan gated con golf de 18 hoyos Jack Nicklaus en Panamá. La escasez de terreno gated premium sostiene valorización de 5–7% anual documentada en fases previas.",
    amenities:["Campo de golf privado 18 hoyos (Jack Nicklaus design)","Club House con restaurantes y bar","Piscinas resort infinity","Pickleball, tenis, padel","Co-working y business lounge","Wellness center y spa","Gimnasio de alta gama","Áreas verdes y parques para mascotas","Seguridad perimetral 24/7 gated","Concierge y administración delegada","Salas de reuniones"],
    nearby:["Multiplaza Pacific (15 min)","City of Knowledge (10 min)","Hospital Punta Pacífica (20 min)","Escuelas internacionales (15–25 min)","Corredor Sur acceso fácil"],
    airport:"Tocumen: 25–30 min",transport:"Corredor Sur. Comunidad gated con transporte interno.",
    schools:"International School of Panama (20 min), Oxford International School (20 min)",
    tenant:{type:"Ejecutivo multinacional, embajador, familia expat con hijos en colegios",duration:"1–3 años",risk:"Muy bajo",mora:"Muy bajo",notes:"Comunidad gated filtra al inquilino. Lista de candidatos preaprobados por administración. Empresa paga directamente."},
    comparables:[
      {name:"Oceana Residences (GLP) ⭐",age:"2022–2026 / Nuevo",area:"80–350",rentMin:20,rentMax:25,vac:"3–5%",vel:"1–2 mes"},
      {name:"Marea — Santa María",age:"2019 / 6 años",area:"100–280",rentMin:17,rentMax:23,vac:"4–7%",vel:"1–2 mes"},
      {name:"Citrea — Santa María",age:"2017 / 8 años",area:"90–240",rentMin:16,rentMax:21,vac:"5–8%",vel:"1.5–2.5 mes"},
      {name:"Soberana — Santa María",age:"2020 / 5 años",area:"85–200",rentMin:15,rentMax:20,vac:"5–7%",vel:"1.5–2 mes"},
    ],
    risks:"Yield neto menor en unidades grandes compensado por plusvalía estructural. Skyhomes y 1BR ofrecen mejores yields.",
    analystNote:"Comunidad gated más exclusiva con golf de Panamá. Wealth preservation primario. Cap Rate conservador compensado por apreciación y calidad de inquilino.",
  },
  "Bosco di Santa María":{
    zone:"Santa María / Costa del Este — Ciudad de Panamá",zoneShort:"Bosco / Santa María",
    investorType:"patrimonial",minPrice:1200000,areaMin:250,areaMax:350,bedrooms:"3–4 rec.",parking:"1–2 puestos",
    construction:"Nuevo (2023–2026)",rentSuggest:2800,rentM2Min:13,rentM2Max:18,
    priceM2Min:2200,priceM2Max:3500,capRateMin:5.5,capRateMax:7.2,vacancyDef:5,
    velocityGLP:"1–2 meses",velocityZone:"2–3 meses",velAdvantage:"Moderada (+1 mes)",
    condominioMes:420,
    appreciationDef:4.5,appreciationNote:"Santa María en consolidación. La propuesta de naturaleza y diseño biofílico atrae demanda ejecutiva y familiar estable. Valorización estimada 4–6% anual.",
    amenities:["Jardines botánicos y áreas verdes paisajísticas","Piscina estilo natural con cascadas","Gimnasio equipado","Senderos de meditación","Áreas de juegos y social","Seguridad 24/7","Lobby de diseño con lounge"],
    nearby:["Costa del Este (5–10 min)","Corredor Sur (10 min)","Centros comerciales Los Pueblos, Vía Brasil (15 min)","Hospital Pacifica Salud (15 min)"],
    airport:"Tocumen: 20–25 min",transport:"Corredor Sur con acceso directo.",
    schools:"Riverside International Academy (15 min), Academia Interamericana (20 min)",
    tenant:{type:"Familia ejecutiva, profesional estable",duration:"1–3 años",risk:"Bajo",mora:"Bajo",notes:"Familias con hijos en edad escolar = contratos largos. Menor rotación. Exigen buenas escuelas cercanas."},
    comparables:[
      {name:"Bosco di Santa María (GLP) ⭐",age:"2023–2026 / Nuevo",area:"250–350",rentMin:13,rentMax:18,vac:"4–7%",vel:"1–2 mes"},
      {name:"Pacific Hills Residences",age:"2018 / 7 años",area:"90–220",rentMin:12,rentMax:17,vac:"5–8%",vel:"1.5–2 mes"},
      {name:"Costa del Este Luxury",age:"2015 / 10 años",area:"85–240",rentMin:11,rentMax:15,vac:"7–10%",vel:"2–3 mes"},
      {name:"Terracare — C. del Este",age:"2019 / 6 años",area:"70–180",rentMin:11,rentMax:15,vac:"6–9%",vel:"2–3 mes"},
    ],
    risks:"Mercado de Santa María en consolidación. Alta demanda ejecutiva/familiar mitiga riesgo.",
    analystNote:"Naturaleza + lujo en Santa María. Perfil familiar ejecutivo con contratos largos (1–3 años). Menor rotación que media del mercado.",
  },
  "The Palms":{
    zone:"Punta Pacífica — Ciudad de Panamá",zoneShort:"The Palms / Punta Pacífica",
    investorType:"patrimonial",minPrice:350000,areaMin:100,areaMax:220,bedrooms:"1–3 rec.",parking:"1–2 puestos",
    construction:"Moderno (2018–2024)",rentSuggest:2200,rentM2Min:16,rentM2Max:22,
    priceM2Min:2800,priceM2Max:4200,capRateMin:5.5,capRateMax:7.0,vacancyDef:5,
    velocityGLP:"1–2 meses",velocityZone:"1.5–3 meses",velAdvantage:"Moderada (+1 mes)",
    condominioMes:380,
    appreciationDef:4.5,appreciationNote:"Punta Pacífica es el barrio premium consolidado de Ciudad de Panamá. El concepto resort urbano de The Palms atrae demanda de nómadas digitales y ejecutivos jóvenes. Valorización histórica de 4–6% anual.",
    amenities:["Piscinas resort con terrazas tropicales","Yoga deck con vista al Pacífico","Coworking moderno y business pods","Gimnasio de última generación","Áreas de BBQ y lounge tropical","Seguridad 24/7","Concierge","Rooftop con vistas al mar y skyline"],
    nearby:["Multiplaza Pacific (5 min caminando)","Hospital Nacional, Paitilla (5–10 min)","Miraflores y Cinta Costera (15 min)","Casco Viejo (20 min)","Vía España y centros bancarios (10 min)"],
    airport:"Tocumen: 30–35 min | Albrook: 18 min",transport:"Corredor Sur inmediato. Metro Línea 1 (Vía España) a 15 min caminando.",
    schools:"International School of Panama (22 min), Balboa Academy (15 min)",
    tenant:{type:"Ejecutivo joven, nómada digital, extranjero",duration:"6–18 meses",risk:"Bajo",mora:"Bajo",notes:"Alta rotación pero baja vacancia. Coworking atrae perfiles tech y digital. Verificar ingresos online o contrato de trabajo."},
    comparables:[
      {name:"The Palms (GLP) ⭐",age:"2018–2024 / Reciente",area:"70–220",rentMin:16,rentMax:22,vac:"4–6%",vel:"1–2 mes"},
      {name:"Ph Panamá",age:"2015 / 10 años",area:"80–200",rentMin:14,rentMax:20,vac:"5–8%",vel:"1.5–2.5 mes"},
      {name:"Skyline Punta Pacífica",age:"2016 / 9 años",area:"70–180",rentMin:13,rentMax:18,vac:"6–9%",vel:"2–3 mes"},
      {name:"Allure at Punta Pacífica",age:"2018 / 7 años",area:"75–190",rentMin:14,rentMax:19,vac:"5–8%",vel:"1.5–2.5 mes"},
      {name:"H2O Tower",age:"2012 / 13 años",area:"65–160",rentMin:11,rentMax:16,vac:"7–10%",vel:"2–3.5 mes"},
    ],
    risks:"Sobreoferta en Punta Pacífica para producto sin diferencial. The Palms compite con el concepto resort único.",
    analystNote:"Excelente balance rendimiento/plusvalía. Fuerte demanda de ejecutivos extranjeros y nómadas digitales. El coworking es el diferenciador clave.",
  },
  "Ventu":{
    zone:"Ciudad de Panamá — Rentas Cortas (Airbnb)",zoneShort:"Ventu / Rentas Cortas",
    investorType:"patrimonial",minPrice:180000,areaMin:65,areaMax:90,bedrooms:"1–2 rec.",parking:"1 puesto",
    construction:"Nuevo (2023–2026)",rentSuggest:0,rentM2Min:0,rentM2Max:0,
    priceM2Min:2500,priceM2Max:3500,capRateMin:8.0,capRateMax:12.0,vacancyDef:20,
    velocityGLP:"N/A (Airbnb)",velocityZone:"N/A",velAdvantage:"N/A",
    condominioMes:250,
    appreciationDef:4.5,appreciationNote:"Ubicación urbana premium Ciudad de Panamá. El modelo Airbnb en Ventu ha mostrado tarifas diarias promedio de $120–$180 USD. Valorización 4–5% anual por ser el único proyecto optimizado para rentas cortas en el portafolio GLP.",
    amenities:["Diseño de vanguardia optimizado para huéspedes Airbnb","Administración hotelera delegada integrada","Amenidades premium de resort","Coworking y business center","Pool deck y áreas sociales","Seguridad 24/7 y acceso digital","Lobby inteligente con check-in automático"],
    nearby:["Ubicación estratégica Ciudad de Panamá","Cinta Costera y Casco Viejo","Multiplaza y centros comerciales cercanos","Hub de transporte Cinta Costera"],
    airport:"Tocumen: 25–30 min",transport:"Uber, taxis, transporte urbano. Excelente conectividad.",
    schools:"N/A (producto de inversión puro)",
    tenant:{type:"Huéspedes Airbnb / Booking.com — turistas y viajeros de negocios",duration:"1–14 noches promedio",risk:"Bajo (plataforma garantiza pago)",mora:"Muy bajo",notes:"Administración hotelera delegada — el propietario no gestiona nada. Plataforma Airbnb garantiza el pago. Fee GLP de property management NO aplica en rentas cortas (modelo diferente)."},
    comparables:[
      {name:"Ventu (GLP) ⭐ — AIRBNB",age:"2023–2026 / Nuevo",area:"65–90",rentMin:0,rentMax:0,vac:"20%",vel:"N/A"},
    ],
    risks:"Estacionalidad turística. Plataformas digitales (Airbnb) concentran la distribución. Regulación turística panameña puede evolucionar.",
    analystNote:"Único proyecto del portafolio GLP optimizado para Airbnb. Administración delegada reduce carga operativa al propietario. Usar calculadora de Rentas Cortas para análisis específico.",
  },
};

// ── CÁLCULO HIPOTECA (Amortización Francesa) ─────────────
function calcMortgage(principal,rateAnual,years){
  if(principal<=0||rateAnual<=0||years<=0) return 0;
  const r=rateAnual/100/12;
  const n=years*12;
  return principal*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
}

// ── PROYECCIÓN ANUAL ──────────────────────────────────────
function calcProjection(params,horizonte){
  const {valorActivo,rentaMensual,vacancia,feeGLP,adminPct,opexPct,seguro,condominio,tasaHip,plazo,cuotaInicial,apreciacion}=params;
  const montoFinanciado=valorActivo*(1-cuotaInicial/100);
  const cuotaMes=calcMortgage(montoFinanciado,tasaHip,plazo);
  const rows=[];
  let deudaRemanente=montoFinanciado;
  let rentaAcum=0,gastosAcum=0,deudaPagadaAcum=0;

  for(let y=1;y<=horizonte;y++){
    const valorActivoY=valorActivo*Math.pow(1+apreciacion/100,y);
    const rentaBruta=rentaMensual*12*(1-vacancia/100);
    const gastosFee=feeGLP*12;
    const gastosAdmin=rentaBruta*(adminPct/100);
    const gastosOpex=valorActivo*(opexPct/100);
    const gastosSeguro=seguro;
    const gastosCondominio=condominio*12;
    const totalGastos=gastosFee+gastosAdmin+gastosOpex+gastosSeguro+gastosCondominio;
    const noi=rentaBruta-totalGastos;
    const cuotaAnual=cuotaMes*12;

    // Amortización simplificada
    const intAnual=deudaRemanente*(tasaHip/100);
    const amortAnual=Math.max(0,cuotaAnual-intAnual);
    deudaRemanente=Math.max(0,deudaRemanente-amortAnual);

    const flujoBruto=noi-cuotaAnual;
    const patrimonioNeto=valorActivoY-deudaRemanente;
    rentaAcum+=noi;
    gastosAcum+=totalGastos;
    deudaPagadaAcum+=amortAnual;

    rows.push({y,valorActivoY,rentaBruta,totalGastos,noi,cuotaAnual,flujoBruto,deudaRemanente,patrimonioNeto});
  }
  return rows;
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────
function CalcROI(){
  const [perfil,setPerfil]=useState(null);
  const [proySel,setProySel]=useState(null);
  const [tab2,setTab2]=useState("financiero"); // financiero | mercado | drivers

  // params financieros
  const [valorActivo,setValorActivo]=useState(300000);
  const [ciPct,setCiPct]=useState(50);
  const [tasaHip,setTasaHip]=useState(8.5);
  const [plazo,setPlazo]=useState(20);
  const [rentaMes,setRentaMes]=useState(1500);
  const [vacancia,setVacancia]=useState(8);
  const [feeGLP,setFeeGLP]=useState(150);
  const [adminPct,setAdminPct]=useState(10);
  const [opexPct,setOpexPct]=useState(1.0);
  const [seguro,setSeguro]=useState(1200);
  const [condominio,setCondominio]=useState(300);
  const [apreciacion,setApreciacion]=useState(3.5);
  const [horizonte,setHorizonte]=useState(10);

  const proj=proySel?PROJECTS_DB[proySel]:null;
  const isVentu=proySel==="Ventu";

  // Cuando cambia proyecto → actualiza defaults
  const selectProyecto=(name)=>{
    setProySel(name);
    const p=PROJECTS_DB[name];
    if(!p) return;
    setValorActivo(p.minPrice);
    setRentaMes(p.rentSuggest||1500);
    setVacancia(p.vacancyDef||8);
    setCondominio(p.condominioMes||300);
    setApreciacion(p.appreciationDef||3.5);
    setFeeGLP(name==="Ventu"?0:150);
    setTab2("financiero");
  };

  // Cálculos derivados
  const montoFinanciado=valorActivo*(1-ciPct/100);
  const cuotaMes=calcMortgage(montoFinanciado,tasaHip,plazo);
  const rentaBruta=rentaMes*12*(1-vacancia/100);
  const gastosFeeAnual=(isVentu?0:feeGLP)*12;
  const gastosAdminAnual=rentaBruta*(adminPct/100);
  const gastosOpexAnual=valorActivo*(opexPct/100);
  const gastosSeguroAnual=seguro;
  const gastosCondAnual=condominio*12;
  const totalGastosAnual=gastosFeeAnual+gastosAdminAnual+gastosOpexAnual+gastosSeguroAnual+gastosCondAnual;
  const noi=rentaBruta-totalGastosAnual;
  const capRateNeto=(noi/valorActivo)*100;
  const capRateBruto=(rentaBruta/valorActivo)*100;
  const cashOnCash=((noi-cuotaMes*12)/(valorActivo*(ciPct/100)))*100;
  const flujoLibreMes=(noi-cuotaMes*12)/12;
  const proyeccion=calcProjection({valorActivo,rentaMensual:rentaMes,vacancia,feeGLP:isVentu?0:feeGLP,adminPct,opexPct,seguro,condominio,tasaHip,plazo,cuotaInicial:ciPct,apreciacion},horizonte);
  const ultimoAnio=proyeccion[proyeccion.length-1]||{};

  // ── Inputs parametrizables ──
  const inp=(val,set,opts={})=>(
    <input type="number" value={val===0?"":val}
      onChange={e=>{const v=e.target.value;set(v===""?0:Number(v));}}
      style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:13,fontWeight:600,color:C.navy,background:"var(--color-background-secondary)",...opts.style}}
      {...opts}/>
  );

  const metricCard=(label,value,color=C.navy,sub=null)=>(
    <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"12px 14px",border:`1px solid var(--color-border-tertiary)`}}>
      <div style={{fontSize:20,fontWeight:700,color}}>{value}</div>
      <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2,lineHeight:1.3}}>{label}</div>
      {sub&&<div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>{sub}</div>}
    </div>
  );

  const row=(label,value,bold=false,color=null)=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:12}}>
      <span style={{color:"var(--color-text-secondary)"}}>{label}</span>
      <span style={{fontWeight:bold?700:500,color:color||C.navy}}>{value}</span>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────
  return(
    <div>

      {/* ── PASO 1: PERFIL DE INVERSIONISTA ── */}
      <div style={{marginBottom:20}}>
        <div style={sec(C.navy)}>Paso 1 — Selecciona tu perfil de inversionista</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {INVESTOR_PROFILES.map(p=>(
            <div key={p.id} onClick={()=>{setPerfil(p.id);setProySel(null);}}
              style={{borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"all .2s",
                border:`2px solid ${perfil===p.id?p.color:"var(--color-border-tertiary)"}`,
                background:perfil===p.id?p.bg:"var(--color-background-secondary)"}}>
              <div style={{fontSize:18,marginBottom:4}}>{p.label.split(" ")[0]}</div>
              <div style={{fontWeight:700,fontSize:13,color:p.color,marginBottom:4}}>{p.label.slice(3)}</div>
              <div style={{fontSize:11,fontWeight:600,color:p.color,marginBottom:6}}>{p.short}</div>
              <div style={{fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.4}}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PASO 2: SELECTOR DE PROYECTO ── */}
      {perfil&&(
        <div style={{marginBottom:20}}>
          <div style={sec(C.navy)}>Paso 2 — Selecciona el proyecto a analizar</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
            {(INVESTOR_PROFILES.find(x=>x.id===perfil)?.projects||[]).map(pn=>{
              const pd=PROJECTS_DB[pn];if(!pd) return null;
              const sel=proySel===pn;
              return(
                <div key={pn} onClick={()=>selectProyecto(pn)}
                  style={{borderRadius:8,padding:"12px 14px",cursor:"pointer",
                    border:`2px solid ${sel?INVESTOR_PROFILES.find(x=>x.id===perfil).color:"var(--color-border-tertiary)"}`,
                    background:sel?"rgba(26,79,174,0.06)":"var(--color-background-secondary)"}}>
                  <div style={{fontWeight:700,fontSize:12,color:C.navy,marginBottom:4}}>{pn}</div>
                  <div style={{fontSize:10,color:"var(--color-text-secondary)",marginBottom:6,lineHeight:1.3}}>{pd.zoneShort}</div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                    <span style={{color:C.green,fontWeight:600}}>Desde {usd(pd.minPrice)}</span>
                    <span style={{color:C.gold,fontWeight:600}}>{pd.capRateMin}–{pd.capRateMax}%</span>
                  </div>
                  <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:4}}>
                    {pd.areaMin}–{pd.areaMax} m² · {pd.bedrooms}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ANÁLISIS COMPLETO ── */}
      {proySel&&proj&&(
        <>
          {/* Header del proyecto */}
          <div style={{background:`linear-gradient(135deg,${C.navy},${C.blue})`,borderRadius:10,padding:"16px 20px",marginBottom:16,color:"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:18,fontWeight:700,marginBottom:2}}>{proySel}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.75)"}}>{proj.zone}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:2}}>{proj.construction} · {proj.bedrooms} · {proj.areaMin}–{proj.areaMax} m²</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>CAP RATE MERCADO</div>
                <div style={{fontSize:22,fontWeight:700,color:C.gold}}>{proj.capRateMin}–{proj.capRateMax}%</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>VEL. COLOCACIÓN: {proj.velocityGLP}</div>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{display:"flex",gap:6,marginBottom:16}}>
            {[["financiero","📊 Análisis Financiero"],["mercado","🏙️ Comparables"],["drivers","🎯 Drivers de Decisión"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>setTab2(id)} style={{padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,
                background:tab2===id?C.navy:"transparent",color:tab2===id?"#fff":C.navy,border:`1px solid ${C.navy}`}}>
                {lbl}
              </button>
            ))}
          </div>

          {/* ── TAB: ANÁLISIS FINANCIERO ── */}
          {tab2==="financiero"&&(
            <div>
              {/* Sección A: Datos del Activo */}
              <div style={sec(C.navy)}>A — Datos del Activo y Financiación</div>
              <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"16px",marginBottom:12}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
                  <div>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>💰 Valor del Activo (USD)</label>
                    {inp(valorActivo,setValorActivo,{min:100000,step:5000})}
                    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Mercado: Desde {usd(proj.minPrice)}</div>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>📥 Cuota Inicial (%)</label>
                    {inp(ciPct,setCiPct,{min:30,max:100,step:5})}
                    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>= {usd(Math.round(valorActivo*ciPct/100))} USD · Banco: 50–70%</div>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>🏦 Monto Financiado (USD)</label>
                    <div style={{padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:13,fontWeight:700,color:C.blue,background:"var(--color-background-primary)"}}>{usd(Math.round(montoFinanciado))}</div>
                    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Banco panameño en USD</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                  <div>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>📈 Tasa Hipotecaria (%)</label>
                    {inp(tasaHip,setTasaHip,{min:5,max:15,step:0.25})}
                    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Default 8.5% (banco Panamá)</div>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>📅 Plazo (años)</label>
                    {inp(plazo,setPlazo,{min:5,max:30,step:5})}
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>💳 Cuota Mensual (USD)</label>
                    <div style={{padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:13,fontWeight:700,color:C.red,background:"var(--color-background-primary)"}}>{usd(Math.round(cuotaMes))}</div>
                    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Amortización francesa</div>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>🌱 Valorización anual (%)</label>
                    {inp(apreciacion,setApreciacion,{min:0,max:15,step:0.5})}
                    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Inflación Panamá ~3%</div>
                  </div>
                </div>
                <div style={{marginTop:10,padding:"10px 12px",borderRadius:8,background:"rgba(138,104,32,0.07)",border:"0.5px solid rgba(138,104,32,0.25)",fontSize:11,lineHeight:1.5}}>
                  <strong style={{color:C.amber}}>📌 Nota valorización: </strong>
                  <span style={{color:"var(--color-text-secondary)"}}>{proj.appreciationNote}</span>
                </div>
              </div>

              {/* Sección B: Ingresos */}
              <div style={sec(C.navy)}>B — Ingresos por Renta {isVentu?"(Rentas Cortas — usar calculadora específica)":"(Largo Plazo)"}</div>
              {isVentu?(
                <div style={{background:"rgba(26,79,174,0.06)",borderRadius:8,padding:"14px 16px",marginBottom:12,fontSize:12,color:C.blue,border:"1px solid rgba(26,79,174,0.2)"}}>
                  ⚠️ Ventu es el proyecto de Rentas Cortas (Airbnb). El análisis de ingresos específico utiliza tarifas diarias ($120–$180 USD/noche), tasa de ocupación y revenue por canal. Por favor usar la <strong>Calculadora de Rentas Cortas</strong> para este proyecto. El análisis patrimonial (valorización) aplica normalmente.
                </div>
              ):(
                <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"16px",marginBottom:12}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                    <div>
                      <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>🏠 Renta Mensual (USD/mes)</label>
                      {inp(rentaMes,setRentaMes,{min:0,step:50})}
                      <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Mercado: ${proj.rentM2Min}–${proj.rentM2Max}/m²/mes</div>
                    </div>
                    <div>
                      <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>📭 Vacancia anual (%)</label>
                      {inp(vacancia,setVacancia,{min:0,max:30,step:1})}
                      <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Mercado: {proj.vacancyDef}% (zona {proj.zoneShort})</div>
                    </div>
                    <div>
                      <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>✅ Renta Efectiva Anual (USD)</label>
                      <div style={{padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:13,fontWeight:700,color:C.green,background:"var(--color-background-primary)"}}>{usd(Math.round(rentaBruta))}</div>
                      <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Renta mensual × 12 × (1 − vacancia)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sección C: Gastos */}
              {!isVentu&&(
                <>
                  <div style={sec(C.navy)}>C — Gastos Operativos Anuales</div>
                  <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"16px",marginBottom:12}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
                      <div>
                        <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>🏢 Fee GLP Property Mgmt (USD/mes)</label>
                        {inp(feeGLP,setFeeGLP,{min:0,max:500,step:25})}
                        <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Default $150/mes · Total año: {usd(feeGLP*12)}</div>
                      </div>
                      <div>
                        <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>👔 Administración (% renta efectiva)</label>
                        {inp(adminPct,setAdminPct,{min:0,max:20,step:0.5})}
                        <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Total año: {usd(Math.round(gastosAdminAnual))}</div>
                      </div>
                      <div>
                        <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>🔧 Opex / Mantenimiento (% valor activo)</label>
                        {inp(opexPct,setOpexPct,{min:0,max:5,step:0.25})}
                        <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Total año: {usd(Math.round(gastosOpexAnual))}</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                      <div>
                        <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>🛡️ Seguro Anual (USD)</label>
                        {inp(seguro,setSeguro,{min:0,step:100})}
                      </div>
                      <div>
                        <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>🏗️ Cuota Condominio (USD/mes)</label>
                        {inp(condominio,setCondominio,{min:0,step:25})}
                        <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Total año: {usd(condominio*12)}</div>
                      </div>
                      <div>
                        <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>🏛️ Predial / Impuesto inmueble</label>
                        <div style={{padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:13,fontWeight:700,color:C.green,background:"var(--color-background-primary)"}}>$0 — Exonerado</div>
                        <div style={{fontSize:10,color:C.green,marginTop:2}}>Exoneración 20 años (proyectos nuevos GLP)</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Sección D: Resultados */}
              {!isVentu&&(
                <>
                  <div style={sec(C.navy)}>D — Resultados Financieros</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                    {metricCard("NOI NETO ANUAL",usd(Math.round(noi)),noi>0?C.green:C.red)}
                    {metricCard("CAP RATE NETO",pct(capRateNeto),capRateNeto>=6?C.green:capRateNeto>=4.5?C.gold:C.red,"Sobre valor activo")}
                    {metricCard("CAP RATE BRUTO",pct(capRateBruto),C.navy,"Renta bruta / activo")}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                    {metricCard("CASH-ON-CASH",pct(cashOnCash),cashOnCash>=0?C.green:C.red,"NOI neto / capital propio")}
                    {metricCard("FLUJO LIBRE MENSUAL",usd(Math.round(flujoLibreMes)),flujoLibreMes>=0?C.green:C.red,"NOI mensual − cuota hipoteca")}
                    {metricCard("TOTAL GASTOS ANUALES",usd(Math.round(totalGastosAnual)),C.red)}
                  </div>

                  <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"16px",marginBottom:12}}>
                    {row("Renta mensual bruta",usd(rentaMes))}
                    {row("Renta efectiva anual (neta vacancia)",usd(Math.round(rentaBruta)))}
                    {row("Fee GLP Property Management",usd(feeGLP*12))}
                    {row("Administración delegada",usd(Math.round(gastosAdminAnual)))}
                    {row("Opex / Mantenimiento",usd(Math.round(gastosOpexAnual)))}
                    {row("Seguro anual",usd(seguro))}
                    {row("Cuota condominio anual",usd(condominio*12))}
                    {row("Predial / Impuesto inmueble","$0 (exonerado 20 años)",false,C.green)}
                    {row("TOTAL GASTOS OPERATIVOS",usd(Math.round(totalGastosAnual)),true,C.red)}
                    {row("NOI NETO ANUAL",usd(Math.round(noi)),true,noi>0?C.green:C.red)}
                    {row("Cuota hipoteca mensual",usd(Math.round(cuotaMes)))}
                    {row("FLUJO LIBRE MENSUAL (NOI − Hipoteca)",usd(Math.round(flujoLibreMes)),true,flujoLibreMes>=0?C.green:C.red)}
                  </div>
                </>
              )}

              {/* Sección E: Proyección */}
              {!isVentu&&(
                <>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <div style={sec(C.navy)}>E — Proyección a {horizonte} Años</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Horizonte:</span>
                      {[5,10,15,20].map(h=>(
                        <button key={h} onClick={()=>setHorizonte(h)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,
                          background:horizonte===h?C.navy:"transparent",color:horizonte===h?"#fff":C.navy,border:`1px solid ${C.navy}`}}>
                          {h}a
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                    {metricCard(`PATRIMONIO NETO AÑO ${horizonte}`,usd(Math.round(ultimoAnio.patrimonioNeto||0)),C.navy,"Valor activo − deuda remanente")}
                    {metricCard(`VALOR ACTIVO AÑO ${horizonte}`,usd(Math.round(ultimoAnio.valorActivoY||0)),C.blue,`Con apreciación ${apreciacion}%/año`)}
                    {metricCard(`ROI ACUMULADO`,pct(((ultimoAnio.patrimonioNeto||0)-(valorActivo*(ciPct/100)))/(valorActivo*(ciPct/100))*100),C.green,"Sobre capital propio invertido")}
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead>
                        <tr>
                          {["Año","Valor Activo (USD)","Renta Efectiva","Gastos Op.","NOI Neto","Cuota Hip.","Flujo Libre","Deuda Remanente","Patrimonio Neto"].map(h=>(
                            <th key={h} style={{...TH,fontSize:10}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {proyeccion.map((r,i)=>(
                          <tr key={i} style={{background:i%2===0?"var(--color-background-secondary)":"var(--color-background-primary)"}}>
                            <td style={{...TD,fontWeight:700,color:C.navy}}>{r.y}</td>
                            <td style={{...TD,color:C.blue}}>{usd(Math.round(r.valorActivoY))}</td>
                            <td style={{...TD,color:C.green}}>{usd(Math.round(r.rentaBruta))}</td>
                            <td style={{...TD,color:C.red}}>{usd(Math.round(r.totalGastos))}</td>
                            <td style={{...TD,fontWeight:600,color:r.noi>=0?C.green:C.red}}>{usd(Math.round(r.noi))}</td>
                            <td style={{...TD,color:C.red}}>{usd(Math.round(r.cuotaAnual))}</td>
                            <td style={{...TD,fontWeight:600,color:r.flujoBruto>=0?C.green:C.red}}>{usd(Math.round(r.flujoBruto))}</td>
                            <td style={{...TD,color:"var(--color-text-secondary)"}}>{usd(Math.round(r.deudaRemanente))}</td>
                            <td style={{...TD,fontWeight:700,color:C.navy}}>{usd(Math.round(r.patrimonioNeto))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{marginTop:10,padding:"10px 12px",borderRadius:8,background:"rgba(46,125,94,0.06)",border:"0.5px solid rgba(46,125,94,0.2)",fontSize:11,lineHeight:1.5}}>
                    <strong style={{color:C.green}}>📌 Ventaja fiscal Panamá:</strong>{" "}
                    <span style={{color:"var(--color-text-secondary)"}}>Predial $0 por 20 años en proyectos nuevos GLP. Ganancia de capital: 2% en Panamá (vs. hasta 15% en Colombia). Dolarización: cero riesgo cambiario. Los valores de proyección son indicativos y no garantizan resultados.</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB: COMPARABLES DE MERCADO ── */}
          {tab2==="mercado"&&(
            <div>
              <div style={sec(C.navy)}>Análisis de Competencia — Zona: {proj.zoneShort}</div>
              <div style={{background:"rgba(26,79,174,0.05)",borderRadius:8,padding:"12px 14px",marginBottom:14,fontSize:12,lineHeight:1.6}}>
                Los comparables a continuación son los proyectos del mercado con los que {proySel} compite directamente en la misma zona geográfica. El análisis de la velocidad de colocación y la diferencia de renta/m² por antigüedad son los indicadores más relevantes para validar el posicionamiento del activo.
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr>
                      {["Proyecto / Comparable","Estado / Antigüedad","Área (m²)","Renta/m²/mes (USD)","Vacancia","Vel. Colocación"].map(h=>(
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proj.comparables.map((c,i)=>{
                      const isGLP=c.name.includes("⭐");
                      return(
                        <tr key={i} style={{background:isGLP?"rgba(201,168,76,0.1)":"var(--color-background-"+(i%2===0?"secondary":"primary")+")"}}> 
                          <td style={{...TD,fontWeight:isGLP?700:400,color:isGLP?C.amber:C.navy}}>{c.name}</td>
                          <td style={TD}>{c.age}</td>
                          <td style={TD}>{c.area} m²</td>
                          <td style={{...TD,color:isGLP?C.green:C.navy,fontWeight:isGLP?600:400}}>
                            {c.rentMin>0?`$${c.rentMin}–$${c.rentMax}`:c.vac}
                          </td>
                          <td style={TD}>{c.vac}</td>
                          <td style={TD}>{c.vel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{marginTop:16}}>
                <div style={sec(C.navy)}>Prima de Nueva Construcción — Efecto en Renta y Cap Rate</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr>{["Antigüedad","Renta/m² vs. Nuevo","Vacancia Adicional","Vel. Colocación","Implicación"].map(h=><th key={h} style={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {[
                      ["0–5 años (Nuevo)","100% — Referencia","0–2% adicional","1–2 meses","Prima máxima. Menor CAPEX. Inquilino premium."],
                      ["6–10 años (Moderno)","-8% a -15%","+2–4% adicional","1.5–3 meses","Leve descuento. Puede requerir actualización ($15K–$30K)."],
                      ["11–15 años (Usado)","-15% a -25%","+4–8% adicional","2–4 meses","Descuento notable. CAPEX de renovación: $25K–$60K."],
                      ["16–20 años (Envejecido)","-25% a -35%","+8–15% adicional","3–6 meses","Solo compite por precio. Renovación integral necesaria."],
                      ["+20 años (Clásico)","-35% a -50%","+15–25% adicional","4–8 meses","Compite por ubicación. Candidato a conversión de uso."],
                    ].map((r,i)=>(
                      <tr key={i} style={{background:i===0?"rgba(46,125,94,0.07)":i%2===0?"var(--color-background-secondary)":"var(--color-background-primary)"}}>
                        {r.map((c,j)=><td key={j} style={{...TD,fontWeight:i===0&&j===0?700:400,color:i===0?C.green:C.navy}}>{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:12,padding:"10px 12px",borderRadius:8,background:"rgba(138,104,32,0.07)",border:"0.5px solid rgba(138,104,32,0.25)",fontSize:11,lineHeight:1.5}}>
                <strong style={{color:C.amber}}>⚠️ Variables de Riesgo — {proj.zoneShort}: </strong>
                <span style={{color:"var(--color-text-secondary)"}}>{proj.risks}</span>
              </div>
            </div>
          )}

          {/* ── TAB: DRIVERS DE DECISIÓN ── */}
          {tab2==="drivers"&&(
            <div>
              <div style={sec(C.navy)}>Drivers de Decisión de Inversión — {proySel}</div>

              {/* Amenidades */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:600,color:C.navy,marginBottom:8,borderLeft:`3px solid ${C.gold}`,paddingLeft:10}}>🏊 Amenidades y Características del Proyecto</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:6}}>
                  {proj.amenities.map((a,i)=>(
                    <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"6px 10px",borderRadius:6,background:"var(--color-background-secondary)"}}>
                      <span style={{color:C.green,fontWeight:700,flexShrink:0}}>✓</span>
                      <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conectividad */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:600,color:C.navy,marginBottom:8,borderLeft:`3px solid ${C.gold}`,paddingLeft:10}}>📍 Conectividad y Zonas Cercanas</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:6}}>✈️ AEROPUERTO</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{proj.airport}</div>
                  </div>
                  <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:6}}>🚗 TRANSPORTE</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{proj.transport}</div>
                  </div>
                  <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:6}}>🎓 COLEGIOS / UNIVERSIDADES</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{proj.schools}</div>
                  </div>
                  <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:6}}>🛒 CENTROS COMERCIALES Y SERVICIOS</div>
                    <div style={{fontSize:12}}>{proj.nearby.map((n,i)=><div key={i} style={{color:"var(--color-text-secondary)",marginBottom:3}}>• {n}</div>)}</div>
                  </div>
                </div>
              </div>

              {/* Perfil del arrendatario */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:600,color:C.navy,marginBottom:8,borderLeft:`3px solid ${C.gold}`,paddingLeft:10}}>👤 Perfil del Arrendatario Típico</div>
                <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"14px 16px"}}>
                  {[
                    ["Perfil típico",proj.tenant.type],
                    ["Duración contrato",proj.tenant.duration],
                    ["Riesgo de mora",proj.tenant.mora],
                    ["Riesgo general",proj.tenant.risk],
                  ].map(([k,v])=>row(k,v))}
                  <div style={{marginTop:10,padding:"10px 12px",borderRadius:8,background:"rgba(26,79,174,0.06)",fontSize:11,lineHeight:1.5}}>
                    <strong style={{color:C.blue}}>🗒️ Nota del agente: </strong>
                    <span style={{color:"var(--color-text-secondary)"}}>{proj.tenant.notes}</span>
                  </div>
                </div>
              </div>

              {/* Velocidad de colocación */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:600,color:C.navy,marginBottom:8,borderLeft:`3px solid ${C.gold}`,paddingLeft:10}}>⚡ Velocidad de Colocación</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                  {[
                    ["GLP — "+proySel,proj.velocityGLP,C.green],
                    ["Promedio Zona",proj.velocityZone,C.navy],
                    ["Ventaja GLP",proj.velAdvantage,C.gold],
                  ].map(([lbl,val,col])=>(
                    <div key={lbl} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:col}}>{val}</div>
                      <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nota analista */}
              <div style={{marginBottom:14,padding:"14px 16px",borderRadius:10,background:"rgba(201,168,76,0.08)",border:`1px solid rgba(201,168,76,0.3)`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:6}}>💡 Conclusión del Analista</div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.6}}>{proj.analystNote}</div>
              </div>

              {/* Argumentos Colombia → Panamá */}
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.navy,marginBottom:8,borderLeft:`3px solid ${C.gold}`,paddingLeft:10}}>🇵🇦 Argumentos Clave Panamá vs. Colombia</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:8}}>
                  {[
                    {i:"💵",t:"Dolarización plena",d:"USD desde 1904. Sin riesgo cambiario para el inversionista colombiano."},
                    {i:"🏛️",t:"Exoneración predial 20 años",d:"Proyectos nuevos GLP: $0 de predial durante 20 años. Yield neto = yield bruto."},
                    {i:"📉",t:"Ganancia de capital: 2%",d:"Al vender, paga 2% en Panamá. En Colombia, hasta 15%. Diferencia determinante."},
                    {i:"🌎",t:"Residencia panameña",d:"Desde $300K con propiedad en Panamá. Visa en 30 días. Plan B para la familia."},
                    {i:"🏦",t:"Crédito hipotecario USD",d:"Banco panameño presta hasta 50–70% del valor. Tasas 8.5%–10.5% en USD."},
                    {i:"📈",t:"Mercado en crecimiento",d:"PIB Panamá 2025: +4.2–5.0%. Construcción enero 2026: +29.3%. Hub logístico del continente."},
                  ].map((x,i)=>(
                    <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px",border:"0.5px solid var(--color-border-tertiary)"}}>
                      <div style={{fontSize:18,marginBottom:4}}>{x.i}</div>
                      <div style={{fontWeight:700,fontSize:12,color:C.navy,marginBottom:3}}>{x.t}</div>
                      <div style={{fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.4}}>{x.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!perfil&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:"var(--color-text-secondary)"}}>
          <div style={{fontSize:32,marginBottom:12}}>🧮</div>
          <div style={{fontSize:16,fontWeight:600,color:C.navy,marginBottom:8}}>Calculadora de Inversión GLP — Análisis Institucional</div>
          <div style={{fontSize:13}}>Selecciona tu perfil de inversionista arriba para comenzar el análisis</div>
        </div>
      )}
      {perfil&&!proySel&&(
        <div style={{textAlign:"center",padding:"30px 20px",color:"var(--color-text-secondary)"}}>
          <div style={{fontSize:24,marginBottom:8}}>👆</div>
          <div style={{fontSize:13}}>Selecciona un proyecto de la lista para ver el análisis completo</div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MÓDULO 11 — BROKERS (Red Comercial Activa)
// ══════════════════════════════════════════════════════════
const BROKERS_INIT=[
  {id:1,nombre:"María Fernanda Larrazábal",empresa:"Capital Brokers SAS",cargo:"Líder Comercial GLP Bogotá",email:"mflarrazabal@capitalbrokers.co",tel:"+57 310 888 0001",zona:"Bogotá Norte / Chapinero",especialidad:"HNWI Bogotá, perfil renta y patrimonio",activo:true,comVendida:0,comisionAcum:0,nivel:"Platinum",incorporacion:"2026-04",nota:"Líder del equipo comercial. Ex Expocredit. Maneja el CRM y el pipeline diario.",leads:12,cierres:0},
  {id:2,nombre:"Carlos Andrés Joya",empresa:"Grupo Valverde",cargo:"Director Red de Aliados",email:"cjoya@grupovalverde.co",tel:"+57 312 888 0002",zona:"Bogotá / Nacional",especialidad:"Red de aliados, eventos institucionales, relaciones bancarias",activo:true,comVendida:0,comisionAcum:0,nivel:"Platinum",incorporacion:"2026-04",nota:"Activa la red de aliados y coordina los GLP Investment Evenings.",leads:8,cierres:0},
  {id:3,nombre:"Juan José Giraldo",empresa:"Colombia Tax Law Group",cargo:"Asesor Legal y Fiscal",email:"jjgiraldo@colombiataxlaw.co",tel:"+57 315 888 0003",zona:"Bogotá / Remoto",especialidad:"Estructuración fiscal, DIAN, repatriación capitales, residencia panameña",activo:true,comVendida:0,comisionAcum:0,nivel:"Gold",incorporacion:"2026-04",nota:"Estructura el componente legal de cada cierre. Capacita aliados en temas DIAN.",leads:5,cierres:0},
  {id:4,nombre:"Rodrigo Fernández",empresa:"Banco Privado Colombia",cargo:"Gerente Banca Privada",email:"rfernandez@bcoprivado.co",tel:"+57 317 888 0004",zona:"Bogotá Norte",especialidad:"Clientes banca privada, patrimonio +$500K USD",activo:true,comVendida:1,comisionAcum:9000,nivel:"Gold",incorporacion:"2026-05",nota:"Referidor de alta calidad. Sus clientes tienen perfil de cierre inmediato.",leads:6,cierres:1},
  {id:5,nombre:"Valentina Ospina",empresa:"Ospina & Restrepo Finanzas",cargo:"Asesora Patrimonial",email:"vospina@or-finanzas.co",tel:"+57 316 888 0005",zona:"Bogotá Centenario / El Nogal",especialidad:"Family offices, herencias, dolarización de portafolios",activo:true,comVendida:0,comisionAcum:0,nivel:"Silver",incorporacion:"2026-05",nota:"Especialista en dolarización. 3 clientes en evaluación activa.",leads:4,cierres:0},
  {id:6,nombre:"Andrés Morales Ruiz",empresa:"BBVA Colombia Banca Corporativa",cargo:"Director Negocios Internacionales",email:"amorales@bbva.co",tel:"+57 318 888 0006",zona:"Bogotá Corporativo",especialidad:"Empresarios, exportadores, clientes con operaciones internacionales",activo:false,comVendida:0,comisionAcum:0,nivel:"Silver",incorporacion:"2026-05",nota:"En proceso de firma de acuerdo de referidos. Perfil corporativo muy valioso.",leads:2,cierres:0},
  {id:7,nombre:"Patricia Vargas C.",empresa:"Coldwell Banker Premium",cargo:"Agente Inmobiliaria Senior",email:"pvargas@cbpremium.co",tel:"+57 311 888 0007",zona:"Usaquén / Santa Bárbara",especialidad:"Residencial lujo Bogotá, compradores de activos premium",activo:true,comVendida:0,comisionAcum:0,nivel:"Silver",incorporacion:"2026-05",nota:"Cartera de 200+ compradores de lujo en Bogotá. Entiende el lenguaje inmobiliario.",leads:3,cierres:0},
  {id:8,nombre:"Santiago Mesa",empresa:"Independent Wealth Bogotá",cargo:"Asesor Inversiones Independiente",email:"smesa@iwbogota.co",tel:"+57 313 888 0008",zona:"Bogotá / Medellín",especialidad:"Clientes independientes alta renta, tecnología y startups",activo:true,comVendida:0,comisionAcum:0,nivel:"Bronze",incorporacion:"2026-05",nota:"Red digital. Opera via WhatsApp y LinkedIn. Nuevo perfil tech-savvy.",leads:5,cierres:0},
];

const NIVEL_COLOR={Platinum:"#a855f7",Gold:C.gold,Silver:"#9ca3af",Bronze:"#cd7c2f"};

function BrokersModule(){
  const [brokers,setBrokers]=useState(BROKERS_INIT);
  const [sel,setSel]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [filtro,setFiltro]=useState("todos");
  const [form,setForm]=useState({nombre:"",empresa:"",cargo:"",email:"",tel:"",zona:"",especialidad:"",nota:"",nivel:"Bronze"});

  const lista=filtro==="todos"?brokers:filtro==="activo"?brokers.filter(b=>b.activo):brokers.filter(b=>!b.activo);
  const det=sel?brokers.find(b=>b.id===sel):null;
  const totalLeads=brokers.reduce((s,b)=>s+b.leads,0);
  const totalCierres=brokers.reduce((s,b)=>s+b.cierres,0);
  const totalCom=brokers.reduce((s,b)=>s+b.comisionAcum,0);

  const guardar=()=>{
    if(!form.nombre) return;
    setBrokers(prev=>[...prev,{...form,id:Date.now(),activo:true,comVendida:0,comisionAcum:0,leads:0,cierres:0,incorporacion:new Date().toISOString().slice(0,7)}]);
    setShowForm(false);
    setForm({nombre:"",empresa:"",cargo:"",email:"",tel:"",zona:"",especialidad:"",nota:"",nivel:"Bronze"});
  };

  const toggleActivo=(id)=>setBrokers(prev=>prev.map(b=>b.id===id?{...b,activo:!b.activo}:b));

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={sec(C.navy)}>Red Comercial de Brokers — Directorio Activo</div>
        <button onClick={()=>setShowForm(!showForm)}
          style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:C.navy,color:"#fff",border:"none"}}>
          {showForm?"✕ Cancelar":"+ Agregar Broker"}
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[
          {label:"Brokers activos",val:brokers.filter(b=>b.activo).length,color:C.green},
          {label:"Leads en pipeline",val:totalLeads,color:C.blue},
          {label:"Cierres logrados",val:totalCierres,color:C.navy},
          {label:"Comisiones generadas",val:"$"+fmt(totalCom)+" USD",color:C.gold},
        ].map(x=>(
          <div key={x.label} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:700,color:x.color}}>{x.val}</div>
            <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:3,lineHeight:1.3}}>{x.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {[["todos","Todos"],["activo","Activos"],["inactivo","En proceso"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFiltro(k)}
            style={{padding:"5px 14px",borderRadius:16,cursor:"pointer",fontSize:12,fontWeight:600,
              background:filtro===k?C.navy:"transparent",color:filtro===k?"#fff":C.navy,
              border:`1.5px solid ${C.navy}`}}>{l}</button>
        ))}
      </div>

      {/* Formulario */}
      {showForm&&(
        <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:16,marginBottom:14,border:`1px solid ${C.navy}22`}}>
          <div style={{fontWeight:700,color:C.navy,fontSize:13,marginBottom:10}}>Registrar Nuevo Broker</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            {[["Nombre completo","nombre","text"],["Empresa","empresa","text"],["Cargo","cargo","text"],
              ["Email","email","email"],["Teléfono","tel","text"],["Zona / Barrio","zona","text"],["Especialidad","especialidad","text"]].map(([lbl,fld,tp])=>(
              <div key={fld}>
                <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>{lbl}</label>
                <input type={tp} value={form[fld]} onChange={e=>setForm(f=>({...f,[fld]:e.target.value}))}
                  style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)"}}/>
              </div>
            ))}
            <div>
              <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Nivel</label>
              <select value={form.nivel} onChange={e=>setForm(f=>({...f,nivel:e.target.value}))}
                style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)"}}>
                {["Platinum","Gold","Silver","Bronze"].map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Notas internas</label>
            <textarea value={form.nota} onChange={e=>setForm(f=>({...f,nota:e.target.value}))}
              style={{width:"100%",padding:"8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)",minHeight:50}}/>
          </div>
          <button onClick={guardar} style={{padding:"7px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,background:C.green,color:"#fff",border:"none"}}>✓ Guardar</button>
        </div>
      )}

      {/* Lista + detalle */}
      <div style={{display:"grid",gridTemplateColumns:det?"1fr 1.5fr":"1fr",gap:12}}>
        <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"62vh",overflowY:"auto"}}>
          {lista.map(b=>{
            const nc=NIVEL_COLOR[b.nivel]||C.navy;
            return(
              <div key={b.id} onClick={()=>setSel(sel===b.id?null:b.id)}
                style={{borderRadius:8,padding:"12px 14px",cursor:"pointer",
                  border:`1.5px solid ${sel===b.id?C.navy:"var(--color-border-tertiary)"}`,
                  background:sel===b.id?"rgba(13,42,94,0.05)":"var(--color-background-secondary)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{fontWeight:700,fontSize:13,color:C.navy}}>{b.nombre}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:b.activo?C.green:C.red,display:"inline-block"}}/>
                    <span style={{fontSize:10,fontWeight:700,color:nc,border:`1px solid ${nc}44`,padding:"1px 7px",borderRadius:10}}>{b.nivel}</span>
                  </div>
                </div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{b.empresa} · {b.cargo}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginTop:8}}>
                  <div style={{textAlign:"center",background:"var(--color-background-primary)",borderRadius:5,padding:"4px"}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.blue}}>{b.leads}</div>
                    <div style={{fontSize:9,color:"var(--color-text-secondary)"}}>Leads</div>
                  </div>
                  <div style={{textAlign:"center",background:"var(--color-background-primary)",borderRadius:5,padding:"4px"}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.green}}>{b.cierres}</div>
                    <div style={{fontSize:9,color:"var(--color-text-secondary)"}}>Cierres</div>
                  </div>
                  <div style={{textAlign:"center",background:"var(--color-background-primary)",borderRadius:5,padding:"4px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.gold}}>${fmt(b.comisionAcum)}</div>
                    <div style={{fontSize:9,color:"var(--color-text-secondary)"}}>Com. USD</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {det&&(
          <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"16px",height:"fit-content"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:C.navy}}>{det.nombre}</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{det.empresa} · {det.cargo}</div>
              </div>
              <button onClick={()=>setSel(null)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            <div style={{background:`linear-gradient(135deg,${C.navy},${C.blue})`,borderRadius:8,padding:"12px",marginBottom:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center",color:"#fff"}}>
              <div><div style={{fontSize:20,fontWeight:700,color:C.gold}}>{det.leads}</div><div style={{fontSize:10,opacity:.7}}>Leads</div></div>
              <div><div style={{fontSize:20,fontWeight:700,color:"#7ef7c3"}}>{det.cierres}</div><div style={{fontSize:10,opacity:.7}}>Cierres</div></div>
              <div><div style={{fontSize:16,fontWeight:700}}>${fmt(det.comisionAcum)}</div><div style={{fontSize:10,opacity:.7}}>Com. USD</div></div>
            </div>
            {[["Email",det.email],["Teléfono",det.tel],["Zona",det.zona],["Especialidad",det.especialidad],["Incorporación",det.incorporacion],["Nivel",det.nivel],["Estado",det.activo?"Activo":"En proceso de firma"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:12}}>
                <span style={{color:"var(--color-text-secondary)"}}>{k}</span>
                <span style={{fontWeight:600,color:C.navy,textAlign:"right",maxWidth:"55%"}}>{v}</span>
              </div>
            ))}
            {det.nota&&(
              <div style={{marginTop:10,padding:"10px 12px",borderRadius:6,background:"rgba(26,79,174,0.06)",fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.5}}>
                <strong style={{color:C.blue}}>Notas: </strong>{det.nota}
              </div>
            )}
            <div style={{marginTop:10,display:"flex",gap:8}}>
              <button onClick={()=>toggleActivo(det.id)}
                style={{flex:1,padding:"7px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,
                  background:det.activo?C.red+"18":C.green+"18",color:det.activo?C.red:C.green,
                  border:`1px solid ${det.activo?C.red:C.green}44`}}>
                {det.activo?"❌ Desactivar":"✅ Activar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Comisiones estándar */}
      <div style={{marginTop:16,padding:"12px 14px",borderRadius:8,background:"rgba(46,125,94,0.06)",border:`0.5px solid ${C.green}44`,fontSize:12}}>
        <strong style={{color:C.green}}>💵 Comisiones estándar GLP Bogotá:</strong> Corredor persona natural: <strong>1.0%</strong> · Firma profesional: <strong>0.5%</strong> · Family office co-gestión: <strong>0.75%</strong> — todas en USD, pagadas dentro de 48h del cobro de comisión GLP.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MÓDULO 12 — AGENTES DE IA
// ══════════════════════════════════════════════════════════
const AGENTES_DATA=[
  {id:"aaron",nombre:"Aaron",rol:"Data Intelligence Agent",emoji:"📊",color:C.blue,
   foto:"file:///C:/Users/ahortua/.gemini/antigravity/brain/0e03b5ec-2412-4b32-823a-398fd6bbf279/agent_aaron_data_1778986884505.png",
   personalidad:"Analítico, preciso y veloz. Nunca da un número sin respaldo. Habla con datos.",
   bio:"Aaron es el cerebro cuantitativo del equipo. Fue entrenado con datos del mercado inmobiliario panameño desde 2018 y domina cada cap rate, cada cifra de vacancia y cada tendencia de valorización del portafolio GLP. Cuando Aaron habla, los inversionistas escuchan.",
   descripcion:"Agente especializado en análisis de datos del mercado inmobiliario panameño. Procesa información de precios, rentas, vacancia y competencia para alimentar la calculadora y los reportes ejecutivos.",
   capacidades:[
     "Análisis de cap rate y NOI por proyecto y zona",
     "Comparativo de mercado: GLP vs competencia directa",
   "Proyección de valorización a 5, 10 y 20 años",
     "Alertas de cambios en tasas hipotecarias Panamá",
     "Dashboard de KPIs de pipeline comercial en tiempo real",
     "Exportación de reportes PDF para presentaciones",
   ],
   estado:"Activo",casos:"Calculadora ROI — Tablero KPI — Análisis Portafolio",
   avatar:"file:///C:/Users/ahortua/.gemini/antigravity/brain/0e03b5ec-2412-4b32-823a-398fd6bbf279/agent_aaron_data_1778986884505.png"},
  {id:"alyson",nombre:"Alyson",rol:"Customer Success Agent",emoji:"🤝",color:C.green,
   foto:"file:///C:/Users/ahortua/.gemini/antigravity/brain/0e03b5ec-2412-4b32-823a-398fd6bbf279/agent_alyson_cs_1778986912742.png",
   personalidad:"Empática, organizada y siempre un paso adelante. Nunca deja a un cliente sin respuesta.",
   bio:"Alyson es la campeona de los clientes GLP. Hace seguimiento a cada prospecto como si fuera el único, prepara la carpeta completa del inversionista y coordina la agenda del equipo. Gracias a ella, ningún lead se pierde en el camino.",
   descripcion:"Agente de seguimiento y cierre comercial. Gestiona el CRM de prospectos, envía recordatorios automáticos, prepara los análisis financieros personalizados y acompaña al cliente desde el primer contacto hasta la firma.",
   capacidades:[
     "Seguimiento automático de prospectos (WhatsApp + email)",
     "Generación de análisis financiero personalizado por cliente",
     "Recordatorios de follow-up y cambio de estado en pipeline",
     "Prepara carpeta del inversionista: legal + financiero + proyecto",
     "Coordina agenda con María Fernanda y los aliados",
     "Reportes semanales de pipeline para A. Hortua",
   ],
   estado:"Activo",casos:"CRM Prospectos — Follow-up — Coordinación Agenda",
   avatar:"file:///C:/Users/ahortua/.gemini/antigravity/brain/0e03b5ec-2412-4b32-823a-398fd6bbf279/agent_alyson_cs_1778986912742.png"},
  {id:"valerie",nombre:"Valerie",rol:"Content & Copy Agent",emoji:"🎨",color:C.amber,
   foto:"file:///C:/Users/ahortua/.gemini/antigravity/brain/0e03b5ec-2412-4b32-823a-398fd6bbf279/agent_valerie_copy_1778986896936.png",
   personalidad:"Creativa, audaz y con ojo para lo premium. Convierte datos fríos en narrativas que venden.",
   bio:"Valerie escribe como hablan los inversionistas sofisticados. Desde el copy de una pieza de Instagram hasta un articulado técnico para LinkedIn, Valerie entiende que la forma en que se dice algo es tan importante como lo que se dice. Su trabajo llena las salas del GLP Investment Evening.",
   descripcion:"Agente de contenidos y comunicación. Genera el copy para piezas publicitarias, guiones de TikTok/Reels, articulados LinkedIn, emails de prospectos y scripts de presentación, todo alineado con el posicionamiento premium de GLP.",
   capacidades:[
     "Copy para LinkedIn, TikTok, Instagram y WhatsApp",
     "Guión de presentación para reuniones con HNWI",
     "Email templates segmentados por perfil de inversionista",
     "Articulados técnicos sobre ventajas tributarias Panamá",
     "Scripts de conversación para María Fernanda y aliados",
     "Brief creativo para GLP Panamá: 8 piezas Colombia",
   ],
   estado:"Activo",casos:"Piezas Publicitarias — LinkedIn — Propuestas a Clientes",
   avatar:"file:///C:/Users/ahortua/.gemini/antigravity/brain/0e03b5ec-2412-4b32-823a-398fd6bbf279/agent_valerie_copy_1778986896936.png"},
  {id:"isabella",nombre:"Isabella",rol:"Brand & Social Media Agent",emoji:"🎬",color:"#e11d73",
   foto:"file:///C:/Users/ahortua/.gemini/antigravity/brain/0e03b5ec-2412-4b32-823a-398fd6bbf279/agent_isabella_social_1780195102513.png",
   personalidad:"Carismática, auténtica y magnética. Nació para las cámaras y lo sabe. Conecta con la gente en segundos.",
   bio:"Isabella es la cara visible de GLP Bogotá en redes sociales. Aparece en cada TikTok, cada Reel, cada historia de Instagram que el equipo publica. Es colombiana, habla el idioma de los inversionistas locales, y tiene ese don especial de hacer que una inversión de $300K se sienta accesible, emocionante y urgente. Su presencia convierte seguidores en leads y leads en cierres.",
   descripcion:"Agente de presencia digital y video. Es la voz y el rostro de GLP Bogotá en TikTok, Instagram Reels y YouTube Shorts. Humaniza la marca, cuenta historias reales de inversionistas y genera la confianza que cierra ventas desde las redes.",
   capacidades:[
     "Guiones y grabación de TikToks y Reels (30–90 seg.)",
     "Testimonios de clientes y casos de éxito en video",
     "Stories de Instagram: behind-the-scenes GLP Bogotá",
     "Live sessions: tours virtuales de proyectos GLP",
     "Responde comentarios y DMs con tono de marca GLP",
     "Estrategia de contenido mensual para RRSS",
   ],
   estado:"Activo",casos:"TikTok — Instagram Reels — YouTube Shorts — Brand",
   avatar:"file:///C:/Users/ahortua/.gemini/antigravity/brain/0e03b5ec-2412-4b32-823a-398fd6bbf279/agent_isabella_social_1780195102513.png"},
];

function AgentesIA(){
  const [sel,setSel]=useState(null);
  const det=sel?AGENTES_DATA.find(a=>a.id===sel):null;
  const cols=det?"200px 1fr":"repeat(4,1fr)";

  return(
    <div>
      <div style={sec(C.navy)}>Equipo de Agentes IA — GLP Bogotá</div>
      <div style={{marginBottom:16,padding:"12px 16px",borderRadius:8,background:"rgba(26,79,174,0.06)",border:"0.5px solid rgba(26,79,174,0.2)",fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.6}}>
        <strong style={{color:C.navy}}>Infraestructura IA de la plataforma:</strong> Cuatro agentes especializados y con personalidad propia potencian cada aspecto de la operación. Aaron analiza, Alyson conecta, Valerie persuade e Isabella enamora desde las pantallas.
      </div>

      <div style={{display:"grid",gridTemplateColumns:cols,gap:16,alignItems:"start"}}>

        {/* Cards de agentes */}
        <div style={{display:det?"flex":"contents",flexDirection:"column",gap:12}}>
          {AGENTES_DATA.map(a=>(
            <div key={a.id} onClick={()=>setSel(sel===a.id?null:a.id)}
              style={{borderRadius:14,overflow:"hidden",cursor:"pointer",transition:"all .2s",
                border:`2px solid ${sel===a.id?a.color:"var(--color-border-tertiary)"}`,
                background:"var(--color-background-secondary)",
                boxShadow:sel===a.id?`0 4px 20px ${a.color}33`:"none"}}>
              {/* Foto */}
              <div style={{height:det?80:160,background:`linear-gradient(180deg,${a.color}22 0%,${a.color}55 100%)`,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {a.foto
                  ? <img src={a.foto} alt={a.nombre}
                      style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}
                      onError={e=>{e.currentTarget.style.display="none";}}/>
                  : <span style={{fontSize:48}}>{a.emoji}</span>
                }
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:40,background:"linear-gradient(transparent,rgba(0,0,0,0.5))"}}/>
                <div style={{position:"absolute",bottom:6,left:10,color:"#fff",fontSize:10,fontWeight:700,letterSpacing:.5}}>{a.rol.toUpperCase()}</div>
                <div style={{position:"absolute",top:8,right:8,background:C.green,color:"#fff",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10}}>● ACTIVO</div>
              </div>
              {/* Info */}
              <div style={{padding:det?"10px 12px":"14px"}}>
                <div style={{fontWeight:700,fontSize:det?12:14,color:C.navy,marginBottom:3}}>{a.nombre}</div>
                <div style={{fontSize:det?9:10,color:a.color,fontWeight:600,marginBottom:det?0:6}}>{a.personalidad?.slice(0,50)}{!det&&"..."}</div>
                {!det&&<div style={{fontSize:10,color:"var(--color-text-secondary)",lineHeight:1.4,marginBottom:8}}>{a.bio?.slice(0,80)}...</div>}
                {!det&&<div style={{fontSize:9,color:a.color,fontWeight:600,borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:6,lineHeight:1.5}}>{a.casos}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Panel de detalle */}
        {det&&(
          <div style={{background:"var(--color-background-secondary)",borderRadius:14,overflow:"hidden"}}>
            {/* Header con foto */}
            <div style={{background:`linear-gradient(135deg,${det.color},${det.color}88)`,padding:"20px",display:"flex",gap:16,alignItems:"center",color:"#fff"}}>
              <div style={{width:80,height:80,borderRadius:"50%",overflow:"hidden",border:"3px solid rgba(255,255,255,0.4)",flexShrink:0}}>
                {det.foto
                  ? <img src={det.foto} alt={det.nombre} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
                  : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>{det.emoji}</div>
                }
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:22,fontWeight:800,marginBottom:2}}>{det.nombre}</div>
                <div style={{fontSize:12,opacity:.85,marginBottom:6}}>{det.rol}</div>
                <div style={{fontSize:11,background:"rgba(255,255,255,0.15)",padding:"4px 10px",borderRadius:20,display:"inline-block"}}>
                  ✨ {det.personalidad}
                </div>
              </div>
              <button onClick={()=>setSel(null)} style={{background:"rgba(255,255,255,0.2)",border:"none",cursor:"pointer",fontSize:16,color:"#fff",width:30,height:30,borderRadius:"50%",flexShrink:0}}>✕</button>
            </div>

            <div style={{padding:"16px 20px"}}>
              {/* Bio */}
              <div style={{marginBottom:14,padding:"12px 14px",borderRadius:8,background:`${det.color}10`,border:`1px solid ${det.color}22`,fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.7,fontStyle:"italic"}}>
                "{det.bio}"
              </div>

              {/* Módulos que usa */}
              <div style={{marginBottom:12,fontSize:11,color:det.color,fontWeight:700,padding:"6px 10px",background:`${det.color}12`,borderRadius:6,display:"inline-block"}}>
                🔗 {det.casos}
              </div>

              {/* Capacidades */}
              <div style={{fontWeight:700,fontSize:11,color:C.navy,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Capacidades</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14}}>
                {det.capacidades.map((c,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 10px",background:"var(--color-background-primary)",borderRadius:6,border:`0.5px solid ${det.color}22`}}>
                    <span style={{color:det.color,fontWeight:700,fontSize:13,flexShrink:0}}>✓</span>
                    <span style={{fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.4}}>{c}</span>
                  </div>
                ))}
              </div>

              {/* Cómo activar */}
              <div style={{padding:"10px 14px",borderRadius:8,background:"rgba(13,42,94,0.04)",border:`1px solid ${C.navy}18`,fontSize:11,color:"var(--color-text-secondary)"}}>
                <strong style={{color:C.navy}}>💡 Cómo activar a {det.nombre}:</strong> Menciona directamente a {det.nombre} en el chat de Antigravity para que tome el control de su módulo especializado. Sus resultados aparecen en tiempo real en {det.casos.split(" — ").slice(0,2).join(" y ")}.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats globales */}
      <div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {[
          {label:"Agentes operativos",val:"4 / 4",color:C.green,desc:"Aaron · Alyson · Valerie · Isabella"},
          {label:"Módulos cubiertos",val:"12",color:C.blue,desc:"Dashboard → Brokers → RRSS"},
          {label:"Disponibilidad",val:"24/7",color:C.gold,desc:"Sin días libres ni vacaciones"},
          {label:"Motor IA",val:"Gemini 2.5",color:C.navy,desc:"Antigravity · Google DeepMind"},
        ].map(x=>(
          <div key={x.label} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"14px 16px",borderTop:`3px solid ${x.color}`}}>
            <div style={{fontSize:18,fontWeight:700,color:x.color,marginBottom:2}}>{x.val}</div>
            <div style={{fontSize:11,fontWeight:600,color:C.navy}}>{x.label}</div>
            <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:3}}>{x.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══ MAIN ════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// MÓDULO 8 — PORTAFOLIO GLP
// ══════════════════════════════════════════════════════════
const PORTAFOLIO_DATA=[
  {id:1,nombre:"Ocean Reef Park",zona:"Islas Artificiales — Punta Pacífica",tipo:"Ultra Lujo / Marina",
   entrega:"En desarrollo (2015–en curso)",recs:"2–4 rec. + Penthouses",parking:"2–4 puestos",
   areaMin:200,areaMax:600,precioMin:1500000,precioMax:null,precioM2Min:4500,precioM2Max:7500,
   rentaMin:7000,capRate:"5.0–6.5%",vacancia:"3–5%",
   tag:"Trophy Asset",tagColor:C.amber,perfil:"patrimonial",
   amenities:["Marina privada 180+ muelles","Yacht club","Piscinas infinity","Helipads privados","Spa y wellness","Gimnasio alta gama","Supermercado onsite","Restaurantes y beach club"],
   destacado:"Únicas islas artificiales habitables de Latinoamérica en el Pacífico. Sin comparable directo en la región."},
  {id:2,nombre:"Oceana Residences & Skyhomes",zona:"Santa María Golf & Country Club",tipo:"Ultra Lujo / Golf",
   entrega:"Nuevo (2022–2026)",recs:"1–3 rec. + Skyhomes",parking:"1–3 puestos",
   areaMin:80,areaMax:350,precioMin:850000,precioMax:null,precioM2Min:3500,precioM2Max:5500,
   rentaMin:3500,capRate:"4.7–6.0%",vacancia:"3–5%",
   tag:"Wealth Preservation",tagColor:C.amber,perfil:"patrimonial",
   amenities:["Golf 18 hoyos Jack Nicklaus","Club House","Piscinas resort","Pickleball y padel","Wellness center","Coworking premium","Gated 24/7"],
   destacado:"Única comunidad masterplan gated con golf Jack Nicklaus en Panamá. Valorización 5–7%/año documentada."},
  {id:3,nombre:"Bosco di Santa María",zona:"Santa María / Costa del Este",tipo:"Lujo Urbano / Biofílico",
   entrega:"Nuevo (2023–2026)",recs:"3–4 rec.",parking:"1–2 puestos",
   areaMin:250,areaMax:350,precioMin:1200000,precioMax:null,precioM2Min:2200,precioM2Max:3500,
   rentaMin:2800,capRate:"5.5–7.2%",vacancia:"4–7%",
   tag:"Lujo Biofílico",tagColor:C.green,perfil:"patrimonial",
   amenities:["Jardines botánicos","Piscina natural con cascadas","Senderos meditación","Gimnasio","Lobby lounge diseño","Seguridad 24/7"],
   destacado:"Naturaleza + lujo en Santa María. Familia ejecutiva con contratos de 1–3 años. Menor rotación del mercado."},
  {id:4,nombre:"The Palms",zona:"Punta Pacífica — Ciudad de Panamá",tipo:"Resort Urbano Premium",
   entrega:"Moderno (2018–2024)",recs:"1–3 rec.",parking:"1–2 puestos",
   areaMin:100,areaMax:220,precioMin:350000,precioMax:null,precioM2Min:2800,precioM2Max:4200,
   rentaMin:2200,capRate:"5.5–7.0%",vacancia:"4–6%",
   tag:"Digital Nomad Hub",tagColor:C.blue,perfil:"patrimonial",
   amenities:["Piscinas resort tropicales","Yoga deck vista Pacífico","Coworking + business pods","Gimnasio última gen.","Rooftop skyline","Concierge"],
   destacado:"Fuerte demanda ejecutivos extranjeros y nómadas digitales. El coworking es el diferenciador clave."},
  {id:5,nombre:"Ipanema Panamá",zona:"Costa del Este — Ciudad de Panamá",tipo:"Frente al Mar / Corporativo",
   entrega:"Moderno (2019–2024)",recs:"1–2 rec. + Penthouses",parking:"1–2 puestos",
   areaMin:85,areaMax:250,precioMin:280000,precioMax:null,precioM2Min:2000,precioM2Max:3500,
   rentaMin:1600,capRate:"6.0–7.5%",vacancia:"5–8%",
   tag:"Corporativo Premium",tagColor:C.navy,perfil:"disfrute",
   amenities:["Piscina vista al mar","Gimnasio moderno","Salón eventos","Coworking","BBQ lounge","Seguridad 24/7"],
   destacado:"Costa del Este: mercado más líquido de Panamá. Demanda corporativa estructural. 4–6% valorización/año."},
  {id:6,nombre:"The Tides – Playa Caracol",zona:"Playa Caracol, Chame",tipo:"Beach Resort Premium",
   entrega:"Nuevo (2022–2026)",recs:"2–3 rec. (casas y townhouses)",parking:"2 puestos (garaje)",
   areaMin:120,areaMax:280,precioMin:320000,precioMax:null,precioM2Min:2200,precioM2Max:3500,
   rentaMin:1500,capRate:"5.5–7.5%",vacancia:"7–12%",
   tag:"Playa Premium",tagColor:C.blue,perfil:"disfrute",
   amenities:["1.2 km playa blanca privada","Surf club y escuela surf","3 piscinas","Restaurante beach bar","Senderos naturales","Yoga deck","Gimnasio"],
   destacado:"Único proyecto en Playa Caracol con 1.2 km de playa privada. Estrategia mixta LP+corta puede dar cap rate 9–12%."},
  {id:7,nombre:"Surfside",zona:"Playa Caracol, Chame",tipo:"Resort + Aparthotel",
   entrega:"Moderno (2019–2024)",recs:"1–2 rec.",parking:"1–2 puestos",
   areaMin:60,areaMax:200,precioMin:190000,precioMax:null,precioM2Min:2000,precioM2Max:3000,
   rentaMin:1300,capRate:"5.8–7.5%",vacancia:"8–12%",
   tag:"Renta Gestionada",tagColor:C.green,perfil:"disfrute",
   amenities:["Playa privada","Aparthotel conserjería","Jacuzzi","Restaurante beach bar","Surf lounge","Parqueaderos cubiertos"],
   destacado:"Programa de renta gestionada del proyecto. Administración hotelera reduce carga al propietario."},
  {id:8,nombre:"BeachWalk Resort",zona:"Playa Caracol, Chame",tipo:"Wellness Resort",
   entrega:"Nuevo (2022–2025)",recs:"2 rec.",parking:"1–2 puestos",
   areaMin:75,areaMax:180,precioMin:230000,precioMax:null,precioM2Min:1800,precioM2Max:2800,
   rentaMin:1300,capRate:"5.5–7.5%",vacancia:"8–13%",
   tag:"Wellness",tagColor:C.green,perfil:"disfrute",
   amenities:["Frente océano Pacífico","Spa & wellness pabellón","Yoga deck exterior","Piscina paisajística","BBQ outdoor","Acceso controlado"],
   destacado:"Enfoque wellness diferenciador. Inquilino retirado internacional = contrato largo 12–36 meses."},
  {id:9,nombre:"Panama Viejo Residences",zona:"Panamá Viejo / Costa del Este",tipo:"Residencial Urbano",
   entrega:"Nueva entrega (2022–2025)",recs:"2 rec.",parking:"1 puesto",
   areaMin:58,areaMax:90,precioMin:120000,precioMax:null,precioM2Min:1500,precioM2Max:2200,
   rentaMin:950,capRate:"6.5–8.0%",vacancia:"5–8%",
   tag:"Mejor Cap Rate Urbano",tagColor:C.green,perfil:"renta",
   amenities:["Piscina y área social","Gimnasio moderno","Coworking","Parque infantil","BBQ terrazas","Seguridad 24/7"],
   destacado:"Mejor cap rate del portafolio urbano. Ticket de entrada mínimo. Ideal primera inversión Colombia→Panamá."},
  {id:10,nombre:"Bayside Resort Panamá",zona:"Arraiján / Pacífico Oeste",tipo:"Resort Familiar",
   entrega:"Desarrollo activo (2020–2026)",recs:"3 rec. (casas y aptos)",parking:"1–2 puestos",
   areaMin:80,areaMax:400,precioMin:150000,precioMax:null,precioM2Min:1200,precioM2Max:2000,
   rentaMin:800,capRate:"6.0–8.5%",vacancia:"6–10%",
   tag:"Mejor Precio Entrada",tagColor:C.gold,perfil:"renta",
   amenities:["Acceso privado playa","Club house y beach club","Piscinas","Canchas deportivas","Supermercado interno","Seguridad perimetral 24/7"],
   destacado:"Ticket más bajo del portafolio con acceso a playa y amenidades resort completas. Cap rate top."},
  {id:11,nombre:"Playa Dorada",zona:"Playa Dorada, Arraiján Oeste",tipo:"Playa Accesible",
   entrega:"Multi-fase (2015–2023)",recs:"2–3 rec.",parking:"1–2 puestos",
   areaMin:80,areaMax:160,precioMin:180000,precioMax:null,precioM2Min:1100,precioM2Max:1800,
   rentaMin:700,capRate:"6.5–8.5%",vacancia:"6–10%",
   tag:"Playa Asequible",tagColor:C.gold,perfil:"renta",
   amenities:["Club de playa privado","Piscinas y recreación","Parque infantil","Senderos","Cancha deportiva","Seguridad 24/7"],
   destacado:"Mayor demanda que oferta en este precio. Mercado local de clase media-alta con ingreso estable."},
  {id:12,nombre:"Ocean Front",zona:"Playa Dorada, Arraiján",tipo:"Playa Asequible / 1BR",
   entrega:"Moderno (2018–2023)",recs:"1–2 rec.",parking:"1 puesto",
   areaMin:60,areaMax:120,precioMin:180000,precioMax:null,precioM2Min:1100,precioM2Max:1800,
   rentaMin:750,capRate:"6.5–8.5%",vacancia:"6–10%",
   tag:"Yield/m² Máximo",tagColor:C.gold,perfil:"renta",
   amenities:["Acceso directo playa","Club privado y piscinas","Gimnasio","Zonas verdes","Seguridad 24/7"],
   destacado:"El 1BR ofrece el mayor yield por m² del portafolio. Entrada mínima de toda la zona playa."},
  {id:13,nombre:"Olas del Mar",zona:"Playa Caracol, Chame",tipo:"Playa Cap Rate",
   entrega:"Moderno (2018–2023)",recs:"2–3 rec.",parking:"1 puesto",
   areaMin:95,areaMax:160,precioMin:320000,precioMax:null,precioM2Min:1500,precioM2Max:2200,
   rentaMin:1050,capRate:"6.0–8.0%",vacancia:"8–14%",
   tag:"Cap Rate Playa",tagColor:C.green,perfil:"renta",
   amenities:["Piscina vista mar","BBQ y lounge","Área social","Parque infantil","Seguridad 24/7"],
   destacado:"Mejor cap rate en zona playa. Demanda de familias panameñas con segunda residencia."},
  {id:14,nombre:"Aires del Mar – Playa Caracol",zona:"Playa Caracol, Chame",tipo:"Playa Entrada Media",
   entrega:"Moderno (2018–2022)",recs:"1–2 rec.",parking:"1 puesto",
   areaMin:70,areaMax:150,precioMin:210000,precioMax:null,precioM2Min:1600,precioM2Max:2400,
   rentaMin:1000,capRate:"5.8–7.8%",vacancia:"8–14%",
   tag:"Playa Media",tagColor:C.blue,perfil:"renta",
   amenities:["Vista directa océano","Piscinas y área social","Parques infantiles","Espacios verdes","Seguridad 24/7"],
   destacado:"Precio accesible en zona playa genera demanda constante. Renta más estable en temporada seca dic–abr."},
  {id:15,nombre:"Ventu",zona:"Ciudad de Panamá (Airbnb)",tipo:"Rentas Cortas Optimizado",
   entrega:"Nuevo (2023–2026)",recs:"1–2 rec.",parking:"1 puesto",
   areaMin:65,areaMax:90,precioMin:180000,precioMax:null,precioM2Min:2500,precioM2Max:3500,
   rentaMin:0,capRate:"8–12% (Airbnb)",vacancia:"~20% (Airbnb)",
   tag:"Airbnb Único",tagColor:C.navy,perfil:"patrimonial",
   amenities:["Diseño Airbnb-ready","Administración hotelera delegada","Check-in digital","Coworking","Pool deck","Lobby inteligente"],
   destacado:"Único proyecto GLP optimizado para Airbnb. Administración delegada = propietario no gestiona nada."},
];

function PortafolioGLP(){
  const [filtro,setFiltro]=useState("todos");
  const [sel,setSel]=useState(null);
  const [busq,setBusq]=useState("");

  const FILTROS=[
    {id:"todos",label:"Todos los proyectos",color:C.navy},
    {id:"renta",label:"💰 Rentas",color:"#2e7d5e"},
    {id:"disfrute",label:"🏖️ Rentas + Disfrute",color:C.blue},
    {id:"patrimonial",label:"🛡️ Patrimonio",color:C.amber},
  ];

  const lista=PORTAFOLIO_DATA.filter(p=>{
    const matchFiltro=filtro==="todos"||p.perfil===filtro;
    const matchBusq=busq===""||p.nombre.toLowerCase().includes(busq.toLowerCase())||p.zona.toLowerCase().includes(busq.toLowerCase());
    return matchFiltro&&matchBusq;
  });

  const proy=sel?PORTAFOLIO_DATA.find(p=>p.id===sel):null;

  return(
    <div>
      <div style={sec(C.navy)}>Portafolio de Proyectos — Grupo Los Pueblos Panamá 2026</div>

      {/* Filtros + búsqueda */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
        {FILTROS.map(f=>(
          <button key={f.id} onClick={()=>{setFiltro(f.id);setSel(null);}}
            style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,
              background:filtro===f.id?f.color:"transparent",
              color:filtro===f.id?"#fff":f.color,
              border:`1.5px solid ${f.color}`}}>{f.label}</button>
        ))}
        <input placeholder="🔍 Buscar proyecto o zona..." value={busq} onChange={e=>setBusq(e.target.value)}
          style={{marginLeft:"auto",padding:"6px 12px",borderRadius:20,border:"1px solid var(--color-border-tertiary)",fontSize:12,minWidth:200,background:"var(--color-background-secondary)"}}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:sel?"1fr 1.5fr":"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {/* Lista de cards */}
        <div style={{display:sel?"flex":"contents",flexDirection:"column",gap:10,maxHeight:sel?"85vh":undefined,overflowY:sel?"auto":undefined}}>
          {lista.map(p=>{
            const isSel=sel===p.id;
            const pColor=p.perfil==="renta"?"#2e7d5e":p.perfil==="disfrute"?C.blue:C.amber;
            return(
              <div key={p.id} onClick={()=>setSel(isSel?null:p.id)}
                style={{borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"all .18s",
                  border:`2px solid ${isSel?pColor:"var(--color-border-tertiary)"}`,
                  background:isSel?`rgba(${p.perfil==="renta"?"46,125,94":p.perfil==="disfrute"?"26,79,174":"138,104,32"},0.06)`:"var(--color-background-secondary)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{fontWeight:700,fontSize:13,color:C.navy}}>{p.nombre}</div>
                  <span style={{...tag(`${p.tagColor}15`,p.tagColor),whiteSpace:"nowrap",fontSize:10}}>{p.tag}</span>
                </div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:8}}>{p.zona} · {p.tipo}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div style={{textAlign:"center",background:"var(--color-background-primary)",borderRadius:6,padding:"6px 4px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.green}}>Desde {usd(p.precioMin)}</div>
                    <div style={{fontSize:9,color:"var(--color-text-secondary)"}}>Precio mínimo USD</div>
                  </div>
                  <div style={{textAlign:"center",background:"var(--color-background-primary)",borderRadius:6,padding:"6px 4px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.gold}}>{p.capRate}</div>
                    <div style={{fontSize:9,color:"var(--color-text-secondary)"}}>Cap Rate</div>
                  </div>
                  <div style={{textAlign:"center",background:"var(--color-background-primary)",borderRadius:6,padding:"6px 4px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.navy}}>{p.areaMin}–{p.areaMax} m²</div>
                    <div style={{fontSize:9,color:"var(--color-text-secondary)"}}>{p.recs}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {lista.length===0&&<div style={{textAlign:"center",padding:"30px",color:"var(--color-text-secondary)",fontSize:12}}>Sin proyectos para este filtro</div>}
        </div>

        {/* Detalle proyecto */}
        {proy&&(
          <div style={{background:"var(--color-background-secondary)",borderRadius:12,padding:"20px",overflowY:"auto",maxHeight:"85vh"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:C.navy,marginBottom:2}}>{proy.nombre}</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{proy.zona}</div>
              </div>
              <button onClick={()=>setSel(null)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:18,color:C.navy}}>✕</button>
            </div>

            {/* Header métricas */}
            <div style={{background:`linear-gradient(135deg,${C.navy},${C.blue})`,borderRadius:10,padding:"14px 16px",marginBottom:14,color:"#fff"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,textAlign:"center"}}>
                <div><div style={{fontSize:18,fontWeight:700,color:C.gold}}>Desde {usd(proy.precioMin)}</div><div style={{fontSize:10,opacity:.7}}>Precio mínimo USD</div></div>
                <div><div style={{fontSize:18,fontWeight:700,color:"#7ef7c3"}}>{proy.capRate}</div><div style={{fontSize:10,opacity:.7}}>Cap Rate mercado</div></div>
                <div><div style={{fontSize:18,fontWeight:700}}>{proy.areaMin}–{proy.areaMax} m²</div><div style={{fontSize:10,opacity:.7}}>{proy.recs}</div></div>
              </div>
            </div>

            {/* Specs */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {[
                ["Tipo",proy.tipo],["Entrega",proy.entrega],
                ["Recámaras",proy.recs],["Parqueo",proy.parking],
                ["Precio/m²",`$${proy.precioM2Min.toLocaleString()}–$${proy.precioM2Max.toLocaleString()} USD`],
                ["Renta LP mínima",proy.rentaMin>0?`${usd(proy.rentaMin)}/mes`:"Ver calc. rentas cortas"],
                ["Vacancia estimada",proy.vacancia],["Perfil de inversión",proy.perfil.charAt(0).toUpperCase()+proy.perfil.slice(1)],
              ].map(([k,v])=>(
                <div key={k} style={{background:"var(--color-background-primary)",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:9,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:0.5}}>{k}</div>
                  <div style={{fontSize:12,fontWeight:600,color:C.navy,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Amenidades */}
            <div style={{...sec(C.navy),marginTop:0}}>Amenidades</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:14}}>
              {proy.amenities.map((a,i)=>(
                <div key={i} style={{display:"flex",gap:6,alignItems:"center",padding:"5px 8px",background:"var(--color-background-primary)",borderRadius:5}}>
                  <span style={{color:C.green,fontWeight:700,fontSize:11}}>✓</span>
                  <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>{a}</span>
                </div>
              ))}
            </div>

            {/* Nota analista */}
            <div style={{background:`rgba(201,168,76,0.1)`,border:`1px solid rgba(201,168,76,0.3)`,borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:5}}>💡 Nota del Analista</div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.5}}>{proy.destacado}</div>
            </div>
          </div>
        )}
      </div>

      {/* Resumen de portafolio */}
      <div style={{marginTop:18}}>
        <div style={sec(C.navy)}>Resumen del Portafolio — Indicadores Globales</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[
            {label:"Proyectos en portafolio",val:"15",color:C.navy},
            {label:"Ticket mínimo de entrada",val:"$120K USD",color:C.green},
            {label:"Cap Rate rango portafolio",val:"4.7–12%",color:C.gold},
            {label:"Exoneración predial",val:"20 años",color:C.green},
          ].map(x=>(
            <div key={x.label} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:700,color:x.color}}>{x.val}</div>
              <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:3,lineHeight:1.3}}>{x.label}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:10,padding:"10px 14px",borderRadius:8,background:"rgba(26,79,174,0.05)",border:"0.5px solid rgba(26,79,174,0.15)",fontSize:11,lineHeight:1.5,color:"var(--color-text-secondary)"}}>
          <strong style={{color:C.navy}}>Ventaja GLP sobre el mercado:</strong> Velocidad de colocación 30–50% más rápida que la competencia directa en todas las zonas. Exoneración predial 20 años en proyectos nuevos ($0 impuesto = yield bruto = yield neto). Canal Colombia no tiene representación directa — ventana exclusiva para Riga Asset Management.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MÓDULO 9 — PROSPECTOS CRM
// ══════════════════════════════════════════════════════════
const ESTADOS=["🔵 Primer Contacto","📞 En Seguimiento","📊 Análisis Enviado","🏦 Crédito / Due Dil.","✅ Cierre","❌ Perdido"];
const PERFILES_INV=["💰 Rentas","🏖️ Rentas + Disfrute","🛡️ Patrimonio","🤔 Por Definir"];

const PROSPECTOS_INIT=[
  {id:1,nombre:"Carlos M. Rodríguez",empresa:"Grupo Constructor CR",email:"cmr@grupocr.co",tel:"+57 310 555 0001",origen:"Referido aliado bancario",perfil:"💰 Rentas",presupuesto:350000,proyecto:"The Palms",estado:"📊 Análisis Enviado",fecha:"2026-05-10",nota:"Busca 2 unidades. Cap rate mínimo 6%. Ya tiene cuenta en banco panameño.",prioridad:"alta"},
  {id:2,nombre:"Ana Lucía Fonseca",empresa:"Fonseca & Asociados Law",email:"alfonseca@fal.co",tel:"+57 311 555 0002",origen:"GLP Investment Evening",perfil:"🛡️ Patrimonio",presupuesto:1200000,proyecto:"Oceana Residences",estado:"📞 En Seguimiento",fecha:"2026-05-12",nota:"Quiere traer $1.2M en dos tractos. Hablar con Tax Corp para estructura fiscal.",prioridad:"alta"},
  {id:3,nombre:"Jorge Herrera Peña",empresa:"Herrera Inmobiliaria",email:"jorge@hi.com.co",tel:"+57 318 555 0003",origen:"LinkedIn / Digital",perfil:"🏖️ Rentas + Disfrute",presupuesto:450000,proyecto:"The Tides",estado:"🔵 Primer Contacto",fecha:"2026-05-20",nota:"Segunda residencia playa + renta temporada. Familia 4 personas. Le interesa el surf club.",prioridad:"media"},
  {id:4,nombre:"Familia Ospina Vargas",empresa:"Ospina Construcciones SAS",email:"info@ospinacol.co",tel:"+57 314 555 0004",origen:"Referido C. Joya",perfil:"🛡️ Patrimonio",presupuesto:2500000,proyecto:"Ocean Reef Park",estado:"🏦 Crédito / Due Dil.",fecha:"2026-04-28",nota:"Trophy asset. Buscan isla artificial. Tienen abogado propio en Panamá. Proceso avanzado.",prioridad:"alta"},
  {id:5,nombre:"María Isabel Cárdenas",empresa:"Independiente",email:"mi.cardenas@gmail.com",tel:"+57 320 555 0005",origen:"Evento presencial Bogotá",perfil:"💰 Rentas",presupuesto:180000,proyecto:"Panama Viejo Residences",estado:"📊 Análisis Enviado",fecha:"2026-05-15",nota:"Primera inversión internacional. Enviado análisis financiero. Pedir pre-aprobación banco.",prioridad:"media"},
  {id:6,nombre:"Roberto Ángel Torres",empresa:"Family Office RAT",email:"rat@forat.com",tel:"+57 312 555 0006",origen:"Referido banco privado",perfil:"🛡️ Patrimonio",presupuesto:5000000,proyecto:"Bosco di Santa María",estado:"🔵 Primer Contacto",fecha:"2026-05-22",nota:"Family office. $5M+ disponibles. Quieren portafolio diversificado. Presentar en próxima reunión.",prioridad:"alta"},
];

function ProspectosCRM(){
  const [prospectos,setProspectos]=useState(PROSPECTOS_INIT);
  const [filtroEst,setFiltroEst]=useState("todos");
  const [sel,setSel]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({nombre:"",empresa:"",email:"",tel:"",origen:"",perfil:PERFILES_INV[3],presupuesto:"",proyecto:"",estado:ESTADOS[0],nota:"",prioridad:"media"});

  const lista=filtroEst==="todos"?prospectos:prospectos.filter(p=>p.estado===filtroEst);
  const detalle=sel?prospectos.find(p=>p.id===sel):null;

  const prioColor=p=>p.prioridad==="alta"?C.red:p.prioridad==="media"?C.gold:"var(--color-text-secondary)";

  const estColor=e=>e.includes("✅")?C.green:e.includes("🔵")?C.blue:e.includes("📞")?C.navy:e.includes("📊")?C.gold:e.includes("🏦")?C.amber:C.red;

  const conteo=ESTADOS.map(e=>({e,n:prospectos.filter(p=>p.estado===e).length}));

  const guardar=()=>{
    if(!form.nombre) return;
    const nuevo={...form,id:Date.now(),presupuesto:Number(form.presupuesto)||0,fecha:new Date().toISOString().slice(0,10)};
    setProspectos(prev=>[...prev,nuevo]);
    setShowForm(false);
    setForm({nombre:"",empresa:"",email:"",tel:"",origen:"",perfil:PERFILES_INV[3],presupuesto:"",proyecto:"",estado:ESTADOS[0],nota:"",prioridad:"media"});
  };

  const cambiarEstado=(id,nuevoEst)=>{
    setProspectos(prev=>prev.map(p=>p.id===id?{...p,estado:nuevoEst}:p));
    if(detalle?.id===id) setSel(null);
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={sec(C.navy)}>CRM de Prospectos — Pipeline Comercial</div>
        <button onClick={()=>setShowForm(!showForm)}
          style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:C.navy,color:"#fff",border:"none"}}>
          {showForm?"✕ Cancelar":"+ Nuevo Prospecto"}
        </button>
      </div>

      {/* Funnel visual */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginBottom:14}}>
        {conteo.map(({e,n})=>(
          <div key={e} onClick={()=>setFiltroEst(filtroEst===e?"todos":e)}
            style={{cursor:"pointer",borderRadius:8,padding:"10px 6px",textAlign:"center",
              background:filtroEst===e?estColor(e)+"22":"var(--color-background-secondary)",
              border:`1.5px solid ${filtroEst===e?estColor(e):"var(--color-border-tertiary)"}`}}>
            <div style={{fontSize:18,fontWeight:700,color:estColor(e)}}>{n}</div>
            <div style={{fontSize:9,color:"var(--color-text-secondary)",lineHeight:1.3,marginTop:2}}>{e.slice(2)}</div>
          </div>
        ))}
      </div>

      {/* Formulario nuevo prospecto */}
      {showForm&&(
        <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"16px",marginBottom:14,border:`1px solid ${C.navy}22`}}>
          <div style={{fontWeight:700,color:C.navy,fontSize:13,marginBottom:12}}>Registrar Nuevo Prospecto</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            {[
              ["Nombre completo","nombre","text"],["Empresa / Cargo","empresa","text"],["Email","email","email"],
              ["Teléfono","tel","text"],["Origen del prospecto","origen","text"],["Proyecto de interés","proyecto","text"],
              ["Presupuesto USD","presupuesto","number"],
            ].map(([lbl,fld,tp])=>(
              <div key={fld}>
                <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>{lbl}</label>
                <input type={tp} value={form[fld]} onChange={e=>setForm(f=>({...f,[fld]:e.target.value}))}
                  style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)"}}/>
              </div>
            ))}
            <div>
              <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Perfil inversor</label>
              <select value={form.perfil} onChange={e=>setForm(f=>({...f,perfil:e.target.value}))}
                style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)"}}>
                {PERFILES_INV.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Estado inicial</label>
              <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}
                style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)"}}>
                {ESTADOS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Prioridad</label>
              <select value={form.prioridad} onChange={e=>setForm(f=>({...f,prioridad:e.target.value}))}
                style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)"}}>
                {["alta","media","baja"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Notas</label>
            <textarea value={form.nota} onChange={e=>setForm(f=>({...f,nota:e.target.value}))}
              style={{width:"100%",padding:"8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)",minHeight:60}}/>
          </div>
          <button onClick={guardar}
            style={{padding:"8px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,background:C.green,color:"#fff",border:"none"}}>
            ✓ Guardar Prospecto
          </button>
        </div>
      )}

      {/* Lista + detalle */}
      <div style={{display:"grid",gridTemplateColumns:detalle?"1fr 1.4fr":"1fr",gap:12}}>
        <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"60vh",overflowY:"auto"}}>
          {lista.map(p=>(
            <div key={p.id} onClick={()=>setSel(sel===p.id?null:p.id)}
              style={{borderRadius:8,padding:"12px 14px",cursor:"pointer",
                border:`1.5px solid ${sel===p.id?C.navy:"var(--color-border-tertiary)"}`,
                background:sel===p.id?"rgba(13,42,94,0.05)":"var(--color-background-secondary)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{fontWeight:700,fontSize:13,color:C.navy}}>{p.nombre}</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:prioColor(p),display:"inline-block"}} title={`Prioridad ${p.prioridad}`}/>
                  <span style={{...tag(estColor(p.estado)+"18",estColor(p.estado)),fontSize:10}}>{p.estado.slice(2)}</span>
                </div>
              </div>
              <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{p.empresa} · {p.perfil}</div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:11}}>
                <span style={{color:C.green,fontWeight:600}}>Presupuesto: {usd(p.presupuesto)}</span>
                <span style={{color:"var(--color-text-secondary)"}}>{p.proyecto||"—"}</span>
              </div>
            </div>
          ))}
          {lista.length===0&&<div style={{textAlign:"center",padding:30,color:"var(--color-text-secondary)",fontSize:12}}>Sin prospectos en este estado</div>}
        </div>

        {/* Detalle del prospecto */}
        {detalle&&(
          <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"16px",height:"fit-content"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:C.navy}}>{detalle.nombre}</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{detalle.empresa}</div>
              </div>
              <button onClick={()=>setSel(null)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            {[
              ["Email",detalle.email],["Teléfono",detalle.tel],
              ["Origen",detalle.origen],["Perfil inversor",detalle.perfil],
              ["Presupuesto",usd(detalle.presupuesto)+" USD"],["Proyecto de interés",detalle.proyecto||"Por definir"],
              ["Fecha primer contacto",detalle.fecha],["Prioridad",detalle.prioridad.charAt(0).toUpperCase()+detalle.prioridad.slice(1)],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:12}}>
                <span style={{color:"var(--color-text-secondary)"}}>{k}</span>
                <span style={{fontWeight:600,color:C.navy,textAlign:"right",maxWidth:"60%"}}>{v}</span>
              </div>
            ))}
            {detalle.nota&&(
              <div style={{marginTop:10,padding:"10px 12px",borderRadius:6,background:"rgba(26,79,174,0.06)",fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.5}}>
                <strong style={{color:C.blue}}>Notas: </strong>{detalle.nota}
              </div>
            )}
            <div style={{marginTop:12}}>
              <div style={{fontSize:11,fontWeight:700,color:C.navy,marginBottom:8}}>Mover a estado:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {ESTADOS.filter(e=>e!==detalle.estado).map(e=>(
                  <button key={e} onClick={()=>cambiarEstado(detalle.id,e)}
                    style={{padding:"5px 10px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,
                      background:estColor(e)+"18",color:estColor(e),border:`1px solid ${estColor(e)}44`}}>
                    → {e.slice(2)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MÓDULO 10 — PRESUPUESTO DE EVENTOS
// ══════════════════════════════════════════════════════════
const EVENTOS_INIT=[
  {id:1,nombre:"GLP Investment Evening — Bogotá",tipo:"Evento Presencial Premium",fecha:"2026-07-15",lugar:"Club El Nogal, Bogotá",asistentes:60,estado:"Planificación",
   items:[
     {cat:"Venue",desc:"Salón privado Club El Nogal (4h)",costo:3500000},
     {cat:"Catering",desc:"Cóctel premium + cena ligera 60 personas",costo:4800000},
     {cat:"A/V y Producción",desc:"Pantalla, sonido, presentación, iluminación",costo:2200000},
     {cat:"Material",desc:"Brochures, carpetas, gift bag GLP (60)",costo:1800000},
     {cat:"Invitados GLP",desc:"Tiquetes + hotel María Fonseca + 1 acomp.",costo:3200000},
     {cat:"Logística",desc:"Transporte invitados, utilería",costo:800000},
     {cat:"Marketing",desc:"Invitaciones digitales, WhatsApp masivo, LinkedIn",costo:600000},
   ]},
  {id:2,nombre:"Sesión Técnica DIAN 2026 — Aliados",tipo:"Workshop Técnico",fecha:"2026-08-20",lugar:"Oficinas Riga / Sala de juntas",asistentes:20,estado:"Planificación",
   items:[
     {cat:"Venue",desc:"Sala de juntas Riga Asset Management",costo:0},
     {cat:"Catering",desc:"Coffee break + almuerzo de trabajo 20 personas",costo:1200000},
     {cat:"Ponente",desc:"Honorario Colombia Tax Law Group (J.J. Giraldo)",costo:2500000},
     {cat:"Material",desc:"Cartillas tributarias + guías DIAN 2026",costo:600000},
     {cat:"A/V",desc:"Videoconferencia + grabación para reenvío",costo:400000},
   ]},
  {id:3,nombre:"Webinar Colombia → Panamá — Digital",tipo:"Evento Virtual",fecha:"2026-06-25",lugar:"Zoom Webinar",asistentes:120,estado:"Confirmado",
   items:[
     {cat:"Plataforma",desc:"Zoom Webinar 500 (1h)",costo:350000},
     {cat:"Producción",desc:"Diseño slides, moderación, QA técnico",costo:800000},
     {cat:"Marketing",desc:"Pauta LinkedIn + email marketing + WhatsApp",costo:1500000},
     {cat:"Ponente GLP",desc:"Tiempo y materiales María Fonseca (remoto)",costo:0},
   ]},
];

const TRM_DEFAULT=4300;

function PresupuestoEventos(){
  const [eventos,setEventos]=useState(EVENTOS_INIT);
  const [sel,setSel]=useState(1);
  const [trm,setTrm]=useState(TRM_DEFAULT);
  const [showAddEvento,setShowAddEvento]=useState(false);
  const [nuevoEvento,setNuevoEvento]=useState({nombre:"",tipo:"Evento Presencial",fecha:"",lugar:"",asistentes:"",estado:"Planificación"});
  const [showAddItem,setShowAddItem]=useState(false);
  const [nuevoItem,setNuevoItem]=useState({cat:"",desc:"",costo:""});

  const evento=eventos.find(e=>e.id===sel);
  const totalCOP=evento?evento.items.reduce((s,i)=>s+i.costo,0):0;
  const totalUSD=Math.round(totalCOP/trm);
  const costoPorAsis=evento&&evento.asistentes>0?Math.round(totalCOP/evento.asistentes):0;
  const totalGlobal=eventos.reduce((s,e)=>s+e.items.reduce((ss,i)=>ss+i.costo,0),0);

  const addEvento=()=>{
    if(!nuevoEvento.nombre) return;
    setEventos(prev=>[...prev,{...nuevoEvento,id:Date.now(),asistentes:Number(nuevoEvento.asistentes)||0,items:[]}]);
    setShowAddEvento(false);
    setNuevoEvento({nombre:"",tipo:"Evento Presencial",fecha:"",lugar:"",asistentes:"",estado:"Planificación"});
  };

  const addItem=()=>{
    if(!nuevoItem.desc) return;
    setEventos(prev=>prev.map(e=>e.id===sel?{...e,items:[...e.items,{...nuevoItem,costo:Number(nuevoItem.costo)||0}]}:e));
    setShowAddItem(false);
    setNuevoItem({cat:"",desc:"",costo:""});
  };

  const removeItem=(evtId,idx)=>{
    setEventos(prev=>prev.map(e=>e.id===evtId?{...e,items:e.items.filter((_,i)=>i!==idx)}:e));
  };

  const estColor=s=>s==="Confirmado"?C.green:s==="Ejecutado"?C.navy:C.gold;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={sec(C.navy)}>Presupuesto de Eventos GLP Bogotá 2026</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>TRM USD/COP:</span>
          <input type="number" value={trm} onChange={e=>setTrm(Number(e.target.value)||4300)}
            style={{width:90,padding:"5px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,fontWeight:700,background:"var(--color-background-secondary)"}}/>
          <button onClick={()=>setShowAddEvento(!showAddEvento)}
            style={{padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:C.navy,color:"#fff",border:"none"}}>
            + Nuevo Evento
          </button>
        </div>
      </div>

      {/* Resumen global */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[
          {label:"Eventos planeados",val:`${eventos.length}`,color:C.navy},
          {label:"Presupuesto total COP",val:`$${fmt(totalGlobal)}`,color:C.red},
          {label:"Presupuesto total USD",val:`$${fmt(Math.round(totalGlobal/trm))}`,color:C.gold},
          {label:"Confirmados",val:`${eventos.filter(e=>e.estado==="Confirmado").length}`,color:C.green},
        ].map(x=>(
          <div key={x.label} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:19,fontWeight:700,color:x.color}}>{x.val}</div>
            <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:3,lineHeight:1.3}}>{x.label}</div>
          </div>
        ))}
      </div>

      {/* Nuevo evento form */}
      {showAddEvento&&(
        <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"16px",marginBottom:14,border:`1px solid ${C.navy}22`}}>
          <div style={{fontWeight:700,color:C.navy,fontSize:13,marginBottom:10}}>Registrar Nuevo Evento</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
            {[
              ["Nombre del evento","nombre","text"],["Tipo","tipo","text"],["Fecha","fecha","date"],
              ["Lugar / Venue","lugar","text"],["Asistentes esperados","asistentes","number"]
            ].map(([lbl,fld,tp])=>(
              <div key={fld}>
                <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>{lbl}</label>
                <input type={tp} value={nuevoEvento[fld]} onChange={e=>setNuevoEvento(f=>({...f,[fld]:e.target.value}))}
                  style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)"}}/>
              </div>
            ))}
            <div>
              <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Estado</label>
              <select value={nuevoEvento.estado} onChange={e=>setNuevoEvento(f=>({...f,estado:e.target.value}))}
                style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-primary)"}}>
                {["Planificación","Confirmado","Ejecutado"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button onClick={addEvento} style={{padding:"7px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,background:C.green,color:"#fff",border:"none"}}>✓ Guardar</button>
        </div>
      )}

      {/* Selector de eventos */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {eventos.map(e=>(
          <button key={e.id} onClick={()=>setSel(e.id)}
            style={{padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,
              background:sel===e.id?C.navy:"var(--color-background-secondary)",
              color:sel===e.id?"#fff":C.navy,
              border:`1.5px solid ${sel===e.id?C.navy:"var(--color-border-tertiary)"}`}}>
            {e.nombre.length>30?e.nombre.slice(0,30)+"…":e.nombre}
            <span style={{marginLeft:6,fontSize:10,...tag(estColor(e.estado)+"20",estColor(e.estado))}}>{e.estado}</span>
          </button>
        ))}
      </div>

      {/* Detalle del evento seleccionado */}
      {evento&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
            {[
              {label:"Fecha",val:evento.fecha,color:C.navy},
              {label:"Lugar",val:evento.lugar,color:C.navy},
              {label:"Asistentes",val:`${evento.asistentes}`,color:C.blue},
              {label:"Costo / Asistente",val:`$${fmt(costoPorAsis)} COP`,color:C.red},
            ].map(x=>(
              <div key={x.label} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:0.5}}>{x.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:x.color,marginTop:3}}>{x.val}</div>
              </div>
            ))}
          </div>

          {/* Tabla de ítems */}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                <th style={TH}>Categoría</th>
                <th style={TH}>Descripción</th>
                <th style={{...TH,textAlign:"right"}}>Costo COP</th>
                <th style={{...TH,textAlign:"right"}}>Costo USD</th>
                <th style={{...TH,width:40}}>Del.</th>
              </tr></thead>
              <tbody>
                {evento.items.map((it,i)=>(
                  <tr key={i} style={{background:i%2===0?"var(--color-background-secondary)":"var(--color-background-primary)"}}>
                    <td style={{...TD,fontWeight:600,color:C.navy}}>{it.cat}</td>
                    <td style={TD}>{it.desc}</td>
                    <td style={{...TD,textAlign:"right",color:it.costo===0?C.green:C.navy,fontWeight:600}}>
                      {it.costo===0?"Incluido":"$"+fmt(it.costo)}
                    </td>
                    <td style={{...TD,textAlign:"right",color:"var(--color-text-secondary)"}}>
                      {it.costo===0?"—":"$"+fmt(Math.round(it.costo/trm))}
                    </td>
                    <td style={{...TD,textAlign:"center"}}>
                      <button onClick={()=>removeItem(evento.id,i)}
                        style={{background:"transparent",border:"none",cursor:"pointer",color:C.red,fontSize:14}}>×</button>
                    </td>
                  </tr>
                ))}
                <tr style={{background:C.navy}}>
                  <td colSpan={2} style={{...TD,color:"#fff",fontWeight:700,background:C.navy}}>TOTAL EVENTO</td>
                  <td style={{...TD,textAlign:"right",color:C.gold,fontWeight:700,fontSize:14,background:C.navy}}>${fmt(totalCOP)}</td>
                  <td style={{...TD,textAlign:"right",color:"#7ef7c3",fontWeight:700,fontSize:14,background:C.navy}}>${fmt(totalUSD)} USD</td>
                  <td style={{...TD,background:C.navy}}/>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Agregar ítem */}
          <div style={{marginTop:12}}>
            <button onClick={()=>setShowAddItem(!showAddItem)}
              style={{padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,
                background:"transparent",color:C.navy,border:`1.5px solid ${C.navy}`}}>
              {showAddItem?"✕ Cancelar":"+ Agregar Ítem"}
            </button>
            {showAddItem&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr auto",gap:8,marginTop:8,alignItems:"end"}}>
                <div>
                  <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Categoría</label>
                  <input value={nuevoItem.cat} onChange={e=>setNuevoItem(f=>({...f,cat:e.target.value}))}
                    style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-secondary)"}}/>
                </div>
                <div>
                  <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Descripción</label>
                  <input value={nuevoItem.desc} onChange={e=>setNuevoItem(f=>({...f,desc:e.target.value}))}
                    style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-secondary)"}}/>
                </div>
                <div>
                  <label style={{fontSize:10,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Costo COP</label>
                  <input type="number" value={nuevoItem.costo} onChange={e=>setNuevoItem(f=>({...f,costo:e.target.value}))}
                    style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border-tertiary)",fontSize:12,background:"var(--color-background-secondary)"}}/>
                </div>
                <button onClick={addItem}
                  style={{padding:"6px 14px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12,background:C.green,color:"#fff",border:"none",height:32}}>✓</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App(){
  const [tab,setTab]=useState(0);
  const [sc,setSc]=useState(1);
  const [openAliado,setOpenAliado]=useState(null);
  const [openAd,setOpenAd]=useState(null);

  return(
    <div style={{fontFamily:"system-ui,sans-serif",color:"var(--color-text-primary)",display:"flex",flexDirection:"column",minHeight:"100vh"}}>

      {/* TOP HEADER */}
      <div style={{background:`linear-gradient(90deg,${C.navy} 0%,#0a1e45 100%)`,color:"#fff",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,boxShadow:"0 2px 12px rgba(0,0,0,0.25)"}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,letterSpacing:.8,display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:C.gold}}>▲</span> GRUPO LOS PUEBLOS · BOGOTÁ
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:2}}>
            Capital Brokers SAS · Colombia Tax Law Group · Grupo Valverde · Representación oficial
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:C.gold,fontWeight:600}}>María Fernanda Larrazábal</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>Líder Comercial · USD $6,500/mes op.</div>
          </div>
          <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.amber})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.navy,flexShrink:0}}>MF</div>
        </div>
      </div>

      {/* MAIN LAYOUT: content + right sidebar */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* CONTENT AREA */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 20px"}}>

      {/* ══ TAB 0: DASHBOARD ══════════════════════════════ */}
      {tab===0&&(<>
        <div style={card()}>
          <div style={{fontSize:20,fontWeight:500,color:C.navy,marginBottom:6}}>Dashboard Ejecutivo — GLP Bogotá</div>
          {/* Alianza tripartita */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
            {[
              {nombre:"Capital Brokers SAS",lider:"Armando Hortua",rol:"Operación comercial y red HNWI Bogotá",c:C.navy,icono:"🏢"},
              {nombre:"Colombia Tax Law Group",lider:"Juan José Giraldo",rol:"Estructuración legal, fiscal y patrimonial",c:C.blue,icono:"⚖️"},
              {nombre:"Grupo Valverde",lider:"Carlos Joya",rol:"Red de aliados y eventos institucionales",c:C.gold,icono:"🤝"},
            ].map((a,i)=>(
              <div key={i} style={{borderLeft:`3px solid ${a.c}`,background:"var(--color-background-secondary)",borderRadius:"0 8px 8px 0",padding:"10px 12px"}}>
                <div style={{fontWeight:700,fontSize:12,color:a.c,marginBottom:2}}>{a.icono} {a.nombre}</div>
                <div style={{fontSize:11,color:C.navy,fontWeight:600}}>{a.lider}</div>
                <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2,lineHeight:1.4}}>{a.rol}</div>
              </div>
            ))}
          </div>

          {/* KPIs de mercado */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
            {[
              {v:"USD 1,804/m²",l:"Precio promedio Ciudad de Panamá 2025",c:C.navy,icon:"🏙️",sub:"+4.7% vs 2024"},
              {v:"7.8%",l:"Rentabilidad bruta alquiler LP · Panamá",c:C.green,icon:"💰",sub:"vs 4.5–6% en Bogotá"},
              {v:"+29.3%",l:"Inversión en construcción · Panamá ene 2026",c:C.gold,icon:"🏗️",sub:"Récord histórico Q1"},
              {v:"USD 208M",l:"Capital colombiano → Panamá · Q3 2025",c:C.blue,icon:"🇨🇴",sub:"Colombia #1 inversor externo"},
              {v:"+15%",l:"Transacciones de lujo · Panamá 1S 2025",c:C.navy,icon:"📈",sub:"Segmento +$300K USD"},
              {v:"$300K",l:"Umbral residencia panameña por inversión",c:C.gold,icon:"🛂",sub:"Trámite remoto · 30 días"},
              {v:"20 años",l:"Exoneración predial proyectos nuevos GLP",c:C.green,icon:"🏛️",sub:"$0 impuesto predial"},
              {v:"2%",l:"Impuesto ganancia capital Panamá (vs 15% Col.)",c:C.amber,icon:"⚡",sub:"Ventaja fiscal clave"},
              {v:"40+",l:"Años de trayectoria Grupo Los Pueblos",c:C.navy,icon:"🏆",sub:"+60 desarrollos entregados"},
            ].map((m,i)=>(
              <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px",borderBottom:`3px solid ${m.c}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{fontSize:20,fontWeight:700,color:m.c}}>{m.v}</div>
                  <span style={{fontSize:16}}>{m.icon}</span>
                </div>
                <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:4,lineHeight:1.4}}>{m.l}</div>
                <div style={{fontSize:9,color:m.c,fontWeight:600,marginTop:3}}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={card()}>
            <div style={sec()}>Pipeline de ventas</div>
            {PIPELINE.map((p,i)=>{
              const w=Math.max(12,Math.round((p.n/42)*100));
              return(
                <div key={i} style={{marginBottom:7}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
                    <span style={{color:"var(--color-text-secondary)"}}>{p.e}</span>
                    <span style={{fontWeight:600,color:p.c}}>{p.n}</span>
                  </div>
                  <div style={{height:18,borderRadius:4,background:"var(--color-border-tertiary)",overflow:"hidden"}}>
                    <div style={{width:w+"%",height:"100%",background:p.c,borderRadius:4,display:"flex",alignItems:"center",paddingLeft:6,transition:"width .8s"}}>
                      <span style={{color:"#fff",fontSize:9,fontWeight:700}}>{p.n}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:6}}>Conv. global: {pct(1/42*100)} · Ciclo objetivo: 45–90 días</div>
          </div>
          <div style={card()}>
            <div style={sec()}>Comparativo Bogotá vs Panamá</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr>{["Variable","Bogotá","Panamá GLP"].map(h=><th key={h} style={{...TH,fontSize:11}}>{h}</th>)}</tr></thead>
              <tbody>
                {[
                  ["Divisa","Pesos COP","USD dolarizado"],
                  ["Renta bruta/año","4.5–6%","7.8% (GPG 2025)"],
                  ["Predial","Sí, anual","Exento 20 años"],
                  ["Ganan. capital","Hasta 15%","2% en Panamá"],
                  ["Residencia","No aplica","Desde $300K"],
                  ["Riesgo cambiario","Alto","Ninguno"],
                ].map((r,i)=>(
                  <tr key={i}>
                    <td style={{...TD,fontWeight:500,color:C.navy}}>{r[0]}</td>
                    <td style={TD}>{r[1]}</td>
                    <td style={{...TD,color:C.green,fontWeight:500}}>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {/* ══ TAB 1: PLAN DE NEGOCIOS ═══════════════════════ */}
      {tab===1&&(<>
        <div style={card()}>
          <div style={{fontSize:20,fontWeight:500,color:C.navy,marginBottom:8}}>Plan de Negocios</div>
          <div style={{background:`rgba(201,168,76,0.08)`,borderLeft:`4px solid ${C.gold}`,padding:"14px 18px",borderRadius:"0 8px 8px 0",fontSize:13,lineHeight:1.7,marginBottom:16}}>
            No vendemos apartamentos. <strong>Estructuramos inversiones patrimoniales internacionales en USD.</strong> La alianza tripartita es el diferencial: Capital Brokers trae la red y el cierre; Colombia Tax Law Group pone el respaldo legal y fiscal; Grupo Valverde activa los aliados y los eventos. Nadie en Bogotá puede replicar este conjunto.
          </div>

          <div style={sec()}>Portafolio GLP — Proyectos 2026</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["Proyecto","Tipo","Entrada","Retorno","Perfil","Foco"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ["Armonía Cinta Costera","Urbano mixto","$140K","7–9%","HNWI joven, renta corta","★ Punta lanza"],
                ["Panamá Viejo Residences","Urbano práctico","$160K","6–8%","Ejecutivo, movilidad","★ Punta lanza"],
                ["The Tides — Playa Caracol","Playa/Resort","$180K","6–9%","Familia, 2da vivienda","Upsell natural"],
                ["Playa Dorada","Playa accesible","$120K","5–7%","Primera inv. int'l","Upsell natural"],
                ["Ipanema Waterfront","Frente al mar","$280K","6–8%","Inversionista financiero","Segmento medio-alto"],
                ["Bosco di Santa María","Lujo urbano","$350K","5–7%","Alto patrimonio, golf","Segmento alto"],
                ["Oceana Residences","Ultra lujo","$500K","5–8%","Ultra HNW","Premium"],
                ["Ocean Reef Park","Marina / Ícono","$1M+","PV 8–12%","Lujo extremo","Halo de marca"],
              ].map((r,i)=>(
                <tr key={i}>
                  <td style={{...TD,fontWeight:500,color:C.navy}}>{r[0]}</td>
                  <td style={TD}>{r[1]}</td>
                  <td style={{...TD,color:C.green,fontWeight:500}}>{r[2]}</td>
                  <td style={TD}>{r[3]}</td>
                  <td style={{...TD,fontSize:11}}>{r[4]}</td>
                  <td style={TD}><span style={tag(r[5].startsWith("★")?"rgba(201,168,76,0.15)":"rgba(13,42,94,0.07)",r[5].startsWith("★")?C.amber:C.navy)}>{r[5]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={sec()}>Proyección Financiera</div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {["Conservador","Base","Optimista"].map((s,i)=>(
              <button key={i} onClick={()=>setSc(i)} style={{padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,background:sc===i?C.navy:"transparent",color:sc===i?"#fff":C.navy,border:`1px solid ${C.navy}`}}>{s}</button>
            ))}
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["Período","Transacc.","Ticket prom.","Valor vendido","Comisión 5%","Margen neto"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{PROYECCIONES.map((p,i)=>{
              const s=p.sc[sc];
              return(<tr key={i}>
                <td style={{...TD,fontWeight:500}}>{p.año}</td>
                <td style={TD}>{s.tx}</td>
                <td style={TD}>{usd(s.t)}</td>
                <td style={TD}>{usd(s.tx*s.t)}</td>
                <td style={{...TD,color:C.gold,fontWeight:500}}>{usd(s.c)}</td>
                <td style={{...TD,color:C.green,fontWeight:700}}>{usd(s.n)}</td>
              </tr>);
            })}</tbody>
          </table>

          <div style={sec()}>Presupuesto Operativo Mensual</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["Rubro","Monto USD","Frecuencia","Fuente"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ["María Fernanda Larrazábal — Líder comercial",3000,"Mensual","Capital colombiano asignado"],
                ["Eventos, cenas, atenciones a clientes y aliados",3500,"Mensual","Capital colombiano asignado"],
                ["Diseño y material publicitario",0,"Continuo","GLP Panamá cubre este rubro"],
                ["Microsite + CRM + herramientas digitales",1200,"Anual (mes 3)","Capital colombiano"],
                ["Asesoría legal inicial (contrato + estructura)",2500,"Única vez (mes 1–2)","Alianza tripartita"],
                ["Viaje activación Panamá (equipo socios)",2500,"Única vez (mes 1)","Alianza tripartita"],
                ["Stand Gran Salón Corferias agosto 2026",4000,"Única vez (agosto)","Capital colombiano + GLP"],
              ].map((r,i)=>(
                <tr key={i}>
                  <td style={{...TD,fontWeight:i<2?500:400}}>{r[0]}</td>
                  <td style={{...TD,color:r[1]===0?C.green:r[1]>=3000?C.red:C.navy,fontWeight:500}}>{r[1]===0?"$0 — cubierto GLP":usd(r[1])}</td>
                  <td style={{...TD,fontSize:11}}>{r[2]}</td>
                  <td style={{...TD,fontSize:11,color:"var(--color-text-secondary)"}}>{r[3]}</td>
                </tr>
              ))}
              <tr style={{background:C.navy}}>
                <td style={{...TD,color:"#fff",fontWeight:700}}>FIJO MENSUAL (operativo puro)</td>
                <td style={{...TD,color:C.gold,fontWeight:700}}>USD $6,500</td>
                <td style={{...TD,color:"rgba(255,255,255,0.6)"}}>Mensual</td>
                <td style={{...TD,color:"rgba(255,255,255,0.6)"}}>Capital asignado Colombia</td>
              </tr>
            </tbody>
          </table>

          <div style={sec()}>Mapa de Ruta — 4 Fases</div>
          {FASES.map((f,i)=>(
            <div key={i} style={{borderLeft:`3px solid ${f.c}`,paddingLeft:16,marginBottom:20,position:"relative"}}>
              <div style={{position:"absolute",left:-9,top:0,width:15,height:15,borderRadius:"50%",background:f.c,border:"2px solid white"}}/>
              <div style={{fontSize:10,color:f.c,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>{f.f} · {f.p}</div>
              <div style={{fontWeight:600,fontSize:14,color:C.navy,marginBottom:8}}>{f.t}</div>
              {f.items.map((item,j)=>(
                <div key={j} style={{display:"flex",gap:8,marginBottom:5,fontSize:12,alignItems:"flex-start"}}>
                  <div style={{minWidth:6,height:6,borderRadius:"50%",background:C.gold,marginTop:5,flexShrink:0}}/>
                  <span style={{color:"var(--color-text-secondary)"}}>{item}</span>
                </div>
              ))}
              <div style={{background:"rgba(201,168,76,0.07)",border:`0.5px solid ${C.gold}44`,borderRadius:6,padding:"8px 12px",marginTop:8,fontSize:11,color:C.amber}}>
                <strong>Criterio de éxito:</strong> {f.kpi}
              </div>
            </div>
          ))}
        </div>
      </>)}

      {/* ══ TAB 2: PLAN DE MERCADO ════════════════════════ */}
      {tab===2&&(<>
        <div style={card()}>
          <div style={{fontSize:20,fontWeight:500,color:C.navy,marginBottom:8}}>Plan de Mercado Bogotá 2026</div>

          <div style={sec()}>Los 4 Perfiles del Comprador Bogotano</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,marginBottom:16}}>
            {[
              {p:"Inversionista Patrimonial",e:"35–60 años",pat:"$500K–$5M USD",tk:"$250K–$500K",mot:"Preservar capital, dolarizar, herencia",proy:"Bosco, Oceana, Ocean Reef",c:C.navy},
              {p:"Profesional HNW Joven",e:"30–45 años",pat:"$150K–$500K USD",tk:"$120K–$280K",mot:"Renta USD, plusvalía, visa panameña",proy:"Armonía, Panamá Viejo, Tides",c:C.blue},
              {p:"Family Office / Fondo",e:"Institución",pat:"$2M–$50M+ USD",tk:"$500K–$3M",mot:"Portafolio int'l, estructura FIP/SA",proy:"Múltiples unidades GLP",c:C.gold},
              {p:"Colombiano en el Exterior",e:"28–50 años",pat:"$120K–$350K USD",tk:"$120K–$350K",mot:"Activo dolarizado cerca de Colombia",proy:"Armonía, Playa Dorada, Tides",c:C.green},
            ].map((x,i)=>(
              <div key={i} style={card({borderTop:`3px solid ${x.c}`,marginBottom:0})}>
                <div style={{fontWeight:600,fontSize:13,color:x.c,marginBottom:8}}>{x.p}</div>
                {[["Edad",x.e],["Patrimonio",x.pat],["Ticket",x.tk],["Motivación",x.mot],["Proyectos",x.proy]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3,gap:8}}>
                    <span style={{color:"var(--color-text-secondary)",flexShrink:0}}>{k}</span>
                    <span style={{fontWeight:500,textAlign:"right"}}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={sec()}>Lo que Realmente Compra el Bogotano</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginBottom:16}}>
            {[
              {n:"Diversificación en USD",d:"Parte del portafolio fuera del COP. No es moda: es protección real ante devaluación, ciclos locales e incertidumbre regulatoria.",i:"💵"},
              {n:"Plan B familiar",d:"Segunda base, estudio de hijos, movilidad laboral. La residencia panameña ($300K, 30 días) es un habilitador crítico.",i:"🏠"},
              {n:"Renta en dólares",d:"7–9% anual en USD vs. 4.5–6% en Bogotá. Larga estancia (ejecutivos) o corta (turismo) según proyecto.",i:"📈"},
              {n:"Optimización fiscal inteligente",d:"No 'pagar menos impuestos' — evitar errores costosos y estructurar bien desde el inicio. Aquí entra Colombia Tax Law Group.",i:"⚖️"},
              {n:"Transferencia patrimonial",d:"Compradores 35–60: 'quiero dejar esto ordenado para mis hijos'. Si no lo resuelves, se enfrían. Si lo resuelves, cierras.",i:"🔐"},
              {n:"Equipo, no solo un producto",d:"El bogotano quiere sentir que tiene un equipo: legal, fiscal, pagos y cierre. El gancho es el acompañamiento total.",i:"🤝"},
            ].map((m,i)=>(
              <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:12,border:"0.5px solid var(--color-border-tertiary)"}}>
                <div style={{fontSize:16,marginBottom:6}}>{m.i}</div>
                <div style={{fontWeight:600,fontSize:12,color:C.navy,marginBottom:3}}>{m.n}</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.5}}>{m.d}</div>
              </div>
            ))}
          </div>

          <div style={sec()}>Colombia Tax Law Group — El Gancho Comercial (No el Discurso Técnico)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:16}}>
            {LEGAL_GANCHOS.map((g,i)=>(
              <div key={i} style={card({borderTop:`3px solid ${g.color}`,marginBottom:0})}>
                <div style={{fontWeight:600,fontSize:13,color:g.color,marginBottom:6}}>{g.titulo}</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.5,marginBottom:10}}>{g.desc}</div>
                {g.puntos.map((p,j)=>(
                  <div key={j} style={{display:"flex",gap:6,marginBottom:4,fontSize:11,alignItems:"flex-start"}}>
                    <span style={{color:C.green,fontWeight:700,flexShrink:0}}>✓</span>
                    <span style={{color:"var(--color-text-secondary)"}}>{p}</span>
                  </div>
                ))}
                <div style={{marginTop:10,background:`rgba(13,42,94,0.05)`,borderRadius:6,padding:"8px 10px",fontSize:11,color:g.color,fontWeight:600}}>{g.cta}</div>
              </div>
            ))}
          </div>

          <div style={sec()}>Evento "GLP Investment Evening" — Guía Operativa</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["Elemento","Especificación"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ["Nombre","GLP Investment Evening — Capital Brokers · Colombia Tax Law Group · Grupo Valverde"],
                ["Venue","Club El Nogal / Sofitel Bogotá / Casa Medina — sala VIP, máx. 60 personas"],
                ["Agenda","6:30 PM Cóctel → 7:00 PM Bienvenida Armando Hortua → 7:10 PM Presentación GLP (vocero Panamá) → 7:30 PM Juan José Giraldo: '¿Cómo invierto en Panamá sin sustos?' (gancho, no técnica) → 7:50 PM Testimonio cliente real → 8:00 PM Q&A → 8:20 PM Reuniones privadas 1-a-1 → 10:00 PM Cierre"],
                ["Invitados (60)","Red tripartita clientes actuales (20) + aliados firmados (15) + banca privada (10) + contadores tributarios (10) + red personal socios (5)"],
                ["Rol María Fernanda","Coordina logística, maneja CRM de asistentes, hace el seguimiento 48h post-evento a todos los leads"],
                ["Material en sala","Brochures GLP por proyecto (diseño GLP) + Guía del Inversionista + Calculadora retorno + QR microsite"],
                ["Presupuesto","USD $3,500 del fondo de eventos asignado (venue + catering + materiales). Diseño gráfico: GLP Panamá."],
                ["Gran Salón Corferias","20–23 agosto 2026 — stand pabellón internacional + agenda privada preagendada + equipo de cierre en sitio"],
              ].map((r,i)=>(
                <tr key={i}>
                  <td style={{...TD,fontWeight:500,color:C.navy,whiteSpace:"nowrap",minWidth:100}}>{r[0]}</td>
                  <td style={TD}>{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {/* ══ TAB 3: TABLERO KPI ════════════════════════════ */}
      {tab===3&&(<>
        <div style={card()}>
          <div style={{fontSize:20,fontWeight:500,color:C.navy,marginBottom:8}}>Tablero de Control KPI</div>
          <div style={{background:`rgba(26,79,174,0.05)`,borderLeft:`3px solid ${C.blue}`,padding:"10px 14px",borderRadius:"0 8px 8px 0",fontSize:12,marginBottom:16}}>
            <strong>Métrica reina Bogotá:</strong> caída por fricción fiscal/legal/pagos. Si ese indicador baja, el canal despega. María Fernanda reporta este tablero cada viernes a los tres socios.
          </div>

          {[
            {titulo:"Diario",kpis:[
              {n:"Leads nuevos",v:3,m:5,u:"",c:C.blue},
              {n:"Respuesta <5 min",v:100,m:100,u:"%",c:C.green},
              {n:"Citas agendadas",v:2,m:3,u:"",c:C.gold},
              {n:"Show-up rate",v:67,m:80,u:"%",c:C.navy},
            ]},
            {titulo:"Semanal",kpis:[
              {n:"Lead→Cita",v:18,m:25,u:"%"},
              {n:"Cita→Reserva",v:12,m:20,u:"%"},
              {n:"Caída por fricción",v:22,m:10,u:"%",inv:true},
              {n:"Cierres semana",v:1,m:2,u:""},
            ]},
            {titulo:"Mensual",kpis:[
              {n:"CAC estimado",v:4200,m:3500,u:"USD",inv:true},
              {n:"Cierres mes",v:2,m:3,u:""},
              {n:"Pipeline activo",v:18,m:25,u:"leads"},
              {n:"NPS clientes",v:72,m:70,u:"pts"},
            ]},
          ].map((grupo,gi)=>(
            <div key={gi}>
              <div style={sec()}>{grupo.titulo}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
                {grupo.kpis.map((k,i)=>(
                  <div key={i} style={mtc}>
                    <div style={{fontSize:22,fontWeight:500,color:k.c||(k.inv?C.red:C.blue)}}>{k.u==="USD"?"$"+fmt(k.v):fmt(k.v)}{k.u&&k.u!=="USD"&&k.u!=="leads"?" "+k.u:""}</div>
                    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2,marginBottom:4,lineHeight:1.4}}>{k.n.toUpperCase()}</div>
                    <Gauge val={k.v} meta={k.m} inv={k.inv}/>
                    <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>Meta: {k.u==="USD"?"$"+fmt(k.m):fmt(k.m)}{k.u&&k.u!=="USD"?" "+k.u:""}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={sec()}>Reunión Semanal del Equipo (viernes 4pm — María Fernanda + socios)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
            {[
              {t:"Agenda fija (30 min)",items:["Leads nuevos por canal esta semana","Top 3 leads calientes: próximo paso","Motivos de pérdida más frecuentes","Aliados: ¿quién refirió? ¿quién sigue quieto?","CRM al día: leads >14 días sin movimiento"]},
              {t:"Reglas de oro operativas",items:["SLA: toda consulta respondida en <5 min","Nadie promete rentabilidades específicas","Todo cierre al CRM dentro de 12 horas","Aliado que refiere cierre → pago en 48h","Post-feria: pipeline tiene vida útil de 10 días"]},
              {t:"Alertas automáticas",items:["Leads sin respuesta >7 días (escalar a socio)","Propuestas enviadas >14 días sin feedback","Aliados sin movimiento en el mes","Caída por fricción >30% del total pérdidas","Pipeline con valor >$500K sin avanzar"]},
            ].map((d,i)=>(
              <div key={i} style={card({marginBottom:0})}>
                <div style={{fontWeight:600,fontSize:12,color:C.navy,marginBottom:8}}>{d.t}</div>
                {d.items.map((item,j)=>(
                  <div key={j} style={{display:"flex",gap:6,marginBottom:4,fontSize:11,alignItems:"flex-start"}}>
                    <div style={{minWidth:5,height:5,borderRadius:"50%",background:C.gold,marginTop:4,flexShrink:0}}/>
                    <span style={{color:"var(--color-text-secondary)"}}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </>)}

      {/* ══ TAB 4: RED DE ALIADOS ══════════════════════════ */}
      {tab===4&&(<>
        <div style={card()}>
          <div style={{fontSize:20,fontWeight:500,color:C.navy,marginBottom:8}}>Red de Aliados — Sistema Completo</div>
          <div style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:12,maxWidth:700}}>
            5 aliados ya identificados (borde verde) · 3 tipos por construir (borde dorado). Haz clic en cualquiera para ver el perfil completo, la propuesta, el guión de contacto y los KPIs.
          </div>
          <div style={{background:`rgba(46,125,94,0.06)`,borderLeft:`3px solid ${C.green}`,padding:"10px 14px",borderRadius:"0 8px 8px 0",fontSize:12,marginBottom:16}}>
            <strong style={{color:C.green}}>Comisiones estándar:</strong> Corredor persona natural: <strong>1.0%</strong> · Firma profesional / institución: <strong>0.5%</strong> · Family office co-gestión: <strong>0.75%</strong> — todas sobre el valor de cierre, pagadas en USD dentro de 48h del cobro de comisión GLP.
          </div>
          {ALIADOS.map((a,i)=>(
            <div key={i} onClick={()=>setOpenAliado(openAliado===i?null:i)} style={{...card({marginBottom:10,cursor:"pointer",borderLeft:a.existe?`4px solid ${C.green}`:`4px solid ${C.gold}`,border:openAliado===i?`1.5px solid ${C.blue}`:"0.5px solid var(--color-border-tertiary)",borderLeftWidth:4,borderLeftColor:a.existe?C.green:C.gold})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{a.icono}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:C.navy}}>{a.tipo}</div>
                    <div style={{fontSize:11,color:"var(--color-text-secondary)",marginTop:1,maxWidth:500}}>{a.perfil.substring(0,90)}...</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                  <span style={tag(a.existe?"rgba(46,125,94,0.1)":"rgba(201,168,76,0.12)",a.existe?C.green:C.amber)}>{a.existe?"Identificado":"A construir"}</span>
                  <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>{openAliado===i?"▲":"▼"}</span>
                </div>
              </div>
              {openAliado===i&&(
                <div style={{marginTop:14,borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:11,color:C.blue,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Perfil completo</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.6,marginBottom:10}}>{a.perfil}</div>
                    <div style={{fontWeight:600,fontSize:11,color:C.blue,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Propuesta de valor para el aliado</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.6}}>{a.propuesta}</div>
                  </div>
                  <div>
                    <div style={{fontWeight:600,fontSize:11,color:C.blue,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Guión de contacto</div>
                    <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"10px 12px",fontSize:12,fontStyle:"italic",color:"var(--color-text-secondary)",lineHeight:1.6,marginBottom:10}}>{a.guion}</div>
                    <div style={{fontWeight:600,fontSize:11,color:C.blue,marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>SLA</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:8}}>{a.sla}</div>
                    <div style={{fontWeight:600,fontSize:11,color:C.blue,marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>KPI de seguimiento</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{a.kpi}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={card({background:"rgba(13,42,94,0.03)",marginBottom:0})}>
            <div style={{fontWeight:600,fontSize:13,color:C.navy,marginBottom:8}}>Kit del Aliado — Lo que recibe cada uno al firmar</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
              {["Carta oficial GLP + logo 'Representación Colombia'","Acuerdo de referidos firmado (comisión, plazo, condiciones)","Kit digital: brochures todos los proyectos GLP (diseño Panamá)","Guía del Inversionista Colombiano en Panamá (20 pág.)","Calculadora de retorno USD para compartir con sus clientes","Invitación permanente a GLP Investment Evening","Acceso al grupo WhatsApp de aliados GLP Bogotá","Sesión técnica Colombia Tax Law Group: 'DIAN 2026 — lo que su cliente necesita saber'"].map((item,i)=>(
                <div key={i} style={{display:"flex",gap:6,fontSize:11,alignItems:"flex-start"}}>
                  <span style={{color:C.green,fontWeight:700,flexShrink:0}}>✓</span>
                  <span style={{color:"var(--color-text-secondary)"}}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>)}

      {/* ══ TAB 5: PIEZAS PUBLICITARIAS ══════════════════ */}
      {tab===5&&(<>
        <div style={card()}>
          <div style={{fontSize:20,fontWeight:500,color:C.navy,marginBottom:8}}>Piezas Publicitarias — 8 Piezas Funcionales</div>
          <div style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:8}}>
            Diseño producido por GLP Panamá. Estas son las piezas listas para uso — haz clic en cualquiera para ver el detalle completo y el copy exacto.
          </div>
          <div style={{background:`rgba(46,125,94,0.06)`,borderLeft:`3px solid ${C.green}`,padding:"10px 14px",borderRadius:"0 8px 8px 0",fontSize:12,marginBottom:16}}>
            <strong style={{color:C.green}}>Brief para GLP Panamá:</strong> Toda pieza debe incluir logo GLP + texto "Representación oficial Colombia" + disclaimer "Proyecciones referenciales. No garantiza rendimientos." Paleta: navy #0d2a5e + gold #c9a84c + blanco.
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
          {ADS.map((ad,i)=>{
            const isLight=ad.tc!=="fff"&&ad.tc===C.navy;
            const open=openAd===i;
            return(
              <div key={i} onClick={()=>setOpenAd(open?null:i)} style={{background:ad.bg,borderRadius:16,overflow:"hidden",cursor:"pointer",border:open?`2px solid ${C.gold}`:"2px solid transparent",transition:"border .2s"}}>
                <div style={{padding:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:6}}>
                    <span style={{background:ad.badgeBg,color:ad.badgeC,padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:600,border:`0.5px solid ${ad.badgeC}44`}}>{ad.plat}</span>
                    <span style={{fontSize:10,color:ad.tc==="#fff"?"rgba(255,255,255,0.45)":"rgba(0,0,0,0.35)"}}>{ad.formato}</span>
                  </div>
                  <div style={{fontSize:16,fontWeight:500,color:ad.tc,lineHeight:1.3,marginBottom:10,whiteSpace:"pre-line"}}>{ad.titulo}</div>
                  {open&&(
                    <div style={{fontSize:12,color:ad.tc==="#fff"?"rgba(255,255,255,0.72)":"rgba(13,42,94,0.65)",lineHeight:1.6,marginBottom:14,whiteSpace:"pre-line"}}>{ad.cuerpo}</div>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginTop:open?0:8}}>
                    <div style={{background:ad.tc==="#fff"?"rgba(255,255,255,0.12)":C.navy,color:"#fff",padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:600,border:`1px solid ${C.gold}`,flexShrink:0}}>{ad.cta}</div>
                    <span style={{fontSize:10,color:ad.tc==="#fff"?"rgba(255,255,255,0.45)":"rgba(0,0,0,0.35)"}}>{open?"▲ cerrar":"▼ ver copy"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{...card(),marginTop:16}}>
          <div style={sec()}>Guión TikTok / Reels — 30 segundos (completo)</div>
          <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:16,fontSize:12,lineHeight:1.9,fontFamily:"monospace"}}>
            <div style={{color:C.gold,fontWeight:700,marginBottom:2}}>[0–5s] HOOK VISUAL</div>
            Skyline de Ciudad de Panamá al amanecer. Texto animado sobre pantalla: <em>"Colombia es el mayor inversor en finca raíz panameña. ¿Tú ya lo sabes?"</em><br/><br/>
            <div style={{color:C.gold,fontWeight:700,marginBottom:2}}>[5–15s] EL DATO QUE LO CAMBIA TODO</div>
            Voz en off (María Fernanda): <em>"USD 208 millones de capital colombiano fluyeron a Panamá en solo un trimestre. El dinero inteligente ya se movió. Y lo hizo con rentabilidades de hasta 9% anual en dólares."</em><br/><br/>
            <div style={{color:C.gold,fontWeight:700,marginBottom:2}}>[15–25s] LA SOLUCIÓN — SIN TECNICISMOS</div>
            <em>"Somos la representación oficial de Grupo Los Pueblos en Bogotá. Cuarenta años construyendo Panamá — el mall más grande de Latinoamérica, las primeras islas artificiales del Pacífico. Nosotros te llevamos de la mano: sin sustos con la DIAN, sin sorpresas bancarias, todo en orden desde aquí."</em><br/><br/>
            <div style={{color:C.gold,fontWeight:700,marginBottom:2}}>[25–30s] CTA</div>
            <em>"Comenta PANAMÁ y te enviamos la Guía del Inversionista Colombiano. Sin costo. Sin compromiso."</em>
          </div>

          <div style={sec()}>Calendario Editorial LinkedIn — 8 Semanas</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["Semana","Autor","Formato","Copy gancho"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ["S1","Armando Hortua","Artículo 1,200 palabras","5 razones por las que el inversionista bogotano debería tener activos en Panamá en 2026"],
                ["S2","María Fernanda","Post personal","Dejé Expocredit para hacer esto. Y no me arrepiento. (Historia de por qué GLP)"],
                ["S3","Capital Brokers","Carrusel 8 slides","Comparativo real: rentabilidad Bogotá vs Panamá. Los números que nadie te dice."],
                ["S4","GLP (video)","Video tour proyecto","Tour virtual Armonía Cinta Costera — el proyecto GLP con mejor renta sobre precio de entrada."],
                ["S5","Juan José Giraldo","Post artículo","'Invierta en Panamá sin sustos con la DIAN' — Colombia Tax Law Group explica sin tecnicismos."],
                ["S6","María Fernanda","Encuesta LinkedIn","¿Ya tiene activos dolarizados fuera de Colombia? Sí / No, pero me interesa / No lo he considerado"],
                ["S7","Carlos Joya","Post relacional","Cómo construimos la red de aliados GLP en Bogotá — y por qué necesitábamos a Colombia Tax Law Group."],
                ["S8","Armando Hortua","Caso real (con permiso)","Cómo un empresario bogotano estructuró su inversión de $200K en Panamá en 60 días."],
              ].map((r,i)=>(
                <tr key={i}>
                  <td style={{...TD,fontWeight:700,color:C.navy,whiteSpace:"nowrap"}}>{r[0]}</td>
                  <td style={{...TD,fontSize:11,color:C.blue,whiteSpace:"nowrap"}}>{r[1]}</td>
                  <td style={{...TD,fontSize:11,whiteSpace:"nowrap"}}>{r[2]}</td>
                  <td style={TD}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {tab===7&&(<><PortafolioGLP/></>)}
      {tab===8&&(<><ProspectosCRM/></>)}
      {tab===9&&(<><PresupuestoEventos/></>)}
      {tab===10&&(<><BrokersModule/></>)}
      {tab===11&&(<><AgentesIA/></>)}

      {/* ══ TAB 6: CALCULADORA ══ */}
      {tab===6&&(<>
        <div style={card()}>
          <div style={{fontSize:20,fontWeight:500,color:C.navy,marginBottom:6}}>Calculadora de Retorno — Herramienta para Reuniones</div>
          <div style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:20}}>
            Usa esta herramienta en reuniones presenciales o virtuales con clientes. María Fernanda la muestra en cita; Colombia Tax Law Group la complementa con la estructura legal correcta.
          </div>
          <CalcROI/>
        </div>

        <div style={card()}>
          <div style={sec()}>Flujo Legal Colombia → Panamá — Lenguaje Comercial</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:16}}>
            {[
              {n:"Paso 1","t":"Estructura receptora en Panamá",d:"Abrimos una sociedad panameña a su nombre. Rápido, económico, legal. Colombia Tax Law Group coordina todo con nuestro abogado aliado en Panamá.",c:C.navy},
              {n:"Paso 2","t":"Sus dólares viajan bien",d:"Le acompañamos en el proceso bancario: declaración de cambio, banco aliado con FX, transferencia limpia. Sin sorpresas.",c:C.blue},
              {n:"Paso 3","t":"La DIAN no le da sustos",d:"Formulario 160 — solo informativo, no genera impuestos adicionales. Colombia Tax Law Group lo gestiona. Su contador queda tranquilo.",c:C.gold},
              {n:"Paso 4","t":"Firma y a generar renta",d:"Promesa de compraventa con GLP, proceso de cierre acompañado, y su activo empieza a rentar en USD. María Fernanda sigue su caso.",c:C.green},
              {n:"Paso 5","t":"Residencia panameña (opcional)",d:"Si invierte desde $300K, puede solicitar residencia en 30 días de forma remota. Colombia Tax Law Group + abogado Panamá lo tramitan.",c:C.light},
            ].map((p,i)=>(
              <div key={i} style={{borderLeft:`3px solid ${p.c}`,paddingLeft:12,paddingRight:8,paddingTop:12,paddingBottom:12,background:"var(--color-background-secondary)",borderRadius:"0 8px 8px 0"}}>
                <div style={{fontSize:9,color:p.c,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{p.n}</div>
                <div style={{fontWeight:600,fontSize:12,color:C.navy,marginBottom:4}}>{p.t}</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.5}}>{p.d}</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(201,168,76,0.07)",borderLeft:`4px solid ${C.gold}`,padding:"12px 16px",borderRadius:"0 8px 8px 0",fontSize:12,lineHeight:1.7}}>
            <strong>Ventajas tributarias Panamá (lenguaje cliente):</strong> Lo que gana en Panamá solo tributa en Panamá — y los proyectos nuevos de GLP tienen cero predial por 20 años. Si vende y gana, paga el 2% (no el 15% que pagaría en Colombia). Sus costos de escrituración son del 2–3%, y GLP puede absorber parte en promociones.
          </div>

          <div style={sec()}>Próximos Pasos — Esta Semana</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["Acción","Responsable","Deadline","Resultado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ["Firma definitiva contrato representación GLP","A. Hortua + J.J. Giraldo","Esta semana","Canal habilitado oficialmente"],
                ["Onboarding María Fernanda: CRM + guiones + portafolio GLP","A. Hortua / C. Joya","Semana 1–2","Líder comercial operativa desde día 1"],
                ["Formalizar acuerdo de referidos con 5 aliados ya identificados","C. Joya + A. Hortua","Semana 1–2","Red base activa desde mes 1"],
                ["Solicitar a GLP portafolio 2026 + materiales actualizados","A. Hortua","Tras firma","Material listo para presentaciones"],
                ["Brief a GLP Panamá: 8 piezas publicitarias Colombia","A. Hortua","Semana 2","Diseño en producción en Panamá"],
                ["Activar CRM: cargar 5 aliados + primeros 30 leads tripartita","María Fernanda","Semana 2–3","Pipeline organizado desde el inicio"],
                ["Sesión técnica Colombia Tax Law Group para aliados (DIAN 2026)","J.J. Giraldo","Mes 2","Aliados capacitados y confiados"],
                ["Definir venue y fecha GLP Investment Evening (mes 5)","C. Joya + A. Hortua","Mes 2","Evento agendado en calendarios de aliados"],
              ].map((r,i)=>(
                <tr key={i}>
                  <td style={{...TD,fontWeight:500}}>{r[0]}</td>
                  <td style={{...TD,fontSize:11,color:"var(--color-text-secondary)"}}>{r[1]}</td>
                  <td style={{...TD,color:i<2?C.red:C.gold,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{r[2]}</td>
                  <td style={{...TD,fontSize:11,color:C.blue}}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

        </div>{/* end content area */}

        {/* RIGHT SIDEBAR NAV */}
        <div style={{width:190,flexShrink:0,background:C.navy,overflowY:"auto",display:"flex",flexDirection:"column",boxShadow:"-2px 0 16px rgba(0,0,0,0.22)"}}>
          <div style={{padding:"14px 12px 6px",fontSize:9,color:"rgba(255,255,255,0.35)",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>PLATAFORMA GLP</div>
          {TABS.map((t,i)=>(
            <button key={i} onClick={()=>setTab(i)} style={{
              display:"block",width:"100%",textAlign:"left",
              padding:"9px 14px",border:"none",cursor:"pointer",
              fontSize:11,fontWeight:tab===i?700:400,
              background:tab===i?`linear-gradient(90deg,${C.gold},${C.amber})`:`transparent`,
              color:tab===i?C.navy:"rgba(255,255,255,0.72)",
              borderLeft:tab===i?`3px solid #fff`:"3px solid transparent",
              transition:"all .15s",lineHeight:1.35,
            }}>{t}</button>
          ))}
          <div style={{flex:1}}/>
          <div style={{padding:"10px 12px",borderTop:"0.5px solid rgba(255,255,255,0.08)",fontSize:9,color:"rgba(255,255,255,0.28)",lineHeight:1.7}}>
            GLP Bogotá Platform v2.0<br/>
            Antigravity AI · Gemini 2.5<br/>
            © 2026 Capital Brokers SAS
          </div>
        </div>

      </div>{/* end flex layout */}
    </div>
  );
}
