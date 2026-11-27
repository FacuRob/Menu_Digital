const { negocioIncluye } = require("../utils/planNegocio");

const MENSAJES = {
  whatsapp: {
    error: "PLAN_SIN_WHATSAPP",
    message: "WhatsApp viene en los planes Estándar y Pro. En el Básico lo podés sumar como módulo desde Suscripción.",
  },
  mapa: {
    error: "PLAN_SIN_MAPA",
    message:
      "El mapa del repartidor viene en los planes Estándar y Pro. En el Básico lo podés sumar como módulo desde Suscripción.",
  },
};

/**
 * Corta con 403 si la cuenta no tiene `codigo` ("whatsapp" o "mapa") ni por
 * su plan ni como módulo sumado.
 *
 * Va DESPUÉS de scopeNegocio (usa req.negocioId).
 */
const requiere = (codigo) => async (req, res, next) => {
  if (await negocioIncluye(req.negocioId, codigo)) return next();
  return res.status(403).json(MENSAJES[codigo]);
};

const requiereWhatsapp = requiere("whatsapp");

module.exports = requiereWhatsapp;
module.exports.requiereMapa = requiere("mapa");
