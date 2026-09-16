#!/usr/bin/env python3
"""Genera los iconos de la app a partir de la misma figura del favicon: el dial
visto de frente — dos anillos, la aguja arriba y el punto del 12.

Escribe PNG a mano (zlib + struct de la librería estándar), así que no depende
de Pillow ni de ImageMagick ni de nada instalado. Se ejecuta con:

    python3 tools/make-icons.py

Los tamaños salen de lo que piden las plataformas: 192 y 512 para el
manifiesto de Android, y 180 para el apple-touch-icon de iOS. El contenido se
queda dentro del 80% central para que el recorte en máscara (Android) no se
coma nada.
"""

import struct
import zlib

BG     = (0x0B, 0x10, 0x17)  # tinta, a sangre
RING1  = (0x6E, 0x82, 0x96)  # anillo exterior: relleno
RING2  = (0xE3, 0xA5, 0x3C)  # anillo interior: agudo
NEEDLE = (0xF3, 0xED, 0xE0)  # la aguja
ACCENT = (0xE0, 0x57, 0x4A)  # el punto del 12: grave

# fracciones del lado, para que escale a cualquier tamaño
R_OUT, R_IN = 0.300, 0.190
STROKE      = 0.016
R_DOT       = 0.046
HUB         = 0.030
NEEDLE_W    = 0.011
SS          = 3              # supermuestreo por eje (antialiasing)


def color_at(x, y):
    """Color de un punto en coordenadas normalizadas centradas en (0,0)."""
    import math
    r = math.hypot(x, y)
    # el punto del 12, arriba
    if math.hypot(x, y + R_OUT) <= R_DOT:
        return ACCENT
    # la aguja: franja vertical hacia arriba, del hub al anillo exterior
    if abs(x) <= NEEDLE_W and -R_OUT <= y <= -HUB:
        return NEEDLE
    if r <= HUB:
        return NEEDLE
    if abs(r - R_OUT) <= STROKE / 2:
        return RING1
    if abs(r - R_IN) <= STROKE / 2:
        return RING2
    return BG


def render(size):
    rows = []
    for py in range(size):
        row = []
        for px in range(size):
            acc = [0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    x = (px + (sx + 0.5) / SS) / size - 0.5
                    y = (py + (sy + 0.5) / SS) / size - 0.5
                    c = color_at(x, y)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            n = SS * SS
            row.append((acc[0] // n, acc[1] // n, acc[2] // n, 255))
        rows.append(row)
    return rows


def write_png(path, rows):
    size = len(rows)
    raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in rows)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # RGBA de 8 bits
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    return len(png)


if __name__ == "__main__":
    for size, path in [(192, "assets/icons/icon-192.png"),
                       (512, "assets/icons/icon-512.png"),
                       (180, "apple-touch-icon.png")]:
        n = write_png(path, render(size))
        print(f"{path}  {size}x{size}  {n} bytes")
