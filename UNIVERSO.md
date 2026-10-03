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
- **Quiero cambiar el sol de la portada** → [La apertura](#9-la-apertura-el-sol-que-estalla)
- **Quiero cambiar el recorrido guiado** → [El recorrido](#10-el-recorrido-guiado)
- **No funciona** → [Problemas](#11-problemas)
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
| Portada | Un sol que estalla | La estrella ocupa el encuadre, detona y de ella sale el mundo de Perfil |
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

**El tiempo que la cámara pasa en un sistema es, por defecto, la altura de su
`<section>`.** No hay ningún campo `peso` ni similar: la cámara va donde está
el texto, y donde hay mucho texto hay mucho recorrido.

Es el control más intuitivo que existe, y además es el único que no se
desincroniza: si escribes dos párrafos más en Habilidades, la cámara se queda
dos párrafos más allí, sin tocar ninguna configuración.

### El reparto de velocidad, y cuándo te salta el aviso

Hay una segunda regla, y es la que evita que un cambio de cuerpo se convierta
en un tirón.

**La distancia que la cámara recorre tiene que caber en el scroll que le toca.**
Un tramo va a `distancia / scroll` unidades de mundo por píxel, y si ese
número se dispara, el ojo lo lee como un salto y no como una cámara. Así que
`universo/ruta.js` reparte el scroll al final de cada calibración: le da a
cada tramo el ancho que su distancia necesita para no pasar de
`VELOCIDAD_OBJETIVO = 1.2` unidades por píxel, y le cobra ese ancho al resto
en proporción a lo que cada uno tenía de sobra.

| | Sin reparto | Con reparto |
|---|---|---|
| Tramo más rápido del viaje | 4,11 u/px | 1,20 u/px |
| El más lento | 0,08 u/px | 0,08 u/px |
| Reparto entre el más rápido y la media | 6,1× | 1,8× |

Lo que NO hace el reparto es mover un fotograma. La dirección de arte es
tuya; el reparto solo garantiza que se pueda ver.

**Si el guion no cabe, se avisa.** Si entre todos los tramos piden más scroll
del que el documento tiene, el objetivo es imposible —no es un fallo del
algoritmo, es un guion que no cabe— y sale un aviso en la consola que dice
cuánto faltaría. Cuando lo veas, el arreglo es tuyo y es de datos: acerca el
cuerpo, acorta la distancia entre fotogramas o alarga la sección.

```text
[universo] el guion no cabe en el documento: a 1.2 u/px harían falta
21352 px de recorrido y el documento solo tiene 9500. La cámara irá a
2.70 u/px por todos los tramos, que es parejo pero por encima del diseño.
Aleja los cuerpos o alarga las secciones.
```

**Un número que sí puedes cambiar**, si quieres subir o bajar el carácter del
viaje entero, está en `universo/ruta.js`:

```js
const VELOCIDAD_OBJETIVO = 1.2;   // unidades de mundo por píxel de scroll
```

Por debajo de `0,9` el arranque pierde el golpe; por encima de `1,4` los
cambios de cuerpo empiezan a notarse como tirón. La transición de la portada
al planeta de Perfil recorre 950 unidades, y con `0,9` recibiría 1055 px de
recorrido: el viaje se alarga y esa parte deja de sentirse como un barrido.

### Cuánto mide el plano de cierre

Da recorrido al cierre con un espaciador al final de la sección. En
`05-sections.css`:

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

### El selector de la cabecera

Hay un selector en la cabecera, junto a la marca: **Auto · Alta · Media ·
Ligera · Sin 3D**. Está en la cabecera y no en el HUD del 3D a propósito: el
HUD solo existe si el universo se montó, y si el 3D está apagado el visitante
sigue teniendo que poder cambiarlo.

Lo pilota `modules/calidadVisual.js` y la preferencia vive en
`localStorage`, en `odisea:calidad`.

| Valor | Qué hace |
|---|---|
| `auto` | Lo decide `universo/calidad.js`. Es el valor por defecto. |
| `alto` · `medio` · `bajo` | Fuerza ese nivel. **Recarga la página.** |
| `off` | Apaga el 3D **en vivo**, sin recargar. |

**Por qué elegir un nivel recarga y apagar no.** Los presupuestos de calidad
no son ajustes de un objeto que ya existe: son triángulos, puntos de estrella
y capas de atmósfera que se cuentan al construir la escena. La densidad de
píxeles, el grano y el desenfoque sí se pueden cambiar en caliente, pero un
nivel que solo baja la resolución y deja los 4 000 puntos igual no es el
nivel que el selector promete. Reconstruir la escena a media travesía es un
salto visible de medio mundo, y recargar un sitio de este tamaño cuesta
menos de un segundo. "Sin 3D" sí tiene un camino en vivo ya probado —el
mismo que usa el botón "Vista simple" del HUD— y por eso no recarga.

Un aviso explica siempre lo que va a pasar, antes de que pase.

**Para volver atrás a automático**, elige "Auto". La clave antigua
`odisea:simple` se sigue leyendo al arrancar —para que el sitio no le cambie
el comportamiento a quien ya la tenía— pero ya no se escribe, y
`localStorage.removeItem('odisea:simple')` ya no hace falta.

### Cambiar el nivel a mano

Fuerza un nivel con el atributo en el `<html>`, desde la consola:

```js
document.documentElement.dataset.calidad = 'alto';   // 'alto' | 'medio' | 'bajo'
```

Los perfiles están en `assets/js/universo/calidad.js`, tabla `PERFILES`. Cada
número de ahí es un presupuesto:

| Clave | Qué controla |
|---|---|
| `detallePlaneta` | Triángulos de la esfera: 4 → 500, 3 → 320, 2 → 180 |
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

Las que llevan la palabra "objetivo" son presupuestos y las demás son
interruptores. Si añades una clave, decide en cuál de los dos grupos entra: la
sonda de framerate solo mira las de objetivo, y un interruptor que se contara
como objetivo degradaría el sitio entero.

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
3. **`detallePlaneta` a 2.** 180 triángulos se ven perfectamente a la
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

Dos caminos, y los dos están en pantalla:

- El botón **"Vista simple"**, en la esquina inferior derecha del HUD.
- El selector de la cabecera, en **"Sin 3D"**.

Los dos hacen lo mismo por el mismo camino: borran el universo, quitan el
lienzo y dejan el sitio con el campo de partículas en 2D. La elección se
guarda en `localStorage`, en `odisea:calidad` con el valor `off`, y sobrevive
a la recarga.

Para volver atrás, elige **"Auto"** en el selector. O desde la consola:

```js
localStorage.removeItem('odisea:calidad');
location.reload();
```

La clave antigua `odisea:simple` se sigue leyendo al arrancar, para que el
sitio no le cambie el comportamiento a quien ya la tenía de una visita
anterior, pero ya no se escribe nada en ella.

### Para todo el sitio, siempre

En `assets/js/main.js`, quita esta línea:

```js
import { montarUniverso } from './universo/index.js';   // dentro de montarUniverso()
```

Y en `index.html`, quita el `<canvas id="universo-lienzo">` y los `<link>` a
`06-universo.css` y `07-interfaz.css`. El sitio funciona sin los tres.

`07-interfaz.css` contiene la cortina de cine y el panel del recorrido
guiado, que no tienen sentido sin el 3D; quitarla también es correcto si
quitas `modules/viaje.js` de la lista de montajes.

También puedes añadir `prefers-reduced-motion` a la lista de simulación en
las DevTools para ver cómo queda la versión sin movimiento: el universo no se
monta y el botón del recorrido desaparece.

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

## 9. La apertura: el sol que estalla

La portada no empieza en el espacio. Empieza **pegada a una estrella**: un sol
de fotosfera granulada, con oscurecimiento en el limbo y un borde que se
calienta. Se ve arder, se hincha, se apaga en blanco y deja una onda de choque
que la cámara atraviesa. De esa onda sale el planeta de Perfil.

Lo pilota `universo/cuerpos/bigbang.js`, con cuatro piezas y **un solo
número** —`expansion`, de 0 a 1— que las gobierna a la vez. Que todas salgan
del mismo número es lo que hace que se lea como un fenómeno y no como cuatro
animaciones que empiezan a la vez.

| Pieza | Qué es | Cuándo se ve |
|---|---|---|
| `sol` | La estrella: fotosfera con granulado, rampa blanco-naranja-rojo, limbo que se oscurece. | Desde el primer píxel |
| `corona` | El halo: fresnel sobre la cara interior de una esfera un 25 % mayor. | Con el sol encendido |
| `onda` | El frente de choque. Solo el limbo; el interior, transparente. | Desde la detonación |
| `materia` | Los escombros: puntos de 2 a 14 px con un frente nítido. | Al pasar la onda |

### Los cuatro cortes

Están juntos al principio de `bigbang.js`:

```js
const ARDE_HASTA = 0.16;     // el sol arde y se acerca
const DETONA_EN = 0.24;      // aquí estalla
const SOL_SE_APAGA = 0.46;   // la estrella ya no está
```

### EL RADIO MANDA MÁS QUE EL BRILLO

Este es el número que más se nota, y el que peor estaba. A 212 unidades de la
cámara, un radio de 78 mide 47° contra 36° de campo: la estrella ocupa más que
la pantalla y se lee como una roca marrón. Ahora va de 34 a 58, o sea de 18°
a 29°: un disco grande **con espacio alrededor**, que es como se lee un sol.

### Si lo cambias a mano

| Qué | Dónde | Efecto |
|---|---|---|
| Tamaño del sol | `radioBase = 34 + crece * 24` | Por debajo de 30 es una estrella lejana; por encima de 70 vuelve a ser una pared. |
| Cuándo estalla | `DETONA_EN` | Antes, más tensión; después, la explosión se pierde. |
| Radio de la onda | `radioMax` de `PRESENTACION` | Es el radio del campo de estrellas. Si lo bajas, la onda se va antes que las estrellas y el cielo se queda a oscuras. |
| Apertura completa | `escena.js`, `explosion = avanceOrigen / 0.82` | El 0,82 es `ZONA_DE_CAMBIO`. Sin él, la explosión se acaba en el 82 % de la portada y el resto queda vacío. |

---


## 10. El recorrido guiado

El botón **"Iniciar viaje"** de la portada deja el sitio en manos del
visitante durante un minuto: la cortina de cine cierra, la cabecera se apaga
y la página se va sola de sistema en sistema, parándose en cada uno para que
el texto se pueda leer.

Lo pilota `assets/js/modules/viaje.js`. No es un módulo del universo: funciona
igual con 3D y en vista simple.

### Los tres números que lo definen

Están juntos al principio del archivo, y no repartidos:

```js
const DURACION_MINIMA = 1500;   // ms de un salto corto
const DURACION_MAXIMA = 3600;   // ms de un salto largo
const PAUSA_EN_PARADA = 2000;   // ms de lectura en cada sistema
```

La duración de cada salto **crece con la distancia**, con topes:

```js
700 + distancia / 2.2
```

Tres mil píxeles en 1,5 segundos son dos mil píxeles por segundo, y eso se lee
como un teletransporte, no como una cámara. Y un tramo corto no puede
quedarse tirante esperando a que venza un plazo fijo.

### Las paradas

Se sacan de `data/universo.js`, del campo `etiqueta` de cada sistema. No de
una lista escrita en el módulo: el recorrido, el HUD del 3D y la barra de
sistema llaman a cada lugar por la misma palabra, y si cada una
tuviera su propia lista, las tres se desincronizarían sin avisar.

**Si añades una sección**, no hay que tocar nada: el recorrido la recoge
automáticamente, con su nombre y su sitio en la cuenta.

### Cómo se para

Cuatro vías, y todas hacen lo mismo:

- el botón **Detener** del panel;
- la tecla `Escape`;
- **cualquier gesto del visitante**: rueda, dedo, flechas, `Re Pág`, `Av Pág`,
  `Inicio`, `Fin`, espacio, o un clic en cualquier enlace;
- llegar al final.

Al parar, el foco vuelve al botón del recorrido, para que quien esté usando el
teclado no se quede perdido.

### Por qué no se monta con movimiento reducido

Un avance automático de la página es exactamente lo que
`prefers-reduced-motion: reduce` dice que no se haga, así que
`modules/viaje.js` retira el botón y las reglas de la cortina. Con esa
preferencia activa, el sitio se recorre a scroll.

### Un solo motor de scroll

El recorrido **no escribe `scrollY`**. Pide cada parada a
`core/desplazar.js`, que es el único módulo del sitio que mueve el scroll, y
deja que sea Lenis quien anime. Un módulo que escribiera `window.scrollTo`
por su cuenta sería una segunda autoridad sobre el scroll, y las dos se
pelearían por el mismo píxel.

## 11. Problemas

### "No se ve nada" / la página está en negro

1. ¿Hay errores en la consola? Busca `[universo]`.
2. Comprueba `document.documentElement.dataset.universo`. Debería ser `activo`.
3. Si es `inactivo`, mira el motivo: `sin-webgl`, `movimiento`, `simple`.
4. Comprueba `document.documentElement.dataset.calidad`. Si no es `alto`,
   `medio` o `bajo`, la decisión no llegó a `universo/calidad.js`: mira qué
   hay guardado en `localStorage` con la clave `odisea:calidad`.
5. Prueba `document.documentElement.dataset.calidad = 'bajo'` por si es un
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

### "El botón de Iniciar viaje no aparece"

Solo hay tres motivos, y los tres son intencionados:

- `prefers-reduced-motion: reduce` está activo. Un avance automático de la
  página es justo lo que esa preferencia pide que no pase.
- El sitio tiene menos de tres secciones con sistema en el universo.
- El selector de calidad está en `Sin 3D` o guardado como tal.

### "La cámara va demasiado rápido en un tramo"

Mira la salida de `node tools/probar-ruta.mjs`, la tabla de velocidad por
tramo. Si algún tramo pasa de 1,2 u/px, mira si la consola avisa de que el
guion no cabe: eso significa que hay que acercar un cuerpo o alargar su
sección, no tocar el reparto. Ver [Ritmo](#4-ritmo).

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

## 12. Dos cosas que dependen del dominio de producción

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

## 13. Estructura

```
index.html                        Todo el contenido. Es el archivo que se edita.
vercel.json                       Cabeceras de caché y de seguridad.
ESTUDIO.md                        Referencias, matriz y decisiones técnicas.

assets/
  css/
    00-fonts.css                  Las tres familias
    01-tokens.css            ★    LA PALETA. Se cambia aquí.
    02-base.css                   Reset, tipografía raíz, utilidades
    03-components.css             Botones, campos, chips, avisos, barra de lectura
    04-animations.css             Keyframes
    05-sections.css               Cabecera, portada, perfil, proceso, contacto
    06-universo.css               Lienzo, HUD, velo de texto, tarjetas
    07-interfaz.css               Índice del menú, calidad, cortina, avisos
  js/
    core/
      loop.js                     El único requestAnimationFrame del sitio
      util.js                     clamp, lerp, suavizar, almacen, reloj
      dom.js                      $, $$, crear
      calidad.js             ★    El CONTRATO de la calidad: clave y eventos
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
      aviso.js                    Avisos efímeros
      calidadVisual.js       ★    El selector de calidad de la cabecera
      viaje.js               ★    El recorrido guiado
    universo/
      index.js               ★    La puerta de entrada. Decide qué se monta
      calidad.js            ★    Detección de GPU y tres perfiles
      escena.js                   Ensambla y mueve todo
      camara.js                   Amortiguación, velocidad, FOV
      ruta.js               ★★   Scroll → punto de la curva, y su reparto
      colores.js                  Lee la paleta de los tokens CSS
      audio.js                    Sonido sintetizado, sin archivos
      hud.js                      Indicador de sistema, puntos, botones
      capas/                      estrellas · nebulosa · polvo · galaxias
      cuerpos/                    planeta · atmosfera · anillos · lunas
                                 campo · baliza · bigbang
      shaders/comunes.js          Ruido, fbm y fresnel compartidos
  vendor/
    three/0.186.1/                Three.js (MIT)
    lenis/1.3.26/                 Lenis (MIT)

tools/
  verificar-texto.mjs              Caracteres ajenos, rutas, sintaxis, console.log
  verificar-grafo.mjs              Grafo de imports desde main.js
  verificar-contenido.mjs          Nada perdido respecto a la versión anterior
  verificar-a11y.mjs               Encabezados, nombres, contraste, SEO
  verificar-exports.mjs            Exports que nadie llama
  verificar-shaders.mjs            Los shaders compilan y declaran lo que usan
  verificar-velos.mjs              Ningún velo deja una línea al acabar su caja
  verificar-limpiezas.mjs          Todo montar* suelta lo que registró
  probar-calidad.mjs               13 casos del sistema de calidad + la geometría real
  probar-ruta.mjs                  Velocidad por tramo, amortiguación, menú
  probar-dom.mjs                   Arranque del sitio en un DOM de verdad
  generar-og.py                    Regenera la tarjeta social
```

★ = los archivos que vas a editar
★★ = el que más, y el primero que debes mirar

---

## 14. Antes de publicar

```bash
node tools/comprobar.mjs            # pasa las once comprobaciones
python3 tools/generar-og.py         # solo si cambiaste la imagen social
```

`comprobar.mjs` sale con código 1 si algo falla, así que vale como puerta en
un `pre-commit` o en la integración continua. Para correrlas por separado:

```bash
node tools/verificar-texto.mjs      # caracteres ajenos, rutas, sintaxis, console.log
node tools/verificar-grafo.mjs      # el grafo de imports entero desde main.js
node tools/verificar-contenido.mjs  # nada perdido respecto a la versión anterior
node tools/verificar-a11y.mjs       # encabezados, nombres, contraste, SEO
node tools/verificar-exports.mjs    # exports que nadie llama
node tools/verificar-shaders.mjs    # los shaders compilan y declaran lo que usan
node tools/verificar-velos.mjs      # ningún velo deja costura al terminar su caja
node tools/verificar-limpiezas.mjs  # todo montar* devuelve su limpieza de verdad
node tools/probar-calidad.mjs       # 13 casos + la geometría que dice cada nivel
node tools/probar-ruta.mjs          # velocidad por tramo, amortiguación, menú
node tools/probar-dom.mjs           # el sitio arranca y responde (necesita jsdom)
```

El de exports avisa, no falla: hay nueve exports sin uso que ya estaban antes
de este trabajo y que están en su línea base. Los nuevos sí los falla.

### La comprobación de arranque necesita una cosa instalada

`probar-dom.mjs` es la única que no es estática: monta el `index.html` real
en un DOM, ejecuta el grafo completo de módulos y hace lo que haría una
persona — pulsar el recorrido, pararlo de tres maneras, cambiar la calidad.
Es la que encuentra los fallos que no se ven leyendo el código: un `id` mal
escrito, un módulo que lanza al montar, un nombre tapado por otro dentro de
una función.

Necesita `jsdom`, y es la ÚNICA dependencia de todo el repositorio. El sitio
que se publica no tiene `package.json` ni `node_modules`.

```bash
npm install --no-save jsdom     # no guarda nada en el repositorio
node tools/probar-dom.mjs
```

Sin ella se salta sola y lo dice, marcada como **omitida** y no como "pasa":
contarla como aprobada sería mentir, porque no se ha comprobado nada.

**Lo que estas herramientas NO comprueban, y hay que mirar en el navegador:**
el orden real de tabulación, si el foco se ve sobre el planeta, si un panel se
lee bien con la escena detrás, el framerate real en un móvil y el aspecto en
un portátil con GPU integrada. Lo estático no llega hasta ahí.

### Los once puntos se pueden automatizar, y merece la pena

Hasta hace poco esto era una lista para hacer a mano. Se puede hacer sola con
un navegador de verdad, y **eso es lo que encuentra los fallos grandes**: la
sonda estática no puede ver nada que solo exista mientras hay una animación.

Los once puntos de abajo se cubrieron todos con Chromium + Playwright, con
cero errores de consola. Y aparecieron dos bugs que ninguna de las once
comprobaciones veía: el recorrido guiado no se movía —`duracion` en
milisegundos donde Lenis anima en segundos, así que cada parada duraba de 25 a
60 minutos— y el selector de calidad degradaba el nivel que el visitante había
elegido a mano.

El detalle está en `PENDIENTES.md`. Lo que hay que saber para repetirlo:

```bash
python3 -m http.server 8099          # los módulos ES no cargan desde file://
npx playwright install chromium
```

y Chromium necesita estos flags, **o sale SwiftShader y los fps no significan
nada**:

```
--use-gl=angle --ignore-gpu-blocklist --enable-gpu-rasterization
--enable-unsafe-swiftshader
```

Con eso se obtiene WebGL 2.0 sobre la GPU de verdad, que es lo que permite
medir el presupuesto de `§6.2` y no solo quedarse con una cifra de software.

Los puntos, para hacerlo a mano o automatizado:

1. Recarga con la consola abierta: cero errores.
2. Desplázate de arriba abajo, despacio y rápido. Después sube. Sin saltos.
3. Pulsa **Iniciar viaje** y déjalo correr entero. Luego páralo con `Escape`,
   con la rueda y con el botón: los tres tienen que funcionar.
4. Cambia la calidad a Ligera y a Sin 3D, y comprueba que el aviso dice la
   verdad y que el sitio sigue entero en los dos casos.
5. Recarga a media página.
6. Redimensiona a 360, 768, 1024, 1440 y 1920.
7. Activa `prefers-reduced-motion: reduce` en las DevTools: el botón del
   recorrido tiene que desaparecer y el resto seguir igual.
8. Desactiva WebGL en las DevTools y comprueba que el sitio sigue entero.
9. Navega solo con el teclado: `Tab`, `Enter`, `Escape`. El foco se ve siempre.
10. Manda un mensaje de prueba desde el formulario.
11. Pégalo en un chat de WhatsApp a un móvil y mira la tarjeta.

Si algo falla, casi siempre es una de dos cosas: un `id` de sección que no
coincide con el HTML, o el endpoint del formulario sin pegar.
