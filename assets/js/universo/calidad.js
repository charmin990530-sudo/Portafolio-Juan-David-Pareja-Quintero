/**
 * universo/calidad.js — Detección de capacidad y calidad adaptativa.
 *
 * Principio de diseño (tomado de la referencia 5 de ESTUDIO.md): cuando el
 * hardware no da para mantener un efecto, baja la PRECISIÓN del cálculo, nunca
 * la IDENTIDAD visual. Un móvil de gama baja y una workstation tienen que ver
 * el mismo sitio, no dos versiones del mismo sitio.
 *
 * Por eso aquí no existe una rama "móvil simplificado": existen tres perfiles
 * del mismo sistema, y todos comparten paleta, guion y estructura. Lo único que
 * cambia es cuántos triángulos, cuántos puntos y cuántas capas de atmósfera.
 */

import { clamp } from '../core/util.js';

/* ------------------------------------------------------------------
   Niveles
   ------------------------------------------------------------------ */

export const NIVELES = { ALTO: 'alto', MEDIO: 'medio', BAJO: 'bajo' };

/** Perfiles. Estos números son el presupuesto; ver ESTUDIO.md §6.2. */
const PERFILES = {
  [NIVELES.ALTO]: {
    resolucionPlaneta: 32, // SOLO planeta y su atmósfera: silueta lisa (~22 000 triángulos)
    detallePlaneta: 4, // icosaedro: 500 triángulos (20 × (d+1)²)
    puntosEstrella: 4200,
    puntosPolvo: 900,
    rocasCampo: 320,
    atmosfera: 2, // fresnel + dispersión Rayleigh
    anillos: 2, // dos capas con sombra propia
    nubes: true,
    lucesCiudad: true,
    estelas: true, // estrellas que se alargan con la velocidad
    resplandor: true, // sprites aditivos en lugar de un bloom pass
    granoCss: true,
    dpr: 1.75,
    objetivoFps: 55,
  },
  [NIVELES.MEDIO]: {
    resolucionPlaneta: 20, // SOLO planeta y su atmósfera: silueta lisa (~8 800 triángulos)
    detallePlaneta: 3, // icosaedro: 320 triángulos (20 × (d+1)²)
    puntosEstrella: 2800,
    puntosPolvo: 500,
    rocasCampo: 180,
    atmosfera: 1, // solo fresnel
    anillos: 1,
    nubes: true,
    lucesCiudad: true,
    estelas: true,
    resplandor: true,
    granoCss: true,
    dpr: 1.5,
    objetivoFps: 50,
  },
  [NIVELES.BAJO]: {
    resolucionPlaneta: 10, // SOLO planeta y su atmósfera: silueta lisa (~2 400 triángulos)
    detallePlaneta: 2, // icosaedro: 180 triángulos (20 × (d+1)²)
    puntosEstrella: 1800,
    puntosPolvo: 240,
    rocasCampo: 90,
    atmosfera: 0, // sin shell: el planeta se tiñe en su propio shader
    anillos: 1,
    nubes: false,
    lucesCiudad: false,
    estelas: false,
    resplandor: false,
    granoCss: false,
    dpr: 1.25,
    objetivoFps: 30,
  },
};

/** Perfil de un nivel, con la certeza de no devolver undefined. */
export function perfil(nivel) {
  return PERFILES[nivel] ?? PERFILES[NIVELES.BAJO];
}

/** ¿El nivel admite esta capacidad? Para no hacer trabajo que no se vea. */
export function admite(nivel, capacidad) {
  return perfil(nivel)[capacidad] === true;
}

/* ------------------------------------------------------------------
   Detección de WebGL
   ------------------------------------------------------------------ */

/**
 * Crea un contexto WebGL de prueba, lee la GPU y lo destruye.
 * Devuelve null si el navegador no puede con WebGL.
 *
 * `failIfMajorPerformanceCaveat` se deja en false a propósito: en equipos con
 * GPU integrada el navegador suele reportar un "caveat" y el flag desactivaría
 * el contexto en pantallas perfectamente capaces. La decisión de nivel la toma
 * el análisis de abajo, no este flag.
 */
export function probarWebGL() {
  try {
    const lienzo = document.createElement('canvas');
    const gl = lienzo.getContext('webgl2') || lienzo.getContext('webgl');
    if (!gl) return null;

    let gpu = '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');

    // Sin esto, iOS Safari acumula contextos hasta expulsar las pestañas.
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    return { version: gl instanceof WebGL2RenderingContext ? 2 : 1, gpu };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------
   Lectura de la GPU
   ------------------------------------------------------------------ */

// La GPU pesa MÁS que la CPU/RAM a propósito. En un fragmento de pantalla
// completo lo que manda es el relleno de píxeles en la GPU, y un procesador de 16 núcleos
// con gráficos integrados no renderiza una escena pesada por el hecho de
// tener núcleos de sobra.

const GPU_FUERTE = /apple\s*m[1-9]|rtx|radeon\s*(rx\s*[5-9]\d{2}|pro\s*[5-9]\d{2}|\d{4}m?\s*(xtx|x\b))/i;
const GPU_MEDIA = /intel.*(iris|uhd\s*graphics|arc\s*[gm]\d\d|hd graphics\s*[5-9]\d{2})|adreno\s*[5-8]\d\d|mali-?g?[6-9]\d\d|apple\s*a1[4-9]|powervr\s*(sgx|rogue)/i;
const GPU_DEBIL = /swiftshader|llvmpipe|software|mesa\s*off|generic\s*renderer/i;

function puntosGPU(gpu) {
  if (!gpu) return 1; // navegador que oculta la GPU: se asume intermedia
  if (GPU_DEBIL.test(gpu)) return -6; // render por software: forzar el nivel más bajo
  if (GPU_FUERTE.test(gpu)) return 4;
  if (GPU_MEDIA.test(gpu)) return 1;
  return 1;
}

/* ------------------------------------------------------------------
   Puntuación
   ------------------------------------------------------------------ */

/**
 * Devuelve el nivel recomendado. Puntuación por señales: más robusta
 * que una cadena de `if`, porque un teléfono con 8 núcleos y GPU
 * débil no debe penalizarse dos veces.
 */
export function detectarNivel({ gpu = '' } = {}) {
  const nucleos = navigator.hardwareConcurrency ?? 4;
  const memoria = navigator.deviceMemory ?? 4;
  const tactil = matchMedia('(pointer: coarse)').matches;
  const ancho = window.innerWidth;
  const pocoAncho = ancho < 820;
  const pocoDatos = navigator.connection?.saveData === true;

  let puntos = 0;
  puntos += puntosGPU(gpu);

  puntos += nucleos >= 8 ? 2 : nucleos >= 6 ? 1 : nucleos >= 4 ? 0 : -1;
  puntos += memoria >= 8 ? 2 : memoria >= 4 ? 1 : 0;

  if (tactil) puntos -= 1;
  if (pocoAncho) puntos -= 1;
  // `saveData` pesa más que la móvil: quien lo activa está en una conexión
  // medida y ha pedido menos consumo. No lo degradamos a BAJO —el sitio
  // tiene que seguir viéndose bien— pero sí le quitamos el nivel más pesado.
  if (pocoDatos) puntos -= 3;

  if (puntos >= 6) return NIVELES.ALTO;
  if (puntos >= 1) return NIVELES.MEDIO;
  return NIVELES.BAJO;
}

/* ------------------------------------------------------------------
   Sonda de framerate en vivo
   ------------------------------------------------------------------ */

/**
 * Mide el framerate real durante los primeros fotogramas y avisa si hay
 * que bajar de nivel.
 *
 * Reglas de diseño:
 *   - Solo degrada, nunca sube. Un salto de nivel a media escena produce
 *     un tirón visible que es peor que unos fps bajos.
 *   - Un máximo de una degradación por sesión. Si tras bajar tampoco se
 *     alcanza el objetivo, significa que la máquina no puede con el sitio
 *     y lo correcto es el fallback, no seguir insistiendo.
 *   - No decide con los 2 primeros fotogramas: el arranque de Three.js
 *     tarda y daría un falso negativo.
 */
export function crearSonda({ nivel, objetivo, fotogramas = 90, puedeDegradar = true, alDegradar, alTerminar }) {
  let acumulado = 0;
  let cuenta = 0;
  let anterior = 0;
  let vigente = nivel;
  let degradaciones = 0;
  let terminado = false;

  return function medir(delta) {
    if (terminado) return true;

    // Los 12 primeros fotogramas son de calentamiento (compilación de
    // shaders, subida de buffers) y no cuentan.
    if (anterior === 0) {
      anterior = performance.now();
      return false;
    }
    if (cuenta < 12) {
      cuenta += 1;
      anterior = performance.now();
      return false;
    }

    const ahora = performance.now();
    acumulado += ahora - anterior;
    anterior = ahora;
    cuenta += 1;

    if (cuenta < fotogramas) return false;

    terminado = true;
    const medio = 1000 / (acumulado / (cuenta - 12));
    alTerminar?.({ nivel: vigente, fps: medio });

    /* ── POR QUÉ EXISTE `puedeDegradar` ────────────────────────────────

       La sonda MIDRE siempre, porque el HUD muestra los fps y eso hace
       falta en cualquier nivel. Lo que hace solo cuando puede es BAJAR.

       No baja si el visitante eligió el nivel a mano. Elegir "Alta" en la
       cabecera es una orden, no una sugerencia: el sitio hasta se marca
       `data-calidad-elegida="1"` para acordarse de que la decisión fue
       suya. Si después la sonda lo baja sola, el selector no sirve para
       nada: es un control que no controla. Y es exactamente el fallo que
       ESTUDIO.md §3 describe como el motivo de que el selector exista —
       "un sistema que degrada solo, sin que el visitante pueda exigirle
       nada, es un sistema que se equivoca solo"—, pero aplicado al revés:
       aquí el sistema degradaba con o sin permiso.

       Medido en esta máquina, con la sonda degradando sola: se elegía "Alta"
       y el sitio se quedaba en "Media"; se elegía "Media" y se quedaba en
       "Baja". Dos de los tres niveles del selector no hacían lo que
       decían. */
    if (!puedeDegradar) return true;

    if (medio < objetivo && degradaciones === 0) {
      degradaciones += 1;
      vigente = siguiente(vigente);
      if (vigente) alDegradar?.(vigente, medio);
    }

    return true;
  };
}

function siguiente(nivel) {
  if (nivel === NIVELES.ALTO) return NIVELES.MEDIO;
  if (nivel === NIVELES.MEDIO) return NIVELES.BAJO;
  return null;
}

/* ------------------------------------------------------------------
   Présence de la interfaz
   ------------------------------------------------------------------ */

/**
 * Cuánto muestra la interfaz del universo: cuánto del HUD se dibuja y
 * cuántos indicadores hay. Es la capa de contenido, no la de render, así
 * que va aparte: en gama baja se puede recortar la interfaz sin tocar
 * el presupuesto de la escena.
 */
export function densidadUI(nivel) {
  if (nivel === NIVELES.ALTO) return { puntos: true, coordenadas: true, minimapa: true };
  if (nivel === NIVELES.MEDIO) return { puntos: true, coordenadas: true, minimapa: false };
  return { puntos: false, coordenadas: false, minimapa: false };
}

/** DPR final, acotado por el perfil y por el límite duro del dispositivo. */
export function dprEfectivo(nivel) {
  const tope = perfil(nivel).dpr;
  return clamp(window.devicePixelRatio || 1, 1, tope);
}
