# Hoja de Ruta — GLP CRM vs SmartHome

*Anexo del Manual de Usuario — GLP CRM v2.0*
*Última actualización: Julio 2026*

---

## Contexto

SmartHome (`crm.smart-home.com.co`) es un CRM inmobiliario competidor, ampliamente
usado por constructores en Colombia. Esta hoja de ruta compara sus módulos publicados
contra el CRM de GLP y define, punto por punto, cómo GLP no solo iguala sino supera
cada capacidad — apoyándose en los agentes de IA (Sara, Isabella, Valeria, Sofía) que
ya forman parte del sistema.

Este documento es el registro permanente de esa comparación y del estado de avance de
cada punto. Se actualiza cada vez que se implementa una mejora nueva.

---

## 1. Módulo Cartera ✅ IMPLEMENTADO

**SmartHome tiene:** Planes de pago, flujo de caja, alertas de cobro, estado de cuenta.

**GLP lo supera con:**

- ✅ **Vista del cliente de su cartera en tiempo real con diseño premium** — Portal de
  cliente propio (`portal.html`), con login real (correo + contraseña), no una tabla
  genérica. El cliente ve su cronograma, plan de pagos y estado de cuenta con el mismo
  lenguaje visual del CRM.
- ✅ **Agente IA de cartera** — Sara redacta el recordatorio de pago adaptado al
  arquetipo del comprador (un ESTATUS recibe un tono distinto a un RACIONAL), y ahora
  también incorpora las señales reales del perfil Sofía del cliente cuando existen.
- ✅ **Simulador de escenarios** — "¿Qué pasa si pago X cuotas por adelantado?" calcula
  al instante el nuevo saldo pendiente y hasta cuándo queda la cartera al día, y aplica
  el pago con un clic.
- ✅ **Semáforo de riesgo con confiabilidad de pago** — Además del semáforo de riesgo
  actual (verde/amarillo/rojo), se agregó una etiqueta de confiabilidad histórica ("Buen
  historial de pago", "Historial mixto", "Historial de atrasos") basada en el
  comportamiento real de pagos del cliente.
- ✅ **Integración con el perfil Sofía** — Los recordatorios de cobro generados por IA
  usan las señales y recomendaciones ya detectadas por Sofía para ese comprador, no solo
  su arquetipo genérico.
- ✅ **Cronograma fiel a la secuencia real del negocio** — El asistente de "Parametrizar
  Plan de Pagos" ahora respeta cómo se estructura de verdad una venta: siempre inicia con
  una separación fija de USD 2,000, el saldo de la cuota inicial se difiere en el plazo
  que va desde la fecha de separación hasta la fecha de entrega del inmueble (calculado
  automáticamente), y el crédito hipotecario/financiación queda siempre agendado contra
  esa misma fecha de entrega — nunca repartido junto con la cuota inicial. Las cuotas
  siguen pudiéndose adelantar con el simulador de pago anticipado.

*Detalle técnico: Cartera pasó de vivir solo en el navegador a persistirse en base de
datos (con contraseña temporal generada automáticamente para cada cliente nuevo, que el
asesor comparte una sola vez).*

---

## 2. Omnicanal WhatsApp / Meta ✅ IMPLEMENTADO (código listo — falta conectar credenciales reales de Meta)

**SmartHome tiene:** Inbox unificado, árbol de respuestas, chatbot 24/7.

**GLP lo supera con:**

- ✅ **Sofía perfila al prospecto antes de pasarlo a Sara** — cada mensaje de WhatsApp
  entrante pasa por un enriquecimiento de perfil vía IA (presupuesto, proyecto de interés,
  perfil de inversor) antes de que Sara responda, igual que ya hace el poller de correo.
- ✅ **Respuestas generadas por IA con el tono del arquetipo** — la respuesta automática
  de Sara adapta su tono al arquetipo del prospecto cuando ya existe un perfil Sofía.
- ✅ **Bandeja unificada** — WhatsApp y email conviven en una sola línea de tiempo dentro
  de la ficha del prospecto, ordenada por fecha (Instagram DM queda para otra ronda —
  usa una API de Meta distinta con su propio proceso de aprobación).
- ✅ **Score de calidad automático al llegar** — el lead score se recalcula apenas
  se crea/actualiza el prospecto desde el mensaje entrante, visible de inmediato en el
  header de su ficha.

*Detalle técnico: todo el código (webhook de recepción/verificación, envío vía WhatsApp
Cloud API, tabla `whatsapp_messages`, enriquecimiento IA, respuesta automática) está
construido y verificado end-to-end simulando el webhook de Meta. Falta únicamente
conectar credenciales reales de una cuenta de Meta Business (`WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` — documentadas en `.env.example`) y
exponer el webhook por HTTPS público para que Meta pueda llamarlo — sin eso, no hay forma
de que lleguen mensajes reales, pero el sistema está listo para activarse en el momento
en que existan.*

---

## 3. Módulo Trámites ✅ IMPLEMENTADO (firma digital lista — falta conectar credenciales reales de DocuSign)

**SmartHome tiene:** Hitos legales, gestión documental, seguimiento
promesa-escritura-entrega.

**GLP lo supera con:**

- ✅ **Timeline visual de lujo por inmueble** — expediente legal con las 3 fases
  (Reserva / Promesa / Escritura & Registro), documentos, responsables y fechas límite,
  ahora persistido en Postgres (antes solo vivía en el navegador).
- ✅ **Agente legal IA que resume el trámite en lenguaje claro** — nueva ruta
  `POST /api/legal/resumen/:prospectoId` genera un párrafo sin jerga notarial explicando
  en qué va el trámite y qué sigue; se muestra tanto en el CRM (Legal & Cierre) como en
  el portal del cliente.
- ✅ **Alertas proactivas con contexto real** — `server/legalAlertMonitor.js` (nuevo,
  mismo patrón que el detector de crisis) escanea documentos vencidos, próximos a vencer
  o con firma estancada, y envía un correo al equipo interno con el cliente, el documento
  y la fecha exactos — no un aviso genérico. Evita reenviar el mismo aviso en <48h.
- ✅ **Firma digital integrada (DocuSign)** — botón "Enviar por DocuSign" en el modal de
  Firmas del CRM, junto al enlace manual existente. Crea el sobre real vía DocuSign
  eSignature API (JWT Grant) y un webhook (`POST /webhook/docusign`) actualiza el estado
  del documento automáticamente cuando se firma o rechaza.
- ✅ **"Tu Trámite" en el portal del cliente** — el comprador ve el timeline de sus
  documentos y el resumen en lenguaje claro, sin exponer notas internas ni datos de
  gestión (`GET /api/portal/legal`, mismo esquema de sesión por token que Cartera).
- ✅ **Adjuntos con subida real** — los documentos que sube el broker ahora se guardan
  de verdad en Supabase Storage (ya no un enlace pegado a mano ni un `blob:` que se
  pierde al recargar).

*Detalle técnico: todo lo anterior está construido y verificado end-to-end (persistencia,
alertas, resumen IA, portal, adjuntos). Falta únicamente conectar una cuenta real de
DocuSign (`DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`,
`DOCUSIGN_PRIVATE_KEY` — documentadas en `.env.example`) y exponer el webhook por HTTPS
público; sin eso, el botón "Enviar por DocuSign" muestra un aviso claro de configuración
pendiente en vez de fallar.*

---

## 4. Módulo Post-Venta / PQR ⏳ PENDIENTE

**SmartHome tiene:** Portal PQR, visitas de garantía, satisfacción.

**Cómo GLP lo va a superar:**

- Comunidad de propietarios dentro del CRM — espacio exclusivo post-compra.
- PQR con IA que clasifica urgencia y sugiere solución antes de escalar.
- NPS automatizado 30/90/180 días post-entrega.
- Historial de relación completo: desde primer contacto hasta 2 años después de la
  entrega.

---

## 5. Captura de Leads (+Lead / portales) ⏳ PENDIENTE

**SmartHome tiene:** Integración portales, landing pages, agenda automática.

**Cómo GLP lo va a superar:**

- Sofía perfilando el lead en el momento de captura (antes del primer contacto humano).
- Score predictivo: probabilidad de cierre calculada en el momento de registro.
- Asignación automática al broker correcto según arquetipo y proyecto.

---

## 6. Comisiones y Gamificación ⏳ PENDIENTE

**SmartHome tiene:** Liquidación automática, ranking, metas.

**Cómo GLP lo va a superar:**

- Dashboard de rendimiento estilo "sala de guerra" en tiempo real.
- Predicción de comisión del mes con base en pipeline actual.
- Reconocimientos personalizados por logro (no solo ranking numérico).

---

## Estado General

| # | Módulo | Estado |
|---|--------|--------|
| 1 | Cartera | ✅ Implementado |
| 2 | Omnicanal WhatsApp / Meta | ✅ Código listo (falta credenciales reales de Meta) |
| 3 | Trámites | ✅ Código listo (falta credenciales reales de DocuSign) |
| 4 | Post-Venta / PQR | ⏳ Pendiente |
| 5 | Captura de Leads | ⏳ Pendiente |
| 6 | Comisiones y Gamificación | ⏳ Pendiente |

Cada vez que se implemente un nuevo punto de esta hoja de ruta, se actualiza este
documento cambiando su estado a ✅ y agregando el detalle de lo construido, siguiendo el
mismo formato usado en el punto 1.
