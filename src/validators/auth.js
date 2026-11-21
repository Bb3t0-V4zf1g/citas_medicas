const { esObjetoJson } = require('./comunes');

function validarLogin(body) {
    if (!esObjetoJson(body)) {
        return {
            errores: ['Se requiere un usuario y una clave'],
            datos: {}
        };
    }

    const { usuario, clave } = body;
    if (typeof usuario !== 'string' || typeof clave !== 'string' || !usuario.trim() || !clave) {
        return {
            errores: ['Se requiere un usuario y una clave'],
            datos: {}
        };
    }

    return {
        errores: [],
        datos: {
            usuario: usuario.trim(),
            clave
        }
    };
}

module.exports = { validarLogin };
