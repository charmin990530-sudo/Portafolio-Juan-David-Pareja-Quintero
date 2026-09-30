/**
 * universo/ruta.js — Traduce el scroll del documento en un punto de la curva.
 *
 * EL PROBLEMA QUE RESUELVE. La cámara no puede ir asociada linealmente al
 * scroll, porque las secciones del documento tienen alturas distintas. Si
 * "scroll lineal" se correspondiera con "curva lineal", la cámara se
 * quedaría casi quieta en la sección más larga y cruzaría las demás a toda
 * velocidad. Peor: el cuerpo de cada sección quedaría desalineado de su
 * propio texto.
 *
 * LA SOLUCIÓN. A cada fotograma se le calcula en qué punto del documento
 * ocurre, en función de DÓNDE ESTÁ SU SECCIÓN. Con eso, cada tramo de la
 * cámara se reproduce mientras su sección atraviesa la pantalla, y el
 * encuadre siempre coincide con el texto que se está leyendo.
 *
 * ── POR QUÉ CATMULLROM Y NO UNA LISTA DE PUNTOS ───────────────────────
 *
 * Una interpolación lineal entre fotogramas convierte el recorrido en una
 * poligonal y se ven los vértices. `CatmullRomCurve3` pasa exactamente por
 * los puntos dados, pero con la tangente calculada a partir de los vecinos,
 * así que el camino es suave Y controlable: control exacto de dónde está
 * cada cuerpo, sin aristas.
 *
 * ── POR QUÉ `getPointAt` Y NO `getPoint` ─────────────────────────────
 *
 * `getPoint(t)` reparte los puntos por parámetro de curva; `getPointAt(u)`
 * los reparte por longitud de arco. Con `getPoint`, un tramo con pocos
 * fotogramas y mucha distancia entre ellos se recorre más rápido que uno
 * corto. Se quiere velocidad constante sobre la geometría, no sobre el
 * índice: por eso `getPointAt`.
 */

import { CatmullRomCurve3, Vector3 } from '../../vendor/three/0.186.1/three.module.js';
import { clamp, easeInOutCubic, lerp } from '../core/util.js';

/** Muestras de la tabla de longitud de arco. 400 es de sobra para un
 *  recorrido de esta longitud; subirlo no aporta nada visible. */
const DIVISIONES_ARCO = 400;

/**
 * FRACCIÓN FINAL DE CADA SECCIÓN RESERVADA PARA EL CAMBIO DE PLANO.
 *
 * Sin esto hay un salto. La última llave de una sección cae en su borde
 * inferior, y la primera de la siguiente cae en su borde superior, que es
 * EL MISMO PÍXEL. El tramo entre las dos —que es el movimiento de cámara
 * de un cuerpo al siguiente, varios cientos de unidades— no tendría ni un
 * píxel de scroll y se ejecutaría de golpe, en un solo fotograma.
 *
 * Reservando el último 18 % de cada sección, la cámara empieza a salirse del
 * cuerpo actual mientras el visitante todavía está viendo el texto de esa
 * sección, y llega al siguiente justo cuando su sección entra. Que es como
 * funciona un travelling: el movimiento arranca antes del corte.
 */
const ZONA_DE_CAMBIO = 0.18;

export function crearRuta(sistemas) {
  /* ----------------------------------------------------------------
     1. Recopilar fotogramas de todos los sistemas
     ---------------------------------------------------------------- */

  const anclas = [];

  sistemas.forEach((sistema, indiceSistema) => {
    sistema.fotogramas.forEach((f) => {
      anclas.push({
        indiceSistema,
        sistemaId: sistema.id,
        seccion: sistema.seccion,
        t: f.t,
        pos: f.pos,
        mira: f.mira,
        fov: f.fov,
        roll: f.roll,
        u: 0,
        desplazamiento: 0,
        valido: true,
      });
    });
  });

  if (anclas.length < 2) {
    throw new Error('universo/ruta.js: la ruta necesita al menos dos fotogramas');
  }

  /* ----------------------------------------------------------------
     2. Las curvas
     ---------------------------------------------------------------- */

  const puntos = anclas.map((a) => new Vector3(...a.pos));
  const objetivos = anclas.map((a) => new Vector3(...a.mira));

  const curva = new CatmullRomCurve3(puntos, false, 'catmullrom', 0.35);
  const curvaMira = new CatmullRomCurve3(objetivos, false, 'catmullrom', 0.35);
  curva.arcLengthDivisions = DIVISIONES_ARCO;
  curvaMira.arcLengthDivisions = DIVISIONES_ARCO;

  /* ----------------------------------------------------------------
     3. Posición de cada fotograma sobre la curva
     ----------------------------------------------------------------
     `getLengths()` devuelve las longitudes de arco acumuladas en las mismas
     muestras que usa `getPointAt`. Como los fotogramas SON los puntos de
     control, el índice de la muestra que corresponde al fotograma `i` es
     exactamente su posición. No hace falta buscar ni aproximar: se lee. */

  const longitudes = curva.getLengths();
  const total = longitudes[longitudes.length - 1];
  const muestras = longitudes.length - 1;
  const segmentos = puntos.length - 1;

  for (const [i, ancla] of anclas.entries()) {
    const muestra = Math.round((i / segmentos) * muestras);
    ancla.u = total > 0 ? longitudes[clamp(muestra, 0, muestras)] / total : 0;
  }

  /* ----------------------------------------------------------------
     4. Consulta
     ---------------------------------------------------------------- */

  // Vectores reutilizados: se llama en cada fotograma y no puede asignar.
  const posicion = new Vector3();
  const objetivo = new Vector3();

  function tramoDe(p) {
    for (let i = 0; i < anclas.length - 1; i += 1) {
      if (p < anclas[i + 1].desplazamiento) return i;
    }
    return anclas.length - 2;
  }

  return {
    curva,
    curvaMira,
    anclas,
    sistemas,

    /**
     * Traduce progreso de documento a posición de cámara.
     *
     * ⚠ ATENCIÓN, `posicion` y `objetivo` son VECTORES COMPARTIDOS: son los
     * mismos objetos en todas las llamadas, y se sobrescriben en la
     * siguiente. Es deliberado —llamar a `resolver` dos veces por fotograma
     * no debe crear memoria, y en el bucle de render eso se nota—, pero
     * significa que el resultado hay que CONSUMIRLO ANTES DE LLAMAR OTRA
     * VEZ:
     *
     *   const a = ruta.resolver(p1);        // correcto: se usa enseguida
     *   const b = ruta.resolver(p2);
     *   a.posicion.equals(b.posicion);       // ¡true! es el mismo objeto
     *
     * Si hace falta conservar un resultado, hay que copiarlo:
     * `ruta.resolver(p).posicion.clone()`.
     *
     * @param {number} progreso 0..1 del recorrido total del documento.
     * @returns {{
     *   posicion: Vector3, objetivo: Vector3, fov: number, roll: number,
     *   sistema: string, tramo: number, local: number, curvaVelocidad: number
     * }}
     */
    resolver(progreso) {
      const p = clamp(progreso, 0, 1);
      const i = tramoDe(p);
      const a = anclas[i];
      const b = anclas[i + 1];

      const span = b.desplazamiento - a.desplazamiento;
      const local = span > 0 ? clamp((p - a.desplazamiento) / span, 0, 1) : 0;

      /* `easeInOutCubic` dentro del tramo: la cámara acelera al salir de un
         cuerpo y frena al llegar al siguiente. ESO es el ritmo. Con avance
         lineal, el viaje se sentiría como una barra de progreso. */
      const localSuavizado = easeInOutCubic(local);

      const u = clamp(lerp(a.u, b.u, localSuavizado), 0, 1);
      curva.getPointAt(u, posicion);
      curvaMira.getPointAt(u, objetivo);

      return {
        posicion,
        objetivo,
        fov: lerp(a.fov, b.fov, localSuavizado),
        roll: lerp(a.roll, b.roll, localSuavizado),
        // La velocidad dentro del tramo, en forma de campana: 0 en los
        // extremos, 1 en el punto más rápido. Es lo que alarga las estelas
        // en el centro del tramo y las recoge al frenar.
        curvaVelocidad: Math.sin(local * Math.PI),
        // El sistema al que se "pertenece" este instante. Se elige el de la
        // ancla de llegada salvo en la segunda mitad del tramo, donde ya
        // manda el siguiente: así el HUD cambia de sistema justo cuando el
        // nuevo cuerpo entra en cuadro.
        sistema: local < 0.5 ? a.sistemaId : b.sistemaId,
        tramo: i,
        local,
      };
    },

    /**
     * Reajusta el mapa cuando cambia el alto del documento.
     *
     * Hay que llamar a esto al redimensionar la ventana y después de que
     * carguen las fuentes web, porque las dos cosas alteran la altura del
     * documento y con ella el desplazamiento de cada sección. Si se
     * olvida, la cámara llega tarde a todos los cuerpos menos al primero.
     *
     * @param {Array<{id: string, arriba: number, alto: number}>} secciones
     *   Medidas en coordenadas de documento: `arriba` es el desplazamiento
     *   del borde superior y `alto` la altura de la caja.
     * @param {number} altoTotal  `scrollHeight - innerHeight`.
     */
    recalibrar(secciones, altoTotal) {
      const ultimoSistema = anclas.reduce(
        (mayor, ancla) => Math.max(mayor, ancla.indiceSistema),
        0,
      );

      for (const ancla of anclas) {
        const seccion = secciones.find((s) => s.id === ancla.seccion);

        if (!seccion) {
          /* La sección no existe en el HTML.
             El fotograma se marca como inválido y luego se le da el mismo
             desplazamiento que al anterior, de forma que ocupa cero anchura
             y la cámara lo salta sin quedarse quieta en el sitio. */
          ancla.valido = false;
          continue;
        }

        ancla.valido = true;

        /* La ventana de scroll de un sistema es la de SU SECCIÓN, tal cual:
           desde que su borde superior llega al borde superior de la
           pantalla, hasta que su borde inferior sale por arriba.

           La primera versión sumaba también la altura de la ventana a cada
           sección, y eso hacía que dos secciones consecutivas se solaparan
           en una altura de pantalla entera. Con el solape, el orden de los
           `u` de la curva dejaba de coincidir con el orden del scroll: el
           ajuste de monotonicidad del final machacaba entonces los tramos
           afectados y el movimiento de esos sistemas se comprimía a casi
           cero scroll. Con la ventana justa, las secciones embaldosan el
           documento y el ritmo se respeta. */
        const desde = seccion.arriba;
        const hasta = seccion.arriba + seccion.alto;

        /* El último sistema no comprime: su llave final tiene que coincidir
           con el final real del documento, o el plano de cierre se queda
           corto. */
        const tEfectivo =
          ancla.indiceSistema === ultimoSistema ? ancla.t : ancla.t * (1 - ZONA_DE_CAMBIO);

        ancla.desplazamiento =
          altoTotal > 0 ? (desde + tEfectivo * (hasta - desde)) / altoTotal : 0;
      }

      /* El último sistema llega hasta donde acaba el documento, no hasta
         donde acaba su sección: el scroll se agota `innerHeight` antes, y el
         plano de cierre no puede quedar a medias. */
      for (const ancla of anclas) {
        if (ancla.indiceSistema !== ultimoSistema) continue;
        const seccion = secciones.find((s) => s.id === ancla.seccion);
        if (!seccion) continue;
        const disponible = Math.max(0, altoTotal - seccion.arriba);
        ancla.desplazamiento =
          altoTotal > 0 ? (seccion.arriba + ancla.t * disponible) / altoTotal : 1;
      }

      /* Escalado global. Si aun así alguna ventana se sale del documento, se
         divide toda la línea de tiempo por el mismo factor: así se conserva
         la proporción entre los tramos y el ritmo no cambia de golpe. */
      const mayor = anclas.reduce((maximo, a) => Math.max(maximo, a.desplazamiento), 0);
      if (mayor > 1) {
        for (const ancla of anclas) ancla.desplazamiento /= mayor;
      }

      /* Los fotogramas inválidos se colapsan sobre el anterior válido, para
         que no dejen un hueco en el que la cámara se queda parada. */
      let ultimo = 0;
      for (const ancla of anclas) {
        if (ancla.valido) {
          ultimo = ancla.desplazamiento;
        } else {
          ancla.desplazamiento = ultimo;
        }
      }

      /* Último pase: los desplazamientos tienen que crecer de forma estricta.
         Sin esto, dos fotogramas con el mismo valor (una sección muy corta,
         o fotogramas colapsados) producen un tramo de anchura cero, y la
         cámara salta de un cuerpo al siguiente de golpe. */
      const paso = 0.0002;
      for (let i = 1; i < anclas.length; i += 1) {
        const minimo = anclas[i - 1].desplazamiento + paso;
        if (anclas[i].desplazamiento < minimo) {
          anclas[i].desplazamiento = Math.min(minimo, 1);
        }
      }
      anclas[0].desplazamiento = 0;
    },
  };
}
