const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const {
  estaVigente,
  diasRestantes,
  TRIAL_DIAS,
  LIMITES_POR_PLAN: LIMITES,
} = require("../utils/suscripcion");
const { preciosPorPlan } = require("../utils/planPrecios");
const { crearSuscripcion, cancelarSuscripcion, cambiarMonto, motivoRechazo, PORTAL_URL } = require("../utils/mercadoPago");
const { precioConDescuento, tieneDescuento } = require("../utils/cupones");
const {
  catalogoModulos,
  validarModulosNuevos,
  montoSuscripcionNueva,
  montoProximoCobro,
  precioPlan,
  sumarModulo,
  quitarModulo,
} = require("../utils/modulosPagos");
const { funcionesDe } = require("../utils/suscripcion");
const { olvidarPlanDeCuenta } = require("../utils/planNegocio");

// Catálogo de planes para las tarjetas del frontend (precio mensual en ARS).
const catalogoPlanes = () => {
  const p = preciosPorPlan();
  const orden = ["basic", "standard", "premium"];
  return {
    moneda: p.moneda,
    trial_dias: TRIAL_DIAS,
    portal_url: PORTAL_URL,
    planes: orden.map((code) => ({
      code,
      precio_mensual: p.mensual[code],
      limites: LIMITES[code],
    })),
    // Módulos que se suman al plan (con su precio y en qué planes vienen).
    modulos: catalogoModulos(),
  };
};

// ¿La cuenta paga hoy una suscripción de Mercado Pago a la que se le puede
// cambiar el monto?
const pagaConMP = (cuenta) => cuenta?.estado_suscripcion === "activo" && !!cuenta?.mp_preapproval_id;

// GET /api/suscripcion  → estado de la cuenta + catálogo de planes.
const getEstado = async (req, res) => {
  try {
    const catalogo = catalogoPlanes();

    // Plataforma: acceso siempre; no está atada a una suscripción.
    if (req.user?.es_plataforma === true) {
      return res.json({
        es_plataforma: true,
        tipo_plan: "premium",
        estado_suscripcion: "activo",
        vigente: true,
        periodo_fin: null,
        dias_restantes: null,
        ...catalogo,
      });
    }

    const cuentaId = req.user?.cuenta_id;
    if (!cuentaId) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    // "*": si todavía no se corrió una migración (p. ej. mp_email), la
    // página sigue andando en vez de fallar por una columna que no existe.
    const { data: cuenta, error } = await supabase
      .from("cuentas")
      .select("*")
      .eq("id", cuentaId)
      .single();
    if (error || !cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    // Email con el que se va a pagar en Mercado Pago: el último usado o, si
    // nunca pagó, el del usuario (el cliente lo puede cambiar antes de pagar).
    let mpEmail = cuenta.mp_email || null;
    if (!mpEmail) {
      const { data: u } = await supabase.from("usuarios").select("email").eq("id", req.user?.id).maybeSingle();
      mpEmail = u?.email || null;
    }

    // Cupón vigente: cada plan muestra también su precio con descuento.
    const descuento = tieneDescuento(cuenta)
      ? { porcentaje: cuenta.descuento_pct, meses_restantes: cuenta.descuento_meses_restantes }
      : null;
    if (descuento) {
      catalogo.planes = catalogo.planes.map((p) => ({
        ...p,
        precio_con_descuento: precioConDescuento(p.code, descuento.porcentaje),
      }));
    }

    res.json({
      descuento,
      mp_email: mpEmail,
      es_plataforma: false,
      tipo_plan: cuenta.tipo_plan,
      estado_suscripcion: cuenta.estado_suscripcion,
      vigente: estaVigente(cuenta),
      periodo_fin: cuenta.periodo_fin,
      dias_restantes: diasRestantes(cuenta.periodo_fin),
      creado_at: cuenta.created_at,
      // Módulos sumados: { codigo: { desde, cobrado, baja_en } }.
      modulos_cuenta: cuenta.modulos_pagos || {},
      // Lo que puede usar hoy (por el plan o por módulos).
      funciones: funcionesDe(cuenta),
      // Precio del plan que paga (el de fundador si lo tiene).
      precio_plan: precioPlan(cuenta),
      precio_fundador: Number(cuenta.precio_plan_fijo) > 0,
      // Lo que se va a cobrar en el próximo cobro (plan + módulos, con cupón).
      monto_proximo_cobro: pagaConMP(cuenta) ? montoProximoCobro(cuenta) : null,
      ...catalogo,
    });
  } catch (error) {
    return respondError(res, error, "suscripcion");
  }
};

// Página del panel a la que Mercado Pago devuelve al cliente después de pagar.
const urlDeVuelta = () => {
  const base = process.env.ADMIN_URL || "http://localhost:3001/admin/login";
  try {
    return `${new URL(base).origin}/admin/suscripcion`;
  } catch {
    return "http://localhost:3001/admin/suscripcion";
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/suscripcion/checkout/:plan  { email?, modulos? }  → { url }  (checkout de Mercado Pago)
// `modulos`: los que se suman al plan desde el primer cobro (["whatsapp", ...]).
// `email` es el de la cuenta de Mercado Pago con la que se paga; puede no ser
// el del usuario de DinexFlow. MP solo deja pagar a quien inicia sesión con él.
const getCheckout = async (req, res) => {
  try {
    const plan = String(req.params.plan || "").toLowerCase();
    if (!["basic", "standard", "premium"].includes(plan)) {
      return res.status(400).json({ message: "Plan inválido" });
    }
    const mods = validarModulosNuevos(plan, req.body?.modulos);
    if (mods.error) return res.status(400).json({ message: mods.error });
    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(503).json({
        message: "Pagos no configurados. Definí MP_ACCESS_TOKEN en el backend.",
      });
    }

    const cuentaId = req.user?.cuenta_id;
    if (!cuentaId) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    const { data: cuenta } = await supabase
      .from("cuentas")
      .select("*")
      .eq("id", cuentaId)
      .maybeSingle();

    // Mercado Pago exige el email del pagador: el que escribió el cliente, el
    // último que usó o, si no, el de su usuario.
    let email = String(req.body?.email || "").trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "El email de Mercado Pago no es válido." });
    }
    if (!email) email = cuenta?.mp_email || "";
    if (!email) {
      const { data: u } = await supabase
        .from("usuarios")
        .select("email")
        .eq("id", req.user?.id)
        .maybeSingle();
      email = u?.email || "";
    }
    if (!email) {
      return res.status(400).json({
        message: "Escribí el email de tu cuenta de Mercado Pago para poder pagar.",
      });
    }

    // Sin db/modulos_pagos.sql no se podrían guardar los módulos: no se cobran.
    if (mods.valor.length && !(cuenta && "modulos_pagos" in cuenta)) {
      return res.status(503).json({ message: "Los módulos todavía no están habilitados. Probá más tarde." });
    }

    // Con cupón vigente, la suscripción nace con el precio rebajado.
    const pct = tieneDescuento(cuenta) ? cuenta.descuento_pct : 0;

    const sub = await crearSuscripcion({
      cuentaId,
      plan,
      email,
      backUrl: urlDeVuelta(),
      modulos: mods.valor,
      monto: montoSuscripcionNueva(plan, mods.valor, pct),
    });
    if (!sub?.init_point) {
      return res.status(502).json({ message: "Mercado Pago no devolvió el link de pago" });
    }

    // Se recuerda para la próxima (no bloquea el pago si falla).
    if (email !== cuenta?.mp_email) {
      const { error: errEmail } = await supabase.from("cuentas").update({ mp_email: email }).eq("id", cuentaId);
      if (errEmail) console.warn("[MercadoPago] No se pudo guardar mp_email:", errEmail.message);
    }
    res.json({ url: sub.init_point });
  } catch (error) {
    if (error.status) {
      console.error("[MercadoPago] checkout:", error.message, JSON.stringify(error.mp || {}));
      return res.status(502).json({ message: motivoRechazo(error) });
    }
    return respondError(res, error, "suscripcion");
  }
};

// POST /api/suscripcion/cancelar → da de baja la suscripción en Mercado Pago.
// La baja la pide DinexFlow (el vendedor), así funciona aunque el cliente haya
// pagado sin cuenta de Mercado Pago. No hay más cobros y la cuenta sigue
// usando el panel hasta periodo_fin (el mes que ya pagó).
const cancelar = async (req, res) => {
  try {
    const cuentaId = req.user?.cuenta_id;
    if (!cuentaId) return res.status(403).json({ message: "Usuario sin cuenta asociada" });

    const { data: cuenta } = await supabase.from("cuentas").select("*").eq("id", cuentaId).maybeSingle();
    if (!cuenta || cuenta.estado_suscripcion !== "activo" || !cuenta.mp_preapproval_id) {
      return res.status(409).json({ message: "No tenés una suscripción activa para cancelar." });
    }

    let sub;
    try {
      sub = await cancelarSuscripcion(cuenta.mp_preapproval_id);
    } catch (e) {
      console.error("[MercadoPago] No se pudo cancelar:", cuenta.mp_preapproval_id, e.message, e.mp);
      return res.status(502).json({ message: "Mercado Pago no pudo cancelar la suscripción. Probá de nuevo en un rato." });
    }

    const periodoFin = cuenta.periodo_fin || sub?.next_payment_date || null;
    const { error } = await supabase
      .from("cuentas")
      .update({ estado_suscripcion: "cancelado", mp_status: "cancelled", periodo_fin: periodoFin })
      .eq("id", cuenta.id);
    if (error) throw error;

    return res.json({ estado_suscripcion: "cancelado", periodo_fin: periodoFin });
  } catch (error) {
    return respondError(res, error, "suscripcion.cancelar");
  }
};

// POST   /api/suscripcion/modulos/:codigo → sumar un módulo al plan.
// DELETE /api/suscripcion/modulos/:codigo → quitarlo (se usa hasta el próximo cobro).
// Sólo con una suscripción activa de Mercado Pago: se cambia el monto de los
// próximos cobros. En la prueba gratis los módulos se eligen al pagar.
const cambiarModulo = (accion) => async (req, res) => {
  try {
    const cuentaId = req.user?.cuenta_id;
    if (!cuentaId) return res.status(403).json({ message: "Usuario sin cuenta asociada" });

    const { data: cuenta } = await supabase.from("cuentas").select("*").eq("id", cuentaId).maybeSingle();
    if (!cuenta) return res.status(404).json({ message: "Cuenta no encontrada" });
    if (!("modulos_pagos" in cuenta)) {
      return res.status(503).json({ message: "Los módulos todavía no están habilitados. Probá más tarde." });
    }
    if (!pagaConMP(cuenta)) {
      return res.status(409).json({
        code: "SIN_SUSCRIPCION",
        message: "Para sumar o quitar módulos necesitás un plan pago activo. Si estás en la prueba, elegilos al pagar tu plan.",
      });
    }

    const codigo = String(req.params.codigo || "").toLowerCase();
    const r = accion === "sumar" ? sumarModulo(cuenta, codigo) : quitarModulo(cuenta, codigo);
    if (r.error) return res.status(r.code === "MODULO_INVALIDO" ? 400 : 409).json({ code: r.code, message: r.error });

    const nueva = { ...cuenta, modulos_pagos: r.modulos };
    const montoAntes = montoProximoCobro(cuenta);
    const montoNuevo = montoProximoCobro(nueva);

    // Primero Mercado Pago: si falla, no se guarda nada (no hay módulo sin cobrar).
    if (montoNuevo !== montoAntes) {
      try {
        await cambiarMonto(cuenta.mp_preapproval_id, montoNuevo);
      } catch (e) {
        console.error("[MercadoPago] No se pudo cambiar el monto:", cuenta.mp_preapproval_id, e.message, e.mp);
        return res.status(502).json({ message: "Mercado Pago no pudo actualizar tu suscripción. Probá de nuevo en un rato." });
      }
    }

    // Se guarda sólo si nadie cambió los módulos desde que se leyeron (otra
    // pestaña o el webhook de un cobro).
    const version = Number(cuenta.modulos_version) || 0;
    const { data: guardada, error } = await supabase
      .from("cuentas")
      .update({ modulos_pagos: r.modulos, modulos_version: version + 1 })
      .eq("id", cuenta.id)
      .eq("modulos_version", version)
      .select("id");
    if (error || !guardada?.length) {
      // Se vuelve al monto de antes para no cobrar algo que no quedó guardado.
      if (montoNuevo !== montoAntes) {
        await cambiarMonto(cuenta.mp_preapproval_id, montoAntes).catch((e) =>
          console.error("[MercadoPago] No se pudo volver al monto anterior:", cuenta.mp_preapproval_id, e.message),
        );
      }
      if (error) throw error;
      return res.status(409).json({
        code: "CAMBIO_SIMULTANEO",
        message: "Tu suscripción cambió mientras tanto. Recargá la página y probá de nuevo.",
      });
    }

    // Que el cambio se note ya en los negocios de la cuenta.
    await olvidarPlanDeCuenta(cuenta.id);

    return res.json({
      modulos_cuenta: r.modulos,
      funciones: funcionesDe(nueva),
      monto_proximo_cobro: montoNuevo,
      periodo_fin: cuenta.periodo_fin,
      baja_en: r.baja_en || null,
    });
  } catch (error) {
    return respondError(res, error, `suscripcion.modulo.${accion}`);
  }
};

const sumarModuloPago = cambiarModulo("sumar");
const quitarModuloPago = cambiarModulo("quitar");

module.exports = { getEstado, getCheckout, cancelar, sumarModuloPago, quitarModuloPago };
