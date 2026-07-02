/**
 * prospectMonitor.js — Motor de monitoreo de prospectos SARA
 * Detecta prospectos fríos, estancados o con oportunidad y genera alertas + tareas + borradores
 */

const pool = require('./db');

const TENANT_ID = 'tenant-glp-001';

// Umbrales por etapa (días sin actividad → nivel de alerta)
// Basado en ciclos de venta inmobiliaria de lujo B2C/B2B
const THRESHOLDS = {
  'Contacto Inicial': { tibio: 2,  frio: 5,  critico: 10 },
  'Calificación':     { tibio: 3,  frio: 7,  critico: 14 },
  'Presentación':     { tibio: 4,  frio: 8,  critico: 15 },
  'Negociación':      { tibio: 2,  frio: 4,  critico: 7  },
  'Cierre':           { tibio: 1,  frio: 2,  critico: 4  },
  'Post-venta':       { tibio: 14, frio: 30, critico: 60 },
};

// Tareas sugeridas por nivel y etapa
function getSuggestedTasks(etapa, nivel, nombre, proyectos) {
  const proyecto = proyectos?.[0] || 'nuestros proyectos';
  const hoy = new Date();
  const dia = (d) => new Date(hoy.getTime() + d * 86400000).toLocaleDateString('es-CO');

  const tasks = {
    tibio: [
      { fecha: dia(0), tipo: 'email',    titulo: `Enviar contenido de valor sobre ${proyecto}`, detalle: 'Ficha técnica actualizada o video del proyecto' },
      { fecha: dia(1), tipo: 'llamada',  titulo: `Llamar a ${nombre} para resolver dudas`, detalle: 'Llamada breve de seguimiento, máx 10 min' },
      { fecha: dia(3), tipo: 'whatsapp', titulo: 'Enviar testimonios de clientes satisfechos', detalle: 'Casos de éxito relevantes al perfil del cliente' },
    ],
    frio: [
      { fecha: dia(0), tipo: 'llamada',  titulo: `Llamada de reactivación urgente a ${nombre}`, detalle: 'Confirmar vigencia del interés y actualizar información' },
      { fecha: dia(0), tipo: 'email',    titulo: 'Enviar propuesta personalizada con incentivo', detalle: 'Incluir condición especial o precio de preventa si aplica' },
      { fecha: dia(2), tipo: 'reunion',  titulo: 'Proponer videollamada de diagnóstico financiero', detalle: 'Presentación de proyección de rentabilidad personalizada' },
      { fecha: dia(5), tipo: 'email',    titulo: 'Email de última oportunidad', detalle: 'Urgencia genuina: unidades disponibles, fechas de cierre' },
    ],
    critico: [
      { fecha: dia(0), tipo: 'llamada',  titulo: `URGENTE: Llamar a ${nombre} hoy`, detalle: 'Prospecto en riesgo crítico de pérdida. Escalar a director comercial.' },
      { fecha: dia(0), tipo: 'email',    titulo: 'Email de rescate con oferta exclusiva', detalle: 'Condición especial reservada para este cliente' },
      { fecha: dia(1), tipo: 'reunion',  titulo: 'Visita o videollamada personalizada', detalle: 'Presentación exclusiva con el director de proyecto' },
      { fecha: dia(2), tipo: 'whatsapp', titulo: 'Mensaje directo del director comercial', detalle: 'Toque personal de alto nivel para recuperar la relación' },
      { fecha: dia(7), tipo: 'decision', titulo: 'Evaluar cierre o archivo del prospecto', detalle: 'Si no hay respuesta, mover a Lista Fría para retomar en 90 días' },
    ],
    oportunidad: [
      { fecha: dia(0), tipo: 'email',    titulo: `Enviar propuesta a medida para ${nombre}`, detalle: 'Basada en su perfil e inquietudes detectadas por SARA' },
      { fecha: dia(1), tipo: 'llamada',  titulo: 'Llamada de profundización', detalle: 'Entender mejor objetivos de inversión y horizonte temporal' },
      { fecha: dia(2), tipo: 'reunion',  titulo: 'Presentación exclusiva del proyecto', detalle: 'Incluir modelo financiero personalizado' },
    ],
  };

  // Personalizar por etapa
  if (etapa === 'Negociación' || etapa === 'Cierre') {
    tasks.frio.unshift({ fecha: dia(0), tipo: 'escalacion', titulo: 'Escalar a director comercial', detalle: 'Negociación activa en riesgo — requiere atención inmediata' });
    tasks.critico.unshift({ fecha: dia(0), tipo: 'escalacion', titulo: 'ALERTA: Negociación en riesgo de caída', detalle: 'Reunión de emergencia con equipo comercial' });
  }

  return tasks[nivel] || tasks.tibio;
}

async function generateRecoveryDraft(nombre, email, etapa, nivel, proyectos, diasSinActividad) {
  const apiKey = process.env.OPENAI_API_KEY;
  const proyecto = proyectos?.[0] || 'nuestros proyectos';

  if (!apiKey) {
    return {
      asunto: `Seguimiento especial — ${proyecto}`,
      cuerpo: `Estimado/a ${nombre},\n\nNos da mucho gusto saludarle. Queremos retomar nuestra conversación sobre ${proyecto} y explorar cómo podemos ayudarle a alcanzar sus objetivos de inversión.\n\nQuedo a su disposición.\n\nSara Valenzuela\nGLP Wealth Management`
    };
  }

  const tono = {
    tibio: 'cálido y de seguimiento natural, sin presión',
    frio: 'proactivo con propuesta de valor concreta y sentido de oportunidad',
    critico: 'personal, directo y con una oferta exclusiva para reactivar la relación',
    oportunidad: 'entusiasta y personalizado, destacando el fit entre el perfil del cliente y el proyecto'
  }[nivel];

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres Sara Valenzuela, Directora de Customer Success de GLP Wealth Management.

Redacta un correo de reactivación para:
- Cliente: ${nombre} (${email})
- Etapa actual: ${etapa}
- Días sin actividad: ${diasSinActividad}
- Proyecto de interés: ${proyecto}
- Nivel de alerta: ${nivel}
- Tono requerido: ${tono}

El correo debe ser sofisticado, personalizado y en español. Máximo 150 palabras.
Firma como Sara Valenzuela, Directora de Customer Success, GLP Wealth Management.

Responde SOLO con JSON: {"asunto":"...","cuerpo":"..."}`
      }],
      temperature: 0.7,
      max_tokens: 400
    });
    const raw = response.choices[0].message.content.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Monitor] Error OpenAI:', err.message);
    return {
      asunto: `Seguimiento — ${proyecto}`,
      cuerpo: `Estimado/a ${nombre},\n\nQuería retomar nuestra conversación sobre ${proyecto}.\n\nQuedo a su disposición.\n\nSara Valenzuela\nGLP Wealth Management`
    };
  }
}

async function monitorProspects() {
  console.log('[Monitor] Iniciando análisis de prospectos...');
  try {
    const { rows: prospectos } = await pool.query(
      `SELECT * FROM prospectos WHERE tenant_id = $1 AND estado NOT IN ('Post-venta', 'Perdido')`,
      [TENANT_ID]
    );

    const now = new Date();
    let alertasCreadas = 0;

    for (const p of prospectos) {
      const ultimaActividad = new Date(p.fecha_ultima_actividad || p.fecha_registro);
      const diasSinActividad = Math.floor((now - ultimaActividad) / 86400000);
      const etapa = p.estado || 'Contacto Inicial';
      const thresh = THRESHOLDS[etapa] || THRESHOLDS['Contacto Inicial'];

      let nivel = null;
      let motivo = '';

      // Detectar nivel
      if (diasSinActividad >= thresh.critico) {
        nivel = 'critico';
        motivo = `Sin actividad por ${diasSinActividad} días en etapa ${etapa}`;
      } else if (diasSinActividad >= thresh.frio) {
        nivel = 'frio';
        motivo = `${diasSinActividad} días sin contacto en ${etapa}`;
      } else if (diasSinActividad >= thresh.tibio) {
        nivel = 'tibio';
        motivo = `Actividad reducida — ${diasSinActividad} días en ${etapa}`;
      }

      // Detectar oportunidad: presupuesto alto + etapa temprana + reciente
      if (!nivel && p.presupuesto_usd >= 300000 && ['Contacto Inicial', 'Calificación'].includes(etapa) && diasSinActividad <= 3) {
        nivel = 'oportunidad';
        motivo = `Prospecto de alto valor ($${p.presupuesto_usd.toLocaleString()}) en etapa inicial — ventana de oportunidad`;
      }

      if (!nivel) continue;

      // Verificar si ya existe alerta activa reciente para este prospecto y nivel
      const { rows: existing } = await pool.query(
        `SELECT id FROM prospect_alerts WHERE prospecto_id = $1 AND nivel = $2 AND status = 'activa' AND created_at > NOW() - INTERVAL '24 hours'`,
        [p.id, nivel]
      );
      if (existing.length > 0) continue;

      const proyectos = Array.isArray(p.proyectos_interes)
        ? p.proyectos_interes
        : JSON.parse(p.proyectos_interes || '[]');

      const tareas = getSuggestedTasks(etapa, nivel, p.nombre, proyectos);
      const draft = await generateRecoveryDraft(p.nombre, p.correo, etapa, nivel, proyectos, diasSinActividad);

      const alertId = `alert-${p.id}-${Date.now()}`;
      await pool.query(
        `INSERT INTO prospect_alerts (id, tenant_id, prospecto_id, nivel, motivo, dias_sin_actividad, tareas, borrador_asunto, borrador_cuerpo, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'activa',NOW(),NOW())`,
        [alertId, TENANT_ID, p.id, nivel, motivo, diasSinActividad,
         JSON.stringify(tareas), draft.asunto, draft.cuerpo]
      );

      alertasCreadas++;
      console.log(`[Monitor] ⚠️ Alerta ${nivel.toUpperCase()} creada para ${p.nombre} (${diasSinActividad} días sin actividad)`);
    }

    console.log(`[Monitor] ✅ Análisis completo — ${alertasCreadas} alertas nuevas de ${prospectos.length} prospectos.`);
    return alertasCreadas;
  } catch (err) {
    console.error('[Monitor] Error:', err.message);
    return 0;
  }
}

// ── B.1: Trigger autónomo Sara — inactividad 72h ─────────────────────────────
// Por cada prospecto inactivo ≥72h donde sara_auto_email_sent IS NULL:
// genera un borrador personalizado, marca el timestamp y notifica al admin.
async function saraAutoTrigger72h() {
  const HOURS_72 = 72;
  console.log('[Sara·72h] Revisando prospectos inactivos ≥72h...');
  try {
    const { rows: inactivos } = await pool.query(
      `SELECT * FROM prospectos
       WHERE tenant_id = $1
         AND estado NOT IN ('Post-venta', 'Perdido')
         AND sara_auto_email_sent IS NULL
         AND COALESCE(fecha_ultima_actividad, fecha_registro) < NOW() - INTERVAL '${HOURS_72} hours'`,
      [TENANT_ID]
    );

    if (inactivos.length === 0) {
      console.log('[Sara·72h] Sin prospectos nuevos que atender.');
      return 0;
    }

    console.log(`[Sara·72h] ${inactivos.length} prospecto(s) para atender.`);
    const nodemailer = require('nodemailer');
    const adminEmail = process.env.ADMIN_EMAIL;
    let resumen = [];

    for (const p of inactivos) {
      const ultimaActividad = new Date(p.fecha_ultima_actividad || p.fecha_registro);
      const diasSinActividad = Math.floor((Date.now() - ultimaActividad) / 86400000);
      const etapa = p.estado || 'Contacto Inicial';
      const proyectos = Array.isArray(p.proyectos_interes)
        ? p.proyectos_interes
        : JSON.parse(p.proyectos_interes || '[]');

      // Nivel basado en días: ≥7d = frio, ≥14d = critico, resto = tibio
      const nivel = diasSinActividad >= 14 ? 'critico' : diasSinActividad >= 7 ? 'frio' : 'tibio';
      const draft = await generateRecoveryDraft(p.nombre, p.correo, etapa, nivel, proyectos, diasSinActividad);

      // Marcar en la tabla de prospectos
      await pool.query(
        `UPDATE prospectos SET sara_auto_email_sent = NOW() WHERE id = $1`,
        [p.id]
      );

      // Guardar alerta con tipo 'sara_auto'
      const alertId = `sara72h-${p.id}-${Date.now()}`;
      await pool.query(
        `INSERT INTO prospect_alerts
           (id, tenant_id, prospecto_id, nivel, motivo, dias_sin_actividad,
            tareas, borrador_asunto, borrador_cuerpo, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'activa',NOW(),NOW())
         ON CONFLICT (id) DO NOTHING`,
        [alertId, TENANT_ID, p.id, nivel,
         `Sara·72h — ${diasSinActividad} días sin actividad en ${etapa}`,
         diasSinActividad, JSON.stringify([]), draft.asunto, draft.cuerpo]
      );

      resumen.push({ nombre: p.nombre, correo: p.correo, etapa, diasSinActividad, nivel, draft });
      console.log(`[Sara·72h] ✅ Borrador generado para ${p.nombre} (${diasSinActividad}d, ${nivel})`);
    }

    // Notificar al admin por email si hay SMTP configurado
    if (adminEmail && process.env.SMTP_USER && process.env.SMTP_PASS && resumen.length > 0) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        const listaHtml = resumen.map(r =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${r.nombre}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${r.correo}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${r.etapa}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;color:${r.nivel==='critico'?'#dc2626':r.nivel==='frio'?'#f59e0b':'#6b7280'}">${r.diasSinActividad}d · ${r.nivel}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${r.draft.asunto}</td>
          </tr>`
        ).join('');

        const borradoresHtml = resumen.map(r =>
          `<div style="margin:16px 0;padding:12px;border-left:3px solid #b89047;background:#fafaf7">
            <b>${r.nombre} — ${r.draft.asunto}</b><br/><br/>
            <pre style="white-space:pre-wrap;font-family:sans-serif;font-size:13px">${r.draft.cuerpo}</pre>
          </div>`
        ).join('');

        await transporter.sendMail({
          from: `"Sara · GLP CRM" <${process.env.SMTP_USER}>`,
          to: adminEmail,
          subject: `🤖 Sara Auto·72h — ${resumen.length} borrador(es) generado(s)`,
          html: `
            <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
              <div style="background:#001A37;color:#D4AF6A;padding:20px;text-align:center">
                <h2 style="margin:0;letter-spacing:2px">SARA · TRIGGER AUTÓNOMO 72H</h2>
                <p style="margin:4px 0;font-size:13px;color:#fff;opacity:.8">GLP Wealth Management · ${new Date().toLocaleDateString('es-CO')}</p>
              </div>
              <div style="padding:24px;background:#fff">
                <p>Sara detectó <strong>${resumen.length} prospecto(s)</strong> sin actividad ≥72h y generó borradores personalizados listos para revisar y enviar.</p>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                  <tr style="background:#f3f4f6">
                    <th style="padding:8px;text-align:left">Prospecto</th>
                    <th style="padding:8px;text-align:left">Correo</th>
                    <th style="padding:8px;text-align:left">Etapa</th>
                    <th style="padding:8px;text-align:left">Estado</th>
                    <th style="padding:8px;text-align:left">Asunto borrador</th>
                  </tr>
                  ${listaHtml}
                </table>
                <h3 style="color:#001A37;margin-top:28px">Borradores generados</h3>
                ${borradoresHtml}
                <p style="color:#9ca3af;font-size:11px;margin-top:24px">Estos borradores están guardados en el CRM bajo Alertas de Prospectos. Revisa y aprueba antes de enviar.</p>
              </div>
            </div>`
        });
        console.log(`[Sara·72h] 📧 Notificación enviada a ${adminEmail}`);
      } catch (emailErr) {
        console.error('[Sara·72h] Error enviando email al admin:', emailErr.message);
      }
    }

    return resumen.length;
  } catch (err) {
    console.error('[Sara·72h] Error:', err.message);
    return 0;
  }
}

function startProspectMonitor() {
  const INTERVAL = 60 * 60 * 1000; // cada hora
  console.log('[Monitor] Motor de monitoreo SARA iniciado — análisis cada 60 min.');
  monitorProspects();
  saraAutoTrigger72h();
  setInterval(monitorProspects, INTERVAL);
  setInterval(saraAutoTrigger72h, INTERVAL);
}

module.exports = { startProspectMonitor, monitorProspects, saraAutoTrigger72h };
