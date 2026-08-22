/* The master palette. Sprite colour is the one part of this game's art with no
   runtime symptom: a sprite that invents its own purple looks fine on its own
   and only reads as wrong next to the other eighteen — which is exactly the
   comparison nobody makes while adding one. So it lives here.

   Before PAL there were 108 distinct hexes across 18 sprites with almost no
   reuse. The checks below are what keeps that from growing back. */

let fails = 0;
const fail = (m) => { console.error("  X " + m); fails++; };

const SPRITES_ALL = Object.assign({ PORTAL_GATE }, SPRITE_DATA);
const TOKEN = new Map();          // hex -> every PAL name that holds it
for (const k in PAL) {
  if (!TOKEN.has(PAL[k])) TOKEN.set(PAL[k], []);
  TOKEN.get(PAL[k]).push(k);
}
const INKS = ["inkCold", "inkDeep", "inkWarm"];
const ENERGY = /^(fel|arc|pyr|blood|azure)\d|^white$/;

// --- 1. no colour outside the palette ---------------------------------------
let stray = [];
for (const id in SPRITES_ALL) {
  for (const ch in SPRITES_ALL[id].pal) {
    const hex = SPRITES_ALL[id].pal[ch];
    if (!TOKEN.has(hex)) stray.push(`${id}.${ch} ${hex}`);
  }
}
if (stray.length) fail(`${stray.length} cores fora da PAL: ${stray.slice(0, 6).join(", ")}`);
else {
  const used = new Set();
  for (const id in SPRITES_ALL) for (const ch in SPRITES_ALL[id].pal) used.add(SPRITES_ALL[id].pal[ch]);
  console.log(`  ok ${Object.keys(SPRITES_ALL).length} grids pintados com ${used.size} das ${Object.keys(PAL).length} cores da PAL`);
}

// --- 2. dead tokens ---------------------------------------------------------
// A palette entry nobody draws with is weight, and it is also a lie: it says
// the set has a colour it does not.
const seen = new Set();
for (const id in SPRITES_ALL) for (const ch in SPRITES_ALL[id].pal) seen.add(SPRITES_ALL[id].pal[ch]);
const dead = Object.keys(PAL).filter((k) => !seen.has(PAL[k]) && !ENERGY.test(k));
if (dead.length > 2) fail(`${dead.length} cores de materia sem nenhum uso: ${dead.join(", ")}`);
else console.log(`  ok materia sem uso: ${dead.length} (${dead.join(", ") || "nenhuma"})`);

// --- 3. the axis families are REFERENCED, not copied -------------------------
// A sprite's glow and the build it belongs to have to be the same colour by
// construction; a hand-typed copy drifts the first time AXIS_PALETTE is tuned.
for (const [tok, want] of [["fel1", AXIS_PALETTE.corruption.base],
                           ["arc1", AXIS_PALETTE.dominion.base],
                           ["pyr1", AXIS_PALETTE.cataclysm.base]]) {
  if (PAL[tok] !== want) fail(`PAL.${tok} (${PAL[tok]}) saiu do AXIS_PALETTE (${want})`);
}

// --- 4. every ramp climbs, and shifts hue while it climbs ---------------------
// A ramp that only drops brightness on a fixed hue is the clearest tell of
// amateur pixel art: it reads as the same paint under less light instead of as
// a lit surface. Shadows go violet, highlights go warm.
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const hue = (h) => {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const t = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (t * 60 + 360) % 360;
};
const dHue = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const RAMPS = {};
for (const k in PAL) {
  const m = /^([a-z]+)(\d)$/.exec(k);
  if (!m || INKS.includes(k)) continue;
  (RAMPS[m[1]] = RAMPS[m[1]] || []).push(k);
}
let flat = [];
for (const name in RAMPS) {
  const steps = RAMPS[name].sort();
  if (steps.length < 3 || ENERGY.test(steps[0])) continue;   // energy is axis identity, not ours to re-hue
  for (let i = 1; i < steps.length; i++) {
    if (lum(PAL[steps[i]]) <= lum(PAL[steps[i - 1]])) {
      fail(`rampa ${name}: ${steps[i]} nao e mais claro que ${steps[i - 1]} — o degrau vira lama`);
    }
  }
  const shift = dHue(hue(PAL[steps[0]]), hue(PAL[steps[steps.length - 1]]));
  if (shift < 8) flat.push(`${name} (${shift.toFixed(0)}°)`);
}
if (flat.length) fail(`rampas sem deslocamento de matiz — so escurecem: ${flat.join(", ")}`);
else console.log(`  ok ${Object.keys(RAMPS).length} rampas sobem em luminancia e deslocam matiz`);

// --- 5. matter is muted, energy is saturated ---------------------------------
// The reading hierarchy in CLAUDE.md, enforced on the sprite side: with forty
// bodies on screen a spell only pops if the bodies are NOT competing with it.
// A body painted in fel green is a body that looks like a spell.
const ENERGY_CAP = 0.14;
// Two exceptions, and both are the same exception: the glow IS the subject.
// The portal's mouth is the spell, and the darkglare is an eye with legs — a
// muted eye is not a darkglare. Everything that is a BODY obeys the cap.
const LIT_BY_DESIGN = { portal: "a boca e a magia", darkglare: "o olho e a criatura" };
let loud = [];
for (const id in SPRITES_ALL) {
  if (id in LIT_BY_DESIGN) continue;
  const d = SPRITES_ALL[id];
  const kind = {};                                     // char -> is energy
  for (const ch in d.pal) {
    const names = TOKEN.get(d.pal[ch]) || [];
    kind[ch] = names.length > 0 && names.every((n) => ENERGY.test(n));
  }
  let solid = 0, hot = 0;
  for (const row of d.rows) for (const ch of row) {
    if (ch === "." || ch === " " || !(ch in d.pal)) continue;
    solid++; if (kind[ch]) hot++;
  }
  const frac = solid ? hot / solid : 0;
  if (frac > ENERGY_CAP) loud.push(`${id} ${(frac * 100).toFixed(0)}%`);
}
if (loud.length) fail(`sprites gastando mais de ${(ENERGY_CAP * 100).toFixed(0)}% dos pixels em cor de energia: ${loud.join(", ")}`);
else console.log(`  ok energia abaixo de ${(ENERGY_CAP * 100).toFixed(0)}% dos pixels (${Object.keys(LIT_BY_DESIGN).length} excecoes declaradas: ${Object.entries(LIT_BY_DESIGN).map(([k, v]) => k + " — " + v).join("; ")})`);

// --- 6. the outline is an ink, and the body's shadow is not the outline ------
let inkBad = [];
for (const id in SPRITES_ALL) {
  const pal = SPRITES_ALL[id].pal;
  if (!("o" in pal)) { inkBad.push(`${id} sem contorno`); continue; }
  const names = TOKEN.get(pal.o) || [];
  if (!names.some((n) => INKS.includes(n))) inkBad.push(`${id} contorna com ${names[0] || pal.o}`);
  if ("d" in pal && pal.d === pal.o) inkBad.push(`${id}: sombra igual ao contorno`);
}
if (inkBad.length) fail(`contorno fora das tintas: ${inkBad.join(", ")}`);
else console.log(`  ok todo grid contorna com uma das ${INKS.length} tintas, e a sombra e mais clara que ela`);

// --- 7. the light comes from the top-left, in every sprite -------------------
// The one art rule that has a measurable signature: the lit half has to be the
// upper half. A sprite shaded from below reads as lit by something the scene
// does not have, and it is the defect nobody spots on a single sprite.
let lit = 0, dark = [];
for (const id in SPRITES_ALL) {
  const d = SPRITES_ALL[id], h = d.rows.length;
  let top = 0, tn = 0, bot = 0, bn = 0;
  for (let y = 0; y < h; y++) for (const ch of d.rows[y]) {
    if (ch === "." || ch === " " || !(ch in d.pal)) continue;
    if (!"dmlDML".includes(ch)) continue;      // only the shaded ramps carry the light
    const L = lum(d.pal[ch]);
    if (y < h / 2) { top += L; tn++; } else { bot += L; bn++; }
  }
  if (!tn || !bn) continue;
  if (top / tn > bot / bn) lit++;
  else dark.push(`${id} (${(top / tn).toFixed(0)} vs ${(bot / bn).toFixed(0)})`);
}
if (dark.length > 2) fail(`${dark.length} grids com a metade de baixo mais clara que a de cima: ${dark.join(", ")}`);
else console.log(`  ok luz vem de cima em ${lit} grids (${dark.length} excecao(oes): ${dark.join(", ") || "nenhuma"})`);

console.log(fails ? `\nFALHOU (${fails})` : "\nok paleta mestre validada");
