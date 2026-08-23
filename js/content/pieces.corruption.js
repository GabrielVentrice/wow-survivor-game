"use strict";
/* =========================================================================
   EIXO CORRUPCAO — DoT, propagacao, morte lenta.
   Nao mata rapido; mata TUDO. A build recompensa deixar a horda viver alguns
   segundos a mais para que os DoTs se espalhem sozinhos.

   Schema de uma peca:
     id/key   `key` e identidade ESTAVEL (medidor de dano, anti-recursao).
              `id` muda na evolucao; `key` nunca.
     stats    UNICA fonte de numeros. Tiers e passivas so mexem aqui.
     trigger  QUANDO dispara. So referencias "@stat", nunca numeros crus.
     effects  O QUE acontece. Lista componivel; efeitos aninham efeitos.
     paths    3 caminhos x 5 tiers. `mods` muda numeros, `patch` muda estrutura.
   ========================================================================= */

Object.assign(PIECES, {

  corruption: {
    id: "corruption", key: "corruption", name: "Corruption",
    color: "#7fdc4a", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "dot"], vfx: "rot",
    desc: "Mira sozinha no inimigo mais próximo e planta um DoT de podridão. Reaplicar renova a duração; não pede mira nem posição.",
    stats: {
      ...CRIT_BASE, cooldown: 1.2, range: 440, targets: 1,
      dps: 28, duration: 6, tickInterval: 0.5, radius: 0,
    },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_over_time", key: "corruption", dps: "@dps", duration: "@duration",
        look: "rot",   // podridao: o orbe ORBITA, e a fatia base
        tickInterval: "@tickInterval", color: "#7fdc4a", radius: "@radius",
        stacking: { mode: "refresh", max: 1 } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Aplica" },
                     qty: { stat: "targets", noun: "alvos por conjuração", steps: [2, 4] } },
        T("Praga Universal", "Ao expirar, espalha para TODOS os vizinhos.", null,
          { "effects.0.onExpire.1": { type: "spread_on_death", radius: 170,
                                      full: false, maxTargets: 8 } })),
      mastery: MASTERY({ dmg: "dps", evolvesInto: "vileTaint" },
        T("Vile Taint", "EVOLUÇÃO — vira um rastro de veneno contínuo sob seus pés.")),
      crit: CRIT({},
        T("Aniquilação", "Todo tique crita, e ao expirar a podridão detona por 5x um tique.",
          { crit: { set: 1 } },
          { "effects.0.onExpire.0": { type: "damage_instant", amount: "@dps*5",
                                      radius: 95, big: true } })),
    },
  },

  agony: {
    id: "agony", key: "agony", name: "Agony",
    color: "#4a9e2e", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "dot"], vfx: "sigil",
    desc: "Mira sozinha e aplica uma dor que dói mais a cada segundo em que o alvo continua vivo. Empilha em cima de si mesma.",
    stats: {
      ...CRIT_BASE, cooldown: 2.4, range: 400, targets: 1,
      dps: 18, duration: 12, tickInterval: 0.7, ramp: 0.34, stacks: 3, radius: 0,
    },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_over_time", key: "agony", dps: "@dps", duration: "@duration",
        look: "curse",   // maldicao de acumulo: uma marca PARADA por stack sobre a cabeca
        tickInterval: "@tickInterval", ramp: "@ramp", color: "#4a9e2e", radius: "@radius",
        stacking: { mode: "stack", max: "@stacks" } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Aplica" },
                     qty: { stat: "stacks", noun: "camadas empilhadas no mesmo alvo", steps: [5, 8] } },
        T("Toda a Tela", "Aplica em todos os inimigos ao redor.",
          { radius: { set: 420 }, targets: { set: 1 } })),
      mastery: MASTERY({ dmg: "dps" },
        T("Infinita", "A dor nunca para de crescer — a duração vira permanente.",
          { duration: { mul: 4 } }, { "effects.0.permanent": true })),
      crit: CRIT({},
        T("Ruína", "Todo tique crita, e ao expirar a dor cobra 8 tiques acumulados.",
          { crit: { set: 1 } },
          { "effects.0.onExpire": [{ type: "damage_instant", amount: "@dps*8",
                                     radius: 80, big: true }] })),
    },
  },

  unstableAffliction: {
    id: "unstableAffliction", key: "unstableAffliction", name: "Unstable Affliction",
    color: "#a8f05c", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "dot"],
    desc: "Mira sozinha e planta um DoT curto que explode em área ao terminar. O tique é pequeno; o fim é o dano.",
    stats: {
      ...CRIT_BASE, cooldown: 3.2, range: 380, targets: 1,
      dps: 20, duration: 5, tickInterval: 1, blast: 140, blastRadius: 90,
      radius: 0, stacks: 1,
    },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_over_time", key: "unstableAffliction", dps: "@dps", duration: "@duration",
        look: "unstable",   // ela TREME mais perto de estourar: o corpo avisa
        tickInterval: "@tickInterval", color: "#a8f05c", radius: "@radius",
        stacking: { mode: "refresh", max: 1 },
        onExpire: [{ type: "damage_instant", amount: "@blast", radius: "@blastRadius", big: true,
          // a instabilidade racha o corpo por dentro
          shape: "rip" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Planta" },
                     qty: { stat: "targets", noun: "alvos por conjuração", steps: [2, 4] } },
        T("Epidemia", "A explosão espalha todos os DoTs do alvo.", null,
          { "effects.0.onExpire.3": { type: "spread_on_death", radius: 150,
                                      full: true, maxTargets: 5 } })),
      mastery: MASTERY({ dmg: ["blast", "dps"] },
        T("Cataclismo Íntimo", "Triplica a explosão e dobra o raio.",
          { blast: { mul: 3 }, blastRadius: { mul: 2 } })),
      crit: CRIT({},
        T("Reação em Cadeia", "Toda explosão crita e salta para o vizinho a 60%.",
          { crit: { set: 1 } },
          { "effects.0.onExpire.2": { type: "chain", range: 160, falloff: 0.6, effects: [
            { type: "damage_instant", amount: "@blast*0.6", radius: "@blastRadius*0.7" }] } })),
    },
  },

  /* A OUTRA metade do "DoT que explode no fim", e ela existe por causa do que
     Unstable Affliction NAO consegue prometer: a explosao dela so acontece se o
     alvo sobreviver ao proprio tique, e nesta horda — densa, fragil, morrendo
     em leva — quase nunca sobrevive. `expireOnDeath` inverte isso: a conta
     vence do mesmo jeito quando o corpo cai antes do prazo, entao o estouro
     deixa de ser sorte e passa a ser o que a peca faz.

     Dai o desenho dos numeros: o tique e quase decorativo e o fim carrega o
     dano inteiro da peca. Quem compra isto nao compra dano por segundo, compra
     um pulso pesado em area a cada conjuracao. */
  soulRupture: {
    id: "soulRupture", key: "soulRupture", name: "Soul Rupture",
    color: "#4a9e2e", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "dot"], vfx: "sigil",
    desc: "Mira sozinha e planta uma ruptura na alma: o tique é fraco, e o dano vem todo de um estouro em área quando o prazo vence — mesmo que o corpo caia antes.",
    stats: {
      ...CRIT_BASE, cooldown: 3.4, range: 420, targets: 1,
      dps: 14, duration: 6, tickInterval: 1,
      blast: 600, blastRadius: 140, radius: 0,
    },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_over_time", key: "soulRupture", dps: "@dps", duration: "@duration",
        tickInterval: "@tickInterval", color: "#4a9e2e", radius: "@radius",
        // o dano dela e o PRAZO vencendo, entao o orbe fecha para dentro
        look: "doom",
        stacking: { mode: "refresh", max: 1 }, expireOnDeath: true,
        // a alma arrebenta para fora: onda, e nao a rachadura por dentro que e
        // a assinatura do Unstable Affliction
        onExpire: [{ type: "damage_instant", amount: "@blast", radius: "@blastRadius", big: true,
                     shape: "nova" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Rompe" },
                     qty: { stat: "targets", noun: "almas por conjuração", steps: [2, 4] } },
        T("Ruptura em Cadeia", "O estouro espalha todos os DoTs do alvo.", null,
          { "effects.0.onExpire.4": { type: "spread_on_death", radius: "@blastRadius",
                                      full: true, maxTargets: 6 } })),
      mastery: MASTERY({ dmg: "blast" },
        T("Alma Partida", "Triplica o dano do estouro e dobra o raio.",
          { blast: { mul: 3 }, blastRadius: { mul: 2 } })),
      crit: CRIT({},
        T("Fenda", "Todo estouro crita e atordoa por 0.8s.",
          { crit: { set: 1 } },
          { "effects.0.onExpire.1": { type: "stun", duration: 0.8, radius: "@blastRadius" } })),
    },
  },

  seedOfCorruption: {
    id: "seedOfCorruption", key: "seedOfCorruption", name: "Seed of Corruption",
    color: "#7fdc4a", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "reactive"], vfx: "thorn",
    desc: "Quando um inimigo que carrega DoT morre, o corpo dele explode em área. Você não conjura nada: só deixa a horda apodrecer e cair.",
    requires: { tag: "dot" },
    stats: { ...CRIT_BASE, blast: 110, radius: 110, cooldown: 0.25 },
    trigger: { type: "reactive", event: "enemy_killed", condition: "has_dot",
               cooldown: "@cooldown", needsTarget: true },
    effects: [
      { type: "damage_instant", amount: "@blast", radius: "@radius", big: true,
        // a semente nao estoura, ela SEMEIA: onda saindo do cadaver
        shape: "nova" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Rebenta" } },
        T("Reação Total", "A explosão pode disparar outras explosões.", null,
          { "trigger.cooldown": 0 })),
      mastery: MASTERY({ dmg: "blast" },
        T("Ceifa", "Triplica o dano e explode duas vezes.", { blast: { mul: 3 } },
          { "effects.1": { type: "damage_instant", amount: "@blast*0.5", radius: "@radius*1.5" } })),
      crit: CRIT({},
        T("Germinação", "Toda explosão crita e espalha os DoTs do morto.",
          { crit: { set: 1 } },
          { "effects.2": { type: "spread_on_death", radius: "@radius",
                           full: true, maxTargets: 6 } })),
    },
  },

  haunt: {
    id: "haunt", key: "haunt", name: "Haunt",
    color: "#a8f05c", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "summon"],
    desc: "Invoca um olho do Vazio que atira sozinho e marca quem acerta — alvo marcado recebe mais dano de TUDO na sua build.",
    stats: { ...CRIT_BASE, count: 1, respawn: 5, damage: 24, amp: 0.3,
             markTime: 5, duration: 12, range: 440 },
    trigger: { type: "autonomous", count: "@count", interval: "@respawn" },
    effects: [
      { type: "summon", kind: "darkglare", ai: "turret", count: 1, cap: "@count",
        duration: "@duration", damage: "@damage", range: "@range", attackInterval: 1,
        onHit: [{ type: "mark", amp: "@amp", duration: "@markTime" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "respawn", verb: "Invoca" },
                     qty: { stat: "count", noun: "olhos em campo", steps: [2, 3] } },
        T("Legião de Olhos", "Cinco olhos, reposição imediata.",
          { count: { set: 5 }, respawn: { set: 1 } })),
      mastery: MASTERY({ dmg: "damage", noun: "dano do olho" },
        T("Olho do Vazio", "A marca também espalha os DoTs do alvo.", null,
          { "effects.0.onHit.3": { type: "spread_on_death", radius: 120,
                                   full: false, maxTargets: 3 } })),
      crit: CRIT({},
        T("Definhamento", "Todo tiro do olho crita, e o marcado recebe +80% de dano.",
          { crit: { set: 1 }, amp: { set: 0.8 } })),
    },
  },

  maleficRapture: {
    id: "maleficRapture", key: "maleficRapture", name: "Malefic Rapture",
    color: "#a8f05c", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "rooted"],
    desc: "Enquanto você fica parado, carrega e pulsa dano instantâneo em todos os inimigos ao redor que carregam um DoT seu.",
    requires: { tag: "dot" },
    stats: { ...CRIT_BASE, chargeTime: 1.1, damage: 116, radius: 340 },
    trigger: { type: "rooted", chargeTime: "@chargeTime", range: 0 },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", onlyDotted: true, big: true,
        // ela RASGA o que ja estava apodrecendo — e o talho, nao a bola de fogo
        shape: "rip" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "chargeTime", verb: "Carrega" } },
        T("Domínio", "Pulsa mesmo em quem não tem DoT, por metade do dano.", null,
          { "effects.0.onlyDotted": false, "effects.0.mul": 0.5 })),
      mastery: MASTERY({ dmg: "damage" },
        T("Rapto", "Triplica o dano e dobra o raio.",
          { damage: { mul: 3 }, radius: { mul: 2 } })),
      crit: CRIT({},
        T("Voracidade", "Todo pulso crita e cura 20% do dano causado.",
          { crit: { set: 1 } },
          { "effects.0.onHit": [{ type: "heal", frac: 0.2 }] })),
    },
  },

  /* --- pecas de evolucao: nao aparecem no sorteio, so por conversao ------- */

  vileTaint: {
    id: "vileTaint", key: "corruption", name: "Vile Taint",
    color: "#a8f05c", axis: "corruption", axisPoints: 0,
    tags: ["shadow", "dot", "trail"], evolutionOnly: true, vfx: "rot",
    desc: "Enquanto você anda, deixa poças de podridão no rastro: elas causam dano contínuo e aplicam DoT em quem pisa.",
    stats: { ...CRIT_BASE, distance: 60, radius: 88, dps: 52, duration: 5,
             tickInterval: 0.35, dotDps: 24, dotTime: 6 },
    trigger: { type: "trail", distance: "@distance" },
    effects: [
      { type: "area_persistent", radius: "@radius", dps: "@dps", duration: "@duration",
        look: "rot",       // miasma: o aro apodrece em arcos partidos
        tickInterval: "@tickInterval", color: "#a8f05c",
        onTick: [{ type: "damage_over_time", key: "corruption", dps: "@dotDps",
                   duration: "@dotTime", tickInterval: 0.6, color: "#a8f05c" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "distance", verb: "Deixa poças" } },
        T("Maré Podre", "As poças também explodem ao sumir.", null,
          { "effects.0.onEnd": [{ type: "damage_instant", amount: "@dps*3",
                                  radius: "@radius*1.3", big: true }] })),
      mastery: MASTERY({ dmg: ["dps", "dotDps"] },
        T("Terra Morta", "As poças duram o triplo.", { duration: { mul: 3 } })),
      crit: CRIT({},
        T("Pântano", "Todo tique crita, e a poça enlameia: -45% de velocidade em quem pisa.",
          { crit: { set: 1 } },
          { "effects.0.onTick.1": { type: "slow", factor: 0.55, duration: 1.5 } })),
    },
  },

  soulRot: {
    id: "soulRot", key: "drainLife", name: "Soul Rot",
    color: "#a8f05c", axis: "corruption", axisPoints: 0,
    tags: ["shadow", "dot", "aura", "heal"], evolutionOnly: true, vfx: "blood",
    desc: "Aura constante em volta de você: causa dano, aplica DoT e devolve parte do dano causado como cura.",
    stats: { ...CRIT_BASE, interval: 0.4, radius: 190, damage: 32, heal: 0.22,
             dotDps: 20, dotTime: 5 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius",
        // dreno PUXA: a casca converge para o warlock em vez de estourar
        shape: "implode",
        onHit: [
          { type: "heal", frac: "@heal" },
          { type: "damage_over_time", key: "soulRot", dps: "@dotDps", duration: "@dotTime",
            tickInterval: 0.6, color: "#a8f05c" },
        ] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Sopro", "Cada pulso também empurra os inimigos.", null,
          { "effects.1": { type: "knockback", force: 30, radius: "@radius" } })),
      mastery: MASTERY({ dmg: ["damage", "dotDps"] },
        T("Alma Apodrecida", "Triplica o DoT e ele nunca expira.",
          { dotDps: { mul: 3 } }, { "effects.0.onHit.1.permanent": true })),
      crit: CRIT({ noun: "dano" },
        T("Imortal", "Todo pulso crita e cura em 45% de tudo que a aura causa.",
          { crit: { set: 1 }, heal: { set: 0.45 } })),
    },
  },

});
