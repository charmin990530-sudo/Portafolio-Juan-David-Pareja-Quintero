/**
 * modules/cursor.js — Cursor personalizado.
 *
 * Solo con puntero fino y sin `prefers-reduced-motion`.
 *
 * Antes este módulo también "imantaba" los botones: escribía un
 * `transform` al entrar el puntero y lo limpiaba al salir. Daba dos fallos
 * reales — el botón se quedaba pegado tras el clic, y el propio
 * desplazamiento re-disparaba `pointerleave`, así que la imantación se
 * deshic sola a parpadazos. Por eso se eliminó: el elemento no se mueve
 * nunca y el único rastro es el anillo del cursor, que crece sobre lo
 * interactivo. Cero transformaciones, cero posibilidad de quedarse pegado.
 */

import { crear, on } from '../core/dom.js';
import { alFotograma } from '../core/loop.js';
import { lerp, movimientoReducido } from '../core/util.js';

const SELECCION = 'a, button, input, textarea, select, [role="button"], .chip, label';

export function montarCursor() {
  if (!matchMedia('(pointer: fine)').matches || movimientoReducido()) return () => {};

  const cursor = crear('div', { class: 'cursor', 'aria-hidden': 'true' });
  document.body.append(cursor);

  let objetivoX = window.innerWidth / 2;
  let objetivoY = window.innerHeight / 2;
  let x = objetivoX;
  let y = objetivoY;
  let visible = false;

  function seguir(evento) {
    objetivoX = evento.clientX;
    objetivoY = evento.clientY;
    if (visible) return;
    visible = true;
    x = objetivoX;
    y = objetivoY;
    cursor.dataset.visible = '1';
  }

  function ocultar() {
    visible = false;
    cursor.dataset.visible = '0';
    cursor.dataset.estado = 'inactivo';
  }

  /** Solo cambia el estado del anillo: ningún elemento se desplaza. */
  function evaluar(evento) {
    const destino = evento.target instanceof Element ? evento.target.closest(SELECCION) : null;
    cursor.dataset.estado = destino ? 'activo' : 'inactivo';
  }

  function cuadro() {
    x = lerp(x, objetivoX, 0.22);
    y = lerp(y, objetivoY, 0.22);
    cursor.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%)`;
  }

  const bajas = [];

  bajas.push(alFotograma(cuadro));

  bajas.push(on(window, 'mousemove', seguir, { passive: true }));
  bajas.push(on(window, 'mouseover', evaluar, { passive: true }));
  bajas.push(on(document, 'mouseleave', ocultar));
  bajas.push(on(window, 'blur', ocultar));

  /* Antes esto era `return () => cursor.remove()`: quitaba el nodo y dejaba
     los cuatro escuchadores vivos, apuntando a un elemento que ya no estaba
     en el documento. `evaluar` seguía escribiendo `dataset` en un nodo
     huérfano y `cuadro` seguía escribiendo `transform` en él en cada
     fotograma, para siempre.

     Y un arreglo a medias no sirve: cambiar a `on()` sin GUARDAR la baja que
     devuelve deja la fuga igual de intacta, solo que con más código. Las
     cinco bajas se guardan y se sueltan juntas. */
  return () => {
    for (const baja of bajas) baja();
    cursor.remove();
  };
}
