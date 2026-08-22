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

for (const cid in CAPSTONES) {
  const cap = CAPSTONES[cid];
  const hookNames = Object.values(cap.on || {});
  if (!hookNames.length) { console.log(`  -- ${cap.name}: sem hook (só global)`); continue; }
  g.start();
  for (const id of PIECES_ALL) g.build.acquirePiece(id);
  for (const a in cap.req) g.build.axis[a] = cap.req[a];
  g.build.checkCapstones();
  g.build.afterChange();
  for (const n of hookNames) delete calls[n];
  populate(40);
  simulate(14);
  const fired = hookNames.filter((n) => calls[n] > 0);
  if (fired.length !== hookNames.length) {
    console.error(`  X ${cap.name}: hook(s) nunca dispararam: ${hookNames.filter((n) => !calls[n]).join(", ")}`);
    fails++;
  } else {
    console.log(`  ok ${cap.name.padEnd(12)} ${hookNames.map((n) => n + "×" + calls[n]).join(" ")}`);
  }
}

for (const pid in PASSIVES) {
  const p = PASSIVES[pid];
  const hookNames = Object.values(p.on || {});
  if (!hookNames.length) continue;
  g.start();
  for (const id of PIECES_ALL) g.build.acquirePiece(id);
  g.build.acquirePassive(pid);
  for (const n of hookNames) delete calls[n];
  populate(40);
  simulate(28);
  const missing = hookNames.filter((n) => !calls[n]);
  if (missing.length) { console.error(`  X ${p.name}: hook nunca disparou: ${missing.join(", ")}`); fails++; }
  else console.log(`  ok ${p.name.padEnd(14)} ${hookNames.map((n) => n + "×" + calls[n]).join(" ")}`);
}

// pecas cujo efeito e um hook
console.log("--- hooks de peça ---");
for (const key of ["healthstone", "soulstone", "demonicCircle"]) {
  g.start();
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
