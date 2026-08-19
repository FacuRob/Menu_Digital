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

// Gestión de usuarios: requiere el permiso "usuarios". Lo tienen el dueño
// (rol 'admin', vía "*") y el "Admin" (rol 'manager'). El staff no lo tiene.
// La jerarquía fina (quién puede crear/editar/borrar a quién) se valida en el
// controller: el manager sólo gestiona staff.
const gestionUsuarios = [authMiddleware, checkPermiso("usuarios")];

router.get("/", ...gestionUsuarios, getUsuarios);
router.get("/roles", ...gestionUsuarios, getRoles);
router.get("/:id", ...gestionUsuarios, getUsuarioById);
router.post("/", ...gestionUsuarios, createUsuario);
router.put("/:id", ...gestionUsuarios, updateUsuario);
router.put("/:id/password", ...gestionUsuarios, cambiarPassword);
router.delete("/:id", ...gestionUsuarios, deleteUsuario);

module.exports = router;
