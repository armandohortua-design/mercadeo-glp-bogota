# Guía de Despliegue — GLP CRM + Landing

Este proyecto tiene **dos piezas que se despliegan por separado**:

1. **Backend** (`server/`) — Express + Postgres (Supabase) + trabajos en segundo plano
   (poller de IMAP, detector de crisis, monitores de Sara/Legal). Necesita un **proceso
   Node corriendo 24/7**, no sirve un hosting serverless/estático.
2. **Frontend** (raíz del proyecto) — build estático de Vite con 5 páginas: landing
   (`index.html`), CRM (`crm.html`), detalle de proyecto (`project.html`), super-admin
   (`super-admin.html`) y portal de cliente (`portal.html`).

El frontend le habla al backend por HTTP (`VITE_API_URL`) y a Supabase directamente para
algunas cosas puntuales (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, ej. `faq_clicks`,
Storage de imágenes).

## ⚠️ El bug que ya encontramos — no lo repitas

`VITE_API_URL` **nunca debe ser `http://localhost:3001` en producción.** Esa variable se
incrusta en el bundle JavaScript público en tiempo de build — cada visitante real la
ejecuta en su propio navegador, así que "localhost" apunta a *su propia máquina*, nunca a
tu servidor. El síntoma es silencioso: el fetch falla, el código cae a datos de respaldo
fijos (ej. las FAQs hardcodeadas viejas en vez de las reales del CRM) sin ningún error
visible en pantalla. Así se nos coló: 61 clics reales de FAQs en producción-de-prueba
quedaron con preguntas que ya no existen en el CRM, porque la landing nunca pudo
consultar `/api/faqs` de verdad.

**Antes de publicar:** confirma que `VITE_API_URL` apunta a la URL pública real del
backend ya desplegado (paso 1 de abajo), nunca a localhost.

## Orden de despliegue

Despliega el backend primero — necesitas su URL pública antes de poder configurar el
frontend correctamente.

### 1. Backend (Railway o Render — recomendado para empezar)

Ambos manejan bien un proceso Node persistente con variables de entorno simples, plan
gratuito/económico para arrancar, y deploy automático desde GitHub.

1. Conecta el repo, selecciona la carpeta `server/` como raíz del servicio (o configura
   el comando de arranque para que entre a esa carpeta).
2. Comando de inicio: `node index.js` (ya definido en `server/package.json` como `npm start`).
3. Configura las variables de entorno del backend — copia la lista completa de
   `.env.example` (sección superior, antes de "FRONTEND"). Como mínimo para que arranque:
   - `DATABASE_URL` — la misma cadena de conexión de Supabase que ya usas en desarrollo
     (o una nueva si quieres separar entornos de prueba/producción).
   - `OPENAI_API_KEY`
   - `SMTP_USER`, `SMTP_PASS`, `ADMIN_EMAIL`
   - `PORT` — normalmente Railway/Render la inyectan solos; si no, usa `3001`.
   - `IMAP_MAILBOX`, `IMAP_SUBJECT_KEYWORDS` — si usas el poller de correo entrante.
   - WhatsApp/DocuSign — solo si ya tienes esas integraciones activas (ver comentarios en
     `.env.example` para cómo obtener cada credencial).
4. Despliega. Anota la URL pública que te da la plataforma
   (ej. `https://glp-backend-production.up.railway.app`).
5. Verifica que responde: `curl https://TU-URL/api/health` debe devolver
   `{"status":"ok","database":"PostgreSQL (Supabase)",...}`.

### 2. Frontend (Vercel o Netlify — recomendado)

1. Conecta el mismo repo, raíz del proyecto (no `server/`).
2. Build command: `npm run build` (ya definido — corre `tsc && vite build`).
3. Output directory: `dist` (default de Vite).
4. Variables de entorno de build — **sección "FRONTEND" de `.env.example`**:
   - `VITE_API_URL` = la URL pública del backend del paso 1. **No localhost.**
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` = mismo proyecto Supabase del backend
     (los tienes en `.env.local` para desarrollo — son la URL pública y la llave *anon*,
     nunca la `service_role`).
   - `VITE_OPENAI_KEY` — **déjala vacía**. No se usa (todas las llamadas de IA pasan por
     el backend); si la defines, quedaría visible en el bundle público sin necesidad.
5. Despliega. Prueba las 5 páginas: `/`, `/crm.html`, `/project.html`,
   `/super-admin.html`, `/portal.html`.

### 3. Dominio propio (opcional)

Si quieres un dominio real en vez de las URLs generadas (ej. `*.vercel.app`,
`*.up.railway.app`):

- Backend → subdominio tipo `api.glp.com.pa`, apuntado por CNAME al host del paso 1.
- Frontend → dominio raíz o `www`, apuntado según lo que pida Vercel/Netlify (CNAME o
  registros A, cada plataforma lo indica en su panel).
- Si cambias el dominio del backend después de desplegar el frontend, tienes que
  **re-desplegar el frontend** — `VITE_API_URL` se incrusta en tiempo de build, cambiarla
  en el panel de variables no actualiza un build ya generado.

## Checklist de verificación post-despliegue

No des el despliegue por bueno solo porque las páginas cargan — este bug en particular es
silencioso. Verifica funcionalidad real:

- [ ] `GET /api/health` en la URL del backend responde `status: ok`.
- [ ] La landing en producción muestra las FAQs **reales del CRM** (compara una pregunta
      contra el módulo FAQs del CRM — deben coincidir exactamente en texto).
- [ ] Abrir una FAQ en la landing y luego revisar en el CRM (panel de Sara → "FAQs Más
      Consultadas") que el clic sí incrementó el contador — confirma que
      `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` también están bien configuradas.
- [ ] Enviar el formulario de contacto de la landing con un correo real tuyo y confirmar
      que llega el correo de confirmación (usa el mismo backend SMTP).
- [ ] Probar el chatbot: que responda con lógica conversacional real (no el mensaje de
      respaldo genérico "¿me dejas tu correo...") y que el prospecto aparezca en el CRM.
- [ ] Si usas WhatsApp/DocuSign, confirma que los webhooks (`/webhook/whatsapp`,
      `/webhook/docusign`) son alcanzables por HTTPS público — ninguno de los dos
      funciona apuntando a localhost, ni siquiera en desarrollo (usa `ngrok` para
      probarlos localmente antes de desplegar).

## Notas sobre los trabajos en segundo plano

El backend arranca varios monitores automáticos al iniciar (`server/index.js`):
poller de IMAP (cada 3 min), monitor de prospectos de Sara (cada 60 min), detector de
crisis (cada 24h), monitor de alertas legales (cada 24h). Estos **solo corren mientras el
proceso Node esté vivo** — en plataformas con "sleep" por inactividad en el plan gratuito
(algunas configuraciones de Render), estos trabajos se detienen cuando el servicio duerme.
Si dependes de que corran de forma confiable 24/7, revisa que el plan que elijas no
duerma el proceso, o usa un servicio de "ping" externo para mantenerlo despierto.
