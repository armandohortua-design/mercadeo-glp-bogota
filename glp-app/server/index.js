const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const pool = require('./db');
const { startEmailPoller, pollInbox } = require('./emailPoller');
const { startProspectMonitor, monitorProspects } = require('./prospectMonitor');
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

// ==========================================
// PROYECTOS / CATÁLOGO
// ==========================================
app.get('/api/projects', async (req, res) => {
  try {
    const tenant = await resolveTenant(req);
    const { rows } = await pool.query('SELECT data FROM projects WHERE tenant_id = $1', [tenant.id]);
    res.json(rows.map(r => r.data));
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
    const { name, email, phone, project, message, channel } = req.body;
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

    // Generar borrador con OpenAI o plantilla
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    let draftSubject = `Información - ${project} | GLP`;
    let draftBody = `Estimado/a ${firstName},\n\nGracias por contactarnos sobre ${project}.\n\nQuedo a tu disposición.\n\nSara Valenzuela\n${tenant.name}`;

    if (apiKey) {
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

    // Guardar prospecto en la base de datos
    await pool.query(
      `INSERT INTO prospectos (tenant_id, nombre, apellido, correo, telefono, proyectos_interes, forma_contacto, estado, canal, notas, fecha_registro, fecha_ultima_actividad)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
      [tenant.id, firstName, '', email, phone || '',
       JSON.stringify([project]), channel || 'Web', 'Contacto Inicial', channel || 'Web',
       message || '']
    );

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
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID del borrador requerido.' });

    const { rows } = await pool.query('SELECT * FROM drafts WHERE id = $1 AND tenant_id = $2', [id, tenant.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Borrador no encontrado.' });

    const draft = rows[0];
    const transporter = getTransporter(tenant);
    if (!transporter) return res.status(500).json({ error: 'SMTP no configurado.' });

    const toEmailMatch = draft.destinatario?.match(/\(([^)]+)\)/);
    const toEmail = toEmailMatch ? toEmailMatch[1] : draft.destinatario;

    await transporter.sendMail({
      from: `"Sara Valenzuela · ${tenant.name}" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: draft.subject,
      html: draft.body.replace(/\n/g, '<br>')
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
// CHATBOT SARA
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Mensajes requeridos.' });

    const tenant = await resolveTenant(req);
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI no configurado.' });

    const { rows: projectRows } = await pool.query('SELECT data FROM projects WHERE tenant_id = $1', [tenant.id]);
    const projects = projectRows.map(r => r.data);
    const catalogSummary = projects.map(p =>
      `- ${p.name}: ${p.zone}. Tipo: ${p.type}. Desde $${p.price} USD. ${p.amenities?.join(', ') || ''}`
    ).join('\n') || 'Portafolio disponible en consulta directa.';

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Eres S.A.R.A, asesora elite de inversiones inmobiliarias de ${tenant.name}. Responde de forma cálida, profesional y persuasiva. Catálogo:\n${catalogSummary}` },
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

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Servidor GLP CRM en http://localhost:${PORT}`);
  console.log(`🗄️  Base de datos: PostgreSQL (Supabase)`);
  console.log(`=================================================`);
  startEmailPoller();
  startProspectMonitor();
  startCrisisDetector();
});
