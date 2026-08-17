const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");

// Rubros soportados (multi-rubro). Debe coincidir con el CHECK de la BD
// (db/multirubro.sql → chk_tipo_rubro).
const RUBROS = ["gastronomia", "retail", "servicios", "generico"];

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
    const [cfgRes, negRes] = await Promise.all([
      supabase
        .from("configuracion")
        .select("*")
        .eq("negocio_id", negocioId)
        .maybeSingle(),
      // tipo_rubro / config_campos viven en `negocios`; los adjuntamos acá
      // para que el panel de configuración los lea/guarde en una sola vista.
      supabase
        .from("negocios")
        .select("slug, tipo_rubro, config_campos")
        .eq("id", negocioId)
        .maybeSingle(),
    ]);

    if (cfgRes.error) throw cfgRes.error;

    const base = cfgRes.data || DEFAULTS(negocioId);
    res.json({
      ...base,
      slug: negRes.data?.slug || null,
      tipo_rubro: negRes.data?.tipo_rubro || "gastronomia",
      config_campos: negRes.data?.config_campos || {},
    });
  } catch (error) {
    return respondError(res, error, "configuracion");
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
      tipo_rubro,
      config_campos,
    } = req.body;

    // tipo_rubro / config_campos se guardan en `negocios`, no en `configuracion`.
    if (tipo_rubro !== undefined || config_campos !== undefined) {
      const negPatch = {};
      if (tipo_rubro !== undefined) {
        if (!RUBROS.includes(tipo_rubro)) {
          return res.status(400).json({ message: "Tipo de rubro inválido" });
        }
        negPatch.tipo_rubro = tipo_rubro;
      }
      if (config_campos !== undefined && config_campos !== null) {
        negPatch.config_campos = config_campos;
      }
      const { error: negErr } = await supabase
        .from("negocios")
        .update(negPatch)
        .eq("id", negocioId);
      if (negErr) throw negErr;
    }

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
    res.json({
      ...data,
      ...(tipo_rubro !== undefined ? { tipo_rubro } : {}),
      ...(config_campos !== undefined ? { config_campos } : {}),
    });
  } catch (error) {
    return respondError(res, error, "configuracion");
  }
};

module.exports = {
  getConfiguracion,
  updateConfiguracion,
};
