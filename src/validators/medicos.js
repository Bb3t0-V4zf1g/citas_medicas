const { esObjetoJson, texto } = require('./comunes');

function validarMedico(body, parcial = false) {
    const errores = [];
    if (!esObjetoJson(body)) return { errores: ['El cuerpo debe ser un objeto JSON'] };

    return {
        errores,
        datos: {
            nombre: texto(body.nombre, 'nombre', errores, { minimo: 5, maximo: 120, obligatorio: !parcial }),
            cedula_profesional: texto(body.cedula_profesional, 'cedula_profesional', errores, { minimo: 4, maximo: 40, obligatorio: !parcial }),
            especialidad: texto(body.especialidad, 'especialidad', errores, { minimo: 3, maximo: 100, obligatorio: !parcial })
        }
    };
}

module.exports = { validarMedico };
