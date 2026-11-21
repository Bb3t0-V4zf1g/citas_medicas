function registrarAuth(app, { authServicio }) {
    app.post('/login', (req, res) => {
        return res.status(200).json(authServicio.iniciarSesion(req.body));
    });
}

module.exports = { registrarAuth };
