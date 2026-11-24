const express = require("express");
const { asistenteLimiter } = require("../middleware/rateLimiters");
const { getNegocioId } = require("../utils/negocio");
const { getCuentaId } = require("../utils/cuenta");
const asistente = require("../services/asistenteService");

const router = express.Router();

// ¿Está disponible DinexAI? (el panel oculta el botón si no hay clave).
router.get("/", (req, res) => res.json({ disponible: asistente.dinexAIConfigurado() }));

// POST { mensajes: [{ role: "user"|"assistant", content }], nombre? }
router.post("/", asistenteLimiter, async (req, res) => {
  if (!asistente.dinexAIConfigurado()) {
    return res.status(503).json({ message: "DinexAI no está disponible en este momento." });
  }
  try {
    const nombre = String(req.body?.nombre || "")
      .replace(/[^\p{L} '-]/gu, "")
      .trim()
      .slice(0, 30);
    const respuesta = await asistente.responder({
      negocioId: getNegocioId(req),
      cuentaId: await getCuentaId(req),
      nombreUsuario: nombre,
      mensajes: req.body?.mensajes,
    });
    res.json({ respuesta });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    console.error("[DinexAI]", err.message);
    res.status(502).json({ message: "DinexAI no pudo responder ahora. Probá de nuevo en un momento." });
  }
});

module.exports = router;
