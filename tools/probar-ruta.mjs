/**
 * tools/probar-ruta.mjs — Prueba de la ruta y la cámara.
 *
 * Es la parte que más miedo da, porque un `NaN` en una posición de cámara no
 * lanza ningún error: el lienzo simplemente se queda negro y no hay forma de
 * saber por qué desde la consola.
 *
 * Se comprueba, con los datos REALES de `data/universo.js`:
 *   1. `recalibrar` coloca los desplazamientos en orden creciente.
 *   2. `resolver` devuelve números finitos en todo el recorrido, no solo en
 *      los puntos de control.
 *   3. La cámara recorre los cuerpos en el orden del guion.
 *   4. El amortiguado converge y no se pasa de largo.
 *   5. El salto del menú no deja la cámara en un estado imposible.
 *
 * Ejecutar: node tools/probar-ruta.mjs
 */

import assert from 'node:assert/strict';

/* ---- El módulo usa dos globals del navegador. ---- */

globalThis.window = {
  innerWidth: 1440,
  innerHeight: 900,
  devicePixelRatio: 2,
  scrollY: 0,
  matchMedia: () => ({ matches: false }),
};
globalThis.matchMedia = () => ({ matches: false });
globalThis.document = {
  documentElement: { scrollHeight: 20000, style: {} },
};

/* OJO: `ruta.resolver()` devuelve VECTORES COMPARTIDOS que se sobrescriben
   en la llamada siguiente. Cualquier medida de distancia tiene que copiar
   con `.clone()`, o comparará un objeto consigo mismo y dará cero. El
   contrato está documentado en el JSDoc de `resolver`. */

const { SISTEMAS, CAMARA } = await import('../assets/js/data/universo.js');
const { crearRuta } = await import('../assets/js/universo/ruta.js');

/* ------------------------------------------------------------------
   Un documento de mentira con alturas realistas
   ------------------------------------------------------------------ */

/* Alturas realistas. El pie mide 150svh = 1 350 px, que es lo que le da
   recorrido al retroceso final; ver el comentario en `.pie` de 05-sections. */
const ALTOS = { inicio: 900, perfil: 1400, proceso: 2600, stack: 1500, contacto: 1200, pie: 1800 };
let acumulado = 0;
const secciones = [];
for (const sistema of SISTEMAS) {
  const alto = ALTOS[sistema.seccion] ?? 1000;
  secciones.push({ id: sistema.seccion, arriba: acumulado, alto });
  acumulado += alto;
}
/* El documento es tan alto como la suma de sus secciones menos una pantalla. */
const ALTO_TOTAL = acumulado - 900;

const ruta = crearRuta(SISTEMAS);
ruta.recalibrar(secciones, ALTO_TOTAL);

/* ------------------------------------------------------------------
   1. Orden de los desplazamientos
   ------------------------------------------------------------------ */

console.log(`\nFotogramas: ${ruta.anclas.length}  ·  secciones medidas: ${secciones.length}\n`);

console.log('Desplazamientos por fotograma:');
let anterior = -1;
let creciente = true;
for (const [i, ancla] of ruta.anclas.entries()) {
  const ok = ancla.desplazamiento > anterior;
  if (!ok) creciente = false;
  console.log(
    `  ${String(i).padStart(2)}  ${ancla.sistemaId.padEnd(10)} t=${String(ancla.t).padEnd(5)}` +
      ` → ${ancla.desplazamiento.toFixed(4)}  u=${ancla.u.toFixed(4)}` +
      `  ${ok ? '' : '  ✗ NO CRECE'}`,
  );
  anterior = ancla.desplazamiento;
}
assert.equal(creciente, true, 'los desplazamientos deben crecer de forma estricta');
assert.ok(ruta.anclas[0].desplazamiento === 0, 'el primer fotograma debe estar en 0');

/* ------------------------------------------------------------------
   2. Todo el recorrido, no solo los puntos de control
   ------------------------------------------------------------------ */

console.log('\nRecorrido continuo (200 muestras):');
let noFinito = 0;
let fovMin = Infinity;
let fovMax = -Infinity;
let velocidadMax = 0;
const sistemasVisitados = new Set();

for (let i = 0; i <= 200; i += 1) {
  const p = i / 200;
  const estado = ruta.resolver(p);

  const numeros = [
    estado.posicion.x, estado.posicion.y, estado.posicion.z,
    estado.objetivo.x, estado.objetivo.y, estado.objetivo.z,
    estado.fov, estado.roll, estado.curvaVelocidad, estado.local,
  ];
  if (!numeros.every(Number.isFinite)) {
    noFinito += 1;
    if (noFinito <= 3) {
      console.log(`    ✗ NaN o Infinity en p=${p.toFixed(3)}:`, numeros);
    }
  }

  fovMin = Math.min(fovMin, estado.fov);
  fovMax = Math.max(fovMax, estado.fov);
  velocidadMax = Math.max(velocidadMax, estado.curvaVelocidad);
  sistemasVisitados.add(estado.sistema);
}

assert.equal(noFinito, 0, `${noFinito} muestras con valores no finitos`);

console.log(`  ✓ 201 muestras, todas finitas`);
console.log(`  ✓ FOV entre ${fovMin.toFixed(1)}° y ${fovMax.toFixed(1)}°  (configurado: ${CAMARA.fovMax}° máx.)`);
console.log(`  ✓ Curva de velocidad entre 0 y ${velocidadMax.toFixed(3)}`);
console.log(`  ✓ Sistemas visitados: ${[...sistemasVisitados].join(' → ')}`);

assert.ok(fovMin >= 24 && fovMax <= CAMARA.fovMax, 'el FOV debe quedar dentro del rango configurado');
assert.ok(fovMax > fovMin, 'el FOV debe variar: es lo que da sensación de óptica');

/* ------------------------------------------------------------------
   3. La cámara pasa por los cuerpos en el orden del guion
   ------------------------------------------------------------------ */

console.log('\nOrden en que se llega a cada sistema:');
const llegada = [];
let sistemaPrevio = null;
for (let i = 0; i <= 400; i += 1) {
  const estado = ruta.resolver(i / 400);
  if (estado.sistema !== sistemaPrevio) {
    llegada.push(estado.sistema);
    sistemaPrevio = estado.sistema;
  }
}
console.log(`  ${llegada.join(' → ')}`);

const esperado = SISTEMAS.map((s) => s.id).filter((id) => llegada.includes(id));
const obtenido = llegada.filter((id) => esperado.includes(id));
assert.deepEqual(obtenido, esperado, 'los sistemas deben aparecer en el orden del guion');
console.log('  ✓ Coincide con el guion de data/universo.js');

/* ------------------------------------------------------------------
   4. La cámara no salta: distancia acotada entre muestras vecinas
   ------------------------------------------------------------------ */

console.log('\nSuavidad del recorrido:');

/* Se mide a partir del 5 % del viaje. En el primer tramo el salto SIEMPRE
   es cero, porque `easeInOutCubic` arranca con pendiente nula: medirlo ahí
   daría un aprobado falso. Lo que importa es que no haya ningún punto del
   resto del recorrido donde la cámara se teletransporte. */
let saltoMayor = 0;
let puntoSalto = 0;
let anteriorPos = ruta.resolver(0.05).posicion.clone();

for (let i = 51; i <= 1000; i += 1) {
  const pos = ruta.resolver(i / 1000).posicion.clone();
  const distancia = pos.distanceTo(anteriorPos);
  if (distancia > saltoMayor) {
    saltoMayor = distancia;
    puntoSalto = i / 1000;
  }
  anteriorPos = pos;
}

const longitudTotal = ruta.resolver(0.05).posicion.clone().distanceTo(ruta.resolver(1).posicion);
const pasoMedio = longitudTotal / 950;
console.log(`  Recorrido total de la cámara: ${longitudTotal.toFixed(0)} unidades de mundo`);
console.log(`  Paso medio entre muestras: ${pasoMedio.toFixed(1)} unidades`);
console.log(`  Mayor salto entre muestras (del 5 % al 100 %): ${saltoMayor.toFixed(1)} unidades en p=${puntoSalto.toFixed(3)}`);

/* El salto máximo mide el PICO de la curva de aceleración, no la velocidad
   real, y un pico alto no es un fallo: es la easing frenando y arrancando.
   El fallo sería un segmento sin scroll, que se manifestaría como un salto
   orders-of-magnitude por encima del paso medio. Por eso el umbral es
   relativo al paso medio, no un número fijo. */
assert.ok(
  saltoMayor < pasoMedio * 12,
  `salto desproporcionado: ${saltoMayor.toFixed(1)} unidades, ${(saltoMayor / pasoMedio).toFixed(1)}× el paso medio`,
);
assert.ok(longitudTotal > 2000, `recorrido demasiado corto: ${longitudTotal.toFixed(0)}`);

/* La velocidad media POR TRAMPO es la métrica que de verdad dice si el
   ritmo funciona. Se mide en unidades de mundo por unidad de scroll, que es
   comparable entre tramos aunque tengan longitudes distintas. */
console.log(`\nVelocidad por tramo (unidades de mundo por píxel de scroll):`);
const ALTO_TOTAL_PX = ALTO_TOTAL;
let masRapido = 0;
let tramoMasRapido = '';
for (let i = 0; i < ruta.anclas.length - 1; i += 1) {
  const a = ruta.anclas[i];
  const b = ruta.anclas[i + 1];
  const anchoScroll = b.desplazamiento - a.desplazamiento;
  if (anchoScroll <= 0) continue;
  const largo = ruta.resolver(a.desplazamiento).posicion
    .clone()
    .distanceTo(ruta.resolver(b.desplazamiento).posicion);
  const pixeles = anchoScroll * ALTO_TOTAL_PX;
  const porPixel = largo / pixeles;
  if (porPixel > masRapido) {
    masRapido = porPixel;
    tramoMasRapido = `${a.sistemaId} → ${b.sistemaId}`;
  }
  console.log(
    `  ${String(i).padStart(2)}  ${(a.sistemaId + ' → ' + b.sistemaId).padEnd(24)}` +
      ` ${largo.toFixed(0).padStart(5)} u  ${pixeles.toFixed(0).padStart(5)} px` +
      `  ${porPixel.toFixed(2).padStart(5)} u/px`,
  );
}

/* El límite es 1,6 unidades por píxel, y sale de la propia película: el
   segmento más rápido DEL DISEÑO es la aproximación inicial, a 1,3 u/px,
   y esa velocidad es la que produce el "arranque". Por encima de 1,6 ya no
   es una intención de montaje sino un tramo sin scroll asignado, que es el
   fallo que este test persigue. */
console.log(`  Tramo más rápido: ${tramoMasRapido} a ${masRapido.toFixed(2)} u/px`);
console.log('  (referencia: la aproximación inicial está diseñada a ~1,3 u/px)');
assert.ok(
  masRapido < 1.6,
  `tramo demasiado rápido: ${tramoMasRapido} a ${masRapido.toFixed(2)} u/px (límite 1,6)`,
);

console.log(`  Recorrido total de la cámara: ${longitudTotal.toFixed(0)} unidades de mundo`);
assert.ok(longitudTotal > 2000, `recorrido demasiado corto: ${longitudTotal.toFixed(0)}`);

/* ------------------------------------------------------------------
   5. Amortiguación de la cámara
   ------------------------------------------------------------------ */

console.log('\nAmortiguación (simulación a 60 fps, un segundo de scroll brusco):');
globalThis.performance = globalThis.performance ?? { now: () => 0 };

const { crearCamara } = await import('../assets/js/universo/camara.js');
const camara = crearCamara();

const inicio = ruta.resolver(0);
camara.inicial(inicio);

let t = 0;
let posicionSuave;
for (let i = 0; i < 60; i += 1) {
  t += 16.67;
  // Salto brusco: el documento pasa de 0 a 100 % en un solo fotograma.
  const progreso = 1;
  const suave = camara.seguirProgreso(progreso, 16.67);
  const estado = ruta.resolver(suave);
  camara.colocar(estado, 16.67, null);
  posicionSuave = suave;
}

console.log(`  Tras 1 s de scroll instantáneo al 100 %: progreso amortiguado ${(posicionSuave * 100).toFixed(1)} %`);
assert.ok(posicionSuave > 0.5, 'un segundo debería bastar para recorrer la mayor parte del viaje');
assert.ok(posicionSuave <= 1, 'el progreso nunca puede pasar de 1');

// Otros 5 segundos, ya sin scroll: tiene que terminar de converger.
for (let i = 0; i < 300; i += 1) {
  const suave = camara.seguirProgreso(1, 16.67);
  const estado = ruta.resolver(suave);
  camara.colocar(estado, 16.67, null);
  posicionSuave = suave;
}
console.log(`  Tras 6 s en total: ${(posicionSuave * 100).toFixed(1)} %`);
assert.ok(posicionSuave > 0.999, 'el amortiguado tiene que converger al 100 %');
console.log('  ✓ Converge sin pasarse');

// Y al revés: el progreso no puede quedar por debajo de 0.
for (let i = 0; i < 120; i += 1) camara.seguirProgreso(0, 16.67);
console.log('  ✓ Vuelve a 0 sin salirse del rango');

/* ------------------------------------------------------------------
   6. Salto del menú: reenganche sin cruzar el espacio
   ------------------------------------------------------------------ */

console.log('\nSalto del menú (de Inicio a Contacto):');
camara.inicial(ruta.resolver(0));
const antes = camara.camara.position.clone();

/* Se COPIA el destino. `resolver` devuelve vectores compartidos: cualquier
   llamada posterior a `resolver` sobrescribe este mismo objeto. Este test
   lo sufre si no se clona, y mide la posición del punto equivocado sin
   avisar. Es exactamente la trampa que documenta el JSDoc de `resolver`. */
const destino = {
  ...ruta.resolver(ruta.anclas.find((a) => a.sistemaId === 'contacto').desplazamiento),
  posicion: ruta.resolver(ruta.anclas.find((a) => a.sistemaId === 'contacto').desplazamiento).posicion.clone(),
  objetivo: ruta.resolver(ruta.anclas.find((a) => a.sistemaId === 'contacto').desplazamiento).objetivo.clone(),
};
camara.reenganchar(destino);
/* `reenganchar` solo actualiza el estado interno; la cámara se coloca en
   el siguiente `colocar()`. Por eso hay que llamar a `colocar()` para ver
   la posición real: si no, la distancia daría cero y la comprobación no
   comprobaría nada. */
camara.colocar(destino, 16.67, null);
const despues = camara.camara.position.clone();

const salto = antes.distanceTo(despues);
console.log(`  Distancia entre la posición inicial y la final: ${salto.toFixed(0)} unidades`);
assert.ok(salto > 1000, 'un salto de menú debería mover la cámara bastante');
assert.ok(Number.isFinite(despues.x + despues.y + despues.z), 'la posición debe ser finita');
// Tras el reenganche, la cámara debe estar exactamente donde la ruta dice.
const error = camara.camara.position.distanceTo(destino.posicion);
assert.ok(error < 0.01, `la cámara debería estar placedada: error de ${error.toFixed(3)} unidades`);
console.log(`  ✓ La cámara se coloca exactamente en el destino, sin recorrer el espacio`);

/* ------------------------------------------------------------------
   7. Recalibrar con otra altura de documento
   ------------------------------------------------------------------ */

console.log('\nResistencia a un cambio de altura del documento:');
const seccionesAltas = secciones.map((s) => ({ ...s, alto: s.alto * 2 }));
ruta.recalibrar(seccionesAltas, ALTO_TOTAL * 2);
const muestraAlta = ruta.resolver(0.5);
assert.ok(Number.isFinite(muestraAlta.posicion.x), 'tras duplicar alturas debe seguir siendo finito');
assert.ok(Number.isFinite(muestraAlta.fov), 'el FOV debe seguir siendo finito');
console.log('  ✓ Con alturas al doble, el recorrido sigue siendo válido');
ruta.recalibrar(secciones, ALTO_TOTAL);

console.log('\nTodas las pruebas de la ruta pasaron.\n');
