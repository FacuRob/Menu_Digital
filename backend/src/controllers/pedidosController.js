const supabase = require("../config/database");
const { getNegocioId } = require("../utils/negocio");
const { respondError } = require("../utils/respondError");

// ── Crear un pedido (público, desde el menú del cliente) ──
const createPedido = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const {
      mesa,
      cliente,
      nota,
      items,
      tipo_entrega,
      direccion_entrega,
      telefono_cliente,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "El pedido debe incluir al menos un producto" });
    }

    // Traer precios/costos/stock reales desde la base (no confiar en el cliente).
    const ids = items
      .map((i) => i.producto_id)
      .filter((id) => Number.isInteger(id));

    let prodsDB = {};
    if (ids.length > 0) {
      const { data: prods, error: prodErr } = await supabase
        .from("productos")
        .select("id, nombre, precio, costo, stock, controlar_stock")
        .eq("negocio_id", negocioId)
        .in("id", ids);
      if (prodErr) throw prodErr;
      prodsDB = Object.fromEntries(prods.map((p) => [p.id, p]));
    }

    // Multi-rubro: opciones de variante elegidas. Se recalcula el precio_extra
    // real desde la BD (scopeado al negocio vía el grupo) — nunca del cliente.
    const opcionIds = [
      ...new Set(
        items
          .flatMap((i) => (Array.isArray(i.opciones) ? i.opciones : []))
          .filter((id) => Number.isInteger(id)),
      ),
    ];
    let opcionesDB = {};
    if (opcionIds.length > 0) {
      const { data: ops, error: opsErr } = await supabase
        .from("variantes_opcion")
        .select("id, nombre, precio_extra, grupo_id, variantes_grupo!inner(negocio_id)")
        .in("id", opcionIds)
        .eq("variantes_grupo.negocio_id", negocioId);
      if (opsErr) throw opsErr;
      opcionesDB = Object.fromEntries((ops || []).map((o) => [o.id, o]));
    }

    const itemsCalc = items.map((i) => {
      const cantidad = Math.max(1, parseInt(i.cantidad, 10) || 1);
      const prod = prodsDB[i.producto_id];
      const base = prod ? Number(prod.precio) : Number(i.precio) || 0;

      // Opciones válidas de este ítem (que pertenezcan al negocio).
      const opsSel = (Array.isArray(i.opciones) ? i.opciones : [])
        .map((id) => opcionesDB[id])
        .filter(Boolean);
      const extra = opsSel.reduce((a, o) => a + Number(o.precio_extra || 0), 0);
      const precio_unit = +(base + extra).toFixed(2);
      const costo_unit = prod ? Number(prod.costo) : 0;

      const baseNombre = prod ? prod.nombre : i.nombre || "Producto";
      const nombre =
        opsSel.length > 0
          ? `${baseNombre} (${opsSel.map((o) => o.nombre).join(", ")})`
          : baseNombre;

      return {
        producto_id: Number.isInteger(i.producto_id) ? i.producto_id : null,
        nombre: nombre.slice(0, 250),
        precio_unit,
        costo_unit,
        cantidad,
        subtotal: +(precio_unit * cantidad).toFixed(2),
      };
    });

    const total = +itemsCalc.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2);

    // Insertar el pedido.
    const { data: pedido, error: pedErr } = await supabase
      .from("pedidos")
      .insert([
        {
          negocio_id: negocioId,
          mesa: mesa || null,
          cliente: cliente || null,
          nota: nota || null,
          tipo_entrega: tipo_entrega || null,
          direccion_entrega: direccion_entrega || null,
          telefono_cliente: telefono_cliente || null,
          total,
          estado: "pendiente",
        },
      ])
      .select()
      .single();

    if (pedErr) throw pedErr;

    // Insertar los items.
    const itemsRows = itemsCalc.map((i) => ({ ...i, pedido_id: pedido.id }));
    const { data: itemsData, error: itemsErr } = await supabase
      .from("pedido_items")
      .insert(itemsRows)
      .select();

    if (itemsErr) throw itemsErr;

    // Descontar stock de los productos que lo controlan.
    await Promise.all(
      itemsCalc.map(async (i) => {
        const prod = prodsDB[i.producto_id];
        if (!prod || !prod.controlar_stock) return;
        const nuevoStock = Math.max(0, Number(prod.stock) - i.cantidad);
        await supabase
          .from("productos")
          .update({ stock: nuevoStock, updated_at: new Date().toISOString() })
          .eq("id", prod.id)
          .eq("negocio_id", negocioId);
      }),
    );

    res.status(201).json({ ...pedido, items: itemsData });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

// ── Listar pedidos (protegida) ──
const getPedidos = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { estado, mesa } = req.query;

    let query = supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .eq("negocio_id", negocioId)
      .order("created_at", { ascending: false });

    if (estado) query = query.eq("estado", estado);
    if (mesa) query = query.eq("mesa", mesa);

    const { data, error } = await query;
    if (error) throw error;

    const result = (data || []).map((p) => {
      const { pedido_items, ...rest } = p;
      return { ...rest, items: pedido_items || [] };
    });

    res.json(result);
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

// ── Obtener un pedido por ID (protegida) ──
const getPedidoById = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);
    const { data, error } = await supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    const { pedido_items, ...rest } = data;
    res.json({ ...rest, items: pedido_items || [] });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

// ── Actualizar estado (protegida) ──
const ESTADOS_VALIDOS = ["pendiente", "preparando", "entregado", "cancelado"];

const updateEstadoPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);
    const { estado } = req.body;

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ message: "Estado inválido" });
    }

    // Registrar la fecha de entrega para que las analíticas cuenten la
    // venta en el mes correcto. Se limpia si el pedido deja de estar entregado.
    const patch = { estado, updated_at: new Date().toISOString() };
    patch.entregado_at = estado === "entregado" ? new Date().toISOString() : null;

    const { data, error } = await supabase
      .from("pedidos")
      .update(patch)
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    res.json(data);
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

module.exports = {
  createPedido,
  getPedidos,
  getPedidoById,
  updateEstadoPedido,
};
