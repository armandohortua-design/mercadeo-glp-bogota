-- ============================================================
-- Tabla: projects
-- Fuente única de verdad para los 18 proyectos GLP
-- Grupo 1: datos del producto (editables desde Catálogo/Portafolio)
-- Grupo 2: inteligencia de mercado (actualizable por Camilo)
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL DEFAULT 'tenant-glp-001',

  -- ── GRUPO 1: Datos del producto ──────────────────────────────
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,        -- 'Proyecto de Ciudad' | 'Ocean Reef Islands' | 'Playa Caracol'
  tipo            TEXT NOT NULL,        -- 'Residencia' | 'Hotelero'
  zone            TEXT NOT NULL,
  zone_short      TEXT,
  investor_type   TEXT,                 -- 'renta' | 'disfrute' | 'patrimonial'
  entrega         TEXT,
  construction    TEXT,
  bedrooms        TEXT,

  min_price       NUMERIC,
  max_price       NUMERIC,
  area_min        NUMERIC,
  area_max        NUMERIC,
  price_m2_min    NUMERIC,
  price_m2_max    NUMERIC,

  amenities       TEXT[],
  imagen          TEXT,                 -- URL de imagen principal (o upload)

  -- Ficha del producto (Catálogo)
  nota_valorizacion   TEXT,
  nota_demanda        TEXT,
  insight_producto    TEXT,

  -- ── GRUPO 2: Inteligencia de mercado (Camilo) ────────────────
  cap_rate_min        NUMERIC,
  cap_rate_max        NUMERIC,
  vacancy_def         NUMERIC,
  rent_suggest        NUMERIC,
  rent_m2_min         NUMERIC,
  rent_m2_max         NUMERIC,
  condominio_mes      NUMERIC,
  appreciation_def    NUMERIC,
  appreciation_note   TEXT,

  -- Datos de zona
  zona_colegios       TEXT,
  zona_supermercados  TEXT,
  zona_playa          TEXT,
  zona_entretenimiento TEXT,
  zona_salud          TEXT,
  zona_otros          TEXT,

  -- Indicadores de mercado
  velocidad_colocacion   TEXT,
  perfil_arrendatario    TEXT,
  fecha_actualizacion_mercado TEXT,

  -- ── Metadata ─────────────────────────────────────────────────
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_projects_updated_at();
