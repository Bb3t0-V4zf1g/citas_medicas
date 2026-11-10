const express = require('express');
const db = require('./database/conexion');

const app = express();

const path = require('node:path');

// Servir el contrato OpenAPI
app.get('/openapi.yaml', (req, res) => {
    res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

// Servir la documentación Swagger UI
app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs.html'));
});

app.use(express.json());

// Función para validar los datos de una cita
function validarDatosCita(body, esPut = false) {
    const errores = [];
    const {
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado,
        fecha_de_registro
    } = body;

    if (!medico || typeof medico !== 'string') {
        errores.push('El campo medico es obligatorio y debe ser texto');
    } else if (medico.trim().length < 4) {
        errores.push('El campo medico debe tener un nombre con un mínimo de 4 caracteres');
    }

    if (!paciente || typeof paciente !== 'string') {
        errores.push('El campo paciente es obligatorio y debe ser texto');
    } else if (paciente.trim().length < 4 || paciente.includes('_')) {
        errores.push('El campo paciente debe ser un nombre válido (mínimo 4 caracteres y sin guiones bajos)');
    }

    let dInicio = null;
    let dFin = null;

    if (!horario_inicio) {
        errores.push('El campo horario_inicio es obligatorio');
    } else {
        dInicio = new Date(horario_inicio);
        if (isNaN(dInicio.getTime())) {
            errores.push('El campo horario_inicio debe ser una fecha válida (formato ISO)');
        }
    }

    if (!horario_fin) {
        errores.push('El campo horario_fin es obligatorio');
    } else {
        dFin = new Date(horario_fin);
        if (isNaN(dFin.getTime())) {
            errores.push('El campo horario_fin debe ser una fecha válida (formato ISO)');
        }
    }

    if (dInicio && dFin &&
        !isNaN(dInicio.getTime()) &&
        !isNaN(dFin.getTime())) {
        if (dInicio >= dFin) {
            errores.push('horario_inicio debe ser antes de horario_fin');
        }
    }

    if (!estado || !['Completado', 'Pendiente', 'Cancelado', 'Pospuesto'].includes(estado)) {
        errores.push('El campo estado es obligatorio y debe ser uno de los valores válidos: Completado, Pendiente, Cancelado, Pospuesto');
    }

    if (esPut && fecha_de_registro) {
        const dReg = new Date(fecha_de_registro);

        if (isNaN(dReg.getTime())) {
            errores.push('El campo fecha_de_registro debe ser una fecha válida');
        } else if (dReg > new Date()) {
            errores.push('El campo fecha_de_registro no puede ser una fecha futura');
        }
    }
    return errores;
}

// GET /citas
app.get('/citas', (req, res) => {
    const citas = db.prepare(
        'SELECT * FROM citas'
    ).all();

    res.status(200).json(citas);
});

// GET /citas/:id
app.get('/citas/:id',
  (req, res) => {
    const cita = db.prepare(
        'SELECT * FROM citas WHERE id = ?'
    ).get(req.params.id);

    if (!cita) {
        return res.status(404).json({
            error: 'Cita no encontrada',
            detalles: [`No existe ninguna cita registrada con el ID ${req.params.id}`]
        });
    }

    res.status(200).json(cita);
});

// POST /citas
app.post('/citas', (req, res) => {
    const errores = validarDatosCita(req.body);

    if (errores.length > 0) {
        return res.status(422).json({
            error: 'Entidad no procesable',
            detalles: errores
        });
    }

    const {
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado
    } = req.body;

    if (estado === 'Pendiente') {
        const conflicto = db.prepare(`
            SELECT id FROM citas
            WHERE LOWER(medico) = LOWER(?)
            AND datetime(horario_inicio) < datetime(?)
            AND datetime(horario_fin) > datetime(?)
            AND estado = ?
        `).get(medico, horario_fin, horario_inicio, 'Pendiente');

        if (conflicto) {
            return res.status(409).json({
                error: 'Conflicto de horario',
                detalles: [`El médico "${medico}" ya tiene una cita activa asignada para el horario_inicio "${horario_inicio}"`]
            });
        }
    }

    const fechaRegistro = new Date().toISOString();

    const resultado = db.prepare(`
        INSERT INTO citas (
            medico,
            paciente,
            horario_inicio,
            horario_fin,
            estado,
            fecha_de_registro
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado,
        fechaRegistro
    );

    const nuevaCita = db.prepare(
        'SELECT * FROM citas WHERE id = ?'
    ).get(Number(resultado.lastInsertRowid));

    res.status(201).json(nuevaCita);
});

// PUT /citas/:id
app.put('/citas/:id', (req, res) => {
    const id = req.params.id;

    const citaExistente = db.prepare(
        'SELECT * FROM citas WHERE id = ?'
    ).get(id);

    if (!citaExistente) {
        return res.status(404).json({
            error: 'Cita no encontrada',
            detalles: [`No se encontró la cita con ID ${id} para actualizar`]
        });
    }

    const errores = validarDatosCita(req.body, true);

    if (errores.length > 0) {
        return res.status(422).json({
            error: 'Entidad no procesable',
            detalles: errores
        });
    }

    const {
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado,
        fecha_de_registro
    } = req.body;

    if (estado === 'Pendiente') {
        const conflicto = db.prepare(`
            SELECT id FROM citas
            WHERE id <> ?
            AND LOWER(medico) = LOWER(?)
            AND datetime(horario_inicio) < datetime(?)
            AND datetime(horario_fin) > datetime(?)
            AND estado = 'Pendiente'
        `).get(id, medico, horario_fin, horario_inicio);

        if (conflicto) {
            return res.status(409).json({
                error: 'Conflicto de horario',
                detalles: [`El médico "${medico}" ya tiene otra cita activa asignada para el horario_inicio "${horario_inicio}"`]
            });
        }
    }

    db.prepare(`
        UPDATE citas
        SET medico = ?,
            paciente = ?,
            horario_inicio = ?,
            horario_fin = ?,
            estado = ?,
            fecha_de_registro = ?
        WHERE id = ?
    `).run(
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado,
        fecha_de_registro || citaExistente.fecha_de_registro,
        id
    );

    const citaActualizada = db.prepare(
        'SELECT * FROM citas WHERE id = ?'
    ).get(id);

    res.status(200).json(citaActualizada);
});

// DELETE /citas/:id
app.delete('/citas/:id', (req, res) => {
    const id = req.params.id;

    const cita = db.prepare(
        'SELECT id FROM citas WHERE id = ?'
    ).get(id);

    if (!cita) {
        return res.status(404).json({
            error: 'Cita no encontrada',
            detalles: [`No se puede eliminar la cita porque el ID ${id} no existe`]
        });
    }

    db.prepare(
        'DELETE FROM citas WHERE id = ?'
    ).run(id);

    res.status(204).send();
});

// Manejo de errores de JSON
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'JSON inválido',
            detalles: ['El cuerpo de la solicitud debe ser JSON válido']
        });
    }

    next(err);
});

app.listen(3000, () => {
    console.log('API de Citas corriendo en http://localhost:3000');
});
