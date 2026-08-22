"use strict";
/* =========================================================================
   MUSIC — trilha gerada em runtime. Zero arquivo de audio, como o resto.

   Modo frigio em La: a escala com a segunda menor, que e o que faz soar
   "Legiao" e nao "fantasia generica". Progressao i - bVI - bVII - v em loop
   de quatro compassos.

   O agendamento NAO acompanha o loop do jogo. Notas sao marcadas com
   antecedencia no relogio do AudioContext (`lookahead`), porque o
   requestAnimationFrame varia de 8ms a 30ms por frame e uma nota marcada
   "agora" chegaria sempre atrasada e desigual — o ouvido percebe isso como
   ritmo bebado. O `update()` daqui so empurra a fila; quem toca no tempo
   certo e o hardware de audio.

   A intensidade e continua (0..1) e vem do estado do jogo, nao de um
   contador proprio: as camadas entram conforme a run aperta.
   ========================================================================= */

const MUSIC = {
  bpm: 82,
  root: 55,             // La1
  lookahead: 0.25,      // segundos agendados a frente
  stepsPerBar: 8,       // colcheias
  bars: 4,

  // acordes em semitons a partir da tonica. i - bVI - bVII - v
  chords: [
    { name: "Am", notes: [0, 3, 7], bass: -12 },
    { name: "F",  notes: [8, 12, 15], bass: -4 },
    { name: "G",  notes: [10, 14, 17], bass: -2 },
    { name: "Em", notes: [7, 10, 14], bass: -5 },
  ],
  // frigio: 0 1 3 5 7 8 10
  scale: [0, 1, 3, 5, 7, 8, 10],
};

const semi = (root, n) => root * Math.pow(2, n / 12);

class Music {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.muted = false;
    this.step = 0;
    this.nextStepAt = 0;
    this.intensity = 0;
    this._target = 0;
    this.state = "menu";
    this.nodes = null;
  }

  /* Monta a cadeia fixa: master -> delay em feedback -> saida, mais o drone
     continuo. Tudo criado uma unica vez; as notas sao efemeras. */
  attach(ctx) {
    if (this.ctx || !ctx) return;
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // eco curto: da profundidade sem precisar de reverb de verdade
    const delay = ctx.createDelay();
    delay.delayTime.value = 60 / MUSIC.bpm * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 2200;
    const echoLevel = ctx.createGain();
    echoLevel.gain.value = 0.34;
    delay.connect(echoTone); echoTone.connect(fb); fb.connect(delay);
    echoTone.connect(echoLevel); echoLevel.connect(master);

    // drone: dois dentes-de-serra desafinados sob um filtro que respira
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 240;
    droneFilter.Q.value = 4;
    droneFilter.connect(droneGain);
    droneGain.connect(master);

    const droneOscs = [];
    for (const detune of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = MUSIC.root / 2;
      o.detune.value = detune;
      o.connect(droneFilter);
      o.start();
      droneOscs.push(o);
    }
    // LFO no corte do filtro: o drone "respira" em vez de ficar parado
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 130;
    lfo.connect(lfoAmt); lfoAmt.connect(droneFilter.frequency);
    lfo.start();

    this.nodes = { master, delay, droneGain, droneFilter, droneOscs, lfo };
    this.nextStepAt = ctx.currentTime + 0.1;
  }

  setMuted(m) {
    this.muted = m;
    this._applyLevel();
  }

  /* `state` decide o volume geral; `intensity` decide quantas camadas tocam.
     Separar os dois deixa a pausa abaixar a trilha sem desmontar o arranjo. */
  setState(state) {
    if (this.state === state) return;
    this.state = state;
    if (state === "playing" || state === "menu") this.on = true;
    if (state === "gameover" || state === "off") this.on = false;
    this._applyLevel();
  }

  setIntensity(v) { this._target = v < 0 ? 0 : v > 1 ? 1 : v; }

  _applyLevel() {
    if (!this.ctx) return;
    const g = this.nodes.master.gain;
    const level = this.muted || !this.on ? 0
      : this.state === "paused" ? 0.05
      : this.state === "menu" ? 0.09
      : 0.15;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(Math.max(0.0001, g.value), this.ctx.currentTime);
    g.linearRampToValueAtTime(level, this.ctx.currentTime + 1.2);
  }

  restart() {
    if (!this.ctx) return;
    this.step = 0;
    this.nextStepAt = this.ctx.currentTime + 0.1;
  }

  /* Chamado a cada frame. Enquanto houver espaco na janela de antecedencia,
     marca o proximo passo e avanca — nunca toca nada "agora". */
  update() {
    if (!this.ctx || !this.on || this.muted) return;
    // intensidade sobe rapido e desce devagar: perder o chefe nao corta a
    // trilha no meio da frase
    const d = this._target - this.intensity;
    this.intensity += d > 0 ? Math.min(d, 0.012) : Math.max(d, -0.004);

    const stepDur = 60 / MUSIC.bpm / 2;
    const now = this.ctx.currentTime;
    if (this.nextStepAt < now) this.nextStepAt = now + 0.02;  // volta de aba inativa
    let guard = 0;
    while (this.nextStepAt < now + MUSIC.lookahead && guard++ < 32) {
      this._scheduleStep(this.step, this.nextStepAt);
      this.nextStepAt += stepDur;
      this.step++;
    }
    this.nodes.droneGain.gain.value = 0.16 + this.intensity * 0.12;
    this.nodes.droneFilter.Q.value = 4 + this.intensity * 5;
  }

  _scheduleStep(step, t) {
    const total = MUSIC.stepsPerBar * MUSIC.bars;
    const bar = Math.floor(step / MUSIC.stepsPerBar) % MUSIC.bars;
    const beat = step % MUSIC.stepsPerBar;
    const chord = MUSIC.chords[bar];
    const k = this.intensity;
    const menu = this.state === "menu";

    // --- baixo: tonica no 1, quinta no 5
    if (beat === 0 || beat === 4) {
      const n = beat === 0 ? chord.bass : chord.bass + 7;
      this._voice(t, semi(MUSIC.root, n), 0.62, "triangle", 0.085 + k * 0.03, 700);
    }

    // --- bumbo: 1 e 5, com o 5 mais fraco
    if (!menu && (beat === 0 || beat === 4)) {
      this._kick(t, beat === 0 ? 0.1 : 0.06);
    }

    // --- arpejo do acorde, colcheia a colcheia
    if (k > 0.1 || menu) {
      const note = chord.notes[(step + bar) % chord.notes.length] + 12;
      const vol = (menu ? 0.03 : 0.022 + k * 0.03);
      this._voice(t, semi(MUSIC.root, note), 0.42, "triangle", vol, 2600, true);
    }

    // --- contracanto grave: so quando a run ja apertou
    if (k > 0.45 && beat % 2 === 1) {
      const note = chord.notes[(step * 2) % chord.notes.length];
      this._voice(t, semi(MUSIC.root, note), 0.3, "sawtooth", 0.014 + k * 0.016, 900);
    }

    // --- chimbal: marca o off-beat na fase pesada
    if (k > 0.5 && beat % 2 === 1) this._hat(t, 0.02 + k * 0.02);

    // --- sino: uma nota longa por compasso, no topo da escala
    if (k > 0.68 && beat === 0) {
      const deg = MUSIC.scale[(bar * 2 + 1) % MUSIC.scale.length];
      this._voice(t, semi(MUSIC.root, deg + 24), 1.6, "sine", 0.035, 5200, true);
    }

    // --- estrondo na virada do loop, quando esta no talo
    if (k > 0.85 && step % total === total - 1) this._boom(t);
  }

  // uma nota: oscilador -> filtro -> envelope. `echo` manda tambem pro delay.
  _voice(t, freq, dur, type, vol, cutoff, echo) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);      // ataque curto, sem clique
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g);
    g.connect(this.nodes.master);
    if (echo) g.connect(this.nodes.delay);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _kick(t, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.nodes.master);
    o.start(t); o.stop(t + 0.2);
  }

  _hat(t, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 7400;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(f); f.connect(g); g.connect(this.nodes.master);
    o.start(t); o.stop(t + 0.05);
  }

  // virada de loop na fase dura: um golpe grave que assenta em meio segundo
  _boom(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(f); f.connect(g); g.connect(this.nodes.master);
    o.start(t); o.stop(t + 0.62);
  }
}
