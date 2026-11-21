import { CONFIG } from '../config.js';
import { estaAutenticado, obtenerUsuario, esAdmin, cerrarSesion, suscribirSesion } from '../auth.js';
import { esc } from './alert.js';

const ENLACES = [
  { ruta: '/citas', texto: 'Citas', soloAdmin: false },
  { ruta: '/pacientes', texto: 'Pacientes', soloAdmin: false },
  { ruta: '/medicos', texto: 'Médicos', soloAdmin: false },
  { ruta: '/consultorios', texto: 'Consultorios', soloAdmin: false },
  { ruta: '/usuarios', texto: 'Usuarios', soloAdmin: true },
  { ruta: '/perfil', texto: 'Mi perfil', soloAdmin: false }
];

export function montarNavbar(contenedor, { obtenerRuta }) {
  function pintar(rutaActiva = obtenerRuta()) {
    const autenticado = estaAutenticado();
    const usuario = obtenerUsuario();
    const admin = esAdmin();

    const linksHtml = autenticado
      ? ENLACES
        .filter(item => !item.soloAdmin || admin)
        .map(item => (
          `<a class="nav-link ${rutaActiva === item.ruta ? 'activo' : ''}" href="#${item.ruta}">${esc(item.texto)}</a>`
        ))
        .join('')
      : '';

    const etiquetaUsuario = autenticado
      ? (usuario ? `${usuario.usuario} (${usuario.rol})` : 'sesión iniciada')
      : 'sin sesión';

    contenedor.innerHTML = `
      <div class="navbar-marca">
        <span class="navbar-titulo">${esc(CONFIG.nombre)}</span>
        <span class="navbar-info">API: ${esc(CONFIG.api)} · Origen: ${esc(window.location.origin)}</span>
      </div>
      <nav class="navbar-links" aria-label="Navegación principal">
        ${linksHtml}
      </nav>
      <div class="navbar-sesion">
        <span class="badge-nav">${esc(etiquetaUsuario)}</span>
        ${autenticado ? '<button id="btnSalir" class="btn-nav" type="button">Salir</button>' : ''}
      </div>
    `;

    contenedor.querySelector('#btnSalir')?.addEventListener('click', () => {
      cerrarSesion();
    });
  }

  suscribirSesion(() => pintar(obtenerRuta()));
  pintar();

  return { actualizar: pintar };
}
