function idValido(valor) {
    return Number.isSafeInteger(Number(valor)) && Number(valor) > 0;
}

function esObjetoJson(body) {
    return Boolean(body && typeof body === 'object' && !Array.isArray(body));
}

function texto(valor, campo, errores, { minimo = 1, maximo = 120, obligatorio = false } = {}) {
    if (valor === undefined && !obligatorio) return undefined;
    if (typeof valor !== 'string' || valor.trim().length < minimo || valor.trim().length > maximo) {
        errores.push(`${campo}: debe ser texto de ${minimo} a ${maximo} caracteres`);
        return undefined;
    }
    return valor.trim();
}

module.exports = { idValido, esObjetoJson, texto };
