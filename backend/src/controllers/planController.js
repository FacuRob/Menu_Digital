const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { limitesEfectivos, funcionesDe, planEfectivo, estaVigente, modulosVigentes } = require("../utils/suscripcion");
const { cupoProductos } = require("../utils/planNegocio");

/**
 * Devuelve el plan de la cuenta dueña del negocio activo + el uso actual.
 * Lo consume el frontend-admin para mostrar "X / Y" y avisar antes de
 * chocar el límite (evita el 403). Sólo requiere estar logueado.
 *
 * GET /api/plan   (header X-Negocio-Id = negocio activo)
 */
const getPlan = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const c = await cupoProductos(negocioId);
    if (!c) return res.status(404).json({ message: "Negocio o cuenta no encontrados" });

    // Límites vigentes (en prueba gratis, los del plan de prueba).
    const limites = limitesEfectivos(c.cuenta);
    res.json({
      tipo_plan: c.cuenta.tipo_plan,
      estado_suscripcion: c.cuenta.estado_suscripcion,
      // Cancelada sigue vigente hasta periodo_fin (el mes que ya pagó).
      vigente: estaVigente(c.cuenta),
      limite_negocios: limites.negocios,
      negocios_usados: c.negocios,
      // Productos: la parte de ESTE negocio (el total del plan repartido
      // entre los negocios de la cuenta) y el total de la cuenta.
      limite_productos: c.cupo,
      productos_usados: c.usados,
      limite_productos_total: c.total,
      productos_usados_cuenta: c.usadosCuenta,
      // Plan que rige hoy (en prueba gratis, el de prueba) y qué funciones
      // pagas puede usar (por el plan o por un módulo sumado):
      // whatsapp (avisos y chats), ia (asistente) y mapa (repartidor).
      plan_efectivo: planEfectivo(c.cuenta),
      ...funcionesDe(c.cuenta),
      modulos: modulosVigentes(c.cuenta),
    });
  } catch (error) {
    return respondError(res, error, "plan");
  }
};

module.exports = { getPlan };
