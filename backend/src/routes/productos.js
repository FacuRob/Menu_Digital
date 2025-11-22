const express = require('express');
const router = express.Router();
const {
    getProductos,
    getProductosDisponibles,
    getProductosByCategoria,
    getProductoById,
    createProducto,
    updateProducto,
    deleteProducto
} = require('../controllers/productosController');

// Rutas públicas (para el cliente)
router.get('/disponibles', getProductosDisponibles);

// Rutas para el administrador
router.get('/', getProductos);
router.get('/categoria/:categoriaId', getProductosByCategoria);
router.get('/:id', getProductoById);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

module.exports = router;