/* =========================================================================
   BALANCE — mede o jogo em vez de adivinhar.

   Roda muitas runs com um bot no controle e agrega: quanto tempo se sobrevive,
   quando se morre, quanto cada peça contribui de dano e o que nunca é usado.

   O bot NÃO é um jogador humano. Ele é um piloto de referência: foge da massa,
   coleta orbes e para quando está seguro (para carregar as peças `rooted`).
   Os números absolutos dele valem menos que as COMPARAÇÕES — se uma peça faz
   10x o dano de outra sob a mesma política, isso é real, mesmo que um humano
   sobreviva mais do que ele.

   O ALVO NÃO É "sobreviver X minutos". É a sensação de rampagem: a curva de
   poder do jogador tem que subir em degraus visíveis e passar na frente da
   curva da horda. O que mede isso é ABATES POR SEGUNDO ao longo do tempo — se
   ela achata, o jogo virou uma parede; se cresce, virou power fantasy. Por
   isso a saída mostra a curva de kps por bucket de 30s, e não só o tempo de
   sobrevivência.

   Uso:
     DRIVER=driver_balance.js node tools/harness.js . [runs] [minutos]
   ========================================================================= */

const RUNS = Number(__argv[1] || 6);
const MAX_MIN = Number(__argv[2] || 20);

/* --- o bot ---------------------------------------------------------------
   Repulsão da horda + atração pelo orbe mais próximo, e fica parado quando
   não há ninguém perto. É o mínimo para um piloto que não seja burro: sem a
   parada, toda peça `rooted` mede zero e o balanceamento delas seria cego. */
function botKeys(g, out) {
  const p = g.player;
  let rx = 0, ry = 0, near = 0, closest = 1e9;
  g.grid.forRadius(p.x, p.y, 220, (e) => {
    if (e.hp <= 0 || e.charmed) return;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 220 * 220) return;
    const d = Math.sqrt(d2) || 1;
    if (d < closest) closest = d;
    const w = (220 - d) / 220;
    rx += (dx / d) * w; ry += (dy / d) * w;
    near++;
  });

  // seguro: fica parado (carrega rooted, acumula Fúria Contida)
  if (near === 0 || closest > 190) {
    let ox = 0, oy = 0, best = 1e9;
    const orbs = g.orbs.active;
    for (let i = 0; i < orbs.length; i++) {
      const dx = orbs[i].x - p.x, dy = orbs[i].y - p.y, d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; ox = dx; oy = dy; }
    }
    if (best < 520 * 520 && best > 60 * 60) {
      const d = Math.sqrt(best);
      return setKeys(out, ox / d, oy / d);
    }
    return setKeys(out, 0, 0);
  }

  // perigo: foge da massa, com um viés lateral para não encurralar
  const m = Math.hypot(rx, ry) || 1;
  let vx = rx / m, vy = ry / m;
  const t = g.elapsed * 0.7;
  vx += Math.cos(t) * 0.35; vy += Math.sin(t) * 0.35;
  const n = Math.hypot(vx, vy) || 1;
  return setKeys(out, vx / n, vy / n);
}

function setKeys(out, x, y) {
  out.clear();
  if (x > 0.35) out.add("d"); else if (x < -0.35) out.add("a");
  if (y > 0.35) out.add("s"); else if (y < -0.35) out.add("w");
  return out;
}

/* --- políticas de escolha ------------------------------------------------
   Quatro perfis. Se o jogo só funciona sob um deles, isso é um problema de
   balanceamento, não uma virtude. */
const POLICIES = {
  // linha de base: sem nenhuma inteligência
  aleatorio: (g, offers, rnd) => offers[Math.floor(rnd() * offers.length)],

  // aprofunda o que já está rendendo dano
  focado: (g, offers) => {
    let best = null, bestScore = -1;
    for (const o of offers) {
      let sc = 0;
      if (o.kind === "path") {
        sc = 10 + (g.damageBy.get(o.inst.key) || 0) / 1000;
        if (o.isEvo) sc += 60;
      } else if (o.kind === "piece") sc = 5;
      else sc = 4;
      if (sc > bestScore) { bestScore = sc; best = o; }
    }
    return best;
  },

  // pega peça nova sempre que pode: build larga e rasa
  amplo: (g, offers) => offers.find((o) => o.kind === "piece")
                     || offers.find((o) => o.kind === "passive")
                     || offers[0],

  // só o que causa dano: ignora defensiva e controle
  agressivo: (g, offers) => {
    const dmg = (o) => {
      const d = o.kind === "path" ? o.inst.def : o.def;
      if (!d || !d.tags) return false;
      return d.tags.indexOf("summon") >= 0 || d.tags.indexOf("dot") >= 0
          || d.tags.indexOf("fire") >= 0 || d.tags.indexOf("bolt") >= 0
          || d.tags.indexOf("shadow") >= 0;
    };
    return offers.find((o) => o.kind === "path" && dmg(o))
        || offers.find((o) => o.kind === "piece" && dmg(o))
        || offers[0];
  },
};

/* --- uma run -------------------------------------------------------------- */
function runOnce(policy, seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  Math.random = rnd;

  const g = new Game();
  window.game = g;
  const picks = [];
  g.ui.openLevelUp = function () {
    const offers = g.build.getOffers(3);
    if (!offers.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
    const o = POLICIES[policy](g, offers, rnd) || offers[0];
    picks.push(o.kind === "path" ? o.inst.def.id + ":" + o.pathId
             : o.kind === "piece" ? o.id : "P:" + o.id);
    g.ui.applyOffer(o);
  };
  g.ui.openChest = () => { g.state = STATE.PLAYING; };
  g.selectedSpeed = 1;
  g.start();

  const keys = new Set();
  const hpCurve = [], kpsCurve = [], dpsCurve = [];
  let lastKills = 0, lastDmg = 0;
  let nextSample = 30;
  const steps = Math.round((MAX_MIN * 60) / (1 / 60));
  for (let i = 0; i < steps; i++) {
    botKeys(g, keys);
    g.input.keys = keys;
    g.update(1 / 60);
    if (g.elapsed >= nextSample) {
      nextSample += 30;
      hpCurve.push(Math.round((g.player.hp / g.player.maxHp) * 100));
      kpsCurve.push((g.player.kills - lastKills) / 30);
      lastKills = g.player.kills;
      let d = 0;
      for (const v of g.damageBy.values()) d += v;
      dpsCurve.push((d - lastDmg) / 30);
      lastDmg = d;
    }
    if (g.state === STATE.GAMEOVER) break;
  }

  const dmg = {};
  let total = 0;
  for (const inst of g.build.pieces.values()) {
    const v = g.damageBy.get(inst.key) || 0;
    dmg[inst.def.id] = v;
    total += v;
  }
  return {
    policy, seed,
    survived: g.elapsed,
    died: g.state === STATE.GAMEOVER,
    level: g.player.level,
    kills: g.player.kills,
    total,
    dmg,
    hpCurve, kpsCurve, dpsCurve,
    axis: { ...g.build.axis },
    axisTotal: g.build.axisTotal,
    pieces: [...g.build.pieces.values()].map((i) => i.def.id),
    paths: [...g.build.pieces.values()].map((i) => i.def.id + "[" + Object.values(i.paths).join("") + "]"),
    passives: [...g.build.passives.keys()],
    capstones: [...g.build.capstones],
    evolved: [...g.build.pieces.values()].filter((i) => i.evolvedInto).map((i) => i.defId),
    picks,
  };
}

/* --- agregação ------------------------------------------------------------ */
const med = (a) => {
  if (!a.length) return 0;
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};
const mmss2 = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const all = [];
const t0 = __now();
for (const policy in POLICIES) {
  for (let r = 0; r < RUNS; r++) all.push(runOnce(policy, 1000 + r * 37));
}
console.log(`${all.length} runs em ${((__now() - t0) / 1000).toFixed(0)}s\n`);

console.log("SOBREVIVENCIA POR POLITICA");
console.log("  politica     mediana   min     max     morreu   nivel  abates   dano");
for (const policy in POLICIES) {
  const rs = all.filter((r) => r.policy === policy);
  const t = rs.map((r) => r.survived);
  const mortes = rs.filter((r) => r.died).length;
  console.log(`  ${policy.padEnd(12)} ${mmss2(med(t)).padStart(6)}  ` +
    `${mmss2(Math.min(...t)).padStart(6)}  ${mmss2(Math.max(...t)).padStart(6)}  ` +
    `${String(mortes + "/" + rs.length).padStart(7)}  ` +
    `${String(med(rs.map((r) => r.level))).padStart(5)}  ` +
    `${String(med(rs.map((r) => r.kills))).padStart(6)}  ` +
    `${(med(rs.map((r) => r.total)) / 1000).toFixed(0)}k`);
}

console.log("\nCURVA DE VIDA (% mediana a cada 30s; '-' = ja morreu)");
const maxPts = Math.max(...all.map((r) => r.hpCurve.length));
for (const policy in POLICIES) {
  const rs = all.filter((r) => r.policy === policy);
  let line = "";
  for (let i = 0; i < Math.min(maxPts, 30); i++) {
    const vals = rs.map((r) => r.hpCurve[i]).filter((v) => v != null);
    line += vals.length < rs.length / 2 ? " -" : String(Math.floor(med(vals) / 10)).padStart(2);
  }
  console.log(`  ${policy.padEnd(12)}${line}`);
}
console.log(`  ${"".padEnd(12)}${Array.from({ length: Math.min(maxPts, 30) }, (_, i) => String((i + 1) % 10).padStart(2)).join("")}  (x30s)`);

/* A curva que importa para a sensacao de rampagem. Achatar = parede. */
console.log("\nABATES POR SEGUNDO (mediana por bucket de 30s) — a curva da rampagem");
for (const policy in POLICIES) {
  const rs = all.filter((r) => r.policy === policy);
  let line = "";
  for (let i = 0; i < Math.min(maxPts, 30); i++) {
    const vals = rs.map((r) => r.kpsCurve[i]).filter((v) => v != null);
    if (vals.length < rs.length / 2) { line += "  -"; continue; }
    line += String(Math.round(med(vals))).padStart(3);
  }
  console.log(`  ${policy.padEnd(12)}${line}`);
}
console.log("\nDANO POR SEGUNDO (mediana por bucket de 30s, em centenas)");
for (const policy in POLICIES) {
  const rs = all.filter((r) => r.policy === policy);
  let line = "";
  for (let i = 0; i < Math.min(maxPts, 30); i++) {
    const vals = rs.map((r) => r.dpsCurve[i]).filter((v) => v != null);
    if (vals.length < rs.length / 2) { line += "    -"; continue; }
    line += String(Math.round(med(vals) / 100)).padStart(5);
  }
  console.log(`  ${policy.padEnd(12)}${line}`);
}

// Degrau de rampagem: quanto o kps do fim supera o do inicio. Abaixo de ~3x
// o jogador nao sente que ficou mais forte, so que o jogo ficou mais dificil.
console.log("\nDEGRAU DE PODER (kps do ultimo terco / kps do primeiro terco)");
for (const policy in POLICIES) {
  const rs = all.filter((r) => r.policy === policy);
  const ratios = rs.map((r) => {
    const c = r.kpsCurve;
    if (c.length < 6) return null;
    const t = Math.floor(c.length / 3);
    const ini = c.slice(0, t).reduce((a, b) => a + b, 0) / t;
    const fim = c.slice(-t).reduce((a, b) => a + b, 0) / t;
    return ini > 0 ? fim / ini : null;
  }).filter((v) => v != null);
  const m = med(ratios);
  const veredito = m >= 4 ? "rampagem" : m >= 2.5 ? "ok" : m >= 1.5 ? "fraco" : "PLATEAU";
  console.log(`  ${policy.padEnd(12)} ${m.toFixed(1)}x   ${veredito}`);
}

console.log("\nCONTRIBUICAO DE DANO (share mediano quando a peca esta na build)");
const rows = [];
for (const id in PIECES) {
  const withIt = all.filter((r) => r.dmg[id] != null);
  if (!withIt.length) { rows.push({ id, runs: 0, share: 0, def: PIECES[id] }); continue; }
  const shares = withIt.map((r) => (r.total > 0 ? r.dmg[id] / r.total : 0) * 100);
  rows.push({ id, runs: withIt.length, share: med(shares), def: PIECES[id] });
}
rows.sort((a, b) => b.share - a.share);
for (const r of rows) {
  if (r.def.evolutionOnly && !r.runs) continue;
  const bar = "#".repeat(Math.min(30, Math.round(r.share / 2)));
  console.log(`  ${r.id.padEnd(20)} ${String(r.runs).padStart(2)} runs  ` +
    `${r.share.toFixed(1).padStart(5)}%  ${bar}`);
}

console.log("\nNUNCA ESCOLHIDA");
const nunca = rows.filter((r) => !r.runs && !r.def.evolutionOnly).map((r) => r.id);
console.log("  " + (nunca.length ? nunca.join(", ") : "—"));

/* Morte precoce quase sempre e uma peca especifica, nao "o jogo esta dificil".
   Listar as escolhas das runs curtas encontra o culpado em segundos. */
const curtas = all.filter((r) => r.survived < 180);
if (curtas.length) {
  console.log(`\nMORTES PRECOCES (< 3 min): ${curtas.length}/${all.length}`);
  const primeiras = {};
  for (const r of curtas) {
    for (const pk of r.picks.slice(0, 5)) primeiras[pk] = (primeiras[pk] || 0) + 1;
  }
  const ord = Object.entries(primeiras).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [pk, n] of ord) console.log(`  ${String(n).padStart(2)}x  ${pk}`);
}

console.log("\nPROGRESSAO");
const evoAll = all.flatMap((r) => r.evolved);
const capAll = all.flatMap((r) => r.capstones);
const cnt = (a) => { const m = {}; for (const x of a) m[x] = (m[x] || 0) + 1; return m; };
console.log(`  eixos medianos: ${med(all.map((r) => r.axis.corruption))}/` +
  `${med(all.map((r) => r.axis.dominion))}/${med(all.map((r) => r.axis.cataclysm))} ` +
  `(pool ${med(all.map((r) => r.axisTotal))}/${AXIS_RULES.pool})`);
console.log(`  runs que evoluiram algo: ${all.filter((r) => r.evolved.length).length}/${all.length}` +
  `  ${JSON.stringify(cnt(evoAll))}`);
console.log(`  runs com capstone: ${all.filter((r) => r.capstones.length).length}/${all.length}` +
  `  ${JSON.stringify(cnt(capAll))}`);
