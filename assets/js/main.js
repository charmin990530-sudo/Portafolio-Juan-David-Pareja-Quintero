/**
 * main.js — Punto de entrada.
 *
 * Orden de arranque:
 *   1. el tema se aplica antes de pintar (evita el destello de color),
 *   2. el preloader espera los recursos críticos,
 *   3. se montan los módulos independientes entre sí.
 *
 * Cada módulo devuelve su función de limpieza: si algo falla, el resto
 * del sitio sigue funcionando.
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
  iniciar();
}
