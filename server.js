const express = require('express');
const db = require('./database/conexion');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

const path = require('node:path');

app.use(express.json());

const SECRETO = process.env.JWT_SECRETO;

if (!SECRETO) {
    throw new Error('Falta configurar la variable de entorno JWT_SECRETO');
}

// ---------- Preguntarle algo a la IA (péguenlo una vez, arriba de sus rutas) ----------
const IA_URL = process.env.EXTERNO_URL ?? 'https://generativelanguage.googleapis.com';
const IA_MODELO = process.env.GEMINI_MODELO ?? 'gemini-flash-lite-latest';
const IA_CLAVE = process.env.GEMINI_API_KEY ?? '';       // IDEA 3: la clave NO va en el código

class FallaIA extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}

async function preguntarALaIA(instruccion) {
    if (!IA_CLAVE && IA_URL.includes('googleapis.com')) {
        throw new FallaIA(503, 'Falta configurar la variable de entorno GEMINI_API_KEY');
    }

    let r;

    // Máximo dos intentos: el original y un reintento.
    for (let intento = 0; intento < 2; intento++) {
        try {
            r = await fetch(`${IA_URL}/v1beta/models/${IA_MODELO}:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': IA_CLAVE
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: instruccion }] }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0
                    }
                }),
                signal: AbortSignal.timeout(5000)
            });
        } catch (e) {
            if (e.name === 'TimeoutError') {
                throw new FallaIA(504, 'La IA tardó demasiado en responder. Intenta en un momento.');
            }

            throw new FallaIA(502, 'No se pudo conectar con la IA.');
        }

        // Reintentar una sola vez si el servidor externo falla (5xx).
        if (r.status >= 500 && intento === 0) {
            continue;
        }

        // Los errores 4xx no se reintentan.
        if (!r.ok) {
            throw new FallaIA(
                502,
                `La IA no está disponible (respondió ${r.status}). Intenta más tarde.`
            );
        }

        break;
    }

    try {
        const respuesta = await r.json();
        return JSON.parse(respuesta.candidates[0].content.parts[0].text);
    } catch (e) {
        throw new FallaIA(502, 'La IA respondió algo que no entendemos.');
    }
}

// Endpoint para el login
app.post('/login', (req, res) => {
    const { usuario, clave } = req.body || {};

    if (typeof usuario !== 'string' || typeof clave !== 'string' || !usuario.trim() || !clave) {
        return res.status(422).json({
            error: 'Datos inválidos',
            detalles: ['Se requiere un usuario y una clave']
        });
    }

    const cuenta = db.prepare('SELECT usuario, clave_hash, rol FROM usuarios WHERE usuario = ?').get(usuario.trim());

    if (!cuenta || !bcrypt.compareSync(clave, cuenta.clave_hash)) {
        return res.status(401).json({
            error: 'Credenciales incorrectas',
            detalles: ['Usuario o clave incorrectos']
        });
    }

    const token = jwt.sign(
        { sub: cuenta.usuario, rol: cuenta.rol },
        SECRETO,
        { algorithm: 'HS256', expiresIn: '30m' }
    );

    return res.status(200).json({
        access_token: token,
        token_type: 'bearer',
    });

});

//middleware para verificar el token y obtener el usuario actual
function usuarioActual(req, res, next) {
    const autorizacion = req.headers.authorization;

    if (!autorizacion || !autorizacion.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'No autorizado',
            detalles: ['Se requiere un token Bearer']
        });
    }

    const token = autorizacion.substring(7);

    try {
        const datos = jwt.verify(token, SECRETO, {
            algorithms: ['HS256']
        });

        req.yo = {
            usuario: datos.sub,
            rol: datos.rol
        };

        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Token inválido',
            detalles: ['El token es inválido o ha expirado']
        });
    }
}

function esAdmin(req) {
    return req.yo.rol === 'admin';
}

function buscarCita(id, req) {
    if (esAdmin(req)) {
        return db.prepare(`
            SELECT * FROM citas
            WHERE id = ?
        `).get(id);
    }

    return db.prepare(`
        SELECT * FROM citas
        WHERE id = ? AND usuario_id = ?
    `).get(id, req.yo.usuario);
}

// Servir el contrato OpenAPI
app.get('/openapi.yaml', (req, res) => {
    res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

// Servir la documentación Swagger UI
app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs.html'));
});

// Función para validar los datos de una cita
function validarDatosCita(body, esPut = false) {
    const errores = [];
    const {
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado,
        fecha_de_registro
    } = body;

    if (!medico || typeof medico !== 'string') {
        errores.push('El campo medico es obligatorio y debe ser texto');
    } else if (medico.trim().length < 4) {
        errores.push('El campo medico debe tener un nombre con un mínimo de 4 caracteres');
    }

    if (!paciente || typeof paciente !== 'string') {
        errores.push('El campo paciente es obligatorio y debe ser texto');
    } else if (paciente.trim().length < 4 || paciente.includes('_')) {
        errores.push('El campo paciente debe ser un nombre válido (mínimo 4 caracteres y sin guiones bajos)');
    }

    let dInicio = null;
    let dFin = null;

    if (!horario_inicio) {
        errores.push('El campo horario_inicio es obligatorio');
    } else {
        dInicio = new Date(horario_inicio);
        if (isNaN(dInicio.getTime())) {
            errores.push('El campo horario_inicio debe ser una fecha válida (formato ISO)');
        }
    }

    if (!horario_fin) {
        errores.push('El campo horario_fin es obligatorio');
    } else {
        dFin = new Date(horario_fin);
        if (isNaN(dFin.getTime())) {
            errores.push('El campo horario_fin debe ser una fecha válida (formato ISO)');
        }
    }

    if (dInicio && dFin &&
        !isNaN(dInicio.getTime()) &&
        !isNaN(dFin.getTime())) {
        if (dInicio >= dFin) {
            errores.push('horario_inicio debe ser antes de horario_fin');
        }
    }

    if (typeof estado !== 'boolean') {
        errores.push('El campo estado es obligatorio y debe ser un valor booleano (true para activa, false para inactiva)');
    }

    if (esPut && fecha_de_registro) {
        const dReg = new Date(fecha_de_registro);

        if (isNaN(dReg.getTime())) {
            errores.push('El campo fecha_de_registro debe ser una fecha válida');
        } else if (dReg > new Date()) {
            errores.push('El campo fecha_de_registro no puede ser una fecha futura');
        }
    }

    return errores;
}

// Convierte el valor entero de SQLite a booleano
function formatearCita(cita) {
    if (!cita) return null;

    return {
        ...cita,
        estado: Boolean(cita.estado)
    };
}

// GET /citas
app.get('/citas', usuarioActual, (req, res) => {
    let citas;

    if (esAdmin(req)) {
        citas = db.prepare(`
            SELECT * FROM citas
        `).all();
    } else {
        citas = db.prepare(`
            SELECT * FROM citas
            WHERE usuario_id = ?
        `).all(req.yo.usuario);
    }

    return res.status(200).json(citas);
});

// GET /citas/:id
app.get('/citas/:id', usuarioActual, (req, res) => {
    const cita = buscarCita(req.params.id, req);

    if (!cita) {
        return res.status(404).json({
            error: 'Cita no encontrada'
        });
    }

    return res.status(200).json(formatearCita(cita));
});

// POST /citas
app.post('/citas', usuarioActual, (req, res) => {
    const errores = validarDatosCita(req.body);

    if (errores.length > 0) {
        return res.status(422).json({
            error: 'Entidad no procesable',
            detalles: errores
        });
    }

    const {
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado
    } = req.body;

    if (estado === true) {
        const conflicto = db.prepare(`
            SELECT id FROM citas
            WHERE LOWER(medico) = LOWER(?)
            AND horario_inicio = ?
            AND estado = 1
        `).get(medico, horario_inicio);

        if (conflicto) {
            return res.status(409).json({
                error: 'Conflicto de horario',
                detalles: [`El médico "${medico}" ya tiene una cita activa asignada para el horario_inicio "${horario_inicio}"`]
            });
        }
    }

    const fechaRegistro = new Date().toISOString();

    const resultado = db.prepare(`
        INSERT INTO citas (
            medico,
            paciente,
            horario_inicio,
            horario_fin,
            estado,
            fecha_de_registro,
            usuario_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado ? 1 : 0,
        fechaRegistro,
        req.yo.usuario
    );

    const nuevaCita = db.prepare(
        'SELECT * FROM citas WHERE id = ?'
    ).get(Number(resultado.lastInsertRowid));

    res.status(201).json(formatearCita(nuevaCita));
});

// PUT /citas/:id
app.put('/citas/:id', usuarioActual, (req, res) => {
    const id = req.params.id;

    // Buscar la cita verificando también su propietario
    const citaExistente = buscarCita(id, req);

    if (!citaExistente) {
        return res.status(404).json({
            error: 'Cita no encontrada',
            detalles: [`No se encontró la cita con ID ${id} para actualizar`]
        });
    }

    const errores = validarDatosCita(req.body, true);

    if (errores.length > 0) {
        return res.status(422).json({
            error: 'Entidad no procesable',
            detalles: errores
        });
    }

    const {
        medico,
        paciente,
        horario_inicio,
        horario_fin,
        estado,
        fecha_de_registro
    } = req.body;

    if (estado === true) {
        const conflicto = db.prepare(`
            SELECT id FROM citas
            WHERE id <> ?
            AND LOWER(medico) = LOWER(?)
            AND horario_inicio = ?
            AND estado = 1
        `).get(id, medico, horario_inicio);

        if (conflicto) {
            return res.status(409).json({
                error: 'Conflicto de horario',
                detalles: [`El médico "${medico}" ya tiene otra cita activa asignada para el horario_inicio "${horario_inicio}"`]
            });
        }
    }

    if (esAdmin(req)) {
        db.prepare(`
            UPDATE citas
            SET medico = ?,
                paciente = ?,
                horario_inicio = ?,
                horario_fin = ?,
                estado = ?,
                fecha_de_registro = ?
            WHERE id = ?
        `).run(
            medico,
            paciente,
            horario_inicio,
            horario_fin,
            estado ? 1 : 0,
            fecha_de_registro || citaExistente.fecha_de_registro,
            id
        );
    } else {
        db.prepare(`
            UPDATE citas
            SET medico = ?,
                paciente = ?,
                horario_inicio = ?,
                horario_fin = ?,
                estado = ?,
                fecha_de_registro = ?
            WHERE id = ? AND usuario_id = ?
        `).run(
            medico,
            paciente,
            horario_inicio,
            horario_fin,
            estado ? 1 : 0,
            fecha_de_registro || citaExistente.fecha_de_registro,
            id,
            req.yo.usuario
        );
    }

    const citaActualizada = db.prepare(
        'SELECT * FROM citas WHERE id = ?'
    ).get(id);

    return res.status(200).json(formatearCita(citaActualizada));
});

// DELETE /citas/:id
app.delete('/citas/:id', usuarioActual, (req, res) => {
    const id = req.params.id;

    // Verificar existencia y propietario
    const cita = buscarCita(id, req);

    if (!cita) {
        return res.status(404).json({
            error: 'Cita no encontrada',
            detalles: [`No se puede eliminar la cita porque el ID ${id} no existe o no te pertenece`]
        });
    }

    if (esAdmin(req)) {
        db.prepare(`
            DELETE FROM citas
            WHERE id = ?
        `).run(id);
    } else {
        db.prepare(`
            DELETE FROM citas
            WHERE id = ? AND usuario_id = ?
        `).run(id, req.yo.usuario);
    }

    return res.status(204).send();
});


// ---------- Endpoint de análisis de comentarios con IA ----------
const INSTRUCCION_IA = `Clasifica el comentario de un paciente sobre el SERVICIO de la clínica (puntualidad, trato, instalaciones).
Responde SOLO un JSON con la forma:
{"sentimiento": "positivo" | "neutral" | "negativo", "resumen": "máximo 15 palabras en español"}.
No incluyas información que no esté en el comentario.
Comentario: `;

app.post('/citas/comentario', async (req, res, next) => {
    const texto = req.body?.comentario;

    // Validar el comentario recibido
    if (
        typeof texto !== 'string' ||
        texto.trim().length < 2 ||
        texto.length > 300
    ) {
        return res.status(422).json({
            error: 'Los datos no son válidos',
            detalles: ['comentario: de 2 a 300 caracteres']
        });
    }

    try {
        // Enviar el comentario a Gemini
        const ia = await preguntarALaIA(INSTRUCCION_IA + texto);

        // Validar la respuesta de la IA
        if (
            !ia ||
            typeof ia !== 'object' ||
            !['positivo', 'neutral', 'negativo'].includes(ia.sentimiento) ||
            typeof ia.resumen !== 'string' ||
            !ia.resumen.trim()
        ) {
            throw new FallaIA(502, 'La IA respondió algo inesperado.');
        }

        return res.status(200).json({
            sentimiento: ia.sentimiento,
            resumen: ia.resumen.trim().slice(0, 200)
        });

    } catch (e) {
        if (e instanceof FallaIA) {
            return res.status(e.estado).json({
                error: e.message
            });
        }

        next(e);
    }
});


// Manejo de errores de JSON
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'JSON inválido',
            detalles: ['El cuerpo de la solicitud debe ser JSON válido']
        });
    }

    next(err);
});

app.listen(3000, () => {
    console.log('API de Citas corriendo en http://localhost:3000');
});
