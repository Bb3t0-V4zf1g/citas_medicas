import { api, explicarError } from '../api.js';
import { esAdmin } from '../auth.js';
import { mostrarMensaje } from '../components/alert.js';
import {
  limpiarErroresFormulario,
  aplicarErroresCampos,
  conCarga,
  omitirVacios
} from '../components/form.js';
import { renderizarTabla } from '../components/table.js';

export function renderPacientesPage(contenedor) {
  const admin = esAdmin();
  let pacienteEditandoId = null;

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
            <label for="pacUsuarioId">Usuario vinculado (solo admin, opcional)</label>
            <input id="pacUsuarioId" name="usuario_id" placeholder="ana">
            <div class="err-campo" data-error-for="usuario_id"></div>
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
  const grupoUsuario = contenedor.querySelector('#grupoUsuarioPaciente');
  const btnGuardar = contenedor.querySelector('#btnGuardarPaciente');
  const btnCancelar = contenedor.querySelector('#btnCancelarPaciente');
  const msgForm = contenedor.querySelector('#msgPaciente');
  const msgLista = contenedor.querySelector('#msgListaPacientes');
  const tabla = contenedor.querySelector('#tablaPacientes');
  const btnRecargar = contenedor.querySelector('#btnRecargarPacientes');

  function reiniciarFormulario() {
    pacienteEditandoId = null;
    form.reset();
    limpiarErroresFormulario(form);
    titulo.textContent = 'Nuevo perfil de paciente · POST /pacientes';
    btnGuardar.textContent = 'Guardar';
    btnCancelar.classList.add('oculto');
    if (admin) {
      grupoUsuario.classList.remove('oculto');
    }
  }

  function cargarParaEditar(paciente) {
    pacienteEditandoId = paciente.id;
    limpiarErroresFormulario(form);
    mostrarMensaje(msgForm, '', '');
    form.nombre.value = paciente.nombre || '';
    form.telefono.value = paciente.telefono || '';
    form.correo.value = paciente.correo || '';
    form.fecha_nacimiento.value = paciente.fecha_nacimiento || '';
    grupoUsuario.classList.add('oculto');
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

  btnCancelar.addEventListener('click', () => {
    reiniciarFormulario();
    mostrarMensaje(msgForm, '', '');
  });

  btnRecargar.addEventListener('click', cargarPacientes);

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    limpiarErroresFormulario(form);
    mostrarMensaje(msgForm, '', '');

    const editando = pacienteEditandoId !== null;
    const base = {
      nombre: form.nombre.value,
      telefono: form.telefono.value,
      correo: form.correo.value,
      fecha_nacimiento: form.fecha_nacimiento.value
    };
    if (!editando && admin) {
      base.usuario_id = form.usuario_id.value;
    }

    const payload = omitirVacios(base);

    await conCarga(btnGuardar, async () => {
      const { codigo, datos } = editando
        ? await api.pacientes.actualizar(pacienteEditandoId, payload)
        : await api.pacientes.crear(payload);

      if (codigo === 201 || codigo === 200) {
        mostrarMensaje(msgForm, 'ok', editando ? 'Perfil actualizado.' : 'Perfil creado.');
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
}
