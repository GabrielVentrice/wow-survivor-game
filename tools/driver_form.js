/* Driver: metamorfose e aura — os dois marcos visuais da progressao.

   Regra que este driver protege:
     - CAPSTONE fechado  -> uma forma nova no personagem (aprendiz -> mestre)
     - SPELL concluida   -> uma aura nova em volta dele

   Sao estados que o jogo normal quase nunca alcanca no caminho feliz, e que
   antes vinham do acumulo de pontos de eixo (qualquer compra empurrava). Se
   voltarem a depender de pontos, ou se peca sem caminho fechado voltar a
   acender adorno, e aqui que aparece. */
let s = 11;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

const g = new Game();
window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };

/* --- 1. as formas sao dado coerente -------------------------------------- */
console.log("--- formas ---");
for (const cid in CLASSES) {
  const cls = CLASSES[cid];
  if (!cls.forms) continue;
  let prev = -1;
  for (const f of cls.forms) {
    if (typeof f.caps !== "number") fail(`${cid}: forma "${f.sprite}" sem \`caps\` (o gatilho e capstone, nao ponto de eixo)`);
    if (f.at != null) fail(`${cid}: forma "${f.sprite}" ainda carrega \`at\` — sobra do sistema antigo de poder`);
    if (f.aura != null) fail(`${cid}: forma "${f.sprite}" declara \`aura\` — aura agora vem de spell concluida`);
    if (f.caps <= prev) fail(`${cid}: forma "${f.sprite}" nao avanca o limiar (${f.caps} apos ${prev})`);
    prev = f.caps;
    if (!SPRITE_DATA[f.sprite]) fail(`${cid}: forma aponta para o sprite inexistente "${f.sprite}"`);
  }
  if (cls.forms[0].caps !== 0) fail(`${cid}: a forma base tem que valer com 0 capstone`);
  console.log(`  ok ${cls.name}: ${cls.forms.length} formas em ${cls.forms.map((f) => f.caps).join("/")} capstones`);
}

/* --- 2. capstone move a forma, ponto de eixo nao ------------------------- */
g.start();
const p = g.player;
const b = g.build;

/* Enche o pool de eixo sem fechar capstone nenhum: a forma tem que ficar
   parada. O ponto agora so vem de ETAPA, e espalhar entre os tres eixos e o
   jeito de chegar a 20 sem cruzar nenhum limiar (15 puro, 10+5 hibrido). */
let guard = 0, volta = 0;
while (b.axisLeft > 0 && guard++ < 200) {
  const offers = b.getMilestoneOffers(guard % BALANCE.milestones.points.length);
  const o = offers[volta++ % offers.length];
  const antes = b.axisTotal;
  b.applyMilestone(o, false);
  if (b.axisTotal === antes) break;   // todo eixo no teto: nao ha mais o que dar
}
/* E confere que level up NAO move o pool: se ele voltar a cobrar eixo, a forma
   volta a chegar por inercia — que e o defeito que a separacao consertou. */
const poolAntesLv = b.axisTotal;
for (let i = 0; i < 12; i++) {
  const offers = b.getOffers(3);
  if (!offers.length) break;
  b.applyOffer(offers[i % offers.length]);
}
if (b.axisTotal !== poolAntesLv) {
  fail(`level up moveu o pool de eixo (${poolAntesLv} -> ${b.axisTotal})`);
}
if (b.capstones.size === 0 && p.formIdx !== 0) {
  fail(`forma avancou para ${p.formIdx} com ${b.axisTotal} pontos e nenhum capstone`);
} else {
  console.log(`  ok pool em ${b.axisTotal}/${AXIS_RULES.pool}, ${b.capstones.size} capstone(s), forma ${p.formIdx}`);
}

// agora forca capstone a capstone e confere que cada um traz uma forma
const capIds = Object.keys(CAPSTONES);
for (let n = 1; n < p.forms.length; n++) {
  g.start();
  for (let i = 0; i < n; i++) g.build.capstones.add(capIds[i]);
  g.build.afterChange();
  const antes = g.ui.el.toasts.children.length;
  g.ui.checkForm(CAPSTONES[capIds[n - 1]]);
  if (g.player.formIdx !== n) fail(`${n} capstone(s) deveriam dar a forma ${n}, deu ${g.player.formIdx}`);
  // A metamorfose nao pode chegar calada: se a build adiantar o formIdx, o
  // checkForm vira no-op e o clima do momento some.
  else if (g.ui.el.toasts.children.length === antes) fail(`a forma ${n} chegou sem anunciar nada`);
  else console.log(`  ok ${n} capstone(s) -> ${g.player.forms[n].name} (anunciada)`);
}

// e o caminho de verdade: capstone entrando por applyOffer tambem anuncia
g.start();
const inst0 = g.build.acquirePiece("corruption", true) || g.build.get("corruption");
g.build.axis.dominion = AXIS_RULES.pureAt;
const antesReal = g.ui.el.toasts.children.length;
g.ui.applyOffer({ kind: "path", inst: inst0, pathId: Object.keys(inst0.def.paths)[0] });
if (!g.build.capstones.size) fail("Tirania nao abriu com 15 de dominio");
else if (g.player.formIdx !== 1) fail(`capstone por applyOffer nao trocou a forma (formIdx ${g.player.formIdx})`);
else if (g.ui.el.toasts.children.length <= antesReal + 1) fail("applyOffer nao anunciou capstone + metamorfose");
else console.log("  ok capstone por applyOffer troca a forma e anuncia");

/* --- 3. aura so com spell concluida --------------------------------------- */
console.log("--- auras ---");
g.start();
// toda peca com vfx entra na build, mas nenhuma fecha caminho
let comVfx = 0;
for (const id in PIECES) {
  const def = PIECES[id];
  if (def.evolutionOnly || !PIECE_VFX[def.vfx]) continue;
  if (g.build.acquirePiece(id, true)) comVfx++;
}
if (comVfx < 3) fail(`so ${comVfx} pecas com vfx entraram — o teste nao prova nada`);
if (g.build.vfx.length) fail(`${g.build.vfx.length} auras acesas sem nenhuma spell concluida`);
else console.log(`  ok ${comVfx} pecas compradas, 0 auras (nenhuma concluida)`);

// fecha um caminho de uma delas: exatamente uma aura acende, e ela e a da peca
const alvo = g.build.get("corruption");
let completed = null;
const pid = Object.keys(alvo.def.paths)[0];
for (let t = 0; t < PATH_RULES.tiers; t++) {
  const r = g.build.upgradePath(alvo, pid);
  if (r && r.completed) completed = r.completed;
}
if (!completed) fail("fechar o tier 5 nao reportou `completed` — a UI nunca mostraria o toast de aura");
if (!g.build.isComplete(alvo)) fail("caminho no tier 5 e a peca nao conta como concluida");
if (g.build.vfx.length !== 1) fail(`esperava 1 aura apos a primeira conclusao, tem ${g.build.vfx.length}`);
else console.log(`  ok 1 caminho fechado -> 1 aura (${completed.name})`);

// fechar o SEGUNDO caminho da mesma peca nao acende outra aura nem re-toasta
const pid2 = Object.keys(alvo.def.paths)[1];
let again = null;
for (let t = 0; t < PATH_RULES.tiers; t++) {
  const r = g.build.upgradePath(alvo, pid2);
  if (r && r.completed) again = r.completed;
}
if (again) fail("o segundo caminho da mesma peca reportou `completed` de novo");
if (g.build.vfx.length !== 1) fail(`a mesma peca gerou ${g.build.vfx.length} auras`);
else console.log("  ok 2o caminho da mesma peca nao duplica a aura");

// a aura sobrevive a evolucao: a peca troca de def no tier 5 e continua acesa
g.start();
let evoAura = 0;
for (const id in PIECES) {
  for (const pathId in PIECES[id].paths || {}) {
    const into = PIECES[id].paths[pathId].evolvesInto;
    if (!into || !PIECE_VFX[PIECES[into].vfx]) continue;
    g.start();
    const inst = g.build.acquirePiece(id, true) || g.build.get(PIECES[id].key);
    for (let t = 0; t < PATH_RULES.tiers; t++) g.build.upgradePath(inst, pathId);
    if (g.build.vfx.length !== 1) fail(`${into}: evoluiu e ficou com ${g.build.vfx.length} auras`);
    else evoAura++;
  }
}
console.log(`  ok ${evoAura} evolucoes com vfx mantem exatamente 1 aura`);

/* --- 4. o render aguenta a build inteira acesa ---------------------------- */
g.start();
for (const id in PIECES) {
  const def = PIECES[id];
  if (def.evolutionOnly) continue;
  const inst = g.build.acquirePiece(id, true);
  if (!inst) continue;
  for (const pathId in inst.def.paths) {
    for (let t = 0; t < PATH_RULES.tiers; t++) g.build.upgradePath(inst, pathId);
  }
}
for (const id of Object.keys(CAPSTONES)) g.build.capstones.add(id);
g.build.afterChange();
g.player.formIdx = g.player.formIndex(g.build.capstones.size);
try {
  for (let i = 0; i < 30; i++) { g.player.vfxTime += 1 / 60; g.render(); }
  console.log(`  ok render com ${g.build.vfx.length} auras e a forma ${g.player.formIdx} (teto de adorno ${MAX_PIECE_VFX})`);
} catch (e) {
  fail("render explodiu com a build inteira acesa: " + e.message);
  console.error(e.stack);
}

// A UI tambem le os dois marcos: barra de pecas marca a spell concluida e o
// painel de pausa lista as formas.
try {
  g.ui.updatePieceBar();
  g.ui.onPause();
  const html = g.ui.el.pausePanel.innerHTML;
  for (const f of g.player.forms) {
    if (f.name && html.indexOf(f.name) < 0) fail(`a pausa nao lista a forma "${f.name}"`);
  }
  if (g.ui.el.pieceBar.innerHTML.indexOf("pb-aura") < 0) fail("a barra de pecas nao marca nenhuma spell concluida");
  else console.log("  ok HUD marca spell concluida e a pausa lista as formas");
} catch (e) {
  fail("UI explodiu ao ler forma/aura: " + e.message);
  console.error(e.stack);
}

console.log(fails ? `\nX ${fails} falhas` : "\nok metamorfose e aura validadas");
if (fails) __exit(1);
