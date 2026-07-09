const express = require("express");
const router = express.Router();
const {
  getNegocios,
  createNegocio,
  updateNegocio,
  deleteNegocio,
} = require("../controllers/negociosController");
const checkLimiteNegocios = require("../middleware/checkLimiteNegocios");

router.get("/", getNegocios);
router.post("/", checkLimiteNegocios, createNegocio);
router.put("/:id", updateNegocio);
router.delete("/:id", deleteNegocio);

module.exports = router;
