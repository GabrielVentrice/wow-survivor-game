/* DRIVER — ASPECTOS: as condições ligam, desligam, e NÃO piscam.

   O que este driver mede é a coisa que um driver de fumaça não vê: um aspecto
   com a condição certa e sem histerese roda, não estoura, e destrói a sensação
   de jogo — o estado bate e volta dezenas de vezes por segundo exatamente na
   borda da condição, que é onde o jogador mais fica, porque a condição é sobre
   a posição dele.

   Uso:  DRIVER=driver_aspect.js node tools/harness.js .
   ========================================================================= */
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

const g = new Game();
window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };

function mesa(ids) {
  g.selectedClass = "hunter";
  g.start();
  g.build.pieces.clear();
  g.aspects.reset();
  g.enemies.clear(); g.areas.clear(); g.minions.reset(); g.projectiles.clear();
  g.spawner.interval = 1e9;
  for (const id of ids) g.build.acquirePiece(id, true);
}
function passo(n, keys) {
  for (let i = 0; i < n; i++) { g.input.keys = new Set(keys || []); g.update(0.025); }
}
function bicho(x, y) { return g.enemies.spawn(ENEMIES.ghoul, x, y, g.spawner.scale); }
const ativo = (id) => g.aspects.active.indexOf(id) >= 0;

/* --- 1. o dado: toda condição tem VÃO ------------------------------------ */
console.log("--- histerese no dado ---");
{
  let ok = true;
  for (const id in ASPECTS) {
    const w = ASPECTS[id].when;
    if (!ASPECT_READS[w.read]) { fail(`${id}: leitura desconhecida "${w.read}"`); ok = false; }
    /* `on === off` é um limiar único, e limiar único É o pisca. A regra não é
       "declare histerese": é que ligar e desligar não podem ser o mesmo
       número, porque o vão entre eles É a histerese. */
    if (w.on === w.off) { fail(`${id}: liga e desliga no mesmo valor (${w.on}) — sem histerese`); ok = false; }
  }
  if (ok) console.log(`  ok ${Object.keys(ASPECTS).length} aspectos, todos com vão entre ligar e desligar`);
}

/* --- 2. o teto de slots -------------------------------------------------- */
console.log("--- slots ---");
{
  const todos = Object.values(PIECES).filter((p) => p.trigger.type === "aspect");
  mesa(todos.map((p) => p.id));
  const teto = BALANCE.aspect.slots;
  if (g.aspects.slots.length !== teto) {
    fail(`${todos.length} peças de aspecto na build deram ${g.aspects.slots.length} slots, esperado ${teto}`);
  } else {
    console.log(`  ok ${todos.length} peças de aspecto, ${g.aspects.slots.length}/${teto} slots tomados`);
  }
}

/* --- 3. cada condição liga de verdade ------------------------------------ */
console.log("--- as seis condições ---");
{
  // Guepardo: sem inimigo por perto
  mesa(["aspectOfTheCheetah"]);
  passo(120);
  if (!ativo("cheetah")) fail("cheetah: campo vazio e a postura não ligou");
  else {
    const base = g.player.baseSpeed;
    if (g.player.speed <= base) fail(`cheetah: ativo mas a velocidade não subiu (${g.player.speed} vs ${base})`);
    else console.log(`  ok cheetah liga com o campo vazio: ${base} -> ${g.player.speed.toFixed(0)} de passo`);
  }
  // e DESLIGA quando a horda chega
  for (let i = 0; i < 6; i++) bicho(g.player.x + 40 + i * 8, g.player.y);
  passo(160);
  if (ativo("cheetah")) fail("cheetah: seis inimigos encostados e a postura continuou de pé");
  else console.log("  ok cheetah desliga quando a horda chega");
}
{
  // Falcão: parado há 2s. E a tag `shot` é o que ele amplifica.
  mesa(["aspectOfTheHawk", "arcaneShot"]);
  passo(200, ["d"]);
  if (ativo("hawk")) fail("hawk: andando o tempo todo e a postura ligou");
  else console.log("  ok hawk não liga enquanto o jogador anda");
  passo(200, []);
  if (!ativo("hawk")) fail("hawk: 5s parado e a postura não ligou");
  else {
    const ch = g.aspects.ch;
    if (!ch.tagKeys || !ch.tagKeys.has("arcaneShot")) {
      fail("hawk: ativo mas o Set de tag não pegou a peça de tiro");
    } else {
      console.log(`  ok hawk liga parado e amplifica ${ch.tagKeys.size} peça(s) de tiro em ${ch.tagMul}x`);
    }
  }
}
{
  // Tartaruga: abaixo de 30% de vida
  mesa(["aspectOfTheTurtle"]);
  g.player.hp = g.player.maxHp * 0.2;
  passo(120);
  if (!ativo("turtle")) fail("turtle: vida em 20% e a postura não ligou");
  else if (g.player.dmgReduction <= 0) fail("turtle: ativo mas sem redução de dano");
  else console.log(`  ok turtle liga abaixo de 30%: ${(g.player.dmgReduction * 100).toFixed(0)}% de redução, dano x${g.aspects.ch.damageMul}`);
}
{
  // Víbora: acima de 90% de vida, e o dano volta como cura
  mesa(["aspectOfTheViper"]);
  g.player.hp = g.player.maxHp;
  passo(120);
  if (!ativo("viper")) fail("viper: vida cheia e a postura não ligou");
  else {
    g.player.hp = g.player.maxHp * 0.95;
    const antes = g.player.hp;
    const alvo = bicho(g.player.x + 60, g.player.y);
    alvo.maxHp = alvo.hp = 1e6;
    g.damageEnemy(alvo, 1000, "fixture");
    if (g.player.hp <= antes) fail("viper: ativo e o dano causado não curou nada");
    else console.log(`  ok viper liga com a vida cheia: 1000 de dano devolveu ${(g.player.hp - antes).toFixed(0)} de vida`);
  }
}
{
  // Águia: 5+ inimigos por perto, e o alcance de TODA peça sobe
  mesa(["aspectOfTheEagle"]);
  passo(80);
  if (ativo("eagle")) fail("eagle: campo vazio e a postura ligou");
  for (let i = 0; i < 8; i++) bicho(g.player.x + 60 + i * 10, g.player.y + i * 6);
  passo(120);
  if (!ativo("eagle")) fail("eagle: oito inimigos por perto e a postura não ligou");
  else if (g.aspects.ch.rangeMul <= 1) fail("eagle: ativo mas rangeMul continuou 1");
  else console.log(`  ok eagle liga com 8 por perto: alcance x${g.aspects.ch.rangeMul}`);
}
{
  // Selvagem: 3+ bichos vivos, e a matilha inteira acelera
  mesa(["aspectOfTheWild", "wildThrash"]);
  passo(200);
  const n = g.minions.count();
  if (n < 3) fail(`wild: só ${n} bichos em campo, a condição não pôde ser medida`);
  else if (!ativo("wild")) fail(`wild: ${n} bichos vivos e a postura não ligou`);
  else {
    const m = g.minions.pool.active.find((x) => !x.dead);
    if (!(m.speed > m.baseSpeed)) fail("wild: ativo mas o bicho não ficou mais rápido");
    else console.log(`  ok wild liga com ${n} bichos: passo ${m.baseSpeed} -> ${m.speed.toFixed(0)}`);
  }
}

/* --- 4. exclusão mútua --------------------------------------------------- */
console.log("--- exclusão mútua ---");
{
  /* Guepardo (correndo, sem ninguém perto) e Falcão (parado, mirando) são
     posturas OPOSTAS. Com o campo vazio e o jogador parado as duas condições
     estão satisfeitas ao mesmo tempo — e é justamente aí que o par não pode
     aparecer aceso junto, senão o corpo diz que está fazendo as duas coisas. */
  mesa(["aspectOfTheCheetah", "aspectOfTheHawk"]);
  passo(300, []);
  const os = ["cheetah", "hawk"].filter(ativo);
  if (os.length > 1) fail(`postura: cheetah e hawk acesos juntos (${os.join(" + ")})`);
  else if (!os.length) fail("postura: campo vazio e parado e NENHUMA das duas ligou");
  else console.log(`  ok cheetah e hawk nunca juntos — venceu "${os[0]}" (maior prioridade do grupo)`);
}

/* --- 5. o pisca ---------------------------------------------------------- */
console.log("--- o pisca ---");
{
  /* A medida que importa. O jogador é posto EXATAMENTE na borda da condição e
     sacudido em volta dela — que é o que acontece de verdade quando ele corrige
     posição num survivors. Sem histerese, o estado segue esse tremor. */
  mesa(["aspectOfTheEagle"]);
  const alvos = [];
  for (let i = 0; i < 4; i++) alvos.push(bicho(g.player.x + 100, g.player.y + i * 12));
  passo(80);
  let viradas = 0, antes = ativo("eagle");
  const borda = [];
  for (let i = 0; i < 400; i++) {
    // o quinto inimigo entra e sai do alcance a cada quadro: o tremor máximo
    const extra = i % 2 === 0;
    for (const a of alvos) { a.x = g.player.x + 100; a.hp = a.maxHp; }
    if (extra && borda.length < 2) borda.push(bicho(g.player.x + 110, g.player.y - 20));
    for (const b of borda) { b.x = g.player.x + (extra ? 110 : 4000); b.hp = b.maxHp; }
    passo(1);
    const agora = ativo("eagle");
    if (agora !== antes) { viradas++; antes = agora; }
  }
  const segundos = 400 * 0.025;
  const teto = Math.ceil(segundos / BALANCE.aspect.hold) + 1;
  /* Zero viradas passaria por "não pisca" e seria a pior aprovação possível:
     um aspecto que nunca liga também nunca pisca. A trava é dos dois lados. */
  if (!viradas) {
    fail("pisca: eagle nunca virou em 10s de borda — a condição não foi alcançada, o teste não mediu nada");
  } else if (viradas > teto) {
    fail(`pisca: ${viradas} viradas em ${segundos}s com o jogador na borda — teto ${teto} (hold ${BALANCE.aspect.hold}s)`);
  } else {
    console.log(`  ok na borda da condição: ${viradas} virada(s) em ${segundos}s (teto ${teto}, hold ${BALANCE.aspect.hold}s)`);
  }
}
{
  // E o piso de permanência vale para os dois lados: ligar cedo é tão ruim
  // quanto desligar cedo.
  mesa(["aspectOfTheTurtle"]);
  let viradas = 0, antes = ativo("turtle");
  for (let i = 0; i < 400; i++) {
    // a vida oscila em cima do limiar de 30% a cada quadro
    g.player.hp = g.player.maxHp * (i % 2 === 0 ? 0.29 : 0.31);
    passo(1);
    const agora = ativo("turtle");
    if (agora !== antes) { viradas++; antes = agora; }
  }
  if (!viradas) fail("pisca: turtle nunca virou — a condição não foi alcançada");
  else if (viradas > 2) fail(`pisca: turtle virou ${viradas}x com a vida oscilando em cima do limiar`);
  else console.log(`  ok vida oscilando em cima de 30%: ${viradas} virada(s) em 10s`);
}

/* --- 6. o warlock não tem aspecto ---------------------------------------- */
console.log("--- warlock ---");
{
  g.selectedClass = "warlock";
  g.start();
  if (g.aspects.slots.length) fail(`warlock começou com ${g.aspects.slots.length} aspecto(s)`);
  const ch = g.aspects.ch;
  const neutro = ch.speedMul === 1 && ch.rangeMul === 1 && ch.dmgReduction === 0 &&
                 ch.damageMul === 1 && ch.lifesteal === 0 && ch.beastMul === 1 && !ch.tagKeys;
  if (!neutro) fail("os canais de aspecto não estão neutros numa run de warlock");
  else console.log("  ok warlock: nenhum slot, todos os canais neutros");
  const doWarlock = Object.values(PIECES).filter(
    (p) => p.cls === "warlock" && p.trigger.type === "aspect");
  if (doWarlock.length) fail("peça de warlock com trigger aspect: " + doWarlock.map((p) => p.id).join(", "));
  else console.log("  ok nenhuma peça do warlock usa o trigger `aspect`");
}

console.log(fails ? `\nX ${fails} falha(s) nos aspectos` : "\nok aspectos validados");
if (fails) __exit(1);
