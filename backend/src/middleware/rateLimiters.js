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

// Links públicos del delivery: el repartidor manda su ubicación cada ~10 s y
// el cliente consulta el mapa cada ~10 s. Alcanza con holgura para eso.
const repartoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Esperá un momento." },
});

// Soporte: reportes, mensajes y capturas. Holgado para charlar, corta el spam.
const soporteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Mandaste muchos mensajes seguidos. Esperá unos minutos." },
});

// Reportes nuevos: por usuario (cada uno manda un email al dueño).
const soporteCrearLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u${req.user?.id}`,
  message: { message: "Ya enviaste varios reportes. Esperá un rato o seguí en uno abierto." },
});

module.exports = { authLimiter, pedidosLimiter, repartoLimiter, soporteLimiter, soporteCrearLimiter };
