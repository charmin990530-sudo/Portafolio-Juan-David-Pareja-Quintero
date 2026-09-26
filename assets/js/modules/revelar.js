/**
 * modules/revelar.js — Aparición de bloques al entrar en pantalla.
 *
 * Un único IntersectionObserver para todos los elementos marcados con
 * `data-revelar`. El retardo escalonado se calcula a partir de la
 * posición del elemento dentro de su contenedor, de modo que las
 * tarjetas de una rejilla entran en cascada sin tocar el HTML.
 */

import { $$ } from '../core/dom.js';
import { movimientoReducido } from '../core/util.js';

const RETARDO_MAXIMO = 5;
const SALTO_MS = 90;

export function montarRevelar() {
  const objetivos = $$('[data-revelar]');
  if (!objetivos.length) return () => {};

  if (movimientoReducido() || !('IntersectionObserver' in window)) {
    objetivos.forEach((nodo) => {
      nodo.dataset.visible = '1';
    });
    return () => {};
  }

  // Retardo en cascada: hasta 5 hermanos escalonan 90 ms cada uno.
  const grupos = new Map();
  for (const nodo of objetivos) {
    const contenedor = nodo.parentElement;
    const indice = grupos.get(contenedor) ?? 0;
    grupos.set(contenedor, indice + 1);
    nodo.style.setProperty('--revelar-retardo', `${Math.min(indice, RETARDO_MAXIMO) * SALTO_MS}ms`);
  }

  const observador = new IntersectionObserver(
    (entradas, observer) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        entrada.target.dataset.visible = '1';
        observer.unobserve(entrada.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  objetivos.forEach((nodo) => observador.observe(nodo));

  return () => observador.disconnect();
}
