"use strict";
/* =========================================================================
   GAME — estado global, loop, maquina de estados e o funil de dano.
   Nao conhece peca nenhuma: quem sabe o que a run "e" e o BuildSystem, e quem
   sabe o que uma peca faz e o registry. Aqui so mora a simulacao.
   ========================================================================= */

const STATE = {
  MENU: "menu", PLAYING: "playing", LEVELUP: "levelup",
  GAMEOVER: "gameover", PAUSED: "paused", CHEST: "chest",
};

const MAX_FX_DEPTH = 8;   // teto de aninhamento de efeitos (backstop anti-loop)

class Game {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.dpr = Math.min(devicePixelRatio || 1, 2);

    buildSprites();
    this.input = new InputManager();
    this.camera = new Camera();
    this.camera.pattern = this.ctx.createPattern(makeGroundTile(), "repeat");
    this.player = new Player();

    this.enemies = new Pool(() => new Enemy(), (o, ...a) => o.reset(o, ...a));
    this.projectiles = new Pool(() => new Projectile(), (o, ...a) => o.reset(o, ...a));
    this.orbs = new Pool(() => new XPOrb(), (o, ...a) => o.reset(o, ...a));
    this.areas = new Pool(() => new AreaEffect(), (o, ...a) => o.reset(o, ...a));
    this.particles = new Pool(() => new Particle(), (o, ...a) => o.reset(o, ...a));
    this.pickups = new Pool(() => new Pickup(), (o, ...a) => o.reset(o, ...a));

    this.spawner = new SpawnManager();
    this.lastBossChestAt = -BALANCE.spawn.bossChestCooldown;
    this.sfx = new Sfx();
    this.grid = new SpatialGrid(48);
    this.events = new EventBus();
    this.vfxLayer = new VfxLayer();

    this.dots = new DotSystem(this);
    this.minions = new MinionSystem(this);
    this.build = new BuildSystem(this);

    // --- buffers reaproveitados: nada disso pode alocar por frame
    this._fxStack = [];
    this._fxDepth = 0;
    this._fxTargets = [];         // um buffer de alvos por profundidade
    this._nearD = []; this._nearE = [];
    this._chain = new Set();      // keys na cadeia de dano atual (anti-recursao)
    this.timers = [];             // efeitos agendados (Eco do Vazio)
    this.damageBy = new Map();    // key -> dano acumulado (medidor)

    // multiplicadores de jogo inteiro, escritos por BuildSystem.applyGlobals
    this.dotHaste = 1; this.dotDurationMul = 1;
    this.minionDurationMul = 1; this.minionPermanent = false;
    this.shieldPerMinion = 0; this.areaLifesteal = 0;
    this.cooldownMul = 1; this.noExternalHeal = false; this.bigHitCrit = false;
    this.dynDamage = 1;
    this.lastBigHit = null;

    this.state = STATE.MENU;
    this.selectedClass = "warlock";
    this.selectedSpeed = 1;
    this.timeScale = 1;
    this.elapsed = 0;
    this.clock = 0;         // relogio de simulacao: base de TODO agendamento
    this.lastTime = 0;
    this._dmgTimer = 0;

    this.ui = new UI(this);
    this._loop = this._loop.bind(this);
    addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "m") this.sfx.muted = !this.sfx.muted;
      if (e.key === "Escape") this.togglePause();
    });
    addEventListener("resize", () => this.resize());
    this.resize();
    this.ui.buildMenu();
    requestAnimationFrame(this._loop);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.camera.resize(w, h);
  }

  /* --- consultas espaciais ------------------------------------------------
     Todas passam pelo grid. A varredura linear que existia antes rodava por
     projetil teleguiado por frame e nao aguentaria o catalogo novo. */

  nearestEnemy(x, y, maxDist) {
    return this.grid.nearest(x, y, maxDist || 4000, null, null);
  }
  nearestEnemyExcept(x, y, maxDist, exclude) {
    return this.grid.nearest(x, y, maxDist || 4000, exclude, null);
  }
  nearestRangedEnemy(x, y, maxDist) {
    return this.grid.nearest(x, y, maxDist || 4000, null, (e) => !!e.type.ranged);
  }
  /* Ate `count` inimigos mais proximos. Insercao ordenada num par de buffers
     reaproveitados: nunca ordena a horda inteira e nunca aloca. */
  nearestEnemies(x, y, maxDist, count) {
    const ds = this._nearD, es = this._nearE;
    ds.length = 0; es.length = 0;
    const md2 = maxDist * maxDist;
    this.grid.forRadius(x, y, maxDist, (e) => {
      if (e.hp <= 0 || e.charmed) return;
      const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
      if (d2 > md2) return;
      if (ds.length >= count && d2 >= ds[ds.length - 1]) return;
      let i = Math.min(ds.length, count - 1);
      while (i > 0 && ds[i - 1] > d2) { ds[i] = ds[i - 1]; es[i] = es[i - 1]; i--; }
      ds[i] = d2; es[i] = e;
      if (ds.length > count) { ds.length = count; es.length = count; }
    });
    return es;
  }

  /* --- servicos usados pelos efeitos -------------------------------------- */

  emitVfx(kind, x, y, r, color) { this.vfxLayer.emit(kind, x, y, r, color); }

  schedule(delay, fn) { this.timers.push({ at: this.clock + delay, fn }); }

  healPlayer(amount, force) {
    if (amount <= 0) return;
    if (this.noExternalHeal && !force) return;   // custo do capstone Tirania
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + amount);
  }

  // Desmancha projeteis hostis num raio (Nether Ward).
  reflectProjectiles(x, y, radius, damage, blastRadius, c) {
    const list = this.projectiles.active;
    const r2 = radius * radius;
    let hit = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.hostile || p.dead) continue;
      const dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy > r2) continue;
      p.dead = true;
      hit++;
      if (damage > 0) {
        const n = pushCtx(this);
        n.key = c.key; n.color = "#5acfff"; n.now = c.now;
        n.x = p.x; n.y = p.y; n.target = null;
        EFFECTS.damage_instant(this, { amount: damage, radius: blastRadius || 60 }, n);
        popCtx(this);
      }
    }
    if (hit) this.emitVfx("shock", x, y, radius, "#5acfff");
  }

  /* Converte um inimigo em aliado: ele sai do pool de inimigos e volta como
     demonio. Mais simples e mais barato que ensinar o Enemy a lutar contra os
     proprios — e o resultado em tela e o mesmo. */
  convertEnemy(e, duration, c) {
    if (!e || e.hp <= 0 || e.type.boss) return;
    e.charmed = true;
    e.hp = 0;                                  // sera colhido por killDeadEnemies
    e.noReward = true;
    const kind = e.radius > 20 ? "felguard" : e.radius > 13 ? "dreadstalker" : "imp";
    const n = pushCtx(this);
    n.key = c.key; n.color = "#ff8a3c"; n.now = c.now;
    n.x = e.x; n.y = e.y; n.target = null;
    EFFECTS.summon(this, {
      kind, ai: "chase", count: 1, cap: 24, duration,
      damage: Math.max(12, e.touchDps * 2.5), attackInterval: 0.8, range: 400,
      big: e.radius > 20,
    }, n);
    popCtx(this);
    this.emitVfx("summon", e.x, e.y, 40, "#ff8a3c");
  }

  /* --- o funil de dano ----------------------------------------------------
     TODO dano em inimigo passa por aqui. `key` e a identidade estavel da peca:
     chave do medidor, guarda anti-recursao e origem dos eventos.

     A guarda: enquanto os eventos de um acerto estao sendo despachados, a key
     fica em `_chain`, e um trigger reativo daquela mesma key nao dispara. E a
     generalizacao do antigo `source !== "corruption"` — sem ela, um DoT que
     aplica DoT trava o browser. */
  damageEnemy(e, amount, key, big, dotKey) {
    if (!e || e.hp <= 0 || amount <= 0) return 0;

    let amt = amount * this.dynDamage;
    if (e.marked && this.clock < e.markedUntil) amt *= 1 + e.marked;
    if (big && this.bigHitCrit) amt *= 2;      // capstone Nihilam

    e.hp -= amt;
    e.hitFlash = 0.1;
    if (key) this.damageBy.set(key, (this.damageBy.get(key) || 0) + amt);

    if (this.areaLifesteal > 0 && !dotKey) this.healPlayer(amt * this.areaLifesteal);

    const reenter = key && this._chain.has(key);
    if (!reenter && key) this._chain.add(key);

    if (big) {
      this.lastBigHit = { amount: amt, key };
      this.events.emit(EVENTS.BIG_HIT, { enemy: e, amount: amt, key });
    }
    this.events.emit(EVENTS.ENEMY_HIT, { enemy: e, amount: amt, key });
    if (e.hp > 0 && e.hp / e.maxHp <= 0.2) {
      this.events.emit(EVENTS.ENEMY_LOW, { enemy: e, pct: e.hp / e.maxHp });
    }

    if (!reenter && key) this._chain.delete(key);
    return amt;
  }

  damagePlayer(amount, source) {
    const p = this.player;
    const dealt = p.takeDamage(amount);
    if (dealt > 0) this.events.emit(EVENTS.PLAYER_DAMAGED, { amount: dealt, source });
    return dealt;
  }

  /* --- ciclo de vida ------------------------------------------------------ */

  start() {
    const cls = CLASSES[this.selectedClass];
    this.player.reset(cls);
    this.enemies.clear(); this.projectiles.clear(); this.orbs.clear();
    this.areas.clear(); this.particles.clear(); this.pickups.clear();
    this.dots.reset(); this.minions.reset(); this.vfxLayer.reset();
    this.events.clear();
    this.spawner.reset();
    this.timers.length = 0;
    this.damageBy.clear();
    this._chain.clear();
    this._fxDepth = 0;
    this.lastBigHit = null;
    this.build.reset();
    this.elapsed = 0;
    this.clock = 0;
    this.lastBossChestAt = -BALANCE.spawn.bossChestCooldown;
    this.timeScale = this.selectedSpeed;
    this.camera.x = 0; this.camera.y = 0;
    this.camera.follow(this.player, 1, true);

    for (const id of cls.starting) this.build.acquirePiece(id, true);
    this.build.afterChange();

    this.sfx.init();
    this.state = STATE.PLAYING;
    this.ui.onStart();
  }

  gameOver() {
    // Soulstone: uma carga levanta o player em vez de encerrar a run.
    if (this.player.reviveCharges > 0) {
      this.player.reviveCharges--;
      this.player.hp = this.player.maxHp * 0.55;
      this.player.addShield(80);
      this.addShake(20);
      this.emitVfx("heal", this.player.x, this.player.y, 90, "#c850ff");
      this.sfx.levelUp();
      this.ui.toast({ head: "Soulstone!", color: "#c850ff", icon: "🔮",
        name: "Você voltou", desc: "Uma alma guardada pagou o preço no seu lugar." });
      return;
    }
    this.state = STATE.GAMEOVER;
    this.sfx.gameOver();
    this.ui.onGameOver();
  }

  togglePause() {
    if (this.state === STATE.PLAYING) { this.state = STATE.PAUSED; this.ui.onPause(); }
    else if (this.state === STATE.PAUSED) this.resume();
  }
  resume() { this.ui.hidePause(); this.state = STATE.PLAYING; }
  quitToMenu() { this.ui.toMenu(); this.state = STATE.MENU; }

  addShake(mag) { this.camera.shake = Math.max(this.camera.shake, mag); }

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        0.3 + Math.random() * 0.3, color, 2 + Math.random() * 2.5);
    }
  }

  onBossSpawn(count = 1) {
    this.addShake(10 + (count - 1) * 4);
    this.sfx.boss();
    this.ui.toast({ head: "Chefe!", color: "#b23cff", icon: "☠",
      name: count > 1 ? `${count} Dreadlords!` : "Dreadlord!",
      desc: count > 1
        ? "Os nathrezim cercaram você pela Distorção Profana."
        : "Um nathrezim emergiu da Distorção Profana." });
  }

  onHardPhase() {
    this.addShake(14);
    this.sfx.boss();
    this.ui.toast({ head: "A Distorção rasgou!", color: "#ff3b6b", icon: "🔥",
      name: "A Legião avança",
      desc: "A horda fica mais rápida, mais densa e mais letal a cada 15s." });
  }

  /* --- loop ---------------------------------------------------------------
     dt real -> clamp -> timeScale -> passos de no maximo 0.025s.
     update(dt) roda VARIAS vezes por frame; por isso todo agendamento usa
     `this.clock` e nunca contagem de frames. */
  _loop(now) {
    requestAnimationFrame(this._loop);
    if (!this.lastTime) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    let total = dt * this.timeScale;
    while (total > 0) {
      const step = Math.min(0.025, total);
      this.update(step);
      total -= step;
    }
    this.vfxLayer.update(dt * this.timeScale);
    this.render();
  }

  update(dt) {
    if (this.state !== STATE.PLAYING) return;
    this.elapsed += dt;
    this.clock += dt;

    this.player.update(dt, this.input);
    this.applyPassives(dt);
    this.build.updateDynamic();

    this.spawner.update(dt, this);
    this.updateEnemies(dt);          // move + preenche o grid + contato
    this.minions.update(dt, this.clock);
    this.build.tick(dt, this.clock); // triggers de todas as pecas
    this.dots.update(this.clock);    // scheduler por timestamp
    this.updateProjectiles(dt);
    this.updateAreas(dt);
    this.runTimers();
    this.killDeadEnemies();
    this.updateOrbs(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);

    this.camera.follow(this.player, dt);
    this.camera.updateShake(dt);
    this.ui.updateHUD();
    this._dmgTimer -= dt;
    if (this._dmgTimer <= 0) { this._dmgTimer = 0.25; this.ui.updateDamageMeter(); }

    if (this.player.hp <= 0) { this.gameOver(); return; }
    if (this.player.pendingLevels > 0) this.ui.openLevelUp();
  }

  runTimers() {
    const t = this.timers;
    for (let i = 0; i < t.length; i++) {
      if (this.clock < t[i].at) continue;
      const fn = t[i].fn;
      t[i] = t[t.length - 1];
      t.pop(); i--;
      fn();
    }
  }

  applyPassives(dt) {
    const p = this.player;
    let speed = p.baseSpeed;
    if (this.clock < (p.speedBoostUntil || 0)) speed *= p.speedBoost;
    p.speed = speed;
    p.pickupRange = p.basePickup;

    // Vinculo de Alma: teto de escudo cresce com o exercito em campo
    if (this.shieldPerMinion > 0) {
      const cap = p.maxHp * this.shieldPerMinion * this.minions.count();
      p.maxShield = Math.max(p.maxShield, cap);
      if (cap > 0) p.shield = Math.min(Math.max(p.shield, 0) + cap * dt * 0.5, cap);
    }
  }

  updateEnemies(dt) {
    const list = this.enemies.active;
    const p = this.player;
    const now = this.clock;
    this.grid.clear();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      e.update(dt, p, now);
      this.grid.insert(e);

      if (now < e.stunUntil) continue;

      const dx = p.x - e.x, dy = p.y - e.y;
      const rr = p.radius + e.radius;
      if (dx * dx + dy * dy < rr * rr) {
        let touch = e.touchDps;
        if (now < (e.weakUntil || 0)) touch *= e.weakFactor;
        this.damagePlayer(touch * dt, "touch");
      }

      if (e.type.ranged) {
        e.shootTimer -= dt;
        const t = e.type;
        if (e.shootTimer <= 0 && dx * dx + dy * dy < t.shootRange * t.shootRange) {
          e.shootTimer = t.shootInterval * (now < (e.weakUntil || 0) ? 1 / e.weakFactor : 1);
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          this.projectiles.spawn({
            x: e.x, y: e.y,
            vx: Math.cos(a) * t.shootSpeed, vy: Math.sin(a) * t.shootSpeed,
            damage: e.shootDamage, radius: 7, color: "#ff4db8",
            source: "enemy", life: 3, pierce: 0, hostile: true,
          });
        }
      }
    }
    this.separateEnemies();
  }

  // separação leve reaproveitando o grid já populado — sem O(n²)
  separateEnemies() {
    const list = this.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      this.grid.forNear(e.x, e.y, (o) => {
        if (o === e) return;
        let dx = e.x - o.x, dy = e.y - o.y;
        const minD = e.radius + o.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.5;
          dx /= d; dy /= d;
          e.x += dx * push; e.y += dy * push;
          o.x -= dx * push; o.y -= dy * push;
        }
      });
    }
  }

  /* Marca-e-varre, como os DoTs: o impacto de um projetil pode disparar um
     reativo que cria OUTRO projetil neste mesmo pool. `n` congela o tamanho
     para que o recem-nascido nao ande no frame em que foi criado. */
  updateProjectiles(dt) {
    const list = this.projectiles.active;
    const pl = this.player;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const p = list[i];
      if (p.dead) continue;

      if (p.homing) {
        const target = this.nearestEnemy(p.x, p.y, 900);
        if (target) {
          const desired = Math.atan2(target.y - p.y, target.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-p.turnRate * dt, Math.min(p.turnRate * dt, diff));
          const a = cur + turn;
          p.vx = Math.cos(a) * p.speed;
          p.vy = Math.sin(a) * p.speed;
        }
      }

      p.update(dt);
      if (!p.dead && p.hostile) {
        const dx = pl.x - p.x, dy = pl.y - p.y, rr = pl.radius + p.radius;
        if (dx * dx + dy * dy < rr * rr) {
          this.damagePlayer(p.damage, "projectile");
          p.dead = true;
          this.addShake(6);
          this.sfx.hurt();
          this.spawnParticles(pl.x, pl.y, "#ff5a5f", 8);
        }
      } else if (!p.dead) {
        this.grid.forNear(p.x, p.y, (e) => {
          if (p.dead || e.hp <= 0 || e.charmed) return;
          const dx = e.x - p.x, dy = e.y - p.y;
          const rr = e.radius + p.radius;
          if (dx * dx + dy * dy < rr * rr) {
            if (p.hits) { if (p.hits.has(e)) return; p.hits.add(e); }
            const dealt = this.damageEnemy(e, p.damage, p.source);
            if (p.payload) {
              const c = pushCtx(this);
              c.key = p.source; c.color = p.color; c.now = this.clock;
              c.x = e.x; c.y = e.y; c.target = e; c.amount = dealt;
              c.dirX = p.vx; c.dirY = p.vy;
              runEffects(this, p.payload, c);
              popCtx(this);
            }
            if (p.pierce > 0) p.pierce--; else p.dead = true;
          }
        });
      }
    }
    this.projectiles.sweep(DEAD);
  }

  updateAreas(dt) {
    const list = this.areas.active;
    const p = this.player;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (a.dead) continue;
      if (a.follow) { a.x = p.x; a.y = p.y; }
      a.life -= dt;
      a.tickTimer -= dt;
      if (a.tickTimer <= 0) {
        a.tickTimer += a.tickInterval;
        const dmg = a.dps * a.tickInterval;
        this.grid.forRadius(a.x, a.y, a.radius, (e) => {
          if (e.hp <= 0 || e.charmed) return;
          const dx = e.x - a.x, dy = e.y - a.y, rr = a.radius + e.radius;
          if (dx * dx + dy * dy > rr * rr) return;
          const dealt = dmg > 0 ? this.damageEnemy(e, dmg, a.source) : 0;
          if (a.payload) {
            const c = pushCtx(this);
            c.key = a.source; c.color = a.color; c.now = this.clock;
            c.x = e.x; c.y = e.y; c.target = e; c.amount = dealt;
            c.dirX = p.dirX; c.dirY = p.dirY;
            runEffects(this, a.payload, c);
            popCtx(this);
          }
        });
      }
      if (a.life <= 0) {
        if (a.onEnd) {
          const c = pushCtx(this);
          c.key = a.source; c.color = a.color; c.now = this.clock;
          c.x = a.x; c.y = a.y; c.target = null;
          c.dirX = p.dirX; c.dirY = p.dirY;
          runEffects(this, a.onEnd, c);
          popCtx(this);
        }
        a.dead = true;
      }
    }
    this.areas.sweep(DEAD);
  }

  /* Idem: o evento de morte acorda Colheita, Seed of Corruption e afins, que
     causam dano e podem matar mais inimigos no meio da varredura. */
  killDeadEnemies() {
    const list = this.enemies.active;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      if (e.hp > 0 || e.dead) continue;

      // emitido ANTES de limpar os DoTs: Colheita e Seed of Corruption
      // dependem de conseguir ler o que o morto carregava.
      if (!e.noReward) this.events.emit(EVENTS.ENEMY_KILLED, { enemy: e });
      this.dots.clear(e);

      if (!e.noReward) {
        this.orbs.spawn(e.x, e.y, e.type.xp);
        this.spawnParticles(e.x, e.y, e.type.color, e.type.boss ? 24 : 6);
        this.sfx.death();
        if (e.type.boss) this.addShake(8);
        this.player.kills++;
        this.dropLoot(e);
      }
      e.noReward = false;
      e.dead = true;
    }
    this.enemies.sweep(DEAD);
  }

  dropLoot(e) {
    if (e.type.boss) {
      if (this.elapsed - this.lastBossChestAt >= BALANCE.spawn.bossChestCooldown) {
        this.lastBossChestAt = this.elapsed;
        this.pickups.spawn(e.x, e.y, "chest");
      } else {
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI * 2 / 6) * k;
          this.orbs.spawn(e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26, e.type.xp);
        }
      }
      return;
    }
    for (const id in ITEMS) {
      if (ITEMS[id].dropChance > 0 && Math.random() < ITEMS[id].dropChance) {
        this.pickups.spawn(e.x, e.y, id);
        break;
      }
    }
  }

  updateOrbs(dt) {
    const list = this.orbs.active;
    for (let i = 0; i < list.length; i++) {
      if (list[i].update(dt, this.player)) {
        this.player.gainXp(list[i].value);
        this.orbs.release(i); i--;
      }
    }
  }

  updatePickups(dt) {
    const list = this.pickups.active, p = this.player;
    for (let i = 0; i < list.length; i++) {
      const pk = list[i];
      pk.bob += dt * 4;
      const dx = p.x - pk.x, dy = p.y - pk.y, rr = p.radius + 14;
      if (dx * dx + dy * dy < rr * rr) {
        pk.item.onPickup(this);
        if (!pk.item.silent) {
          this.sfx.item();
          this.addShake(4);
          this.ui.toast({ color: pk.item.color, icon: pk.item.icon,
                          name: pk.item.name, desc: pk.item.desc });
        }
        this.pickups.release(i); i--;
      }
    }
  }

  updateParticles(dt) {
    const list = this.particles.active;
    for (let i = 0; i < list.length; i++) {
      if (list[i].update(dt)) { this.particles.release(i); i--; }
    }
  }

  openChest() { this.ui.openChest(); }

  /* --- render: a ordem das chamadas E a ordem de profundidade -------------- */
  render() {
    const ctx = this.ctx;
    if (this.state === STATE.MENU) {
      this.camera.x += 12 * (1 / 60);
      this.camera.drawGround(ctx);
      return;
    }
    this.camera.drawGround(ctx);
    const cam = this.camera, now = this.clock;

    const areas = this.areas.active;
    for (let i = 0; i < areas.length; i++) areas[i].draw(ctx, cam);

    drawPieceOverlays(ctx, this.build, this.player, cam);

    const orbs = this.orbs.active;
    for (let i = 0; i < orbs.length; i++) orbs[i].draw(ctx, cam);

    const pickups = this.pickups.active;
    for (let i = 0; i < pickups.length; i++) pickups[i].draw(ctx, cam);

    const enemies = this.enemies.active;
    for (let i = 0; i < enemies.length; i++) enemies[i].draw(ctx, cam, now);

    drawMinions(ctx, this.minions.active, cam, now);

    const parts = this.particles.active;
    for (let i = 0; i < parts.length; i++) parts[i].draw(ctx, cam);

    this.player.draw(ctx, cam, this.build.vfx, this.build.capstones.size);

    const proj = this.projectiles.active;
    for (let i = 0; i < proj.length; i++) proj[i].draw(ctx, cam);

    this.vfxLayer.draw(ctx, cam);
  }
}

window.addEventListener("DOMContentLoaded", () => { window.game = new Game(); });
