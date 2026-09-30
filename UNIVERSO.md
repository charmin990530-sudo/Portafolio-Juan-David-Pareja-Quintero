# UNIVERSO.md

Manual del portafolio. Qué es, dónde se toca cada cosa y cómo se cambia sin
romper nada.

- **¿Qué es este proyecto?** → [El concepto](#1-el-concepto)
- **Quiero cambiar un texto** → [Textos](#2-textos)
- **Quiero cambiar un color** → [Color](#3-color)
- **Quiero cambiar la velocidad o la duración** → [Ritmo](#4-ritmo)
- **Quiero añadir un proyecto** → [Añadir un proyecto](#5-añadir-un-proyecto)
- **Quiero poner mis propias imágenes o modelos** → [Assets propios](#6-assets-propios)
- **Quiero que vaya más rápido o más lento** → [Calidad](#7-calidad)
- **Quiero quitar la animación** → [Desactivar](#8-desactivar-la-animación)
- **No funciona** → [Problemas](#9-problemas)
- **¿De dónde salió todo esto?** → [`ESTUDIO.md`](./ESTUDIO.md)

---

## 1. El concepto

**ODISEA.** Un vuelo de reconocimiento por un sistema. Cada sección de tu
portafolio es un cuerpo celeste y el scroll es el movimiento de la cámara.

No es una metáfora puesta encima: el sitio ya hablaba este idioma antes de que
existiera el universo. Tu preloader decía *"iniciando motor"*, el HUD decía
`ESTADO / DISPONIBLE` y `UBICACIÓN / BOGOTÁ, CO · UTC−5`, el pie decía **"Fin de
la transmisión"** y el formulario decía **"Transmitiendo…"**. El trabajo fue
terminar de contar esa historia, no inventarla.

| Sección | Cuerpo | Por qué |
|---|---|---|
| Portada | Aproximación a un punto que crece | El arranque no es un despegue: es un acercamiento, que es más cine y menos tópico |
| Perfil | Planeta hogar, en cuarto creciente | "De dónde vengo" → un mundo con habitantes. Tus luces de ciudad están ahí |
| Proceso | Campo de escombros con 5 balizas | "Cinco etapas, siempre en este orden" → un orden visible en el espacio |
| Habilidades | Gigante gaseoso con anillos; 21 lunas en órbita | El radio de cada luna es tu nivel real. El árbol de habilidades se ve en la forma |
| Proyectos | Un planeta por proyecto | Un cúmulo de estrellas ilegible no dice nada. Un planeta por proyecto sí |
| Contacto | Baliza que se enciende al llegar | `DISPONIBLE / 24 h` en el HUD y la lámpara en lima dicen lo mismo porque son lo mismo |
| Pie | La cámara sube y lo veo todo a la vez | Un travelling de vuelta, no un corte |

**El easter egg.** Las 21 `nota` de `assets/js/data/stack.js` hasta ahora solo
existían como `title` del navegador: un tooltip que nadie ve. Las lunas son la
única forma de leerlas. No es un truco de adorno, es contenido tuyo que hoy
estaba oculto y que solo se descubriría explorando.

---

## 2. Textos

**El texto está en el HTML.** No hay que tocar nada de 3D para cambiarlo.

| Qué | Dónde |
|---|---|
| Título, sección de contacto, pie, navegación | `index.html` |
| Las 21 habilidades y sus notas | `assets/js/data/stack.js` |
| Las 5 etapas del proceso | `assets/js/data/proceso.js` |
| Tus proyectos | `assets/js/data/proyectos.js` |
| Etiquetas de los sistemas del HUD ("Planeta hogar", "Baliza"…) | `assets/js/data/universo.js`, campo `etiqueta` |
| Texto de carga del preloader | `index.html`, dentro de `#preloader` |

Si añades un texto largo, comprueba que cabe en su panel. Los paneles están
pensados para 2-3 frases, no para párrafos: un texto largo sobre un planeta
contrasta mal y se lee mal.

---

## 3. Color

**La paleta vive en un solo sitio: `assets/css/01-tokens.css`.**

```css
--cyan:    #4fe3ff   /* acento principal    */
--violet:  #a06bff   /* segundo acento      */
--solar:   #ffb454   /* tercer acento       */
--lime:    #7ef2a8   /* disponibilidad      */
--rose:    #ff6ba8   /* proyectos           */
--ink-100: #f2f6ff   /* texto principal     */
```

Cambiar `--cyan` ahí cambia **a la vez** los botones, los enlaces, el HUD, las
estrellas, la nebulosa, el polvo, el resplandor de los planetas y las luces del
gigante. Los shaders leen los tokens por `getComputedStyle` en
`universo/colores.js`, y la configuración de `universo.js` los referencia por
nombre (`tono: 'cian'`) en vez de escribir el hexadecimal.

**Por qué importa:** si en `data/universo.js` escribieras `#4fe3ff`, tendrías el
mismo color en dos sitios. El primero que cambiaras dejaría el otro obsoleto.

### Asignación de tonos a cuerpos

Está en el campo `tono` de cada sistema en `data/universo.js`. Si quieres que
el gigante sea lima en vez de violeta, cambias `"tono": "violeta"` por
`"tono": "lima"`. El HUD leerá el color del sistema automáticamente.

---

## 4. Ritmo

Todo el control temporal está en `data/universo.js` y en `CAMARA`.

### Velocidad de la cámara

```js
export const CAMARA = {
  amortiguacion: 3.2,   // <-- ESTE es el número que más se nota
  // ...
};
```

| Valor | Sensación |
|---|---|
| 1,5 | Cámara eléctrica, sin peso. Todo pasa demasiado rápido |
| **3,2** | **El valor actual. Tiene peso y se siente física** |
| 6 | Nadar. Se nota la inercia, se hace esperar |
| 12 | Barro. El visitante percibe que la página no responde |

### Cuánto ocupa cada sección

**El tiempo que la cámara pasa en un sistema es exactamente la altura de su
`<section>`.** No hay ningún campo `peso` ni similar: la cámara va donde está
el texto, y donde hay mucho texto hay mucho recorrido.

Es el control más intuitivo que existe, y además es el único que no se
desincroniza: si escribes dos párrafos más en Habilidades, la cámara se queda
dos párrafos más allí, sin tocar ninguna configuración.

Para darle más recorrido a una sección sin escribir más texto, añade un
espaciador al final. En `05-sections.css`:

```css
/* El retroceso final necesita recorrido para no ir a toda velocidad. */
.pie {
  min-height: 150svh;
}
```

Se puso uno en el proyecto precisamente por eso: el plano que cierra la obra
es el más largo de la película, y 800 px de scroll no bastaban para una toma
de 1 000 unidades de recorrido.

### Velocidad de la estela de estrellas

```js
velocidadMax: 0.055,   // en CAMARA
```

Más alto = las estrellas se estiran antes y más. Si te parece que el cielo se
vuelve rayas, bájalo. Si no notas las estelas, súbelo.

### Cuándo se enciende cada cuerpo

El campo `t` de cada fotograma dice en qué momento de su sección ocurre:

```js
fotogramas: [
  { t: 0,    pos: [...], mira: [...], fov: 52 },  // al entrar
  { t: 0.62, pos: [...], mira: [...], fov: 47 },  // en el punto medio
  { t: 1,    pos: [...], mira: [...], fov: 47 },  // al salir
],
```

- `pos` — dónde está la cámara, en coordenadas del mundo.
- `mira` — qué está mirando.
- `fov` — apertura en grados. Subirlo da sensación de velocidad y profundidad.
- `roll` — inclinación en radianes. Muy sutil; con `0.05` ya se nota.

Puedes añadir todos los fotogramas que quieras entre `t: 0` y `t: 1`. La curva
los recorre suavemente; no hace falta que el espaciado sea regular.

### Duración del scroll (Lenis)

En `assets/js/core/desplazar.js`, dentro de `montarScrollSuave()`:

```js
new Lenis({
  duration: 1.05,   // segundos que tarda en llegar
  easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
});
```

Más `duration` = más inercia. Ojo: el suavizado **solo se activa en escritorio**
(ancho ≥ 900 px y puntero fino). En móvil va scroll nativo, a propósito.

---

## 5. Añadir un proyecto

Tres pasos. No hay que tocar ni el HTML ni el JavaScript del universo.

**1. Añade el proyecto** en `assets/js/data/proyectos.js`:

```js
export const PROYECTOS = [
  {
    titulo: 'Nombre del proyecto',
    resumen: 'Una frase que se lea de un vistazo.',
    descripcion: 'Qué es, qué resuelve y qué tiene de interesante. Dos o tres frases.',
    tecnologias: ['Angular', 'Node.js', 'MongoDB'],
    enlaces: [
      { texto: 'Ver el sitio', url: 'https://ejemplo.com' },
      { texto: 'Código', url: 'https://github.com/tu-usuario' },
    ],
    imagen: 'assets/img/proyectos/mi-proyecto.jpg',  // opcional
    ancla: 'rosa',        // tono del planeta: cian, violeta, solar, lima, rosa
    sitio: false,         // true si tiene web pública
  },
];
```

**2. Si quieres su captura**, ponla en `assets/img/proyectos/`. Formato WebP o
AVIF, 1200 px de ancho, calidad 75-80. Debajo de 120 KB.

**3. Guardar y recargar.** Eso es todo.

Qué pasa automáticamente:

- Se crea la sección `#proyectos` antes de Contacto, con su encabezado y su
  rejilla.
- Se enciende el sistema "cúmulo" del universo, y cada proyecto recibe un
  planeta.
- Aparece su punto en el HUD y su entrada en la barra de progreso.
- El término se incluye en el `sitemaps`.

**Si borras todos los proyectos**, la sección desaparece sola. No queda un hueco
vacío en la página ni un `<section>` sin contenido.

### Campos que importan

| Campo | Obligatorio | Notas |
|---|---|---|
| `titulo` | Sí | Sin él, el proyecto no se cuenta |
| `ancla` | No | El color de su planeta y de su tarjeta. Sin él, rosa |
| `imagen` | No | Sin ella sale un marcador con el color del proyecto |
| `enlaces[].url` | No | Los externos se abren en pestaña nueva con `rel="noopener noreferrer"` |
| `sitio` | No | Déjalo en `false` salvo que la URL sea pública |

---

## 6. Assets propios

### Poner una imagen de textura en un planeta

Ahora mismo **no hay ni una sola textura en el proyecto**: todas las superficies
se calculan en el shader. Si quieres una textura propia:

1. Ponla en `assets/img/texturas/`, WebP o AVIF, 1024×1024 como mucho. Entre
   80 y 150 KB.
2. En `assets/js/universo/cuerpos/planeta.js`, añade un uniform `uMapa` y una
   rama en el fragment shader que mezcle la textura sobre `base`. El shader ya
   tiene `vUv` disponible si lo pasas desde el vertex shader.
3. Comprueba el peso antes y después. Una textura de 1024×1024 RGBA sin comprimir
   son 4 MB en VRAM; con KTX2/Basis son 1 MB. Ese es el motivo por el que el
   proyecto no usa texturas: el presupuesto de 40 MB de VRAM no aguanta muchas.

Si decides que un proyecto sí merece una textura, **solo ese**, y baja el resto.

### Poner un modelo 3D

1. Exporta en glTF 2.0 con Draco comprimido. Sin texturas, o con una de 1024
   en KTX2.
2. Ponlo en `assets/models/`.
3. En `universo/cuerpos/`, crea un módulo con la forma de `planeta.js` (devuelve
   `{ grupo, actualizar, liberar }`) y asígnale un `tipo: 'modelo'` en
   `data/universo.js`.
4. **Presupuesto:** un modelo por debajo de 30 000 triángulos y 200 KB. Con
   más, baja el nivel de calidad en `calidad.js` para ese cuerpo.

Antes de añadir un modelo, pregúntate si un planeta procedural no basta. Casi
siempre basta, pesa 0 KB y no hay que mantener nada.

### Reactivar el tema claro

El sitio ya no lo tiene: un universo nocturno no tiene versión de día. Si lo
quieres de vuelta:

1. Recupera el bloque `:root[data-tema='claro']` de `01-tokens.css` del
   historial de git (`git show main:assets/css/01-tokens.css`).
2. Vuelve a añadir `montarTema` desde `assets/js/modules/tema.js` en el `main`.
3. En `universo/colores.js`, reañade el `alCambiarTema()` que llama a
   `leerPaleta()` con un `MutationObserver` sobre `data-tema`, y vuelve a
   llamarlo desde `escena.js`.
4. Añade las reglas `.malla, .fondo` que se apagan con el universo, con su
   variante para el tema claro.

Aviso: el tema claro obliga a cambiar la paleta de la nebulosa y del resplandor
o el texto se vuelve ilegible sobre el planeta. Es un trabajo de medio día, no un
cambio de veinte minutos.

---

## 7. Calidad

### Cambiar el nivel a mano

Fuerza un nivel con el atributo en el `<html>`, desde la consola:

```js
document.documentElement.dataset.calidad = 'alto';   // 'alto' | 'medio' | 'bajo'
```

Los perfiles están en `assets/js/universo/calidad.js`, tabla `PERFILES`. Cada
número de ahí es un presupuesto:

| Clave | Qué controla |
|---|---|
| `detallePlaneta` | Triángulos de la esfera: 4 → 2 562, 3 → 642, 2 → 162 |
| `puntosEstrella` | Estrellas del campo |
| `puntosPolvo` | Partículas de polvo cercano |
| `rocasCampo` | Escombros del tramo de Proceso |
| `atmosfera` | 2 = fresnel + dispersión, 1 = solo fresnel, 0 = sin cáscara |
| `anillos` | Número de capas del anillo |
| `nubes` / `lucesCiudad` | Capas opcionales del planeta |
| `estelas` | Alargado de las estrellas al acelerar |
| `resplandor` | Sprites aditivos (el sustituto del bloom) |
| `dpr` | Límite de densidad de píxeles |
| `objetivoFps` | Umbral que dispara la degradación automática |

### Forzar un nivel concreto siempre

En `calidad.js`, al final de `detectarNivel()`:

```js
return NIVELES.ALTO;   // ignora la detección
```

Útil para probar en tu móvil el nivel que verá un usuario de gama alta.

### Más FPS en un móvil lento

Por orden de impacto:

1. **`dpr` a 1.25 o 1.0.** Es el cambio con más efecto: afecta al relleno de
   píxeles, que es lo que agota una GPU móvil.
2. **`puntosEstrella` a 800.** Cuatro mil puntos con mezcla aditiva son
   RUPTURA en gama baja.
3. **`detallePlaneta` a 2.** 162 triángulos se ven perfectamente a la
   distancia a la que está un planeta.
4. **`resplandor: false`.** Los sprites aditivos cubren mucha pantalla.

### Cambiar el degradado automático

La sonda mide 90 fotogramas e ignora los 12 primeros (son de calentamiento). Si
el resultado queda por debajo de `objetivoFps`, baja **un** nivel y para. Nunca
sube, y nunca baja dos veces: un salto de calidad a media escena es un tirón
visible, y si bajar una vez no basta es que la máquina no puede y lo correcto es
el fallback.

---

## 8. Desactivar la animación

### Para un visitante concreto

Botón **"Vista simple"**, en la esquina inferior derecha del HUD. Borra el
universo, quita el lienzo y deja el sitio con el campo de partículas en 2D. La
elección se guarda y sobrevive a la recarga.

Para volver atrás, desde la consola:

```js
localStorage.removeItem('odisea:simple');
location.reload();
```

### Para todo el sitio, siempre

En `assets/js/main.js`, quita esta línea:

```js
import { montarUniverso } from './universo/index.js';   // dentro de montarUniverso()
```

Y en `index.html`, quita el `<canvas id="universo-lienzo">` y el `<link>` a
`06-universo.css`. El sitio funciona sin los dos. También puedes añadir
`prefers-reduced-motion` a la lista de simulación en las DevTools para ver cómo
queda la versión sin movimiento.

### Desactivar solo el sonido

Botón de altavoz en el HUD. Arranca **siempre** silenciado y la elección se
guarda en `odisea:sonido`. El `AudioContext` no se crea hasta el primer clic,
porque los navegadores lo bloquean sin un gesto previo y crearlo antes consume
batería.

### Desactivar solo el desplazamiento suave

En `core/desplazar.js`, `montarScrollSuave()` ya devuelve `{ activo: false }` en
móvil, con movimiento reducido y por debajo de 900 px de ancho. Para
desactivarlo en escritorio, quita el `montarScrollSuave` de la lista de montajes
de `main.js`. El sitio vuelve al scroll nativo sin tocar nada más.

---

## 9. Problemas

### "No se ve nada" / la página está en negro

1. ¿Hay errores en la consola? Busca `[universo]`.
2. Comprueba `document.documentElement.dataset.universo`. Debería ser `activo`.
3. Si es `inactivo`, mira el motivo: `sin-webgl`, `movimiento`, `simple`.
4. Prueba `document.documentElement.dataset.calidad = 'bajo'` por si es un
   problema de rendimiento.

### El texto se ve mal sobre el planeta

Los paneles de texto llevan un velo. Si aun así falla, el problema es que el
cuerpo está demasiado cerca o demasiado brillante. Baja `escalaHalo` de ese
cuerpo en `data/universo.js`, o sube la distancia de la cámara en sus
fotogramas.

### El canvas tapa los clics

No debería: el lienzo tiene `pointer-events: none`. Si ves que pasa, comprueba
que no hay un `z-index` nuevo por encima de `--z-content` (= 10) en
`01-tokens.css`.

### El formulario no llega los mensajes

**Falta pegar el endpoint.** Está vacío a propósito en
`data/universo.js`, campo `CONTACTO.endpoint`. Mientras esté vacío el formulario
funciona por el camino del correo (abre el cliente de correo del visitante con
el mensaje escrito) y no pierde nada, pero no entrega de forma automática.

Para configurarlo: crea un formulario en [formspree.io](https://formspree.io)
con `charmin990530@gmail.com` como destinatario, y pega el endpoint que te den
así:

```js
export const CONTACTO = {
  endpoint: 'https://formspree.io/f/abcdwxyz',
  destinatario: 'charmin990530@gmail.com',
};
```

### "Las 21 lunas no se ven"

Probablemente estás en el nivel `bajo` y estás lejos del gigante. En el nivel
`bajo` la cámara pasa más lejos para no llenar la pantalla de píxeles. Sube el
nivel con `data-calidad` y mira si aparecen.

### La cámara no llega a un cuerpo

Casi siempre es que la sección no existe en el HTML. `ruta.js` salta los
fotogramas cuya `seccion` no se encuentra. Comprueba que el `id` del campo
`seccion` en `data/universo.js` coincide con el `id` del `<section>`.

### Al recargar a media página se ve un salto

`cabecera.js` pone `history.scrollRestoration = 'manual'`, así que una recarga
siempre empieza arriba. Si prefieres que respete la posición, quita esa línea.
Pero entonces la cámara arranca en medio del recorrido con progreso 0 y hay un
salto visible de varios cientos de unidades.

## 10. Dos cosas que dependen del dominio de producción

Hay dos archivos que **no** se pueden escribir bien sin saber la URL final.
Se dejaron prepared y se documentan aquí en vez de inventarse.

### URL canónica

En `index.html` hay:

```html
<link rel="canonical" href="./" />
```

Una canónica **relativa** es válida: los buscadores la resuelven contra la URL
actual y funciona en cualquier dominio. En cuanto tengas el definitivo:

```html
<link rel="canonical" href="https://TU-DOMINIO/" />
<meta property="og:url" content="https://TU-DOMINIO/" />
```

Y actualiza el campo `url` del JSON-LD, que ahora no está para no apuntar a
ningún sitio.

### Sitemap

**No hay sitemap, y es deliberado.** El esquema de `sitemaps.org` exige URL
absolutas en `<loc>`, y un `./` se rechaza con un error. Preferimos no tener
sitemap a tener uno que no vale. Cuando tengas el dominio:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://TU-DOMINIO/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

Guárdalo como `sitemap.xml` en la raíz y añade esto a `robots.txt`:

```
Sitemap: https://TU-DOMINIO/sitemap.xml
```

Para un sitio de una sola página, un sitemap aporta poco. Se incluye solo si
algún día hay varias rutas.

---

## 11. Estructura

```
index.html                        Todo el contenido. Es el archivo que se edita.
vercel.json                       Cabeceras de caché y de seguridad.
ESTUDIO.md                        Referencias, matriz y decisiones técnicas.

assets/
  css/
    00-fonts.css                  Las tres familias
    01-tokens.css            ★    LA PALETA. Se cambia aquí.
    02-base.css                   Reset, tipografía raíz, utilidades
    03-components.css             Botones, campos, chips, avisos
    04-animations.css             Keyframes
    05-sections.css               Cabecera, portada, perfil, proceso, contacto
    06-universo.css               Lienzo, HUD, velo de texto, tarjetas
  js/
    core/
      loop.js                     El único requestAnimationFrame del sitio
      util.js                     clamp, lerp, suavizar,almacen, prefers-reduced-motion
      dom.js                      $, $$, crear, delegar
      desplazar.js            ★    El único sitio del que sale un scroll
    data/
      stack.js               ★    Las 21 habilidades y sus notas
      proceso.js             ★    Las 5 etapas
      proyectos.js           ★    TUS PROYECTOS
      universo.js            ★★   LA CONFIGURACIÓN DEL VIAJE
    modules/
      preloader.js                Progreso de carga real con techo de seguridad
      cabecera.js                 Cabecera, menú, barra de progreso
      fondo.js                    Campo de partículas 2D (fallback)
      cursor.js                   Cursor personalizado
      revelar.js                  Aparición al entrar en pantalla
      hero.js                     Portada
      contenido.js                Marquee y habilidades
      contadores.js               Números que cuentan
      proceso.js                  Scrollytelling de las 5 etapas
      contacto.js            ★    Formulario con envío real y respaldo
      proyectos.js                Monta la sección de proyectos
    universo/
      index.js               ★    La puerta de entrada. Decide qué se monta
      calidad.js            ★    Detección de GPU y tres perfiles
      escena.js                   Ensambla y mueve todo
      camara.js                   Amortiguación, velocidad, FOV
      ruta.js               ★    Scroll → punto de la curva
      colores.js                  Lee la paleta de los tokens CSS
      audio.js                    Sonido sintetizado, sin archivos
      hud.js                      Indicador de sistema, puntos, botones
      capas/                      estrellas · nebulosa · polvo
      cuerpos/                    planeta · atmosfera · anillos · lunas
                                 campo · baliza
      shaders/comunes.js          Ruido, fbm y fresnel compartidos
  vendor/
    three/0.186.1/                Three.js (MIT)
    lenis/1.3.26/                 Lenis (MIT)

tools/
  verificar-texto.mjs              Caracteres ajenos, rutas, sintaxis, console.log
  verificar-grafo.mjs              Grafo de imports desde main.js
  verificar-contenido.mjs          Nada perdido respecto a la versión anterior
  verificar-a11y.mjs               Encabezados, nombres, contraste, SEO
  probar-calidad.mjs               14 casos del sistema de calidad
  probar-ruta.mjs                  7 grupos sobre la ruta y la cámara
  generar-og.py                    Regenera la tarjeta social
```

★ = los archivos que vas a editar
★★ = el que más, y el primero que debes mirar

---

## 12. Antes de publicar

```bash
node tools/comprobar.mjs            # pasa las siete comprobaciones
python3 tools/generar-og.py         # solo si cambiaste la imagen social
```

`comprobar.mjs` sale con código 1 si algo falla, así que vale como puerta en un
`pre-commit` o en la integración continua. Para correrlas por separado:

```bash
node tools/verificar-texto.mjs      # caracteres ajenos, rutas, sintaxis, console.log
node tools/verificar-grafo.mjs      # el grafo de imports entero desde main.js
node tools/verificar-contenido.mjs  # nada perdido respecto a la versión anterior
node tools/verificar-a11y.mjs       # encabezados, nombres, contraste, SEO
node tools/verificar-exports.mjs    # exports que nadie llama
node tools/probar-calidad.mjs       # 14 casos del sistema de calidad
node tools/probar-ruta.mjs          # 7 grupos sobre la ruta y la cámara
```

El de exports avisa, no falla: hay nueve exports sin uso que ya estaban antes
de este trabajo y que están en su línea base. Los nuevos sí los falla.

**Lo que estas herramientas NO comprueban, y hay que mirar en el navegador:**
el orden real de tabulación, si el foco se ve sobre el planeta, si un panel se
lee bien con la escena detrás, el framerate real en un móvil y el aspecto en
un portátil con GPU integrada. Lo estático no llega hasta ahí.

Y a mano, en el navegador:

1. Recarga con la consola abierta: cero errores.
2. Desplázate de arriba abajo, despacio y rápido. Después sube. Sin saltos.
3. Recarga a media página.
4. Redimensiona a 360, 768, 1024, 1440 y 1920.
5. Activa `prefers-reduced-motion: reduce` en las DevTools.
6. Desactiva WebGL en las DevTools y comprueba que el sitio sigue entero.
7. Navega solo con el teclado: `Tab`, `Enter`, `Escape`. El foco se ve siempre.
8. Manda un mensaje de prueba desde el formulario.
9. Pégalo en un chat de WhatsApp a un móvil y mira la tarjeta.

Si algo falla, casi siempre es una de dos cosas: un `id` de sección que no
coincide con el HTML, o el endpoint del formulario sin pegar.
