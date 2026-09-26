/**
 * core/loop.js — Un único requestAnimationFrame para toda la página.
 *
 * Concentrar el bucle de animación evita decenas de rAF independientes,
 * permite pausar cuando la pestaña está oculta y expone el delta real
 * a cada consumidor (necesario para animaciones independientes del framerate).
 */

const suscriptores = new Set();

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
    } catch (error) {
      console.error('[loop] suscriptor falló', error);
      suscriptores.delete(fn);
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
  return () => suscriptores.delete(fn);
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
  pausar();
}
