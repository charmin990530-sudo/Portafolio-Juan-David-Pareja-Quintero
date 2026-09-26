/**
 * modules/tema.js — Alternancia entre el tema "espacio" (oscuro) y "alba" (claro).
 *
 * El tema se guarda en localStorage y, si el visitante nunca ha elegido,
 * se respeta la preferencia del sistema. Además actualiza el color de la
 * barra del navegador en dispositivos móviles.
 */

import { $ } from '../core/dom.js';
import { almacen } from '../core/util.js';

const CLAVE = 'odisea:tema';
const consultaSistema = matchMedia('(prefers-color-scheme: light)');

function temaDelSistema() {
  return consultaSistema.matches ? 'claro' : 'oscuro';
}

function pintarBarraNavegador(tema) {
  const meta = $('meta[name="theme-color"]');
  if (!meta) return;
  meta.content = tema === 'claro' ? '#eef2fb' : '#03050c';
}

export function montarTema() {
  const boton = $('#tema-boton');
  const guardado = almacen.get(CLAVE);
  const inicial = guardado || temaDelSistema();

  document.documentElement.dataset.tema = inicial;
  pintarBarraNavegador(inicial);

  if (boton) {
    boton.addEventListener('click', () => {
      const siguiente = document.documentElement.dataset.tema === 'claro' ? 'oscuro' : 'claro';
      document.documentElement.dataset.tema = siguiente;
      almacen.set(CLAVE, siguiente);
      pintarBarraNavegador(siguiente);
      boton.setAttribute('aria-label', siguiente === 'claro' ? 'Activar tema oscuro' : 'Activar tema claro');
    });
  }

  // Si el visitante no ha elegido, seguimos al sistema en vivo.
  consultaSistema.addEventListener('change', (evento) => {
    if (almacen.get(CLAVE)) return;
    const tema = evento.matches ? 'claro' : 'oscuro';
    document.documentElement.dataset.tema = tema;
    pintarBarraNavegador(tema);
  });

  return {
    alternar() {
      boton?.click();
    },
  };
}
