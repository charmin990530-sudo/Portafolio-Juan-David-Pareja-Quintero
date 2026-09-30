/**
 * universo/hud.js — Indicador de sistema, puntos de navegación y botones.
 *
 * El HUD no es decoración: es la señalética de la nave, y el sitio ya
 * tenía esa idea antes de este trabajo (`ESTADO / DISPONIBLE`,
 * `UBICACIÓN / BOGOTÁ, CO · UTC−5`, la marquesina de la portada). Esto la
 * completa en vez de inventarla.
 *
 * ACCESIBILIDAD
 * El indicador de sistema va con `aria-live="polite"`: un lector de
 * pantalla anunciará "Sistema 3 de 7" al cambiar de planeta, que es
 * información útil y no ruido. Los puntos de navegación son `<button>`
 * reales, alcanzables con el teclado, y cada uno lleva su etiqueta.
 *
 * El HUD se construye en JavaScript en lugar de estar en `index.html` a
 * propósito: si el universo no se monta —sin WebGL, movimiento reducido,
 * vista simple— este módulo nunca llega a crearse y no queda ni un nodo
 * vacío en el documento.
 */

import { crear } from '../core/dom.js';
import { numero } from '../core/util.js';

export function crearHud({ sistemas }) {
  const raiz = crear('div', {
    class: 'hud-universo',
    dataset: { universoHud: '1' },
  });

  /* ---- Indicador de sistema ---------------------------------------- */
  const indicador = crear('div', { class: 'hud-sistema' });
  const contador = crear('span', { class: 'hud-sistema__cuenta mono' });
  const nombre = crear('span', { class: 'hud-sistema__nombre' });
  const barra = crear('span', { class: 'hud-sistema__barra' });
  const relleno = crear('span', { class: 'hud-sistema__relleno' });

  indicador.append(crear('span', { class: 'hud-sistema__clave mono', text: 'SISTEMA' }));
  barra.append(relleno);
  indicador.append(contador, nombre, barra);

  /* `role="status"` con `aria-live="polite"`: un lector de pantalla
     anunciará el cambio de sistema, que es información útil. Pero el texto
     visual se lee en tres trozos ("SISTEMA", "03 / 07", "Baliza") y eso
     sonaría a partes, así que el `aria-label` de más abajo reescribe la
     frase entera. El visible queda para quien ve, el oculto para quien oye. */
  indicador.setAttribute('role', 'status');
  indicador.setAttribute('aria-live', 'polite');

  /* ---- Puntos de navegación ---------------------------------------- */
  const puntos = crear('nav', { class: 'hud-puntos', 'aria-label': 'Ir a un sistema' });
  const botones = [];

  sistemas.forEach((sistema, indice) => {
    const punto = crear('button', {
      class: 'hud-punto',
      type: 'button',
      dataset: { sistema: sistema.id },
    });
    punto.setAttribute('aria-label', `${sistema.etiqueta}, sistema ${indice + 1} de ${sistemas.length}`);
    punto.append(crear('span', { class: 'hud-punto__marca', 'aria-hidden': 'true' }));

    const envoltorio = crear('li', { class: 'hud-punto__envoltorio' });
    envoltorio.append(punto);
    puntos.append(envoltorio);

    botones.push(punto);
  });

  /* ---- Botones ------------------------------------------------------ */
  const acciones = crear('div', { class: 'hud-acciones' });

  const botonSonido = crear('button', {
    class: 'hud-boton',
    type: 'button',
    dataset: { sonido: '1' },
  });
  botonSonido.setAttribute('aria-pressed', 'false');
  botonSonido.setAttribute('aria-label', 'Activar sonido ambiental');
  botonSonido.append(
    crear('span', { class: 'hud-boton__icono', 'aria-hidden': 'true', html: ICONO_SONIDO }),
  );

  const botonSimple = crear('button', {
    class: 'hud-boton',
    type: 'button',
    dataset: { simple: '1' },
  });
  botonSimple.setAttribute('aria-label', 'Ver la versión simple, sin animación');
  botonSimple.append(crear('span', { class: 'hud-boton__texto', text: 'Vista simple' }));

  acciones.append(botonSonido, botonSimple);

  /* ---- Telemetry --------------------------------------------------- */
  const telemetria = crear('div', { class: 'hud-telemetria mono', 'aria-hidden': 'true' });
  const telemetriaFps = crear('span', { class: 'hud-telemetria__item' });
  const telemetriaNivel = crear('span', { class: 'hud-telemetria__item' });
  telemetria.append(telemetriaFps, telemetriaNivel);

  raiz.append(indicador, puntos, acciones, telemetria);
  document.body.append(raiz);

  /* ---- Estado ------------------------------------------------------- */
  let escena = null;
  let indiceActual = -1;
  let sonidoActivo = false;
  let alCambiarSonido = null;
  let alPedirSimple = null;
  let ultimoInforme = 0;
  let mostrarTelemetria = true;

  /* ---- Botones ------------------------------------------------------ */
  const alPulsarSonido = () => {
    sonidoActivo = !sonidoActivo;
    botonSonido.dataset.activo = sonidoActivo ? '1' : '0';
    botonSonido.setAttribute('aria-pressed', String(sonidoActivo));
    botonSonido.setAttribute(
      'aria-label',
      sonidoActivo ? 'Silenciar el sonido ambiental' : 'Activar sonido ambiental',
    );
    alCambiarSonido?.(sonidoActivo);
  };

  const alPulsarSimple = () => {
    botonSimple.disabled = true;
    botonSimple.dataset.estado = 'cargando';
    alPedirSimple?.();
  };

  botonSonido.addEventListener('click', alPulsarSonido);
  botonSimple.addEventListener('click', alPulsarSimple);

  const alPulsarPunto = (indice) => () => {
    const sistema = sistemas[indice];
    if (!escena || !sistema) return;
    escena.irAPunto(sistema.seccion, { instantaneo: true });
  };

  botones.forEach((boton, indice) => boton.addEventListener('click', alPulsarPunto(indice)));

  /* ---- API ---------------------------------------------------------- */
  return {
    nodo: raiz,

    /** El HUD necesita la escena para poder saltar; se conecta después. */
    conectar(interna) {
      escena = interna;
    },

    /** El orquestador pasa aquí el callback del botón de sonido. */
    onSonido(callback) {
      alCambiarSonido = callback;
    },

    /** Y aquí el del botón de vista simple. */
    onVistaSimple(callback) {
      alPedirSimple = callback;
    },

    /** Refleja el estado guardado, sin disparar el sonido. */
    sincronizarSonido(activo) {
      sonidoActivo = activo;
      botonSonido.dataset.activo = activo ? '1' : '0';
      botonSonido.setAttribute('aria-pressed', String(activo));
    },

    /**
     * Se llama en cada fotograma con los datos de la escena.
     *
     * Solo toca el DOM cuando algo cambia de verdad. Escribir en el DOM 60
     * veces por segundo es lo que hace que un HUD ligero se convierta en
     * un cuello de botella: aquí hay tres nodos y los tres se comparan
     * antes de escribir.
     */
    actualizar(datos = {}) {
      if (datos.sistema) {
        const indice = sistemas.findIndex((s) => s.id === datos.sistema);
        if (indice !== -1 && indice !== indiceActual) {
          indiceActual = indice;
          const sistema = sistemas[indice];
          contador.textContent = `${String(indice + 1).padStart(2, '0')} / ${String(sistemas.length).padStart(2, '0')}`;
          nombre.textContent = sistema.etiqueta;
          indicador.setAttribute(
            'aria-label',
            `Sistema ${indice + 1} de ${sistemas.length}: ${sistema.etiqueta}`,
          );
          // El color del punto activo lo pone el sistema: la Baliza se
          // enciende en lima, el gigante es violeta. Es la misma paleta
          // que la escena, leída del mismo sitio.
          const color = escena?.colorDeSistema?.(sistema.id);
          if (color) {
            const hex = color.getStyle();
            indicador.style.setProperty('--hud-color', hex);
          }
          botones.forEach((boton, i) => {
            boton.dataset.activo = i === indice ? '1' : '0';
            boton.setAttribute('aria-current', i === indice ? 'true' : 'false');
          });
        }
      }

      if (typeof datos.fps === 'number' && mostrarTelemetria) {
        // La telemetría se refresca unas cuatro veces por segundo. A 60
        // fotogramas por segundo, un número que cambia 60 veces es
        // ilegible y no informa de nada.
        const ahora = performance.now();
        if (ahora - ultimoInforme > 250) {
          ultimoInforme = ahora;
          telemetriaFps.textContent = `${numero(datos.fps, 0)} FPS`;
          if (datos.nivel) telemetriaNivel.textContent = String(datos.nivel).toUpperCase();
        }
      }

      if (typeof datos.progreso === 'number') {
        relleno.style.setProperty('--avance', datos.progreso.toFixed(4));
      }
    },

    destroy() {
      botonSonido.removeEventListener('click', alPulsarSonido);
      botonSimple.removeEventListener('click', alPulsarSimple);
      for (const boton of botones) boton.replaceWith(boton.cloneNode(true));
      raiz.remove();
    },
  };
}

/* Icono de altavoz, en línea para no depender de un archivo. */
const ICONO_SONIDO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z"/>
  <path class="hud-boton__onda" d="M16 9.5a3.5 3.5 0 0 1 0 5"/>
  <path class="hud-boton__onda" d="M18.5 7a7 7 0 0 1 0 10"/>
  <path class="hud-boton__tacha" d="M16.5 9.5l5 5m0-5l-5 5"/>
</svg>`;
