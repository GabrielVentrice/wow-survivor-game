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

/* Ruido branco de meio segundo, gerado uma vez por AudioContext e
   reaproveitado por todo mundo. E a materia-prima de tudo que e percussivo:
   estalo de osso, pele de tambor, chiado de fel. */
let _noiseBuf = null, _noiseCtx = null;
function noiseBuffer(ctx) {
  if (_noiseBuf && _noiseCtx === ctx) return _noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  _noiseBuf = buf; _noiseCtx = ctx;
  return buf;
}

/* Curva de saturacao suave para WaveShaper. Da mordida aos metais sem virar
   distorcao de guitarra. Construida uma vez. */
let _driveCurve = null;
function driveCurve() {
  if (_driveCurve) return _driveCurve;
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * 2.2) * 0.82;
  }
  _driveCurve = c;
  return c;
}

// --- Som procedural via WebAudio (sem assets). Toggle com M. ---
class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._lastDeath = 0;
    this._deathBurst = 0;   // quantas mortes recentes: abaixa o volume em leva
    this._noiseBuf = null;
  }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    // browsers suspendem o contexto ate um gesto do usuario
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
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

  /* --- blocos de som procedural -----------------------------------------
     Ruido branco de meio segundo, gerado uma vez e reaproveitado. E a
     materia-prima de tudo que e percussivo: estalo de osso, esmagamento,
     baque de corpo. */
  _noise() { return noiseBuffer(this.ctx); }

  // rajada de ruido filtrada — o timbre vem do filtro, o "peso" vem do decay
  _burst(t, dur, filter, freq, q, vol, rate) {
    const ctx = this.ctx;
    if (vol < 0.0005) return;   // rampa exponencial precisa partir de valor > 0
    const src = ctx.createBufferSource();
    src.buffer = this._noise();
    src.playbackRate.value = rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + dur);
  }

  // tom com a frequencia caindo — baque de corpo e grunhido saem daqui
  _sweep(t, f0, f1, dur, type, vol, lowpass) {
    const ctx = this.ctx;
    if (vol < 0.0005) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = lowpass; f.Q.value = 0.7;
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  /* Morte de um soldado da Legiao: nao e um bipe, sao quatro camadas.
       1. dois ou tres estalos secos          -> osso quebrando
       2. rajada grave e curta                -> carne/armadura cedendo
       3. queda de frequencia no grave        -> o corpo batendo no chao
       4. grunhido descendente                -> o ultimo som que ele faz

     `size` 0..1 escala tudo para o grave (ghoul e leve, Dreadlord e pesado) e
     `kind` troca a proporcao entre osso e carne — esqueleto estala mais e
     esmaga menos. Ambos vem do dado em ENEMIES, nao de `if` aqui. */
  death(size, kind) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this._lastDeath < 0.04) return;   // throttle anti-buzz

    /* Leva inteira morrendo junto vira lama sonora. O contador sobe a cada
       morte e cai com o tempo; o teto existe porque numa chacina o decaimento
       nunca alcanca o acumulo, e sem ele o volume iria a zero e as mortes
       ficariam mudas justamente quando ha mais coisa acontecendo. */
    this._deathBurst = Math.min(8, Math.max(0, this._deathBurst - (now - this._lastDeath) * 6) + 1);
    this._lastDeath = now;
    const duck = 1 / (1 + this._deathBurst * 0.22);

    const s = size > 1 ? 1 : size < 0 ? 0 : (size || 0);
    const bony = kind === "bone";
    const rot = kind === "rot";
    const vol = duck * (0.75 + s * 0.55);

    // 1. estalos de osso: bandpass estreito e decay curtissimo
    const cracks = bony ? 3 + (Math.random() < 0.5 ? 1 : 0) : 2 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < cracks; i++) {
      const t = now + i * (0.011 + Math.random() * 0.022);
      const f = (bony ? 3100 : 2500) - s * 900 + Math.random() * 800;
      this._burst(t, 0.038 + Math.random() * 0.02, "bandpass", f, 11,
                  (bony ? 0.075 : 0.055) * vol, 0.85 + Math.random() * 0.5);
    }

    // 2. esmagamento: grave, largo, curto
    this._burst(now + 0.008, 0.11 + s * 0.1, "lowpass",
                (rot ? 480 : 720) - s * 260, 1, (bony ? 0.03 : 0.055) * vol,
                0.7 + Math.random() * 0.3);

    // 3. baque do corpo no chao
    this._sweep(now + 0.02, 125 - s * 48, 36 - s * 12, 0.17 + s * 0.14,
                "sine", 0.085 * vol);

    // 4. grunhido — so nos maiores, ou de vez em quando nos pequenos, para
    //    nao virar coro quando a horda inteira cai junto
    if (s > 0.3 || Math.random() < 0.28) {
      this._sweep(now + 0.005, 235 - s * 95 + Math.random() * 40, 68 - s * 24,
                  0.15 + s * 0.13, "sawtooth", 0.04 * vol, 780 - s * 200);
    }

    /* 5. guincho de fel: uma serra despencando por um bandpass estreito e
       saturada. E o que separa "algo quebrou" de "algo da Legiao morreu".
       Curto e discreto de proposito — a horda inteira guinchando junto seria
       insuportavel, entao so os corpos maiores guincham sempre. */
    if (s > 0.25 || Math.random() < 0.35) {
      this._screech(now + 0.004, 0.1 + s * 0.11, 0.05 * vol * (0.7 + s * 0.6), s);
    }

    // 6. so o chefe: a armadura cedendo depois que o corpo ja caiu
    if (s >= 0.95) {
      this._burst(now + 0.13, 0.09, "bandpass", 1500 + Math.random() * 600, 8, 0.07);
      this._burst(now + 0.19, 0.26, "lowpass", 320, 1, 0.07, 0.6);
      this._sweep(now + 0.16, 70, 28, 0.42, "sine", 0.1);
    }
  }

  // guincho demoniaco: serra caindo rapido, saturada, num bandpass estreito
  _screech(t, dur, vol, size) {
    if (vol < 0.0005) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const f0 = (1150 - size * 420) * (0.85 + Math.random() * 0.3);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, f0 * 0.17), t + dur);
    const sh = ctx.createWaveShaper();
    sh.curve = driveCurve();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500 - size * 500;
    bp.Q.value = 4.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(sh); sh.connect(bp); bp.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  hurt() { this.tone(120, 0.18, "sawtooth", 0.1); }
  levelUp() { this.tone(523, 0.12, "triangle", 0.12); this.tone(784, 0.16, "triangle", 0.1, 0.1); }
  combo() {
    this.tone(440, 0.1, "triangle", 0.12);
    this.tone(660, 0.1, "triangle", 0.12, 0.09);
    this.tone(880, 0.18, "triangle", 0.12, 0.18);
  }
  // chegada de chefe: rugido saturado descendo, com o ar sacudindo por baixo
  boss() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this._screech(now, 0.7, 0.09, 0.2);
    this._sweep(now + 0.02, 130, 42, 0.9, "sawtooth", 0.11, 500);
    this._sweep(now + 0.1, 62, 26, 1.3, "sine", 0.12);
    this._burst(now + 0.05, 0.5, "lowpass", 380, 1, 0.06, 0.5);
  }
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
