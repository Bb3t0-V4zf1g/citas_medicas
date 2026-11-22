const { esObjetoJson, texto } = require('./comunes');

function validarConsultorio(body, parcial = false) {
    const errores = [];
    if (!esObjetoJson(body)) return { errores: ['El cuerpo debe ser un objeto JSON'] };

    return {
        errores,
        datos: {
            codigo: texto(body.codigo, 'codigo', errores, { minimo: 2, maximo: 30, obligatorio: !parcial }),
            nombre: texto(body.nombre, 'nombre', errores, { minimo: 2, maximo: 120, obligatorio: !parcial }),
            ubicacion: texto(body.ubicacion, 'ubicacion', errores, { minimo: 2, maximo: 160 })
        }
    };
}

module.exports = { validarConsultorio };
