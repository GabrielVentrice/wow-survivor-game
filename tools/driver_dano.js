/* Driver: o NUMERO DE DANO e a RESPOSTA DE VIDA BAIXA.

   O numero e a unica coisa do jogo que pode se estragar por SUCESSO: quanto
   melhor a build fica, mais ele aparece, e a partir de algum ponto ele para de
   informar e vira parede de digitos. `spawn.maxAlive` e 4400 e a curva mede
   ~100 abates/s aos 10 min — nenhum olho le isso.

   Entao o que este driver mede nao e "ele aparece?". E:

     1. as tres travas    -> limiar por fracao, teto de vivos, fusao por quadro
     2. a densidade       -> quantos ficam vivos, e quantos sao CORTADOS pelo
                             teto em vez de morrerem de idade (numero cortado
                             no meio do voo le como pisca-pisca, nao como dano)
     3. a leitura         -> cor = eixo (R2), osso puro nunca (reserva), o
                             vermelho so no dano tomado
     4. tempo REAL        -> como o hitstop, e pelo mesmo motivo: e leitura
     5. vida baixa        -> uma curva, dois consumidores, em fase

   A trava 2 e a unica que nao tem resposta certa em tabela: o alvo e "da para
   ler", nao "aparece sempre". Por isso ela IMPRIME a curva por minuto alem de
   reprovar — o numero que interessa quando `fracMin` for mexido esta ali. */
let s = 11;
Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };
const D = BALANCE.dano, V = BALANCE.vidaBaixa;

/* --- 1. o dado ----------------------------------------------------------- */
console.log("--- dado ---");
if (!(D.fracMin > 0 && D.fracMin < 1)) fail("fracMin fora de (0,1): o limiar e uma FRACAO do corpo, nao um valor");
if (!(D.fracAlta > D.fracMin)) fail("fracAlta <= fracMin: a brasa sairia em todo numero");
if (!(D.pool > 0)) fail("pool <= 0");
if (!(D.vida > 0)) fail("vida <= 0");
if (!(D.px[1] > D.px[0] && D.px[0] >= 14)) {
  fail(`faixa de tamanho ${D.px} invalida — o piso do projeto e 14px e nao cede`);
}
if (!(D.tomadoMin > 0)) fail("tomadoMin <= 0: o vermelho sairia em todo encosto");
if (!(V.em > 0 && V.em < 1)) fail("vidaBaixa.em fora de (0,1)");
if (!(V.pulso > 0)) fail("vidaBaixa.pulso <= 0");
if (!(V.vinheta > 0 && V.vinheta <= 1)) fail("vidaBaixa.vinheta fora de (0,1]");
console.log(`  ok limiar ${(D.fracMin * 100) | 0}% do corpo, brasa em ${(D.fracAlta * 100) | 0}%, `
  + `pool ${D.pool}, ${D.vida}s, ${D.px[0]}–${D.px[1]}px`);

const g = new Game();
window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
g.start();

const N = g.dmgNums;
const vivos = () => N.slots.filter((x) => x.alive).length;
/* Um corpo de teste em posicao conhecida. O spawner fica desligado o resto do
   driver: uma leva nova reusaria os mesmos objetos de `Enemy` e a fusao
   passaria a medir o pool de corpos em vez de si mesma. */
g.spawner.update = () => {};
const posta = (hp) => {
  const e = g.enemies.spawn(ENEMIES.ghoul, g.player.x + 60, g.player.y, g.spawner.scale);
  e.maxHp = hp; e.hp = hp;
  return e;
};

/* --- 2. as tres travas --------------------------------------------------- */
console.log("--- as tres travas ---");

// (a) limiar por FRACAO, e nao por valor absoluto. O mesmo golpe de 30 fala
//     num corpo de 100 e cala num de 1000 — e e essa a promessa: um ghoul de
//     20 HP nao pode sumir da tela junto com um Aniquilador de 2600.
N.reset();
const fraco = posta(1000);
g.damageEnemy(fraco, 1000 * (D.fracMin * 0.5), "incinerate");
if (vivos() !== 0) fail(`golpe de ${(D.fracMin * 50) | 0}% do corpo desenhou numero — o limiar e ${(D.fracMin * 100) | 0}%`);
N.frame++;
g.damageEnemy(fraco, 1000 * (D.fracMin * 1.2), "incinerate");
if (vivos() !== 1) fail("golpe acima do limiar nao desenhou numero");
N.reset();
const grande = posta(100000);
g.damageEnemy(grande, 1000, "incinerate");     // 1% de um corpo enorme
if (vivos() !== 0) fail("1000 de dano num corpo de 100k desenhou numero — o limiar nao e por fracao");
const pequeno = posta(100);
g.damageEnemy(pequeno, 30, "incinerate");      // o MESMO 30% num corpo pequeno
if (vivos() !== 1) fail("o mesmo golpe nao fala num corpo pequeno — o limiar nao e por fracao");
console.log("  ok o limiar e fracao do corpo: o mesmo valor fala no corpo pequeno e cala no grande");

// (b) o abate fala mesmo abaixo do limiar: o toque que fecha a conta e um
//     evento, e a peca que finalizou merece a assinatura.
N.reset();
const quase = posta(1000);
quase.hp = 1;
g.damageEnemy(quase, 1, "incinerate");
if (vivos() !== 1) fail("o golpe que MATOU nao desenhou numero");
console.log("  ok o abate fala mesmo com o golpe abaixo do limiar");

// (c) FUSAO por corpo e por quadro. Quatro projeteis de uma Salva no mesmo
//     corpo no mesmo frame sao UM numero — quatro digitos no mesmo pixel nao
//     sao mais informacao, sao menos: nenhum dos quatro fica legivel.
N.reset();
// `maxHp` decide o limiar, `hp` decide a morte: separados, os seis golpes ficam
// acima da fracao sem que o corpo caia no meio da contagem.
const alvo = posta(10000);
alvo.hp = 1e9;
// O que se compara e o dano DEVOLVIDO pelo funil, nao o pedido: `dynDamage` e
// o critico entram no meio, e o numero tem que dizer o que o corpo levou.
let somado = 0;
for (let i = 0; i < 6; i++) somado += g.damageEnemy(alvo, 3000, "incinerate");
if (vivos() !== 1) fail(`6 acertos no mesmo corpo no mesmo quadro viraram ${vivos()} numeros`);
const fundido = N.slots.find((x) => x.alive);
if (Math.abs(fundido.value - somado) > 0.01) {
  fail(`o numero fundido diz ${fundido.value.toFixed(0)}, e o corpo levou ${somado.toFixed(0)}`);
}
N.frame++;
g.damageEnemy(alvo, 3000, "incinerate");
if (vivos() !== 2) fail("o quadro seguinte fundiu no numero antigo — a fusao e por QUADRO");
console.log("  ok 6 acertos num quadro sao 1 numero somado; o quadro seguinte abre outro");

// (d) corpos diferentes nao se fundem, mesmo no mesmo quadro
N.reset();
for (let i = 0; i < 5; i++) g.damageEnemy(posta(100), 50, "incinerate");
if (vivos() !== 5) fail(`5 corpos diferentes viraram ${vivos()} numeros — a fusao e por CORPO`);
console.log("  ok cinco corpos no mesmo quadro sao cinco numeros");

// (e) o corpo RECICLADO nao herda a ranhura do anterior. `Enemy` e pooled, e
//     sem `dmgSlot = null` no reset o primeiro acerto do bicho novo somaria
//     num numero que pertence a outro.
N.reset();
const velho = posta(100);
g.damageEnemy(velho, 50, "incinerate");
const daVez = velho.dmgSlot;
velho.reset(velho, ENEMIES.ghoul, 0, 0, g.spawner.scale);
if (velho.dmgSlot) fail("o corpo reciclado herdou a ranhura de numero do anterior");
g.damageEnemy(velho, velho.maxHp * 0.5, "incinerate");
if (velho.dmgSlot === daVez) fail("o corpo reciclado fundiu no numero do corpo antigo");
console.log("  ok o corpo reciclado abre numero proprio");

// (f) TETO de vivos. Cheio, o mais antigo cede, e nada e alocado.
N.reset();
const antes = N.slots.length;
for (let i = 0; i < D.pool * 3; i++) { N.frame++; g.damageEnemy(posta(100), 50, "incinerate"); }
if (N.slots.length !== antes) fail(`o pool cresceu de ${antes} para ${N.slots.length} — ele nao pode alocar`);
if (vivos() !== D.pool) fail(`${D.pool * 3} numeros deixaram ${vivos()} vivos, e o teto e ${D.pool}`);
console.log(`  ok ${D.pool * 3} numeros num quadro cabem em ${D.pool} ranhuras, sem alocar`);

/* --- 3. a leitura -------------------------------------------------------- */
console.log("--- a leitura ---");
// Duas entradas de proposito. `soDe` passa pelo FUNIL, e e ela que prova a
// fiacao — mas o funil traz junto `dynDamage`, o sorteio de critico e os
// triggers reativos que um ENEMY_HIT acorda, e nenhum dos tres e o que os
// testes de DEGRAU medem. Para eles, `soDoNumero` fala com a camada direto: a
// fracao que entra e a fracao que se quer medir.
/* As duas devolvem uma COPIA da ranhura, nao a ranhura. Depois do `reset` o
   anel volta ao inicio, entao duas medidas seguidas caem no mesmo objeto — e
   comparar duas leituras seria comparar a segunda com ela mesma. */
const copia = () => { const x = N.slots.find((y) => y.alive); return x && { ...x }; };
const soDe = (key, e, amt) => { N.reset(); N.frame++; g.damageEnemy(e, amt, key); return copia(); };
const soDoNumero = (key, hp, frac) => {
  N.reset(); N.frame++;
  N.hit(posta(hp), hp * frac, key, false);
  return copia();
};

// cor = eixo da PECA que bateu (R2), e ela atravessa a evolucao junto com a key
const porEixo = {};
for (const id of ["corruption", "incinerate", "voidwalker"]) {
  if (!g.build.has(PIECES[id].key)) g.build.acquirePiece(id, true);
}
g.build.afterChange();
for (const inst of g.build.pieces.values()) {
  const n = soDe(inst.key, posta(1000), 300);
  if (!n) { fail(`${inst.def.id} nao desenhou numero`); continue; }
  porEixo[inst.def.axis] = n.color;
  if (n.color !== UI_PAL.eixo[inst.def.axis]) {
    fail(`${inst.def.id} (${inst.def.axis}) saiu em ${n.color}, e a UI diz ${UI_PAL.eixo[inst.def.axis]}`);
  }
}
if (Object.keys(porEixo).length < 3) fail("os tres eixos nao foram cobertos no teste de cor");
console.log(`  ok cor = eixo da peca, na paleta da UI: ${Object.entries(porEixo).map(([a, c]) => a + " " + c).join(" · ")}`);

// a BRASA e o degrau de cima, e ela e o unico jeito de "golpe enorme" ler sem
// inventar matiz nova
const md = g.build.pieces.values().next().value;
const comum = soDoNumero(md.key, 1000, D.fracAlta * 0.8);
const forte = soDoNumero(md.key, 1000, Math.min(1, D.fracAlta * 1.4));
if (comum.color !== UI_PAL.eixo[md.def.axis]) fail("golpe abaixo de fracAlta ja saiu na brasa");
if (forte.color !== UI_PAL.brasa[md.def.axis]) fail("golpe acima de fracAlta nao saiu na brasa");
if (!(forte.px > comum.px)) fail("o golpe maior nao saiu maior");
if (forte.px > D.px[1] + 0.01 || comum.px < D.px[0] - 0.01) fail(`tamanho fora da faixa ${D.px}`);
console.log(`  ok a brasa marca o golpe de ${(D.fracAlta * 100) | 0}%+ e o tamanho conta a fracao `
  + `(${comum.px.toFixed(0)}px -> ${forte.px.toFixed(0)}px)`);

// dano sem peca dona (o Apice, o estouro de um corpo) nao pode inventar matiz:
// cai no eixo em que a build mais investiu, a mesma escolha que a ceifa faz
g.build.axis.dominion = 9;
const orfao = soDoNumero("apex", 1000, 0.4);
if (orfao.color !== UI_PAL.eixo.dominion) fail("dano sem peca dona nao caiu no eixo dominante da build");
g.build.axis.dominion = 0;
console.log("  ok dano sem peca dona sai no eixo em que a build investiu");

// osso puro NUNCA: e reserva do warlock, e a build acesa e exatamente quando
// ele mais precisa continuar sendo a unica coisa branca em tela
const todasAsCores = new Set();
for (const inst of g.build.pieces.values()) {
  for (const f of [0.3, 0.9]) {
    const n = soDoNumero(inst.key, 1000, f);
    if (n) todasAsCores.add(n.color);
  }
}
if (todasAsCores.has(UI_PAL.osso)) fail("o numero saiu em osso puro — reserva do warlock");
console.log(`  ok ${todasAsCores.size} cores em uso, nenhuma delas osso puro`);

// o dano TOMADO: o unico vermelho, e o continuo nao fala
N.reset(); N.frame++;
g.player.hp = g.player.maxHp;
g.damagePlayer(g.player.maxHp * 0.02, "touch");
g.damagePlayer(g.player.maxHp * 0.5, "touch");
if (vivos() !== 0) fail("o encosto (`touch`) desenhou numero — dano continuo cobra por sub-step e nao pode falar");
g.damagePlayer(g.player.maxHp * (D.tomadoMin * 0.5), "projectile");
if (vivos() !== 0) fail(`projetil abaixo de tomadoMin (${D.tomadoMin}) desenhou numero`);
g.damagePlayer(g.player.maxHp * (D.tomadoMin * 3), "projectile");
const rec = N.slots.find((x) => x.alive);
if (!rec) fail("projetil acima do limiar nao desenhou numero");
else {
  if (rec.color !== UI_PAL.vida) fail(`o dano tomado saiu em ${rec.color}, e o unico vermelho e ${UI_PAL.vida}`);
  if (rec.text[0] !== "−") fail(`o dano tomado saiu como "${rec.text}" — falta o sinal negativo`);
}
console.log("  ok o encosto nunca fala; projetil acima do limiar fala em vermelho, com sinal");

/* --- 4. tempo REAL ------------------------------------------------------- */
console.log("--- o relogio ---");
N.reset(); N.frame++;
g.damageEnemy(posta(100), 50, "incinerate");
const slot = N.slots.find((x) => x.alive);
const t0 = slot.t;
for (let i = 0; i < 60; i++) g.update(1 / 60);      // um segundo de SIMULACAO
if (slot.t !== t0) {
  fail("o numero envelheceu dentro de `update` — ele tem que viver no relogio real, como o hitstop");
}
N.update(D.vida * 0.5);
if (!slot.alive) fail("o numero morreu na metade da vida");
N.update(D.vida * 0.6);
if (slot.alive) fail(`o numero passou de ${D.vida}s em tela`);
console.log(`  ok ${D.vida}s de relogio REAL: 1s de simulacao nao o envelhece`);

/* --- 5. a densidade ------------------------------------------------------ */
/* A unica medida deste driver sem resposta certa em tabela. O que ela reprova
   nao e "ha numero demais" — o teto ja garante isso —, e sim numero demais
   sendo CORTADO pelo teto: ranhura reescrita antes de a anterior terminar o
   voo le como pisca-pisca, e nao como dano. Se a taxa subir, quem sobe e
   `fracMin`, nao `pool`: pool maior desenha mais parede. */
console.log("--- densidade em run de verdade ---");
const gr = new Game();
window.game = gr;
gr.ui.openLevelUp = function () {
  const o = gr.build.getOffers(3)[0];
  if (o) gr.ui.applyOffer(o); else { gr.player.pendingLevels = 0; gr.state = STATE.PLAYING; }
};
gr.ui.openMilestone = function () {
  const offers = gr.build.getMilestoneOffers();
  if (!offers.length || gr.build.axisLeft <= 0) { gr.pendingMilestones = 0; gr.state = STATE.PLAYING; return; }
  gr.build.applyMilestone(offers[0], !offers[0].dry);
  gr.ui.checkForm(null);
  gr.pendingMilestones--;
  gr.state = STATE.PLAYING;
};
gr.ui.openChest = () => { gr.state = STATE.PLAYING; };
/* O piloto e IMORTAL aqui, e nao por conveniencia: a pergunta desta secao e
   "quantos numeros cabem na tela no minuto 10", e a resposta so existe se a run
   chegar la. Morrer aos 4 min mede a dificuldade do jogo — que e o assunto do
   `driver_balance`, nao deste. */
gr.gameOver = () => {};
gr.selectedSpeed = 1;
gr.start();

/* `_take` embrulhado no driver e nao instrumentado no jogo: contador de
   diagnostico dentro do codigo quente e peso que a run paga para sempre.

   Sao dois numeros, e so o primeiro reprova. **Cortado** e a ranhura tomada de
   um numero que ainda estava voando — o que o olho le como pisca-pisca.
   **Recusado** e o golpe que nao coube e simplesmente nao apareceu: isso e o
   teto funcionando, e nao um defeito. */
const takeReal = DamageNumbers.prototype._take;
let nascidos = 0, cortados = 0, recusados = 0;
gr.dmgNums._take = function (v) {
  const r = takeReal.call(this, v);
  if (!r) { recusados++; return r; }
  nascidos++;
  if (r.t > 0 && r.t < BALANCE.dano.vida) cortados++;
  return r;
};

/* Oito minutos e onde a saturacao aparece (o pico da densidade cai entre o 7o
   e o 8o), e ele custa ~50s. Onze minutos medem a cauda e custam 130s — e o
   segundo argumento e onde esse preco se negocia, como no `driver_chest`. */
const MIN = Number(__argv[1] || 8);
const passos = Math.round(MIN * 60 * 60);
const keys = new Set();
const porMinuto = [];
let som = 0, amostras = 0, pico = 0, nasc0 = 0, cort0 = 0;
for (let i = 0; i < passos; i++) {
  // orbita larga: o piloto tem que ficar dentro da horda para haver o que medir
  const a = i / 240;
  keys.clear();
  keys.add(Math.cos(a) > 0 ? "d" : "a");
  keys.add(Math.sin(a) > 0 ? "s" : "w");
  gr.input.keys = keys;
  gr.player.hp = gr.player.maxHp;
  gr.update(1 / 60);
  gr.dmgNums.update(1 / 60);
  const v = gr.dmgNums.slots.filter((x) => x.alive).length;
  som += v; amostras++;
  if (v > pico) pico = v;
  if (i % 3600 === 3599) {
    porMinuto.push({
      min: (i + 1) / 3600,
      medio: som / amostras,
      nasc: nascidos - nasc0,
      cort: cortados - cort0,
      kills: gr.player.kills,
    });

    som = 0; amostras = 0; nasc0 = nascidos; cort0 = cortados;
  }
  if (gr.state === STATE.GAMEOVER) break;
}

console.log("  min  em tela  nascidos  cortados  abates");
for (const r of porMinuto) {
  const pct = r.nasc ? (r.cort / r.nasc * 100) : 0;
  console.log(`  ${String(r.min).padStart(3)}  ${r.medio.toFixed(1).padStart(7)}  `
    + `${String(r.nasc).padStart(8)}  ${(pct.toFixed(0) + "%").padStart(8)}  ${String(r.kills).padStart(6)}`);
}
const cortePct = nascidos ? cortados / nascidos : 0;
if (pico > D.pool) fail(`${pico} numeros vivos ao mesmo tempo, e o teto e ${D.pool}`);
/* MEDIDO, 11 min com o piloto imortal: com o teto cedendo por IDADE (um anel)
   este numero era 80%. Com ele cedendo pelo MENOR valor, cai para ~29% — e o
   que sobra nao e mais "um numero qualquer sumiu", e "um golpe maior chegou".
   O piso de 50% e onde a diferenca entre as duas regras ainda e visivel: se
   subir de novo, a regra de `_take` regrediu, e nao o tuning. */
if (cortePct > 0.5) {
  fail(`${(cortePct * 100) | 0}% dos numeros foram cortados antes de terminar o voo `
     + "— a tela pisca em vez de informar (com o teto cedendo por idade isto media 80%)");
}
console.log(`  ok pico ${pico}/${D.pool} vivos, ${(cortePct * 100).toFixed(0)}% cortados e `
  + `${recusados} recusados em ${MIN} min (${nascidos} desenhados, ${gr.player.kills} abates)`);

/* --- 6. a resposta de vida baixa ----------------------------------------- */
console.log("--- vida baixa ---");
const gv = new Game();
window.game = gv;
gv.ui.openLevelUp = () => { gv.player.pendingLevels = 0; gv.state = STATE.PLAYING; };
gv.ui.openMilestone = () => { gv.pendingMilestones = 0; gv.state = STATE.PLAYING; };
gv.ui.openChest = () => { gv.state = STATE.PLAYING; };
gv.start();
const pv = gv.player;

gv._vfxClock = 0;
pv.hp = pv.maxHp;
if (gv.lowHpPulse() !== 0) fail("a resposta acendeu com a vida cheia");
pv.hp = pv.maxHp * (V.em + 0.05);
if (gv.lowHpPulse() !== 0) fail(`a resposta acendeu acima de ${(V.em * 100) | 0}% de vida`);
pv.hp = 0;
if (gv.lowHpPulse() !== 0) fail("a resposta continuou acesa com o jogador morto");

// o ciclo: sai de 0, chega a 1 na metade, volta a 0 — e um ciclo so, entao a
// barra e a vinheta nunca podem estar em pontos diferentes dele
pv.hp = pv.maxHp * (V.em * 0.5);
const amostra = [];
for (let i = 0; i <= 8; i++) { gv._vfxClock = V.pulso * (i / 8); amostra.push(gv.lowHpPulse()); }
if (Math.abs(amostra[0]) > 1e-6) fail("o ciclo nao comeca em 0");
if (Math.abs(amostra[4] - 1) > 1e-6) fail("o ciclo nao chega a 1 na metade");
if (Math.abs(amostra[8]) > 1e-6) fail("o ciclo nao fecha em 0");
let sobe = true;
for (let i = 1; i <= 4; i++) if (amostra[i] <= amostra[i - 1]) sobe = false;
if (!sobe) fail("a primeira metade do ciclo nao e monotonica — o pulso treme em vez de respirar");
console.log(`  ok ciclo de ${V.pulso}s: ${amostra.map((x) => x.toFixed(2)).join(" ")}`);

// o relogio e REAL: um aviso de que voce esta morrendo nao pode pulsar tres
// vezes mais rapido no timeScale 3
gv._vfxClock = V.pulso * 0.25;
const noQuarto = gv.lowHpPulse();
gv.timeScale = 3;
if (gv.lowHpPulse() !== noQuarto) fail("o pulso mudou com o timeScale — ele vive em tempo real");
gv.timeScale = 1;

// dois consumidores, uma curva. Se cada um tivesse o proprio relogio eles
// leriam como duas animacoes que por acaso coincidem.
gv._vfxClock = V.pulso * 0.5 - 1 / 60;     // `render` avanca o relogio antes de ler
let recebido = null;
const atmReal = Scenery.prototype.drawAtmosphere;
gv.scenery.drawAtmosphere = function (ctx, cam, low) { recebido = low; return atmReal.call(this, ctx, cam, low); };
gv._frameDt = 1 / 60;
gv.render();
// A comparacao e contra a CURVA no mesmo instante, e nao contra um valor
// digitado: o que se cobra e que os dois consumidores leiam o mesmo numero.
const curva = gv.lowHpPulse();
if (Math.abs(recebido - curva) > 1e-9) fail(`a vinheta recebeu ${recebido} e a curva diz ${curva}`);
if (curva < 0.99) fail(`o pico do ciclo mediu ${curva}, e deveria ser ~1`);
gv.ui.updateHUD();
const op = Number(gv.ui.el.hpFill.style.opacity);
if (Math.abs(op - (1 - 0.38 * curva)) > 1e-9) fail("a barra nao saiu da mesma curva da vinheta");
if (!(op > 0.5 && op < 0.75)) fail(`a barra de vida ficou em ${op} de opacidade no pico — a faixa e 62%–100%`);
pv.hp = pv.maxHp;
gv.ui.updateHUD();
if (Number(gv.ui.el.hpFill.style.opacity) !== 1) fail("a barra nao voltou a 100% quando a vida subiu");
console.log(`  ok uma curva, dois consumidores: vinheta em ${recebido.toFixed(2)}, barra em ${op.toFixed(2)}`);

console.log(fails ? `\nX ${fails} falhas` : "\nok o numero de dano e a vida baixa validados");
if (fails) __exit(1);
