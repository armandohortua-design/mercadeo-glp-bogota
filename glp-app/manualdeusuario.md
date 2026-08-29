# Manual de Usuario — GLP CRM
## GLP Wealth Management · Plataforma de Gestión Comercial Premium

*Versión 2.0 — Julio 2026*

---

## Índice

1. [Acceso y Roles de Usuario](#1-acceso-y-roles-de-usuario)
2. [Dashboard Principal (KPIs)](#2-dashboard-principal-kpis)
3. [Módulo de Prospectos](#3-módulo-de-prospectos)
4. [Análisis Gerencial](#4-análisis-gerencial)
5. [Módulo de Reportes](#5-módulo-de-reportes)
6. [Módulo de Campañas](#6-módulo-de-campañas)
7. [Portafolio de Proyectos](#7-portafolio-de-proyectos)
8. [Calculadora de Inversión](#8-calculadora-de-inversión)
9. [Agentes IA](#9-agentes-ia)
10. [Casos y Postventa](#10-casos-y-postventa)
11. [Brokers](#11-brokers)
12. [FAQs](#12-faqs)
13. [Eventos](#13-eventos)
14. [Catálogo](#14-catálogo)
15. [Configuración (Superadmin)](#15-configuración-superadmin)
16. [Módulo Legal & Cierre y Trámites](#16-módulo-legal--cierre-y-trámites)
17. [Hoja de Ruta de Mejoras (Anexo)](./ROADMAP_MEJORAS_CRM.md)

---

## 1. Acceso y Roles de Usuario

### 1.1 Pantalla de Login

Al ingresar a `crm.html` el sistema solicita usuario y contraseña. Las credenciales se gestionan exclusivamente desde **Configuración → Seguridad y Acceso** por un usuario con rol Superadmin.

**Comportamiento:**
- La sesión se mantiene activa mientras la pestaña del browser esté abierta
- Si cierras el browser y lo vuelves a abrir, el sistema te pedirá login nuevamente
- Tres intentos fallidos no bloquean la cuenta en la versión actual (se mejorará en v2)

### 1.2 Roles y Permisos

| Rol | Descripción | Módulos disponibles |
|-----|-------------|---------------------|
| **Superadmin** | Control total irrestricto | Todos + Configuración |
| **Presidencia** | Vista ejecutiva de resultados | Dashboard, Reportes, Portafolio, Análisis Gerencial |
| **Gerencia Comercial** | Gestión operativa completa | Todos excepto Configuración |
| **Broker / Asesor** | Gestión propia de cartera | Prospectos propios, Portafolio, Calculadora, Casos propios, FAQs |

**Reglas de acceso importantes:**
- El módulo de **Configuración** solo aparece en el menú para Superadmin
- Los brokers solo ven los prospectos que tienen asignados a su nombre; no pueden ver los de otros asesores
- Presidencia no ve datos personales de prospectos (GDPR/privacidad); solo ve métricas agregadas
- Gerencia puede ver y editar todos los prospectos del equipo

### 1.3 Crear Usuarios

Solo Superadmin puede crear usuarios:
1. Ir a **Configuración → Seguridad y Acceso**
2. Sección "Crear Nuevo Usuario"
3. Completar: nombre completo, nombre de usuario (sin espacios, preferiblemente iniciales), contraseña inicial
4. Seleccionar rol del menú desplegable
5. Clic en **Crear Usuario** — aparece inmediatamente en la lista de usuarios activos

**Cambiar contraseña:**
- Cualquier usuario puede cambiar su propia contraseña desde Configuración → "Cambiar mi contraseña"
- El Superadmin puede restablecer la contraseña de cualquier usuario

### 1.4 Navegación General

**Sidebar izquierdo:** Menú principal de navegación. Si tienes muchos módulos disponibles y el menú se corta, usa el **scroll vertical en el sidebar** para ver el resto (incluido Configuración al final).

**Panel derecho:** En módulos como Dashboard y Prospectos, aparece un panel lateral derecho con detalles del prospecto seleccionado o con información contextual.

**Header superior:** Muestra el módulo activo, notificaciones y el botón de cierre de sesión.

---

## 2. Dashboard Principal (KPIs)

El Dashboard es la vista de comando: muestra el estado actual del negocio en tiempo real sin necesidad de navegar a otros módulos.

### 2.1 Tarjetas KPI superiores

Hay 7 tarjetas en la franja superior. Cada una tiene un ícono de información (ⓘ) — al pasar el cursor muestra la definición exacta del indicador y el benchmark del sector.

| KPI | Qué mide | Cómo se calcula |
|-----|----------|-----------------|
| **Ticket Promedio** | Valor promedio de los cierres del período | Suma de ventas cerradas ÷ número de cierres |
| **Tasa de Conversión** | % de prospectos que llegaron a cierre | Cierres ÷ total de prospectos × 100 |
| **Total Prospectos** | Prospectos activos en el sistema | Conteo de todos los registros en estado activo |
| **Brokers Activos** | Asesores con prospectos en el período | Brokers con al menos 1 prospecto asignado |
| **Pipeline Camilo** | Valor total de prospectos que Camilo identificó | Suma de presupuestos de prospectos con fuente "Camilo IA" |
| **Historial Sara** | Emails enviados por Sara en el período | Conteo de borradores aprobados y enviados |
| **Próximo Evento** | Días hasta el próximo evento registrado | Diferencia entre hoy y la fecha del evento más próximo |

### 2.2 Gráficos del Dashboard

**Funnel de Conversión (barra horizontal):**
- Muestra cuántos prospectos hay en cada etapa del pipeline: Contacto → Calificado → Presentación → Negociación → Cierre → Post-venta
- Las barras tienen valores numéricos al final para lectura rápida
- Un funnel sano tiene forma de embudo descendente; si hay más en Negociación que en Calificado, puede haber un problema de calidad en la etapa de entrada

**Actividad Reciente:**
- Lista las últimas interacciones registradas en el sistema (emails enviados, llamadas, cambios de etapa)
- Muestra quién hizo la acción y cuándo

### 2.3 Panel derecho del Dashboard

Muestra el prospecto seleccionado más reciente o el prospecto con mayor Lead Score activo. Desde aquí puedes:
- Ver la ficha rápida del prospecto
- Cambiar su etapa directamente
- Ver su historial de interacciones recientes

---

## 3. Módulo de Prospectos

El corazón operativo del CRM. Aquí vive toda la cartera de clientes potenciales.

### 3.1 Vista de Lista

La lista muestra todos los prospectos con las columnas:
- **Nombre** — apellido y nombre
- **Lead Score** — número del 0 al 100 (color verde >70, amarillo 40–70, rojo <40)
- **Etapa** — badge de color por etapa del pipeline
- **Presupuesto** — en USD
- **Proyecto de Interés** — proyecto(s) que le interesan
- **Broker** — asesor asignado
- **Días sin actividad** — contador desde la última interacción registrada

**Ordenar la lista:** Clic en cualquier encabezado de columna ordena ascendente/descendente.

### 3.2 Filtros

La barra de filtros en la parte superior permite combinar múltiples criterios simultáneamente:

| Filtro | Opciones |
|--------|----------|
| **Etapa** | Todas / Lead Frío / Contacto Inicial / Calificado / Presentación / Negociación / Cierre / Post-venta |
| **Broker** | Todos / nombre específico de broker |
| **Proyecto** | Todos / proyecto específico del portafolio |
| **Presupuesto mínimo** | Valor en USD |
| **Presupuesto máximo** | Valor en USD |
| **Fuente** | Referido / Redes Sociales / Web / Evento / Agente IA / Otra |

Los filtros se aplican en tiempo real — la lista se actualiza inmediatamente sin necesidad de hacer clic en "Buscar".

### 3.3 Lead Score — Cómo funciona

El Lead Score es un número del 0 al 100 calculado automáticamente por el sistema. Refleja qué tan calificado y qué tan comprometido está el prospecto. Los criterios y sus pesos:

| Criterio | Peso | Cómo se gana |
|----------|------|--------------|
| Presupuesto confirmado | 20 pts | El prospecto declaró presupuesto específico en USD |
| Etapa del pipeline | 15 pts | Más avanzado = mayor puntaje (Calificado = 8 pts, Cierre = 15 pts) |
| Interacción reciente | 15 pts | Actividad en los últimos 7 días |
| Tipo de fuente | 10 pts | Referido = 10, Agente IA = 8, Web = 5, Desconocido = 0 |
| Perfil completo | 10 pts | Tiene email, teléfono y empresa registrados |
| Proyecto definido | 10 pts | Tiene al menos 1 proyecto de interés específico |
| Documentación | 10 pts | Al menos 1 documento adjunto en su ficha |
| Tiempo de respuesta | 10 pts | El broker respondió en menos de 24h al último contacto |

**Usar el Lead Score:** Ordenar la lista por Lead Score descendente cada mañana te da la lista de prioridades del día — los más rentables y más comprometidos arriba.

### 3.4 Ficha del Prospecto

Clic en cualquier fila abre la ficha completa en el panel derecho.

**Sección: Datos Personales**
- Nombre completo, empresa, ocupación
- Email y teléfono (clic para copiar)
- Fuente de contacto y fecha de entrada al sistema
- Broker asignado (se puede reasignar desde aquí)

**Sección: Intereses Comerciales**
- Proyectos de interés (puede tener varios)
- Presupuesto declarado en USD
- Área preferida en m²
- Forma de pago preferida (contado / financiado / mixto)
- Perfil de inversión (Renta / Disfrute / Patrimonial)

**Sección: Pipeline**
- Etapa actual con selector desplegable para cambiarla
- Historial de cambios de etapa con fecha y hora de cada movimiento
- Probabilidad de cierre automática por etapa (Contacto 5% → Cierre 85%)

**Sección: Historial de Actividad**
- Cronología de todas las interacciones: emails enviados, llamadas registradas, reuniones, cambios de etapa, notas
- Cada entrada muestra: tipo de actividad, fecha, quién lo registró, resumen

**Sección: Notas Internas**
- Campo de texto libre para el broker
- Las notas son privadas (no van al prospecto)
- Se guardan con timestamp automático

**Sección: Documentos**
- Lista de archivos adjuntos (propuestas, contratos, análisis de inversión)
- Upload directo desde el browser

### 3.5 Crear un Nuevo Prospecto

Botón **+ Nuevo Prospecto** en la barra superior de la lista:

1. **Datos básicos:** nombre, apellido, email, teléfono, empresa, ocupación
2. **Origen:** fuente de contacto, fecha de primer contacto, broker asignado
3. **Intereses:** proyectos, presupuesto, área, forma de pago
4. **Notas iniciales:** contexto de la primera conversación

El prospecto se crea en etapa **Lead Frío** por defecto. El Lead Score inicial se calcula automáticamente con los datos ingresados.

### 3.6 Cambiar Etapa del Pipeline

Dos maneras:
1. **Desde la lista:** clic en el badge de etapa del prospecto → menú desplegable
2. **Desde la ficha:** selector en la sección Pipeline del panel derecho

Cada cambio de etapa se registra automáticamente en el historial con fecha, hora y usuario que lo hizo.

**Etapas y su significado:**

| Etapa | Descripción | Acción típica siguiente |
|-------|-------------|-------------------------|
| **Lead Frío** | Contacto inicial sin respuesta | Primer email / WhatsApp |
| **Contacto Inicial** | Ha respondido, hay interés básico | Calificar presupuesto y motivación |
| **Calificado** | Tiene presupuesto y está listo para ver proyectos | Agendar presentación |
| **Presentación** | Está viendo proyectos | Seguimiento post-presentación |
| **Negociación** | Tiene interés en uno o más proyectos específicos | Enviar propuesta de inversión |
| **Cierre** | En proceso de reserva/firma | Gestionar papeleo |
| **Post-venta** | Compra completada | Abrir caso de postventa |

### 3.7 Registrar una Actividad

Dentro de la ficha del prospecto → sección Historial → botón **+ Registrar Actividad**:

1. **Tipo:** Llamada / Email manual / Reunión / WhatsApp / Otro
2. **Fecha y hora** (por defecto: ahora)
3. **Resumen:** qué se habló o acordó (campo de texto)
4. **Resultado:** Positivo / Neutral / Sin respuesta / Negativo
5. **Próximo paso:** fecha y descripción de la siguiente acción

Esto reinicia el contador de "Días sin actividad" del prospecto.

### 3.8 Borradores de Sara en Prospectos

Cuando Sara genera un borrador de email para un prospecto, aparece en la ficha con un banner amarillo **"Borrador pendiente de aprobación"**. Desde ahí:
- **Vista previa** del email completo
- **Editar** el borrador antes de enviar
- **Aprobar y enviar** — lo envía directamente al email del prospecto
- **Rechazar** — descarta el borrador y lo notifica a Sara

### 3.9 Dar de Baja un Prospecto (Registro de Causa Real de Pérdida)

Cuando un negocio se cae, el sistema exige registrar el motivo real — esto alimenta las
estadísticas de caídas del Dashboard y el análisis de causas que hace el equipo de
agentes IA (ver 9.7).

**Dos formas de dar de baja:**
1. **Desde el selector de etapa** (lista o ficha): selecciona la opción **"Perdido (dar
   de baja)"** en el desplegable de etapa.
2. **Botón dedicado "Dar de baja"** en la ficha del prospecto (junto a Editar/Eliminar).

Ambas rutas abren el mismo formulario:
- **Motivo** (obligatorio, lista tipificada): Precio, Financiamiento, Competencia,
  Tiempos / Trámites, Perdió interés, Otro.
- **Detalle adicional** (opcional): texto libre para contexto específico (ej. "se fue con
  un competidor por mejor precio en el mismo proyecto").

Al confirmar, el prospecto pasa a estado **Perdido**, queda registrado en el historial y
aparece en el drilldown de **Ventas Caídas** (Dashboard → Conversión Global → Ver Detalle)
con su motivo real, no un texto genérico.

---

## 4. Análisis Gerencial

Módulo de inteligencia comercial avanzada. Diseñado para gerentes y presidencia que necesitan una visión estratégica del negocio, no solo operativa.

> Todos los indicadores tienen un ícono de información (ⓘ) — al hacer hover muestra la definición exacta del KPI y el benchmark del sector inmobiliario premium para comparación.

### 4.1 Mapa de Calor de Actividad Comercial

Visualización de la intensidad de actividad comercial hora por hora y día por día de la semana.

**Cómo leer:** Las celdas más oscuras = más actividad (llamadas, emails, reuniones). Identifica en qué horarios el equipo tiene más contacto con clientes y en cuáles hay vacíos que se pueden aprovechar.

**Uso estratégico:** Si el mapa muestra poca actividad los viernes en la tarde pero los prospectos responden en ese horario (visible en el historial de respuestas), es un gap de productividad.

### 4.2 Velocidad del Pipeline

Gráfico que muestra el tiempo promedio (en días) que tarda un prospecto en pasar de una etapa a la siguiente.

**Métricas clave:**
- **Tiempo total Lead → Cierre:** promedio general del ciclo de venta
- **Cuello de botella:** la etapa con mayor tiempo promedio es donde el equipo pierde más prospectos
- **Comparativa mensual:** si el tiempo en Negociación está subiendo, puede indicar problemas en las propuestas o en los proyectos ofrecidos

**Benchmark sector:** Ciclo completo en inmobiliaria premium: 90–180 días. Más de 180 días en promedio sugiere calificación deficiente en las etapas tempranas.

### 4.3 Matriz de Valor vs. Probabilidad

Scatter plot (gráfico de dispersión) donde cada punto es un prospecto:
- **Eje X:** Probabilidad de cierre (basada en etapa del pipeline)
- **Eje Y:** Valor del negocio (presupuesto declarado en USD)

**Los 4 cuadrantes:**
- **Alto valor + Alta probabilidad** (arriba a la derecha): prioridad máxima, atención personal del gerente
- **Alto valor + Baja probabilidad** (arriba a la izquierda): inversión en tiempo para subir la probabilidad
- **Bajo valor + Alta probabilidad** (abajo a la derecha): cierres rápidos, delegables al broker
- **Bajo valor + Baja probabilidad** (abajo a la izquierda): evaluar si conviene continuar invirtiendo tiempo

### 4.4 Análisis de Cohortes

Agrupa los prospectos que entraron al sistema en el mismo mes (cohorte) y muestra qué porcentaje de cada cohorte llegó a cierre, y en cuánto tiempo.

**Uso:** Compara si los prospectos de enero cerraron más rápido que los de marzo. Si una cohorte tiene tasa de cierre notablemente baja, investiga qué cambió en ese período (temporada, proyecto, campaña).

### 4.5 Forecast de Revenue

Proyección de ingresos esperados para los próximos 30, 60 y 90 días basada en:
- Prospectos en etapas avanzadas (Negociación y Cierre)
- Probabilidad de cierre por etapa
- Presupuesto declarado de cada prospecto

**Fórmula:** Σ (presupuesto × probabilidad_etapa) para todos los prospectos activos en etapas relevantes.

**Uso:** Comparar el forecast contra la meta mensual. Si el forecast de 30 días es menor al 80% de la meta, hay que activar campañas de reactivación o que Camilo genere nuevos prospectos.

### 4.6 Análisis de Pérdidas

Breakdown de por qué se perdieron los negocios:
- Por razón (precio, competencia, timing, financiamiento, desistió)
- Por etapa en que se perdieron (los que se caen en Calificado vs. los que se caen en Negociación tienen causas muy distintas)
- Por broker (identifica si hay patrones de pérdida concentrados en un asesor)

---

## 5. Módulo de Reportes

Sistema de reportes analíticos con filtros configurables. Ocupa el ancho completo de la pantalla para mejor visualización de datos.

### 5.1 Filtros Globales

En la barra superior, tres filtros afectan **todos** los reportes simultáneamente:

**Período:**
- Últimos 7 días
- Últimos 30 días (default)
- Últimos 90 días
- Últimos 180 días
- Rango personalizado (selector de fechas)

**Broker:** Todos / broker específico  
**Proyecto:** Todos / proyecto específico del portafolio

Al cambiar cualquier filtro, todas las pestañas y gráficos se actualizan automáticamente.

### 5.2 Pestaña: Resumen

KPIs consolidados del período seleccionado:

| Indicador | Descripción |
|-----------|-------------|
| **Total Prospectos** | Nuevos prospectos que entraron en el período |
| **Pipeline** | Valor total en USD de todos los prospectos activos |
| **Calificados** | Prospectos que llegaron a etapa Calificado o superior |
| **Cerrados** | Prospectos que llegaron a Cierre en el período |

**Gráfico "Prospectos en el Tiempo":** Línea que muestra la evolución de nuevos ingresos por semana. Permite identificar estacionalidad y el efecto de campañas específicas.

**Gráfico "Funnel de Conversión":** Barras horizontales mostrando cuántos prospectos hay en cada etapa. Las barras tienen el valor numérico visible para lectura rápida.

### 5.3 Pestaña: Brokers

Ranking de performance del equipo comercial.

**Tabla de brokers:**
- Prospectos asignados en el período
- Calificados (llegaron a etapa Calificado o más)
- Cerrados (llegaron a Cierre)
- Tasa de conversión (cerrados ÷ asignados × 100)
- Pipeline activo en USD

**Gráfico de barras mensual:** Compara la actividad de cada broker mes a mes. Útil para detectar si la caída de un broker fue puntual o es una tendencia.

**Uso en reuniones de equipo:** Este reporte es la base para la reunión semanal de ventas. El ranking visible crea incentivo positivo de competencia entre asesores.

### 5.4 Pestaña: Proyectos

Performance comercial desglosada por proyecto del portafolio.

**Métricas por proyecto:**
- Prospectos con interés en el proyecto
- Pipeline asociado en USD
- Prospectos cerrados
- Precio promedio de cierre

**Uso:** Identifica qué proyectos generan más interés vs. cuáles tienen más cierres. Un proyecto con mucho interés pero pocos cierres puede tener un problema de precio o de presentación.

### 5.5 Pestaña: Fuentes

De dónde vienen los prospectos que entran al sistema.

**Gráfico de torta:** Distribución por fuente (Referido, Redes Sociales, Web, Evento, Agente IA Camilo, Llamada en frío, Otra).

**Tabla de conversión por fuente:** Qué fuente no solo trae más prospectos sino cuál tiene mayor tasa de conversión a cierre. Generalmente Referidos tienen conversión 3–5× mayor que fuentes digitales.

**Uso:** Define dónde invertir el presupuesto de marketing y el tiempo de Camilo.

### 5.6 Pestaña: Velocidad

Tiempo promedio en días entre cada etapa del pipeline.

**Gráfico de embudo con tiempos:** Muestra cuántos días tarda un prospecto promedio en pasar de Contacto Inicial a Calificado, de Calificado a Presentación, etc.

**Indicador de cuello de botella:** La etapa con mayor tiempo promedio se resalta en rojo. Ese es el punto donde el equipo pierde más velocidad y hay que intervenir con procesos o herramientas.

---

## 6. Módulo de Campañas

Herramienta de marketing por email para comunicación masiva segmentada con los prospectos.

### 6.1 Dashboard de Campañas

Vista general con 6 KPIs en la franja superior:

| KPI | Descripción | Benchmark sector |
|-----|-------------|-----------------|
| **Campañas activas** | Campañas en ejecución ahora | — |
| **Leads alcanzados** | Prospectos que recibieron al menos 1 mensaje | — |
| **Tasa de apertura** | % que abrió el email | Inmobiliario premium: >40% |
| **Tasa de conversión** | % que llegó a cita tras la campaña | Objetivo: >5% |
| **Revenue atribuido** | Cierres donde la campaña fue el último contacto | — |
| **Citas generadas** | Reuniones agendadas directamente desde la campaña | — |

**Embudo de conversión consolidado:** Muestra el recorrido de todos los prospectos a través de todas las campañas activas: Enviados → Abiertos → Clicks → Citas → Cierres.

### 6.2 Crear una Campaña — Paso a Paso

Botón **+ Nueva Campaña** abre el wizard de 4 pasos:

**Paso 1 — Configuración básica:**
- **Nombre de la campaña** (interno, no lo ve el prospecto)
- **Objetivo:** define el tono y el template sugerido
  - Educación: contenido de valor, sin presión de venta
  - Reactivación: para prospectos que no han respondido en 30+ días
  - Presentación de Proyecto: enfocado en un proyecto específico
  - Invitación a Evento: para open houses o lanzamientos
  - Propuesta de Cierre: para prospectos en etapa Negociación
- **Tipo:** Secuencia Drip (varios pasos) o Envío Único

**Paso 2 — Segmentación:**

El sistema filtra los prospectos en tiempo real mientras ajustas los criterios. El contador arriba muestra cuántos prospectos califican con la combinación actual.

| Criterio | Opciones |
|----------|----------|
| Etapa del pipeline | Múltiple selección |
| Presupuesto mínimo | USD |
| Presupuesto máximo | USD |
| Proyecto de interés | Específico o todos |
| Días de inactividad | Mínimo de días sin actividad |
| Fuente de origen | Filtrar por canal de entrada |

> **Regla de oro:** Un segmento entre 20 y 200 prospectos funciona mejor que enviar a toda la base. Más segmentado = mayor relevancia = mayor apertura.

**Paso 3 — Contenido:**

Para **Envío Único:**
- Editor de asunto (campo de texto) — el asunto es lo más importante, determina si abren el email
- Editor de cuerpo — texto enriquecido con formato
- Variables dinámicas: `{{nombre}}`, `{{proyecto}}`, `{{broker}}` se reemplazan automáticamente

Para **Secuencia Drip:**
- Cada paso tiene: días de espera desde el paso anterior, asunto y cuerpo
- Ejemplo de secuencia de 5 pasos para Reactivación:
  - Día 0: Email de "¿Todo bien?" personal del broker
  - Día 3: Artículo de valor (mercado, tendencias)
  - Día 7: Presentación de proyecto nuevo o con precio actualizado
  - Día 14: Caso de éxito de otro inversionista
  - Día 21: Oferta especial o urgencia (últimas unidades, precio vigente hasta X)

**Paso 4 — Revisión y Lanzamiento:**
- Resumen del segmento (cuántos recibirán la campaña)
- Preview del primer email
- Botón **Lanzar Campaña** — confirmar antes de activar

### 6.3 Monitorear una Campaña Activa

Desde la lista de campañas → clic en una campaña activa → vista detallada:
- Métricas en tiempo real: enviados, abiertos, clicks
- Lista de prospectos que abrieron / no abrieron
- Para secuencias drip: en qué paso está cada prospecto
- Opción de **Pausar** o **Detener** la campaña

### 6.4 Segmentación Inteligente

El sistema sugiere segmentos automáticamente basado en:
- Prospectos que no han tenido actividad en 30+ días
- Prospectos que visitaron el portafolio pero no agendaron cita
- Prospectos en Negociación por más de 45 días sin avance

Estos segmentos pre-construidos están disponibles en el paso de segmentación como accesos rápidos.

### 6.5 Vista Previa del Email

Antes de lanzar, la pestaña "Vista Previa" muestra exactamente cómo se verá el email en un cliente de correo típico, con las variables dinámicas reemplazadas con datos de ejemplo.

---

## 7. Portafolio de Proyectos

Catálogo visual de todos los proyectos disponibles para venta. Es la herramienta que los brokers usan en reuniones con prospectos para presentar opciones.

### 7.1 Navegación del Portafolio

**Categorías:** Los proyectos se organizan en 3 categorías (configurables):
- **Ciudad de Panamá:** proyectos urbanos residenciales
- **Ocean Reef Islands:** proyectos en isla privada
- **Playa Caracol:** proyectos en primera línea de playa

Clic en una categoría filtra la vista de tarjetas. El selector "Todos" muestra el portafolio completo.

**Búsqueda:** Campo de texto en la barra superior busca por nombre de proyecto en tiempo real.

### 7.2 Tarjeta de Proyecto

Cada proyecto se muestra como una tarjeta con:
- Imagen principal del proyecto
- Nombre y categoría
- Precio desde (en USD)
- Área desde (en m²)
- Número de habitaciones
- Cap rate anual (rentabilidad neta estimada)

### 7.3 Ver Detalle del Proyecto

Clic en una tarjeta → se expande mostrando:

**Galería de fotos:** Miniaturas clicables que abren la imagen en tamaño completo. Se puede navegar con flechas.

**Descripción:** Texto del proyecto, destacando ubicación, amenidades del edificio y del entorno.

**Datos de inversión:**
- Precio por m²
- Cap rate neto anual
- Renta mensual estimada por m²
- Notas de valorización (proyección a 5 y 10 años si aplica)

**Amenidades:** Lista de amenidades del proyecto (piscina, gimnasio, spa, marina, golf, etc.)

**Integración con Calculadora:** Botón **"Calcular ROI"** pre-carga los datos de este proyecto en la Calculadora de Inversión directamente.

### 7.4 Editar un Proyecto

Solo Gerencia y Superadmin pueden editar. Botón **✏️ Editar** en la vista expandida:

- **Datos básicos:** nombre, categoría, precio desde, área desde, habitaciones
- **Datos de inversión:** precio por m², renta m², cap rate
- **Descripción:** texto de presentación
- **Amenidades:** lista editable
- **Imágenes:** agregar fotos a la galería (upload desde tu computador) o cambiar la imagen principal
- **URL de imagen principal:** también se puede ingresar una URL directa

Los cambios se guardan inmediatamente y se reflejan en el portafolio para todos los usuarios.

---

## 8. Calculadora de Inversión

Herramienta de análisis financiero para estructurar propuestas durante reuniones con prospectos. Diseñada para que el broker pueda mostrar en tiempo real el retorno de la inversión.

### 8.1 Seleccionar un Proyecto

Menú desplegable con todos los proyectos del portafolio. Al seleccionar uno, los campos de precio, área y renta se pre-llenan con los valores del portafolio. Todos los valores son editables para ajustar a la negociación específica.

### 8.2 Parámetros de la Simulación

**Datos de la propiedad:**
- Precio de compra (USD)
- Área en m²
- Renta estimada por m²

**Estructura de financiamiento:**
- % de enganche (pago inicial)
- Tasa de interés hipotecaria anual
- Plazo del crédito (años)

**Gastos operativos:**
- Vacancia esperada (% de meses sin arrendar al año)
- Cuota de condominio mensual
- Seguro anual
- Impuesto predial anual
- Fee de administración (% sobre renta bruta)

**Proyección:**
- Valorización anual esperada (%)
- Horizonte de análisis (5 o 10 años)

### 8.3 Resultados en Tiempo Real

Mientras ajustas los parámetros, los resultados se actualizan al instante:

| Indicador | Descripción |
|-----------|-------------|
| **Cap Rate** | Renta neta anual ÷ Precio de compra × 100 |
| **Flujo de caja mensual neto** | Renta - cuota hipotecaria - gastos |
| **ROI sobre inversión propia** | Retorno sobre el enganche, no sobre el precio total |
| **Punto de equilibrio** | Mes en que se recupera la inversión inicial |
| **Valor del patrimonio año X** | Precio estimado de la propiedad en el año seleccionado |
| **Comparativa vs. CDT** | Mismo capital en CDT en pesos colombianos al 10.5% anual |

### 8.4 Tabla Año a Año

La sección inferior muestra una tabla proyectando para cada año:
- Renta bruta acumulada
- Gastos acumulados
- Saldo hipotecario restante
- Valor de la propiedad (con valorización)
- Patrimonio neto (valor - deuda)
- ROI acumulado

### 8.5 Exportar Propuesta

Botón **Exportar PDF** genera un documento PDF con:
- Datos del proyecto seleccionado
- Todos los parámetros de la simulación
- Los resultados principales
- La tabla año a año
- Branding de GLP

El PDF está listo para enviar al prospecto como propuesta de inversión. Se recomienda personalizar el nombre del prospecto en el campo correspondiente antes de exportar.

---

## 9. Agentes IA

Cuatro asistentes de inteligencia artificial especializados que trabajan 24/7 en paralelo con el equipo comercial.

> **Principio fundamental:** Los agentes **proponen**, los humanos **deciden**. Ningún email, publicación o reporte generado por un agente se envía o publica automáticamente — todos requieren revisión y aprobación de un usuario humano.

### 9.1 CAMILO — VP de Investigación y Mercados

**Función principal:** Genera prospectos calificados y produce inteligencia de mercado accionable.

**Modo 1 — Generación de Prospectos:**
Botón **"Ejecutar Búsqueda"** → Camilo analiza fuentes externas y genera perfiles de prospectos que cumplen el perfil del comprador ideal (empresarios, inversionistas con capital disponible, perfil financiero elevado). Cada prospecto generado incluye:
- Nombre y empresa
- Perfil estimado de capacidad financiera
- Razón por la que califica para los proyectos de GLP
- Proyecto(s) recomendados de acuerdo a su perfil
- Sugerencia de primer contacto

Los prospectos generados por Camilo se pueden **agregar directamente al CRM** con un clic — quedan con fuente "Camilo IA" para tracking de performance.

**Modo 2 — Inteligencia de Mercado:**
Camilo genera informes semanales con:
- Estado del mercado inmobiliario en Panamá
- Indicadores macroeconómicos relevantes para compradores colombianos (TRM, tasas, inflación)
- Alertas de competencia (proyectos nuevos en zonas donde GLP opera)
- Oportunidades detectadas (eventos, ferias, cambios regulatorios)
- Análisis de sentimiento del mercado

Los informes se archivan en el panel de "Insights Producidos" dentro de la ficha de Camilo.

**Último análisis:** fecha y hora de la última ejecución. Se puede ejecutar manualmente en cualquier momento.

> **Investigación real, no inventada:** el Reporte Semanal de Mercado y el **Radar de
> Competencia** (Costa Rica, Portugal, Miami/Orlando, otros proyectos en Panamá) ejecutan
> búsquedas web reales antes de generar el análisis — Camilo ya no redacta "de memoria".
> Cada vez que se pulsa "Generar", el contenido puede variar porque se basa en información
> actual de internet, y cuando es posible incluye las fuentes citadas.

### 9.2 SARA — Directora de Experiencia de Cliente

**Función principal:** Gestión de comunicación con prospectos. Genera emails personalizados, monitorea prospectos en riesgo y mantiene la relación activa.

**Generación de borradores de email:**
Sara analiza el historial de cada prospecto y genera emails personalizados con:
- Tono adaptado al perfil del prospecto (más formal o más cercano)
- Referencias al último punto de contacto
- Contenido relevante para su etapa del pipeline
- Call to action apropiado

El borrador aparece en la ficha del prospecto para revisión. El broker puede:
- Editar cualquier parte del email
- Aprobarlo y enviarlo directamente desde el CRM
- Rechazarlo (Sara lo toma como feedback para mejorar)

**Monitoreo de prospectos:**
Sara revisa diariamente todos los prospectos y genera alertas cuando:
- Un prospecto lleva más de 14 días sin actividad (riesgo de enfriarse)
- Un prospecto en Negociación lleva más de 30 días sin avance
- Un prospecto que estaba activo dejó de responder abruptamente

Las alertas aparecen en el panel de "Alertas Activas" y en el Dashboard como notificaciones.

**Análisis de mensajes entrantes:**
Si se integra con el email corporativo, Sara analiza los mensajes entrantes, los clasifica por urgencia y prepara borradores de respuesta.

> **Tono personalizado con el perfil Sofía:** cuando Sofía ya clasificó a un prospecto
> (arquetipo estatus / legado / racional / aspiracional), Sara usa esa clasificación real
> al redactar — un cliente "estatus" recibe un correo que destaca exclusividad y nunca
> menciona precio primero; uno "racional" recibe datos y comparativos concretos. Esto
> aplica tanto a respuestas de correo como de WhatsApp.

### 9.3 VALERIA — VP de Medios y Contenidos

**Función principal:** Produce contenido de marketing para redes sociales, emails y materiales de venta.

**Tipos de contenido:**
- **Publicaciones para Instagram/LinkedIn:** copy del post + sugerencia de imagen o tipo de visual
- **Email newsletters:** contenido editorial de valor para la base de prospectos
- **Copies para anuncios pagados:** versiones cortas (Meta Ads, Google Ads)
- **Guiones para Reels:** estructura narrativa para videos cortos de 30–60 segundos

**Calendario editorial:**
Valeria puede generar un plan de contenido para 4 semanas con la distribución por canal y tema, listo para importar a herramientas de programación (Buffer, Hootsuite).

**Proceso de aprobación:**
Los contenidos generados van a una bandeja de "Borradores de Valeria". El equipo los revisa, edita si es necesario, y los aprueba para publicación o programación.

### 9.4 ISABELLA — Embajadora de Marca

**Función principal:** Producción de contenido audiovisual y representación de la marca en formatos de video.

**Tipos de contenido:**
- **Guiones para videos de proyecto:** narración en primera persona visitando el proyecto
- **Scripts para Reels de Instagram:** contenido corto para Instagram y TikTok
- **Videos de testimonios:** estructura para testimonios de compradores
- **Presentaciones de marca:** guiones para eventos y lanzamientos

**Storyboards:** Para cada guión, Isabella sugiere la estructura visual: qué se muestra en pantalla mientras el audio describe cada punto.

**Proceso:** Los contenidos de Isabella requieren producción humana posterior (grabación, edición). Isabella provee el guión y la dirección creativa; el equipo o un proveedor externo produce el video final.

### 9.5 Flujo de Trabajo Colaborativo entre Agentes

Los agentes están conectados. Cuando Camilo detecta una oportunidad de mercado importante, puede generar automáticamente una tarea para Sara (comunicarlo a los prospectos relevantes), para Valeria (crear contenido sobre esa oportunidad) o para Isabella (video explicativo).

Este flujo aparece en la sección **"Flujo de Trabajo"** dentro del módulo de Agentes, mostrando las tareas en tránsito entre agentes, su estado (pendiente/en proceso/completada) y quién las aprobó.

### 9.6 Stats de Rendimiento por Agente

Cada agente tiene en su ficha un panel de métricas:

**Camilo:**
- Prospectos generados en el período
- Insights producidos (informes)
- Tareas derivadas a otros agentes en flujo

**Sara:**
- Mensajes analizados
- Alertas activas (prospectos en riesgo)
- Tiempo promedio de respuesta de los borradores

**Valeria / Isabella:**
- Contenidos generados
- Piezas publicadas (si se integra con redes)
- Engagement promedio del contenido generado

### 9.7 Gestión de Ventas Caídas (Consola de Crisis)

Desde el Dashboard → Conversión Global → Ver Detalle (Objeciones), el botón **"Gestión de
Ventas Caídas"** activa un análisis del equipo de agentes basado en las causas reales
registradas al dar de baja prospectos (ver 3.9) — no en casos de ejemplo fijos.

**Lo que hace cada agente:**
1. **Camilo** calcula la distribución real de motivos de caída (ej. "Precio: 3 casos
   (43%), Competencia: 2 casos (29%)...").
2. **Sara** redacta un reporte citando los casos y motivos reales, con una recomendación
   de acción por cada causa principal, y levanta alertas operativas mencionando clientes
   concretos.
3. **Valeria** genera un email de recuperación y un post para redes enfocados en la
   objeción real más frecuente detectada (no un tema genérico).
4. **Isabella** genera un guión de video y un plan de campaña semanal alineados a esa
   misma causa principal.

Todo el contenido generado queda disponible para revisión y aprobación en las bandejas de
cada agente, igual que el resto del contenido del sistema.

---

## 10. Casos y Postventa

Módulo de gestión de requerimientos post-cierre. Cada cliente que compra una propiedad puede generar casos de soporte, trámites o consultas que el equipo debe gestionar.

### 10.1 Tipos de Casos

| Tipo | Ejemplos |
|------|----------|
| **Consulta** | "¿Cuándo es la fecha de entrega?" / "¿Cómo funciona la escrituración?" |
| **Soporte** | Problema con la propiedad, falla de equipos, problemas de acceso |
| **Reclamo** | Incumplimiento de promesas, daños, disconformidades |
| **Trámite** | Escrituración, registro, declaración ante DIAN, gestión bancaria |

### 10.2 Crear un Nuevo Caso

Botón **+ Nuevo Caso**:
1. **Título** claro y descriptivo del requerimiento
2. **Cliente vinculado** — busca en el directorio de prospectos (filtrado a estado Post-venta)
3. **Tipo** (Consulta / Soporte / Reclamo / Trámite)
4. **Prioridad:**
   - **Baja:** puede esperar más de 5 días hábiles
   - **Normal:** atender en 2–5 días hábiles
   - **Alta:** atender en 24–48 horas
   - **Urgente:** atención inmediata (aparece resaltado en rojo en la lista)
5. **Descripción detallada** del requerimiento
6. **Broker responsable** — por defecto el broker asignado al cliente

### 10.3 Etapas y Gestión del Caso

**Abierto → En Gestión → Resuelto → Cerrado**

**Etapa Abierto:**
Acciones típicas al abrir un caso:
- Contactar al cliente para confirmar el requerimiento y establecer expectativas de tiempo
- Verificar documentación existente del cliente (contrato, acta de entrega)
- Escalar internamente si es necesario

**Etapa En Gestión:**
El caso está activo y en proceso:
- Coordinación con la constructora o el banco
- Envío de documentos
- Seguimiento de trámites externos

**Etapa Resuelto:**
El requerimiento fue atendido:
- Enviar resolución formal al cliente
- Confirmar que el cliente está satisfecho
- Si el cliente no confirma en 3 días hábiles, pasa a Cerrado automáticamente

**Etapa Cerrado:**
Archivo del caso. Aparece en el historial del cliente pero no en la lista activa.

### 10.4 Registrar Actividad en un Caso

Dentro del caso → sección **Actividades** → botón **+ Actividad**:

**Tipos de actividad disponibles:**
- **Llamada:** fecha, duración, con quién, resumen
- **Email:** asunto, resumen del contenido
- **Reunión:** fecha, lugar, asistentes, acuerdos
- **Documento:** archivo adjunto con descripción
- **Gestión interna:** coordinación con constructora, banco u otro ente

Cada actividad tiene un campo **"Próximo paso"** con fecha — esto crea un recordatorio visible en el caso hasta que se cumpla.

### 10.5 KPIs del módulo de Casos

La barra superior muestra en tiempo real:
- **Abiertos:** casos nuevos sin gestión activa
- **En Gestión:** casos activos que alguien está trabajando
- **Resueltos:** cerrados exitosamente en el período actual
- **Urgentes:** requieren atención inmediata (contador rojo si hay alguno)

---

## 11. Brokers

Directorio completo del equipo comercial y red de corredores externos.

### 11.1 Lista de Brokers

Vista en tarjetas mostrando cada broker con:
- Nombre y empresa
- Zona de especialización
- Número de prospectos activos asignados
- Pipeline activo en USD
- Estado (activo / inactivo)

### 11.2 Ficha del Broker

Clic en una tarjeta → detalle completo:

**Datos de contacto:** teléfono, email, zona de trabajo.

**Performance histórico:**
- Total de prospectos gestionados
- Tasa de conversión (cierres ÷ prospectos × 100)
- Revenue generado (suma de cierres)
- Tiempo promedio de cierre

**Pipeline actual:** lista de sus prospectos activos ordenados por Lead Score, con etapa y presupuesto.

**Comisiones del período:** basado en la estructura de comisiones configurada en el sistema. No es el pago final — es la referencia para liquidación.

### 11.3 Agregar un Broker

Botón **+ Nuevo Broker**:
- Nombre completo y empresa
- Email y teléfono de contacto
- Zona de especialización
- Notas (acuerdo de exclusividad, certificaciones, experiencia)

### 11.4 Asignar Prospectos

Desde la ficha de cualquier prospecto → campo "Broker Asignado" → menú desplegable con todos los brokers activos.

La asignación también se puede hacer en masa desde la lista de prospectos: seleccionar varios → acción masiva "Reasignar broker".

---

## 12. FAQs

Base de conocimiento estructurada con preguntas y respuestas frecuentes sobre los proyectos, el proceso de compra, aspectos legales y financieros.

### 12.1 Estructura de Categorías

| Categoría | Contenido típico |
|-----------|-----------------|
| **Proyectos** | Características, fechas de entrega, disponibilidad de unidades |
| **Proceso de Compra** | Pasos para comprar, documentación requerida, tiempos |
| **Legal** | Escrituración, fiducia, registro de propietarios extranjeros |
| **Financiamiento** | Hipotecas, condiciones bancarias, tasas |
| **Inversión** | Cap rates, rentabilidad, proyecciones |

### 12.2 Buscar una FAQ

Campo de búsqueda por palabra clave — busca en el título y en el cuerpo de la respuesta. Resultado en tiempo real sin necesidad de presionar Enter.

### 12.3 Agregar o Editar una FAQ

Solo Gerencia y Superadmin:
1. Botón **+ Nueva Pregunta**
2. Seleccionar categoría
3. Escribir la pregunta (título)
4. Escribir la respuesta (texto con formato)
5. Guardar

Para editar una FAQ existente: clic en el ícono de editar en la tarjeta de la pregunta.

**Uso en el equipo:** Las FAQs están diseñadas para que los brokers puedan consultar en tiempo real durante una reunión con un cliente. También se pueden enviar como links directos dentro de los emails que Sara genera.

---

## 13. Eventos

Calendario de actividades comerciales: lanzamientos de proyectos, open houses, ferias inmobiliarias, webinars, reuniones de equipo.

### 13.1 Vista de Eventos

**Vista Lista:** Todos los eventos ordenados cronológicamente con fecha, tipo, lugar y número de invitados confirmados.

**Vista Calendario:** Visualización mensual con los eventos marcados en sus fechas. Clic en un evento en el calendario abre el detalle.

### 13.2 Crear un Evento

Botón **+ Nuevo Evento**:
- Nombre del evento
- Tipo (Lanzamiento / Open House / Feria / Webinar / Reunión interna / Otro)
- Fecha y hora de inicio y fin
- Lugar o link de videoconferencia
- Descripción
- Responsable del evento

### 13.3 Vincular Prospectos

Desde la ficha del evento → sección "Invitados" → buscar y agregar prospectos del CRM.

El sistema envía (a través de Sara) la invitación por email si se aprueba el borrador generado automáticamente.

**Post-evento:** Registro de quién asistió efectivamente, generando una actividad automática en la ficha de cada prospecto asistente.

---

## 14. Catálogo

Vista simplificada del portafolio diseñada específicamente para presentaciones a clientes — se puede compartir la pantalla en una reunión y navegar el catálogo sin mostrar datos internos del CRM.

### 14.1 Diferencia con el Portafolio

| Portafolio | Catálogo |
|------------|----------|
| Uso interno del equipo | Para presentar a clientes |
| Muestra datos de inversión detallados | Muestra características y precios |
| Botón de editar disponible | Solo lectura |
| Integración con Calculadora | Sin datos internos de negocio |

### 14.2 Navegación del Catálogo

Misma estructura de categorías que el Portafolio. Las tarjetas son más grandes y visuales, optimizadas para presentación en pantalla.

Al expandir un proyecto se muestra la galería de fotos a pantalla completa y los datos relevantes para el comprador (no los datos de análisis interno).

---

## 15. Configuración (Superadmin)

Módulo de administración del sistema. Solo accesible para usuarios con rol Superadmin.

**Acceso:** Aparece al final del menú lateral (scroll hacia abajo si no lo ves).

### 15.1 Perfil de Marca

Define la identidad de la empresa en el sistema:

**Datos básicos:**
- Nombre de la empresa
- Tagline / slogan
- Información de contacto principal
- Redes sociales

**Audiencia y posicionamiento:**
- Perfil del comprador ideal (quiénes son los clientes objetivo)
- Diferenciadores de la empresa (por qué comprar con nosotros vs. la competencia)
- Propuesta de valor principal
- CTA principal (la frase de llamada a la acción en comunicaciones)

Esta información se usa como contexto en los prompts de todos los agentes IA — define el tono, el público y los argumentos de venta que Camilo, Sara, Valeria e Isabella usarán en sus comunicaciones.

**Logo:** Upload del logo de la empresa (se muestra en el sidebar y en documentos exportados).

**Colores:** Color primario y de acento. Afecta el diseño del sistema para toda la empresa.

### 15.2 Seguridad y Acceso

Gestión completa de usuarios:

**Lista de usuarios activos:**
- Ver todos los usuarios del sistema con su rol
- Cambiar el rol de cualquier usuario
- Activar / desactivar usuarios (sin borrarlos — mantiene el historial)
- Restablecer contraseña de cualquier usuario

**Crear nuevo usuario:**
- Nombre completo
- Nombre de usuario (login)
- Contraseña inicial
- Rol asignado

**Cambiar mi contraseña:**
- Sección separada donde cualquier usuario con acceso a Configuración puede cambiar su propia contraseña ingresando la actual y la nueva dos veces

### 15.3 Estructura de Comisiones

Define cómo se distribuye la comisión de cada venta:

**Entidades comisionadas:** lista configurable de quiénes reciben parte de la comisión (empresa, brokers, partners legales, etc.) con el % de cada uno.

**Total:** el sistema valida que la suma de porcentajes no supere el 100% del valor de comisión total pactado.

**Uso:** Estos valores alimentan el cálculo de comisiones en los reportes de brokers y en las fichas de ventas cerradas. No son los valores finales de liquidación — son la referencia base.

### 15.4 Parámetros del Sistema

Configuraciones que afectan el comportamiento automático del CRM:

**Lead Score:**
- Peso de cada criterio del score (ajustable en sliders de 0–20 pts)
- Umbral de alerta (por defecto: score <40 = alerta roja)

**Alertas de inactividad:**
- Días sin actividad para generar alerta leve (default: 14 días)
- Días sin actividad para alerta urgente (default: 30 días)

**Pipeline:**
- Probabilidad de cierre por etapa (defaults usados en Forecast)
- Tiempo máximo esperado en cada etapa antes de que se active una alerta

**Backup:**
- Desde aquí se puede ejecutar el backup manual del sistema (guarda el estado actual en el repositorio de código)
- El botón "Hacer Backup Ahora" sube los cambios al branch actual de git

---

## 16. Módulo Legal & Cierre y Trámites

Gestión documental y de firmas para cada expediente en etapa de Negociación, Cierre o
Post-venta, organizada en 3 fases: **Reserva → Promesa → Escritura & Registro**.

### 16.1 Expediente Legal

Cada fase agrupa sus documentos (ej. Reserva: Carta de Reserva, Comprobante de Pago,
Due Diligence, Propuesta Comercial). Por cada documento se controla:
- **Estado:** Pendiente, En Revisión, Firmado, Archivado
- **Responsable** asignado y **fecha límite**
- **Historial** de cada acción tomada sobre el documento

### 16.2 Resumen del Trámite en Lenguaje Claro (IA)

Al abrir un expediente, el sistema genera automáticamente un resumen corto en español
sencillo (sin jerga notarial) explicando en qué va el trámite del cliente y qué sigue —
por ejemplo: *"Ya completaste la reserva. Ahora falta firmar la promesa de compraventa,
que tu asesor te enviará esta semana."* El mismo resumen se muestra en el CRM y en el
portal del cliente (ver 16.5).

### 16.3 Alertas Proactivas de Vencimiento

Un monitor automático revisa diariamente todos los documentos y notifica por correo al
equipo interno cuando detecta:
- **Vencido:** la fecha límite ya pasó y el documento sigue sin firmar
- **Urgente:** vence en menos de 7 días
- **Estancado:** lleva más de 7 días enviado a firma sin respuesta

Cada correo incluye el nombre del cliente, el documento específico y la fecha — no es un
aviso genérico. El sistema no reenvía el mismo aviso más de una vez cada 48 horas.

### 16.4 Firma Digital (DocuSign)

Desde el modal de **Firmas** de cada documento:
- Se definen los firmantes (comprador, vendedor, notario) con su correo
- Botón **"Enviar por DocuSign"** crea un sobre de firma real y envía el enlace a cada
  firmante; el estado del documento se actualiza automáticamente cuando todos firman
- Si la cuenta de DocuSign de la empresa aún no está conectada, el botón muestra un
  aviso claro ("Conecta tu cuenta DocuSign...") en vez de fallar — el enlace manual de
  firma sigue disponible como alternativa mientras tanto

### 16.5 "Tu Trámite" en el Portal del Cliente

El comprador, desde su portal (mismo acceso que usa para ver su Cartera), tiene una
sección **"Tu Trámite"** con:
- El resumen en lenguaje claro (ver 16.2)
- El estado de cada documento y su fecha límite si aplica

El cliente nunca ve notas internas del equipo, nombre del responsable interno ni el
historial de gestión — solo lo que le compete a él.

### 16.6 Adjuntar Documentos

Los archivos que el broker sube en el modal "Adjuntar" se guardan de forma permanente
(no se pierden al recargar la página, a diferencia de un enlace pegado a mano que puede
caducar).

---

## 17. Hoja de Ruta de Mejoras (Anexo)

GLP CRM se compara y mejora continuamente frente a competidores del mercado (ej.
SmartHome). El detalle completo de esa comparación — qué se ha implementado y qué sigue
pendiente — se mantiene como documento vivo en
[`ROADMAP_MEJORAS_CRM.md`](./ROADMAP_MEJORAS_CRM.md), en la raíz del proyecto.

---

## Glosario

| Término | Definición |
|---------|-----------|
| **Lead Score** | Puntaje automático 0–100 que mide qué tan calificado y comprometido está un prospecto |
| **Pipeline** | Suma del valor potencial de todos los prospectos activos en el sistema |
| **Cap Rate** | Renta neta anual ÷ Precio de compra × 100. Mide la rentabilidad bruta de un inmueble |
| **NOI** | Net Operating Income. Renta bruta menos todos los gastos operativos, antes de deuda |
| **Drip Campaign** | Secuencia de emails automatizados enviados en intervalos de días predefinidos |
| **Etapa del Pipeline** | Estado actual de la negociación con un prospecto |
| **Cohorte** | Grupo de prospectos que entraron al sistema en el mismo período |
| **Tenant** | En contexto SaaS: empresa cliente que usa el sistema |
| **Benchmark** | Referencia del promedio del sector para comparar el propio desempeño |
| **CTR** | Click-Through Rate. % de personas que hacen clic en un enlace de los que lo recibieron |
| **Open Rate** | Tasa de apertura. % de personas que abrieron un email de los que lo recibieron |

---

*Manual actualizado: Julio 2026 — GLP CRM v2.0*  
*Para soporte técnico contactar al administrador del sistema*
