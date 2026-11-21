const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const carpetaDB = __dirname;
const rutaDB = path.join(carpetaDB, 'citas.db');

if (!fs.existsSync(carpetaDB)) {
    fs.mkdirSync(carpetaDB, { recursive: true });
}

const db = new DatabaseSync(rutaDB);

db.exec(`PRAGMA busy_timeout = 5000;`);
db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
    usuario TEXT PRIMARY KEY,
    clave_hash TEXT NOT NULL,
    rol TEXT NOT NULL
        CHECK (rol IN ('admin', 'usuario')),
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
    token_version INTEGER NOT NULL DEFAULT 0
    );`
);

function agregarColumnaSiFalta(tabla, columna, definicion) {
    const columnas = db.prepare(`PRAGMA table_info(${tabla});`).all();
    if (!columnas.some(columnaActual => columnaActual.name === columna)) {
        db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${definicion};`);
    }
}

// Compatibilidad con las bases creadas antes de los controles de sesión.
agregarColumnaSiFalta('usuarios', 'activo', 'activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))');
agregarColumnaSiFalta('usuarios', 'token_version', 'token_version INTEGER NOT NULL DEFAULT 0');

// Perfiles de dominio. Los identificadores se agregan sin borrar el formato
// histórico de citas; más abajo se enlazan los registros que ya existían.
db.exec(`
    CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT UNIQUE REFERENCES usuarios(usuario),
        nombre TEXT NOT NULL,
        telefono TEXT,
        correo TEXT UNIQUE,
        fecha_nacimiento TEXT,
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT UNIQUE REFERENCES usuarios(usuario),
        nombre TEXT NOT NULL,
        cedula_profesional TEXT NOT NULL UNIQUE,
        especialidad TEXT NOT NULL,
        datos_pendientes_validacion INTEGER NOT NULL DEFAULT 0 CHECK (datos_pendientes_validacion IN (0, 1)),
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS consultorios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        ubicacion TEXT,
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

agregarColumnaSiFalta(
    'medicos',
    'datos_pendientes_validacion',
    'datos_pendientes_validacion INTEGER NOT NULL DEFAULT 0 CHECK (datos_pendientes_validacion IN (0, 1))'
);

db.exec(`
    CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medico TEXT NOT NULL,
        paciente TEXT NOT NULL,
        horario_inicio DATETIME NOT NULL,
        horario_fin DATETIME NOT NULL,
        estado TEXT NOT NULL CHECK (estado IN ('Completado', 'Pendiente', 'Cancelado', 'Pospuesto')) NOT NULL,
        fecha_de_registro DATETIME NOT NULL
    );
`);

agregarColumnaSiFalta('citas', 'usuario_id', 'usuario_id TEXT REFERENCES usuarios(usuario)');
agregarColumnaSiFalta('citas', 'paciente_id', 'paciente_id INTEGER REFERENCES pacientes(id)');
agregarColumnaSiFalta('citas', 'medico_id', 'medico_id INTEGER REFERENCES medicos(id)');
agregarColumnaSiFalta('citas', 'consultorio_id', 'consultorio_id INTEGER REFERENCES consultorios(id)');

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_citas_usuario_id ON citas(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_citas_paciente_id ON citas(paciente_id);
    CREATE INDEX IF NOT EXISTS idx_citas_medico_intervalo ON citas(medico_id, horario_inicio, horario_fin);
    CREATE INDEX IF NOT EXISTS idx_citas_consultorio_intervalo ON citas(consultorio_id, horario_inicio, horario_fin);
`);

// Respaldo y normalización de estados heredados. Las versiones anteriores
// guardaron 1 como una cita activa; el API actual trabaja con el enum textual.
db.exec(`
    CREATE TABLE IF NOT EXISTS citas_estado_legacy (
        cita_id INTEGER PRIMARY KEY REFERENCES citas(id),
        estado_original TEXT NOT NULL,
        tipo_original TEXT NOT NULL,
        normalizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

function buscarOCrearPacienteLegacy(nombre) {
    const existente = db.prepare(`
        SELECT id FROM pacientes WHERE LOWER(nombre) = LOWER(?) LIMIT 1
    `).get(nombre);
    if (existente) return existente.id;

    return Number(db.prepare(`
        INSERT INTO pacientes (nombre) VALUES (?)
    `).run(nombre).lastInsertRowid);
}

function buscarOCrearMedicoLegacy(nombre, citaId) {
    const existente = db.prepare(`
        SELECT id FROM medicos WHERE LOWER(nombre) = LOWER(?) LIMIT 1
    `).get(nombre);
    if (existente) return existente.id;

    // Este identificador es deliberadamente visible como temporal: no es una
    // cédula profesional y obliga a completar el perfil antes de uso clínico.
    return Number(db.prepare(`
        INSERT INTO medicos (
            nombre, cedula_profesional, especialidad, datos_pendientes_validacion
        ) VALUES (?, ?, 'Por definir', 1)
    `).run(nombre, `MIGRACION-PENDIENTE-CITA-${citaId}`).lastInsertRowid);
}

function migrarCitasHeredadas() {
    const citasHeredadas = db.prepare(`
        SELECT id, medico, paciente FROM citas
        WHERE medico_id IS NULL OR paciente_id IS NULL
        ORDER BY id
    `).all();

    db.exec('BEGIN IMMEDIATE;');
    try {
        db.prepare(`
            INSERT OR IGNORE INTO citas_estado_legacy (cita_id, estado_original, tipo_original)
            SELECT id, CAST(estado AS TEXT), typeof(estado)
            FROM citas
            WHERE typeof(estado) = 'integer' AND estado = 1
        `).run();

        db.prepare(`
            UPDATE citas SET estado = 'Pendiente'
            WHERE typeof(estado) = 'integer' AND estado = 1
        `).run();

        const actualizar = db.prepare(`
            UPDATE citas
            SET paciente_id = COALESCE(paciente_id, ?),
                medico_id = COALESCE(medico_id, ?)
            WHERE id = ?
        `);

        for (const cita of citasHeredadas) {
            const pacienteId = buscarOCrearPacienteLegacy(cita.paciente);
            const medicoId = buscarOCrearMedicoLegacy(cita.medico, cita.id);
            actualizar.run(pacienteId, medicoId, cita.id);
        }

        db.exec('COMMIT;');
    } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
    }
}

migrarCitasHeredadas();

module.exports = db;
