const ErrorApi = require('../errors/ErrorApi');
const { validarCambioClave, validarActualizacionUsuario } = require('../validators/usuarios');

function crearServicioUsuarios({ usuariosRepo, bcrypt }) {
    function obtenerPerfil(usuario) {
        return usuariosRepo.obtenerPorUsuario(usuario);
    }

    function cambiarClave(usuario, body) {
        const { errores, datos } = validarCambioClave(body);
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }

        const cuenta = usuariosRepo.obtenerClaveHash(usuario);
        if (!cuenta || !bcrypt.compareSync(datos.clave_actual, cuenta.clave_hash)) {
            throw new ErrorApi(403, 'No permitido', ['La clave actual no coincide']);
        }

        usuariosRepo.actualizarClave(usuario, bcrypt.hashSync(datos.nueva_clave, 12));
    }

    function listar() {
        return usuariosRepo.listar();
    }

    function actualizar(usuarioObjetivo, body) {
        const { errores, datos } = validarActualizacionUsuario(body);
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }

        const cuenta = usuariosRepo.obtenerPorUsuario(usuarioObjetivo);
        if (!cuenta) {
            throw new ErrorApi(404, 'Usuario no encontrado');
        }

        usuariosRepo.actualizarRolOEstado(cuenta.usuario, datos);
        return usuariosRepo.obtenerPorUsuario(cuenta.usuario);
    }

    return {
        obtenerPerfil,
        cambiarClave,
        listar,
        actualizar
    };
}

module.exports = { crearServicioUsuarios };
