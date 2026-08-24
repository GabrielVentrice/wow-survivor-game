/* Driver: o PLACAR — a run sai do jogo e volta na pagina inicial.

   Este driver nao toca a rede, e isso nao e limitacao: a rede e a unica parte
   que o browser resolve sozinho (ou nao) e a unica que uma bateria headless
   nao pode afirmar nada sobre. O que ele guarda e o que quebra em SILENCIO —
   um parser que aceita lixo, um filtro que reprova run honesta, um nome de
   amigo que vira markup na pagina inicial de todo mundo.

   Seis promessas, e cada uma quebra de um jeito diferente:

     1. o payload viaja em INTEIRO       -> senao o Sheets ordena "9" > "12"
     2. o parser desembrulha o gviz      -> a resposta nao e JSON puro
     3. o filtro reprova o impossivel    -> e NUNCA a run honesta
     4. os limites saem do JOGO          -> nenhuma constante copiada
     5. o nome e ESCAPADO no desenho     -> a planilha e escrita por terceiros
     6. a camada local sobrevive sem rede -> ela e a metade que sempre funciona */

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

/* Uma run honesta de referencia, montada a mao no formato que sai da planilha.
   Os numeros sao os de uma run boa medida pelo driver_balance: ~10 min, poucos
   milhares de abates, nivel alto. */
const HONESTA = {
  nome: "GABRIEL", tempo_ms: 604000, abates: 4300, nivel: 31,
  dano: 44000, cadeia: 364, assinatura: "incinerate", eixos: "3/11/0",
  versao: "0.9",
};

/* --- 1. o payload: tudo inteiro ------------------------------------------ */
console.log("--- payload ---");
{
  const g = new Game();
  window.game = g;
  g.elapsed = 123.4567;
  g.player.kills = 812;
  g.player.level = 14;
  g.comboBest = 97;

  const run = Leaderboard.runFrom(g, 1234.56, "incinerate");
  for (const campo of ["tempo_ms", "abates", "nivel", "dano", "cadeia"]) {
    if (!Number.isInteger(run[campo])) {
      fail(`${campo} = ${run[campo]} nao e inteiro — o Forms grava texto e o`
         + " Sheets adivinha o tipo: fracao vira coluna de texto, e texto ordena"
         + ' "9" acima de "12"');
    }
  }
  if (run.tempo_ms !== 123457) fail(`tempo_ms errado: ${run.tempo_ms}`);
  if (run.eixos.split("/").length !== 3) fail(`eixos fora do formato: ${run.eixos}`);
  if (run.versao !== LB_CFG.versao) fail("a run nao carimba a versao do jogo");

  // Todo campo do form tem que existir no payload, senao a coluna sai vazia.
  for (const campo of LB_FIELDS) {
    if (!(campo in run)) fail(`o payload nao tem o campo "${campo}" que o form espera`);
    if (!LB.entry[campo]) fail(`o campo "${campo}" nao tem entry.<id> em LB.entry`);
  }
  console.log(`  ok ${LB_FIELDS.length} campos, numericos inteiros, versao ${run.versao}`);
}

/* --- 2. o parser: a resposta do gviz NAO e JSON --------------------------- */
console.log("--- parser ---");
{
  const linha = (r) => ({ c: LB_FIELDS.map((k) => ({ v: r[k] })) });
  const corpo = JSON.stringify({ table: { rows: [linha(HONESTA)] } });
  // Exatamente como o Google devolve: comentario, callback, ponto-e-virgula.
  const bruto = "/*O_o*/\ngoogle.visualization.Query.setResponse(" + corpo + ");";

  let rows;
  try { rows = Leaderboard.parse(bruto); }
  catch (e) { fail("o parser nao desembrulhou a resposta do gviz: " + e.message); rows = []; }

  if (rows.length !== 1) fail(`o parser devolveu ${rows.length} linhas, esperava 1`);
  else {
    for (const campo of LB_FIELDS) {
      if (String(rows[0][campo]) !== String(HONESTA[campo]))
        fail(`campo ${campo} veio "${rows[0][campo]}", esperava "${HONESTA[campo]}"`);
    }
  }

  // Celula vazia e o caso normal de uma coluna opcional, nao um erro.
  const furado = JSON.stringify({ table: { rows: [{ c: [{ v: "X" }, null, { v: 1 }] }] } });
  try {
    const r = Leaderboard.parse("/*O_o*/\ngoogle.visualization.Query.setResponse(" + furado + ");");
    if (r[0].tempo_ms !== "") fail("celula nula devia virar string vazia, veio " + r[0].tempo_ms);
  } catch (e) { fail("o parser morreu numa celula nula: " + e.message); }

  // Uma resposta que nao e do formato tem que LANCAR, e nao devolver vazio em
  // silencio: `load` transforma isso no estado "fora do ar", que a tela conta.
  let lancou = false;
  try { Leaderboard.parse("<html>quota exceeded</html>"); } catch (e) { lancou = true; }
  if (!lancou) fail("resposta fora do formato passou calada — a tela mostraria placar vazio");

  console.log("  ok desembrulha o gviz, aceita celula nula, lanca em resposta torta");
}

/* --- 3. o filtro: reprova o impossivel, jamais a run honesta -------------- */
console.log("--- filtro ---");
{
  if (!Leaderboard.valid(HONESTA)) {
    fail("a RUN HONESTA foi reprovada — este e o pior defeito possivel do filtro:"
       + " ele passa a apagar quem jogou de verdade");
  }

  // Uma run curta e ruim tambem e honesta, e e a mais comum do jogo.
  const curta = { ...HONESTA, tempo_ms: 109000, abates: 240, nivel: 9,
                  dano: 3000, cadeia: 11, eixos: "2/0/1" };
  if (!Leaderboard.valid(curta)) fail("run curta honesta (1:49, 240 abates) reprovada");

  const casos = [
    ["tempo absurdo",        { tempo_ms: 99 * 60 * 1000 }],
    ["tempo zero",           { tempo_ms: 0 }],
    ["tempo negativo",       { tempo_ms: -5 }],
    ["abates impossiveis",   { abates: 9999999 }],
    ["nivel sem abates",     { nivel: 60, abates: 3 }],
    ["cadeia maior que abates", { cadeia: 99999 }],
    ["eixo acima do teto",   { eixos: "99/0/0" }],
    ["pool estourada",       { eixos: "15/15/15" }],
    ["eixos de menos",       { eixos: "3/11" }],
    ["assinatura inventada", { assinatura: "naoexiste" }],
    ["sem nome",             { nome: "   " }],
    ["numero como texto",    { abates: "muitos" }],
  ];
  for (const [nome, patch] of casos) {
    if (Leaderboard.valid({ ...HONESTA, ...patch }))
      fail(`o filtro ACEITOU "${nome}" — ${JSON.stringify(patch)}`);
  }
  console.log(`  ok passa as 2 honestas, reprova as ${casos.length} impossiveis`);
}

/* --- 3b. uma linha por amigo --------------------------------------------- */
console.log("--- um por amigo ---");
{
  /* O QUERY da planilha corta em 50 linhas ordenadas por tempo. Sem deduplicar,
     quem tem as 50 melhores runs E o placar inteiro — e o quadro deixa de ser
     "os amigos" para ser "as tentativas de um deles". */
  const r = (nome, ms) => ({ ...HONESTA, nome, tempo_ms: ms });
  const ordenadas = [r("GABRIEL", 900), r("GABRIEL", 800), r("gabriel  ", 700),
                     r("MARINA", 650), r("MARINA", 600), r("ZE", 500)];
  const top = Leaderboard.melhorPorJogador(ordenadas, 8);

  if (top.length !== 3) fail(`deduplicou errado: ${top.length} linhas, esperava 3`);
  if (top[0].tempo_ms !== 900) fail("guardou a run errada do jogador: a primeira e a melhor");
  if (top.map((x) => Leaderboard.limpaNome(x.nome).toUpperCase()).join(",") !== "GABRIEL,MARINA,ZE")
    fail("a ordem entre jogadores mudou na deduplicacao");

  // Caixa e espaco nao criam um segundo jogador.
  if (Leaderboard.melhorPorJogador([r("Ana", 10), r("ANA ", 9)], 8).length !== 1)
    fail('"Ana" e "ANA " viraram dois jogadores');

  // O limite corta, e linha sem nome nao ocupa lugar.
  if (Leaderboard.melhorPorJogador(ordenadas, 2).length !== 2) fail("o limite nao cortou");
  if (Leaderboard.melhorPorJogador([r("  ", 10), r("B", 9)], 8).length !== 1)
    fail("linha sem nome ocupou lugar no placar");

  console.log("  ok 6 runs de 3 pessoas viram 3 linhas, cada uma na melhor");
}

/* --- 3c. o campo de texto come a tecla ------------------------------------ */
console.log("--- teclado ---");
{
  /* O defeito: `InputManager` da `preventDefault` em w/a/s/d para a pagina nao
     rolar, e isso apagava essas quatro letras de dentro do campo de nome — a
     letra A simplesmente nao entrava. M e N eram pior: mutavam o som no meio
     de uma palavra. */
  const alvo = (tag) => ({ target: { tagName: tag } });
  for (const tag of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
    if (!digitando(alvo(tag))) fail(`digitando() disse nao para <${tag}>`);
  }
  for (const tag of ["CANVAS", "BODY", "DIV", "BUTTON"]) {
    if (digitando(alvo(tag))) fail(`digitando() disse sim para <${tag}> — o jogo ficaria surdo`);
  }
  if (!digitando({ target: { isContentEditable: true } })) fail("ignorou contentEditable");
  for (const vazio of [null, undefined, {}, { target: null }]) {
    let quebrou = false;
    try { digitando(vazio); } catch (e) { quebrou = true; }
    if (quebrou) fail(`digitando() lancou com ${JSON.stringify(vazio)}`);
  }

  /* E a LIGACAO. O harness descarta listeners (`addEventListener: () => {}`),
     entao nenhum driver consegue disparar uma tecla — a checagem tem que ser no
     fonte, como `driver_vfx` faz com cor no render. Todo `keydown` do jogo
     precisa consultar `digitando`, senao o campo volta a perder letra. */
  for (const arq of ["js/engine.js", "js/game.js"]) {
    const src = __read(arq);
    const handlers = src.split('addEventListener("keydown"').length - 1;
    if (!handlers) continue;
    // O guarda tem que estar nas primeiras linhas do handler, antes de tudo.
    const trechos = src.split('addEventListener("keydown"').slice(1);
    for (const t of trechos) {
      if (!/digitando\(e\)/.test(t.slice(0, 400)))
        fail(`um keydown de ${arq} nao consulta digitando(): o campo de nome`
           + " perde letra ou o jogo reage enquanto alguem escreve");
    }
  }
  console.log("  ok campo de texto engole a tecla, e os dois keydown consultam");
}

/* --- 4. os limites saem do jogo, nao de uma tabela a mao ------------------ */
console.log("--- limites derivados ---");
{
  /* A regra: nenhuma constante copiada. Se `xpForLevel` ou `BALANCE.spawn`
     mudarem, o filtro tem que se mexer junto — senao ele envelhece contra as
     runs honestas do jogo NOVO, que e o defeito silencioso deste arquivo. */
  const antes = Leaderboard.minKillsFor(20);
  const xpOrig = xpForLevel;
  try {
    // eslint-disable-next-line no-global-assign
    xpForLevel = (l) => xpOrig(l) * 2;
    if (Leaderboard.minKillsFor(20) <= antes)
      fail("minKillsFor nao acompanhou xpForLevel — ha constante copiada no filtro");
  } finally { xpForLevel = xpOrig; }

  if (!(Leaderboard.minKillsFor(1) === 0))
    fail("nivel 1 exigindo abates: todo mundo comeca no nivel 1 com zero");
  if (!(Leaderboard.minKillsFor(30) > Leaderboard.minKillsFor(10)))
    fail("minKillsFor nao cresce com o nivel");

  const spawnAntes = Leaderboard.maxKillsFor(600);
  const bOrig = BALANCE.spawn.hardMinInterval;
  try {
    BALANCE.spawn.hardMinInterval = bOrig / 2;   // spawner duas vezes mais rapido
    if (Leaderboard.maxKillsFor(600) <= spawnAntes)
      fail("maxKillsFor nao acompanhou BALANCE.spawn — ha constante copiada no teto");
  } finally { BALANCE.spawn.hardMinInterval = bOrig; }

  /* O teto tem que ser GENEROSO, e o alvo sai do JOGO em vez de um palpite: o
     15o marco e o que uma run competente acumula por volta dos 10 min, que e
     onde a run acaba. (Os ~100 abates/s do CLAUDE.md sao a taxa de PICO no fim
     da run, nao a media — usa-los como total daria um alvo 6x maior que o
     numero real, e um teste calibrado por premissa errada e pior que nenhum.) */
  const gm = new Game();
  const competente = gm.milestoneKillsAt(15);
  const teto = Leaderboard.maxKillsFor(600);
  if (teto < competente * 3) {
    fail(`teto de abates apertado demais: ${Math.round(teto)} para 10 min, e uma`
       + ` run competente ja faz ${Math.round(competente)}`);
  }
  /* E o outro lado: um teto que nunca corta nada nao e teto. O spawner nasce um
     corpo por tick, entao ele nao pode passar do intervalo mais apertado. */
  if (teto > 600 / BALANCE.spawn.hardMinInterval * 2) {
    fail(`teto frouxo demais: ${Math.round(teto)} passa do dobro do que o`
       + " spawner consegue por em campo em 10 min");
  }
  console.log(`  ok teto de ${Math.round(teto)} abates aos 10 min, contra ${
    Math.round(competente)} de uma run competente`);
  console.log("  ok minKillsFor segue xpForLevel e maxKillsFor segue BALANCE.spawn");
}

/* --- 5. o nome e conteudo de TERCEIRO ------------------------------------- */
console.log("--- nome ---");
{
  const g2 = new Game();
  window.game = g2;
  const ui = g2.ui;

  const veneno = '<img src=x onerror="alert(1)">';
  const saida = ui.esc(veneno);
  if (saida.indexOf("<") >= 0 || saida.indexOf('"') >= 0) {
    fail("UI.esc deixou markup passar: qualquer um escreve no form, e o placar"
       + " e desenhado com innerHTML na pagina inicial de todos os amigos");
  }
  if (ui.esc("A & B") !== "A &amp; B") fail("UI.esc nao escapou o &");

  // A poda: controle e quebra de linha sairiam do form como colunas tortas.
  const sujo = Leaderboard.limpaNome("  ab\ncd\tef  ");
  if (/[\u0000-\u001F]/.test(sujo)) fail(`limpaNome deixou controle: ${JSON.stringify(sujo)}`);
  if (Leaderboard.limpaNome("x".repeat(80)).length > LB_CFG.nomeMax)
    fail("limpaNome nao respeitou o teto de tamanho");
  if (Leaderboard.limpaNome(null) !== "") fail("limpaNome quebrou com null");

  /* O nome e obrigatorio para comecar, entao `temNome` e o portao — e ele nao
     pode aceitar o que `limpaNome` reduz a nada, senao o jogador comeca a run
     e so descobre no game over que ela nao entra no placar. */
  Leaderboard._local = null;
  if (Leaderboard.temNome()) fail("temNome disse sim com o nome vazio");
  for (const vazio of ["   ", "\t\n", ""]) {
    Leaderboard.setNome(vazio);
    if (Leaderboard.temNome()) fail(`temNome aceitou ${JSON.stringify(vazio)}`);
  }
  Leaderboard.setNome("Zé");
  if (!Leaderboard.temNome()) fail("temNome recusou um nome valido");

  console.log("  ok escapa markup, poda controle, corta no teto e barra nome vazio");
}

/* --- 6. a camada local funciona sem rede nenhuma -------------------------- */
console.log("--- camada local ---");
{
  /* No harness nao existe `localStorage`, e e exatamente por isso que este
     bloco vale: e o mesmo caminho de um browser em modo privativo. A camada
     local nao pode LANCAR ali — o game over inteiro morreria junto. */
  Leaderboard._local = null;
  let estado;
  try { estado = Leaderboard.local(); }
  catch (e) { fail("Leaderboard.local() lancou sem localStorage: " + e.message); }

  if (!estado || estado.nome !== "" || estado.best !== null)
    fail("sem storage, o estado inicial devia ser nome vazio e best nulo");

  Leaderboard.setNome("  Gabriel  ");
  if (Leaderboard.nome() !== "Gabriel") fail(`setNome nao podou: "${Leaderboard.nome()}"`);

  const a = { ...HONESTA, tempo_ms: 100000 };
  const b = { ...HONESTA, tempo_ms: 200000 };
  if (!Leaderboard.remember(a)) fail("a primeira run devia ser recorde");
  if (Leaderboard.remember(a)) fail("empate nao e recorde");
  if (Leaderboard.remember({ ...HONESTA, tempo_ms: 50000 })) fail("run pior virou recorde");
  if (!Leaderboard.remember(b)) fail("run melhor nao virou recorde");
  if (Leaderboard.best().tempo_ms !== 200000) fail("best guardou a run errada");

  // `submit` sem `fetch` tem que devolver false, nunca lancar.
  let r;
  try { r = Leaderboard.submit(b); }
  catch (e) { fail("submit lancou sem fetch: " + e.message); }
  if (r !== false) fail("submit devia devolver false sem fetch, devolveu " + r);

  console.log("  ok estado vazio, poda, recorde so quando bate, submit mudo sem rede");
}

console.log(fails ? `\nFALHOU: ${fails}` : "\nok placar");
__exit(fails ? 1 : 0);
