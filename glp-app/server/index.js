const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const pool = require('./db');

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
          html: `<div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;border:1px solid #E5E7EB;border-top:4px solid #002349;border-radius:8px;padding:32px;">
            <p style="font-weight:600;color:#002349;">Estimado/a ${firstName},</p>
            <p>Confirmamos la recepción de su solicitud para el proyecto <strong>${project}</strong>. Nuestros especialistas lo contactarán a la brevedad.</p>
            <div style="margin:24px 0;padding:16px;background:#F9FAFB;border-left:4px solid #B89047;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#002349;">Detalles de su solicitud:</p>
              <ul style="font-size:14px;color:#4B5563;"><li><strong>Proyecto:</strong> ${project}</li><li><strong>Mensaje:</strong> ${message || 'Información general.'}</li></ul>
            </div>
            <p style="color:#4B5563;">Atentamente,<br/><strong>Sara Valenzuela</strong><br/>${tenant.name}</p>
          </div>`
        });
        emailClientSent = true;

        await transporter.sendMail({
          from: `"SARA Lead Alert" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
          to: tenant.contact?.email || process.env.SMTP_USER,
          subject: `🚨 Nuevo Lead: ${name} - ${project}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #cbd5e1;border-radius:8px;">
            <h2 style="color:#0f172a;">Nuevo Lead desde la Web 🚀</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;">Nombre</td><td style="padding:10px;border:1px solid #e2e8f0;">${name}</td></tr>
              <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;">Correo</td><td style="padding:10px;border:1px solid #e2e8f0;">${email}</td></tr>
              <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;">Teléfono</td><td style="padding:10px;border:1px solid #e2e8f0;">${phone || 'No indicado'}</td></tr>
              <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;">Proyecto</td><td style="padding:10px;border:1px solid #e2e8f0;">${project}</td></tr>
              <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;">Mensaje</td><td style="padding:10px;border:1px solid #e2e8f0;">${message || 'Sin comentarios'}</td></tr>
            </table>
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

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Servidor GLP CRM en http://localhost:${PORT}`);
  console.log(`🗄️  Base de datos: PostgreSQL (Supabase)`);
  console.log(`=================================================`);
});
