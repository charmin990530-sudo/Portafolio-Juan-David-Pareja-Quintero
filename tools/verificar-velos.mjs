#!/usr/bin/env node
/**
 * tools/verificar-velos.mjs — Que ningún velo tenga un borde.
 *
 *   node tools/verificar-velos.mjs
 *
 * EL DEFECTO QUE ESTA COMPROBACIÓN EXISTE PARA CAZAR
 *
 * La portada tenía una costura horizontal a media altura: por encima, apagado;
 * por debajo, el sol entero. Se tardó una sesión entera en buscarla en los
 * shaders —la mezcla aditiva, el shader del sol, la corona, el estado
 * acumulado de `ruta.js`— y ninguno era. Estaba en una regla de CSS de trece
 * líneas.
 *
 * La causa es geométrica y no tiene nada de misteriosa. Un scrim es un
 * `radial-gradient` dibujado dentro de una caja. Si el radio del gradiente es
 * MAYOR que la distancia del centro al borde de la caja, el gradiente todavía
 * no ha llegado a su último stop cuando la caja se acaba, y a partir de ahí no
 * se dibuja nada. El resultado es una línea recta y horizontal exactamente
 * donde termina la caja.
 *
 * `.hero__contenido::before` declaraba `116% 108%`: un radio un 16 % más
 * grande que la caja. Al borde le quedaban 0,82 de alfa, y el salto de 0,82 a
 * 0 es el que se veía. Medido sobre la captura: `rgb(43,43,48)` justo encima
 * de la costura y `rgb(204,199,195)` un píxel más abajo, con el `::before`
 * terminando en `bottom: 560.1` y la costura en `y=560`.
 *
 * POR QUÉ ES ESTÁTICA Y NO UNA CAPTURA
 *
 * Porque el defecto es una relación entre dos números escritos en el CSS —el
 * radio del gradiente y el tamaño de su caja— y esa relación se lee sin abrir
 * un navegador. Una captura lo encontraría tarde y de forma intermitente:
 * depende de dónde caiga la estrella, que depende del scroll.
 *
 * ── LA REGLA ──────────────────────────────────────────────────────────
 *
 * Un velo es un pseudoelemento con `position: absolute`, `z-index: -1` y
 * `pointer-events: none` que oscurece lo que hay detrás sin recibir clics. Para
 * que no deje costura tiene que apagarse antes de que se acabe su caja, y en
 * CSS eso se puede hacer de dos maneras. Se comprueban las tres posibles, porque
 * las tres son legales y solo una sirve:
 *
 *   · `radial-gradient` que termina en transparente: el alfa tiene que llegar a
 *     0 antes del borde de la caja, en los dos ejes.
 *   · `mask-image`: la máscara tiene que empezar y acabar en transparente.
 *   · Color plano y nada más: es un rectángulo opaco y está mal por definición.
 *
 * ── LO QUE NO COMPRUEBA ────────────────────────────────────────────────
 *
 * Los velos que son elementos de verdad y no pseudoelementos: `.hero__velo`,
 * `.hero__aura`, `.vineta`, `.malla`, `.proyecto__marcador`. Sus bordes caen
 * fuera de la pantalla o dentro de un padre con `overflow: hidden` y
 * `border-radius`, así que no se ven.
 *
 * Y los degradados LINEALES, que se cortan contra el borde igual que un radial.
 * No se comprueban porque los que hay son rectangulares a propósito: la viñeta
 * tiene que ser opaca en el borde de la pantalla, y el velo de sección en gama
 * baja arranca al 94 % justo en el borde superior de la sección, que es donde
 * empieza a cambiar el contenido. Medirlos exigiría saber qué hay detrás, y eso
 * es una captura.
 *
 * Sale con código 1 si algo falla, para que valga como puerta.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = join(RAIZ, 'assets/css');

/** Alfa por debajo del cual un corte no se ve. */
const CORTE_VISIBLE = 0.02;

/* ------------------------------------------------------------------
   Lectura de las hojas
   ------------------------------------------------------------------ */

/**
 * Trocea el CSS en bloques `selector { declaraciones }`.
 *
 * Se hace a mano y no con un parser porque el proyecto no tiene dependencias y
 * porque lo que hace falta es poco: un bloque da un selector y sus
 * declaraciones. Las hojas de este proyecto no anidan selectores, así que el
 * primer `{` que se cierra es el del bloque.
 *
 * @returns {Array<{selector: string, declaraciones: string, linea: number}>}
 */
function bloques(entrada) {
  /* Los comentarios se quitan ANTES de trocear, y no por limpieza: están
     llenos de llaves —este mismo archivo explica en uno de ellos por qué— y
     un `{` dentro de un comentario descuadraría el conteo y el troceado. */
  const css = entrada.replace(/\/\*[\s\S]*?\*\//g, '');
  const salida = [];
  let i = 0;

  while (i < css.length) {
    const llave = css.indexOf('{', i);
    if (llave === -1) break;

    /* El cierre tiene que ser el de ESTA llave: hay `@media` que contienen
       reglas dentro, así que contar llaves hacia atrás no vale. */
    let nivel = 0;
    let cierre = -1;
    for (let j = llave; j < css.length; j += 1) {
      if (css[j] === '{') nivel += 1;
      else if (css[j] === '}') {
        nivel -= 1;
        if (nivel === 0) {
          cierre = j;
          break;
        }
      }
    }
    if (cierre === -1) break;

    const selector = css.slice(i, llave).replace(/\s+/g, ' ').trim();

    if (!selector.startsWith('@')) {
      salida.push({
        selector,
        declaraciones: css.slice(llave + 1, cierre),
        linea: css.slice(0, i).split('\n').length,
      });
    } else if (/^@(media|supports|layer)\b/.test(selector)) {
      /* Un `@media` no es una regla: sus reglas están dentro y también valen.
         Un `@keyframes` no tiene reglas de estilo y se ignora. */
      salida.push(...bloques(css.slice(llave + 1, cierre)));
    }

    i = cierre + 1;
  }

  return salida;
}

/** Separa por comas de nivel superior: `rgb(1, 2, 3)` es un solo valor. */
function porComas(valor) {
  const partes = [];
  let actual = '';
  let nivel = 0;
  for (const caracter of valor) {
    if (caracter === '(') nivel += 1;
    if (caracter === ')') nivel -= 1;
    if (caracter === ',' && nivel === 0) {
      partes.push(actual.trim());
      actual = '';
    } else actual += caracter;
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
}

/** El valor de una propiedad concreta, o null. */
function propiedad(declaraciones, nombre) {
  for (const linea of declaraciones.split(';')) {
    const corte = linea.indexOf(':');
    if (corte === -1) continue;
    if (linea.slice(0, corte).trim().toLowerCase() === nombre) {
      return linea.slice(corte + 1).trim();
    }
  }
  return null;
}

/* ------------------------------------------------------------------
   Lectura de un color y de un stop
   ------------------------------------------------------------------ */

/**
 * El alfa de un color CSS.
 *
 * Se quita primero la posición del stop, porque `transparent 100%` no es un
 * color: es un color con su sitio en la rampa. Sin quitarla, un stop
 * transparente con posición se leería como opaco y el velo parecería bien.
 */
function alfa(color) {
  /* Se quita la posición del stop, que puede ser un porcentaje o una longitud:
     `transparent 100%`, `transparent 0` y `#000 7rem` son color más sitio, no
     un color distinto. Sin quitarla, un `transparent` con posición se leía como
     opaco y el velo parecería bien. */
  const c = color
    .trim()
    .replace(/\s+[+-]?[\d.]+(?:%|[a-z]+)?\s*$/i, '')
    .trim();

  if (/^transparent$/i.test(c)) return 0;

  const porcentaje = c.match(/\/\s*([\d.]+)\s*%\s*\)/);
  if (porcentaje) return Number(porcentaje[1]) / 100;
  const decimal = c.match(/\/\s*([\d.]+)\s*\)/);
  if (decimal) return Number(decimal[1]);

  /* `color-mix(in srgb, var(--x) 82%, transparent)` → 0,82.
     El `[^()]` no vale: los `var(--x)` llevan sus propios paréntesis. */
  const mix = c.match(/color-mix\((?:[^()]|\([^()]*\))*?([\d.]+)%\s*,\s*transparent\s*\)/i);
  if (mix) return Number(mix[1]) / 100;

  return 1;
}

/** La posición de un stop: `color 62%` → 0,62. Sin posición, null. */
function posicion(stop) {
  const m = stop.trim().match(/([\d.]+)%\s*$/);
  return m ? Number(m[1]) / 100 : null;
}

/** ¿Es este trozo un color, o la parte que describe la forma del gradiente? */
function esColor(texto) {
  const t = texto.trim();
  return (
    /^#/.test(t) ||
    /^(rgb|rgba|hsl|hsla|lab|lch|oklab|oklch|color|color-mix|var|light-dark)\s*\(/i.test(t) ||
    /^transparent$/i.test(t)
  );
}

/**
 * Separa `radial-gradient(...)` en su cabeza de forma y sus stops.
 *
 * @returns {{cabeza: string, stops: string[]}}
 */
function separarGradiente(capa) {
  const dentro = capa.slice(capa.indexOf('(') + 1, capa.lastIndexOf(')'));
  const partes = porComas(dentro);

  const primero = partes.findIndex(esColor);
  if (primero === -1) return { cabeza: dentro.trim(), stops: [] };

  return {
    cabeza: partes.slice(0, primero).join(',').trim(),
    stops: partes.slice(primero).filter(Boolean),
  };
}

/**
 * El alfa del gradiente justo donde la caja se acaba, en cada eje.
 *
 * Las medidas del gradiente son fracciones de la caja: un radio del `50%` es la
 * mitad del ancho. El borde de la caja está a `0,5` del centro, así que cae en
 * el punto `0,5 / radio` de la rampa. De ahí el alfa, interpolando entre stops.
 *
 * Un valor ≥ 1 significa que el gradiente ya se apagó antes del borde, que es
 * lo correcto.
 *
 * @returns {{x: number, y: number}}
 */
function alfaEnBorde(cabeza, stops) {
  const at = cabeza.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
  const cx = at ? Number(at[1]) / 100 : 0.5;
  const cy = at ? Number(at[2]) / 100 : 0.5;

  /* Dos tamaños en porcentajes: `116% 108%`. Es la forma explícita del fallo,
     así que es la que hay que leer bien. */
  const dos = cabeza.match(/^([\d.]+)%\s+([\d.]+)%(?!\s*\d)/);
  const rx = dos ? Number(dos[1]) / 100 : 0.5;
  const ry = dos ? Number(dos[2]) / 100 : 0.5;

  if (!stops.length) return { x: 1, y: 1 };

  const primero = { p: posicion(stops[0]) ?? 0, a: alfa(stops[0]) };
  const ultimo = { p: posicion(stops[stops.length - 1]) ?? 1, a: alfa(stops[stops.length - 1]) };

  const en = (t) => {
    if (t >= ultimo.p) return ultimo.a;
    if (t <= primero.p) return primero.a;
    for (let i = 0; i < stops.length - 1; i += 1) {
      const p0 = posicion(stops[i]);
      const p1 = posicion(stops[i + 1]);
      if (p0 === null || p1 === null) continue;
      if (t >= p0 && t <= p1) {
        const a0 = alfa(stops[i]);
        const a1 = alfa(stops[i + 1]);
        return a0 + (a1 - a0) * ((t - p0) / (p1 - p0));
      }
    }
    return ultimo.a;
  };

  /* El borde más cercano al centro es el que puede cortar: si el gradiente está
     descentrado, ese lado es el que acaba antes. */
  return { x: en(Math.min(cx, 1 - cx) / rx), y: en(Math.min(cy, 1 - cy) / ry) };
}

/* ------------------------------------------------------------------
   La comprobación
   ------------------------------------------------------------------ */

const fallos = [];
let velos = 0;

for (const archivo of readdirSync(CARPETA).filter((a) => a.endsWith('.css')).sort()) {
  const css = readFileSync(join(CARPETA, archivo), 'utf8');

  for (const { selector, declaraciones, linea } of bloques(css)) {
    /* Un velo: un pseudoelemento detrás del contenido que no recibe eventos. */
    if (!/::(before|after)\b/.test(selector)) continue;
    if (propiedad(declaraciones, 'position') !== 'absolute') continue;
    if (propiedad(declaraciones, 'pointer-events') !== 'none') continue;
    if (propiedad(declaraciones, 'z-index') !== '-1') continue;

    velos += 1;
    const donde = `${archivo}:${linea}  ${selector}`;

    const fondo = propiedad(declaraciones, 'background') ?? '';
    const mascara =
      propiedad(declaraciones, 'mask-image') ?? propiedad(declaraciones, '-webkit-mask-image') ?? '';

    /* --- Se pinta con un radial ---------------------------------------- */
    const radiales = [...porComas(fondo), ...porComas(mascara)].filter((c) =>
      c.startsWith('radial-gradient'),
    );

    if (radiales.length) {
      for (const capa of radiales) {
        const { cabeza, stops } = separarGradiente(capa);
        const borde = alfaEnBorde(cabeza, stops);

        /* Si no se apaga, no es un velo radial sino una forma —una viñeta, un
           foco— y que se corte en el borde es justo lo que se busca. */
        if (borde.x >= 1 && borde.y >= 1) continue;

        const peor = Math.max(borde.x, borde.y);
        if (peor > CORTE_VISIBLE) {
          fallos.push(
            `${donde}\n` +
              `        el radial-gradient("${cabeza}") llega al borde de su caja con alfa ` +
              `${peor.toFixed(2)} (x ${borde.x.toFixed(2)}, y ${borde.y.toFixed(2)}), así que corta ` +
              `en seco al terminar la caja.\n` +
              `        Arreglo: que el stop transparente caiga DENTRO de la caja. Con el centro al 50 %, ` +
              `eso quiere decir un radio del 50 % o menos en los dos ejes —` +
              `radial-gradient(50% 50%, ...)—, y repartir los stops para que la zona densa siga siendo la ` +
              `que protege al texto.`,
          );
        }
      }
      continue;
    }

    /* --- Se apaga con una máscara: los dos extremos en transparente ------ */
    if (mascara) {
      for (const capa of porComas(mascara)) {
        if (!capa.startsWith('linear-gradient')) continue;
        const dentro = capa
          .slice(capa.indexOf('(') + 1, capa.lastIndexOf(')'))
          /* La dirección va antes de la primera coma y no es un stop:
             `to bottom, transparent 0, ...` son tres cosas, no dos. */
          .replace(/^\s*to\s+[a-z-]+\s*(?:,\s*)?/i, '');
        const partes = porComas(dentro);
        if (partes.length < 2) continue;

        const primero = alfa(partes[0]);
        const ultimo = alfa(partes[partes.length - 1]);
        if (primero > CORTE_VISIBLE || ultimo > CORTE_VISIBLE) {
          fallos.push(
            `${donde}\n` +
              `        la máscara arranca con alfa ${primero} y termina con alfa ${ultimo}: la caja se ` +
              `acaba con el velo todavía puesto.\n` +
              `        Arreglo: los dos extremos en transparent.`,
          );
        }
      }
      continue;
    }

    /* --- Un color plano: un rectángulo opaco no vela nada --------------- */
    const color = fondo.trim();
    if (color && !/gradient\(/i.test(color) && !/^none$/i.test(color)) {
      fallos.push(
        `${donde}\n` +
          `        el velo se pinta con "${color}", un color plano: es un rectángulo opaco con borde ` +
          `duro.\n` +
          `        Arreglo: un radial-gradient que se apague, o una máscara con los dos extremos ` +
          `transparentes.`,
      );
    }
  }
}

/* ------------------------------------------------------------------
   Informe
   ------------------------------------------------------------------ */

console.log('\n════════════════════════════════════════════════════════════');
console.log('  VELOS SIN COSTURA');
console.log('════════════════════════════════════════════════════════════\n');

console.log(`  ${velos} velos revisados. Ninguno debe dejar una línea donde acaba su caja.\n`);

if (fallos.length === 0) {
  console.log('  ✓ Todos se apagan antes de que su caja se acabe.\n');
  process.exit(0);
}

console.log(`  ✗ ${fallos.length} velo(s) con borde duro:\n`);
for (const fallo of fallos) console.log(`      ✗ ${fallo}`);
console.log('');

process.exit(1);
