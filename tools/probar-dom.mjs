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

/* `matchMedia` responde a CADA consulta por separado.

   Antes devolvía `matches: false` para todo, y eso era más cómodo pero
   mentía: el sitio lee tres consultas al arrancar, y con todas en `false`
   `cursor.js` y `montarScrollSuave` salían por su puerta de capacidad y no
   montaban nada. Las comprobaciones sobre sus limpiezas pasaban sin haber
   montado nada, que es la forma más cómoda de no comprobar nada.

   Aquí el sitio se presenta como lo que la prueba quiere ser: un escritorio
   con puntero fino y ventana ancha. Y `prefers-reduced-motion` sigue en
   `false` a propósito, porque el camino de movimiento reducido es una de las
   cuatro salidas del universo y se prueba en otra parte. */
const MEDIA = [
  { consulta: '(prefers-reduced-motion: reduce)', matches: false },
  { consulta: '(pointer: fine)', matches: true },
  { consulta: '(pointer: coarse)', matches: false },
  { query: '(min-width: 900px)', matches: true, como: '(min-width: 900px)' },
  { query: '(min-width: 820px)', matches: true, como: '(min-width: 820px)' },
  { query: '(min-width: 360px)', matches: true, como: '(min-width: 360px)' },
];

window.matchMedia = (consulta) => {
  const encontrada = MEDIA.find((m) => m.consulta === consulta || m.query === consulta);
  return {
    matches: encontrada?.matches ?? false,
    media: consulta,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  };
};

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

/* ── INSTRUMENTACIÓN DE ESCUCHADORES ──────────────────────────────────

   Se cuenta cada `addEventListener` y cada `removeEventListener` que el
   sitio haga, para poder exigir al final que `pagehide` los solte todos.

   Es la forma de comprobar en ejecución la regla de que todo `montar*`
   devuelve su limpieza, sin tocar el código del sitio: no hace falta que
   `main.js` exponga su lista de limpiezas ni que ningún módulo mute para
   poder observarlo. Se cuenta por PAR de tipo y manejador, que es como
   funciona `removeEventListener` —por identidad—, y no solo por tipo: si
   un módulo retira un manejador distinto del que puso, el contador no baja
   y el fallo queda al descubierto.

   Antes de esto, cinco módulos del sitio retinaban listeners que nunca
   soltaron: cuatro de `cursor.js`, seis de `contacto.js`, diez de
   `proceso.js` y uno de `contenido.js`. Todos con la misma forma: un
   `return () => {}` que cumplía la firma sin hacer nada. */

const vivos = new Map();

function idDe(tipo, manejador, opciones) {
  return `${tipo}|${manejador}|${opciones?.capture ?? false}`;
}

const addOriginal = window.EventTarget.prototype.addEventListener;
const removeOriginal = window.EventTarget.prototype.removeEventListener;

window.EventTarget.prototype.addEventListener = function (tipo, manejador, opciones) {
  const id = idDe(tipo, manejador, opciones);
  vivos.set(id, (vivos.get(id) ?? 0) + 1);
  return addOriginal.call(this, tipo, manejador, opciones);
};

window.EventTarget.prototype.removeEventListener = function (tipo, manejador, opciones) {
  const id = idDe(tipo, manejador, opciones);
  vivos.set(id, (vivos.get(id) ?? 0) - 1);
  return removeOriginal.call(this, tipo, manejador, opciones);
};

/* `core/loop.js` se importa ANTES de instrumentar a propósito. Es el módulo
   que ES el bucle: su escuchador de `visibilitychange` vive hasta que se
   cierra la página, porque no hay nada que lo desmonte. Importándolo aquí
   queda en la línea base y no se cuenta como una fuga del sitio. */
try {
  await import(pathToFileURL(resolve(RAIZ, 'assets/js/core/loop.js')).href);
} catch {
  /* si falla, la línea base simplemente valdrá cero */
}

/* Lo mismo, y por la misma razón, con los dos escuchadores que registra
   `nwsapi`, que es el motor de selectores de jsdom. Para resolver `:hover` y
   `:focus` los pone en `document` la PRIMERA vez que alguien pide un estilo
   computado. Los pone jsdom, no el sitio, y no hay manera de retirarlos.

   Se provocan aquí, antes de la línea base, con un `getComputedStyle` sobre
   el documento. Sin esto, al apagar el sitio salía el aviso
   `mouseover ×1, mouseout ×1`: dos escuchadores internos de jsdom contados
   como una fuga del sitio, que no es lo mismo que una fuga.

   Y el arreglo no perdona de más: si el sitio se colgara un `mouseover`
   propio, seguiría contando por encima de la línea base. Lo que se descarta
   es el par interno, no el tipo de evento. */
try {
  window.getComputedStyle(document.documentElement);
} catch {
  /* si esto falla, la línea base se queda corta y el aviso reaparece */
}

const lineaBase = new Map(vivos);

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

/* El número de paradas tiene que coincidir con las secciones que HAY.

   Es la comprobación que faltaba para un defecto real: `#proyectos` no está
   en el HTML, lo inserta `modules/proyectos.js`, y ese módulo se monta
   DESPUÉS que `viaje` en `main.js`. `viaje.js` decidía su lista de paradas al
   montarse, filtrando por `getElementById`, así que el sistema de proyectos
   quedaba fuera aunque la sección existiera.

   No se notaba con `data/proyectos.js` vacío, porque la sección no se crea y
   los dos números salían a 6 por casualidad. En cuanto se añade el primer
   proyecto, el contador se quedaba en `06` mientras existían siete secciones
   con sistema: el "cúmulo de planetas" desaparecía del recorrido sin un solo
   error en consola.

   La comparación es contra el DOM, no contra una constante: así vale igual con
   seis secciones que con siete. */
const { SISTEMAS } = await import(pathToFileURL(resolve(RAIZ, 'assets/js/data/universo.js')).href);
const seccionesConSistema = SISTEMAS.filter((s) => doc.getElementById(s.seccion) !== null).length;
const totalEnElContador = Number(/(\d+)\s*\/\s*(\d+)/.exec(doc.querySelector('.viaje-panel__lectura')?.textContent ?? '')?.[2]);

comprobar_(
  'el recorrido cuenta tantas paradas como secciones con sistema hay',
  totalEnElContador === seccionesConSistema,
  `el contador dice ${totalEnElContador} y hay ${seccionesConSistema} secciones con sistema`,
);
comprobar_(
  'el recorrido incluye la sección de proyectos si existe',
  !doc.getElementById('proyectos') || totalEnElContador === seccionesConSistema,
  'la sección existe y el recorrido no la incluye',
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

/* --- Apagar el sitio: todo `montar*` devuelve su limpieza ---

   Se dispara `pagehide`, que es lo que hace `main.js` para soltar el sitio,
   y se exige que no quede ningún escuchador colgado por encima de la línea
   base. Es la versión de ejecución de la regla que `verificar-limpiezas.mjs`
   comprueba por lectura: aquí importa que la limpieza se LLAME, que es lo
   único que no se puede ver leyendo el archivo.

   Se comparan contra la línea base en vez de contra cero, y se perdona un
   único `pagehide`, por dos razones escritas:

     · la línea base es `core/loop.js`, que no tiene ciclo de vida;
     · el `pagehide` que cuelga es el de `main.js`, que es el QUE LLAMA a
       las limpiezas. Pedirle que se retire a sí mismo sería pedirle que se
       desconecte antes de desconectarse. */
window.dispatchEvent(new window.Event('pagehide'));
await new Promise((r) => setTimeout(r, 60));

const colgados = [...vivos.entries()]
  .map(([id, n]) => ({ tipo: id.split('|')[0], id, n: n - (lineaBase.get(id) ?? 0) }))
  .filter(({ tipo, n }) => n > 0 && tipo !== 'pagehide')
  .map(({ tipo, n }) => `${tipo} ×${n}`);

comprobar_(
  '`pagehide` suelta todos los escuchadores que el sitio registró',
  colgados.length === 0,
  colgados.slice(0, 6).join(', '),
);

/* Que no queden escuchadores solo demuestra que se retiraron los que se
   podían retirar. Falta lo importante: que la limpieza SE EJECUTÓ. Con solo
   el conteo de escuchadores, el defecto original de `proceso.js` pasaba
   limpio: devolvía un objeto, `main.js` leía un `TypeError` y lo silenciaba,
   así que su limpieza no llegaba a correr y sus nodos se quedaban en el
   documento sin que nada lo delatara.

   Estos nodos los crea el sitio al montar y ningún módulo los borra salvo su
   limpieza, así que si siguen aquí es que la limpieza no se ejecutó. */
const shouldHaveRemoved = [
  ['.proceso__nucleo', 'la limpieza de proceso.js se ejecutó'],
  ['.cursor', 'la limpieza de cursor.js se ejecutó'],
  ['.viaje-panel', 'la limpieza de viaje.js se ejecutó'],
  ['.marquee__pista [data-clonado]', 'la limpieza de la marquesina se ejecutó'],
  ['#stack-grupos .grupo', 'la limpieza de contenido.js se ejecutó'],
];

for (const [selector, nombre] of shouldHaveRemoved) {
  comprobar_(nombre, !doc.querySelector(selector), `sigue en el documento: ${selector}`);
}

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
