const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { preciosPorPlan, mrrDeCuenta } = require("../utils/planPrecios");

// ══════════════════════════════════════════════════════════════
// Panel de PLATAFORMA — sólo para el dueño del SaaS (es_plataforma).
// Da visibilidad sobre las CUENTAS (suscriptores que pagan), su plan,
// estado y uso. La guardia requirePlataforma ya validó el acceso.
// ══════════════════════════════════════════════════════════════

// Listado de todas las cuentas con su uso agregado (negocios/usuarios/productos).
const getCuentas = async (req, res) => {
  try {
    const [cuentasRes, negociosRes, usuariosRes, productosRes] =
      await Promise.all([
        supabase.from("cuentas").select("*").order("id", { ascending: true }),
        supabase.from("negocios").select("id, cuenta_id"),
        supabase.from("usuarios").select("id, cuenta_id"),
        supabase.from("productos").select("id, negocio_id"),
      ]);

    if (cuentasRes.error) throw cuentasRes.error;
    if (negociosRes.error) throw negociosRes.error;
    if (usuariosRes.error) throw usuariosRes.error;
    if (productosRes.error) throw productosRes.error;

    const negocios = negociosRes.data || [];
    const usuarios = usuariosRes.data || [];
    const productos = productosRes.data || [];

    // negocio_id → cuenta_id (para contar productos por cuenta).
    const negocioACuenta = new Map(negocios.map((n) => [n.id, n.cuenta_id]));

    const contar = (arr, keyFn) => {
      const m = new Map();
      for (const item of arr) {
        const k = keyFn(item);
        if (k == null) continue;
        m.set(k, (m.get(k) || 0) + 1);
      }
      return m;
    };

    const negociosPorCuenta = contar(negocios, (n) => n.cuenta_id);
    const usuariosPorCuenta = contar(usuarios, (u) => u.cuenta_id);
    const productosPorCuenta = contar(productos, (p) =>
      negocioACuenta.get(p.negocio_id),
    );

    const cuentas = (cuentasRes.data || []).map((c) => ({
      ...c,
      negocios_count: negociosPorCuenta.get(c.id) || 0,
      usuarios_count: usuariosPorCuenta.get(c.id) || 0,
      productos_count: productosPorCuenta.get(c.id) || 0,
    }));

    res.json(cuentas);
  } catch (error) {
    return respondError(res, error, "plataforma");
  }
};

// Métricas agregadas para las tarjetas del panel.
const getResumen = async (req, res) => {
  try {
    const [cuentasRes, negociosRes] = await Promise.all([
      supabase
        .from("cuentas")
        .select("tipo_plan, ciclo_facturacion, estado_suscripcion, origen, created_at"),
      supabase.from("negocios").select("id"),
    ]);

    if (cuentasRes.error) throw cuentasRes.error;
    if (negociosRes.error) throw negociosRes.error;

    const cuentas = cuentasRes.data || [];

    const precios = preciosPorPlan();
    const porPlan = { free: 0, basic: 0, standard: 0, premium: 0 };
    // MRR = ingresos recurrentes; sólo cuenta suscripciones ACTIVAS.
    // Anuales prorrateadas /12 según el ciclo de cada cuenta.
    const mrrPorPlan = { basic: 0, standard: 0, premium: 0 };
    let activas = 0;
    let canceladas = 0;
    let porHotmart = 0;

    for (const c of cuentas) {
      if (porPlan[c.tipo_plan] !== undefined) porPlan[c.tipo_plan] += 1;
      if (c.estado_suscripcion === "activo") {
        activas += 1;
        if (mrrPorPlan[c.tipo_plan] !== undefined) {
          mrrPorPlan[c.tipo_plan] += mrrDeCuenta(
            precios,
            c.tipo_plan,
            c.ciclo_facturacion,
          );
        }
      } else if (c.estado_suscripcion === "cancelado") {
        canceladas += 1;
      }
      if (c.origen === "hotmart") porHotmart += 1;
    }

    const mrr = mrrPorPlan.basic + mrrPorPlan.standard + mrrPorPlan.premium;

    res.json({
      total_cuentas: cuentas.length,
      activas,
      canceladas,
      por_hotmart: porHotmart,
      por_plan: porPlan,
      total_negocios: (negociosRes.data || []).length,
      moneda: precios.moneda,
      mrr,
      mrr_por_plan: mrrPorPlan,
      precios,
    });
  } catch (error) {
    return respondError(res, error, "plataforma");
  }
};

module.exports = { getCuentas, getResumen };
