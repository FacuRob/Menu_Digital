// Chats de WhatsApp (Fase 2): los mensajes que escribe el cliente llegan por
// el webhook de Meta y se guardan acá; el negocio responde desde el panel.
//
// Hoy hay un único número de la plataforma para todos los negocios, así que
// un mensaje entrante se asigna al negocio con el que ese teléfono ya habló
// (un aviso o un chat previo) o, si no, al del último pedido con ese teléfono.
//
// Regla de Meta: el texto libre solo se puede mandar dentro de las 24 h desde
// el último mensaje del cliente. Pasado ese plazo, solo plantillas.
const supabase = require("../config/database");
const { enviarTexto, normalizarTelefono, estaConfigurado } = require("./whatsappService");

const VENTANA_MS = 24 * 60 * 60 * 1000;
const MAX_TEXTO = 4096; // límite de WhatsApp para un mensaje de texto

const ventanaAbierta = (chat, ahora = Date.now()) =>
  !!chat?.ultimo_entrante_at && ahora - new Date(chat.ultimo_entrante_at).getTime() < VENTANA_MS;

// Texto legible de un mensaje entrante (los que no son texto se resumen).
function textoDeMensaje(m) {
  switch (m?.type) {
    case "text":
      return m.text?.body || "";
    case "button":
      return m.button?.text || "";
    case "interactive":
      return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
    case "image":
      return m.image?.caption ? `📷 ${m.image.caption}` : "📷 Imagen";
    case "video":
      return m.video?.caption ? `🎬 ${m.video.caption}` : "🎬 Video";
    case "audio":
      return "🎤 Audio";
    case "document":
      return `📄 ${m.document?.filename || "Documento"}`;
    case "sticker":
      return "Sticker";
    case "location":
      return "📍 Ubicación";
    case "reaction":
      return m.reaction?.emoji ? `Reaccionó ${m.reaction.emoji}` : "";
    default:
      return `Mensaje (${m?.type || "desconocido"})`;
  }
}

// Busca (o crea) el chat de un teléfono en un negocio.
async function asegurarChat(negocioId, telefono, { nombre } = {}) {
  const tel = normalizarTelefono(telefono);
  if (!tel || !negocioId) return null;
  const buscar = () =>
    supabase
      .from("whatsapp_chats")
      .select("*")
      .eq("negocio_id", negocioId)
      .eq("telefono", tel)
      .maybeSingle();

  const { data: existente } = await buscar();
  if (existente) {
    if (nombre && !existente.nombre) {
      await supabase.from("whatsapp_chats").update({ nombre }).eq("id", existente.id);
      existente.nombre = nombre;
    }
    return existente;
  }
  const { data: nuevo, error } = await supabase
    .from("whatsapp_chats")
    .insert([{ negocio_id: negocioId, telefono: tel, nombre: nombre ? String(nombre).slice(0, 120) : null }])
    .select()
    .single();
  if (!error && nuevo) return nuevo;
  // Otro request lo creó al mismo tiempo (UNIQUE): se relee.
  const { data: otra } = await buscar();
  return otra || null;
}

// Actualiza el resumen del chat después de un mensaje.
async function tocarChat(chat, { texto, entrante, fecha = new Date().toISOString() }) {
  if (!chat?.id) return;
  const cambios = { ultimo_texto: String(texto || "").slice(0, 300), ultimo_at: fecha };
  if (entrante) {
    cambios.ultimo_entrante_at = fecha;
    cambios.no_leidos = (chat.no_leidos || 0) + 1;
  }
  await supabase.from("whatsapp_chats").update(cambios).eq("id", chat.id);
  Object.assign(chat, cambios);
}

// ¿A qué negocio pertenece un mensaje de este teléfono?
async function negocioDelTelefono(tel) {
  const { data: chats } = await supabase
    .from("whatsapp_chats")
    .select("negocio_id, ultimo_at")
    .eq("telefono", tel)
    .order("ultimo_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (chats?.[0]) return { negocioId: chats[0].negocio_id };

  // Sin chat previo: el último pedido que dejó ese teléfono.
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("negocio_id, cliente, telefono_cliente")
    .order("created_at", { ascending: false })
    .limit(300);
  const p = (pedidos || []).find((x) => x.telefono_cliente && normalizarTelefono(x.telefono_cliente) === tel);
  return p ? { negocioId: p.negocio_id, nombre: p.cliente || null } : null;
}

// Guarda los mensajes entrantes de un evento del webhook (`change.value`).
// Devuelve los guardados ({ chat, mensaje }) — la Fase 3 (IA) los usará.
async function registrarEntrantes(value) {
  const nombres = Object.fromEntries(
    (value?.contacts || []).map((c) => [c.wa_id, c.profile?.name || null]),
  );
  const guardados = [];
  for (const m of value?.messages || []) {
    try {
      const tel = normalizarTelefono(m.from);
      if (!tel || !m.id) continue;

      // Meta puede reenviar el mismo evento: se ignora si ya está.
      const { data: repetido } = await supabase
        .from("whatsapp_mensajes")
        .select("id")
        .eq("meta_id", m.id)
        .maybeSingle();
      if (repetido) continue;

      const destino = await negocioDelTelefono(tel);
      if (!destino) {
        console.warn(`[Chats] Mensaje de ${tel} sin negocio asociado: se descarta.`);
        continue;
      }
      const chat = await asegurarChat(destino.negocioId, tel, {
        nombre: nombres[m.from] || destino.nombre,
      });
      if (!chat) continue;

      const texto = textoDeMensaje(m);
      const fecha = m.timestamp
        ? new Date(Number(m.timestamp) * 1000).toISOString()
        : new Date().toISOString();
      const { data: mensaje } = await supabase
        .from("whatsapp_mensajes")
        .insert([
          {
            negocio_id: destino.negocioId,
            chat_id: chat.id,
            telefono: tel,
            direccion: "entrante",
            texto,
            estado: "recibido",
            meta_id: m.id,
            created_at: fecha,
          },
        ])
        .select()
        .single();
      await tocarChat(chat, { texto, entrante: true, fecha });
      guardados.push({ chat, mensaje });
    } catch (e) {
      console.error("[Chats] No se pudo guardar un mensaje entrante:", e.message);
    }
  }
  return guardados;
}

// ── Panel ──

async function listarChats(negocioId) {
  const { data, error } = await supabase
    .from("whatsapp_chats")
    .select("id, telefono, nombre, ultimo_texto, ultimo_at, ultimo_entrante_at, no_leidos, necesita_humano, ia_pausada_hasta")
    .eq("negocio_id", negocioId)
    .order("ultimo_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) return []; // migración sin correr → lista vacía
  return (data || []).map((c) => ({ ...c, puede_responder: ventanaAbierta(c), ia_pausada: iaPausada(c) }));
}

async function chatDelNegocio(negocioId, chatId) {
  const id = Number(chatId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const { data } = await supabase
    .from("whatsapp_chats")
    .select("*")
    .eq("id", id)
    .eq("negocio_id", negocioId)
    .maybeSingle();
  return data || null;
}

// Mensajes de un chat (y lo marca como leído).
async function mensajesDelChat(negocioId, chatId) {
  const chat = await chatDelNegocio(negocioId, chatId);
  if (!chat) return null;
  const { data } = await supabase
    .from("whatsapp_mensajes")
    .select("id, direccion, autor, texto, aviso, plantilla, estado, error, pedido_id, created_at")
    .eq("chat_id", chat.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (chat.no_leidos) {
    await supabase.from("whatsapp_chats").update({ no_leidos: 0 }).eq("id", chat.id);
  }
  return {
    chat: { ...chat, no_leidos: 0, puede_responder: ventanaAbierta(chat), ia_pausada: iaPausada(chat) },
    mensajes: (data || []).reverse(),
  };
}

// Respuesta del negocio. Devuelve { ok, status?, error?, mensaje? }.
async function responder(negocioId, chatId, textoRaw) {
  const texto = String(textoRaw || "").trim();
  if (!texto) return { ok: false, status: 400, error: "Escribí un mensaje." };
  if (texto.length > MAX_TEXTO) return { ok: false, status: 400, error: "El mensaje es demasiado largo." };
  if (!estaConfigurado()) return { ok: false, status: 503, error: "WhatsApp no está configurado." };

  const chat = await chatDelNegocio(negocioId, chatId);
  if (!chat) return { ok: false, status: 404, error: "Chat no encontrado." };
  if (!ventanaAbierta(chat)) {
    return {
      ok: false,
      status: 409,
      error: "Pasaron más de 24 h desde el último mensaje del cliente. WhatsApp no deja escribirle hasta que vuelva a escribir.",
    };
  }

  const r = await enviarSaliente(chat, texto, "negocio");
  if (!r.ok) return { ok: false, status: 502, error: r.error || "No se pudo enviar.", mensaje: r.mensaje };
  // Respondió una persona: la IA se corre a un lado en este chat por un rato.
  await supabase
    .from("whatsapp_chats")
    .update({ necesita_humano: false, ia_pausada_hasta: new Date(Date.now() + PAUSA_IA_MS()).toISOString() })
    .eq("id", chat.id);
  return { ok: true, mensaje: r.mensaje };
}

// Envía un texto libre a un chat y lo registra. autor: negocio | ia.
async function enviarSaliente(chat, texto, autor) {
  const res = await enviarTexto(chat.telefono, texto);
  const { data: mensaje } = await supabase
    .from("whatsapp_mensajes")
    .insert([
      {
        negocio_id: chat.negocio_id,
        chat_id: chat.id,
        telefono: chat.telefono,
        direccion: "saliente",
        autor,
        texto,
        estado: res.ok ? "enviado" : "fallido",
        error: res.ok ? null : String(res.error || "").slice(0, 500),
        meta_id: res.id || null,
      },
    ])
    .select()
    .single();
  if (res.ok) await tocarChat(chat, { texto, entrante: false });
  return { ok: res.ok, error: res.error, mensaje };
}

// ── IA por chat ──
// Pausa después de que responde una persona (horas, env IA_PAUSA_HORAS).
const PAUSA_IA_MS = () => (Number(process.env.IA_PAUSA_HORAS) || 12) * 60 * 60 * 1000;
const SIN_FECHA = "9999-12-31T00:00:00.000Z"; // pausa manual: hasta que la reactiven

const iaPausada = (chat, ahora = Date.now()) =>
  !!chat?.necesita_humano ||
  (!!chat?.ia_pausada_hasta && new Date(chat.ia_pausada_hasta).getTime() > ahora);

// Activa o pausa la IA en un chat desde el panel.
async function cambiarIAChat(negocioId, chatId, activa) {
  const chat = await chatDelNegocio(negocioId, chatId);
  if (!chat) return null;
  const cambios = activa
    ? { necesita_humano: false, ia_pausada_hasta: null }
    : { ia_pausada_hasta: SIN_FECHA };
  await supabase.from("whatsapp_chats").update(cambios).eq("id", chat.id);
  const nuevo = { ...chat, ...cambios };
  return { ...nuevo, puede_responder: ventanaAbierta(nuevo), ia_pausada: iaPausada(nuevo) };
}

// La IA derivó la conversación a una persona del local.
async function marcarNecesitaHumano(chat) {
  await supabase.from("whatsapp_chats").update({ necesita_humano: true }).eq("id", chat.id);
  chat.necesita_humano = true;
}

module.exports = {
  VENTANA_MS,
  ventanaAbierta,
  textoDeMensaje,
  asegurarChat,
  tocarChat,
  registrarEntrantes,
  listarChats,
  mensajesDelChat,
  responder,
  enviarSaliente,
  iaPausada,
  cambiarIAChat,
  marcarNecesitaHumano,
};
