/**
 * modules/proceso.js — Scrollytelling del proceso de trabajo.
 *
 * Mismo patrón que ya se usaba para el viaje, pero sin imagenes:
 *
 *  1. `proceso__pegado` es un bloque `position: sticky` de 100svh que
 *     queda congelado mientras el contenedor sigue bajando.
 *  2. Debajo hay un paso por etapa; esos vacíos solo generan altura.
 *  3. Cada fotograma se mide el avance de la sección y se escribe en
 *     variables CSS: qué etapa está activa, cuánto lleva el riel y cómo
 *     se escala el diagrama.
 *  4. Al cambiar de etapa se intercambian los textos con un fundido.
 *
 * Los nodos del diagrama se posicionan con `--angulo`, así que el HTML
 * solo declara los cinco elementos y el CSS los reparte en el anillo.
 */

import { $, $$, crear } from '../core/dom.js';
import { alFotograma } from '../core/loop.js';
import { clamp, mapear, movimientoReducido } from '../core/util.js';
import { PROCESO, TOTAL_ETAPAS } from '../data/proceso.js';

const CAMBIO = 0.5;
const RETARDO_FUNDIDO = 240;

export function montarProceso() {
  const escena = $('#proceso-escena');
  const diagrama = $('#proceso-diagrama');
  const cajaDatos = $('#proceso-datos');
  const pasos = $('#proceso-pasos');
  const riel = $('#proceso-riel');

  if (!escena || !diagrama || !pasos || !cajaDatos) return null;

  /* ---------- Núcleo del diagrama ---------- */
  const nucleo = crear('div', { class: 'proceso__nucleo' }, [
    crear('span', { class: 'proceso__nucleo-num', id: 'proceso-nucleo-num', text: '01' }),
    crear('span', { class: 'proceso__nucleo-rol', id: 'proceso-nucleo-rol', text: '' }),
  ]);
  diagrama.append(nucleo);

  const nucleoNum = nucleo.querySelector('.proceso__nucleo-num');
  const nucleoRol = nucleo.querySelector('.proceso__nucleo-rol');

  /* ---------- Nodos del diagrama y marcas de scroll ---------- */
  const nodos = [];
  const marcas = [];
  const anguloBase = -90;

  PROCESO.forEach((etapa, indice) => {
    pasos.append(crear('li', { class: 'proceso__paso', 'aria-hidden': 'true' }));

    const marca = crear('span', { class: 'proceso__marca' });
    pasos.append(marca);
    marcas.push(marca);

    const nodo = crear(
      'button',
      {
        class: 'proceso__nodo',
        type: 'button',
        'data-estado': 'pendiente',
        'aria-label': `Ir a la etapa ${etapa.titulo}`,
        style: { '--angulo': `${anguloBase + (360 / TOTAL_ETAPAS) * indice}deg` },
      },
      [
        // Capa exterior: gira con el ángulo y ocupa todo el diagrama.
        // Capa interior: se counter-rota para que el texto quede recto
        // y se apoya en el borde superior, que es la circunferencia.
        crear('span', { class: 'proceso__nodo-cuerpo' }, [
          crear('span', { class: 'proceso__nodo-punto', 'aria-hidden': 'true' }),
          crear('span', { class: 'proceso__nodo-nombre', text: etapa.nodo }),
          crear('span', { class: 'proceso__nodo-num', text: etapa.indice }),
        ]),
      ],
    );
    nodo.addEventListener('click', () => irAProgreso((indice + 0.5) / TOTAL_ETAPAS));
    diagrama.append(nodo);
    nodos.push(nodo);

    // El riel replica los pasos: en móvil se convierte en una tira
    // horizontal de progreso y pasa a ser la única navegación visible.
    const paso = crear(
      'button',
      {
        class: 'riel__nodo',
        type: 'button',
        'data-estado': 'pendiente',
        'aria-label': `Ir a la etapa ${etapa.titulo}`,
      },
      [crear('span', { class: 'riel__nombre', text: `0${indice + 1}` })],
    );
    paso.addEventListener('click', () => irAProgreso((indice + 0.5) / TOTAL_ETAPAS));
    riel?.append(paso);
  });

  const lineaRiel = $('#proceso-riel-avance');

  /* ---------- Panel de textos ---------- */
  const campos = {
    indice: $('#proceso-indice'),
    claim: $('#proceso-claim'),
    titulo: $('#proceso-titulo-etapa'),
    descripcion: $('#proceso-descripcion'),
  };

  const lista = $('#proceso-puntos');
  const CLAVE_COLOR = ['--proceso-1', '--proceso-2', '--proceso-3', '--proceso-4', '--proceso-5'];

  /* ---------- Estado ---------- */
  let indiceActivo = -1;
  let temporizador = 0;
  let enVista = false;

  function escribir(etapa) {
    campos.indice.textContent = `ETAPA ${etapa.indice} DE ${String(TOTAL_ETAPAS).padStart(2, '0')}`;
    campos.claim.textContent = etapa.claim;
    campos.titulo.textContent = etapa.titulo;
    campos.descripcion.textContent = etapa.descripcion;

    lista.replaceChildren(
      ...etapa.puntos.map((punto) => crear('li', { text: punto })),
    );
  }

  function aplicar(indice) {
    const etapa = PROCESO[indice];

    // Cada etapa tiene su propio acento: el color viaja por variables CSS.
    for (const clave of CLAVE_COLOR) escena.style.removeProperty(clave);
    escena.style.setProperty(CLAVE_COLOR[indice], '1');
    escena.style.setProperty('--proceso-color', etapa.color);
    nucleoNum.textContent = etapa.indice;
    nucleoRol.textContent = etapa.nodo;

    nodos.forEach((nodo, i) => {
      nodo.dataset.estado = i < indice ? 'hecho' : i === indice ? 'activo' : 'pendiente';
    });

    riel?.querySelectorAll('.riel__nodo').forEach((n, i) => {
      n.dataset.estado = i < indice ? 'hecho' : i === indice ? 'activo' : 'pendiente';
    });

    diagrama.setAttribute('aria-label', `Etapa ${etapa.indice}: ${etapa.titulo}`);
    escribir(etapa);
  }

  function cambiar(indice) {
    if (indice === indiceActivo) return;
    indiceActivo = indice;

    if (movimientoReducido()) {
      aplicar(indice);
      return;
    }

    cajaDatos.dataset.cambiando = '1';
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => {
      aplicar(indice);
      requestAnimationFrame(() => {
        cajaDatos.dataset.cambiando = '0';
      });
    }, RETARDO_FUNDIDO);
  }

  /* ---------- Navegación por el riel ---------- */
  function irAProgreso(destino) {
    const caja = escena.getBoundingClientRect();
    const altoTotal = Math.max(1, caja.height - window.innerHeight);
    window.scrollTo({
      top: caja.top + window.scrollY + altoTotal * clamp(destino, 0, 1),
      behavior: movimientoReducido() ? 'auto' : 'smooth',
    });
  }

  /* ---------- Fotograma ---------- */
  function medir() {
    const caja = escena.getBoundingClientRect();
    const altoTotal = Math.max(1, caja.height - window.innerHeight);
    const avance = clamp(-caja.top / altoTotal, 0, 1);

    enVista = caja.top <= window.innerHeight * 0.4 && caja.bottom >= window.innerHeight * 0.45;
    if (!enVista) return;

    const bruto = avance * TOTAL_ETAPAS;
    const indice = clamp(Math.floor(bruto), 0, TOTAL_ETAPAS - 1);
    const local = bruto - indice;
    const continua = mapear(local, 0, 1, indice, Math.min(indice + 1, TOTAL_ETAPAS - 1));

    cambiar(local < CAMBIO ? indice : Math.min(indice + 1, TOTAL_ETAPAS - 1));

    // El diagrama respira: se agranda al entrar y se asienta al salir.
    const escala = 1 + Math.sin(continua * Math.PI) * 0.05;
    diagrama.style.setProperty('--diagrama-escala', escala.toFixed(4));

    if (riel) riel.style.setProperty('--riel-avance', avance.toFixed(4));
    if (lineaRiel) lineaRiel.style.transform = `scaleY(${avance.toFixed(4)})`;

    const masCerca = Math.round(continua);
    marcas.forEach((marca, i) => {
      marca.style.opacity = i === masCerca ? '1' : '0';
    });
  }

  alFotograma(medir);

  aplicar(0);

  return {
    irAProgreso,
    get avance() {
      return enVista;
    },
  };
}
