/**
 * agentAudit.js — Traza de auditoría de lo que cada agente REALMENTE hizo en una respuesta.
 *
 * `agent_runs` (ya existía) registra que un agente corrió, cuánto costó y si terminó bien —
 * pero no qué herramientas usó, con qué argumentos, ni qué le respondió otro agente si hubo
 * una consulta cruzada. Sin eso, si un cliente reclama "Andrea me mandó un correo raro" no
 * hay forma de reconstruir por qué el modelo llegó a esa respuesta.
 *
 * `agent_run_steps` guarda un renglón por CADA llamada a herramienta dentro de una
 * respuesta (ronda, nombre, argumentos, resultado, si fue exitosa, cuánto tardó) — la
 * bitácora completa de razonamiento de esa respuesta específica.
 */

const pool = require('./db');

async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_run_steps (
        id BIGSERIAL PRIMARY KEY,
        run_id BIGINT REFERENCES agent_runs(id) ON DELETE CASCADE,
        ronda INT NOT NULL,
        tool_name TEXT NOT NULL,
        args JSONB,
        resultado JSONB,
        ok BOOLEAN NOT NULL DEFAULT true,
        duracion_ms INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run ON agent_run_steps (run_id)`);
  } catch (e) { console.warn('agent_run_steps table check:', e.message); }
}
ensureTable();

// Trunca resultados/argumentos grandes antes de guardarlos — un dataset completo devuelto
// por consultar_datos puede pesar varios KB, y esto es para auditoría/depuración humana,
// no para reconstruir el dataset exacto (eso ya vive en las tablas de origen).
function truncar(valor, maxChars = 2000) {
  try {
    const s = JSON.stringify(valor);
    if (!s || s.length <= maxChars) return valor;
    return { _truncado: true, preview: s.slice(0, maxChars) + '…' };
  } catch (_) { return valor; }
}

async function registrarPaso(runId, ronda, toolName, args, resultado, ok, duracionMs) {
  if (!runId) return; // sin run_id (ej. consulta cruzada anidada) simplemente no se audita aparte
  try {
    await pool.query(
      `INSERT INTO agent_run_steps (run_id, ronda, tool_name, args, resultado, ok, duracion_ms, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [runId, ronda, toolName, JSON.stringify(truncar(args)), JSON.stringify(truncar(resultado)), ok, duracionMs]
    );
  } catch (e) { console.warn('[Auditoría] No se pudo registrar paso:', e.message); }
}

async function pasosDeRun(runId) {
  const { rows } = await pool.query(
    `SELECT ronda, tool_name, args, resultado, ok, duracion_ms, created_at FROM agent_run_steps WHERE run_id = $1 ORDER BY id ASC`,
    [runId]
  );
  return rows;
}

module.exports = { registrarPaso, pasosDeRun, ensureTable };
