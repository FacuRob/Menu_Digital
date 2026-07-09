const supabase = require("../config/database");

// Resuelve la cuenta + si es usuario de plataforma (god-mode cross-cuenta).
// Prioriza los datos del JWT; si el token es viejo (sin cuenta_id), los busca
// en la BD por el id del usuario.
const getAuthScope = async (req) => {
  const u = req.user || {};
  // Tokens nuevos siempre llevan cuenta_id (default 1 tras la migración).
  if (u.cuenta_id !== undefined && u.cuenta_id !== null) {
    return { cuentaId: u.cuenta_id, esPlataforma: u.es_plataforma === true };
  }
  if (!u.id) return { cuentaId: null, esPlataforma: false };
  const { data } = await supabase
    .from("usuarios")
    .select("cuenta_id, es_plataforma")
    .eq("id", u.id)
    .single();
  return {
    cuentaId: data?.cuenta_id ?? null,
    esPlataforma: data?.es_plataforma === true,
  };
};

// Compat: sólo la cuenta (usado donde el bypass de plataforma no aplica).
const getCuentaId = async (req) => (await getAuthScope(req)).cuentaId;

module.exports = { getCuentaId, getAuthScope };
