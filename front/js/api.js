import { CONFIG } from './config.js';
import { obtenerToken, cerrarSesion } from './auth.js';

const suscriptoresRegistro = new Set();

function emitirRegistro(linea) {
  const marca = new Date().toLocaleTimeString();
  const entrada = `${marca}  ${linea}`;
  for (const fn of suscriptoresRegistro) {
    fn(entrada);
  }
}

export function suscribirRegistro(fn) {
  suscriptoresRegistro.add(fn);
  return () => suscriptoresRegistro.delete(fn);
}

export async function pedir(metodo, ruta, cuerpo) {
  const headers = { Accept: 'application/json' };
  const token = obtenerToken();

  if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const t0 = performance.now();
  let respuesta;

  try {
    respuesta = await fetch(`${CONFIG.api}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
  } catch {
    emitirRegistro(`${metodo} ${ruta} → sin respuesta (¿API apagada? ¿CORS?)`);
    return { codigo: 0, datos: null };
  }

  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = { error: texto.slice(0, 200) };
  }

  const duracion = Math.round(performance.now() - t0);
  emitirRegistro(`${metodo} ${ruta} → ${respuesta.status} (${duracion} ms)`);

  if (respuesta.status === 401 && ruta !== '/login') {
    cerrarSesion('expirada');
  }

  return { codigo: respuesta.status, datos };
}

export function explicarError(codigo, datos) {
  const textoError = (datos && (datos.error || datos.message || datos.detail)) || '';
  const detalle = Array.isArray(datos?.detalles) && datos.detalles.length
    ? datos.detalles.join(' · ')
    : '';
  const mensaje = typeof textoError === 'string' ? textoError : '';

  if (codigo === 0) {
    return ['mal', 'No se pudo conectar con la API. Verifica que esté corriendo y con CORS habilitado.'];
  }
  if (codigo === 401) {
    return ['aviso', mensaje || 'Tu sesión no es válida o expiró. Inicia sesión de nuevo.'];
  }
  if (codigo === 403) {
    return ['aviso', detalle || mensaje || 'Tu usuario no tiene permiso para realizar esta acción.'];
  }
  if (codigo === 404) {
    return ['aviso', detalle || mensaje || 'El recurso solicitado no existe.'];
  }
  if (codigo === 409) {
    return ['aviso', detalle ? `${mensaje}: ${detalle}` : (mensaje || 'Conflicto con datos existentes.')];
  }
  if (codigo === 422 || codigo === 400) {
    return ['aviso', detalle ? `${mensaje}: ${detalle}` : (mensaje || 'Revisa los campos marcados.')];
  }
  if (codigo === 502 || codigo === 503 || codigo === 504) {
    return ['aviso', `${mensaje || 'El servicio externo no respondió.'} Intenta en un momento.`];
  }
  if (codigo >= 500) {
    return ['mal', `Error interno de la API (${codigo}).`];
  }
  return ['ok', mensaje];
}

export function erroresPorCampo(datos) {
  const mapa = {};
  if (!datos) return mapa;

  const detalles = Array.isArray(datos.detalles) ? datos.detalles : [];
  for (const item of detalles) {
    const texto = String(item);
    const idx = texto.indexOf(':');
    if (idx > 0) {
      const clave = texto.slice(0, idx).trim().split('.').pop();
      mapa[clave] = texto.slice(idx + 1).trim();
      continue;
    }
    const coincidencia = /^El campo ([a-zA-Z0-9_]+) es obligatorio/.exec(texto);
    if (coincidencia) {
      mapa[coincidencia[1]] = texto;
    }
  }

  if (Array.isArray(datos.detail)) {
    for (const d of datos.detail) {
      if (d.loc) mapa[String(d.loc[d.loc.length - 1])] = d.msg;
    }
  }

  if (Array.isArray(datos.errors)) {
    for (const d of datos.errors) {
      const clave = d.path || d.param || d.field;
      if (clave) mapa[clave] = d.msg || d.message;
    }
  }

  return mapa;
}

export const api = {
  auth: {
    login: credenciales => pedir('POST', '/login', credenciales)
  },
  usuarios: {
    me: () => pedir('GET', '/usuarios/me'),
    cambiarClave: cuerpo => pedir('PATCH', '/usuarios/me', cuerpo),
    listar: () => pedir('GET', '/usuarios'),
    actualizar: (usuario, cuerpo) => pedir('PATCH', `/usuarios/${encodeURIComponent(usuario)}`, cuerpo)
  },
  pacientes: {
    me: () => pedir('GET', '/pacientes/me'),
    listar: () => pedir('GET', '/pacientes'),
    obtener: id => pedir('GET', `/pacientes/${encodeURIComponent(id)}`),
    crear: cuerpo => pedir('POST', '/pacientes', cuerpo),
    actualizar: (id, cuerpo) => pedir('PATCH', `/pacientes/${encodeURIComponent(id)}`, cuerpo)
  },
  medicos: {
    listar: () => pedir('GET', '/medicos'),
    obtener: id => pedir('GET', `/medicos/${encodeURIComponent(id)}`),
    crear: cuerpo => pedir('POST', '/medicos', cuerpo),
    actualizar: (id, cuerpo) => pedir('PATCH', `/medicos/${encodeURIComponent(id)}`, cuerpo)
  },
  consultorios: {
    listar: () => pedir('GET', '/consultorios'),
    obtener: id => pedir('GET', `/consultorios/${encodeURIComponent(id)}`),
    crear: cuerpo => pedir('POST', '/consultorios', cuerpo),
    actualizar: (id, cuerpo) => pedir('PATCH', `/consultorios/${encodeURIComponent(id)}`, cuerpo)
  },
  citas: {
    listar: () => pedir('GET', '/citas'),
    obtener: id => pedir('GET', `/citas/${encodeURIComponent(id)}`),
    crear: cuerpo => pedir('POST', '/citas', cuerpo),
    actualizar: (id, cuerpo) => pedir('PUT', `/citas/${encodeURIComponent(id)}`, cuerpo),
    eliminar: id => pedir('DELETE', `/citas/${encodeURIComponent(id)}`),
    analizarComentario: comentario => pedir('POST', '/citas/comentario', { comentario })
  }
};
