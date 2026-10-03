# ESTUDIO · ODISEA

Análisis de referencias, matriz comparativa y decisiones técnicas del sistema
de scrollytelling en WebGL de este portafolio.

> **Estado:** aprobado el 30 de septiembre de 2026.
> **Alcance:** todas las referencias se verificaron por web antes de citarse.
> No se ha copiado código, texturas, modelos ni assets protegidos de ningún
> sitio. Lo que se takeaway son técnicas documentadas públicamente.

---

## 0. Contexto del proyecto

El sitio antes de este trabajo era HTML, CSS y JavaScript de módulos ES
**sin ninguna dependencia, sin build step y sin framework**. Sigue siendo así:
lo único que se añadió al sitio son dos librerías vendorizadas explícitamente
(Three.js y Lenis), sin empaquetador. `tools/` sí tiene una dependencia, y es
solo de desarrollo —`jsdom`, para arrancar el sitio en un DOM de verdad—; no
la usa ningún archivo que se publique, y se instala con `--no-save` para que
no llegue a existir un `package.json` en el repositorio.

Esa decisión condiciona todo lo demás, así que conviene tenerla presente antes
de leer el resto del documento: **no hay tree-shaking**. Los ~417 KB gzip de
Three.js son el archivo completo, no el subconjunto que usamos.

---

## 1. Referencias analizadas

| # | Referencia | Autoría | Verificación |
|---|---|---|---|
| 1 | [Planetoño](https://www.awwwards.com/sites/planetono) | Sergii Valiukh, Oleg Savenok, Myky Zhuravlov, ladamyra_kunytsia, Ernest Asanov (Tubik PRO) | Site of the Day, 14 mar 2026. Stack declarado: Three.js, GSAP, Blender, Rive |
| 2 | [Planetoño — caso de estudio](https://tubikstudio.com/works/planetono) | Tubik Studio | FWA of the Day, Awwwards Developer Awards, GSAP Site of the Week |
| 3 | [The Monolith Project](https://www.awwwards.com/sites/the-monolith-project) | Ethan Chiu, Fabian Tjoe-A-On | Site of the Day. Puntuación 7.69/10 |
| 4 | [An AI Portfolio in the cosmos](https://www.awwwards.com/sites/an-ai-portfolio-in-the-cosmos) | ughshwin | Nominee. HUD de sesión, cursor ISS, timeline con cometa |
| 5 | [Stellar evolution — caso de estudio](https://thepineapple.express/case-study.html) | The Pineapple Express (Görlitz, Alemania) | Portafolio, 6 pantallas, 14 shaders GLSL escritos a mano |
| 6 | [More Than a Portfolio](https://tympanus.net/codrops/2026/04/28/more-than-a-portfolio-building-a-scroll-driven-3d-world-with-something-to-say/) | Joseph Santamaria | Codrops. Three.js + GSAP + Blender + KTX2 + Draco |
| 7 | [How to Build Cinematic 3D Scroll Experiences with GSAP](https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/) | Joseph Santamaria | Codrops. Camera timeline por segmentos, OGL y R3F |
| 8 | [Building a Scroll-Reactive 3D Gallery](https://tympanus.net/codrops/2026/03/09/building-a-scroll-reactive-3d-gallery-with-three-js-velocity-and-mood-based-backgrounds/) | Houmahani Kane | Codrops. Velocidad de scroll como señal reutilizable |
| 9 | [Scroll, Refraction and Shader Effects in Three.js and React](https://tympanus.net/codrops/2019/12/16/scroll-refraction-and-shader-effects-in-three-js-and-react/) | Paul Henschel | Codrops. Rig declarativo de scroll, mezcla HTML + canvas, instancing |
| 10 | [Let's Make One of Those Fancy Scrolling Animations Used on Apple Product Pages](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/) | Chris Coyier (CSS-Tricks) | Análisis del mecanismo de AirPods Pro |
| 11 | [Rock the Stage with a Smooth WebGL Shader Transformation on Scroll](https://tympanus.net/codrops/2021/07/13/rock-the-stage-with-a-smooth-webgl-shader-transformation-on-scroll/) | Fabienne Bielmann | Codrops. Uniforms GLSL interpolados por progreso de scroll |
| 12 | [code-musa.com](https://code-musa.com/) | Maicol Bautista | Verificado en septiembre de 2026. Mismo territorio: espacio 3D + HTML arriba. Aporta el selector de calidad, el recorrido guiado y la navegación con índice |

### 1.1 Análisis por referencia

**1–2. Planetoño.** Lo más relevante del caso de estudio es una frase sobre su
propio problema: *«We built a custom scroll animation engine in three.js»*. Su
reto explícito era que el scroll, el 3D y la UI tradicional colaboraran *sin
volverse clones*. La respuesta fue un portal en el que la UI 2D se mantiene
por encima y el espacio hace el resto. Concepto narrativo: el ritmo alterna
momentos de calma (lectura del pedido) con momentos de impacto (transición
entre生产企业). Cámara: No es el punto fuerte; el peso recae en el scroll y
las micro-interacciones de Rive. Coste: alto, porque dependen de bundler.

**3. The Monolith Project.** Lo que lo hace memorable es una transición de
*zoom blur* que empareja un objeto 2D con su versión 3D, y una escena de
*solar system* que se recorre con la cámara. Es exactamente el recurso que
usamos para la entrada en la atmósfera del planeta de Perfil. Su Dev Award de
7.69 confirma que el contenido en HTML no sufrió por meter 3D encima.

**4. An AI Portfolio in the cosmos.** El acierto más copiable de la lista: la
interfaz **es** la nave. Cursor con señal, HUD de sesión con temporizador y
brújula, y una línea temporal dibujada por el propio scroll. Ningún elemento
es decorativo: todo es señal de estado. Es el norte del HUD de este proyecto,
que ya existía en el sitio antes de este trabajo (`ESTADO / DISPONIBLE`,
`UBICACIÓN / BOGOTÁ, CO · UTC−5`).

**5. The Pineapple Express.** La referencia más útil a nivel de arquitectura,
por una razón casi táctica: *«We didn't [strip back mobile]. The site detects
the capabilities of the hardware it's running on before a single frame is
rendered»*. Su tesis — degradar la **precisión** del cálculo, nunca la
**identidad** visual — es la que se adopta aquí como principio de diseño del
sistema de calidad. También es el contrapunto honesto: 14 shaders y física de
agujero negro es un techo, no un punto de partida.

**6. More Than a Portfolio.** Aporta dos cosas concretas. La primera, que GSAP
`Observer` unifica ratón, táctil y trackpad en una sola entrada, evitando
handlers de scroll crudos. La segunda, más valiosa: documenta el problema de
**cambiar de modo de scroll a mitad del sitio** (bloques con snap frente a
scroll libre) y lo resuelve con una máquina de estados. La lección que se
extrae: un solo modo de scroll para todo el recorrido, sin excepciones, es más
fiable que intentar mezclar dos.

**7. Cinematic 3D Scroll.** El patrón técnico más directamente aplicable: un
`scenePerspectives` con una posición de cámara y un *look-at* por plano, y una
única timeline que interpola entre ellos. Esa es la estructura de `ruta.js` en
este proyecto, con dos curvas paralelas en lugar de una timeline de GSAP.

**8. Scroll-Reactive 3D Gallery.** La idea más subestimada de la lista:
**la velocidad de scroll es una señal reutilizable**, no solo un displacement.
La usan para subir el brillo del fondo, inclinar los planos y modular un
"respirar" global. Es gratis si el suavizado de scroll ya existe, y es lo que
produce la sensación de peso sin mover la cámara más rápido.

**9. Scroll, Refraction and Shaders.** El patrón de *mixing HTML and canvas*:
el rig expone `offset` y `factor` por bloque, y los componentes selean del
contexto para saber su posición de scroll. Es exactamente la frontera que
mantenemos aquí: el contenido no se mueve con la cámara, la cámara se mueve
alrededor del contenido.

**10. AirPods Pro.** El mecanismo, confirmado por análisis de red: un
`<canvas position: fixed>` que nunca scrollea, un `body` alto que da recorrido,
y un índice de frame derivado de `scrollTop / (scrollHeight - innerHeight)`.
Sin librería. Apple's own tradeoff — servir secuencias más ligeras a móviles
en red lenta — es la política de calidad adaptativa aplicada aquí en otro
nivel: menos triángulos, misma paleta.

**11. Rock the Stage.** La forma más simple y la que menos se decora:
cada uniform tiene un `start` y un `end`, y se interpola
`start + p * (end - start)`. Sin timeline, sin estado. Es exactamente la
fórmula usada para FOV, roll y velocidad de estela.

**12. code-musa.com.** Es la única referencia que vive exactamente en el
mismo terreno: un espacio 3D con el contenido HTML por encima y el scroll
como hilo. Por eso aporta más en interacción que las otras once, que son
técnica y esta es producto. Lo que se toma:

- **El selector de calidad en la cabecera.** No el botón de "vista simple"
  que ya había, sino un control de cinco estados con la palabra **Auto**
  primero. La idea que se copia no es el widget: es que un sistema que
  degrada solo, sin que el visitante pueda exigirle nada, es un sistema que
  se equivoca solo. Ver `UNIVERSO.md` §7.
- **El recorrido guiado.** Un disparador en la portada que entrega el
  recorrido hecho, con cortina de cine, contador y botón de parar. Es la
  respuesta a la pregunta más incómoda de un portafolio de este tipo: qué ve
  alguien que llega y no hace scroll. Ver `UNIVERSO.md` §9.
- **La navegación con índice numerado**, `01 Inicio`, `02 Sobre mí`. Aquí
  encaja mejor que allá porque el sitio ya tenía un HUD que numeraba los
  sistemas: el número es el mismo en los tres sitios, y eso es lo que lo
  hace útil en lugar de decorativo.

Lo que NO se toma, y conviene decir por qué: su ficha de proyecto vive en un
`<dialog>` que se abre sobre el resto. Aquí el texto de cada proyecto está
permanente en el documento, y abrirlo y cerrarlo solo se pierde para el
buscador, para el lector de pantalla y para quien no usa ratón. El patrón
visual —una miniatura grande que al pasar el ratón se atenúa y deja ver el
nombre— sí se puede copiar sin mover el texto.

---

## 2. Matriz comparativa

| # | Técnica | Qué la hace memorable | Coste de rendimiento | ¿Aplicable? |
|---|---|---|---|---|
| 1, 2 | Motor de scroll propio en Three.js + UI en portal | 3D y UI sin pelearse por el scroll | Alto (bundler, Rive) | **Adaptado** — un solo timeline en vez de un motor propio |
| 3 | Zoom blur 2D→3D, *matching* de objeto | El 3D nace de algo que ya era tuyo | Medio-alto | **Sí** — entrada en la atmósfera de Perfil |
| 4 | HUD de nave, cursor instrumental, timeline dibujada | La interfaz *es* la nave, no el marco de la nave | Bajo | **Sí, y es el eje del concepto** |
| 5 | Detección de hardware antes del primer frame; 14 shaders | Misma identidad visual en móvil y escritorio; solo cambia la precisión | Muy alto | **Adaptado** — 8 shaders, degradación de precisión |
| 6 | Escenas como *beats*; modo de scroll único | Narrativa con cambio de paleta a mitad del recorrido | Alto | **Sí** — paleta por sección, un solo modo de scroll |
| 7 | Timeline de cámara por segmentos (`scenePerspectives`) | La cámara dirige: encuadre, no solo posición | Medio | **Sí** — dos `CatmullRomCurve3` paralelas |
| 8 | Velocidad de scroll como señal global | El scroll se siente como tiempo; nada está nunca del todo quieto | Bajo | **Sí** — es lo que paga el peso de Lenis |
| 9 | Rig declarativo `offset`/`factor`; HTML sobre canvas; instancing | El contenido manda, el 3D acompaña | Bajo | **Sí** — el patrón completo de este proyecto |
| 10 | Canvas fijo + cuerpo alto + progreso normalizado | Mecanismo Apple completo en 20 líneas de CSS | Muy bajo | **Sí** — la fórmula ya existía en el sitio |
| 11 | Uniforms interpolados linealmente por progreso | Simplicidad: sin timeline, sin estado | Muy bajo | **Sí** — FOV, roll, estela |
| 12 | Selector de calidad, recorrido guiado, índice en la navegación | El visitante manda sobre el sistema que se autodegrada | Bajo | **Sí** — `core/calidad.js`, `modules/viaje.js` |

---

## 3. Patrones comunes de los sitios ganadores

1. **El HTML manda.** En ninguno de los sitios con Developer Award alto hay
   un problema de "Semantics / SEO". El texto vive en el documento.
2. **Una sola autoridad de scroll.** El fallo más documentado en toda la
   literatura: dos bucles de animación independientes hacen que una lea una
   posición obsoleta y todo se desincronice.
3. **Paleta que cambia por sección, mezclada de forma continua.** Nunca un
   corte. La transición de color es parte del montaje, no un efecto.
4. **Velocidad de scroll como señal** reutilizada en varios sistemas a la vez.
5. **Degradar precisión, no identidad** (ref. 5). Un móvil barato y una
   workstation ven *el mismo sitio*, no dos versiones del mismo sitio.
6. **El loader cuenta algo.** En los sitios mejor valorados, la pantalla de
   carga es parte del relato y no una espera muerta.
7. **UI de navecraft:** etiquetas en monoespaciada, índices `01/05`, barra de
   progreso, coordenadas. En este proyecto ya existía entera.
8. **Nada se mueve sin input.** En reposo la escena respira; no viaja. Y
   cuando algo se mueve solo —el recorrido guiado— el visitante puede
   pararlo con un gesto, sin haberlo pedido antes.
9. **El visitante puede exigir.** La degradación automática es una decisión
   que la máquina toma sobre el cuerpo de quien está mirando, y las máquinas
   se equivocan. El patrón —ref. 12— es poner el control delante, con la
   opción de no hacer nada como primera, y con una frase que explique qué
   va a pasar. No es un adorno: es la diferencia entre un sitio que se
   adapta y uno que se burla de su visitante.

## 4. Errores que había que evitar

| Error | Consecuencia | Cómo se evita aquí |
|---|---|---|
| GSAP ScrollSmoother + Lenis simultáneos | Los dos suavizadores se pelean por el scroll | Solo Lenis, y se documenta por qué no GSAP |
| `ScrollTrigger.normalizeScroll()` junto a Lenis | Conflicto directo | No se usa GSAP |
| `overflow: hidden` en `<html>`/`<body>` | Rompe `position: sticky` | El sitio ya usa `overflow-x: clip` en `html`, que no crea contenedor de scroll |
| Animar `top/width/height` en scroll | Reflow en cada frame | Solo `transform` y `opacity` |
| `refresh()` en cada resize de barra de direcciones | Jank constante en móvil | `svh` en contenedores de escena; sin GSAP no hay refresh |
| FBO de post-procesado encadenados | Relleno de pantalla y VRAM en gama media | Cero pasadas de post-procesado (ver §6) |
| Texto legible sobre un planeta sin velo | Ilegibilidad, el fallo más común | Velo radial con `color-mix` bajo cada panel |
| `lerp` con factor constante | Deriva a 120 Hz | `suavizar()` de `core/util.js`, independiente de framerate |
| Raycast para estados de hover del cursor | Acoplamiento 3D↔DOM frágil | El hover vive en el DOM, como ya está |
| Falso progreso de carga | El usuario miente sobre lo que tarda | Se cuenta progreso real, con techo de seguridad |
| Tramo de cámara a 4 u/px | Tirón, y se lee como un fallo de render | Reparto de velocidad en `ruta.js`; ver §10 |
| `scrollHeight` leído en cada fotograma | Reflow síncrono por fotograma | Una medida cacheada, revalidada solo al cambiar el documento; ver §11 |

---

## 5. Comparación de enfoques técnicos

|  | A · Three.js vanilla | B · Capas 2D/CSS | C · Secuencia de frames | **D · Híbrido (elegido)** |
|---|---|---|---|---|
| Naturaleza | WebGL + cámara sobre curva + shaders | Parallax CSS y Canvas 2D | Video o frames pre-renderizados | **WebGL de fondo + HTML real encima** |
| Inmersión | Alta | Media-baja | Alta | **Alta donde importa, legible donde hace falta** |
| SEO / a11y | Se rompe si el texto vive en el canvas | Perfecto | Se rompe | **Perfecto: todo el texto es HTML** |
| Peso | ~417 KB gzip | ~0 KB | 40–200 MB | **~425 KB gzip, carga diferida** |
| Móvil | Exige sistema de calidad | Excelente | Inviable | **Tres niveles + fallback real** |
| Editar textos | Difícil, en archivos aparte | Fácil | Imposible | **Fácil: sigue siendo el mismo `index.html`** |
| Soporta vive | No aplica | No aplica | No aplica | **Sí, el sitio es un solo archivo estático** |

### Elección: D

Es A en la capa de render, con el contenido intacto encima. Es lo que hacen las
referencias 1, 3, 6, 7 y 9, y encaja con una ventaja concreta del código base:
el contenido ya está en HTML plano y en dos archivos de datos, así que el
mapeo a cuerpos celestes es una tabla, no una migración.

B se habría descartado por la meta de calidad. C se descarta por peso.

---

## 6. Presupuesto de rendimiento

### 6.1 Cero texturas DE IMAGEN

La decisión de mayor impacto del proyecto. **No hay ni una sola textura
cargada.** Ni HDRI, ni glTF, ni KTX2, ni PNG de superficie. Toda superficie,
atmósfera, anillo, nebulosa y glow se calcula en el shader o se dibuja en un
canvas y se sube como `CanvasTexture` de 64 a 256 px.

Consecuencia: el "modelo" de cada planeta pesa **0 KB**, no hay pipeline de
assets, y no hay riesgo de que un `.hdr` de 6 MB rompa el presupuesto.

Medido: **0 texturas de imagen** en los tres niveles. Lo que hay son las ocho
texturas de relleno de 1×1 que Three.js crea para los uniformes sin asignar, y
las `CanvasTexture` generadas en tiempo de carga —el brillo del halo, la lámpara
de las balizas, las nubes y las galaxias, de 64 a 256 px— que suman menos de
100 KB de VRAM. La tabla decía "Texturas: 0", que es cierto para lo que
importa —nada que subir por la red— y engañoso para lo demás, y por eso ahora
tiene las dos filas.

### 6.2 Presupuesto por nivel

Todas las filas están **medidas**, no calculadas. La sección 6.2 bis explica
cómo y qué estaba mal antes. Los máximos son de todo el recorrido en 26
muestras, no de un punto concreto: un presupuesto que solo dice cuánto se
dibuja en la portada no dice cuánto se dibuja en el peor momento.

| Métrica | Alto | Medio | Bajo | Sin WebGL |
|---|---|---|---|---|
| Triángulos de planeta (icosaedro) | 500 | 320 | 180 | — |
| **Triángulos, máximo del recorrido** | **14 992** | **9 490** | **5 310** | — |
| Puntos dibujados, máximo | 13 200 | 7 800 | 4 200 | — |
| **Draw calls, máximo del recorrido** | **39** | **38** | **38** | 0 |
| Programas de shader | 17 | 17 | 16 | 0 |
| Texturas de imagen | 0 | 0 | 0 | 0 |
| Texturas creadas en total | 12-15 | 12-15 | 12-15 | 0 |
| DPR máximo | 1.75 | 1.5 | 1.25 | — |
| Objetivo de fps | 55 | 50 | 30 | 60 (CSS) |

Medido en escritorio (1440×900) y en móvil (390×844). Las cifras no cambian
entre viewports: es el mismo presupuesto, y ese es justamente el punto del
apartado 6.5, que bajar el nivel tiene que cambiar la precisión y no lo que se
ve. El número de texturas **subido** entre 12 y 15 según el recorrido porque
las `CanvasTexture` se crean la primera vez que su pieza se dibuja: no se
crean todas al montar.

### 6.2 bis · CÓMO SE MEDIÓ, Y POR QUÉ ESTA TABLA CAMBIÓ
La primera versión de esta tabla decía 2 562 / 642 / 162 triángulos por
planeta y ~48 000 en total, y estaba **inventada**: nadie la había medido. Los
tres números del icosaedro estaban mal, y el total era cuatro veces lo real.

Se mide interceptando el contexto WebGL antes de que Three.js lo pida, desde
la propia página, sin tocar el código del sitio: se cuentan las llamadas que
llegan al driver (`drawElements`, `drawArrays` y sus variantes instanciadas),
los triángulos que cada una dibuja, y los cambios de estado. El recorrido se
muestrea en 26 pasos y se queda el máximo, porque un presupuesto que solo dice
cuánto se dibuja en la portada no dice cuánto se dibuja en el peor momento.

**LOS TRES ERRORES, y por qué los tres son el mismo error:**

1. **El icosaedro.** Un `IcosahedronGeometry` de detalle `d` tiene
   `20 × (d + 1)²` triángulos, no `20 × 4^d`. Con detalle 4 son 500, no
   2 562. Verificado contra la geometría real de la librería vendorizada.
2. **El total.** Salió de multiplicar triángulos por planeta × número de
   planetas y sumar el resto a ojo. El real es 15 000 en alto, no 48 000. La
   diferencia está en que las piezas caras —el campo de rocas y las 21 lunas—
   van en `InstancedMesh`, así que son muchas más geometrías pero **una sola
   llamada de dibujo** cada una. Contar geometría como si costara lo mismo que
   una llamada es el error que inflaba el número.
3. **Los draw calls.** Decía ≤ 22 en alto y el máximo real es 39. Aquí la tabla
   iba al revés de la realidad, que es peor: prometía un presupuesto que el
   sitio no cumplía.

**Y por qué la tabla nueva no se queda igual que la vieja.** El icosaedro y su
triángulo están ahora comprobados contra la geometría real de la librería
vendorizada en `tools/probar-calidad.mjs`, así que el comentario de cada nivel
no puede volver a mentir: si se cambia `detallePlaneta`, la comprobación falla
hasta que el número del comentario cambie con él. Los totales y las llamadas no
se comprueban en `tools/` porque necesitan un navegador y una GPU, y un número
que solo se puede comprobar a mano acaba como estaba. Lo que sí queda escrito
es **cómo se miden**, que es lo que hace falta para repetirlas.

**LO QUE NO SE MIDió, y sigue sin medirse:** los fps. Chromium headless renderiza
por software con SwiftShader, así que los 16-60 fps que se ven ahí no dicen
nada. El framerate solo se mide en una máquina con GPU.

**Y que 39 draw calls no sean un problema.** La regla de oro de un móvil es que
el coste lo domina el *fill rate*, no el número de llamadas: 39 llamadas de
pocos miles de píxeles cada una es un presupuesto de GPU trivial. Lo que sí
importa es que las piezas grandes se dibujen pocas veces, y por eso las rocas,
las lunas y las estrellas están en una llamada cada una. La tabla anterior
medía la cosa equivocada como si fuera la importante, que es exactamente el
tipo de números inventados que hacen que una medición se quede sin hacer.

### 6.3 Peso total

| Parte | gzip | Nota |
|---|---|---|
| Sitio actual (HTML + CSS + JS + fuentes + imagen) | ~420 KB | Medido en el repositorio, sin comprimir 440 KB |
| Three.js 0.186.1 | 417 KB | `three.module.js` 131 KB + `three.core.js` 286 KB. Sin tree-shaking |
| Lenis 1.3.26 | 8 KB | |
| **Total** | **~845 KB** | |
| **LCP** | Sin cambio | El `<h1>` solo necesita dos fuentes ya preloaded; Three.js se importa de forma dinámica *después* del preloader |

### 6.4 Post-procesado: la decisión que hace viable el presupuesto

**No hay ninguna pasada de post-procesado en el pipeline WebGL.** Ni
`EffectComposer`, ni `UnrealBloomPass`, ni cadenas de render targets. En su
lugar:

- **Bloom** → *sprites* aditivos con una textura de gradiente radial generada en
  canvas. Un `UnrealBloomPass` cuesta varias pasadas a pantalla completa y
  mipmaps de luminancia; esto cuesta un *blend* y da gran parte del resultado.
- **Viñeta y grano** → CSS, reutilizando el elemento `.vineta` que ya existe y
  una capa `.grano` nueva. Coste de GPU cero, y era como el sitio ya resolvía
  el asunto.
- **Aberración cromática** → dentro del shader de estrellas como distorsión
  radial durante el salto de menú, no como un filtro sobre el canvas.

La suma de fill-rate es lo que mata a estos sitios en gama media. Cargar la
viñeta desde el compositor del navegador en vez de desde la GPU es
prácticamente la mitad del presupuesto.

### 6.5 Calidad adaptativa

La detección ocurre **antes del primer frame** y combina cuatro señales:

- `navigator.hardwareConcurrency`
- `navigator.deviceMemory`
- `WEBGL_debug_renderer_info` → `UNMASKED_RENDERER_WEBGL` (clase de GPU)
- `matchMedia('(pointer: coarse)')` y el ancho de pantalla

Encima de eso hay una **sonda en vivo**: los primeros 90 frames promedian el
framerate real. Si la media cae por debajo del umbral del nivel, se degrada
**una sola vez** y se registra el motivo. Nunca oscila.

El principio de la referencia 5 se respeta en la forma de degradar: baja la
precisión (triángulos, puntos, capas de atmósfera), nunca la paleta ni el guion.

### 6.6 Presupuesto de asignación

- Geometrías de esfera y de debris compartidas y reutilizadas.
- `InstancedMesh` para las 21 lunas de habilidades y las rocas del campo.
- Sin asignaciones en el bucle de render: vectores, quaterniones y matrices
  se declaran fuera y se reutilizan.
- `dispose()` completo de geometrías, materiales y texturas en `pagehide`.
- El canvas se pausa con `visibilitychange`, siguiendo el patrón que ya
  existía en `modules/fondo.js`.

---

## 7. Enfoques de scroll considerados

| Enfoque | Veredicto |
|---|---|
| Scroll nativo + amortiguación de cámara | Correcto, pero la señal de velocidad sale sucia del scroll nativo |
| **Lenis solo, escritorio** | **Elegido.** 8 KB, señal de velocidad suavizada de verdad, respeta `position: sticky` porque envuelve el scroll nativo |
| Lenis + GSAP ScrollTrigger | Descartado. ~70 KB gzip para un segundo sistema de timeline que hay que mantener sincronizado, que es exactamente el error documentado en §3.2 |
| GSAP ScrollSmoother | Descartado. Es un producto de Club y no se integra con Lenis |

**Lenis solo se activa en escritorio** (puntero fino, sin `prefers-reduced-motion`,
y una ventana de render razonable). En táctil se usa scroll nativo con la
amortiguación de cámara, que ya aporta la sensación de peso, y se elimina todo
riesgo de *scroll-jacking* en iOS, donde `syncTouch` tiene problemas conocidos.

Requisito que impone Lenis: `html { scroll-behavior: auto }` cuando es Lenis
quien suaviza, y enrutar los tres `scrollTo` existentes por un helper único.

---

## 8. Consecuencias aceptadas

1. **+425 KB** sobre el peso actual, sin tree-shaking. Aceptado a cambio de no
   introducir un build step ni un `package.json` en un sitio cuyo argumento de
   venta es la ausencia de ambos.
2. **El texto del pie cambia.** Decir *"sin librerías externas"* ya no sería
   cierto. Se reformula como *"sin frameworks"*, que sigue siendo exacto.
3. **El tema claro se retira.** Un universo nocturno no tiene versión Alba.
4. **Three.js se importa dinámicamente.** Necesario para que el LCP no dependa
   de 417 KB de JavaScript.
5. **Sin SSR ni build.** El contenido es HTML estático y por eso el sitio es
   indexable y funciona sin JavaScript.
6. **Una dependencia, y solo de desarrollo.** `tools/probar-dom.mjs` usa
   `jsdom` para arrancar el sitio en un DOM de verdad. El sitio publicado no
   tiene `package.json` ni `node_modules`; la dependencia se instala con
   `npm install --no-save` y la comprobación se salta sola si no está.

---

## 10. El reparto de velocidad de la cámara

**EL PROBLEMA.** La `ZONA_DE_CAMBIO` de `ruta.js` reserva el 18 % final de
cada sección para el cambio de plano, de modo que la cámara empiece a salirse
del cuerpo actual mientras el visitante todavía está leyendo esa sección. Es
la solución correcta al problema del salto entre secciones.

Lo que tenía el fallo es que el 18 % es una **fracción de la altura de la
sección**, y la distancia que hay que cubrir no es una fracción de nada: es
geometría. Un cambio de cuerpo a cien unidades y uno a mil unidades gastan la
misma reserva y tardan una fracción de lo mismo. Medido sobre el guion de este
proyecto, el tramo de la portada al planeta de Perfil recorría 950 unidades
con 231 px de scroll: **4,11 unidades por píxel**, cuando el resto de la
película iba entre 0,08 y 1,70. El ojo no lo lee como una cámara rápida: lo lee
como un tirón.

**LO QUE HAY QUE ENTENDER ANTES DE ARREGLARLO.** La velocidad de un tramo no
la decide la sección, la decide la GEOMETRÍA. Cualquier reparto que ligue la
velocidad a la altura del documento hereda el mismo fallo, solo que
repartido: dos tramos del 20 % cada uno, uno de 100 unidades y otro de 1 000,
siguen yendo a 0,4 y a 4,0 respectivamente.

**LA SOLUCIÓN.** Después de repartir el scroll por secciones —que es lo que
acopla la cámara al texto— se hace un segundo reparto que solo mira la
distancia: a cada tramo se le da el ancho que necesita para no pasar de
`VELOCIDAD_OBJETIVO` (1,2 u/px), y ese ancho se le cobra al resto en
proporción a lo que cada uno tenía de sobra. Es una proyección sobre el
conjunto `{ancho ≥ mínimo por distancia} ∩ {suma = alto del documento}`, que
es convexo, así que converge en unas veinte iteraciones.

| | Antes | Después |
|---|---|---|
| Tramo más rápido | 4,11 u/px | 1,20 u/px |
| Tramo más lento | 0,08 u/px | 0,08 u/px |
| Peor tramo ÷ media | 6,1× | 1,8× |

**POR QUÉ NO SE TOCARON LOS FOTOGRAMAS.** Lo más directo habría sido acercar
el último fotograma de la portada para que el puente fuera corto. Se
descartó por dos razones. La primera es que el Big Bang es el arranque del
proyecto, y la dirección de su salida es una decisión de guion, no de
algoritmo. La segunda es más interesante: arreglar el síntoma en los datos
deja el mismo fallo esperando a la próxima vez que alguien mueva un cuerpo.
Arreglarlo en el algoritmo lo deja arreglado para siempre, y convierte el
problema en un dato que se puede medir —`probar-ruta.mjs` lo mide— en vez de
una impresión.

**EL LÍMITE, DICHO.** La garantía es condicional: si entre todos los tramos
piden más scroll del que el documento tiene, el objetivo es matemáticamente
imposible. En ese caso el reparto escala el objetivo a lo que sí cabe, deja
**todos** los tramos a la misma velocidad —parejo, que es lo único posible— y
avisa por consola de cuánto faltaría. Un reparto que se rindiera en los tramos
difíciles los dejaría al 4× mientras el resto va a 0,2, que es exactamente el
tirón que se vino a arreglar. `probar-ruta.mjs` prueba las dos situaciones.

**LO QUE NO RESUELVE.** El reparto iguala la velocidad, no la perspectiva. Si
lo que quieres es que todos los planos se vean al mismo tamaño, eso se
escribe en los fotogramas, y no hay algoritmo que lo decida por ti.

---

## 11. Una sola medida de la altura del documento

**EL PROBLEMA.** `document.documentElement.scrollHeight` es la única manera
que tiene el navegador de saber cuánto se puede desplazar, y leerlo **vacía
la cola de diseño**: si el documento está sucio, la lectura provoca un reflow
síncrono completo.

Y el documento estaba sucio tres veces por fotograma: `cabecera.js` escribía
`--avance` en la barra de lectura en cada evento de scroll, el HUD escribía su
barra de avance en cada fotograma, y la escena escribía `dataset.sistema` en
el `<html>` al final de cada cuadro. Es decir: la lectura del `scrollHeight`
siempre venía después de una escritura, que es exactamente el caso en que el
reflow es más caro. Un móvil de gama media con la barra de direcciones
plegándose durante el scroll lo nota; un portátil de escritorio, no.

**LA SOLUCIÓN.** `core/desplazar.js` es el dueño de la medida: la calcula una
vez, la cachea, y la vuelve a calcular cuando el documento cambia de verdad,
que son las dos únicas cosas que lo cambian —el `resize` con retardo y
`document.fonts.ready`. Los tres lectores —la barra de lectura, el bucle de
render y la ruta— leen el mismo número. Una medida, tres consumidores.

**LO QUE LA HACE BARATA, Y NO ES LO PRIMERO QUE SE PIENSA.** La lectura con
reflow desapareció, pero la escritura se quedó: escribir una Custom Property
en cada fotograma invalida el estilo del nodo y el de todo lo que la use. Se
escribía a cuatro decimales sesenta veces por segundo para un número de tres
píxeles de ancho. Con un margen de dos milésimas se escribe unas veinte veces
en un recorrido completo y se ve igual.

**DE PASO.** El mismo razonamiento se aplicó al lienzo. `renderer.setSize()`
reasigna el framebuffer entero, y en móvil eso ocurre cada vez que la barra
de direcciones se plega, porque al plegarse cambia `window.innerHeight`. Con
una tolerancia de dos píxeles y un retardo de 160 ms deja de ocurrir. El
lienzo está en `position: fixed` con `inset: 0`, así que el CSS lo estira al
viewport de todos modos: un buffer dos píxeles más pequeño que su caja es
indistinguible y no obliga a reasignar nada.

---

## 12. Referencias de código consultadas

- Documentación de Lenis en npm (`lenis@1.3.26`): opciones, `respectReducedMotion`,
  notas de rendimiento, lista de limitaciones en Safari e iOS.
- Guía de sincronización Lenis ↔ GSAP del foro de GSAP, hilo *«Pattern(s) for
  synchronizing ScrollTrigger and Lenis»*, y la discusión #140 en
  `darkroomengineering/lenis` sobre doble reflow por orden de ejecución.
- `THREE.CatmullRomCurve3` y `getPointAt` frente a `getPoint` (longitud de arco
  constante frente a distribución de puntos) en la documentación de Three.js.
- Lista de limitaciones de Lenis usada para decidir el gate de escritorio.
- `jsdom` como banco de pruebas del arranque. No es una referencia de
  producción —nada del sitio se importa de ahí— sino la forma de ejecutar el
  `index.html` real y el grafo de módulos sin navegador. Es lo que permite
  que `tools/probar-dom.mjs` detecte los fallos de cableado, que son
  invisibles leyendo el código y evidentes ejecutándolo.
---

## 12. Lo que no se veía: mirar la pantalla

Esta sección es el resultado de una lección. La primera tanda de trabajo
sobre este proyecto se hizo con siete comprobaciones estáticas y una octava de
arranque en un DOM. Todas pasaban. Y la página, en el navegador, era un fondo
negro con puntos blancos y un rótulo que decía «SISTEMA».

Las comprobaciones eran correctas y comprobaban lo que comprobaban. Lo que
no existía era la pregunta «¿qué se ve?». Un `rgb(10, 15, 27)` sobre un
`rgb(9, 14, 25)` pasa cualquier prueba de sintaxis, de imports, de
accesibilidad y de contenido conservado, y es un planeta que no está.

**LO QUE SALIÓ DE MIRAR, en orden de coste:**

| Defecto | Cómo se veía | Por qué no lo cazaba nada |
|---|---|---|
| El velo de sección al 88 % ENCIMA del lienzo | Cielo negro | `z-index: -1` dentro de `main`, que está a 10, sobre un lienzo a 1. Nada lo falla: es CSS válido. |
| La viñeta al 78 % en la mitad de abajo | Cielo negro | Dos capas que hacen el mismo trabajo, sumadas: 6 % de la luz de la escena. |
| La cámara DENTRO del gigante gaseoso | Un agujero negro con un arco de anillo | Está a 95 unidades de un cuerpo de 132. Desde dentro solo se ven las caras descartadas. |
| Un backtick en un comentario GLSL | El universo entero desaparecido | Cierra la plantilla. `node --check` a secas no lo ve; hace falta el parser de módulos. |
| Estrellas de 0,99 píxeles | Cielo vacío | El cálculo de tamaño era correcto y el resultado, invisible. |
| La explosión acabada en el 82 % de la portada | La última quinta parte, a oscuras | La reserva del cambio de plano, aplicada a la apertura. |

**LOS TRES DEFECTOS QUE SON DEL MISMO TIPO**, y son los que importan:

1. El velo y la viñeta. Dos capas de oscurecimiento, cada una razonable por
   separado, sumadas hasta hacer un muro. **El defecto no era ninguno de los
   dos: era el producto.**
2. La cámara dentro del cuerpo. El dato era plausible; el resultado, absurdo.
   Lo que faltaba era una medición.
3. El backtick. El archivo era JavaScript válido hasta que alguien lo ejecutó.

**LO QUE SE CONCLUYE.** Una comprobación estática verifica que el código sea
lo que dice ser. Ninguna verifica que el resultado sea el que se quiere. Y en
un sitio cuyo producto ES una imagen, la diferencia entre las dos cosas es el
producto entero.

Por eso ahora hay una novena comprobación que ejecuta el sitio, y por eso las
invariantes que se rompieron —la cámara dentro de un cuerpo, la velocidad
de un tramo— están ahora en `tools/` como aserciones, y no solo explicadas en
un comentario. Un defecto que se midió una vez y se escribió como prueba no
vuelve a colarse por el mismo sitio.

---

## 13. La costura del sol: un defecto de una sesión entera en trece líneas de CSS

La portada tenía una línea horizontal a media altura con el sol apagado
encima y entero debajo. Medido sobre la captura: `rgb(43,43,48)` en `y=459` y
`rgb(204,199,195)` en `y=468`. Un salto de 42 a 198 en nueve píxeles: no era
un degradado, era un corte.

**LO QUE SE DESCARTÓ, y por qué estaba bien descartarlo.** Todas las capas de
`bigbang.js` mezclan con `AdditiveBlending`, y con mezcla aditiva nada puede
oscurecer a otra capa. El shader del sol usa `mu = clamp(dot(n, vision), 0, 1)`
sobre un `FrontSide` cuya normal mira a cámara. La corona usa `abs(dot(...))`
a propósito, con el comentario que explica que sin el absoluto el halo se
invertiría. Y `ruta.js` se comprobó aparte: `recalibrar` es idempotente, tres
calibraciones seguidas dan lo mismo que una. Todo eso era cierto. **El defecto
no estaba en ningún sitio donde se buscó.**

**LO QUE LO ENCONTRÓ.** Un puente de depuración temporal que exponía la
escena, la lista de hijos visibles y la posición de cada uno proyectada a
pantalla. Con eso la pregunta dejó de ser «¿qué objeto dibuja esto?» y pasó a
ser «¿qué nodo del DOM tapa este píxel?». `document.elementsFromPoint(720, 420)`
devolvió el scrim `.hero__contenido::before` con `bottom: 560,1`. La costura
estaba en `y=560`.

**LA CAUSA, que es geométrica y no misteriosa.** Un scrim es un
`radial-gradient` dentro de una caja. Si el radio del gradiente es mayor que
la distancia del centro al borde de la caja, el gradiente no ha llegado a su
último stop cuando la caja se acaba, y a partir de ahí no se dibuja nada. La
declaración era `radial-gradient(116% 108% at 50% 50%, ...)`: un radio un 16 %
más grande que la caja. Al borde le quedaban 0,82 de alfa. El salto de 0,82 a
0 es exactamente lo que se veía.

**POR QUÉ NO SE ARREGLÓ BAJANDO EL RADIO.** Con el centro al 50 %, que el
stop transparente caiga dentro de la caja exige un radio del 50 % o menos. Y
con un radio del 50 % las esquinas del bloque de texto quedan SIEMPRE fuera
del núcleo opaco, porque la distancia normalizada en dos ejes es una suma de
cuadrados: para un texto de 1 020 × 586 px habría que extender el scrim 400 px
por cada lado, y eso ya no es un scrim sino una capa negra sobre casi toda la
portada. **La elipse no podía arreglarlo. La forma estaba mal.**

**EL ARREGLO.** Un rectángulo con los bordes difuminados no es una elipse, y
CSS lo tiene hecho: dos degradados lineales cruzados, uno por eje, con
`mask-composite: intersect`. El scrim resultante es opaco donde los dos lo son
y transparente en cuanto uno deja de serlo, así que los cuatro bordes quedan
a 0 por construcción y no queda ningún número que pueda volver a cortar.

**Y LA TRAMPA DE SEGUNDO ORDEN.** La difuminación tiene que caber entera en el
margen que sobresale del bloque de texto. La primera versión la puso en 7rem y
5rem con un `inset` de 2,75rem y 1,75rem, así que la rampa se metía dentro del
texto: la entradilla de Perfil bajó de **7,79:1 a 2,98:1**. Arreglar la
geometría sin medir el contraste después habría sido cambiar un defecto
visible por otro, y este último es más difícil de ver que el primero.

**LO QUE SE ESCRIBIÓ.** `tools/verificar-velos.mjs`, que lee el CSS y
comprueba que todo velo se apague antes de que su caja se acabe. Es
estática a propósito: el defecto es una relación entre dos números escritos
en el archivo, y esa relación se lee sin abrir un navegador. Una captura lo
encontraría tarde y de forma intermitente, porque depende de dónde caiga la
estrella, que depende del scroll.

**LA MEDICIÓN DEL CONTRASTE, Y CÓMO SE HIZO MAL CUATRO VECES.** El principio
del que parte todo: `getComputedStyle` da el color del texto y el fondo es el
píxel que tiene debajo. El fondo hay que sacarlo de una captura con el texto
oculto, porque el búfer WebGL se vacía al componer y `drawImage` mide el texto
contra negro. Y ahí están las cuatro trampas, en orden:

1. **Restar dos capturas sin congelar nada.** El granulado de la estrella se
   anima con el reloj: entre dos capturas cambia un píxel de cada dos y la
   diferencia se confunde con el texto.
2. **Medir la caja entera.** El hueco entre dos palabras no es letra, y su
   fondo no dice nada de si esa palabra se lee. Salía 1,00:1 siempre.
3. **Medir el borde de la letra.** Una letra no es una mancha de un solo
   color: su borde contra el fondo es siempre más claro y siempre tiene menos
   contraste. Medirlo daba 2,5:1 con el texto perfectamente legible.
4. **Mirar solo la luminancia para decidir qué píxel es letra.** Dejaba pasar
   el anillo del logo de la cabecera, que es claro y cambia entre capturas, y
   su "contraste" contra el titular salía 1,04:1 sin que hubiera ni una letra
   ahí.

La medición que sí vale congela la escena engañando a `document.hidden` —
`escena.js` para su bucle y el lienzo conserva su último fotograma—, decide
qué píxel es letra en COLOR y no en luminancia, y recorta por debajo de la
cabecera, porque al desplazarse la portada la caja del titular la invade por
arriba.

**RESULTADO, en escritorio y en móvil:** 19 zonas medidas, la más baja
**8,63:1**, todas por encima de AAA. El titular sobre el sol encendido:
18,26:1.

**LO QUE ESTE DEFECTO ENSEÑA, y es lo mismo que la sección anterior.** La
comprobación que faltaba no era "el CSS está bien formado": el `radial-gradient`
era perfectamente válido. Faltaba la que pregunta si el RESULTADO se apaga antes
de que su soporte se acabe. Y la segunda lección es peor: arreglar la forma sin
medir el efecto sobre el texto habría dejado el sitio igual de roto y con un
defecto nuevo encima. **Una corrección de una capa decorativa es un cambio de
contraste hasta que se mide.**
