"use strict";
/* =========================================================================
   MOVIMENTO E CONTROLE — o que compra espaco.
   Nao matam; decidem onde a horda pode estar. Numa build em que a unica
   decisao em tempo real e posicionamento, isso e dano indireto.
   ========================================================================= */

Object.assign(PIECES, {

  burningRush: {
    id: "burningRush", key: "burningRush", name: "Burning Rush",
    color: "#ff8a3c", axis: "cataclysm", axisPoints: 1,
    tags: ["speed", "aura"],
    desc: "Aura constante: você anda muito mais rápido e queima a própria vida por segundo. A queima para num piso — nunca mata.",
    stats: { ...CRIT_BASE, interval: 0.5, speedMul: 1.35, drain: 0.55, radius: 0,
             wake: 26, wakeRadius: 60 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "self_speed", factor: "@speedMul", duration: 0.7 },
      { type: "self_damage", amount: "@drain" },
      { type: "area_persistent", radius: "@wakeRadius", dps: "@wake", duration: 2,
        look: "ash", tickInterval: 0.4, color: "#ff8a3c" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Sem Custo", "A corrida deixa de queimar vida.", { drain: { set: 0 } })),
      mastery: MASTERY({ dmg: "speedMul", noun: "velocidade",
                         add: [0.08, 0.1, 0.12, 0.15], pct: true },
        T("Velocidade do Vazio", "+25% de velocidade.", { speedMul: { add: 0.25 } })),
      crit: CRIT({},
        T("Cometa", "Toda esteira crita, triplica de dano e empurra quem pisa.",
          { crit: { set: 1 }, wake: { mul: 3 } },
          { "effects.3": { type: "knockback", force: 40, radius: "@wakeRadius" } })),
    },
  },

  demonicCircle: {
    id: "demonicCircle", key: "demonicCircle", name: "Demonic Circle",
    color: "#9a4cff", axis: "dominion", axisPoints: 1,
    tags: ["escape", "aura"],
    desc: "Se inimigos demais fecharem em volta de você, te teleporta para fora do cerco na hora. Automático.",
    stats: { ...CRIT_BASE, interval: 1, minEnemies: 7, checkRadius: 130,
             distance: 240, blast: 70, blastRadius: 140 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "hook", name: "blink", minEnemies: "@minEnemies",
        checkRadius: "@checkRadius", distance: "@distance" },
      { type: "damage_instant", amount: "@blast", radius: "@blastRadius", big: true,
        // a saida RASGA o cerco: o talho, e nao a bola de fogo
        shape: "rip" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Checa o cerco" } },
        /* O limiar sozinho PIORAVA a peca — medido no banco: saltar mais cedo
           tira o warlock de perto antes de a horda fechar, entao cada saida
           pegava menos corpos. O raio maior e o que paga a pressa. */
        T("Fuga Constante", "Dispara já com 3 inimigos em volta, e a saída pega mais longe.",
          { minEnemies: { set: 3 }, blastRadius: { mul: 1.6 } })),
      mastery: MASTERY({ dmg: ["blast", "distance"], noun: "dano da saída e distância" },
        T("Colapso", "Triplica o dano da saída.", { blast: { mul: 3 } })),
      crit: CRIT({},
        T("Portal de Guerra", "Toda saída crita e invoca 3 caçadores na chegada.",
          { crit: { set: 1 } },
          { "effects.2": { type: "summon", kind: "dreadstalker", ai: "chase",
                           count: 3, cap: 12, duration: 10, damage: 30 },
            "effects.3": { type: "vfx", kind: "portal", radius: 26 } })),
    },
  },

  shadowfury: {
    id: "shadowfury", key: "shadowfury", name: "Shadowfury",
    color: "#e0521a", axis: "cataclysm", axisPoints: 1,
    tags: ["control", "aura"],
    desc: "A cada poucos segundos, um pulso atordoa e machuca todos os inimigos em volta de você.",
    stats: { ...CRIT_BASE, interval: 6, radius: 190, duration: 1.2, damage: 60 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "stun", duration: "@duration", radius: "@radius", shape: "nova" },
      // a casca varrendo o chao: o que ela informa e ate onde o controle pegou
      { type: "damage_instant", amount: "@damage", radius: "@radius", shape: "nova" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Tempo Parado", "O atordoamento pega até os chefes.", null,
          { "effects.0.affectsBoss": true })),
      mastery: MASTERY({ dmg: ["damage", "duration"], noun: "dano e atordoamento" },
        T("Cataclismo", "Triplica o dano e o pulso vira um golpe grande.",
          { damage: { mul: 3 } }, { "effects.1.big": true })),
      crit: CRIT({},
        T("Fratura", "Todo pulso crita e deixa os atordoados lentos por 3s.",
          { crit: { set: 1 } },
          { "effects.2": { type: "slow", factor: 0.5, duration: 3, radius: "@radius" } })),
    },
  },

  curseOfExhaustion: {
    id: "curseOfExhaustion", key: "curseOfExhaustion", name: "Curse of Exhaustion",
    color: "#4a9e2e", axis: "corruption", axisPoints: 1,
    tags: ["control", "aura"],
    desc: "Aura constante: todo inimigo dentro do raio anda mais devagar enquanto estiver nele.",
    stats: { ...CRIT_BASE, interval: 0.6, radius: 210, factor: 0.65, duration: 1.4 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "slow", factor: "@factor", duration: "@duration", radius: "@radius" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Horizonte", "Dobra o raio da aura.", { radius: { mul: 2 } })),
      mastery: MASTERY({ dmg: "factor", noun: "velocidade dos afetados",
                         add: [-0.1, -0.1, -0.12, -0.12], pct: true },
        T("Estase", "Reduz a velocidade deles a um décimo.", { factor: { set: 0.1 } })),
      crit: CRIT({ noun: "efeito" },
        T("Colapso", "Toda lentidão crita, e a aura apodrece quem está dentro.",
          { crit: { set: 1 } },
          { "effects.1": { type: "damage_over_time", key: "exhaust", dps: 45,
            duration: 4, tickInterval: 0.6, color: "#4a9e2e", radius: "@radius" } })),
    },
  },

  curseOfTongues: {
    id: "curseOfTongues", key: "curseOfTongues", name: "Curse of Tongues",
    color: "#4a9e2e", axis: "corruption", axisPoints: 1,
    tags: ["control", "aura"],
    desc: "Aura constante: inimigos dentro do raio atacam mais devagar e causam menos dano de contato.",
    stats: { ...CRIT_BASE, interval: 0.8, radius: 220, factor: 0.6, duration: 2 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "weaken", factor: "@factor", duration: "@duration", radius: "@radius" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Horizonte", "Dobra o raio da aura.", { radius: { mul: 2 } })),
      mastery: MASTERY({ dmg: "factor", noun: "dano dos afetados",
                         add: [-0.1, -0.1, -0.12, -0.12], pct: true },
        T("Silêncio Absoluto", "Reduz o dano deles a um quinto.", { factor: { set: 0.2 } })),
      crit: CRIT({ noun: "efeito" },
        T("Loucura", "Todo pulso crita e amedronta por 2s, chefes incluídos.",
          { crit: { set: 1 } },
          { "effects.1": { type: "fear", duration: 2, radius: "@radius",
                           affectsBoss: true } })),
    },
  },

  howlOfTerror: {
    id: "howlOfTerror", key: "howlOfTerror", name: "Howl of Terror",
    color: "#6a28c8", axis: "dominion", axisPoints: 1,
    tags: ["control", "reactive"],
    desc: "Quando você toma dano, um grito faz os inimigos em volta fugirem por alguns segundos. Resposta, não prevenção.",
    stats: { ...CRIT_BASE, radius: 200, duration: 2.2, cooldown: 4 },
    trigger: { type: "reactive", event: "player_damaged", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "fear", duration: "@duration", radius: "@radius" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Grita" } },
        T("Horizonte", "Dobra o raio do grito.", { radius: { mul: 2 } })),
      mastery: MASTERY({ dmg: "duration", noun: "duração do medo" },
        T("Grito de Ruína", "O grito também causa 350 de dano em área.", null,
          { "effects.1": { type: "damage_instant", amount: 350, radius: "@radius",
                           big: true } })),
      crit: CRIT({ noun: "efeito" },
        T("Loucura", "Todo grito crita e o medo passa a afetar chefes.",
          { crit: { set: 1 } }, { "effects.0.affectsBoss": true })),
    },
  },

  mortalCoil: {
    id: "mortalCoil", key: "mortalCoil", name: "Mortal Coil",
    color: "#4a9e2e", axis: "corruption", axisPoints: 1,
    tags: ["control", "heal", "reactive"],
    desc: "Quando você toma dano com a vida abaixo do limiar, empurra a horda para longe e devolve parte da vida.",
    stats: { ...CRIT_BASE, threshold: 0.4, radius: 190, force: 170,
             heal: 0.2, cooldown: 9 },
    trigger: { type: "reactive", event: "player_damaged", condition: "player_below",
               pct: "@threshold", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "knockback", force: "@force", radius: "@radius" },
      { type: "hook", name: "healthstone", threshold: 1, frac: "@heal" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Recarrega" } },
        T("Alerta", "Dispara já abaixo de 55% de vida.", { threshold: { set: 0.55 } })),
      mastery: MASTERY({ dmg: ["heal", "force"], noun: "cura e empurrão" },
        T("Vórtice", "O empurrão também atordoa por 1.5s.", null,
          { "effects.2": { type: "stun", duration: 1.5, radius: "@radius" } })),
      /* O revide NAO ganha dano. Mortal Coil e uma peca de fuga e cura, e um
         `execute` aqui a transformaria numa peca de dano que so dispara com o
         warlock quase morto — o banco reprova exatamente isso, e com razao: a
         linha nao poderia entregar o que anuncia. */
      crit: CRIT({ noun: "cura" },
        T("Ceifa", "Toda cura crita, e o revide amedronta por 3s e dá 90 de escudo.",
          { crit: { set: 1 } },
          { "effects.3": { type: "fear", duration: 3, radius: "@radius" },
            "effects.4": { type: "shield", amount: 90, cap: 300 } })),
    },
  },

  banish: {
    id: "banish", key: "banish", name: "Banish",
    color: "#6a28c8", axis: "dominion", axisPoints: 1,
    tags: ["control"],
    desc: "A cada poucos segundos, prende no lugar um inimigo dentro do alcance — chefe incluído.",
    stats: { ...CRIT_BASE, cooldown: 7, range: 460, duration: 5, targets: 1 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "stun", duration: "@duration", affectsBoss: true },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Bane" },
                     qty: { stat: "targets", noun: "alvos banidos por vez", steps: [2, 4] } },
        T("Expurgo", "Bane todos num raio de 200.", null, { "effects.0.radius": 200 })),
      mastery: MASTERY({ dmg: "duration", noun: "duração do banimento" },
        T("Exílio", "Triplica a duração.", { duration: { mul: 3 } })),
      crit: CRIT({ noun: "efeito" },
        T("Execução", "Todo banimento crita, marca o alvo e o executa ao acabar.",
          { crit: { set: 1 } },
          { "effects.1": { type: "mark", amp: 0.8, duration: "@duration" },
            "effects.2": { type: "damage_over_time", key: "banish", dps: 60,
              duration: "@duration", tickInterval: 0.5, color: "#6a28c8",
              onExpire: [{ type: "damage_instant", amount: 600, radius: 130, big: true }] } })),
    },
  },

  enslaveDemon: {
    id: "enslaveDemon", key: "enslaveDemon", name: "Enslave Demon",
    color: "#9a4cff", axis: "dominion", axisPoints: 1,
    tags: ["control", "summon"],
    desc: "A cada poucos segundos, converte um inimigo em aliado temporário: ele passa a lutar do seu lado.",
    stats: { ...CRIT_BASE, cooldown: 8, range: 300, duration: 10 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: 1 },
    effects: [
      { type: "convert", duration: "@duration" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Escraviza" } },
        T("Chamado", "Converte todos num raio de 160.", null,
          { "effects.0.radius": 160 })),
      mastery: MASTERY({ dmg: "duration", noun: "duração da servidão" },
        T("Escravidão Eterna", "Sextuplica a duração.", { duration: { mul: 6 } })),
      crit: CRIT({ noun: "efeito" },
        T("Recrutamento", "Toda conversão crita, dá 90 de escudo e invoca 4 caçadores.",
          { crit: { set: 1 } },
          { "effects.1": { type: "shield", amount: 90, cap: 220 },
            "effects.2": { type: "summon", kind: "dreadstalker", ai: "chase",
                           count: 4, cap: 16, duration: 12, damage: 45 } })),
    },
  },

});
