/* Cenário e render: o caminho de desenho nunca e exercitado pelos outros
   drivers (eles so chamam update). Aqui o render roda de verdade contra o
   stub de canvas, entao erro de API e determinismo de chunk aparecem. */
let s = 4;
Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };
const g = new Game(); window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
// A etapa tambem PARA o update: sem resolve-la o driver rodaria ate o
// primeiro marco e chamaria de minutos. Quem mede etapa e `driver_milestone`.
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

// tiles: uma grade por variante, quatro espelhos cada
if (!g.scenery.tiles || g.scenery.tiles.length !== SCENERY.tileVariants) {
  fail(`esperava ${SCENERY.tileVariants} variantes de laje`);
} else {
  const side = BALANCE.world.tile / PIXEL_UNIT;
  if (TILE_SIZE !== side) {
    fail(`a grade da laje e ${TILE_SIZE} mas tile/${PIXEL_UNIT} da ${side} — o chao seria reescalado`);
  }
  const bad = g.scenery.tiles.find((forms) => !forms || forms.length !== 4 ||
                                   forms.some((c) => c.width !== TILE_SIZE || c.height !== TILE_SIZE));
  if (bad) fail("cada variante precisa dos 4 espelhos, todos em " + TILE_SIZE + "px");
  // grade que nao carrega marca nenhuma nao pode ser rara, e a marcada nao pode
  // ser comum: laje com veio ou runa e a coisa mais reconhecivel do chao
  const marked = TILE_ROWS.filter((rows) => rows.some((r) => /[eEf]/.test(r))).length;
  if (marked !== TILE_MARKED.length) fail("TILE_MARKED nao casa com o que as grades tem");
  const share = TILE_BAG.filter((i) => TILE_MARKED.indexOf(i) >= 0).length / TILE_BAG.length;
  if (share > 0.12) fail(`laje marcada sai em ${(share * 100).toFixed(0)}% do bolo — vira carimbo`);
  else console.log(`  ok ${g.scenery.tiles.length} lajes de ${TILE_SIZE}px x4 espelhos`
                   + `, ${TILE_MARKED.length} marcadas em ${(share * 100).toFixed(0)}% do bolo`);
}

// energia no chao: cenario vive abaixo do que o jogador conjura
{
  let lit = 0, all = 0;
  for (const rows of TILE_ROWS) for (const r of rows) {
    all += r.length;
    lit += (r.match(/[eEf]/g) || []).length;
  }
  const pct = (100 * lit) / all;
  if (pct > 3) fail(`${pct.toFixed(1)}% do chao e energia (teto 3%) — o chao competiria com a spell`);
  else console.log(`  ok energia no chao em ${pct.toFixed(1)}% dos pixels (teto 3%)`);
}

// determinismo: o mesmo chunk tem sempre os mesmos destrocos
const a = g.scenery._chunk(3, -7).map((p) => `${p.kind}@${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("|");
g.scenery.chunks.clear();
const b = g.scenery._chunk(3, -7).map((p) => `${p.kind}@${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("|");
if (a !== b) fail("chunk nao e deterministico — os destrocos mudam ao revisitar");
else console.log(`  ok chunk (3,-7) reproduz os mesmos ${a.split("|").length} props`);

// todo tipo declarado precisa de grade, e a grade precisa desenhar 1:1
for (const k of PROP_KINDS) {
  const art = PROP_ART[k];
  if (!art) { fail(`prop "${k}" sem grade em PROP_ART`); continue; }
  const w = art.rows[0].length;
  if (art.rows.some((r) => r.length !== w)) fail(`prop "${k}": linhas de larguras diferentes`);
  const chars = new Set(art.rows.join("").split("").filter((c) => c !== "."));
  for (const c of chars) if (!art.pal[c]) fail(`prop "${k}" usa "${c}" sem cor na paleta dele`);
  for (const c in art.pal) if (!chars.has(c)) fail(`prop "${k}": "${c}" na paleta e sem uso na grade`);
  const sp = propSprite(k, 0);
  // o degrau tem que ser o MESMO de todo o elenco: uma celula, um pixel de
  // buffer. Prop desenhado no dobro e o mixel silencioso
  if (sp.canvas.width !== w || sp.w !== w * PIXEL_UNIT) {
    fail(`prop "${k}" nao desenha 1:1 (${sp.canvas.width}px de grade para ${sp.w} de mundo)`);
  }
  if (propSprite(k, 1).canvas === sp.canvas) fail(`prop "${k}" sem espelho — variacao nenhuma`);
}
console.log(`  ok ${PROP_KINDS.length} grades de prop, 1:1 e com espelho`);

// todo demonio precisa de sprite proprio — o orbe generico e fallback, nao padrao
for (const kind in MINIONS) {
  const d = MINIONS[kind];
  if (!d.sprite) fail(`demonio "${kind}" sem sprite`);
  else if (!SPRITES[d.sprite]) fail(`demonio "${kind}" aponta para sprite inexistente "${d.sprite}"`);
  else if (!d.scale) fail(`demonio "${kind}" sem escala de desenho`);
}
// e todos precisam desenhar: um de cada, cobrindo flip, `big` e o fade final
const demos = Object.keys(MINIONS).map((kind, i) => ({
  kind, defKind: MINIONS[kind], x: i * 40, y: 0,
  radius: MINIONS[kind].radius, color: MINIONS[kind].color,
  facing: i % 2 ? 1 : -1, animTime: i * 0.7, big: i % 3 === 0,
  expiresAt: i % 4 === 0 ? 1.5 : Infinity, dead: false,
}));
try {
  drawMinions(g.ctx, demos, g.camera, 1);
  console.log(`  ok ${demos.length} tipos de demonio desenham com sprite proprio`);
} catch (e) { fail("drawMinions: " + e.message); console.error(e.stack); }

// explosao: os quadros sao gerados uma vez por cor e a animacao precisa ter
// forma — acender, abrir, esvaziar. Contar celulas pintadas e o jeito de ver
// isso sem olho: e o unico teste que pega o campo virando bolha ou sumindo.
const cells = [];
for (let f = 0; f < EXPLO.FRAMES; f++) {
  __draw.reset();
  buildFxFrame("bloom", 0, f, "#ff8a3c", EXPLO.GRID);
  cells.push(__draw.calls.fillRect || 0);
}
if (cells.some((n) => n < 20)) fail(`quadro de explosao quase vazio: ${cells.join("/")}`);
const peak = cells.indexOf(Math.max(...cells));
if (peak === 0 || peak === EXPLO.FRAMES - 1) {
  fail(`explosao sem pico no meio da animacao: ${cells.join("/")}`);
} else if (cells[EXPLO.FRAMES - 1] >= cells[peak]) {
  fail(`explosao nao se desfaz no fim: ${cells.join("/")}`);
} else console.log(`  ok explosao acende, abre e se desfaz (${cells.join("/")} celulas, pico no ${peak})`);

// mesma cor = mesmos canvases; variantes diferentes = desenhos diferentes
const setA = explosionFrames("#ff8a3c");
if (explosionFrames("#ff8a3c") !== setA) fail("frames de explosao remontados a cada uso");
if (setA.length !== EXPLO.VARIANTS || setA[0].length !== EXPLO.FRAMES) {
  fail(`esperava ${EXPLO.VARIANTS}x${EXPLO.FRAMES} quadros de explosao`);
}
const shape = (v) => { __draw.reset(); buildFxFrame("bloom", v, 3, "#ff8a3c", EXPLO.GRID); return __draw.calls.fillRect; };
if (EXPLO.VARIANTS > 1 && shape(0) === shape(1)) fail("variantes de explosao com a mesma silhueta");
explosionFrames("#c850ff");
if (FX_SETS.size !== 2) fail(`cache de explosao com ${FX_SETS.size} entradas, esperava 2`);
console.log(`  ok ${setA.length} variantes cacheadas por cor (${FX_SETS.size} entradas)`);

// e o desenho: toda fase da vida da explosao passa pelo stub de canvas
try {
  for (let i = 0; i < EXPLO.FRAMES * 3; i++) {
    drawExplosion(g.ctx, 100, 100, 70, i / (EXPLO.FRAMES * 3), "#ff8a3c", i);
  }
  console.log("  ok explosao desenha em toda a faixa de vida");
} catch (e) { fail("drawExplosion: " + e.message); console.error(e.stack); }

// contorno do personagem: dilatado em 1 pixel de arte e cacheado por cor
const rim = spriteRim(SPRITES.warlock, "#05020a");
if (rim.width !== SPRITES.warlock.white.width + 2) fail("contorno nao dilatou o sprite");
if (spriteRim(SPRITES.warlock, "#05020a") !== rim) fail("contorno remontado a cada frame");
try {
  drawSpriteRim(g.ctx, SPRITES.warlock, 80, 80, 40, true, null, "#05020a", 0.9);
  console.log("  ok contorno do warlock desenha e fica cacheado");
} catch (e) { fail("drawSpriteRim: " + e.message); }

// menu desenha sem erro
g.state = STATE.MENU;
try { for (let i = 0; i < 120; i++) { g._frameDt = 1/60; g.render(); } }
catch (e) { fail("render do menu: " + e.message); console.error(e.stack); }
console.log("  ok menu renderiza");

// jogo: 3 min andando, com render em todo frame
g.start();
let worst = 0;
try {
  for (let i = 0; i < 60 * 60 * 3; i++) {
    g.player.hp = g.player.maxHp;
    g.input.keys = new Set(((i / 300) % 1) > 0.8 ? [] : [((i / 900) % 1) > 0.5 ? "a" : "d", "s"]);
    g.update(1 / 60);
    g._frameDt = 1 / 60;
    const t0 = __now();
    g.render();
    const ms = __now() - t0;
    if (ms > worst) worst = ms;
  }
} catch (e) { fail("render durante o jogo: " + e.message); console.error(e.stack); }
console.log(`  ok 3 min com render em todo frame (pior render ${worst}ms no stub)`);

// caches nao podem crescer sem fim enquanto o player corre o mapa
g.scenery.reset();
for (let cx = 0; cx < 60; cx++) for (let cy = 0; cy < 30; cy++) g.scenery._chunk(cx, cy);
if (g.scenery.chunks.size > SCENERY.maxChunkCache + 1) {
  fail(`cache de chunk estourou: ${g.scenery.chunks.size}`);
} else console.log(`  ok cache de chunk limitado (${g.scenery.chunks.size} <= ${SCENERY.maxChunkCache + 1})`);
// kind x variant x SIZE STEP: the prop is pre-rendered at its final size (the
// pixel grid will not take a canvas stretched by 1.07), so the cache gained a
// third dimension. The ceiling still catches the accident that matters:
// caching by a continuous `s` would blow this up inside the first minute.
// sem degrau de tamanho, o cache e finito por construcao: tipo x espelho
const PROP_CACHE_MAX = PROP_KINDS.length * 2;
if (PROP_CACHE.size > PROP_CACHE_MAX) {
  fail(`cache de sprite de prop estourou: ${PROP_CACHE.size} (teto ${PROP_CACHE_MAX})`);
} else console.log(`  ok cache de sprite de prop em ${PROP_CACHE.size} entradas (teto ${PROP_CACHE_MAX})`);

// game over e volta ao menu tambem renderizam
try {
  g.player.hp = 0; g.player.reviveCharges = 0; g.update(1/60); g.render();
  g.quitToMenu(); g.render();
  g.start(); g.render();
  console.log("  ok game over / menu / restart renderizam");
} catch (e) { fail("transicao: " + e.message); }

console.log(fails ? `\nX ${fails} falhas` : "\nok cenario validado");
if (fails) __exit(1);
