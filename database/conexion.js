const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const carpetaDB = __dirname;
const rutaDB = path.join(carpetaDB, 'citas.db');

if (!fs.existsSync(carpetaDB)) {
    fs.mkdirSync(carpetaDB, { recursive: true });
}

const db = new DatabaseSync(rutaDB);

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

module.exports = db;