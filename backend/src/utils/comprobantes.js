const supabase = require("../config/database");
const { PRECIOS_MENSUALES, MONEDA } = require("./planPrecios");

// Copia oculta de cada comprobante (el dueño de DinexFlow). Si no está
// definida, se usa el email de soporte.
const emailCopia = () => process.env.COMPROBANTES_COPIA_EMAIL || process.env.SOPORTE_EMAIL || null;

const urlSuscripcion = () => {
  try {
    return `${new URL(process.env.ADMIN_URL || "").origin}/admin/suscripcion`;
  } catch {
    return null;
  }
};

// Emite y manda el comprobante de un cobro mensual aprobado.
// - Se guarda primero: mp_cobro_id es UNIQUE, así un aviso repetido de MP
//   no genera ni manda un segundo comprobante.
// - Nunca tira: un problema con el email no debe frenar el webhook.
const emitirComprobante = async ({ cuenta, cobro, sub, enviar }) => {
  try {
    const plan = cuenta.tipo_plan;
    const precioLista = PRECIOS_MENSUALES[plan] || 0;
    const total = Math.round(Number(cobro.transaction_amount)) || precioLista;
    const descuentoPct =
      total < precioLista && precioLista > 0 ? Math.round(((precioLista - total) / precioLista) * 100) : 0;
    const clienteEmail = cuenta.email || cuenta.mp_email || null;

    const fila = {
      cuenta_id: cuenta.id,
      mp_cobro_id: String(cobro.id),
      mp_pago_id: cobro.payment?.id != null ? String(cobro.payment.id) : null,
      plan,
      precio_lista: precioLista,
      descuento_pct: descuentoPct,
      total,
      moneda: cobro.currency_id || MONEDA,
      periodo_desde: cobro.debit_date || cobro.date_created || new Date(Date.now()).toISOString(),
      periodo_hasta: sub?.next_payment_date || null,
      cliente_nombre: cuenta.nombre || null,
      cliente_email: clienteEmail,
    };

    const { data: comp, error } = await supabase.from("comprobantes").insert(fila).select().maybeSingle();
    if (error) {
      if (error.code === "23505") return null; // ya emitido para este cobro
      throw error;
    }
    if (!comp || !clienteEmail) return comp;

    await enviar({
      to: clienteEmail,
      copia: emailCopia(),
      comprobante: {
        ...comp,
        fecha: comp.created_at || fila.periodo_desde,
        url: urlSuscripcion(),
        emisor: { nombre: process.env.EMISOR_NOMBRE || "DinexFlow", cuit: process.env.EMISOR_CUIT || null },
      },
    });
    await supabase.from("comprobantes").update({ enviado_at: new Date(Date.now()).toISOString() }).eq("id", comp.id);
    return comp;
  } catch (e) {
    console.error("[Comprobantes] No se pudo emitir el comprobante del cobro", cobro?.id, e.message);
    return null;
  }
};

module.exports = { emitirComprobante, emailCopia };
