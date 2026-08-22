"use strict";
/* =========================================================================
   UI — canvas desenha o mundo, DOM desenha a interface.
   Tudo aqui e HTML sobre o canvas, escondido/mostrado pela classe .hidden.
   Elemento novo de UI = markup no index.html + ref em this.el.
   ========================================================================= */

class UI {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $("hud"), menu: $("menu"), timer: $("timer"), kills: $("kills"),
      hpFill: $("hpFill"), xpFill: $("xpFill"), shieldFill: $("shieldFill"),
      hpLabel: $("hpLabel"), xpLabel: $("xpLabel"),
      pieceBar: $("pieceBar"), axisBar: $("axisBar"), dmgHud: $("dmgHud"),
      toasts: $("toasts"),
      levelup: $("levelup"), cards: $("cards"), lvSub: $("lvSub"),
      pause: $("pause"), pausePanel: $("pausePanel"),
      chest: $("chest"), chestList: $("chestList"), chestRarity: $("chestRarity"),
      gameover: $("gameover"), stats: $("stats"),
      classGrid: $("classGrid"), speedRow: $("speedRow"), startBtn: $("startBtn"),
    };
    $("restartBtn").onclick = () => this.game.start();
    $("chestBtn").onclick = () => this.closeChest();
    $("resumeBtn").onclick = () => this.game.resume();
    $("pauseRestartBtn").onclick = () => this.game.start();
    $("quitBtn").onclick = () => this.game.quitToMenu();
  }

  /* --- menu --------------------------------------------------------------- */

  buildMenu() {
    const g = this.game;
    let html = "";
    for (const id in CLASSES) {
      const c = CLASSES[id];
      html += `<div class="class-card ${c.available ? "available" : "locked"}
        ${id === g.selectedClass ? "selected" : ""}" data-cls="${id}">
        <div class="class-icon" style="color:${c.color}">${c.available ? "🜏" : "🔒"}</div>
        <div class="class-name">${c.name}</div>
        <div class="class-tag">${c.tag}</div></div>`;
    }
    this.el.classGrid.innerHTML = html;
    for (const card of this.el.classGrid.children) {
      const id = card.dataset.cls;
      if (!CLASSES[id].available) continue;
      card.onclick = () => {
        g.selectedClass = id;
        for (const c of this.el.classGrid.children) c.classList.remove("selected");
        card.classList.add("selected");
      };
    }
    for (const b of this.el.speedRow.querySelectorAll(".speed-btn")) {
      b.onclick = () => {
        g.selectedSpeed = +b.dataset.spd;
        for (const o of this.el.speedRow.querySelectorAll(".speed-btn")) o.classList.remove("active");
        b.classList.add("active");
      };
    }
    this.el.startBtn.onclick = () => g.start();
  }

  onStart() {
    this.el.menu.classList.add("hidden");
    this.el.gameover.classList.add("hidden");
    this.el.levelup.classList.add("hidden");
    this.el.chest.classList.add("hidden");
    this.el.pause.classList.add("hidden");
    this.el.hud.classList.remove("hidden");
    this.el.toasts.innerHTML = "";
    this.updatePieceBar();
  }

  toMenu() {
    this.el.pause.classList.add("hidden");
    this.el.hud.classList.add("hidden");
    this.el.menu.classList.remove("hidden");
  }

  /* --- HUD ---------------------------------------------------------------- */

  updateHUD() {
    const g = this.game, p = g.player, e = this.el;
    e.timer.textContent = mmss(g.elapsed);
    e.timer.classList.toggle("hard", g.elapsed >= BALANCE.spawn.hardAt);
    e.kills.textContent = "☠ " + p.kills;
    const hp = Math.max(0, p.hp);
    e.hpFill.style.width = (hp / p.maxHp * 100) + "%";
    const lim = p.maxShield > 0 ? p.maxShield : p.maxHp;
    e.shieldFill.style.width = (Math.min(1, p.shield / lim) * 100) + "%";
    e.hpLabel.textContent = p.shield > 0
      ? `${Math.ceil(hp)} / ${p.maxHp}  (+${Math.ceil(p.shield)})`
      : `${Math.ceil(hp)} / ${p.maxHp}`;
    e.xpFill.style.width = (p.xp / p.xpToNext * 100) + "%";
    e.xpLabel.textContent = "Nível " + p.level;
  }

  // Barra de eixos: mostra pool gasto, teto por eixo e capstones acesos.
  updateAxisBar() {
    const b = this.game.build;
    let html = "";
    for (const id in AXES) {
      const a = AXES[id], v = b.axis[id];
      const caps = [];
      for (const cid of b.capstones) if (CAPSTONES[cid].axis === id) caps.push(CAPSTONES[cid]);
      html += `<div class="axis-row" title="${a.name} — ${a.tag}">
        <span class="axis-ic" style="color:${a.color}">${a.icon}</span>
        <div class="axis-track">
          <div class="axis-fill" style="width:${v / AXIS_RULES.capPerAxis * 100}%;background:${a.color}"></div>
          <span class="axis-num">${v}</span>
        </div>
        <span class="axis-caps">${caps.map((c) =>
          `<b style="color:${c.color}" title="${c.name}: ${c.desc}">${c.icon}</b>`).join("")}</span>
      </div>`;
    }
    html += `<div class="axis-pool">${b.axisTotal}/${AXIS_RULES.pool} pontos</div>`;
    this.el.axisBar.innerHTML = html;
  }

  // Barra de pecas: icone + pips de tier por caminho (o "estado da build").
  updatePieceBar() {
    const b = this.game.build;
    let html = "";
    for (const inst of b.pieces.values()) {
      let pips = "";
      for (const pid in inst.paths) {
        const n = inst.paths[pid];
        pips += `<i class="${n > PATH_RULES.freeTier ? "deep" : ""}">${n}</i>`;
      }
      html += `<div class="pb-icon" style="border-color:${inst.def.color}"
        title="${inst.def.name}">
        <span style="color:${inst.def.color}">${inst.def.icon}</span>
        <div class="pb-pips">${pips}</div></div>`;
    }
    for (const id of b.passives.keys()) {
      const p = PASSIVES[id];
      html += `<div class="pb-icon pb-passive" style="border-color:${p.color}"
        title="${p.name}: ${p.desc}"><span style="color:${p.color}">${p.icon}</span></div>`;
    }
    this.el.pieceBar.innerHTML = html;
    this.updateAxisBar();
    this.updateDamageMeter();
  }

  updateDamageMeter() {
    const g = this.game;
    const rows = [];
    for (const inst of g.build.pieces.values()) {
      rows.push({ def: inst.def, val: g.damageBy.get(inst.key) || 0 });
    }
    rows.sort((a, b) => b.val - a.val);
    const max = rows.length ? Math.max(1, rows[0].val) : 1;
    let html = "";
    for (const r of rows) {
      html += `<div class="dmg-row">
        <span class="dmg-ic" style="color:${r.def.color}">${r.def.icon}</span>
        <div class="dmg-bar">
          <div class="dmg-fill" style="width:${r.val / max * 100}%;background:${r.def.color}"></div>
          <span class="dmg-val">${fmtNum(r.val)}</span>
        </div></div>`;
    }
    this.el.dmgHud.innerHTML = html;
  }

  toast(t) {
    const el = document.createElement("div");
    el.className = "toast";
    el.style.borderColor = t.color;
    el.innerHTML = `
      <div class="toast-head"><span style="color:${t.color}">${t.icon}</span> ${t.head || "Novo poder!"}</div>
      <div class="toast-name">${t.name}</div>
      <div class="toast-desc">${t.desc}</div>`;
    this.el.toasts.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  /* --- level up ------------------------------------------------------------
     Um unico pool de ofertas: peca nova, tier de caminho ou passiva global.
     A carta e a unica hora em que o jogador decide algo que nao e posicao. */

  openLevelUp() {
    const g = this.game;
    g.state = STATE.LEVELUP;
    g.sfx.levelUp();
    const offers = g.build.getOffers(3);
    if (!offers.length) {
      g.player.pendingLevels = 0;
      g.state = STATE.PLAYING;
      return;
    }
    this.el.lvSub.textContent = `${g.build.axisLeft} pontos de eixo restantes`;
    this.el.cards.innerHTML = "";
    for (const o of offers) {
      const card = document.createElement("div");
      card.className = "card card-" + o.kind + (o.isEvo ? " card-evo" : "");
      // The card body wears the axis color (which build it feeds); only the top
      // ribbon wears the offer-kind color.
      const acc = o.axis ? o.axis.color : o.def.color;
      card.style.setProperty("--acc", acc);
      card.style.setProperty("--acc-dim", acc + "66");
      card.style.setProperty("--acc-wash", acc + "1c");
      card.style.setProperty("--acc-glow", acc + "7a");
      card.innerHTML = this.cardHtml(o);
      card.onclick = () => this.applyOffer(o);
      this.el.cards.appendChild(card);
    }
    this.el.levelup.classList.remove("hidden");
  }

  cardHtml(o) {
    if (o.kind === "piece") {
      const cost = o.def.axisPoints != null ? o.def.axisPoints : 2;
      return `
        <div class="card-type card-type-piece">◈ Nova spell</div>
        <div class="card-icon" style="color:${o.def.color}">${o.def.icon}</div>
        <div class="card-name">${o.def.name}</div>
        <div class="card-level">${TRIGGER_LABEL[o.def.trigger.type] || "Automática"}</div>
        <div class="card-sub">Entra na build e dispara sozinha</div>
        <div class="card-desc">${o.def.desc}</div>
        <div class="card-meta">
          ${this.chip(o.axis.color, `${o.axis.icon} ${o.axis.name} +${cost}`)}
        </div>`;
    }
    if (o.kind === "passive") {
      return `
        <div class="card-type card-type-passive">✦ Passiva</div>
        <div class="card-icon" style="color:${o.def.color}">${o.def.icon}</div>
        <div class="card-name">${o.def.name}</div>
        <div class="card-level">Bônus permanente</div>
        <div class="card-sub">Não dispara — afeta a build inteira</div>
        <div class="card-desc">${o.def.desc}</div>
        ${o.def.exclusive ? `<div class="card-warn">Bloqueia ${PASSIVES[o.def.exclusive].name}</div>` : ""}
        <div class="card-meta">
          ${this.chip("#6fdc4a", "Custa 0 ponto de eixo")}
        </div>`;
    }
    // path tier: upgrades a spell already in the build
    const deep = o.tierIndex + 1 > PATH_RULES.freeTier;
    const evo = o.isEvo && o.evo;
    let pips = "";
    for (let i = 0; i < PATH_RULES.tiers; i++) {
      pips += `<i class="${i < o.tierIndex ? "on" : i === o.tierIndex ? "nxt" : ""}"></i>`;
    }
    return `
      <div class="card-type card-type-path">▲ Melhoria${evo ? " · evolução" : ""}</div>
      <div class="card-icon" style="color:${o.def.color}">${evo ? o.evo.icon : o.def.icon}</div>
      <div class="card-name">${o.tier.name}</div>
      <div class="card-level">${o.path.name} · tier ${o.tierIndex + 1}/${PATH_RULES.tiers}</div>
      <div class="card-sub">Melhora a spell <b>${o.def.name}</b></div>
      <div class="card-desc">${o.tier.desc}</div>
      ${evo ? `<div class="card-evo-tag" style="color:${o.evo.color};border-color:${o.evo.color}">
                 ⭐ Evolui para ${o.evo.name}</div>` : ""}
      ${deep && !evo ? `<div class="card-warn">Caminho profundo · +1 ${o.axis.name}</div>` : ""}
      <div class="card-meta">
        ${this.chip(o.def.color, `${o.def.icon} <span class="card-pips">${pips}</span>`)}
        ${this.chip(o.axis.color, `${o.axis.icon} ${o.axis.name}${deep ? " +1" : ""}`)}
      </div>`;
  }

  // Colored chip at the card footer: axis cost, source spell, path progress.
  chip(color, inner) {
    return `<span class="card-chip" style="color:${color};border-color:${color}55;background:${color}18">${inner}</span>`;
  }

  applyOffer(o) {
    const g = this.game;
    const res = g.build.applyOffer(o);

    if (res.evolved) {
      g.sfx.combo();
      g.addShake(22);
      g.spawnParticles(g.player.x, g.player.y, res.evolved.to.color, 48);
      g.player.comboPulse(res.evolved.to.color);
      this.toast({ head: "Evolução!", color: res.evolved.to.color, icon: res.evolved.to.icon,
        name: `${res.evolved.from} → ${res.evolved.to.name}`, desc: res.evolved.to.desc });
    }
    for (const cap of res.caps) {
      g.sfx.combo();
      g.addShake(18);
      g.spawnParticles(g.player.x, g.player.y, cap.color, 40);
      g.player.comboPulse(cap.color);
      this.toast({ head: "Capstone!", color: cap.color, icon: cap.icon,
        name: cap.name, desc: cap.desc });
    }
    this.checkForm();
    this.updatePieceBar();

    g.player.pendingLevels--;
    this.el.levelup.classList.add("hidden");
    if (g.player.pendingLevels > 0) this.openLevelUp();
    else g.state = STATE.PLAYING;
  }

  // Metamorfose visual: agora ancorada nos pontos de eixo gastos.
  checkForm() {
    const g = this.game, p = g.player;
    const idx = p.formIndex(g.build.axisTotal);
    if (idx === p.formIdx) return;
    const grew = idx > p.formIdx;
    p.formIdx = idx;
    const f = p.forms[idx];
    if (!grew || !f.name) return;
    g.sfx.combo();
    g.addShake(22);
    g.spawnParticles(p.x, p.y, f.color, 44);
    p.comboPulse(f.color);
    this.toast({ head: "Metamorfose!", color: f.color, icon: f.icon,
      name: f.name, desc: f.desc });
  }

  /* --- bau ---------------------------------------------------------------- */

  openChest() {
    const g = this.game;
    const cands = [];
    for (const inst of g.build.pieces.values()) {
      for (const pid in inst.def.paths) {
        if (g.build.canUpgradePath(inst, pid)) cands.push({ inst, pathId: pid });
      }
    }
    shuffle(cands);

    const roll = Math.random();
    const rarity = roll < 0.6 ? { count: 1, label: "Comum", color: "#cfd2dc" }
      : roll < 0.9 ? { count: 3, label: "Raro", color: "#5acfff" }
      : { count: 5, label: "Lendário", color: "#ffd24a" };

    const results = [];
    const used = new Set();
    for (const c of cands) {
      if (results.length >= rarity.count) break;
      const tag = c.inst.key + ":" + c.pathId;
      if (used.has(tag)) continue;
      if (!g.build.canUpgradePath(c.inst, c.pathId)) continue;
      used.add(tag);
      const from = c.inst.paths[c.pathId];
      const r = g.build.upgradePath(c.inst, c.pathId);
      if (!r) continue;
      results.push({ def: c.inst.def, path: c.inst.def.paths[c.pathId],
                     from, to: r.tier, evolved: r.evolved });
    }
    if (!results.length) g.player.hp = g.player.maxHp;

    for (const r of results) {
      if (!r.evolved) continue;
      this.toast({ head: "Evolução!", color: r.evolved.to.color, icon: r.evolved.to.icon,
        name: `${r.evolved.from} → ${r.evolved.to.name}`, desc: r.evolved.to.desc });
    }
    for (const cap of g.build.checkCapstones()) {
      g.build.afterChange();
      this.toast({ head: "Capstone!", color: cap.color, icon: cap.icon,
        name: cap.name, desc: cap.desc });
    }
    this.checkForm();
    this.updatePieceBar();

    g.sfx.levelUp();
    g.addShake(rarity.count >= 5 ? 16 : rarity.count >= 3 ? 10 : 6);
    let rows = results.length
      ? results.map((r) => `<div class="chest-row">
          <span class="chest-ic" style="color:${r.def.color}">${r.def.icon}</span>
          <span class="chest-name">${r.def.name} · ${r.path.name}</span>
          <span class="chest-lv">Tier ${r.from} → ${r.to}</span></div>`).join("")
      : `<div class="chest-empty">Arsenal no máximo — cura total!</div>`;
    this.el.chestList.innerHTML = rows;
    this.el.chestRarity.textContent = `${rarity.label} · ${rarity.count} tier${rarity.count > 1 ? "s" : ""}`;
    this.el.chestRarity.style.color = rarity.color;
    g.state = STATE.CHEST;
    this.el.chest.classList.remove("hidden");
  }

  closeChest() {
    const g = this.game;
    this.el.chest.classList.add("hidden");
    g.state = STATE.PLAYING;
    if (g.player.pendingLevels > 0) this.openLevelUp();
  }

  /* --- pausa: o painel onde a build inteira e legivel --------------------- */

  onPause() {
    const g = this.game, b = g.build;
    let left = `<div class="pause-head">Peças</div>`;
    if (!b.pieces.size) left += `<div class="pause-empty">Nenhuma peça ainda.</div>`;
    for (const inst of b.pieces.values()) {
      let paths = "";
      for (const pid in inst.def.paths) {
        const path = inst.def.paths[pid];
        const n = inst.paths[pid];
        const locked = !b.canUpgradePath(inst, pid) && n < PATH_RULES.tiers;
        let pips = "";
        for (let i = 0; i < PATH_RULES.tiers; i++) {
          pips += `<i class="${i < n ? "on" : ""}"></i>`;
        }
        const next = n < PATH_RULES.tiers ? path.tiers[n].name : "máximo";
        paths += `<div class="pp-row ${locked ? "locked" : ""}">
          <span class="pp-name">${path.name}</span>
          <span class="pp-pips">${pips}</span>
          <span class="pp-next">${locked ? "trancado" : next}</span></div>`;
      }
      left += `<div class="pw-row">
        <div class="pw-ic" style="border-color:${inst.def.color};color:${inst.def.color}">${inst.def.icon}</div>
        <div class="pw-body">
          <div class="pw-top"><span class="pw-name">${inst.def.name}</span>
            <span class="pw-lv">${TRIGGER_LABEL[inst.r.trigger.type] || ""}</span></div>
          <div class="pw-next">${inst.def.desc}</div>
          ${paths}
        </div></div>`;
    }

    let right = `<div class="pause-head">Eixos</div><div class="pause-axis">`;
    for (const id in AXES) {
      const a = AXES[id];
      right += `<div class="cb-row ${b.axis[id] >= AXIS_RULES.hybridMain ? "done" : ""}">
        <div class="cb-head"><span class="cb-ic">${a.icon}</span>
          <span class="cb-name">${a.name}</span>
          <span class="cb-status ${b.axis[id] >= AXIS_RULES.pureAt ? "on" : ""}">${b.axis[id]}/${AXIS_RULES.capPerAxis}</span></div>
        <div class="cb-desc">${a.tag}</div>
        <div class="cb-bar"><div class="cb-fill" style="width:${b.axis[id] / AXIS_RULES.capPerAxis * 100}%;background:${a.color}"></div></div>
      </div>`;
    }
    right += `</div><div class="pause-head">Capstones</div>`;
    for (const id in CAPSTONES) {
      const c = CAPSTONES[id];
      const on = b.capstones.has(id);
      const req = Object.entries(c.req)
        .map(([a, v]) => `<span class="cb-req-row ${b.axis[a] >= v ? "ok" : ""}">${AXES[a].icon} <b>${b.axis[a]}/${v}</b></span>`)
        .join("");
      right += `<div class="cb-row ${on ? "done" : ""}">
        <div class="cb-head"><span class="cb-ic">${c.icon}</span>
          <span class="cb-name">${c.name}</span>
          <span class="cb-status ${on ? "on" : ""}">${on ? "ativo" : ""}</span></div>
        <div class="cb-desc">${c.desc}</div>
        <div class="cb-req">${req}</div></div>`;
    }
    if (b.passives.size) {
      right += `<div class="pause-head">Passivas</div>`;
      for (const id of b.passives.keys()) {
        const p = PASSIVES[id];
        right += `<div class="cb-row done"><div class="cb-head">
          <span class="cb-ic">${p.icon}</span><span class="cb-name">${p.name}</span></div>
          <div class="cb-desc">${p.desc}</div></div>`;
      }
    }

    this.el.pausePanel.innerHTML =
      `<div class="pause-col">${left}</div><div class="pause-col">${right}</div>`;
    this.el.pause.classList.remove("hidden");
  }

  hidePause() { this.el.pause.classList.add("hidden"); }

  /* --- game over ---------------------------------------------------------- */

  onGameOver() {
    const g = this.game;
    const rows = [];
    for (const inst of g.build.pieces.values()) {
      rows.push({ def: inst.def, val: g.damageBy.get(inst.key) || 0 });
    }
    rows.sort((a, b) => b.val - a.val);
    const total = rows.reduce((s, r) => s + r.val, 0);
    let html = `
      <div class="stat"><span>Sobrevivência</span><b>${mmss(g.elapsed)}</b></div>
      <div class="stat"><span>Abates</span><b>${g.player.kills}</b></div>
      <div class="stat"><span>Nível</span><b>${g.player.level}</b></div>
      <div class="stat"><span>Dano total</span><b>${fmtNum(total)}</b></div>
      <div class="stat"><span>Eixos</span><b>${g.build.axis.corruption}/${g.build.axis.dominion}/${g.build.axis.cataclysm}</b></div>
      <div class="stat stat-head">Dano por peça</div>`;
    for (const r of rows) {
      html += `<div class="stat"><span style="color:${r.def.color}">${r.def.icon} ${r.def.name}</span>
        <b>${fmtNum(r.val)}</b></div>`;
    }
    this.el.stats.innerHTML = html;
    this.el.gameover.classList.remove("hidden");
  }
}

// Rotulo curto de cada trigger, para a carta dizer COMO a peca dispara — que
// e a informacao que decide a compra numa build sem input de ataque.
const TRIGGER_LABEL = {
  auto_target: "Mira automática",
  aura: "Aura pulsante",
  orbital: "Orbital",
  trail: "Rastro ao andar",
  rooted: "Carrega parado",
  directional: "Na direção do movimento",
  autonomous: "Autônomo",
  reactive: "Reativo",
};
