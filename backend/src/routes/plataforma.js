const express = require("express");
const router = express.Router();
const { getCuentas, getResumen, verComoCliente } = require("../controllers/plataformaController");

router.get("/cuentas", getCuentas);
router.get("/resumen", getResumen);
router.post("/cuentas/:id/ver", verComoCliente);

module.exports = router;
