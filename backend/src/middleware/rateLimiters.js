const rateLimit = require("express-rate-limit");

// Limita login / recuperación de contraseña por IP (anti fuerza bruta y
// anti spam de resets). Ventana de 15 min.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados intentos. Probá de nuevo en unos minutos.",
  },
});

// Limita la creación de pedidos públicos por IP (anti spam de pedidos falsos
// y anti vaciado de stock por pedidos masivos). Ventana de 5 min.
const pedidosLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados pedidos seguidos. Esperá un momento e intentá de nuevo.",
  },
});

module.exports = { authLimiter, pedidosLimiter };
