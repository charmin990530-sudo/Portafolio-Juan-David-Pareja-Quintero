#!/usr/bin/env node
/**
 * tools/comprobar.mjs — Pasa todas las comprobaciones del proyecto.
 *
 *   node tools/comprobar.mjs
 *
 * Sale con código 1 si algo falla, así que vale como puerta antes de
 * publicar y en integración continua.
 *
 * Son comprobaciones ESTÁTICAS y de LÓGICA. No sustituyen a abrir el
 * sitio: el framerate real, el aspecto sobre el planeta y el orden de
 * tabulación hay que mirarlos en un navegador.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const COMPROBACIONES = [
  ['Texto, rutas y sintaxis', 'verificar-texto.mjs'],
  ['Grafo de imports', 'verificar-grafo.mjs'],
  ['Contenido conservado', 'verificar-contenido.mjs'],
  ['Accesibilidad y SEO', 'verificar-a11y.mjs'],
  ['Exports sin uso', 'verificar-exports.mjs'],
  ['Sistema de calidad', 'probar-calidad.mjs'],
  ['Ruta y cámara', 'probar-ruta.mjs'],
];

console.log('\n════════════════════════════════════════════════════════════');
console.log('  COMPROBACIONES');
console.log('════════════════════════════════════════════════════════════\n');

let fallos = 0;
let advertencias = 0;

for (const [nombre, archivo] of COMPROBACIONES) {
  const proceso = spawnSync(process.execPath, [resolve(RAIZ, 'tools', archivo)], {
    cwd: RAIZ,
    encoding: 'utf8',
  });

  const salida = (proceso.stdout ?? '') + (proceso.stderr ?? '');
  const esFallo = proceso.status !== 0;
  const esAviso = /sin uso|sin usos/.test(salida) && !esFallo;

  if (esFallo) fallos += 1;
  if (esAviso) advertencias += 1;

  const marca = esFallo ? '✗' : esAviso ? '!' : '✓';
  const clase = esFallo ? 'FALLA' : esAviso ? 'AVISO' : 'pasa';
  console.log(`  ${marca} ${nombre.padEnd(26)} ${clase}`);

  // Se muestran los detalles solo si hay algo que mirar.
  if (esFallo || esAviso) {
    const detalle = salida
      .split('\n')
      .filter((l) => /^\s{2,}[✗!]/.test(l) || /^\s{4}[·•]/.test(l))
      .slice(0, esFallo ? 14 : 4);
    for (const linea of detalle) console.log(`      ${linea.trim()}`);
    if (detalle.length >= 4 && !esFallo) {
      console.log(`      … y ${salida.split('\n').filter((l) => /^\s{4}[·•]/.test(l)).length - 4} más`);
    }
  }
}

console.log('\n════════════════════════════════════════════════════════════');

if (fallos === 0 && advertencias === 0) {
  console.log('  Todo pasa.\n');
  process.exit(0);
}

console.log(
  `  ${fallos === 0 ? 'Sin fallos' : `${fallos} comprobación(es) fallan`}` +
    `${advertencias ? `, ${advertencias} con avisos` : ''}.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
