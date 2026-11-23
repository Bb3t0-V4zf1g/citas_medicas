import { api, explicarError } from '../api.js';
import { esc, mostrarMensaje } from '../components/alert.js';
import {
  limpiarErroresFormulario,
  aplicarErroresCampos,
  conCarga
} from '../components/form.js';
import { renderizarTabla } from '../components/table.js';

export function renderUsuariosPage(contenedor) {
  contenedor.innerHTML = `
    <div class="grid-2">
      <section class="card">
        <h2>Nuevo usuario <span class="subtitulo">POST /usuarios</span></h2>
        <form id="formNuevoUsuario" novalidate>
          <label for="usuNombre">Nombre de usuario</label>
          <input id="usuNombre" name="usuario" placeholder="dra.elena" autocomplete="off">
          <div class="err-campo" data-error-for="usuario"></div>

          <label for="usuClave">Contraseña inicial (mínimo 8 caracteres)</label>
          <input id="usuClave" name="clave" type="password" placeholder="••••••••" autocomplete="new-password">
          <div class="err-campo" data-error-for="clave"></div>

          <label for="usuRol">Rol</label>
          <select id="usuRol" name="rol">
            <option value="usuario">usuario (médico o paciente)</option>
            <option value="admin">admin</option>
          </select>
          <div class="err-campo" data-error-for="rol"></div>

          <div class="fila-acciones">
            <button id="btnCrearUsuario" class="btn" type="submit">Crear usuario</button>
          </div>
          <div id="msgNuevoUsuario"></div>
        </form>
      </section>

      <section class="card">
        <div class="fila-cabecera">
          <h2>Administración de usuarios <span class="subtitulo">GET /usuarios · PATCH /usuarios/:usuario</span></h2>
          <button id="btnRecargarUsuarios" class="btn btn-secundario" type="button">Recargar</button>
        </div>
        <div id="msgUsuarios"></div>
        <div id="tablaUsuarios" class="tabla"></div>
      </section>
    </div>
  `;

  const form = contenedor.querySelector('#formNuevoUsuario');
  const btnCrear = contenedor.querySelector('#btnCrearUsuario');
  const msgNuevo = contenedor.querySelector('#msgNuevoUsuario');
  const msg = contenedor.querySelector('#msgUsuarios');
  const tabla = contenedor.querySelector('#tablaUsuarios');
  const btnRecargar = contenedor.querySelector('#btnRecargarUsuarios');

  async function guardarUsuario(fila) {
    mostrarMensaje(msg, '', '');
    const selectRol = tabla.querySelector(`select[data-rol="${CSS.escape(fila.usuario)}"]`);
    const selectActivo = tabla.querySelector(`select[data-activo="${CSS.escape(fila.usuario)}"]`);

    const { codigo, datos } = await api.usuarios.actualizar(fila.usuario, {
      rol: selectRol.value,
      activo: selectActivo.value === '1'
    });

    if (codigo === 200) {
      mostrarMensaje(msg, 'ok', `Cuenta "${fila.usuario}" actualizada.`);
      await cargarUsuarios();
      return;
    }

    const [tipo, texto] = explicarError(codigo, datos);
    mostrarMensaje(msg, tipo, texto);
  }

  async function cargarUsuarios() {
    tabla.innerHTML = '<span class="rueda"></span>Cargando usuarios…';
    const { codigo, datos } = await api.usuarios.listar();

    if (codigo !== 200 || !Array.isArray(datos)) {
      const [tipo, texto] = explicarError(codigo, datos);
      tabla.innerHTML = '';
      mostrarMensaje(msg, tipo, texto);
      return;
    }

    renderizarTabla({
      contenedor: tabla,
      filas: datos,
      vacio: 'No hay cuentas registradas.',
      columnas: [
        { clave: 'usuario', titulo: 'Usuario' },
        {
          clave: 'rol',
          titulo: 'Rol',
          render: (rol, fila) => `
            <select data-rol="${esc(fila.usuario)}" aria-label="Rol de ${esc(fila.usuario)}">
              <option value="usuario" ${rol === 'usuario' ? 'selected' : ''}>usuario</option>
              <option value="admin" ${rol === 'admin' ? 'selected' : ''}>admin</option>
            </select>
          `
        },
        {
          clave: 'activo',
          titulo: 'Estado',
          render: (activo, fila) => `
            <select data-activo="${esc(fila.usuario)}" aria-label="Estado de ${esc(fila.usuario)}">
              <option value="1" ${Number(activo) === 1 ? 'selected' : ''}>Activo</option>
              <option value="0" ${Number(activo) === 0 ? 'selected' : ''}>Inactivo</option>
            </select>
          `
        }
      ],
      acciones: fila => [
        { etiqueta: 'Guardar', clase: 'btn-secundario', onClick: () => guardarUsuario(fila) }
      ]
    });
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    limpiarErroresFormulario(form);
    mostrarMensaje(msgNuevo, '', '');

    const payload = {
      usuario: form.usuario.value.trim(),
      clave: form.clave.value,
      rol: form.rol.value
    };

    await conCarga(btnCrear, async () => {
      const { codigo, datos } = await api.usuarios.crear(payload);
      if (codigo === 201) {
        mostrarMensaje(msgNuevo, 'ok', `Usuario "${datos.usuario}" creado.`);
        form.reset();
        await cargarUsuarios();
        return;
      }

      aplicarErroresCampos(form, datos);
      const [tipo, texto] = explicarError(codigo, datos);
      mostrarMensaje(msgNuevo, tipo, texto);
    });
  });

  btnRecargar.addEventListener('click', cargarUsuarios);
  cargarUsuarios();
}
