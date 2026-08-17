const express = require("express");
const router = express.Router();
const {
  getEstado,
  getCheckout,
  getPortal,
} = require("../controllers/suscripcionController");

// Todas requieren estar logueado (se monta authMiddleware en server.js).
// NO llevan checkSuscripcion: un usuario vencido debe poder ver su estado
// y comprar/gestionar su plan desde acá.
router.get("/", getEstado);
router.get("/portal", getPortal);
router.get("/checkout/:plan", getCheckout);

module.exports = router;
