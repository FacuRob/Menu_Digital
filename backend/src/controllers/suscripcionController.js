const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const {
  estaVigente,
  diasRestantes,
  TRIAL_DIAS,
  LIMITES_POR_PLAN: LIMITES,
} = require("../utils/suscripcion");
const { preciosPorPlan } = require("../utils/planPrecios");
const { crearSuscripcion, PORTAL_URL } = require("../utils/mercadoPago");

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

    const { data: cuenta, error } = await supabase
      .from("cuentas")
      .select("tipo_plan, estado_suscripcion, periodo_fin, created_at")
      .eq("id", cuentaId)
      .single();
    if (error || !cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    res.json({
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

// GET /api/suscripcion/checkout/:plan  → { url }  (checkout de Mercado Pago)
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

    // Mercado Pago exige el email del pagador (el JWT no lo trae).
    const { data: u } = await supabase
      .from("usuarios")
      .select("email")
      .eq("id", req.user?.id)
      .maybeSingle();
    if (!u?.email) {
      return res.status(400).json({
        message: "Tu usuario no tiene email. Cargalo en tu cuenta para poder pagar.",
      });
    }

    const sub = await crearSuscripcion({
      cuentaId,
      plan,
      email: u.email,
      backUrl: urlDeVuelta(),
    });
    if (!sub?.init_point) {
      return res.status(502).json({ message: "Mercado Pago no devolvió el link de pago" });
    }
    res.json({ url: sub.init_point });
  } catch (error) {
    if (error.status) {
      console.error("[MercadoPago] checkout:", error.message);
      return res.status(502).json({ message: "No se pudo iniciar el pago con Mercado Pago" });
    }
    return respondError(res, error, "suscripcion");
  }
};

module.exports = { getEstado, getCheckout };
