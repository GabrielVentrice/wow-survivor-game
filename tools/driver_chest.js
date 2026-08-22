/* =========================================================================
   BAÚ — cadência de aparição e tamanho do prêmio.

   O baú é a única fonte de tiers grátis: se ele demora a aparecer, a build
   trava no tier baixo, e se quase sempre entrega 1 tier, o Dreadlord vira um
   inimigo caro que não paga. Este driver mede as duas coisas separadamente —
   quantos baús o mundo produz por minuto (spawner + drop de boss) e quantos
   tiers cada raridade realmente entrega.

   `openChest` roda de verdade aqui (não é stub como nos outros drivers): é o
   caminho que sorteia raridade, gasta candidatos e escreve na tela.
   ========================================================================= */
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

const g = new Game();
window.game = g;
g.ui.openLevelUp = function () {
  const o = g.build.getOffers(3);
  if (!o.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
  g.ui.applyOffer(o[Math.floor(Math.random() * o.length)]);
};
/* A etapa tambem para o jogo, entao ela precisa ser resolvida aqui: sem isso o
   `state` trava em MILESTONE no primeiro marco e a run mede a cadencia de bau
   dos primeiros 60 segundos achando que mediu 12 minutos. Leva a spell quando
   ha uma, porque bau so tem o que entregar se a build tiver caminhos abertos. */
g.ui.openMilestone = function () {
  if (g.build.axisLeft <= 0) { g.pendingMilestones = 0; g.state = STATE.PLAYING; return; }
  const offers = g.build.getMilestoneOffers();
  if (!offers.length) { g.pendingMilestones = 0; g.state = STATE.PLAYING; return; }
  /* E MIRA UM EIXO. Desde o gate de eixo (`PATH_RULES.axisGate`) o bau so tem
     tier para entregar se o eixo da peca acompanhar: espalhar ponto deixa toda
     trilha travada no tier 2 e este driver passaria a medir a politica de
     etapa em vez da cadencia do bau. Quem mede o gate e `driver_cards`; quem
     mede o preco de espalhar e `driver_balance`. */
  let alvo = null;
  for (const a in g.build.axis) if (!alvo || g.build.axis[a] > g.build.axis[alvo]) alvo = a;
  if (!g.build.axis[alvo]) alvo = g.build.pieces.values().next().value.def.axis;
  const o =
    offers.find((x) => x.axisId === alvo && x.dry && x.dry.gain > 0) ||
    offers.find((x) => x.axisId === alvo && x.wet && x.wet.gain > 0) ||
    offers.find((x) => x.wet && x.wet.gain > 0) || offers[0];
  const wet = !(o.dry && o.dry.gain > 0 && o.axisId === alvo);
  g.build.applyMilestone(o, wet && !!(o.wet && o.wet.gain > 0));
  g.pendingMilestones--;
  g.state = STATE.PLAYING;
};

// --- 1. cadência: quando e quantos baús nascem ---------------------------
const spawnedAt = [];
const realSpawn = Game.prototype.spawnChestAt;
g.spawnChestAt = function (x, y) { spawnedAt.push(g.elapsed); realSpawn.call(g, x, y); };

// prêmios abertos, agrupados por raridade
const byLabel = new Map();
const realOpen = g.ui.openChest.bind(g.ui);
g.ui.openChest = function () {
  const before = g.build.tiersOwned ? g.build.tiersOwned() : null;
  realOpen();
  const label = g.ui.el.chestRarity.textContent || "?";
  const rows = (g.ui.el.chestList.innerHTML.match(/chest-row/g) || []).length;
  const k = label.split(" ·")[0];
  const e = byLabel.get(k) || { n: 0, tiers: 0 };
  e.n++; e.tiers += rows;
  byLabel.set(k, e);
  g.ui.closeChest();
  void before;
};

g.start();

const MIN = Number(__argv[1] || 12);
const steps = Math.round((MIN * 60) / (1 / 60));
for (let i = 0; i < steps; i++) {
  g.player.hp = g.player.maxHp;                 // imortal: queremos a run inteira
  const ang = i * 0.008;
  g.input.keys = new Set([Math.cos(ang) > 0 ? "d" : "a", Math.sin(ang) > 0 ? "s" : "w"]);
  // teleporte para cima do baú mais próximo: aqui o teste é o prêmio, não a
  // habilidade de andar até ele
  const pk = g.pickups.active.find((p) => p.item.id === "chest");
  if (pk) { g.player.x = pk.x; g.player.y = pk.y; }
  g.update(1 / 60);
}

const fail = [];
const first = spawnedAt[0];
const perMin = spawnedAt.length / MIN;
console.log(`baus: ${spawnedAt.length} em ${MIN} min (${perMin.toFixed(1)}/min), 1o aos ${first == null ? "-" : first.toFixed(0)}s`);

if (first == null || first > BALANCE.spawn.chestAt + 5) fail.push(`1o bau tarde demais: ${first}`);
if (perMin < 1) fail.push(`baus raros demais: ${perMin.toFixed(2)}/min`);

let opened = 0, tiers = 0;
for (const [k, e] of byLabel) {
  opened += e.n; tiers += e.tiers;
  console.log(`  ${k.padEnd(10)} ${String(e.n).padStart(3)}x  ${(e.tiers / e.n).toFixed(1)} tiers/bau`);
}
console.log(`abertos ${opened}, ${tiers} tiers gratis (${(tiers / opened).toFixed(2)} por bau)`);

const multi = [...byLabel].filter(([k]) => k !== "Comum").reduce((a, [, e]) => a + e.n, 0);
if (opened && multi / opened < 0.4) fail.push(`prêmio grande raro demais: ${(multi / opened * 100).toFixed(0)}% dos baús`);
if (g.state !== STATE.PLAYING) fail.push(`estado preso em ${g.state}`);

if (fail.length) { for (const f of fail) console.log("FALHA " + f); throw new Error(fail.length + " falha(s)"); }
console.log("ok  cadencia e premio do bau");

// leitura de saída: como a build terminou com os baús contando de verdade
const shape = [];
for (const inst of g.build.pieces.values()) {
  shape.push(inst.def.name + "[" + Object.keys(inst.def.paths).map((p) => inst.paths[p]).join("") + "]");
}
console.log("build: " + shape.join(", "));
console.log(`nivel ${g.player.level}, ${g.player.kills} abates`);
