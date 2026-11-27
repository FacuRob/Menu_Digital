// Cliente mínimo de la API de suscripciones de Mercado Pago (preapproval).
//
//   MP_ACCESS_TOKEN     → Access Token de la aplicación (credenciales de producción
//                         o de prueba, según el entorno).
//   MP_WEBHOOK_SECRET   → Clave secreta de las notificaciones (Webhooks), para
//                         validar el header x-signature.
//
// Cada cuenta paga con una suscripción mensual en ARS. Se vincula a la cuenta
// por external_reference ("cuenta:<id>:plan:<code>"), no por email.
const crypto = require("crypto");
const { PRECIOS_MENSUALES, MODULOS_PAGOS } = require("./planPrecios");

const API = "https://api.mercadopago.com";
const NOMBRES = { basic: "Básico", standard: "Estándar", premium: "Pro" };

const mpFetch = async (path, { method = "GET", body } = {}) => {
  const resp = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(`Mercado Pago ${method} ${path} → ${resp.status}: ${json?.message || ""}`);
    err.status = resp.status;
    err.mp = json; // respuesta completa de MP (message, error, cause) para diagnosticar
    throw err;
  }
  return json;
};

// Módulos sumados al pagar: "cuenta:7:plan:basic:mod:ia.whatsapp".
const referencia = (cuentaId, plan, modulos = []) =>
  `cuenta:${cuentaId}:plan:${plan}` + (modulos.length ? `:mod:${[...modulos].sort().join(".")}` : "");

const leerReferencia = (ref) => {
  const m = /^cuenta:(\d+):plan:(basic|standard|premium)(?::mod:([a-z]+(?:\.[a-z]+)*))?$/.exec(String(ref || ""));
  if (!m) return null;
  const modulos = m[3] ? m[3].split(".").filter((c) => MODULOS_PAGOS[c]) : [];
  return { cuentaId: Number(m[1]), plan: m[2], modulos };
};

// Crea la suscripción pendiente de pago y devuelve su link de checkout (init_point).
// `monto` permite cobrar con descuento (cupón) y módulos; por defecto, el precio del plan.
const crearSuscripcion = ({ cuentaId, plan, email, backUrl, modulos = [], monto = PRECIOS_MENSUALES[plan] }) =>
  mpFetch("/preapproval", {
    method: "POST",
    body: {
      reason:
        `DinexFlow · Plan ${NOMBRES[plan]}` +
        (modulos.length ? ` + ${modulos.map((c) => MODULOS_PAGOS[c]?.nombre || c).join(" + ")}` : ""),
      external_reference: referencia(cuentaId, plan, modulos),
      payer_email: email,
      back_url: backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: monto,
        currency_id: "ARS",
      },
    },
  });

// Cambia el monto de los próximos cobros (aplicar o terminar un descuento).
const cambiarMonto = (id, monto) =>
  mpFetch(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { auto_recurring: { transaction_amount: monto, currency_id: "ARS" } },
  });

const obtenerSuscripcion = (id) => mpFetch(`/preapproval/${encodeURIComponent(id)}`);

// Cobro mensual de una suscripción (topic subscription_authorized_payment).
const obtenerCobro = (id) => mpFetch(`/authorized_payments/${encodeURIComponent(id)}`);

const cancelarSuscripcion = (id) =>
  mpFetch(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { status: "cancelled" },
  });

// Estado de MP → estado interno de la cuenta. `pending` no cambia nada
// (todavía no pagó).
const estadoDeMP = (status) =>
  ({ authorized: "activo", cancelled: "cancelado", paused: "vencido" })[status] || null;

// Valida x-signature ("ts=...,v1=...") según la documentación de MP:
// HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
const firmaValida = ({ xSignature, xRequestId, dataId }) => {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !xSignature || !dataId) return false;
  const partes = Object.fromEntries(
    String(xSignature)
      .split(",")
      .map((p) => p.split("=").map((s) => s.trim())),
  );
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifiesto =
    `id:${id};` + (xRequestId ? `request-id:${xRequestId};` : "") + `ts:${partes.ts};`;
  const esperado = crypto.createHmac("sha256", secret).update(manifiesto).digest("hex");
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(String(partes.v1), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Motivo de un rechazo de MP en palabras para el cliente. Los casos comunes se
// traducen; el resto muestra el texto de MP para poder diagnosticarlo.
const motivoRechazo = (err) => {
  const mp = err?.mp || {};
  const causas = (Array.isArray(mp.cause) ? mp.cause : [])
    .map((c) => c?.description || c?.code)
    .filter(Boolean);
  const texto = [mp.message, mp.error, ...causas].filter(Boolean).join(" · ");

  if (/yourself|same user|pagarte|mismo usuario/i.test(texto)) {
    return "Ese email es el de la cuenta de Mercado Pago que cobra. Escribí el email de otra cuenta de Mercado Pago para pagar.";
  }
  if (/test user|real or test|usuarios? de prueba|different countries|different site|invalid users/i.test(texto)) {
    return "Mercado Pago no reconoce ese email como una cuenta de Argentina. Escribí el email con el que entrás a tu Mercado Pago (con credenciales de prueba, el de un usuario de prueba).";
  }
  if (/back_?url/i.test(texto)) {
    return "La dirección de vuelta del pago no es válida. Revisá ADMIN_URL en el backend (tiene que ser https).";
  }
  if (/amount|monto/i.test(texto)) {
    return `Mercado Pago no aceptó el monto (${texto}).`;
  }
  return texto ? `Mercado Pago rechazó el pago: ${texto}` : "No se pudo iniciar el pago con Mercado Pago";
};

// Página de Mercado Pago donde el cliente ve y cancela sus suscripciones.
const PORTAL_URL = "https://www.mercadopago.com.ar/subscriptions";

module.exports = {
  crearSuscripcion,
  obtenerSuscripcion,
  obtenerCobro,
  cambiarMonto,
  cancelarSuscripcion,
  estadoDeMP,
  firmaValida,
  motivoRechazo,
  referencia,
  leerReferencia,
  PORTAL_URL,
};
