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
import { altoDesplazable, progresoDeLectura, refrescarAltoDocumento } from '../core/desplazar.js';
import { crearCamara } from './camara.js';
import { crearRuta } from './ruta.js';
import { crearEstrellas } from './capas/estrellas.js';
import { crearNebulosa } from './capas/nebulosa.js';
import { crearPolvo } from './capas/polvo.js';
import { crearGalaxias } from './capas/galaxias.js';
import { crearPlaneta, liberarGeometrias, liberarTexturas } from './cuerpos/planeta.js';
import { crearBigBang, RADIO_INICIAL } from './cuerpos/bigbang.js';
import { crearAtmosfera } from './cuerpos/atmosfera.js';
import { crearAnillos } from './cuerpos/anillos.js';
import { crearLunas } from './cuerpos/lunas.js';
import { crearCampo, crearBalizasProceso } from './cuerpos/campo.js';
import { crearBaliza, liberarTexturasBaliza } from './cuerpos/baliza.js';
import { leerPaleta, leerToken } from './colores.js';
import { crearSonda, dprEfectivo, densidadUI, NIVELES, perfil } from './calidad.js';
import { SISTEMAS, PRESENTACION } from '../data/universo.js';
import { STACK } from '../data/stack.js';
import { PROCESO } from '../data/proceso.js';

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
 *
 * Acepta además `var(--accent)`, que es como `data/stack.js` nombra los
 * colores de sus grupos: ese archivo lo comparte el HTML, y lo que vale para
 * pintar un `<div>` no vale para `THREE.Color`, que no sabe resolver
 * referencias a variables CSS y se quejaba por consola con
 * "Unknown color model" antes de paint. Lo que se pinta es blanco.
 */
function resolverTono(valor, paleta) {
  if (valor instanceof Color) return valor.clone();
  if (typeof valor !== 'string') return new Color(valor);
  if (valor.startsWith('tono:')) return paleta[valor.slice(5)]?.clone() ?? new Color('#ffffff');
  const referencia = /^var\(\s*(--[\w-]+)\s*\)$/.exec(valor);
  if (referencia) return new Color(leerToken(referencia[1]));
  return new Color(valor);
}

function estiloDeTono(valor, paleta) {
  return resolverTono(valor, paleta).getStyle();
}

/**
 * Distancia de un punto al rectángulo `[x0,y0,z0,x1,y1,z1]`, y cero si está
 * dentro. Es la medida que corresponde a un volumen: el campo de escombros es
 * una caja, no una esfera, y medirlo como si fuera un cuerpo lo hacía visible
 * desde muy lejos.
 */
function distanciaACaja(p, caja) {
  const [x0, y0, z0, x1, y1, z1] = caja;
  const dx = Math.max(x0 - p.x, 0, p.x - x1);
  const dy = Math.max(y0 - p.y, 0, p.y - y1);
  const dz = Math.max(z0 - p.z, 0, p.z - z1);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Hasta dónde se extiende el campo de escombros a la vista, en unidades. */
const ALCANCE_CAMPO = 900;

/* ------------------------------------------------------------------
   Tamaño del lienzo

   `renderer.setSize()` reasigna el framebuffer entero. En un móvil eso
   ocurre cada vez que la barra de direcciones se pliega o se despliega,
   porque al hacerlo cambia `window.innerHeight`: no una vez por scroll,
   sino en cada gesto. Cada reasignado tira el búfer de píxeles entero y
   compila el estado, y una escena que va a 60 fps se nota.

   La solución tiene dos partes y las dos hacen falta:

     · Una tolerancia de dos píxeles. El lienzo está en `position: fixed`
       con `inset: 0`, así que el CSS lo estira al viewport de todos modos:
       un buffer dos píxeles más pequeño que su caja es indistinguible y
       no obliga a reasignar nada.
     · Un retardo antes de reaccionar. Eveno `resize` en móvil llega en
       ráfagas; con el retardo se coalescen en una sola operación.
   ------------------------------------------------------------------ */

const TOLERANCIA_PIXELES = 2;
const RETARDO_RESIZE = 160;

let anchoAplicado = 0;
let altoAplicado = 0;

const anchoVentana = () => window.innerWidth;
const altoVentana = () => window.innerHeight;

/** ¿Merece la pena reasignar el framebuffer? */
function cambioDeTamanoRelevante() {
  return (
    Math.abs(anchoVentana() - anchoAplicado) > TOLERANCIA_PIXELES ||
    Math.abs(altoVentana() - altoAplicado) > TOLERANCIA_PIXELES
  );
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
  const estrellas = crearEstrellas({
    nivel,
    radio: PRESENTACION.radioEstrellas,
    paleta,
    radioOndaInicial: RADIO_INICIAL,
  });
  escena.add(estrellas.objeto);

  const nebulosa = crearNebulosa({ nivel, radio: PRESENTACION.radioEstrellas, paleta });
  for (const sprite of nebulosa.objetos) escena.add(sprite);

  /* Las galaxias van ANTES que la nebulosa en la lista de dibujo, y por
     detrás de ella en la pantalla: son el fondo más lejano. Su `renderOrder`
     es negativo, así que el orden de esta llamada no importa para el
     resultado; se listan al final para que el archivo se lea de cerca a
     lejos. */
  const galaxias = crearGalaxias({ radio: PRESENTACION.radioEstrellas, paleta });
  for (const sprite of galaxias.objetos) escena.add(sprite);

  const polvo = crearPolvo({ nivel, caja: PRESENTACION.cajaPolvo, paleta });
  escena.add(polvo.objeto);

  /* ---- El origen: el universo empieza aquí -------------------------
     Un solo cuerpo, con `explosion: true` en su sistema, y es el que produce
     el arranque. Se construye en el ORIGEN del viaje, que no es el centro de
     la escena: tiene que estar donde nace el primer planeta. */
  const sistemaOrigen = sistemas.find((s) => s.explosion);
  const bigbang = sistemaOrigen
    ? crearBigBang({
        nivel,
        origen: new Vector3(0, 0, 0),
        radioMax: PRESENTACION.radioEstrellas,
        paleta,
      })
    : null;

  if (bigbang) {
    // El orden de la lista NO importa: cada pieza lleva su `renderOrder` y
    // todas son aditivas, así que se acumulan. Se listan de la más lejana a
    // la más cercana solo para que se lea en el mismo orden que la película.
    escena.add(bigbang.onda, bigbang.materia, bigbang.corona, bigbang.sol);
  }

  /* ---- Cuerpos ----------------------------------------------------- */
  const cuerpos = [];
  const porSistema = new Map();
  let semilla = 0;

  /* Se usa `for...of` sobre `entries()` y no `forEach`: el cuerpo tiene
     `continue`, y dentro de una flecha no hay bucle al que continue. */
  for (const [indice, sistema] of sistemas.entries()) {
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

    if (def?.tipo === 'baliza') {
      const baliza = crearBaliza({
        color: estiloDeTono(`tono:${def.tono}`, paleta),
        x: def.x,
        y: def.y,
        z: def.z,
        escala: def.escala ?? 1,
      });
      escena.add(baliza.grupo);
      const entrada = { sistema, indice, tipo: 'baliza', pieza: baliza, id: def.id, radio: def.radio ?? 60 };
      cuerpos.push(entrada);
      porSistema.set(sistema.id, entrada);
      continue;
    }

    let entrada = null;

    if (def) {
      semilla += 7.31;
      const planeta = crearPlaneta({
        nivel,
        def: conColoresResueltos(def, paleta),
        semillaBase: semilla,
      });
      escena.add(planeta.grupo);

      entrada = { sistema, indice, tipo: 'planeta', pieza: planeta, id: def.id, def, radio: def.radio ?? 40, lunaEnfocada: -1 };
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
    }

    /* EL CAMPO ES INDEPENDIENTE DEL CUERPO.

       El tramo de Proceso se describe con `cuerpo: null` y con su campo de
       escombros, así que no es un planeta con adornos: es un sistema sin
       planeta. Con el `continue` de "sin cuerpo, siguiente", ese campo no
       llegaba a construirse nunca y la sección entera —la única con
       balizas— se quedaba sin nada que mirar. */
    if (sistema.campo) {
      const pieza = crearCampo({
        nivel,
        caja: sistema.campo.caja,
        radioMin: sistema.campo.radioMin,
        radioMax: sistema.campo.radioMax,
        color: estiloDeTono(`tono:${sistema.campo.tono}`, paleta),
      });
      escena.add(pieza.malla);

      /* Las cinco balizas, una por etapa, repartidas en la caja por el mismo
         criterio con el que se coloca el texto: la sección va de `t: 0` a
         `t: 1` y cada etapa ocupa sutera parte de ese intervalo. */
      const [x0, y0, z0, x1, y1, z1] = sistema.campo.caja;
      const posiciones = PROCESO.map((_, i) => {
        const f = (i + 0.5) / PROCESO.length;
        return [
          x0 + (x1 - x0) * (0.34 + 0.32 * f),
          y0 + (y1 - y0) * 0.5 + Math.sin(f * Math.PI * 2) * (y1 - y0) * 0.12,
          z0 + (z1 - z0) * f,
        ];
      });

      const balizas = crearBalizasProceso({
        nivel,
        posiciones,
        etapas: PROCESO,
        // El color de cada baliza es el de su etapa en el diagrama del HTML:
        // `data/proceso.js` los nombra con `var(--accent)`, y aqui se
        // resuelven igual que cualquier otro token.
        resolverColor: (etapa) => resolverTono(etapa.color, paleta),
      });
      escena.add(balizas.grupo);

      if (!entrada) {
        entrada = {
          sistema,
          indice,
          tipo: 'campo',
          pieza: null,
          id: `campo-${sistema.id}`,
          def: null,
          caja: sistema.campo.caja,
          lunaEnfocada: -1,
        };
        cuerpos.push(entrada);
        porSistema.set(sistema.id, entrada);
      }
      entrada.campo = pieza;
      entrada.balizas = balizas;
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

  /** Estado de encuadre del fotograma actual. */
  let medioAltoPx = 1;
  let medioAltoUnidades = 1;

  /**
   * Cuánto se enciende un cuerpo según por dónde va el recorrido.
   *
   * Un cuerpo se enciende cuando el visitante se acerca a SU sección y se
   * apaga despacio cuando la deja atrás. Antes no existía esta regla y, como
   * la cámara mira hacia el fondo del corredor, en la portada se veían a la
   * vez el planeta de arranque y el gigante con anillos del final, uno
   * encima del otro en el mismo punto de la pantalla: se leía como un fallo
   * de render en lugar de como el universo.
   *
   * Se aplica además del descarte por tamaño, y los dos criterios se
   * multiplican: uno decide si el cuerpo se dibuja, este decide si ya le
   * toca.
   */
  function revelacion(indice, progreso) {
    const v = ruta.ventanas.get(indice);
    if (!v) return 1;
    const entrada = clamp((progreso - (v.desde - ruta.margenAdelante)) / ruta.margenAdelante, 0, 1);
    const salida = clamp((v.hasta + ruta.margenAtras - progreso) / ruta.margenAtras, 0, 1);
    return entrada * salida;
  }

  // Fps: media exponencial para el informe, sonda aparte para la decisión.
  let fps = 0;
  let sonda = null;

  /* El informe al HUD se entrega en el MISMO objeto, reutilizado.
     Se creaba un objeto literal por fotograma y el HUD solo lo lee: a 60
     fps son tres mil seiscientos objetos por minuto que el recolector
     tiene que procesar sin que ninguno sirva para nada. El HUD lo consume
     de inmediato y no lo guarda, así que compartirlo es seguro. */
  const informe = { fps: 0, nivel: '', sistema: '', velocidad: 0, progreso: 0 };

  /* ---- Observadores ------------------------------------------------ */
  let tictacResize = 0;

  const alCambiarVisibilidad = () => {
    visible = !document.hidden;
  };

  const alRedimensionar = () => {
    camara.ajustarAspecto();

    clearTimeout(tictacResize);
    tictacResize = setTimeout(() => {
      // La barra de direcciones mueve el alto en dos o tres píxeles. Con la
      // tolerancia, eso no toca el framebuffer.
      if (!cambioDeTamanoRelevante()) return;
      medir();
    }, RETARDO_RESIZE);
  };

  const alMover = (evento) => {
    puntero.x = (evento.clientX / window.innerWidth) * 2 - 1;
    puntero.y = (evento.clientY / window.innerHeight) * 2 - 1;
    puntero.tiene = true;
  };

  const alSalirPuntero = () => {
    puntero.tiene = false;
  };

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
    // Una sola medida para todo el sitio: la escena y la barra de progreso
    // leen el mismo número cacheado, en vez de cada una el suyo.
    const altoTotal = Math.max(1, refrescarAltoDocumento());
    ruta.recalibrar(secciones, altoTotal);

    renderer.setPixelRatio(dprEfectivo(nivel));
    anchoAplicado = anchoVentana();
    altoAplicado = altoVentana();
    renderer.setSize(anchoAplicado, altoAplicado, false);
  }

  /* ---- Progreso del documento ---------------------------------------
     Delegado en `core/desplazar.js`, que es quien tiene el alto cacheado.
     Leer `scrollHeight` aquí, en cada fotograma, provocaba un reflow
     completo: el bucle escribe `dataset.sistema` en el `<html>` al final
     de cada cuadro, así que la lectura del cuadro siguiente tenía siempre
     el documento sucio. */
  function progresoDocumento() {
    return progresoDeLectura();
  }

  /**
   * Cuánto se acerca un cuerpo a "tocar la pantalla", en 0..1.
   *
   * SE MIDE EN PÍXELES, NO EN UNIDADES. El criterio correcto para no dibujar
   * un cuerpo es que ocupe menos de un píxel: si no, no hay nada que ver y
   * el coste es tirar una llamada de dibujo. Con un radio fijo en unidades
   * —`radio * 5 + 700`— el planeta de portada, que está a 1 257 u de la
   * cámara al abrir la página, quedaba fuera del rango y se ocultaba: la
   * primera pantalla era un vacío negro.
   *
   * Además, este criterio se ajusta solo al FOV y al tamaño de la ventana, de
   * modo que el mismo código funciona en un móvil estrecho y en un monitor
   * grande sin tocar números.
   *
   * El encuadre —que el cuerpo entre a cámara y crezca— lo da la geometría de
   * la ruta, que es donde debe estar: `e` solo decide si se dibuja.
   */
  function entradaDe(grupo, radio, medioAltoUnidades) {
    if (!grupo) return 0;

    grupo.getWorldPosition(centro);
    if (medioAltoUnidades <= 0) return 0;

    const pixeles = (radio / medioAltoUnidades) * (medioAltoPx / 2);

    // Por debajo de un píxel y medio no hay nada que dibujar; el degradado
    // hasta ocho píxeles evita que aparezca de golpe.
    if (pixeles < 1.5) return 0;
    return clamp((pixeles - 1.5) / 6.5, 0, 1);
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

    /* Encuadre del fotograma. `tan(fov/2)` convierte el medio alto en píxeles
       a unidades de mundo por unidad de distancia: es lo que permite decidir
       si un cuerpo merece la pena dibujarse. Se mide sobre el alto REALMENTE
       aplicado al lienzo, no sobre `window.innerHeight`: si no, el criterio de
       píxeles mentiría en cuanto la barra de direcciones se pliega y el
       buffer se queda un poco más alto que la ventana. */
    medioAltoPx = altoAplicado || window.innerHeight;
    medioAltoUnidades = Math.tan((camara.camara.fov * Math.PI) / 360) || 1;

    /* ── LA APERTURA ────────────────────────────────────────────────
       Un solo número, leído del avance dentro de la sección de portada, y
       del que dependen las estrellas, el polvo, la nebulosa, la explosión y
       la formación del primer planeta.

       Que todos salgan del mismo número es lo que hace que se lea como un
       SOLO fenómeno y no como cinco animaciones que empiezan a la vez: el
       cielo se va llenando porque la onda pasa por él, no porque una
       opacidad suba por su cuenta. */
    /* La apertura tiene que ocupar la PORTADA ENTERA, no el primer tercio.

       `localDe` mide dentro de la ventana del sistema, que va de su primer
       fotograma al último. En la portada el último fotograma cae en el 82 %
       de la sección (por `ZONA_DE_CAMBIO`), de modo que la explosión se
       acababa en el 82 % del primer tramo y el último 18 % de la portada se
       quedaba a oscuras. Medido sobre la captura: a partir del 60 % de la
       portada ya no había nada que ver.

       Con este segundo, la onda y la materia se reparten la sección
       completa. La estrella sigue siendo lo primero que se ve y el último
       fotograma sigue siendo un mundo recién formado. */
    const avanceOrigen = sistemaOrigen ? ruta.localDe(sistemas.indexOf(sistemaOrigen), progreso) : 1;
    const explosion = clamp(avanceOrigen / 0.82, 0, 1);
    /* El gas y el polvo son lo que la onda deja al pasar, así que aparecen
       DESPUÉS de que ella se haya apartado. Con el gas entrando a la vez, la
       segunda mitad de la apertura era un velo azul uniforme que tapaba la
       explosión entera. */
    const nacimiento = clamp((explosion - 0.45) / 0.45, 0, 1);
    // El planeta se condensa cuando la onda ya se está apagando.
    const formacion = clamp((explosion - 0.42) / 0.45, 0, 1);

    estrellas.actualizar(segundos, dpr, medida.velocidadNormalizada, explosion);
    nebulosa.actualizar(segundos, medida.velocidadNormalizada, nacimiento);
    galaxias.actualizar(medida.velocidadNormalizada, nacimiento);
    polvo.actualizar(segundos, dpr, nacimiento);
    bigbang?.actualizar(explosion, segundos, dpr, 1);

    for (const cuerpo of cuerpos) {
      if (cuerpo.tipo === 'alias') {
        // Un alias no tiene pieza propia: dibuja la del cuerpo al que apunta.
        continue;
      }

      const def = cuerpo.def;
      const radio = def?.radio ?? cuerpo.radio ?? 40;

      if (cuerpo.pieza) {
        const e = entradaDe(cuerpo.pieza.grupo, radio, medioAltoUnidades) * revelacion(cuerpo.indice, progreso);

        /* El cuerpo del origen no está hecho hasta que se forma: antes de eso
           es un rescoldo que todavía no se dibuja. */
        const formacionCuerpo = cuerpo.sistema.explosion ? formacion : 1;

        if (cuerpo.pieza.grupo) {
          cuerpo.pieza.grupo.visible = e > 0.012 && formacionCuerpo > 0.015;
        }

        if (cuerpo.tipo === 'baliza') {
          const encendido = cuerpo.sistema.id === estado.sistema ? 1 : 0.22;
          cuerpo.pieza.actualizar(e, encendido, segundos, camara.camara);
        } else {
          cuerpo.pieza.actualizar(segundos, e, camara.camara, formacionCuerpo);
          cuerpo.atmosfera?.actualizar(e * formacionCuerpo);

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
      }

      if (cuerpo.campo) {
        /* El campo de escombros es un volumen difuso, no un cuerpo: no tiene
           radio con el que compararse en pantalla, así que se mide con la
           distancia REAL a su caja. Con el criterio de píxeles se veía desde
           la portada, a casi 2 000 unidades, como una lluvia de rocas que
           ensuciaba el primer plano. Solo existe cuando la cámara entra en
           el tramo, que es cuando tiene sentido. */
        const suyo = cuerpo.sistema.id === estado.sistema;
        const distancia = distanciaACaja(camara.camara.position, cuerpo.caja);
        const e = clamp(1 - distancia / ALCANCE_CAMPO, 0, 1) * revelacion(cuerpo.indice, progreso);
        cuerpo.campo.actualizar(suyo ? e : e * 0.5);

        /* Las balizas se encienden con la posicion DENTRO de la seccion, que
           es lo que hace que la escena vaya contando las cinco etapas al
           mismo tiempo que las cuenta el texto de al lado. */
        cuerpo.balizas?.actualizar(
          ruta.localDe(cuerpo.indice, progreso),
          suyo ? e : e * 0.35,
          camara.camara,
        );
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

    if (alInformar) {
      informe.fps = fps;
      informe.nivel = nivel;
      informe.sistema = estado.sistema;
      informe.velocidad = medida.velocidadNormalizada;
      informe.progreso = progreso;
      alInformar(informe);
    }
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
        renderer.setSize(anchoAplicado || anchoVentana(), altoAplicado || altoVentana(), false);
        alDegradar?.(nuevo, fps);
      },
      alTerminar: (r) => {
        if (!alInformar) return;
        informe.fps = r.fps;
        informe.nivel = r.nivel;
        informe.sistema = ultimoSistema;
        informe.velocidad = 0;
        informe.progreso = 0;
        alInformar(informe);
      },
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
      clearTimeout(tictacResize);
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('pointermove', alMover);
      document.removeEventListener('pointerleave', alSalirPuntero);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);

      for (const cuerpo of cuerpos) {
        if (cuerpo.tipo === 'alias') continue;
        cuerpo.pieza?.liberar();
        cuerpo.atmosfera?.liberar();
        cuerpo.anillos?.liberar();
        cuerpo.lunas?.liberar();
        cuerpo.campo?.liberar();
        cuerpo.balizas?.liberar();
      }

      estrellas.liberar();
      nebulosa.liberar();
      galaxias.liberar();
      polvo.liberar();
      bigbang?.liberar();
      liberarGeometrias();
      liberarTexturas();
      liberarTexturasBaliza();
      renderer.dispose();
    },
  };

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
  /* La condición ES que exista la sección en el documento, y con eso basta.
     El sistema de proyectos lleva `activo: false` y `autoActivar: true` en
     la configuración, pero ambos son documentación para quien lea el
     archivo: la decisión real la toma el DOM.

     El orden importa: `main.js` monta `proyectos` antes que el universo,
     así que cuando aquí se busca `#proyectos` la sección ya existe si hay
     contenido. Ese es el puente entre "hay proyectos" y "hay un cúmulo de
     planetas", y por eso el módulo de proyectos va antes en la lista de
     montajes. */
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
