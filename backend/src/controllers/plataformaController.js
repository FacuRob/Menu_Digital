const jwt = require("jsonwebtoken");
const supabase = require("../config/database");
const { registrar } = require("../utils/registroCambios");
const { respondError } = require("../utils/respondError");
const { preciosPorPlan, mrrDeCuenta } = require("../utils/planPrecios");
const { precioConDescuento, tieneDescuento } = require("../utils/cupones");

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

// Ids de las cuentas de Tech (las que tienen un usuario es_plataforma).
const cuentasDeTech = async () => {
  const { data, error } = await supabase.from("usuarios").select("cuenta_id").eq("es_plataforma", true);
  if (error) throw error;
  return new Set((data || []).map((u) => u.cuenta_id).filter((id) => id != null));
};

// Métricas de las cuentas CLIENTE. Las cuentas de Tech (las que tienen un
// usuario es_plataforma) no son clientes: no suman a ningún número, y el MRR
// de cada cuenta usa el precio con el descuento de cupón que está pagando.
const calcularResumen = (cuentas, negocios, cuentasTech) => {
  const clientes = cuentas.filter((c) => !cuentasTech.has(c.id));
  const porPlan = { free: 0, basic: 0, standard: 0, premium: 0 };
  // MRR = ingresos recurrentes; sólo cuenta suscripciones ACTIVAS.
  const mrrPorPlan = { basic: 0, standard: 0, premium: 0 };
  let activas = 0;
  let canceladas = 0;
  // Cuentas que pagan por una pasarela (Mercado Pago, o Hotmart / Lemon
  // Squeezy históricos), frente a las cargadas a mano.
  let porPago = 0;

  for (const c of clientes) {
    if (porPlan[c.tipo_plan] !== undefined) porPlan[c.tipo_plan] += 1;
    if (c.estado_suscripcion === "activo") {
      activas += 1;
      if (mrrPorPlan[c.tipo_plan] !== undefined) {
        mrrPorPlan[c.tipo_plan] += tieneDescuento(c)
          ? precioConDescuento(c.tipo_plan, c.descuento_pct)
          : mrrDeCuenta(c.tipo_plan);
      }
    } else if (c.estado_suscripcion === "cancelado") {
      canceladas += 1;
    }
    if (c.mp_preapproval_id || ["hotmart", "lemonsqueezy"].includes(c.origen)) porPago += 1;
  }

  return {
    total_cuentas: clientes.length,
    activas,
    canceladas,
    por_pago: porPago,
    por_plan: porPlan,
    total_negocios: negocios.filter((n) => !cuentasTech.has(n.cuenta_id)).length,
    mrr: mrrPorPlan.basic + mrrPorPlan.standard + mrrPorPlan.premium,
    mrr_por_plan: mrrPorPlan,
  };
};

// Métricas agregadas para las tarjetas del panel.
const getResumen = async (req, res) => {
  try {
    const [cuentasRes, negociosRes, cuentasTech] = await Promise.all([
      supabase.from("cuentas").select("*"),
      supabase.from("negocios").select("id, cuenta_id"),
      cuentasDeTech(),
    ]);

    if (cuentasRes.error) throw cuentasRes.error;
    if (negociosRes.error) throw negociosRes.error;
    const precios = preciosPorPlan();

    res.json({
      ...calcularResumen(cuentasRes.data || [], negociosRes.data || [], cuentasTech),
      moneda: precios.moneda,
      precios,
    });
  } catch (error) {
    return respondError(res, error, "plataforma");
  }
};

// Cuánto dura "Ver como el cliente". Después hay que volver a entrar.
const VER_COMO_MINUTOS = 30;

// POST /api/plataforma/cuentas/:id/ver → token de SOLO LECTURA para ver el
// panel de esa cuenta tal como lo ve su dueño. authMiddleware bloquea
// cualquier cambio con este token (ver middleware/authMiddleware.js).
const verComoCliente = async (req, res) => {
  try {
    const cuentaId = Number(req.params.id);
    if (!Number.isInteger(cuentaId) || cuentaId <= 0) {
      return res.status(400).json({ message: "Cuenta inválida." });
    }
    // El rol Tech sale del token (dura 24 h): acá se confirma en la base, por
    // si se lo quitaron a alguien.
    const { data: tech, error: errTech } = await supabase
      .from("usuarios")
      .select("id")
      .eq("id", req.user.id)
      .eq("activo", true)
      .eq("es_plataforma", true)
      .maybeSingle();
    if (errTech) throw errTech;
    if (!tech) return res.status(403).json({ message: "No autorizado." });

    const [{ data: cuenta, error: errC }, { data: usuarios, error: errU }] = await Promise.all([
      supabase.from("cuentas").select("id, nombre").eq("id", cuentaId).maybeSingle(),
      supabase
        .from("usuarios")
        .select("id, username, rol, es_plataforma")
        .eq("cuenta_id", cuentaId)
        .eq("activo", true)
        .order("id", { ascending: true }),
    ]);
    if (errC) throw errC;
    if (errU) throw errU;
    if (!cuenta) return res.status(404).json({ message: "No encontramos esa cuenta." });

    // Se entra como el dueño (rol admin); si no hay, el primer usuario activo.
    // Nunca como otro usuario Tech.
    const candidatos = (usuarios || []).filter((u) => u.es_plataforma !== true);
    const u = candidatos.find((x) => x.rol === "admin") || candidatos[0];
    if (!u) return res.status(404).json({ message: "Esta cuenta no tiene usuarios activos." });

    const token = jwt.sign(
      {
        id: u.id,
        username: u.username,
        rol: u.rol,
        cuenta_id: cuentaId,
        es_plataforma: false,
        must_change_password: false,
        solo_lectura: true,
        tech_id: req.user.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: `${VER_COMO_MINUTOS}m` },
    );
    // Queda en el registro de la cuenta: el cliente ve que Soporte entró.
    registrar({ user: { id: u.id, cuenta_id: cuentaId, tech_id: req.user.id } }, "ver_como", "cuenta", cuentaId, { minutos: VER_COMO_MINUTOS });
    console.info(`[plataforma] Tech ${req.user.id} ve la cuenta ${cuentaId} como el usuario ${u.id} (solo lectura)`);
    res.json({ token, cuenta: { id: cuenta.id, nombre: cuenta.nombre }, minutos: VER_COMO_MINUTOS });
  } catch (error) {
    return respondError(res, error, "plataforma.verComo");
  }
};

// Cuentas en riesgo: las que conviene ayudar antes de que se vayan.
// Usa sólo datos que ya existen (estado, periodo_fin, productos y pedidos).
const DIAS_PRUEBA_POR_VENCER = 3;
const DIAS_SIN_PEDIDOS = 14;
const MS_DIA = 24 * 60 * 60 * 1000;

const getRiesgo = async (req, res) => {
  try {
    const desde = new Date(Date.now() - DIAS_SIN_PEDIDOS * MS_DIA).toISOString();
    const [cuentasRes, negociosRes, productosRes, pedidosRes, cuentasTech] = await Promise.all([
      supabase
        .from("cuentas")
        .select("id, nombre, email, tipo_plan, estado_suscripcion, periodo_fin, created_at"),
      supabase.from("negocios").select("id, cuenta_id"),
      supabase.from("productos").select("negocio_id"),
      supabase.from("pedidos").select("negocio_id").gte("created_at", desde),
      cuentasDeTech(),
    ]);
    for (const r of [cuentasRes, negociosRes, productosRes, pedidosRes]) if (r.error) throw r.error;

    const negocioACuenta = new Map((negociosRes.data || []).map((n) => [n.id, n.cuenta_id]));
    const sumar = (arr) => {
      const m = new Map();
      for (const x of arr) {
        const c = negocioACuenta.get(x.negocio_id);
        if (c != null) m.set(c, (m.get(c) || 0) + 1);
      }
      return m;
    };
    const productos = sumar(productosRes.data || []);
    const pedidos = sumar(pedidosRes.data || []);
    const conNegocio = new Set((negociosRes.data || []).map((n) => n.cuenta_id));

    const ahora = Date.now();
    const dias = (f) => (f ? Math.ceil((new Date(f).getTime() - ahora) / MS_DIA) : null);

    const cuentas = [];
    for (const c of cuentasRes.data || []) {
      // La cuenta de Tech no es un cliente: nunca está "en riesgo".
      if (cuentasTech.has(c.id)) continue;
      const motivos = [];
      const restan = dias(c.periodo_fin);
      const antiguedad = c.created_at ? Math.floor((ahora - new Date(c.created_at).getTime()) / MS_DIA) : 0;

      if (c.estado_suscripcion === "vencido") motivos.push({ tipo: "vencida", nivel: "alto" });
      else if (c.estado_suscripcion === "cancelado")
        motivos.push({ tipo: "cancelada", nivel: "alto", dias: restan != null ? Math.max(0, restan) : null });
      else if (c.estado_suscripcion === "trial" && restan != null && restan <= DIAS_PRUEBA_POR_VENCER)
        motivos.push({ tipo: restan < 0 ? "prueba_vencida" : "prueba_por_vencer", nivel: "alto", dias: Math.max(0, restan) });

      // Lo de uso sólo aplica a cuentas que todavía pueden usar el panel.
      if (c.estado_suscripcion !== "vencido") {
        if (!conNegocio.has(c.id) || !productos.get(c.id)) {
          if (antiguedad >= 2) motivos.push({ tipo: "sin_configurar", nivel: "medio" });
        } else if (!pedidos.get(c.id) && antiguedad >= DIAS_SIN_PEDIDOS) {
          motivos.push({ tipo: "sin_pedidos", nivel: "medio", dias: DIAS_SIN_PEDIDOS });
        }
      }

      if (motivos.length)
        cuentas.push({
          id: c.id,
          nombre: c.nombre,
          email: c.email,
          tipo_plan: c.tipo_plan,
          estado_suscripcion: c.estado_suscripcion,
          nivel: motivos.some((m) => m.nivel === "alto") ? "alto" : "medio",
          motivos,
        });
    }
    // Primero las de nivel alto; dentro de cada nivel, las de plan pago.
    const peso = { premium: 3, standard: 2, basic: 1, free: 0 };
    cuentas.sort(
      (a, b) =>
        (b.nivel === "alto") - (a.nivel === "alto") || (peso[b.tipo_plan] || 0) - (peso[a.tipo_plan] || 0),
    );
    res.json(cuentas);
  } catch (error) {
    return respondError(res, error, "plataforma.riesgo");
  }
};

module.exports = { getCuentas, getResumen, getRiesgo, verComoCliente, calcularResumen };
