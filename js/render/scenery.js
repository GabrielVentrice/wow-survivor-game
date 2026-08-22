"use strict";
/* =========================================================================
   SCENERY — o mundo da Legião: basalto rachado sobre fel, com destroços de
   uma invasão que já passou por ali.

   Três camadas, todas geradas em runtime (nenhum arquivo de imagem):

     1. CHÃO   variantes de tile de obsidiana, escolhidas por hash da célula.
               Um tile só repetido é a coisa que mais denuncia cenário barato;
               com 8 variantes o olho para de achar o padrão.
     2. PROPS  cristais fel, ossadas, colunas partidas, braseiros e sigilos,
               posicionados por chunk de forma DETERMINÍSTICA — o mesmo pedaço
               de mundo tem sempre os mesmos destroços, então nada "nasce" na
               sua frente quando você volta andando.
     3. AR     brasas subindo e uma vinheta que fecha os cantos.

   Tudo culado ao viewport e nada alocado por frame: os chunks visitados ficam
   num cache e as brasas vivem num anel de tamanho fixo.

   `corruption` (0..1) vem do tempo de run: o chão racha mais e o fel sobe
   conforme a Legião ganha terreno.
   ========================================================================= */

const SCENERY = {
  chunk: 620,          // lado do bloco de mundo que recebe props
  tileVariants: 8,
  maxChunkCache: 512,
  embers: 46,
};

/* Peso de cada tipo de destroço. Os que brilham e se mexem (braseiro, sigilo,
   cristal) competem com as habilidades do jogador pela atenção, então são
   raros; o que carrega o cenário são as peças escuras e paradas. */
const PROP_WEIGHTS = [
  ["bones", 26], ["spike", 22], ["pillar", 18], ["fissure", 14],
  ["crystal", 9], ["brazier", 6], ["sigil", 5],
];
const PROP_WEIGHT_TOTAL = PROP_WEIGHTS.reduce((a, p) => a + p[1], 0);
function pickProp(r) {
  let n = r * PROP_WEIGHT_TOTAL;
  for (let i = 0; i < PROP_WEIGHTS.length; i++) {
    n -= PROP_WEIGHTS[i][1];
    if (n <= 0) return PROP_WEIGHTS[i][0];
  }
  return "bones";
}

// hash inteiro estável de duas coordenadas — a base de todo o determinismo
function hash2(x, y) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
// PRNG barato semeado por um inteiro (mulberry32)
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- chão -----------------------------------------------------------------
   Placa de obsidiana: base escura, granulado, veios de fel nas fendas e um
   rebordo que dá a impressão de laje encaixada. */
function makeFelTile(variant) {
  const T = BALANCE.world.tile;
  const c = document.createElement("canvas");
  c.width = T; c.height = T;
  const x = c.getContext("2d");
  const rnd = seeded(hash2(variant + 1, 7919));

  const g = x.createLinearGradient(0, 0, T, T);
  g.addColorStop(0, "#120d1c");
  g.addColorStop(0.5, "#0d0916");
  g.addColorStop(1, "#160f22");
  x.fillStyle = g;
  x.fillRect(0, 0, T, T);

  // granulado da rocha
  for (let i = 0; i < 110; i++) {
    const px = rnd() * T, py = rnd() * T, sz = 1 + rnd() * 2.2;
    x.fillStyle = rnd() < 0.45 ? "rgba(190,180,220,0.028)" : "rgba(0,0,0,0.32)";
    x.fillRect(px, py, sz, sz);
  }

  // placas: linhas escuras cortando o tile, como junta de pedra
  x.strokeStyle = "rgba(0,0,0,0.45)";
  x.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const vert = rnd() < 0.5;
    const p = 0.25 * T + rnd() * 0.5 * T;
    x.beginPath();
    if (vert) { x.moveTo(p, 0); x.lineTo(p + (rnd() - 0.5) * 10, T); }
    else { x.moveTo(0, p); x.lineTo(T, p + (rnd() - 0.5) * 10); }
    x.stroke();
  }

  // veios de fel: o brilho vem de duas passadas, uma larga e turva por baixo
  // e uma fina e clara por cima — é o que faz parecer luz e não risco verde
  const veins = rnd() < 0.42 ? 0 : 1 + Math.floor(rnd() * 2);
  for (let v = 0; v < veins; v++) {
    const pts = [];
    let cx = rnd() * T, cy = rnd() * T;
    const dir = rnd() * Math.PI * 2;
    for (let j = 0; j < 6; j++) {
      pts.push(cx, cy);
      const a = dir + (rnd() - 0.5) * 1.6;
      cx += Math.cos(a) * (T * 0.18);
      cy += Math.sin(a) * (T * 0.18);
    }
    for (const pass of [
      { w: 5, s: "rgba(90,200,60,0.055)" },
      { w: 1.5, s: "rgba(170,240,115,0.19)" },
    ]) {
      x.strokeStyle = pass.s;
      x.lineWidth = pass.w;
      x.lineCap = "round";
      x.beginPath();
      x.moveTo(pts[0], pts[1]);
      for (let j = 2; j < pts.length; j += 2) x.lineTo(pts[j], pts[j + 1]);
      x.stroke();
    }
  }

  // marca demoníaca ocasional gravada na laje
  if (rnd() < 0.18) {
    x.save();
    x.translate(T * (0.3 + rnd() * 0.4), T * (0.3 + rnd() * 0.4));
    x.rotate(rnd() * Math.PI * 2);
    x.strokeStyle = "rgba(122,60,255,0.1)";
    x.lineWidth = 1.4;
    const r = T * 0.12;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke();
    x.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      x.moveTo(0, 0);
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.stroke();
    x.restore();
  }

  // rebordo: escurece as bordas para a laje ter volume
  const e = x.createLinearGradient(0, 0, 0, T);
  e.addColorStop(0, "rgba(255,255,255,0.03)");
  e.addColorStop(0.12, "rgba(0,0,0,0)");
  e.addColorStop(0.88, "rgba(0,0,0,0)");
  e.addColorStop(1, "rgba(0,0,0,0.35)");
  x.fillStyle = e;
  x.fillRect(0, 0, T, T);
  x.strokeStyle = "rgba(0,0,0,0.4)";
  x.lineWidth = 2;
  x.strokeRect(0.5, 0.5, T - 1, T - 1);
  return c;
}

/* --- props ---------------------------------------------------------------
   Cada chunk sorteia os seus destroços a partir do hash das coordenadas, e o
   resultado fica em cache. Determinístico: voltar ao mesmo lugar mostra a
   mesma paisagem. */
const PROP_KINDS = ["crystal", "bones", "pillar", "brazier", "sigil", "fissure", "spike"];

/* Props sem animação são renderizados UMA vez num canvas e depois só
   copiados. Sem isso, cada coluna na tela criaria um CanvasGradient por
   frame — sessenta alocações por segundo por pedra, em código quente. */
const STATIC_PROPS = { bones: 1, pillar: 1, spike: 1 };
const PROP_CACHE = new Map();
const PROP_W = 112, PROP_AX = 56, PROP_AY = 84;

function propSprite(kind, variant) {
  const key = kind + variant;
  let sp = PROP_CACHE.get(key);
  if (sp) return sp;
  const cv = document.createElement("canvas");
  cv.width = PROP_W; cv.height = PROP_W;
  const x = cv.getContext("2d");
  PROPS[kind](x, PROP_AX, PROP_AY, { s: 1, a: variant * 1.7, seed: variant / 4 }, 0, 0);
  sp = { canvas: cv };
  PROP_CACHE.set(key, sp);
  return sp;
}

class Scenery {
  constructor() {
    this.chunks = new Map();
    this.tiles = null;
    this.embers = null;
    this.corruption = 0;
  }

  build() {
    this.tiles = [];
    for (let i = 0; i < SCENERY.tileVariants; i++) this.tiles.push(makeFelTile(i));
    // anel fixo de brasas: nunca aloca, só reposiciona quem sai de vista
    this.embers = [];
    for (let i = 0; i < SCENERY.embers; i++) {
      this.embers.push({ x: 0, y: 0, t: Math.random(), sp: 0.15 + Math.random() * 0.35,
                         drift: (Math.random() - 0.5) * 26, size: 0.8 + Math.random() * 1.8,
                         seeded: false });
    }
  }

  reset() { this.chunks.clear(); if (this.embers) for (const e of this.embers) e.seeded = false; }

  _chunk(cx, cy) {
    const key = cx + "," + cy;
    let props = this.chunks.get(key);
    if (props) return props;
    if (this.chunks.size > SCENERY.maxChunkCache) this.chunks.clear();

    const C = SCENERY.chunk;
    const rnd = seeded(hash2(cx, cy));
    props = [];
    // boa parte dos blocos fica vazia de proposito: o vazio e o que faz os
    // destroços que existem parecerem colocados, e não espalhados
    const n = rnd() < 0.34 ? 0 : 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const kind = pickProp(rnd());
      props.push({
        kind,
        x: cx * C + 24 + rnd() * (C - 48),
        y: cy * C + 24 + rnd() * (C - 48),
        s: 0.7 + rnd() * 0.75,       // escala
        a: rnd() * Math.PI * 2,      // rotação
        seed: rnd(),
        variant: Math.floor(rnd() * 4),
      });
    }
    this.chunks.set(key, props);
    return props;
  }

  /* Chão + props. Desenhado antes de tudo: é terreno, não entidade. */
  draw(ctx, cam, t) {
    const T = BALANCE.world.tile;
    const left = cam.left, top = cam.top;
    const x0 = Math.floor(left / T), y0 = Math.floor(top / T);
    const x1 = Math.floor((left + cam.w) / T), y1 = Math.floor((top + cam.h) / T);

    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const v = hash2(gx, gy) % SCENERY.tileVariants;
        ctx.drawImage(this.tiles[v], gx * T - left, gy * T - top);
      }
    }

    const C = SCENERY.chunk;
    const cx0 = Math.floor(left / C), cy0 = Math.floor(top / C);
    const cx1 = Math.floor((left + cam.w) / C), cy1 = Math.floor((top + cam.h) / C);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const props = this._chunk(cx, cy);
        for (let i = 0; i < props.length; i++) {
          const p = props[i];
          const sx = p.x - left, sy = p.y - top;
          if (sx < -90 || sy < -110 || sx > cam.w + 90 || sy > cam.h + 90) continue;
          if (STATIC_PROPS[p.kind]) {
            const sp = propSprite(p.kind, p.variant), d = PROP_W * p.s;
            ctx.drawImage(sp.canvas, sx - PROP_AX * p.s, sy - PROP_AY * p.s, d, d);
          } else {
            PROPS[p.kind](ctx, sx, sy, p, t, this.corruption);
          }
        }
      }
    }
  }

  /* Brasas de fel subindo. Vivem em volta da câmera; quem sai por cima volta
     por baixo, então o campo parece infinito com 90 partículas. */
  drawEmbers(ctx, cam, t, dt) {
    const n = Math.round(SCENERY.embers * (0.45 + this.corruption * 0.55));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const e = this.embers[i];
      if (!e.seeded) {
        e.x = cam.left + Math.random() * cam.w;
        e.y = cam.top + Math.random() * cam.h;
        e.seeded = true;
      }
      e.y -= (18 + e.sp * 40) * dt;
      e.x += Math.sin(t * e.sp + i) * e.drift * dt;
      let sx = e.x - cam.left, sy = e.y - cam.top;
      // reenvolve nos dois eixos: a câmera anda, as brasas não podem ficar para trás
      if (sy < -20) { e.y = cam.top + cam.h + 20; e.x = cam.left + Math.random() * cam.w; sy = cam.h + 20; }
      if (sx < -40) { e.x += cam.w + 80; sx += cam.w + 80; }
      else if (sx > cam.w + 40) { e.x -= cam.w + 80; sx -= cam.w + 80; }
      const k = 0.35 + Math.sin(t * 2 + i * 1.7) * 0.3;
      ctx.globalAlpha = k * (0.24 + this.corruption * 0.34);
      ctx.fillStyle = i % 5 === 0 ? "#c88aff" : "#a8ff6a";
      ctx.beginPath();
      ctx.arc(sx, sy, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* Vinheta + tinta fel nos cantos. Fecha o quadro e esconde a borda do
     mundo procedural; aperta conforme a run apodrece. */
  drawAtmosphere(ctx, cam) {
    const w = cam.w, h = cam.h;
    if (!this._vig || this._vigW !== w || this._vigH !== h) {
      this._vigW = w; this._vigH = h;
      this._vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34,
                                           w / 2, h / 2, Math.max(w, h) * 0.78);
      this._vig.addColorStop(0, "rgba(0,0,0,0)");
      this._vig.addColorStop(0.65, "rgba(6,2,10,0.34)");
      this._vig.addColorStop(1, "rgba(3,1,6,0.76)");
    }
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, w, h);

    const k = this.corruption;
    if (k > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.05 + k * 0.09;
      if (!this._fel || this._felW !== w) {
        this._felW = w;
        this._fel = ctx.createRadialGradient(w / 2, h * 1.15, h * 0.2,
                                             w / 2, h * 1.15, h * 1.1);
        this._fel.addColorStop(0, "rgba(120,255,90,0.55)");
        this._fel.addColorStop(1, "rgba(60,180,40,0)");
      }
      ctx.fillStyle = this._fel;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}

/* --- desenho de cada prop -------------------------------------------------
   Assinatura: (ctx, sx, sy, p, t, corruption). Nada guarda estado: a animação
   sai de `t` e de `p.seed`, então dois braseiros nunca piscam em sincronia. */
const PROPS = {

  // aglomerado de cristais fel espetados no chão
  crystal(ctx, sx, sy, p, t) {
    const s = p.s, k = 0.6 + Math.sin(t * 1.4 + p.seed * 9) * 0.4;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.1 + k * 0.09;
    const w = 26 * s;
    ctx.drawImage(glowBlob("#7fdc4a"), sx - w, sy - w * 0.8, w * 2, w * 1.6);
    ctx.restore();

    for (let i = 0; i < 3; i++) {
      const a = p.a + i * 2.1;
      const bx = sx + Math.cos(a) * 7 * s, by = sy + Math.sin(a) * 3 * s;
      const hgt = (16 + i * 6) * s;
      const wid = 4 * s;
      ctx.beginPath();
      ctx.moveTo(bx, by - hgt);
      ctx.lineTo(bx + wid, by);
      ctx.lineTo(bx, by + 3 * s);
      ctx.lineTo(bx - wid, by);
      ctx.closePath();
      const g = ctx.createLinearGradient(bx, by - hgt, bx, by);
      g.addColorStop(0, "#d8ff9e");
      g.addColorStop(0.5, "#6fdc4a");
      g.addColorStop(1, "#1d3d14");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(216,255,158,0.5)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  },

  // ossada: crânio e costelas do que sobrou de alguém
  bones(ctx, sx, sy, p) {
    const s = p.s;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.a * 0.3);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(0, 3 * s, 16 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "#cfc8b0";
    ctx.lineWidth = 1.6 * s;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const rx = (-10 + i * 6) * s;
      ctx.beginPath();
      ctx.arc(rx, 0, 6 * s, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    // crânio
    ctx.fillStyle = "#ded7c0";
    ctx.beginPath(); ctx.ellipse(-16 * s, -1 * s, 5.5 * s, 4.6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a1f14";
    ctx.beginPath();
    ctx.arc(-17.6 * s, -1.6 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.arc(-14.2 * s, -1.6 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // coluna partida, com o fel escorrendo pela fratura
  pillar(ctx, sx, sy, p) {
    const s = p.s, w = 13 * s, h = 40 * s;
    drawShadow(ctx, sx, sy, w * 1.1);
    const g = ctx.createLinearGradient(sx - w, 0, sx + w, 0);
    g.addColorStop(0, "#0b0812");
    g.addColorStop(0.45, "#2a2338");
    g.addColorStop(1, "#0e0a16");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - w, sy);
    ctx.lineTo(sx - w * 0.8, sy - h);
    ctx.lineTo(sx - w * 0.1, sy - h * (0.82 + p.seed * 0.16));   // topo quebrado
    ctx.lineTo(sx + w * 0.75, sy - h * 0.92);
    ctx.lineTo(sx + w, sy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(150,255,110,0.3)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.3, sy - h * 0.85);
    ctx.lineTo(sx + w * 0.15, sy - h * 0.5);
    ctx.lineTo(sx - w * 0.2, sy - h * 0.15);
    ctx.stroke();
  },

  // braseiro de fogo fel, a chama lambendo em tempo real
  brazier(ctx, sx, sy, p, t) {
    const s = p.s;
    drawShadow(ctx, sx, sy, 11 * s);
    ctx.fillStyle = "#241c33";
    ctx.beginPath();
    ctx.moveTo(sx - 9 * s, sy);
    ctx.lineTo(sx - 6 * s, sy - 12 * s);
    ctx.lineTo(sx + 6 * s, sy - 12 * s);
    ctx.lineTo(sx + 9 * s, sy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a2f52";
    ctx.fillRect(sx - 10 * s, sy - 14 * s, 20 * s, 3 * s);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const ph = t * 3 + p.seed * 10;
    for (let i = 0; i < 4; i++) {
      const k = (ph + i * 0.55) % 1;
      const fy = sy - 15 * s - k * 22 * s;
      const fw = (5.5 - k * 4) * s;
      ctx.globalAlpha = (1 - k) * 0.75;
      ctx.fillStyle = i % 2 ? "#d8ff9e" : "#6fdc4a";
      ctx.beginPath();
      ctx.ellipse(sx + Math.sin(ph * 2 + i) * 2.5 * s, fy, fw, fw * 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.15;
    const w = 24 * s;
    ctx.drawImage(glowBlob("#7fdc4a"), sx - w, sy - 22 * s - w, w * 2, w * 2);
    ctx.restore();
  },

  // sigilo gravado no chão, girando devagar
  sigil(ctx, sx, sy, p, t, corr) {
    const s = p.s, r = 26 * s;
    const k = 0.5 + Math.sin(t * 0.8 + p.seed * 6) * 0.5;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.42);
    ctx.rotate(p.a + t * 0.12);
    ctx.strokeStyle = `rgba(122,60,255,${(0.1 + k * 0.09 + corr * 0.08).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(160,255,120,${(0.07 + k * 0.1).toFixed(3)})`;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.lineTo(Math.cos(a + 1.25) * r, Math.sin(a + 1.25) * r);
      ctx.stroke();
    }
    ctx.restore();
  },

  // fenda no basalto com fel correndo por dentro
  fissure(ctx, sx, sy, p, t, corr) {
    const s = p.s;
    const k = 0.55 + Math.sin(t * 1.6 + p.seed * 12) * 0.45;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.a);
    const len = 54 * s;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 7 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(-len * 0.15, -5 * s);
    ctx.lineTo(len * 0.2, 4 * s);
    ctx.lineTo(len / 2, -2 * s);
    ctx.stroke();
    ctx.strokeStyle = `rgba(170,255,110,${(0.18 + k * 0.2 + corr * 0.14).toFixed(3)})`;
    ctx.lineWidth = 2.2 * s;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.06 + k * 0.07;
    const w = 30 * s;
    ctx.drawImage(glowBlob("#7fdc4a"), sx - w, sy - w * 0.45, w * 2, w * 0.9);
    ctx.restore();
  },

  // lasca de obsidiana saindo do chão
  spike(ctx, sx, sy, p) {
    const s = p.s, h = 26 * s, w = 7 * s;
    drawShadow(ctx, sx, sy, w * 1.3);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((p.seed - 0.5) * 0.4);
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, "#080610");
    g.addColorStop(0.5, "#241d33");
    g.addColorStop(1, "#0c0914");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w, 2 * s);
    ctx.lineTo(-w, 2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(140,120,190,0.22)";
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(-w * 0.3, 2 * s); ctx.stroke();
    ctx.restore();
  },
};
