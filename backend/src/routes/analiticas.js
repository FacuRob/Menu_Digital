const express = require("express");
const router = express.Router();
const { getResumen, getHistorial, getActividad } = require("../controllers/analiticasController");

router.get("/resumen", getResumen);
router.get("/historial", getHistorial);
router.get("/actividad", getActividad);

module.exports = router;
