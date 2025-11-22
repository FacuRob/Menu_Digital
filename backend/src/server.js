require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');

// Importar rutas
const categoriasRoutes = require('./routes/categorias');
const productosRoutes = require('./routes/productos');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ message: '🚀 API del Menú Digital funcionando' });
});

// Ruta para probar la conexión a la base de datos
app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            message: '✅ Conexión a la base de datos exitosa',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            message: '❌ Error al conectar a la base de datos',
            error: error.message
        });
    }
});

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas públicas para el menú del cliente
app.use('/api/categorias/activas', categoriasRoutes);
app.use('/api/productos/disponibles', productosRoutes);

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

// Rutas de administración de categorías
app.use('/api/categorias', authMiddleware, categoriasRoutes);

// Rutas de administración de productos
app.use('/api/productos', authMiddleware, productosRoutes);

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});