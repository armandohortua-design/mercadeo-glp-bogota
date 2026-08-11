-- ============================================================
-- Migración 003: Estado persistente de agentes IA
-- Tablas: camilo_insights, valeria_drafts, isabella_scripts
-- Fecha: 2026-07-02
-- ============================================================

-- ── CAMILO: insights de inteligencia de mercado ─────────────
CREATE TABLE IF NOT EXISTS camilo_insights (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL DEFAULT 'tenant-glp-001',
  titulo            TEXT NOT NULL,
  resumen           TEXT,
  datos             TEXT,
  tipo              TEXT,          -- mercado | crisis | oportunidad | audiencia
  impacto           TEXT,          -- alto | medio | bajo
  fuentes           TEXT[],
  status            TEXT DEFAULT 'nuevo',  -- nuevo | revisado | aplicado
  acciones_sara     TEXT,
  acciones_valeria  TEXT,
  acciones_isabella TEXT,
  fecha             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── VALERIA: borradores de contenido ────────────────────────
CREATE TABLE IF NOT EXISTS valeria_drafts (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL DEFAULT 'tenant-glp-001',
  content           TEXT,
  type              TEXT,
  status            TEXT DEFAULT 'pending',  -- pending | approved | active
  canal             TEXT,
  asunto            TEXT,
  contexto          TEXT,
  tags              TEXT[],
  aprobado_por      TEXT,
  fecha_aprobacion  TEXT,
  notas_admin       TEXT,
  origen_agentivo   TEXT,
  date              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── ISABELLA: guiones de video ───────────────────────────────
CREATE TABLE IF NOT EXISTS isabella_scripts (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL DEFAULT 'tenant-glp-001',
  content          TEXT,
  type             TEXT,
  status           TEXT DEFAULT 'pending',  -- pending | approved | active
  canal            TEXT,
  asunto           TEXT,
  contexto         TEXT,
  tags             TEXT[],
  origen_agentivo  TEXT,
  notas_admin      TEXT,
  date             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_camilo_insights_tenant   ON camilo_insights(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_camilo_insights_fecha    ON camilo_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_valeria_drafts_tenant    ON valeria_drafts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_valeria_drafts_origen    ON valeria_drafts(origen_agentivo);
CREATE INDEX IF NOT EXISTS idx_isabella_scripts_tenant  ON isabella_scripts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_isabella_scripts_origen  ON isabella_scripts(origen_agentivo);

-- ── Columna para trigger autónomo de Sara (Tarea B.1) ────────
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS sara_auto_email_sent TIMESTAMPTZ;

ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS sara_cold_alert_sent TIMESTAMPTZ;
