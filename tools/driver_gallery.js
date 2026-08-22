"use strict";
/* =========================================================================
   DRIVER — as galerias (sprites.html, vfx.html).

   Uma galeria e codigo de verdade chamando o render de verdade: card quebrado
   so aparece quando alguem rola a pagina ate ele. Aqui todo card e montado e
   animado por alguns segundos de relogio, com o canvas stub contando traco.

   Tres perguntas:
     1. algum card estoura? (setup, tick ou draw)
     2. algum card fica MUDO — monta sem desenhar nada?
     3. a galeria cobre o registry, ou ficou para tras do conteudo?

   Uso:  PAGE=vfx.html DRIVER=driver_gallery.js node tools/harness.js .
   ========================================================================= */

const PAGE = typeof __page === "string" ? __page : "vfx.html";
const G = typeof window !== "undefined" ? window.GALLERY : null;
let fail = 0;
const bad = (msg) => { console.error("FALHA: " + msg); fail++; };

/* Pagina sem window.GALLERY (sprites.html) nao tem card para animar aqui: o
   modelo de card dela e outro. Carregar sem estourar ja e a metade do teste
   que ela pode dar — e e essa metade que o PAGE do harness passou a cobrir. */
if (!G) {
  console.log("ok  " + PAGE + " carregou sem erro (sem window.GALLERY: nada a animar)");
  __exit(0);
}

console.log(`ok  ${G.CARDS.length} cards em ${G.SECTIONS.length} secoes`);

/* --- 1 e 2: todo card monta, anima e desenha ----------------------------- */
const SECONDS = 6, STEP = 1 / 60;
const mute = [];
for (let i = 0; i < G.CARDS.length; i++) {
  const c = G.CARDS[i];
  c.w = 230; c.h = 210; c.dpr = 1;
  __draw.reset();
  for (let f = 0; f < SECONDS / STEP; f++) {
    try {
      G.drawCard(c, STEP, i);
    } catch (e) {
      bad(`card "${c.item.id}" estourou no frame ${f}: ${e.message}`);
      break;
    }
  }
  if (c.broken) bad(`card "${c.item.id}" caiu no catch interno (setup/tick/draw)`);
  const drew = (__draw.calls.drawImage || 0) + (__draw.calls.fill || 0) +
               (__draw.calls.stroke || 0) + (__draw.calls.fillRect || 0);
  // o fundo escuro sozinho gasta 1 fillRect por frame: o card tem que fazer mais
  if (drew <= SECONDS / STEP) mute.push(c.item.id);
}
if (mute.length) bad(`cards que nao desenham nada em ${SECONDS}s: ` + mute.join(", "));
else console.log(`ok  todos desenham (${SECONDS}s de relogio por card)`);

/* --- 3: a galeria acompanha o registry? ---------------------------------- */
if (PAGE === "vfx.html") {
  const ids = new Set(G.CARDS.map((c) => c.item.id));
  const missing = (label, keys, has) => {
    const gone = keys.filter((k) => !has(k));
    if (gone.length) bad(`${label} sem card na galeria: ` + gone.join(", "));
  };
  missing("efeito", Object.keys(EFFECTS), (k) => ids.has(k));
  missing("trigger", Object.keys(TRIGGERS), (k) => ids.has(k));
  missing("hook", Object.keys(HOOKS), (k) => ids.has(k));
  missing("vfx de peca", Object.keys(PIECE_VFX), (k) => ids.has(k));
  missing("evento visual", Object.keys(VFX_LIFE), (k) => ids.has(k));
  missing("demonio", Object.keys(MINIONS), (k) => ids.has(k));
  missing("peca", Object.keys(PIECES), (k) => ids.has(k));
  missing("passiva", Object.keys(PASSIVES), (k) => ids.has(k));
  missing("capstone", Object.keys(CAPSTONES), (k) => ids.has(k));

  // Card "sem demo" e a placa de que alguem acrescentou conteudo e nao contou
  // para a galeria. Ele existe para ser visto — e para reprovar aqui.
  const stub = G.CARDS.filter((c) => c.item.badge === "sem demo nesta galeria");
  if (stub.length) bad("cards sem demo: " + stub.map((c) => c.item.id).join(", "));

  const gaps = G.CARDS.filter((c) => c.item.badge);
  console.log(`ok  registry coberto · ${gaps.length} mecanica(s) marcada(s) sem animacao propria`);
  const silent = G.SECTIONS.find((s) => s.title === "Pecas" || s.title === "Peças");
  if (silent) {
    const quiet = silent.items.filter((i) => i.badge).map((i) => i.id);
    console.log(`    pecas sem nada em tela: ${quiet.length ? quiet.join(", ") : "nenhuma"}`);
  }
}

if (fail) { console.error(`\n${fail} falha(s)`); __exit(1); }
console.log("ok  galeria integra");
