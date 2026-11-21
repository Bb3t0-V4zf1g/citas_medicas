require('dotenv').config();

function listaDesdeEntorno(valor, predeterminado) {
    return (valor ?? predeterminado)
        .split(',')
        .map(elemento => elemento.trim())
        .filter(Boolean);
}

const configuracion = Object.freeze({
    puerto: Number(process.env.PORT ?? 3000),
    jwtSecreto: process.env.JWT_SECRETO,
    corsOrigenes: listaDesdeEntorno(
        process.env.CORS_ORIGENES,
        'http://127.0.0.1:5500,http://localhost:5500'
    ),
    iaUrl: process.env.EXTERNO_URL ?? 'https://generativelanguage.googleapis.com',
    iaModelo: process.env.GEMINI_MODELO ?? 'gemini-flash-lite-latest',
    iaClave: process.env.GEMINI_API_KEY ?? ''
});

function validarConfiguracion() {
    if (!configuracion.jwtSecreto) {
        throw new Error('Falta configurar la variable de entorno JWT_SECRETO');
    }

    if (!Number.isInteger(configuracion.puerto) || configuracion.puerto < 1 || configuracion.puerto > 65535) {
        throw new Error('PORT debe ser un puerto válido entre 1 y 65535');
    }
}

module.exports = { configuracion, validarConfiguracion };
