import { CONFIG } from './config.js';

let tokenActual = null;
let usuarioActual = null;
let motivoSalida = '';
const suscriptores = new Set();

try {
  tokenActual = sessionStorage.getItem(CONFIG.claveToken);
} catch {
  tokenActual = null;
}

function notificar() {
  for (const fn of suscriptores) {
    fn({
      autenticado: estaAutenticado(),
      usuario: usuarioActual,
      motivoSalida
    });
  }
}

export function obtenerToken() {
  return tokenActual;
}

export function guardarToken(token, { notificarCambio = true } = {}) {
  tokenActual = token || null;
  motivoSalida = '';
  try {
    if (tokenActual) {
      sessionStorage.setItem(CONFIG.claveToken, tokenActual);
    } else {
      sessionStorage.removeItem(CONFIG.claveToken);
    }
  } catch {
    // sessionStorage puede no estar disponible en contextos restringidos
  }
  if (notificarCambio) {
    notificar();
  }
}

export function obtenerUsuario() {
  return usuarioActual;
}

export function establecerUsuario(usuario, { notificarCambio = true } = {}) {
  usuarioActual = usuario || null;
  if (notificarCambio) {
    notificar();
  }
}

export function estaAutenticado() {
  return Boolean(tokenActual);
}

export function esAdmin() {
  return usuarioActual?.rol === 'admin';
}

export function obtenerMotivoSalida() {
  return motivoSalida;
}

export function limpiarMotivoSalida() {
  motivoSalida = '';
}

export function cerrarSesion(motivo = '') {
  const habiaSesion = Boolean(tokenActual || usuarioActual);
  tokenActual = null;
  usuarioActual = null;
  motivoSalida = motivo;
  try {
    sessionStorage.removeItem(CONFIG.claveToken);
  } catch {
    // ignorar si sessionStorage no está disponible
  }
  if (habiaSesion || motivo) {
    notificar();
  }
}

export function suscribirSesion(fn) {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}
