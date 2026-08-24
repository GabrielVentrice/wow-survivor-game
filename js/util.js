"use strict";
/* =========================================================================
   UTIL — helpers puros, sem dependencia de nada. Carrega primeiro.
   ========================================================================= */

// `?mode=dev` na URL libera painel de debug no menu
const DEV_MODE = new URLSearchParams(location.search).get("mode") === "dev";

const EMPTY_ARR = [];            // sentinela p/ render nao alocar por frame
const PULSE_LIFE = 0.9;          // duracao da onda de choque de desbloqueio
/* Quanto tempo o corpo fica na pose de cast por disparo. Curto de proposito:
   com uma build grande as pecas disparam quase o tempo todo, e uma pose longa
   viraria a pose PADRAO — a de bracos caidos e que passaria a ser o evento. */
const CAST_POSE = 0.22;
/* Cadencia minima entre duas poses, pela MESMA razao que `hitstop.cooldown`
   existe: uma build madura dispara quase continuamente, e sem intervalo a pose
   de cast deixaria de ser evento para virar o estado normal do personagem — a
   caminhada e que passaria a ser a excecao. */
const CAST_GAP = 0.85;
// Quantas pecas desenham adorno em volta do warlock ao mesmo tempo. Cada uma
// custa luz no chao e uma nuvem de particulas; passando disso o personagem
// some dentro da propria build e o jogador perde a unica coisa que ele
// precisa achar na tela. As demais continuam existindo na cor do halo.
const MAX_PIECE_VFX = 3;
const DEFAULT_FORMS = [{ sprite: "warlock", caps: 0, scale: 2.9 }];

/* XP para sair do nível `l`.

   A curva anterior era quadrática forte (nível 20 custava 183, nível 30
   custava 395), então os níveis secavam exatamente quando a build deveria
   estar explodindo. Numa run de 15 min o jogador chegava ao nível ~20, ou
   seja ~20 escolhas — e uma evolução sozinha custa 5 escolhas no MESMO
   caminho. Resultado medido: zero evoluções em 20 runs.

   A curva nova sobe, mas bem menos. Ela foi calibrada DUAS vezes: a primeira
   versão, quase linear, virou nível 124 numa run de 14 min depois que o spawn
   dobrou e os abates foram de 1,3 mil para 17 mil. Cento e vinte escolhas
   maximizam tudo e a decisão perde sentido. O alvo é ~50 níveis por run: o
   suficiente para a build continuar crescendo com a horda, pouco o bastante
   para cada carta ainda custar alguma coisa.

   Calibrar isto tem realimentação, e é fácil errar feio: curva íngreme demais
   dá menos escolhas -> build fraca -> menos abates -> menos XP -> ainda menos
   escolhas. Medido: com o termo quadrático em 0.5 a run caiu de nível 124 para
   nível 10 e os abates de 17 mil para mil. Não existe meio-termo ajustando só
   a inclinação — os dois lados do abismo ficam a um décimo de distância.

   Por isso a curva tem termo CÚBICO. Os primeiros níveis continuam baratos,
   que é o que deixa o bola-de-neve pegar; o cubo só morde depois do nível ~35
   e é ele que dá o teto. Achatar cedo e frear tarde é o que separa "a build
   cresceu junto com a horda" de "maximizei tudo aos 8 minutos". */
function xpForLevel(l) {
  const n = l - 1;
  return Math.floor(3 + n * 2.6 + n * n * 0.09 + n * n * n * 0.008);
}

// número compacto: 1234 -> "1.2k", 2.5e6 -> "2.5M"
function fmtNum(n) {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return "" + n;
}

// "#rrggbb" -> "r,g,b" (para montar rgba com alpha variável)
function hexRgb(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Fisher-Yates in place
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// Weighted pick over a table of entries. `key` names the weight field, so the
// same table can carry an early-game and a late-game column (weight/lateWeight)
// the way ENEMIES already does.
function pickWeighted(list, key) {
  let total = 0;
  for (const e of list) total += e[key] || 0;
  if (total <= 0) return list[0];
  let roll = Math.random() * total;
  for (const e of list) { if ((roll -= e[key] || 0) < 0) return e; }
  return list[list.length - 1];
}

// Clona estruturas de dado puras (objetos, arrays, primitivos). Usado pela
// resolucao de pecas: trigger/effects sao clonados antes de receber patches,
// para que o registry nunca seja mutado.
function deepClone(v) {
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = deepClone(v[i]);
    return out;
  }
  if (v && typeof v === "object") {
    const out = {};
    for (const k in v) out[k] = deepClone(v[k]);
    return out;
  }
  return v;
}

// Escreve em "a.b.2.c" dentro de um objeto. Usado pelos patches de tier.
function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

/* Um campo de texto com foco COME a tecla: enquanto alguem digita, o jogo nao
   escuta. Sem isto o `preventDefault` do WASD apaga as letras a, s, d e w do
   proprio nome do jogador — e M e N mutam o som no meio de uma palavra. */
function digitando(e) {
  const t = e && e.target;
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = (t.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function mmss(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* A frente da onda do Apice, em fracao do raio, contra a fracao do tempo.

   Ela mora aqui — e nao junto do desenho, onde toda outra curva de evento mora
   — porque DUAS camadas precisam do mesmo numero: `Game.tickApex` mata com
   ela e `VfxLayer.draw` desenha com ela. Duas copias divergiriam na primeira
   vez que alguem mexesse na curva, e o anel passaria a mentir sobre onde o
   dano chegou — que e o unico defeito que este evento nao pode ter, porque
   ele e a recompensa de uma escolha que nao volta.

   Desacelera (a mesma familia do `outCubic` do render): a onda sai do corpo
   depressa e vai morrendo contra a borda, entao o jogador ve a horda cair de
   dentro para fora em vez de a tela apagar de uma vez. */
function apexFront(k) { const u = 1 - k; return 1 - u * u * u; }
