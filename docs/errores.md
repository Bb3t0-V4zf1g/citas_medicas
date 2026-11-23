# Catálogo de errores

Todos los errores responden en JSON con la misma estructura base (`error` y `detalles`). La mayoría de las respuestas manejadas por el middleware central incluyen además `codigo` y `request_id` para trazabilidad:

```json
{
  "error": "Mensaje para el usuario",
  "codigo": "CODIGO_OPCIONAL",
  "detalles": ["detalle por campo, si aplica"],
  "request_id": "uuid-de-la-solicitud"
}
```

| Código | Cuándo | Ejemplo de mensaje |
|---|---|---|
| `400` | El cuerpo de la petición trae un JSON mal formado | `"JSON inválido"` (`INVALID_JSON`) |
| `401` | Falta el encabezado `Authorization: Bearer`, las credenciales son incorrectas, el token expiró/fue alterado o la sesión fue revocada | `"No autorizado"` / `"Credenciales incorrectas"` / `"Token inválido"` (`TOKEN_REVOKED`) |
| `403` | El usuario tiene sesión válida, pero su rol no puede ejecutar la acción (rutas exclusivas de `admin`) o intenta acceder al perfil de otro paciente | `"No permitido"` (`FORBIDDEN`) |
| `404` | La ruta no existe, el recurso no existe o la cita solicitada no pertenece al usuario autenticado | `"Cita no encontrada"` / `"Ruta no encontrada"` (`NOT_FOUND`) |
| `409` | Choque con una regla de negocio o unicidad: médico con cita `Pendiente` traslapada, usuario que ya tiene perfil de paciente o valor repetido (`UNIQUE`) | `"Conflicto de horario"` / `"Conflicto de datos"` (`DATA_CONFLICT`) |
| `413` | El cuerpo JSON supera el límite permitido de 100 KB | `"Solicitud demasiado grande"` (`PAYLOAD_TOO_LARGE`) |
| `422` | El JSON está bien formado, pero faltan campos obligatorios o los valores no cumplen tipo, formato o rango | `"Entidad no procesable"` / `"Datos inválidos"` + detalle por cada campo |
| `500` | Falla inesperada dentro del servidor (no expone rutas internas, SQL ni stack trace) | `"Error interno del servidor"` (`INTERNAL_ERROR`) |
| `502` | Fallo de red con Gemini, código de error HTTP de Gemini o respuesta JSON inválida/inesperada | `"La IA no está disponible (respondió 500). Intenta más tarde."` / `"La IA respondió algo que no entendemos."` |
| `503` | Se llama al análisis con la API real de Gemini sin configurar `GEMINI_API_KEY` | `"Falta configurar la variable de entorno GEMINI_API_KEY"` |
| `504` | Gemini no respondió dentro del tiempo máximo de espera (5 segundos) | `"La IA tardó demasiado en responder. Intenta en un momento."` |
