const express = require("express");
const router = express.Router();
const {
  getConfiguracion,
  updateConfiguracion,
  updateEnvio,
  updatePagos,
} = require("../controllers/configuracionController");

// Ruta pública (para el menú del cliente)
router.get("/", getConfiguracion);

// Ruta para el administrador (protegida por el middleware al montarla)
router.put("/", updateConfiguracion);
// Costo del envío: sólo el dueño (se valida en el controller).
router.put("/envio", updateEnvio);
// Medios de pago: sólo el dueño (se valida en el controller).
router.put("/pagos", updatePagos);

module.exports = router;
