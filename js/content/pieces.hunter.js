"use strict";
/* =========================================================================
   HUNTER — as tres pecas de VALIDACAO dos triggers novos (fase 2).

   Uma por trigger, e o proposito delas e esse: `trap`, `leading` e `pack`
   existem no motor e cada um precisa de uma peca que o exercite de ponta a
   ponta — trigger, efeito, render, icone e carta. O catalogo completo do
   hunter vem na fase 3; estas tres ja entram no schema definitivo para nao
   serem reescritas depois.

   `cls: "hunter"` mantem as tres fora de qualquer run de warlock: a oferta
   filtra por classe (BuildSystem.owns), entao elas nao aparecem no bolo do
   level up nem na mesa da etapa enquanto o hunter nao for jogavel.
   ========================================================================= */

Object.assign(PIECES, {

  /* --- ARMADILHA: o trigger `trap` ---------------------------------------
     A peca de referencia do trigger. "Carga" e quantas ficam plantadas ao
     mesmo tempo, e a armadilha nao cobra nada ate alguem pisar — quem cobra e
     a poca que ela abre. */
  tarTrap: {
    id: "tarTrap", cls: "hunter", key: "tarTrap", name: "Tar Trap",
    color: "#2fd47e", axis: "trapping", axisPoints: 2,
    tags: ["trap", "area", "control"],
    desc: "Arma uma armadilha no chão onde você está; quem pisa nela abre uma poça de alcatrão que segura a horda no lugar.",
    stats: {
      radius: 74, charges: 2, cooldown: 5, duration: 20,
      blastRadius: 96, dotTime: 6, dps: 42, factor: 0.45, slowTime: 3, tickInterval: 0.4,
    },
    trigger: { type: "trap", charges: "@charges", cooldown: "@cooldown" },
    effects: [
      { type: "area_persistent", armed: true, radius: "@radius", duration: "@duration",
        tickInterval: 0.1, look: "trap", color: "#2fd47e",
        onEnd: [
          { type: "area_persistent", radius: "@blastRadius", dps: "@dps", duration: "@dotTime",
            tickInterval: "@tickInterval", look: "rot", color: "#12915a",
            onTick: [{ type: "slow", factor: "@factor", duration: "@slowTime" }] },
        ] },
    ],
    paths: {
      /* Caminho A escreve em effects.2, B em effects.4, C em effects.6. A lista
         fica ESPARSA de proposito — dois caminhos no mesmo indice colidem e o
         ultimo comprado vence. */
      tar: { name: "Alcatrão", tiers: [
        T("Piche", "+45% de dano da poça.", { dps: { mul: 1.45 } }),
        T("Betume", "A poça dura +3s.", { dotTime: { add: 3 } }),
        T("Atoleiro", "A lentidão fica muito mais forte.", { factor: { mul: 0.55 } }),
        T("Lodo", "+60% de raio da poça.", { blastRadius: { mul: 1.6 } }),
        T("Pântano", "Triplica o dano da poça.", { dps: { mul: 3 } }),
      ]},
      mesh: { name: "Malha", tiers: [
        T("Gatilho Largo", "+35% de raio da armadilha.", { radius: { mul: 1.35 } }),
        T("Recarga", "Rearma 30% mais rápido.", { cooldown: { mul: 0.7 } }),
        T("Terceira Presa", "Mais uma armadilha no chão ao mesmo tempo.", { charges: { add: 1 } }),
        T("Paciência", "A armadilha espera 15s a mais antes de sumir.", { duration: { add: 15 } }),
        T("Campo Minado", "Mais duas armadilhas no chão ao mesmo tempo.", { charges: { add: 2 } }),
      ]},
      jaws: { name: "Mandíbula", tiers: [
        T("Mordida", "Quem pisa toma dano na hora.", null,
          { "effects.0.onEnd.6": { type: "damage_instant", amount: "@dps*3",
            radius: "@blastRadius", big: true, shape: "implode", color: "#5cf0a4" } }),
        T("Trava", "Quem pisa fica atordoado por 0.8s.", null,
          { "effects.0.onEnd.7": { type: "stun", duration: 0.8, radius: "@radius" } }),
        T("Dentes", "+70% do dano da mordida.", { dps: { mul: 1.7 } }),
        T("Estilhaço", "A mordida também empurra tudo por perto.", null,
          { "effects.0.onEnd.8": { type: "knockback", force: 90, radius: "@blastRadius" } }),
        T("Cepo", "O atordoamento passa a valer 2s.", null,
          { "effects.0.onEnd.7": { type: "stun", duration: 2, radius: "@radius" } }),
      ]},
    },
  },

  /* --- ARMADILHA: o trigger `leading` ------------------------------------
     Cobra o chao PARA ONDE o jogador esta indo. Nao exige que ele ande — parar
     de andar nao pode desligar a peca, senao a bomba some exatamente quando o
     jogador estanca para deixar a horda chegar. */
  wildfireBomb: {
    id: "wildfireBomb", cls: "hunter", key: "wildfireBomb", name: "Wildfire Bomb",
    color: "#2fd47e", axis: "trapping", axisPoints: 2,
    tags: ["bomb", "area", "fire"],
    desc: "Enquanto você se move, lança uma bomba à frente do seu caminho: ela detona em área e deixa o chão queimando por alguns segundos.",
    stats: {
      distance: 150, cooldown: 2.4, damage: 160, radius: 92,
      dps: 48, duration: 3, tickInterval: 0.4,
    },
    trigger: { type: "leading", cooldown: "@cooldown", distance: "@distance" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", big: true,
        shape: "bloom", color: "#5cf0a4" },
      { type: "area_persistent", radius: "@radius*0.8", dps: "@dps", duration: "@duration",
        tickInterval: "@tickInterval", look: "fire", color: "#2fd47e" },
    ],
    paths: {
      blast: { name: "Estouro", tiers: [
        T("Carga", "+50% de dano da detonação.", { damage: { mul: 1.5 } }),
        T("Estilhaço", "+35% de raio.", { radius: { mul: 1.35 } }),
        T("Napalm", "Dobra o dano da detonação.", { damage: { mul: 2 } }),
        T("Onda", "A detonação empurra tudo por perto.", null,
          { "effects.3": { type: "knockback", force: 110, radius: "@radius" } }),
        T("Termobárica", "Triplica o dano da detonação.", { damage: { mul: 3 } }),
      ]},
      throw: { name: "Arremesso", tiers: [
        T("Braço", "Cai 60 unidades mais longe.", { distance: { add: 60 } }),
        T("Cadência", "Lança 30% mais rápido.", { cooldown: { mul: 0.7 } }),
        T("Pavio Curto", "Lança 30% mais rápido de novo.", { cooldown: { mul: 0.7 } }),
        T("Salva", "Cada arremesso solta uma segunda bomba dispersa.", null,
          { "effects.5": { type: "damage_instant", amount: "@damage*0.6",
            radius: "@radius*0.7", jitter: 90, shape: "bloom", color: "#5cf0a4" } }),
        T("Barragem", "Lança quase o dobro de rápido.", { cooldown: { mul: 0.55 } }),
      ]},
      burn: { name: "Incêndio", tiers: [
        T("Brasa", "+60% do dano do chão em chamas.", { dps: { mul: 1.6 } }),
        T("Alastra", "O fogo dura +3s.", { duration: { add: 3 } }),
        T("Fumaça", "O fogo também deixa quem pisa mais lento.", null,
          { "effects.1.onTick.7": { type: "slow", factor: 0.6, duration: 2 } }),
        T("Fornalha", "O fogo tica 40% mais rápido.", { tickInterval: { mul: 0.6 } }),
        T("Incinerar", "Triplica o dano do chão em chamas.", { dps: { mul: 3 } }),
      ]},
    },
  },

  /* --- MATILHA: o trigger `pack` -----------------------------------------
     Repoe a matilha em LEVA e reparte o leque de formacao. Quem cerca e
     `MINION_AI.flank`; o trigger so decide quantos existem e de onde entram. */
  wildThrash: {
    id: "wildThrash", cls: "hunter", key: "wildThrash", name: "Wild Thrash",
    color: "#e0b833", axis: "pack", axisPoints: 2,
    tags: ["beast", "pack", "melee"],
    desc: "Mantém uma matilha de lobos caçando sozinha: eles cercam o alvo por lados diferentes e cada mordida abre em área.",
    stats: {
      count: 3, interval: 7, damage: 92, blast: 62, blastRadius: 72,
      duration: 16, speed: 320, attackInterval: 0.7,
    },
    trigger: { type: "pack", count: "@count", interval: "@interval", litter: "@count" },
    effects: [
      { type: "summon", kind: "wolf", ai: "flank", count: 1, cap: "@count",
        damage: "@damage", duration: "@duration", speed: "@speed",
        attackInterval: "@attackInterval",
        onHit: [{ type: "damage_instant", amount: "@blast", radius: "@blastRadius" }] },
    ],
    paths: {
      fang: { name: "Presa", tiers: [
        T("Mordida", "+45% de dano da mordida.", { damage: { mul: 1.45 } }),
        T("Dilacerar", "+50% do dano em área da mordida.", { blast: { mul: 1.5 } }),
        T("Rasgo", "A mordida faz sangrar.", null,
          { "effects.0.onHit.2": { type: "damage_over_time", key: "wildThrash",
            dps: "@damage*0.3", duration: 4, tickInterval: 0.5, look: "rot", color: "#9c7a12" } }),
        T("Presa Longa", "+60% de raio da área.", { blastRadius: { mul: 1.6 } }),
        T("Esquartejar", "Triplica o dano da mordida.", { damage: { mul: 3 } }),
      ]},
      pack: { name: "Alcateia", tiers: [
        T("Par", "Mais um lobo na matilha.", { count: { add: 1 } }),
        T("Fôlego", "Os lobos duram +8s.", { duration: { add: 8 } }),
        T("Trio", "Mais dois lobos na matilha.", { count: { add: 2 } }),
        T("Reposição", "A matilha se repõe 40% mais rápido.", { interval: { mul: 0.6 } }),
        T("Matilha", "Mais três lobos na matilha.", { count: { add: 3 } }),
      ]},
      hunt: { name: "Caçada", tiers: [
        T("Faro", "Os lobos correm 25% mais rápido.", { speed: { mul: 1.25 } }),
        T("Investida", "Mordem 30% mais rápido.", { attackInterval: { mul: 0.7 } }),
        T("Acuar", "A mordida deixa o alvo mais lento.", null,
          { "effects.0.onHit.4": { type: "slow", factor: 0.55, duration: 2 } }),
        T("Perseguir", "Correm mais 30%.", { speed: { mul: 1.3 } }),
        T("Frenesi", "Mordem quase o dobro de rápido.", { attackInterval: { mul: 0.55 } }),
      ]},
    },
  },

});
