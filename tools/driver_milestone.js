// Etapa: a batida lenta, e a UNICA fonte de ponto de eixo.
//
// Esta e a tela que carrega a unica decisao irreversivel da run. Level up nao
// cobra mais nada e o bau so entrega tier — se a etapa mentir sobre o quanto o
// eixo anda, ou se ela deixar de oferecer o eixo em que o jogador ja investiu,
// ele perde de vez algo que nao tem como recuperar.
//
// O desenho tem duas fases, e a virada e `unlockAt`:
//
//   FECHADO  — nenhum eixo chegou a `unlockAt`. As tres cartas sao spells
//              sorteadas do catalogo INTEIRO, podendo repetir eixo. Nao ha
//              carta seca: ganhar eixo e escolher spell.
//   ABERTO   — um eixo chegou la. Ele passa a ter slot FIXO em toda etapa, com
//              duas maneiras de ser levado (seco por `axisPoints`, ou a spell
//              dele por `spellPoints`). Os slots restantes seguem sorteados.
//
// O que este driver cobra:
//
//   1. a conta da cadencia fecha: quem abre um eixo cedo gasta a pool inteira
//      dentro de uma run jogavel. Nao ha tabela de pontos para conferir — a
//      rampa e emergente —, entao a verificacao e a SIMULACAO da conta;
//   2. enquanto sobrar ponto, um marco ainda vem. As etapas nao acabam numa
//      contagem, acabam quando a pool acaba: `pieceDiscount` implicito (spell
//      vale menos que eixo seco) atrasa quem leva largura, e sem esta regra
//      esses pontos ficavam parados — medido, runs acabando em 12/20 e 13/20
//      com ponto aparecendo no painel que o jogo nunca entregava;
//   3. antes de abrir, nenhuma carta tem lado seco, e o sorteio ve o catalogo
//      inteiro (pode cair tres do mesmo eixo);
//   4. depois de abrir, o eixo aberto NUNCA falta. E o que separa este desenho
//      de uma loteria: o eixo em que o jogador ja se comprometeu nao pode
//      depender do sorteio para reaparecer;
//   5. o numero anunciado e o numero creditado, nos dois lados;
//   6. spell credita no eixo DELA, e nao cobra eixo duas vezes (entra `free`);
//   7. e um jogador que MIRA chega ao capstone. Sem isso o resto e
//      contabilidade.

const M = BALANCE.milestones;
let problems = 0;
const bad = (m) => { problems++; console.log("X   " + m); };

/* --- 0. o dado ------------------------------------------------------------ */
if (!(M.every > 0)) bad("every ausente: a pool ficaria sem como ser gasta");
if (!(M.axisPoints > M.spellPoints)) {
  bad(`axisPoints ${M.axisPoints} nao supera spellPoints ${M.spellPoints}: ` +
      "levar arsenal deixaria de custar velocidade");
}
if (M.unlockAt >= AXIS_RULES.pureAt) {
  bad(`unlockAt ${M.unlockAt} nao abre nada antes do capstone puro (${AXIS_RULES.pureAt})`);
}
if (M.cards < 2) bad("menos de duas cartas nao e escolha");

/* --- 1..6. uma run de etapas, com o relogio do jogo ----------------------- */
// Perfil que MIRA: leva spell do eixo alvo ate ele abrir, e carta seca depois.
// E o caminho mais curto ate a pool cheia, entao e ele que responde se a
// cadencia cabe numa run.
function simular(seed, alvo, sempreSpell) {
  let z = seed >>> 0;
  Math.random = () => { z = (z * 1103515245 + 12345) % 2147483648; return z / 2147483648; };
  const g = new Game();
  window.game = g;
  g.start();

  let abriuEm = -1, marcos = 0, viuSolto3 = false;
  for (let i = 0; i < 60 && g.build.axisLeft > 0; i++) {
    const offers = g.build.getMilestoneOffers();
    if (!offers.length) { bad(`etapa ${i}: nenhuma carta com ${g.build.axisLeft} na pool`); break; }
    if (offers.length > M.cards) bad(`etapa ${i}: ${offers.length} cartas, teto ${M.cards}`);

    const abertos = [];
    for (const a in AXES) if (g.build.axis[a] >= M.unlockAt) abertos.push(a);

    // 3. antes de abrir nada, nenhuma carta tem lado seco.
    if (!abertos.length) {
      for (const o of offers) {
        if (o.dry) bad(`etapa ${i}: carta seca com nenhum eixo em ${M.unlockAt}`);
        if (o.locked) bad(`etapa ${i}: carta fixa com nenhum eixo aberto`);
        if (!o.piece) bad(`etapa ${i}: carta sorteada sem spell`);
      }
      // o sorteio ve o catalogo inteiro: eixo repetido tem que ser possivel
      const eixos = offers.map((o) => o.axisId);
      if (new Set(eixos).size < eixos.length) viuSolto3 = true;
    }

    /* 4. todo eixo aberto tem slot fixo — a menos que ele nao ande mais. Eixo
          no teto nao tem pergunta a fazer, e oferecer "+0" nesta tela e por um
          botao morto na unica decisao que nao se desfaz. */
    for (const a of abertos) {
      const fixa = offers.find((o) => o.locked && o.axisId === a);
      const anda = Math.min(AXIS_RULES.capPerAxis - g.build.axis[a], g.build.axisLeft) > 0;
      if (!fixa) {
        if (anda) bad(`etapa ${i}: eixo aberto ${a} sumiu da mesa`);
        continue;
      }
      if (!anda) bad(`etapa ${i}: eixo ${a} no teto e ainda assim na mesa`);
      if (!fixa.dry && !fixa.wet) bad(`etapa ${i}: slot de ${a} sem maneira nenhuma`);
      if (fixa.dry && fixa.dry.want !== M.axisPoints) {
        bad(`etapa ${i}: carta seca de ${a} pede ${fixa.dry.want}, dado diz ${M.axisPoints}`);
      }
      if (fixa.wet && fixa.wet.want !== M.spellPoints) {
        bad(`etapa ${i}: spell de ${a} pede ${fixa.wet.want}, dado diz ${M.spellPoints}`);
      }
    }

    // sem peca repetida na mesma etapa: duas cartas da mesma spell nao e escolha
    const ids = offers.filter((o) => o.piece).map((o) => o.piece.id);
    if (new Set(ids).size !== ids.length) bad(`etapa ${i}: a mesma spell em duas cartas`);

    // 5. o numero anunciado e o que `addAxis` vai creditar.
    for (const o of offers) {
      for (const [nome, step] of [["seca", o.dry], ["spell", o.wet]]) {
        if (!step) continue;
        const real = Math.max(0, Math.min(step.want,
          AXIS_RULES.capPerAxis - g.build.axis[o.axisId], g.build.axisLeft));
        if (step.gain !== real) {
          bad(`etapa ${i} ${o.axisId} (${nome}): anuncia +${step.gain}, credita +${real}`);
        }
      }
      // a carta tem que montar, nas duas formas
      let html;
      try { html = g.ui.msRowHtml(o); }
      catch (e) { bad(`etapa ${i}: msRowHtml explodiu — ${e.message}`); continue; }
      if (html.includes("undefined")) bad(`etapa ${i} ${o.axisId}: carta com "undefined"`);
      const botoes = (html.match(/<button class="ms-take/g) || []).length;
      const esperado = (o.dry ? 1 : 0) + (o.wet ? 1 : 0);
      if (botoes !== esperado) bad(`etapa ${i} ${o.axisId}: ${botoes} botoes, esperado ${esperado}`);
      try { g.ui.capLineHtml(o, o.dry || o.wet); }
      catch (e) { bad(`etapa ${i}: capLineHtml explodiu — ${e.message}`); }
    }

    /* A escolha: enquanto o alvo nao abriu, leva spell dele; depois, seca —
       a menos que o perfil seja o `sempreSpell`, que e quem mais fica para
       tras e por isso e quem prova que a cauda alcanca. */
    const fixa = offers.find((o) => o.locked && o.axisId === alvo);
    let pick = null, wet = false;
    if (fixa && !sempreSpell && fixa.dry && fixa.dry.gain > 0) { pick = fixa; wet = false; }
    else if (fixa && sempreSpell && fixa.wet && fixa.wet.gain > 0) { pick = fixa; wet = true; }
    if (!pick) {
      pick = offers.find((o) => o.axisId === alvo && o.wet && o.wet.gain > 0)
          || offers.find((o) => o.dry && o.dry.gain > 0)
          || offers.find((o) => o.wet && o.wet.gain > 0);
      wet = !!(pick && (!pick.dry || (pick.wet && pick.wet.gain > 0 && !pick.dry.gain)));
      if (pick && !pick.dry) wet = true;
    }
    if (!pick) { bad(`etapa ${i}: nenhuma carta anda com ${g.build.axisLeft} na pool`); break; }

    // 6. spell credita no eixo DELA, e o pool anda exatamente o anunciado.
    const step = wet ? pick.wet : pick.dry;
    const antesPool = g.build.axisTotal, antesEixo = g.build.axis[pick.axisId];
    const res = g.build.applyMilestone(pick, wet);
    if (g.build.axisTotal - antesPool !== step.gain) {
      bad(`etapa ${i}: prometeu +${step.gain}, pool andou +${g.build.axisTotal - antesPool}`);
    }
    if (g.build.axis[pick.axisId] - antesEixo !== step.gain) {
      bad(`etapa ${i}: ponto caiu em outro eixo`);
    }
    if (wet && !res.piece) bad(`etapa ${i}: pediu a spell e nao veio`);
    if (!wet && pick.dry && res.piece) bad(`etapa ${i}: carta seca trouxe spell`);

    marcos++;
    if (abriuEm < 0 && g.build.axis[alvo] >= M.unlockAt) abriuEm = marcos;
  }

  const fecha = g.milestoneTimeAt(marcos - 1);
  return {
    marcos, abriuEm, fecha, viuSolto3,
    pool: g.build.axisTotal, caps: g.build.capstones.size,
    axis: { ...g.build.axis }, spells: g.build.pieces.size,
  };
}

/* --- quem mira ------------------------------------------------------------ */
/* Duas verificacoes com naturezas diferentes, e por isso com formas diferentes.

   A POOL fechar e mecanismo: as etapas nao param antes dela, e isso vale em
   toda seed. Uma seed que nao fecha e bug, ponto.

   O CAPSTONE e estatistico. A fase fechada obriga a levar a spell que o
   sorteio pos na mesa, entao o alvo recebe entre 14 e 16 dos 20 pontos
   conforme a sorte do baralho — e 14/4/2 erra o puro (15) e o hibrido (10+5)
   por um ponto em cada lado. Cobrar isso em cinco seeds fixas nao mede o jogo,
   mede o baralho: qualquer peca nova reembaralha o sorteio e faz uma seed
   antes verde ficar vermelha sem que nada da tela tenha mudado. Medido no
   catalogo de hoje, a taxa fica em 38/40. Entao o driver roda uma AMOSTRA e
   cobra a TAXA — mecanismo, nao sorte de seed, que e a mesma regra que o resto
   desta pasta segue. */
const CAP_SEEDS = [3, 17, 101, 907, 4242, 55, 631, 1204, 88, 7777, 12, 340,
                   2, 29, 444, 1999, 76, 5150, 313, 60];
const CAP_MIN = 0.8;
let viuRepetido = false;
const mirando = [];
let comCap = 0;
const semCap = [];
for (const seed of CAP_SEEDS) {
  const r = simular(seed, "corruption", false);
  mirando.push(r);
  viuRepetido = viuRepetido || r.viuSolto3;
  // 2. a pool sempre fecha: as etapas nao param antes dela.
  if (r.pool !== AXIS_RULES.pool) {
    bad(`quem mira nao fecha a pool: ${r.pool}/${AXIS_RULES.pool} em ${r.marcos} etapas`);
  }
  // 7. e quem mira chega ao capstone — na maioria larga das maos.
  if (r.caps) comCap++;
  else semCap.push(`${r.axis.corruption}/${r.axis.dominion}/${r.axis.cataclysm}`);
}
const taxaCap = comCap / CAP_SEEDS.length;
if (taxaCap < CAP_MIN) {
  bad(`quem mira so fecha capstone em ${comCap}/${CAP_SEEDS.length} das maos ` +
      `(piso ${Math.round(CAP_MIN * 100)}%) — sem capstone: ${semCap.join(", ")}`);
}

/* 1. a conta da cadencia. O numero que importa nao e "a pool fecha", e "a pool
   fecha ENQUANTO o jogador ainda esta vivo": marco entregue depois da morte nao
   entrega nada. Uma run competente acaba por volta dos 10-11 min. */
const medFecha = mirando.map((r) => r.fecha).sort((a, b) => a - b)[Math.floor(mirando.length / 2)];
if (medFecha > 11 * 60) {
  bad(`quem mira so fecha a pool aos ${(medFecha / 60).toFixed(1)} min — ` +
      `a ${M.every}s por marco a cadencia nao cabe na run`);
}

/* --- quem so leva spell --------------------------------------------------- */
// O outro extremo: nunca pega a carta seca. Ele anda `spellPoints` por vez, e e
// o unico que precisa das etapas continuarem depois do que seria uma tabela.
const largo = simular(31, "dominion", true);
if (largo.pool !== AXIS_RULES.pool) {
  bad(`quem so leva spell nunca fecha a pool: ${largo.pool}/${AXIS_RULES.pool}`);
}
if (largo.marcos <= mirando[0].marcos) {
  bad("levar spell deveria custar MARCOS: o largo fechou em tantos quanto o que mira");
}

if (!viuRepetido) {
  bad("o sorteio nunca repetiu eixo numa etapa — ele deveria ver o catalogo inteiro");
}

const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(problems
  ? `X   ${problems} problemas na tela de etapa`
  : `ok  etapa validada — quem mira abre o eixo na etapa ${med(mirando.map((r) => r.abriuEm))}, ` +
    `fecha a pool em ${med(mirando.map((r) => r.marcos))} etapas (${(medFecha / 60).toFixed(1)} min) ` +
    `com capstone em ${comCap}/${CAP_SEEDS.length} das maos e ` +
    `${med(mirando.map((r) => r.spells))} spells; ` +
    `quem so leva spell precisa de ${largo.marcos} etapas`);
if (problems) __exit(1);
