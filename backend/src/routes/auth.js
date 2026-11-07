const express = require("express");
const router = express.Router();
const {
  register,
  login,
  signup,
  googleAuth,
  verifyToken,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  changeEmail,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermiso = require("../middleware/checkPermiso");
const { authLimiter } = require("../middleware/rateLimiters");
const { validate } = require("../middleware/validate");
const {
  loginSchema,
  registerSchema,
  signupSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  changeEmailSchema,
} = require("../schemas");

// Públicas (con rate-limit anti fuerza bruta / spam + validación)
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/signup", authLimiter, validate(signupSchema), signup);
router.post("/google", authLimiter, validate(googleAuthSchema), googleAuth);
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

// "Mi cuenta" del usuario logueado. Cambiar contraseña y email piden la
// contraseña actual, por eso llevan rate-limit.
router.post(
  "/change-password",
  authMiddleware,
  authLimiter,
  validate(changePasswordSchema),
  changePassword,
);
router.put(
  "/profile",
  authMiddleware,
  validate(updateProfileSchema),
  updateProfile,
);
router.put(
  "/email",
  authMiddleware,
  authLimiter,
  validate(changeEmailSchema),
  changeEmail,
);

module.exports = router;
