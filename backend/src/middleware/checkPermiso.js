const supabase = require("../config/database");

/**
 * Middleware factory que verifica si el usuario tiene el permiso requerido.
 * Uso: router.get('/ruta', authMiddleware, checkPermiso('categorias'), handler)
 *
 * El superadmin con permiso "*" pasa siempre.
 */
const checkPermiso = (permiso) => {
  return async (req, res, next) => {
    try {
      const { rol } = req.user;

      // Obtener permisos del rol desde la base de datos
      const { data, error } = await supabase
        .from("roles_permisos")
        .select("permisos")
        .eq("rol", rol)
        .single();

      if (error || !data) {
        return res.status(403).json({ message: "Rol no reconocido" });
      }

      const permisos = data.permisos;

      // Superadmin tiene acceso total
      if (permisos.includes("*")) {
        return next();
      }

      // Verificar permiso específico
      if (!permisos.includes(permiso)) {
        return res.status(403).json({
          message: `No tenés permiso para acceder a: ${permiso}`,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

module.exports = checkPermiso;
