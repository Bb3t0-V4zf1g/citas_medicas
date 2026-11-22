import { api, explicarError } from '../api.js';
import {
  guardarToken,
  establecerUsuario,
  cerrarSesion,
  obtenerMotivoSalida,
  limpiarMotivoSalida
} from '../auth.js';
import { esc, mostrarMensaje } from '../components/alert.js';
import { limpiarErroresFormulario, aplicarErroresCampos, conCarga } from '../components/form.js';

export function renderLoginPage(contenedor) {
  const motivo = obtenerMotivoSalida();
  limpiarMotivoSalida();

  let avisoInicial = null;
  if (motivo === 'expirada') {
    avisoInicial = ['aviso', 'Tu sesión expiró o fue revocada. Vuelve a iniciar sesión.'];
  } else if (motivo === 'clave_actualizada') {
    avisoInicial = ['ok', 'Contraseña actualizada. Inicia sesión con tu nueva clave.'];
  }

  contenedor.innerHTML = `
    <div class="login-contenedor">
      <section class="card">
        <h2>Iniciar sesión</h2>
        <p class="subtitulo">Ingresa con tu cuenta de usuario o administrador.</p>
        <form id="formLogin" novalidate>
          <label for="loginUsuario">Usuario</label>
          <input id="loginUsuario" name="usuario" autocomplete="username" placeholder="admin / ana / beto">
          <div class="err-campo" data-error-for="usuario"></div>

          <label for="loginClave">Clave</label>
          <input id="loginClave" name="clave" type="password" autocomplete="current-password" placeholder="••••••••">
          <div class="err-campo" data-error-for="clave"></div>

          <div class="fila-acciones">
            <button id="btnLogin" class="btn" type="submit">Entrar</button>
          </div>
          <div id="msgLogin"></div>
        </form>
      </section>
    </div>
  `;

  const form = contenedor.querySelector('#formLogin');
  const msg = contenedor.querySelector('#msgLogin');
  const btn = contenedor.querySelector('#btnLogin');

  if (avisoInicial) {
    mostrarMensaje(msg, avisoInicial[0], avisoInicial[1]);
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    limpiarErroresFormulario(form);
    mostrarMensaje(msg, '', '');

    const credenciales = {
      usuario: form.usuario.value,
      clave: form.clave.value
    };

    await conCarga(btn, async () => {
      const { codigo, datos } = await api.auth.login(credenciales);
      const token = datos?.access_token;

      if (codigo !== 200 || !token) {
        aplicarErroresCampos(form, datos);
        const [tipo, texto] = explicarError(codigo, datos);
        mostrarMensaje(msg, tipo, codigo === 401 ? 'Usuario o clave incorrectos.' : texto);
        return;
      }

      guardarToken(token, { notificarCambio: false });
      const perfil = await api.usuarios.me();
      if (perfil.codigo === 200 && perfil.datos) {
        establecerUsuario(perfil.datos);
        return;
      }

      cerrarSesion();
      mostrarMensaje(msg, 'mal', `No se pudo validar el perfil de usuario (${esc(perfil.codigo)}).`);
    });
  });
}
