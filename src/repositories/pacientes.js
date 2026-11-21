const { actualizarTabla } = require('./comunes');

function crearRepositorioPacientes({ db }) {
    function obtenerPorUsuario(usuarioId) {
        return db.prepare('SELECT * FROM pacientes WHERE usuario_id = ?').get(usuarioId);
    }

    function buscarIdPorUsuario(usuarioId) {
        const propio = db.prepare('SELECT id FROM pacientes WHERE usuario_id = ? LIMIT 1').get(usuarioId);
        return propio ? propio.id : null;
    }

    function buscarIdPorNombre(nombre) {
        const existente = db.prepare('SELECT id FROM pacientes WHERE LOWER(nombre) = LOWER(?) LIMIT 1').get(nombre);
        return existente ? existente.id : null;
    }

    function listar() {
        return db.prepare('SELECT * FROM pacientes ORDER BY nombre').all();
    }

    function obtenerPorId(id) {
        return db.prepare('SELECT * FROM pacientes WHERE id = ?').get(id);
    }

    function existePorUsuario(usuarioId) {
        return Boolean(db.prepare('SELECT 1 FROM pacientes WHERE usuario_id = ?').get(usuarioId));
    }

    function crear({ usuario_id, nombre, telefono = null, correo = null, fecha_nacimiento = null }) {
        const resultado = db.prepare(
            'INSERT INTO pacientes (usuario_id, nombre, telefono, correo, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)'
        ).run(usuario_id, nombre, telefono ?? null, correo ?? null, fecha_nacimiento ?? null);
        return obtenerPorId(Number(resultado.lastInsertRowid));
    }

    function crearBasico({ usuario_id = null, nombre }) {
        if (usuario_id) {
            return Number(db.prepare('INSERT INTO pacientes (usuario_id, nombre) VALUES (?, ?)').run(usuario_id, nombre).lastInsertRowid);
        }
        return Number(db.prepare('INSERT INTO pacientes (nombre) VALUES (?)').run(nombre).lastInsertRowid);
    }

    function actualizar(id, datos) {
        return actualizarTabla(db, 'pacientes', id, datos);
    }

    return {
        obtenerPorUsuario,
        buscarIdPorUsuario,
        buscarIdPorNombre,
        listar,
        obtenerPorId,
        existePorUsuario,
        crear,
        crearBasico,
        actualizar
    };
}

module.exports = { crearRepositorioPacientes };
