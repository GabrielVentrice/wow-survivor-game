#!/usr/bin/env python3
"""A generated reference image -> a first-pass sprite grid, snapped to the PAL.

This is the other half of make_sprite_prompt.py. It is deliberately a FIRST
PASS and not a converter: no downscale of a drawing to sixteen pixels produces
a finished sprite, because at that size every pixel is a decision and averaging
is the opposite of deciding. What it does is the mechanical part — background
out, bounding box, one dominant colour per cell, snapped to the small set of
tokens this creature is allowed — so the hand work starts from a shape instead
of from an empty grid.

    python3 tools/image2grid.py ghoul.png --grid 14x16 --ramp rot0 --ink warm \
        --second bone0 --accent blood1

Anything it prints is meant to be argued with. The eyes will be in the wrong
place, thin limbs will break, and symmetry will be off by a pixel — those are
exactly the things a human fixes and a mean does not.
"""
import argparse, re, os, sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    sys.exit("precisa do Pillow: python3 -m pip install --user Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
AXIS = {"corruption": ("#4a9e2e", "#7fdc4a", "#a8f05c"),
        "dominion":   ("#6a28c8", "#9a4cff", "#c07aff"),
        "cataclysm":  ("#e0521a", "#ff8a3c", "#ffb54a")}
STEP = {"deep": 0, "base": 1, "light": 2}
INK = {"cold": "inkCold", "deep": "inkDeep", "warm": "inkWarm"}
# the shared char vocabulary, in the order roles are handed out
ROLE = {"ink": "o", "ramp": "dml", "second": "DML", "accent": "eEfF"}


def palette():
    src = open(os.path.join(ROOT, "js", "sprites.js")).read()
    i = src.index("const PAL = {")
    blk = src[i:src.index("\n};", i)]
    pal = dict(re.findall(r'(\w+): "(#[0-9a-fA-F]{6})"', blk))
    for k, fam, st in re.findall(r"(\w+): AXIS_PALETTE\.(\w+)\.(\w+)", blk):
        pal[k] = AXIS[fam][STEP[st]]
    return pal


rgb = lambda h: (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def dist(a, b):
    # weighted so the snap follows perceived brightness, not raw channel sum:
    # green carries most of the luminance and a plain Euclidean distance sends
    # mid greys to whichever token happens to be closest in blue.
    dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return 2.1 * dr * dr + 7.2 * dg * dg + 0.7 * db * db


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--grid", default="16x16")
    ap.add_argument("--ramp", default="vio0")
    ap.add_argument("--second", default=None)
    ap.add_argument("--ink", default="deep", choices=sorted(INK))
    ap.add_argument("--accent", nargs="*", default=[])
    ap.add_argument("--bg", default="#ff00ff", help="background colour to key out")
    ap.add_argument("--tol", type=int, default=60, help="how far from --bg still counts as background")
    ap.add_argument("--fill", type=float, default=0.42,
                    help="share of a cell that must be subject for the cell to be solid")
    a = ap.parse_args()

    pal = palette()
    W, H = (int(v) for v in a.grid.lower().split("x"))

    def slice3(tok, what):
        m = re.match(r"^([a-z]+)(\d)$", tok or "")
        if not m:
            sys.exit(f"{what}: '{tok}' nao e um passo de rampa")
        fam, i = m.group(1), int(m.group(2))
        steps = [f"{fam}{i + k}" for k in range(3)]
        if any(t not in pal for t in steps):
            sys.exit(f"{what}: {fam} nao tem tres passos a partir de {tok}")
        return steps

    # The allowed set is the whole point. Snapping to all 47 colours turns a
    # drawing into confetti: a shaded green belly finds a violet and a gold
    # within a few units of each other and picks whichever wins by rounding.
    allow = {}                                   # token -> char
    allow[INK[a.ink]] = ROLE["ink"]
    for i, t in enumerate(slice3(a.ramp, "--ramp")):
        allow[t] = ROLE["ramp"][i]
    if a.second:
        for i, t in enumerate(slice3(a.second, "--second")):
            allow[t] = ROLE["second"][i]
    for i, t in enumerate(a.accent):
        if t not in pal:
            sys.exit(f"--accent: '{t}' nao esta na PAL")
        if i >= len(ROLE["accent"]):
            sys.exit("no maximo 4 acentos")
        allow[t] = ROLE["accent"][i]
    tokens = [(t, rgb(pal[t])) for t in allow]

    im = Image.open(a.image).convert("RGBA")
    bg = rgb(a.bg)
    px = im.load()
    iw, ih = im.size

    def subject(x, y):
        r, g, b, al = px[x, y]
        return al > 128 and dist((r, g, b), bg) > a.tol * a.tol * 10

    # bounding box of the figure, so framing in the reference does not decide
    # how big the creature comes out
    xs = [x for x in range(iw) if any(subject(x, y) for y in range(ih))]
    ys = [y for y in range(ih) if any(subject(x, y) for x in range(iw))]
    if not xs or not ys:
        sys.exit("nada sobrou depois de tirar o fundo — confira --bg / --tol")
    x0, x1, y0, y1 = xs[0], xs[-1], ys[0], ys[-1]
    bw, bh = x1 - x0 + 1, y1 - y0 + 1

    rows, hist = [], Counter()
    for cy in range(H):
        line = ""
        for cx in range(W):
            sx0 = x0 + cx * bw // W; sx1 = max(sx0 + 1, x0 + (cx + 1) * bw // W)
            sy0 = y0 + cy * bh // H; sy1 = max(sy0 + 1, y0 + (cy + 1) * bh // H)
            hit, votes = 0, Counter()
            for y in range(sy0, min(sy1, ih)):
                for x in range(sx0, min(sx1, iw)):
                    if not subject(x, y):
                        continue
                    hit += 1
                    r, g, b, _ = px[x, y]
                    # vote for a TOKEN, never average: a mean of two ramp steps
                    # is a colour the palette does not contain
                    votes[min(tokens, key=lambda t: dist((r, g, b), t[1]))[0]] += 1
            total = (min(sy1, ih) - sy0) * (min(sx1, iw) - sx0)
            if not total or hit / total < a.fill or not votes:
                line += "."
            else:
                tok = votes.most_common(1)[0][0]
                line += allow[tok]; hist[tok] += 1
        rows.append(line)

    keys = sorted(allow, key=lambda t: "o dmlDMLeEfF".find(allow[t]))
    print("  " + ", ".join(f"{allow[t]}: PAL.{t}" for t in keys))
    print("  rows: [")
    for r in rows:
        print(f'    "{r}",')
    print("  ],")
    solid = sum(hist.values())
    energy = sum(n for t, n in hist.items() if allow[t] in ROLE["accent"])
    print(f"\n// {solid} pixels solidos de {W*H}"
          f" | energia {100*energy/solid:.0f}% (teto 14%)" if solid else "// grid vazio", file=sys.stderr)
    for t in allow:
        if t not in hist:
            print(f"// {t} nao apareceu — o desenho nao usou essa cor", file=sys.stderr)


if __name__ == "__main__":
    main()
