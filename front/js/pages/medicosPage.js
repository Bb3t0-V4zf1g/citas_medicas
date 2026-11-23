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

export function renderMedicosPage(contenedor) {
  const admin = esAdmin();
  let medicoEditando = null;
  let usuariosDisponibles = [];

  contenedor.innerHTML = `
    <div class="${admin ? 'grid-2' : 'stack'}">
      ${admin ? `
        <section class="card">
          <h2 id="tituloFormMedico">Nuevo médico · POST /medicos</h2>
          <form id="formMedico" novalidate>
            <label for="medNombre">Nombre completo</label>
            <input id="medNombre" name="nombre" placeholder="Dra. Elena Vargas">
            <div class="err-campo" data-error-for="nombre"></div>

            <label for="medCedula">Cédula profesional</label>
            <input id="medCedula" name="cedula_profesional" placeholder="CED-90812">
            <div class="err-campo" data-error-for="cedula_profesional"></div>

            <label for="medEspecialidad">Especialidad</label>
            <input id="medEspecialidad" name="especialidad" placeholder="Cardiología">
            <div class="err-campo" data-error-for="especialidad"></div>

            <label for="medUsuarioId">Cuenta de usuario (opcional)</label>
            <select id="medUsuarioId" name="usuario_id">
              <option value="">Sin cuenta vinculada</option>
              <option value="${OPCION_CREAR_USUARIO}">+ Crear nueva cuenta para este médico</option>
            </select>
            <div class="err-campo" data-error-for="usuario_id"></div>

            <div id="bloqueNuevoUsuarioMedico" class="oculto">
              <label for="medNuevoUsuario">Usuario nuevo</label>
              <input id="medNuevoUsuario" name="usuario" placeholder="dra.elena" autocomplete="off">
              <div class="err-campo" data-error-for="usuario"></div>

              <label for="medNuevaClave">Contraseña (mínimo 8 caracteres)</label>
              <input id="medNuevaClave" name="clave" type="password" placeholder="••••••••" autocomplete="new-password">
              <div class="err-campo" data-error-for="clave"></div>
            </div>

            <div class="fila-acciones">
              <button id="btnGuardarMedico" class="btn" type="submit">Guardar</button>
              <button id="btnCancelarMedico" class="btn btn-secundario oculto" type="button">Cancelar</button>
            </div>
            <div id="msgMedico"></div>
          </form>
        </section>
      ` : ''}

      <section class="card">
        <div class="fila-cabecera">
          <h2>Médicos <span class="subtitulo">GET /medicos</span></h2>
          <button id="btnRecargarMedicos" class="btn btn-secundario" type="button">Recargar</button>
        </div>
        <div id="msgListaMedicos"></div>
        <div id="tablaMedicos" class="tabla"></div>
      </section>
    </div>
  `;

  const tabla = contenedor.querySelector('#tablaMedicos');
  const msgLista = contenedor.querySelector('#msgListaMedicos');
  const btnRecargar = contenedor.querySelector('#btnRecargarMedicos');

  const form = contenedor.querySelector('#formMedico');
  const titulo = contenedor.querySelector('#tituloFormMedico');
  const selectUsuario = contenedor.querySelector('#medUsuarioId');
  const bloqueNuevoUsuario = contenedor.querySelector('#bloqueNuevoUsuarioMedico');
  const btnGuardar = contenedor.querySelector('#btnGuardarMedico');
  const btnCancelar = contenedor.querySelector('#btnCancelarMedico');
  const msgForm = contenedor.querySelector('#msgMedico');

  function actualizarVisibilidadNuevoUsuario() {
    if (!bloqueNuevoUsuario || !selectUsuario) return;
    const creandoNuevo = selectUsuario.value === OPCION_CREAR_USUARIO;
    bloqueNuevoUsuario.classList.toggle('oculto', !creandoNuevo);
  }

  function renderizarOpcionesUsuario(seleccionActual = '') {
    if (!selectUsuario) return;
    const opciones = [
      '<option value="">Sin cuenta vinculada</option>',
      ...usuariosDisponibles.map(u => (
        `<option value="${esc(u.usuario)}">${esc(u.usuario)} (${esc(u.rol)})</option>`
      )),
      `<option value="${OPCION_CREAR_USUARIO}">+ Crear nueva cuenta para este médico</option>`
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
    if (!form) return;
    medicoEditando = null;
    form.reset();
    limpiarErroresFormulario(form);
    renderizarOpcionesUsuario('');
    titulo.textContent = 'Nuevo médico · POST /medicos';
    btnGuardar.textContent = 'Guardar';
    btnCancelar.classList.add('oculto');
  }

  function cargarParaEditar(medico) {
    if (!form) return;
    medicoEditando = medico;
    limpiarErroresFormulario(form);
    mostrarMensaje(msgForm, '', '');
    form.nombre.value = medico.nombre || '';
    form.cedula_profesional.value = medico.cedula_profesional || '';
    form.especialidad.value = medico.especialidad || '';
    renderizarOpcionesUsuario(medico.usuario_id || '');
    titulo.textContent = `Editar médico #${medico.id} · PATCH /medicos/${medico.id}`;
    btnGuardar.textContent = 'Actualizar';
    btnCancelar.classList.remove('oculto');
    form.nombre.focus();
  }

  async function cargarMedicos() {
    tabla.innerHTML = '<span class="rueda"></span>Cargando médicos…';
    const { codigo, datos } = await api.medicos.listar();

    if (codigo !== 200 || !Array.isArray(datos)) {
      const [tipo, texto] = explicarError(codigo, datos);
      tabla.innerHTML = '';
      mostrarMensaje(msgLista, tipo, texto);
      return;
    }

    renderizarTabla({
      contenedor: tabla,
      filas: datos,
      vacio: 'No hay médicos registrados.',
      columnas: [
        { clave: 'id', titulo: 'ID' },
        { clave: 'nombre', titulo: 'Nombre' },
        { clave: 'cedula_profesional', titulo: 'Cédula' },
        { clave: 'especialidad', titulo: 'Especialidad' },
        { clave: 'usuario_id', titulo: 'Usuario' },
        {
          clave: 'datos_pendientes_validacion',
          titulo: 'Validación',
          render: v => (v ? '<span class="badge badge-aviso">Pendiente</span>' : `<span class="badge badge-ok">${esc('Validado')}</span>`)
        }
      ],
      acciones: admin
        ? fila => [{ etiqueta: 'Editar', clase: 'btn-secundario', onClick: () => cargarParaEditar(fila) }]
        : null
    });
  }

  btnRecargar.addEventListener('click', () => {
    cargarMedicos();
    cargarUsuariosSelect(selectUsuario ? selectUsuario.value : '');
  });

  if (form) {
    selectUsuario.addEventListener('change', actualizarVisibilidadNuevoUsuario);

    btnCancelar.addEventListener('click', () => {
      reiniciarFormulario();
      mostrarMensaje(msgForm, '', '');
    });

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      limpiarErroresFormulario(form);
      mostrarMensaje(msgForm, '', '');

      const editando = medicoEditando !== null;
      const payload = omitirVacios({
        nombre: form.nombre.value,
        cedula_profesional: form.cedula_profesional.value,
        especialidad: form.especialidad.value
      });

      const seleccionUsuario = selectUsuario.value;

      await conCarga(btnGuardar, async () => {
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
        } else if (editando && medicoEditando.usuario_id) {
          payload.usuario_id = null;
        }

        const { codigo, datos } = editando
          ? await api.medicos.actualizar(medicoEditando.id, payload)
          : await api.medicos.crear(payload);

        if (codigo === 201 || codigo === 200) {
          mostrarMensaje(msgForm, 'ok', editando ? 'Médico actualizado.' : 'Médico creado.');
          await cargarUsuariosSelect('');
          reiniciarFormulario();
          await cargarMedicos();
          return;
        }

        aplicarErroresCampos(form, datos);
        const [tipo, texto] = explicarError(codigo, datos);
        mostrarMensaje(msgForm, tipo, texto);
      });
    });
  }

  cargarMedicos();
  cargarUsuariosSelect('');
}
