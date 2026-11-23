import { api, explicarError } from '../api.js';
import { esAdmin } from '../auth.js';
import { esc, mostrarMensaje } from '../components/alert.js';
import {
  limpiarErroresFormulario,
  aplicarErroresCampos,
  conCarga,
  omitirVacios
} from '../components/form.js';
import { renderizarTabla } from '../components/table.js';

const OPCION_CREAR_USUARIO = '__crear__';

export function renderPacientesPage(contenedor) {
  const admin = esAdmin();
  let pacienteEditando = null;
  let usuariosDisponibles = [];

  contenedor.innerHTML = `
    <div class="grid-2">
      <section class="card">
        <h2 id="tituloFormPaciente">Nuevo perfil de paciente · POST /pacientes</h2>
        <form id="formPaciente" novalidate>
          <label for="pacNombre">Nombre completo</label>
          <input id="pacNombre" name="nombre" placeholder="María López Pérez">
          <div class="err-campo" data-error-for="nombre"></div>

          <label for="pacTelefono">Teléfono (opcional)</label>
          <input id="pacTelefono" name="telefono" placeholder="3121234567">
          <div class="err-campo" data-error-for="telefono"></div>

          <label for="pacCorreo">Correo (opcional)</label>
          <input id="pacCorreo" name="correo" type="email" placeholder="maria@correo.com">
          <div class="err-campo" data-error-for="correo"></div>

          <label for="pacNacimiento">Fecha de nacimiento (opcional)</label>
          <input id="pacNacimiento" name="fecha_nacimiento" type="date">
          <div class="err-campo" data-error-for="fecha_nacimiento"></div>

          <div id="grupoUsuarioPaciente" class="${admin ? '' : 'oculto'}">
            <label for="pacUsuarioId">Cuenta de usuario (solo admin, opcional)</label>
            <select id="pacUsuarioId" name="usuario_id">
              <option value="">Sin cuenta vinculada</option>
              <option value="${OPCION_CREAR_USUARIO}">+ Crear nueva cuenta para este paciente</option>
            </select>
            <div class="err-campo" data-error-for="usuario_id"></div>

            <div id="bloqueNuevoUsuarioPaciente" class="oculto">
              <label for="pacNuevoUsuario">Usuario nuevo</label>
              <input id="pacNuevoUsuario" name="usuario" placeholder="maria.lopez" autocomplete="off">
              <div class="err-campo" data-error-for="usuario"></div>

              <label for="pacNuevaClave">Contraseña (mínimo 8 caracteres)</label>
              <input id="pacNuevaClave" name="clave" type="password" placeholder="••••••••" autocomplete="new-password">
              <div class="err-campo" data-error-for="clave"></div>
            </div>
          </div>

          <div class="fila-acciones">
            <button id="btnGuardarPaciente" class="btn" type="submit">Guardar</button>
            <button id="btnCancelarPaciente" class="btn btn-secundario oculto" type="button">Cancelar</button>
          </div>
          <div id="msgPaciente"></div>
        </form>
      </section>

      <section class="card">
        <div class="fila-cabecera">
          <h2>Pacientes <span class="subtitulo">GET /pacientes</span></h2>
          <button id="btnRecargarPacientes" class="btn btn-secundario" type="button">Recargar</button>
        </div>
        <div id="msgListaPacientes"></div>
        <div id="tablaPacientes" class="tabla"></div>
      </section>
    </div>
  `;

  const titulo = contenedor.querySelector('#tituloFormPaciente');
  const form = contenedor.querySelector('#formPaciente');
  const selectUsuario = contenedor.querySelector('#pacUsuarioId');
  const bloqueNuevoUsuario = contenedor.querySelector('#bloqueNuevoUsuarioPaciente');
  const btnGuardar = contenedor.querySelector('#btnGuardarPaciente');
  const btnCancelar = contenedor.querySelector('#btnCancelarPaciente');
  const msgForm = contenedor.querySelector('#msgPaciente');
  const msgLista = contenedor.querySelector('#msgListaPacientes');
  const tabla = contenedor.querySelector('#tablaPacientes');
  const btnRecargar = contenedor.querySelector('#btnRecargarPacientes');

  function actualizarVisibilidadNuevoUsuario() {
    if (!bloqueNuevoUsuario || !selectUsuario) return;
    const creandoNuevo = selectUsuario.value === OPCION_CREAR_USUARIO;
    bloqueNuevoUsuario.classList.toggle('oculto', !creandoNuevo);
  }

  function renderizarOpcionesUsuario(seleccionActual = '') {
    if (!admin || !selectUsuario) return;
    const opciones = [
      '<option value="">Sin cuenta vinculada</option>',
      ...usuariosDisponibles.map(u => (
        `<option value="${esc(u.usuario)}">${esc(u.usuario)} (${esc(u.rol)})</option>`
      )),
      `<option value="${OPCION_CREAR_USUARIO}">+ Crear nueva cuenta para este paciente</option>`
    ];
    selectUsuario.innerHTML = opciones.join('');
    if (seleccionActual) {
      selectUsuario.value = seleccionActual;
    }
    actualizarVisibilidadNuevoUsuario();
  }

  async function cargarUsuariosSelect(seleccionActual = '') {
    if (!admin || !selectUsuario) return;
    const { codigo, datos } = await api.usuarios.listar();
    if (codigo === 200 && Array.isArray(datos)) {
      usuariosDisponibles = datos;
    }
    renderizarOpcionesUsuario(seleccionActual);
  }

  function reiniciarFormulario() {
    pacienteEditando = null;
    form.reset();
    limpiarErroresFormulario(form);
    renderizarOpcionesUsuario('');
    titulo.textContent = 'Nuevo perfil de paciente · POST /pacientes';
    btnGuardar.textContent = 'Guardar';
    btnCancelar.classList.add('oculto');
  }

  function cargarParaEditar(paciente) {
    pacienteEditando = paciente;
    limpiarErroresFormulario(form);
    mostrarMensaje(msgForm, '', '');
    form.nombre.value = paciente.nombre || '';
    form.telefono.value = paciente.telefono || '';
    form.correo.value = paciente.correo || '';
    form.fecha_nacimiento.value = paciente.fecha_nacimiento || '';
    renderizarOpcionesUsuario(paciente.usuario_id || '');
    titulo.textContent = `Editar paciente #${paciente.id} · PATCH /pacientes/${paciente.id}`;
    btnGuardar.textContent = 'Actualizar';
    btnCancelar.classList.remove('oculto');
    form.nombre.focus();
  }

  async function cargarPacientes() {
    tabla.innerHTML = '<span class="rueda"></span>Cargando pacientes…';
    const { codigo, datos } = await api.pacientes.listar();

    if (codigo !== 200 || !Array.isArray(datos)) {
      const [tipo, texto] = explicarError(codigo, datos);
      tabla.innerHTML = '';
      mostrarMensaje(msgLista, tipo, texto);
      return;
    }

    renderizarTabla({
      contenedor: tabla,
      filas: datos,
      vacio: 'No hay perfiles de paciente visibles.',
      columnas: [
        { clave: 'id', titulo: 'ID' },
        { clave: 'nombre', titulo: 'Nombre' },
        { clave: 'usuario_id', titulo: 'Usuario' },
        { clave: 'telefono', titulo: 'Teléfono' },
        { clave: 'correo', titulo: 'Correo' },
        { clave: 'fecha_nacimiento', titulo: 'Nacimiento' }
      ],
      acciones: fila => [
        { etiqueta: 'Editar', clase: 'btn-secundario', onClick: () => cargarParaEditar(fila) }
      ]
    });
  }

  if (selectUsuario) {
    selectUsuario.addEventListener('change', actualizarVisibilidadNuevoUsuario);
  }

  btnCancelar.addEventListener('click', () => {
    reiniciarFormulario();
    mostrarMensaje(msgForm, '', '');
  });

  btnRecargar.addEventListener('click', () => {
    cargarPacientes();
    cargarUsuariosSelect(selectUsuario ? selectUsuario.value : '');
  });

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    limpiarErroresFormulario(form);
    mostrarMensaje(msgForm, '', '');

    const editando = pacienteEditando !== null;
    const payload = omitirVacios({
      nombre: form.nombre.value,
      telefono: form.telefono.value,
      correo: form.correo.value,
      fecha_nacimiento: form.fecha_nacimiento.value
    });

    const seleccionUsuario = admin && selectUsuario ? selectUsuario.value : '';

    await conCarga(btnGuardar, async () => {
      if (admin) {
        if (seleccionUsuario === OPCION_CREAR_USUARIO) {
          const nuevoUsuario = form.usuario.value.trim();
          const nuevaClave = form.clave.value;
          const respUsuario = await api.usuarios.crear({
            usuario: nuevoUsuario,
            clave: nuevaClave,
            rol: 'usuario'
          });
          if (respUsuario.codigo !== 201) {
            aplicarErroresCampos(form, respUsuario.datos);
            const [tipo, texto] = explicarError(respUsuario.codigo, respUsuario.datos);
            mostrarMensaje(msgForm, tipo, texto);
            return;
          }
          payload.usuario_id = respUsuario.datos.usuario;
        } else if (seleccionUsuario) {
          payload.usuario_id = seleccionUsuario;
        } else if (!editando || pacienteEditando.usuario_id) {
          payload.usuario_id = null;
        }
      }

      const { codigo, datos } = editando
        ? await api.pacientes.actualizar(pacienteEditando.id, payload)
        : await api.pacientes.crear(payload);

      if (codigo === 201 || codigo === 200) {
        mostrarMensaje(msgForm, 'ok', editando ? 'Perfil actualizado.' : 'Perfil creado.');
        await cargarUsuariosSelect('');
        reiniciarFormulario();
        await cargarPacientes();
        return;
      }

      aplicarErroresCampos(form, datos);
      const [tipo, texto] = explicarError(codigo, datos);
      mostrarMensaje(msgForm, tipo, texto);
    });
  });

  cargarPacientes();
  cargarUsuariosSelect('');
}
