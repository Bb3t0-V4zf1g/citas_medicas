# API de citas médicas

## Instalación

Desde la carpeta del proyecto, ejecuta:

```cmd
npm install
copy .env.example .env
```

Edita `.env` y define un valor largo y aleatorio para `JWT_SECRETO`. La clave
`GEMINI_API_KEY` sólo es necesaria al usar el análisis de comentarios con el
servicio real.

## Migración de la base de datos

No se requiere un comando de migración separado: al iniciar la API se aplican
de forma idempotente los cambios de SQLite. Se crean `pacientes`, `medicos` y
`consultorios`, se agregan a `citas` los identificadores relacionados y las
citas heredadas se vinculan automáticamente con perfiles provisionales cuando
no existían. Se conservan las columnas históricas `medico` y `paciente` para
no romper los clientes actuales.

Para verificar la integridad después de iniciar la API:

```cmd
node -e "const db=require('./database/conexion'); console.log(db.prepare('PRAGMA foreign_key_check').all())"
```

El resultado esperado es `[]`.

## Ejecutar la API y las pruebas

1. En una terminal, inicia la API:

   ```cmd
   npm start
   ```

2. Deja esa terminal abierta. En otra terminal, ejecuta las pruebas de
   compatibilidad:

   ```cmd
   python probar_api.py
   ```

La API estará disponible en `http://localhost:3000` y la colección de citas en `/citas`. El resultado de las pruebas se guarda también en un archivo `reporte_U3S2_<matrícula>.txt`.

Las pruebas automatizadas de usuarios, pacientes, médicos y consultorios no
requieren iniciar un servidor manualmente:

```cmd
npm test
```

## Rutas protegidas y permisos

Todas las rutas siguientes requieren `Authorization: Bearer <token>` obtenido
en `/login`.

| Recurso | Usuario autenticado | Administrador |
| --- | --- | --- |
| `/usuarios/me` | Consulta su cuenta y cambia su propia contraseña | Igual |
| `/usuarios` | Sin acceso | Lista cuentas y modifica rol o estado |
| `/pacientes` | Consulta y actualiza únicamente su perfil | Gestiona todos los perfiles |
| `/medicos` | Consulta | Consulta, crea y actualiza |
| `/consultorios` | Consulta | Consulta, crea y actualiza |

Los listados de usuarios no devuelven hashes de contraseñas. Los perfiles de
paciente se enlazan al usuario autenticado; un usuario normal no puede indicar
ni cambiar `usuario_id`.

Las citas aplican autorización por relación: un administrador accede a todas;
un paciente accede a las relacionadas con su `paciente_id`; y un médico cuya
cuenta esté enlazada a `medicos.usuario_id` accede a sus propias citas. Las
citas heredadas sin perfiles vinculados conservan temporalmente a su
`usuario_id` histórico como respaldo de compatibilidad. Los consultorios no
tienen cuenta propia, por lo que su administración y asignación siguen siendo
responsabilidad del administrador.


## Pruebas de la integración de IA

Para las pruebas 21 a 25 de `probar_api.py`, detén la API con `Ctrl+C` y
arráncala en la misma terminal con el simulador local:

```cmd
set EXTERNO_URL=http://127.0.0.1:9000
npm start
```

Luego, desde otra terminal, ejecuta:

```cmd
python probar_api.py
```

El script controla el simulador durante la ejecución. Para validar el
contrato interactivo, abre `http://localhost:3000/docs`.

## Estructura de la aplicación

La aplicación está organizada por responsabilidades:

- **Backend (`src/` y `server.js`)**:
  - `src/server.js`: punto de entrada que arranca el servidor HTTP con la configuración de entorno.
  - `server.js`: construye y exporta la aplicación Express, inyectando repositorios, servicios, rutas y middlewares.
  - `src/config/`, `src/errors/` y `src/middlewares/`: variables de entorno, `ErrorApi`, trazabilidad (`request_id`), autenticación JWT, autorización por rol y manejo uniforme de errores JSON.
  - `src/validators/`: validación de entrada por recurso (`auth`, `usuarios`, `pacientes`, `medicos`, `consultorios`, `citas` y utilidades comunes).
  - `src/repositories/`: acceso a datos SQLite por recurso.
  - `src/services/`: reglas de negocio, control de acceso por relación, integración con IA (`ia.js`) y operaciones CRUD.
  - `src/routes/`: endpoints HTTP separados por recurso (`auth`, `usuarios`, `pacientes`, `medicos`, `consultorios` y `citas`).
- **Frontend modular (`front/`)**:
  - `front/index.html` y `front/css/`: estructura base y hojas de estilo (`base.css`, `layout.css`, `components.css`).
  - `front/js/api.js`: único punto de llamadas `fetch` hacia la API, traducción de errores HTTP y mapeo de errores por campo.
  - `front/js/auth.js`: manejo de token en `sessionStorage` y estado de sesión.
  - `front/js/router.js` y `front/js/main.js`: enrutamiento por hash con guardas de autenticación y rol de administrador.
  - `front/js/components/` y `front/js/pages/`: componentes reutilizables (navbar, alertas, formularios, tablas, bitácora HTTP) y vistas por recurso (`login`, `citas`, `pacientes`, `medicos`, `consultorios`, `usuarios`, `perfil`).

Para ejecutar el frontend localmente desde `front/`:

```cmd
cd front
python -m http.server 5500
```

Luego abre `http://127.0.0.1:5500`.
