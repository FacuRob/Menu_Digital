const { negocioConWhatsapp } = require("../utils/planNegocio");

/**
 * Corta con 403 si el plan de la cuenta no incluye WhatsApp (Básico).
 * WhatsApp, chats, el bot con IA y el mapa del repartidor son del plan
 * Estándar o Premium (y de la prueba gratis).
 *
 * Va DESPUÉS de scopeNegocio (usa req.negocioId).
 */
const requiereWhatsapp = async (req, res, next) => {
  if (await negocioConWhatsapp(req.negocioId)) return next();
  return res.status(403).json({
    error: "PLAN_SIN_WHATSAPP",
    message:
      "WhatsApp, el bot con IA y el seguimiento del repartidor son del plan Estándar o Premium. Mejorá tu plan para usarlos.",
  });
};

module.exports = requiereWhatsapp;
