const supabase = require("../config/database");
const { getNegocioId } = require("../utils/negocio");

/**
 * Devuelve el plan de la cuenta dueña del negocio activo + el uso actual.
 * Lo consume el frontend-admin para mostrar "X / Y" y avisar antes de
 * chocar el límite (evita el 403). Sólo requiere estar logueado.
 *
 * GET /api/plan   (header X-Negocio-Id = negocio activo)
 */
const getPlan = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);

    // Negocio activo + plan de su cuenta.
    const { data: negocio, error: negocioError } = await supabase
      .from("negocios")
      .select(
        "cuenta_id, cuentas ( tipo_plan, estado_suscripcion, limite_negocios, limite_productos )",
      )
      .eq("id", negocioId)
      .single();

    if (negocioError || !negocio || !negocio.cuentas) {
      return res
        .status(404)
        .json({ message: "Negocio o cuenta no encontrados" });
    }

    const cuenta = negocio.cuentas;

    // Uso: negocios de la cuenta + productos del negocio activo.
    const [{ count: negociosUsados }, { count: productosUsados }] =
      await Promise.all([
        supabase
          .from("negocios")
          .select("id", { count: "exact", head: true })
          .eq("cuenta_id", negocio.cuenta_id),
        supabase
          .from("productos")
          .select("id", { count: "exact", head: true })
          .eq("negocio_id", negocioId),
      ]);

    res.json({
      tipo_plan: cuenta.tipo_plan,
      estado_suscripcion: cuenta.estado_suscripcion,
      limite_negocios: cuenta.limite_negocios,
      negocios_usados: negociosUsados ?? 0,
      limite_productos: cuenta.limite_productos,
      productos_usados: productosUsados ?? 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getPlan };
