const { getAuthScope } = require("../utils/cuenta");

// Guardia para rutas exclusivas del DUEÑO del SaaS (god-mode cross-cuenta).
// Sólo pasa si el usuario tiene es_plataforma = true. Un superadmin de cliente
// Hotmart (es_plataforma = false) recibe 403: nunca ve datos de otras cuentas.
const requirePlataforma = async (req, res, next) => {
  try {
    const { esPlataforma } = await getAuthScope(req);
    if (!esPlataforma) {
      return res
        .status(403)
        .json({ message: "Acceso exclusivo del panel de plataforma" });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = requirePlataforma;
