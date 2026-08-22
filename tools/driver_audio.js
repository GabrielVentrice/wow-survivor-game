/* Som de morte: o grafo de audio precisa ser construido de verdade, com os
   quatro timbres do catalogo, sem estourar rampa exponencial. */
let s = 5;
Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };
const g = new Game(); window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
g.start();

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

for (const id in ENEMIES) {
  const t = ENEMIES[id];
  const heft = t.boss ? 1 : Math.min(1, Math.max(0, (t.radius - 12) / 26));
  __audio.nodes = 0;
  g.clock += 1;                       // afasta do throttle
  try { g.sfx.death(heft, t.deathSfx); }
  catch (e) { fail(`${id}: ${e.message}`); continue; }
  if (__audio.nodes < 4) fail(`${id}: so ${__audio.nodes} fontes de som (esperado 4+)`);
  else console.log(`  ok ${t.name.padEnd(18)} timbre "${t.deathSfx}" peso ${heft.toFixed(2)} -> ${__audio.nodes} fontes`);
}

// chacina: o throttle e o duck precisam segurar sem quebrar nem emudecer
__audio.nodes = 0;
let played = 0;
for (let i = 0; i < 400; i++) {
  g.clock += 0.02;
  const before = __audio.nodes;
  try { g.sfx.death(Math.random(), i % 3 === 0 ? "bone" : "flesh"); }
  catch (e) { fail(`chacina: ${e.message}`); break; }
  if (__audio.nodes > before) played++;
}
console.log(`  ok chacina de 400 mortes em 8s -> ${played} sons tocados, ${__audio.nodes} fontes`);
if (played === 0) fail("throttle engoliu todas as mortes");
if (played > 260) fail(`throttle nao segurou nada (${played} de 400)`);

// mudo continua mudo
g.sfx.muted = true;
__audio.nodes = 0;
g.clock += 1;
g.sfx.death(1, "flesh");
if (__audio.nodes) fail("tocou som com o audio mudo (M)");
else console.log("  ok mudo (M) silencia a morte");
g.sfx.muted = false;

// e a run inteira nao pode estourar nada
__audio.nodes = 0;
g.start();
for (let i = 0; i < 60 * 60 * 4; i++) {
  g.player.hp = g.player.maxHp;
  g.input.keys = new Set(["d", "s"]);
  try { g.update(1 / 60); } catch (e) { fail(`durante o jogo aos ${g.elapsed.toFixed(0)}s: ${e.message}`); break; }
}
console.log(`  ok 4 min de jogo -> ${__audio.nodes} fontes de som criadas, ${g.player.kills} abates`);

console.log(fails ? `\nX ${fails} falhas` : "\nok som de morte validado");
if (fails) __exit(1);
