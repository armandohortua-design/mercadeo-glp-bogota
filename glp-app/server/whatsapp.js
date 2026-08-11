/**
 * whatsapp.js — Integración WhatsApp Business (Meta Cloud API)
 * Flujo: mensaje entrante (webhook) → prospecto en DB → perfil IA → respuesta Sara → envío
 *
 * Requiere (ver .env.example):
 *   WHATSAPP_ACCESS_TOKEN    — token del Meta Business App
 *   WHATSAPP_PHONE_NUMBER_ID — id del número de WhatsApp Cloud API
 *   WHATSAPP_VERIFY_TOKEN    — token propio que tú eliges, usado para verificar el webhook
 *
 * Sin estas variables configuradas, el webhook de recepción sigue funcionando
 * (guarda el mensaje y genera el perfil/respuesta), pero el envío real a Meta se omite
 * silenciosamente — útil para probar el flujo antes de tener la cuenta de Meta lista.
 */

const pool = require('./db');

const GRAPH_API_VERSION = 'v20.0';

// Envía un mensaje de texto por WhatsApp Cloud API. No lanza si faltan credenciales —
// solo lo registra, para no romper el resto del flujo (guardado en DB, perfil IA, etc.)
async function sendWhatsAppMessage(to, text) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp] Credenciales no configuradas — mensaje no enviado (solo registrado en DB).');
    return { skipped: true };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    const data = await res.json();
    if (!res.ok) console.error('[WhatsApp] Error enviando mensaje:', data);
    return data;
  } catch (err) {
    console.error('[WhatsApp] Error de red enviando mensaje:', err.message);
    return { error: err.message };
  }
}

// Extrae perfil del cliente desde el texto del mensaje — mismo patrón que
// emailPoller.js::extractClientProfile, generalizado para cualquier canal de texto.
async function extractClientProfile(nombre, canal, texto) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Analiza este mensaje de ${canal} de un potencial cliente inmobiliario y extrae su perfil.

Remitente: ${nombre}
Mensaje: """
${texto.slice(0, 1000)}
"""

Extrae SOLO lo que el cliente menciona explícitamente. Si no lo menciona, usa null.
Responde SOLO con JSON:
{
  "proyectos_interes": ["nombre proyecto si menciona", ...],
  "presupuesto_usd": número o null,
  "perfil_inversor": "descripción breve del perfil detectado o null",
  "ocupacion_inferida": "string o null",
  "notas_sara": "observación comercial breve para el equipo de ventas"
}`,
      }],
      temperature: 0.3,
      max_tokens: 300,
    });
    const raw = response.choices[0].message.content.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('[WhatsApp] Error extrayendo perfil:', err.message);
    return null;
  }
}

// Genera la respuesta automática de Sara, adaptando el tono al arquetipo del prospecto
// cuando ya existe (mismo criterio de tono usado en Cartera para los recordatorios de pago).
async function generateSaraReply(nombre, texto, arquetipo) {
  const apiKey = process.env.OPENAI_API_KEY;
  const firma = 'Sara · GLP Wealth Management';
  if (!apiKey) {
    return `Hola ${nombre}, gracias por escribirnos. En breve uno de nuestros asesores te contacta. — ${firma}`;
  }
  const tono = arquetipo === 'estatus' ? 'exclusivo y discreto, sin sonar a venta masiva'
    : arquetipo === 'legado' ? 'cálido y patrimonial, enfocado en el largo plazo'
    : arquetipo === 'aspiracional' ? 'inspirador y cercano'
    : 'claro, directo y basado en datos concretos';
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres Sara, asesora de inversiones inmobiliarias de GLP Wealth Management (Panamá). Respondes mensajes de WhatsApp: cortas (máx 3-4 líneas), sin emojis en exceso, tono ${tono}. Firma como "${firma}" solo si es el primer mensaje de la conversación.`,
        },
        { role: 'user', content: `Mensaje de ${nombre} por WhatsApp: "${texto}"` },
      ],
      temperature: 0.7,
      max_tokens: 250,
    });
    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('[WhatsApp] Error generando respuesta Sara:', err.message);
    return `Hola ${nombre}, gracias por escribirnos. En breve uno de nuestros asesores te contacta. — ${firma}`;
  }
}

// Procesa un mensaje entrante de WhatsApp: upsert de prospecto por teléfono, perfil IA,
// guardado en historial, respuesta automática y envío.
async function processIncomingMessage(tenantId, { telefono, nombre, texto, waMessageId }) {
  const { rows: existing } = await pool.query(
    'SELECT * FROM prospectos WHERE telefono = $1 AND tenant_id = $2',
    [telefono, tenantId]
  );

  let prospecto;
  if (existing.length === 0) {
    const { rows: inserted } = await pool.query(
      `INSERT INTO prospectos (tenant_id, nombre, apellido, telefono, proyectos_interes, forma_contacto, estado, canal, notas, fecha_registro, fecha_ultima_actividad)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
      [tenantId, nombre || 'Prospecto WhatsApp', '', telefono, '[]', 'WhatsApp', 'Contacto Inicial', 'WhatsApp', `[WhatsApp] ${texto.slice(0, 200)}`]
    );
    prospecto = inserted[0];
  } else {
    prospecto = existing[0];
    await pool.query(
      `UPDATE prospectos SET notas = COALESCE(notas,'') || $1, fecha_ultima_actividad = NOW() WHERE id = $2`,
      [`\n[WhatsApp] ${texto.slice(0, 200)}`, prospecto.id]
    );
  }

  // Guardar el mensaje entrante
  await pool.query(
    `INSERT INTO whatsapp_messages (tenant_id, prospecto_id, telefono, direccion, texto, estado, wa_message_id)
     VALUES ($1,$2,$3,'in',$4,'recibido',$5)`,
    [tenantId, prospecto.id, telefono, texto, waMessageId || null]
  );

  // Enriquecer perfil vía IA (mismo patrón que emailPoller.js)
  const perfil = await extractClientProfile(prospecto.nombre, 'WhatsApp', texto);
  if (perfil) {
    const updates = {};
    if (perfil.presupuesto_usd) updates.presupuesto_usd = perfil.presupuesto_usd;
    if (perfil.ocupacion_inferida) updates.ocupacion = perfil.ocupacion_inferida;
    if (perfil.proyectos_interes?.length > 0) updates.proyectos_interes = JSON.stringify(perfil.proyectos_interes);
    const notaIA = [
      perfil.perfil_inversor ? `🎯 Perfil: ${perfil.perfil_inversor}` : null,
      perfil.notas_sara ? `💡 SARA: ${perfil.notas_sara}` : null,
    ].filter(Boolean).join('\n');
    const fields = Object.keys(updates);
    if (fields.length > 0 || notaIA) {
      const setClause = [
        ...fields.map((f, i) => `${f} = $${i + 1}`),
        notaIA ? `notas = COALESCE(notas,'') || $${fields.length + 1}` : null,
        'fecha_ultima_actividad = NOW()',
      ].filter(Boolean).join(', ');
      const values = [
        ...fields.map(f => updates[f]),
        ...(notaIA ? [`\n\n[IA ${new Date().toLocaleDateString('es-CO')}]\n${notaIA}`] : []),
        prospecto.id,
      ];
      await pool.query(`UPDATE prospectos SET ${setClause} WHERE id = $${values.length}`, values);
    }
  }

  // Bitácora compartida (mismo patrón que registrarActividad en el frontend)
  await pool.query(
    `UPDATE prospectos SET historial = COALESCE(historial,'[]'::jsonb) || $1::jsonb WHERE id = $2`,
    [JSON.stringify([{ fecha: new Date().toISOString().split('T')[0], accion: 'Mensaje WhatsApp', detalle: texto.slice(0, 200) }]), prospecto.id]
  );

  // Los perfiles Sofía ahora se persisten en Postgres (tabla sofia_profiles) — se usa el
  // arquetipo real del prospecto si Sofía ya lo clasificó, en vez del tono neutral fijo.
  const { rows: sofiaRows } = await pool.query('SELECT arquetipo FROM sofia_profiles WHERE prospecto_id = $1', [prospecto.id]);
  const respuesta = await generateSaraReply(prospecto.nombre, texto, sofiaRows[0]?.arquetipo);
  await sendWhatsAppMessage(telefono, respuesta);
  await pool.query(
    `INSERT INTO whatsapp_messages (tenant_id, prospecto_id, telefono, direccion, texto, estado)
     VALUES ($1,$2,$3,'out',$4,'enviado')`,
    [tenantId, prospecto.id, telefono, respuesta]
  );

  return { prospecto, respuesta };
}

module.exports = { sendWhatsAppMessage, extractClientProfile, generateSaraReply, processIncomingMessage };
