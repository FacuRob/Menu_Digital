const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Registrar un nuevo usuario (solo para crear el primer admin)
const register = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Verificar si el usuario ya existe
        const userExists = await pool.query(
            'SELECT * FROM usuarios WHERE username = $1',
            [username]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'El usuario ya existe' });
        }

        // Hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Crear el usuario
        const result = await pool.query(
            'INSERT INTO usuarios (username, password, rol) VALUES ($1, $2, $3) RETURNING id, username, rol',
            [username, hashedPassword, 'admin']
        );

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Login
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Buscar el usuario
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = result.rows[0];

        // Verificar la contraseña
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Crear el token JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                rol: user.rol
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Verificar token
const verifyToken = async (req, res) => {
    try {
        res.json({
            message: 'Token válido',
            user: req.user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    register,
    login,
    verifyToken
};