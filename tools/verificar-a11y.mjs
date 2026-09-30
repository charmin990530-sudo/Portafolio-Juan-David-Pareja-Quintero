/**
 * tools/verificar-a11y.mjs — Accesibilidad y SEO, en lo que se puede ver
 * sin navegador.
 *
 * NO sustituye a Lighthouse ni a un lector de pantalla. Comprueba lo
 * verificable sobre el HTML y el CSS: la estructura de encabezados, los
 * nombres accesibles de los controles, el contraste declarado, la
 * jerarquía de títulos y los datos de SEO.
 *
 * Lo que NO comprueba, y hay que medir en el navegador: el orden real de
 * tabulación, si el foco se ve, si el texto de un panel se lee bien
 * sobre el planeta que tiene detrás, y el contraste real compuesto de un
 * texto sobre una escena 3D en movimiento.
 *
 * Ejecutar: node tools/verificar-a11y.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');
const css = readFileSync(resolve(RAIZ, 'assets/css/01-tokens.css'), 'utf8');

const fallos = [];
const avisos = [];
const avisosPorId = [];

/* ------------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------------ */

const sinComments = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script[\s\S]*?<\/script>/g, '');

/** Contraste relativo de un color #rrggbb sobre otro. */
function luminancia(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const canales = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

function contraste(a, b) {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function token(nombre, porDefecto) {
  const m = css.match(new RegExp(`${nombre}:\\s*(#[0-9a-fA-F]{3,8})`));
  return m ? m[1] : porDefecto;
}

/* ------------------------------------------------------------------
   1. Estructura de encabezados
   ------------------------------------------------------------------ */

const encabezados = [...sinComments.matchAll(/<h([1-6])\b[^>]*>/g)].map((m) => Number(m[1]));
const h1 = encabezados.filter((n) => n === 1).length;

if (h1 === 0) fallos.push('No hay ningún <h1>. Cada página necesita exactamente uno.');
if (h1 > 1) fallos.push(`Hay ${h1} <h1>. Debería haber uno solo.`);

let anterior = 0;
let saltos = [];
for (const nivel of encabezados) {
  if (anterior && nivel > anterior + 1) saltos.push(`${anterior}→${nivel}`);
  anterior = nivel;
}
if (saltos.length) {
  fallos.push(`Saltos en la jerarquía de encabezados: ${saltos.join(', ')}. Un lector de pantalla que navegue por encabezados se pierde.`);
}

if (!/<h1[^>]*>[\s\S]{0,40}Juan David/.test(sinComments)) {
  fallos.push('El <h1> no contiene el nombre. Es lo que se lee primero y lo que se indexa.');
}

/* ------------------------------------------------------------------
   2. Landmarks y estructura
   ------------------------------------------------------------------ */

if (!/<main\b/.test(sinComments)) fallos.push('Falta <main>. Sin él no hay la región de contenido principal.');
if (!/<header\b/.test(sinComments)) fallos.push('Falta <header>.');
if (!/<footer\b/.test(sinComments)) fallos.push('Falta <footer>.');
if (!/<nav\b/.test(sinComments)) avisos.push('No hay ningún <nav> en el HTML. El HUD crea uno, pero en vista simple no habría navegación semántica.');
if (!/aria-label="Navegación principal"/.test(sinComments)) avisos.push('El <nav> principal no tiene nombre accesible.');

/* ------------------------------------------------------------------
   3. Controles con nombre accesible
   ------------------------------------------------------------------ */

const botones = [...sinComments.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
for (const [, atributos, contenido] of botones) {
  const tieneAria = /aria-label\s*=/.test(atributos);
  const tieneTexto = contenido.replace(/<[^>]+>/g, '').trim().length > 0;
  if (!tieneAria && !tieneTexto) {
    fallos.push(`Un <button> sin nombre accesible: ${atributos.trim().slice(0, 70)}`);
  }
}

// Los inputs con etiqueta
for (const m of sinComments.matchAll(/<input\b([^>]*)>/g)) {
  const atributos = m[1];
  if (/type="hidden"/.test(atributos)) continue;
  const id = atributos.match(/id="([^"]+)"/)?.[1];
  const tieneLabel = id && new RegExp(`<label[^>]*for="${id}"`).test(sinComments);
  const tieneAria = /aria-label\s*=/.test(atributos);
  if (!tieneLabel && !tieneAria) {
    fallos.push(`Un <input> sin etiqueta asociada: ${atributos.trim().slice(0, 70)}`);
  }
}

/* ------------------------------------------------------------------
   4. Imágenes con alt
   ------------------------------------------------------------------ */

for (const m of sinComments.matchAll(/<img\b([^>]*)>/g)) {
  const atributos = m[1];
  if (!/\balt\s*=/.test(atributos)) {
    fallos.push(`Una <img> sin alt: ${atributos.trim().slice(0, 70)}`);
  }
  // Un alt="" en una imagen decorativa está bien; una falta de alt no.
}

/* ------------------------------------------------------------------
   5. Contraste de los tokens de texto
   ------------------------------------------------------------------ */

const fondo = token('--space-900', '#05070f');
const pares = [
  ['--ink-100', 'texto principal', 4.5],
  ['--ink-200', 'texto fuerte', 4.5],
  ['--ink-300', 'texto secundario', 4.5],
  ['--ink-400', 'texto atenuado', 4.5],
  ['--cyan', 'acento', 3],
  ['--violet', 'acento 2', 3],
  ['--solar', 'acento 3', 3],
  ['--lime', 'estado disponible', 3],
];

console.log(`\nContraste sobre --space-900 (${fondo}):\n`);
for (const [nombre, uso, minimo] of pares) {
  const color = token(nombre, null);
  if (!color) continue;
  const c = contraste(color, fondo);
  const ok = c >= minimo;
  console.log(
    `  ${ok ? '✓' : '✗'} ${nombre.padEnd(12)} ${color.padEnd(9)} ${c.toFixed(2)}:1` +
      `  (mínimo ${minimo}:1)  ${uso}`,
  );
  if (!ok) fallos.push(`Contraste insuficiente: ${nombre} (${color}) da ${c.toFixed(2)}:1 sobre el fondo, necesita ${minimo}:1`);
}

/* ------------------------------------------------------------------
   6. Foco visible
   ------------------------------------------------------------------ */

const todoCss = ['00-fonts', '01-tokens', '02-base', '03-components', '04-animations', '05-sections', '06-universo']
  .map((f) => readFileSync(resolve(RAIZ, `assets/css/${f}.css`), 'utf8'))
  .join('\n');

const focusVisible = (todoCss.match(/:focus-visible/g) ?? []).length;
if (focusVisible === 0) {
  fallos.push('No hay ninguna regla :focus-visible. Sin ella el foco del teclado es invisible.');
} else {
  console.log(`\n  ✓ ${focusVisible} reglas :focus-visible en el CSS`);
}

/* ------------------------------------------------------------------
   7. Movimiento reducido
   ------------------------------------------------------------------ */

if (!/prefers-reduced-motion/.test(todoCss)) {
  fallos.push('No se respeta prefers-reduced-motion en el CSS.');
} else {
  const usos = (todoCss.match(/prefers-reduced-motion/g) ?? []).length;
  console.log(`  ✓ prefers-reduced-motion respetado en ${usos} sitios`);
}
if (!/prefers-reduced-motion/.test(readFileSync(resolve(RAIZ, 'assets/js/core/util.js'), 'utf8'))) {
  fallos.push('El JavaScript no consulta prefers-reduced-motion.');
}

/* ------------------------------------------------------------------
   8. SEO
   ------------------------------------------------------------------ */

console.log('');
const seo = [
  ['<title>', /<title>[^<]{10,}<\/title>/, 'El título debe tener entre 10 y 60 caracteres.'],
  ['meta description', /name="description"\s+content="[^"]{50,200}"/, 'La descripción debe tener entre 50 y 200 caracteres.'],
  ['lang', /<html lang="es"/, 'Falta lang en el <html>.'],
  ['viewport', /name="viewport"/, 'Falta la meta viewport.'],
  ['og:title', /property="og:title"/, 'Falta og:title.'],
  ['og:description', /property="og:description"/, 'Falta og:description.'],
  ['og:image', /property="og:image"/, 'Falta og:image. Sin él la tarjeta social sale vacía.'],
  ['og:image:width', /property="og:image:width"/, 'Faltan las dimensiones de og:image.'],
  ['twitter:card', /name="twitter:card"/, 'Falta twitter:card.'],
  ['JSON-LD', /application\/ld\+json/, 'Faltan los datos estructurados.'],
  ['theme-color', /name="theme-color"/, 'Falta theme-color.'],
  ['canonical', /rel="canonical"/, 'Falta el enlace canonical.'],
];

for (const [nombre, patron, mensaje] of seo) {
  if (patron.test(html)) {
    console.log(`  ✓ ${nombre}`);
  } else {
    const esOpcional = nombre === 'canonical';
    if (esOpcional) avisosPorId.push(mensaje);
    else fallos.push(mensaje);
  }
}

// El título no debería estar truncado por el navegador.
const titulo = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
if (titulo.length > 60) avisos.push(`El título tiene ${titulo.length} caracteres; por encima de 60 Google lo recorta.`);

/* ------------------------------------------------------------------
   9. Enlazado interno
   ------------------------------------------------------------------ */

const ids = new Set([...sinComments.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const anclas = [...sinComments.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const rotas = [...new Set(anclas.filter((a) => a && !ids.has(a)))];
if (rotas.length) fallos.push(`Anclas internas rotas: ${rotas.map((a) => `#${a}`).join(', ')}`);
else console.log(`  ✓ ${anclas.length} enlaces internos, ninguno roto`);

/* ------------------------------------------------------------------
   Informe
   ------------------------------------------------------------------ */

if (avisosPorId.length) {
  console.log('\nPendiente:');
  for (const a of avisosPorId) console.log(`  · ${a}`);
}
if (avisos.length) {
  console.log('\nAvisos:');
  for (const a of avisos) console.log(`  · ${a}`);
}

if (fallos.length === 0) {
  console.log('\n  ✓ Sin fallos de accesibilidad ni de SEO detectables en el HTML.\n');
  process.exit(0);
}

console.log(`\n  ✗ ${fallos.length} fallo(s):\n`);
for (const f of fallos) console.log(`    ${f}`);
console.log('');
process.exit(1);
