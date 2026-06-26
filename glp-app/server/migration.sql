-- =====================================================
-- MIGRACIÓN GLP CRM → SUPABASE (PostgreSQL)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- Tabla de Tenants (empresas licenciatarias)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active',
  contact JSONB DEFAULT '{}',
  smtp JSONB DEFAULT '{}',
  openai JSONB DEFAULT '{}',
  apollo JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Prospectos (CRM)
CREATE TABLE IF NOT EXISTS prospectos (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'tenant-glp-001',
  nombre TEXT NOT NULL,
  apellido TEXT,
  correo TEXT,
  telefono TEXT,
  direccion TEXT,
  ocupacion TEXT,
  empresa TEXT,
  linkedin TEXT,
  proyectos_interes JSONB DEFAULT '[]',
  forma_contacto TEXT,
  broker_asignado TEXT,
  presupuesto_usd NUMERIC,
  estado TEXT DEFAULT 'Lead Nuevo',
  canal TEXT DEFAULT 'Web',
  notas TEXT,
  historial JSONB DEFAULT '[]',
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  fecha_ultima_actividad TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Brokers
CREATE TABLE IF NOT EXISTS brokers (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'tenant-glp-001',
  nombre TEXT NOT NULL,
  empresa TEXT,
  zona TEXT,
  telefono TEXT,
  email TEXT,
  estado TEXT DEFAULT 'activo'
);

-- Tabla de Activos (inventario de propiedades)
CREATE TABLE IF NOT EXISTS activos (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'tenant-glp-001',
  proyecto TEXT NOT NULL,
  unidad TEXT NOT NULL,
  metros_cuadrados NUMERIC,
  habitaciones INTEGER,
  precio_usd NUMERIC,
  estado TEXT DEFAULT 'Disponible',
  detalles TEXT
);

-- Tabla de Bitácora
CREATE TABLE IF NOT EXISTS bitacora (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'tenant-glp-001',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  cliente TEXT,
  correo TEXT,
  whatsapp TEXT,
  proyecto TEXT,
  canal TEXT,
  correo_cliente TEXT,
  correo_admin TEXT,
  borrador_creado TEXT,
  mensaje TEXT
);

-- Tabla de Borradores (drafts)
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'tenant-glp-001',
  destinatario TEXT,
  project TEXT,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'pending',
  prioridad TEXT DEFAULT 'media',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Proyectos/Catálogo
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'tenant-glp-001',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas por tenant
CREATE INDEX IF NOT EXISTS idx_prospectos_tenant ON prospectos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_tenant ON bitacora(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drafts_tenant ON drafts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activos_tenant ON activos(tenant_id);

-- Tenant inicial: GLP Wealth Management
INSERT INTO tenants (id, name, domain, status, contact, smtp, openai, apollo)
VALUES (
  'tenant-glp-001',
  'GLP Wealth Management',
  'glp.com.pa',
  'active',
  '{"address": "2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá", "email": "info@glp.com.pa", "website": "www.glp.com.pa", "phone": "+507 836-5000"}',
  '{}',
  '{}',
  '{}'
) ON CONFLICT (id) DO NOTHING;
