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
        horario_inicio TEXT NOT NULL,
        horario_fin TEXT NOT NULL,
        estado INTEGER NOT NULL,
        fecha_de_registro TEXT NOT NULL
    );
`);

module.exports = db;