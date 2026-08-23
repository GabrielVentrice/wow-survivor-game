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
    desc: "Enquanto não houver inimigo por perto, você corre muito mais rápido — a postura liga e desliga sozinha.",
    stats: { boost: 1.45, duration: 1.6, heal: 26 },
    trigger: { type: "aspect", aspect: "cheetah" },
    effects: [
      { type: "self_speed", factor: "@boost", duration: "@duration" },
    ],
    paths: {
      sprint: { name: "Arranque", tiers: [
        T("Passo", "+15% da pressa que a peça dá por conta própria.", { boost: { mul: 1.15 } }),
        T("Fôlego", "A pressa dura +1s.", { duration: { add: 1 } }),
        T("Disparada", "+20% da pressa.", { boost: { mul: 1.2 } }),
        T("Vento", "A pressa dura +2s.", { duration: { add: 2 } }),
        T("Guepardo", "+30% da pressa.", { boost: { mul: 1.3 } }),
      ]},
      trail: { name: "Rastro", tiers: [
        T("Poeira", "Correr deixa poeira que fere quem entra.", null,
          { "effects.2": { type: "area_persistent", radius: 70, dps: "@heal*1.6",
            duration: 2.4, tickInterval: 0.4, look: "ash", color: "#9c7a12" } }),
        T("Densa", "+70% do dano da poeira.", { heal: { mul: 1.7 } }),
        T("Cega", "A poeira deixa quem entra mais lento.", null,
          { "effects.2.onTick.0": { type: "slow", factor: 0.6, duration: 1.5 } }),
        T("Assenta Devagar", "A poeira dura +3s.", null, { "effects.2.duration": 5.4 }),
        T("Tempestade", "Dobra o dano da poeira.", { heal: { mul: 2 } }),
      ]},
      wind: { name: "Segundo Ar", tiers: [
        T("Respiro", "Correr também cura um pouco.", null,
          { "effects.4": { type: "heal", amount: "@heal", atPlayer: true } }),
        T("Fôlego Longo", "+80% da cura.", { heal: { mul: 1.8 } }),
        T("Casca", "Correr também dá casca.", null,
          { "effects.5": { type: "shield", amount: "@heal",
            veil: { sides: 3, spin: 1.6, thick: 2 } } }),
        T("Leve", "+25% da pressa.", { boost: { mul: 1.25 } }),
        T("Incansável", "Dobra a cura e a casca.", { heal: { mul: 2 } }),
      ]},
    },
  },

  aspectOfTheHawk: {
    id: "aspectOfTheHawk", cls: "hunter", key: "aspectOfTheHawk",
    name: "Aspect of the Hawk",
    color: "#3878e0", axis: "precision", axisPoints: 2,
    tags: ["aspect", "shot"],
    desc: "Enquanto você fica parado por dois segundos, todos os seus tiros passam a bater muito mais forte.",
    stats: { chargeTime: 1.6, range: 540, damage: 190, radius: 62 },
    trigger: { type: "aspect", aspect: "hawk" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", atTarget: true,
        shape: "nova", color: "#3878e0" },
    ],
    paths: {
      perch: { name: "Poleiro", tiers: [
        T("Mira", "+50% de dano do bote.", { damage: { mul: 1.5 } }),
        T("Área", "+45% de raio.", { radius: { mul: 1.45 } }),
        T("Peso", "Dobra o dano do bote.", { damage: { mul: 2 } }),
        T("Alcance", "+40% de alcance.", { range: { mul: 1.4 } }),
        T("Predador", "Triplica o dano do bote.", { damage: { mul: 3 } }),
      ]},
      dive: { name: "Rasante", tiers: [
        T("Marca", "O bote marca o alvo por 4s.", null,
          { "effects.2": { type: "mark", amp: 0.3, duration: 4, atTarget: true } }),
        T("Fundo", "+60% da marca.", null,
          { "effects.2": { type: "mark", amp: 0.48, duration: 5, atTarget: true } }),
        T("Sangra", "O bote faz sangrar.", null,
          { "effects.3": { type: "damage_over_time", key: "aspectOfTheHawk",
            dps: "@damage*0.25", duration: 4, tickInterval: 0.5, atTarget: true,
            look: "curse", color: "#3878e0" } }),
        T("Rasgo", "+70% de dano.", { damage: { mul: 1.7 } }),
        T("Sentença", "A marca fica muito mais forte.", null,
          { "effects.2": { type: "mark", amp: 0.9, duration: 6, atTarget: true } }),
      ]},
      talon: { name: "Garra", tiers: [
        T("Estilhaço", "O bote salta para um vizinho.", null,
          { "effects.4": { type: "chain", range: 170, falloff: 0.7,
            effects: [{ type: "damage_instant", amount: "@damage*0.7", radius: "@radius" }] } }),
        T("Duplo", "O bote salta de novo.", null,
          { "effects.4.effects.1": { type: "chain", range: 170, falloff: 0.7,
            effects: [{ type: "damage_instant", amount: "@damage*0.5", radius: "@radius" }] } }),
        T("Peso", "+60% de dano.", { damage: { mul: 1.6 } }),
        T("Recuo", "O bote empurra tudo por perto.", null,
          { "effects.5": { type: "knockback", force: 90, radius: "@radius", atTarget: true } }),
        T("Sem Perda", "O salto perde muito menos força.", null,
          { "effects.4.falloff": 1 }),
      ]},
    },
  },

  aspectOfTheTurtle: {
    id: "aspectOfTheTurtle", cls: "hunter", key: "aspectOfTheTurtle",
    name: "Aspect of the Turtle",
    color: "#2fd47e", axis: "trapping", axisPoints: 2,
    tags: ["aspect", "defense"],
    desc: "Abaixo de 30% de vida, você se fecha no casco: quase não toma dano, e quase não causa.",
    stats: { shield: 110, radius: 150, force: 110 },
    trigger: { type: "aspect", aspect: "turtle" },
    effects: [
      { type: "shield", amount: "@shield", veil: { sides: 7, spin: 0.5, thick: 4 } },
    ],
    paths: {
      shell: { name: "Casco", tiers: [
        T("Placa", "+50% de casca.", { shield: { mul: 1.5 } }),
        T("Camada", "+60% de casca.", { shield: { mul: 1.6 } }),
        T("Couraça", "Dobra a casca.", { shield: { mul: 2 } }),
        T("Quilha", "+70% de casca.", { shield: { mul: 1.7 } }),
        T("Fortaleza", "Triplica a casca.", { shield: { mul: 3 } }),
      ]},
      spikes: { name: "Espinhos", tiers: [
        T("Ferrão", "O casco empurra quem está encostado.", null,
          { "effects.2": { type: "knockback", force: "@force", radius: "@radius" } }),
        T("Contra-golpe", "O empurrão também fere.", null,
          { "effects.3": { type: "damage_instant", amount: "@shield", radius: "@radius",
            shape: "implode", color: "#2fd47e" } }),
        T("Peso", "+60% de empurrão.", { force: { mul: 1.6 } }),
        T("Alcance", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Ouriço", "Dobra o dano do contra-golpe.", { shield: { mul: 2 } }),
      ]},
      dig: { name: "Toca", tiers: [
        T("Fôlego", "Fechar-se também cura.", null,
          { "effects.5": { type: "heal", amount: "@shield*0.5", atPlayer: true } }),
        T("Torpor", "Quem está por perto fica lento.", null,
          { "effects.6": { type: "slow", factor: 0.5, duration: 3, radius: "@radius" } }),
        T("Cura Funda", "+80% da cura.", { shield: { mul: 1.8 } }),
        T("Pânico", "Quem está por perto foge por 1.5s.", null,
          { "effects.7": { type: "fear", duration: 1.5, radius: "@radius" } }),
        T("Bastião", "Dobra a casca e a cura.", { shield: { mul: 2 } }),
      ]},
    },
  },

  aspectOfTheViper: {
    id: "aspectOfTheViper", cls: "hunter", key: "aspectOfTheViper",
    name: "Aspect of the Viper",
    color: "#12915a", axis: "trapping", axisPoints: 2,
    tags: ["aspect", "poison"],
    desc: "Acima de 90% de vida, parte de todo o dano que você causa volta para você como cura.",
    stats: { dotDps: 74, dotTime: 5, tickInterval: 0.5, radius: 130 },
    trigger: { type: "aspect", aspect: "viper" },
    effects: [
      { type: "damage_over_time", key: "aspectOfTheViper", dps: "@dotDps",
        duration: "@dotTime", tickInterval: "@tickInterval", radius: "@radius",
        look: "rot", color: "#12915a" },
    ],
    paths: {
      venom: { name: "Peçonha", tiers: [
        T("Concentrada", "+50% do dano do veneno.", { dotDps: { mul: 1.5 } }),
        T("Persiste", "O veneno dura +3s.", { dotTime: { add: 3 } }),
        T("Corrosiva", "Dobra o dano do veneno.", { dotDps: { mul: 2 } }),
        T("Tica Rápido", "O veneno tica 40% mais rápido.", { tickInterval: { mul: 0.6 } }),
        T("Letal", "Triplica o dano do veneno.", { dotDps: { mul: 3 } }),
      ]},
      coil: { name: "Bote", tiers: [
        T("Alcance", "+40% de raio.", { radius: { mul: 1.4 } }),
        T("Espalha", "O veneno salta para um vizinho.", null,
          { "effects.2": { type: "chain", range: 170, falloff: 1,
            effects: [{ type: "damage_over_time", key: "aspectOfTheViper",
              dps: "@dotDps", duration: "@dotTime", tickInterval: "@tickInterval",
              look: "rot", color: "#12915a" }] } }),
        T("Mais Amplo", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Praga", "Quem morre envenenado espalha o veneno.", null,
          { "effects.3": { type: "spread_on_death", radius: 140, maxTargets: 4 } }),
        T("Ninhada", "Dobra o raio.", { radius: { mul: 2 } }),
      ]},
      drain: { name: "Dreno", tiers: [
        T("Fraqueza", "O veneno enfraquece quem pega.", null,
          { "effects.4": { type: "weaken", factor: 0.6, duration: "@dotTime",
            radius: "@radius" } }),
        T("Torpor", "O veneno também deixa lento.", null,
          { "effects.5": { type: "slow", factor: 0.55, duration: "@dotTime",
            radius: "@radius" } }),
        T("Necrose", "+70% do dano do veneno.", { dotDps: { mul: 1.7 } }),
        T("Detona", "O veneno estoura quando vence.", null,
          { "effects.0.onExpire.0": { type: "damage_instant", amount: "@dotDps*3",
            radius: "@radius", big: true, shape: "implode", color: "#2fd47e" } }),
        T("Serpente", "Dobra o dano do veneno.", { dotDps: { mul: 2 } }),
      ]},
    },
  },

  aspectOfTheEagle: {
    id: "aspectOfTheEagle", cls: "hunter", key: "aspectOfTheEagle",
    name: "Aspect of the Eagle",
    color: "#6ea6f5", axis: "precision", axisPoints: 2,
    tags: ["aspect", "range"],
    desc: "Com cinco ou mais inimigos por perto, todas as suas peças passam a alcançar muito mais longe.",
    stats: { interval: 2.4, damage: 128, radius: 200, count: 3, jitter: 170 },
    trigger: { type: "aspect", aspect: "eagle" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius",
        shape: "nova", color: "#6ea6f5" },
    ],
    paths: {
      sight: { name: "Vista", tiers: [
        T("Longe", "+40% de raio do pulso.", { radius: { mul: 1.4 } }),
        T("Alto", "+50% de dano.", { damage: { mul: 1.5 } }),
        T("Horizonte", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Peso", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Águia", "Dobra o raio.", { radius: { mul: 2 } }),
      ]},
      dive: { name: "Mergulho", tiers: [
        T("Chuva", "O pulso vira uma chuva de quedas.", null,
          { "effects.2": { type: "damage_instant", amount: "@damage*0.7",
            radius: "@radius*0.4", count: "@count", jitter: "@jitter", tell: 0.16,
            shape: "rip", color: "#6ea6f5" } }),
        T("Densa", "Mais três quedas.", { count: { add: 3 } }),
        T("Larga", "+40% de dispersão.", { jitter: { mul: 1.4 } }),
        T("Torrente", "Mais cinco quedas.", { count: { add: 5 } }),
        T("Dilúvio", "Mais oito quedas.", { count: { add: 8 } }),
      ]},
      mark: { name: "Presa", tiers: [
        T("Marca", "O pulso marca quem pega por 4s.", null,
          { "effects.4": { type: "mark", amp: 0.3, duration: 4, radius: "@radius" } }),
        T("Trava", "O pulso também deixa lento.", null,
          { "effects.5": { type: "slow", factor: 0.6, duration: 3, radius: "@radius" } }),
        T("Fundo", "+70% de dano.", { damage: { mul: 1.7 } }),
        T("Enfraquece", "Quem é marcado bate muito menos.", null,
          { "effects.6": { type: "weaken", factor: 0.55, duration: 4, radius: "@radius" } }),
        T("Sentença", "A marca fica muito mais forte.", null,
          { "effects.4": { type: "mark", amp: 0.9, duration: 6, radius: "@radius" } }),
      ]},
    },
  },

  aspectOfTheWild: {
    id: "aspectOfTheWild", cls: "hunter", key: "aspectOfTheWild",
    name: "Aspect of the Wild",
    color: "#f5d45c", axis: "pack", axisPoints: 2,
    tags: ["aspect", "beast"],
    requires: { tag: "beast" },
    desc: "Com três ou mais bichos vivos, a matilha inteira fica mais rápida e bate mais forte.",
    stats: { count: 2, interval: 9, damage: 118, duration: 12, attackInterval: 0.85 },
    trigger: { type: "aspect", aspect: "wild" },
    effects: [
      { type: "summon", kind: "wolf", ai: "flank", count: "@count", cap: 6,
        damage: "@damage", duration: "@duration", attackInterval: "@attackInterval" },
    ],
    paths: {
      call: { name: "Chamado", tiers: [
        T("Mais Um", "Mais um lobo por chamado.", { count: { add: 1 } }),
        T("Demoram", "Os lobos duram +6s.", { duration: { add: 6 } }),
        T("Mais Dois", "Mais dois lobos por chamado.", { count: { add: 2 } }),
        T("Fôlego", "Os lobos duram +10s.", { duration: { add: 10 } }),
        T("Alcateia", "Mais três lobos por chamado.", { count: { add: 3 } }),
      ]},
      fang: { name: "Presa", tiers: [
        T("Mordida", "+50% de dano dos lobos.", { damage: { mul: 1.5 } }),
        T("Cadência", "Mordem 25% mais rápido.", { attackInterval: { mul: 0.75 } }),
        T("Talho", "Dobra o dano dos lobos.", { damage: { mul: 2 } }),
        T("Sangra", "A mordida faz sangrar.", null,
          { "effects.0.onHit.1": { type: "damage_over_time", key: "aspectOfTheWild",
            dps: "@damage*0.3", duration: 4, tickInterval: 0.5, look: "rot",
            color: "#9c7a12" } }),
        T("Frenesi", "Triplica o dano dos lobos.", { damage: { mul: 3 } }),
      ]},
      wild: { name: "Selvageria", tiers: [
        T("Investida", "A mordida abre em área.", null,
          { "effects.0.onHit.0": { type: "damage_instant", amount: "@damage*0.6",
            radius: 78 } }),
        T("Larga", "+60% do raio da investida.", null,
          { "effects.0.onHit.0.radius": 125 }),
        T("Recuo", "A mordida empurra.", null,
          { "effects.0.onHit.2": { type: "knockback", force: 80, radius: 90 } }),
        T("Ursos", "Um urso vem junto do chamado.", null,
          { "effects.2": { type: "summon", kind: "bear", ai: "anchor", count: 1, cap: 2,
            damage: "@damage*1.5", duration: "@duration", attackInterval: 1.1 } }),
        T("Fúria", "Dobra o dano dos lobos.", { damage: { mul: 2 } }),
      ]},
    },
  },

});
