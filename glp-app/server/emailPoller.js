/**
 * emailPoller.js — Poller IMAP para capturar correos entrantes
 * Flujo: bandeja Gmail → prospecto en DB → borrador SARA (OpenAI)
 */

const { ImapFlow } = require('imapflow');
const pool = require('./db');

const POLL_INTERVAL_MS = 3 * 60 * 1000; // cada 3 minutos
const TENANT_ID = 'tenant-glp-001';

// Carpeta/etiqueta de Gmail a monitorear.
// Por defecto: 'GLP-Leads' (etiqueta personalizada).
// Cambia a 'INBOX' para leer todo el inbox (no recomendado con correo personal).
const MAILBOX = process.env.IMAP_MAILBOX || 'GLP-Leads';

// Palabras clave en asunto para filtrar si se usa INBOX directamente.
// Solo se aplica cuando MAILBOX=INBOX. Deja vacío para procesar todo.
// Si IMAP_SUBJECT_KEYWORDS no está definida en .env, usa palabras clave por defecto.
// Si está definida pero vacía (IMAP_SUBJECT_KEYWORDS=), procesa todos los correos sin filtro.
const _rawKeywords = process.env.IMAP_SUBJECT_KEYWORDS;
const SUBJECT_KEYWORDS = _rawKeywords !== undefined
  ? _rawKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
  : 'glp,inversión,inversion,proyecto,panama,panamá,inmueble,apartamento,propiedad'.split(',');

// Extrae el nombre limpio del campo "From" del correo
function parseSender(fromHeader) {
  if (!fromHeader) return { nombre: 'Cliente', email: '' };
  const match = fromHeader.match(/^"?([^"<]+)"?\s*<([^>]+)>/);
  if (match) {
    const parts = match[1].trim().split(/\s+/);
    return { nombre: parts[0] || 'Cliente', apellido: parts.slice(1).join(' ') || '', email: match[2].trim() };
  }
  const emailOnly = fromHeader.match(/([^\s]+@[^\s]+)/);
  return { nombre: 'Cliente', apellido: '', email: emailOnly ? emailOnly[1] : fromHeader };
}

// Extrae perfil del cliente desde el contenido del correo
async function extractClientProfile(nombre, email, subject, body) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Analiza este correo de un potencial cliente inmobiliario y extrae su perfil.

Remitente: ${nombre} <${email}>
Asunto: ${subject}
Mensaje: """
${body.slice(0, 1000)}
"""

Extrae SOLO lo que el cliente menciona explícitamente. Si no lo menciona, usa null.
Responde SOLO con JSON:
{
  "proyectos_interes": ["nombre proyecto si menciona", ...],
  "presupuesto_usd": número o null,
  "perfil_inversor": "descripción breve del perfil detectado (ej: inversor conservador, primera compra, especulador, etc.) o null",
  "inquietudes_clave": ["pregunta o inquietud 1", "pregunta o inquietud 2"],
  "ocupacion_inferida": "string o null",
  "empresa_inferida": "string o null",
  "notas_sara": "observación comercial breve para el equipo de ventas"
}`
      }],
      temperature: 0.3,
      max_tokens: 400
    });

    const raw = response.choices[0].message.content.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('[SARA] Error extrayendo perfil:', err.message);
    return null;
  }
}

// Genera borrador con OpenAI
async function generateSaraDraft(tenant, nombre, email, subject, body) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      subject: `Re: ${subject}`,
      body: `Estimado/a ${nombre},\n\nGracias por escribirnos. En breve uno de nuestros asesores se comunicará con usted.\n\nCordialmente,\nSara Valenzuela\nGLP Wealth Management`
    };
  }

  try {
    const { rows: projectRows } = await pool.query('SELECT data FROM projects WHERE tenant_id = $1', [TENANT_ID]);
    const catalogSummary = projectRows.map(r => `- ${r.data?.name}: desde $${r.data?.price} USD`).join('\n') || 'Portafolio disponible';

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres Sara Valenzuela, Directora de Customer Success de GLP Wealth Management, firma de inversión inmobiliaria en Panamá.

Redacta una respuesta comercial cálida, sofisticada y personalizada al siguiente correo entrante:

Remitente: ${nombre} <${email}>
Asunto original: ${subject}
Mensaje: """
${body.slice(0, 800)}
"""

Catálogo GLP:
${catalogSummary}

Reglas:
- Responde en español
- Tono cálido, profesional, de asesor de confianza (no genérico)
- Si el mensaje menciona un proyecto específico, referencia ese proyecto
- Si el mensaje es una consulta general, invítalo a una videollamada de diagnóstico
- Máximo 200 palabras
- Firma como Sara Valenzuela

Responde SOLO con JSON: {"subject":"...","body":"..."}`
      }],
      temperature: 0.7,
      max_tokens: 500
    });

    const raw = response.choices[0].message.content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error('[SARA] Error OpenAI:', err.message);
    return {
      subject: `Re: ${subject}`,
      body: `Estimado/a ${nombre},\n\nGracias por escribirnos. En breve uno de nuestros asesores se comunicará con usted.\n\nSara Valenzuela\nGLP Wealth Management`
    };
  }
}

// B.2: Notificación al admin cuando Sara genera un borrador desde correo entrante
async function notifyAdminNewDraft({ nombre, rawEmail, subject, draft }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpUser  = process.env.SMTP_USER;
  const smtpPass  = process.env.SMTP_PASS;
  if (!adminEmail || !smtpUser || !smtpPass) return;

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: `"Sara · GLP CRM" <${smtpUser}>`,
      to: adminEmail,
      subject: `📨 Sara generó borrador — ${nombre} escribió: "${subject}"`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:#001A37;color:#D4AF6A;padding:20px;text-align:center">
            <h2 style="margin:0;letter-spacing:2px">SARA · CORREO ENTRANTE</h2>
            <p style="margin:4px 0;font-size:12px;color:#fff;opacity:.8">${new Date().toLocaleString('es-CO')}</p>
          </div>
          <div style="padding:24px;background:#fff">
            <p>Sara recibió un correo de <strong>${nombre}</strong> (<a href="mailto:${rawEmail}">${rawEmail}</a>) y generó automáticamente un borrador de respuesta listo para revisar.</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
              <tr><td style="padding:8px;color:#6b7280;width:120px">Remitente</td><td style="padding:8px;font-weight:600">${nombre} &lt;${rawEmail}&gt;</td></tr>
              <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Asunto original</td><td style="padding:8px">${subject}</td></tr>
              <tr><td style="padding:8px;color:#6b7280">Asunto borrador</td><td style="padding:8px;font-weight:600;color:#001A37">${draft.subject}</td></tr>
            </table>
            <div style="border-left:3px solid #B89047;padding:12px 16px;background:#fafaf7;margin-bottom:20px">
              <div style="font-size:11px;color:#B89047;font-weight:700;letter-spacing:1px;margin-bottom:8px">BORRADOR SARA</div>
              <pre style="white-space:pre-wrap;font-family:sans-serif;font-size:13px;color:#374151;margin:0">${draft.body}</pre>
            </div>
            <p style="color:#9ca3af;font-size:11px">Ingresa al CRM → Módulo Sara → Gestión de Correos para aprobar y enviar este borrador.</p>
          </div>
        </div>`
    });
    console.log(`[IMAP] 📧 Admin notificado: borrador para ${nombre} <${rawEmail}>`);
  } catch (err) {
    console.error('[IMAP] Error notificando admin:', err.message);
  }
}

async function pollInbox() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('[IMAP] SMTP_USER o SMTP_PASS no configurados — poller desactivado.');
    return;
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false
  });

  try {
    await client.connect();

    // Intentar abrir la etiqueta/carpeta configurada; si no existe, advertir y salir
    let lock;
    try {
      lock = await client.getMailboxLock(MAILBOX);
    } catch (lockErr) {
      console.warn(`[IMAP] Carpeta "${MAILBOX}" no encontrada. Crea la etiqueta en Gmail o cambia IMAP_MAILBOX en .env.`);
      await client.logout();
      return;
    }

    try {
      // Buscar correos NO vistos (no procesados)
      const messages = [];
      for await (const msg of client.fetch({ unseen: true }, { envelope: true, bodyStructure: true, source: true })) {
        messages.push(msg);
      }

      console.log(`[IMAP] ${messages.length} correos sin leer en "${MAILBOX}".`);

      for (const msg of messages) {
        const from = msg.envelope?.from?.[0];
        if (!from) continue;

        const rawEmail = from.address || (from.mailbox && from.host ? `${from.mailbox}@${from.host}` : '');

        console.log(`[IMAP] 📨 Procesando: "${msg.envelope?.subject}" de ${rawEmail} (mailbox=${from.mailbox} host=${from.host} address=${from.address})`);

        // Ignorar correos enviados desde la misma cuenta
        if (rawEmail.toLowerCase() === user.toLowerCase()) {
          console.log(`[IMAP] ⏭ Auto-enviado, ignorado.`);
          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
          continue;
        }

        // Si estamos en INBOX y hay palabras clave definidas, filtrar por asunto
        if (MAILBOX.toUpperCase() === 'INBOX' && SUBJECT_KEYWORDS.length > 0) {
          const subjectLower = (msg.envelope?.subject || '').toLowerCase();
          const matches = SUBJECT_KEYWORDS.some(kw => subjectLower.includes(kw));
          if (!matches) {
            console.log(`[IMAP] ⏭ Ignorado (sin palabras clave): "${msg.envelope?.subject}"`);
            continue;
          }
        }
        // Si SUBJECT_KEYWORDS está vacío → procesar todos los correos sin filtro
        const senderName = from.name || from.mailbox || 'Cliente';
        const parts = senderName.trim().split(/\s+/);
        const nombre = parts[0] || 'Cliente';
        const apellido = parts.slice(1).join(' ') || '';
        const subject = msg.envelope?.subject || 'Consulta sin asunto';

        // Leer cuerpo del texto plano
        let bodyText = '';
        if (msg.source) {
          const src = msg.source.toString();
          // Extraer texto después de los headers
          const bodyStart = src.indexOf('\r\n\r\n');
          bodyText = bodyStart >= 0 ? src.slice(bodyStart + 4).replace(/<[^>]+>/g, ' ').trim() : src.slice(0, 600);
        }

        if (!rawEmail) {
          console.log(`[IMAP] ⚠️ No se pudo extraer email del remitente, ignorando.`);
          continue;
        }

        console.log(`[IMAP] ✅ Email extraído: ${rawEmail}, buscando en DB...`);

        // Verificar si ya existe como prospecto
        const { rows: existing } = await pool.query(
          'SELECT id FROM prospectos WHERE correo = $1 AND tenant_id = $2',
          [String(rawEmail), String(TENANT_ID)]
        );

        let prospectoId;
        if (existing.length === 0) {
          console.log(`[IMAP] Insertando nuevo prospecto...`);
          const { rows: inserted } = await pool.query(
            `INSERT INTO prospectos (tenant_id, nombre, apellido, correo, proyectos_interes, forma_contacto, estado, canal, notas, fecha_registro, fecha_ultima_actividad)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING id`,
            [String(TENANT_ID), String(nombre), String(apellido), String(rawEmail),
             '[]', 'Correo Entrante', 'Contacto Inicial', 'Email',
             `[Correo entrante] ${subject}`]
          );
          prospectoId = inserted[0].id;
          console.log(`[IMAP] ✅ Nuevo prospecto creado: ${nombre} <${rawEmail}>`);
        } else {
          prospectoId = existing[0].id;
          console.log(`[IMAP] Actualizando prospecto existente id=${prospectoId}...`);
          await pool.query(
            `UPDATE prospectos SET notas = COALESCE(notas,'') || $1, fecha_ultima_actividad = NOW() WHERE id = $2`,
            [`\n[Correo entrante] ${subject}`, String(prospectoId)]
          );
          console.log(`[IMAP] ℹ️ Prospecto actualizado: ${nombre} <${rawEmail}>`);
        }

        // Perfilar cliente con IA
        console.log(`[IMAP] Extrayendo perfil del cliente...`);
        const perfil = await extractClientProfile(nombre, rawEmail, subject, bodyText);
        if (perfil) {
          const updates = {};
          if (perfil.presupuesto_usd) updates.presupuesto_usd = perfil.presupuesto_usd;
          if (perfil.ocupacion_inferida) updates.ocupacion = perfil.ocupacion_inferida;
          if (perfil.empresa_inferida) updates.empresa = perfil.empresa_inferida;
          if (perfil.proyectos_interes?.length > 0) updates.proyectos_interes = JSON.stringify(perfil.proyectos_interes);

          // Construir nota enriquecida
          const notaIA = [
            perfil.perfil_inversor ? `🎯 Perfil: ${perfil.perfil_inversor}` : null,
            perfil.inquietudes_clave?.length > 0 ? `❓ Inquietudes: ${perfil.inquietudes_clave.join(' | ')}` : null,
            perfil.notas_sara ? `💡 SARA: ${perfil.notas_sara}` : null,
          ].filter(Boolean).join('\n');

          const fields = Object.keys(updates);
          if (fields.length > 0 || notaIA) {
            const setClause = [
              ...fields.map((f, i) => `${f} = $${i + 1}`),
              notaIA ? `notas = COALESCE(notas,'') || $${fields.length + 1}` : null,
              `fecha_ultima_actividad = NOW()`
            ].filter(Boolean).join(', ');

            const values = [
              ...fields.map(f => updates[f]),
              ...(notaIA ? [`\n\n[IA ${new Date().toLocaleDateString('es-CO')}]\n${notaIA}`] : []),
              String(prospectoId)
            ];

            await pool.query(
              `UPDATE prospectos SET ${setClause} WHERE id = $${values.length}`,
              values
            );
            console.log(`[IMAP] 🧠 Perfil actualizado: ${JSON.stringify(perfil)}`);
          }
        }

        console.log(`[IMAP] Verificando borrador existente...`);
        const { rows: existingDraft } = await pool.query(
          `SELECT id FROM drafts WHERE tenant_id = $1 AND destinatario LIKE $2 AND status = 'pending' AND created_at > NOW() - INTERVAL '24 hours'`,
          [String(TENANT_ID), `%${String(rawEmail)}%`]
        );

        if (existingDraft.length === 0) {
          console.log(`[IMAP] Generando borrador SARA...`);
          const draft = await generateSaraDraft(null, nombre, rawEmail, subject, bodyText);
          const draftId = `draft-email-${Date.now()}-${Math.floor(Math.random() * 9000)}`;

          await pool.query(
            `INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, prioridad, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
            [String(draftId), String(TENANT_ID), `${nombre} (${rawEmail})`,
             'Correo Entrante', String(draft.subject), String(draft.body), 'pending', 'alta']
          );
          console.log(`[IMAP] 📝 Borrador SARA creado: "${draft.subject}"`);

          // B.2: Notificar al admin cuando Sara genera un borrador desde correo entrante
          await notifyAdminNewDraft({ nombre, rawEmail, subject, draft });
        } else {
          console.log(`[IMAP] Borrador ya existe, omitiendo.`);
        }

        // Marcar el correo como leído para no reprocesarlo
        await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error('[IMAP] Error en poller:', err.message);
    try { await client.logout(); } catch (_) {}
  }
}

function startEmailPoller() {
  console.log(`[IMAP] Poller iniciado — revisando cada ${POLL_INTERVAL_MS / 60000} min.`);
  pollInbox(); // primera ejecución inmediata
  setInterval(pollInbox, POLL_INTERVAL_MS);
}

module.exports = { startEmailPoller, pollInbox };
