const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Rutas de archivos de base de datos local JSON
const BITACORA_FILE = path.join(__dirname, 'bitacora.json');
const DRAFTS_FILE = path.join(__dirname, 'drafts.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const TENANTS_FILE = path.join(__dirname, 'tenants.json');

// Inicializar archivos si no existen
if (!fs.existsSync(BITACORA_FILE)) {
  fs.writeFileSync(BITACORA_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(DRAFTS_FILE)) {
  fs.writeFileSync(DRAFTS_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(PROJECTS_FILE)) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(TENANTS_FILE)) {
  fs.writeFileSync(TENANTS_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Helper para leer/escribir archivos JSON
function readJSON(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error leyendo ${file}:`, e);
    return [];
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error escribiendo en ${file}:`, e);
  }
}

// Resolver Tenant actual a partir del header
function resolveTenant(req) {
  const tenants = readJSON(TENANTS_FILE);
  const tenantId = req.headers['x-tenant-id'] || 'tenant-glp-001';
  const tenant = tenants.find(t => t.id === tenantId);
  if (tenant) return tenant;
  // Fallback
  return {
    id: 'default',
    name: 'GLP Wealth Management',
    domain: 'glp.com.pa',
    contact: { address: '2GFM+R7, C. Ramon H. Jurado, Panamá', email: 'info@glp.com.pa', website: 'www.glp.com.pa' },
    smtp: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    openai: { apiKey: process.env.OPENAI_API_KEY }
  };
}

// Configurar transportador SMTP
function getTransporter(tenant) {
  const user = tenant?.smtp?.user || process.env.SMTP_USER;
  const pass = tenant?.smtp?.pass || process.env.SMTP_PASS;

  if (!user || !pass || pass === "tu_contraseña_de_aplicacion_gmail") {
    console.warn(`⚠️ Servidor SMTP no configurado para el tenant ${tenant?.id || 'default'}.`);
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass
    }
  });
}

// Endpoint de salud
app.get('/api/health', (req, res) => {
  const hasSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_PASS !== "tu_contraseña_de_aplicacion_gmail");
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    smtpConfigured: hasSMTP,
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });
});

// Endpoint para consultar la bitácora
app.get('/api/bitacora', (req, res) => {
  const logs = readJSON(BITACORA_FILE);
  res.json(logs);
});

// Endpoint para consultar borradores
app.get('/api/drafts', (req, res) => {
  const drafts = readJSON(DRAFTS_FILE);
  res.json(drafts);
});

// Endpoint para consultar el catálogo de proyectos/activos
app.get('/api/projects', (req, res) => {
  const projects = readJSON(PROJECTS_FILE);
  res.json(projects);
});

// Endpoint para actualizar el catálogo de proyectos/activos
app.post('/api/projects', (req, res) => {
  const { projects } = req.body;
  if (!Array.isArray(projects)) {
    return res.status(400).json({ error: 'Se requiere un arreglo de proyectos.' });
  }
  writeJSON(PROJECTS_FILE, projects);
  res.json({ success: true, count: projects.length });
});

// Endpoint principal al registrar un contacto (Landing Page Form)
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, project, message, channel } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y Correo son obligatorios.' });
    }

    // 1. Parsear el nombre para extraer únicamente el primer nombre (cálido y cercano)
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Cliente';
    const tenant = resolveTenant(req);

    console.log(`✉️ Procesando solicitud para lead: ${name} (${email}) | Proyecto: ${project} | Tenant: ${tenant.id}`);

    const transporter = getTransporter(tenant);
    let emailClientSent = false;
    let emailAdminSent = false;
    let smtpError = null;

    if (transporter) {
      try {
        // CORREO 1: Confirmación automatizada al cliente desde "Sara Valenzuela"
        const clientMailOptions = {
          from: `"Sara Valenzuela · ${tenant.name}" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
          to: email,
          subject: `Hemos recibido tu solicitud para ${project} - GLP`,
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-top: 4px solid #002349; border-radius: 8px; padding: 32px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left;">
              <p style="font-size: 16px; font-weight: 600; color: #002349; margin-top: 0; margin-bottom: 16px;">Estimado/a ${firstName},</p>
              <p style="margin-bottom: 16px;">Reciba un cordial saludo de parte de nuestro equipo. A través de este mensaje, le confirmamos la recepción de su solicitud de información referente al proyecto <strong>${project}</strong>, perteneciente a nuestro portafolio de inversión inmobiliaria dolarizada en Panamá.</p>
              <p style="margin-bottom: 24px;">Nuestros especialistas comerciales ya se encuentra revisando los detalles de su consulta. Nos pondremos en contacto con usted a la mayor brevedad posible para proporcionarle la ficha técnica ampliada, planos de distribución y las proyecciones de rentabilidad correspondientes.</p>
              
              <div style="margin: 28px 0; padding: 20px; background-color: #F9FAFB; border-left: 4px solid #B89047; border-radius: 6px;">
                <p style="margin: 0; font-size: 13px; font-weight: 700; color: #002349; text-transform: uppercase; letter-spacing: 0.05em;">Detalles de su solicitud:</p>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; color: #4B5563; line-height: 1.5;">
                  <li><strong>Proyecto de interés:</strong> ${project}</li>
                  <li><strong>Mensaje / Requerimiento:</strong> ${message || 'Solicitud de información general.'}</li>
                </ul>
              </div>
              
              <p style="margin-bottom: 24px;">Si desea agilizar su consulta o requiere asistencia inmediata, puede responder directamente a este correo o comunicarse con nosotros vía WhatsApp.</p>
              
              <p style="margin-bottom: 12px; color: #4B5563;">Atentamente,</p>
              
              <table style="border-collapse: collapse; margin-top: 16px; font-family: 'Segoe UI', Arial, sans-serif; text-align: left;">
                <tr>
                  <td style="border-left: 3px solid #B89047; padding-left: 16px;">
                    <div style="font-size: 15px; font-weight: bold; color: #002349; margin: 0 0 2px 0;">Sara Valenzuela</div>
                    <div style="font-size: 11px; color: #B89047; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px 0;">Directora de Customer Success & Back-Office Comercial</div>
                    <div style="font-size: 13px; font-weight: bold; color: #111827; margin: 0 0 4px 0;">${tenant.name}</div>
                    <div style="font-size: 11px; color: #4B5563; line-height: 1.4;">
                      ${tenant.contact?.address || ''}<br />
                      <a href="mailto:${tenant.contact?.email || ''}" style="color: #002349; text-decoration: none; font-weight: 600;">${tenant.contact?.email || ''}</a> | 
                      <a href="https://${tenant.contact?.website || ''}" target="_blank" style="color: #002349; text-decoration: none; font-weight: 600;">${tenant.contact?.website || ''}</a>
                    </div>
                  </td>
                </tr>
              </table>
              
              <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 28px 0;" />
              <p style="font-size: 10px; color: #94a3b8; text-align: left; margin-bottom: 0; font-style: italic; line-height: 1.4;">
                <strong>Nota de Confidencialidad:</strong> Esta comunicación y sus anexos contienen información exclusiva y confidencial de ${tenant.name}. Queda estrictamente prohibida su divulgación o reproducción sin autorización previa y por escrito.
              </p>
            </div>
          `
        };

        await transporter.sendMail(clientMailOptions);
        emailClientSent = true;
        console.log(`✅ Correo de confirmación enviado a cliente: ${email}`);

        // CORREO 2: Notificación al administrador
        const adminMailOptions = {
          from: `"SARA Lead Alert" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
          to: 'armandohortua@gmail.com',
          subject: `🚨 Nuevo Lead Registrado: ${name} - ${project}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; background-color: #f8fafc;">
              <h2 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; font-size: 20px;">Nuevo Lead desde la Web 🚀</h2>
              <p>Hola Armando,</p>
              <p>Se ha registrado un cliente interesado en el portafolio inmobiliario. A continuación los datos completos:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <tr style="background-color: #f1f5f9;">
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; width: 35%;">Nombre Completo:</td>
                  <td style="padding: 12px; border: 1px solid #e2e8f0;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">Correo:</td>
                  <td style="padding: 12px; border: 1px solid #e2e8f0;"><a href="mailto:${email}" style="color: #0f766e; text-decoration: none;">${email}</a></td>
                </tr>
                <tr style="background-color: #f1f5f9;">
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">Teléfono / WhatsApp:</td>
                  <td style="padding: 12px; border: 1px solid #e2e8f0;">${phone || 'No indicado'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">Proyecto de Interés:</td>
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f766e;">${project}</td>
                </tr>
                <tr style="background-color: #f1f5f9;">
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">Canal:</td>
                  <td style="padding: 12px; border: 1px solid #e2e8f0;">${channel || 'Web Form'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">Requerimientos:</td>
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-style: italic;">${message || 'Interesado en cotizaciones y folletos.'}</td>
                </tr>
              </table>
              <div style="background-color: #fef9c3; padding: 14px; border-left: 4px solid #eab308; border-radius: 4px; font-size: 13px; color: #713f12;">
                💡 <strong>Acción Automatizada:</strong> SARA envió el correo de bienvenida a <strong>${firstName}</strong>. He dejado un borrador de respuesta detallada listo en tu panel de CRM en la pestaña de <strong>Agentes IA</strong> para tu revisión y envío comercial.
              </div>
            </div>
          `
        };

        await transporter.sendMail(adminMailOptions);
        emailAdminSent = true;
        console.log(`✅ Correo de alerta enviado al admin: armandohortua@gmail.com`);
      } catch (err) {
        console.error("❌ Error enviando SMTP:", err);
        smtpError = err.message;
      }
    } else {
      console.log("⚠️ Saltando SMTP: El transportador de correos no está listo.");
      smtpError = "SMTP no configurado";
    }

    // 2. Preparar el borrador de respuesta (GPT o Plantillas de Alta Fidelidad)
    let draftSubject = `Información Especializada - ${project} | GLP`;
    let draftBody = "";

    if (project.toLowerCase().includes('ocean reef')) {
      draftSubject = `Dossier de Inversión y Plan de Pagos - Ocean Reef Park`;
      draftBody = `Estimado/a ${firstName},\n\n` +
        `Es un placer saludarte nuevamente. En respuesta a tu interés en Ocean Reef Park, he preparado esta cotización preliminar y el folleto técnico completo de las residencias.\n\n` +
        `Ocean Reef es el único desarrollo de islas artificiales de la región con marina privada de yates. Contamos con planes de financiamiento del 30% inicial diferido y el 70% contra entrega programada. Además, las propiedades en esta zona se benefician de exenciones prediales de larga duración y son idóneas para aplicar al programa de Residencia Permanente por Inversión Calificada.\n\n` +
        `Me gustaría agendar una llamada breve de 10 minutos esta semana para presentarte la disponibilidad de unidades de 2 y 3 habitaciones con vista directa al mar y realizar una corrida de Cap Rate de renta estimado.\n\n` +
        `Quedo a tu disposición.\n\n` +
        `Cordialmente,\n\n` +
        `Sara Valenzuela\n` +
        `Directora de Customer Success & Back-Office Comercial\n` +
        `GLP Wealth Management · Grupo Los Pueblos\n` +
        `2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá\n` +
        `E: info@glp.com.pa | W: www.glp.com.pa\n\n` +
        `--- \n` +
        `Nota de Confidencialidad: Esta comunicación y sus anexos contienen información exclusiva y confidencial de GLP Wealth Management. Queda estrictamente prohibido su uso, divulgación o reproducción sin autorización.`;
    } else if (project.toLowerCase().includes('tides') || project.toLowerCase().includes('caracol') || project.toLowerCase().includes('surfside')) {
      draftSubject = `Proyecciones Financieras y Ficha Técnica - Playa Caracol`;
      draftBody = `Estimado/a ${firstName},\n\n` +
        `Muchas gracias por comunicarte con nosotros. Adjunto a este correo encontrarás el informe de rentabilidad y la simulación financiera para las unidades de playa en Playa Caracol (The Tides / Surfside).\n\n` +
        `Estas unidades frente al mar tienen un precio de entrada sumamente atractivo y un retorno neto estimado del 6.8% al 7.5% anual a través de rentas vacacionales cortas administradas. Asimismo, la cuota inicial de separación es flexible, permitiendo estructurar los plazos restantes a 24 o 36 meses.\n\n` +
        `¿Te interesaría coordinar una videollamada para revisar los precios de lanzamiento de unidades exclusivas con vista al océano y el esquema de pagos diferidos?\n\n` +
        `Un saludo cordial,\n\n` +
        `Sara Valenzuela\n` +
        `Directora de Customer Success & Back-Office Comercial\n` +
        `GLP Wealth Management · Grupo Los Pueblos\n` +
        `2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá\n` +
        `E: info@glp.com.pa | W: www.glp.com.pa\n\n` +
        `--- \n` +
        `Nota de Confidencialidad: Esta comunicación y sus anexos contienen información exclusiva y confidencial de GLP Wealth Management. Queda estrictamente prohibido su uso, divulgación o reproducción sin autorización.`;
    } else {
      draftSubject = `Oportunidades de Inversión Inmobiliaria Dolarizada - GLP`;
      draftBody = `Estimado/a ${firstName},\n\n` +
        `Muchas gracias por contactarnos. He preparado un compendio de las opciones más rentables de nuestro portafolio de inversión inmobiliaria dolarizada en la Ciudad de Panamá y áreas de playa.\n\n` +
        `Nuestros proyectos ofrecen alta plusvalía e importantes incentivos tributarios para extranjeros, tales como la exoneración del impuesto de inmuebles por hasta 20 años. Adicionalmente, contamos con el respaldo legal de Colombia Law Group para estructurar tu proceso migratorio y cambiario de manera totalmente segura.\n\n` +
        `¿Cuándo te quedaría bien para conversar brevemente y poder perfilar tu búsqueda de inversión en dólares?\n\n` +
        `Atentamente,\n\n` +
        `Sara Valenzuela\n` +
        `Directora de Customer Success & Back-Office Comercial\n` +
        `GLP Wealth Management · Grupo Los Pueblos\n` +
        `2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá\n` +
        `E: info@glp.com.pa | W: www.glp.com.pa\n\n` +
        `--- \n` +
        `Nota de Confidencialidad: Esta comunicación y sus anexos contienen información exclusiva y confidencial de GLP Wealth Management. Queda estrictamente prohibido su uso, divulgación o reproducción sin autorización.`;
    }

    // OpenAI Generative Draft (si está configurada la API KEY para el tenant)
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: apiKey });
        console.log("🤖 Llamando a OpenAI para generar un borrador inteligente personalizado...");
        const aiPrompt = `Eres Sara Valenzuela, Directora de Customer Success de ${tenant.name}.
Tu objetivo es redactar un correo formal, cálido y altamente persuasivo de respuesta comercial.
El cliente se llama "${name}" y ha solicitado información para el proyecto "${project}".
Lo MÁS IMPORTANTE: El cliente ha dejado el siguiente mensaje/requerimiento: "${message || 'Solicitud de información general'}".
DEBES leer analíticamente ese mensaje y estructurar tu respuesta girando 100% en torno a resolver sus dudas específicas, abordar sus necesidades y demostrar que hemos leído su solicitud con atención. No mandes un correo genérico.
El tono debe ser profesional y sofisticado. Responde en español usando el primer nombre "${firstName}" en el saludo.
Incluye detalles de inversión de lujo relevantes a su duda, y termina siempre con una pregunta estratégica para concertar una llamada.
Asegúrate de que el correo finalice siempre con la siguiente firma elegante de ${tenant.name}:

Cordialmente,

Sara Valenzuela
Directora de Customer Success & Back-Office Comercial
${tenant.name}
${tenant.contact?.address || ''}
E: ${tenant.contact?.email || ''} | W: ${tenant.contact?.website || ''}

Nota de Confidencialidad: Esta comunicación y sus anexos contienen información exclusiva y confidencial de ${tenant.name}. Queda estrictamente prohibido su uso, divulgación o reproducción sin autorización previa y por escrito.

Devuelve EXACTAMENTE un objeto JSON en este formato (sin bloques de código markdown \`\`\`json):
{"subject": "Asunto del correo", "body": "Cuerpo del correo con saltos de línea \\n"}`;
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: aiPrompt }],
          temperature: 0.7
        });

        const rawContent = response.choices[0].message.content.trim();
        const cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedAI = JSON.parse(cleanContent);
        if (parsedAI.subject) draftSubject = parsedAI.subject;
        if (parsedAI.body) draftBody = parsedAI.body;
      } catch (aiErr) {
        console.error("⚠️ Falló llamada a OpenAI, utilizando plantilla de alta fidelidad:", aiErr.message);
      }
    }

    // 3. Guardar Borrador
    const drafts = readJSON(DRAFTS_FILE);
    const draftId = `draft-${Date.now()}`;
    const newDraft = {
      id: draftId,
      to: `${name} (${email})`,
      project: project,
      subject: draftSubject,
      body: draftBody,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    drafts.unshift(newDraft);
    writeJSON(DRAFTS_FILE, drafts);

    // 4. Registrar en la Bitácora
    const logs = readJSON(BITACORA_FILE);
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      cliente: name,
      correo: email,
      whatsapp: phone || 'N/A',
      proyecto: project,
      canal: channel || 'Web',
      correoCliente: emailClientSent ? 'Enviado' : (smtpError ? `Falló (${smtpError})` : 'Pendiente'),
      correoAdmin: emailAdminSent ? 'Enviado' : (smtpError ? `Falló (${smtpError})` : 'Pendiente'),
      borradorCreado: draftId,
      mensaje: message || 'Sin comentarios'
    };
    logs.unshift(newLog);
    writeJSON(BITACORA_FILE, logs);

    res.json({
      success: true,
      log: newLog,
      draft: newDraft,
      smtpError
    });

  } catch (error) {
    console.error("❌ Error general en /api/contact:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para enviar un borrador aprobado por el administrador
app.post('/api/send-draft', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'El ID del borrador es obligatorio.' });
    }

    const drafts = readJSON(DRAFTS_FILE);
    const draftIdx = drafts.findIndex(d => d.id === id);

    if (draftIdx === -1) {
      return res.status(404).json({ error: 'Borrador no encontrado.' });
    }

    const draft = drafts[draftIdx];
    const tenant = resolveTenant(req);
    const transporter = getTransporter(tenant);

    if (!transporter) {
      return res.status(500).json({ error: 'Servidor SMTP no configurado para este tenant.' });
    }

    // Extraer correo del campo 'to'
    const toEmailMatch = draft.to.match(/\(([^)]+)\)/);
    const toEmail = toEmailMatch ? toEmailMatch[1] : draft.to;

    console.log(`✉️ Enviando borrador aprobado ${id} a: ${toEmail} (Tenant: ${tenant.id})`);

    const mailOptions = {
      from: `"Sara Valenzuela · ${tenant.name}" <${tenant.smtp?.user || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: draft.subject,
      text: draft.body,
      html: draft.body.replace(/\n/g, '<br>')
    };

    await transporter.sendMail(mailOptions);

    // Actualizar estado del borrador
    drafts[draftIdx].status = 'sent';
    writeJSON(DRAFTS_FILE, drafts);

    // Registrar en la Bitácora
    const logs = readJSON(BITACORA_FILE);
    logs.unshift({
      id: `log-approval-${Date.now()}`,
      timestamp: new Date().toISOString(),
      cliente: draft.to,
      correo: toEmail,
      proyecto: draft.project,
      canal: 'CRM Admin',
      correoCliente: 'Enviado (Aprobado por Admin)',
      correoAdmin: 'N/A',
      borradorCreado: id,
      mensaje: `Borrador comercial aprobado y enviado por administrador. Asunto: ${draft.subject}`
    });
    writeJSON(BITACORA_FILE, logs);

    res.json({ success: true, draftId: id });

  } catch (error) {
    console.error("❌ Error en /api/send-draft:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de Chatbot SARA con OpenAI
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Se requiere un arreglo de mensajes.' });
    }

    const tenant = resolveTenant(req);
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: 'OpenAI API Key no configurada.' });
    }

    const projects = readJSON(PROJECTS_FILE);
    const catalogSummary = projects.map(p => 
      `- ${p.name}: Ubicado en ${p.zone}. Tipo: ${p.type}. Desde $${p.price} USD. Área: ${p.area}. Amenidades: ${p.amenities.join(', ')}`
    ).join('\n');

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: apiKey });

    const systemPrompt = `Eres S.A.R.A, la Asistente Virtual Inteligente y experta en inversiones inmobiliarias de ${tenant.name}.
Tu objetivo es perfilar al cliente, responder a sus preguntas de forma cálida, profesional y persuasiva, y lograr capturar sus datos de contacto (correo o teléfono) para que un broker cierre la asesoría.
No eres un simple robot; actúas como una asesora elite en Real Estate en Panamá. Usa emojis con moderación para mantener la cercanía.

INFORMACIÓN DEL CATÁLOGO ACTUAL:
${catalogSummary}

REGLAS IMPORTANTES:
1. Responde de forma concisa pero con alto valor (máximo 2 párrafos cortos).
2. Analiza el contexto de la charla. Usa la información del catálogo para recomendar de 1 a 2 proyectos específicos que se ajusten a lo que busca (playa, ciudad, renta turística, patrimonio familiar).
3. Si el usuario ya ha hecho un par de preguntas y muestra interés, pídele estratégicamente su WhatsApp o correo electrónico para enviarle una corrida financiera o agendar una videollamada sin compromiso.
4. Si el usuario en la conversación proporciona su teléfono o correo (ej. "mi correo es test@test.com"), agradécele cálidamente, dile que sus datos están seguros y que un broker experto se comunicará pronto.
5. No inventes precios ni propiedades que no estén en el catálogo.
6. Si preguntan por retorno de inversión, menciona que manejamos rentabilidades estimadas del 5% al 12% anual (dependiendo si es renta residencial o tipo Airbnb).
7. Si preguntan por beneficios migratorios, menciona que Panamá ofrece la Residencia Permanente por Inversión Inmobiliaria desde $300,000 USD y contamos con bufetes aliados para todo el trámite.`;

    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openAiMessages,
      temperature: 0.7,
      max_tokens: 350
    });

    const botReply = response.choices[0].message.content.trim();
    res.json({ reply: botReply });

  } catch (error) {
    console.error("❌ Error en /api/chat:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================================================
// RUTAS DE INTEGRACIÓN CON APOLLO.IO
// ==============================================================

app.post('/api/apollo/mine', async (req, res) => {
  const tenant = resolveTenant(req);
  const apolloKey = tenant?.apollo?.apiKey;

  if (!apolloKey) {
    return res.status(400).json({ error: 'API Key de Apollo no configurada para este tenant.' });
  }

  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': apolloKey
      },
      body: JSON.stringify({
        page: 1,
        person_locations: ["Colombia"],
        person_titles: ["CEO", "Founder", "Gerente General", "Director", "Presidente", "CFO", "Socio"],
        per_page: 2
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(()=>({}));
      console.error("Apollo Error:", errData);
      return res.status(response.status).json({ error: 'Error comunicándose con Apollo API', details: errData });
    }

    const data = await response.json();
    
    // Mapear a formato Prospect esperado por el Frontend
    const prospects = (data.people || []).map(p => ({
      nombre: p.first_name || 'Desconocido',
      apellido: p.last_name || '',
      direccion: p.city ? `${p.city}, Colombia` : 'Colombia',
      correo: p.email || 'No disponible',
      telefono: p.phone_numbers && p.phone_numbers.length > 0 ? p.phone_numbers[0].sanitized_number || 'No disponible' : 'No disponible',
      ocupacion: p.title || 'C-Level / Ejecutivo',
      empresa: p.organization?.name || '',
      linkedin: p.linkedin_url || '',
      proyectos_interes: ["Nuevos Desarrollos Panamá"],
      forma_contacto: "Apollo API Data Mining",
      broker_asignado: "Por Asignar",
      presupuesto_usd: 350000,
      notas: `Prospecto extraído vía Apollo. Empresa: ${p.organization?.name || 'N/A'}`
    }));

    res.json({ success: true, prospects });
  } catch (err) {
    console.error("❌ Error en /api/apollo/mine:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================
// RUTAS DE SARA – ANÁLISIS DE PROSPECTOS Y GENERACIÓN DE BORRADORES (GPT-4)
// El SMTP/Gmail solo se usa como bridge para ENVIAR correos aprobados.
// ==============================================================

app.post('/api/sara/process-prospects', async (req, res) => {
  try {
    const tenant = resolveTenant(req);
    const apiKey = tenant?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API Key requerida.' });

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    // Leer prospectos del CRM (DB + JSON)
    const prospectsFromDB = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM prospects ORDER BY id DESC LIMIT 50', [], (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    // También considerar prospectos que vengan del frontend en el body
    const frontendProspects = req.body.prospects || [];
    
    // Combinar: priorizar los del frontend si los mandan, sino usar DB
    const allProspects = frontendProspects.length > 0 ? frontendProspects : prospectsFromDB;

    const projects = readJSON(PROJECTS_FILE);
    const catalogSummary = projects.map(p =>
      `- ${p.name}: Ubicado en ${p.zone || 'N/A'}. Tipo: ${p.type || 'N/A'}. Desde $${p.price || 'N/A'} USD. ${p.description || ''}`
    ).join('\n');

    const existingDrafts = readJSON(DRAFTS_FILE);
    const logs = readJSON(BITACORA_FILE);

    // Filtrar prospectos que necesitan atención (sin borrador reciente o inactivos)
    const existingDraftEmails = new Set(existingDrafts.filter(d => d.status === 'pending').map(d => {
      const match = d.to?.match(/\(([^)]+)\)/);
      return match ? match[1] : '';
    }));

    const needsAttention = allProspects.filter(p => {
      const email = p.correo || p.email || '';
      // No generar duplicados si ya hay borrador pendiente
      return email && !existingDraftEmails.has(email);
    }).slice(0, 5); // Máximo 5 por ciclo

    console.log(`🤖 SARA procesando ${needsAttention.length} prospectos del CRM...`);

    const results = [];
    const reactivationPlans = [];

    for (const prospect of needsAttention) {
      try {
        const nombre = prospect.nombre || prospect.name || 'Cliente';
        const apellido = prospect.apellido || prospect.lastName || '';
        const email = prospect.correo || prospect.email || '';
        const proyectos = prospect.proyectos_interes || prospect.projects || [];
        const estado = prospect.estado || prospect.status || 'Nuevo';
        const notas = prospect.notas || prospect.notes || '';
        const presupuesto = prospect.presupuesto_usd || prospect.budget || 'No especificado';
        const formaContacto = prospect.forma_contacto || prospect.channel || 'Web';
        const fechaEntrada = prospect.fecha_entrada || prospect.created_at || 'Reciente';
        const historial = prospect.historial || [];
        const historialStr = historial.map(h => `  - ${h.fecha}: ${h.accion} – ${h.detalle}`).join('\n') || '  Sin historial previo.';

        const aiPrompt = `Eres Sara Valenzuela, Directora de Customer Success & Back-Office Comercial de GLP Wealth Management (Panamá).

PROSPECTO DEL CRM:
- Nombre: ${nombre} ${apellido}
- Email: ${email}
- Estado: ${estado}
- Presupuesto: $${presupuesto} USD
- Proyectos de interés: ${Array.isArray(proyectos) ? proyectos.join(', ') : proyectos}
- Canal de contacto: ${formaContacto}
- Fecha de entrada: ${fechaEntrada}
- Notas: ${notas}
- Historial de interacciones:
${historialStr}

CATÁLOGO DE PROYECTOS GLP:
${catalogSummary || 'No hay proyectos cargados.'}

INSTRUCCIONES:
1. Redacta un correo comercial hipercontextualizado para este prospecto. Toma en cuenta su presupuesto, proyectos de interés, estado actual y todo el contexto disponible.
2. Si el prospecto está en estado "Contacto Inicial", redacta un correo de bienvenida cálido con opciones del catálogo que encajen con su perfil.
3. Si está en "Seguimiento" o "Interesado", redacta un correo de seguimiento mencionando los beneficios específicos de los proyectos que le interesan.
4. Si lleva más de 15 días inactivo, sugiere un plan de reactivación agresivo con incentivos.
5. Usa tono profesional, sofisticado y personalizado. Firma como Sara Valenzuela, GLP Wealth Management.

Devuelve SOLO un JSON válido (sin markdown):
{"draftSubject": "Asunto del correo", "draftBody": "Cuerpo completo con \\n para saltos de línea", "proyectosRecomendados": ["Proyecto"], "reactivationPlan": "Plan de trabajo/seguimiento interno para este lead", "prioridad": "alta|media|baja"}`;

        const gptResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: aiPrompt }],
          temperature: 0.7,
          max_tokens: 900
        });

        let rawAI = gptResponse.choices[0].message.content.trim();
        rawAI = rawAI.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(rawAI);

        const draftId = `draft-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const newDraft = {
          id: draftId,
          to: `${nombre} ${apellido} (${email})`,
          project: (parsed.proyectosRecomendados || proyectos || []).join(', ') || 'General',
          subject: parsed.draftSubject || `Oportunidad exclusiva GLP – ${nombre}`,
          body: parsed.draftBody || `Estimado/a ${nombre}, gracias por su interés en GLP.`,
          status: 'pending',
          createdAt: new Date().toISOString(),
          prioridad: parsed.prioridad || 'media'
        };

        existingDrafts.unshift(newDraft);

        const plan = parsed.reactivationPlan || 'Seguimiento estándar en 48h.';
        reactivationPlans.push({ nombre: `${nombre} ${apellido}`, email, plan, prioridad: parsed.prioridad || 'media' });

        results.push({
          prospectId: prospect.id,
          nombre: `${nombre} ${apellido}`,
          correo: email,
          draft: newDraft,
          reactivationPlan: plan,
          proyectosRecomendados: parsed.proyectosRecomendados || [],
          prioridad: parsed.prioridad || 'media'
        });

        logs.unshift({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          cliente: `${nombre} ${apellido}`,
          correo: email,
          proyecto: newDraft.project,
          canal: 'SARA – Análisis CRM',
          correoCliente: 'N/A',
          correoAdmin: 'N/A',
          borradorCreado: draftId,
          mensaje: `Borrador generado por GPT-4: ${newDraft.subject}`
        });

        console.log(`✅ Borrador generado para ${nombre} ${apellido} (${email}) – Prioridad: ${parsed.prioridad || 'media'}`);
      } catch (prospectErr) {
        console.error(`❌ Error procesando prospecto ${prospect.nombre || prospect.id}:`, prospectErr.message);
      }
    }

    writeJSON(DRAFTS_FILE, existingDrafts);
    writeJSON(BITACORA_FILE, logs);

    console.log(`🏁 SARA completó: ${results.length} borradores listos para revisión.`);
    res.json({
      success: true,
      processedCount: results.length,
      totalProspects: allProspects.length,
      results,
      reactivationPlans
    });
  } catch (err) {
    console.error('❌ Error en SARA process-prospects:', err);
    res.status(500).json({ error: err.message });
  }
});




// ==============================================================
// RUTAS DEL SUPER ADMIN (GESTIÓN DE TENANTS)
// ==============================================================

app.get('/api/admin/tenants', (req, res) => {
  const tenants = readJSON(TENANTS_FILE);
  res.json(tenants);
});

app.post('/api/admin/tenants', (req, res) => {
  const { id, name, domain, contact, smtp, openai, status } = req.body;
  if (!name || !domain) {
    return res.status(400).json({ error: 'Nombre y dominio son obligatorios.' });
  }
  
  const tenants = readJSON(TENANTS_FILE);
  const newTenant = {
    id: id || `tenant-${Date.now()}`,
    name,
    domain,
    status: status || 'active',
    contact: contact || {},
    smtp: smtp || {},
    openai: openai || {},
    createdAt: new Date().toISOString()
  };
  
  tenants.push(newTenant);
  writeJSON(TENANTS_FILE, tenants);
  res.json({ success: true, tenant: newTenant });
});

app.put('/api/admin/tenants/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const tenants = readJSON(TENANTS_FILE);
  
  const index = tenants.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Tenant no encontrado.' });
  }
  
  tenants[index] = { ...tenants[index], ...updates };
  writeJSON(TENANTS_FILE, tenants);
  res.json({ success: true, tenant: tenants[index] });
});

// ==============================================================
// RUTAS SQLITE (MIGRACIÓN FASE 1)
// ==============================================================

app.get('/api/prospectos', (req, res) => {
  db.all("SELECT * FROM prospectos", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Parse JSON strings back to arrays for proyectos_interes and historial
    const formattedRows = rows.map(r => ({
      ...r,
      proyectos_interes: r.proyectos_interes ? JSON.parse(r.proyectos_interes) : [],
      historial: r.historial ? JSON.parse(r.historial) : []
    }));
    res.json(formattedRows);
  });
});

app.post('/api/prospectos', (req, res) => {
  const p = req.body;
  const stmt = db.prepare(`INSERT INTO prospectos (
    id, nombre, apellido, correo, telefono, direccion, ocupacion, empresa, linkedin, 
    proyectos_interes, forma_contacto, broker_asignado, presupuesto_usd, estado, canal, notas, historial, fecha_registro, fecha_ultima_actividad
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const ts = new Date().toISOString();
  stmt.run([
    p.id, p.nombre, p.apellido, p.correo, p.telefono, p.direccion, p.ocupacion, p.empresa, p.linkedin,
    JSON.stringify(p.proyectos_interes || []), p.forma_contacto, p.broker_asignado, p.presupuesto_usd,
    p.estado || 'Lead Nuevo', p.canal || 'Web', p.notas, JSON.stringify(p.historial || []), p.fecha_registro || ts, ts
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
  stmt.finalize();
});

app.put('/api/prospectos/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  let sql = "UPDATE prospectos SET ";
  const params = [];
  
  Object.keys(updates).forEach((key, idx, arr) => {
    if (key === 'id') return;
    sql += key + " = ?";
    sql += (idx < arr.length - 1) ? ", " : " ";
    let val = updates[key];
    if (key === 'proyectos_interes' && Array.isArray(val)) val = JSON.stringify(val);
    if (key === 'historial' && Array.isArray(val)) val = JSON.stringify(val);
    params.push(val);
  });
  
  sql += "WHERE id = ?";
  params.push(id);
  
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

app.delete('/api/prospectos/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM prospectos WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// ==========================================
// RUTAS PARA ACTIVOS (INVENTARIO)
// ==========================================
app.get('/api/activos', (req, res) => {
  db.all("SELECT * FROM activos", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/activos', (req, res) => {
  const a = req.body;
  const stmt = db.prepare(`INSERT INTO activos (
    id, proyecto, unidad, metros_cuadrados, habitaciones, precio_usd, estado, detalles
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  stmt.run([
    a.id, a.proyecto, a.unidad, a.metros_cuadrados, a.habitaciones, a.precio_usd, 
    a.estado || 'Disponible', a.detalles
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

app.put('/api/activos/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (Object.keys(updates).length === 0) return res.json({ success: true });
  
  let sql = "UPDATE activos SET ";
  const params = [];
  Object.keys(updates).forEach((key, idx, arr) => {
    sql += `${key} = ?`;
    sql += (idx < arr.length - 1) ? ", " : " ";
    params.push(updates[key]);
  });
  
  sql += " WHERE id = ?";
  params.push(id);
  
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

app.delete('/api/activos/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM activos WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Servidor Backend GLP corriendo en http://localhost:${PORT}`);
  console.log(`📊 Bitácora activa en: ${BITACORA_FILE}`);
  console.log(`📧 Borradores activos en: ${DRAFTS_FILE}`);
  console.log(`=================================================`);
});
