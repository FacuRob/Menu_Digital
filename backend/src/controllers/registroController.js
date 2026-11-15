// GET /api/usuarios/registro → últimos cambios importantes de la cuenta
// (módulos, usuarios, productos borrados, ingresos de Soporte).
const supabase = require("../config/database");
const { getCuentaId } = require("../utils/cuenta");
const { respondError } = require("../utils/respondError");

const LIMITE = 100;

const listar = async (req, res) => {
  try {
    const cuentaId = await getCuentaId(req);
    if (!cuentaId) return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    const { data, error } = await supabase
      .from("registro_cambios")
      .select("id, negocio_id, usuario_id, tech_id, accion, entidad, entidad_id, detalle, created_at")
      .eq("cuenta_id", cuentaId)
      .order("created_at", { ascending: false })
      .limit(LIMITE);
    if (error) {
      // Sin la migración la tabla no existe: lista vacía. Otro error, sí falla.
      if (["42P01", "PGRST205"].includes(error.code)) return res.json([]);
      throw error;
    }
    // Nombres de quién lo hizo (sólo usuarios de esta cuenta).
    const ids = [...new Set((data || []).map((r) => r.usuario_id).filter(Boolean))];
    const nombres = new Map();
    if (ids.length) {
      const { data: us } = await supabase.from("usuarios").select("id, username, nombre").eq("cuenta_id", cuentaId).in("id", ids);
      for (const u of us || []) nombres.set(u.id, u.nombre || u.username);
    }
    res.json(
      (data || []).map((r) => ({
        ...r,
        // Soporte mira la cuenta "como" el dueño: se muestra que fue Soporte.
        quien: r.tech_id ? "Soporte DinexFlow" : nombres.get(r.usuario_id) || null,
      })),
    );
  } catch (error) {
    return respondError(res, error, "registro");
  }
};

module.exports = { listar };
