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

// Ponto de formacao reaproveitado por _slot: alocar por frame aqui seria lixo
// a 60fps com uma duzia de demonios em campo.
const MINION_SLOT = { x: 0, y: 0 };

const MINION_AI = {
  // Orbita o player. Dano por contato, sem mira.
  // O Voidwalker e escudo giratorio de propriedade: o giro E a peca (trigger
  // `orbital`, caminho "Orbita", tier de velocidade de giro). Ele e o unico
  // que ainda roda em volta — todo demonio com passo proprio segue o jogador.
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

  // Anda junto do player e investe em quem chegar perto DELE (Felguard).
  anchor(m, dt, g, now) {
    const t = g.nearestEnemy(g.player.x, g.player.y, m.range);
    if (!t) { MINION_AI._follow(m, dt, g, m.orbitRadius); return null; }
    const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1;
    m.x += (dx / d) * m.speed * dt;
    m.y += (dy / d) * m.speed * dt;
    m.facing = dx < 0 ? -1 : 1;
    const td = Math.hypot(t.x - m.x, t.y - m.y);
    return td <= m.radius + t.radius + 8 ? t : null;
  },

  // Nao anda. Torre fixa no ponto onde foi plantada (Nether Portal, Infernal).
  turret(m, dt, g, now) {
    return g.nearestEnemy(m.x, m.y, m.range);
  },

  // Acompanha o player e atira de onde estiver (Wild Imps).
  ranged(m, dt, g, now) {
    MINION_AI._follow(m, dt, g, m.orbitRadius);
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

  /* FLANCO: cerca o alvo em vez de andar em linha reta ate ele.

     `chase` leva todo bicho pelo mesmo caminho — a linha entre ele e o
     inimigo mais proximo. Com cinco bichos isso empilha os cinco no mesmo
     ponto do mesmo lado, e a matilha lê como um bicho grande e borrado. O que
     faz cinco bichos parecerem uma matilha e eles chegarem por lados
     DIFERENTES.

     O ponto de aproximacao e o alvo deslocado pelo slot do bicho (`m.angle`,
     congelado no spawn pelo trigger `pack`), e o deslocamento MORRE conforme
     ele chega: longe, ele corre para o flanco dele; perto, ele fecha no corpo.
     Sem essa morte o bicho orbitaria o inimigo sem nunca encostar, que e o
     defeito que tirou a orbita de todo demonio com passo proprio.

     `_arc` e o raio do cerco, e ele sai do proprio alvo (`t.radius`) e nao de
     um numero de tabela: cercar um ghoul e cercar um chefe sao distancias
     diferentes, e um valor fixo faria a matilha cercar o chefe por dentro. */
  flank(m, dt, g, now) {
    const t = g.nearestEnemy(m.x, m.y, m.range);
    if (!t) return MINION_AI._returnHome(m, dt, g);
    const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1;
    const toque = m.radius + t.radius;
    const arc = toque + 18;
    // 1 quando esta longe, 0 quando ja esta no corpo: o cerco vira ataque.
    const espalha = Math.min(1, Math.max(0, (d - toque) / (arc * 2.2)));
    const ax = t.x + Math.cos(m.angle) * arc * espalha;
    const ay = t.y + Math.sin(m.angle) * arc * espalha;
    const ex = ax - m.x, ey = ay - m.y, ed = Math.hypot(ex, ey) || 1;
    if (d > toque) {
      m.x += (ex / ed) * m.speed * dt;
      m.y += (ey / ed) * m.speed * dt;
    }
    m.facing = dx < 0 ? -1 : 1;
    return d <= toque + 6 ? t : null;
  },

  /* Formation slot: a point BEHIND the player, opposite to the direction they
     last moved in. `m.angle` is frozen at spawn and used as the slot id — it
     fans the pack sideways and staggers its depth so a dozen demons do not
     collapse into one pixel. It is never advanced by time: an angle that grows
     is what makes a pet circle instead of follow.

     Writes into a shared scratch point — this runs once per demon per sub-step
     and a fresh object here would be garbage at 60fps. */
  _slot(m, g, dist) {
    const p = g.player;
    let bx = -(p.dirX || 0), by = -(p.dirY || 0);
    const bl = Math.hypot(bx, by);
    if (bl < 0.001) { bx = -1; by = 0; } else { bx /= bl; by /= bl; }
    const a = Math.sin(m.angle) * 0.85;
    const ca = Math.cos(a), sa = Math.sin(a);
    const r = dist * (0.8 + 0.2 * (1 + Math.cos(m.angle)));
    MINION_SLOT.x = p.x + (bx * ca - by * sa) * r;
    MINION_SLOT.y = p.y + (bx * sa + by * ca) * r;
    return MINION_SLOT;
  },

  /* Walks to that slot at the demon's own speed, with a dead zone so it stops
     instead of vibrating on top of the point. Falling behind speeds it up: the
     player outruns most demons the moment a speed buff lands, and a pet that
     cannot catch up is a pet that left the screen. */
  _follow(m, dt, g, dist) {
    const s = MINION_AI._slot(m, g, dist || 72);
    const dx = s.x - m.x, dy = s.y - m.y, d = Math.hypot(dx, dy);
    const slack = m.radius + 8;
    if (d <= slack) return;
    const sp = m.speed * Math.min(2.2, 0.6 + d / 160);
    const step = Math.min(d - slack, sp * dt);
    m.x += (dx / d) * step;
    m.y += (dy / d) * step;
    m.facing = dx < 0 ? -1 : 1;
  },

  // Volta para o lado do player quando nao ha alvo — impede o demonio de
  // ficar preso do outro lado do mapa depois de limpar uma leva.
  _returnHome(m, dt, g) {
    MINION_AI._follow(m, dt, g, m.orbitRadius);
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
      /* `c.slot` e a posicao no leque, mandada por quem invocou. Sorteando, a
         formacao de `MINION_AI.flank` perde o sentido: `m.angle` E a identidade
         de posicao, e dois bichos com o mesmo angulo cercam o alvo pelo mesmo
         lado. Quem sabe repartir o leque e o trigger, porque so ele sabe
         quantos vao existir — o `summon` so ve a leva de agora. */
      const a = c.slot != null ? c.slot + sep * i : phase + sep * i;
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
      // O frenesi vence: devolve passo e cadencia de base. Um `if` por demonio
      // por sub-step, contra um multiplicador global que valeria para bicho que
      // nem estava em campo quando o tiro saiu.
      if (m.hasteUntil && now >= m.hasteUntil) {
        m.hasteUntil = 0;
        m.speed = m.baseSpeed;
        m.attackInterval = m.baseAttack;
      }
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
