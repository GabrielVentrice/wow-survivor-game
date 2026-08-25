/* Nao mede nada: ESCREVE `tools/telas-preview.html`, as SETE telas de UI
   montadas com builds de verdade — as mesmas que a run produz — para revisar o
   layout sem ter que jogar ate o nivel 20.

   Vale o mesmo argumento do `sprites.html`: uma tela que so aparece por alguns
   segundos, em estados que dependem de sorteio, nao se revisa jogando. O level
   up aparece com a build pequena, media e grande — a ultima e onde a tira passa
   do teto e o contador aparece; a etapa aparece nas duas fases, fechada e
   aberta, que e onde as colunas dela trocam de forma.

   A etapa merece revisao ainda mais que o level up: ela e a unica decisao
   irreversivel da run, aparece so sete vezes, e as tres colunas precisam ser
   comparaveis de relance. Se o buff e os dois numeros de uma coluna nao
   contarem a troca sozinhos, o jogador escolhe no escuro e nao tem como voltar.

   O HTML sai dos mesmos `UI.cardHtml` / `UI.buildStripHtml` / `UI.msRowHtml` do
   jogo e o CSS e lido do proprio `index.html`: previa que diverge do jogo nao
   serve. */
const g = new Game();
window.game = g;
let s = 11;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
g.start(STARTER_TESTE);

/* Os quatro estados que valem revisao, cacados na simulacao em vez de fixados
   por numero de rodada: build pequena (linha completa), build media (linha
   compacta), build que nao cabe (contador de excedente) e evolucao na mesa —
   esse ultimo e o mais raro de ver jogando e o que tem etiqueta propria. */
const shots = [];
const took = {};
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
/* Qual linha fica sob o mouse: a evolucao quando ha uma, senao a primeira que
   ja tem tier andado — e o hover que destaca a spell afetada no painel, o
   estado que mais precisa de revisao. */
const pickHover = (offers, evo) => {
  if (evo >= 0) return evo;
  const fundo = offers.findIndex((o) => o.kind === "path" && o.tierIndex > 0);
  return fundo >= 0 ? fundo : 0;
};
const take = (id, label, offers, hoverIdx) => {
  if (took[id]) return;
  took[id] = true;
  g.ui.lvOffers = offers;
  g.ui.lvViews = offers.map((o) => g.ui.offerView(o));
  let cards = "";
  for (let i = 0; i < g.ui.lvViews.length; i++) {
    const v = g.ui.lvViews[i];
    cards += `<div class="lv-card ch2" style="${g.ui.eixoVars(v.axisId)}">` +
             `${g.ui.cardHtml(v, i + 1)}</div>`;
  }
  shots.push({
    lv: g.player.level, cards,
    panel: g.ui.buildStripHtml(hoverIdx),
    label: `${label} — ${plural(g.build.pieces.size, "spell")} · ` +
           `${plural(g.build.passives.size, "passiva")} · hover na linha ${hoverIdx + 1}`,
  });
};

/* A ABERTURA e a tela que menos se revisa jogando de todas: ela aparece UMA vez
   por run e some no primeiro clique. Ela sai do mesmo `UI.stRowHtml` do jogo,
   com o rodape zerado — que e o estado real dela, e o unico momento em que os
   tres eixos aparecem lado a lado sem nenhum escolhido. */
const abertura = (() => {
  const offers = g.build.getStarterOffers();
  let rows = "";
  for (const o of offers) {
    rows += `<div class="ms-row" style="${g.ui.eixoVars(o.axisId)}">${g.ui.stRowHtml(o)}</div>`;
  }
  const cls = CLASSES[g.selectedClass];
  return {
    rows,
    eyebrow: `<span>Abertura</span><s></s><span>${cls.name}</span><s></s>` +
             `<span>${offers.length} spells · uma escolha</span>`,
    sub: "Uma por família, e todas disparam sozinhas desde o primeiro segundo. " +
         "Ela não cobra ponto de eixo: o que você escolhe aqui é com o que a run " +
         "começa, não para onde ela vai.",
    pool: g.ui.axesHtml(null, 0),
    pacto: `<div class="ms-pacto">Uma run cabe em <b>${AXIS_RULES.maxAxes} famílias</b> — ` +
           `a terceira fecha quando a segunda abrir</div>`,
  };
})();

/* A etapa, nos dois extremos: o primeiro marco (2 pontos, build crua, capstone
   longe) e um marco tardio (5 pontos, eixo carregado, capstone ao alcance). Sao
   os dois estados em que os numeros da carta mudam de peso. */
const msShots = [];
let chest = null;
let msAberta = false;
const takeMs = (idx, label) => {
  const offers = g.build.getMilestoneOffers();
  if (!offers.length) return;
  let rows = "";
  for (const o of offers) {
    rows += `<div class="ms-row${o.locked ? " aberta" : ""}" style="${g.ui.eixoVars(o.axisId)}">` +
             `${g.ui.msRowHtml(o)}</div>`;
  }
  // O rodape com previa: a carta sob o mouse e a do eixo mais investido, que e
  // onde a linha do capstone tem algo a dizer.
  let hov = offers[0];
  for (const o of offers) if (g.build.axis[o.axisId] > g.build.axis[hov.axisId]) hov = o;
  const step = hov.dry || hov.wet;
  const falta = g.build.axisLeft;
  msShots.push({
    rows, label,
    eyebrow: `<span>Etapa ${idx + 1}</span><s></s>` +
             `<span>${fmtNum(g.milestoneKillsAt(idx))} abates</span><s></s>` +
             `<span>${falta} ponto${falta === 1 ? "" : "s"} por gastar</span>`,
    sub: (offers.find((o) => o.locked)
      ? `${offers.find((o) => o.locked).axis.name} já está aberta: o eixo sozinho não cobra mais nada. A spell, sim.`
      : "O único ponto que não volta. Escolha o eixo — a spell vem junto, cobrando um ponto."),
    pool: g.ui.axesHtml(hov.axisId, step.gain),
    cap: g.ui.capLineHtml(hov, step),
  });
};

// Fase FECHADA: nenhum eixo em `unlockAt`, entao as tres linhas sao spells
// sorteadas do catalogo inteiro e nao ha lado seco em lugar nenhum.
takeMs(0, "fase fechada — três spells sorteadas, nenhum eixo aberto ainda");

for (let r = 0; r < 300; r++) {
  const offers = g.build.getOffers(3);
  if (!offers.length) break;
  // Enquanto a run corre, as etapas vao caindo — sem elas o pool fica em zero e
  // a previa tardia mostraria uma tela que o jogo nunca produz.
  if (r > 0 && r % 4 === 0 && g.build.axisLeft > 0) {
    const ms = g.build.getMilestoneOffers();
    if (ms.length) {
      /* Empilha sempre o MESMO eixo: e o unico jeito de a previa alcancar a
         fase aberta, que e a segunda tela que ela existe para mostrar. Com
         spell enquanto a build precisa crescer (o painel troca de densidade
         com o numero de spells), seca depois que o eixo abre. */
      const alvo = ms.find((o) => o.locked)
                || ms.find((o) => o.axisId === "corruption")
                || ms[0];
      /* A fase ABERTA e capturada assim que ela existe, e nao no fim do laco:
         desde que o slot de eixo no teto saiu da mesa, empilhar ate 15/15 fazia
         a tela da fase aberta simplesmente nao acontecer mais — e ela e uma das
         duas que esta previa existe para mostrar. */
      if (alvo.locked && !msAberta) { msAberta = true; takeMs(11, "fase aberta — o eixo comprometido virou slot fixo com as duas maneiras"); }
      g.build.applyMilestone(alvo, !alvo.dry);
    }
  }
  /* O bau tem que ser pego COM a build ainda incompleta: no fim do laco todo
     caminho esta no tier 5 e ele so entrega "arsenal no maximo", que e o estado
     que menos precisa de revisao. */
  if (r === 10 && !chest) {
    g.ui.openChest();
    chest = {
      rarity: document.getElementById("chestRarity").textContent,
      count: document.getElementById("chestCount").textContent,
      pips: document.getElementById("chestPips").innerHTML,
      list: document.getElementById("chestList").innerHTML,
      // a coluna estreita junto com o premio: sem carregar a var, a previa
      // mostrava sempre a largura de lendario
      w: document.getElementById("chest").style.getPropertyValue("--bau-w") || "640px",
    };
    g.ui.closeChest();
  }
  const n = g.build.pieces.size;
  const evo = offers.findIndex((o) => o.isEvo && o.evo);
  if (evo >= 0) take("evo", "evolução na mesa", offers, pickHover(offers, evo));
  else if (r === 0) take("small", "build crua — duas spells", offers, pickHover(offers, -1));
  else if (n > STRIP.spells) take("over", "tira no teto, com contador", offers, pickHover(offers, -1));
  else if (n > 4) take("mid", "build média", offers, pickHover(offers, -1));
  g.ui.applyOffer(offers[Math.floor(Math.random() * offers.length)]);
}


let body = `<p class="cap">abertura · a primeira tela da run, uma spell por eixo</p>
  <div class="frame"><div class="screen ms">
    <div class="ms-wrap">
      <div class="ms-head-top">
        <div class="ms-eyebrow">${abertura.eyebrow}</div>
        <div class="ms-title">Com o que você começa?</div>
        <div class="ms-sub">${abertura.sub}</div>
      </div>
      <div class="ms-rows">${abertura.rows}</div>
      <div class="ms-foot">
        <div class="ms-pool">${abertura.pool}</div>
        <div class="ms-capwrap">${abertura.pacto}</div>
      </div>
    </div></div></div>`;
for (const sh of shots) {
  body += `<p class="cap">level up · ${sh.label}</p>
  <div class="frame"><div class="screen lv">
    <div class="lv-timer">
      <div>07:05</div>
      <div class="lv-parou">O relógio parou</div>
    </div>
    <div class="lv-wrap">
      <div class="lv-head">
        <div class="lv-eyebrow">Nível ${sh.lv} → ${sh.lv + 1}</div>
        <div class="lv-title">Aprofunde uma</div>
        <div class="lv-legenda">a barra mede o ganho de dano por segundo — a mais longa ganha mais</div>
      </div>
      <div class="lv-cards">${sh.cards}</div>
    </div>
    <div class="lv-base">
      <div class="lv-strip">${sh.panel}</div>
      <div class="lv-foot">
        <span>Nada aqui custa ponto de eixo · a próxima escolha corrige esta</span>
        <span>1 2 3 para escolher</span>
      </div>
    </div></div></div>`;
}

for (const sh of msShots) {
  body += `<p class="cap">etapa · ${sh.label}</p>
  <div class="frame"><div class="screen ms">
    <div class="ms-wrap">
      <div class="ms-head-top">
        <div class="ms-eyebrow">${sh.eyebrow}</div>
        <div class="ms-title">Para onde esta run vai?</div>
        <div class="ms-sub">${sh.sub}</div>
      </div>
      <div class="ms-rows">${sh.rows}</div>
      <div class="ms-foot">
        <div class="ms-pool">${sh.pool}</div>
        <div class="ms-capwrap">${sh.cap}</div>
      </div>
    </div></div></div>`;
}

const src = __read("index.html");
/* --- as outras cinco telas ------------------------------------------------
   Level up e etapa nao sao as unicas que so aparecem por segundos: HUD, pausa,
   bau e game over aparecem em estados que dependem de sorteio, e o game over so
   aparece quando a run acaba. Todas saem dos MESMOS metodos do jogo — o driver
   so pega o que eles escreveram nos elementos e remonta a moldura.

   A casca de cada tela e escrita aqui, e por isso a lista de ids abaixo e
   conferida contra o index.html: preview que diverge do jogo nao serve, e uma
   casca desatualizada e exatamente como ela diverge em silencio. */
const shell = (id) => {
  if (!src.includes(`id="${id}"`)) {
    console.log(`X  id "${id}" nao existe mais no index.html — a previa divergiu`);
    return "";
  }
  return document.getElementById(id).innerHTML;
};

let telas = "";
const frame = (cap, cls, inner) => {
  telas += `<p class="cap">${cap}</p>
  <div class="frame"><div class="screen ${cls}">${inner}</div></div>`;
};

/* Antes de capturar HUD, pausa e game over, a simulacao RODA. As tres telas
   sao sobre o que a run produziu — dano por peca, abates, tempo — e capturadas
   logo depois das escolhas elas saiam com "nada causou dano ainda" nos dois
   paineis que mais importam. Numero vazio numa previa nao e um estado raro: e
   uma tela que nao existe no jogo. */
g.ui.openLevelUp = function () { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openMilestone = function () { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
g.ui.openChest = function () {};
for (let i = 0; i < 60 * 90; i++) g.update(1 / 60);

// a run continua de onde as previas de level up pararam: build carregada
g.ui.updatePieceBar();
/* A cadeia so existe no meio de uma leva, e uma leva dura menos de um segundo
   — e exatamente o tipo de estado que nao se revisa jogando. A previa a poe
   num degrau do meio, com o pavio pela metade e o salto no meio do caminho. */
g.comboCount = BALANCE.combo.tiers[1] + 2;
g.comboUntil = g.clock + BALANCE.combo.window * 0.58;
g.comboPulseAt = g.clock - BALANCE.combo.pulse * 0.35;
g.ui.updateHUD();
const cbSz = g.ui.el.combo.style.getPropertyValue("--combo-sz");
const cbTr = g.ui.el.comboNum.style.transform;
const cbFu = g.ui.el.comboFuse.style.width;
frame("hud · build carregada, com o mundo atras", "tela-hud",
  `<div class="hud-tl">${shell("pieceBar")}</div>
   <div class="hud-tc"><div id="t" class="dado-l">${document.getElementById("timer").textContent}</div>
     <div class="rotulo">${document.getElementById("hudCtx").textContent}</div></div>
   <div class="hud-tr">${shell("axisBar")}</div>
   <div class="hud-bc">
     <div class="barra-vida"><i style="width:64%"></i><i style="width:0"></i></div>
     <div class="barra-xp"><i style="width:38%"></i></div>
     <div class="hud-vit rotulo"><span>64 / 100</span><span>Nível ${g.player.level}</span></div>
   </div>
   <div class="hud-br">${shell("toasts")}</div>
   <div class="hud-ml" style="--combo-sz:${cbSz}">
     <b class="combo-num" style="transform:${cbTr}">${g.comboCount}</b>
     <div class="combo-pe"><span class="rotulo">em cadeia</span>
       <div class="combo-pavio"><i style="width:${cbFu}"></i></div></div>
   </div>`);

g.ui.onPause();
frame("pausa · a build inteira legivel", "tela-pausa",
  `<div class="pa-wrap">
    <div class="pa-head">
      <div><h2>Pausado</h2><div class="rotulo dim">ESC para voltar</div></div>
      <div class="rotulo">${document.getElementById("pauseMeta").textContent}</div>
    </div>
    <div class="pa-body">
      <section class="painel ch3 pa-pecas">
        <header class="painel-h"><h3>Peças</h3><span class="dado-m">${
          document.getElementById("pauseCount").textContent}</span></header>
        <div class="painel-b">${shell("pausePieces")}</div>
      </section>
      <div class="pa-side">
        <section class="painel ch3">
          <header class="painel-h"><h3>Eixos</h3><span class="dado-m">${
            document.getElementById("pausePool").textContent}</span></header>
          <div class="painel-b">${shell("pauseAxes")}</div>
        </section>
        <section class="painel ch3">
          <header class="painel-h"><h3>Dano por peça</h3><span class="dado-m">${
            document.getElementById("pauseDmgTot").textContent}</span></header>
          <div class="painel-b">${shell("pauseDmg")}</div>
        </section>
      </div>
    </div>
    <div class="pa-foot">
      <button class="btn btn-recuado ch1">Sair</button>
      <button class="btn btn-recuado ch1">Reiniciar</button>
      <button class="btn btn-osso ch1 btn-56">Continuar</button>
    </div>
  </div>`);

if (!chest) g.ui.openChest();
const bau = chest || {
  rarity: document.getElementById("chestRarity").textContent,
  count: document.getElementById("chestCount").textContent,
  pips: document.getElementById("chestPips").innerHTML,
  list: document.getElementById("chestList").innerHTML,
  w: document.getElementById("chest").style.getPropertyValue("--bau-w") || "640px",
};
shell("chestList"); shell("chestPips");   // confere que os ids nao sumiram
frame("baú · a escada de raridade sem matiz novo", "tela-bau",
  `<div class="bau-col" style="--bau-w:${bau.w}">
    <div class="bau-head"><span class="bau-selo ch1"></span><h2 class="display-l">Baú do Dreadlord</h2></div>
    <div class="bau-rar"><span class="rotulo">${bau.rarity}</span>
      <span class="rar-pips">${bau.pips}</span>
      <span class="rotulo dim">${bau.count}</span></div>
    <div class="bau-lista">${bau.list}</div>
    <button class="btn btn-osso ch1 btn-64">Continuar</button>
    <div class="rotulo bau-nota">Nada a escolher · já é seu</div>
  </div>`);

g.ui.onGameOver();
frame("game over · altura fixa por construção", "tela-go",
  `<div class="go-wrap">
    <header class="go-head">
      <div><div class="rotulo go-eyebrow">A Legião prevaleceu</div><h2 class="go-title">Você tombou</h2></div>
      <span class="go-marca"></span>
    </header>
    <div class="go-faixa placa ch3">${shell("goNums")}</div>
    <div class="go-body">
      <section class="go-dmg"><h3 class="display-s">Dano por peça</h3><div>${shell("goDmg")}</div></section>
      <aside class="go-resumo">
        <h3 class="display-s">A run em uma linha</h3>
        <div class="painel ch3"><p class="texto-l">${document.getElementById("goLine").textContent}</p>
          <div class="painel-div"></div><div>${shell("goExtra")}</div></div>
        <div class="go-acoes"><button class="btn btn-osso ch1 btn-64">Tentar de novo</button>
          <button class="btn btn-recuado ch1">Menu</button></div>
      </aside>
    </div>
  </div>`);

/* The version notes. The preview assembles the rail by hand from the children
   the UI created, because `drawChangelog` uses `appendChild` (each row needs
   its own `onclick`) and the stub does not reflect that back in `innerHTML` —
   the content is still exactly what the game drew. */
g.ui.openChangelog(0);
let logNav = "";
for (const b of g.ui.el.logNav.children.slice(-CHANGELOG.length)) {
  logNav += `<button class="${b.className}">${b.innerHTML}</button>`;
}
shell("logNav"); shell("logNotes");   // checks the ids still exist
frame("notas da versão · trilho à esquerda, o que entrou à direita", "tela-log",
  `<div class="log-wrap">
    <header class="log-head">
      <div><div class="rotulo log-eyebrow">O que entrou</div>
        <h2 class="display-l">Notas da versão</h2></div>
      <button class="btn btn-fantasma ch1">Fechar</button>
    </header>
    <div class="log-body">
      <nav class="log-nav">${logNav}</nav>
      <section class="log-notes placa ch3">${shell("logNotes")}</section>
    </div>
    <div class="log-pe"><span class="rotulo dim">ESC para voltar</span>
      <span class="rotulo dim">${document.getElementById("logCount").textContent}</span></div>
  </div>`);

body += telas;

const css = src.slice(src.indexOf("<style>") + 7, src.indexOf("</style>"));
const fonts = src.slice(src.indexOf('<link rel="preconnect"'), src.indexOf("<style>"));
__write("tools/telas-preview.html", `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Telas — prévia</title>
${fonts}<style>${css}
  /* Fora do jogo a pagina rola e cada estado vira uma moldura do tamanho em
     que a tela foi desenhada (1440x810). */
  body { height: auto; overflow: auto; background: var(--obs-900); padding: 24px; }
  /* Cada estado vira uma moldura do tamanho em que a tela foi desenhada. */
  .frame {
    position: relative; width: 1600px; height: 900px; margin: 0 0 34px;
    overflow: hidden; box-shadow: inset 0 0 0 1px var(--obs-500);
  }
  .frame .screen { position: absolute; }
  /* o level up e translucido de proposito: sem o mundo atras, a moldura tem
     que fingir um fundo para a carta nao ler como cinza sobre preto */
  .frame .screen.lv { background: rgba(20,18,27,.92); }
  .cap { font-family: var(--fonte-dado); font-size: 14px; letter-spacing: .18em;
         text-transform: uppercase; color: var(--osso-300); margin-bottom: 8px; }
</style></head><body>${body}</body></html>
`);
console.log(`ok  tools/telas-preview.html — 1 de abertura + ${shots.length} de level up + ` +
            `${msShots.length} de etapa + 5 outras telas`);
