/**
 * modules/cabecera.js — Comportamiento de la barra superior.
 *
 * · Se compacta y se cristaliza al dejar de estar en el tope.
 * · Marca la sección activa con un indicador que se desliza.
 * · Menú de pantalla completa en móvil con trampa de foco básica.
 */

import { $, $$, crear, on } from '../core/dom.js';
import { desplazarAlPrincipio, progresoDeLectura } from '../core/desplazar.js';

export function montarCabecera() {
  const cabecera = $('#cabecera');
  const navLista = $('.nav__lista');
  const indicador = $('#nav-marca');
  const enlaces = $$('.nav__enlace');
  const secciones = $$('main section[id]');
  const botonMenu = $('#hamburguesa');
  const menu = $('#menu');

  if (!cabecera) return () => {};

  /* Cada listener se registra con `on`, que devuelve su baja. Antes se
     declaraban en línea y no había forma de retirarlos: `main.js` llama a
     la limpieza en `pagehide`, así que aquí faltaban cinco. */
  const bajas = [];

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

  /* ---------- Observador de secciones ----------
     Un fallo que tenía: el callback solo recibía las secciones cuyo estado
     ACABABA de cambiar. Con dos secciones Solapadas en la franja central,
     la que entraba podía ser la menor y se marcaba como activa aunque la
     otra ocupara más pantalla. Ahora el conjunto se lleva aparte y se
     consulta el registro completo, que además es el que sobrevive cuando
     el visitante salta con el menú o con la barra espaciadora y el
     observador no dispara nada. */
  const seccionesVisibles = new Map();

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) seccionesVisibles.set(entrada.target, entrada.intersectionRatio);
        else seccionesVisibles.delete(entrada.target);
      }

      let mejor = null;
      let mejorRatio = -1;
      for (const [seccion, ratio] of seccionesVisibles) {
        if (ratio > mejorRatio) {
          mejor = seccion;
          mejorRatio = ratio;
        }
      }

      if (mejor) marcarActivo(mejor.id);
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
  );

  secciones.forEach((seccion) => observador.observe(seccion));
  bajas.push(() => observador.disconnect());

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

  bajas.push(
    on(botonMenu, 'click', () => {
      abrirMenu(menu?.dataset.abierto !== '1');
    }),
    on(menu, 'click', (evento) => {
      if (evento.target instanceof Element && evento.target.closest('a')) abrirMenu(false);
    }),
    on(document, 'keydown', (evento) => {
      if (evento.key === 'Escape' && menu?.dataset.abierto === '1') abrirMenu(false);
    }),
  );

  /* ---------- Indicador al pasar el ratón y al redimensionar ---------- */
  for (const enlace of enlaces) {
    bajas.push(on(enlace, 'mouseenter', () => moverIndicador(enlace)));
  }

  bajas.push(
    on(navLista, 'mouseleave', () => {
      const activo = $('.nav__enlace[aria-current="true"]', navLista);
      moverIndicador(activo);
    }),
    on(
      window,
      'resize',
      () => {
        compacta();
        const activo = $('.nav__enlace[aria-current="true"]');
        moverIndicador(activo);
      },
      { passive: true },
    ),
    on(window, 'scroll', compacta, { passive: true }),
  );

  compacta();

  // Retroceso suave a la posición 0 al recargar a media página.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  return () => {
    for (const baja of bajas) baja();
    bajas.length = 0;
  };
}

/**
 * modules/progreso.js — Barra de progreso de lectura y botón de subida.
 */

export function montarProgreso() {
  const barra = $('#progreso-barra');
  const subir = $('#subir');
  const vapor = crear('span', { class: 'subir__riel', 'aria-hidden': 'true' });
  subir?.append(vapor);

  /* El último avance escrito, para no tocar el DOM si no ha cambiado de
     forma visible. A `--avance` se le escribía cuatro decimales en cada
     evento de scroll: cuarenta escrituras por segundo para un número que
     a ojo solo se mueve cuando cambia. */
  let ultimoAvance = -1;

  function actualizar() {
    const avance = progresoDeLectura();

    if (barra && Math.abs(avance - ultimoAvance) > 0.001) {
      ultimoAvance = avance;
      barra.style.setProperty('--avance', avance.toFixed(4));
    }

    if (subir) subir.dataset.visible = window.scrollY > window.innerHeight * 0.8 ? '1' : '0';
  }

  const bajaSubir = on(subir, 'click', () => {
    // Va por el helper y no por `window.scrollTo`: con Lenis montado, un
    // `scrollTo` nativo compite con el suavizado y el salto se ve a tirones.
    desplazarAlPrincipio();
    $('.nav__enlace')?.focus({ preventScroll: true });
  });

  const bajaScroll = on(window, 'scroll', actualizar, { passive: true });
  const bajaResize = on(window, 'resize', actualizar, { passive: true });
  actualizar();

  return () => {
    bajaScroll();
    bajaResize();
    bajaSubir();
  };
}
