function registrarCitas(app, { citasServicio, usuarioActual }) {
    app.get('/citas', usuarioActual, (req, res) => {
        return res.status(200).json(citasServicio.listar(req.yo));
    });

    app.post('/citas/comentario', usuarioActual, async (req, res) => {
        const resultado = await citasServicio.analizarComentario(req.body);
        return res.status(200).json(resultado);
    });

    app.get('/citas/:id', usuarioActual, (req, res) => {
        return res.status(200).json(citasServicio.obtener(req.params.id, req.yo));
    });

    app.post('/citas', usuarioActual, (req, res) => {
        return res.status(201).json(citasServicio.crear(req.body, req.yo));
    });

    app.put('/citas/:id', usuarioActual, (req, res) => {
        return res.status(200).json(citasServicio.actualizar(req.params.id, req.body, req.yo));
    });

    app.delete('/citas/:id', usuarioActual, (req, res) => {
        citasServicio.eliminar(req.params.id, req.yo);
        return res.status(204).send();
    });
}

module.exports = { registrarCitas };
