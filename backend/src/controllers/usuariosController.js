const supabase = require("../config/database");
const bcrypt = require("bcryptjs");
const { getCuentaId, getAuthScope } = require("../utils/cuenta");
const { respondError } = require("../utils/respondError");

// Labels visibles → claves DB:
//   HiperAdmin = flag es_plataforma (nunca asignable vía API)
//   SuperAdmin = 'admin'   (dueño; se crea en el registro, no acá)
//   Admin      = 'manager' (segundo jefe; crea SOLO staff)
//   Staff      = 'staff'
const rolesValidos = ["admin", "manager", "staff"];

// Roles que cada nivel puede ASIGNAR/gestionar (crear, editar rol, borrar).
// El dueño (admin / plataforma) crea Admin y Staff; el Admin (manager) SOLO
// crea Staff. Nadie crea otro dueño vía API (el dueño nace en el registro).
const rolesAsignablesPor = (reqUser) => {
  if (reqUser.es_plataforma === true || reqUser.rol === "admin")
    return ["manager", "staff"];
  if (reqUser.rol === "manager") return ["staff"];
  return [];
};

// Trae rol + cuenta de un usuario destino (para validar jerarquía y aislamiento).
const getTargetUsuario = async (id) => {
  const { data } = await supabase
    .from("usuarios")
    .select("id, rol, cuenta_id")
    .eq("id", id)
    .single();
  return data || null;
};

const getUsuarios = async (req, res) => {
  try {
    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    let query = supabase
      .from("usuarios")
      .select("id, username, nombre, email, rol, activo, created_at");
    if (!esPlataforma) query = query.eq("cuenta_id", cuentaId);

    const { data, error } = await query.order("created_at", {
      ascending: true,
    });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    return respondError(res, error, "usuarios");
  }
};

const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    let q = supabase
      .from("usuarios")
      .select("id, username, nombre, email, rol, activo, created_at")
      .eq("id", id);
    if (!esPlataforma) q = q.eq("cuenta_id", cuentaId);
    const { data, error } = await q.single();
    if (error || !data)
      return res.status(404).json({ message: "Usuario no encontrado" });
    res.json(data);
  } catch (error) {
    return respondError(res, error, "usuarios");
  }
};

const createUsuario = async (req, res) => {
  try {
    const { username, password, nombre, email, rol = "staff" } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username y password son requeridos" });
    }
    // Jerarquía: sólo se puede crear un rol que el nivel del creador permita.
    const asignables = rolesAsignablesPor(req.user);
    if (!asignables.includes(rol)) {
      return res.status(403).json({
        message:
          "No podés crear usuarios con ese rol. Permitidos: " +
          (asignables.join(", ") || "ninguno"),
      });
    }

    const { data: existing } = await supabase
      .from("usuarios")
      .select("id")
      .eq("username", username)
      .single();
    if (existing)
      return res.status(400).json({ message: "El username ya está en uso" });

    if (email) {
      const { data: emailEx } = await supabase
        .from("usuarios")
        .select("id")
        .eq("email", email)
        .single();
      if (emailEx)
        return res.status(400).json({ message: "El email ya está en uso" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // El nuevo usuario pertenece a la cuenta de quien lo crea.
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
          cuenta_id: cuentaId,
        },
      ])
      .select("id, username, nombre, email, rol, activo, created_at")
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    return respondError(res, error, "usuarios");
  }
};

const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, activo } = req.body;

    // Nadie cambia su propio rol (evita auto-degradarse o auto-promoverse).
    if (req.user.id === parseInt(id) && rol && rol !== req.user.rol) {
      return res
        .status(400)
        .json({ message: "No podés cambiar tu propio rol" });
    }

    const asignables = rolesAsignablesPor(req.user);

    // Sólo se puede editar a usuarios que el nivel del editor gestiona.
    // (El dueño gestiona manager/staff; el manager sólo staff.) El editor
    // puede editarse a sí mismo. Nadie edita a un dueño (admin) ajeno.
    if (req.user.id !== parseInt(id)) {
      const target = await getTargetUsuario(id);
      if (!target)
        return res.status(404).json({ message: "Usuario no encontrado" });
      if (!asignables.includes(target.rol)) {
        return res
          .status(403)
          .json({ message: "No tenés permiso para editar a este usuario" });
      }
    }

    // Si se cambia el rol, el nuevo rol debe estar dentro de lo asignable.
    if (rol && !asignables.includes(rol)) {
      return res.status(403).json({
        message:
          "No podés asignar ese rol. Permitidos: " +
          (asignables.join(", ") || "ninguno"),
      });
    }

    if (email) {
      const { data: emailEx } = await supabase
        .from("usuarios")
        .select("id")
        .eq("email", email)
        .neq("id", id)
        .single();
      if (emailEx)
        return res
          .status(400)
          .json({ message: "El email ya está en uso por otro usuario" });
    }

    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    // Construir objeto de actualización sin TypeScript
    const updateData = { updated_at: new Date().toISOString() };
    if (nombre !== undefined) updateData.nombre = nombre;
    if (email !== undefined) updateData.email = email || null;
    if (rol !== undefined) updateData.rol = rol;
    if (activo !== undefined) updateData.activo = activo;

    let q = supabase.from("usuarios").update(updateData).eq("id", id);
    if (!esPlataforma) q = q.eq("cuenta_id", cuentaId);
    const { data, error } = await q
      .select("id, username, nombre, email, rol, activo, created_at")
      .single();

    if (error || !data)
      return res.status(404).json({ message: "Usuario no encontrado" });
    res.json(data);
  } catch (error) {
    return respondError(res, error, "usuarios");
  }
};

const cambiarPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    // Jerarquía: sólo se puede resetear la clave de usuarios que el nivel del
    // solicitante gestiona, o la propia.
    if (req.user.id !== parseInt(id)) {
      const target = await getTargetUsuario(id);
      if (!target)
        return res.status(404).json({ message: "Usuario no encontrado" });
      if (!rolesAsignablesPor(req.user).includes(target.rol)) {
        return res
          .status(403)
          .json({ message: "No tenés permiso para cambiar esta contraseña" });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let q = supabase
      .from("usuarios")
      .update({
        password: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (!esPlataforma) q = q.eq("cuenta_id", cuentaId);
    const { data, error } = await q.select("id, username").single();

    if (error || !data)
      return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ message: "Contraseña actualizada para " + data.username });
  } catch (error) {
    return respondError(res, error, "usuarios");
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) {
      return res
        .status(400)
        .json({ message: "No podés eliminar tu propio usuario" });
    }
    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }
    // Jerarquía: sólo se puede borrar a usuarios de un rol que el nivel del
    // solicitante gestiona (el manager no borra dueños ni otros manager).
    const target = await getTargetUsuario(id);
    if (!target)
      return res.status(404).json({ message: "Usuario no encontrado" });
    if (!rolesAsignablesPor(req.user).includes(target.rol)) {
      return res
        .status(403)
        .json({ message: "No tenés permiso para eliminar a este usuario" });
    }
    let q = supabase.from("usuarios").delete().eq("id", id);
    if (!esPlataforma) q = q.eq("cuenta_id", cuentaId);
    const { data, error } = await q.select("id, username").single();
    if (error || !data)
      return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ message: "Usuario " + data.username + " eliminado" });
  } catch (error) {
    return respondError(res, error, "usuarios");
  }
};

const getRoles = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("roles_permisos")
      .select("*")
      .order("rol");
    if (error) throw error;
    res.json(data);
  } catch (error) {
    return respondError(res, error, "usuarios");
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
