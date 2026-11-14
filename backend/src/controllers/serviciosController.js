const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { modulosNegocio } = require("../middleware/requiereModulo");

// Servicios: entidad aparte de los productos (corte de pelo, instalación
// eléctrica, consultoría…). Precio fijo, "desde" o variable (a consultar),
// duración y modalidades (presencial, a domicilio, virtual).

// Lo que se guarda (el body ya pasó por zod).
const datos = (b) => ({
  nombre: b.nombre,
  descripcion: b.descripcion ?? null,
  imagen_url: b.imagen_url ?? null,
  categoria: b.categoria ?? null,
  tipo_precio: b.tipo_precio,
  // Variable = a consultar: sin precio.
  precio: b.tipo_precio === "variable" ? null : b.precio ?? null,
  duracion_min: b.duracion_min ?? null,
  modalidades: b.modalidades,
  requiere_turno: b.requiere_turno,
  requiere_presupuesto: b.requiere_presupuesto,
  activo: b.activo,
  orden: b.orden,
});

// GET /api/servicios (panel)
const getServicios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("servicios")
      .select("*")
      .eq("negocio_id", getNegocioId(req))
      .order("orden", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    return respondError(res, error, "servicios");
  }
};

// POST /api/servicios
const createServicio = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("servicios")
      .insert([{ ...datos(req.body), negocio_id: getNegocioId(req) }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    return respondError(res, error, "servicios");
  }
};

// PUT /api/servicios/:id
const updateServicio = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("servicios")
      .update({ ...datos(req.body), updated_at: new Date().toISOString() })
      .eq("id", parseInt(req.params.id, 10))
      .eq("negocio_id", getNegocioId(req))
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Servicio no encontrado" });
    res.json(data);
  } catch (error) {
    return respondError(res, error, "servicios");
  }
};

// DELETE /api/servicios/:id
const deleteServicio = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("servicios")
      .delete()
      .eq("id", parseInt(req.params.id, 10))
      .eq("negocio_id", getNegocioId(req))
      .select("id");
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ message: "Servicio no encontrado" });
    res.json({ message: "Servicio eliminado" });
  } catch (error) {
    return respondError(res, error, "servicios");
  }
};

// GET /api/servicios/disponibles (público, negocio por ?negocio= o header)
const getServiciosDisponibles = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    if (!(await modulosNegocio(negocioId)).servicios) return res.json([]);
    const { data, error } = await supabase
      .from("servicios")
      .select("id, nombre, descripcion, imagen_url, categoria, tipo_precio, precio, duracion_min, modalidades, requiere_turno, requiere_presupuesto, orden")
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("id", { ascending: true });
    // Sin la tabla (migración pendiente) el menú sigue andando sin servicios.
    if (error) return res.json([]);
    res.json(data || []);
  } catch (error) {
    return respondError(res, error, "servicios");
  }
};

module.exports = { getServicios, createServicio, updateServicio, deleteServicio, getServiciosDisponibles };
