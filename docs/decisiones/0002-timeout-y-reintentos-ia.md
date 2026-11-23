# 2. Tiempo máximo, reintento selectivo y validación al llamar a la IA

- **Fecha:** 2026-11-12
- **Estado:** Aceptada

## Contexto

El endpoint `POST /citas/comentario` depende de Gemini (un servicio externo) para clasificar el sentimiento de un comentario del paciente y generar un resumen breve. Como cualquier servicio de red externo, Gemini puede tardar demasiado, devolver errores temporales (`5xx`), caerse o regresar texto que no cumple el formato JSON esperado. Sin límites ni validación, una falla externa podría bloquear peticiones de nuestra API o provocar errores `500`.

## Decisión

Encapsulamos la llamada en `src/services/ia.js` con un tiempo máximo de 5 segundos por intento (`AbortSignal.timeout(5000)`). Si la clave `GEMINI_API_KEY` falta al apuntar a `googleapis.com`, respondemos `503`. Ante un error `5xx` del servicio externo, se reintenta una vez (hasta 2 intentos en total); ante un `4xx` no se reintenta porque el error no es pasajero. Si excede el tiempo máximo se responde `504`, y si falla la conexión o la respuesta no trae `sentimiento` válido (`positivo`, `neutral` o `negativo`) y `resumen` de texto no vacío, se responde `502`.

## Consecuencias

- Ninguna petición queda colgada indefinidamente: ante lentitud o caída de Gemini, la API responde rápido con `504` o `502` y un mensaje claro para el front.
- El resto de los endpoints (login, citas, pacientes, médicos y consultorios) siguen funcionando con normalidad aunque Gemini esté caído o sin configurar.
- Reintentar ante `5xx` es seguro porque analizar un comentario es una operación sin efectos secundarios en la base de datos ni en el servicio externo.
- Si Gemini está temporalmente indisponible, el comentario no se clasifica y el usuario deberá volver a intentarlo más tarde.
