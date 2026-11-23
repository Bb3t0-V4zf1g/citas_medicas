# 1. Usar JWT con versión de token para la autenticación

- **Fecha:** 2026-11-10
- **Estado:** Aceptada

## Contexto

La API necesita identificar quién hace cada petición para aplicar reglas de rol (`admin` frente a `usuario`) y de relación con las citas (paciente o médico). HTTP no conserva estado entre peticiones; las alternativas eran guardar sesiones en memoria del servidor o emitir un token firmado que el cliente envíe en cada llamada. Además, necesitábamos poder invalidar sesiones activas si un usuario cambia su contraseña o si un administrador cambia su rol o desactiva su cuenta.

## Decisión

Usamos un token JWT firmado con `HS256` que incluye `sub` (usuario), `rol` y `ver` (`token_version`), con vigencia de 30 minutos y validación explícita de `issuer` (`citas-medicas-api`) y `audience` (`citas-medicas-cliente`). El secreto se lee exclusivamente desde la variable de entorno `JWT_SECRETO`, y las contraseñas se almacenan con `bcryptjs` (factor de costo 12). Al cambiar contraseña, rol o estado de una cuenta, se incrementa `token_version` en SQLite para revocar tokens previos.

## Consecuencias

- La API no guarda sesiones en memoria y las contraseñas nunca se almacenan ni devuelven en texto plano.
- El contenido del token es legible (está firmado, no cifrado), por lo que no se incluye información sensible dentro del payload.
- Verificar `token_version` y `activo` en cada petición agrega una consulta ligera a SQLite, pero evita que un token siga siendo válido tras un cambio de contraseña o baja de usuario.
- La API exige `JWT_SECRETO` al arrancar: si falta, falla rápido en lugar de operar con un secreto inseguro por omisión.
