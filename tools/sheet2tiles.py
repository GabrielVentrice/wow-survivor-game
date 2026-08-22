#!/usr/bin/env python3
"""A generated sheet of floor slabs -> the grids of js/render/tiles.js.

The tile half of image2grid.py, and it is a different problem: a creature is
looked at once, a slab is looked at forty times on the same screen. What breaks
a floor is never the drawing, it is the repetition — so this does three things
the sprite converter does not:

  * HIGH-PASS per slab before quantising. The model paints one face lighter
    than the next; kept, that difference survives the downscale as a lit pad
    stamped across the floor. What has an edge survives, what is just a level
    does not.
  * accents by HUE, never by brightness. The stone here is violet-tinted and
    the joints are near-black violets with high saturation, so the rune is only
    separable by being violet AND saturated AND light at once.
  * a preview of the FIELD, not of the tile. A slab that looks good alone and
    tiles into a visible lattice is the whole failure mode, and it is invisible
    until the slabs are laid side by side.

    python3 tools/sheet2tiles.py folha.png tiles-rows.js zoom.png campo.png

O que ele imprime é primeiro passe, como no image2grid: o campo é para ser
olhado, e laje que vira carimbo se conserta na mão ou pedindo outra referência.
"""
import sys, colorsys
from PIL import Image
from collections import Counter

SRC = sys.argv[1]
N = 42
PAL = {"o": "#140c1e", "d": "#1a1028", "m": "#3a2456", "l": "#453840",
       "L": "#705c53", "e": "#4a9e2e", "E": "#7fdc4a", "f": "#6a28c8"}
# value cuts, as percentiles over the grey pixels of ALL slabs at once: one
# slab must not be re-levelled against itself or the eight stop being one floor
CUTS = [(0.20, "o"), (0.90, "d"), (0.985, "m"), (1.01, "l")]

im = Image.open(SRC).convert("RGB")
px, (iw, ih) = im.load(), im.size
def sub(x, y):
    r, g, b = px[x, y]
    if r > 200 and g < 80 and b > 200: return False
    # the jpeg halo around each slab is a saturated magenta that is not #ff00ff
    # any more; averaged into an edge cell it paints a pink rim on the floor
    h, sa, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return not (sa > 0.55 and v > 0.34 and (h > 0.80 or h < 0.05))

def spans(on):
    out, s = [], None
    for i, v in enumerate(list(on) + [False]):
        if v and s is None: s = i
        elif not v and s is not None: out.append((s, i - 1)); s = None
    return out

bands = spans([any(sub(x, y) for x in range(0, iw, 3)) for y in range(ih)])
boxes = []
for y0, y1 in bands:
    for x0, x1 in spans([any(sub(x, y) for y in range(y0, y1 + 1, 3)) for x in range(iw)]):
        boxes.append((x0, y0, x1, y1))
print(f"{len(bands)} faixas, {len(boxes)} lajes: {[(b[2]-b[0]+1, b[3]-b[1]+1) for b in boxes]}", file=sys.stderr)

def cells(box):
    x0, y0, x1, y1 = box
    w, h = x1 - x0 + 1, y1 - y0 + 1
    out = []
    for cy in range(N):
        row = []
        for cx in range(N):
            ax0, ax1 = x0 + cx * w // N, x0 + (cx + 1) * w // N
            ay0, ay1 = y0 + cy * h // N, y0 + (cy + 1) * h // N
            n = r = g = b = 0
            for y in range(ay0, max(ay0 + 1, ay1)):
                for x in range(ax0, max(ax0 + 1, ax1)):
                    if not sub(x, y): continue
                    p = px[x, y]; r += p[0]; g += p[1]; b += p[2]; n += 1
            row.append((r / n, g / n, b / n) if n else (18, 12, 30))
        out.append(row)
    return out

grids = [cells(b) for b in boxes]

# accents are found by hue, never by brightness: the fel vein is the brightest
# thing on the sheet and a pure luminance cut would hand it the stone highlight
def accent(c):
    r, g, b = (v / 255 for v in c)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if s > 0.25 and 0.20 < h < 0.45: return "E" if v > 0.45 else "e"
    # the stone itself is violet-tinted (h~0.83, s~0.2) and the joints are
    # near-black violets with high saturation, so the rune is only separable by
    # being violet AND saturated AND light at the same time
    if s > 0.42 and v > 0.30 and 0.66 < h < 0.80: return "f"
    return None

lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def quant(xs, q): return sorted(xs)[min(len(xs) - 1, int(q * len(xs)))]

# Every slab is HIGH-PASSED before any cut is made: a box blur of the slab is
# subtracted from it, so what survives is the joint, the crack and the grain,
# and what dies is how light the model happened to paint that face. Levelling
# slab against slab was not enough — the model drew a whole sub-slab a third
# lighter, and a plateau that big comes back as a lit pad repeated across the
# floor. A tile seen forty times per screen may carry structure; it may not
# carry a blotch.
R = 3
def highpass(gr):
    y = [[lum(c) for c in row] for row in gr]
    out = []
    for cy in range(N):
        line = []
        for cx in range(N):
            n = t = 0
            for by in range(max(0, cy - R), min(N, cy + R + 1)):
                for bx in range(max(0, cx - R), min(N, cx + R + 1)):
                    t += y[by][bx]; n += 1
            line.append(y[cy][cx] - t / n)
        out.append(line)
    return out

hp = [highpass(gr) for gr in grids]
base = quant([lum(c) for gr in grids for row in gr for c in row], 0.5)
allv = sorted(v + base for i, gr in enumerate(grids)
              for cy, row in enumerate(gr) for cx, c in enumerate(row)
              if not accent(c) for v in [hp[i][cy][cx]])

def tok(c, i, cy, cx):
    a = accent(c)
    if a: return a
    y = hp[i][cy][cx] + base
    k = sum(1 for v in allv if v < y) / len(allv)
    for q, t in CUTS:
        if k <= q: return t
    return "l"

rows_all, hist = [], Counter()
for i, gr in enumerate(grids):
    rows = ["".join(tok(c, i, cy, cx) for cx, c in enumerate(row))
            for cy, row in enumerate(gr)]
    rows_all.append(rows)
    for r in rows: hist.update(r)

tot = sum(hist.values())
print("  " + " | ".join(f"{k} {100*v/tot:.1f}%" for k, v in hist.most_common()), file=sys.stderr)
print(f"  energia (e/E/f): {100*(hist['e']+hist['E']+hist['f'])/tot:.1f}%", file=sys.stderr)

with open(sys.argv[2], "w") as fh:
    for i, rows in enumerate(rows_all):
        fh.write("  [\n")
        for r in rows: fh.write(f'    "{r}",\n')
        fh.write("  ],\n")

# preview: the eight zoomed, and a field the way the game lays them
Z, GAP = 6, 8
sheet = Image.new("RGB", (4 * (N * Z + GAP) + GAP, 2 * (N * Z + GAP) + GAP), (255, 0, 255))
for i, rows in enumerate(rows_all):
    ox, oy = GAP + (i % 4) * (N * Z + GAP), GAP + (i // 4) * (N * Z + GAP)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            h = PAL[ch]
            for dy in range(Z):
                for dx in range(Z):
                    sheet.putpixel((ox + x * Z + dx, oy + y * Z + dy),
                                   (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)))
sheet.save(sys.argv[3])

# a slab carrying a vein or a rune is a singular mark; uniform picking puts it
# on one cell in eight and the eye finds the pattern immediately
MARK = [i for i, rows in enumerate(rows_all) if any(ch in "eEf" for r in rows for ch in r)]
BAG = [i for i in range(len(rows_all)) if i not in MARK] * 5 + MARK
# eight slabs is eight stamps: the same speck lands on the same spot of every
# repeat and the eye finds the lattice. Mirroring is free (integer flip, no
# resampling) and turns eight into thirty-two.
def flip(rows, f):
    if f & 1: rows = [r[::-1] for r in rows]
    if f & 2: rows = rows[::-1]
    return rows
FW, FH, FZ = 9, 6, 3
field = Image.new("RGB", (FW * N * FZ, FH * N * FZ))
def hash2(x, y):
    h = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h ^ (h >> 16)) & 0xFFFFFFFF
for gy in range(FH):
    for gx in range(FW):
        h = hash2(gx, gy)
        rows = flip(rows_all[BAG[h % len(BAG)]], (h >> 8) & 3)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                h = PAL[ch]
                c = (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
                for dy in range(FZ):
                    for dx in range(FZ):
                        field.putpixel(((gx * N + x) * FZ + dx, (gy * N + y) * FZ + dy), c)
field.save(sys.argv[4])
