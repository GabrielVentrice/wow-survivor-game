"use strict";
/* =========================================================================
   MINIONS — demonios invocados, com IA propria.

   Um demonio nao sabe nada sobre a peca que o invocou: ele carrega um
   `payload` (lista de efeitos) que dispara ao acertar. Isso faz um efeito novo
   no registry valer automaticamente para todo demonio que o referencie.

   As IAs sao estrategias plugaveis, escolhidas por string no dado da peca —
   trocar `ai: "chase"` por `ai: "turret"` muda o comportamento sem tocar
   em codigo.
   ========================================================================= */

const MINION_AI = {
  // Orbita o player. Dano por contato, sem mira.
  orbit(m, dt, g, now) {
    m.angle += dt * (m.orbitSpeed || 1.5);
    const tx = g.player.x + Math.cos(m.angle) * m.orbitRadius;
    const ty = g.player.y + Math.sin(m.angle) * m.orbitRadius;
    const k = Math.min(1, dt * 8);
    m.x += (tx - m.x) * k; m.y += (ty - m.y) * k;
    m.facing = Math.cos(m.angle) >= 0 ? 1 : -1;
    return g.nearestEnemy(m.x, m.y, m.radius + 26);
  },

  // Persegue o inimigo mais proximo e bate de perto.
  chase(m, dt, g, now) {
    const t = g.nearestEnemy(m.x, m.y, m.range);
    if (!t) return MINION_AI._returnHome(m, dt, g);
    const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (d > m.radius + t.radius) {
      m.x += (dx / d) * m.speed * dt;
      m.y += (dy / d) * m.speed * dt;
    }
    m.facing = dx < 0 ? -1 : 1;
    return d <= m.radius + t.radius + 6 ? t : null;
  },

  // Fica colado no player e bate em quem chegar perto (Felguard).
  anchor(m, dt, g, now) {
    const ax = g.player.x + Math.cos(m.angle) * m.orbitRadius;
    const ay = g.player.y + Math.sin(m.angle) * m.orbitRadius;
    const t = g.nearestEnemy(g.player.x, g.player.y, m.range);
    let tx = ax, ty = ay;
    if (t) { tx = t.x; ty = t.y; }
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
    m.x += (dx / d) * m.speed * dt;
    m.y += (dy / d) * m.speed * dt;
    m.facing = dx < 0 ? -1 : 1;
    if (!t) return null;
    const td = Math.hypot(t.x - m.x, t.y - m.y);
    return td <= m.radius + t.radius + 8 ? t : null;
  },

  // Nao anda. Torre fixa no ponto onde foi plantada (Nether Portal, Infernal).
  turret(m, dt, g, now) {
    return g.nearestEnemy(m.x, m.y, m.range);
  },

  // Acompanha o player de longe e atira (Wild Imps).
  ranged(m, dt, g, now) {
    m.angle += dt * 0.6;
    const tx = g.player.x + Math.cos(m.angle) * m.orbitRadius;
    const ty = g.player.y + Math.sin(m.angle) * m.orbitRadius;
    const k = Math.min(1, dt * 6);
    m.x += (tx - m.x) * k; m.y += (ty - m.y) * k;
    const t = g.nearestEnemy(m.x, m.y, m.range);
    if (t) m.facing = t.x < m.x ? -1 : 1;
    return t;
  },

  // Prioriza inimigos que atiram; cai no mais proximo se nao houver (Felhunter).
  hunter(m, dt, g, now) {
    let t = g.nearestRangedEnemy(m.x, m.y, m.range);
    if (!t) t = g.nearestEnemy(m.x, m.y, m.range);
    if (!t) return MINION_AI._returnHome(m, dt, g);
    const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (d > m.radius + t.radius) {
      m.x += (dx / d) * m.speed * dt;
      m.y += (dy / d) * m.speed * dt;
    }
    m.facing = dx < 0 ? -1 : 1;
    return d <= m.radius + t.radius + 6 ? t : null;
  },

  // Volta para perto do player quando nao ha alvo — impede o demonio de
  // ficar preso do outro lado do mapa depois de limpar uma leva.
  _returnHome(m, dt, g) {
    const dx = g.player.x - m.x, dy = g.player.y - m.y, d = Math.hypot(dx, dy);
    if (d > 90) {
      m.x += (dx / d) * m.speed * dt;
      m.y += (dy / d) * m.speed * dt;
      m.facing = dx < 0 ? -1 : 1;
    }
    return null;
  },
};

class MinionSystem {
  constructor(game) {
    this.game = game;
    this.pool = new Pool(() => new Minion(), (o, ...a) => o.reset(o, ...a));
    this.byKey = new Map();   // key da peca -> quantos vivos (para triggers autonomous)
  }
  reset() { this.pool.clear(); this.byKey.clear(); }
  get active() { return this.pool.active; }

  countOf(key) { return this.byKey.get(key) || 0; }
  count() { return this.pool.active.length; }
  countBig() {
    let n = 0;
    const l = this.pool.active;
    for (let i = 0; i < l.length; i++) if (l[i].big) n++;
    return n;
  }

  /* `e` e o efeito `summon` ja resolvido. Formacao em circulo ao redor do
     ponto de invocacao para nao nascerem todos empilhados. */
  summon(e, c) {
    const g = this.game;
    const def = MINIONS[e.kind] || MINIONS.imp;
    const n = Math.max(1, Math.round(e.count || 1));
    const alive = this.countOf(c.key);
    const cap = e.cap || 99;
    const room = Math.max(0, cap - alive);
    const spawnCount = Math.min(n, room);
    if (spawnCount <= 0) return;

    const dur = (e.duration || def.duration || 10) * g.minionDurationMul;
    const expires = g.minionPermanent || e.permanent ? Infinity : c.now + dur;
    const sep = (Math.PI * 2) / spawnCount;
    const phase = Math.random() * Math.PI * 2;

    for (let i = 0; i < spawnCount; i++) {
      const a = phase + sep * i;
      const m = this.pool.spawn({
        kind: e.kind, ai: e.ai || def.ai,
        x: c.x + Math.cos(a) * 30, y: c.y + Math.sin(a) * 30,
        radius: def.radius, color: def.color,
        damage: e.damage || 0,
        attackInterval: e.attackInterval || def.attackInterval || 1,
        range: e.range || def.range || 260,
        speed: e.speed || def.speed || 190,
        orbitRadius: e.orbitRadius || def.orbitRadius || 72,
        orbitSpeed: e.orbitSpeed || def.orbitSpeed,
        angle: a,
        spawnedAt: c.now,
        expiresAt: expires,
        source: c.key,
        payload: e.onHit || null,
        projectile: e.projectile || null,
        big: !!e.big,
      });
      m.defKind = def;
      this.byKey.set(c.key, (this.byKey.get(c.key) || 0) + 1);
      g.emitVfx("summon", m.x, m.y, def.radius * 3, def.color);
      if (m.big) g.events.emit("minion_summoned", { minion: m });
    }
  }

  // Marca-e-varre: o ataque de um demonio dispara efeitos que podem invocar
  // outros demonios neste mesmo pool.
  update(dt, now) {
    const g = this.game;
    const list = this.pool.active;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const m = list[i];
      if (m.dead) continue;
      if (now >= m.expiresAt) {
        m.dead = true;
        this.byKey.set(m.source, Math.max(0, (this.byKey.get(m.source) || 1) - 1));
        g.emitVfx("unsummon", m.x, m.y, m.radius * 2.5, m.color);
        continue;
      }
      m.animTime += dt * 4;
      const ai = MINION_AI[m.ai] || MINION_AI.chase;
      const target = ai(m, dt, g, now);
      if (!target || now < m.cd) continue;
      m.cd = now + m.attackInterval;
      this._attack(m, target, now);
    }
    this.pool.sweep(DEAD);
  }

  _attack(m, target, now) {
    const g = this.game;
    const c = pushCtx(g);
    c.key = m.source; c.color = m.color; c.now = now;
    c.x = m.x; c.y = m.y; c.target = target;
    c.dirX = target.x - m.x; c.dirY = target.y - m.y;
    c.amount = m.damage;

    if (m.projectile) {
      EFFECTS.projectile(g, m.projectile, c);
    } else {
      const dealt = g.damageEnemy(target, m.damage, m.source, m.big);
      c.amount = dealt;
      g.events.emit(EVENTS.MINION_HIT, { minion: m, enemy: target, amount: dealt });
      if (m.payload) runEffects(g, m.payload, c);
    }
    popCtx(g);
  }

  // Consome o demonio mais proximo do player (Dark Pact / Grimoire).
  sacrificeOne() {
    const list = this.pool.active;
    if (!list.length) return null;
    let best = 0, bestD = Infinity;
    const p = this.game.player;
    for (let i = 0; i < list.length; i++) {
      const d = (list[i].x - p.x) ** 2 + (list[i].y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    const m = list[best];
    m.dead = true;
    this.byKey.set(m.source, Math.max(0, (this.byKey.get(m.source) || 1) - 1));
    return m;
  }
}
