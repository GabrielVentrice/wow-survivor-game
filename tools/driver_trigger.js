/* DRIVER — os tres triggers do hunter: `trap`, `leading` e `pack`.

   O que ele cobra nao e "nao estourou": e o CONTRATO de cada um, que e a
   unica coisa que separa um trigger novo de uma copia do `autonomous` com
   outro nome. Cada bloco abaixo mede a regra que faz o trigger existir, e as
   regras foram escolhidas por serem as que quebram em silencio — armadilha que
   nunca rearma, bomba que some quando o jogador para, matilha que cerca pelo
   mesmo lado.

   Uso:  DRIVER=driver_trigger.js node tools/harness.js .
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

/* A mesa e um banco de teste do HUNTER, e ele ainda nao e selecionavel (fase
   3). `start()` monta a run com a classe do menu, entao o driver troca a
   classe ANTES e limpa o kit inicial dela — as pecas entram uma a uma, para
   cada bloco medir um trigger e nao a build inteira. */
function mesa(pieceId) {
  g.selectedClass = "hunter";
  g.start(aberturaDaClasse("hunter"));
  g.build.pieces.clear();
  g.enemies.clear(); g.areas.clear(); g.minions.reset(); g.projectiles.clear();
  g.spawner.interval = 1e9;                 // a horda nao entra sem ser chamada
  for (const a of g.build.axes) g.build.axis[a] = 0;
  const inst = g.build.acquirePiece(pieceId, true);
  if (!inst) fail(`${pieceId}: nao entrou na build`);
  return inst;
}

function passo(n, keys) {
  for (let i = 0; i < n; i++) {
    g.player.hp = g.player.maxHp;
    g.input.keys = new Set(keys || []);
    g.update(0.025);
  }
}

function bicho(x, y) {
  return g.enemies.spawn(ENEMIES.ghoul, x, y, g.spawner.scale);
}

/* ==========================================================================
   1. TRAP — inerte ate alguem pisar, com carga e rearme
   ========================================================================== */
console.log("--- trap: Tar Trap ---");
{
  const inst = mesa("tarTrap");
  const t = inst.r.trigger;
  const cargas = Math.round(t.charges);

  // 1a. planta no ponto do PLAYER, e para no teto de cargas.
  passo(400);
  const armadas = g.areas.active.filter((a) => a.armed && !a.dead);
  if (!armadas.length) fail("trap: nada foi plantado em 10s");
  if (armadas.length > cargas) {
    fail(`trap: ${armadas.length} armadilhas no chao contra o teto de ${cargas}`);
  } else {
    console.log(`  ok planta e para no teto: ${armadas.length}/${cargas} no chao`);
  }
  const longe = armadas.filter((a) => Math.hypot(a.x - g.player.x, a.y - g.player.y) > 400);
  if (longe.length) fail("trap: armadilha plantada longe do player");

  // 1b. INERTE: com um inimigo fora do raio, ela nao cobra nada.
  const fora = bicho(g.player.x + 900, g.player.y + 900);
  const hp0 = fora.hp;
  passo(120);
  if (fora.hp < hp0) fail("trap: armadilha cobrou de quem nunca pisou nela");
  else console.log("  ok inerte: 3s com inimigo em campo e nenhum dano cobrado");

  // 1c. DISPARA no contato, e o que sai e o `onEnd` (a poca).
  const alvo = armadas[0];
  const pocas0 = g.areas.active.filter((a) => !a.armed && !a.dead).length;
  const pisou = bicho(alvo.x, alvo.y);
  /* Vida cravada ANTES de simular. Cravando depois, o ghoul ja morreu no
     primeiro tique da poca e foi varrido — a referencia aponta para um objeto
     devolvido ao pool, e a medida seguinte le um cadaver reaproveitado. */
  pisou.maxHp = pisou.hp = 1e6;
  passo(20);
  if (!alvo.dead) fail("trap: inimigo em cima e a armadilha continuou armada");
  const pocas1 = g.areas.active.filter((a) => !a.armed && !a.dead).length;
  if (pocas1 <= pocas0) fail("trap: disparou e nao abriu a poca do onEnd");
  else console.log(`  ok dispara no contato e abre a poca (${pocas0} -> ${pocas1})`);

  /* 1d. a poca cobra de quem esta nela — a armadilha nao cobrava, ela cobra.
     A vida e cravada alta de proposito: com a vida de um ghoul comum o alvo
     morre no primeiro tique e a medida vira "0 de dano" num cadaver. */
  const hp1 = pisou.hp;
  passo(60);
  if (pisou.hp >= hp1) fail("trap: a poca aberta pela armadilha nao cobra dano");
  else console.log(`  ok a poca cobra: ${(hp1 - pisou.hp).toFixed(0)} de dano em 1.5s`);

  /* 1e. REARMA depois do cooldown, repondo a carga consumida.

     A conta e de PLANTIOS na janela, e nao de armadilhas em pe no fim dela. O
     campo e limpo antes: com o ghoul imortal do bloco anterior parado em cima
     do jogador, toda armadilha nova era pisada no quadro em que nascia, e o
     "0 no chao" media o ghoul e nao o rearme.

     E a conta e de zona ARMADA. Contar toda zona da peca foi o bug que este
     bloco achou: a poca que a armadilha abre tem a mesma `source`, entao ela
     consumia a propria carga e a peca parava de rearmar ate a poca vencer. */
  g.enemies.clear(); g.areas.clear();
  let plantios = 0;
  const spawnOrig = g.areas.spawn.bind(g.areas);
  g.areas.spawn = (o) => { if (o.armed && o.source === inst.key) plantios++; return spawnOrig(o); };
  const janela = t.cooldown * (cargas + 1) + 1;
  passo(Math.ceil(janela / 0.025));
  g.areas.spawn = spawnOrig;
  if (plantios < cargas) {
    fail(`trap: ${plantios} plantios em ${janela.toFixed(1)}s, esperado pelo menos ${cargas} (cooldown ${t.cooldown}s)`);
  } else {
    console.log(`  ok rearma por cooldown: ${plantios} plantios em ${janela.toFixed(1)}s`);
  }
}

/* A armadilha que VENCE o prazo sem ninguem pisar nao pode detonar: detonar no
   vencimento faria o `onEnd` virar o comportamento normal da peca, e a peca
   deixaria de cobrar posicionamento. */
{
  const inst = mesa("tarTrap");
  passo(80);
  const a = g.areas.active.find((z) => z.armed && !z.dead);
  if (!a) fail("trap: nada plantado para medir o vencimento");
  else {
    const pocas0 = g.areas.active.filter((z) => !z.armed && !z.dead).length;
    a.life = 0.01;                       // vence agora, sem ninguem por perto
    passo(4);
    const pocas1 = g.areas.active.filter((z) => !z.armed && !z.dead).length;
    if (!a.dead) fail("trap: armadilha vencida continuou no chao");
    else if (pocas1 > pocas0) fail("trap: armadilha vencida DETONOU sem ninguem pisar");
    else console.log("  ok vence sem detonar quando ninguem pisa");
  }
}

/* Quem pisou vira o alvo do `onEnd`. Sem isso todo efeito que mira — stun,
   mark, DoT — perde o unico corpo que a armadilha tem certeza de ter. */
{
  const inst = mesa("tarTrap");
  inst.r.effects[0].onEnd.push({ type: "stun", duration: 3 });
  passo(80);
  const a = g.areas.active.find((z) => z.armed && !z.dead);
  const e = bicho(a.x, a.y);
  passo(20);
  if (!(e.stunUntil > g.clock)) fail("trap: quem pisou nao chegou como alvo no onEnd");
  else console.log("  ok quem pisou chega como alvo do onEnd (stun aplicado no corpo)");
}

/* ==========================================================================
   2. LEADING — planta A FRENTE, e nao desliga quando o jogador para
   ========================================================================== */
console.log("--- leading: Wildfire Bomb ---");
{
  const inst = mesa("wildfireBomb");
  const dist = inst.r.trigger.distance;

  /* 2a. andando: o efeito cai a `distance` do player, no vetor de movimento.

     A medida e no QUADRO em que a zona aparece, e nao no fim da simulacao: a
     bomba fica parada e o player continua andando a 250u/s, entao um segundo
     depois ela esta atras dele — e a primeira versao deste bloco reprovou o
     motor por isso, medindo a caminhada em vez do arremesso. */
  let medido = null;
  for (let i = 0; i < 200 && !medido; i++) {
    const p = g.player;
    const px = p.x, py = p.y, dx = p.dirX, dy = p.dirY;
    passo(1, ["d"]);
    const z = g.areas.active.filter((a) => !a.dead)[0];
    if (z) medido = { d: Math.hypot(z.x - px, z.y - py), frente: (z.x - px) * dx + (z.y - py) * dy };
  }
  if (!medido) fail("leading: nada foi plantado andando");
  else if (medido.frente <= 0) fail(`leading: plantou ATRAS do player (proj ${medido.frente.toFixed(0)})`);
  /* A folga e UM passo de jogador (`speed * dt`), e nao um numero redondo: o
     trigger dispara dentro do `update`, depois de `player.update` ter andado o
     sub-step. Medindo a posicao de antes, a distancia sai um passo maior — e e
     exatamente essa a diferenca, nao um erro do trigger. */
  else if (Math.abs(medido.d - dist) > g.player.speed * 0.025 + 1) {
    fail(`leading: caiu a ${medido.d.toFixed(0)}u do player, esperado ${dist} (\`distance\`)`);
  } else {
    console.log(`  ok planta a frente, na distancia declarada: ${medido.d.toFixed(0)}u (stat ${dist})`);
  }
}
{
  /* 2b. PARADO ele continua disparando, usando a ultima direcao valida. E a
     unica diferenca real para `directional`, entao e ela que o driver mede: com
     `directional` este bloco sairia com zero zonas. */
  const inst = mesa("wildfireBomb");
  passo(40, ["w"]);                       // anda para cima, fixa dirY = -1
  const dir = { x: g.player.dirX, y: g.player.dirY };
  g.areas.clear();
  passo(200, []);                         // e agora fica PARADO
  const zonas = g.areas.active.filter((a) => !a.dead);
  if (!zonas.length) fail("leading: parado, a peca deixou de disparar (isso e `directional`)");
  else {
    const p = g.player;
    const frente = (zonas[0].x - p.x) * dir.x + (zonas[0].y - p.y) * dir.y;
    if (frente <= 0) fail("leading: parado, nao usou a ultima direcao valida");
    else console.log(`  ok parado continua disparando na ultima direcao (projecao +${frente.toFixed(0)})`);
  }
}
{
  /* 2c. o cooldown e respeitado: nao e uma bomba por sub-step — `update` roda
     de duas a quatro vezes por frame, entao um trigger que contasse quadros
     entregaria a peca inteira de uma vez.

     A conta e por ZONA criada, e nao pelo vfx da detonacao: `damage_instant`
     sai cedo quando nao ha ninguem no raio, entao numa mesa vazia ele nunca
     emite e a primeira versao deste bloco contou zero disparos de uma peca que
     estava disparando. A zona de fogo e o efeito que sempre roda. */
  const inst = mesa("wildfireBomb");
  const cd = inst.r.trigger.cooldown;
  const segundos = 6;
  let disparos = 0;
  const orig = g.areas.spawn.bind(g.areas);
  g.areas.spawn = (o) => { if (o.source === inst.key) disparos++; return orig(o); };
  passo(segundos / 0.025, ["d"]);
  g.areas.spawn = orig;
  const esperado = Math.floor(segundos / cd) + 1;
  if (disparos > esperado + 1) fail(`leading: ${disparos} disparos em ${segundos}s, esperado ~${esperado} (cooldown ${cd}s)`);
  else console.log(`  ok cadencia: ${disparos} disparos em ${segundos}s (cooldown ${cd}s)`);
}

/* ==========================================================================
   3. PACK — leva, slots repartidos e cerco por lados diferentes
   ========================================================================== */
console.log("--- pack: Wild Thrash ---");
{
  const inst = mesa("wildThrash");
  const cap = Math.round(inst.r.trigger.count);

  // 3a. nasce em LEVA. `autonomous` entrega um por `interval`; a matilha
  //     inteira tem que estar em campo no primeiro disparo.
  passo(8);
  const leva = g.minions.countOf(inst.key);
  if (leva < cap) fail(`pack: primeira leva trouxe ${leva} de ${cap} — isso e \`autonomous\``);
  else console.log(`  ok nasce em leva: ${leva}/${cap} no primeiro disparo`);

  // 3b. e para no teto.
  passo(600);
  const vivos = g.minions.countOf(inst.key);
  if (vivos > cap) fail(`pack: ${vivos} lobos contra o teto de ${cap}`);
  else console.log(`  ok teto respeitado: ${vivos}/${cap} depois de 15s`);

  // 3c. SLOTS distintos. `MINION_AI.flank` usa `m.angle` como identidade de
  //     posicao: dois lobos com o mesmo angulo cercam pelo mesmo lado, e a
  //     matilha volta a ser um borrao.
  const angulos = g.minions.pool.active
    .filter((m) => m.source === inst.key && !m.dead)
    .map((m) => ((m.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
  const distintos = new Set(angulos.map((a) => a.toFixed(3)));
  if (distintos.size < angulos.length) {
    fail(`pack: ${angulos.length} lobos em ${distintos.size} slots — dois cercam pelo mesmo lado`);
  } else {
    console.log(`  ok ${angulos.length} lobos em ${distintos.size} slots distintos`);
  }
}
{
  /* 3d. FLANK cerca: com um alvo so, os lobos chegam por lados diferentes. A
     medida e o espalhamento angular deles em volta do alvo — `chase` levaria
     todos pela mesma linha e o espalhamento colapsaria. */
  const inst = mesa("wildThrash");
  passo(8);
  const alvo = bicho(g.player.x + 300, g.player.y);
  alvo.hp = alvo.maxHp = 1e9;             // nao pode morrer no meio da medida
  for (let i = 0; i < 200; i++) {
    alvo.x = g.player.x + 300; alvo.y = g.player.y;   // ancorado
    passo(1);
  }
  const lobos = g.minions.pool.active.filter((m) => m.source === inst.key && !m.dead);
  const angs = lobos.map((m) => Math.atan2(m.y - alvo.y, m.x - alvo.x));
  let maxGap = 0;
  for (let i = 0; i < angs.length; i++) {
    for (let j = i + 1; j < angs.length; j++) {
      let d = Math.abs(angs[i] - angs[j]) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d > maxGap) maxGap = d;
    }
  }
  const graus = maxGap * 180 / Math.PI;
  if (lobos.length < 2) fail("pack: menos de dois lobos para medir o cerco");
  else if (graus < 40) fail(`pack: os lobos cercam pelo mesmo lado (${graus.toFixed(0)} graus entre os extremos) — isso e \`chase\``);
  else console.log(`  ok cerco por lados diferentes: ${graus.toFixed(0)} graus entre os lobos extremos`);
}

/* ==========================================================================
   4. O WARLOCK nao encostou em nada disso
   ========================================================================== */
console.log("--- warlock ---");
{
  const novos = ["trap", "leading", "pack"];
  const usa = Object.values(PIECES)
    .filter((p) => p.cls === "warlock" && novos.indexOf(p.trigger.type) >= 0);
  if (usa.length) fail(`warlock usa trigger novo: ${usa.map((p) => p.id).join(", ")}`);
  else console.log(`  ok nenhuma das ${Object.values(PIECES).filter((p) => p.cls === "warlock").length} pecas do warlock usa trigger novo`);

  const armadas = Object.values(PIECES).filter(
    (p) => p.cls === "warlock" && JSON.stringify(p.effects || []).indexOf('"armed"') >= 0);
  if (armadas.length) fail(`warlock com zona armada: ${armadas.map((p) => p.id).join(", ")}`);
  else console.log("  ok nenhuma zona do warlock nasce armada");
}

console.log(fails ? `\nX ${fails} falha(s) nos triggers` : "\nok triggers do hunter validados");
if (fails) __exit(1);
