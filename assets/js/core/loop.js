/**
 * core/loop.js — Un único requestAnimationFrame para toda la página.
 *
 * Concentrar el bucle de animación evita decenas de rAF independientes,
 * permite pausar cuando la pestaña está oculta y expone el delta real
 * a cada consumidor (necesario para animaciones independientes del framerate).
 */

const suscriptores = new Set();

/** Fallos consecutivos por suscriptor. Ver `paso()`. */
const fallos = new Map();

/**
 * Cuántos fotogramas seguidos puede fallar un suscriptor antes de darse por
 * muerto. Con render por software un fallo puntual es posible y no significa
 * que el módulo esté roto: lo que no puede pasar es que el universo se quede
 * en negro en silencio.
 */
const FALLOS_PARA_RENUNCIAR = 60;

let id = 0;
let anterior = 0;
let activo = true;
let pausado = document.hidden;

function paso(ahora) {
  id = requestAnimationFrame(paso);

  const delta = anterior ? Math.min(ahora - anterior, 64) : 16.67;
  anterior = ahora;

  if (pausado) return;

  for (const fn of suscriptores) {
    try {
      fn(delta, ahora);
      if (fallos.has(fn)) fallos.delete(fn);
    } catch (error) {
      /* Un fallo NO da de baja al suscriptor.

         Este bucle alimenta toda la escena 3D. Darse de baja convertía
         cualquier excepción —un identificador mal escrito en un shader, un
         cuerpo sin preparar— en una pantalla negra permanente, con una sola
         línea en la consola como único rastro.

         Ahora un fotograma malo se registra y el bucle sigue, que es lo que
         corresponde a un fallo puntual. Solo se renuncia cuando el módulo
         está claramente roto, que es lo que delatan los fallos seguidos. */
      const seguidos = (fallos.get(fn) ?? 0) + 1;
      fallos.set(fn, seguidos);

      // Se informa del primero y luego de cada décima repetición, para que un
      // fallo persistente sea legible en vez de un aluvión por segundo.
      if (seguidos === 1 || seguidos % 10 === 0) {
        console.error(`[loop] suscriptor falló (${seguidos})`, error);
      }

      if (seguidos >= FALLOS_PARA_RENUNCIAR) {
        console.error('[loop] suscriptor dado de baja tras fallos seguidos');
        suscriptores.delete(fn);
        fallos.delete(fn);
      }
    }
  }
}

function arrancar() {
  if (id) return;
  anterior = 0;
  id = requestAnimationFrame(paso);
}

function pausar() {
  if (!id) return;
  cancelAnimationFrame(id);
  id = 0;
}

/** Registra una función por cuadro. Devuelve la función para darla de baja. */
export function alFotograma(fn) {
  suscriptores.add(fn);
  if (activo) arrancar();
  return () => {
    suscriptores.delete(fn);
    fallos.delete(fn);
  };
}

document.addEventListener('visibilitychange', () => {
  pausado = document.hidden;
  if (pausado) {
    anterior = 0;
  } else if (activo) {
    arrancar();
  }
});

/** Detiene por completo el bucle (no se usa de forma normal). */
export function detenerLoop() {
  activo = false;
  suscriptores.clear();
  fallos.clear();
  pausar();
}