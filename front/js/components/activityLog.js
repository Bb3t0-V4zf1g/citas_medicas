import { suscribirRegistro } from '../api.js';

export function montarRegistroActividad(contenedor) {
  contenedor.innerHTML = `
    <div class="fila-cabecera">
      <h2>Actividad HTTP <span class="subtitulo">(F12 → Red / Network)</span></h2>
      <button id="btnLimpiarLog" class="btn btn-chico btn-secundario" type="button">Limpiar</button>
    </div>
    <pre id="registroHttp" class="registro-log"></pre>
  `;

  const pre = contenedor.querySelector('#registroHttp');
  contenedor.querySelector('#btnLimpiarLog')?.addEventListener('click', () => {
    pre.textContent = '';
  });

  suscribirRegistro(linea => {
    pre.textContent = `${linea}\n${pre.textContent}`;
  });
}
