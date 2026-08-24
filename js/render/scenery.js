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
  tileVariants: TILE_ROWS.length,
  maxChunkCache: 512,
  embers: 24,
};

/* Peso de cada tipo de destroço. Os que brilham e se mexem (braseiro, sigilo,
   cristal) competem com as habilidades do jogador pela atenção, então são
   raros; o que carrega o cenário são as peças escuras e paradas.

   Mesma regra vale para o brilho de cada um: o cenário é lido de relance e
   nunca é decisão de jogo, então tudo aqui vive numa faixa de luz abaixo do
   que o jogador conjura. Quando o chão brilha tanto quanto uma explosão, a
   explosão para de significar alguma coisa. */
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
   A laje não é mais gerada: ela é uma das grades de `TILE_ROWS`, desenhada
   célula a célula em PIXEL DE BUFFER — 42x42, que é `BALANCE.world.tile` sobre
   `PIXEL_UNIT`. Gerada grande e reduzida no blit, perderia dois de cada três
   pixels e o granulado viraria chiado.

   `flip` é o espelho (bit 0 horizontal, bit 1 vertical). Ele existe porque oito
   lajes são oito carimbos: o mesmo grão cai no mesmo ponto de toda repetição e
   o olho acha a treliça. Espelhar é inteiro, então não sai do grid, e devolve
   trinta e duas leituras a partir de oito. */
function makeFelTile(variant, flip) {
  const rows = TILE_ROWS[((variant % TILE_ROWS.length) + TILE_ROWS.length) % TILE_ROWS.length];
  const f = flip | 0;
  const n = TILE_SIZE;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d");
  for (let cy = 0; cy < n; cy++) {
    const row = rows[f & 2 ? n - 1 - cy : cy];
    for (let cx = 0; cx < n; cx++) {
      const col = TILE_PAL[row[f & 1 ? n - 1 - cx : cx]];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(cx, cy, 1, 1);
    }
  }
  return c;
}

/* --- props ---------------------------------------------------------------
   Cada chunk sorteia os seus destroços a partir do hash das coordenadas, e o
   resultado fica em cache. Determinístico: voltar ao mesmo lugar mostra a
   mesma paisagem. */
const PROP_KINDS = ["crystal", "bones", "pillar", "brazier", "sigil", "fissure", "spike"];

/* Cada tipo tem UM canvas por espelho, feito uma vez. Não há mais degrau de
   tamanho: a grade é desenhada 1 célula = 1 pixel de buffer e ponto, que é o
   mesmo degrau de todo o resto do elenco. O `s` contínuo do chunk deixou de
   escalar arte — ele agora só existe para quem não tem grade. */
const PROP_CACHE = new Map();

function propSprite(kind, flip) {
  const key = kind + (flip & 1);
  let sp = PROP_CACHE.get(key);
  if (sp) return sp;
  const art = PROP_ART[kind];
  const rows = art.rows, h = rows.length, w = rows[0].length;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const x = cv.getContext("2d");
  for (let cy = 0; cy < h; cy++) {
    const row = rows[cy];
    for (let cx = 0; cx < w; cx++) {
      const col = art.pal[row[flip & 1 ? w - 1 - cx : cx]];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(cx, cy, 1, 1);
    }
  }
  // `ax/ay` sao onde o objeto TOCA o chao dentro do canvas, em unidades de
  // mundo: o pe de quem fica em pe, o centro de quem esta deitado
  sp = { canvas: cv, w: w * PIXEL_GRID, h: h * PIXEL_GRID,
         ax: (w / 2) * PIXEL_GRID,
         ay: (art.foot === "mid" ? h / 2 : h) * PIXEL_GRID };
  PROP_CACHE.set(key, sp);
  return sp;
}

/* O que ACENDE em cima do sprite, e só isso. A grade não carrega brilho: glow
   desenhado na arte vaza para fora da silhueta e apaga onde o objeto termina.
   `r` é o raio do halo em unidades de mundo, `y` sobe o centro dele, `sp` é a
   velocidade do pulso e `a` a alpha no pico. */
const PROP_GLOW = {
  crystal: { color: AXIS_PALETTE.corruption.base, r: 26, y: 14, sp: 1.4, a: 0.11 },
  brazier: { color: AXIS_PALETTE.corruption.base, r: 24, y: 30, sp: 3.0, a: 0.13 },
  fissure: { color: AXIS_PALETTE.corruption.base, r: 22, y: 0, sp: 1.6, a: 0.09 },
  sigil:   { color: AXIS_PALETTE.dominion.base,   r: 30, y: 0, sp: 0.8, a: 0.07 },
};

/* Quem projeta sombra é quem fica EM PÉ. Marca deitada no chão não tem por que
   ter sombra — ela é o chão. */
const PROP_SHADOW = { pillar: 1, spike: 1, brazier: 1, crystal: 1 };

class Scenery {
  constructor() {
    this.chunks = new Map();
    this.tiles = null;
    this.embers = null;
    this.corruption = 0;
  }

  build() {
    // uma entrada por variante, e dentro dela os quatro espelhos: sortear o
    // espelho no draw obrigaria a mexer na transform do ctx por laje desenhada
    this.tiles = [];
    for (let i = 0; i < SCENERY.tileVariants; i++) {
      const forms = [];
      for (let f = 0; f < 4; f++) forms.push(makeFelTile(i, f));
      this.tiles.push(forms);
    }
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
        // a grade não escala nem gira: o que varia é o lado
        seed: rnd(),
        variant: rnd() < 0.5 ? 0 : 1,
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
        // o bolo é pesado: laje com veio ou runa é marca singular e sai uma
        // vez para cada cinco de pedra lisa
        const h = hash2(gx, gy);
        const v = TILE_BAG[h % TILE_BAG.length];
        // Dest in world units: the slab canvas is now smaller than T.
        ctx.drawImage(this.tiles[v][(h >>> 8) & 3], gx * T - left, gy * T - top, T, T);
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
          const sp = propSprite(p.kind, p.variant);
          if (PROP_SHADOW[p.kind]) drawShadow(ctx, sx, sy, sp.w * 0.34);
          ctx.drawImage(sp.canvas, snapUnit(sx - sp.ax), snapUnit(sy - sp.ay), sp.w, sp.h);
          const gl = PROP_GLOW[p.kind];
          if (gl) {
            const k = 0.55 + Math.sin(t * gl.sp + p.seed * 11) * 0.45;
            const r = gl.r * (1 + this.corruption * 0.25);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = gl.a * (0.5 + k * 0.5);
            ctx.drawImage(glowBlob(gl.color), sx - r, sy - gl.y - r, r * 2, r * 2);
            ctx.restore();
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
      ctx.globalAlpha = k * (0.11 + this.corruption * 0.17);
      /* A brasa no ar e do MUNDO, e o mundo e da Legiao: fel com uma em cada
         cinco arcana. As duas saem de AXIS_PALETTE em vez de serem dois hexes
         proprios — cenario que inventa a propria cor e a decima-nona paleta
         que a `PAL` existe para nao deixar acontecer. */
      ctx.fillStyle = i % 5 === 0 ? AXIS_PALETTE.dominion.light : AXIS_PALETTE.corruption.light;
      ctx.beginPath();
      ctx.arc(sx, sy, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* Vinheta + tinta fel nos cantos. Fecha o quadro e esconde a borda do
     mundo procedural; aperta conforme a run apodrece. */
  drawAtmosphere(ctx, cam, low) {
    const w = cam.w, h = cam.h;
    if (!this._vig || this._vigW !== w || this._vigH !== h) {
      this._vigW = w; this._vigH = h;
      this._vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34,
                                           w / 2, h / 2, Math.max(w, h) * 0.78);
      this._vig.addColorStop(0, "rgba(0,0,0,0)");
      this._vig.addColorStop(0.65, "rgba(6,2,10,0.42)");
      this._vig.addColorStop(1, "rgba(3,1,6,0.84)");
    }
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, w, h);

    const k = this.corruption;
    if (k > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.03 + k * 0.06;
      if (!this._fel || this._felW !== w) {
        this._felW = w;
        this._fel = ctx.createRadialGradient(w / 2, h * 1.15, h * 0.2,
                                             w / 2, h * 1.15, h * 1.1);
        // o veio no horizonte: a mesma familia da brasa, saindo da paleta
        this._fel.addColorStop(0, `rgba(${hexRgb(AXIS_PALETTE.corruption.light)},0.55)`);
        this._fel.addColorStop(1, `rgba(${hexRgb(AXIS_PALETTE.corruption.deep)},0)`);
      }
      ctx.fillStyle = this._fel;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    /* VIDA BAIXA. A borda fecha em vermelho no mesmo compasso em que a barra
       do rodape desbota — a curva e uma so (`Game.lowHpPulse`), entao os dois
       leem como um evento e nao como duas animacoes que coincidem.

       Ela mora AQUI, na vinheta que ja existe, e nao numa camada nova: o que
       o jogo esta dizendo e que o mundo fechou em volta de voce, e isso e
       literalmente o que a vinheta desenha. Sem desfoque e sem `lighter` —
       vermelho aceso leria como spell, e nenhuma spell do jogo e vermelha. */
    if (low > 0.001) {
      if (!this._peri || this._periW !== w || this._periH !== h) {
        this._periW = w; this._periH = h;
        this._peri = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4,
                                              w / 2, h / 2, Math.max(w, h) * 0.72);
        const rgb = hexRgb(UI_PAL.vida);
        this._peri.addColorStop(0, `rgba(${rgb},0)`);
        this._peri.addColorStop(1, `rgba(${rgb},1)`);
      }
      ctx.save();
      ctx.globalAlpha = BALANCE.vidaBaixa.vinheta * low;
      ctx.fillStyle = this._peri;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}


