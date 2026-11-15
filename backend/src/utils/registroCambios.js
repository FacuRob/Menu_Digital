// ══════════════════════════════════════════════════════════════
// Registro de cambios: quién hizo qué en el panel (tabla registro_cambios).
// Nunca frena ni rompe la acción principal: se escribe en segundo plano y,
// si falla (por ejemplo, falta la migración), sólo queda en el log.
// ══════════════════════════════════════════════════════════════
const supabase = require("../config/database");
const { getCuentaId } = require("./cuenta");

/**
 * registrar(req, accion, entidad, entidadId?, detalle?)
 *  req: el request (de ahí salen cuenta, negocio, usuario y Tech) o un
 *       objeto { user, negocioId } armado a mano.
 */
function registrar(req, accion, entidad, entidadId = null, detalle = null) {
  const u = req?.user || {};
  const fila = {
    cuenta_id: u.cuenta_id ?? null, // tokens viejos sin cuenta: se busca abajo
    negocio_id: req?.negocioId ?? null,
    usuario_id: u.id ?? null,
    tech_id: u.tech_id ?? null,
    accion,
    entidad,
    entidad_id: entidadId == null ? null : String(entidadId),
    detalle,
  };
  try {
    Promise.resolve(fila.cuenta_id ?? (u.id ? getCuentaId(req) : null))
      .then((cuenta) => supabase.from("registro_cambios").insert([{ ...fila, cuenta_id: cuenta ?? null }]))
      .then((r) => r?.error && console.error("[registro]", r.error.message))
      .catch((e) => console.error("[registro]", e.message));
  } catch (e) {
    console.error("[registro]", e.message);
  }
}

module.exports = { registrar };
