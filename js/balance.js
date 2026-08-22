"use strict";
/* =========================================================================
   BALANCE / ENEMIES / CLASSES / ITEMS — data pura de tuning.
   ========================================================================= */

const BALANCE = {
  player: {
    radius: 16,
    speed: 240,          // px/s
    maxHp: 100,
  },
  world: {
    tile: 128,           // lado da laje de basalto (ver js/render/scenery.js)
  },
  camera: {
    lerp: 0.12,          // suavização do follow (0 = travado, 1 = instantâneo)
  },
  spawn: {
    /* Densidade DOBRADA em relação ao tuning original.

       A sensação de rampagem vem de ceifar leva, não de duelar. Intervalo pela
       metade, teto de vivos e tamanho de wave dobrados, e o HP por ramp
       reduzido para compensar: mais corpos, menos vida cada. Um inimigo que
       exige três tiros não dá dopamina; vinte que caem no mesmo pulso, sim. */
    baseInterval: 0.55,  // s entre spawns no início
    minInterval: 0.09,   // piso do intervalo
    rampEvery: 30,       // a cada Xs aperta o spawn e o HP
    intervalDecay: 0.86, // multiplicador do intervalo a cada ramp
    /* HP por ramp caiu de 0.18 para 0.11, e o teto de vivos subiu.

       A troca é deliberada: MAIS CORPOS, MENOS VIDA CADA. Vida crescendo a
       18% a cada 30s vira exponencial (167x a base aos 10 min) e o dano do
       jogador não acompanha — a curva de abates achatava e virava parede.
       Densidade alta com vida baixa dá o oposto: dá para ceifar levas
       inteiras, que é de onde vem a dopamina. */
    hpGrowth: 0.11,      // +11% HP base por ramp
    dmgGrowth: 0,        // touch damage does not scale before the hard phase
    speedGrowth: 0,      // same for enemy speed
    maxAlive: 1100,      // teto de inimigos vivos (perf)
    margin: 80,          // distância fora da tela onde nascem
    abominationAt: 180,  // s até Abomination entrar no pool
    waveEvery: 120,      // a cada Xs, wave densa em círculo
    waveBase: 36,        // inimigos por wave (cresce com ramps)
    bossAt: 300,         // 1º Dreadlord aos 5 min
    bossEvery: 150,      // novos Dreadlords a cada Xs depois disso
    // Boss HP uses hpMul raised to this exponent: without it a Dreadlord at
    // 10 min becomes an unbreakable wall instead of a mini-boss.
    bossHpExp: 0.6,

    // --- Hard phase: past hardAt the whole curve shifts gear. Target is for a
    // competent run to end somewhere around the 10 minute mark.
    hardAt: 300,             // second gear kicks in here (5 min)
    hardRampEvery: 15,       // ramps twice as often
    hardIntervalDecay: 0.84, // spawn interval tightens faster
    hardMinInterval: 0.035,  // new floor for the interval
    hardHpGrowth: 0.105,     // +10.5% HP per ramp (every 15s)
    hardDmgGrowth: 0.06,     // +6% touch damage per ramp
    hardSpeedGrowth: 0.02,   // +2% enemy speed per ramp
    hardMaxAlive: 1500,      // alive cap rises alongside
    hardWaveEvery: 50,       // dense waves nearly twice as frequent
    hardBossEvery: 75,       // Dreadlords every 75s
    hardBossStack: 150,      // every Xs past hardAt, +1 Dreadlord per summon
    maxBossStack: 3,         // cap on Dreadlords per summon
    // Baú é a fonte de tiers grátis: espaçá-lo custava as evoluções. Com 10s
    // cada Dreadlord de um summon empilhado larga o seu.
    bossChestCooldown: 10,   // min seconds between boss chests
    // Baú de mundo: não espera boss. Antes disso a run passava 5 minutos sem
    // ver um único baú, porque o 1º Dreadlord só nasce aos 300s.
    chestAt: 45,             // 1º baú avulso aos 45s
    chestEvery: 55,          // novos baús a cada Xs
    hardChestEvery: 40,      // cadência apertada na fase dura
    chestDist: 0.42,         // fração do alcance de spawn: perto, mas exige andar
    // No enemy may exceed this fraction of the player's speed: the pressure
    // comes from density, not from taking kiting off the table.
    speedCap: 0.9,
  },
};


/* Baú: quantos tiers grátis ele entrega. Peso relativo, não porcentagem;
   `lateWeight` substitui `weight` depois de BALANCE.spawn.hardAt — no fim da run
   um tier avulso não muda mais nada, um pacote de 5 sim. */
BALANCE.chest = {
  rarity: [
    { count: 1, label: "Comum",    color: "#cfd2dc", shake: 6,  weight: 34, lateWeight: 12 },
    { count: 3, label: "Raro",     color: "#5acfff", shake: 10, weight: 44, lateWeight: 46 },
    { count: 5, label: "Lendário", color: "#ffd24a", shake: 16, weight: 22, lateWeight: 42 },
  ],
};

// Inimigos como data. radius, hp, speed, touchDps, color, weight (peso de spawn).
// `lateWeight` replaces `weight` past BALANCE.spawn.hardAt: the late horde
// trades ghouls for heavier bodies.
const ENEMIES = {
  ghoul: {
    id: "ghoul", name: "Ghoul",
    radius: 13, hp: 10, speed: 130, touchDps: 8, xp: 1,
    color: "#7fae5a", weight: 6, lateWeight: 4, minTime: 0,
    deathSfx: "flesh",
  },
  skeleton: {
    id: "skeleton", name: "Skeleton Warrior",
    radius: 15, hp: 26, speed: 92, touchDps: 12, xp: 3,
    color: "#cfc8b0", weight: 3, lateWeight: 4, minTime: 45,
    deathSfx: "bone",       // esqueleto estala mais e esmaga menos
  },
  abomination: {
    id: "abomination", name: "Abomination",
    radius: 26, hp: 120, speed: 56, touchDps: 22, xp: 12,
    color: "#9a6b4f", weight: 1, lateWeight: 2, minTime: 180,
    deathSfx: "rot",        // massa de carne: grave e molhado
  },
  dreadlord: {
    id: "dreadlord", name: "Dreadlord",
    radius: 38, hp: 1400, speed: 48, touchDps: 30, xp: 120,
    color: "#b23cff", weight: 0, minTime: 300,
    deathSfx: "flesh",
    boss: true, ranged: true,
    shootInterval: 2.2, shootDamage: 14, shootSpeed: 240, shootRange: 540,
  },
};

/* Eixos de build. Pool total de pontos e teto por eixo forcam comprometimento:
   com teto 15 e pool 20 e impossivel maximizar dois eixos. */
/* One build is one axis, and one axis is one color family. Green, purple and
   orange sit far apart in hue, so a screen full of effects still says which
   build fired it. Red is out: next to orange, in motion, they read the same.

   Every piece, capstone and effect color has to be one of its family's three
   shades — `base` for the signature pieces, `light` for the loud ones (evos,
   detonations, capstones puros), `deep` for curses and defense. The default
   driver rejects any color outside the palette of its own axis. */
const AXIS_PALETTE = {
  corruption: { base: "#7fdc4a", light: "#a8f05c", deep: "#4a9e2e" },
  dominion:   { base: "#9a4cff", light: "#c07aff", deep: "#6a28c8" },
  cataclysm:  { base: "#ff8a3c", light: "#ffb54a", deep: "#e0521a" },
};

const AXES = {
  corruption: { id: "corruption", name: "Corrupção", icon: "☠",
                color: AXIS_PALETTE.corruption.base, palette: AXIS_PALETTE.corruption,
                tag: "DoT, propagação, morte lenta" },
  dominion:   { id: "dominion",   name: "Domínio",   icon: "👹",
                color: AXIS_PALETTE.dominion.base, palette: AXIS_PALETTE.dominion,
                tag: "Demônios, presença, exército" },
  cataclysm:  { id: "cataclysm",  name: "Cataclismo", icon: "🔥",
                color: AXIS_PALETTE.cataclysm.base, palette: AXIS_PALETTE.cataclysm,
                tag: "Golpes grandes, fogo, detonação" },
};

const AXIS_RULES = {
  pool: 20,        // pontos totais que uma run pode acumular
  capPerAxis: 15,  // teto por eixo
  pureAt: 15,      // limiar do capstone puro
  hybridMain: 10,  // limiar principal do capstone hibrido
  hybridSide: 5,   // limiar secundario do capstone hibrido
};

// Regra dos caminhos (Bloons): no maximo 2 caminhos podem passar do tier 2.
const PATH_RULES = {
  tiers: 5,
  freeTier: 2,     // ate este tier qualquer caminho pode subir
  maxDeep: 2,      // quantos caminhos podem passar de `freeTier`
};

// Classes como data. Só Warlock jogável; resto é placeholder de UI.
const CLASSES = {
  warlock: {
    id: "warlock",
    name: "Warlock",
    tag: "Sombra · Fogo Fel · DoT",
    color: "#7a3cff",
    available: true,
    base: { maxHp: 100, speed: 240 },
    // Kit inicial: uma peca de identidade (DoT) e uma de dano imediato. Entram
    // de graca — o pool de 20 pontos fica inteiro para as escolhas do jogador.
    starting: ["corruption", "incinerate"],
    // Evolução visual: `at` = nº mínimo de pontos de eixo para assumir a forma.
    // A última forma cujo `at` for atingido vence.
    forms: [
      { sprite: "warlock", at: 0, scale: 2.9 },
      { sprite: "warlockFel", at: 6, scale: 3.55, dy: -0.33, color: "#aaff5a",
        icon: "👹", name: "Corrompido",
        desc: "O fel toma o warlock: chifres despontam e a mandíbula acende." },
      { sprite: "warlockDemon", at: 14, scale: 3.85, dy: -0.48, aura: true, color: "#ff8a3c",
        icon: "😈", name: "Metamorfose Demoníaca",
        desc: "Asas se abrem e os olhos viram brasa — pouco resta do humano." },
    ],
  },
  mage:   { id: "mage",   name: "Mage",   tag: "Em breve", color: "#3fa9f5", available: false },
  hunter: { id: "hunter", name: "Hunter", tag: "Em breve", color: "#6fdc4a", available: false },
};

/* ITEMS: drops raros dos inimigos. dropChance por abate (x10 em bosses).
   onPickup(game) aplica o efeito imediato ao coletar. */
const ITEMS = {
  magnet: {
    id: "magnet", name: "Ímã de Almas", icon: "🧲", color: "#5acfff",
    dropChance: 0.012,
    desc: "Atrai todo o XP do chão para você.",
    onPickup(game) { for (const o of game.orbs.active) o.magnet = true; },
  },
  chest: {
    id: "chest", name: "Baú do Dreadlord", icon: "📦", color: "#ffd24a",
    dropChance: 0,        // só dropa de boss (garantido)
    silent: true,         // abre tela própria em vez de toast
    onPickup(game) { game.openChest(); },
  },
};
