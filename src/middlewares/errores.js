const ErrorApi = require('../errors/ErrorApi');

function rutaNoEncontrada(req, res) {
    return res.status(404).json({
        error: 'Ruta no encontrada',
        codigo: 'NOT_FOUND',
        detalles: [],
        request_id: req.idSolicitud
    });
}

function manejarErrores(err, req, res, next) { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'JSON inválido', codigo: 'INVALID_JSON', detalles: ['El cuerpo de la solicitud debe ser JSON válido'], request_id: req.idSolicitud });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Solicitud demasiado grande', codigo: 'PAYLOAD_TOO_LARGE', detalles: ['El cuerpo no puede superar 100 KB'], request_id: req.idSolicitud });
    }
    if (err instanceof ErrorApi) {
        return res.status(err.estado).json({
            error: err.message,
            ...(err.codigo ? { codigo: err.codigo } : {}),
            detalles: err.detalles,
            request_id: req.idSolicitud
        });
    }
    if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
        return res.status(409).json({ error: 'Conflicto de datos', codigo: 'DATA_CONFLICT', detalles: [], request_id: req.idSolicitud });
    }
    console.error(`[${req.idSolicitud}]`, err);
    return res.status(500).json({ error: 'Error interno del servidor', codigo: 'INTERNAL_ERROR', detalles: [], request_id: req.idSolicitud });
}

module.exports = { rutaNoEncontrada, manejarErrores };
