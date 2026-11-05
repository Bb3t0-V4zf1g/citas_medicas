const express = require('express');
const app = express();

app.use(express.json());

// Simulación de base de datos en memoria
let citas = [
  {
    id: 1,
    medico: 'Dr. Carlos Mendoza',
    paciente: 'Juan Perez',
    horario_inicio: '2026-11-10T10:00:00Z',
    horario_fin: '2026-11-10T10:30:00Z',
    estado: true, // booleano: true = activa, false = inactiva/cancelada
    fecha_de_registro: '2026-11-04T08:00:00Z'
  }
];
let nextId = 2;

// Función para validar las reglas acumulando todos los detalles de error
function validarDatosCita(body, esPut = false) {
  const errores = [];
  const { medico, paciente, horario_inicio, horario_fin, estado, fecha_de_registro } = body;

  // 1. Validar medico[cite: 1]
  if (!medico || typeof medico !== 'string') {
    errores.push('El campo medico es obligatorio y debe ser texto');
  } else if (medico.trim().length < 4) {
    errores.push('El campo medico debe tener un nombre con un mínimo de 4 caracteres');
  }

  // 2. Validar paciente[cite: 1]
  if (!paciente || typeof paciente !== 'string') {
    errores.push('El campo paciente es obligatorio y debe ser texto');
  } else if (paciente.trim().length < 4 || paciente.includes('_')) {
    errores.push('El campo paciente debe ser un nombre válido (mínimo 4 caracteres y sin guiones bajos)');
  }

  // 3. Validar horario_inicio y horario_fin[cite: 1]
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

  if (dInicio && dFin && !isNaN(dInicio.getTime()) && !isNaN(dFin.getTime())) {
    if (dInicio >= dFin) {
      errores.push('horario_inicio debe ser antes de horario_fin');
    }
  }

  // 4. Validar estado[cite: 1]
  if (typeof estado !== 'boolean') {
    errores.push('El campo estado es obligatorio y debe ser un valor booleano (true para activa, false para inactiva)');
  }

  // 5. Validar fecha_de_registro (en caso de enviarse en PUT)[cite: 1]
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

// 1. LISTAR: GET /citas
app.get('/citas', (req, res) => {
  res.status(200).json(citas);
});

// 2. CONSULTAR: GET /citas/:id
app.get('/citas/:id', (req, res) => {
  const cita = citas.find(c => c.id == req.params.id);
  if (!cita) {
    return res.status(404).json({
      error: 'Cita no encontrada',
      detalles: [`No existe ninguna cita registrada con el ID ${req.params.id}`]
    });
  }

  res.status(200).json(cita);
});

// 3. CREAR: POST /citas
app.post('/citas', (req, res) => {
  const errores = validarDatosCita(req.body);
  if (errores.length > 0) {
    return res.status(422).json({
      error: 'Entidad no procesable',
      detalles: errores
    });
  }

  const { medico, paciente, horario_inicio, horario_fin, estado } = req.body;

  // Regla: No crear si ya existe otra cita con estado true (activa) para el mismo médico y horario_inicio
  if (estado === true) {
    const conflicto = citas.some(
      c => c.medico.toLowerCase() === medico.toLowerCase() &&
           c.horario_inicio === horario_inicio &&
           c.estado === true
    );

    if (conflicto) {
      return res.status(409).json({
        error: 'Conflicto de horario',
        detalles: [`El médico "${medico}" ya tiene una cita activa asignada para el horario_inicio "${horario_inicio}"`]
      });
    }
  }

  const nuevaCita = {
    id: nextId++, // El id lo genera automáticamente la API[cite: 1]
    medico,
    paciente,
    horario_inicio,
    horario_fin,
    estado,
    fecha_de_registro: new Date().toISOString() // La API guarda la fecha actual del registro[cite: 1]
  };

  citas.push(nuevaCita);
  res.status(201).json(nuevaCita);
});

// 4. REEMPLAZAR: PUT /citas/:id
app.put('/citas/:id', (req, res) => {
  const index = citas.findIndex(c => c.id == req.params.id);
  if (index === -1) {
    return res.status(404).json({
      error: 'Cita no encontrada',
      detalles: [`No se encontró la cita con ID ${req.params.id} para actualizar`]
    });
  }

  const errores = validarDatosCita(req.body, true);
  if (errores.length > 0) {
    return res.status(422).json({
      error: 'Entidad no procesable',
      detalles: errores
    });
  }

  const { medico, paciente, horario_inicio, horario_fin, estado, fecha_de_registro } = req.body;

  // Validación de conflicto de horario en citas activas excluyendo la cita actual
  if (estado === true) {
    const conflicto = citas.some(
      c => c.id != req.params.id &&
           c.medico.toLowerCase() === medico.toLowerCase() &&
           c.horario_inicio === horario_inicio &&
           c.estado === true
    );

    if (conflicto) {
      return res.status(409).json({
        error: 'Conflicto de horario',
        detalles: [`El médico "${medico}" ya tiene otra cita activa asignada para el horario_inicio "${horario_inicio}"`]
      });
    }
  }

  citas[index] = {
    id: Number(req.params.id),
    medico,
    paciente,
    horario_inicio,
    horario_fin,
    estado,
    fecha_de_registro: fecha_de_registro || citas[index].fecha_de_registro
  };

  res.status(200).json(citas[index]);
});

// 5. BORRAR: DELETE /citas/:id
app.delete('/citas/:id', (req, res) => {
  const index = citas.findIndex(c => c.id == req.params.id);
  if (index === -1) {
    return res.status(404).json({
      error: 'Cita no encontrada',
      detalles: [`No se puede eliminar la cita porque el ID ${req.params.id} no existe`]
    });
  }

  citas.splice(index, 1);
  res.status(204).send();
});

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