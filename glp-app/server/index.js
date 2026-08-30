const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();
const pool = require('./db');
const { startEmailPoller, pollInbox } = require('./emailPoller');
const { startProspectMonitor, monitorProspects, saraAutoTrigger72h, detectColdProspects } = require('./prospectMonitor');
const { startCrisisDetector, detectCrisis } = require('./crisisDetector');
const agentMemory = require('./agentMemory');
const agentFeedback = require('./agentFeedback');
const agentAudit = require('./agentAudit');
const { startLegalAlertMonitor } = require('./legalAlertMonitor');
const { startCarteraMonitor } = require('./carteraMonitor');
const { startContentAgentsMonitor } = require('./contentAgentsMonitor');
const { startFeedbackMonitor } = require('./agentFeedback');
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
    name: 'Capital Brokers - Real Estate',
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
// tope, según lo acordado). Valeria e Isabella usan gpt-4o (más caro, mejor redacción) desde
// que se afinó modelo/temperatura por tipo de tarea — el resto sigue en gpt-4o-mini. Si un
// agente cambia de modelo, agregar su entrada aquí antes de que empiece a registrar costo
// $0 por error.
const PRECIOS_USD_POR_1M_TOKENS = {
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'gpt-4o': { input: 2.50, output: 10.00 },
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
// GET /api/agent-runs/:id/steps — la traza completa de UNA respuesta: cada herramienta que
// el agente invocó, con qué argumentos, qué le respondió y si falló (ver agentAudit.js).
// Incluye los pasos de una consulta cruzada a otro agente bajo el mismo run_id, así que
// muestra el razonamiento completo aunque haya cruzado a otro especialista en el camino.
app.get('/api/agent-runs/:id/steps', async (req, res) => {
  try {
    const pasos = await agentAudit.pasosDeRun(req.params.id);
    res.json(pasos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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

// Sofía ahora también sondea, en vivo dentro del chat, el segmento de proyecto que el
// visitante busca (ciudad/golf/isla/playa), su presupuesto y si quiere renta corta/Airbnb —
// antes esto solo influía en la respuesta de Sara turno a turno y se perdía; con columnas
// propias queda visible en el perfil del prospecto en el CRM, igual que arquetipo/confianza.
(async () => {
  try {
    await pool.query(`
      ALTER TABLE sofia_profiles
        ADD COLUMN IF NOT EXISTS segmento_deseado TEXT,
        ADD COLUMN IF NOT EXISTS interes_renta_corta BOOLEAN,
        ADD COLUMN IF NOT EXISTS presupuesto_detectado NUMERIC
    `);
  } catch (e) { console.warn('sofia_profiles segmento/renta columns check:', e.message); }
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

// ==========================================
// CAMPAÑAS DE MARKETING — envío real y trazabilidad. Antes "Lanzar campaña" en el CRM
// solo cambiaba estado a 'activa' en localStorage — ningún correo salía y no quedaba
// ningún registro. campaign_sends deja un rastro por cada destinatario (enviado/fallido,
// cuándo, con qué asunto) para que el módulo deje de aparentar una funcionalidad que no
// tenía. Cubre el envío inmediato de campañas tipo "masiva" (no las secuencias drip
// automáticas de varios días, que necesitarían un scheduler aparte).
// ==========================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_sends (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'tenant-glp-001',
        campaign_id TEXT NOT NULL,
        campaign_nombre TEXT,
        prospecto_id TEXT,
        prospecto_nombre TEXT,
        prospecto_correo TEXT,
        asunto TEXT,
        status TEXT NOT NULL DEFAULT 'enviado',
        error TEXT,
        enviado_por TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('campaign_sends table check:', e.message); }
})();

// ==========================================
// CAMPAÑAS — las campañas en sí (nombre, segmento, contenido, pasos de secuencia) vivían
// SOLO en localStorage — a diferencia de campaign_sends (el rastro de envíos, que sí quedó en
// Postgres desde el principio), nunca había una tabla para el registro de la campaña. Mismo
// patrón que `projects`: el objeto completo como JSONB, porque su forma es rica y anidada
// (dripPasos, segmentación) y no vale la pena aplanarla a columnas tipadas.
// ==========================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'tenant-glp-001',
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('campaigns table check:', e.message); }
})();

app.get('/api/campaigns', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query('SELECT data FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC', [tenant.id]);
    res.json(rows.map(r => r.data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/campaigns', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const campana = req.body;
    const id = String(campana.id || Date.now());
    await pool.query(
      `INSERT INTO campaigns (id, tenant_id, data) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET data = $3, updated_at = NOW()`,
      [id, tenant.id, JSON.stringify({ ...campana, id: campana.id || Number(id) || id })]
    );
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query(
      `UPDATE campaigns SET data = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [JSON.stringify(req.body), String(req.params.id), tenant.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM campaigns WHERE id = $1 AND tenant_id = $2', [String(req.params.id), tenant.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/campaigns/send-now', async (req, res) => {
  try {
    const { campaignId, campaignNombre, asunto, cuerpo, destinatarios = [] } = req.body;
    if (!campaignId || !asunto || !cuerpo) return res.status(400).json({ error: 'Faltan campos: campaignId, asunto, cuerpo.' });
    if (!Array.isArray(destinatarios) || destinatarios.length === 0) return res.status(400).json({ error: 'La campaña no tiene destinatarios (segmento vacío).' });

    const tenant = await resolveTenant(req);
    const user = resolveUser(req);
    const transporter = getTransporter(tenant);
    if (!transporter) return res.status(500).json({ error: 'SMTP no configurado. Verifica SMTP_USER y SMTP_PASS en .env' });

    // Envío secuencial (no Promise.all) — evita saturar el límite de envíos del proveedor
    // SMTP y deja que un fallo puntual no interrumpa el resto del lote.
    const resultados = [];
    for (const dest of destinatarios) {
      const correo = dest.correo || dest.email;
      if (!correo) {
        resultados.push({ prospectoId: dest.id, nombre: dest.nombre, status: 'omitido', error: 'Sin correo registrado' });
        continue;
      }
      const nombreCompleto = `${dest.nombre || ''} ${dest.apellido || ''}`.trim() || 'Cliente';
      const asuntoPersonalizado = asunto.replace(/{{\s*nombre\s*}}/g, dest.nombre || nombreCompleto);
      const cuerpoPersonalizado = cuerpo
        .replace(/{{\s*nombre\s*}}/g, dest.nombre || nombreCompleto)
        .replace(/{{\s*apellido\s*}}/g, dest.apellido || '')
        .replace(/{{\s*broker\s*}}/g, dest.broker || user || 'Tu asesor de Capital Brokers')
        .replace(/{{\s*proyecto\s*}}/g, dest.proyecto || (dest.proyectos_interes || [])[0] || 'nuestros proyectos')
        .replace(/{{\s*presupuesto\s*}}/g, dest.presupuesto_usd ? `$${Number(dest.presupuesto_usd).toLocaleString()}` : '');
      try {
        await transporter.sendMail({
          from: `"Capital Brokers - Real Estate" <${process.env.SMTP_USER}>`,
          to: correo,
          subject: asuntoPersonalizado,
          html: cuerpoPersonalizado.replace(/\n/g, '<br>'),
        });
        await pool.query(
          `INSERT INTO campaign_sends (tenant_id, campaign_id, campaign_nombre, prospecto_id, prospecto_nombre, prospecto_correo, asunto, status, enviado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'enviado',$8)`,
          [tenant.id, String(campaignId), campaignNombre || null, dest.id ? String(dest.id) : null, nombreCompleto, correo, asuntoPersonalizado, user]
        );
        resultados.push({ prospectoId: dest.id, nombre: nombreCompleto, correo, status: 'enviado' });
      } catch (sendErr) {
        console.error(`[Campañas] ❌ Error enviando a ${correo}:`, sendErr.message);
        await pool.query(
          `INSERT INTO campaign_sends (tenant_id, campaign_id, campaign_nombre, prospecto_id, prospecto_nombre, prospecto_correo, asunto, status, error, enviado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'fallido',$8,$9)`,
          [tenant.id, String(campaignId), campaignNombre || null, dest.id ? String(dest.id) : null, nombreCompleto, correo, asuntoPersonalizado, sendErr.message, user]
        );
        resultados.push({ prospectoId: dest.id, nombre: nombreCompleto, correo, status: 'fallido', error: sendErr.message });
      }
    }

    const enviados = resultados.filter(r => r.status === 'enviado').length;
    const fallidos = resultados.filter(r => r.status === 'fallido').length;
    console.log(`[Campañas] "${campaignNombre || campaignId}" — ${enviados} enviados, ${fallidos} fallidos de ${destinatarios.length} destinatarios.`);
    res.json({ success: true, enviados, fallidos, omitidos: resultados.length - enviados - fallidos, resultados });
  } catch (err) {
    console.error('[Campañas] Error en send-now:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DERIVACIONES A ASESOR HUMANO — desde el chatbot Sara. Antes derivar_a_asesor solo
// mandaba un correo de alerta; si ese correo se perdía o nadie lo vio a tiempo no quedaba
// ningún rastro de que el visitante pidió hablar con una persona. Ahora también se
// persiste, igual que una cita.
// ==========================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_derivaciones (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'tenant-glp-001',
        motivo TEXT,
        visitante_correo TEXT,
        visitante_telefono TEXT,
        session_id TEXT,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('chat_derivaciones table check:', e.message); }
})();

app.get('/api/campaigns/sends', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { campaignId } = req.query;
    const { rows } = campaignId
      ? await pool.query('SELECT * FROM campaign_sends WHERE tenant_id = $1 AND campaign_id = $2 ORDER BY created_at DESC', [tenant.id, String(campaignId)])
      : await pool.query('SELECT * FROM campaign_sends WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200', [tenant.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Antes no existía ningún GET — el panel de "Perfilar Prospectos" del CRM nunca leía esta
// tabla (solo el chat en vivo la escribía), así que vivía enteramente aparte en localStorage,
// desconectado de los perfiles reales que ya se estaban guardando en Postgres. Join con
// prospectos para reconstruir nombre/ocupación/presupuesto que el frontend necesita mostrar,
// sin duplicar esos campos dentro de sofia_profiles.
app.get('/api/sofia-profiles', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(`
      SELECT sp.prospecto_id, sp.arquetipo, sp.confianza, sp.senales,
             sp.recomendacion_sara, sp.recomendacion_valeria, sp.updated_at,
             p.nombre, p.apellido, p.ocupacion, p.presupuesto_usd
      FROM sofia_profiles sp
      JOIN prospectos p ON p.id = sp.prospecto_id
      WHERE sp.tenant_id = $1
      ORDER BY sp.updated_at DESC
    `, [tenant.id]);
    res.json(rows.map(r => ({
      prospectId: r.prospecto_id,
      prospectName: `${r.nombre || ''} ${r.apellido || ''}`.trim() || `Prospecto ${r.prospecto_id}`,
      ocupacion: r.ocupacion || '',
      presupuesto: Number(r.presupuesto_usd) || 0,
      arquetipo: r.arquetipo,
      confianza: r.confianza,
      senales: r.senales || [],
      recomendacion_sara: r.recomendacion_sara,
      recomendacion_valeria: r.recomendacion_valeria,
      fecha: r.updated_at,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    // edited_by_human: marca que un humano tocó el contenido antes de aprobarlo — es la
    // señal que distingue "aprobado tal cual" de "aprobado editado" en el loop de feedback
    // (ver agentFeedback.js). Solo importa para borradores que un agente generó; para uno
    // manual no cambia nada observable.
    const { rows } = await pool.query(
      `UPDATE drafts SET
         destinatario = COALESCE($1, destinatario),
         subject = COALESCE($2, subject),
         body = COALESCE($3, body),
         prioridad = COALESCE($4, prioridad),
         edited_by_human = true
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
    const user = resolveUser(req);
    // Descartar un borrador que un AGENTE generó es señal real de calidad — se registra
    // antes de borrarlo (ver agentFeedback.js). Un borrador manual (origen no _ia) no
    // pasa por este loop.
    const { rows: existente } = await pool.query('SELECT origen FROM drafts WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    await pool.query('DELETE FROM drafts WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    if (existente.length > 0) {
      const agenteOrigen = agentFeedback.agentePorOrigenDraft(existente[0].origen);
      if (agenteOrigen) await agentFeedback.registrar(tenant.id, agenteOrigen, 'draft', req.params.id, 'discarded', user).catch(() => {});
    }
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

Para calcular score_calificacion suma: menciona_fecha_decision(+25) + menciona_presupuesto(+20) + menciona_inversion(+15) + menciona_entrega_o_disponibilidad(+10) + menciona_financiamiento(+10) + menciona_rentabilidad(+10) + contacto_en_turno_de_interes(+10) + menciona_panama(+5) + menciona_habitaciones(+5) + menciona_uso_propio(+5). Ajusta según tono: listo_para_decidir(+15), solo_cotizando(-15). Máximo 100.

contacto_en_turno_de_interes: true SOLO si el cliente dejó su correo/teléfono en el MISMO mensaje (o inmediatamente después) de una señal de interés real (presupuesto, fecha, financiamiento) — no si el contacto vino aislado sin contexto de interés alrededor.`
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
                      contacto_en_turno_de_interes: { type: 'boolean', description: 'true solo si el correo/teléfono llegó en el mismo turno (o inmediatamente después) de una señal de interés real, no aislado.' },
                      tono_general: { type: 'string', enum: ['curioso', 'interesado', 'listo_para_decidir', 'solo_cotizando', 'desconocido'] },
                    },
                    required: ['menciona_inversion', 'menciona_panama', 'menciona_presupuesto', 'menciona_entrega_o_disponibilidad', 'menciona_financiamiento', 'menciona_fecha_decision', 'menciona_habitaciones', 'menciona_rentabilidad', 'menciona_uso_propio', 'contacto_en_turno_de_interes', 'tono_general'],
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
          messages: [{ role: 'user', content: `Eres Sara Valenzuela, Directora de Atención al Cliente y Operaciones Comerciales de ${tenant.name}. Redacta un correo de seguimiento cálido y profesional para ${detectedFirstName}, quien se comunicó con nosotros y mostró interés en: ${analysis.resumen_consulta || project}. Sus temas de interés son: ${(analysis.temas_interes || []).join(', ')}. Proyecto de interés: ${detectedProject}. IMPORTANTE: nunca menciones "chatbot", "asistente virtual" ni "IA" — di simplemente que "nos contactó" o "tuvo la oportunidad de conversar con nuestro equipo". Firma siempre como Sara Valenzuela, Directora de Atención al Cliente y Operaciones Comerciales.` }],
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
                <div style="font-size:11px;color:#B89047;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Directora de Atención al Cliente y Operaciones Comerciales</div>
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
    // Antes un solo mensaje con presupuesto + "quiero invertir" ya podía sumar 60+ y saltar
    // directo a "Calificado" sin haber sostenido conversación real — se exige un mínimo de
    // 3 turnos del cliente antes de subirlo a ese tier, aunque el score numérico ya alcance.
    const numClienteTurns = conversationHistory ? (conversationHistory.match(/^Cliente:/gm) || []).length : 0;
    const estadoLead = score !== null
      ? (score >= 60 && numClienteTurns >= 3 ? 'Calificado' : score >= 30 ? 'Contacto Inicial' : 'Lead Frío')
      : 'Lead Nuevo';
    const temasInteres = JSON.stringify(analysis?.temas_interes || []);
    const proyectosInteres = JSON.stringify(
      (analysis?.proyectos_mencionados && analysis.proyectos_mencionados.length) ? analysis.proyectos_mencionados : [detectedProject]
    );
    const perfilInversor = (analysis?.perfil_inversor && analysis.perfil_inversor !== 'desconocido') ? analysis.perfil_inversor : null;

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
           perfil_inversor = COALESCE($9, perfil_inversor),
           chat_session_id = COALESCE(chat_session_id, $10),
           fecha_ultima_actividad = NOW()
         WHERE id = $11`,
        [email || null, phone || null, proyectosInteres, enrichedNotes, temasInteres,
         analysis?.resumen_consulta || null, score, budgetUSD, perfilInversor, sessionId || null, existingProspect.id]
      );
    } else {
      await pool.query(
        `INSERT INTO prospectos (tenant_id, nombre, apellido, correo, telefono, proyectos_interes, forma_contacto, estado, canal, notas, presupuesto_usd, temas_interes, resumen_ia, score_calificacion, perfil_inversor, chat_session_id, fecha_registro, fecha_ultima_actividad)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())`,
        [tenant.id, detectedFirstName, '', email || '', phone || '',
         proyectosInteres, channel || 'Web', estadoLead, channel || 'Web',
         enrichedNotes, budgetUSD, temasInteres, analysis?.resumen_consulta || null, score, perfilInversor, sessionId || null]
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

    // Loop de feedback (ver agentFeedback.js): un borrador que un agente generó y que se
    // terminó enviando es una aprobación — "tal cual" o "editado" según si se tocó el
    // contenido antes (edited_by_human, marcado en PUT /api/drafts/:id).
    const agenteOrigenSend = agentFeedback.agentePorOrigenDraft(draft.origen);
    if (agenteOrigenSend) {
      const decision = draft.edited_by_human ? 'approved_edited' : 'approved_as_is';
      await agentFeedback.registrar(tenant.id, agenteOrigenSend, 'draft', id, decision, user).catch(() => {});
    }

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
  { name: 'Armonía', zone: 'Bella Vista — Ciudad de Panamá', tipo: 'Residencia', entrega: 'F1 Inmediata · F2 Q2 2026 · F3 Q2 2028', minPrice: 181000, maxPrice: 235000, areaMin: 45, areaMax: 71, bedrooms: '1, 2 y 3 rec.', capRateMin: 6.0, capRateMax: 7.5, amenities: ['Piscina', 'Gimnasio', 'Lobby diseño', 'Seguridad 24/7', 'Parqueo'], licenciaTuristica: true },
  { name: 'Ventu', zone: 'Bella Vista — Ciudad de Panamá', tipo: 'Hotelero (Airbnb)', entrega: 'Q2 2028', minPrice: 136000, maxPrice: 259000, areaMin: 40, areaMax: 63, bedrooms: '1 y 2 rec.', capRateMin: 8.0, capRateMax: 12.0, amenities: ['Administración hotelera', 'Pool deck', 'Coworking', 'Check-in automático'], licenciaTuristica: true },
  { name: 'Ocena', zone: 'Santa María — Ciudad de Panamá', tipo: 'Residencia', entrega: 'Q4 2027', minPrice: 446000, maxPrice: 1200000, areaMin: 100, areaMax: 270, bedrooms: '2 y 3 rec.', capRateMin: 4.7, capRateMax: 6.0, amenities: ['Golf 18 hoyos Jack Nicklaus', 'Club House', 'Piscinas resort', 'Wellness center'] },
  { name: 'Ipanema', zone: 'Costa Sur — Ciudad de Panamá', tipo: 'Residencia', entrega: 'F1 Q1 2028 · F2 Q4 2028', minPrice: 283000, maxPrice: 519000, areaMin: 72, areaMax: 163, bedrooms: '1, 2 y 3 rec.', capRateMin: 6.0, capRateMax: 7.5, amenities: ['Piscina vista al mar', 'Gimnasio', 'Co-working', 'BBQ'] },
  { name: 'Bosco', zone: 'Santa María — Ciudad de Panamá', tipo: 'Residencia', entrega: '2030', minPrice: 474000, maxPrice: 1100000, areaMin: 100, areaMax: 296, bedrooms: '2, 3 y 4 rec.', capRateMin: 5.5, capRateMax: 7.2, amenities: ['Jardines botánicos', 'Piscina natural', 'Senderos de meditación'] },
  { name: 'Panama Viejo Residence', zone: 'Panamá Viejo — Ciudad de Panamá', tipo: 'Residencia', entrega: 'ENTREGA INMEDIATA', minPrice: 160000, maxPrice: 182000, areaMin: 58, areaMax: 58, bedrooms: '2 rec.', capRateMin: 6.5, capRateMax: 8.0, amenities: ['Piscina', 'Gimnasio', 'Coworking', 'Seguridad 24/7'] },
  { name: 'The Palms', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia premium', entrega: 'ENTREGA INMEDIATA', minPrice: 1200000, maxPrice: 1400000, areaMin: 169, areaMax: 239, bedrooms: '2 rec.', capRateMin: 5.5, capRateMax: 7.0, amenities: ['Marina privada 180+ muelles', 'Yacht club', 'Piscinas infinity', 'Spa'] },
  { name: 'Ocean Reef Park', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia ultra-premium', entrega: 'Q2 2028', minPrice: 1700000, maxPrice: 2100000, areaMin: 491, areaMax: 569, bedrooms: '3 y 4 rec.', capRateMin: 5.0, capRateMax: 6.5, amenities: ['Marina privada', 'Helipuerto', 'Yacht club', 'Club privado'] },
  { name: 'O Club Residences', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia premium', entrega: 'Q4 2027', minPrice: 1000000, maxPrice: 1400000, areaMin: 183, areaMax: 236, bedrooms: '2 rec.', capRateMin: 5.0, capRateMax: 6.5, amenities: ['Club privado O Club', 'Marina', 'Spa', 'Restaurantes'] },
  { name: 'Aires del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'INMEDIATA · Q4 2026', minPrice: 143000, maxPrice: 207000, areaMin: 42, areaMax: 71, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 8.0, amenities: ['Vista al océano Pacífico', 'Piscinas', 'Jardines', 'Seguridad 24/7'], licenciaTuristica: true },
  { name: 'The Tides', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 278000, maxPrice: 308000, areaMin: 99, areaMax: 99, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['1.2 km playa privada', 'Surf club', '3 piscinas', 'Restaurante y beach bar'], licenciaTuristica: true },
  { name: 'Brisas del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 276000, maxPrice: 332000, areaMin: 93, areaMax: 108, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Frente al mar', 'Piscina', 'BBQ', 'Seguridad 24/7'], licenciaTuristica: true },
  { name: 'Olas del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 267000, maxPrice: 398000, areaMin: 69, areaMax: 97, bedrooms: '2 y 3 rec.', capRateMin: 6.0, capRateMax: 8.0, amenities: ['Piscina con vista al mar', 'BBQ', 'Seguridad 24/7'], licenciaTuristica: true },
  { name: 'Surfside', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa / aparthotel', entrega: 'ENTREGA INMEDIATA', minPrice: 314000, maxPrice: 413000, areaMin: 81, areaMax: 107, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Playa privada', 'Piscinas y jacuzzi', 'Restaurante y bar', 'Surf lounge'], licenciaTuristica: true },
  { name: 'Beachwalk', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa wellness', entrega: 'Q1 2027', minPrice: 297000, maxPrice: 386000, areaMin: 85, areaMax: 97, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['Frente al océano', 'Wellness spa', 'Yoga deck', 'Gimnasio exterior'], licenciaTuristica: true },
  { name: 'Seashore', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'Q4 2027', minPrice: 290000, maxPrice: 490000, areaMin: 84, areaMax: 150, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Vista al Pacífico', 'Piscina', 'Área social y BBQ', 'Gimnasio'], licenciaTuristica: true },
  { name: 'Seashore Reserve', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'Q4 2028', minPrice: 290000, maxPrice: 490000, areaMin: 84, areaMax: 150, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['Vista al Pacífico', 'Piscina', 'Área social y BBQ', 'Gimnasio'], licenciaTuristica: true },
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
// una vez hay suficiente contexto (>=2 mensajes del visitante).
//
// Antes esto SOLO devolvía el arquetipo para ajustar el tono — la decisión de "¿pido el
// contacto ahora?" vivía aparte, en una lista rígida de turnos (askCheckpoints = [2,5,9])
// que disparaba la pregunta sin importar qué acababa de decir el visitante. Resultado real
// reportado: un "¿cómo estás Sara?" en el turno 2 recibía la misma pregunta de contacto que
// un mensaje mostrando interés real, porque el sistema solo contaba turnos, no leía la
// conversación. Ahora Sofía evalúa en la misma llamada si HAY señal real de interés/compra
// (listoParaContacto) — la decisión de pedir contacto se apoya en su lectura del contexto,
// no en un contador ciego.
async function clasificarArquetipoChat(apiKey, conversationText) {
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres Sofía, la analista de perfiles psicográficos de una inmobiliaria de lujo. Analiza SOLO lo que escribió el visitante (ignora las respuestas del bot) en esta conversación de chat:\n\n${conversationText}\n\n1) Clasifica su arquetipo dominante: "estatus" (busca exclusividad/pertenencia), "legado" (preservación patrimonial familiar), "racional" (decide por datos/ROI), "aspiracional" (motivado por estilo de vida).\n2) Evalúa si la conversación YA muestra señales reales de interés de compra/inversión (preguntó por precio, ubicación, financiamiento, disponibilidad, quiere agendar, compara proyectos, habla de presupuesto o plazos) — no small talk, saludos, o preguntas genéricas sin intención de avanzar. Si el visitante solo saludó o hizo una pregunta social/trivial, listoParaContacto debe ser false aunque sea el segundo o tercer mensaje.\n3) Detecta el segmento de proyecto que busca, SOLO si lo dijo explícita o implícitamente (para trabajo/vivir en la ciudad = "ciudad"; mencionó golf, club house, o estilo de vida de club privado = "golf_country_club"; mencionó máxima exclusividad, isla, marina, yates = "isla_privada"; segunda vivienda, descanso, fin de semana, vacacional = "playa"; si no dio ninguna pista = "sin_definir").\n4) Detecta si mencionó presupuesto — el número exacto en USD, o null si no lo dio.\n5) Detecta si mencionó que quiere rentar en corto plazo / Airbnb / alquiler vacacional a turistas (interesRentaCorta: true/false).`,
      }],
      temperature: 0.3, max_tokens: 250,
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
              listoParaContacto: { type: 'boolean', description: 'true solo si ya hay señales concretas de interés real de compra/inversión, no small talk' },
              nivelInteres: { type: 'string', enum: ['bajo', 'medio', 'alto'] },
              segmentoDeseado: { type: 'string', enum: ['ciudad', 'golf_country_club', 'isla_privada', 'playa', 'sin_definir'] },
              presupuestoDetectado: { type: ['number', 'null'] },
              interesRentaCorta: { type: 'boolean' },
            },
            required: ['arquetipo', 'confianza', 'senales', 'listoParaContacto', 'nivelInteres', 'segmentoDeseado', 'presupuestoDetectado', 'interesRentaCorta'],
          },
        },
      },
    });
    return JSON.parse(response.choices[0].message.content.trim());
  } catch { return null; }
}

// Clasifica un proyecto del catálogo en uno de los 4 segmentos de vida/inversión — misma
// taxonomía que usa Sofía para segmentoDeseado. Antes esto vivía solo como texto dentro del
// prompt ("no mezcles playa con ciudad") y el modelo principal, escribiendo una lista larga,
// terminaba incluyendo un proyecto del segmento equivocado igual (probado en producción: una
// búsqueda de ciudad para trabajo devolvió un proyecto de Playa Caracol). Con esta función se
// arma una lista blanca real de nombres permitidos y se la inyecta al prompt de forma
// prominente — el modelo ya no tiene que "recordar" la regla sobre una lista completa, solo
// respetar una lista corta y explícita.
function segmentoDeProyecto(p) {
  const zone = (p.zone || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (name.includes('oceana') || name.includes('ocena')) return 'golf_country_club';
  if (zone.includes('playa caracol') || zone.includes('chame')) return 'playa';
  if (zone.includes('punta pacífica') || zone.includes('punta pacifica') || zone.includes('isla privada')) return 'isla_privada';
  return 'ciudad';
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
      `- ${p.name} | ${p.zone} | ${p.tipo || p.type || 'Residencia'} | Precio: $${(p.minPrice || 0).toLocaleString()}–$${(p.maxPrice || 0).toLocaleString()} USD | Áreas: ${p.areaMin || '?'}–${p.areaMax || '?'} m² | ${p.bedrooms || ''} | Entrega: ${p.entrega || 'consultar'} | Amenidades: ${(p.amenities || []).join(', ')} | Licencia turística (renta corta/Airbnb): ${p.licenciaTuristica ? 'SÍ tiene' : 'NO tiene'}`
    ).join('\n');

    // Antes el prompt solo listaba preguntas de calificación de PRODUCTO (presupuesto,
    // habitaciones, financiamiento...) sin decirle a Sara que su objetivo de negocio real
    // es conseguir un dato de contacto — el chatbot podía sostener una conversación entera
    // sobre el catálogo sin jamás pedir correo o WhatsApp, y sin ese dato el mensaje NUNCA
    // se convierte en un prospecto real en el CRM (ver hasContactInfo en el frontend).
    const numUserMsgs = messages.filter(m => m.sender === 'user').length;
    const yaTieneContacto = messages.some(m =>
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(m.text) || /[\+]?[\d][\d\s\-\(\)]{9,}/.test(m.text)
    );
    const yaPidioContactoAntes = messages.some(m => m.sender !== 'user' && /correo|whatsapp|whats app/i.test(m.text));
    // Turnos (mensajes del visitante) transcurridos desde la última vez que se le pidió el
    // contacto — exige espacio real antes de volver a insistir, en vez de repetir en cada
    // checkpoint aunque el visitante ya haya ignorado la pregunta.
    let turnosDesdeUltimaPeticion = Infinity;
    {
      let count = 0, lastAskAt = -Infinity;
      for (const m of messages) {
        if (m.sender === 'user') count++;
        else if (/correo|whatsapp|whats app/i.test(m.text)) lastAskAt = count;
      }
      turnosDesdeUltimaPeticion = count - lastAskAt;
    }

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
    // chatbot, así que Sara respondía con el mismo tono/gancho para cualquier visitante, y
    // la pregunta de contacto se disparaba por número de turno (askCheckpoints=[2,5,9]) sin
    // leer si el visitante había mostrado interés real o solo estaba saludando. Ahora Sofía
    // corre desde el 2º mensaje del visitante y su señal listoParaContacto — no un contador
    // ciego — es la que decide si es momento de pedir el dato.
    let arquetipoDetectado = null;
    if (numUserMsgs >= 2) {
      const conversationText = messages.filter(m => m.sender === 'user').map(m => m.text).join('\n');
      arquetipoDetectado = await clasificarArquetipoChat(apiKey, conversationText);
    }
    const forzarPreguntaContacto = !yaTieneContacto
      && !!arquetipoDetectado?.listoParaContacto
      && turnosDesdeUltimaPeticion >= 3;
    const SEGMENTO_LABEL = {
      ciudad: 'CIUDAD / URBANO', golf_country_club: 'GOLF Y COUNTRY CLUB', isla_privada: 'ISLA PRIVADA / PUNTA PACÍFICA', playa: 'PLAYA CARACOL', sin_definir: 'sin definir aún',
    };
    const perfilTxt = arquetipoDetectado
      ? `\nPERFIL PSICOGRÁFICO DETECTADO EN VIVO (Sofía, ${arquetipoDetectado.confianza}% confianza): ${arquetipoDetectado.arquetipo.toUpperCase()} — ${arquetipoDetectado.senales.join('; ')}\nAjusta tu tono y tus argumentos a este perfil específico, no uses un tono genérico: ${SARA_TONO_POR_ARQUETIPO[arquetipoDetectado.arquetipo] || ''}\nLectura de Sofía sobre el nivel de interés real de este visitante: ${arquetipoDetectado.nivelInteres.toUpperCase()}.${arquetipoDetectado.nivelInteres === 'bajo' ? ' Todavía no hay señal de interés de compra — no ofrezcas agendar cita ni derivar a un asesor, sigue conversando con naturalidad.' : ''}\nSegmento de proyecto que Sofía detectó (úsalo para filtrar tus recomendaciones, no lo vuelvas a adivinar tú): ${SEGMENTO_LABEL[arquetipoDetectado.segmentoDeseado] || 'sin definir aún'}.${arquetipoDetectado.presupuestoDetectado ? ` Presupuesto detectado: $${Number(arquetipoDetectado.presupuestoDetectado).toLocaleString()} USD.` : ''}${arquetipoDetectado.interesRentaCorta ? ' Quiere renta corta/Airbnb — solo proyectos con licencia turística.' : ''}`
      : '';

    // Lista blanca real (no solo una regla en prosa) de qué proyectos puede recomendar
    // proactivamente en ESTE turno — filtrada por el segmento que detectó Sofía y, si aplica,
    // por licencia turística. Es más confiable que pedirle al modelo que aplique la regla él
    // mismo sobre el catálogo completo: acá directamente no tiene la opción de listar algo
    // fuera de segmento porque no está en la lista. No restringe preguntas sobre un proyecto
    // que el cliente ya nombró explícitamente — solo las recomendaciones que Sara propone.
    let listaPermitidaTxt = '';
    if (arquetipoDetectado && arquetipoDetectado.segmentoDeseado && arquetipoDetectado.segmentoDeseado !== 'sin_definir') {
      let permitidos = projects.filter(p => segmentoDeProyecto(p) === arquetipoDetectado.segmentoDeseado);
      if (arquetipoDetectado.interesRentaCorta) permitidos = permitidos.filter(p => p.licenciaTuristica);
      listaPermitidaTxt = permitidos.length > 0
        ? `\n════════════════════════════════════════════════════\nLISTA BLANCA DE RECOMENDACIONES PARA ESTE TURNO — no es opcional:\nSolo puedes recomendar proactivamente estos proyectos: ${permitidos.map(p => p.name).join(', ')}.\nCualquier otro proyecto del catálogo queda fuera de esta recomendación, aunque encaje en presupuesto — no lo menciones como opción. (Si el cliente pregunta por uno específico que no está en esta lista, sí puedes responderle sobre ese proyecto puntual, pero acláraselo si no encaja con lo que dijo que busca.)\n════════════════════════════════════════════════════\n`
        : `\nNingún proyecto del catálogo encaja con el segmento + filtros detectados para este cliente — dile con honestidad que hoy no tienes una opción exacta para lo que pide, en vez de forzar una recomendación fuera de lugar.\n`;
    }

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
              INSERT INTO sofia_profiles (prospecto_id, tenant_id, arquetipo, confianza, senales, recomendacion_sara, recomendacion_valeria, segmento_deseado, interes_renta_corta, presupuesto_detectado, updated_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
              ON CONFLICT (prospecto_id) DO UPDATE SET
                arquetipo=$3, confianza=$4, senales=$5, recomendacion_sara=$6, recomendacion_valeria=$7,
                segmento_deseado=COALESCE($8, sofia_profiles.segmento_deseado),
                interes_renta_corta=COALESCE($9, sofia_profiles.interes_renta_corta),
                presupuesto_detectado=COALESCE($10, sofia_profiles.presupuesto_detectado),
                updated_at=NOW()
            `, [prospectoId, tenant.id, arquetipoDetectado.arquetipo, arquetipoDetectado.confianza,
                JSON.stringify(arquetipoDetectado.senales), SARA_TONO_POR_ARQUETIPO[arquetipoDetectado.arquetipo] || '',
                VALERIA_TONO_POR_ARQUETIPO[arquetipoDetectado.arquetipo] || '',
                arquetipoDetectado.segmentoDeseado !== 'sin_definir' ? arquetipoDetectado.segmentoDeseado : null,
                arquetipoDetectado.interesRentaCorta, arquetipoDetectado.presupuestoDetectado || null]).catch(() => {});
          }
        }).catch(() => {});
    }

    const systemPrompt = `Eres Sara, asesora de inversiones inmobiliarias de ${tenant.name}. Llevas años en este mundo y te apasiona conectar a las personas con la inversión correcta para su momento de vida.
${perfilTxt}
${listaPermitidaTxt}
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
Antes de soltar una lista de proyectos con precios y áreas exactas, asegúrate de tener al menos ZONA/SEGMENTO y HABITACIONES que busca — si te falta alguno de los dos, pregúntalo en una frase natural dentro de tu respuesta (ej. "¿buscas 1, 2 o más habitaciones?") en vez de saltar directo a una lista detallada. Una vez los tengas, ahí sí da recomendaciones concretas sin seguir preguntando cosas que ya sabes.
${yaTieneContacto ? '\nEl visitante YA compartió un dato de contacto en este chat — agradécelo si aún no lo hiciste y sigue asesorando con normalidad, sin volver a pedirlo.' : (!forzarPreguntaContacto ? '\nNo es el momento de pedir el correo/WhatsApp en esta respuesta — concéntrate en la conversación y en generar interés real. Ya habrá otro momento más adelante para pedirlo.' : '')}

CALENDARIO REAL — nunca calcules tú qué día cae en qué fecha, ya te lo doy resuelto. Usa SOLO esta tabla para convertir cualquier día que mencione el visitante ("el viernes", "mañana", "el jueves que viene") a fecha exacta:
${buildProximosDiasTexto()}

USO DE HERRAMIENTAS — esto no es opcional ni una posibilidad, es una instrucción directa:
- Si el visitante dice que quiere agendar, hablar con alguien en una llamada/videollamada, o que le gustaría una cita, pero AÚN NO dio un día y una hora concretas, NO lo derives ni le des un link todavía — pregúntale primero qué días y horarios le quedan bien esta semana (ej. "¿qué día te viene mejor — entre semana o fin de semana? ¿en la mañana o en la tarde?"). Indaga su disponibilidad real antes de intentar cerrar la cita; no asumas ni propongas tú una fecha sin que él la haya dado.
- En cuanto el visitante mencione un día Y una hora concretas para hablar, primero busca ese día EXACTO en la tabla de arriba (nunca lo calcules de memoria) y confirma la modalidad antes de agendar: pregúntale si prefiere LLAMADA o VIDEOLLAMADA (si no lo dijo ya). Según lo que responda:
  · Si es LLAMADA y no tienes su teléfono/WhatsApp en la conversación, pídeselo primero — sin número no hay a quién llamar.
  · Si es VIDEOLLAMADA y no tienes su correo en la conversación, pídeselo primero — sin correo no hay dónde mandar el link.
- NUNCA llames a agendar_cita en el mismo turno en el que acabas de reunir fecha+hora+modalidad+contacto. Primero, en ESE turno, repítele al visitante en texto (sin llamar la función) el día, la hora exacta y la modalidad que entendiste, y pregúntale explícitamente si lo confirma (ej. "Te reservo el martes 2 de septiembre a las 3:00 p.m. por videollamada — ¿confirmas este horario?"). Solo llama a agendar_cita en el turno SIGUIENTE, y solo si el visitante confirmó explícitamente (sí, confirmo, dale, perfecto, así está bien, etc.) — nunca antes de esa confirmación explícita. Si en vez de confirmar cambia el día o la hora, repite el nuevo horario propuesto y vuelve a pedir confirmación; nunca agendes sobre un dato que el visitante no confirmó.
- En cuanto el visitante pida explícitamente hablar con una persona, un asesor o un humano, DEBES llamar a la función derivar_a_asesor en ESE MISMO turno, no le respondas primero preguntando por qué.
- Nunca simules en texto que agendaste algo o que derivaste a alguien sin haber llamado la función correspondiente.
- No esperes SOLO a que el visitante lo pida: si Sofía marcó nivel de interés ALTO y ya tienes su contacto, ofrécele TÚ, de forma natural, el siguiente paso concreto — "¿quieres que te agende una llamada esta semana?" o "¿prefieres que te conecte directo con un asesor para resolver esto con más detalle?" — en vez de seguir solo respondiendo preguntas. No lo ofrezcas si el interés es bajo o medio, ni más de una vez por conversación si ya lo ofreciste y no respondió.

FORMATO DE RESPUESTA — siempre:
- Separa por bloques temáticos con línea en blanco entre cada uno
- Nunca uses emojis en tu respuesta — ni como viñeta, ni como decoración, ni al final de una frase. Texto plano, sin excepción.
- Máximo 2–3 líneas por bloque
- Nunca uses "Cap Rate", "tasa de capitalización" ni jerga técnica — di "retorno estimado" o "lo que puedes esperar recibir mensualmente"
- Nunca uses formato de enlace markdown — nada de "[texto](url)" ni corchetes alrededor de un link. Si compartes un número de WhatsApp o un link, escríbelo tal cual en texto plano (ej. "escríbenos aquí: https://wa.me/573124824353"), sin corchetes ni paréntesis envolviendo la URL.
- Termina con una pregunta o comentario que invite a seguir

CRITERIOS PARA RECOMENDAR PROYECTOS — Sofía ya sondeó esto por ti, no lo vuelvas a adivinar:
- El bloque "PERFIL PSICOGRÁFICO DETECTADO EN VIVO" de arriba trae el segmento, el presupuesto y el interés en renta corta que Sofía detectó de lo que el cliente YA dijo — es tu fuente de verdad, no tu propia relectura de la conversación. Si dice "sin definir aún", el cliente todavía no dio pistas — ahí sí puedes preguntar o mostrar variedad.
- Los 4 segmentos y qué proyectos caen en cada uno:
  · CIUDAD / URBANO (Bella Vista, Costa Sur, Panamá Viejo) — vivir o trabajar en la ciudad, cerca de oficinas, día a día urbano.
  · GOLF Y COUNTRY CLUB (Oceana, en Santa María — su seña de identidad es el campo de golf de 18 hoyos, club house, pickleball/tenis) — estilo de vida de club privado/golf, no un apartamento urbano corriente ni una segunda vivienda de playa.
  · ISLA PRIVADA / PUNTA PACÍFICA (Ocean Reef Park, The Palms) — ultra-premium, marina, yates, máxima exclusividad.
  · PLAYA CARACOL (Chame — Pacífico) — segunda vivienda, descanso, fines de semana, alquiler vacacional.
- En cuanto Sofía marque un segmento (no "sin definir"), tu lista de recomendaciones debe salir EXCLUSIVAMENTE de ese segmento — cero excepciones, cero "también podrías considerar" de otro segmento. Si vas a listar 3 proyectos, los 3 deben ser del mismo segmento. Antes de responder, revisa cada proyecto que estás por incluir contra la zona que Sofía detectó; si uno no encaja, no lo pongas, ni como opción secundaria. Si el segmento detectado cambia de turno a turno porque el cliente dio una nueva pista, ajústate al más reciente, incluso si ya habías sugerido algo de otro segmento antes. Si Sofía marca "sin_definir" y el bot no tiene contexto previo suficiente en esta misma conversación, usa el último mensaje del visitante para inferir tú misma el segmento antes de recomendar, aplicando la misma regla de exclusividad.
- El campo "Licencia turística" del catálogo SOLO importa cuando el cliente busca renta corta/Airbnb (Sofía marcó interesRentaCorta, o lo mencionó recién). Si no es ese el caso, ignóralo por completo: no lo menciones, no lo uses como razón para recomendar nada, ni lo incluyas en la ficha de un proyecto — no tiene relevancia para alguien que busca vivienda propia, trabajo o inversión sin fines de renta turística. Cuando SÍ aplica, recomienda solo proyectos marcados "SÍ tiene", y si el cliente se interesa en uno sin licencia, dile explícitamente que no es apto para eso antes de seguir hablando de él con ese fin.
- Segmento Y presupuesto son DOS filtros que se cruzan, no uno que reemplaza al otro. Si Sofía ya detectó un presupuesto y ningún proyecto del segmento detectado entra en ese presupuesto, NO lo presentes como "tu recomendación" ni lo pongas primero — dile en una frase que ese segmento normalmente arranca en un precio más alto que su presupuesto (da el número real), y en la MISMA respuesta ofrécele algo concreto que sí encaje: la opción más económica real de ese segmento si existe, o el segmento más cercano que sí entra en su presupuesto. Nunca dejes la respuesta solo en "deberíamos explorar otras opciones" sin decir cuáles.

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
          description: 'Agenda una llamada o videollamada con un asesor. SOLO se llama en el turno en el que el visitante CONFIRMA explícitamente (sí, confirmo, dale, perfecto...) un horario que TÚ ya le propusiste y repetiste en un mensaje anterior — nunca en el mismo turno en el que recién juntaste fecha+hora+modalidad+contacto. Requiere modalidad confirmada y el dato de contacto que esa modalidad necesita (teléfono para llamada, correo para videollamada).',
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
            // Alerta al administrador — antes la cita quedaba solo en la tabla `citas`, sin
            // avisar a nadie; un administrador solo se enteraba si entraba al CRM a revisar.
            const transporterCita = getTransporter(tenant);
            if (transporterCita) {
              transporterCita.sendMail({
                from: `"SARA Chatbot — Nueva Cita" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
                to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
                subject: `🗓️ Nueva cita agendada por el chatbot — ${args.fecha} ${args.hora}`,
                html: `<div style="font-family:sans-serif;line-height:1.6;">
                  <h2>Cita agendada desde el Chatbot SARA</h2>
                  <p><strong>Fecha y hora:</strong> ${args.fecha} a las ${args.hora}</p>
                  <p><strong>Modalidad:</strong> ${canal}</p>
                  <p><strong>Visitante:</strong> ${args.nombre || 'Visitante Web'}</p>
                  <p><strong>Contacto:</strong> ${modalidad === 'llamada' ? visitorPhone : visitorEmail}</p>
                  <p><strong>Motivo:</strong> ${args.motivo || 'No especificado'}</p>
                </div>`,
              }).catch(() => {});
            }
          } catch (e) {
            resultText = `Error agendando la cita: ${e.message}. Informa al visitante que un asesor confirmará el horario manualmente.`;
          }
        }
      } else if (call.function.name === 'derivar_a_asesor') {
        pool.query(
          `INSERT INTO chat_derivaciones (tenant_id, motivo, visitante_correo, visitante_telefono, session_id) VALUES ($1,$2,$3,$4,$5)`,
          [tenant.id, args.motivo || null, visitorEmail, visitorPhone, sessionId || null]
        ).catch(e => console.warn('chat_derivaciones insert:', e.message));
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
          ? `Derivación notificada al equipo con el número ${visitorPhone} para que un asesor llame directamente. Informa al visitante que un asesor lo va a contactar en los próximos minutos a ese número — y que si prefiere escribir antes, aquí está el WhatsApp del equipo: https://wa.me/${whatsappNumber} (escribe ese link tal cual, en texto plano, sin corchetes ni formato de enlace markdown).`
          : `Derivación notificada al equipo, pero aún no tienes el teléfono/WhatsApp del visitante. Dale este WhatsApp para continuar de inmediato: https://wa.me/${whatsappNumber} (escribe ese link tal cual, en texto plano, sin corchetes ni formato de enlace markdown) — y pídele su número para que un asesor lo llame directamente en vez de depender de que él escriba primero.`;
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
      [tenantId, 'Capital Brokers - Real Estate', 'glp.com.pa', JSON.stringify({ apiKey })]
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
// ==========================================
// HERRAMIENTA DE CONSULTA DE DATOS — usada por TODOS los chats de agente (Sara, Camilo,
// Sofía, Valeria, Isabella, Andrea/Cartera, Mónica/Legal).
//
// Motivo: no podemos anticipar cada pregunta agregada que un usuario va a hacer ("¿cuántos
// en reserva?", "¿cuál es el monto total en mora?", "¿cuántos con broker X?"...) y
// precalcular cada una a mano — eso no escala. Y dejar que el LLM cuente/sume leyendo el
// bloque de texto del contexto falla de forma sistemática apenas la lista crece (verificado
// en producción: Mónica contó 6 clientes en Reserva cuando eran 8 — no fue un descuido,
// es una limitación conocida de los LLM contando listas de texto).
//
// La solución no es "pedirle que tenga más cuidado" — es que el LLM NUNCA cuente: puede
// pedirle a esta herramienta cualquier conteo/suma/promedio/listado con un filtro
// estructurado (campo + operador + valor), la herramienta lo ejecuta contra el dataset
// real en memoria (determinístico, no memoria del modelo) y le devuelve el número exacto
// para que solo lo redacte. Así cualquier pregunta que surja "sobre la marcha" queda
// cubierta, sin tener que anticiparla ni tocar código cada vez.
// ==========================================
function aplicarFiltroFila(row, f) {
  if (!f || !f.campo) return true;
  const v = row[f.campo];
  if (v === undefined || v === null) return f.operador === '!=' ? true : false;
  const num = Number(f.valor);
  const esNumComparable = !isNaN(num) && (typeof v === 'number' || (!isNaN(Number(v))));
  switch (f.operador) {
    case '=': return esNumComparable ? Number(v) === num : String(v).toLowerCase() === String(f.valor).toLowerCase();
    case '!=': return esNumComparable ? Number(v) !== num : String(v).toLowerCase() !== String(f.valor).toLowerCase();
    case '>': return Number(v) > num;
    case '<': return Number(v) < num;
    case '>=': return Number(v) >= num;
    case '<=': return Number(v) <= num;
    case 'contiene': return String(v).toLowerCase().includes(String(f.valor).toLowerCase());
    default: return true;
  }
}
function ejecutarConsultaDatos(dataset, args) {
  const filtros = Array.isArray(args?.filtros) ? args.filtros : [];
  const filtrados = (dataset || []).filter(row => filtros.every(f => aplicarFiltroFila(row, f)));
  const nombres = filtrados.map(r => r.nombre).filter(Boolean);
  let resultado;
  if (args?.operacion === 'sumar') resultado = filtrados.reduce((s, r) => s + (Number(r[args.campo]) || 0), 0);
  else if (args?.operacion === 'promedio') resultado = filtrados.length ? filtrados.reduce((s, r) => s + (Number(r[args.campo]) || 0), 0) / filtrados.length : 0;
  else if (args?.operacion === 'listar') resultado = filtrados.map(r => (args.campo ? r[args.campo] : r.nombre));
  else resultado = filtrados.length; // 'contar' o cualquier otro valor
  return { resultado, total_registros_coincidentes: filtrados.length, nombres: nombres.slice(0, 60) };
}
const HERRAMIENTA_CONSULTA_DATOS = {
  type: 'function',
  function: {
    name: 'consultar_datos',
    description: 'Ejecuta un conteo, suma, promedio o listado EXACTO sobre los registros reales del módulo (ver "CAMPOS DISPONIBLES" en el mensaje del sistema). Úsala SIEMPRE que la pregunta implique "cuántos", "cuál es el total/promedio de", o "cuáles son los que cumplen X" — nunca cuentes ni sumes tú mismo leyendo el texto del contexto, esta herramienta es la única fuente confiable para esos números.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        operacion: { type: 'string', enum: ['contar', 'sumar', 'promedio', 'listar'] },
        campo: { type: 'string', description: 'Campo numérico a sumar/promediar, o campo a listar. Puede ir vacío para "contar".' },
        filtros: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              campo: { type: 'string' },
              operador: { type: 'string', enum: ['=', '!=', '>', '<', '>=', '<=', 'contiene'] },
              valor: { type: 'string' },
            },
            required: ['campo', 'operador', 'valor'],
          },
        },
      },
      required: ['operacion', 'filtros'],
    },
  },
};
// Bucle de function-calling: si el modelo pide `consultar_datos`, se ejecuta contra el
// dataset real y el resultado exacto se le devuelve para que complete la respuesta. Máximo
// 4 rondas (una pregunta rara vez necesita más de 1-2 consultas encadenadas).
// herramientasExtra: [{ schema: <tool schema OpenAI>, ejecutar: async (args) => resultado }]
// — permite que un agente puntual (ej. Andrea/CARTERA con "proponer_borrador_cobranza")
// tenga una acción propia además de consultar_datos, sin tocar los demás agentes que
// siguen usando solo el set por defecto.
// Planificación previa (razonamiento multi-paso): antes de responder, el modelo decide en
// UNA llamada barata si la pregunta necesita varios pasos encadenados (ej. "identifica los
// clientes de mayor riesgo, cruza con legal, y redacta 3 borradores priorizados") o si es
// directa ("¿cuántos clientes en mora?"). Solo si es compleja arma un plan explícito — así
// una pregunta simple no paga el costo/latencia extra de esta llamada de más.
// El plan no se "ejecuta" aparte con un motor propio: se inyecta como instrucción explícita
// en el systemPrompt del bucle reactivo de siempre (chatConHerramientas), guiándolo paso a
// paso en vez de dejarlo decidir todo de una vez — sigue siendo el mismo motor de tool-
// calling, ahora con una hoja de ruta declarada antes de empezar.
async function planificarSiNecesario(openai, question, runId = null) {
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0, max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Evalúas si una pregunta de un usuario a un agente de negocio necesita VARIOS pasos encadenados para responderse bien (ej. cruzar datos de dos áreas, generar varios artefactos, filtrar y luego actuar sobre el resultado), o si es una consulta directa de un solo paso. Responde SOLO JSON: {"requierePlan": boolean, "pasos": string[]}. Si requierePlan es false, "pasos" va vacío. Máximo 5 pasos, cada uno una frase corta en español, en el orden en que deben resolverse. No incluyas pasos triviales como "saludar" o "responder" — solo pasos que impliquen consultar o cruzar datos, o generar un artefacto.' },
        { role: 'user', content: question },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content || '{}');
    const plan = { requierePlan: !!parsed.requierePlan && Array.isArray(parsed.pasos) && parsed.pasos.length > 1, pasos: Array.isArray(parsed.pasos) ? parsed.pasos.slice(0, 5) : [] };
    agentAudit.registrarPaso(runId, -1, 'planificar', { pregunta: question }, plan, true, 0).catch(() => {});
    return plan;
  } catch (err) {
    // Si falla la planificación, se sigue el camino normal (sin plan) — nunca debe bloquear
    // la respuesta.
    return { requierePlan: false, pasos: [] };
  }
}

// Modelo/temperatura por tipo de tarea — antes los 7 agentes usaban gpt-4o-mini a
// temperature 0.3 para TODO, desde contar cuotas vencidas hasta redactar un post de
// Instagram. Una consulta de datos necesita precisión y determinismo (temperatura baja);
// una tarea creativa necesita variedad y un modelo con más capacidad redaccional.
const AGENT_MODEL_CONFIG = {
  CARTERA:  { model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 500 },  // datos de mora/pagos — precisión ante todo
  LEGAL:    { model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 500 },  // estado de expedientes — precisión ante todo
  SOFIA:    { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 500 },  // análisis de perfiles — balance
  CAMILO:   { model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 600 },  // research/insights — algo de margen interpretativo
  SARA:     { model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 600 },  // servicio al cliente — cálido pero factual
  VALERIA:  { model: 'gpt-4o',      temperature: 0.8, maxTokens: 900 },  // copy — creatividad real, modelo más capaz
  ISABELLA: { model: 'gpt-4o',      temperature: 0.8, maxTokens: 900 },  // guiones — creatividad real, modelo más capaz
};
const DEFAULT_MODEL_CONFIG = { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 500 };

async function chatConHerramientas(openai, systemPrompt, dataset, history, question, herramientasExtra = [], runId = null, agentKey = null) {
  const { model: modeloElegido, temperature: temperaturaElegida, maxTokens: maxTokensElegido } = AGENT_MODEL_CONFIG[agentKey] || DEFAULT_MODEL_CONFIG;
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
    { role: 'user', content: question },
  ];
  const toolsSchema = [HERRAMIENTA_CONSULTA_DATOS, ...herramientasExtra.map(h => h.schema)];
  const ejecutorPorNombre = { consultar_datos: (args) => ejecutarConsultaDatos(dataset, args) };
  herramientasExtra.forEach(h => { ejecutorPorNombre[h.schema.function.name] = h.ejecutar; });
  let promptTokens = 0, completionTokens = 0;
  const accionesRealizadas = [];
  // 6 rondas (antes 4): con una herramienta de acción además de consultar_datos (ej.
  // Andrea: buscar el cliente y LUEGO crear el borrador) el modelo a veces necesita más de
  // una ronda de tool-calls antes de poder redactar la respuesta final.
  for (let ronda = 0; ronda < 6; ronda++) {
    const resp = await openai.chat.completions.create({
      model: modeloElegido, messages, temperature: temperaturaElegida, max_tokens: maxTokensElegido,
      tools: toolsSchema, tool_choice: 'auto',
    });
    promptTokens += resp.usage?.prompt_tokens || 0;
    completionTokens += resp.usage?.completion_tokens || 0;
    const msg = resp.choices[0].message;
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
        const ejecutor = ejecutorPorNombre[tc.function.name];
        let resultado;
        const t0 = Date.now();
        try {
          resultado = ejecutor ? await ejecutor(args) : { error: `herramienta desconocida: ${tc.function.name}` };
          if (tc.function.name !== 'consultar_datos' && !resultado?.error) accionesRealizadas.push({ herramienta: tc.function.name, args, resultado });
        } catch (err) {
          resultado = { error: err.message };
        }
        // Auditoría (ver agentAudit.js): un renglón por cada herramienta invocada en esta
        // respuesta — nombre, argumentos, resultado, si falló, cuánto tardó. No bloquea el
        // flujo si falla el registro (catch silencioso), la respuesta al usuario no depende
        // de esto.
        agentAudit.registrarPaso(runId, ronda, tc.function.name, args, resultado, !resultado?.error, Date.now() - t0).catch(() => {});
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(resultado) });
      }
      continue;
    }
    return { answer: msg.content || 'No pude generar una respuesta.', promptTokens, completionTokens, acciones: accionesRealizadas };
  }
  return { answer: 'No pude completar la consulta — intenta reformular la pregunta.', promptTokens, completionTokens, acciones: accionesRealizadas };
}

// Métricas de calidad por agente (ver agentFeedback.js) — % de lo generado que se aprobó
// tal cual, se aprobó editado, o se descartó. Es la única señal real de si un agente está
// funcionando bien; antes no había ningún rastro de qué pasaba con lo que generaba.
app.get('/api/agents/feedback-metrics', async (req, res) => {
  const tenant = await resolveTenant(req);
  try {
    const porAgente = await agentFeedback.metrics(tenant.id);
    res.json(porAgente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hidrata el panel de chat de un agente al abrirlo — antes cada recarga de página perdía
// toda la conversación porque solo vivía en el estado del navegador. scopeType=user (por
// defecto) trae lo que ESTE usuario habló con el agente; scopeType=prospecto + scopeId trae
// lo que se habló SOBRE ese cliente en particular.
app.get('/api/agents/thread', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const { agent, scopeType = 'user', scopeId } = req.query;
  if (!agent) return res.status(400).json({ error: 'agent requerido' });
  try {
    const id = scopeType === 'prospecto' ? scopeId : user;
    const thread = await agentMemory.loadThread(tenant.id, agent, scopeType, id);
    res.json({
      summary: thread.summary,
      messages: thread.messages.map(m => ({ role: m.role === 'user' ? 'user' : 'agent', content: m.content })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sara/chat', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const { question, history = [] } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ error: 'question requerida' });

  const run = await startAgentRun(tenant.id, user, 'SARA', 'chat');
  try {
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) { await finishAgentRun(run?.id, { status: 'error', errorDetalle: 'OpenAI API Key requerida.' }); return res.status(500).json({ error: 'OpenAI API Key requerida.' }); }

    // canal/resumen_ia/temas_interes: sin esto Sara no podía saber SI una consulta vino por
    // correo, la landing o el chatbot, ni de qué trataba realmente — solo veía "prospecto en
    // tal estado", nada del contenido de su inquietud original.
    const { rows: prospects } = await pool.query(
      `SELECT id, nombre, apellido, estado, correo, telefono, broker_asignado, proyectos_interes,
              presupuesto_usd, fecha_registro, fecha_ultima_actividad, canal, resumen_ia, temas_interes
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
    // Sara respondía solo sobre prospectos/mensajes/alertas — no tenía las FAQs (Configuración
    // → FAQs, 32 respuestas ya redactadas y aprobadas) ni las inquietudes/solicitudes reales
    // que los clientes dejan por email/WhatsApp en el historial de cada prospecto. Sin esto no
    // podía responder nada de servicio al cliente real, solo pipeline comercial.
    const { rows: faqs } = await pool.query(
      `SELECT categoria, pregunta, respuesta FROM faqs WHERE tenant_id = $1 ORDER BY categoria, veces_usada DESC`,
      [tenant.id]
    );
    // whatsapp_history NO es columna real (esa parte solo vive en el navegador, ver
    // memoria del proyecto sobre localStorage aún sin migrar) — solo email_history persiste.
    const { rows: prospectosConHistorial } = await pool.query(
      `SELECT nombre, apellido, email_history, notas
       FROM prospectos WHERE tenant_id = $1 AND email_history IS NOT NULL AND jsonb_array_length(email_history) > 0
       ORDER BY fecha_ultima_actividad DESC NULLS LAST LIMIT 15`,
      [tenant.id]
    );
    // Derivaciones del chatbot a un asesor humano — casos donde un visitante de la web pidió
    // hablar con alguien real (motivo real, no inventado por el modelo).
    const { rows: derivaciones } = await pool.query(
      `SELECT motivo, visitante_correo, estado, created_at FROM chat_derivaciones
       WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [tenant.id]
    ).catch(() => ({ rows: [] }));
    // Objeciones de mercado que los brokers reportan en campo (precio, dólar/peso,
    // financiamiento, competencia...) — antes solo vivían en el módulo Conversión, Sara no
    // las veía y no podía responder "¿qué objeciones hemos tenido este mes?".
    const { rows: objecionesMercado } = await pool.query(
      `SELECT broker, prospecto, tipo, descripcion, canal, proyecto, created_at FROM broker_objections
       WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [tenant.id]
    ).catch(() => ({ rows: [] }));

    const hoy = new Date();
    const dataset = prospects.map(p => {
      const last = p.fecha_ultima_actividad || p.fecha_registro;
      const dias = last ? Math.floor((hoy - new Date(last)) / 86400000) : null;
      return { id: p.id, nombre: `${p.nombre} ${p.apellido}`, estado: p.estado, broker: p.broker_asignado || 'sin asignar', proyectos: (p.proyectos_interes || []).join(', '), presupuesto: p.presupuesto_usd || 0, diasSinActividad: dias, canal: p.canal || 'sin canal' };
    });
    const prospectsCtx = prospects.map(p => {
      const last = p.fecha_ultima_actividad || p.fecha_registro;
      const dias = last ? Math.floor((hoy - new Date(last)) / 86400000) : null;
      return `- [id:${p.id}] ${p.nombre} ${p.apellido} · ${p.estado} · canal: ${p.canal || 'sin canal'} · broker: ${p.broker_asignado || 'sin asignar'} · proyectos: ${(p.proyectos_interes || []).join(', ') || '—'} · presupuesto: $${p.presupuesto_usd || 0} · ${dias != null ? `${dias} días sin actividad` : 'sin actividad registrada'}${p.resumen_ia ? ` · consulta original: ${p.resumen_ia}` : ''}${(p.temas_interes || []).length > 0 ? ` · temas: ${(p.temas_interes || []).join(', ')}` : ''}`;
    }).join('\n');
    const draftsCtx = drafts.map(d => `- [id:${d.id}] ${d.status} · ${d.prioridad || ''} · para ${d.destinatario} · "${d.subject}" · origen: ${d.origen || 'manual'}`).join('\n');
    const alertsCtx = alerts.map(a => `- ${a.nivel}: ${a.nombre} ${a.apellido}`).join('\n');
    // "canal" distingue de dónde vino cada consulta (Chatbot SARA / Web / referido/etc.) —
    // así Sara puede responder "¿qué llegó por el chatbot esta semana?" o "¿qué me llegó por
    // la landing?" filtrando sobre datos reales en vez de suponer.
    const derivacionesCtx = derivaciones.map(d => `- ${d.visitante_correo || 'sin correo'} · motivo: ${d.motivo || 'sin especificar'} · estado: ${d.estado} · ${new Date(d.created_at).toISOString().slice(0, 10)}`).join('\n');
    const objecionesCtx = objecionesMercado.map(o => `- [${o.tipo}] ${o.prospecto || 'sin prospecto'} (${o.broker || 'sin broker'}) · ${o.proyecto || 'sin proyecto'} · canal: ${o.canal || '—'} · "${o.descripcion || ''}" · ${new Date(o.created_at).toISOString().slice(0, 10)}`).join('\n');
    // FAQs configuradas en Configuración → FAQs (32 respuestas ya redactadas y aprobadas) —
    // sin esto Sara no podía responder nada de lo que un cliente pregunta normalmente
    // (predial, financiamiento, residencia, etc.), solo hablar de pipeline comercial.
    const faqsPorCategoria = {};
    faqs.forEach(f => { (faqsPorCategoria[f.categoria || 'General'] ??= []).push(f); });
    const faqsCtx = Object.entries(faqsPorCategoria)
      .map(([cat, items]) => `${cat}:\n${items.map(f => `  - P: ${f.pregunta}\n    R: ${f.respuesta}`).join('\n')}`)
      .join('\n');
    // Inquietudes/solicitudes reales que los clientes ya dejaron por correo — para que Sara
    // pueda responder "¿qué me preguntó fulano?" o retomar el hilo de una solicitud pendiente.
    const emailsCtx = prospectosConHistorial.map(p => {
      const hilo = (p.email_history || []).slice(-3).map(e => `${e.direction === 'in' ? 'Cliente' : 'Sara'}: "${(e.subject || '').slice(0, 60)}" — ${(e.body || '').slice(0, 150).replace(/\n/g, ' ')}`).join(' | ');
      return `- ${p.nombre} ${p.apellido}: ${hilo}${p.notas ? ` · Notas: ${p.notas.slice(0, 150)}` : ''}`;
    }).join('\n');

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    // Memoria persistente: antes cada chat vivía solo en el navegador y se perdía al
    // recargar — ahora se recupera lo que ESTE usuario habló con Sara (hilo por usuario) y,
    // si la pregunta nombra a un cliente conocido, también lo que se habló SOBRE ese
    // cliente (hilo por prospecto), sin importar quién preguntó antes.
    const hiloUsuario = await agentMemory.loadThread(tenant.id, 'SARA', 'user', user);
    const clienteMencionado = prospects.find(p => question.toLowerCase().includes(`${p.nombre} ${p.apellido}`.toLowerCase().trim()));
    const hiloCliente = clienteMencionado ? await agentMemory.loadThread(tenant.id, 'SARA', 'prospecto', clienteMencionado.id) : null;

    const systemPrompt = `Eres Sara, Directora de Experiencia de Cliente de ${tenant.name}. Atiendes CUALQUIER pregunta de servicio al cliente: dudas frecuentes sobre Panamá/impuestos/residencia/financiamiento (FAQs), inquietudes o solicitudes que un cliente ya dejó por correo, por la landing, o por el chatbot (canal en cada prospecto), objeciones de mercado que reportan los brokers, y también preguntas de pipeline comercial (prospectos, mensajes, alertas). No te limites solo a lo comercial — si preguntan algo que está en las FAQs, respóndelo directamente con esa información aprobada. Usa siempre datos reales del contexto, nunca inventes. Si el dato no está en el contexto, dilo explícitamente en vez de suponer. Responde en español, tono directo y profesional, sin relleno. Menciona el nombre completo del prospecto cuando lo cites, para que quede identificable.
${hiloUsuario.summary ? `\nMEMORIA DE CONVERSACIONES ANTERIORES CON ESTE USUARIO:\n${hiloUsuario.summary}\n` : ''}${hiloCliente?.summary ? `\nMEMORIA PREVIA SOBRE ${clienteMencionado.nombre} ${clienteMencionado.apellido} (de conversaciones anteriores, con cualquier usuario):\n${hiloCliente.summary}\n` : ''}
CAMPOS DISPONIBLES para consultar_datos (dataset de prospectos): id, nombre, estado, broker, proyectos, presupuesto, diasSinActividad, canal.

PROSPECTOS RECIENTES (incluye canal de origen — Chatbot SARA/Web/referido/etc. — y la consulta original si vino de landing/chatbot):
${prospectsCtx || '(sin prospectos)'}

MENSAJES/BORRADORES RECIENTES:
${draftsCtx || '(sin mensajes)'}

PREGUNTAS FRECUENTES (FAQs configuradas, respuestas ya aprobadas — úsalas tal cual):
${faqsCtx || '(sin FAQs configuradas)'}

INQUIETUDES/SOLICITUDES RECIENTES DE CLIENTES (últimos correos por prospecto):
${emailsCtx || '(sin correos registrados)'}

SOLICITUDES DEL CHATBOT PARA HABLAR CON UN ASESOR (derivaciones reales):
${derivacionesCtx || '(sin derivaciones registradas)'}

OBJECIONES DE MERCADO REPORTADAS POR BROKERS (precio, dólar/peso, financiamiento, competencia, etc.):
${objecionesCtx || '(sin objeciones registradas)'}

ALERTAS ACTIVAS:
${alertsCtx || '(sin alertas)'}

Si te piden redactar/generar una respuesta para un cliente (sobre una FAQ, una inquietud, una derivación), usa la herramienta proponer_borrador_respuesta — SIEMPRE queda como borrador pendiente de aprobación en el Buzón, nunca se envía sola; dilo así al confirmar. Si la pregunta requiere información de otra área (estado de pago, estado legal, un insight de mercado), usa consultar_a_otro_agente en vez de suponer — es de solo lectura. Si necesitas un dato real del mundo, usa buscar_en_internet. Si te piden agendar una cita, usa consultar_calendario y luego proponer_cita — siempre queda pendiente de confirmación humana.`;
    const herramientasExtraSara = [{
      schema: {
        type: 'function',
        function: {
          name: 'proponer_borrador_respuesta',
          description: 'Crea un borrador de correo de respuesta a un cliente, dirigido al Buzón para aprobación humana — NUNCA se envía automáticamente. Úsala cuando te pidan "redacta/responde a X" sobre una FAQ, inquietud o derivación.',
          parameters: {
            type: 'object', additionalProperties: false,
            properties: {
              prospectoId: { type: 'integer', description: 'id del prospecto, tal como aparece en el dataset de prospectos' },
              asunto: { type: 'string' },
              cuerpo: { type: 'string', description: 'Cuerpo del correo — profesional, cálido, basado en las FAQs/contexto real, nunca inventado.' },
            },
            required: ['prospectoId', 'asunto', 'cuerpo'],
          },
        },
      },
      ejecutar: async (args) => {
        if (!args.prospectoId) return { error: 'Falta prospectoId' };
        const { rows } = await pool.query('SELECT nombre, apellido, correo FROM prospectos WHERE id = $1 AND tenant_id = $2', [args.prospectoId, tenant.id]);
        if (rows.length === 0) return { error: 'Cliente no encontrado en prospectos' };
        const p = rows[0];
        const draftId = `draft-sara-${Date.now()}`;
        await pool.query(
          `INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, prioridad, origen, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
          [draftId, tenant.id, `${p.nombre} ${p.apellido} (${p.correo || 'sin correo'})`, 'Servicio al Cliente', args.asunto, args.cuerpo, 'pending', 'media', 'sara_ia']
        );
        return { creado: true, draftId, mensaje: 'Borrador creado, pendiente de aprobación humana en el Buzón antes de enviarse.' };
      },
    }, {
      schema: {
        type: 'function',
        function: {
          name: 'consultar_a_otro_agente',
          description: 'Consulta de SOLO LECTURA a otro agente especialista del equipo, usando SU contexto real. Úsala cuando la pregunta requiera cruzar con otra área — ej. estado de pago (Cartera) o estado legal (Legal) de un cliente. El otro agente responde, pero no ejecuta ninguna acción.',
          parameters: {
            type: 'object', additionalProperties: false,
            properties: {
              agente: { type: 'string', enum: ['CAMILO', 'SOFIA', 'VALERIA', 'ISABELLA', 'CARTERA', 'LEGAL'] },
              pregunta: { type: 'string' },
            },
            required: ['agente', 'pregunta'],
          },
        },
      },
      ejecutar: async (args) => {
        if (!args.agente || !AGENT_PERSONAS[args.agente]) return { error: 'Agente inválido' };
        try {
          const otro = await buildAgentContext(tenant, args.agente);
          const otroPrompt = `Eres ${AGENT_PERSONAS[args.agente]} Te está consultando internamente Sara (Directora de Experiencia de Cliente), no un usuario humano — responde directo y conciso con datos reales de tu contexto, sin saludos ni relleno. Si el dato no está en tu contexto, dilo explícitamente.

CAMPOS DISPONIBLES para consultar_datos: ${otro.camposDisponibles || 'nombre'}.

${otro.contextText}`;
          const { answer: respuestaOtro } = await chatConHerramientas(openai, otroPrompt, otro.dataset, [], args.pregunta, [], run?.id, args.agente);
          return { agenteConsultado: args.agente, respuesta: respuestaOtro };
        } catch (err) {
          return { error: `No se pudo consultar a ${args.agente}: ${err.message}` };
        }
      },
    }, ...herramientasBase(openai, tenant, user, 'SARA')];
    // El historial persistido reemplaza al `history` que mandaba el cliente — ese vivía
    // solo en el navegador y se perdía en cada recarga; el hilo guardado en agent_threads
    // es ahora la fuente de verdad de la conversación (ver agentMemory.js).
    const historialParaModelo = hiloUsuario.messages.length > 0 ? hiloUsuario.messages : history;
    // Planificación multi-paso (ver planificarSiNecesario): solo para preguntas que
    // realmente encadenan varios pasos — una consulta directa no paga este costo extra.
    const plan = await planificarSiNecesario(openai, question, run?.id);
    const systemPromptConPlan = plan.requierePlan
      ? `${systemPrompt}\n\nPLAN A SEGUIR PARA ESTA RESPUESTA (síguelo en orden, un paso a la vez, usando las herramientas que necesites en cada uno, antes de dar la respuesta final):\n${plan.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : systemPrompt;
    const { answer, promptTokens, completionTokens } = await chatConHerramientas(openai, systemPromptConPlan, dataset, historialParaModelo, question, herramientasExtraSara, run?.id, 'SARA');
    const citados = prospects.filter(p => answer.includes(`${p.nombre} ${p.apellido}`))
      .map(p => ({ id: p.id, nombre: `${p.nombre} ${p.apellido}` }));

    await agentMemory.saveTurn(openai, tenant.id, 'SARA', 'user', user, question, answer);
    for (const c of citados.slice(0, 3)) {
      await agentMemory.saveTurn(openai, tenant.id, 'SARA', 'prospecto', c.id, question, answer);
    }

    await finishAgentRun(run?.id, {
      status: 'completado',
      tokensEstimados: promptTokens + completionTokens,
      promptTokens, completionTokens,
      model: AGENT_MODEL_CONFIG.SARA.model,
    });
    res.json({ answer, citas: citados, plan: plan.requierePlan ? plan.pasos : null });
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
  CARTERA: 'Andrea, Directora de Cartera y Cobranza. Conoces el estado de pago de cada cliente activo — plan de cuotas, vencimientos, mora, riesgo (verde/amarillo/rojo) y responsable de cada cuenta.',
  LEGAL: 'Mónica, Directora Legal. Conoces el expediente documental de cada cliente en proceso de compra — qué documentos están firmados, pendientes o en trámite, quién es el responsable de cada uno y las fechas límite.',
};
// Construye el contexto de UN agente (dataset/contextText/citas) — extraído como función
// independiente para que pueda llamarse dos veces: 1) para responder normalmente, y 2)
// desde la herramienta consultar_a_otro_agente cuando un agente necesita el contexto real
// de otro para responder algo cruzado (ej. Andrea preguntándole a Mónica por un cliente).
// Herramientas base compartidas por los 7 agentes (además de consultar_datos y
// consultar_a_otro_agente, que cada endpoint ya arma por separado): búsqueda web real y
// calendario interno del CRM (tabla `citas`, la misma que usa la Agenda de Brokers). Antes
// ningún agente podía ver más allá de los datos internos del CRM ni proponer una cita real
// — Camilo en particular era "VP de Investigación" sin poder investigar nada fuera del CRM.
function herramientasBase(openai, tenant, user, agentActual) {
  return [
    {
      schema: {
        type: 'function',
        function: {
          name: 'buscar_en_internet',
          description: 'Busca información REAL y actual en internet (noticias, tendencias de mercado, competencia, tipo de cambio, indicadores económicos). Úsala cuando la pregunta requiera un dato del mundo real que no está en el CRM — nunca inventes una cifra o tendencia de mercado sin buscarla.',
          parameters: {
            type: 'object', additionalProperties: false,
            properties: { consulta: { type: 'string', description: 'Qué buscar, en lenguaje natural — específico, ej. "tendencia mercado inmobiliario de lujo Panamá 2026" en vez de "mercado".' } },
            required: ['consulta'],
          },
        },
      },
      ejecutar: async (args) => {
        try {
          const resp = await openai.responses.create({ model: 'gpt-4o-mini', tools: [{ type: 'web_search_preview' }], input: args.consulta });
          return { resultado: resp.output_text || 'Sin resultados.' };
        } catch (err) {
          return { error: `No se pudo buscar en internet: ${err.message}` };
        }
      },
    },
    {
      schema: {
        type: 'function',
        function: {
          name: 'consultar_calendario',
          description: 'Consulta las citas ya agendadas en el calendario interno del CRM (Agenda de Brokers) en un rango de fechas — úsala ANTES de proponer_cita para no chocar con algo ya agendado.',
          parameters: {
            type: 'object', additionalProperties: false,
            properties: {
              fecha_inicio: { type: 'string', description: 'YYYY-MM-DD' },
              fecha_fin: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['fecha_inicio', 'fecha_fin'],
          },
        },
      },
      ejecutar: async (args) => {
        try {
          const { rows } = await pool.query(
            `SELECT prospecto_nombre, proyecto, fecha, hora, estado FROM citas
             WHERE tenant_id = $1 AND fecha >= $2 AND fecha <= $3 ORDER BY fecha, hora`,
            [tenant.id, args.fecha_inicio, args.fecha_fin]
          );
          return { citas: rows.map(r => ({ cliente: r.prospecto_nombre, proyecto: r.proyecto, fecha: fmtDateOnly(r.fecha), hora: r.hora, estado: r.estado })) };
        } catch (err) {
          return { error: err.message };
        }
      },
    },
    {
      schema: {
        type: 'function',
        function: {
          name: 'proponer_cita',
          description: 'Propone una cita en el calendario interno del CRM (Agenda de Brokers) — queda con estado "pendiente" para que un broker/humano la confirme, NUNCA se agenda como confirmada automáticamente. Úsala cuando te pidan "agenda/propón una llamada/reunión con X".',
          parameters: {
            type: 'object', additionalProperties: false,
            properties: {
              prospectoId: { type: 'integer', description: 'id del cliente' },
              fecha: { type: 'string', description: 'YYYY-MM-DD' },
              hora: { type: 'string', description: 'HH:MM' },
              notas: { type: 'string' },
            },
            required: ['prospectoId', 'fecha', 'hora'],
          },
        },
      },
      ejecutar: async (args) => {
        if (!args.prospectoId) return { error: 'Falta prospectoId' };
        try {
          const { rows } = await pool.query('SELECT nombre, apellido, correo, proyectos_interes FROM prospectos WHERE id = $1 AND tenant_id = $2', [args.prospectoId, tenant.id]);
          if (rows.length === 0) return { error: 'Cliente no encontrado en prospectos' };
          const p = rows[0];
          const { rows: creada } = await pool.query(
            `INSERT INTO citas (tenant_id, prospecto_id, prospecto_email, prospecto_nombre, proyecto, fecha, hora, canal, notas, estado, fuente)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10) RETURNING id`,
            [tenant.id, args.prospectoId, p.correo, `${p.nombre} ${p.apellido}`, (p.proyectos_interes || [])[0] || null, args.fecha, args.hora, 'agente_ia', args.notas || `Propuesta por ${agentActual}`, `agente_ia_${agentActual.toLowerCase()}`]
          );
          return { creada: true, citaId: creada[0].id, mensaje: 'Cita creada con estado "pendiente" en la Agenda de Brokers — un broker debe confirmarla, no se agenda sola.' };
        } catch (err) {
          return { error: err.message };
        }
      },
    },
  ];
}

async function buildAgentContext(tenant, agent) {
    let contextText = '';
    let prospectsForCitas = [];
    let dataset = [];
    let camposDisponibles = '';

    if (agent === 'CAMILO') {
      const { rows: insights } = await pool.query(
        `SELECT id, titulo, resumen, tipo, impacto, status, fecha FROM camilo_insights
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [tenant.id]
      );
      // Camilo hacía inteligencia de mercado leyendo solo sus propios insights pasados —
      // nunca veía la señal cruda que los origina: objeciones reales que reportan los
      // brokers en campo, y la demanda real (qué proyectos/canales concentran los
      // prospectos). Sin esto no podía detectar un patrón nuevo, solo repetir lo ya escrito.
      const { rows: objeciones } = await pool.query(
        `SELECT tipo, descripcion, proyecto, canal, created_at FROM broker_objections
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 40`,
        [tenant.id]
      ).catch(() => ({ rows: [] }));
      const { rows: demandaRows } = await pool.query(
        `SELECT proyectos_interes, canal FROM prospectos WHERE tenant_id = $1 AND fecha_registro > NOW() - INTERVAL '90 days'`,
        [tenant.id]
      );
      const porProyecto = {}, porCanal = {};
      demandaRows.forEach(p => {
        (p.proyectos_interes || []).forEach(pr => { porProyecto[pr] = (porProyecto[pr] || 0) + 1; });
        const c = p.canal || 'sin canal'; porCanal[c] = (porCanal[c] || 0) + 1;
      });
      const demandaCtx = `Por proyecto (últimos 90 días): ${Object.entries(porProyecto).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}: ${n}`).join(', ') || 'sin datos'}\nPor canal: ${Object.entries(porCanal).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}: ${n}`).join(', ') || 'sin datos'}`;
      const objecionesCtx = objeciones.map(o => `- [${o.tipo}] ${o.proyecto || 'sin proyecto'} · canal: ${o.canal || '—'} · "${o.descripcion || ''}" · ${new Date(o.created_at).toISOString().slice(0, 10)}`).join('\n');
      dataset = insights.map(i => ({ nombre: i.titulo, tipo: i.tipo, impacto: i.impacto, status: i.status, fecha: i.fecha }));
      camposDisponibles = 'nombre (título del insight), tipo, impacto, status, fecha';
      contextText = `INSIGHTS DE MERCADO RECIENTES (ya publicados):\n${insights.map(i => `- [${i.tipo}/${i.impacto}] ${i.titulo} — ${i.resumen || ''} (${i.status}, ${i.fecha})`).join('\n') || '(sin insights)'}\n\nSEÑAL CRUDA DE DEMANDA (para detectar patrones NUEVOS, no repetir insights ya escritos):\n${demandaCtx}\n\nOBJECIONES DE MERCADO REPORTADAS POR BROKERS EN CAMPO:\n${objecionesCtx || '(sin objeciones registradas)'}`;
    } else if (agent === 'SOFIA') {
      const { rows: profiles } = await pool.query(
        `SELECT sp.prospecto_id, sp.arquetipo, sp.confianza, sp.senales, p.nombre, p.apellido, p.proyectos_interes
         FROM sofia_profiles sp JOIN prospectos p ON sp.prospecto_id = p.id
         WHERE sp.tenant_id = $1 ORDER BY sp.updated_at DESC LIMIT 40`,
        [tenant.id]
      );
      // Sofía solo veía sus propios perfiles ya calculados — nunca la materia prima real
      // (resumen_ia, temas_interes, canal) de prospectos SIN perfil aún, así que no podía
      // proponer un arquetipo nuevo con base en la consulta original del cliente.
      const { rows: sinPerfil } = await pool.query(
        `SELECT p.id, p.nombre, p.apellido, p.canal, p.resumen_ia, p.temas_interes, p.presupuesto_usd, p.proyectos_interes
         FROM prospectos p LEFT JOIN sofia_profiles sp ON sp.prospecto_id = p.id
         WHERE p.tenant_id = $1 AND sp.prospecto_id IS NULL ORDER BY p.fecha_registro DESC LIMIT 25`,
        [tenant.id]
      );
      const sinPerfilCtx = sinPerfil.map(p => `- [id:${p.id}] ${p.nombre} ${p.apellido} · canal: ${p.canal || 'sin canal'} · presupuesto: $${p.presupuesto_usd || 0} · proyectos: ${(p.proyectos_interes || []).join(', ') || '—'}${p.resumen_ia ? ` · consulta original: ${p.resumen_ia}` : ''}${(p.temas_interes || []).length > 0 ? ` · temas: ${(p.temas_interes || []).join(', ')}` : ''}`).join('\n');
      prospectsForCitas = profiles.map(p => ({ id: p.prospecto_id, nombre: `${p.nombre} ${p.apellido}` })).concat(sinPerfil.map(p => ({ id: p.id, nombre: `${p.nombre} ${p.apellido}` })));
      dataset = profiles.map(p => ({ id: p.prospecto_id, nombre: `${p.nombre} ${p.apellido}`, arquetipo: p.arquetipo, confianza: p.confianza, proyectos: (p.proyectos_interes || []).join(', ') }));
      camposDisponibles = 'id, nombre, arquetipo, confianza (número 0-100), proyectos';
      contextText = `PERFILES PSICOGRÁFICOS YA CALCULADOS:\n${profiles.map(p => `- [id:${p.prospecto_id}] ${p.nombre} ${p.apellido} · arquetipo: ${p.arquetipo} · confianza: ${p.confianza}% · proyectos: ${(p.proyectos_interes || []).join(', ') || '—'} · señales: ${(p.senales || []).join('; ')}`).join('\n') || '(sin perfiles aún)'}\n\nPROSPECTOS SIN PERFIL AÚN (candidatos a analizar — usa actualizar_perfil_psicografico si te piden perfilarlos):\n${sinPerfilCtx || '(todos los prospectos recientes ya tienen perfil)'}`;
    } else if (agent === 'VALERIA') {
      const { rows: drafts } = await pool.query(
        `SELECT id, canal, asunto, status, type, tags, date FROM valeria_drafts
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [tenant.id]
      );
      // Valeria redactaba copy sin ver ni los insights de mercado de Camilo (qué está
      // pasando, qué objeciones hay que rebatir) ni la distribución de arquetipos de Sofía
      // (a quién le está hablando) — el copy salía genérico, no dirigido.
      const { rows: insightsCamilo } = await pool.query(
        `SELECT titulo, resumen, tipo, impacto FROM camilo_insights WHERE tenant_id = $1 AND status != 'aplicado' ORDER BY created_at DESC LIMIT 15`,
        [tenant.id]
      ).catch(() => ({ rows: [] }));
      const { rows: arquetipos } = await pool.query(
        `SELECT arquetipo, COUNT(*)::int AS n FROM sofia_profiles WHERE tenant_id = $1 GROUP BY arquetipo ORDER BY n DESC`,
        [tenant.id]
      ).catch(() => ({ rows: [] }));
      const insightsCtx = insightsCamilo.map(i => `- [${i.tipo}/${i.impacto}] ${i.titulo} — ${i.resumen || ''}`).join('\n');
      const arquetiposCtx = arquetipos.map(a => `${a.arquetipo}: ${a.n} cliente(s)`).join(', ');
      dataset = drafts.map(d => ({ nombre: d.asunto || d.canal || d.type, canal: d.canal || d.type, status: d.status, tags: (d.tags || []).join(', '), fecha: d.date }));
      camposDisponibles = 'nombre (asunto), canal, status, tags, fecha';
      contextText = `CONTENIDO/CAMPAÑAS RECIENTES:\n${drafts.map(d => `- [${d.status}] ${d.canal || d.type} · "${d.asunto || ''}" · ${(d.tags || []).join(', ')} · ${d.date}`).join('\n') || '(sin contenido generado aún)'}\n\nINSIGHTS DE MERCADO DE CAMILO (sin aplicar aún — úsalos para fundamentar el copy):\n${insightsCtx || '(sin insights pendientes)'}\n\nDISTRIBUCIÓN DE ARQUETIPOS DE CLIENTES (Sofía) — a quién le hablas:\n${arquetiposCtx || '(sin perfiles aún)'}`;
    } else if (agent === 'ISABELLA') {
      const { rows: scripts } = await pool.query(
        `SELECT id, canal, asunto, status, type, tags, date FROM isabella_scripts
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [tenant.id]
      );
      // Mismo problema que Valeria: Isabella producía guiones sin ver insights de mercado
      // ni arquetipos, y sin ver el calendario de Valeria — riesgo real de duplicar el
      // mismo tema en video que ya se está cubriendo en copy/newsletter.
      const { rows: insightsCamilo } = await pool.query(
        `SELECT titulo, resumen, tipo, impacto FROM camilo_insights WHERE tenant_id = $1 AND status != 'aplicado' ORDER BY created_at DESC LIMIT 15`,
        [tenant.id]
      ).catch(() => ({ rows: [] }));
      const { rows: arquetipos } = await pool.query(
        `SELECT arquetipo, COUNT(*)::int AS n FROM sofia_profiles WHERE tenant_id = $1 GROUP BY arquetipo ORDER BY n DESC`,
        [tenant.id]
      ).catch(() => ({ rows: [] }));
      const { rows: calendarioValeria } = await pool.query(
        `SELECT asunto, canal, tags, date FROM valeria_drafts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 15`,
        [tenant.id]
      ).catch(() => ({ rows: [] }));
      const insightsCtx = insightsCamilo.map(i => `- [${i.tipo}/${i.impacto}] ${i.titulo} — ${i.resumen || ''}`).join('\n');
      const arquetiposCtx = arquetipos.map(a => `${a.arquetipo}: ${a.n} cliente(s)`).join(', ');
      const calendarioCtx = calendarioValeria.map(d => `- "${d.asunto || ''}" (${d.canal}) · ${(d.tags || []).join(', ')} · ${d.date}`).join('\n');
      dataset = scripts.map(s => ({ nombre: s.asunto || s.canal || s.type, canal: s.canal || s.type, status: s.status, tags: (s.tags || []).join(', '), fecha: s.date }));
      camposDisponibles = 'nombre (asunto), canal, status, tags, fecha';
      contextText = `GUIONES DE VIDEO RECIENTES:\n${scripts.map(s => `- [${s.status}] ${s.canal || s.type} · "${s.asunto || ''}" · ${(s.tags || []).join(', ')} · ${s.date}`).join('\n') || '(sin guiones generados aún)'}\n\nINSIGHTS DE MERCADO DE CAMILO (sin aplicar aún):\n${insightsCtx || '(sin insights pendientes)'}\n\nDISTRIBUCIÓN DE ARQUETIPOS DE CLIENTES (Sofía):\n${arquetiposCtx || '(sin perfiles aún)'}\n\nCALENDARIO DE COPY DE VALERIA (evita duplicar el mismo tema en video):\n${calendarioCtx || '(sin contenido de Valeria aún)'}`;
    } else if (agent === 'CARTERA') {
      const { rows: carteras } = await pool.query(
        `SELECT id, prospecto_id, prospecto_nombre, proyecto, unidad, precio_total, moneda, fecha_separacion,
                fecha_escritura, fecha_entrega, modalidad, responsable, cuotas
         FROM carteras WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 40`,
        [tenant.id]
      );
      prospectsForCitas = carteras.filter(c => c.prospecto_id).map(c => ({ id: c.prospecto_id, nombre: c.prospecto_nombre }));
      const hoyC = new Date().toISOString().slice(0, 10);
      // Cruce con Legal: qué clientes de cartera NO tienen la escritura pública firmada —
      // antes Cartera y Legal eran islas separadas, ningún agente veía "en mora Y sin
      // escritura" (la combinación de riesgo más grave: dinero comprometido sin título).
      const prospectoIds = carteras.filter(c => c.prospecto_id).map(c => c.prospecto_id);
      const { rows: escrituras } = prospectoIds.length > 0
        ? await pool.query(
            `SELECT prospecto_id, status FROM legal_docs WHERE tenant_id = $1 AND doc_key = 'escritura_publica' AND prospecto_id = ANY($2::int[])`,
            [tenant.id, prospectoIds]
          )
        : { rows: [] };
      const escrituraPorProspecto = {};
      escrituras.forEach(e => { escrituraPorProspecto[e.prospecto_id] = e.status; });
      // OJO — el shape real de cada cuota (columna JSONB `cuotas`) usa `estado` y
      // `fecha_vencimiento`, NO `status`/`fecha` (ver CuotaCartera en el frontend). Un bug
      // anterior aquí leía esos campos equivocados: siempre daban `undefined`, así que TODAS
      // las cuotas —incluidas las ya pagadas— contaban como "pendientes" y la comparación de
      // fecha vencida nunca podía dar cierto, por lo que Andrea reportaba "sin mora" siempre,
      // aunque sí hubiera. Además el `riesgo` NO se lee de una columna guardada (puede quedar
      // desactualizada) — se recalcula aquí con la MISMA regla que el semáforo real del
      // Panel de Mando (ver calcRiesgo() en el frontend): rojo si hay al menos una cuota
      // vencida (vencida, o pendiente con fecha ya pasada); amarillo si la próxima pendiente
      // vence en los próximos 10 días; verde en cualquier otro caso.
      // Mismo principio que en LEGAL (ver comentario ahí abajo): el conteo/clasificación
      // por riesgo se resuelve UNA vez aquí en código — nunca se le pide al modelo que
      // cuente cuántos clientes son rojo/amarillo/verde a partir de la lista de texto.
      const carterasCalc = carteras.map(c => {
        const cuotas = Array.isArray(c.cuotas) ? c.cuotas : [];
        // monto > 0: una cuota "manual" creada como placeholder y nunca completada queda
        // en $0 — no es deuda real y no debe poder marcar a nadie en mora (caso real:
        // Adriana Bustamante y Gustavo Peña, corregido 2026-08-28: ver limpieza de datos).
        const pendientes = cuotas.filter(q => q.estado !== 'pagada' && q.monto > 0);
        const vencidas = pendientes.filter(q => q.estado === 'vencida' || (q.estado === 'pendiente' && q.fecha_vencimiento < hoyC));
        const proxima = pendientes.filter(q => q.fecha_vencimiento >= hoyC).sort((a, b) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''))[0];
        const diasProxima = proxima ? Math.round((new Date(proxima.fecha_vencimiento).getTime() - new Date(hoyC).getTime()) / 86400000) : null;
        // Sin plan de pagos (cuotas = []) NO es lo mismo que "al día" — al día implica un
        // plan real que se está cumpliendo; sin plan es un caso aparte que no debe leerse
        // como buen comportamiento de pago (caso real: Andrés Felipe Martínez, María Isabel
        // Rodríguez, ambos sin cuotas cargadas).
        const riesgo = cuotas.length === 0 ? 'sin_plan' : vencidas.length > 0 ? 'rojo' : (diasProxima !== null && diasProxima <= 10) ? 'amarillo' : 'verde';
        // Promesas de pago incumplidas: una cuota con `compromiso` (fecha/monto que el
        // cliente prometió pagar) que sigue sin pagarse después de esa fecha — la señal más
        // fuerte de riesgo de cobranza real, más que solo "está vencida" una vez.
        const promesasIncumplidas = cuotas.filter(q => q.compromiso && q.estado !== 'pagada' && q.compromiso.fecha && q.compromiso.fecha < hoyC).length;
        const sinEscritura = c.prospecto_id ? (escrituraPorProspecto[c.prospecto_id] !== 'firmado' && escrituraPorProspecto[c.prospecto_id] !== 'archivado') : null;
        return { c, vencidas, pendientes, proxima, diasProxima, riesgo, promesasIncumplidas, sinEscritura };
      });
      const RIESGO_LABEL = { rojo: 'En mora', amarillo: 'Atención (vence ≤10 días)', verde: 'Al día', sin_plan: 'Sin plan de pagos cargado (no es "al día", simplemente no se ha configurado un plan aún)' };
      const porRiesgo = { rojo: [], amarillo: [], verde: [], sin_plan: [] };
      carterasCalc.forEach(x => porRiesgo[x.riesgo].push(x.c.prospecto_nombre));
      const totalMora = carterasCalc.reduce((s, x) => s + x.vencidas.reduce((s2, q) => s2 + Number(q.monto || 0), 0), 0);
      const resumenRiesgo = Object.entries(porRiesgo).map(([r, nombres]) => `- ${RIESGO_LABEL[r]}: ${nombres.length} cliente(s)${nombres.length > 0 ? ` — ${nombres.join(', ')}` : ''}`).join('\n');
      // Casos compuestos: mora + sin escritura, la combinación de riesgo más grave que
      // ningún agente por separado podía ver antes.
      const moraSinEscritura = carterasCalc.filter(x => x.riesgo === 'rojo' && x.sinEscritura);
      const moraSinEscrituraCtx = moraSinEscritura.length > 0
        ? moraSinEscritura.map(x => `- ${x.c.prospecto_nombre} (${x.c.proyecto}) · en mora $${x.vencidas.reduce((s, q) => s + Number(q.monto || 0), 0).toLocaleString()} · escritura: ${escrituraPorProspecto[x.c.prospecto_id] || 'no iniciada'}`).join('\n')
        : '(ningún cliente en mora está simultáneamente sin escritura firmada)';
      // Proyección de flujo de caja: suma de cuotas pendientes (no vencidas) por mes, próximos
      // 6 meses — antes solo vivía como vista en Reportes, Andrea no la tenía en su contexto.
      const proyeccionMeses = {};
      carterasCalc.forEach(x => {
        x.pendientes.filter(q => q.fecha_vencimiento >= hoyC).forEach(q => {
          const mes = (q.fecha_vencimiento || '').slice(0, 7);
          if (!mes) return;
          proyeccionMeses[mes] = (proyeccionMeses[mes] || 0) + Number(q.monto || 0);
        });
      });
      const proyeccionCtx = Object.entries(proyeccionMeses).sort(([a], [b]) => a.localeCompare(b)).slice(0, 6)
        .map(([mes, monto]) => `- ${mes}: $${monto.toLocaleString()}`).join('\n') || '(sin cuotas pendientes futuras)';
      dataset = carterasCalc.map(({ c, vencidas, diasProxima, riesgo, promesasIncumplidas, sinEscritura }) => ({
        id: c.prospecto_id, nombre: c.prospecto_nombre, proyecto: c.proyecto, riesgo,
        montoMora: vencidas.reduce((s, q) => s + Number(q.monto || 0), 0),
        cuotasEnMora: vencidas.length, precioTotal: Number(c.precio_total || 0), moneda: c.moneda,
        modalidad: c.modalidad, responsable: c.responsable || 'sin asignar', diasProximaCuota: diasProxima,
        promesasIncumplidas, sinEscritura: sinEscritura ? 1 : 0,
      }));
      camposDisponibles = 'id, nombre, proyecto, riesgo (rojo|amarillo|verde), montoMora, cuotasEnMora, precioTotal, moneda, modalidad, responsable, diasProximaCuota, promesasIncumplidas, sinEscritura (1=sin escritura firmada, 0=con escritura)';
      // Antes solo se mostraba el RESUMEN por cliente (conteo/monto de mora + la próxima
      // cuota) — nunca el detalle cuota por cuota, así que Andrea no podía responder "dame
      // las fechas de las cuotas vencidas" ni "cuál era la programación de pagos completa":
      // ese dato simplemente no estaba en su contexto, no era un problema de razonamiento.
      // Se agrega aquí el PLAN DE PAGOS COMPLETO (todas las cuotas, con concepto/monto/
      // estado/fecha/compromiso) por cliente — el modelo no necesita "contar" nada de esto,
      // solo leer y citar filas ya dadas, que es donde sí es confiable.
      const planPagosCtx = carterasCalc.map(({ c, pendientes }) => {
        const cuotas = Array.isArray(c.cuotas) ? c.cuotas : [];
        if (cuotas.length === 0) return null;
        const detalle = cuotas
          .slice()
          .sort((a, b) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''))
          .map(q => {
            const vencida = q.estado !== 'pagada' && q.monto > 0 && (q.estado === 'vencida' || (q.estado === 'pendiente' && q.fecha_vencimiento < hoyC));
            return `${q.concepto || 'Cuota'}: $${Number(q.monto || 0).toLocaleString()} · vence ${q.fecha_vencimiento || 'sin fecha'} · estado: ${q.estado}${vencida ? ' (VENCIDA)' : ''}${q.compromiso?.fecha ? ` · promesa de pago: ${q.compromiso.fecha}${q.compromiso.monto ? ` por $${Number(q.compromiso.monto).toLocaleString()}` : ''}` : ''}`;
          }).join('; ');
        return `- ${c.prospecto_nombre} (${c.proyecto}): ${detalle}`;
      }).filter(Boolean).join('\n');
      contextText = `RESUMEN NUMÉRICO YA CALCULADO — cítalo literal, NUNCA vuelvas a contar la lista de abajo tú mismo (los LLM cuentan mal listas largas):\n${resumenRiesgo}\n- Monto total en mora (todos los clientes rojo): $${totalMora.toLocaleString()}\n\nREGLA DEL MÓDULO (importante, no la inventes distinto): el riesgo de un cliente es ROJO (en mora) si tiene al menos una cuota con estado "vencida", o "pendiente" cuya fecha de vencimiento ya pasó. Es AMARILLO (atención) si no está en mora pero su próxima cuota pendiente vence en los próximos 10 días. Es VERDE (al día) en cualquier otro caso. Una cuota "pagada" nunca cuenta para mora, sin importar cuándo se pagó.\n\nCLIENTES EN CARTERA:\n${carterasCalc.map(({ c, vencidas, proxima, diasProxima, riesgo, promesasIncumplidas, sinEscritura }) => {
        return `- [id:${c.prospecto_id}] ${c.prospecto_nombre} · ${c.proyecto}${c.unidad ? ' - ' + c.unidad : ''} · $${Number(c.precio_total || 0).toLocaleString()} ${c.moneda} · modalidad: ${c.modalidad} · riesgo: ${riesgo} (${RIESGO_LABEL[riesgo]}) · responsable: ${c.responsable || 'sin asignar'} · ${vencidas.length > 0 ? `${vencidas.length} cuota(s) EN MORA por $${vencidas.reduce((s, q) => s + Number(q.monto || 0), 0).toLocaleString()}` : 'sin mora'}${promesasIncumplidas > 0 ? ` · ${promesasIncumplidas} PROMESA(S) DE PAGO INCUMPLIDA(S)` : ''}${proxima ? ` · próxima cuota: ${proxima.concepto || 'cuota'} $${Number(proxima.monto || 0).toLocaleString()} vence ${proxima.fecha_vencimiento} (${diasProxima}d)` : ' · sin cuotas pendientes'} · escritura: ${fmtDateOnly(c.fecha_escritura) || 'sin fecha'} · entrega: ${fmtDateOnly(c.fecha_entrega) || 'sin fecha'} · estado escritura pública: ${sinEscritura === null ? 'sin expediente legal' : sinEscritura ? 'PENDIENTE DE FIRMAR' : 'firmada'}`;
      }).join('\n') || '(sin clientes en cartera aún)'}\n\nCLIENTES EN MORA Y SIN ESCRITURA FIRMADA (riesgo compuesto — el más grave):\n${moraSinEscrituraCtx}\n\nPROYECCIÓN DE FLUJO DE CAJA — cuotas pendientes por mes (próximos 6 meses con datos):\n${proyeccionCtx}\n\nPLAN DE PAGOS COMPLETO POR CLIENTE (todas las cuotas, con fecha, monto, estado y promesa de pago si existe — usa esto para responder cualquier pregunta sobre fechas o programación de cuotas):\n${planPagosCtx || '(sin planes de pago cargados)'}`;
    } else if (agent === 'LEGAL') {
      const { rows: docs } = await pool.query(
        `SELECT ld.prospecto_id, ld.doc_key, ld.status, ld.responsable, ld.due_date, ld.attached_date,
                p.nombre, p.apellido
         FROM legal_docs ld JOIN prospectos p ON ld.prospecto_id = p.id
         WHERE ld.tenant_id = $1 ORDER BY ld.updated_at DESC LIMIT 200`,
        [tenant.id]
      );
      const byProspecto = {};
      docs.forEach(d => {
        const key = d.prospecto_id;
        if (!byProspecto[key]) byProspecto[key] = { id: d.prospecto_id, nombre: `${d.nombre} ${d.apellido}`, docs: [] };
        byProspecto[key].docs.push(d);
      });
      prospectsForCitas = Object.values(byProspecto).map((c) => ({ id: c.id, nombre: c.nombre }));
      // Misma agrupación de fases y misma regla de "fase actual" que usa el Panel de Mando
      // real del módulo (ver PHASES / overallPhase() en el frontend) — sin esto, el modelo
      // adivinaba su propia regla (ej. "solo aparecen en Reserva los que YA tienen la carta de
      // reserva firmada") que es exactamente al revés de cómo funciona: Reserva es la fase de
      // ARRANQUE por defecto, un cliente permanece ahí precisamente MIENTRAS le falten esos
      // documentos, no cuando ya los completó.
      const FASES_LEGAL = {
        reserva: ['carta_reserva', 'pago_separacion', 'due_diligence', 'propuesta_comercial'],
        promesa: ['promesa_compraventa', 'cert_tradicion', 'estudio_titulo', 'paz_salvo', 'poder_notarial'],
        escritura: ['escritura_publica', 'registro_rph', 'dian_documentos', 'acta_entrega', 'llaves'],
      };
      const faseCompleta = (docsCliente, keys) => keys.every(k => {
        const d = docsCliente.find(x => x.doc_key === k);
        return d && (d.status === 'firmado' || d.status === 'archivado');
      });
      const faseActual = (docsCliente) => {
        if (faseCompleta(docsCliente, FASES_LEGAL.escritura)) return 'Escritura Completa (trámite legal terminado)';
        if (faseCompleta(docsCliente, FASES_LEGAL.promesa)) return 'En Trámite Notarial (fase Escritura & Registro)';
        if (faseCompleta(docsCliente, FASES_LEGAL.reserva)) return 'Promesa en Proceso (fase Promesa)';
        return 'Reserva en Curso (fase Reserva — aún le faltan documentos de esta fase, por eso sigue aquí)';
      };
      // Un LLM lee la lista de abajo y CUENTA a ojo cuántos clientes hay en cada fase —
      // eso falla sistemáticamente en cuanto la lista pasa de un puñado de líneas (el
      // usuario ya lo confirmó en producción: Mónica dijo 6, la cifra real era 8). La
      // corrección no es pedirle "que tenga más cuidado" — un LLM no cuenta bien listas de
      // texto, punto. La única corrección real es que el conteo NUNCA lo haga el modelo:
      // se calcula aquí en código (fuente de verdad determinística) y se le entrega ya
      // resuelto, con instrucción explícita de citarlo tal cual en vez de volver a contar.
      const porFase = { 'Reserva en Curso (fase Reserva — aún le faltan documentos de esta fase, por eso sigue aquí)': [], 'Promesa en Proceso (fase Promesa)': [], 'En Trámite Notarial (fase Escritura & Registro)': [], 'Escritura Completa (trámite legal terminado)': [] };
      Object.values(byProspecto).forEach((c) => { porFase[faseActual(c.docs)].push(c.nombre); });
      const resumenFases = Object.entries(porFase).map(([fase, nombres]) => `- ${fase.split(' (')[0]}: ${nombres.length} cliente(s)${nombres.length > 0 ? ` — ${nombres.join(', ')}` : ''}`).join('\n');
      const FASE_CORTA = { 'Reserva en Curso (fase Reserva — aún le faltan documentos de esta fase, por eso sigue aquí)': 'Reserva', 'Promesa en Proceso (fase Promesa)': 'Promesa', 'En Trámite Notarial (fase Escritura & Registro)': 'Escritura', 'Escritura Completa (trámite legal terminado)': 'Completo' };
      dataset = Object.values(byProspecto).map((c) => {
        const pendientes = c.docs.filter(d => d.status !== 'firmado' && d.status !== 'archivado');
        const vencidosLegal = pendientes.filter(d => d.due_date && fmtDateOnly(d.due_date) < new Date().toISOString().slice(0, 10));
        return { id: c.id, nombre: c.nombre, fase: FASE_CORTA[faseActual(c.docs)], documentosTotales: c.docs.length, documentosPendientes: pendientes.length, documentosVencidos: vencidosLegal.length };
      });
      camposDisponibles = 'id, nombre, fase (Reserva|Promesa|Escritura|Completo), documentosTotales, documentosPendientes, documentosVencidos';
      // Cruce con Cartera: un cliente con documentos vencidos Y en mora de pago es el caso
      // de mayor riesgo compuesto del pipeline — antes Mónica no veía el estado de pago,
      // solo el expediente documental, así que no podía priorizar por riesgo real de negocio.
      const { rows: carterasLegal } = await pool.query(
        `SELECT prospecto_id, prospecto_nombre, cuotas FROM carteras WHERE tenant_id = $1`,
        [tenant.id]
      ).catch(() => ({ rows: [] }));
      const hoyLegal = new Date().toISOString().slice(0, 10);
      const moraPorProspecto = {};
      carterasLegal.forEach(c => {
        const cuotas = Array.isArray(c.cuotas) ? c.cuotas : [];
        const vencidas = cuotas.filter(q => q.monto > 0 && q.estado !== 'pagada' && (q.estado === 'vencida' || (q.estado === 'pendiente' && q.fecha_vencimiento < hoyLegal)));
        if (vencidas.length > 0) moraPorProspecto[c.prospecto_id] = vencidas.reduce((s, q) => s + Number(q.monto || 0), 0);
      });
      const riesgoCompuesto = Object.values(byProspecto).filter((c) => {
        const vencidosLegal = c.docs.filter(d => d.status !== 'firmado' && d.status !== 'archivado' && d.due_date && fmtDateOnly(d.due_date) < hoyLegal);
        return vencidosLegal.length > 0 && moraPorProspecto[c.id] > 0;
      });
      const riesgoCompuestoCtx = riesgoCompuesto.length > 0
        ? riesgoCompuesto.map((c) => `- ${c.nombre}: documentos legales vencidos Y en mora de pago por $${moraPorProspecto[c.id].toLocaleString()} — riesgo compuesto, prioridad alta`).join('\n')
        : '(ningún cliente combina documentos vencidos con mora de pago)';
      contextText = `RESUMEN NUMÉRICO YA CALCULADO — cítalo literal, NUNCA vuelvas a contar la lista de abajo tú mismo (los LLM cuentan mal listas largas, este número ya está verificado por código):\n${resumenFases}\n\nREGLA DEL MÓDULO (importante, no la inventes distinto): un cliente aparece en la fase "Reserva" del Panel de Mando precisamente MIENTRAS le falten documentos de esa fase — Reserva es el punto de partida por defecto de todo cliente, no un estado que se alcanza al completar la reserva. Un cliente pasa a la siguiente fase (Promesa, luego Escritura) solo cuando TERMINA todos los documentos de la fase actual.\n\nCASOS DE RIESGO COMPUESTO (documentos vencidos + mora de pago simultáneos — cruce con Cartera):\n${riesgoCompuestoCtx}\n\nEXPEDIENTES LEGALES POR CLIENTE:\n${Object.values(byProspecto).map((c) => {
        const pendientes = c.docs.filter(d => d.status !== 'firmado' && d.status !== 'archivado');
        const vencidosLegal = pendientes.filter(d => d.due_date && fmtDateOnly(d.due_date) < new Date().toISOString().slice(0, 10));
        return `- ${c.nombre}: fase actual — ${faseActual(c.docs)}. ${c.docs.length} documentos totales, ${pendientes.length} pendientes${vencidosLegal.length > 0 ? ` (${vencidosLegal.length} VENCIDOS)` : ''}. Detalle: ${c.docs.map(d => `${LEGAL_DOC_LABELS[d.doc_key] || d.doc_key} [${d.status}${d.responsable ? `, resp: ${d.responsable}` : ''}${d.due_date ? `, vence ${fmtDateOnly(d.due_date)}` : ''}]`).join('; ')}`;
      }).join('\n') || '(sin expedientes legales aún)'}`;
    }
  return { contextText, prospectsForCitas, dataset, camposDisponibles };
}

app.post('/api/agents/chat', async (req, res) => {
  const tenant = await resolveTenant(req);
  const user = resolveUser(req);
  const { agent, question, history = [] } = req.body;
  if (!agent || !AGENT_PERSONAS[agent]) return res.status(400).json({ error: 'agent inválido (CAMILO | SOFIA | VALERIA | ISABELLA | CARTERA | LEGAL)' });
  if (!question || !question.trim()) return res.status(400).json({ error: 'question requerida' });

  const run = await startAgentRun(tenant.id, user, agent, 'chat');
  try {
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) { await finishAgentRun(run?.id, { status: 'error', errorDetalle: 'OpenAI API Key requerida.' }); return res.status(500).json({ error: 'OpenAI API Key requerida.' }); }

    const { contextText, prospectsForCitas, dataset, camposDisponibles } = await buildAgentContext(tenant, agent);

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    // Cada agente puede además PROPONER una acción real, no solo informar — un borrador o
    // insight que cae a la cola de aprobación correspondiente (Buzón, Configuración →
    // Contenido/Guiones, Panel de Camilo, Perfiles de Sofía), NUNCA se envía/publica sola.
    // Mismo patrón en los 6 agentes: crear ≠ enviar. Instrucciones por agente se arman abajo
    // en INSTRUCCION_ACCION y se insertan en el systemPrompt.
    const herramientasExtra = [{
      schema: {
        type: 'function',
        function: {
          name: 'consultar_a_otro_agente',
          description: 'Consulta de SOLO LECTURA a otro agente especialista del equipo, usando SU contexto real (nunca inventes lo que otro agente sabría). Úsala cuando la pregunta requiera cruzar con otra área — ej. Andrea (Cartera) preguntándole a Mónica (Legal) el estado de escritura de un cliente, o Valeria preguntándole a Camilo el detalle de un insight. El otro agente responde, pero no ejecuta ninguna acción — solo informa.',
          parameters: {
            type: 'object', additionalProperties: false,
            properties: {
              agente: { type: 'string', enum: ['CAMILO', 'SOFIA', 'VALERIA', 'ISABELLA', 'CARTERA', 'LEGAL'], description: 'El agente al que le preguntas — nunca el mismo que está respondiendo.' },
              pregunta: { type: 'string', description: 'La pregunta puntual a consultarle, en su propio idioma natural.' },
            },
            required: ['agente', 'pregunta'],
          },
        },
      },
      ejecutar: async (args) => {
        if (!args.agente || !AGENT_PERSONAS[args.agente]) return { error: 'Agente inválido' };
        if (args.agente === agent) return { error: 'No puedes consultarte a ti mismo — ya tienes tu propio contexto.' };
        try {
          const otro = await buildAgentContext(tenant, args.agente);
          const otroPrompt = `Eres ${AGENT_PERSONAS[args.agente]} Te está consultando internamente otro agente del equipo (${AGENT_PERSONAS[agent].split(',')[0]}), no un usuario humano — responde directo y conciso con datos reales de tu contexto, sin saludos ni relleno. Si el dato no está en tu contexto, dilo explícitamente.

CAMPOS DISPONIBLES para consultar_datos: ${otro.camposDisponibles || 'nombre'}.

${otro.contextText}`;
          // Sin herramientasExtra aquí — evita que un agente encadene consultas a otros
          // agentes indefinidamente (máximo 1 nivel de profundidad).
          const { answer } = await chatConHerramientas(openai, otroPrompt, otro.dataset, [], args.pregunta, [], run?.id, args.agente);
          return { agenteConsultado: args.agente, respuesta: answer };
        } catch (err) {
          return { error: `No se pudo consultar a ${args.agente}: ${err.message}` };
        }
      },
    }];
    let notaAccion = '';
    const INSTRUCCION_ACCION = {};
    if (agent === 'CARTERA') {
      herramientasExtra.push({
        schema: {
          type: 'function',
          function: {
            name: 'proponer_borrador_cobranza',
            description: 'Crea un borrador de correo de cobranza para un cliente en mora, dirigido al Buzón para aprobación humana — NUNCA se envía automáticamente. Úsala cuando te pidan "redacta/genera un correo de cobranza para X" o similar.',
            parameters: {
              type: 'object', additionalProperties: false,
              properties: {
                prospectoId: { type: 'integer', description: 'id del cliente, tal como aparece en el dataset de cartera' },
                asunto: { type: 'string' },
                cuerpo: { type: 'string', description: 'Cuerpo del correo — tono profesional y firme pero respetuoso, con el monto exacto en mora y la acción esperada.' },
              },
              required: ['prospectoId', 'asunto', 'cuerpo'],
            },
          },
        },
        ejecutar: async (args) => {
          if (!args.prospectoId) return { error: 'Falta prospectoId' };
          const { rows } = await pool.query('SELECT nombre, apellido, correo FROM prospectos WHERE id = $1 AND tenant_id = $2', [args.prospectoId, tenant.id]);
          if (rows.length === 0) return { error: 'Cliente no encontrado en prospectos' };
          const p = rows[0];
          const draftId = `draft-cobranza-${Date.now()}`;
          await pool.query(
            `INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, prioridad, origen, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
            [draftId, tenant.id, `${p.nombre} ${p.apellido} (${p.correo || 'sin correo'})`, 'Cobranza', args.asunto, args.cuerpo, 'pending', 'alta', 'cobranza_ia']
          );
          notaAccion = `Borrador de cobranza creado para ${p.nombre} ${p.apellido} — pendiente de aprobación en el Buzón, no se envió.`;
          return { creado: true, draftId, mensaje: 'Borrador creado, pendiente de aprobación humana en el Buzón antes de enviarse.' };
        },
      });
      INSTRUCCION_ACCION.CARTERA = ' Si te piden generar/redactar un correo de cobranza para un cliente, usa la herramienta proponer_borrador_cobranza — SIEMPRE queda como borrador pendiente de aprobación, nunca se envía sola; dilo así al confirmar.';
    } else if (agent === 'LEGAL') {
      herramientasExtra.push({
        schema: {
          type: 'function',
          function: {
            name: 'proponer_recordatorio_documento',
            description: 'Crea un borrador de correo recordatorio sobre un documento legal pendiente o vencido, dirigido al Buzón para aprobación humana — NUNCA se envía automáticamente. Úsala cuando te pidan "redacta/genera un recordatorio para X sobre su documento Y" o similar.',
            parameters: {
              type: 'object', additionalProperties: false,
              properties: {
                prospectoId: { type: 'integer', description: 'id del cliente, tal como aparece en el dataset legal' },
                asunto: { type: 'string' },
                cuerpo: { type: 'string', description: 'Cuerpo del correo — tono profesional, nombrando el documento exacto pendiente/vencido y la fecha límite si existe.' },
              },
              required: ['prospectoId', 'asunto', 'cuerpo'],
            },
          },
        },
        ejecutar: async (args) => {
          if (!args.prospectoId) return { error: 'Falta prospectoId' };
          const { rows } = await pool.query('SELECT nombre, apellido, correo FROM prospectos WHERE id = $1 AND tenant_id = $2', [args.prospectoId, tenant.id]);
          if (rows.length === 0) return { error: 'Cliente no encontrado en prospectos' };
          const p = rows[0];
          const draftId = `draft-legal-${Date.now()}`;
          await pool.query(
            `INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, prioridad, origen, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
            [draftId, tenant.id, `${p.nombre} ${p.apellido} (${p.correo || 'sin correo'})`, 'Legal', args.asunto, args.cuerpo, 'pending', 'media', 'legal_ia']
          );
          notaAccion = `Recordatorio legal creado para ${p.nombre} ${p.apellido} — pendiente de aprobación en el Buzón, no se envió.`;
          return { creado: true, draftId, mensaje: 'Borrador creado, pendiente de aprobación humana en el Buzón antes de enviarse.' };
        },
      });
      // Mónica solo veía metadatos del documento adjunto (nombre/fecha/status) — nunca su
      // contenido real. Descarga el archivo desde attached_url y se lo pasa al modelo como
      // archivo real (no como texto pegado) para que pueda citar datos concretos de adentro.
      herramientasExtra.push({
        schema: {
          type: 'function',
          function: {
            name: 'leer_documento_adjunto',
            description: 'Lee el CONTENIDO REAL de un documento legal adjunto (no solo su nombre/status) y devuelve un resumen de lo que dice — úsala cuando te pidan algo específico del contenido de un documento ya adjuntado (ej. "¿qué dice la escritura de X?").',
            parameters: {
              type: 'object', additionalProperties: false,
              properties: {
                prospectoId: { type: 'integer' },
                docKey: { type: 'string', description: 'clave del documento, ej. escritura_publica, promesa_compraventa' },
              },
              required: ['prospectoId', 'docKey'],
            },
          },
        },
        ejecutar: async (args) => {
          try {
            const { rows } = await pool.query(
              'SELECT attached_url, attached_name FROM legal_docs WHERE prospecto_id = $1 AND doc_key = $2 AND tenant_id = $3',
              [args.prospectoId, args.docKey, tenant.id]
            );
            if (rows.length === 0 || !rows[0].attached_url) return { error: 'Ese documento no tiene un archivo adjuntado todavía.' };
            const { attached_url, attached_name } = rows[0];
            const descarga = await fetch(attached_url);
            if (!descarga.ok) return { error: `No se pudo descargar el archivo adjunto (${descarga.status}) — puede que el enlace requiera acceso o ya no exista.` };
            const buf = Buffer.from(await descarga.arrayBuffer());
            if (buf.length > 15 * 1024 * 1024) return { error: 'El archivo es demasiado grande para leerlo aquí (>15MB).' };
            const contentType = descarga.headers.get('content-type') || 'application/pdf';
            const resp = await openai.responses.create({
              model: 'gpt-4o-mini',
              input: [{
                role: 'user',
                content: [
                  { type: 'input_file', file_data: `data:${contentType};base64,${buf.toString('base64')}`, filename: attached_name || 'documento.pdf' },
                  { type: 'input_text', text: 'Resume en español, en máximo 200 palabras, el contenido real de este documento — nombres, fechas, montos, cláusulas relevantes si las hay.' },
                ],
              }],
            });
            return { resumen: resp.output_text || 'No se pudo extraer contenido del documento.' };
          } catch (err) {
            return { error: `No se pudo leer el documento: ${err.message}` };
          }
        },
      });
      INSTRUCCION_ACCION.LEGAL = ' Si te piden generar/redactar un recordatorio sobre un documento pendiente o vencido, usa la herramienta proponer_recordatorio_documento — SIEMPRE queda como borrador pendiente de aprobación, nunca se envía sola; dilo así al confirmar. Si te preguntan algo sobre el CONTENIDO real de un documento ya adjuntado (no solo su status), intenta SIEMPRE leer_documento_adjunto primero — nunca respondas "no tengo acceso" sin haberlo intentado; si la herramienta devuelve error (sin archivo adjuntado, enlace roto), ahí sí dilo explícitamente.';
    } else if (agent === 'CAMILO') {
      herramientasExtra.push({
        schema: {
          type: 'function',
          function: {
            name: 'crear_insight_mercado',
            description: 'Publica un nuevo insight de inteligencia de mercado en el Panel de Camilo, con status "nuevo" (pendiente de revisión, no se aplica solo). Úsala cuando detectes un patrón real en la señal de demanda u objeciones que aún NO esté en los insights ya publicados.',
            parameters: {
              type: 'object', additionalProperties: false,
              properties: {
                titulo: { type: 'string' },
                resumen: { type: 'string', description: 'Explicación del patrón detectado, citando los datos reales (proyecto/canal/objeción) que lo sustentan.' },
                tipo: { type: 'string', enum: ['mercado', 'crisis', 'oportunidad', 'audiencia'] },
                impacto: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
              },
              required: ['titulo', 'resumen', 'tipo', 'impacto'],
            },
          },
        },
        ejecutar: async (args) => {
          const id = `insight-ia-${Date.now()}`;
          const fecha = new Date().toISOString().slice(0, 10);
          await pool.query(
            `INSERT INTO camilo_insights (id, tenant_id, titulo, resumen, tipo, impacto, status, fecha, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,'nuevo',$7,NOW(),NOW())`,
            [id, tenant.id, args.titulo, args.resumen, args.tipo, args.impacto, fecha]
          );
          notaAccion = `Insight "${args.titulo}" publicado en el Panel de Camilo — pendiente de revisión.`;
          return { creado: true, insightId: id, mensaje: 'Insight publicado con status "nuevo", pendiente de revisión del equipo.' };
        },
      });
      INSTRUCCION_ACCION.CAMILO = ' Si detectas un patrón real y nuevo en la señal de demanda u objeciones (no ya cubierto en los insights publicados), usa la herramienta crear_insight_mercado para dejarlo registrado — queda como "nuevo", pendiente de revisión, dilo así al confirmar.';
    } else if (agent === 'SOFIA') {
      herramientasExtra.push({
        schema: {
          type: 'function',
          function: {
            name: 'actualizar_perfil_psicografico',
            description: 'Crea o actualiza el perfil psicográfico (arquetipo) de un cliente, basado en su consulta original, temas de interés y presupuesto. Úsala cuando te pidan "perfila a X" o "qué arquetipo es X".',
            parameters: {
              type: 'object', additionalProperties: false,
              properties: {
                prospectoId: { type: 'integer', description: 'id del prospecto, tal como aparece en el dataset' },
                arquetipo: { type: 'string', enum: ['Coleccionista de Estatus', 'Preservador de Legado', 'Decisor Racional', 'Comprador Aspiracional'] },
                confianza: { type: 'integer', description: 'confianza del análisis, 0-100' },
                senales: { type: 'array', items: { type: 'string' }, description: 'señales concretas del contexto que sustentan el arquetipo (canal, temas, presupuesto, consulta original)' },
              },
              required: ['prospectoId', 'arquetipo', 'confianza', 'senales'],
            },
          },
        },
        ejecutar: async (args) => {
          if (!args.prospectoId) return { error: 'Falta prospectoId' };
          const { rows } = await pool.query('SELECT nombre, apellido FROM prospectos WHERE id = $1 AND tenant_id = $2', [args.prospectoId, tenant.id]);
          if (rows.length === 0) return { error: 'Cliente no encontrado en prospectos' };
          const p = rows[0];
          await pool.query(
            `INSERT INTO sofia_profiles (prospecto_id, tenant_id, arquetipo, confianza, senales, updated_at)
             VALUES ($1,$2,$3,$4,$5,NOW())
             ON CONFLICT (prospecto_id) DO UPDATE SET arquetipo = $3, confianza = $4, senales = $5, updated_at = NOW()`,
            [args.prospectoId, tenant.id, args.arquetipo, args.confianza, JSON.stringify(args.senales || [])]
          );
          notaAccion = `Perfil psicográfico de ${p.nombre} ${p.apellido} actualizado: ${args.arquetipo} (${args.confianza}%).`;
          return { creado: true, mensaje: 'Perfil guardado en Sofía — ya visible en el módulo.' };
        },
      });
      INSTRUCCION_ACCION.SOFIA = ' Si te piden perfilar a un cliente sin perfil aún, usa la herramienta actualizar_perfil_psicografico con base en sus señales reales (canal, temas de interés, consulta original, presupuesto) — nunca inventes señales que no estén en el contexto.';
    } else if (agent === 'VALERIA') {
      herramientasExtra.push({
        schema: {
          type: 'function',
          function: {
            name: 'crear_borrador_contenido',
            description: 'Crea un borrador de copy/campaña en la cola de Contenido, con status "pending" (no se publica solo). Úsala cuando te pidan "redacta un post/newsletter/copy sobre X".',
            parameters: {
              type: 'object', additionalProperties: false,
              properties: {
                asunto: { type: 'string' },
                canal: { type: 'string', description: 'ej. LinkedIn, Newsletter, Email, Instagram' },
                contenido: { type: 'string', description: 'El copy completo redactado.' },
                tags: { type: 'array', items: { type: 'string' } },
              },
              required: ['asunto', 'canal', 'contenido'],
            },
          },
        },
        ejecutar: async (args) => {
          const id = `valeria-ia-${Date.now()}`;
          const fecha = new Date().toISOString().slice(0, 10);
          await pool.query(
            `INSERT INTO valeria_drafts (id, tenant_id, content, type, status, canal, asunto, tags, origen_agentivo, date, created_at, updated_at)
             VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,'ia_chat',$8,NOW(),NOW())`,
            [id, tenant.id, args.contenido, args.canal, args.canal, args.asunto, args.tags || [], fecha]
          );
          notaAccion = `Borrador de contenido "${args.asunto}" creado para ${args.canal} — pendiente de aprobación.`;
          return { creado: true, draftId: id, mensaje: 'Borrador creado con status "pending", pendiente de aprobación humana antes de publicarse.' };
        },
      });
      INSTRUCCION_ACCION.VALERIA = ' Si te piden redactar copy/contenido, usa la herramienta crear_borrador_contenido para dejarlo en la cola de aprobación — nunca se publica sola, dilo así al confirmar. Fundamenta el copy en los insights de mercado y arquetipos del contexto cuando aplique.';
    } else if (agent === 'ISABELLA') {
      herramientasExtra.push({
        schema: {
          type: 'function',
          function: {
            name: 'crear_guion_video',
            description: 'Crea un guion de video en la cola de Producción, con status "pending" (no se produce solo). Úsala cuando te pidan "genera un guion sobre X".',
            parameters: {
              type: 'object', additionalProperties: false,
              properties: {
                asunto: { type: 'string' },
                canal: { type: 'string', description: 'ej. Reel, Testimonial, Educativo' },
                contenido: { type: 'string', description: 'El guion completo redactado.' },
                tags: { type: 'array', items: { type: 'string' } },
              },
              required: ['asunto', 'canal', 'contenido'],
            },
          },
        },
        ejecutar: async (args) => {
          const id = `isabella-ia-${Date.now()}`;
          const fecha = new Date().toISOString().slice(0, 10);
          await pool.query(
            `INSERT INTO isabella_scripts (id, tenant_id, content, type, status, canal, asunto, tags, origen_agentivo, date, created_at, updated_at)
             VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,'ia_chat',$8,NOW(),NOW())`,
            [id, tenant.id, args.contenido, args.canal, args.canal, args.asunto, args.tags || [], fecha]
          );
          notaAccion = `Guion de video "${args.asunto}" creado para ${args.canal} — pendiente de aprobación.`;
          return { creado: true, scriptId: id, mensaje: 'Guion creado con status "pending", pendiente de aprobación humana antes de producirse.' };
        },
      });
      INSTRUCCION_ACCION.ISABELLA = ' Si te piden generar un guion de video, usa la herramienta crear_guion_video para dejarlo en la cola de aprobación — nunca se produce solo, dilo así al confirmar. Evita duplicar un tema que ya está en el calendario de copy de Valeria.';
    }
    herramientasExtra.push(...herramientasBase(openai, tenant, user, agent));

    // Memoria persistente (ver agentMemory.js): hilo por usuario (continuidad de trabajo de
    // quien pregunta) + hilo por registro citado (continuidad de caso — lo que se habló
    // sobre ESE cliente/registro, sin importar quién preguntó antes).
    const hiloUsuario = await agentMemory.loadThread(tenant.id, agent, 'user', user);
    const registroMencionado = prospectsForCitas.find(p => p.nombre && question.toLowerCase().includes(p.nombre.toLowerCase().trim()));
    const hiloRegistro = registroMencionado ? await agentMemory.loadThread(tenant.id, agent, 'prospecto', registroMencionado.id) : null;

    const systemPrompt = `Eres ${AGENT_PERSONAS[agent]} Trabajas para ${tenant.name}. Respondes preguntas del equipo comercial con datos reales del contexto — si el dato no está ahí, dilo explícitamente en vez de suponer. Menciona el nombre completo del cliente/registro cuando lo cites, para que quede identificable. Responde en español, tono directo y profesional, sin relleno. Si la pregunta requiere información de otra área (ej. estado legal, estado de pago, un insight de mercado, un perfil psicográfico), usa la herramienta consultar_a_otro_agente en vez de suponer — es de solo lectura, nunca ejecuta acciones por ti. Si necesitas un dato real del mundo (tendencia de mercado, tipo de cambio, noticia), usa buscar_en_internet en vez de inventarlo. Si te piden agendar/proponer una cita, usa consultar_calendario para ver disponibilidad y luego proponer_cita — SIEMPRE queda pendiente de confirmación humana.${INSTRUCCION_ACCION[agent] || ''}
${hiloUsuario.summary ? `\nMEMORIA DE CONVERSACIONES ANTERIORES CON ESTE USUARIO:\n${hiloUsuario.summary}\n` : ''}${hiloRegistro?.summary ? `\nMEMORIA PREVIA SOBRE ${registroMencionado.nombre} (de conversaciones anteriores, con cualquier usuario):\n${hiloRegistro.summary}\n` : ''}
CAMPOS DISPONIBLES para consultar_datos: ${camposDisponibles || 'nombre'}.

${contextText}`;
    const historialParaModelo = hiloUsuario.messages.length > 0 ? hiloUsuario.messages : history;
    // Planificación multi-paso (ver planificarSiNecesario): solo para preguntas que
    // realmente encadenan varios pasos — una consulta directa no paga este costo extra.
    const plan = await planificarSiNecesario(openai, question, run?.id);
    const systemPromptConPlan = plan.requierePlan
      ? `${systemPrompt}\n\nPLAN A SEGUIR PARA ESTA RESPUESTA (síguelo en orden, un paso a la vez, usando las herramientas que necesites en cada uno, antes de dar la respuesta final):\n${plan.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : systemPrompt;
    const { answer, promptTokens, completionTokens } = await chatConHerramientas(openai, systemPromptConPlan, dataset, historialParaModelo, question, herramientasExtra, run?.id, agent);
    const citados = prospectsForCitas.filter(p => answer.includes(p.nombre));

    await agentMemory.saveTurn(openai, tenant.id, agent, 'user', user, question, answer);
    for (const c of citados.slice(0, 3)) {
      await agentMemory.saveTurn(openai, tenant.id, agent, 'prospecto', c.id, question, answer);
    }

    await finishAgentRun(run?.id, {
      status: 'completado',
      tokensEstimados: promptTokens + completionTokens,
      promptTokens, completionTokens,
      model: (AGENT_MODEL_CONFIG[agent] || DEFAULT_MODEL_CONFIG).model,
    });
    res.json({ answer, citas: citados, plan: plan.requierePlan ? plan.pasos : null });
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
      from: `"Sara Valenzuela · Capital Brokers - Real Estate" <${process.env.SMTP_USER}>`,
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
// SETTINGS GENÉRICO (market-report, brand_profile, predial_tramos, etc.) — sin CREATE TABLE
// en ningún archivo de este repo pese a que ya se usaba (brand_profile), lo que sugiere que
// solo existe porque alguien la creó a mano en la base de producción. Se agrega defensivo
// para que un entorno nuevo (staging, otro tenant) no falle en el primer PUT.
// ==========================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        tenant_id TEXT NOT NULL,
        key TEXT NOT NULL,
        data JSONB,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (tenant_id, key)
      )
    `);
  } catch (e) { console.warn('settings table check:', e.message); }
})();

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
    const user = resolveUser(req);
    const { status } = req.body;
    await pool.query(
      'UPDATE camilo_insights SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
      [status, req.params.id, TENANT]
    );
    // Un insight que se marca "revisado"/"aplicado" es una aprobación — no hay concepto de
    // edición aquí (el insight no tiene un editor de contenido), así que siempre cuenta
    // como aprobado tal cual (ver agentFeedback.js).
    if (status === 'revisado' || status === 'aplicado') {
      await agentFeedback.registrar(TENANT, 'CAMILO', 'insight', req.params.id, 'approved_as_is', user).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/camilo/insights/:id', async (req, res) => {
  try {
    const user = resolveUser(req);
    await pool.query(
      'DELETE FROM camilo_insights WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    await agentFeedback.registrar(TENANT, 'CAMILO', 'insight', req.params.id, 'discarded', user).catch(() => {});
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
    const user = resolveUser(req);
    const d = req.body;
    // edited_by_human: se marca cada vez que este PATCH trae `content` — así, cuando más
    // tarde el status pase a aprobado, se sabe si hubo edición antes o no (ver
    // agentFeedback.js). Una vez marcado true no se revierte.
    const { rows: prevRows } = await pool.query('SELECT status, origen_agentivo, edited_by_human FROM valeria_drafts WHERE id = $1 AND tenant_id = $2', [req.params.id, TENANT]);
    const prev = prevRows[0];
    const seEdito = d.content !== undefined && d.content !== null;
    await pool.query(
      `UPDATE valeria_drafts SET
         status = COALESCE($1, status),
         aprobado_por = COALESCE($2, aprobado_por),
         fecha_aprobacion = COALESCE($3, fecha_aprobacion),
         notas_admin = COALESCE($4, notas_admin),
         content = COALESCE($5, content),
         edited_by_human = edited_by_human OR $6,
         updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8`,
      [d.status, d.aprobado_por, d.fecha_aprobacion, d.notas_admin, d.content, seEdito,
       req.params.id, TENANT]
    );
    // Feedback solo si esto fue generado por Valeria (origen_agentivo) y el status pasa a
    // aprobado/activo desde algo distinto (evita registrar dos veces el mismo evento).
    if (prev && prev.origen_agentivo === 'ia_chat' && (d.status === 'approved' || d.status === 'active') && prev.status !== d.status) {
      const decision = (prev.edited_by_human || seEdito) ? 'approved_edited' : 'approved_as_is';
      await agentFeedback.registrar(TENANT, 'VALERIA', 'content', req.params.id, decision, user).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/valeria/drafts/:id', async (req, res) => {
  try {
    const user = resolveUser(req);
    const { rows: existente } = await pool.query('SELECT origen_agentivo FROM valeria_drafts WHERE id = $1 AND tenant_id = $2', [req.params.id, TENANT]);
    await pool.query(
      'DELETE FROM valeria_drafts WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    if (existente[0]?.origen_agentivo === 'ia_chat') {
      await agentFeedback.registrar(TENANT, 'VALERIA', 'content', req.params.id, 'discarded', user).catch(() => {});
    }
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
    const user = resolveUser(req);
    const d = req.body;
    const { rows: prevRows } = await pool.query('SELECT status, origen_agentivo, edited_by_human FROM isabella_scripts WHERE id = $1 AND tenant_id = $2', [req.params.id, TENANT]);
    const prev = prevRows[0];
    const seEdito = d.content !== undefined && d.content !== null;
    await pool.query(
      `UPDATE isabella_scripts SET
         status = COALESCE($1, status),
         notas_admin = COALESCE($2, notas_admin),
         content = COALESCE($3, content),
         edited_by_human = edited_by_human OR $4,
         updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6`,
      [d.status, d.notas_admin, d.content, seEdito, req.params.id, TENANT]
    );
    if (prev && prev.origen_agentivo === 'ia_chat' && (d.status === 'approved' || d.status === 'active') && prev.status !== d.status) {
      const decision = (prev.edited_by_human || seEdito) ? 'approved_edited' : 'approved_as_is';
      await agentFeedback.registrar(TENANT, 'ISABELLA', 'script', req.params.id, decision, user).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/isabella/scripts/:id', async (req, res) => {
  try {
    const user = resolveUser(req);
    const { rows: existente } = await pool.query('SELECT origen_agentivo FROM isabella_scripts WHERE id = $1 AND tenant_id = $2', [req.params.id, TENANT]);
    await pool.query(
      'DELETE FROM isabella_scripts WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    if (existente[0]?.origen_agentivo === 'ia_chat') {
      await agentFeedback.registrar(TENANT, 'ISABELLA', 'script', req.params.id, 'discarded', user).catch(() => {});
    }
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

// Auto-crear tabla cartera_alerts (evita reenviar el mismo aviso de mora en <48h) — mismo
// patrón que legal_alerts, ver carteraMonitor.js.
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cartera_alerts (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        cartera_id TEXT NOT NULL,
        monto_mora NUMERIC NOT NULL DEFAULT 0,
        cuotas_en_mora INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) { console.warn('cartera_alerts table check:', e.message); }
})();

// Últimas alertas de mora generadas por el monitor — para mostrarlas en el CRM sin
// esperar a que llegue el correo (ej. un badge o lista en el módulo Cartera).
app.get('/api/cartera-alerts', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT ca.*, c.prospecto_nombre, c.proyecto
       FROM cartera_alerts ca JOIN carteras c ON c.id = ca.cartera_id
       WHERE ca.tenant_id = $1 ORDER BY ca.created_at DESC LIMIT 50`,
      [tenant.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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

// El perfil de inversor (renta/patrimonial/disfrute/mixto) que detecta el análisis del
// chatbot en /api/contact SIEMPRE se calculó, pero antes solo quedaba enterrado como texto
// dentro de `notas` — no se podía filtrar ni reportar por perfil de inversor en el CRM.
(async () => {
  try {
    await pool.query(`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS perfil_inversor TEXT`);
  } catch (e) { console.warn('prospectos perfil_inversor column check:', e.message); }
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
  startCarteraMonitor();
  startContentAgentsMonitor();
  startFeedbackMonitor();
});
