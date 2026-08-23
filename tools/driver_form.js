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
/* Gate de eixo: tier 3+ pede pontos no eixo DA PECA. Este driver forca
   conclusoes de spell que uma run so alcanca mirando um eixo, e a secao 4
   acende a build INTEIRA — estado que nenhum pool de 20 pontos paga. Crava o
   eixo em vez de jogar por ele; quem mede a regra e `driver_cards`. */
const abreEixos = () => { for (const a in g.build.axis) g.build.axis[a] = AXIS_RULES.pureAt; };
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
  const covered = new Set();
  for (const f of cls.forms) {
    if (f.caps != null) fail(`${cid}: forma "${f.sprite}" ainda usa \`caps\` — o gatilho e QUAL capstone, nao quantos`);
    if (f.at != null) fail(`${cid}: forma "${f.sprite}" ainda carrega \`at\` — sobra do sistema antigo de poder`);
    if (f.aura != null) fail(`${cid}: forma "${f.sprite}" declara \`aura\` — aura agora vem de spell concluida`);
    if (!SPRITE_DATA[f.sprite]) fail(`${cid}: forma aponta para o sprite inexistente "${f.sprite}"`);
    if (f.cap) {
      if (!CAPSTONES[f.cap]) fail(`${cid}: forma "${f.sprite}" aponta para o capstone inexistente "${f.cap}"`);
      if (covered.has(f.cap)) fail(`${cid}: duas formas para o capstone "${f.cap}"`);
      covered.add(f.cap);
    }
  }
  const base = cls.forms[0];
  if (base.cap || base.spells != null) fail(`${cid}: a forma base tem que valer sem capstone e sem spell`);
  /* COBERTURA, e ela e por CLASSE nos dois sentidos.

     Que a lista de capstones seja a da classe e obvio depois que `cls` existe:
     cobrar do warlock uma forma para "Terra Arrasada" seria cobrar o corpo de
     uma run que ele nao pode ter.

     O segundo sentido custou uma decisao: a cobertura so e cobrada de quem
     declara MAIS DE UMA forma. Uma classe com forma unica esta dizendo "o meu
     corpo nao conta a progressao" — e isso e uma posicao coerente, nao uma
     lacuna. O que nao pode existir e a cobertura PELA METADE: tres formas para
     oito finais e o corpo dizendo que a run chegou longe sem dizer para onde,
     que e exatamente o defeito que tirou a metamorfose do acumulo de pontos. */
  const meus = Object.keys(CAPSTONES).filter((id) => CAPSTONES[id].cls === cid);
  if (cls.forms.length > 1) {
    for (const id of meus) {
      if (!covered.has(id)) fail(`${cid}: capstone "${id}" nao tem forma`);
    }
  } else if (covered.size) {
    fail(`${cid}: forma unica, mas ela aponta para um capstone — ou cobre todos, ou nenhum`);
  }
  for (const id of covered) {
    if (CAPSTONES[id] && CAPSTONES[id].cls !== cid) {
      fail(`${cid}: forma aponta para "${id}", que e capstone da classe ${CAPSTONES[id].cls}`);
    }
  }
  const meio = cls.forms.filter((f) => f.spells != null).length;
  console.log(`  ok ${cls.name}: ${cls.forms.length} formas — 1 base, ${meio} por spell, `
    + `${covered.size}/${meus.length} por capstone`);
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
  const offers = b.getMilestoneOffers();
  if (!offers.length) break;
  const o = offers[volta++ % offers.length];
  const antes = b.axisTotal;
  b.applyMilestone(o, !o.dry);
  if (b.axisTotal === antes) break;
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
console.log(`  ok pool em ${b.axisTotal}/${AXIS_RULES.pool}, ${b.capstones.size} capstone(s), forma ${p.formIdx}`);

/* Ponto de eixo sozinho nao move a forma: enche o pool inteiro SEM capstone e
   confere que o corpo ficou parado no aprendiz. */
g.start();
g.build.axis.corruption = AXIS_RULES.cap - 1;
g.build.axis.dominion = AXIS_RULES.pool - AXIS_RULES.cap;
g.build.afterChange();
g.ui.checkForm(null);
if (g.player.formIdx !== 0) fail(`ponto de eixo sozinho moveu a forma para ${g.player.formIdx}`);
else console.log("  ok pool cheio sem capstone deixa a forma no aprendiz");

/* Cada capstone traz A SUA forma, e anuncia. Antes o teste era por contagem —
   n capstones davam a forma n. Agora e por identidade, e e mais forte: fechar
   `nihilam` tem que dar a forma de nihilam, e nao "a segunda forma". */
for (const id in CAPSTONES) {
  g.start();
  g.build.capstones.add(id);
  g.build.afterChange();
  /* Conta os eventos ANUNCIADOS, nao os nos vivos no DOM: o teto de tres
     toasts simultaneos faz o quarto virar contador em vez de virar elemento. */
  const antes = g.ui.toastCount;
  g.ui.checkForm(CAPSTONES[id]);
  const f = g.player.forms[g.player.formIdx];
  if (f.cap !== id) fail(`capstone "${id}" deu a forma "${f.sprite}" (cap ${f.cap})`);
  // A metamorfose nao pode chegar calada: se a build adiantar o formIdx, o
  // checkForm vira no-op e o clima do momento some.
  else if (g.ui.toastCount === antes) fail(`a forma de "${id}" chegou sem anunciar nada`);
}
console.log(`  ok ${Object.keys(CAPSTONES).length} capstones, cada um com a sua forma anunciada`);

// e o caminho de verdade: capstone entrando por applyOffer tambem anuncia
g.start();
const inst0 = g.build.acquirePiece("corruption", true) || g.build.get("corruption");
g.build.axis.dominion = AXIS_RULES.pureAt;
const antesReal = g.ui.toastCount;
g.ui.applyOffer({ kind: "path", inst: inst0, pathId: Object.keys(inst0.def.paths)[0] });
if (!g.build.capstones.size) fail("Tirania nao abriu com 15 de dominio");
else if (g.player.forms[g.player.formIdx].cap !== "tirania") fail(`capstone por applyOffer nao trocou a forma (formIdx ${g.player.formIdx})`);
else if (g.ui.toastCount <= antesReal + 1) fail("applyOffer nao anunciou capstone + metamorfose");
else console.log("  ok capstone por applyOffer troca a forma e anuncia");

/* --- 2b. pose de cast ------------------------------------------------------
   O unico input em combate e movimento e nenhuma peca e conjurada a mao. Sem
   uma segunda grade o warlock atravessa a run inteira de bracos caidos
   enquanto trinta spells disparam sozinhas, e o corpo nao participa do que a
   build faz. Tres coisas tem que valer, e as tres ja quebraram uma vez. */
console.log("--- cast ---");
for (const cid in CLASSES) {
  const cls = CLASSES[cid];
  if (!cls.forms) continue;
  for (const f of cls.forms) {
    const d = SPRITE_DATA[f.sprite];
    if (!d.cast) fail(`${f.sprite}: sem grade de cast — a pose nao se deriva da idle`);
    // MESMAS linhas: o degrau sai de drawH / (PIXEL_UNIT * linhas), entao uma
    // cast com outra altura desenharia a mesma criatura em outra escala.
    else if (d.cast.length !== d.rows.length) {
      fail(`${f.sprite}: cast com ${d.cast.length} linhas contra ${d.rows.length} da idle`);
    }
    // Largura PODE (e costuma) diferir: braco aberto nao cabe na largura do
    // corpo, e largura nao entra na conta do degrau.
    const spr = SPRITES[f.sprite];
    if (!spr.cast) fail(`${f.sprite}: buildSprites nao montou o canvas de cast`);
    else if (animFrame(spr, { cast: true, frame: 2 }) !== spr.cast) {
      fail(`${f.sprite}: a caminhada ganhou do cast — duas poses no mesmo quadro`);
    }
  }
}
console.log(`  ok ${Object.values(CLASSES).reduce((n, c) => n + (c.forms ? c.forms.length : 0), 0)}`
  + ` formas com grade de cast, mesma altura da idle`);

/* E a pose tem que DISPARAR de verdade numa run: e o unico funil por onde toda
   peca passa, entao se ela nao acender aqui, nao acende em lugar nenhum. */
/* O piloto ANDA, e o laco para quando a run acaba. As duas coisas pelo mesmo
   motivo: `castTime` so anda dentro de `player.update`, que so roda com o jogo
   em PLAYING. Um warlock parado no meio desta horda morre em ~9s, e os 81s de
   gameover que vinham depois entravam na conta como um unico trecho de pose
   acesa — o teste reprovava a tela de game over, nao a cadencia da pose. */
g.start();
let viuCast = false, maxSeguido = 0, seguido = 0, vivo = 0;
g.input.keys = new Set(["d"]);
for (let i = 0; i < 60 * 90; i++) {
  g.update(1 / 60);
  if (g.state !== STATE.PLAYING) break;
  vivo = i;
  if (g.player.castTime > 0) { viuCast = true; seguido++; maxSeguido = Math.max(maxSeguido, seguido); }
  else seguido = 0;
}
g.input.keys = new Set();
if (!viuCast) fail(`${(vivo / 60).toFixed(0)}s de run e a pose de cast nunca acendeu`);
/* E ela tem que APAGAR. Com uma build madura as pecas disparam quase o tempo
   todo; sem cadencia a pose de cast vira o estado normal do personagem e quem
   passa a ser evento e a caminhada. */
else if (maxSeguido > 60 * (CAST_POSE + 0.05)) {
  fail(`pose de cast ficou ${(maxSeguido / 60).toFixed(2)}s seguidos (teto ${CAST_POSE}s)`);
} else {
  console.log(`  ok a pose acende na run e volta (maior trecho ${(maxSeguido / 60).toFixed(2)}s, ` +
              `cadencia ${CAST_GAP}s, ${(vivo / 60).toFixed(0)}s de run medidos)`);
}

/* --- 3. aura so com spell concluida --------------------------------------- */
console.log("--- auras ---");
g.start();
abreEixos();
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
    abreEixos();
    const inst = g.build.acquirePiece(id, true) || g.build.get(PIECES[id].key);
    for (let t = 0; t < PATH_RULES.tiers; t++) g.build.upgradePath(inst, pathId);
    if (g.build.vfx.length !== 1) fail(`${into}: evoluiu e ficou com ${g.build.vfx.length} auras`);
    else evoAura++;
  }
}
console.log(`  ok ${evoAura} evolucoes com vfx mantem exatamente 1 aura`);

/* --- 4. o render aguenta a build inteira acesa ---------------------------- */
g.start();
abreEixos();
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
g.player.formIdx = g.player.formIndex(g.build.capstones, null, 0);
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
  /* A pausa diz em que forma o warlock ESTA, e nao mais a escada inteira: com
     uma forma por capstone as dez sao irmas, e listar as outras nove seria
     listar rotas que esta run nao tomou. */
  const html = g.ui.el.pauseDmg.innerHTML;
  const atual = g.player.forms[g.player.formIdx];
  if (atual.name && html.indexOf(atual.name) < 0) {
    fail(`a pausa nao diz a forma atual ("${atual.name}")`);
  }
  if (g.ui.el.pieceBar.innerHTML.indexOf("pb-aura") < 0) fail("a barra de pecas nao marca nenhuma spell concluida");
  else console.log("  ok HUD marca spell concluida e a pausa diz a forma atual");
} catch (e) {
  fail("UI explodiu ao ler forma/aura: " + e.message);
  console.error(e.stack);
}

console.log(fails ? `\nX ${fails} falhas` : "\nok metamorfose e aura validadas");
if (fails) __exit(1);
