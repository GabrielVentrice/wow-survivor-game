"use strict";
/* =========================================================================
   HOOKS — a escotilha de escape.

   Nem tudo cabe em dado declarativo com honestidade. Em vez de espalhar `if`
   dentro das pecas (que foi exatamente o problema do sistema de combos
   anterior), o comportamento genuinamente imperativo mora AQUI: nomeado,
   em um unico arquivo auditavel, referenciado por string a partir do dado.

   Duas formas de uso:
     - efeito:  { type: "hook", name: "darkPact" }
     - evento:  PASSIVES/CAPSTONES declaram `on: { dot_expired: "contagion" }`

   Assinatura de efeito: fn(game, eff, c)
   Assinatura de evento: fn(game, payload)
   ========================================================================= */

const HOOKS = {

  /* --- capstones --------------------------------------------------------- */

  // Colheita (Corrupcao 15): inimigo com 3+ DoTs que morre espalha TODOS os
  // DoTs aos vizinhos com duracao cheia. E o motor de bola de neve da build
  // pura de DoT — sem ele, Corrupcao nunca fecha o ciclo.
  colheita(game, p) {
    const e = p.enemy;
    if (!e || e.dots.length < 3) return;
    game.dots.spreadFrom(e, 130, true, 6);
  },

  // Ceifador (Corr 10 / Dom 5): DoT que expira NATURALMENTE invoca um imp.
  // "naturalmente" = o alvo continua vivo; morrer nao conta.
  ceifador(game, p) {
    const e = p.enemy;
    if (!e || e.hp <= 0) return;
    const c = pushCtx(game);
    c.key = "ceifador"; c.color = CAPSTONES.ceifador.color; c.now = game.clock;
    c.x = e.x; c.y = e.y; c.target = null;
    c.dirX = game.player.dirX; c.dirY = game.player.dirY;
    EFFECTS.summon(game, {
      kind: "imp", ai: "chase", count: 1, duration: 8, cap: 12,
      damage: 14, attackInterval: 1.1, range: 300,
    }, c);
    popCtx(game);
  },

  // Chamador (Cat 10 / Corr 5): Immolate empilha ate 8 e DETONA em area ao
  // expirar. O stack maximo vem do piecePatch; a detonacao vem daqui.
  chamador(game, p) {
    const d = p.dot;
    if (!d || d.key !== "immolate" || !d.enemy) return;
    const dmg = d.dps * d.stacks * 3;
    const c = pushCtx(game);
    c.key = d.ownerKey; c.color = CAPSTONES.chamador.color; c.now = game.clock;
    c.x = d.enemy.x; c.y = d.enemy.y; c.target = d.enemy;
    EFFECTS.damage_instant(game, { amount: dmg, radius: 60 + d.stacks * 8, big: true }, c);
    popCtx(game);
  },

  // Diabolista (Dom 10 / Cat 5): cada invocacao GRANDE copia o ultimo golpe
  // grande do player, no lugar onde ela nasceu.
  diabolista(game, p) {
    const m = p.minion;
    const last = game.lastBigHit;
    if (!m || !m.big || !last || last.amount <= 0) return;
    const c = pushCtx(game);
    c.key = m.source; c.color = m.color; c.now = game.clock;
    c.x = m.x; c.y = m.y; c.target = null;
    EFFECTS.damage_instant(game, { amount: last.amount, radius: 90 }, c);
    popCtx(game);
  },

  // Voraz (Corr 10 / Cat 5): um nuke consome todos os DoTs do alvo e paga o
  // dano restante de uma vez. Troca dano ao longo do tempo por dano agora.
  voraz(game, p) {
    const e = p.enemy;
    if (!e || e.hp <= 0 || !e.dots.length) return;
    const total = game.dots.consumeAll(e, game.clock);
    if (total <= 0) return;
    game.damageEnemy(e, total, p.key || "voraz", true);
    game.emitVfx("burst", e.x, e.y, 70, CAPSTONES.voraz.color);
  },

  // Enxame (Dom 10 / Corr 5): demonios aplicam os DoTs do player ao acertar.
  // Le os DoTs das pecas possuidas — nao tem lista propria, entao vale
  // automaticamente para qualquer DoT que o registry venha a inventar.
  enxame(game, p) {
    const e = p.enemy;
    if (!e || e.hp <= 0) return;
    const c = pushCtx(game);
    c.now = game.clock;
    c.x = e.x; c.y = e.y; c.target = e;
    for (const inst of game.build.pieces.values()) {
      const list = inst.r.effects;
      for (let i = 0; i < list.length; i++) {
        // a lista pode ter buracos: cada caminho de upgrade escreve num indice
        // reservado, e so os caminhos comprados preenchem os seus
        if (!list[i] || list[i].type !== "damage_over_time") continue;
        c.key = inst.key; c.color = inst.def.color;
        game.dots.apply(e, list[i], c);
      }
    }
    popCtx(game);
  },

  /* --- passivas globais --------------------------------------------------- */

  // Contagio: DoT que expira salta para o inimigo mais proximo. Duracao
  // restante, nao cheia — a versao com duracao cheia e o capstone Colheita.
  contagion(game, p) {
    const d = p.dot, e = d && d.enemy;
    if (!e) return;
    const next = game.nearestEnemyExcept(e.x, e.y, 150, e);
    if (!next) return;
    const c = pushCtx(game);
    c.key = d.ownerKey; c.color = d.color; c.now = game.clock;
    game.dots.apply(next, {
      key: d.key, dps: d.dps, duration: d.duration * 0.6,
      tickInterval: d.tickInterval * game.dotHaste,
      stacking: { mode: "refresh", max: d.maxStacks },
      ramp: d.rampPerSec, color: d.color, onExpire: d.onExpire,
    }, c);
    popCtx(game);
    // o `jump` marcava a origem e deixava o destino no escuro: quem recebeu o
    // DoT e a informacao inteira desta passiva
    game.emitVfx("jump", e.x, e.y, 20, d.color);
    game.emitVfx("link", e.x, e.y, 0, d.color, next.x, next.y);
  },

  // Eco do Vazio: golpes grandes se repetem a 40% depois de 3s. O alvo pode
  // ter morrido e voltado ao pool nesse meio tempo, entao o eco guarda a
  // POSICAO e cai como area — nunca uma referencia a um Enemy reciclado.
  voidEcho(game, p) {
    if (p.amount <= 0) return;
    const x = p.enemy.x, y = p.enemy.y, amount = p.amount * 0.4, key = p.key;
    game.schedule(3, () => {
      const c = pushCtx(game);
      c.key = key; c.color = PASSIVES.ecoDoVazio.color; c.now = game.clock;
      c.x = x; c.y = y; c.target = null;
      EFFECTS.damage_instant(game, { amount, radius: 70 }, c);
      popCtx(game);
      game.emitVfx("echo", x, y, 70, PASSIVES.ecoDoVazio.color);
    });
  },

  /* --- efeitos de peca ---------------------------------------------------- */

  // Dark Pact: devora um demonio e converte em escudo.
  darkPact(game, e, c) {
    const m = game.minions.sacrificeOne();
    if (!m) return;
    game.player.addShield(e.amount || 40, e.cap);
    game.emitVfx("burst", m.x, m.y, 50, c.color);
  },

  // Grimoire of Sacrifice: devora o pet permanentemente. Perde Dominio em
  // troca de escudo e dano — a evolucao que desmonta a propria build.
  /* O pacto: o demonio e consumido LA e o poder chega AQUI. Emitir so o
     colapso no lugar dele deixava a peca com a mesma leitura da Implosion — as
     duas devoram um demonio e devolvem escudo —, e a diferenca entre as duas e
     justamente que esta e uma transferencia, nao uma detonacao. O filamento e
     o que conta isso, e ele so existe porque a camada de vfx aprendeu a
     carregar um segundo ponto. */
  grimoire(game, e, c) {
    const m = game.minions.sacrificeOne();
    if (!m) return;
    game.player.addShield(e.amount || 60, e.cap);
    game.emitVfx("implode", m.x, m.y, 80, c.color);
    game.emitVfx("link", m.x, m.y, 0, c.color, game.player.x, game.player.y);
  },

  // Soulstone: cargas de revive, repostas pela aura e consumidas sozinhas.
  soulstone(game, e, c) {
    const max = e.max || 1;
    if (game.player.reviveCharges >= max) return;
    game.player.reviveCharges++;
    game.emitVfx("heal", game.player.x, game.player.y, 40, c.color);
  },

  // Demonic Circle: teleporta o player para fora do cerco. So dispara quando
  // ele esta REALMENTE cercado — senao viraria um blink aleatorio que tira o
  // controle de posicionamento da mao do jogador.
  blink(game, e, c) {
    const p = game.player;
    const d = e.distance || 220;
    const rad = e.checkRadius || 150;
    let sx = 0, sy = 0, n = 0;
    game.grid.forRadius(p.x, p.y, rad, (en) => {
      if (en.hp <= 0) return;
      const dx = en.x - p.x, dy = en.y - p.y;
      if (dx * dx + dy * dy > rad * rad) return;
      sx += dx; sy += dy; n++;
    });
    if (n < (e.minEnemies || 6)) return;
    let ax, ay;
    if (n) { const m = Math.hypot(sx, sy) || 1; ax = -sx / m; ay = -sy / m; }
    else { ax = p.dirX; ay = p.dirY; }
    const ox = p.x, oy = p.y;
    game.emitVfx("blink", ox, oy, 40, c.color);
    p.x += ax * d; p.y += ay * d;
    game.emitVfx("blink", p.x, p.y, 40, c.color);
    /* Os dois aneis diziam "aqui" e "ali" e nada dizia que era o MESMO
       movimento — e a fuga acontece sem o jogador pedir, entao ele acorda
       noutro lugar sem saber por onde passou. O rastro liga os dois. */
    game.emitVfx("dash", ox, oy, p.radius * 1.6, c.color, p.x, p.y);
  },

  // Healthstone: cura de emergencia, so quando realmente precisa.
  healthstone(game, e, c) {
    const p = game.player;
    if (p.hp / p.maxHp > (e.threshold || 0.3)) return;
    game.healPlayer(p.maxHp * (e.frac || 0.35), true);
    /* A pedra RACHA antes de curar. Sem isso ela e identica ao Soulstone — as
       duas curam e as duas desenham a mesma cruz —, e a diferenca e que uma
       gasta uma alma guardada e a outra quebra um objeto. */
    game.emitVfx("rip", p.x, p.y, 44, c.color);
    game.emitVfx("heal", p.x, p.y, 50, c.color);
  },

  /* --- hunter -------------------------------------------------------------
     Os tres hooks do hunter, e os tres estao aqui pela mesma razao: eles leem
     o ESTADO DA MATILHA, que e uma coisa que dado declarativo nao alcanca. O
     eixo Matilha escala com o numero de bichos vivos, e "numero de bichos
     vivos" nao e um stat — e uma consulta ao mundo, feita no instante do
     disparo. */

  /* Kill Command: dano extra por bicho vivo. O bonus e cobrado como um golpe
     separado no mesmo alvo em vez de somado ao `amount` do efeito anterior,
     porque somar exigiria que o efeito de dano soubesse contar demonios — e
     entao TODO efeito de dano carregaria essa pergunta. */
  comandoDaMatilha(game, e, c) {
    const alvo = c.target;
    if (!alvo || alvo.hp <= 0) return;
    const n = game.minions.count();
    if (n <= 0) return;
    game.damageEnemy(alvo, (e.amount || 0) * n, c.key, n >= 4);
    /* O filamento do bicho mais proximo ate o alvo. E o terceiro formato de
       distincao que o jogo tem, depois de forma e cor: a RELACAO. Sem ele o
       comando so pisca no alvo, e o jogador nao ve que foi a matilha. */
    if (e.link) {
      const m = game.minions.pool.active[0];
      if (m && !m.dead) game.emitVfx("link", m.x, m.y, 0, c.color, alvo.x, alvo.y);
    }
  },

  /* Barbed Shot e Bestial Wrath: o cheiro de sangue acelera a matilha inteira.

     A pressa e gravada NO BICHO e nao num multiplicador global porque os
     demonios nascem e morrem o tempo todo: um multiplicador global valeria
     para quem entrou depois do tiro, e a peca promete acelerar "a sua matilha",
     nao "toda matilha futura". `MinionSystem.update` devolve os valores de base
     quando o prazo vence. */
  farejarSangue(game, e, c) {
    const frac = e.frac || 0.3, until = c.now + (e.duration || 3);
    const list = game.minions.pool.active;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.dead) continue;
      m.hasteUntil = Math.max(m.hasteUntil || 0, until);
      m.hasteMul = Math.max(m.hasteMul || 1, 1 + frac);
    }
    if (list.length) game.emitVfx("shock", game.player.x, game.player.y, 120, c.color);
  },

  /* Dire Beast: "nunca se sabe qual vem" e a peca, entao o sorteio mora aqui.

     Ele NAO pode sortear no dado: `kind` e resolvido uma vez por aquisicao
     (ver o pipeline de stats), entao uma peca com `kind` sorteado teria
     sorteado uma vez na vida e chamado o mesmo bicho pela run inteira. */
  bichoDaMata(game, e, c) {
    const bichos = ["wolf", "boar", "bear", "wyvern"];
    const kind = bichos[(Math.random() * bichos.length) | 0];
    const onHit = [];
    if (e.slow) onHit.push({ type: "slow", factor: e.slow, duration: 2 });
    EFFECTS.summon(game, {
      kind: kind, ai: kind === "bear" ? "anchor" : kind === "wyvern" ? "ranged" : "flank",
      count: 1, cap: e.cap || 1,
      damage: e.damage || 100, duration: e.duration || 12,
      speed: e.speed || 300, attackInterval: e.attackInterval || 0.9,
      onHit: onHit.length ? onHit : null,
    }, c);
  },

  /* --- capstones do hunter -------------------------------------------------
     Os quatro hibridos, e cada um existe porque a promessa dele CRUZA dois
     sistemas — dado declarativo alcanca um lado de cada vez. */

  // Batedor (Mat 10 / Pre 5): todo golpe de bicho marca o alvo. O bicho nao
  // sabe nada sobre marcas e a marca nao sabe nada sobre bichos: quem cruza os
  // dois e o evento.
  batedor(game, p) {
    const e = p.enemy;
    if (!e || e.hp <= 0) return;
    e.marked = Math.max(e.marked, 0.45);
    e.markedUntil = game.clock + 5;
  },

  /* Ranger Sombria (Pre 10 / Mat 5): inimigo morto por golpe PESADO levanta
     como espectro. "Pesado" e a metade que importa — sem ela o capstone
     dispararia em toda morte da horda, que sao dezenas por segundo, e a tela
     viraria uma parede de espectros. */
  rangerSombria(game, p) {
    if (!p.big) return;
    const e = p.enemy;
    if (!e) return;
    const c = pushCtx(game);
    c.key = "rangerSombria"; c.color = CAPSTONES.rangerSombria.color;
    c.now = game.clock;
    c.x = e.x; c.y = e.y; c.target = null;
    c.dirX = game.player.dirX; c.dirY = game.player.dirY;
    EFFECTS.summon(game, {
      kind: "spectre", ai: "hunter", count: 1, cap: 12,
      damage: 240, duration: 9, attackInterval: 0.8,
    }, c);
    popCtx(game);
  },

  /* Domador (Mat 10 / Arm 5): armadilha que dispara poe a matilha em frenesi.
     O gancho e `enemy_hit` filtrado pela fonte, porque o motor nao emite um
     evento de "armadilha disparou" — e nao deveria: o unico fato observavel e
     que alguem tomou dano de uma peca com trigger `trap`. */
  domador(game, p) {
    const inst = game.build.pieces.get(p.key);
    if (!inst || inst.r.trigger.type !== "trap") return;
    const list = game.minions.pool.active;
    const until = game.clock + 4;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.dead) continue;
      m.hasteUntil = Math.max(m.hasteUntil || 0, until);
      m.hasteMul = Math.max(m.hasteMul || 1, 1.5);
    }
  },
};
