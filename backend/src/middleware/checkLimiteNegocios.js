const supabase = require("../config/database");
const { getCuentaId } = require("../utils/cuenta");
const { limitesEfectivos } = require("../utils/suscripcion");

/**
 * Middleware que valida el plan de la cuenta antes de permitir crear un
 * NEGOCIO nuevo (multi-tenant).
 *
 *   free     → 1 negocio  (sin multi-tenant)
 *   basic    → 3 negocios
 *   standard → 10 negocios
 *   premium  → ilimitado
 *
 * Bloquea con 403 si la suscripción está cancelada o si la cuenta ya
 * alcanzó su `limite_negocios`.
 *
 * La cuenta se toma del usuario autenticado (JWT). Deja `req.cuentaId`
 * para el controller.
 *
 * Uso: router.post('/', checkLimiteNegocios, createNegocio)
 */
const checkLimiteNegocios = async (req, res, next) => {
  try {
    const cuentaId = await getCuentaId(req);
    if (!cuentaId) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    const { data: cuenta, error: cuentaError } = await supabase
      .from("cuentas")
      .select("limite_negocios, estado_suscripcion")
      .eq("id", cuentaId)
      .single();

    if (cuentaError || !cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    if (cuenta.estado_suscripcion === "cancelado") {
      return res.status(403).json({
        error: "SUSCRIPCION_CANCELADA",
        message:
          "La suscripción está cancelada. Reactivala para crear negocios.",
      });
    }

    const { count, error: countError } = await supabase
      .from("negocios")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuentaId);

    if (countError) throw countError;

    // En prueba gratis rigen los límites del plan de prueba (ver limitesEfectivos).
    const limite = limitesEfectivos(cuenta).negocios;
    if ((count ?? 0) >= limite) {
      return res.status(403).json({
        error: "LIMITE_NEGOCIOS_ALCANZADO",
        message:
          limite === 1
            ? "Tu plan permite un solo negocio. Mejorá tu plan para habilitar multi-negocio."
            : `Alcanzaste el límite de ${limite} negocios de tu plan. Mejorá tu plan para agregar más.`,
        limite,
        actuales: count ?? 0,
      });
    }

    req.cuentaId = cuentaId;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = checkLimiteNegocios;
