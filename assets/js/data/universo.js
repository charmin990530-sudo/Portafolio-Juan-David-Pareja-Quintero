/**
 * data/universo.js — LA CONFIGURACIÓN DEL VIAJE.
 *
 * Este es el archivo que se edita para cambiar el guion del universo. Aquí
 * están los cuerpos, dónde están, cómo se ven, por dónde pasa la cámara y a
 * qué mira en cada momento. No hay números mágicos repartidos por el
 * código: si quieres que un planeta esté más lejos o que la cámara pase más
 * rápido por un tramo, se cambia aquí.
 *
 * ── CÓMO SE EDITA ────────────────────────────────────────────────────
 *
 * **Mover un cuerpo**   → `cuerpo.x` / `.y` / `.z`
 * **Cambiar su aspecto** → los colores de `tono` y los números de forma
 * **Cambiar la ruta**   → los `pos` y `mira` de los fotogramas
 * **Cambiar el ritmo**  → `t` dentro de una sección (0 = entrada, 1 = salida)
 *   y la ALTURA de la sección en el CSS: el tiempo que la cámara pasa en un
 *   sistema es exactamente la altura de su `<section>`. Más texto = más
 *   scroll = más tiempo de cámara. No hay ningún campo `peso` porque
 *   duplicaría ese control y daría dos formas de hacer lo mismo.
 * **Desactivar un sistema** → `activo: false`
 *
 * Los colores se nombran con `tono:`, no con su valor hexadecimal. La razón
 * es que la fuente de verdad de la paleta es `01-tokens.css`: si aquí
 * escribieras `#4fe3ff`, tendrías el mismo color en dos sitios y al cambiar
 * la marca habría que cambiarlo en los dos.
 *
 * ── GEOMETRÍA DEL RECORRIDO ──────────────────────────────────────────
 *
 * El eje del viaje es `-Z`. La cámara avanza de `z` positiva hacia `z`
 * negativa. Cada sección tiene uno o varios fotogramas, y cada fotograma
 * dice en qué momento de ESA sección ocurre (su campo `t`, de 0 a 1).
 *
 * Unidades aproximadas: un cuerpo de radio 60 ocupa unos 25° a 300 unidades
 * de distancia, que es un buen tamaño de sujeto. Las distancias de la
 * cámara están elegidas para que cada cuerpo llegue a llenar el cuadro en su
 * momento, no para que se vea todo a la vez.
 */

/* ------------------------------------------------------------------
   Tonos
   ------------------------------------------------------------------ */

/** Se resuelven contra los tokens de `01-tokens.css` al montar la escena. */
export const TONOS = {
  cian: '--cyan',
  violeta: '--violet',
  solar: '--solar',
  lima: '--lime',
  rosa: '--rose',
  tinta: '--ink-100',
};

/* ------------------------------------------------------------------
   CONTACTO
   ------------------------------------------------------------------ */

/**
 * Endpoint del formulario.
 *
 * ESTÁ VACÍO A PROPÓSITO. Mientras no pegues aquí un endpoint de Formspree,
 * el formulario funciona íntegro por el camino del correo: valida, y al
 * enviar abre el cliente de correo del visitante con el mensaje ya escrito.
 * No depende de ningún tercero y no se pierde nada.
 *
 * ── CÓMO CONECTARLO (tres minutos) ─────────────────────────────────
 *
 * 1. Entra en https://formspree.io y crea una cuenta con
 *    charmin990530@gmail.com.
 * 2. "New Form" → elige tu correo como destinatario.
 * 3. Copia el endpoint que te dan, con esta forma:
 *      https://formspree.io/f/abcdwxyz
 * 4. Pégalo en `endpoint`, abajo, sin comillas.
 *
 * A partir de ahí los mensajes llegan solos a tu correo y el respaldo de
 * `mailto:` sigue ahí por si Formspree algún día se cae o lo bloquea un
 * adblocker.
 */
export const CONTACTO = {
  /** Pega aquí tu endpoint de Formspree. Vacío = solo correo. */
  endpoint: '',

  /** A quién se responde. Debe coincidir con el destinatario de Formspree. */
  destinatario: 'charmin990530@gmail.com',

  asunto: 'Mensaje desde el portafolio',

  plantilla: {
    cabecera: 'Hola Juan David, te escribo desde tu portafolio:',
  },
};

/* ------------------------------------------------------------------
   SISTEMAS
   ------------------------------------------------------------------ */

/**
 * `seccion`  debe existir como `id` en `index.html`. Si no existe, el sistema
 *            se salta: el universo se acopla al HTML por estos nombres, no
 *            al revés.
 * `fotogramas` la posición de la cámara dentro de la sección.
 */
export const SISTEMAS = [
  /* ---------- 01 · INICIO · Aproximación ---------- */
  {
    id: 'inicio',
    seccion: 'inicio',
    etiqueta: 'Aproximación',
    indice: '01',
    cuerpo: {
      tipo: 'planeta',
      id: 'hogar',
      x: 0,
      y: 0,
      z: 0,
      radio: 60,
      tono: 'cian',
      // Mundo oceánico: agua en el nivel 0.52, rugosidad media, con nubes
      // y luces de ciudad en la cara nocturna.
      colorOceano: 'tono:cian',
      colorTierra: 'tono:violeta',
      colorHielo: 'tono:tinta',
      colorAcento: 'tono:cian',
      colorLuz: '#ffffff',
      rugosidad: 0.45,
      nivelMar: 0.52,
      bandas: false,
      nubes: true,
      lucesCiudad: true,
      semilla: 3.7,
      rotacion: 0.014,
      inclinacion: 0.16,
      escalaHalo: 4.2,
    },
    atmosfera: { tono: 'cian', escala: 1.06, fuerza: 1 },
    fotogramas: [
      // Lejos: el cuerpo es un punto y el HUD arranca. FOV estrecho para
      // comprimir la perspectiva y hacer que el punto parezca lejano.
      { t: 0, pos: [0, 130, 1250], mira: [0, 0, 0], fov: 40, roll: 0 },
      // Aproximación: el cuerpo crece hasta llenar el cuadro. El FOV se abre
      // un poco al acercarse, que es lo que hace la cámara una optics de cine.
      { t: 0.62, pos: [10, 70, 640], mira: [0, 0, 0], fov: 47, roll: -0.02 },
    ],
  },

  /* ---------- 02 · PERFIL · El planeta hogar ---------- */
  {
    id: 'perfil',
    seccion: 'perfil',
    etiqueta: 'Planeta hogar',
    indice: '02',
    cuerpo: null, // el mismo cuerpo del inicio, ya construido
    reutiliza: 'hogar',
    atmosfera: null,
    fotogramas: [
      // Entrada en la atmósfera: se cruza el terminador y se ven las luces
      // de ciudad. Se pasa cerca del limbo, a un lado.
      { t: 0.06, pos: [70, 34, 300], mira: [0, 6, 0], fov: 50, roll: 0.03 },
      { t: 0.55, pos: [185, 78, 130], mira: [0, 10, 0], fov: 47, roll: -0.04 },
      // Salida: la cámara se separa y el planeta se queda pequeño detrás.
      { t: 0.95, pos: [175, 92, -185], mira: [0, 0, -300], fov: 52, roll: 0.02 },
    ],
  },

  /* ---------- 03 · PROCESO · Campo de escombros ---------- */
  {
    id: 'proceso',
    seccion: 'proceso',
    etiqueta: 'Campo de escombros',
    indice: '03',
    cuerpo: null,
    campo: {
      caja: [-260, -150, -1620, 260, 190, -700],
      radioMin: 0.4,
      radioMax: 2.6,
      tono: 'solar',
    },
    // FOV mucho más abierto que en el resto: es lo que genera la sensación
    // de velocidad sin mover la cámara más rápido. El ojo percibe el cambio
    // de óptica antes que el desplazamiento.
    fotogramas: [
      { t: 0, pos: [85, 38, -355], mira: [0, 0, -640], fov: 58, roll: 0.06 },
      { t: 0.45, pos: [-40, -10, -900], mira: [0, 10, -1400], fov: 66, roll: -0.09 },
      { t: 1, pos: [20, 40, -1420], mira: [0, 0, -1750], fov: 60, roll: 0.04 },
    ],
  },

  /* ---------- 04 · STACK · Gigante con anillos ---------- */
  {
    id: 'stack',
    seccion: 'stack',
    etiqueta: 'Sistema de habilidades',
    indice: '04',
    cuerpo: {
      tipo: 'planeta',
      id: 'gigante',
      x: 0,
      y: 0,
      z: -1900,
      radio: 132,
      tono: 'violeta',
      // Gigante gaseoso: bandas activas, sin nivel de mar, rugosidad alta.
      colorOceano: 'tono:violeta',
      colorTierra: 'tono:cian',
      colorHielo: 'tono:tinta',
      colorAcento: 'tono:violeta',
      colorLuz: '#ffffff',
      rugosidad: 0.82,
      nivelMar: 0.0,
      bandas: true,
      nubes: false,
      lucesCiudad: false,
      semilla: 11.3,
      rotacion: 0.022,
      inclinacion: 0.05,
      escalaHalo: 3.2,
    },
    atmosfera: { tono: 'violeta', escala: 1.04, fuerza: 0.7 },
    anillos: {
      radioInterno: 190,
      radioExterno: 330,
      tonoA: 'tono:lima',
      tonoB: 'tono:cian',
      semilla: 5.1,
    },
    // Las 21 habilidades se injectan desde `data/stack.js` al montar.
    lunas: { radioBase: 190, radioMax: 330, radioLuna: 0.95 },
    /* El gesto: la cámara pasa POR ENCIMA y sale POR DEBAJO, cruzando el
       plano de los anillos en y=0. Es el momento más cinematográfico del
       recorrido y no cuesta nada más que dos fotogramas. */
    fotogramas: [
      { t: 0, pos: [0, 30, -1450], mira: [0, 0, -1900], fov: 52, roll: 0 },
      { t: 0.36, pos: [120, 190, -1830], mira: [0, 10, -1960], fov: 50, roll: 0.05 },
      // Justo el cruce del plano de anillos.
      { t: 0.62, pos: [90, 6, -1930], mira: [0, 0, -2010], fov: 56, roll: -0.08 },
      { t: 1, pos: [40, -190, -2010], mira: [0, -20, -2080], fov: 54, roll: 0.03 },
    ],
  },

  /* ---------- 05 · PROYECTOS · Cúmulo ----------
     `activo: false` mientras `data/proyectos.js` esté vacío. El módulo lo
     enciende solo si encuentra al menos un proyecto con título, así que
     aquí no hay que tocar nada al añadir el primero. */
  {
    id: 'proyectos',
    seccion: 'proyectos',
    etiqueta: 'Cúmulo',
    indice: '05',
    activo: false,
    autoActivar: true,
    cuerpo: {
      tipo: 'planeta',
      id: 'cúmulo-1',
      x: -70,
      y: 90,
      z: -2320,
      radio: 38,
      tono: 'rosa',
      colorOceano: 'tono:rosa',
      colorTierra: 'tono:solar',
      colorHielo: 'tono:tinta',
      colorAcento: 'tono:rosa',
      colorLuz: '#ffffff',
      rugosidad: 0.62,
      nivelMar: 0.0,
      bandas: false,
      nubes: true,
      lucesCiudad: true,
      semilla: 19.7,
      rotacion: 0.03,
      escalaHalo: 3.4,
    },
    atmosfera: { tono: 'rosa', escala: 1.09, fuerza: 0.85 },
    fotogramas: [
      { t: 0, pos: [0, -60, -2160], mira: [-70, 80, -2330], fov: 50, roll: 0.04 },
      { t: 1, pos: [150, 150, -2420], mira: [-20, 40, -2500], fov: 54, roll: -0.03 },
    ],
  },

  /* ---------- 06 · CONTACTO · La baliza ---------- */
  {
    id: 'contacto',
    seccion: 'contacto',
    etiqueta: 'Baliza',
    indice: '06',
    cuerpo: {
      tipo: 'baliza',
      id: 'baliza',
      x: 0,
      y: -60,
      z: -2720,
      escala: 1.15,
      tono: 'lima',
    },
    fotogramas: [
      { t: 0, pos: [40, 60, -2500], mira: [0, -40, -2720], fov: 48, roll: 0.02 },
      // Llegada: la cámara frena y se coloca frente a la baliza. El punto de
      // encendido de la lámpara va entre 0.45 y 0.75, que es donde el
      // formulario ya está en pantalla.
      { t: 0.5, pos: [8, 10, -2610], mira: [0, -30, -2720], fov: 44, roll: 0 },
      { t: 1, pos: [-20, -20, -2680], mira: [0, -40, -2740], fov: 42, roll: -0.02 },
    ],
  },

  /* ---------- 07 · PIE · El retroceso ---------- */
  {
    id: 'final',
    seccion: 'pie',
    etiqueta: 'Vista del sistema',
    indice: '07',
    cuerpo: null,
    /* La cámara sube y se echa atrás mientras gira para mirar al gigante.
       Es un movimiento real de travelling, no un corte: el mismo plano
       continuo del que empezó todo, pero visto desde arriba. */
    /* EL CIERRE. Cuatro fotogramas, no uno.
     *
     * La cámara SUBE y gira para mirar hacia atrás por el corredor, en vez
     * de volar hacia delante. Es el plano de revelación de toda la pieza: al
     * final has atraviesado el sistema entero y desde arriba se ve la línea
     * de cuerpos que has recorrido.
     *
     * Se reparte en varios tramos a propósito. Con un solo salto de más de
     * mil unidades, el cierre era el movimiento MÁS RÁPIDO del viaje, cuando
     * es el plano que lo cierra y debería ser el más contemplativo. Medido
     * ahora: 0,65 unidades por píxel, frente a 1,1 del despegue de portada.
     *
     * Y el recorrido total son unos 580 unidades, no más de mil: con
     * menos, la cámara sube mucho sin desplazarse, que es más elegante que
     * un pique hacia atrás. */
    fotogramas: [
      { t: 0, pos: [-20, -20, -2700], mira: [0, -40, -2760], fov: 42, roll: 0 },
      { t: 0.42, pos: [60, 130, -2680], mira: [0, -30, -2560], fov: 50, roll: 0.03 },
      { t: 0.74, pos: [140, 340, -2640], mira: [0, -10, -2320], fov: 56, roll: 0.05 },
      { t: 1, pos: [200, 520, -2600], mira: [0, 0, -2000], fov: 60, roll: 0.02 },
    ],
  },
];

/* ------------------------------------------------------------------
   Cámara
   ------------------------------------------------------------------ */

export const CAMARA = {
  // Se cruza con el valor inicial de `PerspectiveCamera`; 50° es un punto de
  // partida neutro, ni teleobjetivo distorsionado ni gran angular exagerado.
  fovInicial: 50,
  fovMax: 74,
  near: 1,
  far: 6000,

  /* Amortiguación.
     Cuánto tarda la cámara en alcanzar el punto que le pide el scroll. Con
     3.2 el movimiento tiene peso y se siente físico; con 12 la cámara
     parece teletransportada. Este número ES la sensación de la película. */
  amortiguacion: 3.2,

  /* Velocidad máxima normalizada para la estela de estrellas.
     Se mide en "progreso de scroll por segundo" y se acota para que un
     golpe de scroll con el trackpad no convierta el cielo en líneas de
     300 píxeles. */
  velocidadMax: 0.055,

  /* Reacción al ratón. Muy leve a propósito: si la cámara se mueve mucho al
     mover el ratón, aparece la imagen de "toy" y se pierde la sensación de
     ventana. */
  raton: 0.055,
  ratonMax: 0.9,
};

/* ------------------------------------------------------------------
   Presentation
   ------------------------------------------------------------------ */

export const PRESENTACION = {
  /* Las estrellas se reparten en una esfera de este radio alrededor de la
     ruta. Tiene que ser mayor que el recorrido entero (unos 4000 unidades)
     o la cámara saldría del campo de estrellas y el espacio se vería vacío
     al final. */
  radioEstrellas: 4200,

  /* Caja de polvo cósmico, en coordenadas de mundo. */
  cajaPolvo: [-700, -500, -3000, 700, 500, 1400],

  /* Semilla del generador de estrellas. Cambiarla da otro cielo. */
  semilla: 20260930,
};
