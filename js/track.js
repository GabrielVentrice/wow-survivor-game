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

   2. Dois modos de repetição, e escolher o errado estraga a faixa:

      - `seamless` (padrão): um elemento com `loop = true`. Para faixa feita
        para emendar — a que está no jogo começa e termina no talo, e é assim
        que ela foi montada para voltar.
      - `crossfade`: dois elementos que se cruzam no fim. Para faixa que NÃO
        emenda (tem fade nas pontas ou termina numa cauda), onde `loop = true`
        deixaria um buraco audível a cada volta.

      Cruzamento numa faixa que já emenda é pior que não fazer nada: num loop
      de 11s, um cruzamento de 3,5s sobrepõe um terço da faixa com ela mesma e
      dobra a batida.

   Se o arquivo não carregar — bloqueado, ausente, formato recusado — o jogo
   não fica mudo: `Soundtrack` cai para a trilha procedural.
   ========================================================================= */

class Track {
  // opts.crossfade em segundos ativa o modo de dois elementos; sem ele, a
  // faixa emenda sozinha com loop nativo
  constructor(src, opts) {
    this.src = src;
    this.fade = (opts && opts.crossfade) || 0;
    this.seamless = this.fade <= 0;
    this.els = null;
    this.cur = 0;
    this.ready = false;
    this.failed = false;
    this.playing = false;
    this.swapping = false;
    this.vol = 0;
    this.target = 0;
  }

  load() {
    if (this.els || this.failed) return;
    this.els = [];
    const count = this.seamless ? 1 : 2;
    let pending = count;
    for (let i = 0; i < count; i++) {
      const a = new Audio();
      a.preload = "auto";
      a.loop = this.seamless;   // no modo cruzado a volta é nossa
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

    if (this.seamless) {
      this.els[0].volume = clamp(this.vol, 0, 1);
      return;
    }

    const a = this.els[this.cur];
    const b = this.els[1 - this.cur] || a;
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

/* As trilhas, na ordem em que a tecla N as percorre — e a PRIMEIRA é a que o
   jogo abre. Hoje é uma só, então N vira liga/desliga; a lista continua sendo
   uma lista porque a máquina de troca (carregar preguiçoso, só entrar quando o
   arquivo novo estiver pronto, ficar com a antiga se ele falhar) é o que torna
   barato voltar a ter duas.

   A Tempestade — o lofi de chuva — SAIU da lista. O arquivo continua em
   `audio/`, junto com as outras alternativas, e o argumento inteiro está em
   `audio/README.md`: uma run dura doze minutos, e trilha de jogo longo é
   fundo, não faixa. A chuva era a camada que mais cobrava atenção (6,8 dB de
   passeio de volume contra 1,4 dB da Vigília, e sete janelas de 250 ms
   saltando acima do fundo), e é dona de tudo acima de 6 kHz — a mesma banda
   onde o jogo diz que alguém morreu.

   Carregar continua preguiçoso: só desce a trilha que vai tocar. */
const TRACKS = [
  { id: "vigil", name: "Vigília", src: "audio/focus-vigil.mp3" },
];

/* Volume por estado. Trilha de fundo tem que ficar bem ATRAS dos efeitos: se
   competir com o som de morte e de acerto, o jogador perde informacao de
   combate. Todo o ajuste de "esta alta demais" mora nestes quatro numeros —
   um so par de niveis para toda trilha que entrar, porque as faixas do projeto
   estao a 0,3 dB de RMS uma da outra e um volume por faixa seria uma segunda
   tabela para divergir. */
const TRACK_LEVEL = { menu: 0.07, playing: 0.055, paused: 0.022, gameover: 0, off: 0 };

class Soundtrack {
  // aceita a lista de trilhas ou um src solto (uma trilha so)
  constructor(list, opts) {
    this.list = Array.isArray(list) ? list : [{ id: "track", name: "Trilha", src: list, opts }];
    this.tracks = this.list.map(() => null);
    this.idx = 0;
    this._nextIdx = null;      // trilha pedida, ainda carregando
    this.file = this._track(0);
    this.proc = new Music();
    this.state = "menu";
    this.muted = false;
    this._decided = false;
  }

  _track(i) {
    if (!this.tracks[i]) {
      const d = this.list[i];
      this.tracks[i] = new Track(d.src, d.opts);
    }
    return this.tracks[i];
  }

  get trackName() { return this.list[this.idx].name; }

  /* Pede a troca. Quem efetiva e `_route`, e so quando o arquivo novo estiver
     pronto: uma trilha custa por volta de 1,9 MB, e parar a que esta tocando
     para esperar o download deixaria o jogo mudo por segundos justo no gesto
     em que o jogador esta mexendo no som. Se o novo arquivo falhar, fica o
     antigo. */
  setTrack(i) {
    i = ((i % this.list.length) + this.list.length) % this.list.length;
    if (i === this.idx && this._nextIdx == null) return;
    this._nextIdx = i;
    this._track(i).load();
  }

  /* A tecla N. O ciclo e trilha 1 -> trilha 2 -> ... -> mudo -> trilha 1:
     silencio e um estado do ciclo e nao uma segunda tecla, porque "desligar a
     musica" e "trocar a musica" sao a mesma pergunta ("o que eu quero ouvir
     agora?") e duas teclas para uma pergunta e uma a mais. Com uma trilha so
     na lista o ciclo tem dois estados, e N e liga/desliga.
     Devolve a trilha que passou a tocar, ou null se agora esta mudo. */
  cycleTrack() {
    if (this.muted) { this.setMuted(false); this.setTrack(0); return this.list[0]; }
    const nx = (this._nextIdx == null ? this.idx : this._nextIdx) + 1;
    if (nx >= this.list.length) { this.setMuted(true); return null; }
    this.setTrack(nx);
    return this.list[nx];
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

  /* A troca pedida por `setTrack` so acontece aqui, quando o arquivo novo esta
     pronto — ate la continua tocando o antigo. */
  _swap() {
    if (this._nextIdx == null) return;
    const next = this.tracks[this._nextIdx];
    if (next.failed) { this._nextIdx = null; return; }
    if (!next.ready) return;
    if (next !== this.file) { this.file.stop(); this.file = next; }
    this.idx = this._nextIdx;
    this._nextIdx = null;
  }

  /* Enquanto o arquivo ainda está carregando, a procedural toca — assim o
     menu nunca fica em silêncio esperando 1 MB de download. Quando o arquivo
     fica pronto, ela sai e ele entra. */
  _route() {
    this._swap();
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
