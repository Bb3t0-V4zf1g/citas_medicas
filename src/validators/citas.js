function esIntervaloDe30Minutos(fecha) {
    return fecha.getUTCMinutes() % 30 === 0
        && fecha.getUTCSeconds() === 0
        && fecha.getUTCMilliseconds() === 0;
}

function validarDatosCita(body) {
    const errores = [];
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return ['El cuerpo debe ser un objeto JSON'];
    }

    const { medico, paciente, horario_inicio, horario_fin, estado, fecha_de_registro } = body;
    if (!medico || typeof medico !== 'string') errores.push('El campo medico es obligatorio y debe ser texto');
    else if (medico.trim().length < 5) errores.push('medico: debe tener un nombre con un mínimo de 5 caracteres');
    if (!paciente || typeof paciente !== 'string') errores.push('El campo paciente es obligatorio y debe ser texto');
    else if (paciente.trim().length < 5 || paciente.includes('_')) errores.push('paciente: debe ser un nombre válido (mínimo 5 caracteres y sin guiones bajos)');

    const inicio = new Date(horario_inicio);
    const fin = new Date(horario_fin);
    if (!horario_inicio) errores.push('El campo horario_inicio es obligatorio');
    else if (Number.isNaN(inicio.getTime())) errores.push('horario_inicio: debe ser una fecha válida en formato ISO 8601');
    else if (!esIntervaloDe30Minutos(inicio)) errores.push('horario_inicio: solo se permiten horarios cada 30 minutos (ej. 09:00 o 09:30)');
    if (!horario_fin) errores.push('El campo horario_fin es obligatorio');
    else if (Number.isNaN(fin.getTime())) errores.push('horario_fin: debe ser una fecha válida en formato ISO 8601');
    else if (!esIntervaloDe30Minutos(fin)) errores.push('horario_fin: solo se permiten horarios cada 30 minutos (ej. 09:30 o 10:00)');
    if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fin.getTime()) && inicio >= fin) errores.push('horario_inicio: debe ser antes de horario_fin');
    if (!['Completado', 'Pendiente', 'Cancelado', 'Pospuesto'].includes(estado)) errores.push('estado: debe ser Completado, Pendiente, Cancelado o Pospuesto');
    if (fecha_de_registro !== undefined) errores.push('fecha_de_registro: es administrada por el servidor');
    return errores;
}

function validarComentarioCita(body) {
    const comentario = body?.comentario;
    if (
        typeof comentario !== 'string' ||
        comentario.trim().length < 2 ||
        comentario.length > 300
    ) {
        return {
            errores: ['comentario: de 2 a 300 caracteres'],
            comentario: ''
        };
    }

    return {
        errores: [],
        comentario
    };
}

module.exports = { validarDatosCita, validarComentarioCita };
