import React from 'react';
import ReactDOM from 'react-dom/client';
import { C } from './projectsData';
import { API_ROOT } from './apiRoot';

type CuotaCartera = {
  id: string; numero: number; concepto: string; monto: number;
  fecha_vencimiento: string; fecha_pago?: string;
  estado: 'pendiente' | 'pagada' | 'vencida' | 'en_proceso';
};

type CarteraPortalData = {
  id: string; prospecto_nombre: string; proyecto: string; unidad: string;
  precio_total: number; moneda: string; fecha_separacion: string;
  fecha_escritura?: string; fecha_entrega?: string; modalidad: string;
  riesgo: 'verde' | 'amarillo' | 'rojo'; arquetipo?: string;
  cuotas: CuotaCartera[]; historial?: { fecha: string; accion: string; detalle?: string }[];
  password_es_temporal: boolean;
};

const CONCEPTO_LABEL: Record<string, string> = {
  cuota_inicial: 'Cuota Inicial', credito: 'Crédito Hipotecario',
  subrogacion: 'Subrogación', escritura: 'Escritura', entrega: 'Entrega',
};
const RIESGO_LABEL: Record<string, string> = { verde: 'Al día', amarillo: 'Atención', rojo: 'En mora' };
const RIESGO_COLOR: Record<string, string> = { verde: '#10B981', amarillo: '#F59E0B', rojo: '#EF4444' };

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

const calcConfiabilidad = (cuotas: CuotaCartera[]) => {
  const pagadas = cuotas.filter(q => q.estado === 'pagada' && q.fecha_pago);
  if (pagadas.length === 0) return { label: 'Sin historial suficiente', color: '#9CA3AF', pct: null as number | null };
  const aTiempo = pagadas.filter(q => q.fecha_pago! <= q.fecha_vencimiento).length;
  const pct = Math.round((aTiempo / pagadas.length) * 100);
  if (pct >= 80) return { label: 'Buen historial de pago', color: '#10B981', pct };
  if (pct >= 50) return { label: 'Historial mixto', color: '#F59E0B', pct };
  return { label: 'Historial de atrasos', color: '#EF4444', pct };
};

const LoginScreen: React.FC<{ onSuccess: (token: string, data: CarteraPortalData) => void }> = ({ onSuccess }) => {
  const [correo, setCorreo] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/portal/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Correo o contraseña incorrectos.'); setLoading(false); return; }
      sessionStorage.setItem('glp_portal_token', data.token);
      onSuccess(data.token, data.cartera);
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: `linear-gradient(135deg, ${C.teal} 0%, #1E3A60 100%)` }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 420, padding: '40px 36px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.red, letterSpacing: 2, fontFamily: 'Georgia, serif' }}>GLP</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 400, color: C.red, fontFamily: C.fontSerif, marginTop: 8 }}>Portal del Cliente</h1>
          <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 6 }}>Consulta el estado de tu inversión en tiempo real</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#6B7280', marginBottom: 6 }}>Correo Electrónico</label>
            <input type="email" required value={correo} onChange={e => setCorreo(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#6B7280', marginBottom: 6 }}>Contraseña</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ marginBottom: 16, fontSize: '0.8rem', color: '#EF4444' }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: C.red, color: '#fff', padding: '12px 18px', border: 'none', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p style={{ marginTop: 20, fontSize: '0.75rem', color: '#9CA3AF', textAlign: 'center' }}>
          ¿No tienes tus credenciales? Contacta a tu asesor de GLP Wealth Management.
        </p>
      </div>
    </div>
  );
};

const ChangePasswordModal: React.FC<{ token: string; onClose: () => void; forced?: boolean }> = ({ token, onClose, forced }) => {
  const [actual, setActual] = React.useState('');
  const [nueva, setNueva] = React.useState('');
  const [confirmar, setConfirmar] = React.useState('');
  const [error, setError] = React.useState('');
  const [ok, setOk] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (nueva !== confirmar) { setError('Las contraseñas nuevas no coinciden.'); return; }
    if (nueva.length < 4) { setError('La nueva contraseña debe tener al menos 4 caracteres.'); return; }
    try {
      const res = await fetch(`${API_ROOT}/api/portal/cambiar-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo cambiar la contraseña.'); return; }
      setOk(true);
      setTimeout(() => onClose(), 1200);
    } catch {
      setError('No se pudo conectar con el servidor.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,26,55,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 400, padding: 32 }}>
        <h2 style={{ fontFamily: C.fontSerif, fontSize: '1.3rem', color: C.red, marginBottom: 4 }}>Cambiar Contraseña</h2>
        {forced && <p style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: 16 }}>Estás usando una contraseña temporal. Por seguridad, cámbiala antes de continuar.</p>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.7rem', color: '#6B7280', display: 'block', marginBottom: 4 }}>Contraseña actual</label>
            <input type="password" required value={actual} onChange={e => setActual(e.target.value)} style={{ width: '100%', padding: '9px 10px', border: '1px solid #E5E7EB', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.7rem', color: '#6B7280', display: 'block', marginBottom: 4 }}>Nueva contraseña</label>
            <input type="password" required value={nueva} onChange={e => setNueva(e.target.value)} style={{ width: '100%', padding: '9px 10px', border: '1px solid #E5E7EB', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.7rem', color: '#6B7280', display: 'block', marginBottom: 4 }}>Confirmar nueva contraseña</label>
            <input type="password" required value={confirmar} onChange={e => setConfirmar(e.target.value)} style={{ width: '100%', padding: '9px 10px', border: '1px solid #E5E7EB', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ marginBottom: 12, fontSize: '0.78rem', color: '#EF4444' }}>{error}</div>}
          {ok && <div style={{ marginBottom: 12, fontSize: '0.78rem', color: '#10B981' }}>✓ Contraseña actualizada.</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {!forced && <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid #E5E7EB', padding: '9px 18px', fontSize: 11, cursor: 'pointer', color: '#6B7280' }}>Cancelar</button>}
            <button type="submit" style={{ background: C.red, color: '#fff', border: 'none', padding: '9px 18px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

type LegalDocSafe = { docKey: string; label: string; status: string; dueDate: string | null };

const LEGAL_STATUS_CFG: Record<string, { color: string; label: string }> = {
  pendiente: { color: '#9CA3AF', label: 'Pendiente' },
  en_revision: { color: '#F59E0B', label: 'En Revisión' },
  firmado: { color: '#10B981', label: 'Firmado' },
  archivado: { color: '#10B981', label: 'Completado' },
};

const TramiteSection: React.FC<{ token: string }> = ({ token }) => {
  const [docs, setDocs] = React.useState<LegalDocSafe[] | null>(null);
  const [resumen, setResumen] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${API_ROOT}/api/portal/legal`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setDocs(d.docs || []); setResumen(d.resumen || ''); })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return null;
  if (!docs || docs.length === 0) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #EDE8DF', padding: 24, marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: C.teal, marginBottom: 16, textTransform: 'uppercase' }}>Tu Trámite</div>
      {resumen && (
        <div style={{ background: '#FBF9F4', borderLeft: `3px solid ${C.red}`, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.teal, lineHeight: 1.6 }}>
          {resumen}
        </div>
      )}
      {docs.map((d, i) => {
        const cfg = LEGAL_STATUS_CFG[d.status] || LEGAL_STATUS_CFG.pendiente;
        return (
          <div key={d.docKey} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < docs.length - 1 ? '1px solid #EDE8DF' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: C.teal, flex: 1 }}>{d.label}</div>
            {d.dueDate && <div style={{ fontSize: 11, color: '#6B7280', width: 100, flexShrink: 0 }}>{d.dueDate}</div>}
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: cfg.color, textTransform: 'uppercase' }}>{cfg.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const PortalView: React.FC<{ token: string; data: CarteraPortalData; onLogout: () => void }> = ({ token, data, onLogout }) => {
  const [showChangePass, setShowChangePass] = React.useState(data.password_es_temporal);

  const recaudado = data.cuotas.filter(q => q.estado === 'pagada').reduce((s, q) => s + q.monto, 0);
  const pendiente = data.cuotas.filter(q => q.estado !== 'pagada').reduce((s, q) => s + q.monto, 0);
  const proximaCuota = data.cuotas
    .filter(q => q.estado === 'pendiente' || q.estado === 'vencida')
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0];
  const confiabilidad = calcConfiabilidad(data.cuotas);

  const hitos = React.useMemo(() => {
    const hoy = new Date();
    type Hito = { fecha: string; label: string; estado: 'cumplido' | 'vencido' | 'proximo' | 'futuro' };
    const clasificar = (fecha: string, cumplida: boolean): Hito['estado'] => {
      if (cumplida) return 'cumplido';
      const diff = (new Date(fecha).getTime() - hoy.getTime()) / 86400000;
      if (diff < 0) return 'vencido';
      if (diff <= 10) return 'proximo';
      return 'futuro';
    };
    const list: Hito[] = [{ fecha: data.fecha_separacion, label: 'Separación del inmueble', estado: 'cumplido' }];
    data.cuotas.forEach(q => list.push({
      fecha: q.fecha_vencimiento,
      label: `${CONCEPTO_LABEL[q.concepto] || q.concepto} #${q.numero} — ${fmt(q.monto)}`,
      estado: clasificar(q.fecha_vencimiento, q.estado === 'pagada'),
    }));
    if (data.fecha_escritura) list.push({ fecha: data.fecha_escritura, label: 'Escritura pública', estado: clasificar(data.fecha_escritura, false) });
    if (data.fecha_entrega) list.push({ fecha: data.fecha_entrega, label: 'Entrega del inmueble', estado: clasificar(data.fecha_entrega, false) });
    return list.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [data]);

  const ESTADO_CFG: Record<string, { color: string; label: string }> = {
    cumplido: { color: '#10B981', label: 'Cumplido' }, vencido: { color: '#EF4444', label: 'Vencido' },
    proximo: { color: '#F59E0B', label: 'Próximo' }, futuro: { color: '#9CA3AF', label: 'Futuro' },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4EF' }}>
      <div style={{ background: '#fff', padding: '24px 40px', borderBottom: `3px solid ${C.red}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: C.red, fontFamily: C.fontSerif, marginBottom: 6 }}>GLP WEALTH MANAGEMENT</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 400, color: C.teal, fontFamily: C.fontSerif, margin: 0 }}>{data.prospecto_nombre}</h1>
          <div style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: 4 }}>{data.proyecto}{data.unidad ? ` · ${data.unidad}` : ''} · {data.modalidad.toUpperCase()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowChangePass(true)} style={{ background: 'transparent', border: `1px solid ${C.teal}`, color: C.teal, padding: '8px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cambiar Contraseña</button>
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid #E5E7EB', color: '#6B7280', padding: '8px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { l: 'Precio Total', v: fmt(data.precio_total) },
            { l: 'Recaudado', v: fmt(recaudado) },
            { l: 'Pendiente', v: fmt(pendiente) },
            { l: 'Próxima Cuota', v: proximaCuota ? proximaCuota.fecha_vencimiento : '✓ Al día' },
          ].map(k => (
            <div key={k.l} style={{ background: '#fff', border: '1px solid #EDE8DF', padding: '14px 16px' }}>
              <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{k.l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.teal, fontFamily: C.fontSerif }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${RIESGO_COLOR[data.riesgo]}15`, border: `1px solid ${RIESGO_COLOR[data.riesgo]}40`, padding: '6px 14px', borderRadius: 20 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: RIESGO_COLOR[data.riesgo] }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: RIESGO_COLOR[data.riesgo] }}>{RIESGO_LABEL[data.riesgo]}</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${confiabilidad.color}15`, border: `1px solid ${confiabilidad.color}40`, padding: '6px 14px', borderRadius: 20 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: confiabilidad.color }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: confiabilidad.color }}>
              {confiabilidad.label}{confiabilidad.pct !== null ? ` (${confiabilidad.pct}% a tiempo)` : ''}
            </span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #EDE8DF', padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: C.teal, marginBottom: 16, textTransform: 'uppercase' }}>Cronograma</div>
          {hitos.map((h, i) => {
            const cfg = ESTADO_CFG[h.estado];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < hitos.length - 1 ? '1px solid #EDE8DF' : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                <div style={{ fontSize: 11, color: '#6B7280', width: 100, flexShrink: 0 }}>{h.fecha}</div>
                <div style={{ fontSize: 12, color: C.teal, flex: 1 }}>{h.label}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: cfg.color, textTransform: 'uppercase' }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>

        <TramiteSection token={token} />

        <div style={{ background: '#fff', border: '1px solid #EDE8DF' }}>
          <div style={{ padding: '16px 20px 0', fontSize: 11, fontWeight: 700, letterSpacing: 2, color: C.teal, textTransform: 'uppercase' }}>Plan de Pagos</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#EDE8DF' }}>
                {['#', 'Concepto', 'Monto', 'Vencimiento', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: C.teal, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cuotas.map((q, i) => (
                <tr key={q.id} style={{ borderTop: '1px solid #EDE8DF', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#9CA3AF' }}>{q.numero}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: C.teal }}>{CONCEPTO_LABEL[q.concepto] || q.concepto}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: C.teal }}>{fmt(q.monto)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280' }}>{q.fecha_vencimiento}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: q.estado === 'pagada' ? '#10B981' : q.estado === 'vencida' ? '#EF4444' : q.estado === 'en_proceso' ? '#F59E0B' : '#9CA3AF' }}>
                    {q.estado === 'pagada' ? 'Pagada' : q.estado === 'vencida' ? 'Vencida' : q.estado === 'en_proceso' ? 'En proceso' : 'Pendiente'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showChangePass && <ChangePasswordModal token={token} forced={data.password_es_temporal} onClose={() => setShowChangePass(false)} />}
    </div>
  );
};

const ClientPortalApp: React.FC = () => {
  const [token, setToken] = React.useState<string | null>(() => sessionStorage.getItem('glp_portal_token'));
  const [data, setData] = React.useState<CarteraPortalData | null>(null);
  const [loadingSession, setLoadingSession] = React.useState(!!token);

  React.useEffect(() => {
    if (!token) return;
    fetch(`${API_ROOT}/api/portal/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error('sesión inválida'); return res.json(); })
      .then(d => setData(d))
      .catch(() => { sessionStorage.removeItem('glp_portal_token'); setToken(null); })
      .finally(() => setLoadingSession(false));
  }, [token]);

  const handleLogout = () => {
    sessionStorage.removeItem('glp_portal_token');
    setToken(null);
    setData(null);
  };

  if (loadingSession) return null;
  if (!token || !data) {
    return <LoginScreen onSuccess={(t, d) => { setToken(t); setData(d); }} />;
  }
  return <PortalView token={token} data={data} onLogout={handleLogout} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClientPortalApp />
  </React.StrictMode>,
);
