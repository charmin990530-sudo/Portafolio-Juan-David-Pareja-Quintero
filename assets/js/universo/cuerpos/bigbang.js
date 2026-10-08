/**
 * universo/cuerpos/bigbang.js — LA APERTURA: UN SOL QUE ESTALLA.
 *
 * ── EL PRIMER PLANO DE LA PELÍCULA ────────────────────────────────────
 *
 * La página no empieza en el espacio: empieza pegada a una estrella. Un sol
 * enorme, caliente y granulado que ocupa media pantalla, y que después se
 * rompe. Todo lo demás —el corredor de planetas, los anillos, las lunas— es
 * la consecuencia de ese instante.
 *
 * Eso es lo que faltaba, y la razón de por qué se ve tan claro al mirar la
 * captura: la versión anterior empezaba con UN PUNTO de 16 unidades que
 * moría antes de que empezara a verse, y el papel de protagonista lo cogían
 * 1 440 partículas de 26 a 80 píxeles que salían disparadas. El resultado no
 * era una explosión: era nieve.
 *
 * ── CUATRO PIEZAS, Y CADA UNA CON UN TRABAJO ─────────────────────────
 *
 *   1. `sol`     La estrella. Superficie con granulado, oscurecimiento en el
 *                limbo y un borde que se calienta. Es lo que se ve al abrir.
 *   2. `corona`  El halo alrededor de la estrella. Fresnel aditivo sobre la
 *                cara interior: lo que dice "esto está ardiendo" sin
 *                necesidad de ninguna textura.
 *   3. `onda`    La onda de choque. Se ve desde DENTRO, porque la cámara
 *                viaja dentro de ella. Un limbo brillante y nada más: el
 *                interior tiene que quedar transparente o la onda se
 *                convierte en una bola gris.
 *   4. `materia` Los escombros. Puntos PEQUEÑOS —de 2 a 14 píxeles— con un
 *                frente nítido y una rampa de color de blanco a cian a
 *                violeta. Es lo que se enfría y de ahí sale el primer mundo.
 *
 * ── UN SOLO NÚMERO ────────────────────────────────────────────────────
 *
 * `expansion`, de 0 a 1, lo escribe la escena desde el scroll de la portada
 * y gobierna las cuatro piezas a la vez. Que todas salgan del mismo número
 * es lo que hace que la apertura se lea como un SOLO fenómeno y no como
 * cuatro animaciones que casualmente empiezan a la vez.
 *
 * El guion de la apertura, con los cortes en su parte:
 *
 *   0,00 – 0,16   El sol arde. Se acerca y crece.
 *   0,16 – 0,34   Detonación. Blanco, se hincha, y se apaga.
 *   0,34 – 0,62   La onda pasa por la cámara. Materia salen y se enfría.
 *   0,62 – 1,00   El espacio se llena. Queda un mundo recién formado.
 */

import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  FrontSide,
  IcosahedronGeometry,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from '../../../vendor/three/0.186.1/three.module.js';
import { perfil } from '../calidad.js';
import { RUIDO } from '../shaders/comunes.js';

/* ------------------------------------------------------------------
   Los cuatro cortes de la apertura
   ------------------------------------------------------------------ */

const ARDE_HASTA = 0.16;
/* La singularidad. A scroll 0 la estrella no ocupa media pantalla: es un punto
   de luz con halo, y se hincha hasta su tamaño de estrella en este primer
   tramo de la apertura. Es lo que hace que la portada empiece como un Big Bang
   (un punto) y no como un sol ya hecho, y además deja ver la escena detrás del
   titular sin necesitar una cortina oscura encima. */
const NACE_EN = 0.25;
const RADIO_SINGULARIDAD = 3;
const CORONA_MINIMA = 11;
const DETONA_EN = 0.24;
const SOL_SE_APAGA = 0.46;

/* ------------------------------------------------------------------
   1 · El sol
   ------------------------------------------------------------------ */

const VERT_SOL = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vMundo;
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vMundo = mundo.xyz;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

const FRAG_SOL = /* glsl */ `
  precision highp float;

  uniform vec3 uCaliente;   // blanco de la fotosfera
  uniform vec3 uMedio;      // naranja de la estrella
  uniform vec3 uFrio;       // rojo profundo del limbo
  uniform float uTiempo;
  uniform float uBrillo;    // 0..1, lo escribe la apertura
  uniform float uDetona;    // 0..1, el fogonazo

  varying vec3 vNormal;
  varying vec3 vMundo;
  varying vec3 vLocal;

  ${RUIDO}

  void main() {
    vec3 vision = normalize(cameraPosition - vMundo);
    vec3 n = normalize(vNormal);

    /* mu es el coseno del ángulo con el que se mira cada punto: 1 en el
       centro del disco, 0 en el borde. Toda la lectura de "esfera" sale de
       aquí, y sin ella una esfera se ve como un círculo plano. */
    float mu = clamp(dot(n, vision), 0.0, 1.0);

    /* Granulado. La fotosfera de una estrella no es lisa: son células de gas
       convectivo del tamaño de un país. Con esto el sol tiene textura y se
       lee como materia ardiendo, no como un degradado de CSS. */
    vec3 p = normalize(vLocal);
    float grano = fbm(p * 7.5 + vec3(0.0, uTiempo * 0.06, 0.0), 4) * 0.5 + 0.5;
    float fino = fbm(p * 26.0 - vec3(uTiempo * 0.09, 0.0, 0.0), 3) * 0.5 + 0.5;
    float textura = mix(grano, fino, 0.35);

    /* Rampa de temperatura. El centro es blanco, el medio naranja y el limbo
       rojo: es como se ve una estrella de verdad, y hace que la esfera tenga
       volumen sin necesidad de luces. */
    /* El peso de mu sube y el de la textura se queda: antes el centro del
       disco era blanco puro porque el ángulo de visión se comía el ruido, y
       la superficie parecía un círculo liso. Ahora las células se leen
       también en el centro, que es donde más se ven en una estrella. */
    float calor = clamp(textura * 0.78 + mu * 0.34, 0.0, 1.0);
    vec3 color = mix(uFrio, uMedio, smoothstep(0.02, 0.5, calor));
    color = mix(color, uCaliente, smoothstep(0.62, 1.0, calor));

    /* Oscurecimiento del limbo: la fotosfera se ve más brillante en el centro
       del disco porque ahí se mira a través de menos capas de gas. */
    color *= 0.42 + 0.58 * pow(mu, 0.42);

    /* El borde se calienta. En el último instante antes de la detonación la
       estrellas se hincha y el borde se pone blanco: es la señal de que va a
       pasar algo, y es lo que hace que el arranque se sienta como una
       cuenta atrás y no como un fundido. */
    float borde = pow(1.0 - mu, 3.4);
    color += uCaliente * borde * (0.55 + uDetona * 2.4);

    float alfa = clamp(uBrillo * (0.7 + textura * 0.55 + uDetona * 0.9), 0.0, 1.0);
    if (alfa < 0.01) discard;

    /* El brillo va en el COLOR, no en subirlo a 1,75: con ese multiplicador
       el centro de la estrella saturaba a blanco plano y se perdía el
       granulado, que es justo lo que la hacía una estrella y no un disco.
       Aquí se sube lo justo para que la superficie tenga rango, y el fogonazo
       de la detonación es lo que se lleva por encima de 1. */
    gl_FragColor = vec4(color * (1.15 + uDetona * 2.6), alfa);
  }
`;

/* ------------------------------------------------------------------
   2 · La corona
   ------------------------------------------------------------------ */

const VERT_CORONA = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vMundo;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vMundo = mundo.xyz;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

const FRAG_CORONA = /* glsl */ `
  precision highp float;

  uniform vec3 uCaliente;
  uniform vec3 uMedio;
  uniform float uBrillo;

  varying vec3 vNormal;
  varying vec3 vMundo;

  void main() {
    vec3 vision = normalize(cameraPosition - vMundo);

    /* Se ve la CARA INTERIOR (BackSide), así que el valor va con valor
       absoluto: sin él el halo se invertiría.

       Y el halo tiene que ser MÁS BRILLOTO HACIA DENTRO, no hacia fuera:
       |dot| vale 1 en el centro del disco y 0 en la silueta, así que
       pow(|dot|, k) da un resplandor que se apaga al alejarse de la
       estrella. Al revés —con 1 - |dot|, que es lo que hacía la primera
       versión— la corona se dibujaba más brillante en su BORDE exterior y
       salía como una esfera naranja con un aro duro alrededor, que es
       justo lo contrario de una corona. */
    float centro = abs(dot(normalize(vNormal), vision));
    float halo = pow(centro, 2.4);
    vec3 color = mix(uMedio, uCaliente, pow(centro, 1.3));

    float alfa = halo * uBrillo;
    if (alfa < 0.004) discard;

    gl_FragColor = vec4(color * alfa, 1.0);
  }
`;

/* ------------------------------------------------------------------
   3 · La onda de choque
   ------------------------------------------------------------------ */

const VERT_ONDA = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vMundo;
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vMundo = mundo.xyz;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

const FRAG_ONDA = /* glsl */ `
  precision highp float;

  uniform vec3 uCaliente;
  uniform vec3 uFrio;
  uniform float uExpansion;
  uniform float uBrillo;

  varying vec3 vNormal;
  varying vec3 vMundo;
  varying vec3 vLocal;

  ${RUIDO}

  void main() {
    vec3 vision = normalize(cameraPosition - vMundo);
    float borde = 1.0 - abs(dot(normalize(vNormal), vision));

    /* El frente no es una superficie lisa. El ruido lo vuelve irregular, que
       es lo que separa "detonación" de "esfera que crece".

       El umbral empieza en 0,18 y no en 0,22, y el rango es corto a
       propósito: con un rango ancho, smoothstep devuelve 0 para media esfera
       y la onda salía dibujada a trozos. Ahora la superficie es continua y
       lo irregular es la MODULACIÓN, no la visibilidad. */
    vec3 p = normalize(vLocal);
    float ruido = fbm(p * 3.1 + uExpansion * 1.4, 3) * 0.5 + 0.5;
    float frente = 0.42 + 0.58 * smoothstep(0.18, 0.78, ruido);

    /* SOLO EL LIMBO. El interior tiene que quedar transparente: con la
       silueta entera dibujada, la onda era una bola gris plana que tapaba
       la estrella y todo lo demás. */
    float anillo = pow(borde, 5.0);
    float difusion = pow(borde, 1.5) * 0.16;

    /* La onda se enfría: blanco al salir, violeta al llegar al borde del
       sistema. Son los dos colores de la marca, para que la apertura no sea
       un cambio de tonos ajenos. */
    vec3 color = mix(uCaliente, uFrio, clamp(uExpansion * 1.2, 0.0, 1.0));

    float alfa = (anillo * frente * 3.2 + difusion * frente) * uBrillo;
    if (alfa < 0.004) discard;

    gl_FragColor = vec4(color * alfa, 1.0);
  }
`;

/* ------------------------------------------------------------------
   4 · La materia
   ------------------------------------------------------------------ */

const VERT_MATERIA = /* glsl */ `
  attribute vec3 aDireccion;
  attribute float aFase;
  attribute float aVelocidad;

  uniform float uRadio;
  uniform float uExpansion;
  uniform float uPixelRatio;

  varying float vAvance;
  varying float vFase;

  void main() {
    vFase = aFase;

    /* Cada partícula sale del núcleo y alcanza el frente. Las lentas se
       quedan atrás: si todas viajaran igual, el estallido se leería como un
       degradado y no como materia. */
    float avance = clamp(uExpansion * (1.62 - aVelocidad * 0.8) - aFase * 0.28, 0.0, 1.3);
    vAvance = avance;

    vec3 dir = normalize(aDireccion);
    /* Ondulación: sin ella las direcciones salen en líneas rectas desde un
       mismo punto y se ve que son líneas, no materia. */
    dir += vec3(
      sin(aFase * 11.0 + aVelocidad * 6.0),
      cos(aFase * 8.0 + aVelocidad * 4.0),
      sin(aFase * 6.0 + aVelocidad * 9.0)
    ) * 0.09;

    vec3 mundo = position + dir * (18.0 + avance * uRadio);

    vec4 vista = viewMatrix * vec4(mundo, 1.0);
    gl_Position = projectionMatrix * vista;

    /* PUNTOS PEQUEÑOS. Aquí estaba el defecto de fondo: 26 a 80 píxeles por
       partícula producían 1 440 manchas blancas y la Explosión se leía como
       nieve. La materia es invisible a simple vista; lo que se ve es el frente y
       el color. */
    float distancia = max(-vista.z, 1.0);
    gl_PointSize = (uPixelRatio * (2.2 + aFase * 3.4 + aVelocidad * 5.5)) / (1.0 + distancia * 0.0035);
  }
`;

const FRAG_MATERIA = /* glsl */ `
  precision highp float;

  uniform vec3 uCaliente;
  uniform vec3 uMedio;
  uniform vec3 uFrio;
  uniform float uOpacidad;

  varying float vAvance;
  varying float vFase;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;

    /* Núcleo duro y halo mínimo. Con un halo generoso, mil puntos juntos
       vuelven a formar manchas: el halo es lo que convierte un campo de
       partículas en nieve. */
    float nucleo = smoothstep(0.62, 0.0, d);
    float halo = smoothstep(1.0, 0.0, d) * 0.16;
    float forma = clamp(nucleo + halo, 0.0, 1.0);
    if (forma < 0.03) discard;

    /* Lo que brilla es el FRENTE. Lo que ya ha salido se apaga y lo que aún
       no ha salido no existe: por eso el estallido tiene un borde en vez de
       ser una nube que crece. */
    float enElFrente = smoothstep(0.0, 0.1, vAvance) * (1.0 - smoothstep(0.55, 1.05, vAvance));

    /* TRES TRAMOS. Todo blanco al principio es lo que hacía que esto se
       leyera como nieve: lo que sale del núcleo es blanco, lo que va por
       delante ya se enfría a cian y la cola se va a violeta. */
    vec3 color = mix(uCaliente, uMedio, clamp(vAvance * 2.6, 0.0, 1.0));
    color = mix(color, uFrio, clamp((vAvance - 0.4) * 1.7, 0.0, 1.0));

    gl_FragColor = vec4(color * forma * (1.15 + vFase * 0.9), forma * enElFrente * uOpacidad);
  }
`;

/* ------------------------------------------------------------------
   Construcción
   ------------------------------------------------------------------ */

/**
 * Radio que tiene la onda antes de empezar a crecer.
 *
 * Está aquí y no repartido por los shaders porque dos cosas tienen que
 * coincidir con él: por dónde viaja la cámara al abrir, que va por dentro de
 * la burbuja, y a partir de qué momento se enciende cada estrella, que se
 * calcula con esta misma cifra. Si se cambiaran por separado, el cielo se
 * encendería antes o después de que la onda llegara.
 */
export const RADIO_INICIAL = 320;

/** PRNG mulberry32: la apertura es siempre la misma. */
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Curva de subida y bajada, no lineal, para el fogonazo. */
const suave = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export function crearBigBang({ nivel, origen, radioMax, paleta }) {
  const conf = perfil(nivel);
  const total = Math.max(900, Math.round(conf.puntosPolvo * 9));
  const random = azar(90210);
  const centro = origen ?? new Vector3();

  /* Colores de la estrella. El rojo del limbo no está en la paleta del
     sitio a propósito: una estrella no es cian, y el naranja-rojo es lo que
     la hace legible como sol contra el espacio. */
  const rojo = new Color('#ff4d16');
  const naranja = new Color('#ff9a2e');

  /* --- Sol ------------------------------------------------------- */
  const geoSol = new IcosahedronGeometry(1, conf.detallePlaneta > 2 ? 3 : 2);
  const matSol = new ShaderMaterial({
    uniforms: {
      uCaliente: { value: new Color('#fff6e0') },
      uMedio: { value: naranja.clone() },
      uFrio: { value: rojo.clone() },
      uTiempo: { value: 0 },
      uBrillo: { value: 0 },
      uDetona: { value: 0 },
    },
    vertexShader: VERT_SOL,
    fragmentShader: FRAG_SOL,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const sol = new Mesh(geoSol, matSol);
  sol.position.copy(centro);
  sol.renderOrder = 8;
  sol.frustumCulled = false;

  /* --- Corona ---------------------------------------------------- */
  const geoCorona = new SphereGeometry(1, 32, 24);
  const matCorona = new ShaderMaterial({
    uniforms: {
      uCaliente: { value: new Color('#ffe9c4') },
      uMedio: { value: naranja.clone() },
      uBrillo: { value: 0 },
    },
    vertexShader: VERT_CORONA,
    fragmentShader: FRAG_CORONA,
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
  });

  const corona = new Mesh(geoCorona, matCorona);
  corona.position.copy(centro);
  corona.renderOrder = 7;
  corona.frustumCulled = false;

  /* --- Onda ------------------------------------------------------ */
  const geoOnda = new SphereGeometry(1, conf.detallePlaneta > 2 ? 48 : 28, conf.detallePlaneta > 2 ? 32 : 20);
  const matOnda = new ShaderMaterial({
    uniforms: {
      uCaliente: { value: new Color('#ffffff') },
      uFrio: { value: paleta.violeta.clone() },
      uExpansion: { value: 0 },
      uBrillo: { value: 0 },
    },
    vertexShader: VERT_ONDA,
    fragmentShader: FRAG_ONDA,
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
  });

  const onda = new Mesh(geoOnda, matOnda);
  onda.position.copy(centro);
  onda.renderOrder = 6;
  onda.frustumCulled = false;

  /* --- Materia --------------------------------------------------- */
  const posiciones = new Float32Array(total * 3);
  const direcciones = new Float32Array(total * 3);
  const fases = new Float32Array(total);
  const velocidades = new Float32Array(total);

  for (let i = 0; i < total; i += 1) {
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);

    posiciones[i * 3] = 0;
    posiciones[i * 3 + 1] = 0;
    posiciones[i * 3 + 2] = 0;

    direcciones[i * 3] = s * Math.cos(theta);
    direcciones[i * 3 + 1] = u;
    direcciones[i * 3 + 2] = s * Math.sin(theta);

    fases[i] = Math.pow(random(), 0.65);
    velocidades[i] = random();
  }

  const geoMateria = new BufferGeometry();
  geoMateria.setAttribute('position', new BufferAttribute(posiciones, 3));
  geoMateria.setAttribute('aDireccion', new BufferAttribute(direcciones, 3));
  geoMateria.setAttribute('aFase', new BufferAttribute(fases, 1));
  geoMateria.setAttribute('aVelocidad', new BufferAttribute(velocidades, 1));
  geoMateria.boundingSphere = null;

  const matMateria = new ShaderMaterial({
    uniforms: {
      uCaliente: { value: new Color('#fff2d8') },
      uMedio: { value: paleta.cian.clone() },
      uFrio: { value: paleta.violeta.clone() },
      uRadio: { value: radioMax },
      uExpansion: { value: 0 },
      uPixelRatio: { value: 1 },
      uOpacidad: { value: 0 },
    },
    vertexShader: VERT_MATERIA,
    fragmentShader: FRAG_MATERIA,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const materia = new Points(geoMateria, matMateria);
  materia.position.copy(centro);
  materia.renderOrder = 5;
  materia.frustumCulled = false;

  return {
    sol,
    corona,
    onda,
    materia,
    /** Se mantiene el nombre viejo: `escena.js` lo usa para las estrellas. */
    escombros: materia,

    /**
     * Un solo número gobierna toda la apertura.
     *
     * @param {number} expansion 0 = la estrella arde. 1 = el espacio entero
     *   está lleno de materia y la onda se ha ido.
     * @param {number} segundos
     * @param {number} dpr
     * @param {number} entrada Visibilidad del cuerpo, por si no se dibuja.
     */
    actualizar(expansion, segundos, dpr, entrada = 1) {
      const e = clamp01(expansion);

      /* --- La estrella -------------------------------------------
         Se acerca y crece mientras arde, se hincha en la detonación y se
         apaga. El radio importa más que el brillo: a 212 unidades de la
         cámara, 120 unidades de radio llenan más de la mitad del encuadre,
         y eso es lo que hace que la portada sea un primer plano de una
         estrella y no una escena con un objeto en medio. */
      const crece = e / ARDE_HASTA;
      /* El radio importa MÁS que el brillo, y es lo que se midió mal la
         primera vez. La cámara abre a 212 unidades del origen: con 78 de
         radio la estrella mide 47° de alto contra 36° de campo, o sea que
         ocupa MÁS que la pantalla y se lee como una roca-brown, no como una
         estrella. A 40-66 unidades mide 21-34°: un disco grande, con el
         espacio alrededor, que es como se lee un sol. */
      const nace = 1 - Math.pow(1 - clamp01(e / NACE_EN), 3); // ease-out cúbico
      const radioBase = RADIO_SINGULARIDAD + nace * (34 - RADIO_SINGULARIDAD) + crece * 24;
      /* La hinchazón de la detonación: +58 % de radio en el centro del
         fogonazo, y de ahí se hunde hasta cero. */
      const detona =
        e <= DETONA_EN ? 0 : Math.sin(Math.min(1, (e - DETONA_EN) / 0.16) * Math.PI);
      const radioSol = (radioBase * (1 + detona * 0.58)) * entrada;

      const apagado = e <= SOL_SE_APAGA
        ? 1
        : Math.max(0, 1 - (e - SOL_SE_APAGA) / 0.14);

      sol.visible = apagado > 0.004 && entrada > 0.01;
      if (sol.visible) {
        sol.scale.setScalar(Math.max(0.01, radioSol));
        matSol.uniforms.uTiempo.value = segundos;
        matSol.uniforms.uDetona.value = detona;
        matSol.uniforms.uBrillo.value = apagado * entrada * (0.82 + crece * 0.3);
      }

      /* --- La corona ----------------------------------------------
         Se apaga un poco antes que la estrella: el halo es lo último que
         desaparece y lo primero que se ve, así que su curva va adelantada
         respecto a la del núcleo. */
      const brilloCorona = Math.max(0, apagado * (0.62 + detona * 1.5) - 0.02);
      corona.visible = brilloCorona > 0.004 && entrada > 0.01;
      if (corona.visible) {
        /* La corona es un 25 % más grande que la estrella y cae despacio. Es
           el detalle que dice "esto está ardiendo" y sin ella el sol es una
           esfera naranja más.

           A 1,4 la corona ocupaba casi toda la pantalla al abrir: el halo se
           comía el titular de la portada y el conjunto se leía como una
           mancha luminosa en vez de como una estrella. */
        // Mientras es singularidad (nace ~ 0) la corona late despacio; al crecer la estrella, el latido se apaga.
        const latido = CORONA_MINIMA * (1 + 0.12 * Math.sin(segundos * 2.4) * (1 - nace));
        corona.scale.setScalar(Math.max(latido, radioSol * (1.25 + detona * 0.4)));
        matCorona.uniforms.uBrillo.value = brilloCorona * entrada;
      }

      /* --- La onda -----------------------------------------------
         Nace pegada a la estrella en el momento de la detonación —no desde
         el principio, que era como aparecía una burbuja antes de que hubiera
         algo que explotar— y crece hasta el radio del campo de estrellas. */
      const desde = Math.max(0, (e - DETONA_EN) / (1 - DETONA_EN));
      const radioOnda = RADIO_INICIAL + desde * radioMax;
      const brilloOnda = desde <= 0
        ? 0
        : Math.min(1, desde * 6) * Math.max(0, 1 - Math.max(0, desde - 0.6) / 0.5);

      onda.visible = brilloOnda > 0.004 && entrada > 0.01;
      if (onda.visible) {
        onda.scale.setScalar(Math.max(0.01, radioOnda * entrada));
        matOnda.uniforms.uExpansion.value = desde;
        matOnda.uniforms.uBrillo.value = brilloOnda * entrada;
      }

      /* --- La materia ---------------------------------------------
         Se apaga con la onda: cuando el espacio ya está lleno de materia, esa
         materia del estallido YA ES el universo. */
      const opacidad = Math.min(1, desde * 7) * Math.max(0, 1 - Math.max(0, desde - 0.5) / 0.48);
      materia.visible = opacidad > 0.004 && entrada > 0.01;
      if (materia.visible) {
        matMateria.uniforms.uExpansion.value = desde;
        matMateria.uniforms.uRadio.value = radioOnda;
        matMateria.uniforms.uPixelRatio.value = dpr;
        matMateria.uniforms.uOpacidad.value = opacidad * entrada;
      }
    },

    liberar() {
      geoSol.dispose();
      matSol.dispose();
      geoCorona.dispose();
      matCorona.dispose();
      geoOnda.dispose();
      matOnda.dispose();
      geoMateria.dispose();
      matMateria.dispose();
    },
  };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
