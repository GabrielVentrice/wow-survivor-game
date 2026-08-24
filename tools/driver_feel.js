/* =========================================================================
   FEEL — a camada de impacto: hitstop, soco de câmera e curvas de evento.

   Nada aqui é balanceamento e nada aqui é conteúdo. É o que faz um acerto
   ATERRISSAR em vez de apenas acontecer, e são exatamente as três coisas que
   não se revisam jogando: um hitstop mal limitado só aparece depois de a build
   ficar grande, um tremor que voltou a ser ruído branco só aparece em
   movimento, e uma curva linear parece "ok" isolada e genérica no conjunto.

   As três armadilhas que este driver existe para pegar:

   1. **Hitstop sem teto.** Ele para a SIMULAÇÃO. Com dezenas de acertos
      grandes por segundo no fim da run, um stop por acerto é apresentação de
      slides — e o jogador lê isso como travamento, não como impacto.
   2. **Hitstop no relógio errado.** Preso ao `clock` (escalado), um stop de
      50ms dura 150ms no timeScale 3.
   3. **Tremor sem continuidade.** `Math.random()` por frame não é tremor, é
      chuvisco: o desvio salta para um ponto novo da caixa a cada frame. O
      teste é o passo entre frames contra a amplitude — ruído branco salta até
      o dobro da amplitude, oscilação nunca passa dela.
   ========================================================================= */
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

const g = new Game(); window.game = g;
let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };
const S = BALANCE.camera.shake;
const HS = BALANCE.camera.hitstop;

/* --- curvas ---------------------------------------------------------------
   Uma curva de saída tem que ser adiantada: no primeiro quarto da vida o
   evento já andou mais da metade do caminho. Se `e(0.25) <= 0.25` ela voltou
   a ser linear e o efeito lê como círculo sendo apagado. */
for (const [name, fn, front] of [["outCubic", outCubic, true],
                                 ["outQuint", outQuint, true],
                                 ["inCubic", inCubic, false]]) {
  if (Math.abs(fn(0)) > 1e-9 || Math.abs(fn(1) - 1) > 1e-9) {
    fail(`${name} nao vai de 0 a 1 (${fn(0)} .. ${fn(1)})`);
    continue;
  }
  let mono = true;
  for (let i = 1; i <= 100; i++) if (fn(i / 100) < fn((i - 1) / 100)) mono = false;
  if (!mono) fail(`${name} nao e monotonica`);
  else if (front && fn(0.25) <= 0.5) fail(`${name}(0.25) = ${fn(0.25).toFixed(2)} — nao e adiantada, e reta`);
  else if (!front && fn(0.25) >= 0.25) fail(`${name}(0.25) = ${fn(0.25).toFixed(2)} — deveria ser atrasada`);
}
if (!fails) console.log("  ok curvas de impacto adiantadas e monotonicas");

/* --- o tremor é uma oscilação, não chuvisco ------------------------------- */
function trace(mag, dx, dy, frames = 90) {
  g.camera.resetShake();
  g.camera.addTrauma(mag, dx, dy);
  const out = [];
  for (let i = 0; i < frames; i++) { g.camera.updateShake(1 / 60); out.push([g.camera.ox, g.camera.oy]); }
  return out;
}

const t = trace(22, 1, 0);
let peak = 0, jump = 0;
for (let i = 0; i < t.length; i++) {
  peak = Math.max(peak, Math.abs(t[i][0]), Math.abs(t[i][1]));
  if (i) jump = Math.max(jump, Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1]));
}
// ruido branco de amplitude A salta ate 2A entre frames; oscilacao amostrada
// 7x por ciclo nunca chega perto disso
const ratio = jump / peak;
if (ratio > 1.2) fail(`tremor salta ${ratio.toFixed(2)}x a amplitude entre frames — voltou a ser ruido`);
else console.log(`  ok tremor continuo (passo maximo ${ratio.toFixed(2)}x a amplitude, pico ${peak.toFixed(1)})`);

if (peak > S.max + 1e-6) fail(`pico ${peak.toFixed(1)} passou do teto ${S.max}`);

// silencia, e silencia zerado
const tail = trace(22, 1, 0, 120);
const last = tail[tail.length - 1];
if (last[0] !== 0 || last[1] !== 0) fail(`tremor nao zerou em 2s (${last[0].toFixed(3)})`);
else {
  let q = tail.findIndex(([a, b]) => a === 0 && b === 0);
  console.log(`  ok tremor morre em ${(q / 60).toFixed(2)}s e zera de verdade`);
}

/* --- e ele aponta para onde o golpe foi ----------------------------------- */
let wrong = 0, sideways = 0;
for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, -0.7], [-0.3, 0.95]]) {
  const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const p = trace(22, dx, dy, 1)[0];
  const along = p[0] * ux + p[1] * uy;              // componente no eixo do golpe
  const across = Math.abs(p[0] * -uy + p[1] * ux);  // e fora dele
  if (along < S.max * 0.9) wrong++;                 // o primeiro quadro E o soco
  if (across > Math.abs(along) * S.lateral) sideways++;
}
if (wrong) fail(`${wrong}/6 socos nao saem na direcao do golpe`);
else if (sideways) fail(`${sideways}/6 socos desviam mais que \`lateral\` do eixo`);
else console.log("  ok o soco sai na direcao do golpe em 6/6 direcoes");

// evento sem direcao ainda tem UM eixo — o que nao pode existir e eixo novo por frame
g.camera.resetShake();
g.camera.addTrauma(22);
const a0 = [g.camera.dx, g.camera.dy];
for (let i = 0; i < 10; i++) g.camera.updateShake(1 / 60);
if (g.camera.dx !== a0[0] || g.camera.dy !== a0[1]) fail("o eixo do tremor mudou no meio do evento");

// e nao acumula: cem eventos no mesmo frame nao arremessam a camera
g.camera.resetShake();
for (let i = 0; i < 100; i++) g.camera.addTrauma(22, Math.cos(i), Math.sin(i));
g.camera.updateShake(1 / 60);
const sat = Math.hypot(g.camera.ox, g.camera.oy);
if (sat > S.max * 1.05) fail(`100 eventos num frame deram ${sat.toFixed(1)} de desvio (teto ${S.max})`);
else console.log(`  ok 100 eventos num frame saturam em ${sat.toFixed(1)}, nao somam`);

/* --- hitstop: no relógio real, e com teto --------------------------------- */
g.ui.openLevelUp = function () {
  const o = g.build.getOffers(3);
  if (!o.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
  g.ui.applyOffer(o[Math.floor(Math.random() * o.length)]);
};
g.ui.openChest = () => { g.state = STATE.PLAYING; };

/* O mesmo stop, medido em duas velocidades. Se o hitstop vivesse no relógio de
   simulação, o de 3x duraria três vezes mais frames — e o jogo rápido seria o
   que mais trava. */
const held = {};
for (const speed of [1, 3]) {
  g.selectedSpeed = speed;
  g.start(STARTER_TESTE);
  g._hitstop = 0; g._hitstopCd = 0;
  g.addHitstop(HS.boss, true);
  let n = 0;
  for (let i = 0; i < 60 && g._hitstop > 0; i++) { g._hitstop -= 1 / 60; n++; }
  held[speed] = n;
}
if (held[1] !== held[3]) fail(`hitstop durou ${held[1]} frames a 1x e ${held[3]} a 3x — esta no relogio escalado`);
else console.log(`  ok hitstop dura ${held[1]} frames em qualquer velocidade (relogio real)`);

/* Run completa pelo `_loop`, que é onde o hitstop mora: quanto do tempo REAL
   o jogo passa congelado quando a build fica grande? */
g.selectedSpeed = 1;
g.start(STARTER_TESTE);
const FR = 1 / 60;
const MIN = Number(__argv[1] || 8);
const steps = Math.round((MIN * 60) / FR);
let now = 0, frozen = 0, runs = 0, streak = 0, worstStreak = 0, wasFrozen = false;
let died = 0;
for (let i = 0; i < steps; i++) {
  const ang = i * 0.008;
  g.input.keys = new Set(((i / 500) % 1) > 0.8 ? [] : [Math.cos(ang) > 0 ? "d" : "a", Math.sin(ang) > 0 ? "s" : "w"]);
  const before = g.clock;
  now += FR * 1000;
  g._loop(now);
  if (g.state === STATE.GAMEOVER) { died = g.elapsed; break; }
  if (g.clock === before && g.state === STATE.PLAYING) {
    frozen++; streak++; worstStreak = Math.max(worstStreak, streak);
    if (!wasFrozen) runs++;
    wasFrozen = true;
  } else { streak = 0; wasFrozen = false; }
}
const pct = (frozen / steps) * 100;
// Teto pela cadencia: um stop de `boss` a cada `cooldown` é o pior caso legal.
const ceiling = (HS.boss / (HS.boss + HS.cooldown)) * 100;
if (pct > ceiling) fail(`${pct.toFixed(1)}% do tempo real congelado — a cadencia nao esta segurando (teto ${ceiling.toFixed(0)}%)`);
else console.log(`  ok ${pct.toFixed(1)}% do tempo congelado em ${MIN} min — ${(runs / (steps / 60)).toFixed(2)} stops/s (teto ${ceiling.toFixed(0)}%)`);

const maxFrames = Math.ceil(HS.boss * 60) + 1;
if (worstStreak > maxFrames) fail(`${worstStreak} frames congelados seguidos (o maior stop cabe em ${maxFrames})`);
else console.log(`  ok o stop mais longo segurou ${worstStreak} frames (limite ${maxFrames})`);

if (died) console.log(`  -- o piloto morreu aos ${died.toFixed(0)}s; a medida vale ate ali`);

/* Encosto (`touch`) cobra por sub-step enquanto houver contato. Um stop por
   cobrança faria o jogo arrastar exatamente quando a horda fecha.

   The pilot's HP is pinned across the loop on purpose: 120 charges of 1 on a
   100 HP bar kills him, and a dead pilot stops the clock for the same reason a
   hitstop does. Without the pin this asserts on how long he survives, not on
   whether the charge froze anything — it passed or failed on leftover state
   from the run above. */
g.start(STARTER_TESTE);
g._hitstop = 0; g._hitstopCd = 0;
const cl0 = g.clock;
for (let i = 0; i < 120; i++) {
  g.damagePlayer(1, "touch");
  g.player.hp = g.player.maxHp;
  now += FR * 1000; g._loop(now);
}
if (g.clock - cl0 < FR * 100) fail(`dano de encosto congelou o jogo (${(g.clock - cl0).toFixed(2)}s de 2s)`);
else console.log("  ok dano de encosto nao para o jogo");

console.log(fails ? `\nFALHOU: ${fails} problema(s)` : "\nok camada de impacto validada");
if (fails) throw new Error("driver_feel");
