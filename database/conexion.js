const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const carpetaDB = __dirname;
const rutaDB = path.join(carpetaDB, 'citas.db');

if (!fs.existsSync(carpetaDB)) {
    fs.mkdirSync(carpetaDB, { recursive: true });
}

const db = new DatabaseSync(rutaDB);

db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
    usuarioq TEXT PRIMARY KEY,
    clave_hash TEXT NOT NULL,
    rol TEXT NOT NULL
        CHECK (rol IN ('admin', 'usuario'))
    );`
);

db.exec(`
    CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medico TEXT NOT NULL,
        paciente TEXT NOT NULL,
        horario_inicio TEXT NOT NULL,
        horario_fin TEXT NOT NULL,
        estado INTEGER NOT NULL,
        fecha_de_registro TEXT NOT NULL
    );
`);

const columnas = db.prepare(`PRAGMA table_info(citas);`).all();

const tieneUsuarioId = columnas.some(columna => columna.name === 'usuario_id');

if (!tieneUsuarioId) {
    db.exec(`
        ALTER TABLE citas
        ADD COLUMN usuario_id TEXT,
        REFERENCES usuarios(usuario);
    `);
}

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_citas_usuario_id ON citas(usuario_id);
`);

module.exports = db;