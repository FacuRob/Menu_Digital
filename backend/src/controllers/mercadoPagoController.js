const supabase = require("../config/database");
const mp = require("../utils/mercadoPago");
const { tieneDescuento } = require("../utils/cupones");
const {
  montoSuscripcionNueva,
  montoProximoCobro,
  modulosDeAlta,
  modulosAlCobrar,
  modulosACobrar,
  precioModulos,
  leerReferenciaPagoModulos,
  modulosPagadosHasta,
} = require("../utils/modulosPagos");
const { olvidarPlanDeCuenta } = require("../utils/planNegocio");
const { emitirComprobante } = require("../utils/comprobantes");

// POST /api/webhooks/mercadopago   (público; la seguridad es la firma x-signature)
//
// MP avisa cambios de una suscripción (topic subscription_preapproval) con solo
// su id. Nunca se confía en el cuerpo: se consulta la suscripción a la API de MP
// con nuestro token y de ahí se toman cuenta, plan, monto y estado.
const mercadoPagoWebhook = async (req, res) => {
  try {
    const tipo = req.body?.type || req.query.type || req.query.topic;
    const dataId = String(req.query["data.id"] || req.body?.data?.id || "");

    if (
      !mp.firmaValida({
        xSignature: req.headers["x-signature"],
        xRequestId: req.headers["x-request-id"],
        dataId,
      })
    ) {
      console.warn("[MercadoPago] webhook con firma inválida:", tipo, dataId);
      return res.status(401).json({ message: "Firma inválida" });
    }

    if (tipo === "subscription_authorized_payment" && dataId) {
      return await procesarCobro(dataId, res);
    }

    // Pago único de módulos (al volver a pagar un plan cancelado).
    if (tipo === "payment" && dataId) {
      const r = await aplicarPagoModulos(dataId);
      return res.status(200).json({ message: r.motivo });
    }

    if (!["subscription_preapproval", "preapproval"].includes(tipo) || !dataId) {
      return res.status(200).json({ message: "Evento ignorado", tipo });
    }

    const sub = await mp.obtenerSuscripcion(dataId);
    const ref = mp.leerReferencia(sub.external_reference);
    if (!ref) {
      return res.status(200).json({ message: "Suscripción ajena a DinexFlow" });
    }

    // "*": anda aunque falte alguna columna nueva (modulos_pagos).
    const { data: cuenta } = await supabase.from("cuentas").select("*").eq("id", ref.cuentaId).maybeSingle();
    if (!cuenta) return res.status(200).json({ message: "Cuenta no encontrada" });

    // Suscripción nueva: el monto tiene que ser el del plan más los módulos
    // elegidos (con el cupón vigente de la cuenta, si lo hay); si no, no se
    // activa. La vigente no se controla: su monto lo cambia sólo DinexFlow
    // (módulos, cupón) y el aviso de ese cambio puede llegar antes de guardarlo.
    const esNueva = cuenta.mp_preapproval_id !== sub.id;
    const monto = Number(sub.auto_recurring?.transaction_amount);
    if (esNueva) {
      const permitidos = [montoSuscripcionNueva(ref.plan, ref.modulos)];
      if (tieneDescuento(cuenta)) permitidos.push(montoSuscripcionNueva(ref.plan, ref.modulos, cuenta.descuento_pct));
      if (!permitidos.includes(monto)) {
        console.warn("[MercadoPago] monto no coincide con el plan:", sub.id, ref.plan, ref.modulos, monto);
        return res.status(200).json({ message: "Monto no coincide con el plan" });
      }
    }

    const estado = mp.estadoDeMP(sub.status);
    if (!estado) return res.status(200).json({ message: "Pendiente de pago" });

    const anterior = cuenta.mp_preapproval_id;
    // Una baja o pausa solo cuenta si es de la suscripción vigente: la de un
    // checkout abandonado o la reemplazada por un cambio de plan se ignora.
    if (estado !== "activo" && anterior !== sub.id) {
      return res.status(200).json({ message: "Suscripción reemplazada" });
    }

    const datos = { estado_suscripcion: estado, mp_preapproval_id: sub.id, mp_status: sub.status };
    if (estado === "activo") {
      // El trigger de la BD recalcula los límites del plan.
      datos.tipo_plan = ref.plan;
      datos.ciclo_facturacion = "mensual";
      // Nunca antes de lo que ya pagó: al volver a pagar un plan cancelado el
      // débito arranca cuando vence (start_date) y no se pierden días.
      const proximo = sub.next_payment_date || null;
      datos.periodo_fin =
        proximo && cuenta.periodo_fin && new Date(cuenta.periodo_fin) > new Date(proximo) ? cuenta.periodo_fin : proximo;
      // Suscripción nueva (primer pago o cambio de plan): precio de lista y
      // sólo los módulos que se pagaron con ella (los incluidos en el plan
      // nuevo dejan de cobrarse).
      if (esNueva && "modulos_pagos" in cuenta) {
        datos.modulos_pagos = modulosDeAlta(ref.modulos);
        datos.modulos_version = (Number(cuenta.modulos_version) || 0) + 1;
        datos.precio_plan_fijo = null;
      }
      // Cupón: el primer pago (al autorizar) ya salió con descuento, así que
      // ese mes se consume acá, sin esperar el aviso del cobro (que puede no
      // llegar). Si era el último, los próximos cobros vuelven al precio
      // normal: se corrige en MP antes de guardar (si falla, 500 y MP reintenta).
      const conCupon = tieneDescuento(cuenta) ? montoSuscripcionNueva(ref.plan, ref.modulos, cuenta.descuento_pct) : null;
      if (esNueva && conCupon != null && monto === conCupon && conCupon !== montoSuscripcionNueva(ref.plan, ref.modulos)) {
        const restantes = Number(cuenta.descuento_meses_restantes) - 1;
        datos.descuento_meses_restantes = Math.max(0, restantes);
        if (restantes <= 0) {
          datos.descuento_pct = 0;
          await mp.cambiarMonto(sub.id, montoSuscripcionNueva(ref.plan, ref.modulos));
        }
      }
    }
    // Cancelado: conserva periodo_fin (el próximo cobro que ya no ocurre), así
    // sigue usando el panel hasta el final del mes que pagó.

    const { error } = await supabase.from("cuentas").update(datos).eq("id", cuenta.id);
    if (error) throw error;
    await olvidarPlanDeCuenta(cuenta.id);

    // Cambio de plan: dar de baja la suscripción anterior para no cobrar dos veces.
    if (estado === "activo" && anterior && anterior !== sub.id) {
      try {
        await mp.cancelarSuscripcion(anterior);
      } catch (e) {
        console.error("[MercadoPago] No se pudo cancelar la suscripción anterior:", anterior, e.message);
      }
    }

    return res.status(200).json({ message: "Suscripción actualizada", plan: ref.plan, estado });
  } catch (error) {
    console.error("[MercadoPago] Error en webhook:", error);
    // 500 → MP reintenta el aviso más tarde.
    return res.status(500).json({ message: "Error procesando el webhook" });
  }
};

// Aviso de un cobro mensual. Se consulta el cobro a MP (nunca el cuerpo):
// - aprobado  → la cuenta sigue activa y periodo_fin pasa al próximo cobro.
// - cancelado sin aprobar (MP agotó los reintentos) → la cuenta queda vencida.
// - rechazado pero MP todavía reintenta → no se toca nada.
// Solo cuenta si es de la suscripción vigente de la cuenta.
// Con cupón: cada cobro aprobado consume un mes de descuento; al llegar a 0,
// los próximos cobros vuelven al precio normal del plan.
// ¿Es el cobro que se hace al autorizar la suscripción? (hasta 3 días después
// de crearla; los siguientes llegan cada mes).
const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;
const esPrimerCobro = (cobro, sub) => {
  // Con fecha de inicio (volver a pagar), el primer cobro es en esa fecha.
  const creada = Math.max(
    new Date(sub?.date_created || NaN).getTime() || 0,
    new Date(sub?.auto_recurring?.start_date || NaN).getTime() || 0,
  ) || NaN;
  const cobrado = new Date(cobro?.debit_date || cobro?.date_created || NaN).getTime();
  return Number.isFinite(creada) && Number.isFinite(cobrado) && cobrado - creada < TRES_DIAS;
};

const procesarCobro = async (cobroId, res) => {
  const cobro = await mp.obtenerCobro(cobroId);
  const preapprovalId = cobro?.preapproval_id;
  if (!preapprovalId) return res.status(200).json({ message: "Cobro sin suscripción" });

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("*")
    .eq("mp_preapproval_id", preapprovalId)
    .maybeSingle();
  if (!cuenta) return res.status(200).json({ message: "Cobro de otra suscripción" });

  const aprobado = cobro.payment?.status === "approved";
  let datos = null;
  let terminaDescuento = false;
  let sub = null;
  let cobroNuevo = false;

  if (aprobado) {
    sub = await mp.obtenerSuscripcion(preapprovalId);
    if (sub?.status !== "authorized") {
      return res.status(200).json({ message: "Suscripción no activa" });
    }
    datos = {
      estado_suscripcion: "activo",
      mp_status: sub.status,
      periodo_fin: sub.next_payment_date || null,
    };
    // MP puede repetir el aviso del mismo cobro: el mes se descuenta una vez.
    cobroNuevo = String(cobro.id) !== String(cuenta.mp_ultimo_cobro_id || "");
    if (cobroNuevo) {
      datos.mp_ultimo_cobro_id = String(cobro.id);
      // El mes del primer pago ya se consumió al activar la suscripción.
      if (tieneDescuento(cuenta) && !esPrimerCobro(cobro, sub)) {
        const restantes = Number(cuenta.descuento_meses_restantes) - 1;
        datos.descuento_meses_restantes = restantes;
        if (restantes <= 0) {
          datos.descuento_pct = 0;
          terminaDescuento = true;
        }
      }
    }
  } else if (cobro.status === "cancelled") {
    datos = { estado_suscripcion: "vencido" };
  }

  if (!datos) return res.status(200).json({ message: "Cobro en reintento" });

  // Módulos: los sumados antes de este cobro quedan cobrados y los que
  // llegaron a su fecha de baja se van. (Sin db/modulos_pagos.sql, nada.)
  const migrada = "modulos_pagos" in cuenta;
  if (aprobado && cobroNuevo && migrada) {
    datos.modulos_pagos = modulosAlCobrar(cuenta.modulos_pagos, cobro.debit_date || cobro.date_created);
  }

  // Si con este cobro cambió lo que se cobra (terminó el cupón, un módulo
  // quitado ya se cobró por última vez), el próximo monto se corrige en MP
  // ANTES de guardar: si MP falla, el webhook responde 500, MP reintenta y no
  // se pierde. Si no cambió nada, no se toca (respeta montos puestos a mano).
  if (aprobado && cobroNuevo) {
    const despues = { ...cuenta, ...datos };
    const cambiaron = String(modulosACobrar(cuenta)) !== String(modulosACobrar(despues));
    if (terminaDescuento || (migrada && cambiaron)) {
      const esperado = montoProximoCobro(despues);
      if (esperado !== Number(sub.auto_recurring?.transaction_amount)) {
        await mp.cambiarMonto(preapprovalId, esperado);
      }
    }
  }

  // Con módulos, se guarda sólo si nadie los cambió mientras tanto ("Sumar"
  // o "Quitar" al mismo tiempo): si no, 500 y MP reintenta con datos frescos.
  let q = supabase.from("cuentas").update(datos).eq("id", cuenta.id);
  if (datos.modulos_pagos) {
    const version = Number(cuenta.modulos_version) || 0;
    datos.modulos_version = version + 1;
    q = q.eq("modulos_version", version).select("id");
  }
  const { data: guardada, error } = await q;
  if (error) throw error;
  if (datos.modulos_pagos && !guardada?.length) throw new Error("Los módulos cambiaron durante el cobro");
  if (datos.modulos_pagos) await olvidarPlanDeCuenta(cuenta.id);

  // Comprobante de pago al cliente (con copia al dueño de DinexFlow).
  if (aprobado && cobroNuevo) {
    await emitirComprobante({ cuenta, cobro, sub, enviar: enviarComprobante });
  }

  return res.status(200).json({ message: "Cobro procesado", estado: datos.estado_suscripcion });
};

// Pago único de módulos aprobado → la cuenta los usa hasta su vencimiento.
// Se consulta el pago a MP (nunca el aviso). Lo usan el webhook y la vuelta
// del checkout (por si el aviso tarda). Repetirlo no cambia nada.
// → { ok, motivo, cuentaId? }
const aplicarPagoModulos = async (pagoId, cuentaEsperada = null) => {
  const pago = await mp.obtenerPago(pagoId);
  const ref = leerReferenciaPagoModulos(pago?.external_reference);
  if (!ref) return { ok: false, motivo: "Pago ajeno a módulos" };
  if (cuentaEsperada != null && ref.cuentaId !== Number(cuentaEsperada)) return { ok: false, motivo: "Pago de otra cuenta" };
  if (pago.status !== "approved") return { ok: false, motivo: "Pago no aprobado" };
  if (Number(pago.transaction_amount) !== precioModulos(ref.modulos)) {
    console.warn("[MercadoPago] pago de módulos con otro monto:", pagoId, ref.modulos, pago.transaction_amount);
    return { ok: false, motivo: "Monto no coincide" };
  }

  const { data: cuenta } = await supabase.from("cuentas").select("*").eq("id", ref.cuentaId).maybeSingle();
  if (!cuenta || !("modulos_pagos" in cuenta)) return { ok: false, motivo: "Cuenta no encontrada" };
  if (!cuenta.periodo_fin) return { ok: false, motivo: "Cuenta sin vencimiento" };

  // Ya aplicado (aviso repetido o la vuelta del checkout): no se toca.
  const actuales = cuenta.modulos_pagos || {};
  if (ref.modulos.every((c) => actuales[c] && (!actuales[c].baja_en || new Date(actuales[c].baja_en) >= new Date(cuenta.periodo_fin)))) {
    return { ok: true, motivo: "Ya aplicado", cuentaId: cuenta.id };
  }

  const version = Number(cuenta.modulos_version) || 0;
  const { data: guardada, error } = await supabase
    .from("cuentas")
    .update({
      modulos_pagos: modulosPagadosHasta(actuales, ref.modulos, cuenta.periodo_fin),
      modulos_version: version + 1,
    })
    .eq("id", cuenta.id)
    .eq("modulos_version", version)
    .select("id");
  if (error) throw error;
  if (!guardada?.length) throw new Error("Los módulos cambiaron durante el pago");
  await olvidarPlanDeCuenta(cuenta.id);
  return { ok: true, motivo: "Módulos pagados", cuentaId: cuenta.id };
};

// Se carga al usarlo: el cliente de email exige RESEND_API_KEY al iniciar.
const enviarComprobante = (args) => require("../services/emailService").sendComprobantePago(args);

module.exports = { mercadoPagoWebhook, aplicarPagoModulos };
