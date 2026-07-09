const express = require("express");
const router = express.Router();
const {
  getConfiguracion,
  updateConfiguracion,
} = require("../controllers/configuracionController");

// Ruta pública (para el menú del cliente)
router.get("/", getConfiguracion);

// Ruta para el administrador (protegida por el middleware al montarla)
router.put("/", updateConfiguracion);

module.exports = router;
