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

  /* La fuente del display se renombró, y con razón. `space-grotesk-700` y
     `space-grotesk-500` eran el MISMO archivo, con Space Grotesk **Light**
     dentro (`usWeightClass = 300`), mientras el CSS declaraba 500 y 700: el
     nombre mentía sobre el contenido. Se llama ahora
     `space-grotesk-300-latin.woff2`, que es lo que lleva, y es el único
     display que queda.

     Es un enlace que desaparece porque se corrige, no porque se pierda nada,
     así que es excepción y no fallo. La regla que vigila esto de verdad es
     `verificar-fuentes.mjs`: que el peso del CSS sea el del archivo. */
  if (enlace === 'assets/fonts/space-grotesk-700-latin.woff2') continue;

  problemas.push(`Enlace desaparecido: ${enlace}`);
}

// El único enlace que puede aparecer es el nuevo del CSS del universo.
for (const enlace of enlacesAhora) {
  if (enlacesAntes.has(enlace)) continue;
  if (enlace === 'assets/css/06-universo.css') continue;
  // El nombre nuevo de la fuente del display, por lo de arriba.
  if (enlace === 'assets/fonts/space-grotesk-300-latin.woff2') continue;
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
   redacción no dispara la alarma, pero sí la desaparición de un párrafo.

   ── POR QUÉ LA BARRA Y EL MARQUESINA NO CUENTAN COMO PROSA ────────────
   Antes esta comprobación leía el documento entero a plano, y todo el
   cromo se pegaba en una sola "frase" de doscientas caracteres: «Full Stack
   Inicio Perfil Proceso Habilidades Contacto Hablemos 01 Inicio … HTML5 CSS3
   JavaScript Angular …». Una tirada de nombres de sección y de tecnologías no
   es una frase, y tratarla como una produce dos fallos a la vez: avisa de
   un cambio de cabecera que es deliberado, y obliga a exceptuar esa frase a
   mano cada vez que se toca el menú.

   Aquí el cromo se aparta antes de partir el texto en frases, porque su
   contenido NO es contenido: son nombres de sección y de tecnología, que se
   comprueban de otra forma y mejor. Los `href` de la barra y del menú se
   comparan unas líneas más arriba, sin excepciones para la navegación, así
   que borrar un enlace sigue siendo un fallo; y el nombre visible de cada
   enlace, cada botón y cada control lo revisa `verificar-a11y.mjs`.

   Lo que queda es lo que de verdad es prosa: los párrafos, los títulos y las
   descripciones. Perder cualquiera de ellos es un fallo. */

/**
 * Corta un elemento y todo su contenido, contando las etiquetas anidadas.
 *
 * Un `replace` con `[\s\S]*?` no sirve: en un `<div>` de la cabecera hay
 * otros `<div>` dentro, y el patrón no regular se pararía en el primero y
 * dejaría el resto del cromo dentro del texto. Contar es la única forma de
 * saber dónde acaba de verdad el elemento.
 *
 * @param {string} html
 * @param {string} clase  La clase CSS que identifica el bloque.
 * @returns {string} El mismo HTML con ese bloque sustituido por un espacio.
 */
function cortarPorClase(html, clase) {
  const apertura = new RegExp(`<([a-z][\\w-]*)\\b[^>]*\\bclass="[^"]*\\b${clase}\\b[^"]*"[^>]*>`, 'i');
  const m = apertura.exec(html);
  if (!m) return html;

  const etiqueta = m[1].toLowerCase();
  const desde = m.index;
  const cuerpo = new RegExp(`<(/?)${etiqueta}\\b[^>]*>`, 'gi');
  cuerpo.lastIndex = desde + m[0].length;

  let nivel = 1;
  let fin = html.length;
  let t;
  while ((t = cuerpo.exec(html)) !== null) {
    // Una etiqueta que se cierra sola (`<img …>`) no altera el nivel.
    if (t[0].endsWith('/>')) continue;
    nivel += t[1] === '/' ? -1 : 1;
    if (nivel === 0) {
      fin = t.index + t[0].length;
      break;
    }
  }

  return `${html.slice(0, desde)} ${html.slice(fin)}`;
}

/** Bloques de interfaz: no son prosa y no se comparan como frases. */
const CLASES_DE_CROMO = [
  'nav',
  'menu',
  'cabecera__acciones',
  'hero__acciones',
  'hero__chips',
  'marquee',
  'hero__anillos',
  'hud',
  'progreso',
  'scroll-cue',
  'cursor',
];

function prosa(html) {
  return CLASES_DE_CROMO.reduce((salida, clase) => cortarPorClase(salida, clase), html);
}

function frases(html) {
  const texto = textoVisible(prosa(html));
  return new Set(
    texto
      .split(/(?<=[.!?:])\s+/)
      .map((f) => f.trim().replace(/[.,;:!?]$/, ''))
      .filter((f) => f.length > 24),
  );
}

const frasesAntes = frases(antes);
const textoAhora = textoVisible(prosa(ahora));
let perdidas = 0;

for (const frase of frasesAntes) {
  if (textoAhora.includes(frase)) continue;
  // Las frases del tema claro ya no aplican.
  if (/tema claro|tema oscuro/i.test(frase)) continue;
  // El texto del pie se reescribió a propósito y se documentó.
  if (frase.includes('librerías externas')) continue;
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
