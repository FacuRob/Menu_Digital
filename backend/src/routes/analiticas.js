const express = require("express");
const router = express.Router();
const { getResumen, getHistorial } = require("../controllers/analiticasController");

router.get("/resumen", getResumen);
router.get("/historial", getHistorial);

module.exports = router;
