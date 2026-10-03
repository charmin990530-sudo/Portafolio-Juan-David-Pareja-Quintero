/**
 * modules/preloader.js — Apertura cinemática.
 *
 * Espera a que terminen de cargar los recursos críticos (fuentes y la
 * imagen del hero) y luego retira la cortina. La barra circular se
 * alimenta con el progreso real de `document.readyState` combinado con
 * el de carga de los recursos clave, no con un temporizador falso.
 */

import { $, on } from '../core/dom.js';
import { clamp, esperar, movimientoReducido } from '../core/util.js';

const RECURSOS_CLAVE = ['assets/img/perfil.jpg'];

const ESTADOS = [
  'iniciando motor',
  'preparando el fondo',
  'montando secciones',
  'cargando tipografías',
  'todo listo',
];

function progresoDeCarga() {
  const recursos = performance.getEntriesByType('resource');
  if (!recursos.length) return 0.6;

  const total = RECURSOS_CLAVE.length;
  const listos = RECURSOS_CLAVE.filter((ruta) =>
    recursos.some((r) => r.name.endsWith(ruta) && r.responseEnd > 0),
  ).length;

  return 0.35 + (listos / total) * 0.5;
}

export function montarPreloader() {
  const preloader = $('#preloader');
  const porcentaje = $('#preloader-porcentaje');
  const estado = $('#preloader-estado');
  const barra = $('#preloader-barra');

  if (!preloader) return Promise.resolve();

  // La cortina nunca debe atrapar al usuario si algo falla.
  const redDeSeguridad = setTimeout(() => cerrar(100), 6000);

  let valor = 0;
  let destino = 0;
  let indiceEstado = -1;
  let activo = true;

  function pintar() {
    valor += (destino - valor) * 0.12;
    const mostrado = Math.round(clamp(valor, 0, 100));

    if (porcentaje) porcentaje.textContent = `${mostrado}%`;
    if (barra) barra.style.strokeDashoffset = String(905 - (905 * mostrado) / 100);

    const nuevo = Math.min(ESTADOS.length - 1, Math.floor((mostrado / 100) * ESTADOS.length));
    if (nuevo !== indiceEstado && estado) {
      indiceEstado = nuevo;
      estado.textContent = ESTADOS[nuevo];
    }

    if (activo && Math.abs(destino - valor) > 0.4) requestAnimationFrame(pintar);
  }

  requestAnimationFrame(pintar);

  function cerrar(final) {
    if (!activo) return;
    activo = false;
    clearTimeout(redDeSeguridad);
    if (porcentaje) porcentaje.textContent = '100%';
    if (barra) barra.style.strokeDashoffset = '0';
    if (estado) estado.textContent = ESTADOS[ESTADOS.length - 1];

    esperar(movimientoReducido() ? 60 : 320).then(() => {
      preloader.dataset.estado = 'oculto';
      document.body.dataset.cargado = '1';
      window.setTimeout(() => preloader.remove(), 800);
    });

    return final;
  }

  async function esperarListo() {
    destino = Math.max(destino, progresoDeCarga());

    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => {});
    }
    destino = Math.max(destino, 0.85);

    await esperar(movimientoReducido() ? 40 : 260);
    destino = 1;
  }

  const listo = esperarListo();

/* La baja se guarda y se usa en cuanto el preloader deja de hacer falta.
   Antes se llamaba a `on()` sin conservarla: el escuchador de `load` se
   quedaba vivo apuntando a `destino`, que es una variable de este módulo ya
   retirado. */
const bajaCarga = on(window, 'load', () => {
  destino = 1;
});

return listo
  .then(() => cerrar(100))
  .finally(() => bajaCarga());
}
