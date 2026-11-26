const supabase = require("../config/database");
const { funcionesDe, limitesEfectivos, cupoPorNegocio } = require("./suscripcion");

// Se consulta en cada carga del menú, pedido y mensaje: se guarda un minuto
// por negocio. Un cambio de plan o de módulos tarda como mucho eso en notarse.
const TTL_MS = 60 * 1000;
const cache = new Map(); // negocioId → { valor: { whatsapp, ia, mapa }, expira }

// ¿La cuenta dueña del negocio puede usar `codigo` ("whatsapp", "ia" o
// "mapa")? Por su plan o por un módulo sumado. Ante un error de la BD responde
// que no (sin guardarlo, así un fallo puntual no corta los avisos por un minuto).
async function negocioIncluye(negocioId, codigo) {
  if (!negocioId) return false;
  const hit = cache.get(negocioId);
  if (hit && hit.expira > Date.now()) return !!hit.valor[codigo];
  try {
    // "*": anda aunque falte alguna columna nueva (modulos_pagos).
    const { data, error } = await supabase.from("negocios").select("cuentas ( * )").eq("id", negocioId).maybeSingle();
    if (error) throw error;
    const valor = funcionesDe(data?.cuentas);
    cache.set(negocioId, { valor, expira: Date.now() + TTL_MS });
    return !!valor[codigo];
  } catch (e) {
    console.error("[Plan] No se pudo leer el plan del negocio", negocioId, e.message);
    return false;
  }
}

// WhatsApp: avisos y chats.
const negocioConWhatsapp = (negocioId) => negocioIncluye(negocioId, "whatsapp");

// Después de sumar o quitar un módulo: que se note en el momento en los
// negocios de la cuenta (en este proceso).
const olvidarPlan = (negocioIds = []) => negocioIds.forEach((id) => cache.delete(Number(id)));

// Lo mismo para todos los negocios de una cuenta. Nunca tira (lo peor es
// esperar el minuto de la caché).
async function olvidarPlanDeCuenta(cuentaId) {
  try {
    const { data } = await supabase.from("negocios").select("id").eq("cuenta_id", cuentaId);
    olvidarPlan((data || []).map((n) => n.id));
  } catch (e) {
    console.warn("[Plan] No se pudo limpiar la caché de la cuenta", cuentaId, e.message);
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
    .select("cuenta_id, cuentas ( * )")
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

module.exports = { negocioConWhatsapp, negocioIncluye, olvidarPlan, olvidarPlanDeCuenta, cupoProductos };
