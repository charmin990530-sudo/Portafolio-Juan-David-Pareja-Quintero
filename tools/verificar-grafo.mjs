/**
 * tools/verificar-grafo.mjs — ¿Llega todo el código a donde debe?
 *
 * `verificar-texto.mjs` comprueba que los imports que VE en el código
 * resuelven. Esto va un paso más allá: parte de `main.js` y sigue el grafo
 * de imports real, incluidos los `import()` dinámicos entre paréntesis,
 * que el otro no ve porque no son sentencias de nivel superior.
 *
 * Comprueba tres cosas:
 *   1. Todo lo que se importa existe.
 *   2. Los tres.js que se necesitan se referencian con la versión correcta.
 *   3. Todo módulo alcanzable desde `main.js` se puede analizar.
 *
 * Ejecutar: node tools/verificar-grafo.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = resolve(RAIZ, 'assets/js/main.js');

const problemas = [];
const vistos = new Set();
const versiones = new Map();

/** Cubre import estático, export from e import() dinámico. */
const IMPORT_ESTATICO = /(?:^|\n)\s*import\s+(?:[\s\S]*?\s+from\s+)?'([^']+)'/g;
const IMPORT_DINAMICO = /\bimport\(\s*'([^']+)'\s*\)/g;
const EXPORT_DESDE = /(?:^|\n)\s*export\s+(?:[\s\S]*?\s+from\s+)?'([^']+)'/g;

function recorrer(archivo) {
  if (vistos.has(archivo)) return;
  vistos.add(archivo);

  if (!existsSync(archivo)) {
    problemas.push(`No existe: ${relative(RAIZ, archivo)}`);
    return;
  }

  /* Se quitan los comentarios ANTES de buscar imports. Una ruta citada en
     un comentario —`import { X } from './otro.js'` como ejemplo— no es un
     import, y sin esto el verificador la toma por una ruta rota. */
  const fuente = readFileSync(archivo, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1\n');

  const patrones = [IMPORT_ESTATICO, IMPORT_DINAMICO, EXPORT_DESDE];

  for (const patron of patrones) {
    patron.lastIndex = 0;
    let coincidencia;
    while ((coincidencia = patron.exec(fuente)) !== null) {
      const especificacion = coincidencia[1];
      if (!especificacion.startsWith('.')) continue;

      const destino = resolve(dirname(archivo), especificacion);

      // Las rutas versionadas de los paquetes vendorizados se comprueban
      // aparte, porque llevan la versión en la propia ruta.
      if (especificacion.includes('/vendor/')) {
        const partes = especificacion.split('/');
        const paquete = partes[partes.indexOf('vendor') + 1];
        const version = partes[partes.indexOf('vendor') + 2];
        const actual = versiones.get(paquete);
        if (actual && actual !== version) {
          problemas.push(
            `Versiones mezcladas de "${paquete}": ${actual} y ${version} (en ${relative(RAIZ, archivo)})`,
          );
        }
        versiones.set(paquete, version);
      }

      recorrer(destino);
    }
  }
}

recorrer(ENTRADA);

/* ------------------------------------------------------------------
   Informe
   ------------------------------------------------------------------ */

const porCarpeta = new Map();
for (const archivo of vistos) {
  const rel = relative(RAIZ, archivo);
  const carpeta = rel.includes('assets/js/') ? rel.split('assets/js/')[1].split('/')[0] : 'raíz';
  porCarpeta.set(carpeta, (porCarpeta.get(carpeta) ?? 0) + 1);
}

console.log(`\nGrafo desde main.js: ${vistos.size} módulos alcanzables.\n`);
for (const [carpeta, cantidad] of [...porCarpeta].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(cantidad).padStart(3)}  ${carpeta}`);
}

console.log('\n  Paquetes vendorizados:');
for (const [paquete, version] of versiones) console.log(`    ${paquete} ${version}`);

if (problemas.length) {
  console.log(`\n  ✗ ${problemas.length} problema(s):\n`);
  for (const problema of problemas) console.log(`    ${problema}`);
  console.log('');
  process.exit(1);
}

console.log('\n  ✓ Todos los imports resuelven y las versiones son coherentes.\n');
