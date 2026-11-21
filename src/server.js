const app = require('../server');
const { configuracion } = require('./config/env');

app.listen(configuracion.puerto, () => {
    console.log(`API de Citas corriendo en http://localhost:${configuracion.puerto}`);
});
