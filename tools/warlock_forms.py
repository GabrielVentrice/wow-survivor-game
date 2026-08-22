#!/usr/bin/env python3
"""As dez formas do warlock — os ARGUMENTOS, e o prompt UNICO que as gera.

    python3 tools/warlock_forms.py                     # o prompt unico (as dez)
    python3 tools/warlock_forms.py --form colheita     # so uma, prompt avulso
    python3 tools/warlock_forms.py --silhouette        # a rodada de silhueta

Por que UM prompt e nao dez. Dez colagens sao dez conversas, e o modelo nao tem
como saber que a quarta pertence ao mesmo elenco da primeira: volta com outro
peso de contorno, outra proporcao de cabeca, outro jeito de fechar o manto. O
defeito nao aparece olhando um sprite por vez — aparece com os dez lado a lado,
que e exatamente como o jogador ve a progressao dele. O contrato de estilo e
escrito UMA vez e vale para as dez; so o corpo e a fatia da rampa mudam.

Nao cabe uma imagem so com as dez: sao 26 paineis, e cada figura sairia pequena
demais para ter detalhe que sobreviva ao downscale. Entao e um prompt, uma
imagem por forma, na mesma conversa — a consistencia vem do contexto, nao de
espremer todo mundo no mesmo quadro.

AURA NAO ENTRA NA REFERENCIA. Fogo em volta, alma verde, rastro de voo: isso e
VfxLayer no canvas, na cor da forma. Brilho pedido ao modelo vaza para fora da
silhueta e apaga a unica informacao que a imagem tinha para dar — onde a
criatura termina. Voo, esse sim, e POSE: a forma que flutua nao tem perna no
chao, e `findLegs` (js/sprites.js) cai sozinho no balanco em vez do passo.

ALTURA E CONTRATO. PIXEL_UNIT 3 e raio 16 obrigam step 1 para todo mundo, e dai
sai scale = 0.1875 x linhas. Largura e de graca: nao entra na conta do degrau.
"""
import argparse, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_sprite_prompt import palette, ramp_slice, MATERIAL, LIVING, INK, LABEL  # noqa: E402

IDLE = ("IDLE — standing still, weight even on both feet flat on the baseline, "
        "arms hanging low and held clear of the torso, hands open and visible")
FLOAT = ("FLOATING IDLE — floating, both feet clearly OFF the baseline and held together, "
         "legs closed inside the robe as one hanging mass, arms low and clear of the torso")
CAST = ("CAST — both arms raised in front of the chest and spread apart, palms turned "
        "outward, fingers open and separated, head up, torso leaning back a little. This "
        "is the gesture of PULLING power out, not of throwing a punch: elbows stay wide "
        "and the two hands stay far apart. The hands must not overlap the head or each other")

# slug, linhas, colunas, ramp, second, accent, ink, living, flutua, sujeito, unleash
FORMS = [
    ("aprendiz", 18, 12, "vio1", "meat0", "fel1", "deep", True, False,
     "a young human warlock apprentice: plain hooded robe, the human face still uncovered "
     "and visible under the hood, no horns, no demonic feature at all — this is the before",
     None),
    ("experiente", 19, 13, "vio1", "bone0", "fel1", "deep", True, False,
     "a veteran human warlock: the robe torn and fel-scorched at the hem, two short blunt "
     "bone horns just breaking through the brow, one forearm flayed down to the bone, the "
     "face still human but sunken",
     None),
    ("colheita", 20, 22, "rot1", "bone0", "fel2", "warm", False, False,
     "a plague-reaper warlock: the robe has rotted into hanging roots and thick vines, the "
     "ribcage is split wide open and hollow, a broad bone scythe blade is fused along the "
     "whole length of one forearm",
     "arms flung wide open and low, the split ribcage yawning fully open and facing the "
     "viewer, the root-hem of the robe fanned out flat"),
    ("tirania", 20, 20, "vio1", "gold0", "arc2", "deep", False, True,
     "a warlock tyrant: a heavy iron crown of thick spikes, enormous gilded pauldrons wider "
     "than the head, thick chains hanging from both wrists, no legs visible — the long robe "
     "closes into a single trailing mass",
     "one arm extended out to the side and down, hand open in a flat gesture of command, "
     "crown held high, both chains pulled taut and horizontal"),
    ("nihilam", 20, 20, "emb0", "stone0", "pyr2", "warm", False, False,
     "a warlock burned down to a cracked husk: half the skull exposed through the charred "
     "face, the torso split from throat to waist by a wide open fissure, both forearms are "
     "cooled slag with hard blocky edges",
     "both fists brought together in front of the chest, the torso fissure gaping at its "
     "widest, head thrown back"),
    ("ceifador", 20, 20, "vio1", "bone0", "fel1", "deep", False, False,
     "a gaunt towering warlock reaper: a deep hood with a bare skull face inside it, small "
     "imp skulls hung around the hem of the robe, very long thin arms ending in heavy "
     "hooked claws",
     "one long arm sweeping low across the front of the body, hood tipped down, the other "
     "hand open and turned upward in offering"),
    ("chamador", 20, 20, "emb0", "steel0", "pyr1", "warm", False, False,
     "a warlock bell-caller: a heavy cracked iron bell hanging on the chest as big as the "
     "head, a crown of blackened iron spikes, both arms are ember-lit charcoal with wide "
     "splits across them",
     "both arms raised gripping the bell by its rim, head bowed down into it, shoulders "
     "hunched up"),
    ("diabolista", 20, 22, "void1", "gold0", "arc1", "cold", False, True,
     "a scholarly warlock diabolist: a horned brass mask covering the whole face, a large "
     "flat brass seal disc floating behind the shoulders like a halo, thick rolled contract "
     "scrolls chained to the belt, no legs visible — the robe closes into a single trailing mass",
     "arms folded across the chest, the seal disc swung around to the FRONT of the body and "
     "centred on it, mask tilted up"),
    ("voraz", 20, 20, "meat0", "bone0", "fel1", "warm", False, False,
     "a bloated devourer warlock: the whole torso has split open into a vertical fanged maw "
     "running from collarbone to waist, the head's jaw hangs unhinged, both arms are long "
     "and grasping with oversized hands",
     "the torso maw gaping at its widest, both arms hauled back and outward, head thrown back"),
    ("enxame", 20, 22, "vio1", "bone0", "arc1", "deep", False, False,
     "a hollow warlock husk: chest and shoulders have split open into deep honeycomb hive "
     "cells, thick chitin plates strapped over both arms, a mantle of folded insect wings "
     "closed against the back",
     "the hive cells of chest and shoulders cracked wide open, arms spread low, the wing "
     "mantle unfurled to both sides"),
]


def wrap(text, width=78, indent="", hang=None):
    """Continuation lines indent deeper than the first: in a list of poses each
    of which is three lines long, a flush wrap makes the items stop looking like
    items and the model starts merging two of them into one instruction."""
    pad = indent if hang is None else hang
    out, line, first = [], indent, True
    for w in text.split():
        if len(line) + len(w) + 1 > width and line.strip():
            out.append(line.rstrip()); line = pad; first = False
        line += w + " "
    return "\n".join(out + [line.rstrip()])


def single(f, silhouette):
    slug, h, w, ramp, second, accent, ink, living, floats, subject, unleash = f
    g = [sys.executable, os.path.join(HERE, "make_sprite_prompt.py"),
         "--name", subject, "--grid", f"{w}x{h}", "--view", "front"]
    if silhouette:
        g += ["--silhouette", "--vary",
              "the outer contour, the distribution of mass and the stance ONLY — do not add "
              "a horn, a wing or any appendage the description did not ask for"]
    else:
        g += ["--ramp", ramp, "--second", second, "--accent", accent, "--ink", ink]
        if living:
            g.append("--living")
        for p in ([FLOAT if floats else IDLE, CAST] + ([unleash] if unleash else [])):
            g += ["--pose", p if p in (IDLE, FLOAT, CAST) else f"UNLEASH — {p}"]
    subprocess.run(g, check=True)


def master():
    pal = palette()
    tallest = max(f[1] for f in FORMS)
    thin = round(200.0 / tallest)

    blocks = []
    for i, f in enumerate(FORMS, 1):
        slug, h, w, ramp, second, accent, ink, living, floats, subject, unleash = f
        name_of = lambda fam: (LIVING.get(fam, MATERIAL[fam]) if living else MATERIAL[fam])
        lines = [f"  {INK[ink]:<8} {pal[INK[ink]]}   outline, and only the outline"]
        for tok in (ramp, second):
            fam, steps = ramp_slice(pal, tok, slug)
            lines += [f"  {t:<8} {pal[t]}   {LABEL[k]} of the {name_of(fam)}"
                      for k, t in enumerate(steps)]
        lines.append(f"  {accent:<8} {pal[accent]}   accent — eyes / runes / fire ONLY, "
                     "never a body surface")
        panels = ["FLOATING IDLE (see the poses above)" if floats else "IDLE (see the poses above)", "CAST (see the poses above)"]
        if unleash:
            panels.append("UNLEASH — " + unleash)
        pan = "\n".join(wrap(f"{k}. {p}", 76, "     ", "        ") for k, p in enumerate(panels, 1))
        blocks.append(
            f"""FORM {i} of 10 — "{slug}" — {len(panels)} panels — each body in a {w}:{h} box
{wrap("SUBJECT: " + subject, 78, "  ", "    ")}
  PALETTE for this form (and no other colours):
{chr(10).join(lines)}
  PANELS:
{pan}""")

    print(f"""I need TEN character reference sheets for one 2D game. They are ten forms of
the SAME character — a warlock, drawn at ten points of one progression — so they
have to look like one cast and not like ten separate drawings.

HOW WE WILL WORK: one image per form, ONE AT A TIME, in the order listed below.
Draw FORM 1 now and stop; I will say "next" and you draw FORM 2, and so on. The
CONTRACT below is identical for all ten and never changes between images. That
is the whole point of doing them in one conversation: same line weight, same
head-to-body proportion, same way a robe closes, same outline thickness. If a
later form comes back drawn in a different style, the set is broken.

Each image is a POSE SHEET: the panels listed under that form, side by side in
one row, left to right, of the SAME character — identical height, identical
build, identical costume, identical colours. ONLY the pose changes between
panels. Every panel shares one eye level and one foot baseline, with even
spacing and a clear band of empty background between figures so no two ever
touch. Anything that hangs loose — a robe hem, a chain, a wing, a tail — moves
WITH the pose; drawn identically in every panel it reads as a cut-out being
posed, not as a body moving.

================ THE CONTRACT — identical for all ten ================

These are references to be redrawn BY HAND afterwards as small pixel sprites.
This is NOT pixel art: do not simulate pixels, do not draw a pixel grid, do not
pixelate or posterize. Draw cleanly and large.

VIEW: orthographic front view, bilaterally symmetric about the vertical axis.
No perspective, no foreshortening, no tilt, no dynamic angle.

THE POSES, defined once (each form says which it uses):
  {wrap(IDLE, 76, "  ", "     ")[2:]}
  {wrap(FLOAT, 76, "  ", "     ")[2:]}
  {wrap(CAST, 76, "  ", "     ")[2:]}
  UNLEASH — only some forms have one, and each says what it is.
A form whose idle is FLOATING stays off the baseline in EVERY one of its
panels — floating is what that character is, not a pose it takes.

THE CHARACTER HOLDS NOTHING: no weapon, no tool, no staff, no banner, no
lantern. Empty hands, clearly drawn. Where a form has something fused to the
body or hanging from it, that is said in the form's own description — it is part
of the body, not held.

PROPORTION: chunky and exaggerated — head roughly one third of total height,
hands and horns oversized. Everything that must read has to survive being shrunk
to about {tallest} pixels tall. Fine detail is worse than no detail. NOTHING that must
read may be thinner than {thin}% of the figure's height: that is the two pixels it
gets at that size. A horn, a tusk, a claw or a tail drawn as a LINE comes back
as an antenna. Draw them as masses with real width.

RENDERING — this is the part that matters most:
- Flat cel shading with EXACTLY THREE values per material: shadow, base, light.
- Hard edges between the three values. No gradient, no airbrush, no soft
  blending, no noise, no texture, no cross-hatching.
- One single light source, from the TOP-LEFT, consistent across every figure of
  every one of the ten images.
- A THICK uniform dark outline around the whole silhouette and around each major
  part — thick enough to still be there after the drawing is reduced to a few
  dozen pixels. A hairline outline disappears in the downscale, and a figure
  with no outline dissolves into the background.
- At most 4 distinct materials in any one figure.
- Large unbroken shapes. No filigree, no small repeated ornament, no engraved
  detail smaller than one tenth of the body height.

PALETTE: each form lists its own colours and may use NO others. The outline
colour is the one named in that form's list, and it is used for the outline and
nothing else. The accent colour must stay TINY in AREA but be drawn LARGE and
simple — an eye ends up as a single pixel, so it has to be a bold clear shape
here or it vanishes entirely. If more than a seventh of a figure glows, it is
wrong. Bodies are never painted in the accent colour.

BACKGROUND: flat solid #FF00FF and nothing else. No floor, no ground shadow, no
horizon, no vignette, no scenery.

FRAMING: the ROW of bodies fills the frame. Full bodies, even margin on all four
sides of the row, and EACH body sits in its own box of the aspect ratio given
for that form, all boxes in one image the same size. Nothing cropped, nothing
reaching outside its box, nothing overlapping the next figure.

FORBIDDEN, in all ten: glow, bloom, light rays, lens flare, particles, sparks,
embers, smoke, dust, motion blur, depth of field, drop shadow, reflection,
ambient occlusion, film grain, chromatic aberration, text, labels, watermark,
signature, border, frame, panel borders, separator lines, numbering, captions,
a drawn ground line, colour swatches, turnaround sheets, and any change of
costume, size or colour between panels of one image.
The glow ban is not decoration policy: a glow bleeds past the silhouette and
destroys the one thing these drawings exist to record — where the body ends.

================ THE TEN FORMS ================

""" + "\n\n".join(blocks) + """


Start with FORM 1. Do not draw the others until I ask.""")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--form", metavar="SLUG", help="so uma forma, prompt avulso")
    ap.add_argument("--silhouette", action="store_true", help="a rodada de silhueta")
    a = ap.parse_args()
    if not a.form and not a.silhouette:
        return master()
    picked = [f for f in FORMS if not a.form or f[0] == a.form]
    if not picked:
        sys.exit(f"forma desconhecida: {a.form} (temos {', '.join(f[0] for f in FORMS)})")
    for f in picked:
        print(f"\n\n========== {f[0]}  ({f[2]}x{f[1]})  ==========\n")
        single(f, a.silhouette)


if __name__ == "__main__":
    main()
