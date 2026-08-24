/* =========================================================================
   AUTOPSY — quem mata o jogador, quando, e de quanto foi a pancada.

   `driver_balance` responde "quanto tempo se sobrevive". Ele nao responde a
   pergunta que uma morte instantanea faz: QUEM cobrou, e cobrou de uma vez ou
   ao longo de dez segundos. Esse driver instrumenta o funil de dano no jogador
   (`Game.damagePlayer`) e atribui cada ponto de vida perdido a um inimigo
   nomeado.

   A atribuicao nao muda uma linha do jogo. Ela sai de tres ganchos:

     - `deathBlast(e)` sabe de quem e o estouro: o wrapper anota antes.
     - `updateEnemies(dt)` entrega o dt do passo, entao `amount / dt` devolve o
       `touchDps` de quem esta encostado, e o grid diz quais corpos estao la.
     - projetil hostil e identificado pelo `shootDamage` do elenco `ranged`.

   O que ele imprime, e por que cada bloco existe:

     FONTE      — de onde vem o dano da run inteira, e separado por fase: o
                  culpado dos 2 primeiros minutos costuma nao ser o do fim.
     GOLPE      — histograma de dano por FRAME. Morte instantanea nao aparece
                  em media de dps: ela aparece como um frame que cobra metade
                  da barra de uma vez.
     ULTIMOS 2s — a composicao da morte propriamente dita.

   Uso:
     DRIVER=driver_autopsy.js node tools/harness.js . [runs] [minutos] [modo]

   `modo` = `sweep` roda as variantes de tuning declaradas em VARIANTS e
   compara — e a metade que testa possibilidade em vez de so medir o que ha.
   ========================================================================= */

const RUNS = Number(__argv[1] || 8);
const MAX_MIN = Number(__argv[2] || 6);
const MODE = String(__argv[3] || "autopsy");

/* --- o piloto ------------------------------------------------------------
   Mesmo desenho do `driver_balance`: repele a horda, cata orbe, para quando
   esta seguro (senao toda peca `rooted` mede zero). Ele nao e um humano; ele e
   uma referencia constante entre variantes, que e o que uma comparacao pede. */
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

/* --- escolhas -------------------------------------------------------------
   Um perfil so, e o que MIRA: aprofunda a peca que mais deu dano e empilha o
   eixo mais alto na etapa. E o teto do que o jogo entrega, entao morte sob ele
   nao tem a desculpa de "o bot escolheu mal". */
function pickLevel(g, offers) {
  let best = null, sBest = -1;
  for (const o of offers) {
    let sc = o.kind === "path" ? 10 + (g.damageBy.get(o.inst.key) || 0) / 1000 : 4;
    if (o.isEvo) sc += 60;
    if (sc > sBest) { sBest = sc; best = o; }
  }
  return best;
}

function pickMilestone(g, offers) {
  let alvo = null, maior = -1;
  for (const a in AXES) if (g.build.axis[a] > maior) { maior = g.build.axis[a]; alvo = a; }
  const fixa = offers.find((o) => o.locked && o.axisId === alvo);
  if (fixa && fixa.dry && fixa.dry.gain > 0) return { o: fixa, wet: false };
  let best = null, sBest = -1;
  for (const o of offers) {
    const step = o.dry && o.dry.gain > 0 ? o.dry : o.wet;
    if (!step || !step.gain) continue;
    const sc = (o.axisId === alvo ? 1000 : 0) + step.gain * 10 + g.build.axis[o.axisId];
    if (sc > sBest) { sBest = sc; best = o; }
  }
  if (!best) return { o: offers[0], wet: !offers[0].dry };
  return { o: best, wet: !(best.dry && best.dry.gain > 0) };
}

/* --- atribuicao -----------------------------------------------------------
   Quem cobrou. O jogo passa so uma string de fonte ("touch"/"blast"/
   "projectile") — o nome do corpo e reconstruido aqui, sem tocar no jogo. */
const RANGED_BY_DMG = (() => {
  const m = new Map();
  for (const id in ENEMIES) if (ENEMIES[id].ranged) m.set(ENEMIES[id].shootDamage, id);
  return m;
})();

function instrument(g, hit) {
  let dt = 0;
  g._afBlame = null;

  const origEnemies = g.updateEnemies.bind(g);
  g.updateEnemies = (d) => { dt = d; origEnemies(d); dt = 0; };

  const origBlast = g.deathBlast.bind(g);
  g.deathBlast = (e) => { g._afBlame = e.type.id; origBlast(e); g._afBlame = null; };

  const origDamage = g.damagePlayer.bind(g);
  g.damagePlayer = (amount, source) => {
    const dealt = origDamage(amount, source);
    if (dealt > 0) hit(source, _who(g, source, amount, g._afBlame, dt), dealt);
    return dealt;
  };
}

function _who(g, source, amount, blame, dt) {
  if (source === "blast") return blame || "?";
  if (source === "projectile") return RANGED_BY_DMG.get(amount) || "projetil";
  if (source !== "touch") return source;
  // touchDps reconstruido do passo, desempatado por quem esta encostado
  const dps = dt > 0 ? amount / dt : 0;
  const p = g.player;
  let best = "?", err = 1e9;
  for (const e of g.enemies.active) {
    if (e.hp <= 0 || e.charmed) continue;
    const dx = p.x - e.x, dy = p.y - e.y, rr = p.radius + e.radius;
    if (dx * dx + dy * dy > rr * rr) continue;
    for (const cand of [e.touchDps, e.touchDps * (e.weakFactor || 1)]) {
      const d = Math.abs(cand - dps);
      if (d < err) { err = d; best = e.type.id; }
    }
  }
  return err < 0.5 ? best : "toque";
}

/* --- uma run -------------------------------------------------------------- */
function runOnce(seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  Math.random = rnd;

  const g = new Game();
  window.game = g;
  g.ui.openLevelUp = function () {
    const offers = g.build.getOffers(3);
    if (!offers.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
    g.ui.applyOffer(pickLevel(g, offers) || offers[0]);
  };
  g.ui.openMilestone = function () {
    if (g.build.axisLeft <= 0) { g.pendingMilestones = 0; g.state = STATE.PLAYING; return; }
    const offers = g.build.getMilestoneOffers();
    if (!offers.length) { g.pendingMilestones = 0; g.state = STATE.PLAYING; return; }
    const pick = pickMilestone(g, offers);
    g.build.applyMilestone(pick.o, pick.wet);
    g.ui.checkForm(null);
    g.pendingMilestones--;
    g.state = STATE.PLAYING;
  };
  g.ui.openChest = () => { g.state = STATE.PLAYING; };
  g.selectedSpeed = 1;
  g.start(STARTER_TESTE);

  // dano tomado: total por (fonte, quem), por fase, e por frame
  const bySrc = new Map();
  const early = new Map();          // < 120s
  const frames = [];                // { t, total, parts:Map }
  const tail = [];                  // ultimos 2s de hits
  let frame = null;

  const key = (src, w) => `${w}/${src}`;
  instrument(g, (src, w, amt) => {
    const k = key(src, w);
    bySrc.set(k, (bySrc.get(k) || 0) + amt);
    if (g.elapsed < 120) early.set(k, (early.get(k) || 0) + amt);
    if (frame) {
      frame.total += amt;
      frame.parts.set(k, (frame.parts.get(k) || 0) + amt);
    }
    tail.push({ t: g.elapsed, k, amt });
  });

  const keys = new Set();
  const steps = Math.round((MAX_MIN * 60) * 60);
  const maxHp = g.player.maxHp;
  for (let i = 0; i < steps; i++) {
    botKeys(g, keys);
    g.input.keys = keys;
    frame = { t: g.elapsed, total: 0, parts: new Map() };
    g.update(1 / 60);
    if (frame.total > 0) frames.push(frame);
    if (g.state === STATE.GAMEOVER) break;
  }

  const died = g.state === STATE.GAMEOVER;
  const morte = g.elapsed;
  const last2 = new Map();
  if (died) {
    for (const h of tail) if (h.t >= morte - 2) last2.set(h.k, (last2.get(h.k) || 0) + h.amt);
  }
  return { seed, died, survived: morte, maxHp, bySrc, early, frames, last2, tail,
           level: g.player.level, kills: g.player.kills };
}

/* A JANELA e o que corresponde a sensacao de morte instantanea, e ela nao e o
   frame. Uma pancada de 32 tres vezes em meio segundo nao aparece em nenhum
   frame como golpe grande, e ainda assim tira toda a barra antes de o jogador
   ter chance de reagir: o frame mede o desenho, a janela mede a REACAO. */
function piorJanela(tail, seg) {
  let melhor = 0, ini = 0, soma = 0, quando = 0;
  for (let i = 0; i < tail.length; i++) {
    soma += tail[i].amt;
    while (tail[ini].t < tail[i].t - seg) { soma -= tail[ini].amt; ini++; }
    if (soma > melhor) { melhor = soma; quando = tail[i].t; }
  }
  return { dano: melhor, t: quando };
}

/* --- agregacao ------------------------------------------------------------ */
const _med = (a) => {
  if (!a.length) return 0;
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};
const _hms = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function mergeInto(dst, src) { for (const [k, v] of src) dst.set(k, (dst.get(k) || 0) + v); }

function _tabela(titulo, mapa) {
  let total = 0;
  for (const v of mapa.values()) total += v;
  console.log(`\n${titulo}  (total ${Math.round(total)} de vida)`);
  if (!total) { console.log("  —"); return; }
  const ord = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of ord) {
    const pct = (v / total) * 100;
    if (pct < 0.5) continue;
    console.log(`  ${k.padEnd(24)} ${pct.toFixed(1).padStart(5)}%  ` +
      "#".repeat(Math.round(pct / 2)));
  }
}

function autopsy(label, runs) {
  const mortes = runs.filter((r) => r.died);
  console.log(`\n${"=".repeat(66)}\n${label}\n${"=".repeat(66)}`);
  console.log(`  runs ${runs.length}   morreu ${mortes.length}   ` +
    `mediana ${_hms(_med(runs.map((r) => r.survived)))}   ` +
    `pior ${_hms(Math.min(...runs.map((r) => r.survived)))}   ` +
    `nivel ${_med(runs.map((r) => r.level))}`);
  console.log(`  tempos: ${runs.map((r) => _hms(r.survived) + (r.died ? "" : "*")).join("  ")}   (* = sobreviveu)`);

  const total = new Map(), cedo = new Map(), fim = new Map();
  for (const r of runs) { mergeInto(total, r.bySrc); mergeInto(cedo, r.early); mergeInto(fim, r.last2); }
  _tabela("FONTE DO DANO — run inteira", total);
  _tabela("FONTE DO DANO — primeiros 2 minutos", cedo);
  _tabela("FONTE DO DANO — ultimos 2 segundos de vida", fim);

  /* O bloco que responde "IK". Media de dps nao ve morte instantanea: ela e um
     frame que cobra metade da barra. */
  const maxHp = runs[0].maxHp;
  const cortes = [0.1, 0.25, 0.5, 0.75, 1];
  const rotulos = ["10%+", "25%+", "50%+", "75%+", "100%"];
  const conta = cortes.map(() => 0);
  let pior = null;
  for (const r of runs) for (const f of r.frames) {
    for (let i = 0; i < cortes.length; i++) if (f.total >= maxHp * cortes[i]) conta[i]++;
    if (!pior || f.total > pior.total) pior = f;
  }
  console.log(`\nGOLPE UNICO — frames que cobram X% da barra (${maxHp} de vida)`);
  for (let i = 0; i < cortes.length; i++) {
    console.log(`  ${rotulos[i].padEnd(6)} ${String(conta[i]).padStart(5)} frames`);
  }
  if (pior) {
    const partes = [...pior.parts.entries()].sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${Math.round(v)}`).join(" + ");
    console.log(`  pior frame: ${Math.round(pior.total)} de dano aos ${_hms(pior.t)}  =  ${partes}`);
  }

  console.log(`\nJANELA — pior rajada, em % da barra (mediana das runs / pior run)`);
  for (const seg of [0.5, 1, 2, 4]) {
    const js = runs.map((r) => piorJanela(r.tail, seg).dano / maxHp * 100);
    const pj = Math.max(...js);
    console.log(`  ${String(seg).padStart(4)}s   ${_med(js).toFixed(0).padStart(4)}%   ${pj.toFixed(0).padStart(4)}%` +
      (pj >= 100 ? "   <- a barra inteira cabe nesta janela" : ""));
  }
}

/* --- variantes de tuning --------------------------------------------------
   Cada uma e um patch REVERSIVEL sobre os dados, rodado com as mesmas seeds
   das outras. Elas nao entram no jogo: existem para a comparacao acontecer em
   minutos em vez de em noites jogando.

   Uma regra que custou uma rodada para ser aprendida: **variante troca DADO,
   nunca substitui metodo**. Uma versao anterior testava o falloff reescrevendo
   `deathBlast` inteiro, e a reescrita deixou de fora o `spawnParticles` — que
   sorteia. Com um numero de sorteios diferente do jogo, as duas runs divergem
   no primeiro spawn e param de ser a mesma run com um numero trocado: o
   resultado prometeu 1/8 de mortes e o patch de verdade entregou 5/8. Se a
   hipotese so cabe em codigo, ela tem que entrar no jogo atras de um campo de
   dado (foi o que `falloff` virou) e ser medida de la.

   A segunda regra e sobre quantas runs. Mesma seed NAO significa mesma run:
   no instante em que uma variante muda um numero, o jogador toma dano
   diferente, mata em ordem diferente e o proximo `Math.random()` cai em outro
   lugar — as duas runs divergem no primeiro segundo. Entao a comparacao e
   sempre ESTATISTICA, nunca par a par, e uma diferenca de uma ou duas mortes
   em oito runs e ruido. Rode 16+ nos finalistas antes de mexer no
   `balance.js`; foi assim que `peso-2` apareceu PIOR que o base numa rodada de
   8 e voltou ao lugar na de 16. O `filtro` no 5o argumento existe para isso:
   varredura larga e barata primeiro, rodada funda so nos que sobrarem. */
const VARIANTS = {
  base: {
    desc: "como esta hoje (falloff 0.25)",
    apply: () => () => {},
  },
  "falloff-0": {
    desc: "estouro nao cobra nada na borda",
    apply: () => {
      const f = ENEMIES.ganarg.deathBlast.falloff;
      ENEMIES.ganarg.deathBlast.falloff = 0;
      return () => { ENEMIES.ganarg.deathBlast.falloff = f; };
    },
  },
  "blast-off": {
    desc: "Gan'arg sem estouro nenhum — o piso da comparacao",
    apply: () => {
      const b = ENEMIES.ganarg.deathBlast;
      delete ENEMIES.ganarg.deathBlast;
      return () => { ENEMIES.ganarg.deathBlast = b; };
    },
  },
  "dano-20": {
    desc: "estouro de 32 para 20",
    apply: () => {
      const d = ENEMIES.ganarg.deathBlast.damage;
      ENEMIES.ganarg.deathBlast.damage = 20;
      return () => { ENEMIES.ganarg.deathBlast.damage = d; };
    },
  },
  "raio-48": {
    desc: "raio do estouro de 70 para 48",
    apply: () => {
      const r = ENEMIES.ganarg.deathBlast.radius;
      ENEMIES.ganarg.deathBlast.radius = 48;
      return () => { ENEMIES.ganarg.deathBlast.radius = r; };
    },
  },
  /* Quantos sapadores existem e uma alavanca tao forte quanto quanto cada um
     cobra: com peso 4 num bolo de 13, um em cada tres corpos entre 1:00 e 2:00
     e uma bomba andando. */
  "peso-2": {
    desc: "Gan'arg de peso 4 para 2 (~1 em 6 corpos, nao 1 em 3)",
    apply: () => {
      const w = ENEMIES.ganarg.weight;
      ENEMIES.ganarg.weight = 2;
      return () => { ENEMIES.ganarg.weight = w; };
    },
  },
  "dano20-peso2": {
    desc: "as duas alavancas juntas",
    apply: () => {
      const d = ENEMIES.ganarg.deathBlast.damage, w = ENEMIES.ganarg.weight;
      ENEMIES.ganarg.deathBlast.damage = 20; ENEMIES.ganarg.weight = 2;
      return () => { ENEMIES.ganarg.deathBlast.damage = d; ENEMIES.ganarg.weight = w; };
    },
  },
  /* O pacote que as duas alavancas mais fortes sugerem, junto com o falloff
     que ja esta no jogo: "nao esteja ENCOSTADO" em vez de "nao esteja perto",
     e uma conta que tres sapadores juntos nao fecham sozinhos. */
  pacote: {
    desc: "raio 48 + dano 24, com o falloff que ja esta no jogo",
    apply: () => {
      const r = ENEMIES.ganarg.deathBlast.radius, d = ENEMIES.ganarg.deathBlast.damage;
      ENEMIES.ganarg.deathBlast.radius = 48; ENEMIES.ganarg.deathBlast.damage = 24;
      return () => { ENEMIES.ganarg.deathBlast.radius = r; ENEMIES.ganarg.deathBlast.damage = d; };
    },
  },

  "ganarg-150": {
    desc: "Gan'arg so entra aos 2:30 em vez de 1:00",
    apply: () => {
      const t = ENEMIES.ganarg.minTime;
      ENEMIES.ganarg.minTime = 150;
      return () => { ENEMIES.ganarg.minTime = t; };
    },
  },
  "touch-70": {
    desc: "touchDps de todo corpo comum a 70% — o contrafactual",
    apply: () => {
      const antes = {};
      for (const id in ENEMIES) { antes[id] = ENEMIES[id].touchDps; ENEMIES[id].touchDps *= 0.7; }
      return () => { for (const id in ENEMIES) ENEMIES[id].touchDps = antes[id]; };
    },
  },
};

function runVariant(v, runs) {
  const undo = v.apply();
  const out = [];
  for (let r = 0; r < runs; r++) out.push(runOnce(1000 + r * 37));
  undo();
  return out;
}

/* --- saida ---------------------------------------------------------------- */
const t0 = __now();

if (MODE !== "sweep") {
  autopsy("AUTOPSIA — jogo como esta hoje", runVariant(VARIANTS.base, RUNS));
} else {
  console.log(`SWEEP — ${Object.keys(VARIANTS).length} variantes x ${RUNS} runs x ${MAX_MIN} min\n`);
  // A linha sai assim que a variante termina: um sweep longo tem que ser
  // legivel enquanto roda, senao ele so existe depois de acabar.
  console.log("  variante       mediana    pior   morreu  <3min  abates  f>=50%  f>=25%  maior fonte");
  const linhas = [];
  // 5o argumento: lista de variantes a rodar, separada por virgula. Um sweep
  // completo custa minutos; iterar numa hipotese so nao deveria custar isso.
  const filtro = __argv[4] ? String(__argv[4]).split(",") : null;
  for (const name in VARIANTS) {
    if (filtro && filtro.indexOf(name) < 0) continue;
    const v = VARIANTS[name];
    const rs = runVariant(v, RUNS);
    const t = rs.map((r) => r.survived);
    const maxHp = rs[0].maxHp;
    let ik = 0, meio = 0;
    for (const r of rs) for (const f of r.frames) {
      if (f.total >= maxHp * 0.5) ik++;
      if (f.total >= maxHp * 0.25) meio++;
    }
    const src = new Map();
    for (const r of rs) mergeInto(src, r.bySrc);
    let tot = 0; for (const v2 of src.values()) tot += v2;
    const top = [...src.entries()].sort((a, b) => b[1] - a[1])[0];
    const l = {
      name, desc: v.desc,
      _med: _med(t), min: Math.min(...t), mortes: rs.filter((r) => r.died).length,
      cedo: rs.filter((r) => r.died && r.survived < 180).length,
      kills: _med(rs.map((r) => r.kills)),
      ik, meio,
      top: top ? `${top[0]} ${((top[1] / tot) * 100).toFixed(0)}%` : "—",
    };
    linhas.push(l);
    console.log(`  ${l.name.padEnd(14)} ${_hms(l._med).padStart(6)}  ${_hms(l.min).padStart(6)}  ` +
      `${String(l.mortes + "/" + RUNS).padStart(6)}  ${String(l.cedo).padStart(5)}  ` +
      `${String(l.kills).padStart(6)}  ${String(l.ik).padStart(6)}  ${String(l.meio).padStart(6)}  ${l.top}`);
  }
  console.log("\n  f>=50% / f>=25% = frames que cobram metade / um quarto da barra de uma vez.");
  for (const l of linhas) console.log(`  ${l.name.padEnd(14)} ${l.desc}`);
}

console.log(`\nfeito em ${((__now() - t0) / 1000).toFixed(0)}s`);
