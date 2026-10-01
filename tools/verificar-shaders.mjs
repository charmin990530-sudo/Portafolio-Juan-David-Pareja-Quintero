#!/usr/bin/env node
/**
 * tools/verificar-shaders.mjs — Lo que ninguna otra comprobación ve.
 *
 *   node tools/verificar-shaders.mjs
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 *
 * Los shaders son cadenas de texto dentro de plantillas de JavaScript. Ni el
 * analizador de sintaxis las lee, ni el verificador de imports las toca, ni el
 * de accesibilidad. Un error dentro de ellas no se ve hasta que GLSL compila
 * en el navegador, y para entonces el síntoma es desconcertante: el universo
 * entero en negro y una línea de aviso por fotograma.
 *
 * Ya ha pasado. Un acento en un identificador —`aTravés` en lugar de
 * `aTraves`— no rompe el archivo para JavaScript, no rompe el HTML y no lo ve
 * nadie: la compilación falla y la escena no dibuja ni un planeta.
 *
 * ESTA COMPROBACIÓN ES ESTÁTICA Y ES LO QUE SE PUEDE HACER
 *
 * No se compila GLSL aquí: no hay contexto WebGL en Node. Lo que se hace es
 * revisar lo que se puede saber sin compilar, que es justo lo que antes no se
 * revisaba:
 *
 *   1. Caracteres no ASCII fuera de comentarios. GLSL solo admite ASCII en
 *      el código. En los comentarios el acento es legítimo e inofensivo.
 *   2. Llaves y paréntesis equilibrados en cada shader.
 *   3. Que todo uniforme declarado tenga su `value:`.
 *   4. Que cada shader tenga su `void main()`.
 *
 * Sale con código 1 si algo falla, para que valga como puerta.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = join(RAIZ, 'assets/js/universo');

/* Todo lo que no es ASCII y no es letra acentuada española admitted. */
const NO_ASCII = /[^\x09\x0A\x0D\x20-\x7E]/g;
const PERMITIDOS = new Set(['·', '—', '×', '°']);

/** Quita comentarios de línea y de bloque de un trozo de GLSL. */
function sinComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Extrae los shaders de un módulo.
 *
 * Se buscan las plantillas etiquetadas `/* glsl *\/` porque el proyecto las
 * marca todas con esa etiqueta. Es lo que permite distinguirlas de cualquier
 * otra cadena del archivo sin tener que interpretar JavaScript.
 */
function extraerShaders(codigo) {
  const salida = [];
  const patron = /\/\*\s*glsl\s*\*\/\s*`([\s\S]*?)`/g;
  let m;
  while ((m = patron.exec(codigo)) !== null) {
    const linea = codigo.slice(0, m.index).split('\n').length;
    salida.push({ linea, codigo: m[1] });
  }
  return salida;
}

function contar(texto, abre, cierra) {
  let n = 0;
  for (const c of texto) {
    if (c === abre) n += 1;
    else if (c === cierra) n -= 1;
  }
  return n;
}

/** Recorre el árbol de `assets/js/universo`. */
function modulos(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...modulos(ruta));
    else if (ruta.endsWith('.js')) salida.push(ruta);
  }
  return salida;
}

const fallos = [];
let totalShaders = 0;

for (const ruta of modulos(CARPETA)) {
  const nombre = ruta.slice(RAIZ.length + 1);
  const fuente = readFileSync(ruta, 'utf8');
  const shaders = extraerShaders(fuente);

  /* `shaders/comunes.js` no contiene shaders: son trozos de GLSL que se
     inyectan en otros (`RUIDO`, `LUZ`). No llevan `main()` porque no son
     programas, así que no se les exige. */
  const esFragmento = ruta.includes(`${join('universo', 'shaders')}`);

  for (const { linea, codigo } of shaders) {
    totalShaders += 1;
    const donde = `${nombre}:${linea}`;

    /* --- 1. No ASCII fuera de comentarios ------------------------- */
    const limpio = sinComentarios(codigo);
    NO_ASCII.lastIndex = 0;
    for (let m = NO_ASCII.exec(limpio); m !== null; m = NO_ASCII.exec(limpio)) {
      const caracter = m[0];
      if (PERMITIDOS.has(caracter)) continue;
      const lineaProblema = limpio.slice(0, m.index).split('\n').length;
      const hex = caracter.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      fallos.push(
        `${donde}+${lineaProblema}  carácter no ASCII "${caracter}" (U+${hex}) en el código GLSL`,
      );
    }

    /* --- 2. Acentos graves ------------------------------------------
       Un acento grave CIERRA la plantilla de JavaScript. Escribir
       `uEntrada` dentro de un comentario de GLSL termina el literal en ese
       punto y el resto del shader se interpreta como código de JavaScript,
       con un error de sintaxis que no señala el shader. Pasa dos veces en
       este proyecto antes deCAErtse. */
    if (codigo.includes('`')) {
      const linea = codigo.slice(0, codigo.indexOf('`')).split('\n').length;
      fallos.push(`${donde}+${linea}  acento grave dentro del GLSL: cierra la plantilla de JavaScript`);
    }

    /* --- 3. Llaves y paréntesis ------------------------------------ */
    const llaves = contar(limpio, '{', '}');
    if (llaves !== 0) fallos.push(`${donde}  llaves descompensadas (${llaves > 0 ? '+' : ''}${llaves})`);

    const parentesis = contar(limpio, '(', ')');
    if (parentesis !== 0) fallos.push(`${donde}  paréntesis descompensados (${parentesis > 0 ? '+' : ''}${parentesis})`);

    /* --- 3. Punto de entrada --------------------------------------
       Solo en los programas completos. Un fragmento compartido no lo lleva. */
    if (!esFragmento && !/\bvoid\s+main\s*\(/.test(limpio)) {
      fallos.push(`${donde}  el shader no tiene void main()`);
    }
  }

  /* --- 4. Acentos graves por archivo -----------------------------
       La comprobación de arriba mira dentro del shader extraído, pero un
       acento grave INSIDE de la plantilla la cierra antes de tiempo: el
       recorte se queda corto y no se ve el acento. La señal que sí es
       robusta es la paridad: si el número de acentos graves del archivo es
       impar, alguna plantilla no está cerrada. */
  const graves = (fuente.match(/`/g) ?? []).length;
  if (graves % 2 !== 0) {
    fallos.push(
      `${nombre}  ${graves} acentos graves: impares, alguna plantilla de JavaScript no está cerrada`,
    );
  }

  /* --- 5. Uniformes declarados sin valor -------------------------
     La declaración vive en la plantilla GLSL y el valor en el objeto de
     uniforms de JavaScript, unas líneas más abajo. Por eso se busca en todo
     el archivo y no dentro de la plantilla. */
  for (const m of fuente.matchAll(/uniform\s+\w+\s+(u[A-Za-z0-9_]+)\s*;/g)) {
    const uniforme = m[1];
    if (!new RegExp(`\\b${uniforme}\\s*:\\s*\\{`).test(fuente)) {
      const lineaUni = fuente.slice(0, m.index).split('\n').length;
      fallos.push(`${nombre}:${lineaUni}  el uniforme "${uniforme}" se declara pero no recibe valor`);
    }
  }
}

/* --- Informe ------------------------------------------------------ */

console.log('\n════════════════════════════════════════════════════════════');
console.log('  SHADERS GLSL');
console.log('════════════════════════════════════════════════════════════\n');

console.log(`  ${totalShaders} shaders en ${modulos(CARPETA).length} módulos.\n`);

if (fallos.length === 0) {
  console.log('  ✓ Sin caracteres no ASCII, llaves equilibradas, uniformes con valor y main() en su sitio.\n');
  process.exit(0);
}

console.log(`  ✗ ${fallos.length} fallo(s):\n`);
for (const fallo of fallos) console.log(`      ✗ ${fallo}`);
console.log('');

process.exit(1);