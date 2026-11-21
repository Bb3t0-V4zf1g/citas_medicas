const { randomUUID } = require('node:crypto');
const ErrorApi = require('../errors/ErrorApi');
const { validarDatosCita, validarComentarioCita } = require('../validators/citas');
const { crearRepositorioCitas } = require('../repositories/citas');
const { crearRepositorioPacientes } = require('../repositories/pacientes');
const { crearRepositorioMedicos } = require('../repositories/medicos');

const INSTRUCCION_IA = `Clasifica el comentario de un paciente sobre el SERVICIO de la clínica (puntualidad, trato, instalaciones).
Responde SOLO un JSON con la forma:
{"sentimiento": "positivo" | "neutral" | "negativo", "resumen": "máximo 15 palabras en español"}.
No incluyas información que no esté en el comentario.
Comentario: `;

function crearServicioCitas({ citasRepo, pacientesRepo, medicosRepo, preguntarALaIA, db }) {
    const repoCitas = citasRepo ?? crearRepositorioCitas({ db });
    const repoPacientes = pacientesRepo ?? crearRepositorioPacientes({ db });
    const repoMedicos = medicosRepo ?? crearRepositorioMedicos({ db });

    function buscar(id, usuario) {
        if (usuario.rol === 'admin') {
            return repoCitas.buscarPorIdAdmin(id);
        }
        return repoCitas.buscarPorIdUsuario(id, usuario.usuario);
    }

    function hayConflicto({ idExcluido = null, medico, horarioInicio, horarioFin }) {
        return repoCitas.buscarConflicto({ idExcluido, medico, horarioInicio, horarioFin });
    }

    function buscarOCrearPaciente(nombre, usuarioId = null) {
        // Una cuenta común siempre agenda sobre su propio perfil. Esto evita que
        // el nombre enviado por un cliente apunte a un perfil de otro usuario.
        if (usuarioId) {
            const propioId = repoPacientes.buscarIdPorUsuario(usuarioId);
            if (propioId) return propioId;
            return repoPacientes.crearBasico({ usuario_id: usuarioId, nombre });
        }
        const existenteId = repoPacientes.buscarIdPorNombre(nombre);
        return existenteId || repoPacientes.crearBasico({ nombre });
    }

    function buscarOCrearMedico(nombre) {
        const existenteId = repoMedicos.buscarIdPorNombre(nombre);
        if (existenteId) return existenteId;
        return repoMedicos.crearProvisional(nombre, `MIGRACION-PENDIENTE-API-${randomUUID()}`);
    }

    function resolverReferencias(medico, paciente, usuarioPaciente = null) {
        return {
            medicoId: buscarOCrearMedico(medico.trim()),
            pacienteId: buscarOCrearPaciente(paciente.trim(), usuarioPaciente)
        };
    }

    function formatear(cita) {
        if (!cita) return null;
        const { usuario_id, paciente_usuario_id, medico_usuario_id, ...publica } = cita;
        return publica;
    }

    function listar(actor) {
        const citas = actor.rol === 'admin'
            ? repoCitas.listarTodas()
            : repoCitas.listarPorUsuario(actor.usuario);
        return citas.map(formatear);
    }

    function obtener(id, actor) {
        const cita = buscar(id, actor);
        if (!cita) {
            throw new ErrorApi(404, 'Cita no encontrada');
        }
        return formatear(cita);
    }

    function crear(body, actor) {
        const errores = validarDatosCita(body);
        if (errores.length > 0) {
            throw new ErrorApi(422, 'Entidad no procesable', errores);
        }

        const {
            medico,
            paciente,
            horario_inicio,
            horario_fin,
            estado
        } = body;

        if (estado === 'Pendiente') {
            const conflicto = hayConflicto({
                medico,
                horarioInicio: new Date(horario_inicio).toISOString(),
                horarioFin: new Date(horario_fin).toISOString()
            });

            if (conflicto) {
                throw new ErrorApi(
                    409,
                    'Conflicto de horario',
                    [`El médico "${medico}" ya tiene una cita activa asignada para el horario_inicio "${horario_inicio}"`]
                );
            }
        }

        const fechaRegistro = new Date().toISOString();
        const referencias = resolverReferencias(
            medico,
            paciente,
            actor.rol === 'admin' ? null : actor.usuario
        );

        const nuevaCita = repoCitas.crear({
            medico: medico.trim(),
            paciente: paciente.trim(),
            horario_inicio,
            horario_fin,
            estado,
            fecha_de_registro: fechaRegistro,
            usuario_id: actor.usuario,
            paciente_id: referencias.pacienteId,
            medico_id: referencias.medicoId
        });

        return formatear(nuevaCita);
    }

    function actualizar(id, body, actor) {
        const citaExistente = buscar(id, actor);
        if (!citaExistente) {
            throw new ErrorApi(
                404,
                'Cita no encontrada',
                [`No se encontró la cita con ID ${id} para actualizar`]
            );
        }

        const errores = validarDatosCita(body);
        if (errores.length > 0) {
            throw new ErrorApi(422, 'Entidad no procesable', errores);
        }

        const {
            medico,
            paciente,
            horario_inicio,
            horario_fin,
            estado
        } = body;

        if (estado === 'Pendiente') {
            const conflicto = hayConflicto({
                idExcluido: id,
                medico,
                horarioInicio: new Date(horario_inicio).toISOString(),
                horarioFin: new Date(horario_fin).toISOString()
            });

            if (conflicto) {
                throw new ErrorApi(
                    409,
                    'Conflicto de horario',
                    [`El médico "${medico}" ya tiene otra cita activa asignada para el horario_inicio "${horario_inicio}"`]
                );
            }
        }

        const esAdministrador = actor.rol === 'admin';
        const referencias = resolverReferencias(
            medico,
            paciente,
            esAdministrador ? null : actor.usuario
        );

        const citaActualizada = repoCitas.actualizar({
            id,
            medico: medico.trim(),
            paciente: paciente.trim(),
            paciente_id: referencias.pacienteId,
            medico_id: referencias.medicoId,
            horario_inicio,
            horario_fin,
            estado,
            fecha_de_registro: citaExistente.fecha_de_registro,
            usuario_id: actor.usuario,
            soloPropietario: !esAdministrador
        });

        return formatear(citaActualizada);
    }

    function eliminar(id, actor) {
        const cita = buscar(id, actor);
        if (!cita) {
            throw new ErrorApi(
                404,
                'Cita no encontrada',
                [`No se puede eliminar la cita porque el ID ${id} no existe o no te pertenece`]
            );
        }

        repoCitas.eliminar(id, {
            usuario_id: actor.usuario,
            soloPropietario: actor.rol !== 'admin'
        });
    }

    async function analizarComentario(body) {
        const { errores, comentario } = validarComentarioCita(body);
        if (errores.length > 0) {
            throw new ErrorApi(422, 'Los datos no son válidos', errores);
        }

        const ia = await preguntarALaIA(INSTRUCCION_IA + comentario);
        if (
            !ia ||
            typeof ia !== 'object' ||
            !['positivo', 'neutral', 'negativo'].includes(ia.sentimiento) ||
            typeof ia.resumen !== 'string' ||
            !ia.resumen.trim()
        ) {
            throw new ErrorApi(502, 'La IA respondió algo inesperado.');
        }

        return {
            sentimiento: ia.sentimiento,
            resumen: ia.resumen.trim().slice(0, 200)
        };
    }

    return {
        buscar,
        hayConflicto,
        resolverReferencias,
        formatear,
        listar,
        obtener,
        crear,
        actualizar,
        eliminar,
        analizarComentario
    };
}

module.exports = { crearServicioCitas };
