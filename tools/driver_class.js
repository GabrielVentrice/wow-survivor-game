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
const CLASSES_A_RODAR = MODO === "mortal" ? ["warlock", "hunter"] : ["hunter"];

for (const CLS of CLASSES_A_RODAR) {
let s = 11;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const g = new Game();
window.game = g;
g.selectedClass = CLS;
g.ui.openLevelUp = function () {
  const o = g.build.getOffers(3);
  if (!o.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
  g.ui.applyOffer(o[Math.floor(Math.random() * o.length)]);
};
g.ui.openChest = () => { g.state = STATE.PLAYING; };
g.ui.openMilestone = function () {
  const o = g.build.getMilestoneOffers();
  if (!o.length) { g.pendingMilestones = 0; g.state = STATE.PLAYING; return; }
  // politica "focado": sempre o eixo com mais pontos, spell quando cabe
  let best = o[0];
  for (const c of o) if (g.build.axis[c.axisId] > g.build.axis[best.axisId]) best = c;
  g.ui.applyMilestone(best, !!best.piece);
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
}
