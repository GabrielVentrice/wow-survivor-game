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
      levelup: $("levelup"), lvRows: $("lvRows"), lvBuild: $("lvBuild"),
      lvEyebrow: $("lvEyebrow"), lvBudget: $("lvBudget"),
      lvWas: $("lvWas"), lvFree: $("lvFree"), lvTotal: $("lvTotal"),
      pause: $("pause"), pausePanel: $("pausePanel"),
      chest: $("chest"), chestList: $("chestList"), chestRarity: $("chestRarity"),
      gameover: $("gameover"), stats: $("stats"),
      classGrid: $("classGrid"), startBtn: $("startBtn"),
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
      const aura = b.isComplete(inst);
      html += `<div class="pb-icon ${aura ? "pb-aura" : ""}"
        style="border-color:${inst.def.color};color:${inst.def.color}"
        title="${inst.def.name}${aura ? " — concluída, aura acesa" : ""}">
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
     E a unica hora em que o jogador decide algo que nao e posicao — e a unica
     decisao IRREVERSIVEL, porque ponto de eixo nao volta.

     A tela sao TRES LINHAS com as mesmas tres colunas (o que e / o que muda /
     custo) mais um painel com a build de agora. Nada aqui e texto novo por
     tier: a frase sai do `desc` que ja existe, o "antes -> depois" sai dos
     MODS do tier aplicados aos stats resolvidos da instancia, e o painel
     inteiro e derivado do `Build`. Conteudo continua sendo dado. */

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

    /* O nivel que ESTA escolha paga. Com varios niveis na fila o jogador
       escolhe uma vez por nivel, entao o rotulo anda com a fila em vez de
       repetir o nivel ja alcancado tres vezes seguidas. */
    const lv = g.player.level - g.player.pendingLevels;
    this.el.lvEyebrow.textContent = `Nível ${lv} → ${lv + 1}`;
    this.el.lvTotal.textContent = `/ ${AXIS_RULES.pool} pontos de eixo`;
    this.updateBudget(null);

    this.lvOffers = offers;
    this.lvViews = offers.map((o) => this.offerView(o));
    this.lvHover = -1;
    this.el.lvRows.innerHTML = "";
    for (let i = 0; i < offers.length; i++) {
      const v = this.lvViews[i];
      const row = document.createElement("div");
      row.className = "lv-row";
      row.style.setProperty("--acc", v.color);
      row.style.setProperty("--acc-dim", v.color + "55");
      row.style.setProperty("--acc-wash", v.color + "1c");
      row.innerHTML = this.rowHtml(v);
      row.onclick = () => this.applyOffer(offers[i]);
      // O hover so re-renderiza o PAINEL: mexer nas linhas mataria a transicao
      // de `transform` que o CSS esta rodando naquele instante.
      row.onmouseenter = () => this.lvHoverTo(i);
      row.onmouseleave = () => this.lvHoverTo(-1);
      this.el.lvRows.appendChild(row);
    }
    this.el.lvBuild.innerHTML = this.buildPanelHtml(-1);
    this.el.levelup.classList.remove("hidden");
  }

  lvHoverTo(i) {
    if (this.lvHover === i) return;
    this.lvHover = i;
    this.updateBudget(i >= 0 ? this.lvViews[i] : null);
    this.el.lvBuild.innerHTML = this.buildPanelHtml(i);
  }

  /* Previa do gasto no chip de orcamento: o saldo cai para o que sobraria e o
     chip vira alarme. Ponto de eixo nao volta — e o unico numero desta tela
     que o jogador nao pode desfazer depois, entao ele e o unico que se antecipa
     ao clique. Sem custo real (passiva, tier livre, eixo no teto) nada muda:
     alarme que acende sempre para de alarmar. */
  updateBudget(v) {
    const left = this.game.build.axisLeft;
    const spend = !!(v && v.gain > 0);
    this.el.lvWas.textContent = left;
    this.el.lvFree.textContent = spend ? left - v.gain : left;
    this.el.lvBudget.classList.toggle("spend", spend);
  }

  /* Tudo o que a linha mostra, derivado do que a oferta ja carrega. Roda uma
     vez por oferta (nao por hover): o resultado fica em `this.lvViews`. */
  offerView(o) {
    const b = this.game.build;
    const axis = o.axis || null;
    const v = {
      color: axis ? axis.color : o.def.color,
      axis, gain: 0, pips: null, delta: [], rec: "",
    };

    if (o.kind === "piece") {
      const trig = TRIGGER_LABEL[o.def.trigger.type] || "Automática";
      v.kind = "Spell nova";
      v.glyph = "◈";
      v.icon = o.def.icon;
      v.name = o.def.name;
      v.subtitle = `${trig.toLowerCase()} · dispara sozinha`;
      v.plain = o.def.desc;
      v.why = `${axis.icon} ${axis.name} — ${axis.tag}.`;
      v.delta = [["não está na build", trig]];
      v.progress = "spell nova";
      v.cost = o.def.axisPoints != null ? o.def.axisPoints : 2;
    } else if (o.kind === "passive") {
      v.kind = "Passiva";
      v.glyph = "✦";
      v.round = true;       // circulo: a mesma forma que a passiva tem no HUD
      v.icon = o.def.icon;
      v.name = o.def.name;
      v.subtitle = "não dispara · afeta a build inteira";
      v.plain = o.def.desc;
      v.why = o.def.exclusive
        ? `Escolher esta fecha a porta de ${PASSIVES[o.def.exclusive].name} — a build tem que optar.`
        : "Vale para a build inteira, não para uma peça só.";
      v.progress = "passiva";
      v.cost = 0;
    } else {
      const evo = o.isEvo && o.evo ? o.evo : null;
      /* Evolucao ganha etiqueta propria em vez de "Melhoria · evolução": ela
         nao e um degrau a mais, e conversao — a peca troca de nome, arte,
         trigger e efeitos. Chamar as duas coisas de melhoria some com o
         climax justamente na linha em que ele acontece. */
      v.kind = evo ? "Evolução" : "Melhoria";
      v.glyph = evo ? "⭐" : "▲";
      // O icone de uma melhoria e o de uma spell que voce JA tem: sem o selo
      // ele e indistinguivel do icone de uma spell nova.
      v.badge = o.tierIndex + 1;
      v.icon = evo ? evo.icon : o.def.icon;
      /* O slot do nome carrega a SPELL, nao o nome de fantasia do tier. O
         jogador reconhece "Incinerate" de imediato — esta na build dele, no
         painel e no HUD; "Brasa" nao quer dizer nada ate ser lido. O nome do
         tier desce para o subtitulo, junto do caminho e do degrau, que e onde
         ele serve de referencia sem disputar atencao com o efeito. */
      v.name = evo ? evo.name : o.def.name;
      v.subtitle = evo
        ? `${o.def.name} · ${o.path.name} · tier ${PATH_RULES.tiers} de ${PATH_RULES.tiers}`
        : `${o.tier.name} · ${o.path.name} · tier ${o.tierIndex + 1} de ${PATH_RULES.tiers}`;
      /* O `desc` dos sete tiers de evolucao comeca com "EVOLUÇÃO — ", de quando
         a carta nao tinha onde marcar isso. Agora a etiqueta marca, entao o
         prefixo repetiria a palavra tres vezes na mesma linha (etiqueta, frase
         e porque). Tirado na exibicao, nao no dado: o `desc` continua servindo
         a quem le o catalogo direto. */
      const plain = o.tier.desc.replace(/^EVOLUÇÃO\s*[—-]\s*/, "");
      v.plain = plain.charAt(0).toUpperCase() + plain.slice(1);
      // Sem repetir o nome que agora esta no slot acima: o "porque" fica so
      // com o que a spell E, que e o contexto da melhoria.
      v.why = evo ? evo.desc : o.def.desc;
      v.delta = this.tierDelta(o);
      v.progress = o.path.name;
      v.pips = o.tierIndex + 1;
      v.cost = o.tierIndex + 1 > PATH_RULES.freeTier ? 1 : 0;
    }

    /* Custo REAL, nao o de tabela: com o eixo no teto ou o pool no fim,
       `addAxis` entrega menos do que a oferta pede — e dizer "custa 2" quando
       vai custar 0 e a mentira mais cara possivel nesta tela. */
    if (axis && v.cost) {
      v.gain = Math.max(0, Math.min(v.cost,
        AXIS_RULES.capPerAxis - b.axis[axis.id], b.axisLeft));
    }
    /* Veredito primeiro, detalhe depois e mais fraco: a pergunta e "gasta ou
       nao?", e ela cabe em tres palavras. Numa unica frase forte o custo
       quebrava em duas linhas e virava o bloco mais pesado da coluna, o que
       ele nao precisa ser para ser lido. */
    if (!v.cost) {
      v.costFree = true;
      v.costHead = "Não gasta ponto";
      v.costTail = o.kind === "passive"
        ? "passivas são livres"
        : `até o tier ${PATH_RULES.freeTier} é livre`;
    } else if (!v.gain) {
      v.costFree = true;
      v.costHead = "Não gasta ponto";
      v.costTail = `${axis.name} já no teto`;
    } else {
      v.costFree = false;
      const cur = b.axis[axis.id];
      v.costHead = `Custa ${v.gain}`;
      v.costTail = `${axis.name} ${cur} → ${cur + v.gain}`;
    }

    v.rec = this.recFor(o, v);
    return v;
  }

  /* "antes -> depois" saido dos MODS do tier, aplicados aos stats JA
     resolvidos da instancia (com passivas e capstone dentro). E o numero que o
     jogador vai passar a ter, nao o numero da tabela — e nunca desatualiza
     quando o balanceamento muda.

     Tier so-estrutural (mods nulo, `patch` presente) nao tem delta numerico: a
     frase do tier ja E a mudanca. Um tier pode escrever `was`/`now` a mao
     quando o texto disser mais que o numero. */
  tierDelta(o) {
    const t = o.tier;
    if (t.was && t.now) return [[t.was, t.now]];
    if (!t.mods) return [];
    const before = o.inst.r.stats;
    const after = Object.assign({}, before);
    applyMods(after, t.mods);
    const out = [];
    for (const k in t.mods) {
      const a = before[k], z = after[k];
      if (typeof a !== "number" || typeof z !== "number" || a === z) continue;
      const s = STAT_FMT[k];
      if (!s) continue;
      out.push([`${s.name} ${s.fmt(a)}`, s.fmt(z)]);
      // Duas linhas e o teto: a terceira empurraria o "porque" para fora da
      // altura da linha, e o porque e o que explica a compra.
      if (out.length === 2) break;
    }
    return out;
  }

  /* O chip verde so aparece quando a oferta muda a corrida por um MARCO —
     abrir ou aproximar um capstone, ou acender a aura fechando um caminho.
     Sem gancho real ele nao aparece: recomendacao decorativa vira ruido e o
     jogador para de ler o chip que importa. */
  recFor(o, v) {
    const b = this.game.build;
    if (o.kind === "path" && o.tierIndex + 1 === PATH_RULES.tiers && !b.isComplete(o.inst)) {
      return "acende a aura";
    }
    if (!v.axis || !v.gain) return "";
    const before = this.nearestCapstone();
    const after = this.nearestCapstone(v.axis.id, v.gain);
    if (!after) return "";
    // Sem artigo de proposito: os capstones tem generos diferentes ("a
    // Tirania", "o Ceifador") e um artigo fixo erra metade dos nomes.
    if (!after.missing) return `abre ${after.cap.name}`;
    if (before && after.missing < before.missing) return `aproxima ${after.cap.name}`;
    return "";
  }

  /* Capstone mais perto de abrir, contando `extra` pontos que ainda nao foram
     gastos. Capstone que nao cabe mais no pool nao entra: apontar para um alvo
     inalcancavel e pior que nao apontar nenhum. */
  nearestCapstone(extraAxis, extra) {
    const b = this.game.build;
    const left = b.axisLeft - (extra || 0);
    let best = null;
    for (const id in CAPSTONES) {
      if (b.capstones.has(id)) continue;
      const c = CAPSTONES[id];
      let missing = 0;
      const gaps = [], paid = [];
      for (const a in c.req) {
        const have = b.axis[a] + (a === extraAxis ? extra : 0);
        const need = c.req[a] - have;
        if (need > 0) { missing += need; gaps.push({ axis: AXES[a], need }); }
        else paid.push(AXES[a]);
      }
      if (missing > left) continue;
      if (!best || missing < best.missing) best = { cap: c, missing, gaps, paid };
    }
    return best;
  }

  rowHtml(v) {
    let delta = "";
    for (const d of v.delta) {
      delta += `<div class="lv-delta"><span class="was">${d[0]}</span>` +
               `<span class="arrow">→</span><span class="now">${d[1]}</span></div>`;
    }
    return `
      <div class="lv-what">
        <div class="lv-tile${v.round ? " round" : ""}">${v.icon}${
          v.badge ? `<b>${v.badge}</b>` : ""}</div>
        <div class="lv-what-txt">
          <div class="lv-kind"><i>${v.glyph}</i>${v.kind}</div>
          <div class="lv-name">${v.name}</div>
          <div class="lv-subtitle">${v.subtitle}</div>
        </div>
      </div>
      <div class="lv-change">
        <div class="lv-plain">${v.plain}</div>
        ${delta}
        <div class="lv-why">${v.why}</div>
      </div>
      <div class="lv-cost">
        <div class="lv-cost-line ${v.costFree ? "free" : "pay"}">${v.costHead}
          <span>${v.costTail}</span></div>
        <div class="lv-prog"><span class="lv-prog-lbl">${v.progress}</span>${
          v.pips != null ? this.pipsHtml(v.pips) : ""}</div>
        ${v.rec ? `<div class="lv-rec">${v.rec}</div>` : ""}
        <div class="lv-pick">Escolher</div>
      </div>`;
  }

  pipsHtml(n) {
    let s = `<span class="lv-pips">`;
    for (let i = 0; i < PATH_RULES.tiers; i++) s += `<i class="${i < n ? "on" : ""}"></i>`;
    return s + `</span>`;
  }

  /* Painel da build: o contexto sem o qual "melhoria" e "spell nova" sao
     palavras abstratas. Tudo derivado do Build — nenhum estado novo alem do
     indice da oferta sob o mouse.

     Ele nao rola: quando a build cresce, ele muda de DENSIDADE e depois
     RESUME. Eixos e capstone ficam presos embaixo porque sao a informacao que
     decide a compra; quem cede espaco e a lista de spells. */
  buildPanelHtml(hoverIdx) {
    const g = this.game, b = g.build;
    const o = hoverIdx >= 0 && this.lvOffers ? this.lvOffers[hoverIdx] : null;
    const v = hoverIdx >= 0 && this.lvViews ? this.lvViews[hoverIdx] : null;

    /* Quais spells a oferta sob o mouse mexe: o tier melhora a instancia dele;
       a spell nova destaca quem a habilitou (`requires`), que e o unico
       vinculo real que ela tem com a build de agora. */
    const hit = new Set();
    if (o && o.kind === "path") hit.add(o.inst.key);
    if (o && o.kind === "piece" && o.def.requires) {
      const r = o.def.requires;
      if (r.piece && b.pieces.has(r.piece)) hit.add(r.piece);
      if (r.tag) {
        for (const inst of b.pieces.values()) {
          if (inst.def.tags && inst.def.tags.indexOf(r.tag) >= 0) hit.add(inst.key);
        }
      }
    }

    const start = (CLASSES[g.selectedClass] && CLASSES[g.selectedClass].starting) || [];
    const rows = [];
    for (const inst of b.pieces.values()) {
      const d = inst.def;
      const paths = [];
      for (const pid in inst.paths) {
        if (inst.paths[pid] > 0) paths.push({ name: d.paths[pid].name, n: inst.paths[pid] });
      }
      paths.sort((x, y) => y.n - x.n);
      rows.push({
        def: d, paths, hit: hit.has(inst.key),
        meta: start.indexOf(inst.key) >= 0
          ? "kit inicial"
          : `${AXES[d.axis].name} · ${d.axisPoints != null ? d.axisPoints : 2} pts`,
      });
    }
    // A spell afetada sobe para o topo, para nunca cair dentro do contador.
    rows.sort((a, z) => (z.hit ? 1 : 0) - (a.hit ? 1 : 0));

    const compact = rows.length > PANEL.fullRows;
    const maxRows = compact ? PANEL.slimRows : PANEL.fullRows;
    let list = "";
    for (let i = 0; i < rows.length && i < maxRows; i++) {
      const r = rows[i], c = r.def.color;
      const style = `--acc:${c};--acc-dim:${c}55` +
        (r.hit ? `;background:${c}1f;border-color:${c}aa` : "");
      if (compact) {
        const top = r.paths[0];
        list += `<div class="lv-sp slim" style="${style}">
          <span class="lv-sp-ic">${r.def.icon}</span>
          <span class="lv-sp-name">${r.def.name}</span>
          ${top ? this.pipsHtml(top.n) : ""}
          ${r.hit ? `<span class="lv-sp-tag">↑ afetada</span>` : ""}</div>`;
      } else {
        let pr = "";
        for (const p of r.paths) {
          pr += `<div class="lv-sp-path"><span>${p.name}</span>${this.pipsHtml(p.n)}</div>`;
        }
        list += `<div class="lv-sp full" style="${style}">
          <div class="lv-sp-top">
            <span class="lv-sp-ic">${r.def.icon}</span>
            <span class="lv-sp-txt">
              <span class="lv-sp-name">${r.def.name}</span>
              <span class="lv-sp-meta">${r.meta}</span>
            </span>
          </div>
          ${pr}
          ${r.hit ? `<div class="lv-sp-hint">↑ a linha em destaque melhora esta spell</div>` : ""}
        </div>`;
      }
    }
    const overflow = rows.length - maxRows;

    let chips = "";
    let np = 0;
    for (const id of b.passives.keys()) {
      if (np >= PANEL.chips) break;
      const p = PASSIVES[id];
      chips += `<span class="lv-chip" style="--acc-dim:${p.color}55;--acc-wash:${p.color}16">
        <i>${p.icon}</i><span>${p.name}</span></span>`;
      np++;
    }
    if (b.passives.size > np) {
      chips += `<span class="lv-chip more">+${b.passives.size - np}</span>`;
    }

    let axes = "";
    for (const id in AXES) {
      const a = AXES[id], val = b.axis[id];
      const add = v && v.axis && v.axis.id === id ? v.gain : 0;
      const pct = (n) => Math.min(100, n / AXIS_RULES.capPerAxis * 100);
      axes += `<div class="lv-ax" style="--acc:${a.color}">
        <div class="lv-ax-head">
          <span class="lv-ax-ic">${a.icon}</span>
          <span class="lv-ax-name">${a.name}</span>
          <span class="lv-ax-num ${add ? "lit" : ""}">${
            add ? `${val} → ${val + add}` : val} / ${AXIS_RULES.capPerAxis}</span>
        </div>
        <div class="lv-ax-track">
          <i class="ghost" style="width:${pct(val + add)}%"></i>
          <i style="width:${pct(val)}%"></i>
        </div></div>`;
    }

    let cap = "";
    const near = this.nearestCapstone();
    if (near && near.gaps.length) {
      const falta = near.gaps.map((x) => `${x.need} de ${x.axis.name}`).join(" e ");
      const pago = near.paid.map((x) => `${x.name} ${near.cap.req[x.id]}`).join(" e ");
      cap = `<div class="lv-cap">${near.cap.icon}
        <b style="color:${near.cap.color}">${near.cap.name}</b> a ${falta}${
        pago ? ` — ${pago} já pago.` : "."}</div>`;
    }

    const nS = rows.length, nP = b.passives.size;
    return `
      <div class="lv-b-head">
        <span class="lv-b-lbl">Sua build agora</span>
        <span class="lv-b-count">${nS} spell${nS === 1 ? "" : "s"} · ${nP} passiva${nP === 1 ? "" : "s"}</span>
      </div>
      <div class="lv-b-list">${list}</div>
      ${overflow > 0 ? `<div class="lv-b-more">+${overflow} spell${
        overflow === 1 ? "" : "s"} — abra a pausa para ver tudo</div>` : ""}
      ${nP ? `<div class="lv-b-sec">
        <div class="lv-b-lbl">Passivas</div>
        <div class="lv-b-chips">${chips}</div></div>` : ""}
      <div class="lv-b-div"></div>
      <div class="lv-b-axes">${axes}</div>
      ${cap}`;
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
    if (res.completed) this.auraToast(res.completed);
    for (const cap of res.caps) {
      g.sfx.combo();
      g.addShake(18);
      g.spawnParticles(g.player.x, g.player.y, cap.color, 40);
      g.player.comboPulse(cap.color);
      this.toast({ head: "Capstone!", color: cap.color, icon: cap.icon,
        name: cap.name, desc: cap.desc });
    }
    this.checkForm(res.caps[res.caps.length - 1]);
    this.updatePieceBar();

    g.player.pendingLevels--;
    this.el.levelup.classList.add("hidden");
    if (g.player.pendingLevels > 0) this.openLevelUp();
    else g.state = STATE.PLAYING;
  }

  /* Aura: a spell fechou um caminho ate o fim e passou a arder em volta do
     warlock. E o unico jeito de ganhar adorno no personagem. */
  auraToast(def) {
    const g = this.game;
    g.sfx.combo();
    g.addShake(14);
    g.spawnParticles(g.player.x, g.player.y, def.color, 34);
    g.player.comboPulse(def.color);
    this.toast({ head: "Aura!", color: def.color, icon: def.icon,
      name: def.name,
      desc: "Spell concluída — a aura dela agora arde em volta de você." });
  }

  /* Metamorfose visual: ancorada nos CAPSTONES fechados. `cause` e o capstone
     que acabou de abrir, quando houver — a transformacao sai na cor de quem a
     causou, e nao numa cor generica de forma. */
  checkForm(cause) {
    const g = this.game, p = g.player;
    const idx = p.formIndex(g.build.capstones.size);
    if (idx === p.formIdx) return;
    const grew = idx > p.formIdx;
    p.formIdx = idx;
    const f = p.forms[idx];
    if (!grew || !f.name) return;
    const color = (cause && cause.color) || f.color;
    g.sfx.combo();
    g.addShake(22);
    g.spawnParticles(p.x, p.y, color, 44);
    p.comboPulse(color);
    this.toast({ head: "Metamorfose!", color, icon: f.icon,
      name: f.name, desc: f.desc });
  }

  /* --- bau ---------------------------------------------------------------- */

  openChest() {
    const g = this.game;
    /* O baú termina o que você começou.

       Sorteando tiers uniformemente ele espalhava investimento e empurrava a
       build para longe das evoluções — que exigem cinco compras na MESMA
       trilha. Ordenando por profundidade, o baú vira o empurrão final: pega o
       caminho mais adiantado primeiro e, com sorte, fecha o tier 5. */
    const cands = [];
    for (const inst of g.build.pieces.values()) {
      for (const pid in inst.def.paths) {
        if (g.build.canUpgradePath(inst, pid)) cands.push({ inst, pathId: pid });
      }
    }
    shuffle(cands);
    cands.sort((a, b) => b.inst.paths[b.pathId] - a.inst.paths[a.pathId]);

    // Raridade é dado (BALANCE.chest.rarity); depois de hardAt a tabela troca de
    // coluna e os baús grandes passam a ser a regra.
    const late = g.elapsed >= BALANCE.spawn.hardAt;
    const rarity = pickWeighted(BALANCE.chest.rarity, late ? "lateWeight" : "weight");

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
                     from, to: r.tier, evolved: r.evolved, completed: r.completed });
    }
    if (!results.length) g.player.hp = g.player.maxHp;

    for (const r of results) {
      if (!r.evolved) continue;
      this.toast({ head: "Evolução!", color: r.evolved.to.color, icon: r.evolved.to.icon,
        name: `${r.evolved.from} → ${r.evolved.to.name}`, desc: r.evolved.to.desc });
    }
    for (const r of results) {
      if (r.completed) this.auraToast(r.completed);
    }
    let lastCap = null;
    for (const cap of g.build.checkCapstones()) {
      g.build.afterChange();
      lastCap = cap;
      this.toast({ head: "Capstone!", color: cap.color, icon: cap.icon,
        name: cap.name, desc: cap.desc });
    }
    this.checkForm(lastCap);
    this.updatePieceBar();

    g.sfx.levelUp();
    g.addShake(rarity.shake);
    let rows = results.length
      ? results.map((r) => `<div class="chest-row">
          <span class="chest-ic" style="color:${r.def.color}">${r.def.icon}</span>
          <span class="chest-name">${r.def.name} · ${r.path.name}</span>
          <span class="chest-lv">Tier ${r.from} → ${r.to}</span></div>`).join("")
      : `<div class="chest-empty">Arsenal no máximo — cura total!</div>`;
    this.el.chestList.innerHTML = rows;
    // O rótulo conta o que caiu, não o que foi sorteado: com o arsenal quase no
    // teto um Lendário entrega menos de 5 e dizer "5 tiers" seria mentira.
    const got = results.length;
    this.el.chestRarity.textContent = got
      ? `${rarity.label} · ${got} tier${got > 1 ? "s" : ""}`
      : `${rarity.label} · arsenal no máximo`;
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
    /* Metamorfose: o painel diz em que forma o warlock esta e o que falta para
       a proxima — sem isso o jogador ve o corpo mudar e nao sabe por que. */
    const forms = g.player.forms;
    right += `</div><div class="pause-head">Metamorfose</div>`;
    for (let i = 0; i < forms.length; i++) {
      const f = forms[i];
      if (!f.name) continue;
      const on = b.capstones.size >= f.caps;
      right += `<div class="cb-row ${on ? "done" : ""}">
        <div class="cb-head"><span class="cb-ic">${f.icon}</span>
          <span class="cb-name">${f.name}</span>
          <span class="cb-status ${on ? "on" : ""}">${b.capstones.size}/${f.caps} capstones</span></div>
        <div class="cb-desc">${f.desc}</div></div>`;
    }

    right += `<div class="pause-head">Capstones</div>`;
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

/* Tetos do painel de build da tela de level-up. Sao TETOS DE LEITURA, nao de
   dados: o overlay nao rola, entao o que passa disso vira contador. Com quatro
   spells cada uma cabe inteira (icone, custo e uma linha por caminho); da
   quinta em diante a linha encolhe e so a trilha mais funda mostra pips. */
const PANEL = { fullRows: 4, slimRows: 8, chips: 6 };

/* Como cada stat vira texto no "antes -> depois" da linha de oferta.

   Existe porque o numero cru mente sobre a unidade: `duration: 6` e seis
   SEGUNDOS, `frac: 0.06` e seis POR CENTO e `radius: 440` nao tem sufixo
   nenhum. Stat sem entrada aqui simplesmente nao aparece no delta — melhor
   omitir a linha do que imprimir "limiar 0.35 → 0.5". `driver_cards` reprova
   mod que mexa em stat fora desta tabela, entao o silencio nao passa batido. */
const SF = {
  n:   (v) => "" + (Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v)),
  i:   (v) => "" + Math.round(v),
  s:   (v) => (Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v)) + "s",
  ps:  (v) => (Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v)) + "/s",
  pct: (v) => Math.round(v * 100) + "%",
  x:   (v) => (Math.round(v * 10) / 10) + "x",
};
const STAT_FMT = {
  // dano e cura
  damage:      { name: "dano", fmt: SF.n },
  dps:         { name: "dano", fmt: SF.ps },
  dotDps:      { name: "dano do DoT", fmt: SF.ps },
  impDamage:   { name: "dano do imp", fmt: SF.n },
  heal:        { name: "cura", fmt: SF.n },
  shield:      { name: "escudo", fmt: SF.n },
  drain:       { name: "dreno", fmt: SF.ps },
  executeMul:  { name: "execução", fmt: SF.x },
  crit:        { name: "crítico", fmt: SF.pct },
  amp:         { name: "amplificação", fmt: SF.pct },
  ramp:        { name: "crescimento", fmt: SF.pct },
  frac:        { name: "fração", fmt: SF.pct },
  threshold:   { name: "limiar de vida", fmt: SF.pct },
  // tempo
  cooldown:       { name: "recarga", fmt: SF.s },
  interval:       { name: "intervalo", fmt: SF.s },
  tickInterval:   { name: "tick", fmt: SF.s },
  attackInterval: { name: "ataque", fmt: SF.s },
  chargeTime:     { name: "carga", fmt: SF.s },
  duration:       { name: "duração", fmt: SF.s },
  dotTime:        { name: "duração do DoT", fmt: SF.s },
  impDuration:    { name: "duração do imp", fmt: SF.s },
  respawn:        { name: "renascer em", fmt: SF.s },
  spawnEvery:     { name: "invoca a cada", fmt: SF.s },
  markTime:       { name: "marca", fmt: SF.s },
  // espaco
  radius:      { name: "raio", fmt: SF.i },
  blast:       { name: "raio da explosão", fmt: SF.i },
  blastRadius: { name: "raio da explosão", fmt: SF.i },
  pullRadius:  { name: "raio da atração", fmt: SF.i },
  projRadius:  { name: "raio do projétil", fmt: SF.i },
  orbitRadius: { name: "raio da órbita", fmt: SF.i },
  checkRadius: { name: "raio de leitura", fmt: SF.i },
  range:       { name: "alcance", fmt: SF.i },
  portalRange: { name: "alcance do portal", fmt: SF.i },
  reach:       { name: "alcance", fmt: SF.i },
  distance:    { name: "distância", fmt: SF.i },
  jitter:      { name: "dispersão", fmt: SF.i },
  // movimento e empurrao
  speed:      { name: "velocidade", fmt: SF.i },
  speedMul:   { name: "velocidade", fmt: SF.pct },
  orbitSpeed: { name: "giro", fmt: SF.n },
  turnRate:   { name: "curva", fmt: SF.n },
  force:      { name: "empurrão", fmt: SF.i },
  pullForce:  { name: "força da atração", fmt: SF.i },
  factor:     { name: "velocidade do alvo", fmt: SF.pct },
  // contagens
  targets:    { name: "alvos", fmt: SF.i },
  maxTargets: { name: "alvos no máximo", fmt: SF.i },
  count:      { name: "quantidade", fmt: SF.i },
  drops:      { name: "quedas", fmt: SF.i },
  stacks:     { name: "acúmulos", fmt: SF.i },
  cap:        { name: "teto", fmt: SF.i },
  impCount:   { name: "imps", fmt: SF.i },
  revives:    { name: "renascimentos", fmt: SF.i },
  pierce:     { name: "perfuração", fmt: SF.i },
  cleave:     { name: "corte em arco", fmt: SF.i },
  charges:    { name: "cargas", fmt: SF.i },
  minEnemies: { name: "mínimo de alvos", fmt: SF.i },
  pct:        { name: "proporção", fmt: SF.pct },
};

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
