import { CONFIG } from './config.js';
import { api } from './api.js';
import { estaAutenticado, establecerUsuario, cerrarSesion } from './auth.js';
import { iniciarRouter, obtenerRutaActual } from './router.js';
import { montarNavbar } from './components/navbar.js';
import { montarRegistroActividad } from './components/activityLog.js';

import { renderLoginPage } from './pages/loginPage.js';
import { renderCitasPage } from './pages/citasPage.js';
import { renderPacientesPage } from './pages/pacientesPage.js';
import { renderMedicosPage } from './pages/medicosPage.js';
import { renderConsultoriosPage } from './pages/consultoriosPage.js';
import { renderUsuariosPage } from './pages/usuariosPage.js';
import { renderPerfilPage } from './pages/perfilPage.js';

async function iniciarAplicacion() {
  document.title = CONFIG.nombre;

  const navbarEl = document.querySelector('#app-navbar');
  const vistaEl = document.querySelector('#app-view');
  const logEl = document.querySelector('#app-log');

  montarRegistroActividad(logEl);
  const navbar = montarNavbar(navbarEl, { obtenerRuta: obtenerRutaActual });

  if (estaAutenticado()) {
    const perfil = await api.usuarios.me();
    if (perfil.codigo === 200 && perfil.datos) {
      establecerUsuario(perfil.datos, { notificarCambio: false });
    } else if (perfil.codigo === 401) {
      cerrarSesion('expirada');
    }
  }

  navbar.actualizar(obtenerRutaActual());

  iniciarRouter({
    contenedor: vistaEl,
    onCambio: ruta => navbar.actualizar(ruta),
    rutas: {
      '/login': { requiereAuth: false, soloAdmin: false, render: renderLoginPage },
      '/citas': { requiereAuth: true, soloAdmin: false, render: renderCitasPage },
      '/pacientes': { requiereAuth: true, soloAdmin: false, render: renderPacientesPage },
      '/medicos': { requiereAuth: true, soloAdmin: false, render: renderMedicosPage },
      '/consultorios': { requiereAuth: true, soloAdmin: false, render: renderConsultoriosPage },
      '/usuarios': { requiereAuth: true, soloAdmin: true, render: renderUsuariosPage },
      '/perfil': { requiereAuth: true, soloAdmin: false, render: renderPerfilPage }
    }
  });
}

iniciarAplicacion();
