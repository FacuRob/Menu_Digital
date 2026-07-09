const supabase = require("../config/database");
const { getNegocioId } = require("../utils/negocio");

/**
 * Middleware que valida el plan de la CUENTA dueña del negocio antes de
 * permitir crear un producto nuevo.
 *
 * Bloquea con 403 si:
 *   - la suscripción de la cuenta está cancelada, o
 *   - el negocio ya alcanzó el `limite_productos` del plan.
 *
 * Uso: router.post('/', checkLimiteProductos, createProducto)
 * (va después de authMiddleware + checkPermiso('productos'), que ya
 *  se montan en server.js sobre todo /api/productos).
 */
const checkLimiteProductos = async (req, res, next) => {
  try {
    const negocioId = getNegocioId(req);

    // Traer el negocio + el plan de su cuenta (join por cuenta_id).
    const { data: negocio, error: negocioError } = await supabase
      .from("negocios")
      .select("cuenta_id, cuentas ( limite_productos, estado_suscripcion )")
      .eq("id", negocioId)
      .single();

    if (negocioError || !negocio || !negocio.cuentas) {
      return res
        .status(404)
        .json({ message: "Negocio o cuenta no encontrados" });
    }

    const { limite_productos, estado_suscripcion } = negocio.cuentas;

    // Suscripción cancelada → no puede cargar más productos.
    if (estado_suscripcion === "cancelado") {
      return res.status(403).json({
        error: "SUSCRIPCION_CANCELADA",
        message:
          "La suscripción está cancelada. Reactivala para agregar productos.",
      });
    }

    // Contar productos actuales del negocio (sólo el count, sin traer filas).
    const { count, error: countError } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", negocioId);

    if (countError) throw countError;

    if ((count ?? 0) >= limite_productos) {
      return res.status(403).json({
        error: "LIMITE_PRODUCTOS_ALCANZADO",
        message: `Alcanzaste el límite de ${limite_productos} productos de tu plan. Mejorá tu plan para agregar más.`,
        limite: limite_productos,
        actuales: count ?? 0,
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = checkLimiteProductos;
