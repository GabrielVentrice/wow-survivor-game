"use strict";
/* =========================================================================
   ASPECTOS — as seis peças que carregam o subsistema do Hunter.

   Uma peça, um aspecto, e o teto de `BALANCE.aspect.slots` (3) é o que faz a
   escolha existir: com seis no catálogo, levar um é recusar outro. É o pool de
   eixo em miniatura, e é por isso que elas são peças e não passivas — passiva
   não custa nada e não se escolhe contra outra.

   O `trigger` delas não dispara nada: ele REGISTRA o aspecto e sai. Quem
   avalia a condição é `AspectSystem`, em cadência própria.

   Consequência de schema: uma peça de aspecto não tem cooldown, alcance nem
   dano, então os caminhos dela sobem a CONDIÇÃO e o BÔNUS — e é isso que ela
   tem de próprio. Os efeitos são o que ela faz ALÉM de ser uma stance.
   ========================================================================= */

Object.assign(PIECES, {

  aspectOfTheCheetah: {
    id: "aspectOfTheCheetah", cls: "hunter", key: "aspectOfTheCheetah",
    name: "Aspect of the Cheetah",
    color: "#e0b833", axis: "pack", axisPoints: 2,
    tags: ["aspect", "mobility"],
    desc: "Enquanto você estiver na borda da horda, corre muito mais rápido — a postura liga e desliga sozinha.",
    stats: { ...CRIT_BASE, interval: 2.2, boost: 1.45, duration: 1.6, heal: 26 },
    requires: { slot: "aspect" },
    trigger: { type: "aspect", interval: "@interval", aspect: "cheetah" },
    effects: [
      { type: "self_speed", factor: "@boost", duration: "@duration" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Guepardo", "A postura fica teimosa: liga mais cedo e sai mais tarde.", null,
          { "effects.3": { type: "hook", name: "posturaTeimosa", aspect: "cheetah" } })),
      mastery: MASTERY({ dmg: "boost", noun: "pressa", add: [0.15, 0.15, 0.2, 0.25], pct: true },
        T("Tempestade", "Correr deixa poeira que fere e segura quem entra.", null,
          { "effects.2": { type: "area_persistent", radius: 80, dps: "@heal*3",
            duration: 3, tickInterval: 0.4, look: "ash", color: "#9c7a12",
            onTick: [{ type: "slow", factor: 0.5, duration: 2 }] } })),
      crit: CRIT({ noun: "fôlego" },
        T("Incansável", "Correr crita, cura e dá casca.",
          { crit: { set: 1 }, heal: { mul: 3 } },
          { "effects.4": { type: "heal", amount: "@heal", atPlayer: true },
            "effects.5": { type: "shield", amount: "@heal",
              veil: { sides: 3, spin: 1.6, thick: 2 } } })),
    },
  },

  aspectOfTheHawk: {
    id: "aspectOfTheHawk", cls: "hunter", key: "aspectOfTheHawk",
    name: "Aspect of the Hawk",
    color: "#3878e0", axis: "precision", axisPoints: 2,
    tags: ["aspect", "shot"],
    desc: "Enquanto você fica parado por um segundo, todos os seus tiros passam a bater muito mais forte.",
    stats: { ...CRIT_BASE, interval: 1.8, chargeTime: 1.0, range: 540, damage: 190, radius: 62 },
    requires: { slot: "aspect" },
    trigger: { type: "aspect", interval: "@interval", aspect: "hawk" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", atTarget: true,
        shape: "nova", color: "#3878e0" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "O bote sai" } },
        T("Predador", "A postura fica teimosa: liga mais cedo e sai mais tarde.", null,
          { "effects.2": { type: "hook", name: "posturaTeimosa", aspect: "hawk" } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Rasante", "O bote marca o alvo e faz sangrar.", null,
          { "effects.3": { type: "mark", amp: 0.6, duration: 6, atTarget: true },
            "effects.4": { type: "damage_over_time", key: "aspectOfTheHawk",
              dps: "@damage*0.4", duration: 5, tickInterval: 0.5, atTarget: true,
              look: "curse", color: "#3878e0" } })),
      crit: CRIT({},
        T("Garra", "Todo bote crita, e salta para dois vizinhos.",
          { crit: { set: 1 } },
          { "effects.5": { type: "chain", range: 190, falloff: 0.85,
            effects: [{ type: "damage_instant", amount: "@damage*0.8", radius: "@radius" },
                      { type: "chain", range: 190, falloff: 0.85,
                        effects: [{ type: "damage_instant", amount: "@damage*0.6",
                          radius: "@radius" }] }] } })),
    },
  },

  aspectOfTheTurtle: {
    id: "aspectOfTheTurtle", cls: "hunter", key: "aspectOfTheTurtle",
    name: "Aspect of the Turtle",
    color: "#2fd47e", axis: "trapping", axisPoints: 2,
    tags: ["aspect", "defense"],
    desc: "Abaixo de 30% de vida, você se fecha no casco: quase não toma dano, e quase não causa.",
    stats: { ...CRIT_BASE, interval: 2.4, shield: 110, radius: 150, force: 110 },
    requires: { slot: "aspect" },
    trigger: { type: "aspect", interval: "@interval", aspect: "turtle" },
    effects: [
      { type: "shield", amount: "@shield", veil: { sides: 7, spin: 0.5, thick: 4 } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "O casco fecha" } },
        T("Toca", "A postura fica teimosa: fecha mais cedo e abre mais tarde.", null,
          { "effects.4": { type: "hook", name: "posturaTeimosa", aspect: "turtle" } })),
      mastery: MASTERY({ dmg: "shield", noun: "casca" },
        T("Fortaleza", "O casco empurra e fere tudo que estiver encostado.", null,
          { "effects.2": { type: "knockback", force: "@force*2", radius: "@radius" },
            "effects.3": { type: "damage_instant", amount: "@shield*1.5",
              radius: "@radius", shape: "implode", color: "#2fd47e" } })),
      crit: CRIT({ noun: "casca" },
        T("Bastião", "Toda casca crita, cura e faz a horda fugir.",
          { crit: { set: 1 } },
          { "effects.5": { type: "heal", amount: "@shield", atPlayer: true },
            "effects.6": { type: "fear", duration: 2, radius: "@radius" } })),
    },
  },

  aspectOfTheViper: {
    id: "aspectOfTheViper", cls: "hunter", key: "aspectOfTheViper",
    name: "Aspect of the Viper",
    color: "#12915a", axis: "trapping", axisPoints: 2,
    tags: ["aspect", "poison"],
    desc: "Acima de 90% de vida, parte de todo o dano que você causa volta para você como cura.",
    stats: { ...CRIT_BASE, interval: 2.6, dotDps: 74, dotTime: 5, tickInterval: 0.5, radius: 130 },
    requires: { slot: "aspect" },
    trigger: { type: "aspect", interval: "@interval", aspect: "viper" },
    effects: [
      { type: "damage_over_time", key: "aspectOfTheViper", dps: "@dotDps",
        duration: "@dotTime", tickInterval: "@tickInterval", radius: "@radius",
        look: "rot", color: "#12915a" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "O veneno pega" } },
        T("Víbora", "A postura fica teimosa: liga mais cedo e sai mais tarde.", null,
          { "effects.4": { type: "hook", name: "posturaTeimosa", aspect: "viper" } })),
      mastery: MASTERY({ dmg: "dotDps", noun: "dano do veneno" },
        T("Serpente", "O veneno salta para os vizinhos e cobre o dobro do chão.",
          { radius: { mul: 2 } },
          { "effects.2": { type: "chain", range: 180, falloff: 1,
            effects: [{ type: "damage_over_time", key: "aspectOfTheViper",
              dps: "@dotDps", duration: "@dotTime", tickInterval: "@tickInterval",
              look: "rot", color: "#12915a" }] } })),
      crit: CRIT({ noun: "dano do veneno" },
        T("Necrose", "Todo veneno crita, e estoura quando vence.",
          { crit: { set: 1 } },
          { "effects.0.onExpire.0": { type: "damage_instant", amount: "@dotDps*5",
            radius: "@radius", big: true, shape: "implode", color: "#2fd47e" } })),
    },
  },

  aspectOfTheEagle: {
    id: "aspectOfTheEagle", cls: "hunter", key: "aspectOfTheEagle",
    name: "Aspect of the Eagle",
    color: "#6ea6f5", axis: "precision", axisPoints: 2,
    tags: ["aspect", "range"],
    desc: "Enquanto a horda estiver colada em você, todas as suas peças passam a alcançar muito mais longe.",
    stats: { ...CRIT_BASE, interval: 2.4, interval: 2.4, damage: 128, radius: 200, count: 3, jitter: 170 },
    requires: { slot: "aspect" },
    trigger: { type: "aspect", interval: "@interval", aspect: "eagle" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius",
        shape: "nova", color: "#6ea6f5" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Águia", "A postura fica teimosa: liga mais cedo e sai mais tarde.", null,
          { "effects.2": { type: "hook", name: "posturaTeimosa", aspect: "eagle" } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Mergulho", "O pulso vira uma chuva de quedas telegrafadas.", null,
          { "effects.3": { type: "damage_instant", amount: "@damage*0.8",
            radius: "@radius*0.4", count: "@count", jitter: "@jitter", tell: 0.16,
            shape: "rip", color: "#6ea6f5" } })),
      crit: CRIT({},
        T("Presa", "Todo pulso crita, marca e enfraquece quem ele pega.",
          { crit: { set: 1 } },
          { "effects.4": { type: "mark", amp: 0.6, duration: 6, radius: "@radius" },
            "effects.5": { type: "weaken", factor: 0.5, duration: 6, radius: "@radius" } })),
    },
  },

  aspectOfTheWild: {
    id: "aspectOfTheWild", cls: "hunter", key: "aspectOfTheWild",
    name: "Aspect of the Wild",
    color: "#f5d45c", axis: "pack", axisPoints: 2,
    tags: ["aspect", "beast"],
    requires: { tag: "beast", slot: "aspect" },
    desc: "Enquanto a matilha estiver inteira em campo, ela fica mais rápida e bate mais forte.",
    stats: { ...CRIT_BASE, interval: 9, count: 2, damage: 118, duration: 12, attackInterval: 0.85 },
    /* `whileActive: false`: o pulso desta peca E o que enche a matilha, e a
       postura pede matilha cheia. Gatilhado pela postura ele nunca sairia do
       zero — ver a regra em `TRIGGERS.aspect`. */
    trigger: { type: "aspect", interval: "@interval", aspect: "wild", whileActive: false },
    effects: [
      { type: "summon", kind: "wolf", ai: "flank", count: "@count", cap: 6,
        damage: "@damage", duration: "@duration", attackInterval: "@attackInterval" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Chama" },
                     qty: { stat: "count", noun: "lobos por chamado", steps: [4, 6] } },
        T("Alcateia", "Nove lobos por chamado, e a postura fica teimosa.",
          { count: { set: 9 } },
          { "effects.2": { type: "hook", name: "posturaTeimosa", aspect: "wild" } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Fúria", "A mordida abre em área e faz sangrar.", null,
          { "effects.0.onHit.0": { type: "damage_instant", amount: "@damage*0.8",
              radius: 110 },
            "effects.0.onHit.1": { type: "damage_over_time", key: "aspectOfTheWild",
              dps: "@damage*0.4", duration: 5, tickInterval: 0.5, look: "rot",
              color: "#9c7a12" } })),
      crit: CRIT({},
        T("Selvageria", "Toda mordida crita, e um urso vem junto do chamado.",
          { crit: { set: 1 } },
          { "effects.3": { type: "summon", kind: "bear", ai: "anchor", count: 1, cap: 2,
            damage: "@damage*2", duration: "@duration", attackInterval: 1.1 } })),
    },
  },

});
