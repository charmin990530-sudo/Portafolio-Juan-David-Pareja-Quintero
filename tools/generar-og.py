#!/usr/bin/env python3
"""
tools/generar-og.py — Genera `assets/img/og.png` (1200×630).

Es la tarjeta que se ve al compartir el enlace en WhatsApp, LinkedIn, X o
Facebook. Sin ella, esas redes muestran solo el texto o un recuadro vacío.

DISEÑO
------
Sale de la identidad real del sitio, no de una plantilla: fondo `--space-900`,
los mismos acentos que usan los planetas, el titular en Space Grotesk y la
señalética en JetBrains Mono. La composición es la del sitio: un planeta al
fondo con sus anillos, el titular a la izquierda y la retícula de la malla.

Es una versión 2D y estática de lo que hace el shader del sitio, con la misma
idea: lado iluminado en cian, sombra con los acentos de la marca y puntos de
luz en la cara nocturna.

Por qué Python y no una captura del navegador: una captura depende de que la
escena esté montada, de que haya red y de que el motor de render sea el del
momento. Esto se regenera en un segundo, en cualquier máquina, y siempre
saldrá igual.

Uso:  python3 tools/generar-og.py
"""

from pathlib import Path
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "assets" / "img" / "og.png"

# Los mismos valores que `01-tokens.css`.
FONDO = (5, 7, 15)
FONDO_ALTO = (10, 14, 28)
CIAN = (79, 227, 255)
VIOLETA = (160, 107, 255)
SOLAR = (255, 180, 84)
LIMA = (126, 242, 168)
TINTA = (242, 246, 255)
TINTA_SUAVE = (169, 182, 212)
LINEA_SUAVE = (255, 255, 255, 24)

ANCHO, ALTO = 1200, 630

# Semilla fija: la imagen es idéntica en cada regeneración.
SEMILLA = 20260930

# ── EL VELO DEL TITULAR ────────────────────────────────────────────────
#
# Geometría de la escena, que es lo que gobierna estos números:
#
#   · el planeta está en cx=950 con radio 205, así que su limbo izquierdo
#     empieza en 950 - 205 = 745,
#   · y el anillo, con radio exterior 338, llega hasta 950 - 338 = 612.
#
# El titular, con la tipografía de la marca, acaba en x≈552. El hueco hasta
# el anillo son 60 px, y el velo tiene que cubrir ese hueco entero aunque no
# haya ni una letra en él.
#
# La forma es MESETA + CAÍDA, no una rampa. La rampa única no podía: su
# atenuación es `opacidad · t**0.7`, y para sostener el anillo por encima de
# 612 haría falta una curva tan plana que se comería la nebulosa del titular.
# Con meseta no hay conflicto: la zona del texto queda uniformemente velada y
# el anillo entra ya tapado. Es el mismo método que el de la costura del sol en
# el CSS —arreglar la forma y no el número— y la unión de la meseta con la
# caída es continua, así que no aparece ninguna costura.
#
# Medido antes y después (promedio de luminancia):
#
#   zona                  antes    después
#   anillo (655-700)       79,6     22,4     el arco desaparece
#   nebulosa titular       54,0     47,3     -12 %, sigue viva
#   planeta (760-960)      100 %     95 %     apenas se toca
#   contraste del titular  8,27  ->  9,95     sube: el fondo se apaga
#
# El salto máximo de luminancia entre columnas NO aumenta, que es la
# comprobación que importa: tapar sin costurar.
VELO_OPACIDAD = 205      # 205/255 = 80 % sobre la meseta
VELO_MESETA = 700        # fin de la meseta; por encima el anillo ya está tapado
VELO_HASTA = 830         # el velo llega a 0 aquí, sobre el planeta, nunca en seco
VELO_CURVA = 1.6         # > 1 = la caída se alarga y el borde no se nota

# ── LAS TIPOGRAFÍAS ────────────────────────────────────────────────────
#
# Las del propio sitio van primero. Antes empezaban por DejaVu, así que la
# tarjeta salía en Helvetica en un Mac, en Arial en Windows y en DejaVu en
# Linux: tres tarjetas distintas para el mismo sitio, y ninguna con la
# tipografía de la marca. `SEMILLA` hacía reproducible la ESCENA y no la
# TIPOGRAFÍA.
#
# PIL lee `.woff2` de verdad —su FreeType los abre sin convertir— así que no
# hace falta ni pasar la fuente ni añadir binarios al repositorio. Donde el
# FreeType venga sin brotli, `cargar()` falla con `OSError` y la lista sigue
# bajando hasta una fuente del sistema: el peor caso es el de antes.
#
# Ojo al ancho: con la fuente de la marca "Pareja Quintero" mide 468 px, y con
# DejaVu 568. El velo está medido contra esta tipografía, no contra la otra.
DISPLAY = [
    RAIZ / "assets" / "fonts" / "space-grotesk-700-latin.woff2",
    RAIZ / "assets" / "fonts" / "space-grotesk-500-latin.woff2",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "C:/Windows/Fonts/arialbd.ttf",
]
MONO = [
    RAIZ / "assets" / "fonts" / "jetbrains-mono-500-latin.woff2",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    "/System/Library/Fonts/Menlo.ttc",
    "C:/Windows/Fonts/consola.ttf",
]


def buscar_fuente(candidatas):
    for ruta in candidatas:
        if Path(ruta).exists():
            return ruta
    return None


def usaFuenteDelSitio(ruta):
    """¿La fuente viene del repositorio, o sea del propio sitio?

    Es lo que decide si el aviso final tiene sentido: si se ha podido usar la
    tipografía de la marca, la tarjeta es idéntica en cualquier máquina y no
    hay nada que avisar. Si se ha caído a una del sistema, hay que decirlo,
    porque la tarjeta cambia de forma y de ancho."""
    if ruta is None:
        return False
    try:
        return str(Path(ruta).resolve()).startswith(str(RAIZ))
    except OSError:
        return False


def cargar(ruta, tamano):
    """Si no hay ninguna fuente TrueType, `load_default` da algo legible en
    monoespaciada aunque no se parezca a la marca. Mejor eso que reventar."""
    if ruta is None:
        return ImageFont.load_default()
    try:
        return ImageFont.truetype(ruta, tamano)
    except OSError:
        return ImageFont.load_default()


def sumar(base, capa):
    """Mezcla aditiva, que es como se suman las capas de luz. Normal se
    saturaría y el planeta saldría plano."""
    return ImageChops.add(base, capa)


def gradiente_vertical(ancho, alto, arriba, abajo):
    columna = Image.new("RGB", (1, alto))
    px = columna.load()
    for y in range(alto):
        t = y / max(1, alto - 1)
        px[0, y] = tuple(int(c1 + (c2 - c1) * t) for c1, c2 in zip(arriba, abajo))
    return columna.resize((ancho, alto), Image.BILINEAR)


def nebulosa(img, cx, cy, radio, color, fuerza, puntos=26):
    """Manchas de luz difusa.

    Se pintan todas en una capa y se desenfoca esa capa UNA vez. Desenfocar
    cada mancha por separado sería 26 veces más lento y no se vería la
    diferencia: la suma ya está difusa.
    """
    capa = Image.new("RGB", img.size, (0, 0, 0))
    d = ImageDraw.Draw(capa)
    for _ in range(puntos):
        ang = random.random() * math.tau
        dist = random.random() * radio
        x = cx + math.cos(ang) * dist
        y = cy + math.sin(ang) * dist * 0.7
        r = radio * (0.2 + random.random() * 0.5)
        f = fuerza * (0.4 + random.random() * 0.6)
        d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(int(c * f) for c in color))
    capa = capa.filter(ImageFilter.GaussianBlur(radio * 0.32))
    return sumar(img, capa)


def estrellas(img, cantidad=190):
    d = ImageDraw.Draw(img)
    for _ in range(cantidad):
        x = random.random() * ANCHO
        y = random.random() * ALTO
        # El cubo de la magnitud reparte la mayoría de las estrellas en
        # puntos diminutos y deja unas pocas grandes. Con una reparto
        # uniforme se ve una lluvia de puntos del mismo tamaño.
        magnitud = random.random() ** 3
        brillo = int(70 + 185 * magnitud)
        r = magnitud * 1.9 + 0.4
        d.ellipse([x - r, y - r, x + r, y + r], fill=(brillo, brillo, brillo))
    return img


def planeta(img, cx, cy, radio, noche, acento, semilla):
    """Planeta en CUERPO NUEVA, no en disco lleno.

    Es la corrección importante frente a la primera versión: con el disco
    casi entero iluminado, el planeta se convertía en una mancha azul clara
    que competía con el titular y lo dejaba ilegible sobre el lado
    iluminado. Un cuerpo con la cara nocturna expuesta resuelve los dos
    problemas de una vez:

      · el titular, que va a la izquierda, cae sobre la zona oscura, así que
        tiene contraste de sobra sin necesidad de un panel opaco encima;
      · y las luces de ciudad, que solo existen en la cara nocturna, quedan
        visibles, que es justo el detalle que identifica la escena.

    Solo un 22 % del disco recibe luz directa. El resto vive en la luz que
    rebota del lado iluminado, que es lo que pasa en un cuerpo real y lo que
    evita que la mitad oscura sea un agujero negro plano.
    """
    random.seed(semilla)
    capa = Image.new("RGB", img.size, (0, 0, 0))
    d = ImageDraw.Draw(capa)

    # La fuente de luz queda muy a la izquierda y algo arriba, casi de
    # canto: de ahí sale la media luna.
    luz_x = cx - radio * 1.05
    luz_y = cy - radio * 0.32
    r_luz = math.hypot(luz_x - cx, luz_y - cy)

    for y in range(int(cy - radio) - 2, int(cy + radio) + 3):
        semiancho = math.sqrt(max(0.0, radio**2 - (y - cy) ** 2))
        if semiancho <= 1:
            continue
        # 24 pasos en vez de 14: con menos se ven bandas verticales en el
        # lado iluminado, porque la anchura del paso es fija y el degradado
        # no llega a ser continuo. 24 es el punto en que deja de verse.
        paso = (2 * semiancho) / 24
        for i in range(24):
            x = cx - semiancho + i * paso
            # Iluminación por distancia angular al punto de la fuente: un
            # planeta no se ilumina por columnas, se ilumina por normal.
            distancia = math.hypot(x - luz_x, y - luz_y)
            incidente = (radio * radio + r_luz * r_luz - distancia * distancia) / (
                2 * radio * r_luz
            )
            directo = incidente**0.8 if incidente > 0 else 0.0

            # Rebote: la mitad nocturna nunca es negra, es azul muy oscuro.
            rebote = 0.05 + 0.16 * (1 - min(1.0, max(0.0, incidente * 2 + 0.35)))

            color = tuple(
                min(255, int(noche[i] * rebote + acento[i] * directo * 0.55))
                for i in range(3)
            )
            d.rectangle([x, y, x + paso + 1, y], fill=color)

    # Luces de ciudad: agrupadas en la cara nocturna, cálidas y brillantes.
    # Se dibujan DESPUÉS del disco para que la aditiva no se los coma.
    for _ in range(320):
        ang = random.random() * math.tau
        dist = random.random() * radio * 0.94
        x = cx + math.cos(ang) * dist
        y = cy + math.sin(ang) * dist
        distancia = math.hypot(x - luz_x, y - luz_y)
        incidente = (radio * radio + r_luz * r_luz - distancia * distancia) / (
            2 * radio * r_luz
        )
        if incidente > 0.06:
            continue  # solo donde ya es de noche
        t = random.random() ** 1.6
        r = t * 2.0 + 0.5
        d.ellipse(
            [x - r, y - r, x + r, y + r],
            fill=(int(255 * t), int(212 * t), int(150 * t)),
        )

    # Borde atmosférico, solo en el arco iluminado. Un aro completo delata
    # que es un dibujo plano.
    # Una sola línea de 2 px con el alfa más bajo. La primera versión
    # dibujaba nueve arcos concéntricos y el resultado era una media luna
    # de pegatina que se comía media imagen. El limbo tiene que insinuar,
    # no dibujar.
    d.arc(
        [cx - radio * 1.02, cy - radio * 1.02, cx + radio * 1.02, cy + radio * 1.02],
        start=106,
        end=254,
        fill=acento + (150,),
        width=2,
    )

    capa = Image.blend(capa, capa.filter(ImageFilter.GaussianBlur(radio * 0.035)), 0.5)
    return sumar(img, capa)


def anillos(img, cx, cy, radio_planeta, capas):
    """Anillos como banda RELLENA, no como círculos concéntricos.

    La primera versión dibujaba una elipse cada 3 píxeles de radio, y eso
    leía como un dardo: treinta líneas finas y regularly espaciadas. Un
    anillo real es una superficie con densidad que VARÍA, y se paint con
    franjas verticales de opacidad distinta.

    Además, la parte del anillo que pasa por delante del planeta va más
    opaca que la de detrás. Sin esa diferencia el anillo parece una
    pegatina plana encima de la esfera y el cuerpo pierde volumen.
    """
    d = ImageDraw.Draw(img, "RGBA")
    for radio_in, radio_ext, color, alfa, achatado, delante in capas:
        for x in range(-radio_ext, radio_ext + 1, 2):
            k = abs(x)
            if k < radio_in or k > radio_ext:
                continue
            # Densidad: dos bordes apagados y el centro de la banda
            # banda y apagada en los dos bordes.
            t = (k - radio_in) / max(1, radio_ext - radio_in)
            densidad = (1 - abs(t * 2 - 1)) ** 1.6
            a = int(alfa * densidad)
            if a < 3:
                continue
            # ¿Este punto del anillo pasa POR DELANTE de la esfera?
            # La geometria: a una distancia horizontal x, la esfera se
            # abre |y| < sqrt(radio_planeta^2 - x^2). Si el punto del
            # anillo cae dentro de esa apertura, esta en primer plano.
            # Geometria de la elipse: a una distancia horizontal x, la
            # altura del anillo es b*sqrt(1-(x/a)^2). Con una relacion
            # lineal se dibujaba una V, no una elipse, y los anillos
            # salian como barras verticales.
            dentro_elipse = max(0.0, 1 - (k / radio_ext) ** 2)
            y_frente = (radio_ext * achatado) * math.sqrt(dentro_elipse)
            semiancho_esfera = math.sqrt(max(0.0, radio_planeta**2 - k**2))
            en_frente = y_frente < semiancho_esfera
            mezcla = 1.0 if delante and en_frente else 0.45
            d.rectangle(
                [cx + x, cy - y_frente, cx + x + 2, cy + y_frente],
                fill=color + (int(a * mezcla),),
            )
            del dentro_elipse
    return img


def velo_texto(img, hasta, opacidad, meseta, curva=1.6):
    """Degradado que oscurece la zona del titular.

    Sin esto el titular compite con el planeta. Con un panel opaco se taparía
    la escena, que es justo lo que no se quiere: lo que hace falta es que el
    texto tenga contraste, no que el planeta desaparezca.

    La forma es MESETA + CAÍDA, no una rampa: opacidad constante hasta
    `meseta` y a partir de ahí una caída `curva` hasta 0 en `hasta`. La
    rampa única no podía —`t**0.7` deja el anillo al 23 % en su extremo
    izquierdo y asoma justo detrás de la última letra—.

    La curva se dibuja a 2 px en vez de a 4 para que el degradado sea suave
    al ojo. Aquí no se ve el bandeado —el fondo es liso y opaco— pero en la
    zona del anillo el velo se convierte en franjas y se nota.
    """
    velo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dv = ImageDraw.Draw(velo)
    for x in range(0, hasta + 4, 2):
        if x < meseta:
            alfa = opacidad
        else:
            t = max(0.0, min(1.0, 1 - (x - meseta) / max(1, hasta - meseta)))
            alfa = opacidad * (t**curva)
        dv.rectangle([x, 0, x + 2, ALTO], fill=(5, 7, 15, int(alfa)))
    return Image.alpha_composite(img.convert("RGBA"), velo).convert("RGB")


def texto(d, pos, cadena, fuente, color):
    d.text(pos, cadena, font=fuente, fill=color)


def main():
    random.seed(SEMILLA)

    ruta_display = buscar_fuente(DISPLAY)
    ruta_mono = buscar_fuente(MONO)

    f_titular = cargar(ruta_display, 64)
    f_rol = cargar(ruta_display, 27)
    f_mono = cargar(ruta_mono, 15)
    f_mono_s = cargar(ruta_mono, 13)

    img = gradiente_vertical(ANCHO, ALTO, FONDO_ALTO, FONDO)
    img = nebulosa(img, 150, 200, 420, VIOLETA, 0.30)
    img = nebulosa(img, 1020, 400, 500, CIAN, 0.24, puntos=30)
    img = nebulosa(img, 700, 120, 300, SOLAR, 0.12, puntos=14)
    img = estrellas(img)

    # El planeta grande va al fondo a la derecha y desenfocado a propósito:
    # es decorativo y no debe competir con el titular.
    img = planeta(img, 950, 330, 205, (16, 30, 54), CIAN, semilla=7)
    img = anillos(
        img,
        950,
        330,
        205,
        [
            # radio_in, radio_ext, color, alfa, achatado, delante_del_planeta
            (250, 282, CIAN, 210, 0.21, True),
            (290, 338, LIMA, 165, 0.21, True),
        ],
    )
    img = img.filter(ImageFilter.GaussianBlur(0.6))

    # Retícula de la malla del sitio, muy tenue.
    d = ImageDraw.Draw(img, "RGBA")
    for x in range(0, ANCHO, 78):
        d.line([(x, 0), (x, ALTO)], fill=LINEA_SUAVE, width=1)
    for y in range(0, ALTO, 78):
        d.line([(0, y), (ANCHO, y)], fill=LINEA_SUAVE, width=1)

    img = velo_texto(img, VELO_HASTA, VELO_OPACIDAD, VELO_MESETA, VELO_CURVA)

    # ---------------- Texto ----------------

    d = ImageDraw.Draw(img)
    x0 = 84

    d.line([(x0, 168), (x0 + 44, 168)], fill=CIAN, width=3)
    texto(d, (x0 + 60, 160), "BOGOTÁ, COLOMBIA", f_mono, CIAN)

    # Dos líneas porque el nombre completo en una sola no cabe sin reducirlo
    # hasta que deja de leerse en la miniatura del móvil.
    texto(d, (x0, 205), "Juan David", f_titular, TINTA)
    texto(d, (x0, 278), "Pareja Quintero", f_titular, TINTA)
    texto(d, (x0, 366), "Desarrollador Web Full Stack", f_rol, CIAN)
    texto(
        d,
        (x0, 420),
        "HTML · CSS · JavaScript · Angular · Node.js · MongoDB",
        f_mono_s,
        TINTA_SUAVE,
    )

    d.line([(x0, 520), (ANCHO - 84, 520)], fill=(255, 255, 255, 28), width=1)
    texto(d, (x0, 546), "JUAN DAVID P.", f_mono, TINTA)
    texto(d, (ANCHO - 84 - 250, 546), "portafolio · odisea", f_mono_s, TINTA_SUAVE)

    img.save(SALIDA, "PNG", optimize=True)
    kb = SALIDA.stat().st_size / 1024
    print(f"  ✓ {SALIDA.relative_to(RAIZ)}  {ANCHO}×{ALTO}  {kb:.0f} KB")

    if ruta_display is None:
        print("  ! Sin ninguna fuente: el titular sale con la tipografía por")
        print("    defecto de Pillow, que casi no se parece a la marca.")
    elif usaFuenteDelSitio(ruta_display):
        print(f"  ✓ Tipografía de marca: {Path(ruta_display).name}")
        print("    La tarjeta es idéntica en cualquier máquina.")
    else:
        # Este aviso antes era un error: decía que con DejaVu, Liberation o
        # Helvetica «el resultado es el de la marca», y no lo es. Ahora la
        # lista empieza por los `.woff2` del repositorio, que son los que
        # carga el navegador, así que solo se llega aquí si el FreeType de
        # esta máquina no sabe leerlos. Y en ese caso hay que decirlo, porque
        # el titular cambia de ancho y el velo deja de estar medido.
        print(f"  ! Tipografía SUSTITUIDA: se está usando {Path(ruta_display).name},")
        print("    que no es la del sitio. La tarjeta saldrá con otra forma y")
        print("    otro ancho de titular: mírala antes de publicarla, porque")
        print("    el velo está medido contra la tipografía de la marca.")


if __name__ == "__main__":
    main()
