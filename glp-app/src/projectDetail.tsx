import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { PROJECTS, PROJECT_IMG, C, SEPARACION_PROYECTOS_DEFAULT, SeparacionProyectosTabla, getSeparacionProyecto, BROCHURES_LOCAL } from './projectsData';
import { getImageFor, fetchLiveProjectImages } from './liveProjectImages';
import { Lightbox, LightboxState } from './Lightbox';
import { API_ROOT } from './apiRoot';
import { applyUnidadesToProjects } from './unidadesOverride';

type SessionProspect = { email: string; nombre: string };

const useSessionProspect = (): SessionProspect | null => {
  const [prospect] = React.useState<SessionProspect | null>(() => {
    try {
      const raw = localStorage.getItem('glp_session_prospect');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  return prospect;
};

const trackCalculatorSignal = (prospect: SessionProspect | null, accion: string, detalle: string) => {
  if (!prospect) return;
  fetch(`${API_ROOT}/api/prospectos/by-email/${encodeURIComponent(prospect.email)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      historial_append: { fecha: new Date().toISOString(), accion, detalle }
    })
  }).catch(() => {});
};

const fmt = (n: number) => {
  const rounded = Math.round(n);
  return (rounded < 0 ? '-' : '') + '$' + Math.abs(rounded).toLocaleString('en-US');
};

const formatComma = (num: number) => {
  if (num === 0) return '0';
  if (!num) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const getZoneNotes = (zone: string) => {
  const z = zone.toLowerCase();
  if (z.includes('pacífica') || z.includes('pacifica') || z.includes('reef')) {
    return 'Punta Pacífica/Islas: Cercanía al Hospital Pacífica Salud (afiliado a Johns Hopkins Medicine), Multiplaza Mall, conexión directa al Corredor Sur y la exclusiva Marina Privada de Ocean Reef.';
  } else if (z.includes('santa maría') || z.includes('santa maria') || z.includes('este') || z.includes('viejo')) {
    return 'Santa María/Costa del Este: Entorno rodeado por el campo de golf Jack Nicklaus, Town Center Costa del Este, oficinas corporativas de multinacionales y los colegios bilingües más prestigiosos de la ciudad.';
  } else if (z.includes('caracol') || z.includes('chame')) {
    return 'Playa Caracol: 1.2 km de playa privada de arena blanca, academia de surf y proximidad al centro de servicios de Coronado (a 20 minutos) con clínicas y supermercados.';
  } else if (z.includes('dorada') || z.includes('arraiján') || z.includes('arraijan') || z.includes('pacífico') || z.includes('pacifico')) {
    return 'Pacífico/Arraiján: Rápida conectividad al Canal de Panamá, el Puente de las Américas y la futura Línea 3 del Metro, rodeado de áreas verdes protegidas y parques industriales logísticos.';
  }
  return 'Zona estratégica con alta valorización y conectividad de Grupo Los Pueblos.';
};

export const ProjectDetailView: React.FC = () => {
  const [, setImgTick] = React.useState(0);
  React.useEffect(() => { fetchLiveProjectImages().then(() => setImgTick(t => t + 1)); }, []);
  const [, setUnidTick] = React.useState(0);
  React.useEffect(() => {
    applyUnidadesToProjects().then(changed => {
      if (!changed) return;
      setUnidTick(t => t + 1);
      // El precio inicial de la calculadora se capturó con useState(project.price) ANTES
      // de que esta llamada mutara PROJECTS con el precio mínimo real del inventario — sin
      // este resync, la ficha técnica mostraba el precio correcto pero la calculadora
      // seguía usando el valor viejo de projectsData.ts (marketing estático).
      const p = PROJECTS.find(pr => pr.name.toLowerCase() === projectName.toLowerCase());
      if (p) { setPrecio(p.price); setMontoCuotaInicial(Math.round(p.price * 0.5)); }
    });
  }, []);
  const [lightbox, setLightbox] = React.useState<LightboxState | null>(null);
  React.useEffect(() => {
    const paramás = new URLSearchParams(window.location.search);
    const tab = paramás.get('tab');
    if (tab === 'cuota' || tab === 'credito') {
      setActiveCalcTab(tab);
      const el = document.getElementById('calculadoras-tabs');
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      }
    }
  }, []);

  const paramás = new URLSearchParams(window.location.search);
  const projectName = paramás.get('name') || paramás.get('project') || '';
  const project = PROJECTS.find(p => p.name.toLowerCase() === projectName.toLowerCase());
  
  if (!project) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: C.fontSans }}>
        <h2 style={{ color: C.teal, fontFamily: C.fontSerif, fontWeight: 400 }}>Proyecto no encontrado</h2>
        <p style={{ marginTop: 12, color: C.textSec }}>El proyecto seleccionado no existe o el enlace es incorrecto.</p>
        <a href="/" style={{ marginTop: 24, display: 'inline-block', background: C.teal, color: C.white, padding: '12px 24px', borderRadius: 0, textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volver a la página principal</a>
      </div>
    );
  }

  const imgs = getImageFor(project.name, PROJECT_IMG[project.name]);

  const sessionProspect = useSessionProspect();
  const handleCuotaCalculationComplete = React.useCallback(() => {
    trackCalculatorSignal(sessionProspect, 'Interacción con calculadora', `Completó un cálculo de cuota inicial (${project.name}).`);
  }, [sessionProspect, project.name]);

  const [precio, setPrecio] = useState(project.price);
  const [montoCuotaInicial, setMontoCuotaInicial] = useState(() => Math.round(project.price * 0.5));
  // Valor de Separación por Proyecto — configurable en el CRM (Configuración → Financiero).
  const [separacionTabla, setSeparacionTabla] = useState<SeparacionProyectosTabla>(SEPARACION_PROYECTOS_DEFAULT);
  React.useEffect(() => {
    fetch(`${API_ROOT}/api/settings/separacion_proyectos`)
      .then(r => r.json())
      .then(data => { if (data && data.porProyecto) setSeparacionTabla(data); })
      .catch(() => {});
  }, []);
  const separacionDefault = getSeparacionProyecto(project, separacionTabla);
  const [tasa, setTasa] = useState(8.5);
  const [plazo, setPlazo] = useState(20);
  const [activeCalcTab, setActiveCalcTab] = useState<'cuota' | 'credito'>('cuota');
  const [showContactModal, setShowContactModal] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMásg, setContactMásg] = useState(`Me interesa obtener información especializada para el proyecto ${project.name}.`);
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const saveProspectToLocal = (name: string, email: string, phone: string, project: string, message: string, price: number) => {
    const saved = localStorage.getItem('glp_crm_prospects');
    let currentProspects = [];
    if (saved) {
      try {
        currentProspects = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }

    const nameParts = name.trim().split(' ');
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
      forma_contacto: 'Web',
      broker_assigned: 'Patricia Vargas',
      estado: 'Contacto Inicial',
      presupuesto_usd: price,
      notas: message || 'Interesado en información del proyecto.',
      historial: [
        {
          fecha: new Date().toLocaleDateString('es-CO'),
          accion: 'Contacto inicial',
          detalle: `Registrado en la ficha técnica para el proyecto ${project}.`
        }
      ],
      fecha_entrada: new Date().toISOString().split('T')[0]
    };

    currentProspects.unshift(newLead);
    localStorage.setItem('glp_crm_prospects', JSON.stringify(currentProspects));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail) {
      alert('Por favor, complete los campos obligatorios (Nombre y Correo).');
      return;
    }

    saveProspectToLocal(contactName, contactEmail, contactPhone, project.name, contactMásg, project.price);

    try {
      await fetch('http://localhost:3001/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          project: project.name,
          message: contactMásg,
          channel: 'Web'
        })
      });
    } catch (err) {
      console.warn('Backend server is offline or unreachable. SMTP mail skipped, operating in standalone localStorage mode.', err);
    }

    setContactSubmitted(true);
    setContactName('');
    setContactEmail('');
    setContactPhone('');

    setTimeout(() => {
      setContactSubmitted(false);
      setShowContactModal(false);
    }, 2000);
  };

  const valorFinanciado = Math.max(0, precio - montoCuotaInicial);
  const r = (tasa / 12) / 100;
  const n = plazo * 12;
  const cuotaMensual = r > 0 ? (valorFinanciado * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : valorFinanciado / n;

  const planAmortizacion = React.useMemo(() => {
    const list = [];
    let balance = valorFinanciado;
    const rRate = (tasa / 12) / 100;
    const totalPayments = plazo * 12;
    const cuota = rRate > 0 ? (valorFinanciado * rRate * Math.pow(1 + rRate, totalPayments)) / (Math.pow(1 + rRate, totalPayments) - 1) : valorFinanciado / totalPayments;
    
    for (let yr = 1; yr <= plazo; yr++) {
      let interesesAño = 0;
      let principalAño = 0;
      const balanceInicial = balance;
      
      for (let m = 0; m < 12; m++) {
        const interesMes = balance * rRate;
        const principalMes = Math.min(balance, cuota - interesMes);
        interesesAño += interesMes;
        principalAño += principalMes;
        balance = Math.max(0, balance - principalMes);
      }
      
      list.push({
        año: yr,
        balanceInicial,
        pagosTotal: interesesAño + principalAño,
        intereses: interesesAño,
        principal: principalAño,
        balanceFinal: balance
      });
    }
    return list;
  }, [valorFinanciado, tasa, plazo]);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, paddingBottom: 80, fontFamily: C.fontSans }}>
      {/* Full-bleed Hero: cover photo as background, nav + title overlaid */}
      <div style={{
        position: 'relative', minHeight: 560, display: 'flex', flexDirection: 'column',
        backgroundImage: imgs?.main ? `linear-gradient(180deg, rgba(0,20,40,0.55) 0%, rgba(0,20,40,0.35) 35%, rgba(0,20,40,0.88) 100%), url(${imgs.main})` : undefined,
        backgroundColor: C.teal, backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        {/* Top navbar — transparent over the image */}
        <nav style={{ padding: '18px 28px', color: C.white, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  background: C.red, color: C.white,
                  padding: '3px 10px', borderRadius: 4,
                  fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em',
                  fontFamily: C.fontSans,
                }}>GLP</span>
                <span style={{ fontWeight: 400, fontSize: '1rem', color: C.white, fontFamily: C.fontSans }}>Properties</span>
              </div>
              <div style={{ height: 2, width: '100%', background: C.red, marginTop: 4 }} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: C.fontSans, color: 'rgba(255,255,255,0.85)' }}>Ficha Técnica Detallada</span>
          </div>
          <button onClick={() => {
            window.location.href = '/';
          }} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: C.white,
            padding: '8px 16px', borderRadius: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem',
            textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s ease',
            fontFamily: C.fontSans
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.teal; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.white; }}>
            Cerrar ✕
          </button>
        </nav>

        {/* Hero title block */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', padding: '0 28px 48px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px', fontFamily: C.fontSans, fontWeight: 600 }}>
              {project.zone}
            </p>
            <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4.2rem)', fontWeight: 400, color: C.white, margin: 0, fontFamily: C.fontSerif, lineHeight: 1.05, textShadow: '0 2px 24px rgba(0,0,0,0.35)' }}>
              {project.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 24, flexWrap: 'wrap' as const }}>
              <button
                onClick={() => setShowContactModal(true)}
                style={{
                  background: C.white, color: C.teal, border: 'none', padding: '14px 32px', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                  fontFamily: C.fontSans, transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = C.white; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.teal; }}
              >
                Solicitar Información
              </button>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontFamily: C.fontSerif, fontSize: '1.2rem' }}>
                Desde {fmt(project.price)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '40px auto 0', padding: '0 24px' }}>
        {/* Editorial Story Section */}
        {project.story && (
          <div style={{ marginBottom: 48 }}>
            {/* Lead statement — big, bold, pull-quote treatment */}
            <div style={{ borderLeft: `4px solid ${C.red}`, paddingLeft: 28, marginBottom: 32, maxWidth: 820 }}>
              <p style={{
                fontFamily: C.fontSerif, fontWeight: 600, fontStyle: 'italic',
                fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', lineHeight: 1.35,
                color: C.teal, margin: 0, letterSpacing: '-0.01em'
              }}>
                {project.story.paragraphs[0]}
              </p>
            </div>

            <div style={{ maxWidth: 760, marginBottom: 8 }}>
              {project.story.paragraphs.slice(1).map((p, i) => (
                <p key={i} style={{
                  fontFamily: C.fontSerif, fontWeight: 400, fontSize: '1.15rem',
                  lineHeight: 1.7, color: C.text, margin: '0 0 18px'
                }}>
                  {p}
                </p>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${C.sand}`, paddingTop: 36, marginTop: 16 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.18em', fontFamily: C.fontSans }}>
                Distribución
              </span>
              <h3 style={{
                fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', fontWeight: 600, color: C.red,
                fontFamily: C.fontSerif, margin: '8px 0 16px', letterSpacing: '-0.01em', lineHeight: 1.2
              }}>
                {project.story.distribucionTitle}
              </h3>
              <p style={{ fontSize: '1rem', lineHeight: 1.65, color: C.textSec, margin: '0 0 24px', maxWidth: 720 }}>
                {project.story.distribucionIntro}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px 28px' }}>
                {project.story.modelos.map((m, i) => (
                  <li key={i} style={{
                    fontSize: '0.95rem', color: C.text, fontWeight: 600,
                    display: 'flex', alignItems: 'baseline', gap: 10,
                  }}>
                    <span style={{ color: C.red, fontSize: '0.85rem' }}>✶</span>
                    {m}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: C.textSec, fontStyle: 'italic', margin: 0, maxWidth: 720 }}>
                {project.story.distribucionFooter}
              </p>
            </div>
          </div>
        )}

        {/* Pictures & Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32, marginBottom: 40 }}>
          
          {/* Left Column: Photos & Location */}
          <div>
            {/* Main Photo */}
            <div style={{ height: 420, borderRadius: 0, overflow: 'hidden', border: `1px solid ${C.sand}`, marginBottom: 20, cursor: 'zoom-in' }}
              onClick={() => {
                const allPhotos = imgs ? [imgs.main, ...imgs.gallery.filter(g => g !== imgs.main)] : [];
                if (allPhotos.length > 0) setLightbox({ photos: allPhotos, index: 0 });
              }}>
              <img src={imgs?.main} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            {/* Gallery Grid */}
            {imgs && imgs.gallery && imgs.gallery.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Galería de Imágenes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  {imgs.gallery.map((g, idx) => (
                    <div key={idx} style={{ height: 100, borderRadius: 0, overflow: 'hidden', border: `1px solid ${C.sand}`, cursor: 'zoom-in' }}
                      onClick={() => {
                        const allPhotos = [imgs.main, ...imgs.gallery.filter(gg => gg !== imgs.main)];
                        setLightbox({ photos: allPhotos, index: allPhotos.indexOf(g) });
                      }}>
                      <img src={g} alt={`${project.name} ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location & Zonas Cercanías */}
            <div style={{ background: C.white, borderRadius: 0, padding: 24, border: `1px solid ${C.sand}` }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Ubicación & Zonas de Interés Cercanías
              </h3>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: C.textSec, fontStyle: 'italic' }}>
                {getZoneNotes(project.zone)}
              </p>
            </div>
          </div>

          {/* Right Column: Spec sheet & Amenities */}
          <div>
            {/* Spec Sheet Table */}
            <div style={{ background: C.white, borderRadius: 0, padding: 24, border: `1px solid ${C.sand}`, marginBottom: 20 }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Ficha Técnica</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${C.sand}` }}>
                    <td style={{ padding: '12px 0', color: C.textSec, fontWeight: 500 }}>Precio Mínimo:</td>
                    <td style={{ padding: '12px 0', fontWeight: 700, color: C.teal, textAlign: 'right', fontFamily: C.fontSerif, fontSize: '1.05rem' }}>Desde {fmt(project.price)}</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${C.sand}` }}>
                    <td style={{ padding: '12px 0', color: C.textSec, fontWeight: 500 }}>Rango de Metrajes:</td>
                    <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>{project.area}</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${C.sand}` }}>
                    <td style={{ padding: '12px 0', color: C.textSec, fontWeight: 500 }}>Precio/m² estimado:</td>
                    <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>USD ${project.priceM2}</td>
                  </tr>
                  {/* Ocultado por solicitud: Renta/m² sugerido
                  <tr style={{ borderBottom: `1px solid ${C.sand}` }}>
                    <td style={{ padding: '12px 0', color: C.textSec, fontWeight: 500 }}>Renta/m² sugerido:</td>
                    <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>USD ${project.rentM2}</td>
                  </tr>
                  */}
                  {/* Ocultado por solicitud: Valorización anual prom
                  <tr style={{ borderBottom: `1px solid ${C.sand}` }}>
                    <td style={{ padding: '12px 0', color: C.textSec, fontWeight: 500 }}>Valorización anual prom:</td>
                    <td style={{ padding: '12px 0', fontWeight: 600, color: C.palm, textAlign: 'right' }}>+{project.appreciation} anual</td>
                  </tr>
                  */}
                  <tr style={{ borderBottom: `1px solid ${C.sand}` }}>
                    <td style={{ padding: '12px 0', color: C.textSec, fontWeight: 500 }}>Distribución:</td>
                    <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>{project.beds}</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${C.sand}` }}>
                    <td style={{ padding: '12px 0', color: C.textSec, fontWeight: 500 }}>Fecha de Entrega:</td>
                    <td style={{ padding: '12px 0', fontWeight: 700, color: C.coral, textAlign: 'right' }}>{project.delivery || 'Entrega Inmediata'}</td>
                  </tr>
                  {/* Ocultado por solicitud: Perfil del Inquilino
                  <tr>
                    <td style={{ padding: '12px 0', color: C.textSec, fontWeight: 500 }}>Perfil del Inquilino:</td>
                    <td style={{ padding: '12px 0', fontWeight: 600, color: C.text, textAlign: 'right', fontSize: '0.8rem' }}>{project.tenant}</td>
                  </tr>
                  */}
                </tbody>
              </table>
            </div>


            {/* Brochures — enlace TEMPORAL a ruta local mientras se suben a un hosting
                real (ver comentario en projectsData.ts, BROCHURE_BASE). No se muestra si el
                proyecto no tiene brochure cargado. */}
            {BROCHURES_LOCAL[project.name] && (
              <div style={{ background: C.white, borderRadius: 0, padding: 24, border: `1px solid ${C.sand}`, marginBottom: 20 }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Brochures
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {BROCHURES_LOCAL[project.name].map(b => (
                    <a key={b.url} href={b.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.teal, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, padding: '8px 10px', background: C.bg, border: `1px solid ${C.sand}` }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      {b.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities Card */}
            <div style={{ background: C.white, borderRadius: 0, padding: 24, border: `1px solid ${C.sand}` }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Amenities del Edificio
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {project.amenities.map(a => (
                  <span key={a} style={{ background: C.bg, color: C.teal, border: `1px solid ${C.sand}`, padding: '6px 12px', borderRadius: 0, fontSize: '0.72rem', fontWeight: 600 }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Calculadoras: Cuota Inicial / Crédito Hipotecario */}
        <div id="calculadoras-tabs" style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setActiveCalcTab('cuota')}
              style={{
                flex: 1,
                background: activeCalcTab === 'cuota' ? C.red : 'transparent',
                color: activeCalcTab === 'cuota' ? C.white : C.red,
                border: `1px solid ${C.red}`,
                borderRadius: 0,
                padding: '14px 28px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                transition: 'all 0.3s ease',
                fontFamily: C.fontSans
              }}
            >
              Simulación de Cuota Inicial
            </button>
            <button
              onClick={() => {
                setActiveCalcTab('credito');
                trackCalculatorSignal(sessionProspect, 'Interacción con calculadora', `Abrió el simulador de crédito hipotecario (${project.name}).`);
              }}
              style={{
                flex: 1,
                background: activeCalcTab === 'credito' ? C.red : 'transparent',
                color: activeCalcTab === 'credito' ? C.white : C.red,
                border: `1px solid ${C.red}`,
                borderRadius: 0,
                padding: '14px 28px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                transition: 'all 0.3s ease',
                fontFamily: C.fontSans
              }}
            >
              Simulación de Crédito Hipotecario
            </button>
          </div>
        </div>

        {/* Cuota Inicial Simulator */}
        {activeCalcTab === 'cuota' && (
          <CuotaInicialSimulator
            precio={precio}
            montoCuotaInicial={montoCuotaInicial}
            setPrecio={setPrecio}
            setMontoCuotaInicial={setMontoCuotaInicial}
            onCalculationComplete={handleCuotaCalculationComplete}
            separacionDefault={separacionDefault}
          />
        )}

        {/* Special Credit Calculator */}
        {activeCalcTab === 'credito' && (
        <div id="credit-calculator" style={{ background: C.white, borderRadius: 0, padding: 32, border: `1px solid ${C.sand}` }}>
          <div style={{ borderBottom: `2px solid ${C.red}`, paddingBottom: 12, marginBottom: 24 }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 400, color: C.red, fontFamily: C.fontSerif }}>
              Simulación de Crédito
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: C.textSec, fontFamily: C.fontSans }}>
              Calcula las cuotas mensuales de tu financiamiento hipotecario y visualiza el plan de pagos.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 36 }}>
            {/* Parameters */}
            <div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>Valor de la Propiedad (USD)</label>
                  <input
                    type="text"
                    value={formatComma(precio)}
                    onChange={e => {
                      const val = Number(e.target.value.replace(/\D/g, ''));
                      setPrecio(val);
                      setMontoCuotaInicial(Math.round(val * 0.5));
                    }}
                    style={{
                      width: 120, padding: '6px 10px', borderRadius: 0,
                      border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.teal,
                      fontWeight: 700, textAlign: 'right', outline: 'none', fontFamily: C.fontSans
                    }}
                  />
                </div>
                <input type="range" min={project.price} max={project.price * 3} step={10000} value={precio}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setPrecio(val);
                    setMontoCuotaInicial(Math.round(val * 0.5));
                  }}
                  style={{ width: '100%', accentColor: C.teal }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: C.textSec, marginTop: 4 }}>
                  <span>Min: {fmt(project.price)}</span>
                  <span>Max: {fmt(project.price * 3)}</span>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>Cuota Inicial (USD)</label>
                  <input
                    type="text"
                    value={formatComma(montoCuotaInicial)}
                    onChange={e => {
                      const val = Number(e.target.value.replace(/\D/g, ''));
                      setMontoCuotaInicial(Math.min(precio, val));
                    }}
                    style={{
                      width: 120, padding: '6px 10px', borderRadius: 0,
                      border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.teal,
                      fontWeight: 700, textAlign: 'right', outline: 'none', fontFamily: C.fontSans
                    }}
                  />
                </div>
                <input type="range" min={0} max={precio} step={1000} value={montoCuotaInicial} onChange={e => setMontoCuotaInicial(Number(e.target.value))}
                  style={{ width: '100%', accentColor: C.teal }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: C.textSec, marginTop: 4 }}>
                  <span>Min: $0</span>
                  <span>Max: {fmt(precio)}</span>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>Tasa de Interés (%)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={tasa}
                    onChange={e => setTasa(Number(e.target.value))}
                    style={{
                      width: 70, padding: '6px 10px', borderRadius: 0,
                      border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.teal,
                      fontWeight: 700, textAlign: 'right', outline: 'none', fontFamily: C.fontSans
                    }}
                  />
                </div>
                <input type="range" min={1} max={15} step={0.1} value={tasa} onChange={e => setTasa(Number(e.target.value))}
                  style={{ width: '100%', accentColor: C.teal }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: C.textSec, marginTop: 4 }}>
                  <span>Min: 1%</span>
                  <span>Max: 15%</span>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec }}>Plazo (Años)</label>
                  <input
                    type="number"
                    value={plazo}
                    onChange={e => setPlazo(Number(e.target.value))}
                    style={{
                      width: 70, padding: '6px 10px', borderRadius: 0,
                      border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.teal,
                      fontWeight: 700, textAlign: 'right', outline: 'none', fontFamily: C.fontSans
                    }}
                  />
                </div>
                <input type="range" min={5} max={30} step={1} value={plazo} onChange={e => setPlazo(Number(e.target.value))}
                  style={{ width: '100%', accentColor: C.teal }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: C.textSec, marginTop: 4 }}>
                  <span>Min: 5 años</span>
                  <span>Max: 30 años</span>
                </div>
              </div>
            </div>

            {/* Results & Schedule */}
            <div style={{ background: C.bg, borderRadius: 0, padding: 24, border: `1px solid ${C.sand}`, display: 'flex', flexDirection: 'column' }}>
              <div>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Análisis de Crédito</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div style={{ background: C.white, padding: '10px 14px', borderRadius: 0, border: `1px solid ${C.sand}` }}>
                    <div style={{ fontSize: '0.65rem', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Valor Propiedad</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 400, color: C.text, fontFamily: C.fontSerif, marginTop: 2 }}>{fmt(precio)}</div>
                  </div>
                  <div style={{ background: C.white, padding: '10px 14px', borderRadius: 0, border: `1px solid ${C.sand}` }}>
                    <div style={{ fontSize: '0.65rem', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Cuota Inicial ({precio > 0 ? Math.round((montoCuotaInicial / precio) * 100) : 0}%)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 400, color: C.teal, fontFamily: C.fontSerif, marginTop: 2 }}>{fmt(montoCuotaInicial)}</div>
                  </div>
                  <div style={{ background: C.white, padding: '10px 14px', borderRadius: 0, border: `1px solid ${C.sand}` }}>
                    <div style={{ fontSize: '0.65rem', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Valor Financiado</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 400, color: C.text, fontFamily: C.fontSerif, marginTop: 2 }}>{fmt(valorFinanciado)}</div>
                  </div>
                  <div style={{ background: C.coral, padding: '10px 14px', borderRadius: 0, border: `1px solid ${C.coral}` }}>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Cuota Mensual</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 400, color: C.white, fontFamily: C.fontSerif, marginTop: 2 }}>{fmt(cuotaMensual)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.sand}`, paddingBottom: 6 }}>
                    <span style={{ color: C.textSec }}>Tasa Anual Aplicada:</span>
                    <span style={{ fontWeight: 600 }}>{tasa}% E.A.</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
                    <span style={{ color: C.textSec }}>Plazo Total:</span>
                    <span style={{ fontWeight: 600 }}>{plazo} años ({plazo * 12} meses)</span>
                  </div>
                  {/* Ocultado por solicitud: Total Intereses Estimados y Costo de Financiación
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.sand}`, paddingBottom: 6 }}>
                    <span style={{ color: C.textSec }}>Total Intereses Estimados:</span>
                    <span style={{ fontWeight: 600, color: '#EF4444' }}>
                      {fmt(Math.round(planAmortizacion.reduce((sum, yr) => sum + yr.intereses, 0)))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
                    <span style={{ color: C.textSec }}>Costo de Financiación:</span>
                    <span style={{ fontWeight: 600, color: C.palm }}>
                      {fmt(Math.round(planAmortizacion.reduce((sum, yr) => sum + yr.pagosTotal, 0)))}
                    </span>
                  </div>
                  */}
                </div>
              </div>

              <div style={{ background: C.white, color: C.textSec, padding: '12px 14px', borderRadius: 0, border: `1px solid ${C.sand}`, fontSize: '0.78rem', lineHeight: 1.4, marginBottom: 16 }}>
                Simulación de amortización con cuota fija francesa. Los valores y tasas de interés reales pueden variar según la entidad financiera en Panamá.
              </div>
            </div>
          </div>

          {/* Amortization Schedule Table */}
          <div style={{ marginTop: 32, borderTop: `1px solid ${C.sand}`, paddingTop: 24 }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Plan de Pagos Detallado (Amortización Año a Año)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `2px solid ${C.sand}` }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: C.textSec }}>Año</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSec }}>Balance Inicial</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSec }}>Abono Intereses</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSec }}>Abono Capital</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSec }}>Pago Anual</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSec }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {planAmortizacion.map(yr => (
                    <tr key={yr.año} style={{ borderBottom: `1px solid ${C.sand}` }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: C.teal }}>Año {yr.año}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(Math.round(yr.balanceInicial))}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(Math.round(yr.intereses))}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: C.palm }}>{fmt(Math.round(yr.principal))}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(Math.round(yr.pagosTotal))}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.teal }}>{fmt(Math.round(yr.balanceFinal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

      </div>

      {showContactModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,35,73,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease'
        }}>
          <form onSubmit={handleContactSubmit} style={{
            background: C.white, border: `1.5px solid ${C.sand}`,
            padding: 32, maxWidth: 500, width: '90%', borderRadius: 0,
            boxShadow: '0 8px 32px rgba(0,35,73,0.15)', position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowContactModal(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none', color: C.textSec,
                fontSize: '1.25rem', cursor: 'pointer'
              }}
            >
              ✕
            </button>
            
            <h3 style={{ fontSize: '1.3rem', fontWeight: 400, color: C.red, fontFamily: C.fontSerif, marginBottom: 8, borderBottom: `2px solid ${C.red}`, paddingBottom: 8 }}>
              Solicitar Información
            </h3>
            <p style={{ fontSize: '0.85rem', color: C.textSec, marginBottom: 20 }}>
              Completa tus datos para que un asesor especializado te envíe la documentación del proyecto **{project.name}**.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, marginBottom: 6 }}>
                Nombre Completo <span style={{ color: C.coral }}>*</span>
              </label>
              <input
                type="text"
                required
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, marginBottom: 6 }}>
                Correo Electrónico <span style={{ color: C.coral }}>*</span>
              </label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="juan.perez@correo.com"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, marginBottom: 6 }}>
                WhatsApp (Opcional)
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="Ej. +57 300 123 4567"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                  background: C.white, outline: 'none', boxSizing: 'border-box',
                  fontFamily: C.fontSans
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, marginBottom: 6 }}>
                Mensaje
              </label>
              <textarea
                rows={3}
                value={contactMásg}
                onChange={e => setContactMásg(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 0,
                  border: `1px solid ${C.sand}`, fontSize: '0.85rem', color: C.text,
                  background: C.white, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {contactSubmitted && (
              <div style={{
                background: '#F9FAFB',
                color: C.teal,
                padding: '12px 14px',
                borderRadius: 0,
                border: `1px solid ${C.teal}`,
                marginBottom: 16,
                fontSize: '0.82rem',
                fontWeight: 600
              }}>
                ✓ ¡Solicitud recibida! Se cerrará esta ventana en breve.
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%', background: C.coral, color: C.white,
                padding: '12px 24px', border: `1px solid ${C.coral}`, borderRadius: 0,
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                transition: 'all 0.3s ease', fontFamily: C.fontSans
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.coral; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.coral; e.currentTarget.style.color = C.white; }}
            >
              Enviar Solicitud
            </button>
          </form>
        </div>
      )}
      {lightbox && (
        <Lightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onChange={i => setLightbox(prev => prev ? { ...prev, index: i } : prev)}
        />
      )}
    </div>
  );
};

// ── Cuota Inicial Simulator Component ──────────────────────────
interface CuotaInicialProps {
  precio: number;
  montoCuotaInicial: number;
  setPrecio: (v: number) => void;
  setMontoCuotaInicial: (v: number) => void;
  onCalculationComplete?: () => void;
  // Configurable en el CRM (Configuración → Financiero → "Separación por Proyecto"), por
  // proyecto/categoría — ya no un fijo de $2,000 igual para todos.
  separacionDefault: number;
}

const CuotaInicialSimulator: React.FC<CuotaInicialProps> = ({
  precio,
  montoCuotaInicial,
  setPrecio,
  setMontoCuotaInicial,
  onCalculationComplete,
  separacionDefault
}) => {
  // El plan de pago diferido (plazo en cuotas para financiar el saldo de la cuota inicial)
  // se movió a la Calculadora interna del CRM (Configuración → Financiero) — es una
  // negociación caso a caso que maneja el equipo comercial, no algo que un visitante
  // anónimo de la web deba simular o ver publicado. Esta vista pública se queda solo con
  // el desglose simple de contado (separación + saldo de cuota inicial).
  const [separacion, setSeparacion] = React.useState(separacionDefault);
  // El fetch de la tabla configurada en el CRM resuelve DESPUÉS del primer render (arranca
  // con el fallback local) — sin este efecto, `separacion` se quedaría pegado a ese fallback
  // aunque el admin tenga un valor distinto configurado para este proyecto.
  const separacionTocada = React.useRef(false);
  React.useEffect(() => {
    if (!separacionTocada.current) setSeparacion(separacionDefault);
  }, [separacionDefault]);
  const [pctCuotaInicial, setPctCuotaInicial] = React.useState(() => precio > 0 ? Math.round((montoCuotaInicial / precio) * 100) : 50);

  React.useEffect(() => {
    if (precio > 0) {
      const computedPct = Math.round((montoCuotaInicial / precio) * 100);
      setPctCuotaInicial(computedPct);
    }
  }, [precio, montoCuotaInicial]);

  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!onCalculationComplete) return;
    const timer = setTimeout(() => onCalculationComplete(), 3000);
    return () => clearTimeout(timer);
  }, [montoCuotaInicial, separacion, onCalculationComplete]);

  const restante = Math.max(0, montoCuotaInicial - separacion);

  return (
    <div id="cuota-inicial-simulator" style={{
      background: C.white, borderRadius: 0, padding: 32,
      border: `1px solid ${C.sand}`,
      marginTop: 28,
      fontFamily: C.fontSans
    }}>
      {/* Header */}
      <div style={{ borderBottom: `2px solid ${C.red}`, paddingBottom: 12, marginBottom: 24 }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 400, color: C.red, margin: 0, fontFamily: C.fontSerif }}>
          Plan de Pago de Cuota Inicial (Sin Financiación)
        </h3>
        <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: C.textSec }}>
          Estima la ruta de pagos de tu cuota inicial eligiendo el porcentaje sobre el valor de la propiedad.
        </p>
      </div>

      {/* Inputs (3 columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, marginBottom: 6 }}>
            Valor de la Propiedad (USD)
          </label>
          <input
            type="text"
            value={formatComma(precio)}
            onChange={e => {
              const v = Number(e.target.value.replace(/\D/g, ''));
              setPrecio(v);
              setMontoCuotaInicial(Math.round(v * (pctCuotaInicial / 100)));
            }}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 0,
              border: `1px solid ${C.sand}`, fontSize: '0.9rem', color: C.teal,
              fontWeight: 600, outline: 'none', boxSizing: 'border-box',
              fontFamily: C.fontSans
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, marginBottom: 6 }}>
            % de Cuota Inicial (%)
          </label>
          <input
            type="number"
            value={pctCuotaInicial}
            min={5}
            max={100}
            onChange={e => {
              const v = Math.min(100, Math.max(5, Number(e.target.value)));
              setPctCuotaInicial(v);
              setMontoCuotaInicial(Math.round(precio * (v / 100)));
            }}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 0,
              border: `1px solid ${C.sand}`, fontSize: '0.9rem', color: C.teal,
              fontWeight: 600, outline: 'none', boxSizing: 'border-box',
              fontFamily: C.fontSans
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: C.textSec, marginBottom: 6 }}>
            Valor de Separación (USD)
          </label>
          <input
            type="text"
            value={formatComma(separacion)}
            onChange={e => {
              const v = Number(e.target.value.replace(/\D/g, ''));
              separacionTocada.current = true;
              setSeparacion(Math.min(montoCuotaInicial, v));
            }}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 0,
              border: `1px solid ${C.sand}`, fontSize: '0.9rem', color: C.teal,
              fontWeight: 600, outline: 'none', boxSizing: 'border-box',
              fontFamily: C.fontSans
            }}
          />
        </div>
      </div>

      {/* Calculated Results cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 24 }}>
        <div style={{ background: C.bg, padding: '14px 18px', border: `1px solid ${C.sand}` }}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
            Cuota Inicial a Pagar
          </span>
          <span style={{ fontSize: '1.25rem', fontWeight: 600, color: C.teal, fontFamily: C.fontSerif }}>
            {fmt(montoCuotaInicial)}
          </span>
        </div>
        <div style={{ background: C.bg, padding: '14px 18px', border: `1px solid ${C.sand}` }}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
            Saldo de Cuota Inicial después de Separación
          </span>
          <span style={{ fontSize: '1.25rem', fontWeight: 600, color: C.teal, fontFamily: C.fontSerif }}>
            {fmt(restante)}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Separación al contado', value: fmt(separacion), color: C.teal, bg: C.bg },
          { label: 'Saldo cuota inicial (contado)', value: fmt(Math.round(restante)), color: C.text, bg: C.bg },
          { label: 'Total cuota inicial', value: fmt(Math.round(montoCuotaInicial)), color: C.white, bg: C.teal, highlight: true },
          { label: `% del precio`, value: `${pctCuotaInicial}%`, color: C.textSec, bg: C.bg },
        ].map(c => (
          <div key={c.label} style={{
            background: c.bg, borderRadius: 0, padding: '14px 16px',
            border: c.highlight ? `1px solid ${c.bg}` : `1px solid ${C.sand}`,
            color: c.highlight ? C.white : C.text
          }}>
            <div style={{ fontSize: '0.65rem', color: c.highlight ? 'rgba(255,255,255,0.9)' : C.textSec, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{c.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 400, color: c.highlight ? C.white : c.color, fontFamily: C.fontSerif }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div style={{
        background: C.bg, border: `1px solid ${C.sand}`, borderRadius: 0,
        padding: '12px 16px', fontSize: '0.82rem', color: C.textSec, marginBottom: 4, lineHeight: 1.5,
      }}>
        <strong>¿Cómo funciona?</strong> Hoy pagas la separación de <strong>{fmt(separacion)}</strong> para reservar el inmueble.
        El saldo de la cuota inicial (<strong>{fmt(Math.round(restante))}</strong>) se cancela al contado según los hitos establecidos.
        Finalmente, procedes con la hipoteca por <strong>{fmt(Math.round(precio - montoCuotaInicial))}</strong>. Si necesitas un plazo diferido para el saldo de la cuota inicial, coordina las condiciones con tu asesor GLP.
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProjectDetailView />
  </React.StrictMode>
);
