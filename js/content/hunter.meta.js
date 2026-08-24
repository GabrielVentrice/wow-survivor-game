"use strict";
/* =========================================================================
   PASSIVAS E CAPSTONES DO HUNTER.

   Mesmo namespace do warlock, filtrado por `cls` na oferta — ver
   `BuildSystem.owns`. Sem o campo, `checkCapstones` abriria estes numa run de
   warlock em silêncio: ele lê `req` contra o contador de eixo, e
   `this.axis.trapping` é `undefined` num warlock, o que faz `undefined < 15`
   ser falso e o requisito passar.
   ========================================================================= */

Object.assign(PASSIVES, {

  instinto: {
    id: "instinto", cls: "hunter", name: "Instinto", color: "#e0b833",
    desc: "Todo bicho invocado dura +60% — matilha que fica é matilha que conta.",
    global: { minionDuration: 1.6 },
  },

  municaoLeve: {
    id: "municaoLeve", cls: "hunter", name: "Munição Leve", color: "#6ea6f5",
    // Exclusiva com Munição Pesada: a build escolhe entre volume e peso. Sem a
    // exclusão, a resposta certa seria sempre "as duas".
    exclusive: "municaoPesada",
    desc: "Toda peça de tiro dispara um projétil a mais, e cada um bate 15% menos.",
    match: { tag: "shot" },
    pieceMods: { count: { add: 1 }, damage: { mul: 0.85 } },
  },

  municaoPesada: {
    id: "municaoPesada", cls: "hunter", name: "Munição Pesada", color: "#1c4aa8",
    exclusive: "municaoLeve",
    desc: "Toda peça de tiro atira 30% mais devagar e bate 80% mais forte por tiro.",
    match: { tag: "shot" },
    pieceMods: { cooldown: { mul: 1.3 }, damage: { mul: 1.8 } },
  },

  rastreador: {
    id: "rastreador", cls: "hunter", name: "Rastreador", color: "#2fd47e",
    desc: "Toda armadilha rearma na metade do tempo.",
    match: { trigger: "trap" },
    pieceMods: { cooldown: { mul: 0.5 } },
  },

  camuflagem: {
    id: "camuflagem", cls: "hunter", name: "Camuflagem", color: "#3878e0",
    desc: "Todo golpe pesado tem 40% de chance de crítico, e o crítico bate mais forte.",
    match: { tag: "shot" },
    pieceMods: { crit: { add: 0.4 }, critMul: { min: 2.2 } },
  },

  vinculoAnimal: {
    id: "vinculoAnimal", cls: "hunter", name: "Vínculo Animal", color: "#f5d45c",
    desc: "Toda peça que invoca bicho dura +80% e o bicho bate 25% mais forte.",
    match: { tag: "beast" },
    pieceMods: { duration: { mul: 1.8 }, damage: { mul: 1.25 } },
  },

  olhoDeAguia: {
    id: "olhoDeAguia", cls: "hunter", name: "Olho de Águia", color: "#3878e0",
    desc: "Toda peça de tiro alcança 40% mais longe. Em troca, o corpo a corpo bate 20% menos.",
    match: { tag: "shot" },
    pieceMods: { range: { mul: 1.4 } },
  },

  faroDeSangue: {
    id: "faroDeSangue", cls: "hunter", name: "Faro de Sangue", color: "#9c7a12",
    desc: "Toda armadilha e toda bomba cobrem 35% mais chão.",
    match: { tag: "trap" },
    pieceMods: { radius: { mul: 1.35 }, blastRadius: { mul: 1.35 } },
  },

});

Object.assign(CAPSTONES, {

  /* --- puros (15 pontos) -------------------------------------------------- */

  alcateia: {
    id: "alcateia", cls: "hunter", name: "Alcateia", color: "#f5d45c",
    axis: "pack", req: { pack: 15 },
    desc: "Todo bicho invocado fica permanente. Em troca, você não recebe mais cura externa.",
    global: { minionPermanent: true, noExternalHeal: true },
  },

  tiroCerteiro: {
    id: "tiroCerteiro", cls: "hunter", name: "Tiro Certeiro", color: "#6ea6f5",
    axis: "precision", req: { precision: 15 },
    desc: "Seu maior golpe sempre crita e ignora resistência. Em troca, todas as recargas ficam 30% mais lentas.",
    global: { bigHitCrit: true, cooldownMul: 1.3 },
  },

  terraArrasada: {
    id: "terraArrasada", cls: "hunter", name: "Terra Arrasada", color: "#5cf0a4",
    axis: "trapping", req: { trapping: 15 },
    desc: "Toda zona que você deixa no chão dura o triplo. Em troca, você não recebe mais cura externa.",
    global: { minionDuration: 0.7, noExternalHeal: true },
    match: { tag: "trap" },
    pieceMods: { duration: { mul: 3 }, dotTime: { mul: 3 } },
  },

  /* --- hibridos (10 + 5) -------------------------------------------------- */

  batedor: {
    id: "batedor", cls: "hunter", name: "Batedor", color: "#e0b833",
    axis: "pack", req: { pack: 10, precision: 5 },
    desc: "Todo golpe de bicho marca o alvo: ele passa a receber muito mais dano de tudo.",
    on: { minion_hit: "batedor" },
  },

  rangerSombria: {
    id: "rangerSombria", cls: "hunter", name: "Ranger Sombria", color: "#3878e0",
    axis: "precision", req: { precision: 10, pack: 5 },
    desc: "Inimigo morto por golpe pesado levanta como espectro e caça por você.",
    on: { enemy_killed: "rangerSombria" },
  },

  /* "Armadilha vira torre" e PATCH ESTRUTURAL, nao hook.

     A primeira versao pendurou isto em `minion_summoned`, e o driver a matou:
     esse evento so e emitido para demonio `big`, e armadilha nao e demonio
     nenhum. Um hook que escuta um evento que a promessa dele nao produz nao
     falha — ele fica calado, que e pior.

     `match: { trigger: "trap" }` + `piecePatch` acrescenta a torre a TODA peca
     com trigger de armadilha, presentes e futuras, sem uma linha de codigo. O
     indice 9 e reservado: nenhum caminho de armadilha escreve la. */
  sentinela: {
    id: "sentinela", cls: "hunter", name: "Sentinela", color: "#1c4aa8",
    axis: "precision", req: { precision: 10, trapping: 5 },
    desc: "Toda armadilha plantada nasce com uma torre ao lado, que atira sozinha enquanto a armadilha espera.",
    match: { trigger: "trap" },
    pieceMods: { charges: { add: 2 } },
    piecePatch: {
      "effects.9": {
        type: "summon", kind: "turtle", ai: "turret", count: 1, cap: 6,
        damage: 190, duration: 16, attackInterval: 1.0,
        projectile: { damage: 190, speed: 460, radius: 6, trail: 90, color: "#1c4aa8" },
      },
    },
  },

  domador: {
    id: "domador", cls: "hunter", name: "Domador", color: "#f5d45c",
    axis: "pack", req: { pack: 10, trapping: 5 },
    desc: "Sempre que uma armadilha sua dispara, a matilha inteira entra em frenesi.",
    on: { enemy_hit: "domador" },
  },

  emboscada: {
    id: "emboscada", cls: "hunter", name: "Emboscada", color: "#2fd47e",
    axis: "trapping", req: { trapping: 10, precision: 5 },
    desc: "Inimigo lento ou preso recebe crítico garantido de tudo que você causa.",
    global: { bigHitCrit: true },
    match: { tag: "trap" },
    pieceMods: { radius: { mul: 1.5 } },
  },

});
