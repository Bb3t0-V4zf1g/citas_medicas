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

export function renderConsultoriosPage(contenedor) {
  const admin = esAdmin();
  let consultorioEditandoId = null;

  contenedor.innerHTML = `
    <div class="${admin ? 'grid-2' : 'stack'}">
      ${admin ? `
        <section class="card">
          <h2 id="tituloFormConsultorio">Nuevo consultorio · POST /consultorios</h2>
          <form id="formConsultorio" novalidate>
            <label for="conCodigo">Código</label>
            <input id="conCodigo" name="codigo" placeholder="C-101">
            <div class="err-campo" data-error-for="codigo"></div>

            <label for="conNombre">Nombre</label>
            <input id="conNombre" name="nombre" placeholder="Consultorio General 1">
            <div class="err-campo" data-error-for="nombre"></div>

            <label for="conUbicacion">Ubicación (opcional)</label>
            <input id="conUbicacion" name="ubicacion" placeholder="Planta baja, ala norte">
            <div class="err-campo" data-error-for="ubicacion"></div>

            <div class="fila-acciones">
              <button id="btnGuardarConsultorio" class="btn" type="submit">Guardar</button>
              <button id="btnCancelarConsultorio" class="btn btn-secundario oculto" type="button">Cancelar</button>
            </div>
            <div id="msgConsultorio"></div>
          </form>
        </section>
      ` : ''}

      <section class="card">
        <div class="fila-cabecera">
          <h2>Consultorios <span class="subtitulo">GET /consultorios</span></h2>
          <button id="btnRecargarConsultorios" class="btn btn-secundario" type="button">Recargar</button>
        </div>
        <div id="msgListaConsultorios"></div>
        <div id="tablaConsultorios" class="tabla"></div>
      </section>
    </div>
  `;

  const tabla = contenedor.querySelector('#tablaConsultorios');
  const msgLista = contenedor.querySelector('#msgListaConsultorios');
  const btnRecargar = contenedor.querySelector('#btnRecargarConsultorios');

  const form = contenedor.querySelector('#formConsultorio');
  const titulo = contenedor.querySelector('#tituloFormConsultorio');
  const btnGuardar = contenedor.querySelector('#btnGuardarConsultorio');
  const btnCancelar = contenedor.querySelector('#btnCancelarConsultorio');
  const msgForm = contenedor.querySelector('#msgConsultorio');

  function reiniciarFormulario() {
    if (!form) return;
    consultorioEditandoId = null;
    form.reset();
    limpiarErroresFormulario(form);
    titulo.textContent = 'Nuevo consultorio · POST /consultorios';
    btnGuardar.textContent = 'Guardar';
    btnCancelar.classList.add('oculto');
  }

  function cargarParaEditar(consultorio) {
    if (!form) return;
    consultorioEditandoId = consultorio.id;
    limpiarErroresFormulario(form);
    mostrarMensaje(msgForm, '', '');
    form.codigo.value = consultorio.codigo || '';
    form.nombre.value = consultorio.nombre || '';
    form.ubicacion.value = consultorio.ubicacion || '';
    titulo.textContent = `Editar consultorio #${consultorio.id} · PATCH /consultorios/${consultorio.id}`;
    btnGuardar.textContent = 'Actualizar';
    btnCancelar.classList.remove('oculto');
    form.codigo.focus();
  }

  async function cargarConsultorios() {
    tabla.innerHTML = '<span class="rueda"></span>Cargando consultorios…';
    const { codigo, datos } = await api.consultorios.listar();

    if (codigo !== 200 || !Array.isArray(datos)) {
      const [tipo, texto] = explicarError(codigo, datos);
      tabla.innerHTML = '';
      mostrarMensaje(msgLista, tipo, texto);
      return;
    }

    renderizarTabla({
      contenedor: tabla,
      filas: datos,
      vacio: 'No hay consultorios registrados.',
      columnas: [
        { clave: 'id', titulo: 'ID' },
        { clave: 'codigo', titulo: 'Código' },
        { clave: 'nombre', titulo: 'Nombre' },
        { clave: 'ubicacion', titulo: 'Ubicación' }
      ],
      acciones: admin
        ? fila => [{ etiqueta: 'Editar', clase: 'btn-secundario', onClick: () => cargarParaEditar(fila) }]
        : null
    });
  }

  btnRecargar.addEventListener('click', cargarConsultorios);

  if (form) {
    btnCancelar.addEventListener('click', () => {
      reiniciarFormulario();
      mostrarMensaje(msgForm, '', '');
    });

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      limpiarErroresFormulario(form);
      mostrarMensaje(msgForm, '', '');

      const editando = consultorioEditandoId !== null;
      const payload = omitirVacios({
        codigo: form.codigo.value,
        nombre: form.nombre.value,
        ubicacion: form.ubicacion.value
      });

      await conCarga(btnGuardar, async () => {
        const { codigo, datos } = editando
          ? await api.consultorios.actualizar(consultorioEditandoId, payload)
          : await api.consultorios.crear(payload);

        if (codigo === 201 || codigo === 200) {
          mostrarMensaje(msgForm, 'ok', editando ? 'Consultorio actualizado.' : 'Consultorio creado.');
          reiniciarFormulario();
          await cargarConsultorios();
          return;
        }

        aplicarErroresCampos(form, datos);
        const [tipo, texto] = explicarError(codigo, datos);
        mostrarMensaje(msgForm, tipo, texto);
      });
    });
  }

  cargarConsultorios();
}
