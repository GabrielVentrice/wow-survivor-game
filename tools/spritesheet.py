#!/usr/bin/env python3
"""Every sprite in the game, side by side, as a PNG.

sprites.html is the gallery a human opens. This is the one an agent can look
at — and it is the same need either way: a sprite is never wrong on its own,
it is wrong next to the other eighteen, and that is the comparison nobody
makes while adding one.

    python3 tools/spritesheet.py                       # tudo, zoom 6
    python3 tools/spritesheet.py --zoom 14 --only ghoul vilefiend
    python3 tools/spritesheet.py --out /tmp/sheet.png --cols 4

No dependency on purpose: PNG out is a zlib stream and a CRC, and this file
should keep working the day Pillow is not installed.
"""
import argparse, os, re, struct, sys, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AXIS = {"corruption": ("#4a9e2e", "#7fdc4a", "#a8f05c"),
        "dominion":   ("#6a28c8", "#9a4cff", "#c07aff"),
        "cataclysm":  ("#e0521a", "#ff8a3c", "#ffb54a")}
STEP = {"deep": 0, "base": 1, "light": 2}


def load():
    """Read SPRITE_DATA and PORTAL_GATE straight out of the source, resolving
    the PAL.<token> references. Parsing the js beats keeping a copy: a copy is
    a second source of truth for the one thing this file exists to compare."""
    src = open(os.path.join(ROOT, "js", "sprites.js")).read()
    i = src.index("const PAL = {")
    blk = src[i:src.index("\n};", i)]
    pal = dict(re.findall(r'(\w+): "(#[0-9a-fA-F]{6})"', blk))
    for k, fam, st in re.findall(r"(\w+): AXIS_PALETTE\.(\w+)\.(\w+)", blk):
        pal[k] = AXIS[fam][STEP[st]]

    def colours(text):
        out = dict(re.findall(r'(\w+): "(#[0-9a-fA-F]{6})"', text))
        out.update({k: pal[v] for k, v in re.findall(r"(\w+): PAL\.(\w+)", text) if v in pal})
        return out

    out = []
    body = src[src.index("const SPRITE_DATA = {"):src.index("\nfunction buildSprites")]
    for m in re.finditer(r"^  (\w+): \{\n(.*?)\n  \},", body, re.S | re.M):
        head = m.group(2)[:m.group(2).index("rows:")]
        rows = re.findall(r'"([^"]*)"', m.group(2)[m.group(2).index("rows:"):])
        out.append((m.group(1), colours(head), rows))
    g = re.search(r"const PORTAL_GATE = \{\n(.*?)\n\};", src, re.S)
    if g:
        b = g.group(1)
        out.append(("PORTAL_GATE", colours(b[:b.index("rows:")]),
                    re.findall(r'"([^"]*)"', b[b.index("rows:"):])))
    return out


def png(path, w, h, px):
    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes(px[y]) for y in range(h))
    open(path, "wb").write(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "tools", "spritesheet.png"))
    ap.add_argument("--zoom", type=int, default=6)
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--only", nargs="*", default=None, help="ids a mostrar (default: todos)")
    ap.add_argument("--bg", default="#181420", help="fundo; use um tom de jogo, nao branco")
    a = ap.parse_args()

    sprites = load()
    if a.only:
        by = {n: s for s in sprites for n in [s[0]]}
        miss = [n for n in a.only if n not in by]
        if miss:
            sys.exit(f"nao existe em SPRITE_DATA: {', '.join(miss)}")
        sprites = [by[n] for n in a.only]
    if not sprites:
        sys.exit("nenhum sprite")

    Z, cols, pad = a.zoom, min(a.cols, len(sprites)), 8
    bg = tuple(int(a.bg[i:i + 2], 16) for i in (1, 3, 5))
    cw = max(max(len(r) for r in rows) for _, _, rows in sprites) + pad
    ch = max(len(rows) for _, _, rows in sprites) + pad
    rowsN = (len(sprites) + cols - 1) // cols
    W, H = cw * cols * Z, ch * rowsN * Z
    px = [bytearray(bg * W) for _ in range(H)]

    for idx, (name, pal, rows) in enumerate(sprites):
        gx, gy = (idx % cols) * cw, (idx // cols) * ch
        ox = gx + (cw - max(len(r) for r in rows)) // 2
        oy = gy + (ch - len(rows)) // 2
        for r, row in enumerate(rows):
            for c, chx in enumerate(row):
                if chx in ". " or chx not in pal:
                    continue
                v = bytes(int(pal[chx][i:i + 2], 16) for i in (1, 3, 5))
                for dy in range(Z):
                    line, base = px[(oy + r) * Z + dy], (ox + c) * Z * 3
                    for dx in range(Z):
                        line[base + dx * 3: base + dx * 3 + 3] = v

    png(a.out, W, H, px)
    # The source path is printed on purpose: this script resolves js/sprites.js
    # from its own location, so running the copy in the main clone while editing
    # a worktree renders the OLD art and says nothing. That is a silent wrong
    # answer, and it cost a round.
    print(f"{a.out}  {W}x{H}  {len(sprites)} sprites: {', '.join(n for n, _, _ in sprites)}")
    print(f"        lido de {os.path.join(ROOT, 'js', 'sprites.js')}")


if __name__ == "__main__":
    main()
