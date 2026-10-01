/**
 * modules/aviso.js — Avisos efímeros.
 *
 * Una línea de texto que aparece, dice algo que el visitante acaba de hacer
 * y se retira. No es un modal ni una alerta: es el confirmarse de que una
 * acción que no produce un resultado visible —cambiar la calidad, parar el
 * viaje guiado— se aplicó de verdad.
 *
 * ── POR QUÉ UN NODO EN EL DOM Y NO UN `alert` ─────────────────────────
 *
 * `alert()` bloquea el hilo, corta la animación que se estaba viendo y es
 * la forma más rápida de que un sitio premium parezca un formulario del
 * 2004. Un aviso que se retira solo no interrumpe nada, y en una página
 * donde el contenido se lee mirando el espacio, tapar la pantalla es
 * justamente lo que no hay que hacer.
 *
 * ── ACCESIBILIDAD ─────────────────────────────────────────────────────
 *
 * El contenedor es `role="status"` con `aria-live="polite"`. Un lector de
 * pantalla anuncia el texto cuando llega y no corta nada de lo que estuviera
 * leyendo. Los avisos que generan un cambio de estado real —"calidad
 * ajustada"— llevan además `role="status"` en lugar de `alert`, porque no
 * son una error: son una confirmación.
 *
 * ── UNA COLA, NO UN MONTÓN ────────────────────────────────────────────
 *
 * Si llegan dos avisos seguidos —el visitante gira dos veces el selector
 * rápido— no se pisan. Cada uno espera su turno, y si hay más de dos en
 * cola los antiguos se descartan: al visitante no le sirve la confirmación de
 * algo que ya confirmó hace cuatro segundos.
 */

import { crear } from '../core/dom.js';

/** Avisos simultáneos. El cuarto descarta al primero. */
const MAXIMO = 3;

/** Tiempo en pantalla de cada aviso. */
const DURACION = 4200;

/** Margen para que dos avisos no se solapen al aparecer. */
const SOLAPE = 160;

export function montarAviso() {
  const pila = crear('div', {
    class: 'avisos',
    id: 'avisos',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  });
  document.body.append(pila);

  /** Avisos vivos, del más antiguo al más reciente. */
  const vivos = [];

  function retirar(nodo) {
    const i = vivos.indexOf(nodo);
    if (i !== -1) vivos.splice(i, 1);
    nodo.dataset.saliendo = '1';

    const baja = () => {
      nodo.remove();
    };
    // La retirada espera a que la transición termine, y no a un plazo fijo:
    // si el visitor tiene `prefers-reduced-motion` la transición es
    // instantánea y esperar más solo dejaría el nodo ahí un rato de más.
    nodo.addEventListener('transitionend', baja, { once: true });
    window.setTimeout(baja, 700);
  }

  /**
   * Muestra un aviso.
   *
   * @param {string} texto  La línea principal. Corta, sin punto final: en un
   *   aviso caben unas pocas palabras, y una que se corta a media frase se
   *   lee como un error.
   * @param {object} [opciones]
   * @param {string} [opciones.detalle]  Una segunda línea que explica por
   *   qué. Es lo que distingue un aviso útil de un cartel: "Ligera" dice lo
   *   que pasó, "Recargando para reconstruir la escena" dice si al usuario
   *   le tiene que importar. Cuando falta, el aviso es de una sola línea.
   * @param {string} [opciones.tipo]  `'info' | 'exito' | 'aviso'`. Cambia el
   *   punto de color y nada más: ninguno de los tres es un error, así que
   *   los tres merecen el mismo trato del lector de pantalla.
   */
  function mostrar(texto, { tipo = 'info', detalle = '' } = {}) {
    const contenido = String(texto ?? '').trim();
    if (!contenido) return () => {};

    // El más antiguo se va si ya no caben. El aviso que se retira por
    // descarte no avisa de nada: la pila los apila hacia abajo y el
    // descarte es invisible, que es lo único razonable aquí.
    while (vivos.length >= MAXIMO) {
      const sobrante = vivos.shift();
      sobrante?.remove();
    }

    const nodo = crear('div', { class: 'aviso-flotante', dataset: { tipo } });
    nodo.append(crear('span', { class: 'aviso-flotante__punto', 'aria-hidden': 'true' }));

    const cuerpo = crear('span', { class: 'aviso-flotante__cuerpo' });
    cuerpo.append(crear('span', { class: 'aviso-flotante__texto', text: contenido }));
    if (String(detalle).trim()) {
      cuerpo.append(crear('span', { class: 'aviso-flotante__detalle', text: String(detalle).trim() }));
    }
    nodo.append(cuerpo);

    pila.append(nodo);
    vivos.push(nodo);

    const tictac = window.setTimeout(() => retirar(nodo), DURACION + (detalle ? 900 : 0));

    return () => {
      window.clearTimeout(tictac);
      retirar(nodo);
    };
  }

  /* Avisos que se acumulan en el mismo tick —el `change` de un `<select>`
     dispara una vez, pero un gesto de rueda de sesenta eventos por segundo no— se
     separan un poco para que se lean como una secuencia y no como un
     bloque. */
  let anterior = 0;
  const encolar = (texto, opciones) => {
    const ahora = performance.now();
    const esperar = Math.max(0, SOLAPE - (ahora - anterior));
    anterior = ahora;
    if (esperar === 0) return mostrar(texto, opciones);
    return window.setTimeout(() => mostrar(texto, opciones), esperar);
  };

  return {
    nodo: pila,
    mostrar,
    encolar,

    destroy() {
      for (const nodo of vivos) nodo.remove();
      vivos.length = 0;
      pila.remove();
    },
  };
}
