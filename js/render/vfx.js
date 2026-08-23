"use strict";
/* =========================================================================
   RENDER / VFX — a camada que DESENHA. O sistema de efeitos nunca chama
   `ctx.` : ele emite fatos visuais (game.emitVfx) e aqui eles viram pixels.

   PIECE_VFX: efeitos presos ao personagem. A peca referencia por nome
   (`vfx: "rot"`), entao o registry de conteudo continua sendo dado puro.

   Nenhum PIECE_VFX escolhe a propria cor: ela vem de `p.color`/`p.rgb`, que
   sao a cor da peca — ou seja, a familia do eixo. E o que faz o warlock
   brilhar na cor da build em vez de na cor que o efeito foi escrito.
   ========================================================================= */

const PIECE_VFX = {
  rot: {
      under(ctx, p) {
        // flare curto a cada 0.5s: mesma cadência do tick do DoT
        const flare = Math.pow(1 - ((p.t % 0.5) / 0.5), 3);
        const k = 0.9 + Math.sin(p.t * 2.2) * 0.1 + flare * 0.12;
        const cy = p.y + p.r * 0.9, R = p.r * 1.9 * k;
        const g = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, R);
        g.addColorStop(0, `rgba(${p.rgb},${(0.3 + flare * 0.22).toFixed(2)})`);
        g.addColorStop(0.5, `rgba(${p.rgb},0.14)`);
        g.addColorStop(1, `rgba(${p.rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, cy, R, R * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        // anel apodrecido girando no chão
        ctx.save();
        ctx.translate(p.x, cy);
        ctx.scale(1, 0.4);
        ctx.rotate(-p.t * 0.6);
        ctx.strokeStyle = `rgba(${p.rgb},${(0.48 + flare * 0.35).toFixed(2)})`;
        ctx.lineWidth = 1.6 + flare;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(0, 0, R * 0.95, a, a + 0.32);
          ctx.stroke();
        }
        ctx.restore();

        drawRotOrbit(ctx, p, false);
      },
      over(ctx, p) {
        const lvl = p.lvl || 1;

        // o próprio personagem apodrece, respirando no ritmo do DoT
        const breathe = (Math.sin(p.t * 2.6) + 1) * 0.5;
        drawSpriteGlow(ctx, p.spr, p.x, p.y, p.drawH, p.flip, p.anim,
          p.color, 0.08 + breathe * 0.12 + lvl * 0.01);

        drawRotOrbit(ctx, p, true);

        // esporos se soltando do corpo
        ctx.fillStyle = paleHex(p.color, 0.35);
        for (let i = 0; i < 3 + lvl; i++) {
          const seed = vfxRand(i * 11 + 7);
          const ph = (p.t * (0.5 + seed * 0.4) + seed) % 1;
          const px = p.x + (seed - 0.5) * p.r * 2.1;
          const py = p.y - p.r * 0.4 + ph * p.r * 1.9;
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.6;
          ctx.beginPath();
          ctx.ellipse(px, py, 1.3, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
  },
  ember: {
      under(ctx, p) {
        const k = 0.85 + Math.sin(p.t * 5) * 0.15;
        const cy = p.y + p.r * 0.85;
        const g = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, p.r * 2 * k);
        g.addColorStop(0, `rgba(${p.rgb},0.35)`);
        g.addColorStop(1, `rgba(${p.rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, cy, p.r * 2 * k, p.r * 0.8 * k, 0, 0, Math.PI * 2);
        ctx.fill();
      },
      over(ctx, p) {
        for (let i = 0; i < 7; i++) {
          const ph = (p.t * (0.6 + vfxRand(i) * 0.5) + vfxRand(i + 11)) % 1;
          const ex = p.x + Math.sin(ph * 6.2 + i) * p.r * 0.6 + (vfxRand(i + 5) - 0.5) * p.r * 1.6;
          const ey = p.y + p.r * 0.9 - ph * p.r * 3.4;
          ctx.globalAlpha = (1 - ph) * 0.95;
          ctx.fillStyle = i % 2 ? paleHex(p.color, 0.5) : p.color;
          ctx.beginPath();
          ctx.arc(ex, ey, 1.2 + (1 - ph) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
  },
  thorn: {
      under(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y + p.r * 0.9);
        ctx.scale(1, 0.38);
        ctx.rotate(p.t * 0.7);
        const R = p.r * 1.7;
        ctx.strokeStyle = `rgba(${p.rgb},0.45)`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(${p.rgb},0.55)`;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const tx = Math.cos(a) * R, ty = Math.sin(a) * R;
          ctx.beginPath();
          ctx.moveTo(tx, ty - 5); ctx.lineTo(tx + 7, ty); ctx.lineTo(tx, ty + 5);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      },
      over(ctx, p) {
        for (let i = 0; i < 6; i++) {
          const ph = (p.t * 0.35 + vfxRand(i * 3)) % 1;
          const px = p.x + Math.sin(p.t * 1.2 + i * 2.1) * p.r * 1.3;
          const py = p.y + p.r * 0.8 - ph * p.r * 3;
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(px, py, 1.7, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
  },
  chain: {
      under(ctx, p) { drawPactChain(ctx, p, false); },
      over(ctx, p) { drawPactChain(ctx, p, true); },
  },
  meteor: {
      over(ctx, p) {
        for (let i = 0; i < 3; i++) {
          const cyc = p.t * 0.7 + vfxRand(i * 17);
          const n = Math.floor(cyc), k = cyc - n;
          const seed = n * 5 + i;
          const ang = vfxRand(seed) * Math.PI * 2;
          const dist = p.r * (1.3 + vfxRand(seed + 2) * 1.5);
          const gx = p.x + Math.cos(ang) * dist;
          const gy = p.y + p.r * 0.85 + Math.sin(ang) * dist * 0.4;
          if (k < 0.7) {
            const fy = gy - (1 - k / 0.7) * p.r * 6;
            ctx.strokeStyle = `rgba(${p.rgb},0.5)`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(gx, fy); ctx.lineTo(gx, fy + p.r * 0.9); ctx.stroke();
            ctx.fillStyle = paleHex(p.color, 0.5);
            ctx.beginPath(); ctx.arc(gx, fy, 2.4, 0, Math.PI * 2); ctx.fill();
          } else {
            const k2 = (k - 0.7) / 0.3;
            const rr = p.r * (0.3 + k2 * 0.8);
            ctx.strokeStyle = `rgba(${p.rgb},${(1 - k2).toFixed(2)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(gx, gy, rr, rr * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      },
  },
  blood: {
      under(ctx, p) {
        const k = 0.8 + Math.sin(p.t * 3) * 0.2;
        const cy = p.y + p.r * 0.9;
        const g = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, p.r * 1.8 * k);
        g.addColorStop(0, `rgba(${p.rgb},0.30)`);
        g.addColorStop(1, `rgba(${p.rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, cy, p.r * 1.8 * k, p.r * 0.7 * k, 0, 0, Math.PI * 2);
        ctx.fill();
      },
      over(ctx, p) {
        for (let i = 0; i < 6; i++) {
          const ph = (p.t * 0.8 + vfxRand(i * 9)) % 1;
          const ang = vfxRand(i * 4) * Math.PI * 2 + p.t * 0.6;
          const d = p.r * 2.4 * (1 - ph);
          const dx = p.x + Math.cos(ang) * d;
          const dy = p.y + p.r * 0.7 + Math.sin(ang) * d * 0.45 - ph * p.r * 1.3;
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(dx, dy, 1.8, 2.9, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
  },
  sigil: {
      under(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y + p.r * 0.9);
        ctx.scale(1, 0.4);
        ctx.rotate(-p.t * 1.1);
        ctx.strokeStyle = `rgba(${p.rgb},0.55)`;
        ctx.lineWidth = 3;
        const R = p.r * 1.5 + Math.sin(p.t * 2) * p.r * 0.15;
        for (let i = 0; i < 3; i++) {
          const a0 = (i / 3) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(0, 0, R, a0, a0 + 1.35); ctx.stroke();
        }
        ctx.restore();
      },
      over(ctx, p) {
        const pulse = (Math.sin(p.t * 2) + 1) * 0.5;
        ctx.globalAlpha = 0.1 + pulse * 0.1;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.5 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      },
  },
};

/* --- Eventos visuais ------------------------------------------------------
   A simulacao chama game.emitVfx(kind, x, y, r, color) e segue em frente.
   Nada aqui pode alterar estado de jogo — se alterar, esta no lugar errado. */

/* Curvas de impacto. Nada num acerto e linear: uma onda de choque sai rapido e
   desacelera, e a luz morre antes da forma que a criou.

   Por isso sao DUAS curvas e nao uma. `ease` governa o tamanho e `a` governa o
   brilho, e elas nao andam juntas de proposito: quando as duas caem na mesma
   reta o efeito le como um circulo sendo apagado, e nao como energia se
   dissipando. Foi o que a versao anterior fazia — `k` cru no raio e `1-k` na
   alpha, nos onze eventos visuais do jogo. */
const outCubic = (k) => { const u = 1 - k; return 1 - u * u * u; };
// A serra do Apice. Poucos dentes de proposito: a este raio, quarenta viram
// grao e o anel volta a ler como circulo — a mesma razao que da a casca do
// escudo poucos lados.
const APEX_TEETH = 26, APEX_TOOTH = 0.055;
const outQuint = (k) => { const u = 1 - k; return 1 - u * u * u * u * u; };
const inCubic = (k) => k * k * k;
const LINK_SEGS = 7;   // quebras do filamento de salto

const VFX_LIFE = {
  burst: 0.46, shock: 0.3, spread: 0.6, jump: 0.25, summon: 0.4,
  unsummon: 0.3, execute: 0.4, echo: 0.5, blink: 0.35, heal: 0.6,
  portal: 0.9, reap: 0.55, link: 0.28, dash: 0.2,
  // as tres formas novas sao eventos por direito proprio: cada uma tem vida,
  // desenho e voz. `burst` continua sendo o nome do `bloom` — ele esta em
  // dezesseis pecas e num hash de referencia, e renomear so para ficar
  // simetrico custaria mais do que a simetria vale.
  implode: 0.5, nova: 0.42, rip: 0.4,
  /* O APICE, e ele NAO tem numero proprio: a vida do anel e literalmente a
     varredura declarada em `BALANCE.apex.sweep`, porque a mesma curva
     (`apexFront`) decide onde a onda mata e onde ela e desenhada. E o mesmo
     argumento do telegrafo abaixo — la os dois numeros so podem ser cobrados
     por driver, aqui da para referenciar, e referenciar e melhor que cobrar. */
  apex: BALANCE.apex.sweep,
  /* O TELEGRAFO. A vida dele nao e escolha de gosto: ela e o atraso do golpe
     que ele anuncia, e o anel tem que FECHAR no quadro em que o dano cai. Se
     os dois numeros divergirem, o aviso mente — `driver_vfx` mantem os dois
     iguais. */
  tell: 0.16,
};

/* Kind do evento -> forma no gerador. E um mapa e nao uma igualdade porque o
   `burst` e mais velho que o gerador. */
const EVENT_SHAPE = { burst: "bloom", implode: "implode", nova: "nova", rip: "rip" };

/* --- Resíduo ---------------------------------------------------------------
   As quatro batidas de um evento sao antecipacao, impacto, dissipacao e
   RESIDUO, e o jogo tinha as duas do meio. Sem a quarta, o mundo esquece: uma
   explosao que apagou o vao inteiro da horda deixa exatamente o mesmo chao que
   um tiro que nao acertou ninguem.

   O chamusco vive num pool separado do resto do vfx por dois motivos, e os
   dois sao de PROFUNDIDADE: ele dura dez vezes mais que o evento que o criou,
   e ele e desenhado embaixo de tudo — logo depois do chao e antes de qualquer
   entidade. Evento acontece SOBRE o mundo; residuo acontece NO mundo.

   Ele e escuro, nao aceso. Chao queimado nao brilha — e a ausencia de chao
   limpo. Quem carrega a cor da peca e so o aro, e fraco: se o chamusco
   brilhasse tanto quanto a explosao, a explosao pararia de significar algo, que
   e a mesma regra que segura o cenario inteiro. */
const SCORCH_LIFE = 1.7;
const SCORCH_MAX = 90;
// so o que ABRE espaco deixa marca: implosao recolhe, salto e deslocamento nao
// tocam o chao, e cura nao queima nada
const SCORCH_KINDS = { burst: 0.82, nova: 0.95, rip: 0.5, reap: 0, apex: 0 };

/* Eventos que o teto do pool nao pode descartar. O Apice acontece UMA vez por
   run e leva a tela inteira junto: caindo no `return` do teto, a horda sumiria
   sem nada desenhado — e horda que some sem nada le como bug de pool, que e a
   mesma razao pela qual o corpo sem grade ainda solta um punhado de faiscas. */
const VFX_ALWAYS = { apex: 1 };

// Which variant of a multi-variant vfx this instance gets. A counter, not
// Math.random(): two explosions in the same frame must not land on the same
// silhouette, and cycling guarantees that where randomness only makes it likely.
let VFX_SEQ = 0;

class VfxLayer {
  constructor() {
    /* `x2/y2` sao o SEGUNDO ponto, e existem porque duas mecanicas do jogo sao
       uma relacao entre dois lugares e nao um acontecimento num lugar: o salto
       (`chain`, Contagio) e o deslocamento (`knockback`, `pull`). Sem o par, a
       unica maneira de desenhar um salto seria piscar alguma coisa no destino
       — que e o que o jogo fazia, e por isso ninguem via de ONDE veio. */
    this.pool = new Pool(() => ({}), (o, kind, x, y, r, color, x2, y2) => {
      o.kind = kind; o.x = x; o.y = y; o.r = r;
      o.x2 = x2 != null ? x2 : x; o.y2 = y2 != null ? y2 : y;
      o.seed = (VFX_SEQ = (VFX_SEQ + 1) & 1023);
      o.color = color || "#ffffff";
      o.rgb = hexRgb(o.color);
      o.t = 0; o.life = VFX_LIFE[kind] || 0.35;
    });
    this.decals = new Pool(() => ({}), (o, x, y, r, color, seed) => {
      o.x = x; o.y = y; o.r = r; o.rgb = hexRgb(color);
      o.seed = seed; o.t = 0;
    });
  }
  reset() { this.pool.clear(); this.decals.clear(); }
  emit(kind, x, y, r, color, x2, y2) {
    // teto: vfx nunca engasga o loop — menos o que so acontece uma vez por run
    if (this.pool.active.length > 160 && !VFX_ALWAYS[kind]) return;
    const v = this.pool.spawn(kind, x, y, r, color, x2, y2);
    const f = SCORCH_KINDS[kind];
    if (f > 0 && r > 24 && this.decals.active.length < SCORCH_MAX) {
      this.decals.spawn(x, y, r * f, color, v ? v.seed : 0);
    }
  }
  update(dt) {
    const l = this.pool.active;
    for (let i = 0; i < l.length; i++) {
      l[i].t += dt;
      if (l[i].t >= l[i].life) { this.pool.release(i); i--; }
    }
    const d = this.decals.active;
    for (let i = 0; i < d.length; i++) {
      d[i].t += dt;
      if (d[i].t >= SCORCH_LIFE) { this.decals.release(i); i--; }
    }
  }

  /* Desenhado logo depois do chao e antes de tudo o mais: ele E o chao por um
     tempo. Achatado, porque marca no chao vista de cima nao e um circulo — e a
     mesma elipse que a luz aos pes do warlock e o anel de podridao usam. */
  drawDecals(ctx, cam) {
    const d = this.decals.active;
    if (!d.length) return;
    ctx.save();
    for (let i = 0; i < d.length; i++) {
      const s = d[i], k = s.t / SCORCH_LIFE;
      const a = (1 - k) * (1 - k);          // some devagar e so entao acaba
      const x = s.x - cam.left, y = s.y - cam.top;
      ctx.fillStyle = `rgba(9,5,10,${(a * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, s.r, s.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      // o aro guarda a cor de quem queimou, e so ele
      ctx.strokeStyle = `rgba(${s.rgb},${(a * 0.22).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      for (let j = 0; j < 6; j++) {
        const a0 = vfxRand(s.seed + j) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(x, y, s.r, s.r * 0.42, 0, a0, a0 + 0.55);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  draw(ctx, cam) {
    const l = this.pool.active;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < l.length; i++) {
      const v = l[i], k = v.t / v.life;
      const e = outCubic(k);            // tamanho: sai rapido e desacelera
      const a = (1 - k) * (1 - k);      // brilho: cai antes da forma parar
      const x = v.x - cam.left, y = v.y - cam.top;
      switch (v.kind) {
        case "burst": case "implode": case "nova": case "rip": {
          drawFxEvent(ctx, EVENT_SHAPE[v.kind], x, y, v.r, k, v.color, v.seed);
          break;
        }
        case "echo": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.45).toFixed(2)})`;
          ctx.lineWidth = 1 + a * 3;
          ctx.beginPath(); ctx.arc(x, y, v.r * (0.25 + e * 0.85), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "shock": {
          /* Quadro de impacto: os primeiros milissegundos sao luz branca e nao
             um anel fino. E o que registra que ALGO aconteceu ali antes de o
             olho ter tempo de ler o raio. Sai do glowBlob cacheado, entao
             custa o mesmo com um na tela e com cem. */
          const fl = 1 - Math.min(1, k * 6);
          if (fl > 0) {
            const fr = v.r * (0.3 + (1 - fl) * 0.55);
            ctx.globalAlpha = fl * fl * 0.6;
            ctx.drawImage(glowBlob(v.color), x - fr, y - fr, fr * 2, fr * 2);
            ctx.globalAlpha = 1;
          }
          // o anel de fora sai na frente; o de dentro persegue, e a distancia
          // entre os dois e o que da espessura ao golpe
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.9).toFixed(2)})`;
          ctx.lineWidth = 1 + a * 4;
          ctx.beginPath(); ctx.arc(x, y, v.r * (0.35 + outQuint(k) * 0.75), 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, v.r * (0.12 + e * 0.45), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "spread": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.75).toFixed(2)})`;
          ctx.lineWidth = 1 + a * 2;
          const rr = v.r * (0.2 + e * 0.9);
          for (let s = 0; s < 10; s++) {
            const a0 = (s / 10) * Math.PI * 2 + e * 1.2;
            ctx.beginPath(); ctx.arc(x, y, rr, a0, a0 + 0.26); ctx.stroke();
          }
          break;
        }
        case "jump": {
          ctx.fillStyle = `rgba(${v.rgb},${a.toFixed(2)})`;
          ctx.beginPath(); ctx.arc(x, y, 3 + e * 6, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case "summon": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.9).toFixed(2)})`;
          ctx.lineWidth = 2;
          // anel que FECHA: acelera para dentro em vez de encolher parelho —
          // convergencia constante le como circulo diminuindo, nao como algo
          // sendo puxado para um ponto
          ctx.beginPath(); ctx.arc(x, y, v.r * (1 - inCubic(k) * 0.78), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "unsummon": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.6).toFixed(2)})`;
          ctx.lineWidth = 1.5;
          const s = v.r * (0.6 + e);
          ctx.beginPath();
          ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
          ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
          ctx.stroke();
          break;
        }
        case "execute": {
          ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`;
          ctx.lineWidth = 1 + a * 2;
          for (let s = 0; s < 6; s++) {
            const a0 = (s / 6) * Math.PI * 2;
            const r0 = v.r * (0.3 + e * 0.5), r1 = v.r * (0.7 + outQuint(k) * 1.1);
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0);
            ctx.lineTo(x + Math.cos(a0) * r1, y + Math.sin(a0) * r1);
            ctx.stroke();
          }
          break;
        }
        case "blink": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.8).toFixed(2)})`;
          ctx.lineWidth = 3 * a;
          ctx.beginPath();
          ctx.ellipse(x, y, v.r * (1 - e), v.r * 1.6 * (1 - e), 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "portal": {
          // A gate torn open by a spell: rips open, holds, collapses. `v.r` is
          // the gate radius, same scale drawMinions uses for the standing one.
          const o = Math.min(1, k / 0.18, (1 - k) / 0.26);
          drawPortal(ctx, x, y, v.r, v.t * 4, v.color, o);
          break;
        }
        case "tell": {
          /* Aviso, nao golpe. Ele nao brilha, nao usa `lighter` e nao tem
             miolo: e um anel FECHANDO no chao, e o unico evento do jogo que
             conta o futuro em vez do passado. Fechar e o que da a contagem
             regressiva — um anel que abrisse leria como algo que ja
             aconteceu. */
          const c = 1 - k;
          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.translate(x, y);
          ctx.scale(1, 0.45);
          ctx.strokeStyle = `rgba(${v.rgb},${(0.35 + k * 0.5).toFixed(2)})`;
          ctx.lineWidth = 1.5 + k * 2;
          ctx.beginPath(); ctx.arc(0, 0, v.r * (0.25 + c * 0.95), 0, Math.PI * 2); ctx.stroke();
          // o alvo no chao: o raio EXATO, parado, para o jogador medir a fuga
          ctx.strokeStyle = `rgba(${v.rgb},0.3)`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, v.r, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          break;
        }
        case "reap": {
          /* A ceifa. Ela e o unico evento do jogo desenhado NO CHAO em volta
             do jogador, e por isso e uma elipse achatada e nao um circulo: a
             mesma leitura da luz aos pes do warlock e do anel de podridao.
             Circulo neste raio leria como uma cupula em cima da cena.

             Dois aneis com curvas diferentes, e a distancia entre eles e a
             ceifa: o de fora dispara (outQuint) e o de dentro persegue
             (outCubic). Um anel so, por mais grosso que fosse, leria como a
             onda de choque de uma explosao grande — que e o evento com que ela
             mais poderia ser confundida. */
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(1, 0.45);
          const fl = 1 - Math.min(1, k * 4);
          if (fl > 0) {
            const fr = v.r * 0.4 * (0.5 + (1 - fl));
            ctx.globalAlpha = fl * fl * 0.5;
            ctx.drawImage(glowBlob(v.color), -fr, -fr, fr * 2, fr * 2);
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.85).toFixed(2)})`;
          ctx.lineWidth = 2 + a * 6;
          ctx.beginPath(); ctx.arc(0, 0, v.r * (0.2 + outQuint(k) * 0.85), 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.5).toFixed(2)})`;
          ctx.lineWidth = 1 + a * 3;
          ctx.beginPath(); ctx.arc(0, 0, v.r * (0.08 + e * 0.5), 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          break;
        }
        case "apex": {
          /* A onda do Apice, e ela e o unico evento do jogo desenhado no raio
             em que ele realmente mata: `apexFront` aqui e a mesma funcao que
             `Game.tickApex` usa para escolher quem cai. Aro no raio exato ja e
             a regra de toda zona de dano; aqui ela vale em dobro, porque o que
             o jogador tem que ver e a horda caindo NA linha e nao perto dela.

             SERRILHADA, e e so isso que a separa da ceifa — as duas sao aneis
             achatados em volta do jogador, na cor da build, e a ceifa acontece
             dezenas de vezes por run. Serra le como coisa cortando; anel liso,
             por mais grosso que fosse, leria como a onda de choque de uma
             explosao grande. E ela gira: poligono parado neste raio volta a
             ser um circulo.

             Achatada pelo mesmo motivo da ceifa: circulo cheio a um raio de
             tela inteira leria como uma cupula em cima da cena, e nao como
             algo passando pelo chao. */
          const fr = v.r * apexFront(k);
          /* Alpha quase parelha, e essa e a excecao que a onda de choque da
             explosao ja abre: quando o anel diz ATE ONDE o dano chegou, ele
             precisa continuar legivel enquanto chega la. Preso ao `(1-k)²` do
             resto, ele apagaria na metade da varredura — e o que sumiria e a
             unica informacao que ele carrega. */
          const la = 1 - k * 0.72;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(1, 0.45);

          // o clarao do corpo: o primeiro quadro registra que algo saiu DALI,
          // antes de o olho ter tempo de achar a linha da onda
          const fl = 1 - Math.min(1, k * 7);
          if (fl > 0) {
            const br = v.r * 0.22 * (0.4 + (1 - fl));
            ctx.globalAlpha = fl * fl * 0.75;
            ctx.drawImage(glowBlob(v.color), -br, -br, br * 2, br * 2);
            ctx.globalAlpha = 1;
          }

          // o vao ja varrido, fraquissimo: o que ele diz e "aqui dentro nao
          // sobrou nada". Mais que isto e uma cupula acesa cobrindo a cena.
          ctx.fillStyle = `rgba(${v.rgb},${(la * 0.05).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(0, 0, fr, 0, Math.PI * 2); ctx.fill();

          const spin = k * 1.1;
          ctx.strokeStyle = `rgba(${v.rgb},${(la * 0.95).toFixed(2)})`;
          ctx.lineWidth = 3 + la * 7;
          ctx.beginPath();
          for (let t = 0; t <= APEX_TEETH * 2; t++) {
            const ang = spin + (t / (APEX_TEETH * 2)) * Math.PI * 2;
            const rr = fr * (t & 1 ? 1 : 1 - APEX_TOOTH);
            const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
            if (t) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.stroke();

          /* A esteira: o mesmo raio atrasado no TEMPO, nao um raio menor. E o
             atraso que da espessura a onda — dois raios sorteados a esmo
             leriam como dois aneis, e nao como um so que tem corpo. */
          const bk = Math.max(0, k - 0.18);
          ctx.strokeStyle = `rgba(${v.rgb},${(la * 0.4).toFixed(2)})`;
          ctx.lineWidth = 1 + la * 3;
          ctx.beginPath();
          ctx.arc(0, 0, v.r * apexFront(bk), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case "link": {
          /* O salto. Ate aqui `chain` acertava o proximo alvo sem NADA ligando
             os dois, e o jogador via dois inimigos piscando em lugares
             diferentes — a mecanica inteira acontecia entre os dois pontos e
             era exatamente esse entre que nao era desenhado.

             O filamento e quebrado e nao reto: reta le como regua, e o seed do
             evento e que sorteia as quebras, entao dois saltos no mesmo frame
             nao saem paralelos. */
          const x2 = v.x2 - cam.left, y2 = v.y2 - cam.top;
          const dx = x2 - x, dy = y2 - y;
          const nx = -dy, ny = dx;
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.95).toFixed(2)})`;
          ctx.lineWidth = 1 + a * 2.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let sgm = 1; sgm < LINK_SEGS; sgm++) {
            const f = sgm / LINK_SEGS;
            // amplitude morre nas duas pontas: o filamento nasce e termina
            // ancorado nos corpos, e so o meio chicoteia
            const w = Math.sin(f * Math.PI) * 0.16 * (vfxRand(v.seed + sgm) - 0.5) * 2;
            ctx.lineTo(x + dx * f + nx * w, y + dy * f + ny * w);
          }
          ctx.lineTo(x2, y2);
          ctx.stroke();
          break;
        }
        case "dash": {
          /* O empurrao e o puxao movem o corpo de uma vez, e ate aqui o corpo
             simplesmente aparecia longe. O rastro nao desfaz o teletransporte —
             ele CONTA que houve um, que e a informacao que faltava. Estreita
             enquanto morre, entao a ponta larga diz de onde ele saiu. */
          const x2 = v.x2 - cam.left, y2 = v.y2 - cam.top;
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.7).toFixed(2)})`;
          ctx.lineCap = "round";
          ctx.lineWidth = Math.max(1, v.r * 0.55 * a);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.lineCap = "butt";
          break;
        }
        case "heal": {
          ctx.fillStyle = `rgba(${v.rgb},${(a * 0.8).toFixed(2)})`;
          const hy = y - e * 34;
          ctx.fillRect(x - 6, hy - 2, 12, 4);
          ctx.fillRect(x - 2, hy - 6, 4, 12);
          break;
        }
      }
    }
    ctx.restore();
  }
}

/* --- Explosao -------------------------------------------------------------
   Three layers, and each one is there for a reason:

   1. the flash — a cached glowBlob, brightest at ignition, gone by a third of
      the life. It is what lights the ground and sells the moment of the hit;
   2. the pixel frames from sprites.js, blitted with smoothing off so the cells
      stay square like every other sprite in the game;
   3. the shockwave ring, which is the only part drawn at the real damage
      radius. The fireball is art and lies about its size; the ring does not,
      and that is what the player reads to learn where the blast reached.

   The whole thing is one blob + one blit + one stroke. No allocation, no
   gradient, nothing that scales with how many explosions are on screen. */
function drawFxEvent(ctx, shape, x, y, r, k, color, seed) {
  // The requested size picks the grid: the form is born with the number of
  // cells it will occupy in the buffer, so the blit is 1:1 and cells stay
  // square.
  const G = explosionGrid((r * 2.6) / PIXEL_GRID);
  const set = fxFrames(shape, color, G);
  const frames = set[(seed >> 1) % set.length];
  const fi = Math.min(frames.length - 1, Math.floor(k * frames.length));
  const size = G * PIXEL_GRID;              // grid half = 1.3r, fireball tops near 0.9r

  ctx.save();
  /* O clarao acompanha a CURVA DE CALOR da forma, e nao o comeco da vida. No
     `bloom` o calor esta no primeiro terco; no `implode` ele chega no fim, e um
     clarao na ignicao contaria a historia ao contrario — o evento inteiro
     existe para o estouro chegar depois do colapso. */
  const late = FX_SHAPES[shape] && FX_SHAPES[shape].lateFlash;
  const flash = late ? Math.max(0, 1 - Math.abs(k - 0.78) * 5)
                     : Math.max(0, 1 - k * 3);
  if (flash > 0) {
    const fr = r * (1.05 + (1 - flash) * 0.7);
    ctx.globalAlpha = flash * 0.6;
    ctx.drawImage(glowBlob(color), x - fr, y - fr, fr * 2, fr * 2);
  }

  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  const px = snapUnit(x - size / 2), py = snapUnit(y - size / 2);
  // mirroring doubles the variants for free
  drawPixelCanvas(ctx, frames[fi], px, py, size, size, (seed & 1) === 1);
  ctx.restore();

  /* A onda e a unica parte desenhada no raio real do dano, entao ela e a que
     mais precisa da curva — e a unica em que forma e brilho NAO podem usar a
     mesma. O raio sai da detonacao rapido e desacelera ate o alcance; a alpha
     cai parelho, porque ela e o tempo que o jogador tem para ler ate onde a
     explosao pegou. Amarrar a alpha na curva do raio apagaria o anel no
     primeiro decimo da vida, quando ele ainda esta dizendo o que importa. */
  const rt = Math.min(1, k * 2.4);
  if (rt < 1 && !late) {
    const fade = 1 - rt;
    ctx.strokeStyle = `rgba(255,255,255,${(fade * 0.6).toFixed(2)})`;
    ctx.lineWidth = 1 + fade * 3;
    ctx.beginPath(); ctx.arc(x, y, r * (0.3 + outQuint(rt) * 0.78), 0, Math.PI * 2); ctx.stroke();
  }
}

/* --- Portal ---------------------------------------------------------------
   A gate any portal spell can open. The frame is the pixel sprite from
   sprites.js; the mouth is drawn here because it has to spin. `open` (0..1)
   is the whole animation: the gate is scaled from a slit around its own
   mouth, so opening, standing and closing are one code path.

   Nothing here allocates a gradient — the glows are the cached glowBlob, so
   a portal costs the same at frame 1 and at frame 10000. */
function drawPortal(ctx, x, y, r, t, color, open) {
  const k = open == null ? 1 : clamp(open, 0, 1);
  if (k <= 0.02) return;
  const spr = portalSprite(color);
  const A = PORTAL_ART;
  const s = (r * 2.9) / spr.canvas.height;      // sprite pixel -> world pixel
  const w = spr.canvas.width * s, h = spr.canvas.height * s;
  const vx = A.rx * s, vy = A.ry * s;           // the mouth inside the arch
  const rgb = hexRgb(color);
  const blob = glowBlob(color);

  ctx.save();
  ctx.translate(x, y - r * 0.6);                // origin = center of the mouth
  ctx.scale(0.2 + k * 0.8, 0.35 + k * 0.65);    // tears open as a slit, widens

  // scorched ground where the gate is planted
  const fy = A.feet * s, gw = w * 0.5;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.4;
  ctx.drawImage(blob, -gw, fy - gw * 0.3, gw * 2, gw * 0.6);

  // the mouth is opaque: the horde behind the gate must not show through it
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(8,3,14,0.95)";
  ctx.beginPath(); ctx.ellipse(0, 0, vx, vy, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, vx, vy, 0, 0, Math.PI * 2); ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.45;
  ctx.drawImage(blob, -vx, -vy, vx * 2, vy * 2);          // depth
  ctx.strokeStyle = `rgba(${rgb},0.7)`;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.globalAlpha = 0.8;
  for (let arm = 0; arm < 4; arm++) {                     // arms spiral inward
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const f = 0.12 + (i / 10) * 0.88;
      const a = t * 1.7 + arm * (Math.PI / 2) + f * 3.6;
      const px = Math.cos(a) * vx * f, py = Math.sin(a) * vy * f;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  const cw = vx * (0.5 + Math.sin(t * 5) * 0.12);         // core
  ctx.globalAlpha = 0.9;
  ctx.drawImage(blob, -cw, -cw, cw * 2, cw * 2);
  ctx.restore();

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr.canvas, -A.cx * s, -A.cy * s, w, h);

  ctx.globalCompositeOperation = "lighter";
  const breathe = 0.4 + Math.sin(t * 3) * 0.22;
  const rw = r * 0.45;
  for (let i = 0; i < A.runes.length; i++) {              // runes breathing
    ctx.globalAlpha = breathe;
    ctx.drawImage(blob, A.runes[i][0] * s - rw, A.runes[i][1] * s - rw, rw * 2, rw * 2);
  }
  ctx.fillStyle = `rgb(${rgb})`;
  for (let i = 0; i < 5; i++) {                           // motes pulled in
    const f = 1 - ((t * 0.5 + vfxRand(i * 13)) % 1);
    const a = vfxRand(i * 7) * Math.PI * 2 + t * 1.2;
    ctx.globalAlpha = 0.25 + (1 - f) * 0.6;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * vx * f * 1.35, Math.sin(a) * vy * f * 1.35, 1.2 + f, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* --- Demonios -------------------------------------------------------------
   Sem sprite dedicado: corpo em gradiente + olhos, escalado pelo raio. O
   "grande" ganha um halo pulsante para se ler no meio da horda. A excecao e
   o portal, que tem sprite proprio (drawPortal). */
const MINION_FADE = 0.9;   // segundos de fade antes do demonio expirar

/* Um objeto so, reaproveitado — animar 20 demonios nao pode alocar por frame. */
const MINION_ANIM = { bob: 0, frame: 0, sclX: 1, sclY: 1, rot: 0 };

/* `gait` separa quem pisa no chao de quem paira e de quem esta plantado.
   `animTime` anda 4/s para todos, entao a frequencia sai daqui. */
function minionAnim(gait, t, r) {
  const a = MINION_ANIM;
  if (gait === "float") {
    a.bob = Math.sin(t * 0.35) * r * 0.24; a.frame = 0;
    a.sclX = 1; a.sclY = 1; a.rot = 0;
    return a;
  }
  if (gait === "static") {
    // planted, not dead: one pixel of breathing. The squash that used to be
    // here was a fraction of a cell and the grid dropped it whole.
    a.bob = (Math.sin(t * 0.5) - 1) * 0.9; a.frame = 0;
    a.sclX = 1; a.sclY = 1; a.rot = 0;
    return a;
  }
  const ph = t * 1.6;
  a.bob = -Math.abs(Math.sin(ph)) * r * 0.22;
  a.frame = Math.floor(ph / (Math.PI / 2)) & 3;
  a.sclX = 1; a.sclY = 1; a.rot = 0;
  return a;
}

/* --- Demonios -------------------------------------------------------------
   Cada `kind` tem sprite proprio: com uma duzia deles em campo a silhueta e a
   unica coisa que diz o que esta ali — quatro patas e cacador, sem pernas e
   voidwalker, arco de pedra e portal. Kind sem sprite cai no orbe generico. */
function drawMinions(ctx, list, cam, now) {
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const sx = m.x - cam.left, sy = m.y - cam.top, r = m.radius;
    const def = m.defKind || MINIONS[m.kind] || null;
    const spr = def && def.sprite ? SPRITES[def.sprite] : null;
    const gait = (def && def.gait) || "walk";
    const floats = gait === "float";
    const anim = minionAnim(gait, m.animTime, r);

    drawShadow(ctx, sx, sy + r * (floats ? 0.85 : 0.55), r * (floats ? 0.6 : 0.8));

    if (m.big) {
      const k = (Math.sin(now * 3 + i) + 1) * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.16 + k * 0.1;
      const w = r * 2.4;
      ctx.drawImage(glowBlob(m.color), sx - w, sy - w + anim.bob, w * 2, w * 2);
      ctx.restore();
    }

    if (!spr) {
      const bob = anim.bob;
      const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.4 + bob, r * 0.15, sx, sy + bob, r);
      g.addColorStop(0, PAL.bone2);
      g.addColorStop(0.55, m.color);
      g.addColorStop(1, "rgba(20,6,10,0.9)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy + bob, r, 0, Math.PI * 2); ctx.fill();
      // olho de horda, nao de spell: a PAL reserva o rosa-sangue para isso
      ctx.fillStyle = PAL.blood1;
      const ex = r * 0.32 * m.facing;
      ctx.beginPath();
      ctx.arc(sx - r * 0.3 + ex * 0.2, sy - r * 0.15 + bob, r * 0.16, 0, Math.PI * 2);
      ctx.arc(sx + r * 0.3 + ex * 0.2, sy - r * 0.15 + bob, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    // O ultimo segundo some por alpha: demonio que evapora no meio do nada
    // parece bug de pool. Invocacao permanente (Tirania) nunca entra aqui.
    const left = m.expiresAt - now;
    const fade = left < MINION_FADE ? Math.max(0, left / MINION_FADE) : 1;
    const drawH = r * ((def && def.scale) || 2.8);
    const flip = m.facing < 0;

    if (fade < 1) ctx.globalAlpha = fade;
    drawSprite(ctx, spr, sx, sy, drawH, flip, 0, anim);
    const k = (Math.sin(m.animTime * 0.6) + 1) * 0.5;
    drawSpriteGlow(ctx, spr, sx, sy, drawH, flip, anim, m.color, (m.big ? 0.1 : 0.05) * (0.6 + k * 0.4) * fade);
    if (fade < 1) ctx.globalAlpha = 1;
  }
}

/* --- Sobreposicoes de peca ------------------------------------------------
   Auras desenham seu raio real (o jogador precisa VER onde o efeito pega) e
   pecas `rooted` desenham o anel de carga — sem isso, "fique parado" e uma
   mecanica invisivel. */
function drawPieceOverlays(ctx, build, player, cam) {
  const sx = player.x - cam.left, sy = player.y - cam.top;
  for (const inst of build.pieces.values()) {
    const t = inst.r.trigger;
    if (t.type === "aura") {
      const r = inst.r.stats.radius || 0;
      if (r <= 0) continue;
      const rgb = hexRgb(inst.def.color);
      const g = ctx.createRadialGradient(sx, sy, r * 0.35, sx, sy, r);
      g.addColorStop(0, `rgba(${rgb},0)`);
      g.addColorStop(0.82, `rgba(${rgb},0.05)`);
      g.addColorStop(1, `rgba(${rgb},0.15)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${rgb},0.32)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (t.type === "rooted") {
      const k = TRIGGERS.rooted.charge(inst);
      if (k <= 0.01) continue;
      const r = player.radius * 2.1;
      ctx.strokeStyle = inst.def.color;
      ctx.globalAlpha = 0.35 + k * 0.5;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// O nome antigo continua: a explosao e um caso de `drawFxEvent`.
function drawExplosion(ctx, x, y, r, k, color, seed) {
  drawFxEvent(ctx, "bloom", x, y, r, k, color, seed);
}
