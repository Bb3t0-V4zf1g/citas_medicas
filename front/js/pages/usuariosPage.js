import { api, explicarError } from '../api.js';
import { esc, mostrarMensaje } from '../components/alert.js';
import { renderizarTabla } from '../components/table.js';

export function renderUsuariosPage(contenedor) {
  contenedor.innerHTML = `
    <section class="card ancho">
      <div class="fila-cabecera">
        <h2>Administración de usuarios <span class="subtitulo">GET /usuarios · PATCH /usuarios/:usuario</span></h2>
        <button id="btnRecargarUsuarios" class="btn btn-secundario" type="button">Recargar</button>
      </div>
      <div id="msgUsuarios"></div>
      <div id="tablaUsuarios" class="tabla"></div>
    </section>
  `;

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

  btnRecargar.addEventListener('click', cargarUsuarios);
  cargarUsuarios();
}
