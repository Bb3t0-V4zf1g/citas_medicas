const MAPA_ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => MAPA_ESCAPE[c]);
}

export function mostrarMensaje(elemento, tipo, texto) {
  if (!elemento) return;
  elemento.innerHTML = texto ? `<div class="msg ${esc(tipo)}">${esc(texto)}</div>` : '';
}
