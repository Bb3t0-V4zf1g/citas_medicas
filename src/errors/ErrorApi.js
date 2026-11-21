class ErrorApi extends Error {
    constructor(estado, mensaje, detalles = [], codigo = null) {
        super(mensaje);
        this.name = 'ErrorApi';
        this.estado = estado;
        this.detalles = detalles;
        this.codigo = codigo;
    }
}

module.exports = ErrorApi;
