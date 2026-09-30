/**
 * universo/index.js — PUERTA DE ENTRADA DEL UNIVERSO.
 *
 * Este es el único módulo del universo que conoce al sitio. Todo lo demás
 * (escena, cámara, ruta, cuerpos) es independiente del documento, y por eso
 * se puede apagar entero sin que el resto se entere.
 *
 * CUATRO SALIDAS POSIBLES, en este orden de preferencia:
 *
 *   1. `sin-webgl`   No hay contexto WebGL, o es render por software.
 *                    No se intenta. El sitio queda con la malla CSS y el
 *                    canvas 2D de `modules/fondo.js`.
 *   2. `movimiento`  `prefers-reduced-motion: reduce`. Tampoco se intenta:
 *                    no tiene sentido respectar la preferencia y montar un
 *                    motor de 3D detrás.
 *   3. `simple`      El visitante pidió la vista simple con el botón, o ya
 *                    la había elegido en una visita anterior.
 *   4. `completo`    El universo.
 *
 * En los tres primeros casos `montarUniverso()` resuelve igual, sin lanzar
 * errores, y quien lo llama no tiene que comprobar nada. Es lo que permite
 * que `main.js` lo monte dentro de su `seguro()` y no se preocupe.
 *
 * POR QUÉ EL MÓDULO ES PESADO Y SE CARGA TARDE
 * Three.js son 417 KB gzip. Importarlo en el `main.js` bloquearía el LCP,
 * que es el titular de la portada. Se importa con `import()` dinámico
 * DESPUÉS de que el preloader haya terminado: para entonces el `<h1>` ya
 * está pintado con las dos fuentes preloaded y el visitante ya ve el
 * sitio. El universo aparece después, y aparece encima.
 */

import { movimientoReducido, almacen, esperar } from '../core/util.js';
import { SISTEMAS } from '../data/universo.js';

const CLAVE_SIMPLE = 'odisea:simple';
const CLAVE_SONIDO = 'odisea:sonido';

export const ESTADOS = {
  COMPLETO: 'completo',
  SIN_WEBGL: 'sin-webgl',
  MOVIMIENTO: 'movimiento',
  SIMPLE: 'simple',
};

/* ------------------------------------------------------------------
   Comprobaciones previas
   ------------------------------------------------------------------ */

function tieneWebGL() {
  try {
    const lienzo = document.createElement('canvas');
    const gl = lienzo.getContext('webgl2') || lienzo.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * ¿Merece la pena montar el universo en este dispositivo?
 *
 * Además de la compatibilidad, se mira si el visitante pidió ahorro de
 * datos o va con conexión de dos barras. En ese caso el sitio se entrega
 * limpio: el contenido es lo mismo, pero sin la escena.
 */
function contextoAceptable() {
  const conexion = navigator.connection;
  if (conexion?.saveData === true) return { ok: false, motivo: 'datos' };
  if (conexion?.effectiveType && ['slow-2g', '2g'].includes(conexion.effectiveType)) {
    return { ok: false, motivo: 'conexion' };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------
   Montaje
   ------------------------------------------------------------------ */

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.lienzo   Lienzo del universo, ya en el HTML.
 * @param {boolean} [o.forzar]            Ignora la vista simple guardada.
 * @returns {Promise<object>} Siempre resuelve. El objeto tiene `estado` y,
 *   si el universo está activo, `escena`, `hud`, `audio` y `desmontar()`.
 */
export async function montarUniverso({ lienzo, forzar = false } = {}) {
  /* --- Decisiones que no requieren Three.js ------------------------- */
  if (!lienzo) return { estado: ESTADOS.SIN_WEBGL, motivo: 'sin-lienzo' };

  const yaSimple = !forzar && almacen.get(CLAVE_SIMPLE, false) === true;
  if (yaSimple) {
    await aplicarVistaSimple();
    return { estado: ESTADOS.SIMPLE, motivo: 'preferido' };
  }

  if (movimientoReducido()) {
    await aplicarVistaSimple();
    return { estado: ESTADOS.MOVIMIENTO, motivo: 'preferencia' };
  }

  if (!tieneWebGL()) {
    await aplicarVistaSimple();
    return { estado: ESTADOS.SIN_WEBGL, motivo: 'contexto' };
  }

  const contexto = contextoAceptable();
  if (!contexto.ok) {
    await aplicarVistaSimple();
    return { estado: ESTADOS.SIN_WEBGL, motivo: contexto.motivo };
  }

  /* --- A partir de aquí sí hace falta Three.js --------------------- */
  let modulos;
  try {
    modulos = await Promise.all([
      import('../../vendor/three/0.186.1/three.module.js'),
      import('./calidad.js'),
    ]);
  } catch (error) {
    console.error('[universo] no se pudo cargar Three.js', error);
    await aplicarVistaSimple();
    return { estado: ESTADOS.SIN_WEBGL, motivo: 'carga' };
  }

  const [THREE, calidad] = modulos;

  try {
    const { crearEscena } = await import('./escena.js');
    const { crearHud } = await import('./hud.js');
    const { crearAudio } = await import('./audio.js');

    const gpu = calidad.probarWebGL();
    const nivel = calidad.detectarNivel({ gpu: gpu?.gpu ?? '' });

    /* El orden importa y no es arbitrario. El HUD y el audio se declaran
       ANTES de la escena porque la escena los invoca en su primer
       fotograma: si se declararan después, el cierre los encontraría sin
       inicializar y saltaría un `ReferenceError` en el bucle de render. */
    const sistemasPresentes = SISTEMAS.filter((s) => document.getElementById(s.seccion) !== null);
    const hud = crearHud({ sistemas: sistemasPresentes });
    const audio = crearAudio();

    const escena = crearEscena({
      lienzo,
      nivelInicial: nivel,
      alInformar: (datos) => hud.actualizar(datos),
      alDegradar: (nuevo) => {
        document.documentElement.dataset.calidad = nuevo;
        hud.actualizar({ nivel: nuevo });
      },
      alAcelerar: (fuerza) => audio.barrido(fuerza),
    });

    hud.conectar(escena);

    /* --- Cableado del HUD ---------------------------------------------
       El HUD no conoce ni el audio ni el desmontaje: solo sabe que el
       visitante ha pulsado algo. Aquí se conecta cada botón con lo que
       tiene que hacer. La persistencia va en los dos sentidos, para que la
       elección sobreviva a la recarga. */

    audio.configurar(almacen.get(CLAVE_SONIDO, false) === true, (activo) => {
      almacen.set(CLAVE_SONIDO, activo);
    });
    hud.sincronizarSonido(almacen.get(CLAVE_SONIDO, false) === true);

    hud.onSonido(() => {
      // `alternar()` devuelve el estado resultante. Si el navegador no
      // permite audio devuelve false y el HUD se queda en apagado: nunca
      // se muestra el botón como activo si no suena.
      const resultado = audio.alternar();
      hud.sincronizarSonido(resultado);
    });

    hud.onVistaSimple(async () => {
      almacen.set(CLAVE_SIMPLE, true);
      escena.dispose();
      hud.destroy();
      audio.destroy();
      await aplicarVistaSimple();
    });

    // El audio sigue a la visibilidad de la pestaña, igual que la escena.
    const alCambiarVisibilidad = () => audio.visibility(!document.hidden);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    document.documentElement.dataset.universo = 'activo';
    document.documentElement.dataset.calidad = nivel;

    const desmontar = async () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      escena.dispose();
      hud.destroy();
      audio.destroy();
      await aplicarVistaSimple();
    };

    return {
      estado: ESTADOS.COMPLETO,
      escena,
      hud,
      audio,
      desmontar,
    };
  } catch (error) {
    console.error('[universo] falló el montaje', error);
    await aplicarVistaSimple();
    return { estado: ESTADOS.SIN_WEBGL, motivo: 'montaje' };
  }
}

/**
 * Deja el sitio en su forma estática: sin lienzo, sin carga de Three.js y con
 * el contenido entero visible y navegable.
 *
 * No borra nada del DOM salvo el lienzo. La malla CSS (`.malla`) y el canvas
 * 2D de `modules/fondo.js` siguen montados: son el fondo del sitio y funcionan
 * sin WebGL. Ahí está el fallback de la versión 2D, y por eso ese módulo no
 * se toca en ningún momento.
 */
async function aplicarVistaSimple() {
  document.getElementById('universo-lienzo')?.remove();
  document.documentElement.dataset.universo = 'inactivo';

  // Se revela todo lo que la animación de entrada hubiera dejado oculto.
  for (const nodo of document.querySelectorAll('[data-revelar]')) {
    nodo.dataset.visible = '1';
  }
}

export { CLAVE_SIMPLE, CLAVE_SONIDO };
