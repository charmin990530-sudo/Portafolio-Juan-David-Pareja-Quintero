/**
 * modules/calidadVisual.js — Selector de calidad visual, en la cabecera.
 *
 * ── QUÉ ES ────────────────────────────────────────────────────────────
 *
 * Hasta ahora la calidad era una decisión que tomaba la máquina y que el
 * visitante no podía ver ni cambiar: la detección de `universo/calidad.js`
 * elegía un nivel, y si se equivocaba —un portátil con la GPU en modo de
 * ahorro, un móvil que se despierta a medias— no había manera de arreglarlo
 * sin abrir la consola.
 *
 * El selector lo resuelve en un gesto y además lo explica: al elegir
 * aparece un aviso que dice qué se va a cambiar y por qué. Un control que
 * se mueve solo necesita una frase que lo justifique.
 *
 * ── POR QUÉ UNA RECARGA Y NO UN CAMBIO EN VIVO ─────────────────────────
 *
 * Los presupuestos de calidad de este proyecto no son ajustes de un objeto
 * que ya existe: son triángulos, puntos de estrella, rocas y capas de
 * atmósfera que se cuentan al CONSTRUIR la escena. La densidad de píxeles,
 * el grano y el desenfoque de los paneles sí se pueden cambiar en caliente,
 * y así se cambian, pero un nivel que solo baja la resolución y deja los
 * 4 000 puntos de estrella igual no es el nivel que el selector promete.
 *
 * Cambiar de verdad la geometría significa desmontar la escena y construirla
 * otra vez, y a medio recorrido eso es un salto visible de medio mundo.
 * Recargar cuesta menos de un segundo en un sitio de este tamaño, deja la
 * cámara en un estado coherente y cumple lo que dice. Es la única decisión
 * de este archivo que no es elegante, y es la correcta.
 *
 * La excepción es "Sin 3D": esa vía ya existe entera y en vivo —la ejecuta
 * `universo/index.js` sin descargar nada—, así que también se ejecuta en
 * vivo. Un solo trato para el resto, y el mismo camino ya probado para
 * apagar el universo.
 */

import { $, crear } from '../core/dom.js';
import { almacen } from '../core/util.js';
import {
  CALIDAD,
  CLAVE_CALIDAD,
  CLAVE_SIMPLE,
  EVENTO_APAGAR,
  EVENTO_CALIDAD,
  esCalidadValida,
  universoActivo,
} from '../core/calidad.js';

const ETIQUETAS = {
  [CALIDAD.AUTO]: 'Auto',
  [CALIDAD.ALTO]: 'Alta',
  [CALIDAD.MEDIO]: 'Media',
  [CALIDAD.BAJO]: 'Ligera',
  [CALIDAD.OFF]: 'Sin 3D',
};

/**
 * Lo que se le dice al visitante en cada caso.
 *
 * Las cuatro primeras dicen la verdad sobre el motivo de la recarga, que es
 * lo que un selector de calidad nunca explica y es justo lo que hace que
 * alguien lo use en vez de asumir que el sitio va lento.
 */
const EXPLICACIONES = {
  [CALIDAD.ALTO]: 'Calidad alta. Recargando para reconstruir la escena.',
  [CALIDAD.MEDIO]: 'Calidad media. Recargando para reconstruir la escena.',
  [CALIDAD.BAJO]: 'Calidad ligera. Recargando para reconstruir la escena.',
  [CALIDAD.AUTO]: 'Calidad automática según tu equipo. Recargando.',
  [CALIDAD.OFF]: 'Sin escena 3D. El sitio conserva todo su contenido.',
};

/** Cuánto se espera a que el aviso se lea antes de recargar. */
const ESPERA_ANTES_DE_RECARGAR = 900;

export function montarCalidadVisual({ avisar } = {}) {
  const contenedor = $('#calidad-visual');
  const selector = $('#calidad-selector');

  /* Sin selector no hay nada que montar, y no es un error. */
  if (!contenedor || !selector) return () => {};

  /* La preferencia manda; la clave antigua solo está para no cambiarle el
     sitio por sorpresa a quien ya la tenía. */
  const guardado = almacen.get(CLAVE_CALIDAD, null);
  const heredado = almacen.get(CLAVE_SIMPLE, false) === true ? CALIDAD.OFF : null;
  const inicial = esCalidadValida(guardado) ? guardado : (heredado ?? CALIDAD.AUTO);
  selector.value = inicial;

  /* Etiqueta visible junto al icono: un `<select>` no tiene donde poner su
     propio nombre, y un engranaje solo no le dice nada a quien no sabe qué
     es. Va marcada como decorativa porque el nombre de verdad lo lleva el
     `<label>` del contenedor. */
  const rotulo = crear('span', { class: 'calidad__rotulo', 'aria-hidden': 'true' });
  contenedor.append(rotulo);

  const pintarRotulo = () => {
    rotulo.textContent = ETIQUETAS[selector.value] ?? ETIQUETAS[CALIDAD.AUTO];
  };
  pintarRotulo();

  const alCambiar = () => {
    const elegido = esCalidadValida(selector.value) ? selector.value : CALIDAD.AUTO;
    pintarRotulo();
    almacen.set(CLAVE_CALIDAD, elegido);
    // La clave antigua deja de mandar desde ahora mismo: si se queda puesta
    // y mañana se borra la nueva, el sitio volvería a apagarse sin que nadie
    // lo hubiera pedido.
    almacen.borrar(CLAVE_SIMPLE);

    avisar?.(ETIQUETAS[elegido], { detalle: EXPLICACIONES[elegido] });

    /* Apagar el 3D no necesita recargar: `universo/index.js` ya sabe
       hacerlo con lo que hay montado, y es el camino que usa el botón
       "Vista simple" del HUD. */
    if (elegido === CALIDAD.OFF) {
      if (universoActivo()) document.dispatchEvent(new CustomEvent(EVENTO_APAGAR));
      return;
    }

    /* El resto cambia la geometría, así que se reconstruye. El aviso va
       primero a propósito: si la recarga fuera inmediata, el visitante vería
       un parpadeo y ninguna explicación. */
    window.setTimeout(() => window.location.reload(), ESPERA_ANTES_DE_RECARGAR);
  };

  selector.addEventListener('change', alCambiar);

  /* Un segundo camino llega al mismo estado sin pasar por el `<select>`: el
     botón "Vista simple" del HUD. Si el selector no se pone al día, el
     control mentiría sobre lo que está pasando. */
  const alCambiarDesdeElHud = (evento) => {
    const valor = evento.detail?.estado;
    if (!esCalidadValida(valor) || selector.value === valor) return;
    selector.value = valor;
    pintarRotulo();
  };

  document.addEventListener(EVENTO_CALIDAD, alCambiarDesdeElHud);

  return () => {
    selector.removeEventListener('change', alCambiar);
    document.removeEventListener(EVENTO_CALIDAD, alCambiarDesdeElHud);
    rotulo.remove();
  };
}
