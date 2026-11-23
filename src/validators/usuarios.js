const { esObjetoJson } = require('./comunes');

function validarCreacionUsuario(body) {
    if (!esObjetoJson(body)) {
        return {
            errores: ['El cuerpo debe ser un objeto JSON'],
            datos: {}
        };
    }

    const errores = [];
    const usuario = typeof body.usuario === 'string' ? body.usuario.trim() : '';
    const clave = typeof body.clave === 'string' ? body.clave : '';
    const rol = body.rol === undefined || body.rol === '' ? 'usuario' : body.rol;

    if (!usuario) {
        errores.push('usuario: es obligatorio');
    } else if (usuario.length < 3 || usuario.length > 40 || !/^[a-zA-Z0-9._-]+$/.test(usuario)) {
        errores.push('usuario: de 3 a 40 caracteres (solo letras, números, punto, guion o guion bajo)');
    }

    if (!clave || clave.length < 8 || clave.length > 128) {
        errores.push('clave: debe tener al menos 8 caracteres');
    }

    if (!['admin', 'usuario'].includes(rol)) {
        errores.push('rol: debe ser admin o usuario');
    }

    return {
        errores,
        datos: { usuario, clave, rol }
    };
}

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

module.exports = { validarCreacionUsuario, validarCambioClave, validarActualizacionUsuario };
