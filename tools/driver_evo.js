/* Driver 2: forca TODAS as evolucoes e TODOS os capstones, um a um.
   O caminho feliz do jogo normal quase nunca chega nesses estados — e sao
   exatamente eles que trocam trigger, id e efeito em tempo de execucao. */
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

let fails = 0;
const fail = (m, e) => { console.error("  X " + m + (e ? "\n      " + e.message : "")); fails++; };

const g = new Game();
window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
// A etapa tambem PARA o update: sem resolve-la o driver rodaria ate o
// primeiro marco e chamaria de minutos. Quem mede etapa e `driver_milestone`.
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };

/* Gate de eixo: do tier 3 em diante o caminho pede pontos no eixo DA PECA
   (`PATH_RULES.axisGate`). Este driver FORCA estados que uma run so alcanca
   mirando — evoluir toda peca do catalogo exigiria varias runs puras —, entao
   ele crava o eixo em vez de jogar por ele. Quem mede a regra e `driver_cards`. */
function abreEixos() {
  for (const a in g.build.axis) g.build.axis[a] = AXIS_RULES.pureAt;
}

// enche o campo para que os efeitos tenham em quem bater
function populate(n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, d = 40 + (i % 7) * 25;
    g.enemies.spawn(ENEMIES.ghoul, g.player.x + Math.cos(a) * d,
                    g.player.y + Math.sin(a) * d, g.spawner.scale);
  }
  g.enemies.spawn(ENEMIES.dreadlord, g.player.x + 120, g.player.y, g.spawner.scale);
}

function simulate(seconds) {
  const steps = Math.round(seconds / 0.025);
  for (let i = 0; i < steps; i++) {
    g.player.hp = g.player.maxHp;
    g.input.keys = new Set(((i / 80) % 1) > 0.6 ? [] : ["d", "s"]);
    if (g.enemies.active.length < 20) populate(20);
    /* Um golpe DE VERDADE pelo funil, de vez em quando. Sem ele o driver so
       consegue provocar quem dispara por cooldown, e uma peca `reactive` sai
       como "nao causou dano nenhum" por causa da MESA e nao por causa dela.

       Kill Shot foi quem escancarou isso: ele so acorda com `enemy_low`, que
       so e emitido quando alguem cai abaixo de 20% de vida — e numa mesa onde
       ele e a unica peca da build, nada leva ninguem ate la. `driver_vfx` ja
       tinha aprendido a mesma licao com o zero de escudo do Soul Leech. */
    if (i % 8 === 0) {
      const alvo = g.enemies.active[i % Math.max(1, g.enemies.active.length)];
      if (alvo && alvo.hp > 0) g.damageEnemy(alvo, alvo.maxHp * 0.45, "fixture", true);
    }
    g.update(0.025);
  }
}

/* --- 1. evolucoes ------------------------------------------------------- */
const evos = [];
for (const id in PIECES) {
  for (const pid in PIECES[id].paths || {}) {
    if (PIECES[id].paths[pid].evolvesInto) evos.push([id, pid, PIECES[id].paths[pid].evolvesInto]);
  }
}
console.log(`--- ${evos.length} evolucoes ---`);
for (const [id, pid, into] of evos) {
  g.start();
  abreEixos();
  try {
    const inst = g.build.acquirePiece(id) || g.build.get(PIECES[id].key);
    let evolved = null;
    for (let t = 0; t < PATH_RULES.tiers; t++) {
      const r = g.build.upgradePath(inst, pid);
      if (!r) { fail(`${id}.${pid}: caminho travou no tier ${t}`); break; }
      if (r.evolved) evolved = r.evolved;
    }
    if (!evolved) { fail(`${id}.${pid}: nao evoluiu no tier 5`); continue; }
    if (inst.defId !== into) fail(`${id}.${pid}: virou ${inst.defId}, esperado ${into}`);
    if (inst.key !== PIECES[id].key) fail(`${id}.${pid}: a key mudou na evolucao`);
    populate(30);
    simulate(6);
    const dealt = g.damageBy.get(inst.key) || 0;
    const trig = inst.r.trigger.type;
    console.log(`  ok ${PIECES[id].name} -> ${inst.def.name} (${trig})  ${Math.round(dealt)} de dano em 6s`);
    if (dealt <= 0 && ["grimoireOfSacrifice"].indexOf(into) < 0) {
      fail(`${into}: evoluiu mas nao causou dano nenhum em 6s`);
    }
  } catch (e) { fail(`${id}.${pid}: erro`, e); console.error(e.stack); }
}

/* --- 1b. a CORRENTE de duas evolucoes ------------------------------------
   Arcane Shot -> Aimed Shot -> Kill Shot e a primeira peca do jogo que evolui
   DUAS vezes, e ela existe so porque a `key` atravessa a troca. Tres coisas
   tem que valer, e as tres sao o que a `key` serve para segurar:

     - a `key` e a MESMA nas tres formas (medidor de dano, anti-recursao, e a
       origem dos eventos);
     - o medidor nao zera na troca — dano feito como Arcane Shot continua
       contado depois de virar Kill Shot;
     - a segunda evolucao sai de um caminho DIFERENTE do primeiro, porque o
       que evoluiu ja esta no tier 5 e nao sobe mais.

   `maxDeep` permite exatamente dois caminhos passarem do tier 2, entao a
   corrente cabe — e cabe com folga zero, que e o comprometimento que ela cobra. */
console.log("--- corrente de evolucao ---");
{
  g.start();
  abreEixos();
  const inst = g.build.acquirePiece("arcaneShot");
  const key0 = inst.key;
  for (let t = 0; t < PATH_RULES.tiers; t++) g.build.upgradePath(inst, "focus");
  const formaB = inst.def.id;
  populate(20);
  simulate(3);
  const meioDano = g.damageBy.get(key0) || 0;
  for (let t = 0; t < PATH_RULES.tiers; t++) g.build.upgradePath(inst, "arcane");
  const formaC = inst.def.id;
  simulate(3);
  const fimDano = g.damageBy.get(key0) || 0;

  if (formaB !== "aimedShot") fail(`corrente: 1a evolucao deu "${formaB}", esperado aimedShot`);
  else if (formaC !== "killShot") fail(`corrente: 2a evolucao deu "${formaC}", esperado killShot`);
  else if (inst.key !== key0) fail(`corrente: a key mudou (${key0} -> ${inst.key})`);
  else if (!meioDano) fail("corrente: a forma do meio nao causou dano — nao da para medir se o medidor sobreviveu");
  else if (fimDano <= meioDano) {
    fail(`corrente: o medidor nao andou depois da 2a troca (${meioDano} -> ${fimDano})`);
  } else {
    console.log(`  ok arcaneShot -> ${formaB} -> ${formaC}, key "${key0}" nas tres`);
    console.log(`  ok o medidor atravessou as duas trocas: ${Math.round(meioDano)} -> ${Math.round(fimDano)}`);
  }
  // e a segunda evolucao veio de OUTRO caminho: o primeiro esta no teto
  if (inst.paths.focus !== PATH_RULES.tiers || inst.paths.arcane !== PATH_RULES.tiers) {
    fail(`corrente: caminhos em ${inst.paths.focus}/${inst.paths.arcane}, esperado 5/5`);
  } else {
    console.log(`  ok os dois caminhos fechados (5/5), dentro do teto de ${PATH_RULES.maxDeep} profundos`);
  }
}

/* --- 2. capstones -------------------------------------------------------- */
console.log(`--- ${Object.keys(CAPSTONES).length} capstones ---`);
/* A run tem que ser da CLASSE do capstone. `checkCapstones` filtra por `cls`, e
   `build.axis` so tem as chaves dos eixos daquela classe — cravar
   `axis.trapping` numa run de warlock nao destrava nada, so cria uma chave que
   ninguem le. Foi essa a regra que o filtro por classe introduziu, e ela e a
   mesma que impede o capstone do hunter de abrir sozinho num warlock. */
const PECAS_DA_CLASSE = {
  warlock: ["corruption", "immolate", "wildImps", "felguard", "incinerate", "agony", "rainOfFire"],
  hunter: ["killCommand", "wildThrash", "tarTrap", "arcaneShot", "serpentSting",
           "shellCover", "raptorStrike"],
};
for (const cid in CAPSTONES) {
  const cap = CAPSTONES[cid];
  g.selectedClass = cap.cls;
  g.start();
  try {
    // pecas da classe, para os hooks terem com o que trabalhar
    for (const pid of PECAS_DA_CLASSE[cap.cls] || []) g.build.acquirePiece(pid);
    for (const a in cap.req) g.build.axis[a] = cap.req[a];
    const newly = g.build.checkCapstones();
    g.build.afterChange();
    if (!g.build.capstones.has(cid)) { fail(`${cid}: nao ativou com ${JSON.stringify(cap.req)}`); continue; }
    populate(40);
    simulate(10);
    let total = 0;
    for (const [k, v] of g.damageBy) if (k !== "fixture") total += v;
    console.log(`  ok ${cap.name.padEnd(12)} ${newly.length} ativado(s), ${Math.round(total / 1000)}k de dano, ` +
                `${g.minions.active.length} demonios, ${g.dots.active.length} dots`);
  } catch (e) { fail(`${cid}: erro`, e); console.error(e.stack); }
}
g.selectedClass = "warlock";

/* --- 3. regra dos 2 caminhos profundos ----------------------------------- */
console.log("--- regras estruturais ---");
g.start();
abreEixos();
const inst = g.build.acquirePiece("corruption") || g.build.get("corruption");
const ids = Object.keys(inst.def.paths);
for (let t = 0; t < 5; t++) g.build.upgradePath(inst, ids[0]);
for (let t = 0; t < 5; t++) g.build.upgradePath(inst, ids[1]);
for (let t = 0; t < 5; t++) g.build.upgradePath(inst, ids[2]);
const got = ids.map((p) => inst.paths[p]);
if (got[2] > PATH_RULES.freeTier) fail(`3o caminho passou do tier ${PATH_RULES.freeTier}: ${got.join("/")}`);
else console.log(`  ok caminhos ficaram em ${got.join("/")} (3o travado no tier ${PATH_RULES.freeTier})`);

// pool e teto de eixo
g.start();
let guard = 0;
while (g.build.axisLeft > 0 && guard++ < 200) {
  const offers = g.build.getOffers(3);
  if (!offers.length) break;
  g.build.applyOffer(offers[0]);
}
if (g.build.axisTotal > AXIS_RULES.pool) fail(`pool estourou: ${g.build.axisTotal}`);
else console.log(`  ok pool parou em ${g.build.axisTotal}/${AXIS_RULES.pool}`);
for (const a in g.build.axis) {
  if (g.build.axis[a] > AXIS_RULES.capPerAxis) fail(`eixo ${a} passou do teto: ${g.build.axis[a]}`);
}
console.log(`  ok eixos ${Object.values(g.build.axis).join("/")} dentro do teto de ${AXIS_RULES.capPerAxis}`);

// exclusao mutua das passivas
g.start();
g.build.acquirePassive("furiaContida");
if (!g.build.passiveBlocked("pesDeCinza")) fail("Pes de Cinza deveria estar bloqueada por Furia Contida");
else console.log("  ok Furia Contida bloqueia Pes de Cinza");

console.log(fails ? `\nX ${fails} falhas` : "\nok todas as verificacoes passaram");
if (fails) __exit(1);
