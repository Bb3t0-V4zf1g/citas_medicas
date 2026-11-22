function actualizarTabla(db, tabla, id, datos) {
    const campos = Object.entries(datos).filter(([, valor]) => valor !== undefined);
    if (!campos.length) return false;
    const asignaciones = campos.map(([campo]) => `${campo} = ?`).join(', ');
    db.prepare(`UPDATE ${tabla} SET ${asignaciones}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(...campos.map(([, valor]) => valor), id);
    return true;
}

function insertarRegistro(db, tabla, datos) {
    const campos = Object.entries(datos).filter(([, valor]) => valor !== undefined);
    const columnas = campos.map(([campo]) => campo);
    const valores = campos.map(([, valor]) => valor);
    const marcadores = columnas.map(() => '?').join(', ');
    const resultado = db.prepare(`INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${marcadores})`).run(...valores);
    return Number(resultado.lastInsertRowid);
}

module.exports = { actualizarTabla, insertarRegistro };
