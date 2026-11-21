const ErrorApi = require('../errors/ErrorApi');
const { idValido } = require('../validators/comunes');
const { validarConsultorio } = require('../validators/consultorios');

function crearServicioConsultorios({ consultoriosRepo }) {
    function listar() {
        return consultoriosRepo.listar();
    }

    function obtenerPorId(id) {
        const fila = idValido(id) && consultoriosRepo.obtenerPorId(id);
        if (!fila) {
            throw new ErrorApi(404, 'Recurso no encontrado');
        }
        return fila;
    }

    function crear(body) {
        const { errores, datos } = validarConsultorio(body);
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }
        return consultoriosRepo.crear(datos);
    }

    function actualizar(id, body) {
        const fila = idValido(id) && consultoriosRepo.obtenerPorId(id);
        if (!fila) {
            throw new ErrorApi(404, 'Recurso no encontrado');
        }

        const { errores, datos } = validarConsultorio(body, true);
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }
        if (!consultoriosRepo.actualizar(fila.id, datos)) {
            throw new ErrorApi(422, 'Datos inválidos', ['Indique al menos un campo modificable']);
        }

        return consultoriosRepo.obtenerPorId(fila.id);
    }

    return {
        listar,
        obtenerPorId,
        crear,
        actualizar
    };
}

module.exports = { crearServicioConsultorios };
