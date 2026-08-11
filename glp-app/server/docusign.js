/**
 * docusign.js — Integración de firma digital (DocuSign eSignature REST API, JWT Grant)
 *
 * Requiere (ver .env.example):
 *   DOCUSIGN_INTEGRATION_KEY — Integration Key (Client ID) de la app en DocuSign Admin
 *   DOCUSIGN_USER_ID         — User ID (GUID) del usuario que firma en nombre de GLP
 *   DOCUSIGN_ACCOUNT_ID      — Account ID de DocuSign
 *   DOCUSIGN_PRIVATE_KEY     — Llave privada RSA de la app (formato PEM, con \n literales)
 *   DOCUSIGN_BASE_PATH       — https://account-d.docusign.com (sandbox) o https://account.docusign.com (prod)
 *
 * Sin estas variables configuradas, crearSobre() devuelve { configured: false } en vez de
 * lanzar — el botón "Enviar por DocuSign" en el CRM debe mostrar un aviso claro en ese caso,
 * no fallar en silencio. Mismo patrón de credenciales diferidas usado en whatsapp.js.
 */

const jwt = require('jsonwebtoken');

function credencialesConfiguradas() {
  return !!(
    process.env.DOCUSIGN_INTEGRATION_KEY &&
    process.env.DOCUSIGN_USER_ID &&
    process.env.DOCUSIGN_ACCOUNT_ID &&
    process.env.DOCUSIGN_PRIVATE_KEY
  );
}

// DocuSign JWT Grant: https://developers.docusign.com/platform/auth/jwt-grant/
async function getAccessToken() {
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://account-d.docusign.com';
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY.replace(/\\n/g, '\n');

  const assertion = jwt.sign(
    {
      iss: process.env.DOCUSIGN_INTEGRATION_KEY,
      sub: process.env.DOCUSIGN_USER_ID,
      aud: new URL(basePath).host,
      scope: 'signature impersonation',
    },
    privateKey,
    { algorithm: 'RS256', expiresIn: '1h' }
  );

  const res = await fetch(`${basePath}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Error autenticando con DocuSign');
  return data.access_token;
}

// Crea un sobre de firma para un documento legal. `documentBase64` es el PDF a firmar
// (si no se provee, se envía una carta simple generada en texto — solo para dejar el flujo
// operativo mientras se conecta la subida real de PDFs del punto 6 del plan).
async function crearSobre({ docLabel, firmantes, documentBase64, documentName }) {
  if (!credencialesConfiguradas()) {
    return { configured: false, error: 'DocuSign no está conectado. Configura las variables DOCUSIGN_* en .env para activar el envío real.' };
  }

  try {
    const accessToken = await getAccessToken();
    const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://account-d.docusign.com';
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    // El base path de OAuth y el de la API REST no son el mismo host en DocuSign —
    // se resuelve vía /oauth/userinfo, pero para no añadir una llamada extra usamos
    // el patrón estándar demo/prod ya documentado por DocuSign.
    const apiBase = basePath.includes('account-d')
      ? 'https://demo.docusign.net'
      : 'https://www.docusign.net';

    const envelope = {
      emailSubject: `Firma requerida: ${docLabel} — GLP Wealth Management`,
      documents: [{
        documentBase64: documentBase64 || Buffer.from(`${docLabel}\n\nDocumento generado por GLP CRM para firma electrónica.`).toString('base64'),
        name: documentName || docLabel,
        fileExtension: 'txt',
        documentId: '1',
      }],
      recipients: {
        signers: firmantes.map((f, i) => ({
          email: f.email,
          name: f.name,
          recipientId: String(i + 1),
          routingOrder: String(i + 1),
          tabs: { signHereTabs: [{ anchorString: '/sign/', anchorUnits: 'pixels', anchorXOffset: '20', anchorYOffset: '10' }] },
        })),
      },
      status: 'sent',
    };

    const res = await fetch(`${apiBase}/restapi/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    const data = await res.json();
    if (!res.ok) return { configured: true, error: data.message || 'Error creando el sobre en DocuSign' };

    return { configured: true, envelopeId: data.envelopeId, status: data.status };
  } catch (err) {
    return { configured: true, error: err.message };
  }
}

// Maneja el evento de estado que DocuSign Connect envía al webhook (completed, declined, etc).
// Devuelve los campos a persistir en legal_docs; quien llame decide cómo actualizar la DB.
function parseWebhookEvent(body) {
  const envelopeId = body?.data?.envelopeId || body?.envelopeId;
  const status = body?.data?.envelopeSummary?.status || body?.event || null;
  return { envelopeId, status };
}

module.exports = { credencialesConfiguradas, crearSobre, parseWebhookEvent };
