import { api, explicarError } from '../api.js';
import { esc, mostrarMensaje } from '../components/alert.js';
import { limpiarErroresFormulario, aplicarErroresCampos, conCarga } from '../components/form.js';
import { renderizarTabla } from '../components/table.js';

const ESTADOS_CITA = ['Pendiente', 'Completado', 'Cancelado', 'Pospuesto'];

function aDatetimeLocal(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const ajuste = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return ajuste.toISOString().slice(0, 16);
}

function aIsoDesdeLocal(valor) {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toISOString();
}

function badgeEstado(estado) {
  const mapa = {
    Pendiente: 'badge-aviso',
    Completado: 'badge-ok',
    Cancelado: 'badge-mal',
    Pospuesto: ''
  };
  return `<span class="badge ${mapa[estado] || ''}">${esc(estado)}</span>`;
}

export function renderCitasPage(contenedor) {
  let citaEditandoId = null;

  contenedor.innerHTML = `
    <div class="stack">
      <div class="grid-2">
        <section class="card">
          <h2 id="tituloFormCita">Nueva cita · POST /citas</h2>
          <form id="formCita" novalidate>
            <label for="citaMedico">Médico</label>
            <input id="citaMedico" name="medico" placeholder="Dra. Ana Torres">
            <div class="err-campo" data-error-for="medico"></div>

            <label for="citaPaciente">Paciente</label>
            <input id="citaPaciente" name="paciente" placeholder="Maria Lopez">
            <div class="err-campo" data-error-for="paciente"></div>

            <label for="citaInicio">Horario de inicio</label>
            <input id="citaInicio" name="horario_inicio" type="datetime-local">
            <div class="err-campo" data-error-for="horario_inicio"></div>

            <label for="citaFin">Horario de fin</label>
            <input id="citaFin" name="horario_fin" type="datetime-local">
            <div class="err-campo" data-error-for="horario_fin"></div>

            <label for="citaEstado">Estado</label>
            <select id="citaEstado" name="estado">
              ${ESTADOS_CITA.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('')}
            </select>
            <div class="err-campo" data-error-for="estado"></div>

            <div class="fila-acciones">
              <button id="btnGuardarCita" class="btn" type="submit">Guardar cita</button>
              <button id="btnCancelarEdicion" class="btn btn-secundario oculto" type="button">Cancelar</button>
            </div>
            <div id="msgCita"></div>
          </form>
        </section>

        <section class="card">
          <h2>Análisis de comentario con IA <span class="subtitulo">POST /citas/comentario</span></h2>
          <form id="formIA" novalidate>
            <label for="iaComentario">Comentario del paciente</label>
            <textarea id="iaComentario" name="comentario" rows="4" placeholder="Me atendieron puntual, pero en recepción tardaron mucho"></textarea>
            <div class="err-campo" data-error-for="comentario"></div>

            <div class="fila-acciones">
              <button id="btnIA" class="btn" type="submit">Analizar</button>
            </div>
            <div id="resIA"></div>
          </form>
        </section>
      </div>

      <section class="card ancho">
        <div class="fila-cabecera">
          <h2>Listado de citas <span class="subtitulo">GET /citas</span></h2>
          <button id="btnRecargarCitas" class="btn btn-secundario" type="button">Recargar</button>
        </div>
        <div id="msgListaCitas"></div>
        <div id="tablaCitas" class="tabla"></div>
      </section>
    </div>
  `;

  const tituloForm = contenedor.querySelector('#tituloFormCita');
  const formCita = contenedor.querySelector('#formCita');
  const btnGuardar = contenedor.querySelector('#btnGuardarCita');
  const btnCancelar = contenedor.querySelector('#btnCancelarEdicion');
  const msgCita = contenedor.querySelector('#msgCita');

  const formIA = contenedor.querySelector('#formIA');
  const btnIA = contenedor.querySelector('#btnIA');
  const resIA = contenedor.querySelector('#resIA');

  const tablaCitas = contenedor.querySelector('#tablaCitas');
  const msgLista = contenedor.querySelector('#msgListaCitas');
  const btnRecargar = contenedor.querySelector('#btnRecargarCitas');

  function reiniciarFormulario() {
    citaEditandoId = null;
    formCita.reset();
    limpiarErroresFormulario(formCita);
    tituloForm.textContent = 'Nueva cita · POST /citas';
    btnGuardar.textContent = 'Guardar cita';
    btnCancelar.classList.add('oculto');
  }

  function cargarParaEditar(cita) {
    citaEditandoId = cita.id;
    limpiarErroresFormulario(formCita);
    mostrarMensaje(msgCita, '', '');
    formCita.medico.value = cita.medico || '';
    formCita.paciente.value = cita.paciente || '';
    formCita.horario_inicio.value = aDatetimeLocal(cita.horario_inicio);
    formCita.horario_fin.value = aDatetimeLocal(cita.horario_fin);
    formCita.estado.value = ESTADOS_CITA.includes(cita.estado) ? cita.estado : 'Pendiente';
    tituloForm.textContent = `Editar cita #${cita.id} · PUT /citas/${cita.id}`;
    btnGuardar.textContent = 'Actualizar cita';
    btnCancelar.classList.remove('oculto');
    formCita.medico.focus();
  }

  async function eliminarCita(cita) {
    mostrarMensaje(msgLista, '', '');
    const { codigo, datos } = await api.citas.eliminar(cita.id);
    if (codigo === 204) {
      if (citaEditandoId === cita.id) reiniciarFormulario();
      mostrarMensaje(msgLista, 'ok', `Cita #${cita.id} eliminada.`);
      await cargarCitas();
      return;
    }
    const [tipo, texto] = explicarError(codigo, datos);
    mostrarMensaje(msgLista, tipo, texto);
  }

  async function cargarCitas() {
    tablaCitas.innerHTML = '<span class="rueda"></span>Cargando citas…';
    const { codigo, datos } = await api.citas.listar();

    if (codigo !== 200 || !Array.isArray(datos)) {
      const [tipo, texto] = explicarError(codigo, datos);
      tablaCitas.innerHTML = '';
      mostrarMensaje(msgLista, tipo, texto);
      return;
    }

    renderizarTabla({
      contenedor: tablaCitas,
      filas: datos,
      vacio: 'No hay citas registradas para tu cuenta.',
      columnas: [
        { clave: 'id', titulo: 'ID' },
        { clave: 'medico', titulo: 'Médico' },
        { clave: 'paciente', titulo: 'Paciente' },
        { clave: 'horario_inicio', titulo: 'Inicio' },
        { clave: 'horario_fin', titulo: 'Fin' },
        { clave: 'estado', titulo: 'Estado', render: valor => badgeEstado(valor) }
      ],
      acciones: fila => [
        { etiqueta: 'Editar', clase: 'btn-secundario', onClick: () => cargarParaEditar(fila) },
        { etiqueta: 'Eliminar', clase: 'btn-peligro', onClick: () => eliminarCita(fila) }
      ]
    });
  }

  btnCancelar.addEventListener('click', () => {
    reiniciarFormulario();
    mostrarMensaje(msgCita, '', '');
  });

  btnRecargar.addEventListener('click', cargarCitas);

  formCita.addEventListener('submit', async ev => {
    ev.preventDefault();
    limpiarErroresFormulario(formCita);
    mostrarMensaje(msgCita, '', '');

    const payload = {
      medico: formCita.medico.value.trim(),
      paciente: formCita.paciente.value.trim(),
      horario_inicio: aIsoDesdeLocal(formCita.horario_inicio.value),
      horario_fin: aIsoDesdeLocal(formCita.horario_fin.value),
      estado: formCita.estado.value
    };

    await conCarga(btnGuardar, async () => {
      const editando = citaEditandoId !== null;
      const { codigo, datos } = editando
        ? await api.citas.actualizar(citaEditandoId, payload)
        : await api.citas.crear(payload);

      if (codigo === 201 || codigo === 200) {
        mostrarMensaje(msgCita, 'ok', editando ? 'Cita actualizada.' : 'Cita creada.');
        reiniciarFormulario();
        await cargarCitas();
        return;
      }

      aplicarErroresCampos(formCita, datos);
      const [tipo, texto] = explicarError(codigo, datos);
      mostrarMensaje(msgCita, tipo, texto);
    });
  });

  formIA.addEventListener('submit', async ev => {
    ev.preventDefault();
    limpiarErroresFormulario(formIA);

    const comentario = formIA.comentario.value.trim() || formIA.comentario.placeholder;
    const t0 = performance.now();
    const reloj = setInterval(() => {
      if (!contenedor.isConnected) {
        clearInterval(reloj);
        return;
      }
      const seg = ((performance.now() - t0) / 1000).toFixed(1);
      resIA.innerHTML = `<div class="msg aviso"><span class="rueda"></span>Consultando IA… ${seg} s</div>`;
    }, 100);

    await conCarga(btnIA, async () => {
      try {
        const { codigo, datos } = await api.citas.analizarComentario(comentario);
        clearInterval(reloj);
        if (codigo === 200 && datos) {
          resIA.innerHTML = `
            <div class="chips">
              <span><b>Sentimiento:</b> ${esc(datos.sentimiento)}</span>
              <span><b>Resumen:</b> ${esc(datos.resumen)}</span>
            </div>
          `;
          return;
        }
        aplicarErroresCampos(formIA, datos);
        const [tipo, texto] = explicarError(codigo, datos);
        mostrarMensaje(resIA, tipo, texto);
      } finally {
        clearInterval(reloj);
      }
    });
  });

  cargarCitas();
}
