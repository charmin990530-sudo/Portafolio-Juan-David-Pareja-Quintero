# PENDIENTES

Estado al cerrar la sesión del 1 de octubre. Esto es para empezar mañana, no
para releer el historial: lo importante está al principio.

---

## 1. EL BUG ABIERTO: LA COSTURA DEL SOL

**Dónde:** portada, alrededor del 15 % de la sección de apertura. Es decir, ya
pasada la detonación, con el sol encendido y ya formado.

**Qué se ve** (captura `bigbang-15.png`, escritorio 1440×900): el sol tiene una
línea horizontal recta a media altura. Encima, apagado; debajo, blanco y
naranja.

**Medido**, muestreando la columna central del sol de arriba abajo:

```
y=423  rgb( 77, 77, 79)  lum= 77     <- apagado
y=441  rgb( 43, 43, 46)  lum= 43     <- más apagado todavía
y=459  rgb( 42, 42, 48)  lum= 42
y=468  rgb(202,197,192)  lum=198     <- salto de 156 en 9 píxeles
```

Un salto de 42 a 198 en nueve píxeles. No es un degradado: es un corte.

### Lo que YA se descartó

- **Que lo oscurezca el velo o la viñeta.** Todas las capas de `bigbang.js`
  usan `AdditiveBlending`, y con mezcla aditiva nada puede oscurecer a otra
  capa. Descartado.
- **El shader del sol.** `assets/js/universo/cuerpos/bigbang.js`, el bloque
  `mu = clamp(dot(n, vision), 0, 1)`. Es `FrontSide`, la normal mira a cámara
  y no hay ningún término con signo que se invista en el ecuador. Descartado
  por lectura.
- **La corona.** Usa `abs(dot(...))` a propósito, con el comentario explicando
  que sin el absoluto el halo se invertiría. Es correcta.
- **`recalibrar` acumulando estado.** Se comprobó y **sí es idempotente**:
  tres calibraciones seguidas dan el mismo resultado que una, y restaurar tras
  duplicar alturas devuelve exactamente la misma ruta (diferencia 0.000000).
  Durante un rato parecía haber un bug aquí que no existía. **No tocar
  `ruta.js` por esto.**

### Pistas por donde seguir

1. **Escribe un puente de depuración temporal.** Antes lo hubo
   (`window.__odisea`) y se quitó. Vuelve a exponerlo solo mientras Depuras:
   la escena, la lista de hijos visibles y, para cada objeto, su
   `position` proyectada a pantalla y su radio. Con eso se responde
   directamente "¿qué objeto está delante del sol en ese píxel?" en vez de
   deducirlo. **Quítalo antes de terminar.**
2. Sospecha de una malla whose `position` or `scale` is interpolated with a
   discontinuity around that `t`: the seam is dead straight and perfectly
   horizontal, which smells of a clip plane, of a `discard` threshold, or of a
   body whose position is computed with a `mix` that inverts sign — not of
   noise.
3. `if (alfa < 0.004) discard;` y `if (alfa < 0.01) discard;` create a HARD
   edge exactly where the threshold is crossed. Check whether any layer's
   alpha ramps through those values at that height. The corona's
   `halo = pow(centro, 2.4)` reaches the threshold along a circle, not a
   line — but the **`materia`** points and the `onda` are the ones to check.
4. Only if 1–3 fail: render the opening frame by frame from 10% to 20% and
   find the first frame where the seam appears. That tells you whether it is
   born or merely becomes visible.

### Cómo reproducirlo rápido

`/tmp/opencode/ver.mjs` ya fuerza calidad `alto` y hace capturas. Con eso se
ve. El recorrido completo está en el propio archivo.

---

## 2. Lo demás que falta mirar

Nada de esto está roto; es que **nunca se ha mirado**. Solo se ha mirado la
portada y Perfil, en escritorio y en móvil, a calidad `alta`.

| Qué falta | Por qué importa |
|---|---|
| Calidad **media** | Es el nivel que verás en un portátil sin GPU decente. Solo se ha visto `alto` y `bajo`. |
| `prefers-reduced-motion` | Hay camino de código y comprobación en jsdom, pero nunca se ha visto en pantalla. |
| Respaldo **sin WebGL** | Probado en jsdom, nunca mirado. Es lo que verá quien no pueda. |
| **Presupuesto de 60 fps** | Chromium headless va con SwiftShader: los 16 fps que miden no significan nada. Falta medir en una máquina con GPU de verdad. |
| Envío del **formulario** | El endpoint sigue vacío a propósito y documentado. Falta una prueba de extremo a extremo. |

---

## 3. Cómo verificar

Las nueve comprobaciones, incluida la novena de arranque en DOM:

```bash
cd /home/juandagamer/Escritorio/Portafolio-20260903T192922Z-1-001/Portafolio
ln -sfn /tmp/opencode/node_modules node_modules
node tools/comprobar.mjs
rm -f node_modules
```

`jsdom` es una dependencia **solo de desarrollo**. Sin ella, `probar-dom.mjs`
se salta con `OMITIDA: falta jsdom` y el resto sigue pasando.

**Aviso esperado, no es fallo:** nueve exports sin uso, preexistentes
(`delegar`, `svg`, `elementoVisible`, `enRango`, `detenerLoop`, `easeOutCubic`,
`elegir`, `alCambiarMovimiento`, `TOTAL_HABILIDADES`).

### Mirar la pantalla

Todas las capturas de Chromium headless usan render por software, así que la
sonda marca `calidad: bajo` y **el sitio se ve distinto de como lo verás tú**.
Para ver el aspecto real hay que forzarla:

```js
localStorage.setItem('odisea:calidad', JSON.stringify('alto'))
```

El script `/tmp/opencode/final.mjs` mide el **contraste compuesto de verdad**:
captura la pantalla, oculta el texto, y muestrea el mismo píxel. **No se puede
leer el lienzo WebGL con `drawImage`** —el búfer de dibujo se vacía al
componer y sale negro—, así que una medición hecha así mide el texto contra
negro y no dice nada. Hay que capturar.

### Comprobar el contraste tras cualquier cambio de velo

Fue el defecto más caro de esta sesión y **no lo cazó ninguna comprobación**.
El velo de sección bajó del 62 % al 42 % para enseñar el cielo, y el texto en
móvil bajó a 1,07:1: invisible. La corrección fue mover el scrim del bloque
de texto, no de la sección. Si vuelves a tocar los velos, vuelve a medir.

---

## 4. Reglas del proyecto que importan

- **Sin framework, sin build, sin `package.json`.** HTML, CSS y módulos ES.
  `three@0.186.1` y `lenis@1.3.26` están vendorizados en `assets/vendor/`.
- **El Big Bang se queda.** Es la diferencia del sitio. Petición explícita.
- **Una sola autoridad sobre el scroll**: `assets/js/core/desplazar.js`. Ni Lenis
  ni nada más a tocar `scrollTop`.
- **Sin números mágicos sin nombre.** `data/universo.js` para el guion,
  `core/util.js` para las reglas. La regla de encuadre en vertical vive en
  `core/util.js` y **no** en `camara.js`, para que se pueda probar en node.
- **Las reglas se prueban.** Lo que se midió una vez y se escribió como aserción
  no vuelve a colarse. Lo que solo está en un comentario, sí.

---

## 5. Estado del repositorio

**Nada está confirmado.** No se ha hecho ningún `commit` en toda la sesión.

Ojo al hacer `git diff`: hay archivos modificados que **ya estaban antes** de
esta tanda de trabajo, ajenos a lo que se hizo aquí. No los reviertas sin
mirar.

Archivos nuevos sin seguimiento:

```
assets/css/07-interfaz.css
assets/js/core/calidad.js
assets/js/modules/aviso.js
assets/js/modules/calidadVisual.js
assets/js/modules/viaje.js
assets/js/universo/capas/galaxias.js
assets/js/universo/cuerpos/bigbang.js
tools/probar-dom.mjs
tools/verificar-shaders.mjs
```

Documentación: `UNIVERSO.md` es el manual del universo, `ESTUDIO.md` explica
**por qué** está hecho así, con los defectos medidos y por qué se corrigieron.
La sección 12 de `ESTUDIO.md` trata precisamente de que todas las
comprobaciones pasaban mientras la página era un fondo negro.

---

## 6. Por dónde empezaría

1. Puente de depuración → identificar el objeto que produce la costura.
2. Una vez identificado, **escribir la comprobación que lo habría cazado**
   antes de arreglarlo. Es el orden que ha funcionado todo este tiempo.
3. Solo después, el resto de la tabla del punto 2.