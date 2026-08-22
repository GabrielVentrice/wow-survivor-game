// Etapa: a batida lenta, e a UNICA fonte de ponto de eixo.
//
// Esta e a tela que carrega a unica decisao irreversivel da run. Level up nao
// cobra mais nada e o bau so entrega tier — se a etapa mentir sobre o quanto o
// eixo anda, ou se ela deixar de oferecer uma das duas maneiras de levar o
// eixo, o jogador perde de vez algo que nao tem como recuperar.
//
// O que este driver cobra:
//
//   1. a tabela fecha: `points` soma exatamente AXIS_RULES.pool, e `at` tem o
//      mesmo tamanho. Se ela sobrar, a promessa da pool nunca se cumpre; se
//      passar, `addAxis` come a diferenca em silencio;
//   2. os TRES eixos aparecem em toda etapa. Sortear qual eixo aparece faria do
//      capstone um acidente de novo — que e o defeito que esta separacao
//      inteira existe para consertar;
//   3. a carta SECA sempre existe. Na primeira versao ela era um fallback para
//      quando o eixo tinha ficado sem spell, e com dez pecas por eixo isso
//      nunca acontecia: medido, o pool travava em 13 de 20 e NENHUMA run
//      alcancava capstone. Escolha que o jogador nao pode fazer nao e escolha;
//   4. o numero anunciado e o numero creditado, nas duas maneiras;
//   5. arsenal custa velocidade: com spell o eixo anda `pieceDiscount` a menos;
//   6. spell de etapa nao cobra eixo duas vezes (ela entra como `free`);
//   7. e um jogador que MIRA chega ao capstone. Se nem ele chega, o climax da
//      progressao continua inalcancavel e nada disso valeu.

const M = BALANCE.milestones;
let problems = 0;
const bad = (m) => { problems++; console.log("X   " + m); };

/* --- 1. a tabela ---------------------------------------------------------- */
const soma = M.points.reduce((a, b) => a + b, 0);
if (soma !== AXIS_RULES.pool) {
  bad(`points soma ${soma}, pool e ${AXIS_RULES.pool} — sobra ou falta ponto na run`);
}
if (M.at.length !== M.points.length) {
  bad(`at tem ${M.at.length} marcos e points tem ${M.points.length}`);
}
for (let i = 1; i < M.at.length; i++) {
  if (M.at[i] <= M.at[i - 1]) bad(`marcos fora de ordem: at[${i}] = ${M.at[i]}`);
}
if (M.pieceDiscount < 1) bad("pieceDiscount 0: arsenal deixaria de custar velocidade");

/* --- 2..6. as ofertas, ao longo de uma run inteira ------------------------ */
const g = new Game();
window.game = g;
let s = 11;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
g.start();

let rodadas = 0, comSpell = 0, secas = 0, tetos = 0;

// Alterna as duas maneiras para exercitar os dois caminhos de `applyMilestone`.
for (let round = 0; round < 40 && g.build.axisLeft > 0; round++) {
  const idx = Math.min(round, M.points.length - 1);
  const offers = g.build.getMilestoneOffers(idx);
  rodadas++;

  if (offers.length !== 3) bad(`etapa ${round}: ${offers.length} cartas, esperado 3`);
  const eixos = new Set(offers.map((o) => o.axisId));
  if (eixos.size !== 3) bad(`etapa ${round}: cartas repetem eixo (${[...eixos].join(",")})`);
  for (const id in AXES) {
    if (!eixos.has(id)) bad(`etapa ${round}: eixo ${id} nao foi oferecido`);
  }

  const base = M.points[idx];
  for (const o of offers) {
    // 3. a carta seca existe SEMPRE, mesmo com o eixo esgotado de spells.
    if (!o.dry) { bad(`etapa ${round} ${o.axisId}: sem carta seca`); continue; }
    if (o.dry.want !== base) {
      bad(`etapa ${round} ${o.axisId}: carta seca pede ${o.dry.want}, tabela diz ${base}`);
    }
    // 5. arsenal custa velocidade.
    if (o.wet) {
      if (!o.piece) bad(`etapa ${round} ${o.axisId}: carta com spell sem spell`);
      else if (o.piece.axis !== o.axisId) {
        bad(`etapa ${round} ${o.axisId}: oferece spell de ${o.piece.axis}`);
      }
      const esperado = Math.max(1, base - M.pieceDiscount);
      if (o.wet.want !== esperado) {
        bad(`etapa ${round} ${o.axisId}: com spell pede ${o.wet.want}, esperado ${esperado}`);
      }
      if (o.wet.want >= o.dry.want && base > 1) {
        bad(`etapa ${round} ${o.axisId}: levar a spell nao custou nada`);
      }
    }
    // 4. o numero anunciado e o que `addAxis` vai creditar.
    const room = Math.max(0, Math.min(
      AXIS_RULES.capPerAxis - g.build.axis[o.axisId], g.build.axisLeft));
    for (const [nome, step] of [["seca", o.dry], ["com spell", o.wet]]) {
      if (!step) continue;
      const real = Math.min(step.want, room);
      if (step.gain !== real) {
        bad(`etapa ${round} ${o.axisId} (${nome}): anuncia +${step.gain}, credita +${real}`);
      }
    }
    if (!o.dry.gain) tetos++;
  }

  // A carta e o HTML tem que montar sem "undefined" nas duas maneiras.
  for (const o of offers) {
    let html;
    try { html = g.ui.msCardHtml(o); }
    catch (e) { bad(`etapa ${round} ${o.axisId}: msCardHtml explodiu — ${e.message}`); continue; }
    if (html.includes("undefined")) bad(`etapa ${round} ${o.axisId}: carta com "undefined"`);
    if (!html.includes(o.axis.name)) bad(`etapa ${round} ${o.axisId}: carta sem o nome do eixo`);
    const botoes = (html.match(/<button class="ms-take/g) || []).length;
    if (botoes !== (o.wet ? 2 : 1)) {
      bad(`etapa ${round} ${o.axisId}: ${botoes} botoes, esperado ${o.wet ? 2 : 1}`);
    }
    for (const wet of [false, true]) {
      if (wet && !o.wet) continue;
      let foot;
      try { foot = g.ui.capLineHtml(o, wet ? o.wet : o.dry); }
      catch (e) { bad(`etapa ${round}: capLineHtml explodiu — ${e.message}`); continue; }
      if (foot.includes("undefined")) bad(`etapa ${round}: rodape com "undefined"`);
    }
  }

  // 6. a spell da etapa nao pode cobrar eixo de novo em `acquirePiece`: o
  //    desconto ja foi o pagamento dela.
  const pick = offers[round % 3];
  const wet = !!pick.wet && round % 2 === 0;
  const step = wet ? pick.wet : pick.dry;
  const antes = g.build.axisTotal, antesEixo = g.build.axis[pick.axisId];
  const res = g.build.applyMilestone(pick, wet);
  const andou = g.build.axisTotal - antes;
  if (andou !== step.gain) {
    bad(`etapa ${round} ${pick.axisId}: prometeu +${step.gain}, pool andou +${andou}`);
  }
  if (g.build.axis[pick.axisId] - antesEixo !== step.gain) {
    bad(`etapa ${round} ${pick.axisId}: ponto caiu em outro eixo`);
  }
  if (wet && !res.piece) bad(`etapa ${round}: pediu a spell e nao veio`);
  if (!wet && res.piece) bad(`etapa ${round}: carta seca trouxe spell`);
  if (wet) comSpell++; else secas++;
}

if (!comSpell || !secas) bad("as duas maneiras de levar o eixo precisam ser exercitadas");

/* --- 7. quem mira, chega -------------------------------------------------- */
// Sem esta parte o resto e contabilidade: o objetivo da separacao das telas era
// tornar o capstone alcancavel de proposito. Um jogador que concentra o eixo e
// paga o preco (poucas spells) tem que fechar pelo menos um.
function runMirando(seed) {
  let z = seed >>> 0;
  Math.random = () => { z = (z * 1103515245 + 12345) % 2147483648; return z / 2147483648; };
  const h = new Game();
  window.game = h;
  h.start();
  for (let i = 0; i < BALANCE.milestones.at.length; i++) {
    if (h.build.axisLeft <= 0) break;
    const offers = h.build.getMilestoneOffers(i);
    let best = offers[0], bs = -1;
    for (const o of offers) {
      if (!o.dry.gain) continue;
      const sc = o.dry.gain * 100 + h.build.axis[o.axisId];
      if (sc > bs) { bs = sc; best = o; }
    }
    h.build.applyMilestone(best, false);
  }
  return { caps: h.build.capstones.size, axis: { ...h.build.axis }, pool: h.build.axisTotal };
}

let semCap = 0;
const amostras = [];
for (const seed of [3, 17, 101, 907, 4242]) {
  const r = runMirando(seed);
  amostras.push(r);
  if (!r.caps) {
    semCap++;
    bad(`quem mira o eixo terminou com ${r.pool}/${AXIS_RULES.pool} pontos ` +
        `(${r.axis.corruption}/${r.axis.dominion}/${r.axis.cataclysm}) e nenhum capstone`);
  }
  if (r.pool !== AXIS_RULES.pool) {
    bad(`quem mira nao gastou a pool inteira: ${r.pool}/${AXIS_RULES.pool}`);
  }
}

const capsMed = amostras.map((r) => r.caps).sort((a, b) => a - b)[Math.floor(amostras.length / 2)];
console.log(problems
  ? `X   ${problems} problemas na tela de etapa`
  : `ok  etapa validada — ${rodadas} etapas (${secas} secas, ${comSpell} com spell, ` +
    `${tetos} cartas no teto), quem mira fecha ${capsMed} capstones`);
if (problems) __exit(1);
