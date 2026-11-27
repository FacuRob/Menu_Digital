// Audios de WhatsApp → texto, para que la IA (y el local en el panel) sepan
// qué dijo el cliente.
//
// Usa una API compatible con OpenAI (/audio/transcriptions). Por defecto,
// Whisper de Groq, que tiene plan gratis.
//   TRANSCRIPCION_API_KEY  clave (sin ella los audios quedan como "🎤 Audio")
//   TRANSCRIPCION_URL      default https://api.groq.com/openai/v1
//   TRANSCRIPCION_MODEL    default whisper-large-v3-turbo
//
// El audio se baja de Meta (con el token del número) o de Evolution (QR).
const MAX_BYTES = 10 * 1024 * 1024; // un audio de varios minutos pesa ~1 MB
const URL_BASE = () =>
  String(process.env.TRANSCRIPCION_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const MODELO = () => process.env.TRANSCRIPCION_MODEL || "whisper-large-v3-turbo";
const configurada = () => !!process.env.TRANSCRIPCION_API_KEY;

const EXTENSIONES = { ogg: "ogg", opus: "ogg", mpeg: "mp3", mp3: "mp3", mp4: "m4a", m4a: "m4a", aac: "m4a", amr: "amr", wav: "wav", webm: "webm" };
const extension = (mime) => {
  const sub = String(mime || "").split(";")[0].split("/")[1] || "";
  return EXTENSIONES[sub.toLowerCase()] || "ogg";
};

// Meta: id del audio → URL temporal → archivo (las dos con el token).
async function bajarDeMeta(mediaId, negocioId) {
  const { credencialesDe } = require("./whatsappCuentas");
  const cred = await credencialesDe(negocioId);
  if (!cred?.token) throw new Error("sin token de Meta");
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const auth = { Authorization: `Bearer ${cred.token}` };
  const info = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`, {
    headers: auth,
    signal: AbortSignal.timeout(15000),
  }).then((r) => r.json());
  if (!info?.url) throw new Error(info?.error?.message || "Meta no devolvió el audio");
  if (Number(info.file_size) > MAX_BYTES) throw new Error("audio demasiado largo");
  const resp = await fetch(info.url, { headers: auth, signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`descarga HTTP ${resp.status}`);
  return { buffer: Buffer.from(await resp.arrayBuffer()), mime: info.mime_type };
}

// Evolution (WhatsApp por QR): pide el archivo por el id del mensaje.
async function bajarDeQR(mensajeId, negocioId) {
  const qr = require("./whatsappQR");
  const r = await qr.evo(`/chat/getBase64FromMediaMessage/${qr.nombreInstancia(negocioId)}`, {
    method: "POST",
    body: { message: { key: { id: mensajeId } }, convertToMp4: false },
  });
  if (!r?.base64) throw new Error("Evolution no devolvió el audio");
  return { buffer: Buffer.from(String(r.base64).replace(/^data:[^,]*,/, ""), "base64"), mime: r.mimetype };
}

async function transcribirArchivo({ buffer, mime }) {
  if (!buffer?.length) throw new Error("audio vacío");
  if (buffer.length > MAX_BYTES) throw new Error("audio demasiado largo");
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime || "audio/ogg" }), `audio.${extension(mime)}`);
  form.append("model", MODELO());
  form.append("language", "es");
  form.append("response_format", "json");
  const resp = await fetch(`${URL_BASE()}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TRANSCRIPCION_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error?.message || `transcripción HTTP ${resp.status}`);
  return String(json.text || "").replace(/\s+/g, " ").trim();
}

// Texto de un audio entrante (formato Meta), o null si no se pudo.
// Nunca lanza.
async function transcribirAudio(m, negocioId) {
  if (!configurada() || m?.type !== "audio") return null;
  try {
    const archivo = m.audio?.id ? await bajarDeMeta(m.audio.id, negocioId) : await bajarDeQR(m.id, negocioId);
    return (await transcribirArchivo(archivo)) || null;
  } catch (e) {
    console.warn(`[Audio] No se pudo pasar a texto el audio ${m?.id}: ${e.message}`);
    return null;
  }
}

module.exports = { configurada, transcribirAudio, transcribirArchivo, extension };
