function registrarUsuarios(app, { usuariosServicio, usuarioActual, soloAdmin }) {
    app.get('/usuarios/me', usuarioActual, (req, res) => {
        return res.json(usuariosServicio.obtenerPerfil(req.yo.usuario));
    });

    app.patch('/usuarios/me', usuarioActual, (req, res) => {
        usuariosServicio.cambiarClave(req.yo.usuario, req.body);
        return res.status(204).send();
    });

    app.get('/usuarios', usuarioActual, (req, res) => {
        if (!soloAdmin(req, res)) return;
        return res.json(usuariosServicio.listar());
    });

    app.patch('/usuarios/:usuario', usuarioActual, (req, res) => {
        if (!soloAdmin(req, res)) return;
        return res.json(usuariosServicio.actualizar(req.params.usuario, req.body));
    });
}

module.exports = { registrarUsuarios };
