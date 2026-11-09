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

        // "Ver como el cliente" (Tech): sólo se puede mirar, nunca cambiar.
        // Los GET que igual cambian algo llevan además el middleware noSoloLectura.
        if (decoded.solo_lectura === true) {
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                return res.status(403).json({
                    error: 'SOLO_LECTURA',
                    message: 'Estás viendo esta cuenta en modo solo lectura: no se pueden hacer cambios.',
                });
            }
        }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido' });
    }
};

module.exports = authMiddleware;
