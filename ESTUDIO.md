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
lo único que se añadió son dos librerías vendorizadas explícitamente
(Three.js y Lenis), sin empaquetador.

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

### 1.1 Análisis por referencia

**1–2. Planetoño.** Lo más relevante del caso de estudio es una frase sobre su
propio problema: *«We built a custom scroll animation engine in three.js»*. Su
reto explícito era que el scroll, el 3D y la UI tradicional colaboraran *sin
volverse 코노oping*. La respuesta fue un portal en el que la UI 2D se mantiene
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

**11. Rock the Stage.** La forma más simple y la que menos se-decoration da:
cada uniform tiene un `start` y un `end`, y se interpola
`start + p * (end - start)`. Sin timeline, sin estado. Es exactamente la
fórmula usada para FOV, roll y velocidad de estela.

---

## 2. Matriz comparativa

| # | Técnica | Qué la hace memorable | Coste de rendimiento | ¿Aplicable? |
|---|---|---|---|---|
| 1, 2 | Motor de scroll propio en Three.js + UI en portal | 3D y UIconventional sin pelearse por el scroll | Alto (bundler, Rive) | **Adaptado** — un solo timeline en vez de un motor propio |
| 3 | Zoom blur 2D→3D, *matching* de objeto | El 3D nace de algo que ya era tuyo | Medio-alto | **Sí** — entrada en la atmósfera de Perfil |
| 4 | HUD de nave, cursor instrumental, timeline dibujada | La interfaz *es* la nave, no el marco de la nave | Bajo | **Sí, y es el eje del concepto** |
| 5 | Detección de hardware antes del primer frame; 14 shaders | Misma identidad visual en móvil y escritorio; solo cambia la precisión | Muy alto | **Adaptado** — 8 shaders, degradación de precisión |
| 6 | Escenas como *beats*; modo de scroll único | Narrativa con cambio de paleta a mitad del recorrido | Alto | **Sí** — paleta por sección, un solo modo de scroll |
| 7 | Timeline de cámara por segmentos (`scenePerspectives`) | La cámara dirige: encuadre, no solo posición | Medio | **Sí** — dos `CatmullRomCurve3` paralelas |
| 8 | Velocidad de scroll como señal global | El scroll se siente como tiempo; nada está nunca del todo quieto | Bajo | **Sí** — es lo que paga el peso de Lenis |
| 9 | Rig declarativo `offset`/`factor`; HTML sobre canvas; instancing | El contenido manda, el 3D acompaña | Bajo | **Sí** — el patrón completo de este proyecto |
| 10 | Canvas fijo + cuerpo alto + progreso normalizado | Mecanismo Apple completo en 20 líneas de CSS | Muy bajo | **Sí** — la fórmula ya existía en el sitio |
| 11 | Uniforms interpolados linealmente por progreso | Simplicidad: sin timeline, sin estado | Muy bajo | **Sí** — FOV, roll, estela |

---

## 3. Patrones comunes de los sitios ganadores

1. **El HTML manda.** Ninguno de los SITE con Developer Award alto这件 caso
   weblog洞пустит "Semantics / SEO" defectuoso. El texto vive en el documento.
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
8. **Nada se mueve sin input.** En reposo la escena respira; no viaja.

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

### 6.1 Cero texturas

La decisión de mayor impacto del proyecto. **No hay ni una sola textura.** Ni
HDRI, ni glTF, ni KTX2, ni PNG de superficie. Toda superficie, atmósfera,
anillo, nebulosa y glow se calcula en el shader o se genera en un canvas de
2 píxeles de radio en tiempo de carga.

Consecuencia: el "modelo" de cada planeta pesa **0 KB**, no hay pipeline de
assets, y no hay riesgo de que un `.hdr` de 6 MB rompa el presupuesto.

### 6.2 Presupuesto por nivel

| Métrica | Alto | Medio | Bajo | Sin WebGL |
|---|---|---|---|---|
| Triángulos de planeta (icosaedro) | 2 562 | 642 | 162 | — |
| Triángulos totales | ~48 000 | ~24 000 | ~11 000 | — |
| Puntos de estrellas | 4 000 | 2 200 | 1 200 | — |
| Draw calls | ≤ 22 | ≤ 16 | ≤ 10 | 0 |
| Texturas | 0 | 0 | 0 | 0 |
| DPR máximo | 1.75 | 1.5 | 1.25 | — |
| Objetivo de fps | 60 estable | 60 estable | ≥ 30 estable | 60 (CSS) |
| VRAM pico estimada | < 40 MB | < 26 MB | < 14 MB | 0 |

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

### 6.6 Presupuesto deallocate

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

---

## 9. Referencias de código consultedadas

- Documentación de Lenis en npm (`lenis@1.3.26`): opciones, `respectReducedMotion`,
  notas de rendimiento, lista de limitaciones en Safari e iOS.
- Guía de sincronización Lenis ↔ GSAP del foro de GSAP, hilo *«Pattern(s) for
  synchronizing ScrollTrigger and Lenis»*, y la discusión #140 en
  `darkroomengineering/lenis` sobre doble reflow por orden de ejecución.
- `THREE.CatmullRomCurve3` y `getPointAt` frente a `getPoint` (longitud de arco
  constante frente a distribución de puntos) en la documentación de Three.js.
- Lista de limitaciones de Lenis usada para decidir el gate de escritorio.
