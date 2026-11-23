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

    function obtenerMedicoPropio(actor) {
        if (actor.rol === 'admin') return null;
        return repoMedicos.obtenerPorUsuario(actor.usuario) ?? null;
    }

    function hayConflicto({ idExcluido = null, medico, horarioInicio, horarioFin }) {
        return repoCitas.buscarConflicto({ idExcluido, medico, horarioInicio, horarioFin });
    }

    function resolverReferenciasExistentes(medico, paciente) {
        const errores = [];
        const medicoRegistro = repoMedicos.buscarPorNombre(medico.trim());
        const pacienteRegistro = repoPacientes.buscarPorNombre(paciente.trim());

        if (!medicoRegistro) {
            errores.push('medico: debes elegir un médico existente');
        }
        if (!pacienteRegistro) {
            errores.push('paciente: debes elegir un paciente existente');
        }
        if (errores.length > 0) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }

        return { medicoRegistro, pacienteRegistro };
    }

    function formatear(cita) {
        if (!cita) return null;
        const { usuario_id, paciente_usuario_id, medico_usuario_id, ...publica } = cita;
        return publica;
    }

    function opciones(actor) {
        if (actor.rol === 'admin') {
            return {
                tipo_actor: 'admin',
                puede_crear: true,
                puede_editar: true,
                puede_eliminar: true,
                medico_propio: null,
                paciente_propio: null,
                medicos: repoMedicos.listar().map(m => ({
                    id: m.id,
                    nombre: m.nombre,
                    especialidad: m.especialidad
                })),
                pacientes: repoPacientes.listar().map(p => ({
                    id: p.id,
                    nombre: p.nombre
                }))
            };
        }

        const medicoPropio = obtenerMedicoPropio(actor);
        if (medicoPropio) {
            return {
                tipo_actor: 'medico',
                puede_crear: true,
                puede_editar: true,
                puede_eliminar: false,
                medico_propio: {
                    id: medicoPropio.id,
                    nombre: medicoPropio.nombre,
                    especialidad: medicoPropio.especialidad
                },
                paciente_propio: null,
                medicos: [{
                    id: medicoPropio.id,
                    nombre: medicoPropio.nombre,
                    especialidad: medicoPropio.especialidad
                }],
                pacientes: repoPacientes.listar().map(p => ({
                    id: p.id,
                    nombre: p.nombre
                }))
            };
        }

        const pacientePropio = repoPacientes.obtenerPorUsuario(actor.usuario) ?? null;
        return {
            tipo_actor: 'paciente',
            puede_crear: false,
            puede_editar: false,
            puede_eliminar: false,
            medico_propio: null,
            paciente_propio: pacientePropio ? { id: pacientePropio.id, nombre: pacientePropio.nombre } : null,
            medicos: [],
            pacientes: []
        };
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
        const esAdministrador = actor.rol === 'admin';
        const medicoPropio = obtenerMedicoPropio(actor);

        if (!esAdministrador && !medicoPropio) {
            throw new ErrorApi(
                403,
                'No permitido',
                ['Los pacientes solo pueden consultar sus citas'],
                'FORBIDDEN'
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

        const { medicoRegistro, pacienteRegistro } = resolverReferenciasExistentes(medico, paciente);

        if (medicoPropio && medicoRegistro.id !== medicoPropio.id) {
            throw new ErrorApi(
                403,
                'No permitido',
                ['Un médico solo puede agendar citas para sí mismo'],
                'FORBIDDEN'
            );
        }

        if (estado === 'Pendiente') {
            const conflicto = hayConflicto({
                medico: medicoRegistro.nombre,
                horarioInicio: new Date(horario_inicio).toISOString(),
                horarioFin: new Date(horario_fin).toISOString()
            });

            if (conflicto) {
                throw new ErrorApi(
                    409,
                    'Conflicto de horario',
                    [`El médico "${medicoRegistro.nombre}" ya tiene una cita activa asignada para el horario_inicio "${horario_inicio}"`]
                );
            }
        }

        const fechaRegistro = new Date().toISOString();

        const nuevaCita = repoCitas.crear({
            medico: medicoRegistro.nombre,
            paciente: pacienteRegistro.nombre,
            horario_inicio,
            horario_fin,
            estado,
            fecha_de_registro: fechaRegistro,
            usuario_id: actor.usuario,
            paciente_id: pacienteRegistro.id,
            medico_id: medicoRegistro.id
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

        const esAdministrador = actor.rol === 'admin';
        const medicoPropio = obtenerMedicoPropio(actor);
        const esMedicoDeLaCita = Boolean(medicoPropio && citaExistente.medico_id === medicoPropio.id);

        if (!esAdministrador && !esMedicoDeLaCita) {
            throw new ErrorApi(
                403,
                'No permitido',
                ['Solo un administrador o el médico asignado puede modificar esta cita'],
                'FORBIDDEN'
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

        const { medicoRegistro, pacienteRegistro } = resolverReferenciasExistentes(medico, paciente);

        if (medicoPropio && medicoRegistro.id !== medicoPropio.id) {
            throw new ErrorApi(
                403,
                'No permitido',
                ['Un médico solo puede asignar citas a sí mismo'],
                'FORBIDDEN'
            );
        }

        if (estado === 'Pendiente') {
            const conflicto = hayConflicto({
                idExcluido: id,
                medico: medicoRegistro.nombre,
                horarioInicio: new Date(horario_inicio).toISOString(),
                horarioFin: new Date(horario_fin).toISOString()
            });

            if (conflicto) {
                throw new ErrorApi(
                    409,
                    'Conflicto de horario',
                    [`El médico "${medicoRegistro.nombre}" ya tiene otra cita activa asignada para el horario_inicio "${horario_inicio}"`]
                );
            }
        }

        const citaActualizada = repoCitas.actualizar({
            id,
            medico: medicoRegistro.nombre,
            paciente: pacienteRegistro.nombre,
            paciente_id: pacienteRegistro.id,
            medico_id: medicoRegistro.id,
            horario_inicio,
            horario_fin,
            estado,
            fecha_de_registro: citaExistente.fecha_de_registro,
            usuario_id: actor.usuario,
            soloPropietario: false
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

        if (actor.rol !== 'admin' && cita.usuario_id !== actor.usuario) {
            throw new ErrorApi(
                403,
                'No permitido',
                ['Solo un administrador o quien registró la cita puede eliminarla'],
                'FORBIDDEN'
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
        formatear,
        opciones,
        listar,
        obtener,
        crear,
        actualizar,
        eliminar,
        analizarComentario
    };
}

module.exports = { crearServicioCitas };
