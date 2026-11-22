const { esObjetoJson } = require('./comunes');

function validarCambioClave(body) {
    if (!esObjetoJson(body)) {
        return {
            errores: ['clave_actual y nueva_clave (mínimo 8 caracteres) son obligatorias'],
            datos: {}
        };
    }

    const { clave_actual, nueva_clave } = body;
    if (typeof clave_actual !== 'string' || typeof nueva_clave !== 'string' || nueva_clave.length < 8) {
        return {
            errores: ['clave_actual y nueva_clave (mínimo 8 caracteres) son obligatorias'],
            datos: {}
        };
    }

    return {
        errores: [],
        datos: { clave_actual, nueva_clave }
    };
}

function validarActualizacionUsuario(body) {
    if (!esObjetoJson(body)) {
        return {
            errores: ['Indique rol o activo'],
            datos: {}
        };
    }

    const { rol, activo } = body;
    if (
        (rol !== undefined && !['admin', 'usuario'].includes(rol))
        || (activo !== undefined && ![true, false, 0, 1].includes(activo))
    ) {
        return {
            errores: ['rol debe ser admin o usuario; activo debe ser booleano'],
            datos: {}
        };
    }

    if (rol === undefined && activo === undefined) {
        return {
            errores: ['Indique rol o activo'],
            datos: {}
        };
    }

    return {
        errores: [],
        datos: {
            rol: rol ?? null,
            activo: activo === undefined ? null : Number(Boolean(activo))
        }
    };
}

module.exports = { validarCambioClave, validarActualizacionUsuario };
