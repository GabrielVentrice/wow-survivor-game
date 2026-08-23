// Fase 3: o hunter tem que ser COMPLETAVEL numa run — nao so nao estourar.
/* DRIVER — CLASSE: a run chega ao fim da propria progressao, e nada vaza.

   Duas perguntas, e as duas so existem depois que o jogo passou a ter mais de
   uma classe:

   1. COMPLETAVEL: uma run que mira um eixo chega a pool cheia, a capstone e a
      spell fechada? Um catalogo pode validar no registry inteiro e ainda assim
      nunca fechar nada — foi o que aconteceu com o warlock antes da separacao
      das duas telas de escolha (0 capstones em 16 runs).
   2. ESTANQUE: nenhuma peca, passiva ou capstone da outra classe entra. E a
      unica checagem que enxerga o vazamento pelo lado do JOGO em vez de pelo
      lado do dado — `driver.js` conferiria `cls` no registry, e este confere
      o que a build efetivamente recebeu numa run inteira.

   Uso:  DRIVER=driver_class.js node tools/harness.js . [minutos] [imortal|mortal]

   Fase 3 pergunta se o hunter e COMPLETAVEL: se uma run que mira um eixo chega
   a capstone, evolucao e aura. Por isso o jogador e imortal aqui, como em
   `driver.js` — quem mede sobrevivencia e `driver_balance`, e misturar as duas
   perguntas foi o que fez a primeira versao deste driver "reprovar" o hunter
   por uma coisa que o warlock tambem faz: morrer aos dois minutos.

   O segundo regime (`mortal`) roda a mesma politica nas duas classes e compara
   — e ai a pergunta e comparativa, nao absoluta. */
const MODO = __argv[2] || "imortal";
const SEEDS = Number(__argv[3] || 1);
const CLASSES_A_RODAR = MODO === "mortal" ? ["warlock", "hunter"] : ["hunter"];

/* SEEDS, e nao uma run. A pergunta "a classe fecha a progressao" e
   estatistica: o catalogo muda a cada fase, e mudar o catalogo desloca TODO
   sorteio seguinte — duas fases nao produzem a mesma run nem com a mesma
   semente. Uma run so nao distingue "a fase piorou a classe" de "esta mao veio
   ruim", que e exatamente o erro que `driver_balance` ja documenta. */
const RESUMO = [];
for (const CLS of CLASSES_A_RODAR) {
for (let seed = 1; seed <= SEEDS; seed++) {
let s = 11 * seed;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const g = new Game();
window.game = g;
g.selectedClass = CLS;
g.ui.openLevelUp = function () {
  const o = g.build.getOffers(3);
  if (!o.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
  g.build.applyOffer(o[Math.floor(Math.random() * o.length)]);
  g.player.pendingLevels = Math.max(0, g.player.pendingLevels - 1);
  g.state = STATE.PLAYING;
};
g.ui.openChest = () => { g.state = STATE.PLAYING; };
/* A tela de etapa PARA o `update`, entao quem a abre tem que fecha-la — e
   fechar quer dizer decrementar `pendingMilestones` e devolver o estado, que e
   o que `UI.applyMilestone` faz no jogo de verdade.

   A primeira versao deste override so aplicava a oferta. Resultado: a fila
   nunca zerava, `update` saia cedo em todo frame seguinte e o relogio de
   simulacao CONGELAVA. A run parecia ter morrido aos 6,9 min com o orcamento
   de 16 — e nao tinha morrido, tinha parado. Driver que prende uma tela mede a
   propria tela. */
g.ui.openMilestone = function () {
  if (g.build.axisLeft <= 0) { g.pendingMilestones = 0; g.state = STATE.PLAYING; return; }
  const o = g.build.getMilestoneOffers();
  if (!o.length) { g.pendingMilestones = 0; g.state = STATE.PLAYING; return; }
  // politica "focado": sempre o eixo com mais pontos, spell quando cabe
  let best = o[0];
  for (const c of o) if (g.build.axis[c.axisId] > g.build.axis[best.axisId]) best = c;
  g.build.applyMilestone(best, !!best.piece);
  g.pendingMilestones = Math.max(0, g.pendingMilestones - 1);
  g.state = STATE.PLAYING;
};
g.start();
const MIN = Number(__argv[1] || 12);
const steps = Math.round((MIN * 60) / (1 / 60));
for (let i = 0; i < steps; i++) {
  const ang = i * 0.008;
  if (MODO !== "mortal") g.player.hp = g.player.maxHp;
  g.input.keys = new Set(((i / 500) % 1) > 0.8 ? [] : [Math.cos(ang) > 0 ? "d" : "a", Math.sin(ang) > 0 ? "s" : "w"]);
  g.update(1 / 60);
  if (g.state === STATE.GAMEOVER) break;
}
const b = g.build;
let total = 0;
for (const v of g.damageBy.values()) total += v;
const pecas = [...b.pieces.values()].map((i) =>
  i.def.name + "[" + Object.values(i.paths).join("") + "]");
console.log(`=== RUN DE ${CLS.toUpperCase()} (${MODO}) ===`);
console.log(`  sobreviveu ${(g.elapsed / 60).toFixed(1)} min · nivel ${g.player.level} · ${g.player.kills} abates`);
console.log(`  dano ${Math.round(total / 1000)}k`);
console.log(`  eixos ${b.axes.map((a) => a + " " + b.axis[a]).join(" / ")} (pool ${b.axisTotal}/20)`);
console.log(`  pecas (${b.pieces.size}): ${pecas.join(", ")}`);
console.log(`  passivas: ${[...b.passives.keys()].join(", ") || "—"}`);
console.log(`  capstones: ${[...b.capstones].join(", ") || "—"}`);
console.log(`  auras: ${b.vfx.length} · picos: ${g.minions.active.length} bichos, ${g.areas.active.length} zonas`);
const vazamento = [...b.pieces.values()].filter((i) => i.def.cls !== CLS);
if (vazamento.length) console.log("  X VAZOU peca de outra classe: " + vazamento.map((i) => i.def.id).join(", "));
else console.log(`  ok nenhuma peca de outra classe entrou na build`);
const capVaz = [...b.capstones].filter((c) => CAPSTONES[c].cls !== CLS);
if (capVaz.length) console.log("  X VAZOU capstone: " + capVaz.join(", "));
else console.log("  ok nenhum capstone de outra classe abriu");
const pasVaz = [...b.passives.keys()].filter((k) => PASSIVES[k].cls !== CLS);
if (pasVaz.length) console.log("  X VAZOU passiva: " + pasVaz.join(", "));
else console.log("  ok nenhuma passiva de outra classe entrou");
const evoluidas = [...b.pieces.values()].filter((i) => i.evolvedInto).length;
RESUMO.push({ cls: CLS, seed: seed, min: g.elapsed / 60, pool: b.axisTotal,
              caps: b.capstones.size, evo: evoluidas, auras: b.vfx.length,
              dano: total, abates: g.player.kills });
console.log(`  evolucoes: ${evoluidas}`);
}
}

/* O placar, que e o que responde a pergunta da fase. Mediana e nao media: a
   bimodalidade por politica ja esta documentada em `driver_balance`, e uma run
   que engatou a bola de neve puxa a media sozinha. */
const med = (xs) => { const a = xs.slice().sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
if (RESUMO.length > 1) {
  console.log("\n=== PLACAR ===");
  for (const cls of CLASSES_A_RODAR) {
    const r = RESUMO.filter((x) => x.cls === cls);
    if (!r.length) continue;
    console.log(`  ${cls}: ${r.length} run(s)`);
    console.log(`    sobrevivencia (mediana)  ${med(r.map((x) => x.min)).toFixed(1)} min`);
    console.log(`    pool ao fim (mediana)    ${med(r.map((x) => x.pool))}/20`);
    console.log(`    abates (mediana)         ${Math.round(med(r.map((x) => x.abates)))}`);
    console.log(`    runs com capstone        ${r.filter((x) => x.caps).length}/${r.length}`);
    console.log(`    runs com evolucao        ${r.filter((x) => x.evo).length}/${r.length}`);
    console.log(`    runs com aura            ${r.filter((x) => x.auras).length}/${r.length}`);
  }
}
