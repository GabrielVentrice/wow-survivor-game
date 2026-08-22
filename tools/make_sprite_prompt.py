#!/usr/bin/env python3
"""Emit the image-generation prompt for one sprite, with the LIVE palette in it.

Generated rather than kept as a static file for one reason: a prompt with a
stale palette is worse than no prompt at all. It would quietly ask for colours
the game does not have, and the drift would only surface as a sprite that looks
almost right next to the others. PAL is read out of js/sprites.js every run.

    python3 tools/make_sprite_prompt.py --name "a rotting gravedigger ghoul" \
        --grid 14x16 --view front --ramp rot --ink warm --accent blood1 bone1

    python3 tools/make_sprite_prompt.py --silhouette --name "..." --grid 20x16
"""
import argparse, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AXIS = {"corruption": ("#4a9e2e", "#7fdc4a", "#a8f05c"),
        "dominion":   ("#6a28c8", "#9a4cff", "#c07aff"),
        "cataclysm":  ("#e0521a", "#ff8a3c", "#ffb54a")}
STEP = {"deep": 0, "base": 1, "light": 2}

MATERIAL = {
    "bone": "bone, horn, teeth", "steel": "steel, plate, blade",
    "stone": "rock, masonry", "meat": "pale dead flesh, stitched skin",
    "rot": "rotting green flesh", "vio": "violet demon hide, dark cloth",
    "emb": "rust-orange demon hide, scorched skin", "gold": "gilded hide, brass",
    "void": "cold blue void-flesh",
}
INK = {"cold": "inkCold", "deep": "inkDeep", "warm": "inkWarm"}
# The same ramp is a corpse on an abomination and a face on the apprentice. The
# hexes do not change; the words handed to the model do, and "pale dead flesh"
# on a living human is the model being told to draw the wrong thing.
LIVING = {"meat": "living human skin", "bone": "horn and tooth"}


def palette():
    src = open(os.path.join(ROOT, "js", "sprites.js")).read()
    i = src.index("const PAL = {")
    blk = src[i:src.index("\n};", i)]
    pal = dict(re.findall(r'(\w+): "(#[0-9a-fA-F]{6})"', blk))
    for k, fam, st in re.findall(r"(\w+): AXIS_PALETTE\.(\w+)\.(\w+)", blk):
        pal[k] = AXIS[fam][STEP[st]]
    return pal


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help="what the creature IS, in a few words")
    ap.add_argument("--grid", default="16x16", help="target grid, WxH (e.g. 20x16)")
    ap.add_argument("--view", default="front", choices=["front", "side"])
    ap.add_argument("--ramp", default="vio0", metavar="TOKEN",
                    help="first step of the body ramp; three consecutive steps are used (e.g. rot1)")
    ap.add_argument("--second", metavar="TOKEN", default=None,
                    help="first step of a second material ramp (armour, a wing, a shell)")
    ap.add_argument("--ink", default="deep", choices=sorted(INK))
    ap.add_argument("--accent", nargs="*", default=[], help="energy PAL tokens for eyes/runes/fire")
    ap.add_argument("--materials", type=int, default=4, help="distinct materials allowed")
    ap.add_argument("--living", action="store_true",
                    help="a criatura esta VIVA: renomeia os materiais que descrevem cadaver")
    ap.add_argument("--vary", default=None,
                    help="o que deve variar entre as silhuetas (default: contorno generico)")
    ap.add_argument("--silhouette", action="store_true", help="emit the step-0 silhouette prompt")
    a = ap.parse_args()

    pal = palette()
    W, H = (int(v) for v in a.grid.lower().split("x"))
    def slice3(tok, what):
        """Three consecutive steps of one ramp. The slice IS the identity: two
        creatures of the same material differ by which three they take."""
        m = re.match(r"^([a-z]+)(\d)$", tok or "")
        if not m or m.group(1) not in MATERIAL:
            sys.exit(f"{what}: '{tok}' nao e um passo de rampa de materia ({', '.join(sorted(MATERIAL))})")
        fam, i = m.group(1), int(m.group(2))
        steps = [f"{fam}{i + k}" for k in range(3)]
        missing = [t for t in steps if t not in pal]
        if missing:
            top = max(int(re.search(r"(\d)$", t).group(1)) for t in pal if t.startswith(fam) and re.match(rf"^{fam}\d$", t))
            sys.exit(f"{what}: a rampa {fam} vai ate {fam}{top}, entao a fatia so comeca ate {fam}{top - 2}")
        return fam, steps

    ENERGY = re.compile(r"^(fel|arc|pyr|blood|azure)\d$|^white$")
    bad = [t for t in a.accent if t not in pal]
    if bad:
        sys.exit(f"tokens fora da PAL: {', '.join(bad)}")
    # An accent is ENERGY. Bone and steel are materials — passing one here would
    # tell the model to keep it tiny, and the claws would come back as specks.
    notE = [t for t in a.accent if not ENERGY.match(t)]
    if notE:
        sys.exit(f"--accent e so para cor de energia; {', '.join(notE)} e materia — use --second")

    sym = ("bilaterally symmetric about the vertical axis"
           if a.view == "front" else "in pure profile, facing right, no three-quarter turn")

    if a.silhouette:
        print(f"""Six SILHOUETTE studies of the same character, laid out in one row.

SUBJECT: {a.name}.
Each study is a SOLID BLACK shape on a flat #FF00FF background — no interior
detail, no outline, no grey, no gradient. Only the outer contour differs
between the six.
VIEW: orthographic {a.view} view, {sym}.
No perspective, no tilt.
PROPORTION: chunky and exaggerated. It has to stay recognisable at {H} pixels tall.
Vary the reading: {a.vary or "outer contour, mass distribution, stance and proportion"}.
FRAMING: full body, feet on a common baseline, even spacing, generous margin.

FORBIDDEN: colour, shading, texture, outline, glow, shadow on the ground, text,
labels, numbers, borders, frames, watermark, cropped limbs.""")
        return

    fam, steps = slice3(a.ramp, "--ramp")
    LABEL = ["shadow", "base", "light"]
    ink = INK[a.ink]
    name_of = lambda f: (LIVING.get(f, MATERIAL[f]) if a.living else MATERIAL[f])
    ramp_txt = "\n".join(f"  {t:<8} {pal[t]}   {LABEL[i]} of the {name_of(fam)}"
                         for i, t in enumerate(steps))
    if a.second:
        fam2, steps2 = slice3(a.second, "--second")
        ramp_txt += "\n" + "\n".join(f"  {t:<8} {pal[t]}   {LABEL[i]} of the {name_of(fam2)}"
                                      for i, t in enumerate(steps2))
    acc_txt = "\n".join(f"  {t:<8} {pal[t]}   accent — eyes / runes / fire ONLY, never a body surface"
                        for t in a.accent) or "  (none — this creature has no glowing part)"

    print(f"""Character reference sheet for a 2D game, to be redrawn BY HAND afterwards as a
{W}x{H} pixel sprite. This is NOT pixel art: do not simulate pixels, do not draw
a pixel grid, do not pixelate or posterize the image. Draw it cleanly and large.

SUBJECT: {a.name}.

VIEW: orthographic {a.view} view, {sym}.
No perspective, no foreshortening, no tilt, no dynamic angle. One single figure.

POSE: neutral idle, standing, weight even, arms readable and clear of the torso
so the silhouette does not merge. Feet flat on an implied ground line.

PROPORTION: chunky and exaggerated — head roughly one third of total height,
hands, horns and weapon oversized. Everything that must read has to survive
being shrunk to {H} pixels tall. Fine detail is worse than no detail.

RENDERING — this is the part that matters most:
- Flat cel shading with EXACTLY THREE values per material: shadow, base, light.
- Hard edges between the three values. No gradient, no airbrush, no soft
  blending, no noise, no texture, no cross-hatching.
- One single light source, from the TOP-LEFT, consistent across the whole figure.
- A THICK uniform dark outline around the whole silhouette and around each
  major part — thick enough to still be there after the drawing is reduced to
  a few dozen pixels. A hairline outline disappears in the downscale, and a
  figure with no outline dissolves into the background.
- At most {a.materials} distinct materials in the whole figure.
- Large unbroken shapes. No filigree, no small repeated ornament, no engraved
  detail smaller than one tenth of the body height.

PALETTE — use these colours and no others:
  {ink:<8} {pal[ink]}   outline, and only the outline
{ramp_txt}
{acc_txt}
The accent colours must stay TINY in AREA but drawn LARGE and simple — an eye
ends up as a single pixel, so it has to be a bold clear shape here or it
vanishes entirely when the drawing is reduced. If more than a seventh of the
figure glows, it is wrong.

BACKGROUND: flat solid #FF00FF and nothing else. No floor, no ground shadow, no
horizon, no vignette, no scenery, no props the character is not holding.

FRAMING: full body, centred, even margin on all four sides, roughly {W}:{H}
aspect ratio. Nothing cropped.

FORBIDDEN: glow, bloom, light rays, lens flare, particles, sparks, embers,
smoke, dust, motion blur, depth of field, drop shadow, reflection, ambient
occlusion, film grain, chromatic aberration, text, labels, watermark,
signature, border, frame, multiple views, turnaround sheet, colour swatches.""")


if __name__ == "__main__":
    main()
