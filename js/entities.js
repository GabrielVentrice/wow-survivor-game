"use strict";
/* =========================================================================
   ENTIDADES — dados transientes, todos vindos de Pool.
   Nenhuma entidade conhece pecas ou efeitos: o que elas carregam sao numeros
   e um `payload` opaco que o EffectSystem interpreta.
   ========================================================================= */

class Player {
  constructor() {
    this.x = 0;
    this.y = 0;
    this._mv = { x: 0, y: 0 };
    this.facing = 1;                             // 1 = direita, -1 = esquerda
    this.pulses = [];                            // ondas de desbloqueio
    this._vp = { x: 0, y: 0, r: 0, t: 0 };       // param reaproveitado pelos vfx
  }
  reset(cls) {
    this.x = 0; this.y = 0;
    this.radius = BALANCE.player.radius;
    this.baseSpeed = cls.base.speed;
    this.speed = this.baseSpeed;
    this.maxHp = cls.base.maxHp;
    this.hp = this.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
    this.basePickup = 95;
    this.pickupRange = 95;
    this.pendingLevels = 0;
    this.dmgReduction = 0;
    this.kills = 0;
    this.animTime = 0;
    this.moving = false;
    this.forms = cls.forms || DEFAULT_FORMS;
    this.formIdx = 0;
    this.vfxTime = 0;
    this.pulses.length = 0;

    // --- estado de movimento: base dos triggers rooted/trail/directional e
    // das passivas Furia Contida / Pes de Cinza. Sem isso, "posicionamento e a
    // unica decisao em tempo real" nao tem como ser lido pelo motor.
    this.stillTime = 0;      // segundos parado (zera ao andar)
    this.moveTime = 0;       // segundos andando (zera ao parar)
    this.dirX = 1;           // ultimo vetor de movimento nao-nulo, normalizado
    this.dirY = 0;
    this.trailDist = 0;      // distancia acumulada desde o ultimo drop de rastro

    // --- defesa
    this.shield = 0;
    this.maxShield = 0;
    this.speedBoost = 1;
    this.speedBoostUntil = 0;
    this.reviveCharges = 0;
    this.noExternalHeal = false;  // capstone Tirania
  }
  gainXp(v) {
    this.xp += v;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);
      this.pendingLevels++;
    }
  }
  update(dt, input) {
    const mv = input.moveVector(this._mv);
    if (mv.x !== 0) this.facing = mv.x > 0 ? 1 : -1;
    const dx = mv.x * this.speed * dt, dy = mv.y * this.speed * dt;
    this.x += dx;
    this.y += dy;
    this.moving = mv.x !== 0 || mv.y !== 0;
    if (this.moving) {
      this.dirX = mv.x; this.dirY = mv.y;
      this.moveTime += dt; this.stillTime = 0;
      this.trailDist += Math.hypot(dx, dy);
    } else {
      this.stillTime += dt; this.moveTime = 0;
    }
    this.animTime += dt * (this.moving ? 1 : 0.25);
    this.vfxTime += dt;
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      this.pulses[i].t += dt;
      if (this.pulses[i].t >= PULSE_LIFE) this.pulses.splice(i, 1);
    }
  }
  // Dano recebido passa por escudo antes da vida. Retorna o que chegou na vida.
  takeDamage(amount) {
    const dealt = amount * (1 - this.dmgReduction);
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dealt);
      this.shield -= absorbed;
      const rest = dealt - absorbed;
      this.hp -= rest;
      return rest;
    }
    this.hp -= dealt;
    return dealt;
  }
  addShield(amount, cap) {
    if (cap != null) this.maxShield = Math.max(this.maxShield, cap);
    const lim = this.maxShield > 0 ? this.maxShield : this.maxHp;
    this.shield = Math.min(lim, this.shield + amount);
  }
  // forma atual pelo total de pontos de eixo gastos
  formIndex(axisTotal) {
    let idx = 0;
    for (let i = 0; i < this.forms.length; i++) {
      if (axisTotal >= this.forms[i].at) idx = i;
    }
    return idx;
  }
  comboPulse(color) { this.pulses.push({ t: 0, rgb: hexRgb(color) }); }

  draw(ctx, cam, vfxList, auraCount) {
    const sx = this.x - cam.left;
    const sy = this.y - cam.top;
    const r = this.radius;
    const fx = vfxList || EMPTY_ARR;
    const t = this.vfxTime;

    const form = this.forms[this.formIdx];
    const spr = SPRITES[form.sprite];
    const drawH = r * form.scale;
    const anim = walkAnim(this.animTime, this.moving);
    if (form.dy) anim.bob += form.dy * r; // formas mais altas: pes no chao

    const p = this._vp;
    p.x = sx; p.y = sy; p.r = r; p.t = t;
    p.spr = spr; p.drawH = drawH; p.anim = anim; p.flip = this.facing < 0;

    const auraOn = !!form.aura;
    const boost = auraOn ? auraCount : 0;
    const auraR = r * (2.2 + boost * 0.12);
    const aura = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, auraR);
    aura.addColorStop(0, `rgba(122,60,255,${0.3 + boost * 0.04})`);
    aura.addColorStop(1, "rgba(122,60,255,0)");
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(sx, sy, auraR, 0, Math.PI * 2); ctx.fill();

    // halo aditivo na cor de cada vfx ativo, respirando fora de fase
    if (auraOn && fx.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < fx.length; i++) {
        const k = 0.5 + Math.sin(t * 2 + i * 1.7) * 0.5;
        const hr = r * (1.7 + i * 0.16 + k * 0.25);
        const g = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, hr);
        g.addColorStop(0, `rgba(${fx[i].rgb},${(0.05 + k * 0.07).toFixed(3)})`);
        g.addColorStop(1, `rgba(${fx[i].rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, hr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ondas do desbloqueio
    for (let i = 0; i < this.pulses.length; i++) {
      const pu = this.pulses[i], k = pu.t / PULSE_LIFE;
      const rr = r * (1 + k * 5);
      ctx.strokeStyle = `rgba(${pu.rgb},${((1 - k) * 0.8).toFixed(2)})`;
      ctx.lineWidth = 1 + 3 * (1 - k);
      ctx.beginPath();
      ctx.ellipse(sx, sy + r * 0.6, rr, rr * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < fx.length; i++) {
      p.lvl = fx[i].lvl;
      fx[i].under?.(ctx, p);
    }

    drawShadow(ctx, sx, sy, r);
    drawSprite(ctx, spr, sx, sy, drawH, this.facing < 0, 0, anim);

    if (auraOn && fx.length) {
      const c = fx[Math.floor(t / 2.4) % fx.length];
      const k = (Math.sin(t * 3) + 1) * 0.5;
      drawSpriteGlow(ctx, spr, sx, sy, drawH, this.facing < 0, anim,
        c.color, 0.16 + k * 0.2);
    }

    for (let i = 0; i < fx.length; i++) {
      p.lvl = fx[i].lvl;
      fx[i].over?.(ctx, p);
    }

    // escudo: casca girando, so quando ha carga
    if (this.shield > 0) {
      const lim = this.maxShield > 0 ? this.maxShield : this.maxHp;
      const k = Math.min(1, this.shield / lim);
      ctx.strokeStyle = `rgba(120,200,255,${(0.25 + k * 0.5).toFixed(2)})`;
      ctx.lineWidth = 1.5 + k * 2;
      ctx.beginPath();
      ctx.arc(sx, sy, r * (1.5 + k * 0.4), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

class Enemy {
  constructor() {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.dots = [];      // instancias de DoT ativas (ver DotSystem)
  }
  // recebe o tipo, a posicao inicial e o `scale` da fase de dificuldade
  reset(obj, type, x, y, scale) {
    this.type = type;
    this.x = x; this.y = y;
    this.radius = type.radius;
    this.baseSpeed = Math.min(type.speed * scale.speed,
      BALANCE.player.speed * BALANCE.spawn.speedCap);
    this.speed = this.baseSpeed;
    this.maxHp = type.hp * (type.boss ? Math.pow(scale.hp, BALANCE.spawn.bossHpExp) : scale.hp);
    this.hp = this.maxHp;
    this.touchDps = type.touchDps * scale.dmg;
    this.shootDamage = (type.shootDamage || 0) * scale.dmg;
    this.hitFlash = 0;
    this.facing = 1;
    this.animTime = Math.random() * 6; // fase aleatória p/ nao andarem em sincronia
    this.shootTimer = type.shootInterval || 0;

    // --- estados de controle, todos em segundos absolutos do relogio do jogo
    this.dots.length = 0;
    this.dotPulse = 0;        // flash a cada tick de DoT
    this.dotAnim = Math.random() * 6;
    this.dotColor = "#7fdc4a";
    this.slowUntil = 0; this.slowFactor = 1;
    this.stunUntil = 0;
    this.fearUntil = 0;
    this.auraTime = 0;        // tempo acumulado dentro de auras (ramp de Agony)
    this.marked = 0;          // amplificacao de dano recebido (Haunt)
    this.markedUntil = 0;
    this.weakUntil = 0; this.weakFactor = 1;   // Curse of Tongues
    this.noReward = false;    // convertido: morre sem dar XP nem loot
    this.dead = false;        // marcado por killDeadEnemies antes do sweep
    this.charmed = false;     // convertido pelo player (Enslave Demon)
    this.dead = false;
  }
  update(dt, player, now) {
    if (now < this.stunUntil) { if (this.hitFlash > 0) this.hitFlash -= dt; return; }

    let dx = player.x - this.x;
    let dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    let sp = this.baseSpeed;
    if (now < this.slowUntil) sp *= this.slowFactor;
    let sign = 1;
    if (now < this.fearUntil) sign = -1;      // amedrontado: foge
    this.speed = sp;
    this.x += (dx / d) * sp * dt * sign;
    this.y += (dy / d) * sp * dt * sign;
    this.facing = dx < 0 ? -1 : 1;
    this.animTime += dt * (sp / 90);
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.dots.length) this.dotAnim += dt;
    if (this.dotPulse > 0) this.dotPulse = Math.max(0, this.dotPulse - dt * 3.2);
  }
  draw(ctx, cam, now) {
    const sx = this.x - cam.left;
    const sy = this.y - cam.top;
    const r = this.radius;

    const spr = SPRITES[this.type.id];
    const flash = this.hitFlash > 0 ? Math.min(0.85, this.hitFlash / 0.1 * 0.85) : 0;
    const anim = walkAnim(this.animTime, true);
    const dotted = this.dots.length > 0;
    if (dotted) this.drawDotUnder(ctx, sx, sy, r);
    if (spr) {
      drawShadow(ctx, sx, sy, r);
      drawSprite(ctx, spr, sx, sy, r * 2.7, this.facing < 0, flash, anim);
    } else {
      ctx.fillStyle = this.type.color;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }
    if (dotted) this.drawDotOver(ctx, sx, sy, r, spr, anim);

    // marcadores de controle
    if (now < this.stunUntil) this.drawRing(ctx, sx, sy - r * 1.4, "#ffd24a", 0.8);
    else if (now < this.fearUntil) this.drawRing(ctx, sx, sy - r * 1.4, "#c850ff", 0.7);
    else if (now < this.slowUntil) this.drawRing(ctx, sx, sy - r * 1.4, "#5acfff", 0.5);

    if (this.type.boss) {
      const bw = r * 2, bh = 5, by = sy - r - 12;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(sx - r, by, bw, bh);
      ctx.fillStyle = "#ff3b6b";
      ctx.fillRect(sx - r, by, bw * Math.max(0, this.hp / this.maxHp), bh);
    }
  }
  drawRing(ctx, x, y, color, a) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = a;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // névoa do DoT no chão, sob o inimigo. Cor vem do DoT mais recente.
  drawDotUnder(ctx, sx, sy, r) {
    const fade = Math.min(1, this.dots.length * 0.6);
    const pulse = this.dotPulse, t = this.dotAnim, col = this.dotColor;

    const w = r * (1.25 + pulse * 0.3);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = fade * (0.24 + pulse * 0.22);
    ctx.drawImage(glowBlob(col), sx - w, sy + r * 0.5 - w * 0.45, w * 2, w * 0.9);
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy + r * 0.95);
    ctx.scale(1, 0.4);
    ctx.rotate(-t * 1.1);
    ctx.strokeStyle = `rgba(${hexRgb(col)},${(fade * (0.5 + pulse * 0.4)).toFixed(2)})`;
    ctx.lineWidth = 1.4 + pulse;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.65, a, a + 1.1);
      ctx.stroke();
    }
    ctx.restore();
  }
  // podridao sobre o inimigo: um orbe por DoT empilhado
  drawDotOver(ctx, sx, sy, r, spr, anim) {
    const n = Math.min(6, this.dots.length);
    const fade = Math.min(1, n * 0.6);
    const pulse = this.dotPulse, t = this.dotAnim, col = this.dotColor;

    if (spr) {
      drawSpriteGlow(ctx, spr, sx, sy, r * 2.7, this.facing < 0, anim,
        col, fade * (0.05 + pulse * 0.09));
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const d = this.dots[i];
      const blob = glowBlob(d.color || col);
      const a = t * 2.2 + (i / n) * Math.PI * 2;
      const depth = 0.7 + Math.sin(a) * 0.3;
      const px = sx + Math.cos(a) * r * 1.5;
      const py = sy - r * 0.1 + Math.sin(a) * r * 0.55;
      const w = r * 0.32 * depth * (1 + pulse * 0.3);
      ctx.globalAlpha = fade * 0.5 * depth;
      ctx.drawImage(blob, px - w, py - w, w * 2, w * 2);
      ctx.globalAlpha = fade * 0.8 * depth;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, 1.2 * depth, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (pulse > 0) {
      const k = 1 - pulse;
      ctx.strokeStyle = `rgba(${hexRgb(col)},${(fade * pulse * 0.78).toFixed(2)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(sx, sy + r * 0.35, r * (1 + k * 1.7), r * (0.4 + k * 0.75),
        0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

class Projectile {
  constructor() { this.dead = false; }
  reset(obj, o) {
    this.x = o.x; this.y = o.y;
    this.vx = o.vx; this.vy = o.vy;
    this.damage = o.damage || 0;
    this.radius = o.radius;
    this.color = o.color;
    this.source = o.source;              // `key` da peca — meio de dano e anti-recursao
    this.payload = o.payload || null;    // efeitos disparados no impacto
    this.life = o.life;
    this.hostile = o.hostile || false;   // true = dano no player (boss)
    this.homing = o.homing || false;
    this.speed = o.speed || Math.hypot(o.vx, o.vy);
    this.turnRate = o.turnRate || 0;
    this.pierce = o.pierce || 0;
    this.reflected = false;
    if (this.pierce > 0) { this.hits = this.hits || new Set(); this.hits.clear(); }
    else this.hits = null;
    // rastro: buffer plano [x0,y0,...] amostrado por DISTANCIA, nao por frame,
    // p/ o rastro ter o mesmo comprimento em qualquer fps/velocidade de jogo.
    if (o.trail) {
      this.trailMax = 24;
      this.trailStep = o.trail / this.trailMax;
      this.trail = this.trail || [];
      this.trail.length = 0;
      this.rgb = hexRgb(this.color);
      this.age = 0;
    } else this.trail = null;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.trail) {
      this.age += dt;
      const t = this.trail, step = this.trailStep;
      if (!t.length) t.push(this.x, this.y);
      else {
        const lx = t[t.length - 2], ly = t[t.length - 1];
        const dx = this.x - lx, dy = this.y - ly, d = Math.hypot(dx, dy);
        const n = Math.min(Math.floor(d / step), this.trailMax);
        for (let i = 1; i <= n; i++) {
          const f = (i * step) / d;
          t.push(lx + dx * f, ly + dy * f);
        }
      }
      while (t.length > this.trailMax * 2) t.splice(0, 2);
    }
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx, cam) {
    const sx = this.x - cam.left, sy = this.y - cam.top, r = this.radius;
    if (this.trail) { this.drawComet(ctx, cam, sx, sy, r); return; }
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.4, this.color);
    g.addColorStop(1, "rgba(122,60,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, r * 2, 0, Math.PI * 2); ctx.fill();
  }
  // rastro em cometa: blobs suaves ao longo das ultimas posicoes + cabeca esticada
  drawComet(ctx, cam, sx, sy, r) {
    const t = this.trail, n = t.length >> 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (n >= 3) {
      const blob = glowBlob(this.color);
      const total = n + 1;
      for (let i = 0; i < total; i++) {
        const k = i / (total - 1);
        const x = i < n ? t[i * 2] - cam.left : sx;
        const y = i < n ? t[i * 2 + 1] - cam.top : sy;
        const w = r * (0.95 + 1.8 * k * k);
        ctx.globalAlpha = 0.38 * k * Math.sqrt(k);
        ctx.drawImage(blob, x - w, y - w, w * 2, w * 2);
      }
      ctx.globalAlpha = 1;
    }

    const pulse = 1 + Math.sin(this.age * 26) * 0.12;
    ctx.translate(sx, sy);
    ctx.rotate(Math.atan2(this.vy, this.vx));
    ctx.scale(1.5, 0.85);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6 * pulse);
    halo.addColorStop(0, "#fff");
    halo.addColorStop(0.28, this.color);
    halo.addColorStop(0.62, `rgba(${this.rgb},0.35)`);
    halo.addColorStop(1, `rgba(${this.rgb},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/* Demonio invocado. `ai` escolhe o comportamento; `payload` sao os efeitos que
   ele dispara ao atacar — o mesmo formato das pecas, de modo que um demonio
   herda automaticamente qualquer efeito novo que o registry inventar. */
class Minion {
  constructor() {}
  reset(obj, o) {
    this.kind = o.kind;                  // chave em MINIONS (visual + tuning)
    this.ai = o.ai || "chase";
    this.x = o.x; this.y = o.y;
    this.vx = 0; this.vy = 0;
    this.radius = o.radius || 9;
    this.color = o.color || "#ff8a3c";
    this.damage = o.damage || 0;
    this.attackInterval = o.attackInterval || 1;
    this.range = o.range || 260;
    this.speed = o.speed || 200;
    this.orbitRadius = o.orbitRadius || 72;
    this.angle = o.angle || 0;
    this.expiresAt = o.expiresAt;        // Infinity = permanente (Tirania)
    this.source = o.source;              // `key` da peca dona
    this.payload = o.payload || null;    // efeitos no acerto
    this.projectile = o.projectile || null;
    this.cd = Math.random() * 0.3;
    this.big = !!o.big;                  // conta como "invocacao grande"
    this.animTime = Math.random() * 6;
    this.facing = 1;
    this.dead = false;
  }
}

/* Zona de dano no chão. `payload` roda em cada inimigo a cada tick. */
class AreaEffect {
  constructor() {}
  reset(obj, o) {
    this.x = o.x; this.y = o.y;
    this.radius = o.radius;
    this.dps = o.dps || 0;
    this.life = o.life; this.maxLife = o.life;
    this.tickInterval = o.tickInterval || 0.4;
    this.tickTimer = this.tickInterval;
    this.color = o.color || "#ff7a2c";
    this.rgb = hexRgb(this.color);
    this.source = o.source;
    this.payload = o.payload || null;
    this.follow = o.follow || false;     // gruda no player (auras persistentes)
    this.onEnd = o.onEnd || null;
    this.dead = false;
  }
  draw(ctx, cam) {
    const sx = this.x - cam.left, sy = this.y - cam.top;
    const a = Math.min(1, this.life / 0.4) * 0.5; // fade out no fim
    const g = ctx.createRadialGradient(sx, sy, this.radius * 0.2, sx, sy, this.radius);
    g.addColorStop(0, `rgba(${this.rgb},${a * 0.55})`);
    g.addColorStop(0.6, `rgba(${this.rgb},${a * 0.32})`);
    g.addColorStop(1, `rgba(${this.rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2); ctx.fill();
  }
}

/* Instancia de DoT. Vive no pool global do DotSystem e tambem no array
   `enemy.dots`. O tick e agendado por timestamp absoluto — nao roda por frame. */
class DotInstance {
  constructor() {}
  reset(obj, o) {
    this.key = o.key;                // identidade do DoT (p/ stacking)
    this.ownerKey = o.ownerKey;      // `key` da peca — meio de dano
    this.enemy = o.enemy;
    this.dps = o.dps;
    this.tickInterval = o.tickInterval;
    this.nextTick = o.now + o.tickInterval;
    this.endAt = o.now + o.duration;
    this.duration = o.duration;
    this.stacks = 1;
    this.maxStacks = o.maxStacks || 1;
    this.rampPerSec = o.rampPerSec || 0;
    this.bornAt = o.now;
    this.color = o.color;
    this.removable = o.removable !== false;
    this.permanent = !!o.permanent;
    this.onExpire = o.onExpire || null;
    this.spreadOnContact = !!o.spreadOnContact;
    this.dead = false;
  }
  // dano de um tick, ja com stacks e ramp
  tickDamage(now) {
    const ramp = this.rampPerSec ? 1 + (now - this.bornAt) * this.rampPerSec : 1;
    return this.dps * this.tickInterval * this.stacks * ramp;
  }
}

class XPOrb {
  constructor() {}
  reset(obj, x, y, value) {
    this.x = x; this.y = y; this.value = value;
    this.magnet = false; // ativado pelo item Ímã de Almas
  }
  // ímã: acelera em direção ao player quando dentro do pickupRange (ou sempre, se magnet)
  update(dt, player) {
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (this.magnet || d < player.pickupRange) {
      const pull = this.magnet ? 560 : 240 + (player.pickupRange - d) * 6;
      this.x += (dx / d) * pull * dt;
      this.y += (dy / d) * pull * dt;
    }
    return d < player.radius + 6; // true = coletado
  }
  draw(ctx, cam) {
    const sx = this.x - cam.left, sy = this.y - cam.top;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 7);
    g.addColorStop(0, "#d8ffb0");
    g.addColorStop(0.5, "#6fdc4a");
    g.addColorStop(1, "rgba(58,122,38,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
  }
}

// Item dropado no chão; coletado ao encostar.
class Pickup {
  constructor() {}
  reset(obj, x, y, itemId) {
    this.x = x; this.y = y;
    this.item = ITEMS[itemId];
    this.bob = Math.random() * 6.28;
  }
  draw(ctx, cam) {
    const sx = this.x - cam.left, sy = this.y - cam.top - Math.sin(this.bob) * 3;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
    g.addColorStop(0, this.item.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "20px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.item.icon, sx, sy);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}

class Particle {
  constructor() {}
  reset(obj, x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9;
    this.life -= dt;
    return this.life <= 0;
  }
  draw(ctx, cam) {
    const a = this.life / this.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - cam.left, this.y - cam.top, this.size * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Zona de dano no chão (Rain of Fire e, depois, explosões de combo).

// Gera inimigos fora da tela em fluxo continuo, escalando com o tempo.
class SpawnManager {
  constructor() { this.reset(); }
  reset() {
    this.timer = 0;
    this.interval = BALANCE.spawn.baseInterval;
    this.scale = { hp: 1, dmg: 1, speed: 1 };
    this.ramps = 0;
    this.rampClock = 0;   // time accumulated since the last ramp
    this.hard = false;    // has BALANCE.spawn.hardAt been crossed yet?
    this.nextWaveAt = BALANCE.spawn.waveEvery;
    this.nextBossAt = BALANCE.spawn.bossAt;
  }
  // true past the 5 min mark — the hard phase uses a different set of numbers
  isHard(elapsed) { return elapsed >= BALANCE.spawn.hardAt; }

  // ajusta dificuldade conforme o tempo decorrido. The ramp is timed by
  // accumulation (not floor(elapsed / rampEvery)) because the cadence changes
  // mid-run: the early phase's 30s become 15s past hardAt.
  applyScaling(dt, elapsed) {
    const B = BALANCE.spawn;
    const hard = this.isHard(elapsed);
    const every = hard ? B.hardRampEvery : B.rampEvery;
    this.rampClock += dt;
    while (this.rampClock >= every) {
      this.rampClock -= every;
      this.ramps++;
      this.interval = Math.max(hard ? B.hardMinInterval : B.minInterval,
        this.interval * (hard ? B.hardIntervalDecay : B.intervalDecay));
      this.scale.hp *= 1 + (hard ? B.hardHpGrowth : B.hpGrowth);
      this.scale.dmg *= 1 + (hard ? B.hardDmgGrowth : B.dmgGrowth);
      this.scale.speed *= 1 + (hard ? B.hardSpeedGrowth : B.speedGrowth);
    }
  }
  // spawn weight of this type in the current phase
  weightOf(type, late) {
    return late && type.lateWeight != null ? type.lateWeight : type.weight;
  }
  pickType(elapsed) {
    const late = this.isHard(elapsed);
    let total = 0;
    const pool = [];
    for (const id in ENEMIES) {
      const t = ENEMIES[id];
      if (t.boss || elapsed < t.minTime) continue;
      pool.push(t); total += this.weightOf(t, late);
    }
    let roll = (this.timer * 9301 + elapsed * 49297) % total; // pseudo-random barato
    for (const t of pool) { if ((roll -= this.weightOf(t, late)) < 0) return t; }
    return pool[0];
  }
  // how many Dreadlords come out at once — grows through the hard phase
  bossCount(elapsed) {
    const B = BALANCE.spawn;
    if (!this.isHard(elapsed)) return 1;
    const extra = Math.floor((elapsed - B.hardAt) / B.hardBossStack);
    return Math.min(B.maxBossStack, 1 + extra);
  }
  update(dt, game) {
    const B = BALANCE.spawn;
    this.applyScaling(dt, game.elapsed);

    const hard = this.isHard(game.elapsed);
    if (hard && !this.hard) { this.hard = true; game.onHardPhase(); }

    // wave densa em círculo
    if (game.elapsed >= this.nextWaveAt) {
      this.nextWaveAt += hard ? B.hardWaveEvery : B.waveEvery;
      this.spawnWave(game);
    }
    // mini-boss Dreadlord
    if (game.elapsed >= this.nextBossAt) {
      this.nextBossAt += hard ? B.hardBossEvery : B.bossEvery;
      this.spawnBoss(game);
    }

    if (game.enemies.active.length >= (hard ? B.hardMaxAlive : B.maxAlive)) return;
    this.timer += dt;
    while (this.timer >= this.interval) {
      this.timer -= this.interval;
      this.spawnOne(game);
    }
  }
  _reach(game) {
    const cam = game.camera;
    return Math.hypot(cam.w, cam.h) / 2 + BALANCE.spawn.margin;
  }
  spawnOne(game) {
    const reach = this._reach(game);
    const a = (game.elapsed * 2.3 + game.enemies.active.length * 1.7) % (Math.PI * 2);
    const x = game.player.x + Math.cos(a) * reach;
    const y = game.player.y + Math.sin(a) * reach;
    game.enemies.spawn(this.pickType(game.elapsed), x, y, this.scale);
  }
  spawnWave(game) {
    const reach = this._reach(game) * 0.92;
    const n = BALANCE.spawn.waveBase + this.ramps * 4;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i;
      const x = game.player.x + Math.cos(a) * reach;
      const y = game.player.y + Math.sin(a) * reach;
      game.enemies.spawn(this.pickType(game.elapsed), x, y, this.scale);
    }
  }
  spawnBoss(game) {
    const reach = this._reach(game);
    const n = this.bossCount(game.elapsed);
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.PI * 2 / n) * i;
      const x = game.player.x + Math.cos(a) * reach;
      const y = game.player.y + Math.sin(a) * reach;
      game.enemies.spawn(ENEMIES.dreadlord, x, y, this.scale);
    }
    game.onBossSpawn(n);
  }
}

