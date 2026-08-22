"use strict";
/* =========================================================================
   EFFECTS — o QUE acontece. Componiveis: uma peca e uma lista de efeitos, e
   qualquer efeito pode carregar outra lista (`onHit`, `onTick`, `onExpire`),
   entao um DoT que ao expirar invoca um demonio e so aninhamento de dado.

   Contrato: NENHUM efeito toca `ctx.` do canvas. Efeito emite fato; a camada
   de render (js/render/vfx.js) consome. Ver game.emitVfx().

   Assinatura: fn(game, eff, c) onde `c` e o contexto reaproveitado:
     c.key      key da peca dona (vira o `source` do dano — meio e anti-recursao)
     c.color    cor para os eventos visuais
     c.x, c.y   origem do efeito
     c.target   Enemy alvo (pode ser null)
     c.dirX/Y   direcao (triggers directional / movimento do player)
     c.amount   valor produzido pelo passo anterior (heal por fracao, chain)
     c.now      relogio de simulacao
   ========================================================================= */

// Pilha de contextos reaproveitados: efeitos aninhados nao alocam por acerto.
function pushCtx(game) {
  const s = game._fxStack;
  let c = s[game._fxDepth];
  if (!c) c = s[game._fxDepth] = {};
  game._fxDepth++;
  return c;
}
function popCtx(game) { game._fxDepth--; }

// Copia o contexto de origem e sobrescreve o alvo. Usado por efeitos em area.
function childCtx(game, c, target, amount) {
  const n = pushCtx(game);
  n.key = c.key; n.color = c.color; n.now = c.now;
  n.dirX = c.dirX; n.dirY = c.dirY;
  n.target = target;
  n.x = target ? target.x : c.x;
  n.y = target ? target.y : c.y;
  n.amount = amount != null ? amount : c.amount;
  return n;
}

function runEffects(game, list, c) {
  if (!list || !list.length) return;
  if (game._fxDepth > MAX_FX_DEPTH) return;   // backstop: cadeia patologica
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    // Cada caminho de upgrade escreve num indice reservado, entao a lista pode
    // ter buracos quando so um dos caminhos foi comprado.
    if (!e) continue;
    const fn = EFFECTS[e.type];
    if (fn) fn(game, e, c);
  }
}

/* Coleta alvos de um efeito: em raio se `radius`, senao o alvo do contexto.
   Um buffer POR PROFUNDIDADE: um `onHit` aninhado coleta os seus alvos sem
   sobrescrever a lista que o efeito de fora ainda esta percorrendo. Sem isso
   seria preciso copiar a lista a cada acerto — alocacao em codigo quente. */
function effectTargets(game, e, c) {
  const d = game._fxDepth;
  let out = game._fxTargets[d];
  if (!out) out = game._fxTargets[d] = [];
  out.length = 0;
  if (e.radius > 0) {
    const r = e.radius, x = e.atTarget && c.target ? c.target.x : c.x,
          y = e.atTarget && c.target ? c.target.y : c.y;
    game.grid.forRadius(x, y, r, (en) => {
      if (en.hp <= 0 || en.charmed) return;
      if (e.onlyDotted && !en.dots.length) return;
      const dx = en.x - x, dy = en.y - y, rr = r + en.radius;
      if (dx * dx + dy * dy <= rr * rr) out.push(en);
    });
    if (e.maxTargets > 0 && out.length > e.maxTargets) out.length = e.maxTargets;
  } else if (c.target && c.target.hp > 0) {
    if (!e.onlyDotted || c.target.dots.length) out.push(c.target);
  }
  return out;
}

/* Dois projeteis que saem da MESMA boca no MESMO instante na mesma direcao
   leem como um projetil so: o de tras fica escondido atras do da frente a run
   inteira. O leque de um unico disparo ja e separado por `spread`, mas nada
   separava disparos IRMAOS — `auto_target` com `targets > 1` chama este efeito
   uma vez por alvo no mesmo instante, e dois alvos na mesma direcao devolviam
   tiros sobrepostos. Da mesma forma duas pecas nao podem ser separadas aqui: a
   rajada e identificada por (key, origem, instante), entao demonio nenhum tem
   o tiro desviado por causa de um irmao que atira do outro lado do campo.

   O registro e um objeto unico reaproveitado — codigo quente, zero alocacao
   por disparo. */
const PROJ_BURST = { key: null, x: 0, y: 0, now: -1, angles: [] };

// Menor angulo com sinal entre dois rumos, em [-PI, PI].
function angleDelta(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* Devolve um rumo livre: desliza `a` para fora de todo rumo ja tomado na
   rajada e fica com o lado que exigiu menos desvio. O deslize e monotonico de
   proposito — empurrar para o vizinho mais proximo a cada passo oscila entre
   dois rumos ocupados e nunca converge; aqui cada passada so anda para frente,
   entao ela termina em no maximo uma volta por tiro ja colocado.

   Tudo e medido como deslocamento em relacao ao rumo pedido (`angleDelta`),
   entao a conta vira 1-D e o problema de dar a volta no circulo some.

   `minSep` fica um pouco ABAIXO do passo do leque de proposito: o leque que a
   peca desenhou ja esta correto e nao pode ser reaberto por erro de ponto
   flutuante — quem desvia e so quem colide de verdade. */
function claimAngle(a, minSep) {
  const list = PROJ_BURST.angles;
  if (minSep > 0 && list.length) {
    let up = 0, down = 0;
    for (let guard = 0; guard <= list.length; guard++) {
      let moved = false;
      for (let i = 0; i < list.length; i++) {
        const o = angleDelta(list[i], a);
        if (up > o - minSep && up < o + minSep) { up = o + minSep; moved = true; }
      }
      if (!moved) break;
    }
    for (let guard = 0; guard <= list.length; guard++) {
      let moved = false;
      for (let i = 0; i < list.length; i++) {
        const o = angleDelta(list[i], a);
        if (down > o - minSep && down < o + minSep) { down = o - minSep; moved = true; }
      }
      if (!moved) break;
    }
    a += up <= -down ? up : down;
  }
  list.push(a);
  return a;
}

const EFFECTS = {

  /* --- dano ------------------------------------------------------------- */

  damage_instant(game, e, c) {
    const targets = effectTargets(game, e, c);
    if (!targets.length) return;
    const crit = e.crit > 0 && Math.random() < e.crit;
    let amt = (e.amount || 0) * (e.mul || 1);
    if (crit) amt *= e.critMul || 2;
    const list = targets;
    for (let i = 0; i < list.length; i++) {
      const en = list[i];
      if (en.hp <= 0) continue;
      const dealt = game.damageEnemy(en, amt, c.key, crit || e.big);
      if (e.onHit) { const n = childCtx(game, c, en, dealt); runEffects(game, e.onHit, n); popCtx(game); }
    }
    c.amount = amt;
    if (e.radius > 0) game.emitVfx("burst", c.x, c.y, e.radius, c.color);
  },

  // Executa alvos abaixo de um limiar de vida; fora dele, dano reduzido.
  execute(game, e, c) {
    const targets = effectTargets(game, e, c);
    for (let i = 0; i < targets.length; i++) {
      const en = targets[i];
      if (en.hp <= 0) continue;
      const below = en.hp / en.maxHp <= (e.threshold || 0.2);
      const amt = below ? (e.amount || 0) * (e.executeMul || 4) : (e.amount || 0);
      game.damageEnemy(en, amt, c.key, below);
      if (below) game.emitVfx("execute", en.x, en.y, en.radius * 2, c.color);
    }
  },

  /* --- projetil ---------------------------------------------------------- */

  projectile(game, e, c) {
    let base;
    if (e.useDir) base = Math.atan2(c.dirY, c.dirX);
    else if (c.target) base = Math.atan2(c.target.y - c.y, c.target.x - c.x);
    else base = Math.atan2(c.dirY, c.dirX);

    const n = Math.max(1, Math.round(e.count || 1));
    const spread = e.spread != null ? e.spread : 0.14;
    const sp = e.speed || 480;

    // Mesma boca, mesmo instante, mesma peca = mesma rajada.
    if (PROJ_BURST.key !== c.key || PROJ_BURST.now !== c.now ||
        PROJ_BURST.x !== c.x || PROJ_BURST.y !== c.y) {
      PROJ_BURST.key = c.key; PROJ_BURST.now = c.now;
      PROJ_BURST.x = c.x; PROJ_BURST.y = c.y;
      PROJ_BURST.angles.length = 0;
    }
    const minSep = spread * 0.9;

    for (let i = 0; i < n; i++) {
      const a = claimAngle(base + (i - (n - 1) / 2) * spread, minSep);
      game.projectiles.spawn({
        x: c.x, y: c.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        speed: sp,
        damage: e.damage || 0,
        radius: e.radius || 6,
        color: e.color || c.color,
        source: c.key,
        payload: e.onHit || null,
        life: e.life || 2.4,
        pierce: e.pierce || 0,
        homing: !!e.homing,
        turnRate: e.turnRate || 0,
        trail: e.trail || 0,
      });
    }
  },

  /* --- efeitos persistentes --------------------------------------------- */

  damage_over_time(game, e, c) {
    const targets = effectTargets(game, e, c);
    for (let i = 0; i < targets.length; i++) {
      game.dots.apply(targets[i], e, c);
    }
  },

  area_persistent(game, e, c) {
    const x = e.atTarget && c.target ? c.target.x : c.x;
    const y = e.atTarget && c.target ? c.target.y : c.y;
    const jitter = e.jitter || 0;
    const n = Math.max(1, Math.round(e.count || 1));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * jitter;
      game.areas.spawn({
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        radius: e.radius || 60,
        dps: e.dps || 0,
        life: e.duration || 3,
        tickInterval: e.tickInterval || 0.35,
        color: e.color || c.color,
        source: c.key,
        payload: e.onTick || null,
        follow: !!e.follow,
        onEnd: e.onEnd || null,
      });
    }
  },

  summon(game, e, c) {
    game.minions.summon(e, c);
  },

  /* Pure visual. Lets a piece mark a moment — a gate tearing open on arrival —
     without inventing an effect that also changes state. */
  vfx(game, e, c) {
    game.emitVfx(e.kind || "burst", c.x, c.y, e.radius || 40, e.color || c.color);
  },

  /* --- suporte ----------------------------------------------------------- */

  heal(game, e, c) {
    const amt = e.frac != null ? (c.amount || 0) * e.frac : (e.amount || 0);
    game.healPlayer(amt);
  },

  shield(game, e, c) {
    const amt = e.frac != null ? (c.amount || 0) * e.frac : (e.amount || 0);
    game.player.addShield(amt, e.cap);
  },

  /* --- controle ---------------------------------------------------------- */

  slow(game, e, c) {
    const targets = effectTargets(game, e, c);
    const until = c.now + (e.duration || 2);
    for (let i = 0; i < targets.length; i++) {
      const en = targets[i];
      en.slowUntil = Math.max(en.slowUntil, until);
      en.slowFactor = Math.min(en.slowFactor === 1 ? 1 : en.slowFactor, e.factor || 0.6);
    }
  },

  stun(game, e, c) {
    const targets = effectTargets(game, e, c);
    const until = c.now + (e.duration || 1);
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].type.boss && !e.affectsBoss) continue;
      targets[i].stunUntil = Math.max(targets[i].stunUntil, until);
    }
    if (e.radius > 0) game.emitVfx("shock", c.x, c.y, e.radius, c.color);
  },

  fear(game, e, c) {
    const targets = effectTargets(game, e, c);
    const until = c.now + (e.duration || 1.5);
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].type.boss && !e.affectsBoss) continue;
      targets[i].fearUntil = Math.max(targets[i].fearUntil, until);
    }
  },

  // Reduz a cadencia de ataque e o dano de contato do alvo (Curse of Tongues).
  weaken(game, e, c) {
    const targets = effectTargets(game, e, c);
    const until = c.now + (e.duration || 3);
    for (let i = 0; i < targets.length; i++) {
      const en = targets[i];
      en.weakUntil = Math.max(en.weakUntil || 0, until);
      en.weakFactor = e.factor || 0.6;
    }
  },

  knockback(game, e, c) {
    const targets = effectTargets(game, e, c);
    const f = e.force || 120;
    for (let i = 0; i < targets.length; i++) {
      const en = targets[i];
      const dx = en.x - c.x, dy = en.y - c.y, d = Math.hypot(dx, dy) || 1;
      en.x += (dx / d) * f; en.y += (dy / d) * f;
    }
  },

  // Amplifica todo dano recebido pelo alvo enquanto durar (Haunt).
  mark(game, e, c) {
    const targets = effectTargets(game, e, c);
    for (let i = 0; i < targets.length; i++) {
      targets[i].marked = Math.max(targets[i].marked, e.amp || 0.25);
      targets[i].markedUntil = c.now + (e.duration || 4);
    }
  },

  // Puxa inimigos para o ponto do efeito (aggro do Voidwalker).
  pull(game, e, c) {
    const targets = effectTargets(game, e, c);
    const f = e.force || 60;
    for (let i = 0; i < targets.length; i++) {
      const en = targets[i];
      if (en.type.boss) continue;
      const dx = c.x - en.x, dy = c.y - en.y, d = Math.hypot(dx, dy) || 1;
      en.x += (dx / d) * f; en.y += (dy / d) * f;
    }
  },

  // Converte um inimigo em aliado temporario (Enslave Demon).
  convert(game, e, c) {
    const targets = effectTargets(game, e, c);
    if (!targets.length) return;
    game.convertEnemy(targets[0], e.duration || 8, c);
  },

  /* --- auto-aplicados ----------------------------------------------------- */

  // Buff de velocidade com validade: renovado a cada pulso da aura que o usa,
  // entao ele cai sozinho se a peca parar de disparar.
  self_speed(game, e, c) {
    game.player.speedBoost = e.factor || 1;
    game.player.speedBoostUntil = c.now + (e.duration || 0.5);
  },

  /* Dano na propria vida (Burning Rush). Nao aciona os reativos de "tomei
     dano": queimar-se nao e levar porrada.

     NUNCA mata. Sem input manual o jogador nao tem como desligar um dreno
     permanente, entao dreno letal transforma a peca em carta-armadilha —
     medido, ela sozinha respondia por 4 de cada 5 mortes antes dos 3 minutos.
     Com o piso, o custo vira "voce vive com pouca vida e fragil", que e
     tensao de verdade em vez de uma escolha que perde a run na hora. */
  self_damage(game, e, c) {
    const p = game.player;
    const amt = e.frac ? p.maxHp * e.frac : (e.amount || 0);
    if (amt <= 0) return;
    const floor = e.floor != null ? e.floor : p.maxHp * 0.12;
    if (p.hp <= floor) return;
    p.hp = Math.max(floor, p.hp - amt);
  },

  // Desmancha projeteis hostis no raio (Nether Ward).
  reflect(game, e, c) {
    game.reflectProjectiles(c.x, c.y, e.radius || 140, e.damage || 0,
                            e.blastRadius || 0, c);
  },

  /* --- propagacao -------------------------------------------------------- */

  // Espalha os DoTs do alvo do contexto para os vizinhos.
  spread_on_death(game, e, c) {
    if (!c.target) return;
    game.dots.spreadFrom(c.target, e.radius || 80, e.full !== false, e.maxTargets || 0);
  },

  // Salta o dano/DoT para o inimigo mais proximo que ainda nao foi tocado.
  chain(game, e, c) {
    if (!c.target) return;
    const next = game.nearestEnemyExcept(c.target.x, c.target.y, e.range || 140, c.target);
    if (!next) return;
    const n = childCtx(game, c, next, (c.amount || 0) * (e.falloff || 0.6));
    runEffects(game, e.effects, n);
    popCtx(game);
  },

  /* --- escotilha de escape ----------------------------------------------
     Comportamento que honestamente nao cabe em dado declarativo mora em
     js/hooks.js, nomeado, referenciado por string. Um lugar auditavel em vez
     de `if` espalhado dentro das pecas. */
  hook(game, e, c) {
    const fn = HOOKS[e.name];
    if (fn) fn(game, e, c);
  },
};
