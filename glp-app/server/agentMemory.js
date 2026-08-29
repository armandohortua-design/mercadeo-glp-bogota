/**
 * agentMemory.js — Memoria persistente de conversación para los 7 agentes IA.
 *
 * Antes cada chat vivía SOLO en el estado del navegador (`agentChats` en CRMDashboard.tsx):
 * al recargar la página o volver al día siguiente, el agente "olvidaba" todo — no había
 * continuidad real, cada pregunta era una consulta aislada aunque el usuario la sintiera
 * como una conversación.
 *
 * Dos hilos de memoria por agente, coexistiendo:
 *   - scope_type='user'      → recuerda lo que ESTE usuario del CRM le preguntó, sin
 *                               importar de qué cliente hablaban (continuidad de trabajo).
 *   - scope_type='prospecto' → recuerda lo que se habló SOBRE ESTE cliente, sin importar
 *                               quién preguntó (continuidad de caso, útil si dos brokers
 *                               consultan al mismo agente sobre el mismo cliente).
 *
 * Cada hilo guarda hasta MAX_RAW mensajes crudos + un resumen comprimido de lo anterior —
 * así la conversación no crece sin límite en tokens, pero tampoco se pierde el historial
 * completo (se resume, no se descarta).
 */

const pool = require('./db');

const MAX_RAW = 20; // mensajes crudos (user+assistant) que se mantienen sin resumir
const TRIM_TO = 12; // al resumir, cuántos mensajes recientes se dejan crudos

async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_threads (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        summary TEXT DEFAULT '',
        messages JSONB DEFAULT '[]',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, agent, scope_type, scope_id)
      )
    `);
  } catch (e) { console.warn('agent_threads table check:', e.message); }
}
ensureTable();

async function loadThread(tenantId, agent, scopeType, scopeId) {
  if (!scopeId) return { summary: '', messages: [] };
  const { rows } = await pool.query(
    `SELECT summary, messages FROM agent_threads WHERE tenant_id = $1 AND agent = $2 AND scope_type = $3 AND scope_id = $4`,
    [tenantId, agent, scopeType, String(scopeId)]
  );
  if (rows.length === 0) return { summary: '', messages: [] };
  return { summary: rows[0].summary || '', messages: Array.isArray(rows[0].messages) ? rows[0].messages : [] };
}

// Comprime los mensajes más antiguos en el resumen existente cuando el hilo crudo crece
// demasiado — usa el mismo modelo barato que ya usan los agentes, solo cuando hace falta.
async function comprimir(openai, summaryPrevio, mensajesViejos) {
  try {
    const transcript = mensajesViejos.map(m => `${m.role === 'user' ? 'Usuario' : 'Agente'}: ${m.content}`).join('\n');
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0.2, max_tokens: 220,
      messages: [
        { role: 'system', content: 'Resume en español, en máximo 120 palabras y en viñetas, los hechos y decisiones clave de esta conversación pasada — nombres de clientes, cifras, compromisos, acciones tomadas. No repitas saludo ni relleno, solo hechos útiles para retomar el hilo después.' },
        { role: 'user', content: `RESUMEN PREVIO (si existe, intégralo):\n${summaryPrevio || '(sin resumen previo)'}\n\nCONVERSACIÓN A RESUMIR:\n${transcript}` },
      ],
    });
    return resp.choices[0].message.content || summaryPrevio;
  } catch (err) {
    console.warn('[agentMemory] Error comprimiendo resumen:', err.message);
    return summaryPrevio; // si falla la compresión, no se pierde lo que ya había
  }
}

async function saveTurn(openai, tenantId, agent, scopeType, scopeId, userContent, assistantContent) {
  if (!scopeId || !userContent || !assistantContent) return;
  const current = await loadThread(tenantId, agent, scopeType, scopeId);
  let messages = [...current.messages, { role: 'user', content: userContent }, { role: 'assistant', content: assistantContent }];
  let summary = current.summary;

  if (messages.length > MAX_RAW) {
    const aResumir = messages.slice(0, messages.length - TRIM_TO);
    messages = messages.slice(messages.length - TRIM_TO);
    summary = await comprimir(openai, summary, aResumir);
  }

  await pool.query(
    `INSERT INTO agent_threads (tenant_id, agent, scope_type, scope_id, summary, messages, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (tenant_id, agent, scope_type, scope_id)
     DO UPDATE SET summary = $5, messages = $6, updated_at = NOW()`,
    [tenantId, agent, scopeType, String(scopeId), summary, JSON.stringify(messages)]
  );
}

module.exports = { loadThread, saveTurn, ensureTable };
