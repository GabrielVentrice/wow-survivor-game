"use strict";
/* A fatia PADRAO da casca de escudo. Peca que nao declara `veil` cai aqui, e o
   que ela perde e identidade, nao funcionamento. Ver EFFECTS.shield. */
const VEIL_BASE = { sides: 6, spin: 0.5, thick: 2, spikes: 0 };
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
    this.basePickup = BALANCE.player.pickup;
    this.pickupRange = this.basePickup;
    this.pendingLevels = 0;
    this.dmgReduction = 0;
    this.kills = 0;
    this.animTime = 0;
    this.moving = false;
    this.rushing = false;              // Game.update: o buff de velocidade esta de pe
    this.speedBoostColor = null;
    this.veil = null;                  // fatia da casca de escudo (EFFECTS.shield)
    this.veilRgb = null;
    this.forms = cls.forms || DEFAULT_FORMS;
    this.formIdx = 0;
    // Cor de cada forma, pre-resolvida: a luz de chao e desenhada por frame e
    // hexRgb aloca. Forma sem cor propria cai na cor da classe.
    this.formRgb = this.forms.map((f) => hexRgb(f.color || cls.color || AXIS_PALETTE.dominion.base));
    this.vfxTime = 0;
    // Quanto tempo REAL de simulacao ainda resta da pose de cast. O unico input
    // em combate e movimento e nenhuma peca e conjurada a mao, entao sem isto o
    // warlock atravessa a run inteira com o mesmo braco caido enquanto trinta
    // spells disparam sozinhas — o corpo nao participa do que a build faz.
    this.castTime = 0;
    this.castGap = 0;
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
  // Pickup radius at the current level, capped. Derived from `level` on every
  // read instead of being bumped inside gainXp: one formula, and a level
  // granted from anywhere (chest, debug) carries the radius with it.
  pickupForLevel() {
    const b = BALANCE.player;
    return Math.min(b.pickupMax, b.pickup + (this.level - 1) * b.pickupPerLevel);
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
    if (this.castTime > 0) this.castTime -= dt;
    if (this.castGap > 0) this.castGap -= dt;
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
  /* Forma atual. A regra mudou de CONTAGEM para IDENTIDADE: nao e mais "quantos
     capstones fechei" e sim "QUAL capstone eu fechei". Contagem dava duas
     formas para oito finais diferentes — o corpo dizia que a run tinha chegado
     longe, mas nao dizia para ONDE. Com uma forma por capstone a silhueta passa
     a ser a resposta da pergunta que a tela de etapa faz a run inteira.

     `spells` cobre o degrau do meio: nao existe capstone para dar, e a unica
     outra conquista merecida do jogo e fechar um caminho ate o tier 5. Ponto de
     eixo nao serve — ele entra sozinho a cada compra e a forma chegaria por
     inercia, que e exatamente o defeito que tirou a metamorfose do acumulo. */
  formIndex(caps, lastCap, spellsDone) {
    let idx = 0, capIdx = -1;
    for (let i = 0; i < this.forms.length; i++) {
      const f = this.forms[i];
      if (f.spells != null && spellsDone >= f.spells) idx = i;
      if (!f.cap || !caps || !caps.has(f.cap)) continue;
      // O ultimo capstone fechado manda; sem ele, o primeiro que casar.
      if (f.cap === lastCap) return i;
      if (capIdx < 0) capIdx = i;
    }
    return capIdx >= 0 ? capIdx : idx;
  }
  comboPulse(color) { this.pulses.push({ t: 0, rgb: hexRgb(color) }); }

  /* Poe o corpo na pose de cast. Chamado por quem DISPARA, nunca por quem
     desenha: com sub-stepping o draw roda uma vez por frame e o disparo varias,
     e amarrar a pose ao desenho perderia os disparos que caem no mesmo frame.

     `Math.max` e nao soma: numa build grande meia duzia de pecas dispara no
     mesmo instante, e somar a duracao deixaria o warlock travado de bracos
     para cima o tempo todo — a pose so significa alguma coisa se ela voltar. */
  castPulse(dur) {
    if (this.castGap > 0) return;
    this.castTime = dur || CAST_POSE;
    this.castGap = CAST_GAP;
  }

  /* `auras` = as spells CONCLUIDAS (build.vfx). Peca comprada nao acende nada:
     o halo em volta do warlock e o que se ganha por fechar um caminho ate o
     tier 5. A FORMA (capstones) manda na luz do corpo; as AURAS (spells
     concluidas) mandam nos halos coloridos em volta. */
  /* Quem deu o escudo manda na casca. O ultimo a dar vence: com duas pecas de
     escudo na build o jogador tem UMA barra de escudo, entao ele so pode ter
     uma casca — e a mais recente e a que responde pelo que acabou de acontecer. */
  setVeil(color, veil) {
    this.veil = veil || VEIL_BASE;
    if (color !== this._veilHex) { this._veilHex = color; this.veilRgb = hexRgb(color); }
  }

  draw(ctx, cam, auras) {
    const sx = this.x - cam.left;
    const sy = this.y - cam.top;
    const r = this.radius;
    const fx = auras || EMPTY_ARR;
    const t = this.vfxTime;

    const form = this.forms[this.formIdx];
    const spr = SPRITES[form.sprite];
    const drawH = r * form.scale;
    const anim = walkAnim(this.animTime, this.moving);
    anim.cast = this.castTime > 0;
    if (form.dy) anim.bob += form.dy * r; // formas mais altas: pes no chao

    const p = this._vp;
    p.x = sx; p.y = sy; p.r = r; p.t = t;
    p.spr = spr; p.drawH = drawH; p.anim = anim; p.flip = this.facing < 0;

    // Luz no chao, nao neblina em cima dele: o halo antigo era um disco
    // centrado no proprio corpo e lavava o sprite por dentro. Achatado aos pes
    // ele faz a mesma coisa — dizer que o warlock esta aceso — sem cobrir a
    // unica coisa que o jogador precisa achar na tela.
    // A cor e o tamanho saem da FORMA: e a metamorfose, e nao a build, que diz
    // o quanto o warlock ja deixou de ser humano.
    const rgb = this.formRgb[this.formIdx];
    const auraR = r * (2.2 + this.formIdx * 0.55);
    const aura = ctx.createRadialGradient(sx, sy + r * 0.7, r * 0.3, sx, sy + r * 0.7, auraR);
    aura.addColorStop(0, `rgba(${rgb},${(0.24 + this.formIdx * 0.07).toFixed(3)})`);
    aura.addColorStop(1, `rgba(${rgb},0)`);
    ctx.save();
    ctx.translate(sx, sy + r * 0.7);
    ctx.scale(1, 0.46);
    ctx.translate(-sx, -(sy + r * 0.7));
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(sx, sy + r * 0.7, auraR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Halo aditivo na cor de cada aura, respirando fora de fase. O brilho e
    // dividido pelo numero de auras: seis halos com a alpha de um viram uma
    // bola branca, e ai a build inteira custa a leitura do personagem.
    if (fx.length) {
      const share = 1 / Math.sqrt(fx.length);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < fx.length; i++) {
        const k = 0.5 + Math.sin(t * 2 + i * 1.7) * 0.5;
        const hr = r * (1.7 + i * 0.16 + k * 0.25);
        const g = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, hr);
        g.addColorStop(0, `rgba(${fx[i].rgb},${((0.04 + k * 0.05) * share).toFixed(3)})`);
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

    const shown = Math.min(fx.length, MAX_PIECE_VFX);
    for (let i = 0; i < shown; i++) {
      p.lvl = fx[i].lvl; p.color = fx[i].color; p.rgb = fx[i].rgb;
      fx[i].under?.(ctx, p);
    }

    drawShadow(ctx, sx, sy, r);
    drawSpriteRim(ctx, spr, sx, sy, drawH, this.facing < 0, anim, "#05020a", 0.9);
    drawSprite(ctx, spr, sx, sy, drawH, this.facing < 0, 0, anim);

    // O brilho da build passa por cima do sprite, entao ele e o primeiro a
    // apagar a arte: fica so como respiro de cor, nao como fonte de luz.
    if (fx.length) {
      const c = fx[Math.floor(t / 2.4) % fx.length];
      const k = (Math.sin(t * 3) + 1) * 0.5;
      drawSpriteGlow(ctx, spr, sx, sy, drawH, this.facing < 0, anim,
        c.color, 0.06 + k * 0.08);
    }

    for (let i = 0; i < shown; i++) {
      p.lvl = fx[i].lvl; p.color = fx[i].color; p.rgb = fx[i].rgb;
      fx[i].over?.(ctx, p);
    }

    /* BURNING RUSH. `self_speed` e `self_damage` eram as duas mecanicas mais
       invisiveis do jogo: a peca acelerava o jogador e queimava a vida dele
       sem gastar um pixel — a unica evidencia era a barra de vida descendo
       sozinha, o que le como bug e nao como custo.

       Isto e um ESTADO e nao um acontecimento, entao nao pode ser um evento
       visual: evento por pulso da aura seria o mesmo erro de emitir alguma
       coisa a cada 0.5s para dizer "voce tem escudo". Estado se desenha como
       sobreposicao enquanto dura, do mesmo jeito que a casca do escudo e o
       anel de carga do `rooted`.

       As riscas ficam ATRAS do movimento e no CHAO. Atras porque e o rastro do
       que ja passou — a frente elas empurrariam a leitura para onde ele ainda
       nao esta; no chao porque a faixa de cima do personagem ja pertence a
       build acesa, e o corpo do warlock e a coisa que nao pode ser coberta. */
    if (this.rushing) {
      const col = this.speedBoostColor || "#ff8a3c";
      const rgb = hexRgb(col);
      const bx = -this.dirX, by = -this.dirY;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        // fases diferentes: as tres riscas nao piscam juntas, senao lê como
        // um retangulo acendendo
        const ph = (t * 2.6 + i * 0.37) % 1;
        const off = (i - 1) * r * 0.55;
        const x0 = sx + bx * r * 0.5 - by * off;
        const y0 = sy + r * 0.75 + by * r * 0.25 + bx * off * 0.4;
        const len = r * (1.1 + ph * 1.9);
        ctx.strokeStyle = `rgba(${rgb},${((1 - ph) * 0.5).toFixed(2)})`;
        ctx.lineWidth = 1 + (1 - ph) * 2.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + bx * len, y0 + by * len * 0.45);
        ctx.stroke();
      }
      ctx.restore();
      // e o corpo queima junto: e ele que esta pagando
      const beat = 0.1 + (Math.sin(t * 9) + 1) * 0.06;
      drawSpriteGlow(ctx, spr, sx, sy, drawH, this.facing < 0, anim, col, beat);
    }

    /* A CASCA. Era um circulo ciano, igual para as seis pecas que dao escudo —
       e ciano e a cor que a identidade tirou do jogo. Agora ela e um poligono
       na cor de QUEM deu o escudo, e a fatia (`veil`) diz quantos lados, o
       quanto ele gira e se tem espinho.

       Poligono e nao circulo porque poligono tem ORIENTACAO: girando, ele diz
       que existe alguma coisa em volta do corpo; um circulo girando e um
       circulo parado. E os lados sao poucos de proposito — a 20 pixels de
       raio, doze lados ja sao um circulo de novo. */
    if (this.shield > 0) {
      const lim = this.maxShield > 0 ? this.maxShield : this.maxHp;
      const k = Math.min(1, this.shield / lim);
      const v = this.veil || VEIL_BASE;
      const rgb = this.veilRgb || hexRgb(CLASSES.warlock.color);
      const R = r * (1.5 + k * 0.4);
      const n = v.sides || 6, spin = t * (v.spin != null ? v.spin : 0.5);
      ctx.strokeStyle = `rgba(${rgb},${(0.3 + k * 0.55).toFixed(2)})`;
      ctx.lineWidth = 1.5 + k * (v.thick || 2);
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = spin + (i / n) * Math.PI * 2;
        const px = sx + Math.cos(a) * R, py = sy + Math.sin(a) * R;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      // espinho: a casca que REVIDA aponta para fora, e isso se le sem legenda
      if (v.spikes) {
        for (let i = 0; i < n; i++) {
          const a = spin + ((i + 0.5) / n) * Math.PI * 2;
          const c0 = Math.cos(a), s0 = Math.sin(a);
          ctx.beginPath();
          ctx.moveTo(sx + c0 * R, sy + s0 * R);
          ctx.lineTo(sx + c0 * R * (1 + 0.22 * k), sy + s0 * R * (1 + 0.22 * k));
          ctx.stroke();
        }
      }
    }
  }
}

/* Enemies come from a Pool, so holding a reference to one across frames is a
   trap: once dead the object returns to `free` and is REBORN as a different
   creature, somewhere else, at full hp. Anything that keeps a target between
   frames (the homing projectile) needs to know the object in hand is still the
   same creature — `hp > 0` does not prove it, since the recycled one has hp
   too. The stamp costs one integer per spawn and settles it. */
let ENEMY_GEN = 0;

class Enemy {
  constructor() {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.dots = [];      // instancias de DoT ativas (ver DotSystem)
  }
  // recebe o tipo, a posicao inicial e o `scale` da fase de dificuldade
  reset(obj, type, x, y, scale) {
    this.gen = ++ENEMY_GEN;
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
      drawSprite(ctx, spr, sx, sy, r * (this.type.art || 2.7), this.facing < 0, flash, anim);
    } else {
      ctx.fillStyle = this.type.color;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }
    if (dotted) this.drawDotOver(ctx, sx, sy, r, spr, anim);

    /* UMA marca por corpo, a de maior prioridade. Duas marcas sobre o mesmo
       inimigo sao a mesma parede de informacao que o anel de podridao evita
       aparecendo so em quem carrega 3+ DoTs — e aqui a horda tem mil corpos.

       A ordem e por quanto o estado muda a JOGADA: atordoado e o unico que
       para o corpo, medo e o unico que o manda embora, lento muda a rota, e os
       dois de baixo so mudam a conta de dano. */
    const mk = now < this.stunUntil ? "stun"
             : now < this.fearUntil ? "fear"
             : now < this.slowUntil ? "slow"
             : now < (this.weakUntil || 0) ? "weaken"
             : (this.marked > 0 && now < this.markedUntil) ? "mark"
             : null;
    if (mk) drawStateMark(ctx, mk, sx, sy - r * 1.55);

    if (this.type.boss) {
      const bw = r * 2, bh = 5, by = sy - r - 12;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(sx - r, by, bw, bh);
      // o vermelho da UI, e nao um segundo vermelho: duas listas divergem
      ctx.fillStyle = UI_PAL.vida;
      ctx.fillRect(sx - r, by, bw * Math.max(0, this.hp / this.maxHp), bh);
    }
  }
  // névoa do DoT no chão, sob o inimigo. Cor vem do DoT mais recente.
  drawDotUnder(ctx, sx, sy, r) {
    const fade = Math.min(1, this.dots.length * 0.6);
    const pulse = this.dotPulse, t = this.dotAnim, col = this.dotColor;

    const w = r * (1.25 + pulse * 0.3);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = fade * (0.14 + pulse * 0.14);
    ctx.drawImage(glowBlob(col), sx - w, sy + r * 0.5 - w * 0.45, w * 2, w * 0.9);
    ctx.restore();

    // O anel girando so aparece em quem carrega 3+ DoTs. Em um inimigo ele e
    // charme; em cinquenta ele e um tapete verde girando por baixo da horda, e
    // o jogador perde de vista onde termina um bicho e comeca o outro. Com o
    // corte ele deixa de ser enfeite e vira informacao: ali esta o alvo maduro.
    if (this.dots.length < 3) return;

    ctx.save();
    ctx.translate(sx, sy + r * 0.95);
    ctx.scale(1, 0.4);
    ctx.rotate(-t * 1.1);
    ctx.strokeStyle = `rgba(${hexRgb(col)},${(fade * (0.3 + pulse * 0.3)).toFixed(2)})`;
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
    const n = Math.min(3, this.dots.length);
    const fade = Math.min(1, n * 0.6);
    const pulse = this.dotPulse, t = this.dotAnim, col = this.dotColor;

    if (spr) {
      drawSpriteGlow(ctx, spr, sx, sy, r * (this.type.art || 2.7), this.facing < 0, anim,
        col, fade * (0.03 + pulse * 0.05));
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    /* Um orbe por stack, e a fatia (`look`) diz COMO ele se move. Cinco pecas
       do jogo so aplicam DoT: sem isto elas desenhavam exatamente a mesma
       coisa, e como a cor e predicado do eixo, duas do mesmo eixo saiam
       identicas num corpo.

       O padrao do movimento e o que separa: podridao ORBITA, fogo SOBE,
       maldicao fica PARADA em fila sobre a cabeca (uma marca por acumulo, que
       e o que uma maldicao de acumulo precisa dizer) e sentenca FECHA para
       dentro. Nenhum deles custa um desenho novo — e o mesmo orbe. */
    for (let i = 0; i < n; i++) {
      const d = this.dots[i];
      const blob = glowBlob(d.color || col);
      const a = t * 2.2 + (i / n) * Math.PI * 2;
      let depth = 0.7 + Math.sin(a) * 0.3;
      let px, py;
      if (d.look === "fire") {
        const ph = (t * 0.85 + i * 0.37) % 1;
        px = sx + (i - (n - 1) / 2) * r * 0.5;
        py = sy - r * 0.15 - ph * r * 1.5;
        depth = 1 - ph;
      } else if (d.look === "curse") {
        px = sx + (i - (n - 1) / 2) * r * 0.6;
        py = sy - r * 1.2;
        depth = 0.9;
      } else if (d.look === "unstable") {
        // instavel: fica na fila da maldicao, mas TREME, e o tremor cresce
        // conforme o prazo acaba — o corpo avisa que vai estourar
        const left = d.endAt ? Math.max(0, (d.endAt - t) / (d.duration || 1)) : 0.5;
        const j = (1 - left) * r * 0.22;
        px = sx + (i - (n - 1) / 2) * r * 0.6 + Math.sin(t * 21 + i) * j;
        py = sy - r * 1.2 + Math.cos(t * 17 + i * 2) * j;
        depth = 0.85 + (1 - left) * 0.4;
      } else if (d.look === "doom") {
        const left = d.endAt ? Math.max(0, (d.endAt - t) / (d.duration || 1)) : 0.5;
        px = sx + Math.cos(a) * r * (0.35 + left * 1.3);
        py = sy - r * 0.1 + Math.sin(a) * r * (0.15 + left * 0.5);
        depth = 1.05 - left * 0.35;
      } else {
        px = sx + Math.cos(a) * r * 1.5;
        py = sy - r * 0.1 + Math.sin(a) * r * 0.55;
      }
      const w = r * 0.32 * depth * (1 + pulse * 0.3);
      ctx.globalAlpha = fade * 0.3 * depth;
      ctx.drawImage(blob, px - w, py - w, w * 2, w * 2);
      ctx.globalAlpha = fade * 0.55 * depth;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, 1.2 * depth, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (pulse > 0) {
      const k = 1 - pulse;
      ctx.strokeStyle = `rgba(${hexRgb(col)},${(fade * pulse * 0.5).toFixed(2)})`;
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
    /* The enemy THIS shot was fired at. Without it, `auto_target` with
       `targets: 2` picked two enemies, fired twice... and both shots, born at
       the same point, resolved to the same `nearestEnemy` and went for the same
       creature — the second target was never attacked and the `targets` stat
       did nothing on screen. */
    this.target = o.target || null;
    this.targetGen = this.target ? this.target.gen : 0;
    // Seconds until homing kicks in. > 0 only on a shot born in a fan.
    this.fanDelay = o.fanDelay || 0;
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
    // a borda e a PROPRIA cor indo a zero. Era um roxo cravado, entao todo
    // tiro que nao fosse roxo desbotava para roxo no ultimo pixel — o cometa
    // (a outra metade deste arquivo) sempre fez certo, e ninguem comparou.
    g.addColorStop(1, `rgba(${this.rgb},0)`);
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
    this.spawnedAt = o.spawnedAt || 0;   // abertura do portal / entrada em cena
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
    this.color = o.color || AXIS_PALETTE.cataclysm.base;
    this.rgb = hexRgb(this.color);
    this.source = o.source;
    this.payload = o.payload || null;
    this.follow = o.follow || false;     // gruda no player (auras persistentes)
    this.look = o.look || "fire";        // fatia do aro — ver draw()
    this.onEnd = o.onEnd || null;
    this.dead = false;
  }
  /* Zona com borda, nao mancha. O preenchimento diz "aqui queima" e por isso e
     fraco; quem carrega a informacao e o aro NO RAIO EXATO, que o jogador le
     de relance para saber onde termina o dano. Neblina larga com o mesmo peso
     cobre o chao, esconde inimigo e ainda deixa o limite no chute.

     `look` e a fatia. Era um circulo so para todas as zonas do jogo — chuva de
     fogo, rastro de brasa e miasma desenhavam exatamente a mesma coisa, e como
     cor e predicado do eixo, duas zonas do mesmo eixo saiam identicas. O que
     muda entre as tres nao e a cor nem o raio: e o ARO, porque e ele que
     informa. Fogo tremula, podridao gira em arcos partidos, brasa fica parada
     e tracejada como chao chamuscado.

     O raio nunca muda com o `look`: qualquer estilo que mexesse nele estaria
     mentindo sobre onde o dano pega. */
  draw(ctx, cam) {
    const sx = this.x - cam.left, sy = this.y - cam.top;
    const a = Math.min(1, this.life / 0.4) * 0.5; // fade out no fim
    const R = this.radius;
    const t = this.maxLife - this.life;
    const g = ctx.createRadialGradient(sx, sy, R * 0.2, sx, sy, R);
    g.addColorStop(0, `rgba(${this.rgb},${a * 0.34})`);
    g.addColorStop(0.6, `rgba(${this.rgb},${a * 0.18})`);
    g.addColorStop(1, `rgba(${this.rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();

    if (this.look === "rot") {
      // arcos partidos girando: a zona que APODRECE nao tem borda fixa
      ctx.strokeStyle = `rgba(${this.rgb},${(a * 0.75).toFixed(2)})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a0 = t * 0.55 + (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(sx, sy, R, a0, a0 + 0.72); ctx.stroke();
      }
      return;
    }
    if (this.look === "ash") {
      // tracejado parado: chao chamuscado, nao fogo vivo
      ctx.strokeStyle = `rgba(${this.rgb},${(a * 0.5).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 12) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(sx, sy, R, a0, a0 + 0.24); ctx.stroke();
      }
      return;
    }
    // fogo: aro cheio que tremula. O tremor e no BRILHO e na espessura, nunca
    // no raio — raio piscando seria a zona mentindo sobre o alcance.
    const flick = 0.82 + Math.sin(t * 14 + this.x) * 0.18;
    ctx.strokeStyle = `rgba(${this.rgb},${(a * 0.6 * flick).toFixed(2)})`;
    ctx.lineWidth = 1.5 + flick * 0.8;
    ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.stroke();
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
    this.look = o.look || "rot";     // fatia do orbe de stack — ver Enemy.drawDotOver
    this.removable = o.removable !== false;
    this.permanent = !!o.permanent;
    this.onExpire = o.onExpire || null;
    // a conta vence tambem se o corpo cair antes do prazo (Soul Rupture)
    this.expireOnDeath = !!o.expireOnDeath;
    this.spreadOnContact = !!o.spreadOnContact;
    this.dead = false;
  }
  // dano de um tick, ja com stacks e ramp
  tickDamage(now) {
    const ramp = this.rampPerSec ? 1 + (now - this.bornAt) * this.rampPerSec : 1;
    return this.dps * this.tickInterval * this.stacks * ramp;
  }
}

const ORB_BIRTH = 0.42, ORB_RISE = 13;

class XPOrb {
  constructor() {}
  reset(obj, x, y, value) {
    this.x = x; this.y = y; this.value = value;
    this.magnet = false; // ativado pelo item Ímã de Almas
    /* A alma SAI do corpo. Antes o orbe simplesmente existia no chao no quadro
       seguinte a morte, e a unica recompensa que o jogo entrega em todo abate
       chegava sem ninguem ver de onde. O arco dura menos de meio segundo e nao
       muda a coleta: `birth` so desloca o DESENHO, entao o raio de ima
       continua medido no ponto em que o orbe realmente esta. */
    this.birth = ORB_BIRTH;
  }
  // ímã: acelera em direção ao player quando dentro do pickupRange (ou sempre, se magnet)
  update(dt, player) {
    if (this.birth > 0) this.birth -= dt;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (this.magnet || d < player.pickupRange) {
      const pull = this.magnet ? 560 : 240 + (player.pickupRange - d) * 6;
      this.x += (dx / d) * pull * dt;
      this.y += (dy / d) * pull * dt;
    }
    return d < player.radius + 6; // true = coletado
  }
  // Uma gota, nao um borrao. Centenas de orbes ficam no chao ao mesmo tempo:
  // com um gradiente largo por orbe o piso inteiro vira uma mancha (e um
  // gradiente novo alocado por orbe por frame). Halo fraco cacheado + nucleo
  // solido le como pingo de alma e some do caminho do resto.
  // But the drop is measured in WORLD units and the world is painted into a
  // buffer at 1/PIXEL_UNIT: a 2.1-unit core landed on 0.7 buffer pixels, a
  // sub-pixel dot the renderer had to fade into the floor. It now covers ~3
  // buffer pixels — still far smaller than the 13-unit enemy beside it, so
  // the floor does not turn into a smear when fifty of them drop at once.
  // The drop is blue, not green: green was the Corruption hue, so on a
  // Corruption build the XP on the floor dissolved into the player's own
  // spells. Blue is the one hue no axis owns.
  draw(ctx, cam) {
    // sobe rapido e cai devagar: parabola, nao rampa
    let rise = 0, k = 1;
    if (this.birth > 0) {
      const u = 1 - this.birth / ORB_BIRTH;
      rise = Math.sin(u * Math.PI) * ORB_RISE;
      k = 0.4 + u * 0.6;
    }
    const sx = this.x - cam.left, sy = this.y - cam.top - rise;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.4 * k;
    ctx.drawImage(glowBlob(UI_PAL.xp), sx - 11, sy - 11, 22, 22);
    ctx.restore();
    ctx.fillStyle = UI_PAL.xpNucleo;
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
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
  /* Era um EMOJI desenhado com `fillText` em cima da pixel art: fonte do
     sistema operacional, fora da grade de pixel, e trazendo paleta propria
     (ciano e ambar, as duas cores que a identidade extinguiu). Agora e uma
     das mesmas primitivas geometricas que a UI usa para os icones.

     O tamanho e dado em unidades de MUNDO e so as bordas passam por
     `snapUnit`: assim ele tem o mesmo tamanho aparente onde `PIXEL_GRID` nao
     esta ligado (a galeria) e continua preso a grade dentro do jogo, que e
     onde a camera anda em float e uma borda solta fervilha.

     Osso, e nunca `--osso-600` cheio: o branco puro e reserva do warlock. */
  draw(ctx, cam) {
    const sx = snapUnit(this.x - cam.left);
    const sy = snapUnit(this.y - cam.top - Math.sin(this.bob) * 3);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
    g.addColorStop(0, this.item.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.item.color;
    const r = snapUnit(12), t = PIXEL_GRID * 2;
    if (this.item.art === "anel") {
      ctx.fillRect(sx - r, sy - r, r * 2, t);
      ctx.fillRect(sx - r, sy + r - t, r * 2, t);
      ctx.fillRect(sx - r, sy - r, t, r * 2);
      ctx.fillRect(sx + r - t, sy - r, t, r * 2);
    } else {
      // placa: quadrado com o mesmo chanfro da UI, topo-esq e base-dir
      const c = snapUnit(r * 0.5);
      ctx.fillRect(sx - r + c, sy - r, r * 2 - c, r * 2 - c);
      ctx.fillRect(sx - r, sy - r + c, r * 2 - c, r * 2 - c);
    }
  }
}

/* Duas especies, e a diferenca nao e cosmetica.

   `blob` e a faisca redonda de sempre: ela pertence aos eventos de UI (subir
   de nivel, evolucao, capstone), que sao raros, grandes e acontecem sobre uma
   tela que parou.

   `shard` e um PEDACO DE CORPO. Ele e quadrado, preso ao grid de pixel e nao
   encolhe — encolher um pixel e a operacao que o grid nao sabe fazer, e uma
   bolinha suavizada em cima de arte em grade inteira e o mixel que o resto do
   jogo passou uma fase tirando. Ele tambem CAI: estilhaco que desacelera no ar
   e some le como fumaca, e o que se quer aqui e materia indo ao chao. */
const PART_BLOB = 0, PART_SHARD = 1;
const SHARD_GRAV = 620;
const SHARD_BURST = 5.2;    // velocidade radial por unidade de deslocamento
const SHARD_LIFT = 120;     // empurrao para cima, para o pedaco descrever arco

/* A geometria do desfazimento, separada de quem GUARDA as particulas: o jogo
   entrega um Pool e a galeria entrega um array, e os dois precisam sair
   exatamente iguais — card que redesenha "parecido" e card que mente.

   `emit` recebe os mesmos argumentos de `Particle.reset` menos a especie, que
   e sempre `shard` aqui. Devolve quantos pedacos sairam: zero significa sprite
   sem grade, e ai quem chamou decide o que fazer no lugar. */
function shardBurst(spriteId, cx, cy, drawH, heft, max, emit) {
  const set = spriteShards(spriteId);
  if (!set.length || max <= 0) return 0;
  // o numero sai do porte do corpo, nao do gosto: um ghoul se desfaz em oito
  // pedacos e um Aniquilador em vinte e quatro
  const n = Math.min(set.length, Math.round(8 + heft * 16), max);
  const px = Math.max(1, PIXEL_GRID) * (heft > 0.55 ? 2 : 1);
  const step = set.length / n;
  for (let i = 0; i < n; i++) {
    const c = set[Math.floor(i * step)];
    const ox = c.nx * drawH, oy = c.ny * drawH;
    // velocidade radial a partir do centro: o pedaco sai de onde ele estava
    emit(cx + ox, cy + oy,
         ox * SHARD_BURST + (Math.random() - 0.5) * 60,
         oy * SHARD_BURST - SHARD_LIFT * (0.6 + Math.random() * 0.8),
         0.34 + heft * 0.3 + Math.random() * 0.18, c.color, px);
  }
  return n;
}

class Particle {
  constructor() {}
  reset(obj, x, y, vx, vy, life, color, size, kind) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
    this.kind = kind || PART_BLOB;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.kind === PART_SHARD) {
      this.vx *= 0.965; this.vy *= 0.965;
      this.vy += SHARD_GRAV * dt;
    } else {
      this.vx *= 0.9; this.vy *= 0.9;
    }
    this.life -= dt;
    return this.life <= 0;
  }
  draw(ctx, cam) {
    const a = this.life / this.maxLife;
    if (this.kind === PART_SHARD) {
      // opaco quase ate o fim: o pedaco existe, e entao nao existe mais. Alpha
      // caindo desde o primeiro quadro faz o corpo evaporar em vez de quebrar.
      ctx.globalAlpha = a > 0.34 ? 1 : a / 0.34;
      ctx.fillStyle = this.color;
      ctx.fillRect(snapUnit(this.x - cam.left), snapUnit(this.y - cam.top),
                   this.size, this.size);
      ctx.globalAlpha = 1;
      return;
    }
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
    this.nextChestAt = BALANCE.spawn.chestAt;
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
    // baú avulso: prêmio que não depende de matar boss
    if (game.elapsed >= this.nextChestAt) {
      this.nextChestAt += hard ? B.hardChestEvery : B.chestEvery;
      this.spawnChest(game);
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
    const n = BALANCE.spawn.waveBase + this.ramps * 8;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i;
      const x = game.player.x + Math.cos(a) * reach;
      const y = game.player.y + Math.sin(a) * reach;
      game.enemies.spawn(this.pickType(game.elapsed), x, y, this.scale);
    }
  }
  /* Quem e o chefe da vez sai do dado, nao de um id cravado: todo tipo com
     `boss: true` cujo `minTime` ja passou entra no sorteio. Enquanto era
     `ENEMIES.dreadlord` na mao, acrescentar um segundo chefe era mudar o
     motor; agora e acrescentar uma entrada. */
  bossPool(elapsed) {
    const pool = [];
    for (const id in ENEMIES) {
      const t = ENEMIES[id];
      if (t.boss && elapsed >= t.minTime) pool.push(t);
    }
    return pool;
  }
  spawnBoss(game) {
    const reach = this._reach(game);
    const n = this.bossCount(game.elapsed);
    const pool = this.bossPool(game.elapsed);
    if (!pool.length) return;
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.PI * 2 / n) * i;
      const x = game.player.x + Math.cos(a) * reach;
      const y = game.player.y + Math.sin(a) * reach;
      game.enemies.spawn(pool[(Math.random() * pool.length) | 0], x, y, this.scale);
    }
    game.onBossSpawn(n);
  }
  // Perto o bastante para ser visto, longe o bastante para exigir atravessar a
  // horda: com movimento como único input, o baú é a decisão de posicionamento.
  spawnChest(game) {
    const reach = this._reach(game) * BALANCE.spawn.chestDist;
    const a = Math.random() * Math.PI * 2;
    game.spawnChestAt(game.player.x + Math.cos(a) * reach,
                      game.player.y + Math.sin(a) * reach);
  }
}

