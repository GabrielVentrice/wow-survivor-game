"use strict";
/* =========================================================================
   RESOLVE — o pipeline de stats. Substitui o antigo Game.buffedStats.

   piece.stats (base)
     -> mods dos tiers comprados (na ordem dos tiers)
       -> mods das passivas globais (casadas por tag)
         -> mods do capstone ativo
           -> patches estruturais (tier/passiva/capstone) em trigger e effects
             -> resolucao das referencias "@stat" para numeros

   Roda UMA vez por aquisicao, nao por tick: o resultado fica em `inst.r`.
   Em runtime, trigger e efeitos so leem numeros — nenhuma string e parseada
   dentro do loop, nenhum objeto e alocado por frame.
   ========================================================================= */

// --- Registries. Preenchidos pelos arquivos de js/content/. Adicionar peca
// nova = adicionar entrada aqui, zero mudanca no motor.
const PIECES = {};
const PASSIVES = {};
const CAPSTONES = {};
const MINIONS = {};

// Acucar para escrever tier em uma linha. n=nome, d=descricao,
// m=mods numericos, p=patch estrutural.
function T(n, d, m, p) { return { name: n, desc: d, mods: m, patch: p }; }

/* --- mods numericos ------------------------------------------------------
   { set } sobrescreve, { add } soma, { mul } multiplica. Aplicados nessa
   ordem dentro de um mesmo mod para que `{set:0, add:3}` seja previsivel. */
function applyMods(stats, mods) {
  if (!mods) return;
  for (const k in mods) {
    const m = mods[k];
    if (typeof m === "number") { stats[k] = m; continue; }
    if (m.set != null) stats[k] = m.set;
    if (m.add != null) stats[k] = (stats[k] || 0) + m.add;
    if (m.mul != null) stats[k] = (stats[k] || 0) * m.mul;
    if (m.min != null) stats[k] = Math.max(m.min, stats[k]);
    if (m.max != null) stats[k] = Math.min(m.max, stats[k]);
  }
}

// "@damage", "@damage*3", "@duration+2" -> numero
const REF_RE = /^([A-Za-z_]\w*)(?:([*+\/-])(-?[\d.]+))?$/;
function resolveRef(str, stats) {
  const m = REF_RE.exec(str.slice(1));
  if (!m) return 0;
  let n = stats[m[1]];
  if (n == null) return 0;
  if (m[2]) {
    const k = parseFloat(m[3]);
    n = m[2] === "*" ? n * k : m[2] === "/" ? n / k : m[2] === "+" ? n + k : n - k;
  }
  return n;
}

// Troca in-place toda string "@..." da arvore por seu valor numerico.
function resolveTree(node, stats) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === "string" && v.charCodeAt(0) === 64) node[i] = resolveRef(v, stats);
      else if (v && typeof v === "object") resolveTree(v, stats);
    }
    return;
  }
  for (const k in node) {
    const v = node[k];
    if (typeof v === "string" && v.charCodeAt(0) === 64) node[k] = resolveRef(v, stats);
    else if (v && typeof v === "object") resolveTree(v, stats);
  }
}

/* Resolve uma instancia de peca contra o estado da build.
   `build` precisa expor collectMods(def, stats) e collectPatches(def, shell). */
function resolvePiece(inst, build) {
  const def = inst.def;
  const stats = Object.assign({}, def.stats);

  // 1. tiers comprados
  for (const pathId in inst.paths) {
    const n = inst.paths[pathId];
    if (!n) continue;
    const tiers = def.paths[pathId].tiers;
    for (let i = 0; i < n; i++) applyMods(stats, tiers[i].mods);
  }
  // 2. passivas globais + 3. capstone
  build.collectMods(def, stats, inst);

  // 4. estrutura: clona para nunca mutar o registry
  const shell = { trigger: deepClone(def.trigger), effects: deepClone(def.effects) };
  for (const pathId in inst.paths) {
    const n = inst.paths[pathId];
    if (!n) continue;
    const tiers = def.paths[pathId].tiers;
    for (let i = 0; i < n; i++) {
      const patch = tiers[i].patch;
      if (patch) for (const k in patch) setPath(shell, k, deepClone(patch[k]));
    }
  }
  build.collectPatches(def, shell, inst);

  // 5. "@stat" -> numero
  resolveTree(shell, stats);

  return { stats, trigger: shell.trigger, effects: shell.effects };
}

/* Texto do proximo tier de um caminho, para a carta de upgrade. */
function tierDesc(def, pathId, tierIndex) {
  const t = def.paths[pathId].tiers[tierIndex];
  return t ? t.desc : "";
}
