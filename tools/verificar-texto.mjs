/**
 * tools/verificar-texto.mjs — Guardián de texto y rutas.
 *
 * Tres comprobaciones, elegidas porque las puede hacer bien:
 *   1. Caracteres CJK o cirílicos colados en un proyecto en español.
 *      Es un fallo que ha ocurrido seis veces al escribir el código y que
 *      es invisible de un vistazo, así que conviene que lo pille una máquina.
 *   2. Imports relativos que no resuelven: rutas rotas que solo fallan en
 *      producción, en el navegador, y no al abrir el archivo.
 *   3. `console.log` de depuración en el código que se sirve al visitante.
 *   4. Sintaxis de cada módulo ES, con el parser real de Node.
 *      Se añadió después de que un backtick dentro de un comentario GLSL
 *      cerrara antes de tiempo una plantilla y rompiera el archivo entero.
 *      Un `node --check` a secas no lo detecta porque el resto del código
 *      es válido; hace falta el parser de módulos.
 *
 * Lo que NO comprueba, a propósito: que no haya vocabulario inglés. Se
 * probó y solo daba falsos positivos, porque "shader", "canvas", "loop",
 * "viewport" y "tokens" son inglés técnico usado de forma correcta y
 * habitual en español, y el código de este proyecto ya los usa. Una lista
 * de palabras prohibidas sin diccionario sería ruido, no seguridad.
 *
 * `tools/` queda fuera del punto 3: ahí la salida por consola es el
 * producto del programa, no un resto de depuración.
 *
 * Ejecutar: node tools/verificar-texto.mjs
 * Sale con código 1 si encuentra algo.
 */

import { readdirSync, readFileSync, statSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OBJETIVOS = ['assets/js', 'assets/css', 'index.html', 'tools'];
const EXT = new Set(['.js', '.mjs', '.css', '.html']);
const IGNORAR = new Set(['LICENSE']);

const problemas = [];

function archivos(dir, salida = []) {
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return salida;
  }
  for (const entrada of entradas) {
    if (IGNORAR.has(entrada)) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else if (EXT.has(extname(entrada))) salida.push(ruta);
  }
  return salida;
}

const lista = OBJETIVOS.flatMap((o) => archivos(join(RAIZ, o)));
let lineasRevisadas = 0;

for (const ruta of lista) {
  const relativa = ruta.slice(RAIZ.length + 1);
  // Los ficheros vendorizados no son nuestros: no se corrigen ni se critican.
  if (relativa.includes('vendor/')) continue;
  // En `tools/` la salida por consola es el producto del programa.
  const esHerramienta = relativa.startsWith('tools/');

  const texto = readFileSync(ruta, 'utf8');
  const lineas = texto.split('\n');
  lineasRevisadas += lineas.length;

  lineas.forEach((linea, i) => {
    const numero = i + 1;

    // 1. CJK y cirílico
    if (/[\u4E00-\u9FFF\u3000-\u303F\u0400-\u04FF]/.test(linea)) {
      problemas.push(`${relativa}:${numero}  carácter CJK/cirílico → ${linea.trim()}`);
    }

    // 3. console.log de depuración
    if (!esHerramienta && /console\.log\s*\(/.test(linea)) {
      problemas.push(`${relativa}:${numero}  console.log de depuración → ${linea.trim()}`);
    }
  });

  // 4. imports relativos rotos
  if (extname(ruta) === '.js' || extname(ruta) === '.mjs') {
    /* Se buscan sobre el texto SIN comentarios. Una ruta citada en un
       comentario —`from './ejemplo.js'` en una explicación— no es un
       import, y sin esto salta como ruta rota. Le pasó a este mismo
       archivo, que menciona una ruta de ejemplo en su documentación. */
    const sinComentarios = texto
      .replace(/\/\*[\s\S]*?\*\//g, '\n')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1\n');

    const patron = /from\s+'(\.[^']+)'/g;
    let coincidencia;
    while ((coincidencia = patron.exec(sinComentarios)) !== null) {
      const destino = resolve(dirname(ruta), coincidencia[1]);
      try {
        statSync(destino);
      } catch {
        problemas.push(`${relativa}  import roto → '${coincidencia[1]}'`);
      }
    }
  }
}

console.log(`\nRevisados ${lista.length} archivos, ${lineasRevisadas} líneas.\n`);

/* ---- 4. Sintaxis de módulos ES, con el parser real ---- */

const temporal = mkdtempSync(join(tmpdir(), 'verif-'));
const destino = join(temporal, 'modulo.mjs');
let revisados = 0;

for (const ruta of lista) {
  if (!['.js', '.mjs'].includes(extname(ruta))) continue;
  if (ruta.slice(RAIZ.length + 1).includes('vendor/')) continue;
  copyFileSync(ruta, destino);
  try {
    execFileSync(process.execPath, ['--check', destino], { stdio: 'pipe' });
  } catch (error) {
    const salida = String(error.stderr ?? error.stdout ?? '')
      .split('\n')
      .find((l) => l.includes('SyntaxError'));
    problemas.push(`${ruta.slice(RAIZ.length + 1)}  sintaxis → ${salida?.trim() ?? 'error'}`);
  }
  revisados += 1;
}
rmSync(temporal, { recursive: true, force: true });

console.log(`  Sintaxis: ${revisados} módulos ES analizados.\n`);

if (problemas.length === 0) {
  console.log('  ✓ Sin caracteres ajenos, rutas rotas, sintaxis ni console.log.\n');
  process.exit(0);
}

console.log(`  ✗ ${problemas.length} problema(s):\n`);
for (const problema of problemas) console.log(`    ${problema}`);
console.log('');
process.exit(1);
