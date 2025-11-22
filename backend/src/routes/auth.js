const express = require('express');
const router = express.Router();
const { register, login, verifyToken } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas públicas
router.post('/register', register);
router.post('/login', login);

// Rutas protegidas
router.get('/verify', authMiddleware, verifyToken);

module.exports = router;