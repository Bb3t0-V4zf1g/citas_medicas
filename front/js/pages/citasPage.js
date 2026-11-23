import { api, explicarError } from '../api.js';
import { esc, mostrarMensaje } from '../components/alert.js';
import { limpiarErroresFormulario, aplicarErroresCampos, conCarga } from '../components/form.js';
import { renderizarTabla } from '../components/table.js';

const ESTADOS_CITA = ['Pendiente', 'Completado', 'Cancelado', 'Pospuesto'];

function generarBloquesDe30Minutos() {
  const bloques = [];
  for (let hora = 0; hora < 24; hora += 1) {
    const hh = String(hora).padStart(2, '0');
    bloques.push(`${hh}:00`, `${hh}:30`);
  }
  return bloques;
}

const BLOQUES_30_MIN = generarBloquesDe30Minutos();

function siguienteBloque(hora) {
  const idx = BLOQUES_30_MIN.indexOf(hora);
  if (idx >= 0 && idx + 1 < BLOQUES_30_MIN.length) {
    return BLOQUES_30_MIN[idx + 1];
  }
  return BLOQUES_30_MIN[BLOQUES_30_MIN.length - 1];
}

function fechaHoyLocal() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extraerFechaYHoraLocal(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return { fecha: fechaHoyLocal(), hora: '09:00' };
  }
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mm = fecha.getMinutes() < 30 ? '00' : '30';
  return { fecha: `${y}-${m}-${d}`, hora: `${hh}:${mm}` };
}

function aIsoDesdeFechaYHora(fechaStr, horaStr) {
  if (!fechaStr || !horaStr) return '';
  const fecha = new Date(`${fechaStr}T${horaStr}:00`);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toISOString();
}

function formatearFechaHora(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return esc(iso);
  return esc(fecha.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }));
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
  let opciones = {
    tipo_actor: 'paciente',
    puede_crear: false,
    puede_editar: false,
    puede_eliminar: false,
    medico_propio: null,
    paciente_propio: null,
    medicos: [],
    pacientes: []
  };

  const opcionesHorasHtml = BLOQUES_30_MIN
    .map(h => `<option value="${h}">${h}</option>`)
    .join('');

  contenedor.innerHTML = `
    <div class="stack">
      <div id="gridSuperiorCitas" class="grid-2">
        <section id="cardFormCita" class="card oculto">
          <h2 id="tituloFormCita">Nueva cita · POST /citas</h2>
          <p id="notaPermisosCita" class="nota oculto"></p>
          <form id="formCita" novalidate>
            <label for="citaMedico">Médico</label>
            <select id="citaMedico" name="medico"></select>
            <div class="err-campo" data-error-for="medico"></div>

            <label for="citaPaciente">Paciente</label>
            <select id="citaPaciente" name="paciente"></select>
            <div class="err-campo" data-error-for="paciente"></div>

            <label for="citaFecha">Fecha</label>
            <input id="citaFecha" name="fecha" type="date" value="${fechaHoyLocal()}">

            <label for="citaHoraInicio">Hora de inicio (cada 30 min)</label>
            <select id="citaHoraInicio" name="hora_inicio">${opcionesHorasHtml}</select>
            <div class="err-campo" data-error-for="horario_inicio"></div>

            <label for="citaHoraFin">Hora de fin (cada 30 min)</label>
            <select id="citaHoraFin" name="hora_fin">${opcionesHorasHtml}</select>
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
        <p id="notaSoloLectura" class="nota oculto">Como paciente puedes consultar tus citas. Para crear o modificar una cita acude con tu médico o con un administrador.</p>
        <div id="msgListaCitas"></div>
        <div id="tablaCitas" class="tabla"></div>
      </section>
    </div>
  `;

  const gridSuperior = contenedor.querySelector('#gridSuperiorCitas');
  const cardFormCita = contenedor.querySelector('#cardFormCita');
  const notaPermisosCita = contenedor.querySelector('#notaPermisosCita');
  const notaSoloLectura = contenedor.querySelector('#notaSoloLectura');

  const tituloForm = contenedor.querySelector('#tituloFormCita');
  const formCita = contenedor.querySelector('#formCita');
  const selectMedico = contenedor.querySelector('#citaMedico');
  const selectPaciente = contenedor.querySelector('#citaPaciente');
  const inputFecha = contenedor.querySelector('#citaFecha');
  const selectHoraInicio = contenedor.querySelector('#citaHoraInicio');
  const selectHoraFin = contenedor.querySelector('#citaHoraFin');
  const btnGuardar = contenedor.querySelector('#btnGuardarCita');
  const btnCancelar = contenedor.querySelector('#btnCancelarEdicion');
  const msgCita = contenedor.querySelector('#msgCita');

  const formIA = contenedor.querySelector('#formIA');
  const btnIA = contenedor.querySelector('#btnIA');
  const resIA = contenedor.querySelector('#resIA');

  const tablaCitas = contenedor.querySelector('#tablaCitas');
  const msgLista = contenedor.querySelector('#msgListaCitas');
  const btnRecargar = contenedor.querySelector('#btnRecargarCitas');

  selectHoraInicio.value = '09:00';
  selectHoraFin.value = '09:30';

  function llenarSelectsCatalogo(medicoActual = '', pacienteActual = '') {
    if (opciones.tipo_actor === 'medico' && opciones.medico_propio) {
      selectMedico.innerHTML = `<option value="${esc(opciones.medico_propio.nombre)}">${esc(opciones.medico_propio.nombre)}</option>`;
      selectMedico.value = opciones.medico_propio.nombre;
      selectMedico.disabled = true;
    } else {
      const htmlMedicos = [
        '<option value="">Selecciona un médico…</option>',
        ...opciones.medicos.map(m => (
          `<option value="${esc(m.nombre)}">${esc(m.nombre)}${m.especialidad ? ` · ${esc(m.especialidad)}` : ''}</option>`
        ))
      ];
      selectMedico.innerHTML = htmlMedicos.join('');
      selectMedico.disabled = false;
      if (medicoActual) selectMedico.value = medicoActual;
    }

    const htmlPacientes = [
      '<option value="">Selecciona un paciente…</option>',
      ...opciones.pacientes.map(p => (
        `<option value="${esc(p.nombre)}">${esc(p.nombre)}</option>`
      ))
    ];
    selectPaciente.innerHTML = htmlPacientes.join('');
    if (pacienteActual) selectPaciente.value = pacienteActual;
  }

  function aplicarPermisosVista() {
    const puedeGestionar = Boolean(opciones.puede_crear || opciones.puede_editar);
    cardFormCita.classList.toggle('oculto', !puedeGestionar);
    gridSuperior.classList.toggle('grid-2', puedeGestionar);
    notaSoloLectura.classList.toggle('oculto', opciones.tipo_actor !== 'paciente');

    if (opciones.tipo_actor === 'medico' && opciones.medico_propio) {
      notaPermisosCita.textContent = `Sesión de médico (${opciones.medico_propio.nombre}): solo puedes agendar y editar tus propias citas.`;
      notaPermisosCita.classList.remove('oculto');
    } else {
      notaPermisosCita.classList.add('oculto');
    }
  }

  function reiniciarFormulario() {
    citaEditandoId = null;
    formCita.reset();
    limpiarErroresFormulario(formCita);
    llenarSelectsCatalogo();
    inputFecha.value = fechaHoyLocal();
    selectHoraInicio.value = '09:00';
    selectHoraFin.value = '09:30';
    formCita.estado.value = 'Pendiente';
    tituloForm.textContent = 'Nueva cita · POST /citas';
    btnGuardar.textContent = 'Guardar cita';
    btnCancelar.classList.add('oculto');
  }

  function cargarParaEditar(cita) {
    citaEditandoId = cita.id;
    limpiarErroresFormulario(formCita);
    mostrarMensaje(msgCita, '', '');
    llenarSelectsCatalogo(cita.medico || '', cita.paciente || '');
    const inicio = extraerFechaYHoraLocal(cita.horario_inicio);
    const fin = extraerFechaYHoraLocal(cita.horario_fin);
    inputFecha.value = inicio.fecha;
    selectHoraInicio.value = inicio.hora;
    selectHoraFin.value = fin.hora;
    formCita.estado.value = ESTADOS_CITA.includes(cita.estado) ? cita.estado : 'Pendiente';
    tituloForm.textContent = `Editar cita #${cita.id} · PUT /citas/${cita.id}`;
    btnGuardar.textContent = 'Actualizar cita';
    btnCancelar.classList.remove('oculto');
    selectPaciente.focus();
  }

  async function marcarCompletada(cita) {
    mostrarMensaje(msgLista, '', '');
    const { codigo, datos } = await api.citas.actualizar(cita.id, {
      medico: cita.medico,
      paciente: cita.paciente,
      horario_inicio: cita.horario_inicio,
      horario_fin: cita.horario_fin,
      estado: 'Completado'
    });
    if (codigo === 200) {
      if (citaEditandoId === cita.id) reiniciarFormulario();
      mostrarMensaje(msgLista, 'ok', `Cita #${cita.id} marcada como completada.`);
      await cargarCitas();
      return;
    }
    const [tipo, texto] = explicarError(codigo, datos);
    mostrarMensaje(msgLista, tipo, texto);
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

  function construirAccionesFila(fila) {
    const botones = [];
    if (opciones.puede_editar) {
      if (fila.estado !== 'Completado') {
        botones.push({
          etiqueta: 'Completar',
          clase: 'btn-secundario',
          onClick: () => marcarCompletada(fila)
        });
      }
      botones.push({
        etiqueta: 'Editar',
        clase: 'btn-secundario',
        onClick: () => cargarParaEditar(fila)
      });
    }
    if (opciones.puede_eliminar) {
      botones.push({
        etiqueta: 'Eliminar',
        clase: 'btn-peligro',
        onClick: () => eliminarCita(fila)
      });
    }
    return botones;
  }

  async function cargarOpciones() {
    const { codigo, datos } = await api.citas.opciones();
    if (codigo === 200 && datos) {
      opciones = datos;
    }
    aplicarPermisosVista();
    llenarSelectsCatalogo();
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

    const tieneAcciones = Boolean(opciones.puede_editar || opciones.puede_eliminar);

    renderizarTabla({
      contenedor: tablaCitas,
      filas: datos,
      vacio: 'No hay citas registradas para tu cuenta.',
      columnas: [
        { clave: 'id', titulo: 'ID' },
        { clave: 'medico', titulo: 'Médico' },
        { clave: 'paciente', titulo: 'Paciente' },
        { clave: 'horario_inicio', titulo: 'Inicio', render: valor => formatearFechaHora(valor) },
        { clave: 'horario_fin', titulo: 'Fin', render: valor => formatearFechaHora(valor) },
        { clave: 'estado', titulo: 'Estado', render: valor => badgeEstado(valor) }
      ],
      acciones: tieneAcciones ? construirAccionesFila : null
    });
  }

  selectHoraInicio.addEventListener('change', () => {
    if (BLOQUES_30_MIN.indexOf(selectHoraFin.value) <= BLOQUES_30_MIN.indexOf(selectHoraInicio.value)) {
      selectHoraFin.value = siguienteBloque(selectHoraInicio.value);
    }
  });

  btnCancelar.addEventListener('click', () => {
    reiniciarFormulario();
    mostrarMensaje(msgCita, '', '');
  });

  btnRecargar.addEventListener('click', async () => {
    await cargarOpciones();
    await cargarCitas();
  });

  formCita.addEventListener('submit', async ev => {
    ev.preventDefault();
    limpiarErroresFormulario(formCita);
    mostrarMensaje(msgCita, '', '');

    const medicoValor = opciones.tipo_actor === 'medico' && opciones.medico_propio
      ? opciones.medico_propio.nombre
      : selectMedico.value.trim();

    const payload = {
      medico: medicoValor,
      paciente: selectPaciente.value.trim(),
      horario_inicio: aIsoDesdeFechaYHora(inputFecha.value, selectHoraInicio.value),
      horario_fin: aIsoDesdeFechaYHora(inputFecha.value, selectHoraFin.value),
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

  (async () => {
    await cargarOpciones();
    await cargarCitas();
  })();
}
