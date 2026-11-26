const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { avisosDisponibles } = require("../services/avisosPedidoService");
const { sincronizarSlug } = require("../utils/slug");
const { resolverRubro } = require("../utils/rubros");
const { opcionesAgenda } = require("../utils/agenda");
const { normalizarModalidades } = require("../utils/entregas");
const { normalizarEnvio, validarEnvio } = require("../utils/envio");
const { normalizarPagos, validarPagos } = require("../utils/pagos");
const { registrar } = require("../utils/registroCambios");
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
      envio: normalizarEnvio(base.envio),
      pagos: pagosVisibles(normalizarPagos(base.pagos), esPublica),
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

// En el menú los datos de la cuenta sólo se muestran si la transferencia está activa.
const pagosVisibles = (p, esPublica) =>
  esPublica && !p.transferencia ? { ...p, alias: "", cbu: "", titular: "", banco: "" } : p;

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
    let modulosCambiaron = false;
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
      // Al registro sólo va un cambio real (antes cada guardado decía
      // "cambió los módulos" aunque nadie los tocara).
      modulosCambiaron = JSON.stringify(negPatch.modulos) !== JSON.stringify(modulosDe(actual));
    }
    if (Object.keys(negPatch).length > 0) {
      const { error: negErr } = await supabase
        .from("negocios")
        .update(negPatch)
        .eq("id", negocioId);
      if (negErr) throw negErr;
      if (negPatch.modulos) olvidarModulos(negocioId);
      if (modulosCambiaron) registrar(req, "modulos", "negocio", negocioId, negPatch.modulos);
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

// Costo del envío y medios de pago. Sólo el dueño de la cuenta (rol 'admin'):
// ni Admin (manager) ni Staff. Van aparte de updateConfiguracion para que
// guardar la configuración general nunca los pise.
const guardarSoloDueno = ({ campo, validar, normalizar, quien, migracion }) => async (req, res) => {
  try {
    if (req.user?.rol !== "admin") {
      return res.status(403).json({ message: `Sólo el dueño de la cuenta puede cambiar ${quien}.` });
    }
    const negocioId = getNegocioId(req);
    const { valor, error: invalido } = validar(req.body);
    if (invalido) return res.status(400).json({ message: invalido });

    const { data, error } = await supabase
      .from("configuracion")
      .upsert({ negocio_id: negocioId, [campo]: valor, updated_at: new Date().toISOString() }, { onConflict: "negocio_id" })
      .select(campo)
      .single();
    // Falta la migración: avisar claro en vez de un 500.
    if (error && new RegExp(campo).test(error.message || "") && ["42703", "PGRST204"].includes(error.code)) {
      return res.status(503).json({ message: `Falta activar ${quien} en la base (db/${migracion}).` });
    }
    if (error) throw error;
    registrar(req, campo, "negocio", negocioId, campo === "pagos" ? { efectivo: valor.efectivo, transferencia: valor.transferencia } : valor);
    res.json({ [campo]: normalizar(data?.[campo]) });
  } catch (error) {
    return respondError(res, error, "configuracion");
  }
};

const updateEnvio = guardarSoloDueno({
  campo: "envio", validar: validarEnvio, normalizar: normalizarEnvio, quien: "el costo del envío", migracion: "costo_envio.sql",
});
const updatePagos = guardarSoloDueno({
  campo: "pagos", validar: validarPagos, normalizar: normalizarPagos, quien: "los medios de pago", migracion: "medios_pago.sql",
});

module.exports = {
  getConfiguracion,
  updateConfiguracion,
  updateEnvio,
  updatePagos,
};
