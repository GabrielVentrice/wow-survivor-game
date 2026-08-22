// Harness headless: stub minimo de DOM/canvas para rodar a simulacao no node
// e cacar erro de runtime sem abrir o browser.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = process.argv[2] || ".";

function stubCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return new Proxy({
    canvas: null,
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 10 }),
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
    style: new Proxy({}, { get: () => "", set: () => true }),
    dataset: {}, children: [], width: 0, height: 0,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    querySelectorAll: () => [],
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
  setTimeout: () => 0,
  AudioContext: undefined, webkitAudioContext: undefined,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const FILES = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
  .split("\n")
  .map((l) => (l.match(/<script src="([^"]+)"/) || [])[1])
  .filter(Boolean);

for (const f of FILES) {
  const code = fs.readFileSync(path.join(ROOT, f), "utf8");
  try {
    vm.runInContext(code, sandbox, { filename: f });
  } catch (e) {
    console.error(`\nERRO AO CARREGAR ${f}:\n${e.stack}`);
    process.exit(1);
  }
}
console.log(`ok  ${FILES.length} arquivos carregados`);

// Declaracoes lexicais (const/class) de cada <script> NAO viram propriedades do
// objeto de contexto — vivem no escopo lexical global dele, exatamente como no
// browser. Entao o driver de teste tambem precisa rodar dentro do contexto.
const driver = fs.readFileSync(path.join(__dirname, process.env.DRIVER || "driver.js"), "utf8");
sandbox.__argv = process.argv.slice(2);
sandbox.__exit = (code) => process.exit(code);
sandbox.__now = () => Date.now();
try {
  vm.runInContext(driver, sandbox, { filename: "driver.js" });
} catch (e) {
  console.error("\nERRO NO DRIVER:\n" + e.stack);
  process.exit(1);
}
