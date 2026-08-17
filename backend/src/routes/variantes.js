const express = require("express");
const router = express.Router();
const {
  getVariantesProducto,
  createGrupo,
  updateGrupo,
  deleteGrupo,
} = require("../controllers/variantesController");
const { validate } = require("../middleware/validate");
const {
  varianteGrupoSchema,
  updateVarianteGrupoSchema,
} = require("../schemas");

// Grupos de variantes de un producto (admin). El scope por negocio y el
// permiso `productos` se montan en server.js.
router.get("/producto/:productoId", getVariantesProducto);
router.post(
  "/producto/:productoId",
  validate(varianteGrupoSchema),
  createGrupo,
);
router.put("/grupo/:grupoId", validate(updateVarianteGrupoSchema), updateGrupo);
router.delete("/grupo/:grupoId", deleteGrupo);

module.exports = router;
