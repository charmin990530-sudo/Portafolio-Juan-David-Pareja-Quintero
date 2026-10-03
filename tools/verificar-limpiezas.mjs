#!/usr/bin/env node
/**
 * tools/verificar-limpiezas.mjs — Que todo `montar*` devuelva su limpieza.
 *
 *   node tools/verificar-limpiezas.mjs
 *
 * EL DEFECTO QUE ESTA COMPROBACIÓN EXISTE PARA CAZAR
 *
 * El sitio tiene una regla: cada `montar*` devuelve una función de limpieza y
 * `main.js` la llama en `pagehide`. La regla estaba escrita y se incumplía en la
 * mitad del sitio, y ninguna de las diez comprobaciones lo detectaba, porque
 * todas son estáticas y esta fuga solo se ve en ejecución.
 *
 * Los tres fallos que aparecieron, y que ninguna comprobación veía:
 *
 *   1. `proceso.js` devolvía `{ irAProgreso, avance }`. Nadie usaba ninguna de
 *      las dos, así que no se notaba. `main.js` la metía en su lista de
 *      limpiezas, la invocaba, recibía un objeto y el `TypeError` lo tragaba
 *      su propio `catch`. Solo pasaba al descargar la página.
 *
 *   2. `hero.js` y `montarMarquesina` no devolvían NADA. `limpieza?.()` sobre
 *      `undefined` es inocuo, así que tampoco había error: el paralaje seguía
 *      escribiendo `transform` en el aura y la cinta seguía duplicada.
 *
 *   3. `fondo.js` llamaba a `alFotograma(cuadro)` sin guardar la baja. El
 *      suscriptor se quedaba en el `Set` de `core/loop.js` para siempre, así
 *      que tras un remontaje el lienzo se dibujaba dos veces por fotograma.
 *
 * El patrón común: **un fallo que se silencia no se arregla, se propaga.**
 *
 * ── LAS TRES REGLAS ───────────────────────────────────────────────────
 *
 *   · `alFotograma(...)` siempre conserva su baja. Si la llamada es una
 *     sentencia suelta, la baja se pierde y el fotograma no se puede quitar.
 *
 *   · Ni `addEventListener` ni `removeEventListener` con una flecha o una
 *     función en línea como manejador. `removeEventListener` compara por
 *     identidad: quitar una flecha que no es la misma que se registró no
 *     quita nada, y es el fallo más silencioso de los tres porque ni siquiera
 *     lanza. Para eso está `on()` de `core/dom.js`, que devuelve la baja.
 *
 *   · Todo `export function montar*` de `assets/js/modules/` devuelve una
 *     función en algún `return`.
 *
 * ── LAS EXCEPCIONES, Y POR QUÉ EXISTEN ─────────────────────────────────
 *
 *   · `core/loop.js` queda fuera de las dos primeras reglas. Es el módulo
 *     que ES el bucle: su escuchador de `visibilitychange` y su suscripción
 *     consigo mismo viven hasta que se cierra la página, que es exactamente
 *     lo que se supone que tiene que pasar. No hay ciclo de vida que
 *     respetar porque no hay nada que lo desmonte.
 *
 *   · Un manejador en línea con `{ once: true }` sí se acepta: se retira solo
 *     al dispararse, que es lo que dice la opción. `core/util.js:esperar()`
 *     usa ese patrón a propósito.
 *
 *   · `preloader.js` queda fuera de la tercera regla. Su contrato es otro y
 *     está documentado: devuelve una `Promise` porque `main.js` la espera
 *     antes de montar nada. No está en la lista de limpiezas porque no es
 *     una limpieza, y exigirle una sería un falso positivo.
 *
 * ── LO QUE ESTA COMPROBACIÓN NO PUEDE HACER ────────────────────────────
 *
 * Es una lectura línea a línea, así que solo ve el manejador que empieza en
 * la misma línea que la llamada: un `addEventListener` partido en varias
 * líneas se le escapa. Y no puede saber si una baja guardada se llega a
 * llamar de verdad: que `const baja = alFotograma(x)` se use o no en la
 * limpieza es una pregunta de ejecución, y para eso está `probar-dom.mjs`.
 *
 * Lo que sí es de esta comprobación y no de otra: un módulo que registra de
 * más sigue registrando de más, pero la puerta para deshacerlo existe y no
 * se ha perdido en el camino.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Archivos `.js` sueltos de una carpeta. Los subdirectorios no se bajan. */
function archivos(carpetas) {
  const salida = [];
  for (const carpeta of carpetas) {
    let entradas;
    try {
      entradas = readdirSync(join(RAIZ, carpeta), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entrada of entradas) {
      if (entrada.isFile() && entrada.name.endsWith('.js')) {
        salida.push(join(carpeta, entrada.name));
      }
    }
  }
  return salida;
}

const CODIGO = archivos(['assets/js/core', 'assets/js/modules', 'assets/js/universo']);
const MODULOS = archivos(['assets/js/modules']);

/** El módulo que ES el bucle: sin ciclo de vida, sin excepciones que hacer. */
const SIN_CICLO_VIDA = new Set([join('assets/js', 'core', 'loop.js')]);

/** Contratos distintos al de `montar*`, con el motivo escrito. */
const CONTRATO_OTRO = new Map([['preloader.js', 'devuelve una Promise: `main.js` la espera antes de montar nada']]);

const fallos = [];

/**
 * Quita comentarios conservando el número de línea.
 *
 * El texto del comentario se reemplaza por espacios en vez de borrarse, para
 * que los avisos sigan apuntando a la línea que de verdad tiene el problema.
 * Esto importa porque estos propios comentarios mencionan `addEventListener`
 * y `alFotograma` al explicar por qué están prohibidos: si no se quitaran,
 * la comprobación se detectaría a sí misma.
 */
function lineasSinComentarios(fuente) {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((linea) => linea.replace(/\/\/.*$/, ''));
}

/** Ventana de líneas a partir de `indice`, para leer llamadas partidas. */
function ventana(lineas, indice, alcance = 8) {
  return lineas.slice(indice, indice + alcance).join('\n');
}

/* ── REGLA 1 · `alFotograma` conserva su baja ────────────────────────── */
for (const archivo of CODIGO) {
  if (SIN_CICLO_VIDA.has(archivo)) continue;

  const lineas = lineasSinComentarios(readFileSync(join(RAIZ, archivo), 'utf8'));

  lineas.forEach((texto, indice) => {
    const llamada = texto.search(/\balFotograma\s*\(/);
    if (llamada === -1) return;
    // La definición de la función no es una llamada.
    if (/function\s+$/.test(texto.slice(0, llamada))) return;

    const antes = texto.slice(0, llamada);
    // Se conserva si el valor se asigna, se guarda en un push o se devuelve.
    if (/[=,(]\s*$/.test(antes)) return;

    fallos.push({
      regla: 'alFotograma sin baja',
      archivo,
      linea: indice + 1,
      detalle: 'la llamada se descarta: la baja se pierde y el fotograma no se puede quitar',
    });
  });
}

/* ── REGLA 2 · ningún escuchador con manejador en línea irretirable ───── */
for (const archivo of CODIGO) {
  if (SIN_CICLO_VIDA.has(archivo)) continue;

  const lineas = lineasSinComentarios(readFileSync(join(RAIZ, archivo), 'utf8'));

  lineas.forEach((texto, indice) => {
    const enLinea = /(add|remove)EventListener\(\s*(['"`][^'"`]*['"`]|evento)\s*,\s*(\(|function\b|async\b)/;
    if (!enLinea.test(texto)) return;

    /* `{ once: true }` se retira solo al dispararse. La opción suele ir
       unas líneas más abajo que el manejador, porque el manejador es un
       bloque: se mira la llamada entera y no solo la primera línea. */
    if (/once\s*:\s*true/.test(ventana(lineas, indice))) return;

    fallos.push({
      regla: 'escuchador irretirable',
      archivo,
      linea: indice + 1,
      detalle:
        'el manejador es una flecha o una función en línea: `removeEventListener` ' +
        'compara por identidad y no retirará nada. Usa `on()` de `core/dom.js`.',
    });
  });
}

/* ── REGLA 3 · todo `montar*` devuelve una función ────────────────────── */
for (const archivo of MODULOS) {
  const nombre = archivo.split('/').pop();
  if (CONTRATO_OTRO.has(nombre)) continue;

  const fuente = readFileSync(join(RAIZ, archivo), 'utf8');
  const montadores = [...fuente.matchAll(/export function (montar\w+)\s*\(/g)];
  if (!montadores.length) continue;

  // Basta con que el archivo tenga un `return` que produzca una función. No
  // se comprueba que sea el camino de todos los caminos: para eso hay que
  // ejecutarlo, que es lo que hace `probar-dom.mjs`.
  if (/return\s*(\(\s*\)|function\b)/.test(fuente)) continue;

  for (const [, nombreMontador] of montadores) {
    fallos.push({
      regla: 'montar* sin limpieza',
      archivo,
      linea: 0,
      detalle:
        `\`${nombreMontador}()\` no devuelve ninguna función de limpieza. Si devuelve ` +
        '`undefined`, `main.js` la invoca sin efecto; si devuelve un objeto, ' +
        '`main.js` recibe un `TypeError` que su propio `catch` silencia.',
    });
  }
}

/* ── Salida ───────────────────────────────────────────────────────────── */

const titulo = 'Limpiezas y escuchadores';

if (!fallos.length) {
  console.log(`\n  ✓ ${titulo}`);
  console.log('    Todo "montar*" devuelve su función de limpieza, ninguna baja de');
  console.log('    fotograma se descarta y ningún escuchador es irretirable.');
  console.log(`    ${CODIGO.length} archivos revisados.\n`);
  process.exit(0);
}

console.log(`\n  ✗ ${titulo}: ${fallos.length} problema(s)\n`);

for (const fallo of fallos) {
  const ruta = relative(RAIZ, join(RAIZ, fallo.archivo));
  const donde = fallo.linea ? `${ruta}:${fallo.linea}` : ruta;
  console.log(`    [${fallo.regla}] ${donde}`);
  console.log(`      ${fallo.detalle}`);
}

console.log('');
process.exit(1);