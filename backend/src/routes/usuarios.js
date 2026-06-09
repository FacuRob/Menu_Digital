const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const checkPermiso = require("../middleware/checkPermiso");
const {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  cambiarPassword,
  deleteUsuario,
  getRoles,
} = require("../controllers/usuariosController");

// Todas las rutas requieren auth + ser superadmin
// checkPermiso('*') equivale a solo superadmin por el permiso wildcard
const soloSuperadmin = [authMiddleware, checkPermiso("*")];

router.get("/", ...soloSuperadmin, getUsuarios);
router.get("/roles", ...soloSuperadmin, getRoles);
router.get("/:id", ...soloSuperadmin, getUsuarioById);
router.post("/", ...soloSuperadmin, createUsuario);
router.put("/:id", ...soloSuperadmin, updateUsuario);
router.put("/:id/password", ...soloSuperadmin, cambiarPassword);
router.delete("/:id", ...soloSuperadmin, deleteUsuario);

module.exports = router;
