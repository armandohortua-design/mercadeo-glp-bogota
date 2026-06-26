const nodemailer = require('nodemailer');
require('dotenv').config();

console.log("=========================================");
console.log("🧪 PROBADOR DE CONEXIÓN SMTP - GLP");
console.log("=========================================");
console.log("Usuario SMTP:", process.env.SMTP_USER);
console.log("Contraseña SMTP configurada:", process.env.SMTP_PASS ? "SÍ (configurada)" : "NO");

if (!process.env.SMTP_USER || process.env.SMTP_PASS === "tu_contraseña_de_aplicacion_gmail") {
  console.error("❌ ERROR: Por favor configura tus credenciales SMTP reales en el archivo .env antes de probar.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const mailOptions = {
  from: `"Prueba GLP" <${process.env.SMTP_USER}>`,
  to: process.env.SMTP_USER, // Se auto-envía para probar
  subject: 'Prueba de Conexión de Email - GLP CRM 🚀',
  html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; max-width: 600px; background-color: #fafafa;">
      <h2 style="color: #0d9488;">¡Prueba de Correo Exitosa! 🎉</h2>
      <p>Hola Armando,</p>
      <p>Este es un correo automático enviado para validar que tu <strong>Contraseña de Aplicación de Gmail</strong> se ha configurado de manera correcta.</p>
      <div style="padding: 15px; background-color: #ECFDF5; border-left: 4px solid #10B981; border-radius: 4px; margin: 20px 0;">
        <span style="color: #065F46; font-weight: bold;">✓ Conexión establecida con éxito con SMTP de Gmail.</span>
      </div>
      <p>A partir de ahora, las notificaciones y los correos comerciales automáticos de la landing page funcionarán correctamente.</p>
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #6b7280;">Mensaje de diagnóstico de la plataforma inmobiliaria GLP.</p>
    </div>
  `
};

console.log("Enviando correo de prueba a:", process.env.SMTP_USER, "...");
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("❌ ERROR AL ENVIAR CORREO:", error.message);
    console.log("\n💡 Sugerencia: Asegúrate de tener habilitada la verificación en 2 pasos en Gmail y haber creado una Contraseña de Aplicación de 16 caracteres.");
    process.exit(1);
  } else {
    console.log("✅ ¡CORREO DE PRUEBA ENVIADO CON ÉXITO!");
    console.log("ID del mensaje:", info.messageId);
    process.exit(0);
  }
});
