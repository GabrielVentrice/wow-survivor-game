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
/* The cell key is a PACKED INTEGER, and the reason is NOT the string it
   replaces.

   `cx + "," + cy` looked like the obvious cost — the separation pass does nine
   lookups per body per sub-step, so at the ceiling that is tens of thousands of
   throwaway strings. It was measured, and it is worth almost nothing: keeping
   the old per-body scan and only swapping the key in came back at 34318ms
   against the string version's 34183ms over the same four minutes. V8 hashes
   short strings well, and a key above 2^31 is a heap number, not an SMI.

   What the packing actually buys is that a NEIGHBOUR IS AN OFFSET. `key + 1` is
   the cell to the right and `key + GRID_SPAN` the one below, which is what lets
   `forPairs` walk the neighbourhood from a bucket it already has instead of
   rebuilding a key per body. That is where the time went — see `forPairs`.

   So the key is not the optimisation; it is what the optimisation needs.

   The bias bounds the world at +-2^21 cells. At cell 48 that is a hundred
   million world units in each direction; a long run walks a few hundred
   thousand, so the wrap is unreachable in practice. */
const GRID_SPAN = 4194304;   // 2^22 — one row of cells
const GRID_BIAS = 2097152;   // 2^21 — so negative coordinates stay positive

/* The four FORWARD neighbours: (+1,0), (-1,+1), (0,+1), (+1,+1).

   Half of the eight neighbours, chosen so that the other half is exactly their
   negatives — which is what makes `forPairs` visit each pair of adjacent cells
   once instead of twice, with the same coverage as a full 3x3 scan. */
const GRID_FWD = [1, GRID_SPAN - 1, GRID_SPAN, GRID_SPAN + 1];

class SpatialGrid {
  constructor(cell) {
    this.cell = cell;
    this.map = new Map();
    /* Occupied keys, kept alongside the Map so `forPairs` can walk the buckets
       with a plain indexed loop. Iterating `map.entries()` allocates a pair
       array per bucket, and there are thousands of buckets per sub-step. */
    this.keys = [];
  }
  clear() { this.map.clear(); this.keys.length = 0; }
  _key(cx, cy) { return (cy + GRID_BIAS) * GRID_SPAN + (cx + GRID_BIAS); }
  insert(e) {
    const k = this._key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); this.keys.push(k); }
    b.push(e);
  }

  /* fn(a, b) for every pair of entities sitting in the same cell or in
     adjacent ones — each pair once per call.

     This is where the separation pass got its time back, and the lever is the
     LOOKUP COUNT, not the arithmetic. Scanning nine cells around every body
     costs nine map lookups PER BODY; walking buckets costs four PER BUCKET,
     and a bucket holds about ten bodies at this density.

     Same coverage as calling `forNear` for every entity: both consider a pair
     iff the two cells are within one step on both axes.

     CALL IT TWICE. The shape it replaced looked at (a,b) and then again at
     (b,a), and the obvious reading — that the return visit was a no-op,
     because a resolved overlap ends exactly at contact distance — is wrong in
     this game, and measurably so. That reading holds for a blob left alone;
     here the horde pushes inward every sub-step, so the second look is not
     cleaning up after the first, it is corrective work against a load that
     never stops. Halving it let the horde close in: measured over four minutes
     with an immortal bot, bodies touching the player went 8.04 -> 10.12 at the
     four-minute mark and damage taken over the run went 22448 -> 26120, and
     `driver_balance` over thirty runs a side lost half the progression —
     capstones 14/30 -> 8/30, auras 16/30 -> 7/30, evolutions 13/30 -> 4/30.
     Two passes put it back (7.56 touching, 21697 damage) and still keep most
     of the win, because what got cheap was the lookups, not the pushes. */
  forPairs(fn) {
    const keys = this.keys, map = this.map;
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki];
      const b = map.get(key);
      const n = b.length;
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) fn(b[i], b[j]);
      for (let f = 0; f < 4; f++) {
        const o = map.get(key + GRID_FWD[f]);
        if (!o) continue;
        const m = o.length;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < m; j++) fn(b[i], o[j]);
      }
    }
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

/* Alcance em unidades de mundo alem do qual uma voz nao e nem agendada, e a
   folga que separa a nota do instante em que o frame rodou. */
const SFX_RANGE = 1100;
const SFX_LATENCY = 0.008;

// --- Som procedural via WebAudio (sem assets). Toggle com M. ---
class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._lastDeath = 0;
    this._deathBurst = 0;   // quantas mortes recentes: abaixa o volume em leva
    this.bone = null;       // amostra de osso quebrando, quando decodificada
    this.bus = null;        // barramento das vozes de combate (ver `say`)
    this._voiceAt = {};     // ultima vez que cada voz falou, por nome
    this._voiceBurst = 0;   // quantas vozes recentes: abaixa a leva inteira
    this._voiceLast = 0;
  }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    // browsers suspendem o contexto ate um gesto do usuario
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    this._buildBus();
    this._loadBone();
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
    o.connect(g); g.connect(this._dest());
    o.start(t); o.stop(t + dur);
  }

  /* --- blocos de som procedural -----------------------------------------
     Ruido branco de meio segundo, gerado uma vez e reaproveitado. E a
     materia-prima de tudo que e percussivo: estalo de osso, esmagamento,
     baque de corpo. */
  _noise() { return noiseBuffer(this.ctx); }

  /* Decodifica a amostra de osso embutida em base64. Enquanto nao termina — e
     se falhar — `death()` continua usando os estalos sinteticos, entao o som
     nunca some por causa disso. */
  _loadBone() {
    if (!this.ctx || this.bone || this._boneTried) return;
    this._boneTried = true;
    try {
      const data = decodeBase64Audio(BONE_BREAK_WAV);
      const done = (buf) => { this.bone = buf; };
      const p = this.ctx.decodeAudioData(data, done, () => {});
      if (p && p.then) p.then(done, () => {});
    } catch (e) { /* fica com os estalos sinteticos */ }
  }

  // toca a amostra com tom e volume variados; corpo maior toca mais grave
  _sample(buf, t, rate, vol) {
    if (vol < 0.0005) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    src.connect(g); g.connect(this._dest());
    src.start(t);
  }

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
    src.connect(f); f.connect(g); g.connect(this._dest());
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
    node.connect(g); g.connect(this._dest());
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

    /* 1. o estalo. Com a amostra decodificada usamos ela — osso quebrando de
       verdade tem uma irregularidade que ruido filtrado nao imita. O tom cai
       com o tamanho do corpo e sobe um pouco no esqueleto, que estala mais
       seco. Os estalos sinteticos ficam de reserva. */
    if (this.bone) {
      const rate = (bony ? 1.18 : 1.0) - s * 0.32 + (Math.random() - 0.5) * 0.16;
      this._sample(this.bone, now, Math.max(0.55, rate), (bony ? 0.5 : 0.36) * vol);
      // corpo grande: um segundo estalo logo atras, mais grave
      if (s > 0.45) {
        this._sample(this.bone, now + 0.05 + Math.random() * 0.04,
                     Math.max(0.5, rate * 0.8), 0.24 * vol);
      }
    } else {
      const cracks = bony ? 3 + (Math.random() < 0.5 ? 1 : 0) : 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < cracks; i++) {
        const t = now + i * (0.011 + Math.random() * 0.022);
        const f = (bony ? 3100 : 2500) - s * 900 + Math.random() * 800;
        this._burst(t, 0.038 + Math.random() * 0.02, "bandpass", f, 11,
                    (bony ? 0.075 : 0.055) * vol, 0.85 + Math.random() * 0.5);
      }
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

  /* --- o barramento -------------------------------------------------------
     Todo som do jogo passa por um compressor antes de sair. Nao e polimento:
     e o que torna possivel dar voz a cada peca. Cinquenta acertos no mesmo
     frame somam amplitude linearmente e estouram o master; com o compressor a
     leva inteira e empurrada para baixo junta e o que se perde e volume, nao
     informacao. Sem ele o caminho seria abaixar cada voz ate ela sumir
     sozinha, que e o contrario do que a fase quer.

     Browser sem `createDynamicsCompressor` cai direto no destino: o jogo fica
     mais alto, nunca mudo. */
  _buildBus() {
    if (this.bus || !this.ctx) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    if (ctx.createDynamicsCompressor) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      g.connect(comp); comp.connect(ctx.destination);
    } else {
      g.connect(ctx.destination);
    }
    this.bus = g;
  }
  _dest() { return this.bus || this.ctx.destination; }

  /* Ruido com o FILTRO andando, em vez do tom. E o bloco que faltava: sopro,
     rasgo e propagacao sao a mesma materia (ruido) com a janela abrindo ou
     fechando, e nenhum deles se faz com `_burst`, que tem o filtro parado. */
  _wash(t, dur, f0, f1, q, vol, rate) {
    const ctx = this.ctx;
    if (vol < 0.0005) return;
    const src = ctx.createBufferSource();
    src.buffer = this._noise();
    src.playbackRate.value = rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(20, f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this._dest());
    src.start(t); src.stop(t + dur);
  }

  /* Nota afinada em instante ABSOLUTO. `tone` agenda em `currentTime + delay`
     e serve para a UI, que dispara uma vez; uma voz precisa cair no mesmo
     instante que as outras camadas dela, e "agora" varia com o frame. */
  _bell(t, freq, dur, vol, type) {
    const ctx = this.ctx;
    if (vol < 0.0005) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._dest());
    o.start(t); o.stop(t + dur);
  }

  /* --- a voz de um evento -------------------------------------------------
     `say` e o funil unico das vozes de combate (js/voices.js). Tres travas, e
     cada uma existe por um motivo diferente:

       1. GAP POR VOZ — dois eventos iguais colados nao sao mais informacao,
          sao um zumbido. O gap e por voz porque a densidade tolerada e
          diferente: estalo de acerto pode ser denso, rasgo de portal nao.
       2. DUCK POR LEVA — o mesmo mecanismo que `death` ja usa. Numa build
          madura dezenas de vozes diferentes caem no mesmo segundo, e nenhum
          gap individual segura isso; o que segura e a leva inteira abaixar.
       3. DISTANCIA — evento longe da tela nao pode soar como evento no colo.
          Alem do corte, nada e agendado: a voz nem chega a existir.

     `SFX_LATENCY` e por que nada e marcado para `currentTime` cru: uma folga
     de 8ms deixa o hardware montar a nota em vez de emenda-la no meio. */
  // A metade barata de `say`, para quem chama de dentro de codigo quente.
  can(name) {
    if (!this.ctx || this.muted) return false;
    const v = VOICES[name];
    if (!v) return false;
    return this.ctx.currentTime - (this._voiceAt[name] || -9) >= v.gap;
  }

  say(name, o) {
    if (!this.can(name)) return;
    const v = VOICES[name];
    const now = this.ctx.currentTime;

    const dist = o && o.dist > 0 ? o.dist : 0;
    if (dist > SFX_RANGE) return;
    const near = 1 - (dist / SFX_RANGE) * 0.75;

    this._voiceBurst = Math.min(10, Math.max(0, this._voiceBurst - (now - this._voiceLast) * 7) + 1);
    this._voiceLast = now;
    this._voiceAt[name] = now;

    const duck = 1 / (1 + this._voiceBurst * 0.16);
    const size = o && o.size > 0 ? (o.size > 1 ? 1 : o.size) : 0;
    v.play(this, now + SFX_LATENCY, { v: near * duck * (o && o.vol != null ? o.vol : 1), size });
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
    o.connect(sh); sh.connect(bp); bp.connect(g); g.connect(this._dest());
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
    this.amp = 0;      // amplitude do soco, em unidades de mundo
    this.dx = 1;       // eixo em que ele acontece
    this.dy = 0;
    this.shakeT = 0;
    this.shakeSeq = 0; // angulo do proximo evento sem direcao propria
    this.ox = 0;
    this.oy = 0;
  }
  resize(w, h) { this.w = w; this.h = h; }
  resetShake() { this.amp = 0; this.shakeT = 0; this.ox = 0; this.oy = 0; }
  follow(target, dt, instant = false) {
    const t = instant ? 1 : 1 - Math.pow(1 - BALANCE.camera.lerp, dt * 60);
    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
  }
  /* Tremor de tela nao e ruido: e um SOCO. A camera e empurrada de uma vez na
     direcao em que o golpe viajou e volta oscilando, com a oscilacao morrendo
     em ~0,35s. E isso que diz DE ONDE veio a pancada, e nao apenas que veio.

     A versao anterior sorteava `Math.random()` por frame. Isso nao e tremor, e
     chuvisco: o desvio cai num ponto novo de uma caixa de ±22 unidades a cada
     frame, sem nenhuma continuidade — e depois do `snapUnit` le como a tela
     inteira piscando um pixel por vez, em vez de se mexer.

     Trocar o sorteio por ruido de senoide nao resolveria: a 60fps qualquer
     coisa acima de ~7Hz e amostrada perto de Nyquist e volta a aliasar em
     chuvisco. Uma oscilacao amortecida a 8,6Hz da ~7 amostras por ciclo, entao
     o caminho e desenhado de verdade em vez de sugerido.

     `lateral` e uma segunda oscilacao perpendicular, mais lenta e menor: sem
     ela o soco corre numa reta e le como falha de render, e nao como impacto.

     A amplitude sai ao quadrado (Eiserloh): acerto duas vezes mais alto sacode
     quatro vezes mais, e o fim da cauda desaparece em vez de parar seco. */
  addTrauma(mag, dx, dy) {
    const S = BALANCE.camera.shake;
    const t = clamp(mag / S.ref, 0, 1);
    const amp = S.max * t * t;
    // `Math.max` e nao soma: dez acertos no mesmo frame nao podem virar uma
    // camera arremessada para fora do mapa. O golpe mais forte manda, e
    // reinicia a fase — um soco novo comeca do proprio impacto.
    if (amp <= this.amp * Math.exp(-this.shakeT * S.damping)) return;
    this.amp = amp;
    this.shakeT = 0;
    if (dx !== undefined) {
      const L = Math.sqrt(dx * dx + dy * dy);
      if (L > 1e-4) { this.dx = dx / L; this.dy = dy / L; return; }
    }
    /* Evento sem posicao (subir de nivel, virada de fase) ainda precisa de UM
       eixo: o que nao pode existir e direcao nova a cada frame. O angulo aureo
       espalha os eventos seguidos em vez de repetir sempre o mesmo lado. */
    const a = (this.shakeSeq = (this.shakeSeq + 2.39996323) % 6.28318531);
    this.dx = Math.cos(a); this.dy = Math.sin(a);
  }

  /* Amostra ANTES de avancar o relogio, e essa ordem e o efeito inteiro. O
     deslocamento maximo esta em t=0: e o quadro do soco. Avancando primeiro, a
     primeira amostra ja sai 0,9rad adiantada, o pico nunca chega a ser
     desenhado e o que o jogador ve e a camera comecando na metade do caminho
     de volta — impacto vira sacudida. */
  updateShake(dt) {
    if (this.amp <= 0) { this.ox = 0; this.oy = 0; return; }
    const S = BALANCE.camera.shake;
    const t = this.shakeT;
    const env = Math.exp(-t * S.damping);
    if (env < 0.02) { this.amp = 0; this.shakeT = 0; this.ox = 0; this.oy = 0; return; }
    const a = this.amp * env;
    const main = a * Math.cos(t * S.freq);
    const side = a * S.lateral * Math.sin(t * S.freq * 0.62);
    this.ox = this.dx * main - this.dy * side;
    this.oy = this.dy * main + this.dx * side;
    this.shakeT = t + dt;
  }

  /* Two viewports, and the difference between them is what makes the world
     scroll smoothly on a pixel grid.

     `rawLeft` is where the camera really is — a float, because following the
     player with a lerp is what makes the camera feel alive. `left` is where
     the world gets DRAWN: pinned to the grid, and one whole buffer pixel to
     the left of that, which is the margin `Game.present` slides inside.

     Drawing on the grid is what stops the boiling — everything standing still
     keeps its pixel phase while the player walks. What is left over (never
     more than half a buffer pixel) does not get thrown away: `present` hands
     it to the blit as an offset in DEVICE pixels, so the world scrolls with
     the granularity of the screen instead of the granularity of the art. The
     pixel stays square; it just starts a little further along. */
  get rawLeft() { return this.x - this.w / 2 + this.ox; }
  get rawTop() { return this.y - this.h / 2 + this.oy; }
  get left() { return snapUnit(this.rawLeft) - PIXEL_GRID; }
  get top() { return snapUnit(this.rawTop) - PIXEL_GRID; }

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
