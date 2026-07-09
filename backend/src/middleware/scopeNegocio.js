const supabase = require("../config/database");
const { getAuthScope } = require("../utils/cuenta");

/**
 * Aísla el tenant: valida que el negocio pedido en el header X-Negocio-Id
 * pertenezca a la cuenta del usuario autenticado, y lo fija en req.negocioId
 * para que los controllers (vía getNegocioId) operen sólo sobre él.
 *
 * Sin este middleware, el header es controlable por el cliente y un usuario
 * podría leer/escribir datos de otra cuenta.
 *
 * Debe ir DESPUÉS de authMiddleware. Uso:
 *   app.use("/api/productos", authMiddleware, scopeNegocio, checkPermiso(...), routes)
 */
const scopeNegocio = async (req, res, next) => {
  try {
    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    const solicitado = parseInt(req.headers?.["x-negocio-id"], 10);
    let negocioId = null;

    // Si pidió un negocio explícito, se valida su pertenencia. El usuario de
    // plataforma puede operar sobre cualquier negocio (sin filtro de cuenta).
    if (Number.isInteger(solicitado) && solicitado > 0) {
      let q = supabase.from("negocios").select("id").eq("id", solicitado);
      if (!esPlataforma) q = q.eq("cuenta_id", cuentaId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (data) {
        negocioId = data.id;
      } else if (!esPlataforma) {
        // No es suyo (o header stale). No servimos otra cuenta: caemos a su
        // propio negocio por defecto. Nunca hay fuga cross-tenant.
        console.warn(
          `[scopeNegocio] negocio ${solicitado} no pertenece a la cuenta ${cuentaId}; usando el negocio por defecto`,
        );
      }
    }

    // Sin negocio resuelto: primer negocio (de la cuenta, o global si plataforma).
    if (!negocioId) {
      let q = supabase.from("negocios").select("id");
      if (!esPlataforma) q = q.eq("cuenta_id", cuentaId);
      const { data, error } = await q
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res
          .status(403)
          .json({ message: "No hay negocios disponibles" });
      }
      negocioId = data.id;
    }

    req.negocioId = negocioId;
    req.cuentaId = cuentaId;
    req.esPlataforma = esPlataforma;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = scopeNegocio;
