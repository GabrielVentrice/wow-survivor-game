"use strict";
/* =========================================================================
   DRIVER — VFX: a assinatura de cada peca, e a cor no codigo de render.

   Duas perguntas que nenhum outro driver faz:

   1. DA PARA DISTINGUIR DUAS PECAS PELO QUE ELAS DESENHAM? Cor e predicado do
      eixo, entao duas pecas do mesmo eixo que emitem o mesmo evento saem
      literalmente iguais em tela — e o jogador nao tem como saber qual delas
      acabou de disparar. Aqui cada peca e DISPARADA de verdade (firePiece, o
      mesmo funil do jogo) e o que ela faz aparecer e anotado. Peca cuja
      assinatura desenhada e vazia esta cobrando em silencio; duas pecas com a
      mesma assinatura sao irmas visuais.

      A assinatura sai do que aconteceu, nao de uma tabela: tabela de "o que
      cada efeito desenha" seria uma segunda lista para divergir da primeira.

   2. ALGUMA COR SATURADA FOI CRAVADA NO CODIGO DE RENDER? `driver_palette`
      olha SPRITE_DATA e `driver.js` olha o `color:` do conteudo — ninguem
      olhava js/render/ nem js/entities.js, e e la que moram a casca ciano do
      escudo (a mesma para as seis pecas que dao escudo) e a parada roxa que
      desbota todo tiro de fogo na borda.

   As duas reprovam contra uma DIVIDA declarada. O que ja esta quebrado hoje
   esta listado com a fase que o mata; o driver falha quando aparece algo NOVO
   fora da lista, e falha tambem quando um item da lista foi consertado e nao
   saiu dela — lista que mente e pior que lista nenhuma.

   Uso:  DRIVER=driver_vfx.js node tools/harness.js .
   ========================================================================= */

let fails = 0;
const bad = (m) => { console.error("  X " + m); fails++; };

let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

/* =========================================================================
   A DIVIDA — o que o plano de VFX ainda nao consertou.

   Cada linha morre numa fase. Linha que sobra depois da fase e regressao;
   linha que ficou obsoleta e mentira. As duas reprovam.
   ========================================================================= */

// Cor saturada cravada no codigo de render (fase 7).
/* VAZIA. Nenhuma cor saturada cravada no codigo de render: toda cor que aparece
   em tela sai de `PAL`, `AXIS_PALETTE` ou `UI_PAL`, ou entao veio do dado da
   peca. A primeira que voltar reprova aqui. */
const DIVIDA_COR = {};

// Peca que dispara e nao desenha nada (fase 3).
const DIVIDA_MUDA = {};

// Pecas que desenham exatamente a mesma coisa (fase 5). Chave = assinatura.
/* VAZIA. Quarenta e tres pecas, quarenta e tres assinaturas: nenhuma peca do
   jogo desenha o mesmo que outra. Manter assim e o que esta lista faz agora —
   peca nova que colidir com uma existente reprova aqui. */
const DIVIDA_IRMAS = {};

/* =========================================================================
   1. COR NO CODIGO DE RENDER

   A regra e objetiva: cor SATURADA que aparece literal no codigo de desenho
   tem que sair da paleta (PAL, AXIS_PALETTE, UI_PAL). Neutro passa sozinho —
   contorno, sombra, vinheta e o branco do nucleo de um flash nao sao decisao
   de identidade, sao luz e ausencia dela.
   ========================================================================= */

const ARQUIVOS = ["js/render/vfx.js", "js/render/scenery.js", "js/render/tiles.js",
                  "js/render/debris.js", "js/entities.js"];

const CROMA_NEUTRO = 24;     // abaixo disso e cinza/preto/branco, nao e cor

function comps(lit) {
  if (lit[0] === "#") {
    let h = lit.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const n = lit.match(/[0-9]+/g).map(Number);
  return [n[0], n[1], n[2]];
}
function croma(lit) {
  const c = comps(lit);
  return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
}

// Tudo que a paleta autoriza, ja normalizado em "r,g,b".
const AUTORIZADO = new Set();
const guarda = (hex) => { if (typeof hex === "string" && hex[0] === "#") AUTORIZADO.add(comps(hex).join(",")); };
for (const k in PAL) guarda(PAL[k]);
for (const a in AXIS_PALETTE) for (const t in AXIS_PALETTE[a]) guarda(AXIS_PALETTE[a][t]);
if (typeof UI_PAL !== "undefined") for (const k in UI_PAL) guarda(UI_PAL[k]);
/* Cor de inimigo e de demonio NAO entram: elas sao dado, e dado se referencia
   por `e.type.color` / `def.color`. O mesmo hex escrito a mao no render nao e a
   cor daquele bicho, e coincidencia — foi assim que o anel de stun virou o
   ambar do Tirano e o de fear virou o roxo do Darkglare. */

const RE_COR = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*[0-9]+\s*,\s*[0-9]+\s*,\s*[0-9]+/g;
const achadas = new Map();          // literal -> "arquivo:linha"

for (const arq of ARQUIVOS) {
  const linhas = __read(arq).split("\n");
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(RE_COR);
    if (!m) continue;
    for (const lit of m) {
      if (croma(lit) < CROMA_NEUTRO) continue;
      if (AUTORIZADO.has(comps(lit).join(","))) continue;
      const chave = lit.startsWith("#") ? lit : lit.replace(/\s/g, "");
      if (!achadas.has(chave)) achadas.set(chave, arq + ":" + (i + 1));
    }
  }
}

const corNova = [...achadas.keys()].filter((k) => !(k in DIVIDA_COR));
const corPaga = Object.keys(DIVIDA_COR).filter((k) => !achadas.has(k));
for (const k of corNova) bad(`cor "${k}" cravada em ${achadas.get(k)} — fora da paleta e fora da divida`);
for (const k of corPaga) bad(`DIVIDA_COR."${k}" ja nao existe no codigo: tire a linha da lista`);
if (!corNova.length && !corPaga.length) {
  console.log(`ok  cor no render: ${achadas.size} pendencia(s) conhecida(s), nenhuma nova`);
}

/* =========================================================================
   2. A ASSINATURA DE CADA PECA

   Cada peca e adquirida sozinha numa build limpa e disparada pelo mesmo funil
   do jogo. O que ela faz aparecer vira um conjunto de fichas.
   ========================================================================= */

const g = new Game();
window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };

const emitido = [];
const emitReal = g.emitVfx.bind(g);
g.emitVfx = (kind, x, y, r, color) => { emitido.push(kind); return emitReal(kind, x, y, r, color); };

/* A mesa de teste nao pode ser homogenea. Metade das pecas do catalogo so
   dispara contra uma condicao: `onlyDotted` (Malefic Rapture) sai calada num
   inimigo limpo, e `execute` (Shadowburn) so acende abaixo do limiar. Num
   campo de alvos cheios e sem DoT essas pecas apareceriam como mudas sem
   serem — o driver estaria medindo o proprio cenario. */
function alvos(n) {
  g.grid.clear();
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const e = g.enemies.spawn(ENEMIES.abomination, g.player.x + Math.cos(a) * 70,
                              g.player.y + Math.sin(a) * 70, g.spawner.scale);
    e.maxHp = 4000;
    // um em cada tres na faixa de execucao — e com folga para AGUENTAR os
    // golpes que a propria mesa desfere, senao ele morre antes de a peca de
    // execucao ter alguem para executar
    e.hp = i % 3 === 2 ? 480 : 4000;
    g.grid.insert(e);
    list.push(e);
  }
  return list;
}

// DoT de fora, para as pecas que so mordem quem ja esta apodrecendo.
function apodrecer(list) {
  const c = { key: "fixture", color: "#7fdc4a", now: g.clock, x: 0, y: 0, target: null };
  for (let i = 0; i < list.length; i += 2) {
    c.target = list[i]; c.x = list[i].x; c.y = list[i].y;
    g.dots.apply(list[i], { key: "fixture", dps: 1, duration: 30, tickInterval: 5,
                            stacking: { mode: "refresh", max: 1 } }, c);
  }
}

/* O que a peca fez APARECER. Nem todo tell e um evento emitido: marca de
   estado sobre o inimigo e sobreposicao presa ao jogador sao desenho que dura,
   e um driver que so olhasse `emitVfx` diria que elas nao existem.

   O que NAO da mais para medir daqui: deslocamento e dreno de vida. Com sete
   segundos de simulacao a horda anda e encosta, entao "o inimigo mudou de
   lugar" e "o jogador perdeu vida" acontecem para toda peca, inclusive as que
   nao fazem nem uma coisa nem outra. As duas mecanicas ganharam tell proprio
   (o rastro `dash` e as riscas do Burning Rush), entao a ficha muda delas
   deixou de ter trabalho. */

function assinar(id) {
  g.start(STARTER_TESTE);
  g.build.pieces.clear();
  g.build.vfx.length = 0;
  g.enemies.clear(); g.projectiles.clear(); g.areas.clear();
  g.minions.reset();

  const inst = g.build.acquirePiece(id, true);
  if (!inst) return null;

  /* Peca de ASPECTO: a mesa assume que a condicao dela vale.

     E a mesma decisao que poe a vida em 25% logo abaixo, e pelo mesmo motivo:
     toda condicao que uma peca declara tem que caber na mesa, senao "muda"
     quer dizer "nao consegui provocar". So que aqui uma mesa nao basta — as
     seis condicoes se contradizem (vida baixa E vida cheia, horda perto E
     campo vazio), entao nao existe cenario unico que ligue as seis. O que a
     mesa faz e cravar o estado do aspecto DESTA peca e parar a reavaliacao:
     quem mede se a condicao liga na hora certa e `driver_aspect`; aqui a
     pergunta e o que a peca DESENHA. */
  if (inst.r.trigger.type === "aspect" && inst.r.trigger.aspect) {
    const aid = inst.r.trigger.aspect;
    g.aspects.active.length = 0;
    g.aspects.active.push(aid);
    const b = ASPECTS[aid].buff;
    const ch = g.aspects.ch;
    if (b.speedMul) ch.speedMul = b.speedMul;
    if (b.rangeMul) ch.rangeMul = b.rangeMul;
    if (b.beastMul) ch.beastMul = b.beastMul;
    g.aspects.nextAt = Infinity;      // congela a reavaliacao pela janela toda
  }

  /* Vida em 25%: as pecas de emergencia so existem quando o jogador esta
     apanhando, e cada uma declara o proprio limiar — o Healthstone so paga
     abaixo de 30%. Com a barra cheia elas sairiam como mudas por causa do
     cenario, nao por causa delas. */
  g.player.hp = g.player.maxHp * 0.25;

  /* OITO alvos, e o numero nao e estetico: Demonic Circle declara
     `minEnemies: 7`. Com seis na mesa ele nunca dispara, e o driver estaria
     medindo a propria mesa em vez da peca. Toda condicao que uma peca declara
     tem que caber aqui, senao "muda" quer dizer "nao consegui provocar". */
  const alvo = alvos(8);
  apodrecer(alvo);

  /* E UM DEMONIO em campo. Grimoire of Sacrifice e Dark Pact consomem um pet;
     sem nenhum vivo, `sacrificeOne` devolve nada e as duas pecas saem com a
     assinatura de metade delas. E a mesma regra dos alvos: toda condicao que a
     peca declara tem que caber na mesa. */
  g.minions.summon({ kind: "imp", count: 1, duration: 30 },
                   { key: "fixture", color: "#9a4cff", now: g.clock,
                     x: g.player.x + 30, y: g.player.y });
  const dotBase = alvo.map((e) => e.dots.length);
  const antes = {
    proj: g.projectiles.active.length, area: g.areas.active.length,
    minion: g.minions.count(),
    escudo: g.player.shield, hp: g.player.hp,
    pos: alvo.map((e) => e.x + "," + e.y),
  };
  emitido.length = 0;

  /* Contagem de PICO, nao do fim: um projetil nasce e some no mesmo intervalo
     (a 480 u/s ele cobre os 70 ate o alvo em 0,15s), e olhar so o estado final
     dava Incinerate como peca que nao desenha nada. */
  const vistoAntes = new Set(g.minions.active);
  const desenha = new Set();

  /* TUDO e anotado durante a janela, nunca no fim dela. Zona expira, marca de
     controle expira, escudo decai, demonio some — numa janela de sete segundos
     olhar o estado final e olhar o silencio DEPOIS da peca, e nao a peca. Foi
     assim que Banish, Howl of Terror e Burning Trail apareceram como mudas
     depois que a janela cresceu: as tres desenham, e as tres ja tinham
     acabado. */
  let picoEscudo = antes.escudo;
  const marcar = () => {
    if (g.projectiles.active.length > antes.proj) desenha.add("proj");
    if (g.player.speedBoostUntil > g.clock) desenha.add("rush");
    if (g.player.shield > picoEscudo) {
      picoEscudo = g.player.shield;
      desenha.add("veil:" + ((g.player.veil && g.player.veil.sides) || "?"));
    }
    for (const z of g.areas.active) desenha.add("area:" + (z.look || "fire"));
    /* O ASPECTO e uma SOBREPOSICAO no jogador, e sobreposicao conta como
       desenho — um driver que so olhasse `emitVfx` diria que ela nao existe, do
       mesmo jeito que diria das marcas de estado e da casca do escudo. */
    for (const id of g.aspects.active) desenha.add("aspecto:" + id);
    for (const m of g.minions.active) if (!vistoAntes.has(m)) desenha.add("minion:" + m.kind);
    const now2 = g.clock;
    for (const e of alvo) {
      for (const d of e.dots) if (d.key !== "fixture") desenha.add("dot:" + (d.look || "rot"));
      if (e.stunUntil > now2) desenha.add("marca:stun");
      else if (e.fearUntil > now2) desenha.add("marca:fear");
      else if (e.slowUntil > now2) desenha.add("marca:slow");
      else if ((e.weakUntil || 0) > now2) desenha.add("marca:weaken");
      else if (e.marked > 0 && now2 < e.markedUntil) desenha.add("marca:mark");
    }
  };

  const p = g.player;
  for (let i = 0; i < 3; i++) {
    firePiece(g, inst, p.x, p.y, alvo[i % alvo.length], 1, 0, g.clock + i * 0.5);
    marcar();
    /* E um golpe DE VERDADE pelo funil, para as pecas `reactive` dispararem
       pelo caminho delas. Sem isso o driver so consegue provocar quem dispara
       por cooldown, e uma peca que so acorda quando o dano acontece sai como
       muda por causa do cenario. Foi assim que o zero de escudo do Soul Leech
       ficou escondido: ninguem nunca provocou a peca. */
    g.damageEnemy(alvo[(i + 1) % alvo.length], 60, "fixture", true);
    marcar();
  }
  /* Sete segundos, e nao um punhado de passos. Boa parte do catalogo cobra no
     VENCIMENTO — Doom, Unstable Affliction e Soul Rupture nao desenham o que
     tem de mais proprio ate o DoT expirar. Com uma janela de 0.2s essas pecas
     saiam com a assinatura da espera, nao a delas. */
  g.spawner.interval = 1e9;
  for (let i = 0; i < 280; i++) {
    /* A mesa e um banco de teste, nao uma partida: os alvos sao reancorados e
       a vida do jogador fica presa. Sem isso a horda fecha em cima dele em
       sete segundos e TODA peca passa a "deslocar inimigo" e "drenar vida" —
       o driver estaria medindo a aproximacao da horda, nao a peca. */
    if (i % 24 === 0) {
      for (let j = 0; j < alvo.length; j++) {
        const a2 = (j / alvo.length) * Math.PI * 2;
        alvo[j].x = g.player.x + Math.cos(a2) * 70;
        alvo[j].y = g.player.y + Math.sin(a2) * 70;
      }
    }
    g.player.hp = g.player.maxHp * 0.25;
    g.update(0.025);
    marcar();
  }

  for (const k of emitido) desenha.add("vfx:" + k);

  return { desenha: [...desenha].sort(), mudo: [] };
}

const porAssinatura = new Map();
const mudas = [];
const quebrou = [];

for (const id in PIECES) {
  let a = null;
  try { a = assinar(id); } catch (e) { quebrou.push(id + ": " + e.message); continue; }
  if (!a) { quebrou.push(id + ": nao entrou na build"); continue; }
  const chave = a.desenha.join("+");
  if (!chave) { mudas.push({ id, mudo: a.mudo }); continue; }
  if (!porAssinatura.has(chave)) porAssinatura.set(chave, []);
  porAssinatura.get(chave).push(id);
}

if (quebrou.length) bad("peca que nao pode ser assinada: " + quebrou.join(" · "));

/* --- 2a. peca muda ------------------------------------------------------- */
const mudaNova = mudas.filter((m) => !(m.id in DIVIDA_MUDA));
const mudaPaga = Object.keys(DIVIDA_MUDA).filter((id) => !mudas.some((m) => m.id === id));
for (const m of mudaNova) {
  bad(`peca "${m.id}" dispara e nao desenha nada` +
      (m.mudo.length ? ` (so ${m.mudo.map((k) => k + ": " + MUDAS[k]).join(", ")})` : ""));
}
for (const id of mudaPaga) bad(`DIVIDA_MUDA."${id}" ja desenha alguma coisa: tire a linha da lista`);
if (!mudaNova.length && !mudaPaga.length) {
  console.log(`ok  pecas mudas: ${mudas.length} conhecida(s), nenhuma nova`);
}

/* --- 2b. irmas visuais --------------------------------------------------- */
const irmas = [...porAssinatura.entries()].filter(([, ids]) => ids.length > 1);
const irmaNova = irmas.filter(([k]) => !(k in DIVIDA_IRMAS));
const irmaPaga = Object.keys(DIVIDA_IRMAS)
  .filter((k) => !irmas.some(([j]) => j === k));
for (const [k, ids] of irmaNova) {
  bad(`assinatura "${k}" e desenhada por ${ids.length} pecas iguais em tela: ` + ids.join(", "));
}
for (const k of irmaPaga) bad(`DIVIDA_IRMAS."${k}" ja nao tem duas pecas: tire a linha da lista`);
if (!irmaNova.length && !irmaPaga.length) {
  const presas = irmas.reduce((n, [, ids]) => n + ids.length, 0);
  console.log(`ok  irmas visuais: ${presas} pecas em ${irmas.length} assinatura(s) repetida(s), nenhuma nova`);
}

/* =========================================================================
   3. TODO EVENTO VISUAL TEM VOZ

   A camada de som nao tem registry proprio: ela consome o MESMO fato que a
   camada de desenho (`game.emitVfx`). E o que garante que uma peca nova nao
   nasca muda — mas so garante enquanto as duas listas fecharem, entao e aqui
   que elas fecham.

   `cast` e `hit` sao os dois fatos que nao tem evento visual: o conjuro nao
   desenha por si (quem desenha e o efeito) e o acerto sem raio so acende o
   flash do inimigo. Eles existem em VOICES sem par em VFX_LIFE, de proposito.
   ========================================================================= */
const SEM_EVENTO = ["cast", "hit", "crit"];

const semVoz = Object.keys(VFX_LIFE).filter((k) => !VOICES[k]);
const vozOrfa = Object.keys(VOICES).filter((k) => !VFX_LIFE[k] && SEM_EVENTO.indexOf(k) < 0);
if (semVoz.length) bad("evento visual sem voz em VOICES: " + semVoz.join(", "));
if (vozOrfa.length) bad("voz sem evento visual que a dispare: " + vozOrfa.join(", "));
if (!semVoz.length && !vozOrfa.length) {
  console.log(`ok  som: ${Object.keys(VFX_LIFE).length} eventos visuais com voz` +
              ` + ${SEM_EVENTO.length} vozes sem evento (${SEM_EVENTO.join(", ")})`);
}

/* =========================================================================
   4. A MORTE

   E o evento mais frequente do jogo e o unico que acontece em leva. As quatro
   perguntas abaixo sao as que separam "o corpo se desfez" de "o corpo sumiu".
   ========================================================================= */

// 4a. todo inimigo se desfaz nas cores DELE
const assinaturas = new Map();
for (const id in ENEMIES) {
  if (!SPRITE_DATA[id]) continue;
  const set = spriteShards(id);
  if (!set.length) { bad(`inimigo "${id}" nao tem estilhaco: a morte dele cai no punhado generico`); continue; }
  const pal = SPRITE_DATA[id].pal;
  const fora = set.filter((c) => !Object.keys(pal).some((k) => pal[k] === c.color));
  if (fora.length) bad(`estilhaco de "${id}" com cor fora da paleta do sprite`);
  const sig = [...new Set(set.map((c) => c.color))].sort().join(",");
  if (!assinaturas.has(sig)) assinaturas.set(sig, []);
  assinaturas.get(sig).push(id);
}
const gemeos = [...assinaturas.values()].filter((ids) => ids.length > 1);
if (gemeos.length) {
  bad("inimigos que se desfazem na MESMA paleta: " + gemeos.map((g) => g.join("=")).join(" · "));
} else {
  console.log(`ok  morte: ${assinaturas.size} paletas de estilhaco distintas, uma por inimigo`);
}

/* 4b. o orcamento. A morte e o unico evento que pode acontecer cinquenta vezes
   no mesmo frame, entao ele e o unico que precisa de um teto duro. */
g.start(STARTER_TESTE);
g.particles.clear();
const alvoOrc = alvos(1)[0];
for (let i = 0; i < SHARD_BUDGET - 4; i++) g.particles.spawn(0, 0, 0, 0, 9, "#ffffff", 1, 0);
const antesOrc = g.particles.active.length;
g.shatterEnemy(alvoOrc, 1);
const excedeu = g.particles.active.length - SHARD_BUDGET;
if (excedeu > 4) bad(`morte estourou o orcamento em ${excedeu} particulas (teto ${SHARD_BUDGET})`);
else console.log(`ok  orcamento: com ${antesOrc}/${SHARD_BUDGET} vivas, a morte so acrescentou ` +
                 (g.particles.active.length - antesOrc));

/* 4c. a ceifa acende numa leva — e UMA vez por degrau, nao uma por corpo. */
function ceifar(n, dtEntre) {
  g.start(STARTER_TESTE);
  g.reapHeat = 0; g.reapTier = 0;
  g.spawner.interval = 1e9;
  const vistos = [];
  const real = g.emitVfx.bind(g);
  g.emitVfx = (kind, x, y, r, color) => { if (kind === "reap") vistos.push(r); return real(kind, x, y, r, color); };
  for (let i = 0; i < n; i++) {
    const e = g.enemies.spawn(ENEMIES.ghoul, g.player.x + 40 + i, g.player.y, g.spawner.scale);
    e.hp = 0;
    g.killDeadEnemies();
    if (dtEntre > 0) { g.clock += dtEntre; g.tickReap(dtEntre); }
  }
  g.emitVfx = real;
  return vistos;
}

const leva = ceifar(60, 0.02);
if (!leva.length) bad("60 abates em ~1,2s nao acenderam a ceifa");
else if (leva.length > BALANCE.reap.tiers.length) {
  bad(`a ceifa anunciou ${leva.length} vezes numa leva so (teto ${BALANCE.reap.tiers.length} degraus)`);
} else {
  console.log(`ok  ceifa: 60 abates em leva -> ${leva.length} anuncio(s), raios ` + leva.join(", "));
}

// 4d. e morte esparsa NAO ceifa: um abate a cada meio segundo e o jogo normal
const esparso = ceifar(14, 0.5);
if (esparso.length) bad(`abate esparso (1 a cada 0,5s) acendeu a ceifa ${esparso.length} vez(es)`);
else console.log("ok  ceifa: abate esparso nao acende — ela mede abates por SEGUNDO");

/* 4e. A CADEIA — a irma em numero da ceifa. Ela mede a mesma coisa (abates por
   tempo) e por isso responde as mesmas duas pontas: leva conta, esparso zera.
   O que so ela tem e a cadencia do salto: uma build madura poe dezenas de
   corpos no chao por segundo, e o numero tem que PULSAR, nao vibrar. */
function encadear(n, dtEntre) {
  g.start(STARTER_TESTE);
  g.spawner.interval = 1e9;
  const saltos = [];
  let anterior = g.comboPulseAt;
  for (let i = 0; i < n; i++) {
    const e = g.enemies.spawn(ENEMIES.ghoul, g.player.x + 40 + i, g.player.y, g.spawner.scale);
    e.hp = 0;
    g.killDeadEnemies();
    if (g.comboPulseAt !== anterior) { saltos.push(g.comboPulseAt); anterior = g.comboPulseAt; }
    if (dtEntre > 0) { g.clock += dtEntre; g.tickCombo(); }
  }
  return { n: g.comboCount, best: g.comboBest, saltos };
}

const C = BALANCE.combo;
if (C.size.length !== C.tiers.length + 1 || C.swell.length !== C.tiers.length + 1) {
  bad(`combo: ${C.tiers.length} degraus pedem ${C.tiers.length + 1} tamanhos e saltos, ` +
      `tem ${C.size.length} e ${C.swell.length}`);
}

const cadeia = encadear(30, C.window * 0.5);
if (cadeia.n !== 30) bad(`cadeia: 30 abates dentro da janela contaram ${cadeia.n}`);
else console.log(`ok  cadeia: 30 abates a ${C.window * 0.5}s de distancia -> ${cadeia.n}, degrau ${g.comboTier()}`);

// o recorde e o que denuncia: se a janela estivesse deixando passar, oito
// abates espacados teriam encadeado em algum momento
const quebrada = encadear(8, C.window * 1.5);
if (quebrada.best !== 1) bad(`cadeia: abate a cada ${C.window * 1.5}s encadeou ate ${quebrada.best}`);
else console.log(`ok  cadeia: intervalo maior que a janela zera a conta (recorde ${quebrada.best})`);

/* O salto tem cadencia pelo mesmo motivo que o hitstop tem: sem ela, cem
   abates por segundo rearmam o salto no meio dele mesmo e o numero para de
   voltar ao tamanho normal — vira um numero grande tremendo, nao um pulso. */
const denso = encadear(100, 0.01);
const teto = Math.ceil(100 * 0.01 / C.pulse) + 1;
if (denso.saltos.length > teto) {
  bad(`cadeia: 100 abates em 1s deram ${denso.saltos.length} saltos (teto ${teto} pela cadencia)`);
} else {
  console.log(`ok  cadeia: 100 abates em 1s -> ${denso.saltos.length} salto(s), nao 100`);
}
for (let i = 1; i < denso.saltos.length; i++) {
  if (denso.saltos[i] - denso.saltos[i - 1] < C.pulse - 1e-9) {
    bad("cadeia: um salto rearmou antes de o anterior terminar");
    break;
  }
}

// e o que a tela mostra: numero, degrau e pavio saem do estado, e abaixo de
// `min` nada sobe — dois abates seguidos sao o normal deste jogo.
g.ui.comboShown = 0; g.ui.comboTierShown = -1;
g.comboCount = C.min - 1; g.comboUntil = g.clock + C.window;
g.ui.updateCombo();
if (g.ui.comboShown) bad(`cadeia: ${C.min - 1} abates ja acenderam o contador (min ${C.min})`);
g.comboCount = C.tiers[C.tiers.length - 1];
g.comboPulseAt = g.clock;
g.ui.updateCombo();
const mostrado = "" + g.ui.el.comboNum.textContent;
const tam = g.ui.el.combo.style.getPropertyValue("--combo-sz");
const salto = g.ui.el.comboNum.style.transform;
if (mostrado !== "" + g.comboCount) bad(`cadeia: a tela mostra "${mostrado}" e a conta e ${g.comboCount}`);
else if (tam !== C.size[C.size.length - 1] + "px") bad(`cadeia: degrau final devia medir ${C.size[C.size.length - 1]}px, mediu "${tam}"`);
else if (!/scale\(/.test(salto)) bad("cadeia: o quadro do abate nao escreveu salto nenhum");
else console.log(`ok  cadeia na tela: ${mostrado} em ${tam}, salto ${salto}`);

/* =========================================================================
   5. O GERADOR DE FORMAS

   `bloom` e a explosao que ja estava no jogo, extraida para dentro do gerador.
   A extracao foi mecanica de proposito, e o hash abaixo e a prova: uma forma
   nova nao pode mexer, de raspao, na forma que dezesseis pecas ja usam.

   O valor de referencia foi tirado do gerador ANTERIOR (antes da extracao),
   sobre as 5 grades x 3 variantes x 8 quadros. Se ele mudar, ou a extracao
   nao foi fiel ou alguem re-tunou a explosao — e as duas coisas precisam ser
   uma decisao, nao um efeito colateral.
   ========================================================================= */
const GOLDEN_BLOOM = "d95f4554";

function hashField(f) {
  let h = 2166136261;
  for (let i = 0; i < f.length; i++) { h ^= f[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
const amostras = [];
for (const G of EXPLO.GRIDS) {
  for (let v = 0; v < EXPLO.VARIANTS; v++) {
    for (let f = 0; f < EXPLO.FRAMES; f++) amostras.push(hashField(fxField("bloom", v, f, G)));
  }
}
let hb = 2166136261;
for (const a of amostras) for (let i = 0; i < a.length; i++) { hb ^= a.charCodeAt(i); hb = Math.imul(hb, 16777619); }
const bloomHash = (hb >>> 0).toString(16);
if (bloomHash !== GOLDEN_BLOOM) {
  bad(`o campo do "bloom" mudou: ${bloomHash} (esperado ${GOLDEN_BLOOM}) — a explosao do jogo nao e mais a mesma`);
} else {
  console.log(`ok  gerador: "bloom" identico ao de antes da extracao (${amostras.length} quadros)`);
}

/* Toda forma precisa existir de verdade, e precisa ser OUTRA forma. Duas
   coisas separadas: um arquetipo pode nascer vazio (curva errada, limiar que
   nunca acende) ou nascer igual ao vizinho — e ai o catalogo continuaria com
   uma silhueta so, que e o defeito que a fase inteira existe para consertar. */
const G0 = EXPLO.GRID;
const perfil = new Map();
for (const shape in FX_SHAPES) {
  const vivos = [], quentes = [];
  for (let f = 0; f < EXPLO.FRAMES; f++) {
    const campo = fxField(shape, 0, f, G0);
    let n = 0, q = 0;
    for (let i = 0; i < campo.length; i++) {
      if (campo[i] === 255) continue;
      n++;
      if (campo[i] <= 1) q++;          // bandas 0 e 1: o que ainda esta quente
    }
    vivos.push(n); quentes.push(q);
  }
  if (vivos.every((n) => n < 20)) bad(`forma "${shape}" nasce vazia: ${vivos.join("/")}`);
  /* E toda forma tem que ESFRIAR. O que se mede e a area QUENTE (bandas 0 e
     1), nao a area acesa: o `bloom` termina em arcos rasgados que ainda ocupam
     muita celula, e e certo que ocupem — o que nao pode e continuar branco no
     ultimo quadro. Evento que termina no proprio pico e cortado pelo fim da
     vida em vez de se dissipar, que e a diferenca entre energia sumindo e
     alguem apagando o desenho. */
  const pico = Math.max(...quentes);
  const fim = quentes[quentes.length - 1];
  if (pico > 0 && fim > pico * 0.25) {
    bad(`forma "${shape}" nao esfria: termina com ${fim} celulas quentes de um pico de ${pico}`);
  }
  const meio = hashField(fxField(shape, 0, 4, G0));
  if (perfil.has(meio)) bad(`"${shape}" e "${perfil.get(meio)}" desenham o MESMO campo`);
  perfil.set(meio, shape);
  console.log(`      ${shape.padEnd(8)} ${vivos.join("/")} celulas · quentes ${quentes.join("/")}`);
}
if (perfil.size === Object.keys(FX_SHAPES).length) {
  console.log(`ok  gerador: ${perfil.size} formas distintas, nenhuma vazia`);
}

// e o cache continua sendo por (forma, cor, grade)
const antesCache = FX_SETS.size;
const s1 = fxFrames("nova", "#7fdc4a", G0);
if (fxFrames("nova", "#7fdc4a", G0) !== s1) bad("fxFrames remonta o mesmo conjunto");
fxFrames("nova", "#7fdc4a", 24);
if (FX_SETS.size !== antesCache + 2) bad("cache de forma nao separa por grade");

/* =========================================================================
   6. O TELEGRAFO E O ATRASO SAO O MESMO NUMERO

   `tell` no efeito adia o golpe; `VFX_LIFE.tell` e quanto o anel leva para
   fechar. Se os dois divergirem o aviso mente — o anel fecha e nada acontece,
   ou o golpe cai com o anel ainda aberto. Nao ha como um derivar do outro (um
   e dado de conteudo, o outro e dado de render), entao o que resta e cobrar a
   igualdade.
   ========================================================================= */
const telegrafos = [];
function varrerTell(list, dono, depth) {
  if (!list || depth > 4) return;
  for (const e of list) {
    if (!e) continue;
    if (e.tell > 0) telegrafos.push({ dono, tell: e.tell });
    varrerTell(e.onHit, dono, depth + 1);
    varrerTell(e.onTick, dono, depth + 1);
    varrerTell(e.onExpire, dono, depth + 1);
    varrerTell(e.effects, dono, depth + 1);
  }
}
for (const id in PIECES) varrerTell(PIECES[id].effects, id, 0);
const desalinhado = telegrafos.filter((t) => t.tell !== VFX_LIFE.tell);
if (desalinhado.length) {
  bad("telegrafo com atraso diferente da vida do anel: " +
      desalinhado.map((t) => `${t.dono} (${t.tell} != ${VFX_LIFE.tell})`).join(", "));
} else if (telegrafos.length) {
  console.log(`ok  telegrafo: ${telegrafos.length} efeito(s) adiado(s), todos casados com VFX_LIFE.tell`);
}

/* --- placar -------------------------------------------------------------- */
const total = Object.keys(PIECES).length;
const distintas = porAssinatura.size;
console.log(`--  placar: ${total} pecas · ${distintas} assinaturas distintas · ` +
            `${mudas.length} mudas · ${achadas.size} cores fora da paleta · ` +
            `${Object.keys(VOICES).length} vozes`);
for (const [k, ids] of irmas.sort((a, b) => b[1].length - a[1].length)) {
  console.log(`      ${String(ids.length).padStart(2)}x  ${k || "(nada)"}`);
}

if (fails) { console.error(`\nFALHOU: ${fails} problema(s) de vfx`); __exit(1); }
console.log("ok  vfx integro");
