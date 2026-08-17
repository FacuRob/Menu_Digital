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
const { validate } = require('../middleware/validate');
const { productoSchema } = require('../schemas');

// Rutas públicas (para el cliente)
router.get('/disponibles', getProductosDisponibles);

// Rutas para el administrador
router.get('/', getProductos);
router.get('/stock-bajo', getStockBajo);
router.get('/categoria/:categoriaId', getProductosByCategoria);
router.get('/:id', getProductoById);
router.post('/', validate(productoSchema), checkLimiteProductos, createProducto);
router.put('/:id', validate(productoSchema), updateProducto);
router.delete('/:id', deleteProducto);

module.exports = router;