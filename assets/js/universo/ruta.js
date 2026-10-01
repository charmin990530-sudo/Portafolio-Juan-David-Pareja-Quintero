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

/**
 * VELOCIDAD DE DISEÑO DE LA CÁMARA: unidades de mundo por píxel de scroll.
 *
 * Es el número que impide que un tramo de la curva se recorra sin scroll.
 * La `ZONA_DE_CAMBIO` de arriba reparte el hueco ENTRE secciones como una
 * fracción de la altura de cada una, y ahí está el problema: la fracción es
 * la misma para todas, pero la DISTANCIA que hay que cubrir no lo es. Un
 * cambio de cuerpo cercano se gasta la misma reserva que uno a mil unidades,
 * y el segundo acaba cruzándose a cuatro o cinco veces la velocidad del
 * primero.
 *
 * Medido sobre el guion de `data/universo.js`: la transición de la portada
 * al planeta de Perfil recorre 950 unidades y recibía 231 px de scroll, o
 * 4,1 unidades por píxel, cuando el resto de la película va entre 0,1 y
 * 1,7. El ojo lo lee como un tirón, no como un travelling.
 *
 * El valor sale de la propia película: el tramo más rápido DEL DISEÑO es
 * la aproximación inicial de la portada, y ese es justo el techo. Por
 * debajo de 0,9 el arranque perdería el golpe; por encima de 1,4 los
 * cambios de cuerpo empezarían a notarse como tirón y no como movimiento.
 */
const VELOCIDAD_OBJETIVO = 1.2;

/**
 * ANCHO MÍNIMO DE UN TRAMO, en progreso normalizado del documento.
 *
 * Red de seguridad para el caso degenerado: dos fotogramas en el mismo
 * punto de la curva dan distancia cero, y un tramo de anchura cero hace
 * que la cámara salte de un cuerpo al siguiente dentro del mismo fotograma.
 */
const ANCHO_MINIMO = 0.0004;

/**
 * CUÁNTAS VECES SE REPARTE EL HOLGURA.
 *
 * El reparto es una proyección sobre el conjunto {ancho ≥ mínimo por
 * distancia} ∩ {suma = 1}. Ese conjunto es convexo, así que el reparto
 * converge, pero no en un solo paso: al subir los tramos cortos hay que
 * encoger el resto, y al encoger el resto alguno puede volver a quedarse
 * corto. Veinticuatro vueltas de sobra —cada una reduce el error un orden
 * de magnitud— y el bucle sale antes en cuanto no queda nada que subir.
 */
const PASOS_REPACING = 24;

export function crearRuta(sistemas) {
  /* ----------------------------------------------------------------
     1. Recopilar fotogramas de todos los sistemas
     ---------------------------------------------------------------- */

  const anclas = [];
  const ventanas = new Map();

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
     3 bis. Repacing: que ningún tramo se recorra sin scroll
     ----------------------------------------------------------------

     Hasta aquí los desplazamientos salen de las alturas de las secciones,
     que es lo correcto: la cámara va donde está el texto. Lo que no
     garantiza es la velocidad, y esa es la mitad de lo que hace que un
     travelling se lea como travelling.

     Esta función NO cambia los fotogramas ni el guion: se limita a repartir
     el mismo scroll entre los mismos tramos. Lo que hace es dar a cada
     tramo el ancho que su distancia necesita para no ir más rápido que
     `VELOCIDAD_OBJETIVO`, y cobrar ese ancho al resto en proporción a lo
     que cada uno tenía de sobra.

     El efecto es el que se busca y es dos cosas a la vez:

       · El tramo que se cruzaba a 4,1 u/px se abre hasta 1,2 u/px, que
         es a ritmo de la película.
       · Los tramos lentos se estrechan proporcionalmente, así que la
         sección de skills o la de contacto no pierden más recorrido del
         que ya tenían: el reparto es conservativo en el conjunto, solo
         redistribuye.

     Lo que NO hace —y por eso se llama repacing y no rediseño— es mover un
     fotograma. La dirección de arte es del guion; aquí solo se garantiza
     que esa dirección sea legible. */
  function repacear(altoTotal) {
    const nTramos = anclas.length - 1;
    if (nTramos < 1 || altoTotal <= 0 || total <= 0) return;

    const anchos = new Array(nTramos);
    const minimos = new Array(nTramos);
    let sumaMinimos = 0;

    for (let i = 0; i < nTramos; i += 1) {
      /* Distancia REAL sobre la curva, no la distancia en línea recta entre
         los dos fotogramas. La CatmullRom se desvía de la cuerda, y con 950
         unidades de recorrido esa desviación es de decenas de unidades: con
         la recta el tramo salía más rápido de lo que realmente va. */
      const distancia = Math.max(0, anclas[i + 1].u - anclas[i].u) * total;
      minimos[i] = Math.max(distancia / VELOCIDAD_OBJETIVO / altoTotal, ANCHO_MINIMO);
      anchos[i] = Math.max(0, anclas[i + 1].desplazamiento - anclas[i].desplazamiento);
      sumaMinimos += minimos[i];
    }

    /* Si el guion pide más scroll del que el documento tiene, la velocidad
       objetivo es matemáticamente imposible: no es un fallo del reparto, es
       un guion que no cabe. Se reparte lo que hay, se escala el objetivo a
       lo que se puede, y se AVISA en consola nombrando el tramo que no
       llega — porque un repo con ese tramo se ve como un tirón y el arreglo
       es de datos, no de algoritmo, y eso hay que saberlo al escribir el
       fotograma y no tres meses después. */
    if (sumaMinimos >= 1) {
      const correccion = 1 / sumaMinimos;
      for (let i = 0; i < nTramos; i += 1) minimos[i] *= correccion;

      /* Con el objetivo escalado TODOS los tramos quedan exactamente a la
         misma velocidad —`VELOCIDAD_OBJETIVO / correccion`—, así que no hay
         un "peor": los tramos se reparten parejos, que es lo único que se
         puede hacer cuando no cabe. Lo que sí hay que señalar es cuánto
         scroll pediría en total, que es el número que dice si el arreglo es
         de una sección o de todas. */
      console.warn(
        `[universo] el guion no cabe en el documento: a ${VELOCIDAD_OBJETIVO} u/px ` +
          `harían falta ${(total / VELOCIDAD_OBJETIVO).toFixed(0)} px de recorrido y el ` +
          `documento solo tiene ${altoTotal}. La cámara irá a ` +
          `${(VELOCIDAD_OBJETIVO / correccion).toFixed(2)} u/px por todos los tramos, ` +
          'que es parejo pero por encima del diseño. Aleja los cuerpos o alarga las secciones.',
      );
    }

    for (let paso = 0; paso < PASOS_REPACING; paso += 1) {
      let suma = 0;
      let subir = 0;

      for (let i = 0; i < nTramos; i += 1) {
        if (anchos[i] < minimos[i]) {
          anchos[i] = minimos[i];
          subir += 1;
        }
        suma += anchos[i];
      }

      if (suma <= 0) return;
      const escala = 1 / suma;
      for (let i = 0; i < nTramos; i += 1) anchos[i] *= escala;

      /* Ni nada que subir ni nada que encoger de más: se ha repartido. */
      if (subir === 0 && Math.abs(1 - suma) < 1e-6) break;
    }

    /* Reconstruye los desplazamientos desde los anchos. La suma es 1 por
       construcción del bucle, así que el último fotograma cae exactamente en
       el final del documento, que es lo que necesita el plano de cierre. */
    let acumulado = 0;
    for (let i = 0; i < nTramos; i += 1) {
      acumulado += anchos[i];
      anclas[i + 1].desplazamiento = Math.min(acumulado, 1);
    }
    anclas[0].desplazamiento = 0;
    anclas[anclas.length - 1].desplazamiento = 1;
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

      /* Repacing: el scroll ya está bien repartido por secciones, pero
         todavía hay tramos que la cámara recorre más rápido de lo que el
         ojo sigue. Va DESPUÉS de la corrección de crecimiento —que solo
         garantiza el orden— y ANTES de calcular las ventanas, porque las
         ventanas se deducen de los desplazamientos finales y si se
         calcularan antes medirían un reparto que luego cambia. */
      repacear(altoTotal);

      /* Ventanas de cada sistema en el recorrido.

         El intervalo de scroll que ocupa cada sistema. La escena lo usa para
         decidir CUÁNDO se enciende un cuerpo: sin esto, en la portada —que
         mira hacia el fondo del corredor— se veían a la vez el planeta de
         arranque y el gigante con anillos del final, superpuestos en el mismo
         punto de la pantalla, que se lee como un fallo de render. */
      ventanas.clear();
      for (const ancla of anclas) {
        const v = ventanas.get(ancla.indiceSistema);
        if (!v) {
          ventanas.set(ancla.indiceSistema, {
            desde: ancla.desplazamiento,
            hasta: ancla.desplazamiento,
          });
        } else {
          v.desde = Math.min(v.desde, ancla.desplazamiento);
          v.hasta = Math.max(v.hasta, ancla.desplazamiento);
        }
      }
    },

    /**
     * Margen de la ventana de un sistema, en progreso del documento.
     *
     * POR QUÉ SON DOS Y DISTINTOS. Adelante se enciende pronto, para que el
     * cuerpo se vea venir: es lo que da profundidad al corredor y lo que hace
     * que el recorrido se entienda como un viaje y no como una lista de
     * secciones. Detrás se apaga despacio, porque el plano de cierre mira
     * hacia atrás por el espacio ya recorrido y necesita encontrarlo entero.
     */
    margenAdelante: 0.32,
    margenAtras: 0.75,

    /** Ventanas por índice de sistema. Se rellenan en `recalibrar()`. */
    ventanas,

    /**
     * Dónde está el recorrido dentro de la ventana de UN sistema, en 0..1.
     *
     * Es lo que necesitan las cosas que siguen el ritmo de su propia sección
     * y no el del documento entero: el Big Bang de la portada, que tiene que
     * estar terminado justo cuando empieza "Perfil".
     *
     * @param {number} indiceSistema
     * @param {number} progreso Progreso del documento, 0..1.
     */
    localDe(indiceSistema, progreso) {
      const v = ventanas.get(indiceSistema);
      if (!v) return 0;
      const ancho = v.hasta - v.desde;
      return ancho > 0 ? clamp((progreso - v.desde) / ancho, 0, 1) : 0;
    },
  };
}
