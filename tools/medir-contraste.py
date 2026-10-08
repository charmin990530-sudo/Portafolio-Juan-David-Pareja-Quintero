#!/usr/bin/env python3
"""
tools/medir-contraste.py — Contraste REAL del texto sobre la escena 3D.

    python3 tools/medir-contraste.py ".hero__resumen,.hero__chips" 0,60,120
    python3 tools/medir-contraste.py ".perfil__bio p" 2300,2500 --nivel alto

Por qué existe: los números del CSS (scrims al 84-88 %, velos al 40 %) se
pusieron "por si acaso" y acabaron tapando el universo. Aquí se mide lo que de
verdad hay detrás del texto, en píxeles, a una posición de scroll concreta.

Cómo mide
  1. Posiciona el scroll y deja que la cámara se asiente.
  2. Guarda dónde está cada elemento y de qué color es su texto.
  3. Borra SOLO el color del texto (se conservan fondos, pastillas y scrims) y
     captura la pantalla: eso es el fondo real.
  4. En la caja de cada elemento toma el percentil 98 de luminancia, o sea el
     peor caso razonable (no un píxel suelto), y calcula la razón WCAG.

Umbrales: texto normal 4,5 · texto grande (>= 24 px o 19 px en negrita) 3,0.

Límites conocidos
  · Texto con degradado (`background-clip: text`, p. ej. `.hero__rol`) sale como
    1,0: al borrar el color queda transparente el propio degradado. Medirlo con
    otro método o ignorarlo.
  · No tiene en cuenta la opacidad del elemento: a mitad de un desvanecido el
    contraste real es menor que el medido.
  · GPU de software: los fotogramas llegan lentos; las posiciones de scroll se
    esperan 3,5 s. Si dudas de una cifra, repite con --espera 6.

Necesita: pip install playwright pillow  y  playwright install chromium
"""
import argparse, io, json, re, socket, subprocess, sys, time, warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=DeprecationWarning)
try:
    from playwright.sync_api import sync_playwright
    from PIL import Image
except ImportError:
    sys.exit("Falta playwright/pillow: pip install playwright pillow && playwright install chromium")

RAIZ = Path(__file__).resolve().parent.parent


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(rgb):
    r, g, b = rgb[:3]
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def razon(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def puerto_libre():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("selectores", help="selectores CSS separados por coma")
    ap.add_argument("scroll", help="posiciones de scroll en px separadas por coma, p. ej. 0,60,120")
    ap.add_argument("--nivel", default="alto", help="auto|alto|medio|bajo (por defecto alto)")
    ap.add_argument("--ancho", type=int, default=1440)
    ap.add_argument("--alto", type=int, default=900)
    ap.add_argument("--espera", type=float, default=3.5, help="segundos de espera por posición")
    ap.add_argument("--minimo", type=float, default=4.5, help="umbral para marcar fallo (texto normal)")
    a = ap.parse_args()

    puerto = puerto_libre()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(puerto), "--bind", "127.0.0.1"],
                           cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    peor = {}
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                         "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            pg = br.new_page(viewport={"width": a.ancho, "height": a.alto})
            pg.goto(f"http://127.0.0.1:{puerto}/", wait_until="load")
            pg.wait_for_timeout(4000)
            if a.nivel != "auto":
                with pg.expect_navigation(wait_until="load", timeout=20000):
                    pg.select_option("#calidad-selector", a.nivel)
                pg.wait_for_timeout(4000)
            sels = [s.strip() for s in a.selectores.split(",") if s.strip()]
            for y in [int(v) for v in a.scroll.split(",")]:
                pg.evaluate(f"window.scrollTo(0,{y})")
                pg.wait_for_timeout(int(a.espera * 1000))
                datos = pg.evaluate("""(sels) => sels.flatMap(s => [...document.querySelectorAll(s)].map((e, i) => {
                    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
                    return {n: s + (document.querySelectorAll(s).length > 1 ? ' #' + i : ''), x: r.x, y: r.y,
                            w: r.width, h: r.height, c: cs.color, fs: parseFloat(cs.fontSize), fw: +cs.fontWeight};
                }))""", sels)
                pg.add_style_tag(content="*{color:transparent!important;text-shadow:none!important;"
                                         "-webkit-text-fill-color:transparent!important}")
                pg.wait_for_timeout(900)
                fondo = Image.open(io.BytesIO(pg.screenshot())).convert("RGB")
                pg.evaluate("[...document.querySelectorAll('style')].pop().remove()")
                for d in datos:
                    x0, y0 = max(0, int(d["x"])), max(0, int(d["y"]))
                    x1, y1 = min(a.ancho, int(d["x"] + d["w"])), min(a.alto, int(d["y"] + d["h"]))
                    if x1 - x0 < 4 or y1 - y0 < 4 or y1 <= 70:  # fuera de pantalla o bajo la cabecera
                        continue
                    px = sorted(fondo.crop((x0, y0, x1, y1)).getdata(), key=lum, reverse=True)
                    claro = px[int(len(px) * 0.02)]
                    col = [float(v) for v in re.findall(r"[\d.]+", d["c"])[:3]]
                    r_ = razon(col, claro)
                    grande = d["fs"] >= 24 or (d["fs"] >= 18.66 and d["fw"] >= 700)
                    umbral = 3.0 if grande else a.minimo
                    k = d["n"]
                    if k not in peor or r_ < peor[k][0]:
                        peor[k] = (round(r_, 2), y, umbral)
            br.close()
    finally:
        srv.terminate()

    fallos = 0
    print(f"{'elemento':36} {'peor':>6}  {'a scroll':>8}  mínimo")
    for k, (r_, y, umbral) in peor.items():
        marca = "✓" if r_ >= umbral else "✗"
        fallos += r_ < umbral
        print(f"{marca} {k[:34]:34} {r_:>6}  {y:>8}  {umbral}")
    if not peor:
        print("No se midió nada: ¿el selector existe y está en pantalla a esas posiciones?")
        sys.exit(2)
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
