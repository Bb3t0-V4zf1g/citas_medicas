function registrarMedicos(app, { medicosServicio, usuarioActual, soloAdmin }) {
    app.get('/medicos', usuarioActual, (req, res) => {
        return res.json(medicosServicio.listar());
    });

    app.get('/medicos/:id', usuarioActual, (req, res) => {
        return res.json(medicosServicio.obtenerPorId(req.params.id));
    });

    app.post('/medicos', usuarioActual, (req, res) => {
        if (!soloAdmin(req, res)) return;
        return res.status(201).json(medicosServicio.crear(req.body));
    });

    app.patch('/medicos/:id', usuarioActual, (req, res) => {
        if (!soloAdmin(req, res)) return;
        return res.json(medicosServicio.actualizar(req.params.id, req.body));
    });
}

module.exports = { registrarMedicos };
