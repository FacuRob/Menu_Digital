const supabase = require("../config/database");
const bcrypt = require("bcryptjs");

const rolesValidos = ["superadmin", "editor", "visor"];

// Obtener todos los usuarios
const getUsuarios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, username, nombre, rol, activo, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener un usuario por ID
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("usuarios")
      .select("id, username, nombre, rol, activo, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear usuario (solo superadmin)
const createUsuario = async (req, res) => {
  try {
    const { username, password, nombre, rol = "editor" } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username y password son requeridos" });
    }

    if (!rolesValidos.includes(rol)) {
      return res
        .status(400)
        .json({
          message: `Rol inválido. Opciones: ${rolesValidos.join(", ")}`,
        });
    }

    // Verificar duplicado
    const { data: existing } = await supabase
      .from("usuarios")
      .select("id")
      .eq("username", username)
      .single();

    if (existing) {
      return res.status(400).json({ message: "El username ya está en uso" });
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
          rol,
          activo: true,
        },
      ])
      .select("id, username, nombre, rol, activo, created_at")
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar usuario (rol, nombre, activo — no password)
const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rol, activo } = req.body;

    // No permitir que el superadmin se quite su propio rol
    if (req.user.id === parseInt(id) && rol && rol !== "superadmin") {
      return res
        .status(400)
        .json({ message: "No podés cambiar tu propio rol de superadmin" });
    }

    if (rol && !rolesValidos.includes(rol)) {
      return res
        .status(400)
        .json({
          message: `Rol inválido. Opciones: ${rolesValidos.join(", ")}`,
        });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (nombre !== undefined) updateData.nombre = nombre;
    if (rol !== undefined) updateData.rol = rol;
    if (activo !== undefined) updateData.activo = activo;

    const { data, error } = await supabase
      .from("usuarios")
      .update(updateData)
      .eq("id", id)
      .select("id, username, nombre, rol, activo, created_at")
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cambiar contraseña de un usuario
const cambiarPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
      .from("usuarios")
      .update({
        password: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, username")
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ message: `Contraseña actualizada para ${data.username}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar usuario (no puede eliminarse a sí mismo)
const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === parseInt(id)) {
      return res
        .status(400)
        .json({ message: "No podés eliminar tu propio usuario" });
    }

    const { data, error } = await supabase
      .from("usuarios")
      .delete()
      .eq("id", id)
      .select("id, username")
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ message: `Usuario ${data.username} eliminado` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todos los roles disponibles con sus permisos
const getRoles = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("roles_permisos")
      .select("*")
      .order("rol", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  cambiarPassword,
  deleteUsuario,
  getRoles,
};
