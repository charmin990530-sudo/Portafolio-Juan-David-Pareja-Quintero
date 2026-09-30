/**
 * universo/capas/polvo.js — Polvo cósmico cercano.
 *
 * La capa que hace que el viaje se sienta tridimensional. Las estrellas están
 * tan lejos que su paralaje es casi nulo en el recorrido de una sección; el
 * polvo, que pasa rozando la cámara, es lo que de verdad transmite velocidad.
 *
 * Coste: un `Points` más, material compartido con el de las estrellas salvo en
 * la opacidad. En el nivel BAJO se reduce a un número casi testimonial y en
 * el ALTO sube a ~900. Nunca es el cuello de botella.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
} from '../../../vendor/three/0.186.1/three.module.js';
import { perfil } from '../calidad.js';

const VERTEX = /* glsl */ `
  attribute float aTamano;

  uniform float uTiempo;
  uniform float uPixelRatio;

  varying float vDesvanecer;

  void main() {
    vec4 mundo = modelMatrix * vec4(position, 1.0);

    // Deriva lenta y casi imperceptible. El polvo no debería moverse con la
    // cámara: si se moviera con ella desaparecería el paralaje, que es justo
    // lo que sirve para vender la profundidad.
    mundo.x += sin(uTiempo * 0.06 + position.z * 0.4) * 1.6;
    mundo.y += cos(uTiempo * 0.05 + position.x * 0.4) * 1.2;

    vec4 vista = viewMatrix * mundo;
    gl_Position = projectionMatrix * vista;

    float distancia = -vista.z;

    // Se desvanece al acercarse mucho para no cruzar la cámara como un
    // fogonazo, y también al alejarse para que el fondo quede limpio.
    vDesvanecer = smoothstep(6.0, 46.0, distancia) * (1.0 - smoothstep(900.0, 1800.0, distancia));

    gl_PointSize = aTamano * uPixelRatio * (90.0 / max(distancia, 1.0));
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uOpacidad;

  varying float vDesvanecer;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    // Perfil gaussiano aproximado con un smoothstep: más barato que
    // exp() y a esta resolución la diferencia no se ve.
    float alfa = smoothstep(1.0, 0.0, d) * smoothstep(0.0, 0.45, d);
    if (alfa < 0.01) discard;

    gl_FragColor = vec4(uColor, alfa * vDesvanecer * uOpacidad);
  }
`;

/**
 * @param {object} opciones
 * @param {'alto'|'medio'|'bajo'} opciones.nivel
 * @param {Array<[number,number,number]>} opciones.caja
 *   `[minX, minY, minZ, maxX, maxY, maxZ]` — el volumen que envuelve la ruta.
 */
export function crearPolvo({ nivel, caja, paleta }) {
  const conf = perfil(nivel);
  const cantidad = conf.puntosPolvo;

  const [x0, y0, z0, x1, y1, z1] = caja;
  const posiciones = new Float32Array(cantidad * 3);
  const tamanos = new Float32Array(cantidad);

  for (let i = 0; i < cantidad; i += 1) {
    posiciones[i * 3] = x0 + (x1 - x0) * Math.random();
    posiciones[i * 3 + 1] = y0 + (y1 - y0) * Math.random();
    posiciones[i * 3 + 2] = z0 + (z1 - z0) * Math.random();
    tamanos[i] = 0.35 + Math.random() * 0.9;
  }

  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new BufferAttribute(posiciones, 3));
  geometria.setAttribute('aTamano', new BufferAttribute(tamanos, 1));
  geometria.boundingSphere = null;

  const material = new ShaderMaterial({
    uniforms: {
      uTiempo: { value: 0 },
      uPixelRatio: { value: 1 },
      uOpacidad: { value: 0.5 },
      uColor: { value: paleta.cian.clone().lerp(paleta.violeta, 0.45) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const puntos = new Points(geometria, material);
  puntos.frustumCulled = false;
  puntos.renderOrder = -5;

  return {
    objeto: puntos,
    material,
    geometria,

    actualizar(segundos, dpr) {
      material.uniforms.uTiempo.value = segundos;
      material.uniforms.uPixelRatio.value = dpr;
    },


    liberar() {
      geometria.dispose();
      material.dispose();
    },
  };
}
