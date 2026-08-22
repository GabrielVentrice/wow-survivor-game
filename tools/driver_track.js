/* Trilha em arquivo: os três caminhos precisam funcionar — arquivo carrega,
   arquivo falha (cai para a procedural) e arquivo ainda carregando (o menu
   não pode ficar mudo esperando 1 MB). */
let s = 13;
Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

function novoJogo() {
  __track.reset();
  const g = new Game();
  window.game = g;
  g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
  g.ui.openChest = () => { g.state = STATE.PLAYING; };
  return g;
}

/* --- 1. arquivo carrega -------------------------------------------------- */
let g = novoJogo();
g.enableAudio();
if (__track.els.length !== 2) fail(`esperava 2 elementos de audio, veio ${__track.els.length}`);
__track.succeed();
g.music.update(1 / 60);
if (!g.music.usingFile) fail("arquivo pronto mas a trilha nao assumiu");
else console.log("  ok arquivo pronto -> Soundtrack usa o arquivo");
if (g.music.proc.on) fail("a trilha procedural continuou tocando junto com o arquivo");
else console.log("  ok procedural sai de cena quando o arquivo entra");

g.start();
for (let i = 0; i < 240; i++) g.music.update(1 / 60);
const vJogo = __track.els[g.music.file.cur].volume;
// compara com a constante, nao com um numero magico: baixar o volume da
// trilha nao pode quebrar o teste
if (Math.abs(vJogo - TRACK_LEVEL.playing) > 0.02) {
  fail(`volume em jogo ${vJogo.toFixed(2)}, esperado ${TRACK_LEVEL.playing}`);
} else console.log(`  ok volume converge para ${vJogo.toFixed(2)} em jogo (nivel de fundo)`);

g.togglePause();
for (let i = 0; i < 200; i++) g.music.update(1 / 60);
const vPausa = __track.els[g.music.file.cur].volume;
if (!(vPausa < vJogo * 0.7)) fail(`pausa nao abaixou (${vPausa.toFixed(2)} vs ${vJogo.toFixed(2)})`);
else console.log(`  ok pausa abaixa para ${vPausa.toFixed(2)}`);
g.resume();
for (let i = 0; i < 200; i++) g.music.update(1 / 60);

/* --- cruzamento na volta do loop ---------------------------------------- */
const f = g.music.file;
const antes = f.cur;
const a = __track.els[antes], b = __track.els[1 - antes];
a.currentTime = a.duration - 3.0;          // entra na janela de cruzamento
g.music.update(1 / 60);
if (!f.swapping) fail("nao iniciou o cruzamento perto do fim do clipe");
else if (!b.playing) fail("o segundo elemento nao comecou a tocar no cruzamento");
else console.log("  ok cruzamento comeca antes do fim do clipe");
let passos = 0;
while (f.swapping && passos++ < 400) {
  a.currentTime = Math.min(a.duration, a.currentTime + 1 / 60);
  g.music.update(1 / 60);
}
if (f.cur === antes) fail("o cruzamento nao trocou o elemento ativo");
else if (a.playing) fail("o elemento antigo continuou tocando depois da troca");
else console.log(`  ok troca concluida em ${passos} frames, sem emenda audivel`);

/* --- mudo ---------------------------------------------------------------- */
g.music.setMuted(true);
for (let i = 0; i < 200; i++) g.music.update(1 / 60);
const vMudo = __track.els[f.cur].volume;
if (vMudo > 0.01) fail(`N nao silenciou o arquivo (${vMudo.toFixed(3)})`);
else console.log("  ok N silencia o arquivo");
g.music.setMuted(false);

/* --- game over e restart ------------------------------------------------- */
g.music.setState("gameover");
g.music.update(1 / 60);
if (f.playing) fail("game over nao parou a trilha");
else console.log("  ok game over para a trilha");
g.start();
g.music.update(1 / 60);
if (!f.playing) fail("restart nao voltou a tocar");
else console.log("  ok restart volta a tocar do inicio");

/* --- 2. arquivo falha: nao pode ficar mudo ------------------------------- */
g = novoJogo();
g.enableAudio();
__track.fail();
g.music.update(1 / 60);
if (g.music.usingFile) fail("arquivo falhou mas a trilha continuou apostando nele");
g.start();
__audio.nodes = 0;
for (let i = 0; i < 400; i++) { g.clock += 0.05; g.music.update(1 / 60); }
if (__audio.nodes < 20) fail(`fallback procedural nao tocou (${__audio.nodes} notas)`);
else console.log(`  ok arquivo falhou -> procedural assume (${__audio.nodes} notas)`);

/* --- 3. arquivo ainda carregando: o menu nao fica mudo ------------------- */
g = novoJogo();
g.enableAudio();
__audio.nodes = 0;
for (let i = 0; i < 400; i++) { g.clock += 0.05; g.music.update(1 / 60); }
if (__audio.nodes < 20) fail(`silencio enquanto o arquivo carrega (${__audio.nodes} notas)`);
else console.log(`  ok enquanto carrega, a procedural cobre o menu (${__audio.nodes} notas)`);
__track.succeed();
g.music.update(1 / 60);
if (!g.music.usingFile) fail("nao trocou para o arquivo quando ele ficou pronto");
else console.log("  ok troca para o arquivo assim que ele fica pronto");

console.log(fails ? `\nX ${fails} falhas` : "\nok trilha em arquivo validada");
if (fails) __exit(1);
