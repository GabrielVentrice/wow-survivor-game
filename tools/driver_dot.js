/* Teste direto do DotSystem: aplicar, ticar no timestamp certo, expirar. */
let s = 3; Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };
const g = new Game(); window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
// A etapa tambem PARA o update: sem resolve-la o driver rodaria ate o
// primeiro marco e chamaria de minutos. Quem mede etapa e `driver_milestone`.
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
g.start(STARTER_TESTE);

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

/* --- a conta que vence com o corpo (Soul Rupture) --------------------------
   Um DoT cujo dano inteiro mora na detonacao final so paga se o alvo
   sobreviver ao proprio tique — e nesta horda ele quase nunca sobrevive.
   `expireOnDeath` inverte isso, e quem roda a conta e `clear()`, porque o
   inimigo morto e limpo por `killDeadEnemies` no mesmo frame: o laco de update
   nunca ve o DoT de novo. O teste cobra os dois lados — que detona com o
   corpo, e que um DoT normal NAO detona. */
{
  const mk = (flag, key) => {
    g.start(STARTER_TESTE);
    g.damageBy.clear();
    const alvo = g.enemies.spawn(ENEMIES.ghoul, 400, 0, { hp: 1, dmg: 1, speed: 0 });
    const viz = g.enemies.spawn(ENEMIES.abomination, 440, 0, { hp: 1, dmg: 1, speed: 0 });
    viz.hp = viz.maxHp = 1e9;
    g.grid.clear(); g.grid.insert(alvo); g.grid.insert(viz);
    const cc = { key, color: "#fff", now: g.clock, x: alvo.x, y: alvo.y, target: alvo };
    g.dots.apply(alvo, {
      key, dps: 1, duration: 60, tickInterval: 30, expireOnDeath: flag,
      stacking: { mode: "refresh", max: 1 },
      onExpire: [{ type: "damage_instant", amount: 500, radius: 120 }],
    }, cc);
    alvo.hp = 0;                       // morreu ANTES do prazo
    g.killDeadEnemies();
    return g.damageBy.get(key) || 0;
  };
  let mortesExpiradas = 0;
  g.events.on(EVENTS.DOT_EXPIRED, () => mortesExpiradas++);
  const comFlag = mk(true, "ruptura");
  const semFlag = mk(false, "comum");
  if (comFlag < 400) fail(`expireOnDeath nao detonou com a morte do alvo (${comFlag.toFixed(0)} de dano)`);
  else console.log(`  ok expireOnDeath cobra a conta quando o corpo cai (${comFlag.toFixed(0)} de dano)`);
  if (semFlag > 0) fail(`DoT sem expireOnDeath detonou ao morrer (${semFlag.toFixed(0)} de dano)`);
  else console.log("  ok DoT comum morre calado junto com o alvo");
  if (mortesExpiradas) fail(`dot_expired disparou ${mortesExpiradas}x numa morte — o fato e "venceu num alvo vivo"`);
  else console.log("  ok a morte nao emite dot_expired (Contagio e Chamador nao contam duas vezes)");
}

/* O prazo desenhado sai do relogio de SIMULACAO, nunca de `dotAnim`.

   `dotAnim` e a fase da animacao — nasce sorteada por corpo e so anda enquanto
   ha DoT. `endAt` vive no `game.clock`. Medir um contra o outro dava `left` na
   casa das dezenas depois do primeiro minuto, e `left` grande vira `depth`
   negativo: alpha negativo o canvas recusa em silencio (o orbe sai em
   opacidade cheia sob `lighter`) e raio negativo no `arc` levanta excecao e
   corta o resto do frame. Era a tela ficando branca com Soul Rupture e Doom.

   As duas fatias que leem prazo sao `doom` e `unstable`; as outras tres nao
   olham o relogio e por isso nunca quebraram. */
{
  const alphas = [], raios = [];
  const spy = new Proxy({}, {
    get(t, k) {
      if (k === "arc") return (x, y, r) => { raios.push(r); };
      if (k === "canvas") return { width: 640, height: 360 };
      if (k === "measureText") return () => ({ width: 10 });
      if (k === "createRadialGradient" || k === "createLinearGradient")
        return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set(t, k, v) { if (k === "globalAlpha") alphas.push(v); return true; },
  });
  const cam = { left: 0, top: 0 };

  g.start(STARTER_TESTE);
  g.clock = 620;                                  // dez minutos de run
  const alvo = g.enemies.spawn(ENEMIES.abomination, 0, 0, { hp: 1, dmg: 1, speed: 0 });
  alvo.hp = alvo.maxHp = 1e9;
  const cd = { key: "d", color: "#7fdc4a", now: g.clock, x: 0, y: 0, target: alvo };
  for (const look of ["doom", "unstable"]) {
    g.dots.apply(alvo, { key: look, dps: 1, duration: 6, tickInterval: 1, look: look,
                         stacking: { mode: "refresh", max: 1 } }, cd);
  }
  g.clock += 2;                                   // parte do prazo ja correu
  const d0 = g.dots.find(alvo, "doom");
  const left = dotLeft(d0, g.clock);
  // o relogio certo devolve a fracao que sobrou; um relogio errado (dotAnim,
  // que anda de 0 a poucos segundos) estouraria o teto, e o clamp segura
  const errado = dotLeft(d0, alvo.dotAnim);
  if (Math.abs(left - 4 / 6) > 0.02)
    fail(`dotLeft devolveu ${left.toFixed(2)}, esperado ~0.67`);
  else if (errado > 1)
    fail("dotLeft nao clampa: um relogio errado volta a pintar a tela de branco");
  else console.log(`  ok o prazo do orbe sai do clock da simulacao (left ${left.toFixed(2)}, clampado)`);

  alvo.draw(spy, cam, g.clock);
  const aRuim = alphas.filter((v) => !(v >= 0 && v <= 1));
  const rRuim = raios.filter((v) => !(v >= 0));
  if (aRuim.length)
    fail(`orbe de DoT pediu alpha fora de 0..1 (${aRuim[0]}) — sob \`lighter\` isso e a tela branca`);
  else console.log(`  ok nenhum alpha fora de 0..1 em ${alphas.length} escritas`);
  if (rRuim.length)
    fail(`orbe de DoT pediu arc de raio ${rRuim[0]} — o browser levanta excecao e corta o frame`);
  else console.log("  ok nenhum arc de raio negativo");
}

// expiracao natural com o alvo saindo de alcance (o caso do Ceifador/Contagio)
g.start(STARTER_TESTE);
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
