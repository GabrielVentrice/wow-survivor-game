/* =========================================================================
   BROWSER — o que o harness estruturalmente NÃO vê.

   O resto de `tools/` sobe um stub de DOM/canvas no node. Isso é o que torna
   a bateria barata, e é também o teto dela: o canvas stub **aceita tudo**.
   `addColorStop("rgba(undefined,0)")` passa calado ali e lança no browser —
   foi exatamente esse o bug que derrubava um quadro inteiro do jogo perto de
   todo tiro sem rastro, com os 24 drivers em verde.

   E o stub não tem preço: ele conta chamadas de desenho e não pode dizer
   quanto cada uma custa. `driver_perf` mede a SIMULAÇÃO; quem mede o RENDER é
   este arquivo.

   Dois modos, e eles respondem perguntas diferentes:

     bench — quanto custa um quadro, em ms, com a horda grande.
     shot  — o desenho mudou? Cena FIXA, comparada pixel a pixel.

   `shot` existe porque otimizar render sem ele é apostar. Um quadro de
   batalha não serve de referência — ele depende da run inteira, e duas
   rodadas nunca dão o mesmo mundo. A cena do `shot` tem os corpos em posição
   conhecida, então a única coisa que muda entre duas rodadas é o código de
   desenho, e a resposta é um hash igual ou diferente.

   NENHUMA DEPENDÊNCIA ENTRA NO REPO. O playwright é instalado fora dele e
   achado por NODE_PATH — ver `tools/README.md`. Sem playwright, este arquivo
   não roda e o resto da bateria não sabe que ele existe: ele fica fora do
   `run-all.js` de propósito, porque a bateria não pode depender de algo que
   o repo não carrega.

   Uso:
     node tools/browser.js bench [minutos]
     node tools/browser.js shot <tag> [tag-de-referencia]
   ========================================================================= */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.BROWSER_OUT || path.join(os.tmpdir(), "pacto-browser");

let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) {
  console.error(`  playwright nao encontrado.

  Ele NAO entra no repo — este projeto nao tem package.json e nao vai ter.
  Instale fora e aponte o NODE_PATH:

    mkdir -p ~/.pacto-browser && cd ~/.pacto-browser && npm init -y && npm i playwright
    npx playwright install chromium
    NODE_PATH=~/.pacto-browser/node_modules node tools/browser.js bench
`);
  process.exit(2);
}

/* O executavel do chromium.

   `chromium.launch()` sozinho procura a build que AQUELA versao do playwright
   espera, e ela quase nunca e a que ja esta na maquina — num ambiente com
   browsers pre-instalados isso falha pedindo um download que nao e preciso.
   Entao: tenta o normal, e se nao houver, varre o PLAYWRIGHT_BROWSERS_PATH. */
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return null;
  for (const d of fs.readdirSync(base)) {
    if (!d.startsWith("chromium-")) continue;
    const p = path.join(base, d, "chrome-linux", "chrome");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function open() {
  const exe = findChromium();
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ["--allow-file-access-from-files"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto("file://" + ROOT + "/index.html");
  await page.waitForFunction(() => !!window.game, null, { timeout: 15000 });
  page.setDefaultTimeout(600000);
  return { browser, page, errs };
}

/* Instancia NOVA depois da seed, que e o que todo driver faz.

   Reaproveitar a que a pagina montou no DOMContentLoaded deixa dentro dela o
   estado dos quadros que ja rodaram — e o mundo sai diferente a cada rodada
   (medido: 1842 a 1983 corpos), o que torna impossivel comparar duas variantes
   de render. */
const BOOT = `
  window.game._loop = () => {};
  let sd = SEED;
  Math.random = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
  const g = new Game(); window.game = g; g._loop = () => {};
  g.ui.openChest = () => { g.state = STATE.PLAYING; };
  g.ui.openMilestone = () => { g.pendingMilestones = 0; g.state = STATE.PLAYING; };
`;

async function bench(min) {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(new Function("MIN", `
    ${BOOT.replace("SEED", "21")}
    g.ui.openLevelUp = function () {
      const o = g.build.getOffers(3);
      if (!o.length) { g.player.pendingLevels = 0; g.state = STATE.PLAYING; return; }
      g.ui.applyOffer(o[Math.floor(Math.random() * o.length)]);
    };
    g.start();

    /* Sem folga para o event loop: um setTimeout aqui deixa o rAF da pagina
       rodar entre os passos e o mundo deixa de ser o mesmo entre rodadas. */
    const steps = Math.round((MIN * 60) / (1 / 60));
    for (let i = 0; i < steps; i++) {
      g.player.hp = g.player.maxHp;               // imortal: queremos o teto da horda
      const ang = i * 0.008;
      g.input.keys = new Set(((i / 500) % 1) > 0.8 ? [] : [Math.cos(ang) > 0 ? "d" : "a", Math.sin(ang) > 0 ? "s" : "w"]);
      g.update(1 / 60);
    }

    g._frameDt = 1 / 60;
    for (let i = 0; i < 30; i++) g.render();      // aquece cache de sprite
    const N = 120, ts = [];
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      g.render();
      ts.push(performance.now() - t0);
    }
    ts.sort((a, b) => a - b);
    return {
      inimigos: g.enemies.active.length,
      mediana: ts[N >> 1], p90: ts[Math.floor(N * 0.9)], pior: ts[N - 1],
      media: ts.reduce((a, b) => a + b, 0) / N,
    };
  `), min);
  await browser.close();
  if (errs.length) { console.error("  ERRO NA PAGINA: " + errs.slice(0, 3).join(" | ")); process.exit(1); }
  console.log(`  ${out.inimigos} inimigos — render: mediana ${out.mediana.toFixed(2)}ms · media ` +
    `${out.media.toFixed(2)}ms · p90 ${out.p90.toFixed(2)}ms · pior ${out.pior.toFixed(2)}ms` +
    `   (orcamento 16.7ms)`);
  console.log(`\n  O ruido entre rodadas e ~0.5ms. Diferenca menor que isso nao e diferenca:` +
    `\n  rode as duas variantes INTERCALADAS, 3x cada, e compare as medianas.`);
}

async function shot(tag, ref) {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(new Function(`
    ${BOOT.replace("SEED", "5")}
    g.ui.openLevelUp = () => { g.player.pendingLevels = 0; g.state = STATE.PLAYING; };
    g.start();
    g.enemies.clear(); g.particles.clear(); g.projectiles.clear(); g.orbs.clear();

    /* Um de cada tipo em grade, MAIS um aglomerado sobreposto: a sombra de um
       corpo cai em cima da do vizinho, e e ali que "cada fill separado escurece
       de novo" vira visivel. Otimizacao que junte as sombras num path so falha
       exatamente neste bloco, e em nenhum outro. */
    const scale = { speed: 1, hp: 1, dmg: 1 };
    let i = 0;
    for (const t of Object.values(ENEMIES)) {
      g.enemies.spawn(t, 1600 + (i % 6) * 150, 1400 + Math.floor(i / 6) * 150, scale);
      i++;
    }
    for (let k = 0; k < 40; k++) {
      const a = k * 0.7, d = 10 + k * 1.6;
      g.enemies.spawn(ENEMIES.ghoul, 1350 + Math.cos(a) * d, 1800 + Math.sin(a) * d, scale);
    }
    g.player.x = 1500; g.player.y = 1600;
    const c = g.camera;
    c.x = 1500; c.y = 1600;
    c.rawLeft = c.x - c.w / 2; c.rawTop = c.y - c.h / 2;
    c.left = Math.round(c.rawLeft); c.top = Math.round(c.rawTop);

    g._frameDt = 1 / 60;
    g.render(); g.render();                        // a primeira gera cache de sprite
    const url = g.canvas.toDataURL();

    /* Assinatura numerica ao lado do hash: quando as imagens diferem, o hash
       so diz QUE diferem, e a pergunta seguinte e sempre QUANTO. */
    const sc = document.createElement("canvas");
    sc.width = 96; sc.height = Math.round(96 * g.canvas.height / g.canvas.width);
    const x2 = sc.getContext("2d");
    x2.drawImage(g.canvas, 0, 0, sc.width, sc.height);
    const px = x2.getImageData(0, 0, sc.width, sc.height).data;
    const sig = [];
    for (let j = 0; j < px.length; j += 4) sig.push(px[j], px[j + 1], px[j + 2]);
    return { url, sig, corpos: g.enemies.active.length };
  `));
  await browser.close();
  if (errs.length) { console.error("  ERRO NA PAGINA: " + errs.slice(0, 3).join(" | ")); process.exit(1); }

  fs.mkdirSync(OUT, { recursive: true });
  const hash = crypto.createHash("sha1").update(out.url).digest("hex").slice(0, 12);
  fs.writeFileSync(path.join(OUT, tag + ".sig.json"), JSON.stringify({ hash, sig: out.sig }));
  console.log(`  ${out.corpos} corpos — hash da imagem: ${hash}   (${path.join(OUT, tag + ".sig.json")})`);
  if (!ref) return;

  const rp = path.join(OUT, ref + ".sig.json");
  if (!fs.existsSync(rp)) { console.error(`  referencia "${ref}" nao existe em ${OUT}`); process.exit(1); }
  const a = JSON.parse(fs.readFileSync(rp, "utf8"));
  if (a.hash === hash) { console.log(`  IDENTICA a "${ref}" — pixel a pixel`); return; }
  let max = 0, sum = 0, n = 0;
  for (let j = 0; j < a.sig.length; j++) {
    const d = Math.abs(a.sig[j] - out.sig[j]);
    sum += d; if (d > max) max = d; if (d) n++;
  }
  console.log(`  DIFERE de "${ref}": desvio medio ${(sum / a.sig.length).toFixed(2)}/255, ` +
    `pior ${max}/255, ${(n / a.sig.length * 100).toFixed(1)}% dos canais`);
}

const [mode, a1, a2] = process.argv.slice(2);
if (mode === "bench") bench(Number(a1 || 4));
else if (mode === "shot" && a1) shot(a1, a2);
else {
  console.error("  node tools/browser.js bench [minutos]\n  node tools/browser.js shot <tag> [referencia]");
  process.exit(2);
}
