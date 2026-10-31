const crypto = require("crypto");
const supabase = require("../config/database");
const bcrypt = require("bcryptjs");
const { planPorVariant } = require("../utils/lemonSqueezyPlans");
const { sendWelcomeEmail } = require("../services/emailService");
const { slugify } = require("../utils/slug");

// ── Helpers ──────────────────────────────────────────────────
const generarPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++)
    pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
};

// Cuenta a la que corresponde el pago, si ya está vinculada: primero la que
// mandó nuestro checkout (cuenta_id), si no, la que ya tiene esta suscripción.
const buscarCuentaVinculada = async (cuentaId, subId) => {
  if (Number.isInteger(cuentaId) && cuentaId > 0) {
    const { data } = await supabase
      .from("cuentas")
      .select("id")
      .eq("id", cuentaId)
      .maybeSingle();
    if (data) return data;
  }
  if (subId) {
    const { data } = await supabase
      .from("cuentas")
      .select("id")
      .eq("ls_subscription_id", subId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
};

// Asegurar que la cuenta tenga al menos un negocio (con su configuración).
const asegurarNegocio = async (cuenta, nombre, email) => {
  const { count } = await supabase
    .from("negocios")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuenta.id);
  if (count) return;
  const nombreNeg = nombre || "Mi negocio";
  const { data: neg } = await supabase
    .from("negocios")
    .insert([
      {
        nombre: nombreNeg,
        slug: `${slugify(nombre || email, 50) || "negocio"}-${cuenta.id}`,
        activo: true,
        cuenta_id: cuenta.id,
      },
    ])
    .select()
    .single();
  if (neg) {
    await supabase
      .from("configuracion")
      .insert([{ negocio_id: neg.id, nombre: nombreNeg, retiro_activo: true }]);
  }
};

const buildUsername = (email, cuentaId) => {
  if (email && email.length <= 50) return email;
  const local = (email || "user").split("@")[0].slice(0, 40);
  return `${local}-${cuentaId}`;
};

// Estado de LS → estado interno de la cuenta.
//   active/on_trial → activo · past_due/unpaid/expired/paused → vencido
//   cancelled → cancelado (acceso hasta ends_at)
const estadoDeLS = (lsStatus) => {
  switch (String(lsStatus || "").toLowerCase()) {
    case "active":
    case "on_trial":
      return "activo";
    case "cancelled":
      return "cancelado";
    case "past_due":
    case "unpaid":
    case "expired":
    case "paused":
    default:
      return "vencido";
  }
};

// Verifica la firma HMAC-SHA256 del webhook (header X-Signature) sobre el
// cuerpo crudo, en tiempo constante.
const firmaValida = (rawBody, signature) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  try {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = hmac.update(rawBody).digest("hex");
    const a = Buffer.from(digest, "hex");
    const b = Buffer.from(String(signature), "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

// ── Webhook ──────────────────────────────────────────────────
// POST /api/webhooks/lemonsqueezy   (público; la seguridad es la firma HMAC)
// Recibe el body CRUDO (Buffer) para poder verificar la firma.
const lemonSqueezyWebhook = async (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    if (!firmaValida(raw, req.headers["x-signature"])) {
      return res.status(401).json({ message: "Firma inválida" });
    }

    let payload;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      return res.status(400).json({ message: "JSON inválido" });
    }

    const event = payload?.meta?.event_name;
    const attrs = payload?.data?.attributes || {};
    const subId = payload?.data?.id ? String(payload.data.id) : null;

    // Solo nos interesan eventos de suscripción.
    if (!event || !event.startsWith("subscription")) {
      return res.status(200).json({ message: "Evento ignorado", event });
    }

    const email = attrs.user_email ? String(attrs.user_email).toLowerCase() : null;
    const nombre = attrs.user_name || null;
    const variantId = attrs.variant_id ?? null;
    const lsStatus = attrs.status || null;
    const customerId = attrs.customer_id ? String(attrs.customer_id) : null;
    // Fin del período: ends_at (cancelaciones) o renews_at (próximo cobro).
    const periodoFin = attrs.ends_at || attrs.renews_at || null;
    // Cuenta que inició el pago desde el panel (checkout[custom][cuenta_id]).
    // LS la reenvía en meta.custom_data en todos los eventos de la suscripción.
    const cuentaIdCheckout = parseInt(payload?.meta?.custom_data?.cuenta_id, 10);

    const { plan, ciclo } = planPorVariant(variantId);
    if (!plan) {
      console.warn("[LemonSqueezy] variant sin plan mapeado:", variantId);
      return res
        .status(200)
        .json({ message: "Variant no mapeado a un plan", variantId });
    }

    const estado = estadoDeLS(lsStatus);
    // Datos de la suscripción. El trigger de la BD recalcula los límites.
    const datosSuscripcion = {
      tipo_plan: plan,
      ciclo_facturacion: ciclo,
      estado_suscripcion: estado,
      periodo_fin: periodoFin,
      ls_customer_id: customerId,
      ls_subscription_id: subId,
      ls_variant_id: variantId ? String(variantId) : null,
      ls_status: lsStatus,
    };

    // 1) Cuenta ya vinculada: la que pagó desde el panel (aunque haya usado
    //    otro email en el checkout) o la dueña de esta suscripción.
    const vinculada = await buscarCuentaVinculada(cuentaIdCheckout, subId);
    if (vinculada) {
      const { data: cuenta, error } = await supabase
        .from("cuentas")
        .update(datosSuscripcion)
        .eq("id", vinculada.id)
        .select()
        .single();
      if (error) throw error;
      await asegurarNegocio(cuenta, nombre, email);
      return res
        .status(200)
        .json({ message: "Suscripción actualizada", plan, estado, cuenta_id: cuenta.id });
    }

    // 2) Compra directa en Lemon Squeezy (sin cuenta previa en el panel):
    //    se identifica por email y, si no existe, se crea la cuenta.
    if (!email) {
      return res.status(200).json({ message: "Evento sin email ni cuenta vinculada" });
    }
    const { data: cuenta, error: cuentaErr } = await supabase
      .from("cuentas")
      .upsert(
        {
          email,
          nombre: nombre || email,
          origen: "lemonsqueezy",
          ...datosSuscripcion,
        },
        { onConflict: "email" },
      )
      .select()
      .single();
    if (cuentaErr) throw cuentaErr;

    await asegurarNegocio(cuenta, nombre, email);

    // Crear el usuario admin si no existe.
    const { data: userExist } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    if (userExist) {
      await supabase
        .from("usuarios")
        .update({ cuenta_id: cuenta.id, activo: true })
        .eq("id", userExist.id);
      return res.status(200).json({ message: "Suscripción actualizada", plan, estado });
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
          rol: "admin",
          activo: true,
          must_change_password: true,
          cuenta_id: cuenta.id,
        },
      ])
      .select("id, username, email")
      .single();
    if (userErr) throw userErr;

    const loginUrl = process.env.ADMIN_URL || "http://localhost:3001/admin/login";
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
      console.error("[LemonSqueezy] Falló el email de bienvenida:", e.message);
    }

    return res.status(201).json({
      message: "Cuenta y usuario creados",
      plan,
      estado,
      cuenta_id: cuenta.id,
      usuario_id: nuevo.id,
    });
  } catch (error) {
    console.error("[LemonSqueezy] Error en webhook:", error);
    return res.status(500).json({ message: "Error procesando el webhook" });
  }
};

module.exports = { lemonSqueezyWebhook };
