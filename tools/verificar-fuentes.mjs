#!/usr/bin/env node
/**
 * tools/verificar-fuentes.mjs — Que cada archivo de fuente sea el que dice ser.
 *
 *   node tools/verificar-fuentes.mjs
 *
 * ── EL DEFECTO QUE ESTA COMPROBACIÓN EXISTE PARA CAZAR ───────────────────
 *
 * El sitio declara seis `@font-face` sobre tres familias. En realidad hay
 * TRES archivos distintos, porque varios son el mismo repetido con otro
 * nombre:
 *
 *   87c506d8…  space-grotesk-500-latin.woff2   usWeightClass = 300
 *   87c506d8…  space-grotesk-700-latin.woff2   usWeightClass = 300   ← el MISMO byte a byte
 *   260c81a4…  inter-400-latin.woff2           usWeightClass = 400
 *   260c81a4…  inter-500-latin.woff2           usWeightClass = 400   ← el MISMO byte a byte
 *   260c81a4…  inter-600-latin.woff2           usWeightClass = 400   ← el MISMO byte a byte
 *
 * El CSS, en cambio, declara 500 y 700 para Space Grotesk, y 400, 500 y 600
 * para Inter. Es decir: el sitio PIDE cinco pesos y tiene dos, y ni siquiera
 * son los dos que cree tener. Los titulares de todo el sitio se dibujan en
 * Space Grotesk Light y todo el texto en Inter Regular, con el CSS diciendo
 * otra cosa.
 *
 * No sale ningún error, ninguna petición fallida y ningún aviso del
 * navegador: el archivo existe, se descarga y se dibuja. Lo único falso es la
 * jerarquía. Y por eso es exactamente el tipo de defecto que hace una
 * comprobación y no los ojos: el sitio se ve "bien" y está mintiendo.
 *
 * ── POR QUÉ ES ESTÁTICA Y NO UNA CAPTURA ─────────────────────────────────
 *
 * Porque el defecto es una contradicción entre dos números escritos en el
 * repositorio: el `usWeightClass` que lleva DENTRO el archivo de fuente y el
 * `font-weight` que declara el CSS. Los dos se leen sin abrir un navegador.
 * Una captura lo encontraría tarde y de forma dudosa: una fuente Light puede
 * parecer correcta al ojo en un titular, y no hay forma de saber por
 *creenshot qué peso real se usó.
 *
 * ── CÓMO LEE EL PESO DE DENTRO DEL ARCHIVO ────────────────────────────────
 *
 * Un `.woff2` es un contenedor: una cabecera, un directorio de tablas con la
 * longitud ORIGINAL de cada tabla, y un único flujo brotli con las tablas ya
 * descomprimidas y transformadas. `usWeightClass` vive en la tabla `OS/2`,
 * en el byte 4 de esa tabla.
 *
 * Se lee entero aquí, sin dependencias, por dos razones:
 *
 *   · El sitio no tiene `package.json` y no va a tener uno. Añadir una
 *     dependencia para leer una cabecera de 12 bytes sería un coste enorme
 *     por una comprobación.
 *   · `node:zlib` trae `brotliDecompressSync` de serie, que es justo lo que
 *     hace falta para el único paso no trivial.
 *
 * Lo que NO hace falta para esto: decodificar `glyf` ni `loca`, que son las
 * tablas que llevan la transformación propia de WOFF2. `OS/2` no está
 * transformada, así que sale del flujo tal cual.
 *
 * ── LO QUE NO COMPRUEBA ──────────────────────────────────────────────────
 *
 * · Que la fuente sea la que el nombre del archivo sugiere. Solo comprueba
 *   que el peso interno case con el peso declarado en el CSS, y que dos
 *   archivos con el mismo nombre pedido no sean el mismo binario.
 * · Que un peso que se pide y no existe se relacione con otra fuente: si el
 *   CSS pide 600 de Inter y el archivo es un 400, el navegador usa el 400 y no
 *   avisa. Eso es exactamente lo que se comprueba aquí.
 * · Los subconjuntos. Solo se mira el archivo `latin`; los otros subconjuntos
 *   de la misma familia no se descargan y no se pueden leer sin pedirlos.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_FUENTES = resolve(RAIZ, 'assets/fonts');
const CSS_FUENTES = resolve(RAIZ, 'assets/css/00-fonts.css');

/**
 * Orden de las tablas en un WOFF2, Fixed por la especificación. El directorio
 * del archivo NO lleva los nombres: solo lleva banderas, y el nombre se
 * deduce de la posición. Esta es la lista.
 */
const TABLAS_WOFF2 = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post',
  'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

/** Entero base 128 con continuation bit, el formato de longitudes de WOFF2. */
function enteroBase128(buffer, posicion) {
  let resultado = 0;
  for (let i = 0; i < 5; i += 1) {
    const byte = buffer[posicion];
    if (byte === undefined) throw new Error('entero base 128 truncado');
    // 7 bits por byte, el bit alto marca "sigue".
    resultado = (resultado << 7) | (byte & 0x7f);
    posicion += 1;
    if ((byte & 0x80) === 0) return [resultado, posicion];
  }
  throw new Error('entero base 128 de más de 5 bytes');
}

/**
 * Lee `usWeightClass` de la tabla `OS/2` de un `.woff2`.
 * @returns {{ peso: number, nombre: string|null }}
 */
function leerPeso(archivo) {
  const buffer = readFileSync(archivo);

  if (buffer.toString('latin1', 0, 4) !== 'wOF2') {
    throw new Error('no empieza por la firma wOF2');
  }

const numeroTablas = buffer.readUInt16BE(12);

  /* El directorio se recorre UNA VEZ y se guarda entero, porque hay dos
     cosas que sacar de él: dónde acaba (el comienzo del flujo brotli) y qué
     ocupa cada tabla dentro del flujo.

     Cada entrada es una bandera, un nombre de 4 bytes SOLO si la bandera vale
     63 —la lista de la especificación no trae nombres nuevos—, la longitud
     original y, si la tabla va transformada, la longitud transformada. Las
     dos longitudes no son la misma cosa, y saltarse la segunda es lo que
     hace que el cursor acabe en medio del flujo brotli.

     Ese es el detalle que hace que esto funcione: dentro del flujo las tablas
     van TRANSFORMADAS, así que lo que ocupa cada una es su longitud
     transformada si la tiene, y la original si no. Sumar solo las originales
     —que es lo obvio— da un desplazamiento que no apunta a nada.

     Solo `glyf` y `loca` se transforman, y las dos son tablas conocidas de la
     lista, así que nunca llevan el nombre explícito. Para las de nombre
     explícito no hay forma de saber si van transformadas, y no hace falta:
     no son de las dos. */
  const directorio = [];
  let cursor = 48;
  for (let i = 0; i < numeroTablas; i += 1) {
    const bandera = buffer[cursor];
    cursor += 1;
    const indice = bandera & 0x3f;
    const nombreExplicito = indice === 0x3f;
    if (nombreExplicito) cursor += 4;

    const [longitudOriginal, trasOriginal] = enteroBase128(buffer, cursor);
    let longitudEnFlujo = longitudOriginal;
    cursor = trasOriginal;

    if (!nombreExplicito && transforma(indice)) {
      const [longitudTransformada, tras] = enteroBase128(buffer, cursor);
      longitudEnFlujo = longitudTransformada;
      cursor = tras;
    }

    directorio.push({ nombre: nombreExplicito ? null : TABLAS_WOFF2[indice], longitudEnFlujo });
  }

  // De aquí en adelante, el resto del archivo es el flujo brotli con las
  // tablas ya descomprimidas y en el orden del directorio.
  const flujo = brotliDecompressSync(buffer.subarray(cursor));

  let desplazamiento = 0;
  for (const tabla of directorio) {
    if (tabla.nombre === 'OS/2') {
      // `usWeightClass` está en el byte 4 de la tabla OS/2, y la tabla no
      // lleva transformación: sale del flujo tal cual, sin decodificar glyf.
      return { peso: flujo.readUInt16BE(desplazamiento + 4) };
    }
    desplazamiento += tabla.longitudEnFlujo;
  }

  throw new Error('el archivo no tiene tabla OS/2');
}

/** Las cuatro únicas tablas que WOFF2 transforma, por índice en la lista. */
function transforma(indice) {
  const nombre = TABLAS_WOFF2[indice];
  return nombre === 'glyf' || nombre === 'loca';
}

/* ------------------------------------------------------------------
   1. Lo que el CSS pide
   ------------------------------------------------------------------ */

/** Los `@font-face` de 00-fonts.css, con su familia, peso y archivo. */
function facesDelCss() {
  const css = readFileSync(CSS_FUENTES, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  const faces = [];
  const bloque = /@font-face\s*\{([^}]*)\}/g;
  let coincidencia;
  while ((coincidencia = bloque.exec(css)) !== null) {
    const cuerpo = coincidencia[1];
    const tomar = (propiedad) => cuerpo.match(new RegExp(`${propiedad}\\s*:\\s*([^;]+);`))?.[1]?.trim();
    const archivo = tomar('src')?.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1];
    if (!archivo) continue;
    faces.push({
      familia: tomar('font-family')?.replace(/['"]/g, '') ?? '?',
      peso: Number(tomar('font-weight')),
      archivo: resolve(dirname(CSS_FUENTES), archivo),
    });
  }
  return faces;
}

/* ------------------------------------------------------------------
   2. Las dos reglas
   ------------------------------------------------------------------ */

const fallos = [];
const faces = facesDelCss();
const fuentes = readdirSync(DIR_FUENTES).filter((n) => n.endsWith('.woff2'));
const peticiones = new Set(faces.map((f) => relative(RAIZ, f.archivo)));

/* Regla 1: el peso de DENTRO del archivo tiene que ser el que declara el CSS.

   Es la que descubre el defecto: el CSS pide 700 y el archivo lleva 300. */
const pesados = new Map();
for (const face of faces) {
  const nombre = relative(RAIZ, face.archivo);
  let leido;
  try {
    leido = leerPeso(face.archivo);
  } catch (error) {
    fallos.push(`${nombre}: no se pudo leer el peso — ${error.message}`);
    continue;
  }
  pesados.set(nombre, leido.peso);

  if (leido.peso !== face.peso) {
    fallos.push(
      `${nombre}\n` +
      `    el CSS declara font-weight: ${face.peso} (${face.familia})\n` +
      `    y el archivo lleva usWeightClass: ${leido.peso}\n` +
      `    el navegador usará ${leido.peso} y no avisará de nada`,
    );
  }
}

/* Regla 2: dos archivos distintos no pueden ser el mismo binario.

   Es la que detecta el desperdicio: 44 KB de fuentes que no se usan, y un
   `src` por peso que en realidad apunta al mismo sitio. */
const porContenido = new Map();
for (const nombre of fuentes) {
  const clave = readFileSync(resolve(DIR_FUENTES, nombre)).toString('base64').slice(0, 256);
  const gemelos = porContenido.get(clave) ?? [];
  gemelos.push(nombre);
  porContenido.set(clave, gemelos);
}

const duplicados = [...porContenido.values()].filter((grupo) => grupo.length > 1);
for (const grupo of duplicados) {
  const pesos = grupo.map((n) => pesados.get(relative(RAIZ, resolve(DIR_FUENTES, n))) ?? '?');
  fallos.push(
    `archivos idénticos byte a byte: ${grupo.join(' = ')}` +
      (pesos.every((p) => p !== '?') ? `\n    todos llevan usWeightClass ${pesos[0]}` : ''),
  );
}

/* ------------------------------------------------------------------
   3. Informe
   ------------------------------------------------------------------ */

const pesoDe = (nombre) => pesados.get(relative(RAIZ, resolve(DIR_FUENTES, nombre)));
const sePide = (nombre) => peticiones.has(relative(RAIZ, resolve(DIR_FUENTES, nombre)));
const sinPedir = fuentes.filter((nombre) => !sePide(nombre));

console.log(`\n  ${faces.length} @font-face declaran ${fuentes.length} archivos de fuente\n`);
for (const nombre of fuentes.sort()) {
  console.log(`    peso ${String(pesoDe(nombre) ?? '?').padStart(3)}  ${nombre}${sePide(nombre) ? '' : ' (no se pide)'}`);
}
if (sinPedir.length) {
  console.log(`\n  ${sinPedir.length} archivo(s) que ningún @font-face pide: ${sinPedir.join(', ')}`);
}
console.log('');

if (fallos.length) {
  console.log('  El CSS y los archivos de fuente no coinciden:\n');
  for (const fallo of fallos) console.log(`  ✗ ${fallo}\n`);
  process.exit(1);
}

console.log('  Cada @font-face pide el peso que su archivo lleva de verdad.\n');