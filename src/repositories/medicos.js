const { actualizarTabla, insertarRegistro } = require('./comunes');

function crearRepositorioMedicos({ db }) {
    function listar() {
        return db.prepare('SELECT * FROM medicos ORDER BY nombre').all();
    }

    function obtenerPorId(id) {
        return db.prepare('SELECT * FROM medicos WHERE id = ?').get(id);
    }

    function buscarIdPorNombre(nombre) {
        const existente = db.prepare('SELECT id FROM medicos WHERE LOWER(nombre) = LOWER(?) LIMIT 1').get(nombre);
        return existente ? existente.id : null;
    }

    function crear(datos) {
        const id = insertarRegistro(db, 'medicos', datos);
        return obtenerPorId(id);
    }

    function crearProvisional(nombre, cedulaTemporal) {
        return Number(
            db.prepare(
                `INSERT INTO medicos (nombre, cedula_profesional, especialidad, datos_pendientes_validacion) VALUES (?, ?, 'Por definir', 1)`
            ).run(nombre, cedulaTemporal).lastInsertRowid
        );
    }

    function actualizar(id, datos) {
        return actualizarTabla(db, 'medicos', id, datos);
    }

    return {
        listar,
        obtenerPorId,
        buscarIdPorNombre,
        crear,
        crearProvisional,
        actualizar
    };
}

module.exports = { crearRepositorioMedicos };
