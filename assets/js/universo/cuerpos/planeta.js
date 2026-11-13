/**
 * universo/cuerpos/planeta.js — Superficie planetaria procedural.
 *
 * UN SOLO SHADER PARA TODOS LOS CUERPOS. No hay "shader de planeta rocoso" y
 * "shader de gigante gaseoso": hay un shader con parámetros, y cada cuerpo es
 * un juego de valores distinto. Tres razones:
 *
 *   1. Un solo programa compilado. Con cinco cuerpos, cinco materiales con el
 *      mismo código fuente comparten programa en Three.js: se compila una vez
 *      y solo cambian los uniformes.
 *   2. La paleta es continua. Si el gigante y la roca usaran shaders
 *      distintos, no se parecían en nada. Con el mismo, el familiaje es
 *      estructural y no solo de color.
 *   3. Se puede pasar de un tipo a otro con un ajuste, sin reescribir.
 *
 * Cómo se describen los cuerpos:
 *   - `bandas` activo + rugosidad alta → gigante gaseoso con franjas.
 *   - rugosidad baja → planeta rocoso.
 *   - rugosidad media con `nivelMar` alto → mundo oceánico.
 *
 * Todo el detalle sale de ruido. No hay ni una textura en el proyecto.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  TextureLoader,
  SRGBColorSpace,
  RepeatWrapping,
} from '../../../vendor/three/0.186.1/three.module.js';
import { RUIDO, LUZ } from '../shaders/comunes.js';
import { perfil } from '../calidad.js';

/* ------------------------------------------------------------------
   Geometría compartida
   ------------------------------------------------------------------ */

/**
 * Una geometría por nivel de detalle, reutilizada por todos los cuerpos.
 *
 * Cacheada por módulo: los cuerpos del sistema comparten una geometría por
 * nivel en vez de una por cuerpo. Crear un `IcosahedronGeometry` de detalle 4
 * (2 562 triángulos) cuesta poco, pero hacerlo cinco veces genera basura que
 * el recolector tiene que procesar, y con el giro por fotograma el coste se
 * acumula en la primera carga, que es cuando menos puede sobrar.
 */
const cacheGeometria = new Map();

export function geometriaPlaneta(detalle) {
  if (!cacheGeometria.has(detalle)) {
    cacheGeometria.set(detalle, new IcosahedronGeometry(1, detalle));
  }
  return cacheGeometria.get(detalle);
}

/** Se llama una sola vez, al desmontar el universo entero. */
export function liberarGeometrias() {
  for (const geo of cacheGeometria.values()) geo.dispose();
  cacheGeometria.clear();
}

/* ------------------------------------------------------------------
   Shaders
   ------------------------------------------------------------------ */

const VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vMundo;

  void main() {
    vLocal = position;
    // Luz, vista y normales en espacio de mundo (escalas uniformes).
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vMundo = mundo.xyz;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

const NUBES = /* glsl */ `
  precision highp float;
  uniform sampler2D uMapaNubes;
  uniform float uNubeLista;
  uniform float uEntradaNube;
  uniform vec3 uLuzNube;
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vMundo;
  void main() {
    if (uNubeLista < 0.5) discard;
    vec3 p = normalize(vLocal);
    vec2 uv = vec2(fract(atan(p.z, -p.x) / 6.2831853),
                   1.0 - acos(clamp(p.y, -1.0, 1.0)) / 3.14159265);
    float densidad = texture2D(uMapaNubes, uv).r;
    float dia = max(dot(normalize(vNormal), normalize(uLuzNube)), 0.0);
    float alfa = smoothstep(0.16, 0.85, densidad) * 0.88 * uEntradaNube;
    if (alfa < 0.005) discard;
    gl_FragColor = vec4(vec3(0.014 + dia * 1.08), alfa);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uOceano;
  uniform vec3 uTierra;
  uniform vec3 uHielo;
  uniform vec3 uAcento;
  uniform vec3 uColorLuz;
  uniform vec3 uLuz;

  uniform float uTiempo;
  uniform float uRugosidad;
  uniform float uNivelMar;
  uniform float uBandas;
  uniform float uLucesCiudad;
  uniform float uNubes;
  uniform float uSemilla;
  uniform float uDeriva;
  uniform float uEntrada;
  uniform float uFormacion;
  uniform sampler2D uMapaDia;
  uniform sampler2D uMapaNoche;
  uniform float uTieneMapa;
  uniform float uTieneNoche;

  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vMundo;

  ${RUIDO}
  ${LUZ}

  /* Rampa de tres tramos sobre el valor de altura: agua, tierra y hielo.
     El umbral de agua es un uniforme, asi que un mundo seco y uno oceanico
     salen del mismo codigo. */
  vec3 rampaClave(float v) {
    vec3 c = mix(uOceano, uTierra, smoothstep(uNivelMar, uNivelMar + 0.16, v));
    return mix(c, uHielo, smoothstep(0.68, 0.9, v));
  }

  void main() {
    vec3 p = normalize(vLocal);
    // Camino fotografico: mapas equirectangulares en espacio local.
    // Sin ruido encima de los continentes ni luces inventadas.
    if (uTieneMapa > 0.5) {
      vec2 uv = vec2(fract(atan(p.z, -p.x) / 6.2831853),
                     1.0 - acos(clamp(p.y, -1.0, 1.0)) / 3.14159265);
      vec3 albedo = texture2D(uMapaDia, uv).rgb;
      vec3 n = normalize(vNormal);
      vec3 v = normalize(cameraPosition - vMundo);
      vec3 l = normalize(uLuz);
      float ndl = dot(n, l);
      float dia = max(ndl, 0.0);
      vec3 resultado = albedo * (dia * 1.12 + 0.012);
      // Reflejo solar del oceano, no brillo de plastico sobre toda la esfera.
      if (uNivelMar > 0.15) {
        float agua = smoothstep(0.015, 0.12, albedo.b - max(albedo.r, albedo.g));
        float especular = pow(max(dot(n, normalize(l + v)), 0.0), 110.0);
        resultado += vec3(0.9, 0.95, 1.0) * agua * especular * dia * 0.42;
      }
      if (uTieneNoche > 0.5) {
        vec3 ciudades = texture2D(uMapaNoche, uv).rgb;
        resultado += ciudades * (1.0 - smoothstep(-0.12, 0.12, ndl)) * 0.65;
      }
      float limbo = pow(1.0 - abs(dot(n, v)), 5.0);
      resultado += uAcento * limbo * smoothstep(-0.1, 0.5, ndl) * 0.06;
      float formado = clamp(uFormacion, 0.0, 1.0);
      vec3 lava = vec3(1.0, 0.24, 0.035) * (0.2 + albedo.r);
      resultado = mix(lava, resultado, smoothstep(0.25, 1.0, formado));
      gl_FragColor = vec4(resultado * uEntrada, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      return;
    }

    /* Formacion: lo que hace que este cuerpo venga de la explosion.

       Al principio el cuerpo es una nube caliente y brillante, sin tierra ni
       estructura: el ruido esta revuelto y la superficie es un rescoldo
       uniforme. A medida que el uniforme de formacion sube, el ruido se
       ordena, los continentes emergen y el planeta se enfria hasta
       parecerse a un planeta.

       Sin esto el primer cuerpo aparecia ya terminado en el fotograma
       siguiente al arranque, y la apertura contaba que hubo un universo sin
       que nada de el llegara a formarse. */
    float formacion = clamp(uFormacion, 0.0, 1.0);

    // La semilla desplaza el campo de ruido: cada cuerpo tiene continentes
    // propios aunque comparta la misma funcion.
    vec3 q = p * (1.6 + uRugosidad * 2.2) + uSemilla;

    // Dos derivas distintas: una para el relieve, otra para las nubes.
    // Si compartieran velocidad, la nube pareceria clavada a la montana.
    vec3 derivaRelieve = vec3(uTiempo * 0.014, 0.0, uDeriva * 0.02);
    vec3 derivaNubes = vec3(uTiempo * 0.028 + 11.0, 0.0, 0.0);

int octavas = uBandas > 0.5 ? 5 : 4;

/* Bandas de gas: el gigante no tiene continentes, tiene franjas
   horizontales. Se deforma el dominio con ruido para que las franjas
   ondulen en lugar de ser anillos rectos. */
if (uBandas > 0.5) {
  q += vec3(0.0, p.y * 3.4 + fbm(p * 2.4 + uSemilla, 4) * 1.3, 0.0);
}

/* Detalle fino de las bandas: ruido de alta frecuencia que rompe la
   uniformidad de las franjas, dándoles textura "granulada" vista desde
   lejos. Una octava extra por encima de las principales. */
float detalleBandas = uBandas > 0.5 ? fbm(p * 8.0 + uSemilla * 0.7, 2) * 0.2 : 0.0;

/* altura base con el detalle de bandas incorporado */
float altura = fbm(q + derivaRelieve, octavas) + detalleBandas;
// fbm ya devuelve valores positivos: centrar de nuevo eliminaba los oceanos.
altura = clamp(altura * 1.55 - 0.18, 0.0, 1.0);
altura = pow(altura, 1.0 + uRugosidad * 0.7);

    /* Mientras se forma, el relieve esta revuelto: la superficie es un
       rescoldo sin continentes que definir. El ruido se aplana hacia el punto
       medio y los continentes solo van apareciendo conforme sube la
       formacion, que es lo que se ve en una proto-planeta. */
    altura = mix(0.5, altura, 0.15 + formacion * 0.85);

    vec3 normal = normalize(vNormal);
    vec3 vision = normalize(cameraPosition - vMundo);
    vec3 luz = normalize(uLuz);

    vec3 base = rampaClave(altura);
    // Costas suaves y casquetes por latitud, no nieve aleatoria en el ecuador.
    if (uBandas < 0.5 && uNivelMar > 0.15) {
      float costa = smoothstep(uNivelMar - 0.035, uNivelMar, altura)
                  * (1.0 - smoothstep(uNivelMar, uNivelMar + 0.035, altura));
      base = mix(base, uTierra * vec3(1.24, 1.12, 0.83), costa * 0.28);
      float polo = smoothstep(0.78, 0.96, abs(p.y) + (altura - 0.5) * 0.1);
      base = mix(base, uHielo, polo * formacion);
    }

    if (uBandas > 0.5) {
      float franja = sin(p.y * 9.0 + fbm(q * 1.4, 3) * 3.2) * 0.5 + 0.5;
      base = mix(base, mix(uTierra, uAcento, franja), 0.62);
    }

    if (uNubes > 0.5) {
      float nube = fbm(p * 5.1 + derivaNubes + uSemilla, 4);
      float cobertura = smoothstep(0.43, 0.65, nube);
      base = mix(base * (1.0 - cobertura * 0.10), uHielo, cobertura * 0.85);
    }

/* Iluminacion.
   difusion va de 0 a 1 y ahora tiene un terminador de verdad: cae a 0
   un poco despues de que la normal se pone perpendicular a la luz. Por
   eso el umbral de las luces de ciudad esta en 0.30 y no en 0.52: antes
   media a la mitad del planeta, asi que las ciudades se encendian en
   pleno lado de dia y se veian brillando a traves del planeta.

   El umbral va justo por delante del terminador: la primera ciudad que
   se enciende es la del crepusculo, no la de la noche cerrada. */
    float d = difusion(normal, luz);
    // Borde Fresnel suave: el luz se concentra un poco en el borde del
    // disco iluminado, como efecto de atenuacion atmosferica real.
    float bordeLuz = pow(1.0 - clamp(dot(normal, luz), 0.0, 1.0), 1.2);
    float curva = pow(d, 0.72) * (0.9 + bordeLuz * 0.2);

    /* La ambiente es lo unico que se ve del lado noche. Baja de 0.055 a
       0.035: con 0.055 el lado oscuro conservaba casi todo el color de la
       textura y se leia como una superficie gris plana en vez de noche. */
    vec3 ambiente = uColorLuz * 0.035;
    vec3 color = base * uColorLuz * curva * 1.15 + ambiente * base;

    /* Luces de ciudad: en la cara nocturna, sobre tierra firme, y con el
       resplandor repartido en manchas por un umbral alto sobre ruido de alta
       frecuencia. El smoothstep va al reves para que brillen MAS cuanto mas
       oscuro esta el punto, y no solo "cuando hay sombra". */
    if (uLucesCiudad > 0.5 && d < 0.30) {
      float tierra = step(uNivelMar + 0.04, altura);
      float manchas = fbm(p * 22.0 + uSemilla * 3.0, 3) * 0.5 + 0.5;
      float ciudad = smoothstep(0.63, 0.79, manchas) * tierra;
      /* Se apagan del todo en el crepúsculo para que no haya un corte
         visible en la frontera: de 0.30 (encendidas) a 0.05 (apagadas). */
      color += uAcento * ciudad * (1.0 - smoothstep(0.05, 0.30, d)) * 1.5;
    }

    /* Brillo del agua: solo bajo el nivel del mar y solo con la luz de
       frente. Es lo que distingue un mundo oceánico de uno rocoso sin
       una sola textura. */
    if (uNivelMar > 0.15) {
      vec3 medio = normalize(luz + vision);
      float brillo = pow(max(dot(normal, medio), 0.0), 42.0);
      float agua = 1.0 - smoothstep(uNivelMar - 0.02, uNivelMar + 0.03, altura);
      color += vec3(0.85, 0.94, 1.0) * brillo * agua * 0.5;
    }

    /* Realce del limbo: no es una atmósfera, es el mismo planeta visto de
       canto, donde el borde se vuelve brillante por dispersión. Barato, y
       da el aspecto de esfera sin necesitar una segunda malla. */
    color += uAcento * pow(fresnel(normal, vision, 3.2), 2.4) * 0.30;

    /* Scorched: a body that has just formed is red hot inside and its surface is
       molten rock. The sea, the ice and the atmosphere only show up once it
       cools. This is the turning point of the whole opening: here the
       universe stops being light and becomes matter. */
    vec3 rescoldo = vec3(1.0, 0.46, 0.16);
    color += rescoldo * (1.0 - formacion) * (0.35 + base.r * 0.5) * 1.6;

    color *= uEntrada * (0.25 + formacion * 0.75);

    gl_FragColor = vec4(color, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------
   Textura de resplandor
   ------------------------------------------------------------------ */

/**
 * Degradado radial en canvas de 64×64 para los *sprites* de brillo.
 *
 * Es el sustituto del resplandor por pós-procesado (ESTUDIO.md §6.4): un pase
 * de bloom cuesta varias operaciones a pantalla completa y mipmaps de
 * luminancia; un sprite aditivo cuesta una mezcla. Con tres o cuatro por
 * cuerpo se consigue el mismo aspecto por una fracción del coste, y a
 * diferencia del bloom se puede apagar en gama baja sin que se note.
 */
let cacheBrillo = null;

function texturaBrillo() {
  if (cacheBrillo) return cacheBrillo;
  const lado = 64;
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, lado, lado);
  cacheBrillo = new CanvasTexture(lienzo);
  return cacheBrillo;
}

export function liberarTexturas() {
  cacheBrillo?.dispose();
  cacheBrillo = null;
}

/* ------------------------------------------------------------------
   Construcción
   ------------------------------------------------------------------ */

const direccionLuz = new Vector3(0.6, 0.42, 0.7).normalize();

/** Se exporta para que la atmósfera y los anillos compartan el mismo sol. */
export { direccionLuz };

/**
 * @param {object} o
 * @param {'alto'|'medio'|'bajo'} o.nivel
 * @param {object} o.def Definición del cuerpo, de `data/universo.js`:
 *   `radio`, `x/y/z`, `colorOceano`, `colorTierra`, `colorHielo`,
 *   `colorAcento`, `colorLuz`, `rugosidad`, `nivelMar`, `bandas`,
 *   `lucesCiudad`, `nubes`, `semilla`, `deriva`, `rotacion`,
 *   `inclinacion`, `halo`.
 * @param {number} o.semillaBase Desplaza la semilla para que dos cuerpos con
 *   la misma configuración no salgan idénticos.
 */
export function crearPlaneta({ nivel, def, semillaBase = 0 }) {
  const conf = perfil(nivel);
  const grupo = new Group();
  grupo.position.set(def.x ?? 0, def.y ?? 0, def.z ?? 0);

  const colorAcento = new Color(def.colorAcento);

  const material = new ShaderMaterial({
    uniforms: {
      uOceano: { value: new Color(def.colorOceano) },
      uTierra: { value: new Color(def.colorTierra) },
      uHielo: { value: new Color(def.colorHielo) },
      uAcento: { value: colorAcento.clone() },
      uColorLuz: { value: new Color(def.colorLuz ?? '#fffdf0') },
      uLuz: { value: direccionLuz.clone() },
      uTiempo: { value: 0 },
      uRugosidad: { value: def.rugosidad ?? 0.5 },
      uNivelMar: { value: def.nivelMar ?? 0 },
      uBandas: { value: def.bandas ? 1 : 0 },
      uLucesCiudad: { value: conf.lucesCiudad && def.lucesCiudad ? 1 : 0 },
      uNubes: { value: conf.nubes && def.nubes !== false ? 1 : 0 },
      uSemilla: { value: (def.semilla ?? 1) + semillaBase },
      uDeriva: { value: def.deriva ?? 0 },
      uEntrada: { value: 0 },
      uFormacion: { value: 1 },
      uMapaDia: { value: null },
      uMapaNoche: { value: null },
      uTieneMapa: { value: 0 },
      uTieneNoche: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });

  let destruido = false;
  const mapas = [];
  const tamano = nivel === 'alto' ? '2k' : '1k';
  const cargador = new TextureLoader();
  function cargar(nombre, alCargar, color = true) {
    const textura = cargador.load(`assets/img/texturas/${nombre}-${tamano}.jpg`, (t) => {
      if (destruido) { t.dispose(); return; }
      alCargar(t);
    }, undefined, () => {
      if (!destruido) console.warn('[universo] textura no disponible:', nombre);
    });
    textura.wrapS = RepeatWrapping;
    if (color) textura.colorSpace = SRGBColorSpace;
    textura.anisotropy = nivel === 'alto' ? 4 : 1;
    mapas.push(textura);
  }
  if (def.mapaDia) cargar(def.mapaDia, (t) => {
    material.uniforms.uMapaDia.value = t;
    material.uniforms.uTieneMapa.value = 1;
  });
  if (def.mapaNoche && conf.lucesCiudad) cargar(def.mapaNoche, (t) => {
    material.uniforms.uMapaNoche.value = t;
    material.uniforms.uTieneNoche.value = 1;
  });

  let nubes = null;
  if (def.mapaNubes && conf.nubes) {
    const materialNubes = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: NUBES,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMapaNubes: { value: null },
        uNubeLista: { value: 0 },
        uEntradaNube: { value: 0 },
        uLuzNube: { value: direccionLuz.clone() },
      },
    });
    nubes = new Mesh(geometriaPlaneta(conf.resolucionPlaneta ?? conf.detallePlaneta), materialNubes);
    nubes.renderOrder = 1;
    grupo.add(nubes);
    cargar(def.mapaNubes, (t) => {
      materialNubes.uniforms.uMapaNubes.value = t;
      materialNubes.uniforms.uNubeLista.value = 1;
    }, false);
  }
  const malla = new Mesh(geometriaPlaneta(conf.resolucionPlaneta ?? conf.detallePlaneta), material);
  malla.scale.setScalar(def.radio);
  grupo.add(malla);

  /* Radio ya formado. Mientras `formacion` baja de 1 el planeta crece desde
     un rescoldo: no aparece de golpe, se ACRECENTA. La malla lleva su propia
     escala y no se toca `grupo`, porque `grupo` es contra lo que se mide la
     prueba de visibilidad. */
  const radioFinal = def.radio;

  /* Halo atmosférico: un sprite aditivo que se orienta a cámara.
     `depthTest: false` para que no lo recorte el propio planeta: el halo
     tiene que verse por delante del limbo, que es donde se nota. */
  let halo = null;
  if (conf.resplandor && def.halo !== false) {
    halo = new Sprite(
      new SpriteMaterial({
        map: texturaBrillo(),
        color: colorAcento.clone(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    );
    halo.scale.setScalar(def.radio * (def.escalaHalo ?? 4.6));
    halo.renderOrder = 5;
    grupo.add(halo);
  }

  return {
    grupo,
    malla,
    material,

    /**
     * @param {number} segundos  Reloj del universo.
     * @param {number} entrada    0 = demasiado lejos para verse, 1 = cuadro completo.
     * @param {object} camara     Para orientar el halo a cámara.
     * @param {number} formacion  0 = rescoldo sin estructura, 1 = planeta
     *   terminado. Solo lo usa el cuerpo que nace del arranque.
     */
    actualizar(segundos, entrada, camara, formacion = 1) {
      material.uniforms.uTiempo.value = segundos;
      material.uniforms.uEntrada.value = entrada;
      material.uniforms.uFormacion.value = formacion;

      /* Crece al condensarse. Es la misma medida que la del shader, pero en la
         escala: así el cuerpo se ve nacer pequeño y crecer, no solo cambiar
         de color. */
      const escala = radioFinal * (0.28 + 0.72 * formacion);
      malla.scale.setScalar(escala);
      if (halo) halo.scale.setScalar(escala * (def.escalaHalo ?? 4.6));

      if (def.rotacion) {
        malla.rotation.y = segundos * def.rotacion;
        malla.rotation.x = Math.sin(segundos * def.rotacion * 0.21) * (def.inclinacion ?? 0.12);
      }

      if (nubes) {
        nubes.scale.setScalar(escala * 1.012);
        nubes.rotation.copy(malla.rotation);
        nubes.rotation.y += segundos * 0.002;
        nubes.material.uniforms.uEntradaNube.value = entrada * formacion;
      }
      if (halo) {
        if (camara) halo.quaternion.copy(camara.quaternion);
        // A distancia, un halo del tamaño del planeta se lee como una mancha
        // fija pegada al cuerpo. Se estrecha al alejarse.
        halo.material.opacity = 0.14 * entrada * formacion;
        halo.scale.setScalar(escala * (def.escalaHalo ?? 4.6) * (0.35 + 0.65 * entrada));
      }
    },


    liberar() {
      // La geometría es compartida: NO se destruye aquí. La destruye
      // `liberarGeometrias()` una sola vez al desmontar todo el universo.
      destruido = true;
      for (const textura of mapas) textura.dispose();
      nubes?.material.dispose();
      material.dispose();
      halo?.material.dispose();
    },
  };
}
