# Arquitectura Agéntica Multiusuario — Diagnóstico y Plan de Trabajo

Fecha: 2026-08-14 · Alcance: `src/crm/CRMDashboard.tsx` (módulo Agentes IA), `server/index.js`, `server/crisisDetector.js`, `server/prospectMonitor.js`, `server/legalAlertMonitor.js`

Este documento retoma la evaluación de estándares agénticos de la sesión anterior (ver `AUDITORIA_AGENTES_IA.md` para el detalle de qué llamadas son reales vs. simuladas) y la extiende con la variable que cambia todo: **la plataforma va a ser multiusuario**. Varios brokers, gerentes y presidencia van a tener el CRM abierto simultáneamente, en la misma cuenta de tenant. Eso convierte varios problemas que hoy son "molestias menores de un solo usuario" en **bugs de concurrencia reales**.

---

## 1. Diagnóstico — qué tan cerca está de los estándares actuales

| Criterio | Estado hoy | Por qué importa en multiusuario |
|---|---|---|
| Orquestación | `runSwarm()` corre en el navegador de un usuario — `await` secuenciales de React | Si Broker A cierra la pestaña a mitad del research, Broker B no ve nada — no hay ningún indicador de que "alguien más ya está corriendo esto" |
| Grafo de estados | Pipeline Camilo→Sofía→Sara→Valeria→Isabella existe solo como dibujo en el header | No hay problema de concurrencia aquí per se, pero tampoco hay forma de saber "en qué paso va" si lo inició otro usuario |
| Salidas estructuradas | `JSON.parse()` de texto libre con regex para limpiar \`\`\`json | Un fallo de parseo silencioso hoy solo afecta a quien lo disparó; en multiusuario un fallo recurrente afecta a todo el equipo sin que nadie lo note |
| Ejecución durable | Los monitores de servidor (`crisisDetector`, `prospectMonitor`, `legalAlertMonitor`) sí corren 24/7 en el backend — eso está bien. El swarm interactivo no. | — |
| Observabilidad | `swarmLogs` es un array en memoria de React de UN navegador | **Crítico en multiusuario**: no hay forma de que un admin vea "qué hizo cada usuario hoy con los agentes" — ni para soporte, ni para control de costo por persona/tenant |
| Guardrails | Reglas anti-alucinación a nivel de prompt (bien), sin validación de esquema programática | — |
| Human-in-the-loop | Los correos de Sara quedan en borrador pendiente — correcto | ⚠️ Pero: **¿pendiente para quién?** Hoy cualquier usuario con acceso al módulo puede aprobar el borrador de cualquier otro — no hay asignación ni notificación de "este borrador es tuyo" |
| Idempotencia | El `session_id` del chatbot (recién implementado) es el patrón correcto | Bueno, pero es el único lugar del sistema que lo tiene — el resto de las acciones de agentes no son idempotentes |
| Memoria / RAG | Contexto armado por concatenación de strings desde la BD en cada prompt | — |

### El hallazgo nuevo — específico de multiusuario

Revisé el estado global del módulo Agentes IA (`swarmStep`, `swarmLogs`, `agentCamiloActive`, `agentSaraActive`, etc.) y **todo vive en `useState` de React, local a la sesión del navegador de cada usuario**. Esto significa:

1. **Dos usuarios pueden disparar la misma acción sobre el mismo dato al mismo tiempo, sin saberlo.** Ejemplo: Broker A y Broker B, ambos con el CRM abierto, hacen clic en "▶ Analizar Consultas" de Sara casi simultáneamente. Cada uno ve su propia animación de "Analizando...", pero **ambas llamadas al backend procesan la misma lista de prospectos en paralelo** — Sara podría generar dos borradores distintos para el mismo prospecto, o (peor, dado el patrón que ya vimos con las unidades duplicadas de Bosco) escribir dos veces sobre el mismo campo con resultados ligeramente distintos, y el que termine último gana sin que nadie lo note.
2. **No hay noción de "quién" disparó qué.** Los logs de bitácora sí guardan `tenant_id`, pero las acciones de agentes (research de Camilo, análisis de Sara, etc.) no quedan atribuidas a un usuario específico — imposible auditar "¿quién generó este borrador de correo un poco raro?" cuando hay 5 personas usando la cuenta.
3. **No hay control de costo por usuario.** Si un broker deja la pestaña abierta con auto-refresh, o si varios usuarios corren research de Camilo (con `web_search`, la llamada más cara) en paralelo sin ningún límite, el gasto de OpenAI puede dispararse sin que haya ninguna alerta ni tope configurado.

Este es el hallazgo con más impacto práctico de este documento: **el diseño actual fue construido asumiendo un solo usuario a la vez**, y ese supuesto ya no aplica.

---

## 2. Principios de diseño para la versión multiusuario

Antes del plan de fases, estos son los principios que van a guiar cada decisión — te los planteo para que los valides o ajustes antes de que empecemos a tocar código:

1. **Toda acción de agente queda atribuida a un usuario y un tenant**, no solo al tenant. (`triggered_by_user`, no solo `tenant_id`).
2. **Ninguna acción de agente se ejecuta dos veces en paralelo sobre el mismo recurso.** Un lock ligero (a nivel de fila o de "job en curso") evita que dos usuarios disparen el mismo research/análisis sobre el mismo conjunto de datos al mismo tiempo — el segundo usuario ve "ya se está ejecutando, iniciado por [nombre] hace 12 segundos" en vez de disparar una segunda llamada.
3. **El estado de una ejecución en curso es visible para todos los usuarios del mismo tenant**, no solo para quien la inició — si Broker A inicia el research de Camilo, Broker B que abre el CRM 10 segundos después debe ver "Investigando..." en curso, no el botón disponible para volver a dispararlo.
4. **Los borradores pendientes de aprobación pueden asignarse o quedar abiertos a cualquiera del equipo**, pero siempre queda registrado quién aprobó/envió cada uno.
5. **Hay un límite de gasto configurable por tenant** (y opcionalmente por usuario) para las llamadas más caras (research con `web_search`), con aviso antes de bloquear, no bloqueo silencioso.

¿Estás de acuerdo con estos 5 principios, o alguno lo manejarías distinto (por ejemplo, si prefieres que CUALQUIER usuario pueda re-disparar una acción en curso sin bloqueo, o si el tope de gasto debe ser solo informativo y no bloqueante)?

---

## 3. Plan de trabajo por fases

Cada fase termina en un estado desplegable — no es necesario completar las 4 para tener valor real en producción.

### Fase 0 — Fundamentos (bajo riesgo, alto valor inmediato)
- Salidas estructuradas nativas de OpenAI (`response_format: json_schema`) en vez de `JSON.parse` de texto libre — endpoint por endpoint, empezando por los que más fallan hoy (el análisis de conversación del chatbot, que ya vimos que a veces trunca JSON).
- Logging estructurado server-side de cada llamada a IA: qué agente, qué usuario, qué tenant, tokens usados, latencia, éxito/error — una tabla nueva simple (`agent_runs`), no un servicio externo todavía.
- Atribuir cada acción de agente a un usuario (agregar `triggered_by` a las tablas relevantes: `drafts`, `camilo_insights`, etc.)

### Fase 1 — Concurrencia multiusuario (el hallazgo crítico de este documento)
- Lock ligero por tipo de acción + alcance (ej. "Sara: análisis de prospectos" por tenant) usando una tabla `agent_locks` con expiración automática — si pasan más de N minutos sin heartbeat, se libera solo (evita que un lock se quede pegado si el proceso murió).
- El frontend consulta el estado del lock antes de mostrar el botón habilitado — si ya hay uno en curso, muestra quién lo inició y hace cuánto, con opción de "ver progreso" en vez de "iniciar de nuevo".
- Mover el progreso del swarm (`swarmLogs`, `swarmStep`) de estado local de React a algo que todos los usuarios del tenant puedan ver en tiempo real (polling simple sobre la tabla de `agent_runs` de la Fase 0, sin necesidad de WebSockets todavía).

### Fase 2 — Control de costo y límites por tenant
- Tabla de configuración de límites por tenant (gasto mensual máximo estimado en llamadas a IA, o número de ejecuciones de research/día).
- Aviso proactivo (no bloqueo abrupto) cuando un tenant se acerca al límite — y bloqueo real solo si lo supera, configurable.
- Panel simple para superadmin: "gasto de IA por tenant este mes", desglosado por agente.

### Fase 3 — Grafo de estados real (la más costosa, para cuando el volumen lo justifique)
- Evaluar LangGraph (o una implementación propia ligera de máquina de estados) para reemplazar la orquestación imperativa del swarm por un grafo declarado con nodos/aristas condicionales.
- Ejecución durable real (cola de trabajos tipo BullMQ, o un cron persistente en servidor) para que el swarm sobreviva a que se cierren todas las pestañas.

---

## 4. Decisiones abiertas — necesito que las resuelvas antes de tocar código

1. **Bloqueo vs. cola**: cuando dos usuarios intentan la misma acción, ¿el segundo debe bloquearse (ver "ya en curso, espera") o encolarse (se ejecuta automáticamente cuando la primera termine)? Bloquear es más simple; encolar es mejor UX pero más trabajo.
2. **Visibilidad de logs entre usuarios**: ¿cualquier usuario del tenant debe poder ver qué hicieron los demás con los agentes (transparencia total), o solo superadmin/gerencia debe ver esa vista?
3. **Límite de gasto**: ¿quieres definirlo ya (ej. "$50 USD/mes en llamadas de IA por tenant") o prefieres que primero midamos 2-4 semanas con el logging de la Fase 0 antes de fijar un número?

Empecemos por la Fase 0 en cuanto confirmes los principios de la sección 2 y me des una primera respuesta a estas 3 preguntas — cada paso de ahí en adelante te lo voy explicando y afinando contigo antes de escribir código, como pediste.

---

## 5. Actualización 2026-08-29 — Fases 0-2 ya implementadas; pendientes de la siguiente capa

Gran parte de este documento quedó resuelta en la sesión del 2026-08-29: los 7 agentes
(Sara, Camilo, Sofía, Valeria, Isabella, Andrea/Cartera, Mónica/Legal) recibieron memoria
persistente por usuario y por cliente (`server/agentMemory.js`), colaboración de solo
lectura entre agentes (`buildAgentContext` + `consultar_a_otro_agente`), feedback loop
humano con alertas de calidad (`server/agentFeedback.js`), herramientas nuevas (búsqueda
web real, calendario interno, lectura de documentos adjuntos), razonamiento multi-paso
planificado, modelo/temperatura afinados por tipo de tarea, y auditoría completa de cada
llamada a herramienta (`server/agentAudit.js`) — la Fase 0 (`agent_runs`, atribución por
usuario) y buena parte de la Fase 2 (medición de costo real por agente) de este documento
ya están cubiertas por ese trabajo. Ver el commit `e986158` en `main`.

**Lo que sigue quedando pendiente, en orden de prioridad, para cuando se retome:**

1. **Seguridad real de identidad y permisos** — `x-user` es hoy un header autorreportado
   por el navegador, sin autenticación real detrás. No hay forma de impedir que un broker
   dispare una acción de agente sobre datos de otro broker, ni de confiar plenamente en la
   atribución `triggered_by` de los `agent_runs`. Bloquea cualquier expansión seria a más
   usuarios reales.
2. **Límites de gasto reales, no solo medición** (cierra la Fase 2 de este documento) — ya
   se mide el costo por `agent_run` con el modelo real usado, pero nada impide que un
   usuario o un bug dispare cientos de llamadas seguidas, sobre todo ahora que
   Valeria/Isabella usan `gpt-4o` (18-20x más caro que `gpt-4o-mini`). Falta el tope
   configurable por tenant/agente con aviso proactivo antes de bloquear (principio 5 de la
   sección 2, nunca implementado).
3. **Streaming de respuestas** — hoy el usuario espera en silencio 5-7 segundos mientras el
   agente hace varias rondas de herramientas y recién ahí ve todo de golpe (plan +
   respuesta). Con streaming vería el plan aparecer primero y cada paso completarse en vivo.
4. **Suite de evaluación automática (evals)** — no existe ningún set de preguntas de
   referencia con respuestas esperadas; cada ajuste de prompt se prueba manualmente con
   curl (como en toda la sesión del 29/08). El feedback loop mide la realidad en
   producción, pero nada atrapa una regresión antes de publicarla.
5. **Acciones de escritura más allá de "crear borrador"** — los agentes pueden crear
   (borradores, insights, perfiles, citas) pero no editar un registro existente (ej.
   Andrea no puede marcar una cuota como pagada aunque el usuario se lo confirme en el
   chat). Ampliar el patrón de "acción con aprobación humana" a ediciones, no solo
   creaciones.
6. **Búsqueda semántica sobre datos internos** — `consultar_datos` filtra por campos
   exactos; no puede responder algo como "¿algún cliente mencionó que se muda por trabajo?"
   porque esa señal vive en texto libre (notas, `resumen_ia`, historial de correos) sin
   índice vectorial.

Prioridad sugerida para retomar: **#1 y #4 primero** — cualquier otra mejora sobre un
sistema sin auth real hereda ese riesgo, y sin evals cada cambio de prompt futuro es un
experimento a ciegas sobre los 7 agentes ya en marcha.
