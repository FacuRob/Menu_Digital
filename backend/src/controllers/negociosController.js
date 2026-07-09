const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getCuentaId, getAuthScope } = require("../utils/cuenta");

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

// Listar negocios. Cuenta normal → sólo los suyos. Plataforma → todos.
const getNegocios = async (req, res) => {
  try {
    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    let query = supabase.from("negocios").select("*");
    if (!esPlataforma) query = query.eq("cuenta_id", cuentaId);

    const { data, error } = await query.order("id", { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    return respondError(res, error, "negocios");
  }
};

// Crear un negocio + su fila de configuración inicial.
const createNegocio = async (req, res) => {
  try {
    const { nombre, slug } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    const finalSlug = (slug && slugify(slug)) || slugify(nombre) || `negocio`;

    // El negocio se crea en la cuenta del usuario autenticado (no del body).
    const cuentaId = req.cuentaId || (await getCuentaId(req));
    if (!cuentaId) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    const { data: negocio, error } = await supabase
      .from("negocios")
      .insert([
        { nombre: nombre.trim(), slug: finalSlug, activo: true, cuenta_id: cuentaId },
      ])
      .select()
      .single();

    if (error) throw error;

    // Configuración inicial del negocio.
    await supabase
      .from("configuracion")
      .insert([{ negocio_id: negocio.id, nombre: nombre.trim(), retiro_activo: true }]);

    res.status(201).json(negocio);
  } catch (error) {
    return respondError(res, error, "negocios");
  }
};

// Actualizar un negocio.
const updateNegocio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, slug, activo } = req.body;

    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    const patch = { activo };
    if (nombre !== undefined) patch.nombre = nombre;
    if (slug !== undefined) patch.slug = slugify(slug);

    // El .eq("cuenta_id") impide editar negocios de otra cuenta (salvo plataforma).
    let q = supabase.from("negocios").update(patch).eq("id", id);
    if (!esPlataforma) q = q.eq("cuenta_id", cuentaId);
    const { data, error } = await q.select().single();

    if (error || !data) {
      return res.status(404).json({ message: "Negocio no encontrado" });
    }
    res.json(data);
  } catch (error) {
    return respondError(res, error, "negocios");
  }
};

// Eliminar un negocio (borra en cascada su menú, config y pedidos).
const deleteNegocio = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === "1") {
      return res
        .status(400)
        .json({ message: "No se puede eliminar el negocio principal" });
    }

    const { cuentaId, esPlataforma } = await getAuthScope(req);
    if (!cuentaId && !esPlataforma) {
      return res.status(403).json({ message: "Usuario sin cuenta asociada" });
    }

    // El .eq("cuenta_id") impide borrar negocios de otra cuenta (salvo plataforma).
    let q = supabase.from("negocios").delete().eq("id", id);
    if (!esPlataforma) q = q.eq("cuenta_id", cuentaId);
    const { data, error } = await q.select().single();

    if (error || !data) {
      return res.status(404).json({ message: "Negocio no encontrado" });
    }
    res.json({ message: "Negocio eliminado" });
  } catch (error) {
    return respondError(res, error, "negocios");
  }
};

module.exports = {
  getNegocios,
  createNegocio,
  updateNegocio,
  deleteNegocio,
};
