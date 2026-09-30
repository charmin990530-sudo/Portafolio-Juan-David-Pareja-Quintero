/**
 * universo/audio.js — Sonido ambiental sintetizado, sin archivos.
 *
 * NADA DE ARCHIVOS DE AUDIO. Todo se genera con WebAudio: un zumbido grave
 * de dos sierras desafinadas por un filtro paso-bajo, un lecho de ruido
 * filtrado que hace de casco de la nave, y un barrido de ruido por paso-banda
 * cuando se pasa un cuerpo.
 *
 * El motivo es el presupuesto. Un archivo de ambiente de 60 segundos pesa
 * entre 1 y 4 MB comprimido: eso es más que todo Three.js junto. Se sintetiza
 * en unos 4 KB de código y pesa cero en la red.
 *
 * REGLAS INNEGOCIABLES
 *   - Nace mudo. `activar()` solo hace algo tras un gesto del usuario, porque
 *     los navegadores bloquean el `AudioContext` sin uno y porque nadie ha
 *     pedido que suene nada.
 *   - El `AudioContext` no se crea hasta el primer clic. Crearlo antes
 *     consume batería y en Safari deja el sitio en estado "suspended".
 *   - Se pausa con la pestaña en segundo plano, igual que la escena.
 *   - Se destruye del todo al desmontar el universo.
 */

const NOTA_BASE = 55; // La1
const QUINTA = 1.5; // Relación de quinta: 82,5 Hz

export function crearAudio() {
  let contexto = null;
  let maestro = null;
  let drone = null;
  let casco = null;
  let entumecido = null;
  let activo = false;
  let pendiente = null;
  let alCambiar = null;

  /* Volúmenes pensados para que el sonido se SIENTA sin competir con la
     lectura. Un ambiente que tapa la interfaz es un ambiente mal hecho. */
  const VOLUMEN_MAESTRO = 0.16;
  const VOLUMEN_DRONE = 0.5;
  const VOLUMEN_CASCO = 0.16;

  function construir() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;

    contexto = new Ctx();

    maestro = contexto.createGain();
    maestro.gain.value = 0;
    maestro.connect(contexto.destination);

    /* --- Zumbido: dos sierras desafinadas, la quinta por encima. ---
       La desafinación de 4 cents es imperceptible como tono pero produce
       batidos lentos: es lo que hace que suene orgánico en vez de
       electrónico. */
    const filtroDrone = contexto.createBiquadFilter();
    filtroDrone.type = 'lowpass';
    filtroDrone.frequency.value = 260;
    filtroDrone.Q.value = 3.2;
    filtroDrone.connect(maestro);

    drone = contexto.createGain();
    drone.gain.value = VOLUMEN_DRONE;
    drone.connect(filtroDrone);

    for (const [frecuencia, desafinacion] of [
      [NOTA_BASE, 0],
      [NOTA_BASE, 4],
      [NOTA_BASE * QUINTA, -3],
    ]) {
      const osc = contexto.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = frecuencia;
      osc.detune.value = desafinacion;
      osc.connect(drone);
      osc.start();
    }

    /* --- Casco: ruido rosa por un paso-banda estrecho ---
         Un bucle de 2 s de ruido, reproducido en bucle y filtrado. El
         filtro muy estrecho es lo que lo convierte en "aire dentro de un
         casco" y no en "estática". */
    const largoRuido = Math.floor(contexto.sampleRate * 2);
    const buffer = contexto.createBuffer(1, largoRuido, contexto.sampleRate);
    const datos = buffer.getChannelData(0);

    // Aproximación de ruido rosa por el filtro de Voss: suma de_filters
    // blancos con menos peso cada octava. Con Math.random() a secas
    // sonaría a estática de TV.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < largoRuido; i += 1) {
      const blanco = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + blanco * 0.099046;
      b1 = 0.963 * b1 + blanco * 0.2965164;
      b2 = 0.57555 * b2 + blanco * 1.0526913;
      datos[i] = (b0 + b1 + b2 + blanco * 0.1848) * 0.16;
    }

    const fuente = contexto.createBufferSource();
    fuente.buffer = buffer;
    fuente.loop = true;

    const filtroCasco = contexto.createBiquadFilter();
    filtroCasco.type = 'bandpass';
    filtroCasco.frequency.value = 420;
    filtroCasco.Q.value = 0.7;

    casco = contexto.createGain();
    casco.gain.value = VOLUMEN_CASCO;

    fuente.connect(filtroCasco);
    filtroCasco.connect(casco);
    casco.connect(maestro);
    fuente.start();

    entumecido = { fuente, filtro: filtroCasco, drone, filtroDrone };
    return true;
  }

  function abrir() {
    if (!contexto && !construir()) return false;
    if (contexto.state === 'suspended') contexto.resume();
    return true;
  }

  function mezclar(valor, segundos) {
    if (!maestro) return;
    const ahora = contexto.currentTime;
    maestro.gain.cancelScheduledValues(ahora);
    maestro.gain.setValueAtTime(maestro.gain.value, ahora);
    maestro.gain.linearRampToValueAtTime(valor, ahora + segundos);
  }

  return {
    get activo() {
      return activo;
    },

    /**
     * @param {boolean} inicial  Estado con el que arranca.
     * @param {(activo:boolean)=>void} [alCambiar]  Para persistir la elección.
     */
    configurar(inicial, alCambiar_ = null) {
      alCambiar = alCambiar_;
      // Se registra el callback pero NO se activa el sonido. Aunque viniera
      // `true` de una visita anterior, el audio espera al primer gesto: el
      // navegador no lo permitiría de otra forma.
      pendiente = inicial;
    },

    /**
     * Activa o desactiva. Solo se llama desde un clic.
     * @returns {boolean} El estado resultante.
     */
    alternar() {
      if (!abrir()) return false;
      activo = !activo;
      pendiente = activo;

      if (activo) {
        mezclar(VOLUMEN_MAESTRO, 2.4);
      } else {
        // Se apaga despacio. Cortarlo de golpe suena a avería.
        mezclar(0, 0.8);
      }

      alCambiar?.(activo);
      return activo;
    },

    /**
     * Barrido de velocidad: el "whoosh" al pasar un cuerpo.
     *
     * Se dispara desde la escena cuando la velocidad normalizada supera un
     * umbral, y se llama una sola vez cada 900 ms como mucho: si se
     * disparara por fotograma se convertiría en un zumbido continuo.
     */
    barrido(fuerza) {
      if (!activo || !contexto || !entumecido) return;
      const ahora = contexto.currentTime;

      entumecido.filtroDrone.frequency.cancelScheduledValues(ahora);
      entumecido.filtroDrone.frequency.setValueAtTime(entumecido.filtroDrone.frequency.value, ahora);
      // Sube el filtro y vuelve a caer: el oido lee esa subida como un
      // soplido que pasa por delante.
      entumecido.filtroDrone.frequency.linearRampToValueAtTime(260 + 520 * fuerza, ahora + 0.28);
      entumecido.filtroDrone.frequency.linearRampToValueAtTime(260, ahora + 1.5);
    },

    /** Pausa con la pestaña en segundo plano. */
    visibility(visible) {
      if (!contexto) return;
      if (visible) {
        if (activo) abrir();
      } else if (contexto.state === 'running') {
        contexto.suspend();
      }
    },

    destroy() {
      if (!contexto) return;
      try {
        for (const nodo of drone ? drone : []) void nodo;
        entumecido?.fuente.stop();
        for (const hijo of drone?.children ?? []) {
          if (typeof hijo.stop === 'function') hijo.stop();
        }
        contexto.close();
      } catch {
        /* el contexto ya estaba cerrado */
      }
      contexto = null;
      maestro = null;
      drone = null;
      casco = null;
      entumecido = null;
      activo = false;
    },
  };
}
