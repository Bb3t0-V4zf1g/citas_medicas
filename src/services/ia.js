const ErrorApi = require('../errors/ErrorApi');

function crearClienteIA({ url, modelo, clave }) {
    return async function preguntarALaIA(instruccion) {
        if (!clave && url.includes('googleapis.com')) throw new ErrorApi(503, 'Falta configurar la variable de entorno GEMINI_API_KEY');
        let respuestaHttp;
        for (let intento = 0; intento < 2; intento += 1) {
            try {
                respuestaHttp = await fetch(`${url}/v1beta/models/${modelo}:generateContent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
                    body: JSON.stringify({ contents: [{ parts: [{ text: instruccion }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
                    signal: AbortSignal.timeout(5000)
                });
            } catch (error) {
                if (error.name === 'TimeoutError') throw new ErrorApi(504, 'La IA tardó demasiado en responder. Intenta en un momento.');
                throw new ErrorApi(502, 'No se pudo conectar con la IA.');
            }
            if (respuestaHttp.status >= 500 && intento === 0) continue;
            if (!respuestaHttp.ok) throw new ErrorApi(502, `La IA no está disponible (respondió ${respuestaHttp.status}). Intenta más tarde.`);
            break;
        }
        try {
            const respuesta = await respuestaHttp.json();
            return JSON.parse(respuesta.candidates[0].content.parts[0].text);
        } catch {
            throw new ErrorApi(502, 'La IA respondió algo que no entendemos.');
        }
    };
}

module.exports = { crearClienteIA };
