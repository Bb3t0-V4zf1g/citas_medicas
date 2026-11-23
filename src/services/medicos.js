const ErrorApi = require('../errors/ErrorApi');
const { idValido, esObjetoJson } = require('../validators/comunes');
const { validarMedico } = require('../validators/medicos');

function crearServicioMedicos({ medicosRepo, usuariosRepo }) {
    function asignarUsuarioSiAplica(body, datos, errores) {
        if (esObjetoJson(body) && body.usuario_id !== undefined) {
            if (body.usuario_id !== null && !usuariosRepo.existe(body.usuario_id)) {
                errores.push('usuario_id no existe');
            } else {
                datos.usuario_id = body.usuario_id;
            }
        }
    }

    function listar() {
        return medicosRepo.listar();
    }

    function obtenerPorId(id) {
        const fila = idValido(id) && medicosRepo.obtenerPorId(id);
        if (!fila) {
            throw new ErrorApi(404, 'Recurso no encontrado');
        }
        return fila;
    }

    function crear(body) {
        const { errores, datos } = validarMedico(body);
        if (datos) {
            asignarUsuarioSiAplica(body, datos, errores);
        }
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }
        return medicosRepo.crear(datos);
    }

    function actualizar(id, body) {
        const fila = idValido(id) && medicosRepo.obtenerPorId(id);
        if (!fila) {
            throw new ErrorApi(404, 'Recurso no encontrado');
        }

        const { errores, datos } = validarMedico(body, true);
        if (datos) {
            asignarUsuarioSiAplica(body, datos, errores);
        }
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }

        const cedulaFinal = datos.cedula_profesional ?? fila.cedula_profesional;
        const especialidadFinal = datos.especialidad ?? fila.especialidad;
        if (
            fila.datos_pendientes_validacion === 1
            && cedulaFinal
            && !cedulaFinal.startsWith('MIGRACION-PENDIENTE-')
            && especialidadFinal
            && especialidadFinal.trim().toLowerCase() !== 'por definir'
        ) {
            datos.datos_pendientes_validacion = 0;
        }

        if (!medicosRepo.actualizar(fila.id, datos)) {
            throw new ErrorApi(422, 'Datos inválidos', ['Indique al menos un campo modificable']);
        }

        return medicosRepo.obtenerPorId(fila.id);
    }

    return {
        listar,
        obtenerPorId,
        crear,
        actualizar
    };
}

module.exports = { crearServicioMedicos };
