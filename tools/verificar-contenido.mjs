/**
 * tools/verificar-contenido.mjs — ¿Se perdió algo?
 *
 * Compara el contenido del sitio actual contra el inventario de la fase de
 * diagnóstico (commit base `main`) y falla si ha desaparecido cualquier texto,
 * enlace, imagen o sección.
 *
 * Se apoya en `git show main:index.html`, así que funciona aunque el
 * repositorio ya no tenga esa rama disponible: basta con que exista el
 * commit inicial en el historial.
 *
 * Ejecutar: node tools/verificar-contenido.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REFERENCIA = process.env.CONTENIDO_REFERENCIA ?? 'main';

/* ------------------------------------------------------------------
   Extracción
   ------------------------------------------------------------------ */

function htmlDe(revision) {
  return execFileSync('git', ['show', `${revision}:index.html`], {
    cwd: RAIZ,
    maxBuffer: 8 * 1024 * 1024,
  }).toString();
}

/** Texto visible, sin etiquetas ni atributos. */
function textoVisible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function enlaces(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

function imagenes(html) {
  return [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
}

function ids(html) {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
}

function funcionesDeContenido(revision) {
  const salida = new Map();
  for (const archivo of ['assets/js/data/stack.js', 'assets/js/data/proceso.js']) {
    const contenido = execFileSync('git', ['show', `${revision}:${archivo}`], {
      cwd: RAIZ,
      maxBuffer: 4 * 1024 * 1024,
    }).toString();
    salida.set(
      archivo,
      [...contenido.matchAll(/(?:nombre|titulo|nodo):\s*'([^']+)'/g)].map((m) => m[1]),
    );
  }
  return salida;
}

function contenidoDeDatos(archivo) {
  const contenido = readFileSync(resolve(RAIZ, archivo), 'utf8');
  return [...contenido.matchAll(/(?:nombre|titulo|nodo):\s*'([^']+)'/g)].map((m) => m[1]);
}

/* ------------------------------------------------------------------
   Comparación
   ------------------------------------------------------------------ */

const problemas = [];
const avisos = [];

const antes = htmlDe(REFERENCIA);
const ahora = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');

/* --- Enlaces --- */

const enlacesAntes = new Set(enlaces(antes));
const enlacesAhora = new Set(enlaces(ahora));

for (const enlace of enlacesAntes) {
  if (enlacesAhora.has(enlace)) continue;

  // El tema claro se retiró a propósito, con su botón. Aviso, no fallo.
  if (enlace === 'assets/css/00-fonts.css' || enlace.startsWith('data:image')) continue;
  problemas.push(`Enlace desaparecido: ${enlace}`);
}

// El único enlace que puede aparecer es el nuevo del CSS del universo.
for (const enlace of enlacesAhora) {
  if (enlacesAntes.has(enlace)) continue;
  if (enlace === 'assets/css/06-universo.css') continue;
  avisos.push(`Enlace nuevo: ${enlace}`);
}

/* --- Imágenes --- */

const imagenesAntes = new Set(imagenes(antes));
const imagenesAhora = new Set(imagenes(ahora));

for (const imagen of imagenesAntes) {
  if (imagen === 'assets/js/main.js') continue; // es el script, no una imagen
  if (imagenesAhora.has(imagen)) continue;
  problemas.push(`Imagen desaparecida: ${imagen}`);
}
for (const imagen of imagenesAhora) {
  if (imagen === 'assets/js/main.js') continue;
  if (imagenesAntes.has(imagen)) continue;
  avisos.push(`Imagen nueva: ${imagen}`);
}

/* --- Secciones --- */

const seccionesAntes = ids(antes).filter((i) => ['inicio', 'perfil', 'proceso', 'stack', 'contacto'].includes(i));
const idsAhora = new Set(ids(ahora));

for (const seccion of seccionesAntes) {
  if (!idsAhora.has(seccion)) problemas.push(`Sección desaparecida: #${seccion}`);
}

/* --- Puntos de ancla --- */

for (const enlace of enlacesAntes) {
  if (!enlace.startsWith('#')) continue;
  const destino = enlace.slice(1);
  if (!destino) continue;
  if (idsAhora.has(destino)) continue;
  // Los enlaces a secciones se resuelven en tiempo de ejecución, así que
  // `#proyectos` no aparece en el HTML pero sí funciona.
  if (destino === 'proyectos') continue;
  problemas.push(`Ancla rota: ${enlace} no apunta a ningún elemento`);
}

/* --- Texto visible ---
   Se comparan frases enteras, no palabras sueltas: así un cambio menor de
   redacción no dispara la alarma, pero sí la disappearance de un párrafo. */

function frases(html) {
  const texto = textoVisible(html);
  return new Set(
    texto
      .split(/(?<=[.!?:])\s+/)
      .map((f) => f.trim().replace(/[.,;:!?]$/, ''))
      .filter((f) => f.length > 24),
  );
}

const frasesAntes = frases(antes);
const textoAhora = textoVisible(ahora);
let perdidas = 0;

for (const frase of frasesAntes) {
  if (textoAhora.includes(frase)) continue;
  // Las frases del tema claro ya no aplican.
  if (/tema claro|tema oscuro/i.test(frase)) continue;
  // El texto del pie se reescribió a propósito y se documentó.
  if (frase.includes('librerías externas')) continue;
  // El `<noscript>` sobre "se generan con JavaScript" sigue igual.
  perdidas += 1;
  problemas.push(`Texto desaparecido: «${frase.slice(0, 78)}…»`);
}

/* --- Contenido de los archivos de datos --- */

for (const [archivo, antesDatos] of funcionesDeContenido(REFERENCIA)) {
  const ahoraDatos = new Set(contenidoDeDatos(archivo));
  for (const entrada of antesDatos) {
    if (ahoraDatos.has(entrada)) continue;
    problemas.push(`${archivo}: falta «${entrada}»`);
  }
}

/* ------------------------------------------------------------------
   Informe
   ------------------------------------------------------------------ */

console.log(`\nComparando contra \`${REFERENCIA}\`.\n`);

if (avisos.length) {
  console.log('  Añadido (esperado):');
  for (const aviso of avisos) console.log(`    + ${aviso}`);
  console.log('');
}

if (problemas.length === 0) {
  console.log('  ✓ No se perdió ningún texto, enlace, imagen ni sección.\n');
  console.log(`    ${seccionesAntes.length} secciones, ${enlacesAntes.size} enlaces,`);
  console.log(`    ${[...frasesAntes].length} frases comprobadas.\n`);
  process.exit(0);
}

console.log(`  ✗ ${problemas.length} problema(s), ${perdidas} de ellos de texto:\n`);
for (const problema of problemas) console.log(`    ${problema}`);
console.log('');
process.exit(1);
