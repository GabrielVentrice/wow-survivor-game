// --- valida o registry antes de simular -----------------------------------

let problems = 0;
const bad = (m) => { console.error("  X " + m); problems++; };

const walkEffects = (list, where) => {
  if (!list) return;
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    if (e.type && !EFFECTS[e.type]) bad(`${where}: efeito desconhecido "${e.type}"`);
    for (const k of ["onHit", "onTick", "onExpire", "onEnd", "effects"]) {
      if (e[k]) walkEffects(e[k], where + "." + k);
    }
    if (e.projectile) walkEffects([e.projectile], where + ".projectile");
    if (e.type === "hook" && !HOOKS[e.name]) bad(`${where}: hook desconhecido "${e.name}"`);
    if (e.type === "summon" && e.kind && !MINIONS[e.kind]) bad(`${where}: minion desconhecido "${e.kind}"`);
  }
};

for (const id in PIECES) {
  const p = PIECES[id];
  if (!p.key) bad(`${id}: sem key`);
  if (!AXES[p.axis]) bad(`${id}: axis invalido "${p.axis}"`);
  if (!TRIGGERS[p.trigger.type]) bad(`${id}: trigger desconhecido "${p.trigger.type}"`);
  if (!p.paths || Object.keys(p.paths).length !== 3) bad(`${id}: precisa de 3 caminhos`);
  for (const pid in p.paths || {}) {
    const pth = p.paths[pid];
    if (!pth.tiers || pth.tiers.length !== PATH_RULES.tiers) {
      bad(`${id}.${pid}: ${pth.tiers ? pth.tiers.length : 0} tiers (esperado ${PATH_RULES.tiers})`);
    }
    if (pth.evolvesInto) {
      const evo = PIECES[pth.evolvesInto];
      if (!evo) bad(`${id}.${pid}: evolui para "${pth.evolvesInto}" inexistente`);
      else {
        if (evo.key !== p.key) bad(`${id}.${pid}: evolucao ${evo.id} tem key "${evo.key}" != "${p.key}"`);
        for (const k in p.paths) if (!evo.paths[k]) bad(`${evo.id}: falta o caminho "${k}" da forma base`);
      }
    }
    for (const t of pth.tiers || []) {
      if (!t.name) bad(`${id}.${pid}: tier sem nome`);
      if (t.mods) for (const k in t.mods) {
        if (!(k in p.stats)) bad(`${id}.${pid}/${t.name}: mod no stat inexistente "${k}"`);
      }
    }
  }
  walkEffects(p.effects, id);
  const rq = p.requires;
  if (rq) {
    if (rq.piece && !Object.values(PIECES).some((o) => o.key === rq.piece)) {
      bad(`${id}: requires.piece "${rq.piece}" nao e key de nenhuma peca`);
    }
    if (rq.tag && !Object.values(PIECES).some((o) => (o.tags || []).indexOf(rq.tag) >= 0 && o.key !== p.key)) {
      bad(`${id}: requires.tag "${rq.tag}" nao existe em nenhuma outra peca`);
    }
  }
}
for (const id in PASSIVES) {
  const on = PASSIVES[id].on || {};
  for (const ev in on) if (!HOOKS[on[ev]]) bad(`passiva ${id}: hook "${on[ev]}" nao existe`);
}
for (const id in CAPSTONES) {
  const on = CAPSTONES[id].on || {};
  for (const ev in on) if (!HOOKS[on[ev]]) bad(`capstone ${id}: hook "${on[ev]}" nao existe`);
}
console.log(problems ? `X   ${problems} problemas no registry` : "ok  registry validado");

// --- simula ---------------------------------------------------------------
const g = new Game();
window.game = g;

let s = Number(__argv[1] || 1);
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
Math.random = rnd;

g.selectedSpeed = 3;
g.start();

let levelUps = 0;
g.ui.openLevelUp = function () {
  const offers = g.build.getOffers(3);
  if (!offers.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
  levelUps++;
  g.ui.applyOffer(offers[Math.floor(rnd() * offers.length)]);
};
g.ui.openChest = function () { g.state = STATE.PLAYING; };

const DT = 1 / 60;
const MINUTES = Number(__argv[2] || 12);
const steps = Math.round((MINUTES * 60) / DT / 3);
const peak = { enemies: 0, dots: 0, minions: 0, proj: 0, areas: 0 };
const t0 = __now();
try {
  for (let i = 0; i < steps; i++) {
    g.player.hp = g.player.maxHp;                 // imortal: queremos ver o late game
    const stand = ((i / 600) % 1) > 0.7;          // alterna andar/parar: exercita rooted e trail
    const ang = i * 0.01;
    g.input.keys = new Set(stand ? [] : [Math.cos(ang) > 0 ? "d" : "a", Math.sin(ang) > 0 ? "s" : "w"]);
    let total = DT * g.timeScale;
    while (total > 0) { const st = Math.min(0.025, total); g.update(st); total -= st; }
    peak.enemies = Math.max(peak.enemies, g.enemies.active.length);
    peak.dots = Math.max(peak.dots, g.dots.active.length);
    peak.minions = Math.max(peak.minions, g.minions.active.length);
    peak.proj = Math.max(peak.proj, g.projectiles.active.length);
    peak.areas = Math.max(peak.areas, g.areas.active.length);
  }
} catch (e) {
    console.error(`\nERRO EM RUNTIME aos ${g.elapsed.toFixed(1)}s de jogo:\n${e.stack}`);
  __exit(1);
}

const ms = __now() - t0;
const b = g.build;
let totalDmg = 0;
for (const v of g.damageBy.values()) totalDmg += v;
console.log(`ok  ${MINUTES} min simulados em ${ms}ms`);
console.log(`    nivel ${g.player.level}, ${levelUps} escolhas, ${g.player.kills} abates, ${(totalDmg / 1e3).toFixed(0)}k de dano`);
console.log(`    eixos ${b.axis.corruption}/${b.axis.dominion}/${b.axis.cataclysm} (pool ${b.axisTotal}/${AXIS_RULES.pool})`);
console.log(`    pecas: ${[...b.pieces.values()].map((i) => i.def.name + "[" + Object.values(i.paths).join("") + "]").join(", ") || "—"}`);
console.log(`    passivas: ${[...b.passives.keys()].join(", ") || "—"}`);
console.log(`    capstones: ${[...b.capstones].join(", ") || "—"}`);
console.log(`    picos: ${peak.enemies} inimigos, ${peak.dots} dots, ${peak.minions} demonios, ${peak.proj} projeteis, ${peak.areas} areas`);
if (problems) __exit(1);
