"use strict";
/* =========================================================================
   VOZES — o que cada evento SOA.

   Este arquivo e o irmao de `js/render/vfx.js`, e de proposito: a simulacao
   emite um fato visual (`game.emitVfx`) e agora esse mesmo fato tem duas
   consumidoras — a camada que desenha e a que toca. Nao ha um registry de som
   por peca, e nao pode haver: seriam duas listas para divergir. Se um evento
   novo aparece em tela, ele aparece aqui, e `driver_vfx` reprova evento visual
   sem voz.

   Antes disto o combate era MUDO. `Sfx` sabia tocar morte, dano tomado, level
   up, chefe, item e game over — nenhuma peca tocava nada. Nenhum conjuro,
   nenhum impacto, nenhuma explosao, nenhuma invocacao. Metade de "nao fica
   claro que esta acontecendo" era literalmente isso: o canal que os jogos do
   genero usam para dizer que o golpe conectou estava desligado.

   Contrato de cada voz:

     gap    segundos MINIMOS entre duas emissoes desta voz. E a mesma razao
            pela qual o hitstop tem cadencia: uma build madura poe dezenas de
            eventos por segundo em tela, e sem intervalo por voz o resultado
            nao e "mais som", e lama. O gap e por VOZ e nao global — o estalo
            do impacto pode ser denso, o rasgo do portal nao.

     play   (s, t, o) -> s e o Sfx (os blocos procedurais moram la), `t` e um
            instante ABSOLUTO do relogio do AudioContext, e `o` traz
            { v: volume ja atenuado por distancia e por leva, size: 0..1 }.

   `t` e absoluto e nunca "agora + 0" porque o requestAnimationFrame varia de
   8ms a 30ms por frame: nota marcada no instante em que o frame roda chega
   atrasada e desigual. Quem toca no tempo certo e o hardware de audio.

   `size` sai do raio do evento. Explosao grande soa mais grave que explosao
   pequena pelo mesmo motivo que corpo grande morre mais grave: e a unica
   dimensao que o ouvido le sem precisar de atencao.
   ========================================================================= */

const VOICES = {

  /* --- os dois fatos que nao tem evento visual --------------------------
     `cast` e `hit` nao emitem vfx: o conjuro nao desenha nada por si (quem
     desenha e o efeito) e o acerto sem raio so acende o flash branco do
     inimigo. Sao, respectivamente, o som mais frequente do jogo e o segundo —
     entao os dois sao os mais baixos e os de gap mais curto. */

  // O sopro do conjuro. Sobe, porque e energia SAINDO do warlock.
  cast: {
    gap: 0.10,
    play(s, t, o) {
      s._burst(t, 0.07, "bandpass", 820 + o.size * 500, 3.2, 0.020 * o.v, 1.6);
      s._sweep(t, 210, 520, 0.09, "triangle", 0.013 * o.v, 1900);
    },
  },

  // O estalo do acerto. Curto e seco: ele acontece dezenas de vezes por
  // segundo e qualquer cauda vira zumbido.
  hit: {
    gap: 0.045,
    play(s, t, o) {
      s._burst(t, 0.035, "bandpass", 2300 + o.size * 700, 9, 0.030 * o.v, 1.3);
      s._sweep(t + 0.004, 300, 120, 0.05, "square", 0.013 * o.v, 900);
    },
  },

  // Golpe grande: o mesmo estalo com peso embaixo. E o par sonoro do hitstop.
  crit: {
    gap: 0.16,
    play(s, t, o) {
      s._burst(t, 0.055, "bandpass", 1700, 6, 0.048 * o.v, 1.0);
      s._sweep(t, 190, 55, 0.16, "sine", 0.072 * o.v);
      s._burst(t + 0.02, 0.09, "lowpass", 520, 1, 0.034 * o.v, 0.7);
    },
  },

  /* --- os onze eventos visuais ------------------------------------------ */

  // Explosao. Quatro camadas, como a morte: ignicao, corpo, sub e o fel.
  burst: {
    gap: 0.11,
    play(s, t, o) {
      s._burst(t, 0.05, "highpass", 2600, 0.8, 0.048 * o.v, 1.5);
      s._burst(t + 0.01, 0.28 + o.size * 0.22, "lowpass", 900 - o.size * 380, 0.9,
               0.085 * o.v, 0.55);
      s._sweep(t + 0.005, 132 - o.size * 44, 34, 0.32 + o.size * 0.2, "sine", 0.095 * o.v);
      if (o.size > 0.3) s._screech(t + 0.03, 0.13, 0.020 * o.v, 0.5);
    },
  },

  // Onda de choque: uma serra despencando enquanto o anel varre o chao.
  shock: {
    gap: 0.14,
    play(s, t, o) {
      s._burst(t, 0.03, "bandpass", 3400, 14, 0.028 * o.v, 1.0);
      s._sweep(t, 880, 90, 0.22, "sawtooth", 0.046 * o.v, 1400);
      s._wash(t, 0.24, 320, 1100, 1.4, 0.038 * o.v, 0.8);
    },
  },

  // Propagacao: um sussurro abrindo para fora. Sobe no filtro, nao no tom.
  spread: {
    gap: 0.22,
    play(s, t, o) {
      s._wash(t, 0.36, 420, 2200, 1.5, 0.042 * o.v, 0.9);
      s._sweep(t + 0.04, 150, 240, 0.3, "triangle", 0.020 * o.v, 900);
    },
  },

  // Salto de DoT: um blip. E o unico som do jogo que sobe e para.
  jump: {
    gap: 0.08,
    play(s, t, o) { s._sweep(t, 420, 1150, 0.07, "triangle", 0.028 * o.v, 3000); },
  },

  // Invocacao: alguma coisa CHEGANDO. Filtro abrindo + guincho curto.
  summon: {
    gap: 0.12,
    play(s, t, o) {
      s._wash(t, 0.26, 200, 1600, 1.2, 0.042 * o.v, 0.95);
      s._sweep(t + 0.04, 68, 155, 0.22, "sawtooth", 0.040 * o.v, 700);
      s._screech(t + 0.09, 0.13, 0.026 * o.v, 0.35);
    },
  },

  // Desinvocacao: o mesmo caminho ao contrario, e mais abafado.
  unsummon: {
    gap: 0.18,
    play(s, t, o) {
      s._wash(t, 0.22, 1500, 240, 1.2, 0.028 * o.v, 0.9);
      s._sweep(t, 260, 70, 0.2, "triangle", 0.022 * o.v, 800);
    },
  },

  // Execucao: o talho e o silencio depois dele.
  execute: {
    gap: 0.12,
    play(s, t, o) {
      s._burst(t, 0.045, "bandpass", 3200, 10, 0.052 * o.v, 1.4);
      s._sweep(t + 0.01, 620, 90, 0.26, "sawtooth", 0.046 * o.v, 1500);
      s._sweep(t + 0.02, 95, 40, 0.3, "sine", 0.055 * o.v);
    },
  },

  // Eco do Vazio: chega 3s depois do golpe, entao tem que soar como lembranca
  // dele — grave, sem ataque, com cauda.
  echo: {
    gap: 0.26,
    play(s, t, o) {
      s._sweep(t, 152, 58, 0.5, "sine", 0.048 * o.v);
      s._burst(t + 0.04, 0.5, "lowpass", 420, 1, 0.028 * o.v, 0.5);
    },
  },

  // Teleporte: sopro caindo e o clique da chegada.
  blink: {
    gap: 0.2,
    play(s, t, o) {
      s._wash(t, 0.16, 2400, 320, 2.5, 0.048 * o.v, 1.4);
      s._burst(t + 0.1, 0.03, "bandpass", 1800, 8, 0.028 * o.v, 1.0);
    },
  },

  // Cura: as duas unicas notas afinadas do combate. Consoantes de proposito —
  // e o unico evento do jogo que e boa noticia.
  heal: {
    gap: 0.3,
    play(s, t, o) {
      s._bell(t, 392, 0.18, 0.042 * o.v, "sine");
      s._bell(t + 0.07, 587, 0.24, 0.034 * o.v, "sine");
    },
  },

  /* A ceifa. E o unico som do jogo que SOBE em altura e em brilho ao mesmo
     tempo, e e de proposito: todo o resto do combate cai (explosao, morte,
     execucao, choque). Subir e o que faz o ouvido ler recompensa em vez de
     dano, sem precisar da nota afinada que a cura usa. `size` cresce com o
     degrau, entao o terceiro degrau soa mais alto E mais largo que o primeiro. */
  reap: {
    gap: 0.35,
    play(s, t, o) {
      const g = 1 + o.size;
      s._sweep(t, 150 * g, 430 * g, 0.24, "sawtooth", 0.05 * o.v, 2200);
      s._wash(t, 0.3 + o.size * 0.2, 500, 3000, 1.1, 0.05 * o.v, 1.1);
      s._bell(t + 0.05, 294 * g, 0.3, 0.036 * o.v, "triangle");
      s._sweep(t, 78, 40, 0.4, "sine", 0.07 * o.v);
    },
  },

  // O portao rasgando. O evento mais raro do jogo e o unico com cauda longa.
  portal: {
    gap: 0.5,
    play(s, t, o) {
      s._wash(t, 0.6, 300, 2600, 1.1, 0.055 * o.v, 0.85);
      s._sweep(t, 56, 30, 0.9, "sine", 0.085 * o.v);
      s._burst(t + 0.02, 0.5, "lowpass", 700, 0.8, 0.046 * o.v, 0.5);
      s._screech(t + 0.14, 0.38, 0.040 * o.v, 0.6);
    },
  },
};
