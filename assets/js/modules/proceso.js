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

import { $, $$, crear, on } from '../core/dom.js';
import { alFotograma } from '../core/loop.js';
import { clamp, mapear, movimientoReducido } from '../core/util.js';
import { PROCESO, TOTAL_ETAPAS } from '../data/proceso.js';
import { desplazarAposicion } from '../core/desplazar.js';

const CAMBIO = 0.5;
const RETARDO_FUNDIDO = 240;

export function montarProceso() {
  const escena = $('#proceso-escena');
  const diagrama = $('#proceso-diagrama');
  const cajaDatos = $('#proceso-datos');
  const pasos = $('#proceso-pasos');
  const riel = $('#proceso-riel');

  /* ── TODOS los nodos que se tocan tienen que estar aquí ──────────────

     Antes solo se comprobaban cuatro, y `escribir()` escribía en
     `campos.indice` sin comprobación: si faltara `#proceso-indice`, el
     `aplicar(0)` del montaje reventaba y el resto de la sección se
     quedaba en blanco. Un `montar*` que lanza se lleva por delante todo lo
     que `main.js` monta después, así que la lista es la de TODO lo que el
     módulo lee, no la de lo que parece importante. */
  const campos = {
    indice: $('#proceso-indice'),
    claim: $('#proceso-claim'),
    titulo: $('#proceso-titulo-etapa'),
    descripcion: $('#proceso-descripcion'),
  };
  const lista = $('#proceso-puntos');
  const lineaRiel = $('#proceso-riel-avance');

  const faltaAlgo =
    !escena || !diagrama || !pasos || !cajaDatos || !riel || !lineaRiel || !lista ||
    !campos.indice || !campos.claim || !campos.titulo || !campos.descripcion;

  if (faltaAlgo) return () => {};

  /* Todo lo que este módulo registra, para poder devolverlo. La regla del
     sitio es que cada `montar*` devuelve su función de limpieza, y esta es
     la razón: sin esto, `main.js` la invocaba como si fuera función, le
     llegaba un objeto y el `TypeError` lo silenciaba su propio `catch`. */
  const bajas = [];
  const creados = [];

  /* ---------- Núcleo del diagrama ---------- */
  const nucleo = crear('div', { class: 'proceso__nucleo' }, [
    crear('span', { class: 'proceso__nucleo-num', id: 'proceso-nucleo-num', text: '01' }),
    crear('span', { class: 'proceso__nucleo-rol', id: 'proceso-nucleo-rol', text: '' }),
  ]);
  diagrama.append(nucleo);
  creados.push(nucleo);

  const nucleoNum = nucleo.querySelector('.proceso__nucleo-num');
  const nucleoRol = nucleo.querySelector('.proceso__nucleo-rol');

  /* ---------- Nodos del diagrama y marcas de scroll ---------- */
  const nodos = [];
  const marcas = [];
  const anguloBase = -90;

  PROCESO.forEach((etapa, indice) => {
    const paso = crear('li', { class: 'proceso__paso', 'aria-hidden': 'true' });
    pasos.append(paso);
    creados.push(paso);

    const marca = crear('span', { class: 'proceso__marca' });
    pasos.append(marca);
    marcas.push(marca);
    creados.push(marca);

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
    // `on()` devuelve la baja. Con `addEventListener('click', () => …)` la
    // flecha era nueva en cada etapa y no había forma de retirarla.
    bajas.push(on(nodo, 'click', () => irAProgreso((indice + 0.5) / TOTAL_ETAPAS)));
    diagrama.append(nodo);
    nodos.push(nodo);
    creados.push(nodo);

    // El riel replica los pasos: en móvil se convierte en una tira
    // horizontal de progreso y pasa a ser la única navegación visible.
    const marcaRiel = crear(
      'button',
      {
        class: 'riel__nodo',
        type: 'button',
        'data-estado': 'pendiente',
        'aria-label': `Ir a la etapa ${etapa.titulo}`,
      },
      [crear('span', { class: 'riel__nombre', text: `0${indice + 1}` })],
    );
    bajas.push(on(marcaRiel, 'click', () => irAProgreso((indice + 0.5) / TOTAL_ETAPAS)));
    riel.append(marcaRiel);
    creados.push(marcaRiel);
  });

  /* ---------- Panel de textos ---------- */
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

    riel.querySelectorAll('.riel__nodo').forEach((n, i) => {
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

  /* ---------- Navegación por el riel ----------
     Los cinco nodos del diagrama y los cinco del riel llevan aquí. Con
     movimiento reducido el salto es inmediato: animar el scroll cuando
     alguien ha pedido menos movimiento es exactamente lo contrario de lo
     que se le está pidiendo. */
  function irAProgreso(destino) {
    const caja = escena.getBoundingClientRect();
    const altoTotal = Math.max(1, caja.height - window.innerHeight);
    desplazarAposicion(caja.top + window.scrollY + altoTotal * clamp(destino, 0, 1), {
      inmediato: movimientoReducido(),
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

    riel.style.setProperty('--riel-avance', avance.toFixed(4));
    lineaRiel.style.transform = `scaleY(${avance.toFixed(4)})`;

    const masCerca = Math.round(continua);
    marcas.forEach((marca, i) => {
      marca.style.opacity = i === masCerca ? '1' : '0';
    });
  }

  bajas.push(alFotograma(medir));

  aplicar(0);

  /* ── LA LIMPIEZA ────────────────────────────────────────────────────

     Devuelve una FUNCIÓN, como todos los `montar*` del sitio. Antes
     devolvía `{ irAProgreso, avance }` y nadie usaba ninguna de las dos:
     `main.js` la metía en su lista de limpiezas y la invocaba, le llegaba
     un objeto y el `TypeError` lo silenciaba su propio `catch` de
     `pagehide`. El fallo no se veía porque solo pasaba al descargar.

     Lo que se libera: el temporizador del fundido, el suscriptor del
     bucle, los diez `click` y los dieciséis nodos que este módulo creó.
     Los nodos que ya estaban en el HTML se dejan donde están. */
  return () => {
    window.clearTimeout(temporizador);
    for (const baja of bajas) baja();
    for (const nodo of creados) nodo.remove();
    for (const clave of CLAVE_COLOR) escena.style.removeProperty(clave);
  };
}
