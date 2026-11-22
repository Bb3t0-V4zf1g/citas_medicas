function registrarConsultorios(app, { consultoriosServicio, usuarioActual, soloAdmin }) {
    app.get('/consultorios', usuarioActual, (req, res) => {
        return res.json(consultoriosServicio.listar());
    });

    app.get('/consultorios/:id', usuarioActual, (req, res) => {
        return res.json(consultoriosServicio.obtenerPorId(req.params.id));
    });

    app.post('/consultorios', usuarioActual, (req, res) => {
        if (!soloAdmin(req, res)) return;
        return res.status(201).json(consultoriosServicio.crear(req.body));
    });

    app.patch('/consultorios/:id', usuarioActual, (req, res) => {
        if (!soloAdmin(req, res)) return;
        return res.json(consultoriosServicio.actualizar(req.params.id, req.body));
    });
}

module.exports = { registrarConsultorios };
