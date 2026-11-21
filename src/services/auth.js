const ErrorApi = require('../errors/ErrorApi');
const { validarLogin } = require('../validators/auth');

function crearServicioAuth({ usuariosRepo, bcrypt, jwt, jwtSecreto }) {
    function iniciarSesion(body) {
        const { errores, datos } = validarLogin(body);
        if (errores.length) {
            throw new ErrorApi(422, 'Datos inválidos', errores);
        }

        const cuenta = usuariosRepo.buscarParaLogin(datos.usuario);
        if (!cuenta || !cuenta.activo || !bcrypt.compareSync(datos.clave, cuenta.clave_hash)) {
            throw new ErrorApi(401, 'Credenciales incorrectas', ['Usuario o clave incorrectos']);
        }

        const token = jwt.sign(
            { sub: cuenta.usuario, rol: cuenta.rol, ver: cuenta.token_version },
            jwtSecreto,
            {
                algorithm: 'HS256',
                expiresIn: '30m',
                issuer: 'citas-medicas-api',
                audience: 'citas-medicas-cliente'
            }
        );

        return {
            access_token: token,
            token_type: 'bearer',
            expires_in: 1800
        };
    }

    return { iniciarSesion };
}

module.exports = { crearServicioAuth };
