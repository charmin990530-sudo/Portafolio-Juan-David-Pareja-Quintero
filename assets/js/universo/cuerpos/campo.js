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
  AdditiveBlending,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
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

/* ------------------------------------------------------------------
   Las cinco balizas
   ------------------------------------------------------------------

   "Cinco etapas, siempre en este orden" era una linea de texto sin nada que
   la respaldara en el espacio: el campo de escombros existia, pero las cinco
   balizas que el propio modulo describia en su cabecera no se llegaron a
   construir nunca. Ahora si.

   Una baliza por etapa, en linea de vuelo, y se encienden segun la posicion
   dentro de la seccion. La que esta encendida es la etapa que el texto de la
   derecha esta explicando, asi que el diagrama del HTML y la escena dicen lo
   mismo en el mismo instante. */

const VERT_BALIZA = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vMundo;

  void main() {
    vUv = uv;
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vMundo = mundo.xyz;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

const FRAG_BALIZA = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uEncendido;
  uniform float uAlcance;

  varying vec2 vUv;
  varying vec3 vMundo;

  ${LUZ}

  void main() {
    /* Anillo fino, como el haz de una baliza vistas de frente. La mascara
       radial deja solo el borde: un disco lleno seria un pegamento y no
       una luz. */
    float d = length(vUv - 0.5) * 2.0;
    float anillo = smoothstep(1.0, 0.86, d) * smoothstep(0.62, 0.86, d);

    /* El haz se alarga en la direccion de la camara con la distancia, que
       es lo que hace que se lea como una luz y no como un aro. */
    float nucleo = pow(smoothstep(1.0, 0.0, d), 3.0);

    float fuerza = anillo * 0.9 + nucleo * 0.5;
    if (fuerza < 0.01) discard;

    float alfa = fuerza * uEncendido * uAlcance;
    gl_FragColor = vec4(uColor * alfa, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Las cinco balizas del tramo de Proceso.
 *
 * @param {object} o
 * @param {'alto'|'medio'|'bajo'} o.nivel
 * @param {number[][]} o.posiciones Una por etapa, en coordenadas de mundo.
 * @param {object[]} o.etapas        De `data/proceso.js`, para el color.
 * @param {object} o.paleta
 * @param {(indice:number)=>object} o.resolverColor
 */
export function crearBalizasProceso({ nivel, posiciones, etapas, resolverColor }) {
  const conf = perfil(nivel);
  const detalle = conf.detallePlaneta > 2 ? 24 : 12;
  const grupo = new Group();
  const piezas = [];

  etapas.forEach((etapa, i) => {
    const [x, y, z] = posiciones[i] ?? [0, 0, 0];

    const material = new ShaderMaterial({
      uniforms: {
        uColor: { value: resolverColor(etapa) },
        uEncendido: { value: 0 },
        uAlcance: { value: 1 },
      },
      vertexShader: VERT_BALIZA,
      fragmentShader: FRAG_BALIZA,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });

    const malla = new Mesh(new PlaneGeometry(1, 1), material);
    malla.position.set(x, y, z);
    malla.renderOrder = 4;
    grupo.add(malla);

    piezas.push({ malla, material, etapa });
  });

  return {
    grupo,
    piezas,

    /**
     * @param {number} posicion 0..1 dentro de la seccion de Proceso.
     * @param {number} entrada  Multiplicador de visibilidad del tramo.
     * @param {object} camara   Para orientar las balizas a camara.
     */
    actualizar(posicion, entrada, camara) {
      const total = piezas.length || 1;
      piezas.forEach((pieza, i) => {
        /* Cada baliza tiene su franja. El ancho es el de su etapa en el
           scroll, de modo que la luz sigue al texto: mientras se explica la
           etapa dos, la baliza dos es la que esta encendida. */
        const centro = (i + 0.5) / total;
        const medio = 0.5 / total;
        const propia = 1 - Math.min(1, Math.abs(posicion - centro) / (medio * 1.15));
        const encendida = Math.pow(propia, 1.6);

        pieza.material.uniforms.uEncendido.value = (0.22 + encendida * 0.95) * entrada;
        pieza.material.uniforms.uAlcance.value = 1;

        // Las balizas se encienden mas grandes: es su unica forma de
        // llamar la atencion desde lejos.
        const escala = 54 + encendida * 70;
        pieza.malla.scale.set(escala, escala, 1);
        if (camara) pieza.malla.quaternion.copy(camara.quaternion);
        pieza.malla.visible = entrada > 0.02;
      });
    },

    liberar() {
      for (const pieza of piezas) {
        pieza.malla.geometry.dispose();
        pieza.material.dispose();
      }
    },
  };
}
