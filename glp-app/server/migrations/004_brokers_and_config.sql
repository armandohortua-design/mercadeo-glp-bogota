-- ============================================================
-- Migración 004: Brokers en base de datos + Reglas de Negocio configurables
-- Fecha: 2026-07-18
-- ============================================================

-- ── BROKERS: antes solo en localStorage, ahora compartido multi-usuario ──
CREATE TABLE IF NOT EXISTS brokers (
  id          SERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL DEFAULT 'tenant-glp-001',
  nombre      TEXT NOT NULL,
  empresa     TEXT,
  zona        TEXT,
  telefono    TEXT,
  email       TEXT,
  estado      TEXT DEFAULT 'activo',   -- activo | inactivo
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brokers_tenant ON brokers(tenant_id);

-- ── BUSINESS_CONFIG: reglas de negocio parametrizables desde Configuración ──
-- (probabilidad de cierre por etapa, días esperados por etapa, umbrales de alerta SARA, etc.)
CREATE TABLE IF NOT EXISTS business_config (
  tenant_id   TEXT PRIMARY KEY,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
