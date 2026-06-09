const supabase = require("../config/database");
const cloudinary = require("../config/cloudinary");

// Extrae el public_id de una URL de Cloudinary
const extractPublicId = (url) => {
  try {
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
};

// Obtener todos los productos (con nombre de categoría)
const getProductos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("productos")
      .select(
        `
                *,
                categorias ( nombre )
            `,
      )
      .order("orden", { ascending: true });

    if (error) throw error;

    // Aplanar categoria_nombre para mantener compatibilidad con el frontend
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

// Obtener productos disponibles (para el menú del cliente)
const getProductosDisponibles = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("productos")
      .select(
        `
                *,
                categorias!inner ( nombre, orden, activo )
            `,
      )
      .eq("disponible", true)
      .eq("categorias.activo", true)
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

// Obtener productos por categoría
const getProductosByCategoria = async (req, res) => {
  try {
    const { categoriaId } = req.params;

    const { data, error } = await supabase
      .from("productos")
      .select(
        `
                *,
                categorias ( nombre )
            `,
      )
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

// Obtener un producto por ID
const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("productos")
      .select(
        `
                *,
                categorias ( nombre )
            `,
      )
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

// Crear un nuevo producto
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

// Actualizar un producto
// Si la imagen cambió y la anterior era de Cloudinary, elimina la vieja
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

    // Obtener imagen actual para borrarla de Cloudinary si cambió
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

    // Si la imagen cambió y la anterior era de Cloudinary, la eliminamos
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

// Eliminar un producto y su imagen de Cloudinary si tiene
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

    // Eliminar imagen de Cloudinary si existe
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
