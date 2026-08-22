"use strict";
/* =========================================================================
   MUSIC — trilha da Legião, gerada em runtime. Zero arquivo de áudio.

   A referência é cerimonial, não synth: coro grave, tambor de guerra, metais
   e trompa. As três coisas que fazem soar Legião e não "masmorra genérica":

     1. A DESCIDA. Progressão i - bVII - bVI - V (Am G F E) com o baixo
        caindo A-G-F-E. É o tetracorde frígio descendente — a marcha fúnebre
        que toda trilha demoníaca usa. O V vem MAIOR (E com sol sustenido),
        que é o que dá o gosto de frígio dominante em vez de menor comum.
     2. O CORO. Vozes não têm timbre próprio: têm formantes. Cada nota passa
        por três bandpass em paralelo afinados nas ressonâncias de uma vogal
        ("ah" e "oh", alternando por compasso). Serra crua vira canto.
     3. O TAMBOR. Andamento lento (62 BPM) e pancada com três camadas —
        corpo, pele e ressonância. Cerimonial, não dança.

   O agendamento NÃO acompanha o loop do jogo. Notas são marcadas com
   antecedência no relógio do AudioContext, porque o requestAnimationFrame
   varia de 8ms a 30ms por frame e nota marcada "agora" chega desigual — o
   ouvido percebe isso como ritmo bêbado. `update()` só empurra a fila.
   ========================================================================= */

const MUSIC = {
  bpm: 62,              // cerimonial: passo de marcha, não de dança
  root: 55,             // Lá1
  lookahead: 0.3,
  stepsPerBar: 8,       // colcheias
  bars: 4,

  /* i - bVII - bVI - V, com o baixo descendo A G F E.
     O E vem MAIOR (sol sustenido = 11 semitons) de propósito. */
  chords: [
    { name: "Am", notes: [0, 3, 7], bass: -12 },
    { name: "G",  notes: [10, 14, 17], bass: -14 },
    { name: "F",  notes: [8, 12, 15], bass: -16 },
    { name: "E",  notes: [7, 11, 14], bass: -17 },
  ],

  // ressonâncias de vogal: é isso que faz uma serra soar como voz
  vowels: {
    ah: [700, 1220, 2600],
    oh: [450, 800, 2830],
  },

  /* Tambor de guerra: velocidade por colcheia dentro do compasso.
     O padrão denso só entra quando a run já apertou. */
  drums: {
    calm:  [1, 0, 0, 0.42, 0.78, 0, 0.38, 0],
    dense: [1, 0, 0.32, 0.5, 0.85, 0.28, 0.5, 0.42],
  },
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
    /* Comeca em "off", nao em "menu": setState ignora mudanca para o mesmo
       estado, entao nascer ja em "menu" fazia o primeiro setState("menu") ser
       um no-op e a trilha do menu nunca ligava. */
    this.state = "off";
    this.nodes = null;
  }

  /* Cadeia fixa: master -> eco em feedback -> saída, mais o drone contínuo e
     o LFO de vibrato compartilhado. Criada uma única vez; as notas são
     efêmeras e se penduram nela. */
  attach(ctx) {
    if (this.ctx || !ctx) return;
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // eco pontuado: profundidade de nave sem custo de reverb
    const delay = ctx.createDelay();
    delay.delayTime.value = 60 / MUSIC.bpm * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 1900;
    const echoLevel = ctx.createGain();
    echoLevel.gain.value = 0.3;
    delay.connect(echoTone); echoTone.connect(fb); fb.connect(delay);
    echoTone.connect(echoLevel); echoLevel.connect(master);

    // drone: duas serras desafinadas sob um filtro que respira
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 200;
    droneFilter.Q.value = 4;
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    for (const detune of [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = MUSIC.root / 2;
      o.detune.value = detune;
      o.connect(droneFilter);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 110;
    lfo.connect(lfoAmt); lfoAmt.connect(droneFilter.frequency);
    lfo.start();

    /* Vibrato compartilhado. Um coro sem vibrato soa como órgão; com um LFO
       por nota, o custo multiplica. Um só, ligado no detune de cada voz. */
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.1;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = 7;                 // cents
    vib.connect(vibAmt);
    vib.start();

    this.nodes = { master, delay, droneGain, droneFilter, vib: vibAmt };
    this.nextStepAt = ctx.currentTime + 0.1;
  }

  setMuted(m) { this.muted = m; this._applyLevel(); }

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
    // fundo e fundo: os efeitos de combate tem que passar por cima
    const level = this.muted || !this.on ? 0
      : this.state === "paused" ? 0.014
      : this.state === "menu" ? 0.032
      : 0.038;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(Math.max(0.0001, g.value), this.ctx.currentTime);
    g.linearRampToValueAtTime(level, this.ctx.currentTime + 1.2);
  }

  restart() {
    if (!this.ctx) return;
    this.step = 0;
    this.nextStepAt = this.ctx.currentTime + 0.1;
  }

  update() {
    if (!this.ctx || !this.on || this.muted) return;
    // sobe rápido, desce devagar: perder o chefe não corta a frase no meio
    const d = this._target - this.intensity;
    this.intensity += d > 0 ? Math.min(d, 0.01) : Math.max(d, -0.0035);

    const stepDur = 60 / MUSIC.bpm / 2;
    const now = this.ctx.currentTime;
    if (this.nextStepAt < now) this.nextStepAt = now + 0.02;   // volta de aba inativa
    let guard = 0;
    while (this.nextStepAt < now + MUSIC.lookahead && guard++ < 32) {
      this._scheduleStep(this.step, this.nextStepAt, stepDur);
      this.nextStepAt += stepDur;
      this.step++;
    }
    this.nodes.droneGain.gain.value = 0.15 + this.intensity * 0.1;
    this.nodes.droneFilter.Q.value = 4 + this.intensity * 5;
  }

  _scheduleStep(step, t, stepDur) {
    const total = MUSIC.stepsPerBar * MUSIC.bars;
    const bar = Math.floor(step / MUSIC.stepsPerBar) % MUSIC.bars;
    const beat = step % MUSIC.stepsPerBar;
    const chord = MUSIC.chords[bar];
    const barDur = stepDur * MUSIC.stepsPerBar;
    const k = this.intensity;
    const menu = this.state === "menu";

    // --- CORO: um acorde sustentado por compasso, vogal alternando
    if (beat === 0) {
      const vowel = bar % 2 ? MUSIC.vowels.oh : MUSIC.vowels.ah;
      const vol = (menu ? 0.05 : 0.036 + k * 0.03);
      for (let i = 0; i < chord.notes.length; i++) {
        this._choir(t, semi(MUSIC.root, chord.notes[i] + 12), barDur * 1.05, vol, vowel);
      }
    }

    // --- BAIXO: a descida A-G-F-E, uma nota longa por compasso
    if (beat === 0) {
      this._voice(t, semi(MUSIC.root, chord.bass), barDur * 0.9, "triangle",
                  0.09 + k * 0.03, 620);
    }

    // --- TAMBOR DE GUERRA
    if (!menu) {
      const pat = k > 0.55 ? MUSIC.drums.dense : MUSIC.drums.calm;
      const v = pat[beat];
      if (v > 0) this._drum(t, (0.075 + k * 0.05) * v, v >= 0.75);
    }

    // --- METAIS: sopro grave nos compassos ímpares, com ataque de fole
    if (!menu && k > 0.22 && beat === 0 && bar % 2 === 0) {
      this._brass(t, semi(MUSIC.root, chord.bass + 12), barDur * 0.8, 0.045 + k * 0.03);
    }

    // --- TROMPA: o chamado, sempre no compasso do E maior
    if (!menu && k > 0.55 && bar === 3 && beat === 0) {
      this._horn(t, semi(MUSIC.root, chord.notes[1] + 12), barDur * 1.1, 0.05);
    }

    // --- CORDAS EM TREMOLO: agitação por baixo quando está no talo
    if (!menu && k > 0.72) {
      const top = chord.notes[chord.notes.length - 1] + 24;
      this._tremolo(t, semi(MUSIC.root, top), stepDur * 0.6, 0.016 + k * 0.012);
    }

    // --- IMPACTO na virada do loop
    if (!menu && k > 0.85 && step % total === total - 1) this._impact(t);
  }

  /* Uma voz do coro: duas serras desafinadas -> envelope de ataque lento ->
     três bandpass em paralelo nas formantes da vogal. É o banco de formantes
     que transforma serra em canto; sem ele isso é só um pad. */
  _choir(t, freq, dur, vol, vowel) {
    if (vol < 0.0005) return;
    const ctx = this.ctx;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + dur * 0.34);   // fôlego, não ataque
    env.gain.linearRampToValueAtTime(vol * 0.85, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    for (const det of [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = det;
      this.nodes.vib.connect(o.detune);
      o.connect(env);
      o.start(t); o.stop(t + dur + 0.05);
    }

    const levels = [1, 0.5, 0.24];
    for (let i = 0; i < 3; i++) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = vowel[i];
      f.Q.value = 7 - i * 1.6;
      const fg = ctx.createGain();
      fg.gain.value = levels[i];
      env.connect(f); f.connect(fg);
      fg.connect(this.nodes.master);
      if (i === 0) fg.connect(this.nodes.delay);
    }
  }

  /* Tambor cerimonial em três camadas: corpo (seno descendo), pele (ruído
     curto) e ressonância grave nos acentos. Um seno sozinho vira bumbo de
     música eletrônica; é a pele que faz virar tambor de couro. */
  _drum(t, vol, accent) {
    if (vol < 0.0005) return;
    const ctx = this.ctx;

    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.nodes.master);
    o.start(t); o.stop(t + 0.32);

    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx);
    n.playbackRate.value = 0.6 + Math.random() * 0.3;
    const nf = ctx.createBiquadFilter();
    nf.type = "lowpass"; nf.frequency.value = 1100; nf.Q.value = 1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(nf); nf.connect(ng); ng.connect(this.nodes.master);
    n.start(t); n.stop(t + 0.09);

    if (!accent) return;
    const r = ctx.createOscillator();
    r.type = "sine";
    r.frequency.setValueAtTime(64, t);
    r.frequency.exponentialRampToValueAtTime(31, t + 0.6);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(vol * 0.62, t);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    r.connect(rg); rg.connect(this.nodes.master);
    r.start(t); r.stop(t + 0.72);
  }

  /* Metais: três serras (oitava, uníssono levemente desafinado e quinta) por
     uma saturação suave, com o corte do filtro abrindo junto com o volume —
     é a abertura do filtro que soa como sopro ganhando pressão. */
  _brass(t, freq, dur, vol) {
    if (vol < 0.0005) return;
    const ctx = this.ctx;
    const sh = ctx.createWaveShaper();
    sh.curve = driveCurve();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(320, t);
    lp.frequency.linearRampToValueAtTime(2100, t + dur * 0.3);
    lp.frequency.linearRampToValueAtTime(700, t + dur);
    lp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    sh.connect(lp); lp.connect(g);
    g.connect(this.nodes.master);
    g.connect(this.nodes.delay);

    for (const [mul, det] of [[0.5, 0], [1, -6], [1.5, 5]]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq * mul;
      o.detune.value = det;
      o.connect(sh);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  // Trompa: a nota entra por baixo e sobe até a afinação — o "scoop" que
  // todo naipe de metal faz e que sozinho já soa como chamado de guerra.
  _horn(t, freq, dur, vol) {
    if (vol < 0.0005) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq * 0.93, t);
    o.frequency.linearRampToValueAtTime(freq, t + 0.14);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g);
    g.connect(this.nodes.master);
    g.connect(this.nodes.delay);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Cordas em tremolo: notinhas curtas repetidas, o nervosismo da orquestra
  _tremolo(t, freq, dur, vol) {
    if (vol < 0.0005) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq * 1.6;
    bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(g); g.connect(this.nodes.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Impacto na virada: golpe grave saturado que assenta em meio segundo
  _impact(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(88, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    const sh = ctx.createWaveShaper();
    sh.curve = driveCurve();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.085, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(this.nodes.master);
    o.start(t); o.stop(t + 0.72);

    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx);
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.value = 2400; nf.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(nf); nf.connect(ng); ng.connect(this.nodes.master);
    n.start(t); n.stop(t + 0.37);
  }

  // nota simples (baixo) — oscilador, filtro, envelope
  _voice(t, freq, dur, type, vol, cutoff) {
    if (vol < 0.0005) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.nodes.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
}
