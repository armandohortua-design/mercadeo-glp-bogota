const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();
const pool = require('./db');
const { startEmailPoller, pollInbox } = require('./emailPoller');
const { startProspectMonitor, monitorProspects, saraAutoTrigger72h, detectColdProspects } = require('./prospectMonitor');
const { startCrisisDetector, detectCrisis } = require('./crisisDetector');
const { startLegalAlertMonitor } = require('./legalAlertMonitor');
const { credencialesConfiguradas: docusignConfigurado, crearSobre: docusignCrearSobre, parseWebhookEvent: docusignParseWebhook } = require('./docusign');
const { processIncomingMessage } = require('./whatsapp');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const app = express();
const PORT = process.env.PORT || 3001;

// Red de seguridad: un error no manejado en cualquier job de fondo (poller IMAP, monitores
// de crisis/legal, etc.) NO debe tumbar todo el servidor — eso deja el CRM entero en ceros
// (dashboard, prospectos, reportes) por una falla aislada y no crítica. Se registra y sigue.
process.on('uncaughtException', (err) => {
  console.error('⚠️ Excepción no capturada (servidor sigue activo):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Rechazo de promesa no capturado (servidor sigue activo):', err);
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ==========================================
// MULTI-TENANT: resolver tenant desde header
// ==========================================
async function resolveTenant(req) {
  const tenantId = req.headers['x-tenant-id'] || 'tenant-glp-001';
  try {
    const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (rows.length > 0) return rows[0];
  } catch (err) {
    console.error('Error resolviendo tenant:', err.message);
  }
  return {
    id: 'default',
    name: 'GLP Wealth Management',
    domain: 'glp.com.pa',
    contact: { address: '2GFM+R7, C. Ramon H. Jurado, Panamá', email: 'info@glp.com.pa', website: 'www.glp.com.pa' },
    smtp: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    openai: { apiKey: process.env.OPENAI_API_KEY }
  };
}

// Antes ninguna llamada a los agentes identificaba QUIÉN la disparó — con varios usuarios
// del mismo tenant usando el CRM a la vez, era imposible auditar "quién generó este borrador"
// o detectar que dos personas dispararon la misma acción en paralelo. El frontend manda el
// username en el header x-user en cada llamada de agente (ver triggerOpenAI/handleCamilo/etc.
// en CRMDashboard.tsx); 'desconocido' cubre llamadas viejas de clientes no actualizados.
function resolveUser(req) {
  return req.headers['x-user'] || 'desconocido';
}

// pg devuelve columnas DATE como objetos Date — String(date) da "Thu Aug 20 2026..." (con una
// 'T' mayúscula dentro de "Thu"!), así que .split('T') corta mal. toISOString() es seguro.
function fmtDateOnly(v) {
  if (!v) return v;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v).split('T')[0];
}

function getTransporter(tenant) {
  const user = tenant?.smtp?.user || process.env.SMTP_USER;
  const pass = tenant?.smtp?.pass || process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn(`⚠️ SMTP no configurado para tenant ${tenant?.id}`);
    return null;
  }
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
}

// ==========================================
// BITÁCORA DE AGENTES (agent_runs) — Fase 0 de ARQUITECTURA_AGENTICA_MULTIUSUARIO.md
// Antes no existía forma de saber quién disparó qué acción de agente, ni de detectar que
// dos usuarios del mismo tenant dispararon la misma acción en paralelo. Esta tabla es la
// base tanto de la atribución (Fase 0) como del candado anti-duplicados (Fase 1).
// ==========================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        triggered_by TEXT,
        agent_name TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'en_curso',
        tokens_estimados INT,
        latencia_ms INT,
        error_detalle TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        finished_at TIMESTAMPTZ
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_status ON agent_runs (tenant_id, agent_name, action, status)`);
    // Fase 2 de ARQUITECTURA_AGENTICA_MULTIUSUARIO.md: medir gasto real por tenant/agente
    // ANTES de fijar cualquier tope — se guardan tokens de entrada/salida por separado
    // (el precio de OpenAI es distinto para cada uno) y el costo estimado ya calculado.
    await pool.query(`
      ALTER TABLE agent_runs
        ADD COLUMN IF NOT EXISTS prompt_tokens INT,
        ADD COLUMN IF NOT EXISTS completion_tokens INT,
        ADD COLUMN IF NOT EXISTS costo_estimado_usd NUMERIC(10,6)
    `);
    // Candado anti-duplicados (Fase 1): un índice único parcial que solo aplica a filas
    // 'en_curso' — mientras haya una fila así para (tenant, agente, acción), Postgres
    // rechaza cualquier INSERT que intente crear otra igual con un error de violación de
    // unicidad (código 23505). startAgentRun usa ESE rechazo, atómico a nivel de base de
    // datos, para detectar la colisión — evita la condición de carrera de "verificar y
    // luego insertar" (dos requests casi simultáneos podrían pasar la verificación antes
    // de que cualquiera alcance a insertar).
    // agent_name <> 'DESCONOCIDO' excluye llamadas ad-hoc a /api/ai que no se identifican
    // como un agente del enjambre (ej. el análisis de imagen del Catálogo) — esas se siguen
    // registrando en la bitácora, pero nunca deben bloquearse entre sí ni bloquear a un
    // agente real por compartir la ruta genérica.
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_active_lock
      ON agent_runs (tenant_id, agent_name, action) WHERE status = 'en_curso' AND agent_name <> 'DESCONOCIDO'
    `);
  } catch (e) { console.warn('agent_runs table check:', e.message); }
})();

// startAgentRun: registra el inicio de una ejecución y devuelve { id, started_at, locked:false }.
// Si ya hay una ejecución en curso para el mismo (tenant, agente, acción), devuelve
// { locked: true, lockedBy, lockedSince } en vez de crear una segunda — así el llamador
// puede avisarle al usuario "ya en curso" en lugar de disparar el trabajo por duplicado.
// Antes de intentar el INSERT, libera candados huérfanos (procesos que murieron a mitad de
// una ejecución y nunca llamaron a finishAgentRun) con más de 10 minutos en curso.
const AGENT_LOCK_STALE_MINUTES = 10;
const EMAIL_DRAFT_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'borrador_correo',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['subject', 'body'],
    },
  },
};

async function startAgentRun(tenantId, triggeredBy, agentName, action) {
  try {
    await pool.query(
      `UPDATE agent_runs SET status='error', error_detalle='timeout — liberado automáticamente (candado huérfano)', finished_at=NOW()
       WHERE status='en_curso' AND started_at < NOW() - INTERVAL '${AGENT_LOCK_STALE_MINUTES} minutes'`
    );
    const { rows } = await pool.query(
      `INSERT INTO agent_runs (tenant_id, triggered_by, agent_name, action) VALUES ($1,$2,$3,$4) RETURNING id, started_at`,
      [tenantId, triggeredBy, agentName, action]
    );
    return { ...rows[0], locked: false };
  } catch (e) {
    if (e.code === '23505') {
      const { rows } = await pool.query(
        `SELECT triggered_by, started_at FROM agent_runs WHERE tenant_id=$1 AND agent_name=$2 AND action=$3 AND status='en_curso'`,
        [tenantId, agentName, action]
      );
      return { locked: true, lockedBy: rows[0]?.triggered_by || 'otro usuario', lockedSince: rows[0]?.started_at };
    }
    console.warn('startAgentRun falló:', e.message); return null;
  }
}
// Precios de OpenAI por millón de tokens — Fase 2 (medir gasto real antes de fijar un
// tope, según lo acordado). Todas las llamadas de agentes hoy usan gpt-4o-mini; si en el
// futuro algún agente cambia de modelo, agregar su entrada aquí antes de que empiece a
// registrar costo $0 por error.
const PRECIOS_USD_POR_1M_TOKENS = {
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
};
function estimarCostoUsd(model, promptTokens, completionTokens) {
  const precio = PRECIOS_USD_POR_1M_TOKENS[model] || PRECIOS_USD_POR_1M_TOKENS['gpt-4o-mini'];
  return ((promptTokens || 0) * precio.input + (completionTokens || 0) * precio.output) / 1_000_000;
}

async function finishAgentRun(runId, { status = 'completado', tokensEstimados = null, promptTokens = null, completionTokens = null, model = 'gpt-4o-mini', errorDetalle = null } = {}) {
  if (!runId) return;
  try {
    const costo = (promptTokens != null || completionTokens != null) ? estimarCostoUsd(model, promptTokens, completionTokens) : null;
    // La latencia se calcula EN Postgres (finished_at - started_at, ambos NOW() del mismo
    // servidor) en vez de restar contra un timestamp traído al proceso de Node — restar así
    // se ve afectado por el desfase de reloj entre el servidor de la app y el de Supabase, y
    // puede dar negativo (se detectó justo ese caso en la prueba de esta implementación).
    await pool.query(
      `UPDATE agent_runs SET status=$1, tokens_estimados=$2, prompt_tokens=$3, completion_tokens=$4,
         costo_estimado_usd=$5, error_detalle=$6,
         latencia_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000, finished_at=NOW()
       WHERE id=$7`,
      [status, tokensEstimados, promptTokens, completionTokens, costo, errorDetalle, runId]
    );
  } catch (e) { console.warn('finishAgentRun falló:', e.message); }
}

// GET /api/agent-runs/active — para que el frontend muestre "ya en curso, iniciado por X
// hace Ys" de forma PROACTIVA (al abrir el módulo, por polling), no solo como reacción al
// error 409 de haber hecho clic. Principio 3 de ARQUITECTURA_AGENTICA_MULTIUSUARIO.md: el
// estado de una ejecución en curso debe ser visible para todos los usuarios del tenant.
app.get('/api/agent-runs/active', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT agent_name, action, triggered_by, started_at FROM agent_runs WHERE tenant_id=$1 AND status='en_curso'`,
      [tenant.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agent-runs — bitácora completa (Fase 0), solo para roles con visibilidad de
// equipo (superadmin/gerencia/presidencia — el frontend ya filtra por rol, esta ruta no
// distingue quién pregunta porque el CRM no manda el rol en la request; el control de
// acceso vive en qué módulo del CRM llama a esto).
app.get('/api/agent-runs', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT * FROM agent_runs WHERE tenant_id=$1 ORDER BY started_at DESC LIMIT 200`,
      [tenant.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agent-runs/resumen-costo?days=30 — gasto real de IA por agente en el tenant,
// para "medir primero" (Fase 2) antes de fijar cualquier tope de gasto. Se agrupa por
// agente para poder ver, por ejemplo, que Camilo (research con web_search) es el más caro
// del enjambre, y decidir un límite informado en vez de un número arbitrario.
app.get('/api/agent-runs/resumen-costo', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
    const { rows } = await pool.query(
      `SELECT agent_name,
              COUNT(*) AS ejecuciones,
              COUNT(*) FILTER (WHERE status = 'error') AS errores,
              COALESCE(SUM(costo_estimado_usd), 0) AS costo_total_usd,
              COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens_totales,
              COALESCE(AVG(latencia_ms), 0) AS latencia_prom_ms
       FROM agent_runs
       WHERE tenant_id = $1 AND started_at > NOW() - ($2 || ' days')::INTERVAL
       GROUP BY agent_name
       ORDER BY costo_total_usd DESC`,
      [tenant.id, days]
    );
    const { rows: totalRows } = await pool.query(
      `SELECT COALESCE(SUM(costo_estimado_usd), 0) AS costo_total_usd, COUNT(*) AS ejecuciones
       FROM agent_runs WHERE tenant_id = $1 AND started_at > NOW() - ($2 || ' days')::INTERVAL`,
      [tenant.id, days]
    );
    res.json({ days, porAgente: rows, total: totalRows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const tenant = await resolveTenant(req);
    res.json({
      status: 'ok',
      database: 'PostgreSQL (Supabase)',
      serverTime: new Date().toISOString(),
      smtpConfigured: !!(tenant?.smtp?.user && tenant?.smtp?.pass) || !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      openaiConfigured: !!(tenant?.openai?.apiKey) || !!process.env.OPENAI_API_KEY,
      apolloConfigured: !!(tenant?.apollo?.apiKey)
    });
  } catch (err) {
    res.status(500).json({ status: 'error', database: err.message });
  }
});

// ==========================================
// PROSPECTOS
// ==========================================
app.get('/api/prospectos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      'SELECT * FROM prospectos WHERE tenant_id = $1 ORDER BY fecha_registro DESC',
      [tenant.id]
    );
    // El frontend espera camelCase (emailHistory); la columna real es snake_case.
    res.json(rows.map(r => ({ ...r, emailHistory: r.email_history || [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prospectos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const p = req.body;
    const { rows } = await pool.query(
      `INSERT INTO prospectos (
        tenant_id, nombre, apellido, correo, telefono, direccion, ocupacion, empresa,
        linkedin, proyectos_interes, forma_contacto, broker_asignado, presupuesto_usd,
        estado, canal, notas, historial, fecha_registro, fecha_ultima_actividad
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        tenant.id, p.nombre, p.apellido, p.correo, p.telefono, p.direccion,
        p.ocupacion, p.empresa, p.linkedin,
        JSON.stringify(p.proyectos_interes || []),
        p.forma_contacto, p.broker_asignado, p.presupuesto_usd,
        p.estado || 'Lead Nuevo', p.canal || 'Web', p.notas,
        JSON.stringify(p.historial || []),
        p.fecha_registro || new Date().toISOString(),
        new Date().toISOString()
      ]
    );
    res.json({ success: true, prospecto: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/prospectos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { id } = req.params;
    const updates = req.body;

    if (updates.historial_append) {
      await pool.query(
        `UPDATE prospectos SET historial = COALESCE(historial,'[]'::jsonb) || $1::jsonb,
         fecha_ultima_actividad = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [JSON.stringify([updates.historial_append]), id, tenant.id]
      );
      return res.json({ success: true });
    }

    // Columnas reales de prospectos — el frontend envía el objeto Prospect completo (incluye
    // campos como emailHistory/whatsappHistory que solo existen en el estado del CRM, no en la
    // tabla), así que se filtra a solo las columnas que existen para evitar el 500 de Postgres.
    // fecha_ultima_actividad se excluye a propósito: la query siempre la fija con NOW() más
    // abajo, incluirla aquí también causaría "multiple assignments to same column".
    const PROSPECTO_COLUMNS = new Set([
      'nombre', 'apellido', 'correo', 'telefono', 'direccion', 'ocupacion', 'empresa',
      'linkedin', 'proyectos_interes', 'forma_contacto', 'broker_asignado', 'presupuesto_usd',
      'estado', 'canal', 'notas', 'historial', 'fecha_registro',
      'sara_auto_email_sent', 'sara_cold_alert_sent', 'razon_perdida', 'razon_perdida_detalle',
      'fecha_perdida', 'email_history',
    ]);
    // El frontend usa camelCase (emailHistory) pero la columna real es snake_case
    // (email_history) — antes emailHistory no estaba ni en la whitelist ni mapeado, así que
    // un correo "eliminado" en el navegador nunca se borraba de verdad y volvía a aparecer.
    if (updates.emailHistory !== undefined) updates.email_history = updates.emailHistory;
    const fields = Object.keys(updates).filter(k => PROSPECTO_COLUMNS.has(k));
    if (fields.length === 0) return res.json({ success: true });

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map(f => {
      if ((f === 'proyectos_interes' || f === 'historial' || f === 'email_history') && Array.isArray(updates[f]))
        return JSON.stringify(updates[f]);
      return updates[f];
    });
    values.push(id, tenant.id);

    await pool.query(
      `UPDATE prospectos SET ${setClause}, fecha_ultima_actividad = NOW()
       WHERE id = $${fields.length + 1} AND tenant_id = $${fields.length + 2}`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/prospectos/by-email/:email', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { historial_append } = req.body;
    if (!historial_append) return res.json({ success: true });
    await pool.query(
      `UPDATE prospectos SET historial = COALESCE(historial,'[]'::jsonb) || $1::jsonb,
       fecha_ultima_actividad = NOW()
       WHERE correo = $2 AND tenant_id = $3`,
      [JSON.stringify([historial_append]), req.params.email, tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/prospectos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM prospectos WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PERFILES SOFÍA — persistencia (antes solo vivían en localStorage del frontend, por lo
// que emailPoller.js/generateSaraDraft no podía usarlos al redactar respuestas).
// ==========================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sofia_profiles (
        prospecto_id INTEGER PRIMARY KEY REFERENCES prospectos(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL,
        arquetipo TEXT NOT NULL,
        confianza INTEGER,
        senales JSONB DEFAULT '[]',
        recomendacion_sara TEXT,
        recomendacion_valeria TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('sofia_profiles table check:', e.message); }
})();

// ==========================================
// TESTIMONIOS — para la sección de prueba social de la landing (nombre, rol/ciudad,
// texto, calificación, foto). 'status' empieza en 'draft': un testimonio cargado en el
// CRM no aparece en la landing hasta que alguien lo pasa a 'published' — evita que un
// borrador a medio llenar salga público por accidente.
// ==========================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'tenant-glp-001',
        nombre TEXT NOT NULL,
        rol TEXT,
        ciudad TEXT,
        foto_url TEXT,
        texto TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        status TEXT DEFAULT 'draft',
        orden INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('testimonials table check:', e.message); }
})();

app.get('/api/testimonials', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    // La landing pública pide solo los publicados (?status=published); el CRM pide
    // todos para poder gestionar los borradores.
    const { status } = req.query;
    const { rows } = status
      ? await pool.query('SELECT * FROM testimonials WHERE tenant_id = $1 AND status = $2 ORDER BY orden ASC, created_at DESC', [tenant.id, status])
      : await pool.query('SELECT * FROM testimonials WHERE tenant_id = $1 ORDER BY orden ASC, created_at DESC', [tenant.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/testimonials', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { nombre, rol, ciudad, foto_url, texto, rating, status, orden } = req.body;
    if (!nombre || !texto) return res.status(400).json({ error: 'nombre y texto son requeridos' });
    const id = `testi-${Date.now()}-${Math.floor(Math.random() * 9000)}`;
    await pool.query(
      `INSERT INTO testimonials (id, tenant_id, nombre, rol, ciudad, foto_url, texto, rating, status, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, tenant.id, nombre, rol || null, ciudad || null, foto_url || null, texto, rating || 5, status || 'draft', orden || 0]
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/testimonials/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { nombre, rol, ciudad, foto_url, texto, rating, status, orden } = req.body;
    await pool.query(
      `UPDATE testimonials SET nombre=$1, rol=$2, ciudad=$3, foto_url=$4, texto=$5, rating=$6, status=$7, orden=$8, updated_at=NOW()
       WHERE id=$9 AND tenant_id=$10`,
      [nombre, rol || null, ciudad || null, foto_url || null, texto, rating || 5, status || 'draft', orden || 0, req.params.id, tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/testimonials/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM testimonials WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sofia-profiles/:prospectoId', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { arquetipo, confianza, senales, recomendacion_sara, recomendacion_valeria } = req.body;
    await pool.query(`
      INSERT INTO sofia_profiles (prospecto_id, tenant_id, arquetipo, confianza, senales, recomendacion_sara, recomendacion_valeria, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (prospecto_id) DO UPDATE SET
        arquetipo=$3, confianza=$4, senales=$5, recomendacion_sara=$6, recomendacion_valeria=$7, updated_at=NOW()
    `, [req.params.prospectoId, tenant.id, arquetipo, confianza, JSON.stringify(senales || []), recomendacion_sara, recomendacion_valeria]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// FAQS — antes vivían solo en localStorage del navegador, así que ningún agente en el
// backend (Sara redactando borradores, el poller de correo) podía verlas ni usarlas para
// generar contenido consistente con las respuestas oficiales. Ahora persisten en Postgres
// y se inyectan como contexto real en los prompts que redactan correos a clientes.
// ==========================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        categoria TEXT,
        pregunta TEXT NOT NULL,
        respuesta TEXT NOT NULL,
        veces_usada INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('faqs table check:', e.message); }
})();

app.get('/api/faqs', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query('SELECT * FROM faqs WHERE tenant_id = $1 ORDER BY veces_usada DESC, created_at DESC', [tenant.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/faqs', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { categoria, pregunta, respuesta } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO faqs (tenant_id, categoria, pregunta, respuesta) VALUES ($1,$2,$3,$4) RETURNING *',
      [tenant.id, categoria || null, pregunta, respuesta]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Clics de FAQ — antes se insertaban directo desde el navegador al cliente de Supabase
// (RLS + errores silenciosos: si algo fallaba, nadie se enteraba) y se contaban cruzando
// por TEXTO de la pregunta contra la tabla `faqs` — fràgil, porque el texto de la landing
// y el del CRM podían desincronizarse (como pasó: la landing cayó a su respaldo fijo con
// preguntas viejas y ningún clic volvía a coincidir). Ahora se registra por faq_id real
// (siempre exacto, sin importar el texto) a través del backend, que sí falla de forma
// visible si algo sale mal.
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faq_clicks (
        id BIGSERIAL PRIMARY KEY,
        question TEXT,
        category TEXT,
        source TEXT,
        clicked_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE faq_clicks ADD COLUMN IF NOT EXISTS faq_id BIGINT`);
  } catch (e) { console.warn('faq_clicks table/faq_id check:', e.message); }
})();

app.post('/api/faq-clicks', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { faq_id, source } = req.body;
    if (!faq_id) return res.status(400).json({ error: 'faq_id requerido.' });
    const { rows: faqRows } = await pool.query('SELECT categoria, pregunta FROM faqs WHERE id = $1 AND tenant_id = $2', [faq_id, tenant.id]);
    if (faqRows.length === 0) return res.status(404).json({ error: 'FAQ no encontrada.' });
    await pool.query(
      `INSERT INTO faq_clicks (faq_id, question, category, source) VALUES ($1,$2,$3,$4)`,
      [faq_id, faqRows[0].pregunta, faqRows[0].categoria, source || 'crm']
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/faq-clicks', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    // Clics individuales (no agregados) — mismo shape que antes (question/category/source/
    // clicked_at) para no romper el analítico existente del módulo FAQs, más faq_id para
    // el cruce exacto en "Más Consultadas". Solo clics de FAQs que existen HOY en este
    // tenant — descarta ruido de preguntas viejas ya eliminadas/reemplazadas.
    const { rows } = await pool.query(`
      SELECT c.faq_id, c.question, c.category, c.source, c.clicked_at
      FROM faq_clicks c
      JOIN faqs f ON f.id = c.faq_id AND f.tenant_id = $1
      WHERE c.faq_id IS NOT NULL
      ORDER BY c.clicked_at DESC
      LIMIT 500
    `, [tenant.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/faqs/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { categoria, pregunta, respuesta } = req.body;
    const { rows } = await pool.query(
      `UPDATE faqs SET
         categoria = COALESCE($1, categoria),
         pregunta = COALESCE($2, pregunta),
         respuesta = COALESCE($3, respuesta)
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [categoria, pregunta, respuesta, req.params.id, tenant.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'FAQ no encontrada.' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/faqs/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM faqs WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Contexto de FAQs para inyectar en prompts de generación de correos — y matcher de
// relevancia liviano (superposición de palabras clave, sin embeddings) para saber cuáles
// FAQs realmente aportaron a la respuesta y así incrementar su contador de uso real.
async function getFaqsForPrompt(tenantId) {
  try {
    const { rows } = await pool.query('SELECT id, categoria, pregunta, respuesta FROM faqs WHERE tenant_id = $1', [tenantId]);
    return rows;
  } catch { return []; }
}
function buildFaqContextText(faqs) {
  if (!faqs || faqs.length === 0) return '';
  return '\nPREGUNTAS FRECUENTES OFICIALES (usa esta información como base si el cliente pregunta algo relacionado; no la ignores ni inventes una respuesta distinta a la oficial):\n' +
    faqs.map(f => `- P: ${f.pregunta}\n  R: ${f.respuesta}`).join('\n');
}
const STOPWORDS_ES = new Set(['de','la','el','en','y','a','que','es','un','una','para','con','los','las','se','del','al','por','como','su','sus','le','lo']);
function textKeywords(text) {
  return new Set((text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOPWORDS_ES.has(w)));
}
async function trackFaqUsage(faqs, clientText) {
  if (!faqs || faqs.length === 0) return;
  const clientWords = textKeywords(clientText);
  if (clientWords.size === 0) return;
  const usedIds = faqs.filter(f => {
    const faqWords = textKeywords(f.pregunta);
    let overlap = 0;
    faqWords.forEach(w => { if (clientWords.has(w)) overlap++; });
    return overlap >= 2;
  }).map(f => f.id);
  if (usedIds.length > 0) {
    await pool.query('UPDATE faqs SET veces_usada = veces_usada + 1 WHERE id = ANY($1)', [usedIds]).catch(() => {});
  }
}

// ==========================================
// GESTIÓN DE CAÍDAS — análisis real de causas + contenido contextual por IA
// ==========================================
// Con muchas causas activas a la vez, el enjambre generaba contenido para las 2 más
// frecuentes automáticamente y el usuario terminaba con un solo bloque de resultados
// mezclando causas sin poder enfocarse en una en particular ni saber cuáles ya se
// habían atendido. Esta tabla guarda, por causa (razon_perdida), si ya fue "gestionada".
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crisis_causa_status (
        tenant_id TEXT NOT NULL,
        causa TEXT NOT NULL,
        gestionado BOOLEAN NOT NULL DEFAULT false,
        gestionado_por TEXT,
        gestionado_at TIMESTAMPTZ,
        PRIMARY KEY (tenant_id, causa)
      )
    `);
  } catch (e) { console.warn('crisis_causa_status table check:', e.message); }
})();

// Distribución real de causas de caída (sin llamar a IA) + su estado de gestión — para
// que el usuario elija sobre cuál(es) causa(s) trabajar antes de correr el enjambre.
app.get('/api/crisis/causas', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT razon_perdida FROM prospectos WHERE tenant_id = $1 AND estado = 'Perdido'`,
      [tenant.id]
    );
    const distribucion = {};
    rows.forEach(r => {
      const cat = r.razon_perdida || 'Sin categorizar';
      distribucion[cat] = (distribucion[cat] || 0) + 1;
    });
    const { rows: statusRows } = await pool.query(
      `SELECT causa, gestionado, gestionado_por, gestionado_at FROM crisis_causa_status WHERE tenant_id = $1`,
      [tenant.id]
    );
    const statusByCausa = {};
    statusRows.forEach(s => { statusByCausa[s.causa] = s; });
    const causas = Object.entries(distribucion)
      .sort((a, b) => b[1] - a[1])
      .map(([causa, total]) => ({
        causa, total,
        gestionado: !!statusByCausa[causa]?.gestionado,
        gestionado_por: statusByCausa[causa]?.gestionado_por || null,
        gestionado_at: statusByCausa[causa]?.gestionado_at || null,
      }));
    res.json({ causas, totalCasos: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/crisis/causas/:causa', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const user = resolveUser(req);
    const { gestionado } = req.body;
    await pool.query(
      `INSERT INTO crisis_causa_status (tenant_id, causa, gestionado, gestionado_por, gestionado_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (tenant_id, causa) DO UPDATE SET
         gestionado = $3, gestionado_por = $4, gestionado_at = NOW()`,
      [tenant.id, req.params.causa, !!gestionado, user]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Antes esto era texto fijo (mismos 2 casos ficticios, DIAN 50%/Tasas 25% siempre) sin
// relación con las razones de baja reales capturadas en prospectos.razon_perdida. Ahora
// se calcula la distribución real de causas y se le pide a la IA generar el reporte de
// Sara, el contenido de Valeria y el guión de Isabella basados en esos datos concretos.
app.post('/api/crisis/analizar-caidas', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const run = await startAgentRun(tenant.id, user, 'CRISIS', 'analizar_caidas');
  if (run?.locked) {
    return res.status(409).json({ error: 'ya_en_curso', lockedBy: run.lockedBy, lockedSince: run.lockedSince });
  }
  try {
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;

    // 'Lead Frío' es un lead nuevo/desactivado poco calificado (puede incluir un lead que
    // acaba de llegar por el formulario web/chatbot) — no es una venta caída. Solo 'Perdido'
    // (dado de baja formalmente, con razón capturada) cuenta aquí.
    const { rows } = await pool.query(
      `SELECT nombre, apellido, presupuesto_usd, proyectos_interes, razon_perdida, razon_perdida_detalle, fecha_perdida
       FROM prospectos WHERE tenant_id = $1 AND estado = 'Perdido'`,
      [tenant.id]
    );

    if (rows.length === 0) {
      await finishAgentRun(run?.id, { status: 'completado' });
      return res.json({ sinDatos: true, mensaje: 'No hay ventas caídas registradas todavía.' });
    }

    const distribucion = {};
    rows.forEach(r => {
      const cat = r.razon_perdida || 'Sin categorizar';
      distribucion[cat] = (distribucion[cat] || 0) + 1;
    });
    // Hasta 2 causas reales distintas — antes solo se generaba contenido para la #1, lo que
    // producía respuestas de "precio" para casos cuyo motivo real era otro (ej. doble
    // tributación) porque simplemente no había pieza dedicada a esa causa. El usuario puede
    // elegir explícitamente cuál(es) causa(s) trabajar (req.body.causas) en vez de que el
    // sistema siempre tome automáticamente las 2 más frecuentes — así puede enfocarse en
    // una causa puntual sin que se mezcle con la más numerosa.
    const causasOrdenadas = Object.entries(distribucion).sort((a, b) => b[1] - a[1]);
    const causasDisponibles = new Set(causasOrdenadas.map(([cat]) => cat));
    const causasSolicitadas = Array.isArray(req.body?.causas)
      ? req.body.causas.filter(c => causasDisponibles.has(c)).slice(0, 2)
      : [];
    const topCausas = causasSolicitadas.length > 0 ? causasSolicitadas : causasOrdenadas.slice(0, 2).map(([cat]) => cat);
    // Solo los casos de las causas seleccionadas alimentan el prompt — si el usuario pidió
    // trabajar únicamente "Precio", el contexto no debe traer casos de otras causas.
    const rowsFiltradas = rows.filter(r => topCausas.includes(r.razon_perdida || 'Sin categorizar'));
    const distribucionTexto = causasOrdenadas
      .map(([cat, n]) => `- ${cat}: ${n} caso(s) (${Math.round(n / rows.length * 100)}%)${topCausas.includes(cat) ? ' [SELECCIONADA PARA ESTE ANÁLISIS]' : ''}`)
      .join('\n');

    const casosTexto = rowsFiltradas.slice(0, 15).map(r =>
      `- ${r.nombre} ${r.apellido || ''} | Proyecto: ${(r.proyectos_interes || [])[0] || 'N/D'} | Presupuesto: $${Number(r.presupuesto_usd || 0).toLocaleString()} | Motivo: ${r.razon_perdida || 'sin categorizar'}${r.razon_perdida_detalle ? ' — ' + r.razon_perdida_detalle : ''}`
    ).join('\n');

    if (!apiKey) {
      await finishAgentRun(run?.id, { status: 'completado' });
      return res.json({
        sinDatos: false,
        distribucion,
        totalCasos: rows.length,
        reporteSara: `Distribución real de causas de caída (${rows.length} casos):\n${distribucionTexto}\n\nCasos:\n${casosTexto}\n\n(Conecta OPENAI_API_KEY para generar el análisis narrativo y el contenido de recuperación con IA.)`,
        investigacionCamilo: '', briefSofia: '', contenidoPorCausa: [], alertas: [],
      });
    }

    // Camilo investiga de verdad la(s) causa(s) reales antes de que el equipo redacte
    // nada — antes esta ruta solo re-empacaba datos internos (razon_perdida) sin ninguna
    // investigación externa real, así que "Camilo" no aportaba nada distinto a un simple
    // conteo. Cada causa se traduce a una búsqueda real y específica.
    const CAUSA_QUERY = {
      'Precio': 'precio inmuebles Panamá vs competencia Costa Rica Miami Portugal 2026 comparación inversión extranjera',
      'Financiamiento': 'financiamiento hipotecario para extranjeros en Panamá bancos requisitos tasas 2026',
      'Impuestos / Doble tributación': 'convenio doble tributación Colombia Panamá CDI inversión inmobiliaria extranjeros 2026',
      'Competencia': 'mercado inmobiliario Panamá comparación de proyectos y precios para inversionistas extranjeros 2026',
      'Tiempos / Trámites': 'tiempos de entrega y trámites de compra inmobiliaria en Panamá para extranjeros 2026',
      'Perdió interés': 'tendencias de inversión inmobiliaria de extranjeros en Panamá 2026',
    };
    const webContext = await webSearchGLP(apiKey, topCausas.map(c => CAUSA_QUERY[c] || `${c} inversión inmobiliaria Panamá extranjeros 2026`));

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres el equipo de Customer Success e IA de GLP Wealth Management (venta de inmuebles en Panamá a inversionistas colombianos): Camilo (investigación), Sofía (psicología del consumidor), Sara (experiencia de cliente), Valeria (copy) e Isabella (video/campañas). Aquí está la distribución REAL de causas de ventas caídas y los casos concretos — NO inventes causas ni nombres, usa solo esta información:

DISTRIBUCIÓN DE CAUSAS:
${distribucionTexto}

CASOS (máx 15):
${casosTexto}

INVESTIGACIÓN REAL DE CAMILO (usa esto para dar soluciones/contexto concretos a cada causa — no la ignores):
${webContext}

Debes generar contenido de recuperación SEPARADO para cada una de estas ${topCausas.length} causas principales: ${topCausas.join(' Y ')}. Cada pieza debe atacar ÚNICAMENTE la objeción de su propia causa — un email sobre "${topCausas[0]}" nunca debe mencionar o resolver otra causa distinta.

Genera un JSON con EXACTAMENTE estas claves de nivel superior (sin anidar objetos ni arrays de objetos, sin texto fuera del JSON — todos los valores son strings):
{
  "investigacionCamilo": "resumen de 3-5 líneas de lo que Camilo encontró en su investigación real para cada causa (cita datos concretos de la investigación de arriba, o di explícitamente que no se encontró información si no la hay)",
  "briefSofia": "brief psicográfico de Sofía: para CADA una de las ${topCausas.length} causas, qué arquetipo de comprador (Coleccionista de Estatus / Preservador de Legado / Decisor Racional / Comprador Aspiracional) predomina y qué sesgo cognitivo específico explica esa objeción particular",
  "reporteSara": "reporte de análisis en markdown, citando los casos reales y sus motivos reales, con una recomendación de acción concreta por cada causa principal — incorpora el arquetipo detectado por Sofía y los hallazgos de Camilo en cada recomendación",
  "emailCausa1": "email de recuperación para la causa '${topCausas[0]}', atacando SOLO esta objeción",
  "postCausa1": "post corto para redes que atienda solo la causa '${topCausas[0]}'",
  "scriptCausa1": "guión corto de reel/video sobre solo la causa '${topCausas[0]}'",
  "campanaCausa1": "plan de campaña semanal de 3 acciones para la causa '${topCausas[0]}'"${topCausas[1] ? `,
  "emailCausa2": "email de recuperación para la causa '${topCausas[1]}', atacando SOLO esta objeción",
  "postCausa2": "post corto para redes que atienda solo la causa '${topCausas[1]}'",
  "scriptCausa2": "guión corto de reel/video sobre solo la causa '${topCausas[1]}'",
  "campanaCausa2": "plan de campaña semanal de 3 acciones para la causa '${topCausas[1]}'"` : ''},
  "alertas": ["1-3 alertas operativas concretas mencionando nombres reales de casos críticos"]
}
${ANTI_HALUCINACION}`,
      }],
      temperature: 0.6,
      max_tokens: 2200,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'analisis_ventas_caidas',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              investigacionCamilo: { type: 'string' },
              briefSofia: { type: 'string' },
              reporteSara: { type: 'string' },
              emailCausa1: { type: 'string' },
              postCausa1: { type: 'string' },
              scriptCausa1: { type: 'string' },
              campanaCausa1: { type: 'string' },
              // Las 4 claves de la 2a causa son nullable en vez de omitidas — json_schema
              // en modo strict exige que TODAS las properties estén en "required" (no
              // permite claves realmente opcionales), así que cuando solo hay 1 causa
              // principal el modelo devuelve null en estos 4 campos.
              emailCausa2: { type: ['string', 'null'] },
              postCausa2: { type: ['string', 'null'] },
              scriptCausa2: { type: ['string', 'null'] },
              campanaCausa2: { type: ['string', 'null'] },
              alertas: { type: 'array', items: { type: 'string' } },
            },
            required: ['investigacionCamilo', 'briefSofia', 'reporteSara', 'emailCausa1', 'postCausa1', 'scriptCausa1', 'campanaCausa1', 'emailCausa2', 'postCausa2', 'scriptCausa2', 'campanaCausa2', 'alertas'],
          },
        },
      },
    });
    await finishAgentRun(run?.id, { status: 'completado', tokensEstimados: response.usage?.total_tokens ?? null, promptTokens: response.usage?.prompt_tokens ?? null, completionTokens: response.usage?.completion_tokens ?? null });
    const parsed = JSON.parse(response.choices[0].message.content.trim());
    // El modelo a veces ignora la instrucción de texto plano y devuelve un objeto anidado
    // en vez de un string (ej. briefSofia o campanaIsabella como {"acción1":...}) — eso
    // rompe el render en React ("Objects are not valid as a React child"), así que se
    // normaliza todo a texto legible antes de responder.
    const toText = (v) => {
      if (v == null) return '';
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return v.map(toText).join('\n');
      if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}: ${toText(val)}`).join('\n');
      return String(v);
    };
    const investigacionCamilo = toText(parsed.investigacionCamilo);
    const briefSofia = toText(parsed.briefSofia);
    const reporteSara = toText(parsed.reporteSara);
    const alertas = Array.isArray(parsed.alertas) ? parsed.alertas.map(toText) : [];
    // Claves planas (emailCausa1, emailCausa2, ...) en vez de un array de objetos — un
    // esquema anidado hacía que gpt-4o-mini omitiera el campo por completo con frecuencia;
    // claves fijas de nivel superior son mucho más confiables. Se reconstruye el array
    // contenidoPorCausa aquí para que el frontend no tenga que cambiar.
    const contenidoPorCausa = topCausas.map((causa, i) => ({
      causa,
      emailValeria: toText(parsed[`emailCausa${i + 1}`]),
      postValeria: toText(parsed[`postCausa${i + 1}`]),
      scriptIsabella: toText(parsed[`scriptCausa${i + 1}`]),
      campanaIsabella: toText(parsed[`campanaCausa${i + 1}`]),
    })).filter(c => c.emailValeria || c.postValeria || c.scriptIsabella || c.campanaIsabella);
    res.json({ sinDatos: false, distribucion, totalCasos: rows.length, investigacionCamilo, briefSofia, reporteSara, contenidoPorCausa, alertas });
  } catch (e) {
    await finishAgentRun(run?.id, { status: 'error', errorDetalle: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// BROKERS
// ==========================================
app.get('/api/brokers', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      'SELECT * FROM brokers WHERE tenant_id = $1 ORDER BY nombre ASC',
      [tenant.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/brokers', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const b = req.body;
    const { rows } = await pool.query(
      `INSERT INTO brokers (tenant_id, nombre, empresa, zona, telefono, email, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenant.id, b.nombre, b.empresa || '', b.zona || '', b.telefono || '', b.email || '', b.estado || 'activo']
    );
    res.json({ success: true, broker: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/brokers/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'tenant_id');
    if (fields.length === 0) return res.json({ success: true });

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map(f => updates[f]);
    values.push(id, tenant.id);

    await pool.query(
      `UPDATE brokers SET ${setClause}, updated_at = NOW()
       WHERE id = $${fields.length + 1} AND tenant_id = $${fields.length + 2}`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/brokers/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM brokers WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BUSINESS CONFIG (Reglas de Negocio parametrizables)
// ==========================================
const DEFAULT_BUSINESS_CONFIG = {
  stageProb: {
    'Contacto Inicial': 0.05, 'Calificación': 0.15, 'Presentación': 0.30,
    'Negociación': 0.60, 'Cierre': 0.85, 'Post-venta': 1.0, 'Lead Frío': 0.02,
  },
  avgDaysPerStage: {
    'Contacto Inicial': 14, 'Calificación': 21, 'Presentación': 30,
    'Negociación': 45, 'Cierre': 20, 'Lead Frío': 60,
  },
  saraThresholds: {
    'Contacto Inicial': { tibio: 5, frio: 12, critico: 21 },
    'Calificación':     { tibio: 7, frio: 14, critico: 25 },
    'Presentación':     { tibio: 7, frio: 15, critico: 25 },
    'Negociación':      { tibio: 4, frio: 8,  critico: 15 },
    'Cierre':           { tibio: 2, frio: 4,  critico: 8 },
    'Post-venta':       { tibio: 14, frio: 30, critico: 60 },
  },
};

async function getBusinessConfig(tenantId) {
  try {
    const { rows } = await pool.query('SELECT config FROM business_config WHERE tenant_id = $1', [tenantId]);
    if (rows.length > 0) {
      return {
        stageProb: { ...DEFAULT_BUSINESS_CONFIG.stageProb, ...(rows[0].config.stageProb || {}) },
        avgDaysPerStage: { ...DEFAULT_BUSINESS_CONFIG.avgDaysPerStage, ...(rows[0].config.avgDaysPerStage || {}) },
        saraThresholds: { ...DEFAULT_BUSINESS_CONFIG.saraThresholds, ...(rows[0].config.saraThresholds || {}) },
      };
    }
  } catch (err) {
    console.error('Error leyendo business_config:', err.message);
  }
  return DEFAULT_BUSINESS_CONFIG;
}

app.get('/api/config/business-rules', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const config = await getBusinessConfig(tenant.id);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config/business-rules', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const config = req.body;
    await pool.query(
      `INSERT INTO business_config (tenant_id, config, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET config = $2::jsonb, updated_at = NOW()`,
      [tenant.id, JSON.stringify(config)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ACTIVOS
// ==========================================
app.get('/api/activos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query('SELECT * FROM activos WHERE tenant_id = $1', [tenant.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const a = req.body;
    const { rows } = await pool.query(
      `INSERT INTO activos (tenant_id, proyecto, unidad, metros_cuadrados, habitaciones, precio_usd, estado, detalles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenant.id, a.proyecto, a.unidad, a.metros_cuadrados, a.habitaciones, a.precio_usd, a.estado || 'Disponible', a.detalles]
    );
    res.json({ success: true, activo: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/activos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'tenant_id');
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = [...fields.map(f => updates[f]), id, tenant.id];
    await pool.query(`UPDATE activos SET ${setClause} WHERE id = $${fields.length + 1} AND tenant_id = $${fields.length + 2}`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/activos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM activos WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BITÁCORA
// ==========================================
app.get('/api/bitacora', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      'SELECT * FROM bitacora WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 200',
      [tenant.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BORRADORES (DRAFTS)
// ==========================================
app.get('/api/drafts', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      'SELECT * FROM drafts WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenant.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crea un borrador manualmente (ej. mensaje de cobranza generado desde Cartera) — antes
// solo emailPoller.js insertaba borradores directamente vía pool.query, no existía una
// ruta para que el frontend guardara uno.
app.post('/api/drafts', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { destinatario, project, subject, body, prioridad, origen, idempotencyKey } = req.body;
    // idempotencyKey (opcional): cuando el llamador puede repetirse por un doble clic o un
    // reintento de red (ej. el auto-envío de Sara al aprobar un insight de Camilo), usarlo
    // como parte del id fija evita crear dos borradores idénticos — el segundo intento
    // choca contra la fila ya creada (ON CONFLICT) y se devuelve esa misma fila en vez de
    // duplicarla.
    const id = idempotencyKey
      ? `draft-${idempotencyKey}`
      : `draft-${project ? project.toLowerCase() : 'manual'}-${Date.now()}-${Math.floor(Math.random() * 9000)}`;
    const { rows } = await pool.query(
      `INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, prioridad, origen, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,NOW())
       ON CONFLICT (id) DO NOTHING RETURNING *`,
      [id, tenant.id, destinatario || '', project || null, subject || '', body || '', prioridad || 'normal', origen || 'manual']
    );
    if (rows.length > 0) return res.json(rows[0]);
    const { rows: existing } = await pool.query('SELECT * FROM drafts WHERE id = $1', [id]);
    res.json(existing[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edita un borrador pendiente — antes no existía ninguna ruta para persistir cambios de
// asunto/cuerpo/destinatario, así que la edición en el frontend solo tocaba el estado
// local de React: al aprobar y enviar, /api/send-draft vuelve a leer la fila ORIGINAL de
// la base de datos, ignorando cualquier edición hecha en pantalla (incluido el
// destinatario, que en los correos auto-generados por Sara/Camilo/Crisis llega con un
// placeholder "Por definir" que antes no había forma de reemplazar).
app.put('/api/drafts/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { destinatario, subject, body, prioridad } = req.body;
    const { rows } = await pool.query(
      `UPDATE drafts SET
         destinatario = COALESCE($1, destinatario),
         subject = COALESCE($2, subject),
         body = COALESCE($3, body),
         prioridad = COALESCE($4, prioridad)
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      [destinatario, subject, body, prioridad, req.params.id, tenant.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Borrador no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drafts/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM drafts WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PROYECTOS / CATÁLOGO
// ==========================================
app.get('/api/projects', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      "SELECT id, data, imagen_url FROM projects WHERE tenant_id = $1 ORDER BY data->>'category', data->>'name'",
      [tenant.id]
    );
    res.json(rows.map(r => ({ id: r.id, ...r.data, imagen: r.imagen_url || r.data?.imagen })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { projects } = req.body;
    if (!Array.isArray(projects)) return res.status(400).json({ error: 'Se requiere un arreglo de proyectos.' });
    await pool.query('DELETE FROM projects WHERE tenant_id = $1', [tenant.id]);
    for (const p of projects) {
      await pool.query(
        'INSERT INTO projects (id, tenant_id, data) VALUES ($1, $2, $3)',
        [p.id || `proj-${Date.now()}-${Math.random()}`, tenant.id, JSON.stringify(p)]
      );
    }
    res.json({ success: true, count: projects.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CONTACTO (Landing Page → CRM)
// ==========================================
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, project, message, channel, conversationHistory, sessionId, presupuesto_usd } = req.body;
    // sessionId solo: mensajes de seguimiento de una conversación de chatbot YA registrada
    // (el primer mensaje con contacto real ya la creó) no siempre repiten el correo/teléfono
    // en el texto — se aceptan igual para poder seguir acumulando conversación/análisis en
    // esa misma fila; el correo/teléfono ya guardado se conserva vía COALESCE más abajo.
    if (!name || !(email || phone || sessionId)) return res.status(400).json({ error: 'Nombre y al menos un dato de contacto (correo o teléfono) son obligatorios.' });

    const firstName = name.trim().split(/\s+/)[0] || 'Cliente';
    const tenant = await resolveTenant(req);
    const user = resolveUser(req);
    const transporter = getTransporter(tenant);

    let emailClientSent = false, emailAdminSent = false, smtpError = null;

    // Analizar conversación con IA para extraer proyecto, nombre real e intereses
    // ANTES de enviar los correos automáticos — así los correos usan datos reales
    // del comprador (proyecto detectado, resumen de su consulta) en vez de los
    // valores genéricos que envía el widget del chatbot (p.ej. "Lead Chatbot SARA",
    // "Asesora Personalizada - GLP").
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    let detectedProject = project;
    let detectedFirstName = firstName;
    let enrichedNotes = message || '';
    let analysis = null;
    let draftSubject = `Información - ${project} | GLP`;
    let draftBody = `Estimado/a ${firstName},\n\nGracias por contactarnos sobre ${project}.\n\nQuedo a tu disposición.\n\nSara Valenzuela\n${tenant.name}`;

    // Cada envío del formulario/chatbot es un lead independiente, no una repetición de la
    // misma acción sobre el mismo recurso — por eso la "action" incluye sessionId/timestamp:
    // así cada lead obtiene su propia fila en agent_runs sin chocar con el candado de
    // concurrencia (que existe para evitar doble-disparo sobre EL MISMO recurso, no para
    // limitar leads simultáneos legítimos de distintos clientes).
    let aiRun = null;
    let aiPromptTokens = 0, aiCompletionTokens = 0;
    if (apiKey && conversationHistory) {
      aiRun = await startAgentRun(tenant.id, user, 'SARA', `procesar_contacto:${sessionId || Date.now()}`);
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });

        // Extraer proyecto, nombre, temas e intereses de la conversación.
        // Antes esto pedía JSON dentro de un prompt de texto libre y se parseaba con
        // JSON.parse + regex para quitar ```json — frágil (ya vimos casos de JSON truncado
        // en producción). response_format: json_schema en modo strict obliga a la API a
        // devolver EXACTAMENTE esta forma, sin necesidad de parsear texto a mano.
        const analysisResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Analiza esta conversación de un chatbot inmobiliario y extrae la información clave del cliente.

CONVERSACIÓN:
${conversationHistory}

Para calcular score_calificacion suma: menciona_inversion(+20) + menciona_presupuesto(+20) + menciona_panama(+10) + menciona_entrega_o_disponibilidad(+15) + menciona_fecha_decision(+20) + menciona_financiamiento(+10) + menciona_habitaciones(+10) + menciona_rentabilidad(+10) + menciona_uso_propio(+5). Ajusta según tono: listo_para_decidir(+10), solo_cotizando(-10). Máximo 100.`
          }],
          temperature: 0.2, max_tokens: 500,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'analisis_conversacion_chatbot',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  nombre_detectado: { type: ['string', 'null'], description: 'Nombre real del cliente si lo mencionó explícitamente, o null si no lo dijo.' },
                  proyecto_principal: { type: 'string', description: "Nombre exacto del proyecto más mencionado, o 'Portafolio GLP' si no se especificó uno." },
                  proyectos_mencionados: { type: 'array', items: { type: 'string' } },
                  temas_interes: { type: 'array', items: { type: 'string', enum: ['precio', 'zona', 'entrega', 'financiamiento', 'rentabilidad', 'habitaciones', 'uso propio', 'inversión'] } },
                  resumen_consulta: { type: 'string', description: 'Resumen en 2-3 oraciones de qué busca el cliente y sus inquietudes principales.' },
                  perfil_inversor: { type: 'string', enum: ['renta', 'patrimonial', 'disfrute', 'mixto', 'desconocido'] },
                  presupuesto_usd: { type: 'number' },
                  señales_calificacion: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      menciona_inversion: { type: 'boolean' },
                      menciona_panama: { type: 'boolean' },
                      menciona_presupuesto: { type: 'boolean' },
                      menciona_entrega_o_disponibilidad: { type: 'boolean' },
                      menciona_financiamiento: { type: 'boolean' },
                      menciona_fecha_decision: { type: 'boolean' },
                      menciona_habitaciones: { type: 'boolean' },
                      menciona_rentabilidad: { type: 'boolean' },
                      menciona_uso_propio: { type: 'boolean' },
                      tono_general: { type: 'string', enum: ['curioso', 'interesado', 'listo_para_decidir', 'solo_cotizando', 'desconocido'] },
                    },
                    required: ['menciona_inversion', 'menciona_panama', 'menciona_presupuesto', 'menciona_entrega_o_disponibilidad', 'menciona_financiamiento', 'menciona_fecha_decision', 'menciona_habitaciones', 'menciona_rentabilidad', 'menciona_uso_propio', 'tono_general'],
                  },
                  score_calificacion: { type: 'number' },
                },
                required: ['nombre_detectado', 'proyecto_principal', 'proyectos_mencionados', 'temas_interes', 'resumen_consulta', 'perfil_inversor', 'presupuesto_usd', 'señales_calificacion', 'score_calificacion'],
              },
            },
          },
        });

        aiPromptTokens += analysisResponse.usage?.prompt_tokens || 0;
        aiCompletionTokens += analysisResponse.usage?.completion_tokens || 0;
        analysis = JSON.parse(analysisResponse.choices[0].message.content.trim());
        if (analysis.proyecto_principal) detectedProject = analysis.proyecto_principal;
        if (analysis.nombre_detectado) detectedFirstName = analysis.nombre_detectado.trim().split(/\s+/)[0];
        // Antes esto envolvía las líneas del cliente en **negritas** estilo Markdown, pero
        // `notas` es una columna de texto plano que el CRM no renderiza como Markdown — se
        // veían los asteriscos literales. Se deja el texto tal cual, ya viene etiquetado
        // "Cliente:"/"SARA:" línea por línea desde el widget.
        const formattedConversation = conversationHistory;

        const señales = analysis.señales_calificacion || {};
        const señalesActivas = Object.entries(señales)
          .filter(([k, v]) => v === true)
          .map(([k]) => k.replace('menciona_', '').replace(/_/g, ' '));

        enrichedNotes = [
          `📋 Resumen: ${analysis.resumen_consulta || '—'}`,
          `🏠 Proyecto: ${analysis.proyecto_principal || '—'}`,
          `🔍 Temas de interés: ${(analysis.temas_interes || []).join(', ')}`,
          `👤 Perfil inversor: ${analysis.perfil_inversor || '—'}`,
          `🎯 Score de calificación: ${analysis.score_calificacion || 0}/100`,
          señalesActivas.length ? `✅ Señales detectadas: ${señalesActivas.join(', ')}` : '',
          señales.tono_general ? `💬 Tono: ${señales.tono_general.replace(/_/g, ' ')}` : '',
          analysis.presupuesto_usd > 0 ? `💰 Presupuesto mencionado: $${analysis.presupuesto_usd.toLocaleString()} USD` : '',
          '',
          '--- Conversación ---',
          formattedConversation
        ].filter(Boolean).join('\n');

        // Generar borrador personalizado con contexto real
        const draftResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `Eres Sara Valenzuela, Directora de Customer Success & Back-Office Comercial de ${tenant.name}. Redacta un correo de seguimiento cálido y profesional para ${detectedFirstName}, quien se comunicó con nosotros y mostró interés en: ${analysis.resumen_consulta || project}. Sus temas de interés son: ${(analysis.temas_interes || []).join(', ')}. Proyecto de interés: ${detectedProject}. IMPORTANTE: nunca menciones "chatbot", "asistente virtual" ni "IA" — di simplemente que "nos contactó" o "tuvo la oportunidad de conversar con nuestro equipo". Firma siempre como Sara Valenzuela, Directora de Customer Success & Back-Office Comercial.` }],
          temperature: 0.7, max_tokens: 500,
          response_format: EMAIL_DRAFT_JSON_SCHEMA,
        });
        aiPromptTokens += draftResponse.usage?.prompt_tokens || 0;
        aiCompletionTokens += draftResponse.usage?.completion_tokens || 0;
        const parsed = JSON.parse(draftResponse.choices[0].message.content.trim());
        if (parsed.subject) draftSubject = parsed.subject;
        if (parsed.body) draftBody = parsed.body;
        await finishAgentRun(aiRun?.id, { status: 'completado', tokensEstimados: aiPromptTokens + aiCompletionTokens, promptTokens: aiPromptTokens, completionTokens: aiCompletionTokens });
      } catch (aiErr) {
        console.warn('⚠️ Análisis IA falló, usando datos básicos:', aiErr.message);
        enrichedNotes = conversationHistory ? `${message || ''}\n\n--- Conversación ---\n${conversationHistory}` : (message || '');
        await finishAgentRun(aiRun?.id, { status: 'error', errorDetalle: aiErr.message });
      }
    } else if (apiKey) {
      aiRun = await startAgentRun(tenant.id, user, 'SARA', `procesar_contacto:${sessionId || Date.now()}`);
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `Eres Sara Valenzuela de ${tenant.name}. Redacta un correo comercial sofisticado para ${firstName} que preguntó por ${project}. Mensaje: "${message || 'información general'}".` }],
          temperature: 0.7, max_tokens: 500,
          response_format: EMAIL_DRAFT_JSON_SCHEMA,
        });
        const parsed = JSON.parse(response.choices[0].message.content.trim());
        if (parsed.subject) draftSubject = parsed.subject;
        if (parsed.body) draftBody = parsed.body;
        await finishAgentRun(aiRun?.id, { status: 'completado', tokensEstimados: response.usage?.total_tokens ?? null, promptTokens: response.usage?.prompt_tokens ?? null, completionTokens: response.usage?.completion_tokens ?? null });
      } catch (aiErr) {
        console.warn('⚠️ OpenAI falló, usando plantilla:', aiErr.message);
        await finishAgentRun(aiRun?.id, { status: 'error', errorDetalle: aiErr.message });
      }
    }

    // Enviar correos automáticos — ya con el proyecto y nombre detectados por IA
    // (si el análisis de conversación corrió) en vez de los valores genéricos que
    // manda el widget del chatbot.
    const emailProject = detectedProject || project;
    const emailRequerimiento = analysis?.resumen_consulta || message || 'Solicitud de información general.';

    // session_id (chatbot) correlaciona todos los mensajes de una misma conversación a un
    // solo prospecto desde el primer mensaje — antes se usaba el correo como llave, así que
    // antes de que el visitante lo diera no había forma de acumular nada en una sola fila.
    // isNewLead determina si esto es un registro nuevo (dispara los correos de bienvenida/alerta)
    // o una actualización de una conversación ya registrada (silenciosa, solo actualiza datos).
    let existingProspect = null;
    if (sessionId) {
      const { rows } = await pool.query(
        'SELECT * FROM prospectos WHERE chat_session_id = $1 AND tenant_id = $2', [sessionId, tenant.id]
      );
      existingProspect = rows[0] || null;
    }
    if (!existingProspect && email) {
      const { rows } = await pool.query(
        'SELECT * FROM prospectos WHERE correo = $1 AND tenant_id = $2', [email, tenant.id]
      );
      existingProspect = rows[0] || null;
    }
    const isNewLead = !existingProspect;

    // Un prospecto NUEVO sin correo NI teléfono es, por definición, imposible de contactar
    // — antes esto igual se registraba (el guard de arriba solo exige name+sessionId, sin
    // exigir un dato de contacto real) y quedaba una fila "fantasma" en Prospectos que nunca
    // se podía trabajar. El widget del chatbot ya solo llama a esta ruta cuando detecta un
    // correo/teléfono real en el mensaje, así que este caso hoy es defensivo (otro canal que
    // llame a /api/contact sin ese filtro), pero se corta aquí para que la tabla de
    // prospectos nunca vuelva a llenarse con leads no contactables.
    if (isNewLead && !email && !phone) {
      return res.json({ success: true, isNewLead: false, registered: false, reason: 'sin_datos_de_contacto' });
    }

    if (transporter && isNewLead) {
      try {
        if (email) {
        await transporter.sendMail({
          from: `"Sara Valenzuela · ${tenant.name}" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
          to: email,
          subject: `Hemos recibido tu solicitud para ${emailProject} - GLP`,
          html: `<div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;border:1px solid #E5E7EB;border-top:4px solid #002349;border-radius:8px;padding:32px;background:#ffffff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <p style="font-size:16px;font-weight:600;color:#002349;margin-top:0;margin-bottom:16px;">Estimado/a ${detectedFirstName},</p>
            <p style="margin-bottom:16px;">Reciba un cordial saludo de parte de nuestro equipo. A través de este mensaje, le confirmamos la recepción de su solicitud de información referente al proyecto <strong>${emailProject}</strong>, perteneciente a nuestro portafolio de inversión inmobiliaria dolarizada en Panamá.</p>
            <p style="margin-bottom:24px;">Nuestros especialistas comerciales ya están revisando los detalles de su consulta. Nos pondremos en contacto con usted a la mayor brevedad posible para proporcionarle la ficha técnica ampliada, planos de distribución y las proyecciones de rentabilidad correspondientes.</p>
            <div style="margin:28px 0;padding:20px;background:#F9FAFB;border-left:4px solid #B89047;border-radius:6px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#002349;text-transform:uppercase;letter-spacing:0.05em;">Detalles de su solicitud:</p>
              <ul style="margin:8px 0 0 0;padding-left:20px;font-size:14px;color:#4B5563;">
                <li><strong>Proyecto de interés:</strong> ${emailProject}</li>
                <li><strong>Mensaje / Requerimiento:</strong> ${emailRequerimiento}</li>
              </ul>
            </div>
            <p style="margin-bottom:24px;">Si desea agilizar su consulta o requiere asistencia inmediata, puede responder directamente a este correo o comunicarse con nosotros vía WhatsApp.</p>
            <p style="margin-bottom:12px;color:#4B5563;">Atentamente,</p>
            <table style="border-collapse:collapse;margin-top:16px;">
              <tr><td style="border-left:3px solid #B89047;padding-left:16px;">
                <div style="font-size:15px;font-weight:bold;color:#002349;">Sara Valenzuela</div>
                <div style="font-size:11px;color:#B89047;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Directora de Customer Success & Back-Office Comercial</div>
                <div style="font-size:13px;font-weight:bold;color:#111827;">${tenant.name}</div>
                <div style="font-size:11px;color:#4B5563;">${tenant.contact?.address || ''}<br/>
                  <a href="mailto:${tenant.contact?.email || ''}" style="color:#002349;text-decoration:none;font-weight:600;">${tenant.contact?.email || ''}</a> |
                  <a href="https://${tenant.contact?.website || ''}" style="color:#002349;text-decoration:none;font-weight:600;">${tenant.contact?.website || ''}</a>
                </div>
              </td></tr>
            </table>
            <hr style="border:0;border-top:1px solid #E5E7EB;margin:28px 0;"/>
            <p style="font-size:10px;color:#94a3b8;font-style:italic;line-height:1.4;"><strong>Nota de Confidencialidad:</strong> Esta comunicación contiene información exclusiva y confidencial de ${tenant.name}. Queda estrictamente prohibida su divulgación sin autorización previa y por escrito.</p>
          </div>`
        });
        emailClientSent = true;
        }

        await transporter.sendMail({
          from: `"SARA Lead Alert" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
          to: process.env.SMTP_USER,
          subject: `🚨 Nuevo Lead Registrado: ${detectedFirstName !== firstName ? detectedFirstName : name} - ${emailProject}`,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#334155;max-width:600px;margin:0 auto;border:1px solid #cbd5e1;border-radius:8px;padding:24px;background:#f8fafc;">
            <h2 style="color:#0f172a;margin-top:0;border-bottom:2px solid #e2e8f0;padding-bottom:12px;">Nuevo Lead desde la Web 🚀</h2>
            <p>Hola Armando,</p>
            <p>Se ha registrado un cliente interesado en el portafolio inmobiliario:</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <tr style="background:#f1f5f9;"><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;width:35%;">Nombre:</td><td style="padding:12px;border:1px solid #e2e8f0;">${detectedFirstName !== firstName ? detectedFirstName : name}</td></tr>
              <tr><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Correo:</td><td style="padding:12px;border:1px solid #e2e8f0;">${email ? `<a href="mailto:${email}" style="color:#0f766e;">${email}</a>` : 'No indicado'}</td></tr>
              <tr style="background:#f1f5f9;"><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Teléfono:</td><td style="padding:12px;border:1px solid #e2e8f0;">${phone || 'No indicado'}</td></tr>
              <tr><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Proyecto:</td><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;color:#0f766e;">${emailProject}</td></tr>
              <tr style="background:#f1f5f9;"><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Canal:</td><td style="padding:12px;border:1px solid #e2e8f0;">${channel || 'Web Form'}</td></tr>
              <tr><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Mensaje:</td><td style="padding:12px;border:1px solid #e2e8f0;font-style:italic;">${emailRequerimiento}</td></tr>
            </table>
            <div style="background:#fef9c3;padding:14px;border-left:4px solid #eab308;border-radius:4px;font-size:13px;color:#713f12;">
              💡 <strong>Acción Automatizada:</strong> SARA envió el correo de bienvenida a <strong>${detectedFirstName}</strong>. Revisa el borrador de respuesta en el panel de <strong>Agentes IA</strong>.
            </div>
          </div>`
        });
        emailAdminSent = true;
      } catch (err) {
        smtpError = err.message;
        console.error('❌ Error SMTP:', err.message);
      }
    }

    // Guardar prospecto — el campo de presupuesto explícito del formulario (si vino) manda
    // sobre lo que la IA haya inferido de la conversación; si ninguno trae dato nuevo en este
    // mensaje, se conserva el valor que ya tenía el prospecto (COALESCE en el UPDATE).
    const budgetFromForm = (typeof presupuesto_usd === 'number' && presupuesto_usd > 0) ? presupuesto_usd : null;
    const budgetFromAI = (typeof analysis?.presupuesto_usd === 'number' && analysis.presupuesto_usd > 0) ? analysis.presupuesto_usd : null;
    const budgetUSD = budgetFromForm ?? budgetFromAI;
    const score = analysis?.score_calificacion ?? null;
    const estadoLead = score !== null ? (score >= 60 ? 'Calificado' : score >= 30 ? 'Contacto Inicial' : 'Lead Frío') : 'Lead Nuevo';
    const temasInteres = JSON.stringify(analysis?.temas_interes || []);
    const proyectosInteres = JSON.stringify(
      (analysis?.proyectos_mencionados && analysis.proyectos_mencionados.length) ? analysis.proyectos_mencionados : [detectedProject]
    );

    if (existingProspect) {
      // Actualización silenciosa de una conversación/sesión ya registrada: se reescribe
      // notas/temas/score con el análisis más reciente (que ya cubre TODA la conversación
      // acumulada, no solo el mensaje nuevo) y solo se pisa correo/teléfono si antes no
      // los tenía — nunca se retrocede el estado que un asesor ya haya movido a mano.
      await pool.query(
        `UPDATE prospectos SET
           correo = COALESCE(NULLIF(correo,''), $1),
           telefono = COALESCE(NULLIF(telefono,''), $2),
           proyectos_interes = $3::jsonb,
           notas = $4,
           temas_interes = $5::jsonb,
           resumen_ia = COALESCE($6, resumen_ia),
           score_calificacion = COALESCE($7, score_calificacion),
           presupuesto_usd = COALESCE($8, presupuesto_usd),
           chat_session_id = COALESCE(chat_session_id, $9),
           fecha_ultima_actividad = NOW()
         WHERE id = $10`,
        [email || null, phone || null, proyectosInteres, enrichedNotes, temasInteres,
         analysis?.resumen_consulta || null, score, budgetUSD, sessionId || null, existingProspect.id]
      );
    } else {
      await pool.query(
        `INSERT INTO prospectos (tenant_id, nombre, apellido, correo, telefono, proyectos_interes, forma_contacto, estado, canal, notas, presupuesto_usd, temas_interes, resumen_ia, score_calificacion, chat_session_id, fecha_registro, fecha_ultima_actividad)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
        [tenant.id, detectedFirstName, '', email || '', phone || '',
         proyectosInteres, channel || 'Web', estadoLead, channel || 'Web',
         enrichedNotes, budgetUSD, temasInteres, analysis?.resumen_consulta || null, score, sessionId || null]
      );
    }

    // Borrador de correo y bitácora solo se generan en el registro nuevo — antes, cada
    // mensaje de una conversación de chatbot ya registrada disparaba OTRO borrador pendiente
    // y OTRA entrada de bitácora, inundando esas vistas por una sola conversación real.
    let draftId = null, logId = null;
    if (isNewLead) {
      draftId = `draft-${Date.now()}`;
      await pool.query(
        'INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, origen, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())',
        [draftId, tenant.id, `${detectedFirstName !== firstName ? detectedFirstName : name} (${email || phone})`, emailProject, draftSubject, draftBody, 'pending', 'solicitud_cliente']
      );

      logId = `log-${Date.now()}`;
      await pool.query(
        `INSERT INTO bitacora (id, tenant_id, timestamp, cliente, correo, whatsapp, proyecto, canal, correo_cliente, correo_admin, borrador_creado, mensaje)
         VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [logId, tenant.id, detectedFirstName !== firstName ? detectedFirstName : name, email || null, phone || 'N/A', emailProject, channel || 'Web',
         emailClientSent ? 'Enviado' : (email ? `Falló (${smtpError})` : 'N/A (sin correo)'),
         emailAdminSent ? 'Enviado' : `Falló (${smtpError})`,
         draftId, emailRequerimiento]
      );
    }

    res.json({ success: true, isNewLead, logId, draftId, smtpError });
  } catch (error) {
    console.error('❌ Error en /api/contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ENVIAR BORRADOR APROBADO
// ==========================================
app.post('/api/send-draft', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const user = resolveUser(req);
    const { id, attachments = [] } = req.body;
    if (!id) return res.status(400).json({ error: 'ID del borrador requerido.' });

    const { rows } = await pool.query('SELECT * FROM drafts WHERE id = $1 AND tenant_id = $2', [id, tenant.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Borrador no encontrado.' });

    const draft = rows[0];
    const transporter = getTransporter(tenant);
    if (!transporter) return res.status(500).json({ error: 'SMTP no configurado.' });

    const toEmailMatch = draft.destinatario?.match(/\(([^)]+)\)/);
    const toEmail = toEmailMatch ? toEmailMatch[1] : draft.destinatario;

    const mailAttachments = attachments.map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType
    }));

    await transporter.sendMail({
      from: `"Sara Valenzuela · ${tenant.name}" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: draft.subject,
      html: draft.body.replace(/\n/g, '<br>'),
      attachments: mailAttachments
    });

    await pool.query('UPDATE drafts SET status = $1, sent_by = $2, sent_at = NOW() WHERE id = $3', ['sent', user, id]);

    // Registrar en historial del prospecto si existe
    const { rows: prospectoRows } = await pool.query(
      `SELECT id, historial FROM prospectos WHERE tenant_id = $1 AND correo = $2`,
      [tenant.id, toEmail]
    );
    if (prospectoRows.length > 0) {
      const prospecto = prospectoRows[0];
      let historial = [];
      try { historial = JSON.parse(prospecto.historial || '[]'); } catch (_) {}
      historial.push({
        id: `resp-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: 'respuesta_enviada',
        asunto: draft.subject,
        resumen: draft.body.slice(0, 200),
        cuerpo: draft.body,
        aprobado_por: user,
        editable: true
      });
      await pool.query(
        `UPDATE prospectos SET historial = $1, fecha_ultima_actividad = NOW() WHERE id = $2`,
        [JSON.stringify(historial), prospecto.id]
      );
    }

    await pool.query(
      `INSERT INTO bitacora (id, tenant_id, timestamp, cliente, correo, proyecto, canal, correo_cliente, borrador_creado, mensaje)
       VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7,$8,$9)`,
      [`log-approval-${Date.now()}`, tenant.id, draft.destinatario, toEmail,
       draft.project, 'CRM Admin', `Enviado (Aprobado por ${user})`, id,
       `Borrador aprobado: ${draft.subject}`]
    );

    res.json({ success: true, draftId: id });
  } catch (error) {
    console.error('❌ Error en /api/send-draft:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CATÁLOGO GLP — fallback para SARA
// ==========================================
const GLP_CATALOG = [
  { name: 'Armonía', zone: 'Bella Vista — Ciudad de Panamá', tipo: 'Residencia', entrega: 'F1 Inmediata · F2 Q2 2026 · F3 Q2 2028', minPrice: 181000, maxPrice: 235000, areaMin: 45, areaMax: 71, bedrooms: '1, 2 y 3 rec.', capRateMin: 6.0, capRateMax: 7.5, amenities: ['Piscina', 'Gimnasio', 'Lobby diseño', 'Seguridad 24/7', 'Parqueo'] },
  { name: 'Ventu', zone: 'Bella Vista — Ciudad de Panamá', tipo: 'Hotelero (Airbnb)', entrega: 'Q2 2028', minPrice: 136000, maxPrice: 259000, areaMin: 40, areaMax: 63, bedrooms: '1 y 2 rec.', capRateMin: 8.0, capRateMax: 12.0, amenities: ['Administración hotelera', 'Pool deck', 'Coworking', 'Check-in automático'] },
  { name: 'Ocena', zone: 'Santa María — Ciudad de Panamá', tipo: 'Residencia', entrega: 'Q4 2027', minPrice: 446000, maxPrice: 1200000, areaMin: 100, areaMax: 270, bedrooms: '2 y 3 rec.', capRateMin: 4.7, capRateMax: 6.0, amenities: ['Golf 18 hoyos Jack Nicklaus', 'Club House', 'Piscinas resort', 'Wellness center'] },
  { name: 'Ipanema', zone: 'Costa Sur — Ciudad de Panamá', tipo: 'Residencia', entrega: 'F1 Q1 2028 · F2 Q4 2028', minPrice: 283000, maxPrice: 519000, areaMin: 72, areaMax: 163, bedrooms: '1, 2 y 3 rec.', capRateMin: 6.0, capRateMax: 7.5, amenities: ['Piscina vista al mar', 'Gimnasio', 'Co-working', 'BBQ'] },
  { name: 'Bosco', zone: 'Santa María — Ciudad de Panamá', tipo: 'Residencia', entrega: '2030', minPrice: 474000, maxPrice: 1100000, areaMin: 100, areaMax: 296, bedrooms: '2, 3 y 4 rec.', capRateMin: 5.5, capRateMax: 7.2, amenities: ['Jardines botánicos', 'Piscina natural', 'Senderos de meditación'] },
  { name: 'Panama Viejo Residence', zone: 'Panamá Viejo — Ciudad de Panamá', tipo: 'Residencia', entrega: 'ENTREGA INMEDIATA', minPrice: 160000, maxPrice: 182000, areaMin: 58, areaMax: 58, bedrooms: '2 rec.', capRateMin: 6.5, capRateMax: 8.0, amenities: ['Piscina', 'Gimnasio', 'Coworking', 'Seguridad 24/7'] },
  { name: 'The Palms', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia premium', entrega: 'ENTREGA INMEDIATA', minPrice: 1200000, maxPrice: 1400000, areaMin: 169, areaMax: 239, bedrooms: '2 rec.', capRateMin: 5.5, capRateMax: 7.0, amenities: ['Marina privada 180+ muelles', 'Yacht club', 'Piscinas infinity', 'Spa'] },
  { name: 'Ocean Reef Park', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia ultra-premium', entrega: 'Q2 2028', minPrice: 1700000, maxPrice: 2100000, areaMin: 491, areaMax: 569, bedrooms: '3 y 4 rec.', capRateMin: 5.0, capRateMax: 6.5, amenities: ['Marina privada', 'Helipuerto', 'Yacht club', 'Club privado'] },
  { name: 'O Club Residences', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia premium', entrega: 'Q4 2027', minPrice: 1000000, maxPrice: 1400000, areaMin: 183, areaMax: 236, bedrooms: '2 rec.', capRateMin: 5.0, capRateMax: 6.5, amenities: ['Club privado O Club', 'Marina', 'Spa', 'Restaurantes'] },
  { name: 'Aires del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'INMEDIATA · Q4 2026', minPrice: 143000, maxPrice: 207000, areaMin: 42, areaMax: 71, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 8.0, amenities: ['Vista al océano Pacífico', 'Piscinas', 'Jardines', 'Seguridad 24/7'] },
  { name: 'The Tides', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 278000, maxPrice: 308000, areaMin: 99, areaMax: 99, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['1.2 km playa privada', 'Surf club', '3 piscinas', 'Restaurante y beach bar'] },
  { name: 'Brisas del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 276000, maxPrice: 332000, areaMin: 93, areaMax: 108, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Frente al mar', 'Piscina', 'BBQ', 'Seguridad 24/7'] },
  { name: 'Olas del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 267000, maxPrice: 398000, areaMin: 69, areaMax: 97, bedrooms: '2 y 3 rec.', capRateMin: 6.0, capRateMax: 8.0, amenities: ['Piscina con vista al mar', 'BBQ', 'Seguridad 24/7'] },
  { name: 'Surfside', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa / aparthotel', entrega: 'ENTREGA INMEDIATA', minPrice: 314000, maxPrice: 413000, areaMin: 81, areaMax: 107, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Playa privada', 'Piscinas y jacuzzi', 'Restaurante y bar', 'Surf lounge'] },
  { name: 'Beachwalk', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa wellness', entrega: 'Q1 2027', minPrice: 297000, maxPrice: 386000, areaMin: 85, areaMax: 97, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['Frente al océano', 'Wellness spa', 'Yoga deck', 'Gimnasio exterior'] },
  { name: 'Seashore', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'Q4 2027', minPrice: 290000, maxPrice: 490000, areaMin: 84, areaMax: 150, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Vista al Pacífico', 'Piscina', 'Área social y BBQ', 'Gimnasio'] },
  { name: 'Seashore Reserve', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'Q4 2028', minPrice: 290000, maxPrice: 490000, areaMin: 84, areaMax: 150, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['Vista al Pacífico', 'Piscina', 'Área social y BBQ', 'Gimnasio'] },
];

// ==========================================
// CHATBOT SARA
// ==========================================
// Mismos 4 arquetipos y mismas recomendaciones de tono que usa Sofía para perfilar
// prospectos del CRM (ver handleSofia en el frontend) — se reutilizan aquí para que Sara
// hable distinto según el arquetipo detectado EN VIVO durante el chat, en vez de un mismo
// guión genérico para todos. Antes esta clasificación solo corría sobre datos ya guardados
// del prospecto (ocupación, notas); el chatbot nunca la alimentaba.
// Los modelos de lenguaje calculan mal el día de la semana a partir de una fecha (ej.
// confundieron "el viernes" con el 25 de agosto cuando el viernes real era el 28) — dejarle
// esa aritmética a la IA es frágil. Esta tabla se calcula en JS (confiable) con los
// próximos 14 días y su nombre real, para que el modelo solo la CONSULTE en vez de calcular.
function buildProximosDiasTexto() {
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const rows = [];
  const hoy = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    const fecha = d.toISOString().split('T')[0];
    rows.push(`${DIAS[d.getDay()]} ${fecha}${i === 0 ? ' (HOY)' : i === 1 ? ' (MAÑANA)' : ''}`);
  }
  return rows.join('\n');
}

const SARA_TONO_POR_ARQUETIPO = {
  estatus: 'Prioriza exclusividad y pertenencia — no ancles la conversación en precio primero. Menciona lo selecto del proyecto, quién más vive ahí, disponibilidad limitada.',
  legado: 'Habla de preservación patrimonial y transmisión a la familia — valorización histórica, estabilidad, protección del capital a largo plazo.',
  racional: 'Sé directa y con datos — precio/m², retorno estimado, comparativos concretos. Evita adjetivos vacíos, este perfil desconfía del discurso emocional.',
  aspiracional: 'Conecta con el estilo de vida y el sueño detrás de la inversión — cómo se vive ahí, la experiencia, no solo el número.',
};
// Mismo mapeo pero orientado a Valeria (copy/contenido) — se guarda junto al arquetipo en
// sofia_profiles para que el perfil detectado en el chat sea igual de útil en el CRM que
// uno generado manualmente desde "Perfilar Prospectos".
const VALERIA_TONO_POR_ARQUETIPO = {
  estatus: 'Prueba social de élite, escasez real, identidad aspiracional de pertenencia — nunca lenguaje promocional genérico.',
  legado: 'Narrativa intergeneracional: "el activo que tu familia heredará". ROI a largo plazo y seguridad jurídica.',
  racional: 'Datos duros: tablas de valorización, comparativos, retorno cuantificado. Tono directo, sin adjetivos emocionales.',
  aspiracional: 'Storytelling visual de estilo de vida — cómo se vive ahí, no solo cuánto cuesta.',
};

// Clasifica el arquetipo psicográfico a partir del texto real de la conversación —
// llamada liviana y barata (gpt-4o-mini, pocos tokens), pensada para correr en cada turno
// una vez hay suficiente contexto (>=3 mensajes del visitante).
async function clasificarArquetipoChat(apiKey, conversationText) {
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Clasifica el arquetipo psicográfico dominante de este visitante de una inmobiliaria, basado SOLO en lo que escribió (ignora las respuestas del bot):\n\n${conversationText}\n\nArquetipos: "estatus" (busca exclusividad/pertenencia), "legado" (preservación patrimonial familiar), "racional" (decide por datos/ROI), "aspiracional" (motivado por estilo de vida).`,
      }],
      temperature: 0.3, max_tokens: 150,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'arquetipo_chat',
          strict: true,
          schema: {
            type: 'object', additionalProperties: false,
            properties: {
              arquetipo: { type: 'string', enum: ['estatus', 'legado', 'racional', 'aspiracional'] },
              confianza: { type: 'integer' },
              senales: { type: 'array', items: { type: 'string' } },
            },
            required: ['arquetipo', 'confianza', 'senales'],
          },
        },
      },
    });
    return JSON.parse(response.choices[0].message.content.trim());
  } catch { return null; }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, sessionId } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Mensajes requeridos.' });

    const tenant = await resolveTenant(req);
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado.' });

    // Cargar proyectos desde la BD; si está vacía usar catálogo hardcodeado
    const { rows: projectRows } = await pool.query('SELECT data FROM projects WHERE tenant_id = $1', [tenant.id]);
    const projects = projectRows.length > 0 ? projectRows.map(r => r.data) : GLP_CATALOG;
    const catalogSummary = projects.map(p =>
      `- ${p.name} | ${p.zone} | ${p.tipo || p.type || 'Residencia'} | Precio: $${(p.minPrice || 0).toLocaleString()}–$${(p.maxPrice || 0).toLocaleString()} USD | Áreas: ${p.areaMin || '?'}–${p.areaMax || '?'} m² | ${p.bedrooms || ''} | Entrega: ${p.entrega || 'consultar'} | Amenidades: ${(p.amenities || []).join(', ')}`
    ).join('\n');

    // Antes el prompt solo listaba preguntas de calificación de PRODUCTO (presupuesto,
    // habitaciones, financiamiento...) sin decirle a Sara que su objetivo de negocio real
    // es conseguir un dato de contacto — el chatbot podía sostener una conversación entera
    // sobre el catálogo sin jamás pedir correo o WhatsApp, y sin ese dato el mensaje NUNCA
    // se convierte en un prospecto real en el CRM (ver hasContactInfo en el frontend). El
    // "gancho" ahora es una instrucción explícita, con un punto concreto de la conversación
    // en el que debe pedirse, no una posibilidad que dependía de que la IA lo intuyera.
    const numUserMsgs = messages.filter(m => m.sender === 'user').length;
    const yaTieneContacto = messages.some(m =>
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(m.text) || /[\+]?[\d][\d\s\-\(\)]{9,}/.test(m.text)
    );
    // Antes se forzaba la pregunta de contacto en CADA turno desde el mensaje 2 en
    // adelante, con un solo ejemplo de frase — el modelo terminaba repitiendo casi la
    // misma pregunta una y otra vez, sonando a formulario en vez de conversación. Ahora
    // solo se insiste en un par de puntos concretos de la conversación (con espacio real
    // entre cada intento) y se le exige variar la redacción respecto a lo que ya preguntó.
    const askCheckpoints = [2, 5, 9];
    const yaPidioContactoAntes = messages.some(m => m.sender !== 'user' && /correo|whatsapp|whats app/i.test(m.text));
    const forzarPreguntaContacto = !yaTieneContacto && askCheckpoints.includes(numUserMsgs);

    // FAQs oficiales — antes esta ruta (el chatbot EN VIVO, el canal de mayor volumen) era
    // la única de las 4 superficies de Sara que NO las veía, así que nunca contribuía al
    // conteo de "Más Consultadas" ni garantizaba respuestas consistentes con la oficial.
    const faqsCtxChat = await getFaqsForPrompt(tenant.id);
    const faqContextText = buildFaqContextText(faqsCtxChat);
    // Solo el ÚLTIMO mensaje del visitante — si se contara el historial acumulado en cada
    // turno, una misma pregunta se recontaría una vez por cada turno posterior de la
    // conversación (10 turnos sobre el mismo tema = 10 "consultas" infladas para 1 sola).
    const ultimoMensajeVisitante = [...messages].reverse().find(m => m.sender === 'user');
    if (ultimoMensajeVisitante) {
      trackFaqUsage(faqsCtxChat, ultimoMensajeVisitante.text); // fire-and-forget, no bloquea la respuesta
    }

    // Perfilamiento psicográfico EN VIVO — antes Sofía nunca veía la conversación del
    // chatbot, así que Sara respondía con el mismo tono/gancho para cualquier visitante.
    // A partir de 3 mensajes del visitante hay suficiente texto real para clasificar.
    let arquetipoDetectado = null;
    if (numUserMsgs >= 3) {
      const conversationText = messages.filter(m => m.sender === 'user').map(m => m.text).join('\n');
      arquetipoDetectado = await clasificarArquetipoChat(apiKey, conversationText);
    }
    const perfilTxt = arquetipoDetectado
      ? `\nPERFIL PSICOGRÁFICO DETECTADO EN VIVO (Sofía, ${arquetipoDetectado.confianza}% confianza): ${arquetipoDetectado.arquetipo.toUpperCase()} — ${arquetipoDetectado.senales.join('; ')}\nAjusta tu tono y tus argumentos a este perfil específico, no uses un tono genérico: ${SARA_TONO_POR_ARQUETIPO[arquetipoDetectado.arquetipo] || ''}`
      : '';

    // Persistir el perfil en sofia_profiles (fire-and-forget) cuando ya existe un prospecto
    // real vinculado a esta sesión de chat (creado por /api/contact vía chat_session_id) —
    // así el perfil detectado en el chat aparece en el panel de Sofía del CRM, igual que
    // uno generado manualmente, en vez de quedarse solo dentro de esta conversación.
    if (arquetipoDetectado && sessionId) {
      pool.query('SELECT id FROM prospectos WHERE chat_session_id = $1 AND tenant_id = $2 LIMIT 1', [sessionId, tenant.id])
        .then(({ rows }) => {
          if (rows[0]) {
            const prospectoId = rows[0].id;
            pool.query(`
              INSERT INTO sofia_profiles (prospecto_id, tenant_id, arquetipo, confianza, senales, recomendacion_sara, recomendacion_valeria, updated_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
              ON CONFLICT (prospecto_id) DO UPDATE SET
                arquetipo=$3, confianza=$4, senales=$5, recomendacion_sara=$6, recomendacion_valeria=$7, updated_at=NOW()
            `, [prospectoId, tenant.id, arquetipoDetectado.arquetipo, arquetipoDetectado.confianza,
                JSON.stringify(arquetipoDetectado.senales), SARA_TONO_POR_ARQUETIPO[arquetipoDetectado.arquetipo] || '',
                VALERIA_TONO_POR_ARQUETIPO[arquetipoDetectado.arquetipo] || '']).catch(() => {});
          }
        }).catch(() => {});
    }

    const systemPrompt = `Eres Sara, asesora de inversiones inmobiliarias de ${tenant.name}. Llevas años en este mundo y te apasiona conectar a las personas con la inversión correcta para su momento de vida.
${perfilTxt}
${forzarPreguntaContacto ? `
════════════════════════════════════════════════════
INSTRUCCIÓN PARA ESTA RESPUESTA — LÉELA PRIMERO:
El visitante aún no ha dejado correo ni WhatsApp. En tu respuesta de AHORA, después de reaccionar a lo que acaba de decir, pídeselo — enmarcado como el paso natural que sigue (ej. "para enviarte la ficha con precios reales", "para que te llegue la disponibilidad actualizada", "para agendarte con un asesor esta semana"). Una sola vez, en una frase corta, sin sonar a formulario.
${yaPidioContactoAntes ? 'Ya se lo pediste antes en esta misma conversación con otras palabras — usa una redacción DISTINTA esta vez, no repitas la frase anterior.' : ''}
════════════════════════════════════════════════════
` : ''}
Tu estilo: conversacional, cálido, directo. Usas frases cortas. A veces compartes una opinión personal o haces una observación sobre lo que el cliente menciona. No suenas a call center ni a guión — y sobre todo, nunca repites la misma pregunta o la misma frase que ya usaste antes en esta conversación.

OBJETIVO DE NEGOCIO: sin el correo o WhatsApp del visitante, la conversación no se convierte en un lead real — pero conseguirlo es una CONSECUENCIA de generar interés genuino, no algo que se persigue en cada mensaje. Si ya lo pediste una vez y no respondió, no insistas de nuevo enseguida: sigue aportando valor real (una idea concreta, un dato, una pregunta sobre lo que busca) y déjalo para más adelante en la charla — machacarlo espanta más de lo que convierte.

A lo largo de la conversación, de forma natural (nunca en forma de cuestionario), trata de entender:
- Qué lo motiva: ¿es para vivir, para rentar, para tener algo a largo plazo?
- En qué rango de tiempo piensa tomar la decisión
- Si ya tiene un presupuesto claro en mente o está explorando
- Cuántas habitaciones necesita o prefiere
- Si va a financiar o tiene capital disponible
- Si ya conoce Panamá o es su primera vez mirando este mercado

No preguntes todo junto. Ve hilando la conversación. Si te cuenta algo, reacciona a eso antes de preguntar lo siguiente.
${yaTieneContacto ? '\nEl visitante YA compartió un dato de contacto en este chat — agradécelo si aún no lo hiciste y sigue asesorando con normalidad, sin volver a pedirlo.' : (!forzarPreguntaContacto ? '\nNo es el momento de pedir el correo/WhatsApp en esta respuesta — concéntrate en la conversación y en generar interés real. Ya habrá otro momento más adelante para pedirlo.' : '')}

CALENDARIO REAL — nunca calcules tú qué día cae en qué fecha, ya te lo doy resuelto. Usa SOLO esta tabla para convertir cualquier día que mencione el visitante ("el viernes", "mañana", "el jueves que viene") a fecha exacta:
${buildProximosDiasTexto()}

USO DE HERRAMIENTAS — esto no es opcional ni una posibilidad, es una instrucción directa:
- En cuanto el visitante mencione un día Y una hora concretas para hablar, primero busca ese día EXACTO en la tabla de arriba (nunca lo calcules de memoria) y confirma la modalidad antes de agendar: pregúntale si prefiere LLAMADA o VIDEOLLAMADA (si no lo dijo ya). Según lo que responda:
  · Si es LLAMADA y no tienes su teléfono/WhatsApp en la conversación, pídeselo primero — sin número no hay a quién llamar.
  · Si es VIDEOLLAMADA y no tienes su correo en la conversación, pídeselo primero — sin correo no hay dónde mandar el link.
  Solo cuando tengas fecha exacta (de la tabla) + hora + modalidad + el contacto que esa modalidad requiere, llama a la función agendar_cita en ese turno — no antes, y no le preguntes "¿confirmas?" en ese punto: ya tienes todo, agenda y confirma en tu respuesta.
- En cuanto el visitante pida explícitamente hablar con una persona, un asesor o un humano, DEBES llamar a la función derivar_a_asesor en ESE MISMO turno, no le respondas primero preguntando por qué.
- Nunca simules en texto que agendaste algo o que derivaste a alguien sin haber llamado la función correspondiente.

FORMATO DE RESPUESTA — siempre:
- Separa por bloques temáticos con línea en blanco entre cada uno
- Usa emojis como ancla visual: 🏠 📍 💰 🗓️ ✨ — pero sin abusar
- Máximo 2–3 líneas por bloque
- Nunca uses "Cap Rate", "tasa de capitalización" ni jerga técnica — di "retorno estimado" o "lo que puedes esperar recibir mensualmente"
- Termina con una pregunta o comentario que invite a seguir

CATÁLOGO GLP:
${catalogSummary}
${faqContextText}`;

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    // Antes agendar cita o pedir un asesor humano dependía de que el visitante llenara el
    // formulario aparte (con selector de fecha/hora) — el chatbot no podía disparar ninguna
    // de las dos acciones aunque el cliente lo pidiera EN la conversación. Con function
    // calling, el modelo decide cuándo invocar cada acción real (no solo simularla en
    // texto) y el backend la ejecuta contra el mismo /api/citas y el mismo correo de alerta
    // que ya usa el formulario normal.
    const tools = [
      {
        type: 'function',
        function: {
          name: 'agendar_cita',
          description: 'Agenda una llamada o videollamada con un asesor cuando el visitante confirma día, hora y modalidad concretas para hablar con GLP. Requiere haber confirmado antes la modalidad y tener el dato de contacto que esa modalidad necesita (teléfono para llamada, correo para videollamada).',
          parameters: {
            type: 'object',
            properties: {
              fecha: { type: 'string', description: 'Fecha exacta en formato YYYY-MM-DD, tomada de la tabla de CALENDARIO REAL — nunca calculada de memoria' },
              hora: { type: 'string', description: 'Hora en formato HH:MM (24h)' },
              modalidad: { type: 'string', enum: ['llamada', 'videollamada'], description: 'Cómo quiere la cita el visitante' },
              nombre: { type: 'string', description: 'Nombre del visitante si lo mencionó, o "Visitante Web" si no' },
              motivo: { type: 'string', description: 'Resumen breve de qué quiere hablar (proyecto de interés, tipo de consulta)' },
            },
            required: ['fecha', 'hora', 'modalidad'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'derivar_a_asesor',
          description: 'Deriva la conversación a un asesor humano cuando el visitante lo pide explícitamente, o cuando muestra frustración o hace una pregunta que tú no puedes resolver con confianza. Antes de llamar esta función, si aún no tienes su teléfono/WhatsApp en la conversación, pídeselo primero ("para que te llamen ya mismo") en vez de derivar sin ese dato — un asesor llamándolo convierte mejor que dejar que él tenga que escribir por su cuenta. Si ya lo tienes, o si insiste en derivar sin querer dar el número, llama la función de una vez.',
          parameters: {
            type: 'object',
            properties: {
              motivo: { type: 'string', description: 'Por qué se deriva: qué pidió o qué no se pudo resolver' },
            },
            required: ['motivo'],
          },
        },
      },
    ];

    const baseMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
    ];

    const first = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: baseMessages,
      tools, tool_choice: 'auto',
      temperature: 0.7, max_tokens: 350,
    });

    const firstMsg = first.choices[0].message;
    const toolCalls = firstMsg.tool_calls || [];

    if (toolCalls.length === 0) {
      return res.json({ reply: firstMsg.content.trim() });
    }

    // Correo/teléfono del visitante ya capturados en la conversación (mismo patrón que usa
    // el frontend para decidir si registrar un lead) — las citas admiten prospecto_email
    // nulo, pero si ya lo dejó, la cita queda vinculada a su prospecto real en el CRM.
    const conversationText = messages.map(m => m.text).join(' ');
    const emailMatch = conversationText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = conversationText.match(/[\+]?[\d][\d\s\-\(\)]{9,}/);
    const visitorEmail = emailMatch ? emailMatch[0].trim() : null;
    const visitorPhone = phoneMatch ? phoneMatch[0].replace(/\s+/g, '').trim() : null;
    const whatsappNumber = tenant?.contact?.whatsapp || '573124824353';

    const toolResults = [];
    for (const call of toolCalls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
      let resultText = 'No se pudo completar la acción.';

      if (call.function.name === 'agendar_cita') {
        // Validación en el SERVIDOR, no solo en el prompt — antes una cita podía quedar
        // "en el aire" sin ningún dato para contactar al visitante si el modelo ignoraba la
        // instrucción de pedir teléfono/correo antes de agendar. Esto lo bloquea aunque el
        // modelo se salte el paso.
        const modalidad = args.modalidad === 'videollamada' ? 'videollamada' : args.modalidad === 'llamada' ? 'llamada' : null;
        const faltaContacto = !modalidad
          ? 'no especificó si prefiere llamada o videollamada'
          : modalidad === 'llamada' && !visitorPhone
            ? 'eligió llamada pero no ha dejado su teléfono/WhatsApp'
            : modalidad === 'videollamada' && !visitorEmail
              ? 'eligió videollamada pero no ha dejado su correo'
              : null;
        if (faltaContacto) {
          resultText = `No se agendó todavía: ${faltaContacto}. Pídele ese dato específico en tu respuesta de ahora — sin eso la cita queda sin forma de contactarlo. No confirmes la cita como agendada.`;
        } else {
          try {
            const canal = modalidad === 'llamada' ? 'Llamada' : 'Videollamada';
            const notasConContacto = `${args.motivo || ''}${modalidad === 'llamada' ? ` — Llamar al ${visitorPhone}` : ` — Enviar link de videollamada a ${visitorEmail}`}`.trim();
            const { rows } = await pool.query(`
              INSERT INTO citas (tenant_id, prospecto_email, prospecto_nombre, proyecto, fecha, hora, canal, notas)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
            `, [tenant.id, visitorEmail, args.nombre || 'Visitante Web', 'Chatbot SARA', args.fecha, args.hora, canal, notasConContacto]);
            resultText = `Cita (${canal}) agendada correctamente para ${args.fecha} a las ${args.hora}. ID: ${rows[0].id}. ${modalidad === 'llamada' ? `Se llamará al ${visitorPhone}.` : `Se enviará el link a ${visitorEmail}.`}`;
          } catch (e) {
            resultText = `Error agendando la cita: ${e.message}. Informa al visitante que un asesor confirmará el horario manualmente.`;
          }
        }
      } else if (call.function.name === 'derivar_a_asesor') {
        const transporter = getTransporter(tenant);
        if (transporter) {
          transporter.sendMail({
            from: `"SARA Chatbot — Derivación Urgente" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
            to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
            subject: `🚨 ${visitorPhone ? 'LLAMAR YA' : 'Visitante pide asesor humano'} — ${args.motivo || 'sin detalle'}`,
            html: `<div style="font-family:sans-serif;line-height:1.6;">
              <h2>Derivación urgente desde el Chatbot SARA</h2>
              <p><strong>Motivo:</strong> ${args.motivo || 'No especificado'}</p>
              <p><strong>Teléfono/WhatsApp del visitante:</strong> ${visitorPhone || 'No capturado — solo tiene la opción de escribir él mismo al WhatsApp del equipo'}</p>
              <p><strong>Correo del visitante:</strong> ${visitorEmail || 'No capturado aún'}</p>
              <p><strong>Conversación:</strong></p>
              <pre style="background:#f8fafc;padding:12px;border-radius:6px;white-space:pre-wrap;">${messages.map(m => `${m.sender === 'user' ? 'Cliente' : 'SARA'}: ${m.text}`).join('\n')}</pre>
            </div>`,
          }).catch(() => {});
        }
        // Con teléfono: la carga de contactar la asume el asesor (callback), no el
        // visitante — mejor conversión que pedirle que dé el salto a WhatsApp por su
        // cuenta. Sin teléfono: el link de WhatsApp queda como respaldo inmediato.
        resultText = visitorPhone
          ? `Derivación notificada al equipo con el número ${visitorPhone} para que un asesor llame directamente. Informa al visitante que un asesor lo va a contactar en los próximos minutos a ese número — y que si prefiere escribir antes, aquí está el WhatsApp del equipo: https://wa.me/${whatsappNumber}`
          : `Derivación notificada al equipo, pero aún no tienes el teléfono/WhatsApp del visitante. Dale este WhatsApp para continuar de inmediato: https://wa.me/${whatsappNumber} — y pídele su número para que un asesor lo llame directamente en vez de depender de que él escriba primero.`;
      }

      toolResults.push({ role: 'tool', tool_call_id: call.id, content: resultText });
    }

    const second = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [...baseMessages, firstMsg, ...toolResults],
      temperature: 0.7, max_tokens: 350,
    });

    res.json({ reply: second.choices[0].message.content.trim() });
  } catch (error) {
    console.error('❌ Error en /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AI PROXY – AGENTES CRM (Camilo, Valeria, Isabella)
// ==========================================
app.post('/api/ai', async (req, res) => {
  // agentName/action son opcionales y los manda el frontend (triggerOpenAI) para que la
  // bitácora de agent_runs sepa QUIÉN de los agentes (Valeria/Isabella/Sofía/...) generó
  // esta llamada — antes esta ruta genérica no dejaba ningún rastro atribuible.
  const { messages, max_tokens, agentName, action } = req.body;
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const run = await startAgentRun(tenant.id, user, agentName || 'DESCONOCIDO', action || 'consulta_ai');
  if (run?.locked) {
    return res.status(409).json({ error: 'ya_en_curso', lockedBy: run.lockedBy, lockedSince: run.lockedSince });
  }
  try {
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages requeridos.' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado en el servidor.' });
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: max_tokens || 3000
    });
    await finishAgentRun(run?.id, { status: 'completado', tokensEstimados: response.usage?.total_tokens ?? null, promptTokens: response.usage?.prompt_tokens ?? null, completionTokens: response.usage?.completion_tokens ?? null });
    res.json({ choices: [{ message: { content: response.choices[0].message.content } }] });
  } catch (err) {
    console.error('❌ Error en /api/ai:', err.message);
    await finishAgentRun(run?.id, { status: 'error', errorDetalle: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CAMILO — DEEP RESEARCH (web search + síntesis)
// ==========================================

// Ejecuta N búsquedas web reales en paralelo y devuelve el contexto concatenado con
// fuentes citables. Reutilizado por /api/camilo/research, /api/camilo/radar-competencia
// y /api/camilo/reporte-mercado — antes cada uno de estos generaba contenido "de memoria"
// sin verificación real de internet (resultados repetidos e inventados); ahora los tres
// se basan en la misma investigación web real.
// IMPORTANTE: el modelo 'gpt-4o-search-preview' con tool 'web_search_preview' devuelve
// 404 "Model not found" en esta cuenta — se descubrió que estaba cayendo siempre al
// fallback silencioso (texto "no disponible") y gpt-4o-mini inventaba citas de aspecto
// creíble sobre ese placeholder, sin que se notara. 'gpt-4o-mini' + tool 'web_search'
// (sin "_preview") sí funciona y fue verificado con una consulta real (inflación INEC).
async function webSearchGLP(apiKey, searches, onProgress, model = 'gpt-4o-mini') {
  let completed = 0;
  // Los modelos de razonamiento (gpt-5, o3, o4-mini) gastan una parte del presupuesto de
  // salida en tokens de razonamiento invisibles — sin "reasoning.effort" explícito y sin un
  // tope generoso, la Responses API a veces devuelve texto vacío (se lo comió el razonamiento).
  const isReasoningModel = /^(gpt-5|o3|o4)/.test(model);
  // Antes un solo query fallando (429 de rate limit, timeout puntual) tumbaba el Promise.all
  // COMPLETO — las otras 3 búsquedas que sí habían respondido bien se descartaban también, y
  // el radar entero caía al aviso genérico de "usando datos de entrenamiento, no verificados",
  // lo que producía exactamente el síntoma reportado: contenido repetitivo y sin detalle real
  // (incluido Panamá) cada vez que UNA sola búsqueda tenía un hipo de red. Ahora cada búsqueda
  // se aísla: si falla, esa búsqueda puntual queda marcada como sin datos, pero las demás que sí
  // funcionaron se conservan y siguen alimentando la síntesis con información real.
  const results = await Promise.all(searches.map(async (query) => {
    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          ...(isReasoningModel ? { reasoning: { effort: 'low' } } : {}),
          tools: [{ type: 'web_search' }],
          input: query
        })
      });
      if (!r.ok) throw new Error(`search_error_${r.status}`);
      const data = await r.json();
      const text = data.output
        ?.find(o => o.type === 'message')
        ?.content?.find(c => c.type === 'output_text')
        ?.text || '';
      const annotations = data.output
        ?.find(o => o.type === 'message')
        ?.content?.find(c => c.type === 'output_text')
        ?.annotations || [];
      const sources = [...new Set(annotations.filter(a => a.url).map(a => a.url))].slice(0, 3);
      completed++;
      // Las búsquedas corren en paralelo (Promise.all), así que el progreso reportado es
      // "cuántas ya resolvieron", no un contador secuencial 1/2/3 — pero es real, no decorativo.
      if (onProgress) onProgress(completed, searches.length, query);
      return { query, text, sources };
    } catch (queryErr) {
      console.warn(`⚠️ Búsqueda web falló para "${query}":`, queryErr.message);
      completed++;
      if (onProgress) onProgress(completed, searches.length, query);
      return { query, text: '(Esta búsqueda específica falló — no hay datos verificados en tiempo real para esta consulta, no inventes cifras para ella)', sources: [] };
    }
  }));
  return results.map(r =>
    `### Búsqueda: "${r.query}"\n${r.text}${r.sources.length ? '\nFuentes: ' + r.sources.join(' · ') : ''}`
  ).join('\n\n---\n\n');
}

// Deep Research real (o3-deep-research / o4-mini-deep-research) NO está habilitado en esta
// cuenta de OpenAI (probado: 404 "Model not found" en ambos). Esto es lo más cercano que SÍ
// funciona con los modelos disponibles: una investigación en 2 rondas con gpt-5 (el modelo de
// razonamiento más fuerte de la cuenta, no gpt-4o-mini) — ronda 1 busca lo obvio, gpt-5 mismo
// identifica qué falta (proyectos sin precio, países sin fuente), y la ronda 2 busca
// específicamente eso. No es tan profundo como Deep Research nativo (esa es una investigación
// autónoma de decenas de pasos), pero es sensiblemente más confiable y específico que un solo
// disparo de gpt-4o-mini, y corre en ~30-60s en vez de minutos.
async function deepWebSearchGLP(apiKey, initialQueries, destinosDesc, onProgress) {
  if (onProgress) onProgress({ step: 0, total: 2, label: 'Ronda 1: búsqueda inicial…', phase: 'searching' });
  const round1 = await webSearchGLP(apiKey, initialQueries, (done, total, query) => {
    if (onProgress) onProgress({ step: done, total: total * 2, label: `Ronda 1 — "${query.slice(0, 60)}…"`, phase: 'searching' });
  }, 'gpt-5');

  let round2 = '';
  try {
    if (onProgress) onProgress({ step: initialQueries.length, total: initialQueries.length * 2, label: 'Identificando huecos de información…', phase: 'gap_analysis' });
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const gapResponse = await openai.chat.completions.create({
      model: 'gpt-5',
      reasoning_effort: 'low',
      max_completion_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Eres un analista de inteligencia de mercado inmobiliario. Revisa esta investigación web ya realizada sobre: ${destinosDesc}.

${round1}

¿Qué información específica falta o quedó vaga (proyectos sin precio, zonas sin datos, cifras sin fuente)? Genera hasta 3 búsquedas web de SEGUIMIENTO, muy específicas (nombres de proyecto, zona exacta, "precio m2 2026", etc.), que llenen esos huecos concretos — no repitas las búsquedas ya hechas. Si la investigación ya está completa y no hace falta profundizar más, devuelve una lista vacía.`
      }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'followup_queries',
          strict: true,
          schema: { type: 'object', additionalProperties: false, properties: { queries: { type: 'array', items: { type: 'string' } } }, required: ['queries'] },
        },
      },
    });
    const followupQueries = (JSON.parse(gapResponse.choices[0].message.content.trim()).queries || []).slice(0, 3);
    if (followupQueries.length > 0) {
      if (onProgress) onProgress({ step: initialQueries.length, total: initialQueries.length + followupQueries.length, label: 'Ronda 2: profundizando huecos específicos…', phase: 'searching' });
      round2 = await webSearchGLP(apiKey, followupQueries, (done, total, query) => {
        if (onProgress) onProgress({ step: initialQueries.length + done, total: initialQueries.length + total, label: `Ronda 2 — "${query.slice(0, 60)}…"`, phase: 'searching' });
      }, 'gpt-5');
    }
  } catch (gapErr) {
    console.warn('⚠️ Ronda 2 de deep search falló, se conserva solo la ronda 1:', gapErr.message);
  }

  if (onProgress) onProgress({ step: 1, total: 1, label: 'Investigación completada, sintetizando…', phase: 'synthesis' });
  return round2
    ? `${round1}\n\n=== BÚSQUEDAS DE PROFUNDIZACIÓN (ronda 2, huecos identificados por IA) ===\n\n${round2}`
    : round1;
}

// ── Progreso real de Camilo (polling) ──────────────────────────────────────
// Antes el frontend mostraba "Deep search [1/3]..." con setTimeout fijos de 600ms sin
// relación con el trabajo real del backend (ver AUDITORIA_AGENTES_IA.md, §3.1). Ahora el
// backend publica el avance real por jobId y el frontend hace polling mientras espera.
const camiloResearchProgress = new Map(); // jobId -> { step, total, label, phase }
function setCamiloProgress(jobId, data) {
  if (!jobId) return;
  camiloResearchProgress.set(jobId, { ...data, updatedAt: Date.now() });
}
app.get('/api/camilo/research/progress/:jobId', (req, res) => {
  const entry = camiloResearchProgress.get(req.params.jobId);
  res.json(entry || { step: 0, total: 3, label: '', phase: 'idle' });
});
// Limpieza periódica de jobs viejos para no acumular memoria indefinidamente.
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, entry] of camiloResearchProgress) {
    if (entry.updatedAt < cutoff) camiloResearchProgress.delete(id);
  }
}, 60 * 1000);

// Reglas anti-alucinación compartidas por los 3 endpoints de Camilo — sin esto el modelo
// (a) inventaba nombres de institución como "fuente" que no aparecían en la búsqueda real,
// y (b) a veces concatenaba varias cifras de la búsqueda en un solo número absurdo
// (ej. "$675.676.216.216.810.000...") al redactar el análisis narrativo.
const ANTI_HALUCINACION = `
REGLAS OBLIGATORIAS (no negociables):
1. Cita como "fuente" ÚNICAMENTE los dominios/URLs que aparecen literalmente después de
   "Fuentes:" en la investigación web de arriba. Si una búsqueda no trae fuentes, escribe
   "Sin fuente verificable para este dato" en vez de inventar un nombre de institución.
2. Cada cifra que menciones debe ser un solo número plausible para el contexto (precios de
   vivienda: entre $50,000 y $5,000,000 USD; porcentajes: entre 0% y 100%). Nunca concatenes,
   sumes ni pegues varias cifras encontradas en la búsqueda para formar un número más grande.
3. Si la investigación web no trae un dato específico que necesitas, dilo explícitamente
   ("no se encontró esta cifra en la búsqueda") en vez de inventarlo.`;

// Alcance del radar — antes solo existía la mezcla fija (Costa Rica + Portugal + Miami +
// Panamá), pensada como comparación INTERNACIONAL. Eso dejaba a Panamá comprimido en 1 de 4
// filas con apenas 2 oraciones, y no servía si lo que se necesita es ver competencia interna
// panameña con detalle (otros desarrolladores en Ciudad/Coronado/Chiriquí), o comparar solo
// contra el mercado doméstico colombiano (a donde vuelve el capital si no invierte afuera), o
// centrarse en Centroamérica. Cada alcance reparte sus queries de búsqueda ÚNICAMENTE entre
// los destinos que va a mostrar, así el destino principal siempre recibe profundidad real en
// vez de compartir presupuesto de búsqueda con países que ni siquiera se van a mostrar.
const RADAR_SCOPES = {
  panama: {
    label: 'Solo Panamá',
    destinos: 'competencia DOMÉSTICA dentro de Panamá — otros desarrolladores y proyectos que compiten directamente con GLP (Ciudad de Panamá/Costa del Este/Punta Pacífica, Coronado y playas cercanas, Chiriquí/David/Boquete)',
    searches: [
      'Panama City Costa del Este Punta Pacifica new luxury apartment developments 2025 2026 prices developers',
      'Coronado Panama beach real estate new developments 2025 2026 prices',
      'Chiriqui David Boquete Panama real estate investment developments 2025 2026 prices',
    ],
  },
  panama_colombia: {
    label: 'Panamá vs Colombia',
    destinos: 'Panamá (proyectos GLP compite con otros desarrolladores locales) y Colombia (mercado inmobiliario doméstico en Medellín, Bogotá y Cartagena, la alternativa de quedarse invirtiendo en su propio país)',
    searches: [
      'Panama City Coronama Chiriquí new real estate projects 2025 2026 prices developers',
      'Medellin Colombia real estate investment prices 2025 2026 apartamentos',
      'Bogota Cartagena Colombia real estate investment prices 2025 2026',
    ],
  },
  panama_colombia_usa: {
    label: 'Panamá, Colombia y USA',
    destinos: 'Panamá (competencia local), Colombia (mercado doméstico en Medellín/Bogotá/Cartagena) y Estados Unidos (Miami/Orlando, destino clásico de inversión de colombianos)',
    searches: [
      'Panama City Coronado Chiriquí new real estate projects 2025 2026 prices developers',
      'Medellin Bogota Colombia real estate investment prices 2025 2026',
      'Miami Orlando Florida condo investment prices 2025 2026 foreign buyers Colombian investors',
    ],
  },
  centroamerica: {
    label: 'Centroamérica',
    destinos: 'Panamá, Costa Rica (Guanacaste/Jacó) y otro país de Centroamérica con oferta de inversión inmobiliaria relevante en 2025-2026 (Guatemala o Nicaragua, el que tenga datos reales en la búsqueda)',
    searches: [
      'Panama City Coronado Chiriquí new real estate projects 2025 2026 prices developers',
      'Costa Rica beachfront real estate investment prices 2025 2026 Guanacaste Jaco',
      'Guatemala Nicaragua Central America real estate investment prices 2025 2026',
    ],
  },
  // Comportamiento original (internacional amplio) — se mantiene como opción por si se quiere
  // seguir comparando contra los 3 destinos internacionales clásicos + Panamá, todos a la vez.
  internacional: {
    label: 'Internacional (Costa Rica, Portugal, Miami, Panamá)',
    destinos: 'Costa Rica, Portugal, Miami/Orlando y Panamá (Ciudad, Coronado, Chiriquí)',
    searches: [
      'Costa Rica beachfront real estate investment prices 2025 2026 Guanacaste Jaco',
      'Portugal Golden Visa real estate investment 2025 2026 Lisboa Algarve prices',
      'Miami Orlando Florida condo investment prices 2025 2026 foreign buyers',
      'Panama City Coronado Chiriquí new real estate projects 2025 2026 prices',
    ],
  },
};

// Radar de Competencia — antes generaba resultados "inventados" con triggerOpenAI/api/ai
// (sin web search), por eso siempre salían los mismos destinos con los mismos datos.
app.post('/api/camilo/radar-competencia', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const run = await startAgentRun(tenant.id, user, 'CAMILO', 'radar_competencia');
  if (run?.locked) {
    return res.status(409).json({ error: 'ya_en_curso', lockedBy: run.lockedBy, lockedSince: run.lockedSince });
  }
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado.' });

    const scopeKey = RADAR_SCOPES[req.body?.scope] ? req.body.scope : 'internacional';
    const scope = RADAR_SCOPES[scopeKey];
    const jobId = req.body?.jobId;

    const webContext = await deepWebSearchGLP(apiKey, scope.searches, scope.destinos, (progress) => {
      setCamiloProgress(jobId, progress);
    });

    setCamiloProgress(jobId, { step: 1, total: 1, label: 'Redactando radar con gpt-5…', phase: 'synthesis' });
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const synthesis = await openai.chat.completions.create({
      model: 'gpt-5',
      reasoning_effort: 'low',
      // Margen amplio a propósito: los alcances de 4 destinos (internacional,
      // panama_colombia_usa) generan más contenido, y quedarse corto produce "" vacío sin
      // error visible (confirmado con reporte-mercado en 3000 — ver nota en esa ruta).
      max_completion_tokens: 7000,
      messages: [{
        role: 'user',
        content: `Con base en esta investigación web real y actual (2 rondas: búsqueda inicial + profundización dirigida a huecos de información), genera el Radar de Competencia de GLP Wealth Management (compite por inversionistas colombianos contra estos destinos):

${webContext}

Genera un registro por destino/región de: ${scope.destinos}. Cada registro debe traer: titulo (nombre del destino/región), descripcion (situación actual en 2-3 oraciones basada en los datos reales de arriba, cita cifras concretas y — si el alcance incluye Panamá — nombra proyectos o zonas específicas encontradas en la búsqueda, no solo el país en general), precio_ref (rango de precios FORMATEADO con separador de miles y símbolo de moneda, ej. "$150,000 – $650,000" o "€5,995/m²", o "Sin dato verificable en la búsqueda" si no hay cifra — NUNCA dígitos sin formato ni texto sobre fuentes en este campo), argumentos (3 argumentos por los que GLP lo supera), fuentes (dominios/URL literales citados tras "Fuentes:" en la investigación de arriba para ESTE destino específico — nunca inventes ni reutilices una fuente de otro destino; si no hay ninguna, usa exactamente ["Sin fuente verificable para este dato"]).
${ANTI_HALUCINACION}
4. precio_ref y fuentes son campos independientes: precio_ref SIEMPRE debe ser un número o rango numérico formateado (o el texto exacto "Sin dato verificable en la búsqueda"), nunca el aviso de "sin fuente". El aviso de fuente faltante va SOLO dentro del array "fuentes".`,
      }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'radar_competencia',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              destinos: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    titulo: { type: 'string' },
                    descripcion: { type: 'string' },
                    precio_ref: { type: 'string' },
                    argumentos: { type: 'array', items: { type: 'string' } },
                    fuentes: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['titulo', 'descripcion', 'precio_ref', 'argumentos', 'fuentes'],
                },
              },
            },
            required: ['destinos'],
          },
        },
      },
    });
    setCamiloProgress(jobId, { step: 1, total: 1, label: 'Completado', phase: 'done' });
    await finishAgentRun(run?.id, { status: 'completado', tokensEstimados: synthesis.usage?.total_tokens ?? null, promptTokens: synthesis.usage?.prompt_tokens ?? null, completionTokens: synthesis.usage?.completion_tokens ?? null });
    // El frontend (CRMDashboard) sigue esperando choices[0].message.content como un JSON
    // array plano — se reserializa aquí para no tocar el contrato existente, aunque
    // internamente OpenAI ahora devuelve un objeto {destinos:[...]} (json_schema strict
    // exige raíz de tipo object, no array).
    const destinos = JSON.parse(synthesis.choices[0].message.content.trim()).destinos || [];
    res.json({ choices: [{ message: { content: JSON.stringify(destinos) } }] });
  } catch (err) {
    console.error('❌ Error en /api/camilo/radar-competencia:', err.message);
    await finishAgentRun(run?.id, { status: 'error', errorDetalle: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Reporte semanal de mercado — mismo problema: antes usaba solo memoria del modelo.
app.post('/api/camilo/reporte-mercado', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const run = await startAgentRun(tenant.id, user, 'CAMILO', 'reporte_mercado');
  if (run?.locked) {
    return res.status(409).json({ error: 'ya_en_curso', lockedBy: run.lockedBy, lockedSince: run.lockedSince });
  }
  try {
    const { kpiCtx, objSummary, jobId } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado.' });

    const reporteDestinos = 'panorama macroeconómico de Panamá, mercado inmobiliario local y competencia internacional (Costa Rica, Portugal, Miami)';
    const webContext = await deepWebSearchGLP(apiKey, [
      'Panama economy real estate market outlook 2025 2026 interest rates USD',
      'Colombian peso exchange rate USD 2025 2026 outbound investment trends',
      'Panama City luxury real estate demand foreign buyers 2025 2026',
    ], reporteDestinos, (progress) => setCamiloProgress(jobId, progress));

    setCamiloProgress(jobId, { step: 1, total: 1, label: 'Redactando reporte con gpt-5…', phase: 'synthesis' });
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const synthesis = await openai.chat.completions.create({
      model: 'gpt-5',
      reasoning_effort: 'low',
      // gpt-5 gasta tokens de razonamiento invisibles del mismo presupuesto de salida —
      // con 3000 el modelo se quedaba sin espacio para el texto real y devolvía "" vacío
      // (confirmado en prueba real, sin error, solo contenido vacío). 8000 deja margen para
      // ~600 palabras de reporte + razonamiento en un prompt largo con investigación de 2 rondas.
      max_completion_tokens: 8000,
      messages: [{
        role: 'user',
        content: `Eres Camilo, analista de mercado de GLP Wealth Management Panamá. Con base en esta investigación web real (2 rondas: búsqueda inicial + profundización dirigida a huecos de información):

${webContext}

${kpiCtx ? `CONTEXTO INTERNO GLP:\n${kpiCtx}\n` : ''}${objSummary ? `Objeciones de brokers: ${objSummary}\n` : ''}
Genera el REPORTE SEMANAL DE MERCADO cubriendo: 1) Panorama macro, 2) Mercado inmobiliario Panamá, 3) Competencia (Costa Rica/Portugal/Miami), 4) Señales de riesgo, 5) Oportunidades, 6) Recomendación táctica concreta para HOY. Cita cifras reales de la investigación de arriba cuando existan. Texto profesional en español, máx 600 palabras.
${ANTI_HALUCINACION}`,
      }],
    });
    setCamiloProgress(jobId, { step: 1, total: 1, label: 'Completado', phase: 'done' });
    await finishAgentRun(run?.id, { status: 'completado', tokensEstimados: synthesis.usage?.total_tokens ?? null, promptTokens: synthesis.usage?.prompt_tokens ?? null, completionTokens: synthesis.usage?.completion_tokens ?? null });
    res.json({ texto: synthesis.choices[0].message.content.trim() });
  } catch (err) {
    console.error('❌ Error en /api/camilo/reporte-mercado:', err.message);
    await finishAgentRun(run?.id, { status: 'error', errorDetalle: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camilo/research', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  // Camilo con web_search es la llamada más cara del sistema (3 búsquedas + síntesis) — la
  // primera en llevar bitácora completa, para tener datos reales antes de fijar el tope de
  // gasto por tenant de la Fase 2.
  const run = await startAgentRun(tenant.id, user, 'CAMILO', 'research');
  if (run?.locked) {
    return res.status(409).json({ error: 'ya_en_curso', lockedBy: run.lockedBy, lockedSince: run.lockedSince });
  }
  try {
    const { kpiCtx, brandCtx, projectsList, jobId } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado.' });

    const searches = [
      'Panama luxury real estate market prices trends sales volume 2025',
      'Colombian investors Panama real estate 2025 investment dollar exchange rate',
      'Panama City Bella Vista Santa Maria Ocean Reef luxury apartments new projects 2025'
    ];
    const researchDestinos = 'mercado inmobiliario de lujo en Panamá, comportamiento de inversionistas colombianos y proyectos específicos en Bella Vista/Santa María/Ocean Reef';
    const webContext = await deepWebSearchGLP(apiKey, searches, researchDestinos, (progress) => setCamiloProgress(jobId, progress));
    setCamiloProgress(jobId, { step: 1, total: 1, label: 'Sintetizando investigación con gpt-5…', phase: 'synthesis' });

    // ── síntesis → documento de inteligencia estructurado ──
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const synthesisPrompt = `${kpiCtx ? `CONTEXTO OPERATIVO GLP:\n${kpiCtx}\n\n` : ''}${brandCtx ? `PERFIL DE MARCA Y AUDIENCIA:\n${brandCtx}\n\n` : ''}${projectsList ? `PORTAFOLIO ACTUAL GLP:\n${projectsList}\n\n` : ''}
INVESTIGACIÓN WEB EN TIEMPO REAL (deep search):
${webContext}

Con base en los datos reales de búsqueda anteriores, genera un reporte de inteligencia con EXACTAMENTE esta estructura JSON (sin markdown, sin bloques de código):
{
  "resumen_ejecutivo": "párrafo de 3-4 líneas con el estado actual del mercado basado en los datos encontrados — cita cifras concretas",
  "insights": [
    {
      "tipo": "mercado|crisis|oportunidad|audiencia",
      "titulo": "título del insight (máx 10 palabras)",
      "datos": "análisis con cifras y tendencias reales encontradas en la búsqueda — mínimo 150 palabras con datos concretos de Panamá y Colombia 2025",
      "impacto": "alto|medio|bajo",
      "acciones_sara": "qué debe hacer SARA con este insight (respuestas, FAQs a actualizar)",
      "acciones_valeria": "qué contenido debe crear Valeria con este insight",
      "acciones_isabella": "qué video debe crear Isabella con este insight",
      "fuentes": ["fuente concreta 1", "fuente concreta 2"]
    }
  ],
  "señales_crisis": "descripción de riesgos actuales para ventas GLP basados en los datos reales (tasa de cambio, competencia, mercado)",
  "oportunidades_inmediatas": "top 3 oportunidades concretas para cerrar más negocios esta semana basadas en los datos reales encontrados"
}

Genera 4-5 insights variados y accionables (mercado macro, oportunidad de proyecto específico, audiencia colombiana, señal de crisis o riesgo). TODOS los datos deben estar respaldados en la investigación web de arriba.
${ANTI_HALUCINACION}`;

    const synthesis = await openai.chat.completions.create({
      model: 'gpt-5',
      reasoning_effort: 'low',
      max_completion_tokens: 10000,
      messages: [
        { role: 'system', content: 'Eres Camilo, Científico de Datos y Estratega de Inteligencia de Mercado de GLP Wealth Management. Recibes datos reales de búsqueda web y los transformas en inteligencia accionable para el equipo comercial.' },
        { role: 'user', content: synthesisPrompt }
      ],
    });

    setCamiloProgress(jobId, { step: 1, total: 1, label: 'Completado', phase: 'done' });
    await finishAgentRun(run?.id, { status: 'completado', tokensEstimados: synthesis.usage?.total_tokens ?? null, promptTokens: synthesis.usage?.prompt_tokens ?? null, completionTokens: synthesis.usage?.completion_tokens ?? null });
    res.json({ choices: [{ message: { content: synthesis.choices[0].message.content } }] });
  } catch (err) {
    setCamiloProgress(req.body?.jobId, { step: 0, total: 3, label: err.message, phase: 'error' });
    console.error('❌ Error en /api/camilo/research:', err.message);
    await finishAgentRun(run?.id, { status: 'error', errorDetalle: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SUPER ADMIN – GESTIÓN DE TENANTS
// ==========================================
app.get('/api/admin/tenants', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/tenants', async (req, res) => {
  try {
    const { id, name, domain, contact, smtp, openai, apollo, status } = req.body;
    if (!name || !domain) return res.status(400).json({ error: 'Nombre y dominio son obligatorios.' });
    const tenantId = id || `tenant-${Date.now()}`;
    const { rows } = await pool.query(
      `INSERT INTO tenants (id, name, domain, status, contact, smtp, openai, apollo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantId, name, domain, status || 'active',
       JSON.stringify(contact || {}), JSON.stringify(smtp || {}),
       JSON.stringify(openai || {}), JSON.stringify(apollo || {})]
    );
    res.json({ success: true, tenant: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates);
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = [...fields.map(f => typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]), id];
    const { rows } = await pool.query(`UPDATE tenants SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`, values);
    res.json({ success: true, tenant: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// APOLLO.IO – DATA MINING
// ==========================================

// Guarda/actualiza la API key de Apollo para el tenant actual (upsert — el tenant por
// defecto 'tenant-glp-001' normalmente no tiene fila propia hasta que se configura algo).
app.post('/api/apollo/configure', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'tenant-glp-001';
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'apiKey requerida.' });
    await pool.query(
      `INSERT INTO tenants (id, name, domain, status, apollo)
       VALUES ($1, $2, $3, 'active', $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET apollo = $4::jsonb`,
      [tenantId, 'GLP Wealth Management', 'glp.com.pa', JSON.stringify({ apiKey })]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apollo/mine', async (req, res) => {
  const tenant = await resolveTenant(req);
  const apolloKey = tenant?.apollo?.apiKey;
  if (!apolloKey) return res.status(400).json({ error: 'API Key de Apollo no configurada.' });

  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apolloKey },
      body: JSON.stringify({
        page: 1, per_page: 10,
        person_locations: ['Colombia'],
        person_titles: ['CEO', 'Founder', 'Gerente General', 'Director', 'CFO']
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error || data?.message || 'Apollo.io rechazó la solicitud.' });
    }
    const prospects = (data.people || []).map(p => ({
      nombre: p.first_name || 'Desconocido', apellido: p.last_name || '',
      correo: p.email || 'No disponible',
      telefono: p.phone_numbers?.[0]?.sanitized_number || 'No disponible',
      ocupacion: p.title || 'Ejecutivo', empresa: p.organization?.name || '',
      linkedin: p.linkedin_url || '', direccion: `${p.city || ''}, Colombia`,
      proyectos_interes: ['Nuevos Desarrollos Panamá'],
      forma_contacto: 'Apollo API', presupuesto_usd: 350000
    }));
    res.json({ success: true, prospects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SARA – ANÁLISIS DE PROSPECTOS (GPT-4)
// ==========================================
app.post('/api/sara/process-prospects', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  // Un solo run para todo el lote (no uno por prospecto) — el candado protege "Sara ya está
  // analizando consultas para este tenant", no cada prospecto individual, así que una fila
  // por invocación es suficiente y evita saturar la bitácora con hasta 5 filas por clic.
  const run = await startAgentRun(tenant.id, user, 'SARA', 'analizar_consultas');
  if (run?.locked) {
    return res.status(409).json({ error: 'ya_en_curso', lockedBy: run.lockedBy, lockedSince: run.lockedSince });
  }
  try {
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) { await finishAgentRun(run?.id, { status: 'error', errorDetalle: 'OpenAI API Key requerida.' }); return res.status(500).json({ error: 'OpenAI API Key requerida.' }); }

    const { rows: dbProspects } = await pool.query(
      'SELECT * FROM prospectos WHERE tenant_id = $1 ORDER BY fecha_registro DESC LIMIT 50',
      [tenant.id]
    );
    const frontendProspects = req.body.prospects || [];
    const allProspects = frontendProspects.length > 0 ? frontendProspects : dbProspects;

    const { rows: projectRows } = await pool.query('SELECT data FROM projects WHERE tenant_id = $1', [tenant.id]);
    const catalogSummary = projectRows.map(r =>
      `- ${r.data.name}: ${r.data.zone}. Desde $${r.data.price} USD.`
    ).join('\n');

    const { rows: pendingDrafts } = await pool.query(
      "SELECT destinatario FROM drafts WHERE tenant_id = $1 AND status = 'pending'",
      [tenant.id]
    );
    const existingEmails = new Set(pendingDrafts.map(d => {
      const m = d.destinatario?.match(/\(([^)]+)\)/);
      return m ? m[1] : '';
    }));

    // "Seguimiento de Sara" es para reactivar prospectos ESTANCADOS — no para los recién
    // registrados. Antes se tomaban los 5 prospectos más nuevos (orden de la consulta SQL,
    // fecha_registro DESC), justo lo opuesto: un lead de hace 2 minutos recibía un correo
    // de "seguimiento" antes que alguien sin actividad hace 3 semanas. Ahora se ordena por
    // días reales sin actividad (más estancado primero) y se exige un mínimo de 3 días sin
    // movimiento — así un lead fresco nunca compite por el cupo con uno que sí necesita
    // reactivación. 'Perdido'/'Post-venta' quedan fuera: ya no son un ciclo activo a
    // reactivar por este medio.
    const MIN_DIAS_ESTANCADO = 3;
    const needsAttention = allProspects
      .filter(p => (p.correo || p.email) && !existingEmails.has(p.correo || p.email))
      .filter(p => !['Perdido', 'Post-venta'].includes(p.estado))
      .map(p => {
        const lastActivity = new Date(p.fecha_ultima_actividad || p.fecha_registro || Date.now());
        const diasSinActividad = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
        return { ...p, diasSinActividad };
      })
      .filter(p => p.diasSinActividad >= MIN_DIAS_ESTANCADO)
      .sort((a, b) => b.diasSinActividad - a.diasSinActividad)
      .slice(0, 5);

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const results = [];
    let batchPromptTokens = 0, batchCompletionTokens = 0;
    // Contexto de FAQs oficiales — para que el correo de reactivación no contradiga (o
    // reinvente) respuestas que ya están estandarizadas (ej. régimen fiscal, financiamiento).
    const faqsCtx = await getFaqsForPrompt(tenant.id);
    const faqContextText = buildFaqContextText(faqsCtx);

    for (const prospect of needsAttention) {
      try {
        const nombre = prospect.nombre || 'Cliente';
        const email = prospect.correo || prospect.email || '';
        const gptResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `Eres Sara Valenzuela de ${tenant.name}. Este prospecto lleva ${prospect.diasSinActividad} días sin ninguna actividad ni respuesta — este correo es de REACTIVACIÓN, no una respuesta a una solicitud nueva. Genera un correo comercial de reactivación para ${nombre} (${prospect.estado || 'Lead'}), interesado en ${JSON.stringify(prospect.proyectos_interes || [])}. Presupuesto: $${prospect.presupuesto_usd || 'N/A'}. El tono debe reconocer implícitamente el tiempo transcurrido (sin sonar acusatorio) y dar una razón concreta para retomar la conversación ahora. Catálogo:\n${catalogSummary}${faqContextText}` }],
          temperature: 0.7, max_tokens: 600,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'borrador_prospecto',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  draftSubject: { type: 'string' },
                  draftBody: { type: 'string' },
                  prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
                },
                required: ['draftSubject', 'draftBody', 'prioridad'],
              },
            },
          },
        });
        batchPromptTokens += gptResponse.usage?.prompt_tokens || 0;
        batchCompletionTokens += gptResponse.usage?.completion_tokens || 0;
        const parsed = JSON.parse(gptResponse.choices[0].message.content.trim());
        const draftId = `draft-${Date.now()}-${Math.floor(Math.random() * 9000)}`;
        await pool.query(
          'INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, prioridad, origen, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())',
          [draftId, tenant.id, `${nombre} (${email})`,
           JSON.stringify(prospect.proyectos_interes || []),
           parsed.draftSubject, parsed.draftBody, 'pending', parsed.prioridad || 'media', 'seguimiento_sara']
        );
        results.push({ nombre, email, draftId, prioridad: parsed.prioridad });
      } catch (e) {
        console.error(`Error procesando ${prospect.nombre}:`, e.message);
      }
    }

    await finishAgentRun(run?.id, { status: 'completado', tokensEstimados: batchPromptTokens + batchCompletionTokens, promptTokens: batchPromptTokens, completionTokens: batchCompletionTokens });
    res.json({ success: true, processedCount: results.length, results });
  } catch (err) {
    await finishAgentRun(run?.id, { status: 'error', errorDetalle: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Chat interactivo con Sara — responde preguntas del usuario activo sobre su propia
// cartera de prospectos/mensajes en vez de solo generar borradores. Contexto acotado a
// los últimos 40 prospectos y 20 mensajes recientes por costo/latencia; para preguntas que
// requieran más historia el usuario puede acotar por nombre/proyecto en la pregunta misma.
app.post('/api/sara/chat', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const { question, history = [] } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ error: 'question requerida' });

  const run = await startAgentRun(tenant.id, user, 'SARA', 'chat');
  try {
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) { await finishAgentRun(run?.id, { status: 'error', errorDetalle: 'OpenAI API Key requerida.' }); return res.status(500).json({ error: 'OpenAI API Key requerida.' }); }

    const { rows: prospects } = await pool.query(
      `SELECT id, nombre, apellido, estado, correo, telefono, broker_asignado, proyectos_interes,
              presupuesto_usd, fecha_registro, fecha_ultima_actividad
       FROM prospectos WHERE tenant_id = $1 ORDER BY fecha_ultima_actividad DESC NULLS LAST LIMIT 40`,
      [tenant.id]
    );
    const { rows: drafts } = await pool.query(
      `SELECT id, destinatario, subject, status, prioridad, origen, created_at
       FROM drafts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [tenant.id]
    );
    const { rows: alerts } = await pool.query(
      `SELECT a.nivel, a.status, p.nombre, p.apellido
       FROM prospect_alerts a JOIN prospectos p ON a.prospecto_id = p.id
       WHERE a.tenant_id = $1 AND a.status = 'activa' ORDER BY a.created_at DESC LIMIT 20`,
      [tenant.id]
    );

    const hoy = new Date();
    const prospectsCtx = prospects.map(p => {
      const last = p.fecha_ultima_actividad || p.fecha_registro;
      const dias = last ? Math.floor((hoy - new Date(last)) / 86400000) : null;
      return `- [id:${p.id}] ${p.nombre} ${p.apellido} · ${p.estado} · broker: ${p.broker_asignado || 'sin asignar'} · proyectos: ${(p.proyectos_interes || []).join(', ') || '—'} · presupuesto: $${p.presupuesto_usd || 0} · ${dias != null ? `${dias} días sin actividad` : 'sin actividad registrada'}`;
    }).join('\n');
    const draftsCtx = drafts.map(d => `- [id:${d.id}] ${d.status} · ${d.prioridad || ''} · para ${d.destinatario} · "${d.subject}" · origen: ${d.origen || 'manual'}`).join('\n');
    const alertsCtx = alerts.map(a => `- ${a.nivel}: ${a.nombre} ${a.apellido}`).join('\n');

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Eres Sara, Directora de Experiencia de Cliente de ${tenant.name}. Respondes preguntas del equipo comercial sobre sus propios prospectos, mensajes y alertas — con datos reales, nunca inventados. Si el dato no está en el contexto, dilo explícitamente en vez de suponer. Responde en español, tono directo y profesional, sin relleno.

PROSPECTOS RECIENTES:
${prospectsCtx || '(sin prospectos)'}

MENSAJES/BORRADORES RECIENTES:
${draftsCtx || '(sin mensajes)'}

ALERTAS ACTIVAS:
${alertsCtx || '(sin alertas)'}` },
        ...history.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
        { role: 'user', content: question },
      ],
      temperature: 0.4, max_tokens: 500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'respuesta_sara',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              answer: { type: 'string' },
              prospectosCitados: { type: 'array', items: { type: 'integer' } },
            },
            required: ['answer', 'prospectosCitados'],
          },
        },
      },
    });
    const parsed = JSON.parse(gptResponse.choices[0].message.content.trim());
    const citados = prospects.filter(p => parsed.prospectosCitados.includes(p.id))
      .map(p => ({ id: p.id, nombre: `${p.nombre} ${p.apellido}` }));

    await finishAgentRun(run?.id, {
      status: 'completado',
      tokensEstimados: (gptResponse.usage?.prompt_tokens || 0) + (gptResponse.usage?.completion_tokens || 0),
      promptTokens: gptResponse.usage?.prompt_tokens || 0,
      completionTokens: gptResponse.usage?.completion_tokens || 0,
    });
    res.json({ answer: parsed.answer, citas: citados });
  } catch (err) {
    await finishAgentRun(run?.id, { status: 'error', errorDetalle: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Chat interactivo genérico para Camilo, Sofía y Valeria — mismo patrón que
// /api/sara/chat, pero el contexto que arma depende de qué agente responde (Camilo:
// insights de mercado; Sofía: perfiles psicográficos; Valeria: contenido/campañas).
// Sara mantiene su propio endpoint porque su contexto (mensajes/drafts/alertas) ya
// existía antes de generalizar esto.
const AGENT_PERSONAS = {
  CAMILO: 'Camilo, VP de Investigación y Mercados. Investigas el mercado inmobiliario y generas insights de inteligencia — tendencias, oportunidades, alertas de crisis.',
  SOFIA: 'Sofía, PhD en Psicología del Consumidor de Lujo. Analizas perfiles psicográficos de prospectos y detectas su arquetipo de comprador (Coleccionista de Estatus, Preservador de Legado, Decisor Racional, Comprador Aspiracional).',
  VALERIA: 'Valeria, VP de Medios. Redactas copy y gestionas el calendario editorial de campañas — LinkedIn, newsletters, email, redes sociales.',
  ISABELLA: 'Isabella, Embajadora de Marca. Generas guiones de producción de video — Reels, testimoniales, contenido educativo — y coordinas el calendario de producción audiovisual.',
};
app.post('/api/agents/chat', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const { agent, question, history = [] } = req.body;
  if (!agent || !AGENT_PERSONAS[agent]) return res.status(400).json({ error: 'agent inválido (CAMILO | SOFIA | VALERIA | ISABELLA)' });
  if (!question || !question.trim()) return res.status(400).json({ error: 'question requerida' });

  const run = await startAgentRun(tenant.id, user, agent, 'chat');
  try {
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) { await finishAgentRun(run?.id, { status: 'error', errorDetalle: 'OpenAI API Key requerida.' }); return res.status(500).json({ error: 'OpenAI API Key requerida.' }); }

    let contextText = '';
    let prospectsForCitas = [];

    if (agent === 'CAMILO') {
      const { rows: insights } = await pool.query(
        `SELECT id, titulo, resumen, tipo, impacto, status, fecha FROM camilo_insights
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [tenant.id]
      );
      contextText = `INSIGHTS DE MERCADO RECIENTES:\n${insights.map(i => `- [${i.tipo}/${i.impacto}] ${i.titulo} — ${i.resumen || ''} (${i.status}, ${i.fecha})`).join('\n') || '(sin insights)'}`;
    } else if (agent === 'SOFIA') {
      const { rows: profiles } = await pool.query(
        `SELECT sp.prospecto_id, sp.arquetipo, sp.confianza, sp.senales, p.nombre, p.apellido, p.proyectos_interes
         FROM sofia_profiles sp JOIN prospectos p ON sp.prospecto_id = p.id
         WHERE sp.tenant_id = $1 ORDER BY sp.updated_at DESC LIMIT 40`,
        [tenant.id]
      );
      prospectsForCitas = profiles.map(p => ({ id: p.prospecto_id, nombre: `${p.nombre} ${p.apellido}` }));
      contextText = `PERFILES PSICOGRÁFICOS:\n${profiles.map(p => `- [id:${p.prospecto_id}] ${p.nombre} ${p.apellido} · arquetipo: ${p.arquetipo} · confianza: ${p.confianza}% · proyectos: ${(p.proyectos_interes || []).join(', ') || '—'} · señales: ${(p.senales || []).join('; ')}`).join('\n') || '(sin perfiles aún)'}`;
    } else if (agent === 'VALERIA') {
      const { rows: drafts } = await pool.query(
        `SELECT id, canal, asunto, status, type, tags, date FROM valeria_drafts
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [tenant.id]
      );
      contextText = `CONTENIDO/CAMPAÑAS RECIENTES:\n${drafts.map(d => `- [${d.status}] ${d.canal || d.type} · "${d.asunto || ''}" · ${(d.tags || []).join(', ')} · ${d.date}`).join('\n') || '(sin contenido generado aún)'}`;
    } else if (agent === 'ISABELLA') {
      const { rows: scripts } = await pool.query(
        `SELECT id, canal, asunto, status, type, tags, date FROM isabella_scripts
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [tenant.id]
      );
      contextText = `GUIONES DE VIDEO RECIENTES:\n${scripts.map(s => `- [${s.status}] ${s.canal || s.type} · "${s.asunto || ''}" · ${(s.tags || []).join(', ')} · ${s.date}`).join('\n') || '(sin guiones generados aún)'}`;
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Eres ${AGENT_PERSONAS[agent]} Trabajas para ${tenant.name}. Respondes preguntas del equipo comercial con datos reales del contexto — si el dato no está ahí, dilo explícitamente en vez de suponer. Responde en español, tono directo y profesional, sin relleno.\n\n${contextText}` },
        ...history.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
        { role: 'user', content: question },
      ],
      temperature: 0.4, max_tokens: 500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'respuesta_agente',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              answer: { type: 'string' },
              prospectosCitados: { type: 'array', items: { type: 'integer' } },
            },
            required: ['answer', 'prospectosCitados'],
          },
        },
      },
    });
    const parsed = JSON.parse(gptResponse.choices[0].message.content.trim());
    const citados = prospectsForCitas.filter(p => parsed.prospectosCitados.includes(p.id));

    await finishAgentRun(run?.id, {
      status: 'completado',
      tokensEstimados: (gptResponse.usage?.prompt_tokens || 0) + (gptResponse.usage?.completion_tokens || 0),
      promptTokens: gptResponse.usage?.prompt_tokens || 0,
      completionTokens: gptResponse.usage?.completion_tokens || 0,
    });
    res.json({ answer: parsed.answer, citas: citados });
  } catch (err) {
    await finishAgentRun(run?.id, { status: 'error', errorDetalle: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ==========================================
// ALERTAS DE PROSPECTOS
// ==========================================
app.get('/api/alerts', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT a.*, p.nombre, p.apellido, p.correo, p.estado as etapa, p.proyectos_interes, p.presupuesto_usd
       FROM prospect_alerts a
       JOIN prospectos p ON a.prospecto_id = p.id
       WHERE a.tenant_id = $1 AND a.status = 'activa'
       ORDER BY CASE a.nivel WHEN 'critico' THEN 1 WHEN 'frio' THEN 2 WHEN 'tibio' THEN 3 WHEN 'oportunidad' THEN 4 END, a.created_at DESC`,
      [tenant.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/alerts/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { status } = req.body;
    await pool.query(
      `UPDATE prospect_alerts SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [status, req.params.id, tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sara/monitor', async (req, res) => {
  try {
    const count = await monitorProspects();
    res.json({ success: true, alertasCreadas: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Envío directo de correo desde borradores locales del historial de prospectos
app.post('/api/sara/send-email', async (req, res) => {
  try {
    const { to, subject, body, prospectId, attachments = [] } = req.body;
    if (!to || !subject || !body) return res.status(400).json({ error: 'Faltan campos: to, subject, body.' });

    const tenant = await resolveTenant(req);
    const user = resolveUser(req);
    const transporter = getTransporter(tenant);
    if (!transporter) return res.status(500).json({ error: 'SMTP no configurado. Verifica SMTP_USER y SMTP_PASS en .env' });

    const mailAttachments = attachments.map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType
    }));

    await transporter.sendMail({
      from: `"Sara Valenzuela · GLP Wealth Management" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: body.replace(/\n/g, '<br>'),
      attachments: mailAttachments
    });

    // Registrar actividad en el prospecto si se proporcionó ID
    if (prospectId) {
      await pool.query(
        `UPDATE prospectos SET fecha_ultima_actividad = NOW() WHERE id = $1 AND tenant_id = $2`,
        [prospectId, TENANT]
      );
    }

    console.log(`[Sara·Email] ✅ Correo enviado a ${to} — "${subject}"`);
    res.json({ success: true, sentBy: user, sentAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Sara·Email] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// B.1: Trigger manual Sara·72h (también corre automático cada hora)
app.post('/api/sara/trigger-72h', async (req, res) => {
  try {
    const count = await saraAutoTrigger72h();
    res.json({ success: true, borradoresGenerados: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// B.3: Trigger manual detección fríos por score (también corre automático cada hora)
app.post('/api/sara/detect-cold', async (req, res) => {
  try {
    const count = await detectColdProspects();
    res.json({ success: true, friosDetectados: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// IMAP – REVISIÓN MANUAL DE BANDEJA
// ==========================================
app.post('/api/sara/check-inbox', async (req, res) => {
  try {
    await pollInbox();
    res.json({ success: true, message: 'Bandeja revisada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BRAND PROFILE — Perfil de Marca GLP
// ==========================================
app.get('/api/brand-profile', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT data FROM settings WHERE tenant_id = $1 AND key = 'brand_profile' LIMIT 1`,
      [tenant.id]
    );
    if (rows.length === 0) return res.json(null);
    res.json(rows[0].data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/brand-profile', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const profile = req.body;
    await pool.query(
      `INSERT INTO settings (tenant_id, key, data, updated_at)
       VALUES ($1, 'brand_profile', $2, NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET data = $2, updated_at = NOW()`,
      [tenant.id, JSON.stringify(profile)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SETTINGS GENÉRICO (market-report, etc.)
// ==========================================
app.put('/api/settings/:key', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query(
      `INSERT INTO settings (tenant_id, key, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET data = $3, updated_at = NOW()`,
      [tenant.id, req.params.key, JSON.stringify(req.body)]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/settings/:key', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT data FROM settings WHERE tenant_id = $1 AND key = $2 LIMIT 1`,
      [tenant.id, req.params.key]
    );
    res.json(rows.length > 0 ? rows[0].data : null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BROKER OBJECTIONS — Reporte de objeciones
// ==========================================
app.get('/api/broker-objections', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const tipo = req.query.tipo || null;
    const query = tipo
      ? `SELECT * FROM broker_objections WHERE tenant_id = $1 AND tipo = $2 ORDER BY created_at DESC LIMIT 100`
      : `SELECT * FROM broker_objections WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`;
    const { rows } = await pool.query(query, tipo ? [tenant.id, tipo] : [tenant.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/broker-objections', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { broker, prospecto, tipo, descripcion, canal, proyecto } = req.body;
    if (!broker || !tipo || !descripcion) return res.status(400).json({ error: 'broker, tipo y descripcion son requeridos' });
    const id = `obj-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    await pool.query(
      `INSERT INTO broker_objections (id, tenant_id, broker, prospecto, tipo, descripcion, canal, proyecto, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [id, tenant.id, broker, prospecto||null, tipo, descripcion, canal||'formulario', proyecto||null]
    );
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Agregado de conteo por tipo (para el detector de patrones en Paso 3)
app.get('/api/broker-objections/stats', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT tipo, COUNT(*) as total,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as ultimos_7d
       FROM broker_objections WHERE tenant_id = $1
       GROUP BY tipo ORDER BY total DESC`,
      [tenant.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// CRISIS ALERTS — Motor de detección de crisis
// ==========================================
app.get('/api/crisis-alerts', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const status = req.query.status || null;
    const query = status
      ? `SELECT * FROM crisis_alerts WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 50`
      : `SELECT * FROM crisis_alerts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`;
    const params = status ? [tenant.id, status] : [tenant.id];
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/crisis-alerts/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status requerido' });
    await pool.query(
      `UPDATE crisis_alerts SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [status, req.params.id, tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ejecutar detección manual desde frontend (para testing y admin)
app.post('/api/crisis/detect', async (req, res) => {
  try {
    const count = await detectCrisis();
    res.json({ success: true, alertas_creadas: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// BACKUP — EXPORT BASE DE DATOS
// ══════════════════════════════════════════════════════════════
app.get('/api/backup/export-db', async (req, res) => {
  const TENANT = 'tenant-glp-001';
  try {
    const tablas = ['prospectos', 'drafts', 'prospect_alerts', 'crisis_alerts', 'projects', 'brokers', 'tenants', 'eventos', 'faq_clicks'];
    const snapshot = { exportado_en: new Date().toISOString(), tenant_id: TENANT, tablas: {} };

    for (const tabla of tablas) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${tabla} WHERE tenant_id = $1`, [TENANT]);
        snapshot.tablas[tabla] = rows;
      } catch {
        // tabla sin columna tenant_id (ej: tenants)
        try {
          const { rows } = await pool.query(`SELECT * FROM ${tabla}`);
          snapshot.tablas[tabla] = rows;
        } catch {
          snapshot.tablas[tabla] = [];
        }
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="glp_db_backup_${new Date().toISOString().slice(0,10)}.json"`);
    res.json(snapshot);
  } catch (err) {
    console.error('[Backup DB] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// BACKUP — GITHUB
// ══════════════════════════════════════════════════════════════
const { execSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

app.post('/api/backup/github', (req, res) => {
  const mensaje = (req.body?.mensaje || '').trim();
  const timestamp = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const commitMsg = mensaje
    ? `Backup manual: ${mensaje} (${timestamp})`
    : `Backup automático CRM GLP — ${timestamp}`;

  try {
    execSync('git add glp-app/package.json glp-app/package-lock.json glp-app/server/index.js glp-app/src/crm/CRMDashboard.tsx glp-app/src/main.tsx glp-app/server/crisisDetector.js glp-app/server/emailPoller.js glp-app/server/prospectMonitor.js glp-app/src/lib/supabase.ts glp-app/.gitignore', { cwd: REPO_ROOT });

    // Verificar si hay cambios reales para commitear
    const diff = execSync('git diff --cached --stat', { cwd: REPO_ROOT }).toString().trim();
    if (!diff) {
      // Sin cambios — igual retornamos el último commit como referencia
      const lastCommit = execSync('git log -1 --pretty=format:"%h|%s|%ai"', { cwd: REPO_ROOT }).toString().trim();
      const [hash, subject, date] = lastCommit.split('|');
      return res.json({ success: true, sin_cambios: true, ultimo_commit: { hash, subject, date } });
    }

    execSync(`git commit -m "${commitMsg.replace(/"/g, "'")}"`, { cwd: REPO_ROOT });
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT }).toString().trim();
    execSync(`git push origin ${currentBranch}`, { cwd: REPO_ROOT });

    const lastCommit = execSync('git log -1 --pretty=format:"%h|%s|%ai"', { cwd: REPO_ROOT }).toString().trim();
    const [hash, subject, date] = lastCommit.split('|');

    res.json({ success: true, sin_cambios: false, commit: { hash, subject, date } });
  } catch (err) {
    console.error('[Backup] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/backup/historial', (req, res) => {
  try {
    const log = execSync('git log --pretty=format:"%h|%s|%ai" -10', { cwd: REPO_ROOT }).toString().trim();
    const commits = log.split('\n').map(line => {
      const [hash, subject, date] = line.split('|');
      return { hash, subject, date };
    });
    res.json({ success: true, commits });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// PROJECTS — endpoints adicionales (GET /:id y PUT /:id)
// El GET /api/projects ya existe arriba (línea ~235)
// ==========================================

// GET /api/projects/:id
app.get('/api/projects/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'tenant-glp-001';
    const { rows } = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'No encontrado' });
    res.json({ success: true, project: mapProjectRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/projects/:id — merge del campo data JSONB con los campos enviados
app.put('/api/projects/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'tenant-glp-001';
    const b = req.body;
    // Construimos el objeto de datos a guardar (solo los campos presentes en el body)
    const { id, tenantId: _tid, createdAt, updatedAt, ...dataFields } = b;
    const { rows } = await pool.query(
      `UPDATE projects
       SET data = data || $3::jsonb,
           imagen_url = COALESCE($4, imagen_url),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [req.params.id, tenantId, JSON.stringify(dataFields), b.imagen || null]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'No encontrado' });
    res.json({ success: true, project: mapProjectRow(rows[0]) });
  } catch (err) {
    console.error('[Projects] Error PUT:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: fila de Supabase → objeto ProjectData para el frontend
function mapProjectRow(r) {
  const d = r.data || {};
  return {
    id: r.id,
    ...d,
    imagen: r.imagen_url || d.imagen,
    updatedAt: r.updated_at,
  };
}

// ==========================================
// AGENTES — RUTAS SEPARADAS POR AGENTE
// ==========================================

const TENANT = 'tenant-glp-001';

// ── CAMILO: insights de inteligencia de mercado ──────────────

app.get('/api/camilo/insights', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM camilo_insights WHERE tenant_id = $1 ORDER BY created_at DESC',
      [TENANT]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/camilo/insights', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `INSERT INTO camilo_insights
        (id, tenant_id, titulo, resumen, datos, tipo, impacto, fuentes, status,
         acciones_sara, acciones_valeria, acciones_isabella, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status, updated_at = NOW()`,
      [d.id, TENANT, d.titulo, d.resumen, d.datos, d.tipo, d.impacto,
       d.fuentes || [], d.status || 'nuevo',
       d.acciones_sara, d.acciones_valeria, d.acciones_isabella, d.fecha]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/camilo/insights/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query(
      'UPDATE camilo_insights SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
      [status, req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/camilo/insights/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM camilo_insights WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── VALERIA: borradores de contenido ─────────────────────────

app.get('/api/valeria/drafts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM valeria_drafts WHERE tenant_id = $1 ORDER BY created_at DESC',
      [TENANT]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/valeria/drafts', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `INSERT INTO valeria_drafts
        (id, tenant_id, content, type, status, canal, asunto, contexto,
         tags, aprobado_por, fecha_aprobacion, notas_admin, origen_agentivo, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content, status = EXCLUDED.status,
         notas_admin = EXCLUDED.notas_admin, aprobado_por = EXCLUDED.aprobado_por,
         fecha_aprobacion = EXCLUDED.fecha_aprobacion, updated_at = NOW()`,
      [d.id, TENANT, d.content, d.type, d.status || 'pending',
       d.canal, d.asunto, d.contexto, d.tags || [],
       d.aprobado_por, d.fecha_aprobacion, d.notas_admin, d.origen_agentivo, d.date]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/valeria/drafts/:id', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `UPDATE valeria_drafts SET
         status = COALESCE($1, status),
         aprobado_por = COALESCE($2, aprobado_por),
         fecha_aprobacion = COALESCE($3, fecha_aprobacion),
         notas_admin = COALESCE($4, notas_admin),
         content = COALESCE($5, content),
         updated_at = NOW()
       WHERE id = $6 AND tenant_id = $7`,
      [d.status, d.aprobado_por, d.fecha_aprobacion, d.notas_admin, d.content,
       req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/valeria/drafts/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM valeria_drafts WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ISABELLA: guiones de video ────────────────────────────────

app.get('/api/isabella/scripts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM isabella_scripts WHERE tenant_id = $1 ORDER BY created_at DESC',
      [TENANT]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/isabella/scripts', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `INSERT INTO isabella_scripts
        (id, tenant_id, content, type, status, canal, asunto, contexto,
         tags, origen_agentivo, notas_admin, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content, status = EXCLUDED.status,
         notas_admin = EXCLUDED.notas_admin, updated_at = NOW()`,
      [d.id, TENANT, d.content, d.type, d.status || 'pending',
       d.canal, d.asunto, d.contexto, d.tags || [],
       d.origen_agentivo, d.notas_admin, d.date]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/isabella/scripts/:id', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `UPDATE isabella_scripts SET
         status = COALESCE($1, status),
         notas_admin = COALESCE($2, notas_admin),
         content = COALESCE($3, content),
         updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [d.status, d.notas_admin, d.content, req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/isabella/scripts/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM isabella_scripts WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ANALYTICS — Fase D: Reportería configurable
// ==========================================

// Helper: construye cláusulas WHERE dinámicas con filtros opcionales
// Normaliza proyectos_interes a JSONB array independientemente de si está guardado como string o array
const PROYECTOS_JSONB = `CASE
  WHEN jsonb_typeof(proyectos_interes::jsonb) = 'array'  THEN proyectos_interes::jsonb
  WHEN jsonb_typeof(proyectos_interes::jsonb) = 'string' THEN jsonb_build_array(proyectos_interes::jsonb #>> '{}')
  ELSE '[]'::jsonb
END`;

function buildAnalyticsWhere(tenantId, params, opts = {}) {
  const { dias = 365, canal, broker, proyecto, fecha_inicio, fecha_fin } = params;
  const conditions = [`tenant_id = $1`];
  if (!opts.skipDateFilter) {
    if (fecha_inicio && fecha_fin) {
      conditions.push(`fecha_registro >= '${fecha_inicio}'::date`);
      conditions.push(`fecha_registro < ('${fecha_fin}'::date + INTERVAL '1 day')`);
    } else {
      conditions.push(`fecha_registro >= NOW() - INTERVAL '${parseInt(dias)} days'`);
    }
  }
  const values = [tenantId];
  if (canal) { values.push(canal); conditions.push(`canal = $${values.length}`); }
  if (broker) {
    if (broker === 'Sin asignar') {
      conditions.push(`broker_asignado IS NULL`);
    } else {
      values.push(broker);
      conditions.push(`broker_asignado = $${values.length}`);
    }
  }
  if (proyecto) {
    values.push(proyecto);
    conditions.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(${PROYECTOS_JSONB}) p WHERE p = $${values.length}
    )`);
  }
  return { where: conditions.join(' AND '), values, proyecto };
}

app.get('/api/analytics/resumen', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                                        AS total_prospectos,
        COALESCE(SUM(presupuesto_usd::numeric), 0)                                     AS pipeline_total,
        COALESCE(AVG(presupuesto_usd::numeric) FILTER (WHERE presupuesto_usd IS NOT NULL), 0) AS ticket_promedio,
        COUNT(*) FILTER (WHERE estado IN ('Calificado','Negociación','Cierre','Post-venta')) AS calificados,
        COUNT(*) FILTER (WHERE estado IN ('Cierre','Post-venta'))                       AS cerrados
      FROM prospectos WHERE ${where}
    `, values);
    // nuevos_mes / nuevos_mes_ant se calculan SIEMPRE sobre los últimos 60 días reales
    // (respetando canal/broker/proyecto, pero no el rango de fechas del período elegido)
    // — si se anidaban dentro del WHERE del período (ej. 7d/30d), la ventana de
    // "mes anterior" (30-60 días atrás) quedaba fuera de ese filtro y siempre daba 0,
    // o coincidía con el filtro y daba una comparación sin sentido. Por eso la variación
    // salía en +0% en todos los períodos.
    const trend = buildAnalyticsWhere(tenant.id, req.query, { skipDateFilter: true });
    const { rows: trendRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE fecha_registro >= NOW() - INTERVAL '30 days')           AS nuevos_mes,
        COUNT(*) FILTER (WHERE fecha_registro >= NOW() - INTERVAL '60 days'
                           AND fecha_registro <  NOW() - INTERVAL '30 days')           AS nuevos_mes_ant
      FROM prospectos WHERE ${trend.where}
    `, trend.values);
    res.json({ ...rows[0], ...trendRows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/por-tiempo', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(fecha_registro, 'YYYY-MM-DD') AS dia,
        TO_CHAR(fecha_registro, 'DD Mon')     AS label,
        COUNT(*)                               AS total,
        COALESCE(SUM(presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos
      WHERE ${where}
      GROUP BY 1, 2 ORDER BY 1
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/por-proyecto', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values, proyecto } = buildAnalyticsWhere(tenant.id, req.query);
    let proyectoFilter = '';
    if (proyecto) { values.push(proyecto); proyectoFilter = `AND p_elem = $${values.length}`; }
    const { rows } = await pool.query(`
      SELECT p_elem AS proyecto, COUNT(*) AS total,
             COALESCE(SUM(pr.presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos pr,
           jsonb_array_elements_text(
             ${PROYECTOS_JSONB}
           ) AS p_elem
      WHERE ${where} ${proyectoFilter}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/funnel', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const ORDER = `CASE estado
      WHEN 'Post-venta'       THEN 1
      WHEN 'Cierre'           THEN 2
      WHEN 'Negociación'      THEN 3
      WHEN 'Presentación'     THEN 4
      WHEN 'Calificado'       THEN 5
      WHEN 'Contacto Inicial' THEN 6
      ELSE 7 END`;
    const { rows } = await pool.query(`
      SELECT estado, COUNT(*) AS total,
             COALESCE(SUM(presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos WHERE ${where}
      GROUP BY estado ORDER BY ${ORDER}
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/por-canal', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const { rows } = await pool.query(`
      SELECT COALESCE(canal, 'Sin canal') AS canal, COUNT(*) AS total
      FROM prospectos WHERE ${where}
      GROUP BY 1 ORDER BY 2 DESC
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/por-broker', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const { rows } = await pool.query(`
      SELECT
        COALESCE(broker_asignado, 'Sin asignar') AS broker,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado IN ('Calificado','Negociación','Cierre','Post-venta')) AS calificados,
        COUNT(*) FILTER (WHERE estado IN ('Cierre','Post-venta')) AS cerrados,
        COALESCE(SUM(presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos WHERE ${where}
      GROUP BY 1 ORDER BY 2 DESC
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Broker × período (semana/mes/trimestre)
app.get('/api/analytics/broker-tiempo', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const agrup = req.query.agrup || 'mes';
    const trunc = agrup === 'semana' ? 'week' : agrup === 'trimestre' ? 'quarter' : 'month';
    const fmt   = agrup === 'semana' ? 'IYYY-"W"IW' : agrup === 'trimestre' ? 'YYYY-"Q"Q' : 'YYYY-MM';
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('${trunc}', fecha_registro), '${fmt}') AS periodo,
        COALESCE(broker_asignado, 'Sin asignar') AS broker,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado IN ('Cierre','Post-venta')) AS cerrados,
        COALESCE(SUM(presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos WHERE ${where}
      GROUP BY 1, 2 ORDER BY 1, 3 DESC
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Proyecto × período
app.get('/api/analytics/proyecto-tiempo', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const agrup = req.query.agrup || 'mes';
    const trunc = agrup === 'semana' ? 'week' : agrup === 'trimestre' ? 'quarter' : 'month';
    const fmt   = agrup === 'semana' ? 'IYYY-"W"IW' : agrup === 'trimestre' ? 'YYYY-"Q"Q' : 'YYYY-MM';
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('${trunc}', fecha_registro), '${fmt}') AS periodo,
        p_elem AS proyecto,
        COUNT(*) AS total,
        COALESCE(SUM(pr.presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos pr,
           jsonb_array_elements_text(
             ${PROYECTOS_JSONB}
           ) AS p_elem
      WHERE ${where}
      GROUP BY 1, 2 ORDER BY 1, 3 DESC
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tasa de conversión por canal
app.get('/api/analytics/conversion-canal', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const { rows } = await pool.query(`
      SELECT
        COALESCE(canal, 'Sin canal') AS canal,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado IN ('Calificado','Negociación','Cierre','Post-venta')) AS calificados,
        COUNT(*) FILTER (WHERE estado IN ('Cierre','Post-venta')) AS cerrados,
        ROUND(COUNT(*) FILTER (WHERE estado IN ('Calificado','Negociación','Cierre','Post-venta'))::numeric / NULLIF(COUNT(*),0) * 100, 1) AS tasa_calif,
        ROUND(COUNT(*) FILTER (WHERE estado IN ('Cierre','Post-venta'))::numeric / NULLIF(COUNT(*),0) * 100, 1) AS tasa_cierre
      FROM prospectos WHERE ${where}
      GROUP BY 1 ORDER BY 2 DESC
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Velocidad de cierre: días reales que cada prospecto permaneció en cada etapa,
// reconstruidos a partir de su historial de movimientos (moveStage), no de la fecha
// de registro. fecha_registro solo marca el inicio de la PRIMERA etapa (Contacto
// Inicial); para las siguientes, la fecha de entrada real es la del historial.
const FUNNEL_STAGE_NAMES = ['Contacto Inicial','Calificación','Presentación','Negociación','Cierre','Post-venta','Lead Frío','Perdido'];
app.get('/api/analytics/velocidad', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const { rows } = await pool.query(`
      SELECT id, estado, fecha_registro, historial
      FROM prospectos WHERE ${where} AND estado IS NOT NULL
    `, values);

    // Por etapa: duraciones completadas (transición real de entrada → salida) más, para
    // la etapa donde el prospecto está HOY, el tiempo transcurrido desde que entró (abierta).
    const durations = {}; // estado -> number[] días
    const push = (estado, dias) => {
      if (!Number.isFinite(dias) || dias < 0) return;
      (durations[estado] = durations[estado] || []).push(dias);
    };

    for (const p of rows) {
      let historial = [];
      try { historial = Array.isArray(p.historial) ? p.historial : JSON.parse(p.historial || '[]'); } catch (_) { historial = []; }

      // Transiciones reales: entradas de historial cuya "accion" es un nombre de etapa válido
      // (así es como moveStage() las registra), ordenadas cronológicamente.
      const transiciones = historial
        .filter(h => h && FUNNEL_STAGE_NAMES.includes(h.accion) && h.fecha)
        .map(h => ({ estado: h.accion, fecha: new Date(h.fecha) }))
        .filter(t => !isNaN(t.fecha.getTime()))
        .sort((a, b) => a.fecha - b.fecha);

      // Punto de partida: fecha_registro marca la entrada a Contacto Inicial (o al primer
      // estado conocido del prospecto, si el registro empezó en otra etapa).
      const secuencia = [{ estado: 'Contacto Inicial', fecha: new Date(p.fecha_registro) }, ...transiciones]
        .filter(t => !isNaN(t.fecha?.getTime?.()));

      for (let i = 0; i < secuencia.length; i++) {
        const actual = secuencia[i];
        const siguiente = secuencia[i + 1];
        const fin = siguiente ? siguiente.fecha : new Date(); // etapa abierta: hasta hoy
        const dias = (fin - actual.fecha) / 86400000;
        push(actual.estado, dias);
      }
    }

    const result = Object.keys(durations).map(estado => {
      const arr = durations[estado];
      const total = arr.length;
      const suma = arr.reduce((s, d) => s + d, 0);
      return {
        estado,
        total,
        dias_en_estado: Number((suma / total).toFixed(1)),
        dias_min: Math.round(Math.min(...arr)),
        dias_max: Math.round(Math.max(...arr)),
      };
    });

    const orden = { 'Contacto Inicial':1,'Calificación':2,'Presentación':3,'Negociación':4,'Cierre':5,'Post-venta':6,'Lead Frío':7,'Perdido':8 };
    result.sort((a, b) => (orden[a.estado] || 99) - (orden[b.estado] || 99));

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Drilldown: lista de prospectos que cumplen los filtros activos
app.get('/api/analytics/prospectos-detalle', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { where, values } = buildAnalyticsWhere(tenant.id, req.query);
    const { rows } = await pool.query(`
      SELECT id, nombre, apellido, correo, telefono, estado, canal,
             COALESCE(broker_asignado, 'Sin asignar') AS broker_asignado,
             proyectos_interes, presupuesto_usd, fecha_registro
      FROM prospectos WHERE ${where}
      ORDER BY fecha_registro DESC LIMIT 200
    `, values);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Listas para filtros desplegables
app.get('/api/analytics/filtros', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const [canales, brokers, proyectos] = await Promise.all([
      pool.query(`SELECT DISTINCT COALESCE(canal,'Sin canal') AS v FROM prospectos WHERE tenant_id=$1 ORDER BY 1`, [tenant.id]),
      pool.query(`SELECT DISTINCT broker_asignado AS v FROM prospectos WHERE tenant_id=$1 AND broker_asignado IS NOT NULL ORDER BY 1`, [tenant.id]),
      pool.query(`
        SELECT DISTINCT v FROM (
          SELECT p_elem AS v FROM prospectos, jsonb_array_elements_text(${PROYECTOS_JSONB}) p_elem WHERE tenant_id=$1
          UNION
          SELECT data->>'name' AS v FROM projects WHERE tenant_id=$1 AND data->>'name' IS NOT NULL
        ) t WHERE v IS NOT NULL AND v <> '' ORDER BY 1
      `, [tenant.id]),
    ]);
    res.json({
      canales:   canales.rows.map(r => r.v),
      brokers:   brokers.rows.map(r => r.v),
      proyectos: proyectos.rows.map(r => r.v),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// FASE F: CASOS / POSTVENTA
// ==========================================

// Auto-crear tabla casos si no existe
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS casos (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        prospecto_id INTEGER REFERENCES prospectos(id) ON DELETE SET NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT DEFAULT '',
        tipo TEXT DEFAULT 'consulta',
        prioridad TEXT DEFAULT 'normal',
        estado TEXT DEFAULT 'abierto',
        asignado_a TEXT,
        notas TEXT DEFAULT '',
        actividades JSONB DEFAULT '[]',
        fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
        fecha_cierre TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('casos table check:', e.message); }
  // Migración: agregar columna actividades si no existe
  try {
    await pool.query(`ALTER TABLE casos ADD COLUMN IF NOT EXISTS actividades JSONB DEFAULT '[]'`);
  } catch (e) { /* columna ya existe */ }
})();

app.get('/api/casos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { estado, prioridad, tipo, prospecto_id } = req.query;
    const conds = ['c.tenant_id = $1'];
    const vals = [tenant.id];
    if (estado)        { vals.push(estado);        conds.push(`c.estado = $${vals.length}`); }
    if (prioridad)     { vals.push(prioridad);      conds.push(`c.prioridad = $${vals.length}`); }
    if (tipo)          { vals.push(tipo);           conds.push(`c.tipo = $${vals.length}`); }
    if (prospecto_id)  { vals.push(prospecto_id);   conds.push(`c.prospecto_id = $${vals.length}`); }
    const { rows } = await pool.query(`
      SELECT c.*,
             p.nombre || ' ' || p.apellido AS prospecto_nombre,
             p.correo AS prospecto_correo,
             p.estado AS prospecto_estado
      FROM casos c
      LEFT JOIN prospectos p ON p.id = c.prospecto_id
      WHERE ${conds.join(' AND ')}
      ORDER BY
        CASE c.prioridad WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
        c.fecha_apertura DESC
    `, vals);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/casos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { prospecto_id, titulo, descripcion, tipo, prioridad, asignado_a, notas } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO casos (tenant_id, prospecto_id, titulo, descripcion, tipo, prioridad, asignado_a, notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [tenant.id, prospecto_id || null, titulo, descripcion || '', tipo || 'consulta',
        prioridad || 'normal', asignado_a || null, notas || '']);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/casos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { titulo, descripcion, tipo, prioridad, estado, asignado_a, notas, actividades } = req.body;
    const fechaCierre = estado === 'cerrado' ? 'NOW()' : 'fecha_cierre';
    const { rows } = await pool.query(`
      UPDATE casos SET
        titulo=$2, descripcion=$3, tipo=$4, prioridad=$5,
        estado=$6, asignado_a=$7, notas=$8, actividades=$9,
        fecha_cierre=${fechaCierre}, updated_at=NOW()
      WHERE id=$1 AND tenant_id=$10 RETURNING *
    `, [req.params.id, titulo, descripcion || '', tipo, prioridad, estado, asignado_a || null, notas || '',
        JSON.stringify(actividades || []), tenant.id]);
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/casos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    await pool.query('DELETE FROM casos WHERE id=$1 AND tenant_id=$2', [req.params.id, tenant.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/casos/stats', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado='abierto') AS abiertos,
        COUNT(*) FILTER (WHERE estado='en_gestion') AS en_gestion,
        COUNT(*) FILTER (WHERE estado='resuelto') AS resueltos,
        COUNT(*) FILTER (WHERE estado='cerrado') AS cerrados,
        COUNT(*) FILTER (WHERE prioridad='urgente' AND estado NOT IN ('cerrado','resuelto')) AS urgentes,
        AVG(EXTRACT(EPOCH FROM (COALESCE(fecha_cierre,NOW()) - fecha_apertura))/3600)
          FILTER (WHERE estado IN ('resuelto','cerrado')) AS avg_horas_resolucion
      FROM casos WHERE tenant_id=$1
    `, [tenant.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auto-crear tabla citas si no existe
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS citas (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        prospecto_id INTEGER REFERENCES prospectos(id) ON DELETE SET NULL,
        prospecto_email TEXT,
        prospecto_nombre TEXT,
        proyecto TEXT,
        fecha DATE NOT NULL,
        hora TEXT NOT NULL,
        canal TEXT,
        notas TEXT DEFAULT '',
        estado TEXT DEFAULT 'pendiente',
        fuente TEXT DEFAULT 'landing_contact_form',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('citas table check:', e.message); }
})();

app.get('/api/citas', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { estado, prospecto_id } = req.query;
    const conds = ['tenant_id = $1'];
    const vals = [tenant.id];
    if (estado)       { vals.push(estado);       conds.push(`estado = $${vals.length}`); }
    if (prospecto_id) { vals.push(prospecto_id); conds.push(`prospecto_id = $${vals.length}`); }
    const { rows } = await pool.query(`
      SELECT * FROM citas WHERE ${conds.join(' AND ')} ORDER BY fecha ASC, hora ASC
    `, vals);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/citas', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { prospecto_email, prospecto_nombre, proyecto, fecha, hora, canal, notas } = req.body;
    if (!fecha || !hora) return res.status(400).json({ error: 'fecha y hora son requeridas' });

    let prospecto_id = null;
    if (prospecto_email) {
      const { rows: pRows } = await pool.query(
        'SELECT id FROM prospectos WHERE correo = $1 AND tenant_id = $2 LIMIT 1',
        [prospecto_email, tenant.id]
      );
      if (pRows[0]) prospecto_id = pRows[0].id;
    }

    const { rows } = await pool.query(`
      INSERT INTO citas (tenant_id, prospecto_id, prospecto_email, prospecto_nombre, proyecto, fecha, hora, canal, notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [tenant.id, prospecto_id, prospecto_email || null, prospecto_nombre || null,
        proyecto || null, fecha, hora, canal || null, notas || '']);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { fecha, hora, estado, notas } = req.body;
    const { rows } = await pool.query(`
      UPDATE citas SET
        fecha=COALESCE($3,fecha), hora=COALESCE($4,hora),
        estado=COALESCE($5,estado), notas=COALESCE($6,notas),
        updated_at=NOW()
      WHERE id=$1 AND tenant_id=$2 RETURNING *
    `, [req.params.id, tenant.id, fecha || null, hora || null, estado || null, notas || null]);
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Antes no existía forma de cancelar/eliminar una cita — la Agenda de Brokers las
// mostraba fijas, sin ningún control de edición o cancelación.
app.delete('/api/citas/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    await pool.query('DELETE FROM citas WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// CARTERA — persistencia backend + portal de cliente
// ==========================================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashVerify = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashVerify, 'hex'));
}
function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex');
}
const soloFecha = (v) => v ? String(v).split('T')[0] : v;
const CARTERA_SAFE_FIELDS = (c) => ({
  id: c.id, prospecto_nombre: c.prospecto_nombre, proyecto: c.proyecto, unidad: c.unidad,
  precio_total: Number(c.precio_total), moneda: c.moneda, fecha_separacion: soloFecha(c.fecha_separacion),
  fecha_escritura: soloFecha(c.fecha_escritura), fecha_entrega: soloFecha(c.fecha_entrega), modalidad: c.modalidad,
  riesgo: c.riesgo, arquetipo: c.arquetipo, cuotas: c.cuotas, historial: c.historial,
  password_es_temporal: !!c.portal_password_temp,
});

// Auto-crear tabla carteras si no existe
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS carteras (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        prospecto_id INTEGER REFERENCES prospectos(id) ON DELETE SET NULL,
        prospecto_nombre TEXT,
        proyecto TEXT,
        unidad TEXT,
        precio_total NUMERIC DEFAULT 0,
        moneda TEXT DEFAULT 'USD',
        fecha_separacion DATE,
        fecha_escritura DATE,
        fecha_entrega DATE,
        modalidad TEXT DEFAULT 'contado',
        riesgo TEXT DEFAULT 'verde',
        responsable TEXT,
        notas_internas TEXT,
        arquetipo TEXT,
        cuotas JSONB DEFAULT '[]',
        historial JSONB DEFAULT '[]',
        portal_password_hash TEXT,
        portal_password_temp TEXT,
        portal_session_token TEXT,
        portal_session_expires TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('carteras table check:', e.message); }
})();

// Eventos Comerciales (cenas, seminarios, lanzamientos) — antes solo vivían en
// localStorage del navegador (glp_agenda_events), por lo que el Dashboard (que lee la
// próxima cita real desde la tabla `citas` en Postgres) y el módulo Eventos (que leía
// solo el localStorage local) podían mostrar información distinta o el módulo vacío
// en un navegador/perfil nuevo. Se persisten aquí igual que carteras/legal_docs.
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eventos_comerciales (
        id BIGINT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        titulo TEXT,
        venue TEXT,
        fecha DATE,
        proyectos_presentados JSONB DEFAULT '[]',
        asistentes JSONB DEFAULT '[]',
        prospect_ids JSONB DEFAULT '[]',
        proyectos_interes JSONB DEFAULT '[]',
        presupuesto_asignado NUMERIC DEFAULT 0,
        presupuesto_ejecutado NUMERIC DEFAULT 0,
        items_costo JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Semilla de demostración (mismos 2 eventos que antes solo vivían en localStorage)
    // para que el módulo no aparezca vacío al migrar a Postgres como fuente de verdad.
    await pool.query(`
      INSERT INTO eventos_comerciales (id, tenant_id, titulo, venue, fecha, proyectos_presentados, asistentes, proyectos_interes, presupuesto_asignado, presupuesto_ejecutado, items_costo)
      VALUES
        (1, 'tenant-glp-001', 'GLP Investment Evening #1', 'Club El Nogal, Bogotá', '2026-05-10',
          '["Ocean Reef Park","The Palms","Panamáa Viejo Residences","The Tides – Playa Caracol"]',
          '["Carlos Gutiérrez","María Isabel Rodríguez","Andrés Felipe Martínez"]',
          '["Ocean Reef Park","The Palms","Panamáa Viejo Residences"]', 15000, 12800,
          '[{"concepto":"Salón y montaje","valor":4500},{"concepto":"Catering premium (60 pax)","valor":3600},{"concepto":"Audiovisual y pantallas","valor":1800},{"concepto":"Material impreso y brochures","valor":1200},{"concepto":"Vinos y bebidas premium","valor":1200},{"concepto":"Fotografía y video","valor":500}]'),
        (2, 'tenant-glp-001', 'Seminario Inversión Dolarizada', 'Hotel JW Marriott Bogotá', '2026-07-15',
          '["Oceana Residences & Skyhomes","Bosco di Santa María","Ipanema Panamá","Surfside"]',
          '["Laura Sánchez","Roberto Castaño"]',
          '["Oceana Residences & Skyhomes","Surfside"]', 20000, 8500,
          '[{"concepto":"Salón conferencias (100 pax)","valor":5500},{"concepto":"Coffee break y almuerzo","valor":4200},{"concepto":"Speaker internacional (viáticos)","valor":3500},{"concepto":"Material técnico impreso","valor":1500},{"concepto":"Publicidad digital pre-evento","valor":2800},{"concepto":"Señalización y decoración","valor":1000},{"concepto":"Registro y tecnología","valor":1500}]')
      ON CONFLICT (id) DO NOTHING
    `);
  } catch (e) { console.warn('eventos_comerciales table check:', e.message); }
})();

app.get('/api/eventos-comerciales', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      'SELECT * FROM eventos_comerciales WHERE tenant_id = $1 ORDER BY fecha DESC',
      [tenant.id]
    );
    res.json(rows.map(r => ({
      id: Number(r.id), categoria: 'comercial', titulo: r.titulo, venue: r.venue,
      fecha: fmtDateOnly(r.fecha), proyectos_presentados: r.proyectos_presentados || [],
      asistentes: r.asistentes || [], prospect_ids: r.prospect_ids || [],
      proyectos_interes: r.proyectos_interes || [], presupuesto_asignado: Number(r.presupuesto_asignado || 0),
      presupuesto_ejecutado: Number(r.presupuesto_ejecutado || 0), items_costo: r.items_costo || [],
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/eventos-comerciales', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const ev = req.body;
    const { rows } = await pool.query(`
      INSERT INTO eventos_comerciales (
        id, tenant_id, titulo, venue, fecha, proyectos_presentados, asistentes,
        prospect_ids, proyectos_interes, presupuesto_asignado, presupuesto_ejecutado, items_costo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        titulo=$3, venue=$4, fecha=$5, proyectos_presentados=$6, asistentes=$7,
        prospect_ids=$8, proyectos_interes=$9, presupuesto_asignado=$10,
        presupuesto_ejecutado=$11, items_costo=$12, updated_at=NOW()
      RETURNING *
    `, [
      ev.id, tenant.id, ev.titulo || '', ev.venue || '', ev.fecha || null,
      JSON.stringify(ev.proyectos_presentados || []), JSON.stringify(ev.asistentes || []),
      JSON.stringify(ev.prospect_ids || []), JSON.stringify(ev.proyectos_interes || []),
      ev.presupuesto_asignado || 0, ev.presupuesto_ejecutado || 0, JSON.stringify(ev.items_costo || []),
    ]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/eventos-comerciales/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM eventos_comerciales WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/carteras', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { rows } = await pool.query(
      `SELECT id, tenant_id, prospecto_id, prospecto_nombre, proyecto, unidad, precio_total, moneda,
              fecha_separacion, fecha_escritura, fecha_entrega, modalidad, riesgo, responsable,
              notas_internas, arquetipo, cuotas, historial, portal_password_temp, created_at, updated_at
       FROM carteras WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenant.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/carteras', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const c = req.body;
    const tempPassword = generateTempPassword();
    let prospectoId = c.prospectId || null;
    if (prospectoId) {
      const { rows: pRows } = await pool.query('SELECT id FROM prospectos WHERE id = $1', [prospectoId]);
      if (!pRows[0]) prospectoId = null; // referencia a un prospecto que no existe en este backend (ej. datos demo)
    }
    const { rows } = await pool.query(`
      INSERT INTO carteras (
        id, tenant_id, prospecto_id, prospecto_nombre, proyecto, unidad, precio_total, moneda,
        fecha_separacion, fecha_escritura, fecha_entrega, modalidad, riesgo, responsable,
        notas_internas, arquetipo, cuotas, historial, portal_password_hash, portal_password_temp
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (id) DO UPDATE SET
        prospecto_id=$3, prospecto_nombre=$4, proyecto=$5, unidad=$6, precio_total=$7, moneda=$8,
        fecha_separacion=$9, fecha_escritura=$10, fecha_entrega=$11, modalidad=$12, riesgo=$13,
        responsable=$14, notas_internas=$15, arquetipo=$16, cuotas=$17, historial=$18, updated_at=NOW()
      RETURNING *
    `, [
      c.id, tenant.id, prospectoId, c.prospectName || '', c.proyecto || '', c.unidad || '',
      c.precio_total || 0, c.moneda || 'USD', c.fecha_separacion || null, c.fecha_escritura || null,
      c.fecha_entrega || null, c.modalidad || 'contado', c.riesgo || 'verde', c.responsable || null,
      c.notas_internas || null, c.arquetipo || null, JSON.stringify(c.cuotas || []),
      JSON.stringify(c.historial || []), hashPassword(tempPassword), tempPassword,
    ]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/carteras/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const c = req.body;
    let prospectoId = c.prospectId || null;
    if (prospectoId) {
      const { rows: pRows } = await pool.query('SELECT id FROM prospectos WHERE id = $1', [prospectoId]);
      if (!pRows[0]) prospectoId = null;
    }
    const { rows } = await pool.query(`
      UPDATE carteras SET
        prospecto_id=$3, prospecto_nombre=$4, proyecto=$5, unidad=$6, precio_total=$7, moneda=$8,
        fecha_separacion=$9, fecha_escritura=$10, fecha_entrega=$11, modalidad=$12, riesgo=$13,
        responsable=$14, notas_internas=$15, arquetipo=$16, cuotas=$17, historial=$18, updated_at=NOW()
      WHERE id=$1 AND tenant_id=$2 RETURNING *
    `, [
      req.params.id, tenant.id, prospectoId, c.prospectName || '', c.proyecto || '', c.unidad || '',
      c.precio_total || 0, c.moneda || 'USD', c.fecha_separacion || null, c.fecha_escritura || null,
      c.fecha_entrega || null, c.modalidad || 'contado', c.riesgo || 'verde', c.responsable || null,
      c.notas_internas || null, c.arquetipo || null, JSON.stringify(c.cuotas || []),
      JSON.stringify(c.historial || []),
    ]);
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/carteras/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    await pool.query('DELETE FROM carteras WHERE id=$1 AND tenant_id=$2', [req.params.id, tenant.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Portal de cliente ──────────────────────────────────────────
app.post('/api/portal/login', async (req, res) => {
  try {
    const { correo, password } = req.body;
    if (!correo || !password) return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
    const { rows } = await pool.query(`
      SELECT c.* FROM carteras c
      JOIN prospectos p ON p.id = c.prospecto_id
      WHERE LOWER(p.correo) = LOWER($1)
      ORDER BY c.created_at DESC LIMIT 1
    `, [correo]);
    const cartera = rows[0];
    if (!cartera || !verifyPassword(password, cartera.portal_password_hash)) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 24 * 3600 * 1000);
    await pool.query(
      'UPDATE carteras SET portal_session_token=$1, portal_session_expires=$2 WHERE id=$3',
      [token, expires, cartera.id]
    );
    res.json({ token, cartera: CARTERA_SAFE_FIELDS(cartera) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/portal/me', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token requerido.' });
    const { rows } = await pool.query(
      'SELECT * FROM carteras WHERE portal_session_token = $1 AND portal_session_expires > NOW()',
      [token]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    res.json(CARTERA_SAFE_FIELDS(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/portal/cambiar-password', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const { passwordActual, passwordNueva } = req.body;
    if (!token || !passwordActual || !passwordNueva) return res.status(400).json({ error: 'Datos incompletos.' });
    const { rows } = await pool.query(
      'SELECT * FROM carteras WHERE portal_session_token = $1 AND portal_session_expires > NOW()',
      [token]
    );
    const cartera = rows[0];
    if (!cartera || !verifyPassword(passwordActual, cartera.portal_password_hash)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
    }
    await pool.query(
      'UPDATE carteras SET portal_password_hash=$1, portal_password_temp=NULL WHERE id=$2',
      [hashPassword(passwordNueva), cartera.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Regenera la contraseña temporal de un cliente del portal (uso administrativo desde
// Configuración → Portal Clientes) — invalida la sesión activa por seguridad.
app.post('/api/carteras/:id/reset-password', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const tempPassword = generateTempPassword();
    const { rows } = await pool.query(
      `UPDATE carteras SET portal_password_hash=$1, portal_password_temp=$2, portal_session_token=NULL, portal_session_expires=NULL
       WHERE id=$3 AND tenant_id=$4 RETURNING id`,
      [hashPassword(tempPassword), tempPassword, req.params.id, tenant.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ tempPassword });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trámites del cliente para el portal — mismo esquema de auth por token que /api/portal/me,
// pero solo expone campos seguros (status, fecha límite, resumen en lenguaje claro).
// Nunca expone notas internas, responsable ni historial de gestión.
app.get('/api/portal/legal', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token requerido.' });
    const { rows: carteraRows } = await pool.query(
      'SELECT * FROM carteras WHERE portal_session_token = $1 AND portal_session_expires > NOW()',
      [token]
    );
    const cartera = carteraRows[0];
    if (!cartera || !cartera.prospecto_id) return res.status(401).json({ error: 'Sesión inválida o expirada.' });

    const { rows: docs } = await pool.query(
      'SELECT doc_key, status, due_date FROM legal_docs WHERE tenant_id = $1 AND prospecto_id = $2',
      [cartera.tenant_id, cartera.prospecto_id]
    );
    const docsSafe = docs.map(d => ({
      docKey: d.doc_key,
      label: LEGAL_DOC_LABELS[d.doc_key] || d.doc_key,
      status: d.status,
      dueDate: fmtDateOnly(d.due_date),
    }));

    let resumen = 'Aún no hay documentos de trámite registrados para este cliente.';
    if (docs.length > 0) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        try {
          const estadoTexto = docs.map(d => `- ${LEGAL_DOC_LABELS[d.doc_key] || d.doc_key}: ${d.status}${d.due_date ? ` (fecha límite: ${fmtDateOnly(d.due_date)})` : ''}`).join('\n');
          const OpenAI = require('openai');
          const openai = new OpenAI({ apiKey });
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: `Eres el asistente legal de GLP Wealth Management. Con este listado de documentos del trámite de compra de un cliente, escribe un párrafo corto (máx 4 líneas) en español sencillo, SIN jerga notarial/legal, que le explique al cliente en qué va su trámite y qué sigue. Tono cálido y claro.\n\nEstado de documentos:\n${estadoTexto}\n\nResponde solo con el párrafo, sin encabezados ni JSON.` }],
            temperature: 0.5,
            max_tokens: 200,
          });
          resumen = response.choices[0].message.content.trim();
        } catch { /* si falla la IA, se muestra solo el timeline sin resumen */ }
      }
    }

    res.json({ docs: docsSafe, resumen });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// WHATSAPP — Omnicanal (Meta Cloud API)
// ==========================================

// Auto-crear tabla whatsapp_messages si no existe
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        prospecto_id INTEGER REFERENCES prospectos(id) ON DELETE SET NULL,
        telefono TEXT NOT NULL,
        direccion TEXT NOT NULL, -- 'in' | 'out'
        texto TEXT NOT NULL,
        estado TEXT DEFAULT 'recibido',
        wa_message_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('whatsapp_messages table check:', e.message); }
})();

// Verificación del webhook — Meta llama esto una vez al conectar la app.
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Recepción de mensajes entrantes (formato Meta Cloud API webhook payload).
app.post('/webhook/whatsapp', async (req, res) => {
  // Responder rápido — Meta reintenta si no hay 200 en pocos segundos.
  res.sendStatus(200);
  try {
    const tenant = await resolveTenant(req);
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message || message.type !== 'text') return; // ignora status updates, no-text, etc.

    const telefono = message.from;
    const texto = message.text?.body || '';
    const waMessageId = message.id;
    const nombre = change?.contacts?.[0]?.profile?.name || 'Prospecto WhatsApp';

    await processIncomingMessage(tenant.id, { telefono, nombre, texto, waMessageId });
  } catch (e) {
    console.error('[WhatsApp] Error procesando webhook:', e.message);
  }
});

// Historial de mensajes de WhatsApp de un prospecto (para hidratar el CRM).
app.get('/api/whatsapp/:prospectoId', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { rows } = await pool.query(
      'SELECT * FROM whatsapp_messages WHERE prospecto_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
      [req.params.prospectoId, tenant.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// LEGAL & CIERRE — Trámites (persistencia backend)
// ==========================================

// Auto-crear tabla legal_docs si no existe
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS legal_docs (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        prospecto_id INTEGER NOT NULL REFERENCES prospectos(id) ON DELETE CASCADE,
        doc_key TEXT NOT NULL,
        status TEXT DEFAULT 'pendiente',
        attached_name TEXT,
        attached_url TEXT,
        attached_date DATE,
        notes TEXT,
        signers JSONB DEFAULT '[]',
        sign_link TEXT,
        sign_sent_date DATE,
        sign_sent_by TEXT,
        due_date DATE,
        responsable TEXT,
        history JSONB DEFAULT '[]',
        docusign_envelope_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (tenant_id, prospecto_id, doc_key)
      )
    `);
  } catch (e) { console.warn('legal_docs table check:', e.message); }
})();

const soloFechaLegal = fmtDateOnly;
const legalRowToMeta = (r) => ({
  status: r.status, attachedName: r.attached_name, attachedUrl: r.attached_url,
  attachedDate: soloFechaLegal(r.attached_date), notes: r.notes, signers: r.signers || [],
  signLink: r.sign_link, signSentDate: soloFechaLegal(r.sign_sent_date), signSentBy: r.sign_sent_by,
  dueDate: soloFechaLegal(r.due_date), responsable: r.responsable, history: r.history || [],
  docusignEnvelopeId: r.docusign_envelope_id,
});

// Todos los documentos legales del tenant, agrupados por prospecto (para hidratar el CRM).
app.get('/api/legal-docs', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { rows } = await pool.query('SELECT * FROM legal_docs WHERE tenant_id = $1', [tenant.id]);
    const grouped = {};
    rows.forEach(r => {
      grouped[r.prospecto_id] = grouped[r.prospecto_id] || {};
      grouped[r.prospecto_id][r.doc_key] = legalRowToMeta(r);
    });
    res.json(grouped);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Documentos legales de un solo prospecto.
app.get('/api/legal-docs/:prospectoId', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { rows } = await pool.query(
      'SELECT * FROM legal_docs WHERE prospecto_id = $1 AND tenant_id = $2',
      [req.params.prospectoId, tenant.id]
    );
    const doc = {};
    rows.forEach(r => { doc[r.doc_key] = legalRowToMeta(r); });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Upsert de un documento legal individual.
app.put('/api/legal-docs/:prospectoId/:docKey', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const m = req.body;
    const { rows } = await pool.query(`
      INSERT INTO legal_docs (
        tenant_id, prospecto_id, doc_key, status, attached_name, attached_url, attached_date,
        notes, signers, sign_link, sign_sent_date, sign_sent_by, due_date, responsable, history,
        docusign_envelope_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (tenant_id, prospecto_id, doc_key) DO UPDATE SET
        status=$4, attached_name=$5, attached_url=$6, attached_date=$7, notes=$8, signers=$9,
        sign_link=$10, sign_sent_date=$11, sign_sent_by=$12, due_date=$13, responsable=$14,
        history=$15, docusign_envelope_id=$16, updated_at=NOW()
      RETURNING *
    `, [
      tenant.id, req.params.prospectoId, req.params.docKey, m.status || 'pendiente',
      m.attachedName || null, m.attachedUrl || null, m.attachedDate || null, m.notes || null,
      JSON.stringify(m.signers || []), m.signLink || null, m.signSentDate || null, m.signSentBy || null,
      m.dueDate || null, m.responsable || null, JSON.stringify(m.history || []), m.docusignEnvelopeId || null,
    ]);
    res.json(legalRowToMeta(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mismo catálogo de documentos que PHASES en CRMDashboard.tsx (~17379-17409) y
// legalAlertMonitor.js — duplicado porque el backend no puede importar del frontend.
const LEGAL_DOC_LABELS = {
  carta_reserva: 'Carta de Reserva', pago_separacion: 'Comprobante de Pago Separación',
  due_diligence: 'Due Diligence Inicial (Identidad)', propuesta_comercial: 'Propuesta Comercial Firmada',
  promesa_compraventa: 'Promesa de Compraventa', cert_tradicion: 'Certificado de Tradición y Libertad',
  estudio_titulo: 'Estudio de Títulos', paz_salvo: 'Paz y Salvo Administración',
  poder_notarial: 'Poder Notarial (si aplica)', escritura_publica: 'Escritura Pública Notariada',
  registro_rph: 'Registro en Registro Público', dian_documentos: 'Declaración DIAN / OFAC',
  acta_entrega: 'Acta de Entrega del Inmueble', llaves: 'Entrega de Llaves y Manuales',
};

// Resumen del trámite en lenguaje claro (sin jerga notarial) — mismo patrón tenant-aware
// de /api/chat (~787-834): usado tanto por el CRM (renderLegal) como por el portal cliente.
app.post('/api/legal/resumen/:prospectoId', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado.' });

    const { rows } = await pool.query(
      'SELECT * FROM legal_docs WHERE tenant_id = $1 AND prospecto_id = $2',
      [tenant.id, req.params.prospectoId]
    );
    if (rows.length === 0) return res.json({ resumen: 'Aún no hay documentos de trámite registrados para este cliente.' });

    const estadoTexto = rows.map(r => {
      const label = LEGAL_DOC_LABELS[r.doc_key] || r.doc_key;
      const dueTxt = r.due_date ? `, fecha límite: ${fmtDateOnly(r.due_date)}` : '';
      const respTxt = r.responsable ? `, responsable: ${r.responsable}` : ', responsable: sin asignar';
      return `- ${label}: ${r.status}${dueTxt}${respTxt}`;
    }).join('\n');
    // El siguiente documento pendiente en orden de fases es el "próximo paso" real del
    // trámite — se lo pasamos explícito al modelo para que no tenga que inferirlo (y para
    // que el resumen no se quede en "vas bien, ánimo" sin decir qué sigue ni quién lo hace).
    const ordenFases = ['carta_reserva','pago_separacion','due_diligence','propuesta_comercial','promesa_compraventa','cert_tradicion','estudio_titulo','paz_salvo','poder_notarial','escritura_publica','registro_rph','dian_documentos','acta_entrega','llaves'];
    const porClave = Object.fromEntries(rows.map(r => [r.doc_key, r]));
    const siguienteKey = ordenFases.find(k => porClave[k] && !['firmado','archivado'].includes(porClave[k].status));
    const siguiente = siguienteKey ? porClave[siguienteKey] : null;
    const siguienteTexto = siguiente
      ? `${LEGAL_DOC_LABELS[siguienteKey] || siguienteKey} — responsable: ${siguiente.responsable || 'sin asignar'}${siguiente.due_date ? `, fecha límite: ${fmtDateOnly(siguiente.due_date)}` : ' (sin fecha límite asignada)'}`
      : 'No hay documentos pendientes — trámite completo.';

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres el asistente legal de GLP Wealth Management. Con este listado de documentos del trámite de compra de un cliente, escribe un párrafo corto (máx 4 líneas) en español sencillo, SIN jerga notarial/legal, que sea ÚTIL PARA DECIDIR el próximo paso — no una felicitación genérica. Debe mencionar SIEMPRE, en este orden: (1) qué fase está completa, (2) cuál es el único próximo documento pendiente por avanzar, (3) quién es el responsable de ese documento (si dice "sin asignar", dilo explícitamente en vez de omitirlo), (4) la fecha límite si existe (si no existe, dilo explícitamente en vez de omitirlo). Tono directo y claro, sin relleno emocional.

Estado de documentos:
${estadoTexto}

Próximo paso identificado: ${siguienteTexto}

Responde solo con el párrafo, sin encabezados ni JSON.`,
      }],
      temperature: 0.4,
      max_tokens: 220,
    });
    res.json({ resumen: response.choices[0].message.content.trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Estado de la conexión DocuSign — el botón "Enviar por DocuSign" del CRM consulta esto
// para mostrar el aviso de "no configurado" en vez de fallar en silencio.
app.get('/api/docusign/status', (req, res) => {
  res.json({ configured: docusignConfigurado() });
});

// Crea un sobre de firma DocuSign para un documento legal y lo asocia al registro en legal_docs.
app.post('/api/docusign/enviar/:prospectoId/:docKey', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { docLabel, firmantes } = req.body;
    if (!firmantes || !Array.isArray(firmantes) || firmantes.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un firmante (nombre y email).' });
    }
    const result = await docusignCrearSobre({ docLabel: docLabel || req.params.docKey, firmantes });
    if (!result.configured) return res.status(503).json(result);
    if (result.error) return res.status(500).json(result);

    await pool.query(
      `UPDATE legal_docs SET docusign_envelope_id = $1, status = 'en_revision', sign_sent_date = NOW(), updated_at = NOW()
       WHERE tenant_id = $2 AND prospecto_id = $3 AND doc_key = $4`,
      [result.envelopeId, tenant.id, req.params.prospectoId, req.params.docKey]
    );
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Webhook de DocuSign Connect — actualiza el estado del documento cuando se firma/rechaza.
app.post('/webhook/docusign', async (req, res) => {
  try {
    const { envelopeId, status } = docusignParseWebhook(req.body);
    if (envelopeId) {
      const nuevoStatus = status === 'completed' ? 'firmado' : status === 'declined' ? 'pendiente' : 'en_revision';
      await pool.query(
        `UPDATE legal_docs SET status = $1, updated_at = NOW() WHERE docusign_envelope_id = $2`,
        [nuevoStatus, envelopeId]
      );
    }
    res.status(200).send('OK');
  } catch (e) {
    console.error('[DocuSign] Error procesando webhook:', e.message);
    res.status(200).send('OK'); // 200 igual para que DocuSign no reintente indefinidamente
  }
});

// Auto-crear tabla legal_alerts (evita reenviar el mismo aviso de trámite en <48h)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS legal_alerts (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        prospecto_id INTEGER NOT NULL REFERENCES prospectos(id) ON DELETE CASCADE,
        doc_key TEXT NOT NULL,
        tipo TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('legal_alerts table check:', e.message); }
})();

// Asegura las columnas de baja de prospecto (razón de caída tipificada) si aún no existen.
(async () => {
  try {
    await pool.query(`
      ALTER TABLE prospectos
        ADD COLUMN IF NOT EXISTS razon_perdida TEXT,
        ADD COLUMN IF NOT EXISTS razon_perdida_detalle TEXT,
        ADD COLUMN IF NOT EXISTS fecha_perdida DATE
    `);
  } catch (e) { console.warn('prospectos razon_perdida columns check:', e.message); }
})();

// El historial de correos por prospecto ("Bandeja Unificada") nunca tuvo columna real —
// vivía solo en el estado del navegador, por lo que borrar un correo ahí nunca se persistía
// y reaparecía al recargar. Se agrega la columna real para que sea un borrado de verdad.
(async () => {
  try {
    await pool.query(`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS email_history JSONB DEFAULT '[]'`);
  } catch (e) { console.warn('prospectos email_history column check:', e.message); }
})();

// Etiqueta de origen para clasificar la bandeja de Sara por "carpetas" (solicitud del
// cliente, recuperación de crisis, oportunidad detectada, reactivación, cobranza) — antes
// no existía ninguna columna que distinguiera de dónde vino cada borrador, así que la
// bandeja era una sola lista cronológica sin forma de filtrar por tipo.
(async () => {
  try {
    await pool.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS origen TEXT`);
  } catch (e) { console.warn('drafts origen column check:', e.message); }
})();

// Quién y cuándo se aprobó/envió cada borrador — antes /api/send-draft marcaba
// 'aprobado_por: Admin' fijo sin importar qué usuario hizo clic, así que no había
// trazabilidad real de quién envió cada correo.
(async () => {
  try {
    await pool.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS sent_by TEXT`);
    await pool.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`);
  } catch (e) { console.warn('drafts sent_by/sent_at column check:', e.message); }
})();

// Captura de leads del chatbot Sara / formulario web: antes cada mensaje del chatbot creaba
// o parchaba el prospecto usando el correo como llave, así que antes de que el visitante
// diera su correo no había forma de acumular la conversación en una sola fila — y el análisis
// de IA (presupuesto, temas de interés, score) solo se guardaba en el primer mensaje, nunca
// en los siguientes. `chat_session_id` permite correlacionar todos los mensajes de una misma
// conversación a un solo prospecto desde el primer mensaje (con o sin correo aún). Las
// columnas estructuradas evitan que "temas de interés"/"presupuesto" vivan solo como texto
// libre dentro de notas, donde no se pueden filtrar ni reportar.
(async () => {
  try {
    await pool.query(`
      ALTER TABLE prospectos
        ADD COLUMN IF NOT EXISTS chat_session_id TEXT,
        ADD COLUMN IF NOT EXISTS temas_interes JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS resumen_ia TEXT,
        ADD COLUMN IF NOT EXISTS score_calificacion NUMERIC
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prospectos_chat_session ON prospectos (chat_session_id) WHERE chat_session_id IS NOT NULL`);
  } catch (e) { console.warn('prospectos chat_session_id/IA columns check:', e.message); }
})();

// ==========================================
// FUNDAMENTALES MACROECONÓMICOS POR PAÍS
// La plataforma es multi-tenant y cada tenant puede operar en un país distinto de
// LatAm (GLP en Panamá, pero el software es reusable en Colombia, Costa Rica, etc.).
// La valorización de la Calculadora debe reflejar la inflación y la apreciación
// inmobiliaria REAL del país del tenant, no un supuesto fijo por proyecto.
// ==========================================
(async () => {
  try {
    await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Panamá'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS macro_fundamentals (
        country TEXT PRIMARY KEY,
        inflacion_anual NUMERIC,
        inflacion_fuente TEXT,
        apreciacion_min NUMERIC,
        apreciacion_max NUMERIC,
        apreciacion_fuente TEXT,
        fecha_dato TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Semilla con datos reales verificados (fuentes oficiales), no inventados.
    await pool.query(`
      INSERT INTO macro_fundamentals (country, inflacion_anual, inflacion_fuente, apreciacion_min, apreciacion_max, apreciacion_fuente, fecha_dato)
      VALUES
        ('Panamá', -0.2, 'INEC Panamá — inflación interanual cierre 2025', 6, 9, 'LATAM Finance Blog / Adventures in CRE — apreciación anualizada 2020–2026 en zonas premium', '2025–2026'),
        ('Colombia', 5.1, 'DANE — IPC anual dic. 2025', 9.17, 9.17, 'DANE — Índice de Precios de Vivienda Nueva (IPVN) Q4 2025', '2025')
      ON CONFLICT (country) DO NOTHING
    `);
  } catch (e) { console.warn('macro_fundamentals table check:', e.message); }
})();

// Si el país del tenant no está sembrado (u otro país de LatAm), lo investiga en vivo
// con búsqueda web real (mismo motor y reglas anti-alucinación que Camilo) y lo cachea.
async function getMacroFundamentals(country) {
  const { rows } = await pool.query('SELECT * FROM macro_fundamentals WHERE country = $1', [country]);
  const stale = rows[0] && (Date.now() - new Date(rows[0].updated_at).getTime()) > 90 * 86400000;
  if (rows[0] && !stale) return rows[0];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return rows[0] || null;

  try {
    const webContext = await webSearchGLP(apiKey, [
      `${country} inflación anual 2025 2026 tasa oficial`,
      `${country} valorización apreciación inmobiliaria anual histórica vivienda`,
    ]);
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const synthesis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Con base en esta investigación web real sobre ${country}:\n\n${webContext}\n\nDevuelve SOLO un JSON (sin markdown) con esta estructura EXACTA:\n{"inflacion_anual": number, "inflacion_fuente": string, "apreciacion_min": number, "apreciacion_max": number, "apreciacion_fuente": string, "fecha_dato": string}\nSi la búsqueda no trae un dato, usa null en ese campo y explica en la fuente correspondiente "Sin fuente verificable para este dato".\n${ANTI_HALUCINACION}`,
      }],
      temperature: 0.2,
      max_tokens: 400,
    });
    const raw = synthesis.choices[0].message.content.trim().replace(/^```json\n?|```$/g, '');
    const parsed = JSON.parse(raw);
    const { rows: upserted } = await pool.query(`
      INSERT INTO macro_fundamentals (country, inflacion_anual, inflacion_fuente, apreciacion_min, apreciacion_max, apreciacion_fuente, fecha_dato, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (country) DO UPDATE SET
        inflacion_anual = EXCLUDED.inflacion_anual, inflacion_fuente = EXCLUDED.inflacion_fuente,
        apreciacion_min = EXCLUDED.apreciacion_min, apreciacion_max = EXCLUDED.apreciacion_max,
        apreciacion_fuente = EXCLUDED.apreciacion_fuente, fecha_dato = EXCLUDED.fecha_dato, updated_at = NOW()
      RETURNING *
    `, [country, parsed.inflacion_anual, parsed.inflacion_fuente, parsed.apreciacion_min, parsed.apreciacion_max, parsed.apreciacion_fuente, parsed.fecha_dato]);
    return upserted[0];
  } catch (e) {
    console.warn(`⚠️ No se pudo investigar fundamentales macro de ${country} en vivo:`, e.message);
    return rows[0] || null;
  }
}

app.get('/api/macro-fundamentals', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const country = tenant.country || 'Panamá';
    const data = await getMacroFundamentals(country);
    if (!data) return res.status(404).json({ error: `Sin fundamentales macro para ${country} y no se pudo investigar en vivo (¿falta OPENAI_API_KEY?).` });
    res.json({
      country,
      inflacionAnual: data.inflacion_anual !== null ? Number(data.inflacion_anual) : null,
      inflacionFuente: data.inflacion_fuente,
      apreciacionMin: data.apreciacion_min !== null ? Number(data.apreciacion_min) : null,
      apreciacionMax: data.apreciacion_max !== null ? Number(data.apreciacion_max) : null,
      apreciacionFuente: data.apreciacion_fuente,
      fechaDato: data.fecha_dato,
      actualizadoEn: data.updated_at,
    });
  } catch (err) {
    console.error('❌ Error en /api/macro-fundamentals:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// UNIDADES DE INVENTARIO (por proyecto)
// ==========================================
const { parseInventario } = require('./unidadesImport');

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS unidades (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        proyecto TEXT NOT NULL,
        proyecto_excel TEXT,
        subproyecto_torre TEXT,
        tipo TEXT,
        subtipo TEXT,
        configuracion TEXT,
        unidad TEXT NOT NULL,
        piso TEXT,
        vista TEXT,
        modelo TEXT,
        etapa_fase TEXT,
        recamaras NUMERIC,
        banos NUMERIC,
        area_cerrada NUMERIC,
        area_abierta NUMERIC,
        area_rooftop NUMERIC,
        patio NUMERIC,
        area_lote NUMERIC,
        area_total NUMERIC,
        estacionamientos NUMERIC,
        precio_base NUMERIC,
        adicionales NUMERIC,
        precio_final NUMERIC,
        mantenimiento_mes NUMERIC,
        estado TEXT DEFAULT 'disponible',
        estado_manual BOOLEAN DEFAULT FALSE,
        fecha_lista DATE,
        archivo_fuente TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (tenant_id, proyecto, subproyecto_torre, unidad)
      )
    `);
  } catch (e) { console.warn('unidades table check:', e.message); }

  // Historial de cambios de unidades — antes una reimportación de Excel sobrescribía
  // precio/área/etc. sin dejar rastro del valor anterior. Cada campo que cambia al
  // confirmar una importación (o una edición manual) queda registrado aquí.
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS unidades_historial (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        unidad_id BIGINT,
        proyecto TEXT,
        subproyecto_torre TEXT,
        unidad TEXT,
        campo TEXT NOT NULL,
        campo_label TEXT,
        valor_anterior TEXT,
        valor_nuevo TEXT,
        archivo_fuente TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('unidades_historial table check:', e.message); }
})();

const mapUnidadRow = (r) => ({
  id: Number(r.id), proyecto: r.proyecto, proyectoExcel: r.proyecto_excel,
  subproyectoTorre: r.subproyecto_torre, tipo: r.tipo, subtipo: r.subtipo,
  configuracion: r.configuracion, unidad: r.unidad, piso: r.piso, vista: r.vista,
  modelo: r.modelo, etapaFase: r.etapa_fase,
  recamaras: r.recamaras !== null ? Number(r.recamaras) : null,
  banos: r.banos !== null ? Number(r.banos) : null,
  areaCerrada: r.area_cerrada !== null ? Number(r.area_cerrada) : null,
  areaAbierta: r.area_abierta !== null ? Number(r.area_abierta) : null,
  areaRooftop: r.area_rooftop !== null ? Number(r.area_rooftop) : null,
  patio: r.patio !== null ? Number(r.patio) : null,
  areaLote: r.area_lote !== null ? Number(r.area_lote) : null,
  areaTotal: r.area_total !== null ? Number(r.area_total) : null,
  estacionamientos: r.estacionamientos !== null ? Number(r.estacionamientos) : null,
  precioBase: r.precio_base !== null ? Number(r.precio_base) : null,
  adicionales: r.adicionales !== null ? Number(r.adicionales) : null,
  precioFinal: r.precio_final !== null ? Number(r.precio_final) : null,
  mantenimientoMes: r.mantenimiento_mes !== null ? Number(r.mantenimiento_mes) : null,
  estado: r.estado, estadoManual: !!r.estado_manual,
  fechaLista: fmtDateOnly ? fmtDateOnly(r.fecha_lista) : r.fecha_lista,
  archivoFuente: r.archivo_fuente,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

app.get('/api/unidades', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Tenant no encontrado' });
    const { proyecto } = req.query;
    const params = [tenant.id];
    let sql = 'SELECT * FROM unidades WHERE tenant_id = $1';
    if (proyecto) { params.push(proyecto); sql += ` AND proyecto = $${params.length}`; }
    sql += ' ORDER BY proyecto, subproyecto_torre NULLS FIRST, unidad';
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(mapUnidadRow));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/unidades', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const u = req.body;
    const { rows } = await pool.query(`
      INSERT INTO unidades (
        tenant_id, proyecto, subproyecto_torre, tipo, subtipo, configuracion, unidad, piso, vista,
        modelo, etapa_fase, recamaras, banos, area_cerrada, area_abierta, area_rooftop, patio,
        area_lote, area_total, estacionamientos, precio_base, adicionales, precio_final,
        mantenimiento_mes, estado, estado_manual
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,TRUE)
      RETURNING *
    `, [
      tenant.id, u.proyecto, u.subproyectoTorre || null, u.tipo || null, u.subtipo || null,
      u.configuracion || null, u.unidad, u.piso || null, u.vista || null, u.modelo || null,
      u.etapaFase || null, u.recamaras ?? null, u.banos ?? null, u.areaCerrada ?? null,
      u.areaAbierta ?? null, u.areaRooftop ?? null, u.patio ?? null, u.areaLote ?? null,
      u.areaTotal ?? null, u.estacionamientos ?? null, u.precioBase ?? null, u.adicionales ?? null,
      u.precioFinal ?? null, u.mantenimientoMes ?? null, u.estado || 'disponible',
    ]);
    res.json(mapUnidadRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/unidades/:id', async (req, res) => {
  try {
    const u = req.body;
    // Cualquier edición manual desde el CRM marca estado_manual=TRUE para que una
    // reimportación futura del Excel no le pise el estado al broker.
    const { rows } = await pool.query(`
      UPDATE unidades SET
        proyecto=$1, subproyecto_torre=$2, tipo=$3, subtipo=$4, configuracion=$5, unidad=$6,
        piso=$7, vista=$8, modelo=$9, etapa_fase=$10, recamaras=$11, banos=$12, area_cerrada=$13,
        area_abierta=$14, area_rooftop=$15, patio=$16, area_lote=$17, area_total=$18,
        estacionamientos=$19, precio_base=$20, adicionales=$21, precio_final=$22,
        mantenimiento_mes=$23, estado=$24, estado_manual=TRUE, updated_at=NOW()
      WHERE id=$25
      RETURNING *
    `, [
      u.proyecto, u.subproyectoTorre || null, u.tipo || null, u.subtipo || null, u.configuracion || null,
      u.unidad, u.piso || null, u.vista || null, u.modelo || null, u.etapaFase || null,
      u.recamaras ?? null, u.banos ?? null, u.areaCerrada ?? null, u.areaAbierta ?? null,
      u.areaRooftop ?? null, u.patio ?? null, u.areaLote ?? null, u.areaTotal ?? null,
      u.estacionamientos ?? null, u.precioBase ?? null, u.adicionales ?? null, u.precioFinal ?? null,
      u.mantenimientoMes ?? null, u.estado || 'disponible', req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json(mapUnidadRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/unidades/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM unidades WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Diff campo-por-campo para la vista previa de importación ────────────────
// Antes la importación sobrescribía precio/área/etc. en silencio, sin mostrar qué cambiaba
// ni guardar el valor anterior. Ahora el preview compara cada campo contra la BD y solo
// las filas con diferencias reales (o unidades nuevas) llegan a la pantalla de selección.
const UNIDAD_DIFF_FIELDS = [
  ['tipo', 'Tipo de activo'], ['subtipo', 'Subtipo'], ['configuracion', 'Configuración'],
  ['piso', 'Piso / Nivel'], ['vista', 'Vista / Ubicación'], ['modelo', 'Tipo / Modelo'],
  ['etapa_fase', 'Etapa / Fase'], ['recamaras', 'Recámaras'], ['banos', 'Baños'],
  ['area_cerrada', 'Área cerrada (m²)'], ['area_abierta', 'Área abierta (m²)'],
  ['area_rooftop', 'Área rooftop (m²)'], ['patio', 'Patio (m²)'], ['area_lote', 'Área lote (m²)'],
  ['area_total', 'Área total (m²)'], ['estacionamientos', 'Estacionamientos'],
  ['precio_base', 'Precio base (USD)'], ['adicionales', 'Adicionales (USD)'],
  ['precio_final', 'Precio final (USD)'], ['mantenimiento_mes', 'Mantenimiento mensual (USD)'],
  ['estado', 'Estado'], ['fecha_lista', 'Fecha de lista'],
];
const UNIDAD_NUMERIC_FIELDS = new Set(['recamaras', 'banos', 'area_cerrada', 'area_abierta', 'area_rooftop', 'patio', 'area_lote', 'area_total', 'estacionamientos', 'precio_base', 'adicionales', 'precio_final', 'mantenimiento_mes']);

function normalizeUnidadVal(field, v) {
  if (v === undefined || v === null || v === '') return null;
  if (UNIDAD_NUMERIC_FIELDS.has(field)) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  if (field === 'fecha_lista') return fmtDateOnly(v);
  return String(v).trim();
}
function unidadValuesEqual(field, a, b) {
  const na = normalizeUnidadVal(field, a), nb = normalizeUnidadVal(field, b);
  if (na === null && nb === null) return true;
  if (UNIDAD_NUMERIC_FIELDS.has(field)) return Math.abs((na || 0) - (nb || 0)) < 0.005;
  return na === nb;
}
function unidadKey(proyecto, torre, unidad) { return `${proyecto}||${torre || ''}||${unidad}`; }

// Compara la fila del Excel contra la fila existente (o null si es nueva) y devuelve solo
// los campos con diferencia real. El campo "estado" se omite si el broker ya lo fijó a mano
// (estado_manual=true), porque la importación nunca lo va a tocar — mostrarlo confundiría.
function diffUnidadRow(nuevo, existente) {
  const fields = [];
  for (const [key, label] of UNIDAD_DIFF_FIELDS) {
    if (key === 'estado' && existente?.estado_manual) continue;
    const before = existente ? existente[key] : null;
    const after = nuevo[key];
    if (!unidadValuesEqual(key, before, after)) {
      fields.push({ field: key, label, before: normalizeUnidadVal(key, before), after: normalizeUnidadVal(key, after) });
    }
  }
  return fields;
}

// Algunos Excel de origen traen la misma unidad repetida en más de una fila (ej. una fila
// vieja que no se borró al actualizar la lista). Sin deduplicar, /confirmar aplicaría ambas
// filas en secuencia y el resultado final dependería del orden — no de cuál es la correcta.
// Nos quedamos con la ÚLTIMA aparición de cada key (la más probable de ser la vigente).
function dedupeUnidades(unidades) {
  const porKey = new Map();
  for (const u of unidades) porKey.set(unidadKey(u.proyecto, u.subproyecto_torre, u.unidad), u);
  return { deduped: Array.from(porKey.values()), duplicados: unidades.length - porKey.size };
}

// Vista previa: parsea el Excel, compara contra la base de datos y devuelve SOLO las filas
// con cambios reales (o unidades nuevas), sin escribir nada todavía. Los datos parseados
// quedan en memoria (pendingUnidadesImports) para que /confirmar aplique exactamente lo que
// el admin seleccione, sin tener que volver a subir ni volver a parsear el archivo.
const pendingUnidadesImports = new Map(); // importId -> { tenantId, unidades, resumen, createdAt }
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, entry] of pendingUnidadesImports) if (entry.createdAt < cutoff) pendingUnidadesImports.delete(id);
}, 5 * 60 * 1000);

app.post('/api/unidades/importar/preview', upload.single('archivo'), async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const { unidades: unidadesRaw, resumen } = parseInventario(req.file.buffer);
    const { deduped: unidades, duplicados } = dedupeUnidades(unidadesRaw);
    if (duplicados > 0) resumen.duplicadosEnArchivo = duplicados;

    const { rows: existentesRows } = await pool.query(
      'SELECT * FROM unidades WHERE tenant_id = $1', [tenant.id]
    );
    const existentesPorKey = new Map(existentesRows.map(r => [unidadKey(r.proyecto, r.subproyecto_torre, r.unidad), r]));

    const cambios = [];
    let sinCambios = 0;
    for (const u of unidades) {
      const key = unidadKey(u.proyecto, u.subproyecto_torre, u.unidad);
      const existente = existentesPorKey.get(key) || null;
      const fields = diffUnidadRow(u, existente);
      if (fields.length === 0) { sinCambios++; continue; }
      cambios.push({
        key, proyecto: u.proyecto, subproyectoTorre: u.subproyecto_torre, unidad: u.unidad,
        tipoCambio: existente ? 'actualizada' : 'nueva', fields,
      });
    }

    const importId = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingUnidadesImports.set(importId, { tenantId: tenant.id, unidades, resumen, createdAt: Date.now() });

    res.json({ importId, resumen, cambios, sinCambios, nuevas: cambios.filter(c => c.tipoCambio === 'nueva').length, actualizadas: cambios.filter(c => c.tipoCambio === 'actualizada').length });
  } catch (e) { res.status(500).json({ error: 'No se pudo leer el Excel: ' + e.message }); }
});

// Aplica SOLO las filas seleccionadas (por key) de una vista previa ya generada, y registra
// cada campo cambiado en unidades_historial para poder auditar precios/áreas más adelante.
app.post('/api/unidades/importar/confirmar', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { importId, keys } = req.body;
    const entry = pendingUnidadesImports.get(importId);
    if (!entry || entry.tenantId !== tenant.id) {
      return res.status(410).json({ error: 'La vista previa expiró o no es válida. Vuelve a subir el archivo.' });
    }
    const selected = new Set(keys || []);

    let creadas = 0, actualizadas = 0;
    for (const u of entry.unidades) {
      const key = unidadKey(u.proyecto, u.subproyecto_torre, u.unidad);
      if (!selected.has(key)) continue;

      const { rows: existentes } = await pool.query(
        'SELECT * FROM unidades WHERE tenant_id=$1 AND proyecto=$2 AND subproyecto_torre IS NOT DISTINCT FROM $3 AND unidad=$4',
        [tenant.id, u.proyecto, u.subproyecto_torre, u.unidad]
      );
      const existing = existentes[0] || null;
      const fields = diffUnidadRow(u, existing);
      if (fields.length === 0) continue; // nada cambió realmente (pudo cambiar entre preview y confirmar)

      if (existing) {
        const estadoFinal = existing.estado_manual ? undefined : u.estado;
        await pool.query(`
          UPDATE unidades SET
            proyecto_excel=$1, tipo=$2, subtipo=$3, configuracion=$4, piso=$5, vista=$6, modelo=$7,
            etapa_fase=$8, recamaras=$9, banos=$10, area_cerrada=$11, area_abierta=$12,
            area_rooftop=$13, patio=$14, area_lote=$15, area_total=$16, estacionamientos=$17,
            precio_base=$18, adicionales=$19, precio_final=$20, mantenimiento_mes=$21,
            estado=COALESCE($22, estado), fecha_lista=$23, archivo_fuente=$24, updated_at=NOW()
          WHERE id=$25
        `, [
          u.proyecto_excel, u.tipo, u.subtipo, u.configuracion, u.piso, u.vista, u.modelo,
          u.etapa_fase, u.recamaras, u.banos, u.area_cerrada, u.area_abierta, u.area_rooftop,
          u.patio, u.area_lote, u.area_total, u.estacionamientos, u.precio_base, u.adicionales,
          u.precio_final, u.mantenimiento_mes, estadoFinal ?? null, u.fecha_lista, u.archivo_fuente,
          existing.id,
        ]);
        for (const f of fields) {
          await pool.query(
            `INSERT INTO unidades_historial (tenant_id, unidad_id, proyecto, subproyecto_torre, unidad, campo, campo_label, valor_anterior, valor_nuevo, archivo_fuente)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [tenant.id, existing.id, u.proyecto, u.subproyecto_torre, u.unidad, f.field, f.label, f.before === null ? null : String(f.before), f.after === null ? null : String(f.after), u.archivo_fuente]
          );
        }
        actualizadas++;
      } else {
        const { rows: inserted } = await pool.query(`
          INSERT INTO unidades (
            tenant_id, proyecto, proyecto_excel, subproyecto_torre, tipo, subtipo, configuracion,
            unidad, piso, vista, modelo, etapa_fase, recamaras, banos, area_cerrada, area_abierta,
            area_rooftop, patio, area_lote, area_total, estacionamientos, precio_base, adicionales,
            precio_final, mantenimiento_mes, estado, fecha_lista, archivo_fuente
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
          RETURNING id
        `, [
          tenant.id, u.proyecto, u.proyecto_excel, u.subproyecto_torre, u.tipo, u.subtipo,
          u.configuracion, u.unidad, u.piso, u.vista, u.modelo, u.etapa_fase, u.recamaras, u.banos,
          u.area_cerrada, u.area_abierta, u.area_rooftop, u.patio, u.area_lote, u.area_total,
          u.estacionamientos, u.precio_base, u.adicionales, u.precio_final, u.mantenimiento_mes,
          u.estado, u.fecha_lista, u.archivo_fuente,
        ]);
        await pool.query(
          `INSERT INTO unidades_historial (tenant_id, unidad_id, proyecto, subproyecto_torre, unidad, campo, campo_label, valor_anterior, valor_nuevo, archivo_fuente)
           VALUES ($1,$2,$3,$4,$5,'creacion','Unidad creada',NULL,$6,$7)`,
          [tenant.id, inserted[0].id, u.proyecto, u.subproyecto_torre, u.unidad, u.precio_final != null ? String(u.precio_final) : null, u.archivo_fuente]
        );
        creadas++;
      }
    }
    pendingUnidadesImports.delete(importId);
    res.json({ resumen: entry.resumen, creadas, actualizadas });
  } catch (e) { res.status(500).json({ error: 'Error confirmando importación: ' + e.message }); }
});

app.get('/api/unidades/historial', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { proyecto, unidadId } = req.query;
    const params = [tenant.id];
    let sql = 'SELECT * FROM unidades_historial WHERE tenant_id = $1';
    if (proyecto) { params.push(proyecto); sql += ` AND proyecto = $${params.length}`; }
    if (unidadId) { params.push(unidadId); sql += ` AND unidad_id = $${params.length}`; }
    sql += ' ORDER BY created_at DESC LIMIT 300';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Servidor GLP CRM en http://localhost:${PORT}`);
  console.log(`🗄️  Base de datos: PostgreSQL (Supabase)`);
  console.log(`=================================================`);
  startEmailPoller();
  startProspectMonitor();
  startCrisisDetector();
  startLegalAlertMonitor();
});
