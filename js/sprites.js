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
  const rim = spriteRim(spr, color);
  const s = drawH / spr.canvas.height;
  const w = rim.width * s, h = rim.height * s;
  const a = anim || NO_ANIM;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy + a.bob);
  if (a.rot) ctx.rotate(a.rot);
  ctx.scale((flip ? -1 : 1) * a.sclX, a.sclY);
  ctx.drawImage(rim, -w / 2, -h / 2, w, h);
  ctx.restore();
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
    SPRITES[id] = makeSprite(SPRITE_DATA[id].rows, SPRITE_DATA[id].pal);
  }
}

