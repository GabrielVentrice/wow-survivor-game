/* Driver: o APICE — a onda que sai do corpo quando um eixo enche.

   Ele acontece UMA vez por run, no fim de uma sequencia de escolhas que uma
   run normal quase nunca faz, e por isso e exatamente o tipo de coisa que
   apodrece sem ninguem notar: ninguem joga ate os 15 pontos para conferir se
   ainda funciona.

   Cinco promessas, e cada uma quebra de um jeito diferente:

     1. o anel e desenhado ONDE mata     -> `VFX_LIFE.apex` e a varredura
     2. quem arma e a TRAVESSIA do teto  -> nao a cada ponto depois dele
     3. a onda sai com o jogo RODANDO    -> nao com a tela de etapa aberta
     4. ela varre o que esta em tela     -> e nao o que esta fora dela
        (inclusive quem ANDOU para dentro depois de a frente passar por ele)
     5. o chefe NAO morre                -> a ameaca da run continua em pe */
let s = 7;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

const g = new Game();
window.game = g;
let telaAberta = 0;
g.ui.openLevelUp = () => { telaAberta++; g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openMilestone = () => { telaAberta++; g.pendingMilestones = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };

/* --- 1. o dado: uma curva, dois consumidores ----------------------------- */
console.log("--- dado ---");
if (VFX_LIFE.apex !== BALANCE.apex.sweep) {
  fail(`a vida do anel (${VFX_LIFE.apex}) nao e a varredura (${BALANCE.apex.sweep})`
     + " — o anel fecharia antes ou depois de o dano chegar la");
}
if (!VOICES.apex) fail("evento visual sem voz em VOICES");
if (SCORCH_KINDS.apex !== 0) fail("o Apice deixa chamusco: ele nao queima o chao, varre o que esta em cima");
if (!(BALANCE.apex.bossFrac < 1)) {
  fail("bossFrac >= 1: o chefe morre na onda, e a ameaca da run inteira mora nele");
}
if (apexFront(0) !== 0 || apexFront(1) !== 1) fail("apexFront nao vai de 0 a 1");
let ant = -1, monot = true;
for (let i = 0; i <= 20; i++) { const f = apexFront(i / 20); if (f < ant) monot = false; ant = f; }
if (!monot) fail("a frente da onda volta atras em algum ponto");
if (!(apexFront(0.5) > 0.5)) fail("a frente nao desacelera — ela tem que sair rapido e morrer na borda");
console.log(`  ok curva unica: vida ${VFX_LIFE.apex}s = varredura, frente em 50% do tempo ja em `
  + `${Math.round(apexFront(0.5) * 100)}% do raio`);

/* --- 2. quem arma e a travessia do teto ---------------------------------- */
console.log("--- gatilho ---");
g.start();
const b = g.build, EIXO = "cataclysm";

b.addAxis(EIXO, AXIS_RULES.capPerAxis - 1);
if (g._apexQueued) fail(`o Apice armou com ${b.axis[EIXO]} pontos — o gatilho e o TETO`);
b.addAxis(EIXO, 1);
if (g._apexQueued !== EIXO) fail("o eixo encheu e o Apice nao armou");
if (g.apex) fail("a onda saiu dentro do `addAxis` — ali a tela de etapa esta aberta e o canvas apagado");
console.log(`  ok ${AXIS_RULES.capPerAxis - 1} pontos nao armam; o ${AXIS_RULES.capPerAxis}o arma, e em fila`);

/* --- 3 a 5. a onda -------------------------------------------------------- */
console.log("--- a onda ---");
const p = g.player;
p.x = 0; p.y = 0;
g.camera.x = 0; g.camera.y = 0;
/* Spawner e build desligados: o pool REUSA o objeto do corpo que caiu, entao
   uma leva nova no meio da varredura devolveria os mesmos `Enemy` vivos em
   outro lugar e a medida leria "sobreviveu". E o unico dano em campo tem que
   ser o da onda, senao Incinerate morde o chefe junto e a fracao nao fecha. */
g.spawner.update = () => {};
g.build.pieces.clear();
g.build.afterChange();
const R = Math.sqrt(Math.pow(g.camera.w / 2, 2) + Math.pow(g.camera.h / 2, 2));

/* Tres faixas, e a de fora e a que importa: uma onda que matasse por raio de
   tabela ou deixaria horda viva na borda em tela larga, ou mataria longe do
   que o jogador esta vendo. As duas mentem, e so a segunda e invisivel. */
const posta = (type, d) => {
  const a = Math.random() * Math.PI * 2;
  return g.enemies.spawn(type, Math.cos(a) * d, Math.sin(a) * d, g.spawner.scale);
};
const perto = [], borda = [], fora = [];
for (let i = 0; i < 12; i++) perto.push(posta(ENEMIES.ghoul, R * 0.45));
for (let i = 0; i < 12; i++) borda.push(posta(ENEMIES.ghoul, R * 0.92));
// fora de tela com folga para o passo que eles dao durante a varredura
for (let i = 0; i < 12; i++) fora.push(posta(ENEMIES.ghoul, R * 1.9));
const chefeTipo = Object.values(ENEMIES).find((t) => t.boss);
const chefe = posta(chefeTipo, R * 0.4);
const chefeHp = chefe.hp;
g.bossAlive = 1;

const antes = g.vfxLayer.pool.active.length;
g.update(0.016);
if (g._apexQueued) fail("a fila nao esvaziou no primeiro quadro de jogo");
if (!g.apex) fail("a onda nao saiu quando o jogo voltou a rodar");
const anel = g.vfxLayer.pool.active.slice(antes).find((v) => v.kind === "apex");
if (!anel) fail("nenhum evento visual `apex` foi emitido");
else if (Math.abs(anel.r - R) > 1) fail(`o anel foi desenhado em ${anel.r | 0} e a tela pede ${R | 0}`);

/* A tela espera a onda. O XP de duzentos corpos abre level up quase sempre no
   meio da varredura, e uma carta subindo por cima cortaria o pagamento da
   unica escolha da run que nao volta — alem de congelar a simulacao enquanto
   o anel continua correndo. */
p.pendingLevels = 1;
telaAberta = 0;
let passos = 0, durante = 0;
while (g.apex && passos < 200) {
  g.update(0.016);
  // a onda ainda de pe no fim do update e a tela ja aberta = ela furou a fila
  if (g.apex && telaAberta) durante++;
  passos++;
}
if (durante) fail("uma tela abriu no meio da varredura");
if (passos >= 200) fail("a onda nunca terminou");
if (!telaAberta) fail("a tela ficou presa depois que a onda acabou");

const vivos = (l) => l.filter((e) => e.hp > 0 && !e.dead).length;
if (vivos(perto)) fail(`${vivos(perto)} de ${perto.length} sobreviveram a 45% do raio`);
if (vivos(borda)) fail(`${vivos(borda)} de ${borda.length} sobreviveram na borda da tela`);
if (vivos(fora) !== fora.length) {
  fail(`a onda matou ${fora.length - vivos(fora)} corpo(s) fora da tela — ela varre o que se ve`);
}
console.log(`  ok ${perto.length + borda.length - vivos(perto) - vivos(borda)} corpos em tela caem em ${(passos * 0.016).toFixed(2)}s`
  + `, os ${vivos(fora)} de fora seguem vivos`);

if (chefe.hp <= 0 || chefe.dead) fail("o chefe morreu na onda");
else {
  const levou = 1 - chefe.hp / chefeHp;
  const quer = BALANCE.apex.bossFrac;
  // uma mordida, nao uma por sub-step: a frente e uma fronteira e o chefe
  // continua dentro dela ate o fim, entao quem o protege e o `Set` de mordidos
  if (Math.abs(levou - quer) > 0.02) {
    fail(`o chefe levou ${(levou * 100).toFixed(0)}% e a tabela diz ${(quer * 100) | 0}%`
       + " — a onda o visitou mais de uma vez");
  } else console.log(`  ok o chefe leva ${(levou * 100).toFixed(0)}% e continua em pe`);
}

/* --- 6. nao repete -------------------------------------------------------- */
console.log("--- uma vez por run ---");
b.addAxis(EIXO, 3);                    // eixo ja no teto: credita 0
if (g._apexQueued) fail("o Apice armou de novo num eixo que ja estava cheio");
b.axis[EIXO] = AXIS_RULES.capPerAxis - 1;
b.addAxis(EIXO, 1);                    // volta a cruzar o teto na marra
if (g._apexQueued) fail("o Apice armou duas vezes no mesmo eixo");
console.log("  ok o eixo cheio nao rearma a onda em nenhuma etapa seguinte");

/* E o segundo eixo? Com pool de 20 e teto de 15 ele nao cabe, mas quem segura
   isso e `AXIS_RULES` e nao o Apice: se a pool crescer, a onda tem que sair de
   novo — o fato que ela anuncia e "ESTE eixo encheu". */
b.axis.corruption = 0; b.axis.dominion = 0; b.axis[EIXO] = 0;
b.addAxis("corruption", AXIS_RULES.capPerAxis);
if (g._apexQueued !== "corruption") fail("um segundo eixo cheio nao arma o Apice dele");
console.log("  ok um eixo diferente chegando ao teto arma a propria onda");

console.log(fails ? `\nX ${fails} falhas` : "\nok o Apice validado");
if (fails) __exit(1);
