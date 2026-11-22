function esAdmin(req) {
    return req.yo?.rol === 'admin';
}

function soloAdmin(req, res) {
    if (esAdmin(req)) return true;
    res.status(403).json({
        error: 'No permitido',
        codigo: 'FORBIDDEN',
        detalles: ['Esta operación requiere una cuenta administradora'],
        request_id: req.idSolicitud
    });
    return false;
}

module.exports = { esAdmin, soloAdmin };
