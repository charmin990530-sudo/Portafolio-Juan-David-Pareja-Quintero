/**
 * core/dom.js — Utilidades mínimas para consultar y crear nodos del DOM.
 * Sin dependencias: es la base de todos los módulos de comportamiento.
 */

export const $ = (selector, contexto = document) => contexto.querySelector(selector);

export const $$ = (selector, contexto = document) => Array.from(contexto.querySelectorAll(selector));

/**
 * Registra un listener y devuelve la función para retirarlo.
 * @returns {() => void}
 */
export function on(elemento, evento, manejador, opciones) {
  elemento.addEventListener(evento, manejador, opciones);
  return () => elemento.removeEventListener(evento, manejador, opciones);
}

/**
 * Delegación de eventos: en lugar de un listener por nodo, uno solo en el contenedor.
 */
export function delegar(contenedor, evento, selector, manejador) {
  return on(contenedor, evento, (e) => {
    const destino = e.target instanceof Element ? e.target.closest(selector) : null;
    if (destino && contenedor.contains(destino)) manejador(e, destino);
  });
}

/**
 * Crea un elemento con propiedades y descendientes.
 * @param {string} etiqueta
 * @param {Object} [propiedades] atributos, dataset, style, class, text, html, on
 * @param {Array} [hijos]
 */
export function crear(etiqueta, propiedades = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(propiedades)) {
    if (valor == null) continue;

    if (clave === 'class') nodo.className = valor;
    else if (clave === 'text') nodo.textContent = valor;
    else if (clave === 'html') nodo.innerHTML = valor;
    else if (clave === 'dataset') Object.assign(nodo.dataset, valor);
    else if (clave === 'style') {
      for (const [prop, dato] of Object.entries(valor)) {
        // Las propiedades personalizadas (--x) SOLO se pueden asignar con
        // setProperty: `style['--x'] = ...` se ignora en silencio.
        if (prop.startsWith('--')) nodo.style.setProperty(prop, dato);
        else nodo.style[prop] = dato;
      }
    } else if (clave === 'on') for (const [ev, fn] of Object.entries(valor)) nodo.addEventListener(ev, fn);
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }

  for (const hijo of [].concat(hijos)) {
    if (hijo != null) nodo.append(hijo);
  }

  return nodo;
}

/** SVG necesita su espacio de nombres explícito. */
export function svg(markup) {
  const contenedor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  contenedor.innerHTML = markup;
  return contenedor.firstElementChild;
}

/** Comprueba si un elemento está painted en pantalla. */
export function elementoVisible(elemento) {
  return !!elemento && getComputedStyle(elemento).display !== 'none';
}

export function enRango(valor, min, max) {
  return valor >= min && valor <= max;
}
