function registrarPacientes(app, { pacientesServicio, usuarioActual }) {
    app.get('/pacientes/me', usuarioActual, (req, res) => {
        return res.json(pacientesServicio.obtenerMio(req.yo.usuario));
    });

    app.get('/pacientes', usuarioActual, (req, res) => {
        return res.json(pacientesServicio.listar(req.yo));
    });

    app.get('/pacientes/:id', usuarioActual, (req, res) => {
        return res.json(pacientesServicio.obtenerPorId(req.params.id, req.yo));
    });

    app.post('/pacientes', usuarioActual, (req, res) => {
        return res.status(201).json(pacientesServicio.crear(req.body, req.yo));
    });

    app.patch('/pacientes/:id', usuarioActual, (req, res) => {
        return res.json(pacientesServicio.actualizar(req.params.id, req.body, req.yo));
    });
}

module.exports = { registrarPacientes };
