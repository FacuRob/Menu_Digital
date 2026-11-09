const supabase = require("../config/database");
const { incluyeWhatsapp, limitesEfectivos, cupoPorNegocio } = require("./suscripcion");

// Se consulta en cada carga del menú, pedido y mensaje: se guarda un minuto
// por negocio. Un cambio de plan tarda como mucho eso en notarse.
const TTL_MS = 60 * 1000;
const cache = new Map(); // negocioId → { valor, expira }

// ¿El plan de la cuenta dueña del negocio incluye WhatsApp (avisos, chats,
// bot con IA y mapa del repartidor)? Ante un error de la BD responde que no
// (sin guardarlo, así un fallo puntual no corta los avisos por un minuto).
async function negocioConWhatsapp(negocioId) {
  if (!negocioId) return false;
  const hit = cache.get(negocioId);
  if (hit && hit.expira > Date.now()) return hit.valor;
  try {
    const { data, error } = await supabase
      .from("negocios")
      .select("cuentas ( tipo_plan, estado_suscripcion, periodo_fin )")
      .eq("id", negocioId)
      .maybeSingle();
    if (error) throw error;
    const valor = incluyeWhatsapp(data?.cuentas);
    cache.set(negocioId, { valor, expira: Date.now() + TTL_MS });
    return valor;
  } catch (e) {
    console.error("[Plan] No se pudo leer el plan del negocio", negocioId, e.message);
    return false;
  }
}

// Productos del plan para un negocio: el total de la cuenta se reparte entre
// sus negocios. Devuelve null si el negocio o su cuenta no existen.
//   cupo           → cuántos productos puede tener este negocio
//   usados         → cuántos tiene
//   total          → total del plan para toda la cuenta
//   usadosCuenta   → productos de todos los negocios de la cuenta
async function cupoProductos(negocioId) {
  const { data: negocio, error } = await supabase
    .from("negocios")
    .select("cuenta_id, cuentas ( tipo_plan, estado_suscripcion, periodo_fin, limite_negocios, limite_productos )")
    .eq("id", negocioId)
    .maybeSingle();
  if (error) throw error;
  if (!negocio?.cuentas) return null;

  const { data: hermanos, error: errNeg } = await supabase
    .from("negocios")
    .select("id")
    .eq("cuenta_id", negocio.cuenta_id)
    .order("id", { ascending: true });
  if (errNeg) throw errNeg;
  const ids = (hermanos || []).map((n) => n.id);
  if (!ids.includes(negocioId)) ids.push(negocioId);

  const [delNegocio, deLaCuenta] = await Promise.all([
    supabase.from("productos").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId),
    supabase.from("productos").select("id", { count: "exact", head: true }).in("negocio_id", ids),
  ]);
  if (delNegocio.error) throw delNegocio.error;
  if (deLaCuenta.error) throw deLaCuenta.error;

  const total = limitesEfectivos(negocio.cuentas).productos;
  return {
    cuenta: negocio.cuentas,
    cuentaId: negocio.cuenta_id,
    negocios: ids.length,
    total,
    cupo: cupoPorNegocio(total, ids.length, ids.indexOf(negocioId)),
    usados: delNegocio.count ?? 0,
    usadosCuenta: deLaCuenta.count ?? 0,
  };
}

module.exports = { negocioConWhatsapp, cupoProductos };
