/**
 * universo/capas/estrellas.js — El campo de estrellas.
 *
 * Decisión de diseño importante: las estrellas viven en el ESPACIO DE MUNDO,
 * no ancladas a la cámara. Al volar, la cámara las atraviesa de verdad y el
 * paralaje es geométrico en lugar de simulado. Es lo que produce la sensación
 * de viaje y no la de "un fondo que se mueve".
 *
 * El coste es un `Points` con un solo material: una llamada de dibujo para
 * hasta 4 000 estrellas, sin textura (el punto se dibuja proceduralmente en
 * el fragment shader) y sin post-procesado.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
} from '../../../vendor/three/0.186.1/three.module.js';
import { aleatorio } from '../../core/util.js';
import { perfil } from '../calidad.js';

/** Semilla fija: las estrellas deben ser las mismas en cada visita. */
const SEMILLA = 20260930;

/** PRNG mulberry32. Determinista, sin dependencia externa. */
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VERTEX = /* glsl */ `
  attribute float aTamano;
  attribute float aTinte;

  uniform float uTiempo;
  uniform float uPixelRatio;
  uniform float uEstelas;

  varying float vTinte;
  varying float vEstela;

  void main() {
    vTinte = aTinte;

    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vec4 vista = viewMatrix * mundo;

    // Centelleo muy leve. Con la cámara quieta, un cielo completamente
    // estático delata el truco; con parpadeo agresivo marea.
    // Se calcula sin sin(uTiempo * algo) para que cada estrella titile
    // con su propia fase.
    float fase = aTinte * 6.2831853;
    float titileo = 0.86 + 0.14 * sin(uTiempo * 0.7 + fase);

    gl_Position = projectionMatrix * vista;

    // Atenuación suave con la distancia: las cercanas se ven algo mayores y
    // eso es lo que da profundidad al campo.
    float distancia = -vista.z;
    float atenuacion = 1.0 / (1.0 + distancia * 0.0016);

    gl_PointSize = aTamano * uPixelRatio * atenuacion * titileo;

    // Longitud de la estela según la velocidad, en unidades de sprite.
    vEstela = uEstelas;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColorBase;
  uniform vec3 uColorAcento;
  uniform float uOpacidad;

  varying float vTinte;
  varying float vEstela;

  void main() {
    // Coordenada del sprite: el punto se dibuja como un cuadrado de
    // gl_PointSize y el fragmento sabe dónde está dentro de él.
    vec2 centro = gl_PointCoord - 0.5;

    // La estela se estira en RADIAL respecto al centro de la pantalla, que es
    // la dirección en la que se aleja una estrella al avanzar. En el centro
    // exacto la dirección es indeterminada, así que se degrada a un punto.
    vec2 direccion = normalize(centro + vec2(0.0001));
    float radial = length(centro) * 2.0;
    vec2 coord = vec2(dot(centro, vec2(-direccion.y, direccion.x)),
                      dot(centro, direccion));

    // Estirado vertical (a lo largo de la dirección del movimiento).
    coord.x /= (1.0 + vEstela * 0.92);
    coord.y /= (1.0 - radial * 0.35 * vEstela);

    float d = length(coord) * 2.0;

    // Núcleo brillante más halo suave: dos términos, sin ninguna textura.
    float nucleo = smoothstep(0.55, 0.0, d);
    float halo = smoothstep(1.0, 0.0, d) * 0.32;
    float alfa = clamp(nucleo + halo, 0.0, 1.0);

    if (alfa < 0.01) discard;

    // La mayoría de estrellas son blancas-frías; unas pocas heredan el
    // acento de la marca. vTinte reparte esa mezcla de forma estable.
    vec3 color = mix(uColorBase, uColorAcento, smoothstep(0.72, 1.0, vTinte));

    gl_FragColor = vec4(color * (0.6 + nucleo * 0.9), alfa * uOpacidad);
  }
`;

/**
 * Crea el campo de estrellas.
 *
 * @param {object} opciones
 * @param {'alto'|'medio'|'bajo'} opciones.nivel
 * @param {number} opciones.radio  radio de la esfera de distribución
 * @param {object} opciones.paleta
 */
export function crearEstrellas({ nivel, radio, paleta }) {
  const conf = perfil(nivel);
  const cantidad = conf.puntosEstrella;
  const random = azar(SEMILLA);

  const posiciones = new Float32Array(cantidad * 3);
  const tamanos = new Float32Array(cantidad);
  const tintes = new Float32Array(cantidad);

  for (let i = 0; i < cantidad; i += 1) {
    // Distribución uniforme sobre la esfera: se toma la coordenada Z
    // uniforme y se calcula el ángulo. Repartir los tres ejes al azar
    // amontona las estrellas en los polos.
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = radio * (0.18 + 0.82 * Math.cbrt(random()));

    posiciones[i * 3] = r * s * Math.cos(theta);
    posiciones[i * 3 + 1] = r * u;
    posiciones[i * 3 + 2] = r * s * Math.sin(theta);

    // Distribución de tamaños sesgada hacia lo pequeño: unas pocas
    // estrellas grandes dan escala, muchas pequeñas dan textura.
    tamanos[i] = aleatorio(0.7, 2.6) * (random() < 0.06 ? 2.2 : 1);

    // El 18 % hereda el acento de color; el resto es blanco frío.
    tintes[i] = random() < 0.18 ? 0.78 + random() * 0.22 : random() * 0.5;
  }

  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new BufferAttribute(posiciones, 3));
  geometria.setAttribute('aTamano', new BufferAttribute(tamanos, 1));
  geometria.setAttribute('aTinte', new BufferAttribute(tintes, 1));

  // Sin radio de colisión ni de inveceamiento: las estrellas son puntos.
  // `frustumCulled` desactivado porque la esfera abarca toda la escena y
  // su volumen no tiene ningún cálculo útil que hacer; calcularlo costaría más.
  geometria.boundingSphere = null;

  const material = new ShaderMaterial({
    uniforms: {
      uTiempo: { value: 0 },
      uPixelRatio: { value: 1 },
      uEstelas: { value: 0 },
      uOpacidad: { value: 0 },
      uColorBase: { value: paleta.tinta.clone() },
      uColorAcento: { value: paleta.cian.clone() },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });

  const puntos = new Points(geometria, material);
  puntos.frustumCulled = false;
  puntos.renderOrder = -10;

  return {
    objeto: puntos,
    material,
    geometria,

    /** @param {number} segundos @param {number} dpr @param {number} estelas 0..1 */
    actualizar(segundos, dpr, estelas) {
      const u = material.uniforms;
      u.uTiempo.value = segundos;
      u.uPixelRatio.value = dpr;
      // Las estelas solo se activan en los niveles que las compran.
      u.uEstelas.value = conf.estelas ? estelas : 0;
      u.uOpacidad.value = 1;
    },

    aplicarPaleta(nueva) {
      material.uniforms.uColorBase.value.copy(nueva.tinta);
      material.uniforms.uColorAcento.value.copy(nueva.cian);
    },

    liberar() {
      geometria.dispose();
      material.dispose();
    },
  };
}
