// Avisos automáticos de pedido por WhatsApp (Fase 1).
//
// Cuando un pedido cambia de estado, si el negocio activó el aviso y el
// cliente aceptó recibirlos, se le manda una PLANTILLA aprobada por Meta.
// Todo es "fire-and-forget": nunca rompe ni demora la respuesta al admin
// o al cliente; si algo falla, queda registrado en whatsapp_mensajes.
const supabase = require("../config/database");
const { negocioConWhatsapp } = require("../utils/planNegocio");
const { enviarPlantilla, estaConfigurado } = require("./whatsappService");
const { asegurarChat, tocarChat } = require("./chatsService");
const { linkPedido } = require("../utils/linksPedido");

// Un aviso por estado del pedido. `texto` es el cuerpo EXACTO que hay que
// cargar como plantilla en Meta (categoría "Utility", idioma es_AR):
//   {{1}} = nombre del cliente · {{2}} = nombre del local · {{3}} = número de pedido
const AVISOS = [
  {
    estado: "pendiente",
    plantilla: "pedido_recibido",
    porDefecto: true,
    texto: "Hola {{1}}, {{2}} recibió tu pedido #{{3}}. Te vamos a avisar por acá cuando cambie de estado.",
  },
  {
    estado: "preparando",
    plantilla: "pedido_en_preparacion",
    porDefecto: true,
    texto: "Hola {{1}}, tu pedido #{{3}} de {{2}} ya se está preparando.",
  },
  {
    // {{4}} = link al mapa con la ubicación del repartidor.
    estado: "en_camino",
    plantilla: "pedido_en_camino_mapa",
    link: "seguimiento",
    porDefecto: true,
    texto: "Hola {{1}}, tu pedido #{{3}} de {{2}} ya salió y va en camino. Seguilo en el mapa: {{4}} ¡Ya llega!",
  },
  {
    estado: "listo",
    plantilla: "pedido_listo_retirar",
    porDefecto: true,
    texto: "Hola {{1}}, tu pedido #{{3}} de {{2}} está listo para retirar.",
  },
  {
    // {{4}} = link al ticket del pedido.
    estado: "entregado",
    plantilla: "pedido_entregado_ticket",
    link: "ticket",
    porDefecto: true,
    texto: "¡Gracias {{1}}! Tu pedido #{{3}} de {{2}} fue entregado. Mirá tu ticket acá: {{4}} ¡Que lo disfrutes!",
  },
  {
    estado: "cancelado",
    plantilla: "pedido_cancelado",
    porDefecto: true,
    texto: "Hola {{1}}, lamentamos avisarte que tu pedido #{{3}} de {{2}} fue cancelado. Si tenés dudas, respondé este mensaje.",
  },
];

const avisoDe = (estado) => AVISOS.find((a) => a.estado === estado) || null;

const estadosPorDefecto = () =>
  Object.fromEntries(AVISOS.map((a) => [a.estado, a.porDefecto]));

// Configuración del negocio (con los valores por defecto completados).
// Si la tabla aún no existe (migración sin correr), los avisos quedan apagados.
async function obtenerConfig(negocioId) {
  const base = { activo: false, estados: estadosPorDefecto() };
  try {
    const { data, error } = await supabase
      .from("whatsapp_avisos")
      .select("activo, estados")
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (error || !data) return base;
    return {
      activo: data.activo === true,
      estados: { ...base.estados, ...(data.estados || {}) },
    };
  } catch {
    return base;
  }
}

async function guardarConfig(negocioId, { activo, estados }) {
  const limpio = {};
  for (const a of AVISOS) {
    if (estados && typeof estados[a.estado] === "boolean") limpio[a.estado] = estados[a.estado];
  }
  const actual = await obtenerConfig(negocioId);
  const fila = {
    negocio_id: negocioId,
    activo: typeof activo === "boolean" ? activo : actual.activo,
    estados: { ...actual.estados, ...limpio },
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("whatsapp_avisos")
    .upsert(fila, { onConflict: "negocio_id" });
  if (error) throw error;
  return { activo: fila.activo, estados: fila.estados };
}

// ¿El menú debe ofrecer la casilla "avisarme por WhatsApp"?
async function avisosDisponibles(negocioId) {
  if (!estaConfigurado()) return false;
  if (!(await negocioConWhatsapp(negocioId))) return false; // plan Básico
  return (await obtenerConfig(negocioId)).activo;
}

async function nombreNegocio(negocioId) {
  try {
    const { data } = await supabase
      .from("configuracion")
      .select("nombre")
      .eq("negocio_id", negocioId)
      .maybeSingle();
    return data?.nombre || "el local";
  } catch {
    return "el local";
  }
}

// Envía la plantilla y deja el registro. Devuelve { ok, error? }.
// Texto final de la plantilla con sus parámetros ({{1}}, {{2}}, …).
const renderizar = (texto, params) =>
  texto.replace(/\{\{(\d+)\}\}/g, (m, n) => (params[n - 1] !== undefined ? String(params[n - 1]) : m));

async function enviarYRegistrar({ negocioId, pedidoId, telefono, aviso, etiqueta, params, nombre }) {
  const res = await enviarPlantilla(telefono, { nombre: aviso.plantilla, parametros: params });
  const texto = renderizar(aviso.texto, params);
  try {
    // El aviso también queda en el chat de ese cliente (Fase 2).
    let chat = null;
    try {
      chat = await asegurarChat(negocioId, telefono, { nombre });
      if (chat && res.ok) await tocarChat(chat, { texto, entrante: false });
    } catch {
      chat = null; // sin migración de chats: se registra igual, sin chat
    }
    await supabase.from("whatsapp_mensajes").insert([
      {
        negocio_id: negocioId,
        chat_id: chat?.id || null,
        direccion: "saliente",
        autor: "aviso",
        texto,
        pedido_id: pedidoId || null,
        telefono: String(telefono).slice(0, 30),
        aviso: etiqueta,
        plantilla: aviso.plantilla,
        estado: res.ok ? "enviado" : "fallido",
        error: res.ok ? null : String(res.error || "").slice(0, 500),
        meta_id: res.id || null,
      },
    ]);
  } catch (e) {
    console.error("[Avisos] No se pudo registrar el mensaje:", e.message);
  }
  if (!res.ok) console.error(`[Avisos] Pedido #${pedidoId || "-"}: ${res.error}`);
  return res;
}

// Aviso de cambio de estado. Nunca lanza.
async function notificarPedido(pedido, estado = pedido?.estado) {
  try {
    const aviso = avisoDe(estado);
    if (!aviso || !pedido) return { ok: false, motivo: "sin_aviso" };
    if (!pedido.acepta_whatsapp || !pedido.telefono_cliente) {
      return { ok: false, motivo: "sin_consentimiento" };
    }
    if (!estaConfigurado()) return { ok: false, motivo: "no_configurado" };
    if (!(await negocioConWhatsapp(pedido.negocio_id))) return { ok: false, motivo: "plan" };

    const cfg = await obtenerConfig(pedido.negocio_id);
    if (!cfg.activo || !cfg.estados[estado]) return { ok: false, motivo: "desactivado" };

    const local = await nombreNegocio(pedido.negocio_id);
    return await enviarYRegistrar({
      negocioId: pedido.negocio_id,
      pedidoId: pedido.id,
      telefono: pedido.telefono_cliente,
      aviso,
      etiqueta: estado,
      nombre: (pedido.cliente || "").trim() || null,
      params: [
        (pedido.cliente || "").trim() || "cliente",
        local,
        pedido.id,
        ...(aviso.link ? [linkPedido(aviso.link, pedido)] : []),
      ],
    });
  } catch (err) {
    console.error("[Avisos] Error inesperado:", err.message);
    return { ok: false, error: err.message };
  }
}

// Mensaje de prueba desde el panel (usa la plantilla de "pedido recibido").
async function enviarPrueba(negocioId, telefono) {
  if (!estaConfigurado()) return { ok: false, error: "WhatsApp no está configurado" };
  const local = await nombreNegocio(negocioId);
  return enviarYRegistrar({
    negocioId,
    pedidoId: null,
    telefono,
    aviso: avisoDe("pendiente"),
    etiqueta: "prueba",
    params: ["cliente", local, "123"],
  });
}

// ── Estados que informa Meta por webhook ──
const RANGO = { enviado: 1, entregado: 2, leido: 3, fallido: 4 };
const ESTADO_META = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };

// Actualiza el registro con los estados que llegan del webhook de Meta.
// No retrocede (un "entregado" tardío no pisa un "leído").
async function registrarEstadosMeta(statuses = []) {
  for (const s of statuses) {
    const nuevo = ESTADO_META[s?.status];
    if (!nuevo || !s.id) continue;
    try {
      const { data: actual } = await supabase
        .from("whatsapp_mensajes")
        .select("id, estado")
        .eq("meta_id", s.id)
        .maybeSingle();
      if (!actual || (RANGO[nuevo] || 0) <= (RANGO[actual.estado] || 0)) continue;
      const err = s.errors?.[0];
      await supabase
        .from("whatsapp_mensajes")
        .update({
          estado: nuevo,
          error: nuevo === "fallido" ? String(err?.title || err?.message || "Error de WhatsApp").slice(0, 500) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", actual.id);
    } catch (e) {
      console.error("[Avisos] Webhook: no se pudo actualizar", s.id, e.message);
    }
  }
}

module.exports = {
  AVISOS,
  avisoDe,
  obtenerConfig,
  guardarConfig,
  avisosDisponibles,
  notificarPedido,
  enviarPrueba,
  registrarEstadosMeta,
};
