// ══════════════════════════════════════════════════════════════
// Catálogo central de rubros (db/rubros_onboarding.sql). Es la única fuente:
// el panel lo pide a GET /api/rubros y el backend valida contra él.
// ══════════════════════════════════════════════════════════════

// tipo_rubro de siempre: lo usa el menú público para íconos y vocabulario.
// Cada categoría del catálogo pertenece a una de estas familias.
const FAMILIAS = ["gastronomia", "retail", "servicios", "generico"];

const OFRECE = ["productos", "personalizados", "servicios"];
const FUNCIONES = ["venta_directa", "pedidos", "retiro", "envios", "presencial", "virtual", "reservas", "presupuestos"];

const TTL_MS = 5 * 60 * 1000;
let cache = null;
let cacheAt = 0;

// { categorias: [{ codigo, nombre, descripcion, familia, icono, sugerencias,
//   especialidades: [{ codigo, nombre, sugerencias }] }] } — solo activos.
async function catalogoRubros() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  // Se carga acá (no arriba) para que schemas/ pueda usar las constantes
  // sin abrir la base.
  const supabase = require("../config/database");
  const [cats, esps] = await Promise.all([
    supabase
      .from("rubros_categorias")
      .select("codigo, nombre, descripcion, familia, icono, sugerencias, orden")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("rubros_especialidades")
      .select("codigo, categoria, nombre, sugerencias, orden")
      .eq("activo", true)
      .order("orden", { ascending: true }),
  ]);
  if (cats.error) throw cats.error;
  if (esps.error) throw esps.error;

  const categorias = (cats.data || []).map(({ orden, ...c }) => ({
    ...c,
    especialidades: (esps.data || [])
      .filter((e) => e.categoria === c.codigo)
      .map(({ codigo, nombre, sugerencias }) => ({ codigo, nombre, sugerencias: sugerencias || c.sugerencias || {} })),
  }));
  cache = { categorias };
  cacheAt = Date.now();
  return cache;
}

const limpiarCache = () => {
  cache = null;
};

// Traduce lo que manda el panel a columnas de `negocios`.
//   { rubro_categoria?, rubro_especialidad?, tipo_rubro? }
// → { patch } con rubro_categoria, rubro_especialidad y tipo_rubro (la familia)
// → { error } si algo no existe o no cuadra.
// Sin campos de rubro devuelve { patch: {} }.
async function resolverRubro({ rubro_categoria, rubro_especialidad, tipo_rubro } = {}) {
  const hayCatalogo = rubro_categoria !== undefined || rubro_especialidad !== undefined;
  if (!hayCatalogo) {
    if (tipo_rubro === undefined) return { patch: {} };
    // Compatibilidad: clientes viejos que mandan sólo tipo_rubro.
    return FAMILIAS.includes(tipo_rubro) ? { patch: { tipo_rubro } } : { error: "Tipo de rubro inválido" };
  }

  const { categorias } = await catalogoRubros();
  let cat = null;
  let esp = null;
  if (rubro_especialidad) {
    cat = categorias.find((c) => c.especialidades.some((e) => e.codigo === rubro_especialidad));
    if (!cat) return { error: "Especialidad inválida" };
    if (rubro_categoria && rubro_categoria !== cat.codigo) {
      return { error: "La especialidad no corresponde a esa categoría" };
    }
    esp = rubro_especialidad;
  } else {
    cat = categorias.find((c) => c.codigo === rubro_categoria);
    if (!cat) return { error: "Categoría de rubro inválida" };
  }
  return { patch: { rubro_categoria: cat.codigo, rubro_especialidad: esp, tipo_rubro: cat.familia } };
}

module.exports = { FAMILIAS, OFRECE, FUNCIONES, catalogoRubros, resolverRubro, limpiarCache };
