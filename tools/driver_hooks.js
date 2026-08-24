/* Driver 3: cada capstone/passiva com hook precisa REALMENTE disparar.
   Ativar sem crashar nao prova nada — o hook pode nunca ser chamado. */
let s = 11;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

const calls = {};
for (const name in HOOKS) {
  const fn = HOOKS[name];
  HOOKS[name] = function (...a) { calls[name] = (calls[name] || 0) + 1; return fn.apply(null, a); };
}

const g = new Game();
window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
// A etapa tambem PARA o update: sem resolve-la o driver rodaria ate o
// primeiro marco e chamaria de minutos. Quem mede etapa e `driver_milestone`.
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };

// Alvos duros e espalhados: sem isso a horda morre antes de qualquer DoT
// vencer a duracao, e todo hook de `dot_expired` parece morto sem estar.
function populate(n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 120 + (i % 9) * 40;
    // metade dura (para os DoTs vencerem a duracao) e metade fraca (para
    // alguem morrer carregando DoT — que e o gatilho da Colheita)
    const e = g.enemies.spawn(ENEMIES.abomination, g.player.x + Math.cos(a) * d,
                              g.player.y + Math.sin(a) * d, g.spawner.scale);
    e.hp = e.maxHp = i % 2 ? 6000 : 220;
  }
}
function simulate(sec) {
  g.spawner.interval = 1e9;   // so os alvos do teste
  const steps = Math.round(sec / 0.025);
  for (let i = 0; i < steps; i++) {
    g.player.hp = g.player.maxHp * 0.25;   // vida baixa: acorda os reativos de emergencia
    // andar de verdade faz os alvos trocarem, e e a troca de alvo que deixa
    // um DoT vencer sem ser reaplicado
    g.input.keys = new Set(((i / 200) % 1) > 0.75 ? [] : [((i / 400) % 1) > 0.5 ? "a" : "d", "s"]);
    if (g.enemies.active.length < 16) populate(16);
    g.update(0.025);
  }
}

let fails = 0;
const PIECES_ALL = ["corruption", "immolate", "wildImps", "felguard", "incinerate",
                    "agony", "rainOfFire", "unstableAffliction", "shadowburn"];

/* Colheita exige uma condicao especifica (inimigo com 3+ DoTs MORRENDO) que
   uma simulacao aleatoria pode nao produzir. Provocamos a condicao a mao: o
   que interessa e o mecanismo, nao a sorte do seed. */
function testColheita(cap) {
  g.start(STARTER_TESTE);
  for (const id of PIECES_ALL) g.build.acquirePiece(id);
  for (const a in cap.req) g.build.axis[a] = cap.req[a];
  g.build.checkCapstones();
  g.build.afterChange();
  const e = g.enemies.spawn(ENEMIES.abomination, g.player.x + 90, g.player.y, g.spawner.scale);
  g.grid.clear(); g.grid.insert(e);
  const c = { key: "teste", color: "#7fdc4a", now: g.clock, x: e.x, y: e.y, target: e };
  for (const k of ["a", "b", "c"]) {
    g.dots.apply(e, { key: k, dps: 5, duration: 9, tickInterval: 1,
                      stacking: { mode: "refresh", max: 1 } }, c);
  }
  if (e.dots.length < 3) { console.error("  X Colheita: setup nao aplicou 3 DoTs"); fails++; return; }
  // vizinhos para receber o que se espalha
  for (let i = 0; i < 5; i++) {
    const o = g.enemies.spawn(ENEMIES.abomination, e.x + 30 + i * 12, e.y + 10, g.spawner.scale);
    o.hp = o.maxHp = 5000;
    g.grid.insert(o);
  }
  delete calls.colheita;
  e.hp = 0;
  g.killDeadEnemies();
  if (!calls.colheita) { console.error("  X Colheita: nao disparou com 3 DoTs num inimigo que morreu"); fails++; }
  else console.log(`  ok ${cap.name.padEnd(12)} colheita×${calls.colheita} (condicao provocada: 3 DoTs + morte)`);
}

for (const cid in CAPSTONES) {
  const cap = CAPSTONES[cid];
  const hookNames = Object.values(cap.on || {});
  if (!hookNames.length) { console.log(`  -- ${cap.name}: sem hook (só global)`); continue; }
  if (cid === "colheita") { testColheita(cap); continue; }
  g.start(STARTER_TESTE);
  for (const id of PIECES_ALL) g.build.acquirePiece(id);
  for (const a in cap.req) g.build.axis[a] = cap.req[a];
  g.build.checkCapstones();
  g.build.afterChange();
  for (const n of hookNames) delete calls[n];
  populate(40);
  simulate(14);
  // Ceifador e Chamador dependem de um DoT vencendo a duracao num alvo VIVO —
  // e o Chamador exige que seja o de Immolate. A simulacao produz isso as
  // vezes; o teste nao pode depender do seed.
  if (cap.on && cap.on.dot_expired && !calls[cap.on.dot_expired]) {
    provokeDotExpiry(cid === "chamador" ? "immolate" : null);
  }
  const fired = hookNames.filter((n) => calls[n] > 0);
  if (fired.length !== hookNames.length) {
    console.error(`  X ${cap.name}: hook(s) nunca dispararam: ${hookNames.filter((n) => !calls[n]).join(", ")}`);
    fails++;
  } else {
    console.log(`  ok ${cap.name.padEnd(12)} ${hookNames.map((n) => n + "×" + calls[n]).join(" ")}`);
  }
}

/* Provoca a expiracao natural de um DoT: inimigo duro o bastante para nao
   morrer, DoT curto, relogio adiantado. Alguns hooks dependem dessa condicao
   exata e uma simulacao aleatoria pode passar minutos sem produzi-la. */
function provokeDotExpiry(dotKey) {
  const e = g.enemies.spawn(ENEMIES.abomination, g.player.x + 200, g.player.y, g.spawner.scale);
  e.hp = e.maxHp = 1e7;
  const o = g.enemies.spawn(ENEMIES.abomination, e.x + 40, e.y, g.spawner.scale);
  o.hp = o.maxHp = 1e7;
  g.grid.clear(); g.grid.insert(e); g.grid.insert(o);
  const c = { key: "teste", color: "#7fdc4a", now: g.clock, x: e.x, y: e.y, target: e };
  g.dots.apply(e, { key: dotKey || "prova", dps: 4, duration: 1, tickInterval: 0.5,
                    stacking: { mode: "refresh", max: 1 } }, c);
  for (let i = 0; i < 40; i++) { g.clock += 0.05; g.dots.update(g.clock); }
}

for (const pid in PASSIVES) {
  const p = PASSIVES[pid];
  const hookNames = Object.values(p.on || {});
  if (!hookNames.length) continue;
  g.start(STARTER_TESTE);
  for (const id of PIECES_ALL) g.build.acquirePiece(id);
  g.build.acquirePassive(pid);
  for (const n of hookNames) delete calls[n];
  populate(40);
  simulate(28);
  if (p.on && p.on.dot_expired && !calls[p.on.dot_expired]) provokeDotExpiry();
  const missing = hookNames.filter((n) => !calls[n]);
  if (missing.length) { console.error(`  X ${p.name}: hook nunca disparou: ${missing.join(", ")}`); fails++; }
  else console.log(`  ok ${p.name.padEnd(14)} ${hookNames.map((n) => n + "×" + calls[n]).join(" ")}`);
}

// pecas cujo efeito e um hook
console.log("--- hooks de peça ---");
for (const key of ["healthstone", "soulstone", "demonicCircle"]) {
  g.start(STARTER_TESTE);
  g.build.acquirePiece(key);
  const inst = g.build.get(PIECES[key].key);
  const names = [];
  const scan = (l) => { for (const e of l || []) { if (!e) continue;
    if (e.type === "hook") names.push(e.name);
    for (const k of ["onHit","onTick","onExpire","onEnd","effects"]) if (e[k]) scan(e[k]); } };
  scan(inst.r.effects);
  for (const n of names) delete calls[n];
  populate(40);
  simulate(20);
  const missing = names.filter((n) => !calls[n]);
  if (missing.length) { console.error(`  X ${PIECES[key].name}: ${missing.join(", ")} nunca disparou`); fails++; }
  else console.log(`  ok ${PIECES[key].name.padEnd(16)} ${names.map((n) => n + "×" + calls[n]).join(" ")}`);
}

console.log(fails ? `\nX ${fails} hooks mortos` : "\nok todos os hooks disparam de verdade");
if (fails) __exit(1);
