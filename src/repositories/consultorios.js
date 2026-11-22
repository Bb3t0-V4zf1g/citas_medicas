const { actualizarTabla, insertarRegistro } = require('./comunes');

function crearRepositorioConsultorios({ db }) {
    function listar() {
        return db.prepare('SELECT * FROM consultorios ORDER BY nombre').all();
    }

    function obtenerPorId(id) {
        return db.prepare('SELECT * FROM consultorios WHERE id = ?').get(id);
    }

    function crear(datos) {
        const id = insertarRegistro(db, 'consultorios', datos);
        return obtenerPorId(id);
    }

    function actualizar(id, datos) {
        return actualizarTabla(db, 'consultorios', id, datos);
    }

    return {
        listar,
        obtenerPorId,
        crear,
        actualizar
    };
}

module.exports = { crearRepositorioConsultorios };
