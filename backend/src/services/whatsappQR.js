// WhatsApp común conectado con código QR, a través de Evolution API
// (https://github.com/evolution-foundation/evolution-api, servidor aparte).
//
// Es la alternativa al número propio de Meta: el local escanea un QR (o pone
// un código de 8 letras) desde "Dispositivos vinculados" de su WhatsApp y
// listo. Los avisos y el asistente con IA salen desde su número, y él sigue
// usando WhatsApp en el celular como siempre.
//
// Cada local = una instancia de Evolution llamada "dinex-<negocioId>".
//
// Variables (Render):
//   EVOLUTION_API_URL         URL del servidor de Evolution (ej. https://evo.dinexflow.com.ar)
//   EVOLUTION_API_KEY         AUTHENTICATION_API_KEY de ese servidor
//   EVOLUTION_WEBHOOK_URL     opcional: URL pública de ESTE backend (default BACKEND_URL
//                             o https://backend-menu-digital.onrender.com)
//   EVOLUTION_WEBHOOK_SECRET  opcional: clave de la firma del webhook (default: deriva de JWT_SECRET)
const crypto = require("crypto");
const supabase = require("../config/database");

const BASE = () => String(process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const disponible = () => !!(BASE() && process.env.EVOLUTION_API_KEY);
const WEBHOOK_URL = () =>
  `${String(process.env.EVOLUTION_WEBHOOK_URL || process.env.BACKEND_URL || "https://backend-menu-digital.onrender.com").replace(/\/+$/, "")}/api/webhooks/evolution`;

const nombreInstancia = (negocioId) => `dinex-${Number(negocioId)}`;

// Firma por instancia: Evolution la manda en un header en cada aviso, así
// nadie puede hacerse pasar por el WhatsApp de un local.
// Sin ninguna clave configurada no se firma (y no se aceptan avisos).
const firma = (instancia) => {
  const secreto = process.env.EVOLUTION_WEBHOOK_SECRET || process.env.JWT_SECRET;
  if (!secreto) throw new Error("Falta EVOLUTION_WEBHOOK_SECRET");
  return crypto.createHmac("sha256", `${secreto}:evolution`).update(String(instancia)).digest("hex");
};

const firmaValida = (instancia, recibida) => {
  if (!instancia || typeof recibida !== "string") return false;
  let esperada;
  try {
    esperada = firma(instancia);
  } catch {
    return false;
  }
  const a = Buffer.from(esperada);
  const b = Buffer.from(recibida);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// ── Llamadas a Evolution ──
async function evo(ruta, { method = "GET", body } = {}) {
  if (!disponible()) throw Object.assign(new Error("La conexión por QR no está habilitada."), { status: 503 });
  const resp = await fetch(`${BASE()}${ruta}`, {
    method,
    headers: { apikey: process.env.EVOLUTION_API_KEY, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.error === true) {
    const m = json?.response?.message ?? json?.message;
    const txt = (x) => (typeof x === "string" ? x : JSON.stringify(x));
    const e = new Error((Array.isArray(m) ? m.map(txt).join(" ") : m && txt(m)) || `HTTP ${resp.status}`);
    e.status = resp.status;
    throw e;
  }
  return json;
}

// ── Base de datos (con caché corta: se consulta en cada envío) ──
const TTL_MS = 30 * 1000;
const cache = new Map(); // negocioId → { valor, expira }
const olvidar = (negocioId) => (negocioId ? cache.delete(Number(negocioId)) : cache.clear());

const sinTabla = (e) => e?.code === "42P01" || e?.code === "PGRST205" || /does not exist|schema cache/i.test(e?.message || "");

// Fila del local, null si no tiene, o undefined si la BD falló.
async function cuentaQR(negocioId) {
  if (!negocioId) return null;
  const k = Number(negocioId);
  const hit = cache.get(k);
  if (hit && hit.expira > Date.now()) return hit.valor;
  try {
    const { data, error } = await supabase.from("whatsapp_qr").select("*").eq("negocio_id", k).maybeSingle();
    if (error && !sinTabla(error)) throw error;
    const valor = !error && data ? data : null;
    cache.set(k, { valor, expira: Date.now() + TTL_MS });
    return valor;
  } catch (e) {
    console.error("[WhatsApp QR] No se pudo leer whatsapp_qr:", e.message);
    return undefined;
  }
}

async function guardar(negocioId, cambios) {
  const fila = { negocio_id: Number(negocioId), instancia: nombreInstancia(negocioId), ...cambios, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("whatsapp_qr").upsert(fila, { onConflict: "negocio_id" });
  if (error) throw error;
  olvidar(negocioId);
}

const soloDigitos = (jid) => String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, "");

// "5493815052050" → "+54 9 3815052050" (más fácil de reconocer).
const telefonoVisible = (d) =>
  !d ? null : /^549\d{10}$/.test(d) ? `+54 9 ${d.slice(3)}` : `+${d}`;

// Lo que ve el panel.
const publica = (c) =>
  c && {
    estado: c.estado,
    telefono: telefonoVisible(c.telefono),
    nombre_visible: c.nombre_visible || null,
    conectado_at: c.conectado_at || null,
  };

// El QR / código que muestra Evolution (sólo lo que el panel necesita).
const codigoDe = (q) =>
  q && {
    qr: typeof q.base64 === "string" && q.base64.startsWith("data:image/") ? q.base64 : null,
    codigo: typeof q.pairingCode === "string" && q.pairingCode ? q.pairingCode : null,
  };

// Arranca (o vuelve a arrancar) la vinculación. Con `telefono` pide un código
// de 8 letras en lugar del QR (sirve si el panel está abierto en el mismo
// celular que tiene WhatsApp, donde no se puede escanear).
// Un solo arranque a la vez por local (doble clic, dos pestañas).
const arrancando = new Map();
function iniciar(negocioId, opciones = {}) {
  const k = Number(negocioId);
  if (arrancando.has(k)) return arrancando.get(k);
  const p = iniciarUnaVez(k, opciones).finally(() => arrancando.delete(k));
  arrancando.set(k, p);
  return p;
}

async function iniciarUnaVez(negocioId, { telefono } = {}) {
  const instancia = nombreInstancia(negocioId);
  const numero = telefono ? soloDigitos(telefono) : "";
  if (telefono && !/^\d{10,15}$/.test(numero)) {
    throw Object.assign(new Error("Revisá el número: escribilo con el código de área, por ejemplo 381 505 2050."), { status: 400, propio: true });
  }
  // Antes de borrar la sesión vieja ya queda "vinculando" (conserva
  // conectado_at: si ya lo usaba, mientras tanto no se manda desde otro número).
  await guardar(negocioId, { estado: "vinculando" });
  // Siempre de cero: así no queda una sesión vieja a medias.
  await evo(`/instance/delete/${instancia}`, { method: "DELETE" }).catch(() => {});
  const r = await evo("/instance/create", {
    method: "POST",
    body: {
      instanceName: instancia,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      ...(numero ? { number: numero } : {}),
      groupsIgnore: true, // los grupos del local no son clientes
      rejectCall: false,
      alwaysOnline: false,
      readMessages: false,
      syncFullHistory: false,
      webhook: {
        enabled: true,
        url: WEBHOOK_URL(),
        byEvents: false,
        base64: false,
        headers: { "x-dinex-firma": firma(instancia) },
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      },
    },
  });
  return codigoDe(r.qrcode) || { qr: null, codigo: null };
}

// Estado para el panel. Mientras se vincula, pregunta a Evolution y, si ya
// se conectó, lo guarda. Devuelve { cuenta, qr?, codigo? }.
async function estado(negocioId) {
  const c = await cuentaQR(negocioId);
  if (c === undefined) throw new Error("No se pudo leer la conexión.");
  if (!c || !disponible()) return { cuenta: publica(c) };

  let state;
  try {
    state = (await evo(`/instance/connectionState/${c.instancia}`))?.instance?.state;
  } catch (e) {
    // La instancia ya no existe en Evolution (se borró o se reinició el servidor).
    if (e.status === 404 && c.estado !== "desconectado") {
      await guardar(negocioId, { estado: c.estado === "conectado" ? "desconectado" : "vinculando" });
    }
    return { cuenta: publica(await cuentaQR(negocioId)) };
  }

  if (state === "open") {
    if (c.estado !== "conectado") await marcarConectado(negocioId, c.instancia);
    return { cuenta: publica(await cuentaQR(negocioId)) };
  }
  if (c.estado === "conectado" && state === "close") {
    await guardar(negocioId, { estado: "desconectado" });
    return { cuenta: publica(await cuentaQR(negocioId)) };
  }
  if (c.estado === "vinculando") {
    // "connecting": Evolution devuelve el QR vigente (se renueva solo).
    const q = await evo(`/instance/connect/${c.instancia}`).catch(() => null);
    return { cuenta: publica(c), ...(codigoDe(q) || {}) };
  }
  return { cuenta: publica(c) };
}

async function marcarConectado(negocioId, instancia, datos = {}) {
  let { wuid, profileName } = datos;
  if (!wuid) {
    const lista = await evo(`/instance/fetchInstances?instanceName=${encodeURIComponent(instancia)}`).catch(() => []);
    const i = (Array.isArray(lista) ? lista : [lista]).find((x) => x?.name === instancia || x?.instance?.instanceName === instancia);
    wuid = i?.ownerJid || i?.instance?.owner;
    profileName = profileName || i?.profileName || i?.instance?.profileName;
  }
  await guardar(negocioId, {
    estado: "conectado",
    telefono: soloDigitos(wuid) || null,
    nombre_visible: profileName ? String(profileName).slice(0, 120) : null,
    conectado_at: new Date().toISOString(),
  });
}

// Deja de usar el WhatsApp: cierra la sesión en Evolution (en el celular
// desaparece de "Dispositivos vinculados") y borra la fila.
// Si Evolution no responde, no se borra la fila: se puede volver a intentar.
async function desconectar(negocioId) {
  const instancia = nombreInstancia(negocioId);
  if (disponible()) {
    // 400/404: la sesión ya estaba cerrada o la instancia no existe.
    const yaNoEsta = (e) => {
      if (![400, 404].includes(e.status)) throw e;
    };
    await evo(`/instance/logout/${instancia}`, { method: "DELETE" }).catch(yaNoEsta);
    await evo(`/instance/delete/${instancia}`, { method: "DELETE" }).catch(yaNoEsta);
  }
  const { error } = await supabase.from("whatsapp_qr").delete().eq("negocio_id", Number(negocioId));
  if (error && !sinTabla(error)) throw error;
  olvidar(negocioId);
}

// Ids que mandamos nosotros hace poco: su "eco" (fromMe) no es del dueño.
const enviadosRecien = new Map();
const ECO_MS = 10 * 60 * 1000;
function lomandamosNosotros(id) {
  const ahora = Date.now();
  for (const [k, t] of enviadosRecien) if (ahora - t > ECO_MS) enviadosRecien.delete(k);
  return enviadosRecien.has(id);
}

// Envía un texto desde el WhatsApp del local. `to`: teléfono normalizado
// (54 + 10 dígitos); Evolution busca solo el número real de WhatsApp.
async function enviarTexto(instancia, to, texto) {
  try {
    const r = await evo(`/message/sendText/${instancia}`, {
      method: "POST",
      body: { number: String(to), text: String(texto), linkPreview: false },
    });
    if (r?.key?.id) enviadosRecien.set(r.key.id, Date.now());
    return { ok: true, id: r?.key?.id || null };
  } catch (e) {
    return { ok: false, error: /not.?exist|exists":false/i.test(e.message) ? "Ese número no tiene WhatsApp." : e.message };
  }
}

// ── Webhook: Evolution → formato de Meta (así se reutilizan chats e IA) ──

// Teléfono del cliente de un mensaje (null = grupo, estado, o sin número).
function telefonoDe(key = {}) {
  const jid = [key.remoteJid, key.remoteJidAlt, key.senderPn].find((j) => /@s\.whatsapp\.net$/.test(String(j || "")));
  return jid ? soloDigitos(jid) : null;
}

// Baileys envuelve algunos mensajes (temporales, ver una vez, editados…).
const desenvolver = (m = {}) => {
  for (let i = 0; i < 3; i++) {
    const dentro =
      m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message ||
      m.viewOnceMessageV2Extension?.message || m.deviceSentMessage?.message || m.editedMessage?.message ||
      m.documentWithCaptionMessage?.message;
    if (!dentro) break;
    m = dentro;
  }
  return m;
};

// Un mensaje de Baileys como los que manda Meta ({ type, text, image, … }).
function aFormatoMeta(d, ts) {
  const m = desenvolver(d.message || {});
  const base = { id: d.key?.id, timestamp: String(Math.floor(ts / 1000)) };
  const texto = m.conversation || m.extendedTextMessage?.text;
  if (texto) return { ...base, type: "text", text: { body: texto } };
  if (m.imageMessage) return { ...base, type: "image", image: { caption: m.imageMessage.caption } };
  if (m.videoMessage) return { ...base, type: "video", video: { caption: m.videoMessage.caption } };
  if (m.audioMessage) return { ...base, type: "audio" };
  if (m.documentMessage) return { ...base, type: "document", document: { filename: m.documentMessage.fileName } };
  if (m.stickerMessage) return { ...base, type: "sticker" };
  if (m.locationMessage || m.liveLocationMessage) return { ...base, type: "location" };
  if (m.reactionMessage) return { ...base, type: "reaction", reaction: { emoji: m.reactionMessage.text } };
  if (m.buttonsResponseMessage) return { ...base, type: "button", button: { text: m.buttonsResponseMessage.selectedDisplayText } };
  if (m.listResponseMessage) return { ...base, type: "interactive", interactive: { list_reply: { title: m.listResponseMessage.title } } };
  return null; // mensajes de sistema (protocolo, borrados, etc.): se ignoran
}

// Tope por si Render estuvo dormido: más de 6 h no se contesta.
const ANTIGUEDAD_MAX_MS = 6 * 60 * 60 * 1000;

// "messageTimestamp" puede venir como número, texto o Long ({ low, high }).
const msDe = (t) => {
  const n = Number(t?.low ?? t);
  return Number.isFinite(n) && n > 0 ? n * 1000 : Date.now();
};

// Traduce un aviso de Evolution. Devuelve { tipo, ... } o null si no interesa.
// `desde`: cuándo se conectó el local (lo anterior es historial que manda
// WhatsApp al vincular: no se guarda ni se contesta).
//   { tipo: "entrante", value }   → chats.registrarEntrantes
//   { tipo: "eco", value }        → chats.registrarEcos (lo escribió el dueño desde el celular)
//   { tipo: "conexion", state, wuid, profileName }
function traducir(body, { desde } = {}) {
  const evento = String(body?.event || "").toLowerCase().replace(/_/g, ".");
  const d = body?.data || {};
  if (evento === "connection.update") {
    return { tipo: "conexion", state: d.state, wuid: d.wuid, profileName: d.profileName };
  }
  if (evento !== "messages.upsert") return null;
  // Al vincular, WhatsApp manda también mensajes viejos: sólo interesan los
  // de ahora (si no, la IA contestaría conversaciones de ayer).
  const ts = msDe(d.messageTimestamp);
  const limite = Math.max(desde ? new Date(desde).getTime() - 60 * 1000 : 0, Date.now() - ANTIGUEDAD_MAX_MS);
  if (ts < limite) return null;
  const tel = telefonoDe(d.key);
  if (!tel) return null;
  const msg = aFormatoMeta(d, ts);
  if (!msg?.id) {
    if (d.messageType) console.warn(`[WhatsApp QR] Mensaje ${d.messageType} sin soporte: se ignora.`);
    return null;
  }
  if (d.key?.fromMe) {
    return { tipo: "eco", value: { message_echoes: [{ ...msg, to: tel }] } };
  }
  return {
    tipo: "entrante",
    value: { contacts: [{ wa_id: tel, profile: { name: d.pushName || null } }], messages: [{ ...msg, from: tel }] },
  };
}

module.exports = {
  disponible,
  nombreInstancia,
  firma,
  firmaValida,
  cuentaQR,
  publica,
  iniciar,
  estado,
  marcarConectado,
  guardar,
  desconectar,
  enviarTexto,
  lomandamosNosotros,
  traducir,
  olvidar,
};
