const supabase = require("../config/database");
const cloudinary = require("../config/cloudinary");

const extractPublicId = (url) => {
  try {
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
};

const getProductos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("productos")
      .select(`*, categorias ( nombre )`)
      .order("orden", { ascending: true });

    if (error) throw error;

    const result = data.map((p) => ({
      ...p,
      categoria_nombre: p.categorias?.nombre ?? null,
      categorias: undefined,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── FIX: usar RPC con SQL directo para filtrar correctamente ───────────────
const getProductosDisponibles = async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("get_productos_disponibles");

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProductosByCategoria = async (req, res) => {
  try {
    const { categoriaId } = req.params;

    const { data, error } = await supabase
      .from("productos")
      .select(`*, categorias ( nombre )`)
      .eq("categoria_id", categoriaId)
      .order("orden", { ascending: true });

    if (error) throw error;

    const result = data.map((p) => ({
      ...p,
      categoria_nombre: p.categorias?.nombre ?? null,
      categorias: undefined,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("productos")
      .select(`*, categorias ( nombre )`)
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json({
      ...data,
      categoria_nombre: data.categorias?.nombre ?? null,
      categorias: undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createProducto = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      precio,
      imagen_url,
      categoria_id,
      disponible,
      orden,
    } = req.body;

    const { data, error } = await supabase
      .from("productos")
      .insert([
        {
          nombre,
          descripcion,
          precio,
          imagen_url: imagen_url || null,
          categoria_id,
          disponible: disponible !== undefined ? disponible : true,
          orden: orden || 0,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      precio,
      imagen_url,
      categoria_id,
      disponible,
      orden,
    } = req.body;

    const { data: current } = await supabase
      .from("productos")
      .select("imagen_url")
      .eq("id", id)
      .single();

    if (!current) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const oldUrl = current.imagen_url;
    const newUrl = imagen_url || null;

    if (oldUrl && oldUrl !== newUrl && oldUrl.includes("cloudinary.com")) {
      const publicId = extractPublicId(oldUrl);
      if (publicId) {
        cloudinary.uploader
          .destroy(publicId)
          .catch((err) =>
            console.error(
              "No se pudo eliminar imagen anterior de Cloudinary:",
              err,
            ),
          );
      }
    }

    const { data, error } = await supabase
      .from("productos")
      .update({
        nombre,
        descripcion,
        precio,
        imagen_url: newUrl,
        categoria_id,
        disponible,
        orden,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("productos")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    if (data.imagen_url && data.imagen_url.includes("cloudinary.com")) {
      const publicId = extractPublicId(data.imagen_url);
      if (publicId) {
        cloudinary.uploader
          .destroy(publicId)
          .catch((err) =>
            console.error("No se pudo eliminar imagen de Cloudinary:", err),
          );
      }
    }

    res.json({ message: "Producto eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getProductos,
  getProductosDisponibles,
  getProductosByCategoria,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto,
};
