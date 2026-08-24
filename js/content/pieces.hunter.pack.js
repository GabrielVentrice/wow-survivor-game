"use strict";
/* =========================================================================
   MATILHA — o eixo que escala com o NÚMERO DE BICHOS VIVOS.

   Consequência de desenho: quase toda peça daqui ou põe um bicho em campo ou
   paga por haver bichos em campo. Uma peça de Matilha que não olhe para a
   população está no eixo errado — ela seria uma peça de Precisão pintada de
   ouro.

   Cor: `AXIS_PALETTE.pack` — base #e0b833, light #f5d45c, deep #9c7a12.
   ========================================================================= */

Object.assign(PIECES, {

  /* O kit inicial do hunter. Mira sozinha, não pede nada do jogador e não
     semeia eixo nenhum além do próprio — é a mesma função que o Incinerate tem
     no warlock: a primeira etapa continua sendo descoberta, não confirmação. */
  killCommand: {
    id: "killCommand", cls: "hunter", key: "killCommand", name: "Kill Command",
    color: "#e0b833", axis: "pack", axisPoints: 2,
    tags: ["pack", "strike", "command"], vfx: "thorn",
    desc: "Mira sozinha o inimigo mais próximo e manda a matilha estraçalhá-lo: dano direto que cresce com quantos bichos você tem vivos.",
    stats: { ...CRIT_BASE, cooldown: 1.5, range: 420, damage: 120, radius: 46, perBeast: 26, targets: 1 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      /* `big: true` — o golpe do kit inicial do hunter e um GOLPE PESADO, e
         isso e mecanica e nao adorno: `BIG_HIT` e o evento que Sentinel's Mark
         escuta, e sem uma fonte confiavel dele a peca media zero em todas as
         seis celulas do banco. E a mesma razao pela qual `incinerate` esta
         sempre em campo no warlock — peca reativa precisa de gatilho, e quem o
         garante e a abertura.

         Ele cabe: um comando de 1,5s de recarga num alvo so e exatamente o que
         o hitstop e o soco de camera existem para pontuar. */
      { type: "damage_instant", amount: "@damage", radius: "@radius", atTarget: true,
        big: true, shape: "rip", color: "#e0b833" },
      { type: "hook", name: "comandoDaMatilha", amount: "@perBeast", link: true },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Comanda" },
                     qty: { stat: "targets", noun: "alvos por comando", steps: [2, 4] } },
        T("Matilha Inteira", "Comanda seis alvos de uma vez, e o golpe abre em área.",
          { targets: { set: 6 } },
          { "effects.0.radius": "@radius*1.6" })),
      mastery: MASTERY({ dmg: ["damage", "perBeast"], evolvesInto: "howlOfThePackLeader" },
        T("Howl of the Pack Leader", "EVOLUÇÃO — o comando vira um uivo, e o uivo traz bicho grande.")),
      crit: CRIT({},
        T("Ordem de Abate", "Todo comando crita, e o alvo passa a receber mais dano de tudo.",
          { crit: { set: 1 } },
          { "effects.2": { type: "mark", amp: 0.45, duration: 5, atTarget: true } })),
    },
  },

  barbedShot: {
    id: "barbedShot", cls: "hunter", key: "barbedShot", name: "Barbed Shot",
    color: "#9c7a12", axis: "pack", axisPoints: 2,
    tags: ["pack", "dot", "shot"], vfx: "rot",
    desc: "Mira sozinha e crava um farpado que sangra o alvo — e o cheiro de sangue deixa toda a sua matilha mais rápida enquanto dura.",
    stats: { ...CRIT_BASE, cooldown: 2.6, range: 460, damage: 60, dotDps: 70, dotTime: 6,
             tickInterval: 0.5, speedMul: 0.35, duration: 5, targets: 1 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "projectile", damage: "@damage", speed: 620, radius: 5, trail: 150,
        homing: true, turnRate: 5, color: "#9c7a12",
        onHit: [
          { type: "damage_over_time", key: "barbedShot", dps: "@dotDps",
            duration: "@dotTime", tickInterval: "@tickInterval",
            look: "unstable", color: "#9c7a12" },
        ] },
      { type: "hook", name: "farejarSangue", frac: "@speedMul", duration: "@duration" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Crava" } },
        T("Salva de Farpas", "Crava em três alvos de uma vez.",
          { targets: { set: 3 } })),
      mastery: MASTERY({ dmg: ["dotDps", "damage"] },
        T("Hemorragia", "O sangramento empilha três vezes no mesmo corpo.", null,
          { "effects.0.onHit.0.stacking": { mode: "stack", max: 3 } })),
      crit: CRIT({},
        T("Sede de Sangue", "Todo farpado crita, e o frenesi da matilha dobra.",
          { crit: { set: 1 }, speedMul: { mul: 2 } })),
    },
  },

  beastCleave: {
    id: "beastCleave", cls: "hunter", key: "beastCleave", name: "Beast Cleave",
    color: "#f5d45c", axis: "pack", axisPoints: 2,
    tags: ["pack", "area", "reactive"],
    requires: { tag: "beast" },
    desc: "Sempre que um bicho seu morde, o golpe abre em leque em volta dele e pega tudo que estiver encostado.",
    stats: { ...CRIT_BASE, cooldown: 0.25, damage: 78, radius: 96, bleed: 22 },
    trigger: { type: "reactive", event: "minion_hit", cooldown: "@cooldown" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", atTarget: true,
        shape: "nova", color: "#f5d45c" },
      { type: "damage_over_time", key: "beastCleave", dps: "@bleed", duration: 3,
        tickInterval: 0.5, radius: "@radius", atTarget: true,
        look: "rot", color: "#9c7a12" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Abre" } },
        T("Sem Fôlego", "Abre a cada mordida, sem intervalo nenhum.",
          { cooldown: { set: 0.05 } })),
      mastery: MASTERY({ dmg: ["damage", "bleed"] },
        T("Ceifa", "Dobra o dano e o raio do leque.",
          { damage: { mul: 2 }, radius: { mul: 2 } })),
      crit: CRIT({},
        T("Talho Perfeito", "Todo leque crita, e empurra tudo para fora.",
          { crit: { set: 1 } },
          { "effects.2": { type: "knockback", force: 90, radius: "@radius", atTarget: true } })),
    },
  },

  wildThrash: {
    id: "wildThrash", cls: "hunter", key: "wildThrash", name: "Wild Thrash",
    color: "#e0b833", axis: "pack", axisPoints: 2,
    tags: ["beast", "pack", "melee"],
    desc: "Mantém uma matilha de lobos caçando sozinha: eles cercam o alvo por lados diferentes e cada mordida abre em área.",
    stats: {
      ...CRIT_BASE, count: 3, interval: 7, damage: 92, blast: 62, blastRadius: 72,
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
      haste: HASTE({ rate: { stat: "interval", verb: "A matilha se repõe" },
                     qty: { stat: "count", noun: "lobos na matilha", steps: [5, 8] } },
        T("Alcateia", "Doze lobos, repostos quase de imediato.",
          { count: { set: 12 }, interval: { set: 2 } })),
      mastery: MASTERY({ dmg: ["damage", "blast"] },
        T("Esquartejar", "A mordida faz sangrar, e o sangramento é fundo.", null,
          { "effects.0.onHit.2": { type: "damage_over_time", key: "wildThrash",
            dps: "@damage*0.5", duration: 5, tickInterval: 0.5, look: "rot",
            color: "#9c7a12" } })),
      crit: CRIT({},
        T("Frenesi", "Toda mordida crita, e os lobos mordem no dobro do ritmo.",
          { crit: { set: 1 }, attackInterval: { mul: 0.5 } })),
    },
  },

  callOfTheWild: {
    id: "callOfTheWild", cls: "hunter", key: "direBeast", name: "Call of the Wild",
    color: "#f5d45c", axis: "pack", axisPoints: 0,
    tags: ["beast", "pack", "summon"], evolutionOnly: true, vfx: "sigil",
    desc: "Chama uma leva de javalis que entra inteira de uma vez, investe e some — reforço temporário, não matilha permanente.",
    stats: { ...CRIT_BASE, count: 4, interval: 11, damage: 84, duration: 7, speed: 355, attackInterval: 0.9 },
    trigger: { type: "pack", count: "@count", interval: "@interval", litter: "@count" },
    effects: [
      { type: "summon", kind: "boar", ai: "flank", count: 1, cap: "@count",
        damage: "@damage", duration: "@duration", speed: "@speed",
        attackInterval: "@attackInterval",
        onHit: [{ type: "knockback", force: 60 }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "A leva volta" },
                     qty: { stat: "count", noun: "javalis na leva", steps: [6, 9] } },
        T("Debandada", "Quatorze javalis, e a leva volta quase de imediato.",
          { count: { set: 14 }, interval: { set: 3 } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Chamado da Selva", "Um urso vem junto da leva, e ele bate como três javalis.", null,
          { "effects.2": { type: "summon", kind: "bear", ai: "anchor", count: 1, cap: 2,
            damage: "@damage*3", duration: "@duration", attackInterval: 1.1,
            onHit: [{ type: "knockback", force: 120, radius: 100 }] } })),
      crit: CRIT({},
        T("Estouro da Boiada", "Toda investida crita e atordoa.",
          { crit: { set: 1 } },
          { "effects.0.onHit.2": { type: "stun", duration: 0.8, radius: 90 } })),
    },
  },

  direBeast: {
    id: "direBeast", cls: "hunter", key: "direBeast", name: "Dire Beast",
    color: "#e0b833", axis: "pack", axisPoints: 2,
    tags: ["beast", "summon"],
    desc: "Chama sozinha, de tempos em tempos, um bicho grande da mata — nunca se sabe qual vem, e ele caça sozinho até a hora dele acabar.",
    stats: { ...CRIT_BASE, count: 1, interval: 6, damage: 130, duration: 12, speed: 300, attackInterval: 0.9 },
    trigger: { type: "autonomous", count: "@count", interval: "@interval" },
    effects: [
      { type: "hook", name: "bichoDaMata", damage: "@damage", duration: "@duration",
        speed: "@speed", attackInterval: "@attackInterval", cap: "@count" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Chama" },
                     qty: { stat: "count", noun: "bichos ao mesmo tempo", steps: [3, 5] },
                     evolvesInto: "callOfTheWild" },
        T("Call of the Wild", "EVOLUÇÃO — o chamado deixa de ser um bicho e vira uma leva.")),
      mastery: MASTERY({ dmg: "damage" },
        T("Lendário", "Os bichos da mata batem como chefes.", { damage: { mul: 3 } })),
      crit: CRIT({},
        T("Predador", "Todo golpe da mata crita, e deixa o alvo lento.",
          { crit: { set: 1 } },
          { "effects.0.slow": 0.5 })),
    },
  },

  stampede: {
    id: "stampede", cls: "hunter", key: "stampede", name: "Stampede",
    color: "#9c7a12", axis: "pack", axisPoints: 2,
    tags: ["pack", "line", "charge"], vfx: "meteor",
    desc: "Enquanto você anda, uma correria de bichos atravessa o chão à sua frente e atropela tudo na linha.",
    /* `distance` curta e `radius` largo: uma correria ATROPELA o caminho, e nao
       so o ponto de chegada. Com 130 de distancia contra 104 de raio, o circulo
       nem encostava no jogador — o banco mediu zero em todas as seis celulas
       porque a peca disparava e errava. Agora as duas medidas se sobrepoem, que
       e o que "passa por cima" quer dizer. */
    stats: { ...CRIT_BASE, cooldown: 2.2, distance: 90, damage: 190, radius: 132, force: 90 },
    trigger: { type: "directional", cooldown: "@cooldown", distance: "@distance" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", big: true,
        shape: "rip", color: "#9c7a12" },
      { type: "knockback", force: "@force", radius: "@radius" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "A correria passa" } },
        T("Sem Trégua", "A correria não para enquanto você andar.",
          { cooldown: { set: 0.35 } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Rolo Compressor", "A correria atordoa tudo que atropela.", null,
          { "effects.3": { type: "stun", duration: 0.9, radius: "@radius" } })),
      crit: CRIT({},
        T("Debandada", "Todo atropelo crita, e deixa poeira que fere quem fica.",
          { crit: { set: 1 } },
          { "effects.4": { type: "area_persistent", radius: "@radius*0.9",
            dps: "@damage*0.3", duration: 4, tickInterval: 0.4, look: "ash",
            color: "#9c7a12" } })),
    },
  },

  howlOfThePackLeader: {
    id: "howlOfThePackLeader", cls: "hunter", key: "killCommand",
    name: "Howl of the Pack Leader",
    color: "#f5d45c", axis: "pack", axisPoints: 0,
    tags: ["beast", "summon", "reactive"], evolutionOnly: true, vfx: "sigil",
    requires: { tag: "beast" },
    desc: "Quando você toma dano, o uivo responde: um bicho grande da matilha entra em campo do seu lado e caça até acabar.",
    stats: { ...CRIT_BASE, cooldown: 7, damage: 210, duration: 13, attackInterval: 0.95, count: 1 },
    trigger: { type: "reactive", event: "player_damaged", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "summon", kind: "wyvern", ai: "ranged", count: "@count", cap: 3,
        damage: "@damage", duration: "@duration", attackInterval: "@attackInterval",
        projectile: { damage: "@damage", speed: 560, radius: 5, trail: 120, color: "#f5d45c" } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "O uivo responde" },
                     qty: { stat: "count", noun: "bichos por uivo", steps: [2, 3] } },
        T("Coro", "Cinco bichos por uivo, e ele responde quase de imediato.",
          { count: { set: 5 }, cooldown: { set: 2 } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Manada", "Um urso e um javali entram junto do wyvern.", null,
          { "effects.2": { type: "summon", kind: "bear", ai: "anchor", count: 1, cap: 2,
            damage: "@damage*1.4", duration: "@duration", attackInterval: 1.1,
            onHit: [{ type: "damage_instant", amount: "@damage*0.6", radius: 90 }] },
            "effects.3": { type: "summon", kind: "boar", ai: "flank", count: 2, cap: 5,
            damage: "@damage*0.8", duration: "@duration", attackInterval: 0.9,
            onHit: [{ type: "knockback", force: 80 }] } })),
      crit: CRIT({},
        T("Fúria do Bando", "Todo golpe do bando crita, e a matilha entra em frenesi.",
          { crit: { set: 1 } },
          { "effects.4": { type: "hook", name: "farejarSangue", frac: 0.6, duration: 6 } })),
    },
  },

  bestialWrath: {
    id: "bestialWrath", cls: "hunter", key: "bestialWrath", name: "Bestial Wrath",
    color: "#e0b833", axis: "pack", axisPoints: 2,
    tags: ["pack", "aura", "buff"], vfx: "blood",
    requires: { tag: "beast" },
    desc: "Aura constante em volta de você: fere quem chega perto e deixa a sua matilha em fúria enquanto o pulso durar.",
    stats: { ...CRIT_BASE, interval: 1.1, damage: 96, radius: 168, speedMul: 0.3, duration: 2.4 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius",
        shape: "nova", color: "#e0b833" },
      { type: "hook", name: "farejarSangue", frac: "@speedMul", duration: "@duration" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Sanha", "Pulsa quase continuamente.", { interval: { set: 0.3 } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Selvageria", "O pulso faz sangrar e cobre o dobro do chão.",
          { radius: { mul: 2 } },
          { "effects.2": { type: "damage_over_time", key: "bestialWrath",
            dps: "@damage*0.35", duration: 4, tickInterval: 0.5, radius: "@radius",
            look: "rot", color: "#9c7a12" } })),
      crit: CRIT({},
        T("Fera", "Todo pulso crita, e a fúria da matilha dobra.",
          { crit: { set: 1 }, speedMul: { mul: 2 } })),
    },
  },

  animalCompanion: {
    id: "animalCompanion", cls: "hunter", key: "animalCompanion", name: "Animal Companion",
    color: "#f5d45c", axis: "pack", axisPoints: 2,
    tags: ["beast", "summon", "anchor"],
    desc: "Mantém um urso permanente andando ao seu lado: ele investe em quem chega perto de VOCÊ, não em quem está mais perto dele.",
    stats: { ...CRIT_BASE, count: 1, interval: 5, damage: 165, duration: 24, attackInterval: 1.1,
             blast: 84, blastRadius: 92, shield: 34 },
    trigger: { type: "autonomous", count: "@count", interval: "@interval" },
    effects: [
      { type: "summon", kind: "bear", ai: "anchor", count: 1, cap: "@count",
        damage: "@damage", duration: "@duration", attackInterval: "@attackInterval",
        onHit: [{ type: "damage_instant", amount: "@blast", radius: "@blastRadius" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "attackInterval", verb: "O urso ataca" },
                     qty: { stat: "count", noun: "ursos ao seu lado", steps: [2, 3] } },
        T("Alcateia Fiel", "Cinco ursos ao seu lado, e nenhum some.",
          { count: { set: 5 }, duration: { mul: 6 } })),
      mastery: MASTERY({ dmg: ["damage", "blast"] },
        T("Devastar", "A patada atordoa tudo que ela pega.", null,
          { "effects.0.onHit.2": { type: "stun", duration: 0.8, radius: "@blastRadius" } })),
      crit: CRIT({},
        T("Guardião", "Toda patada crita, e devolve casca para você.",
          { crit: { set: 1 } },
          { "effects.0.onHit.4": { type: "shield", amount: "@shield*3",
            veil: { sides: 4, spin: 0.9, thick: 3 } } })),
    },
  },

});
