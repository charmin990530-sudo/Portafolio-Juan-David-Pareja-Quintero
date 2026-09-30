/**
 * main.js — Punto de entrada.
 *
 * Orden de arranque:
 *   1. el tema se aplica antes de pintar (evita el destello de color),
 *   2. el preloader espera los recursos críticos,
 *   3. se montan los módulos independientes entre sí,
 *   4. y POR ÚLTIMO el universo, que es lo único que descarga código
 *      grande y no puede ir antes.
 *
 * Cada módulo devuelve su función de limpieza: si algo falla, el resto
 * del sitio sigue funcionando.
 *
 * POR QUÉ EL UNIVERSO VA AL FINAL Y NO EN LA LISTA
 * Three.js son 417 KB gzip. Si el universo se montara en paralelo con lo
 * demás, el `import()` dinámico competiría con las fuentes preloaded y con
 * la imagen del retrato por el ancho de banda, y el LCP —que aquí es el
 * `<h1>` de la portada— se iría de 1,2 s a más de 3. Montándolo al final,
 * el titular ya está pintado y el universo aparece encima.
 *
 * La espera explícita de las fuentes no es opcional: hasta que `document.
 * fonts.ready` no resuelve, el documento cambia de alto dos veces y la
 * calibración de la cámara apuntaría a secciones desplazadas.
 */

import { montarPreloader } from './modules/preloader.js';
import { montarTema } from './modules/tema.js';
import { montarCabecera, montarProgreso } from './modules/cabecera.js';
import { montarFondo } from './modules/fondo.js';
import { montarCursor } from './modules/cursor.js';
import { montarRevelar } from './modules/revelar.js';
import { montarHero } from './modules/hero.js';
import { montarMarquesina, montarStack } from './modules/contenido.js';
import { montarContadores } from './modules/contadores.js';
import { montarProceso } from './modules/proceso.js';
import { montarContacto } from './modules/contacto.js';
import { $, $$ } from './core/dom.js';

/** Ejecuta un módulo sin dejar que un fallotumbe el resto. */
function seguro(nombre, montar) {
  try {
    return montar();
  } catch (error) {
    console.error(`[odisea] no se pudo montar "${nombre}"`, error);
    return () => {};
  }
}

function desplazarSuave() {
  document.addEventListener('click', (evento) => {
    const enlace = evento.target instanceof Element ? evento.target.closest('a[href^="#"]') : null;
    if (!enlace) return;

    const id = enlace.getAttribute('href').slice(1);
    if (!id) return;

    const destino = document.getElementById(id);
    if (!destino) return;

    evento.preventDefault();

    const alturaCabecera = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 74;
    const superior = destino.getBoundingClientRect().top + window.scrollY - alturaCabecera - 12;

    window.scrollTo({ top: Math.max(0, superior), behavior: 'smooth' });
    destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
    history.replaceState(null, '', `#${id}`);
  });
}

async function iniciar() {
  document.documentElement.classList.add('js');

  // El tema arranca de inmediato: va antes de cualquierMeasurement visual.
  seguro('tema', montarTema);

  await seguro('preloader', montarPreloader);

  const montajes = [
    ['fondo', montarFondo],
    ['cabecera', montarCabecera],
    ['progreso', montarProgreso],
    ['cursor', montarCursor],
    ['hero', montarHero],
    ['marquesina', montarMarquesina],
    ['contadores', montarContadores],
    ['stack', montarStack],
    ['proceso', montarProceso],
    ['contacto', montarContacto],
    ['revelar', montarRevelar],
    ['desplazamiento', () => { desplazarSuave(); return () => {}; }],
  ];

  const limpiezas = montajes.map(([nombre, montar]) => seguro(nombre, montar));

  // Red de seguridad: si tras 5 s algo sigue oculto (observador que no
  // disparó por un fallo de layout), se revela igualmente.
  window.setTimeout(() => {
    for (const nodo of $$('[data-revelar]')) {
      if (!nodo.dataset.visible) nodo.dataset.visible = '1';
    }
  }, 5000);

  window.addEventListener('pagehide', () => {
    for (const limpieza of limpiezas) {
      try {
        limpieza?.();
      } catch {
        /* nada que hacer al descargar */
      }
    }
  });

  document.body.dataset.listo = '1';

  // El universo va después de todo lo demás y sin bloquear: el sitio
  // queda utilizable mientras Three.js baja, y si algo falla, el sitio
  // sigue siendo el sitio.
  montarUniverso();
}

/**
 * Monta el universo sin bloquear ni propagar errores.
 *
 * `montarUniverso` ya resuelve en todos los casos, incluido el de "no hay
 * WebGL" o "movimiento reducido". Aquí solo se añade el retardo para que
 * no compita con las fuentes y con el resto de recursos por el ancho de
 * banda, y una espera de `fonts.ready` porque la calibración de la cámara
 * depende de la altura real del documento.
 */
async function montarUniverso() {
  try {
    // Las fuentes web desplazan el documento cuando cambian. Montar el
    // universo antes de eso significa calibrar la cámara contra alturas
    // que luego van a ser distintas.
    if (document.fonts?.ready) await document.fonts.ready;

    // Un respiro: deja que el navegador termine de pintar el primer
    // fotograma visible con el titular ya en su sitio. Sin él, la descarga
    // de Three.js compite con el pintado de la portada.
    await new Promise((resolver) => requestIdleCallback?.(resolver, { timeout: 900 }) ?? setTimeout(resolver, 240));

    const { montarUniverso: montar } = await import('./universo/index.js');
    const resultado = await montar({ lienzo: $('#universo-lienzo') });

    if (resultado.estado === 'completo') {
      // Segunda calibración: con las fuentes ya cargadas y el universo
      // montado, el documento tiene su altura definitiva.
      resultado.escena.recalibrar();
    }
  } catch (error) {
    // El universo es un extra. Si falla, el sitio sigue en pie.
    console.error('[odisea] el universo no se montó', error);
    $('#universo-lienzo')?.remove();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
  iniciar();
}
