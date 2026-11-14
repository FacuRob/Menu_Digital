const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { avisosDisponibles } = require("../services/avisosPedidoService");
const { sincronizarSlug } = require("../utils/slug");
const { resolverRubro } = require("../utils/rubros");
const { opcionesAgenda } = require("../utils/agenda");
const { normalizarModalidades } = require("../utils/entregas");
const { modulosDe, normalizar } = require("../utils/modulos");
const { olvidarModulos } = require("../middleware/requiereModulo");

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
    const [cfgRes, negRes, avisosWhatsapp] = await Promise.all([
      supabase
        .from("configuracion")
        .select("*")
        .eq("negocio_id", negocioId)
        .maybeSingle(),
      // tipo_rubro / config_campos viven en `negocios`; los adjuntamos acá
      // para que el panel de configuración los lea/guarde en una sola vista.
      // "*" para no fallar si faltan las columnas de rubros_onboarding.sql;
      // abajo se eligen sólo los campos públicos.
      supabase
        .from("negocios")
        .select("*")
        .eq("id", negocioId)
        .maybeSingle(),
      // ¿El menú ofrece "avisarme por WhatsApp"? (nunca rompe la carga)
      avisosDisponibles(negocioId).catch(() => false),
    ]);

    if (cfgRes.error) throw cfgRes.error;

    const base = cfgRes.data || DEFAULTS(negocioId);
    const modulos = modulosDe(negRes.data);
    // Ruta pública (sin scopeNegocio): el menú ve sólo lo que puede usar. El
    // panel ve lo guardado, para no pisarlo al editar la configuración.
    const esPublica = !Number.isInteger(req.negocioId);
    const sinEntregas = esPublica && !(modulos.pedidos && modulos.entregas);
    res.json({
      ...base,
      modalidades: sinEntregas ? normalizarModalidades(null) : normalizarModalidades(base.modalidades),
      ...(sinEntregas ? { mesas_activo: false, retiro_activo: false, delivery_activo: false } : {}),
      modulos,
      slug: negRes.data?.slug || null,
      tipo_rubro: negRes.data?.tipo_rubro || "gastronomia",
      rubro_categoria: negRes.data?.rubro_categoria || null,
      rubro_especialidad: negRes.data?.rubro_especialidad || null,
      config_campos: negRes.data?.config_campos || {},
      avisos_whatsapp: avisosWhatsapp === true,
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
      ciudad,
      provincia,
      agenda,
      modalidades: modalidadesEntrega,
      tipo_rubro,
      rubro_categoria,
      rubro_especialidad,
      config_campos,
      modulos,
    } = req.body;

    // tipo_rubro / config_campos se guardan en `negocios`, no en `configuracion`.
    // Ciudad y provincia: texto corto o null (largo de las columnas).
    const textoValido = (v, max) => v === undefined || v === null || (typeof v === "string" && v.length <= max);
    if (!textoValido(ciudad, 100) || !textoValido(provincia, 60)) {
      return res.status(400).json({ message: "Ciudad o provincia inválida" });
    }

    // Rubro: se valida contra el catálogo central (utils/rubros).
    const rubro = await resolverRubro({ tipo_rubro, rubro_categoria, rubro_especialidad });
    if (rubro.error) return res.status(400).json({ message: rubro.error });
    const negPatch = { ...rubro.patch };
    if (config_campos !== undefined && config_campos !== null) {
      negPatch.config_campos = config_campos;
    }
    if (modulos !== undefined) {
      if (!modulos || typeof modulos !== "object" || Array.isArray(modulos)) {
        return res.status(400).json({ message: "Módulos inválidos" });
      }
      // Lo que no viene se conserva como estaba (no vuelve al perfil de siempre).
      const { data: actual } = await supabase.from("negocios").select("*").eq("id", negocioId).maybeSingle();
      negPatch.modulos = normalizar(modulos, modulosDe(actual));
    }
    if (Object.keys(negPatch).length > 0) {
      const { error: negErr } = await supabase
        .from("negocios")
        .update(negPatch)
        .eq("id", negocioId);
      if (negErr) throw negErr;
      if (negPatch.modulos) olvidarModulos(negocioId);
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
      ciudad,
      provincia,
      ...(agenda !== undefined ? { agenda: agenda === null ? null : opcionesAgenda(agenda) } : {}),
      ...(modalidadesEntrega !== undefined ? { modalidades: normalizarModalidades(modalidadesEntrega) } : {}),
      updated_at: new Date().toISOString(),
    };

    // upsert por negocio_id (índice único ux_configuracion_negocio).
    const { data, error } = await supabase
      .from("configuracion")
      .upsert(payload, { onConflict: "negocio_id" })
      .select()
      .single();

    if (error) throw error;

    // El link público del menú se arma con el nombre del negocio.
    const slug = await sincronizarSlug(supabase, negocioId, nombre).catch(() => null);

    res.json({
      ...data,
      ...(slug ? { slug } : {}),
      ...rubro.patch,
      ...(config_campos !== undefined ? { config_campos } : {}),
      ...(negPatch.modulos ? { modulos: negPatch.modulos } : {}),
    });
  } catch (error) {
    return respondError(res, error, "configuracion");
  }
};

module.exports = {
  getConfiguracion,
  updateConfiguracion,
};
