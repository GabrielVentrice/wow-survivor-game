"use strict";
/* =========================================================================
   EIXO CATACLISMO — golpes grandes, fogo, detonacao.
   Dano concentrado em picos. A build recompensa ler o campo e parar no
   momento certo: quase tudo aqui e `rooted`, `directional` ou `reactive`.
   ========================================================================= */

Object.assign(PIECES, {

  incinerate: {
    id: "incinerate", cls: "warlock", key: "incinerate", name: "Incinerate",
    color: "#ff8a3c", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "bolt"], vfx: "ember",
    desc: "Mira sozinha e lança um projétil teleguiado no inimigo mais próximo. Dano direto, sem condição nenhuma.",
    stats: { ...CRIT_BASE, cooldown: 0.75, range: 520, targets: 1, damage: 44,
             count: 1, speed: 560, pierce: 0, projRadius: 6 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "projectile", damage: "@damage", speed: "@speed", count: "@count",
        radius: "@projRadius", pierce: "@pierce", life: 2.2, homing: true,
        turnRate: 9, trail: 150, color: "#ff8a3c" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Dispara" },
                     qty: { stat: "count", noun: "projéteis por tiro", steps: [2, 4],
                            also: { stat: "pierce", steps: [1, 4],
                                    noun: "atravessando {n} inimigo(s)" } } },
        T("Tempestade", "7 projéteis perfurantes, cada um explode ao acertar.",
          { count: { set: 7 }, pierce: { set: 6 } },
          { "effects.0.onHit.0": { type: "damage_instant", amount: "@damage*0.5", radius: 60 } })),
      mastery: MASTERY({ dmg: "damage", evolvesInto: "chaosBolt" },
        T("Chaos Bolt", "EVOLUÇÃO — vira um único projétil devastador, carregado parado.")),
      crit: CRIT({},
        T("Incineração", "Todo tiro crita, e incendeia o alvo.",
          { crit: { set: 1 } },
          { "effects.0.onHit.1": { type: "damage_over_time", key: "incinerate",
            dps: "@damage*0.4", duration: 5, tickInterval: 0.5, color: "#ff8a3c" } })),
    },
  },

  immolate: {
    id: "immolate", cls: "warlock", key: "immolate", name: "Immolate",
    color: "#ff8a3c", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "dot"],
    desc: "Mira sozinha: dano na hora mais um DoT de fogo no alvo. É ela que dá às peças de detonação o que elas precisam.",
    stats: { ...CRIT_BASE, cooldown: 2, range: 440, targets: 1, damage: 28,
             dotDps: 18, duration: 6, tickInterval: 1, radius: 0, stacks: 1 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_instant", amount: "@damage" },
      { type: "damage_over_time", key: "immolate", dps: "@dotDps", duration: "@duration",
        look: "fire",   // queima: o orbe SOBE em vez de girar
        tickInterval: "@tickInterval", color: "#ff8a3c", radius: "@radius",
        stacking: { mode: "refresh", max: 1 } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Incendeia" },
                     qty: { stat: "targets", noun: "alvos incendiados por vez", steps: [2, 4] } },
        T("Tela Inteira", "Incendeia todos os inimigos ao redor.",
          { radius: { set: 460 }, targets: { set: 1 } })),
      mastery: MASTERY({ dmg: ["dotDps", "damage"], evolvesInto: "wither" },
        T("Wither", "EVOLUÇÃO — a chama vira podridão eterna.")),
      crit: CRIT({},
        T("Chama Perfeita", "Toda queima crita, e ao expirar ela explode por 6x um tique.",
          { crit: { set: 1 } },
          { "effects.1.onExpire.0": { type: "damage_instant", amount: "@dotDps*6",
            radius: 100, big: true } })),
    },
  },

  conflagrate: {
    id: "conflagrate", cls: "warlock", key: "conflagrate", name: "Conflagrate",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "reactive"], vfx: "ember",
    desc: "Sempre que um DoT é aplicado em alguém, detona aquele alvo em área. Precisa de outra peça que aplique DoT.",
    requires: { tag: "dot" },
    stats: { ...CRIT_BASE, damage: 180, radius: 120, cooldown: 0.9, range: 460 },
    /* Detona QUALQUER DoT, não só o de Immolate. Amarrada ao Immolate ela
       nunca chegava à mesa: a peça habilitadora aparecia em 2 de 12 runs, e
       Conflagrate foi a única do catálogo com zero escolhas em 32 runs. */
    trigger: { type: "reactive", event: "dot_applied", condition: "has_dot",
               cooldown: "@cooldown", needsTarget: true },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", big: true },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Detona" } },
        T("Corrente", "A detonação salta para o vizinho a 70%.", null,
          { "effects.2": { type: "chain", range: 190, falloff: 0.7, effects: [
            { type: "damage_instant", amount: "@damage*0.7", radius: "@radius*0.8" }] } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Conflagração", "Triplica o dano e dobra o raio.",
          { damage: { mul: 3 }, radius: { mul: 2 } })),
      crit: CRIT({},
        T("Executor", "Todo estouro crita, e causa dano triplo abaixo de 30% de vida.",
          { crit: { set: 1 } },
          { "effects.4": { type: "execute", threshold: 0.3, amount: "@damage",
                           executeMul: 3, radius: "@radius" } })),
    },
  },

  rainOfFire: {
    id: "rainOfFire", cls: "warlock", key: "rainOfFire", name: "Rain of Fire",
    color: "#ff8a3c", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "area", "rooted"], vfx: "meteor",
    desc: "Enquanto você fica parado, carrega e derruba fogo em volta: zonas que causam dano contínuo em quem estiver dentro.",
    // Peca `rooted` dispara muito menos que uma `auto_target`, entao cada
    // ativacao precisa valer o tempo parado: dano por queda quase dobrado.
    stats: { ...CRIT_BASE, chargeTime: 1.0, radius: 125, dps: 148, duration: 4,
             tickInterval: 0.3, drops: 2, jitter: 80 },
    trigger: { type: "rooted", chargeTime: "@chargeTime", range: 0 },
    effects: [
      { type: "area_persistent", radius: "@radius", dps: "@dps", duration: "@duration",
        // chuva de fogo: sombra no chao antes de cada queda. Sem ela o dano
        // cai num ponto que o jogador nao teve como ler.
        tell: 0.16,
        look: "fire",      // fogo vivo: o aro tremula
        tickInterval: "@tickInterval", count: "@drops", jitter: "@jitter", color: "#ff8a3c" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "chargeTime", verb: "Carrega" },
                     qty: { stat: "drops", noun: "quedas por carga", steps: [3, 5] } },
        T("Fim do Mundo", "8 quedas por carga.", { drops: { set: 8 } })),
      mastery: MASTERY({ dmg: "dps", evolvesInto: "cataclysm" },
        T("Cataclysm", "EVOLUÇÃO — vira um meteoro lançado na sua direção de movimento.")),
      crit: CRIT({},
        T("Brasas", "Todo tique crita, e o fogo incendeia quem pisa.",
          { crit: { set: 1 } },
          { "effects.0.onTick.0": { type: "damage_over_time", key: "rainFire",
            dps: "@dps*0.3", duration: 4, tickInterval: 0.5, color: "#ff8a3c" } })),
    },
  },

  infernal: {
    id: "infernal", cls: "warlock", key: "infernal", name: "Infernal",
    color: "#e0521a", axis: "cataclysm", axisPoints: 3,
    tags: ["fire", "summon"],
    desc: "Invoca um infernal que fica plantado onde caiu e martela em área tudo que se aproximar dele.",
    stats: { ...CRIT_BASE, count: 1, respawn: 10, duration: 16, damage: 110,
             radius: 130, range: 300, attackInterval: 0.7 },
    trigger: { type: "autonomous", count: "@count", interval: "@respawn" },
    effects: [
      { type: "summon", kind: "infernal", ai: "turret", count: 1, cap: "@count", big: true,
        duration: "@duration", damage: "@damage", range: "@range",
        attackInterval: "@attackInterval",
        onHit: [{ type: "damage_instant", amount: "@damage", radius: "@radius", big: true }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "attackInterval", verb: "Martela" },
                     qty: { stat: "count", noun: "colossos em campo", steps: [2, 3] } },
        T("Cerco", "5 colossos permanentes.",
          { count: { set: 5 } }, { "effects.0.permanent": true })),
      mastery: MASTERY({ dmg: "damage" },
        T("Meteoro Vivo", "Triplica o dano e dobra o raio do impacto.",
          { damage: { mul: 3 }, radius: { mul: 2 } })),
      crit: CRIT({},
        T("Martelada", "Todo impacto crita e atordoa por 0.6s.",
          { crit: { set: 1 } },
          { "effects.0.onHit.1": { type: "stun", duration: 0.6, radius: "@radius" } })),
    },
  },

  shadowburn: {
    id: "shadowburn", cls: "warlock", key: "shadowburn", name: "Shadowburn",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "shadow", "reactive", "execute"],
    desc: "Sempre que você acerta um inimigo já abaixo do limiar de vida, dispara um golpe de execução com dano multiplicado.",
    stats: { ...CRIT_BASE, damage: 80, threshold: 0.2, executeMul: 6,
             cooldown: 0.4, range: 420, radius: 0, heal: 12 },
    trigger: { type: "reactive", event: "enemy_hit", condition: "enemy_below",
               pct: "@threshold", cooldown: "@cooldown", needsTarget: true },
    effects: [
      { type: "execute", amount: "@damage", threshold: "@threshold",
        executeMul: "@executeMul", radius: "@radius" },
      // a execucao volta a ALIMENTAR: era o caminho "Alma", desde o tier 1
      { type: "heal", amount: "@heal" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Executa" } },
        T("Ceifada Larga", "A execução pega todos num raio de 150.", { radius: { set: 150 } })),
      mastery: MASTERY({ dmg: ["damage", "heal"], noun: "dano e cura" },
        T("Fim de Linha", "Triplica a execução e ceifa abaixo de 40% de vida.",
          { executeMul: { mul: 3 }, threshold: { set: 0.4 } })),
      crit: CRIT({},
        /* O limiar sobe JUNTO com o critico de propósito: sem ele a linha
           fecha sem nunca disparar — medido no banco, `crit5` marcava zero em
           todo cenario, porque 100% de critico sobre um golpe que nunca
           acontece continua sendo zero. */
        T("Colheita", "Toda execução crita, ceifa abaixo de 35% e espalha os DoTs do alvo.",
          { crit: { set: 1 }, threshold: { set: 0.35 } },
          { "effects.2": { type: "spread_on_death", radius: 150, full: true, maxTargets: 5 } })),
    },
  },

  burningTrail: {
    id: "burningTrail", cls: "warlock", key: "burningTrail", name: "Burning Trail",
    color: "#e0521a", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "trail", "area"],
    desc: "Enquanto você anda, o chão pega fogo atrás de você: zonas que causam dano contínuo em quem pisa.",
    stats: { ...CRIT_BASE, distance: 70, radius: 66, dps: 68, duration: 3, tickInterval: 0.35 },
    trigger: { type: "trail", distance: "@distance" },
    effects: [
      { type: "area_persistent", radius: "@radius", dps: "@dps", duration: "@duration",
        look: "ash",       // rastro: chao chamuscado, tracejado e parado
        tickInterval: "@tickInterval", color: "#e0521a" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "distance", verb: "Deixa fogo" } },
        T("Muralha de Fogo", "Deixa duas poças lado a lado.", null,
          { "effects.0.count": 2, "effects.0.jitter": 40 })),
      mastery: MASTERY({ dmg: "dps" },
        T("Núcleo", "Triplica o dano.", { dps: { mul: 3 } })),
      crit: CRIT({},
        T("Campo Minado", "Todo tique crita, e as poças explodem ao sumir.",
          { crit: { set: 1 } },
          { "effects.0.onEnd.0": { type: "damage_instant", amount: "@dps*2.5",
            radius: "@radius*1.4", big: true } })),
    },
  },

  /* --- evolucoes ---------------------------------------------------------- */

  chaosBolt: {
    id: "chaosBolt", cls: "warlock", key: "incinerate", name: "Chaos Bolt",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 0,
    tags: ["fire", "bolt", "rooted"], evolutionOnly: true, vfx: "ember",
    desc: "Enquanto você fica parado, carrega e dispara um projétil único que atravessa a horda e explode em cada inimigo que fura.",
    /* A carga desceu de 1.0s para 0.6s junto com a grade nova: enquanto a
       evolucao vinha pelo caminho "Enraizado", ela chegava com tres degraus de
       reducao de carga embutidos e a peca nunca era JOGADA em 1.0s. Hoje ela
       chega pela Maestria, que so mexe em dano — entao o numero base tem que
       valer sozinho. */
    stats: { ...CRIT_BASE, chargeTime: 0.6, range: 700, damage: 660, speed: 620,
             pierce: 20, projRadius: 15, count: 1, blast: 320 },
    trigger: { type: "rooted", chargeTime: "@chargeTime", range: "@range", needsTarget: true },
    effects: [
      { type: "projectile", damage: "@damage", speed: "@speed", count: "@count",
        radius: "@projRadius", pierce: "@pierce", life: 2.6, trail: 260, color: "#ffb54a",
        onHit: [{ type: "damage_instant", amount: "@blast", radius: 80, big: true }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "chargeTime", verb: "Carrega" },
                     qty: { stat: "count", noun: "projéteis por carga", steps: [2, 3] } },
        T("Salva do Caos", "5 projéteis por carga.", { count: { set: 5 } })),
      mastery: MASTERY({ dmg: ["damage", "blast"] },
        T("Caos Puro", "Triplica o dano.", { damage: { mul: 3 } })),
      crit: CRIT({},
        T("Certeza do Caos", "Todo impacto crita.", { crit: { set: 1 } })),
    },
  },

  wither: {
    id: "wither", cls: "warlock", key: "immolate", name: "Wither",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 0,
    tags: ["fire", "dot", "shadow"], evolutionOnly: true,
    desc: "Mira sozinha em vários alvos: dano em área mais um definhamento longo, que empilha e não pode ser removido.",
    stats: { ...CRIT_BASE, cooldown: 1.6, range: 480, targets: 2, damage: 36,
             dotDps: 44, duration: 14, tickInterval: 0.7, radius: 90, stacks: 4 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius" },
      { type: "damage_over_time", key: "immolate", dps: "@dotDps", duration: "@duration",
        tickInterval: "@tickInterval", color: "#ffb54a", radius: "@radius", removable: false,
        stacking: { mode: "stack", max: "@stacks" } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Aplica" },
                     qty: { stat: "targets", noun: "alvos por vez", steps: [4, 6] } },
        T("Tela Inteira", "Atinge todos os inimigos ao redor.",
          { radius: { set: 500 }, targets: { set: 1 } })),
      mastery: MASTERY({ dmg: ["dotDps", "damage"] },
        T("Definhar Absoluto", "Ao expirar, detona por 8 tiques acumulados.", null,
          { "effects.1.onExpire.0": { type: "damage_instant", amount: "@dotDps*8",
            radius: "@radius*1.4", big: true } })),
      crit: CRIT({},
        T("Morte Silenciosa", "Todo tique crita, e o definhamento empilha até 12 vezes.",
          { crit: { set: 1 }, stacks: { set: 12 } })),
    },
  },

  cataclysm: {
    id: "cataclysm", cls: "warlock", key: "rainOfFire", name: "Cataclysm",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 0,
    tags: ["fire", "area", "directional"], evolutionOnly: true, vfx: "meteor",
    desc: "Lança um meteoro na direção em que você corre: dano pesado no impacto e uma cratera em chamas que fica queimando.",
    stats: { ...CRIT_BASE, cooldown: 1.5, distance: 240, radius: 150, damage: 440,
             dps: 80, duration: 4, tickInterval: 0.35 },
    trigger: { type: "directional", cooldown: "@cooldown", distance: "@distance" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", big: true },
      { type: "area_persistent", radius: "@radius", dps: "@dps", duration: "@duration",
        tell: 0.16,
        look: "fire",
        tickInterval: "@tickInterval", color: "#ffb54a" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Lança" } },
        T("Bombardeio", "Cada lançamento cai em 3 pontos.", null,
          { "effects.1.count": 3, "effects.1.jitter": 120 })),
      mastery: MASTERY({ dmg: ["damage", "dps"] },
        T("Fim do Mundo", "Triplica o dano do impacto.", { damage: { mul: 3 } })),
      crit: CRIT({},
        T("Onda de Choque", "Todo impacto crita, atordoa por 0.8s e empurra tudo por perto.",
          { crit: { set: 1 } },
          { "effects.2": { type: "stun", duration: 0.8, radius: "@radius" },
            "effects.3": { type: "knockback", force: 130, radius: "@radius*1.3" } })),
    },
  },

});
