const jwt = require('jsonwebtoken');

function crearUsuarioActual({ db, usuariosRepo, jwtSecreto }) {
    return function usuarioActual(req, res, next) {
        const autorizacion = req.headers.authorization;

        if (!autorizacion || !autorizacion.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No autorizado',
                detalles: ['Se requiere un token Bearer']
            });
        }

        try {
            const datos = jwt.verify(autorizacion.substring(7), jwtSecreto, {
                algorithms: ['HS256'],
                issuer: 'citas-medicas-api',
                audience: 'citas-medicas-cliente'
            });
            const cuenta = usuariosRepo
                ? usuariosRepo.buscarParaAutenticacion(datos.sub)
                : db.prepare(`
                    SELECT usuario, rol, activo, token_version
                    FROM usuarios WHERE usuario = ?
                `).get(datos.sub);

            if (!cuenta || !cuenta.activo || datos.ver !== cuenta.token_version) {
                return res.status(401).json({
                    error: 'Token inválido',
                    codigo: 'TOKEN_REVOKED',
                    detalles: ['La sesión ya no está activa'],
                    request_id: req.idSolicitud
                });
            }

            req.yo = { usuario: cuenta.usuario, rol: cuenta.rol };
            return next();
        } catch {
            return res.status(401).json({
                error: 'Token inválido',
                detalles: ['El token es inválido o ha expirado']
            });
        }
    };
}

module.exports = { crearUsuarioActual };
