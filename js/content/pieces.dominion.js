"use strict";
/* =========================================================================
   EIXO DOMINIO — demonios, presenca, exercito.
   O dano nao sai de voce, sai do que anda com voce. A build recompensa
   sobreviver: cada segundo vivo e mais um demonio em campo.
   ========================================================================= */

Object.assign(PIECES, {

  wildImps: {
    id: "wildImps", key: "wildImps", name: "Wild Imps",
    color: "#9a4cff", axis: "dominion", axisPoints: 2,
    tags: ["summon", "fire"], vfx: "chain",
    desc: "Mantém um bando de imps vivos perto de você; eles miram e atiram sozinhos no que estiver ao alcance.",
    stats: { ...CRIT_BASE, count: 3, respawn: 2.2, damage: 16, duration: 9,
             range: 280, attackInterval: 0.75, speed: 480 },
    trigger: { type: "autonomous", count: "@count", interval: "@respawn" },
    effects: [
      { type: "summon", kind: "wildImp", ai: "ranged", count: 1, cap: "@count",
        duration: "@duration", damage: "@damage", range: "@range",
        attackInterval: "@attackInterval",
        projectile: { type: "projectile", damage: "@damage", speed: "@speed",
                      radius: 5, life: 1.4, color: "#9a4cff" } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "attackInterval", verb: "Os imps atacam" },
                     qty: { stat: "count", noun: "imps em campo", steps: [5, 8] } },
        T("Legião", "10 imps em campo, reposição imediata.",
          { count: { set: 10 }, respawn: { set: 1 } })),
      mastery: MASTERY({ dmg: "damage", evolvesInto: "demonicTyrant" },
        T("Demonic Tyrant", "EVOLUÇÃO — os imps dão lugar a um Tirano Demoníaco.")),
      crit: CRIT({},
        T("Incineração", "Todo tiro crita e incendeia o alvo.",
          { crit: { set: 1 } },
          { "effects.0.projectile.onHit.0": { type: "damage_over_time", key: "impFire",
            dps: "@damage*0.5", duration: 4, tickInterval: 0.5, color: "#9a4cff" } })),
    },
  },

  dreadstalkers: {
    id: "dreadstalkers", key: "dreadstalkers", name: "Dreadstalkers",
    color: "#9a4cff", axis: "dominion", axisPoints: 2,
    tags: ["summon", "shadow"],
    desc: "Mantém caçadores vivos: eles perseguem inimigos por conta própria e batem corpo a corpo.",
    stats: { ...CRIT_BASE, count: 2, respawn: 5, damage: 52, duration: 14,
             range: 460, attackInterval: 0.85 },
    trigger: { type: "autonomous", count: "@count", interval: "@respawn" },
    effects: [
      { type: "summon", kind: "dreadstalker", ai: "chase", count: 2, cap: "@count",
        duration: "@duration", damage: "@damage", range: "@range",
        attackInterval: "@attackInterval" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "attackInterval", verb: "Mordem" },
                     qty: { stat: "count", noun: "caçadores em campo", steps: [4, 6] } },
        T("Horda", "10 caçadores, reposição imediata.",
          { count: { set: 10 }, respawn: { set: 1 } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Destroçar", "A mordida atinge todos ao redor do alvo.", null,
          { "effects.0.onHit.1": { type: "damage_instant", amount: "@damage*0.6", radius: 70 } })),
      crit: CRIT({},
        T("Execução", "Toda mordida crita e executa alvos abaixo de 25% de vida.",
          { crit: { set: 1 } },
          { "effects.0.onHit.3": { type: "execute", threshold: 0.25, amount: "@damage",
            executeMul: 6 } })),
    },
  },

  felguard: {
    id: "felguard", key: "felguard", name: "Felguard",
    color: "#9a4cff", axis: "dominion", axisPoints: 2,
    tags: ["summon", "fel", "guard"],
    desc: "Mantém um guarda ao seu lado: ele intercepta quem chega perto, e cada golpe dele corta em arco.",
    stats: { ...CRIT_BASE, count: 1, respawn: 6, damage: 88, duration: 20,
             range: 210, attackInterval: 0.8, cleave: 80 },
    trigger: { type: "autonomous", count: "@count", interval: "@respawn" },
    effects: [
      { type: "summon", kind: "felguard", ai: "anchor", count: 1, cap: "@count", big: true,
        duration: "@duration", damage: "@damage", range: "@range",
        attackInterval: "@attackInterval",
        onHit: [{ type: "damage_instant", amount: "@damage*0.6", radius: "@cleave" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "attackInterval", verb: "Golpeia" },
                     qty: { stat: "count", noun: "guardas ao seu lado", steps: [2, 3] } },
        T("Guarda Pretoriana", "5 guardas permanentes.",
          { count: { set: 5 } }, { "effects.0.permanent": true })),
      mastery: MASTERY({ dmg: "damage", evolvesInto: "grimoireOfSacrifice" },
        T("Grimoire of Sacrifice", "EVOLUÇÃO — devora o pet e absorve o poder dele.")),
      crit: CRIT({},
        T("Carnificina", "Todo golpe crita, atordoa por 0.5s e empurra.",
          { crit: { set: 1 } },
          { "effects.0.onHit.3": { type: "stun", duration: 0.5, radius: "@cleave" },
            "effects.0.onHit.4": { type: "knockback", force: 60, radius: "@cleave" } })),
    },
  },

  voidwalker: {
    id: "voidwalker", key: "voidwalker", name: "Voidwalker",
    color: "#6a28c8", axis: "dominion", axisPoints: 2,
    tags: ["summon", "orbital", "guard"],
    desc: "Massas do Vazio orbitam você: puxam a horda para dentro da órbita e causam dano por contato.",
    stats: { ...CRIT_BASE, count: 2, damage: 28, orbitRadius: 88, orbitSpeed: 1.25,
             attackInterval: 0.35, pullForce: 26, pullRadius: 150 },
    trigger: { type: "orbital", count: "@count", respawn: 1.2 },
    effects: [
      { type: "summon", kind: "voidwalker", ai: "orbit", count: 1, cap: "@count", permanent: true,
        damage: "@damage", orbitRadius: "@orbitRadius", orbitSpeed: "@orbitSpeed",
        attackInterval: "@attackInterval" },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "attackInterval", verb: "Colide" },
                     qty: { stat: "count", noun: "massas em órbita", steps: [3, 5] } },
        T("Constelação", "Anel mais largo, girando 60% mais rápido.",
          { orbitRadius: { mul: 1.3 }, orbitSpeed: { mul: 1.6 } })),
      mastery: MASTERY({ dmg: "damage" },
        T("Buraco Negro", "Triplica o dano e cada colisão puxa a horda para dentro.",
          { damage: { mul: 3 } },
          { "effects.0.onHit.2": { type: "pull", force: "@pullForce", radius: "@pullRadius" } })),
      crit: CRIT({},
        T("Singularidade", "Todo contato crita e atinge todos ao redor.",
          { crit: { set: 1 } },
          { "effects.0.onHit.0": { type: "damage_instant", amount: "@damage*0.7", radius: 60 } })),
    },
  },

  doom: {
    id: "doom", key: "doom", name: "Doom",
    color: "#c07aff", axis: "dominion", axisPoints: 2,
    tags: ["shadow", "dot", "summon"],
    desc: "Mira sozinha e aplica uma sentença: enquanto ela corre o dano é baixo, e ao vencer nasce um demônio de dentro do alvo.",
    stats: { ...CRIT_BASE, cooldown: 4, range: 420, targets: 1, dps: 18, duration: 8,
             tickInterval: 1, impDamage: 40, impDuration: 10, impCount: 1, radius: 0 },
    trigger: { type: "auto_target", cooldown: "@cooldown", range: "@range", targets: "@targets" },
    effects: [
      { type: "damage_over_time", key: "doom", dps: "@dps", duration: "@duration",
        look: "doom",   // sentenca: o orbe FECHA para dentro conforme o prazo acaba
        tickInterval: "@tickInterval", color: "#c07aff",
        stacking: { mode: "refresh", max: 1 },
        onExpire: [{ type: "summon", kind: "imp", ai: "chase", count: "@impCount",
                     duration: "@impDuration", damage: "@impDamage", cap: 20 }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Sentencia" },
                     qty: { stat: "impCount", noun: "demônios nascidos por sentença", steps: [2, 4] } },
        T("Berçário", "Nascem 6 caçadores em vez de imps.",
          { impCount: { set: 6 } }, { "effects.0.onExpire.0.kind": "dreadstalker" })),
      mastery: MASTERY({ dmg: ["dps", "impDamage"] },
        T("Fim Inevitável", "Ao vencer, a sentença também explode em área.", null,
          { "effects.0.onExpire.1": { type: "damage_instant", amount: "@dps*10",
                                      radius: 110, big: true } })),
      crit: CRIT({},
        T("Praga do Fim", "Todo tique crita, e a sentença pega todos num raio de 160.",
          { crit: { set: 1 }, radius: { set: 160 } }, { "effects.0.radius": "@radius" })),
    },
  },

  implosion: {
    id: "implosion", key: "implosion", name: "Implosion",
    color: "#c07aff", axis: "dominion", axisPoints: 2,
    tags: ["summon", "fel", "reactive"],
    desc: "Quando você toma dano, seus demônios implodem em área em volta de você e devolvem escudo. Pede invocação na build.",
    requires: { tag: "summon" },
    stats: { ...CRIT_BASE, blast: 120, radius: 170, cooldown: 1.4, shield: 20 },
    trigger: { type: "reactive", event: "player_damaged", cooldown: "@cooldown", atPlayer: true },
    effects: [
      { type: "damage_instant", amount: "@blast", radius: "@radius", big: true,
        // o imp detona para DENTRO: o clarao chega depois do colapso
        shape: "implode" },
      { type: "shield", amount: "@shield", cap: 150,
        // anteparo improvisado do que sobrou do imp: tres faces, sem acabamento
        veil: { sides: 3, spin: 0.65, thick: 2.2 } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "cooldown", verb: "Implode" } },
        T("Exército de Réplica", "Cada gatilho invoca 8 imps.", null,
          { "effects.2": { type: "summon", kind: "wildImp", ai: "ranged", count: 8,
                           duration: 12, damage: "@blast*0.25", cap: 24 } })),
      mastery: MASTERY({ dmg: ["blast", "shield"], noun: "dano e escudo" },
        T("Aniquilação", "Triplica o dano e dobra o raio.",
          { blast: { mul: 3 }, radius: { mul: 2 } })),
      crit: CRIT({ noun: "dano" },
        T("Baluarte", "Toda implosão crita, atordoa por 0.6s e empurra.",
          { crit: { set: 1 } },
          { "effects.4": { type: "stun", duration: 0.6, radius: "@radius" },
            "effects.5": { type: "knockback", force: 90, radius: "@radius" } })),
    },
  },

  netherPortal: {
    id: "netherPortal", key: "netherPortal", name: "Nether Portal",
    color: "#c07aff", axis: "dominion", axisPoints: 3,
    tags: ["summon", "aura"],
    desc: "A cada poucos segundos abre um portal onde você está: ele fica plantado cuspindo imps enquanto durar.",
    stats: { ...CRIT_BASE, interval: 9, duration: 14, damage: 44, spawnEvery: 2.4,
             portalRange: 360, brood: 1 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "summon", kind: "portal", ai: "turret", count: 1, cap: 3, big: true,
        duration: "@duration", damage: "@damage", range: "@portalRange",
        attackInterval: "@spawnEvery",
        onHit: [{ type: "summon", kind: "wildImp", ai: "ranged", count: "@brood", cap: 24,
                  duration: 8, damage: "@damage*0.4" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "spawnEvery", verb: "Cospe demônios" },
                     qty: { stat: "brood", noun: "demônios por vez", steps: [2, 4] } },
        T("Portal Permanente", "O portal nunca fecha.", null,
          { "effects.0.permanent": true })),
      mastery: MASTERY({ dmg: "damage" },
        T("Invasão", "O portal passa a cuspir caçadores.", null,
          { "effects.0.onHit.0.kind": "dreadstalker", "effects.0.onHit.0.duration": 12 })),
      crit: CRIT({},
        T("Cerco", "Todo golpe do portal crita, e ele dispara projéteis perfurantes.",
          { crit: { set: 1 } },
          { "effects.0.projectile": { type: "projectile", damage: "@damage", speed: 420,
                                      radius: 6, life: 1.6, pierce: 3, count: 3, spread: 0.3,
                                      color: "#c07aff" } })),
    },
  },

  /* --- evolucoes ---------------------------------------------------------- */

  demonicTyrant: {
    id: "demonicTyrant", key: "wildImps", name: "Demonic Tyrant",
    color: "#c07aff", axis: "dominion", axisPoints: 0,
    tags: ["summon", "fel", "tyrant"], evolutionOnly: true, vfx: "chain",
    desc: "Troca o bando por um só demônio grande: ele fica ao seu lado, bate muito mais forte e corta em arco.",
    stats: { ...CRIT_BASE, count: 1, respawn: 8, damage: 140, duration: 22,
             range: 360, attackInterval: 0.55, cleave: 120 },
    trigger: { type: "autonomous", count: "@count", interval: "@respawn" },
    effects: [
      { type: "summon", kind: "tyrant", ai: "anchor", count: 1, cap: "@count", big: true,
        duration: "@duration", damage: "@damage", range: "@range",
        attackInterval: "@attackInterval",
        onHit: [{ type: "damage_instant", amount: "@damage*0.7", radius: "@cleave", big: true,
          /* Onda de comando, nao bola de fogo. Ela e o par visual do Infernal
             — as duas invocam algo grande que bate em area — e a diferenca
             tem que estar na FORMA, porque a cor nao pode ajudar: a do Tirano
             e roxa por ser Dominio, e a do Infernal e laranja por ser
             Cataclismo, e matiz ja esta ocupado dizendo o eixo. */
          shape: "nova" }] },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "attackInterval", verb: "Golpeia" },
                     qty: { stat: "count", noun: "tiranos em campo", steps: [2, 3] } },
        T("Tirania Menor", "3 tiranos permanentes.",
          { count: { set: 3 } }, { "effects.0.permanent": true })),
      mastery: MASTERY({ dmg: "damage" },
        T("Cataclismo Pessoal", "Cada golpe atordoa e empurra tudo por perto.", null,
          { "effects.0.onHit.3": { type: "stun", duration: 0.6, radius: "@cleave" },
            "effects.0.onHit.4": { type: "knockback", force: 80, radius: "@cleave" } })),
      crit: CRIT({},
        T("Corte de Fogo", "Todo golpe crita e incendeia tudo que atinge.",
          { crit: { set: 1 } },
          { "effects.0.onHit.2": { type: "damage_over_time", key: "tyrantFire",
            dps: "@damage*0.35", duration: 5, tickInterval: 0.5, color: "#c07aff",
            radius: "@cleave" } })),
    },
  },

  grimoireOfSacrifice: {
    id: "grimoireOfSacrifice", key: "felguard", name: "Grimoire of Sacrifice",
    color: "#c07aff", axis: "dominion", axisPoints: 0,
    tags: ["fel", "guard", "sacrifice"], evolutionOnly: true, vfx: "blood",
    desc: "Consome o seu guarda: sem o corpo dele, você ganha um pulso de dano em área constante e escudo que se renova sozinho.",
    stats: { ...CRIT_BASE, interval: 3.5, damage: 170, radius: 200, shield: 55, cap: 420 },
    trigger: { type: "aura", interval: "@interval" },
    effects: [
      { type: "hook", name: "grimoire", amount: "@shield", cap: "@cap" },
      { type: "damage_instant", amount: "@damage", radius: "@radius", big: true,
        // o pet e consumido, nao explodido
        shape: "implode" },
      { type: "shield", amount: "@shield", cap: "@cap",
        // o pacto: sete faces, o corpo do demonio virou casca
        veil: { sides: 7, spin: 0.42, thick: 2.8 } },
    ],
    paths: {
      haste: HASTE({ rate: { stat: "interval", verb: "Pulsa" } },
        T("Ciclo Infinito", "O pulso mantém um guarda permanente ao seu lado.", null,
          { "effects.3": { type: "summon", kind: "felguard", ai: "anchor", count: 1, cap: 2,
                           permanent: true, damage: "@damage*0.5", big: true } })),
      mastery: MASTERY({ dmg: ["damage", "shield"], noun: "dano e escudo" },
        T("Massacre", "Triplica o dano do pulso.", { damage: { mul: 3 } })),
      crit: CRIT({ noun: "dano" },
        T("Imortalidade Fel", "Todo pulso crita, o teto de escudo dobra e ele cura 30% do dano.",
          { crit: { set: 1 }, cap: { mul: 2 } },
          { "effects.4": { type: "heal", frac: 0.3 } })),
    },
  },

});
