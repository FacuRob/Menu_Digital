// ══════════════════════════════════════════════════════════════
// Crea un CLIENTE DE PRUEBA simulando una compra de Hotmart, sin
// depender del webhook. Sirve para verificar el panel de plataforma
// y que el menú del cliente nuevo arranca vacío.
//
// Uso (desde backend/):
//   node scripts/seedClientePrueba.js
//   node scripts/seedClientePrueba.js "Bar Demo" demo@correo.com standard anual
//
// Args: [nombre] [email] [plan(free|basic|standard|premium)] [ciclo(mensual|anual)]
// Requiere el .env del backend (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
// ══════════════════════════════════════════════════════════════
require("dotenv").config();
const bcrypt = require("bcryptjs");
const supabase = require("../src/config/database");

const nombre = process.argv[2] || "Bar de Prueba";
const email = process.argv[3] || `prueba+${Date.now()}@ejemplo.com`;
const plan = process.argv[4] || "standard";
const ciclo = process.argv[5] === "anual" ? "anual" : "mensual";

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);

(async () => {
  try {
    // 1) Cuenta (suscriptor). El trigger de la BD deriva los límites del plan.
    const { data: cuenta, error: cuentaErr } = await supabase
      .from("cuentas")
      .upsert(
        {
          email,
          nombre,
          tipo_plan: plan,
          ciclo_facturacion: ciclo,
          estado_suscripcion: "activo",
          origen: "hotmart",
          hotmart_transaction: `TEST-${Date.now()}`,
        },
        { onConflict: "email" },
      )
      .select()
      .single();
    if (cuentaErr) throw cuentaErr;

    // 2) Negocio VACÍO + su configuración (sin categorías/productos).
    const { count: yaTiene } = await supabase
      .from("negocios")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuenta.id);

    if (!yaTiene) {
      const { data: neg, error: negErr } = await supabase
        .from("negocios")
        .insert([
          {
            nombre,
            slug: `${slugify(nombre) || "negocio"}-${cuenta.id}`,
            activo: true,
            cuenta_id: cuenta.id,
          },
        ])
        .select()
        .single();
      if (negErr) throw negErr;
      await supabase
        .from("configuracion")
        .insert([{ negocio_id: neg.id, nombre, retiro_activo: true }]);
    }

    // 3) Usuario superadmin de la cuenta, con contraseña temporal conocida.
    const tempPassword = "Prueba123";
    const hashed = await bcrypt.hash(tempPassword, 10);
    const username = email.length <= 50 ? email : `cliente-${cuenta.id}`;

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
    } else {
      const { error: userErr } = await supabase.from("usuarios").insert([
        {
          username,
          password: hashed,
          nombre,
          email,
          rol: "superadmin",
          activo: true,
          must_change_password: true,
          cuenta_id: cuenta.id,
        },
      ]);
      if (userErr) throw userErr;
    }

    console.log("\n✅ Cliente de prueba creado / actualizado\n");
    console.log("   Cuenta id : ", cuenta.id);
    console.log("   Nombre    : ", nombre);
    console.log("   Plan      : ", plan, `(${ciclo})`);
    console.log("   Login user: ", username);
    console.log("   Password  : ", userExist ? "(sin cambios)" : tempPassword);
    console.log(
      "\n👉 Entrá al panel de Plataforma: debería aparecer esta cuenta.",
    );
    console.log(
      "👉 Logueate con ese usuario: el menú y el dashboard deben estar vacíos.\n",
    );
    process.exit(0);
  } catch (e) {
    console.error("\n❌ Error creando el cliente de prueba:", e.message, "\n");
    process.exit(1);
  }
})();
