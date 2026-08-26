/**
 * prospectMonitor.js — Motor de monitoreo de prospectos SARA
 * Detecta prospectos fríos, estancados o con oportunidad y genera alertas + tareas + borradores
 */

const pool = require('./db');

const TENANT_ID = 'tenant-glp-001';

// Umbrales por defecto (días sin actividad → nivel de alerta), usados si no hay
// configuración guardada en business_config. Editable desde Configuración > Reglas de Negocio.
const DEFAULT_THRESHOLDS = {
  'Contacto Inicial': { tibio: 5,  frio: 12, critico: 21 },
  'Calificación':     { tibio: 7,  frio: 14, critico: 25 },
  'Presentación':     { tibio: 7,  frio: 15, critico: 25 },
  'Negociación':      { tibio: 4,  frio: 8,  critico: 15 },
  'Cierre':           { tibio: 2,  frio: 4,  critico: 8  },
  'Post-venta':       { tibio: 14, frio: 30, critico: 60 },
};

async function getThresholds() {
  try {
    const { rows } = await pool.query('SELECT config FROM business_config WHERE tenant_id = $1', [TENANT_ID]);
    if (rows.length > 0 && rows[0].config && rows[0].config.saraThresholds) {
      return { ...DEFAULT_THRESHOLDS, ...rows[0].config.saraThresholds };
    }
  } catch (err) {
    console.error('[Monitor] Error leyendo business_config, usando umbrales por defecto:', err.message);
  }
  return DEFAULT_THRESHOLDS;
}

// Garantiza como máximo UNA alerta 'activa' por prospecto, sin importar cuál de los 3
// jobs de este archivo la dispare (monitorProspects, saraAutoTrigger72h,
// detectColdProspects) — antes cada job insertaba independientemente, así que un mismo
// prospecto podía terminar con 2-3 alertas activas simultáneas (una por job) además del
// problema de duplicados diarios dentro de monitorProspects.
// Devuelve true si se creó/reemplazó una alerta, false si solo se refrescó una existente
// del mismo nivel (sin gastar otra llamada a OpenAI para regenerar el mismo borrador).
async function upsertActiveAlert(prospectoId, nivel, motivo, diasSinActividad, tareas, generateDraft) {
  const { rows: existingActive } = await pool.query(
    `SELECT id, nivel FROM prospect_alerts WHERE prospecto_id = $1 AND status = 'activa' ORDER BY created_at DESC LIMIT 1`,
    [prospectoId]
  );
  if (existingActive.length > 0) {
    const current = existingActive[0];
    if (current.nivel === nivel) {
      await pool.query(
        `UPDATE prospect_alerts SET motivo = $1, dias_sin_actividad = $2, updated_at = NOW() WHERE id = $3`,
        [motivo, diasSinActividad, current.id]
      );
      return false;
    }
    await pool.query(
      `UPDATE prospect_alerts SET status = 'reemplazada', updated_at = NOW() WHERE id = $1`,
      [current.id]
    );
  }
  const draft = await generateDraft();
  const alertId = `alert-${prospectoId}-${Date.now()}`;
  await pool.query(
    `INSERT INTO prospect_alerts (id, tenant_id, prospecto_id, nivel, motivo, dias_sin_actividad, tareas, borrador_asunto, borrador_cuerpo, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'activa',NOW(),NOW())`,
    [alertId, TENANT_ID, prospectoId, nivel, motivo, diasSinActividad, JSON.stringify(tareas || []), draft.asunto, draft.cuerpo]
  );
  return true;
}

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
    const THRESHOLDS = await getThresholds();
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

      const proyectos = Array.isArray(p.proyectos_interes)
        ? p.proyectos_interes
        : JSON.parse(p.proyectos_interes || '[]');
      const tareas = getSuggestedTasks(etapa, nivel, p.nombre, proyectos);

      // Máximo una alerta ACTIVA por prospecto (ver upsertActiveAlert) — antes se
      // comparaba solo contra una ventana de 24h por prospecto+nivel, así que un
      // prospecto inactivo por semanas acumulaba una fila nueva cada día sin que la
      // anterior se cerrara nunca, y al escalar de nivel (tibio→frío→crítico) la alerta
      // vieja tampoco se cerraba — de ahí las decenas de alertas casi idénticas.
      const created = await upsertActiveAlert(p.id, nivel, motivo, diasSinActividad, tareas,
        () => generateRecoveryDraft(p.nombre, p.correo, etapa, nivel, proyectos, diasSinActividad));

      if (created) {
        alertasCreadas++;
        console.log(`[Monitor] ⚠️ Alerta ${nivel.toUpperCase()} creada para ${p.nombre} (${diasSinActividad} días sin actividad)`);
      }
    }

    console.log(`[Monitor] ✅ Análisis completo — ${alertasCreadas} alertas nuevas de ${prospectos.length} prospectos.`);
    return alertasCreadas;
  } catch (err) {
    console.error('[Monitor] Error:', err.message);
    return 0;
  }
}

// ── B.3: Detección de prospectos fríos por score ─────────────────────────────
// Replica la fórmula de getProspectScore() del frontend.
// Score < COLD_THRESHOLD + en sistema ≥ MIN_AGE_DAYS + sara_cold_alert_sent IS NULL
const COLD_THRESHOLD = 28;   // score por debajo = "frío"
const MIN_AGE_DAYS   = 5;    // ignorar prospectos nuevos (< 5 días)

function calcScore(p, maxBudget) {
  const budgetScore  = ((p.presupuesto_usd || 0) / maxBudget) * 40;
  const stageScores  = { 'Contacto Inicial':5,'Calificación':15,'Presentación':25,'Negociación':30,'Cierre':35,'Post-venta':35 };
  const stageScore   = stageScores[p.estado] || 5;
  const lastActivity = new Date(p.fecha_ultima_actividad || p.fecha_registro || Date.now());
  const daysSince    = Math.floor((Date.now() - lastActivity) / 86400000);
  const activityScore = Math.max(0, 15 - daysSince * 1.5);
  const proyectos    = Array.isArray(p.proyectos_interes) ? p.proyectos_interes : JSON.parse(p.proyectos_interes || '[]');
  const projectScore = proyectos.length > 1 ? 10 : 5;
  return Math.min(99, Math.round(budgetScore + stageScore + activityScore + projectScore));
}

async function detectColdProspects() {
  console.log('[Sara·Cold] Detectando prospectos fríos por score...');
  try {
    const { rows: todos } = await pool.query(
      `SELECT * FROM prospectos
       WHERE tenant_id = $1
         AND estado NOT IN ('Post-venta', 'Perdido')
         AND sara_cold_alert_sent IS NULL
         AND fecha_registro < NOW() - INTERVAL '${MIN_AGE_DAYS} days'`,
      [TENANT_ID]
    );

    if (todos.length === 0) {
      console.log('[Sara·Cold] Sin candidatos para revisar.');
      return 0;
    }

    const maxBudget = Math.max(...todos.map(p => p.presupuesto_usd || 0), 1);
    const frios = todos.filter(p => calcScore(p, maxBudget) < COLD_THRESHOLD);

    if (frios.length === 0) {
      console.log('[Sara·Cold] Ningún prospecto bajo el umbral de score.');
      return 0;
    }

    console.log(`[Sara·Cold] ${frios.length} prospecto(s) frío(s) detectado(s).`);
    const nodemailer = require('nodemailer');
    const adminEmail = process.env.ADMIN_EMAIL;
    const resumen = [];

    for (const p of frios) {
      const score = calcScore(p, maxBudget);
      const proyectos = Array.isArray(p.proyectos_interes) ? p.proyectos_interes : JSON.parse(p.proyectos_interes || '[]');
      const diasRegistro = Math.floor((Date.now() - new Date(p.fecha_registro)) / 86400000);
      const diasInactividad = Math.floor((Date.now() - new Date(p.fecha_ultima_actividad || p.fecha_registro)) / 86400000);

      // Generar borrador de reactivación
      const draft = await generateRecoveryDraft(p.nombre, p.correo, p.estado, 'frio', proyectos, diasInactividad);

      // Marcar sara_cold_alert_sent para no repetir esta detección puntual (score bajo
      // umbral) — esto no evita por sí solo que otro job (monitorProspects) también
      // tenga una alerta activa para el mismo prospecto; eso lo resuelve
      // upsertActiveAlert dejando como máximo una activa por prospecto.
      await pool.query(
        'UPDATE prospectos SET sara_cold_alert_sent = NOW() WHERE id = $1',
        [p.id]
      );

      const motivo = `Sara·Cold — Score ${score}/99 (umbral ${COLD_THRESHOLD}) · ${diasRegistro}d en el sistema`;
      await upsertActiveAlert(p.id, 'frio', motivo, diasInactividad, [], () => draft);

      resumen.push({ nombre: p.nombre, correo: p.correo, etapa: p.estado, score, diasInactividad, draft });
      console.log(`[Sara·Cold] ⚠️ ${p.nombre} — score ${score}/99 (${p.estado})`);
    }

    // Notificar admin
    if (adminEmail && process.env.SMTP_USER && process.env.SMTP_PASS && resumen.length > 0) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });

        const filas = resumen.map(r =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${r.nombre}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${r.correo}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${r.etapa}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;color:#f59e0b;font-weight:700">${r.score}/99</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${r.diasInactividad}d</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${r.draft.asunto}</td>
          </tr>`
        ).join('');

        const borradoresHtml = resumen.map(r =>
          `<div style="margin:16px 0;padding:12px;border-left:3px solid #f59e0b;background:#fffbf0">
            <b>${r.nombre} (score ${r.score}) — ${r.draft.asunto}</b><br/><br/>
            <pre style="white-space:pre-wrap;font-family:sans-serif;font-size:13px">${r.draft.cuerpo}</pre>
          </div>`
        ).join('');

        await transporter.sendMail({
          from: `"Sara · GLP CRM" <${process.env.SMTP_USER}>`,
          to: adminEmail,
          subject: `🧊 Sara·Cold — ${resumen.length} prospecto(s) frío(s) detectado(s)`,
          html: `
            <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
              <div style="background:#001A37;color:#D4AF6A;padding:20px;text-align:center">
                <h2 style="margin:0;letter-spacing:2px">SARA · PROSPECTOS FRÍOS</h2>
                <p style="margin:4px 0;font-size:12px;color:#fff;opacity:.8">${new Date().toLocaleDateString('es-CO')} · Score umbral: ${COLD_THRESHOLD}/99</p>
              </div>
              <div style="padding:24px;background:#fff">
                <p>Sara detectó <strong>${resumen.length} prospecto(s) con score bajo el umbral ${COLD_THRESHOLD}/99</strong>. Se generaron borradores de reactivación listos para revisar.</p>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                  <tr style="background:#f3f4f6">
                    <th style="padding:8px;text-align:left">Prospecto</th>
                    <th style="padding:8px;text-align:left">Correo</th>
                    <th style="padding:8px;text-align:left">Etapa</th>
                    <th style="padding:8px;text-align:left">Score</th>
                    <th style="padding:8px;text-align:left">Inactividad</th>
                    <th style="padding:8px;text-align:left">Asunto borrador</th>
                  </tr>
                  ${filas}
                </table>
                <h3 style="color:#001A37;margin-top:28px">Borradores de reactivación</h3>
                ${borradoresHtml}
                <p style="color:#9ca3af;font-size:11px;margin-top:24px">Revisa y aprueba en el CRM → Módulo Sara → Alertas.</p>
              </div>
            </div>`
        });
        console.log(`[Sara·Cold] 📧 Admin notificado — ${resumen.length} prospectos fríos.`);
      } catch (emailErr) {
        console.error('[Sara·Cold] Error enviando email:', emailErr.message);
      }
    }

    return resumen.length;
  } catch (err) {
    console.error('[Sara·Cold] Error:', err.message);
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

      // Máximo una alerta activa por prospecto (ver upsertActiveAlert).
      const motivo = `Sara·72h — ${diasSinActividad} días sin actividad en ${etapa}`;
      await upsertActiveAlert(p.id, nivel, motivo, diasSinActividad, [], () => draft);

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
  detectColdProspects();
  setInterval(monitorProspects, INTERVAL);
  setInterval(saraAutoTrigger72h, INTERVAL);
  setInterval(detectColdProspects, INTERVAL);
}

module.exports = { startProspectMonitor, monitorProspects, saraAutoTrigger72h, detectColdProspects };
