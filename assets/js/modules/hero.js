/**
 * modules/hero.js — Animaciones de la portada.
 *
 * · Separación del título en letras con retardo escalonado.
 * · Máquina de escribir que rota los roles del desarrollador.
 * · Paralaje del fondo y de la órbita decorativa al hacer scroll.
 * · Reloj UTC en vivo dentro del HUD.
 */

import { $, crear } from '../core/dom.js';
import { alFotograma } from '../core/loop.js';
import { clamp, fechaUTC, horaUTC, movimientoReducido } from '../core/util.js';

const ROLES = [
  'Desarrollador Web Full Stack',
  'Ingeniero Frontend',
  'Especialista en UX/UI',
  'Arquitecto de Interfaces',
  'Backend con Node y Express',
];

const VELOCIDAD_ESCRIBE = 74;
const VELOCIDAD_BORRA = 34;
const PAUSA_ESCRITO = 1900;
const PAUSA_BORRADO = 260;

export function montarHero() {
  const titulo = $('#hero-titulo');
  const maquina = $('#maquina');
  const aura = $('.hero__aura');
  const anillos = $('.hero__anillos');
  const reloj = $('#hud-reloj');
  const fecha = $('#hud-fecha');
  const reducido = movimientoReducido();

  /* ---------- Título letra por letra ---------- */
  if (titulo) {
    const texto = titulo.dataset.texto || titulo.textContent.trim();
    const palabras = texto.split(' ');
    titulo.textContent = '';

    palabras.forEach((palabra, indicePalabra) => {
      const fila = crear('span', { class: 'fila' });

      [...palabra].forEach((letra, indiceLetra) => {
        const nodo = crear('span', { class: 'letra', text: letra });
        nodo.style.animationDelay = `${(indicePalabra * 4 + indiceLetra) * 30}ms`;
        fila.append(nodo);
      });

      titulo.append(fila);
      if (indicePalabra < palabras.length - 1) {
        // Espacio duro: se ve como separador y además existe en el texto
        // que leen los lectores de pantalla.
        titulo.append(crear('span', { class: 'letra letra--hueco', 'aria-hidden': 'true', text: '\u00A0' }));
      }
    });
  }

  /* ---------- Máquina de escribir ---------- */
  if (maquina) {
    let indice = 0;
    let posicion = 0;
    let borrando = false;

    const pintar = () => {
      maquina.textContent = reducido ? ROLES[0] : ROLES[indice].slice(0, posicion);
    };

    if (reducido) {
      maquina.textContent = ROLES[0];
    } else {
      const ciclo = () => {
        const actual = ROLES[indice];

        if (!borrando) {
          posicion += 1;
          if (posicion > actual.length) {
            borrando = true;
            pintar();
            window.setTimeout(ciclo, PAUSA_ESCRITO);
            return;
          }
        } else {
          posicion -= 1;
          if (posicion <= 0) {
            borrando = false;
            indice = (indice + 1) % ROLES.length;
            pintar();
            window.setTimeout(ciclo, PAUSA_BORRADO);
            return;
          }
        }

        pintar();
        window.setTimeout(ciclo, borrando ? VELOCIDAD_BORRA : VELOCIDAD_ESCRIBE);
      };

      pintar();
      window.setTimeout(ciclo, 900);
    }
  }

  /* ---------- HUD ---------- */
  if (reloj) {
    reloj.textContent = horaUTC();
    const intervalo = window.setInterval(() => {
      if (!document.hidden) reloj.textContent = horaUTC();
    }, 1000);
    window.addEventListener('pagehide', () => clearInterval(intervalo), { once: true });
  }
  if (fecha) fecha.textContent = fechaUTC();

  /* ---------- Paralaje ---------- */
  if (reducido || !aura) return;

  function paralaje() {
    const actual = window.scrollY;
    if (actual > window.innerHeight * 1.2) return;

    // El aura se Aleja menos que la página: crea profundidad sin marear.
    const desplazamiento = clamp(actual * -0.1, -90, 20);
    aura.style.transform = `translate3d(0, ${desplazamiento.toFixed(2)}px, 0)`;

    if (anillos) {
      const giro = actual * 0.012;
      const bajada = actual * 0.045;
      anillos.style.transform = `translate(-50%, calc(-50% + ${bajada.toFixed(2)}px)) rotate(${giro.toFixed(2)}deg)`;
    }
  }

  alFotograma(paralaje);
}
