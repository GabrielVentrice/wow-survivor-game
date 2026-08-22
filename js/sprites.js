"use strict";
/* =========================================================================
   ASSETS — pixel-art e helpers de desenho gerados em runtime. Zero arquivo
   externo: sprites saem de grids ASCII, o chao e um tile procedural.
   ========================================================================= */

let SPRITES = {}; // id -> { canvas, white }  (white = silhueta p/ flash de dano)

function makeSprite(rows, pal) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const build = (whiteOnly) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    for (let r = 0; r < h; r++) {
      const row = rows[r];
      for (let col = 0; col < row.length; col++) {
        const ch = row[col];
        if (ch === "." || ch === " ") continue;
        const color = whiteOnly ? "#ffffff" : pal[ch];
        if (!color) continue;
        x.fillStyle = color;
        x.fillRect(col, r, 1, 1);
      }
    }
    return c;
  };
  return { canvas: build(false), white: build(true) };
}

/* --- Walk frames, generated from the same grid ------------------------------
   The grid cannot represent a squash of 1.05 of a pixel, so faking motion with
   a transform is out (see walkAnim). What replaces it is what pixel art has
   always used: more than one pose. Drawing a second pose by hand for every
   sprite is the real answer and it is art work — this generates a decent one
   from the grid that already exists, in whole pixels, once at load.

   Two poses per cycle, read off the bottom row:

   - stands on two legs (two separate runs down there) → each pose lifts one
     leg by a pixel, the foot leaving the ground. That is a step;
   - stands on one mass — a robe, a cloud, a gate → that mass sways a pixel to
     each side. That is what a walk looks like on something with no legs.

   Above the band where the legs are still two separate things, nothing moves:
   shifting there would tear the body off the head. */
const WALK_FRAMES = 4;
const WALK_BAND = 0.4;      // teto da faixa de perna, em altura do sprite

const isSolid = (ch) => ch !== undefined && ch !== "." && ch !== " ";

// Runs of solid pixels in one row, within [from, to].
function rowRuns(row, from, to) {
  const runs = [];
  let start = -1;
  for (let c = from; c <= to + 1; c++) {
    const solid = c <= to && isSolid(row[c]);
    if (solid && start < 0) start = c;
    else if (!solid && start >= 0) { runs.push([start, c - 1]); start = -1; }
  }
  return runs;
}

// The two legs, if the sprite has legs at all: the two widest runs in the
// bottom row. One dominant mass down there means a robe or a gate, and that is
// the signal to sway instead of to step.
function findLegs(rows, w) {
  const runs = rowRuns(rows[rows.length - 1], 0, w - 1);
  if (runs.length < 2) return null;
  const byWidth = runs.slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  if (byWidth[0][1] - byWidth[0][0] + 1 > w * 0.45) return null;
  return byWidth.slice(0, 2).sort((a, b) => a[0] - b[0]);
}

// How far up the legs are still two separate things.
function legBand(rows, legs) {
  const h = rows.length, cap = Math.max(2, Math.floor(h * WALK_BAND));
  let n = 0;
  for (let r = h - 1; r >= 0 && n < cap; r--) {
    if (rowRuns(rows[r], legs[0][0], legs[1][1]).length < 2) break;
    n++;
  }
  return n;
}

function walkFrames(rows, pal, base) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  let legs = findLegs(rows, w);
  // Legs that only exist for one row have no room to step — the Dreadlord's do
  // exactly that. Swaying is the fallback, because the alternative is a boss
  // that slides across the floor without moving at all.
  if (legs && legBand(rows, legs) < 2) legs = null;
  const band = legs ? legBand(rows, legs) : Math.max(2, Math.floor(h * 0.25));
  const frames = [base, null, base, null];
  for (const f of [1, 3]) {
    const grid = rows.map((r) => (r + " ".repeat(w)).slice(0, w).split(""));
    if (legs) {
      const leg = legs[f === 1 ? 0 : 1];
      // top-down inside the band, each row taking the row below it: the leg
      // rides up one pixel and the foot leaves the floor
      for (let r = h - band; r < h; r++) {
        for (let c = leg[0]; c <= leg[1]; c++) grid[r][c] = r + 1 < h ? grid[r + 1][c] : ".";
      }
    } else {
      const dir = f === 1 ? 1 : -1;
      for (let r = h - band; r < h; r++) {
        const row = grid[r].slice();
        for (let c = 0; c < w; c++) grid[r][c] = row[c - dir] || ".";
      }
    }
    frames[f] = makeSprite(grid.map((r) => r.join("")), pal);
  }
  return frames;
}

// The pose this animation is on. Everything that draws a sprite goes through
// here, so the outline and the tint never end up on a different frame than the
// body they belong to.
function animFrame(spr, anim) {
  return anim && anim.frame && spr.frames ? spr.frames[anim.frame] : spr;
}

// Blob radial suave (cacheado por cor) usado nos rastros — evita recriar gradient por frame.
const GLOW_BLOBS = new Map();
function glowBlob(color) {
  let c = GLOW_BLOBS.get(color);
  if (c) return c;
  const size = 64, h = size / 2;
  c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const rgb = hexRgb(color);
  const g = x.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.35, `rgba(${rgb},0.45)`);
  g.addColorStop(0.7, `rgba(${rgb},0.12)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  GLOW_BLOBS.set(color, c);
  return c;
}

/* --- O grid de pixel -------------------------------------------------------
   The world is rasterized into a low-res buffer and only then blown up by a
   whole number (see Game.present). PIXEL_GRID is how many world units fit in
   one buffer pixel: the ruler that says where an art pixel may start and what
   sizes it may have.

   Without that ruler `drawH / srcH` lands on a fractional scale — one row of
   the sprite gets 3 screen pixels and the row below it gets 2 — and since the
   camera moves in floats, which rows get the extra pixel changes every frame
   and the sprite boils. Snapping here fixes both: whole-pixel cells, corner on
   the grid.

   Default is 1, so anything drawing straight to a 1:1 canvas (sprites.html)
   keeps working untouched. */
let PIXEL_GRID = 1;
function setPixelGrid(u) { PIXEL_GRID = u > 0 ? u : 1; }
const snapUnit = (v) => Math.round(v / PIXEL_GRID) * PIXEL_GRID;

/* Where a cell-art canvas lands on the grid, in WORLD units (the caller's
   coordinate system), given the height it asked for.

   Two things are quantized on purpose:

   - the cell size, to a whole number of buffer pixels, so every art pixel is
     the same size as every other one;
   - `sclX/sclY` from the animation, folded into that whole number. At the 1:1
     scale the sprites are authored for there is no such thing as 1.05 of a
     pixel, so a squash that small is simply not representable and vanishes.
     The bob survives (it is a translation, snapped like any other) — that is
     the part the player actually reads. Real squash needs a real frame, which
     is a different job: `rows` becoming a list of poses.

   `anim.rot` is ignored for the same reason and is the more important one:
   rotating pixel art off the grid resamples it and eats the hand-drawn edge. */
function placeSprite(cx, cy, srcW, srcH, drawH, anim) {
  const a = anim || NO_ANIM;
  const step = Math.max(1, Math.round(drawH / (PIXEL_GRID * srcH)));
  const px = Math.max(1, Math.round(step * Math.abs(a.sclX))) * PIXEL_GRID;
  const py = Math.max(1, Math.round(step * a.sclY)) * PIXEL_GRID;
  const w = srcW * px, h = srcH * py;
  return { x: snapUnit(cx - w / 2), y: snapUnit(cy + a.bob - h / 2), w, h, px, py };
}

// Blits a cell-art canvas on the grid. Anything made of pixels goes through
// here — sprites, the outline, the tint, explosion frames, scenery props.
function drawPixelCanvas(ctx, img, x, y, w, h, flip) {
  if (flip) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
}

/* Walk transform. Everything it returns is WHOLE-pixel motion.

   The squash and the sway that used to live here were fractions of a pixel —
   1.05 of a cell, 0.05 of a radian — and the grid cannot represent that: they
   were resampling the art instead of animating it, which is how a hand-drawn
   outline turns to mush the moment the character moves. What survives is the
   hop, and a two-pixel hop is one the player actually sees. Real squash needs
   a real frame: `rows` becoming a list of poses. Until then the body goes up
   and down, and it goes up and down clean. */
function walkAnim(t, moving) {
  // idle breath: one pixel, downward only — standing still must not jolt
  if (!moving) return { bob: (Math.sin(t * 2) - 1) * 0.9, frame: 0, sclX: 1, sclY: 1, rot: 0 };
  const ph = t * 9;
  // The body is highest exactly when a foot is off the ground, so the bob and
  // the pose have to come off the same phase — one pixel of lift, because the
  // legs are doing the talking now.
  return {
    bob: -Math.abs(Math.sin(ph)) * 3.5,
    frame: Math.floor(ph / (Math.PI / 2)) & 3,   // contact, step, contact, step
    sclX: 1, sclY: 1, rot: 0,
  };
}

// sombra elíptica no chão (não acompanha o hop → reforça profundidade)
function drawShadow(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.8, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// desenha um sprite centrado em (cx,cy), altura drawH, com flip/flash/animação
function drawSprite(ctx, spr, cx, cy, drawH, flip, flashAlpha, anim) {
  const p = placeSprite(cx, cy, spr.canvas.width, spr.canvas.height, drawH, anim);
  const fr = animFrame(spr, anim);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  drawPixelCanvas(ctx, fr.canvas, p.x, p.y, p.w, p.h, flip);
  if (flashAlpha > 0) {
    ctx.globalAlpha = flashAlpha;
    drawPixelCanvas(ctx, fr.white, p.x, p.y, p.w, p.h, flip);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
const NO_ANIM = { bob: 0, frame: 0, sclX: 1, sclY: 1, rot: 0 };

/* ---- VFX de combo: adornos desenhados sob/sobre o personagem ---- */

// Deterministic 0..1 noise per index, so the vfx stays stable and allocates nothing.
function vfxRand(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Sprite silhouette painted in a solid color, cached per sprite+color.
function tintedSprite(spr, color) {
  const cache = spr.tints || (spr.tints = {});
  if (cache[color]) return cache[color];
  const c = document.createElement("canvas");
  c.width = spr.white.width; c.height = spr.white.height;
  const x = c.getContext("2d");
  x.drawImage(spr.white, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  cache[color] = c;
  return c;
}

/* --- Contorno -------------------------------------------------------------
   The silhouette dilated by one art pixel, painted flat and cached per
   sprite+color. Pixel art loses its edge the moment it stands on a lit floor
   or inside an additive glow, and an outline is the cheapest way to give the
   edge back without repainting a single sprite. The warlock is the one who
   gets it: with a horde on screen, the player has to be the shape you find
   first, and this is what makes him findable. */
function spriteRim(spr, color) {
  const cache = spr.rims || (spr.rims = {});
  if (cache[color]) return cache[color];
  const c = document.createElement("canvas");
  c.width = spr.white.width + 2; c.height = spr.white.height + 2;
  const x = c.getContext("2d");
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) x.drawImage(spr.white, 1 + dx, 1 + dy);
  }
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  cache[color] = c;
  return c;
}

// Draws that outline under the sprite, sharing drawSprite's transform so it
// hops, squashes and flips with the character instead of sliding off it.
function drawSpriteRim(ctx, spr, cx, cy, drawH, flip, anim, color, alpha) {
  const rim = spriteRim(animFrame(spr, anim), color);
  // The rim canvas is the silhouette grown by exactly one art pixel on each
  // side, so it rides the sprite's own placement grown by one CELL — deriving
  // its size on its own would put the outline half a pixel off the body.
  const p = placeSprite(cx, cy, spr.canvas.width, spr.canvas.height, drawH, anim);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  drawPixelCanvas(ctx, rim, p.x - p.px, p.y - p.py, p.w + p.px * 2, p.h + p.py * 2, flip);
  ctx.restore();
}

// Additive colored glow over the sprite, sharing drawSprite's transform.
function drawSpriteGlow(ctx, spr, cx, cy, drawH, flip, anim, color, alpha) {
  const tint = tintedSprite(animFrame(spr, anim), color);
  const p = placeSprite(cx, cy, spr.canvas.width, spr.canvas.height, drawH, anim);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  drawPixelCanvas(ctx, tint, p.x, p.y, p.w, p.h, flip);
  ctx.restore();
}

// Corruption's rot orbs ride a tilted orbit around the warlock; `front` picks
// the half that passes in front of him (drawn after the sprite).
function drawRotOrbit(ctx, p, front) {
  const n = 3 + Math.floor((p.lvl || 1) / 2);
  const blob = glowBlob(p.color);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const a = p.t * 1.5 + (i / n) * Math.PI * 2;
    const sn = Math.sin(a);
    if ((sn > 0) !== front) continue;
    const depth = 0.72 + sn * 0.28;                 // à frente = maior e mais forte
    const bob = Math.sin(p.t * 3 + i * 1.7) * p.r * 0.12;
    const x = p.x + Math.cos(a) * p.r * 1.45;
    const y = p.y + p.r * 0.15 + sn * p.r * 0.5 + bob;
    const w = p.r * 0.42 * depth;
    ctx.globalAlpha = 0.5 * depth;
    ctx.drawImage(blob, x - w, y - w, w * 2, w * 2);
    ctx.globalAlpha = 0.7 * depth;
    ctx.fillStyle = paleHex(p.color, 0.45);
    ctx.beginPath(); ctx.arc(x, y, 1.5 * depth, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Demonic Pact chain links on a tilted orbit; `front` picks the half that
// passes in front of the warlock (drawn after the sprite) from the one behind.
function drawPactChain(ctx, p, front) {
  const links = 10;
  ctx.strokeStyle = front ? `rgba(${p.rgb},0.95)` : `rgba(${p.rgb},0.5)`;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < links; i++) {
    const a = p.t * 1.6 + (i / links) * Math.PI * 2;
    const sn = Math.sin(a);
    if ((sn > 0) !== front) continue;
    const sc = 0.75 + sn * 0.25;
    ctx.save();
    ctx.translate(p.x + Math.cos(a) * p.r * 1.7, p.y + p.r * 0.15 + sn * p.r * 0.55);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6 * sc, 2.2 * sc, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}


// definições dos sprites (grids de pixels + paleta por char)
const SPRITE_DATA = {
  warlock: {
    pal: { o: "#160a24", H: "#3a1d6e", h: "#5a2d8f", L: "#9a5cff", f: "#241634", e: "#7fff5a", w: "#caa6e0" },
    rows: [
      "......oooo......",
      "....ooHHHHoo....",
      "...oHHHHHHHHo...",
      "..oHHHHHHHHHHo..",
      "..oHHffffffHHo..",
      "..oHffeffeffHo..",
      "..oHffffffffHo..",
      "..oHHffffffHHo..",
      "...oHHhhhhHHo...",
      "..oHhhhLLhhhHo..",
      ".oHhhhhLLhhhhHo.",
      ".oHhhhhLLhhhhHo.",
      ".wHhhhhhhhhhhHw.",
      ".oHhhhhhhhhhhHo.",
      "..oHhhhhhhhhHo..",
      "..oooHHHHHHooo..",
    ],
  },
  // 2ª forma: chifres despontando, mandíbula fel acesa, runas e garras
  warlockFel: {
    pal: { o: "#12071e", H: "#3a1d6e", h: "#5a2d8f", L: "#9a5cff", f: "#241634", e: "#aaff5a",
           g: "#6fdc4a", B: "#d9c9a0", b: "#8a7a58", c: "#e0ff8a" },
    rows: [
      ".Bb..........bB.",
      "..Bb........bB..",
      "...Bb......bB...",
      "....BboooobB....",
      "....ooHHHHoo....",
      "...oHHHHHHHHo...",
      "..oHHHHHHHHHHo..",
      "..oHHffffffHHo..",
      "..oHffeffeffHo..",
      "..oHffffffffHo..",
      "..oHHfggggfHHo..",
      "...oHHhhhhHHo...",
      "..oHhhhLLhhhHo..",
      ".oHhhgeLLeghhHo.",
      ".oHhhhhLLhhhhHo.",
      ".cHhhhhhhhhhhHc.",
      ".oHhhhhhhhhhhHo.",
      "..oHhhhhhhhhHo..",
      "..oooHHHHHHooo..",
    ],
  },
  // 3ª forma: chifres grandes, asas membranosas e olhos em brasa
  warlockDemon: {
    pal: { o: "#0d0416", H: "#4a1d7e", h: "#6a2da0", L: "#c86bff", f: "#160a20", e: "#ff3a10",
           g: "#ff8a3c", B: "#ffe0a0", b: "#b8791e", c: "#ffd24a", M: "#4a1a6e", V: "#b25cff" },
    rows: [
      ".....BBb..........bBB.....",
      ".....BBb..........bBB.....",
      "......BBb........bBB......",
      ".......BBb......bBB.......",
      "........BBboooobBB........",
      ".........ooHHHHoo.........",
      "........oHHHHHHHHo........",
      ".......oHHHHHHHHHHo.......",
      ".......oHHffffffHHo.......",
      ".......oHffeffeffHo.......",
      ".V.....oHffffffffHo.....V.",
      ".VM....oHHfggggfHHo....MV.",
      ".VMM....oHHhhhhHHo....MMV.",
      "..VMM..oHhhhLLhhhHo..MMV..",
      "..VMMMoHhhgeLLeghhHoMMMV..",
      "...VMMoHhhhhLLhhhhHoMMV...",
      "....VMcHhhhhhhhhhhHcMV....",
      "....VMoHhhhhhhhhhhHoMV....",
      ".....VMoHhhhhhhhhHoMV.....",
      ".....V.oooHHHHHHooo.V.....",
    ],
  },
  ghoul: {
    pal: { o: "#0a1a08", G: "#6f9e4a", g: "#3f5e2a", e: "#ff3838", m: "#140a0a", c: "#cdbfa0" },
    rows: [
      "...oooooo.....",
      "..oGGGGGGo....",
      ".oGGGGGGGGo...",
      ".oGeGGGGeGo...",
      ".oGGGGGGGGo...",
      ".oGGmmmmGGo...",
      "oGGGGGGGGGGo..",
      "cGGGgggggGGGc.",
      "cGGgggggggGGc.",
      ".oGGgggggGGo..",
      "..oGGggGGo....",
      "..oGg..gGo....",
      "..oo...oo.....",
    ],
  },
  skeleton: {
    pal: { o: "#161410", B: "#e8e0c8", b: "#9a927a", e: "#7fff5a", s: "#6a7080", S: "#aab0c0" },
    rows: [
      "...oooo.....",
      "..oBBBBo....",
      ".oBBBBBBo...",
      ".oBeBBeBo...",
      ".oBBBBBBo...",
      ".oBbBBbBo...",
      ".oBBbbBBo...",
      "..sBBBBs....",
      ".sSBBBBSs...",
      "sSBBBBBBSs..",
      ".sBBbbbbBs..",
      ".oBB..BBo...",
      ".oB....Bo...",
      ".ooo..ooo...",
    ],
  },
  abomination: {
    pal: { o: "#1a0f0a", A: "#9a6b4f", a: "#5f3d28", t: "#d8c8a0", e: "#ffd000" },
    rows: [
      "....oooooo......",
      "..ooAAAAAAoo....",
      ".oAAAAAAAAAAo...",
      ".oAAeAAAAeAAo...",
      ".oAAAAAAAAAAo...",
      ".oAAttttttAAo...",
      "oAAAAAAAAAAAAo..",
      "oAAaaAAAAaaAAo..",
      "oAAAAAAAAAAAAo..",
      "oAAttAAAAttAAo..",
      ".oAAAAAAAAAAo...",
      ".oAAaa..aaAAo...",
      "..oAA....AAo....",
      "..ooo....ooo....",
    ],
  },
  dreadlord: {
    pal: { o: "#14081f", D: "#8a3cff", d: "#4a1d7e", e: "#ff3030", H: "#e0d0f0", w: "#2a0f47" },
    rows: [
      "....H......H....",
      "...HoDDDDDDoH...",
      "...oDDDDDDDDo...",
      "...oDDeDDeDDo...",
      "...oDDDDDDDDo...",
      "...oDDddddDDo...",
      "w..oDDDDDDDDo..w",
      "ww.oDDDDDDDDo.ww",
      ".w.oDDDDDDDDo.w.",
      "...oDDddddDDo...",
      "...oDDDDDDDDo...",
      "....oDDDDDDo....",
      "....oDdDDdDo....",
      "....ooo..ooo....",
    ],
  },

  /* ---- demonios invocados -------------------------------------------------
     Bipedes de frente, bestas de perfil (essas viram com `facing`). O que
     precisa ler a 30px de altura e a silhueta: chifres e asinhas nos imps,
     quatro patas nos caes, nada de pernas no que flutua. */

  // Imp: cabecao, chifres curtos, asinhas de morcego. O menor bipede.
  imp: {
    pal: { o: "#2a0d04", I: "#ff8a3c", i: "#c2551b", e: "#ffe14a", m: "#4a1206", w: "#a34418" },
    rows: [
      "..o.......o..",
      "..oo.....oo..",
      "...ooIIIoo...",
      "..oIIIIIIIo..",
      ".oIIIIIIIIIo.",
      ".oIeeIIIeeIo.",
      ".oIIIIIIIIIo.",
      ".oIImmmmmIIo.",
      "..oIIIIIIIo..",
      "w..oIIIIIo..w",
      "ww.oIIIIIo.ww",
      ".wwoIiIiIoww.",
      "...oI...Io...",
      "...oo...oo...",
    ],
  },

  // Wild Imp: menor, mais claro, boca escancarada e bracos pro alto.
  wildImp: {
    pal: { o: "#3a1505", I: "#ffb04a", i: "#c97a1e", e: "#fff3a0", m: "#4a1206" },
    rows: [
      "..o.....o..",
      "..oo...oo..",
      "...oIIIo...",
      "..oIIIIIo..",
      ".oIeIIIeIo.",
      ".oIImmmIIo.",
      ".oIIIIIIIo.",
      ".oIIIIIIIo.",
      "ioIIIIIIIoi",
      "i.oIiIiIo.i",
      "...oI.Io...",
      "...oo.oo...",
    ],
  },

  // Dreadstalker: cao alado de focinho comprido, correndo de perfil.
  dreadstalker: {
    pal: { o: "#14061f", D: "#8a4cff", d: "#4a1d7e", e: "#ff3030", W: "#6a2da0", B: "#f0e0ff", t: "#5a2390" },
    rows: [
      "....W......W........",
      "...WWW....WWW.......",
      "..WWWWW..WWWWW......",
      "..WWWWWWWWWWWW..oo..",
      "...WWWWWWWWWW..oDDo.",
      "....WWWWWWWW..oDDeDD",
      "t....ooooooooooDDDDD",
      "tt..oDDDDDDDDDDDDBBB",
      "..ttoDDDDDDDDDDDDoo.",
      "....oDDdDDDdDDDDDo..",
      "....oDDDDDDDDDDDo...",
      "....oDDDo..oDDDo....",
      ".....oDo....oDo.....",
      ".....oDo....oDo.....",
      ".....oDo....oDo.....",
      ".....ooo....ooo.....",
    ],
  },

  // Felguard: ombreiras, presas e machado plantado ao lado. O tanque.
  felguard: {
    pal: { o: "#2a0806", F: "#ff5a3c", f: "#a32a18", A: "#9aa0b0", a: "#4a5060", e: "#ffd24a", B: "#f0e0c0", H: "#c8b070", X: "#d8e0f0" },
    rows: [
      "..o.........o..H...",
      "..oo.......oo..HXX.",
      "...ooFFFFFoo...HXXX",
      "...oFFFFFFFo...HXXX",
      "..oFFeFFFeFFo..HXX.",
      "..oFFFFFFFFFo..H...",
      "..oFBBBBBBBFo..H...",
      ".oAAoFFFFFoAAo.H...",
      "oAAAAoFFFoAAAAoH...",
      "oAaAAFFFFFAAaAoH...",
      ".oFFFFFFFFFFFo.H...",
      "..oFfffffffFo..H...",
      "..oFFfffffFFo..H...",
      "..oFFFFFFFFFo..H...",
      "..oFFFoooFFFo..H...",
      ".oFFFo...oFFFo.H...",
      ".ooo.......ooo.H...",
    ],
  },

  // Voidwalker: massa flutuante, ombros enormes, sem pernas — desmancha em fumaca.
  voidwalker: {
    pal: { o: "#080e28", V: "#5a7cff", v: "#2a3f9e", e: "#eaffff" },
    rows: [
      ".....oVVVVo.....",
      "....oVVVVVVo....",
      "....oVooooVo....",
      "....oVeeeeVo....",
      "....oVVVVVVo....",
      "..ooVVVVVVVVoo..",
      ".oVVVVVVVVVVVVo.",
      "oVVVVVVVVVVVVVVo",
      "oVvVVVVVVVVVVvVo",
      "oVvVVVVVVVVVVvVo",
      "oVvVVVVVVVVVVvVo",
      ".oVVVVVVVVVVVVo.",
      "..oVVVVVVVVVVo..",
      "...oVVVVVVVVo...",
      "....oVVVVVVo....",
      ".....ovVVvo.....",
      "......ovvo......",
    ],
  },

  // Felhunter: cao de perfil com as duas antenas curvando das costas.
  felhunter: {
    pal: { o: "#04202c", F: "#4ad2ff", f: "#1a7ea3", e: "#eaffff", t: "#2f9fc8", B: "#eaffff" },
    rows: [
      "...tt..........tt...",
      "...tt..........tt...",
      "....tt........tt....",
      ".....tt......tt.....",
      "......tt....tt......",
      ".......tt..tt...oo..",
      "..ooooottoottoooFFo.",
      ".oFFFFFFFFFFFFFFeFFo",
      ".oFFFFFFFFFFFFFFFFFo",
      ".oFFffFFFFffFFFFBBo.",
      ".oFFFFFFFFFFFFFoooo.",
      "..oFFFFFFFFFFFo.....",
      "..oFo......oFFo.....",
      "..oFo.......oFo.....",
      "..ooo.......ooo.....",
    ],
  },

  // Vilefiend: cao espinhado, baixo e rapido.
  vilefiend: {
    pal: { o: "#0e2205", V: "#9fdc4a", v: "#4e7a1a", e: "#ff5a3c", B: "#eaffc0", s: "#c8f06a" },
    rows: [
      "..s...s...s......",
      ".sss.sss.sss.....",
      "..ooooooooooooooo",
      ".oVVVVVVVVVVVVeVo",
      "voVVVVVVVVVVVVVVo",
      "voVVvvVVVVVVVBBo.",
      ".oVVVVVVVVVVVooo.",
      "..oVVVVVVVVVo....",
      "..oVo...oVVo.....",
      "..oVo....oVo.....",
      "..ooo....ooo.....",
    ],
  },

  // Infernal: bloco de pedra com veios de fel e a cabeca em brasa.
  infernal: {
    pal: { o: "#160805", R: "#5c463d", r: "#33241f", e: "#ffe14a", F: "#ff4020", f: "#ff9a3c" },
    rows: [
      ".......f...f.......",
      "......fFf.fFf......",
      "......FFF.FFF......",
      ".....oRRRRRRRo.....",
      ".....oReRRReRo.....",
      ".....oRRFFFRRo.....",
      "...ooRRRRRRRRRoo...",
      ".ooRRRRRRRRRRRRRoo.",
      "oRRRRFRRRRRRRFRRRRo",
      "oRRRrRRFFFFFRRrRRRo",
      "oRRRRRRRFFFRRRRRRRo",
      ".oRRRRRRRFRRRRRRRo.",
      "..oRRRrRRRRRrRRRo..",
      "..oRRRRRRRRRRRRRo..",
      "..oRRRRRRRRRRRRRo..",
      "..oRRRRo...oRRRRo..",
      "..oRRRRo...oRRRRo..",
      "..oRRRRo...oRRRRo..",
      "..oooooo...oooooo..",
    ],
  },

  // Nether Portal: portico de pedra fria com a fenda acesa no vao. Nao anda.
  // Pedra cinza de proposito: roxo em tudo confundia com o Darkglare.
  portal: {
    pal: { o: "#141018", A: "#6e6478", a: "#3a3442", P: "#8e2ce0", p: "#c96bff", e: "#ffffff" },
    rows: [
      ".......oooo.......",
      ".....ooAAAAoo.....",
      "....oAAAAAAAAo....",
      "..ooAAAAAAAAAAoo..",
      "oAAAAaaPPPPaaAAAAo",
      "oAAAAaPPppPPaAAAAo",
      "oAAAAPPpppppPAAAAo",
      "oAAAAPppeeppPAAAAo",
      "oAAAAPppeeppPAAAAo",
      "oAAAAPppeeppPAAAAo",
      "oAAAAPPpppppPAAAAo",
      "oAAAAaPPppPPaAAAAo",
      "oAAAAaaPPPPaaAAAAo",
      "oAAAAaaaPPaaaAAAAo",
      "..ooAAAAAAAAAAoo..",
      "...oAAAAAAAAAAo...",
      "...oAAo....oAAo...",
      "...oAAo....oAAo...",
      "..oAAAAo..oAAAAo..",
      "..oooooo..oooooo..",
    ],
  },

  // Demonic Tyrant: chifres de coroa, manto de asa, o maior de todos.
  tyrant: {
    pal: { o: "#241601", T: "#ffd24a", t: "#b8791e", e: "#ff3010", B: "#fff0c0", W: "#8a5a10", f: "#ff8a3c" },
    rows: [
      "..B................B..",
      "..BB..............BB..",
      "...BB............BB...",
      "....BBB........BBB....",
      "W....BBBooooooBBB....W",
      "WW....ooTTTTTToo....WW",
      "WWW..oTTTTTTTTTTo..WWW",
      "WWWW.oTTeTTTTeTTo.WWWW",
      "WWWWWoTTTTTTTTTToWWWWW",
      "WWWWWoTTffffffTToWWWWW",
      ".WWWWoTTTTTTTTTToWWWW.",
      ".WWWW.oTTTTTTTTo.WWWW.",
      "..WWW.oTTtTTtTTo.WWW..",
      "..WW.oTTTTTTTTTTo.WW..",
      "...W.oTTTTTTTTTTo.W...",
      ".....oTTTTTTTTTTo.....",
      "......oTTToooTTTo.....",
      ".....oTTTo...oTTTo....",
      ".....oTTTo...oTTTo....",
      ".....ooooo...ooooo....",
    ],
  },

  // Darkglare: olho unico flutuante com tentaculos pendurados.
  darkglare: {
    pal: { o: "#180420", D: "#c850ff", d: "#6a1a8f", e: "#ffffff", i: "#2a0533", p: "#ff9aff" },
    rows: [
      "....oooooo....",
      "..ooDDDDDDoo..",
      ".oDDDDDDDDDDo.",
      "oDDDeeeeeeDDDo",
      "oDDeeeeeeeeDDo",
      "oDeeeeiieeeeDo",
      "oDeeeeiieeeeDo",
      "oDDeeeeeeeeDDo",
      ".oDDDeeeeDDDo.",
      "..oDDDDDDDDo..",
      "...oDDDDDDo...",
      "..oDDo..oDDo..",
      "..oDo....oDo..",
      ".oDo......oDo.",
      ".oo........oo.",
    ],
  },
};

function buildSprites() {
  for (const id in SPRITE_DATA) {
    const d = SPRITE_DATA[id];
    const base = makeSprite(d.rows, d.pal);
    base.frames = walkFrames(d.rows, d.pal, base);
    SPRITES[id] = base;
  }
}


/* --- Portal ---------------------------------------------------------------
   The gate a portal spell opens. It lives OUTSIDE SPRITE_DATA on purpose: it
   is not a creature, nothing draws it by kind, and the geometry below has to
   travel with the grid it describes.

   The mouth is transparent by design — drawPortal spins the vortex behind the
   frame, so the gate shows the other side instead of a painted lid. `R`/`r`
   are the runes, repainted with the spell's color by portalSprite(). */
const PORTAL_GATE = {
  pal: { o: "#0a0410", S: "#5a3a86", s: "#311c4e", B: "#d8c8a4", b: "#7d6b46",
         R: "#f0d0ff", r: "#b23cff" },
  rows: [
    "..........................",
    "..B....................B..",
    "...Bb................bB...",
    "...Bb....oooooooo....bB...",
    "...BBb..ooSSRRssoo..bBB...",
    "...bBBboSSSSrrssssobBBb...",
    "....bBBBSSoooooossBBBb....",
    ".....ooSSo......ossoo.....",
    ".....ooSo........osoo.....",
    "....ooSSo........ossoo....",
    "....oSSS..........ssso....",
    "....oSSo..........osso....",
    "....ooSo..........osoo....",
    "....oRro..........orRo....",
    "....oRro..........orRo....",
    "....ooSo..........osoo....",
    "....oSSo..........osso....",
    "....oSSS..........ssso....",
    "....ooSSo........ossoo....",
    ".....oSSo........osso.....",
    ".....ooSSo......ossoo.....",
    "......oSSSoooooossso......",
    ".......oSoSSSsssoso.......",
    "........ooSSSsssoo........",
    "........oSSoooosso........",
    "........oooo..oooo........",
  ],
};

/* Where the mouth and the runes sit, in PORTAL_GATE grid pixels, so the render
   layer never guesses. Change the grid, change these. */
const PORTAL_ART = {
  cx: 12.5, cy: 13.5,          // mouth center, in sprite pixels
  rx: 5.5,  ry: 7.5,           // mouth radii — the hole inside the arch
  feet: 12.0,                  // rows below the center where the gate lands
  runes: [[0, -9], [-7.5, 0], [7.5, 0]],  // keystone + the two side nodes
};

// Blend two hex colors, k = 0 keeps `hex`, k = 1 lands on `other`.
function mixHex(hex, other, k) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(other.slice(1), 16);
  const to = (c) => c.toString(16).padStart(2, "0");
  const ch = (sh) => to(Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * k));
  return "#" + ch(16) + ch(8) + ch(0);
}

// Blend towards white, for the lit face of a rune. Cached: the piece vfx asks
// for the same lit tone on every frame, and mixHex allocates.
const PALE_HEX = new Map();
function paleHex(hex, k) {
  const key = hex + k;
  let out = PALE_HEX.get(key);
  if (!out) PALE_HEX.set(key, out = mixHex(hex, "#ffffff", k));
  return out;
}

// The gate recolored per spell — obsidian and bone stay, the runes take the
// spell's color. Cached like glowBlob: one sprite per color, built on demand.
const PORTAL_SPRITES = new Map();
function portalSprite(color) {
  let spr = PORTAL_SPRITES.get(color);
  if (spr) return spr;
  const def = PORTAL_GATE;
  const pal = Object.assign({}, def.pal, { R: paleHex(color, 0.6), r: color });
  spr = makeSprite(def.rows, pal);
  PORTAL_SPRITES.set(color, spr);
  return spr;
}


/* --- Explosao -------------------------------------------------------------
   A frame-by-frame pixel explosion, generated at runtime like everything else
   in this file: a heat field sampled on a GRID x GRID grid, quantized into
   four bands (white core, hot rim, spell color, dying ember) and painted with
   fillRect. Two things keep it from reading as "a circle that grows":

   - the edge is a sum of harmonics on the angle, so the silhouette is ragged,
     it churns between frames, and each variant is a different explosion;
   - it hollows out. The ball hands over to a shell that rides outward and
     thins, leaving a ring of fire and debris thrown past it. Something that
     only fades looks like a bubble popping, not like a detonation.

   Built once per color, on first use, and cached like glowBlob/portalSprite.
   Nothing here runs per frame: the render layer picks a canvas and blits it. */
/* GRID is the reference grid (the one the gallery shows). GRIDS are the sizes
   an explosion can actually exist at: the fireball is generated ALREADY at the
   size it will have on screen, so it blits 1:1 into the buffer instead of
   being stretched by 1.37. The price is that the apparent radius comes in
   steps — which it was always allowed to: "the fireball is art and lies about
   its size; the ring does not". What tells the truth about the reach is the
   shockwave, drawn at the real radius. */
const EXPLO = { GRID: 40, GRIDS: [16, 24, 32, 40, 56], FRAMES: 8, VARIANTS: 3, SHARDS: 12 };

// Largest grid that still fits the requested size (in buffer pixels).
function explosionGrid(px) {
  const g = EXPLO.GRIDS;
  let best = g[0];
  for (let i = 0; i < g.length; i++) if (g[i] <= px) best = g[i];
  return best;
}

const EXPLOSION_SPRITES = new Map();
function explosionFrames(color, grid) {
  const G = grid || EXPLO.GRID;
  const key = G === EXPLO.GRID ? color : color + "@" + G;
  let set = EXPLOSION_SPRITES.get(key);
  if (set) return set;
  set = [];
  for (let v = 0; v < EXPLO.VARIANTS; v++) {
    const frames = [];
    for (let f = 0; f < EXPLO.FRAMES; f++) frames.push(buildExplosionFrame(v, f, color, G));
    set.push(frames);
  }
  EXPLOSION_SPRITES.set(key, set);
  return set;
}

// Band colors for one frame. Alpha is baked in: the tail of the animation is
// dimmer, so the render layer can blit every frame at full opacity.
function explosionRamp(color, u) {
  const tail = 1 - Math.pow(u, 2.2) * 0.62;
  const band = (hex, a) => `rgba(${hexRgb(hex)},${(a * tail).toFixed(3)})`;
  return [
    band("#ffffff", 1),                        // core: only while it is hot
    band(paleHex(color, 0.6), 0.96),           // rim just off the core
    band(color, 0.88),                         // the body of the fireball
    band(mixHex(color, "#1a0e16", 0.55), 0.6), // edge already going out
  ];
}

function buildExplosionFrame(variant, frame, color, grid) {
  const G = grid || EXPLO.GRID, half = G / 2;
  const c = document.createElement("canvas");
  c.width = G; c.height = G;
  const x = c.getContext("2d");

  const u = frame / (EXPLO.FRAMES - 1);          // 0 = ignition, 1 = gone
  const grow = 1 - Math.pow(1 - u, 2.4);         // blows out fast, then coasts
  const R = half * (0.22 + 0.47 * grow);         // fireball radius, in cells
  const cool = 1.35 - u * 0.85;                  // the whole thing losing heat
  const ramp = explosionRamp(color, u);

  // The silhouette: harmonics on the angle, so the edge is ragged and each
  // variant is a different explosion. The phases drift with `u`, which makes
  // the fire churn between frames instead of just scaling up.
  const p1 = vfxRand(variant * 71 + 1) * 6.28, p2 = vfxRand(variant * 71 + 2) * 6.28;
  const p3 = vfxRand(variant * 71 + 3) * 6.28, p4 = vfxRand(variant * 71 + 4) * 6.28;
  // The amplitude grows with `u`: what starts as a slightly lumpy ball ends
  // as arcs torn apart, which is the last frame doing something other than
  // fading. Ragged, not noisy — same harmonics all the way through.
  const churn = u * 0.7, amp = 1 + u * 1.1;
  const lobe = (a) => 0.84 + amp * (
      0.10 * Math.sin(a * 3 + p1 + churn)
    + 0.07 * Math.sin(a * 5 - p2 - churn * 1.6)
    + 0.05 * Math.sin(a * 7 + p3)
    + 0.06 * Math.sin(a * 2 + p4 + churn * 0.5));

  // The handover: the ball burns at full heat while it is expanding and only
  // then gives way. Fading it from the first frame is what made earlier takes
  // look like a puff of smoke instead of a detonation.
  const ballW = clamp((0.62 - u) / 0.32, 0, 1);
  const ringW = clamp((u - 0.18) / 0.25, 0, 1);
  const ringAt = 0.6 + u * 0.32, ringHalf = 0.5 - u * 0.28;  // rides outward, thins

  let cur = null;
  for (let py = 0; py < G; py++) {
    for (let px = 0; px < G; px++) {
      const dx = px + 0.5 - half, dy = py + 0.5 - half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > R * (0.84 + amp * 0.28)) continue;   // outside any lobe
      const edge = R * lobe(Math.atan2(dy, dx));
      if (dist > edge) continue;
      // Heat is the louder of two profiles: the ball, hottest at the middle
      // and gone by the time the blast has thrown itself outward; and the
      // shell, a bump riding near the edge that takes over from it. The
      // handover is what hollows the explosion out — nothing subtracts a
      // hole, the middle simply stops being on fire.
      const rel = dist / edge;
      const depth = Math.max((1 - rel) * ballW,
                             (1 - Math.abs(rel - ringAt) / ringHalf) * ringW);
      if (depth <= 0) continue;
      const t = depth * cool;
      const band = t > 1.0 ? 0 : t > 0.72 ? 1 : t > 0.34 ? 2 : 3;
      if (cur !== band) { cur = band; x.fillStyle = ramp[band]; }
      x.fillRect(px, py, 1, 1);
    }
  }

  // Debris thrown past the fireball: each shard is a pixel plus the pixel it
  // just left behind, which is what makes it read as moving outward.
  if (frame > 0) {
    for (let i = 0; i < EXPLO.SHARDS; i++) {
      const s = variant * 211 + i * 17;
      const a = (i / EXPLO.SHARDS) * Math.PI * 2 + (vfxRand(s + 5) - 0.5) * 0.9;
      const sp = 0.7 + vfxRand(s + 6) * 0.9;
      const d = R * (0.9 + sp * grow * 0.75);
      if (d > half - 2 || d < R * lobe(a)) continue;   // still inside the fire
      const ca = Math.cos(a), sa = Math.sin(a);
      const sz = vfxRand(s + 7) > 0.75 && u < 0.5 ? 2 : 1;
      x.fillStyle = ramp[u < 0.35 ? 1 : u < 0.7 ? 2 : 3];
      x.fillRect(Math.round(half + ca * d), Math.round(half + sa * d), sz, sz);
      x.fillStyle = ramp[3];
      x.fillRect(Math.round(half + ca * (d - 2)), Math.round(half + sa * (d - 2)), 1, 1);
    }
  }
  return c;
}
