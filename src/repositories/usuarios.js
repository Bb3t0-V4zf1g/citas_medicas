function crearRepositorioUsuarios({ db }) {
    function buscarParaLogin(usuario) {
        return db.prepare('SELECT usuario, clave_hash, rol, activo, token_version FROM usuarios WHERE usuario = ?').get(usuario);
    }

    function buscarParaAutenticacion(usuario) {
        return db.prepare('SELECT usuario, rol, activo, token_version FROM usuarios WHERE usuario = ?').get(usuario);
    }

    function obtenerPorUsuario(usuario) {
        return db.prepare('SELECT usuario, rol, activo FROM usuarios WHERE usuario = ?').get(usuario);
    }

    function existe(usuario) {
        if (typeof usuario !== 'string') return false;
        return Boolean(db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(usuario));
    }

    function obtenerClaveHash(usuario) {
        return db.prepare('SELECT clave_hash FROM usuarios WHERE usuario = ?').get(usuario);
    }

    function actualizarClave(usuario, claveHash) {
        db.prepare('UPDATE usuarios SET clave_hash = ?, token_version = token_version + 1 WHERE usuario = ?').run(claveHash, usuario);
    }

    function listar() {
        return db.prepare('SELECT usuario, rol, activo FROM usuarios ORDER BY usuario').all();
    }

    function crear({ usuario, clave_hash, rol }) {
        db.prepare('INSERT INTO usuarios (usuario, clave_hash, rol) VALUES (?, ?, ?)').run(usuario, clave_hash, rol);
        return obtenerPorUsuario(usuario);
    }

    function actualizarRolOEstado(usuario, { rol, activo }) {
        db.prepare(
            'UPDATE usuarios SET rol = COALESCE(?, rol), activo = COALESCE(?, activo), token_version = token_version + 1 WHERE usuario = ?'
        ).run(rol ?? null, activo ?? null, usuario);
    }

    return {
        buscarParaLogin,
        buscarParaAutenticacion,
        obtenerPorUsuario,
        existe,
        obtenerClaveHash,
        actualizarClave,
        listar,
        crear,
        actualizarRolOEstado
    };
}

module.exports = { crearRepositorioUsuarios };
