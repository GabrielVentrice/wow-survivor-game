// Tela de level-up: as tres linhas e o painel de build.
//
// E a unica tela em que o jogador decide algo que nao e posicao, e a decisao e
// irreversivel (ponto de eixo nao volta). Se ela mentir sobre o tipo da oferta
// ou sobre o custo, a escolha vira cara ou coroa — entao o que este driver
// cobra e exatamente isso: tipo legivel, pips certos, custo igual ao que o
// `addAxis` vai cobrar de verdade, e um painel que resume em vez de estourar.
const g = new Game();
window.game = g;
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
g.start();

let problems = 0;
const bad = (m) => { problems++; console.log("X   " + m); };

const seen = { piece: 0, path: 0, passive: 0, evo: 0, delta: 0, rec: 0 };
// A etiqueta de tipo e a unica coisa que separa as tres ofertas sem depender de
// cor — a cor da linha e a do eixo, nao a do tipo.
const KIND = { piece: "Spell nova", path: "Melhoria", passive: "Passiva" };
const GLYPH = { piece: "◈", path: "▲", passive: "✦" };
const noFmt = new Set();

for (let round = 0; round < 400; round++) {
  const offers = g.build.getOffers(3);
  if (!offers.length) break;

  // Toda mod de tier precisa de rotulo em STAT_FMT, senao o "antes -> depois"
  // some em silencio e a linha volta a dizer so "melhora a spell X".
  for (const o of offers) {
    if (o.kind !== "path" || !o.tier.mods) continue;
    for (const k in o.tier.mods) if (!STAT_FMT[k]) noFmt.add(k);
  }

  let views;
  try { views = offers.map((o) => g.ui.offerView(o)); }
  catch (e) { bad(`offerView explodiu — ${e.message}`); break; }

  for (let i = 0; i < offers.length; i++) {
    const o = offers[i], v = views[i];
    seen[o.kind]++;
    let html;
    try { html = g.ui.rowHtml(v); }
    catch (e) { bad(`${o.kind}: rowHtml explodiu — ${e.message}`); continue; }
    if (html.includes("undefined")) bad(`${o.kind} (${o.def.name}): linha com "undefined"`);
    const kind = o.isEvo && o.evo ? "Evolução" : KIND[o.kind];
    const glyph = o.isEvo && o.evo ? "⭐" : GLYPH[o.kind];
    if (!html.includes(kind)) bad(`${o.kind} (${o.def.name}): linha sem o tipo da oferta`);
    if (!html.includes(`<i>${glyph}</i>`)) bad(`${o.kind} (${o.def.name}): etiqueta sem glifo`);
    if ((o.kind === "passive") !== html.includes("lv-tile round")) {
      bad(`${o.kind} (${o.def.name}): forma do tile nao casa com o tipo`);
    }
    if (!v.costLine) bad(`${o.kind} (${o.def.name}): linha sem custo`);
    if (v.delta.length) seen.delta++;
    if (v.rec) seen.rec++;

    // O custo mostrado tem que ser o que o eixo VAI receber.
    const room = Math.max(0, Math.min(
      AXIS_RULES.capPerAxis - (o.axis ? g.build.axis[o.axis.id] : 0), g.build.axisLeft));
    const want = o.axis ? Math.min(v.cost, room) : 0;
    if (v.gain !== want) bad(`${o.def.name}: custo anunciado ${v.gain}, real ${want}`);
    if (!v.gain && !v.costFree) bad(`${o.def.name}: cobra em laranja um custo de 0`);

    if (o.kind === "path") {
      if (!html.includes(o.def.name)) bad(`path ${o.def.name}: linha nao diz qual peca melhora`);
      const on = (html.match(/<i class="on"/g) || []).length;
      if (on !== o.tierIndex + 1) bad(`path ${o.def.name}: ${on} pips acesos, esperado ${o.tierIndex + 1}`);
      if (!html.includes(`<b>${o.tierIndex + 1}</b>`)) {
        bad(`path ${o.def.name}: tile sem o selo do tier`);
      }
      if (o.isEvo) { seen.evo++; if (!html.includes("Evolução")) bad("evolucao sem etiqueta propria"); }
    }
    if (o.kind === "passive" && !html.includes("não dispara")) {
      bad(`passiva ${o.def.name}: linha nao diz que nao dispara`);
    }
  }

  /* O chip de orcamento tem que antecipar o gasto: com o mouse numa oferta que
     cobra, o saldo mostrado e o que SOBRA. Errar aqui e pior que nao ter a
     previa — o jogador decide olhando um numero que nao vai acontecer. */
  g.ui.lvViews = views;
  for (let i = 0; i < offers.length; i++) {
    g.ui.updateBudget(views[i]);
    const esperado = g.build.axisLeft - views[i].gain;
    if (+g.ui.el.lvFree.textContent !== esperado) {
      bad(`${offers[i].def.name}: chip mostra ${g.ui.el.lvFree.textContent} livres, esperado ${esperado}`);
    }
    if (+g.ui.el.lvWas.textContent !== g.build.axisLeft) {
      bad(`${offers[i].def.name}: chip perdeu o saldo de antes`);
    }
  }
  g.ui.updateBudget(null);
  if (+g.ui.el.lvFree.textContent !== g.build.axisLeft) bad("chip nao volta ao saldo sem hover");

  // O painel tem que aguentar a build inteira sem estourar: o teto de linhas
  // e de chips e o que substitui a rolagem, que overlay de jogo nao tem.
  g.ui.lvOffers = offers;
  for (let h = -1; h < offers.length; h++) {
    let panel;
    try { panel = g.ui.buildPanelHtml(h); }
    catch (e) { bad(`buildPanelHtml(${h}) explodiu — ${e.message}`); break; }
    if (panel.includes("undefined")) bad(`painel (hover ${h}) com "undefined"`);
    const n = g.build.pieces.size;
    const rows = (panel.match(/class="lv-sp /g) || []).length;
    const teto = n > PANEL.fullRows ? PANEL.slimRows : PANEL.fullRows;
    if (rows !== Math.min(n, teto)) bad(`painel: ${rows} linhas de spell com ${n} pecas (teto ${teto})`);
    if (n > teto && !panel.includes("abra a pausa")) bad("painel: excedente de spells sem contador");
    const chips = (panel.match(/class="lv-chip"/g) || []).length;
    if (chips > PANEL.chips) bad(`painel: ${chips} chips de passiva, teto ${PANEL.chips}`);
    if (g.build.passives.size > PANEL.chips && !panel.includes("lv-chip more")) {
      bad("painel: excedente de passivas sem chip +N");
    }
    // Eixos e capstone sao a informacao que decide a compra: nunca somem.
    if ((panel.match(/class="lv-ax"/g) || []).length !== 3) bad("painel sem os tres eixos");
  }

  g.ui.applyOffer(offers[Math.floor(Math.random() * offers.length)]);
}

if (noFmt.size) bad(`stats sem rotulo em STAT_FMT: ${[...noFmt].join(", ")}`);
const missing = Object.entries(seen).filter(([, n]) => !n).map(([k]) => k);
if (missing.length) bad(`nunca aconteceu: ${missing.join(", ")}`);
console.log(problems ? `X   ${problems} problemas na tela de level-up`
  : `ok  level-up validado — ${seen.piece} peca, ${seen.path} caminho (${seen.evo} evolucao), ` +
    `${seen.passive} passiva, ${seen.delta} com antes/depois, ${seen.rec} com chip de marco`);
if (problems) __exit(1);
