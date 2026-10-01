/**
 * universo/camara.js — Cámara sobre la ruta, con peso y señal de velocidad.
 *
 * CUATRO TRABAJOS, y ninguno es trivial:
 *
 * 1. AMORTIGUAR EL PROGRESO. El scroll es brusco: el trackpad dispara
 *    saltos, el dedo da tirones, y el progreso salta. Si la cámara lo
 *    siguiera al pie, se vería el mecanismo. Se amortigua con `suavizar()`
 *    de `core/util.js`, que es independiente del framerate: un `lerp` con
 *    factor fijo —el error que hay en `modules/cursor.js:58`— va más rápido
 *    a 120 Hz y el resultado se desincroniza.
 *
 *    Se amortigua el PROGRESO y no la posición, por un motivo concreto: la
 *    ruta tiene tramos lentos y rápidos, así que amortiguar la posición
 *    haría que un tramo largo de la curva quedara corto en el amortiguado.
 *    Amortiguando el progreso, la cámara recorre la curva completa
 *    correctamente y solo se retrasa.
 *
 * 2. MEDIR LA VELOCIDAD. La velocidad de scroll es la señal que alarga las
 *    estelas, abre el FOV y sube el resplandor. Sin ella el viaje es un
 *    desplazamiento uniforme, que es justo lo que no quiere una película.
 *
 * 3. REACCIONAR AL RATÓN. Moviendo el punto de mira, no la cámara. Así el
 *    sujeto se desplaza un poco en pantalla en vez de que gire el mundo,
 *    que es lo que evita la imagen de juguete.
 *
 * 4. ABRIR EL FOV AL ACELERAR. La cámara no va más rápido, pero el campo se
 *    ensancha y el ojo lo lee como aceleración. Es el truco más barato que
 *    existe para vender velocidad.
 */

import { PerspectiveCamera, Vector2, Vector3 } from '../../vendor/three/0.186.1/three.module.js';
import { clamp, suavizar, separacionParaEncuadre } from '../core/util.js';
import { CAMARA } from '../data/universo.js';

export function crearCamara() {
  const camara = new PerspectiveCamera(
    CAMARA.fovInicial,
    window.innerWidth / window.innerHeight,
    CAMARA.near,
    CAMARA.far,
  );

  const posActual = new Vector3();
  const miraActual = new Vector3();
  const miraLejos = new Vector3();
  const desplazamiento = new Vector3();
  const anterior = new Vector3();
  const raton = new Vector2();
  const ratonSuavizado = new Vector2();

  let fovActual = CAMARA.fovInicial;
  let rollActual = 0;
  let primeraVez = true;

  // Progreso del documento, y su versión amortiguada.
  let progresoReal = 0;
  let progresoSuavizado = 0;
  let progresoPrevio = 0;
  let velocidad = 0;

  const posicionColocada = new Vector3();

  return {
    camara,

    /**
     * Amortigua el progreso del documento.
     *
     * @param {number} valor  Progreso 0..1 leído del documento.
     * @param {number} delta  Milisegundos.
     * @returns {number} Progreso amortiguado, el que se pasa a la ruta.
     */
    seguirProgreso(valor, delta) {
      progresoReal = clamp(valor, 0, 1);
      progresoSuavizado = suavizar(progresoSuavizado, progresoReal, CAMARA.amortiguacion * 1.6, delta);
      return progresoSuavizado;
    },

    /**
     * Coloca la cámara según lo que resolvió la ruta.
     *
     * @param {object} estado  Lo que devuelve `ruta.resolver()`.
     * @param {number} delta
     * @param {{x:number,y:number}|null} puntero  Normalizado a [-1, 1].
     * @returns {{velocidad:number, velocidadNormalizada:number, fov:number}}
     */
    colocar(estado, delta, puntero) {
      /* --- Velocidad del scroll ---------------------------------------
         Se mide sobre el progreso REAL y no sobre el amortiguado: la
         velocidad que percibe el ojo es la del input, no la de la respuesta.
         Y se normaliza por el delta, para que no dependa del framerate. */
      if (delta > 0) {
        const instantanea = (progresoReal - progresoPrevio) / (delta / 1000);
        progresoPrevio = progresoReal;
        /* Suavizado asimétrico: frenar más rápido que acelerar. Una cámara
           que frena despacio se feel pastosa; una que frena de golpe se
           siente brusca. Este cociente da lo segundo sin lo primero. */
        const factor = instantanea > velocidad ? 9 : 16;
        velocidad = suavizar(velocidad, instantanea, factor, delta);
      }

      /* --- Posición y óptica ------------------------------------------ */
      if (primeraVez) {
        posActual.copy(estado.posicion);
        miraActual.copy(estado.objetivo);
        fovActual = estado.fov;
        rollActual = estado.roll;
        primeraVez = false;
      } else {
        anterior.copy(posActual);
        posActual.x = suavizar(posActual.x, estado.posicion.x, CAMARA.amortiguacion, delta);
        posActual.y = suavizar(posActual.y, estado.posicion.y, CAMARA.amortiguacion, delta);
        posActual.z = suavizar(posActual.z, estado.posicion.z, CAMARA.amortiguacion, delta);

        /* El punto de mira se amortigua un poco más despacio que la
           posición. Un encuadre que gira más rápido que el sujeto produce
           sensación de mareo; uno que gira más lento, de que la cámara
           "arrastra" al cuerpo, que es exactamente el efecto de un
           travelling real. */
        miraActual.x = suavizar(miraActual.x, estado.objetivo.x, CAMARA.amortiguacion * 0.8, delta);
        miraActual.y = suavizar(miraActual.y, estado.objetivo.y, CAMARA.amortiguacion * 0.8, delta);
        miraActual.z = suavizar(miraActual.z, estado.objetivo.z, CAMARA.amortiguacion * 0.8, delta);

        fovActual = suavizar(fovActual, estado.fov, 5, delta);
        rollActual = suavizar(rollActual, estado.roll, 4, delta);
      }

      desplazamiento.copy(posActual).sub(anterior);

      /* --- Ratón ------------------------------------------------------ */
      if (puntero) raton.set(puntero.x, puntero.y);
      else raton.set(0, 0);
      ratonSuavizado.x = suavizar(ratonSuavizado.x, raton.x, 4, delta);
      ratonSuavizado.y = suavizar(ratonSuavizado.y, raton.y, 4, delta);

      /* --- FOV con la velocidad --------------------------------------- */
      const velocidadNormalizada = clamp(Math.abs(velocidad) / CAMARA.velocidadMax, 0, 1);
      const fovFinal = clamp(fovActual + velocidadNormalizada * 5.5, 24, CAMARA.fovMax);

      /* --- Encuadre en pantalla vertical --------------------------------

         La regla vive en `core/util.js` porque es una REGLA y las reglas se
         prueban: `probar-ruta.mjs` la ejecuta con las proporciones reales de
         un móvil y de un monitor, y falla si alguien la cambia sin querer. */
      const separacion = separacionParaEncuadre(camara.aspect);
      posicionColocada.copy(posActual).sub(miraActual).multiplyScalar(separacion).add(miraActual);
      camara.position.copy(posicionColocada);

      miraLejos.copy(miraActual);
      miraLejos.x += ratonSuavizado.x * CAMARA.raton * 26;
      miraLejos.y -= ratonSuavizado.y * CAMARA.raton * 16;
      camara.lookAt(miraLejos);

      if (Math.abs(fovFinal - camara.fov) > 0.01) {
        camara.fov = fovFinal;
        camara.updateProjectionMatrix();
      }

      /* Balanceo en el eje de la vista, no en la cámara: aplicarlo a la
         cámara entera la haría derivar, porque cada cuadro se sumaría al
         anterior con la orientación ya girada. */
      if (rollActual !== 0) {
        camara.rotateZ(rollActual + ratonSuavizado.x * 0.012);
      }

      return { velocidad, velocidadNormalizada, fov: fovFinal };
    },

    /**
     * Reengancha la cámara sin amortiguación. Se usa al saltar por el menú:
     * si no, la cámara cruzaría todo el espacio visiblemente desde el
     * cuerpo de origen, que es lo más delator de una transición cinemática
     * mal hecha.
     */
    reenganchar(estado) {
      posActual.copy(estado.posicion);
      miraActual.copy(estado.objetivo);
      fovActual = estado.fov;
      rollActual = estado.roll;
      desplazamiento.set(0, 0, 0);
      primeraVez = true;
      velocidad = 0;
    },

    /** Coloca la cámara sin amortiguación ni saltos: también al montar. */
    inicial(estado) {
      this.reenganchar(estado);
      camara.position.copy(estado.posicion);
      camara.lookAt(estado.objetivo);
      camara.fov = estado.fov;
      camara.updateProjectionMatrix();
    },

    ajustarAspecto() {
      camara.aspect = window.innerWidth / window.innerHeight;
      camara.updateProjectionMatrix();
    },

    obtenerVelocidad: () => velocidad,
    obtenerProgresoReal: () => progresoReal,
  };
}
