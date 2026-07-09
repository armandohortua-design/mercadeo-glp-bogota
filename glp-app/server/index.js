const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const pool = require('./db');
const { startEmailPoller, pollInbox } = require('./emailPoller');
const { startProspectMonitor, monitorProspects, saraAutoTrigger72h, detectColdProspects } = require('./prospectMonitor');
const { startCrisisDetector, detectCrisis } = require('./crisisDetector');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ==========================================
// MULTI-TENANT: resolver tenant desde header
// ==========================================
async function resolveTenant(req) {
  const tenantId = req.headers['x-tenant-id'] || 'tenant-glp-001';
  try {
    const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (rows.length > 0) return rows[0];
  } catch (err) {
    console.error('Error resolviendo tenant:', err.message);
  }
  return {
    id: 'default',
    name: 'GLP Wealth Management',
    domain: 'glp.com.pa',
    contact: { address: '2GFM+R7, C. Ramon H. Jurado, Panamá', email: 'info@glp.com.pa', website: 'www.glp.com.pa' },
    smtp: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    openai: { apiKey: process.env.OPENAI_API_KEY }
  };
}

function getTransporter(tenant) {
  const user = tenant?.smtp?.user || process.env.SMTP_USER;
  const pass = tenant?.smtp?.pass || process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn(`⚠️ SMTP no configurado para tenant ${tenant?.id}`);
    return null;
  }
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
}

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'PostgreSQL (Supabase)',
      serverTime: new Date().toISOString(),
      smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      openaiConfigured: !!process.env.OPENAI_API_KEY
    });
  } catch (err) {
    res.status(500).json({ status: 'error', database: err.message });
  }
});

// ==========================================
// PROSPECTOS
// ==========================================
app.get('/api/prospectos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      'SELECT * FROM prospectos WHERE tenant_id = $1 ORDER BY fecha_registro DESC',
      [tenant.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prospectos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const p = req.body;
    const { rows } = await pool.query(
      `INSERT INTO prospectos (
        tenant_id, nombre, apellido, correo, telefono, direccion, ocupacion, empresa,
        linkedin, proyectos_interes, forma_contacto, broker_asignado, presupuesto_usd,
        estado, canal, notas, historial, fecha_registro, fecha_ultima_actividad
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        tenant.id, p.nombre, p.apellido, p.correo, p.telefono, p.direccion,
        p.ocupacion, p.empresa, p.linkedin,
        JSON.stringify(p.proyectos_interes || []),
        p.forma_contacto, p.broker_asignado, p.presupuesto_usd,
        p.estado || 'Lead Nuevo', p.canal || 'Web', p.notas,
        JSON.stringify(p.historial || []),
        p.fecha_registro || new Date().toISOString(),
        new Date().toISOString()
      ]
    );
    res.json({ success: true, prospecto: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/prospectos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'tenant_id');
    if (fields.length === 0) return res.json({ success: true });

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map(f => {
      if ((f === 'proyectos_interes' || f === 'historial') && Array.isArray(updates[f]))
        return JSON.stringify(updates[f]);
      return updates[f];
    });
    values.push(id, tenant.id);

    await pool.query(
      `UPDATE prospectos SET ${setClause}, fecha_ultima_actividad = NOW()
       WHERE id = $${fields.length + 1} AND tenant_id = $${fields.length + 2}`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/prospectos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM prospectos WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ACTIVOS
// ==========================================
app.get('/api/activos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query('SELECT * FROM activos WHERE tenant_id = $1', [tenant.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activos', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const a = req.body;
    const { rows } = await pool.query(
      `INSERT INTO activos (tenant_id, proyecto, unidad, metros_cuadrados, habitaciones, precio_usd, estado, detalles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenant.id, a.proyecto, a.unidad, a.metros_cuadrados, a.habitaciones, a.precio_usd, a.estado || 'Disponible', a.detalles]
    );
    res.json({ success: true, activo: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/activos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'tenant_id');
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = [...fields.map(f => updates[f]), id, tenant.id];
    await pool.query(`UPDATE activos SET ${setClause} WHERE id = $${fields.length + 1} AND tenant_id = $${fields.length + 2}`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/activos/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM activos WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BITÁCORA
// ==========================================
app.get('/api/bitacora', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      'SELECT * FROM bitacora WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 200',
      [tenant.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BORRADORES (DRAFTS)
// ==========================================
app.get('/api/drafts', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      'SELECT * FROM drafts WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenant.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drafts/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query('DELETE FROM drafts WHERE id = $1 AND tenant_id = $2', [req.params.id, tenant.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PROYECTOS / CATÁLOGO
// ==========================================
app.get('/api/projects', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      "SELECT id, data, imagen_url FROM projects WHERE tenant_id = $1 ORDER BY data->>'category', data->>'name'",
      [tenant.id]
    );
    res.json(rows.map(r => ({ id: r.id, ...r.data, imagen: r.imagen_url || r.data?.imagen })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { projects } = req.body;
    if (!Array.isArray(projects)) return res.status(400).json({ error: 'Se requiere un arreglo de proyectos.' });
    await pool.query('DELETE FROM projects WHERE tenant_id = $1', [tenant.id]);
    for (const p of projects) {
      await pool.query(
        'INSERT INTO projects (id, tenant_id, data) VALUES ($1, $2, $3)',
        [p.id || `proj-${Date.now()}-${Math.random()}`, tenant.id, JSON.stringify(p)]
      );
    }
    res.json({ success: true, count: projects.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CONTACTO (Landing Page → CRM)
// ==========================================
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, project, message, channel, conversationHistory } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Nombre y Correo son obligatorios.' });

    const firstName = name.trim().split(/\s+/)[0] || 'Cliente';
    const tenant = await resolveTenant(req);
    const transporter = getTransporter(tenant);

    let emailClientSent = false, emailAdminSent = false, smtpError = null;

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"Sara Valenzuela · ${tenant.name}" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
          to: email,
          subject: `Hemos recibido tu solicitud para ${project} - GLP`,
          html: `<div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;border:1px solid #E5E7EB;border-top:4px solid #002349;border-radius:8px;padding:32px;background:#ffffff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <p style="font-size:16px;font-weight:600;color:#002349;margin-top:0;margin-bottom:16px;">Estimado/a ${firstName},</p>
            <p style="margin-bottom:16px;">Reciba un cordial saludo de parte de nuestro equipo. A través de este mensaje, le confirmamos la recepción de su solicitud de información referente al proyecto <strong>${project}</strong>, perteneciente a nuestro portafolio de inversión inmobiliaria dolarizada en Panamá.</p>
            <p style="margin-bottom:24px;">Nuestros especialistas comerciales ya están revisando los detalles de su consulta. Nos pondremos en contacto con usted a la mayor brevedad posible para proporcionarle la ficha técnica ampliada, planos de distribución y las proyecciones de rentabilidad correspondientes.</p>
            <div style="margin:28px 0;padding:20px;background:#F9FAFB;border-left:4px solid #B89047;border-radius:6px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#002349;text-transform:uppercase;letter-spacing:0.05em;">Detalles de su solicitud:</p>
              <ul style="margin:8px 0 0 0;padding-left:20px;font-size:14px;color:#4B5563;">
                <li><strong>Proyecto de interés:</strong> ${project}</li>
                <li><strong>Mensaje / Requerimiento:</strong> ${message || 'Solicitud de información general.'}</li>
              </ul>
            </div>
            <p style="margin-bottom:24px;">Si desea agilizar su consulta o requiere asistencia inmediata, puede responder directamente a este correo o comunicarse con nosotros vía WhatsApp.</p>
            <p style="margin-bottom:12px;color:#4B5563;">Atentamente,</p>
            <table style="border-collapse:collapse;margin-top:16px;">
              <tr><td style="border-left:3px solid #B89047;padding-left:16px;">
                <div style="font-size:15px;font-weight:bold;color:#002349;">Sara Valenzuela</div>
                <div style="font-size:11px;color:#B89047;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Directora de Customer Success & Back-Office Comercial</div>
                <div style="font-size:13px;font-weight:bold;color:#111827;">${tenant.name}</div>
                <div style="font-size:11px;color:#4B5563;">${tenant.contact?.address || ''}<br/>
                  <a href="mailto:${tenant.contact?.email || ''}" style="color:#002349;text-decoration:none;font-weight:600;">${tenant.contact?.email || ''}</a> |
                  <a href="https://${tenant.contact?.website || ''}" style="color:#002349;text-decoration:none;font-weight:600;">${tenant.contact?.website || ''}</a>
                </div>
              </td></tr>
            </table>
            <hr style="border:0;border-top:1px solid #E5E7EB;margin:28px 0;"/>
            <p style="font-size:10px;color:#94a3b8;font-style:italic;line-height:1.4;"><strong>Nota de Confidencialidad:</strong> Esta comunicación contiene información exclusiva y confidencial de ${tenant.name}. Queda estrictamente prohibida su divulgación sin autorización previa y por escrito.</p>
          </div>`
        });
        emailClientSent = true;

        await transporter.sendMail({
          from: `"SARA Lead Alert" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
          to: process.env.SMTP_USER,
          subject: `🚨 Nuevo Lead Registrado: ${name} - ${project}`,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#334155;max-width:600px;margin:0 auto;border:1px solid #cbd5e1;border-radius:8px;padding:24px;background:#f8fafc;">
            <h2 style="color:#0f172a;margin-top:0;border-bottom:2px solid #e2e8f0;padding-bottom:12px;">Nuevo Lead desde la Web 🚀</h2>
            <p>Hola Armando,</p>
            <p>Se ha registrado un cliente interesado en el portafolio inmobiliario:</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <tr style="background:#f1f5f9;"><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;width:35%;">Nombre:</td><td style="padding:12px;border:1px solid #e2e8f0;">${name}</td></tr>
              <tr><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Correo:</td><td style="padding:12px;border:1px solid #e2e8f0;"><a href="mailto:${email}" style="color:#0f766e;">${email}</a></td></tr>
              <tr style="background:#f1f5f9;"><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Teléfono:</td><td style="padding:12px;border:1px solid #e2e8f0;">${phone || 'No indicado'}</td></tr>
              <tr><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Proyecto:</td><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;color:#0f766e;">${project}</td></tr>
              <tr style="background:#f1f5f9;"><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Canal:</td><td style="padding:12px;border:1px solid #e2e8f0;">${channel || 'Web Form'}</td></tr>
              <tr><td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;">Mensaje:</td><td style="padding:12px;border:1px solid #e2e8f0;font-style:italic;">${message || 'Solicitud de información general.'}</td></tr>
            </table>
            <div style="background:#fef9c3;padding:14px;border-left:4px solid #eab308;border-radius:4px;font-size:13px;color:#713f12;">
              💡 <strong>Acción Automatizada:</strong> SARA envió el correo de bienvenida a <strong>${firstName}</strong>. Revisa el borrador de respuesta en el panel de <strong>Agentes IA</strong>.
            </div>
          </div>`
        });
        emailAdminSent = true;
      } catch (err) {
        smtpError = err.message;
        console.error('❌ Error SMTP:', err.message);
      }
    }

    // Analizar conversación con IA para extraer proyecto e intereses
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    let detectedProject = project;
    let enrichedNotes = message || '';
    let analysis = null;
    let draftSubject = `Información - ${project} | GLP`;
    let draftBody = `Estimado/a ${firstName},\n\nGracias por contactarnos sobre ${project}.\n\nQuedo a tu disposición.\n\nSara Valenzuela\n${tenant.name}`;

    if (apiKey && conversationHistory) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });

        // Extraer proyecto, temas e intereses de la conversación
        const analysisResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Analiza esta conversación de un chatbot inmobiliario y extrae la información clave del cliente. Responde SOLO con JSON válido, sin markdown.

CONVERSACIÓN:
${conversationHistory}

JSON esperado:
{
  "proyecto_principal": "nombre exacto del proyecto más mencionado, o 'Portafolio GLP' si no se especificó uno",
  "proyectos_mencionados": ["lista de proyectos mencionados"],
  "temas_interes": ["precio", "zona", "entrega", "financiamiento", "rentabilidad", "habitaciones", "uso propio", "inversión — solo los que apliquen"],
  "resumen_consulta": "resumen en 2-3 oraciones de qué busca el cliente y cuáles son sus inquietudes principales",
  "perfil_inversor": "renta|patrimonial|disfrute|mixto|desconocido",
  "presupuesto_usd": 0,
  "señales_calificacion": {
    "menciona_inversion": false,
    "menciona_panama": false,
    "menciona_presupuesto": false,
    "menciona_entrega_o_disponibilidad": false,
    "menciona_financiamiento": false,
    "menciona_fecha_decision": false,
    "menciona_habitaciones": false,
    "menciona_rentabilidad": false,
    "menciona_uso_propio": false,
    "tono_general": "curioso|interesado|listo_para_decidir|solo_cotizando|desconocido"
  },
  "score_calificacion": 0
}

Para calcular score_calificacion suma: menciona_inversion(+20) + menciona_presupuesto(+20) + menciona_panama(+10) + menciona_entrega_o_disponibilidad(+15) + menciona_fecha_decision(+20) + menciona_financiamiento(+10) + menciona_habitaciones(+10) + menciona_rentabilidad(+10) + menciona_uso_propio(+5). Ajusta según tono: listo_para_decidir(+10), solo_cotizando(-10). Máximo 100.`
          }],
          temperature: 0.2, max_tokens: 400
        });

        analysis = JSON.parse(analysisResponse.choices[0].message.content.trim());
        if (analysis.proyecto_principal) detectedProject = analysis.proyecto_principal;
        const formattedConversation = conversationHistory.split('\n').map(line => {
          if (line.startsWith('Cliente:')) return `**${line}**`;
          return line;
        }).join('\n');

        const señales = analysis.señales_calificacion || {};
        const señalesActivas = Object.entries(señales)
          .filter(([k, v]) => v === true)
          .map(([k]) => k.replace('menciona_', '').replace(/_/g, ' '));

        enrichedNotes = [
          `📋 Resumen: ${analysis.resumen_consulta || '—'}`,
          `🏠 Proyecto: ${analysis.proyecto_principal || '—'}`,
          `🔍 Temas de interés: ${(analysis.temas_interes || []).join(', ')}`,
          `👤 Perfil inversor: ${analysis.perfil_inversor || '—'}`,
          `🎯 Score de calificación: ${analysis.score_calificacion || 0}/100`,
          señalesActivas.length ? `✅ Señales detectadas: ${señalesActivas.join(', ')}` : '',
          señales.tono_general ? `💬 Tono: ${señales.tono_general.replace(/_/g, ' ')}` : '',
          analysis.presupuesto_usd > 0 ? `💰 Presupuesto mencionado: $${analysis.presupuesto_usd.toLocaleString()} USD` : '',
          '',
          '--- Conversación ---',
          formattedConversation
        ].filter(Boolean).join('\n');

        // Generar borrador personalizado con contexto real
        const draftResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `Eres Sara Valenzuela, Directora de Customer Success & Back-Office Comercial de ${tenant.name}. Redacta un correo de seguimiento cálido y profesional para ${firstName}, quien se comunicó con nosotros y mostró interés en: ${analysis.resumen_consulta || project}. Sus temas de interés son: ${(analysis.temas_interes || []).join(', ')}. Proyecto de interés: ${detectedProject}. IMPORTANTE: nunca menciones "chatbot", "asistente virtual" ni "IA" — di simplemente que "nos contactó" o "tuvo la oportunidad de conversar con nuestro equipo". Firma siempre como Sara Valenzuela, Directora de Customer Success & Back-Office Comercial. JSON: {"subject":"...","body":"..."}` }],
          temperature: 0.7, max_tokens: 500
        });
        const parsed = JSON.parse(draftResponse.choices[0].message.content.replace(/```json|```/g, '').trim());
        if (parsed.subject) draftSubject = parsed.subject;
        if (parsed.body) draftBody = parsed.body;
      } catch (aiErr) {
        console.warn('⚠️ Análisis IA falló, usando datos básicos:', aiErr.message);
        enrichedNotes = conversationHistory ? `${message || ''}\n\n--- Conversación ---\n${conversationHistory}` : (message || '');
      }
    } else if (apiKey) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `Eres Sara Valenzuela de ${tenant.name}. Redacta un correo comercial sofisticado para ${firstName} que preguntó por ${project}. Mensaje: "${message || 'información general'}". JSON: {"subject":"...","body":"..."}` }],
          temperature: 0.7, max_tokens: 500
        });
        const parsed = JSON.parse(response.choices[0].message.content.replace(/```json|```/g, '').trim());
        if (parsed.subject) draftSubject = parsed.subject;
        if (parsed.body) draftBody = parsed.body;
      } catch (aiErr) {
        console.warn('⚠️ OpenAI falló, usando plantilla:', aiErr.message);
      }
    }

    // Guardar prospecto en la base de datos (upsert por correo)
    const budgetUSD = (typeof analysis?.presupuesto_usd === 'number' && analysis.presupuesto_usd > 0)
      ? analysis.presupuesto_usd : null;
    const score = analysis?.score_calificacion || 0;
    const estadoLead = score >= 60 ? 'Calificado' : score >= 30 ? 'Contacto Inicial' : 'Lead Frío';
    const { rows: existing } = await pool.query(
      'SELECT id FROM prospectos WHERE correo = $1 AND tenant_id = $2',
      [email, tenant.id]
    );
    if (existing.length > 0) {
      await pool.query(
        `UPDATE prospectos SET
           proyectos_interes = (
             SELECT jsonb_agg(DISTINCT e) FROM jsonb_array_elements_text(
               COALESCE(proyectos_interes::jsonb,'[]'::jsonb) || $1::jsonb
             ) e
           ),
           notas = COALESCE(notas,'') || $2,
           fecha_ultima_actividad = NOW()
         WHERE id = $3`,
        [JSON.stringify([detectedProject]), `\n[Web ${new Date().toLocaleDateString('es-CO')}] ${message || ''}`, existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO prospectos (tenant_id, nombre, apellido, correo, telefono, proyectos_interes, forma_contacto, estado, canal, notas, presupuesto_usd, fecha_registro, fecha_ultima_actividad)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
        [tenant.id, firstName, '', email, phone || '',
         JSON.stringify([detectedProject]), channel || 'Web', estadoLead, channel || 'Web',
         enrichedNotes, budgetUSD]
      );
    }

    const draftId = `draft-${Date.now()}`;
    await pool.query(
      'INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())',
      [draftId, tenant.id, `${name} (${email})`, project, draftSubject, draftBody, 'pending']
    );

    const logId = `log-${Date.now()}`;
    await pool.query(
      `INSERT INTO bitacora (id, tenant_id, timestamp, cliente, correo, whatsapp, proyecto, canal, correo_cliente, correo_admin, borrador_creado, mensaje)
       VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [logId, tenant.id, name, email, phone || 'N/A', project, channel || 'Web',
       emailClientSent ? 'Enviado' : `Falló (${smtpError})`,
       emailAdminSent ? 'Enviado' : `Falló (${smtpError})`,
       draftId, message || 'Sin comentarios']
    );

    res.json({ success: true, logId, draftId, smtpError });
  } catch (error) {
    console.error('❌ Error en /api/contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ENVIAR BORRADOR APROBADO
// ==========================================
app.post('/api/send-draft', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { id, attachments = [] } = req.body;
    if (!id) return res.status(400).json({ error: 'ID del borrador requerido.' });

    const { rows } = await pool.query('SELECT * FROM drafts WHERE id = $1 AND tenant_id = $2', [id, tenant.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Borrador no encontrado.' });

    const draft = rows[0];
    const transporter = getTransporter(tenant);
    if (!transporter) return res.status(500).json({ error: 'SMTP no configurado.' });

    const toEmailMatch = draft.destinatario?.match(/\(([^)]+)\)/);
    const toEmail = toEmailMatch ? toEmailMatch[1] : draft.destinatario;

    const mailAttachments = attachments.map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType
    }));

    await transporter.sendMail({
      from: `"Sara Valenzuela · ${tenant.name}" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: draft.subject,
      html: draft.body.replace(/\n/g, '<br>'),
      attachments: mailAttachments
    });

    await pool.query('UPDATE drafts SET status = $1 WHERE id = $2', ['sent', id]);

    // Registrar en historial del prospecto si existe
    const { rows: prospectoRows } = await pool.query(
      `SELECT id, historial FROM prospectos WHERE tenant_id = $1 AND correo = $2`,
      [tenant.id, toEmail]
    );
    if (prospectoRows.length > 0) {
      const prospecto = prospectoRows[0];
      let historial = [];
      try { historial = JSON.parse(prospecto.historial || '[]'); } catch (_) {}
      historial.push({
        id: `resp-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: 'respuesta_enviada',
        asunto: draft.subject,
        resumen: draft.body.slice(0, 200),
        cuerpo: draft.body,
        aprobado_por: 'Admin',
        editable: true
      });
      await pool.query(
        `UPDATE prospectos SET historial = $1, fecha_ultima_actividad = NOW() WHERE id = $2`,
        [JSON.stringify(historial), prospecto.id]
      );
    }

    await pool.query(
      `INSERT INTO bitacora (id, tenant_id, timestamp, cliente, correo, proyecto, canal, correo_cliente, borrador_creado, mensaje)
       VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7,$8,$9)`,
      [`log-approval-${Date.now()}`, tenant.id, draft.destinatario, toEmail,
       draft.project, 'CRM Admin', 'Enviado (Aprobado por Admin)', id,
       `Borrador aprobado: ${draft.subject}`]
    );

    res.json({ success: true, draftId: id });
  } catch (error) {
    console.error('❌ Error en /api/send-draft:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CATÁLOGO GLP — fallback para SARA
// ==========================================
const GLP_CATALOG = [
  { name: 'Armonía', zone: 'Bella Vista — Ciudad de Panamá', tipo: 'Residencia', entrega: 'F1 Inmediata · F2 Q2 2026 · F3 Q2 2028', minPrice: 181000, maxPrice: 235000, areaMin: 45, areaMax: 71, bedrooms: '1, 2 y 3 rec.', capRateMin: 6.0, capRateMax: 7.5, amenities: ['Piscina', 'Gimnasio', 'Lobby diseño', 'Seguridad 24/7', 'Parqueo'] },
  { name: 'Ventu', zone: 'Bella Vista — Ciudad de Panamá', tipo: 'Hotelero (Airbnb)', entrega: 'Q2 2028', minPrice: 136000, maxPrice: 259000, areaMin: 40, areaMax: 63, bedrooms: '1 y 2 rec.', capRateMin: 8.0, capRateMax: 12.0, amenities: ['Administración hotelera', 'Pool deck', 'Coworking', 'Check-in automático'] },
  { name: 'Ocena', zone: 'Santa María — Ciudad de Panamá', tipo: 'Residencia', entrega: 'Q4 2027', minPrice: 446000, maxPrice: 1200000, areaMin: 100, areaMax: 270, bedrooms: '2 y 3 rec.', capRateMin: 4.7, capRateMax: 6.0, amenities: ['Golf 18 hoyos Jack Nicklaus', 'Club House', 'Piscinas resort', 'Wellness center'] },
  { name: 'Ipanema', zone: 'Costa Sur — Ciudad de Panamá', tipo: 'Residencia', entrega: 'F1 Q1 2028 · F2 Q4 2028', minPrice: 283000, maxPrice: 519000, areaMin: 72, areaMax: 163, bedrooms: '1, 2 y 3 rec.', capRateMin: 6.0, capRateMax: 7.5, amenities: ['Piscina vista al mar', 'Gimnasio', 'Co-working', 'BBQ'] },
  { name: 'Bosco', zone: 'Santa María — Ciudad de Panamá', tipo: 'Residencia', entrega: '2030', minPrice: 474000, maxPrice: 1100000, areaMin: 100, areaMax: 296, bedrooms: '2, 3 y 4 rec.', capRateMin: 5.5, capRateMax: 7.2, amenities: ['Jardines botánicos', 'Piscina natural', 'Senderos de meditación'] },
  { name: 'Panama Viejo Residence', zone: 'Panamá Viejo — Ciudad de Panamá', tipo: 'Residencia', entrega: 'ENTREGA INMEDIATA', minPrice: 160000, maxPrice: 182000, areaMin: 58, areaMax: 58, bedrooms: '2 rec.', capRateMin: 6.5, capRateMax: 8.0, amenities: ['Piscina', 'Gimnasio', 'Coworking', 'Seguridad 24/7'] },
  { name: 'The Palms', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia premium', entrega: 'ENTREGA INMEDIATA', minPrice: 1200000, maxPrice: 1400000, areaMin: 169, areaMax: 239, bedrooms: '2 rec.', capRateMin: 5.5, capRateMax: 7.0, amenities: ['Marina privada 180+ muelles', 'Yacht club', 'Piscinas infinity', 'Spa'] },
  { name: 'Ocean Reef Park', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia ultra-premium', entrega: 'Q2 2028', minPrice: 1700000, maxPrice: 2100000, areaMin: 491, areaMax: 569, bedrooms: '3 y 4 rec.', capRateMin: 5.0, capRateMax: 6.5, amenities: ['Marina privada', 'Helipuerto', 'Yacht club', 'Club privado'] },
  { name: 'O Club Residences', zone: 'Punta Pacífica — Isla privada', tipo: 'Residencia premium', entrega: 'Q4 2027', minPrice: 1000000, maxPrice: 1400000, areaMin: 183, areaMax: 236, bedrooms: '2 rec.', capRateMin: 5.0, capRateMax: 6.5, amenities: ['Club privado O Club', 'Marina', 'Spa', 'Restaurantes'] },
  { name: 'Aires del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'INMEDIATA · Q4 2026', minPrice: 143000, maxPrice: 207000, areaMin: 42, areaMax: 71, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 8.0, amenities: ['Vista al océano Pacífico', 'Piscinas', 'Jardines', 'Seguridad 24/7'] },
  { name: 'The Tides', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 278000, maxPrice: 308000, areaMin: 99, areaMax: 99, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['1.2 km playa privada', 'Surf club', '3 piscinas', 'Restaurante y beach bar'] },
  { name: 'Brisas del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 276000, maxPrice: 332000, areaMin: 93, areaMax: 108, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Frente al mar', 'Piscina', 'BBQ', 'Seguridad 24/7'] },
  { name: 'Olas del Mar', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'ENTREGA INMEDIATA', minPrice: 267000, maxPrice: 398000, areaMin: 69, areaMax: 97, bedrooms: '2 y 3 rec.', capRateMin: 6.0, capRateMax: 8.0, amenities: ['Piscina con vista al mar', 'BBQ', 'Seguridad 24/7'] },
  { name: 'Surfside', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa / aparthotel', entrega: 'ENTREGA INMEDIATA', minPrice: 314000, maxPrice: 413000, areaMin: 81, areaMax: 107, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Playa privada', 'Piscinas y jacuzzi', 'Restaurante y bar', 'Surf lounge'] },
  { name: 'Beachwalk', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa wellness', entrega: 'Q1 2027', minPrice: 297000, maxPrice: 386000, areaMin: 85, areaMax: 97, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['Frente al océano', 'Wellness spa', 'Yoga deck', 'Gimnasio exterior'] },
  { name: 'Seashore', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'Q4 2027', minPrice: 290000, maxPrice: 490000, areaMin: 84, areaMax: 150, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, amenities: ['Vista al Pacífico', 'Piscina', 'Área social y BBQ', 'Gimnasio'] },
  { name: 'Seashore Reserve', zone: 'Playa Caracol, Chame — Pacífico', tipo: 'Residencia playa', entrega: 'Q4 2028', minPrice: 290000, maxPrice: 490000, areaMin: 84, areaMax: 150, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, amenities: ['Vista al Pacífico', 'Piscina', 'Área social y BBQ', 'Gimnasio'] },
];

// ==========================================
// CHATBOT SARA
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Mensajes requeridos.' });

    const tenant = await resolveTenant(req);
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado.' });

    // Cargar proyectos desde la BD; si está vacía usar catálogo hardcodeado
    const { rows: projectRows } = await pool.query('SELECT data FROM projects WHERE tenant_id = $1', [tenant.id]);
    const projects = projectRows.length > 0 ? projectRows.map(r => r.data) : GLP_CATALOG;
    const catalogSummary = projects.map(p =>
      `- ${p.name} | ${p.zone} | ${p.tipo || p.type || 'Residencia'} | Precio: $${(p.minPrice || 0).toLocaleString()}–$${(p.maxPrice || 0).toLocaleString()} USD | Áreas: ${p.areaMin || '?'}–${p.areaMax || '?'} m² | ${p.bedrooms || ''} | Entrega: ${p.entrega || 'consultar'} | Amenidades: ${(p.amenities || []).join(', ')}`
    ).join('\n');

    const systemPrompt = `Eres Sara, asesora de inversiones inmobiliarias de ${tenant.name}. Llevas años en este mundo y te apasiona conectar a las personas con la inversión correcta para su momento de vida.

Tu estilo: conversacional, cálido, directo. Usas frases cortas. A veces compartes una opinión personal o haces una observación sobre lo que el cliente menciona. No suenas a call center ni a guión.

A lo largo de la conversación, de forma natural (nunca en forma de cuestionario), trata de entender:
- Qué lo motiva: ¿es para vivir, para rentar, para tener algo a largo plazo?
- En qué rango de tiempo piensa tomar la decisión
- Si ya tiene un presupuesto claro en mente o está explorando
- Cuántas habitaciones necesita o prefiere
- Si va a financiar o tiene capital disponible
- Si ya conoce Panamá o es su primera vez mirando este mercado

No preguntes todo junto. Ve hilando la conversación. Si te cuenta algo, reacciona a eso antes de preguntar lo siguiente.

FORMATO DE RESPUESTA — siempre:
- Separa por bloques temáticos con línea en blanco entre cada uno
- Usa emojis como ancla visual: 🏠 📍 💰 🗓️ ✨ — pero sin abusar
- Máximo 2–3 líneas por bloque
- Nunca uses "Cap Rate", "tasa de capitalización" ni jerga técnica — di "retorno estimado" o "lo que puedes esperar recibir mensualmente"
- Termina con una pregunta o comentario que invite a seguir

CATÁLOGO GLP:
${catalogSummary}`;

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
      ],
      temperature: 0.7, max_tokens: 350
    });

    res.json({ reply: response.choices[0].message.content.trim() });
  } catch (error) {
    console.error('❌ Error en /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AI PROXY – AGENTES CRM (Camilo, Valeria, Isabella)
// ==========================================
app.post('/api/ai', async (req, res) => {
  try {
    const { messages, max_tokens } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages requeridos.' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado en el servidor.' });
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: max_tokens || 3000
    });
    res.json({ choices: [{ message: { content: response.choices[0].message.content } }] });
  } catch (err) {
    console.error('❌ Error en /api/ai:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CAMILO — DEEP RESEARCH (web search + síntesis)
// ==========================================
app.post('/api/camilo/research', async (req, res) => {
  try {
    const { kpiCtx, brandCtx, projectsList } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado.' });

    // ── Paso 1: búsquedas web en paralelo ──
    const searches = [
      'Panama luxury real estate market prices trends sales volume 2025',
      'Colombian investors Panama real estate 2025 investment dollar exchange rate',
      'Panama City Bella Vista Santa Maria Ocean Reef luxury apartments new projects 2025'
    ];

    let webContext = '';
    try {
      const results = await Promise.all(searches.map(async (query) => {
        const r = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-search-preview',
            tools: [{ type: 'web_search_preview' }],
            input: query
          })
        });
        if (!r.ok) throw new Error(`search_error_${r.status}`);
        const data = await r.json();
        const text = data.output
          ?.find(o => o.type === 'message')
          ?.content?.find(c => c.type === 'output_text')
          ?.text || '';
        // Extraer fuentes de las anotaciones si existen
        const annotations = data.output
          ?.find(o => o.type === 'message')
          ?.content?.find(c => c.type === 'output_text')
          ?.annotations || [];
        const sources = [...new Set(annotations.filter(a => a.url).map(a => a.url))].slice(0, 3);
        return { query, text, sources };
      }));
      webContext = results.map(r =>
        `### Búsqueda: "${r.query}"\n${r.text}${r.sources.length ? '\nFuentes: ' + r.sources.join(' · ') : ''}`
      ).join('\n\n---\n\n');
    } catch (searchErr) {
      console.warn('⚠️ Web search no disponible, usando base de conocimiento:', searchErr.message);
      webContext = '(Búsqueda web no disponible en este momento — usando datos de entrenamiento 2025)';
    }

    // ── Paso 2: síntesis → documento de inteligencia estructurado ──
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const synthesisPrompt = `${kpiCtx ? `CONTEXTO OPERATIVO GLP:\n${kpiCtx}\n\n` : ''}${brandCtx ? `PERFIL DE MARCA Y AUDIENCIA:\n${brandCtx}\n\n` : ''}${projectsList ? `PORTAFOLIO ACTUAL GLP:\n${projectsList}\n\n` : ''}
INVESTIGACIÓN WEB EN TIEMPO REAL (deep search):
${webContext}

Con base en los datos reales de búsqueda anteriores, genera un reporte de inteligencia con EXACTAMENTE esta estructura JSON (sin markdown, sin bloques de código):
{
  "resumen_ejecutivo": "párrafo de 3-4 líneas con el estado actual del mercado basado en los datos encontrados — cita cifras concretas",
  "insights": [
    {
      "tipo": "mercado|crisis|oportunidad|audiencia",
      "titulo": "título del insight (máx 10 palabras)",
      "datos": "análisis con cifras y tendencias reales encontradas en la búsqueda — mínimo 150 palabras con datos concretos de Panamá y Colombia 2025",
      "impacto": "alto|medio|bajo",
      "acciones_sara": "qué debe hacer SARA con este insight (respuestas, FAQs a actualizar)",
      "acciones_valeria": "qué contenido debe crear Valeria con este insight",
      "acciones_isabella": "qué video debe crear Isabella con este insight",
      "fuentes": ["fuente concreta 1", "fuente concreta 2"]
    }
  ],
  "señales_crisis": "descripción de riesgos actuales para ventas GLP basados en los datos reales (tasa de cambio, competencia, mercado)",
  "oportunidades_inmediatas": "top 3 oportunidades concretas para cerrar más negocios esta semana basadas en los datos reales encontrados"
}

Genera 4-5 insights variados y accionables (mercado macro, oportunidad de proyecto específico, audiencia colombiana, señal de crisis o riesgo). TODOS los datos deben estar respaldados en la investigación web de arriba.`;

    const synthesis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres Camilo, Científico de Datos y Estratega de Inteligencia de Mercado de GLP Wealth Management. Recibes datos reales de búsqueda web y los transformas en inteligencia accionable para el equipo comercial.' },
        { role: 'user', content: synthesisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    res.json({ choices: [{ message: { content: synthesis.choices[0].message.content } }] });
  } catch (err) {
    console.error('❌ Error en /api/camilo/research:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SUPER ADMIN – GESTIÓN DE TENANTS
// ==========================================
app.get('/api/admin/tenants', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/tenants', async (req, res) => {
  try {
    const { id, name, domain, contact, smtp, openai, apollo, status } = req.body;
    if (!name || !domain) return res.status(400).json({ error: 'Nombre y dominio son obligatorios.' });
    const tenantId = id || `tenant-${Date.now()}`;
    const { rows } = await pool.query(
      `INSERT INTO tenants (id, name, domain, status, contact, smtp, openai, apollo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantId, name, domain, status || 'active',
       JSON.stringify(contact || {}), JSON.stringify(smtp || {}),
       JSON.stringify(openai || {}), JSON.stringify(apollo || {})]
    );
    res.json({ success: true, tenant: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates);
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = [...fields.map(f => typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]), id];
    const { rows } = await pool.query(`UPDATE tenants SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`, values);
    res.json({ success: true, tenant: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// APOLLO.IO – DATA MINING
// ==========================================
app.post('/api/apollo/mine', async (req, res) => {
  const tenant = await resolveTenant(req);
  const apolloKey = tenant?.apollo?.apiKey;
  if (!apolloKey) return res.status(400).json({ error: 'API Key de Apollo no configurada.' });

  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apolloKey },
      body: JSON.stringify({
        page: 1, per_page: 10,
        person_locations: ['Colombia'],
        person_titles: ['CEO', 'Founder', 'Gerente General', 'Director', 'CFO']
      })
    });
    const data = await response.json();
    const prospects = (data.people || []).map(p => ({
      nombre: p.first_name || 'Desconocido', apellido: p.last_name || '',
      correo: p.email || 'No disponible',
      telefono: p.phone_numbers?.[0]?.sanitized_number || 'No disponible',
      ocupacion: p.title || 'Ejecutivo', empresa: p.organization?.name || '',
      linkedin: p.linkedin_url || '', direccion: `${p.city || ''}, Colombia`,
      proyectos_interes: ['Nuevos Desarrollos Panamá'],
      forma_contacto: 'Apollo API', presupuesto_usd: 350000
    }));
    res.json({ success: true, prospects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SARA – ANÁLISIS DE PROSPECTOS (GPT-4)
// ==========================================
app.post('/api/sara/process-prospects', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API Key requerida.' });

    const { rows: dbProspects } = await pool.query(
      'SELECT * FROM prospectos WHERE tenant_id = $1 ORDER BY fecha_registro DESC LIMIT 50',
      [tenant.id]
    );
    const frontendProspects = req.body.prospects || [];
    const allProspects = frontendProspects.length > 0 ? frontendProspects : dbProspects;

    const { rows: projectRows } = await pool.query('SELECT data FROM projects WHERE tenant_id = $1', [tenant.id]);
    const catalogSummary = projectRows.map(r =>
      `- ${r.data.name}: ${r.data.zone}. Desde $${r.data.price} USD.`
    ).join('\n');

    const { rows: pendingDrafts } = await pool.query(
      "SELECT destinatario FROM drafts WHERE tenant_id = $1 AND status = 'pending'",
      [tenant.id]
    );
    const existingEmails = new Set(pendingDrafts.map(d => {
      const m = d.destinatario?.match(/\(([^)]+)\)/);
      return m ? m[1] : '';
    }));

    const needsAttention = allProspects
      .filter(p => (p.correo || p.email) && !existingEmails.has(p.correo || p.email))
      .slice(0, 5);

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const results = [];

    for (const prospect of needsAttention) {
      try {
        const nombre = prospect.nombre || 'Cliente';
        const email = prospect.correo || prospect.email || '';
        const gptResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `Eres Sara Valenzuela de ${tenant.name}. Genera un correo comercial para ${nombre} (${prospect.estado || 'Lead'}), interesado en ${JSON.stringify(prospect.proyectos_interes || [])}. Presupuesto: $${prospect.presupuesto_usd || 'N/A'}. Catálogo:\n${catalogSummary}\nJSON: {"draftSubject":"...","draftBody":"...","prioridad":"alta|media|baja"}` }],
          temperature: 0.7, max_tokens: 600
        });
        const parsed = JSON.parse(gptResponse.choices[0].message.content.replace(/```json|```/g, '').trim());
        const draftId = `draft-${Date.now()}-${Math.floor(Math.random() * 9000)}`;
        await pool.query(
          'INSERT INTO drafts (id, tenant_id, destinatario, project, subject, body, status, prioridad, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())',
          [draftId, tenant.id, `${nombre} (${email})`,
           JSON.stringify(prospect.proyectos_interes || []),
           parsed.draftSubject, parsed.draftBody, 'pending', parsed.prioridad || 'media']
        );
        results.push({ nombre, email, draftId, prioridad: parsed.prioridad });
      } catch (e) {
        console.error(`Error procesando ${prospect.nombre}:`, e.message);
      }
    }

    res.json({ success: true, processedCount: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ==========================================
// ALERTAS DE PROSPECTOS
// ==========================================
app.get('/api/alerts', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT a.*, p.nombre, p.apellido, p.correo, p.estado as etapa, p.proyectos_interes, p.presupuesto_usd
       FROM prospect_alerts a
       JOIN prospectos p ON a.prospecto_id = p.id
       WHERE a.tenant_id = $1 AND a.status = 'activa'
       ORDER BY CASE a.nivel WHEN 'critico' THEN 1 WHEN 'frio' THEN 2 WHEN 'tibio' THEN 3 WHEN 'oportunidad' THEN 4 END, a.created_at DESC`,
      [tenant.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/alerts/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { status } = req.body;
    await pool.query(
      `UPDATE prospect_alerts SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [status, req.params.id, tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sara/monitor', async (req, res) => {
  try {
    const count = await monitorProspects();
    res.json({ success: true, alertasCreadas: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Envío directo de correo desde borradores locales del historial de prospectos
app.post('/api/sara/send-email', async (req, res) => {
  try {
    const { to, subject, body, prospectId, attachments = [] } = req.body;
    if (!to || !subject || !body) return res.status(400).json({ error: 'Faltan campos: to, subject, body.' });

    const tenant = await resolveTenant(req);
    const transporter = getTransporter(tenant);
    if (!transporter) return res.status(500).json({ error: 'SMTP no configurado. Verifica SMTP_USER y SMTP_PASS en .env' });

    const mailAttachments = attachments.map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType
    }));

    await transporter.sendMail({
      from: `"Sara Valenzuela · GLP Wealth Management" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: body.replace(/\n/g, '<br>'),
      attachments: mailAttachments
    });

    // Registrar actividad en el prospecto si se proporcionó ID
    if (prospectId) {
      await pool.query(
        `UPDATE prospectos SET fecha_ultima_actividad = NOW() WHERE id = $1 AND tenant_id = $2`,
        [prospectId, TENANT]
      );
    }

    console.log(`[Sara·Email] ✅ Correo enviado a ${to} — "${subject}"`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Sara·Email] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// B.1: Trigger manual Sara·72h (también corre automático cada hora)
app.post('/api/sara/trigger-72h', async (req, res) => {
  try {
    const count = await saraAutoTrigger72h();
    res.json({ success: true, borradoresGenerados: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// B.3: Trigger manual detección fríos por score (también corre automático cada hora)
app.post('/api/sara/detect-cold', async (req, res) => {
  try {
    const count = await detectColdProspects();
    res.json({ success: true, friosDetectados: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// IMAP – REVISIÓN MANUAL DE BANDEJA
// ==========================================
app.post('/api/sara/check-inbox', async (req, res) => {
  try {
    await pollInbox();
    res.json({ success: true, message: 'Bandeja revisada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BRAND PROFILE — Perfil de Marca GLP
// ==========================================
app.get('/api/brand-profile', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT data FROM settings WHERE tenant_id = $1 AND key = 'brand_profile' LIMIT 1`,
      [tenant.id]
    );
    if (rows.length === 0) return res.json(null);
    res.json(rows[0].data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/brand-profile', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const profile = req.body;
    await pool.query(
      `INSERT INTO settings (tenant_id, key, data, updated_at)
       VALUES ($1, 'brand_profile', $2, NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET data = $2, updated_at = NOW()`,
      [tenant.id, JSON.stringify(profile)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SETTINGS GENÉRICO (market-report, etc.)
// ==========================================
app.put('/api/settings/:key', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    await pool.query(
      `INSERT INTO settings (tenant_id, key, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET data = $3, updated_at = NOW()`,
      [tenant.id, req.params.key, JSON.stringify(req.body)]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/settings/:key', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT data FROM settings WHERE tenant_id = $1 AND key = $2 LIMIT 1`,
      [tenant.id, req.params.key]
    );
    res.json(rows.length > 0 ? rows[0].data : null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BROKER OBJECTIONS — Reporte de objeciones
// ==========================================
app.get('/api/broker-objections', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const tipo = req.query.tipo || null;
    const query = tipo
      ? `SELECT * FROM broker_objections WHERE tenant_id = $1 AND tipo = $2 ORDER BY created_at DESC LIMIT 100`
      : `SELECT * FROM broker_objections WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`;
    const { rows } = await pool.query(query, tipo ? [tenant.id, tipo] : [tenant.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/broker-objections', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { broker, prospecto, tipo, descripcion, canal, proyecto } = req.body;
    if (!broker || !tipo || !descripcion) return res.status(400).json({ error: 'broker, tipo y descripcion son requeridos' });
    const id = `obj-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    await pool.query(
      `INSERT INTO broker_objections (id, tenant_id, broker, prospecto, tipo, descripcion, canal, proyecto, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [id, tenant.id, broker, prospecto||null, tipo, descripcion, canal||'formulario', proyecto||null]
    );
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Agregado de conteo por tipo (para el detector de patrones en Paso 3)
app.get('/api/broker-objections/stats', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(
      `SELECT tipo, COUNT(*) as total,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as ultimos_7d
       FROM broker_objections WHERE tenant_id = $1
       GROUP BY tipo ORDER BY total DESC`,
      [tenant.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// CRISIS ALERTS — Motor de detección de crisis
// ==========================================
app.get('/api/crisis-alerts', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const status = req.query.status || null;
    const query = status
      ? `SELECT * FROM crisis_alerts WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 50`
      : `SELECT * FROM crisis_alerts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`;
    const params = status ? [tenant.id, status] : [tenant.id];
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/crisis-alerts/:id', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status requerido' });
    await pool.query(
      `UPDATE crisis_alerts SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [status, req.params.id, tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ejecutar detección manual desde frontend (para testing y admin)
app.post('/api/crisis/detect', async (req, res) => {
  try {
    const count = await detectCrisis();
    res.json({ success: true, alertas_creadas: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// BACKUP — EXPORT BASE DE DATOS
// ══════════════════════════════════════════════════════════════
app.get('/api/backup/export-db', async (req, res) => {
  const TENANT = 'tenant-glp-001';
  try {
    const tablas = ['prospectos', 'drafts', 'prospect_alerts', 'crisis_alerts', 'projects', 'brokers', 'tenants', 'eventos', 'faq_clicks'];
    const snapshot = { exportado_en: new Date().toISOString(), tenant_id: TENANT, tablas: {} };

    for (const tabla of tablas) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${tabla} WHERE tenant_id = $1`, [TENANT]);
        snapshot.tablas[tabla] = rows;
      } catch {
        // tabla sin columna tenant_id (ej: tenants)
        try {
          const { rows } = await pool.query(`SELECT * FROM ${tabla}`);
          snapshot.tablas[tabla] = rows;
        } catch {
          snapshot.tablas[tabla] = [];
        }
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="glp_db_backup_${new Date().toISOString().slice(0,10)}.json"`);
    res.json(snapshot);
  } catch (err) {
    console.error('[Backup DB] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// BACKUP — GITHUB
// ══════════════════════════════════════════════════════════════
const { execSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

app.post('/api/backup/github', (req, res) => {
  const mensaje = (req.body?.mensaje || '').trim();
  const timestamp = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const commitMsg = mensaje
    ? `Backup manual: ${mensaje} (${timestamp})`
    : `Backup automático CRM GLP — ${timestamp}`;

  try {
    execSync('git add glp-app/package.json glp-app/package-lock.json glp-app/server/index.js glp-app/src/crm/CRMDashboard.tsx glp-app/src/main.tsx glp-app/server/crisisDetector.js glp-app/server/emailPoller.js glp-app/server/prospectMonitor.js glp-app/src/lib/supabase.ts glp-app/.gitignore', { cwd: REPO_ROOT });

    // Verificar si hay cambios reales para commitear
    const diff = execSync('git diff --cached --stat', { cwd: REPO_ROOT }).toString().trim();
    if (!diff) {
      // Sin cambios — igual retornamos el último commit como referencia
      const lastCommit = execSync('git log -1 --pretty=format:"%h|%s|%ai"', { cwd: REPO_ROOT }).toString().trim();
      const [hash, subject, date] = lastCommit.split('|');
      return res.json({ success: true, sin_cambios: true, ultimo_commit: { hash, subject, date } });
    }

    execSync(`git commit -m "${commitMsg.replace(/"/g, "'")}"`, { cwd: REPO_ROOT });
    execSync('git push origin main', { cwd: REPO_ROOT });

    const lastCommit = execSync('git log -1 --pretty=format:"%h|%s|%ai"', { cwd: REPO_ROOT }).toString().trim();
    const [hash, subject, date] = lastCommit.split('|');

    res.json({ success: true, sin_cambios: false, commit: { hash, subject, date } });
  } catch (err) {
    console.error('[Backup] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/backup/historial', (req, res) => {
  try {
    const log = execSync('git log --pretty=format:"%h|%s|%ai" -10', { cwd: REPO_ROOT }).toString().trim();
    const commits = log.split('\n').map(line => {
      const [hash, subject, date] = line.split('|');
      return { hash, subject, date };
    });
    res.json({ success: true, commits });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// PROJECTS — endpoints adicionales (GET /:id y PUT /:id)
// El GET /api/projects ya existe arriba (línea ~235)
// ==========================================

// GET /api/projects/:id
app.get('/api/projects/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'tenant-glp-001';
    const { rows } = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'No encontrado' });
    res.json({ success: true, project: mapProjectRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/projects/:id — merge del campo data JSONB con los campos enviados
app.put('/api/projects/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'tenant-glp-001';
    const b = req.body;
    // Construimos el objeto de datos a guardar (solo los campos presentes en el body)
    const { id, tenantId: _tid, createdAt, updatedAt, ...dataFields } = b;
    const { rows } = await pool.query(
      `UPDATE projects
       SET data = data || $3::jsonb,
           imagen_url = COALESCE($4, imagen_url),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [req.params.id, tenantId, JSON.stringify(dataFields), b.imagen || null]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'No encontrado' });
    res.json({ success: true, project: mapProjectRow(rows[0]) });
  } catch (err) {
    console.error('[Projects] Error PUT:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: fila de Supabase → objeto ProjectData para el frontend
function mapProjectRow(r) {
  const d = r.data || {};
  return {
    id: r.id,
    ...d,
    imagen: r.imagen_url || d.imagen,
    updatedAt: r.updated_at,
  };
}

// ==========================================
// AGENTES — RUTAS SEPARADAS POR AGENTE
// ==========================================

const TENANT = 'tenant-glp-001';

// ── CAMILO: insights de inteligencia de mercado ──────────────

app.get('/api/camilo/insights', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM camilo_insights WHERE tenant_id = $1 ORDER BY created_at DESC',
      [TENANT]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/camilo/insights', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `INSERT INTO camilo_insights
        (id, tenant_id, titulo, resumen, datos, tipo, impacto, fuentes, status,
         acciones_sara, acciones_valeria, acciones_isabella, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status, updated_at = NOW()`,
      [d.id, TENANT, d.titulo, d.resumen, d.datos, d.tipo, d.impacto,
       d.fuentes || [], d.status || 'nuevo',
       d.acciones_sara, d.acciones_valeria, d.acciones_isabella, d.fecha]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/camilo/insights/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query(
      'UPDATE camilo_insights SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
      [status, req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/camilo/insights/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM camilo_insights WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── VALERIA: borradores de contenido ─────────────────────────

app.get('/api/valeria/drafts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM valeria_drafts WHERE tenant_id = $1 ORDER BY created_at DESC',
      [TENANT]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/valeria/drafts', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `INSERT INTO valeria_drafts
        (id, tenant_id, content, type, status, canal, asunto, contexto,
         tags, aprobado_por, fecha_aprobacion, notas_admin, origen_agentivo, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content, status = EXCLUDED.status,
         notas_admin = EXCLUDED.notas_admin, aprobado_por = EXCLUDED.aprobado_por,
         fecha_aprobacion = EXCLUDED.fecha_aprobacion, updated_at = NOW()`,
      [d.id, TENANT, d.content, d.type, d.status || 'pending',
       d.canal, d.asunto, d.contexto, d.tags || [],
       d.aprobado_por, d.fecha_aprobacion, d.notas_admin, d.origen_agentivo, d.date]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/valeria/drafts/:id', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `UPDATE valeria_drafts SET
         status = COALESCE($1, status),
         aprobado_por = COALESCE($2, aprobado_por),
         fecha_aprobacion = COALESCE($3, fecha_aprobacion),
         notas_admin = COALESCE($4, notas_admin),
         content = COALESCE($5, content),
         updated_at = NOW()
       WHERE id = $6 AND tenant_id = $7`,
      [d.status, d.aprobado_por, d.fecha_aprobacion, d.notas_admin, d.content,
       req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/valeria/drafts/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM valeria_drafts WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ISABELLA: guiones de video ────────────────────────────────

app.get('/api/isabella/scripts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM isabella_scripts WHERE tenant_id = $1 ORDER BY created_at DESC',
      [TENANT]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/isabella/scripts', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `INSERT INTO isabella_scripts
        (id, tenant_id, content, type, status, canal, asunto, contexto,
         tags, origen_agentivo, notas_admin, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content, status = EXCLUDED.status,
         notas_admin = EXCLUDED.notas_admin, updated_at = NOW()`,
      [d.id, TENANT, d.content, d.type, d.status || 'pending',
       d.canal, d.asunto, d.contexto, d.tags || [],
       d.origen_agentivo, d.notas_admin, d.date]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/isabella/scripts/:id', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(
      `UPDATE isabella_scripts SET
         status = COALESCE($1, status),
         notas_admin = COALESCE($2, notas_admin),
         content = COALESCE($3, content),
         updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [d.status, d.notas_admin, d.content, req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/isabella/scripts/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM isabella_scripts WHERE id = $1 AND tenant_id = $2',
      [req.params.id, TENANT]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ANALYTICS — Fase D: Reportería
// ==========================================
app.get('/api/analytics/resumen', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total_prospectos,
        COUNT(*) FILTER (WHERE fecha_registro >= NOW() - INTERVAL '30 days') AS nuevos_mes,
        COALESCE(SUM(presupuesto_usd::numeric), 0)                        AS pipeline_total,
        COALESCE(AVG(presupuesto_usd::numeric) FILTER (WHERE presupuesto_usd IS NOT NULL), 0) AS ticket_promedio,
        COUNT(*) FILTER (WHERE estado IN ('Calificado','Negociación','Cierre','Post-venta')) AS calificados,
        COUNT(*) FILTER (WHERE estado = 'Post-venta')                     AS cerrados
      FROM prospectos WHERE tenant_id = $1
    `, [tenant.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/por-tiempo', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(fecha_registro, 'YYYY-MM') AS mes,
        TO_CHAR(fecha_registro, 'Mon YY')  AS label,
        COUNT(*)                            AS total,
        COALESCE(SUM(presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos
      WHERE tenant_id = $1 AND fecha_registro >= NOW() - INTERVAL '6 months'
      GROUP BY 1, 2 ORDER BY 1
    `, [tenant.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/por-proyecto', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(`
      SELECT p_elem AS proyecto, COUNT(*) AS total,
             COALESCE(SUM(pr.presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos pr,
           jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(proyectos_interes::jsonb) = 'array'
                  THEN proyectos_interes::jsonb ELSE '[]'::jsonb END
           ) AS p_elem
      WHERE pr.tenant_id = $1
      GROUP BY 1 ORDER BY 2 DESC LIMIT 12
    `, [tenant.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/funnel', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(`
      SELECT estado, COUNT(*) AS total
      FROM prospectos WHERE tenant_id = $1
      GROUP BY estado ORDER BY total DESC
    `, [tenant.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/por-canal', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(`
      SELECT COALESCE(canal, 'Sin canal') AS canal, COUNT(*) AS total
      FROM prospectos WHERE tenant_id = $1
      GROUP BY 1 ORDER BY 2 DESC
    `, [tenant.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/por-broker', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query(`
      SELECT
        COALESCE(broker_asignado, 'Sin asignar') AS broker,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado IN ('Calificado','Negociación','Cierre','Post-venta')) AS calificados,
        COALESCE(SUM(presupuesto_usd::numeric), 0) AS presupuesto
      FROM prospectos WHERE tenant_id = $1
      GROUP BY 1 ORDER BY 2 DESC
    `, [tenant.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Servidor GLP CRM en http://localhost:${PORT}`);
  console.log(`🗄️  Base de datos: PostgreSQL (Supabase)`);
  console.log(`=================================================`);
  startEmailPoller();
  startProspectMonitor();
  startCrisisDetector();
});
