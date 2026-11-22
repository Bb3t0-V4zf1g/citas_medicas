import { estaAutenticado, esAdmin, suscribirSesion } from './auth.js';

let rutasRegistradas = {};
let contenedorVista = null;
let alCambiarRuta = null;

function normalizarHash(hash) {
  const limpio = (hash || '').replace(/^#/, '');
  if (!limpio) return null;
  return limpio.startsWith('/') ? limpio : `/${limpio}`;
}

export function obtenerRutaActual() {
  return normalizarHash(window.location.hash) || (estaAutenticado() ? '/citas' : '/login');
}

export function navegar(ruta) {
  const destino = `#${ruta}`;
  if (window.location.hash !== destino) {
    window.location.hash = destino;
  } else {
    resolverRuta();
  }
}

function renderizarAccesoDenegado() {
  contenedorVista.innerHTML = `
    <section class="card">
      <h2>Acceso restringido</h2>
      <div class="msg aviso">No cuentas con permisos de administrador para abrir esta sección.</div>
      <div class="fila-acciones">
        <button id="btnVolverInicio" class="btn" type="button">Ir a Citas</button>
      </div>
    </section>
  `;
  contenedorVista.querySelector('#btnVolverInicio')?.addEventListener('click', () => navegar('/citas'));
}

export function resolverRuta() {
  if (!contenedorVista) return;

  const rutaSolicitada = obtenerRutaActual();
  const definicion = rutasRegistradas[rutaSolicitada];

  if (!definicion) {
    navegar(estaAutenticado() ? '/citas' : '/login');
    return;
  }

  if (definicion.requiereAuth && !estaAutenticado()) {
    navegar('/login');
    return;
  }

  if (rutaSolicitada === '/login' && estaAutenticado()) {
    navegar('/citas');
    return;
  }

  if (definicion.soloAdmin && !esAdmin()) {
    renderizarAccesoDenegado();
    if (alCambiarRuta) alCambiarRuta(rutaSolicitada);
    return;
  }

  if (alCambiarRuta) alCambiarRuta(rutaSolicitada);
  definicion.render(contenedorVista, { navegar });
}

export function iniciarRouter({ contenedor, rutas, onCambio }) {
  contenedorVista = contenedor;
  rutasRegistradas = rutas;
  alCambiarRuta = onCambio || null;

  window.addEventListener('hashchange', resolverRuta);
  suscribirSesion(() => resolverRuta());

  resolverRuta();
}
