import { erroresPorCampo } from '../api.js';

export function limpiarErroresFormulario(form) {
  if (!form) return;
  for (const el of form.querySelectorAll('.mal')) {
    el.classList.remove('mal');
  }
  for (const el of form.querySelectorAll('.err-campo')) {
    el.textContent = '';
  }
}

export function aplicarErroresCampos(form, datos) {
  if (!form) return;
  const errores = erroresPorCampo(datos);
  for (const [campo, mensaje] of Object.entries(errores)) {
    const control = form.querySelector(`[name="${CSS.escape(campo)}"]`);
    if (control) {
      control.classList.add('mal');
    }
    const contenedorError = form.querySelector(`[data-error-for="${CSS.escape(campo)}"]`);
    if (contenedorError) {
      contenedorError.textContent = mensaje;
    }
  }
}

export async function conCarga(boton, fn) {
  if (!boton) return fn();
  boton.disabled = true;
  try {
    return await fn();
  } finally {
    boton.disabled = false;
  }
}

export function omitirVacios(objeto) {
  const limpio = {};
  for (const [clave, valor] of Object.entries(objeto)) {
    if (valor === undefined || valor === null) continue;
    if (typeof valor === 'string' && valor.trim() === '') continue;
    limpio[clave] = typeof valor === 'string' ? valor.trim() : valor;
  }
  return limpio;
}
