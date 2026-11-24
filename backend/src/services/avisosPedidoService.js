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
  // ── Presupuestos y turnos: clave con prefijo (las de pedido no cambian).
  // grupo = módulo que tiene que usar el negocio; ejemplos = valores de
  // muestra para Meta y la vista previa. Ninguna termina en variable
  // (Meta no lo acepta).
  {
    // {{3}} = número de presupuesto · {{4}} = link para seguirlo.
    estado: "presupuesto.recibido",
    grupo: "presupuestos",
    plantilla: "presupuesto_recibido",
    link: "presupuesto",
    porDefecto: false, // el local los prende cuando Meta aprueba las plantillas
    texto: "Hola {{1}}, {{2}} recibió tu pedido de presupuesto #{{3}}. Podés seguirlo acá: {{4}} Te avisamos cuando esté la cotización.",
    ejemplos: ["Juan", "Estudio Lu", "12", "https://dinexflow.com.ar/presupuesto/12?t=abc123"],
  },
  {
    estado: "presupuesto.cotizado",
    grupo: "presupuestos",
    plantilla: "presupuesto_cotizado",
    link: "presupuesto",
    porDefecto: false, // el local los prende cuando Meta aprueba las plantillas
    texto: "Hola {{1}}, {{2}} ya cotizó tu presupuesto #{{3}}. Miralo acá: {{4}} Desde ese link lo aceptás o lo rechazás.",
    ejemplos: ["Juan", "Estudio Lu", "12", "https://dinexflow.com.ar/presupuesto/12?t=abc123"],
  },
  {
    // {{3}} = día y hora · {{4}} = servicio · {{5}} = link del turno.
    estado: "reserva.confirmada",
    grupo: "reservas",
    plantilla: "turno_confirmado",
    link: "reserva",
    porDefecto: false, // el local los prende cuando Meta aprueba las plantillas
    texto: "Hola {{1}}, tu turno de {{4}} en {{2}} quedó confirmado para el {{3}}. Si necesitás cancelarlo o cambiarlo: {{5}} ¡Te esperamos!",
    ejemplos: ["Juan", "Estudio Lu", "lunes 16/11 a las 18:30", "Corte de pelo", "https://dinexflow.com.ar/reserva/40?t=abc123"],
  },
  {
    estado: "reserva.reprogramada",
    grupo: "reservas",
    plantilla: "turno_reprogramado",
    link: "reserva",
    porDefecto: false, // el local los prende cuando Meta aprueba las plantillas
    texto: "Hola {{1}}, {{2}} cambió tu turno de {{4}} para el {{3}}. Si no te queda bien, cambialo acá: {{5}} ¡Gracias!",
    ejemplos: ["Juan", "Estudio Lu", "martes 17/11 a las 10:00", "Corte de pelo", "https://dinexflow.com.ar/reserva/40?t=abc123"],
  },
  {
    estado: "reserva.cancelada",
    grupo: "reservas",
    plantilla: "turno_cancelado",
    link: "reserva",
    porDefecto: false, // el local los prende cuando Meta aprueba las plantillas
    texto: "Hola {{1}}, lamentamos avisarte que {{2}} canceló tu turno de {{4}} del {{3}}. Más info: {{5}} Disculpá las molestias.",
    ejemplos: ["Juan", "Estudio Lu", "lunes 16/11 a las 18:30", "Corte de pelo", "https://dinexflow.com.ar/reserva/40?t=abc123"],
  },
];

// Avisos que corresponden a un negocio según sus módulos (los de pedido, sin
// grupo, son del módulo "pedidos"). Así un restaurante no ve ni crea en Meta
// plantillas de presupuestos o turnos, y una peluquería sin pedidos no ve
// las de pedido.
const avisosDelNegocio = (modulos) => AVISOS.filter((a) => modulos?.[a.grupo || "pedidos"]);

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
  if (!(await estaConfigurado(negocioId))) return false;
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
  const texto = renderizar(aviso.texto, params);
  const res = await enviarPlantilla(telefono, { nombre: aviso.plantilla, parametros: params, texto }, negocioId);
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
    if (!(await estaConfigurado(pedido.negocio_id))) return { ok: false, motivo: "no_configurado" };
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
        pedido.numero ?? pedido.id,
        ...(aviso.link ? [linkPedido(aviso.link, pedido)] : []),
      ],
    });
  } catch (err) {
    console.error("[Avisos] Error inesperado:", err.message);
    return { ok: false, error: err.message };
  }
}

// Fecha del turno como la lee un cliente: "lunes 16/11 a las 18:30".
function fechaTurno(iso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.weekday} ${p.day}/${p.month} a las ${p.hour}:${p.minute}`;
}

// Aviso de presupuesto o turno (clave con prefijo). Mismas reglas que el
// de pedido: consentimiento, WhatsApp configurado, plan y aviso prendido.
// Nunca lanza.
async function enviarAviso(clave, { negocioId, telefono, acepta, cliente, params }) {
  // params es una función: se arma recién acá adentro (si algo falla, como
  // una fecha inválida, no sale del try ni rompe la respuesta).
  try {
    const aviso = avisoDe(clave);
    if (!aviso) return { ok: false, motivo: "sin_aviso" };
    if (!acepta || !telefono) return { ok: false, motivo: "sin_consentimiento" };
    if (!(await estaConfigurado(negocioId))) return { ok: false, motivo: "no_configurado" };
    if (!(await negocioConWhatsapp(negocioId))) return { ok: false, motivo: "plan" };
    const cfg = await obtenerConfig(negocioId);
    if (!cfg.activo || !cfg.estados[clave]) return { ok: false, motivo: "desactivado" };
    const local = await nombreNegocio(negocioId);
    const nombre = (cliente || "").trim() || null;
    return await enviarYRegistrar({
      negocioId,
      pedidoId: null,
      telefono,
      aviso,
      etiqueta: clave,
      nombre,
      // Meta rechaza saltos de línea y muchos espacios seguidos en un parámetro.
      params: [nombre || "cliente", local, ...params()].map((v) => String(v).replace(/\s+/g, " ").trim().slice(0, 200)),
    });
  } catch (err) {
    console.error("[Avisos] Error inesperado:", err.message);
    return { ok: false, error: err.message };
  }
}

// clave: "presupuesto.recibido" | "presupuesto.cotizado"
const notificarPresupuesto = (p, clave) =>
  enviarAviso(clave, {
    negocioId: p.negocio_id,
    telefono: p.telefono,
    acepta: p.acepta_whatsapp,
    cliente: p.cliente_nombre,
    params: () => [p.id, linkPedido("presupuesto", p)],
  });

// clave: "reserva.confirmada" | "reserva.reprogramada" | "reserva.cancelada"
const notificarReserva = (r, clave) =>
  enviarAviso(clave, {
    negocioId: r.negocio_id,
    telefono: r.telefono,
    acepta: r.acepta_whatsapp,
    cliente: r.cliente_nombre,
    params: () => [fechaTurno(r.inicio), r.servicio_nombre || "tu servicio", linkPedido("reserva", r)],
  });

// Mensaje de prueba desde el panel: el primer aviso que usa el negocio
// ("pedido recibido" en un restaurante), con valores de muestra.
async function enviarPrueba(negocioId, telefono, modulos = null) {
  if (!(await estaConfigurado(negocioId))) return { ok: false, error: "WhatsApp no está configurado" };
  const local = await nombreNegocio(negocioId);
  const aviso = (modulos && avisosDelNegocio(modulos)[0]) || avisoDe("pendiente");
  const params = aviso.ejemplos ? aviso.ejemplos.map((v, i) => (i === 1 ? local : v)) : ["cliente", local, "123"];
  return enviarYRegistrar({ negocioId, pedidoId: null, telefono, aviso, etiqueta: "prueba", params });
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
  avisosDelNegocio,
  notificarPresupuesto,
  notificarReserva,
  fechaTurno,
  obtenerConfig,
  guardarConfig,
  avisosDisponibles,
  notificarPedido,
  enviarPrueba,
  registrarEstadosMeta,
};
