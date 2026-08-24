/* Portal das magias de portal: a moldura em PORTAL_GATE e o vortice de
   drawPortal. Nenhum outro driver passa por esse caminho de desenho — o
   portao so aparece quando uma peca pede, e o `open` (0..1) e a animacao
   inteira, entao e ele que precisa ser vigiado. */
let s = 9;
Math.random = () => { s = (s*1103515245+12345)%2147483648; return s/2147483648; };
const g = new Game(); window.game = g;
g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
g.ui.openChest = () => { g.state = STATE.PLAYING; };
// A etapa tambem PARA o update: sem resolve-la o driver rodaria ate o
// primeiro marco e chamaria de minutos. Quem mede etapa e `driver_milestone`.
g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

g.start(STARTER_TESTE);

// espiona drawPortal sem trocar o render de verdade
const real = drawPortal;
let calls = 0;
const opens = [];
drawPortal = function (ctx, x, y, r, t, color, open) {
  calls++; opens.push(open);
  return real.apply(null, arguments);
};

// uma magia abre o portao: emitVfx e o caminho que qualquer peca usa
try {
  g.emitVfx("portal", g.player.x, g.player.y, 26, "#9a4cff");
  for (let i = 0; i < 80; i++) {
    g._frameDt = 1 / 60;
    g.update(1 / 60);
    g.vfxLayer.update(1 / 60);   // o loop de verdade envelhece o vfx fora de update()
    g.render();
  }
} catch (e) { fail("render do portal: " + e.message); console.error(e.stack); }

if (!calls) fail("drawPortal nunca foi chamado — o portao nao apareceu");
else console.log(`  ok o portao desenhou em ${calls} frames`);

const bad = opens.filter((o) => !(o >= 0 && o <= 1));
if (bad.length) fail(`abertura fora de 0..1 em ${bad.length} frames (ex ${bad[0]})`);
else if (opens.length) console.log(`  ok abertura sempre em 0..1 (minimo ${Math.min(...opens).toFixed(2)})`);
if (!opens.some((o) => o > 0.9)) fail("o portao nunca chegou a abrir de todo");
else if (!opens.some((o) => o < 0.5)) fail("o portao nasce e morre inteiro — nao rasga nem desaba");
else console.log("  ok rasga, segura e desaba em vez de piscar");

// a mesma moldura serve qualquer magia de portal, uma variante por cor
const nether = portalSprite("#9a4cff"), again = portalSprite("#9a4cff"), fel = portalSprite("#7fdc4a");
if (nether !== again) fail("portalSprite nao cacheia — remonta a moldura por frame");
else if (nether === fel) fail("portalSprite devolveu a mesma moldura para cores diferentes");
else console.log(`  ok moldura cacheada por cor (${PORTAL_SPRITES.size} variantes)`);

// a geometria de PORTAL_ART tem que continuar caindo dentro do grid
const rows = PORTAL_GATE.rows;
const gw = rows[0].length, gh = rows.length;
if (nether.canvas.width !== gw || nether.canvas.height !== gh) {
  fail(`moldura ${nether.canvas.width}x${nether.canvas.height} != grid ${gw}x${gh}`);
} else console.log(`  ok moldura ${gw}x${gh} com a boca vazada`);
const A = PORTAL_ART;
if (A.cx - A.rx < 0 || A.cx + A.rx > gw || A.cy - A.ry < 0 || A.cy + A.ry > gh) {
  fail("a boca do portal saiu do grid do sprite");
} else console.log("  ok boca dentro do grid");
for (const [rx, ry] of A.runes) {
  const col = Math.round(A.cx + rx), row = Math.round(A.cy + ry);
  const ch = rows[row] && rows[row][col];
  if (ch !== "R" && ch !== "r") fail(`runa em (${col},${row}) caiu em "${ch}" — o brilho ficou solto`);
}
console.log(`  ok ${A.runes.length} runas coincidem com pixels de runa`);

// e a peca abre o portal por dado, sem efeito novo no motor
try {
  const c = pushCtx(g);
  c.x = g.player.x; c.y = g.player.y; c.color = "#9a4cff"; c.now = g.clock;
  EFFECTS.vfx(g, { type: "vfx", kind: "portal", radius: 26 }, c);
  popCtx(g);
  console.log("  ok EFFECTS.vfx abre o portal por dado");
} catch (e) { fail("EFFECTS.vfx: " + e.message); }

console.log(fails ? `\nFALHOU (${fails})` : "\nok portal validado");
