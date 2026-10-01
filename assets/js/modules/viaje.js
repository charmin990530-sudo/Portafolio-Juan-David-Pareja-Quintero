/**
 * modules/viaje.js — Recorrido guiado: el botón de "Iniciar viaje".
 *
 * ── QUÉ ES ────────────────────────────────────────────────────────────
 *
 * Un botón en la portada que deja de ser un enlace y se convierte en una
 * salida dirigida: el sitio se va solo de sistema en sistema, con las barras
 * de cine cerrándose, la cabecera desapareciendo y un contador que dice
 * dónde va. Se para con un botón, con `Escape`, o con el primer gesto del
 * visitante, que siempre gana.
 *
 * ── POR QUÉ NO ES UN `scrollTo` Y YA ───────────────────────────────────
 *
 * Porque un salto a cada sección con un temporizador entre medias es
 * exactamente el patrón que hace que un sitio se sienta como una
 * presentación: cortes, no travelling. Lo que hay aquí es una cadena de
 * movimientos encadenados por el suavizado del sitio, con una parada en
 * cada sistema para que el texto se pueda leer. El efecto que produce —"esto
 * se cuenta" en vez de "esto se muestra"— viene de la duración, no de la
 * cantidad de scroll.
 *
 * ── UN SOLO MOTOR DE SCROLL, TAMBIÉN AQUÍ ───────────────────────────────
 *
 * El recorrido no escribe `scrollY` a pelo. Pide cada parada a
 * `core/desplazar.js`, que es el único módulo del sitio que mueve el
 * scroll, y deja que sea Lenis quien anime. Si este módulo escribiera
 * `window.scrollTo` por su cuenta, tendría una segunda autoridad sobre el
 * scroll y las dos se pelearían por el mismo píxel. Es el error que
 * documenta `ESTUDIO.md` §3.2, y aparece en cuanto hay dos manos en la
 * misma rueda.
 *
 * Lo único que este módulo mueve por su cuenta es lo que Lenis no lleva:
 * leer `scrollY` en cada fotograma para saber por dónde va y, con eso,
 * actualizar el contador y la línea de la parte baja.
 *
 * ── INTERRUPCIÓN ──────────────────────────────────────────────────────
 *
 * Cualquier gesto del visitante —rueda, dedo, teclas de desplazamiento,
 * clic en un enlace— detiene el recorrido. Es la regla que separa un
 * recorrido de un secuestro del scroll: la interfaz cede el control en
 * cuanto se le pide y no pide permiso. Por eso `Escape` funciona, por eso
 * el botón de parar está siempre visible, y por eso el recorrido ni
 * siquiera existe con movimiento reducido.
 */

import { $, crear } from '../core/dom.js';
import { alFotograma } from '../core/loop.js';
import { clamp, movimientoReducido } from '../core/util.js';
import { altoDesplazable, alturaCabecera, desplazarAposicion } from '../core/desplazar.js';
import { SISTEMAS } from '../data/universo.js';

/* ------------------------------------------------------------------
   Ritmo del recorrido

   Los tres números que deciden cómo se siente, y los tres están aquí y no
   repartidos por el código: cuánto dura cada salto, cuánto se espera en
   cada sistema, y cuánto baja de la parte alta de la sección donde se
   detiene.
   ------------------------------------------------------------------ */

/** Duración de un salto, en milisegundos. */
const DURACION_MINIMA = 1500;
const DURACION_MAXIMA = 3600;

/** Espera en cada sistema, para leer lo que hay. */
const PAUSA_EN_PARADA = 2000;

/** Margen que se deja bajo el título de la sección. */
const REJILLA = 12;

/** Margen para la holgura del temporizador sobre la animación. */
const HOLGURA = 260;

/**
 * Cuánto dura un salto.
 *
 * Crece con la distancia, con topes. Tres mil píxeles en 1,5 segundos son
 * dos mil píxeles por segundo, y eso se lee como un teletransporte, no como
 * una cámara. Y un tramo corto no puede quedarse tirante esperando a que
 * venza un plazo fijo.
 */
function duracionPara(distancia) {
  return clamp(700 + distancia / 2.2, DURACION_MINIMA, DURACION_MAXIMA);
}

export function montarViaje({ avisar = () => {} } = {}) {
  const boton = $('#viaje-iniciar');
  const raiz = document.documentElement;

  const paradas = SISTEMAS.filter((s) => document.getElementById(s.seccion) !== null).map(
    (sistema) => ({
      id: sistema.seccion,
      nombre: sistema.etiqueta,
      nodo: document.getElementById(sistema.seccion),
    }),
  );

  /* Con menos de tres secciones el recorrido no es un recorrido: es un
     salto, y un salto ya lo hacen los enlaces del menú. Y con movimiento
     reducido no se monta siquiera: un avance automático de la página es
     justo lo que esa preferencia dice que no se haga. */
  if (!boton || paradas.length < 3 || movimientoReducido()) {
    boton?.remove();
    return () => {};
  }

  /* ---- Marco de cine y panel de lectura ---- */
  const marco = crear('div', { class: 'viaje-marco', 'aria-hidden': 'true' });
  marco.append(
    crear('span', { class: 'viaje-marco__barra viaje-marco__barra--arriba' }),
    crear('span', { class: 'viaje-marco__barra viaje-marco__barra--abajo' }),
  );

  const cuenta = crear('span', { class: 'viaje-panel__cuenta' });
  const nombre = crear('strong', { class: 'viaje-panel__nombre' });
  const lectura = crear('p', {
    class: 'viaje-panel__lectura mono',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  lectura.append(crear('span', { class: 'viaje-panel__pulso', 'aria-hidden': 'true' }), cuenta, nombre);

  const botonParar = crear('button', {
    class: 'viaje-panel__parar',
    type: 'button',
    text: 'Detener',
  });

  const panel = crear('div', {
    class: 'viaje-panel',
    role: 'region',
    'aria-label': 'Recorrido guiado por el sitio',
  });
  panel.append(crear('span', { class: 'viaje-panel__riel', 'aria-hidden': 'true' }), lectura, botonParar);

  document.body.append(marco, panel);

  /* ---- Estado ---- */
  let activo = false;
  let baja = null;
  let tictac = 0;
  let indiceActual = -1;

  /* Puntos de destino en píxeles absolutos de documento. Se miden al
     arrancar y no al montar el módulo: entre las dos cosas pasan dos cosas
     que cambian la altura del documento, el preloader y el universo. Medir
     antes daría destinos equivocados. */
  let puntos = [];

  function medirParadas() {
    const cabecera = alturaCabecera();
    const maximo = Math.max(0, altoDesplazable());
    puntos = paradas.map((parada) => {
      const caja = parada.nodo.getBoundingClientRect();
      const bruto = caja.top + window.scrollY - cabecera - REJILLA;
      return clamp(bruto, 0, maximo);
    });
  }

  function pintarLectura(indice) {
    if (indice === indiceActual) return;
    indiceActual = indice;
    const parada = paradas[indice];
    if (!parada) return;
    cuenta.textContent = `${String(indice + 1).padStart(2, '0')} / ${String(paradas.length).padStart(2, '0')} · `;
    nombre.textContent = parada.nombre;
  }

  /* ----------------------------------------------------------------
     El bucle: solo lee el scroll, nunca lo escribe
     ---------------------------------------------------------------- */

  function fotograma() {
    if (!activo) return;

    const y = window.scrollY;
    const avance = clamp(y / Math.max(1, altoDesplazable()), 0, 1);
    raiz.style.setProperty('--viaje-avance', avance.toFixed(4));

    /* La parada que toca es la última a la que la cámara ya ha llegado, no
       la más cercana en pantalla. Con las posiciones ya medidas en píxeles
       esto no necesita ni un `getBoundingClientRect()`: leer la caja de
       siete secciones en cada fotograma costaría un reflow por
       fotograma, que es justo lo que este módulo viene a evitar. */
    let encontrado = 0;
    for (let i = 0; i < puntos.length; i += 1) {
      if (puntos[i] <= y + window.innerHeight * 0.6) encontrado = i;
      else break;
    }
    pintarLectura(encontrado);
  }

  /* ── OJO CON EL NOMBRE DE ESTE PARÁMETRO ─────────────────────────────
     La opción se llama `notificar` y NO `avisar`. `avisar` es la función
     que llega por injectable desde `main.js`, y un parámetro con el mismo
     nombre la tapaba dentro de esta función: `avisar?.(...)` acababa
     intentando llamar al booleano, y el error salía al DETENER el
     recorrido —que es justo el camino que se ejecuta cuando algo va mal.
     Nada en el arranque lo delata. */
  function parar({ devolverFoco = true, notificar = false } = {}) {
    if (!activo) return;
    activo = false;

    window.clearTimeout(tictac);
    baja?.();
    baja = null;

    delete raiz.dataset.viaje;
    raiz.style.removeProperty('--viaje-avance');
    delete boton.dataset.activo;

    if (devolverFoco) boton.focus({ preventScroll: true });
    if (notificar) avisar('Recorrido detenido. Tú mandas.');
  }

  function arrancar() {
    if (activo) return;

    medirParadas();

    /* Se arranca en la primera parada por delante de la posición actual: si
       el visitante está a mitad del recorrido y pulsa el botón, el viaje
       tiene que continuar hacia donde va, no devolverlo a la portada. */
    let desde = 0;
    for (let i = 0; i < puntos.length; i += 1) {
      if (puntos[i] <= window.scrollY + 8) desde = i;
    }
    if (desde >= puntos.length - 1) desde = 0;

    activo = true;
    indiceActual = -1;
    raiz.dataset.viaje = 'activo';
    boton.dataset.activo = '1';

    /* El foco se va al botón de parar de inmediato. Mientras el recorrido
       avanza, `Escape` tiene que funcionar, y `Escape` solo hace algo si el
       foco está dentro de la página. Con el foco ahí, además, el recorrido
       del tabulador no se pasea por debajo de la cortina de cine. */
    window.setTimeout(() => botonParar.focus({ preventScroll: true }), 60);

    baja = alFotograma(fotograma);

    let indice = desde;
    let reintentos = 0;

    const avanzar = () => {
      if (!activo) return;

      const objetivo = puntos[indice];
      const distancia = Math.abs(objetivo - window.scrollY);

      /* Si ya está en la parada, se lee el texto y se sigue. Un salto largo
         puede no llegar nunca —el visitante cambió la altura de la ventana a
         media travesía—, así que hay un reintento por parada y a la tercera
         se abandona en lugar de quedarse llamando al scroll para siempre. */
      if (distancia < 8) {
        reintentos = 0;
        pintarLectura(indice);

        if (indice >= puntos.length - 1) {
          tictac = window.setTimeout(() => parar({ notificar: true }), PAUSA_EN_PARADA);
          return;
        }

        tictac = window.setTimeout(() => {
          indice += 1;
          avanzar();
        }, PAUSA_EN_PARADA);
        return;
      }

      if (reintentos >= 3) {
        parar({ notificar: true });
        return;
      }
      reintentos += 1;

      const duracion = duracionPara(distancia);
      desplazarAposicion(objetivo, { duracion });
      tictac = window.setTimeout(avanzar, duracion + HOLGURA);
    };

    avanzar();
  }

  /* ----------------------------------------------------------------
     Interrupción: el visitante siempre gana
     ---------------------------------------------------------------- */
  const alGesto = () => parar();

  const TECLAS = new Set([
    'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar',
  ]);

  const alTecla = (evento) => {
    if (!activo) return;
    if (evento.key === 'Escape') {
      evento.preventDefault();
      parar({ notificar: true });
      return;
    }
    if (TECLAS.has(evento.key)) parar();
  };

  /* Un clic en cualquier enlace también corta el recorrido: si el visitante
     decide que ya sabe dónde iba, el viaje se termina. */
  const alClic = (evento) => {
    if (!activo) return;
    if (evento.target instanceof Element && evento.target.closest('a[href]')) parar();
  };

  boton.addEventListener('click', arrancar);
  botonParar.addEventListener('click', () => parar({ notificar: true }));

  const GESTOS = ['wheel', 'touchstart'];
  for (const gesto of GESTOS) window.addEventListener(gesto, alGesto, { passive: true });
  window.addEventListener('keydown', alTecla);
  document.addEventListener('click', alClic);

  return () => {
    parar({ devolverFoco: false });
    boton.removeEventListener('click', arrancar);
    botonParar.removeEventListener('click', () => parar({ notificar: true }));
    for (const gesto of GESTOS) window.removeEventListener(gesto, alGesto);
    window.removeEventListener('keydown', alTecla);
    document.removeEventListener('click', alClic);
    marco.remove();
    panel.remove();
  };
}
