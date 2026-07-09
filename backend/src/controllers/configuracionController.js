const supabase = require("../config/database");
const { getNegocioId } = require("../utils/negocio");

const DEFAULTS = (negocioId) => ({
  negocio_id: negocioId,
  nombre: "Mi Restaurante",
  descripcion: null,
  direccion: null,
  telefono: null,
  whatsapp: null,
  email: null,
  horarios: null,
  logo_url: null,
  portada_url: null,
  mesas_activo: false,
  mesas_cantidad: 0,
  delivery_activo: false,
  retiro_activo: true,
  color_primario: "#ff5722",
  horarios_config: null,
  moneda: "ARS",
});

// Obtener la configuración del negocio. Ruta pública.
const getConfiguracion = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { data, error } = await supabase
      .from("configuracion")
      .select("*")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (error) throw error;
    res.json(data || DEFAULTS(negocioId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar la configuración del negocio. Ruta protegida.
const updateConfiguracion = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const {
      nombre,
      descripcion,
      direccion,
      telefono,
      whatsapp,
      email,
      horarios,
      logo_url,
      portada_url,
      mesas_activo,
      mesas_cantidad,
      delivery_activo,
      retiro_activo,
      color_primario,
      horarios_config,
      moneda,
    } = req.body;

    const payload = {
      negocio_id: negocioId,
      nombre,
      descripcion,
      direccion,
      telefono,
      whatsapp,
      email,
      horarios,
      logo_url,
      portada_url,
      mesas_activo,
      mesas_cantidad,
      delivery_activo,
      retiro_activo,
      color_primario,
      horarios_config,
      moneda,
      updated_at: new Date().toISOString(),
    };

    // upsert por negocio_id (índice único ux_configuracion_negocio).
    const { data, error } = await supabase
      .from("configuracion")
      .upsert(payload, { onConflict: "negocio_id" })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getConfiguracion,
  updateConfiguracion,
};
