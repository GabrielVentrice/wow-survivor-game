"use strict";
/* =========================================================================
   FX SHAPES — o gerador de EVENTOS em pixel.

   A explosao ja era gerada assim: um campo de calor amostrado numa grade, com
   silhueta irregular vinda de harmonicos no angulo, quantizado em quatro
   bandas e desenhado celula a celula. O que ela nao era e GENERICA — era uma
   funcao chamada `buildExplosionFrame`, e por isso o jogo inteiro tinha UMA
   forma de evento: dezesseis pecas emitindo a mesma bola de fogo, distinguidas
   so pela matiz do eixo. E como matiz e predicado do eixo, duas pecas do mesmo
   eixo saiam identicas.

   Aqui a mesma maquina passa a aceitar mais de um formato. Um arquetipo declara
   duas funcoes e o resto e compartilhado:

     begin(u, variant, half)  -> `st`, o estado daquele quadro
     depth(st, dx, dy)        -> 0..1, quanto aquela celula esta acesa

   Tudo o mais — o tamanho da grade, a rampa de quatro bandas, a quantizacao, o
   cache por (forma, cor, grade), as variantes e o espelho no blit — e o mesmo
   para todos, que e justamente o que faz quatro formas custarem o que uma
   custava.

   **O `bloom` e a explosao de hoje, celula por celula.** A extracao foi
   mecanica de proposito e `driver_vfx` guarda o campo dela contra um hash: uma
   forma nova nao pode mexer na forma que ja esta no jogo.

   Nada aqui roda por frame. Cada conjunto e gerado na primeira vez que aquela
   cor e aquele tamanho aparecem, e dali em diante o render escolhe um canvas e
   faz um blit.
   ========================================================================= */

const EXPLO = { GRID: 40, GRIDS: [16, 24, 32, 40, 56], FRAMES: 8, VARIANTS: 3, SHARDS: 12 };

// Maior grade que ainda cabe no tamanho pedido (em pixels de buffer).
function explosionGrid(px) {
  const g = EXPLO.GRIDS;
  let best = g[0];
  for (let i = 0; i < g.length; i++) if (g[i] <= px) best = g[i];
  return best;
}

/* Bandas de um quadro. A alpha ja vem embutida: a cauda da animacao e mais
   fraca, entao a camada de render desenha todo quadro com opacidade cheia. */
function fxRamp(color, u) {
  const tail = 1 - Math.pow(u, 2.2) * 0.62;
  const band = (hex, a) => `rgba(${hexRgb(hex)},${(a * tail).toFixed(3)})`;
  return [
    band("#ffffff", 1),                        // nucleo: so enquanto esta quente
    band(paleHex(color, 0.6), 0.96),           // aro logo fora do nucleo
    band(color, 0.88),                         // o corpo
    band(mixHex(color, "#1a0e16", 0.55), 0.6), // a borda ja apagando
  ];
}

/* Harmonicos no angulo: e o que faz a borda ser rasgada em vez de circular, e
   o que faz cada variante ser um evento diferente. As fases andam com `u`, o
   que revolve a forma entre quadros em vez de so escala-la. */
function fxLobe(variant, base, amp, churn) {
  const p1 = vfxRand(variant * 71 + 1) * 6.28, p2 = vfxRand(variant * 71 + 2) * 6.28;
  const p3 = vfxRand(variant * 71 + 3) * 6.28, p4 = vfxRand(variant * 71 + 4) * 6.28;
  return (a) => base + amp * (
      0.10 * Math.sin(a * 3 + p1 + churn)
    + 0.07 * Math.sin(a * 5 - p2 - churn * 1.6)
    + 0.05 * Math.sin(a * 7 + p3)
    + 0.06 * Math.sin(a * 2 + p4 + churn * 0.5));
}

const FX_SHAPES = {

  /* --- bloom: a detonacao ------------------------------------------------
     A bola queima em calor cheio enquanto se expande e so entao da lugar a uma
     casca que sai voando. O repasse e o que esvazia a explosao por dentro:
     nada subtrai um buraco, o meio simplesmente para de estar em fogo. */
  bloom: {
    shards: EXPLO.SHARDS,
    cool: (u) => 1.35 - u * 0.85,
    begin(u, variant, half) {
      const grow = 1 - Math.pow(1 - u, 2.4);      // estoura rapido e desacelera
      const R = half * (0.22 + 0.47 * grow);
      // a amplitude cresce com `u`: o que comeca como bola levemente irregular
      // termina como arcos rasgados, que e o ultimo quadro fazendo algo alem
      // de sumir
      const amp = 1 + u * 1.1;
      return {
        R, grow, amp, u,
        lobe: fxLobe(variant, 0.84, amp, u * 0.7),
        bound: R * (0.84 + amp * 0.28),
        ballW: clamp((0.62 - u) / 0.32, 0, 1),
        ringW: clamp((u - 0.18) / 0.25, 0, 1),
        ringAt: 0.6 + u * 0.32,
        ringHalf: 0.5 - u * 0.28,
      };
    },
    depth(st, dx, dy) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > st.bound) return 0;
      const edge = st.R * st.lobe(Math.atan2(dy, dx));
      if (dist > edge) return 0;
      const rel = dist / edge;
      return Math.max((1 - rel) * st.ballW,
                      (1 - Math.abs(rel - st.ringAt) / st.ringHalf) * st.ringW);
    },
  },

  /* --- implode: a detonacao ao contrario ---------------------------------
     Uma casca que CONVERGE e um nucleo que so acende no fim. E o oposto do
     bloom em todas as tres curvas — o raio nao cresce, a casca afina indo para
     dentro, e o calor sobe em vez de cair. E por isso que ela le como algo
     sendo engolido e nao como algo estourando: o clarao chega DEPOIS.

     Serve Implosion, Voraz, Nihilam e o Doom fechando. */
  implode: {
    shards: 10,
    inward: true,
    lateFlash: true,        // o clarao chega no fim; ver drawFxEvent
    cool: (u) => 0.55 + u * 0.95,
    begin(u, variant, half) {
      const R = half * 0.74;
      // a borda TRANQUILIZA em vez de rasgar: o que esta se fechando fica mais
      // liso, nao mais irregular
      const amp = 1.05 - u * 0.6;
      return {
        R, grow: u, amp, u,
        lobe: fxLobe(variant, 0.9, amp, u * 0.4),
        bound: R * (0.9 + amp * 0.28),
        /* As duas janelas nao se sobrepoem, e e isso que faz o evento ter um
           FIM: a casca morre chegando perto do centro e so entao o nucleo
           acende, num clarao que tambem apaga. Sem as duas portas o ultimo
           quadro ficava um disco cheio parado — colapso sem colapsar. */
        ringW: clamp((1 - u) / 0.26, 0, 1),
        coreW: clamp((u - 0.55) / 0.2, 0, 1) * clamp((1.12 - u) / 0.3, 0, 1),
        ringAt: 0.96 - u * 0.84,
        ringHalf: 0.24 - u * 0.16,
      };
    },
    depth(st, dx, dy) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > st.bound) return 0;
      const edge = st.R * st.lobe(Math.atan2(dy, dx));
      if (dist > edge) return 0;
      const rel = dist / edge;
      return Math.max((1 - rel) * st.coreW,
                      (1 - Math.abs(rel - st.ringAt) / st.ringHalf) * st.ringW);
    },
  },

  /* --- nova: o anel varrendo ---------------------------------------------
     So a casca, nunca o miolo. Ela nao tem centro porque o que ela informa e
     ate onde chegou, e um miolo aceso competiria com essa leitura. Sai rapido
     e desacelera, afinando — o anel fino do fim e o que diz "acabou aqui".

     Serve Shadowfury, atordoamento em area, Howl of Terror. */
  nova: {
    cool: (u) => 1.3 - u * 0.8,
    begin(u, variant, half) {
      const grow = 1 - Math.pow(1 - u, 3);
      const R = half * (0.2 + 0.8 * grow);
      const amp = 0.45 + u * 0.25;             // anel limpo: quase sem rasgo
      return {
        R, grow, amp, u,
        lobe: fxLobe(variant, 0.95, amp, u * 0.25),
        bound: R * (0.95 + amp * 0.28),
        ringHalf: 0.24 - u * 0.2,
      };
    },
    depth(st, dx, dy) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > st.bound) return 0;
      const edge = st.R * st.lobe(Math.atan2(dy, dx));
      if (dist > edge) return 0;
      return 1 - Math.abs(dist / edge - 0.9) / st.ringHalf;
    },
  },

  /* --- rip: o talho -------------------------------------------------------
     A unica forma que NAO e radial, e e por isso que ela existe: com quatro
     arquetipos redondos o catalogo continuaria tendo uma silhueta so. Uma
     fenda vertical abre, alcanca a largura maxima na metade da vida e fecha —
     o eixo dela e vertical de proposito, porque tudo o mais em tela e
     horizontal (o chao, a horda, o rastro do projetil).

     Serve Malefic Rapture, execucao, Unstable Affliction. */
  rip: {
    shards: 8,
    cool: (u) => 1.25 - u * 0.55,
    begin(u, variant, half) {
      const H = half * (0.34 + 0.66 * (1 - Math.pow(1 - u, 2.2)));
      const W = half * (0.05 + 0.26 * Math.sin(Math.PI * Math.min(1, u * 1.05)));
      const p = vfxRand(variant * 71 + 5) * 6.28;
      return {
        H, W, u, R: H, grow: u, amp: 1,
        lobe: () => 1,
        bound: H * 1.02,
        // a fenda serrilha ao longo do proprio comprimento, nao em volta
        jag: (dy) => 1 + 0.28 * Math.sin(dy * 0.9 + p) + 0.16 * Math.sin(dy * 2.1 - p),
      };
    },
    depth(st, dx, dy) {
      const ay = Math.abs(dy);
      if (ay > st.H) return 0;
      const taper = 1 - (ay / st.H) * (ay / st.H);       // lente: cheia no meio
      const w = st.W * taper * st.jag(dy);
      if (w <= 0.4) return 0;
      const ax = Math.abs(dx);
      if (ax > w) return 0;
      return 1 - ax / w;
    },
  },
};

/* O campo de um quadro: uma banda por celula, 255 = vazia.

   Ele existe separado do desenho por dois motivos. Um: e o que `driver_vfx`
   compara contra o hash de referencia, entao a forma que ja esta no jogo nao
   pode ser mexida sem alguem perceber. Dois: o painter passa a ser um so para
   todos os arquetipos, e a unica coisa que muda entre eles e este campo. */
function fxField(shape, variant, frame, grid) {
  const S = FX_SHAPES[shape], G = grid, half = G / 2;
  const u = frame / (EXPLO.FRAMES - 1);
  const st = S.begin(u, variant, half);
  const cool = S.cool ? S.cool(u) : 1;
  const out = new Uint8Array(G * G).fill(255);
  for (let py = 0; py < G; py++) {
    for (let px = 0; px < G; px++) {
      const d = S.depth(st, px + 0.5 - half, py + 0.5 - half);
      if (d <= 0) continue;
      const t = d * cool;
      out[py * G + px] = t > 1.0 ? 0 : t > 0.72 ? 1 : t > 0.34 ? 2 : 3;
    }
  }
  return out;
}

/* Estilhacos jogados para fora (ou puxados para dentro) do corpo do evento.
   Cada um e um pixel MAIS o pixel que ele acabou de deixar para tras, que e o
   que faz ele ler como algo em movimento em vez de um ponto aceso. */
function fxDebris(x, S, st, variant, u, ramp, half) {
  const n = S.shards;
  for (let i = 0; i < n; i++) {
    const s = variant * 211 + i * 17;
    const a = (i / n) * Math.PI * 2 + (vfxRand(s + 5) - 0.5) * 0.9;
    const sp = 0.7 + vfxRand(s + 6) * 0.9;
    const d = S.inward
      ? st.R * (1.35 - sp * st.grow * 0.9)
      : st.R * (0.9 + sp * st.grow * 0.75);
    if (d > half - 2 || d < st.R * st.lobe(a)) continue;   // ainda dentro do fogo
    const ca = Math.cos(a), sa = Math.sin(a);
    const sz = vfxRand(s + 7) > 0.75 && u < 0.5 ? 2 : 1;
    x.fillStyle = ramp[u < 0.35 ? 1 : u < 0.7 ? 2 : 3];
    x.fillRect(Math.round(half + ca * d), Math.round(half + sa * d), sz, sz);
    x.fillStyle = ramp[3];
    const back = S.inward ? d + 2 : d - 2;
    x.fillRect(Math.round(half + ca * back), Math.round(half + sa * back), 1, 1);
  }
}

function buildFxFrame(shape, variant, frame, color, grid) {
  const S = FX_SHAPES[shape], G = grid, half = G / 2;
  const u = frame / (EXPLO.FRAMES - 1);
  const ramp = fxRamp(color, u);
  const field = fxField(shape, variant, frame, G);

  const c = document.createElement("canvas");
  c.width = G; c.height = G;
  const x = c.getContext("2d");
  let cur = -1;
  for (let py = 0; py < G; py++) {
    for (let px = 0; px < G; px++) {
      const band = field[py * G + px];
      if (band === 255) continue;
      if (cur !== band) { cur = band; x.fillStyle = ramp[band]; }
      x.fillRect(px, py, 1, 1);
    }
  }
  if (S.shards && frame > 0) {
    fxDebris(x, S, S.begin(u, variant, half), variant, u, ramp, half);
  }
  return c;
}

/* Cache por (forma, cor, grade). O tamanho pedido escolhe a grade: o evento
   nasce JA com o numero de celulas que vai ocupar no buffer, entao o blit e
   1:1 e as celulas continuam quadradas como as de todo sprite do jogo. */
const FX_SETS = new Map();
function fxFrames(shape, color, grid) {
  const G = grid || EXPLO.GRID;
  const key = shape + "|" + color + "@" + G;
  let set = FX_SETS.get(key);
  if (set) return set;
  set = [];
  for (let v = 0; v < EXPLO.VARIANTS; v++) {
    const frames = [];
    for (let f = 0; f < EXPLO.FRAMES; f++) frames.push(buildFxFrame(shape, v, f, color, G));
    set.push(frames);
  }
  FX_SETS.set(key, set);
  return set;
}

// O nome antigo continua: a explosao e o `bloom`, e o resto do jogo nao
// precisa saber que ela virou um caso de uma familia.
function explosionFrames(color, grid) { return fxFrames("bloom", color, grid); }
