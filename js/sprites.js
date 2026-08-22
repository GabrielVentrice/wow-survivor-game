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

// transform de caminhada (hop + squash/stretch + gingado). `anim` é aplicado no draw.
function walkAnim(t, moving) {
  if (!moving) {
    const b = Math.sin(t * 2);          // respiração idle
    return { bob: 0, sclX: 1 - b * 0.015, sclY: 1 + b * 0.025, rot: 0 };
  }
  const ph = t * 9;
  const hop = Math.abs(Math.sin(ph));   // 0..1 — pico = pé no chão
  return {
    bob: -hop * 2.5,                    // sobe ao pisar
    sclX: 1 - hop * 0.05,
    sclY: 1 + hop * 0.07,
    rot: Math.sin(ph) * 0.05,           // gingado leve
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
  const s = drawH / spr.canvas.height;
  const w = spr.canvas.width * s, h = drawH;
  const a = anim || NO_ANIM;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy + a.bob);
  if (a.rot) ctx.rotate(a.rot);
  ctx.scale((flip ? -1 : 1) * a.sclX, a.sclY);
  ctx.drawImage(spr.canvas, -w / 2, -h / 2, w, h);
  if (flashAlpha > 0) {
    ctx.globalAlpha = flashAlpha;
    ctx.drawImage(spr.white, -w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
const NO_ANIM = { bob: 0, sclX: 1, sclY: 1, rot: 0 };

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

// Additive colored glow over the sprite, sharing drawSprite's transform.
function drawSpriteGlow(ctx, spr, cx, cy, drawH, flip, anim, color, alpha) {
  const tint = tintedSprite(spr, color);
  const s = drawH / spr.canvas.height;
  const w = spr.canvas.width * s, h = drawH;
  const a = anim || NO_ANIM;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy + a.bob);
  if (a.rot) ctx.rotate(a.rot);
  ctx.scale((flip ? -1 : 1) * a.sclX, a.sclY);
  ctx.drawImage(tint, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// Corruption's rot orbs ride a tilted orbit around the warlock; `front` picks
// the half that passes in front of him (drawn after the sprite).
function drawRotOrbit(ctx, p, front) {
  const n = 3 + Math.floor((p.lvl || 1) / 2);
  const blob = glowBlob("#7fdc4a");
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
    ctx.fillStyle = "#b6ff7c";
    ctx.beginPath(); ctx.arc(x, y, 1.5 * depth, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Demonic Pact chain links on a tilted orbit; `front` picks the half that
// passes in front of the warlock (drawn after the sprite) from the one behind.
function drawPactChain(ctx, p, front) {
  const links = 10;
  ctx.strokeStyle = front ? "rgba(255,170,90,0.95)" : "rgba(255,138,60,0.5)";
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
};

function buildSprites() {
  for (const id in SPRITE_DATA) {
    SPRITES[id] = makeSprite(SPRITE_DATA[id].rows, SPRITE_DATA[id].pal);
  }
}

