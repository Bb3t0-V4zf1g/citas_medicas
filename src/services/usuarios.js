const ErrorApi = require('../errors/ErrorApi');
const { validarCreacionUsuario, validarCambioClave, validarActualizacionUsuario } = require('../validators/usuarios');

function crearServicioUsuarios({ usuariosRepo, bcrypt }) {
    function crear(body) {
        const { errores, datos } = validarCreacionUsuario(body);
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }

        if (usuariosRepo.existe(datos.usuario)) {
            throw new ErrorApi(409, 'Conflicto de datos', ['Ese nombre de usuario ya existe'], 'DATA_CONFLICT');
        }

        const clave_hash = bcrypt.hashSync(datos.clave, 12);
        return usuariosRepo.crear({
            usuario: datos.usuario,
            clave_hash,
            rol: datos.rol
        });
    }

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
        crear,
        obtenerPerfil,
        cambiarClave,
        listar,
        actualizar
    };
}

module.exports = { crearServicioUsuarios };
