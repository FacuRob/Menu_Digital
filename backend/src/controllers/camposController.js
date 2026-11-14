const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { modulosNegocio } = require("../middleware/requiereModulo");

// Campos de personalización de un producto (producto_campos). El panel
// manda la lista completa y se reemplaza: primero se guardan los nuevos y
// después se borran los que ya no están (si algo falla, no se pierde nada).
// Los pedidos viejos no cambian: guardaron su propia foto de los campos.

const productoDelNegocio = async (negocioId, productoId) => {
  const { data, error } = await supabase
    .from("productos")
    .select("id")
    .eq("id", productoId)
    .eq("negocio_id", negocioId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
};

const ordenar = (lista) => [...lista].sort((a, b) => a.orden - b.orden || a.id - b.id);

// GET /api/productos/:id/campos
const getCampos = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const id = parseInt(req.params.id, 10);
    if (!(await productoDelNegocio(negocioId, id))) return res.status(404).json({ message: "Producto no encontrado" });
    const { data, error } = await supabase
      .from("producto_campos")
      .select("*")
      .eq("producto_id", id)
      .eq("negocio_id", negocioId);
    if (error) throw error;
    res.json(ordenar(data || []));
  } catch (error) {
    return respondError(res, error, "campos");
  }
};

// PUT /api/productos/:id/campos  body: { campos: [...] } (validado con zod)
const putCampos = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const id = parseInt(req.params.id, 10);
    if (!(await modulosNegocio(negocioId)).personalizados) {
      return res.status(403).json({
        error: "MODULO_INACTIVO",
        message: 'Activá el módulo "Productos personalizados" en Configuración → Módulos.',
      });
    }
    if (!(await productoDelNegocio(negocioId, id))) return res.status(404).json({ message: "Producto no encontrado" });

    const { data: previos, error: prevErr } = await supabase
      .from("producto_campos")
      .select("id")
      .eq("producto_id", id)
      .eq("negocio_id", negocioId);
    if (prevErr) throw prevErr;

    const existentes = new Set((previos || []).map((p) => p.id));
    const fila = (c, i) => ({
      producto_id: id,
      negocio_id: negocioId,
      tipo: c.tipo,
      etiqueta: c.etiqueta,
      ayuda: c.ayuda || null,
      opciones: c.opciones || [],
      obligatorio: !!c.obligatorio,
      orden: i,
      validaciones: c.validaciones || {},
    });
    const guardados = [];
    // Los que ya existen (de este producto) se actualizan con su mismo id.
    for (const [i, c] of req.body.campos.entries()) {
      if (!c.id || !existentes.has(c.id)) continue;
      const { data, error } = await supabase
        .from("producto_campos")
        .update(fila(c, i))
        .eq("id", c.id)
        .eq("negocio_id", negocioId)
        .select()
        .single();
      if (error) throw error;
      guardados.push(data);
    }
    const nuevos = req.body.campos
      .map((c, i) => (c.id && existentes.has(c.id) ? null : fila(c, i)))
      .filter(Boolean);
    if (nuevos.length) {
      const { data, error } = await supabase.from("producto_campos").insert(nuevos).select();
      if (error) throw error;
      guardados.push(...(data || []));
    }
    const conservados = new Set(req.body.campos.map((c) => c.id).filter(Boolean));
    const viejos = [...existentes].filter((x) => !conservados.has(x));
    if (viejos.length) {
      const { error } = await supabase
        .from("producto_campos")
        .delete()
        .eq("negocio_id", negocioId)
        .in("id", viejos);
      if (error) throw error;
    }
    res.json(ordenar(guardados));
  } catch (error) {
    return respondError(res, error, "campos");
  }
};

// Campos de todos los productos de un negocio, por producto (menú público).
const camposPorProducto = async (negocioId) => {
  const { data, error } = await supabase.from("producto_campos").select("*").eq("negocio_id", negocioId);
  if (error) return {}; // sin la tabla (migración pendiente): sin personalización
  const porProducto = {};
  for (const c of ordenar(data || [])) {
    const { negocio_id, created_at, ...publico } = c;
    (porProducto[c.producto_id] ||= []).push(publico);
  }
  return porProducto;
};

module.exports = { getCampos, putCampos, camposPorProducto };
