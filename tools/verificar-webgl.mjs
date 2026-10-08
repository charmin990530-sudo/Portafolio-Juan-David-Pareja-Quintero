#!/usr/bin/env node
/**
 * tools/verificar-webgl.mjs — Abre el sitio en Chromium y falla si algún
 * shader no compila o si la consola da un solo error.
 *
 *   node tools/verificar-webgl.mjs
 *
 * POR QUÉ EXISTE. `verificar-shaders.mjs` es estático: no puede compilar GLSL.
 * Dos errores reales pasaron las doce comprobaciones en verde y dejaron el
 * universo sin estrellas ni planetas: una variable local `fresnel` que tapaba
 * la función del mismo nombre, y un `rand()` que GLSL no tiene. Solo el
 * navegador lo ve, y lo dice en consola. Esta comprobación lee esa consola.
 *
 * Necesita `playwright` (y un Chromium). Si no está, se OMITE sin fallar, igual
 * que `probar-dom.mjs`: el sitio no tiene package.json y no se lo vamos a dar.
 * Instalación puntual:  npm i --no-save playwright && npx playwright install chromium
 *
 * Con GPU de software (SwiftShader) los fps no significan nada; aquí solo
 * interesa que TODO COMPILE y que no haya errores.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

let playwright;
try {
  playwright = createRequire(import.meta.url)('playwright');
} catch {
  console.log('OMITIDA: falta `playwright`. npm i --no-save playwright && npx playwright install chromium');
  process.exit(0);
}

const servidor = createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = join(RAIZ, normalize(ruta));
    if (!archivo.startsWith(RAIZ)) throw new Error('fuera de la raíz');
    res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
    res.end(await readFile(archivo));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${servidor.address().port}/`;

const problemas = new Set();
let navegador;
try {
  navegador = await playwright.chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });

  const resumir = (texto) =>
    texto
      .split('\n')
      .filter((l) => /ERROR|Shader Error|WebGLProgram|program not valid/.test(l))
      .join(' | ')
      .slice(0, 400) || texto.slice(0, 200);

  pagina.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || /program not valid|no valid shader/.test(t)) problemas.add(resumir(t));
  });
  pagina.on('pageerror', (e) => problemas.add(`pageerror: ${String(e).slice(0, 300)}`));

  await pagina.goto(url, { waitUntil: 'load' });
  await pagina.waitForTimeout(4000);

  // Se recorre TODA la página: Three.js crea cada programa la primera vez que
  // el cuerpo se dibuja, así que mirar solo la portada ve tres de diecisiete.
  const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < alto; y += 700) {
    await pagina.evaluate((v) => window.scrollTo(0, v), y);
    await pagina.waitForTimeout(700);
  }
  const lienzo = await pagina.evaluate(() => !!document.querySelector('canvas'));
  if (!lienzo) problemas.add('no hay <canvas>: el universo no arrancó');
} catch (e) {
  problemas.add(`no se pudo ejecutar el navegador: ${String(e).slice(0, 200)}`);
} finally {
  await navegador?.close();
  servidor.close();
}

if (problemas.size) {
  console.log(`FALLA: ${problemas.size} problema(s) en el navegador`);
  for (const p of problemas) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log('Recorrida la página entera en Chromium: cero errores de consola, todos los shaders compilan.');
