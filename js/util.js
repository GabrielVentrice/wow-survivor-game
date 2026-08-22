"use strict";
/* =========================================================================
   UTIL — helpers puros, sem dependencia de nada. Carrega primeiro.
   ========================================================================= */

// `?mode=dev` na URL libera painel de debug no menu
const DEV_MODE = new URLSearchParams(location.search).get("mode") === "dev";

const EMPTY_ARR = [];            // sentinela p/ render nao alocar por frame
const PULSE_LIFE = 0.9;          // duracao da onda de choque de desbloqueio
const DEFAULT_FORMS = [{ sprite: "warlock", at: 0, scale: 2.9 }];

// XP necessária para sair do nível `l` (lvl 1 = 1 orbe; ramp suave depois)
function xpForLevel(l) {
  return Math.floor(1 + (l - 1) * 2 + (l - 1) * (l - 1) * 0.4);
}

// número compacto: 1234 -> "1.2k", 2.5e6 -> "2.5M"
function fmtNum(n) {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return "" + n;
}

// "#rrggbb" -> "r,g,b" (para montar rgba com alpha variável)
function hexRgb(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Fisher-Yates in place
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// Clona estruturas de dado puras (objetos, arrays, primitivos). Usado pela
// resolucao de pecas: trigger/effects sao clonados antes de receber patches,
// para que o registry nunca seja mutado.
function deepClone(v) {
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = deepClone(v[i]);
    return out;
  }
  if (v && typeof v === "object") {
    const out = {};
    for (const k in v) out[k] = deepClone(v[k]);
    return out;
  }
  return v;
}

// Escreve em "a.b.2.c" dentro de um objeto. Usado pelos patches de tier.
function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function mmss(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
