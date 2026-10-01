/**
 * tools/probar-dom.mjs — Arranque del sitio en un DOM de verdad.
 *
 * ── QUÉ COMPRUEBA Y POR QUÉ ESTA HECHA ASÍ ────────────────────────────
 *
 * Las otras siete comprobaciones son estáticas: leen archivos. Esta ejecuta
 * el sitio. Monta el `index.html` real en un DOM, carga el grafo completo
 * de módulos a través de `main.js` y luego hace lo que haría una persona:
 * pulsar el botón del recorrido, pararlo con `Escape`, con la rueda y con el
 * botón, cambiar la calidad a "Sin 3D" y a un nivel real, y comprobar que
 * el sitio queda entero.
 *
 * Cubre la familia de fallos que lo estático no ve, y que en un sitio de
 * este tamaño son los que más se repiten:
 *
 *   · un `id` mal escrito en el HTML, que deja un módulo muerto en silencio;
 *   · un módulo que lanza al montar, y que `seguro()` se come con un aviso
 *     en la consola;
 *   · un `import()` resuelto contra el archivo equivocado;
 *   · un manejador registrado sobre un nodo que no existe;
 *   · y dos que no son de cableado sino de lógica: un nombre tapado por otro
 *     dentro de la misma función, y una firma de función que no es la que
 *     creek el llamante. Los dos encontrados aquí aparecían solo al DETENER
 *     el recorrido y al cambiar la calidad, y ninguno en el arranque.
 *
 * ── LO QUE NO PUEDE COMPROBAR ────────────────────────────────────────
 *
 * No hay WebGL, así que el universo entra por su salida `sin-webgl` —que es
 * una de las cuatro que el sitio tiene que sostener, así que la prueba
 * gana algo—. Tampoco hay composición, ni framerate, ni un lector de
 * pantalla. Lo que hay que mirar a mano en un navegador sigue siendo lo que
 * ya está listado en `UNIVERSO.md` §14.
 *
 * ── DEPENDENCIA ──────────────────────────────────────────────────────
 *
 * Es la ÚNICA herramienta del repositorio que necesita algo instalado, y es
 * a propósito: `jsdom` es una herramienta de desarrollo, no una dependencia
 * del sitio. El sitio que se publica sigue sin `package.json`, sin
 * `node_modules` y sin proceso de compilación.
 *
 *   npm install --no-save jsdom
 *
 * Si no está, esta comprobación se salta sola y lo dice. No es un fallo:
 * es la diferencia entre "el sitio está mal" y "aquí no se pudo mirar".
 *
 * ── EL PUENTE ────────────────────────────────────────────────────────
 *
 * jsdom no ejecuta `<script type="module">`, asi que el puente es explicito:
 * se expone el `window` de jsdom como global del modulo y se importa
 * `main.js` con el `import()` de Node. Los dos mundos comparten los mismos
 * nodos, de modo que lo que el sitio escribe se ve en el documento y lo que
 * el documento dispara lo oyen los modulos. Es un puente, no una emulacion:
 * lo que se prueba es el cableado y la logica, no el render.
 *
 * Ejecutar: node tools/probar-dom.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* ------------------------------------------------------------------
   ¿Está jsdom?
   ------------------------------------------------------------------ */

let JSDOM;
let VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import('jsdom'));
} catch {
  console.log('\n  OMITIDA: falta `jsdom`.');
  console.log('  Es la única comprobación que necesita algo instalado:');
  console.log('      npm install --no-save jsdom\n');
  process.exit(0);
}

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const fallos = [];
const erroresConsola = [];
const avisosConsola = [];

const comprobar = [];
function comprobar_(nombre, ok, detalle = '') {
  comprobar.push({ nombre, ok, detalle });
  if (!ok) fallos.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

/* ------------------------------------------------------------------
   1. Documento
   ------------------------------------------------------------------ */

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (e) => erroresConsola.push(`jsdomError: ${e.message}\n${(e.stack ?? '').split('\n').slice(1, 8).join('\n')}`));
virtualConsole.on('error', (...a) => erroresConsola.push(`console.error: ${a.join(' ')}`));
virtualConsole.on('warn', (...a) => avisosConsola.push(`warn: ${a.join(' ')}`));
virtualConsole.on('log', (...a) => avisosConsola.push(`log: ${a.join(' ')}`));

const dom = new JSDOM(readFileSync(resolve(RAIZ, 'index.html'), 'utf8'), {
  url: 'https://ejemplo.local/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole,
});

const { window } = dom;

/* ------------------------------------------------------------------
   2. Lo que jsdom no trae
   ------------------------------------------------------------------ */

/* Un `IntersectionObserver` que dispara de inmediato: en la prueba no hay
   scroll, y así el comportamiento de "aparecer al entrar en pantalla" se
   puede comprobar de verdad en vez de quedarse en el primer fotograma. */
class IntersectionObserverStub {
  constructor(callback) {
    this.callback = callback;
    this.elementos = new Set();
  }
  observe(elemento) {
    this.elementos.add(elemento);
    this.callback([{ target: elemento, isIntersecting: true, intersectionRatio: 1 }], this);
  }
  unobserve(elemento) {
    this.elementos.delete(elemento);
  }
  disconnect() {
    this.elementos.clear();
  }
  takeRecords() {
    return [];
  }
}

window.matchMedia = (consulta) => ({
  matches: false,
  media: consulta,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() {
    return false;
  },
});

window.requestIdleCallback = (fn) => window.setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 50 }), 0);
window.cancelIdleCallback = (id) => window.clearTimeout(id);

/* `scrollTo` es un «not implemented» de jsdom. El sitio lo pide siempre por
   su helper único, y aquí solo importa que exista y no reviente. */
window.scrollTo = (arg) => {
  const top = typeof arg === 'object' && arg ? arg.top : arg;
  if (typeof top === 'number') window.scrollY = top;
};

/* Three.js no puede construir un contexto aquí, y no hace falta: lo que se
   prueba es el arranque del sitio, no el render. Un contexto nulo lleva a
   `universo/index.js` a la salida `sin-webgl`, que es una de las que el
   sitio tiene que sostener de verdad. */
window.HTMLCanvasElement.prototype.getContext = () => null;

/* Alturas de sección distintas y realistas: es lo que hace que `medir()`
   reparta el recorrido de verdad, y no con todos los sistemas en cero. */
const ALTOS = [
  ['inicio', 1100],
  ['perfil', 1600],
  ['proceso', 2800],
  ['stack', 1700],
  ['contacto', 1300],
  ['pie', 1900],
];
const TOTAL = ALTOS.reduce((a, [, v]) => a + v, 0);
const ARRIBAS = new Map(
  ALTOS.map(([id, alto], i) => [id, ALTOS.slice(0, i).reduce((a, [, v]) => a + v, 0)]),
);

window.HTMLElement.prototype.getBoundingClientRect = function bounding() {
  const id = this.id || '';
  const alto = ALTOS.find(([k]) => k === id)?.[1] ?? 600;
  const arriba = (ARRIBAS.get(id) ?? 0) - (window.scrollY || 0);
  return {
    top: arriba,
    bottom: arriba + alto,
    left: 0,
    right: 1280,
    width: 1280,
    height: alto,
    x: 0,
    y: arriba,
    toJSON() {
      return this;
    },
  };
};

Object.defineProperty(window.document.documentElement, 'scrollHeight', {
  configurable: true,
  get: () => TOTAL,
});
Object.defineProperty(window.document.documentElement, 'clientHeight', {
  configurable: true,
  get: () => 800,
});
/* `getComputedStyle` de jsdom devuelve cadena vacía para las propiedades
   personalizadas, y `alturaDeCabecera()` cae entonces en su valor de
   respaldo (74 px). Es exactamente el camino que sigue el sitio en un
   navegador que no expone el token, así que no hace falta falsearlo. */

/* ------------------------------------------------------------------
   3. El puente: el window de jsdom pasa a ser el global del módulo
   ------------------------------------------------------------------ */

const PUENTES = [
  'document', 'navigator', 'location', 'history', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback',
  'localStorage', 'sessionStorage', 'matchMedia', 'IntersectionObserver',
  'Element', 'HTMLElement', 'Node', 'NodeList', 'CustomEvent', 'Event',
  'KeyboardEvent', 'MouseEvent', 'WheelEvent', 'InputEvent', 'FocusEvent',
  'MutationObserver', 'DOMParser', 'XMLSerializer', 'performance',
  'devicePixelRatio', 'innerWidth', 'innerHeight', 'scrollX', 'scrollY',
];

for (const nombre of PUENTES) {
  if (nombre in window) {
    Object.defineProperty(globalThis, nombre, {
      configurable: true,
      writable: true,
      value: window[nombre],
    });
  }
}
globalThis.IntersectionObserver = IntersectionObserverStub;
globalThis.window = window;
globalThis.self = window;
globalThis.document = window.document;

/* jsdom no implementa Resource Timing, que usa `preloader.js` para contar
   los recursos críticos. Todos los navegadores de escritorio y móvil lo
   tienen desde hace más de una década, así que aquí se sustituye en vez de
   tocar el sitio. */
const rendimiento = {
  now: () => Number(process.hrtime.bigint() / 1000n) / 1000,
  getEntriesByType: () => [],
  getEntries: () => [],
  timeOrigin: 0,
};
Object.defineProperty(window, 'performance', { configurable: true, value: rendimiento });
globalThis.performance = rendimiento;

/* El `window` que escriben los módulos tiene que ser el mismo proxy que el
   que nos da jsdom, o `window.scrollY = 40` en un sitio no se vería en el
   otro. */
Object.defineProperty(window, 'scrollY', {
  configurable: true,
  writable: true,
  value: 0,
});

/* ------------------------------------------------------------------
   4. Ejecutar el sitio
   ------------------------------------------------------------------ */

try {
  await import(pathToFileURL(resolve(RAIZ, 'assets/js/main.js')).href);
} catch (e) {
  fallos.push(`main.js no arrancó: ${e.message}`);
  erroresConsola.push(`${e.stack?.split('\n').slice(1, 5).join('\n') ?? ''}`);
}

await new Promise((r) => setTimeout(r, 2500));

const doc = window.document;

/* ------------------------------------------------------------------
   5. Comprobaciones
   ------------------------------------------------------------------ */

if (erroresConsola.length) {
  console.log('\n  ERRORES DE CONSOLA AL ARRANCAR:');
  for (const e of erroresConsola.slice(0, 12)) console.log(`    · ${e}`);
  console.log('');
}

console.log('\n  ARRANQUE DEL SITIO EN UN DOM REAL\n');

/* --- El arranque llegó al final --- */
comprobar_('el sitio termina de arrancar (body[data-listo])', doc.body.dataset.listo === '1', doc.body.dataset.listo);
comprobar_('el preloader se retira', !doc.querySelector('.preloader'));

/* --- La pila de avisos --- */
comprobar_('la pila de avisos se monta', !!doc.querySelector('#avisos'));
comprobar_('la pila de avisos se anuncia (role=status)', doc.querySelector('#avisos')?.getAttribute('role') === 'status');

/* --- El selector de calidad --- */
const sel = doc.querySelector('#calidad-selector');
comprobar_('el selector de calidad está en la cabecera', !!sel);
comprobar_('el selector ofrece los cinco niveles', sel?.options.length === 5, `${sel?.options.length}`);
comprobar_('el selector arranca en automático', sel?.value === 'auto', sel?.value);
comprobar_('el selector tiene nombre accesible', !!sel?.closest('label')?.querySelector('.sr-only'));
comprobar_('el selector muestra su valor en texto', (doc.querySelector('.calidad__rotulo')?.textContent ?? '') === 'Auto');

/* --- La navegación con índice --- */
const enlaces = [...doc.querySelectorAll('.nav__enlace')];
comprobar_('la navegación tiene sus cinco enlaces', enlaces.length === 5, `${enlaces.length}`);
comprobar_(
  'cada enlace lleva su índice numerado',
  enlaces.every((a) => /^0[1-5]$/.test(a.querySelector('.nav__indice')?.textContent ?? '')),
);

/* --- La barra de lectura --- */
const progreso = doc.querySelector('#progreso-barra');
comprobar_('la barra de lectura vive en la cabecera', !!progreso?.closest('.cabecera'));

/* --- El recorrido guiado --- */
const viaje = doc.querySelector('#viaje-iniciar');
comprobar_('el botón del recorrido existe', !!viaje);
comprobar_('el botón del recorrido es un <button>, no un enlace', viaje?.tagName === 'BUTTON');
comprobar_('el botón del recorrido tiene nombre accesible', !!(viaje?.textContent ?? '').replace(/\s+/g, ' ').trim().length);

if (viaje) {
  viaje.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));

  comprobar_('el recorrido se marca activo en el <html>', doc.documentElement.dataset.viaje === 'activo');
  comprobar_('el panel del recorrido se monta', !!doc.querySelector('.viaje-panel'));
  comprobar_('la cortina de cine se monta', !!doc.querySelector('.viaje-marco'));
  comprobar_('la cortina tiene barra de arriba y de abajo', doc.querySelectorAll('.viaje-marco__barra').length === 2);
  comprobar_('el botón de parar está siempre visible', !!doc.querySelector('.viaje-panel__parar'));
  comprobar_(
    'al arrancar, el foco pasa al botón de parar',
    doc.activeElement === doc.querySelector('.viaje-panel__parar'),
    doc.activeElement?.className,
  );
  comprobar_(
    'el contador nombra el sistema en el que se está',
    /Planeta hogar|El origen|Campo de escombros/.test(doc.querySelector('.viaje-panel__nombre')?.textContent ?? ''),
    doc.querySelector('.viaje-panel__nombre')?.textContent,
  );

  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 250));
  comprobar_('Escape detiene el recorrido', doc.documentElement.dataset.viaje === undefined);
  comprobar_('al parar, el foco vuelve al botón del recorrido', doc.activeElement === viaje, doc.activeElement?.id);

  viaje.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 350));
  window.dispatchEvent(new window.Event('wheel'));
  await new Promise((r) => setTimeout(r, 250));
  comprobar_('la rueda del visitante detiene el recorrido', doc.documentElement.dataset.viaje === undefined);

  // El botón de parar, no solo el teclado.
  viaje.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 350));
  doc.querySelector('.viaje-panel__parar')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  comprobar_('el botón de parar detiene el recorrido', doc.documentElement.dataset.viaje === undefined);
}

/* --- La calidad --- */
if (sel) {
  sel.value = 'off';
  sel.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));

  const avisos = [...doc.querySelectorAll('.aviso-flotante')].map((n) => n.textContent);
  comprobar_('"Sin 3D" lo confirma con un aviso', avisos.some((t) => /Sin 3D/.test(t)), avisos.join(' | '));
  comprobar_('"Sin 3D" no recarga: se apaga en vivo', !avisos.some((t) => /Recargando/.test(t)), avisos.join(' | '));
  comprobar_('"Sin 3D" se guarda para la próxima visita', window.localStorage.getItem('odisea:calidad') === '"off"');
  comprobar_('"Sin 3D" retira la clave antigua', window.localStorage.getItem('odisea:simple') === null);

  sel.value = 'bajo';
  sel.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const avisos2 = [...doc.querySelectorAll('.aviso-flotante')].map((n) => n.textContent);
  comprobar_('un nivel real explica que va a recargar', avisos2.some((t) => /Recargando/.test(t)), avisos2.join(' | '));
  comprobar_('un nivel real se guarda', window.localStorage.getItem('odisea:calidad') === '"bajo"');
}

/* --- El aviso caduca solo --- */
comprobar_('los avisos se apilan sin pisarse', doc.querySelectorAll('.aviso-flotante').length <= 3);

/* --- Fallback sin WebGL --- */
comprobar_(
  'sin WebGL el sitio lo declara inactivo',
  doc.documentElement.dataset.universo === 'inactivo',
  doc.documentElement.dataset.universo,
);
comprobar_('sin WebGL se retira el lienzo del universo', !doc.querySelector('#universo-lienzo'));
const diferidos = [...doc.querySelectorAll('[data-revelar]')];
comprobar_(
  'sin WebGL se revela todo el contenido diferido',
  diferidos.every((n) => n.dataset.visible === '1'),
  `${diferidos.filter((n) => n.dataset.visible !== '1').length} sin revelar de ${diferidos.length}`,
);
comprobar_('sin WebGL el sitio conserva todo su texto', !!doc.querySelector('#perfil') && !!doc.querySelector('#contacto'));

/* --- Enlaces internos --- */
const rotas = [...doc.querySelectorAll('a[href^="#"]')]
  .map((a) => a.getAttribute('href').slice(1))
  .filter((id) => id && !doc.getElementById(id));
comprobar_('ningún enlace interno apunta a nada', rotas.length === 0, rotas.join(', '));

/* --- Consola --- */
comprobar_('la consola está limpia: cero errores', erroresConsola.length === 0, erroresConsola.slice(0, 2).join(' | '));

/* ------------------------------------------------------------------ */

for (const { nombre, ok, detalle } of comprobar) {
  console.log(`  ${ok ? '✓' : '✗'} ${nombre}${ok || !detalle ? '' : ` — ${detalle}`}`);
}

if (avisosConsola.length) {
  console.log('\n  Consola no bloqueante:');
  for (const a of [...new Set(avisosConsola)].slice(0, 8)) console.log(`    · ${a}`);
}

console.log('');
if (fallos.length) {
  console.log(`  ${fallos.length} fallo(s).\n`);
  process.exitCode = 1;
} else {
  console.log(`  Las ${comprobar.length} comprobaciones de integración pasaron.\n`);
}

window.close();
