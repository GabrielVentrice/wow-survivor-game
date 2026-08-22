// Tela de level-up: as tres linhas e o painel de build.
//
// A BATIDA RAPIDA. Depois da separacao das duas telas ela nao gasta mais nada:
// so aprofunda o que a build ja tem (tier de caminho) ou multiplica (passiva
// global). Ponto de eixo e assunto da etapa, e `driver_milestone` cobra aquela.
//
// O que este driver cobra e o que sobrou de mentira possivel: tipo legivel sem
// depender de cor, pips iguais ao tier real, progresso dito em toda linha, e um
// painel que RESUME em vez de estourar — overlay de jogo nao tem rolagem.
//
// E cobra tambem que peca nova NAO volte para ca por acidente: o defeito que a
// separacao existe para consertar era exatamente uma tela em que largura e
// profundidade disputavam a mesma escolha, e largura ganhava sempre.
const g = new Game();
window.game = g;
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
g.start();

let problems = 0;
const bad = (m) => { problems++; console.log("X   " + m); };

const seen = { path: 0, passive: 0, evo: 0, delta: 0, rec: 0 };
// A etiqueta de tipo e a unica coisa que separa as ofertas sem depender de
// cor — a cor da linha e a do eixo, nao a do tipo.
const KIND = { path: "Melhoria", passive: "Passiva" };
const GLYPH = { path: "▲", passive: "✦" };
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
    // Largura no level up e o defeito que esta separacao conserta: peca nova
    // aqui significa que o pool de ofertas voltou a misturar as duas moedas.
    if (o.kind !== "path" && o.kind !== "passive") {
      bad(`oferta de level up do tipo "${o.kind}" — so tier e passiva entram aqui`);
      continue;
    }
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
    /* A terceira coluna era CUSTO e virou PROGRESSO — o level up nao cobra
       mais nada, e uma coluna dizendo "não gasta ponto" tres vezes seria um
       terco da tela em silencio. Ela continua obrigatoria: sem ela a linha nao
       diz onde a compra deixa a trilha, que e a pergunta desta tela. */
    if (!v.progHead || !v.progTail) bad(`${o.kind} (${o.def.name}): linha sem progresso`);
    if (v.cost != null || v.gain != null) {
      bad(`${o.kind} (${o.def.name}): view ainda carrega custo de eixo`);
    }
    if (v.delta.length) seen.delta++;
    if (v.rec) seen.rec++;

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

  /* Nenhuma escolha desta tela pode mexer no pool de eixo. E a invariante que
     separa as duas batidas, e ela e barata de conferir: sem ela, um tier que
     voltasse a chamar `addAxis` recolocaria o imposto sobre profundidade sem
     que nada na tela dissesse isso ao jogador. */
  const poolAntes = g.build.axisTotal;

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

  const escolha = offers[Math.floor(Math.random() * offers.length)];
  g.ui.applyOffer(escolha);
  if (g.build.axisTotal !== poolAntes) {
    bad(`${escolha.def.name}: escolha de level up moveu o pool de eixo ` +
        `(${poolAntes} -> ${g.build.axisTotal})`);
  }
}

if (noFmt.size) bad(`stats sem rotulo em STAT_FMT: ${[...noFmt].join(", ")}`);
const missing = Object.entries(seen).filter(([, n]) => !n).map(([k]) => k);
if (missing.length) bad(`nunca aconteceu: ${missing.join(", ")}`);
console.log(problems ? `X   ${problems} problemas na tela de level-up`
  : `ok  level-up validado — ${seen.path} caminho (${seen.evo} evolucao), ` +
    `${seen.passive} passiva, ${seen.delta} com antes/depois, ${seen.rec} com chip de marco`);
if (problems) __exit(1);
