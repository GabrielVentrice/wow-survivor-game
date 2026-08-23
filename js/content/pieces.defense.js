"use strict";
/* =========================================================================
   DEFENSIVAS — todas automaticas, como o resto. Custam 1 ponto de eixo em vez
   de 2: sao utilidade, nao identidade, e nao deveriam consumir a build.
   ========================================================================= */

Object.assign(PIECES, {

  drainLife: {
    id: "drainLife", key: "drainLife", name: "Drain Life",
    color: "#4a9e2e", axis: "corruption", axisPoints: 1,
    tags: ["shadow", "heal", "aura"], vfx: "blood",
    desc: "Aura constante: causa dano em volta de você e devolve parte dele como cura. Não pede alvo nem posição.",
    stats: { ...CRIT_BASE, interval: 0.5, radius: 165, damage: 24, heal: 0.25 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius",
        // dreno PUXA: a casca converge para o warlock em vez de estourar
        shape: "implode",
        onHit: [{ type: "heal", frac: "@heal" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Sopro", "O pulso também empurra a horda.", null,
          { "effects.1": { type: "knockback", force: 26, radius: "@radius" } })),
      mastery: MASTERY({ dmg: "damage", evolvesInto: "soulRot" },
        T("Soul Rot", "EVOLUÇÃO — a aura vira podridão que drena tudo por perto.")),
      crit: CRIT({},
        T("Hemorragia", "Todo pulso crita, e o dreno também aplica um DoT.",
          { crit: { set: 1 } },
          { "effects.0.onHit.1": { type: "damage_over_time", key: "drain",
            dps: "@damage*0.5", duration: 5, tickInterval: 0.6, color: "#4a9e2e" } })),
    },
  },

  soulLeech: {
    id: "soulLeech", key: "soulLeech", name: "Soul Leech",
    color: "#e0521a", axis: "cataclysm", axisPoints: 1,
    tags: ["shield", "reactive"],
    desc: "Sempre que você causa dano, uma fração dele vira escudo, até um teto. Quanto mais dano a build faz, mais grossa a casca.",
    stats: { ...CRIT_BASE, frac: 0.06, cap: 180, cooldown: 0.1, thorns: 8 },
    trigger: { type: "reactive", event: "enemy_hit", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "shield", frac: "@frac", cap: "@cap",
        // absorcao: fina e rapida, ela se refaz a cada golpe
        veil: { sides: 8, spin: 0.95, thick: 1.5 } },
      { type: "damage_instant", amount: "@thorns", radius: 90 },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Converte" } },
        T("Carapaça de Espinhos", "Os espinhos pegam num raio bem maior e atordoam.",
          null, { "effects.1.radius": 160,
                  "effects.2": { type: "stun", duration: 0.3, radius: 160 } })),
      mastery: MASTERY({ dmg: ["frac", "thorns"], noun: "conversão e espinhos" },
        T("Casulo", "Triplica a conversão e dobra o teto.",
          { frac: { mul: 3 }, cap: { mul: 2 } })),
      crit: CRIT({},
        T("Imortalidade", "Todo espinho crita, e cada acerto ainda cura 12% do dano.",
          { crit: { set: 1 } }, { "effects.3": { type: "heal", frac: 0.12 } })),
    },
  },

  unendingResolve: {
    id: "unendingResolve", key: "unendingResolve", name: "Unending Resolve",
    color: "#6a28c8", axis: "dominion", axisPoints: 1,
    tags: ["shield", "reactive"],
    desc: "Quando você toma dano com a vida abaixo do limiar, ganha um escudo grande e empurra quem estiver colado. Tem recarga.",
    stats: { ...CRIT_BASE, threshold: 0.35, shield: 90, cap: 260, cooldown: 8,
             blast: 120 },
    trigger: { type: "reactive", event: "player_damaged", condition: "player_below",
               pct: "@threshold", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "shield", amount: "@shield", cap: "@cap",
        // resolucao: quatro faces pesadas, e o espinho do revide
        veil: { sides: 4, spin: 0.3, thick: 3, spikes: 1 } },
      { type: "knockback", force: 140, radius: 200 },
      { type: "damage_instant", amount: "@blast", radius: 220, big: true, shape: "nova" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Recarrega" } },
        T("Segunda Chance", "Dispara já abaixo de 65% de vida.", { threshold: { set: 0.65 } })),
      mastery: MASTERY({ dmg: ["shield", "cap", "blast"], noun: "escudo e revide" },
        T("Inquebrável", "Triplica o escudo.", { shield: { mul: 3 } })),
      crit: CRIT({},
        T("Última Palavra", "Todo revide crita, atordoa por 1.2s e amedronta por 2s.",
          { crit: { set: 1 } },
          { "effects.3": { type: "stun", duration: 1.2, radius: 220 },
            "effects.4": { type: "fear", duration: 2, radius: 260 } })),
    },
  },

  demonSkin: {
    id: "demonSkin", key: "demonSkin", name: "Demon Skin",
    color: "#6a28c8", axis: "dominion", axisPoints: 1,
    tags: ["shield", "aura", "summon"],
    desc: "Aura constante: repõe escudo a cada segundo, e cada demônio vivo aumenta o teto desse escudo.",
    stats: { ...CRIT_BASE, interval: 1, shield: 12, cap: 200, thorns: 14 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "shield", amount: "@shield", cap: "@cap",
        // couro: grosso e lento, e o que menos parece energia
        veil: { sides: 5, spin: 0.18, thick: 3.4 } },
      { type: "damage_instant", amount: "@thorns", radius: 70 },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Renovação", "Cada pulso também cura 30.", null,
          { "effects.2": { type: "heal", amount: 30 } })),
      mastery: MASTERY({ dmg: ["shield", "cap", "thorns"], noun: "escudo e espinhos" },
        T("Placa Demoníaca", "Triplica o escudo por pulso.", { shield: { mul: 3 } })),
      crit: CRIT({},
        T("Fortaleza", "Todo espinho crita, pega mais longe e empurra.",
          { crit: { set: 1 } },
          { "effects.1.radius": 115,
            "effects.3": { type: "knockback", force: 40, radius: 115 } })),
    },
  },

  healthstone: {
    id: "healthstone", key: "healthstone", name: "Healthstone",
    color: "#e0521a", axis: "cataclysm", axisPoints: 1,
    tags: ["heal", "reactive"],
    desc: "Quando sua vida cai abaixo do limiar, a pedra se parte sozinha e cura de uma vez. Volta a existir depois da recarga.",
    stats: { ...CRIT_BASE, threshold: 0.3, frac: 0.35, cooldown: 14 },
    trigger: { type: "reactive", event: "player_damaged", condition: "player_below",
               pct: "@threshold", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "hook", name: "healthstone", threshold: "@threshold", frac: "@frac" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Repõe a pedra" } },
        T("Inesgotável", "Repõe a pedra em 2s.", { cooldown: { set: 2 } })),
      mastery: MASTERY({ dmg: "frac", noun: "cura" },
        T("Coração de Pedra", "A pedra se parte já abaixo de 45% de vida.",
          { threshold: { set: 0.45 } })),
      crit: CRIT({ noun: "cura" },
        T("Alma de Pedra", "Toda cura crita, e a pedra ainda dá 300 de escudo.",
          { crit: { set: 1 } },
          { "effects.1": { type: "shield", amount: 300, cap: 500 } })),
    },
  },

  netherWard: {
    id: "netherWard", key: "netherWard", name: "Nether Ward",
    color: "#6a28c8", axis: "dominion", axisPoints: 1,
    tags: ["shield", "aura"],
    desc: "Aura constante: desmancha os projéteis inimigos que entram no raio e ainda repõe um pouco de escudo.",
    stats: { ...CRIT_BASE, interval: 1.4, radius: 150, shield: 10,
             reflect: 30, blastRadius: 80 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "reflect", radius: "@radius", damage: "@reflect", blastRadius: "@blastRadius" },
      { type: "shield", amount: "@shield", cap: 140,
        // barreira: anel apertado girando ao CONTRARIO — ela devolve
        veil: { sides: 12, spin: -0.75, thick: 1.4 } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Repulsa", "O pulso empurra a horda e a deixa lenta por 2s.", null,
          { "effects.2": { type: "knockback", force: 50, radius: "@radius" },
            "effects.3": { type: "slow", factor: 0.6, duration: 2, radius: "@radius" } })),
      mastery: MASTERY({ dmg: ["shield", "reflect"], noun: "escudo e dano devolvido" },
        T("Muralha do Vazio", "Triplica o escudo e o dano devolvido.",
          { shield: { mul: 3 }, reflect: { mul: 3 } })),
      crit: CRIT({ noun: "escudo" },
        T("Espelho", "Todo pulso crita e o raio da barreira dobra.",
          { crit: { set: 1 }, radius: { mul: 2 } })),
    },
  },

  soulstone: {
    id: "soulstone", key: "soulstone", name: "Soulstone",
    color: "#4a9e2e", axis: "corruption", axisPoints: 1,
    tags: ["heal", "revive"],
    desc: "Guarda uma alma: quando você morre, ela se gasta e te levanta de volta com parte da vida.",
    stats: { ...CRIT_BASE, interval: 45, revives: 1, shield: 50, cap: 250,
             impDamage: 20 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "hook", name: "soulstone", max: "@revives" },
      { type: "shield", amount: "@shield", cap: "@cap",
        // a alma guardada: seis faces lentas, e o espinho do que ela cobra
        veil: { sides: 6, spin: 0.22, thick: 2.6, spikes: 1 } },
      { type: "summon", kind: "imp", ai: "chase", count: 2, cap: 12,
        duration: 20, damage: "@impDamage" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Repõe a alma" },
                     qty: { stat: "revives", noun: "almas guardadas", steps: [2, 3] } },
        T("Reencarnação", "Guarda 5 cargas e repõe a cada 12s.",
          { revives: { set: 5 }, interval: { set: 12 } })),
      mastery: MASTERY({ dmg: ["shield", "cap", "impDamage"], noun: "escudo e servos" },
        T("Âncora Vital", "Cada reposição também cura 45.", null,
          { "effects.3": { type: "heal", amount: 45 } })),
      crit: CRIT({},
        T("Legião de Almas", "Todo servo crita, e a reposição traz 6 caçadores.",
          { crit: { set: 1 } },
          { "effects.2.kind": "dreadstalker", "effects.2.count": 6,
            "effects.2.duration": 40 })),
    },
  },

});
