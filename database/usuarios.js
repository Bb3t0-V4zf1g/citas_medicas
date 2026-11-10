const db = require('./conexion');
const bcrypt = require('bcryptjs');

//Usuarios de prueba
const usuariosIniciales = [
    { usuario: 'admin', clave: 'admin12345', rol: 'admin' },
    { usuario: 'ana', clave: 'ana12345', rol: 'usuario' },
    { usuario: 'beto', clave: 'beto12345', rol: 'usuario' }
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

console.log('Inicialización de usuarios finalizada');