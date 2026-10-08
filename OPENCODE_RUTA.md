# OPENCODE_RUTA — Del sitio actual al viaje Big Bang → Vía Láctea → sistema solar

Para OpenCode. Léelo entero antes de tocar nada. Es la continuación de
`PENDIENTES.md`, que quedó desactualizado (ver el aviso de su primera línea).

**La idea del portafolio:** el scroll es un viaje. Empieza en un Big Bang, cruza
galaxias hasta la Vía Láctea, entra en el sistema solar y pasa por sus planetas.
Cada sección del portafolio es un lugar de ese viaje. Sigue siendo un sitio
estático: **solo HTML, CSS y JavaScript**, sin dependencias nuevas (Three.js ya
está en `assets/vendor/three/0.186.1/`).

---

## 1. De dónde partimos

### 1.1 Qué se arregló en esta entrega (sin commitear todavía)

| Cambio | Archivos |
|---|---|
| **Shader de estrellas** no compilaba (`rand()` inexistente, `vSemilla` sin declarar) | `universo/capas/estrellas.js` |
| **Shader de TODOS los planetas** no compilaba (la variable local `fresnel` tapaba la función `fresnel()`) | `universo/cuerpos/planeta.js` |
| Planeta de 500 triángulos (silueta poligonal): nuevo campo `resolucionPlaneta` (32/20/10), solo para planeta y atmósfera | `universo/calidad.js`, `cuerpos/planeta.js`, `universo/escena.js` |
| **Apertura como Big Bang**: la estrella nace como singularidad (punto con halo que late), la explosión arranca al 20 % del tramo y el contenido del hero se desvanece con el scroll | `cuerpos/bigbang.js`, `universo/escena.js`, `css/06-universo.css` |
| Paleta física para el planeta hogar (azul/verde) y el gigante (ocre) | `data/universo.js` |
| Herramientas nuevas: `verificar-webgl.mjs`, `capturar.mjs`, `medir-contraste.py` | `tools/` |
| Aviso de estado corregido | `PENDIENTES.md` |

### 1.2 Qué estaba mal y por qué «no quedaba bien» (medido)

1. **Dos shaders rotos.** Sin estrellas y sin planetas. Las doce comprobaciones
   seguían en verde porque eran estáticas y no compilan GLSL. *(arreglado)*
2. **El Big Bang no se veía.** A scroll 0 había un Sol de radio 34 en el centro
   y no se veía: lo tapaba el *scrim* de `.hero__contenido::before`, un
   rectángulo de 1180×698 px al **88 % de negro**. *(arreglado en la portada)*
3. **Todo el sitio usa la misma solución: cortinas.** `.section-head`,
   `.perfil__bio`, `.stack__nota`, `.pie__marca` y `.hero__contenido` llevan un
   scrim del **84-88 %** (`06-universo.css`, líneas ~255-370) y las secciones un
   velo del **40 %**. Por eso Proceso y Habilidades son tres pantallas de texto
   sobre negro y los planetas se ven apenas un instante. **Esto sigue sin
   arreglar fuera de la portada y es el paso 4.**
4. **Planetas con la paleta de la web** (cian, violeta, rosa): se leen como
   canicas de marca, no como mundos.
5. **Tres de los cuerpos del viaje no son planetas reconocibles**, y el viaje no
   pasa por galaxias ni por la Vía Láctea.
6. **El portafolio no tiene proyectos**: `data/proyectos.js` está vacío y no
   existe `#proyectos` en `index.html`. Además `canonical` sigue como
   `https://TU-DOMINIO/` y el endpoint del formulario (`CONTACTO.endpoint`)
   está vacío.
7. **El proceso de trabajo fallaba**: cuatro commits `chore: mejora realismo`
   seguidos (6 oct, 13:16-13:19), sin abrir el navegador. Además esos commits
   reescribieron archivos enteros y `planeta.js` perdió su indentación.

---

## 2. Reglas de trabajo (no negociables)

1. **Un cambio visual = un commit.** Nunca encadenes «mejoras de realismo».
2. **Tras cada cambio, en este orden:**
   `node tools/comprobar.mjs` → `node tools/verificar-webgl.mjs` →
   `node tools/capturar.mjs ...` → **abrir la captura y mirarla** → describir en
   una frase lo que se ve. Si no abriste la imagen, no está verificado.
3. **No escribas «verificado», «cero errores» ni «en verde» en ningún `.md` sin
   haber ejecutado el comando en ese momento.** Pon fecha y comando.
4. **No reescribas archivos enteros ni los reformatees** en el mismo commit que
   un cambio de lógica. Parches pequeños. Si hay que reindentar `planeta.js`,
   es un commit aparte y solo de formato.
5. **Colores:** los de interfaz salen de los tokens (`01-tokens.css`). Los de
   superficie de un cuerpo celeste son físicos y van como hex en
   `data/universo.js`, con un comentario que lo diga (el resolver de
   `escena.js` ya acepta hex).
6. **Todo texto sobre la escena se mide**, no se supone:
   `python3 tools/medir-contraste.py "<selector>" <scrolls>` → mínimo 4,5 para
   texto normal, 3 para texto grande.
7. **Juzga el aspecto en calidad `alto`; juzga el presupuesto en `medio` y `bajo`;
   comprueba siempre 390×844 (móvil).** Con GPU de software la sonda de fps
   degrada sola a «bajo» y todo sale facetado: eso no es un defecto.
8. **Si un paso depende de algo que no has leído, léelo antes.** Esta ruta cita
   archivos y campos reales, pero lo marcado con *(sin verificar)* son hipótesis
   mías: compruébalas con `probar-ruta.mjs` y capturas.

---

## 3. Herramientas

```bash
# una sola vez (no hay package.json, es a propósito)
npm i --no-save playwright && npx playwright install chromium
pip install playwright pillow            # solo para medir-contraste.py

node tools/comprobar.mjs                 # todas las comprobaciones
node tools/verificar-webgl.mjs           # abre Chromium, recorre TODO el sitio, falla ante
                                         #   cualquier error de shader o de consola
node tools/capturar.mjs <pref> <nivel> <scrolls|todo> [ancho] [alto]
#   p. ej.  node tools/capturar.mjs inicio alto 0,300,600,900
#           node tools/capturar.mjs movil medio todo 390 844
#   guarda en /tmp/capturas/<pref>_<n>.png  → ábrelas y míralas
python3 tools/medir-contraste.py ".hero__resumen,.hero__chips" 0,60,120
```

- `http://localhost:8099/?debug` expone `window.__escena` (cuerpos, capas,
  cámara, `ruta`, `irA`). Útil para apagar piezas y medir píxeles.
- **Elegir un nivel de calidad recarga la página** (`calidadVisual.js`). Las
  herramientas ya lo gestionan; si escribes tus propias pruebas, espera la
  navegación.
- `verificar-webgl.mjs` se omite sin `playwright`; **no cuentes una omisión
  como un aprobado**.

### Mapa de scroll de la apertura (aprox., con GPU de software)

El hero mide 1710 px. Orientativo, medido con la cámara suavizada:

| Scroll | Qué pasa |
|---|---|
| 0 – 90 | Singularidad: punto de luz con halo que late. Texto del hero opaco. |
| 90 – 300 | «Desplázate» desaparece (0-90). El texto empieza a apartarse (150-470). |
| ≈ 300 – 540 | La estrella nace y crece (`NACE_EN`, `INICIO_EXPLOSION`). |
| ≈ 530 – 610 | Detonación. |
| ≈ 870 | Sol apagado; polvo estelar; el planeta empieza a condensarse. |

---

## 4. La ruta

Cada paso tiene **Hecho cuando**: si no se cumple, el paso no está hecho.

### Paso 1 — Registrar lo ya hecho en commits limpios

`git status` debe mostrar solo los archivos de la tabla 1.1. Haz cinco commits
(usa `git add -p assets/js/universo/escena.js`, que tiene dos cambios distintos):

1. `fix(shaders): estrellas (rand/vSemilla) y planeta (fresnel tapada)` →
   `capas/estrellas.js`, `cuerpos/planeta.js`
2. `feat(calidad): resolucionPlaneta, silueta lisa del planeta` →
   `calidad.js`, `cuerpos/planeta.js`, `escena.js` (solo el trozo de la atmósfera)
3. `feat(apertura): singularidad, explosión diferida y hero que se aparta` →
   `cuerpos/bigbang.js`, `escena.js` (solo `INICIO_EXPLOSION`), `06-universo.css`
4. `feat(planetas): paleta física para hogar y gigante` → `data/universo.js`
5. `chore(tools): verificar-webgl, capturar, medir-contraste; corrige PENDIENTES` →
   `tools/`, `PENDIENTES.md`, `OPENCODE_RUTA.md`

**Hecho cuando:** `git status` limpio y `node tools/verificar-webgl.mjs` dice
«cero errores de consola, todos los shaders compilan».

### Paso 2 — Validar lo que NO se verificó de la apertura

Lo hecho en la portada se comprobó solo a 1440×900, en `alto`, con GPU de
software. Falta:

- **2a.** Captura del **pico de la detonación** (prueba 540, 570, 600 px): ¿hay
  una banda gris cruzando el Sol? (`hero__velo` ya se desvanece; no se confirmó.)
- **2b.** **Respaldo sin `animation-timeline`.** En una copia temporal cambia
  `@supports (animation-timeline: scroll())` por una condición falsa y comprueba
  que el hero conserva el contraste con la cortina del 88 %.
- **2c.** **Móvil y tablet:** 390×844 y 768×1024. El punto, el texto y los chips
  no pueden solaparse mal.
- **2d.** **«Iniciar viaje» (recorrido guiado)** y los enlaces de navegación: la
  explosión empieza más tarde (`INICIO_EXPLOSION`); comprueba que el recorrido
  guiado sigue llegando a cada sección (`irA`) y que sus tiempos no dependían del
  antiguo calendario. *(sin verificar)*
- **2e.** Volver arriba (scroll 0): el hero reaparece sin parpadeo.
- **2f.** `prefers-reduced-motion` y **Vista simple** (`data-universo` distinto de
  `activo`): el hero se ve completo, sin desvanecido ni cortina rota.
- **2g.** `python3 tools/medir-contraste.py ".hero__titulo,.hero__resumen,.hero__chips" 0,60,120`
  → todo ✓.

**Hecho cuando:** cada punto tiene captura abierta o salida de comando, y lo que
falle está corregido en su propio commit.

### Paso 3 — Mundos que se lean como mundos

Hoy el planeta de Perfil se ve gris azulado con manchas (no es claramente la
Tierra) y el anillo del gigante sigue siendo cian y enorme.

- Afina en `data/universo.js` (sistema `inicio`, cuerpo `hogar`): `colorTierra`,
  `nivelMar`, `rugosidad`, `nubes`. Meta: océano azul franco, continentes
  verdes/pardos, nubes blancas, luces de ciudad en la cara nocturna, halo cian
  fino.
- Gigante (sistema `stack`): `anillos.tonoA/tonoB` pasan a ocre/crema
  (`#c9a36a`, `#efe2c4`); revisa su tamaño frente al planeta. Las **lunas
  conservan los colores de marca**: son las tecnologías.
- Compara cada planeta con una foto de referencia (la que quieras, tú la
  buscas) y deja en el commit qué diferencias te quedan.

**Hecho cuando:** captura en `alto` del planeta hogar y del gigante donde
cualquiera diría «la Tierra» y «Saturno» sin leer la etiqueta.

### Paso 4 — Dejar de tapar la escena (el cambio estructural)

La causa de que el universo desaparezca es el diseño de contraste por cortinas.
Hay que pasar de «oscurecer detrás del texto» a **componer**: el cuerpo celeste
ocupa la mitad de la pantalla donde no hay texto.

- **4a. Línea base.** Ejecuta `medir-contraste.py` sobre el texto de cada
  sección (`.perfil__bio p`, `.section-head`, `.stack__nota`, las tarjetas de
  Habilidades, `.pie__marca`) en 4-5 scrolls por sección. Guarda la tabla en el
  commit.
- **4b. Composición (escritorio ≥ 900 px).** En los `fotogramas` de `perfil`,
  `proceso` y `stack` (`data/universo.js`), desplaza `mira`/`pos` para que el
  cuerpo quede en la mitad sin texto. Mira las capturas: en Perfil el texto está
  a la derecha, en Proceso el diagrama a la izquierda.
- **4c. Scrims.** Con el cuerpo fuera del texto, baja los scrims del 84-88 % a
  ≈ 40-50 % (`06-universo.css`) y el velo de sección del 40 % a ≈ 20-25 %. **Mide
  después de cada bajada**; la herramienta decide, no la intuición.
- **4d. Móvil (≤ 768 px)** el texto ocupa todo el ancho: conserva allí un scrim
  más opaco con un `@media`. Que el cuerpo se vea en los huecos entre bloques.
- **4e.** El texto grande ya medido y bien (titular, títulos de sección) no se
  toca.

**Hecho cuando:** `medir-contraste.py` pasa en todas las secciones (≥ 4,5 y ≥ 3)
**y** en cada sección hay al menos un tramo del scroll con un cuerpo celeste
reconocible visible sin tapar. Adjunta las capturas.

### Paso 5 — Tramo «Cosmos»: galaxias y Vía Láctea

Entre el Big Bang y el sistema solar falta el viaje por el cosmos.

- **Antes de escribir nada,** lee `universo/capas/galaxias.js` (ya existe y se
  actualiza con `nacimiento` en `escena.js`) para saber qué dibuja hoy, y
  `ruta.js` para confirmar que **una sección vacía se puede usar como tramo de
  cámara** (busca a los sistemas por `id` de sección y se salta los que no
  existen: está pensado para eso, pero es *(sin verificar)* con una sección sin
  contenido).
- **Sección nueva** en `index.html`, entre `#inicio` y `#perfil`:
  `<section id="cosmos" class="travesia" aria-hidden="true"></section>`, con
  `.travesia { height: 140svh; }` y oculta en Vista simple
  (`:root:not([data-universo='activo']) .travesia { display: none; }`).
  Ejecuta `verificar-a11y.mjs` y `verificar-contenido.mjs`: si se quejan de la
  sección, adapta la comprobación y deja escrito por qué.
- **Sistema nuevo** en `data/universo.js`: `id: 'cosmos'`, `seccion: 'cosmos'`,
  `etiqueta: 'Vía Láctea'`, `cuerpo: null`, con sus `fotogramas`. Renumera los
  `indice` del HUD y decide si la travesía sale como punto en el HUD (si hace
  falta un campo nuevo, léelo en `hud.js`).
- **Capa nueva** `universo/capas/galaxiaEspiral.js`: una galaxia espiral con
  `THREE.Points` y un `ShaderMaterial` aditivo (`depthWrite: false`), una sola
  llamada de dibujo. Receta:
  - 4 brazos logarítmicos: `ang = brazo·π/2 + ln(1 + r/20)·3.2 + dispersión`,
    `r = 8 + t·R` con `t = random^0.6` (más densidad al centro).
  - Disco fino: `y = (rand − 0.5)·R·0.04·(1 − t)`.
  - Color: núcleo cálido `#ffd9a0` → brazos azulados `#8ab4ff` según `t`.
  - Usa el generador con semilla que ya usan las otras capas (búscalo en
    `capas/estrellas.js`), para que sea reproducible.
  - Presupuesto por calidad (campo nuevo en `calidad.js`, no lo mezcles con
    `puntosEstrella`): alto ≈ 9000, medio ≈ 5000, bajo ≈ 2000, off = nada.
- **Cámara:** empieza lejos y por encima del disco, se acerca despacio hacia un
  brazo y termina apuntando a un punto marcado (un destello pequeño: «aquí»), que
  es el Sol hacia el que entrará el siguiente tramo.

**Hecho cuando:** capturas a 4 scrolls del tramo donde se reconozca una espiral
con brazos, `verificar-webgl.mjs` limpio, `probar-ruta.mjs` y
`probar-calidad.mjs` en verde y el presupuesto de la capa declarado en
`ESTUDIO.md §6.2`.

### Paso 6 — El sistema solar, planeta a planeta

Orden real desde el Sol, mapeado a las secciones. El mundo no está a escala (la
cámara viaja unos 3000 unidades en `z`); se compone, no se mide.

| Tramo | Sección | Qué se ve | Estado hoy |
|---|---|---|---|
| Big Bang | `#inicio` | singularidad → estrella → detonación | hecho, validar (paso 2) |
| Cosmos | `#cosmos` | galaxias → Vía Láctea | paso 5 |
| Interior *(opcional)* | `#interior` | Sol, Mercurio y Venus de pasada | no existe |
| **Tierra** | `#perfil` | luces de ciudad, «Desde Bogotá» | existe como `hogar` |
| **Marte y cinturón** | `#proceso` | Marte + cinturón de asteroides; las 5 etapas del proceso | existe como «Campo de escombros» (renombrar) |
| **Saturno** | `#stack` | anillos y 21 lunas (una por tecnología) | existe como gigante gaseoso |
| Exterior *(opcional)* | `#exterior` | Urano y Neptuno de pasada | no existe |
| **Proyectos** | `#proyectos` | un mundo por proyecto (cinturón de Kuiper) | `proyectos` existe inactivo (paso 7) |
| **Contacto** | `#contacto` | la baliza en el borde del sistema | existe como `baliza` |
| Cierre | pie | la cámara sube y se ve la Vía Láctea con un punto «aquí» | existe como «Vista del sistema», ajustar |

**Paleta física de partida** (afínala con capturas; son hex, no tokens):

| Cuerpo | `colorOceano` | `colorTierra` | Notas |
|---|---|---|---|
| Mercurio | `#8c8780` | `#5e5a55` | `rugosidad` alta (≈ 0.85), sin nubes, sin atmósfera |
| Venus | `#e3c58f` | `#b98c4a` | nubes densas, `bandas: false`, atmósfera amarillenta |
| Tierra | `#1d5b9e` | `#4d7c3a` | `colorHielo #f2f6ff`, acento `#6fb7ff` |
| Marte | `#b5502c` | `#7a3a22` | casquetes `#f1e6dc`, sin nubes, atmósfera fina `#d89a78` |
| Saturno | `#c9a36a` | `#8a6a43` | anillos `#efe2c4`/`#c9a36a` |
| Urano | `#9fdcdc` | `#7fbfc4` | casi liso |
| Neptuno | `#2f4fd6` | `#1f3aa0` | bandas suaves |

Reglas del paso:

- **Un cuerpo principal por sistema.** Si necesitas varios planetas en el mismo
  tramo (Urano y Neptuno), primero lee en `ruta.js`/`escena.js` si un sistema
  admite más de un `cuerpo`; *(sin verificar)*. Si no, usa una travesía por
  planeta o añade el soporte con un cambio pequeño y propio.
- Mantén `tono` (acento de interfaz) con los tokens de marca aunque la
  superficie sea física: así el HUD y los acentos del texto no cambian.
- Cada planeta nuevo se hace en **su propio commit**, con su captura en `alto`
  y en `bajo`.
- Etiquetas del HUD reales: «Big Bang», «Vía Láctea», «Tierra», «Marte y el
  cinturón», «Saturno», «Cinturón de Kuiper», «Heliopausa».

**Hecho cuando:** recorrido completo con `capturar.mjs ... todo` en `alto`
donde cada tramo nombra un lugar real y se reconoce, `comprobar.mjs` y
`verificar-webgl.mjs` en verde y 60 fps objetivo sostenido en el perfil `medio`
de una GPU real (la sonda de `calidad.js` lo mide).

### Paso 7 — Proyectos reales

**Necesitas del dueño del portafolio** (pídelo, no lo inventes): para cada
proyecto, nombre, qué problema resolvió, tecnologías, URL en vivo, repo y una
captura.

- Rellena `assets/js/data/proyectos.js` y añade `<section id="proyectos">` a
  `index.html`. El procedimiento está en `UNIVERSO.md §5 «Añadir un proyecto»`.
- El sistema `proyectos` ya existe con `activo: false, autoActivar: true`: se
  enciende cuando hay datos. Cada proyecto es un cuerpo con su semilla y paleta
  propias.
- Cada proyecto debe ser un enlace usable con teclado y con texto alternativo.

**Hecho cuando:** hay al menos un proyecto real, enlaza, se ve su planeta, el
tramo pasa `medir-contraste.py` y `verificar-contenido.mjs`.

### Paso 8 — Pendientes de publicación

- `canonical`: sigue como `https://TU-DOMINIO/` en `index.html`. Pon la URL
  real (la del despliegue de Vercel, o el dominio propio si ya existe).
- Revisa `og:url`, `og:image` y `sitemap`/`robots` si existen.
- `CONTACTO.endpoint` vacío: el formulario no envía nada. Decide el servicio
  (Formspree u otro), configúralo y **prueba un envío real**.
- Revisa que el correo y el teléfono visibles sean los que el dueño quiere
  publicar.

**Hecho cuando:** un mensaje de prueba llega, y `grep -n "TU-DOMINIO" index.html`
no devuelve nada.

### Paso 9 — Rendimiento, móvil y accesibilidad

- Perfiles `alto`, `medio`, `bajo` y `off` (sin 3D): el sitio entero debe
  funcionar en los cuatro. Comprueba también Vista simple.
- Móvil 390×844: sin scroll horizontal, objetivos táctiles ≥ 44 px, la escena
  visible en algún tramo de cada sección.
- Teclado: orden de foco, `:focus-visible` y que las travesías vacías no
  atrapen el foco.
- `prefers-reduced-motion`: sin desvanecidos ni latidos que dependan de él.
- Lighthouse en móvil: anota rendimiento, accesibilidad y SEO con fecha.

**Hecho cuando:** capturas a 390, 768 y 1440 en `bajo` y `alto`, y los
resultados anotados.

### Paso 10 — Documentación honesta

- `ESTUDIO.md §6.2`: actualiza la tabla con `resolucionPlaneta` (hoy dice 500
  triángulos para el planeta) y con el presupuesto de la galaxia.
- Sustituye en `PENDIENTES.md` y `UNIVERSO.md` toda frase de «cero errores»,
  «en verde» o «verificado» por la fecha y el comando que la respalda.
- Considera fusionar `ESTUDIO.md`, `UNIVERSO.md` y `PENDIENTES.md` (≈ 130 KB) en
  algo que alguien pueda leer en media hora. No borres decisiones razonadas;
  resúmelas.

**Hecho cuando:** un lector nuevo puede arrancar el proyecto, correr las
comprobaciones y entender el viaje solo con el README y `UNIVERSO.md`.

---

## 5. Criterio de aceptación global

El trabajo está terminado cuando, **en la misma sesión**:

1. `node tools/comprobar.mjs` y `node tools/verificar-webgl.mjs` salen en verde.
2. `node tools/capturar.mjs final alto todo` produce un recorrido en el que se
   ven, por orden: Big Bang, galaxias, Vía Láctea, Tierra, Marte con su
   cinturón, Saturno, proyectos, la baliza y el cierre, cada uno reconocible.
3. Todo texto sobre la escena pasa `medir-contraste.py`.
4. Hay proyectos reales, `canonical` real y un formulario que envía.
5. Funciona en `bajo` y en `off`, en móvil y con teclado.
6. Cada afirmación de los `.md` tiene detrás un comando y una fecha.

## 6. Lo que NO hay que hacer

- No metas frameworks, bundlers ni librerías nuevas.
- No subas la calidad de todo a la vez: el presupuesto de triángulos y de
  fragment shader está medido (`ESTUDIO.md §6`).
- No reemplaces los scrims por más scrims. Si el texto no se lee, mueve el
  cuerpo o mueve el texto.
- No marques un paso como hecho porque el script termina sin error. Abre la
  imagen.
