/**
 * data/proyectos.js — Los proyectos, uno por planeta del cúmulo.
 *
 * ── CÓMO AÑADIR UN PROYECTO ──────────────────────────────────────────
 *
 * Copia un bloque del array, rellena los campos y listo. No hay que tocar
 * ni el HTML ni el JavaScript del universo: la sección y los planetas se
 * generan solos a partir de este archivo.
 *
 * EstÁ VACÍO A PROPÓSITO. While esté vacío, el módulo oculta la sección y
 * el sistema "cúmulo" del universo ni se construye. No se inventó ningún
 * proyecto ni se puso texto de relleno: es preferible que no haya sección
 * a que haya una llena de "Lorem ipsum" o de.Media inventada en un
 * portafolio que se presenta a clientes.
 *
 * ── CAMPOS ──────────────────────────────────────────────────────────
 *
 *   titulo     Obligatorio. El nombre del proyecto.
 *   resumen     Una frase. Aparece en el subtítulo del panel.
 *   descripcion Dos o tres frases. Es lo que se lee al llegar al planeta.
 *   tecnologias Array de textos. Se muestran como etiquetas.
 *   enlaces     Lista de { texto, url }. `url` puede ser externo.
 *   imagen      Ruta a una captura. Opcional; sin ella se dibuja un
 *               marcador de posición con el color del proyecto.
 *   ancla       `tono:` de los tokens para el color del planeta.
 *   sitio       `true` si tiene web pública: entonces sí entra en el
 *               `sitemaps`. Ponlo solo si la URL es accesible.
 *
 * ── POR QUÉ UN PLANETA POR PROYECTO Y NO UNA GALAXIA ─────────────────
 *
 * Un cúmulo de estrellas ilegible a esta escala no dice nada. Un planeta
 * por proyecto sí: se distinguen de un vistazo, tienen nombre y posición,
 * y el recorrido de la cámara por el cúmulo le da a cada uno su momento.
 */

export const PROYECTOS = [
  /* ────────────────────────────────────────────────────────────────
     EJEMPLO. Descomenta este bloque, cámbialo y ponlo el primero.

  {
    titulo: 'Nombre del proyecto',
    resumen: 'Una frase que se lea de un vistazo.',
    descripcion:
      'Qué es, qué problema resuelve y qué tiene de interesante. Dos o tres frases: el texto largo no se lee en un panel flotante sobre un planeta.',
    tecnologias: ['Angular', 'Node.js', 'MongoDB'],
    enlaces: [
      { texto: 'Ver el sitio', url: 'https://ejemplo.com' },
      { texto: 'Código', url: 'https://github.com/charmin990530-sudo' },
    ],
    imagen: 'assets/img/proyectos/ejemplo.jpg',
    ancla: 'rosa',
    sitio: false,
  },
  ──────────────────────────────────────────────────────────────── */
];

/** Solo los proyectos que tienen nombre. Un bloque a medias no cuenta. */
export const PROYECTOS_VALIDOS = PROYECTOS.filter(
  (p) => typeof p?.titulo === 'string' && p.titulo.trim().length > 0,
);

/** ¿Hay algo que mostrar? De esto depende que exista la sección. */
export const HAY_PROYECTOS = PROYECTOS_VALIDOS.length > 0;
