const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // Obtener el token del header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'No hay token, acceso denegado' });
        }

        // Verificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido' });
    }
};

module.exports = authMiddleware;