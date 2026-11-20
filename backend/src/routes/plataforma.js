const express = require("express");
const router = express.Router();
const { getCuentas, getResumen, getRiesgo, verComoCliente } = require("../controllers/plataformaController");
const { crearCupones, listarCupones, eliminarCupon } = require("../controllers/cuponesController");

router.get("/cuentas", getCuentas);
router.get("/resumen", getResumen);
router.get("/riesgo", getRiesgo);
router.post("/cuentas/:id/ver", verComoCliente);

// Cupones de descuento para la suscripción.
router.get("/cupones", listarCupones);
router.post("/cupones", crearCupones);
router.delete("/cupones/:id", eliminarCupon);

module.exports = router;
