// Level-up cards: every offer renders without throwing and carries a readable
// type ribbon. This is the only screen where the player decides anything — if
// it lies about the kind of offer, the whole build becomes a coin flip.
const g = new Game();
window.game = g;
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
g.start();

let problems = 0;
const bad = (m) => { problems++; console.log("X   " + m); };

const seen = { piece: 0, path: 0, passive: 0, evo: 0 };
const TYPES = {
  piece: "card-type-piece", path: "card-type-path", passive: "card-type-passive",
};

// Buy spells and tiers until all three offer families and one evolution show up.
for (let round = 0; round < 400; round++) {
  const offers = g.build.getOffers(3);
  if (!offers.length) break;
  for (const o of offers) {
    let html;
    try { html = g.ui.cardHtml(o); }
    catch (e) { bad(`${o.kind}: cardHtml explodiu — ${e.message}`); continue; }
    seen[o.kind]++;
    if (!html.includes(TYPES[o.kind])) bad(`${o.kind}: carta sem faixa de tipo`);
    if (html.includes("undefined")) bad(`${o.kind} (${o.def && o.def.name}): carta com "undefined"`);
    if (o.kind === "path") {
      if (!html.includes(o.def.name)) bad(`path ${o.def.name}: carta nao diz qual peca melhora`);
      const on = (html.match(/<i class="on"/g) || []).length;
      if (on !== o.tierIndex) bad(`path ${o.def.name}: ${on} pips cheios, esperado ${o.tierIndex}`);
      if (o.isEvo) { seen.evo++; if (!html.includes("evolução")) bad("evolucao sem marca na faixa"); }
    }
    if (o.kind === "passive" && !html.includes("Não dispara")) {
      bad(`passiva ${o.def.name}: carta nao diz que nao dispara`);
    }
  }
  g.ui.applyOffer(offers[Math.floor(Math.random() * offers.length)]);
}

const missing = Object.entries(seen).filter(([, n]) => !n).map(([k]) => k);
if (missing.length) bad(`nenhuma oferta do tipo: ${missing.join(", ")}`);
console.log(problems ? `X   ${problems} problemas nas cartas`
  : `ok  cartas validadas — ${seen.piece} peca, ${seen.path} caminho (${seen.evo} evolucao), ${seen.passive} passiva`);
if (problems) __exit(1);
