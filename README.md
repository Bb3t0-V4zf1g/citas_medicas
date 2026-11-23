# Citas médicas · API

API REST para que una clínica gestione citas médicas, perfiles de pacientes, médicos, consultorios y cuentas de usuario. Los administradores gestionan los catálogos y todas las citas; cada paciente o médico consulta y opera únicamente sobre sus propias citas y puede analizar comentarios sobre el servicio de la clínica mediante una IA externa.

- **Versión:** v1.0.0 (ver [CHANGELOG.md](CHANGELOG.md))
- **Lenguaje:** Node.js · Express
- **Arquitectura:** [docs/arquitectura.md](docs/arquitectura.md)

## Cómo correrla

1. Clonar el repositorio:
   ```cmd
   git clone https://github.com/Bb3t0-V4zf1g/citas_medicas.git
   cd citas_medicas
   ```
2. Instalar dependencias:
   ```cmd
   npm install
   ```
3. Configurar las variables de entorno (ver la tabla de abajo). Copia `.env.example` a `.env` y define un secreto largo y aleatorio para `JWT_SECRETO` (o defínelas en tu ventana de `cmd`):
   ```cmd
   copy .env.example .env
   set JWT_SECRETO=una-cadena-larga-y-aleatoria
   set GEMINI_API_KEY=tu-clave-de-gemini
   ```
4. Arrancar la API (la base de datos SQLite y los usuarios de prueba se inicializan automáticamente al arrancar):
   ```cmd
   npm start
   ```
5. Abrir el contrato interactivo en http://127.0.0.1:3000/docs y el front en http://127.0.0.1:5500 (`cd front` y `python -m http.server 5500`).

Usuarios de prueba iniciales: `admin / admin12345` (rol `admin`), `ana / ana12345` y `juan / juan12345` (rol `usuario`).

## Variables de entorno

Están todas en [.env.example](.env.example). **Ninguna clave real va en el repositorio.**

| Variable | Para qué sirve | Obligatoria |
|---|---|---|
| `JWT_SECRETO` | Secreto para firmar y verificar los tokens JWT (`HS256`). La API no arranca si falta. | Sí |
| `PORT` | Puerto HTTP en el que escucha la API (`3000` por omisión). | No |
| `CORS_ORIGENES` | Lista de orígenes del navegador autorizados por CORS, separados por coma (`http://127.0.0.1:5500,http://localhost:5500` por omisión). | No |
| `GEMINI_API_KEY` | Clave de la API de Gemini para analizar comentarios en `POST /citas/comentario`. Sin ella responde `503`. | Para IA real |
| `GEMINI_MODELO` | Modelo de Gemini que se utiliza (`gemini-flash-lite-latest` por omisión). | No |
| `EXTERNO_URL` | URL base del servicio de IA (`https://generativelanguage.googleapis.com` por omisión; usar `http://127.0.0.1:9000` para pruebas con el simulador local). | No |

## Ejemplos de uso

Entrar y obtener el token:
```cmd
curl -X POST http://127.0.0.1:3000/login -H "Content-Type: application/json" -d "{\"usuario\": \"ana\", \"clave\": \"ana12345\"}"
```

Crear una cita protegida con el token (queda ligada al usuario autenticado):
```cmd
curl -X POST http://127.0.0.1:3000/citas -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"medico\": \"Dra. Ana Torres\", \"paciente\": \"Maria Lopez\", \"horario_inicio\": \"2026-11-25T10:00:00Z\", \"horario_fin\": \"2026-11-25T10:30:00Z\", \"estado\": \"Pendiente\"}"
```

Analizar un comentario de servicio con IA:
```cmd
curl -X POST http://127.0.0.1:3000/citas/comentario -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"comentario\": \"Me atendieron puntual, pero en recepcion tardaron mucho\"}"
```

## Contrato y errores

- Contrato OpenAPI: http://127.0.0.1:3000/docs ([openapi.yaml](openapi.yaml))
- Errores: todos responden en JSON con `{"error": "...", "detalles": [...]}` (más `codigo` y `request_id` en el manejador central). Ver [docs/errores.md](docs/errores.md).
- Decisiones de arquitectura (ADR): [docs/decisiones/0001-usar-jwt.md](docs/decisiones/0001-usar-jwt.md) y [docs/decisiones/0002-timeout-y-reintentos-ia.md](docs/decisiones/0002-timeout-y-reintentos-ia.md).

## Rutas protegidas y permisos

Todas las rutas siguientes requieren `Authorization: Bearer <token>` obtenido en `POST /login`:

| Recurso | Usuario autenticado | Administrador |
|---|---|---|
| `/usuarios/me` | Consulta su cuenta y cambia su propia contraseña | Igual |
| `/usuarios` | Sin acceso (`403`) | Lista, crea y modifica rol o estado de cuentas |
| `/pacientes` | Consulta y actualiza únicamente su perfil | Gestiona todos los perfiles |
| `/medicos` | Consulta | Consulta, crea y actualiza (incluyendo vinculación de cuenta) |
| `/consultorios` | Consulta | Consulta, crea y actualiza |
| `/citas` | Paciente: solo consulta sus citas (`403` al crear/editar). Médico: consulta, crea y edita/completa solo sus propias citas (`404` si es ajena) | CRUD sobre todas las citas |
| `/citas/opciones` | Devuelve permisos y catálogos de médicos/pacientes existentes según el tipo de cuenta | Igual |
| `/citas/comentario` | Analiza comentarios con IA | Igual |

## Cómo probarla

### 1. Pruebas de integración en Node (no requieren levantar servidor aparte)

```cmd
npm test
```

### 2. Pruebas automáticas de la materia (`probar_api.py`, 28 pruebas)

En una terminal, arranca la API apuntando al simulador local para las pruebas 21–25:
```cmd
set EXTERNO_URL=http://127.0.0.1:9000
npm start
```

En otra terminal, ejecuta el evaluador (la primera vez la prueba 15 queda pendiente: reinicia la API con `Ctrl+C` y vuelve a correrlo):
```cmd
python probar_api.py
```

Resultado de la versión v1.0.0: 28 de 28 pruebas en `probar_api.py` y todas las pruebas de `npm test` en verde.

## Estructura de la aplicación

- **Backend (`src/` y `server.js`)**:
  - `src/server.js` y `server.js`: arranque del servidor HTTP y ensamblaje de middlewares, repositorios, servicios y rutas en Express.
  - `src/config/env.js`, `src/errors/ErrorApi.js` y `src/middlewares/`: variables de entorno, trazabilidad (`request_id`), autenticación JWT, autorización por rol y manejo centralizado de errores JSON.
  - `src/validators/`: validación por campo para `auth`, `usuarios`, `pacientes`, `medicos`, `consultorios` y `citas`.
  - `src/repositories/` y `database/`: persistencia en SQLite (`node:sqlite`) con consultas parametrizadas (`?`) y migración automática idempotente.
  - `src/services/`: reglas de negocio (conflictos `409`, relación por dueño) e integración con Gemini (`src/services/ia.js`).
  - `src/routes/`: endpoints REST por recurso.
- **Frontend modular (`front/`)**:
  - `front/index.html`, `front/css/` y `front/js/`: cliente SPA por hash con `fetch` centralizado en `front/js/api.js`, sesión en `sessionStorage`, bitácora HTTP y manejo visual de errores por campo.

## Anatomía de mi API

```
Anatomía de mi API · lista de revisión (43 de 43)

0 · Cliente (2/2)
  [x] Mi proyecto tiene un cliente que consume la API: una página, una app o un script.
  [x] Puedo hacer una acción en el cliente y mostrar la petición y la respuesta en la pestaña Red (F12).
  En la presentación: Abran su front y hagan una acción en vivo. Con F12 → Red, muestren la petición que salió y la respuesta que llegó.

1 · Petición HTTP (3/3)
  [x] Mis rutas nombran cosas (/tareas, /tareas/7), no acciones (/crearTarea).
  [x] Cada operación usa el método correcto: GET lee, POST crea, PUT o PATCH modifica, DELETE borra.
  [x] Tengo la ficha de endpoints: método, ruta, qué recibe y qué responde.
  En la presentación: Muestren su ficha de endpoints o /docs y expliquen en una frase qué hace cada ruta.

2 · CORS (3/3)
  [x] Configuré CORS con una lista de orígenes, no con *.
  [x] Authorization y Content-Type están en los encabezados permitidos.
  [x] CORS va antes de revisar el token.
  En la presentación: Abran su front desde su origen (por ejemplo, el puerto 5500) con F12 abierto: la consola sin errores de CORS.

3 · Autenticación (3/3)
  [x] Las contraseñas se guardan con hash (bcrypt o password_hash).
  [x] El login regresa un token JWT con vencimiento.
  [x] Sin token, o con un token alterado, la API responde 401.
  En la presentación: Hagan una petición a una ruta protegida sin token (401) y luego con token (200).

4 · Autorización (2/2)
  [x] Hay al menos dos roles y una acción que un rol no puede hacer (403).
  [x] Las consultas de recursos propios filtran por el usuario del token (WHERE id = ? AND usuario = ?).
  En la presentación: Con el usuario A pidan un recurso del usuario B: debe responder 404. Con un rol sin permiso intenten borrar: 403.

5 · Validación (3/3)
  [x] Valido campos obligatorios, tipo, formato y rango.
  [x] Un dato inválido responde 422 y dice qué campo falló.
  [x] Un duplicado o una regla rota responde 409.
  En la presentación: Manden un dato inválido desde su front y muestren que el error aparece en el campo correcto.

6 · Endpoint / controlador (2/2)
  [x] Tengo el CRUD completo de mi recurso principal.
  [x] Cada operación responde con su código: 200, 201, 204 o 404.
  En la presentación: Recorran el CRUD de su recurso principal en /docs, Postman o su front.

7 · Servicio / lógica de negocio (2/2)
  [x] Identifico al menos una regla de negocio propia de mi proyecto.
  [x] La regla está en una función aparte, no revuelta con el manejo de HTTP.
  En la presentación: Expliquen su regla de negocio y muestren el caso en que dice que no (409).

7b · Integraciones externas (5/5)
  [x] Mi API consume al menos un servicio externo.
  [x] La llamada tiene un tiempo máximo de espera (timeout).
  [x] Si el servicio falla o tarda, responde 502 o 504 con un mensaje claro.
  [x] La clave del servicio está en una variable de entorno.
  [x] Puedo explicar en qué caso se usaría SOAP en lugar de REST (por ejemplo, el SAT).
  En la presentación: Muestren la integración funcionando y luego la falla controlada: sin clave (503) o con el servicio caído (502 o 504).

8 · Persistencia (2/2)
  [x] Los datos se guardan en una base de datos y sobreviven al reinicio.
  [x] Todas mis consultas usan parámetros (?), ninguna pega datos al texto del SQL.
  En la presentación: Reinicien la API en vivo y muestren que los datos siguen ahí. Enseñen una de sus consultas con ?.

9 · Respuesta HTTP (2/2)
  [x] Todos mis errores salen en JSON con el mismo formato: {"error": ..., "detalles": [...]}.
  [x] Ningún error muestra trazas, rutas de archivos ni SQL.
  En la presentación: Provoquen dos errores distintos y muestren que ambos llegan con el mismo formato JSON.

Configuración base (3/3)
  [x] Secretos y claves (JWT, IA, base de datos) se leen de variables de entorno, no están escritos en el código.
  [x] En mi repositorio de GitHub no hay ninguna clave.
  [x] Mi README dice qué variables hay que configurar.
  En la presentación: Muestren dónde lee su código las variables de entorno y busquen en vivo en su repositorio que no haya ninguna clave.

Pruebas automáticas (2/2)
  [x] Tengo pruebas automáticas (probar_api.py, una colección de Postman o similar).
  [x] Las pruebas pasan antes de entregar.
  En la presentación: Corran sus pruebas en vivo y comenten el resultado.

Documentación (6/6)
  [x] Mi README explica qué es, cómo correrla en pocos pasos, qué variables configurar y cómo probarla.
  [x] Mi API publica su contrato (OpenAPI en /docs u openapi.yaml).
  [x] Tengo .env.example con las variables de entorno, sin valores secretos.
  [x] Tengo docs/arquitectura.md con el diagrama C4 de contenedores: página, API, base de datos y servicio externo.
  [x] Tengo CHANGELOG.md con lo que trae la versión v1.0.0.
  [x] Recomendado: 2 decisiones explicadas (ADR) en docs/decisiones/ y el catálogo de errores en docs/errores.md.
  En la presentación: Abran su repositorio en GitHub: el README y el diagrama de arquitectura. Con el diagrama expliquen qué parte de su sistema está distribuida y cómo se comunican las piezas.

Timeout e idempotencia (2/2)
  [x] Sé qué operaciones de mi API se pueden repetir sin riesgo y cuáles no.
  [x] Si reintento llamadas externas, solo es ante fallas pasajeras (429, 5xx o timeout).
  En la presentación: Expliquen qué pasaría en su proyecto si el usuario le da doble clic a "Guardar".

Seguridad en capas (1/1)
  [x] Puedo decir qué riesgo del OWASP API Top 10 evita cada capa de mi API.
  En la presentación: Cierren la presentación con la tabla “riesgo → cómo lo evita mi API”.
```

## REST y SOAP en mi proyecto

Si la clínica emitiera facturas fiscales por las consultas médicas (o validara la vigencia de comprobantes CFDI ante el SAT), necesitaría consumir el servicio web del SAT para consultar el estado de un CFDI, el cual utiliza **SOAP** con contrato WSDL. Esta integración viviría como un cliente externo en la capa de servicios (pieza `7b`, junto a `src/services/ia.js`), separado de las rutas HTTP: recibiría los datos de la factura en JSON desde un endpoint REST (por ejemplo, `POST /citas/{id}/validar-factura`), construiría el sobre XML (`soapenv:Envelope` y `soapenv:Body`) con la expresión impresa del CFDI, enviaría un `POST` HTTP con `Content-Type: text/xml`, encabezado `SOAPAction` y un `AbortSignal.timeout` de pocos segundos, y al recibir el XML del SAT extraería únicamente los campos útiles (`Estado` y `EsCancelable`) para devolverlos como JSON limpio (`{"estado": "Vigente", "es_cancelable": "..."}`). Si el servicio del SAT tardara o fallara, respondería `504` o `502` con nuestro formato de error único, de modo que el frontend nunca tendría que lidiar con XML ni con detalles del protocolo SOAP.

## Equipo y reflexiones

<!-- Cada integrante debe escribir su reflexión con sus propias palabras antes de etiquetar v1.0.0. -->

| Integrante | Qué hizo |
|---|---|
| Alberto Vazquez Figueroa       | Ayudé en establecer las reglas de lógica de negocio, desarrollar los endpoints del recurso principal "citas", así como el contrato, realicé pruebas en la base de datos y correcciones en la pull request de mi compañero, implementé el diseño simple del frontend para pruebas con la API, permisos y persistencia de los datos, verifiqué cada función y elementos de cada versión del proyecto. |
| Jesus Eduardo Lazo Mora | Ayudé en la persistencia en SQLite y contrato OpenAPI (/docs y openapi.yaml), autenticación JWT y control de acceso por roles/dueños, integración externa con Gemini (502/503/504), configuración de CORS, reestructura modular del backend y frontend, recursos adicionales (usuarios, pacientes, medicos, consultorios) y una pequeña suite de test. |

**Alberto Vazquez Figueroa:** ¿qué pieza te costó más y por qué? se me complicó implementar cada vez más funciones y características al proyecto, primero debido a que los registros que ya tenía la base de datos en versiones anteriores no nos permitian modificar tanto la base de datos así como no seguían la lógica nueva en cada implementación, también se me dificultó la implementación de JWT, y como actúa con CORS. ¿Qué harías distinto si este proyecto fuera de una empresa? cambiar de SQLite a MySQL o PostgreSQL, la implementación de la nube sería también algo muy importante. Un mejor diseño de la interfaz y mejorar o adaptar a lógica como por ejemplo, un rol de recepcionista o médico también.

**Jesus Eduardo Lazo Mora:** ¿qué pieza te costó más y por qué? me costó más separar las responsabilidades (routes, services, repositories, validators) y evolucionar la base de datos con pacientes, medicos y consultorios sin romper las citas anteriores. ¿Qué harías distinto si este proyecto fuera de una empresa? cambiar SQLite por PostgreSQL con migraciones versionadas para poder correr varias instancias de la API en paralelo. 
