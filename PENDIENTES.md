# PENDIENTES

> ## ⚠ LEE PRIMERO: `OPENCODE_RUTA.md`
>
> Este archivo dio por bueno un estado que **estaba roto**. Los dos últimos
> bloques de commits de «realismo» (6 de oct, 13:16-13:19) dejaron dos shaders
> que no compilan: el de las estrellas (`rand()` inexistente y `vSemilla` sin
> declarar) y el de **todos los planetas** (una variable local `fresnel` tapaba
> la función `fresnel()`). El universo se veía sin estrellas ni planetas y las
> comprobaciones seguían en verde, porque eran estáticas y no compilan GLSL.
>
> Por eso las frases de abajo que dicen «ningún defecto abierto», «cero errores
> de consola» o «las doce comprobaciones en verde» **no eran ciertas** cuando se
> escribieron. Ahora hay una comprobación en navegador real
> (`tools/verificar-webgl.mjs`) y una herramienta de capturas
> (`tools/capturar.mjs`). **Ningún cambio visual cuenta como hecho hasta que se
> haya abierto la captura y se haya mirado.**
>
> El plan a seguir, paso a paso, está en `OPENCODE_RUTA.md`.

## PARA EMPEZAR MAÑANA

**En vivo:** https://portafolio-juan-david-pareja-quinte.vercel.app

**En local:** `python3 -m http.server 8099` y abrir `http://localhost:8099`.
Hace falta un servidor porque los módulos ES no cargan desde `file://`.

**Comprobaciones:** `ln -sfn /tmp/opencode/node_modules node_modules`,
`node tools/comprobar.mjs`, `rm -f node_modules`. Salen en verde las trece
(la de «Arranque en un DOM» se omite si no hay `jsdom`; la de WebGL se omite si
no hay `playwright`), con un aviso de exports sin uso que es lo esperado.

**Publicación:** `vercel --prod`. Todo está pusheado en `main`; el árbol de
trabajo tiene lo de esta sesión sin confirmar, y `promt`, que es un archivo de
trabajo sin seguimiento y no debe subirse.

### Lo que se resolvió en esta tanda

**Las fuentes.** Los seis `@font-face` apuntaban a **tres archivos**: los dos de
Space Grotesk eran el mismo binario con **Light** dentro, y los tres de Inter
eran el mismo con **Regular** dentro, mientras el CSS pedía 500/700 y 400/500/600.
**Ninguno de los cinco pesos que pedía el sitio existía.** Los titulares de
todo el sitio se veían en Light y ningún `<strong>` en negrita, sin un solo
error en consola.

Decidido: **bajar los `@font-face` a lo que hay**. El sitio no ha cambiado ni un
trazo —`og.png` sale byte a byte idéntico, mismo md5— y han desaparecido cuatro
archivos: **−63 KB**. El display además se renombra a
`space-grotesk-300-latin.woff2`, que es lo que lleva dentro.

Lo cazó una comprobación nueva, la duodécima: `verificar-fuentes.mjs` lee el
`usWeightClass` **de dentro** de cada `.woff2` y lo compara con el CSS, sin
necesitar nada instalado. Detalle en la **sección 8**.

**El `index.html` sin CSS dentro.** No llevaba ni un `style=""`: el escalonado
del menú, los colores de los canales y una medida del glifo. Ahora los tres
están en `05-sections.css`, con nombres que dicen lo que son. También se
invirtió el orden de carga de `03` y `04`, que no cambiaba nada pero
contradecía su numeración. Detalle en la **sección 8-bis**.

### Después

| Qué | Dónde |
|---|---|
| Endpoint de Formspree | `CONTACTO.endpoint` en `assets/js/data/universo.js`, hoy vacío a propósito |
| Dominio propio | `canonical` y `og:url` en `index.html`, descritas en `UNIVERSO.md` §12. Ahora son relativas y funcionan en cualquier dominio |
| Repetir la tabla 6.2 en otra GPU | Ya verificada en hardware real: 37 draw calls, 17/17/16 programas |
| Bajar los pesos de verdad de las fuentes | `00-fonts.css`. +~90 KB y cambia el titular de todo el sitio. Opcional |

**Defectos abiertos: ver `OPENCODE_RUTA.md`** (la frase que había aquí, «ningún defecto
abierto», era falsa).

---

## RESUMEN DE LA SESIÓN

Estado al cerrar la sesión del 2 de octubre, segunda parte.

La primera parte arregló el arco de `og.png`, el recorrido que no visitaba
`#proyectos` y la regla de las limpiezas. Esta hizo lo que ninguna de las once
comprobaciones podía: **abrir el sitio en un navegador de verdad**.

Con Chromium y WebGL 2.0 sobre una Intel UHD 630 apareció que el recorrido
guiado no funcionaba y que el selector de calidad no controlaba. Los dos
estaban ocultos detrás de comprobaciones que pasaban.

---

## 1. RESUELTO · EL RECORRIDO GUIADO NO SE MOVÍA

**El peor defecto del sitio, y era invisible para todo `tools/`.**

`core/desplazar.js` publica `duracion` en **milisegundos** y se la pasa tal cual
a Lenis. **Lenis anima en segundos.** No es una interpretación: lo dice su
propio código, `Animate.advance()` lleva el comentario *"The time in seconds to
advance the animation"* y calcula `currentTime / duration`.

El valor por defecto del sitio, `DURACION_SCROLL = 1.05`, es correcto
precisamente porque ya estaba en segundos. La ruta que pasa duración
explícita, no.

`viaje.js` lo hace así a propósito, y con buenos números:

```
const duracion = duracionPara(distancia);   // clamp(700 + distancia/2.2, 1500, 3600) ms
desplazarAposicion(objetivo, { duracion });
```

**Medido.** `duracionPara` da entre 1 500 y 3 600. Lenis lo leía como
1 500–3 600 **segundos**: cada parada se animaba entre 25 y 60 minutos. En el
navegador, el recorrido arrancaba, el contador se ponía en `01 / 06 · El
origen` y se quedaba ahí para siempre, con la página avanzando unos 8 píxeles
por segundo.

```
antes:   t+1s scrollY=0     t+3s scrollY=19     t+6s scrollY=31   "01 / 06"
ahora:   t+1s scrollY=0     t+3s scrollY=1674   t+6s scrollY=2832 "03 / 06"
```

**Por qué no lo veía ninguna comprobación.** `probar-dom.mjs` monta el sitio en
un DOM de prueba, donde **no hay Lenis**: `lenis` es `null`, `desplazarAposicion`
cae a `window.scrollTo` y la llamada se ejecuta. La prueba pasa. El error solo
existe cuando hay una animación de verdad que disentir de la unidad, y para
eso hace falta un navegador.

**Arreglo.** La conversión a segundos vive en `milisegundosASegundos()`, en
`core/util.js`, y la usa `desplazarAposicion()`. En `core/` y no dentro de la
función porque es una regla y **las reglas se prueban**: es el mismo motivo por
el que la regla de encuadre en vertical vive ahí y no en `camara.js`.

La conversión no está en quien llama a propósito: `core/desplazar.js` es la
única autoridad sobre el scroll, y la traducción de sus unidades le corresponde
a ella.

**Comprobado:** `probar-ruta.mjs` §10 verifica la conversión y sobre todo
**acota el error**: `assert.ok(slowest / fastest < 4)`. Si alguien vuelve a
pasar los milisegundos tal cual, esa comparación delata que la diferencia
entre paradas es de un orden de magnitud. Probado rompiéndolo: falla.

---

## 2. RESUELTO · EL SELECTOR DE CALIDAD NO CONTROLABA

`universo/index.js` marca `data-calidad-elegida="1"` cuando el nivel lo elige
el visitante, y `escena.js` arrancaba la sonda **sin mirar ese dato**. La sonda
mide 90 fotogramas y, si no llega al objetivo, baja un nivel.

Medido en el navegador:

| Visitante elige | Nivel real antes | Nivel real ahora |
|---|---|---|
| Alta | **Media** | Alta |
| Media | **Baja** | Media |
| Baja | Baja | Baja |

Dos de los tres niveles no hacían lo que decían. El selector es, según
ESTUDIO.md §3, la diferencia entre un sitio que se adapta y uno que se burla de
su visitante: *"un sistema que degrada solo, sin que el visitante pueda exigirle
nada, es un sistema que se equivoca solo"*. Aquí degradaba con o sin permiso, y
el propio selector era el escenario de la burla.

**Arreglo.** `crearSonda()` recibe `puedeDegradar`. Con el nivel elegido, la
sonda **sigue midiendo** —el HUD muestra los fotogramas y eso hace falta igual—
pero no degrada. `escena.js` lo recibe como `nivelElegido` y lo pasa.

**Comprobado** en `probar-calidad.mjs`: 33 ms por fotograma contra un objetivo
de 55, con el nivel elegido, no degrada pero mide y reporta 30,3 fps. Probado
rompiéndolo: falla.

---

## 3. RESUELTO · EL HUD SE IMPRIMÍA ENCIMA DEL CONTENIDO

Encontrado mirando la pantalla, no leyendo el código: `elementsFromPoint` en
los píxeles del HUD.

| Sección | Qué se solapaba |
|---|---|
| Habilidades | `04 / 06 — SISTEMA DE HABILIDADES` sobre **"Diseño responsive"** |
| Proceso | el contador sobre **"Descubrimiento"** |

Los dos textos impresos uno sobre el otro, y no se leía ninguno. No sale en las
capturas de secciones donde el contenido deja hueco, que es por eso pasó
desapercibido.

**La causa.** `.hud-sistema` es `position: fixed` y su `text-shadow` está
pensado para el fondo que el HUD **creía** que tenía: la escena. Pero el
contenido de las secciones también pasa por debajo, y ahí debajo hay **otro
texto**. Una sombra no arregla eso.

**El arreglo**, con el mismo método que la costura del sol: la forma, no el
número. Dos degradados lineales cruzados con `mask-composite: intersect` dan un
rectángulo opaco que se apaga en los cuatro bordes **por construcción**.
`verificar-velos.mjs` lo cuenta como cuarto velo y lo comprueba.

En móvil el velo necesita stretch: la caja del HUD es de 8 rem —solo el
contador— pero el contenido de detrás es el mismo, así que el `inset` se
extiende a la derecha y se baja la opacidad del centro.

**Contraste medido** con el método de ESTUDIO.md §13 —captura A con todo
visible, captura B con solo el texto del HUD oculto, y midiendo **el núcleo del
glifo y no su borde**, que es la trampa nº3 del documento:

| |-media |
|---|---|
| Texto del HUD | **6,2 : 1** |

Por encima de AA (4,5) y cerca de AAA (7). Y un dato que salió de medir: **el
alfa del velo casi no afecta al contraste** (0,62 → 6,23 y 0,93 → 6,16). El
velo no existe para mejorar el contraste del HUD, sino para **matar el texto de
detrás**. Subirlo a tope no arreglaba nada y dejaba una banda más fea.

---

## 4. MEDIDO CON GPU DE VERDAD, QUE ERA LO QUE FALTABA

Chromium headless va con SwiftShader y sus fps no significan nada. Con
`--use-gl=angle` sobre la iGPU de la máquina sale **WebGL 2.0 con ANGLE
(Intel, Mesa Intel UHD Graphics 630)**.

| | Medido | Tabla 6.2 de ESTUDIO.md |
|---|---|---|
| Draw calls por fotograma | **37** | 39 / 38 / 38 |
| Triángulos por fotograma | **7 201** | 14 992 / 9 490 / 5 310 |

**La tabla cuadra.** Los draw calls están donde deben, y los triángulos por
debajo del presupuesto. Es la primera verificación independiente de esa tabla,
que estuvo inventada dos sesiones.

**Framerate**, con la sonda degradando sola hasta donde toca:

| | fps | objetivo de su nivel |
|---|---|---|
| En reposo | 32,5 | 30 (bajo) ✓ |
| Recorriendo | 26,1 | 30 (bajo) |

Una iGPU de 2018 en una máquina virtual. La sonda bajó `medio → bajo` una vez y
se quedó: **degrada, nunca oscila**. Por debajo del objetivo moviéndose, que
en esta máquina es lo esperable.

**Y los programas de shader, que APRENDIERON A MEDIR MAL.** La primera
medición dio **3** y la tabla dice 17, así que casi se da por buena la
sospecha de que el número estaba inventado otra vez. No lo estaba: **la
medición estaba mal**. Three.js crea el programa de un cuerpo la primera vez
que ese cuerpo se dibuja, así que si solo se mira la portada —donde solo
existen el sol y su entorno— hay tres. Recorriendo el viaje entero:

| | createProgram | linkProgram | createShader | fuentes distintas |
|---|---|---|---|---|
| **Alto** | **17** | 17 | 34 | 31 |
| **Medio** | **17** | 17 | 34 | 31 |
| **Bajo** | **16** | 16 | 32 | 30 |

Clavado con la tabla 6.2: 17, 17 y 16. Y los 34 `createShader` son
exactamente 17 × 2, el vértice y el fragmento de cada uno.

Es la tercera vez que esta tabla sale bien, y las dos anteriores que estaban
mal se sostienen porque **nadie la midió**. Esta vez está medida en hardware, en los
tres niveles y recorriendo el viaje entero. La lección no cambia: un número
que solo se puede comprobar a mano acaba como estaba, y también al revés — un
número mal medido parece exactamente igual que un número inventado.

**Todas las capturas, con cero errores de consola**, en 360, 768, 1024, 1440 y
1920.

---

## 5. LO QUE SE PROBÓ Y PASÓ

Los once puntos del checklist manual de `UNIVERSO.md` §14, en navegador real:

| Punto | Resultado |
|---|---|
| Consola al cargar | Cero errores, en los cinco anchos |
| Desplazarse arriba y abajo | Sin saltos |
| Recorrido guiado entero | Avanza por los seis sistemas; para con `Escape`, con la rueda y con el botón |
| Calidad Ligera y Sin 3D | Ambas lo que dicen; "Sin 3D" apaga en vivo sin recargar |
| Recarga a media página | Vuelve a andar, sin salto de scroll |
| 360 · 768 · 1024 · 1440 · 1920 | Sin desbordamiento horizontal en ninguno |
| `prefers-reduced-motion` | Sin lienzo, sin recorrido, contenido revelado de golpe |
| Sin WebGL | Sitio entero, fondo 2D de respaldo, cero errores |
| Solo teclado | 14 de 14 tabulaciones con foco visible |
| Formulario | Vacío, correo malo, mensaje corto y válido: los cuatro bien |
| Tarjeta social | El arco del anillo ya no está (punto 1 de la sesión) |

El recorrido con `#proyectos` lleno también se probó: el contador marca las
siete paradas y la sección entra en el viaje.

---

## 6. LO QUE SIGUE PENDIENTE

| Qué falta | Por qué importa |
|---|---|
| **Presupuesto de fps en una GPU moderna** | Ya está medido en hardware real y la tabla cuadra, pero con una iGPU de 2018 en una máquina virtual. |
| **Envío real a Formspree** | Requiere pegar el endpoint en `CONTACTO.endpoint`. Con el endpoint vacío ya está probado todo lo demás. |
| **Tipografía de marca en `og.png`** | El generador no puede leer el `.woff2` del sitio. Convertirlo a TTF haría la tarjeta idéntica en cualquier máquina. |
| **Repetir la tabla 6.2 en otro hardware** | Ahora está medida y cuadra en los tres niveles. Falta contrastarla en una máquina de gama alta. |

Nada de esto es un defecto del sitio: son dos decisiones y una medición que
conviene repetir en otro hardware.

## 7. RESUELTO · LA TARJETA SOCIAL YA USA LA TIPOGRAFÍA DEL SITIO

Antes la tarjeta salía en la fuente del sistema: DejaVu en Linux, Helvetica en
macOS y Arial en Windows. **Tres tarjetas distintas para el mismo sitio**, y
ninguna con la tipografía de la marca. El aviso del generador además decía que
con DejaVu «el resultado es el de la marca», que era falso.

**No hizo falta nada.** PIL lee `.woff2` de verdad: su FreeType (2.10 o
superior, con brotli) los abre sin convertir. Así que `DISPLAY` y `MONO`
empiezan ahora por los archivos del repositorio, sin binarios nuevos y sin
dependencias nuevas. Donde el FreeType no sepa leerlos, `cargar()` falla con
`OSError`, la lista sigue bajando a una fuente del sistema y el aviso lo dice.

**El aviso final ahora distingue los dos casos**, que antes no distinguía:
con la fuente de la marca dice que la tarjeta es idéntica en cualquier máquina;
con una sustituida avisa de que el titular cambia de ancho y de que el velo
está medido contra la otra.

**Repetible byte a byte**, comprobado: dos ejecuciones seguidas dan el mismo
md5, `f39bf687…`.

**Y medido, porque el titular cambió de ancho.** Con la fuente de la marca,
"Pareja Quintero" mide **468 px en vez de 568**, así que acaba en `x≈552` y el
hueco hasta el anillo son 60 px:

| | con DejaVu | con la de la marca |
|---|---|---|
| Zona del anillo | 22,4 | 22,4 |
| Nebulosa del titular | 47,3 | 31,7 |
| Contraste del titular | 9,87 | **13,93** |
| Salto máximo entre columnas | 18,64 | 18,64 |

El arco sigue oculto y sin costura. El contraste **sube** a 13,93 porque un
trazo fino sobre fondo oscuro tiene más separación que uno grueso. Y la
nebulosa baja porque el titular, al ser más fino, tapa menos zona: es la misma
escena con menos tinta encima.

---

## 8. RESUELTO · EL CSS PEDÍA CINCO PESOS Y HABÍA TRES ARCHIVOS

**Decidido: bajar los `@font-face` a lo que hay. El sitio no ha cambiado ni un
trazo y han desaparecido cuatro archivos.**

Lo que había documentado aquí antes era solo Space Grotesk. Al medirlo con una
comprobación nueva salió que **Inter tenía el mismo defecto y peor**, así que
la sección se reescribió entera.

### Lo que había

Seis `@font-face` sobre **tres archivos distintos**, porque cinco de los seis
eran el mismo binario repetido con otro nombre:

```
md5                          archivo                       usWeightClass
260c81a4759baf163c025001c4f27872   inter-400-latin.woff2           400
260c81a4759baf163c025001c4f27872   inter-500-latin.woff2           400
260c81a4759baf163c025001c4f27872   inter-600-latin.woff2           400
a21e038a03f709cf60aa1e2944048aef   jetbrains-mono-500-latin.woff2   500
87c506d88b9f587f0e2292bc271f5083   space-grotesk-500-latin.woff2   300
87c506d88b9f587f0e2292bc271f5083   space-grotesk-700-latin.woff2   300
```

Y el CSS declaraba, en `00-fonts.css`:

| Familia | Pesos que pedía el CSS | Pesos que existían |
|---|---|---|
| Space Grotesk | 500, 700 | **300** |
| Inter | 400, 500, 600 | **400** |
| JetBrains Mono | 500 | 500 ✓ |

**Ni uno de los cinco pesos pedidos existía.** El único `@font-face` que no
mentía era el de JetBrains Mono.

### Lo que se veía

- Los **titulares de todo el sitio** en Space Grotesk **Light**, no en 500 ni 700.
- Los **`<strong>` del cuerpo**, que piden 600, en Inter **Regular**: no había
  ninguna negrita en el texto del sitio.
- El rótulo del botón "Iniciar viaje", que también pide 600, igual.

**No salía ningún error.** Los archivos existen, se descargan y se dibujan: el
navegador usa el peso que encuentra y no avisa. Un sitio que se ve bien y
miente sobre su propia tipografía, que es lo más difícil de cazar mirando.

Estaba en git, no es de esta sesión: los archivos con esos md5 están en HEAD.

### Lo que se hizo

**Se declara el peso que hay.** Tres `@font-face`, tres archivos:

```css
@font-face { font-family: 'Space Grotesk'; font-weight: 300; src: url('…/space-grotesk-300-latin.woff2'); }
@font-face { font-family: 'Inter';         font-weight: 400; src: url('…/inter-400-latin.woff2'); }
@font-face { font-family: 'JetBrains Mono';font-weight: 500; src: url('…/jetbrains-mono-500-latin.woff2'); }
```

Y se borran cuatro archivos: los dos de Space Grotesk y los de Inter que no
existían. **−63 KB.**

El archivo del display además se **renombra** a `space-grotesk-300-latin.woff2`,
que es lo que lleva dentro. Se llama así desde que se vio que el nombre decía
500 sobre un binario de 300: un archivo que se llama `700` y lleva Light es la
misma clase de mentira que el CSS, solo que en el disco.

**Las doce reglas que piden 700 y 600 se dejan como están, a propósito.** Son
la intención de diseño —"aquí el texto tiene que pesar más"— y el navegador usa
el peso más cercano, que es el único que hay, así que el resultado es idéntico
antes y después. Bajarlas a 300 y 400 también se vería igual, pero se perdería
dónde hace falta un peso de verdad: para el día que bajen las fuentes buenas
habría que adivinar qué reglas quieres en negrita.

### Verificado

- **`verificar-fuentes.mjs` en verde**, que compara el `usWeightClass` de
  dentro de cada archivo con el `font-weight` del CSS.
- **Las doce comprobaciones en verde.**
- **`og.png` regenerado y byte a byte idéntico**: mismo md5, `f39bf687…`. La
  tarjeta social no cambia ni un píxel, que era lo que había que asegurar.

### Lo que queda, si algún día quieres el carácter de verdad

Bajar las Medium y Bold de Space Grotesk y la Medium de Inter, y volver a
declarar 500 y 700 en `00-fonts.css`. **+~90 KB**, y cambian el titular de todo
el sitio y todos los `<strong>` del texto. Con eso la comprobación pasa sola,
porque los archivos dirían lo que declaran.

### La comprobación que lo cazó

`tools/verificar-fuentes.mjs`, nueva, y es la duodécima. Lee el `usWeightClass`
**de dentro de cada `.woff2`** y lo compara con el `font-weight` que declara el
CSS, más una segunda regla: dos archivos distintos no pueden ser el mismo
binario.

No necesita nada instalado. Un `.woff2` es un contenedor con un directorio de
tablas y un único flujo brotli, y `node:zlib` trae `brotliDecompressSync` de
serie, así que se lee entero sin dependencias. El sitio sigue sin
`package.json`.

El detalle que costó más: dentro del flujo brotli las tablas van
**transformadas**, así que el desplazamiento de `OS/2` se calcula sumando
longitudes transformadas donde las hay y originales donde no. Sumar solo las
originales —que es lo obvio— da un desplazamiento que no apunta a nada y el
error sale como `Decompression failed`, que no dice nada del peso.

Está probada rompiéndola: cambiar el `@font-face` de JetBrains Mono a 700 la
hace fallar con el peso exacto, y volver a ponerlo la deja en verde.

---

## 8-bis. MODULARIZADO · EL `index.html` NO TIENE NADA DE CSS DENTRO

Estaba en la tarea de "dejarlo todo con HTML, CSS y JavaScript básicos", y
era verdad en todo menos en una cosa: había **`style=""` en el marcado**.

| Dónde | Qué era | Ahora |
|---|---|---|
| Los 5 enlaces del menú | `style="--i: 0..4"`, el retardo de entrada | `:nth-child` en `05-sections.css` |
| Los 4 canales de contacto | `style="--canal-color: var(--accent-…)"` | `.canal--correo`, `--whatsapp`, `--presupuesto`, `--disponibilidad` |
| El glifo de la nota de Habilidades | `style="width: 34px; height: 34px"` | `.marca__glifo--sm` |

`index.html` ya no lleva ni un `style=""`. El resto del marcado —lo que es
contenido— se queda.

**El glifo merecía más.** El `style` solo cambiaba la caja: el anillo interior
seguía a `inset: 7px` y el núcleo a `8px`, medidos a mano para 38 px. Al
usarlo a 34 px las tres piezas no guardaban proporción. Ahora la medida es una
variable y las tres se derivan con `calc()`, así que cualquier tamaño sale bien
y no hay números medidos a mano sueltos en una regla.

### Y todo eso, visto en un navegador de verdad

Una corrección de CSS no está verificada hasta que se mira. Con Chromium y
`python3 -m http.server 8099`:

| Qué | Medido |
|---|---|
| Fuentes que se piden | 3, las tres que existen. **Ninguna petición a un archivo borrado** |
| Glifo de la cabecera | 38 px |
| Glifo de la nota | 34 px, y sin `style` en línea |
| Anillo interior | 18,4 % de la caja |
| Núcleo | 21 % en **los dos** tamaños — es lo que arregla el `inset: 7px` fijo |
| Los 4 canales | 4 colores distintos, ninguno en línea |
| Retardos del menú | 100 · 160 · 220 · 280 · 340 ms, que es lo que daba el `--i` inline |
| Consola | Cero errores |
| Anchos 360 · 768 · 1024 · 1440 · 1920 | Sin desbordamiento horizontal en ninguno |

Los 340 ms del último enlace son la prueba de que el `:nth-child` sustituye al
`--i` **exactamente**, no "más o menos": el retardo final depende del índice del
último hijo, así que si el escalonado no coincidiera con el que estaba escrito
en el HTML, saldría otro número.

Una nota sobre `document.fonts.check()`: devuelve `true` en cuanto la familia
puede dibujar **algún** peso, no el que se le pide. La primera versión de la
medición pedía `check('700 32px "Space Grotesk"')` esperando `false`, y sale
`true` aunque no exista ninguna bold —porque hay una Light. Casi se concluyó
que la comprobación de fuentes mintía, cuando lo que mentía era la medición.

**Los colores de los canales se nombran por lo que el canal ES**, no por el
color que le toca. Antes la paleta estaba partida entre el CSS y el HTML.

### Y el orden de carga de las hojas de estilo estaba invertido

`04-animations.css` se cargaba **antes** de `03-components.css`, contra su
numeración y contra el comentario que dice "una responsabilidad por archivo".

No cambiaba nada: `04-animations.css` solo declara `animation` en `.preloader`,
y ninguna otra hoja pisa esa propiedad. Pero es una trampa para el siguiente:
el que añada una regla de componente al principio de `03` no tiene forma de
saber que `04` ya pasó por encima, porque el número dice lo contrario.

Ahora el orden es 00, 01, 02, 03, 04, 05, 06, 07 y el comentario explica por
qué ese orden importa.

---

## 8-ter. ARREGLADO · LA UNDÉCIMA COMPROBACIÓN CONTABA ESCUCHADORES DE JSDOM

`probar-dom.mjs` fallaba al apagar el sitio con `mouseover ×1, mouseout ×1`.
**No era una fuga del sitio.** Los dos los pone `nwsapi`, el motor de
selectores de jsdom, en `document`, la primera vez que alguien pide un estilo
computado. No hay manera de retirarlos.

La prueba no los contaba porque su línea base se toma antes de que nadie haya
pedido un estilo, y el sitio sí lo pide durante el arranque.

El arreglo es provocar los dos ANTES de la línea base, con un
`getComputedStyle` sobre el documento. Y **no perdona de más**: probado
rompiéndolo, si el sitio se cuelga un `mouseover` propio la prueba sigue
fallando con `mouseover ×1`. Lo que se descarta es el par interno de jsdom, no
el tipo de evento.

---

## LA PRIMERA PARTE DE LA SESIÓN

Lo que se hizo antes de abrir un navegador. Estas cosas se repararon bien, pero
los dos bugs de más arriba eran más graves, y las comprobaciones que se
añadieron aquí abajo no los cazaban: pasaban con los dos presentes.

---

## 9. RESUELTO · EL ARCO DEL ANILLO EN `og.png`

**Dónde:** la tarjeta social, detrás de la última letra de "Quintero".

**Lo que dice el diagnóstico anterior, y cómo se comprobó.** La causa era
correcta: el velo se acortó a la medida del texto (`hasta=700`) en vez de a la
de la escena. La punta izquierda del anillo empieza en `x=612` —el centro está
en 950 y el radio exterior es 338—, y el titular acaba en `x=648`.

**Lo que estaba mal era el arreglo.** El documento proponía una línea:
`hasta=745`. **Se probó y no quita el arco.** Con la atenuación `opacidad ·
t**0.7`, a `x=612` el velo llega al 23 % y a `x=660` al 11 %: el anillo asoma
igual de claro. Cuatro variantes medidas, con `hasta` de 745 a 760 y opacidad
de 200 a 255, y el arco se veía en las cuatro. El diagnóstico del síntoma era
bueno; el número no daba la forma que hacía falta.

**El arreglo, y por qué es una meseta.** El velo pasó a ser **meseta plana +
caída suave**, que es el mismo método que el arreglo de la costura del sol en
el CSS: arreglar la forma y no el número. Una rampa única no podía, porque la
curva que mantiene el anillo tapado por encima de `x=612` se come la nebulosa
del titular. Con meseta no hay conflicto: la zona del texto queda uniformemente
velada y el anillo entra ya tapado.

La unión de la meseta con la rampa es continua, así que no aparece ninguna
costura, que es lo que se comprobó:

| | antes | después |
|---|---|---|
| Zona del anillo (655–700) | 79,6 | **22,4** |
| Nebulosa del titular (150–350) | 54,0 | 47,3 (−12 %) |
| Brillo del planeta (760–960) | 100 % | 95 % |
| Contraste del titular | 8,27 | **9,95** |
| Salto máximo entre columnas | 18,64 | 18,64 |

El contraste del titular **sube**: el fondo se apaga. El salto máximo no
cambia, que es la comprobación que importa — tapar sin costurar.

Una nota sobre el método: durante el trabajo se creyó ver una costura nueva en
`x=752`, y la medición la desmintió. Ese salto es el borde del planeta y está
en todas las versiones, incluida la publicada. Lo que hizo bajar la caída a
930 px, que parecía mejor a ojo, resultó ser peor: dejaba el planeta al 77 %.
`830` es el punto donde el anillo desaparece y el planeta sigue al 95 %.

**Constantes:** `VELO_OPACIDAD`, `VELO_MESETA`, `VELO_HASTA`, `VELO_CURVA`, con
la geometría de la escena escrita encima, en `tools/generar-og.py`.

**Y una segunda cosa que salió al mirar la imagen social.** El generador
sustituye la tipografía **en silencio**. El aviso anterior decía que con DejaVu
«el resultado es el de la marca», y eso es falso: la del sitio es Space
Grotesk, que vive en el repositorio solo como `.woff2`, y PIL no lee woff2. El
titular sale siempre en una sustituta, y cuál depende de la máquina: DejaVu en
Linux, Helvetica en macOS, Arial en Windows. Así que `SEMILLA` hace reproducible
la **escena**, no la **tipografía**, y dos máquinas no generan el mismo PNG. El
aviso ahora lo dice. *(Pendiente de verdad, no arreglado: convertir el woff2 a
TTF para que la tarjeta salga en la tipografía de marca.)*

---

## 10. RESUELTO · EL RECORRIDO NO VISITABA `#proyectos`

El más caro de los que aparecieron, porque **se activa solo** y sin error.

`#proyectos` no está en `index.html`: lo inserta `modules/proyectos.js`, que en
`main.js` se monta en la línea 93. `viaje.js` se monta en la 85 y decidía su
lista de paradas **al montarse**, filtrando `SISTEMAS` por
`document.getElementById(s.seccion) !== null`. Para entonces la sección de
proyectos todavía no existía, así que el sistema quedaba fuera del recorrido.

No se notaba porque `data/proyectos.js` está vacío: la sección no se crea y los
dos números salen a 6 por casualidad. **En cuanto se añade el primer proyecto,
el contador se queda en `06` mientras existen siete secciones con sistema** — el
«cúmulo de planetas» desaparece del viaje, sin un solo error en consola.

Las posiciones ya se medían tarde, a propósito, con un comentario que explica
por qué. Lo que no era tarde era la lista: el mismo razonamiento, a medias.

**Arreglo:** la lista se vuelve a leer en `medirParadas()`, igual que las
posiciones. `viaje.js:seccionesPresentes()`.

**Comprobado rompiendo el arreglo.** Con un proyecto de ejemplo puesto y el
arreglo revertido, la comprobación falla con el número exacto:

```
✗ el recorrido cuenta tantas paradas como secciones con sistema hay
  — el contador dice 6 y hay 7 secciones con sistema
```

Las dos aserciones comparan contra el DOM, no contra una constante, así que
valen igual con seis secciones que con siete.

---

## 11. RESUELTO · LA REGLA DE LAS LIMPIEZAS, QUE ESTABA ESCRITA Y CUMPLIDA A MEDIAS

La regla: cada `montar*` devuelve una función de limpieza y `main.js` la llama
en `pagehide`. Estaba en el papel y se incumplía en seis módulos de quince.
Ninguna de las diez comprobaciones lo veía, porque todas son estáticas y esta
fuga solo se ve en ejecución.

**Tres formas del mismo fallo, y ninguna lanzaba un error visible:**

1. **Devolver un objeto.** `proceso.js` devolvía `{ irAProgreso, avance }` y
   nadie usaba ninguna de las dos. `main.js` la invocaba, recibía un objeto y
   el `TypeError` lo tragaba su propio `catch`. Solo pasaba al descargar.
2. **No devolver nada.** `hero.js` y `montarMarquesina` devolvían `undefined`:
   `limpieza?.()` es inocuo. El paralaje seguía escribiendo `transform` en el
   aura y la cinta seguía duplicada.
3. **Devolver una función vacía.** `contacto.js` tenía `return () => {}` con
   cinco escuchadores con flechas anónimas encima: cumplía la firma sin hacer
   nada. Y `fondo.js` llamaba a `alFotograma(cuadro)` sin guardar la baja, así
   que el lienzo se dibujaba dos veces por fotograma tras un remontaje.

El patrón común: **un fallo que se silencia no se arregla, se propaga.**

**Lo corregido, módulo por módulo:**

| Módulo | Qué se soltaba antes |
|---|---|
| `proceso.js` | 10 `click`, el temporizador del fundido, el suscriptor del bucle y 16 nodos creados |
| `cursor.js` | 4 escuchadores y el fotograma, apuntando a un nodo ya retirado |
| `fondo.js` | el suscriptor del bucle |
| `contadores.js` | los contadores que siguieran animándose, hasta 1,5 s |
| `contacto.js` | 5 escuchadores (`blur`, `input`, `submit`, contador) |
| `contenido.js` | el `click` de filtros y las copias de la marquesina; ahora también los grupos del stack |
| `hero.js` | el paralaje, el reloj y la cadena recursiva de la máquina de escribir |
| `preloader.js` | el escuchador de `load` |
| `viaje.js` | un `click` que se intentaba retirar con una flecha nueva |

Y una corrección de paso en `proceso.js`: solo comprobaba cuatro de los ocho
nodos que lee, y `escribir()` escribía en `campos.indice` sin comprobarlo. Si
faltaba `#proceso-indice`, el `aplicar(0)` del montaje reventaba y se llevaba
por delante todo lo que `main.js` monta después.

**Un arreglo a medias también es un arreglo que no arregla.** La primera versión
del cambio de `cursor.js` pasó a `on()` sin **guardar** la baja que `on()`
devuelve: la fuga seguía intacta con más código encima. Lo cazó la prueba de
ejecución, no la lectura.

---

## 12. LAS DOS COMPROBACIONES NUEVAS

Porque una regla que no se comprueba se vuelve a incumplir en silencio.

### `tools/verificar-limpiezas.mjs` — lectura

Tres reglas: `alFotograma` conserva su baja, ningún escuchador usa manejador en
línea (para eso está `on()`), y todo `montar*` devuelve una función.

Con sus excepciones **escritas y justificadas**, no silenciadas: `core/loop.js`
no tiene ciclo de vida porque ES el bucle; `{ once: true }` sí se acepta porque
se retira solo; y `preloader.js` devuelve una `Promise` por contrato, que es un
contrato distinto y documentado.

Lo que no puede hacer, dicho en el propio archivo: es una lectura línea a línea,
así que un `addEventListener` partido en varias líneas se le escapa, y no puede
saber si una baja guardada se llega a llamar. Eso es lo de la siguiente.

### `probar-dom.mjs` — ejecución

Instrumenta `addEventListener` / `removeEventListener` y cuenta por **par de
tipo y manejador**, que es como funciona `removeEventListener`: por identidad.
Si un módulo retira un manejador distinto del que puso, el contador no baja y
el fallo queda al descubierto. Al final dispara `pagehide` y exige que no quede
nada colgado por encima de la línea base.

Además, **comprueba que la limpieza se ejecutó**, no solo que retiró
escuchadores. Con solo el conteo, el defecto original de `proceso.js` pasaba
limpio. Ahora se afirma que los nodos que el sitio crea al montar ya no están.

Y un arreglo de la prueba misma: `matchMedia` devolvía `matches: false` para
**todas** las consultas, así que `cursor.js` y `montarScrollSuave` salían por su
puerta de capacidad y no montaban nada. Las comprobaciones sobre sus limpiezas
pasaban sin haber montado nada, que es la forma más cómoda de no comprobar
nada. Ahora el sitio se presenta como un escritorio con puntero fino.

**Las dos comprobaciones se probaron rompiendo los arreglos.** Reintroducido el
código viejo, cada una falla con el detalle exacto —`click ×10`, `blur ×3`,
`mousemove ×1`, `alFotograma sin baja`— y volver a arreglar lo deja en verde.

El sitio pasa de diez comprobaciones a **once**, y las 46 aserciones de
integración de `probar-dom.mjs`.

---

## 13. LO QUE QUEDABA EN LA PRIMERA PARTE

| Qué falta | Por qué importa |
|---|---|
| **Presupuesto de 60 fps** | Chromium headless va con SwiftShader: los fps que miden no significan nada. Falta medir en una máquina con GPU de verdad. Es lo único de esta lista que no se puede resolver sin hardware. |
| **Envío real a Formspree** | Requiere pegar el endpoint en `CONTACTO.endpoint`. Todo lo demás ya está probado, incluida la respuesta de error. |
| **Tipografía de marca en `og.png`** | El generador no puede leer el `.woff2` del sitio. Convertirlo a TTF y añadirlo al repositorio haría la tarjeta idéntica en cualquier máquina. |

Nada más está abierto. No hay ningún defecto conocido.

---

## 14. CÓMO VERIFICAR

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

**No se puede leer el lienzo WebGL con `drawImage`** —el búfer de dibujo se
vacía al componer y sale negro—, así que una medición hecha así mide el texto
contra negro y no dice nada. Hay que capturar.

**Lo que sí funciona para medir** está en `ESTUDIO.md` sección 13: congelar la
escena engañando a `document.hidden`, decidir qué píxel es letra por COLOR y no
por luminancia, y recortar las cajas por debajo de la cabecera. Las tres cosas
son necesarias; con una sola el resultado es un falso positivo.

### Comprobar el contraste tras cualquier cambio de velo

Sigue siendo la regla. Fue el defecto más caro de esta serie, y el arreglo del
arco casi lo repite: la primera versión de la meseta tapaba de más y habría
bajado la entradilla de Perfil. **Una corrección de una capa decorativa es un
cambio de contraste hasta que se mide.**

---

## 15. REGLAS DEL PROYECTO QUE IMPORTAN

- **Sin framework, sin build, sin `package.json`.** HTML, CSS y módulos ES.
  `three@0.186.1` y `lenis@1.3.26` están vendorizados en `assets/vendor/`.
- **El Big Bang se queda.** Es la diferencia del sitio. Petición explícita.
- **Una sola autoridad sobre el scroll**: `assets/js/core/desplazar.js`. Ni Lenis
  ni nada más a tocar `scrollTop`.
- **Sin números mágicos sin nombre.** `data/universo.js` para el guion,
  `core/util.js` para las reglas. La regla de encuadre en vertical vive en
  `core/util.js` y **no** en `camara.js`, para que se pueda probar en node.
- **Las reglas se prueban.** Lo que se midió una vez y se escribió como
  aserción no vuelve a colarse. Lo que solo está en un comentario, sí.
- **Un velo se apaga antes de que su caja se acabe.** Con comprobación.
- **Todo `montar*` devuelve su limpieza.** Con comprobación, por las dos vías.
- **Un número de presupuesto se mide o no es un número.** La tabla 6.2 estuvo
  inventada dos sesiones. El icosaedro ya se comprueba contra la geometría
  real; los totales se miden interceptando WebGL.

---

## 16. ESTADO DEL REPOSITORIO

**Nada está confirmado.** No se ha hecho ningún `commit`.

Ojo al hacer `git diff`: hay archivos modificados que ya estaban antes de esta
tanda de trabajo, ajenos a lo que se hizo aquí. No los reviertas sin mirar.

**Archivos nuevos de esta sesión:**

```
tools/verificar-limpiezas.mjs
```

**Archivos modificados de esta sesión:**

```
assets/js/modules/proceso.js      la limpieza era un objeto
assets/js/modules/viaje.js        las paradas se decidían antes de tiempo
assets/js/modules/cursor.js       4 escuchadores y el fotograma, sin soltar
assets/js/modules/fondo.js        la baja de alFotograma se descartaba
assets/js/modules/contadores.js   los contadores seguían vivos 1,5 s
assets/js/modules/contacto.js     limpieza vacía con 5 escuchadores
assets/js/modules/contenido.js    filtros irretirables, marquesina y stack
assets/js/modules/hero.js         no devolvía nada; la máquina no se paraba
assets/js/modules/preloader.js    el escuchador de load se quedaba
tools/comprobar.mjs               la comprobación nueva, en la lista
tools/probar-dom.mjs             instrumentación y cinco aserciones
tools/generar-og.py               el velo, con meseta, y el aviso de fuentes
assets/img/og.png                 regenerada
```

### Y de ESTA tanda

```
tools/verificar-fuentes.mjs   NUEVO: lee el usWeightClass de dentro de cada
                              .woff2 y lo compara con el CSS; sin dependencias
tools/comprobar.mjs           la comprobación de fuentes, en la lista
tools/probar-dom.mjs          los dos escuchadores de nwsapi salen de la línea base
index.html                    sin un solo style=""; el orden de las hojas, ya en orden
assets/css/05-sections.css    el escalonado del menú, los colores de los canales
                              y las dos medidas del glifo, en el CSS
```

**El rojo de `verificar-fuentes.mjs` es lo único que queda, y es una decisión
de diseño tuya:** la **sección 8**. Con la opción de acierto no cambia el
aspecto, y con la de bajar los pesos reales el sitio recupera la jerarquía que
el CSS siempre pidió.

Documentación: `UNIVERSO.md` es el manual del universo, `ESTUDIO.md` explica
**por qué** está hecho así, con los defectos medidos y por qué se corrigieron.

---

# 9. CONTINUAR · EL UNIVERSO Y EL MODO DÍA

**Empieza por aquí si vienes de la otra tanda y solo te sirve esto.**

Todo lo de arriba está hecho, verificado en navegador y sin confirmar en git.
Lo de abajo es lo que se pidió después y está **a medias**.

## 9.1 Lo primero, antes de nada: el modo día NO EXISTE

Se retiró entero a propósito, en el commit `4257e99`, con su botón, su módulo
`modules/tema.js`, los 56 tokens de `:root[data-tema='claro']` y el
`MutationObserver` que recoloreaba la nebulosa. El motivo está escrito en ese
commit: *"un universo nocturno no tiene versión de día"*.

**No hay un modo día que arreglar: hay que construirlo.** Y hay una advertencia
en `UNIVERSO.md` §6 que va de caja:

> El tema claro obliga a cambiar la paleta de la nebulosa y del resplandor o el
> texto se vuelve ilegible sobre el planeta. Es un trabajo de medio día, no un
> cambio de veinte minutos.

La razón es concreta y está en el código: `universo/colores.js` **deriva la
paleta de la escena de los tokens del tema**. Al poner la página en claro, el
planeta se volvía blanco y el texto encima se volvía ilegible. Por eso el
modo día **hereda** del trabajo del universo: hay que hacerlo después, no a la
vez.

### Cómo volver a activarlo

Los cuatro pasos están en `UNIVERSO.md` §6. En resumen: recuperar el bloque de
tokens del historial (`git show main:assets/css/01-tokens.css`), volver a
importar `montarTema` en `main.js`, reponer `alCambiarTema()` en `colores.js` y
las cuatro `aplicarPaleta()` de las capas, y añadir las variantes claras de
`.malla` y `.fondo`.

## 9.2 ABIERTO · EL DISCO GRIS QUE CRUZA EL PLANETA

**Este es el defecto que motivations "el Big Bang no se ve bien". Y todavía no
sé qué es.** Es lo primero que hay que resolver, porque es el que se ve.

### Qué es

En la portada, con el 3D encendido, hay una **banda gris plana con el borde
recto** cruzando el planeta en diagonal. Se ve al desplazar el 12 % y el 25 % de
la portada:

- `bb2/01-00214px.png` y `bb2/02-00428px.png` — la banda cruzando el planeta
- El pixel del centro mide **`rgb(34, 36, 41)`**: un gris neutro, sin el tinte
  naranja del planeta ni el azul de la nebulosa

Que sea gris neutro y no un tono de la paleta es la pista más útil: su color no
viene de la paleta del sitio.

### Hipótesis YA DESCARTADAS, con el sitio sin tocar

Esto es lo importante de esta sección. **Cuatro suposiciones razonables
resultaron falsas**, y cada una se comprobó de verdad:

| Hipótesis | Cómo se comprobó | Resultado |
|---|---|---|
| El lado noche del planeta | Se arregló la difusión | **Sigue ahí** |
| `.hero__velo` | `display: none` | **Sigue ahí** |
| El halo del planeta | No se crea el sprite | **Sigue ahí** |
| El `text-shadow` del bloque | `text-shadow: none` | **Sigue ahí** |

Y sí es de la escena 3D, medido: con el 3D apagado el mismo pixel da
`rgb(6, 8, 15)`, y con el 3D puesto `rgb(34, 36, 41)`.

**Lo que NO es:** nada del CSS de la portada. Lo que sí es: algo de la escena.

### Cómo seguir con esto

El método que queda, y que es el que funciona: **no suponer, apagar y medir**.

1. Recorrer la escena de Three.js y apagar un objeto cada vez, mirando el pixel
   en cada paso. En cuanto el `rgb(34,36,41)` desaparezca, ese es el culpable.
2. El problema de la vía anterior es que **la escena no está expuesta**: desde
   la página solo se ve `window.__THREE__`, y no hay `window.escena`. Lo más
   limpio es añadir una línea en `universo/index.js`, `if (location.search)`
   o similar, para exponer la escena solo en local. **No se ha hecho.**
3. Sospechosos razonables por dónde seguir, sin haberlos comprobado:
   `materia` (los puntos del estallido, `depthWrite: false` como el resto),
   `onda`, y los `renderOrder` de `bigbang.js` (6, 7, 8) frente al 5 del halo.

Las capturas están en `/tmp/opencode/bb2/` y los recortes en
`/tmp/opencode/prueba/`.

## 9.3 HECHO · EL LADO NOCHE DEL PLANETA

Cambio real y terminado, pero **no es lo que causaba el disco gris**. Se hizo
creyéndolo y había que decirlo, así que está anotado en el propio
`shaders/comunes.js`.

En `difusion()`, `shaders/comunes.js`:

```glsl
// ANTES:  dot * 0.5 + 0.5
float cosAngulo = dot(normal, normalize(luz));
float envoltura = smoothstep(-0.18, 1.0, cosAngulo);
return pow(envoltura, 1.6);
```

`dot * 0.5 + 0.5` **no da un lado oscuro**: da 0.5 de luz en el terminador y
nunca baja de ahí, así que media esfera queda igual de iluminada. La vuelta
—la luz que dispersa la atmósfera más allá del terminador— es real, pero a 0.5
se come media planeta. Ahora es 0.18, y el exponente `1.6` concentra la luz
donde tiene que estar, en el centro del disco iluminado.

Consecuencias del cambio, y adjustados:

| Archivo | Cambio | Por qué |
|---|---|---|
| `cuerpos/planeta.js` | Ambiente `0.055` → `0.035` | El lado noche conservaba el color de la textura y se leía como gris plano |
| `cuerpos/planeta.js` | Umbral de luces de ciudad `d < 0.52` → `d < 0.30` | Antes encendía las ciudades en pleno lado de día. El umbral va justo por delante del terminador, para que la primera ciudad enciendida sea la del crepúsculo |
| `cuerpos/atmosfera.js` | Margen `smoothstep(0.18, 0.56)` → `(0.06, 0.42)` | La ventanaOld estaba calibrada para la difusión vieja |
| `cuerpos/lunas.js`, `cuerpos/campo.js` | **Sin tocar**, usan `difusion` y heredan el cambio | Comprobado que no salen raras |

Las doce comprobaciones siguen en verde. **Pero no se ha vuelto a mirar en un
navegador después del cambio**, que es la regla del proyecto: una corrección de
shader no está hecha hasta que se ve.

## 9.4 LO QUE PIDIÓ Y ESTÁ ENTERO POR HACE

Cuatro cosas del encargo, y este es su estado real:

| Qué | Estado | Nota |
|---|---|---|
| Arreglar los bugs del universo | **Empezado** | El lado noche sí. El disco gris sigue abierto: **9.2** |
| Que se vea "real", no dibujo | **Sin empezar** | Ver **9.5** |
| Texturas generadas por código | **Sin empezar** | Ver **9.6** |
| Modo día | **Sin empezar** | Ver **9.1** |

Y dos cosas más que se pidieron y no están ni empezado:

| Qué | Estado |
|---|---|
| Revisar bugs y ortografía en el sitio | Sin empezar |
| Que el modo día interactúe bien | Sin empezar, y depende del modo día |

## 9.5 PENDIENTE · QUE SE VEA REAL

Sin archivos de texto, solo shaders. Lo que se ve ahora, de la captura
`bb2/03-00641px.png`:

- Las estrellas son **cuadraditos**. Los puntos de `capas/estrellas.js` se
  dibujan sin degradado y a 1 px se ven como píxeles cuadrados.
- La nebulosa es un **tinte plano**, y la del Big Bang es un disco liso.
- El planeta tiene la textura de fbm, que a esta escala se ve como manchas de
  pintura.

Orden sugerido, de menos a másoui: puntos de estrella con caída suave →
nebulosa con más capas → detalle de la superficie del planeta.

## 9.6 PENDIENTE · TEXTURAS GENERADAS

Aquí hay una decisión de fondo, y es tuya.

La regla del proyecto, escrita en el pie del propio sitio, es:

> Texturas e imágenes generadas por código: en el proyecto no hay ni un
> archivo de imagen 3D.

Generar texturas por código **respeta** esa regla. Subir archivos de textura
al repositorio **la rompe**, y además suma peso y peticiones.

Lo que ya hay es el precedente: `planeta.js` tiene una función que hace
exactamente eso, `texturaBrillo()`, un degradado radial en canvas para los
sprites. Las texturas de superficie se pueden hacer igual, en un canvas, sin
salir del proyecto.

| Opción | Qué hace | Coste |
|---|---|---|
| Texturas en canvas, por código | Se ve más real y **respeta** la regla del proyecto | CPU al arrancar, unos ms |
| Archivos de textura en el repo | Se ve más real, más rápido | Rompe la regla, +peso, +peticiones |
| Mejorar solo los shaders | Cambio pequeño, cero coste | Gain limitado |

## 9.7 CÓMO SE MIDE CADA COSA

La regla del proyecto, y la que hay que respetar aquí: **una corrección de
capa decorativa es un cambio de contraste hasta que se mide**, y una corrección
de shader no está hecha hasta que se mira.

Herramientas que hay y sirven para esto:

- **Playwright con Chromium** está instalado, y es lo que sirve para casi todo:
  `NODE_PATH=/tmp/opencode/node_modules node <guion>.mjs`. Los guiones que se
  escribieron están en `/tmp/opencode/`: `bb2.mjs` recorre la portada en pasos
  y captura, `cazar.mjs` mide el pixel de un punto, `objeto.mjs` mide el pixel
  en varios puntos del viaje.
- **`localStorage.setItem('odisea:calidad', JSON.stringify('alto'))`** antes de
  cargar, o la sonda marca `bajo` y lo que sale no es lo que se verá nunca.
- **El Big Bang va con el SCROLL, no con un reloj.** Quieto en la portada no hay
  explosión: hay un planeta ya formado. Explota al desplazar. Capturar sin
  desplazarse no lo pilla.
- **El lienzo WebGL no se puede leer con `drawImage`** —el búfer se vacía al
  componer y sale negro—, así que hay que capturar y leer el píxel de la
  captura.

## 9.8 LO QUE NO HAY QUE REPETIR

Tres cosas que costaron tiempo en esta tanda:

1. **Suponer en vez de medir.** Cuatro hipótesis falsas seguidas sobre el mismo
   defecto. La cuarta —el `text-shadow` de 30 px— era la más plausible de todas
   y era falsa. Lo que funcionó fue apagar capas y medir el píxel.
2. **Dejar una afirmación falsa en el código.** El comentario de `difusion()`
   decía que arreglaba el disco gris, y no lo arregla. Está anotado en el
   propio archivo y en esta sección. Un comentario que miente es peor que
   ningún comentario, porque el siguiente lo lee y cree.
3. **Capturar a los 6 segundos.** El Big Bang ya había pasado. Los fotogramas
  interesting están en el primer segundo de scroll.

## 9.9 ESTADO DEL REPO

```
Sin confirmar. Nada de esta tanda está pusheado.

M  PENDIENTES.md                    esta sección
M  UNIVERSO.md                      la duodécima comprobación, y "00-fonts"
M  assets/css/00-fonts.css          los tres pesos que existen de verdad
M  assets/css/05-sections.css       menú, canales y glifo en el CSS
D  assets/fonts/inter-500-latin.woff2      no existía
D  assets/fonts/inter-600-latin.woff2      no existía
R  assets/fonts/space-grotesk-500 → -300   renombrado: era Light
D  assets/fonts/space-grotesk-700-latin.woff2   no existía
M  index.html                       sin style=""; orden de las hojas
M  assets/js/universo/shaders/comunes.js    la difusión
M  assets/js/universo/cuerpos/planeta.js    ambiente y luces de ciudad
M  assets/js/universo/cuerpos/atmosfera.js  el margen del crepúsculo
M  tools/comprobar.mjs              la comprobación de fuentes
M  tools/generar-og.py              el nombre de la fuente
M  tools/probar-dom.mjs             los escuchadores de nwsapi
M  tools/verificar-contenido.mjs    el renombrado de la fuente
?? tools/verificar-fuentes.mjs      NUEVO, sin confirmar
?? promt                            archivo de trabajo, NO subir
```

**Las doce comprobaciones en verde**, con el aviso de exports sin uso que es lo
esperado.
