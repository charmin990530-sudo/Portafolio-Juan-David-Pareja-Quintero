/**
 * universo/capas/nebulosa.js — Nubes de gas y polvo en profundidad.
 *
 * NOTA DE RENDIMIENTO, que es la razón de que esto sean sprites y no un
 * shader: una nebulosa procedural de verdad (ruido de valor 3D con 3 octavas
 * sobre una esfera a pantalla completa) cuesta unas 24 llamadas a `sin()` por
 * píxel. A 1920×1080 con DPR 1,75 son unos 6,4 M de píxeles, o sea del orden
 * de 150 M de `sin()` por fotograma. Es inviable en gama media y arruinaría el
 * presupuesto entero por un efecto decorativo.
 *
 * La solución: varias planos de tipo *sprite* con degradados radiales
 * generados en un `canvas` de 128×128 en el momento de cargar. Cuesta una
 * mezcla aditiva por fragmento, sin ninguna función trigonométrica, y como
 * viven en el espacio de mundo dan paralaje de verdad durante el vuelo.
 *
 * Ventaja extra frente al shader: se pueden dejar encendidas en el nivel BAJO
 * sin coste apreciable, así que la identidad visual no cambia con la
 * calidad. Eso es exactamente el principio de ESTUDIO.md §6.5.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
} from '../../../vendor/three/0.186.1/three.module.js';
import { aleatorio } from '../../core/util.js';

const LADO = 128;

/**
 * Degradado radial suave con un poco de grano, dibujado en un canvas.
 *
 * El grano importa: un degradado perfectamente limpio se lee como "mancha de
 * desenfoque" y delata el truco. Veintidós manchas de ruido superpuestas lo
 * convierten en algo que el ojo acepta como gas.
 */
function texturaNube(semilla) {
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  const ctx = lienzo.getContext('2d');

  // Halo principal.
  const degradado = ctx.createRadialGradient(LADO / 2, LADO / 2, 0, LADO / 2, LADO / 2, LADO / 2);
  degradado.addColorStop(0, 'rgba(255,255,255,0.9)');
  degradado.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  degradado.addColorStop(0.7, 'rgba(255,255,255,0.1)');
  degradado.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, LADO, LADO);

  // Grano: manchas de ruido de baja frecuencia que rompen la simetría radial.
  // Más manchas = mayor estructura visual de "gas", dentro del presupuesto
  // aceptable porque es solo canvas precalculado, no shader por píxel.
  const random = (() => {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 30; i += 1) {
    const cx = LADO * (0.18 + random() * 0.64);
    const cy = LADO * (0.18 + random() * 0.64);
    const r = LADO * (0.06 + random() * 0.22);
    const mancha = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    mancha.addColorStop(0, `rgba(255,255,255,${0.05 + random() * 0.07})`);
    mancha.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mancha;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = 'srgb';
  return textura;
}

/**
 * Planos de nebulosa.
 *
 * Se reparten en una cáscara esférica con radios distintos, para que al volar
 * se superponen unos delante de otros. Si todos estuvieran a la misma
 * distancia, el conjunto se movería como un solo cartel y se notaría que es
 * un fondo plano.
 */
export function crearNebulosa({ nivel, radio, paleta }) {
  const texturas = [
    texturaNube(4711),
    texturaNube(90210),
    texturaNube(31337),
  ];

  // Dos capas de planos por mancha: una grande y difusa, otra más pequeña y
  // definida. La superposición de las dos es lo que da volumen.
  //
  // LA OPACIDAD ES EL NÚMERO QUE IMPORTA AQUÍ. Los planos son aditivos y no
  // prueban profundidad, así que todo lo que hay delante se ve a través de
  // ellos: si son grandes y brillantes, el resultado no es una nebulosa de
  // fondo sino un velo azul que sube la luminancia de toda la pantalla y
  // se come los planetas. Con estas cifras la mancha más brillante aporta
  // menos de un 12 % de luz, que es lo que se ve como gas sin estropear el
  // negro del espacio ni el contraste del texto.
  const capas = [
    { clave: 'cian', escala: 1.0, opacidad: 0.28 },
    { clave: 'violeta', escala: 0.78, opacidad: 0.22 },
    { clave: 'solar', escala: 0.5, opacidad: 0.12 },
  ];

  const grupo = [];
  const aleatorioF = (min, max) => aleatorio(min, max);
  /* La opacidad de cada sprite se reescribe en cada fotograma cuando nace el
     gas, así que hay que recordar la original: si se multiplicara por sí
     mismo, el gas se apagaría solo en dos segundos. */
  const opacidadBase = [];

  // Cuatro manchas: dos grandes que tejen el fondo, dos pequeñas que dan
  // puntos de interés en los tramos de viaje.
  //
  // `tam` se multiplica por la distancia de la mancha, no por el radio de la
  // esfera: así una nube mantiene su tamaño RELATIVO a lo cerca que está del
  // eje de vuelo. Con un factor absoluto sobre el radio total (4 200 u) cada
  // plano medía 7 000 u de lado a 1 700 u de distancia, es decir, tapaba la
  // pantalla entera y las doce se sumaban.
  const manchas = [
    { r: 0.42, tam: 1.5, orden: 0 },
    { r: 0.68, tam: 1.15, orden: 1 },
    { r: 0.3, tam: 0.85, orden: 2 },
    { r: 0.85, tam: 1.35, orden: 3 },
  ];

  for (const [i, mancha] of manchas.entries()) {
    for (const capa of capas) {
      const textura = texturas[(i + capas.indexOf(capa)) % texturas.length];
      const material = new SpriteMaterial({
        map: textura,
        color: paleta[capa.clave].clone(),
        transparent: true,
        opacity: capa.opacidad,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false, // siempre detrás de los cuerpos
        side: DoubleSide,
        // El mapa ya es una imagen en espacio sRGB.
        toneMapped: false,
      });

      const sprite = new Sprite(material);
      const radioCapa = radio * mancha.r;
      // Posición sobre la esfera: se pasea en un cono alrededor del eje de
      // vuelo para que siempre quede en el campo de visión al avanzar.
      const theta = aleatorioF(0, Math.PI * 2);
      const altura = aleatorioF(-0.45, 0.75);
      const horiz = Math.sqrt(Math.max(0, 1 - altura * altura));

      sprite.position.set(
        Math.cos(theta) * horiz * radioCapa,
        altura * radioCapa,
        Math.sin(theta) * horiz * radioCapa,
      );
      const escala = radioCapa * mancha.tam * capa.escala;
      sprite.scale.set(escala, escala, 1);

      // Un `Sprite` se orienta siempre a cámara, así que su rotación Z sí es
      // útil: se usa para que las manchas no tengan todas el mismo eje.
      sprite.material.rotation = aleatorioF(0, Math.PI * 2);

      // Orden de dibujo: las más lejanas primero.
      sprite.renderOrder = -100 + mancha.orden * 3 + capas.indexOf(capa);

      grupo.push(sprite);
      opacidadBase.push(capa.opacidad);
    }
  }

  return {
    objetos: grupo,
    capas,

/**
     * Respiración muy lenta. Las nebulosas de un universo real no laten, pero
     * un fondo completamente estático mientras el usuario lee hace que el
     * sitio parezca una captura de pantalla. Es un compromise deliberado.
     *
     * @param {number} segundos
     * @param {number} velocidad
     * @param {number} nacimientro 0..1. El gas no está ahí antes de que pase
     *   la onda: es parte de lo que la onda deja al pasar, así que sin este
     *   parámetro el arranque no abriría nada.
     */
    actualizar(segundos, velocidad, nacimiento = 1) {
      for (const [i, sprite] of grupo.entries()) {
        // Cada mancha gira a un ritmo distinto para que no se sincronicen.
        sprite.material.rotation += 0.00004 * (1 + (i % 4)) * (1 + velocidad * 2);
        sprite.material.opacity = opacidadBase[i] * nacimiento;
        sprite.visible = nacimiento > 0.004;
      }
      // Con velocidad alta, la nebulosa se estira hacia atrás: refuerza la
      // sensación de movimiento sin tocar el shader de las estrellas.
      const estirado = 1 + velocidad * 0.12;
      for (const sprite of grupo) {
        const base = sprite.scale.x;
        sprite.scale.set(base, base * estirado, 1);
      }
      void segundos;
    },


    liberar() {
      for (const sprite of grupo) sprite.material.dispose();
      for (const textura of texturas) textura.dispose();
    },
  };
}
