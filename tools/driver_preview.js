/* Nao mede nada: ESCREVE `tools/levelup-preview.html`, as DUAS telas de escolha
   montadas com builds de verdade — as mesmas que a run produz — para revisar o
   layout sem ter que jogar ate o nivel 20.

   Vale o mesmo argumento do `sprites.html`: uma tela que so aparece por alguns
   segundos, em estados que dependem de sorteio, nao se revisa jogando. O level
   up aparece em tres tamanhos de build — 2, 6 e 11 spells —, que e onde a
   densidade do painel troca e o contador de excedente aparece; a etapa aparece
   cedo e tarde, que e onde os numeros dela mudam de escala.

   A etapa merece revisao ainda mais que o level up: ela e a unica decisao
   irreversivel da run, aparece so sete vezes, e as tres cartas precisam ser
   comparaveis de relance. Se os dois numeros de uma carta nao contarem a troca
   sozinhos, o jogador escolhe no escuro e nao tem como voltar.

   O HTML sai dos mesmos `UI.rowHtml` / `UI.buildPanelHtml` / `UI.msCardHtml` do
   jogo e o CSS e lido do proprio `index.html`: previa que diverge do jogo nao
   serve. */
const g = new Game();
window.game = g;
let s = 11;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
g.start();

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
  let rows = "";
  for (const v of g.ui.lvViews) {
    rows += `<div class="lv-row" style="--acc:${v.color};--acc-dim:${v.color}55;` +
            `--acc-wash:${v.color}1c">${g.ui.rowHtml(v)}</div>`;
  }
  shots.push({
    lv: g.player.level, rows,
    panel: g.ui.buildPanelHtml(hoverIdx),
    label: `${label} — ${plural(g.build.pieces.size, "spell")} · ` +
           `${plural(g.build.passives.size, "passiva")} · hover na linha ${hoverIdx + 1}`,
  });
};

/* A etapa, nos dois extremos: o primeiro marco (2 pontos, build crua, capstone
   longe) e um marco tardio (5 pontos, eixo carregado, capstone ao alcance). Sao
   os dois estados em que os numeros da carta mudam de peso. */
const msShots = [];
const takeMs = (idx, label) => {
  const offers = g.build.getMilestoneOffers(idx);
  let cards = "";
  for (const o of offers) {
    cards += `<div class="ms-card" style="--acc:${o.axis.color};--acc-dim:${o.axis.color}55;` +
             `--acc-wash:${o.axis.color}1c">${g.ui.msCardHtml(o)}</div>`;
  }
  // O rodape com previa: a carta sob o mouse e a do eixo mais investido, que e
  // onde a linha do capstone tem algo a dizer.
  let hov = offers[0];
  for (const o of offers) if (g.build.axis[o.axisId] > g.build.axis[hov.axisId]) hov = o;
  msShots.push({
    cards, label,
    eyebrow: `Etapa ${idx + 1} de ${BALANCE.milestones.at.length} · ` +
             `${mmss(BALANCE.milestones.at[idx])}`,
    pool: g.ui.axesHtml(hov.axisId, hov.dry.gain),
    cap: g.ui.capLineHtml(hov, hov.dry),
  });
};

takeMs(0, "primeiro marco — build crua, capstone longe");

for (let r = 0; r < 300; r++) {
  const offers = g.build.getOffers(3);
  if (!offers.length) break;
  // Enquanto a run corre, as etapas vao caindo — sem elas o pool fica em zero e
  // a previa tardia mostraria uma tela que o jogo nunca produz.
  if (r > 0 && r % 4 === 0 && g.build.axisLeft > 0) {
    const idx = Math.min(Math.floor(r / 4), BALANCE.milestones.points.length - 1);
    const ms = g.build.getMilestoneOffers(idx);
    // Sempre com a spell: a previa quer a build GRANDE, que e onde o painel
    // troca de densidade e o contador de excedente aparece.
    const alvo = ms.find((o) => o.wet) || ms[0];
    g.build.applyMilestone(alvo, !!alvo.wet);
  }
  const n = g.build.pieces.size;
  const evo = offers.findIndex((o) => o.isEvo && o.evo);
  if (evo >= 0) take("evo", "evolução na mesa", offers, pickHover(offers, evo));
  else if (r === 0) take("small", "linha completa", offers, pickHover(offers, -1));
  else if (n > PANEL.slimRows) take("over", "compacta com excedente", offers, pickHover(offers, -1));
  else if (n > PANEL.fullRows) take("mid", "linha compacta", offers, pickHover(offers, -1));
  g.ui.applyOffer(offers[Math.floor(Math.random() * offers.length)]);
}

takeMs(BALANCE.milestones.points.length - 1, "marco final — eixo carregado, capstone ao alcance");

let body = "";
for (const sh of shots) {
  body += `<p class="cap">${sh.label}</p>
  <div class="frame"><div class="screen lv">
    <div class="lv-glow"></div>
    <div class="lv-grid">
      <div class="lv-main">
        <div class="lv-head">
          <div class="lv-head-txt">
            <div class="lv-eyebrow">Nível ${sh.lv} → ${sh.lv + 1}</div>
            <div class="lv-title">Aprofunde uma</div>
          </div>
        </div>
        <div class="lv-colhead"><span>O que é</span><span>O que muda no jogo</span><span>Onde chega</span></div>
        <div class="lv-rows">${sh.rows}</div>
        <div class="lv-foot">Nada aqui custa ponto de eixo — isso é assunto das etapas. Uma escolha e a partida continua.</div>
      </div>
      <div class="lv-build">${sh.panel}</div>
    </div></div></div>`;
}

for (const sh of msShots) {
  body += `<p class="cap">etapa · ${sh.label}</p>
  <div class="frame"><div class="screen ms">
    <div class="lv-glow"></div>
    <div class="ms-wrap">
      <div class="ms-head-top">
        <div class="ms-eyebrow">${sh.eyebrow}</div>
        <div class="ms-title">Para onde esta run vai?</div>
        <div class="ms-sub">O único ponto que não volta. Escolha o eixo — a spell vem junto, cobrando um ponto.</div>
      </div>
      <div class="ms-rows">${sh.cards}</div>
      <div class="ms-foot">
        <div class="ms-pool">${sh.pool}</div>
        <div class="ms-capwrap">${sh.cap}</div>
      </div>
    </div></div></div>`;
}

const src = __read("index.html");
const css = src.slice(src.indexOf("<style>") + 7, src.indexOf("</style>"));
const fonts = src.slice(src.indexOf('<link rel="preconnect"'), src.indexOf("<style>"));
__write("tools/levelup-preview.html", `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Level-up — prévia</title>
${fonts}<style>${css}
  /* Fora do jogo a pagina rola e cada estado vira uma moldura do tamanho em
     que a tela foi desenhada (1440x810). */
  body { height: auto; overflow: auto; background: #08050e; padding: 24px; }
  .frame {
    position: relative; width: 1440px; height: 810px; margin: 0 0 34px;
    border-radius: 14px; overflow: hidden; border: 1px solid #2a1c3d;
  }
  .frame .screen { position: absolute; }
  .cap {
    font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em;
    text-transform: uppercase; color: #7c6f92; margin-bottom: 8px;
  }
</style></head><body>${body}</body></html>
`);
console.log(`ok  tools/levelup-preview.html — ${shots.length} de level up + ${msShots.length} de etapa`);
