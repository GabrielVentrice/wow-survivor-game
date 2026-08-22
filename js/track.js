"use strict";
/* =========================================================================
   TRACK — reprodução de um arquivo de música.

   Este é o único ponto do jogo que carrega um asset externo. Duas decisões
   que não são óbvias:

   1. `<audio>`, não WebAudio. Um `fetch`/`decodeAudioData` seria mais
      flexível, mas `file://` tem origem opaca e o navegador bloqueia a
      requisição — abrir o index.html direto pararia de tocar música. Elemento
      de mídia com caminho relativo carrega em file:// sem CORS. Pelo mesmo
      motivo o volume é controlado por `.volume` e não por um GainNode:
      `createMediaElementSource` sobre mídia de origem opaca sai em silêncio.

   2. Dois elementos alternando, não `loop = true`. Um clipe de 57s reiniciando
      no talo deixa uma emenda audível a cada minuto. Os dois elementos se
      cruzam nos últimos segundos, então a volta do loop passa despercebida.

   Se o arquivo não carregar — bloqueado, ausente, formato recusado — o jogo
   não fica mudo: `Soundtrack` cai para a trilha procedural.
   ========================================================================= */

class Track {
  constructor(src) {
    this.src = src;
    this.els = null;
    this.cur = 0;
    this.ready = false;
    this.failed = false;
    this.playing = false;
    this.swapping = false;
    this.vol = 0;
    this.target = 0;
    this.fade = 3.5;        // segundos de cruzamento na volta do loop
  }

  load() {
    if (this.els || this.failed) return;
    this.els = [];
    let pending = 2;
    for (let i = 0; i < 2; i++) {
      const a = new Audio();
      a.preload = "auto";
      a.loop = false;       // o cruzamento é nosso, não do elemento
      a.volume = 0;
      a.addEventListener("canplaythrough", () => {
        if (--pending <= 0) this.ready = true;
      }, { once: true });
      a.addEventListener("error", () => { this.failed = true; this.ready = false; });
      a.src = this.src;
      a.load();
      this.els.push(a);
    }
  }

  setTarget(v) { this.target = v; }

  play() {
    if (!this.ready || this.failed || this.playing) return;
    const a = this.els[this.cur];
    a.currentTime = 0;
    const p = a.play();
    // política de autoplay: sem gesto do usuário a promessa é recusada
    if (p && p.catch) p.catch(() => { this.failed = true; this.playing = false; });
    this.playing = true;
  }

  stop() {
    if (!this.els) return;
    for (const a of this.els) { a.pause(); a.currentTime = 0; a.volume = 0; }
    this.playing = false;
    this.swapping = false;
    this.vol = 0;
  }

  restart() {
    if (!this.els) return;
    this.swapping = false;
    for (const a of this.els) { a.pause(); a.currentTime = 0; }
    this.cur = 0;
    this.playing = false;
    this.play();
  }

  /* Chamado a cada frame com o dt real. Faz a rampa de volume e o cruzamento
     dos dois elementos quando o clipe está acabando. */
  update(dt) {
    if (!this.playing || !this.els) return;
    const d = this.target - this.vol;
    this.vol += d > 0 ? Math.min(d, dt * 0.7) : Math.max(d, -dt * 0.7);

    const a = this.els[this.cur];
    const b = this.els[1 - this.cur];
    const dur = a.duration;
    const left = isFinite(dur) ? dur - a.currentTime : Infinity;

    if (!this.swapping && left < this.fade) {
      this.swapping = true;
      b.currentTime = 0;
      b.volume = 0;
      const p = b.play();
      if (p && p.catch) p.catch(() => { this.swapping = false; });
    }

    if (this.swapping) {
      const k = clamp(1 - left / this.fade, 0, 1);
      a.volume = clamp(this.vol * (1 - k), 0, 1);
      b.volume = clamp(this.vol * k, 0, 1);
      if (left <= 0.06 || a.ended) {
        a.pause();
        a.currentTime = 0;
        a.volume = 0;
        this.cur = 1 - this.cur;
        this.swapping = false;
      }
    } else {
      a.volume = clamp(this.vol, 0, 1);
    }
  }
}

/* =========================================================================
   SOUNDTRACK — decide quem toca.

   O arquivo é a primeira escolha; a trilha procedural fica de reserva e assume
   se o arquivo não carregar. As duas nunca tocam juntas.
   ========================================================================= */

/* Volume por estado. Trilha de fundo tem que ficar ATRAS dos efeitos: se
   competir com o som de morte e de acerto, o jogador perde a informacao de
   combate. Todo o ajuste de "esta alta demais" mora nestes quatro numeros. */
const TRACK_LEVEL = { menu: 0.3, playing: 0.26, paused: 0.1, gameover: 0, off: 0 };

class Soundtrack {
  constructor(src) {
    this.file = new Track(src);
    this.proc = new Music();
    this.state = "menu";
    this.muted = false;
    this._decided = false;
  }

  attach(ctx) {
    this.proc.attach(ctx);
    this.file.load();
  }

  // qual das duas está no comando; só decide depois que o arquivo se resolveu
  get usingFile() { return this.file.ready && !this.file.failed; }

  setMuted(m) {
    this.muted = m;
    this.proc.setMuted(m);
    this._applyFile();
  }
  get isMuted() { return this.muted; }

  setState(state) {
    this.state = state;
    this._route();
  }

  setIntensity(v) { this.proc.setIntensity(v); }

  restart() {
    this.proc.restart();
    if (this.usingFile) this.file.restart();
  }

  _applyFile() {
    const lvl = this.muted ? 0 : (TRACK_LEVEL[this.state] != null ? TRACK_LEVEL[this.state] : 0);
    this.file.setTarget(lvl);
  }

  /* Enquanto o arquivo ainda está carregando, a procedural toca — assim o
     menu nunca fica em silêncio esperando 1 MB de download. Quando o arquivo
     fica pronto, ela sai e ele entra. */
  _route() {
    if (this.usingFile) {
      if (!this._decided) { this._decided = true; this.proc.setState("off"); }
      this._applyFile();
      if (this.state === "gameover" || this.state === "off") this.file.stop();
      else this.file.play();
    } else {
      this.proc.setState(this.state);
    }
  }

  update(dt) {
    this._route();
    if (this.usingFile) this.file.update(dt);
    else this.proc.update();
  }
}
