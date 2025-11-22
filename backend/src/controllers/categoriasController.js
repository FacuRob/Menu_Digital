const pool = require('../config/database');

// Obtener todas las categorías
const getCategorias = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM categorias ORDER BY orden ASC'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener categorías activas (para el menú del cliente)
const getCategoriasActivas = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM categorias WHERE activo = true ORDER BY orden ASC'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener una categoría por ID
const getCategoriaById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM categorias WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear una nueva categoría
const createCategoria = async (req, res) => {
    try {
        const { nombre, orden, activo } = req.body;

        const result = await pool.query(
            'INSERT INTO categorias (nombre, orden, activo) VALUES ($1, $2, $3) RETURNING *',
            [nombre, orden || 0, activo !== undefined ? activo : true]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Actualizar una categoría
const updateCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, orden, activo } = req.body;

        const result = await pool.query(
            'UPDATE categorias SET nombre = $1, orden = $2, activo = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [nombre, orden, activo, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Eliminar una categoría
const deleteCategoria = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM categorias WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }

        res.json({ message: 'Categoría eliminada exitosamente' });
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
    deleteCategoria
};