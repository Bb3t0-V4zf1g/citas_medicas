const { actualizarTabla, insertarRegistro } = require('./comunes');

function crearRepositorioMedicos({ db }) {
    function listar() {
        return db.prepare('SELECT * FROM medicos ORDER BY nombre').all();
    }

    function obtenerPorId(id) {
        return db.prepare('SELECT * FROM medicos WHERE id = ?').get(id);
    }

    function buscarPorNombre(nombre) {
        return db.prepare('SELECT * FROM medicos WHERE LOWER(nombre) = LOWER(?) LIMIT 1').get(nombre);
    }

    function buscarIdPorNombre(nombre) {
        const existente = buscarPorNombre(nombre);
        return existente ? existente.id : null;
    }

    function obtenerPorUsuario(usuarioId) {
        return db.prepare('SELECT * FROM medicos WHERE usuario_id = ? LIMIT 1').get(usuarioId);
    }

    function buscarIdPorUsuario(usuarioId) {
        const propio = obtenerPorUsuario(usuarioId);
        return propio ? propio.id : null;
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
        buscarPorNombre,
        buscarIdPorNombre,
        obtenerPorUsuario,
        buscarIdPorUsuario,
        crear,
        crearProvisional,
        actualizar
    };
}

module.exports = { crearRepositorioMedicos };
