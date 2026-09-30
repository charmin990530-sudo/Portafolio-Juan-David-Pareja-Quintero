/**
 * modules/fondo.js — Fondo animado de partículas conectadas.
 *
 * Una red de nodos que se conectan cuando están cerca. Es la estética
 * "conectado / técnico" que corresponde a un portafolio de desarrollo,
 * sin recurrir a la imagen del espacio.
 *
 * Decisiones de rendimiento:
 *   · Un solo lienzo y un solo bucle de animación (core/loop.js).
 *   · La busca de vecinos es O(n²) pero sobre pocos nodos: por debajo de
 *     70 el coste es irrelevante y se evita trabajo por partida doble.
 *   · El tamaño de la partición se recalcula solo al cambiar de viewport.
 *   · Se pausa solo cuando la pestaña no está visible.
 */

import { crear } from '../core/dom.js';
import { alFotograma } from '../core/loop.js';
import { aleatorio, clamp, movimientoReducido } from '../core/util.js';

const DENSIDAD = 15000; // un nodo por cada N píxeles cuadrados
const MAX_NODOS = 64;
const MIN_NODOS = 14;
const DISTANCIA = 132; // px a la que dos nodos se conectan
const VELOCIDAD = 0.018;

/* Paleta del campo de partículas. Son los mismos valores que los tokens
   `--cyan` y `--violet` del tema oscuro, en triplets RGB porque el canvas
   2D los necesita así y no admite `color-mix`.

   Solo hay una paleta: el sitio ya no tiene tema claro. Este módulo es el
   fondo de la versión simple, y esa versión es nocturna. */
const PALETA = {
  nodo: '79, 227, 255',
  nodoFuerte: '160, 107, 255',
  linea: '79, 227, 255',
  particula: '255, 255, 255',
};

let lienzo;
let contexto;
let ancho = 0;
let alto = 0;
let escala = 1;
let nodos = [];
let activo = false;
let aspecto = 0;

const paleta = () => PALETA;

function crearNodo() {
  return {
    x: Math.random() * ancho,
    y: Math.random() * alto,
    vx: aleatorio(-VELOCIDAD, VELOCIDAD),
    vy: aleatorio(-VELOCIDAD, VELOCIDAD),
    radio: aleatorio(1.1, 2.4),
    fase: Math.random() * Math.PI * 2,
    ritmo: aleatorio(0.3, 1.1),
    fuerte: Math.random() > 0.78,
  };
}

function poblar() {
  const total = clamp(Math.round((ancho * alto) / DENSIDAD * escala), MIN_NODOS, MAX_NODOS);
  nodos = Array.from({ length: total }, crearNodo);
}

function medir() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ancho = window.innerWidth;
  alto = window.innerHeight;

  lienzo.width = Math.round(ancho * dpr);
  lienzo.height = Math.round(alto * dpr);
  lienzo.style.width = `${ancho}px`;
  lienzo.style.height = `${alto}px`;
  contexto.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Pocas partículas en pantallas grandes: ya hay suficiente estructura.
  escala = clamp((ancho * alto) / (1440 * 900), 0.55, 1.35);
  aspecto = alto ? ancho / alto : 1;
  poblar();
}

/**
 * Fotograma del bucle común. El delta se normaliza a 60 fps para que la
 * red se mueva igual de rápido en pantallas de 120 Hz.
 */
function cuadro(delta) {
  if (!activo) return;

  const factor = Math.min(delta, 64) / 16.67;
  for (const n of nodos) {
    n.x += n.vx * factor;
    n.y += n.vy * factor;

    // Rebote en los bordes: ningún nodo se queda congelado fuera de vista.
    if (n.x < -24) n.x = ancho + 24;
    else if (n.x > ancho + 24) n.x = -24;
    if (n.y < -24) n.y = alto + 24;
    else if (n.y > alto + 24) n.y = -24;
  }

  dibujar();
}

/** Se separa del bucle para poder repintar al cambiar de tema. */
function dibujar() {
  contexto.clearRect(0, 0, ancho, alto);
  const pal = paleta();
  const limite = DISTANCIA * aspecto;

  for (let i = 0; i < nodos.length; i += 1) {
    for (let j = i + 1; j < nodos.length; j += 1) {
      const a = nodos[i];
      const b = nodos[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > limite) continue;
      const opacidad = (1 - dist / limite) * 0.22;
      contexto.strokeStyle = `rgba(${pal.linea}, ${opacidad.toFixed(3)})`;
      contexto.beginPath();
      contexto.moveTo(a.x, a.y);
      contexto.lineTo(b.x, b.y);
      contexto.stroke();
    }
  }

  for (const n of nodos) {
    const pulso = 0.55 + 0.45 * Math.sin(n.fase + performance.now() * 0.0008 * n.ritmo);
    const color = n.fuerte ? pal.nodoFuerte : pal.nodo;
    contexto.beginPath();
    contexto.arc(n.x, n.y, n.radio, 0, Math.PI * 2);
    contexto.fillStyle = `rgba(${color}, (0.45 + pulso * 0.4).toFixed(3)})`;
    contexto.fill();
  }
}

export function montarFondo() {
  const existente = document.querySelector('canvas.fondo');
  lienzo = existente || crear('canvas', { class: 'fondo', 'aria-hidden': 'true' });

  if (!existente) document.body.prepend(lienzo);

  contexto = lienzo.getContext('2d', { alpha: true });
  if (!contexto) return () => {};

  medir();
  activo = true;
  alFotograma(cuadro);

  const alRedimensionar = () => medir();
  const alCambiarVisibilidad = () => {
    activo = !document.hidden;
    if (!activo) contexto.clearRect(0, 0, ancho, alto);
  };

  window.addEventListener('resize', alRedimensionar, { passive: true });
  document.addEventListener('visibilitychange', alCambiarVisibilidad);

  return () => {
    activo = false;
    window.removeEventListener('resize', alRedimensionar);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  };
}
