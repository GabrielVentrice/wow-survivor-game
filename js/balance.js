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
    tile: 126,           // lado da laje de basalto — MULTIPLO de PIXEL_UNIT
                         // (ver js/render/scenery.js e o grid em js/game.js)
  },
  camera: {
    lerp: 0.12,          // suavização do follow (0 = travado, 1 = instantâneo)

    /* Impacto. `addShake` continua recebendo as magnitudes antigas (4..22);
       `ref` é o que converte isso em trauma 0..1, então todo call site já
       existente mantém seu peso relativo sem ser reescrito. */
    shake: {
      ref: 22,           // magnitude que vale amplitude cheia — o evento mais alto
      max: 22,           // unidades de mundo de desvio no primeiro quadro
      freq: 54,          // rad/s da oscilação (~8,6 Hz, ~7 amostras por ciclo)
      damping: 11,       // quão rápido o soco morre (~0,35s até o silêncio)
      lateral: 0.45,     // quanto ele desvia do eixo do golpe
    },

    /* Hitstop, em segundos REAIS. Congelar a simulação por um relógio escalado
       faria um stop de 50ms durar 150ms no timeScale 3. `cooldown` é o que
       impede que uma tela cheia de explosão vire apresentação de slides. */
    hitstop: { big: 0.034, boss: 0.11, hurt: 0.067, cooldown: 0.26 },
  },

  /* Homing projectiles. `fanDelay` is the only number here and it exists for
     one reason: homing and spread cancel each other out. `updateProjectiles`
     re-aims every frame, so at turnRate 9 the 0.21rad fan that "Salva" opens is
     gone in two frames — measured, the 4 shots never get more than 1.1 units
     apart against a radius of 6, and read as ONE fat projectile all run.

     The delay only applies to a shot born in a fan; a lone bolt stays stubborn
     from frame one, which is Incinerate's identity.

     0.1 is the knee of the curve, and the curve was measured on both sides.
     Against a target 400 units out the fan peaks at 5.1 radii for 2 shots, 11.1
     for 4 and 22.7 for 7 — unambiguous — while every shot still connects, the
     first at ~0.7s. Going to 0.15 buys roughly half again as much spread and
     costs about twice the damage on the piercing tier-5, which is not a trade
     worth making: past ~5 radii the fan already reads as separate shots and the
     extra width is only width. */
  projectile: { fanDelay: 0.1 },
  spawn: {
    /* Densidade OCTUPLICADA em relação ao tuning original (dobrada três
       vezes: uma no tuning de rampagem, duas por pedido depois dele).

       A sensação de rampagem vem de ceifar leva, não de duelar. Intervalo
       dividido, teto de vivos e tamanho de wave multiplicados, e o HP por ramp
       reduzido para compensar: mais corpos, menos vida cada. Um inimigo que
       exige três tiros não dá dopamina; vinte que caem no mesmo pulso, sim.

       O teto de vivos anda JUNTO com o intervalo. Sem isso, dobrar o fluxo de
       spawn só faz a fila bater no teto mais cedo e a densidade em tela fica
       exatamente a mesma da versão anterior — o dobro vira no-op. */
    baseInterval: 0.1375, // s entre spawns no início
    minInterval: 0.0225,  // piso do intervalo
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
    maxAlive: 4400,      // teto de inimigos vivos (perf)
    margin: 80,          // distância fora da tela onde nascem
    abominationAt: 180,  // s até Abomination entrar no pool
    waveEvery: 120,      // a cada Xs, wave densa em círculo
    waveBase: 144,       // inimigos por wave (cresce com ramps)
    bossAt: 300,         // 1º Dreadlord aos 5 min
    bossEvery: 150,      // novos Dreadlords a cada Xs depois disso
    /* HP de chefe usa hpMul elevado a este expoente.

       Subiu de 0.6 para 0.92 junto com a queda do HP do lixo. A divisão de
       papéis é intencional: o LIXO é para ser ceifado — é dele que vem a
       rampagem — e a AMEAÇA mora no chefe. Sem isso, baixar o HP da horda
       tirava o perigo do jogo inteiro e ninguém mais morria (medido: 0 mortes
       em 9 runs, vida em 100% do começo ao fim). */
    bossHpExp: 0.78,

    // --- Hard phase: past hardAt the whole curve shifts gear. Target is for a
    // competent run to end somewhere around the 10 minute mark.
    hardAt: 300,             // second gear kicks in here (5 min)
    hardRampEvery: 15,       // ramps twice as often
    hardIntervalDecay: 0.84, // spawn interval tightens faster
    hardMinInterval: 0.00875, // new floor for the interval
    hardHpGrowth: 0.105,     // +10.5% HP per ramp (every 15s)
    hardDmgGrowth: 0.085,    // +8.5% touch damage per ramp
    hardSpeedGrowth: 0.032,  // +3.2% enemy speed per ramp
    hardMaxAlive: 6000,      // alive cap rises alongside
    hardWaveEvery: 50,       // dense waves nearly twice as frequent
    hardBossEvery: 68,       // Dreadlords every 68s
    hardBossStack: 110,      // every Xs past hardAt, +1 Dreadlord per summon
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


/* LEVEL UP: a batida rapida. So aprofunda o que a build ja tem.

   `passiveAt` e o nivel a partir do qual passiva entra no bolo, e a razao e o
   que uma passiva E: ela nao constroi nada sozinha, ela MULTIPLICA o que a
   build ja tem (`pieceMods` sobre um `match`). Caindo nos primeiros niveis ela
   multiplica quase nada — e ainda toma o lugar do tier que abriria a trilha.
   Depois do 10 ja existe build para ela amplificar.

   Sao oito passivas para uma run de dezenas de niveis, entao adiar nao custa
   variedade: custa so o comeco, que e onde a spell precisa de tier e nao de
   multiplicador. */
BALANCE.levelup = {
  passiveAt: 10,   // nivel a partir do qual passiva pode ser oferecida
};

/* ETAPAS: a batida lenta da run, e a UNICA fonte de ponto de eixo.

   O level up passou a ser so profundidade (um tier de uma spell que voce ja
   tem). Largura e comprometimento saem daqui — de marcos de TEMPO, que o
   jogador ve chegar no relogio em vez de sortear.

   Por que tempo e nao chefe: o primeiro Dreadlord so nasce aos 5 min e depois
   vem a cada 2:30. Metade da run ficaria sem marco nenhum, e o eixo — que e a
   unica decisao irreversivel do jogo — chegaria tarde demais para ser mirado.

   NAO ha tabela de pontos por marco, e isso e de proposito. A rampa e
   EMERGENTE: antes de abrir um eixo so existe carta de spell, que vale
   `spellPoints`; depois de `unlockAt` aquele eixo ganha slot fixo com carta
   seca de `axisPoints`. O jogador comeca ganhando de 1 em 1 e passa a ganhar de
   2 em 2 porque ELE se comprometeu, nao porque uma coluna de numeros disse que
   o sexto marco vale mais.

   Quem para as etapas e a POOL, nao um contador de marcos: `every` continua
   disparando enquanto `axisLeft` for maior que zero. Ponto que sobra sem tela
   para gasta-lo e ponto que o painel mostra e o jogo nunca entrega — foi o que
   acontecia enquanto a lista de marcos era o fim da linha, com runs acabando em
   12/20 e 13/20.

   A cadencia sai da conta, nao do gosto: a pool e 20, um jogador que abre um
   eixo cedo gasta ~5 marcos a 1 ponto e o resto a 2, entao fecha em ~13 marcos.
   A 45s isso da ~9:45 — logo antes dos 10 min, que e onde uma run competente
   deveria estar acabando. `driver_milestone` refaz essa conta. */
BALANCE.milestones = {
  first: 40,        // s ate o primeiro marco
  every: 40,        // cadencia enquanto sobrar ponto de eixo
  cards: 3,         // cartas por etapa
  unlockAt: 5,      // pontos num eixo para ele ganhar slot fixo + carta seca
  spellPoints: 1,   // eixo que uma spell carrega para o eixo dela
  axisPoints: 2,    // eixo da carta seca de um eixo aberto
  warnAt: 12,       // s antes do marco em que o HUD comeca a avisar
};

/* Baú: quantos tiers grátis ele entrega. Peso relativo, não porcentagem;
   `lateWeight` substitui `weight` depois de BALANCE.spawn.hardAt — no fim da run
   um tier avulso não muda mais nada, um pacote de 5 sim.

   The multi-tier package is the chest's payoff, and a payoff that lands in two
   of every three chests stops being one: with today's cadence (a loose chest
   every 55s plus one per Dreadlord) the player opens dozens per run, and the
   single tier had become the exception. The common roll is the majority again;
   the 5-pack still exists, just rarer. */
BALANCE.chest = {
  rarity: [
    { count: 1, label: "Comum",    color: "#cfd2dc", shake: 6,  weight: 58, lateWeight: 34 },
    { count: 3, label: "Raro",     color: "#5acfff", shake: 10, weight: 33, lateWeight: 45 },
    { count: 5, label: "Lendário", color: "#ffd24a", shake: 16, weight:  9, lateWeight: 21 },
  ],
};

// Inimigos como data. radius, hp, speed, touchDps, color, weight (peso de spawn).
// `lateWeight` replaces `weight` past BALANCE.spawn.hardAt: the late horde
// trades ghouls for heavier bodies.
/* `art` is the sprite height in RADII. It exists because the grid step is a
   whole number: a 14-row grid can only show up 42, 84 or 126 pixels tall, and
   nothing in between. Leaving the value implicit in a fixed 2.7 let rounding
   pick on its own — and its pick moved a body's size by up to 20% with nobody
   asking. Here each enemy says which step it stops at.

   When no step fits (the Dreadlord wanted to sit between two), the fix is not
   going back to free scaling: it is drawing the grid at the size it will be
   seen at. A 14-row boss blown up 3x is a small boss blown up, not a boss. */
/* HP base DOBRADO em todo corpo comum — chefe de fora, que tem a sua propria
   curva por `bossHpExp`.

   Isso empurra contra o "MAIS CORPOS, MENOS VIDA CADA" que o bloco de spawn
   defende, e o contrapeso e de la mesmo: o fluxo de spawn foi multiplicado por
   oito. Uma horda oito vezes mais densa com o HP antigo evapora antes de
   chegar perto, e o que era ceifar leva vira varrer nevoa — a horda para de
   ser ameaca e vira so contador de abate subindo. O dobro de vida devolve o
   tempo que o corpo passa em tela sem devolver a parede de um-inimigo-tres-
   tiros: com oito vezes mais corpos, o pulso de abate continua sendo leva. */
const ENEMIES = {
  ghoul: {
    id: "ghoul", art: 3.0, name: "Ghoul",
    radius: 13, hp: 20, speed: 130, touchDps: 8, xp: 1,
    color: "#7fae5a", weight: 6, lateWeight: 4, minTime: 0,
    deathSfx: "flesh",
  },
  skeleton: {
    id: "skeleton", art: 3.2, name: "Skeleton Warrior",
    radius: 15, hp: 52, speed: 92, touchDps: 12, xp: 3,
    color: "#cfc8b0", weight: 3, lateWeight: 4, minTime: 45,
    deathSfx: "bone",       // esqueleto estala mais e esmaga menos
  },
  abomination: {
    id: "abomination", art: 3.23, name: "Abomination",
    radius: 26, hp: 240, speed: 56, touchDps: 22, xp: 12,
    color: "#9a6b4f", weight: 1, lateWeight: 2, minTime: 180,
    deathSfx: "rot",        // massa de carne: grave e molhado
  },
  /* --- A Vanguarda Ardente ------------------------------------------------
     A Legiao nao desembarca de uma vez: cada casta entra por `minTime`, e o
     que separa uma da outra nao e HP, e a FORMA DA PRESSAO. Com movimento como
     unico input, inimigo novo so vale quando muda a pergunta que o jogador
     responde com o corpo — encostar, parar, andar em linha reta, fugir.

     Nenhuma delas acende em verde-fel. `fel0..2` vem de AXIS_PALETTE.corruption
     e e literalmente a cor da build do jogador: um inimigo aceso nela lê como
     spell dele com mil corpos em tela. Olho vermelho e lente fria, que e o que
     a PAL reserva para horda. */
  ganarg: {
    id: "ganarg", art: 3.0, name: "Gan'arg Sapador",
    radius: 11, hp: 28, speed: 150, touchDps: 6, xp: 2,
    color: "#8790a8", weight: 4, lateWeight: 5, minTime: 60,
    deathSfx: "bone",
    /* O touchDps e baixo DE PROPOSITO: a ameaca dele nao e o encosto, e a
       morte. Ele transforma "deixei a horda chegar" numa conta paga de uma
       vez, e e a unica peca do elenco que muda COMO se joga em vez de quanto
       se apanha. */
    deathBlast: { radius: 70, damage: 16 },
  },
  felbat: {
    id: "felbat", art: 3.0, name: "Morcego Fel",
    radius: 12, hp: 36, speed: 205, touchDps: 10, xp: 4,
    color: "#3a2456", weight: 3, lateWeight: 5, minTime: 120,
  },
  inquisitor: {
    id: "inquisitor", art: 3.75, name: "Inquisidora Man'ari",
    radius: 16, hp: 80, speed: 70, touchDps: 8, xp: 10,
    color: "#5f3b80", weight: 1, lateWeight: 1, minTime: 150,
    /* O primeiro inimigo COMUM que atira — `ranged` ja existia e so o chefe
       usava. Peso 1 nao e timidez: com maxAlive em 4400 um peso 2 poria ~400
       atiradoras vivas, e ai a chuva de projetil e dano E custo de frame. */
    ranged: true,
    shootInterval: 3.2, shootDamage: 7, shootSpeed: 240, shootRange: 380,
  },
  fellord: {
    id: "fellord", art: 3.0, name: "Fel Lord",
    radius: 30, hp: 840, speed: 66, touchDps: 34, xp: 34,
    /* weight 0 + lateWeight 3: corpo que so existe depois de hardAt, quando
       pickType troca de peso. Maior que o Abomination e mais rapido que ele —
       e o corpo que FECHA a rota, nao o que persegue. */
    color: "#9c471b", weight: 0, lateWeight: 3, minTime: 300,
    deathSfx: "bone",
  },
  dreadlord: {
    id: "dreadlord", art: 3.0, name: "Dreadlord",
    radius: 38, hp: 1400, speed: 48, touchDps: 30, xp: 120,
    color: "#b23cff", weight: 0, minTime: 300,
    deathSfx: "flesh",
    boss: true, ranged: true,
    shootInterval: 1.9, shootDamage: 18, shootSpeed: 280, shootRange: 600,
  },
  /* Chefe corpo a corpo, e o contrario exato do Dreadlord, que atira e mantem
     distancia. Depois dos 7 min o jogo passa a ter dois desenhos de chefe em
     vez de um repetido. */
  annihilan: {
    id: "annihilan", art: 3.0, name: "Aniquilador",
    radius: 44, hp: 2600, speed: 44, touchDps: 52, xp: 220,
    color: "#a4735a", weight: 0, minTime: 420,
    deathSfx: "rot",
    boss: true,
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
  corruption: { id: "corruption", name: "Corrupção",
                color: AXIS_PALETTE.corruption.base, palette: AXIS_PALETTE.corruption,
                tag: "DoT, propagação, morte lenta" },
  dominion:   { id: "dominion",   name: "Domínio",
                color: AXIS_PALETTE.dominion.base, palette: AXIS_PALETTE.dominion,
                tag: "Demônios, presença, exército" },
  cataclysm:  { id: "cataclysm",  name: "Cataclismo",
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
    // Kit inicial: UMA peca so, e a mais neutra do catalogo — o tiro que
    // persegue e nao pede nada do jogador. Entra de graca: o pool de 20 pontos
    // fica inteiro para as escolhas do jogador.
    //
    // Comecar com duas ja entregava meia identidade de graca: quem nascia com
    // Corruption nascia com o eixo escolhido, e a primeira etapa deixava de ser
    // descoberta para virar confirmacao. Com uma peca so, a fase fechada da
    // etapa volta a fazer o trabalho dela — as tres spells sorteadas sao a
    // primeira coisa que diz para onde a run vai.
    starting: ["incinerate"],
    /* Metamorfose: `caps` = nº de capstones fechados para assumir a forma. A
       última forma cujo `caps` for atingido vence.

       O gatilho é o CAPSTONE, não o acúmulo de pontos: pontos de eixo entram
       sozinhos a cada compra, e uma transformação que chega por inércia não
       marca nada. Capstone é o único marco que exige comprometer o pool a
       ponto de fechar as outras portas — é ele que separa o aprendiz do
       mestre. Com pool 20 e teto 15, cabem no máximo dois numa run: são
       exatamente as duas formas abaixo da base. */
    /* METAMORFOSE: uma forma por CAPSTONE, nao por contagem de capstones.

       A versao anterior indexava por quantos capstones estavam fechados, e com
       teto de dois por run isso dava duas formas para oito finais diferentes:
       o corpo dizia que a run tinha chegado longe, mas nao dizia para ONDE.
       Uma forma por capstone faz a silhueta responder a pergunta que a tela de
       etapa passa a run inteira fazendo — e ela responde de longe, sem texto.

       `spells` cobre o degrau do meio, e o gatilho dele nao podia ser ponto de
       eixo: ponto entra sozinho a cada compra e a forma chegaria por inercia,
       que e o defeito que ja tirou a metamorfose do acumulo uma vez. Fechar um
       caminho ate o tier 5 e a outra conquista merecida que o jogo tem. */
    forms: [
      { sprite: "warlock", scale: 3.375 },
      { sprite: "warlockAdept", spells: 1, scale: 3.5625, dy: -0.33, color: "#aaff5a",
        name: "Iniciado",
        desc: "Uma spell levada ate o fim cobra o corpo: chifres rompem a testa e um antebraco ja e osso." },
      { sprite: "warlockColheita", cap: "colheita", scale: 3.75, dy: -0.48, color: AXIS_PALETTE.corruption.light,
        name: "Colheita",
        desc: "O manto apodreceu em raizes e a caixa toracica esta escancarada." },
      { sprite: "warlockCeifador", cap: "ceifador", scale: 3.75, dy: -0.48, color: AXIS_PALETTE.corruption.base,
        name: "Ceifador",
        desc: "Caveira dentro do capuz, garras longas, cranios de imp pendurados na barra." },
      { sprite: "warlockVoraz", cap: "voraz", scale: 3.75, dy: -0.48, color: AXIS_PALETTE.corruption.base,
        name: "Voraz",
        desc: "O tronco abriu numa boca de presas que vai do peito a cintura." },
      { sprite: "warlockTirania", cap: "tirania", scale: 3.75, dy: -0.48, color: AXIS_PALETTE.dominion.light,
        name: "Tirania",
        desc: "Coroa de ferro, ombreiras douradas, e os pes nao tocam mais o chao." },
      { sprite: "warlockDiabolista", cap: "diabolista", scale: 3.75, dy: -0.48, color: AXIS_PALETTE.dominion.base,
        name: "Diabolista",
        desc: "Selo de latao as costas, mascara com chifres, e nenhum passo." },
      { sprite: "warlockEnxame", cap: "enxame", scale: 3.75, dy: -0.48, color: AXIS_PALETTE.dominion.base,
        name: "Enxame",
        desc: "O peito e os ombros racharam em celulas de colmeia sob placas de quitina." },
      { sprite: "warlockNihilam", cap: "nihilam", scale: 3.75, dy: -0.48, color: AXIS_PALETTE.cataclysm.light,
        name: "Nihilam",
        desc: "Queimado ate a casca: o cranio a mostra e o tronco rachado de brasa." },
      { sprite: "warlockChamador", cap: "chamador", scale: 3.75, dy: -0.48, color: AXIS_PALETTE.cataclysm.base,
        name: "Chamador",
        desc: "Coroa de ferro negro e um sino rachado pendurado no peito." },
    ],
  },
  mage:   { id: "mage",   name: "Mage",   tag: "Em breve", color: "#3fa9f5", available: false },
  hunter: { id: "hunter", name: "Hunter", tag: "Em breve", color: "#6fdc4a", available: false },
};

/* ITEMS: drops raros dos inimigos. dropChance por abate (x10 em bosses).
   onPickup(game) aplica o efeito imediato ao coletar. */
const ITEMS = {
  magnet: {
    /* Per kill, and a run kills thousands: at 1.2% the magnet showed up so
       often that walking to the orbs stopped being a decision.

       Osso, nao ciano: recompensa neutra nao pertence a eixo nenhum, e o ciano
       era a cor que a raridade do bau usava — as duas sairam juntas. */
    id: "magnet", name: "Ímã de Almas", art: "anel", color: "#98928A",
    dropChance: 0.004,
    desc: "Atrai todo o XP do chão para você.",
    onPickup(game) { for (const o of game.orbs.active) o.magnet = true; },
  },
  chest: {
    id: "chest", name: "Baú do Dreadlord", art: "placa", color: "#C9C3BA",
    dropChance: 0,        // só dropa de boss (garantido)
    silent: true,         // abre tela própria em vez de toast
    onPickup(game) { game.openChest(); },
  },
};
