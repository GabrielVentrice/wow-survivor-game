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
    stats: { cooldown: 0.75, range: 520, targets: 1, damage: 44, count: 1,
             speed: 560, pierce: 0, projRadius: 6 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "projectile", damage: "@damage", speed: "@speed", count: "@count",
        radius: "@projRadius", pierce: "@pierce", life: 2.2, homing: true,
        turnRate: 9, trail: 150, color: "#ff8a3c" },
    ],
    paths: {
      flame: { name: "Chama", tiers: [
        T("Brasa", "+50% de dano.", { damage: { mul: 1.5 } }),
        T("Cadência", "Dispara 30% mais rápido.", { cooldown: { mul: 0.7 } }),
        T("Fornalha", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Fogo Contínuo", "Dispara 45% mais rápido.", { cooldown: { mul: 0.55 } }),
        T("Incineração", "Cada tiro incendeia o alvo.", null,
          { "effects.0.onHit.0": { type: "damage_over_time", key: "incinerate",
            dps: "@damage*0.4", duration: 5, tickInterval: 0.5, color: "#ff8a3c" } }),
      ]},
      barrage: { name: "Barragem", tiers: [
        T("Duplo", "2 projéteis por tiro.", { count: { set: 2 } }),
        T("Perfuração", "Os tiros atravessam 1 inimigo.", { pierce: { set: 1 } }),
        T("Salva", "4 projéteis por tiro.", { count: { set: 4 } }),
        T("Lança", "Os tiros atravessam 4 inimigos.", { pierce: { set: 4 } }),
        T("Tempestade", "7 projéteis, cada um explode ao acertar.",
          { count: { set: 7 } },
          { "effects.0.onHit.1": { type: "damage_instant", amount: "@damage*0.5", radius: 60 } }),
      ]},
      rooted: { name: "Enraizado", evolvesInto: "chaosBolt", tiers: [
        T("Firmeza", "+45% de dano — o tiro pede pé no chão.", { damage: { mul: 1.45 } }),
        T("Mira", "+40% de alcance.", { range: { mul: 1.4 } }),
        T("Concentração", "Projéteis maiores e mais rápidos.",
          { projRadius: { mul: 1.8 }, speed: { mul: 1.3 } }),
        T("Carga", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Chaos Bolt", "EVOLUÇÃO — vira um único projétil devastador, carregado parado."),
      ]},
    },
  },

  immolate: {
    id: "immolate", cls: "warlock", key: "immolate", name: "Immolate",
    color: "#ff8a3c", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "dot"],
    desc: "Mira sozinha: dano na hora mais um DoT de fogo no alvo. É ela que dá às peças de detonação o que elas precisam.",
    stats: { cooldown: 2, range: 440, targets: 1, damage: 28,
             dotDps: 18, duration: 6, tickInterval: 1, radius: 0, crit: 0, stacks: 1 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_instant", amount: "@damage", crit: "@crit" },
      { type: "damage_over_time", key: "immolate", dps: "@dotDps", duration: "@duration",
        look: "fire",   // queima: o orbe SOBE em vez de girar
        tickInterval: "@tickInterval", color: "#ff8a3c", radius: "@radius",
        stacking: { mode: "refresh", max: 1 } },
    ],
    paths: {
      flame: { name: "Chama", tiers: [
        T("Brasa", "+40% de dano de queima.", { dotDps: { mul: 1.4 } }),
        T("Fogo Rápido", "Queima 40% mais rápido.", { tickInterval: { mul: 0.6 } }),
        T("Labareda", "A queima pega todos num raio de 70.", { radius: { set: 70 } }),
        T("Chama Perfeita", "O impacto sempre crita.", { crit: { set: 1 } }),
        T("Detonação", "Ao expirar, a queima explode por 6x um tick.", null,
          { "effects.1.onExpire.0": { type: "damage_instant", amount: "@dotDps*6",
            radius: 100, big: true } }),
      ]},
      plague: { name: "Praga", evolvesInto: "wither", tiers: [
        T("Persistente", "+4s de duração.", { duration: { add: 4 } }),
        T("Duas Camadas", "Empilha 2 vezes.", { stacks: { set: 2 } },
          { "effects.1.stacking": { mode: "stack", max: "@stacks" } }),
        T("Irremovível", "A queima não pode ser dissipada e dura muito mais.",
          { duration: { mul: 2 } }, { "effects.1.removable": false }),
        T("Contato", "Espalha para quem encostar no alvo.", null,
          { "effects.1.onExpire.1": { type: "spread_on_death", radius: 110, full: false, maxTargets: 4 } }),
        T("Wither", "EVOLUÇÃO — a chama vira podridão eterna."),
      ]},
      reach: { name: "Alcance", tiers: [
        T("Raio Maior", "A queima pega num raio de 60.", { radius: { set: 60 } }),
        T("Dois Alvos", "Incendeia 2 alvos.", { targets: { set: 2 } }),
        T("Quatro Alvos", "Incendeia 4 alvos.", { targets: { set: 4 } }),
        T("Rastro em Chamas", "Deixa fogo no chão a cada conjuração.", null,
          { "effects.2": { type: "area_persistent", radius: "@radius+40", dps: "@dotDps*1.2",
                           duration: 3, tickInterval: 0.35, color: "#ff8a3c" } }),
        T("Tela Inteira", "Incendeia todos os inimigos ao redor.",
          { radius: { set: 460 }, targets: { set: 1 } }),
      ]},
    },
  },

  conflagrate: {
    id: "conflagrate", cls: "warlock", key: "conflagrate", name: "Conflagrate",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "reactive"], vfx: "ember",
    desc: "Sempre que um DoT é aplicado em alguém, detona aquele alvo em área. Precisa de outra peça que aplique DoT.",
    requires: { tag: "dot" },
    stats: { damage: 180, radius: 120, cooldown: 0.9, range: 460 },
    /* Detona QUALQUER DoT, não só o de Immolate. Amarrada ao Immolate ela
       nunca chegava à mesa: a peça habilitadora aparecia em 2 de 12 runs, e
       Conflagrate foi a única do catálogo com zero escolhas em 32 runs. */
    trigger: { type: "reactive", event: "dot_applied", condition: "has_dot",
               cooldown: "@cooldown", needsTarget: true },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", big: true },
    ],
    paths: {
      blast: { name: "Estrondo", tiers: [
        T("Fagulha", "+60% de dano.", { damage: { mul: 1.6 } }),
        T("Estouro", "+40% de raio.", { radius: { mul: 1.4 } }),
        T("Deflagração", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Rajada", "Detona com metade do intervalo.", { cooldown: { mul: 0.5 } }),
        T("Conflagração", "Triplica o dano e dobra o raio.",
          { damage: { mul: 3 }, radius: { mul: 2 } }),
      ]},
      trigger: { name: "Gatilho", tiers: [
        T("Gatilho Fino", "Detona com metade do intervalo mínimo.", { cooldown: { mul: 0.5 } }),
        T("Ao Morrer", "Também detona quando um alvo em chamas morre.", null,
          { "trigger.event": "enemy_killed" }),
        T("Sem Trava", "Praticamente sem intervalo mínimo.", { cooldown: { set: 0.1 } }),
        T("Executor", "Dano triplo em alvos abaixo de 30% de vida.", null,
          { "effects.1": { type: "execute", threshold: 0.3, amount: "@damage",
                           executeMul: 3, radius: "@radius" } }),
        T("Corrente", "A detonação salta para o vizinho a 70%.", null,
          { "effects.2": { type: "chain", range: 190, falloff: 0.7, effects: [
            { type: "damage_instant", amount: "@damage*0.7", radius: "@radius*0.8" }] } }),
      ]},
      ashes: { name: "Cinzas", tiers: [
        T("Rescaldo", "Deixa fogo no chão onde detonou.", null,
          { "effects.3": { type: "area_persistent", radius: "@radius*0.8", dps: "@damage*0.3",
                           duration: 3, tickInterval: 0.35, color: "#ffb54a" } }),
        T("Fornalha", "+60% de dano da poça.", { damage: { mul: 1.6 } }),
        T("Braseiro", "A poça dura 6s.", null, { "effects.3.duration": 6 }),
        T("Sopro Quente", "A detonação empurra tudo por perto.", null,
          { "effects.4": { type: "knockback", force: 80, radius: "@radius" } }),
        T("Terra Queimada", "A poça também reaplica a queima.", null,
          { "effects.3.onTick.0": { type: "damage_over_time", key: "immolate",
            dps: "@damage*0.15", duration: 4, tickInterval: 0.6, color: "#ffb54a" } }),
      ]},
    },
  },

  rainOfFire: {
    id: "rainOfFire", cls: "warlock", key: "rainOfFire", name: "Rain of Fire",
    color: "#ff8a3c", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "area", "rooted"], vfx: "meteor",
    desc: "Enquanto você fica parado, carrega e derruba fogo em volta: zonas que causam dano contínuo em quem estiver dentro.",
    // Peca `rooted` dispara muito menos que uma `auto_target`, entao cada
    // ativacao precisa valer o tempo parado: dano por queda quase dobrado.
    stats: { chargeTime: 1.0, radius: 125, dps: 148, duration: 4,
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
      downpour: { name: "Aguaceiro", tiers: [
        T("Chuva Grossa", "+50% de dano.", { dps: { mul: 1.5 } }),
        T("Cadência", "Carrega 30% mais rápido.", { chargeTime: { mul: 0.7 } }),
        T("Dilúvio", "Dobra o dano.", { dps: { mul: 2 } }),
        T("Tempestade", "3 quedas por carga.", { drops: { set: 3 } }),
        T("Fim do Mundo", "6 quedas e +60% de dano.",
          { drops: { set: 6 }, dps: { mul: 1.6 } }),
      ]},
      scorch: { name: "Chamuscar", tiers: [
        T("Área Ampla", "+35% de raio.", { radius: { mul: 1.35 } }),
        T("Persistente", "+3s de duração da poça.", { duration: { add: 3 } }),
        T("Terra Queimada", "+45% de raio.", { radius: { mul: 1.45 } }),
        T("Brasas", "O fogo incendeia quem pisa.", null,
          { "effects.0.onTick.0": { type: "damage_over_time", key: "rainFire",
            dps: "@dps*0.3", duration: 4, tickInterval: 0.5, color: "#ff8a3c" } }),
        T("Inferno", "Tica 45% mais rápido e o raio dobra.",
          { tickInterval: { mul: 0.55 }, radius: { mul: 2 } }),
      ]},
      strike: { name: "Direcional", evolvesInto: "cataclysm", tiers: [
        T("Mira", "As quedas se concentram: menos dispersão.", { jitter: { mul: 0.4 } }),
        T("Impacto", "+50% de dano.", { dps: { mul: 1.5 } }),
        T("Precisão", "Sem dispersão: cai exatamente onde você está.", { jitter: { set: 0 } }),
        T("Peso", "Dobra o dano e o raio.", { dps: { mul: 2 }, radius: { mul: 1.5 } }),
        T("Cataclysm", "EVOLUÇÃO — vira um meteoro lançado na sua direção de movimento."),
      ]},
    },
  },

  infernal: {
    id: "infernal", cls: "warlock", key: "infernal", name: "Infernal",
    color: "#e0521a", axis: "cataclysm", axisPoints: 3,
    tags: ["fire", "summon"],
    desc: "Invoca um infernal que fica plantado onde caiu e martela em área tudo que se aproximar dele.",
    stats: { count: 1, respawn: 10, duration: 16, damage: 110, radius: 130, range: 300, attackInterval: 0.7 },
    trigger: { type: "autonomous", count: "@count", interval: "@respawn" },
    effects: [
      { type: "summon", kind: "infernal", ai: "turret", count: 1, cap: "@count", big: true,
        duration: "@duration", damage: "@damage", range: "@range",
        attackInterval: "@attackInterval",
        onHit: [{ type: "damage_instant", amount: "@damage", radius: "@radius", big: true }] },
    ],
    paths: {
      impact: { name: "Impacto", tiers: [
        T("Marreta", "+55% de dano.", { damage: { mul: 1.55 } }),
        T("Onda", "+40% de raio do impacto.", { radius: { mul: 1.4 } }),
        T("Devastação", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Martelada", "Cada impacto atordoa por 0.6s.", null,
          { "effects.0.onHit.1": { type: "stun", duration: 0.6, radius: "@radius" } }),
        T("Meteoro Vivo", "Triplica o dano e dobra o raio.",
          { damage: { mul: 3 }, radius: { mul: 2 } }),
      ]},
      legion: { name: "Legião", tiers: [
        T("Dupla", "2 colossos.", { count: { set: 2 } }),
        T("Vigília", "+10s de duração.", { duration: { add: 10 } }),
        T("Trio", "3 colossos.", { count: { set: 3 } }),
        T("Retorno", "Reposição 50% mais rápida.", { respawn: { mul: 0.5 } }),
        T("Cerco", "5 colossos permanentes.",
          { count: { set: 5 } }, { "effects.0.permanent": true }),
      ]},
      ash: { name: "Cinza", tiers: [
        T("Cratera", "Cada impacto deixa fogo no chão.", null,
          { "effects.0.onHit.2": { type: "area_persistent", radius: "@radius*0.7",
            dps: "@damage*0.3", duration: 3, tickInterval: 0.35, color: "#e0521a" } }),
        T("Brasa Viva", "A cratera dura 6s.", null, { "effects.0.onHit.2.duration": 6 }),
        T("Andarilho", "O colosso passa a caminhar atrás dos alvos.", null,
          { "effects.0.ai": "chase", "effects.0.speed": 150 }),
        T("Alcance", "+50% de alcance.", { range: { mul: 1.5 } }),
        T("Terra Rachada", "A cratera incendeia quem pisa.", null,
          { "effects.0.onHit.2.onTick.0": { type: "damage_over_time", key: "infernalFire",
            dps: "@damage*0.2", duration: 4, tickInterval: 0.5, color: "#e0521a" } }),
      ]},
    },
  },

  shadowburn: {
    id: "shadowburn", cls: "warlock", key: "shadowburn", name: "Shadowburn",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "shadow", "reactive", "execute"],
    desc: "Sempre que você acerta um inimigo já abaixo do limiar de vida, dispara um golpe de execução com dano multiplicado.",
    stats: { damage: 80, threshold: 0.2, executeMul: 6, cooldown: 0.4, range: 420, radius: 0 },
    trigger: { type: "reactive", event: "enemy_hit", condition: "enemy_below",
               pct: "@threshold", cooldown: "@cooldown", needsTarget: true },
    effects: [
      { type: "execute", amount: "@damage", threshold: "@threshold",
        executeMul: "@executeMul", radius: "@radius" },
    ],
    paths: {
      finish: { name: "Golpe Final", tiers: [
        T("Fio", "+60% de dano de execução.", { executeMul: { mul: 1.6 } }),
        T("Ceifa", "Executa abaixo de 30% de vida.", { threshold: { set: 0.3 } }),
        T("Decapitação", "Dobra o dano de execução.", { executeMul: { mul: 2 } }),
        T("Sentença", "Executa abaixo de 40% de vida.", { threshold: { set: 0.4 } }),
        T("Fim de Linha", "Triplica o dano de execução.", { executeMul: { mul: 3 } }),
      ]},
      spread: { name: "Difusão", tiers: [
        T("Estilhaço", "Executa todos num raio de 90.", { radius: { set: 90 } }),
        T("Onda", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Sem Trava", "Praticamente sem intervalo mínimo.", { cooldown: { set: 0.05 } }),
        T("Ceifada Larga", "+70% de raio.", { radius: { mul: 1.7 } }),
        T("Colheita", "A execução espalha os DoTs do alvo.", null,
          { "effects.1": { type: "spread_on_death", radius: 150, full: true, maxTargets: 5 } }),
      ]},
      soul: { name: "Alma", tiers: [
        T("Sorvo", "Cada execução cura 12.", null,
          { "effects.2": { type: "heal", amount: 12 } }),
        T("Casca", "Cada execução dá 18 de escudo.", null,
          { "effects.3": { type: "shield", amount: 18, cap: 200 } }),
        T("Banquete", "A cura sobe para 30.", null, { "effects.2.amount": 30 }),
        T("Muralha", "O escudo sobe para 40, teto de 380.", null,
          { "effects.3.amount": 40, "effects.3.cap": 380 }),
        T("Devorador de Almas", "Cada execução invoca um imp.", null,
          { "effects.4": { type: "summon", kind: "imp", ai: "chase", count: 1,
                           cap: 16, duration: 8, damage: "@damage" } }),
      ]},
    },
  },

  burningTrail: {
    id: "burningTrail", cls: "warlock", key: "burningTrail", name: "Burning Trail",
    color: "#e0521a", axis: "cataclysm", axisPoints: 2,
    tags: ["fire", "trail", "area"],
    desc: "Enquanto você anda, o chão pega fogo atrás de você: zonas que causam dano contínuo em quem pisa.",
    stats: { distance: 70, radius: 66, dps: 68, duration: 3, tickInterval: 0.35 },
    trigger: { type: "trail", distance: "@distance" },
    effects: [
      { type: "area_persistent", radius: "@radius", dps: "@dps", duration: "@duration",
        look: "ash",       // rastro: chao chamuscado, tracejado e parado
        tickInterval: "@tickInterval", color: "#e0521a" },
    ],
    paths: {
      heat: { name: "Calor", tiers: [
        T("Brasa", "+50% de dano.", { dps: { mul: 1.5 } }),
        T("Fornalha", "Tica 35% mais rápido.", { tickInterval: { mul: 0.65 } }),
        T("Incandescente", "Dobra o dano.", { dps: { mul: 2 } }),
        T("Ferro em Brasa", "O fogo incendeia quem pisa.", null,
          { "effects.0.onTick.0": { type: "damage_over_time", key: "burningTrail",
            dps: "@dps*0.35", duration: 4, tickInterval: 0.5, color: "#e0521a" } }),
        T("Núcleo", "Triplica o dano.", { dps: { mul: 3 } }),
      ]},
      trail: { name: "Rastro", tiers: [
        T("Passo Curto", "Deixa fogo com metade da distância.", { distance: { mul: 0.5 } }),
        T("Chama Larga", "+40% de raio.", { radius: { mul: 1.4 } }),
        T("Persistente", "+3s de duração.", { duration: { add: 3 } }),
        T("Trilha Larga", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Muralha de Fogo", "As poças duram o triplo.", { duration: { mul: 3 } }),
      ]},
      blast: { name: "Detonação", tiers: [
        T("Estouro", "As poças explodem ao sumir.", null,
          { "effects.0.onEnd.0": { type: "damage_instant", amount: "@dps*2.5",
            radius: "@radius*1.4", big: true } }),
        T("Fissura", "+60% do dano da explosão.", { dps: { mul: 1.6 } }),
        T("Onda", "A explosão empurra tudo por perto.", null,
          { "effects.0.onEnd.1": { type: "knockback", force: 70, radius: "@radius*1.4" } }),
        T("Rachadura", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Campo Minado", "A explosão também atordoa por 0.6s.", null,
          { "effects.0.onEnd.2": { type: "stun", duration: 0.6, radius: "@radius*1.4" } }),
      ]},
    },
  },

  /* --- evolucoes ---------------------------------------------------------- */

  chaosBolt: {
    id: "chaosBolt", cls: "warlock", key: "incinerate", name: "Chaos Bolt",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 0,
    tags: ["fire", "bolt", "rooted"], evolutionOnly: true, vfx: "ember",
    desc: "Enquanto você fica parado, carrega e dispara um projétil único que atravessa a horda e explode em cada inimigo que fura.",
    stats: { chargeTime: 1.0, range: 700, damage: 660, speed: 620, pierce: 20,
             projRadius: 15, count: 1, blast: 320 },
    trigger: { type: "rooted", chargeTime: "@chargeTime", range: "@range", needsTarget: true },
    effects: [
      { type: "projectile", damage: "@damage", speed: "@speed", count: "@count",
        radius: "@projRadius", pierce: "@pierce", life: 2.6, trail: 260, color: "#ffb54a",
        onHit: [{ type: "damage_instant", amount: "@blast", radius: 80, big: true }] },
    ],
    paths: {
      flame: { name: "Chama", tiers: [
        T("Fúria", "+45% de dano.", { damage: { mul: 1.45 } }),
        T("Impacto", "+60% da explosão no impacto.", { blast: { mul: 1.6 } }),
        T("Aniquilação", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Estilhaço", "+80% da explosão.", { blast: { mul: 1.8 } }),
        T("Caos Puro", "Triplica o dano.", { damage: { mul: 3 } }),
      ]},
      barrage: { name: "Barragem", tiers: [
        T("Duplo", "2 projéteis por carga.", { count: { set: 2 } }),
        T("Núcleo Denso", "+60% do raio do projétil.", { projRadius: { mul: 1.6 } }),
        T("Trio", "3 projéteis por carga.", { count: { set: 3 } }),
        T("Velocidade", "+50% de velocidade do projétil.", { speed: { mul: 1.5 } }),
        T("Salva do Caos", "5 projéteis por carga.", { count: { set: 5 } }),
      ]},
      rooted: { name: "Enraizado", tiers: [
        T("Concentração", "Carrega 25% mais rápido.", { chargeTime: { mul: 0.75 } }),
        T("Foco", "+40% de alcance.", { range: { mul: 1.4 } }),
        T("Reflexo", "Carrega 35% mais rápido.", { chargeTime: { mul: 0.65 } }),
        T("Sobrecarga", "Dobra o dano quando parado há mais tempo.", { damage: { mul: 2 } }),
        T("Instantâneo", "Carrega em um terço do tempo.", { chargeTime: { mul: 0.35 } }),
      ]},
    },
  },

  wither: {
    id: "wither", cls: "warlock", key: "immolate", name: "Wither",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 0,
    tags: ["fire", "dot", "shadow"], evolutionOnly: true,
    desc: "Mira sozinha em vários alvos: dano em área mais um definhamento longo, que empilha e não pode ser removido.",
    stats: { cooldown: 1.6, range: 480, targets: 2, damage: 36,
             dotDps: 44, duration: 14, tickInterval: 0.7, radius: 90, stacks: 4 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius" },
      { type: "damage_over_time", key: "immolate", dps: "@dotDps", duration: "@duration",
        tickInterval: "@tickInterval", color: "#ffb54a", radius: "@radius", removable: false,
        stacking: { mode: "stack", max: "@stacks" } },
    ],
    paths: {
      flame: { name: "Chama", tiers: [
        T("Míldio", "+45% de dano do definhamento.", { dotDps: { mul: 1.45 } }),
        T("Aceleração", "Tica 35% mais rápido.", { tickInterval: { mul: 0.65 } }),
        T("Ruína", "Dobra o dano.", { dotDps: { mul: 2 } }),
        T("Colapso", "Empilha até 8 vezes.", { stacks: { set: 8 } }),
        T("Definhar Absoluto", "Ao expirar, detona por 8 ticks acumulados.", null,
          { "effects.1.onExpire.0": { type: "damage_instant", amount: "@dotDps*8",
            radius: "@radius*1.4", big: true } }),
      ]},
      plague: { name: "Praga", tiers: [
        T("Enraizado", "+8s de duração.", { duration: { add: 8 } }),
        T("Perene", "O definhamento nunca expira.", null, { "effects.1.permanent": true }),
        T("Miasma", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Contato", "Espalha para os vizinhos ao expirar.", null,
          { "effects.1.onExpire.1": { type: "spread_on_death", radius: 160, full: true, maxTargets: 6 } }),
        T("Morte Silenciosa", "Empilha até 12 vezes.", { stacks: { set: 12 } }),
      ]},
      reach: { name: "Alcance", tiers: [
        T("Quatro Alvos", "Atinge 4 alvos.", { targets: { set: 4 } }),
        T("Longo Braço", "+40% de alcance.", { range: { mul: 1.4 } }),
        T("Seis Alvos", "Atinge 6 alvos.", { targets: { set: 6 } }),
        T("Amplitude", "+60% de raio.", { radius: { mul: 1.6 } }),
        T("Tela Inteira", "Atinge todos os inimigos ao redor.",
          { radius: { set: 500 }, targets: { set: 1 } }),
      ]},
    },
  },

  cataclysm: {
    id: "cataclysm", cls: "warlock", key: "rainOfFire", name: "Cataclysm",
    color: "#ffb54a", axis: "cataclysm", axisPoints: 0,
    tags: ["fire", "area", "directional"], evolutionOnly: true, vfx: "meteor",
    desc: "Lança um meteoro na direção em que você corre: dano pesado no impacto e uma cratera em chamas que fica queimando.",
    stats: { cooldown: 1.5, distance: 240, radius: 150, damage: 440,
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
      downpour: { name: "Aguaceiro", tiers: [
        T("Massa", "+50% de dano do impacto.", { damage: { mul: 1.5 } }),
        T("Cadência", "Lança 30% mais rápido.", { cooldown: { mul: 0.7 } }),
        T("Extinção", "Dobra o dano do impacto.", { damage: { mul: 2 } }),
        T("Barragem", "Lança 45% mais rápido.", { cooldown: { mul: 0.55 } }),
        T("Fim do Mundo", "Triplica o dano do impacto.", { damage: { mul: 3 } }),
      ]},
      scorch: { name: "Chamuscar", tiers: [
        T("Cratera", "+35% de raio.", { radius: { mul: 1.35 } }),
        T("Braseiro", "+4s de duração da cratera.", { duration: { add: 4 } }),
        T("Lava", "+60% de dano da cratera.", { dps: { mul: 1.6 } }),
        T("Fissura", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Mar de Lava", "A cratera incendeia quem pisa.", null,
          { "effects.1.onTick.0": { type: "damage_over_time", key: "cataclysm",
            dps: "@dps*0.4", duration: 5, tickInterval: 0.5, color: "#ffb54a" } }),
      ]},
      strike: { name: "Direcional", tiers: [
        T("Alcance", "+40% de distância do lançamento.", { distance: { mul: 1.4 } }),
        T("Impacto", "O meteoro atordoa por 0.8s.", null,
          { "effects.2": { type: "stun", duration: 0.8, radius: "@radius" } }),
        T("Longo Alcance", "+50% de distância.", { distance: { mul: 1.5 } }),
        T("Onda de Choque", "O impacto empurra tudo por perto.", null,
          { "effects.3": { type: "knockback", force: 130, radius: "@radius*1.3" } }),
        T("Bombardeio", "Cada lançamento cai em 3 pontos.", null, { "effects.1.count": 3,
          "effects.1.jitter": 120 }),
      ]},
    },
  },

});
