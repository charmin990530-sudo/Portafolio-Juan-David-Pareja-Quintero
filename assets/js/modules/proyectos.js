/**
 * modules/proyectos.js — Monta la sección de proyectos desde los datos.
 *
 * ── POR QUÉ SE GENERA EN JAVASCRIPT ─────────────────────────────────
 *
 * Porque la sección no existe en `index.html` mientras no haya proyectos.
 * Meterla en el HTML obligaría a esconderla con CSS y a mantener un
 * `<section>` vacío en el documento, que es contenido muerto para el
 * buscador y para el lector de pantalla.
 *
 * Con este módulo pasa al revés: no hay contenido, no hay sección. En
 * cuanto añades un proyecto a `data/proyectos.js`, la sección aparece
 * sola, con su planets y su encabezado, y el sistema "cúmulo" del
 * universo se enciende con ella.
 *
 * Esto mantiene la regla de que el contenido es HTML real: el texto que
 * se genera aquí acaba en el DOM como `<h3>`, `<p>` y `<a>` normales, y
 * un buscador lo encuentra igual. La alternativa —meter el texto en un
 * canvas, que es justo lo que descarta cualquier buscador.
 */

import { $, crear } from '../core/dom.js';
import { HAY_PROYECTOS, PROYECTOS_VALIDOS } from '../data/proyectos.js';

/** Traduce un nombre de token a su valor real. */
function colorDe(ancla) {
  if (!ancla) return null;
  return getComputedStyle(document.documentElement).getPropertyValue(`--${ancla}`).trim() || null;
}

function construirTarjeta(proyecto, indice) {
  const color = colorDe(proyecto.ancla);
  const carta = crear('article', {
    class: 'proyecto',
    dataset: { proyecto: String(indice) },
  });
  if (color) carta.style.setProperty('--proyecto-color', color);

  /* ---------- Portada ---------- */
  const portada = crear('div', { class: 'proyecto__portada' });

  if (proyecto.imagen) {
    const imagen = crear('img', {
      class: 'proyecto__imagen',
      src: proyecto.imagen,
      alt: `Captura de ${proyecto.titulo}`,
      loading: 'lazy',
      decoding: 'async',
    });
    portada.append(imagen);
  } else {
    // Sin captura, un marcador con el color del proyecto en vez de un hueco
    // gris. Se ve deliberado y no como un archivo que falta.
    const marcador = crear('div', { class: 'proyecto__marcador', 'aria-hidden': 'true' });
    marcador.append(crear('span', { class: 'proyecto__marcador-indice mono' }));
    portada.append(marcador);
  }
  carta.append(portada);

  /* ---------- Cuerpo ---------- */
  const cuerpo = crear('div', { class: 'proyecto__cuerpo' });

  if (proyecto.resumen) {
    cuerpo.append(crear('p', { class: 'proyecto__resumen', text: proyecto.resumen }));
  }

  // `h3` y no `div`: la jerarquía de encabezados del documento es
  // h1 (portada) → h2 (cada sección) → h3 (cada proyecto). Un lector de
  // pantalla que navegue por encabezados tiene que encontrar cada proyecto.
  cuerpo.append(crear('h3', { class: 'proyecto__titulo', text: proyecto.titulo }));

  if (proyecto.descripcion) {
    cuerpo.append(crear('p', { class: 'proyecto__descripcion', text: proyecto.descripcion }));
  }

  if (Array.isArray(proyecto.tecnologias) && proyecto.tecnologias.length) {
    const lista = crear('ul', { class: 'proyecto__tecnologias' });
    for (const tecnologia of proyecto.tecnologias) {
      lista.append(crear('li', { class: 'chip chip--pequeno', text: String(tecnologia) }));
    }
    cuerpo.append(lista);
  }

  if (Array.isArray(proyecto.enlaces) && proyecto.enlaces.length) {
    const enlaces = crear('ul', { class: 'proyecto__enlaces' });
    for (const enlace of proyecto.enlaces) {
      if (!enlace?.url || !enlace?.texto) continue;
      const item = crear('li');
      const nodo = crear('a', {
        class: 'btn btn--ghost btn--sm',
        href: String(enlace.url),
        text: String(enlace.texto),
      });
      // Los enlaces externos se abren en pestaña nueva, y con
      // `noopener noreferrer` siempre: sin eso, la página de destino
      // recibe la referencia a la ventana que la abrió y puede navegar
      // este sitio por el visitor. Es un fallo de seguridad, no de estilo.
      if (/^https?:/i.test(enlace.url)) {
        nodo.target = '_blank';
        nodo.rel = 'noopener noreferrer';
      }
      item.append(nodo);
      enlaces.append(item);
    }
    if (enlaces.childElementCount) cuerpo.append(enlaces);
  }

  carta.append(cuerpo);
  carta.dataset.revelar = '';
  return carta;
}

export function montarProyectos() {
  if (!HAY_PROYECTOS) {
    // Sin proyectos no hay sección. Punto.
    document.documentElement.dataset.proyectos = 'sin';
    return () => {};
  }

  // Si el HTML ya trae la sección —porque alguien la añadió a mano— se
  // respeta y solo se rellena el cuerpo.
  let seccion = $('#proyectos');
  const creada = !seccion;

  if (creada) {
    seccion = crear('section', {
      class: 'seccion seccion--borde proyectos',
      id: 'proyectos',
    });
    seccion.setAttribute('aria-labelledby', 'proyectos-titulo');

    const shell = crear('div', { class: 'shell' });

    const cabecera = crear('header', { class: 'section-head' });
    cabecera.dataset.revelar = '';
    cabecera.append(crear('p', { class: 'eyebrow eyebrow--rosa', text: 'Proyectos' }));
    cabecera.append(
      crear('h2', {
        class: 'section-title',
        id: 'proyectos-titulo',
        text: 'Cosas que he construido',
      }),
    );
    cabecera.append(
      crear('p', {
        class: 'section-lead',
        text: 'Cada proyecto es un planeta del cúmulo. Sigue desplazándote para recorrerlos.',
      }),
    );

    const rejilla = crear('div', { class: 'proyectos__rejilla' });
    PROYECTOS_VALIDOS.forEach((proyecto, indice) => {
      rejilla.append(construirTarjeta(proyecto, indice));
    });

    shell.append(cabecera, rejilla);
    seccion.append(shell);

    // Se inserta antes de Contacto: en el guion del universo, el cúmulo va
    // entre las habilidades y la baliza. Insertarlo aquí lo deja en su
    // sitio sin tocar `data/universo.js`.
    $('#contacto')?.before(seccion);
  } else {
    const rejilla = $('.proyectos__rejilla', seccion);
    if (rejilla) {
      PROYECTOS_VALIDOS.forEach((proyecto, indice) => {
        rejilla.append(construirTarjeta(proyecto, indice));
      });
    }
  }

  document.documentElement.dataset.proyectos = 'listo';

  return () => {
    if (creada) seccion.remove();
  };
}
