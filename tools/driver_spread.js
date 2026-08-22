/* =========================================================================
   SPREAD — two sibling shots must never read as one shot.

   This driver exists because the defect is invisible from either side of the
   code. `EFFECTS.projectile` draws a correct fan; `updateProjectiles` runs a
   correct homing loop. Together they cancel: homing re-aims every frame, so
   the fan is gone two frames after it opened and the 4 shots of "Salva" travel
   stacked, reading as one fat projectile for the whole run. Nothing throws,
   nothing looks wrong in review, and only the screen tells you.

   What is measured, all of it in real simulation rather than in formulas:

   1. `targets > 1` fires at N DISTINCT enemies. Without a per-shot target the
      siblings are born at the same point, resolve the same `nearestEnemy` and
      all go for the same creature — the stat exists and does nothing.
   2. A shot does not drop the target it was fired at while that target lives.
   3. A dead target is released, and a POOL-RECYCLED object is not mistaken for
      it — the case `hp > 0` cannot catch.
   4. The fan opens wide enough to be seen. The ruler is the projectile's own
      radius, and only the approach counts: measuring past the first impact
      would score overshoot as spread.
   5. A fan with no homing gets no delay — nothing was closing it.
   6. A lone bolt gets no delay either; homing from frame one is Incinerate's
      identity and the fix must not cost it.
   7. A PIERCING shot releases its target on the way through. This one is here
      because it cost 37% of the 7-shot tier's damage before it was found: for
      a piercing projectile, re-seeking after each hit IS what carries it
      through the pack, and pinning the spawn target quietly killed the
      chaining. Nothing throws, and no fan measurement catches it.
   ========================================================================= */
let s = 11;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

const g = new Game(); window.game = g;
let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };
const ok = (m) => console.log("  ok " + m);

function fresh() {
  g.start();
  g.enemies.clear(); g.projectiles.clear();
  g.player.x = 0; g.player.y = 0;
  g.player.dirX = 1; g.player.dirY = 0;
}
// A planted enemy: still, and with enough hp to survive the whole flight.
function put(x, y) {
  const e = g.enemies.spawn(ENEMIES.ghoul, x, y, g.spawner.scale);
  e.speed = 0; e.baseSpeed = 0; e.hp = e.maxHp = 90000;
  return e;
}
function inst() { return g.build.get("incinerate"); }
// `nearestEnemy` only sees through the grid, and the grid is rebuilt inside
// `updateEnemies`, which this driver does not run. Without reindexing the
// trigger finds nobody and the checks pass on an empty list instead of failing.
function reindex() {
  g.grid.clear();
  for (const e of g.enemies.active) g.grid.insert(e);
}
function step(seconds) {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    reindex();
    g.updateProjectiles(dt);
    g.clock += dt;
  }
}

/* --- 1. targets > 1 aims at DIFFERENT enemies --------------------------- */
{
  fresh();
  const p = inst();
  const a = put(300, -40), b = put(300, 40);   // two targets, same distance
  p.r.trigger.targets = 2;
  p.r.stats.targets = 2;
  p.s.nextAt = -1;
  reindex();
  TRIGGERS.auto_target.tick(g, p, 1 / 60, g.clock);
  const shots = g.projectiles.active.slice();
  if (shots.length !== 2) fail(`esperava 2 tiros, veio ${shots.length}`);
  else {
    const tg = new Set(shots.map((s) => s.target));
    if (tg.size !== 2) fail("os 2 tiros de `targets: 2` foram para o MESMO inimigo");
    else if (!tg.has(a) || !tg.has(b)) fail("os tiros nao miraram os dois inimigos plantados");
    else ok("targets: 2 dispara em 2 inimigos distintos");
  }
}

/* --- 2. each shot chases ITS target, not whoever is nearest ------------- */
{
  const shots = g.projectiles.active.slice();
  const before = shots.map((s) => s.target);
  step(0.35);
  let drifted = 0;
  for (let i = 0; i < shots.length; i++) if (shots[i].target !== before[i]) drifted++;
  if (drifted) fail(`${drifted} tiro(s) trocaram de alvo com o alvo ainda vivo`);
  else ok("o tiro nao larga o alvo dele enquanto ele vive");
}

/* --- 3. a dead / recycled target sends the shot back to `nearestEnemy` -- */
{
  fresh();
  const p = inst();
  const victim = put(300, 0);
  p.s.nextAt = -1;
  reindex();
  TRIGGERS.auto_target.tick(g, p, 1 / 60, g.clock);
  const shot = g.projectiles.active[0];
  if (!shot || shot.target !== victim) fail("o tiro nao guardou o alvo");
  else {
    const gen = victim.gen;
    victim.hp = 0; victim.dead = true;
    g.enemies.sweep((e) => e.dead);
    // The next spawn reuses the pooled object: same reference, different
    // creature. This is exactly the case `hp > 0` cannot catch.
    const reborn = put(-900, 0);
    if (reborn !== victim) fail("o pool nao reaproveitou o objeto — o teste nao mede nada");
    else if (reborn.gen === gen) fail("o selo de geracao nao mudou no reuso");
    else {
      step(0.1);
      if (shot.target && shot.targetGen !== shot.target.gen)
        fail("o tiro ficou com selo velho — esta seguindo o objeto, nao o bicho");
      else ok("alvo morto e solto, e o objeto reciclado nao passa por ele");
    }
  }
}

/* --- 4. the fan opens wide enough to be read ---------------------------- */
{
  const R = { 2: 1.5, 4: 4, 7: 8 };   // minimum spread, in projectile radii
  for (const n of [2, 4, 7]) {
    fresh();
    const p = inst();
    const target = put(400, 0);
    p.r.effects[0].count = n;
    p.s.nextAt = -1;
    reindex();
    TRIGGERS.auto_target.tick(g, p, 1 / 60, g.clock);
    const shots = g.projectiles.active.slice();
    if (shots.length !== n) { fail(`count ${n} gerou ${shots.length} tiros`); continue; }
    const radius = shots[0].radius;
    /* Only the OUTBOUND flight counts. After impact whatever is left flies
       past the target and orbits it, which inflates the number with spread the
       player never read as a fan — it would score overshoot as opening. */
    let span = 0, hitAt = -1;
    for (let f = 0; f < 90; f++) {
      step(1 / 60);
      const live = shots.filter((s) => g.projectiles.active.includes(s));
      if (live.length < shots.length) { hitAt = f; break; }  // someone connected
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++)
          span = Math.max(span, Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y));
    }
    const inR = span / radius;
    if (inR < R[n]) fail(`leque de ${n}: abre so ${inR.toFixed(1)} raios (min ${R[n]}) — le como um tiro so`);
    else if (hitAt < 0) fail(`leque de ${n}: nenhum tiro acertou em 1,5s — a medida nao e voo de ida`);
    else ok(`leque de ${n} abre ${inR.toFixed(1)} raios (${span.toFixed(0)} un), 1o impacto em ${(hitAt / 60).toFixed(2)}s`);
  }
}

/* --- 5. a shot with NO homing gets no delay ----------------------------
   Chaos Bolt (the evolution) fires up to 5 at once and does not chase. Nothing
   there was closing the fan, so nothing there needs a delay — adding one would
   be changing what already worked. */
{
  fresh();
  const p = inst();
  put(400, 0);
  p.r.effects[0].homing = false;
  p.r.effects[0].count = 5;
  p.s.nextAt = -1;
  reindex();
  TRIGGERS.auto_target.tick(g, p, 1 / 60, g.clock);
  const late = g.projectiles.active.filter((s) => s.fanDelay > 0);
  if (late.length) fail(`${late.length} tiro(s) sem homing nasceram com atraso`);
  else ok("leque sem homing nao ganha atraso");
}

/* --- 6. a piercing shot lets go of its target as it goes through ------- */
{
  fresh();
  const p = inst();
  // two enemies in a line: the shot pierces the first and must re-seek
  const first = put(240, 0);
  put(430, 0);
  p.r.effects[0].count = 1;
  p.r.effects[0].pierce = 2;
  p.s.nextAt = -1;
  reindex();
  TRIGGERS.auto_target.tick(g, p, 1 / 60, g.clock);
  const shot = g.projectiles.active[0];
  if (!shot || shot.pierce !== 2) fail("o tiro nao nasceu perfurante");
  else {
    let pierced = false;
    for (let f = 0; f < 90 && !shot.dead; f++) {
      const before = shot.pierce;
      step(1 / 60);
      if (shot.pierce < before) {
        pierced = true;
        if (shot.target === first)
          fail("o tiro perfurou e continuou preso ao alvo que ja atravessou");
        break;
      }
    }
    if (!pierced) fail("o tiro nao chegou a perfurar — o teste nao mede nada");
    else if (!fails) ok("tiro perfurante solta o alvo ao atravessar");
  }
}

/* --- 7. a lone bolt gets no delay: Incinerate stays stubborn ------------ */
{
  fresh();
  const p = inst();
  put(400, 0);
  p.r.effects[0].count = 1;
  p.s.nextAt = -1;
  reindex();
  TRIGGERS.auto_target.tick(g, p, 1 / 60, g.clock);
  const shot = g.projectiles.active[0];
  if (shot.fanDelay !== 0) fail(`bala solta nasceu com fanDelay ${shot.fanDelay} — perdeu a teimosia`);
  else ok("bala solta homa desde o primeiro frame");
}

if (fails) throw new Error(`${fails} falha(s) no leque/alvo de projetil`);
console.log("\nok  leque e alvo de projetil validados");
