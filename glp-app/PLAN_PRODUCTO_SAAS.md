# Plan de Trabajo — CRM Inmobiliario · Versión SaaS Multi-cliente

**Fecha:** Julio 2026  
**Objetivo:** Convertir el CRM de GLP en un producto vendible/arrendable a otras promotoras inmobiliarias de la región.

---

## Diagnóstico: ¿Qué tan lejos estamos?

### El 85% ya es genérico

La arquitectura, todos los módulos de renderizado, la calculadora de inversión, el sistema de agentes IA, los reportes y el análisis gerencial son **100% reutilizables** sin cambiar una sola línea de lógica. Eso es la ventaja más grande.

### El 15% es específico de GLP

| Elemento | Tipo | Impacto |
|----------|------|---------|
| 18 proyectos del portafolio (Armonía, Bosco, The Palms…) | Datos | Alto |
| Prompts de agentes IA (contexto Panamá + Colombia) | Lógica | Alto |
| Perfil de marca (audiencias, diferenciadores, CTA) | Datos | Alto |
| Nombres de agentes (Camilo, Sara, Valeria, Isabella) | Datos | Bajo |
| Roles hardcodeados (presidencia, gerencia, broker) | Config | Bajo |
| URLs de imágenes (glp.com.pa CDN) | Datos | Medio |
| Brokers iniciales (Patricia Vargas, Santiago Mesa…) | Datos | Bajo |
| Constantes de transacción (3%, 2%, 0.5%) | Config | Bajo |
| Entidades de comisión (Colombia Law Group, GLP Admin) | Config | Bajo |

**Costo de parametrización estimado: 24–35 horas de desarrollo**  
Sin tocar la arquitectura ni reescribir lógica de negocio.

---

## Visión del Producto

### Propuesta de valor diferenciada

> **"El único CRM inmobiliario de la región con agentes de IA integrados — diseñado por y para promotoras premium de Latinoamérica."**

Lo que no tiene ningún competidor:
- Agentes IA que generan prospectos, redactan emails y producen inteligencia de mercado
- Análisis Gerencial con benchmarks del sector
- Calculadora de inversión integrada en el flujo de venta
- Diseño premium listo para mostrar a compradores de alto ticket

### Mercado objetivo

**Primario (quick wins):**
- Promotoras inmobiliarias medianas en Colombia, Panamá, México, Perú
- Empresas con 3–20 asesores comerciales
- Sin CRM propio o con Excel/WhatsApp como herramienta principal

**Secundario:**
- Franquicias inmobiliarias (RE/MAX, Coldwell Banker) que quieran herramienta propia
- Grupos inmobiliarios con múltiples proyectos y equipos

### Modelo de negocio propuesto

| Plan | Precio sugerido | Incluye |
|------|-----------------|---------|
| **Starter** | USD $150/mes | Hasta 5 usuarios · Sin agentes IA · Soporte email |
| **Pro** | USD $350/mes | Hasta 15 usuarios · Agentes IA básicos (Sara + Camilo) · Soporte prioritario |
| **Enterprise** | USD $800/mes | Usuarios ilimitados · 4 agentes IA · White-label · Onboarding asistido |
| **Setup fee** | USD $500–1.500 | Configuración inicial de proyectos, marca y usuarios |

---

## Fases del Plan de Trabajo

---

### FASE 1 — Parametrización Base
**Objetivo:** Que un nuevo cliente pueda usar el sistema sin tocar código  
**Duración estimada:** 3–4 semanas  
**Prioridad:** CRÍTICA

#### 1.1 Extraer configuración por cliente (Semana 1–2)

Crear archivo de configuración separado del código:

```
src/config/
  tenant.config.ts        ← nombre empresa, moneda, región
  projects.config.ts      ← array de proyectos (reemplaza PROJECTS[])
  brand.config.ts         ← DEFAULT_BRAND_PROFILE
  roles.config.ts         ← ROLE_MODULES, ROLE_LABELS
  agents.config.ts        ← nombres y prompts de cada agente IA
  transactions.config.ts  ← comisiones, impuestos de transacción
```

- [ ] Mover array `PROJECTS[]` a `projects.config.ts`
- [ ] Mover `DEFAULT_BRAND_PROFILE` a `brand.config.ts`
- [ ] Mover `ROLE_MODULES` y `ROLE_LABELS` a `roles.config.ts`
- [ ] Extraer todos los prompts de agentes IA a `agents.config.ts`
- [ ] Mover constantes de transacción (3%, 2%, 0.5%) a `transactions.config.ts`
- [ ] Hacer `CRMDashboard.tsx` importar todo desde estos archivos

#### 1.2 Wizard de Onboarding (Semana 2–3)

Pantalla inicial que aparece la primera vez que una empresa activa su cuenta:

**Paso 1 — Identidad de marca**
- Nombre de la empresa
- Logo (upload)
- Color principal
- País y moneda

**Paso 2 — Proyectos del portafolio**
- Formulario para agregar proyectos: nombre, categoría, precio desde, área desde, ubicación
- Upload de imágenes por proyecto
- Datos de rentabilidad (cap rate, renta m²)

**Paso 3 — Equipo**
- Crear usuarios (nombre, email, rol)
- Agregar brokers/asesores con zona y contacto

**Paso 4 — Configuración de agentes IA**
- Nombre de cada agente (o usar los predeterminados)
- Contexto del mercado: "¿En qué país/ciudad opera? ¿Cuál es el perfil del comprador típico?"
- Esta información se inyecta automáticamente en los prompts

- [ ] Diseñar e implementar wizard de 4 pasos
- [ ] Guardar configuración en base de datos por tenant

#### 1.3 Multi-tenancy en BD (Semana 3–4)

Actualmente todos los datos están en una sola instancia de Supabase sin separación por empresa.

- [ ] Agregar campo `tenant_id` a todas las tablas (prospectos, brokers, eventos, casos, FAQs, proyectos)
- [ ] Filtrar todas las queries por `tenant_id` del usuario activo
- [ ] Crear tabla `tenants` con configuración por empresa
- [ ] Aislar almacenamiento de imágenes por tenant (buckets separados en Supabase Storage)

---

### FASE 2 — White-label e Identidad Visual
**Objetivo:** Que el sistema se vea como propio de cada cliente  
**Duración estimada:** 2 semanas  
**Prioridad:** ALTA

#### 2.1 Aplicar colores y logo del cliente

- [ ] Reemplazar `T.teal` (`#001A37`) y `T.coral` (`#B89047`) con variables CSS dinámicas cargadas desde `tenant.config`
- [ ] Reemplazar logo "GLP" en sidebar con logo del cliente
- [ ] Cambiar "GLP CRM v1.0 · 2026" en footer por nombre del cliente
- [ ] Cambiar título de pestaña del browser por nombre del cliente
- [ ] Cambiar "Control Comercial" en sidebar por tagline del cliente

#### 2.2 Dominio personalizado

- [ ] Soporte para subdominios: `cliente.crmplatform.com` o dominio propio del cliente
- [ ] Certificado SSL automático por dominio

---

### FASE 3 — Infraestructura de Producción
**Objetivo:** Sistema estable, seguro y escalable para múltiples clientes  
**Duración estimada:** 3–4 semanas  
**Prioridad:** ALTA (antes del primer cliente de pago)

#### 3.1 Seguridad

- [ ] Autenticación con JWT + refresh tokens (actualmente sessionStorage sin expiración)
- [ ] Rate limiting en todas las APIs (especialmente llamadas a OpenAI)
- [ ] Logs de auditoría: quién hizo qué y cuándo
- [ ] Backup automático diario por tenant
- [ ] Política de contraseñas (mínimo 8 caracteres, caducidad opcional)

#### 3.2 Costos de OpenAI por tenant

Actualmente todas las llamadas a OpenAI van a la misma cuenta sin seguimiento por cliente.

- [ ] Tabla `ai_usage` con tokens consumidos por tenant por mes
- [ ] Alertas cuando un tenant supera el límite del plan
- [ ] Posibilidad de que el cliente ponga su propia API key de OpenAI

#### 3.3 Despliegue

- [ ] Mover de localhost a servidor en producción (Railway, Render, o VPS propio)
- [ ] Variables de entorno seguras por ambiente (dev / staging / prod)
- [ ] CI/CD básico: push a main → deploy automático
- [ ] Monitoreo de uptime (UptimeRobot o similar)

---

### FASE 4 — Funciones de Plataforma (Gestión de Clientes)
**Objetivo:** Panel de administración para gestionar todos los clientes desde una sola vista  
**Duración estimada:** 2–3 semanas  
**Prioridad:** MEDIA (para cuando haya 3+ clientes)

- [ ] **Panel de Superadmin de plataforma** (diferente del superadmin de cada cliente)
  - Lista de todos los tenants activos
  - Estado de suscripción y plan
  - Uso de IA por cliente (tokens/mes)
  - Últimos logins

- [ ] **Gestión de facturación**
  - Integración con Stripe o Wompi para cobro recurrente
  - Activación/suspensión automática por pago vencido

- [ ] **Sistema de soporte**
  - Chat o ticket básico desde dentro del CRM hacia el equipo de soporte

---

### FASE 5 — Diferenciadores Competitivos (Roadmap Producto)
**Objetivo:** Features que no tienen los CRMs competidores  
**Duración estimada:** Continua (post-lanzamiento)

#### Prioridad Alta
- [ ] **Agentes IA configurables** — que el cliente pueda darle nombre, personalidad y contexto a sus propios agentes desde la UI
- [ ] **Integración WhatsApp Business API** — los agentes responden directamente en WhatsApp
- [ ] **Portal del comprador** — el prospecto ve el estado de su negociación en tiempo real

#### Prioridad Media
- [ ] **App móvil** para brokers (versión React Native de la vista mobile actual)
- [ ] **Alertas inteligentes** — Camilo detecta prospectos con señales de compra y alerta al broker
- [ ] **Firma digital** en módulo de Casos (DocuSign/HelloSign)
- [ ] **Sincronización Google Calendar** para eventos y citas

#### Prioridad Baja
- [ ] **Integración VoIP** — llamadas desde el CRM (Twilio)
- [ ] **Lead Scoring con ML** entrenado por cliente

---

## Cronograma Sugerido

```
Jul 2026  ████████  Fase 1: Parametrización + Onboarding wizard
Ago 2026  ████████  Fase 1 cont. + Fase 2: White-label
Sep 2026  ████████  Fase 3: Infraestructura de producción
Oct 2026  ████        Fase 4: Panel de administración
Oct 2026  ████        PRIMER CLIENTE DE PAGO
Nov 2026+   ●●●●    Fase 5: Features diferenciadores (continua)
```

---

## Primer Cliente: Estrategia

**No esperar a tener todo listo.** El camino más corto al dinero:

1. Identificar 1–2 promotoras conocidas (Colombia o Panamá) dispuestas a ser "early adopters"
2. Ofrecer 3 meses gratis a cambio de feedback detallado y testimonio
3. Hacer el setup manualmente con sus datos (no necesita el wizard todavía)
4. Cobrar a partir del mes 4

Lo que se necesita mínimo para el primer cliente:
- [ ] Multi-tenancy en BD (Fase 1.3)
- [ ] Archivo de configuración por cliente (Fase 1.1)
- [ ] Wizard simplificado o setup manual asistido

---

## Nombre del Producto

GLP CRM es el nombre interno. Para venderlo a otras empresas se necesita marca propia.

Opciones sugeridas:
- **PropIQ** — inteligencia de propiedades
- **Nexus CRM** — conexión entre promotora y comprador
- **Realm** — inmobiliario + premium
- **VentaCRM** — directo al punto

---

*Documento generado: Julio 2026 — Versión 1.0*
