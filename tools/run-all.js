/* =========================================================================
   run-all — a bateria inteira, em paralelo, com o mais lento na frente.

   A bateria e serial por acidente e nao por necessidade: cada driver e um
   processo independente que carrega a propria copia do jogo e nao fala com
   ninguem. Rodando um por vez, o relogio de parede e a SOMA de todos; rodando
   em pool, ele e o driver mais lento — MEDIDO, 175s viraram ~60s em 4 nucleos.

   Duas decisoes que sao o que faz a conta fechar:

   - **O mais lento entra primeiro.** Com quatro nucleos e um driver de 58s, a
     ordem alfabetica termina com ele comecando por ultimo e o pool inteiro
     esperando por um processo so. Ordenado por custo decrescente, o resto da
     bateria cabe DENTRO da janela dele.
   - **O custo e medido, nao digitado.** Cada rodada grava os tempos em
     `.run-all-times.json` (fora do repo) e a proxima ordena por eles. Tabela de
     pesos escrita a mao envelhece calada no primeiro driver novo — e um driver
     que ficou lento sem ninguem notar e exatamente o que esta ferramenta
     existe para tornar visivel.

   Uso:
     node tools/run-all.js              # a bateria toda (tier `full`)
     node tools/run-all.js fast         # so o que roda em menos de 1s
     node tools/run-all.js deep         # balance/perf/autopsy (minutos)
     node tools/run-all.js vfx,cards    # um subconjunto, por nome parcial
     node tools/run-all.js -j 8         # outra largura de pool
   ========================================================================= */
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TIMES = path.join(__dirname, ".run-all-times.json");

/* A bateria. `fast` e o que roda a cada edit; `full` e o que roda antes de
   commitar; `deep` mede em vez de verificar, e sai por pedido.
   `weight` e so o palpite inicial da ordenacao — o arquivo de tempos manda. */
const BATTERY = [
  // tier full: simulam minutos de jogo, e sao eles que ditam o relogio
  { name: "render",    driver: "driver_render.js",    tier: "full", weight: 58000 },
  { name: "audio",     driver: "driver_audio.js",     tier: "full", weight: 42000 },
  /* O bau passou a agregar QUATRO seeds, e com isso virou o pior caso da
     bateria (~140s, contra os ~42s do render). O motivo esta no cabecalho do
     driver: "40% dos baus dao premio grande" e distribucional, e uma run de 12
     min abre ~24 baus — amostra em que o piso cai dentro do ruido. Quem quiser
     a bateria curta de volta baixa o segundo argumento; e ele que compra a
     amostra. */
  { name: "chest",     driver: "driver_chest.js",     tier: "full", args: ["12", "4"], weight: 140000 },
  { name: "default",   driver: "driver.js",           tier: "full", weight: 28000 },

  // tier fast: exercitam mecanismo, nao duracao
  { name: "hooks",     driver: "driver_hooks.js",     tier: "fast", weight: 1500 },
  { name: "pixel",     driver: "driver_pixel.js",     tier: "fast", weight: 950 },
  { name: "vfx",       driver: "driver_vfx.js",       tier: "fast", weight: 800 },
  { name: "evo",       driver: "driver_evo.js",       tier: "fast", weight: 710 },
  { name: "form",      driver: "driver_form.js",      tier: "fast", weight: 700 },
  { name: "feel",      driver: "driver_feel.js",      tier: "fast", weight: 600 },
  { name: "music",     driver: "driver_music.js",     tier: "fast", weight: 430 },
  { name: "milestone", driver: "driver_milestone.js", tier: "fast", weight: 400 },
  { name: "dot",       driver: "driver_dot.js",       tier: "fast", weight: 150 },
  { name: "portal",    driver: "driver_portal.js",    tier: "fast", weight: 140 },
  { name: "track",     driver: "driver_track.js",     tier: "fast", weight: 120 },
  { name: "apex",      driver: "driver_apex.js",      tier: "fast", weight: 110 },
  { name: "spread",    driver: "driver_spread.js",    tier: "fast", weight: 105 },
  { name: "cards",     driver: "driver_cards.js",     tier: "fast", weight: 95 },
  { name: "palette",   driver: "driver_palette.js",   tier: "fast", weight: 75 },
  { name: "placar",    driver: "driver_leaderboard.js", tier: "fast", weight: 90 },

  /* O banco fica no `full` e nao no `fast`, e a razao e a mesma que separa os
     dois tiers: 450 celulas custam 20s, que e mais que a soma de todo o resto
     do `fast`. Quem esta iterando numa peca roda ele direto com filtro de eixo
     (`... 12 "" cataclysm`), que sai em ~7s. */
  { name: "bench",     driver: "driver_bench.js",     tier: "full", weight: 21000 },

  // as galerias: mesma bateria, outra pagina
  { name: "gal-vfx",     driver: "driver_gallery.js", page: "vfx.html",     tier: "full", weight: 6000 },
  { name: "gal-sprites", driver: "driver_gallery.js", page: "sprites.html", tier: "full", weight: 1500 },
  { name: "gal-icons",   driver: "driver_gallery.js", page: "icons.html",   tier: "full", weight: 1200 },

  // produz artefato em vez de medir, mas confere id contra o index.html
  { name: "preview",   driver: "driver_preview.js",   tier: "full", weight: 1500 },

  // tier deep: medem o jogo, levam minutos, saem por pedido
  { name: "balance",   driver: "driver_balance.js",   tier: "deep", args: ["4", "16"], weight: 600000 },
  { name: "perf",      driver: "driver_perf.js",      tier: "deep", args: ["12"],      weight: 120000 },
  { name: "autopsy",   driver: "driver_autopsy.js",   tier: "deep", args: ["8", "4"],  weight: 300000 },
];

/* --- argumentos ---------------------------------------------------------- */
const argv = process.argv.slice(2);
let jobs = Math.max(1, os.cpus().length - 1);
let sel = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "-j") { jobs = Number(argv[++i]) || jobs; continue; }
  sel = argv[i];
}

let list;
if (!sel || sel === "full") list = BATTERY.filter((d) => d.tier !== "deep");
else if (sel === "fast" || sel === "deep") list = BATTERY.filter((d) => d.tier === sel);
else if (sel === "all") list = BATTERY.slice();
else {
  const want = sel.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  list = BATTERY.filter((d) => want.some((w) => d.name.includes(w) || d.driver.includes(w)));
  if (!list.length) {
    console.error(`nenhum driver casa com "${sel}". Disponiveis: ` +
      BATTERY.map((d) => d.name).join(", "));
    process.exit(2);
  }
}

/* Tempos medidos da ultima rodada. Sem o arquivo, o `weight` da tabela serve
   de palpite — a primeira rodada ja o substitui. */
let known = {};
try { known = JSON.parse(fs.readFileSync(TIMES, "utf8")); } catch (e) { /* primeira vez */ }
const cost = (d) => known[d.name] || d.weight || 1000;
list.sort((a, b) => cost(b) - cost(a));

/* --- pool ---------------------------------------------------------------- */
const results = [];
let idx = 0, running = 0, failed = 0;
const t0 = Date.now();
const pad = Math.max(...list.map((d) => d.name.length));

console.log(`bateria: ${list.length} drivers, pool de ${jobs} (mais lento primeiro)\n`);

function launch() {
  while (running < jobs && idx < list.length) {
    const d = list[idx++];
    running++;
    const started = Date.now();
    const env = Object.assign({}, process.env, { DRIVER: d.driver });
    if (d.page) env.PAGE = d.page;
    const p = spawn(process.execPath, [path.join(__dirname, "harness.js"), ".", ...(d.args || [])],
      { cwd: ROOT, env });

    let out = "";
    p.stdout.on("data", (b) => { out += b; });
    p.stderr.on("data", (b) => { out += b; });
    p.on("close", (code) => {
      running--;
      const ms = Date.now() - started;
      known[d.name] = ms;
      const ok = code === 0;
      if (!ok) failed++;
      results.push({ d, ms, ok, out });
      console.log(`  ${ok ? "ok  " : "FALHOU"} ${d.name.padEnd(pad)} ${String(ms).padStart(6)}ms` +
        `${ok ? "" : "  (saida abaixo)"}`);
      if (!ok) console.log(out.split("\n").map((l) => "      | " + l).join("\n"));
      launch();
      if (!running && idx >= list.length) done();
    });
  }
}

function done() {
  const wall = Date.now() - t0;
  const soma = results.reduce((a, r) => a + r.ms, 0);
  console.log(`\n${results.length} drivers em ${(wall / 1000).toFixed(1)}s de relogio ` +
    `(${(soma / 1000).toFixed(1)}s de CPU somada, ${(soma / wall).toFixed(1)}x de ganho)`);
  try { fs.writeFileSync(TIMES, JSON.stringify(known, null, 1)); } catch (e) { /* so cache */ }
  if (failed) {
    console.error(`\n${failed} driver(s) reprovaram: ` +
      results.filter((r) => !r.ok).map((r) => r.d.name).join(", "));
    process.exit(1);
  }
  console.log("tudo verde");
}

launch();
