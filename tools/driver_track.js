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
  // A etapa tambem PARA o update: sem resolve-la o driver rodaria ate o
  // primeiro marco e chamaria de minutos. Quem mede etapa e `driver_milestone`.
  g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
  return g;
}

/* --- 1. arquivo carrega -------------------------------------------------- */
let g = novoJogo();
g.enableAudio();
// a faixa do jogo emenda sozinha, entao um elemento basta
if (__track.els.length !== 1) fail(`esperava 1 elemento de audio (seamless), veio ${__track.els.length}`);
__track.succeed();
g.music.update(1 / 60);
if (!g.music.usingFile) fail("arquivo pronto mas a trilha nao assumiu");
else console.log("  ok arquivo pronto -> Soundtrack usa o arquivo");
if (g.music.proc.on) fail("a trilha procedural continuou tocando junto com o arquivo");
else console.log("  ok procedural sai de cena quando o arquivo entra");

g.start(STARTER_TESTE);
for (let i = 0; i < 240; i++) g.music.update(1 / 60);
const vJogo = __track.els[g.music.file.cur].volume;
// compara com a constante, nao com um numero magico: baixar o volume da
// trilha nao pode quebrar o teste
if (Math.abs(vJogo - TRACK_LEVEL.playing) > 0.02) {
  fail(`volume em jogo ${vJogo.toFixed(2)}, esperado ${TRACK_LEVEL.playing}`);
} else if (TRACK_LEVEL.playing > 0.1) {
  fail(`nivel ${TRACK_LEVEL.playing} nao e volume de fundo`);
} else console.log(`  ok volume converge para ${vJogo.toFixed(2)} em jogo (bem atras dos efeitos)`);

g.togglePause();
for (let i = 0; i < 200; i++) g.music.update(1 / 60);
const vPausa = __track.els[g.music.file.cur].volume;
if (!(vPausa < vJogo * 0.7)) fail(`pausa nao abaixou (${vPausa.toFixed(2)} vs ${vJogo.toFixed(2)})`);
else console.log(`  ok pausa abaixa para ${vPausa.toFixed(2)}`);
g.resume();
for (let i = 0; i < 200; i++) g.music.update(1 / 60);

/* --- a faixa do jogo emenda sozinha: loop nativo, um elemento só -------- */
const f = g.music.file;
if (!f.seamless) fail("a faixa do jogo deveria estar em modo seamless");
else if (__track.els.length !== 1) fail(`seamless deveria usar 1 elemento, usa ${__track.els.length}`);
else if (!__track.els[0].loop) fail("seamless nao ligou loop nativo no elemento");
else console.log("  ok faixa que emenda -> 1 elemento com loop nativo");
// e nao pode tentar cruzar: cruzar uma faixa que ja emenda dobra a batida
__track.els[0].currentTime = __track.els[0].duration - 0.5;
for (let i = 0; i < 60; i++) g.music.update(1 / 60);
if (f.swapping) fail("tentou cruzar uma faixa que emenda sozinha");
else console.log("  ok nao cruza: deixa a emenda nativa fazer a volta");

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
g.start(STARTER_TESTE);
g.music.update(1 / 60);
if (!f.playing) fail("restart nao voltou a tocar");
else console.log("  ok restart volta a tocar do inicio");

/* --- N liga e desliga -----------------------------------------------------
   TRACKS tem uma faixa so desde que a Tempestade saiu, entao o ciclo tem dois
   estados: tocando e mudo. */
g = novoJogo();
g.enableAudio();
if (__track.els.length !== 1) fail(`carregou ${__track.els.length} trilhas de uma vez`);
else console.log("  ok carrega so a trilha que vai tocar");
__track.succeed();
g.music.update(1 / 60);
if (g.music.trackName !== TRACKS[0].name) {
  fail(`o jogo abriu em "${g.music.trackName}", esperado "${TRACKS[0].name}"`);
} else console.log(`  ok o jogo abre em "${TRACKS[0].name}"`);

if (g.music.cycleTrack() !== null) fail("com uma trilha so, N deveria silenciar");
else if (!g.music.isMuted) fail("N nao silenciou");
else console.log("  ok fim do ciclo = mudo");
const volta = g.music.cycleTrack();
g.music.update(1 / 60);
if (g.music.isMuted) fail("N no mudo nao voltou a tocar");
else if (!volta || volta.id !== TRACKS[0].id) fail("do mudo nao voltou para a primeira trilha");
else console.log("  ok do mudo o ciclo volta para a primeira");

/* --- a maquina de troca, para quando houver duas de novo ------------------
   A Tempestade saiu de TRACKS, mas `Soundtrack` continua sabendo trocar. As
   tres coisas que a troca obriga — carregar so a que vai tocar, nao trocar
   antes de o arquivo novo estar pronto, e nao ficar mudo se ele nunca ficar —
   sao caras demais para so descobrir quebradas na proxima trilha que entrar.
   Por isso o teste monta a lista de duas em vez de ler TRACKS. */
const DUAS = [
  { id: "a", name: "Faixa A", src: "audio/faixa-a.mp3" },
  { id: "b", name: "Faixa B", src: "audio/faixa-b.mp3" },
];
g = novoJogo();
g.music = new Soundtrack(DUAS);
g.enableAudio();
if (__track.els.length !== 1) fail(`carregou ${__track.els.length} trilhas de uma vez`);
else console.log("  ok com duas na lista, so a que vai tocar baixa");
__track.succeed();
g.music.update(1 / 60);

const antigo = g.music.file;
const pedida = g.music.cycleTrack();
if (!pedida || pedida.id !== DUAS[1].id) fail("N nao pediu a segunda trilha");
g.music.update(1 / 60);
if (g.music.trackName !== DUAS[0].name) fail("trocou antes de o arquivo novo carregar");
else if (!antigo.playing) fail("ficou mudo esperando o download da trilha nova");
else console.log("  ok a antiga continua tocando enquanto a nova baixa");

const nova = __track.els[__track.els.length - 1];
(nova._l.canplaythrough || []).forEach((f) => f());
g.music.update(1 / 60);
if (g.music.trackName !== DUAS[1].name) fail("a trilha nova ficou pronta e nao entrou");
else if (antigo.playing) fail("as duas trilhas ficaram tocando juntas");
else console.log(`  ok pronta -> entra "${DUAS[1].name}" e a antiga para`);

/* trilha nova que nao carrega: fica a que ja estava, e nao silencio */
g = novoJogo();
g.music = new Soundtrack(DUAS);
g.enableAudio();
__track.succeed();
g.music.update(1 / 60);
g.music.cycleTrack();
const quebrada = __track.els[__track.els.length - 1];
(quebrada._l.error || []).forEach((f) => f());
for (let i = 0; i < 60; i++) g.music.update(1 / 60);
if (g.music.trackName !== DUAS[0].name) fail("trocou para uma trilha que falhou");
else if (!g.music.file.playing) fail("a trilha nova falhou e o jogo ficou mudo");
else console.log("  ok trilha nova que falha -> fica a que estava tocando");

/* --- o modo cruzado continua funcionando, para faixa que NAO emenda ----- */
__track.reset();
const xf = new Track("audio/qualquer.mp3", { crossfade: 3.5 });
xf.load();
if (xf.seamless) fail("crossfade:3.5 nao deveria virar seamless");
else if (__track.els.length !== 2) fail(`modo cruzado precisa de 2 elementos, criou ${__track.els.length}`);
else if (__track.els[0].loop) fail("modo cruzado nao pode usar loop nativo");
else console.log("  ok modo cruzado disponivel para faixa que nao emenda");
__track.succeed();
xf.setTarget(1); xf.play();
for (let i = 0; i < 90; i++) xf.update(1 / 60);
const xa = __track.els[xf.cur];
xa.currentTime = xa.duration - 3.0;
xf.update(1 / 60);
if (!xf.swapping) fail("modo cruzado nao iniciou o cruzamento");
else {
  let passos = 0;
  const antes = xf.cur;
  while (xf.swapping && passos++ < 400) {
    xa.currentTime = Math.min(xa.duration, xa.currentTime + 1 / 60);
    xf.update(1 / 60);
  }
  if (xf.cur === antes) fail("o cruzamento nao trocou o elemento ativo");
  else console.log(`  ok cruzamento troca de elemento em ${passos} frames`);
}

/* --- 2. arquivo falha: nao pode ficar mudo ------------------------------- */
g = novoJogo();
g.enableAudio();
__track.fail();
g.music.update(1 / 60);
if (g.music.usingFile) fail("arquivo falhou mas a trilha continuou apostando nele");
g.start(STARTER_TESTE);
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
