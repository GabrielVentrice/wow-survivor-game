/* =========================================================================
   BENCH — o banco de provas: a peca sozinha, em cenario controlado.

   `driver_balance` responde "esta RUN funciona?". Ele nao responde "esta PECA
   faz muito ou pouco dano?", e nao pode: o que ele mede passa por um bot que
   se posiciona, por uma curva de XP, por um sorteio de oferta e por 44 pecas
   dividindo o mesmo funil. Uma peca que aparece com 0,4% de share pode estar
   quebrada, pode ter sido comprada tarde ou pode simplesmente nunca ter caido
   na mesa — e a tabela dele nao distingue os tres casos. A lista NUNCA
   ESCOLHIDA e a prova: hoje ela mistura "o sorteio nao ofereceu" com "nao faz
   nada", e as duas exigem consertos opostos.

   Aqui a run inteira sai da conta. Cada celula e um mundo montado a mao: o
   spawner desligado, N dummies em posicao conhecida, o jogador imortal e com
   UMA peca na build. O que sobra e o numero que a peca produz, e ele e
   comparavel entre pecas porque todas veem exatamente o mesmo campo.

   Tres decisoes que sao o que separa isto de "rodar o jogo mais rapido":

   - **O banco COMPRA o gate de eixo.** Ele credita os 10 pontos que o tier 5
     pede e nunca chama `checkCapstones`. O assunto e dano, nao economia — quem
     mede se o jogador CHEGA ao tier 5 e `driver_milestone` e `driver_balance`,
     e misturar as duas perguntas e o que faz a resposta nao servir para
     nenhuma das duas.
   - **Cenario e dado, nao codigo** (mesma regra do resto do projeto). Cenario
     novo e uma entrada em `SCENARIOS`; a matriz cresce sozinha.
   - **Ele reusa `Game`, nao reimplementa a matematica.** Uma planilha de dano
     seria mais rapida e seria uma segunda lista para divergir da primeira —
     exatamente o defeito que o projeto ja documenta em paleta, em voz e em
     galeria. O que o banco corta e a HORDA, nao o motor: o custo do frame
     mora no `SpatialGrid` sobre 4400 corpos (medido: 40% do tempo), entao 40
     dummies custam um centesimo disso e o motor continua sendo o mesmo.

   E o que ele REPROVA (senao seria um relatorio, nao um driver):

   - peca de dano que nao causa dano em cenario nenhum — a que hoje so aparece
     como um zero ambiguo no `driver_balance`;
   - caminho fechado que rende MENOS que a peca recem-comprada: um tier que
     piorou a peca. Ninguem le 645 tiers a procura disso.

   Uso:
     DRIVER=driver_bench.js node tools/harness.js .            # matriz padrao
     DRIVER=driver_bench.js node tools/harness.js . 20 full    # 20s/celula, 3 caminhos
     DRIVER=driver_bench.js node tools/harness.js . 15 "" corruption   # so um eixo
   ========================================================================= */

const SIM = Number(__argv[1] || 12);          // segundos de jogo por celula
const FULL = (__argv[2] || "") === "full";    // mede os tres caminhos, nao so o A
const ONLY_AXIS = __argv[3] || "";            // filtra por eixo, para iterar rapido

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

/* --- os cenarios ---------------------------------------------------------
   `place` diz a forma do campo, `move` diz se o corpo anda, `hp` diz se ele
   pode morrer. As tres juntas sao o que separa uma peca de outra: quem mira
   sozinha rende igual em todo cenario, quem bate em area so rende no
   aglomerado, e quem depende de abate so rende onde o corpo cai. */
const SCENARIOS = [
  { id: "alvo",   label: "alvo unico",   n: 1,  place: "single", dist: 150,
    type: "skeleton", hp: "imortal", move: "pin",   player: "parado" },
  /* O aglomerado fica EM VOLTA do jogador e nao a 190 unidades dele. Na
     primeira versao ele era um bolo distante, e o resultado foi uma coluna
     identica a do alvo unico em metade do catalogo: o bolo estava fora do raio
     de quase toda peca, entao o que a coluna media era alcance e nao area.
     Nesta horda o aglomerado E o cerco — a peca de area precisa ver corpo
     dentro do raio dela para dizer alguma coisa. */
  { id: "grupo",  label: "aglomerado",   n: 24, place: "around", dist: 115, spread: 55,
    type: "ghoul",    hp: "imortal", move: "pin",   player: "parado" },
  { id: "cerco",  label: "cerco andando", n: 40, place: "ring",  dist: 300,
    type: "ghoul",    hp: "imortal", move: "chase", player: "circulo" },
  { id: "leva",   label: "leva mortal",  n: 40, place: "ring",   dist: 260,
    type: "ghoul",    hp: 3.0,       move: "chase", player: "parado", respawn: true },
  /* O campo de ATIRADORES existe porque uma familia inteira de pecas so
     responde a projetil inimigo — `netherWard` desmancha o que entra no raio,
     e sem uma Inquisidora em campo ela mede zero em todo cenario e parece
     quebrada. Aqui tambem e o unico lugar do banco em que o jogador toma dano
     a distancia, que e o gatilho de metade das pecas `reactive`. */
  { id: "tiro",   label: "atiradores",   n: 12, place: "ring",   dist: 330,
    type: "inquisitor", hp: "imortal", move: "pin", player: "parado" },
  /* O chefe e MORTAL e com HP de fim de run, e a diferenca importa: com alvo
     imortal a coluna dele era copia da do alvo unico, e toda peca de execucao
     (`enemy_below`) media zero porque nada nunca fica com pouca vida. */
  { id: "chefe",  label: "chefe",        n: 1,  place: "single", dist: 200,
    type: "dreadlord", hp: 8.0,      move: "pin",  player: "parado" },
];

/* --- as configuracoes de build ------------------------------------------
   `base` e o que a peca entrega no instante em que e comprada; `<caminho>5` e
   ela com um caminho fechado. As duas juntas dizem quanto o investimento
   compra — que e a pergunta que a tela de level up faz. */
function configs(def) {
  const out = [{ id: "base", path: null }];
  const paths = Object.keys(def.paths || {});
  if (FULL) for (const p of paths) out.push({ id: p + "5", path: p });
  else if (paths.length) out.push({ id: paths[0] + "5", path: paths[0] });
  return out;
}

/* --- uma celula ----------------------------------------------------------
   Mundo novo a cada celula. Reaproveitar o `Game` seria mais rapido e
   contaminaria a medicao: DoT no ar, demonio vivo e calor da ceifa
   atravessariam para a peca seguinte. */
function cell(pieceId, cfg, sc, seed) {
  // pieceId nulo = a celula de referencia: so o kit, mesmo campo, mesma seed
  let s = seed >>> 0;
  Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

  const g = new Game();
  window.game = g;
  // as tres telas param o `update`; aqui nenhuma delas e o assunto
  g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
  g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
  g.ui.openChest = () => { g.state = STATE.PLAYING; };
  g.start();

  // o spawner sai: a populacao e a do cenario, e so ela
  g.spawner.update = () => {};

  /* O KIT INICIAL FICA, e isso custou uma rodada para ser aprendido.

     A primeira versao limpava a build para deixar UMA peca em campo, e o
     resultado foi um bloco de zeros: `shadowburn` (executa quem ja esta com
     pouca vida), `soulLeech` (reage a acerto) e toda peca `reactive` nao tem
     como disparar sem alguem batendo antes. Isso nao e a peca sendo fraca — e
     o banco tendo montado um mundo que o jogo NUNCA entrega: `CLASSES.warlock.
     starting` da `incinerate` de graca em toda run, entao uma peca reativa
     sempre tem um gatilho em campo. Medir sem ele e medir uma situacao
     impossivel.

     O que mantem o numero limpo nao e a build vazia, e a `key`: `damageBy` e
     por fonte, entao o dano do kit nunca entra na conta da peca sob teste. */

  const def = pieceId ? PIECES[pieceId] : null;
  if (!def) return runField(g, sc, null);
  // o gate de eixo, comprado de uma vez (ver o cabecalho)
  g.build.addAxis(def.axis, AXIS_RULES.hybridMain);

  /* `requires` tambem e honrado, pelo mesmo argumento: o jogo NAO oferece
     Conflagrate sem um DoT na build (e um gate de oferta), entao medi-la sem
     habilitadora mede uma build que nao existe. A habilitadora entra crua — o
     que se quer dela e a condicao, nao dano. */
  if (def.requires) {
    const en = Object.keys(PIECES).find((x) => {
      const d = PIECES[x];
      if (x === pieceId || d.evolutionOnly || d.requires) return false;
      if (def.requires.piece) return x === def.requires.piece;
      return (d.tags || []).includes(def.requires.tag);
    });
    if (en) { g.build.addAxis(PIECES[en].axis, AXIS_RULES.hybridMain); g.build.acquirePiece(en, true); }
  }

  const inst = g.build.acquirePiece(pieceId, true) || g.build.pieces.get(def.key);
  if (!inst) return null;
  if (cfg.path) {
    for (let t = 0; t < PATH_RULES.tiers; t++) {
      if (!g.build.canUpgradePath(inst, cfg.path)) break;
      g.build.upgradePath(inst, cfg.path);
    }
  }
  const key = inst.key;

  return runField(g, sc, key);
}

/* --- o campo e o passo --------------------------------------------------- */
function runField(g, sc, key) {
  const type = ENEMIES[sc.type];
  const scale = { hp: sc.hp === "imortal" ? 1 : sc.hp, dmg: 1, speed: 1 };
  const slots = [];
  for (let i = 0; i < sc.n; i++) {
    let x, y;
    if (sc.place === "single") { x = sc.dist; y = 0; }
    else if (sc.place === "ring") {
      const a = (i / sc.n) * Math.PI * 2;
      x = Math.cos(a) * sc.dist; y = Math.sin(a) * sc.dist;
    } else if (sc.place === "around") { // cerco parado: corpo colado no jogador
      const a = (i / sc.n) * Math.PI * 2 * 2.4;
      const r = sc.dist - (i / sc.n) * sc.spread;
      x = Math.cos(a) * r; y = Math.sin(a) * r;
    } else { // clump: um bolo compacto a `dist` do jogador
      const a = (i / sc.n) * Math.PI * 2 * 3.7, r = (i / sc.n) * sc.spread;
      x = sc.dist + Math.cos(a) * r; y = Math.sin(a) * r;
    }
    slots.push({ x, y });
  }
  const place = (slot) => {
    const e = g.enemies.spawn(type, slot.x, slot.y, scale);
    if (sc.hp === "imortal") { e.maxHp = e.hp = 1e9; }
    if (sc.move === "pin") { e.baseSpeed = 0; e.speed = 0; }
    return e;
  };
  for (const slot of slots) place(slot);

  const keys = new Set();
  const steps = Math.round(SIM * 60);
  const before = g.player.kills;
  for (let i = 0; i < steps; i++) {
    // o jogador nao pode morrer: o assunto e o dano de saida, e uma celula que
    // termina em game over mede quanto tempo ele aguentou, nao quanto ele bateu
    g.player.hp = g.player.maxHp;
    if (sc.player === "circulo") {
      const t = i / 60;
      const dx = Math.cos(t * 1.1), dy = Math.sin(t * 1.1);
      keys.clear();
      if (dx > 0.35) keys.add("d"); else if (dx < -0.35) keys.add("a");
      if (dy > 0.35) keys.add("s"); else if (dy < -0.35) keys.add("w");
    }
    g.input.keys = keys;
    g.update(1 / 60);
    // repoe o campo: sem isso o cenario mortal mede a peca contra uma tela que
    // vai esvaziando, e o dps cai por falta de alvo em vez de por falta de peca
    if (sc.respawn && g.enemies.active.length < sc.n) {
      for (let k = g.enemies.active.length; k < sc.n; k++) place(slots[k % slots.length]);
    }
  }

  /* `dano` sai da `key` e por isso ignora o kit; `abates` e do campo inteiro e
     por isso e reportado como DELTA sobre a celula de referencia — sem a
     subtracao, toda peca herdaria os abates que o kit faria sozinha. */
  return {
    dps: key ? (g.damageBy.get(key) || 0) / SIM : 0,
    kps: (g.player.kills - before) / SIM,
    // se a build resolvida nao tem nenhum efeito que cause dano, a peca nao e
    // de dano — e essa pergunta se responde pelo MECANISMO e nao pela tag
    hurts: key ? buildHurts(g, key) : false,
  };
}

/* Um efeito causa dano se ele mesmo causa, ou se algum efeito aninhado causa.
   Ler a lista resolvida (`inst.r`) e nao a do catalogo e o que faz o teste
   valer para o tier 5: um caminho pode acrescentar o dano por patch. */
const HURT_TYPES = ["damage_instant", "damage_over_time", "execute", "projectile",
                    "area_persistent", "chain", "summon", "spread_on_death"];
function effHurts(list) {
  if (!list) return false;
  for (const e of list) {
    if (!e) continue;                       // a lista e ESPARSA (ver CLAUDE.md)
    if (HURT_TYPES.includes(e.type)) return true;
    /* `reflect` desmancha projetil, e so causa dano se um tier comprou isso
       (`recoil` do Nether Ward). Contar o tipo sozinho classificaria um escudo
       como peca de dano e reprovaria o caminho que nunca prometeu dano — foi
       o unico falso positivo que sobrou depois do kit e do `requires`. */
    if (e.type === "reflect" && e.damage > 0) return true;
    for (const k of ["effects", "onHit", "onExpire", "then"]) {
      if (Array.isArray(e[k]) && effHurts(e[k])) return true;
    }
  }
  return false;
}
function buildHurts(g, key) {
  const inst = g.build.pieces.get(key);
  return !!(inst && inst.r && effHurts(inst.r.effects));
}

/* --- a matriz ------------------------------------------------------------ */
const ids = Object.keys(PIECES).filter((id) => {
  const d = PIECES[id];
  if (d.evolutionOnly) return false;             // chega por evolucao, e medida no tier 5
  if (ONLY_AXIS && d.axis !== ONLY_AXIS) return false;
  return true;
});

const t0 = __now();
const rows = [];
let cells = 0;

/* A REFERENCIA: o mesmo campo, a mesma seed, so o kit inicial. Sem ela os
   abates de toda peca vem inflados pelo que `incinerate` faria sozinha, e uma
   peca que nao mata ninguem apareceria matando. Uma por cenario, e nao uma por
   peca, porque a build de referencia e sempre a mesma. */
const BASE = {};
for (let i = 0; i < SCENARIOS.length; i++) {
  BASE[SCENARIOS[i].id] = cell(null, null, SCENARIOS[i], 1000 + (i * 7919) % 100000);
  cells++;
}
for (const id of ids) {
  const def = PIECES[id];
  for (const cfg of configs(def)) {
    const r = { id, axis: def.axis, cfg: cfg.id, by: {} };
    let seed = 0;
    for (const sc of SCENARIOS) {
      // seed por (peca, config, cenario): a mesma celula da o mesmo numero em
      // toda rodada, entao duas execucoes sao comparaveis linha a linha
      // a seed sai do INDICE do cenario e nao do contador de celulas: com o
      // contador, cada peca via um sorteio diferente e a comparacao entre
      // linhas media metade peca e metade mao
      const idx = SCENARIOS.indexOf(sc);
      const out = cell(id, cfg, sc, 1000 + (idx * 7919) % 100000);
      cells++;
      if (out) {
        out.dkps = out.kps - (BASE[sc.id] ? BASE[sc.id].kps : 0);
        r.by[sc.id] = out;
      }
    }
    rows.push(r);
  }
}
const ms = __now() - t0;

/* --- saida --------------------------------------------------------------- */
const n = (v) => (v == null ? "     -" : v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0));
const W = 20;

console.log(`\nDANO POR SEGUNDO — ${cells} celulas de ${SIM}s em ${(ms / 1000).toFixed(1)}s\n`);
console.log("  " + "peca".padEnd(W) + "cfg".padEnd(6) +
  SCENARIOS.map((s) => s.label.slice(0, 8).padStart(9)).join("") + "   +abates/s");
for (const r of rows) {
  const line = SCENARIOS.map((s) => n(r.by[s.id] && r.by[s.id].dps).padStart(9)).join("");
  // abates ACIMA da referencia: o que esta peca acrescenta ao que o kit ja fazia
  const leva = r.by.leva ? r.by.leva.dkps.toFixed(1) : "-";
  console.log("  " + r.id.slice(0, W - 1).padEnd(W) + r.cfg.padEnd(6) + line +
    "   " + String(leva).padStart(6));
}

/* Onde a peca RENDE. Dano absoluto ordena por eixo e por tier; o perfil diz o
   que a peca e — e e ele que responde "por que esta peca parece fraca". */
console.log("\nPERFIL (fracao do dano da peca que sai em cada cenario)");
for (const r of rows) {
  if (r.cfg === "base") continue;
  const tot = SCENARIOS.reduce((a, s) => a + ((r.by[s.id] && r.by[s.id].dps) || 0), 0);
  if (tot <= 0) continue;
  const bars = SCENARIOS.map((s) => {
    const f = ((r.by[s.id] && r.by[s.id].dps) || 0) / tot;
    return "·:+*#"[Math.min(4, Math.floor(f * 5))] + "";
  }).join("");
  console.log("  " + r.id.slice(0, W - 1).padEnd(W) + r.cfg.padEnd(6) + bars +
    "   " + n(tot / SCENARIOS.length) + " dps medio");
}

/* --- as duas reprovacoes -------------------------------------------------- */
console.log("");
const mudas = [];
for (const r of rows) {
  if (r.cfg === "base") continue;
  // "peca de dano" sai do MECANISMO: a build resolvida tem algum efeito que
  // causa dano? Tag envelhece (`reactive` cobre tanto Shadowburn quanto o
  // escudo do Soul Leech) e classificaria escudo e maldicao como dano.
  if (!SCENARIOS.some((s) => r.by[s.id] && r.by[s.id].hurts)) continue;
  /* Peca gatilhada por vida BAIXA nao tem como medir aqui, e a culpa e do
     banco: o jogador dele e imortal por contrato (`hp = maxHp` a cada passo),
     entao `player_below` nunca vira verdade. Reprovar por isso seria o driver
     cobrando da peca um estado que ele proprio se recusa a produzir — e o
     conserto nao e tirar a imortalidade, que e o que mantem as 450 celulas
     comparaveis entre si. Quem mede essas duas e `driver_autopsy`. */
  const def = PIECES[r.id];
  if (def && def.trigger.condition === "player_below") continue;
  const tot = SCENARIOS.reduce((a, s) => a + ((r.by[s.id] && r.by[s.id].dps) || 0), 0);
  if (tot <= 0) mudas.push(r.id + " (" + r.cfg + ")");
}
if (mudas.length) fail(`peca de dano com caminho fechado que nao causa dano nenhum: ${mudas.join(", ")}`);
else console.log("  ok toda peca de dano com caminho fechado causa dano em algum cenario");

const piores = [];
for (const r of rows) {
  if (r.cfg === "base") continue;
  const b = rows.find((x) => x.id === r.id && x.cfg === "base");
  if (!b) continue;
  const soma = (row) => SCENARIOS.reduce((a, s) => a + ((row.by[s.id] && row.by[s.id].dps) || 0), 0);
  const fechado = soma(r), cru = soma(b);
  // 10% de folga: a evolucao pode trocar o perfil da peca (area por alvo unico)
  // e sair de raspao atras num campo que nao e o dela. Abaixo disso e regressao.
  if (cru > 0 && fechado < cru * 0.9) piores.push(`${r.id} ${r.cfg}: ${fechado.toFixed(0)} < base ${cru.toFixed(0)}`);
}
if (piores.length) fail(`caminho fechado rende MENOS que a peca crua: ${piores.join("; ")}`);
else console.log("  ok todo caminho fechado rende ao menos tanto quanto a peca crua");

if (fails) { console.error(`\n${fails} falha(s)`); __exit(1); }
console.log(`\nok banco: ${rows.length} builds x ${SCENARIOS.length} cenarios ` +
  `(+${SCENARIOS.length} de referencia)`);
