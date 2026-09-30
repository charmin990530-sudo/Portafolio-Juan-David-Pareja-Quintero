/**
 * universo/colores.js — Lee la paleta de la marca desde el CSS.
 *
 * El universo no tiene colores propios: toma los que ya están definidos en
 * `01-tokens.css`. Si un día cambias `--cyan` en un solo sitio, los shaders,
 * las nebulosas y los planetas cambian con él, sin tocar una línea de JS.
 *
 * Motivo por el que importa: el sitio ya tiene un sistema de tokens con
 * roles semánticos (`--accent`, `--accent-2`, `--accent-3`, `--lime`).
 * Duplicar esos colores en JS habría creado una segunda fuente de verdad
 * que se desincroniza en la primera semana.
 */

import { Color } from '../../vendor/three/0.186.1/three.module.js';

/** Convierte `#4fe3ff` en un `THREE.Color` en espacio lineal. */
function desdeToken(nombre, porDefecto) {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return new Color(bruto || porDefecto);
}

/**
 * Paleta del universo.
 *
 * `THREE.Color` con `setStyle` aplica la conversión sRGB→lineal que el
 * renderizador espera. Los valores literales son de respaldo por si el CSS
 * aún no está disponible (no debería ocurrir: este módulo se importa después
 * de que el CSS se aplique, pero el fallback cuesta cuatro palabras).
 */
export function leerPaleta() {
  return {
    fondo: desdeToken('--space-900', '#05070f'),
    cian: desdeToken('--cyan', '#4fe3ff'),
    violeta: desdeToken('--violet', '#a06bff'),
    solar: desdeToken('--solar', '#ffb454'),
    lima: desdeToken('--lime', '#7ef2a8'),
    rosa: desdeToken('--rose', '#ff6ba8'),
    tinta: desdeToken('--ink-100', '#f2f6ff'),
  };
}

/**
 * Aviso cuando cambia `data-tema`, para que la escena reinterprete los
 * tokens en vez de quedarse con la paleta vieja.
 *
 * No existe un evento propio de cambio de tema en el sitio: el patrón
 * establecido es observar el atributo con `MutationObserver`, que es lo que
 * ya hacía `modules/fondo.js` con el canvas 2D. Se reutiliza tal cual para
 * no inventar un segundo mecanismo.
 */
export function alCambiarTema(callback) {
  const observador = new MutationObserver(() => callback(leerPaleta()));
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
  return () => observador.disconnect();
}

/** Mezcla lineal entre dos colores; `t` en [0,1]. */
export function mezclar(a, b, t) {
  return a.clone().lerp(b, t);
}
