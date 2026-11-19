const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const {
  estaVigente,
  diasRestantes,
  TRIAL_DIAS,
  LIMITES_POR_PLAN: LIMITES,
} = require("../utils/suscripcion");
const { preciosPorPlan } = require("../utils/planPrecios");
const { crearSuscripcion, motivoRechazo, PORTAL_URL } = require("../utils/mercadoPago");
const { precioConDescuento, tieneDescuento } = require("../utils/cupones");

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
  };
};

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

// POST /api/suscripcion/checkout/:plan  { email? }  → { url }  (checkout de Mercado Pago)
// `email` es el de la cuenta de Mercado Pago con la que se paga; puede no ser
// el del usuario de DinexFlow. MP solo deja pagar a quien inicia sesión con él.
const getCheckout = async (req, res) => {
  try {
    const plan = String(req.params.plan || "").toLowerCase();
    if (!["basic", "standard", "premium"].includes(plan)) {
      return res.status(400).json({ message: "Plan inválido" });
    }
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

    // Con cupón vigente, la suscripción nace con el precio rebajado.
    const pct = tieneDescuento(cuenta) ? cuenta.descuento_pct : 0;

    const sub = await crearSuscripcion({
      cuentaId,
      plan,
      email,
      backUrl: urlDeVuelta(),
      monto: precioConDescuento(plan, pct),
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

module.exports = { getEstado, getCheckout };
