/**
 * core/_desplazar.js — La ÚNICA forma de mover el scroll en el sitio.
 *
 * ── EL PROBLEMA ─────────────────────────────────────────────────────
 *
 * Antes de este módulo había tres sitios distintos que llamaban a
 * `window.scrollTo` o confiaban en `scroll-behavior: smooth`:
 *
 *   · `main.js`            enlaces ancla del menú y del pie
 *   · `modules/cabecera.js` el botón "volver arriba"
 *   · `modules/proceso.js`  los nodos del diagrama de etapas
 *
 * Con scroll nativo, cada uno se apañaba como podía. Al meter Lenis, que
 * es quien suaviza, un `scrollTo` nativo entra en conflicto con él: la
 * página se mueve dos veces, una por Lenis y otra por el navegador, y el
 * salto se ve como un tirón.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────
 *
 * Aquí hay un solo `scrollTo`. Quien quiera mover el scroll llama a
 * `desplazarA()`, que decide si usa Lenis o el nativo. Y el sitio tiene
 * `scroll-behavior: auto` en el `<html>`, porque cuando el suavizado lo
 * aporta Lenis, el del CSS estorba.
 *
 * ── POR QUÉ LENIS Y NO GSAP SCROLLTRIGGER ───────────────────────────
 *
 * Se evaluó Lenis + GSAP ScrollTrigger y se descartó. ScrollTrigger pesa
 * del orden de 70 KB gzip y, más importante, aquí no hace falta: todas las
 * animaciones del sitio son el timeline de la cámara, el `IntersectionObserver`
 * de `revelar.js` o el mecanismo de `proceso.js`. Meter un segundo sistema
 * de timelines que hay que mantener sincronizado es exactamente el fallo
 * que documenta la literatura de GSAP: dos bucles de animación
 * independientes hacen que uno lea una posición obsoleta.
 *
 * Lo que sí hace falta de Lenis, y es la razón de los 8 KB, es la SEÑAL DE
 * VELOCIDAD: alarga las estelas de las estrellas, abre el FOV y sube el
 * resplandor. El scroll nativo da esa señal sucia.
 */

import { alFotograma } from './loop.js';
import { clamp, milisegundosASegundos } from './util.js';

let lenis = null;
let alturaCabeceraRespaldo = 74;
let limpiarScrollSuave = null;

/** Duración por defecto de un salto con Lenis, en segundos. */
const DURACION_SCROLL = 1.05;

/* ------------------------------------------------------------------
   ALTO DEL DOCUMENTO

   `document.documentElement.scrollHeight` es el ÚNICO modo que tiene el
   navegador de saber cuánto se puede desplazar, y leerlo obliga a vaciar
   la cola de diseño: si el documento está sucio, la lectura provoca un
   reflow síncrono completo.

   Y el documento estaba sucio. Tres cosas lo ensucian sin parar: este
   módulo escribe el scroll, `modules/cabecera.js` escribe `--avance` en
   cada evento de scroll, y el universo escribe `dataset.sistema` en el
   `<html>` de la escena que acaba de renderizar. Leyendo el alto después
   de cualquiera de las tres, cada evento de scroll y cada fotograma
   provocaba un layout completo de la página.

   Con layout forzado, la secuencia de un fotograma era: escribir, leer,
   escribir, leer. Es el patrón que más se nota en un móvil, y no aparece
   en un perfil de CPU de escritorio.

   La solución es que el alto se mida UNA vez y se reutilice, y que quien
   lo invalide lo diga: al redimensionar y al cargar las fuentes, que son
   las dos únicas cosas que lo cambian de verdad. Aquí y en `escena.js`
   hay ahora un solo origen para esa medida.
   ------------------------------------------------------------------ */

let altoDesplazado = 0;

/** Vuelve a medir el alto desplazable. Llámala cuando el documento cambia. */
export function refrescarAltoDocumento() {
  const alto = document.documentElement.scrollHeight - window.innerHeight;
  altoDesplazado = alto > 0 ? alto : 0;
  return altoDesplazado;
}

/** Píxeles desplazables del documento, sin provocar un reflow. */
export function altoDesplazable() {
  if (altoDesplazado <= 0) refrescarAltoDocumento();
  return altoDesplazado;
}

/**
 * Progreso de lectura del documento, 0..1.
 *
 * La misma cuenta la necesitan la barra de progreso de la cabecera y la
 * cámara del universo. Que la hagan los dos por su cuenta significaba dos
 * medidas por fotograma, cada una con su propio reflow.
 */
export function progresoDeLectura() {
  const alto = altoDesplazable();
  return alto > 0 ? clamp(window.scrollY / alto, 0, 1) : 0;
}

/** La altura de la cabecera se lee una vez y se reutiliza. */
function alturaDeCabecera() {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
  const valor = parseFloat(bruto);
  return Number.isFinite(valor) ? valor : alturaCabeceraRespaldo;
}

/**
 * Alto de la cabecera en píxeles, sin una relectura del estilo.
 *
 * Lo exporta para que quien vaya a parar el scroll en una posición
 * concreta —el recorrido guiado, que coloca cada parada por debajo del
 * título de su sección— mida lo mismo que mide el resto del sitio y las
 * paradas no acaben debajo de la barra.
 */
export function alturaCabecera() {
  return alturaDeCabecera();
}

/**
 * Monta el suavizado de scroll.
 *
 * Solo se activa en escritorio. En táctil se usa el scroll nativo, con la
 * amortiguación de cámara que ya da el peso: `syncTouch` de Lenis tiene
 * problemas conocidos en iOS y no compensa arriesgar el scroll en el móvil.
 *
 * @returns {() => void} Función de limpieza, como el resto de módulos del
 *   sitio. `main.js` la invoca en `pagehide`, así que devolver aquí un
 *   objeto en vez de una función haría que Lenis nunca se destruyera.
 *   Para consultar el estado, `scrollSuaveActivo()`.
 */
export function montarScrollSuave() {
  alturaCabeceraRespaldo = alturaDeCabecera();

  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tactil = matchMedia('(pointer: coarse)').matches;
  const escritorio = matchMedia('(min-width: 900px)').matches;

  /* `destruido` cierra la carrera contra la carga del módulo: si el sitio se
     desmonta antes de que llegue el `import()`, crear la instancia a posteriori
     dejaría un Lenis vivo sin nadie que lo llame. */
  let destruido = false;
  let instancia = null;
  let bajaDelBucle = null;

  const destruir = () => {
    destruido = true;
    bajaDelBucle?.();
    bajaDelBucle = null;
    instancia?.destroy();
    lenis = null;
    instancia = null;
    limpiarScrollSuave?.();
    limpiarScrollSuave = null;
    document.documentElement.classList.remove('lenis');
    delete document.documentElement.dataset.scroll;
  };

  if (reducido || tactil || !escritorio) return destruir;

  // El módulo se carga aquí, no arriba del todo: son 8 KB que solo hacen
  // falta en escritorio, y no tiene sentido pedirlos en un móvil.
  import('../../vendor/lenis/1.3.26/lenis.mjs')
    .then(({ default: Lenis }) => {
      if (destruido || lenis) return; // ya montado, o ya desmontado
      instancia = new Lenis({
        duration: DURACION_SCROLL,
        // `easing` con un expo suave: llega rápido y frena largo, que es
        // lo que pesa. Con el easing por defecto el final se nota blando.
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
        smoothWheel: true,
        // `syncTouch` se deja APAGADO a propósito. Suavizar el dedo en
        // táctil es justo lo que hace que un sitio se sienta pastoso, y
        // además tiene problemas conocidos en iOS.
        syncTouch: false,
        // Lenis respeta la preferencia de movimiento por su cuenta: con
        // `reduce` el suavizado se desactiva y el scroll va 1:1.
        respectReducedMotion: true,
      });
      lenis = instancia;

      /* ── LO QUE HACE QUE LENIS FUNCIONE ──────────────────────────────
         Lenis NO SE MUEVE SOLO. Su constructor pone `autoRaf: false`, y eso
         significa que hay que llamar a `lenis.raf(tiempo)` en cada
         fotograma: es el Integrador, el bucle es del sitio.

         Sin esta llamada el scroll no se rompe de forma visible: Lenis ya
         ha registrado su escuchador de rueda y ya ha hecho
         `preventDefault()`, así que anula el scroll nativo del navegador,
         pero su posición animada nunca avanza porque nadie le dice por
         dónde va el tiempo. El resultado es la rueda muerta y el teclado
         funcionando, que es la forma más difícil de diagnosticar que hay:
         la página está perfectamente desplazable, solo que no con la rueda.

         Se engancha a `core/loop.js` y no con un `requestAnimationFrame`
         propio para no tener dos bucles en la página, que es justo lo que
         ese módulo existe para evitar. */
      bajaDelBucle = alFotograma((_delta, ahora) => {
        instancia?.raf(ahora);
      });

      // Las reglas de CSS que el propio Lenis pide. Están aquí y no en un
      // archivo aparte para no añadir una petición bloqueante de 513 bytes.
      document.documentElement.classList.add('lenis');
      if (!document.getElementById('lenis-css')) {
        const estilo = document.createElement('style');
        estilo.id = 'lenis-css';
        estilo.textContent = `
          html.lenis, html.lenis body { height: auto; }
          .lenis:not(.lenis-autoToggle).lenis-stopped { overflow: clip; }
          .lenis [data-lenis-prevent] { overscroll-behavior: contain; }
        `.trim();
        document.head.append(estilo);
        limpiarScrollSuave = () => estilo.remove();
      }

      document.documentElement.dataset.scroll = 'suave';
    })
    .catch(() => {
      // Si Lenis no carga, el sitio sigue con scroll nativo. No es un
      // error que merezca más que un aviso en consola.
      console.warn('[scroll] Lenis no cargó; se usa el scroll nativo');
    });

  return destruir;
}

/**
 * Desplaza el documento hasta un elemento.
 *
 * El único punto de entrada para mover el scroll en todo el sitio.
 *
 * @param {Element|string} destino  Elemento o su `id`.
 * @param {object} [opciones]
 * @param {boolean} [opciones.inmediato] Sin animación. Para el enlace
 *   "atrás" del navegador o para cuando la distancia es enorme.
 * @param {number} [opciones.desplazamientoExtra]
 * @returns {boolean} Si encontró el destino.
 */
export function desplazarA(destino, opciones = {}) {
  const nodo = typeof destino === 'string' ? document.getElementById(destino) : destino;
  if (!nodo) return false;

  const superior =
    nodo.getBoundingClientRect().top + window.scrollY - alturaDeCabecera() - 12 + (opciones.desplazamientoExtra ?? 0);
  const objetivo = Math.max(0, superior);

  if (lenis) {
    lenis.scrollTo(objetivo, {
      // Enlace "atrás" o salto muy largo: sin animación. Animar 8 000 px
      // de golpe produce un mareo y tarda varios segundos.
      immediate: opciones.inmediato === true || objetivo - window.scrollY > 6000,
      duration: opciones.inmediato ? 0 : DURACION_SCROLL,
    });
    // El foco se mueve aquí y no en el manejador: el destino se ha
    // desplazado, así que ahora sí se puede calcular sin `preventScroll`.
    nodo.setAttribute('tabindex', '-1');
    nodo.focus({ preventScroll: true });
    return true;
  }

  window.scrollTo({
    top: objetivo,
    behavior: opciones.inmediato ? 'auto' : 'smooth',
  });
  nodo.setAttribute('tabindex', '-1');
  nodo.focus({ preventScroll: true });
  return true;
}

/**
 * Desplaza a una posición absoluta del documento.
 *
 * @param {number} posicion  Píxeles desde arriba.
 * @param {object} [opciones]
 * @param {boolean} [opciones.inmediato] Sin animación.
 * @param {number} [opciones.duracion]  Milisegundos, en vez del valor por
 *   defecto del sitio. Lo necesita el recorrido guiado, que encadena
 *   movimientos de duraciones distintas según lo lejos que esté cada
 *   parada: con una duración única, un salto corto se queda tirante
 *   esperando y uno largo se lee como un teletransporte.
 */
export function desplazarAposicion(posicion, { inmediato = false, duracion } = {}) {
  const objetivo = Math.max(0, posicion);

  /* ── MILISEGUNDOS DENTRO, SEGUNDOS HACIA LENIS ───────────────────────

     `duracion` se publica en milisegundos porque es lo que espera quien
     llama —el recorrido ya tenía sus constantes en ms—. Pero Lenis anima en
     SEGUNDOS: su `Animate.advance()` recibe el tiempo en segundos y calcula
     `currentTime / duration`. El valor por defecto del sitio, `DURACION_SCROLL
     = 1.05`, es correcto precisamente porque ya está en segundos.

     La conversión va AQUÍ y no en quien llama, por la misma razón que
     existe este módulo: una sola autoridad sobre el scroll, y una sola
     traducción de sus unidades.

     Sin esto el recorrido guiado no estaba lento: estaba roto. `duracionPara`
     devuelve entre 1 500 y 3 600, y eso se le pasaba a Lenis como si fueran
     segundos, así que cada parada se animaba en 25 o 60 minutos. La página se
     movía unos píxeles por segundo y el contador del panel no cambiaba nunca
     de sistema. No lo delataba ninguna comprobación: en un DOM de prueba no
     hay Lenis ni interpolación, así que `scrollTo` se ejecutaba y la prueba
     pasaba. Salió al abrirlo en un navegador de verdad y mirar si la página
     se movía. */
  const segundos = milisegundosASegundos(duracion) ?? DURACION_SCROLL;

  if (lenis) {
    lenis.scrollTo(objetivo, {
      immediate: inmediato,
      duration: inmediato ? 0 : segundos,
    });
    return;
  }

  /* Sin Lenis no hay forma de decir "tarda 2,4 segundos": el scroll nativo
     solo sabe ir a una velocidad o a otra. Se degrada a `smooth`, que es lo
     más cerca que se puede estar, y el recorrido sigue siendo legible. */
  window.scrollTo({ top: objetivo, behavior: inmediato ? 'auto' : 'smooth' });
}

/** Vuelve arriba, con animación corta. */
export function desplazarAlPrincipio() {
  if (lenis) {
    lenis.scrollTo(0, { duration: 0.85 });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Recalibra Lenis y el alto del documento tras un cambio de altura.
 *
 * Sin esto, Lenis sigue creyendo que la página es de la altura anterior y
 * el scroll se queda corto: no deja llegar al final. Y sin reponer el alto
 * cacheado, el progreso de lectura se quedaría congelado en el valor viejo.
 */
export function recalibrarScroll() {
  lenis?.resize();
  refrescarAltoDocumento();
}

/**
 * Delegado único para todos los enlaces ancla del sitio.
 *
 * Antes cada módulo tenía su propio manejador. Con uno solo se puede
 * garantizar que un enlace del menú, uno del pie y uno de una tarjeta
 * hacen exactamente lo mismo, incluido el ajuste por la cabecera y el
 * movimiento del foco, que es lo que necesita un lector de pantalla para
 * no perder el hilo.
 */
export function montarEnlacesAncla() {
  const alPulsar = (evento) => {
    // Se respeta que el visitante abra en pestaña nueva o con modificador.
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey || evento.button !== 0) return;

    const enlace = evento.target instanceof Element ? evento.target.closest('a[href^="#"]') : null;
    if (!enlace) return;

    const id = enlace.getAttribute('href').slice(1);
    if (!id) return;

    const destino = document.getElementById(id);
    if (!destino) return;

    evento.preventDefault();

    if (desplazarA(destino)) {
      history.replaceState(null, '', `#${id}`);
    }
  };

  document.addEventListener('click', alPulsar);

  return () => document.removeEventListener('click', alPulsar);
}

/**
 * Recalibra al cargar las fuentes y al girar el móvil.
 *
 * Las fuentes web cambian la altura del documento cuando se aplican, y en
 * móvil la barra de direcciones también. Las dos cosas dejan a Lenis
 * midiendo mal.
 */
export function montarRecalibrado() {
  const recalibrar = () => recalibrarScroll();

  document.fonts?.ready?.then(recalibrar);

  let tictac = 0;
  const alRedimensionar = () => {
    clearTimeout(tictac);
    // En móvil, la barra de direcciones dispara `resize` en cada pixel de
    // scroll. Sin este retardo, Lenis recalcularía sesenta veces por
    // segundo.
    tictac = window.setTimeout(recalibrar, 180);
  };

  /* El manejador de `orientationchange` se declara con nombre y no en línea.
     Con una función en línea es imposible de quitar después, y aquí el
     evento ocurre varias veces en una sesión móvil. */
  const alGirar = () => window.setTimeout(recalibrar, 320);

  window.addEventListener('resize', alRedimensionar, { passive: true });
  window.addEventListener('orientationchange', alGirar, { passive: true });

  return () => {
    clearTimeout(tictac);
    window.removeEventListener('resize', alRedimensionar);
    window.removeEventListener('orientationchange', alGirar);
  };
}
