const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { modulosNegocio } = require("../middleware/requiereModulo");
const { firmaValida, linkPedido } = require("../utils/linksPedido");
const { guardarConRpc, guardarSinRpc } = require("./pedidosController");

// ══════════════════════════════════════════════════════════════
// Presupuestos: el cliente pide una cotización, el negocio la responde con
// un precio y el cliente la acepta o la rechaza desde su link. Una aceptada
// se convierte en pedido. Proceso y tabla propios (no se mezclan con pedidos).
//
//   pendiente → en_revision → cotizado → aceptado → convertido
//   rechazado / cancelado desde cualquier estado abierto
// ══════════════════════════════════════════════════════════════

const ABIERTOS = ["pendiente", "en_revision", "cotizado", "aceptado"];

// Negocio del menú público: explícito (sin caer al negocio 1) y activo.
async function negocioPublico(req) {
  const n = parseInt(req.query?.negocio ?? req.headers?.["x-negocio-id"], 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  const { data, error } = await supabase.from("negocios").select("id, activo").eq("id", n).maybeSingle();
  if (error) throw error;
  return data && data.activo !== false ? data.id : null;
}

const registrar = (p, estado, autor, extra = {}) =>
  supabase
    .from("presupuesto_eventos")
    .insert([{ presupuesto_id: p.id, negocio_id: p.negocio_id, estado, autor, ...extra }])
    .then(({ error }) => error && console.error("[Presupuestos] historial:", error.message));

// Cambio de estado atómico: sólo si sigue en el estado que se leyó.
async function pasar(p, desde, cambios) {
  const { data, error } = await supabase
    .from("presupuestos")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", p.id)
    .eq("negocio_id", p.negocio_id)
    .eq("estado", desde)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data; // null = otro lo cambió en el medio
}

// Lo que ve el cliente (nada interno).
const publico = (p) => ({
  id: p.id,
  estado: p.estado,
  referencia: p.referencia,
  descripcion: p.descripcion,
  cantidad: p.cantidad,
  medidas: p.medidas,
  precio_cotizado: p.estado === "pendiente" || p.estado === "en_revision" ? null : p.precio_cotizado,
  observaciones: p.estado === "pendiente" || p.estado === "en_revision" ? null : p.observaciones,
  valido_hasta: p.valido_hasta,
  created_at: p.created_at,
});

const vencido = (p) => !!p.valido_hasta && new Date(`${p.valido_hasta}T23:59:59-03:00`) < new Date();

// ── Público ──────────────────────────────────────────────────

// POST /api/presupuestos?negocio=<id>  (body validado con zod)
const crearPresupuesto = async (req, res) => {
  try {
    const negocioId = await negocioPublico(req);
    if (!negocioId) return res.status(404).json({ message: "Negocio no encontrado." });
    if (!(await modulosNegocio(negocioId)).presupuestos) {
      return res.status(403).json({ error: "MODULO_INACTIVO", message: "Este negocio no recibe pedidos de presupuesto online." });
    }
    const b = req.body;

    // Producto o servicio de referencia: del mismo negocio, si viene.
    let referencia = null;
    for (const [tabla, campo] of [["productos", "producto_id"], ["servicios", "servicio_id"]]) {
      if (!b[campo]) continue;
      const { data, error } = await supabase.from(tabla).select("id, nombre").eq("id", b[campo]).eq("negocio_id", negocioId).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(400).json({ message: "Lo que elegiste ya no está disponible. Actualizá la página." });
      referencia = data.nombre;
    }

    const { data: p, error } = await supabase
      .from("presupuestos")
      .insert([
        {
          negocio_id: negocioId,
          producto_id: b.producto_id || null,
          servicio_id: b.servicio_id || null,
          referencia,
          cliente_nombre: b.cliente_nombre,
          telefono: b.telefono || null,
          email: b.email || null,
          acepta_whatsapp: b.acepta_whatsapp === true && !!b.telefono,
          descripcion: b.descripcion,
          cantidad: b.cantidad,
          medidas: b.medidas || null,
        },
      ])
      .select()
      .single();
    if (error) throw error;

    // Archivos de referencia (subidos antes): de este negocio, sin usar.
    const tokens = [...new Set(b.adjuntos || [])];
    if (tokens.length) {
      const { data: tomados, error: aErr } = await supabase
        .from("adjuntos")
        .update({ usado: true, contexto: "presupuesto", ref_id: p.id })
        .eq("negocio_id", negocioId)
        .eq("usado", false)
        .in("token", tokens)
        .select("id");
      if (aErr) throw aErr;
      if ((tomados || []).length !== tokens.length) {
        console.warn(`[Presupuestos] #${p.id}: ${tokens.length - (tomados || []).length} archivo(s) no disponibles`);
      }
    }
    await registrar(p, "pendiente", "cliente");
    res.status(201).json({ ...publico(p), link: linkPedido("presupuesto", p) });
  } catch (error) {
    return respondError(res, error, "presupuestos.crear");
  }
};

// Presupuesto del link firmado (/presupuesto/:id?t=).
async function delLink(req) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return null;
  const { data, error } = await supabase.from("presupuestos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || !firmaValida("presupuesto", data.id, data.negocio_id, req.query?.t)) return null;
  return data;
}

// GET /api/presupuestos/:id/publico?t=
const verPublico = async (req, res) => {
  try {
    const p = await delLink(req);
    if (!p) return res.status(404).json({ message: "Presupuesto no encontrado." });
    const [{ data: neg }, { data: n }] = await Promise.all([
      supabase.from("configuracion").select("nombre, whatsapp, telefono").eq("negocio_id", p.negocio_id).maybeSingle(),
      supabase.from("negocios").select("slug").eq("id", p.negocio_id).maybeSingle(),
    ]);
    res.json({ ...publico(p), vencido: vencido(p), negocio: neg ? { ...neg, slug: n?.slug || null } : null });
  } catch (error) {
    return respondError(res, error, "presupuestos.ver");
  }
};

// POST /api/presupuestos/:id/responder?t=  { decision: "aceptar" | "rechazar" }
const responderCliente = async (req, res) => {
  try {
    const p = await delLink(req);
    if (!p) return res.status(404).json({ message: "Presupuesto no encontrado." });
    if (p.estado !== "cotizado") return res.status(409).json({ message: "Este presupuesto ya no espera respuesta." });
    const acepta = req.body.decision === "aceptar";
    if (acepta && vencido(p)) return res.status(409).json({ message: "La cotización venció. Pedile una nueva al negocio." });
    const nuevo = acepta ? "aceptado" : "rechazado";
    const hecho = await pasar(p, "cotizado", { estado: nuevo });
    if (!hecho) return res.status(409).json({ message: "El presupuesto cambió. Recargá la página." });
    await registrar(p, nuevo, "cliente");
    res.json(publico(hecho));
  } catch (error) {
    return respondError(res, error, "presupuestos.responder");
  }
};

// ── Panel ────────────────────────────────────────────────────

const delNegocio = async (req) => {
  const { data, error } = await supabase
    .from("presupuestos")
    .select("*")
    .eq("id", parseInt(req.params.id, 10))
    .eq("negocio_id", getNegocioId(req))
    .maybeSingle();
  if (error) throw error;
  return data;
};

// GET /api/presupuestos?vista=abiertos|cerrados
const listar = async (req, res) => {
  try {
    const cerrados = req.query.vista === "cerrados";
    const { data, error } = await supabase
      .from("presupuestos")
      .select("*")
      .eq("negocio_id", getNegocioId(req))
      .in("estado", cerrados ? ["rechazado", "convertido", "cancelado"] : ABIERTOS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    return respondError(res, error, "presupuestos.listar");
  }
};

// GET /api/presupuestos/:id → con historial, archivos y link del cliente.
const ver = async (req, res) => {
  try {
    const p = await delNegocio(req);
    if (!p) return res.status(404).json({ message: "Presupuesto no encontrado." });
    const [ev, adj] = await Promise.all([
      supabase.from("presupuesto_eventos").select("estado, autor, nota, created_at").eq("presupuesto_id", p.id).eq("negocio_id", p.negocio_id).order("created_at"),
      supabase.from("adjuntos").select("id, nombre, tipo").eq("negocio_id", p.negocio_id).eq("contexto", "presupuesto").eq("ref_id", p.id),
    ]);
    res.json({ ...p, eventos: ev.data || [], adjuntos: adj.data || [], link: linkPedido("presupuesto", p) });
  } catch (error) {
    return respondError(res, error, "presupuestos.ver");
  }
};

// PATCH /api/presupuestos/:id/estado  { estado: en_revision | rechazado | cancelado, nota? }
const cambiarEstado = async (req, res) => {
  try {
    const p = await delNegocio(req);
    if (!p) return res.status(404).json({ message: "Presupuesto no encontrado." });
    const { estado, nota } = req.body;
    const valido = estado === "en_revision" ? p.estado === "pendiente" : ABIERTOS.includes(p.estado);
    if (!valido) return res.status(409).json({ message: "Ese cambio no se puede hacer en el estado actual." });
    const hecho = await pasar(p, p.estado, { estado });
    if (!hecho) return res.status(409).json({ message: "El presupuesto cambió. Recargá." });
    await registrar(p, estado, "negocio", { usuario_id: req.user?.id ?? null, nota: nota || null });
    res.json(hecho);
  } catch (error) {
    return respondError(res, error, "presupuestos.estado");
  }
};

// POST /api/presupuestos/:id/cotizacion  { precio, observaciones?, valido_hasta? }
const cotizar = async (req, res) => {
  try {
    const p = await delNegocio(req);
    if (!p) return res.status(404).json({ message: "Presupuesto no encontrado." });
    if (!["pendiente", "en_revision", "cotizado"].includes(p.estado)) {
      return res.status(409).json({ message: "Este presupuesto ya no se puede cotizar." });
    }
    const { precio, observaciones, valido_hasta } = req.body;
    const hoy = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (valido_hasta && valido_hasta < hoy) {
      return res.status(400).json({ message: "La fecha de validez no puede ser anterior a hoy." });
    }
    const hecho = await pasar(p, p.estado, {
      estado: "cotizado",
      precio_cotizado: precio,
      observaciones: observaciones || null,
      valido_hasta: valido_hasta || null,
    });
    if (!hecho) return res.status(409).json({ message: "El presupuesto cambió. Recargá." });
    await registrar(p, "cotizado", "negocio", { usuario_id: req.user?.id ?? null, nota: `Precio: ${precio}` });
    res.json({ ...hecho, link: linkPedido("presupuesto", hecho) });
  } catch (error) {
    return respondError(res, error, "presupuestos.cotizar");
  }
};

// POST /api/presupuestos/:id/convertir → crea el pedido con el precio cotizado.
const convertir = async (req, res) => {
  try {
    const p = await delNegocio(req);
    if (!p) return res.status(404).json({ message: "Presupuesto no encontrado." });
    if (p.estado !== "aceptado") return res.status(409).json({ message: "Sólo se pasa a pedido un presupuesto aceptado." });
    // El pedido tiene que poder verse: hace falta el módulo de pedidos.
    if (!(await modulosNegocio(p.negocio_id)).pedidos) {
      return res.status(403).json({ error: "MODULO_INACTIVO", message: 'Para pasarlo a pedido, activá "Pedidos" en Configuración → Módulos.' });
    }
    // Se reserva primero el cambio de estado: dos clics no crean dos pedidos.
    const tomado = await pasar(p, "aceptado", { estado: "convertido" });
    if (!tomado) return res.status(409).json({ message: "El presupuesto cambió. Recargá." });

    const total = Number(p.precio_cotizado);
    const filas = [
      {
        producto_id: p.producto_id || null,
        nombre: `Presupuesto #${p.id}: ${p.referencia || p.descripcion}`.slice(0, 150),
        precio_unit: total,
        costo_unit: 0,
        cantidad: 1,
        subtotal: total,
        opciones: null,
        personalizacion: null,
      },
    ];
    const pedidoBase = {
      negocio_id: p.negocio_id,
      mesa: null,
      cliente: p.cliente_nombre,
      nota: [`Presupuesto #${p.id}`, p.cantidad > 1 ? `Cantidad: ${p.cantidad}` : null, p.medidas].filter(Boolean).join(" · ").slice(0, 1000),
      tipo_entrega: null,
      direccion_entrega: null,
      telefono_cliente: p.telefono || null,
      total,
    };
    let guardado;
    try {
      guardado =
        (await guardarConRpc({ pedidoBase, filas, stock: [], stockOpciones: [], adjuntos: [] })) ||
        (await guardarSinRpc({ pedidoBase, filas, porProducto: {}, porOpcion: {}, prodsDB: {}, opcionesDB: {}, negocioId: p.negocio_id }));
    } catch (e) {
      // No se pudo crear el pedido: el presupuesto vuelve a "aceptado".
      await pasar(tomado, "convertido", { estado: "aceptado" });
      throw e;
    }
    const { data: final, error } = await supabase
      .from("presupuestos")
      .update({ pedido_id: guardado.pedido.id })
      .eq("id", p.id)
      .eq("negocio_id", p.negocio_id)
      .select()
      .single();
    // El pedido ya existe: si falla sólo el enlace, igual se informa (queda
    // anotado en el historial con el número de pedido).
    if (error) console.error(`[Presupuestos] #${p.id}: no se guardó pedido_id ${guardado.pedido.id}:`, error.message);
    await registrar(p, "convertido", "negocio", { usuario_id: req.user?.id ?? null, nota: `Pedido #${guardado.pedido.id}` });
    res.json({ ...(final || tomado), pedido_id: guardado.pedido.id, pedido: guardado.pedido });
  } catch (error) {
    return respondError(res, error, "presupuestos.convertir");
  }
};

// GET /api/presupuestos/resumen → cuántos esperan algo del negocio.
const resumen = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("presupuestos")
      .select("estado")
      .eq("negocio_id", getNegocioId(req))
      .in("estado", ["pendiente", "aceptado"]);
    if (error) throw error;
    const n = (e) => (data || []).filter((x) => x.estado === e).length;
    res.json({ pendientes: n("pendiente"), aceptados: n("aceptado") });
  } catch (error) {
    return respondError(res, error, "presupuestos.resumen");
  }
};

module.exports = { resumen, crearPresupuesto, verPublico, responderCliente, listar, ver, cambiarEstado, cotizar, convertir, negocioPublico };
