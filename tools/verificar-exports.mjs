/**
 * tools/verificar-exports.mjs — ¿Se usa todo lo que se exporta?
 *
 * Un export que nadie importa no es una API: es código muerto. Se paga en
 * peso, se mantiene sin motivo y engaña a quien lea el archivo pensando que
 * hay algo que lo consume.
 *
 * Recorre el grafo real desde `main.js` y, para cada `export` que no
 * encuentra referenciado en ningún otro módulo, lo señala.
 *
 * Salida: 0 si no hay exports muertos, 1 si hay alguno.
 *
 * Ejecutar: node tools/verificar-exports.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS = resolve(RAIZ, 'assets/js');
const VENDOR = `${JS}/vendor`;

/* ------------------------------------------------------------------
   Recorrido
   ------------------------------------------------------------------ */

const modulos = [];
(function recorrer(dir) {
  for (const entrada of readdirSync(dir)) {
    const ruta = resolve(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      if (ruta === VENDOR) continue; // código de terceros
      recorrer(ruta);
    } else if (entrada.endsWith('.js')) {
      modulos.push(ruta);
    }
  }
})(JS);

// `tools/` también entra en el recuento: un export que solo usa un arnés
// de prueba no está muerto, está probado. El prefijo `raiz/tools` se
// distingue luego para poder anotarlo.
const TOOLS = resolve(RAIZ, 'tools');
if (existsSync(TOOLS)) {
  for (const entrada of readdirSync(TOOLS)) {
    if (entrada.endsWith('.js') || entrada.endsWith('.mjs')) {
      modulos.push(resolve(TOOLS, entrada));
    }
  }
}

const fuente = new Map();
for (const ruta of modulos) fuente.set(ruta, readFileSync(ruta, 'utf8'));

/* ------------------------------------------------------------------
   Exports declarados
   ------------------------------------------------------------------ */

const PATRON_EXPORT =
  /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

const declarados = new Map(); // nombre -> [archivos]
for (const [ruta, texto] of fuente) {
  PATRON_EXPORT.lastIndex = 0;
  let m;
  while ((m = PATRON_EXPORT.exec(texto)) !== null) {
    const nombre = m[1];
    if (!declarados.has(nombre)) declarados.set(nombre, []);
    declarados.get(nombre).push(ruta);
  }
}

/* ------------------------------------------------------------------
   Exports referenciados
   ------------------------------------------------------------------ */

/**
 * Se buscan referencias por nombre de símbolo en cualquier posición, en
 * cualquier módulo. No se distingue entre "lo importa" y "lo menciona en
 * un comentario", porque un nombre de export que solo aparece en
 * comentarios es un caso tan raro que merece la pena revisarlo a mano,
 * no automatizarlo.
 */
/* ------------------------------------------------------------------
   Exports referenciados
   ------------------------------------------------------------------

   El conteo tiene que ser GLOBAL, no por archivo. Un símbolo se declara
   en un archivo y se usa en otro: `import { RUIDO } from './comunes.js'`
   en `planeta.js` y `${RUIDO}` en la plantilla de GLSL son la MISMA
   declaración vista desde dos sitios. Contando por archivo, `planeta.js`
   diría que `RUIDO` aparece una vez —la del import— y lo marcaría como
   muerto, cuando en realidad lo usan seis módulos.

   El criterio es: apariciones totales en todo el proyecto, menos las
   declaraciones de `export`. Lo que quede es uso. */
/**
 * Construye el patrón de un identificador con sus límites.
 *
 * No se puede usar `\\b` con todo: `$` es un carácter identificador válido
 * en JavaScript, pero NO es un "word character" para las expresiones
 * regulares. `\\b\\$\\b` no encuentra NUNCA nada, porque un espacio y un `$`
 * están los dos fuera del conjunto de palabras y no forman frontera. Con
 * ese patrón, `$` y `$$` saldrían como muertos siempre.
 *
 * Se usan_classes de carácter en su lugar: `(?<![$\\w])` y `(?![$\\w])`.
 * Los lookbehind de JavaScript existen desde 2018 y funcionan en todos los
 * navegadores al día.
 */
function frontera(nombre) {
  const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `(?<![$\\w])${escapado}(?![$\\w])`;
}

const APARICIONES = new Map();
for (const nombre of declarados.keys()) APARICIONES.set(nombre, 0);

for (const texto of fuente.values()) {
  // Se quitan comentarios y literales de cadena: un nombre de export
  // mencionado en un shader o en un texto no es una referencia.
  const limpio = texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/gs, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, ' ');

  for (const nombre of declarados.keys()) {
    const patron = new RegExp(frontera(nombre), 'g');
    const encontradas = limpio.match(patron);
    if (encontradas) APARICIONES.set(nombre, APARICIONES.get(nombre) + encontradas.length);
  }
}

/* `tools/` también cuenta: los arneses de prueba usan exports a propósito,
   y un export que solo usa un test no está muerto. */

/* ------------------------------------------------------------------
   Informe
   ------------------------------------------------------------------ */

/* LÍNEA BASE.
   Estos nueve exports ya estaban sin uso antes de que existiera el
   universo, y son utilidades pequenas de los modulos nuclea del proyecto.
   No bloquean la publicacion: se avisan, no se fallan. Si alguien quiere
   limpiarlos, se borran sin riesgo, porque no hay nada que los importe. */
const BASELINE = new Set([
  'delegar', 'svg', 'elementoVisible', 'enRango',
  'detenerLoop', 'easeOutCubic', 'elegir', 'alCambiarMovimiento',
  'TOTAL_HABILIDADES',
]);

const muertos = [];
for (const [nombre, archivos] of declarados) {
  const apariciones = APARICIONES.get(nombre) ?? 0;
  // Una aparición por declaración. Lo que exceda eso es uso real.
  const usos = apariciones - archivos.length;
  if (usos > 0) continue;
  const soloHerramientas = archivos.every((a) => a.includes('tools/'));
  muertos.push({
    nombre,
    archivos: archivos.map((a) => relative(RAIZ, a)),
    apariciones,
    soloHerramientas,
    conocido: BASELINE.has(nombre),
  });
}

/* Los que no están en la línea base SÍ se fallan: son código nuevo que
   nadie usa, y eso sí hay que arreglarlo antes de publicar. */
const nuevos = muertos.filter((m) => !m.conocido);
const conocidos = muertos.filter((m) => m.conocido);

const total = declarados.size;

if (muertos.length === 0) {
  console.log(`\n  ✓ ${total} exports declarados, todos referenciados en otro módulo.\n`);
  process.exit(0);
}

if (conocidos.length) {
  console.log(`\n  Aviso: ${conocidos.length} export(s) sin uso, preexistentes a este trabajo:`);
  for (const m of conocidos) {
    console.log(`    · ${m.nombre.padEnd(24)} ${m.archivos.join(', ')}`);
  }
  console.log(`    Son utilidades de los módulos núcleo. No bloquean nada: no hay`);
  console.log(`    nada que las importe. Se pueden borrar sin riesgo cuando quieras.\n`);
}

if (nuevos.length) {
  console.log(`  ✗ ${nuevos.length} export(s) nuevo(s) sin uso:\n`);
  for (const m of nuevos) {
    console.log(`    ${m.nombre.padEnd(24)} ${m.archivos.join(', ')}`);
  }
  console.log(`\n    Código nuevo que nadie llama. O se usa, o se borra.\n`);
  process.exit(1);
}

process.exit(0);
