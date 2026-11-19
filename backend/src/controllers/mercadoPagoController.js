const supabase = require("../config/database");
const { PRECIOS_MENSUALES } = require("../utils/planPrecios");
const mp = require("../utils/mercadoPago");
const { precioConDescuento, tieneDescuento } = require("../utils/cupones");
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

    if (!["subscription_preapproval", "preapproval"].includes(tipo) || !dataId) {
      return res.status(200).json({ message: "Evento ignorado", tipo });
    }

    const sub = await mp.obtenerSuscripcion(dataId);
    const ref = mp.leerReferencia(sub.external_reference);
    if (!ref) {
      return res.status(200).json({ message: "Suscripción ajena a DinexFlow" });
    }

    const { data: cuenta } = await supabase
      .from("cuentas")
      .select("id, mp_preapproval_id, descuento_pct, descuento_meses_restantes")
      .eq("id", ref.cuentaId)
      .maybeSingle();
    if (!cuenta) return res.status(200).json({ message: "Cuenta no encontrada" });

    // El monto cobrado tiene que ser el del plan (o el del plan con el cupón
    // vigente de la cuenta): si no, no se activa.
    const monto = Number(sub.auto_recurring?.transaction_amount);
    const permitidos = [PRECIOS_MENSUALES[ref.plan]];
    if (tieneDescuento(cuenta)) permitidos.push(precioConDescuento(ref.plan, cuenta.descuento_pct));
    if (!permitidos.includes(monto)) {
      console.warn("[MercadoPago] monto no coincide con el plan:", sub.id, ref.plan, monto);
      return res.status(200).json({ message: "Monto no coincide con el plan" });
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
      datos.periodo_fin = sub.next_payment_date || null;
    }
    // Cancelado: conserva periodo_fin (el próximo cobro que ya no ocurre), así
    // sigue usando el panel hasta el final del mes que pagó.

    const { error } = await supabase.from("cuentas").update(datos).eq("id", cuenta.id);
    if (error) throw error;

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
      if (tieneDescuento(cuenta)) {
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

  // Se vuelve al precio normal ANTES de guardar: si MP falla, el webhook
  // responde 500, MP reintenta y el mes no se pierde.
  if (terminaDescuento) {
    await mp.cambiarMonto(preapprovalId, PRECIOS_MENSUALES[cuenta.tipo_plan]);
  }

  const { error } = await supabase.from("cuentas").update(datos).eq("id", cuenta.id);
  if (error) throw error;

  // Comprobante de pago al cliente (con copia al dueño de DinexFlow).
  if (aprobado && cobroNuevo) {
    await emitirComprobante({ cuenta, cobro, sub, enviar: enviarComprobante });
  }

  return res.status(200).json({ message: "Cobro procesado", estado: datos.estado_suscripcion });
};

// Se carga al usarlo: el cliente de email exige RESEND_API_KEY al iniciar.
const enviarComprobante = (args) => require("../services/emailService").sendComprobantePago(args);

module.exports = { mercadoPagoWebhook };
