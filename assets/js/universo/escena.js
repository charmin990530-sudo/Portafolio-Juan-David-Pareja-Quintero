/**
 * universo/escena.js — Ensambla el sistema y lo mueve.
 *
 * Aquí ocurre el cruce entre el WebGL y el HTML. El principio es que la
 * escena no sabe nada del contenido: se le dan los cuerpos y una ruta, y
 * ella se dibuja. El texto sigue siendo el del documento, y el módulo que
 * lee el scroll es quien decide dónde está la cámara. Esa separación es la
 * que permite que el sitio siga funcionando entero sin WebGL.
 *
 * RESPONSABILIDADES
 *   - Crear el renderer, la escena y las capas de fondo.
 *   - Resolver los tonos de la configuración contra los tokens CSS.
 *   - Medir las secciones del documento y calibrar la ruta.
 *   - En cada fotograma: resolver la cámara, colocar los cuerpos, renderizar.
 *   - Liberar absolutamente todo al desmontar.
 */

import {
  Color,
  Fog,
  NoToneMapping,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from '../../vendor/three/0.186.1/three.module.js';

import { alFotograma } from '../core/loop.js';
import { clamp } from '../core/util.js';
import { crearCamara } from './camara.js';
import { crearRuta } from './ruta.js';
import { crearEstrellas } from './capas/estrellas.js';
import { crearNebulosa } from './capas/nebulosa.js';
import { crearPolvo } from './capas/polvo.js';
import { crearPlaneta, liberarGeometrias, liberarTexturas } from './cuerpos/planeta.js';
import { crearAtmosfera } from './cuerpos/atmosfera.js';
import { crearAnillos } from './cuerpos/anillos.js';
import { crearLunas } from './cuerpos/lunas.js';
import { crearCampo } from './cuerpos/campo.js';
import { crearBaliza, liberarTexturasBaliza } from './cuerpos/baliza.js';
import { alCambiarTema, leerPaleta } from './colores.js';
import { crearSonda, dprEfectivo, densidadUI, NIVELES, perfil } from './calidad.js';
import { SISTEMAS, PRESENTACION } from '../data/universo.js';
import { STACK } from '../data/stack.js';

/* ------------------------------------------------------------------
   Resolución de tonos
   ------------------------------------------------------------------ */

/**
 * Convierte `'tono:cian'` en un color leído de los tokens CSS y deja pasar
 * los hexadecimales literales sin tocar.
 *
 * Existe para que la configuración no repita la paleta: si aquí hubiera
 * `#4fe3ff`, cambiar `--cyan` en `01-tokens.css` no cambiaría el universo y
 * habría dos fuentes de verdad para el mismo color.
 */
function resolverTono(valor, paleta) {
  if (typeof valor !== 'string') return new Color(valor);
  if (!valor.startsWith('tono:')) return new Color(valor);
  return paleta[valor.slice(5)]?.clone() ?? new Color('#ffffff');
}

function estiloDeTono(valor, paleta) {
  return resolverTono(valor, paleta).getStyle();
}

/* ------------------------------------------------------------------
   Escena
   ------------------------------------------------------------------ */

export function crearEscena({ lienzo, nivelInicial, alInformar, alDegradar, alAcelerar }) {
  const paleta = leerPaleta();
  let nivel = nivelInicial ?? NIVELES.MEDIO;
  let conf = perfil(nivel);

  /* ---- Renderer ---------------------------------------------------- */
  const renderer = new WebGLRenderer({
    canvas: lienzo,
    // El suavizado de bordes no se pide en gama baja: es un pase a pantalla
    // completa por fotograma, y a 1.25 de DPR el aliasing es asumible.
    antialias: nivel !== NIVELES.BAJO,
    alpha: false,
    stencil: false, // no se usa: ahorra memoria de profundiidad
    depth: true,
    // `powerPreference` se deja sin fijar a propósito: en un portátil con
    // dos GPU, forzar la discreta despierta el ventilador sin ganar nada.
  });

  renderer.setClearColor(paleta.fondo, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  /* Sin mapeo de tonos, y es una decisión consciente.
     Los shaders de este proyecto calculan su propia curva de iluminación y
     escriben color directamente. Un ACES automático encima apagaría los
     acentos de la marca, que están calculados para verse sobre fondo casi
     negro. El color de este sitio lo fija el diseño, no la física. */
  renderer.toneMapping = NoToneMapping;

  const escena = new Scene();
  /* Niebla de distancia. No es adorno: sin ella, la nebulosa del fondo y
     los cuerpos lejanos comparten rango de profundidad visual y el espacio
     se aplana. Con niebla, lo que está lejos se funde y lo cercano destaca. */
  escena.fog = new Fog(paleta.fondo.getHex(), 900, 5200);

  const camara = crearCamara();

  /* ---- Sistemas y ruta -------------------------------------------- */
  const sistemas = sistemasPresentes();
  const ruta = crearRuta(sistemas);

  /* ---- Capas de fondo --------------------------------------------- */
  const estrellas = crearEstrellas({ nivel, radio: PRESENTACION.radioEstrellas, paleta });
  escena.add(estrellas.objeto);

  const nebulosa = crearNebulosa({ nivel, radio: PRESENTACION.radioEstrellas, paleta });
  for (const sprite of nebulosa.objetos) escena.add(sprite);

  const polvo = crearPolvo({ nivel, caja: PRESENTACION.cajaPolvo, paleta });
  escena.add(polvo.objeto);

  /* ---- Cuerpos ----------------------------------------------------- */
  const cuerpos = [];
  const porSistema = new Map();
  let semilla = 0;

  for (const sistema of sistemas) {
    const def = sistema.cuerpo;

    /* Un sistema puede no tener cuerpo propio: `reutiliza` apunta a otro ya
       construido. Así el planeta de "Perfil" es el MISMO cuerpo que se veía
       desde lejos en la portada, no uno igual pero distinto. */
    if (sistema.reutiliza) {
      const base = cuerpos.find((c) => c.id === sistema.reutiliza);
      if (base) {
        porSistema.set(sistema.id, base);
        cuerpos.push({ sistema, tipo: 'alias', base });
      }
      continue;
    }

    if (!def) continue;

    if (def.tipo === 'baliza') {
      const baliza = crearBaliza({
        color: estiloDeTono(`tono:${def.tono}`, paleta),
        x: def.x,
        y: def.y,
        z: def.z,
        escala: def.escala ?? 1,
      });
      escena.add(baliza.grupo);
      const entrada = { sistema, tipo: 'baliza', pieza: baliza, id: def.id };
      cuerpos.push(entrada);
      porSistema.set(sistema.id, entrada);
      continue;
    }

    semilla += 7.31;
    const planeta = crearPlaneta({
      nivel,
      def: conColoresResueltos(def, paleta),
      semillaBase: semilla,
    });
    escena.add(planeta.grupo);

    const entrada = { sistema, tipo: 'planeta', pieza: planeta, id: def.id, def, lunaEnfocada: -1 };
    cuerpos.push(entrada);
    porSistema.set(sistema.id, entrada);

    if (sistema.atmosfera && conf.atmosfera > 0) {
      entrada.atmosfera = crearAtmosfera({
        detalle: conf.detallePlaneta,
        color: estiloDeTono(`tono:${sistema.atmosfera.tono}`, paleta),
        radio: def.radio,
        escala: sistema.atmosfera.escala ?? 1.055,
        fuerza: sistema.atmosfera.fuerza ?? 1,
      });
      planeta.grupo.add(entrada.atmosfera.malla);
    }

    if (sistema.anillos) {
      entrada.anillos = crearAnillos({
        nivel,
        colorA: estiloDeTono(sistema.anillos.tonoA, paleta),
        colorB: estiloDeTono(sistema.anillos.tonoB, paleta),
        radioInterno: sistema.anillos.radioInterno,
        radioExterno: sistema.anillos.radioExterno,
        semilla: sistema.anillos.semilla ?? 1,
      });
      planeta.grupo.add(entrada.anillos.grupo);
    }

    if (sistema.lunas) {
      /* El color de cada luna es el del grupo de habilidades al que
         pertenece, no un color nuevo. Así la luna dice a qué área
         pertenece sin necesidad de leyenda. */
      const habilidades = [];
      const colores = [];
      for (const grupo of STACK) {
        const colorGrupo = resolverTono(grupo.color, paleta);
        for (const habilidad of grupo.habilidades) {
          habilidades.push(habilidad);
          colores.push(colorGrupo);
        }
      }
      entrada.lunas = crearLunas({
        nivel,
        habilidades,
        colores,
        radioBase: sistema.lunas.radioBase,
        radioMax: sistema.lunas.radioMax,
        radioLuna: sistema.lunas.radioLuna,
      });
      planeta.grupo.add(entrada.lunas.malla);
    }

    if (sistema.campo) {
      entrada.campo = crearCampo({
        nivel,
        caja: sistema.campo.caja,
        radioMin: sistema.campo.radioMin,
        radioMax: sistema.campo.radioMax,
        color: estiloDeTono(`tono:${sistema.campo.tono}`, paleta),
      });
      escena.add(entrada.campo.malla);
    }
  }

  /* ---- Estado del bucle -------------------------------------------- */
  let activo = true;
  let visible = !document.hidden;
  let segundos = 0;
  let ultimoSistema = null;
  let ultimoBarrido = 0;

  // Puntero normalizado a [-1, 1], para el parallax.
  const puntero = { x: 0, y: 0, tiene: false };

  // Vectores reutilizados: el bucle de render no asigna memoria.
  const centro = new Vector3();
  const diferencia = new Vector3();

  // Fps: media exponencial para el informe, sonda aparte para la decisión.
  let fps = 0;
  let sonda = null;

  /* ---- Observadores ------------------------------------------------ */
  const alCambiarVisibilidad = () => {
    visible = !document.hidden;
  };

  const alRedimensionar = () => {
    camara.ajustarAspecto();
    renderer.setPixelRatio(dprEfectivo(nivel));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    medir();
  };

  const alMover = (evento) => {
    puntero.x = (evento.clientX / window.innerWidth) * 2 - 1;
    puntero.y = (evento.clientY / window.innerHeight) * 2 - 1;
    puntero.tiene = true;
  };

  const alSalirPuntero = () => {
    puntero.tiene = false;
  };

  const pararTema = alCambiarTema(aplicarPaleta);

  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  window.addEventListener('resize', alRedimensionar, { passive: true });
  window.addEventListener('pointermove', alMover, { passive: true });
  document.addEventListener('pointerleave', alSalirPuntero);

  /* ---- Calibración -------------------------------------------------
     Lee dónde está cada sección y se lo pasa a la ruta. Es lo que hace que
     el encuadre coincida con el texto. Se repite al redimensionar y tras
     cargar las fuentes, porque las dos cosas cambian la altura del
     documento y con ella el desplazamiento de cada sección. */
  function medir() {
    const secciones = [];
    for (const sistema of sistemas) {
      const nodo = document.getElementById(sistema.seccion);
      if (!nodo) continue;
      const caja = nodo.getBoundingClientRect();
      secciones.push({ id: sistema.seccion, arriba: caja.top + window.scrollY, alto: caja.height });
    }
    const altoTotal = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    ruta.recalibrar(secciones, altoTotal);

    renderer.setPixelRatio(dprEfectivo(nivel));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  /* ---- Progreso del documento ---------------------------------------
     La misma fórmula normalizada que ya usa `modules/proceso.js`, y por el
     mismo motivo: es la que acopla una posición de pantalla con una
     fracción de recorrido sin listener de scroll propio. */
  function progresoDocumento() {
    const alto = document.documentElement.scrollHeight - window.innerHeight;
    return alto > 0 ? clamp(window.scrollY / alto, 0, 1) : 0;
  }

  /**
   * Cuánto se acerca un cuerpo a "tocar la pantalla", en 0..1.
   *
   * Se calcula con la distancia real entre la cámara y el centro del cuerpo.
   * El cuerpo se oculta del todo fuera del rango, y eso es lo que mantiene
   * el número de llamadas de dibujo por debajo de 25: en un instante dado
   * solo hay dos o tres cuerpos a la vista, no los seis.
   */
  function entradaDe(entrada, cerca, lejos) {
    if (!entrada.pieza?.grupo) return 0;
    entrada.pieza.grupo.getWorldPosition(centro);
    const distancia = camara.camara.position.distanceTo(centro);
    if (distancia > lejos) return 0;
    return clamp((cerca / (cerca + distancia)) * 2.1, 0, 1);
  }

  /* ---- Bucle -------------------------------------------------------- */
  medir();
  camara.inicial(ruta.resolver(0));
  arrancarSonda();

  const baja = alFotograma(fotograma);

  function fotograma(delta) {
    if (!activo || !visible) return;

    segundos += delta / 1000;
    const dpr = dprEfectivo(nivel);

    /* Fps con media exponencial. Solo para informar: la decisión de
       calidad la toma la sonda, que sí descarta los fotogramas de
       calentamiento. */
    if (delta > 0) fps = fps === 0 ? 1000 / delta : fps * 0.94 + (1000 / delta) * 0.06;

    const progreso = camara.seguirProgreso(progresoDocumento(), delta);
    const estado = ruta.resolver(progreso);
    const medida = camara.colocar(estado, delta, puntero.tiene ? puntero : null);

    estrellas.actualizar(segundos, dpr, medida.velocidadNormalizada);
    nebulosa.actualizar(segundos, medida.velocidadNormalizada);
    polvo.actualizar(segundos, dpr);

    for (const cuerpo of cuerpos) {
      if (cuerpo.tipo === 'alias') {
        // Un alias no tiene pieza propia: dibuja la del cuerpo al que apunta.
        continue;
      }

      const def = cuerpo.def;
      const radio = def?.radio ?? 40;
      const cerca = radio * 3.2 + 260;
      const lejos = radio * 5 + 700;
      const e = entradaDe(cuerpo, cerca, lejos);

      if (cuerpo.pieza.grupo) cuerpo.pieza.grupo.visible = e > 0.012;

      if (cuerpo.tipo === 'baliza') {
        const encendido = cuerpo.sistema.id === estado.sistema ? 1 : 0.22;
        cuerpo.pieza.actualizar(e, encendido, segundos, camara.camara);
      } else {
        cuerpo.pieza.actualizar(segundos, e, camara.camara);
        cuerpo.atmosfera?.actualizar(e);

        if (cuerpo.anillos) {
          cuerpo.pieza.grupo.getWorldPosition(centro);
          diferencia.copy(camara.camara.position).sub(centro);
          // La componente Y de la diferencia indica si la cámara está por
          // encima, en el plano o por debajo del anillo. Cerca de cero es
          // justo el momento del cruce.
          cuerpo.anillos.actualizar(e, centro, radio, diferencia.y / (radio * 2.2));
        }

        if (cuerpo.lunas) cuerpo.lunas.actualizar(segundos, e, cuerpo.lunaEnfocada);
      }

      if (cuerpo.campo) {
        // El campo de escombros se atenúa fuera de su tramo: cerca, satura
        // la pantalla; lejos, solo añade ruido.
        const suyo = cuerpo.sistema.id === estado.sistema;
        cuerpo.campo.actualizar(suyo ? e : e * 0.3);
      }
    }

    if (sonda) {
      if (sonda(delta)) sonda = null;
    }

    renderer.render(escena, camara.camara);

    if (estado.sistema !== ultimoSistema) {
      ultimoSistema = estado.sistema;
      document.documentElement.dataset.sistema = estado.sistema;
    }

    /* El barrido de sonido se dispara al acelerar, con un tope de tiempo.
       Sin ese tope se llamaría en cada fotograma en el que la velocidad
       supere el umbral y se convertiría en un zumbido continuo, que es
       justo lo contrario de un whoosh. */
    const ahora = performance.now();
    if (alAcelerar && ahora - ultimoBarrido > 900 && medida.velocidadNormalizada > 0.45) {
      ultimoBarrido = ahora;
      alAcelerar(medida.velocidadNormalizada);
    }

    alInformar?.({
      fps,
      nivel,
      sistema: estado.sistema,
      velocidad: medida.velocidadNormalizada,
      progreso,
    });
  }

  /* ---- Sonda de calidad --------------------------------------------
     Solo decide el nivel inicial. Después el sistema se queda donde está:
     subir o bajar de nivel a media escena produce un tirón visible, y una
     degradación ya la hizo. */
  function arrancarSonda() {
    sonda = crearSonda({
      nivel,
      objetivo: conf.objetivoFps,
      fotogramas: 90,
      alDegradar: (nuevo) => {
        nivel = nuevo;
        conf = perfil(nivel);
        renderer.setPixelRatio(dprEfectivo(nivel));
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        alDegradar?.(nuevo, fps);
      },
      alTerminar: (r) => alInformar?.({ fps: r.fps, nivel: r.nivel, sistema: ultimoSistema, sonda: true }),
    });
  }

  /* ---- API ---------------------------------------------------------- */
  return {
    escena,
    camara,
    ruta,
    nivel: () => nivel,
    densidad: () => densidadUI(nivel),
    fps: () => fps,

    /** Tras cargar las fuentes web, que desplazan el documento. */
    recalibrar: medir,

    /**
     * Coloca la cámara en un punto del recorrido.
     * @param {number} progreso 0..1
     * @param {boolean} instantaneo Sin cruising: para los saltos de menú.
     */
    irA(progreso, { instantaneo = false } = {}) {
      const estado = ruta.resolver(clamp(progreso, 0, 1));
      if (instantaneo) camara.reenganchar(estado);
      return estado;
    },

    /**
     * Salta a la sección indicada, como el punto de navegación del HUD y los
     * enlaces del menú.
     *
     * Se busca el desplazamiento normalizado del PRIMER fotograma de ese
     * sistema, no el de su centro: lo que el visitante quiere al pulsar es
     * "llévame a que ese planeta esté delante", no "ponme en medio de la
     * sección y deja que avance". El centro se alcanza con dos pestazos
     * seguidos de scroll y se siente como que el botón no hizo nada.
     */
    irAPunto(seccionId, opciones = {}) {
      const ancla = ruta.anclas.find((a) => a.seccion === seccionId);
      if (!ancla) return null;
      return this.irA(ancla.desplazamiento, opciones);
    },

    /** Enfoca una luna por índice. Es el easter egg de las notas. */
    enfocarLuna(indice) {
      for (const cuerpo of cuerpos) {
        if (cuerpo.lunas) {
          cuerpo.lunaEnfocada = indice;
          return cuerpo.lunas.habilidades[indice] ?? null;
        }
      }
      return null;
    },

    /** Color de acento de un sistema, para el HUD. */
    colorDeSistema(id) {
      const entrada = porSistema.get(id);
      const def = entrada?.sistema.cuerpo;
      if (!def) return null;
      if (def.colorAcento) return resolverTono(def.colorAcento, paleta);
      if (def.tono) return resolverTono(`tono:${def.tono}`, paleta);
      return null;
    },

    dispose() {
      activo = false;
      baja();
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('pointermove', alMover);
      document.removeEventListener('pointerleave', alSalirPuntero);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      pararTema();

      for (const cuerpo of cuerpos) {
        if (cuerpo.tipo === 'alias') continue;
        cuerpo.pieza?.liberar();
        cuerpo.atmosfera?.liberar();
        cuerpo.anillos?.liberar();
        cuerpo.lunas?.liberar();
        cuerpo.campo?.liberar();
      }

      estrellas.liberar();
      nebulosa.liberar();
      polvo.liberar();
      liberarGeometrias();
      liberarTexturas();
      liberarTexturasBaliza();
      renderer.dispose();
    },
  };

  /* ---------------------------------------------------------------
     Locales
     --------------------------------------------------------------- */

  function aplicarPaleta(nueva) {
    renderer.setClearColor(nueva.fondo, 1);
    escena.fog.color.copy(nueva.fondo);
    estrellas.aplicarPaleta(nueva);
    nebulosa.aplicarPaleta(nueva);
    polvo.aplicarPaleta(nueva);
    for (const cuerpo of cuerpos) cuerpo.pieza?.aplicarPaleta?.(nueva);
  }
}

/* ------------------------------------------------------------------
   Utilidades del módulo
   ------------------------------------------------------------------ */

/**
 * Sistemas cuyo `<section>` existe de verdad en el documento.
 *
 * `data/universo.js` puede describir sistemas que aún no existen —el de
 * proyectos está desactivado hasta que haya contenido— y el universo tiene
 * que ignorarlos sin fallar y sin dejar un sistema descolgado.
 */
function sistemasPresentes() {
  return SISTEMAS.filter((s) => document.getElementById(s.seccion) !== null);
}

/** Sustituye `'tono:x'` por su valor real en los colores de un cuerpo. */
function conColoresResueltos(def, paleta) {
  const salida = { ...def };
  for (const clave of ['colorOceano', 'colorTierra', 'colorHielo', 'colorAcento', 'colorLuz']) {
    if (typeof salida[clave] === 'string') salida[clave] = estiloDeTono(salida[clave], paleta);
  }
  return salida;
}
