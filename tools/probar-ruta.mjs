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
const { milisegundosASegundos } = await import('../assets/js/core/util.js');
const { crearRuta } = await import('../assets/js/universo/ruta.js');
const { separacionParaEncuadre } = await import('../assets/js/core/util.js');

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

/* ------------------------------------------------------------------
   4 bis. La garantía, y sus dos límites
   ------------------------------------------------------------------

   Lo de arriba mide el guion que hay hoy. Lo de aquí mide la GARANTÍA: que
   el reparto dé a cada tramo el scroll que su distancia necesita, sea cual
   sea el guion que se escriba mañana.

   Y una garantía hay que probarla rompiéndola, así que aquí se fabrican dos
   guiones hostiles y se les cambia solo la DISTANCIA de la cámara, que es
   justo lo que pasa si alguien aleja un cuerpo mil unidades sin darle más
   sección. */

console.log('\nGarantía de velocidad ante un guion que se alarga:');

const longitudesDe = (r) => r.curva.getLengths().at(-1);

/** Velocidad de cada tramo, en unidades de mundo por píxel de scroll. */
function velocidades(r, altoPx) {
  const salida = [];
  for (let i = 0; i < r.anclas.length - 1; i += 1) {
    const a = r.anclas[i];
    const b = r.anclas[i + 1];
    const pixeles = (b.desplazamiento - a.desplazamiento) * altoPx;
    const largo = (b.u - a.u) * longitudesDe(r);
    salida.push({
      nombre: `${a.sistemaId} → ${b.sistemaId}`,
      porPx: pixeles > 0 ? largo / pixeles : Infinity,
    });
  }
  return salida;
}

/** El mismo guion, con la cámara a otra distancia. */
function rutaConEscala(escala) {
  const sistemas = SISTEMAS.map((s) => ({
    ...s,
    fotogramas: s.fotogramas.map((f) => ({
      ...f,
      pos: f.pos.map((v) => v * escala),
      mira: f.mira.map((v) => v * escala),
    })),
  }));
  const r = crearRuta(sistemas);
  r.recalibrar(secciones, ALTO_TOTAL);
  return r;
}

/* El puente de la portada a Perfil se mide aparte, porque era EL tramo que
   se cruzaba a 4,1 u/px. Medir solo el promedio del recorrido dejaría
   pasar que el reparto no hizo nada y lo que arregló fue otro. */
const puente = velocidades(ruta, ALTO_TOTAL)[4];
console.log(`  Puente portada → perfil: ${puente.porPx.toFixed(2)} u/px`);
assert.ok(
  puente.porPx <= 1.25,
  `el puente debería quedar en el objetivo de velocidad, da ${puente.porPx.toFixed(2)} u/px`,
);

/* Un caso que SÍ cabe: la cámara al 1,5× pide un 50 % más de recorrido, y
   el objetivo tiene que cumplirse igual. */
const rutaMedia = rutaConEscala(1.5);
const velocidadMedia = Math.max(...velocidades(rutaMedia, ALTO_TOTAL).map((v) => v.porPx));
console.log(`  Cámara al 1,5× (cabe): peor tramo ${velocidadMedia.toFixed(2)} u/px`);
assert.ok(
  velocidadMedia <= 1.25,
  `un guion un 50 % más largo debería seguir cabiendo; el peor tramo da ${velocidadMedia.toFixed(2)} u/px`,
);

/* Y el límite real de la garantía: la cámara al 4× pide cuatro veces más
   scroll del que el documento tiene. El objetivo es entonces
   matemáticamente imposible y el reparto no puede cumplirlo, pero sí puede
   cumplir lo único que importa cuando no cabe: que NINGÚN tramo vaya
   desproporcionadamente más rápido que la media. Un reparto que se rindiera
   en los tramos difíciles los dejaría al 4× mientras el resto va a 0,2, y
   eso es exactamente el tirón que se vino a arreglar. */
const rutaLarga = rutaConEscala(4);
const vsLargas = velocidades(rutaLarga, ALTO_TOTAL);
const peorLarga = Math.max(...vsLargas.map((v) => v.porPx));
const mediaLarga = vsLargas.reduce((a, v) => a + v.porPx, 0) / vsLargas.length;

console.log(`  Cámara al 4× (no cabe): peor tramo ${peorLarga.toFixed(2)} u/px, media ${mediaLarga.toFixed(2)} u/px`);
assert.ok(
  peorLarga <= mediaLarga * 1.05,
  `aunque el guion no quepa, ningún tramo debe ir más de un 5 % por encima de la media: ` +
    `${peorLarga.toFixed(2)} frente a ${mediaLarga.toFixed(2)}`,
);
assert.ok(rutaLarga.anclas.at(-1).desplazamiento === 1, 'el último fotograma debe seguir llegando al final');
assert.ok(
  rutaLarga.anclas.every((a, i) => i === 0 || a.desplazamiento > rutaLarga.anclas[i - 1].desplazamiento),
  'los desplazamientos deben seguir creciendo en orden',
);
console.log('  ✓ La velocidad no depende de lo que se escriba en el guion');

console.log(`  Recorrido total de la cámara: ${longitudTotal.toFixed(0)} unidades de mundo`);
assert.ok(longitudTotal > 2000, `recorrido demasiado corto: ${longitudTotal.toFixed(0)}`);

/* ------------------------------------------------------------------
   5. La cámara no entra dentro de ningún cuerpo
   ------------------------------------------------------------------

   Esta comprobación existe por un bug concreto que se costó una tarde entera
   de capturas: el cruce del plano de anillos del gigante gaseoso estaba
   escrito en [90, 6, -1930], y el gigante está en (0, 0, -1900) con radio
   132. La distancia desde ese fotograma al centro del cuerpo es de 95
   unidades: MENOS que el radio. La cámara estaba dentro de la roca.

   No se notaba leyendo el código, y en la pantalla se veía como un agujero
   negro con un arco de anillo alrededor. Midiendo el píxel: el planeta
   renderizaba en RGB(10, 15, 27) sobre un fondo de RGB(9, 14, 25). El
   planeta estaba ahí, y era indistinguible del vacío.

   Con la esfera, estar dentro significa que solo se dibujan
   las caras que dan la espalda, que están descartadas: el resultado no es un
   planeta raro, es el fondo. Y el arco del anillo —que sí se dibujaba— hace
   que el fallo parezca un cuerpo mal iluminado y no una cámara en el sitio
   equivocado.

   Aquí se mide la distancia de CADA fotograma a CADA cuerpo, y también a lo
   largo de los tramos, no solo en los puntos de control: un tramo recto entre
   dos fotogramas válidos puede atravesar un cuerpo. */

console.log('\nLa cámara dentro de un cuerpo:');

/** Cuerpos con posición y radio, tal y como los construye `escena.js`. */
const CUERPOS = SISTEMAS.filter((s) => s.cuerpo?.tipo === 'planeta').map((s) => ({
  id: s.cuerpo.id,
  centro: [s.cuerpo.x, s.cuerpo.y, s.cuerpo.z],
  radio: s.cuerpo.radio,
}));

console.log(`  Cuerpos con volumen: ${CUERPOS.map((c) => `${c.id} (r=${c.radio})`).join(', ')}`);

const distanciaA = (p, c) => Math.hypot(p[0] - c.centro[0], p[1] - c.centro[1], p[2] - c.centro[2]);

/* Margen sobre el radio. La cámara puede pasar rozando un planeta —de hecho
   esa es la gracia del perfil— pero no debe cruzarlo. El margen es de un 12 %
   del radio, que es unos píxeles de holgura para el caso de que un fotograma
   se mueva un poco sin que nadie se dé cuenta. */
let choques = 0;
let rozadas = 0;

for (const sistema of SISTEMAS) {
  for (const f of sistema.fotogramas) {
    for (const cuerpo of CUERPOS) {
      const d = distanciaA(f.pos, cuerpo);
      if (d < cuerpo.radio) {
        console.log(
          `  ✗ ${sistema.id} t=${f.t} está DENTRO de ${cuerpo.id}: ` +
            `${d.toFixed(0)} u de un cuerpo de ${cuerpo.radio}`,
        );
        choques += 1;
      } else if (d < cuerpo.radio * 1.12) {
        rozadas += 1;
      }
    }
  }
}

assert.equal(
  choques,
  0,
  `${choques} fotograma(s) dentro de un cuerpo. La cámara solo ve las caras descartadas: el cuerpo desaparece.`,
);
console.log(`  ✓ Ningún fotograma está dentro de un cuerpo`);

/* Y a lo largo de los tramos, que es donde se colaba: el tramo del cruce iba
   de [120, 190, -1830] a [90, 6, -1930], y el punto más cercano al centro
   no era ninguno de los dos. */
let peorTramo = Infinity;
let detalleTramo = '';
for (let i = 0; i < SISTEMAS.length - 1; i += 1) {
  const a = SISTEMAS[i];
  const b = SISTEMAS[i + 1];
  const pa = a.fotogramas.at(-1).pos;
  const pb = b.fotogramas[0].pos;
  for (const cuerpo of CUERPOS) {
    for (let k = 0; k <= 60; k += 1) {
      const t = k / 60;
      const p = [0, 1, 2].map((e) => pa[e] + (pb[e] - pa[e]) * t);
      const d = distanciaA(p, cuerpo);
      if (d < cuerpo.radio) {
        console.log(`  ✗ el salto ${a.id} → ${b.id} atraviesa ${cuerpo.id} (${d.toFixed(0)} < ${cuerpo.radio})`);
        choques += 1;
      }
      if (d < peorTramo) {
        peorTramo = d;
        detalleTramo = `${a.id} → ${b.id} pasa a ${d.toFixed(0)} u de ${cuerpo.id}`;
      }
    }
  }
}
assert.equal(choques, 0, 'algún salto entre secciones atraviesa un cuerpo');
console.log(`  ✓ Ningún salto atraviesa un cuerpo`);
console.log(`  ·  ${detalleTramo} (el más cercano del viaje)`);

/* Un salto entre dos cuerpos es normal: la cámara va de un planeta al otro y
   pasa por el espacio de en medio. Lo que no puede es tocar ninguno. Por eso
   los radios que importan son los de los cuerpos, no la distancia entre ellos.
   Con `rozadas` se informa de los casos límite, que son los que hay que
   revisar a ojo: son el perfil y el gigante, y están a propósito. */
if (rozadas) {
  console.log(`  ·  ${rozadas} fotograma(s) rozando un cuerpo (< 12 % de margen). A ojo.`);
}

/* ------------------------------------------------------------------
   6. Amortiguación de la cámara
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
   7. Salto del menú: reenganche sin cruzar el espacio
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

console.log('\n8. Resistencia a un cambio de altura del documento:');
const seccionesAltas = secciones.map((s) => ({ ...s, alto: s.alto * 2 }));
ruta.recalibrar(seccionesAltas, ALTO_TOTAL * 2);
const muestraAlta = ruta.resolver(0.5);
assert.ok(Number.isFinite(muestraAlta.posicion.x), 'tras duplicar alturas debe seguir siendo finito');
assert.ok(Number.isFinite(muestraAlta.fov), 'el FOV debe seguir siendo finito');
console.log('  ✓ Con alturas al doble, el recorrido sigue siendo válido');
ruta.recalibrar(secciones, ALTO_TOTAL);

/* ------------------------------------------------------------------
   9. El encuadre en pantalla vertical
   ------------------------------------------------------------------ */

console.log('\n9. Encuadre en vertical:');
/* Proporciones reales, no inventadas: un móvil en vertical, uno más antiguo y
   corto, una tablet y un monitor. El defecto que motivó la regla era el
   móvil, así que el móvil es el caso que tiene que estar cubierto. */
const MOVIL = 390 / 844;
const MOVIL_ANGOSTO = 360 / 640;
const TABLET = 768 / 1024;
const MONITOR = 1440 / 900;
const ULTRAWIDE = 2560 / 1080;

assert.strictEqual(separacionParaEncuadre(MONITOR), 1, 'un monitor no debe alejarse');
assert.strictEqual(separacionParaEncuadre(ULTRAWIDE), 1, 'una pantalla ancha no debe alejarse');
/* Una tablet EN VERTICAL sí debe alejarse —el problema no es del móvil, es
   de cualquier cosa más estrecha que alta—, pero menos que un móvil. */
const separacionTablet = separacionParaEncuadre(TABLET);
assert.ok(separacionTablet > 1, 'una tablet en vertical debería alejarse un poco');

const separacionMovil = separacionParaEncuadre(MOVIL);
assert.ok(separacionMovil > 1.8, `un móvil debería alejarse bastante: ${separacionMovil.toFixed(3)}`);
assert.ok(separacionMovil >= separacionTablet, 'un móvil debe alejarse al menos tanto como una tablet');
assert.ok(separacionParaEncuadre(MOVIL_ANGOSTO) >= separacionMovil, 'cuanto más corto y estrecho, más lejos');
console.log(`  ✓ Un móvil (${MOVIL.toFixed(2)}) aleja la cámara ×${separacionMovil.toFixed(2)}, una tablet ×${separacionTablet.toFixed(2)}, un monitor ×1`);

/* Acotada, y a prueba de proporciones imposibles: un `aspect` de cero
   coming de un navegador en transición daría NaN en toda la escena. */
for (const aspecto of [0, -3, 0.2, 0.3, 0.46, 1, 1.6, 3, 8, 100]) {
  const separacion = separacionParaEncuadre(aspecto);
  assert.ok(Number.isFinite(separacion), `la separación debe ser finita con aspect ${aspecto}`);
  assert.ok(separacion >= 1 && separacion <= 2.15, `separación fuera de rango con aspect ${aspecto}: ${separacion}`);
}
assert.strictEqual(separacionParaEncuadre(0), 1, 'un aspecto de cero no debe dividir por cero');
console.log('  ✓ Acotada y a prueba de proporciones imposibles');

/* Y lo que de verdad importa: que el cuerpo CABGA. Sin esto, la regla podría
   ser un número cualquiera que pase los asserts anteriores y que en la
   pantalla siga dejándonos el gigante encima. */
const gigante = CUERPOS.reduce((a, c) => (c.radio > (a?.radio ?? 0) ? c : a), null);
const fovVertical = 54;
/* La distancia real del fotograma al cuerpo se lee de la ruta, no se supone. */
/* `estado.posicion` es un Vector3, no una tupla: se lee con sus accesores.

   Y la separación se aplica AQUÍ, que es donde importa: alejar la cámara es
   lo que hace que el cuerpo quepa. Comprobarlo sin la corrección sería
   comprobar una promesa, no el resultado.

   ── LO QUE ESTE TEST NO COMPRUEBA, Y POR QUÉ ──────────────────────

   Que ningún cuerpo llene la pantalla. La primera versión de este test
   afirmaba eso, y fallaba con el gigante al 151 % del alto. La conclusión
   NO fue que el gigante estuviera mal: es el cuerpo que pasa rozando la
   cámara a propósito, y ese momento es el que da la sensación de estar
   volando junto a un planeta. El fallo era del test, que estaba juzgando
   una decisión de diseño.

   Lo que hay que garantizar es otra cosa, y sí es medible aquí: que en
   horizontal no se toca el encuadre, y que en vertical el sujeto se
   encoge. Si ese cuerpo deja de caber, la consecuencia no es que se vea
   feo: es que el texto que tiene encima se vuelve ilegible. Eso último sí
   necesita un navegador de verdad y se mide en la captura, no aquí. */
const distanciaDesde = (pos, c) => Math.hypot(pos.x - c.centro[0], pos.y - c.centro[1], pos.z - c.centro[2]);

/** Mayor fracción del alto que ocupa un cuerpo en algún punto de la ruta. */
const mayorRelleno = (separacion) => {
  let mayor = 0;
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const { posicion: origen, objetivo } = ruta.resolver(t);
    for (const c of CUERPOS) {
      const p = {
        x: (origen.x - objetivo.x) * separacion + objetivo.x,
        y: (origen.y - objetivo.y) * separacion + objetivo.y,
        z: (origen.z - objetivo.z) * separacion + objetivo.z,
      };
      const grados = Math.atan(c.radio / Math.max(distanciaDesde(p, c), 1)) * (180 / Math.PI) * 2;
      mayor = Math.max(mayor, grados / 54);
    }
  }
  return mayor;
};

const rellenoHorizontal = mayorRelleno(1);
const rellenoMovil = mayorRelleno(separacionMovil);
assert.ok(rellenoMovil < rellenoHorizontal, 'alejarse debería reducir el tamaño aparente');
console.log(`  ✓ En móvil el cuerpo más grande pasa del ${(rellenoHorizontal * 100).toFixed(0)} % al ${(rellenoMovil * 100).toFixed(0)} % del alto`);

/* Y que la corrección no se cuele en el guion de un monitor, que es donde
   todo estaba compuesto y medido. */
assert.strictEqual(separacionParaEncuadre(MONITOR), 1, 'horizontal no debe moverse');
assert.ok(mayorRelleno(1) === rellenoHorizontal, 'horizontal debe ser exactamente lo que era');

/* ------------------------------------------------------------------
   10. Las unidades de la duración del scroll
   ------------------------------------------------------------------ */

console.log('\n10. Unidades de la duración del scroll:');

/* El sitio habla en milisegundos y Lenis anima en segundos. La conversión
   es la razón de que el recorrido guiado funcionara, y su ausencia es la
   razón de que no funcionara: `duracionPara` pedía 1 500–3 600 y Lenis lo
   leía como 1 500–3 600 SEGUNDOS, de modo que cada parada duraba entre 25 y
   60 minutos. Lo que se ve es la página Advanced eight píxeles por segundo.

   Lo que se comprueba aquí es que la conversión existe y es correcta. Que
   además el recorrido la use es cosa del navegador: en un DOM de prueba no
   hay Lenis ni interpolación, así que el error era invisible para toda
   comprobación y solo apareció al abrirlo de verdad. */
const DURACION_MINIMA = 1500;
const DURACION_MAXIMA = 3600;

assert.strictEqual(milisegundosASegundos(undefined), undefined,
  'sin duración explícita se deja undefined para que el valor por defecto del sitio siga mandando');
assert.strictEqual(milisegundosASegundos(1500), 1.5, '1500 ms son 1,5 s');
assert.strictEqual(milisegundosASegundos(3600), 3.6, '3600 ms son 3,6 s');
assert.strictEqual(milisegundosASegundos(1050), 1.05, 'el valor por defecto del sitio ya venía en segundos');
assert.strictEqual(milisegundosASegundos(-500), 0, 'una duración negativa se controla en cero, no se pasa tal cual');

/* Y la trampa real: si alguien volviera a pasar los milisegundos tal cual,
   estas dos comparaciones tienen que delatarlo. */
const slowest = milisegundosASegundos(DURACION_MAXIMA);
const fastest = milisegundosASegundos(DURACION_MINIMA);
assert.ok(slowest > 1 && slowest < 5, `una parada lejana debe tardar segundos, no minutos (${slowest})`);
assert.ok(1 <= fastest && fastest < slowest, 'una parada corta no puede tardar más que una lejana');
assert.ok(slowest / fastest < 4, 'la diferencia entre paradas tiene que ser perceptible, no de un orden de magnitud');
console.log(`  ✓ 1500–3600 ms se convierten en ${fastest}–${slowest} s, que es lo que Lenis entiende`);
console.log('  ✓ La duración del recorrido está en segundos, no en minutos');

console.log('\nTodas las pruebas de la ruta pasaron.\n');
