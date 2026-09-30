/**
 * tools/probar-calidad.mjs — Arnés de pruebas para universo/calidad.js.
 *
 * El módulo depende de APIs de navegador, así que aquí se falsean antes de
 * importarlo. No es un test de integración: comprueba que la lógica de
 * puntuación y los perfiles se comportan como dice ESTUDIO.md §6.2.
 *
 * Ejecutar: node tools/probar-calidad.mjs
 */

import assert from 'node:assert/strict';

/* ---- Falsear el navegador ---- */

globalThis.window = {
  innerWidth: 1440,
  devicePixelRatio: 2,
  matchMedia: () => ({ matches: false }),
};
globalThis.matchMedia = () => ({ matches: false });
globalThis.document = { createElement: () => ({ getContext: () => null }) };

// En Node 22 `navigator` es un global de solo lectura: hay que redefinirlo.
const NAVIGADOR = { hardwareConcurrency: 8, deviceMemory: 8, connection: { saveData: false } };
Object.defineProperty(globalThis, 'navigator', { value: NAVIGADOR, writable: true, configurable: true });
const nav = globalThis.navigator;

const { NIVELES, perfil, detectarNivel, densidadUI, dprEfectivo, admite, crearSonda } = await import(
  '../assets/js/universo/calidad.js'
);

/* ---- Perfiles ---- */

const ALTO = perfil(NIVELES.ALTO);
const MEDIO = perfil(NIVELES.MEDIO);
const BAJO = perfil(NIVELES.BAJO);

console.log('\nPerfiles');
for (const [nombre, p] of [['alto', ALTO], ['medio', MEDIO], ['bajo', BAJO]]) {
  console.log(
    `  ${nombre.padEnd(5)} icosa=${p.detallePlaneta}  estrellas=${String(p.puntosEstrella).padStart(4)}` +
      `  dpr=${p.dpr}  atmósfera=${p.atmosfera}  fps=${p.objetivoFps}`,
  );
}

// La identidad visual NO puede variar con el nivel: es el principio de ESTUDIO.md §6.5.
assert.equal(admite(NIVELES.ALTO, 'nubes'), true, 'nubes en alto');
assert.equal(admite(NIVELES.MEDIO, 'nubes'), true, 'nubes en medio');
assert.equal(admite(NIVELES.BAJO, 'nubes'), false, 'nubes apagadas en bajo');
assert.equal(admite(NIVELES.ALTO, 'estelas'), true, 'estelas en alto');
assert.equal(admite(NIVELES.BAJO, 'estelas'), false, 'estelas apagadas en bajo');

// Y la progresión de coste debe ser monótona.
assert.ok(ALTO.puntosEstrella > MEDIO.puntosEstrella, 'menos estrellas al bajar');
assert.ok(MEDIO.puntosEstrella > BAJO.puntosEstrella, 'menos estrellas en bajo');
assert.ok(ALTO.detallePlaneta > MEDIO.detallePlaneta, 'menos geometría al bajar');
assert.ok(ALTO.dpr >= MEDIO.dpr && MEDIO.dpr >= BAJO.dpr, 'DPR monótono');

/* ---- Puntuación ---- */

console.log('\nDetección de nivel');
const casos = [
  ['RTX 4070, 16 núcleos, 8 GB, escritorio', { gpu: 'NVIDIA GeForce RTX 4070', nucleos: 16, memoria: 8, tactil: false, ancho: 1920 }, NIVELES.ALTO],
  ['Apple M3, 8 núcleos, 8 GB', { gpu: 'Apple M3', nucleos: 8, memoria: 8, tactil: false, ancho: 1440 }, NIVELES.ALTO],
  ['Iris Xe, 8 núcleos, 8 GB, escritorio', { gpu: 'Intel(R) Iris(TM) Xe Graphics', nucleos: 8, memoria: 8, tactil: false, ancho: 1440 }, NIVELES.MEDIO],
  ['Mali-G78 (Snapdragon 8 Gen 2), 8 núcleos, 4 GB, móvil', { gpu: 'Mali-G78', nucleos: 8, memoria: 4, tactil: true, ancho: 390 }, NIVELES.MEDIO],
  ['Adreno 619 (Snapdragon 4), 4 núcleos, 3 GB, móvil', { gpu: 'Adreno (TM) 619', nucleos: 4, memoria: 3, tactil: true, ancho: 360 }, NIVELES.BAJO],
  ['SwiftShader (render por software)', { gpu: 'Google SwiftShader', nucleos: 8, memoria: 8, tactil: false, ancho: 1920 }, NIVELES.BAJO],
  ['GPU oculta, 2 núcleos, 2 GB, móvil', { gpu: '', nucleos: 2, memoria: 2, tactil: true, ancho: 360 }, NIVELES.BAJO],
];

for (const [nombre, caso, esperado] of casos) {
  const real = detectarNivelCon(caso);
  const ok = real === esperado;
  assert.equal(real, esperado, `${nombre}: esperaba ${esperado}, dio ${real}`);
  console.log(`  ${ok ? '✓' : '✗'} ${nombre.padEnd(38)} → ${real}`);
}

/* ---- saveData se respeta ---- */

const sinAhorro = detectarNivelCon({ gpu: 'Apple M3', nucleos: 16, memoria: 16, tactil: false, ancho: 1920 });
nav.connection = { saveData: true };
const conAhorro = detectarNivelCon({ gpu: 'Apple M3', nucleos: 16, memoria: 16, tactil: false, ancho: 1920 });
assert.equal(sinAhorro, NIVELES.ALTO, 'sin saveData esta máquina da nivel alto');
assert.equal(conAhorro, NIVELES.MEDIO, 'con saveData se cae como mínimo un nivel');
assert.notEqual(conAhorro, NIVELES.BAJO, 'saveData no debe arruinar el aspecto del sitio');
console.log(`  ✓ saveData=true en hardware potente: ${sinAhorro} → ${conAhorro} (baja un nivel, no hasta el mínimo)`);
nav.connection = { saveData: false };

/* ---- Densidad de UI y DPR ---- */

console.log('\nInterfaz y DPR');
assert.equal(densidadUI(NIVELES.BAJO).puntos, false, 'sin puntos de navegación en bajo');
assert.equal(densidadUI(NIVELES.ALTO).puntos, true, 'con puntos en alto');
assert.equal(dprEfectivo(NIVELES.ALTO), 1.75, 'DPR acotado por el perfil');
assert.equal(dprEfectivo(NIVELES.BAJO), 1.25, 'DPR acotado en bajo');
globalThis.window.devicePixelRatio = 1;
assert.equal(dprEfectivo(NIVELES.ALTO), 1, 'nunca sube de 1 si el dispositivo no da más');
globalThis.window.devicePixelRatio = 3;
assert.equal(dprEfectivo(NIVELES.BAJO), 1.25, 'un DPR de 3 no rompe el presupuesto');
console.log('  ✓ DPR acotado por perfil y por dispositivo');

/* ---- Sonda: degradación ---- */

console.log('\nSonda de framerate');

function correrSonda({ nivel, deltaMs, fotogramas = 90, objetivo }) {
  const eventos = [];
  const sondear = crearSonda({
    nivel,
    objetivo,
    fotogramas,
    alDegradar: (nuevo) => eventos.push({ tipo: 'degradar', nivel: nuevo }),
    alTerminar: (r) => eventos.push({ tipo: 'terminar', ...r }),
  });
  // `performance.now` no existe en el arnés: se simula con un contador.
  let reloj = 0;
  const real = performance.now;
  performance.now = () => (reloj += deltaMs);
  for (let i = 0; i < fotogramas + 5; i += 1) sondear(deltaMs);
  performance.now = real;
  return eventos;
}

const lento = correrSonda({ nivel: NIVELES.ALTO, deltaMs: 33, objetivo: 55 });
const degrade = lento.find((e) => e.tipo === 'degradar');
assert.equal(degrade?.nivel, NIVELES.MEDIO, '30 fps con objetivo 55 debe degradar a medio');
assert.ok(lento.find((e) => e.tipo === 'terminar').fps < 35, 'el fps reportado debe ser real (~30)');
console.log(`  ✓ 33 ms/quadro (30 fps) → degrada a medio, reporta ${lento.find((e) => e.tipo === 'terminar').fps.toFixed(1)} fps`);

const rapido = correrSonda({ nivel: NIVELES.ALTO, deltaMs: 16, objetivo: 55 });
assert.equal(rapido.find((e) => e.tipo === 'degradar'), undefined, 'a 60 fps no debe degradar');
console.log(`  ✓ 16 ms/quadro (60 fps) → no degrada, reporta ${rapido.find((e) => e.tipo === 'terminar').fps.toFixed(1)} fps`);

const yaBajo = correrSonda({ nivel: NIVELES.BAJO, deltaMs: 60, objetivo: 30 });
assert.equal(yaBajo.find((e) => e.tipo === 'degradar'), undefined, 'ya está en el nivel mínimo: no hay dónde bajar');
console.log('  ✓ ya en nivel bajo → no intenta degradar por debajo del mínimo');

console.log('\nTodas las pruebas pasaron.\n');

/* ---- Utilidad:Adaptar el escenario al módulo ---- */

function detectarNivelCon({ gpu, nucleos, memoria, tactil, ancho }) {
  const guardados = {
    nucleos: nav.hardwareConcurrency,
    memoria: nav.deviceMemory,
    tactil: globalThis.matchMedia(() => ({ matches: false })),
    ancho: window.innerWidth,
  };
  nav.hardwareConcurrency = nucleos;
  nav.deviceMemory = memoria;
  window.innerWidth = ancho;
  globalThis.matchMedia = (q) => ({ matches: tactil && q.includes('coarse') });

  const resultado = detectarNivel({ gpu });

  nav.hardwareConcurrency = guardados.nucleos;
  nav.deviceMemory = guardados.memoria;
  window.innerWidth = guardados.ancho;
  globalThis.matchMedia = () => ({ matches: false });

  return resultado;
}
