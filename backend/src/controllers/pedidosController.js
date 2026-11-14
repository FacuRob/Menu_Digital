const supabase = require("../config/database");
const { getNegocioId } = require("../utils/negocio");
const { respondError } = require("../utils/respondError");
const { notificarPedido } = require("../services/avisosPedidoService");
const { mesaValida, normalizarMesa } = require("../utils/mesaQr");
const { firmaValida, linkPedido } = require("../utils/linksPedido");
const { modulosNegocio } = require("../middleware/requiereModulo");
const { validarPersonalizacion } = require("../utils/personalizacion");

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
      mesa_token,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "El pedido debe incluir al menos un producto" });
    }

    // Módulos del negocio: sin "pedidos" no se toman pedidos online.
    const modulos = await modulosNegocio(negocioId);
    if (!modulos.pedidos) {
      return res.status(403).json({ error: "MODULO_INACTIVO", message: "Este negocio no toma pedidos online." });
    }

    // Tipo de entrega según la configuración ACTUAL del local (no la del
    // cliente). "*" para no fallar si falta alguna columna nueva.
    const { data: cfg, error: cfgErr } = await supabase
      .from("configuracion")
      .select("*")
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (cfgErr) throw cfgErr;

    const MSG_QR = "Para pedir en la mesa, escaneá el código QR de tu mesa.";
    if (!modulos.entregas && tipo_entrega) {
      return res.status(400).json({ message: "Ese tipo de entrega no está disponible en este local." });
    }
    if (cfg) {
      // Sin el módulo de entregas, ninguna (pedido en mostrador).
      const conEntregas = modulos.entregas;
      const activas = {
        mesa: conEntregas && !!cfg.mesas_activo && Number(cfg.mesas_cantidad) > 0,
        retiro: conEntregas && !!cfg.retiro_activo,
        delivery: conEntregas && !!cfg.delivery_activo,
      };
      if (tipo_entrega && !activas[tipo_entrega]) {
        return res.status(400).json({ message: "Ese tipo de entrega no está disponible en este local." });
      }
      // Sin tipo sólo vale si el local no ofrece ninguno (pedido en mostrador).
      if (!tipo_entrega && (activas.mesa || activas.retiro || activas.delivery)) {
        const soloMesa = activas.mesa && !activas.retiro && !activas.delivery;
        return res
          .status(400)
          .json({ message: soloMesa ? MSG_QR : "Elegí cómo querés recibir tu pedido." });
      }
    }

    // "En mesa" sólo con el QR firmado de esa mesa, y si la mesa existe hoy:
    // el cliente no puede elegir ni cambiar la mesa. Con otro tipo de entrega
    // la mesa se descarta.
    let mesaFinal = null;
    if (tipo_entrega === "mesa") {
      const m = normalizarMesa(mesa);
      const n = Number(m);
      const existe = !!cfg && Number.isInteger(n) && n >= 1 && n <= Number(cfg.mesas_cantidad || 0);
      if (!existe || !mesaValida(negocioId, m, mesa_token, cfg.mesas_qr_version ?? 1)) {
        return res.status(400).json({ message: MSG_QR });
      }
      mesaFinal = m;
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

    // Cada ítem tiene que ser un producto real, de este negocio y disponible.
    // Nunca se usa el precio ni el nombre que manda el cliente.
    if (items.some((i) => !prodsDB[i.producto_id] || prodsDB[i.producto_id].disponible === false)) {
      return res
        .status(400)
        .json({ message: "Algún producto ya no está disponible. Actualizá el menú y volvé a intentar." });
    }

    // Variantes de los productos del pedido (scopeadas al negocio). El precio
    // extra se toma de la BD y se valida que cada opción sea de ese producto,
    // esté activa y con stock, y que se respeten los grupos obligatorios y
    // los de una sola opción.
    const hayOpciones = items.some((i) => Array.isArray(i.opciones) && i.opciones.length > 0);
    const { data: grupos, error: grpErr } = await supabase
      .from("variantes_grupo")
      .select("id, producto_id, nombre, tipo, obligatorio, variantes_opcion(id, nombre, precio_extra, activo, stock)")
      .eq("negocio_id", negocioId)
      .in("producto_id", ids);
    // Sin la tabla de variantes sólo se aceptan pedidos sin opciones.
    if (grpErr && hayOpciones) throw grpErr;
    const gruposPorProducto = {};
    for (const g of grpErr ? [] : grupos || []) {
      const opciones = (g.variantes_opcion || []).filter(
        (o) => o.activo !== false && (o.stock === null || o.stock === undefined || Number(o.stock) > 0),
      );
      (gruposPorProducto[g.producto_id] ||= []).push({ ...g, opciones });
    }

    const errorOpciones = (i) => {
      const elegidas = new Set(Array.isArray(i.opciones) ? i.opciones : []);
      const gs = gruposPorProducto[i.producto_id] || [];
      const validas = new Set(gs.flatMap((g) => g.opciones.map((o) => o.id)));
      if ([...elegidas].some((id) => !validas.has(id))) {
        return "Alguna opción elegida ya no está disponible. Actualizá el menú y volvé a intentar.";
      }
      for (const g of gs) {
        const n = g.opciones.filter((o) => elegidas.has(o.id)).length;
        if (g.tipo === "single" && n > 1) return `En "${g.nombre}" elegí una sola opción.`;
        // Un grupo obligatorio sin opciones disponibles no bloquea el pedido.
        if (g.obligatorio && g.opciones.length > 0 && n === 0) return `Elegí una opción de "${g.nombre}".`;
      }
      return null;
    };
    for (const i of items) {
      const msg = errorOpciones(i);
      if (msg) return res.status(400).json({ message: msg });
    }

    // Opciones válidas, con el nombre de su grupo (para la foto del pedido).
    const opcionesDB = Object.fromEntries(
      Object.values(gruposPorProducto)
        .flat()
        .flatMap((g) => g.opciones.map((o) => [o.id, { ...o, grupo: g.nombre }])),
    );

    // Personalización (módulo "personalizados"): lo que completa el cliente se
    // valida contra los campos del producto y queda como foto en el ítem.
    const pidePersonalizacion = items.some((i) => Array.isArray(i.personalizacion) && i.personalizacion.length > 0);
    const camposPorProducto = {};
    let adjuntosValidos = {};
    if (modulos.personalizados) {
      const { data: campos, error: cErr } = await supabase
        .from("producto_campos")
        .select("*")
        .eq("negocio_id", negocioId)
        .in("producto_id", ids);
      // Sin la tabla (migración pendiente) sólo valen pedidos sin personalizar.
      if (cErr && pidePersonalizacion) throw cErr;
      for (const c of cErr ? [] : campos || []) (camposPorProducto[c.producto_id] ||= []).push(c);

      const tokens = [
        ...new Set(items.flatMap((i) => (Array.isArray(i.personalizacion) ? i.personalizacion : []).map((p) => p.adjunto).filter(Boolean))),
      ];
      if (tokens.length) {
        // Archivos de ESTE negocio, sin usar y subidos en las últimas 24 h.
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: adjs, error: aErr } = await supabase
          .from("adjuntos")
          .select("id, token, tipo, nombre")
          .eq("negocio_id", negocioId)
          .eq("usado", false)
          .gte("created_at", desde)
          .in("token", tokens);
        if (aErr) throw aErr;
        adjuntosValidos = Object.fromEntries((adjs || []).map((a) => [a.token, a]));
      }
    }
    const personalizaciones = [];
    for (const i of items) {
      const r = validarPersonalizacion(
        camposPorProducto[i.producto_id] || [],
        modulos.personalizados ? i.personalizacion : [],
        adjuntosValidos,
      );
      if (r.error) return res.status(400).json({ message: r.error });
      personalizaciones.push(r);
    }

    const itemsCalc = items.map((i, idx) => {
      const prod = prodsDB[i.producto_id];
      // Por peso: cantidad en kg con gramos (mínimo 100 g); si no, unidades enteras.
      const porPeso = prod.unidad_venta === "kg";
      const cantidad = porPeso
        ? Math.min(99, Math.max(0.1, Math.round((Number(i.cantidad) || 0.1) * 1000) / 1000))
        : Math.max(1, parseInt(i.cantidad, 10) || 1);
      const base = Number(prod.precio);

      const opsSel = [...new Set(Array.isArray(i.opciones) ? i.opciones : [])].map((id) => opcionesDB[id]);
      const extra = opsSel.reduce((a, o) => a + Number(o.precio_extra || 0), 0);
      const precio_unit = +(base + extra).toFixed(2);
      const costo_unit = Number(prod.costo) || 0;

      const nombre =
        opsSel.length > 0
          ? `${prod.nombre} (${opsSel.map((o) => o.nombre).join(", ")})`
          : prod.nombre;

      return {
        producto_id: prod.id,
        // pedido_items.nombre es VARCHAR(150).
        nombre: nombre.slice(0, 150),
        // Uso interno (descuento de stock por opción); no se inserta.
        _opciones: opsSel,
        precio_unit,
        costo_unit,
        cantidad,
        subtotal: +(precio_unit * cantidad).toFixed(2),
        ...(porPeso ? { unidad: "kg" } : {}),
        // Foto histórica: lo que eligió y completó el cliente, tal cual.
        opciones: opsSel.length
          ? opsSel.map((o) => ({ grupo: o.grupo, opcion: o.nombre, precio_extra: Number(o.precio_extra || 0) }))
          : null,
        personalizacion: personalizaciones[idx].snapshot,
      };
    });

    // En un insert de varias filas Supabase manda null en las columnas que
    // faltan: si algún ítem es por peso, todos llevan `unidad`. Si ninguno lo
    // es, no se manda (el pedido funciona aunque la migración no haya corrido).
    if (itemsCalc.some((i) => i.unidad)) {
      for (const i of itemsCalc) i.unidad = i.unidad || "unidad";
    }

    const total = +itemsCalc.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2);

    // Stock a descontar (sumando las líneas del mismo producto u opción).
    const porProducto = {};
    const porOpcion = {};
    for (const i of itemsCalc) {
      porProducto[i.producto_id] = (porProducto[i.producto_id] || 0) + i.cantidad;
      // Stock por opción en unidades: una línea por peso descuenta 1.
      const unidades = i.unidad === "kg" ? 1 : i.cantidad;
      for (const o of i._opciones) {
        if (o.stock !== null && o.stock !== undefined) porOpcion[o.id] = (porOpcion[o.id] || 0) + unidades;
      }
    }

    const pedidoBase = {
      negocio_id: negocioId,
      mesa: mesaFinal,
      cliente: cliente || null,
      nota: nota || null,
      tipo_entrega: tipo_entrega || null,
      direccion_entrega: direccion_entrega || null,
      telefono_cliente: telefono_cliente || null,
      total,
    };
    const filas = itemsCalc.map(({ _opciones, ...i }) => i);

    // Todo en una transacción (db/catalogo_universal.sql). Si la función
    // todavía no existe, se guarda como siempre.
    let guardado = await guardarConRpc({
      pedidoBase,
      filas,
      stock: Object.entries(porProducto)
        .filter(([id]) => prodsDB[id].controlar_stock)
        .map(([id, cantidad]) => ({ id: Number(id), cantidad })),
      stockOpciones: Object.entries(porOpcion).map(([id, cantidad]) => ({ id: Number(id), cantidad })),
      adjuntos: [...new Set(personalizaciones.flatMap((p) => p.tokens))],
    });
    if (!guardado) {
      if (filas.some((i) => i.personalizacion)) throw new Error("Falta correr db/catalogo_universal.sql");
      guardado = await guardarSinRpc({ pedidoBase, filas, porProducto, porOpcion, prodsDB, opcionesDB, negocioId });
    }
    const { pedido, items: itemsData } = guardado;

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
    if (error.status === 400) return res.status(400).json({ message: error.message });
    return respondError(res, error, "pedidos");
  }
};

// Pedido + ítems + stock + adjuntos en una transacción. null si la función
// todavía no existe en la base (migración pendiente).
async function guardarConRpc({ pedidoBase, filas, stock, stockOpciones, adjuntos }) {
  const { data, error } = await supabase.rpc("crear_pedido", {
    p_pedido: pedidoBase,
    p_items: filas,
    p_stock: stock,
    p_stock_opciones: stockOpciones,
    p_adjuntos: adjuntos,
  });
  if (error) {
    // PGRST202: la función no existe (todavía no se corrió la migración).
    if (error.code === "PGRST202") return null;
    if (String(error.message || "").includes("ADJUNTO_NO_DISPONIBLE")) {
      const e = new Error("Un archivo ya no está disponible. Subilo de nuevo.");
      e.status = 400;
      throw e;
    }
    throw error;
  }
  return { pedido: data.pedido, items: data.items };
}

// Camino anterior (sin la función SQL): no es atómico, pero si fallan los
// ítems se borra el pedido para no dejarlo vacío.
async function guardarSinRpc({ pedidoBase, filas, porProducto, porOpcion, prodsDB, opcionesDB, negocioId }) {
  const { data: pedido, error: pedErr } = await supabase
    .from("pedidos")
    .insert([{ ...pedidoBase, estado: "pendiente" }])
    .select()
    .single();
  if (pedErr) throw pedErr;

  // Sin la migración no existen las columnas de la foto histórica.
  const itemsRows = filas.map(({ opciones, personalizacion, ...i }) => ({ ...i, pedido_id: pedido.id }));
  const { data: itemsData, error: itemsErr } = await supabase.from("pedido_items").insert(itemsRows).select();
  if (itemsErr) {
    await supabase.from("pedidos").delete().eq("id", pedido.id).eq("negocio_id", negocioId);
    throw itemsErr;
  }

  const ahora = new Date().toISOString();
  const logStock = (r) => r?.error && console.error("[Pedidos] no se pudo descontar stock:", r.error.message);
  await Promise.all([
    ...Object.entries(porProducto).map(async ([id, cant]) => {
      const prod = prodsDB[id];
      if (!prod.controlar_stock) return;
      const nuevoStock = Math.max(0, +(Number(prod.stock) - cant).toFixed(3));
      logStock(
        await supabase
          .from("productos")
          .update({ stock: nuevoStock, updated_at: ahora })
          .eq("id", prod.id)
          .eq("negocio_id", negocioId),
      );
    }),
    ...Object.entries(porOpcion).map(async ([id, cant]) => {
      const o = opcionesDB[id];
      // La opción ya se validó contra el negocio (vino de sus grupos).
      logStock(
        await supabase
          .from("variantes_opcion")
          .update({ stock: Math.max(0, Number(o.stock) - cant) })
          .eq("id", o.id),
      );
    }),
  ]);
  return { pedido, items: itemsData };
}

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

// ── Ticket público (link firmado que llega por WhatsApp) ──
// Sin teléfono ni dirección del cliente: sólo lo que va en un ticket.
const getTicketPublico = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(404).json({ message: "Ticket no encontrado" });

    const { data: p, error } = await supabase
      .from("pedidos")
      .select("id, negocio_id, cliente, tipo_entrega, mesa, total, estado, created_at, entregado_at, pedido_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!p || p.estado !== "entregado" || !firmaValida("ticket", p.id, p.negocio_id, req.query.t)) {
      return res.status(404).json({ message: "Ticket no encontrado" });
    }

    const { data: local } = await supabase
      .from("configuracion")
      .select("nombre, direccion, telefono, logo_url, color_primario, moneda")
      .eq("negocio_id", p.negocio_id)
      .maybeSingle();

    res.json({
      id: p.id,
      cliente: p.cliente,
      tipo_entrega: p.tipo_entrega,
      mesa: p.mesa,
      total: p.total,
      estado: p.estado,
      created_at: p.created_at,
      entregado_at: p.entregado_at,
      items: (p.pedido_items || []).map(({ nombre, cantidad, precio_unit, subtotal, unidad }) => ({
        nombre, cantidad, precio_unit, subtotal, unidad: unidad || "unidad",
      })),
      local: local || { nombre: "El local" },
    });
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

    if (!previo) return res.status(404).json({ message: "Pedido no encontrado" });

    // Condicionado al estado leído: si el repartidor lo cambió en el medio
    // (link de reparto), no se pisa ni se avisa dos veces.
    const { data, error } = await supabase
      .from("pedidos")
      .update(patch)
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .eq("estado", previo.estado)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(409).json({ message: "El pedido cambió mientras tanto. Recargá la lista." });
    }

    if (previo.estado !== estado) avisarEnSegundoPlano(data, estado);

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
  // Los usa la conversión de presupuestos en pedido.
  guardarConRpc,
  guardarSinRpc,
  getPedidos,
  getPedidoById,
  updateEstadoPedido,
  deletePedido,
  getTicketPublico,
};
