"use strict";
/* =========================================================================
   RENDER / VFX — a camada que DESENHA. O sistema de efeitos nunca chama
   `ctx.` : ele emite fatos visuais (game.emitVfx) e aqui eles viram pixels.

   PIECE_VFX: efeitos presos ao personagem. A peca referencia por nome
   (`vfx: "rot"`), entao o registry de conteudo continua sendo dado puro.
   ========================================================================= */

const PIECE_VFX = {
  rot: {
      under(ctx, p) {
        // flare curto a cada 0.5s: mesma cadência do tick do DoT
        const flare = Math.pow(1 - ((p.t % 0.5) / 0.5), 3);
        const k = 0.9 + Math.sin(p.t * 2.2) * 0.1 + flare * 0.12;
        const cy = p.y + p.r * 0.9, R = p.r * 1.9 * k;
        const g = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, R);
        g.addColorStop(0, `rgba(127,220,74,${(0.3 + flare * 0.22).toFixed(2)})`);
        g.addColorStop(0.5, "rgba(96,180,52,0.14)");
        g.addColorStop(1, "rgba(60,140,40,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, cy, R, R * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        // anel apodrecido girando no chão
        ctx.save();
        ctx.translate(p.x, cy);
        ctx.scale(1, 0.4);
        ctx.rotate(-p.t * 0.6);
        ctx.strokeStyle = `rgba(127,220,74,${(0.48 + flare * 0.35).toFixed(2)})`;
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
          "#7fdc4a", 0.08 + breathe * 0.12 + lvl * 0.01);

        drawRotOrbit(ctx, p, true);

        // esporos se soltando do corpo
        ctx.fillStyle = "#9ff05c";
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
        g.addColorStop(0, "rgba(255,110,40,0.35)");
        g.addColorStop(1, "rgba(255,60,20,0)");
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
          ctx.fillStyle = i % 2 ? "#ffd24a" : "#ff4a20";
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
        ctx.strokeStyle = "rgba(127,220,74,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(127,220,74,0.55)";
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
          ctx.fillStyle = "#7fdc4a";
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
            ctx.strokeStyle = "rgba(255,122,44,0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(gx, fy); ctx.lineTo(gx, fy + p.r * 0.9); ctx.stroke();
            ctx.fillStyle = "#ffcf5a";
            ctx.beginPath(); ctx.arc(gx, fy, 2.4, 0, Math.PI * 2); ctx.fill();
          } else {
            const k2 = (k - 0.7) / 0.3;
            const rr = p.r * (0.3 + k2 * 0.8);
            ctx.strokeStyle = `rgba(255,122,44,${(1 - k2).toFixed(2)})`;
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
        g.addColorStop(0, "rgba(200,32,60,0.30)");
        g.addColorStop(1, "rgba(200,32,60,0)");
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
          ctx.fillStyle = "#c8203c";
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
        ctx.strokeStyle = "rgba(154,76,255,0.55)";
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
        ctx.fillStyle = "#9a4cff";
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

const VFX_LIFE = {
  burst: 0.35, shock: 0.3, spread: 0.6, jump: 0.25, summon: 0.4,
  unsummon: 0.3, execute: 0.4, echo: 0.5, blink: 0.35, heal: 0.6,
};

class VfxLayer {
  constructor() {
    this.pool = new Pool(() => ({}), (o, kind, x, y, r, color) => {
      o.kind = kind; o.x = x; o.y = y; o.r = r;
      o.rgb = hexRgb(color || "#ffffff");
      o.t = 0; o.life = VFX_LIFE[kind] || 0.35;
    });
  }
  reset() { this.pool.clear(); }
  emit(kind, x, y, r, color) {
    if (this.pool.active.length > 160) return;   // teto: vfx nunca engasga o loop
    this.pool.spawn(kind, x, y, r, color);
  }
  update(dt) {
    const l = this.pool.active;
    for (let i = 0; i < l.length; i++) {
      l[i].t += dt;
      if (l[i].t >= l[i].life) { this.pool.release(i); i--; }
    }
  }
  draw(ctx, cam) {
    const l = this.pool.active;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < l.length; i++) {
      const v = l[i], k = v.t / v.life, a = 1 - k;
      const x = v.x - cam.left, y = v.y - cam.top;
      switch (v.kind) {
        case "burst":
        case "echo": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * (v.kind === "echo" ? 0.4 : 0.75)).toFixed(2)})`;
          ctx.lineWidth = 1 + a * 3;
          ctx.beginPath(); ctx.arc(x, y, v.r * (0.25 + k * 0.85), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "shock": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.85).toFixed(2)})`;
          ctx.lineWidth = 2 + a * 3;
          ctx.beginPath(); ctx.arc(x, y, v.r * (0.4 + k * 0.7), 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, v.r * (0.15 + k * 0.4), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "spread": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.7).toFixed(2)})`;
          ctx.lineWidth = 2;
          const rr = v.r * (0.2 + k * 0.9);
          for (let s = 0; s < 10; s++) {
            const a0 = (s / 10) * Math.PI * 2 + k * 1.2;
            ctx.beginPath(); ctx.arc(x, y, rr, a0, a0 + 0.26); ctx.stroke();
          }
          break;
        }
        case "jump": {
          ctx.fillStyle = `rgba(${v.rgb},${a.toFixed(2)})`;
          ctx.beginPath(); ctx.arc(x, y, 3 + k * 6, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case "summon": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.9).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, v.r * (1 - k * 0.75), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "unsummon": {
          ctx.strokeStyle = `rgba(${v.rgb},${(a * 0.6).toFixed(2)})`;
          ctx.lineWidth = 1.5;
          const s = v.r * (0.6 + k);
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
            const r0 = v.r * 0.3, r1 = v.r * (0.7 + k * 1.1);
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
          ctx.ellipse(x, y, v.r * (1 - k), v.r * 1.6 * (1 - k), 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "heal": {
          ctx.fillStyle = `rgba(${v.rgb},${(a * 0.8).toFixed(2)})`;
          const hy = y - k * 34;
          ctx.fillRect(x - 6, hy - 2, 12, 4);
          ctx.fillRect(x - 2, hy - 6, 4, 12);
          break;
        }
      }
    }
    ctx.restore();
  }
}

/* --- Demonios -------------------------------------------------------------
   Sem sprite dedicado: corpo em gradiente + olhos, escalado pelo raio. O
   "grande" ganha um halo pulsante para se ler no meio da horda. */
function drawMinions(ctx, list, cam, now) {
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const sx = m.x - cam.left, sy = m.y - cam.top, r = m.radius;
    const bob = Math.sin(m.animTime) * r * 0.12;

    drawShadow(ctx, sx, sy + r * 0.6, r * 0.8);

    if (m.big) {
      const k = (Math.sin(now * 3 + i) + 1) * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.28 + k * 0.18;
      const w = r * 2.4;
      ctx.drawImage(glowBlob(m.color), sx - w, sy - w + bob, w * 2, w * 2);
      ctx.restore();
    }

    const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.4 + bob, r * 0.15, sx, sy + bob, r);
    g.addColorStop(0, "#ffe6b0");
    g.addColorStop(0.55, m.color);
    g.addColorStop(1, "rgba(20,6,10,0.9)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy + bob, r, 0, Math.PI * 2); ctx.fill();

    // chifres nos grandes
    if (m.big) {
      ctx.strokeStyle = m.color;
      ctx.lineWidth = Math.max(1.5, r * 0.16);
      ctx.beginPath();
      ctx.moveTo(sx - r * 0.6, sy - r * 0.7 + bob); ctx.lineTo(sx - r * 0.95, sy - r * 1.35 + bob);
      ctx.moveTo(sx + r * 0.6, sy - r * 0.7 + bob); ctx.lineTo(sx + r * 0.95, sy - r * 1.35 + bob);
      ctx.stroke();
    }

    ctx.fillStyle = "#ffd24a";
    const ex = r * 0.32 * m.facing;
    ctx.beginPath();
    ctx.arc(sx - r * 0.3 + ex * 0.2, sy - r * 0.15 + bob, r * 0.16, 0, Math.PI * 2);
    ctx.arc(sx + r * 0.3 + ex * 0.2, sy - r * 0.15 + bob, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
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
