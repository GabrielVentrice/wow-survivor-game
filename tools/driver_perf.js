/* =========================================================================
   PERF — custo de frame com a horda no teto.

   Dobrar a densidade de inimigos é uma decisão de game design, mas o preço é
   de engenharia: `separateEnemies` e a reconstrução do grid crescem com o
   número de corpos, e o render desenha um sprite por inimigo vivo.

   O player é imortal aqui de propósito: o objetivo é ENCOSTAR no teto de
   vivos, que é o pior caso real, e ver quanto sobra do orçamento de 16,7ms.

   Os tempos absolutos não são os do browser (o canvas aqui é stub, então o
   render sai barato demais). O que este driver mede de verdade é a SIMULAÇÃO,
   e conta as chamadas de desenho para o custo de render ser estimável.
   ========================================================================= */
let s = 21;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

const g = new Game();
window.game = g;
g.ui.openLevelUp = function () {
  const o = g.build.getOffers(3);
  if (!o.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
  g.ui.applyOffer(o[Math.floor(Math.random() * o.length)]);
};
g.ui.openChest = () => { g.state = STATE.PLAYING; };
// A etapa tambem PARA o update: sem resolve-la o driver rodaria ate o
// primeiro marco e chamaria de minutos. Quem mede etapa e `driver_milestone`.
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
g.start();

const MIN = Number(__argv[1] || 12);
const steps = Math.round((MIN * 60) / (1 / 60));
const buckets = [];       // [tempo, inimigos, ms de update]
let acc = 0, accN = 0, nextMark = 60;
let worst = 0, worstAt = 0, worstN = 0;

for (let i = 0; i < steps; i++) {
  g.player.hp = g.player.maxHp;                 // imortal: queremos o teto
  const ang = i * 0.008;
  g.input.keys = new Set(((i / 500) % 1) > 0.8 ? [] : [Math.cos(ang) > 0 ? "d" : "a", Math.sin(ang) > 0 ? "s" : "w"]);
  const t0 = __now();
  g.update(1 / 60);
  const ms = __now() - t0;
  acc += ms; accN++;
  if (ms > worst) { worst = ms; worstAt = g.elapsed; worstN = g.enemies.active.length; }
  if (g.elapsed >= nextMark) {
    buckets.push([Math.round(g.elapsed), g.enemies.active.length, acc / accN]);
    nextMark += 60;
    acc = 0; accN = 0;
  }
}

console.log("  t(s)  inimigos  update(ms)   orcamento de 16.7ms");
for (const [t, n, ms] of buckets) {
  const pct = Math.min(40, Math.round((ms / 16.7) * 40));
  console.log(`  ${String(t).padStart(4)}  ${String(n).padStart(8)}  ${ms.toFixed(2).padStart(9)}   ` +
    "#".repeat(pct) + ".".repeat(40 - pct));
}
console.log(`\n  pior update: ${worst.toFixed(1)}ms aos ${worstAt.toFixed(0)}s com ${worstN} inimigos`);
console.log(`  teto configurado: ${BALANCE.spawn.maxAlive} / ${BALANCE.spawn.hardMaxAlive} (fase dura)`);

/* Custo de desenho no pior caso.

   Aquece antes de contar: sprites de prop e de portal sao gerados na primeira
   vez que aparecem, pixel a pixel com fillRect. Medir a primeira frame conta
   essa geracao como se fosse custo recorrente — deu 17 mil fillRect numa
   leitura, que era o cache frio e nao o frame. */
g._frameDt = 1 / 60;
for (let i = 0; i < 12; i++) g.render();
__draw.reset();
g.render();
const total = Object.values(__draw.calls).reduce((a, b) => a + b, 0);
console.log(`\n  render com ${g.enemies.active.length} inimigos: ${total} chamadas de desenho`);
for (const [k, v] of Object.entries(__draw.calls).sort((a, b) => b[1] - a[1])) {
  if (v > 10) console.log(`    ${String(v).padStart(5)}  ${k}`);
}

const media = buckets.length ? buckets[buckets.length - 1][2] : 0;
if (media > 8) console.error(`\n  X update medio de ${media.toFixed(1)}ms no fim: metade do orcamento so na simulacao`);
else console.log(`\n  ok simulacao cabe no orcamento (${media.toFixed(1)}ms de 16.7ms no pior bucket)`);
