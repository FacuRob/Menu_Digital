const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { catalogoRubros } = require("../utils/rubros");
const { desdeOnboarding, modulosDe } = require("../utils/modulos");
const { olvidarModulos } = require("../middleware/requiereModulo");

// GET /api/rubros (público) — categorías y especialidades activas.
const getRubros = async (req, res) => {
  try {
    const catalogo = await catalogoRubros();
    // Sólo se cachea una respuesta buena (nunca un error).
    res.set("Cache-Control", "public, max-age=300");
    res.json(catalogo);
  } catch (error) {
    return respondError(res, error, "rubros");
  }
};

// Progreso del onboarding del negocio activo. NULL = negocio anterior a este
// cambio: se lo considera configurado (no se le pide repetirlo).
const estado = (n) => ({
  onboarding: n.onboarding ?? null,
  nombre: n.nombre,
  slug: n.slug,
  activo: n.activo,
  tipo_rubro: n.tipo_rubro || "gastronomia",
  rubro_categoria: n.rubro_categoria || null,
  rubro_especialidad: n.rubro_especialidad || null,
  modulos: modulosDe(n),
});

const leerNegocio = async (negocioId) => {
  // "*" para no fallar si faltan las columnas nuevas.
  const { data, error } = await supabase.from("negocios").select("*").eq("id", negocioId).maybeSingle();
  if (error) throw error;
  return data;
};

// GET /api/onboarding
const getOnboarding = async (req, res) => {
  try {
    const neg = await leerNegocio(getNegocioId(req));
    if (!neg) return res.status(404).json({ message: "Negocio no encontrado" });
    res.json(estado(neg));
  } catch (error) {
    return respondError(res, error, "onboarding");
  }
};

// PUT /api/onboarding — { paso?, ofrece?, funciones?, completado? } (validado
// con zod). Se mezcla con lo guardado. Al completar se publica el negocio.
const updateOnboarding = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const neg = await leerNegocio(negocioId);
    if (!neg) return res.status(404).json({ message: "Negocio no encontrado" });

    const onboarding = { ...(neg.onboarding || {}), ...req.body, actualizado_at: new Date().toISOString() };
    const patch = { onboarding };
    if (req.body.completado === true) patch.activo = true;
    // Ya terminado (o negocio anterior al onboarding nuevo), los módulos se
    // cambian sólo desde Configuración.
    const yaTerminado = !neg.onboarding || neg.onboarding.completado === true;
    if (!yaTerminado && (req.body.ofrece || req.body.funciones)) {
      patch.modulos = desdeOnboarding(onboarding, neg.tipo_rubro);
    }

    const { data, error } = await supabase
      .from("negocios")
      .update(patch)
      .eq("id", negocioId)
      .select("*")
      .single();
    if (error) throw error;
    if (patch.modulos) olvidarModulos(negocioId);
    res.json(estado(data));
  } catch (error) {
    return respondError(res, error, "onboarding");
  }
};

module.exports = { getRubros, getOnboarding, updateOnboarding };
