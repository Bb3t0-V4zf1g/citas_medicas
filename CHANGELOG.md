# Changelog

Todos los cambios importantes de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-23

### Agregado

- CRUD completo de citas médicas (`/citas`, `/citas/{id}`, `/citas/opciones`) con validación por campo (`422`), selección obligatoria de médicos y pacientes existentes, horarios en intervalos de 30 minutos, detección de traslape de horarios por médico (`409`) y formato único de error en JSON.
- Recursos complementarios protegidos para cuentas (`/usuarios`, `POST /usuarios`, `/usuarios/me`), perfiles de pacientes (`/pacientes`, `/pacientes/me`), médicos (`/medicos`) y consultorios (`/consultorios`).
- Autenticación con `POST /login`, contraseñas con hash `bcryptjs` (factor de costo 12) y tokens JWT (`HS256`, vigencia de 30 minutos) con revocación mediante `token_version`.
- Control de acceso por roles (`admin` y `usuario`, con `403` ante acciones restringidas) y por relación en citas: los pacientes solo consultan sus citas, los médicos agendan y editan/completan solo las propias (`404` si es ajena, `403` si intentan agendar para otro médico o borrar una cita del administrador).
- Persistencia en SQLite (`node:sqlite`) con consultas parametrizadas (`?`), llaves foráneas activas y migración idempotente al arrancar.
- Integración externa con Gemini (`POST /citas/comentario`) para analizar sentimiento y resumen de comentarios de pacientes, con timeout de 5 segundos, reintento ante fallas `5xx` y respuestas controladas (`502`, `503`, `504`).
- Contrato OpenAPI 3.0.3 en `openapi.yaml` servido en `/openapi.yaml` y vista interactiva en `/docs`.
- Frontend modular en `front/` con bitácora HTTP y política CORS configurada por lista de orígenes (`CORS_ORIGENES`).
- Pruebas automáticas de extremo a extremo (`probar_api.py`, 28 pruebas) y suite de pruebas de integración en Node (`npm test`).

### Pendiente

- Migrar SQLite a un motor cliente-servidor (por ejemplo, PostgreSQL) si se despliegan múltiples instancias de la API en paralelo.
- Agregar soporte de llave de idempotencia (`Idempotency-Key`) en `POST /citas` y limitación de peticiones (rate limiting) en `/login`.
- Integrar envío real de notificaciones y un adaptador SOAP para consulta/validación de facturas ante el SAT.
