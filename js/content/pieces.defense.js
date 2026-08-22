"use strict";
/* =========================================================================
   DEFENSIVAS — todas automaticas, como o resto. Custam 1 ponto de eixo em vez
   de 2: sao utilidade, nao identidade, e nao deveriam consumir a build.
   ========================================================================= */

Object.assign(PIECES, {

  drainLife: {
    id: "drainLife", key: "drainLife", name: "Drain Life",
    icon: "⚕", color: "#c850ff", axis: "corruption", axisPoints: 1,
    tags: ["shadow", "heal", "aura"], vfx: "blood",
    desc: "Suga vida de quem está perto e devolve para você. Cura que não pede botão.",
    stats: { interval: 0.5, radius: 165, damage: 12, heal: 0.25 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius",
        onHit: [{ type: "heal", frac: "@heal" }] },
    ],
    paths: {
      rot: { name: "Dreno", tiers: [
        T("Sorvo", "+50% de dano.", { damage: { mul: 1.5 } }),
        T("Cadência", "Pulsa 30% mais rápido.", { interval: { mul: 0.7 } }),
        T("Sanguessuga", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Voracidade", "Pulsa 40% mais rápido.", { interval: { mul: 0.6 } }),
        T("Hemorragia", "O dreno também aplica um DoT.", null,
          { "effects.0.onHit.1": { type: "damage_over_time", key: "drain",
            dps: "@damage*0.5", duration: 5, tickInterval: 0.6, color: "#c850ff" } }),
      ]},
      reach: { name: "Alcance", tiers: [
        T("Expansão", "+30% de raio.", { radius: { mul: 1.3 } }),
        T("Amplitude", "+30% de raio.", { radius: { mul: 1.3 } }),
        T("Maré", "+40% de raio.", { radius: { mul: 1.4 } }),
        T("Sopro", "O pulso também empurra a horda.", null,
          { "effects.1": { type: "knockback", force: 26, radius: "@radius" } }),
        T("Horizonte", "Dobra o raio.", { radius: { mul: 2 } }),
      ]},
      leech: { name: "Aura", evolvesInto: "soulRot", tiers: [
        T("Vampirismo", "+60% de cura.", { heal: { mul: 1.6 } }),
        T("Casca", "Converte 12% do dano em escudo.", null,
          { "effects.0.onHit.2": { type: "shield", frac: 0.12, cap: 150 } }),
        T("Banquete", "Dobra a cura.", { heal: { mul: 2 } }),
        T("Muralha", "Escudo maior, teto de 300.", null,
          { "effects.0.onHit.2.frac": 0.24, "effects.0.onHit.2.cap": 300 }),
        T("Soul Rot", "EVOLUÇÃO — a aura vira podridão que drena tudo por perto."),
      ]},
    },
  },

  soulLeech: {
    id: "soulLeech", key: "soulLeech", name: "Soul Leech",
    icon: "🩸", color: "#ff6b6b", axis: "cataclysm", axisPoints: 1,
    tags: ["shield", "reactive"],
    desc: "Todo dano que você causa vira casca. Quanto mais agressiva a build, mais grossa a armadura.",
    stats: { frac: 0.06, cap: 180, cooldown: 0.1 },
    trigger: { type: "reactive", event: "enemy_hit", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "shield", frac: "@frac", cap: "@cap" },
    ],
    paths: {
      absorb: { name: "Absorção", tiers: [
        T("Casca", "+70% de conversão.", { frac: { mul: 1.7 } }),
        T("Reserva", "+60% de teto de escudo.", { cap: { mul: 1.6 } }),
        T("Couraça", "Dobra a conversão.", { frac: { mul: 2 } }),
        T("Bastião", "Dobra o teto.", { cap: { mul: 2 } }),
        T("Casulo", "Triplica a conversão.", { frac: { mul: 3 } }),
      ]},
      mend: { name: "Restauro", tiers: [
        T("Regeneração", "Também cura 2% do dano.", null,
          { "effects.1": { type: "heal", frac: 0.02 } }),
        T("Vitalidade", "A cura sobe para 4%.", null, { "effects.1.frac": 0.04 }),
        T("Fôlego", "A cura sobe para 7%.", null, { "effects.1.frac": 0.07 }),
        T("Constituição", "+50% de teto de escudo.", { cap: { mul: 1.5 } }),
        T("Imortalidade", "A cura sobe para 12%.", null, { "effects.1.frac": 0.12 }),
      ]},
      lash: { name: "Ricochete", tiers: [
        T("Espinhos", "O escudo devolve dano em área a cada acerto.", null,
          { "effects.2": { type: "damage_instant", amount: 8, radius: 90 } }),
        T("Ferrão", "+80% do dano devolvido.", null, { "effects.2.amount": 15 }),
        T("Represália", "+50% de raio.", null, { "effects.2.radius": 135 }),
        T("Retribuição", "O dano devolvido triplica.", null, { "effects.2.amount": 45 }),
        T("Carapaça de Espinhos", "O ricochete também atordoa por 0.3s.", null,
          { "effects.3": { type: "stun", duration: 0.3, radius: 135 } }),
      ]},
    },
  },

  unendingResolve: {
    id: "unendingResolve", key: "unendingResolve", name: "Unending Resolve",
    icon: "🛡", color: "#b0b0c0", axis: "dominion", axisPoints: 1,
    tags: ["shield", "reactive"],
    desc: "Quando a vida cai, a casca sobe. Um seguro que dispara sozinho.",
    stats: { threshold: 0.35, shield: 90, cap: 260, cooldown: 8, heal: 0 },
    trigger: { type: "reactive", event: "player_damaged", condition: "player_below",
               pct: "@threshold", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "shield", amount: "@shield", cap: "@cap" },
      { type: "knockback", force: 140, radius: 200 },
    ],
    paths: {
      resolve: { name: "Resolução", tiers: [
        T("Casca", "+60% de escudo.", { shield: { mul: 1.6 } }),
        T("Recarga", "Recarrega 30% mais rápido.", { cooldown: { mul: 0.7 } }),
        T("Bastião", "Dobra o escudo.", { shield: { mul: 2 } }),
        T("Reserva", "+80% de teto.", { cap: { mul: 1.8 } }),
        T("Inquebrável", "Triplica o escudo.", { shield: { mul: 3 } }),
      ]},
      trigger: { name: "Gatilho", tiers: [
        T("Alerta", "Dispara já abaixo de 50% de vida.", { threshold: { set: 0.5 } }),
        T("Reflexo", "Recarrega 35% mais rápido.", { cooldown: { mul: 0.65 } }),
        T("Prontidão", "Dispara já abaixo de 65% de vida.", { threshold: { set: 0.65 } }),
        T("Cura", "Também cura 25% da vida máxima.", null,
          { "effects.2": { type: "hook", name: "healthstone", threshold: 1, frac: 0.25 } }),
        T("Segunda Chance", "Recarrega em um terço do tempo.", { cooldown: { mul: 0.35 } }),
      ]},
      retort: { name: "Revide", tiers: [
        T("Repulsa", "O gatilho também atordoa em volta.", null,
          { "effects.3": { type: "stun", duration: 1.2, radius: 220 } }),
        T("Explosão", "O gatilho causa dano em área.", null,
          { "effects.4": { type: "damage_instant", amount: 120, radius: 220, big: true } }),
        T("Onda", "+70% do dano do revide.", null, { "effects.4.amount": 210 }),
        T("Terror", "O gatilho também amedronta por 2s.", null,
          { "effects.5": { type: "fear", duration: 2, radius: 260 } }),
        T("Última Palavra", "O revide triplica de dano e raio.", null,
          { "effects.4.amount": 620, "effects.4.radius": 340 }),
      ]},
    },
  },

  demonSkin: {
    id: "demonSkin", key: "demonSkin", name: "Demon Skin",
    icon: "🦎", color: "#8a7f6a", axis: "dominion", axisPoints: 1,
    tags: ["shield", "aura", "summon"],
    desc: "Sua pele endurece a cada demônio vivo. Quanto maior o exército, mais grossa a casca.",
    stats: { interval: 1, shield: 12, cap: 200 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "shield", amount: "@shield", cap: "@cap" },
    ],
    paths: {
      hide: { name: "Couro", tiers: [
        T("Escamas", "+70% de escudo por pulso.", { shield: { mul: 1.7 } }),
        T("Cadência", "Pulsa 30% mais rápido.", { interval: { mul: 0.7 } }),
        T("Quitina", "Dobra o escudo por pulso.", { shield: { mul: 2 } }),
        T("Reserva", "+80% de teto.", { cap: { mul: 1.8 } }),
        T("Placa Demoníaca", "Triplica o escudo por pulso.", { shield: { mul: 3 } }),
      ]},
      regen: { name: "Regeneração", tiers: [
        T("Fôlego", "Também cura 3 por pulso.", null,
          { "effects.1": { type: "heal", amount: 3 } }),
        T("Vitalidade", "A cura sobe para 7.", null, { "effects.1.amount": 7 }),
        T("Vigor", "A cura sobe para 14.", null, { "effects.1.amount": 14 }),
        T("Constância", "Pulsa 35% mais rápido.", { interval: { mul: 0.65 } }),
        T("Renovação", "A cura sobe para 30.", null, { "effects.1.amount": 30 }),
      ]},
      thorns: { name: "Espinhos", tiers: [
        T("Ferrão", "Cada pulso fere quem está colado.", null,
          { "effects.2": { type: "damage_instant", amount: 14, radius: 70 } }),
        T("Lâminas", "+80% do dano dos espinhos.", null, { "effects.2.amount": 26 }),
        T("Alcance", "+60% de raio.", null, { "effects.2.radius": 115 }),
        T("Repulsa", "Os espinhos também empurram.", null,
          { "effects.3": { type: "knockback", force: 40, radius: 115 } }),
        T("Fortaleza", "O dano dos espinhos triplica.", null, { "effects.2.amount": 80 }),
      ]},
    },
  },

  healthstone: {
    id: "healthstone", key: "healthstone", name: "Healthstone",
    icon: "💎", color: "#ff5a5f", axis: "cataclysm", axisPoints: 1,
    tags: ["heal", "reactive"],
    desc: "Uma pedra que se parte sozinha quando a coisa aperta. Você nem percebe.",
    stats: { threshold: 0.3, frac: 0.35, cooldown: 14 },
    trigger: { type: "reactive", event: "player_damaged", condition: "player_below",
               pct: "@threshold", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "hook", name: "healthstone", threshold: "@threshold", frac: "@frac" },
    ],
    paths: {
      potency: { name: "Potência", tiers: [
        T("Fragmento", "+50% de cura.", { frac: { mul: 1.5 } }),
        T("Cristal", "+50% de cura.", { frac: { mul: 1.5 } }),
        T("Gema", "Dobra a cura.", { frac: { mul: 2 } }),
        T("Núcleo", "Dispara já abaixo de 45% de vida.", { threshold: { set: 0.45 } }),
        T("Coração de Pedra", "Cura completa.", { frac: { set: 1 } }),
      ]},
      charges: { name: "Cargas", tiers: [
        T("Reserva", "Recarrega 30% mais rápido.", { cooldown: { mul: 0.7 } }),
        T("Bolso Fundo", "Recarrega 30% mais rápido.", { cooldown: { mul: 0.7 } }),
        T("Estoque", "Recarrega 40% mais rápido.", { cooldown: { mul: 0.6 } }),
        T("Reposição", "Recarrega em 4s.", { cooldown: { set: 4 } }),
        T("Inesgotável", "Recarrega em 2s.", { cooldown: { set: 2 } }),
      ]},
      ward: { name: "Anteparo", tiers: [
        T("Casca", "Também dá 60 de escudo.", null,
          { "effects.1": { type: "shield", amount: 60, cap: 240 } }),
        T("Reforço", "O escudo sobe para 120.", null, { "effects.1.amount": 120 }),
        T("Repulsa", "Também empurra tudo em volta.", null,
          { "effects.2": { type: "knockback", force: 150, radius: 220 } }),
        T("Pausa", "Também atordoa por 1.5s.", null,
          { "effects.3": { type: "stun", duration: 1.5, radius: 240 } }),
        T("Alma de Pedra", "O escudo sobe para 300, teto de 500.", null,
          { "effects.1.amount": 300, "effects.1.cap": 500 }),
      ]},
    },
  },

  netherWard: {
    id: "netherWard", key: "netherWard", name: "Nether Ward",
    icon: "🔰", color: "#5acfff", axis: "dominion", axisPoints: 1,
    tags: ["shield", "aura"],
    desc: "Um pulso que desmancha projéteis inimigos antes que eles cheguem em você.",
    stats: { interval: 1.4, radius: 150, shield: 10 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "reflect", radius: "@radius" },
      { type: "shield", amount: "@shield", cap: 140 },
    ],
    paths: {
      ward: { name: "Barreira", tiers: [
        T("Amplitude", "+35% de raio.", { radius: { mul: 1.35 } }),
        T("Cadência", "Pulsa 30% mais rápido.", { interval: { mul: 0.7 } }),
        T("Domo", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Constância", "Pulsa 40% mais rápido.", { interval: { mul: 0.6 } }),
        T("Cúpula", "Dobra o raio.", { radius: { mul: 2 } }),
      ]},
      recoil: { name: "Reflexo", tiers: [
        T("Devolução", "Os projéteis desmanchados causam dano em volta.", null,
          { "effects.0.damage": 30 }),
        T("Ricochete", "+80% do dano devolvido.", null, { "effects.0.damage": 55 }),
        T("Fragmentação", "O dano devolvido pega num raio de 80.", null,
          { "effects.0.blastRadius": 80 }),
        T("Estilhaço", "+70% do dano devolvido.", null, { "effects.0.damage": 95 }),
        T("Espelho", "O dano devolvido triplica.", null, { "effects.0.damage": 280 }),
      ]},
      aegis: { name: "Égide", tiers: [
        T("Casca", "+80% de escudo por pulso.", { shield: { mul: 1.8 } }),
        T("Reserva", "Teto de escudo de 300.", null, { "effects.1.cap": 300 }),
        T("Repulsa", "O pulso empurra a horda.", null,
          { "effects.2": { type: "knockback", force: 50, radius: "@radius" } }),
        T("Lentidão", "O pulso também deixa lento por 2s.", null,
          { "effects.3": { type: "slow", factor: 0.6, duration: 2, radius: "@radius" } }),
        T("Muralha do Vazio", "Triplica o escudo, teto de 520.",
          { shield: { mul: 3 } }, { "effects.1.cap": 520 }),
      ]},
    },
  },

  soulstone: {
    id: "soulstone", key: "soulstone", name: "Soulstone",
    icon: "🔮", color: "#c850ff", axis: "corruption", axisPoints: 1,
    tags: ["heal", "revive"],
    desc: "Uma alma guardada. Quando você cair, ela levanta você de volta.",
    stats: { interval: 45, revives: 1 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "hook", name: "soulstone", max: "@revives" },
    ],
    paths: {
      soul: { name: "Alma", tiers: [
        T("Reposição", "Repõe a carga 30% mais rápido.", { interval: { mul: 0.7 } }),
        T("Duas Almas", "Guarda até 2 cargas.", { revives: { set: 2 } }),
        T("Reposição Rápida", "Repõe a carga 40% mais rápido.", { interval: { mul: 0.6 } }),
        T("Três Almas", "Guarda até 3 cargas.", { revives: { set: 3 } }),
        T("Reencarnação", "Guarda 5 cargas e repõe a cada 12s.",
          { revives: { set: 5 }, interval: { set: 12 } }),
      ]},
      ward: { name: "Guarda", tiers: [
        T("Casca", "Cada reposição dá 50 de escudo.", null,
          { "effects.1": { type: "shield", amount: 50, cap: 250 } }),
        T("Reforço", "O escudo sobe para 100.", null, { "effects.1.amount": 100 }),
        T("Vitalidade", "Cada reposição cura 20.", null,
          { "effects.2": { type: "heal", amount: 20 } }),
        T("Vigor", "A cura sobe para 45.", null, { "effects.2.amount": 45 }),
        T("Âncora Vital", "O escudo sobe para 220, teto de 460.", null,
          { "effects.1.amount": 220, "effects.1.cap": 460 }),
      ]},
      pact: { name: "Pacto", tiers: [
        T("Sentinela", "Cada reposição invoca um guarda temporário.", null,
          { "effects.3": { type: "summon", kind: "imp", ai: "chase", count: 2,
                           cap: 12, duration: 20, damage: 20 } }),
        T("Coorte", "Invoca 4 servos.", null, { "effects.3.count": 4 }),
        T("Vigília", "Os servos duram 40s.", null, { "effects.3.duration": 40 }),
        T("Guarda Pessoal", "Invoca caçadores em vez de imps.", null,
          { "effects.3.kind": "dreadstalker", "effects.3.damage": 40 }),
        T("Legião de Almas", "Invoca 6 caçadores permanentes.", null,
          { "effects.3.count": 6, "effects.3.permanent": true }),
      ]},
    },
  },

});
