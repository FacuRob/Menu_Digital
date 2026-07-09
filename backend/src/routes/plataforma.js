const express = require("express");
const router = express.Router();
const { getCuentas, getResumen } = require("../controllers/plataformaController");

router.get("/cuentas", getCuentas);
router.get("/resumen", getResumen);

module.exports = router;
