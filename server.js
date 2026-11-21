const express = require('express');
const cors = require('cors');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('./database/conexion');
require('./database/usuarios');

const { configuracion, validarConfiguracion } = require('./src/config/env');
const { identificarSolicitud } = require('./src/middlewares/solicitud');
const { crearUsuarioActual } = require('./src/middlewares/autenticacion');
const { soloAdmin } = require('./src/middlewares/autorizacion');
const { rutaNoEncontrada, manejarErrores } = require('./src/middlewares/errores');

const { crearRepositorioUsuarios } = require('./src/repositories/usuarios');
const { crearRepositorioPacientes } = require('./src/repositories/pacientes');
const { crearRepositorioMedicos } = require('./src/repositories/medicos');
const { crearRepositorioConsultorios } = require('./src/repositories/consultorios');
const { crearRepositorioCitas } = require('./src/repositories/citas');

const { crearClienteIA } = require('./src/services/ia');
const { crearServicioAuth } = require('./src/services/auth');
const { crearServicioUsuarios } = require('./src/services/usuarios');
const { crearServicioPacientes } = require('./src/services/pacientes');
const { crearServicioMedicos } = require('./src/services/medicos');
const { crearServicioConsultorios } = require('./src/services/consultorios');
const { crearServicioCitas } = require('./src/services/citas');

const { registrarAuth } = require('./src/routes/auth');
const { registrarUsuarios } = require('./src/routes/usuarios');
const { registrarPacientes } = require('./src/routes/pacientes');
const { registrarMedicos } = require('./src/routes/medicos');
const { registrarConsultorios } = require('./src/routes/consultorios');
const { registrarCitas } = require('./src/routes/citas');

const app = express();

validarConfiguracion();

app.use(cors({
    origin: configuracion.corsOrigenes,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type']
}));

app.use(identificarSolicitud);
app.use(express.json({ limit: '100kb' }));

const usuariosRepo = crearRepositorioUsuarios({ db });
const pacientesRepo = crearRepositorioPacientes({ db });
const medicosRepo = crearRepositorioMedicos({ db });
const consultoriosRepo = crearRepositorioConsultorios({ db });
const citasRepo = crearRepositorioCitas({ db });

const preguntarALaIA = crearClienteIA({
    url: configuracion.iaUrl,
    modelo: configuracion.iaModelo,
    clave: configuracion.iaClave
});

const authServicio = crearServicioAuth({
    usuariosRepo,
    bcrypt,
    jwt,
    jwtSecreto: configuracion.jwtSecreto
});
const usuariosServicio = crearServicioUsuarios({ usuariosRepo, bcrypt });
const pacientesServicio = crearServicioPacientes({ pacientesRepo, usuariosRepo });
const medicosServicio = crearServicioMedicos({ medicosRepo, usuariosRepo });
const consultoriosServicio = crearServicioConsultorios({ consultoriosRepo });
const citasServicio = crearServicioCitas({
    citasRepo,
    pacientesRepo,
    medicosRepo,
    preguntarALaIA
});

const usuarioActual = crearUsuarioActual({
    usuariosRepo,
    jwtSecreto: configuracion.jwtSecreto
});

// Documentación del contrato OpenAPI
app.get('/openapi.yaml', (req, res) => {
    res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs.html'));
});

registrarAuth(app, { authServicio });
registrarUsuarios(app, { usuariosServicio, usuarioActual, soloAdmin });
registrarPacientes(app, { pacientesServicio, usuarioActual });
registrarMedicos(app, { medicosServicio, usuarioActual, soloAdmin });
registrarConsultorios(app, { consultoriosServicio, usuarioActual, soloAdmin });
registrarCitas(app, { citasServicio, usuarioActual });

app.use(rutaNoEncontrada);
app.use(manejarErrores);

module.exports = app;
