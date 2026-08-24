"use strict";
/* =========================================================================
   DPS — a regua da tela de level up.

   O DEFEITO QUE ELA CONSERTA. A carta mostrava em destaque o que era IGUAL
   entre as ofertas ("+40% de dano", duas vezes) e escondia em mono cinza no
   rodape o que DIFERIA — `27/s -> 38/s` contra `270 -> 378`. Duas unidades
   diferentes, e a conversao entre elas ficava por conta do jogador, 17 a 70
   vezes por run. Sem denominador comum ninguem compara: ou chuta, ou escolhe
   sempre a mesma coisa — e nos dois casos a escolha deixou de ser decisao.

   O jogo ja sabe cadencia, alvos e dano de cada peca. Ele pode fazer a conta
   que o jogador nao faz, e e isso que este arquivo e: um modelo fechado que
   responde "quanto esta peca faz por segundo" em microssegundos, dentro de uma
   tela parada.

   TRES REGRAS QUE O MANTEM HONESTO:

   1. **Ele nao le peca, le a INSTANCIA RESOLVIDA** (`inst.r`) — os mesmos
      `stats`/`trigger`/`effects` que o motor executa, com tier, passiva e
      capstone ja dentro. Nao ha uma segunda lista de numeros para divergir da
      primeira, que e o defeito que o projeto ja documenta em paleta, em voz e
      em galeria.
   2. **O campo e dado** (`BALANCE.dps`), nao numero solto aqui. Quantos corpos
      um raio pega e quanto tempo o jogador anda sao SUPOSICOES, e suposicao
      escondida no meio de um `switch` e a que ninguem revisa.
   3. **Ele promete ORDEM, nao valor.** A barra da carta e comparativa: a mais
      longa ganha mais. Quem cobra isso e o proprio `driver_bench`, no bloco
      REGUA x CAMPO: ele ja mede toda peca com o motor rodando, entao a
      comparacao mora ao lado da medida em vez de virar um segundo banco. Hoje
      o rho de Spearman entre as duas ordens e 0.75, com piso de 0.6.

   E o que ele NAO faz: nao entra no loop. Nada aqui roda por frame; quem
   chama e a tela de level up, uma vez por oferta.
   ========================================================================= */

/* Quantos corpos um efeito de raio `r` alcanca. Raio zero e alvo unico — e o
   que `effectTargets` faz quando o efeito nao declara raio.

   Cresce com a AREA e nao com o raio: dobrar o raio pega quatro vezes mais
   corpo, que e a diferenca entre uma peca de area e uma peca de alcance. E tem
   teto, porque raio de tela inteira nao pega a horda inteira — pega o que
   estava por perto quando ela saiu. */
function dpsCrowd(r, maxTargets) {
  const F = BALANCE.dps;
  if (!(r > 0)) return 1;
  const k = r / F.crowdRef;
  let n = Math.max(1, k * k * F.crowd);
  if (n > F.crowdMax) n = F.crowdMax;
  if (maxTargets > 0 && n > maxTargets) n = maxTargets;
  return n;
}

/* Ativacoes por segundo de um trigger ja resolvido.

   `orbital` e `autonomous` devolvem 0 de proposito: eles nao tem cadencia, tem
   POPULACAO — repoem ate `count` e param. Quem os mede e `dpsSummon`, que le a
   populacao em vez da taxa. Devolver 1/respawn aqui daria a um pet permanente
   a cadencia de um conjuro, que e a leitura mais errada possivel. */
function dpsRate(t, cooldownMul) {
  if (!t) return 0;
  const F = BALANCE.dps, cm = cooldownMul || 1;
  const safe = (v, d) => Math.max(0.05, (v > 0 ? v : d) * cm);
  switch (t.type) {
    case "auto_target":
      return Math.max(1, Math.round(t.targets || 1)) / safe(t.cooldown, 1);
    case "aura":        return 1 / safe(t.interval, 1);
    case "trail":       return F.moving * F.speed / Math.max(10, t.distance || 90);
    case "rooted":      return F.still / safe(t.chargeTime, 1);
    case "directional": return F.moving / safe(t.cooldown, 1);
    // Evento nao tem taxa propria: o que segura a conta e o piso anti-spam.
    case "reactive":    return Math.min(F.events, 1 / safe(t.cooldown, 0.4));

    /* --- os tres triggers do hunter que TEM cadencia ---------------------
       Sem eles a regua devolve zero, e zero na carta nao e "nao sei": e a
       barra dizendo que a peca nao faz nada. Todo o catalogo de Armadilha do
       hunter apareceria assim. */

    /* `leading` e `directional` menos a exigencia de andar — e a diferenca
       importa AQUI mais do que em qualquer outro lugar: ele cobra o chao
       para onde o jogador vai, entao a cadencia dele e cheia e nao `F.moving`.
       Foi exatamente para isso que o trigger existe. */
    case "leading":     return 1 / safe(t.cooldown, 2);

    /* A ARMADILHA e populacao, nao taxa: `charges` ficam plantadas e o
       cooldown so repoe o que disparou. A conta e quantas disparam por
       segundo, e o que a segura e a reposicao — uma armadilha parada no chao
       nao rende nada ate alguem pisar, e o regime estavel e "toda carga
       reposta acaba sendo pisada".

       `F.moving` entra porque quem pisa e a horda andando em cima de um ponto
       que o jogador escolheu e deixou para tras: cobrar cadencia cheia daria a
       uma armadilha a vazao de um tiro. */
    case "trap":        return F.moving * Math.max(1, Math.round(t.charges || 1))
                               / safe(t.cooldown, 4);

    /* O ASPECTO pulsa, mas so enquanto a postura vale — entao a cadencia dele e
       a do intervalo VEZES a fracao do tempo em que a condicao esta satisfeita.
       Essa fracao e uma suposicao, e por isso mora em `BALANCE.dps` junto das
       outras: postura sem `interval` e stance pura e nao rende nada. */
    /* A postura vale `aspectUptime` do tempo — menos quando o pulso nao e
       cobrado por ela (`whileActive: false`), e ai a cadencia e cheia. */
    case "aspect":      return t.interval
                          ? (t.whileActive === false ? 1 : F.aspectUptime) / safe(t.interval, 2)
                          : 0;

    // `pack` e populacao e nao taxa. Quem o mede e `dpsSummon`, pela populacao,
    // como ja faz com `orbital` e `autonomous`.
    default:            return 0;
  }
}

/* Populacao sustentada de demonios de uma peca, e o dano que ela faz.

   Dois regimes, e a diferenca e quem segura a conta:
     - trigger de populacao (`orbital`, `autonomous`): o proprio trigger repoe
       ate `count`, entao a populacao E `count`;
     - qualquer outro trigger: a populacao e a fila de Little — quantos nascem
       por segundo vezes quanto tempo cada um vive —, limitada pelo `cap`. */
function dpsSummon(e, t, rate, minionDurationMul, permanent) {
  const def = MINIONS[e.kind] || MINIONS.imp;
  const per = Math.max(1, Math.round(e.count || 1));
  /* `pack` entra aqui junto de `orbital` e `autonomous` porque os tres sao o
     mesmo regime: o trigger repoe ate `count` e para, entao a populacao E
     `count`. A diferenca do `pack` — nascer em leva em vez de um por vez — e
     sobre quando a matilha esta inteira em campo, nao sobre quantos sao. */
  const pop = t && (t.type === "orbital" || t.type === "autonomous" || t.type === "pack")
    ? Math.max(per, Math.round(t.count || 1))
    : Math.min(e.cap || 99, per * rate *
        (permanent || e.permanent ? 30
          : (e.duration || def.duration || 10) * (minionDurationMul || 1)));
  const hit = Math.max(0.05, e.attackInterval || def.attackInterval || 1);
  return { pop, rate: pop / hit, damage: e.damage || 0 };
}

/* O dano por segundo de uma lista de efeitos, dada a taxa em que ela e
   disparada. Recursivo porque efeito aninha efeito (`onHit`, `onTick`,
   `onExpire`, `chain`) — e a arvore aninhada e onde mora metade do dano das
   pecas de tier 5.

   `ctx` carrega o que vem de fora do efeito: os multiplicadores globais que
   passivas e capstones ligam (`dotHaste`, `dotDurationMul`) e o trigger, que o
   `summon` precisa para saber se e populacao ou fila. */
function dpsEffects(list, rate, ctx) {
  if (!list || !rate) return 0;
  const F = BALANCE.dps;
  let out = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    // A lista fica ESPARSA: cada caminho escreve em indices reservados.
    if (!e || !e.type) continue;
    // `onlyDotted` corta o alvo, nao o raio: a peca ve o mesmo circulo e so
    // cobra de quem ja carrega um DoT seu.
    const hits = dpsCrowd(e.radius, e.maxTargets) * (e.onlyDotted ? F.dotted : 1);

    switch (e.type) {
      case "damage_instant": {
        out += (e.amount || 0) * (e.mul || 1) * hits * rate;
        out += dpsEffects(e.onHit, rate * hits, ctx);
        break;
      }
      case "execute": {
        const m = 1 + ((e.executeMul || 4) - 1) * F.executeFrac;
        out += (e.amount || 0) * m * hits * rate;
        break;
      }
      case "projectile": {
        /* `pierce` e a segunda vazao da peca, e ela e a que a densidade da
           horda multiplica: um tiro que atravessa 4 mata 5. Trocar
           perfuracao por cadencia sem contar isso foi um buraco medido no
           catalogo inteiro (ver "o terceiro buraco" no CLAUDE.md). */
        const bodies = Math.max(1, Math.round(e.count || 1)) *
          (1 + Math.min(e.pierce || 0, F.crowdMax - 1));
        out += (e.damage || 0) * bodies * rate;
        out += dpsEffects(e.onHit, rate * bodies, ctx);
        break;
      }
      case "damage_over_time": {
        /* Um DoT nao rende "dano x duracao por aplicacao": ele rende o que
           esta ARDENDO por segundo, e o que decide isso e a regra de pilha.

           `refresh` (a maioria) reinicia a conta no mesmo alvo, entao ele
           satura em UM: aplicar Immolate a cada 2s num DoT de 6s nao rende o
           triplo, rende o proprio dps. `stack` empilha ate `max`, e e por isso
           que Agony — 18/s de tabela — mede 73/s em campo.

           `ramp` e o terceiro fator, e ele e o que faz a maldicao doer mais
           quanto mais o alvo demora a morrer. A janela e o intervalo entre duas
           aplicacoes: e o tempo que a conta tem para crescer antes de ser
           reiniciada. */
        const st = e.stacking;
        const stackMax = st && st.mode === "stack" ? Math.max(1, st.max || 1) : 1;
        const dur = (e.duration || 0) * (ctx.dotDurationMul || 1);
        const load = Math.min(stackMax, dur * rate);
        const janela = Math.min(dur, 1 / rate);
        const ramp = 1 + (e.ramp || 0) * janela * 0.5;
        const dps = (e.dps || 0) * (ctx.dotHaste || 1);
        out += dps * load * ramp * hits;
        out += dpsEffects(e.onTick, rate * hits, ctx);
        /* `onExpire` cobra na taxa de VENCIMENTO, nao na de aplicacao — e as
           duas divergem justamente nas pecas em que ele e o assunto. Doom
           reaplica a cada 4s uma sentenca de 8s: no mesmo alvo ela nunca vence,
           e o demonio que ela prometia nunca nasce. Uma aplicacao vence no
           maximo uma vez por duracao. */
        out += dpsEffects(e.onExpire, Math.min(rate, dur > 0 ? 1 / dur : rate) * hits, ctx);
        break;
      }
      case "area_persistent": {
        /* Zona nao tem teto de reaplicacao: duas pocas no chao ticam as duas.
           A conta e de fila — quantas estao vivas ao mesmo tempo. */
        const n = Math.max(1, Math.round(e.count || 1));
        const live = n * (e.duration || 3) * rate;
        out += live * (e.dps || 0) * hits;
        out += dpsEffects(e.onTick, live * hits / Math.max(0.05, e.tickInterval || 0.35), ctx);
        /* `onEnd` cobra na taxa em que as zonas ACABAM, que em regime estavel e
           a mesma em que elas nascem. Sem ele a regua enxergava zero em toda
           armadilha do hunter: a armadilha e uma zona ARMADA cujo payload
           inteiro mora no `onEnd`, entao o que ela faz era exatamente o que a
           conta nao olhava. Medido: regua 0 contra 405 de campo no Tar Trap. */
        out += dpsEffects(e.onEnd, rate * n, ctx);
        break;
      }
      case "summon": {
        const s = dpsSummon(e, ctx.trigger, rate, ctx.minionDurationMul, ctx.minionPermanent);
        out += s.damage * s.rate;
        out += dpsEffects(e.onHit, s.rate, ctx);
        break;
      }
      case "chain": {
        // O salto cobra o falloff sobre o que a peca ja fez neste acerto.
        out += dpsEffects(e.effects, rate * (e.falloff || 0.6), ctx);
        break;
      }
      /* Cura, escudo, controle, empurrao, invocacao de estado e hook nao
         entram: a regua mede DANO. Peca que so faz isso aparece com ganho
         zero, e a carta diz isso com palavra em vez de fingir um numero. */
      default: break;
    }
  }
  return out;
}

/* O multiplicador dinamico medio da build. Furia Contida e Pes de Cinza nao
   podem ser cozinhadas no cache de resolucao (variam por segundo parado ou
   andando), entao elas vivem num segundo canal aplicado no momento do dano —
   e aqui elas precisam do mesmo tratamento, senao a carta delas diria "nao
   muda o dano" sobre uma passiva cujo texto e literalmente "+2% de dano". */
function dpsDynamic(passives) {
  const F = BALANCE.dps;
  let mul = 1;
  for (const id of passives.keys()) {
    const d = PASSIVES[id].dynamic;
    if (!d) continue;
    const frac = d.on === "still" ? F.still : F.moving;
    mul *= 1 + Math.min(d.cap || 1, F.streak * d.perSec) * frac;
  }
  return mul;
}

/* O numero que a carta imprime. `r` e `inst.r` — a instancia JA RESOLVIDA. */
function pieceDps(r, game) {
  if (!r || !r.trigger) return 0;
  const rate = dpsRate(r.trigger, game ? game.cooldownMul : 1);
  const ctx = {
    trigger: r.trigger,
    dotHaste: game ? game.dotHaste : 1,
    dotDurationMul: game ? game.dotDurationMul : 1,
    minionDurationMul: game ? game.minionDurationMul : 1,
    minionPermanent: game ? game.minionPermanent : false,
  };
  /* Trigger de populacao nao tem taxa, mas os efeitos dele precisam de uma
     para atravessar a arvore. A taxa de reposicao serve: quem le populacao e
     `dpsSummon`, e ele ignora este numero. */
  const walk = rate > 0 ? rate : 1 / Math.max(0.05, r.trigger.respawn || r.trigger.interval || 4);
  let out = dpsEffects(r.effects, walk, ctx);

  /* O critico e stat da peca e mora no funil (`Game.damageEnemy`), entao ele
     multiplica TODO caminho de dano de uma vez — que e exatamente por que ele
     entra aqui no fim, e nao dentro de cada efeito. Sem isso a linha de
     Critico seria a unica das tres que a regua nao enxerga. */
  const c = r.stats || {};
  if (c.crit > 0) out *= 1 + c.crit * ((c.critMul || 2) - 1);
  return out;
}
