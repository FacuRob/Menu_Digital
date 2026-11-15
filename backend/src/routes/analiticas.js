const express = require("express");
const router = express.Router();
const { getResumen, getHistorial, getActividad, getAgenda } = require("../controllers/analiticasController");

router.get("/resumen", getResumen);
router.get("/historial", getHistorial);
router.get("/actividad", getActividad);
router.get("/agenda", getAgenda);

module.exports = router;
