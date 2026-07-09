const express = require('express');
const router = express.Router();
const {
    getProductos,
    getProductosDisponibles,
    getStockBajo,
    getProductosByCategoria,
    getProductoById,
    createProducto,
    updateProducto,
    deleteProducto
} = require('../controllers/productosController');
const checkLimiteProductos = require('../middleware/checkLimiteProductos');

// Rutas públicas (para el cliente)
router.get('/disponibles', getProductosDisponibles);

// Rutas para el administrador
router.get('/', getProductos);
router.get('/stock-bajo', getStockBajo);
router.get('/categoria/:categoriaId', getProductosByCategoria);
router.get('/:id', getProductoById);
router.post('/', checkLimiteProductos, createProducto);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

module.exports = router;