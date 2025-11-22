const express = require('express');
const router = express.Router();
const {
    getCategorias,
    getCategoriasActivas,
    getCategoriaById,
    createCategoria,
    updateCategoria,
    deleteCategoria
} = require('../controllers/categoriasController');

// Rutas públicas (para el cliente)
router.get('/activas', getCategoriasActivas);

// Rutas para el administrador
router.get('/', getCategorias);
router.get('/:id', getCategoriaById);
router.post('/', createCategoria);
router.put('/:id', updateCategoria);
router.delete('/:id', deleteCategoria);

module.exports = router;