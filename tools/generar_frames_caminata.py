#!/usr/bin/env python3
# Genera frames intermedios de caminata a partir de las poses existentes
# (dinamica.png / flotando.png) aplicando transformaciones suaves:
# rotación leve, balanceo vertical y squash horizontal.
#
# Uso: python3 tools/generar_frames_caminata.py [carpeta_outfit]
# Sin argumento, procesa todos los outfits en src/assets/avatar/*/

import sys
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent / "src" / "assets" / "avatar"

# Cada frame: (rotación en grados, desplazamiento vertical en %, squash horizontal)
FRAMES = [
    ( 0.0,  0.0, 1.00),  # neutro (equivale a dinamica)
    (-2.5, -2.5, 1.04),  # paso adelantado, se estira un pelín
    ( 0.0,  0.0, 1.00),
    ( 2.5,  1.5, 0.97),  # paso de apoyo, se achata un pelín
]

def generar_frame(base, rot, dy_pct, squash):
    """Devuelve la pose base rotada/desplazada/escalada como pide el frame."""
    w, h = base.size
    nueva_w = max(int(w * squash), 1)
    imagen = base.resize((nueva_w, h), Image.LANCZOS)
    # El lienzo se agranda para que la rotación no recorte bordes.
    lienzo = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    rotada = imagen.rotate(rot, resample=Image.BICUBIC, expand=True)
    dy = int(h * dy_pct / 100)
    x = (lienzo.width - rotada.width) // 2
    y = (lienzo.height - rotada.height) // 2 + dy
    lienzo.paste(rotada, (x, y), rotada)
    return lienzo

def procesar_carpeta(carpeta):
    base = carpeta / "dinamica.png"
    if not base.exists():
        base = carpeta / "flotando.png"
        if not base.exists():
            print(f"  {carpeta.name}: sin dinamica.png ni flotando.png, se salta.")
            return
    pose = Image.open(base).convert("RGBA")
    for i, (rot, dy, squash) in enumerate(FRAMES, start=1):
        destino = carpeta / f"caminar{i}.png"
        generar_frame(pose, rot, dy, squash).save(destino)
    print(f"  {carpeta.name}: {len(FRAMES)} frames -> caminarN.png")

if __name__ == "__main__":
    destinos = [RAIZ / sys.argv[1]] if len(sys.argv) > 1 else sorted(p for p in RAIZ.iterdir() if p.is_dir())
    for carpeta in destinos:
        if carpeta.is_dir():
            procesar_carpeta(carpeta)
