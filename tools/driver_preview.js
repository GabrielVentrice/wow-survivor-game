/* Nao mede nada: ESCREVE `tools/levelup-preview.html`, a tela de level-up
   montada com builds de verdade — as mesmas que a run produz — para revisar o
   layout sem ter que jogar ate o nivel 20.

   Vale o mesmo argumento do `sprites.html`: uma tela que so aparece por alguns
   segundos, em estados que dependem de sorteio, nao se revisa jogando. Aqui
   ela aparece em tres tamanhos de build ao mesmo tempo — 2, 6 e 11 spells —
   que e onde a densidade do painel troca e o contador de excedente aparece.

   O HTML sai do mesmo `UI.rowHtml` / `UI.buildPanelHtml` do jogo e o CSS e
   lido do proprio `index.html`: previa que diverge do jogo nao serve. */
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
   COBRA ponto — e o hover que acende o alarme no chip de orcamento, o estado
   que mais precisa de revisao. Sem nenhuma que cobre, a primeira serve. */
const pickHover = (offers, evo) => {
  if (evo >= 0) return evo;
  const pay = offers.findIndex((o) => g.ui.offerView(o).gain > 0);
  return pay >= 0 ? pay : 0;
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
  const gain = g.ui.lvViews[hoverIdx].gain;
  shots.push({
    lv: g.player.level, free: g.build.axisLeft, rows, gain,
    panel: g.ui.buildPanelHtml(hoverIdx),
    label: `${label} — ${plural(g.build.pieces.size, "spell")} · ` +
           `${plural(g.build.passives.size, "passiva")} · ${g.build.axisLeft} livres · ` +
           `hover na linha ${hoverIdx + 1}` + (gain ? ` (custa ${gain})` : " (não custa ponto)"),
  });
};

for (let r = 0; r < 300; r++) {
  const offers = g.build.getOffers(3);
  if (!offers.length) break;
  const n = g.build.pieces.size;
  const evo = offers.findIndex((o) => o.isEvo && o.evo);
  if (evo >= 0) take("evo", "evolução na mesa", offers, pickHover(offers, evo));
  else if (r === 0) take("small", "linha completa", offers, pickHover(offers, -1));
  else if (n > PANEL.slimRows) take("over", "compacta com excedente", offers, pickHover(offers, -1));
  else if (n > PANEL.fullRows) take("mid", "linha compacta", offers, pickHover(offers, -1));
  g.ui.applyOffer(offers[Math.floor(Math.random() * offers.length)]);
}

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
            <div class="lv-title">Escolha uma</div>
          </div>
          <div class="lv-budget${sh.gain ? " spend" : ""}">
            <span class="lv-budget-k">Livres</span>
            <span class="lv-budget-was">${sh.free}</span>
            <span class="lv-budget-v">${sh.free - sh.gain}</span>
            <span class="lv-budget-t">/ ${AXIS_RULES.pool} pontos de eixo</span></div>
        </div>
        <div class="lv-colhead"><span>O que é</span><span>O que muda no jogo</span><span>Custo</span></div>
        <div class="lv-rows">${sh.rows}</div>
        <div class="lv-foot">Uma escolha e a partida continua — as outras voltam ao bolo no próximo nível.</div>
      </div>
      <div class="lv-build">${sh.panel}</div>
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
console.log(`ok  tools/levelup-preview.html — ${shots.length} estados da tela`);
