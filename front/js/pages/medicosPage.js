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

export function renderMedicosPage(contenedor) {
  const admin = esAdmin();
  let medicoEditando = null;

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

            <label for="medUsuarioId">Usuario vinculado (opcional)</label>
            <input id="medUsuarioId" name="usuario_id" placeholder="Dejar vacío para sin cuenta">
            <div class="err-campo" data-error-for="usuario_id"></div>

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
  const btnGuardar = contenedor.querySelector('#btnGuardarMedico');
  const btnCancelar = contenedor.querySelector('#btnCancelarMedico');
  const msgForm = contenedor.querySelector('#msgMedico');

  function reiniciarFormulario() {
    if (!form) return;
    medicoEditando = null;
    form.reset();
    limpiarErroresFormulario(form);
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
    form.usuario_id.value = medico.usuario_id || '';
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

  btnRecargar.addEventListener('click', cargarMedicos);

  if (form) {
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

      const usuarioTrim = form.usuario_id.value.trim();
      if (usuarioTrim) {
        payload.usuario_id = usuarioTrim;
      } else if (editando && medicoEditando.usuario_id) {
        payload.usuario_id = null;
      }

      await conCarga(btnGuardar, async () => {
        const { codigo, datos } = editando
          ? await api.medicos.actualizar(medicoEditando.id, payload)
          : await api.medicos.crear(payload);

        if (codigo === 201 || codigo === 200) {
          mostrarMensaje(msgForm, 'ok', editando ? 'Médico actualizado.' : 'Médico creado.');
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
}
