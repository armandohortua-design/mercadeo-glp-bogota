const fs = require('fs');

const path = 'c:/Users/ahortua/OneDrive/Juan Jose/Mercadeo GLP en Bogota/glp-app/src/main.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Color Palette refactor
const oldC = `const C = {
  teal: '#8A5A36',     // Earth Sienna (Primary)
  sand: '#F5E6D3',     // Warm Sand
  coral: '#C05C3E',    // Terracotta/Clay (Accent)
  palm: '#2E7D32',     // Palm Green
  sky: '#1F618D',      // Ocean Blue
  text: '#3E2723',     // Cocoa text
  textSec: '#7E6B5D',  // Warm brown-gray
  bg: '#FAF8F5',       // Cream Sand background
  white: '#FFFFFF',
}`;

const newC = `const C = {
  teal: '#0F2C59',     // Deep Navy Blue (Primary)
  sand: '#E2E8F0',     // Light Slate Gray
  coral: '#0066CC',    // Corporate Blue (Accent)
  palm: '#10B981',     // Emerald Green
  sky: '#2563EB',      // Vibrant Blue
  text: '#1E293B',     // Slate Dark text
  textSec: '#64748B',  // Slate Light text
  bg: '#F8FAFC',       // Cool Off-White background
  white: '#FFFFFF',
}`;

code = code.replace(oldC, newC);

// 2. Import MARKET_STUDY_DB
const oldImport = "import ReactDOM from 'react-dom/client'";
const newImport = `import ReactDOM from 'react-dom/client'\nimport { MARKET_STUDY_DB } from './marketStudyDb'`;
code = code.replace(oldImport, newImport);

// 3. getZoneNotes helper
const zoneNotesHelper = `
const getZoneNotes = (zone: string) => {
  const z = zone.toLowerCase();
  if (z.includes('pacífica') || z.includes('pacifica') || z.includes('reef')) {
    return 'Nota de la Zona (Punta Pacífica/Islas): Cercanía a Pacífica Salud (Johns Hopkins), Multiplaza Mall, acceso al Corredor Sur y la Marina Privada de Ocean Reef.';
  } else if (z.includes('santa maría') || z.includes('santa maria') || z.includes('este') || z.includes('viejo')) {
    return 'Nota de la Zona (Santa María/Costa del Este): Rodeado por el campo de golf Jack Nicklaus, Town Center Costa del Este, sedes corporativas multinacionales y colegios bilingües.';
  } else if (z.includes('caracol') || z.includes('chame')) {
    return 'Nota de la Zona (Playa Caracol): Playa privada de 1.2 km, escuela de surf, y cercanía al centro de servicios y salud de Coronado (a 20 minutos).';
  } else if (z.includes('dorada') || z.includes('arraiján') || z.includes('arraijan') || z.includes('pacífico') || z.includes('pacifico')) {
    return 'Nota de la Zona (Playa Dorada/Arraiján): Rápido acceso a Panamá Pacífico, el Puente de las Américas y la futura Línea 3 del Metro, con fuerte desarrollo logístico y residencial.';
  }
  return '';
};
`;

// Insert it before ProjectCard definition
code = code.replace('// ─── Project Card ──────────────────────────────────────────────', `${zoneNotesHelper}\n// ─── Project Card ──────────────────────────────────────────────`);

// 4. Update ProjectCard to accept expanded and setExpanded props, and render footnotes and search widget
const oldProjectCardHeader = `const ProjectCard: React.FC<{ project: Project; index: number; onZoom: (img: string) => void }> = ({ project, index, onZoom }) => {
  const [hovered, setHovered] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)`;

const newProjectCardHeader = `const ProjectCard: React.FC<{
  project: Project;
  index: number;
  origIndex: number;
  onZoom: (img: string) => void;
  expanded: boolean;
  setExpanded: (val: boolean) => void;
}> = ({ project, index, origIndex, onZoom, expanded, setExpanded }) => {
  const [hovered, setHovered] = React.useState(false)
  const [cardSearchQuery, setCardSearchQuery] = React.useState(project.zoneShort)

  const matchedInsights = React.useMemo(() => {
    if (!cardSearchQuery.trim()) return [];
    const q = cardSearchQuery.toLowerCase();
    return MARKET_STUDY_DB.filter(item =>
      item.text.toLowerCase().includes(q) ||
      item.section.toLowerCase().includes(q)
    );
  }, [cardSearchQuery]);`;

code = code.replace(oldProjectCardHeader, newProjectCardHeader);

// Replace card container onClick in ProjectCard
code = code.replace("onClick={() => setExpanded(!expanded)}", "onClick={() => setExpanded(!expanded)}");

// Insert footnote and market study search inside ProjectCard expanded block
const oldExpandedBadgesBlock = `            {/* Badges Relocated to the bottom of the technical sheet */}
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: \`1px dashed \${C.sand}\`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: C.textSec }}>Estilo: </span>
                <span style={{
                  background: \`\${C.teal}15\`, color: C.teal,
                  padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                }}>{typeLabel}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: C.textSec }}>Tag: </span>
                <span style={{
                  background: \`\${C.coral}15\`, color: C.coral,
                  padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                }}>{project.tag}</span>
              </div>
            </div>`;

const newExpandedBadgesBlock = `            {/* FOOTNOTE WITH ZONE DETAILS */}
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: \`1px solid \${C.sand}\`,
              fontSize: '0.82rem', color: C.textSec, fontStyle: 'italic', lineHeight: 1.4
            }}>
              {getZoneNotes(project.zone)}
            </div>

            {/* MARKET STUDY SEARCH WIDGET */}
            <div style={{
              marginTop: 14, padding: 12, borderRadius: 10, background: \`\${C.teal}08\`,
              border: \`1.5px solid \${C.teal}18\`, display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Estudio de Mercado Panamá (CB Q2 2026)
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Buscar en el estudio de Panamá..."
                  value={cardSearchQuery}
                  onChange={e => setCardSearchQuery(e.target.value)}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, border: \`1px solid \${C.sand}\`,
                    fontSize: '0.8rem', background: C.white, color: C.text, outline: 'none'
                  }}
                />
                <button onClick={() => setCardSearchQuery(project.zoneShort)} style={{
                  padding: '4px 10px', borderRadius: 6, background: C.teal, color: C.white,
                  border: 'none', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600
                }}>Zona</button>
              </div>
              <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {matchedInsights.slice(0, 3).map((insight, idx) => (
                  <div key={idx} style={{ padding: '6px 8px', background: C.white, borderRadius: 6, borderLeft: \`3px solid \${C.coral}\`, fontSize: '0.75rem', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 700, color: C.coral, display: 'block', marginBottom: 2 }}>{insight.section}</span>
                    {insight.text}
                  </div>
                ))}
                {matchedInsights.length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: C.textSec, fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                    Sin resultados para "\${cardSearchQuery}".
                  </div>
                )}
              </div>
            </div>

            {/* Badges Relocated to the bottom of the technical sheet */}
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: \`1px dashed \${C.sand}\`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: C.textSec }}>Estilo: </span>
                  <span style={{
                    background: \`\${C.teal}15\`, color: C.teal,
                    padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                  }}>{typeLabel}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: C.textSec }}>Tag: </span>
                  <span style={{
                    background: \`\${C.coral}15\`, color: C.coral,
                    padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                  }}>{project.tag}</span>
                </div>
              </div>
              
              <button onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                style={{
                  background: C.coral, color: C.white, border: 'none', borderRadius: 20,
                  padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,102,204,0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4
                }}>
                Simular Rentabilidad →
              </button>
            </div>`;

code = code.replace(oldExpandedBadgesBlock, newExpandedBadgesBlock);

// 5. Update ProjectsSection to take props and bind card mapping
const oldProjectsSection = `const ProjectsSection: React.FC<{ onZoom: (img: string) => void }> = ({ onZoom }) => {
  const [filter, setFilter] = React.useState<string>('todos')`;

const newProjectsSection = `const ProjectsSection: React.FC<{
  onZoom: (img: string) => void;
  activeProjIndex: number | null;
  setActiveProjIndex: (i: number | null) => void;
}> = ({ onZoom, activeProjIndex, setActiveProjIndex }) => {
  const [filter, setFilter] = React.useState<string>('todos')`;

code = code.replace(oldProjectsSection, newProjectsSection);

const oldCardMapping = `          {filtered.map((p, i) => (
            <ProjectCard key={p.name} project={p} index={i} onZoom={onZoom} />
          ))}`;

const newCardMapping = `          {filtered.map((p, i) => {
            const origIndex = PROJECTS.findIndex(proj => proj.name === p.name);
            return (
              <ProjectCard
                key={p.name}
                project={p}
                index={i}
                origIndex={origIndex}
                onZoom={onZoom}
                expanded={activeProjIndex === origIndex}
                setExpanded={(val) => setActiveProjIndex(val ? origIndex : null)}
              />
            );
          })}`;

code = code.replace(oldCardMapping, newCardMapping);

// 6. Update CalculatorSection signature and add useEffect reset logic
const oldCalculatorSectionHeader = `const CalculatorSection: React.FC = () => {
  const [selectedProject, setSelectedProject] = React.useState(0)
  const [area, setArea] = React.useState(100)
  const [downPaymentPct, setDownPaymentPct] = React.useState(30)
  const [rate, setRate] = React.useState(8.5)`;

const newCalculatorSectionHeader = `const CalculatorSection: React.FC<{
  selectedProject: number;
  setSelectedProject: (i: number) => void;
}> = ({ selectedProject, setSelectedProject }) => {
  const [area, setArea] = React.useState(100)
  const [downPaymentPct, setDownPaymentPct] = React.useState(30)
  const [rate, setRate] = React.useState(8.5)

  React.useEffect(() => {
    const proj = PROJECTS[selectedProject];
    if (proj) {
      // Parse minimum area from range (e.g. "200-600 m2" -> 200)
      const minArea = parseInt(proj.area.split(/[^0-9]/)[0]) || 60;
      setArea(minArea);
      setDownPaymentPct(30);
      setRate(8.5);
    }
  }, [selectedProject]);`;

code = code.replace(oldCalculatorSectionHeader, newCalculatorSectionHeader);

// 7. Update FAQSection to support search across all categories
const oldFAQSection = `const FAQSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = React.useState(0)
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({})

  const toggle = (key: string) => setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <section id="faq" style={{ padding: '80px 24px', background: C.white }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-block', background: \`\${C.sky}15\`,
            color: C.sky, padding: '6px 16px', borderRadius: 20,
            fontSize: '0.85rem', fontWeight: 600, marginBottom: 14,
          }}>FAQ</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 800, color: C.text, margin: '0 0 12px' }}>
            Preguntas Frecuentes
          </h2>
          <p style={{ fontSize: '1.05rem', color: C.textSec }}>
            32 respuestas detalladas para el inversionista colombiano en Panamá.
          </p>
        </div>

        {/* Category tabs */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {FAQ_DATA.map((cat, i) => (
            <button key={cat.title} onClick={() => setActiveCategory(i)} style={{
              background: activeCategory === i ? C.teal : C.bg,
              color: activeCategory === i ? C.white : C.text,
              border: activeCategory === i ? 'none' : \`1px solid \${C.sand}\`,
              padding: '10px 20px', borderRadius: 30, cursor: 'pointer',
              fontWeight: 600, fontSize: '0.88rem', transition: 'all 0.3s',
              boxShadow: activeCategory === i ? '0 4px 15px rgba(138,90,54,0.25)' : 'none',
            }}>
              {cat.icon} {cat.title}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div style={{
          background: C.bg, borderRadius: 20, padding: '8px 28px',
          border: \`1px solid \${C.sand}\`,
        }}>
          {FAQ_DATA[activeCategory].items.map((faq, i) => (
            <FAQItem
              key={\`\${activeCategory}-\${i}\`}
              faq={faq}
              isOpen={!!openItems[\`\${activeCategory}-\${i}\`]}
              toggle={() => toggle(\`\${activeCategory}-\${i}\`)}
            />
          ))}
        </div>`;

const newFAQSection = `const FAQSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = React.useState(0)
  const [faqSearch, setFaqSearch] = React.useState('')
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({})

  const toggle = (key: string) => setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))

  const searchedFaqs = React.useMemo(() => {
    if (!faqSearch.trim()) return null;
    const query = faqSearch.toLowerCase();
    const results: { faq: FAQ; categoryTitle: string; key: string }[] = [];
    FAQ_DATA.forEach((cat, catIdx) => {
      cat.items.forEach((item, itemIdx) => {
        if (item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)) {
          results.push({
            faq: item,
            categoryTitle: cat.title,
            key: \`\${catIdx}-\${itemIdx}\`
          });
        }
      });
    });
    return results;
  }, [faqSearch]);

  return (
    <section id="faq" style={{ padding: '80px 24px', background: C.white }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-block', background: \`\${C.sky}15\`,
            color: C.sky, padding: '6px 16px', borderRadius: 20,
            fontSize: '0.85rem', fontWeight: 600, marginBottom: 14,
          }}>FAQ</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 800, color: C.text, margin: '0 0 12px' }}>
            Preguntas Frecuentes
          </h2>
          <p style={{ fontSize: '1.05rem', color: C.textSec }}>
            32 respuestas detalladas para el inversionista colombiano en Panamá.
          </p>
        </div>

        {/* FAQ Search Box */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Buscar en todas las FAQs..."
            value={faqSearch}
            onChange={e => setFaqSearch(e.target.value)}
            style={{
              width: '100%', maxWidth: 500, padding: '12px 16px', borderRadius: 25,
              border: \`1.5px solid \${C.sand}\`, fontSize: '0.95rem',
              color: C.text, background: C.bg, outline: 'none',
              boxSizing: 'border-box' as const, textAlign: 'center'
            }}
          />
        </div>

        {/* Category tabs */}
        {!searchedFaqs && (
          <div style={{
            display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {FAQ_DATA.map((cat, i) => (
              <button key={cat.title} onClick={() => setActiveCategory(i)} style={{
                background: activeCategory === i ? C.teal : C.bg,
                color: activeCategory === i ? C.white : C.text,
                border: activeCategory === i ? 'none' : \`1px solid \${C.sand}\`,
                padding: '10px 20px', borderRadius: 30, cursor: 'pointer',
                fontWeight: 600, fontSize: '0.88rem', transition: 'all 0.3s',
                boxShadow: activeCategory === i ? '0 4px 15px rgba(15,44,89,0.25)' : 'none',
              }}>
                {cat.icon} {cat.title}
              </button>
            ))}
          </div>
        )}

        {/* FAQ List */}
        <div style={{
          background: C.bg, borderRadius: 20, padding: '8px 28px',
          border: \`1px solid \${C.sand}\`,
        }}>
          {searchedFaqs ? (
            searchedFaqs.length > 0 ? (
              searchedFaqs.map((item) => (
                <div key={item.key} style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', top: 4, right: 0, fontSize: '0.72rem',
                    fontWeight: 700, color: C.coral, background: \`\${C.coral}12\`,
                    padding: '2px 8px', borderRadius: 10
                  }}>{item.categoryTitle}</span>
                  <FAQItem
                    faq={item.faq}
                    isOpen={!!openItems[item.key]}
                    toggle={() => toggle(item.key)}
                  />
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.textSec, fontStyle: 'italic' }}>
                Sin FAQs encontradas para "{faqSearch}". Intente otra palabra clave.
              </div>
            )
          ) : (
            FAQ_DATA[activeCategory].items.map((faq, i) => (
              <FAQItem
                key={\`\${activeCategory}-\${i}\`}
                faq={faq}
                isOpen={!!openItems[\`\${activeCategory}-\${i}\`]}
                toggle={() => toggle(\`\${activeCategory}-\${i}\`)}
              />
            ))
          )}
        </div>`;

code = code.replace(oldFAQSection, newFAQSection);

// 8. Update LandingPage root component to manage activeProjIndex state and display calculator conditionally
const oldLandingPage = `const LandingPage: React.FC = () => {
  const [lightboxImg, setLightboxImg] = React.useState<string | null>(null)

  return (
    <>
      <GlobalStyles />
      <Navbar />
      <Hero />
      <GLPTrayectoria />
      <ProjectsSection onZoom={setLightboxImg} />
      <WhyPanamaSection />
      <CalculatorSection />
      <FAQSection />`;

const newLandingPage = `const LandingPage: React.FC = () => {
  const [lightboxImg, setLightboxImg] = React.useState<string | null>(null)
  const [activeProjIndex, setActiveProjIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (activeProjIndex !== null) {
      setTimeout(() => {
        const el = document.getElementById('calculator');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [activeProjIndex]);

  return (
    <>
      <GlobalStyles />
      <Navbar />
      <Hero />
      <GLPTrayectoria />
      <ProjectsSection
        onZoom={setLightboxImg}
        activeProjIndex={activeProjIndex}
        setActiveProjIndex={setActiveProjIndex}
      />
      <WhyPanamaSection />
      {activeProjIndex !== null && (
        <CalculatorSection
          selectedProject={activeProjIndex}
          setSelectedProject={setActiveProjIndex}
        />
      )}
      <FAQSection />`;

code = code.replace(oldLandingPage, newLandingPage);

// 9. Fix button box-shadow values in navbar/landing
code = code.split('rgba(138,90,54,0.3)').join('rgba(15,44,89,0.3)');
code = code.split('rgba(138,90,54,0.15)').join('rgba(15,44,89,0.15)');
code = code.split('rgba(138,90,54,0.1)').join('rgba(15,44,89,0.1)');
code = code.split('rgba(138,90,54,0.25)').join('rgba(15,44,89,0.25)');

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully polished Landing Page in main.tsx.');
