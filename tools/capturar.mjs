#!/usr/bin/env node
/**
 * tools/capturar.mjs — Saca capturas del sitio en posiciones de scroll dadas.
 *
 *   node tools/capturar.mjs <prefijo> <nivel> <posiciones> [ancho] [alto]
 *
 *   node tools/capturar.mjs inicio alto 0,300,700,1100
 *   node tools/capturar.mjs movil medio todo 390 844
 *
 * <nivel>       auto | alto | medio | bajo | off  (lo mismo que el selector).
 *               Usa `alto` para juzgar el aspecto: en `auto` la sonda de
 *               fotogramas degrada sola con GPU de software y todo sale feo.
 * <posiciones>  píxeles de scroll separados por comas, o `todo` (cada 900 px).
 *
 * Las imágenes van a /tmp/capturas/<prefijo>_<n>.png (fuera del repositorio).
 * Hay que ABRIRLAS y mirarlas: que el script termine no dice que se vea bien.
 *
 * Necesita `playwright`: npm i --no-save playwright && npx playwright install chromium
 */

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = '/tmp/capturas';
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};

const [prefijo, nivel = 'alto', posiciones = '0', ancho = '1440', alto = '900'] = process.argv.slice(2);
if (!prefijo) {
  console.log('Uso: node tools/capturar.mjs <prefijo> <nivel> <posiciones|todo> [ancho] [alto]');
  process.exit(2);
}

let playwright;
try {
  playwright = createRequire(import.meta.url)('playwright');
} catch {
  console.log('Falta `playwright`: npm i --no-save playwright && npx playwright install chromium');
  process.exit(2);
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

await mkdir(SALIDA, { recursive: true });
const navegador = await playwright.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const pagina = await navegador.newPage({ viewport: { width: +ancho, height: +alto } });
  const errores = [];
  pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 160)));
  await pagina.goto(`http://127.0.0.1:${servidor.address().port}/`, { waitUntil: 'load' });
  await pagina.waitForTimeout(4000);
  if (nivel !== 'auto') {
    // Elegir un nivel RECARGA la página tras una pequeña espera (calidadVisual.js).
    await Promise.all([
      pagina.waitForNavigation({ waitUntil: 'load', timeout: 20000 }),
      pagina.selectOption('#calidad-selector', nivel),
    ]);
    await pagina.waitForTimeout(4000);
  }
  const total = await pagina.evaluate(() => document.documentElement.scrollHeight);
  const lista = posiciones === 'todo'
    ? Array.from({ length: Math.ceil(total / 900) }, (_, i) => i * 900)
    : posiciones.split(',').map(Number);

  for (const [i, y] of lista.entries()) {
    await pagina.evaluate((v) => window.scrollTo(0, v), y);
    await pagina.waitForTimeout(4500); // SwiftShader es lento: el viaje necesita tiempo para asentarse
    const archivo = join(SALIDA, `${prefijo}_${i}.png`);
    await pagina.screenshot({ path: archivo });
    const hud = await pagina.evaluate(() => document.querySelector('.hud-sistema')?.innerText.replace(/\s+/g, ' ') ?? '');
    console.log(`${archivo}  scroll=${y}/${total}  HUD="${hud}"`);
  }
  console.log(errores.length ? `ERRORES DE CONSOLA (${errores.length}): ${errores[0]}` : 'Consola limpia.');
} finally {
  await navegador.close();
  servidor.close();
}
