/**
 * modules/contadores.js — Números que cuentan solos.
 *
 * Los elementos con `data-contador="N"` arrancan en cero y suben hasta N
 * cuando entran en pantalla. La animación usa el bucle común y respeta
 * `prefers-reduced-motion` (en ese caso el valor aparece directamente).
 *
 *   <span data-contador="19">0</span>
 *   <span data-contador="100" data-sufijo="%">0</span>
 */

import { $$ } from '../core/dom.js';
import { alFotograma } from '../core/loop.js';
import { easeOutExpo, movimientoReducido, numero } from '../core/util.js';

const DURACION = 1500;

export function montarContadores() {
  const objetivos = $$('[data-contador]');
  if (!objetivos.length) return () => {};

  const pendientes = new Set();

  /* Las bajas de los fotogramas en marcha. `quitar` se guarda en una
     closure dentro de `animar()` y la limpieza no la alcanzaba: tras un
     `pagehide` los suscriptores seguían corriendo hasta 1,5 s y `numero()`
     seguía escribiendo en nodos que ya no estaban en pantalla. Ahora se
     guardan en un `Map` y la limpieza puede soltarlos todos. */
  const bajas = new Map();

  if (movimientoReducido() || !('IntersectionObserver' in window)) {
    for (const nodo of objetivos) {
      nodo.textContent = `${numero(Number(nodo.dataset.contador))}${nodo.dataset.sufijo ?? ''}`;
    }
    return () => {};
  }

  function animar(nodo) {
    const destino = Number(nodo.dataset.contador) || 0;
    const sufijo = nodo.dataset.sufijo ?? '';
    const inicio = performance.now();

    const quitar = alFotograma((_, ahora) => {
      const t = Math.min(1, (ahora - inicio) / DURACION);
      const valor = destino * easeOutExpo(t);
      nodo.textContent = `${numero(valor)}${sufijo}`;

      if (t >= 1) {
        nodo.textContent = `${numero(destino)}${sufijo}`;
        quitar();
        bajas.delete(nodo);
        pendientes.delete(nodo);
      }
    });

    bajas.set(nodo, quitar);
    pendientes.add(nodo);
  }

  const observador = new IntersectionObserver(
    (entradas, observer) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        observer.unobserve(entrada.target);
        animar(entrada.target);
      }
    },
    { threshold: 0.6 },
  );

  objetivos.forEach((nodo) => observador.observe(nodo));

  return () => {
    observador.disconnect();
    for (const baja of bajas.values()) baja();
    bajas.clear();
    for (const nodo of pendientes) nodo.textContent = `${numero(Number(nodo.dataset.contador))}${nodo.dataset.sufijo ?? ''}`;
    pendientes.clear();
  };
}
