const express = require("express");
const { asistenteLimiter } = require("../middleware/rateLimiters");
const { getNegocioId } = require("../utils/negocio");
const { getCuentaId } = require("../utils/cuenta");
const asistente = require("../services/asistenteService");

const router = express.Router();

function motivoTecnico(err) {
  const st = Number(err.status);
  if (err.name === "AbortError") return "OpenRouter tardó más de 30 s en responder.";
  if (st === 401 || st === 403) return "la clave de OpenRouter no es válida. Revisá DINEXAI_API_KEY en Render (sin comillas ni espacios).";
  if (st === 402) return "la cuenta de OpenRouter no tiene crédito o la clave tiene un límite de gasto agotado.";
  if (st === 429) return "OpenRouter está saturado o se pasó el límite de uso. Probá en un rato.";
  if (st === 404 || /model/i.test(err.message)) return `problema con el modelo (DINEXAI_MODEL): ${err.message}`;
  return err.message || "error desconocido";
}

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
    console.error("[DinexAI]", err.status, err.message);
    // El motivo técnico (clave, crédito, modelo) sólo lo ve Tech.
    const tech = req.user?.es_plataforma === true;
    res.status(502).json({
      message: tech
        ? `DinexAI falló: ${motivoTecnico(err)}`
        : "DinexAI no pudo responder ahora. Probá de nuevo en un momento.",
    });
  }
});

module.exports = router;
