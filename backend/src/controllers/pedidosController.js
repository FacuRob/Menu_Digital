const supabase = require("../config/database");
const { getNegocioId } = require("../utils/negocio");
const { respondError } = require("../utils/respondError");
const { notificarPedido } = require("../services/avisosPedidoService");

// Dispara el aviso de WhatsApp en segundo plano (nunca bloquea la respuesta).
const avisarEnSegundoPlano = (pedido, estado) => {
  notificarPedido(pedido, estado).catch((e) =>
    console.error("[Avisos] fallo en segundo plano:", e.message),
  );
};

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
      acepta_whatsapp,
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
        // "*" y no una lista: así no falla si `unidad_venta` aún no existe.
        .select("*")
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
      const prod = prodsDB[i.producto_id];
      // Por peso: cantidad en kg con gramos (mínimo 100 g); si no, unidades enteras.
      const porPeso = prod?.unidad_venta === "kg";
      const cantidad = porPeso
        ? Math.min(99, Math.max(0.1, Math.round((Number(i.cantidad) || 0.1) * 1000) / 1000))
        : Math.max(1, parseInt(i.cantidad, 10) || 1);
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
        ...(porPeso ? { unidad: "kg" } : {}),
      };
    });

    // En un insert de varias filas Supabase manda null en las columnas que
    // faltan: si algún ítem es por peso, todos llevan `unidad`. Si ninguno lo
    // es, no se manda (el pedido funciona aunque la migración no haya corrido).
    if (itemsCalc.some((i) => i.unidad)) {
      for (const i of itemsCalc) i.unidad = i.unidad || "unidad";
    }

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
        const nuevoStock = Math.max(0, +(Number(prod.stock) - i.cantidad).toFixed(3));
        await supabase
          .from("productos")
          .update({ stock: nuevoStock, updated_at: new Date().toISOString() })
          .eq("id", prod.id)
          .eq("negocio_id", negocioId);
      }),
    );

    // Consentimiento para avisos por WhatsApp. Se guarda aparte para que el
    // pedido no falle si la migración db/whatsapp_avisos.sql aún no corrió.
    if (acepta_whatsapp === true && pedido.telefono_cliente) {
      const { error: optErr } = await supabase
        .from("pedidos")
        .update({ acepta_whatsapp: true })
        .eq("id", pedido.id);
      if (!optErr) {
        pedido.acepta_whatsapp = true;
        avisarEnSegundoPlano(pedido, "pendiente"); // "Recibimos tu pedido"
      }
    }

    res.status(201).json({ ...pedido, items: sinCosto(itemsData) });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

// El costo de cada ítem es información privada del negocio: solo se usa en
// las analíticas del Dashboard, nunca se envía en las respuestas de pedidos.
const sinCosto = (items) =>
  (items || []).map(({ costo_unit, ...it }) => it);

// ── Listar pedidos (protegida) ──
// Filtros opcionales:
//   estado, mesa
//   vista=curso      → pendiente, preparando, listo y en camino
//   vista=historial  → entregados y cancelados
//   desde, hasta     → fechas ISO sobre created_at (hasta es exclusivo)
//   limit, offset    → paginado; con `limit` responde { pedidos, total }
// Sin `limit` responde la lista como antes, con un tope de seguridad.
const EN_CURSO = ["pendiente", "preparando", "listo", "en_camino"];
const CERRADOS = ["entregado", "cancelado"];
const fechaISO = (s) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null);

const getPedidos = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { estado, mesa, vista } = req.query;
    const paginado = req.query.limit !== undefined;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const desde = fechaISO(req.query.desde);
    const hasta = fechaISO(req.query.hasta);

    let query = supabase
      .from("pedidos")
      .select("*, pedido_items(*)", paginado ? { count: "exact" } : undefined)
      .eq("negocio_id", negocioId)
      .order("created_at", { ascending: false });

    if (estado) query = query.eq("estado", estado);
    else if (vista === "curso") query = query.in("estado", EN_CURSO);
    else if (vista === "historial") query = query.in("estado", CERRADOS);
    if (mesa) query = query.eq("mesa", mesa);
    if (desde) query = query.gte("created_at", desde);
    if (hasta) query = query.lt("created_at", hasta);
    query = paginado ? query.range(offset, offset + limit - 1) : query.limit(500);

    const { data, error, count } = await query;
    if (error) throw error;

    const pedidos = (data || []).map((p) => {
      const { pedido_items, ...rest } = p;
      return { ...rest, items: sinCosto(pedido_items) };
    });

    res.json(paginado ? { pedidos, total: count ?? pedidos.length } : pedidos);
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
    res.json({ ...rest, items: sinCosto(pedido_items) });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

// ── Actualizar estado (protegida) ──
//   pendiente → preparando → (listo: para retirar | en_camino: delivery) → entregado
//   cancelado en cualquier momento.
const ESTADOS_VALIDOS = [
  "pendiente",
  "preparando",
  "listo",
  "en_camino",
  "entregado",
  "cancelado",
];

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

    // Estado previo: sólo se avisa si realmente cambió (evita mensajes
    // repetidos si el admin toca dos veces el mismo botón).
    const { data: previo } = await supabase
      .from("pedidos")
      .select("estado")
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .maybeSingle();

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

    if (previo && previo.estado !== estado) avisarEnSegundoPlano(data, estado);

    res.json(data);
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

// ── Eliminar un pedido cancelado (protegida) ──
// Sólo cancelados: los entregados son ventas y alimentan el Dashboard.
const deletePedido = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id, estado")
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" });
    if (pedido.estado !== "cancelado") {
      return res.status(400).json({ message: "Sólo se pueden eliminar pedidos cancelados" });
    }

    const { error } = await supabase.from("pedidos").delete().eq("id", id).eq("negocio_id", negocioId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    return respondError(res, error, "pedidos");
  }
};

module.exports = {
  createPedido,
  getPedidos,
  getPedidoById,
  updateEstadoPedido,
  deletePedido,
};
