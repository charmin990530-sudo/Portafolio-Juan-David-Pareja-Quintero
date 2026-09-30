/**
 * universo/cuerpos/campo.js — Campo de escombros del tramo de Proceso.
 *
 * Las cinco etapas del proceso son cinco balizas en línea de vuelo, y el
 * espacio entre ellas está lleno de roca. Eso hace dos cosas a la vez: da la
 * sensación de velocidad cuando se atraviesa y hace visible el "cinco
 * etapas, siempre en este orden" que dice el texto de la sección.
 *
 * Todas las rocas en un `InstancedMesh`: una llamada de dibujo.
 */

import {
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedBufferAttribute,
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
  attribute float aBrillo;

  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vMundo;
  varying vec3 vColor;
  varying float vBrillo;

  void main() {
    vLocal = position;
    vBrillo = aBrillo;
    vNormal = normalize(mat3(instanceMatrix) * normal);

    mat4 mundo = modelMatrix * instanceMatrix;
    vec4 posicion = mundo * vec4(position, 1.0);
    vMundo = posicion.xyz;

    #ifdef COLOR_INSTANCING
      vColor = instanceColor;
    #else
      vColor = vec3(0.6, 0.45, 0.32);
    #endif

    gl_Position = projectionMatrix * viewMatrix * posicion;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uLuz;
  uniform float uEntrada;

  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vMundo;
  varying vec3 vColor;
  varying float vBrillo;

  ${RUIDO}
  ${LUZ}

  void main() {
    float grano = fbm(normalize(vLocal) * 3.6, 3);
    vec3 base = vColor * (0.7 + grano * 0.5);

    vec3 normal = normalize(vNormal);
    float d = difusion(normal, uLuz);
    vec3 vision = normalize(cameraPosition - vMundo);

    // Borde cálido: es lo que separa la roca del fondo cuando la roca es
    // pequeña y queda a un píxel. Sin esto, las lejanas son invisibles.
    float borde = fresnel(normal, vision, 2.2);

    vec3 color = base * (0.12 + d * 0.95) + vColor * borde * 0.4 * vBrillo;

    gl_FragColor = vec4(color * uEntrada, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const matriz = new Matrix4();
const quat = new Quaternion();
const pos = new Vector3();
const esc = new Vector3();
const EJE = new Vector3(0.3, 1, 0.1).normalize();

/**
 * @param {object} o
 * @param {'alto'|'medio'|'bajo'} o.nivel
 * @param {Array<[number,number,number]>} o.caja  La región que envuelve la ruta.
 * @param {number} o.radioMin
 * @param {number} o.radioMax
 * @param {string} o.color
 */
export function crearCampo({ nivel, caja, radioMin = 0.25, radioMax = 1.6, color = '#8a6a4a' }) {
  const conf = perfil(nivel);
  const total = conf.rocasCampo;

  const geometria = new IcosahedronGeometry(1, 0); // 20 triángulos: da igual
  //                                                        // que se vea la cara
  const brillo = new Float32Array(total);

  const material = new ShaderMaterial({
    uniforms: {
      uLuz: { value: direccionLuz.clone() },
      uEntrada: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  material.defines = { COLOR_INSTANCING: '' };

  const malla = new InstancedMesh(geometria, material, total);
  malla.instanceMatrix.setUsage(DynamicDrawUsage);
  malla.frustumCulled = false;

  const colorBase = new Color(color);

  /* Las rocas se colocan en el volumen que rodea la ruta y se CONGELAN.
     Que no se muevan es lo importante: son la referencia de velocidad. Si
     flotaran con la cámara, el campo no transmitiría nada; como están fijas
     en el mundo, el contraste entre ellas y la cámara es exactamente la
     medida de lo rápido que te mueves. */
  const [x0, y0, z0, x1, y1, z1] = caja;
  for (let i = 0; i < total; i += 1) {
    const r = radioMin + (radioMax - radioMin) * Math.pow(Math.random(), 2.2);

    pos.set(
      x0 + (x1 - x0) * Math.random(),
      y0 + (y1 - y0) * Math.random(),
      z0 + (z1 - z0) * Math.random(),
    );
    // Escala desigual en los tres ejes: una roca esférica no parece roca.
    esc.set(r * (0.6 + Math.random() * 0.9), r * (0.5 + Math.random() * 1.1), r * (0.6 + Math.random() * 0.9));
    quat.setFromAxisAngle(EJE, Math.random() * Math.PI * 2);
    matriz.compose(pos, quat, esc);
    malla.setMatrixAt(i, matriz);

    // Las rocas grandes son las que se ven: se les da más brillo de borde.
    brillo[i] = 0.4 + (r - radioMin) / (radioMax - radioMin) * 1.2;

    // Variación de tono para que el campo no se lea como un solo material.
    const t = Math.random();
    malla.setColorAt(i, colorBase.clone().lerp(new Color('#c9a06a'), t * 0.6));
  }
  malla.instanceMatrix.needsUpdate = true;
  malla.instanceColor.needsUpdate = true;

  /* `aBrillo` va como atributo instanciado, no como atributo de la
     geometría: hay un valor por roca, no por vértice. Con un atributo
     normal, las 320 rocas compartirían un único valor y el realce de las
     grandes no se vería. */
  geometria.setAttribute('aBrillo', new InstancedBufferAttribute(brillo, 1));

  return {
    malla,
    material,

    actualizar(entrada) {
      material.uniforms.uEntrada.value = entrada;
      malla.visible = entrada > 0.01;
    },

    liberar() {
      geometria.dispose();
      material.dispose();
      malla.dispose();
    },
  };
}
