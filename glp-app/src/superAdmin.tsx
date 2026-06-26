import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// Estilos base y tokens
const C = {
  bg: '#0F172A',         // Slate 900
  card: '#1E293B',       // Slate 800
  cardHover: '#334155',  // Slate 700
  text: '#F8FAFC',       // Slate 50
  textSec: '#94A3B8',    // Slate 400
  accent: '#38BDF8',     // Sky 400
  success: '#34D399',    // Emerald 400
  danger: '#F87171',     // Red 400
  border: '#334155',     // Slate 700
  fontSans: '"Inter", sans-serif',
  fontSerif: '"Cormorant Garamond", serif',
};

const SuperAdmin = () => {
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [apiForm, setApiForm] = useState({ openaiKey: '', apolloKey: '', smtpUser: '', smtpPass: '' });

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.backgroundColor = C.bg;
    document.body.style.color = C.text;
    document.body.style.fontFamily = C.fontSans;
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') { // Contraseña maestra estática sugerida en el plan
      setAuth(true);
      fetchTenants();
    } else {
      alert('Contraseña incorrecta');
    }
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/admin/tenants');
      const data = await res.json();
      setTenants(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openApiModal = (t: any) => {
    setSelectedTenant(t);
    setApiForm({
      openaiKey: t.openai?.apiKey || '',
      apolloKey: t.apollo?.apiKey || '',
      smtpUser: t.smtp?.user || '',
      smtpPass: t.smtp?.pass || ''
    });
    setShowApiModal(true);
  };

  const saveApiConfig = async () => {
    if (!selectedTenant) return;
    
    const updatedTenant = {
      ...selectedTenant,
      openai: { apiKey: apiForm.openaiKey },
      apollo: { apiKey: apiForm.apolloKey },
      smtp: { user: apiForm.smtpUser, pass: apiForm.smtpPass }
    };

    try {
      const res = await fetch('http://localhost:3001/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTenant)
      });
      if (res.ok) {
        setShowApiModal(false);
        fetchTenants(); // Recargar
      } else {
        alert('Error al guardar configuración');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!auth) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle at center, ${C.card}, ${C.bg})` }}>
        <form onSubmit={handleLogin} style={{
          background: 'rgba(30, 41, 59, 0.7)', padding: '40px', borderRadius: '16px',
          backdropFilter: 'blur(10px)', border: `1px solid ${C.border}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', width: '350px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontFamily: C.fontSerif, fontWeight: 700, marginBottom: '8px', color: C.accent }}>GLP SaaS</div>
          <div style={{ fontSize: '0.85rem', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '32px' }}>Super Admin Portal</div>
          
          <input
            type="password"
            placeholder="Contraseña Maestra"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
              border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text,
              fontSize: '1rem', outline: 'none', marginBottom: '24px', boxSizing: 'border-box'
            }}
          />
          <button type="submit" style={{
            width: '100%', padding: '12px', background: C.accent, color: '#000',
            border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s'
          }}>
            Ingresar al Sistema
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontFamily: C.fontSerif, fontWeight: 700, color: C.accent }}>SaaS Dashboard</div>
          <div style={{ fontSize: '0.75rem', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Multi-Tenant Architecture</div>
        </div>
        <button onClick={() => setAuth(false)} style={{ background: 'transparent', color: C.textSec, border: `1px solid ${C.border}`, padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cerrar Sesión</button>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 400, margin: 0 }}>Gestión de Agencias <span style={{ color: C.accent }}>({tenants.length})</span></h2>
          <button style={{ background: C.success, color: '#000', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>+ Nueva Agencia</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: C.textSec, padding: '40px' }}>Cargando infraestructura...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {tenants.map(t => (
              <div key={t.id} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
                padding: '24px', transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 600 }}>{t.name}</h3>
                    <div style={{ color: C.accent, fontSize: '0.85rem' }}>{t.domain}</div>
                  </div>
                  <div style={{ background: t.status === 'active' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)', color: t.status === 'active' ? C.success : C.danger, padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    {t.status}
                  </div>
                </div>

                <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: C.textSec }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>ID:</span>
                    <span style={{ color: C.text, fontFamily: 'monospace' }}>{t.id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>SMTP Configurado:</span>
                    <span style={{ color: t.smtp?.user ? C.success : C.danger }}>{t.smtp?.user ? 'Sí' : 'No'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>OpenAI Activo:</span>
                    <span style={{ color: t.openai?.apiKey ? C.success : C.danger }}>{t.openai?.apiKey ? 'Sí' : 'No'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                  <button 
                    onClick={() => openApiModal(t)}
                    style={{ flex: 1, background: 'transparent', color: C.text, border: `1px solid ${C.border}`, padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Configurar APIs</button>
                  <button style={{ flex: 1, background: 'transparent', color: C.text, border: `1px solid ${C.border}`, padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Branding</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Modal API Config */}
      {showApiModal && selectedTenant && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: C.card, borderRadius: '12px', padding: '32px', width: '500px', border: `1px solid ${C.border}`, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', color: C.accent }}>Configurar Integraciones</h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: C.textSec }}>Administrando credenciales para: <strong>{selectedTenant.name}</strong></p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: C.textSec, marginBottom: '4px' }}>OpenAI API Key (Modelos Generativos)</label>
                <input type="password" value={apiForm.openaiKey} onChange={e => setApiForm({...apiForm, openaiKey: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, boxSizing: 'border-box' }} placeholder="sk-..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: C.textSec, marginBottom: '4px' }}>Apollo.io API Key (Minería B2B/HNWI)</label>
                <input type="password" value={apiForm.apolloKey} onChange={e => setApiForm({...apiForm, apolloKey: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, boxSizing: 'border-box' }} placeholder="Apollo API Key" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: C.textSec, marginBottom: '4px' }}>SMTP User (Envío de correos)</label>
                  <input type="text" value={apiForm.smtpUser} onChange={e => setApiForm({...apiForm, smtpUser: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, boxSizing: 'border-box' }} placeholder="usuario@dominio.com" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: C.textSec, marginBottom: '4px' }}>SMTP Password</label>
                  <input type="password" value={apiForm.smtpPass} onChange={e => setApiForm({...apiForm, smtpPass: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, boxSizing: 'border-box' }} placeholder="********" />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button onClick={() => setShowApiModal(false)} style={{ background: 'transparent', color: C.textSec, border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={saveApiConfig} style={{ background: C.success, color: '#000', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<SuperAdmin />);
}
