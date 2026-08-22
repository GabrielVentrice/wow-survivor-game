#!/usr/bin/env python3
"""Split a multi-figure reference sheet into one file per figure.

The sheet comes back from the image model as N figures side by side on flat
magenta. image2grid takes the bounding box of everything that is not background,
so it has to be handed one figure at a time. This cuts on the empty magenta
columns between them.
"""
import argparse, sys
from PIL import Image


def main():
    a = argparse.ArgumentParser()
    a.add_argument("image")
    a.add_argument("--names", required=True, help="comma-separated, one per figure, left to right")
    a.add_argument("--bg", default="#FF00FF")
    # Default sized for JPEG, because that is what an image model hands back.
    # At tol 6 the compression speckle on the magenta reads as subject and one
    # sheet came apart into 83 "figures" — the two real ones plus 81 specks.
    a.add_argument("--tol", type=float, default=20.0)
    a.add_argument("--min-width", type=float, default=2.0, dest="min_width",
                   help="descarta faixa mais estreita que X%% da imagem (ruido de compressao)")
    a.add_argument("--pad", type=int, default=8, help="magenta margin kept around each cut")
    a = a.parse_args()

    names = [n.strip() for n in a.names.split(",") if n.strip()]
    im = Image.open(a.image).convert("RGBA")
    px, (iw, ih) = im.load(), im.size
    br, bg_, bb = (int(a.bg[i:i + 2], 16) for i in (1, 3, 5))
    lim = a.tol * a.tol * 10

    def subject(x, y):
        r, g, b, al = px[x, y]
        return al > 128 and ((r - br) ** 2 + (g - bg_) ** 2 + (b - bb) ** 2) > lim

    cols = [any(subject(x, y) for y in range(ih)) for x in range(iw)]
    spans, start = [], None
    for x, on in enumerate(cols + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            spans.append((start, x - 1)); start = None

    floor = iw * a.min_width / 100.0
    spans = [(x0, x1) for x0, x1 in spans if x1 - x0 + 1 >= floor]

    # The CAST pose spreads both hands, and on a tight sheet the hands of two
    # neighbours overlap in X — there is no empty column left to cut on, and the
    # row comes back as one figure. The prompt asks for even spacing, so when
    # that happens the boundary is looked for where it is EXPECTED: the column
    # carrying the least ink inside a window around each even division. A hand
    # crossing the gap is a few pixels tall; a body is the whole figure.
    if len(spans) != len(names) and len(spans) == 1 and len(names) > 1:
        x0, x1 = spans[0]
        ink = [sum(1 for y in range(ih) if subject(x, y)) for x in range(x0, x1 + 1)]
        width = (x1 - x0 + 1) / len(names)
        cuts = []
        for k in range(1, len(names)):
            mid = round(k * width)
            lo, hi = max(1, mid - round(width * 0.22)), min(len(ink) - 1, mid + round(width * 0.22))
            cuts.append(x0 + min(range(lo, hi), key=lambda i: ink[i]))
        edges = [x0] + cuts + [x1 + 1]
        spans = [(edges[k], edges[k + 1] - 1) for k in range(len(names))]
        print(f"figuras encostadas: cortei nas colunas mais vazias {cuts}", file=sys.stderr)

    if len(spans) != len(names):
        sys.exit(f"achei {len(spans)} figuras, mas voce nomeou {len(names)}. "
                 f"Larguras: {[x1 - x0 + 1 for x0, x1 in spans]}. "
                 f"Se duas figuras se tocam, aumente o vao na folha; "
                 f"se uma virou duas, suba --tol.")

    for (x0, x1), name in zip(spans, names):
        rows = [y for y in range(ih) if any(subject(x, y) for x in range(x0, x1 + 1))]
        y0, y1 = rows[0], rows[-1]
        box = (max(0, x0 - a.pad), max(0, y0 - a.pad),
               min(iw, x1 + 1 + a.pad), min(ih, y1 + 1 + a.pad))
        out = f"{name}.png"
        im.crop(box).save(out)
        print(f"{out}  {box[2] - box[0]}x{box[3] - box[1]}  "
              f"aspecto {(x1 - x0 + 1) / (y1 - y0 + 1):.2f}")


main()
