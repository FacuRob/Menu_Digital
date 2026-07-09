const supabase = require("../config/database");
const { getNegocioId } = require("../utils/negocio");

// Obtener todas las categorías del negocio
const getCategorias = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("orden", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener categorías activas (para el menú del cliente)
const getCategoriasActivas = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener una categoría por ID
const getCategoriaById = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);

    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear una nueva categoría
const createCategoria = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { nombre, orden, activo } = req.body;

    const { data, error } = await supabase
      .from("categorias")
      .insert([
        {
          nombre,
          orden: orden || 0,
          activo: activo !== undefined ? activo : true,
          negocio_id: negocioId,
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

// Actualizar una categoría
const updateCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);
    const { nombre, orden, activo } = req.body;

    const { data, error } = await supabase
      .from("categorias")
      .update({
        nombre,
        orden,
        activo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar una categoría
const deleteCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);

    const { data, error } = await supabase
      .from("categorias")
      .delete()
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json({ message: "Categoría eliminada exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCategorias,
  getCategoriasActivas,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  deleteCategoria,
};
