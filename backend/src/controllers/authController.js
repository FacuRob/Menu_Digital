const supabase = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../services/emailService");
const { getCuentaId } = require("../utils/cuenta");
const { respondError } = require("../utils/respondError");

// Construye la URL de reseteo a partir de ADMIN_URL (que apunta al login).
// Ej: "https://panel.app/admin/login" -> "https://panel.app/admin/reset-password?token=..."
const buildResetUrl = (token) => {
  const base = (process.env.ADMIN_URL || "http://localhost:3001/admin/login")
    .replace(/\/+$/, "")
    .replace(/\/login$/, "");
  return `${base}/reset-password?token=${token}`;
};

const rolesValidos = ["superadmin", "editor", "visor"];

// ─── REGISTER ───────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { username, password, nombre, email, rol = "editor" } = req.body;

    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        message: "Rol inválido. Debe ser: superadmin, editor o visor",
      });
    }

    const { data: existing } = await supabase
      .from("usuarios")
      .select("id")
      .eq("username", username)
      .single();

    if (existing)
      return res.status(400).json({ message: "El usuario ya existe" });

    // Verificar email duplicado si se proveyó
    if (email) {
      const { data: emailExisting } = await supabase
        .from("usuarios")
        .select("id")
        .eq("email", email)
        .single();
      if (emailExisting)
        return res.status(400).json({ message: "El email ya está en uso" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // El nuevo usuario pertenece a la misma cuenta que quien lo crea.
    const cuentaId = await getCuentaId(req);

    const { data, error } = await supabase
      .from("usuarios")
      .insert([
        {
          username,
          password: hashedPassword,
          nombre: nombre || null,
          email: email || null,
          rol,
          activo: true,
          must_change_password: false,
          cuenta_id: cuentaId,
        },
      ])
      .select("id, username, nombre, email, rol, activo")
      .single();

    if (error) throw error;

    res
      .status(201)
      .json({ message: "Usuario creado exitosamente", user: data });
  } catch (error) {
    return respondError(res, error, "register");
  }
};

// ─── LOGIN ───────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("username", username)
      .eq("activo", true)
      .single();

    if (error || !user) {
      return res
        .status(401)
        .json({ message: "Credenciales inválidas o usuario inactivo" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res.status(401).json({ message: "Credenciales inválidas" });

    const { data: rolData } = await supabase
      .from("roles_permisos")
      .select("permisos")
      .eq("rol", user.rol)
      .single();

    const permisos = rolData?.permisos || [];

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        rol: user.rol,
        cuenta_id: user.cuenta_id,
        es_plataforma: user.es_plataforma === true,
        must_change_password: user.must_change_password,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        cuenta_id: user.cuenta_id,
        es_plataforma: user.es_plataforma === true,
        permisos,
        must_change_password: user.must_change_password,
      },
    });
  } catch (error) {
    return respondError(res, error, "login");
  }
};

// ─── VERIFY ──────────────────────────────────────────────────
const verifyToken = async (req, res) => {
  try {
    const { data: rolData } = await supabase
      .from("roles_permisos")
      .select("permisos")
      .eq("rol", req.user.rol)
      .single();

    const permisos = rolData?.permisos || [];

    const { data: user } = await supabase
      .from("usuarios")
      .select(
        "id, username, nombre, email, rol, activo, must_change_password, cuenta_id, es_plataforma",
      )
      .eq("id", req.user.id)
      .single();

    if (!user || !user.activo) {
      return res
        .status(401)
        .json({ message: "Usuario inactivo o no encontrado" });
    }

    res.json({ message: "Token válido", user: { ...user, permisos } });
  } catch (error) {
    return respondError(res, error, "verifyToken");
  }
};

// ─── FORGOT PASSWORD ─────────────────────────────────────────
// Genera un token de un solo uso y lo envía por email al PROPIO usuario.
// NO cambia la contraseña (evita bloqueo de cuenta por parte de terceros):
// la contraseña sólo se cambia cuando el usuario usa el link (resetPassword).
const RESPUESTA_GENERICA = {
  message:
    "Si el usuario existe y tiene un email asociado, recibirá instrucciones por email.",
};

const forgotPassword = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "El username es requerido" });
    }

    const { data: user } = await supabase
      .from("usuarios")
      .select("id, username, nombre, email")
      .eq("username", username)
      .eq("activo", true)
      .single();

    // Respuesta genérica SIEMPRE: no revela si el usuario existe ni si tiene
    // email (evita enumeración de usuarios).
    if (!user || !user.email) {
      return res.json(RESPUESTA_GENERICA);
    }

    // Token aleatorio de un solo uso (64 hex = cabe en VARCHAR(64)).
    const token = crypto.randomBytes(32).toString("hex");

    // Invalidar tokens previos sin usar de este usuario.
    await supabase
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("usuario_id", user.id)
      .eq("used", false);

    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert([
        {
          usuario_id: user.id,
          token,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          used: false,
        },
      ]);
    if (insertError) throw insertError;

    // Enviar el link SIEMPRE al email del propio usuario (nunca a un destino
    // fijo): así el reset no puede filtrar datos entre cuentas.
    await sendPasswordResetEmail({
      to: user.email,
      username: user.username,
      resetUrl: buildResetUrl(token),
    });

    return res.json(RESPUESTA_GENERICA);
  } catch (error) {
    return respondError(res, error, "forgotPassword");
  }
};

// ─── RESET PASSWORD ──────────────────────────────────────────
// Valida el token de un solo uso y recién ahí cambia la contraseña.
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token requerido" });
    }
    if (!newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 8 caracteres" });
    }

    // Buscar token válido: no usado y no expirado.
    const { data: tokenRow } = await supabase
      .from("password_reset_tokens")
      .select("id, usuario_id, expires_at, used")
      .eq("token", token)
      .eq("used", false)
      .maybeSingle();

    if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
      return res
        .status(400)
        .json({ message: "El enlace es inválido o expiró. Solicitá uno nuevo." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from("usuarios")
      .update({
        password: hashedPassword,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenRow.usuario_id);
    if (updateError) throw updateError;

    // Consumir el token (un solo uso).
    await supabase
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("id", tokenRow.id);

    return res.json({ message: "Contraseña actualizada. Ya podés iniciar sesión." });
  } catch (error) {
    return respondError(res, error, "resetPassword");
  }
};

// ─── CHANGE PASSWORD ─────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user.id;

    if (!newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 8 caracteres" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { error } = await supabase
      .from("usuarios")
      .update({
        password: hashedPassword,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) throw error;

    res.json({ message: "Contraseña actualizada exitosamente" });
  } catch (error) {
    return respondError(res, error, "changePassword");
  }
};

module.exports = {
  register,
  login,
  verifyToken,
  forgotPassword,
  resetPassword,
  changePassword,
};
