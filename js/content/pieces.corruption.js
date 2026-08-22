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
    desc: "Apodrece o alvo mais próximo. Dano que não pede mira nem posição.",
    stats: {
      cooldown: 1.2, range: 440, targets: 1,
      dps: 14, duration: 6, tickInterval: 0.5, radius: 0,
    },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_over_time", key: "corruption", dps: "@dps", duration: "@duration",
        tickInterval: "@tickInterval", color: "#7fdc4a", radius: "@radius",
        stacking: { mode: "refresh", max: 1 } },
    ],
    paths: {
      virulence: { name: "Virulência", tiers: [
        T("Podridão", "+45% de dano por tick.", { dps: { mul: 1.45 } }),
        T("Necrose", "Tica 35% mais rápido.", { tickInterval: { mul: 0.65 } }),
        T("Gangrena", "+60% de dano e +2s de duração.", { dps: { mul: 1.6 }, duration: { add: 2 } }),
        T("Peste Negra", "Dobra o dano por tick.", { dps: { mul: 2 } }),
        T("Aniquilação", "Ao expirar, detona por 5x um tick em área.", null,
          { "effects.0.onExpire.0": { type: "damage_instant", amount: "@dps*5", radius: 95, big: true } }),
      ]},
      trail: { name: "Rastro", evolvesInto: "vileTaint", tiers: [
        T("Pegada Suja", "Aplica também em quem estiver colado em você.",
          { radius: { set: 70 } }, { "effects.0.atTarget": false }),
        T("Miasma", "+30% de raio de aplicação.", { radius: { mul: 1.3 } }),
        T("Esporos", "Cada aplicação deixa uma poça breve no seu rastro.", null,
          { "effects.1": { type: "area_persistent", radius: "@radius/2", dps: "@dps*0.5",
                           duration: 2.5, tickInterval: 0.4, color: "#7fdc4a" } }),
        T("Trilha Pútrida", "Dobra o raio e a duração da poça.",
          { radius: { mul: 1.6 } }, { "effects.1.duration": 5 }),
        T("Vile Taint", "EVOLUÇÃO — vira um rastro de veneno contínuo sob seus pés."),
      ]},
      contagion: { name: "Contágio", tiers: [
        T("Duas Bocas", "Aplica em 2 alvos por conjuração.", { targets: { set: 2 } }),
        T("Persistência", "+3s de duração.", { duration: { add: 3 } }),
        T("Semeadura", "Ao expirar, salta para o inimigo mais próximo.", null,
          { "effects.0.onExpire.1": { type: "chain", range: 150, falloff: 1, effects: [
            { type: "damage_over_time", key: "corruption", dps: "@dps", duration: "@duration*0.6",
              tickInterval: "@tickInterval", color: "#7fdc4a" }] } }),
        T("Pandemia", "Aplica em 4 alvos por conjuração.", { targets: { set: 4 } }),
        T("Praga Universal", "Ao expirar, espalha para TODOS os vizinhos.", null,
          { "effects.0.onExpire.1": { type: "spread_on_death", radius: 170, full: false, maxTargets: 8 } }),
      ]},
    },
  },

  agony: {
    id: "agony", key: "agony", name: "Agony",
    color: "#4a9e2e", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "dot"], vfx: "sigil",
    desc: "Dor que cresce. Quanto mais tempo o alvo vive, mais caro fica.",
    stats: {
      cooldown: 2.4, range: 400, targets: 1,
      dps: 9, duration: 12, tickInterval: 0.7, ramp: 0.34, stacks: 3, radius: 0,
    },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_over_time", key: "agony", dps: "@dps", duration: "@duration",
        tickInterval: "@tickInterval", ramp: "@ramp", color: "#4a9e2e", radius: "@radius",
        stacking: { mode: "stack", max: "@stacks" } },
    ],
    paths: {
      torment: { name: "Tormento", tiers: [
        T("Agonia", "O dano cresce 60% mais rápido.", { ramp: { mul: 1.6 } }),
        T("Suplício", "+50% de dano base.", { dps: { mul: 1.5 } }),
        T("Martírio", "O dano cresce ao dobro da velocidade.", { ramp: { mul: 2 } }),
        T("Desespero", "Tica 40% mais rápido.", { tickInterval: { mul: 0.6 } }),
        T("Infinita", "A dor nunca para de crescer — a duração vira permanente.",
          { duration: { mul: 4 } }, { "effects.0.permanent": true }),
      ]},
      accrual: { name: "Acúmulo", tiers: [
        T("Camadas", "Empilha até 5 vezes.", { stacks: { set: 5 } }),
        T("Sedimento", "+6s de duração.", { duration: { add: 6 } }),
        T("Sobrecarga", "Empilha até 8 vezes.", { stacks: { set: 8 } }),
        T("Colapso", "Conjura 60% mais rápido.", { cooldown: { mul: 0.6 } }),
        T("Ruína", "Ao expirar, causa dano igual a 8 ticks acumulados.", null,
          { "effects.0.onExpire": [{ type: "damage_instant", amount: "@dps*8", radius: 80, big: true }] }),
      ]},
      reach: { name: "Alcance", tiers: [
        T("Dois Alvos", "Aplica em 2 alvos.", { targets: { set: 2 } }),
        T("Longo Braço", "+35% de alcance.", { range: { mul: 1.35 } }),
        T("Quatro Alvos", "Aplica em 4 alvos.", { targets: { set: 4 } }),
        T("Área", "Cada aplicação pega todos num raio de 90.", { radius: { set: 90 } }),
        T("Toda a Tela", "Aplica em todos os inimigos ao redor.",
          { radius: { set: 420 }, targets: { set: 1 } }),
      ]},
    },
  },

  unstableAffliction: {
    id: "unstableAffliction", key: "unstableAffliction", name: "Unstable Affliction",
    color: "#a8f05c", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "dot"],
    desc: "Magia instável: o dano de verdade vem quando ela termina.",
    stats: {
      cooldown: 3.2, range: 380, targets: 1,
      dps: 10, duration: 5, tickInterval: 1, blast: 70, blastRadius: 90,
      radius: 0, stacks: 1,
    },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_over_time", key: "unstableAffliction", dps: "@dps", duration: "@duration",
        tickInterval: "@tickInterval", color: "#a8f05c", radius: "@radius",
        stacking: { mode: "refresh", max: 1 },
        onExpire: [{ type: "damage_instant", amount: "@blast", radius: "@blastRadius", big: true }] },
    ],
    paths: {
      instability: { name: "Instabilidade", tiers: [
        T("Fissura", "+60% no dano da explosão.", { blast: { mul: 1.6 } }),
        T("Rachadura", "+40% no raio da explosão.", { blastRadius: { mul: 1.4 } }),
        T("Detonação", "Dobra o dano da explosão.", { blast: { mul: 2 } }),
        T("Onda de Choque", "A explosão atordoa por 0.8s.", null,
          { "effects.0.onExpire.1": { type: "stun", duration: 0.8, radius: "@blastRadius" } }),
        T("Cataclismo Íntimo", "Triplica a explosão e dobra o raio.",
          { blast: { mul: 3 }, blastRadius: { mul: 2 } }),
      ]},
      buildup: { name: "Acúmulo", tiers: [
        T("Duas Doses", "Empilha até 2 vezes.", { stacks: { set: 2 } },
          { "effects.0.stacking": { mode: "stack", max: "@stacks" } }),
        T("Tique-taque", "Reduz a duração — explode mais cedo.", { duration: { mul: 0.6 } }),
        T("Quatro Doses", "Empilha até 4 vezes.", { stacks: { set: 4 } }),
        T("Pavio Curto", "Conjura 45% mais rápido.", { cooldown: { mul: 0.55 } }),
        T("Reação em Cadeia", "A explosão salta para o vizinho a 60%.", null,
          { "effects.0.onExpire.2": { type: "chain", range: 160, falloff: 0.6, effects: [
            { type: "damage_instant", amount: "@blast*0.6", radius: "@blastRadius*0.7" }] } }),
      ]},
      spread: { name: "Difusão", tiers: [
        T("Dois Alvos", "Aplica em 2 alvos.", { targets: { set: 2 } }),
        T("Contaminação", "+3s de duração.", { duration: { add: 3 } }),
        T("Área", "Aplica em todos num raio de 100.", { radius: { set: 100 } }),
        T("Quatro Alvos", "Aplica em 4 alvos.", { targets: { set: 4 } }),
        T("Epidemia", "A explosão espalha todos os DoTs do alvo.", null,
          { "effects.0.onExpire.3": { type: "spread_on_death", radius: 150, full: true, maxTargets: 5 } }),
      ]},
    },
  },

  seedOfCorruption: {
    id: "seedOfCorruption", key: "seedOfCorruption", name: "Seed of Corruption",
    color: "#7fdc4a", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "reactive"], vfx: "thorn",
    desc: "Todo inimigo apodrecido vira uma bomba. Você só precisa deixá-lo morrer.",
    requires: { tag: "dot" },
    stats: { blast: 55, radius: 110, cooldown: 0.25 },
    trigger: { type: "reactive", event: "enemy_killed", condition: "has_dot",
               cooldown: "@cooldown", needsTarget: true },
    effects: [
      { type: "damage_instant", amount: "@blast", radius: "@radius", big: true },
    ],
    paths: {
      yield: { name: "Colheita", tiers: [
        T("Vagem", "+60% de dano na explosão.", { blast: { mul: 1.6 } }),
        T("Estouro", "+35% de raio.", { radius: { mul: 1.35 } }),
        T("Rebentação", "Dobra o dano.", { blast: { mul: 2 } }),
        T("Safra", "+60% de raio.", { radius: { mul: 1.6 } }),
        T("Ceifa", "Triplica o dano e explode duas vezes.",
          { blast: { mul: 3 } }, { "effects.1": { type: "damage_instant", amount: "@blast*0.5", radius: "@radius*1.5" } }),
      ]},
      sowing: { name: "Semeadura", tiers: [
        T("Germinação", "A explosão espalha os DoTs do morto.", null,
          { "effects.2": { type: "spread_on_death", radius: "@radius", full: false, maxTargets: 4 } }),
        T("Raízes", "+40% de raio de propagação.", { radius: { mul: 1.4 } }),
        T("Duração Cheia", "Os DoTs espalhados vêm com duração cheia.", null,
          { "effects.2.full": true }),
        T("Broto", "Deixa uma poça corrosiva onde o inimigo caiu.", null,
          { "effects.3": { type: "area_persistent", radius: "@radius*0.6", dps: "@blast*0.35",
                           duration: 4, tickInterval: 0.4, color: "#7fdc4a" } }),
        T("Floresta", "Espalha para até 10 vizinhos.", null, { "effects.2.maxTargets": 10 }),
      ]},
      cadence: { name: "Cadência", tiers: [
        T("Gatilho Leve", "Dispara com metade do intervalo mínimo.", { cooldown: { mul: 0.5 } }),
        T("Sem Trava", "Praticamente sem intervalo mínimo.", { cooldown: { set: 0.05 } }),
        T("Qualquer Morte", "Dispara mesmo em inimigos sem DoT.", null,
          { "trigger.condition": null }),
        T("Eco", "Cada explosão atordoa quem sobrevive por 0.5s.", null,
          { "effects.4": { type: "stun", duration: 0.5, radius: "@radius" } }),
        T("Reação Total", "A explosão pode disparar outras explosões.", null,
          { "trigger.cooldown": 0 }),
      ]},
    },
  },

  haunt: {
    id: "haunt", key: "haunt", name: "Haunt",
    color: "#a8f05c", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "summon"],
    desc: "Um olho do Vazio persegue alvos e marca quem ele toca: tudo dói mais neles.",
    stats: { count: 1, respawn: 5, damage: 12, amp: 0.3, markTime: 5, duration: 12, range: 440 },
    trigger: { type: "autonomous", count: "@count", interval: "@respawn" },
    effects: [
      { type: "summon", kind: "darkglare", ai: "turret", count: 1, cap: "@count",
        duration: "@duration", damage: "@damage", range: "@range", attackInterval: 1,
        onHit: [{ type: "mark", amp: "@amp", duration: "@markTime" }] },
    ],
    paths: {
      gaze: { name: "Olhar", tiers: [
        T("Foco", "+60% de amplificação.", { amp: { mul: 1.6 } }),
        T("Fixação", "+4s na marca.", { markTime: { add: 4 } }),
        T("Vigília", "+80% de dano do olho.", { damage: { mul: 1.8 } }),
        T("Escrutínio", "Dobra a amplificação.", { amp: { mul: 2 } }),
        T("Olho do Vazio", "A marca também espalha os DoTs do alvo ao expirar.", null,
          { "effects.0.onHit.3": { type: "spread_on_death", radius: 120, full: false, maxTargets: 3 } }),
      ]},
      swarm: { name: "Enxame", tiers: [
        T("Par", "Dois olhos.", { count: { set: 2 } }),
        T("Vigília Longa", "+8s de duração.", { duration: { add: 8 } }),
        T("Trio", "Três olhos.", { count: { set: 3 } }),
        T("Caçada", "Os olhos passam a perseguir alvos.", null, { "effects.0.ai": "chase" }),
        T("Legião de Olhos", "Cinco olhos, reposição imediata.",
          { count: { set: 5 }, respawn: { set: 1 } }),
      ]},
      wither: { name: "Definhar", tiers: [
        T("Toque Podre", "O olho também aplica um DoT.", null,
          { "effects.0.onHit.1": { type: "damage_over_time", key: "haunt", dps: "@damage*0.4",
                                   duration: 5, tickInterval: 0.6, color: "#a8f05c" } }),
        T("Corrosão", "+70% no DoT do olho.", { damage: { mul: 1.7 } }),
        T("Lentidão", "Alvos marcados ficam 35% mais lentos.", null,
          { "effects.0.onHit.2": { type: "slow", factor: 0.65, duration: "@markTime" } }),
        T("Alcance", "+50% de alcance do olho.", { range: { mul: 1.5 } }),
        T("Definhamento", "Alvos marcados recebem +80% de dano.", { amp: { set: 0.8 } }),
      ]},
    },
  },

  maleficRapture: {
    id: "maleficRapture", key: "maleficRapture", name: "Malefic Rapture",
    color: "#a8f05c", axis: "corruption", axisPoints: 2,
    tags: ["shadow", "rooted"],
    desc: "Fique parado e cobre a conta: pulsa em TODOS que carregam um DoT seu.",
    requires: { tag: "dot" },
    stats: { chargeTime: 1.1, damage: 58, radius: 340 },
    trigger: { type: "rooted", chargeTime: "@chargeTime", range: 0 },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius", onlyDotted: true, big: true },
    ],
    paths: {
      rapture: { name: "Êxtase", tiers: [
        T("Fervor", "+55% de dano.", { damage: { mul: 1.55 } }),
        T("Cadência", "Carrega 30% mais rápido.", { chargeTime: { mul: 0.7 } }),
        T("Arrebatamento", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Convulsão", "Carrega em quase metade do tempo.", { chargeTime: { mul: 0.55 } }),
        T("Rapto", "Triplica o dano; cada pulso é um golpe grande.", { damage: { mul: 3 } }),
      ]},
      reach: { name: "Abrangência", tiers: [
        T("Amplitude", "+35% de raio.", { radius: { mul: 1.35 } }),
        T("Ressonância", "+35% de raio.", { radius: { mul: 1.35 } }),
        T("Domínio", "Pulsa mesmo em quem não tem DoT (metade do dano).", null,
          { "effects.0.onlyDotted": false, "effects.0.mul": 0.5 }),
        T("Onda", "Cada pulso atordoa por 0.4s.", null,
          { "effects.1": { type: "stun", duration: 0.4, radius: "@radius" } }),
        T("Sem Fronteira", "Alcança a tela inteira.", { radius: { mul: 2 } }),
      ]},
      feed: { name: "Sustento", tiers: [
        T("Sanguessuga", "Cura 8% do dano causado.", null,
          { "effects.0.onHit": [{ type: "heal", frac: 0.08 }] }),
        T("Barreira", "Converte 10% do dano em escudo.", null,
          { "effects.0.onHit.1": { type: "shield", frac: 0.1, cap: 120 } }),
        T("Renovação", "Cura 20% do dano.", null, { "effects.0.onHit.0.frac": 0.2 }),
        T("Casca", "Escudo maior e com teto de 260.", null,
          { "effects.0.onHit.1.frac": 0.2, "effects.0.onHit.1.cap": 260 }),
        T("Voracidade", "Cada pulso renova todos os seus DoTs no alvo.", null,
          { "effects.0.onHit.2": { type: "spread_on_death", radius: 90, full: true, maxTargets: 2 } }),
      ]},
    },
  },

  /* --- pecas de evolucao: nao aparecem no sorteio, so por conversao ------- */

  vileTaint: {
    id: "vileTaint", key: "corruption", name: "Vile Taint",
    color: "#a8f05c", axis: "corruption", axisPoints: 0,
    tags: ["shadow", "dot", "trail"], evolutionOnly: true, vfx: "rot",
    desc: "A corrupção sai dos seus pés. Andar vira a arma.",
    stats: { distance: 60, radius: 88, dps: 26, duration: 5, tickInterval: 0.35, dotDps: 12, dotTime: 6 },
    trigger: { type: "trail", distance: "@distance" },
    effects: [
      { type: "area_persistent", radius: "@radius", dps: "@dps", duration: "@duration",
        tickInterval: "@tickInterval", color: "#a8f05c",
        onTick: [{ type: "damage_over_time", key: "corruption", dps: "@dotDps",
                   duration: "@dotTime", tickInterval: 0.6, color: "#a8f05c" }] },
    ],
    paths: {
      virulence: { name: "Virulência", tiers: [
        T("Denso", "+40% de dano da poça.", { dps: { mul: 1.4 } }),
        T("Corrosivo", "+50% no DoT aplicado.", { dotDps: { mul: 1.5 } }),
        T("Letal", "Dobra o dano da poça.", { dps: { mul: 2 } }),
        T("Necrótico", "Dobra o DoT aplicado.", { dotDps: { mul: 2 } }),
        T("Terra Morta", "As poças duram o triplo.", { duration: { mul: 3 } }),
      ]},
      trail: { name: "Rastro", tiers: [
        T("Passo Curto", "Deixa poças com metade da distância.", { distance: { mul: 0.5 } }),
        T("Poça Larga", "+35% de raio.", { radius: { mul: 1.35 } }),
        T("Trilha", "+50% de duração.", { duration: { mul: 1.5 } }),
        T("Lodaçal", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Pântano", "Poças enlameiam: -45% de velocidade em quem pisa.", null,
          { "effects.0.onTick.1": { type: "slow", factor: 0.55, duration: 1.5 } }),
      ]},
      contagion: { name: "Contágio", tiers: [
        T("Vapor", "+30% de raio.", { radius: { mul: 1.3 } }),
        T("Emanação", "+40% de duração.", { duration: { mul: 1.4 } }),
        T("Propagação", "O DoT salta ao expirar.", null,
          { "effects.0.onTick.0.onExpire": [{ type: "spread_on_death", radius: 120, full: false, maxTargets: 3 }] }),
        T("Névoa", "+50% de raio.", { radius: { mul: 1.5 } }),
        T("Maré Podre", "As poças também explodem ao sumir.", null,
          { "effects.0.onEnd": [{ type: "damage_instant", amount: "@dps*3", radius: "@radius*1.3", big: true }] }),
      ]},
    },
  },

  soulRot: {
    id: "soulRot", key: "drainLife", name: "Soul Rot",
    color: "#a8f05c", axis: "corruption", axisPoints: 0,
    tags: ["shadow", "dot", "aura", "heal"], evolutionOnly: true, vfx: "blood",
    desc: "Uma aura que apodrece tudo por perto e devolve a podridão como vida.",
    stats: { interval: 0.4, radius: 190, damage: 16, heal: 0.22, dotDps: 10, dotTime: 5 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "damage_instant", amount: "@damage", radius: "@radius",
        onHit: [
          { type: "heal", frac: "@heal" },
          { type: "damage_over_time", key: "soulRot", dps: "@dotDps", duration: "@dotTime",
            tickInterval: 0.6, color: "#a8f05c" },
        ] },
    ],
    paths: {
      rot: { name: "Podridão", tiers: [
        T("Fétido", "+45% de dano.", { damage: { mul: 1.45 } }),
        T("Séptico", "+60% no DoT.", { dotDps: { mul: 1.6 } }),
        T("Pútrido", "Dobra o dano.", { damage: { mul: 2 } }),
        T("Mortal", "Pulsa 40% mais rápido.", { interval: { mul: 0.6 } }),
        T("Alma Apodrecida", "Triplica o DoT e ele nunca expira.",
          { dotDps: { mul: 3 } }, { "effects.0.onHit.1.permanent": true }),
      ]},
      reach: { name: "Alcance", tiers: [
        T("Expansão", "+30% de raio.", { radius: { mul: 1.3 } }),
        T("Dilatação", "+30% de raio.", { radius: { mul: 1.3 } }),
        T("Maré", "+40% de raio.", { radius: { mul: 1.4 } }),
        T("Sopro", "Empurra os inimigos a cada pulso.", null,
          { "effects.1": { type: "knockback", force: 30, radius: "@radius" } }),
        T("Horizonte", "Dobra o raio.", { radius: { mul: 2 } }),
      ]},
      leech: { name: "Sanguessuga", tiers: [
        T("Sorvo", "+50% de cura.", { heal: { mul: 1.5 } }),
        T("Casca", "Converte 12% do dano em escudo.", null,
          { "effects.0.onHit.2": { type: "shield", frac: 0.12, cap: 160 } }),
        T("Banquete", "Dobra a cura.", { heal: { mul: 2 } }),
        T("Muralha", "Escudo maior, teto de 320.", null,
          { "effects.0.onHit.2.frac": 0.25, "effects.0.onHit.2.cap": 320 }),
        T("Imortal", "Cura em 45% de tudo que a aura causa.", { heal: { set: 0.45 } }),
      ]},
    },
  },

});
