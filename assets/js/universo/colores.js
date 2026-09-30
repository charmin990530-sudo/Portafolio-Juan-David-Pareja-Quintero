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
 * Se lee una sola vez, al montar. Ya no hay tema que alternar —el sitio
 * es nocturno por diseño y el selector "Alba" se retiró cuando llegó el
 * universo—, así que no hace falta observar ningún atributo.
 *
 * Para recuperar un tema claro en el futuro hay que reañadir aquí un
 * `MutationObserver` sobre `data-tema` que vuelva a llamar a `leerPaleta()`,
 * exactamente como hacía `modules/fondo.js` con el canvas 2D antes de
 * retirarlo. Ver `UNIVERSO.md`.
 *
 * `THREE.Color` con el constructor de cadena aplica la conversión
 * sRGB→lineal que el renderizador espera. Los literales son de respaldo por
 * si el CSS aún no estuviera disponible, que no debería pasar: este módulo
 * se importa después de que el CSS se aplique, pero el respaldo cuesta
 * cuatro palabras.
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
