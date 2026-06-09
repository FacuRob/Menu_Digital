const supabase = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Registrar un nuevo usuario
// Solo superadmin puede llamar a este endpoint (se protege en la ruta)
const register = async (req, res) => {
  try {
    const { username, password, nombre, rol = "editor" } = req.body;

    // Validar rol permitido
    const rolesValidos = ["superadmin", "editor", "visor"];
    if (!rolesValidos.includes(rol)) {
      return res
        .status(400)
        .json({
          message: "Rol inválido. Debe ser: superadmin, editor o visor",
        });
    }

    // Verificar si el usuario ya existe
    const { data: existing } = await supabase
      .from("usuarios")
      .select("id")
      .eq("username", username)
      .single();

    if (existing) {
      return res.status(400).json({ message: "El usuario ya existe" });
    }

    // Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear el usuario
    const { data, error } = await supabase
      .from("usuarios")
      .insert([
        {
          username,
          password: hashedPassword,
          nombre: nombre || null,
          rol,
          activo: true,
        },
      ])
      .select("id, username, nombre, rol, activo")
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Usuario creado exitosamente",
      user: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login — devuelve token + permisos del rol
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Buscar el usuario
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

    // Verificar la contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Obtener permisos del rol
    const { data: rolData } = await supabase
      .from("roles_permisos")
      .select("permisos, descripcion")
      .eq("rol", user.rol)
      .single();

    const permisos = rolData?.permisos || [];

    // Crear el token JWT (incluye rol en el payload)
    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol },
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
        rol: user.rol,
        permisos,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar token — también refresca los permisos
const verifyToken = async (req, res) => {
  try {
    const { data: rolData } = await supabase
      .from("roles_permisos")
      .select("permisos")
      .eq("rol", req.user.rol)
      .single();

    const permisos = rolData?.permisos || [];

    // Obtener datos actualizados del usuario
    const { data: user } = await supabase
      .from("usuarios")
      .select("id, username, nombre, rol, activo")
      .eq("id", req.user.id)
      .single();

    if (!user || !user.activo) {
      return res
        .status(401)
        .json({ message: "Usuario inactivo o no encontrado" });
    }

    res.json({
      message: "Token válido",
      user: { ...user, permisos },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login, verifyToken };
