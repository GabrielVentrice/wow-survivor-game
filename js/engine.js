"use strict";
/* =========================================================================
   ENGINE — pool, grid espacial, som, input, camera, barramento de eventos.
   Nada aqui conhece pecas, efeitos ou build. E infra pura.
   ========================================================================= */

class Pool {
  constructor(factory, reset) {
    this.factory = factory;
    this.reset = reset;
    this.active = [];
    this.free = [];
  }
  spawn(...args) {
    const obj = this.free.pop() || this.factory();
    this.reset(obj, ...args);
    this.active.push(obj);
    return obj;
  }
  release(i) {
    const obj = this.active[i];
    const last = this.active.length - 1;
    this.active[i] = this.active[last];
    this.active.pop();
    this.free.push(obj);
  }
  /* Remove tudo marcado como morto, de tras para frente.

     Separar "marcar" de "remover" e o que torna seguro um laco que dispara
     efeitos: um efeito pode acrescentar entidades AO MESMO pool no meio da
     varredura, e com release() em laco crescente o indice nunca alcanca o
     fim — o frame trava. */
  sweep(isDead) {
    const a = this.active;
    for (let i = a.length - 1; i >= 0; i--) if (isDead(a[i])) this.release(i);
  }
  clear() {
    while (this.active.length) this.release(this.active.length - 1);
  }
}

// --- Grid espacial: indexa inimigos por célula p/ buscas vizinhas baratas ---
class SpatialGrid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  _key(cx, cy) { return cx + "," + cy; }
  insert(e) {
    const k = this._key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); }
    b.push(e);
  }
  // chama fn(e) para cada inimigo nas 9 células ao redor de (x,y)
  forNear(x, y, fn) {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++) {
        const b = this.map.get(this._key(cx + ox, cy + oy));
        if (b) for (let i = 0; i < b.length; i++) fn(b[i]);
      }
  }
  /* Inimigo mais proximo, varrendo aneis de celulas de dentro para fora e
     parando assim que o proximo anel ja esta mais longe que o melhor achado.
     Substitui a varredura linear O(n) que rodava por projetil teleguiado por
     frame — com 400 inimigos era o gargalo do jogo. */
  nearest(x, y, maxDist, exclude, filter) {
    if (this.map.size === 0) return null;
    const c = this.cell;
    let best = null, bestD2 = maxDist * maxDist;

    /* Campo esparso: percorrer os aneis de celulas custaria milhares de
       lookups para achar meia duzia de inimigos. Abaixo deste ponto e mais
       barato varrer os baldes ocupados direto. */
    if (this.map.size <= 24) {
      for (const b of this.map.values()) {
        for (let i = 0; i < b.length; i++) {
          const e = b[i];
          if (e === exclude || e.hp <= 0 || e.charmed) continue;
          if (filter && !filter(e)) continue;
          const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
          if (d2 < bestD2) { bestD2 = d2; best = e; }
        }
      }
      return best;
    }

    const cx = Math.floor(x / c), cy = Math.floor(y / c);
    const maxRing = Math.min(32, Math.ceil(maxDist / c) + 1);
    for (let ring = 0; ring <= maxRing; ring++) {
      // borda interna do anel: se ja temos algo mais perto, nao ha o que achar
      if (best) {
        const inner = (ring - 1) * c;
        if (inner > 0 && inner * inner > bestD2) break;
      }
      const x0 = cx - ring, x1 = cx + ring, y0 = cy - ring, y1 = cy + ring;
      for (let gx = x0; gx <= x1; gx++) {
        for (let gy = y0; gy <= y1; gy++) {
          // so a casca do anel; o miolo ja foi visitado
          if (ring > 0 && gx !== x0 && gx !== x1 && gy !== y0 && gy !== y1) continue;
          const b = this.map.get(this._key(gx, gy));
          if (!b) continue;
          for (let i = 0; i < b.length; i++) {
            const e = b[i];
            if (e === exclude || e.hp <= 0 || e.charmed) continue;
            if (filter && !filter(e)) continue;
            const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; best = e; }
          }
        }
      }
    }
    return best;
  }

  // fn(e) para inimigos nas células que cobrem o círculo (x,y,r) — caller checa distância
  forRadius(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const b = this.map.get(this._key(cx, cy));
        if (b) for (let i = 0; i < b.length; i++) fn(b[i]);
      }
  }
}

// --- Som procedural via WebAudio (sem assets). Toggle com M. ---
class Sfx {
  constructor() { this.ctx = null; this.muted = false; this._lastDeath = 0; }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }
  // toca um tom simples com envelope de decaimento
  tone(freq, dur, type = "sine", vol = 0.08, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }
  death() {
    if (!this.ctx) return;
    if (this.ctx.currentTime - this._lastDeath < 0.05) return; // throttle anti-buzz
    this._lastDeath = this.ctx.currentTime;
    this.tone(180 + Math.random() * 60, 0.09, "square", 0.04);
  }
  hurt() { this.tone(120, 0.18, "sawtooth", 0.1); }
  levelUp() { this.tone(523, 0.12, "triangle", 0.12); this.tone(784, 0.16, "triangle", 0.1, 0.1); }
  combo() {
    this.tone(440, 0.1, "triangle", 0.12);
    this.tone(660, 0.1, "triangle", 0.12, 0.09);
    this.tone(880, 0.18, "triangle", 0.12, 0.18);
  }
  boss() { this.tone(80, 0.5, "sawtooth", 0.14); this.tone(60, 0.6, "sawtooth", 0.12, 0.05); }
  item() { this.tone(700, 0.09, "sine", 0.12); this.tone(1050, 0.12, "sine", 0.1, 0.08); }
  gameOver() { this.tone(330, 0.3, "triangle", 0.12); this.tone(196, 0.5, "triangle", 0.12, 0.18); }
}

// --- Input ---
class InputManager {
  constructor() {
    this.keys = new Set();
    const norm = (e) => {
      const k = e.key.toLowerCase();
      return ({ arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" })[k] || k;
    };
    addEventListener("keydown", (e) => {
      const k = norm(e);
      if ("wasd".includes(k)) e.preventDefault();
      this.keys.add(k);
    });
    addEventListener("keyup", (e) => this.keys.delete(norm(e)));
    addEventListener("blur", () => this.keys.clear());
  }
  // vetor de direção normalizado a partir do WASD
  moveVector(out) {
    let x = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    let y = (this.keys.has("s") ? 1 : 0) - (this.keys.has("w") ? 1 : 0);
    if (x && y) { const inv = Math.SQRT1_2; x *= inv; y *= inv; }
    out.x = x; out.y = y;
    return out;
  }
}

// --- Camera: segue o player, converte mundo→tela, desenha chão infinito ---
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;
    this.shake = 0;
    this.ox = 0;
    this.oy = 0;
    this.pattern = null; // textura do chão (CanvasPattern), setada pelo Game
  }
  resize(w, h) { this.w = w; this.h = h; }
  follow(target, dt, instant = false) {
    const t = instant ? 1 : 1 - Math.pow(1 - BALANCE.camera.lerp, dt * 60);
    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
  }
  updateShake(dt) {
    if (this.shake > 0) {
      this.ox = (Math.random() * 2 - 1) * this.shake;
      this.oy = (Math.random() * 2 - 1) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 30);
    } else { this.ox = 0; this.oy = 0; }
  }
  // canto superior-esquerdo do viewport em coords de mundo (com shake)
  get left() { return this.x - this.w / 2 + this.ox; }
  get top() { return this.y - this.h / 2 + this.oy; }

  // chão procedural: tile texturizado repetido, deslocado pela posição da câmera
  drawGround(ctx) {
    const t = BALANCE.world.tile;
    const left = this.left, top = this.top;
    const offX = left - Math.floor(left / t) * t;
    const offY = top - Math.floor(top / t) * t;
    ctx.save();
    ctx.translate(-offX, -offY);
    ctx.fillStyle = this.pattern;
    ctx.fillRect(0, 0, this.w + t, this.h + t);
    ctx.restore();
  }
}


/* --- Barramento de eventos ------------------------------------------------
   O que permite triggers `reactive` existirem sem que o motor conheca peca
   nenhuma: o jogo emite fatos ("inimigo morreu"), o TriggerSystem escuta.
   Handlers sao arrays simples e o emit nao aloca — roda em codigo quente. */
const EVENTS = {
  ENEMY_KILLED: "enemy_killed",       // { enemy, source }
  ENEMY_LOW: "enemy_low",             // { enemy, pct }
  ENEMY_HIT: "enemy_hit",             // { enemy, amount, key }
  PLAYER_DAMAGED: "player_damaged",   // { amount, source }
  PLAYER_LOW: "player_low",           // { pct }
  DOT_EXPIRED: "dot_expired",         // { enemy, dot }
  DOT_APPLIED: "dot_applied",         // { enemy, dot }
  BIG_HIT: "big_hit",                 // { enemy, amount, key }
  AREA_DAMAGE: "area_damage",         // { amount }
  MINION_HIT: "minion_hit",           // { minion, enemy, amount }
};

class EventBus {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    let l = this.map.get(name);
    if (!l) { l = []; this.map.set(name, l); }
    l.push(fn);
    return fn;
  }
  off(name, fn) {
    const l = this.map.get(name);
    if (!l) return;
    const i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  }
  clear() { this.map.clear(); }
  emit(name, payload) {
    const l = this.map.get(name);
    if (!l) return;
    for (let i = 0; i < l.length; i++) l[i](payload);
  }
}
