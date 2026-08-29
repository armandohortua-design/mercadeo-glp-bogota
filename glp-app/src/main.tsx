import React from 'react'
import ReactDOM from 'react-dom/client'
import { C, PROJECTS, PROJECT_IMG, Project, SEPARACION_PROYECTOS_DEFAULT, SeparacionProyectosTabla, getSeparacionProyecto } from './projectsData'
import { ProjectDetailView } from './projectDetail'
import { API_ROOT } from './apiRoot'
import { getImageFor, fetchLiveProjectImages } from './liveProjectImages'
import { applyUnidadesToProjects } from './unidadesOverride'

// Antes se insertaba directo al cliente de Supabase (RLS + errores silenciosos). Ahora
// pasa por el backend, que registra el clic por faq_id real — no se puede desincronizar
// por texto porque no compara texto en absoluto.
const trackFaqClick = (faqId: number | undefined) => {
  if (!faqId) return; // FAQ del respaldo fijo (sin id real) — no hay nada que registrar
  fetch(`${API_ROOT}/api/faq-clicks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faq_id: faqId, source: 'landing' }),
  }).catch(() => {});
};

// FAQ_DATA_FALLBACK: contenido fijo por si el backend no responde (la landing es pública y
// no puede depender de que el CRM esté arriba). Cuando el fetch a /api/faqs funciona, ese
// contenido reemplaza a este — así landing y CRM comparten EXACTAMENTE el mismo texto de
// pregunta, y los clics reales de la landing sí se pueden cruzar con las FAQs del CRM para
// contar "Más Consultadas" (antes tenían textos redactados por separado y nunca coincidían).

/* """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
   GLP  Grupo Los Pueblos · Landing Page
   Tropical Calm palette · Spanish · All inline styles
   """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""" */

// ────────────────────────────────────────────────────────
type FAQ = { q: string; a: string; id?: number }
type FAQCategory = { title: string; icon: string; items: FAQ[] }

const FAQ_DATA_FALLBACK: FAQCategory[] = [
  {
    title: 'Estabilidad Macroeconómica',
    icon: '\u{1F3DB}\u{FE0F}',
    items: [
      { q: '¿Es estable la economía de Panamá?', a: 'Panamá ha mantenido un crecimiento promedio del PIB de 5.5 % anual durante las últimas dos décadas, ubicándose como una de las economías más dinámicas de América Latina. Su posición geográfica estratégica, el Canal de Panamá y su condición de hub financiero internacional le brindan una base económica diversificada y resiliente. El Fondo Monetario Internacional proyecta un crecimiento sostenido por encima del 4 % para los próximos años, respaldado por inversión en infraestructura y logística.' },
      { q: '¿Qué moneda usa Panamá?', a: 'Panamá utiliza el dólar estadounidense (USD) como moneda de curso legal desde 1904. El balboa, la moneda local, existe únicamente en denominaciones de monedas y mantiene paridad 1:1 con el dólar. Para el inversionista extranjero, esto significa que sus rentas, plusvalías y patrimonio están denominados en la divisa más líquida del mundo, eliminando por completo el riesgo de devaluación cambiaria de la moneda local.' },
      { q: '¿Hay riesgo de devaluación?', a: 'No existe riesgo de devaluación cambiaria en Panamá porque el país no tiene moneda propia que pueda depreciarse: opera directamente en dólares estadounidenses. Invertir en Panamá ofrece protección total contra la volatilidad cambiaria. Su renta, su plusvalía y su patrimonio estarán siempre respaldados en dólares.' },
      { q: '¿Cómo afecta el Canal a la economía?', a: 'El Canal de Panamá genera ingresos anuales superiores a USD $4,000 millones y convierte al país en el hub logístico más importante de las Américas. Atrae inversión extranjera directa en logística, banca, zona libre de Colón y servicios marítimos. Esta infraestructura de clase mundial impulsa la demanda de vivienda ejecutiva y genera un flujo constante de expatriados y ejecutivos internacionales que necesitan alquilar propiedades premium.' },
      { q: '¿Hay control de cambios en Panamá?', a: 'No. Panamá no tiene control de cambios, lo que significa que usted puede mover su capital libremente dentro y fuera del país sin restricciones gubernamentales. No necesita autorización para repatriar rentas, dividendos o el producto de una venta inmobiliaria. Esta libertad cambiaria contrasta significativamente con otros países de la región y es uno de los principales atractivos para el inversionista internacional.' },
      { q: '¿Cuál es la calificación crediticia del país?', a: 'Panamá cuenta con grado de inversión otorgado por las tres principales calificadoras internacionales: Fitch (BBB), Moody\'s (Baa2) y S&P (BBB). Esta calificación refleja la solidez fiscal del país, su estabilidad política y la confianza de los mercados internacionales. El grado de inversión facilita el acceso a financiamiento en condiciones favorables tanto para el gobierno como para los desarrolladores inmobiliarios.' },
      { q: '¿Hay riesgo político significativo?', a: 'Panamá es una democracia consolidada con transiciones de poder pacíficas desde 1989. El país cuenta con un sistema judicial independiente, respeto a la propiedad privada extranjera y tratados de protección de inversiones con múltiples países. La estabilidad política se refleja en la constante llegada de inversión extranjera directa y en la presencia de sedes regionales de multinacionales que eligen Panamá como base de operaciones.' },
      { q: '¿Cómo es la inflación en Panamá?', a: 'La inflación en Panamá históricamente se mantiene muy baja, por debajo del 2 % anual. Al estar dolarizado, el país cuenta con gran estabilidad en los costos de construcción, arriendos y gastos operativos de las propiedades, lo que protege el poder adquisitivo de su inversión a largo plazo.' },
    ],
  },
  {
    title: 'Financiero y Retornos',
    icon: '\u{1F4CA}',
    items: [
      { q: '¿Qué rentabilidad puedo esperar?', a: 'Los proyectos GLP ofrecen rentabilidades brutas entre 5.0 % y 12.0 % anual dependiendo del segmento. Los proyectos urbanos premium generan cap rates de 5.07.0 % con baja vacancia, mientras que los proyectos de playa con operación Airbnb pueden alcanzar hasta 12 %. Adicionalmente, la valorización histórica en zonas prime de Panamá oscila entre 3 % y 5.5 % anual, lo que eleva el retorno total de la inversión significativamente.' },
      { q: '¿Cuánto cuesta una propiedad GLP?', a: 'El portafolio GLP ofrece opciones desde USD $120,000 en proyectos de renta urbana como Panamá Viejo Residences, hasta USD $1,500,000 en desarrollos ultra-lujo como Ocean Reef Park. El precio medio del portafolio se ubica alrededor de USD $350,000, con opciones de financiamiento que reducen la cuota inicial al 30 %. Cada proyecto está diseñado para un perfil de inversionista específico, desde el que busca flujo de caja hasta el que prioriza preservación patrimonial.' },
      { q: '¿Puedo financiar la compra como extranjero?', a: 'Sí. Los bancos panameños como Banco General, BAC y Banistmo ofrecen hipotecas a extranjeros con tasas desde 5.5 % hasta 8.5 % anual en USD, con plazos de 15 a 30 años. Generalmente se requiere un enganche del 30 % del valor de la propiedad, comprobantes de ingresos y referencias bancarias. GLP facilita el proceso de precalificación bancaria y trabaja con brokers hipotecarios que agilizan la aprobación para inversionistas extranjeros.' },
      { q: '¿Qué costos de cierre debo considerar?', a: 'Los costos de cierre en Panamá típicamente representan entre 3 % y 5 % del valor de la propiedad. Incluyen: impuesto de transferencia (2 %), gastos notariales (0.51 %), registro público (0.3 %), honorarios legales (1 %) y gastos bancarios si hay hipoteca. Estos costos son altamente competitivos a nivel internacional. GLP proporciona un desglose transparente de todos los costos antes de la firma.' },
      { q: '¿Cuánto tarda en arrendarse una propiedad GLP?', a: 'La velocidad de arrendamiento varía por proyecto y ubicación. Las propiedades urbanas premium en Punta Pacífica y Santa María se arriendan en 0.5 a 2 meses gracias a la alta demanda de ejecutivos internacionales. Los proyectos de playa tienen ciclos de 2 a 3.5 meses. GLP cuenta con alianzas con operadores de property management que garantizan exposición en plataformas internacionales, mostraciones profesionales y contratos estandarizados.' },
      { q: '¿Quién administra la propiedad?', a: 'GLP trabaja con operadores de property management certificados que se encargan de la administración integral: búsqueda de inquilinos, cobro de rentas, mantenimiento preventivo, atención de emergencias y reportes mensuales al propietario. El costo del servicio oscila entre 8 % y 12 % de la renta mensual, dependiendo del nivel de servicio. Usted recibe un dashboard digital con el estado de su inversión en tiempo real.' },
      { q: '¿En qué moneda recibo la renta?', a: 'Todas las rentas se cobran, reciben y depositan en dólares estadounidenses (USD). Usted puede elegir recibir los pagos en una cuenta bancaria panameña o transferirlos a su cuenta local. Al estar en dólares, su ingreso no pierde valor por devaluaciones monetarias. GLP facilita la apertura de cuentas bancarias en Panamá para optimizar la recepción de rentas y reducir costos de transferencia internacional.' },
    ],
  },
  {
    title: 'Fiscal',
    icon: '\u{1F9FE}',
    items: [
      { q: '¿Cuánto es el impuesto predial en Panamá?', a: 'Las propiedades nuevas en Panamá gozan de una exoneración total del impuesto predial (Impuesto de Inmuebles) por un período de 10 a 20 años, dependiendo del tipo de proyecto. Para proyectos con beneficio de interés social o preferencial, la exoneración puede extenderse hasta 20 años. Después del período de exoneración, las tasas oscilan entre 0.5 % y 1 % del valor catastral, que suele ser significativamente menor que el valor de mercado.' },
      { q: '¿Cuánto es el impuesto a la ganancia de capital?', a: 'En Panamá, la ganancia de capital en venta de bienes raíces tributa al 10 % sobre la ganancia neta, con una retención en fuente del 3 % sobre el precio de venta total al momento de la transacción. Esta estructura fiscal competitiva facilita la realización de utilidades de forma predecible. GLP recomienda mantener documentación detallada de mejoras y costos asociados para optimizar la base imponible al momento de la venta.' },
      { q: '¿Hay retención en fuente sobre las rentas?', a: 'En Panamá, las rentas de alquiler para personas naturales no residentes están sujetas a una retención del 12.5 % sobre el ingreso bruto de arrendamiento. Sin embargo, existe la opción de elegir tributar como si fuera residente, aplicando una tasa progresiva sobre la renta neta (después de deducciones), lo cual puede resultar más favorable.' },
      { q: '¿Necesito un contador en Panamá?', a: 'Si bien no es legalmente obligatorio, GLP recomienda enfáticamente contar con un contador panameño para optimizar su carga tributaria, presentar declaraciones locales si aplica, y mantener registros ordenados de ingresos y gastos. El costo de un servicio contable básico en Panamá oscila entre USD $150 y $300 mensuales. GLP tiene alianza con firmas contables que ofrecen tarifas preferenciales para inversionistas del portafolio.' },
      { q: '¿Hay beneficios fiscales para inversionistas extranjeros?', a: 'Sí. Panamá ofrece múltiples incentivos: exoneración de impuesto predial por hasta 20 años en propiedades nuevas, régimen fiscal territorial (solo grava ingresos de fuente panameña), no hay impuesto sobre herencias ni donaciones, y las sociedades anónimas panameñas no pagan impuestos sobre ingresos de fuente extranjera. Adicionalmente, ciertos regímenes especiales como las Sedes de Empresas Multinacionales (SEM) ofrecen beneficios adicionales para quienes establecen operaciones en el país.' },
    ],
  },
  {
    title: 'Migratorio',
    icon: '\u{1F6C2}',
    items: [
      { q: '¿Necesito visa para comprar propiedad en Panamá?', a: 'No. Los ciudadanos extranjeros no necesitan visa para ingresar a Panamá como turistas (hasta 180 días) ni para adquirir bienes raíces. La compra de propiedad se puede realizar con pasaporte vigente y no requiere estatus migratorio especial. Sin embargo, si desea establecer residencia permanente, la inversión inmobiliaria es precisamente una de las vías más directas para obtenerla.' },
      { q: '¿Qué es la residencia por inversión inmobiliaria?', a: 'El Permiso de Residencia por Inversión Calificada permite a extranjeros que inviertan un mínimo de USD $300,000 en bienes raíces en Panamá obtener residencia permanente. Este permiso se otorga a nombre propio y cubre dependientes (cónyuge e hijos menores). La residencia es permanente desde el primer día y no requiere presencia física continua. Después de 5 años de residencia, se puede aplicar a la ciudadanía panameña si se desea.' },
      { q: '¿Cuánto cuesta tramitar la residencia?', a: 'Los costos del trámite de residencia por inversión oscilan entre USD $5,000 y $8,000, incluyendo: honorarios del abogado de inmigración (USD $3,000$5,000), tasas gubernamentales (USD $800$1,200), autenticaciones, apostillas y traducciones de documentos. El proceso toma entre 3 y 6 meses. GLP trabaja con Colombia Law Group, firma de inmigración y asesoría legal especializada, que ofrece tarifas preferenciales y acompañamiento integral a los inversionistas.' },
      { q: '¿Puedo trabajar en Panamá con la residencia por inversión?', a: 'La residencia por inversión calificada permite trabajar de forma independiente en Panamá (negocios propios, freelance, consultoría). Si desea trabajar como empleado de una empresa panameña, necesitará un permiso de trabajo adicional, que la empresa empleadora tramita. Muchos inversionistas extranjeros optan por mantener sus negocios en sus países de origen y usar la residencia panameña para beneficios fiscales, bancarios y de estilo de vida.' },
      { q: '¿Mis hijos pueden estudiar en Panamá?', a: 'Sí. Los hijos de residentes tienen acceso a todo el sistema educativo panameño, tanto público como privado. Panamá cuenta con colegios internacionales de alto nivel como el International School of Panama, King\'s College, y el Balboa Academy, con currículos IB, americano y británico. Las universidades incluyen sedes de Florida State University, INCAE y la Universidad de Louisville. La residencia facilita la matrícula y el acceso a becas.' },
      { q: '¿El trámite de residencia puede hacerse de forma remota?', a: 'El proceso de residencia requiere al menos una visita presencial a Panamá para la entrevista migratoria y la toma de datos biométricos. Sin embargo, gran parte de la preparación documental (recopilación, apostillas, traducciones) puede realizarse desde su país de origen. Colombia Law Group, aliado legal y migratorio de GLP, coordina todo el proceso para que la visita presencial sea lo más breve posible, generalmente 35 días hábiles son suficientes.' },
      { q: '¿Cómo funciona el proceso de naturalización?', a: 'Después de 5 años de residencia permanente en Panamá, un extranjero puede iniciar el proceso de naturalización para obtener la ciudadanía panameña. Los requisitos incluyen examen básico de español, conocimientos de geografía y cultura panameña, y demostrar solvencia económica. La ciudadanía panameña otorga un pasaporte con acceso libre de visa a más de 140 países.' },
    ],
  },
];


const fmt = (n: number) => {
  const rounded = Math.round(n);
  return (rounded < 0 ? '-' : '') + '$' + Math.abs(rounded).toLocaleString('en-US');
};

const formatComma = (num: number) => {
  if (num === 0) return '0';
  if (!num) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const smoothScroll = (id: string) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ────────────────────────────────────────────────────────
const gradientMap: Record<string, string[]> = {
  patrimonial: [
    'linear-gradient(135deg, #8A5A36 0%, #1F618D 100%)',
    'linear-gradient(135deg, #2E7D32 0%, #8A5A36 100%)',
    'linear-gradient(135deg, #1F618D 0%, #2E7D32 100%)',
    'linear-gradient(135deg, #8A5A36 0%, #2E7D32 50%, #1F618D 100%)',
    'linear-gradient(135deg, #1F618D 0%, #8A5A36 100%)',
  ],
  disfrute: [
    'linear-gradient(135deg, #C05C3E 0%, #F5E6D3 100%)',
    'linear-gradient(135deg, #C05C3E 0%, #2E7D32 100%)',
    'linear-gradient(135deg, #F5E6D3 0%, #C05C3E 100%)',
    'linear-gradient(135deg, #C05C3E 0%, #1F618D 100%)',
  ],
  renta: [
    'linear-gradient(135deg, #2E7D32 0%, #F5E6D3 100%)',
    'linear-gradient(135deg, #8A5A36 0%, #F5E6D3 100%)',
    'linear-gradient(135deg, #2E7D32 0%, #1F618D 100%)',
    'linear-gradient(135deg, #1F618D 0%, #F5E6D3 100%)',
    'linear-gradient(135deg, #2E7D32 0%, #C05C3E 50%, #F5E6D3 100%)',
    'linear-gradient(135deg, #8A5A36 0%, #2E7D32 100%)',
  ],
}

const getGradient = (type: string, idx: number) => {
  const arr = gradientMap[type] || gradientMap.patrimonial
  return arr[idx % arr.length]
}

// ────────────────────────────────────────────────────────
const AnimatedCounter: React.FC<{ end: number; suffix: string; prefix?: string; label: string; decimals?: number }> = ({ end, suffix, prefix = '', label, decimals = 0 }) => {
  const [count, setCount] = React.useState(0)
  const ref = React.useRef<HTMLDivElement>(null)
  const started = React.useRef(false)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 2000
          const steps = 60
          const stepTime = duration / steps
          const increment = end / steps
          let current = 0
          const timer = setInterval(() => {
            current += increment
            if (current >= end) { current = end; clearInterval(timer) }
            setCount(current)
          }, stepTime)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end])

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', fontWeight: 800, color: C.white, lineHeight: 1.2 }}>
        {prefix}{decimals > 0 ? count.toFixed(decimals) : Math.floor(count)}{suffix}
      </div>
      <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState('inicio')

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  React.useEffect(() => {
    const ids = ['inicio', 'projects', 'why-panama', 'trayectoria', 'testimonios', 'faq', 'contact']
    const sections = ids.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    )
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const linkStyle: React.CSSProperties = {
    color: scrolled ? C.text : C.white,
    textDecoration: 'none',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontFamily: C.fontSans,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    padding: '6px 0',
    borderBottom: '1px solid transparent',
  }

  // Mismo orden en que aparecen las secciones al hacer scroll — antes el menú
  // listaba Nosotros antes que Proyectos aunque en la página Proyectos ya aparecía
  // primero, así que un clic en el nav no coincidía con lo que el scroll mostraba.
  const links = [
    { label: 'Inicio', target: 'inicio' },
    { label: 'Proyectos', target: 'projects' },
    { label: '¿Por qué Panamá?', target: 'why-panama' },
    // Apunta a "trayectoria" (la historia de GLP), no a "nosotros" (que en realidad
    // es la sección de aliados — Capital Brokers, Colombia Law Group). El nav decía
    // "Nosotros" pero aterrizaba directo en Capital Brokers, sin que GLP apareciera.
    { label: 'Nosotros', target: 'trayectoria' },
    { label: 'FAQ', target: 'faq' },
    { label: 'Contacto', target: 'contact' },
  ]

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? 'rgba(255, 255, 255, 0.85)' : C.teal,
      backdropFilter: scrolled ? 'blur(10px)' : 'none',
      boxShadow: scrolled ? '0 1px 15px rgba(0,0,0,0.05)' : '0 1px 15px rgba(0,0,0,0.15)',
      borderBottom: scrolled ? `1px solid ${C.sand}` : 'none',
      transition: 'all 0.4s ease',
      padding: scrolled ? '14px 0' : '24px 0',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo — marca "GLP" (Grupo Los Pueblos) reemplazada por Capital Brokers
            Properties. Solo texto en la landing (sin isotipo), a pedido del usuario. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: scrolled ? C.text : C.white, fontFamily: C.fontSerif, letterSpacing: '0.03em', lineHeight: 1.2, transition: 'color 0.3s' }}>
              Capital Brokers Properties
            </div>
            <div style={{ fontSize: '0.65rem', color: scrolled ? C.textSec : 'rgba(255,255,255,0.7)', letterSpacing: '0.18em', fontFamily: C.fontSans, textTransform: 'uppercase', transition: 'color 0.3s', marginTop: 2 }}>
              Real Estate · Panamá
            </div>
          </div>
        </div>

        {/* Desktop Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="nav-links-desktop">
          {links.map(l => {
            const active = activeSection === l.target
            // Sobre la foto (sin scroll) el rojo corporativo (#A6192E, oscuro) se pierde
            // contra fondos igual de oscuros — se sube a un rojo más claro/saturado solo
            // en ese estado, y se añade una placa oscura translúcida detrás para
            // garantizar contraste sin depender del tono de la foto de fondo. Sobre
            // blanco (scrolled) el rojo corporativo ya se lee bien tal cual.
            const activeColor = scrolled ? C.red : '#FF6B5B'
            return (
              <a key={l.target} style={{
                ...linkStyle,
                color: active ? activeColor : linkStyle.color,
                borderBottomColor: active ? activeColor : 'transparent',
                background: active && !scrolled ? 'rgba(0,20,45,0.35)' : 'transparent',
                padding: active && !scrolled ? '6px 10px' : linkStyle.padding,
                borderRadius: active && !scrolled ? 4 : 0,
                textShadow: active && !scrolled ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
              }} onClick={() => smoothScroll(l.target)}
                onMouseEnter={e => {
                  e.currentTarget.style.color = scrolled ? C.red : '#FF6B5B';
                  e.currentTarget.style.borderBottomColor = scrolled ? C.red : '#FF6B5B';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = active ? activeColor : (scrolled ? C.text : C.white);
                  e.currentTarget.style.borderBottomColor = active ? activeColor : 'transparent';
                }}>
                {l.label}
              </a>
            )
          })}
          {/* Mismo look que el resto de los links (sin recuadro) — antes eran botones
              con borde, un estilo distinto al de Inicio/Nosotros/Proyectos/etc. */}
          <a href="/portal.html" style={linkStyle}
            onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.borderBottomColor = C.red; }}
            onMouseLeave={e => { e.currentTarget.style.color = scrolled ? C.text : C.white; e.currentTarget.style.borderBottomColor = 'transparent'; }}>
            Portal Clientes
          </a>
          {/* Antes era un botón flotante circular fijo en la esquina inferior — se
              integra como una opción más del menú principal. */}
          <a href="/crm.html" target="_blank" rel="noopener noreferrer" style={linkStyle}
            onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.borderBottomColor = C.red; }}
            onMouseLeave={e => { e.currentTarget.style.color = scrolled ? C.text : C.white; e.currentTarget.style.borderBottomColor = 'transparent'; }}>
            Intranet
          </a>
        </div>

        {/* Mobile Hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)} style={{
          display: 'none', background: 'none', border: 'none', cursor: 'pointer',
          padding: 8, fontSize: '1.5rem', color: scrolled ? C.text : C.white,
        }} className="nav-hamburger">
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: C.white, boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
          borderBottom: `1px solid ${C.sand}`,
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {links.map(l => (
            <a key={l.target} style={{ ...linkStyle, color: activeSection === l.target ? C.red : C.text, fontSize: '0.8rem' }} onClick={() => { smoothScroll(l.target); setMenuOpen(false) }}>
              {l.label}
            </a>
          ))}
          <a href="/portal.html" style={{ ...linkStyle, color: C.text, fontSize: '0.8rem' }}>
            Portal Clientes
          </a>
          <a href="/crm.html" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, color: C.text, fontSize: '0.8rem' }}>
            Intranet
          </a>
        </div>
      )}

      {/* Responsive Styles injected via style tag */}
      <style>{`
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: block !important; }
        }
      `}</style>
    </nav>
  )
}
// ────────────────────────────────────────────────────────
const Hero: React.FC<{ onSearch: (f: { category: string; price: string; beds: string }) => void }> = ({ onSearch }) => {
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => { setTimeout(() => setVisible(true), 100) }, [])

  const [searchCategory, setSearchCategory] = React.useState('todos')
  const [searchPrice, setSearchPrice] = React.useState('todos')
  const [searchBeds, setSearchBeds] = React.useState('todos')

  const runSearch = () => {
    onSearch({ category: searchCategory, price: searchPrice, beds: searchBeds })
    smoothScroll('projects')
  }

  return (
    <section id="inicio" style={{
      minHeight: '100vh',
      // Overlay más claro que antes (la foto se veía muy oscura) — se mantiene una
      // franja más oscura solo en los primeros ~160px (zona del nav) para que el menú
      // siga siendo legible sin depender del tono de la foto de fondo.
      backgroundImage: `linear-gradient(180deg, rgba(0, 20, 45, 0.45) 0px, rgba(0, 35, 73, 0.12) 160px, rgba(0, 35, 73, 0.16) 100%), url(/img/beachfront_residence_families.png)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      position: 'relative', overflow: 'hidden', padding: '120px 24px 80px',
    }}>
      {/* Decorative lines / frame accents */}
      <div style={{
        position: 'absolute', top: 30, left: 30, bottom: 30, right: 30,
        border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none',
        zIndex: 1,
      }} />

      <div style={{
        maxWidth: 900, textAlign: 'center', position: 'relative', zIndex: 2,
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'all 1s ease',
      }}>
        <div style={{
          display: 'inline-block', background: 'rgba(255,255,255,0.08)',
          borderRadius: 0, padding: '8px 24px', marginBottom: 28,
          backdropFilter: 'blur(10px)', border: '1.5px solid rgba(255,255,255,0.18)',
        }}>
          <span style={{ color: C.white, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: C.fontSans }}>
            40+ años construyendo patrimonio en Panamá
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(2.4rem, 5vw, 4.2rem)', fontWeight: 400,
          color: C.white, lineHeight: 1.15, margin: '0 0 24px',
          letterSpacing: '0.01em', fontFamily: C.fontSerif,
          textShadow: '0 2px 16px rgba(0,20,45,0.45)',
        }}>
          Invierte en Panamá.<br />
          <span style={{ fontStyle: 'italic', color: C.red, fontWeight: 600, textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>
            Rentabilidad en USD.
          </span>
        </h1>

        <p style={{
          fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: 'rgba(255,255,255,0.92)',
          maxWidth: 650, margin: '0 auto', lineHeight: 1.6, fontWeight: 400,
          fontFamily: C.fontSans, letterSpacing: '0.03em',
          textShadow: '0 2px 10px rgba(0,20,45,0.4)',
        }}>
          40+ años de trayectoria · 15 proyectos exclusivos · Desde USD $120,000
        </p>

        {/* Buscador rápido — mismas 3 categorías que ya existían como filtros
            avanzados dentro de Proyectos, fijadas de una vez desde el hero para no
            obligar a bajar y volver a elegir. El CTA "Buscar" vive en su propia franja
            de ancho completo, siempre pegada a los campos — antes flexeaba junto a los
            selects y, en cuanto no cabían los 4 en una fila, el botón caía a una línea
            aparte con su propio margen y esquinas redondeadas, quedando como una pastilla
            suelta flotando debajo del buscador en vez de leerse como parte del mismo. */}
        <div style={{
          maxWidth: 880, width: '100%', margin: '36px auto 0',
          borderRadius: 6, overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,15,35,0.35)',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)', padding: '10px 6px',
            display: 'flex', flexWrap: 'wrap' as const, alignItems: 'stretch',
          }}>
            {[
              { label: 'Ubicación', value: searchCategory, set: setSearchCategory, options: [
                ['todos', 'Todas las zonas'], ['Golf y Country Club', 'Golf y Country Club'],
                ['Marina Panamá', 'Marina Panamá'], ['Ciudad', 'Ciudad'], ['Playa', 'Playa'],
              ]},
              { label: 'Presupuesto', value: searchPrice, set: setSearchPrice, options: [
                ['todos', 'Cualquier precio'], ['200', 'Hasta $200,000'], ['350', 'Hasta $350,000'],
                ['500', 'Hasta $500,000'], ['over500', 'Más de $500,000'],
              ]},
              { label: 'Habitaciones', value: searchBeds, set: setSearchBeds, options: [
                ['todos', 'Cualquier número'], ['1', '1 Habitación'], ['2', '2 Habitaciones'], ['3', '3+ Habitaciones'],
              ]},
            ].map((f, i) => (
              <div key={f.label} style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column' as const, padding: '9px 20px', borderRight: i < 2 ? `1px solid ${C.sand}` : 'none', textAlign: 'left' as const }}>
                <label style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.coral, fontWeight: 700, marginBottom: 4, fontFamily: C.fontSans }}>{f.label}</label>
                <select value={f.value} onChange={e => f.set(e.target.value)}
                  style={{ border: 'none', background: 'none', fontFamily: C.fontSans, fontSize: '0.8rem', color: C.teal, fontWeight: 600, outline: 'none', cursor: 'pointer', padding: 0 }}>
                  {f.options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={runSearch} style={{
            display: 'block', width: '100%', background: C.red, color: C.white, border: 'none',
            padding: '15px 0', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: C.fontSans,
          }}>
            Buscar
          </button>
        </div>
      </div>

      {/* Counters */}
      <div style={{
        maxWidth: 1000, width: '100%', margin: '50px auto 0',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 32, position: 'relative', zIndex: 2,
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'all 1.5s ease',
      }}>
        <AnimatedCounter end={7.8} suffix="%" label="Rentabilidad Bruta" decimals={1} />
        <AnimatedCounter end={20} suffix=" años" label="Sin Predial" />
        <AnimatedCounter end={300} suffix="K" prefix="$" label="Residencia" />
        <AnimatedCounter end={40} suffix="+" label="Años GLP" />
      </div>

      {/* Se quitó "Explorar Proyectos" — redundante con el botón "Buscar" del
          buscador, que ya baja a Proyectos (y además filtrado). */}
    </section>
  )
}


const getZoneNotes = (project: any) => {
  const name = project.name.toLowerCase();
  
  if (name.includes('armonia')) return 'Entorno Urbano Premium: Ubicado a minutos del centro financiero, rodeado de reconocidas clínicas privadas, opciones gastronómicas de autor, colegios bilingües de primer nivel y a poca distancia de centros comerciales boutique.';
  if (name.includes('ventu')) return 'Lifestyle & Conectividad: Cercanía inmediata a prestigiosas universidades y hospitales como Pacífica Salud, fácil acceso al aeropuerto internacional, y un corredor lleno de cafés, museos y parques para un estilo de vida cosmopolita.';
  if (name.includes('oceana')) return 'Exclusividad en Santa María: Situado junto al prestigioso campo de golf Jack Nicklaus, a pasos del Town Center Costa del Este, exclusivas boutiques, restaurantes de lujo y el sofisticado hospital Punta Pacífica.';
  if (name.includes('ipanema')) return 'Vanguardia frente al Mar: A minutos del vibrante Casco Antiguo y museos históricos, acceso rápido a marinas privadas, y rodeado de plazas comerciales de élite y centros médicos especializados.';
  if (name.includes('bosco')) return 'Elegancia y Naturaleza: Enclavado en el corazón de Santa María, con acceso directo a senderos ecológicos, campos de golf, el Costa del Este Business Park y colegios internacionales de altísimo prestigio.';
  if (name.includes('panama viejo')) return 'Herencia y Modernidad: Fusiona la cercanía a las ruinas históricas de Panamá Viejo (Patrimonio de la Humanidad) con el acceso al corredor sur, centros corporativos de Costa del Este y modernas clínicas de bienestar.';
  if (name.includes('the palms') || name.includes('ocean reef') || name.includes('o club') || name.includes('seashore')) {
    return 'Lujo Insular Absoluto: Ubicación irrepetible en Ocean Reef Islands. Cuenta con marina privada, acceso expedito al hospital Punta Pacífica, Multiplaza Pacific Mall y la vibrante vida nocturna y gastronómica de la ciudad, todo a 5 minutos.';
  }
  if (name.includes('aires') || name.includes('tides') || name.includes('brisas') || name.includes('olas') || name.includes('surfside') || name.includes('beachwalk')) {
    return 'Oasis de Playa y Aventura: Situado en Playa Caracol con kilómetros de arena blanca, escuelas de surf de clase mundial, a minutos de supermercados, clínicas de atención primaria en Coronado y en la ruta hacia el Valle de Antón.';
  }

  // ────────────────────────────────────────────────────────
  return 'Conectividad y Plusvalía: Ubicación estratégica con cercanía a zonas de salud de primer mundo, colegios internacionales, prestigiosos centros comerciales, y atracciones turísticas y gastronómicas que elevan la calidad de vida.';
};

// ────────────────────────────────────────────────────────
const ProjectCard: React.FC<{
  project: Project;
  index: number;
  separacionTabla: SeparacionProyectosTabla;
}> = ({ project, index, separacionTabla }) => {
  const [hovered, setHovered] = React.useState(false)

  const gradient = getGradient(project.type, index)
  const imgs = getImageFor(project.name, PROJECT_IMG[project.name])
  const heroStyle: React.CSSProperties = imgs
    ? { backgroundImage: `url(${imgs.main})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: gradient }
  const goToDetail = () => window.open(`/project.html?name=${encodeURIComponent(project.name)}`, '_blank');

  // Formato editorial: foto más grande con el precio superpuesto (antes vivía en el
  // cuerpo, separado de la foto) y la nota de zona visible de entrada — antes solo
  // existía dentro de la ficha de detalle, a la que había que hacer clic para verla.
  const zoneNote = getZoneNotes(project);
  const [zoneTitle, ...zoneRest] = zoneNote.split(':');
  const zoneDesc = zoneRest.join(':').trim();

  return (
    <div
      id={`project-card-${encodeURIComponent(project.name)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={goToDetail}
      style={{
        background: C.white, borderRadius: 6, overflow: 'hidden',
        border: `1px solid ${C.sand}`,
        boxShadow: hovered ? '0 16px 36px rgba(0,35,73,0.12)' : '0 2px 10px rgba(0,35,73,0.04)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        cursor: 'pointer', position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Photo */}
      <div style={{ height: 320, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            height: '100%',
            width: '100%',
            ...heroStyle,
            transition: 'transform 0.5s ease',
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,20,45,0.65), rgba(0,20,45,0) 55%)', pointerEvents: 'none' }} />
        <div style={{
          position: 'absolute', top: 14, left: 14,
          background: 'rgba(6,214,160,0.95)', color: C.white,
          padding: '4px 12px', borderRadius: 20,
          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: C.fontSans,
        }}>
          Disponible
        </div>
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: 'rgba(255,255,255,0.92)', color: C.red,
          padding: '4px 12px', borderRadius: 20,
          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: C.fontSans,
        }}>
          {project.tag}
        </div>
        <div style={{ position: 'absolute', bottom: 16, left: 18, color: C.white }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 3, fontFamily: C.fontSans }}>Desde</div>
          <div style={{ fontFamily: C.fontSerif, fontSize: '1.6rem', fontWeight: 500, textShadow: '0 2px 10px rgba(0,15,35,0.5)' }}>{fmt(project.price)}</div>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{ margin: '0 0 6px', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textSec, fontFamily: C.fontSans }}>{project.zone}</p>
        <h3 style={{ margin: '0 0 12px', fontSize: '1.3rem', fontWeight: 400, fontFamily: C.fontSerif, color: C.red }}>
          {project.name}
        </h3>

        {/* Nota de zona — visible sin clic */}
        <div style={{ background: C.bg, borderLeft: `3px solid ${C.coral}`, padding: '10px 12px', marginBottom: 16 }}>
          {zoneTitle && zoneDesc ? (
            <>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.teal, marginBottom: 2, fontFamily: C.fontSans }}>{zoneTitle}</div>
              <div style={{ fontSize: '0.78rem', color: C.textSec, lineHeight: 1.5, fontFamily: C.fontSans }}>{zoneDesc}</div>
            </>
          ) : (
            <div style={{ fontSize: '0.78rem', color: C.textSec, lineHeight: 1.5, fontFamily: C.fontSans }}>{zoneNote}</div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: `1px solid ${C.sand}`, borderBottom: `1px solid ${C.sand}`, padding: '12px 0', marginTop: 'auto', marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.teal, fontFamily: C.fontSans }}>{project.area}</div>
            <div style={{ fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textSec, marginTop: 2, fontFamily: C.fontSans }}>Área</div>
          </div>
          <div style={{ textAlign: 'center', borderLeft: `1px solid ${C.sand}`, borderRight: `1px solid ${C.sand}` }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.teal, fontFamily: C.fontSans }}>{project.beds}</div>
            <div style={{ fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textSec, marginTop: 2, fontFamily: C.fontSans }}>Habitaciones</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.teal, fontFamily: C.fontSans }}>${getSeparacionProyecto(project, separacionTabla).toLocaleString()}</div>
            <div style={{ fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textSec, marginTop: 2, fontFamily: C.fontSans }}>Separación</div>
          </div>
        </div>

        <button
          onClick={e => { e.stopPropagation(); goToDetail(); }}
          style={{
            width: '100%', textDecoration: 'none', textAlign: 'center',
            background: C.red, color: C.white, borderRadius: 0,
            border: `1px solid ${C.red}`,
            padding: '10px 10px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            transition: 'all 0.3s ease',
            fontFamily: C.fontSans,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.red; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = C.white; }}
        >
          Ver Proyecto
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
const ProjectsSection: React.FC<{
  projects: Project[];
  // El buscador rápido del hero fija estos tres filtros (ubicación/presupuesto/
  // habitaciones) al hacer clic en "Buscar" — se leen como valor inicial y luego el
  // usuario puede seguir ajustándolos aquí normalmente, como antes.
  initialFilters?: { category?: string; price?: string; beds?: string } | null;
}> = ({ projects, initialFilters }) => {
  // Valor de Separación por Proyecto — configurable en el CRM (Configuración → Financiero).
  // Arranca con el default local y se actualiza si el backend responde, para que un cambio
  // del administrador se refleje en la ficha técnica pública sin tocar código.
  const [separacionTabla, setSeparacionTabla] = React.useState<SeparacionProyectosTabla>(SEPARACION_PROYECTOS_DEFAULT);
  React.useEffect(() => {
    fetch(`${API_ROOT}/api/settings/separacion_proyectos`)
      .then(r => r.json())
      .then(data => { if (data && data.porProyecto) setSeparacionTabla(data); })
      .catch(() => {});
  }, []);
  const [filter, setFilter] = React.useState<string>('todos')
  const [selectedCategory, setSelectedCategory] = React.useState<string>(initialFilters?.category || 'todos')
  const [selectedPrice, setSelectedPrice] = React.useState<string>(initialFilters?.price || 'todos')
  const [selectedBeds, setSelectedBeds] = React.useState<string>(initialFilters?.beds || 'todos')
  // Filtros avanzados (Ubicación/Presupuesto/Habitaciones) empiezan colapsados — ya
  // existe el mismo buscador arriba, en el hero; mostrar ambos a la vez duplicaba el
  // control. Este queda como "refinar búsqueda" para quien ya está viendo el
  // portafolio y quiere afinar más (ej. por habitaciones, que el hero no cubre).
  const [filtersOpen, setFiltersOpen] = React.useState(false)

  // El buscador del hero puede activarse varias veces con el usuario ya en la página
  // (sin recargar) — sin este efecto, el estado inicial solo se toma la primera vez
  // que el componente monta y clics posteriores en "Buscar" no actualizarían nada.
  React.useEffect(() => {
    if (!initialFilters) return;
    if (initialFilters.category) setSelectedCategory(initialFilters.category);
    if (initialFilters.price) setSelectedPrice(initialFilters.price);
    if (initialFilters.beds) setSelectedBeds(initialFilters.beds);
  }, [initialFilters]);

  // Cada perfil lleva una explicación de una línea — sin ella, "Patrimonial" o
  // "Disfrute" no son evidentes por sí solos para alguien que solo quiere ver el
  // portafolio, a diferencia de un filtro concreto como "3 habitaciones".
  const filters = [
    { key: 'todos', label: 'Todos', desc: 'Todo el portafolio, sin filtrar por perfil de inversión.' },
    { key: 'renta', label: 'Renta', desc: 'Enfocado en retorno por arriendo — cap rate y ocupación como criterio principal.' },
    { key: 'disfrute', label: 'Disfrute', desc: 'Para uso personal y vacacional, con potencial de arriendo secundario.' },
    { key: 'patrimonial', label: 'Patrimonial', desc: 'Preservación y valorización de capital en dólares a largo plazo.' },
  ]

  // ────────────────────────────────────────────────────────
  const sortedProjects = React.useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name))
  }, [projects])

  const filtered = React.useMemo(() => {
    return sortedProjects.filter(p => {
      // ────────────────────────────────────────────────────────
      if (filter !== 'todos' && p.type !== filter) return false;
      
      // ────────────────────────────────────────────────────────
      if (selectedCategory !== 'todos' && p.category !== selectedCategory) return false;
      
      // ────────────────────────────────────────────────────────
      if (selectedPrice !== 'todos') {
        if (selectedPrice === '200' && p.price > 200000) return false;
        if (selectedPrice === '350' && p.price > 350000) return false;
        if (selectedPrice === '500' && p.price > 500000) return false;
        if (selectedPrice === 'over500' && p.price <= 500000) return false;
      }
      
      // ────────────────────────────────────────────────────────
      if (selectedBeds !== 'todos') {
        const matches = p.beds.match(/\d+/g);
        if (!matches) return false;
        const nums = matches.map(Number);
        const min = nums[0];
        const max = nums[1] || min;
        
        if (selectedBeds === '1') {
          if (!(min <= 1 && max >= 1)) return false;
        } else if (selectedBeds === '2') {
          if (!(min <= 2 && max >= 2)) return false;
        } else if (selectedBeds === '3') {
          if (max < 3) return false;
        }
      }
      
      return true;
    });
  }, [sortedProjects, filter, selectedCategory, selectedPrice, selectedBeds]);

  return (
    <section id="projects" style={{ padding: '70px 24px 100px', background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-block', borderBottom: `1px solid ${C.teal}`,
            color: C.teal, paddingBottom: 4,
            fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em',
            textTransform: 'uppercase', marginBottom: 14,
            fontFamily: C.fontSans,
          }}>PORTAFOLIO</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 400, color: C.red, margin: '0 0 12px', fontFamily: C.fontSerif }}>
            Nuestros Proyectos de Inversión
          </h2>
          <p style={{ fontSize: '0.95rem', color: C.textSec, maxWidth: 600, margin: '0 auto', fontFamily: C.fontSans, letterSpacing: '0.02em' }}>
            Explore los activos inmobiliarios más exclusivos en Golf y Country Club, Marina Panamá, Ciudad y Playa.
          </p>
        </div>

        {/* Filter Tabs (Investor Profiles) */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 32,
          flexWrap: 'wrap',
        }}>
          {filters.map(f => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  background: active ? C.teal : 'transparent',
                  color: active ? C.white : C.textSec,
                  border: `1.5px solid ${active ? C.teal : C.sand}`,
                  borderRadius: 0,
                  padding: '10px 24px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  fontFamily: C.fontSans,
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Explicación del perfil activo — una línea, cambia según el tab elegido */}
        <p style={{
          textAlign: 'center', fontSize: '0.8rem', color: C.textSec, fontFamily: C.fontSans,
          maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.5,
        }}>
          {filters.find(f => f.key === filter)?.desc}
        </p>

        {/* Refinar búsqueda — colapsado por defecto: el buscador del hero ya cubre
            Ubicación/Presupuesto/Tipo, esto es solo para quien quiere afinar más
            (ej. Habitaciones) sin duplicar el mismo control dos veces en la página. */}
        <div style={{ textAlign: 'center', marginBottom: filtersOpen ? 16 : 48 }}>
          <button onClick={() => setFiltersOpen(v => !v)} style={{
            background: 'none', border: `1px solid ${C.sand}`, color: C.teal,
            padding: '9px 22px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', cursor: 'pointer', fontFamily: C.fontSans,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            Refinar búsqueda
            <span style={{ fontSize: '0.65rem', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          </button>
        </div>

        {filtersOpen && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 48,
          flexWrap: 'wrap',
          background: C.white,
          padding: '20px 24px',
          borderRadius: 0,
          border: `1px solid ${C.sand}`,
          maxWidth: 900,
          margin: '0 auto 48px auto'
        }}>
          {/* Classification filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180, flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSec, fontFamily: C.fontSans }}>Ubicación</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 0,
                border: `1px solid ${C.sand}`,
                fontSize: '0.8rem',
                color: C.text,
                background: C.white,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: C.fontSans,
              }}
            >
              <option value="todos">Todas las clasificaciones</option>
              <option value="Golf y Country Club">Golf y Country Club</option>
              <option value="Marina Panamá">Marina Panamá</option>
              <option value="Ciudad">Ciudad</option>
              <option value="Playa">Playa</option>
            </select>
          </div>

          {/* Price filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180, flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSec, fontFamily: C.fontSans }}>Presupuesto Máximo</label>
            <select
              value={selectedPrice}
              onChange={e => setSelectedPrice(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 0,
                border: `1px solid ${C.sand}`,
                fontSize: '0.8rem',
                color: C.text,
                background: C.white,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: C.fontSans,
              }}
            >
              <option value="todos">Cualquier precio</option>
              <option value="200">Hasta $200,000 USD</option>
              <option value="350">Hasta $350,000 USD</option>
              <option value="500">Hasta $500,000 USD</option>
              <option value="over500">Más de $500,000 USD</option>
            </select>
          </div>

          {/* Beds filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180, flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSec, fontFamily: C.fontSans }}>Habitaciones</label>
            <select
              value={selectedBeds}
              onChange={e => setSelectedBeds(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 0,
                border: `1px solid ${C.sand}`,
                fontSize: '0.8rem',
                color: C.text,
                background: C.white,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: C.fontSans,
              }}
            >
              <option value="todos">Cualquier número</option>
              <option value="1">1 Habitación</option>
              <option value="2">2 Habitaciones</option>
              <option value="3">3+ Habitaciones</option>
            </select>
          </div>
        </div>
        )}

        {/* Reorganized Gallery by Category */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.textSec, fontStyle: 'italic', fontFamily: C.fontSans }}>
            No se encontraron proyectos con los filtros seleccionados.
          </div>
        ) : (
          (['Golf y Country Club', 'Marina Panamá', 'Ciudad', 'Playa'] as const).map(catName => {
            const catProjects = filtered.filter(p => p.category === catName);
            if (catProjects.length === 0) return null;

            const categoryDescriptions = {
              'Golf y Country Club': 'Residencias exclusivas junto al campo de golf Jack Nicklaus en Santa María, arquitectura biofílica y club house de primer nivel.',
              'Marina Panamá': 'El máximo nivel de lujo caribeño frente al mar en Punta Pacífica, con marina privada y acceso directo al yacht club.',
              'Ciudad': 'Residencias urbanas exclusivas de alta rentabilidad en las zonas más cotizadas de la Ciudad de Panamá.',
              'Playa': 'Exclusivos apartamentos de descanso y disfrute frente al océano con arenas blancas y club de surf privado.'
            };

            return (
              <div key={catName} style={{ marginBottom: 56 }}>
                <div style={{ borderBottom: `2px solid ${C.sand}`, paddingBottom: 12, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h3 style={{ fontSize: '1.6rem', color: C.teal, fontWeight: 400, fontFamily: C.fontSerif, margin: 0 }}>
                    {catName}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: C.textSec, margin: 0, fontFamily: C.fontSans }}>
                    {categoryDescriptions[catName]}
                  </p>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 28,
                  marginBottom: 24
                }}>
                  {catProjects.map((p, i) => {
                    return (
                      <ProjectCard
                        key={p.name}
                        project={p}
                        index={i}
                        separacionTabla={separacionTabla}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────
// Todo lo que es nivel PAÍS vive aquí — antes "ventajas migratorias/impositivas"
// estaba partido en InvestmentSection, separado de estos 6 stats por un bloque entero
// de contenido de GLP (empresa) en el medio, obligando al lector a saltar de país a
// empresa y de vuelta a país en el mismo scroll.
const WhyPanamaSection: React.FC = () => {
  const stats = [
    { num: '01', title: 'Dolarizado desde 1904', desc: 'Cero riesgo de devaluación. Sus rentas y patrimonio en la moneda más estable del mundo.' },
    { num: '02', title: '3% Retención de Impuesto', desc: 'Retención en la fuente del 3% sobre el precio de venta total al momento de desinvertir, un esquema simple y competitivo.' },
    { num: '03', title: 'Hub Logístico: Canal', desc: 'USD $4B+ anuales del Canal impulsan la economía, empleo y demanda de vivienda premium.' },
    { num: '04', title: '7.8% Rentabilidad Promedio', desc: 'Atractivos niveles de retorno bruto por alquiler en dólares estadounidenses en segmentos residenciales premium.' },
    { num: '05', title: '+29% Inversión 2026', desc: 'Crecimiento proyectado en inversión inmobiliaria y construcción para el período 2025-2026.' },
    { num: '06', title: 'Inversión Internacional Líder', desc: 'Destino preferido de inversión para capitales y familias de toda la región gracias a su estabilidad jurídica y económica.' },
  ]

  const advantageGroups = [
    {
      title: 'Ventajas de Panamá como país',
      items: [
        'Ubicación estratégica: conectividad global a través del Canal de Panamá y su aeropuerto internacional.',
        'Economía estable y en crecimiento, con el dólar estadounidense como moneda oficial.',
        'Infraestructura de clase mundial: puertos, carreteras y telecomunicaciones avanzadas.',
        'Clima cálido todo el año y riqueza natural con playas, montañas y biodiversidad.',
        'Seguridad y calidad de vida en un entorno cosmopolita.',
      ]
    },
    {
      title: 'Ventajas migratorias',
      items: [
        'Programa de Inversionista Calificado: residencia en Panamá mediante la compra de una propiedad desde USD $300,000.',
        'Posibilidad de residencia permanente y ciudadanía después de cierto tiempo de estadía.',
        'Facilidad para obtener permisos de trabajo vinculados a las visas de residencia.',
        'Beneficios para jubilados con el programa Pensionado, incluyendo descuentos exclusivos en servicios y bienes.',
      ]
    },
    {
      title: 'Ventajas impositivas',
      items: [
        'Ingresos generados fuera de Panamá están exentos de impuestos (sistema tributario territorial).',
        'Mínimos costos fiscales en procesos de compraventa de propiedades.',
        'Beneficios en Zonas Francas y Áreas Económicas Especiales para empresas e inversores.',
        'Tratados de doble tributación con varios países, que reducen las cargas fiscales para inversionistas extranjeros.',
      ]
    },
  ]

  return (
    <div style={{ padding: '100px 24px', background: C.white }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{
            display: 'inline-block', borderBottom: `1px solid ${C.palm}`,
            color: C.palm, paddingBottom: 4,
            fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em',
            textTransform: 'uppercase', marginBottom: 14,
            fontFamily: C.fontSans,
          }}>VENTAJAS COMPETITIVAS</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 400, color: C.red, margin: '0 0 12px', fontFamily: C.fontSerif }}>
            ¿Por qué Panamá?
          </h2>
          <p style={{ fontSize: '0.95rem', color: C.textSec, maxWidth: 600, margin: '0 auto', fontFamily: C.fontSans, letterSpacing: '0.02em' }}>
            6 razones fundamentales por las que los inversionistas más sofisticados eligen Panamá.
          </p>
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 24,
          marginBottom: 64,
        }}>
          {stats.map(s => (
            <div key={s.title} style={{
              background: C.white, borderRadius: 0, padding: '32px 24px',
              border: `1px solid ${C.sand}`,
              transition: 'all 0.3s ease',
              flex: '1 1 260px', maxWidth: 300, minWidth: 260,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.teal; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.sand; }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 400, fontFamily: C.fontSerif, color: C.coral, marginBottom: 16 }}>{s.num}</div>
              <h4 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 600, color: C.text, fontFamily: C.fontSans }}>{s.title}</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: C.textSec, lineHeight: 1.6, fontFamily: C.fontSans }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Ventajas: migratorias / impositivas — antes vivían en otro componente
            (InvestmentSection), separadas de estos stats por un bloque completo de
            contenido de GLP en el medio. Mismo tema (país), un solo lugar. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {advantageGroups.map(group => (
            <div key={group.title} style={{ background: C.bg, border: `1px solid ${C.sand}`, padding: '28px 24px' }}>
              <h4 style={{ margin: '0 0 18px', fontSize: '0.95rem', fontWeight: 700, color: C.red, fontFamily: C.fontSans, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {group.title}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {group.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: '0.82rem', color: C.textSec, lineHeight: 1.55, fontFamily: C.fontSans }}>
                    <span style={{ color: C.coral, flexShrink: 0 }}>—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const parseRentM2 = (proj: any) => {
  if (!proj) return 15;
  if (proj.rentM2.includes('Airbnb')) {
    const matches = proj.rentM2.match(/\d+/g);
    if (matches && matches.length >= 2) {
      const maxNightVal = parseFloat(matches[1]);
      return Math.round((maxNightVal * 30 * 0.8) / 75); // ────────────────────────────────────────────────────────
    }
    return 45;
  }
  const parts = proj.rentM2.replace(/[^0-9.]/g, '').split('');
  if (parts.length === 2) {
    return parseFloat(parts[1]);
  }
  return parseFloat(parts[0]) || 15;
};

const parseVacancy = (proj: any) => {
  if (!proj) return 5;
  const parts = proj.vacancy.replace(/[^0-9.]/g, '').split('');
  if (parts.length === 2) {
    return (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
  }
  return parseFloat(parts[0]) || 5;
};

const parseCapRate = (proj: any) => {
  if (!proj) return 6;
  const parts = proj.capRate.replace(/[^0-9.]/g, '').split('');
  if (parts.length === 2) {
    return (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
  }
  return parseFloat(parts[0]) || 6;
};

const parseAppreciation = (proj: any) => {
  if (!proj) return 4.5;
  return parseFloat(proj.appreciation.replace(/[^0-9.]/g, '')) || 4.5;
};

// ────────────────────────────────────────────────────────
const CalculatorSection: React.FC<{
  selectedProject: number;
  setSelectedProject: (i: number) => void;
  projects: Project[];
}> = ({ selectedProject, setSelectedProject, projects }) => {
  const [assetValue, setAssetValue] = React.useState(300000)
  const [area, setArea] = React.useState(100)
  const [downPaymentPct, setDownPaymentPct] = React.useState(50)
  const [rate, setRate] = React.useState(8.5)
  const [rentM2, setRentM2] = React.useState(15)
  const [vacancy, setVacancy] = React.useState(5)
  const [capRate, setCapRate] = React.useState(6)
  const [adminFeePct, setAdminFeePct] = React.useState(10)
  const [propertyManager, setPropertyManager] = React.useState(0)
  const [appreciation, setAppreciation] = React.useState(5)
  const [condominioMes, setCondominioMes] = React.useState(2.50)

  React.useEffect(() => {
    const proj = projects[selectedProject];
    if (proj) {
      const pVal = proj.price;
      const minArea = parseInt(proj.area.split(/[^0-9]/)[0]) || 60;
      const rM2 = parseRentM2(proj);
      const vac = parseVacancy(proj);
      const app = parseAppreciation(proj);

      setAssetValue(pVal);
      setArea(minArea);
      setRentM2(rM2);
      setVacancy(vac);

      // ────────────────────────────────────────────────────────
      const initPatrimonio = pVal * 0.5;
      const initCapRate = initPatrimonio > 0 ? ((rM2 * minArea * 12) / initPatrimonio) * 100 : 12;
      setCapRate(Number(initCapRate.toFixed(2)));

      setAppreciation(app);
      setDownPaymentPct(50);
      setRate(8.5);
      setAdminFeePct(10);
      setPropertyManager(0);
      setCondominioMes(2.50);
    }
  }, [selectedProject]);

  const handleRentM2Change = (val: number) => {
    setRentM2(val);
    const patrimonio = assetValue * (downPaymentPct / 100);
    if (patrimonio > 0 && area > 0) {
      const newCap = ((val * area * 12) / patrimonio) * 100;
      setCapRate(Number(newCap.toFixed(2)));
    }
  };

  const handleCapRateChange = (val: number) => {
    setCapRate(val);
    const patrimonio = assetValue * (downPaymentPct / 100);
    if (area > 0 && patrimonio > 0) {
      const newRentM2 = ((patrimonio * (val / 100)) / 12) / area;
      setRentM2(Number(newRentM2.toFixed(1)));
    }
  };

  const handleAssetValueChange = (val: number) => {
    setAssetValue(val);
    const patrimonio = val * (downPaymentPct / 100);
    if (patrimonio > 0 && area > 0) {
      const newCap = ((rentM2 * area * 12) / patrimonio) * 100;
      setCapRate(Number(newCap.toFixed(2)));
    }
  };

  const handleAreaChange = (val: number) => {
    setArea(val);
    const patrimonio = assetValue * (downPaymentPct / 100);
    if (patrimonio > 0 && val > 0) {
      const newCap = ((rentM2 * val * 12) / patrimonio) * 100;
      setCapRate(Number(newCap.toFixed(2)));
    }
  };

  const handleDownPaymentPctChange = (val: number) => {
    setDownPaymentPct(val);
    const patrimonio = assetValue * (val / 100);
    if (patrimonio > 0 && area > 0) {
      const newCap = ((rentM2 * area * 12) / patrimonio) * 100;
      setCapRate(Number(newCap.toFixed(2)));
    }
  };

  const downPayment = assetValue * (downPaymentPct / 100)
  const loanAmount = assetValue - downPayment
  const monthlyRate = rate / 100 / 12
  const months = 25 * 12
  const monthlyPayment = loanAmount > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
    : 0
  const annualMortgage = monthlyPayment * 12

  const monthlyGrossRent = rentM2 * area
  const annualGrossRent = monthlyGrossRent * 12
  const annualVacancyLoss = annualGrossRent * (vacancy / 100)
  const effectiveGrossRent = annualGrossRent - annualVacancyLoss

  const monthlyAdminFee = monthlyGrossRent * (adminFeePct / 100)
  const annualAdminFee = monthlyAdminFee * 12
  const monthlyPropertyManager = propertyManager
  const annualPropertyManager = propertyManager * 12
  const monthlyCondo = condominioMes * area
  const annualCondo = monthlyCondo * 12

  const totalMonthlyCosts = monthlyAdminFee + monthlyPropertyManager + monthlyCondo
  const totalAnnualCosts = annualAdminFee + annualPropertyManager + annualCondo

  const annualNOI = effectiveGrossRent - totalAnnualCosts
  const annualCashFlow = annualNOI - annualMortgage
  const annualAppreciationVal = assetValue * (appreciation / 100)

  return (
    // ────────────────────────────────────────────────────────
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setSelectedProject(null as any); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0, 35, 73, 0.5)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div style={{
        background: C.white, borderRadius: 0, width: '100%', maxWidth: 820,
        border: `1px solid ${C.sand}`,
        boxShadow: '0 20px 50px rgba(0,35,73,0.15)',
        maxHeight: '95vh', overflowY: 'auto',
        position: 'relative',
      }}>
        {/* Modal Header */}
        <div style={{
          background: C.teal,
          borderRadius: 0,
          padding: '24px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <span style={{
              display: 'inline-block', background: 'rgba(255,255,255,0.08)',
              color: '#fff', padding: '4px 12px', borderRadius: 0,
              border: '1px solid rgba(255,255,255,0.18)',
              fontSize: '0.7rem', fontWeight: 600, marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              fontFamily: C.fontSans,
            }}>SIMULACIN DE CRÉDITO</span>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 400, fontFamily: C.fontSerif }}>
              Financiación & Amortización Hipotecaria
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: '6px 0 0', fontSize: '0.85rem', fontFamily: C.fontSans }}>
              Personaliza los parámetros para estimar tu cuota hipotecaria.
            </p>
          </div>
          <button
            onClick={() => setSelectedProject(null as any)}
            style={{
              background: 'none', border: 'none', color: '#fff',
              width: 36, height: 36, cursor: 'pointer',
              fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'opacity 0.2s', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >✕</button>
        </div>

        {/* Mortgage Summary - shown prominently at top */}
        <div style={{
          background: C.bg, borderBottom: `1px solid ${C.sand}`,
          padding: '24px 32px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: '12px', background: C.white, borderRadius: 0, border: `1px solid ${C.sand}` }}>
              <div style={{ fontSize: '0.65rem', color: C.textSec, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: C.fontSans }}>Valor del Activo</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 400, color: C.text, fontFamily: C.fontSerif }}>{fmt(assetValue)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: C.white, borderRadius: 0, border: `1px solid ${C.sand}` }}>
              <div style={{ fontSize: '0.65rem', color: C.textSec, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: C.fontSans }}>Cuota Inicial ({downPaymentPct}%)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 400, color: C.text, fontFamily: C.fontSerif }}>{fmt(downPayment)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: C.white, borderRadius: 0, border: `1px solid ${C.sand}` }}>
              <div style={{ fontSize: '0.65rem', color: C.textSec, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: C.fontSans }}>Monto Financiado</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 400, color: C.text, fontFamily: C.fontSerif }}>{fmt(loanAmount)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px', background: C.coral, borderRadius: 0, border: `1px solid ${C.coral}` }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.9)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: C.fontSans }}>Cuota Mensual (25a)</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 400, color: '#fff', fontFamily: C.fontSerif }}>{fmt(Math.round(monthlyPayment))}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: C.white, borderRadius: 0, border: `1px solid ${C.sand}` }}>
              <div style={{ fontSize: '0.65rem', color: C.textSec, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: C.fontSans }}>Total Hipoteca Anual</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 400, color: C.teal, fontFamily: C.fontSerif }}>{fmt(Math.round(annualMortgage))}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '28px 32px' }}>
          {/* Adquisición Grid */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text, marginBottom: 12, borderBottom: `1px solid ${C.sand}`, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: C.fontSans }}>
              1. Adquisición & Financiación
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Proyecto</label>
                <select value={selectedProject} onChange={e => setSelectedProject(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, cursor: 'pointer', outline: 'none',
                  fontFamily: C.fontSans,
                }}>
                  {projects.map((p, i) => (
                    <option key={p.name} value={i}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Valor Activo (USD)</label>
                <input type="text" value={formatComma(assetValue)} onChange={e => handleAssetValueChange(Number(e.target.value.replace(/\D/g, '')))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Metraje (m²)</label>
                <input type="number" value={area} onChange={e => handleAreaChange(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Cuota Inicial (%)</label>
                <input type="number" value={downPaymentPct} onChange={e => handleDownPaymentPctChange(Number(e.target.value))} min={10} max={100} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Tasa Hipoteca (%)</label>
                <input type="number" value={rate} step={0.1} onChange={e => setRate(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text, marginBottom: 12, borderBottom: `1px solid ${C.sand}`, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: C.fontSans }}>
              2. Operación, Costos & Retorno (Variables Editables)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Renta / m² (USD/mes)</label>
                <input type="number" value={rentM2} onChange={e => handleRentM2Change(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Retorno (%)</label>
                <input type="number" value={capRate} step={0.01} onChange={e => handleCapRateChange(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Vacancia (%)</label>
                <input type="number" value={vacancy} step={0.1} onChange={e => setVacancy(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Admin Fee (%)</label>
                <input type="number" value={adminFeePct} onChange={e => setAdminFeePct(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Prop. Manager (USD/mes)</label>
                <input type="text" value={formatComma(propertyManager)} onChange={e => setPropertyManager(Number(e.target.value.replace(/\D/g, '')))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Condominio (USD/m²/mes)</label>
                <input type="number" value={condominioMes} step={0.1} onChange={e => setCondominioMes(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, fontFamily: C.fontSans }}>Plusvalía Anual (%)</label>
                <input type="number" value={appreciation} step={0.1} onChange={e => setAppreciation(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.8rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans,
                }} />
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={() => { setSelectedProject(null as any); setTimeout(() => smoothScroll('contact'), 200); }}
              style={{
                display: 'inline-block', background: C.teal, border: `1px solid ${C.teal}`,
                color: C.white, padding: '14px 36px', borderRadius: 0,
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                transition: 'all 0.3s ease',
                fontFamily: C.fontSans,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.teal; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.teal; e.currentTarget.style.color = C.white; }}
            >
              Solicitar Asesoría Personalizada
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


// ────────────────────────────────────────────────────────
const FAQItem: React.FC<{ faq: FAQ; isOpen: boolean; toggle: () => void }> = ({ faq, isOpen, toggle }) => (
  <div style={{
    borderBottom: `1px solid ${C.sand}`,
    transition: 'all 0.3s',
  }}>
    <button onClick={toggle} style={{
      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer',
      textAlign: 'left',
    }}>
      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: C.text, paddingRight: 16, lineHeight: 1.4 }}>{faq.q}</span>
      <span style={{
        fontSize: '1.2rem', color: C.teal, flexShrink: 0,
        transform: isOpen ? 'rotate(45deg)' : 'rotate(0)',
        transition: 'transform 0.3s',
      }}>+</span>
    </button>
    {isOpen && (
      <div style={{
        padding: '0 0 18px', fontSize: '0.9rem', color: C.textSec, lineHeight: 1.7,
        animation: 'fadeIn 0.3s ease',
      }}>
        {faq.a}
      </div>
    )}
  </div>
)

const FAQSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = React.useState(0)
  const [faqSearch, setFaqSearch] = React.useState('')
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({})
  const [faqData, setFaqData] = React.useState<FAQCategory[]>(FAQ_DATA_FALLBACK)

  // Trae las FAQs reales del CRM (misma tabla que usan Sara/Valeria) para que landing y
  // CRM compartan idéntico texto de pregunta — si falla, se queda con el fallback fijo en
  // vez de romper la sección pública.
  React.useEffect(() => {
    fetch(`${API_ROOT}/api/faqs`).then(r => r.json()).then((rows: any[]) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const iconByTitle: Record<string, string> = {};
      FAQ_DATA_FALLBACK.forEach(cat => { iconByTitle[cat.title] = cat.icon; });
      const order = FAQ_DATA_FALLBACK.map(cat => cat.title);
      const grouped: Record<string, FAQ[]> = {};
      rows.forEach(r => {
        const cat = r.categoria || 'Otros';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ q: r.pregunta, a: r.respuesta, id: Number(r.id) });
      });
      const titles = [...order.filter(t => grouped[t]), ...Object.keys(grouped).filter(t => !order.includes(t))];
      const rebuilt: FAQCategory[] = titles.map(title => ({
        title, icon: iconByTitle[title] || '❓', items: grouped[title],
      }));
      if (rebuilt.length > 0) setFaqData(rebuilt);
    }).catch(() => {});
  }, []);

  const toggle = (key: string, faqId: number | undefined) =>
    setOpenItems(prev => {
      if (!prev[key]) trackFaqClick(faqId); // solo al abrir
      return { ...prev, [key]: !prev[key] };
    });

  const searchedFaqs = React.useMemo(() => {
    if (!faqSearch.trim()) return null;
    const query = faqSearch.toLowerCase();
    const results: { faq: FAQ; categoryTitle: string; key: string }[] = [];
    faqData.forEach((cat, catIdx) => {
      cat.items.forEach((item, itemIdx) => {
        if (item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)) {
          results.push({
            faq: item,
            categoryTitle: cat.title,
            key: `${catIdx}-${itemIdx}`
          });
        }
      });
    });
    return results;
  }, [faqSearch, faqData]);

  return (
    <section id="faq" style={{ padding: '100px 24px', background: C.white }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-block', borderBottom: `1px solid ${C.sky}`,
            color: C.sky, paddingBottom: 4,
            fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em',
            textTransform: 'uppercase', marginBottom: 14,
            fontFamily: C.fontSans,
          }}>FAQ</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 400, color: C.red, margin: '0 0 12px', fontFamily: C.fontSerif }}>
            Preguntas Frecuentes
          </h2>
          <p style={{ fontSize: '0.95rem', color: C.textSec, fontFamily: C.fontSans, letterSpacing: '0.02em' }}>
            Información importante para el inversionista colombiano en Panamá.
          </p>
        </div>

        {/* FAQ Search Box */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'center' }}>
          <input
            type="text"
            placeholder="Buscar en preguntas frecuentes..."
            value={faqSearch}
            onChange={e => setFaqSearch(e.target.value)}
            style={{
              width: '100%', maxWidth: 500, padding: '12px 16px', borderRadius: 0,
              border: `1px solid ${C.sand}`, fontSize: '0.85rem',
              color: C.text, background: C.bg, outline: 'none',
              boxSizing: 'border-box' as const, textAlign: 'center',
              fontFamily: C.fontSans,
            }}
          />
        </div>

        {/* Category tabs */}
        {!searchedFaqs && (
          <div style={{
            display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {faqData.map((cat, i) => (
              <button key={cat.title} onClick={() => setActiveCategory(i)} style={{
                background: activeCategory === i ? C.teal : 'transparent',
                color: activeCategory === i ? C.white : C.text,
                border: `1px solid ${activeCategory === i ? C.teal : C.sand}`,
                padding: '10px 20px', borderRadius: 0, cursor: 'pointer',
                fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase',
                letterSpacing: '0.08em', transition: 'all 0.3s ease',
                fontFamily: C.fontSans,
              }}>
                {cat.title}
              </button>
            ))}
          </div>
        )}

        {/* FAQ List */}
        <div style={{
          background: C.bg, borderRadius: 0, padding: '8px 28px',
          border: `1px solid ${C.sand}`,
        }}>
          {searchedFaqs ? (
            searchedFaqs.length > 0 ? (
              searchedFaqs.map((item) => (
                <div key={item.key} style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', top: 4, right: 0, fontSize: '0.72rem',
                    fontWeight: 700, color: C.coral, background: `${C.coral}12`,
                    padding: '2px 8px', borderRadius: 10
                  }}>{item.categoryTitle}</span>
                  <FAQItem
                    faq={item.faq}
                    isOpen={!!openItems[item.key]}
                    toggle={() => toggle(item.key, item.faq.id)}
                  />
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.textSec, fontStyle: 'italic' }}>
                Sin FAQs encontradas para "{faqSearch}". Intente otra palabra clave.
              </div>
            )
          ) : (
            (faqData[activeCategory] || faqData[0]).items.map((faq, i) => (
              <FAQItem
                key={`${activeCategory}-${i}`}
                faq={faq}
                isOpen={!!openItems[`${activeCategory}-${i}`]}
                toggle={() => toggle(`${activeCategory}-${i}`, faq.id)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────
const Footer: React.FC = () => (
  <footer style={{
    background: '#0A1F3F',
    color: C.white, padding: '100px 24px 40px',
    borderTop: `1px solid ${C.sand}`,
  }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Top CTA */}
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 400, margin: '0 0 16px', fontFamily: C.fontSerif, lineHeight: 1.2 }}>
          ¿Listo para invertir en Panamá?
        </h2>
        <p style={{ fontSize: '0.95rem', opacity: 0.85, maxWidth: 600, margin: '0 auto 36px', fontFamily: C.fontSans, letterSpacing: '0.02em', lineHeight: 1.6 }}>
          Nuestro equipo de asesores especializados está listo para acompañarte en cada paso.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://wa.me/573124824353?text=Hola%2C%20quiero%20información%20sobre%20proyectos%20GLP%20en%20Panamá" target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'transparent', color: C.white, padding: '14px 36px',
            borderRadius: 0, border: `1px solid ${C.white}`, fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
            textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'all 0.3s ease',
            fontFamily: C.fontSans,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.color = '#0A1F3F'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.white; }}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 12.008 0c3.233.001 6.274 1.26 8.561 3.549 2.288 2.289 3.543 5.332 3.541 8.566-.005 6.678-5.33 12.001-12.007 12.001-2.005-.001-3.973-.5-5.739-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.02-5.11-2.881-6.974-1.862-1.864-4.343-2.89-6.984-2.892-5.437 0-9.863 4.42-9.866 9.86-.001 1.702.463 3.364 1.34 4.814l-.995 3.636 3.712-.973zm11.725-7.39c-.314-.157-1.854-.915-2.145-1.02-.29-.105-.503-.157-.714.157-.212.314-.82.1.02-.916.21-.105.419-.21.713-.315.295-.105.503-.052.66.105.157.157.66.65.717.758.057.108.114.234.057.34-.056.11-.29.27-.419.42-.128.15-.262.315-.393.456l-.371.371c-.34.34-.419.34-.714.21-.295-.157-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.294-.34.442-.511.147-.17.196-.29.294-.485.099-.197.05-.371-.025-.512-.075-.148-.713-1.72-.977-2.355-.257-.617-.52-.533-.713-.542-.185-.01-.397-.01-.61-.01-.212 0-.556.08-.846.397-.29.314-1.11 1.087-1.11 2.65 0 1.563 1.139 3.076 1.297 3.287.157.21 2.24 3.42 5.423 4.794.757.327 1.348.521 1.81.667.76.241 1.453.207 2.002.125.612-.091 1.854-.758 2.118-1.49.264-.733.264-1.36.185-1.492-.078-.133-.29-.21-.605-.367z" />
            </svg>
            WhatsApp
          </a>
        </div>
      </div>

      {/* Social Links */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 32, flexWrap: 'wrap'
      }}>
        {[
          { label: 'Instagram', url: '#' },
          { label: 'LinkedIn', url: '#' },
          { label: 'YouTube', url: '#' },
          { label: 'Facebook', url: '#' },
        ].map(s => (
          <a key={s.label} href={s.url} style={{
            textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.6)', transition: 'all 0.3s ease',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            fontFamily: C.fontSans, borderBottom: '1px solid transparent',
            paddingBottom: 4
          }}
            onMouseEnter={e => { e.currentTarget.style.color = C.white; e.currentTarget.style.borderBottomColor = C.white; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderBottomColor = 'transparent'; }}
            title={s.label}>
            {s.label}
          </a>
        ))}
      </div>

      {/* Legal disclaimer */}
      <div style={{
        textAlign: 'center', padding: '24px 0',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <p style={{ margin: '0 0 12px', fontSize: '0.75rem', opacity: 0.5, maxWidth: 750, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6, fontFamily: C.fontSans }}>
          Disclaimer: La información presentada en este sitio es de carácter informativo y no constituye una oferta de inversión ni asesoría financiera, legal o tributaria.
          Los rendimientos pasados no garantizan resultados futuros. Las proyecciones de rentabilidad son estimaciones basadas en datos de mercado y pueden variar.
          Se recomienda consultar con asesores profesionales antes de tomar decisiones de inversión. GLP y sus aliados actúan como facilitadores de información, no como fiduciarios.
        </p>
        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, fontWeight: 500, fontFamily: C.fontSans, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          © 2026 Capital Brokers Properties. Todos los derechos reservados.
        </p>
      </div>
    </div>
  </footer>
)

// ────────────────────────────────────────────────────────
const GlobalStyles: React.FC = () => (
  <style>{`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html {
      scroll-behavior: smooth;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${C.bg};
      color: ${C.text};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    ::selection {
      background: ${C.teal};
      color: white;
    }
    input:focus, select:focus {
      border-color: ${C.teal} !important;
      box-shadow: 0 0 0 3px ${C.teal}20;
    }
    @media (max-width: 768px) {
      .nav-links-desktop { display: none !important; }
      .nav-hamburger { display: block !important; }
    }
  `}</style>
)

// ────────────────────────────────────────────────────────
// Un solo bloque para "¿en quién estoy confiando mi dinero?" — antes esta pregunta se
// respondía en tres momentos distintos del scroll (Razones para invertir con GLP,
// Trayectoria, Nosotros/aliados), sin conexión entre ellos. Ahora es una sola sección
// con tres sub-bloques en orden: quiénes somos (trayectoria) → por qué elegirnos →
// con quién trabajamos (aliados).
const WhyGLPSection: React.FC = () => {
  const reasons = [
    {
      title: 'Nuestra experiencia',
      desc: 'Casi 4 décadas de trayectoria y reputación nos avalan como una opción confiable y sólida para inversores que buscan oportunidades de alto rendimiento en el sector inmobiliario panameño.'
    },
    {
      title: 'Desarrollos disruptivos',
      desc: 'Diseñamos proyectos que rompen paradigmas, combinando innovación arquitectónica, ubicaciones estratégicas y rentabilidad comprobada para nuestros inversionistas.'
    },
    {
      title: 'Acompañamiento a tu medida',
      desc: 'Nos adaptamos a las necesidades de cada inversionista, con opciones flexibles de pago, acompañamiento personalizado y transparencia en cada etapa del proceso.'
    },
  ]

  return (
    <section id="trayectoria" style={{ padding: '90px 24px', background: C.white, borderBottom: `1px solid ${C.sand}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Quiénes somos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48, alignItems: 'center', marginBottom: 72 }}>
          <div>
            <span style={{
              display: 'inline-block', borderBottom: `1px solid ${C.teal}`,
              color: C.teal, paddingBottom: 4,
              fontSize: '0.7rem', fontWeight: 600, marginBottom: 14,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              fontFamily: C.fontSans
            }}>
              ¿Por qué GLP?
            </span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 400, color: C.red, margin: '0 0 20px', lineHeight: 1.15, fontFamily: C.fontSerif }}>
              Líderes en el Desarrollo Inmobiliario de Panamá
            </h2>
            <p style={{ fontSize: '1rem', color: C.textSec, lineHeight: 1.7, marginBottom: 20, fontFamily: C.fontSans }}>
              Con más de <strong>40 años de trayectoria</strong>, Capital Brokers Properties se ha consolidado como la empresa promotora y desarrolladora inmobiliaria más importante y confiable de Panamá, transformando el paisaje urbano de la región con proyectos icónicos de clase mundial.
            </p>
            <p style={{ fontSize: '0.95rem', color: C.textSec, lineHeight: 1.7, marginBottom: 28, fontFamily: C.fontSans }}>
              Nuestra trayectoria incluye el diseño, desarrollo y entrega de mega-proyectos emblemáticos que redefinieron el comercio y el estilo de vida, tales como <strong>Albrook Mall</strong> (el centro comercial más grande de América Latina), las exclusivas <strong>Ocean Reef Islands</strong> (las primeras islas artificiales de la región), <strong>Santa María Golf & Country Club</strong>, <strong>Federal Mall</strong> en David, y residencias de lujo y playa de altísimo valor.
            </p>
            <a href="#contact" onClick={e => { e.preventDefault(); smoothScroll('contact') }} style={{
              display: 'inline-block', background: C.teal, color: C.white,
              padding: '13px 32px', textDecoration: 'none', fontWeight: 600, fontSize: '0.75rem',
              textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: C.fontSans,
              transition: 'background 0.2s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.red}
              onMouseLeave={e => e.currentTarget.style.background = C.teal}
            >
              Contacto
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {[
              { number: '40+', label: 'Años de Experiencia', desc: 'Liderando el mercado regional.' },
              { number: '60+', label: 'Proyectos Entregados', desc: 'Residenciales, comerciales y hubs.' },
              { number: '26,000+', label: 'Unidades Entregadas', desc: 'Familias e inversionistas felices.' },
              { number: '5M+', label: 'Metros Cuadrados', desc: 'De construcción con el más alto estándar.' },
            ].map((stat, idx) => (
              <div key={idx} style={{
                background: C.bg, borderRadius: 0, padding: '28px 20px',
                border: `1px solid ${C.sand}`, display: 'flex', flexDirection: 'column',
                justifyContent: 'center', transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.background = C.white; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.sand; e.currentTarget.style.background = C.bg; }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 400, color: C.teal, marginBottom: 6, fontFamily: C.fontSerif }}>{stat.number}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: C.fontSans }}>{stat.label}</div>
                <div style={{ fontSize: '0.8rem', color: C.textSec, lineHeight: 1.4, fontFamily: C.fontSans }}>{stat.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Por qué elegirnos */}
        <div style={{ marginBottom: 72 }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 400, color: C.teal, fontFamily: C.fontSerif, textAlign: 'center', marginBottom: 32 }}>
            Razones para invertir con Capital Brokers Properties
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {reasons.map(r => (
              <div key={r.title} style={{ background: C.bg, border: `1px solid ${C.sand}`, padding: '28px 24px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '1.02rem', fontWeight: 600, color: C.text, fontFamily: C.fontSans }}>{r.title}</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: C.textSec, lineHeight: 1.65, fontFamily: C.fontSans }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Con quién trabajamos */}
        <div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 400, color: C.teal, fontFamily: C.fontSerif, textAlign: 'center', marginBottom: 12 }}>
            Un Ecosistema de Confianza para tu Inversión
          </h3>
          <p style={{ fontSize: '0.9rem', color: C.textSec, maxWidth: 700, margin: '0 auto 32px', textAlign: 'center', fontFamily: C.fontSans, lineHeight: 1.7 }}>
            Aliados especializados que acompañan al inversionista colombiano en cada etapa: estructuración financiera y asesoría legal.
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 32, maxWidth: 760, margin: '0 auto',
          }}>
            <div style={{ padding: '28px 26px', border: `1px solid ${C.sand}`, borderTop: `3px solid ${C.red}`, background: C.bg }}>
              <h4 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '0.8rem', fontFamily: C.fontSans, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.red }}>
                Capital Brokers
              </h4>
              <p style={{ margin: 0, color: C.textSec, fontSize: '0.88rem', lineHeight: 1.6, fontFamily: C.fontSans }}>
                Firma global de banca de inversión y placement agent con presencia en Colombia, España, Panamá, Estados Unidos y EAU. Especialistas en estructuración financiera, levantamiento de capital, soluciones de capital de trabajo internacional (factoring) y estructuración de fondos de capital privado.
              </p>
            </div>
            <div style={{ padding: '28px 26px', border: `1px solid ${C.sand}`, borderTop: `3px solid ${C.red}`, background: C.bg }}>
              <h4 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '0.8rem', fontFamily: C.fontSans, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.red }}>
                Colombia Law Group
              </h4>
              <p style={{ margin: 0, color: C.textSec, fontSize: '0.88rem', lineHeight: 1.6, fontFamily: C.fontSans }}>
                Firma legal que ofrece servicios jurídicos y tributarios expertos para extranjeros y empresas en Colombia. Especialistas en estructuración de inversiones, derecho inmobiliario, procesos de visas y migración, derecho cambiario, societario y comercial.
              </p>
            </div>
            {/* Grupo Valverde — oculto a pedido de Armando (2026-08-11), se retomará a futuro.
            <div style={{ padding: '28px 26px', border: `1px solid ${C.sand}`, borderTop: `3px solid ${C.red}`, background: C.bg }}>
              <h4 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '0.8rem', fontFamily: C.fontSans, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.red }}>
                Grupo Valverde
              </h4>
              <p style={{ margin: 0, color: C.textSec, fontSize: '0.88rem', lineHeight: 1.6, fontFamily: C.fontSans }}>
                En Grupo Valverde creamos más que proyectos inmobiliarios; construimos hogares que equilibran lo económico, social y ambiental en Colombia. Nuestro compromiso es ofrecer viviendas de alta calidad, accesibles y con un enfoque de sostenibilidad.
              </p>
            </div>
            */}
          </div>
        </div>

      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────
// Prueba social — trae los testimonios marcados "Publicado" desde el CRM (Campañas de
// Marketing → Testimonios). Si no hay ninguno publicado todavía, la sección no se
// renderiza — mejor no mostrar nada que mostrar un bloque vacío o de relleno.
type Testimonial = { id: string; nombre: string; rol: string; ciudad: string; foto_url: string; texto: string; rating: number };

const TestimonialsSection: React.FC = () => {
  const [items, setItems] = React.useState<Testimonial[]>([]);
  React.useEffect(() => {
    fetch(`${API_ROOT}/api/testimonials?status=published`)
      .then(r => r.json())
      .then(rows => setItems(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <section id="testimonios" style={{ padding: '90px 24px', background: C.bg, borderBottom: `1px solid ${C.sand}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <span style={{
            display: 'inline-block', borderBottom: `1px solid ${C.coral}`,
            color: C.coral, paddingBottom: 4,
            fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em',
            textTransform: 'uppercase', marginBottom: 12,
            fontFamily: C.fontSans,
          }}>Lo que dicen nuestros inversionistas</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 400, color: C.teal, margin: 0, fontFamily: C.fontSerif }}>
            Confianza construida con hechos
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
          {items.map(t => (
            <div key={t.id} style={{ background: C.white, border: `1px solid ${C.sand}`, padding: '28px 26px', textAlign: 'left' }}>
              <div style={{ color: C.coral, fontSize: '0.8rem', letterSpacing: 2, marginBottom: 14 }}>{'★'.repeat(t.rating || 5)}</div>
              <p style={{ fontFamily: C.fontSerif, fontStyle: 'italic', fontSize: '1rem', color: C.text, lineHeight: 1.55, margin: '0 0 20px' }}>
                "{t.texto}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {t.foto_url ? (
                  <img src={t.foto_url} alt={t.nombre} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.sand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: C.teal, fontFamily: C.fontSans }}>
                    {t.nombre.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.teal, fontFamily: C.fontSans }}>{t.nombre}</div>
                  <div style={{ fontSize: '0.72rem', color: C.textSec, fontFamily: C.fontSans }}>{[t.rol, t.ciudad].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────
// NosotrosSection se fusionó dentro de WhyGLPSection (sub-bloque "Con quién
// trabajamos") — antes era una sección aparte repitiendo la misma pregunta de
// confianza que Trayectoria y Razones para invertir, más abajo en el scroll.

const saveProspectToLocal = (name: string, email: string, phone: string, project: string, message: string, channel: string, projects: Project[] = PROJECTS) => {
  const saved = localStorage.getItem('glp_crm_prospects');
  let currentProspects = [];
  if (saved) {
    try {
      currentProspects = JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }

  // ────────────────────────────────────────────────────────
  const projObj = projects.find(p => p.name === project);
  const budget = projObj ? projObj.price : 300000;

  // ────────────────────────────────────────────────────────
  const nameParts = name.trim().split('- ');
  const firstName = nameParts[0] || 'Cliente';
  const lastName = nameParts.slice(1).join(' ') || 'S/A';

  const newLead = {
    id: Date.now(),
    nombre: firstName,
    apellido: lastName,
    direccion: 'Colombia',
    correo: email,
    telefono: phone,
    ocupacion: 'Inversionista',
    proyectos_interes: [project],
    forma_contacto: channel || 'Web',
    broker_assigned: 'Patricia Vargas',
    estado: 'Contacto Inicial',
    presupuesto_usd: budget,
    notas: message || 'Interesado en información del proyecto.',
    historial: [
      {
        fecha: new Date().toLocaleDateString('es-CO'),
        accion: 'Contacto inicial',
        detalle: `Registrado en la landing page para el proyecto ${project}.`
      }
    ],
    fecha_entrada: new Date().toISOString().split('T')[0]
  };

  currentProspects.unshift(newLead);
  localStorage.setItem('glp_crm_prospects', JSON.stringify(currentProspects));
};

// Rango de presupuesto en el formulario en vez de un número exacto — menos fricción para el
// visitante, y llega directo sin depender de que la IA lo infiera de una conversación (el
// formulario web nunca manda transcript, así que antes ese dato nunca se registraba).
const PRESUPUESTO_RANGOS: { value: string; label: string; usd: number | null }[] = [
  { value: '', label: 'Prefiero no indicarlo', usd: null },
  { value: 'lt200', label: 'Menos de $200,000', usd: 150000 },
  { value: '200-400', label: '$200,000 – $400,000', usd: 300000 },
  { value: '400-600', label: '$400,000 – $600,000', usd: 500000 },
  { value: 'gt600', label: 'Más de $600,000', usd: 700000 },
];

const ContactSection: React.FC<{
  contactProject: string;
  setContactProject: (p: string) => void;
  projects: Project[];
}> = ({ contactProject, setContactProject, projects }) => {
  const [nombre, setNombre] = React.useState('');
  const [correo, setCorreo] = React.useState('');
  const [whatsapp, setWhatsapp] = React.useState('');
  const [mensaje, setMensaje] = React.useState('');
  const [channel, setChannel] = React.useState('Broker');
  const [presupuesto, setPresupuesto] = React.useState('');
  const [citaFecha, setCitaFecha] = React.useState('');
  const [citaHora, setCitaHora] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [citaAgendada, setCitaAgendada] = React.useState(false);

  const horaSlots = React.useMemo(() => {
    const slots: string[] = [];
    for (let h = 9; h <= 17; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      if (h < 17) slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !correo) {
      alert('Por favor, complete los campos obligatorios (Nombre y Correo).');
      return;
    }

    // ────────────────────────────────────────────────────────
    saveProspectToLocal(nombre, correo, whatsapp, contactProject, mensaje, channel, projects);

    // ────────────────────────────────────────────────────────
    try {
      await fetch(`${API_ROOT}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nombre,
          email: correo,
          phone: whatsapp,
          project: contactProject,
          message: mensaje,
          channel: channel || 'Web',
          presupuesto_usd: PRESUPUESTO_RANGOS.find(r => r.value === presupuesto)?.usd ?? undefined
        })
      });
      localStorage.setItem('glp_session_prospect', JSON.stringify({ email: correo, nombre }));
    } catch (err) {
      console.warn('Backend server is offline or unreachable. SMTP mail skipped, operating in standalone localStorage mode.', err);
    }

    let citaOk = false;
    if (citaFecha && citaHora) {
      try {
        await fetch(`${API_ROOT}/api/citas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospecto_email: correo,
            prospecto_nombre: nombre,
            proyecto: contactProject,
            fecha: citaFecha,
            hora: citaHora,
            canal: channel || 'Web',
            notas: mensaje
          })
        });
        citaOk = true;
      } catch (err) {
        console.warn('No se pudo agendar la cita (backend offline).', err);
      }
    }

    setSubmitted(true);
    setCitaAgendada(citaOk);
    setNombre('');
    setCorreo('');
    setWhatsapp('');
    setMensaje('');
    setPresupuesto('');
    setCitaFecha('');
    setCitaHora('');

    const targetProject = contactProject;
    setTimeout(() => {
      setSubmitted(false);
      setCitaAgendada(false);
      setContactProject('General');
      if (targetProject && targetProject !== 'General') {
        const el = document.getElementById(`project-card-${encodeURIComponent(targetProject)}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 2000);
  };

  const nowStr = new Date().toLocaleString('es-CO');

  return (
    <section id="contact" style={{
      padding: '100px 24px',
      background: C.teal,
      color: '#FFFFFF',
      position: 'relative' as const,
      overflow: 'hidden'
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{
            display: 'inline-block', borderBottom: '1px solid #FFFFFF',
            color: '#FFFFFF', paddingBottom: 4,
            fontSize: '0.7rem', fontWeight: 600, marginBottom: 14,
            textTransform: 'uppercase', letterSpacing: '0.15em',
            fontFamily: C.fontSans
          }}>CONTACTO</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 400, margin: '0 0 12px', fontFamily: C.fontSerif }}>
            Solicita Información Especializada
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#CBD5E1', maxWidth: 600, margin: '0 auto', fontFamily: C.fontSans, letterSpacing: '0.02em' }}>
            Déjanos tus datos de contacto para enviarte las fichas técnicas ampliadas y estructurar tu plan de inversión en dólares.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: C.white, borderRadius: 0, padding: '40px 32px',
          border: `1px solid ${C.sand}`, color: C.text,
          maxWidth: 600, margin: '0 auto', fontFamily: C.fontSans
        }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>
              Nombre Completo <span style={{ color: C.coral }}>*</span>
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                background: C.white, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>
                Correo Electrónico <span style={{ color: C.coral }}>*</span>
              </label>
              <input
                type="email"
                required
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                placeholder="juan.perez@correo.com"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>
                WhatsApp (Opcional)
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="Ej. +57 312 482 4353"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>
              Proyecto de Interés
            </label>
            <select
              value={contactProject}
              onChange={e => setContactProject(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                background: C.white, cursor: 'pointer', outline: 'none', boxSizing: 'border-box'
              }}
            >
              <option value="General">Consulta General (Todos los proyectos)</option>
              {projects.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>
              ¿Cómo nos encontró?
            </label>
            <select
              value={channel}
              onChange={e => setChannel(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                background: C.white, cursor: 'pointer', outline: 'none', boxSizing: 'border-box'
              }}
            >
              <option value="Broker">Broker / Corredor</option>
              <option value="Web">Búsqueda Web</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
              <option value="YouTube">YouTube</option>
              <option value="Evento">Evento / Conferencia</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Referido">Referido o Recomendado</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>
              Presupuesto Estimado (Opcional)
            </label>
            <select
              value={presupuesto}
              onChange={e => setPresupuesto(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                background: C.white, cursor: 'pointer', outline: 'none', boxSizing: 'border-box'
              }}
            >
              {PRESUPUESTO_RANGOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>
              Agendar Cita (Opcional)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <input
                type="date"
                value={citaFecha}
                onChange={e => setCitaFecha(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box'
                }}
              />
              <select
                value={citaHora}
                onChange={e => setCitaHora(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                  background: C.white, cursor: 'pointer', outline: 'none', boxSizing: 'border-box'
                }}
              >
                <option value="">Hora (opcional)</option>
                {horaSlots.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>
              Mensaje / Comentarios
            </label>
            <textarea
              rows={4}
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Describa su consulta o el tipo de activo que busca..."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                background: C.white, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {submitted && (
            <div style={{
              background: '#F9FAFB',
              color: C.teal,
              padding: '16px',
              borderRadius: 0,
              marginBottom: '20px',
              fontSize: '0.85rem',
              fontWeight: 500,
              border: `1px solid ${C.teal}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div>
                <strong>Solicitud recibida.</strong> Tu información ha sido registrada en el sistema de atención y nos contactaremos a la brevedad.
                {citaAgendada && <> <strong>Tu cita ha quedado agendada.</strong></>}
              </div>
            </div>
          )}

          <button type="submit" style={{
            width: '100%', background: C.coral, color: C.white,
            padding: '14px 28px', border: `1px solid ${C.coral}`, borderRadius: 0,
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            transition: 'all 0.3s ease',
            boxShadow: 'none',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.coral; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.coral; e.currentTarget.style.color = C.white; }}
          >
            Enviar Solicitud e Iniciar Proceso
          </button>
        </form>
      </div>
    </section>
  );
};




// ────────────────────────────────────────────────────────
const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<{id: number, text: string, sender: 'bot' | 'user'}[]>([
    { id: 1, text: '¡Hola! Soy Sara, del equipo de atención al cliente de Capital Brokers Properties. Cuéntame, ¿qué te trajo por aquí hoy?', sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const endOfMessagesRef = React.useRef<HTMLDivElement>(null);
  // Antes cada mensaje calificante creaba/parchaba el prospecto usando el correo como llave
  // (o un correo SINTÉTICO tipo "sin-correo-...@chatbot.glp" cuando no había uno real, que
  // terminaba visible en el CRM). Ahora cada apertura del widget tiene un session_id estable
  // que el backend usa para acumular TODA la conversación en una sola fila desde el primer
  // mensaje que trae contacto real — ya no se registra nada sin correo/teléfono real, y ya
  // no se inventa un correo falso.
  const sessionIdRef = React.useRef(`chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const leadRegisteredRef = React.useRef(false);

  React.useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    const newMsg = { id: Date.now(), text, sender: 'user' as const };
    const currentMessages = [...messages, newMsg];
    setMessages(currentMessages);
    setInputValue('');
    setIsTyping(true);

    // ────────────────────────────────────────────────────────
    const lower = text.toLowerCase();
    // Tolera espacios sueltos alrededor de "@" (ej. "fulano @ gmail.com", común al escribir
    // rápido desde el celular) — antes esos casos no matcheaban y el prospecto nunca se
    // registraba pese a que el visitante sí dejó su correo.
    const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+\s*@\s*[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    // Teléfono: mínimo 10 dígitos seguidos (evita capturar presupuestos como 250000)
    const phoneMatch = text.match(/[\+]?[\d][\d\s\-\(\)]{9,}/);
    const hasContactInfo = !!(emailMatch || phoneMatch);
    // Solo se registra un prospecto cuando hay un dato de contacto real (correo o teléfono)
    // en el mensaje actual, o cuando la sesión YA quedó registrada antes (para que el resto
    // de la conversación se siga acumulando en la misma fila, con presupuesto/temas de
    // interés actualizados) — ya no hay auto-registro a los 3 turnos sin contacto.
    const shouldRegister = hasContactInfo || leadRegisteredRef.current;
    if (shouldRegister) {
      const extractedEmail = emailMatch ? emailMatch[0].replace(/\s+/g, '').trim() : '';
      const extractedPhone = phoneMatch ? phoneMatch[0].replace(/\s+/g, '').trim() : '';
      leadRegisteredRef.current = true;
      fetch(`${API_ROOT}/api/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Visitante Web',
          email: extractedEmail,
          phone: extractedPhone,
          project: 'Asesora Personalizada - GLP',
          message: hasContactInfo ? `Datos de contacto: ${text}` : text,
          channel: 'Chatbot SARA',
          sessionId: sessionIdRef.current,
          conversationHistory: currentMessages.map(m => `${m.sender === 'user' ? 'Cliente' : 'SARA'}: ${m.text}`).join('\n')
        })
      }).catch(()=>null);
    }

    try {
      const res = await fetch(`${API_ROOT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // sessionId permite al backend correlacionar esta conversación con el prospecto
        // real (creado por /api/contact vía chat_session_id) para guardar ahí el perfil
        // psicográfico que Sofía detecta en vivo — sin esto, el perfil nunca llegaría al CRM.
        body: JSON.stringify({ messages: currentMessages, sessionId: sessionIdRef.current })
      });
      
      const data = await res.json();
      
      if (res.ok && data.reply) {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now()+1, text: data.reply, sender: 'bot' }]);
      } else {
        throw new Error(data.error || 'Error en API');
      }
    } catch (err) {
      console.error("OpenAI API Fallback:", err);
      // ────────────────────────────────────────────────────────
      setTimeout(() => {
        setIsTyping(false);
        let botResponse = '¡Entiendo! Para brindarte la mejor asesoría con toda nuestra información, ¿podrías dejarme tu correo o número de WhatsApp y un broker especializado de Capital Brokers Properties se comunicará contigo de inmediato?';
        if (hasContactInfo) {
            botResponse = '¡Gracias por tus datos! Los hemos registrado exitosamente. Un asesor se comunicará contigo muy pronto. ¡Excelente día!';
        }
        setMessages(prev => [...prev, { id: Date.now()+1, text: botResponse, sender: 'bot' }]);
      }, 1000);
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        fontFamily: C.fontSans
      }}>
        {isOpen && (
          <div style={{
            width: '350px', height: '500px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(15px)',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,35,73,0.15)',
            border: `1px solid ${C.sand}`,
            marginBottom: '16px',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Header */}
            <div style={{
              background: `linear-gradient(135deg, ${C.teal} 0%, ${C.sky} 100%)`,
              padding: '16px 20px', color: C.white,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  <img src="/img/agents/sara.png" alt="SARA" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e)=> e.currentTarget.style.display = 'none'} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Sara Valenzuela</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>Atención al Cliente · GLP</div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{
                background: 'none', border: 'none', color: C.white, cursor: 'pointer', fontSize: '1.2rem'
              }}>✕</button>
            </div>
            
            {/* Body */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: '#F8FAFC' }}>
              {messages.map(m => (
                <div key={m.id} style={{
                  maxWidth: '85%', padding: '12px 16px', borderRadius: '14px',
                  fontSize: '0.85rem', lineHeight: 1.4,
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: m.sender === 'user' ? C.teal : C.white,
                  color: m.sender === 'user' ? C.white : C.text,
                  border: m.sender === 'bot' ? `1px solid ${C.sand}` : 'none',
                  borderBottomRightRadius: m.sender === 'user' ? '4px' : '14px',
                  borderBottomLeftRadius: m.sender === 'bot' ? '4px' : '14px',
                }}>
                  {m.text.split(/\*\*(.*?)\*\*/g).map((part, i) => 
                    i % 2 === 1 
                      ? <strong key={i} style={{ fontWeight: 700 }}>{part}</strong>
                      : <span key={i}>{part}</span>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div style={{
                  maxWidth: '50px', padding: '12px 16px', borderRadius: '14px',
                  background: C.white, border: `1px solid ${C.sand}`,
                  borderBottomLeftRadius: '4px', alignSelf: 'flex-start',
                  display: 'flex', gap: '4px', alignItems: 'center'
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.textSec, animation: 'bounce 1.4s infinite ease-in-out both' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.textSec, animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.textSec, animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
                </div>
              )}
              <div ref={endOfMessagesRef} />
            </div>

            {/* Suggested prompts (only if last message is from bot and not typing) */}
            {!isTyping && messages[messages.length-1]?.sender === 'bot' && (
              <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#F8FAFC' }}>
                 <button type="button" onClick={()=>handleSend('¿Qué rentabilidad ofrecen?')} style={{ fontSize: '0.7rem', padding: '6px 10px', borderRadius: '20px', border: `1px solid ${C.teal}`, background: 'transparent', color: C.teal, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e=>(e.currentTarget.style.background=C.teal, e.currentTarget.style.color=C.white)} onMouseLeave={e=>(e.currentTarget.style.background='transparent', e.currentTarget.style.color=C.teal)}>Rentabilidad</button>
                 <button type="button" onClick={()=>handleSend('Información de visa de inversionista')} style={{ fontSize: '0.7rem', padding: '6px 10px', borderRadius: '20px', border: `1px solid ${C.teal}`, background: 'transparent', color: C.teal, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e=>(e.currentTarget.style.background=C.teal, e.currentTarget.style.color=C.white)} onMouseLeave={e=>(e.currentTarget.style.background='transparent', e.currentTarget.style.color=C.teal)}>Visa Inversionista</button>
                 <button type="button" onClick={()=>handleSend('Quiero hablar con un asesor')} style={{ fontSize: '0.7rem', padding: '6px 10px', borderRadius: '20px', border: `1px solid ${C.teal}`, background: 'transparent', color: C.teal, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e=>(e.currentTarget.style.background=C.teal, e.currentTarget.style.color=C.white)} onMouseLeave={e=>(e.currentTarget.style.background='transparent', e.currentTarget.style.color=C.teal)}>Asesor Humano</button>
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.sand}`, display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Escribe tu mensaje..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter') handleSend(inputValue) }}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '20px', border: `1px solid ${C.sand}`,
                  outline: 'none', fontSize: '0.85rem', fontFamily: C.fontSans
                }}
              />
              <button type="button"
                onClick={() => handleSend(inputValue)}
                disabled={!inputValue.trim()}
                style={{
                  width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                  background: inputValue.trim() ? C.teal : '#E2E8F0',
                  color: C.white, cursor: inputValue.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.3s'
                }}
              >
                ➤
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.teal} 0%, ${C.sky} 100%)`,
            color: C.white, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', overflow: 'hidden',
            boxShadow: '0 4px 15px rgba(14, 165, 172, 0.4)',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Chatea con Sara"
        >
          {isOpen ? (
            <span style={{ fontSize: '1.5rem' }}>✕</span>
          ) : (
            // Foto de Sara en vez del ícono genérico de burbuja de chat — le pone cara
            // humana al widget, igual que en el resto del CRM.
            <img src="/img/agents/sara.png" alt="Sara" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span style="font-size:1.4rem;font-weight:800">S</span>'; }} />
          )}
        </button>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
};

// ────────────────────────────────────────────────────────
const LandingPage: React.FC = () => {
  const [contactProject, setContactProject] = React.useState<string>('General')
  const [projectsList, setProjectsList] = React.useState<Project[]>(PROJECTS)

  // main.tsx usa projectsData.ts (tipo Project con campo 'beds', 'area', etc.)
  // El endpoint /api/projects sirve ProjectData del CRM (campo 'bedrooms') — estructuras distintas
  // La landing mantiene su propio catálogo estático en projectsData.ts (copy de marketing),
  // pero las FOTOS sí se homologan con el CRM en tiempo real vía liveProjectImages.ts.
  const [, setImgTick] = React.useState(0);
  React.useEffect(() => { fetchLiveProjectImages().then(() => setImgTick(t => t + 1)); }, []);
  // Sobrescribe precio/área/recámaras/baños con los rangos reales del inventario (unidad-por-unidad)
  // cuando el proyecto ya tiene unidades cargadas — mismo patrón de tick que las fotos en vivo.
  const [, setUnidTick] = React.useState(0);
  React.useEffect(() => { applyUnidadesToProjects().then(changed => { if (changed) setUnidTick(t => t + 1); }); }, []);

  // Filtros del buscador rápido del hero — se aplican a Proyectos al hacer clic en
  // "Buscar". Objeto nuevo en cada búsqueda (no solo los valores) para que el efecto
  // en ProjectsSection dispare incluso si el usuario busca dos veces seguidas con los
  // mismos filtros.
  const [heroFilters, setHeroFilters] = React.useState<{ category: string; price: string; beds: string } | null>(null);

  // ────────────────────────────────────────────────────────

  return (
    <>
      <GlobalStyles />
      {/* Orden pensado desde la decisión de compra: el portafolio (lo que la
          persona vino a ver) sube justo después del hero, en vez de aparecer
          recién en cuarto lugar. Trayectoria/Nosotros (credibilidad de marca)
          se mueven después de "¿Por qué Panamá?" — siguen presentes, solo ya
          no son lo primero que se ve tras el hero. */}
      <Navbar />
      <Hero onSearch={f => setHeroFilters({ ...f })} />
      <ProjectsSection
        projects={projectsList}
        initialFilters={heroFilters}
      />
      {/* Un solo bloque por tema: primero país (¿Por qué Panamá?), después empresa
          (¿Por qué GLP? — fusiona lo que antes eran Trayectoria, Razones para invertir
          y Nosotros/aliados en tres momentos separados del scroll). */}
      <section id="why-panama" style={{ background: C.white, borderBottom: `1px solid ${C.sand}` }}>
        <WhyPanamaSection />
      </section>
      <WhyGLPSection />
      <TestimonialsSection />
      <FAQSection />
      <ContactSection
        contactProject={contactProject}
        setContactProject={setContactProject}
        projects={projectsList}
      />
      <Footer />

      {/* El acceso al CRM se movió al menú principal ("Intranet") — antes era este
          botón flotante fijo en la esquina inferior izquierda. */}

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </>
  )
}

// ────────────────────────────────────────────────────────
const isProjectRoute = window.location.pathname.includes('project');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isProjectRoute ? <ProjectDetailView /> : <LandingPage />}
  </React.StrictMode>
)
