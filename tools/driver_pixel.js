/* The pixel grid. The world is rasterized into a low-res buffer and only then
   blown up by a WHOLE factor — that is what makes every pixel on screen the
   same size. The rule is miserable to check by eye (the defect is a 3-unit
   pixel next to a 2-unit one, and it only shows up in motion), so it lives
   here: if anyone goes back to drawing cell art at a free scale, this breaks. */
const g = new Game(); window.game = g;

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };
const U = PIXEL_UNIT;
const onGrid = (v) => Math.abs(v / U - Math.round(v / U)) < 1e-9;

// --- the buffer and the upscale ---------------------------------------------
if (!Number.isInteger(g.dpr)) fail(`dpr ${g.dpr} nao e inteiro — o blit final volta a ser fracionario`);
if (!Number.isInteger(U) || U < 1) fail(`PIXEL_UNIT ${U} precisa ser inteiro >= 1`);
if (PIXEL_GRID !== U) fail(`o grid dos sprites (${PIXEL_GRID}) saiu do PIXEL_UNIT (${U})`);
g.resize();
const bw = g.world.width, bh = g.world.height, C = g.cell;
if (!Number.isInteger(C) || C < 1) fail(`cell ${C} nao e inteiro — o pixel de arte deixa de ser quadrado`);
if (bw * C < innerWidth * g.dpr || bh * C < innerHeight * g.dpr) {
  fail(`buffer ${bw}x${bh} nao cobre a janela em pixels de dispositivo`);
} else if (g.canvas.width !== bw * C || g.canvas.height !== bh * C) {
  fail(`backing ${g.canvas.width}x${g.canvas.height} nao bate com ${bw}x${bh} * ${C}`);
} else if (g.camera.w !== bw * U || g.camera.h !== bh * U) {
  fail(`camera ${g.camera.w}x${g.camera.h} nao cobre o buffer inteiro`);
} else console.log(`  ok buffer ${bw}x${bh}, ${C} pixels de dispositivo por pixel de arte`);

// --- the blit slides, but never past its margin -----------------------------
// The offset is what buys smooth scrolling; if it ever exceeded the two pixels
// of margin, the edge of the screen would show buffer that was never drawn.
let slid = 0, worst = 0;
for (let i = 0; i < 400; i++) {
  g.camera.x = i * 0.41; g.camera.y = i * -0.73;
  const dx = Math.round(((g.camera.left - g.camera.rawLeft) / U) * C);
  const dy = Math.round(((g.camera.top - g.camera.rawTop) / U) * C);
  worst = Math.max(worst, Math.abs(dx), Math.abs(dy));
  if (dx !== 0 || dy !== 0) slid++;
  if (Math.abs(dx) > C * 2 || Math.abs(dy) > C * 2) fail(`blit deslizou ${dx},${dy} — passou da margem`);
}
if (slid < 300) fail(`blit so deslizou em ${slid}/400 posicoes — a rolagem voltou a andar aos trancos`);
else console.log(`  ok blit desliza em ${slid}/400 posicoes (maximo ${worst} de ${C * 2} de margem)`);

// --- the camera moves one pixel at a time -----------------------------------
// This is what keeps the world from boiling: with a float camera, everything
// standing still lands on a different pixel phase every frame.
let off = 0;
for (let i = 0; i < 200; i++) {
  g.camera.x = i * 0.37; g.camera.y = -i * 1.13;
  if (i % 7 === 0) g.camera.addTrauma(4 + (i % 3) * 8, i % 2 ? 1 : -0.4, i % 5 ? 0.3 : 1);
  g.camera.updateShake(1 / 60);
  if (!onGrid(g.camera.left) || !onGrid(g.camera.top)) off++;
}
if (off) fail(`camera saiu do grid em ${off}/200 posicoes`);
else console.log("  ok camera presa ao grid, com shake incluso");

// --- every sprite lands on the grid, at any size ----------------------------
// Draw height comes from the enemy radius times `art` and from the form's
// `scale`, so it is continuous: the snap has to survive any value.
let bad = null, sizes = new Set();
for (const id in SPRITES) {
  const spr = SPRITES[id];
  for (let h = 8; h < 200; h += 0.7) {
    for (const a of [null, walkAnim(h, true), walkAnim(h, false)]) {
      const p = placeSprite(123.456, -78.9, spr.canvas.width, spr.canvas.height, h, a);
      sizes.add(p.px);
      if (!onGrid(p.x) || !onGrid(p.y) || !onGrid(p.w) || !onGrid(p.h)) {
        bad = bad || `${id} em drawH ${h.toFixed(1)}: ${p.x},${p.y} ${p.w}x${p.h}`;
      }
      // square cell: the same pixel width across and down, animation squash
      // aside — and that one only moves in whole pixels
      if (p.w / spr.canvas.width !== p.px || p.h / spr.canvas.height !== p.py) {
        bad = bad || `${id} com celula irregular em drawH ${h.toFixed(1)}`;
      }
      if (p.px < 1 || p.py < 1) bad = bad || `${id} sumiu (celula < 1px) em drawH ${h.toFixed(1)}`;
    }
  }
}
if (bad) fail("placeSprite fora do grid: " + bad);
else console.log(`  ok ${Object.keys(SPRITES).length} sprites no grid em toda faixa de tamanho (celulas de ${[...sizes].sort((a, b) => a - b).join("/")}px)`);


// --- every sprite draws at the SAME pixel size ------------------------------
/* `step` is how many buffer pixels one art pixel occupies, and it falls out of
   `drawH / (PIXEL_UNIT * rows)`. Nothing forced it to be the same for everyone,
   and it silently was not: the Abomination and the Dreadlord rendered at step 2
   — art pixels twice the size of the other sixteen sprites. That is the mixel
   defect in its quiet form. Not fractional scaling, which boils; a whole-number
   scale that simply does not match the rest of the cast, so two creatures look
   like they came from a lower-resolution game.

   It is invisible in a sprite viewed alone and obvious the moment the two stand
   next to a ghoul, which is why it lives here and not in someone's eye. */
const stepOf = (rows, drawH) => Math.max(1, Math.round(drawH / (U * rows)));
const arts = [];
for (const id in ENEMIES) {
  const e = ENEMIES[id];
  arts.push([id, "inimigo", SPRITE_DATA[id].rows.length, e.radius * (e.art || 2.7)]);
}
for (const id in MINIONS) {
  const m = MINIONS[id];
  if (m.sprite) arts.push([id, "demonio", SPRITE_DATA[m.sprite].rows.length, m.radius * m.scale]);
}
for (const f of CLASSES.warlock.forms) {
  arts.push([f.sprite, "forma", SPRITE_DATA[f.sprite].rows.length, BALANCE.player.radius * f.scale]);
}
const steps = new Map();
for (const [id, kind, rows, drawH] of arts) {
  const st = stepOf(rows, drawH);
  if (!steps.has(st)) steps.set(st, []);
  steps.get(st).push(`${id} (${kind}, ${rows} linhas, ${Math.round(drawH)}un)`);
}
if (steps.size > 1) {
  const big = [...steps.entries()].filter(([st]) => st > 1);
  fail(`pixel de arte de tamanhos diferentes no mesmo jogo: ` +
       big.map(([st, ids]) => `step ${st} em ${ids.join(", ")}`).join("; ") +
       ` — redesenhe a grade no tamanho em que ela aparece, nao amplie`);
} else {
  console.log(`  ok ${arts.length} sprites desenham com o mesmo pixel de arte (step ${[...steps.keys()][0]})`);
}

// --- walk frames ------------------------------------------------------------
// The grid cannot squash by 1.05 of a pixel, so movement is poses. A generator
// that silently produced four copies of the same pose would leave the game
// looking exactly like it did with no animation at all — that is what this
// catches.
let legged = 0, swayed = 0, still = 0;
for (const id in SPRITES) {
  const spr = SPRITES[id], fr = spr.frames;
  if (!fr) { still++; continue; }
  if (fr.length !== WALK_FRAMES) { fail(`${id} com ${fr.length} quadros`); continue; }
  if (fr[0] !== spr || fr[2] !== spr) fail(`${id}: o quadro de contato nao e a pose base`);
  let moved = 0;
  for (const f of [1, 3]) {
    if (fr[f].canvas.width !== spr.canvas.width || fr[f].canvas.height !== spr.canvas.height) {
      fail(`${id}: quadro ${f} mudou de tamanho — sai do lugar no meio do passo`);
    }
    if (fr[f] !== spr) moved++;
  }
  if (moved !== 2) fail(`${id}: quadros de passo iguais a pose base`);
  const rows = SPRITE_DATA[id].rows, l = findLegs(rows, spr.canvas.width);
  if (l && legBand(rows, l) >= 2) legged++; else swayed++;   // mesmo criterio de walkFrames
}
console.log(`  ok quadros: ${legged} sprites pisam, ${swayed} gingam, ${still} sem quadro`);

// --- the floor slab has to line up with the grid ----------------------------
if (!onGrid(BALANCE.world.tile)) {
  fail(`BALANCE.world.tile ${BALANCE.world.tile} nao e multiplo de ${U} — o chao desalinha`);
} else console.log(`  ok laje de ${BALANCE.world.tile} casa com o grid`);

// --- the explosion only exists at whole sizes -------------------------------
let ebad = 0;
for (let r = 10; r < 260; r += 3) {
  const G = explosionGrid((r * 2.6) / U);
  if (!EXPLO.GRIDS.includes(G)) ebad++;
}
if (ebad) fail(`${ebad} raios de explosao caindo fora das grades de EXPLO.GRIDS`);
else console.log(`  ok explosao em ${EXPLO.GRIDS.length} grades (${EXPLO.GRIDS.join("/")}), sempre 1:1`);

// --- and the real game, drawing into the buffer -----------------------------
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
// A etapa tambem PARA o update: sem resolve-la o driver rodaria ate o
// primeiro marco e chamaria de minutos. Quem mede etapa e `driver_milestone`.
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
g.start();
try {
  for (let i = 0; i < 60 * 90; i++) {
    g._frameDt = 1 / 60;
    g.update(1 / 60);
    if (i % 2 === 0) g.render();
  }
  console.log(`  ok 90s renderizando pelo buffer (${g.enemies.active.length} inimigos em campo)`);
} catch (e) { fail("render pelo buffer: " + e.message); console.error(e.stack); }

console.log(fails ? `\nFALHOU (${fails})` : "\nok grid de pixel validado");
