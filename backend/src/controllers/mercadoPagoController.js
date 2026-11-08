const supabase = require("../config/database");
const { PRECIOS_MENSUALES } = require("../utils/planPrecios");
const mp = require("../utils/mercadoPago");

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

    if (!["subscription_preapproval", "preapproval"].includes(tipo) || !dataId) {
      return res.status(200).json({ message: "Evento ignorado", tipo });
    }

    const sub = await mp.obtenerSuscripcion(dataId);
    const ref = mp.leerReferencia(sub.external_reference);
    if (!ref) {
      return res.status(200).json({ message: "Suscripción ajena a DinexFlow" });
    }

    // El monto cobrado tiene que ser el del plan: si no, no se activa.
    const monto = Number(sub.auto_recurring?.transaction_amount);
    if (monto !== PRECIOS_MENSUALES[ref.plan]) {
      console.warn("[MercadoPago] monto no coincide con el plan:", sub.id, ref.plan, monto);
      return res.status(200).json({ message: "Monto no coincide con el plan" });
    }

    const estado = mp.estadoDeMP(sub.status);
    if (!estado) return res.status(200).json({ message: "Pendiente de pago" });

    const { data: cuenta } = await supabase
      .from("cuentas")
      .select("id, mp_preapproval_id")
      .eq("id", ref.cuentaId)
      .maybeSingle();
    if (!cuenta) return res.status(200).json({ message: "Cuenta no encontrada" });

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

module.exports = { mercadoPagoWebhook };
