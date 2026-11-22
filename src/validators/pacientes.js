const { esObjetoJson, texto } = require('./comunes');

function validarPaciente(body, parcial = false) {
    const errores = [];
    if (!esObjetoJson(body)) return { errores: ['El cuerpo debe ser un objeto JSON'] };

    const datos = {
        nombre: texto(body.nombre, 'nombre', errores, { minimo: 5, maximo: 120, obligatorio: !parcial }),
        telefono: texto(body.telefono, 'telefono', errores, { minimo: 7, maximo: 30 }),
        correo: texto(body.correo, 'correo', errores, { minimo: 5, maximo: 160 }),
        fecha_nacimiento: texto(body.fecha_nacimiento, 'fecha_nacimiento', errores, { minimo: 10, maximo: 10 })
    };

    if (datos.correo !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
        errores.push('correo: formato inválido');
    }
    if (datos.fecha_nacimiento !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_nacimiento)) {
        errores.push('fecha_nacimiento: use AAAA-MM-DD');
    }

    return { errores, datos };
}

module.exports = { validarPaciente };
