/**
 * modules/cabecera.js — Comportamiento de la barra superior.
 *
 * · Se compacta y se cristaliza al dejar de estar en el tope.
 * · Marca la sección activa con un indicador que se desliza.
 * · Menú de pantalla completa en móvil con trampa de foco básica.
 */

import { $, $$, crear } from '../core/dom.js';
import { clamp } from '../core/util.js';

export function montarCabecera() {
  const cabecera = $('#cabecera');
  const navLista = $('.nav__lista');
  const indicador = $('#nav-marca');
  const enlaces = $$('.nav__enlace');
  const secciones = $$('main section[id]');
  const botonMenu = $('#hamburguesa');
  const menu = $('#menu');

  if (!cabecera) return null;

  /* ---------- Estado compacto ---------- */
  function compacta() {
    cabecera.dataset.fija = window.scrollY > 24 ? '1' : '0';
  }

  /* ---------- Indicador de sección activa ---------- */
  function moverIndicador(enlace) {
    if (!indicador || !navLista || !enlace) {
      if (indicador) indicador.dataset.visible = '0';
      return;
    }

    const destino = enlace.getBoundingClientRect();
    const caja = navLista.getBoundingClientRect();
    const desplazamiento = navLista.scrollLeft;

    indicador.style.setProperty('--nav-x', `${destino.left - caja.left + desplazamiento}px`);
    indicador.style.width = `${destino.width}px`;
    indicador.dataset.visible = '1';
  }

  function marcarActivo(id) {
    let activo = null;

    for (const enlace of enlaces) {
      const coincide = enlace.getAttribute('href') === `#${id}`;
      if (coincide) {
        activo = enlace;
        enlace.setAttribute('aria-current', 'true');
      } else {
        enlace.removeAttribute('aria-current');
      }
    }

    moverIndicador(activo);
  }

  /* ---------- Observador de secciones ---------- */
  const observador = new IntersectionObserver(
    (entradas) => {
      // La sección que más ocupe la franja central manda.
      const visibles = entradas
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visibles.length) marcarActivo(visibles[0].target.id);
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
  );

  secciones.forEach((seccion) => observador.observe(seccion));

  /* ---------- Menú móvil ---------- */
  function abrirMenu(abrir) {
    if (!menu || !botonMenu) return;

    menu.dataset.abierto = abrir ? '1' : '0';
    botonMenu.setAttribute('aria-expanded', String(abrir));
    document.body.dataset.scrollLock = abrir ? '1' : '0';

    if (abrir) {
      menu.querySelector('.menu__enlace')?.focus();
    } else {
      botonMenu.focus();
    }
  }

  botonMenu?.addEventListener('click', () => {
    abrirMenu(menu.dataset.abierto !== '1');
  });

  menu?.addEventListener('click', (evento) => {
    if (evento.target instanceof Element && evento.target.closest('a')) abrirMenu(false);
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && menu?.dataset.abierto === '1') abrirMenu(false);
  });

  /* ---------- Indicador al pasar el ratón y al redimensionar ---------- */
  enlaces.forEach((enlace) => {
    enlace.addEventListener('mouseenter', () => moverIndicador(enlace));
  });

  navLista?.addEventListener('mouseleave', () => {
    const activo = $('.nav__enlace[aria-current="true"]', navLista);
    moverIndicador(activo);
  });

  window.addEventListener('resize', () => {
    compacta();
    const activo = $('.nav__enlace[aria-current="true"]');
    moverIndicador(activo);
  });

  window.addEventListener('scroll', compacta, { passive: true });
  compacta();

  // Retroceso suave a la posición 0 al recargar a media página.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  return { abrirMenu, marcarActivo };
}

/**
 * modules/progreso.js — Barra de progreso de lectura y botón de subida.
 */

export function montarProgreso() {
  const barra = $('#progreso-barra');
  const subir = $('#subir');
  const vapor = crear('span', { class: 'subir__riel', 'aria-hidden': 'true' });
  subir?.append(vapor);

  function actualizar() {
    const alto = document.documentElement.scrollHeight - window.innerHeight;
    const avance = clamp(alto > 0 ? window.scrollY / alto : 0, 0, 1);

    if (barra) barra.style.setProperty('--avance', avance.toFixed(4));
    if (subir) subir.dataset.visible = window.scrollY > window.innerHeight * 0.8 ? '1' : '0';
  }

  subir?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('.nav__enlace')?.focus({ preventScroll: true });
  });

  window.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', actualizar, { passive: true });
  actualizar();

  return { actualizar };
}
