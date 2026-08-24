// Harness headless: stub minimo de DOM/canvas para rodar a simulacao no node
// e cacar erro de runtime sem abrir o browser.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = process.argv[2] || ".";

const __draw = { calls: {}, reset() { this.calls = {}; } };
function stubCtx() {
  const noop = () => {};
  const count = (k) => () => { __draw.calls[k] = (__draw.calls[k] || 0) + 1; };
  const grad = { addColorStop: noop };
  return new Proxy({
    canvas: null,
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 10 }),
    drawImage: count("drawImage"),
    fill: count("fill"),
    stroke: count("stroke"),
    fillRect: count("fillRect"),
    createRadialGradient: () => { __draw.calls.gradient = (__draw.calls.gradient || 0) + 1; return grad; },
  }, {
    get(t, k) {
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function stubEl(id) {
  const el = {
    id, innerHTML: "", textContent: "", className: "", value: "",
    /* `setProperty` precisa existir de verdade: a UI passa as cores de eixo
       por variavel CSS (`--acc`), e um proxy que devolve "" para toda
       propriedade fazia a chamada estourar. Devolvendo no-op, o codigo real de
       montagem de tela roda no headless em vez de ser desviado pelo driver. */
    /* `style` LEMBRA o que foi escrito. Um proxy que devolvia "" para tudo
       deixava o codigo de montagem rodar, mas quem le de volta uma variavel
       que acabou de escrever (a previa, que remonta a tela a partir do que a
       UI produziu) recebia vazio e caia no default — a tela conferida deixava
       de ser a tela do jogo. */
    style: (() => {
      const props = {};
      return new Proxy(props, {
        get: (t, k) => (
          k === "setProperty" ? (n, v) => { props[n] = v; } :
          k === "getPropertyValue" ? (n) => props[n] || "" :
          k === "removeProperty" ? (n) => { delete props[n]; } :
          (k in props ? props[k] : "")),
        set: (t, k, v) => { props[k] = v; return true; },
      });
    })(),
    dataset: {}, children: [], width: 0, height: 0,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    appendChild(c) { this.children.push(c); return c; },
    /* A UI escreve as tres variaveis de cor do eixo de uma vez, em `style`.
       Sem isto o headless desviava do codigo real de montagem de tela. */
    setAttribute(k, v) { this[k === "class" ? "className" : k] = v; },
    getAttribute(k) { return this[k === "class" ? "className" : k]; },
    remove() {},
    querySelectorAll: () => [],
    querySelector: () => stubEl("q"),
    addEventListener: () => {},
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
    clientWidth: 0, clientHeight: 0, title: "",
    getContext: () => stubCtx(),
    onclick: null,
  };
  el[Symbol.iterator] = function* () { yield* el.children; };
  return el;
}

const ELS = new Map();
const document = {
  getElementById(id) {
    if (!ELS.has(id)) ELS.set(id, stubEl(id));
    return ELS.get(id);
  },
  createElement: (tag) => stubEl(tag),
  addEventListener: () => {},
  querySelectorAll: () => [],
  body: stubEl("body"),
};

const sandbox = {
  document,
  window: null,
  console,
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  location: { search: "" },
  URLSearchParams: class { constructor() {} get() { return null; } },
  addEventListener: () => {},
  requestAnimationFrame: () => 1,
  atob: (b64) => Buffer.from(b64, "base64").toString("binary"),
  Buffer,
  setTimeout: () => 0,
  clearTimeout: () => {},
  performance: { now: () => 0 },
  // as galerias so desenham o card visivel; sem observer, todos ficam visiveis
  IntersectionObserver: function () { return { observe: () => {}, disconnect: () => {} }; },
  navigator: { clipboard: null },
  // AudioContext falso: o codigo de som constroi o grafo de verdade, entao
  // erro de API (createBuffer, rampa exponencial partindo de zero) aparece aqui
  // em vez de so no browser.
  AudioContext: function () {
    const param = (v) => ({ value: v, setValueAtTime: () => {},
      exponentialRampToValueAtTime: (target) => {
        if (!(target > 0)) throw new Error("exponentialRamp com alvo <= 0");
      },
      linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {} });
    const node = () => ({ connect: () => {} });
    const ctx = {
      state: "running", sampleRate: 44100,
      // segue o relogio da simulacao, senao o throttle de morte acha que
      // nenhum tempo passou e o som nunca toca duas vezes
      get currentTime() { return sandbox.game ? sandbox.game.clock : 0; },
      destination: node(), resume: () => {},
      // decodifica de mentira, mas so aceita bytes de WAV de verdade
      decodeAudioData: (arr, ok) => {
        const b = new Uint8Array(arr);
        const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
        if (tag !== "RIFF") throw new Error("decodeAudioData recebeu algo que nao e WAV: " + tag);
        const buf = { duration: (b.length - 44) / 2 / 22050, sampleRate: 22050, __wav: true };
        ok(buf);
        return null;
      },
      createBuffer: (ch, len, rate) => {
        if (!(len > 0)) throw new Error("createBuffer com length invalido");
        return { getChannelData: () => new Float32Array(len) };
      },
      createBufferSource: () => {
        const n = Object.assign(node(), { buffer: null, playbackRate: param(1) });
        n.start = () => { __audio.nodes++; if (n.buffer && n.buffer.__wav) __audio.samples++; };
        n.stop = () => {};
        return n;
      },
      createBiquadFilter: () => Object.assign(node(), {
        type: "", frequency: param(0), Q: param(0) }),
      createGain: () => Object.assign(node(), { gain: param(0) }),
      createDelay: () => Object.assign(node(), { delayTime: param(0) }),
      createWaveShaper: () => Object.assign(node(), {
        set curve(v) {
          if (!v || !v.length) throw new Error("WaveShaper sem curva");
          this._c = v;
        },
        get curve() { return this._c; },
        oversample: "none" }),
      // o barramento das vozes de combate: compressor de verdade no browser,
      // no-op aqui — o que interessa e que o grafo seja montado sem estourar
      createDynamicsCompressor: () => Object.assign(node(), {
        threshold: param(0), knee: param(0), ratio: param(0),
        attack: param(0), release: param(0) }),
      createOscillator: () => Object.assign(node(), {
        type: "", frequency: param(0), detune: param(0),
        start: () => { __audio.nodes++; }, stop: () => {} }),
    };
    return ctx;
  },
  webkitAudioContext: undefined,
};
const __audio = { nodes: 0, samples: 0 };
// Elemento <audio> falso: guarda os listeners para que o driver decida se o
// arquivo carrega, falha ou fica pendente — os tres caminhos importam.
const __track = {
  els: [], plays: 0,
  reset() { this.els = []; this.plays = 0; },
  succeed() { for (const e of this.els) (e._l.canplaythrough || []).forEach((f) => f()); },
  fail() { for (const e of this.els) (e._l.error || []).forEach((f) => f()); },
};
sandbox.__track = __track;
sandbox.Audio = function () {
  const el = {
    preload: "", loop: false, volume: 0, currentTime: 0, duration: 57.5,
    ended: false, src: "", playing: false, _l: {},
    addEventListener(n, fn) { (this._l[n] = this._l[n] || []).push(fn); },
    load() {},
    play() { __track.plays++; this.playing = true; return { catch: () => {} }; },
    pause() { this.playing = false; },
  };
  __track.els.push(el);
  return el;
};
sandbox.__audio = __audio;
sandbox.__draw = __draw;
/* A ABERTURA, para quem nao tem tela. `Game.start()` sem argumento abre a
   escolha inicial e para em STATE.STARTER — num driver isso e a run inteira
   parada, sem erro nenhum, o pior modo de falha que existe aqui. Com a peca
   dita no argumento, todo driver comeca com o mesmo kit de sempre e as
   medicoes continuam comparaveis com as de antes da tela existir.

   Quem quer exercitar a TELA (o smoke) chama `start()` sem argumento e
   escolhe pela UI, que e o unico jeito de o headless pegar erro de montagem. */
sandbox.STARTER_TESTE = "incinerate";
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// PAGE escolhe a pagina: index.html e o jogo, sprites.html/vfx.html sao as
// galerias. Os <script> rodam na ORDEM DO DOCUMENTO, src e inline misturados —
// e o que o browser faz, e sprites.html depende disso (ela declara MINIONS
// num inline antes de carregar quem usa).
const PAGE = process.env.PAGE || "index.html";
const HTML = fs.readFileSync(path.join(ROOT, PAGE), "utf8");

const TAGS = [];
const RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = RE.exec(HTML))) {
  const src = (m[1].match(/src="([^"]+)"/) || [])[1];
  if (src) TAGS.push({ src });
  else if (m[2].trim()) TAGS.push({ code: m[2] });
}

let files = 0, inline = 0;
for (const tag of TAGS) {
  const name = tag.src || `${PAGE}#inline${++inline}`;
  let code;
  if (tag.src) {
    files++;
    code = fs.readFileSync(path.join(ROOT, tag.src), "utf8");
  } else code = tag.code;
  try {
    vm.runInContext(code, sandbox, { filename: name });
  } catch (e) {
    console.error(`\nERRO AO CARREGAR ${name}:\n${e.stack}`);
    process.exit(1);
  }
}

console.log(`ok  ${PAGE}: ${files} arquivos + ${inline} inline`);

/* `aberturaDaClasse(cls)` — a abertura DA CLASSE, para o driver que roda mais de uma.

   `STARTER_TESTE` e uma peca do warlock: um driver que troque `selectedClass`
   e passe ele para `start()` abre uma run de hunter com uma spell de warlock,
   que e exatamente o vazamento entre classes que `driver_class` existe para
   pegar. Primeiro `starter` e nao sorteio, pelo mesmo motivo que
   `STARTER_TESTE` e fixo: medicao entre rodadas tem que ser comparavel.

   Ele e injetado AQUI, dentro do contexto, e nao como propriedade do sandbox:
   `const CLASSES` e declaracao lexica e nao vira propriedade do objeto de
   contexto (a mesma razao pela qual o driver tambem roda la dentro). */
vm.runInContext(
  "function aberturaDaClasse(clsId) {\n" +
  "  const c = typeof CLASSES !== 'undefined' && CLASSES[clsId];\n" +
  "  return c && c.starters && c.starters.length ? c.starters[0] : STARTER_TESTE;\n" +
  "}", sandbox, { filename: "harness:abertura" });

// Declaracoes lexicais (const/class) de cada <script> NAO viram propriedades do
// objeto de contexto — vivem no escopo lexical global dele, exatamente como no
// browser. Entao o driver de teste tambem precisa rodar dentro do contexto.
const driver = fs.readFileSync(path.join(__dirname, process.env.DRIVER || "driver.js"), "utf8");
sandbox.__argv = process.argv.slice(2);
sandbox.__page = PAGE;
sandbox.__exit = (code) => process.exit(code);
sandbox.__now = () => Date.now();
// Acesso a arquivos do repo, para o driver que PRODUZ artefato em vez de so
// medir (driver_preview monta a previa da tela de level-up com o CSS real do
// index.html). Caminhos sao relativos a raiz do jogo, nunca absolutos.
sandbox.__read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
sandbox.__write = (rel, text) => fs.writeFileSync(path.join(ROOT, rel), text);
try {
  vm.runInContext(driver, sandbox, { filename: "driver.js" });
} catch (e) {
  console.error("\nERRO NO DRIVER:\n" + e.stack);
  process.exit(1);
}
