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

// Todas las rutas requieren auth + permiso "*" (rol admin). El staff, con
// permisos acotados, no accede a la gestión de usuarios.
const soloAdmin = [authMiddleware, checkPermiso("*")];

router.get("/", ...soloAdmin, getUsuarios);
router.get("/roles", ...soloAdmin, getRoles);
router.get("/:id", ...soloAdmin, getUsuarioById);
router.post("/", ...soloAdmin, createUsuario);
router.put("/:id", ...soloAdmin, updateUsuario);
router.put("/:id/password", ...soloAdmin, cambiarPassword);
router.delete("/:id", ...soloAdmin, deleteUsuario);

module.exports = router;
