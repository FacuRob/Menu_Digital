const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const {
  estaVigente,
  diasRestantes,
  TRIAL_DIAS,
  LIMITES_POR_PLAN: LIMITES,
} = require("../utils/suscripcion");
const { preciosPorPlan } = require("../utils/planPrecios");
const { checkoutUrl } = require("../utils/lemonSqueezyPlans");

// Catálogo de planes para las tarjetas del frontend (precios desde env).
const catalogoPlanes = () => {
  const p = preciosPorPlan();
  const orden = ["basic", "standard", "premium"];
  return {
    moneda: p.moneda,
    trial_dias: TRIAL_DIAS,
    planes: orden.map((code) => ({
      code,
      precio_mensual: p.mensual[code],
      precio_anual: p.anual[code],
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

    // Columnas base (siempre existen).
    const { data: cuenta, error } = await supabase
      .from("cuentas")
      .select("tipo_plan, ciclo_facturacion, estado_suscripcion, created_at")
      .eq("id", cuentaId)
      .single();
    if (error || !cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    // `periodo_fin` puede no existir si la migración lemonsqueezy.sql aún no
    // corrió. Se lee aparte y se tolera su ausencia (la vista igual carga,
    // sin línea de tiempo, en vez de romper todo el endpoint).
    let periodoFin = null;
    const pfRes = await supabase
      .from("cuentas")
      .select("periodo_fin")
      .eq("id", cuentaId)
      .single();
    if (!pfRes.error) periodoFin = pfRes.data?.periodo_fin ?? null;

    const cuentaFull = { ...cuenta, periodo_fin: periodoFin };

    res.json({
      es_plataforma: false,
      tipo_plan: cuenta.tipo_plan,
      ciclo_facturacion: cuenta.ciclo_facturacion,
      estado_suscripcion: cuenta.estado_suscripcion,
      vigente: estaVigente(cuentaFull),
      periodo_fin: periodoFin,
      dias_restantes: diasRestantes(periodoFin),
      creado_at: cuenta.created_at,
      ...catalogo,
    });
  } catch (error) {
    return respondError(res, error, "suscripcion");
  }
};

// GET /api/suscripcion/checkout/:plan?ciclo=mensual|anual  → { url }
const getCheckout = async (req, res) => {
  try {
    const plan = String(req.params.plan || "").toLowerCase();
    const ciclo = req.query.ciclo === "anual" ? "anual" : "mensual";
    if (!["basic", "standard", "premium"].includes(plan)) {
      return res.status(400).json({ message: "Plan inválido" });
    }

    const base = checkoutUrl(plan, ciclo);
    if (!base) {
      return res.status(503).json({
        message:
          "Checkout no configurado. Definí LEMONSQUEEZY_CHECKOUT_* en el backend.",
      });
    }

    // El pago se vincula a la cuenta por su id (custom data que Lemon Squeezy
    // reenvía en el webhook), NO por el email: el cliente puede pagar con
    // otro email y la suscripción igual llega a su cuenta.
    const cuentaId = req.user?.cuenta_id;
    if (!cuentaId) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }
    const params = [`checkout[custom][cuenta_id]=${encodeURIComponent(cuentaId)}`];

    // Prefill del email (el JWT no lo trae: se lee del usuario en la BD).
    if (req.user?.id) {
      const { data: u } = await supabase
        .from("usuarios")
        .select("email")
        .eq("id", req.user.id)
        .maybeSingle();
      if (u?.email) params.push(`checkout[email]=${encodeURIComponent(u.email)}`);
    }

    const sep = base.includes("?") ? "&" : "?";
    res.json({ url: `${base}${sep}${params.join("&")}` });
  } catch (error) {
    return respondError(res, error, "suscripcion");
  }
};

// GET /api/suscripcion/portal  → { url }  (portal de cliente de LS)
// Requiere LEMONSQUEEZY_API_KEY y que la cuenta tenga ls_subscription_id.
const getPortal = async (req, res) => {
  try {
    const cuentaId = req.user?.cuenta_id;
    if (!cuentaId) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: "LEMONSQUEEZY_API_KEY no configurada" });
    }

    const { data: cuenta } = await supabase
      .from("cuentas")
      .select("ls_subscription_id")
      .eq("id", cuentaId)
      .single();

    if (!cuenta?.ls_subscription_id) {
      return res
        .status(404)
        .json({ message: "La cuenta no tiene una suscripción de Lemon Squeezy" });
    }

    const resp = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${cuenta.ls_subscription_id}`,
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    if (!resp.ok) {
      return res
        .status(502)
        .json({ message: "No se pudo obtener el portal de Lemon Squeezy" });
    }
    const json = await resp.json();
    const portal = json?.data?.attributes?.urls?.customer_portal || null;
    if (!portal) {
      return res.status(404).json({ message: "Portal no disponible" });
    }
    res.json({ url: portal });
  } catch (error) {
    return respondError(res, error, "suscripcion");
  }
};

module.exports = { getEstado, getCheckout, getPortal };
