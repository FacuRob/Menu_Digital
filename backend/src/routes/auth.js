const express = require("express");
const router = express.Router();
const {
  register,
  login,
  verifyToken,
  forgotPassword,
  changePassword,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermiso = require("../middleware/checkPermiso");

// Públicas
router.post("/login", login);
router.post("/forgot-password", forgotPassword);

// Solo superadmin puede registrar usuarios
router.post("/register", authMiddleware, checkPermiso("*"), register);

// Verificar token
router.get("/verify", authMiddleware, verifyToken);

// Cambiar contraseña (usuario autenticado con must_change_password)
router.post("/change-password", authMiddleware, changePassword);

module.exports = router;
