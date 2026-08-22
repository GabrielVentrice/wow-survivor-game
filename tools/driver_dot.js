/* Teste direto do DotSystem: aplicar, ticar no timestamp certo, expirar. */
let s = 3; Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };
const g = new Game(); window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.start();

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

let expired = 0;
g.events.on(EVENTS.DOT_EXPIRED, () => expired++);

const e = g.enemies.spawn(ENEMIES.abomination, 300, 0, { hp: 400, dmg: 1, speed: 0 });
e.hp = e.maxHp = 1e9;                       // nao pode morrer: queremos ver expirar
g.grid.clear(); g.grid.insert(e);

const c = { key: "teste", color: "#fff", now: g.clock, x: e.x, y: e.y, target: e };
g.dots.apply(e, { key: "teste", dps: 10, duration: 3, tickInterval: 0.5,
                  stacking: { mode: "refresh", max: 1 } }, c);
if (g.dots.count(e) !== 1) fail("DoT nao foi aplicado");

const before = g.damageBy.get("teste") || 0;
for (let i = 0; i < 40; i++) { g.clock += 0.1; g.dots.update(g.clock); }   // 4s
const dealt = (g.damageBy.get("teste") || 0) - before;
// 3s de duracao / 0.5s por tick = 6 ticks x (10 dps * 0.5s) = 30
if (Math.abs(dealt - 30) > 6) fail(`dano do DoT ${dealt.toFixed(1)}, esperado ~30`);
else console.log(`  ok DoT de 3s a 10 dps causou ${dealt.toFixed(1)} (esperado ~30)`);
if (expired !== 1) fail(`dot_expired disparou ${expired}x, esperado 1`);
else console.log("  ok dot_expired disparou ao vencer a duracao");
if (g.dots.count(e) !== 0) fail("DoT nao foi removido do inimigo apos expirar");
else console.log("  ok DoT saiu da lista do inimigo");

// cadencia independe do tamanho do passo (sub-stepping / timeScale)
for (const step of [0.025, 0.1, 0.0166]) {
  g.damageBy.clear();
  g.dots.apply(e, { key: "t2", dps: 10, duration: 3, tickInterval: 0.5,
                    stacking: { mode: "refresh", max: 1 } }, { ...c, now: g.clock });
  const t0 = g.clock;
  while (g.clock < t0 + 4) { g.clock += step; g.dots.update(g.clock); }
  const d = g.damageBy.get("teste") || 0;
  if (Math.abs(d - 30) > 6) fail(`passo ${step}s: dano ${d.toFixed(1)} != ~30`);
  else console.log(`  ok passo de ${step}s -> ${d.toFixed(1)} de dano (independe do fps)`);
}

// stacking
g.damageBy.clear();
for (let i = 0; i < 5; i++) {
  g.dots.apply(e, { key: "t3", dps: 10, duration: 5, tickInterval: 0.5,
                    stacking: { mode: "stack", max: 3 } }, { ...c, now: g.clock });
}
const inst = g.dots.find(e, "t3");
if (!inst || inst.stacks !== 3) fail(`stacking parou em ${inst && inst.stacks}, esperado 3`);
else console.log("  ok stacking respeitou o teto de 3");

// refresh nao reinicia a cadencia do tick
const inst2 = g.dots.find(e, "t3");
const nt = inst2.nextTick;
g.dots.apply(e, { key: "t3", dps: 10, duration: 5, tickInterval: 0.5,
                  stacking: { mode: "stack", max: 3 } }, { ...c, now: g.clock });
if (g.dots.find(e, "t3").nextTick !== nt) fail("reaplicar reiniciou a cadencia do tick");
else console.log("  ok reaplicar renova a duracao sem reiniciar a cadencia");

// DoT orfao: inimigo devolvido ao pool nao pode continuar sendo danificado
g.dots.clear(e);
if (e.dots.length) fail("clear() nao esvaziou os DoTs do inimigo");
else console.log("  ok clear() solta os DoTs antes do inimigo voltar ao pool");

// expiracao natural com o alvo saindo de alcance (o caso do Ceifador/Contagio)
g.start();
g.build.acquirePiece("corruption");
g.build.acquirePassive("contagio");
let contagions = 0;
const orig = HOOKS.contagion;
HOOKS.contagion = (...a) => { contagions++; return orig(...a); };
g.build.afterChange();
g.spawner.interval = 1e9;                            // so os alvos do teste
for (let i = 0; i < 60 * 15; i++) {                 // 15s
  g.player.hp = g.player.maxHp;
  if (g.enemies.active.length < 12) {
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2;
      const en = g.enemies.spawn(ENEMIES.abomination,
        g.player.x + Math.cos(a) * 260, g.player.y + Math.sin(a) * 260, g.spawner.scale);
      en.hp = en.maxHp = 4000;
    }
  }
  g.input.keys = new Set(["d"]);                     // andando: os alvos trocam
  g.update(1 / 60);
}
if (!contagions) fail("Contagio nunca disparou em 15s com alvos trocando");
else console.log(`  ok Contagio disparou ${contagions}x quando o alvo saiu de foco`);
HOOKS.contagion = orig;

console.log(fails ? `\nX ${fails} falhas` : "\nok DotSystem validado");
if (fails) __exit(1);
