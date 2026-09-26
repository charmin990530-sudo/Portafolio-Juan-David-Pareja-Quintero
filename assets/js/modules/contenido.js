/**
 * modules/contenido.js — Proyección del contenido declarado en data/.
 *
 *   · montarMarquesina() → cinta infinita de tecnologías
 *   · montarStack()       → grupos de habilidades, filtros y medidores
 *   · mostrarAviso()      → notificación efímera reutilizable
 *
 * El HTML solo define los contenedores; las listas repetitivas se
 * generan aquí desde los datos, para no duplicar información.
 */

import { $, $$, crear } from '../core/dom.js';
import { movimientoReducido } from '../core/util.js';
import { STACK } from '../data/stack.js';

/* =============================================================
   MARQUESINA
   La pista se duplica en el DOM para que la traslación de -50% sea
   un bucle continuo. Las copias quedan ocultas a lectores de pantalla.
   ============================================================= */

export function montarMarquesina() {
  const pistas = $$('.marquee__pista');

  for (const pista of pistas) {
    if (pista.dataset.clonado === '1') continue;

    const clon = pista.cloneNode(true);
    clon.setAttribute('aria-hidden', 'true');
    clon.dataset.clonado = '1';

    for (const hijo of clon.children) {
      if (hijo.tagName === 'UL' || hijo.getAttribute('role') === 'list') {
        // Las réplicas no deben anunciar nada al lector de pantalla.
        for (const nieto of hijo.children) nieto.setAttribute('aria-hidden', 'true');
      }
    }

    pista.append(clon);
  }

  if (movimientoReducido()) {
    for (const pista of pistas) {
      pista.style.animation = 'none';
      pista.style.flexWrap = 'wrap';
    }
  }
}

/* =============================================================
   HABILIDADES
   Las barras se animan solo cuando entran en pantalla. Los filtros
   ocultan grupos con `hidden` (no con opacidad) para no romper el
   orden de tabulación.
   ============================================================= */

const SVG_ICONO = (ruta) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ruta}</svg>`;

function construirMedidor({ nombre, nivel, nota }, color) {
  const medidor = crear('div', { class: 'medidor', title: nota });
  medidor.style.setProperty('--medidor-color', color);

  medidor.append(
    crear('div', { class: 'medidor__fila' }, [
      crear('span', { class: 'medidor__nombre' }, [
        crear('span', { class: 'medidor__punto', 'aria-hidden': 'true' }),
        crear('span', { text: nombre }),
      ]),
      crear('span', { class: 'medidor__valor', text: `${nivel}%` }),
    ]),
  );

  const riel = crear('div', {
    class: 'medidor__riel',
    role: 'meter',
    'aria-label': `${nombre}: ${nivel} de 100`,
    'aria-valuenow': String(nivel),
    'aria-valuemin': '0',
    'aria-valuemax': '100',
  });

  riel.append(crear('div', { class: 'medidor__relleno', dataset: { nivel: String(nivel) } }));
  medidor.append(riel);

  return medidor;
}

export function montarStack() {
  const contenedor = $('#stack-grupos');
  const filtros = $('#stack-filtros');
  if (!contenedor) return () => {};

  /* ---------- Proyección de los grupos ---------- */
  for (const grupo of STACK) {
    const panel = crear('section', {
      class: 'grupo',
      'data-grupo': grupo.id,
      'aria-labelledby': `titulo-${grupo.id}`,
    });
    panel.style.setProperty('--grupo-color', grupo.color);

    const icono = crear('span', { class: 'grupo__icono', html: SVG_ICONO(grupo.icono) });

    panel.append(
      crear('header', { class: 'grupo__cabecera' }, [
        icono,
        crear('div', {}, [
          crear('h3', { class: 'grupo__titulo', id: `titulo-${grupo.id}`, text: grupo.nombre }),
          crear('span', {
            class: 'grupo__conteo',
            text: `${grupo.habilidades.length} tecnologías`,
          }),
        ]),
      ]),
    );

    const lista = crear('div', { class: 'grupo__lista' });
    for (const habilidad of grupo.habilidades) {
      lista.append(construirMedidor(habilidad, grupo.color));
    }
    panel.append(lista);
    contenedor.append(panel);
  }

  /* ---------- Filtros ---------- */
  if (filtros) {
    const opciones = [{ id: 'todos', nombre: 'Todo', color: 'var(--accent)' }, ...STACK];

    for (const opcion of opciones) {
      const boton = crear('button', {
        class: 'stack__filtro',
        type: 'button',
        'aria-pressed': String(opcion.id === 'todos'),
        dataset: { filtro: opcion.id },
        text: opcion.id === 'todos' ? 'Todas' : opcion.nombre,
      });
      boton.style.setProperty('--grupo-color', opcion.color);
      filtros.append(boton);
    }

    filtros.addEventListener('click', (evento) => {
      const boton = evento.target instanceof Element ? evento.target.closest('.stack__filtro') : null;
      if (!boton) return;

      const activo = boton.dataset.filtro;

      for (const otro of $$('.stack__filtro', filtros)) {
        otro.setAttribute('aria-pressed', String(otro === boton));
      }

      for (const panel of $$('.grupo', contenedor)) {
        panel.hidden = activo !== 'todos' && panel.dataset.grupo !== activo;
      }
    });
  }

  /* ---------- Animación de las barras al entrar en vista ---------- */
  const rellenos = $$('.medidor__relleno', contenedor);

  const activar = (nodos) => {
    for (const nodo of nodos) {
      nodo.style.width = `${nodo.dataset.nivel}%`;
    }
  };

  if (movimientoReducido() || !('IntersectionObserver' in window)) {
    activar(rellenos);
    return () => {};
  }

  const observador = new IntersectionObserver(
    (entradas, observer) => {
      const pendientes = [];
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        pendientes.push(entrada.target);
        observer.unobserve(entrada.target);
      }
      activar(pendientes);
    },
    { threshold: 0.35 },
  );

  rellenos.forEach((nodo) => observador.observe(nodo));

  return () => observador.disconnect();
}

/* =============================================================
   AVISO EFÍMERO
   ============================================================= */

let nodo = null;
let temporizador = 0;

export function mostrarAviso(mensaje, duracion = 4200) {
  if (!nodo) {
    nodo = crear('div', { class: 'aviso', role: 'status', 'aria-live': 'polite' });
    nodo.append(crear('span', { class: 'aviso__punto', 'aria-hidden': 'true' }));
    nodo.append(crear('span', { class: 'aviso__texto' }));
    document.body.append(nodo);
  }

  nodo.querySelector('.aviso__texto').textContent = mensaje;
  nodo.dataset.visible = '1';

  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(() => {
    nodo.dataset.visible = '0';
  }, duracion);
}
