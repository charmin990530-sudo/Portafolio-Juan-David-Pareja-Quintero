/**
 * core/util.js — Matemáticas, formato y preferencias de movimiento.
 * Funciones puras y sin efectos secundarios.
 */

export const clamp = (valor, min, max) => Math.min(Math.max(valor, min), max);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Normaliza un valor dentro de [entrada] a [salida]. */
export function mapear(valor, entradaMin, entradaMax, salidaMin, salidaMax) {
  if (entradaMax === entradaMin) return salidaMin;
  const t = (valor - entradaMin) / (entradaMax - entradaMin);
  return salidaMin + t * (salidaMax - salidaMin);
}

export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/** Número aleatorio dentro de un rango. */
export const aleatorio = (min, max) => min + Math.random() * (max - min);

/** Elige un elemento al azar de una lista. */
export const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

/** Interpolación exponencial independiente del framerate. */
export function suavizar(actual, objetivo, factor, delta = 16.67) {
  return lerp(actual, objetivo, 1 - Math.exp(-factor * (delta / 1000)));
}

const consultaMovimiento = matchMedia('(prefers-reduced-motion: reduce)');

export const movimientoReducido = () => consultaMovimiento.matches;

export function alCambiarMovimiento(callback) {
  const evento = () => callback(consultaMovimiento.matches);
  consultaMovimiento.addEventListener('change', evento);
  return () => consultaMovimiento.removeEventListener('change', evento);
}

/** Formatea números con separador de miles Colombian. */
const formateador = new Intl.NumberFormat('es-CO');
export const numero = (valor, decimales = 0) =>
  formateador.format(decimales ? valor.toFixed(decimales) : Math.round(valor));

/** Reloj de mission control: HH:MM:SS */
export function horaUTC() {
  return new Date().toLocaleTimeString('es-CO', {
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** "25 SEP 2026" — formato de panel de control, sin depender del locale. */
export function fechaUTC() {
  const ahora = new Date();
  const dia = ahora.toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit' });
  return `${dia} ${MESES[ahora.getUTCMonth()]} ${ahora.getUTCFullYear()}`;
}

const ALMACEN = {
  get(clave, porDefecto = null) {
    try {
      const bruto = localStorage.getItem(clave);
      return bruto === null ? porDefecto : JSON.parse(bruto);
    } catch {
      return porDefecto;
    }
  },
  set(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      /* modo privado o cuota llena: el sitio sigue funcionando */
    }
  },
  borrar(clave) {
    try {
      localStorage.removeItem(clave);
    } catch {
      /* sin efecto */
    }
  },
};

export const almacen = ALMACEN;

/** Espera activa: resuelve cuando el tiempo se cumple o el usuario se va. */
export function esperar(ms, senal) {
  return new Promise((resolve) => {
    const temporizador = setTimeout(resolve, ms);
    senal?.addEventListener('abort', () => {
      clearTimeout(temporizador);
      resolve();
    }, { once: true });
  });
}
