// Mapea el variant_id de Lemon Squeezy → { plan, ciclo } del SaaS.
// Se configura por env (listas CSV de variant_id), así se cambian los
// productos sin tocar el código:
//
//   LEMONSQUEEZY_VARIANTS_BASIC="111111"
//   LEMONSQUEEZY_VARIANTS_STANDARD="222222,222223"
//   LEMONSQUEEZY_VARIANTS_PREMIUM="333333"
//
// El ciclo se deduce de listas anuales opcionales. Si un variant no está en
// ninguna lista anual, se asume 'mensual':
//
//   LEMONSQUEEZY_VARIANTS_BASIC_ANNUAL="111199"
//   LEMONSQUEEZY_VARIANTS_STANDARD_ANNUAL="222299"
//   LEMONSQUEEZY_VARIANTS_PREMIUM_ANNUAL="333399"

const parseIds = (raw) =>
  (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const planPorVariant = (variantId) => {
  const id = String(variantId ?? "");
  if (!id) return { plan: null, ciclo: "mensual" };

  const enAnual =
    parseIds(process.env.LEMONSQUEEZY_VARIANTS_BASIC_ANNUAL).includes(id) ||
    parseIds(process.env.LEMONSQUEEZY_VARIANTS_STANDARD_ANNUAL).includes(id) ||
    parseIds(process.env.LEMONSQUEEZY_VARIANTS_PREMIUM_ANNUAL).includes(id);
  const ciclo = enAnual ? "anual" : "mensual";

  const inList = (name) =>
    parseIds(process.env[name]).includes(id) ||
    parseIds(process.env[`${name}_ANNUAL`]).includes(id);

  if (inList("LEMONSQUEEZY_VARIANTS_PREMIUM")) return { plan: "premium", ciclo };
  if (inList("LEMONSQUEEZY_VARIANTS_STANDARD")) return { plan: "standard", ciclo };
  if (inList("LEMONSQUEEZY_VARIANTS_BASIC")) return { plan: "basic", ciclo };
  return { plan: null, ciclo };
};

// Link de checkout configurado para un plan+ciclo (opcional).
//   LEMONSQUEEZY_CHECKOUT_BASIC / _STANDARD / _PREMIUM  (mensual)
//   ..._ANNUAL para el anual.
const checkoutUrl = (plan, ciclo) => {
  const key =
    ciclo === "anual"
      ? `LEMONSQUEEZY_CHECKOUT_${plan.toUpperCase()}_ANNUAL`
      : `LEMONSQUEEZY_CHECKOUT_${plan.toUpperCase()}`;
  return (
    process.env[key] ||
    process.env[`LEMONSQUEEZY_CHECKOUT_${plan.toUpperCase()}`] ||
    null
  );
};

module.exports = { planPorVariant, checkoutUrl };
