const supabase = require("../config/database");
const { estaVigente } = require("../utils/suscripcion");

// Bloquea el acceso a los datos del panel cuando la suscripción/trial venció.
// - Los usuarios de plataforma (es_plataforma) nunca se bloquean.
// - Devuelve 402 con error tipado SUSCRIPCION_VENCIDA para que el frontend
//   redirija a la página de suscripción.
// - Fail-open: si falla la verificación, deja pasar (no romper por un error
//   transitorio de BD).
//
// NO se monta en /api/plan ni /api/suscripcion (para que el usuario vencido
// pueda ver su estado y comprar un plan), ni en las rutas públicas del menú.
const checkSuscripcion = async (req, res, next) => {
  try {
    if (req.user?.es_plataforma === true) return next();

    const cuentaId = req.user?.cuenta_id;
    if (!cuentaId) return next(); // otros middlewares deciden el 403 sin cuenta

    const { data } = await supabase
      .from("cuentas")
      .select("estado_suscripcion, periodo_fin")
      .eq("id", cuentaId)
      .single();

    if (data && !estaVigente(data)) {
      return res.status(402).json({
        error: "SUSCRIPCION_VENCIDA",
        message:
          "Tu período de prueba o suscripción venció. Elegí un plan para seguir usando el panel.",
      });
    }
    return next();
  } catch {
    return next();
  }
};

module.exports = checkSuscripcion;
