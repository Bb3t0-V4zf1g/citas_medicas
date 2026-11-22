import { esc } from './alert.js';

export function renderizarTabla({ contenedor, columnas, filas, vacio = 'No hay registros.', acciones = null }) {
  if (!contenedor) return;

  if (!Array.isArray(filas) || filas.length === 0) {
    contenedor.innerHTML = `<p class="subtitulo">${esc(vacio)}</p>`;
    return;
  }

  const encabezados = columnas.map(col => `<th>${esc(col.titulo)}</th>`).join('');
  const thAcciones = acciones ? '<th>Acciones</th>' : '';

  const cuerpo = filas.map((fila, indice) => {
    const celdas = columnas.map(col => {
      const valorBruto = fila[col.clave];
      if (typeof col.render === 'function') {
        return `<td>${col.render(valorBruto, fila)}</td>`;
      }
      const texto = typeof valorBruto === 'object' && valorBruto !== null
        ? JSON.stringify(valorBruto)
        : valorBruto;
      return `<td>${esc(texto ?? '—')}</td>`;
    }).join('');

    const listaAcciones = acciones ? acciones(fila) : [];
    const tdAcciones = acciones
      ? `<td><div class="acciones-celda">${listaAcciones.map((acc, accIdx) => (
        `<button type="button" class="btn btn-chico ${esc(acc.clase || 'btn-secundario')}" data-fila="${indice}" data-accion="${accIdx}">${esc(acc.etiqueta)}</button>`
      )).join('')}</div></td>`
      : '';

    return `<tr>${celdas}${tdAcciones}</tr>`;
  }).join('');

  contenedor.innerHTML = `<table><thead><tr>${encabezados}${thAcciones}</tr></thead><tbody>${cuerpo}</tbody></table>`;

  if (acciones) {
    contenedor.querySelectorAll('button[data-fila]').forEach(boton => {
      boton.addEventListener('click', () => {
        const filaIdx = Number(boton.dataset.fila);
        const accIdx = Number(boton.dataset.accion);
        const fila = filas[filaIdx];
        const lista = acciones(fila);
        lista[accIdx]?.onClick?.(fila);
      });
    });
  }
}
