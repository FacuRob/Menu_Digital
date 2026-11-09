// Seguimiento del delivery.
//
// Repartidor (link firmado "reparto", lo comparte el local desde Pedidos):
//   GET  /api/reparto/:id            datos para entregar (dirección, teléfono…)
//   POST /api/reparto/:id/salir      → "en_camino" (avisa al cliente con el mapa)
//   POST /api/reparto/:id/ubicacion  { lat, lng } mientras está en camino
//   POST /api/reparto/:id/entregar   → "entregado" (avisa con el ticket)
// Cliente (link firmado "seguimiento", llega en el aviso de "en camino"):
//   GET  /api/seguimiento/:id        estado + última ubicación del repartidor
// El token va en ?t= (GET) o en el body { t } (POST).
const supabase = require("../config/database");
const { negocioConWhatsapp } = require("../utils/planNegocio");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { firmaValida, linkPedido } = require("../utils/linksPedido");
const { notificarPedido } = require("../services/avisosPedidoService");

const NO_ENCONTRADO = { message: "Pedido no encontrado" };

// Pedido delivery cuyo link firmado (de ese tipo) es válido, o null.
async function pedidoFirmado(tipo, req, campos) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return null;
  const token = req.query.t || req.body?.t;
  const { data: p, error } = await supabase
    .from("pedidos")
    .select(`id, negocio_id, tipo_entrega, estado, ${campos}`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!p || p.tipo_entrega !== "delivery" || !firmaValida(tipo, p.id, p.negocio_id, token)) return null;
  // Mapa del repartidor: plan Estándar o Premium (un link viejo deja de andar
  // si la cuenta bajó de plan).
  if (!(await negocioConWhatsapp(p.negocio_id))) return null;
  return p;
}

const datosLocal = async (negocioId) => {
  const { data } = await supabase
    .from("configuracion")
    .select("nombre, telefono, color_primario, moneda")
    .eq("negocio_id", negocioId)
    .maybeSingle();
  return data || { nombre: "El local" };
};

// Cambia el estado sólo si el pedido está en uno de `desde` (evita pisar un
// cancelado y avisar dos veces). Devuelve el pedido actualizado o null.
async function cambiarEstado(p, estado, desde) {
  if (!desde.includes(p.estado)) return null;
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from("pedidos")
    .update({ estado, updated_at: ahora, entregado_at: estado === "entregado" ? ahora : null })
    .eq("id", p.id)
    .eq("negocio_id", p.negocio_id)
    .eq("estado", p.estado)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) {
    notificarPedido(data, estado).catch((e) => console.error("[Avisos] fallo en segundo plano:", e.message));
  }
  return data;
}

const getReparto = async (req, res) => {
  try {
    const p = await pedidoFirmado(
      "reparto",
      req,
      "cliente, telefono_cliente, direccion_entrega, nota, total, pedido_items(nombre, cantidad, unidad)",
    );
    if (!p) return res.status(404).json(NO_ENCONTRADO);
    const local = await datosLocal(p.negocio_id);
    // Pedido cerrado: el link queda en el WhatsApp del repartidor, así que ya
    // no muestra teléfono, dirección ni nota del cliente.
    if (p.estado === "entregado" || p.estado === "cancelado") {
      return res.json({ id: p.id, estado: p.estado, total: p.total, items: [], local });
    }
    res.json({
      id: p.id,
      estado: p.estado,
      cliente: p.cliente,
      telefono: p.telefono_cliente,
      direccion: p.direccion_entrega,
      nota: p.nota,
      total: p.total,
      items: (p.pedido_items || []).map(({ nombre, cantidad, unidad }) => ({ nombre, cantidad, unidad: unidad || "unidad" })),
      local,
    });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

const salir = async (req, res) => {
  try {
    const p = await pedidoFirmado("reparto", req, "cliente");
    if (!p) return res.status(404).json(NO_ENCONTRADO);
    if (p.estado === "en_camino") return res.json({ estado: p.estado });
    const nuevo = await cambiarEstado(p, "en_camino", ["pendiente", "preparando", "listo"]);
    if (!nuevo) return res.status(409).json({ message: "Este pedido ya no se puede enviar.", estado: p.estado });
    res.json({ estado: nuevo.estado });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

const ubicacion = async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ message: "Ubicación inválida" });
    }
    const p = await pedidoFirmado("reparto", req, "cliente");
    if (!p) return res.status(404).json(NO_ENCONTRADO);
    // Fuera de "en camino" no se guarda nada: el repartidor deja de compartir.
    if (p.estado !== "en_camino") return res.status(409).json({ estado: p.estado });
    const { error } = await supabase
      .from("pedidos")
      .update({ repartidor_lat: lat, repartidor_lng: lng, repartidor_at: new Date().toISOString() })
      .eq("id", p.id)
      .eq("negocio_id", p.negocio_id)
      .eq("estado", "en_camino");
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

const entregar = async (req, res) => {
  try {
    const p = await pedidoFirmado("reparto", req, "cliente");
    if (!p) return res.status(404).json(NO_ENCONTRADO);
    if (p.estado === "entregado") return res.json({ estado: p.estado });
    const nuevo = await cambiarEstado(p, "entregado", ["en_camino"]);
    if (!nuevo) return res.status(409).json({ message: "Este pedido no está en camino.", estado: p.estado });
    res.json({ estado: nuevo.estado });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

const getSeguimiento = async (req, res) => {
  try {
    const p = await pedidoFirmado("seguimiento", req, "cliente, updated_at, repartidor_lat, repartidor_lng, repartidor_at");
    if (!p) return res.status(404).json(NO_ENCONTRADO);
    // Sólo ubicaciones mandadas desde que salió (updated_at = último cambio de
    // estado): si el pedido volvió a "en camino", no se muestra una vieja.
    const enCamino =
      p.estado === "en_camino" &&
      !!p.repartidor_at &&
      (!p.updated_at || Date.parse(p.repartidor_at) >= Date.parse(p.updated_at));
    res.json({
      id: p.id,
      estado: p.estado,
      cliente: (p.cliente || "").trim().split(/\s+/)[0] || null,
      ubicacion:
        enCamino && p.repartidor_lat != null
          ? { lat: Number(p.repartidor_lat), lng: Number(p.repartidor_lng), at: p.repartidor_at }
          : null,
      ticket: p.estado === "entregado" ? linkPedido("ticket", p) : null,
      local: await datosLocal(p.negocio_id),
    });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

// Para el panel (protegida): link del repartidor de un pedido delivery.
const getLinkReparto = async (req, res) => {
  try {
    const { data: p } = await supabase
      .from("pedidos")
      .select("id, negocio_id, tipo_entrega")
      .eq("id", req.params.id)
      .eq("negocio_id", getNegocioId(req))
      .maybeSingle();
    if (!p || p.tipo_entrega !== "delivery") return res.status(404).json(NO_ENCONTRADO);
    res.json({ url: linkPedido("reparto", p) });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

module.exports = { getReparto, salir, ubicacion, entregar, getSeguimiento, getLinkReparto };
