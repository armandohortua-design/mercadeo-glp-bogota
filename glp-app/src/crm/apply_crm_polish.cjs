const fs = require('fs');

const path = 'c:/Users/ahortua/OneDrive/Juan Jose/Mercadeo GLP en Bogota/glp-app/src/crm/CRMDashboard.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Insert renderButtonIcon after renderSidebarIcon
const sidebarIconEnd = '  };\n\n  const badge =';
const renderButtonIconDef = `  const renderButtonIcon = (name: string, size = 12, style: Record<string, any> = {}) => {
    const defaultStyle = { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style };
    switch (name) {
      case 'eye':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        );
      case 'pencil':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        );
      case 'trash':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        );
      case 'check':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'close':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      case 'play':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        );
      case 'pause':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        );
      case 'chart':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        );
      case 'clipboard':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        );
      case 'alert':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="m10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'document':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case 'share':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        );
      case 'calendar':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case 'video':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="m22 8-6 4 6 4V8Z" />
            <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
          </svg>
        );
      case 'plus':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        );
      case 'search':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        );
      case 'arrow-left':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        );
      case 'renta':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        );
      case 'disfrute':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <line x1="2" y1="12" x2="22" />
          </svg>
        );
      case 'patrimonial':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      default:
        return null;
    }
  };

`;

if (!code.includes('const renderButtonIcon =')) {
  code = code.replace(sidebarIconEnd, `  };\n\n${renderButtonIconDef}  const badge =`);
  console.log('Injected renderButtonIcon helper.');
}

// 2. Enlarge agent avatar image sizes from 130 to 160
code = code.replace(
  "style={{ width: 130, height: 130, borderRadius: '50%', objectFit: 'cover', border: `3px solid \${T.teal}\`, boxShadow: \`0 4px 12px \${T.teal}40\` }}",
  "style={{ width: 160, height: 160, borderRadius: '50%', objectFit: 'cover', border: `3px solid \${T.teal}\`, boxShadow: \`0 4px 12px \${T.teal}40\` }}"
);
console.log('Enlarged agent photos to 160px.');

// 3. Update agent actions emojis to SVG icons in renderAgentes state
const originalAgentCamiloActions = `        actions: [
          { label: agentCamiloActive ? '⏸️ Detener' : '▶️ Activar ahora', onClick: () => { setAgentCamiloActive(!agentCamiloActive); if (!agentCamiloActive) { setAgentCamiloLastRun(new Date().toLocaleString()); setAgentCamiloProspects(p => p + Math.floor(Math.random() * 5) + 1); } } },
          { label: '📊 Ver prospectos', onClick: () => { setActiveModule('prospectos'); } },
        ],`;
const newAgentCamiloActions = `        actions: [
          { label: agentCamiloActive ? 'Detener' : 'Activar ahora', icon: agentCamiloActive ? 'pause' : 'play', onClick: () => { setAgentCamiloActive(!agentCamiloActive); if (!agentCamiloActive) { setAgentCamiloLastRun(new Date().toLocaleString()); setAgentCamiloProspects(p => p + Math.floor(Math.random() * 5) + 1); } } },
          { label: 'Ver prospectos', icon: 'chart', onClick: () => { setActiveModule('prospectos'); } },
        ],`;
code = code.replace(originalAgentCamiloActions, newAgentCamiloActions);

const originalAgentSaraActions = `        actions: [
          { label: '📋 Ver reportes', onClick: () => setAgentSaraMessages(m => m + 15) },
          { label: '⚠️ Ver alertas', onClick: () => setAgentSaraAlerts(a => Math.max(0, a - 1)) },
        ],`;
const newAgentSaraActions = `        actions: [
          { label: 'Ver reportes', icon: 'clipboard', onClick: () => setAgentSaraMessages(m => m + 15) },
          { label: 'Ver alertas', icon: 'alert', onClick: () => setAgentSaraAlerts(a => Math.max(0, a - 1)) },
        ],`;
code = code.replace(originalAgentSaraActions, newAgentSaraActions);

const originalAgentValeriaActions = `        actions: [
          { label: '📝 Ver borradores', onClick: () => setAgentValeriaContent(c => c + 1) },
          { label: '📤 Publicar contenido', onClick: () => {} },
        ],`;
const newAgentValeriaActions = `        actions: [
          { label: 'Ver borradores', icon: 'document', onClick: () => setAgentValeriaContent(c => c + 1) },
          { label: 'Publicar contenido', icon: 'share', onClick: () => {} },
        ],`;
code = code.replace(originalAgentValeriaActions, newAgentValeriaActions);

const originalAgentIsabellaActions = `        actions: [
          { label: '📅 Ver programación', onClick: () => setAgentIsabellaPosts(p => p + 2) },
          { label: '🎥 Ver scripts', onClick: () => {} },
        ],`;
const newAgentIsabellaActions = `        actions: [
          { label: 'Ver programación', icon: 'calendar', onClick: () => setAgentIsabellaPosts(p => p + 2) },
          { label: 'Ver scripts', icon: 'video', onClick: () => {} },
        ],`;
code = code.replace(originalAgentIsabellaActions, newAgentIsabellaActions);

// Update agent action buttons rendering
const originalAgentActionsRender = `              <div style={{ display: 'flex', gap: 8 }}>
                {agent.actions.map(a => (
                  <button key={a.label} onClick={a.onClick} style={btnSecondary({ padding: '6px 14px', fontSize: 11 })}>{a.label}</button>
                ))}
              </div>`;
const newAgentActionsRender = `              <div style={{ display: 'flex', gap: 8 }}>
                {agent.actions.map(a => (
                  <button key={a.label} onClick={a.onClick} style={btnSecondary({ padding: '6px 14px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                    {a.icon && renderButtonIcon(a.icon, 12)}
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>`;
code = code.replace(originalAgentActionsRender, newAgentActionsRender);
console.log('Updated AI agents actions to use SVG icons.');

// 4. Update project portfolio filters (Line 523)
const originalProjectFilters = `        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[['all', 'Todos'], ['renta', '💰 Renta'], ['disfrute', '🏖️ Disfrute'], ['patrimonial', '🛡️ Patrimonial']].map(([id, label]) => (
            <button key={id} onClick={() => setPortFilter(id)} style={{
              ...btnSecondary(),
              background: portFilter === id ? T.teal : 'transparent',
              color: portFilter === id ? T.card : T.teal,
            }}>{label}</button>
          ))}
          <span style={{ fontSize: 12, color: T.textSec, alignSelf: 'center', marginLeft: 8 }}>{filtered.length} proyectos</span>
        </div>`;
const newProjectFilters = `        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[['all', 'Todos', ''], ['renta', 'Renta', 'renta'], ['disfrute', 'Disfrute', 'disfrute'], ['patrimonial', 'Patrimonial', 'patrimonial']].map(([id, label, iconName]) => (
            <button key={id} onClick={() => setPortFilter(id)} style={{
              ...btnSecondary({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
              background: portFilter === id ? T.teal : 'transparent',
              color: portFilter === id ? T.card : T.teal,
            }}>
              {iconName && renderButtonIcon(iconName, 12)}
              <span>{label}</span>
            </button>
          ))}
          <span style={{ fontSize: 12, color: T.textSec, alignSelf: 'center', marginLeft: 8 }}>{filtered.length} proyectos</span>
        </div>`;
code = code.replace(originalProjectFilters, newProjectFilters);

// Update badges on project cards (remove emoji)
code = code.replace(
  "p.investorType === 'renta' ? '💰 Renta' : p.investorType === 'disfrute' ? '🏖️ Disfrute' : '🛡️ Patrimonial'",
  "p.investorType === 'renta' ? 'Renta' : p.investorType === 'disfrute' ? 'Disfrute' : 'Patrimonial'"
);

// 5. Update Prospects Details (Volver button, Edit/Save button, Cancel/Confirm buttons)
const originalProspectVolver = `<button onClick={() => { setProspectDetail(null); setProspectEdit(null); }} style={btnSecondary({ marginBottom: 16 })}>← Volver a lista/embudo</button>`;
const newProspectVolver = `<button onClick={() => { setProspectDetail(null); setProspectEdit(null); }} style={btnSecondary({ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
            {renderButtonIcon('arrow-left')}
            <span>Volver a lista/embudo</span>
          </button>`;
code = code.replace(originalProspectVolver, newProspectVolver);

const originalProspectEditSave = `                <button onClick={() => setProspectEdit(isEditing ? null : dp.id)} style={btnSecondary({ padding: '4px 12px', fontSize: 11 })}>
                  {isEditing ? '✓ Guardar' : '✏️ Editar'}
                </button>
                <button onClick={() => setDeleteConfirm(dp.id)} style={btnDanger({ padding: '4px 12px', fontSize: 11 })}>🗑️</button>`;
const newProspectEditSave = `                <button onClick={() => setProspectEdit(isEditing ? null : dp.id)} style={btnSecondary({ padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                  {isEditing ? (
                    <>
                      {renderButtonIcon('check')}
                      <span>Guardar</span>
                    </>
                  ) : (
                    <>
                      {renderButtonIcon('pencil')}
                      <span>Editar</span>
                    </>
                  )}
                </button>
                <button onClick={() => setDeleteConfirm(dp.id)} style={btnDanger({ padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Eliminar">{renderButtonIcon('trash')}</button>`;
code = code.replace(originalProspectEditSave, newProspectEditSave);

const originalDeleteConfirmButtons = `                <button onClick={() => deleteProspect(dp.id)} style={btnDanger({ marginLeft: 12, padding: '4px 12px', fontSize: 11 })}>Sí, eliminar</button>
                <button onClick={() => setDeleteConfirm(null)} style={btnSecondary({ marginLeft: 8, padding: '4px 12px', fontSize: 11 })}>Cancelar</button>`;
const newDeleteConfirmButtons = `                <button onClick={() => deleteProspect(dp.id)} style={btnDanger({ marginLeft: 12, padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                  {renderButtonIcon('check')}
                  <span>Sí, eliminar</span>
                </button>
                <button onClick={() => setDeleteConfirm(null)} style={btnSecondary({ marginLeft: 8, padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                  {renderButtonIcon('close')}
                  <span>Cancelar</span>
                </button>`;
code = code.replace(originalDeleteConfirmButtons, newDeleteConfirmButtons);

// 6. Prospects List Table actions
const originalTableActions = `                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setProspectDetail(p.id)} style={btnSecondary({ padding: '3px 8px', fontSize: 10 })}>👁️</button>
                        <button onClick={() => { setProspectDetail(p.id); setProspectEdit(p.id); }} style={btnSecondary({ padding: '3px 8px', fontSize: 10 })}>✏️</button>
                        {deleteConfirm === p.id ? (
                          <>
                            <button onClick={() => deleteProspect(p.id)} style={btnDanger({ padding: '3px 8px', fontSize: 10 })}>✓</button>
                            <button onClick={() => setDeleteConfirm(null)} style={btnSecondary({ padding: '3px 8px', fontSize: 10 })}>✕</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(p.id)} style={btnDanger({ padding: '3px 8px', fontSize: 10 })}>🗑️</button>
                        )}
                      </div>`;
const newTableActions = `                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setProspectDetail(p.id)} style={btnSecondary({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Ver detalles">{renderButtonIcon('eye', 13)}</button>
                        <button onClick={() => { setProspectDetail(p.id); setProspectEdit(p.id); }} style={btnSecondary({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Editar">{renderButtonIcon('pencil', 13)}</button>
                        {deleteConfirm === p.id ? (
                          <>
                            <button onClick={() => deleteProspect(p.id)} style={btnDanger({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Confirmar">{renderButtonIcon('check', 13)}</button>
                            <button onClick={() => setDeleteConfirm(null)} style={btnSecondary({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Cancelar">{renderButtonIcon('close', 13)}</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(p.id)} style={btnDanger({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Eliminar">{renderButtonIcon('trash', 13)}</button>
                        )}
                      </div>`;
code = code.replace(originalTableActions, newTableActions);

// 7. Prospects Views switcher (Embudo vs Lista)
const originalViewSwitcher = `        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setProspectViewMode('embudo')} style={{
            ...btnSecondary(),
            background: prospectViewMode === 'embudo' ? T.teal : 'transparent',
            color: prospectViewMode === 'embudo' ? T.card : T.teal,
          }}>📊 Vista Embudo</button>
          <button onClick={() => setProspectViewMode('lista')} style={{
            ...btnSecondary(),
            background: prospectViewMode === 'lista' ? T.teal : 'transparent',
            color: prospectViewMode === 'lista' ? T.card : T.teal,
          }}>📋 Vista Lista</button>
        </div>`;
const newViewSwitcher = `        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setProspectViewMode('embudo')} style={{
            ...btnSecondary({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
            background: prospectViewMode === 'embudo' ? T.teal : 'transparent',
            color: prospectViewMode === 'embudo' ? T.card : T.teal,
          }}>
            {renderButtonIcon('chart')}
            <span>Vista Embudo</span>
          </button>
          <button onClick={() => setProspectViewMode('lista')} style={{
            ...btnSecondary({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
            background: prospectViewMode === 'lista' ? T.teal : 'transparent',
            color: prospectViewMode === 'lista' ? T.card : T.teal,
          }}>
            {renderButtonIcon('clipboard')}
            <span>Vista Lista</span>
          </button>
        </div>`;
code = code.replace(originalViewSwitcher, newViewSwitcher);

// 8. FAQ Edit/Save/Delete buttons
const originalFaqActions = `                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => setFaqEditId(editing ? null : faq.id)}
                            style={btnSecondary({ padding: '4px 12px', fontSize: 11 })}>
                            {editing ? '✓ Guardar' : '✏️ Editar'}
                          </button>
                          <button onClick={() => deleteFaq(faq.id)} style={btnDanger({ padding: '4px 12px', fontSize: 11 })}>🗑️ Eliminar</button>
                        </div>`;
const newFaqActions = `                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => setFaqEditId(editing ? null : faq.id)}
                            style={btnSecondary({ padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                            {editing ? (
                              <>
                                {renderButtonIcon('check')}
                                <span>Guardar</span>
                              </>
                            ) : (
                              <>
                                {renderButtonIcon('pencil')}
                                <span>Editar</span>
                              </>
                            )}
                          </button>
                          <button onClick={() => deleteFaq(faq.id)} style={btnDanger({ padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                            {renderButtonIcon('trash')}
                            <span>Eliminar</span>
                          </button>
                        </div>`;
code = code.replace(originalFaqActions, newFaqActions);

// 9. Replace standard toggle buttons (Agregar FAQ, Nuevo Prospecto, Nuevo Evento, Agregar Broker)
// Broker form toggle
code = code.replace(
  "showBrokerForm ? '✕ Cerrar' : '+ Agregar Broker'",
  `showBrokerForm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('close', 12)}
                <span>Cerrar</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Agregar Broker</span>
              </span>
            )`
);

// Prospect form toggle
code = code.replace(
  "showProspectForm ? '✕ Cerrar' : '+ Nuevo Prospecto'",
  `showProspectForm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('close', 12)}
                <span>Cerrar</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Nuevo Prospecto</span>
              </span>
            )`
);

// Event form toggle
code = code.replace(
  "showEventForm ? '✕ Cerrar' : '+ Nuevo Evento'",
  `showEventForm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('close', 12)}
                <span>Cerrar</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Nuevo Evento</span>
              </span>
            )`
);

// FAQ form toggle
code = code.replace(
  "showFaqForm ? '✕ Cerrar' : '+ Nueva FAQ'",
  `showFaqForm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('close', 12)}
                <span>Cerrar</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Nueva FAQ</span>
              </span>
            )`
);

// Replace fallback gradients with elegant solid colors
const originalFallbackGradients = `    const fallbackGradients = [
      \`linear-gradient(135deg, \${T.teal}, \${T.palm})\`,
      \`linear-gradient(135deg, \${T.sky}, \${T.teal})\`,
      \`linear-gradient(135deg, \${T.palm}, #2C7A7B)\`,
      \`linear-gradient(135deg, \${T.coral}, #F6AD55)\`,
      \`linear-gradient(135deg, #667EEA, \${T.sky})\`,
    ];`;
const newFallbackGradients = `    const fallbackGradients = [
      T.teal,
      T.sky,
      T.palm,
      T.coral,
      T.textSec,
    ];`;
code = code.replace(originalFallbackGradients, newFallbackGradients);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully polished CRM Dashboard design.');
