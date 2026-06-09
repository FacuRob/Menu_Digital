const express = require("express");
const router = express.Router();
const {
  register,
  login,
  verifyToken,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermiso = require("../middleware/checkPermiso");

// Login — público
router.post("/login", login);

// Register — solo superadmin (ya no es público)
router.post("/register", authMiddleware, checkPermiso("*"), register);

// Verify — cualquier usuario autenticado
router.get("/verify", authMiddleware, verifyToken);

module.exports = router;
