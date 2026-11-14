const supabase = require("../config/database");
const { modulosDe, REGISTRO } = require("../utils/modulos");

// Módulos por negocio, con caché corta (se consultan en cada request de
// pedidos/productos). Al guardar módulos se limpia la entrada del negocio.
// Ojo: la limpieza es por proceso. Con una sola instancia en Render es
// inmediata; con varias, otra instancia puede tardar hasta TTL_MS.
const TTL_MS = 60 * 1000;
const MAX_ENTRADAS = 1000;
const cache = new Map();

async function modulosNegocio(negocioId) {
  const hit = cache.get(negocioId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.modulos;
  // "*" para no fallar si db/modulos.sql no corrió (queda el perfil de siempre).
  const { data, error } = await supabase.from("negocios").select("*").eq("id", negocioId).maybeSingle();
  if (error) throw error;
  const modulos = modulosDe(data);
  // Ids inexistentes (las rutas públicas reciben cualquier número) no se
  // guardan, para que la caché no crezca sin límite.
  if (data) {
    if (cache.size >= MAX_ENTRADAS) cache.clear();
    cache.set(negocioId, { modulos, at: Date.now() });
  }
  return modulos;
}

const olvidarModulos = (negocioId) => cache.delete(negocioId);

const nombre = (codigo) => REGISTRO.find((m) => m.codigo === codigo)?.nombre || codigo;

/**
 * Corta con 403 MODULO_INACTIVO si el negocio no usa ese módulo.
 * Va DESPUÉS de scopeNegocio (usa req.negocioId). Si la consulta falla deja
 * pasar: no se bloquea un negocio por un error momentáneo.
 */
const requiereModulo = (codigo) => async (req, res, next) => {
  let modulos;
  try {
    modulos = await modulosNegocio(req.negocioId);
  } catch (e) {
    console.error("[requiereModulo]", e.message);
    return next();
  }
  if (modulos[codigo]) return next();
  return res.status(403).json({
    error: "MODULO_INACTIVO",
    message: `Este negocio no tiene activo el módulo "${nombre(codigo)}". Podés activarlo en Configuración → Módulos.`,
  });
};

module.exports = { requiereModulo, modulosNegocio, olvidarModulos };
