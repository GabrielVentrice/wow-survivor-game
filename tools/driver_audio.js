/* Som de morte: o grafo de audio precisa ser construido de verdade, com os
   quatro timbres do catalogo, sem estourar rampa exponencial. */
let s = 5;
Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };
const g = new Game(); window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
/* A etapa tambem para o update. Sem resolver ela, a "run de 4 min" media 40
   segundos de jogo e chamava de quatro minutos — o driver mediria o silencio
   de um jogo pausado. Nao interessa a escolha aqui, so que o jogo volte a
   andar: quem mede etapa e `driver_milestone`. */
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
g.start(STARTER_TESTE);

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

// a amostra de osso precisa decodificar e ser realmente usada
g.sfx.init();
if (!g.sfx.bone) fail("amostra de osso nao decodificou");
else console.log(`  ok amostra de osso decodificada (${g.sfx.bone.duration.toFixed(3)}s)`);

/* Piso por corpo: estalo + esmagamento + baque saem SEMPRE (3 fontes). Grunhido
   e guincho de fel so sao garantidos acima de 0.3 de peso — abaixo disso eles
   sao sorteados de proposito, para a horda inteira nao guinchar em coro. Exigir
   4+ de um ghoul e exigir que o sorteio caia de um jeito so, e o teste passa a
   quebrar quando qualquer outro codigo consome o gerador antes dele. */
for (const id in ENEMIES) {
  const t = ENEMIES[id];
  const heft = t.boss ? 1 : Math.min(1, Math.max(0, (t.radius - 12) / 26));
  const min = heft > 0.3 ? 5 : 3;
  __audio.nodes = 0; __audio.samples = 0;
  g.clock += 1;                       // afasta do throttle
  try { g.sfx.death(heft, t.deathSfx); }
  catch (e) { fail(`${id}: ${e.message}`); continue; }
  if (__audio.nodes < min) fail(`${id}: so ${__audio.nodes} fontes de som (esperado ${min}+)`);
  else if (!__audio.samples) fail(`${id}: nao tocou a amostra de osso`);
  else console.log(`  ok ${t.name.padEnd(18)} timbre "${t.deathSfx}" peso ${heft.toFixed(2)} -> ` +
                   `${__audio.nodes} fontes (${__audio.samples} de osso)`);
}

/* E os extras sorteados precisam existir de fato: em 40 mortes de corpo leve,
   pelo menos uma tem que passar de 3 fontes. Sem isto, um bug que apagasse
   grunhido e guincho dos pequenos passaria batido pelo piso acima. */
let extras = 0;
for (let i = 0; i < 40; i++) {
  __audio.nodes = 0;
  g.clock += 1;
  g.sfx.death(0.05, "flesh");
  if (__audio.nodes > 3) extras++;
}
if (!extras) fail("corpo leve nunca sorteou grunhido nem guincho em 40 mortes");
else console.log(`  ok extras sorteados no corpo leve: ${extras}/40 mortes`);

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

// rugido de chefe: precisa ser bem mais denso que uma morte comum
__audio.nodes = 0;
g.clock += 2;
try { g.sfx.boss(); } catch (e) { fail("rugido de chefe: " + e.message); }
const roar = __audio.nodes;
if (roar < 4) fail(`rugido de chefe com so ${roar} fontes`);
else console.log(`  ok rugido de chefe -> ${roar} fontes`);

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
g.start(STARTER_TESTE);
for (let i = 0; i < 60 * 60 * 4; i++) {
  g.player.hp = g.player.maxHp;
  g.input.keys = new Set(["d", "s"]);
  try { g.update(1 / 60); } catch (e) { fail(`durante o jogo aos ${g.elapsed.toFixed(0)}s: ${e.message}`); break; }
}
console.log(`  ok 4 min de jogo -> ${__audio.nodes} fontes de som criadas, ${g.player.kills} abates`);

// se a amostra nao existir, o sintetico tem que assumir — nunca silencio
const guardado = g.sfx.bone;
g.sfx.bone = null;
__audio.nodes = 0; __audio.samples = 0;
g.clock += 2;
g.sfx.death(0.5, "bone");
if (__audio.samples) fail("tocou amostra mesmo sem buffer");
else if (__audio.nodes < 4) fail(`sem a amostra, o sintetico so fez ${__audio.nodes} fontes`);
else console.log(`  ok sem a amostra, os estalos sinteticos assumem (${__audio.nodes} fontes)`);
g.sfx.bone = guardado;

/* =========================================================================
   AS VOZES DE COMBATE

   Antes desta camada o combate era mudo: nenhuma peca tocava nada. As quatro
   perguntas abaixo sao as que decidem se ele volta a ser mudo — ou se vira
   lama, que e o outro jeito de nao dizer nada.
   ========================================================================= */
console.log("");
g.sfx.muted = false;
g.sfx.init();

// 1. toda voz do registry monta um grafo sem estourar rampa
for (const name in VOICES) {
  __audio.nodes = 0;
  g.clock += 5;                                   // longe do gap de qualquer voz
  g.sfx._voiceBurst = 0;
  try { g.sfx.say(name, { dist: 0, size: 0.6 }); }
  catch (e) { fail(`voz "${name}": ${e.message}`); continue; }
  if (!__audio.nodes) fail(`voz "${name}" nao criou nenhuma fonte`);
}
if (!fails) console.log(`  ok as ${Object.keys(VOICES).length} vozes montam o grafo`);

// 2. o gap por voz segura a densidade. Sem ele uma build madura vira zumbido.
const alvo = "hit", gap = VOICES[alvo].gap;
g.clock += 5;
let tocou = 0;
for (let i = 0; i < 40; i++) {                    // 40 acertos em 0.4s de jogo
  __audio.nodes = 0;
  g.clock += 0.01;
  g.sfx.say(alvo, { dist: 0, size: 0 });
  if (__audio.nodes) tocou++;
}
const teto = Math.ceil(0.4 / gap) + 1;
if (tocou > teto) fail(`gap de "${alvo}" nao segurou: ${tocou} sons em 0.4s (teto ${teto})`);
else console.log(`  ok gap por voz: 40 acertos em 0.4s -> ${tocou} sons`);

// 3. evento longe da tela nao e nem agendado
g.clock += 5;
__audio.nodes = 0;
g.sfx.say("burst", { dist: SFX_RANGE + 200, size: 1 });
if (__audio.nodes) fail("voz agendada alem de SFX_RANGE");
else console.log(`  ok fora de ${SFX_RANGE} unidades a voz nao existe`);

// 4. mudo silencia as vozes tambem
g.sfx.muted = true;
g.clock += 5;
__audio.nodes = 0;
g.sfx.say("burst", { dist: 0, size: 1 });
if (__audio.nodes) fail("tocou voz de combate com o audio mudo (M)");
else console.log("  ok mudo (M) silencia as vozes de combate");
g.sfx.muted = false;

/* 5. e o combate precisa REALMENTE soar durante o jogo. Este e o teste que
   pega o caso que motivou a fase: o grafo perfeito, o registry completo, e
   nenhuma chamada partindo do jogo. */
const antesVoz = {};
for (const k in g.sfx._voiceAt) antesVoz[k] = 1;
g.start(STARTER_TESTE);
g.sfx._voiceAt = {};
__audio.nodes = 0;
for (let i = 0; i < 60 * 90; i++) {
  g.player.hp = g.player.maxHp;
  g.input.keys = new Set(["d", "s"]);
  g.update(1 / 60);
}
const faladas = Object.keys(g.sfx._voiceAt);
const mudas = ["cast", "hit"].filter((k) => faladas.indexOf(k) < 0);
if (mudas.length) fail("90s de jogo sem tocar: " + mudas.join(", "));
else console.log(`  ok 90s de jogo -> ${faladas.length} vozes diferentes usadas: ` + faladas.join(", "));

console.log(fails ? `\nX ${fails} falhas` : "\nok som de morte e vozes de combate validados");
if (fails) __exit(1);
