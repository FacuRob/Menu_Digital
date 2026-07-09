const supabase = require("../config/database");
const bcrypt = require("bcryptjs");
const { planPorProducto } = require("../utils/hotmartPlans");
const { sendWelcomeEmail } = require("../services/emailService");

// ── Helpers ──────────────────────────────────────────────────
const generarPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++)
    pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
};

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);

// El username tiene límite VARCHAR(50). El email suele entrar; si no,
// usamos la parte local + id de cuenta para garantizar unicidad y largo.
const buildUsername = (email, cuentaId) => {
  if (email && email.length <= 50) return email;
  const local = (email || "user").split("@")[0].slice(0, 40);
  return `${local}-${cuentaId}`;
};

// Hotmart 2.0 manda body.data.{buyer,purchase,product}; versiones viejas
// mandan campos planos. Normalizamos ambos.
const extractPayload = (body) => {
  const d = body?.data || body || {};
  return {
    event: body?.event,
    email: d?.buyer?.email || body?.email || null,
    nombre: d?.buyer?.name || body?.name || null,
    status: String(d?.purchase?.status ?? body?.status ?? ""),
    productId: d?.product?.id ?? body?.product?.id ?? body?.prod ?? null,
    transaction: d?.purchase?.transaction || body?.transaction || null,
  };
};

const esAprobado = (status) =>
  ["approved", "aprovado", "complete", "completed"].includes(
    status.toLowerCase(),
  );

// ── Webhook ──────────────────────────────────────────────────
// POST /api/webhooks/hotmart  (público; la seguridad es el hottok)
const hotmartWebhook = async (req, res) => {
  try {
    // 1) Validar el token de seguridad de Hotmart (hottok).
    const hottok = req.headers["x-hotmart-hottok"] || req.body?.hottok;
    if (!process.env.HOTMART_HOTTOK || hottok !== process.env.HOTMART_HOTTOK) {
      return res.status(401).json({ message: "Token de seguridad inválido" });
    }

    const { status, email, nombre, productId, transaction } = extractPayload(
      req.body,
    );

    // Sólo procesamos compras aprobadas. Otros eventos → 200 para que
    // Hotmart no reintente.
    if (!esAprobado(status)) {
      return res.status(200).json({ message: "Evento ignorado", status });
    }
    if (!email) {
      return res.status(200).json({ message: "Compra sin email de comprador" });
    }

    const { plan, ciclo } = planPorProducto(productId);
    if (!plan) {
      console.warn("[Hotmart] product_id sin plan mapeado:", productId);
      return res
        .status(200)
        .json({ message: "Producto no mapeado a un plan", productId });
    }

    // 3) Upsert de la cuenta por email con el plan comprado.
    //    El trigger de la BD recalcula limite_negocios/limite_productos.
    const { data: cuenta, error: cuentaErr } = await supabase
      .from("cuentas")
      .upsert(
        {
          email,
          nombre: nombre || email,
          tipo_plan: plan,
          ciclo_facturacion: ciclo,
          estado_suscripcion: "activo",
          origen: "hotmart",
          hotmart_transaction: transaction,
        },
        { onConflict: "email" },
      )
      .select()
      .single();
    if (cuentaErr) throw cuentaErr;

    // Asegurar que la cuenta tenga al menos un negocio para administrar.
    const { count: negocios } = await supabase
      .from("negocios")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuenta.id);

    if (!negocios) {
      const { data: neg } = await supabase
        .from("negocios")
        .insert([
          {
            nombre: nombre || "Mi negocio",
            slug: `${slugify(nombre || email) || "negocio"}-${cuenta.id}`,
            activo: true,
            cuenta_id: cuenta.id,
          },
        ])
        .select()
        .single();
      if (neg) {
        await supabase
          .from("configuracion")
          .insert([
            { negocio_id: neg.id, nombre: nombre || "Mi negocio", retiro_activo: true },
          ]);
      }
    }

    // 2) Crear el usuario (perfil) del comprador si no existe.
    const { data: userExist } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    // Idempotencia: si ya existe (re-compra / upgrade / reintento del
    // webhook), sólo actualizamos su vínculo y NO tocamos la contraseña.
    if (userExist) {
      await supabase
        .from("usuarios")
        .update({ cuenta_id: cuenta.id, activo: true })
        .eq("id", userExist.id);
      return res
        .status(200)
        .json({ message: "Suscripción actualizada", plan, cuenta_id: cuenta.id });
    }

    const tempPassword = generarPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    const username = buildUsername(email, cuenta.id);

    const { data: nuevo, error: userErr } = await supabase
      .from("usuarios")
      .insert([
        {
          username,
          password: hashed,
          nombre: nombre || null,
          email,
          rol: "superadmin",
          activo: true,
          must_change_password: true,
          cuenta_id: cuenta.id,
        },
      ])
      .select("id, username, email")
      .single();
    if (userErr) throw userErr;

    // 4) Enviar credenciales por email. Un fallo de email NO debe abortar
    //    el alta (ya está creada); lo logueamos y devolvemos OK.
    const loginUrl =
      process.env.ADMIN_URL || "http://localhost:3001/admin/login";
    try {
      await sendWelcomeEmail({
        to: email,
        nombre,
        username,
        tempPassword,
        loginUrl,
        plan,
      });
    } catch (e) {
      console.error("[Hotmart] Falló el email de bienvenida:", e.message);
    }

    return res.status(201).json({
      message: "Cuenta y usuario creados",
      plan,
      cuenta_id: cuenta.id,
      usuario_id: nuevo.id,
    });
  } catch (error) {
    console.error("[Hotmart] Error en webhook:", error);
    // 500 → Hotmart reintenta (útil si fue un error transitorio de BD).
    return res.status(500).json({ error: error.message });
  }
};

module.exports = { hotmartWebhook };
