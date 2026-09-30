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

let lenis = null;
let alturaCabecera = 74;
let limpiarScrollSuave = null;

/** La altura de la cabecera se lee una vez y se reutiliza. */
function alturaDeCabecera() {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
  const valor = parseFloat(bruto);
  return Number.isFinite(valor) ? valor : alturaCabecera;
}

/**
 * Monta el suavizado de scroll.
 *
 * Solo se activa en escritorio. En táctil se usa el scroll nativo, con la
 * amortiguación de cámara que ya da el peso: `syncTouch` de Lenis tiene
 * problemas conocidos en iOS y no compensa arriesgar el scroll en el móvil.
 *
 * @returns {{activo: boolean, destruir: () => void}}
 */
export function montarScrollSuave() {
  alturaCabecera = alturaDeCabecera();

  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tactil = matchMedia('(pointer: coarse)').matches;
  const escritorio = matchMedia('(min-width: 900px)').matches;

  if (reducido || tactil || !escritorio) {
    return { activo: false, destruir: () => {} };
  }

  let instancia = null;

  // El módulo se carga aquí, no arriba del todo: son 8 KB que solo hacen
  // falta en escritorio, y no tiene sentido pedirlos en un móvil.
  import('../../vendor/lenis/1.3.26/lenis.mjs')
    .then(({ default: Lenis }) => {
      if (lenis) return; // ya montado: no duplicar
      instancia = new Lenis({
        duration: 1.05,
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

  return {
    get activo() {
      return Boolean(instancia);
    },
    destruir() {
      instancia?.destroy();
      lenis = null;
      limpiarScrollSuave?.();
      limpiarScrollSuave = null;
      document.documentElement.classList.remove('lenis');
      delete document.documentElement.dataset.scroll;
    },
  };
}

/** ¿Hay Lenis montado y en marcha? */
export function scrollSuaveActivo() {
  return Boolean(lenis);
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
      duration: opciones.inmediato ? 0 : 1.05,
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

/** Desplaza a una posición absoluta del documento. */
export function desplazarAposicion(posicion, { inmediato = false } = {}) {
  const objetivo = Math.max(0, posicion);
  if (lenis) {
    lenis.scrollTo(objetivo, { immediate: inmediato, duration: inmediato ? 0 : 1.05 });
    return;
  }
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
 * Recalibra Lenis tras un cambio de altura del documento.
 *
 * Sin esto, Lenis sigue creyendo que la página es de la altura anterior y
 * el scroll se queda corto: no deja llegar al final.
 */
export function recalibrarScroll() {
  lenis?.resize();
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

  window.addEventListener('resize', alRedimensionar, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(recalibrar, 320), { passive: true });

  return () => {
    clearTimeout(tictac);
    window.removeEventListener('resize', alRedimensionar);
  };
}
