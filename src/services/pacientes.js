const ErrorApi = require('../errors/ErrorApi');
const { idValido } = require('../validators/comunes');
const { validarPaciente } = require('../validators/pacientes');

function crearServicioPacientes({ pacientesRepo, usuariosRepo }) {
    function obtenerMio(usuario) {
        const paciente = pacientesRepo.obtenerPorUsuario(usuario);
        if (!paciente) {
            throw new ErrorApi(404, 'Perfil de paciente no encontrado');
        }
        return paciente;
    }

    function listar(actor) {
        if (actor.rol === 'admin') {
            return pacientesRepo.listar();
        }
        const paciente = pacientesRepo.obtenerPorUsuario(actor.usuario);
        return paciente ? [paciente] : [];
    }

    function obtenerPorId(id, actor) {
        const paciente = idValido(id) && pacientesRepo.obtenerPorId(id);
        if (!paciente) {
            throw new ErrorApi(404, 'Paciente no encontrado');
        }
        if (actor.rol !== 'admin' && paciente.usuario_id !== actor.usuario) {
            throw new ErrorApi(403, 'No permitido', ['Esta operación requiere una cuenta administradora'], 'FORBIDDEN');
        }
        return paciente;
    }

    function crear(body, actor) {
        const { errores, datos } = validarPaciente(body);
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }

        const usuarioId = actor.rol === 'admin'
            ? (body.usuario_id ?? null)
            : actor.usuario;

        if (usuarioId !== null && !usuariosRepo.existe(usuarioId)) {
            throw new ErrorApi(422, 'Datos inválidos', ['usuario_id: el usuario indicado no existe']);
        }
        if (usuarioId && pacientesRepo.existePorUsuario(usuarioId)) {
            throw new ErrorApi(409, 'Conflicto de datos', ['usuario_id: ese usuario ya tiene perfil de paciente']);
        }

        return pacientesRepo.crear({
            usuario_id: usuarioId,
            nombre: datos.nombre,
            telefono: datos.telefono,
            correo: datos.correo,
            fecha_nacimiento: datos.fecha_nacimiento
        });
    }

    function actualizar(id, body, actor) {
        if (!idValido(id)) {
            throw new ErrorApi(404, 'Paciente no encontrado');
        }
        const paciente = pacientesRepo.obtenerPorId(id);
        if (!paciente) {
            throw new ErrorApi(404, 'Paciente no encontrado');
        }
        if (actor.rol !== 'admin' && paciente.usuario_id !== actor.usuario) {
            throw new ErrorApi(403, 'No permitido', ['Esta operación requiere una cuenta administradora'], 'FORBIDDEN');
        }

        const { errores, datos } = validarPaciente(body, true);
        if (actor.rol === 'admin' && body.usuario_id !== undefined) {
            if (body.usuario_id !== null && !usuariosRepo.existe(body.usuario_id)) {
                errores.push('usuario_id: el usuario indicado no existe');
            } else {
                const existenteId = body.usuario_id ? pacientesRepo.buscarIdPorUsuario(body.usuario_id) : null;
                if (existenteId && existenteId !== paciente.id) {
                    throw new ErrorApi(409, 'Conflicto de datos', ['usuario_id: ese usuario ya tiene perfil de paciente']);
                }
                datos.usuario_id = body.usuario_id;
            }
        }
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }
        if (!pacientesRepo.actualizar(paciente.id, datos)) {
            throw new ErrorApi(422, 'Datos inválidos', ['Indique al menos un campo modificable']);
        }

        return pacientesRepo.obtenerPorId(paciente.id);
    }

    return {
        obtenerMio,
        listar,
        obtenerPorId,
        crear,
        actualizar
    };
}

module.exports = { crearServicioPacientes };
