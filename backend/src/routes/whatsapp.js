const express = require("express");
const router = express.Router();
const {
  getAvisos,
  updateAvisos,
  getMensajes,
  postPrueba,
} = require("../controllers/whatsappController");

// Montado en server.js con authMiddleware + scopeNegocio + checkSuscripcion
// + checkPermiso("configuracion").
router.get("/avisos", getAvisos);
router.put("/avisos", updateAvisos);
router.get("/mensajes", getMensajes);
router.post("/prueba", postPrueba);

module.exports = router;
