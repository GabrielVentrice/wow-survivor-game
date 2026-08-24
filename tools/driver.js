// --- valida o registry antes de simular -----------------------------------

let problems = 0;
const bad = (m) => { console.error("  X " + m); problems++; };

const walkEffects = (list, where) => {
  if (!list) return;
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    if (e.type && !EFFECTS[e.type]) bad(`${where}: efeito desconhecido "${e.type}"`);
    for (const k of ["onHit", "onTick", "onExpire", "onEnd", "effects"]) {
      if (e[k]) walkEffects(e[k], where + "." + k);
    }
    if (e.projectile) walkEffects([e.projectile], where + ".projectile");
    if (e.type === "hook" && !HOOKS[e.name]) bad(`${where}: hook desconhecido "${e.name}"`);
    if (e.type === "summon" && e.kind && !MINIONS[e.kind]) bad(`${where}: minion desconhecido "${e.kind}"`);
  }
};

/* Paleta: uma build e uma familia de cor. Sem isso a regra vira convencao e
   volta a apodrecer — a cor de uma peca nova sai do eixo dela ou nao entra. */
const hueOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return -1;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const paletteOf = (axis) => Object.values((AXES[axis] || {}).palette || {});
const checkColors = (obj, where, pal) => {
  if (!obj || typeof obj !== "object") return;
  for (const k in obj) {
    const v = obj[k];
    if (k === "color" && typeof v === "string" && v[0] === "#") {
      if (pal.indexOf(v) < 0) bad(`${where}.color "${v}" fora da paleta do eixo`);
    } else if (v && typeof v === "object") checkColors(v, where + "." + k, pal);
  }
};

/* Toda paleta de eixo tem tres tons e o `color` e o base. Isso vale para a
   uniao inteira: e contrato de dado, nao de classe. */
for (const id in AXES) {
  const pal = paletteOf(id);
  if (pal.length !== 3) bad(`eixo ${id}: paleta com ${pal.length} tons (esperado 3)`);
  if (AXES[id].color !== (AXES[id].palette || {}).base) {
    bad(`eixo ${id}: color nao e o tom base da paleta`);
  }
}

/* A regra de matiz e POR CLASSE, e virou por classe por geometria e nao por
   gosto. Com corruption em 98, dominion em 266 e cataclysm em 24, sobra UM
   unico ponto no circulo a 60 graus dos tres — seis familias globais nao
   cabem, nao sao dificeis. O que precisa ficar longe e o que aparece na MESMA
   tela, e uma run e uma classe: sao os tres eixos dela.

   Cada classe tambem precisa ter exatamente tres, e eixo sem dono e peso morto
   pela mesma razao que cor de materia sem uso e — a uniao estaria dizendo que
   o jogo tem um eixo que ele nao tem. */
const usados = new Set();
for (const cid in CLASSES) {
  const cls = CLASSES[cid];
  /* Placeholder de menu (o mago) nao declara eixo e nao precisa: ele nao tem
     catalogo e `available: false` o mantem fora de toda run. O que a regra
     cobra e que classe JOGAVEL tenha os tres — sem eles, `build.reset` monta um
     contador vazio e a run inteira fica sem eixo. */
  if (!cls.axes) { if (cls.available) bad(`classe jogavel ${cid}: sem \`axes\``); continue; }
  if (cls.axes.length !== 3) bad(`classe ${cid}: ${cls.axes.length} eixos (esperado 3)`);
  for (const a of cls.axes) {
    if (!AXES[a]) { bad(`classe ${cid}: eixo inexistente "${a}"`); continue; }
    usados.add(a);
  }
  for (let i = 0; i < cls.axes.length; i++) {
    for (let j = i + 1; j < cls.axes.length; j++) {
      const A = AXES[cls.axes[i]], B = AXES[cls.axes[j]];
      if (!A || !B) continue;
      const gap = hueGap(hueOf(A.color), hueOf(B.color));
      if (gap < 60) {
        bad(`${cid}: ${cls.axes[i]} x ${cls.axes[j]} com so ${gap.toFixed(0)} graus de matiz — as builds se confundem`);
      }
    }
  }
}
for (const id in AXES) if (!usados.has(id)) bad(`eixo ${id}: nenhuma classe o usa`);

/* Um eixo pertence a UMA classe. Duas classes dividindo eixo fariam o catalogo
   vazar de uma para a outra sem que `cls` percebesse: a oferta filtra por
   classe, mas o capstone le `req` contra o contador de eixo. */
const donoDoEixo = {};
for (const cid in CLASSES) {
  for (const a of CLASSES[cid].axes || []) {
    if (donoDoEixo[a]) bad(`eixo ${a}: usado por ${donoDoEixo[a]} e ${cid}`);
    else donoDoEixo[a] = cid;
  }
}

/* `cls` explicito em toda entrada, sem default implicito: default e a coisa que
   envelhece calada — a peca de uma classe nova sem o campo cairia no catalogo
   da outra e ninguem veria. */
const daClasse = (def, id, tipo) => {
  if (!def.cls) { bad(`${tipo} ${id}: sem \`cls\``); return null; }
  if (!CLASSES[def.cls]) { bad(`${tipo} ${id}: cls inexistente "${def.cls}"`); return null; }
  return CLASSES[def.cls];
};
const noEixoDaClasse = (cls, axis) => cls && (cls.axes || []).indexOf(axis) >= 0;

for (const id in PIECES) {
  const p = PIECES[id];
  if (!p.key) bad(`${id}: sem key`);
  if (!AXES[p.axis]) bad(`${id}: axis invalido "${p.axis}"`);
  const pc = daClasse(p, id, "peca");
  if (pc && !noEixoDaClasse(pc, p.axis)) {
    bad(`${id}: axis "${p.axis}" nao pertence a classe ${p.cls}`);
  }
  if (!TRIGGERS[p.trigger.type]) bad(`${id}: trigger desconhecido "${p.trigger.type}"`);
  if (!p.paths || Object.keys(p.paths).length !== 3) bad(`${id}: precisa de 3 caminhos`);
  for (const pid in p.paths || {}) {
    const pth = p.paths[pid];
    if (!pth.tiers || pth.tiers.length !== PATH_RULES.tiers) {
      bad(`${id}.${pid}: ${pth.tiers ? pth.tiers.length : 0} tiers (esperado ${PATH_RULES.tiers})`);
    }
    if (pth.evolvesInto) {
      const evo = PIECES[pth.evolvesInto];
      if (!evo) bad(`${id}.${pid}: evolui para "${pth.evolvesInto}" inexistente`);
      else {
        if (evo.key !== p.key) bad(`${id}.${pid}: evolucao ${evo.id} tem key "${evo.key}" != "${p.key}"`);
        if (evo.cls !== p.cls) bad(`${id}.${pid}: evolucao ${evo.id} e da classe "${evo.cls}", nao de "${p.cls}"`);
        for (const k in p.paths) if (!evo.paths[k]) bad(`${evo.id}: falta o caminho "${k}" da forma base`);
      }
    }
    for (const t of pth.tiers || []) {
      if (!t.name) bad(`${id}.${pid}: tier sem nome`);
      if (t.mods) for (const k in t.mods) {
        if (!(k in p.stats)) bad(`${id}.${pid}/${t.name}: mod no stat inexistente "${k}"`);
      }
    }
  }
  walkEffects(p.effects, id);
  if (AXES[p.axis]) checkColors(p, id, paletteOf(p.axis));
  const rq = p.requires;
  if (rq) {
    if (rq.piece && !Object.values(PIECES).some((o) => o.key === rq.piece && o.cls === p.cls)) {
      bad(`${id}: requires.piece "${rq.piece}" nao e key de nenhuma peca`);
    }
    if (rq.tag && !Object.values(PIECES).some((o) => (o.tags || []).indexOf(rq.tag) >= 0 && o.key !== p.key && o.cls === p.cls)) {
      bad(`${id}: requires.tag "${rq.tag}" nao existe em nenhuma outra peca`);
    }
  }
}
for (const id in PASSIVES) {
  daClasse(PASSIVES[id], id, "passiva");
  const on = PASSIVES[id].on || {};
  for (const ev in on) if (!HOOKS[on[ev]]) bad(`passiva ${id}: hook "${on[ev]}" nao existe`);
}
for (const id in CAPSTONES) {
  const c = CAPSTONES[id];
  const on = c.on || {};
  for (const ev in on) if (!HOOKS[on[ev]]) bad(`capstone ${id}: hook "${on[ev]}" nao existe`);
  const cc = daClasse(c, id, "capstone");
  if (!AXES[c.axis]) bad(`capstone ${id}: axis invalido "${c.axis}"`);
  else if (paletteOf(c.axis).indexOf(c.color) < 0) {
    bad(`capstone ${id}: cor "${c.color}" fora da paleta de ${c.axis}`);
  }
  // `req` e lido contra o contador de eixo da run: um requisito num eixo de
  // outra classe nunca e satisfeito, ou pior, e satisfeito por `undefined`.
  for (const a in c.req || {}) {
    if (!noEixoDaClasse(cc, a)) bad(`capstone ${id}: req no eixo "${a}", que nao e da classe ${c.cls}`);
  }
}
/* A ABERTURA de cada classe. Ela e a primeira tela da run e a unica peca que
   entra sem passar por oferta nenhuma — entao o que a valida e este bloco, nao
   o motor: uma entrada errada aqui e uma run que comeca quebrada.

   O que se cobra e o que a tela promete: uma spell por eixo (a escolha e entre
   FAMILIAS, nao entre tres cartas quaisquer), todas oferecivel de verdade, e
   todas fazendo dano no instante da compra — e a mesma regra de "toda peca
   precisa de numero DESDE A COMPRA", cobrada onde ela mais importa, porque
   aqui nao existe tier anterior para compensar. */
const DANO = ["damage", "dps", "dotDps", "blast", "impDamage", "touchDps"];
for (const cid in CLASSES) {
  const cls = CLASSES[cid];
  if (!cls.available) continue;
  const st = cls.starters;
  if (!st || !st.length) { bad(`classe ${cid}: sem abertura (starters)`); continue; }
  const eixos = new Set();
  for (const id of st) {
    const p = PIECES[id];
    if (!p) { bad(`classe ${cid}: abertura "${id}" nao existe`); continue; }
    if (p.evolutionOnly) bad(`classe ${cid}: abertura "${id}" e evolutionOnly`);
    if (p.requires) bad(`classe ${cid}: abertura "${id}" tem requires — nada precede a abertura`);
    if (eixos.has(p.axis)) bad(`classe ${cid}: dois starters no eixo ${p.axis}`);
    eixos.add(p.axis);
    if (!DANO.some((k) => p.stats[k] > 0)) {
      bad(`classe ${cid}: abertura "${id}" nao causa dano nenhum na base`);
    }
  }
  /* Uma por eixo DA CLASSE, e nao de `AXES`: a uniao tem os eixos de todas
     elas, entao contra ela o warlock cobriria 3 de 6 para sempre. E a mesma
     correcao que a regra de matiz ja levou — o que a abertura promete e uma
     escolha entre as familias DESTA run. */
  const meus = cls.axes || Object.keys(AXES);
  if (eixos.size !== meus.length) {
    bad(`classe ${cid}: abertura cobre ${eixos.size} eixos de ${meus.length}`);
  }
  for (const id of st) {
    const p = PIECES[id];
    if (p && p.cls !== cid) bad(`classe ${cid}: abertura "${id}" e da classe ${p.cls}`);
  }
}

console.log(problems ? `X   ${problems} problemas no registry` : "ok  registry validado");

// --- simula ---------------------------------------------------------------
const g = new Game();
window.game = g;

let s = Number(__argv[1] || 1);
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
Math.random = rnd;

g.selectedSpeed = 3;

/* O smoke abre a ABERTURA de verdade — sem o argumento de `start` — e so o
   clique vira sorteio. E o unico driver que faz isso, pela mesma razao que ele
   e o unico que monta a tela de etapa de verdade: metade do codigo novo de uma
   tela mora na montagem dela, e o stub de DOM aguenta. */
g.start();
if (g.state !== STATE.STARTER) bad("start() nao abriu a abertura");
{
  const offers = g.ui.stOffers || [];
  if (!offers.length) bad("a abertura abriu sem oferta nenhuma");
  for (const o of offers) {
    let html;
    try { html = g.ui.stRowHtml(o); }
    catch (e) { bad(`abertura: stRowHtml explodiu — ${e.message}`); continue; }
    if (html.includes("undefined")) bad(`abertura ${o.axisId}: linha com "undefined"`);
  }
  const pool = g.build.axisTotal;
  g.ui.takeStarter(offers[Math.floor(rnd() * offers.length)]);
  if (g.state !== STATE.PLAYING) bad("escolher a abertura nao devolveu o jogo");
  if (g.build.pieces.size !== 1) bad(`a abertura deixou ${g.build.pieces.size} pecas na build`);
  // a abertura nao cobra eixo: quem cobra e a etapa, e so ela.
  if (g.build.axisTotal !== pool) bad("a abertura mexeu no pool de eixo");
}

let levelUps = 0;
g.ui.openLevelUp = function () {
  const offers = g.build.getOffers(3);
  if (!offers.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
  levelUps++;
  g.ui.applyOffer(offers[Math.floor(rnd() * offers.length)]);
};
/* A tela de etapa roda de VERDADE no headless (o stub de DOM aguenta): so o
   clique e substituido por um sorteio. E o unico jeito de o smoke pegar erro
   de montagem de carta, que e onde mora metade do codigo novo. */
let milestones = 0;
const msPick = g.ui.applyMilestone.bind(g.ui);
g.ui.applyMilestone = function (o, wet) { milestones++; msPick(o, wet); };
const msOpen = g.ui.openMilestone.bind(g.ui);
g.ui.openMilestone = function () {
  msOpen();
  if (g.state !== STATE.MILESTONE) return;
  const offers = g.ui.msOffers;
  const o = offers[Math.floor(rnd() * offers.length)];
  // Carta sorteada so tem o lado com spell; a de eixo aberto sorteia o lado.
  g.ui.applyMilestone(o, !o.dry || (!!o.wet && rnd() < 0.5));
};
g.ui.openChest = function () { g.state = STATE.PLAYING; };

const DT = 1 / 60;
const MINUTES = Number(__argv[2] || 12);
const steps = Math.round((MINUTES * 60) / DT / 3);
const peak = { enemies: 0, dots: 0, minions: 0, proj: 0, areas: 0 };
const t0 = __now();
try {
  for (let i = 0; i < steps; i++) {
    g.player.hp = g.player.maxHp;                 // imortal: queremos ver o late game
    const stand = ((i / 600) % 1) > 0.7;          // alterna andar/parar: exercita rooted e trail
    const ang = i * 0.01;
    g.input.keys = new Set(stand ? [] : [Math.cos(ang) > 0 ? "d" : "a", Math.sin(ang) > 0 ? "s" : "w"]);
    let total = DT * g.timeScale;
    while (total > 0) { const st = Math.min(0.025, total); g.update(st); total -= st; }
    peak.enemies = Math.max(peak.enemies, g.enemies.active.length);
    peak.dots = Math.max(peak.dots, g.dots.active.length);
    peak.minions = Math.max(peak.minions, g.minions.active.length);
    peak.proj = Math.max(peak.proj, g.projectiles.active.length);
    peak.areas = Math.max(peak.areas, g.areas.active.length);
  }
} catch (e) {
    console.error(`\nERRO EM RUNTIME aos ${g.elapsed.toFixed(1)}s de jogo:\n${e.stack}`);
  __exit(1);
}

const ms = __now() - t0;
const b = g.build;
let totalDmg = 0;
for (const v of g.damageBy.values()) totalDmg += v;
console.log(`ok  ${MINUTES} min simulados em ${ms}ms`);
console.log(`    nivel ${g.player.level}, ${levelUps} escolhas, ${g.player.kills} abates, ${(totalDmg / 1e3).toFixed(0)}k de dano`);
console.log(`    eixos ${b.axis.corruption}/${b.axis.dominion}/${b.axis.cataclysm} (pool ${b.axisTotal}/${AXIS_RULES.pool}) em ${milestones} etapas`);
console.log(`    pecas: ${[...b.pieces.values()].map((i) => i.def.name + "[" + Object.values(i.paths).join("") + "]").join(", ") || "—"}`);
console.log(`    passivas: ${[...b.passives.keys()].join(", ") || "—"}`);
console.log(`    capstones: ${[...b.capstones].join(", ") || "—"}`);
console.log(`    picos: ${peak.enemies} inimigos, ${peak.dots} dots, ${peak.minions} demonios, ${peak.proj} projeteis, ${peak.areas} areas`);
if (problems) __exit(1);
