"use strict";
/* =========================================================================
   DOTS — registry generico de dano ao longo do tempo.

   Substitui os 7 campos `corr*` que moravam no Enemy. Qualquer peca pode
   aplicar qualquer numero de DoTs distintos no mesmo inimigo.

   Agendamento por TIMESTAMP: cada instancia guarda `nextTick` absoluto no
   relogio de simulacao. O update so compara — nao ha trabalho por frame por
   DoT alem da comparacao, e a cadencia nao muda com fps nem com timeScale.

   Anti-recursao: o dano de um DoT entra em damageEnemy com o `key` da peca
   dona, e damageEnemy recusa reentrada da mesma key na mesma cadeia. E o que
   impede um DoT que aplica DoT de travar o browser.
   ========================================================================= */

const DEAD = (o) => o.dead;   // predicado do sweep, compartilhado entre os pools

class DotSystem {
  constructor(game) {
    this.game = game;
    this.pool = new Pool(() => new DotInstance(), (o, ...a) => o.reset(o, ...a));
  }
  reset() { this.pool.clear(); }

  get active() { return this.pool.active; }

  find(enemy, key) {
    const list = enemy.dots;
    for (let i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return null;
  }
  count(enemy) { return enemy.dots.length; }

  /* Aplica (ou reforca) um DoT. `spec` e o efeito ja resolvido:
     { key, dps, duration, tickInterval, stacking:{mode,max}, ramp, color,
       onExpire, removable, permanent } */
  apply(enemy, spec, c) {
    if (enemy.hp <= 0) return null;
    const game = this.game;
    const now = c.now;
    const key = spec.key || c.key;
    const mode = spec.stacking ? spec.stacking.mode : "refresh";
    const max = spec.stacking ? (spec.stacking.max || 1) : 1;
    // Chama Verde e afins: aceleracao global de DoT, fora do pipeline da peca
    const interval = Math.max(0.06, (spec.tickInterval || 0.5) / game.dotHaste);
    const duration = (spec.duration || 3) * game.dotDurationMul;

    let inst = this.find(enemy, key);
    if (inst && mode !== "independent") {
      if (mode === "stack" && inst.stacks < max) inst.stacks++;
      inst.endAt = now + duration;
      inst.dps = spec.dps;                       // reaplicar usa os stats atuais
      inst.tickInterval = interval;
      if (spec.onExpire) inst.onExpire = spec.onExpire;
      return inst;
    }
    if (enemy.dots.length >= 12) return null;    // teto de sanidade por inimigo

    inst = this.pool.spawn({
      key, ownerKey: c.key, enemy, now,
      dps: spec.dps, duration, tickInterval: interval,
      maxStacks: max, rampPerSec: spec.ramp || 0,
      color: spec.color || c.color,
      look: spec.look,
      removable: spec.removable, permanent: spec.permanent,
      onExpire: spec.onExpire || null,
      spreadOnContact: spec.spreadOnContact,
    });
    enemy.dots.push(inst);
    enemy.dotColor = inst.color;
    game.events.emit(EVENTS.DOT_APPLIED, { enemy, dot: inst });
    return inst;
  }

  /* Duas fases. O tick de um DoT causa dano, e dano dispara reativos que podem
     aplicar NOVOS DoTs — que entram neste mesmo pool. Remover durante a
     varredura com o laco crescendo trava o frame; entao a fase 1 so marca, e a
     fase 2 varre. `n` congela o tamanho: DoT nascido agora espera o proximo
     update em vez de ticar no mesmo instante em que foi aplicado. */
  update(now) {
    const list = this.pool.active;
    const game = this.game;
    const n = list.length;

    for (let i = 0; i < n; i++) {
      const d = list[i];
      if (!d || d.dead) continue;
      const e = d.enemy;
      if (!e || e.hp <= 0) { this._detach(d); continue; }

      if (now >= d.nextTick) {
        // Um unico tick por passagem: evita rajada apos um travamento de aba.
        d.nextTick = now + d.tickInterval;
        e.dotPulse = 1;
        game.damageEnemy(e, d.tickDamage(now), d.ownerKey, false, d.key);
        if (e.hp <= 0) { this._detach(d); continue; }
      }

      if (!d.permanent && now >= d.endAt) {
        this._expire(d, now);
        this._detach(d);
      }
    }
    this.pool.sweep(DEAD);
  }

  _expire(d, now) {
    const game = this.game;
    if (d.onExpire && d.enemy && d.enemy.hp > 0) {
      const c = pushCtx(game);
      c.key = d.ownerKey; c.color = d.color; c.now = now;
      c.target = d.enemy; c.x = d.enemy.x; c.y = d.enemy.y;
      c.dirX = game.player.dirX; c.dirY = game.player.dirY;
      c.amount = d.dps * d.duration * d.stacks;
      runEffects(game, d.onExpire, c);
      popCtx(game);
    }
    // Ceifador, Contagio e Chamador escutam isto — nenhum deles vive aqui.
    game.events.emit(EVENTS.DOT_EXPIRED, { enemy: d.enemy, dot: d, now });
  }

  _detach(d) {
    const e = d.enemy;
    if (e) {
      const i = e.dots.indexOf(d);
      if (i >= 0) e.dots.splice(i, 1);
    }
    d.enemy = null;
    d.dead = true;
  }

  // Chamado antes de devolver o inimigo ao pool: sem isto um DoT orfao
  // apontaria para um Enemy reciclado e danificaria o alvo errado.
  clear(enemy) {
    const list = enemy.dots;
    for (let i = list.length - 1; i >= 0; i--) list[i].dead = true;
    list.length = 0;
  }

  // Soma o dano restante de todos os DoTs e os remove (capstone Voraz).
  consumeAll(enemy, now) {
    let total = 0;
    const list = enemy.dots;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const remaining = Math.max(0, d.endAt - now);
      total += d.dps * d.stacks * remaining;
      d.dead = true;
    }
    list.length = 0;
    return total;
  }

  /* Copia os DoTs de um inimigo para os vizinhos. `full` = duracao cheia
     (capstone Colheita); senao a duracao restante. */
  spreadFrom(enemy, radius, full, maxTargets) {
    if (!enemy.dots.length) return 0;
    const game = this.game, now = game.clock;
    const src = enemy.dots.slice();
    let spread = 0;
    const c = pushCtx(game);
    c.now = now;
    game.grid.forRadius(enemy.x, enemy.y, radius, (o) => {
      if (o === enemy || o.hp <= 0 || o.charmed) return;
      if (maxTargets > 0 && spread >= maxTargets) return;
      const dx = o.x - enemy.x, dy = o.y - enemy.y;
      if (dx * dx + dy * dy > radius * radius) return;
      spread++;
      for (let i = 0; i < src.length; i++) {
        const d = src[i];
        c.key = d.ownerKey; c.color = d.color;
        this.apply(o, {
          key: d.key, dps: d.dps,
          duration: full ? d.duration : Math.max(0.5, d.endAt - now),
          tickInterval: d.tickInterval * game.dotHaste,   // apply reaplica a haste
          stacking: { mode: "refresh", max: d.maxStacks },
          ramp: d.rampPerSec, color: d.color, onExpire: d.onExpire,
        }, c);
      }
    });
    popCtx(game);
    if (spread) game.emitVfx("spread", enemy.x, enemy.y, radius, enemy.dotColor);
    return spread;
  }
}
