/**
 * universo/cuerpos/lunas.js — Las habilidades.orbitando al gigante gaseoso.
 *
 * UNA sola llamada de dibujo para las 21 habilidades, con `InstancedMesh`.
 * Veintiún esferas sueltas serían veintiuna llamadas de dibujo y veintiún
 * materiales; con instancing es una llamada y un material. La diferencia en
 * gama media no es trivial: es la diferencia entre 60 y 30 fps.
 *
 * La decisión de diseño que hace que esto merezca la pena: **el radio de cada
 * luna es su nivel real**. HTML5 y CSS3, al 100 %, son las dos lunas grandes
 * y estables; JavaScript al 85 % es mediana; Python al 70 % es pequeña y va
 * más rápido. El árbol de habilidades se ve en la forma del sistema solar sin
 * leer un solo número. Y al posar el cursor sobre una luna aparece su `nota`,
 * que hasta ahora solo existía como `title` del navegador.
 */

import {
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from '../../../vendor/three/0.186.1/three.module.js';
import { RUIDO, LUZ } from '../shaders/comunes.js';
import { perfil } from '../calidad.js';
import { direccionLuz } from './planeta.js';

const VERTEX = /* glsl */ `
  // instanceMatrix lo inyecta Three.js automáticamente en un
  // InstancedMesh. instanceColor igual, si se rellena con
  // setColorAt. Por eso el material no necesita atributos propios: los
  // recibe gratis del sistema de instancias.
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vMundo;
  varying vec3 vColorLuna;
  varying float vEscala;

  void main() {
    vLocal = position;
    vEscala = length(instanceMatrix[0].xyz);

    // La normal se rota con la parte 3x3 de la matriz de instancia.
    vNormal = normalize(mat3(instanceMatrix) * normal);

    mat4 mundo = modelMatrix * instanceMatrix;
    vec4 posicion = mundo * vec4(position, 1.0);
    vMundo = posicion.xyz;

    #ifdef COLOR_INSTANCING
      vColorLuna = instanceColor;
    #else
      vColorLuna = vec3(0.8);
    #endif

    gl_Position = projectionMatrix * viewMatrix * posicion;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uLuz;
  uniform float uTiempo;
  uniform float uEntrada;
  uniform float uResaltado;   // -1 = ninguno, índice de la luna enfocada

  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vMundo;
  varying vec3 vColorLuna;
  varying float vEscala;

  ${RUIDO}
  ${LUZ}

  void main() {
    vec3 p = normalize(vLocal);

    // Rugosidad: un icosaedro de detalle bajo se lee como un poliedro
    // facetado si no se rompe la silueta. Una capa de ruido en el espacio
    // local lo convierte en un cuerpo.
    vec3 q = p * 4.2;
    float grano = fbm(q + uTiempo * 0.03, 3);
    float relieve = fbm(q * 2.6, 2);

    vec3 base = vColorLuna * (0.78 + relieve * 0.34);

    // Cráteres oscuros en las depresiones: es lo que da textura de roca.
    base *= 1.0 - smoothstep(-0.18, -0.4, grano) * 0.45;

    vec3 normal = normalize(vNormal);
    float d = difusion(normal, uLuz);

    // Luz de borde para que las pequeñas se separen del fondo.
    vec3 vision = normalize(cameraPosition - vMundo);
    float borde = fresnel(normal, vision, 2.6);

    vec3 color = base * (0.16 + d * 1.05) + vColorLuna * borde * 0.55;

    // Realce de la luna enfocada: un pulso de luz en la superficie, no un
    // cambio de tamaño. Un tamaño cambiante haría que la luna "respirase"
    // y sacaría la cámara de su sitio.
    color += vColorLuna * borde * uResaltado * 0.9;

    gl_FragColor = vec4(color * uEntrada, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* Matrices y vectores reutilizados: en el bucle de render no se asigna nada. */
const matriz = new Matrix4();
const cuaternion = new Quaternion();
const posicion = new Vector3();
const escala = new Vector3();
const EJE = new Vector3(0, 1, 0);

/**
 * @param {object} o
 * @param {'alto'|'medio'|'bajo'} o.nivel
 * @param {Array} o.habilidades  Lista plana de `{ nombre, nivel, nota }`,
 *   la que ya produce `data/stack.js` al aplanar sus grupos.
 * @param {Array} o.colores      Un color por habilidad, en el mismo orden.
 * @param {number} o.radioBase   Radio interno de la primera órbita.
 * @param {number} o.radioMax    Radio de la órbita más externa.
 * @param {number} o.radioLuna   Radio de una luna al 100 %.
 */
export function crearLunas({
  nivel,
  habilidades,
  colores,
  radioBase,
  radioMax,
  radioLuna = 0.9,
}) {
  const conf = perfil(nivel);
  const total = habilidades.length;

  const geometria = new IcosahedronGeometry(1, Math.max(1, conf.detallePlaneta - 2));

  const material = new ShaderMaterial({
    uniforms: {
      uLuz: { value: direccionLuz.clone() },
      uTiempo: { value: 0 },
      uEntrada: { value: 0 },
      uResaltado: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    vertexColors: false,
  });

  // `setColorAt` exige que el material declare colores por instancia.
  material.defines = { COLOR_INSTANCING: '' };

  const malla = new InstancedMesh(geometria, material, total);
  malla.instanceMatrix.setUsage(DynamicDrawUsage);
  malla.frustumCulled = false; // las lunas se mueven; el corte por frustum
  //                                  calcularía una esfera enorme cada cuadro
  //                                  y no ahorraría trabajo real.

  /* Órbitas.
     Cada luna tiene su plano inclinado y su velocidad. La velocidad angular
     baja con la distancia —como la tercera ley de Kepler, aproximado— para
     que el sistema no se lea como un carrusel: las internas giran rápido y
     las externas apenas se mueven. */
  const orbits = habilidades.map((habilidad, i) => {
    const t = total > 1 ? i / (total - 1) : 0;
    return {
      // Reparto en espiral: el radio crece más despacio al principio, lo que
      // evita el aspecto de "norias alineadas" y da una distribución natural.
      radio: radioBase + (radioMax - radioBase) * Math.sqrt(t),
      inclinacion: (0.06 + ((i * 37) % 100) / 100 * 0.5) * (i % 2 === 0 ? 1 : -1),
      fase: (i / total) * Math.PI * 2 + ((i * 53) % 100) / 100 * 0.6,
      // La velocidad angular cae con el inverso del radio al cuadrado.
      velocidad: (1 / Math.pow(radioBase + (radioMax - radioBase) * Math.sqrt(t), 1.5)) * 0.9,
      // El nivel real se convierte en radio: esa es la idea entera.
      escala: radioLuna * (0.22 + 0.78 * (habilidad.nivel / 100)),
      indice: i,
    };
  });

  for (const [i, luna] of orbits.entries()) {
    malla.setColorAt(i, new Color(colores[i] ?? '#ffffff'));
  }
  malla.instanceColor.needsUpdate = true;

  return {
    malla,
    material,
    orbits,
    habilidades,

    /**
     * @param {number} segundos
     * @param {number} entrada
     * @param {number} enfocada  Índice de la luna enfocada, o -1.
     */
    actualizar(segundos, entrada, enfocada = -1) {
      material.uniforms.uTiempo.value = segundos;
      material.uniforms.uEntrada.value = entrada;

      for (const luna of orbits) {
        const angulo = luna.fase + segundos * luna.velocidad;
        const x = Math.cos(angulo) * luna.radio;
        const z = Math.sin(angulo) * luna.radio;
        const y = Math.sin(angulo * 0.5 + luna.fase) * luna.radio * luna.inclinacion * 0.18;

        posicion.set(x, y, z);
        escala.setScalar(luna.escala);

        // Giro propio de la luna, distinto del orbital: si coincidieran,
        // la luna parecería girada por el vacío.
        matriz.compose(
          posicion,
          cuaternio(cuaternion, EJE, segundos * 0.24 + luna.indice),
          escala,
        );
        malla.setMatrixAt(luna.indice, matriz);
      }
      malla.instanceMatrix.needsUpdate = true;

      material.uniforms.uResaltado.value = enfocada >= 0 ? 1 : 0;
    },

    liberar() {
      geometria.dispose();
      material.dispose();
      malla.dispose();
    },
  };
}

/* `Quaternion.setFromAxisAngle` sin asignar, para no crear objetos por cuadro. */
function cuaternio(q, eje, angulo) {
  const medio = angulo * 0.5;
  const s = Math.sin(medio);
  q.set(eje.x * s, eje.y * s, eje.z * s, Math.cos(medio));
  return q;
}
