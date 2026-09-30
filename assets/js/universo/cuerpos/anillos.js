/**
 * universo/cuerpos/anillos.js — Sistema de anillos alrededor de un gigante.
 *
 * Dos capas de discos planos con transparencia y una sombra del planeta
 * proyectada. La sombra es lo que hace que un anillo parezca un anillo y no
 * un disco: sin ella, el anillo es una plancha de luz plana detrás de la
 * esfera y el cuerpo pierde volumen.
 *
 * El momento para el que existe todo esto: la cámara CRUZA el plano de los
 * anillos. Para que ese cruce funcione, el anillo tiene que ser visible desde
 * los dos lados y ser lo bastante fino para que atravesarlo no tape el
 * panorama. De ahí las dos capas finas con huecos entre franjas.
 */

import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from '../../../vendor/three/0.186.1/three.module.js';
import { RUIDO } from '../shaders/comunes.js';
import { perfil } from '../calidad.js';
import { direccionLuz } from './planeta.js';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocal;
  varying vec3 vMundo;

  void main() {
    vUv = uv;
    vLocal = position;
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vMundo = mundo.xyz;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uLuz;
  uniform vec3 uCentro;   // centro del planeta, en espacio de mundo
  uniform float uRadioPlaneta;
  uniform float uEntrada;
  uniform float uSemilla;
  uniform float uOpacidadBase;
  uniform float uPerfil;

  varying vec2 vUv;
  varying vec3 vLocal;
  varying vec3 vMundo;

  ${RUIDO}

  void main() {
    // vUv.x recorre el radio de la geometría de anillo, de dentro a fuera.
    float radio = vUv.x;

    /* Franjas.
       Un anillo real no es liso: tiene huecos. Se generan con dos escalas de
       ruido en el radio —una lenta para la estructura ancha, otra rápida
       para las divisions finas— y un umbral que abre huecos de verdad, no un
       degradado. Un degradado se lee como cristal esmerilado; los huecos
       se leen como polvo. */
    float bandaLenta = fbm(vec3(radio * 9.0, uSemilla, 0.0), 3) * 0.5 + 0.5;
    float bandaRapida = ruido(vec3(radio * 58.0, uSemilla * 2.0, 0.0)) * 0.5 + 0.5;
    float estructura = bandaLenta * 0.68 + bandaRapida * 0.32;

    // Huecos: dos cortes, uno estrecho y otro ancho. El ancho abre la
    // separación de Cassini, que es la característica que la gente reconoce.
    float huecoFino = smoothstep(0.03, 0.09, abs(estructura - 0.42));
    float huecoAncho = smoothstep(0.012, 0.05, abs(radio - 0.58));
    float densidad = huecoFino * huecoAncho;

    // Perfil radial: se desvanece en los dos bordes interiores.
    float bordeInt = smoothstep(0.02, 0.14, radio);
    float bordeExt = 1.0 - smoothstep(0.86, 1.0, radio);
    float alfa = densidad * bordeInt * bordeExt;

    if (alfa < 0.01) discard;

    /* Sombra del planeta.
       Se proyecta el punto del anillo sobre el plano perpendicular a la luz y
       se mide la distancia al eje del planeta. Si el punto queda dentro del
       disco y está en la mitad lejana al sol, está en sombra. Es una sombra
       de disco proyectada, y con una normal y una distancia sale barata. */
    vec3 luz = normalize(uLuz);
    vec3 desdeCentro = vMundo - uCentro;
    float aTravés = dot(desdeCentro, luz);
    float perpendicular = length(desdeCentro - luz * aTravés);

    // aTravés < 0 significa que el punto está en el hemisferio opuesto al
    // sol, que es el único donde el planeta puede proyectar sombra.
    float sombra = aTravés < 0.0
      ? smoothstep(uRadioPlaneta * 0.86, uRadioPlaneta * 1.1, perpendicular)
      : 1.0;
    float factorSombra = mix(0.16, 1.0, sombra);

    // Luz rasante: los anillos se ven mucho más apagados de canto.
    float rasante = 0.42 + 0.58 * pow(max(dot(vec3(0.0, 1.0, 0.0), luz), 0.0), 0.6);

    vec3 color = mix(uColorA, uColorB, smoothstep(0.3, 0.8, estructura));
    color *= factorSombra * rasante * (0.7 + bandaRapida * 0.6);

    gl_FragColor = vec4(color, alfa * uEntrada * uOpacidadBase * uPerfil);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * @param {object} o
 * @param {'alto'|'medio'|'bajo'} o.nivel
 * @param {string} o.colorA
 * @param {string} o.colorB
 * @param {number} o.radioInterno
 * @param {number} o.radioExterno
 * @param {number} o.semilla
 */
export function crearAnillos({ nivel, colorA, colorB, radioInterno, radioExterno, semilla = 1 }) {
  const conf = perfil(nivel);
  const grupo = new Group();
  const capas = [];

  /* Dos capas por defecto en ALTO, una en MEDIO y BAJO.
     La segunda capa es un anillo interior más estrecho y de otro color: el
     resultado se parece a Saturno, donde el sistema visible son en realidad
     varios. Con una sola capa el resultado parece un disco. */
  const definiciones =
    conf.anillos >= 2
      ? [
          { interior: radioInterno, exterior: radioExterno, semilla, opacidad: 1 },
          { interior: radioInterno * 0.78, exterior: radioInterno * 0.99, semilla: semilla + 7, opacidad: 0.7 },
        ]
      : [{ interior: radioInterno, exterior: radioExterno, semilla, opacidad: 1 }];

  for (const [i, def] of definiciones.entries()) {
    const material = new ShaderMaterial({
      uniforms: {
        uColorA: { value: new Color(colorA) },
        uColorB: { value: new Color(colorB) },
        uLuz: { value: direccionLuz.clone() },
        uCentro: { value: new Vector3() },
        uRadioPlaneta: { value: 0 },
        uEntrada: { value: 0 },
        uSemilla: { value: def.semilla },
        uOpacidadBase: { value: def.opacidad },
        uPerfil: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    });

    const geometria = new RingGeometry(def.interior, def.exterior, 128, 1);
    const malla = new Mesh(geometria, material);
    malla.rotation.x = -Math.PI / 2; // el plano del anillo, tumbado
    // Ligera inclinación: un anillo perfectamente horizontal se lee como un
    // objeto de laboratorio. Cuatro grados bastan para que parezca un sistema.
    malla.rotation.z = 0.07;
    malla.renderOrder = 2 + i;
    grupo.add(malla);
    capas.push({ malla, material, geometria, opacidad: def.opacidad });
  }

  return {
    grupo,
    capas,

    /**
     * @param {number} entrada     Fundido de llegada.
     * @param {Vector3} centro     Centro del planeta en el mundo, para la sombra.
     * @param {number} radioPlaneta
     * @param {number} lateral      -1..1: cuánto se ve el anillo de canto.
     *   En el cruce del plano la cámara está en la misma altura que el anillo
     *   y este se ve de perfil; sube la opacidad para que el gesto de
     *   atravesarlo se lea, en vez de parecer que el anillo se apaga.
     */
    actualizar(entrada, centro, radioPlaneta, lateral = 0) {
      const deCanto = 0.5 + 0.5 * Math.min(1, Math.abs(lateral) * 1.7);
      for (const capa of capas) {
        const u = capa.material.uniforms;
        u.uEntrada.value = entrada;
        u.uCentro.value.copy(centro);
        u.uRadioPlaneta.value = radioPlaneta;
        u.uOpacidadBase.value = capa.opacidad;
        u.uPerfil.value = deCanto;
        capa.malla.visible = entrada > 0.01;
      }
    },

    liberar() {
      for (const capa of capas) {
        capa.geometria.dispose();
        capa.material.dispose();
      }
    },
  };
}
