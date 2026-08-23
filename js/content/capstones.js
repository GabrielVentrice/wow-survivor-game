"use strict";
/* =========================================================================
   CAPSTONES — a recompensa por comprometer o eixo.

   `req` e lido contra os pontos de eixo. Com pool 20 e teto 15, um capstone
   puro (15) so deixa 5 pontos para o resto — a escolha e real e irreversivel.
   Cada puro carrega um CUSTO: e o que impede "eu quero os tres".
   ========================================================================= */

Object.assign(CAPSTONES, {

  /* --- puros (15 pontos) -------------------------------------------------- */

  colheita: {
    id: "colheita", cls: "warlock", name: "Colheita", color: "#a8f05c",
    axis: "corruption", req: { corruption: 15 },
    desc: "Inimigo com 3+ DoTs que morre espalha TODOS eles aos vizinhos, com duração cheia.",
    on: { enemy_killed: "colheita" },
  },

  tirania: {
    id: "tirania", cls: "warlock", name: "Tirania", color: "#c07aff",
    axis: "dominion", req: { dominion: 15 },
    desc: "Todos os demônios ficam permanentes. Em troca, você não recebe mais cura externa.",
    global: { minionPermanent: true, noExternalHeal: true },
  },

  nihilam: {
    id: "nihilam", cls: "warlock", name: "Nihilam", color: "#ffb54a",
    axis: "cataclysm", req: { cataclysm: 15 },
    desc: "Seu maior golpe sempre crita e ignora resistência. Em troca, todos os cooldowns ficam 30% mais lentos.",
    global: { bigHitCrit: true, cooldownMul: 1.3 },
  },

  /* --- hibridos (10 + 5) -------------------------------------------------- */

  ceifador: {
    id: "ceifador", cls: "warlock", name: "Ceifador", color: "#7fdc4a",
    axis: "corruption", req: { corruption: 10, dominion: 5 },
    desc: "Todo DoT que expira naturalmente invoca um imp.",
    on: { dot_expired: "ceifador" },
  },

  chamador: {
    id: "chamador", cls: "warlock", name: "Chamador", color: "#ff8a3c",
    axis: "cataclysm", req: { cataclysm: 10, corruption: 5 },
    desc: "Immolate empilha até 8 vezes e detona em área ao expirar.",
    match: { key: "immolate" },
    piecePatch: { "effects.1.stacking": { mode: "stack", max: 8 } },
    on: { dot_expired: "chamador" },
  },

  diabolista: {
    id: "diabolista", cls: "warlock", name: "Diabolista", color: "#9a4cff",
    axis: "dominion", req: { dominion: 10, cataclysm: 5 },
    desc: "Cada invocação grande copia o último golpe grande que você deu.",
    on: { minion_summoned: "diabolista" },
  },

  voraz: {
    id: "voraz", cls: "warlock", name: "Voraz", color: "#7fdc4a",
    axis: "corruption", req: { corruption: 10, cataclysm: 5 },
    desc: "Um golpe grande consome todos os DoTs do alvo e cobra o dano restante de uma vez.",
    on: { big_hit: "voraz" },
  },

  enxame: {
    id: "enxame", cls: "warlock", name: "Enxame", color: "#9a4cff",
    axis: "dominion", req: { dominion: 10, corruption: 5 },
    desc: "Seus demônios aplicam os seus DoTs sempre que acertam.",
    on: { minion_hit: "enxame" },
  },

});
