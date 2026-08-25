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
//      rampa e emergente —, entao a verificacao e a SIMULACAO da conta. O marco
//      e contado em ABATES, entao "run jogavel" virou um orcamento de corpos e
//      nao um relogio, e a rampa quadratica tem que crescer a cada marco;
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
//      contabilidade;
//   8. O PACTO: a run cabe em `AXIS_RULES.maxAxes` eixos. Assim que o segundo
//      recebe o primeiro ponto, o terceiro para de receber e para de ser
//      oferecido — e a tela nao pode continuar pondo na mesa um eixo que
//      `addAxis` vai recusar, que e a mentira mais cara que ela sabe contar.

const M = BALANCE.milestones;
let problems = 0;
const bad = (m) => { problems++; console.log("X   " + m); };

/* --- 0. o dado ------------------------------------------------------------ */
if (!(M.every > 0)) bad("every ausente: a pool ficaria sem como ser gasta");
if (!(M.first > 0)) bad("first ausente: o primeiro marco sairia no abate zero");
if (!(M.ramp > 0)) {
  bad("ramp ausente: com quota fixa por marco, uma run que engata a bola de " +
      "neve esvazia a pool nos primeiros minutos");
}
if (!(M.warnAt > 0 && M.warnAt < 1)) {
  bad(`warnAt ${M.warnAt} nao e fracao do marco: em abates um limiar absoluto ` +
      "seria meio minuto de aviso no primeiro marco e nenhum no decimo");
}
{
  /* A conta tem que crescer sempre, e crescer mais a cada marco: e isso que a
     faz acompanhar a horda em vez de ser atropelada por ela. */
  const g0 = new Game();
  let ant = 0, passo = 0;
  for (let i = 0; i < 20; i++) {
    const cum = g0.milestoneKillsAt(i);
    const d = cum - ant;
    if (d <= 0) bad(`marco ${i} nao custa nada: ${ant} -> ${cum}`);
    if (i > 1 && d <= passo) bad(`marco ${i} custa ${d}, o anterior custou ${passo} — a rampa parou`);
    ant = cum; passo = d;
  }
}
if (!(M.axisPoints > M.spellPoints)) {
  bad(`axisPoints ${M.axisPoints} nao supera spellPoints ${M.spellPoints}: ` +
      "levar arsenal deixaria de custar velocidade");
}
if (M.unlockAt >= AXIS_RULES.pureAt) {
  bad(`unlockAt ${M.unlockAt} nao abre nada antes do capstone puro (${AXIS_RULES.pureAt})`);
}
if (M.cards < 2) bad("menos de duas cartas nao e escolha");

/* --- 8. o pacto, no dado e no credito ------------------------------------- */
if (!(AXIS_RULES.maxAxes >= 1 && AXIS_RULES.maxAxes < Object.keys(AXES).length)) {
  bad(`maxAxes ${AXIS_RULES.maxAxes} nao fecha nada: com um por eixo o pacto ` +
      "deixa de existir e 7/7/6 volta a ser uma build legal");
}
if (AXIS_RULES.maxAxes * AXIS_RULES.capPerAxis < AXIS_RULES.pool) {
  bad(`maxAxes ${AXIS_RULES.maxAxes} x capPerAxis ${AXIS_RULES.capPerAxis} nao ` +
      `cabe a pool de ${AXIS_RULES.pool}: a run terminaria com ponto sem onde cair`);
}
{
  /* A cobranca mora em `addAxis`, e e la que ela se mede: um eixo selado tem
     que recusar o credito venha ele de onde vier — bau, capstone ou tela. */
  const g0 = new Game();
  window.game = g0;
  g0.start(STARTER_TESTE);
  const b = g0.build;
  /* Os eixos DA RUN, e nao `Object.keys(AXES)`: a uniao tem os das duas
     classes, entao contra ela um warlock selaria "4 de 6" e o teste cobraria
     um numero que o `build.axis` dele nao tem como produzir. */
  const eixos = b.axes;
  if (b.sealedAxes().length) bad("run recem-comecada ja nasce com eixo selado");
  b.addAxis(eixos[0], 1);
  if (b.sealedAxes().length) bad("um eixo aberto ja selou o resto");
  b.addAxis(eixos[1], 1);
  const selados = b.sealedAxes();
  if (selados.length !== eixos.length - AXIS_RULES.maxAxes) {
    bad(`com ${AXIS_RULES.maxAxes} eixos abertos, ${selados.length} selados — ` +
        `esperado ${eixos.length - AXIS_RULES.maxAxes}`);
  }
  if (selados.indexOf(eixos[2]) < 0) bad("o eixo que ficou de fora nao foi selado");
  const antes = b.axis[eixos[2]], pool = b.axisTotal;
  const deu = b.addAxis(eixos[2], 5);
  if (deu !== 0 || b.axis[eixos[2]] !== antes || b.axisTotal !== pool) {
    bad(`eixo selado aceitou +${deu}: o pacto nao esta sendo cobrado no credito`);
  }
  if (b.axisRoom(eixos[2], 1)) bad("axisRoom diz que cabe ponto num eixo selado");

  /* E o pacto tem que APARECER. Ele e a unica regra do jogo que muda a mesa
     sem tirar nada da tela: o terceiro eixo so para de ser oferecido. Um eixo
     selado desenhado como "0 / 15" e a tela prometendo que ele ainda anda. */
  const blocos = g0.ui.axesHtml(null, 0).split('<div class="lv-ax');
  const bloco = blocos.find((x) => x.indexOf(AXES[eixos[2]].name) >= 0);
  if (!bloco) bad("o eixo selado sumiu do rodape em vez de aparecer marcado");
  else {
    if (bloco.indexOf("selado") < 0) {
      bad("o rodape nao marca o eixo selado — ele leria como eixo em que so nao investi");
    }
    if (bloco.indexOf("lv-ax-num") >= 0) {
      bad("o eixo selado ainda imprime `0 / 15`, que promete um crescimento que nao vem");
    }
  }
  const vivo = blocos.find((x) => x.indexOf(AXES[eixos[0]].name) >= 0);
  if (vivo && vivo.indexOf("lv-ax-num") < 0) {
    bad("o eixo ABERTO perdeu o numero junto: a marca de selado vazou para quem anda");
  }
  /* E o capstone que pede o eixo selado sai da mira: apontar para ele seria a
     tela mandando o jogador para uma porta emparedada. */
  const alvo = g0.ui.nearestCapstone();
  if (alvo && alvo.cap.req[eixos[2]]) {
    bad(`a tela ainda mira ${alvo.cap.name}, que pede o eixo selado ${eixos[2]}`);
  }
  // e o eixo ABERTO nunca sela: quem ja pagou uma perna do capstone hibrido
  // nao pode perde-la porque a outra abriu depois.
  b.addAxis(eixos[0], 9);
  if (b.axisSealed(eixos[0]) || b.axisSealed(eixos[1])) {
    bad("um eixo que ja tem ponto foi selado — o pacto so fecha o que esta em zero");
  }
}

/* --- 1..6. uma run de etapas, com o relogio do jogo ----------------------- */
// Perfil que MIRA: leva spell do eixo alvo ate ele abrir, e carta seca depois.
// E o caminho mais curto ate a pool cheia, entao e ele que responde se a
// cadencia cabe numa run.
function simular(seed, alvo, sempreSpell) {
  let z = seed >>> 0;
  Math.random = () => { z = (z * 1103515245 + 12345) % 2147483648; return z / 2147483648; };
  const g = new Game();
  window.game = g;
  g.start(STARTER_TESTE);

  let abriuEm = -1, marcos = 0, viuSolto3 = false;
  for (let i = 0; i < 60 && g.build.axisLeft > 0; i++) {
    const offers = g.build.getMilestoneOffers();
    if (!offers.length) { bad(`etapa ${i}: nenhuma carta com ${g.build.axisLeft} na pool`); break; }
    if (offers.length > M.cards) bad(`etapa ${i}: ${offers.length} cartas, teto ${M.cards}`);

    const abertos = [];
    for (const a in AXES) if (g.build.axis[a] >= M.unlockAt) abertos.push(a);

    /* 3. antes de abrir nada, nenhuma carta tem lado seco — ENQUANTO couber
          spell na build. Com o loadout cheio (`BALANCE.loadout.maxSpells`) nao
          ha mais peca para oferecer, e a etapa passa a ser so eixo: a carta
          seca aparece sem nenhum eixo aberto, que e a terceira especie
          (`dryOnly`). Ela nao pode se disfarcar de slot fixo — `locked`
          promete slot garantido em toda etapa, e esta nao promete nada. */
    const cheio = g.build.loadoutFull();
    if (!abertos.length && !cheio) {
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

    /* 8. eixo selado nao vai a mesa. A tela pergunta o ganho REAL antes de
          anunciar, entao uma carta de eixo selado seria uma carta de +0 — e
          carta de +0 nesta tela e um botao morto na unica decisao que nao se
          desfaz. */
    for (const o of offers) {
      if (g.build.axisSealed(o.axisId)) {
        bad(`etapa ${i}: carta de ${o.axisId}, que o pacto ja selou`);
      }
    }

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

    // 8. e o pacto vale depois de todo credito, venha ele de que carta vier.
    let abertos2 = 0;
    for (const a in AXES) if (g.build.axis[a] > 0) abertos2++;
    if (abertos2 > AXIS_RULES.maxAxes) {
      bad(`etapa ${i}: ${abertos2} eixos abertos, o pacto cabe ${AXIS_RULES.maxAxes}`);
    }

    marcos++;
    if (abriuEm < 0 && g.build.axis[alvo] >= M.unlockAt) abriuEm = marcos;
  }

  const fecha = g.milestoneKillsAt(marcos - 1);
  let abertos = 0;
  for (const a in AXES) if (g.build.axis[a] > 0) abertos++;
  return {
    marcos, abriuEm, fecha, viuSolto3, abertos,
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
  if (r.abertos > AXIS_RULES.maxAxes) {
    bad(`run terminou com ${r.abertos} eixos abertos: o pacto vazou`);
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
   entrega nada.

   Com marco de tempo o teto era um relogio. Com marco de ABATE ele e um numero
   de corpos, e o teto vem da medicao: uma run competente do piloto de
   `driver_balance` passa dos 15 mil abates por volta dos 10 min e dos 20 mil um
   pouco depois — que e onde ela deveria estar acabando. Este driver nao roda o
   jogo (ele so exercita a tela), entao quem re-mede a curva de abates e o
   `driver_balance`; aqui o que se cobra e que a conta CAIBA nesse orcamento. */
const ORCAMENTO = 20000;
const medFecha = mirando.map((r) => r.fecha).sort((a, b) => a - b)[Math.floor(mirando.length / 2)];
if (medFecha > ORCAMENTO) {
  bad(`quem mira so fecha a pool com ${medFecha} abates (teto ${ORCAMENTO}) — ` +
      `a ${M.every}+${M.ramp}/marco a cadencia nao cabe na run`);
}

/* --- quem so leva spell --------------------------------------------------- */
/* O outro extremo: pega spell sempre que a mesa oferecer. Ele anda
   `spellPoints` por vez, e e o unico que precisa das etapas continuarem depois
   do que seria uma tabela.

   O TETO DE SPELLS mudou o que se pode cobrar dele, e a mudanca e de desenho e
   nao de driver. Antes, largura se pagava em MARCOS: quem levava spell toda
   etapa andava de 1 em 1 e fechava a pool bem depois de quem mirava, e o driver
   cobrava a desigualdade estrita. Com `BALANCE.loadout.maxSpells` a largura
   deixou de ser cobrada e passou a ser TETADA — depois da quinta spell nao ha
   mais o que levar, e os dois perfis passam a andar de 2 em 2 no mesmo passo.
   Cobrar `>` aqui seria cobrar um preco que o jogo parou de cobrar de
   proposito.

   O que continua verdadeiro, e e o que se cobra: os dois perfis CONVERGEM, e
   convergem porque depois do teto eles jogam a mesma etapa. Divergirem muito
   voltaria a significar que largura tem preco — o preco que o teto substituiu
   —, e e por isso que o driver olha a distancia em vez de um lado so. */
const largo = simular(31, "dominion", true);
if (largo.pool !== AXIS_RULES.pool) {
  bad(`quem so leva spell nunca fecha a pool: ${largo.pool}/${AXIS_RULES.pool}`);
}
const dist = Math.abs(largo.marcos - mirando[0].marcos);
if (dist > 2) {
  bad(`o teto deveria fazer os dois perfis convergirem: largo em ${largo.marcos} ` +
      `marcos contra ${mirando[0].marcos} de quem mira`);
} else {
  console.log(`  ok os perfis convergiram: largo ${largo.marcos} marcos, ` +
              `mira ${mirando[0].marcos} — o teto substituiu o preco da largura`);
}
if (largo.spells > BALANCE.loadout.maxSpells) {
  bad(`o teto de spells nao segurou: ${largo.spells} na build, teto ${BALANCE.loadout.maxSpells}`);
} else {
  console.log(`  ok o loadout fechou em ${largo.spells}/${BALANCE.loadout.maxSpells} spells ` +
              `(${largo.marcos} marcos, contra ${mirando[0].marcos} de quem mira)`);
}

if (!viuRepetido) {
  bad("o sorteio nunca repetiu eixo numa etapa — ele deveria ver o catalogo inteiro");
}

const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(problems
  ? `X   ${problems} problemas na tela de etapa`
  : `ok  etapa validada — quem mira abre o eixo na etapa ${med(mirando.map((r) => r.abriuEm))}, ` +
    `fecha a pool em ${med(mirando.map((r) => r.marcos))} etapas (${medFecha} abates) ` +
    `com capstone em ${comCap}/${CAP_SEEDS.length} das maos e ` +
    `${med(mirando.map((r) => r.spells))} spells; ` +
    `quem so leva spell precisa de ${largo.marcos} etapas`);
if (problems) __exit(1);
