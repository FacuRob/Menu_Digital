const express = require("express");
const router = express.Router();
const { getResumen } = require("../controllers/analiticasController");

router.get("/resumen", getResumen);

module.exports = router;
