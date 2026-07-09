const express = require("express");
const router = express.Router();
const {
  register,
  login,
  verifyToken,
  forgotPassword,
  resetPassword,
  changePassword,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermiso = require("../middleware/checkPermiso");
const { authLimiter } = require("../middleware/rateLimiters");
const { validate } = require("../middleware/validate");
const {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require("../schemas");

// Públicas (con rate-limit anti fuerza bruta / spam + validación)
router.post("/login", authLimiter, validate(loginSchema), login);
router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);

// Solo superadmin puede registrar usuarios
router.post(
  "/register",
  authMiddleware,
  checkPermiso("*"),
  validate(registerSchema),
  register,
);

// Verificar token
router.get("/verify", authMiddleware, verifyToken);

// Cambiar contraseña (usuario autenticado con must_change_password)
router.post(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  changePassword,
);

module.exports = router;
