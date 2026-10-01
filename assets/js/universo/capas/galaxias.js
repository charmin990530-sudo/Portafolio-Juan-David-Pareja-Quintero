/**
 * universo/capas/galaxias.js — Galaxias lejanas.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────
 *
 * Con solo estrellas, el fondo es negro y los cuerpos celestes flotan en
 * nada. Eso se ve al bajar: un vacío con puntos. Falta la ESCALA —algo que
 * diga "esto es una galaxia, y nosotros estamos dentro de una" — y sin
 * ella el viaje se siente como un tunel, no como un sistema solar.
 *
 * ── POR QUÉ SON SPRITES Y NO SHADERS ──────────────────────────────────
 *
 * Una galaxia espiral de verdad son cientos de millones de estrellas. Dibujar
 * eso con `Points` son cientos de miles de vértices por galaxia, y con seis
 * galaxias el presupuesto de triángulos del proyecto se va en el fondo.
 *
 * La solución es la misma que usa `capas/nebulosa.js` y por el mismo motivo:
 * dibujar la espiral UNA VEZ en un `canvas` de 256 × 256 y usarla como
 * textura. Cuesta un `drawImage` por galaxia y se ve de lejos como una
 * galaxia, que es todo lo que se le pide a un objeto a tres mil unidades.
 *
 * ── LA TEXTURA ────────────────────────────────────────────────────────
 *
 * Espiral logarítmica, no un degradado: `r = a · e^(b·θ)` es la forma que
 * tienen las espirales reales, y es lo que distingue una galaxia de una
 * mancha. Se dibuja con trazos de puntos de tamaño decreciente hacia fuera,
 * con un núcleo brillante y saturado, y con la Outstanding de rotación del
 * sistema que se aplica en la propia textura.
 *
 * Cada galaxia tiene su propia semilla, así que ninguna se parece a otra.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Sprite,
  SpriteMaterial,
} from '../../../vendor/three/0.186.1/three.module.js';

const LADO = 256;

/** PRNG mulberry32: el cielo es el mismo en cada visita. */
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dibuja una espiral logarítmica en el canvas.
 *
 * @param {number} semilla Cambia la forma, el número de brazos y cuánto gas
 *   hay. Con la misma semilla, la misma galaxia.
 * @param {boolean} barra Si es `true` la galaxia se dibuja de canto: una
 *   elipse estrecha. Mezclar galaxias de frente y de canto es lo que hace
 *   que un cielo se lea como un cielo y no como un patrón repetido.
 */
function texturaGalaxia(semilla, barra) {
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  const ctx = lienzo.getContext('2d');
  const random = azar(semilla);

  const cx = LADO / 2;
  const cy = LADO / 2;
  /* De canto se aplasta en vertical. Una galaxia vista de canto es una
     elipse, y es la única forma de verla de verdad. */
    const achatado = barra ? 0.16 + random() * 0.14 : 1;

  ctx.globalCompositeOperation = 'lighter';

  /* --- El núcleo: brillante, pequeño y saturado ------------------- */
  const nucleo = ctx.createRadialGradient(cx, cy, 0, cx, cy, LADO * (barra ? 0.16 : 0.2));
  nucleo.addColorStop(0, 'rgba(255,255,255,0.95)');
  nucleo.addColorStop(0.35, 'rgba(255,236,206,0.42)');
  nucleo.addColorStop(1, 'rgba(255,214,170,0)');
  ctx.fillStyle = nucleo;
  ctx.beginPath();
  ctx.ellipse(cx, cy, LADO * 0.2, LADO * 0.2 * achatado, 0, 0, Math.PI * 2);
  ctx.fill();

  /* --- Los brazos ----------------------------------------------- */
  const brazos = 2 + Math.floor(random() * 3); // 2, 3 o 4
  const vueltas = 2.1 + random() * 1.5;
  const b = 0.19 + random() * 0.11; // paso de la espiral logarítmica
  const desde = LADO * 0.1;
  const hasta = LADO * (barra ? 0.46 : 0.44);

  for (let brazo = 0; brazo < brazos; brazo += 1) {
    const fase = (brazo / brazos) * Math.PI * 2;

    for (let i = 0; i < 900; i += 1) {
      /* r = a·e^(b·θ), muestreada sobre θ. */
      const theta = (i / 900) * vueltas * Math.PI * 2;
      const r = desde * Math.exp(b * theta);
      if (r > hasta) break;

      const x = cx + Math.cos(theta + fase) * r;
      const y = cy + Math.sin(theta + fase) * r * achatado;

      /* Dispersión: las estrellas no están en la línea del brazo, están
         alrededor. Sin esto se ven espirales dibujadas con regla. */
      const ancho = r * 0.16;
      const px = x + (random() * 2 - 1) * ancho;
      const py = y + (random() * 2 - 1) * ancho * achatado;

      /* Las estrellas exteriores son más débiles y más frías. */
      const t = (r - desde) / (hasta - desde);
      const alpha = (0.5 - t * 0.34) * (0.55 + random() * 0.45);
      if (alpha < 0.02) continue;

      const radio = 1.5 - t * 1.1 + random() * 0.7;
      ctx.fillStyle = `rgba(${230 + Math.floor(random() * 25)}, ${226 - t * 26}, ${255}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.35, radio), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* --- El halo difuso ------------------------------------------ */
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, LADO * 0.42);
  halo.addColorStop(0, 'rgba(180,200,255,0.16)');
  halo.addColorStop(0.5, 'rgba(150,175,255,0.07)');
  halo.addColorStop(1, 'rgba(140,160,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, LADO, LADO);

  ctx.globalCompositeOperation = 'source-over';

  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = 'srgb';
  return textura;
}

/** Galaxias por semilla, con su forma. La mezcla es lo que importa. */
const PLANETARIO = [
  { semilla: 1301, barra: false, tono: 'cian' },
  { semilla: 2718, barra: true, tono: 'violeta' },
  { semilla: 4409, barra: false, tono: 'tinta' },
  { semilla: 5772, barra: true, tono: 'solar' },
  { semilla: 6101, barra: false, tono: 'violeta' },
  { semilla: 7919, barra: true, tono: 'cian' },
  { semilla: 9043, barra: false, tono: 'solar' },
  { semilla: 8317, barra: true, tono: 'tinta' },
];

/**
 * Crea las galaxias.
 *
 * @param {object} opciones
 * @param {number} opciones.radio  radio de la esfera que las contiene
 * @param {object} opciones.paleta
 */
export function crearGalaxias({ radio, paleta }) {
  const grupo = [];
  const texturas = [];
  const random = azar(60221);

  PLANETARIO.forEach((g, i) => {
    const textura = texturaGalaxia(g.semilla, g.barra);
    texturas.push(textura);

    const material = new SpriteMaterial({
      map: textura,
      color: paleta[g.tono].clone().lerp(paleta.tinta, 0.55),
      transparent: true,
      // BAJA OPACIDAD A PROPÓSITO. Una galaxia lejana es un objeto apagado:
      // al 100 % se leía como un cartel pegado al fondo y competía con los
      // planetas. Al 22 % está ahí, da la escala y no molesta.
      opacity: 0.44,
      blending: AdditiveBlending,
      depthWrite: false,
      // Detrás de todo: una galaxia a tres mil unidades no puede tapar un
      // planeta que está a trescientas.
      depthTest: false,
      side: DoubleSide,
      toneMapped: false,
    });

    const sprite = new Sprite(material);

    /* Repartidas en una cáscara esférica por la fórmula de Fibonacci, no al
       azar. Con ocho objetos, el azar deja a dos casi superpuestos en el
       mismo trozo de cielo y deja un hemisferio vacío. */
    const phi = Math.acos(1 - (2 * (i + 0.5)) / PLANETARIO.length);
    const theta = Math.PI * (1.618 + i * 0.723) * 2;
    const r = radio * (0.62 + random() * 0.3);

    sprite.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) * 0.75,
      r * Math.sin(phi) * Math.sin(theta),
    );

    /* El TAMAÑO es lo que da la sensación de lejanía. Con la distancia al
       eje de vuelo en vez de con el radio total, cada una se ve como una
       galaxia y no como un fondo del tamaño de la pantalla. */
      const escala = r * (0.11 + random() * 0.07);
    sprite.scale.set(escala, escala, 1);
    sprite.material.rotation = random() * Math.PI * 2;

    sprite.renderOrder = -200 + i;
    grupo.push(sprite);
  });

  return {
    objetos: grupo,

    /**
     * Gira muy despacio. Una galaxia real tarda cientos de millones de años
     * en dar una vuelta, así que aquí el movimiento es un recurso para que
     * el fondo no esté muerto: apenas perceptible, como en `capas/nebulosa.js`.
     *
     * @param {number} velocidad 0..1
     * @param {number} nacimiento 0..1. Se encienden con la onda, igual que
     *   las estrellas: son materia, y la materia llega con la explosión.
     */
    actualizar(velocidad, nacimiento = 1) {
      const n = nacimiento < 0 ? 0 : nacimiento > 1 ? 1 : nacimiento;
      for (const [i, sprite] of grupo.entries()) {
        sprite.material.rotation += 0.000055 * (1 + (i % 3)) * (1 + velocidad * 2.5);
        // Las lejanas tardan más en encender: la onda tarda más en llegar.
        const retraso = i / grupo.length;
        const enciende = n < 0.12 ? 0 : (n - retraso) / 0.55;
        sprite.material.opacity = 0.44 * (enciende < 0 ? 0 : enciende > 1 ? 1 : enciende);
        sprite.visible = sprite.material.opacity > 0.004;
      }
    },

    liberar() {
      for (const sprite of grupo) sprite.material.dispose();
      for (const textura of texturas) textura.dispose();
    },
  };
}
