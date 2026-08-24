/* Driver: THE VERSION AND THE CHANGELOG — the number lives in one place, and
   it says what shipped.

   What this driver guards is not the screen: it is the property that made the
   screen exist. The game already had the version number hardcoded in TWO files
   with a comment asking them to move together, and a comment is not a
   mechanism — the copy that aged would silently stamp every leaderboard run
   with a version the game no longer has.

   Seven promises, and each breaks in a different way:

     1. VERSION IS the newest entry     -> bumping without a changelog cannot happen
     2. the list descends, no repeats   -> otherwise "what shipped" loses its order
     3. every entry has shape           -> ISO date, title, at least one note
     4. the number is NOT in two places -> neither in the markup nor in the board
     5. the screen draws what the list has -> one row per version, the right notes
     6. the note is ESCAPED             -> it is text, never markup
     7. ESC closes before pausing       -> or the key that closes everything misses this */

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const cmp = (a, b) => {
  const x = a.match(SEMVER).slice(1).map(Number);
  const y = b.match(SEMVER).slice(1).map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/* --- 1. VERSION is not typed: it IS the newest entry ---------------------- */
console.log("--- fonte ---");
{
  if (typeof VERSION === "undefined") fail("VERSION nao existe");
  else if (!SEMVER.test(VERSION)) fail(`VERSION "${VERSION}" nao e SemVer x.y.z`);
  if (!Array.isArray(CHANGELOG) || !CHANGELOG.length) fail("CHANGELOG vazio");
  else if (VERSION !== CHANGELOG[0].v) {
    fail(`VERSION (${VERSION}) nao e a entrada mais nova (${CHANGELOG[0].v}) —`
       + " ela tem que CAIR da lista, senao da para subir a versao sem dizer"
       + " o que entrou");
  }
  console.log(`  ok v${VERSION}, ${CHANGELOG.length} versoes`);
}

/* --- 2 and 3. the list descends, and every entry has shape ---------------- */
console.log("--- lista ---");
{
  const antes = fails;
  const vistos = new Set();
  let notas = 0;
  for (let i = 0; i < CHANGELOG.length; i++) {
    const e = CHANGELOG[i], onde = `entrada ${i} (${e.v})`;

    if (!SEMVER.test(e.v || "")) { fail(`${onde}: versao fora de SemVer`); continue; }
    if (vistos.has(e.v)) fail(`${onde}: versao repetida — duas entradas com o mesmo numero`);
    vistos.add(e.v);

    if (i > 0) {
      const ant = CHANGELOG[i - 1];
      if (cmp(ant.v, e.v) <= 0) {
        fail(`${onde}: vem depois de ${ant.v} e nao e menor — a lista e da mais`
           + " nova para a mais velha, e a tela le nessa ordem");
      }
      if (e.data > ant.data) {
        fail(`${onde}: datada em ${e.data}, depois de ${ant.v} (${ant.data}) —`
           + " versao mais velha com data mais nova");
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data || "")) fail(`${onde}: data "${e.data}" nao e ISO`);
    else if (Number.isNaN(Date.parse(e.data))) fail(`${onde}: data "${e.data}" nao existe`);

    if (!e.titulo || !e.titulo.trim()) fail(`${onde}: sem titulo — a lista de versoes so mostra ele`);
    else if (e.titulo.length > 42) fail(`${onde}: titulo de ${e.titulo.length} chars nao cabe no trilho`);

    if (!Array.isArray(e.notas) || !e.notas.length) {
      fail(`${onde}: nenhuma nota. Versao sem nota e o defeito que esta lista`
         + " existe para impedir: o numero muda e ninguem sabe o que mudou");
      continue;
    }
    for (const n of e.notas) {
      notas++;
      if (!CHANGELOG_TIPOS[n.t]) fail(`${onde}: tipo "${n.t}" nao esta em CHANGELOG_TIPOS`);
      if (!n.txt || n.txt.trim().length < 12) fail(`${onde}: nota vazia ou curta demais: "${n.txt}"`);
    }
  }
  // Only claim "in order" when nothing failed above: a green line printed over
  // red ones is the driver contradicting itself.
  if (fails === antes) {
    console.log(`  ok ${CHANGELOG.length} entradas em ordem, ${notas} notas, ` +
                `${Object.keys(CHANGELOG_TIPOS).length} tipos`);
  }
}

/* --- 4. the number does not exist twice -----------------------------------
   A `grep` is part of the check here on purpose: the defect is not a wrong
   value at runtime, it is a value that is RIGHT today written in a second
   place. */
console.log("--- fonte unica ---");
{
  if (typeof LB_CFG !== "undefined" && LB_CFG.versao !== VERSION) {
    fail(`LB_CFG.versao (${LB_CFG.versao}) diverge de VERSION (${VERSION}) —`
       + " toda run enviada ao placar sai carimbada com a versao errada");
  }

  const html = __read("index.html");

  const el = html.match(/class="menu-versao"[^>]*>([\s\S]*?)<\/button>/);
  if (!el) fail("o rodape da versao nao e mais um <button class=\"menu-versao\">");
  else if (/\d/.test(el[1])) {
    fail(`o markup do menu voltou a cravar o numero ("${el[1].trim()}") — quem`
       + " escreve esse texto e UI.mountVersao, a partir de VERSION");
  }

  const ordem = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const iv = ordem.indexOf("js/version.js");
  if (iv < 0) fail("index.html nao carrega js/version.js");
  else {
    for (const dep of ["js/leaderboard.js", "js/ui.js"]) {
      const i = ordem.indexOf(dep);
      if (i >= 0 && i < iv) fail(`${dep} carrega ANTES de js/version.js e le VERSION`);
    }
  }
  console.log("  ok um numero so: version.js -> placar, menu e changelog");
}

/* --- 5 and 6. the screen draws the list, and the note is text ------------- */
console.log("--- tela ---");
{
  const g = new Game();
  window.game = g;
  const ui = g.ui;

  if (ui.logOpen) fail("o changelog nasce aberto");
  if (!/v/.test(ui.el.versao.innerHTML) || ui.el.versao.innerHTML.indexOf(VERSION) < 0) {
    fail(`o botao do menu nao mostra a versao: "${ui.el.versao.innerHTML}"`);
  }

  // clicking the version opens on the newest entry
  ui.el.versao.onclick();
  if (!ui.logOpen) fail("clicar na versao nao abriu as notas");
  if (ui.logIdx !== 0) fail("abriu numa versao que nao e a mais nova");

  const linhas = () => ui.el.logNav.children.slice(-CHANGELOG.length);
  if (ui.el.logNav.children.length < CHANGELOG.length) {
    fail(`o trilho desenhou ${ui.el.logNav.children.length} linhas para ${CHANGELOG.length} versoes`);
  }
  const primeira = linhas()[0];
  if (primeira && primeira.className.indexOf("sel") < 0) fail("a versao aberta nao esta marcada no trilho");
  if (primeira && primeira.innerHTML.indexOf("Atual") < 0) fail('a versao mais nova nao leva o selo "Atual"');
  if (CHANGELOG.length > 1 && linhas()[1].innerHTML.indexOf("Atual") >= 0) {
    fail('uma versao antiga levou o selo "Atual"');
  }

  const temNotas = (i) => CHANGELOG[i].notas.every((n) => {
    const t = ui.esc(n.txt);
    return ui.el.logNotes.innerHTML.indexOf(t) >= 0;
  });
  if (!temNotas(0)) fail("a tela nao desenhou todas as notas da versao mais nova");

  // clicking an older version swaps the notes without closing the screen
  if (CHANGELOG.length > 1) {
    linhas()[1].onclick();
    if (ui.logIdx !== 1) fail("clicar numa versao antiga nao trocou a selecao");
    if (!ui.logOpen) fail("trocar de versao fechou a tela");
    if (!temNotas(1)) fail("a tela continuou mostrando as notas da versao anterior");
    if (CHANGELOG[0].notas.some((n) => ui.el.logNotes.innerHTML.indexOf(ui.esc(n.txt)) >= 0)) {
      fail("as notas das duas versoes estao na tela ao mesmo tempo");
    }
  }

  // the note is text: a "<" in a note must not become markup
  const salvo = CHANGELOG[0].notas.slice();
  CHANGELOG[0].notas = [{ t: "ajuste", txt: 'a aura pega <img onerror="x"> mais perto' }];
  ui.openChangelog(0);
  if (ui.el.logNotes.innerHTML.indexOf("<img") >= 0) {
    fail("a nota entrou como MARKUP na tela — falta UI.esc no desenho da nota");
  }
  if (ui.el.logNotes.innerHTML.indexOf("&lt;img") < 0) fail("a nota escapada sumiu do desenho");
  CHANGELOG[0].notas = salvo;

  ui.closeChangelog();
  if (ui.logOpen) fail("closeChangelog nao fechou");

  // the screen has to get out of the way when the run starts
  ui.openChangelog(0);
  ui.onStart();
  if (ui.logOpen) fail("as notas continuaram abertas depois de iniciar a run");

  console.log("  ok abre pelo botao, troca de versao, escapa a nota e some na run");
}

/* --- 7. ESC closes before pausing -----------------------------------------
   This is a grep over the source because `keydown` is registered on the
   sandbox's no-op `addEventListener`: there is no way to dispatch the key
   here. What can be asserted is the written ORDER, and that order is the real
   defect — inverted, the key that closes every screen in the game would be the
   only one that does not close this one. */
console.log("--- esc ---");
{
  const src = __read("js/game.js");
  const bloco = src.match(/if \(e\.key === "Escape"\)[\s\S]{0,220}/);
  if (!bloco) fail("js/game.js nao trata mais a tecla Escape");
  else {
    const fecha = bloco[0].indexOf("closeChangelog");
    const pausa = bloco[0].indexOf("togglePause");
    if (fecha < 0) fail("o ESC nao fecha as notas da versao");
    else if (pausa >= 0 && pausa < fecha) fail("o ESC pausa ANTES de fechar as notas");
  }
  console.log("  ok ESC fecha as notas antes de pausar");
}

console.log(fails ? `\nFALHOU: ${fails}` : "\nok versao");
__exit(fails ? 1 : 0);
