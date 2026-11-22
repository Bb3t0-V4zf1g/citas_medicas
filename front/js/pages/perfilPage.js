import { api, explicarError } from '../api.js';
import { cerrarSesion } from '../auth.js';
import { esc, mostrarMensaje } from '../components/alert.js';
import { limpiarErroresFormulario, aplicarErroresCampos, conCarga } from '../components/form.js';

export function renderPerfilPage(contenedor, { navegar }) {
  contenedor.innerHTML = `
    <div class="grid-2">
      <section class="card">
        <h2>Mi cuenta <span class="subtitulo">GET /usuarios/me · GET /pacientes/me</span></h2>
        <div id="datosPerfil"><span class="rueda"></span>Cargando perfil…</div>
      </section>

      <section class="card">
        <h2>Cambiar contraseña <span class="subtitulo">PATCH /usuarios/me</span></h2>
        <form id="formClave" novalidate>
          <label for="claveActual">Contraseña actual</label>
          <input id="claveActual" name="clave_actual" type="password" autocomplete="current-password">
          <div class="err-campo" data-error-for="clave_actual"></div>

          <label for="nuevaClave">Nueva contraseña (mínimo 8 caracteres)</label>
          <input id="nuevaClave" name="nueva_clave" type="password" autocomplete="new-password">
          <div class="err-campo" data-error-for="nueva_clave"></div>

          <div class="fila-acciones">
            <button id="btnCambiarClave" class="btn" type="submit">Actualizar contraseña</button>
          </div>
          <div id="msgClave"></div>
        </form>
      </section>
    </div>
  `;

  const datosPerfil = contenedor.querySelector('#datosPerfil');
  const form = contenedor.querySelector('#formClave');
  const btn = contenedor.querySelector('#btnCambiarClave');
  const msg = contenedor.querySelector('#msgClave');

  async function cargarPerfil() {
    const [cuentaResp, pacienteResp] = await Promise.all([
      api.usuarios.me(),
      api.pacientes.me()
    ]);

    if (cuentaResp.codigo !== 200 || !cuentaResp.datos) {
      const [tipo, texto] = explicarError(cuentaResp.codigo, cuentaResp.datos);
      mostrarMensaje(datosPerfil, tipo, texto);
      return;
    }

    const cuenta = cuentaResp.datos;
    let bloquePaciente = '<p class="subtitulo" style="margin-top:12px">Aún no tienes un perfil de paciente vinculado.</p>';

    if (pacienteResp.codigo === 200 && pacienteResp.datos) {
      const p = pacienteResp.datos;
      bloquePaciente = `
        <h3 style="margin-top:14px;margin-bottom:8px;font-size:15px">Perfil de paciente</h3>
        <dl class="datos-lista">
          <dt>Nombre</dt><dd>${esc(p.nombre)}</dd>
          <dt>Teléfono</dt><dd>${esc(p.telefono ?? '—')}</dd>
          <dt>Correo</dt><dd>${esc(p.correo ?? '—')}</dd>
          <dt>Nacimiento</dt><dd>${esc(p.fecha_nacimiento ?? '—')}</dd>
        </dl>
      `;
    } else if (pacienteResp.codigo === 404) {
      bloquePaciente += '<div class="fila-acciones"><button id="btnIrPacientes" class="btn btn-chico btn-secundario" type="button">Crear perfil de paciente</button></div>';
    }

    datosPerfil.innerHTML = `
      <dl class="datos-lista">
        <dt>Usuario</dt><dd>${esc(cuenta.usuario)}</dd>
        <dt>Rol</dt><dd><span class="badge">${esc(cuenta.rol)}</span></dd>
        <dt>Estado</dt><dd>${Number(cuenta.activo) === 1 ? 'Activo' : 'Inactivo'}</dd>
      </dl>
      ${bloquePaciente}
    `;

    datosPerfil.querySelector('#btnIrPacientes')?.addEventListener('click', () => navegar('/pacientes'));
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    limpiarErroresFormulario(form);
    mostrarMensaje(msg, '', '');

    await conCarga(btn, async () => {
      const { codigo, datos } = await api.usuarios.cambiarClave({
        clave_actual: form.clave_actual.value,
        nueva_clave: form.nueva_clave.value
      });

      if (codigo === 204) {
        cerrarSesion('clave_actualizada');
        return;
      }

      aplicarErroresCampos(form, datos);
      const [tipo, texto] = explicarError(codigo, datos);
      mostrarMensaje(msg, tipo, texto);
    });
  });

  cargarPerfil();
}
