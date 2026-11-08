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
const { PRECIOS_MENSUALES } = require("./planPrecios");

const API = "https://api.mercadopago.com";
const NOMBRES = { basic: "Básico", standard: "Estándar", premium: "Premium" };

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
    throw err;
  }
  return json;
};

const referencia = (cuentaId, plan) => `cuenta:${cuentaId}:plan:${plan}`;

const leerReferencia = (ref) => {
  const m = /^cuenta:(\d+):plan:(basic|standard|premium)$/.exec(String(ref || ""));
  return m ? { cuentaId: Number(m[1]), plan: m[2] } : null;
};

// Crea la suscripción pendiente de pago y devuelve su link de checkout (init_point).
const crearSuscripcion = ({ cuentaId, plan, email, backUrl }) =>
  mpFetch("/preapproval", {
    method: "POST",
    body: {
      reason: `DinexFlow · Plan ${NOMBRES[plan]}`,
      external_reference: referencia(cuentaId, plan),
      payer_email: email,
      back_url: backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PRECIOS_MENSUALES[plan],
        currency_id: "ARS",
      },
    },
  });

const obtenerSuscripcion = (id) => mpFetch(`/preapproval/${encodeURIComponent(id)}`);

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

// Página de Mercado Pago donde el cliente ve y cancela sus suscripciones.
const PORTAL_URL = "https://www.mercadopago.com.ar/subscriptions";

module.exports = {
  crearSuscripcion,
  obtenerSuscripcion,
  cancelarSuscripcion,
  estadoDeMP,
  firmaValida,
  referencia,
  leerReferencia,
  PORTAL_URL,
};
