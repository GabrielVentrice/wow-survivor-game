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
      lvEyebrow: $("lvEyebrow"),
      milestone: $("milestone"), msRows: $("msRows"), msEyebrow: $("msEyebrow"),
      msPool: $("msPool"), msCap: $("msCap"), msClock: $("msClock"),
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

    /* Contagem para a proxima etapa. Marco que chega sem aviso nao estrutura
       ritmo nenhum: o valor de uma batida lenta esta em o jogador VER a
       decisao se aproximando e poder se preparar para ela. Perto do marco o
       elemento acende — e ai ele passa a dizer o eixo que a run tem hoje, que
       e o contexto da escolha que vem. */
    const left = g.nextMilestoneIn();
    if (left == null) e.msClock.classList.add("hidden");
    else {
      e.msClock.classList.remove("hidden");
      e.msClock.classList.toggle("soon", left <= BALANCE.milestones.warnAt);
      e.msClock.textContent = `◆ ${mmss(left)}`;
    }
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
    /* Bolo vazio: toda trilha fechada e toda passiva tomada. Nao ha o que
       oferecer, entao o nivel vira cura em vez de sumir em silencio — subir de
       nivel e nao receber nada e o jogo cobrando atencao e devolvendo vazio. */
    if (!offers.length) {
      g.player.pendingLevels = 0;
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + g.player.maxHp * 0.35);
      this.toast({ head: "Arsenal completo", color: "#7fdc4a", icon: "✚",
        name: "Nada mais a aprender",
        desc: "Todo caminho fechado — o nível virou fôlego." });
      g.state = STATE.PLAYING;
      return;
    }

    /* O nivel que ESTA escolha paga. Com varios niveis na fila o jogador
       escolhe uma vez por nivel, entao o rotulo anda com a fila em vez de
       repetir o nivel ja alcancado tres vezes seguidas. */
    const lv = g.player.level - g.player.pendingLevels;
    this.el.lvEyebrow.textContent = `Nível ${lv} → ${lv + 1}`;

    this.lvOffers = offers;
    this.lvViews = offers.map((o) => this.offerView(o));
    this.lvHover = -1;
    this.el.lvRows.innerHTML = "";
    for (let i = 0; i < offers.length; i++) {
      const v = this.lvViews[i];
      const row = document.createElement("div");
      row.className = "lv-card";
      row.style.setProperty("--acc", v.color);
      row.style.setProperty("--acc-dim", v.color + "55");
      row.style.setProperty("--acc-wash", v.color + "1c");
      row.innerHTML = this.cardHtml(v);
      row.onclick = () => this.applyOffer(offers[i]);
      // O hover so re-renderiza o PAINEL: mexer nas linhas mataria a transicao
      // de `transform` que o CSS esta rodando naquele instante.
      row.onmouseenter = () => this.lvHoverTo(i);
      row.onmouseleave = () => this.lvHoverTo(-1);
      this.el.lvRows.appendChild(row);
    }
    this.el.lvBuild.innerHTML = this.buildStripHtml(-1);
    this.el.levelup.classList.remove("hidden");
  }

  lvHoverTo(i) {
    if (this.lvHover === i) return;
    this.lvHover = i;
    this.el.lvBuild.innerHTML = this.buildStripHtml(i);
  }

  /* Tudo o que a linha mostra, derivado do que a oferta ja carrega. Roda uma
     vez por oferta (nao por hover): o resultado fica em `this.lvViews`.

     A terceira coluna era CUSTO e virou PROGRESSO. O level up nao gasta mais
     nada — a pergunta que ele faz e "qual das minhas spells vira a spell da
     run?", e o que responde isso e onde cada trilha esta, nao um preco que
     agora e sempre zero. Coluna de custo com "não gasta ponto" em todas as
     tres linhas seria um terco da tela dizendo a mesma coisa. */
  offerView(o) {
    const axis = o.axis || null;
    const v = {
      color: axis ? axis.color : o.def.color,
      axis, pips: null, delta: [], rec: "",
    };

    if (o.kind === "passive") {
      v.kind = "Passiva";
      v.glyph = "✦";
      v.round = true;       // circulo: a mesma forma que a passiva tem no HUD
      v.icon = o.def.icon;
      v.name = o.def.name;
      v.subtitle = "não dispara · afeta a build inteira";
      v.plain = o.def.desc;
      /* `why` so aparece quando ACRESCENTA. Na linha ele carregava sempre o
         que a spell e, porque a coluna existia de qualquer jeito; numa carta o
         nome esta logo acima e repetir a identidade e ruido. Sobra o caso em
         que ha um aviso de verdade: passiva exclusiva fecha uma porta, e essa
         e uma consequencia que a carta nao mostra em lugar nenhum. */
      v.why = o.def.exclusive
        ? `Fecha a porta de ${PASSIVES[o.def.exclusive].name} — a build tem que optar.`
        : "";
      v.progHead = "Vale para a build inteira";
    } else {
      const evo = o.isEvo && o.evo ? o.evo : null;
      /* Evolucao ganha etiqueta propria em vez de "Melhoria · evolução": ela
         nao e um degrau a mais, e conversao — a peca troca de nome, arte,
         trigger e efeitos. Chamar as duas coisas de melhoria some com o
         climax justamente na linha em que ele acontece. */
      v.kind = evo ? "Evolução" : "Melhoria";
      v.glyph = evo ? "⭐" : "▲";
      // O icone de uma melhoria e o de uma spell que voce JA tem: sem o selo
      // ele e indistinguivel do icone de uma spell que voce nao tem.
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
      /* So a evolucao ganha `why`, e por um motivo: ali a peca troca de
         identidade inteira (nome, arte, trigger, efeitos), entao o que ela
         PASSA A SER e informacao nova. Numa melhoria comum o nome da spell esta
         logo acima e repetir o `desc` dela seria encher a carta com o que o
         jogador ja sabe. */
      v.why = evo ? evo.desc : "";
      v.delta = this.tierDelta(o);
      v.pips = o.tierIndex + 1;
      /* Veredito primeiro, detalhe depois — a mesma hierarquia que o custo
         tinha. O veredito e quao fundo esta compra deixa a trilha; o detalhe e
         qual trilha, porque uma spell tem tres e elas nao se misturam. */
      /* Veredito, nao coordenada: o subtitulo ja diz "caminho · tier N de 5".
         Aqui vai o que aquilo SIGNIFICA para a compra. */
      const falta = PATH_RULES.tiers - (o.tierIndex + 1);
      v.progHead = falta === 0 ? "Fecha o caminho"
        : falta === 1 ? "A um tier do fim"
        : `Tier ${o.tierIndex + 1} de ${PATH_RULES.tiers}`;
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

  /* O chip verde so aparece quando a oferta muda a corrida por um MARCO. Sem
     gancho real ele nao aparece: recomendacao decorativa vira ruido e o
     jogador para de ler o chip que importa.

     No level up sobrou UM gancho, e ele e o certo: fechar um caminho acende a
     aura da spell em volta do warlock. O gancho de capstone saiu junto com o
     custo — capstone e assunto de etapa agora, e apontar para ele numa tela
     que nao entrega ponto de eixo seria apontar para uma porta que esta na
     outra sala. */
  recFor(o, v) {
    const b = this.game.build;
    if (o.kind === "path" && o.tierIndex + 1 === PATH_RULES.tiers && !b.isComplete(o.inst)) {
      return "acende a aura";
    }
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

  /* Uma CARTA por oferta, em coluna. A tela nasceu em linhas porque comparava
     tres coisas diferentes (spell nova / melhoria / passiva) e o olho precisava
     correr um campo de cada vez na vertical. Depois que peca nova saiu para as
     etapas, as tres ofertas viraram a mesma coisa — um degrau numa spell que
     voce ja tem — e as colunas de "o que e / o que muda / onde chega" passaram
     a repartir uma informacao que ja era homogenea. Grade de tres colunas para
     comparar campos que nao divergem mais e so moldura.

     A hierarquia interna nao mudou, e ela e a regra que sobrevive a qualquer
     forma: `.lv-plain` — o que muda no jogo — e o item mais claro da carta,
     acima do nome da spell, do icone e do botao. Numa carta o nome vem antes
     no espaco, entao ele tem que perder no TAMANHO, senao a leitura pousa no
     rotulo em vez de no efeito. */
  cardHtml(v) {
    let delta = "";
    for (const d of v.delta) {
      delta += `<div class="lv-delta"><span class="was">${d[0]}</span>` +
               `<span class="arrow">→</span><span class="now">${d[1]}</span></div>`;
    }
    return `
      <div class="lv-kind"><i>${v.glyph}</i>${v.kind}</div>
      <div class="lv-what">
        <div class="lv-tile${v.round ? " round" : ""}">${v.icon}${
          v.badge ? `<b>${v.badge}</b>` : ""}</div>
        <div class="lv-what-txt">
          <div class="lv-name">${v.name}</div>
          <div class="lv-subtitle">${v.subtitle}</div>
        </div>
      </div>
      <div class="lv-change">
        <div class="lv-plain">${v.plain}</div>
        ${delta}
        ${v.why ? `<div class="lv-why">${v.why}</div>` : ""}
      </div>
      <div class="lv-foot-card">
        <div class="lv-prog-line">
          <span class="lv-prog-head">${v.progHead}</span>
          ${v.pips != null ? this.pipsHtml(v.pips) : ""}
        </div>
        ${v.rec ? `<div class="lv-rec">${v.rec}</div>` : ""}
        <div class="lv-pick">Escolher</div>
      </div>`;
  }

  pipsHtml(n) {
    let s = `<span class="lv-pips">`;
    for (let i = 0; i < PATH_RULES.tiers; i++) s += `<i class="${i < n ? "on" : ""}"></i>`;
    return s + `</span>`;
  }

  /* As tres barras de eixo, compartilhadas pelo painel do level up e pela tela
     de etapa. `axisId`/`add` desenham a PREVIA do ganho: a barra fantasma
     mostra onde o eixo chegaria, e o numero vira "4 → 7".

     Uma funcao so para os dois porque a barra e a mesma pergunta nos dois
     lugares — quanto falta para o capstone. Duas copias divergiriam na
     primeira vez que o teto por eixo mudasse. */
  axesHtml(axisId, add) {
    const b = this.game.build;
    const pct = (n) => Math.min(100, n / AXIS_RULES.capPerAxis * 100);
    let out = "";
    for (const id in AXES) {
      const a = AXES[id], val = b.axis[id];
      const gain = id === axisId ? (add || 0) : 0;
      out += `<div class="lv-ax" style="--acc:${a.color}">
        <div class="lv-ax-head">
          <span class="lv-ax-ic">${a.icon}</span>
          <span class="lv-ax-name">${a.name}</span>
          <span class="lv-ax-num ${gain ? "lit" : ""}">${
            gain ? `${val} → ${val + gain}` : val} / ${AXIS_RULES.capPerAxis}</span>
        </div>
        <div class="lv-ax-track">
          <i class="ghost" style="width:${pct(val + gain)}%"></i>
          <i style="width:${pct(val)}%"></i>
        </div></div>`;
    }
    return out;
  }

  /* A build de agora, em UMA TIRA. Era um painel lateral de 316px com densidade
     automatica, teto de linhas, contador de excedente, chips de passiva, tres
     barras de eixo e a linha do capstone — metade daquilo existia para caber
     numa coluna estreita, e a outra metade respondia perguntas que esta tela
     nao faz mais.

     Os eixos e o capstone saem daqui de vez: nenhuma oferta de level up os
     move, e a tela de ETAPA — que e onde eles mudam — ja os mostra com previa
     ao vivo. Repetir aqui era mostrar um numero parado ao lado de tres cartas
     que nao o tocam.

     O que sobra e a unica pergunta que a tira responde, e ela e a pergunta
     desta tela: em que degrau estao as minhas outras spells? Icone, pips do
     caminho mais fundo, e destaque em quem a carta sob o mouse melhora. */
  buildStripHtml(hoverIdx) {
    const b = this.game.build;
    const o = hoverIdx >= 0 && this.lvOffers ? this.lvOffers[hoverIdx] : null;
    const alvo = o && o.kind === "path" ? o.inst.key : null;

    const rows = [];
    for (const inst of b.pieces.values()) {
      let top = 0, nome = "";
      for (const pid in inst.paths) {
        if (inst.paths[pid] > top) { top = inst.paths[pid]; nome = inst.def.paths[pid].name; }
      }
      rows.push({ def: inst.def, top, nome, hit: inst.key === alvo, done: b.isComplete(inst) });
    }
    // A spell afetada vai para a frente: numa tira ela nunca pode cair no "+N".
    rows.sort((a, z) => (z.hit ? 1 : 0) - (a.hit ? 1 : 0));

    const teto = STRIP.spells;
    let list = "";
    for (let i = 0; i < rows.length && i < teto; i++) {
      const r = rows[i], c = r.def.color;
      list += `<div class="lv-sp${r.hit ? " hit" : ""}${r.done ? " done" : ""}"
        style="--acc:${c};--acc-dim:${c}55" title="${r.def.name}${
        r.nome ? ` — ${r.nome} tier ${r.top}` : ""}">
        <span class="lv-sp-ic">${r.def.icon}</span>
        <span class="lv-sp-name">${r.def.name}</span>
        ${this.pipsHtml(r.top)}</div>`;
    }
    if (rows.length > teto) {
      list += `<div class="lv-sp more">+${rows.length - teto}</div>`;
    }

    let chips = "";
    let np = 0;
    for (const id of b.passives.keys()) {
      if (np >= STRIP.chips) break;
      const p = PASSIVES[id];
      chips += `<span class="lv-chip" style="--acc-dim:${p.color}55;--acc-wash:${p.color}16"
        title="${p.name}: ${p.desc}"><i>${p.icon}</i></span>`;
      np++;
    }
    if (b.passives.size > np) chips += `<span class="lv-chip more">+${b.passives.size - np}</span>`;

    return `<span class="lv-strip-lbl">Sua build</span>
      <div class="lv-strip-list">${list}</div>
      ${chips ? `<div class="lv-strip-chips">${chips}</div>` : ""}`;
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

  /* --- etapa ---------------------------------------------------------------
     A BATIDA LENTA. Tres linhas, o eixo aberto sempre entre elas, e a unica
     fonte de ponto de eixo do jogo.

     Ela e o oposto da tela de level up de proposito, e as duas ja trocaram de
     forma uma vez: o que decide a forma nao e a tela, e o que ela compara. As
     tres ofertas daqui tem a MESMA estrutura preenchida com eixos diferentes —
     um rotulo, uma spell, um numero (ou dois) —, e estrutura repetida e o caso
     da LINHA com colunas fixas: o numero de cada oferta cai sempre na terceira
     coluna, entao comparar e correr o olho por uma coluna so.

     Aqui o custo volta, e ele e o unico do jogo: a oferta que traz spell nova
     entrega um ponto a MENOS que a seca do mesmo eixo. Largura nao gasta o
     pool, ela desacelera o pool — e essa e a unica decisao da run que nao se
     desfaz depois. */

  openMilestone() {
    const g = this.game;
    /* Pool cheio: nao ha mais ponto para dar, entao a tela nao tem pergunta a
       fazer. Some em silencio em vez de abrir vazia — pela tabela isso so
       acontece se um marco escapar depois do ultimo. */
    if (g.build.axisLeft <= 0) {
      g.pendingMilestones = 0;
      g.state = STATE.PLAYING;
      return;
    }
    g.state = STATE.MILESTONE;
    g.sfx.levelUp();
    g.addShake(10);

    const idx = Math.max(0, g.milestoneIdx - g.pendingMilestones);
    const offers = g.build.getMilestoneOffers();
    if (!offers.length) {
      g.pendingMilestones = 0;
      g.state = STATE.PLAYING;
      return;
    }
    this.msOffers = offers;
    this.msHover = null;

    /* Sem denominador: as etapas nao acabam numa contagem, acabam quando a pool
       acaba. Dizer "de 7" mentiria justo para quem mais precisa saber que ainda
       vem mais — o jogador que levou spell toda vez e esta atrasado na pool. */
    const falta = g.build.axisLeft;
    this.el.msEyebrow.textContent = `Etapa ${idx + 1} · ${mmss(g.milestoneTimeAt(idx))} · ` +
      `${falta} ponto${falta === 1 ? "" : "s"} de eixo por gastar`;

    this.el.msRows.innerHTML = "";
    for (let i = 0; i < offers.length; i++) {
      const o = offers[i];
      const row = document.createElement("div");
      row.className = "ms-row";
      row.style.setProperty("--acc", o.axis.color);
      row.style.setProperty("--acc-dim", o.axis.color + "55");
      row.style.setProperty("--acc-wash", o.axis.color + "1c");
      row.innerHTML = this.msRowHtml(o);
      /* O ALVO e o botao, nao o bloco: o bloco e um eixo e o eixo tem duas
         maneiras de ser levado. Bloco inteiro clicavel precisaria de um padrao
         escolhido por nos, e escolher pelo jogador a metade irreversivel da
         decisao e o oposto do que esta tela existe para fazer. */
      const btns = row.querySelectorAll(".ms-take");
      for (const btn of btns) {
        const wet = btn.dataset.wet === "1";
        btn.onclick = (ev) => { ev.stopPropagation(); this.applyMilestone(o, wet); };
        btn.onmouseenter = () => this.msHoverTo(o, wet);
        btn.onmouseleave = () => this.msHoverTo(null, false);
      }
      this.el.msRows.appendChild(row);
    }
    this.msRender(null, false);
    this.el.milestone.classList.remove("hidden");
  }

  msHoverTo(o, wet) {
    const tag = o ? o.axisId + (wet ? "+" : "") : null;
    if (this.msHover === tag) return;
    this.msHover = tag;
    this.msRender(o, wet);
  }

  /* Como no level up, o hover re-renderiza so o RODAPE: mexer nas colunas
     mataria a transicao que o CSS esta rodando naquele instante. */
  msRender(o, wet) {
    const step = !o ? null : ((wet ? o.wet : o.dry) || o.wet || o.dry);
    this.el.msPool.innerHTML = this.axesHtml(o ? o.axisId : null, step ? step.gain : 0);
    this.el.msCap.innerHTML = this.capLineHtml(o, step);
  }

  /* O alvo, com previa. Capstone e a unica coisa que os pontos de eixo compram
     a longo prazo, entao a tela que os entrega tem que dizer onde eles levam —
     senao alocar e uma decisao de rota longa com feedback so no fim da run. */
  capLineHtml(o, step) {
    const before = this.nearestCapstone();
    const after = step && step.gain
      ? this.nearestCapstone(o.axisId, step.gain)
      : before;
    if (!after) {
      return `<div class="ms-cap none">Nenhum capstone cabe mais no pool restante.</div>`;
    }
    if (!after.missing) {
      return `<div class="ms-cap open">${after.cap.icon}
        <b style="color:${after.cap.color}">${after.cap.name}</b> abre agora.</div>`;
    }
    const falta = after.gaps.map((x) => `${x.need} de ${x.axis.name}`).join(" e ");
    const closer = before && after.missing < before.missing;
    return `<div class="ms-cap${closer ? " closer" : ""}">${after.cap.icon}
      <b style="color:${after.cap.color}">${after.cap.name}</b> a ${falta}${
      closer ? ` <i>— ${before.missing} antes desta linha</i>` : ""}</div>`;
  }

  msRowHtml(o) {
    const b = this.game.build, cur = b.axis[o.axisId];
    const M = BALANCE.milestones;

    /* Os botoes carregam o numero REAL. Com o eixo no teto ou o pool no fim,
       `addAxis` entrega menos do que a tabela promete — e esta e a unica tela
       do jogo cujo numero nao pode ser desfeito, entao ela e a ultima que pode
       arredondar a verdade. */
    const take = (step, wet, label, note) => {
      if (!step) return "";
      const dead = step.gain <= 0;
      return `<button class="ms-take${wet ? " wet" : ""}${dead ? " dead" : ""}" data-wet="${wet ? 1 : 0}">
        <span class="ms-take-l">${label}</span>
        <span class="ms-take-n">${dead ? "+0" : "+" + step.gain}</span>
        <span class="ms-take-s">${dead
          ? (cur >= AXIS_RULES.capPerAxis ? "eixo no teto" : "pool no fim")
          : `${o.axis.name} ${cur} → ${cur + step.gain}` + (note ? ` · ${note}` : "")}</span>
      </button>`;
    };

    const spell = o.piece
      ? `<div class="ms-spell">
          <span class="ms-spell-ic">${o.piece.icon}</span>
          <span class="ms-spell-txt">
            <span class="ms-spell-kind"><i>◈</i>Spell nova</span>
            <span class="ms-spell-name">${o.piece.name}</span>
            <span class="ms-spell-desc">${o.piece.desc}</span>
          </span></div>`
      : `<div class="ms-spell empty">
          <span class="ms-spell-txt">
            <span class="ms-spell-name">Nada novo neste eixo</span>
            <span class="ms-spell-desc">Todas as spells de ${o.axis.name} já estão na build.</span>
          </span></div>`;

    /* Duas formas de bloco, e a diferenca e o que cada uma esta perguntando.

       ABERTA (eixo em `unlockAt`+): a manchete e o EIXO, porque a pergunta e
       quanto investir nele — a spell e uma das duas maneiras de levar, nao o
       assunto. Ela ganha o cabecalho de eixo e os dois botoes.

       SORTEADA: a manchete e a SPELL, porque e ela que esta sendo escolhida; o
       eixo aparece no botao como consequencia (+1 em Corrupcao). Por o eixo no
       topo aqui seria anunciar como titulo algo que o jogador nao escolheu — o
       sorteio e que pos aquele eixo ali.

       Nas duas, o meio do bloco e o BUFF: a mesma caixa acesa, porque o que a
       spell FAZ e a coisa que a tela existe para o jogador ler antes de gastar
       o unico ponto que nao volta. */
    if (!o.locked) {
      return `
        <div class="ms-head loose">
          <span class="ms-ic">${o.piece.icon}</span>
          <span class="ms-axis">${o.piece.name}</span>
          <span class="ms-tag" style="color:${o.axis.color}">${o.axis.icon} ${o.axis.name}</span>
        </div>
        <div class="ms-spell"><span class="ms-spell-txt">
          <span class="ms-spell-desc">${o.piece.desc}</span></span></div>
        <div class="ms-takes">
          ${take(o.wet, true, "Levar esta spell", "")}
        </div>`;
    }

    return `
      <div class="ms-head">
        <span class="ms-ic">${o.axis.icon}</span>
        <span class="ms-axis">${o.axis.name}</span>
        <span class="ms-open" title="Eixo com ${M.unlockAt}+ pontos: nunca mais sai da mesa">aberto</span>
        <span class="ms-tag">${o.axis.tag}</span>
      </div>
      ${spell}
      <div class="ms-takes">
        ${take(o.dry, false, "Só o eixo", "")}
        ${take(o.wet, true, "Com a spell", `−${M.axisPoints - M.spellPoints} pelo arsenal`)}
      </div>`;
  }

  applyMilestone(o, takePiece) {
    const g = this.game;
    const res = g.build.applyMilestone(o, takePiece);

    if (res.piece) {
      this.toast({ head: "Spell nova!", color: res.piece.color, icon: res.piece.icon,
        name: res.piece.name, desc: res.piece.desc });
    }
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

    g.pendingMilestones--;
    this.el.milestone.classList.add("hidden");
    if (g.pendingMilestones > 0) this.openMilestone();
    else if (g.player.pendingLevels > 0) this.openLevelUp();
    else g.state = STATE.PLAYING;
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

/* Tetos da TIRA de build da tela de level-up. Sao TETOS DE LEITURA, nao de
   dados: o overlay nao rola e a tira e uma linha so, entao o que passa disso
   vira contador. Substituiram os tetos do painel lateral, que tinha densidade
   automatica e duas alturas de linha — complexidade que existia para caber numa
   coluna de 316px que nao existe mais. */
const STRIP = { spells: 8, chips: 6 };

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
