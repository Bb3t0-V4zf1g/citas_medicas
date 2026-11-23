const db = require('./conexion');
const bcrypt = require('bcryptjs');

//Usuarios de prueba
const usuariosIniciales = [
    { usuario: 'admin', clave: 'admin12345', rol: 'admin' },
    { usuario: 'ana', clave: 'ana12345', rol: 'usuario' },
    { usuario: 'juan', clave: 'juan12345', rol: 'usuario' }
];

// Insertar usuarios iniciales en la base de datos, si no existen

const insertar = db.prepare('INSERT INTO usuarios (usuario, clave_hash, rol) VALUES (?, ?, ?)');

const buscar = db.prepare('SELECT * FROM usuarios WHERE usuario = ?');

for(const cuenta of usuariosIniciales) {
    const existe = buscar.get(cuenta.usuario);

    if(!existe) {
        const hash = bcrypt.hashSync(cuenta.clave, 12);
        insertar.run(cuenta.usuario, hash, cuenta.rol);

        console.log(`Usuario ${cuenta.usuario} registrado.`);
    }
}

// Catálogo base para instalaciones nuevas (no sobrescribe datos existentes)
const medicosIniciales = [
    { nombre: 'Dr. Carlos Mendoza', cedula: 'CED-14510', especialidad: 'Medicina General', usuario_id: null },
    { nombre: 'Dra. Ana Torres', cedula: 'CED-01220', especialidad: 'Pediatría', usuario_id: 'ana' },
    { nombre: 'Dr. Pedro Lopez', cedula: 'CED-13150', especialidad: 'Cardiología', usuario_id: null },
    { nombre: 'Dra. Laura Gomez', cedula: 'CED-22010', especialidad: 'Dermatología', usuario_id: null }
];

const buscarMedico = db.prepare('SELECT id FROM medicos WHERE LOWER(nombre) = LOWER(?) OR cedula_profesional = ? LIMIT 1');
const insertarMedico = db.prepare(
    'INSERT INTO medicos (nombre, cedula_profesional, especialidad, usuario_id) VALUES (?, ?, ?, ?)'
);

for (const medico of medicosIniciales) {
    if (!buscarMedico.get(medico.nombre, medico.cedula)) {
        const usuarioVinculado = medico.usuario_id && !db.prepare('SELECT 1 FROM medicos WHERE usuario_id = ?').get(medico.usuario_id)
            ? medico.usuario_id
            : null;
        insertarMedico.run(medico.nombre, medico.cedula, medico.especialidad, usuarioVinculado);
    }
}

const pacientesIniciales = [
    { nombre: 'Juan Perez', usuario_id: 'juan' },
    { nombre: 'Maria Lopez', usuario_id: null },
    { nombre: 'Ximena Villa', usuario_id: null },
    { nombre: 'Pedro Ramirez', usuario_id: null }
];

const buscarPaciente = db.prepare('SELECT id FROM pacientes WHERE LOWER(nombre) = LOWER(?) LIMIT 1');
const insertarPaciente = db.prepare('INSERT INTO pacientes (nombre, usuario_id) VALUES (?, ?)');

for (const paciente of pacientesIniciales) {
    if (!buscarPaciente.get(paciente.nombre)) {
        const usuarioVinculado = paciente.usuario_id && !db.prepare('SELECT 1 FROM pacientes WHERE usuario_id = ?').get(paciente.usuario_id)
            ? paciente.usuario_id
            : null;
        insertarPaciente.run(paciente.nombre, usuarioVinculado);
    }
}

console.log('Inicialización de usuarios finalizada');