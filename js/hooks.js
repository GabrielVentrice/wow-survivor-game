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
    c.key = "ceifador"; c.color = "#7fdc4a"; c.now = game.clock;
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
    c.key = d.ownerKey; c.color = "#ff7a2c"; c.now = game.clock;
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
    game.emitVfx("burst", e.x, e.y, 70, "#c850ff");
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
    game.emitVfx("jump", e.x, e.y, 20, d.color);
  },

  // Eco do Vazio: golpes grandes se repetem a 40% depois de 3s. O alvo pode
  // ter morrido e voltado ao pool nesse meio tempo, entao o eco guarda a
  // POSICAO e cai como area — nunca uma referencia a um Enemy reciclado.
  voidEcho(game, p) {
    if (p.amount <= 0) return;
    const x = p.enemy.x, y = p.enemy.y, amount = p.amount * 0.4, key = p.key;
    game.schedule(3, () => {
      const c = pushCtx(game);
      c.key = key; c.color = "#a06bff"; c.now = game.clock;
      c.x = x; c.y = y; c.target = null;
      EFFECTS.damage_instant(game, { amount, radius: 70 }, c);
      popCtx(game);
      game.emitVfx("echo", x, y, 70, "#a06bff");
    });
  },

  /* --- efeitos de peca ---------------------------------------------------- */

  // Dark Pact: devora um demonio e converte em escudo.
  darkPact(game, e, c) {
    const m = game.minions.sacrificeOne();
    if (!m) return;
    game.player.addShield(e.amount || 40, e.cap);
    game.emitVfx("burst", m.x, m.y, 50, "#c850ff");
  },

  // Grimoire of Sacrifice: devora o pet permanentemente. Perde Dominio em
  // troca de escudo e dano — a evolucao que desmonta a propria build.
  grimoire(game, e, c) {
    const m = game.minions.sacrificeOne();
    if (!m) return;
    game.player.addShield(e.amount || 60, e.cap);
    game.emitVfx("burst", m.x, m.y, 80, "#ff4040");
  },

  // Soulstone: cargas de revive, repostas pela aura e consumidas sozinhas.
  soulstone(game, e, c) {
    const max = e.max || 1;
    if (game.player.reviveCharges >= max) return;
    game.player.reviveCharges++;
    game.emitVfx("heal", game.player.x, game.player.y, 40, "#c850ff");
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
    game.emitVfx("blink", p.x, p.y, 40, "#7a3cff");
    p.x += ax * d; p.y += ay * d;
    game.emitVfx("blink", p.x, p.y, 40, "#7a3cff");
  },

  // Healthstone: cura de emergencia, so quando realmente precisa.
  healthstone(game, e, c) {
    const p = game.player;
    if (p.hp / p.maxHp > (e.threshold || 0.3)) return;
    game.healPlayer(p.maxHp * (e.frac || 0.35), true);
    game.emitVfx("heal", p.x, p.y, 50, "#6fdc4a");
  },
};
