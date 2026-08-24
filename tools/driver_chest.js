/* =========================================================================
   BAÚ — cadência de aparição e tamanho do prêmio.

   O baú é a única fonte de tiers grátis: se ele demora a aparecer, a build
   trava no tier baixo, e se quase sempre entrega 1 tier, o Dreadlord vira um
   inimigo caro que não paga. Este driver mede as duas coisas separadamente —
   quantos baús o mundo produz por minuto (spawner + drop de boss) e quantos
   tiers cada raridade realmente entrega.

   `openChest` roda de verdade aqui (não é stub como nos outros drivers): é o
   caminho que sorteia raridade, gasta candidatos e escreve na tela.

   VÁRIAS SEEDS, e o motivo é que "40% dos baús entregam prêmio grande" é uma
   propriedade DISTRIBUCIONAL, e uma run de 12 min abre ~24 baús. Medido, o
   mesmo jogo dá 33%, 39%, 46%, 55%, 56%, 59%, 60% e 74% conforme a seed — o
   piso de 40% caía dentro do ruído, e o driver reprovava ou passava por sorte
   do sorteio. Com quatro runs a amostra passa de ~100 baús e o piso volta a
   dizer alguma coisa. A cadência (baús por minuto) é estável e não precisava
   disso; quem precisava era o prêmio.
   ========================================================================= */
const MIN = Number(__argv[1] || 12);
const SEEDS = [7, 13, 29, 41].slice(0, Number(__argv[2] || 4));

// prêmios abertos, agrupados por raridade — acumulado sobre todas as seeds
const byLabel = new Map();
const firsts = [];
let chests = 0, lastGame = null, stuck = null;

for (const seed of SEEDS) {
  let s = seed;
  Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

  const g = new Game();
  window.game = g;
  lastGame = g;
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

  const realOpen = g.ui.openChest.bind(g.ui);
  g.ui.openChest = function () {
    realOpen();
    const label = g.ui.el.chestRarity.textContent || "?";
    const rows = (g.ui.el.chestList.innerHTML.match(/chest-row/g) || []).length;
    const k = label.split(" ·")[0];
    const e = byLabel.get(k) || { n: 0, tiers: 0 };
    e.n++; e.tiers += rows;
    byLabel.set(k, e);
    g.ui.closeChest();
  };

  /* Imortal DE VERDADE, e nao so curado a cada quadro.

     O laco abaixo repunha a vida antes de cada `update`, e isso vaza: a morte
     acontece DENTRO do update, e este driver teleporta o jogador para cima de
     cada bau — ou seja, para o meio da horda, que e onde o encosto cobra mais.
     Quando a run morria o `state` travava em GAMEOVER, nenhum bau nascia depois
     disso, e a cadencia de 12 min era medida sobre a run que sobrou. Com a seed
     fixa em 7 dava certo por sorte; em 2 de 6 seeds nao dava.

     Aqui o teste e o BAU. Sobrevivencia e assunto de `driver_balance`, e deixar
     ela decidir este numero e o que fazia o driver reprovar por motivo errado. */
  g.damagePlayer = () => {};

  g.start(STARTER_TESTE);

  const steps = Math.round((MIN * 60) / (1 / 60));
  for (let i = 0; i < steps; i++) {
    const ang = i * 0.008;
    g.input.keys = new Set([Math.cos(ang) > 0 ? "d" : "a", Math.sin(ang) > 0 ? "s" : "w"]);
    // teleporte para cima do baú mais próximo: aqui o teste é o prêmio, não a
    // habilidade de andar até ele
    const pk = g.pickups.active.find((p) => p.item.id === "chest");
    if (pk) { g.player.x = pk.x; g.player.y = pk.y; }
    g.update(1 / 60);
  }

  chests += spawnedAt.length;
  firsts.push(spawnedAt[0]);
  if (g.state !== STATE.PLAYING && !stuck) stuck = `seed ${seed}: ${g.state}`;
  console.log(`  seed ${String(seed).padStart(3)}: ${String(spawnedAt.length).padStart(3)} baus, 1o aos ` +
    `${spawnedAt[0] == null ? "-" : spawnedAt[0].toFixed(0) + "s"}`);
}

const fail = [];
const perMin = chests / (MIN * SEEDS.length);
const late = firsts.filter((f) => f == null || f > BALANCE.spawn.chestAt + 5);
console.log(`baus: ${chests} em ${SEEDS.length} runs de ${MIN} min (${perMin.toFixed(1)}/min)`);

if (late.length) fail.push(`1o bau tarde demais em ${late.length} run(s): ${late.join(", ")}`);
if (perMin < 1) fail.push(`baus raros demais: ${perMin.toFixed(2)}/min`);

let opened = 0, tiers = 0;
for (const [k, e] of byLabel) {
  opened += e.n; tiers += e.tiers;
  console.log(`  ${k.padEnd(10)} ${String(e.n).padStart(3)}x  ${(e.tiers / e.n).toFixed(1)} tiers/bau`);
}
console.log(`abertos ${opened}, ${tiers} tiers gratis (${(tiers / opened).toFixed(2)} por bau)`);

const multi = [...byLabel].filter(([k]) => k !== "Comum").reduce((a, [, e]) => a + e.n, 0);
if (opened && multi / opened < 0.4) fail.push(`prêmio grande raro demais: ${(multi / opened * 100).toFixed(0)}% dos baús`);
if (stuck) fail.push(`estado preso em ${stuck}`);

if (fail.length) { for (const f of fail) console.log("FALHA " + f); throw new Error(fail.length + " falha(s)"); }
console.log("ok  cadencia e premio do bau");

// leitura de saída: como a build da última run terminou com os baús contando
const shape = [];
for (const inst of lastGame.build.pieces.values()) {
  shape.push(inst.def.name + "[" + Object.keys(inst.def.paths).map((p) => inst.paths[p]).join("") + "]");
}
console.log("build: " + shape.join(", "));
console.log(`nivel ${lastGame.player.level}, ${lastGame.player.kills} abates`);
