const supabase = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../services/emailService");

const rolesValidos = ["superadmin", "editor", "visor"];

const generarPasswordTemporal = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 8; i++)
    pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
};

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
        },
      ])
      .select("id, username, nombre, email, rol, activo")
      .single();

    if (error) throw error;

    res
      .status(201)
      .json({ message: "Usuario creado exitosamente", user: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
        permisos,
        must_change_password: user.must_change_password,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── VERIFY ──────────────────────────────────────────────────
const verifyToken = async (req, res) => {
  try {
    console.log("verify - user from token:", req.user);

    const { data: rolData, error: rolError } = await supabase
      .from("roles_permisos")
      .select("permisos")
      .eq("rol", req.user.rol)
      .single();

    console.log("rolData:", rolData, "rolError:", rolError); // AGREGAR

    const permisos = rolData?.permisos || [];

    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("id, username, nombre, email, rol, activo, must_change_password")
      .eq("id", req.user.id)
      .single();

    console.log("user:", user, "userError:", userError); // AGREGAR

    if (!user || !user.activo) {
      return res
        .status(401)
        .json({ message: "Usuario inactivo o no encontrado" });
    }

    res.json({ message: "Token válido", user: { ...user, permisos } });
  } catch (error) {
    console.error("verify error:", error); // AGREGAR
    res.status(500).json({ error: error.message });
  }
};

// ─── FORGOT PASSWORD ─────────────────────────────────────────
// Busca por username, usa el email del propio usuario si tiene,
// si no tiene email configurado, lo manda al EMAIL_USER (admin del sistema)
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

    // Respuesta genérica para no revelar si el usuario existe
    if (!user) {
      return res.json({
        message: "Si el usuario existe, recibirá instrucciones por email.",
      });
    }

    // Determinar destino del email
    const emailDestino = "roblesfacundo7@gmail.com";

    if (!emailDestino) {
      return res.status(400).json({
        message:
          "Este usuario no tiene email configurado. Contactá al administrador del sistema.",
      });
    }

    // Generar contraseña temporal
    const tempPassword = generarPasswordTemporal();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // Actualizar contraseña y marcar must_change_password
    const { error: updateError } = await supabase
      .from("usuarios")
      .update({
        password: hashedPassword,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // Registrar en tabla de tokens (para auditoría)
    const token = crypto.randomBytes(32).toString("hex");
    await supabase.from("password_reset_tokens").insert([
      {
        usuario_id: user.id,
        token,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used: true,
      },
    ]);

    // Enviar email
    await sendPasswordResetEmail({
      to: emailDestino,
      username: user.username,
      tempPassword,
    });

    const msg = user.email
      ? "Se envió la contraseña temporal a tu email."
      : "Este usuario no tiene email propio. La contraseña temporal fue enviada al administrador del sistema.";

    res.json({ message: msg });
  } catch (error) {
    console.error("Error en forgotPassword:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
};

// ─── CHANGE PASSWORD ─────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user.id;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 6 caracteres" });
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
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  register,
  login,
  verifyToken,
  forgotPassword,
  changePassword,
};
