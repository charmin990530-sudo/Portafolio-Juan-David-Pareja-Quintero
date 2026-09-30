/**
 * universo/cuerpos/atmosfera.js — Cáscara de dispersión alrededor de un cuerpo.
 *
 * Una esfera ligeramente mayor que el planeta, pintada por dentro, cuya
 * opacidad depende del ángulo de visión (fresnel). Así el borde se vuelve
 * luminoso y el centro transparente: es una atmósfera vista desde fuera.
 *
 * Solo se monta en los niveles ALTO y MEDIO. En BAJO el mismo efecto se
 * consigue más barato con el realce de limbo que ya hace el shader del
 * planeta, así que la cáscara no aporta nada y se omite.
 */

import {
  AdditiveBlending,
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  Vector3,
} from '../../../vendor/three/0.186.1/three.module.js';
import { geometriaPlaneta } from './planeta.js';
import { LUZ } from '../shaders/comunes.js';

const VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vMundo;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vMundo = mundo.xyz;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform vec3 uLuz;
  uniform float uFuerza;
  uniform float uEntrada;

  varying vec3 vNormal;
  varying vec3 vMundo;

  ${LUZ}

  void main() {
    // La normal apunta hacia dentro porque la cara visible es la interior.
    vec3 normal = normalize(-vNormal);
    vec3 vision = normalize(cameraPosition - vMundo);

    /* El borde se ilumina y el centro se transparente. En el nivel ALTO se
       añade un segundo término, más ancho y más frío, que simula la dispersión
       Rayleigh en la capa alta. Con dos términos se obtiene el degradado
       doble —borde nítido, halo difuso— que hace que una atmósfera parezca
       atmósfera y no un contorno. */
    float borde = pow(1.0 - clamp(dot(normal, vision), 0.0, 1.0), 3.0);
    float alto = pow(1.0 - clamp(dot(normal, vision), 0.0, 1.0), 1.4);

    // La atmósfera solo existe en la mitad iluminada, con un margen suave
    // sobre el terminador. Sin esto, el lado nocturno del planeta tendría
    // un aro de luz y rompería la ilusión por completo.
    float luz = difusion(normal, uLuz);
    float margen = smoothstep(0.18, 0.56, luz);

    float alfa = (borde + alto * 0.34) * uFuerza * margen * uEntrada;

    if (alfa < 0.004) discard;

    // Hacia el terminador la luz atraviesa más atmósfera y se vuelve cálida:
    // es el mismo efecto del atardecer en la Tierra.
    vec3 color = mix(uColor, uColor * vec3(1.25, 0.86, 0.72), smoothstep(0.62, 0.2, luz));

    gl_FragColor = vec4(color, clamp(alfa, 0.0, 1.0));

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** La misma dirección de sol que usa el shader del planeta, sin normalizar
 *  aquí: el shader normaliza dentro de `difusion`. Compartida para que el
 *  planeta y su atmósfera no puedan quedar iluminados desde puntos distintos. */
const DIRECCION_SOL = new Vector3(0.6, 0.42, 0.7);

export { DIRECCION_SOL };

/**
 * @param {object} o
 * @param {'alto'|'medio'|'bajo'} o.nivel
 * @param {number} o.detalle   Hereda el del planeta.
 * @param {string} o.color
 * @param {number} o.radio     Radio del planeta al que se añade la cáscara.
 * @param {number} o.escala    Multiplicador de radio de la cáscara.
 * @param {number} o.fuerza    0..1
 */
export function crearAtmosfera({ detalle, color, radio, escala = 1.055, fuerza = 1 }) {
  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uLuz: { value: DIRECCION_SOL.clone() },
      uFuerza: { value: fuerza },
      uEntrada: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    side: BackSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const malla = new Mesh(geometriaPlaneta(detalle), material);
  malla.scale.setScalar(radio * escala);

  return {
    malla,
    material,

    actualizar(entrada) {
      material.uniforms.uEntrada.value = entrada;
    },

    liberar() {
      // Geometría compartida con el planeta: la libera `liberarGeometrias()`.
      material.dispose();
    },
  };
}
