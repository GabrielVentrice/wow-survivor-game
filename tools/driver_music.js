/* Trilha: o agendador precisa marcar notas continuamente, sem repetir nem
   pular passos, e a intensidade tem que responder ao estado do jogo. */
let s = 9;
Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };
const g = new Game(); window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

// o relogio do stub segue game.clock, entao a trilha avanca com a simulacao
g.start();
if (!g.music.ctx) fail("trilha nao pegou o AudioContext no start()");
if (!g.music.on) fail("trilha nao ligou no start()");

__audio.nodes = 0;
for (let i = 0; i < 60 * 30; i++) {           // 30s de jogo
  g.player.hp = g.player.maxHp;
  g.input.keys = new Set(["d"]);
  g.update(1 / 60);
  g.music.update();
}
const barras = g.music.step / MUSIC.stepsPerBar;
console.log(`  ok 30s -> passo ${g.music.step} (${barras.toFixed(1)} compassos), ${__audio.nodes} notas`);
const esperado = 30 / (60 / MUSIC.bpm / 2);
if (Math.abs(g.music.step - esperado) > esperado * 0.12) {
  fail(`andamento errado: passo ${g.music.step}, esperado ~${esperado.toFixed(0)}`);
} else console.log(`  ok andamento bate com ${MUSIC.bpm} BPM (esperado ~${esperado.toFixed(0)} passos)`);
if (__audio.nodes < 100) fail(`so ${__audio.nodes} notas em 30s`);

// a fila nunca pode ficar para tras nem disparar em rajada
const antes = g.music.step;
g.music.update();
if (g.music.step - antes > 32) fail("agendador disparou uma rajada de passos");
else console.log("  ok a fila nao dispara em rajada num mesmo frame");

// intensidade sobe com o tempo e vai ao teto com chefe em campo
const k0 = g.musicIntensity();
g.elapsed = BALANCE.spawn.hardAt + 10;
const k1 = g.musicIntensity();
g.bossAlive = 1;
const k2 = g.musicIntensity();
if (!(k1 > k0)) fail(`fase dura nao subiu a intensidade (${k0.toFixed(2)} -> ${k1.toFixed(2)})`);
else if (k2 !== 1) fail(`chefe em campo nao levou ao teto (${k2})`);
else console.log(`  ok intensidade ${k0.toFixed(2)} -> ${k1.toFixed(2)} (fase dura) -> ${k2.toFixed(2)} (chefe)`);

// cada camada da orquestracao precisa existir de fato
const stepDur = 60 / MUSIC.bpm / 2;
const camadas = [
  ["_choir", "coro"], ["_drum", "tambor"], ["_brass", "metais"],
  ["_horn", "trompa"], ["_tremolo", "cordas"], ["_impact", "impacto"],
  ["_voice", "baixo"],
];
const usadas = {};
for (const [fn] of camadas) {
  const orig = g.music[fn].bind(g.music);
  g.music[fn] = (...a) => { usadas[fn] = (usadas[fn] || 0) + 1; return orig(...a); };
}
g.music.intensity = 1; g.music.state = "playing";
__audio.nodes = 0;
for (let i = 0; i < MUSIC.stepsPerBar * MUSIC.bars; i++) g.music._scheduleStep(i, 0, stepDur);
console.log(`  ok um loop completo no talo -> ${__audio.nodes} notas`);
for (const [fn, nome] of camadas) {
  if (!usadas[fn]) fail(`camada "${nome}" nunca toca no talo`);
}
console.log(`  ok camadas: ${camadas.map(([f, n]) => n + "×" + (usadas[f] || 0)).join(", ")}`);
if (__audio.nodes < 60) fail("as camadas de alta intensidade nao entraram");

// a progressao tem que DESCER: e o tetracorde frigio que faz soar Legiao
const baixos = MUSIC.chords.map((c) => c.bass);
for (let i = 1; i < baixos.length; i++) {
  if (baixos[i] >= baixos[i - 1]) fail(`baixo nao desce em ${MUSIC.chords[i].name} (${baixos.join(",")})`);
}
console.log(`  ok baixo desce ${MUSIC.chords.map((c) => c.name).join(" - ")} (${baixos.join(", ")})`);
// o V precisa ser MAIOR: e a terca maior que da o gosto de frigio dominante
const V = MUSIC.chords[3];
if ((V.notes[1] - V.notes[0]) !== 4) fail(`o acorde ${V.name} nao e maior (terca de ${V.notes[1] - V.notes[0]} semitons)`);
else console.log(`  ok ${V.name} vem maior (terca de 4 semitons = frigio dominante)`);

// no menu a trilha e mais rala que no jogo
g.music.intensity = 0; g.music.state = "menu";
__audio.nodes = 0;
for (let i = 0; i < MUSIC.stepsPerBar * MUSIC.bars; i++) g.music._scheduleStep(i, 0, stepDur);
const menuNotes = __audio.nodes;
g.music.intensity = 1; g.music.state = "playing";
__audio.nodes = 0;
for (let i = 0; i < MUSIC.stepsPerBar * MUSIC.bars; i++) g.music._scheduleStep(i, 0, stepDur);
if (!(menuNotes < __audio.nodes)) fail(`menu (${menuNotes}) nao e mais ralo que o jogo (${__audio.nodes})`);
else console.log(`  ok menu ${menuNotes} notas x jogo no talo ${__audio.nodes} notas`);

// mudo de verdade
g.music.setMuted(true);
__audio.nodes = 0;
for (let i = 0; i < 200; i++) { g.clock += 0.05; g.music.update(); }
if (__audio.nodes) fail("trilha tocou com N acionado");
else console.log("  ok N silencia a trilha");
g.music.setMuted(false);

// pausa, game over e volta ao menu nao podem quebrar
try {
  g.togglePause(); g.music.update();
  g.resume(); g.music.update();
  g.gameOver(); g.music.update();
  g.quitToMenu(); g.music.update();
  g.start(); g.music.update();
  console.log("  ok pausa / game over / menu / restart sem erro");
} catch (e) { fail("transicao de estado: " + e.message); }

console.log(fails ? `\nX ${fails} falhas` : "\nok trilha validada");
if (fails) __exit(1);
