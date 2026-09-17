#!/usr/bin/env python3
# Chroma-key de las fotos de AIRA: quita el fondo verde y genera PNGs
# con transparencia (misma carpeta, extension .png).
# Uso: python3 tools/chroma_key_avatar.py
import os
from PIL import Image

RAIZ = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "avatar")

def procesar(ruta):
    img = Image.open(ruta).convert("RGB")
    px = img.load()
    w, h = img.size
    out = Image.new("RGBA", (w, h))
    po = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            dom = max(0, g - max(r, b))
            if dom > 40 and g > 70:
                alpha = 0  # fondo verde claro: fuera
            elif dom > 12:
                # borde / sombra verde: semi-transparente
                alpha = max(0, 255 - int((dom - 12) * (255 / 28)))
            else:
                alpha = 255
            if alpha < 255:
                # despill: neutralizar el verde que queda en el sujeto
                exceso = max(0, g - max(r, b)) // 2
                g = min(255, g - exceso)
            po[x, y] = (r, g, b, alpha)
    destino = os.path.splitext(ruta)[0] + ".png"
    out.save(destino)
    return destino

total = 0
for raiz, _dirs, archivos in os.walk(RAIZ):
    for a in archivos:
        if a.lower().endswith(".jpg"):
            d = procesar(os.path.join(raiz, a))
            print("OK", os.path.relpath(d, RAIZ))
            total += 1
print(f"--- {total} imagenes procesadas ---")
