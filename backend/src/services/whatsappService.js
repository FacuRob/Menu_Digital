// WhatsApp Cloud API (oficial de Meta). HTTP puro: sin QR, sin sockets,
// funciona en Render free.
//
// Fase 1 (opción A): un único número de la plataforma para todos los
// negocios, configurado por env. Más adelante (opción B) cada negocio podrá
// conectar su número: bastará con que credenciales() devuelva las suyas.
//
//   WHATSAPP_TOKEN            token permanente (System User de Meta)
//   WHATSAPP_PHONE_NUMBER_ID  id del número emisor
//   WHATSAPP_API_VERSION      opcional (default v21.0)
//   WHATSAPP_DEFAULT_CC       código de país por defecto (default 54)

const API_VERSION = () => process.env.WHATSAPP_API_VERSION || "v21.0";

// Credenciales del número emisor (hoy, el de la plataforma).
const credenciales = () => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return token && phoneNumberId ? { token, phoneNumberId } : null;
};

const estaConfigurado = () => !!credenciales();

// Normaliza un teléfono al formato internacional que pide WhatsApp (solo
// dígitos, con código de país).
//
// Argentina: se envía como 54 + 10 dígitos, SIN el 9 de móvil. Meta lo
// convierte solo al WhatsApp real (wa_id 549…), y es el formato que acepta
// la lista de destinatarios del número de prueba (con el 9 la rechaza: #131030).
//   "381 505-2050"      → "543815052050"
//   "+54 9 381 5052050" → "543815052050"
//   "0381 15 505-2050"  → "543815052050"
function normalizarTelefono(raw) {
  if (!raw) return null;
  let num = String(raw).replace(/\D/g, "");
  if (!num) return null;
  const cc = process.env.WHATSAPP_DEFAULT_CC || "54";

  if (cc === "54") {
    if (num.startsWith("549") && num.length === 13) num = num.slice(3);
    else if (num.startsWith("54") && num.length === 12) num = num.slice(2);
    num = num.replace(/^0/, "");
    // Formato local viejo con "15" después del código de área (2 a 4 dígitos).
    const m = num.match(/^(\d{2,4})15(\d{6,8})$/);
    if (m && (m[1] + m[2]).length === 10) num = m[1] + m[2];
    // Móvil escrito con el 9 adelante sin código de país ("9 381 505-2050").
    if (num.length === 11 && num.startsWith("9")) num = num.slice(1);
    return num.length === 10 ? `54${num}` : null;
  }
  if (num.startsWith(cc)) return num;
  return `${cc}${num.replace(/^0/, "")}`;
}

async function enviarPayload(payload) {
  const cred = credenciales();
  if (!cred) return { ok: false, error: "WhatsApp no está configurado" };
  const url = `https://graph.facebook.com/${API_VERSION()}/${cred.phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: json?.error?.message || `HTTP ${resp.status}` };
    }
    return { ok: true, id: json?.messages?.[0]?.id || null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Plantilla aprobada por Meta: única vía para escribirle a alguien que no
// nos escribió en las últimas 24 h (caso de los avisos de pedido).
async function enviarPlantilla(telefono, { nombre, idioma, parametros = [] }) {
  const to = normalizarTelefono(telefono);
  if (!to) return { ok: false, error: "Teléfono inválido" };
  return enviarPayload({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: nombre,
      language: { code: idioma || process.env.WHATSAPP_TEMPLATE_IDIOMA || "es_AR" },
      components: [
        {
          type: "body",
          parameters: parametros.map((p) => ({ type: "text", text: String(p) })),
        },
      ],
    },
  });
}

// Texto libre: solo se permite dentro de las 24 h desde el último mensaje
// que nos escribió el cliente (respuestas desde el chat del panel).
async function enviarTexto(telefono, texto) {
  const to = normalizarTelefono(telefono);
  if (!to) return { ok: false, error: "Teléfono inválido" };
  return enviarPayload({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: String(texto), preview_url: false },
  });
}

module.exports = { enviarPlantilla, enviarTexto, normalizarTelefono, estaConfigurado };
