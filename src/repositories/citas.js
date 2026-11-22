function crearRepositorioCitas({ db }) {
    function listarTodas() {
        return db.prepare('SELECT c.* FROM citas c').all();
    }

    function listarPorUsuario(usuario) {
        return db.prepare(`
            SELECT c.*
            FROM citas c
            LEFT JOIN pacientes p ON p.id = c.paciente_id
            LEFT JOIN medicos m ON m.id = c.medico_id
            WHERE p.usuario_id = ?
               OR m.usuario_id = ?
               OR (p.usuario_id IS NULL AND m.usuario_id IS NULL AND c.usuario_id = ?)
        `).all(usuario, usuario, usuario);
    }

    function buscarPorIdAdmin(id) {
        return db.prepare(`
            SELECT c.*, p.usuario_id AS paciente_usuario_id, m.usuario_id AS medico_usuario_id
            FROM citas c
            LEFT JOIN pacientes p ON p.id = c.paciente_id
            LEFT JOIN medicos m ON m.id = c.medico_id
            WHERE c.id = ?
        `).get(id);
    }

    function buscarPorIdUsuario(id, usuario) {
        return db.prepare(`
            SELECT c.*, p.usuario_id AS paciente_usuario_id, m.usuario_id AS medico_usuario_id
            FROM citas c
            LEFT JOIN pacientes p ON p.id = c.paciente_id
            LEFT JOIN medicos m ON m.id = c.medico_id
            WHERE c.id = ?
              AND (
                  p.usuario_id = ?
                  OR m.usuario_id = ?
                  OR (p.usuario_id IS NULL AND m.usuario_id IS NULL AND c.usuario_id = ?)
              )
        `).get(id, usuario, usuario, usuario);
    }

    function obtenerPorId(id) {
        return db.prepare('SELECT * FROM citas WHERE id = ?').get(id);
    }

    function buscarConflicto({ idExcluido = null, medico, horarioInicio, horarioFin }) {
        return db.prepare(`
            SELECT id FROM citas
            WHERE (? IS NULL OR id <> ?)
              AND LOWER(medico) = LOWER(?)
              AND estado = 'Pendiente'
              AND datetime(horario_inicio) < datetime(?)
              AND datetime(horario_fin) > datetime(?)
            LIMIT 1
        `).get(idExcluido, idExcluido, medico, horarioFin, horarioInicio);
    }

    function crear({
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado,
        fecha_de_registro,
        usuario_id,
        paciente_id,
        medico_id
    }) {
        const resultado = db.prepare(`
            INSERT INTO citas (
                medico,
                paciente,
                horario_inicio,
                horario_fin,
                estado,
                fecha_de_registro,
                usuario_id,
                paciente_id,
                medico_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            medico,
            paciente,
            horario_inicio,
            horario_fin,
            estado,
            fecha_de_registro,
            usuario_id,
            paciente_id,
            medico_id
        );
        return obtenerPorId(Number(resultado.lastInsertRowid));
    }

    function actualizar({
        id,
        medico,
        paciente,
        paciente_id,
        medico_id,
        horario_inicio,
        horario_fin,
        estado,
        fecha_de_registro,
        usuario_id = null,
        soloPropietario = false
    }) {
        if (soloPropietario) {
            db.prepare(`
                UPDATE citas
                SET medico = ?,
                    paciente = ?,
                    paciente_id = ?,
                    medico_id = ?,
                    horario_inicio = ?,
                    horario_fin = ?,
                    estado = ?,
                    fecha_de_registro = ?
                WHERE id = ? AND usuario_id = ?
            `).run(
                medico,
                paciente,
                paciente_id,
                medico_id,
                horario_inicio,
                horario_fin,
                estado,
                fecha_de_registro,
                id,
                usuario_id
            );
        } else {
            db.prepare(`
                UPDATE citas
                SET medico = ?,
                    paciente = ?,
                    paciente_id = ?,
                    medico_id = ?,
                    horario_inicio = ?,
                    horario_fin = ?,
                    estado = ?,
                    fecha_de_registro = ?
                WHERE id = ?
            `).run(
                medico,
                paciente,
                paciente_id,
                medico_id,
                horario_inicio,
                horario_fin,
                estado,
                fecha_de_registro,
                id
            );
        }

        return obtenerPorId(id);
    }

    function eliminar(id, { usuario_id = null, soloPropietario = false } = {}) {
        if (soloPropietario) {
            return db.prepare('DELETE FROM citas WHERE id = ? AND usuario_id = ?').run(id, usuario_id);
        }
        return db.prepare('DELETE FROM citas WHERE id = ?').run(id);
    }

    return {
        listarTodas,
        listarPorUsuario,
        buscarPorIdAdmin,
        buscarPorIdUsuario,
        obtenerPorId,
        buscarConflicto,
        crear,
        actualizar,
        eliminar
    };
}

module.exports = { crearRepositorioCitas };
