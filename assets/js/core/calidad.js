/**
 * core/calidad.js — EL CONTRATO DE LA CALIDAD VISUAL.
 *
 * Tres cosas y solo tres: el nombre de la clave donde se guarda, los valores
 * admitidos, y el nombre del aviso que avisa de un cambio. Viven aquí, y no
 * en `universo/calidad.js` ni en `modules/calidadVisual.js`, por una razón
 * de capas:
 *
 * · `modules/calidadVisual.js` es el selector de la cabecera. Se carga en
 *   el arranque, con el resto del sitio.
 * · `universo/index.js` es la puerta del 3D. Se carga después, con un
 *   `import()` dinámico, y pesa.
 *
 * Los dos necesitan la misma clave y el mismo evento. Si el contrato
 * viviera en cualquiera de los dos, el otro tendría que importar un módulo
 * del otro, y `core` es la única capa de la que los dos pueden depender sin
 * crear un ciclo.
 *
 * Este archivo no decide nada: no sabe qué es un icosaedro ni cuántos puntos
 * de estrella hay. Solo acuerda las palabras.
 */

/** Clave de la preferencia. */
export const CLAVE_CALIDAD = 'odisea:calidad';

/**
 * Clave antigua, de cuando la única opción era apagar el 3D.
 *
 * Se sigue leyendo para que quien ya la tivesse no vea cambiar de golpe el
 * comportamiento de su sitio, pero ya no se escribe: la nueva clave sabe
 * decir "sin 3D" y tener las dos sería tener dos verdades.
 */
export const CLAVE_SIMPLE = 'odisea:simple';

export const CALIDAD = {
  AUTO: 'auto',
  ALTO: 'alto',
  MEDIO: 'medio',
  BAJO: 'bajo',
  OFF: 'off',
};

/** Los tres niveles reales, en el orden en que se degradan. */
export const NIVELES_REALES = [CALIDAD.ALTO, CALIDAD.MEDIO, CALIDAD.BAJO];

/** Eventos que cruzan la frontera entre la interfaz y el universo. */
export const EVENTO_CALIDAD = 'odisea:calidad';
export const EVENTO_APAGAR = 'odisea:apagar-universo';

/** ¿Es uno de los valores que el selector sabe representar? */
export function esCalidadValida(valor) {
  return Object.values(CALIDAD).includes(valor);
}

/** El estado de 3D actual, leído del `<html>`. Nadie puede mentir aquí. */
export function universoActivo() {
  return document.documentElement.dataset.universo === 'activo';
}
