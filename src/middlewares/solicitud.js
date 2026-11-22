const { randomUUID } = require('node:crypto');

function identificarSolicitud(req, res, next) {
    req.idSolicitud = randomUUID();
    res.setHeader('X-Request-Id', req.idSolicitud);
    next();
}

module.exports = { identificarSolicitud };
