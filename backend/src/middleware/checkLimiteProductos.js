const { getNegocioId } = require("../utils/negocio");
const { cupoProductos } = require("../utils/planNegocio");

/**
 * Valida el plan de la CUENTA dueña del negocio antes de crear un producto.
 *
 * El plan da un total de productos (Básico 50, Estándar 180, Premium 1000)
 * que se reparte entre los negocios de la cuenta: Estándar con 2 negocios
 * tiene 90 por negocio; con 3, 60. Bloquea con 403 si:
 *   - la suscripción está cancelada,
 *   - el negocio ya llenó su parte, o
 *   - la cuenta ya llegó al total del plan (por ejemplo, si cargó todo en un
 *     negocio antes de crear los otros).
 *
 * Uso: router.post('/', checkLimiteProductos, createProducto)
 */
const checkLimiteProductos = async (req, res, next) => {
  try {
    const c = await cupoProductos(getNegocioId(req));
    if (!c) return res.status(404).json({ message: "Negocio o cuenta no encontrados" });

    if (c.cuenta.estado_suscripcion === "cancelado") {
      return res.status(403).json({
        error: "SUSCRIPCION_CANCELADA",
        message: "La suscripción está cancelada. Reactivala para agregar productos.",
      });
    }

    const reparto = c.negocios > 1 ? ` (${c.total} repartidos entre tus ${c.negocios} negocios)` : "";
    if (c.usados >= c.cupo || c.usadosCuenta >= c.total) {
      return res.status(403).json({
        error: "LIMITE_PRODUCTOS_ALCANZADO",
        message:
          c.usadosCuenta >= c.total
            ? `Alcanzaste los ${c.total} productos de tu plan entre todos tus negocios. Mejorá tu plan para agregar más.`
            : `Este negocio llegó a sus ${c.cupo} productos${reparto}. Mejorá tu plan para agregar más.`,
        limite: c.cupo,
        actuales: c.usados,
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = checkLimiteProductos;
