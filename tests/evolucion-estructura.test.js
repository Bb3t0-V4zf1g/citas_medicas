const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

process.env.JWT_SECRETO ??= 'secreto-de-pruebas-local-no-usar-en-produccion';

const app = require('../server');
const db = require('../database/conexion');

let servidor;
let baseUrl;

const citasCreadas = [];
const pacientesCreados = [];
const medicosCreados = [];
const consultoriosCreados = [];
const usuariosCreados = [];
let pacienteAnaPrevio = null;

before(async () => {
    pacienteAnaPrevio = db.prepare('SELECT id FROM pacientes WHERE usuario_id = ?').get('ana') ?? null;
    servidor = app.listen(0);
    await new Promise(resolve => servidor.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    try {
        for (const id of citasCreadas) {
            db.prepare('DELETE FROM citas WHERE id = ?').run(id);
        }
        for (const id of pacientesCreados) {
            db.prepare(
                'DELETE FROM pacientes WHERE id = ? AND NOT EXISTS (SELECT 1 FROM citas WHERE paciente_id = pacientes.id)'
            ).run(id);
        }
        for (const id of medicosCreados) {
            db.prepare(
                'DELETE FROM medicos WHERE id = ? AND NOT EXISTS (SELECT 1 FROM citas WHERE medico_id = medicos.id)'
            ).run(id);
        }
        for (const id of consultoriosCreados) {
            db.prepare(
                'DELETE FROM consultorios WHERE id = ? AND NOT EXISTS (SELECT 1 FROM citas WHERE consultorio_id = consultorios.id)'
            ).run(id);
        }
        for (const usuario of usuariosCreados) {
            db.prepare('DELETE FROM usuarios WHERE usuario = ?').run(usuario);
        }
        if (!pacienteAnaPrevio) {
            db.prepare(
                'DELETE FROM pacientes WHERE usuario_id = ? AND NOT EXISTS (SELECT 1 FROM citas WHERE paciente_id = pacientes.id)'
            ).run('ana');
        }
    } finally {
        await new Promise((resolve, reject) => servidor.close(error => (error ? reject(error) : resolve())));
    }
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

function recolectarArchivos(carpeta, extension) {
    const resultados = [];
    for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
        const ruta = path.join(carpeta, entrada.name);
        if (entrada.isDirectory()) {
            resultados.push(...recolectarArchivos(ruta, extension));
        } else if (!extension || ruta.endsWith(extension)) {
            resultados.push(ruta);
        }
    }
    return resultados;
}

test('citas: ciclo CRUD completo, conflictos 409, validaciones 422 y aislamiento por propietario', async () => {
    const authAdmin = await iniciarSesion('admin', 'admin12345');
    const authAna = await iniciarSesion('ana', 'ana12345');
    const authJuan = await iniciarSesion('juan', 'juan12345');
    const sufijo = randomUUID().slice(0, 8);

    // Validación 422 al crear cita inválida
    const invalida = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            medico: 'Dr',
            paciente: 'Juan_Perez',
            horario_inicio: 'invalido',
            horario_fin: 'invalido',
            estado: 'Invalido',
            fecha_de_registro: '2026-01-01T00:00:00Z'
        })
    });
    assert.equal(invalida.respuesta.status, 422);
    assert.equal(invalida.contenido.error, 'Entidad no procesable');
    assert.ok(Array.isArray(invalida.contenido.detalles) && invalida.contenido.detalles.length >= 5);

    // Crear médico y paciente reales antes de agendar
    const medicoPrueba = await solicitud('/medicos', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nombre: `Dra. Prueba ${sufijo}`,
            cedula_profesional: `CED-CITA-${sufijo}`,
            especialidad: 'Medicina General'
        })
    });
    assert.equal(medicoPrueba.respuesta.status, 201);
    medicosCreados.push(medicoPrueba.contenido.id);

    const pacientePrueba = await solicitud('/pacientes', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nombre: `Paciente Prueba ${sufijo}`,
            usuario_id: null
        })
    });
    assert.equal(pacientePrueba.respuesta.status, 201);
    pacientesCreados.push(pacientePrueba.contenido.id);

    // Rechaza 422 si el médico o paciente no existen
    const inexistentes = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            medico: `Dr. Fantasma ${sufijo}`,
            paciente: `Paciente Fantasma ${sufijo}`,
            horario_inicio: '2027-05-10T10:00:00Z',
            horario_fin: '2027-05-10T10:30:00Z',
            estado: 'Pendiente'
        })
    });
    assert.equal(inexistentes.respuesta.status, 422);

    // Rechaza 422 si los horarios no están en intervalos de 30 minutos
    const horarioNoValido = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            medico: medicoPrueba.contenido.nombre,
            paciente: pacientePrueba.contenido.nombre,
            horario_inicio: '2027-05-10T10:15:00Z',
            horario_fin: '2027-05-10T10:45:00Z',
            estado: 'Pendiente'
        })
    });
    assert.equal(horarioNoValido.respuesta.status, 422);

    // Crear cita válida como admin
    const payload = {
        medico: medicoPrueba.contenido.nombre,
        paciente: pacientePrueba.contenido.nombre,
        horario_inicio: '2027-05-10T10:00:00Z',
        horario_fin: '2027-05-10T11:00:00Z',
        estado: 'Pendiente'
    };
    const creada = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    assert.equal(creada.respuesta.status, 201);
    assert.ok(creada.contenido.id);
    citasCreadas.push(creada.contenido.id);

    // Conflicto 409 por traslape del mismo médico en cita Pendiente (en bloques de 30 min)
    const conflicto = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            horario_inicio: '2027-05-10T10:30:00Z',
            horario_fin: '2027-05-10T11:30:00Z'
        })
    });
    assert.equal(conflicto.respuesta.status, 409);
    assert.equal(conflicto.contenido.error, 'Conflicto de horario');

    // Actualizar cita y conservar fecha_de_registro original
    const actualizada = await solicitud(`/citas/${creada.contenido.id}`, {
        method: 'PUT',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            estado: 'Cancelado'
        })
    });
    assert.equal(actualizada.respuesta.status, 200);
    assert.equal(actualizada.contenido.estado, 'Cancelado');
    assert.equal(actualizada.contenido.fecha_de_registro, creada.contenido.fecha_de_registro);

    // Médico (ana = Dra. Ana Torres) NO puede agendar para otro médico (403)
    const citaOtroMedico = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authAna, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            medico: medicoPrueba.contenido.nombre,
            paciente: pacientePrueba.contenido.nombre,
            horario_inicio: '2027-05-11T09:00:00Z',
            horario_fin: '2027-05-11T09:30:00Z',
            estado: 'Pendiente'
        })
    });
    assert.equal(citaOtroMedico.respuesta.status, 403);

    // Paciente (juan) NO puede crear citas (403)
    const citaDePaciente = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authJuan, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            medico: 'Dra. Ana Torres',
            paciente: 'Juan Perez',
            horario_inicio: '2027-05-11T09:00:00Z',
            horario_fin: '2027-05-11T09:30:00Z',
            estado: 'Pendiente'
        })
    });
    assert.equal(citaDePaciente.respuesta.status, 403);

    // Médico (ana) crea cita para sí misma; juan no accede (404)
    const citaAna = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authAna, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            medico: 'Dra. Ana Torres',
            paciente: pacientePrueba.contenido.nombre,
            horario_inicio: '2027-05-11T09:00:00Z',
            horario_fin: '2027-05-11T09:30:00Z',
            estado: 'Pendiente'
        })
    });
    assert.equal(citaAna.respuesta.status, 201);
    citasCreadas.push(citaAna.contenido.id);

    const accesoJuan = await solicitud(`/citas/${citaAna.contenido.id}`, { headers: authJuan });
    assert.equal(accesoJuan.respuesta.status, 404);

    // Médico (ana) puede editar y marcar como Completado una cita creada por admin para ella
    const citaAdminParaAna = await solicitud('/citas', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            medico: 'Dra. Ana Torres',
            paciente: pacientePrueba.contenido.nombre,
            horario_inicio: '2027-05-12T09:00:00Z',
            horario_fin: '2027-05-12T09:30:00Z',
            estado: 'Pendiente'
        })
    });
    assert.equal(citaAdminParaAna.respuesta.status, 201);
    citasCreadas.push(citaAdminParaAna.contenido.id);

    const completadaPorAna = await solicitud(`/citas/${citaAdminParaAna.contenido.id}`, {
        method: 'PUT',
        headers: { ...authAna, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            medico: 'Dra. Ana Torres',
            paciente: pacientePrueba.contenido.nombre,
            horario_inicio: '2027-05-12T09:00:00Z',
            horario_fin: '2027-05-12T09:30:00Z',
            estado: 'Completado'
        })
    });
    assert.equal(completadaPorAna.respuesta.status, 200);
    assert.equal(completadaPorAna.contenido.estado, 'Completado');

    // Pero ana no puede borrar la cita registrada por admin (403)
    const borrarCitaAdmin = await solicitud(`/citas/${citaAdminParaAna.contenido.id}`, {
        method: 'DELETE',
        headers: authAna
    });
    assert.equal(borrarCitaAdmin.respuesta.status, 403);

    // Eliminar citas
    const borrada = await solicitud(`/citas/${creada.contenido.id}`, {
        method: 'DELETE',
        headers: authAdmin
    });
    assert.equal(borrada.respuesta.status, 204);

    const yaNoExiste = await solicitud(`/citas/${creada.contenido.id}`, { headers: authAdmin });
    assert.equal(yaNoExiste.respuesta.status, 404);

    // Validación de comentario IA
    const comentarioInvalido = await solicitud('/citas/comentario', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentario: 'a' })
    });
    assert.equal(comentarioInvalido.respuesta.status, 422);
    assert.equal(comentarioInvalido.contenido.error, 'Los datos no son válidos');
});

test('recursos de dominio y catálogos: validaciones, permisos y CRUD', async () => {
    const authAdmin = await iniciarSesion('admin', 'admin12345');
    const authAna = await iniciarSesion('ana', 'ana12345');
    const sufijo = randomUUID().slice(0, 8);

    // Validación de login y cambio de clave
    const loginInvalido = await solicitud('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: '', clave: '' })
    });
    assert.equal(loginInvalido.respuesta.status, 422);

    const claveInvalida = await solicitud('/usuarios/me', {
        method: 'PATCH',
        headers: { ...authAna, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave_actual: 'ana12345', nueva_clave: 'corta' })
    });
    assert.equal(claveInvalida.respuesta.status, 422);

    const usuarioInexistente = await solicitud('/usuarios/no_existe_999', {
        method: 'PATCH',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: 'usuario' })
    });
    assert.equal(usuarioInexistente.respuesta.status, 404);

    // Crear usuario desde admin (201), duplicado (409) y sin permiso (403)
    const nuevoUsuario = `med_${sufijo}`;
    const altaUsuarioDenegada = await solicitud('/usuarios', {
        method: 'POST',
        headers: { ...authAna, 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: nuevoUsuario, clave: 'claveSegura123', rol: 'usuario' })
    });
    assert.equal(altaUsuarioDenegada.respuesta.status, 403);

    const altaUsuario = await solicitud('/usuarios', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: nuevoUsuario, clave: 'claveSegura123', rol: 'usuario' })
    });
    assert.equal(altaUsuario.respuesta.status, 201);
    assert.equal(altaUsuario.contenido.usuario, nuevoUsuario);
    assert.equal('clave_hash' in altaUsuario.contenido, false);
    usuariosCreados.push(nuevoUsuario);

    const altaUsuarioDuplicado = await solicitud('/usuarios', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: nuevoUsuario, clave: 'claveSegura123', rol: 'usuario' })
    });
    assert.equal(altaUsuarioDuplicado.respuesta.status, 409);

    // Pacientes: crear sin usuario_id (admin crea uno sin cuenta vinculada), validar 422 y 403
    const pacienteInvalido = await solicitud('/pacientes', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 'Ab', correo: 'no-valido', fecha_nacimiento: '99-99' })
    });
    assert.equal(pacienteInvalido.respuesta.status, 422);

    const pacienteCreado = await solicitud('/pacientes', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nombre: `Paciente Estructura ${sufijo}`,
            telefono: '3121234567',
            correo: `pac.${sufijo}@ejemplo.com`,
            fecha_nacimiento: '1995-03-14',
            usuario_id: null
        })
    });
    assert.equal(pacienteCreado.respuesta.status, 201);
    pacientesCreados.push(pacienteCreado.contenido.id);

    const pacienteAjeno = await solicitud(`/pacientes/${pacienteCreado.contenido.id}`, {
        headers: authAna
    });
    assert.equal(pacienteAjeno.respuesta.status, 403);

    const pacienteActualizado = await solicitud(`/pacientes/${pacienteCreado.contenido.id}`, {
        method: 'PATCH',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: '3127654321' })
    });
    assert.equal(pacienteActualizado.respuesta.status, 200);
    assert.equal(pacienteActualizado.contenido.telefono, '3127654321');

    // Médicos
    const medicoInvalido = await solicitud('/medicos', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 'Dr', cedula_profesional: '1', especialidad: 'X', usuario_id: 'no_existe' })
    });
    assert.equal(medicoInvalido.respuesta.status, 422);

    const medicoCreado = await solicitud('/medicos', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nombre: `Dr. Estructura ${sufijo}`,
            cedula_profesional: `CED-${sufijo}`,
            especialidad: 'Medicina Interna'
        })
    });
    assert.equal(medicoCreado.respuesta.status, 201);
    medicosCreados.push(medicoCreado.contenido.id);

    const medicoPatch = await solicitud(`/medicos/${medicoCreado.contenido.id}`, {
        method: 'PATCH',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ especialidad: 'Cardiología' })
    });
    assert.equal(medicoPatch.respuesta.status, 200);
    assert.equal(medicoPatch.contenido.especialidad, 'Cardiología');

    // Consultorios
    const consultorioInvalido = await solicitud('/consultorios', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: 'A', nombre: 'B' })
    });
    assert.equal(consultorioInvalido.respuesta.status, 422);

    const consultorioCreado = await solicitud('/consultorios', {
        method: 'POST',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            codigo: `C-${sufijo}`,
            nombre: `Consultorio ${sufijo}`,
            ubicacion: 'Piso 2'
        })
    });
    assert.equal(consultorioCreado.respuesta.status, 201);
    consultoriosCreados.push(consultorioCreado.contenido.id);

    const consultorioPatch = await solicitud(`/consultorios/${consultorioCreado.contenido.id}`, {
        method: 'PATCH',
        headers: { ...authAdmin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ubicacion: 'Piso 3' })
    });
    assert.equal(consultorioPatch.respuesta.status, 200);
    assert.equal(consultorioPatch.contenido.ubicacion, 'Piso 3');
});

test('estructura modular de backend y frontend respeta límites y sintaxis', () => {
    const raiz = path.resolve(__dirname, '..');

    const rutasEsperadas = [
        'src/server.js',
        'src/routes/auth.js',
        'src/routes/usuarios.js',
        'src/routes/pacientes.js',
        'src/routes/medicos.js',
        'src/routes/consultorios.js',
        'src/routes/citas.js',
        'src/validators/comunes.js',
        'src/validators/auth.js',
        'src/validators/usuarios.js',
        'src/validators/pacientes.js',
        'src/validators/medicos.js',
        'src/validators/consultorios.js',
        'src/validators/citas.js',
        'src/services/auth.js',
        'src/services/usuarios.js',
        'src/services/pacientes.js',
        'src/services/medicos.js',
        'src/services/consultorios.js',
        'src/services/citas.js',
        'src/repositories/comunes.js',
        'src/repositories/usuarios.js',
        'src/repositories/pacientes.js',
        'src/repositories/medicos.js',
        'src/repositories/consultorios.js',
        'src/repositories/citas.js',
        'front/index.html',
        'front/css/base.css',
        'front/css/layout.css',
        'front/css/components.css',
        'front/js/config.js',
        'front/js/auth.js',
        'front/js/api.js',
        'front/js/router.js',
        'front/js/main.js',
        'front/js/components/alert.js',
        'front/js/components/form.js',
        'front/js/components/table.js',
        'front/js/components/navbar.js',
        'front/js/components/activityLog.js',
        'front/js/pages/loginPage.js',
        'front/js/pages/citasPage.js',
        'front/js/pages/pacientesPage.js',
        'front/js/pages/medicosPage.js',
        'front/js/pages/consultoriosPage.js',
        'front/js/pages/usuariosPage.js',
        'front/js/pages/perfilPage.js'
    ];

    for (const rel of rutasEsperadas) {
        assert.equal(fs.existsSync(path.join(raiz, rel)), true, `Falta archivo requerido: ${rel}`);
    }

    // Verificar que fetch( aparezca únicamente en front/js/api.js dentro de front/
    const archivosFront = [
        ...recolectarArchivos(path.join(raiz, 'front'), '.js'),
        ...recolectarArchivos(path.join(raiz, 'front'), '.html')
    ];
    for (const archivo of archivosFront) {
        const rel = path.relative(raiz, archivo).replace(/\\/g, '/');
        const contenido = fs.readFileSync(archivo, 'utf8');
        if (rel === 'front/js/api.js') {
            assert.match(contenido, /\bfetch\s*\(/, 'front/js/api.js debe contener la llamada a fetch');
        } else {
            assert.equal(/\bfetch\s*\(/.test(contenido), false, `fetch no debe aparecer en ${rel}`);
        }
    }

    // Verificar que auth.js no importe api.js ni router.js (sin dependencias circulares)
    const authContenido = fs.readFileSync(path.join(raiz, 'front/js/auth.js'), 'utf8');
    assert.equal(/api\.js|router\.js/.test(authContenido), false);

    // Verificar que index.html cargue main.js como módulo ES
    const indexHtml = fs.readFileSync(path.join(raiz, 'front/index.html'), 'utf8');
    assert.match(indexHtml, /<script\s+type="module"\s+src="\.\/js\/main\.js"><\/script>/);

    // Verificar sintaxis JavaScript en src/ y front/js/
    const jsFiles = [
        path.join(raiz, 'server.js'),
        ...recolectarArchivos(path.join(raiz, 'src'), '.js'),
        ...recolectarArchivos(path.join(raiz, 'front', 'js'), '.js')
    ];
    for (const jsFile of jsFiles) {
        execFileSync(process.execPath, ['--check', jsFile]);
    }
});
