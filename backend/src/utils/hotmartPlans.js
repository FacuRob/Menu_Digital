// Mapea el product_id de Hotmart → { plan, ciclo } del SaaS.
// Se configura por variables de entorno (listas de ids), así podés
// cambiar/añadir productos sin tocar el código:
//
//   HOTMART_PRODUCTS_BASIC="1234567"
//   HOTMART_PRODUCTS_STANDARD="2345678,2345679"
//   HOTMART_PRODUCTS_PREMIUM="3456789"
//
// El ciclo se deduce de listas separadas de ids anuales (opcional).
// Si un id no está en ninguna lista anual, se asume 'mensual':
//
//   HOTMART_PRODUCTS_BASIC_ANNUAL="1234599"
//   HOTMART_PRODUCTS_STANDARD_ANNUAL="2345699"
//   HOTMART_PRODUCTS_PREMIUM_ANNUAL="3456799"
//
// Un product_id no mapeado devuelve { plan: null } (el webhook lo ignora).

const parseIds = (raw) =>
  (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const planPorProducto = (productId) => {
  const id = String(productId ?? "");
  if (!id) return { plan: null, ciclo: "mensual" };

  const enAnual =
    parseIds(process.env.HOTMART_PRODUCTS_BASIC_ANNUAL).includes(id) ||
    parseIds(process.env.HOTMART_PRODUCTS_STANDARD_ANNUAL).includes(id) ||
    parseIds(process.env.HOTMART_PRODUCTS_PREMIUM_ANNUAL).includes(id);
  const ciclo = enAnual ? "anual" : "mensual";

  const inList = (name) =>
    parseIds(process.env[name]).includes(id) ||
    parseIds(process.env[`${name}_ANNUAL`]).includes(id);

  if (inList("HOTMART_PRODUCTS_PREMIUM")) return { plan: "premium", ciclo };
  if (inList("HOTMART_PRODUCTS_STANDARD")) return { plan: "standard", ciclo };
  if (inList("HOTMART_PRODUCTS_BASIC")) return { plan: "basic", ciclo };
  return { plan: null, ciclo };
};

module.exports = { planPorProducto };
