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
import { aleatorio, clamp } from '../../core/util.js';
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
  attribute float aNacimiento;

  uniform float uTiempo;
  uniform float uPixelRatio;
  uniform float uEstelas;
  uniform float uExpansion;

  varying float vTinte;
  varying float vEstela;
  varying float vEnciende;
  varying float vTipo;

  /* Hash determinista a partir de un numero estable por estrella. GLSL ES no
     trae rand(): se hace con fract(sin()), que basta para repartir tipos. */
  float azarEstrella(float semilla) {
    return fract(sin(semilla * 127.1 + 311.7) * 43758.5453);
  }

  void main() {
    vTinte = aTinte;
    // Tipo estelar estable (0..1), independiente de vTinte para que el color
    // y la mezcla con el acento de marca no queden correlacionados.
    vTipo = azarEstrella(aTinte * 91.3 + aNacimiento * 17.9);

    /* CADA ESTRELLA SE ENCIENDE CUANDO LA ONDA LLEGA A SU ALTURA.
       El atributo dice a que fraccion del radio de la esfera esta, y la onda
       dice por donde va. La diferencia entre las dos es el encendido de esa
       estrella. Sin esto el cielo ya esta lleno antes de que empiece el
       arranque, que es justo lo contrario de un Big Bang: el universo no
       tendria nada que abrir. */
    float enciende = smoothstep(aNacimiento, aNacimiento + 0.11, uExpansion);
    vEnciende = enciende;

    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vec4 vista = viewMatrix * mundo;

    // Centelleo muy leve. Con la camara quieta, un cielo completamente
    // estatico delata el truco; con parpadeo agresivo marea.
    // Se calcula sin sin(uTiempo * algo) para que cada estrella titile
    // con su propia fase.
    float fase = aTinte * 6.2831853;
    float titileo = 0.86 + 0.14 * sin(uTiempo * 0.7 + fase);

    gl_Position = projectionMatrix * vista;

    /* Tamaño. Este número era el motivo de que el cielo pareciera vacío al
       mirar la captura: con la atenuación anterior, una estrella a mil
       unidades medía 2,6 · 0,38 = 0,99 píxeles. Un punto de un píxel con
       mezcla aditiva sobre negro es, literalmente, medio punto de luz, y a
       simple vista no está.

       Ahora el mínimo es de un píxel y hay un suelo de tamaño que no depende
       de la distancia: las lejanas se ven MÁS PEQUEÑAS, no invisibles. Es la
       diferencia entre un cielo y un vacío. */
    float distancia = -vista.z;
    float atenuacion = 1.0 / (1.0 + distancia * 0.0011);
    float tamBase = aTamano * (0.5 + atenuacion * 1.3);

    // Variación de tamaño: algunas estrellas son naturalmente más grandes.
    float tamanoAleatorio = 0.7 + azarEstrella(aTinte * 53.7 + aNacimiento * 29.1) * 0.3;
    float tam = tamBase * tamanoAleatorio;

    gl_PointSize = clamp(tam * uPixelRatio * titileo, 2.0, 15.0);

    // Longitud de la estela segun la velocidad, en unidades de sprite.
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
  varying float vEnciende;
  varying float vTipo;

  void main() {
    // Coordenadas del sprite: el punto se dibuja como un cuadrado de
    // gl_PointSize y el fragmento sabe donde esta dentro de el.
    vec2 centro = gl_PointCoord - 0.5;

    // La estela se estira en RADIAL respecto al centro de la pantalla, que es
    // la direccion en la que se aleja una estrella al avanzar. En el centro
    // exacto la direccion es indeterminada, asi que se degrada a un punto.
    vec2 direccion = normalize(centro + vec2(0.0001));
    float radial = length(centro) * 2.0;
    vec2 coord = vec2(dot(centro, vec2(-direccion.y, direccion.x)),
                      dot(centro, direccion));

    // Estirado vertical (a lo largo de la direccion del movimiento).
    coord.x /= (1.0 + vEstela * 0.92);
    coord.y /= (1.0 - radial * 0.35 * vEstela);

    float d = length(coord) * 2.0;

    /* Sin estrella encendida no hay fragmento que dibujar: es la propia
       explosion la que va abriendo el espacio. */
    if (vEnciende < 0.02) discard;

    // Variación de color por estrella: algunas son azules, otras blancas,
    // otras amarillas pálidas, simulando tipos estelares diferentes.
    float aleaColor = vTipo;
    vec3 colorEstrella;
    if (aleaColor < 0.55) {
      // Blancas mayoritarias
      colorEstrella = uColorBase * (0.8 + aleaColor * 0.4);
    } else if (aleaColor < 0.75) {
      // Azules (estrellas calientes)
      colorEstrella = uColorBase * vec3(0.6, 0.8, 1.0) * (0.9 + aleaColor * 0.2);
    } else if (aleaColor < 0.9) {
      // Amarillentas
      colorEstrella = uColorBase * vec3(1.0, 0.95, 0.8) * (0.85 + aleaColor * 0.2);
    } else {
      // Rojizas (enfermas/enanas)
      colorEstrella = uColorBase * vec3(1.0, 0.7, 0.5) * (0.7 + aleaColor * 0.3);
    }

    // Nucleo brillante mas halo suave: dos terminos, sin ninguna textura.
    float nucleo = smoothstep(0.55, 0.0, d);
    float halo = smoothstep(1.0, 0.0, d) * 0.32;
    float alfa = clamp(nucleo + halo, 0.0, 1.0) * vEnciende;

    if (alfa < 0.01) discard;

    // La mayoria de estrellas son blancas-frias; unas pocas heredan el
    // acento de la marca. vTinte reparte esa mezcla de forma estable.
    vec3 color = mix(colorEstrella, uColorAcento, smoothstep(0.72, 1.0, vTinte));

    /* Las que acaban de encender estan al rojo: una estrella recien formada
       esta caliente. Sin esto, encenderlas todas con el mismo blanco de las
       demas delataria que no hubo explosion. */
    color = mix(color * vec3(1.35, 0.82, 0.62), color, smoothstep(0.0, 0.4, vEnciende));

    /* Por encima de 1, y a propósito. Las estrellas se suman —mezcla aditiva—
       sobre un fondo que el velo de la sección deja en torno a 20/255, y una
       estrella que aporta 50/255 se convierte en 30 tras el velo: invisible.
       Con el color por encima de 1 el núcleo satura a blanco, que es
       exactamente lo que hace una estrella, y el halo conserva el tinte. */
    gl_FragColor = vec4(color * (1.6 + nucleo * 2.4), alfa * uOpacidad);
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
export function crearEstrellas({ nivel, radio, paleta, radioOndaInicial = 0 }) {
  const conf = perfil(nivel);
  const cantidad = conf.puntosEstrella;
  const random = azar(SEMILLA);

  const posiciones = new Float32Array(cantidad * 3);
  const tamanos = new Float32Array(cantidad);
  const tintes = new Float32Array(cantidad);
  const nacimientos = new Float32Array(cantidad);

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

    /* CUÁNDO SE ENCIENDE, NO DÓNDE. La onda no arranca en cero: empieza con un
       radio, y desde ahí crece. El orden en que aparecen las estrellas es el
       orden en que la onda pasa por su altura, así que lo que se guarda es su
       distancia normalizada al recorrido real de la onda. Sin esto el cielo
       estaría lleno antes de tiempo y el arranque no abriría nada. */
    nacimientos[i] = radioOndaInicial > 0
      ? clamp((r - radioOndaInicial) / Math.max(1, radio - radioOndaInicial), 0, 1)
      : clamp(r / radio, 0, 1);

    /* Distribución de tamaños sesgada hacia lo pequeño: unas pocas
       estrellas grandes dan escala, muchas pequeñas dan textura. El 8 % que
       se multiplica son las que el ojo usa para leer profundidad; sin ellas
       el campo es una textura uniforme. */
    tamanos[i] = aleatorio(1.3, 3.4) * (random() < 0.08 ? 2.6 : 1);

    // El 18 % hereda el acento de color; el resto es blanco frío.
    tintes[i] = random() < 0.18 ? 0.78 + random() * 0.22 : random() * 0.5;
  }

  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new BufferAttribute(posiciones, 3));
  geometria.setAttribute('aTamano', new BufferAttribute(tamanos, 1));
  geometria.setAttribute('aTinte', new BufferAttribute(tintes, 1));
  geometria.setAttribute('aNacimiento', new BufferAttribute(nacimientos, 1));

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
      uExpansion: { value: 1 },
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

    /**
     * @param {number} segundos Reloj del universo.
     * @param {number} dpr
     * @param {number} estelas 0..1
     * @param {number} expansion 0..1. Por dónde va la onda del arranque: cada
     *   estrella se enciende cuando la onda llega a su altura.
     */
    actualizar(segundos, dpr, estelas, expansion = 1) {
      const u = material.uniforms;
      u.uTiempo.value = segundos;
      u.uPixelRatio.value = dpr;
      // Las estelas solo se activan en los niveles que las compran.
      u.uEstelas.value = conf.estelas ? estelas : 0;
      u.uExpansion.value = expansion;
      u.uOpacidad.value = 1;
    },


    liberar() {
      geometria.dispose();
      material.dispose();
    },
  };
}
