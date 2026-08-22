/* Cenário e render: o caminho de desenho nunca e exercitado pelos outros
   drivers (eles so chamam update). Aqui o render roda de verdade contra o
   stub de canvas, entao erro de API e determinismo de chunk aparecem. */
let s = 4;
Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };
const g = new Game(); window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

// tiles gerados
if (!g.scenery.tiles || g.scenery.tiles.length !== SCENERY.tileVariants) {
  fail(`esperava ${SCENERY.tileVariants} variantes de laje`);
} else console.log(`  ok ${g.scenery.tiles.length} variantes de laje de ${BALANCE.world.tile}px`);

// determinismo: o mesmo chunk tem sempre os mesmos destrocos
const a = g.scenery._chunk(3, -7).map((p) => `${p.kind}@${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("|");
g.scenery.chunks.clear();
const b = g.scenery._chunk(3, -7).map((p) => `${p.kind}@${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("|");
if (a !== b) fail("chunk nao e deterministico — os destrocos mudam ao revisitar");
else console.log(`  ok chunk (3,-7) reproduz os mesmos ${a.split("|").length} props`);

// todo tipo declarado precisa ter funcao de desenho
for (const k of PROP_KINDS) {
  if (typeof PROPS[k] !== "function") fail(`prop "${k}" sem funcao de desenho`);
}
console.log(`  ok ${PROP_KINDS.length} tipos de prop com desenho (${Object.keys(STATIC_PROPS).length} cacheados)`);

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
if (PROP_CACHE.size > Object.keys(STATIC_PROPS).length * 4) {
  fail(`cache de sprite de prop estourou: ${PROP_CACHE.size}`);
} else console.log(`  ok cache de sprite de prop em ${PROP_CACHE.size} entradas`);

// game over e volta ao menu tambem renderizam
try {
  g.player.hp = 0; g.player.reviveCharges = 0; g.update(1/60); g.render();
  g.quitToMenu(); g.render();
  g.start(); g.render();
  console.log("  ok game over / menu / restart renderizam");
} catch (e) { fail("transicao: " + e.message); }

console.log(fails ? `\nX ${fails} falhas` : "\nok cenario validado");
if (fails) __exit(1);
