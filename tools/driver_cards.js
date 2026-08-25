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

/* --- profundidade NAO depende de eixo ------------------------------------
   Este bloco media o gate de eixo (`PATH_RULES.axisGate`): tier 3 pedia 1
   ponto, o 4 pedia 5, o 5 pedia 10. O gate saiu, e o bloco inverteu junto —
   ele agora cobra a AUSENCIA, que e uma coisa que so um driver percebe.

   Sem inversao, um gate reintroduzido por acidente (ou um `axisGate` que volte
   como dado morto e alguem religue) faria as trilhas pararem em silencio: o
   sintoma jogando e "a spell parou de aparecer no level up", e nenhuma tela
   diz por que. O que segura profundidade agora e `maxDeep`/`maxLines`, e o
   segundo bloco cobra que ELES continuem segurando. */
const primeira = () => g.build.pieces.values().next().value;
{
  /* Com ZERO ponto no eixo da peca, uma linha vai do tier 0 ao 5. E o teste
     inteiro: nao ha degrau nenhum cobrando recurso pelo caminho. */
  g.start(STARTER_TESTE);
  {
    const inst = primeira();
    for (const a of g.build.axes) g.build.axis[a] = 0;
    const pathId = Object.keys(inst.def.paths)[0];
    let guard = 0;
    while (g.build.upgradePath(inst, pathId) && guard++ < 20);
    if (inst.paths[pathId] !== PATH_RULES.tiers) {
      bad(`com 0 de ${inst.def.axis} a trilha parou no tier ` +
          `${inst.paths[pathId]}, e sem gate ela devia fechar em ${PATH_RULES.tiers}`);
    }
  }

  /* E o que SOBROU segurando: uma linha por vez, duas na vida da peca. Com a
     primeira linha fechada, a segunda abre; a terceira nao. */
  g.start(STARTER_TESTE);
  {
    const inst = primeira();
    for (const a of g.build.axes) g.build.axis[a] = 0;
    const ids = Object.keys(inst.def.paths);
    let guard = 0;
    while (g.build.upgradePath(inst, ids[0]) && guard++ < 20);
    // com a primeira EM PROGRESSO a segunda nao passa da zona franca — mas a
    // primeira ja fechou aqui, entao a segunda tem que andar.
    guard = 0;
    while (g.build.upgradePath(inst, ids[1]) && guard++ < 20);
    if (inst.paths[ids[1]] !== PATH_RULES.tiers) {
      bad(`fechar a 1a linha nao devolveu a escolha: 2a parou no tier ${inst.paths[ids[1]]}`);
    }
    guard = 0;
    while (g.build.upgradePath(inst, ids[2]) && guard++ < 20);
    if (inst.paths[ids[2]] > PATH_RULES.freeTier) {
      bad(`a 3a linha passou da zona franca (tier ${inst.paths[ids[2]]}): ` +
          `maxLines ${PATH_RULES.maxLines} nao esta segurando`);
    }
  }

  /* Uma linha EM PROGRESSO tranca as outras — e este e o `maxDeep`, que e o
     que tira as duas cartas da mesma spell da tela. */
  g.start(STARTER_TESTE);
  {
    const inst = primeira();
    for (const a of g.build.axes) g.build.axis[a] = 0;
    const ids = Object.keys(inst.def.paths);
    g.build.upgradePath(inst, ids[0]);              // sai da zona franca...
    g.build.upgradePath(inst, ids[0]);              // ...e trava as outras
    let guard = 0;
    while (g.build.upgradePath(inst, ids[1]) && guard++ < 20);
    if (inst.paths[ids[1]] > PATH_RULES.freeTier) {
      bad(`com a 1a linha em progresso a 2a chegou ao tier ${inst.paths[ids[1]]}: ` +
          `maxDeep ${PATH_RULES.maxDeep} nao esta segurando`);
    }
  }

  // com tudo fechado o bolo esvazia — e ai a tela diz "arsenal completo".
  g.start(STARTER_TESTE);
  const trancada = primeira();
  for (const pid in trancada.paths) { let n = 0; while (g.build.upgradePath(trancada, pid) && n++ < 20); }
  if (g.build.getOffers(9).some((o) => o.kind === "path")) {
    bad("peca sem caminho para subir e o level up ainda oferece tier");
  }
  g.ui.lvOffers = [];
  if (g.ui.buildStripHtml(-1).includes("lv-sp-lock")) {
    bad("a tira ainda desenha a trava de eixo, que saiu junto com o gate");
  }
}

/* --- o excedente vira PRESSA ---------------------------------------------
   Bolo vazio deixou de ser caso de borda: com cinco spells e uma linha por vez
   a build cabe em ~45 tiers e a run passa dos 70 niveis, entao a partir de
   certo ponto TODO nivel cai aqui. O que o driver cobra sao as duas pontas que
   um "sempre aumentar" sem cuidado erra:

     - ele de fato acumula, e acumula na build INTEIRA (`cooldownMul`, o mesmo
       numero que `TRIGGERS.cd` aplica em toda peca);
     - e ele TEM PISO. Recarga convergindo para zero nao e uma build rapida, e
       um disparo por sub-step. */
{
  g.start(STARTER_TESTE);
  const b = g.build, ov = BALANCE.levelup.overflow;
  if (b.overflowHaste !== 0) bad("a run nasce com stack de pressa");
  const base = g.cooldownMul;

  const um = b.addOverflowHaste();
  if (!(g.cooldownMul < base)) {
    bad(`um nivel excedente nao acelerou nada: cooldownMul ${base} -> ${g.cooldownMul}`);
  }
  if (!(um.total > 0)) bad(`addOverflowHaste devolveu total ${um.total}`);

  const dois = b.addOverflowHaste();
  if (!(dois.total > um.total)) {
    bad(`a pressa nao acumulou: ${um.total} -> ${dois.total}`);
  }

  // o PISO: duzentos niveis excedentes nao podem levar a recarga a zero.
  for (let i = 0; i < 200; i++) b.addOverflowHaste();
  if (b.overflowFactor() < ov.floor - 1e-9) {
    bad(`a pressa furou o piso: ${b.overflowFactor()} < ${ov.floor}`);
  }
  if (Math.abs(b.overflowFactor() - ov.floor) > 1e-9) {
    bad(`200 niveis excedentes deveriam cravar o piso, deu ${b.overflowFactor()}`);
  }
  // e um capstone que PENALIZA recarga continua penalizando: o piso e sobre a
  // contribuicao do excedente, nao sobre o total.
  if (!(g.cooldownMul <= ov.floor + 1e-9)) {
    bad(`o piso vazou para o total: cooldownMul ${g.cooldownMul}`);
  }
  // reiniciar a run zera os stacks
  g.start(STARTER_TESTE);
  if (g.build.overflowHaste !== 0) bad("reiniciar a run manteve a pressa acumulada");
}

/* --- passiva e do EIXO DA ABERTURA ---------------------------------------
   Toda passiva declara `axis`, e so aparecem as do eixo escolhido na abertura.
   Tres coisas podem mentir aqui, e as tres sao silenciosas jogando: */
{
  const semEixo = [];
  for (const id in PASSIVES) if (!PASSIVES[id].axis) semEixo.push(id);
  if (semEixo.length) {
    bad(`passiva sem eixo: ${semEixo.join(", ")} — ela nunca seria oferecida`);
  }

  /* PAR EXCLUSIVO MORA NO MESMO EIXO. Separadas, o jogador nunca ve as duas na
     mesma run e o `exclusive` vira um campo que nao faz nada. */
  for (const id in PASSIVES) {
    const p = PASSIVES[id], par = p.exclusive && PASSIVES[p.exclusive];
    if (par && par.axis !== p.axis) {
      bad(`${id} (${p.axis}) e ${p.exclusive} (${par.axis}) sao exclusivas em ` +
          "eixos diferentes: a escolha entre as duas nunca acontece");
    }
  }

  /* NENHUM EIXO SEM PASSIVA. Um eixo vazio seria um terco das aberturas
     jogando uma run inteira sem passiva nenhuma. */
  for (const cid in CLASSES) {
    const cls = CLASSES[cid];
    if (!cls.available || !cls.axes) continue;
    for (const a of cls.axes) {
      const n = Object.keys(PASSIVES)
        .filter((id) => PASSIVES[id].cls === cid && PASSIVES[id].axis === a).length;
      if (!n) bad(`${cid}: o eixo ${a} nao tem passiva nenhuma`);
    }
  }

  /* E o filtro cobra de verdade: com a abertura num eixo, o bolo so traz
     passiva DELE. */
  g.start(STARTER_TESTE);
  const alvo = g.build.startAxis;
  g.player.level = BALANCE.levelup.passiveAt;
  g.player.pendingLevels = 0;
  if (!alvo) bad("startAxis vazio depois da abertura — o filtro de passiva nao teria como valer");
  else {
    const fora = g.build.getOffers(40)
      .filter((o) => o.kind === "passive" && o.def.axis !== alvo);
    if (fora.length) {
      bad(`abertura em ${alvo} e o bolo trouxe passiva de outro eixo: ` +
          fora.map((o) => `${o.id} (${o.def.axis})`).join(", "));
    }
  }
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
    /* O veredito de progresso ("Faltam 3 para fechar") saiu da carta: os pips
       do rodape ja desenham o mesmo fato, e escrito ele era a coordenada duas
       vezes. Se voltar como campo, volta como texto na carta. */
    if (v.progHead != null) bad(`${o.kind} (${o.def.name}): o veredito de progresso voltou`);
    if (html.includes("lv-prog-head")) bad(`${o.kind} (${o.def.name}): rodape com veredito escrito`);
    if (v.cost != null || v.gain != null) {
      bad(`${o.kind} (${o.def.name}): view ainda carrega custo de eixo`);
    }
    /* TODA CARTA DIZ O QUE A COMPRA MUDA, e ha duas maneiras: o paragrafo do
       comportamento novo (`.lv-plain`, tier estrutural e passiva) ou o "antes
       -> depois" do proprio upgrade (`.lv-crus`, tier numerico). Sem nenhuma
       das duas a carta e um numero solto, e a tela volta a ser lida pelo
       rotulo. */
    if (!html.includes('class="lv-plain"') && !html.includes('class="lv-crus"')) {
      bad(`${o.kind} (${o.def.name}): carta sem manchete nem upgrade`);
    }
    if (v.delta.length) seen.delta++;

    /* --- A REGUA SAIU DA CARTA, E O MODELO CONTINUA MEDIDO AQUI ----------
       O "+106 dano/s", a barra e o selo de maior ganho nao sao mais
       desenhados: a carta parou de PREVER e passou a dizer so o que a compra
       muda de fato. Mas `BuildSystem.offerGain` -> `js/systems/dps.js`
       continua de pe (e continua cobrado por `driver_bench`, bloco REGUA x
       CAMPO), entao quem exercita o modelo por oferta e este driver — sem
       isso, um modelo sem consumidor apodrece calado ate o dia em que a tela
       quiser prever de novo.

       O que ele promete e ORDEM: numero finito e nunca negativo. Uma oferta
       que PIORASSE a peca seria uma barra crescendo para tras. */
    let ganho;
    try { ganho = g.build.offerGain(o); }
    catch (e) { bad(`${o.kind} (${o.def.name}): offerGain explodiu — ${e.message}`); ganho = 0; }
    if (typeof ganho !== "number" || !isFinite(ganho)) {
      bad(`${o.kind} (${o.def.name}): ganho em dano/s nao e numero (${ganho})`);
    } else if (ganho < -0.5) {
      bad(`${o.kind} (${o.def.name}): a oferta PIORA a peca (${ganho.toFixed(1)} dano/s)`);
    } else if (ganho > 0.5) seen.regua++;
    else seen.zero++;
    // E ela nao pode voltar a ser desenhada sem passar por aqui.
    for (const c of ["lv-escala", "lv-ganho", "lv-top-lbl"]) {
      if (html.includes(c)) bad(`${o.kind} (${o.def.name}): a regua voltou para a carta (${c})`);
    }
    /* Tier puramente numerico NAO tem paragrafo: a frase da linha que morava
       ali dizia por extenso o mesmo que o proprio upgrade diz, igual nas cinco
       cartas daquela linha. Quem fala por ele e o antes -> depois. */
    if (o.kind === "path" && o.tier.mods && !o.tier.patch && v.delta.length) {
      if (v.plain) {
        bad(`path ${o.def.name} (${o.pathId}): tier numerico com paragrafo — ` +
            `o upgrade ja e o texto da carta`);
      }
      if (!html.includes('class="lv-crus"')) {
        bad(`path ${o.def.name} (${o.pathId}): tier numerico sem "antes -> depois"`);
      }
    }
    // A coordenada do tier mora nos pips, e nao escrita no subtitulo.
    if (o.kind === "path" && /tier \d/.test(v.subtitle || "")) {
      bad(`path ${o.def.name}: subtitulo repetindo a coordenada do tier`);
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
