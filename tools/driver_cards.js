// Tela de level-up: as tres CARTAS e a tira de build.
//
// A BATIDA RAPIDA. Depois da separacao das duas telas ela nao gasta mais nada:
// so aprofunda o que a build ja tem (tier de caminho) ou multiplica (passiva
// global). Ponto de eixo e assunto da etapa, e `driver_milestone` cobra aquela.
//
// O que este driver cobra e o que sobrou de mentira possivel: tipo legivel sem
// depender de cor, pips iguais ao tier real, progresso dito em toda carta, uma
// tira que RESUME em vez de estourar (overlay de jogo nao tem rolagem), e a
// trava de nivel das passivas.
//
// E cobra tambem que peca nova NAO volte para ca por acidente: o defeito que a
// separacao existe para consertar era exatamente uma tela em que largura e
// profundidade disputavam a mesma escolha, e largura ganhava sempre.
const g = new Game();
window.game = g;
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
g.start(STARTER_TESTE);
/* A trava de passiva, nas duas pontas, antes de o resto do driver rodar.

   A run comeca no nivel 1, entao sem subir o nivel metade do bolo nunca
   apareceria e nada seria medido sobre passiva. Mas a trava em si so vale se
   for conferida ANTES: por isso as duas checagens abaixo. */
const semPassiva = g.build.getOffers(9);
for (const o of semPassiva) {
  if (o.kind === "passive") {
    bad(`passiva "${o.def.name}" oferecida no nivel ${g.player.level}, ` +
        `trava e ${BALANCE.levelup.passiveAt}`);
  }
}
/* E a parte que engana: com varios niveis na fila, o nivel que conta e o que
   ESTA escolha paga, nao o topo da fila. Sem descontar `pendingLevels`, chegar
   ao nivel 10 de uma vez faria a primeira carta — a que paga o nivel 8 —
   oferecer passiva, e a trava de dez viraria uma trava de oito. */
g.player.level = BALANCE.levelup.passiveAt;
g.player.pendingLevels = 3;
for (const o of g.build.getOffers(9)) {
  if (o.kind === "passive") {
    bad(`passiva no nivel efetivo ${g.player.level - g.player.pendingLevels} ` +
        `(fila de ${g.player.pendingLevels}): pendingLevels nao esta saindo da conta`);
  }
}
g.player.pendingLevels = 0;

let problems = 0;
const bad = (m) => { problems++; console.log("X   " + m); };

/* --- o gate de eixo -------------------------------------------------------
   Profundidade voltou a cobrar comprometimento, e a moeda e o eixo DA PECA:
   tier 3 pede 1 ponto, tier 4 pede 5, tier 5 pede 10. A tabela abaixo mede as
   duas bordas de cada degrau — um ponto antes e o ponto exato —, porque gate
   que abre cedo demais nao aparece jogando: a trilha so sobe mais rapido.
   O que este bloco cobra sao as tres pontas que podem mentir:

     - a trava fecha e abre no ponto exato (nem antes, nem depois);
     - ela e do eixo DA PECA, e nao do eixo mais alto da run — senao investir
       em Cataclismo aprofundaria uma spell de Corrupcao e o gate deixaria de
       significar comprometimento;
     - e a tela DIZ que travou. Oferta bloqueada some do bolo, e bolo vazio sem
       explicacao e a tela cobrando atencao e devolvendo silencio. */
const primeira = () => g.build.pieces.values().next().value;
{
  // [pontos no eixo, tier em que a trilha para]
  for (const [pontos, teto] of [[0, 2], [1, 3], [4, 3], [5, 4], [9, 4], [10, 5], [15, 5]]) {
    g.start(STARTER_TESTE);
    const inst = primeira();
    g.build.axis[inst.def.axis] = pontos;
    const pathId = Object.keys(inst.def.paths)[0];
    let guard = 0;
    while (g.build.upgradePath(inst, pathId) && guard++ < 20);
    if (inst.paths[pathId] !== teto) {
      bad(`com ${pontos} de ${inst.def.axis} a trilha parou no tier ` +
          `${inst.paths[pathId]}, esperado ${teto}`);
    }
  }

  // eixo cheio no eixo ERRADO nao destrava nada
  g.start(STARTER_TESTE);
  const inst = primeira();
  const outro = Object.keys(g.build.axis).find((a) => a !== inst.def.axis);
  g.build.axis[outro] = AXIS_RULES.pureAt;
  const pid0 = Object.keys(inst.def.paths)[0];
  let guard = 0;
  while (g.build.upgradePath(inst, pid0) && guard++ < 20);
  if (inst.paths[pid0] !== PATH_RULES.freeTier) {
    bad(`${AXIS_RULES.pureAt} pontos em ${outro} levaram uma spell de ` +
        `${inst.def.axis} ao tier ${inst.paths[pid0]}`);
  }

  // com tudo travado o bolo esvazia, e a tira precisa dizer por que
  g.start(STARTER_TESTE);
  const trancada = primeira();
  for (const pid in trancada.paths) { let n = 0; while (g.build.upgradePath(trancada, pid) && n++ < 20); }
  if (g.build.getOffers(9).some((o) => o.kind === "path")) {
    bad("gate fechado e o level up ainda oferece tier");
  }
  const gate = g.build.nearestGate();
  if (!gate || gate.need !== PATH_RULES.axisGate[PATH_RULES.freeTier]) {
    bad(`nearestGate() nao aponta a trava: ${JSON.stringify(gate)}`);
  }
  g.ui.lvOffers = [];
  const tira = g.ui.buildStripHtml(-1);
  if (!tira.includes("lv-sp-lock")) {
    bad("a tira nao diz que a spell travou — nada na tela liga o level up a etapa");
  }
  if (gate && !tira.includes(`${gate.have}/${gate.need}`)) bad("a tira nao diz quanto falta de eixo");
  // e com o eixo cheio a trava some da tira
  g.build.axis[trancada.def.axis] = AXIS_RULES.pureAt;
  if (g.build.nearestGate()) bad("eixo no teto e a peca continua reportando trava");
  if (g.ui.buildStripHtml(-1).includes("lv-sp-lock")) bad("eixo no teto e a tira ainda mostra trava");
}

/* O resto do driver mede a CARTA, e carta de tier 5 (evolucao, chip de marco)
   so existe com o eixo aberto. O gate ja foi medido acima; aqui ele sai da
   frente. */
g.start(STARTER_TESTE);
g.player.level = BALANCE.levelup.passiveAt;
g.player.pendingLevels = 0;
for (const inst of g.build.pieces.values()) g.build.axis[inst.def.axis] = AXIS_RULES.pureAt;
// O bloco acima sorteia, entao o fluxo de RNG do laco principal depende de
// quantas vezes ele sorteou. Recravar a semente mantem a cobertura das cartas
// estavel quando alguem mexer no gate.
s = 7;

const seen = { path: 0, passive: 0, evo: 0, delta: 0, regua: 0, zero: 0 };
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
    try { html = g.ui.cardHtml(v); }
    catch (e) { bad(`${o.kind}: cardHtml explodiu — ${e.message}`); continue; }
    if (html.includes("undefined")) bad(`${o.kind} (${o.def.name}): carta com "undefined"`);
    const kind = o.isEvo && o.evo ? "Evolução" : KIND[o.kind];
    const glyph = o.isEvo && o.evo ? "★" : GLYPH[o.kind];
    if (!html.includes(kind)) bad(`${o.kind} (${o.def.name}): carta sem o tipo da oferta`);
    if (!html.includes(`<i>${glyph}</i>`)) bad(`${o.kind} (${o.def.name}): etiqueta sem glifo`);
    if ((o.kind === "passive") !== html.includes("lv-tile round")) {
      bad(`${o.kind} (${o.def.name}): forma do tile nao casa com o tipo`);
    }
    /* A terceira coluna era CUSTO e virou PROGRESSO — o level up nao cobra
       mais nada, e uma coluna dizendo "não gasta ponto" tres vezes seria um
       terco da tela em silencio. Ela continua obrigatoria: sem ela a linha nao
       diz onde a compra deixa a trilha, que e a pergunta desta tela. */
    if (!v.progHead) bad(`${o.kind} (${o.def.name}): carta sem veredito de progresso`);
    if (v.cost != null || v.gain != null) {
      bad(`${o.kind} (${o.def.name}): view ainda carrega custo de eixo`);
    }
    /* A MANCHETE tem que ser o efeito, nao o nome. Numa carta o nome vem antes
       no espaco, entao a unica coisa que segura a hierarquia e o tamanho: se
       `.lv-plain` sumir do HTML, a carta passa a ser lida pelo rotulo. */
    if (!html.includes('class="lv-plain"')) bad(`${o.kind} (${o.def.name}): carta sem manchete`);
    if (v.delta.length) seen.delta++;

    /* --- a REGUA (9.3) ---------------------------------------------------
       O heroi da carta e o ganho em dano/s, e ele so vale se for COMPARAVEL:
       a barra e comparativa, entao o que ela mede tem que ser um numero, ter
       a mesma unidade nas tres cartas e nunca ser negativo — um tier que
       PIORASSE a peca seria uma barra crescendo para tras.

       Zero e resposta legitima (controle, cura, deslocamento nao movem a
       regua), e por isso a carta nao pode imprimir "+0": "+0 dano/s" le como
       peca quebrada quando o que houve foi a regua nao medir aquilo. */
    if (typeof v.dps !== "number" || !isFinite(v.dps)) {
      bad(`${o.kind} (${o.def.name}): ganho em dano/s nao e numero (${v.dps})`);
    } else if (v.dps < -0.5) {
      bad(`${o.kind} (${o.def.name}): a oferta PIORA a peca (${v.dps.toFixed(1)} dano/s)`);
    } else if (v.dps > 0.5) seen.regua++;
    else { seen.zero++; if (html.includes("+0")) bad(`${o.kind} (${o.def.name}): carta com "+0"`); }
    if (!html.includes("lv-escala")) bad(`${o.kind} (${o.def.name}): carta sem a barra da regua`);
    /* O slot em Eczar diz COMO a peca se comporta e nunca repete o numero.
       528 dos 660 tiers sao gerados e o texto deles e puro numero — o mesmo
       dado que a regua imprime em mono 38 e que os valores crus imprimem em
       "antes -> depois". Tier puramente numerico cede o slot para o `desc` da
       peca; tier estrutural fica com o proprio texto. */
    if (o.kind === "path" && o.tier.mods && !o.tier.patch &&
        v.plain !== LINE_ABOUT[o.pathId]) {
      bad(`path ${o.def.name} (${o.pathId}): tier numerico repetindo o numero ` +
          `no slot de comportamento`);
    }
    // A tecla substitui os tres botoes `ESCOLHER`, e ela e o rotulo do input
    // certo desta tela: 17 a 70 escolhas por run.
    if (!html.includes("lv-tecla")) bad(`${o.kind} (${o.def.name}): carta sem a tecla`);
    if (html.includes("btn-fantasma")) bad(`${o.kind} (${o.def.name}): o botao ESCOLHER voltou`);

    if (o.kind === "path") {
      if (!html.includes(o.def.name)) bad(`path ${o.def.name}: carta nao diz qual peca melhora`);
      const on = (html.match(/<i class="on/g) || []).length;
      if (on !== o.tierIndex + 1) bad(`path ${o.def.name}: ${on} pips acesos, esperado ${o.tierIndex + 1}`);
      if (!html.includes(`<b>${o.tierIndex + 1}</b>`)) {
        bad(`path ${o.def.name}: tile sem o selo do tier`);
      }
      if (o.isEvo) { seen.evo++; if (!html.includes("Evolução")) bad("evolucao sem etiqueta propria"); }
    }
    if (o.kind === "passive" && !html.includes("não dispara")) {
      bad(`passiva ${o.def.name}: carta nao diz que nao dispara`);
    }
  }

  /* Nenhuma escolha desta tela pode mexer no pool de eixo. E a invariante que
     separa as duas batidas, e ela e barata de conferir: sem ela, um tier que
     voltasse a chamar `addAxis` recolocaria o imposto sobre profundidade sem
     que nada na tela dissesse isso ao jogador. */
  const poolAntes = g.build.axisTotal;

  /* A tira tem que aguentar a build inteira sem estourar: ela e uma linha so, e
     o que passa do teto vira contador — overlay de jogo nao tem rolagem. */
  g.ui.lvOffers = offers;
  for (let h = -1; h < offers.length; h++) {
    let tira;
    try { tira = g.ui.buildStripHtml(h); }
    catch (e) { bad(`buildStripHtml(${h}) explodiu — ${e.message}`); break; }
    if (tira.includes("undefined")) bad(`tira (hover ${h}) com "undefined"`);
    const n = g.build.pieces.size;
    let chips = (tira.match(/class="lv-sp[ "]/g) || []).length;
    if (tira.includes("lv-sp more")) chips--;   // o contador de excedente nao e uma spell
    if (chips !== Math.min(n, STRIP.spells)) {
      bad(`tira: ${chips} spells com ${n} pecas (teto ${STRIP.spells})`);
    }
    if (n > STRIP.spells && !tira.includes("lv-sp more")) {
      bad("tira: excedente de spells sem contador");
    }
    const pc = (tira.match(/class="lv-chip"/g) || []).length;
    if (pc > STRIP.chips) bad(`tira: ${pc} chips de passiva, teto ${STRIP.chips}`);
    if (g.build.passives.size > STRIP.chips && !tira.includes("lv-chip more")) {
      bad("tira: excedente de passivas sem chip +N");
    }
    /* Eixo e capstone NAO moram mais aqui: nenhuma oferta desta tela os move, e
       a tela de etapa ja os mostra com previa ao vivo. Numero parado ao lado de
       tres cartas que nao o tocam e ruido. */
    if (tira.includes("lv-ax")) bad("tira: eixo voltou para a tela de level-up");
    // E a spell afetada pela carta sob o mouse nunca pode cair no contador.
    if (h >= 0 && offers[h].kind === "path" && !tira.includes("lv-sp hit")) {
      bad(`tira (hover ${h}): a spell melhorada nao esta destacada`);
    }
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
/* --- o acervo de icone -------------------------------------------------
   As dez primitivas sao FALLBACK. Quando elas viraram o acervo, nove pecas na
   tira do HUD davam quatro marcas distintas e duas pecas diferentes caiam na
   mesma forma — o icone parou de identificar, que e a unica coisa que ele faz.
   Peca sem desenho proprio e divida, entao ela reprova aqui em vez de aparecer
   como um losango a mais no meio de outros cinco. */
{
  const fora = [];
  for (const id in UI_ICONS) {
    const r = UI_ICONS[id];
    if (r.length !== 16) { fora.push(`${id}: ${r.length} linhas`); continue; }
    for (let i = 0; i < 16; i++) {
      if (r[i].length !== 16) fora.push(`${id} linha ${i}: ${r[i].length} colunas`);
    }
  }
  if (fora.length) bad(`grade de icone fora de 16x16: ${fora.slice(0, 4).join(", ")}`);

  const semDesenho = [];
  for (const id in PIECES) if (!Glyph.temDesenho(id)) semDesenho.push(id);
  if (semDesenho.length) {
    bad(`peca(s) so com primitiva: ${semDesenho.join(", ")} — o acervo e por peca`);
  } else {
    console.log(`ok  acervo de icone: ${Object.keys(PIECES).length} pecas com desenho proprio`);
  }
}

console.log(problems ? `X   ${problems} problemas na tela de level-up`
  : `ok  level-up validado — ${seen.path} caminho (${seen.evo} evolucao), ` +
    `${seen.passive} passiva, ${seen.delta} com antes/depois, ` +
    `${seen.regua} com ganho medido, ${seen.zero} sem ganho de dano`);
if (problems) __exit(1);
