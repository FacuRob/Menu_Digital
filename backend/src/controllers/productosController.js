const pool = require('../config/database');

// Obtener todos los productos
const getProductos = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, c.nombre as categoria_nombre 
       FROM productos p 
       LEFT JOIN categorias c ON p.categoria_id = c.id 
       ORDER BY p.orden ASC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener productos disponibles (para el menú del cliente)
const getProductosDisponibles = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, c.nombre as categoria_nombre 
       FROM productos p 
       LEFT JOIN categorias c ON p.categoria_id = c.id 
       WHERE p.disponible = true AND c.activo = true
       ORDER BY c.orden ASC, p.orden ASC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener productos por categoría
const getProductosByCategoria = async (req, res) => {
    try {
        const { categoriaId } = req.params;
        const result = await pool.query(
            `SELECT p.*, c.nombre as categoria_nombre 
       FROM productos p 
       LEFT JOIN categorias c ON p.categoria_id = c.id 
       WHERE p.categoria_id = $1 
       ORDER BY p.orden ASC`,
            [categoriaId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtener un producto por ID
const getProductoById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT p.*, c.nombre as categoria_nombre 
       FROM productos p 
       LEFT JOIN categorias c ON p.categoria_id = c.id 
       WHERE p.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear un nuevo producto
const createProducto = async (req, res) => {
    try {
        const { nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden } = req.body;

        const result = await pool.query(
            `INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [nombre, descripcion, precio, imagen_url, categoria_id, disponible !== undefined ? disponible : true, orden || 0]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Actualizar un producto
const updateProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden } = req.body;

        const result = await pool.query(
            `UPDATE productos 
       SET nombre = $1, descripcion = $2, precio = $3, imagen_url = $4, 
           categoria_id = $5, disponible = $6, orden = $7, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $8 RETURNING *`,
            [nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Eliminar un producto
const deleteProducto = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM productos WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto eliminado exitosamente' });
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
    deleteProducto
};