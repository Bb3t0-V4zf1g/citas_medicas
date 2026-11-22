const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRETO ??= 'secreto-de-pruebas-local-no-usar-en-produccion';

const app = require('../server');

let servidor;
let baseUrl;

before(async () => {
    servidor = app.listen(0);
    await new Promise(resolve => servidor.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => servidor.close(error => error ? reject(error) : resolve()));
});

async function solicitud(ruta, opciones = {}) {
    const respuesta = await fetch(`${baseUrl}${ruta}`, opciones);
    const contenido = respuesta.status === 204 ? null : await respuesta.json();
    return { respuesta, contenido };
}

async function iniciarSesion(usuario, clave) {
    const { respuesta, contenido } = await solicitud('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, clave })
    });
    assert.equal(respuesta.status, 200);
    return { Authorization: `Bearer ${contenido.access_token}` };
}

test('los recursos protegidos rechazan peticiones sin token', async () => {
    const { respuesta, contenido } = await solicitud('/usuarios/me');
    assert.equal(respuesta.status, 401);
    assert.equal(contenido.error, 'No autorizado');
});

test('un usuario consulta sólo recursos permitidos', async () => {
    const autorizacion = await iniciarSesion('ana', 'ana12345');

    const cuenta = await solicitud('/usuarios/me', { headers: autorizacion });
    assert.equal(cuenta.respuesta.status, 200);
    assert.equal(cuenta.contenido.usuario, 'ana');
    assert.equal('clave_hash' in cuenta.contenido, false);

    const usuarios = await solicitud('/usuarios', { headers: autorizacion });
    assert.equal(usuarios.respuesta.status, 403);

    const pacientes = await solicitud('/pacientes', { headers: autorizacion });
    assert.equal(pacientes.respuesta.status, 200);
    assert.equal(Array.isArray(pacientes.contenido), true);
    assert.equal(pacientes.contenido.every(paciente => paciente.usuario_id === 'ana'), true);

    const medicos = await solicitud('/medicos', { headers: autorizacion });
    assert.equal(medicos.respuesta.status, 200);

    const altaConsultorio = await solicitud('/consultorios', {
        method: 'POST',
        headers: { ...autorizacion, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: 'PRUEBA', nombre: 'No debe crearse' })
    });
    assert.equal(altaConsultorio.respuesta.status, 403);
});

test('un administrador puede consultar cuentas y perfiles sin hashes', async () => {
    const autorizacion = await iniciarSesion('admin', 'admin12345');

    const usuarios = await solicitud('/usuarios', { headers: autorizacion });
    assert.equal(usuarios.respuesta.status, 200);
    assert.equal(usuarios.contenido.some(usuario => usuario.usuario === 'ana'), true);
    assert.equal(usuarios.contenido.every(usuario => !('clave_hash' in usuario)), true);

    const pacientes = await solicitud('/pacientes', { headers: autorizacion });
    assert.equal(pacientes.respuesta.status, 200);
    assert.equal(Array.isArray(pacientes.contenido), true);

    const consultorios = await solicitud('/consultorios', { headers: autorizacion });
    assert.equal(consultorios.respuesta.status, 200);
});
