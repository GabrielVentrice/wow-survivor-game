"use strict";
/* =========================================================================
   UI — canvas desenha o mundo, DOM desenha a interface.

   Tudo aqui e HTML sobre o canvas, escondido/mostrado pela classe .hidden.
   Elemento novo de UI = markup no index.html + ref em this.el.

   A identidade e "osso gravado em obsidiana": a interface e uma placa dura,
   sem brilho e sem cor propria, e a unica cor saturada em tela pertence a
   build do jogador. As cinco regras que governam cada linha daqui estao no
   topo do <style> do index.html; as duas que mais aparecem neste arquivo:

   - COR E PREDICADO. Verde/roxo/laranja so entram quando aquele pixel esta
     falando de Corrupcao, Dominio ou Cataclismo — e a cor vem de `eixoVars`,
     nunca de um hex escrito a mao e nunca de `def.color`, que e a cor do
     MUNDO. Passiva e global: ela nao tem eixo, entao ela e osso.
   - ICONE SAI DO GERADOR DO MUNDO. Nenhum emoji: `Glyph.svg` devolve o sprite
     do demonio em osso monocromatico, ou uma das dez primitivas.
   ========================================================================= */

class UI {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $("hud"), menu: $("menu"), timer: $("timer"), hudCtx: $("hudCtx"),
      hpFill: $("hpFill"), xpFill: $("xpFill"), shieldFill: $("shieldFill"),
      hpLabel: $("hpLabel"), xpLabel: $("xpLabel"),
      pieceBar: $("pieceBar"), axisBar: $("axisBar"), toasts: $("toasts"),
      combo: $("combo"), comboNum: $("comboNum"), comboFuse: $("comboFuse"),
      levelup: $("levelup"), lvRows: $("lvRows"), lvBuild: $("lvBuild"),
      lvEyebrow: $("lvEyebrow"), lvClock: $("lvClock"),
      milestone: $("milestone"), msRows: $("msRows"), msEyebrow: $("msEyebrow"),
      msSub: $("msSub"), msPool: $("msPool"), msCap: $("msCap"),
      starter: $("starter"), stRows: $("stRows"), stEyebrow: $("stEyebrow"),
      stSub: $("stSub"), stPool: $("stPool"), stPacto: $("stPacto"),
      pause: $("pause"), pausePanel: $("pauseBody"),
      pausePieces: $("pausePieces"), pauseAxes: $("pauseAxes"), pauseDmg: $("pauseDmg"),
      pauseMeta: $("pauseMeta"), pauseCount: $("pauseCount"),
      pausePool: $("pausePool"), pauseDmgTot: $("pauseDmgTot"),
      chest: $("chest"), chestList: $("chestList"), chestRarity: $("chestRarity"),
      chestPips: $("chestPips"), chestCount: $("chestCount"),
      gameover: $("gameover"), goNums: $("goNums"), goDmg: $("goDmg"),
      goLine: $("goLine"), goExtra: $("goExtra"),
      classGrid: $("classGrid"), startBtn: $("startBtn"),
      lbPanel: $("lbPanel"), lbRows: $("lbRows"), lbEstado: $("lbEstado"),
      lbNome: $("lbNome"), startDica: $("startDica"), goPlacar: $("goPlacar"),
      versao: $("menuVersao"), changelog: $("changelog"),
      logNav: $("logNav"), logNotes: $("logNotes"), logCount: $("logCount"),
    };
    $("restartBtn").onclick = () => this.game.start();
    $("goMenuBtn").onclick = () => this.game.quitToMenu();
    $("chestBtn").onclick = () => this.closeChest();
    $("resumeBtn").onclick = () => this.game.resume();
    $("pauseRestartBtn").onclick = () => this.game.start();
    $("quitBtn").onclick = () => this.game.quitToMenu();

    this.mountBoard();
    this.mountVersao();

    /* Toast e fila, nao pilha livre: o teto de tres e o que separa "o jogo me
       avisou" de "o jogo despejou". `toastCount` conta os eventos ANUNCIADOS,
       nao os nos vivos no DOM — quem pergunta "isso avisou alguma coisa?"
       precisa da resposta mesmo quando o quarto evento virou contador. */
    this.live = [];
    this.toastCount = 0;

    /* O ultimo estado escrito na cadeia. `updateCombo` roda a 60fps e o numero
       so muda quando um corpo cai: sem isto ela reescreveria o mesmo
       `textContent` e a mesma variavel de tamanho todo frame. */
    this.comboShown = -1;
    this.comboTierShown = -1;

    /* The version notes. The state is a boolean and an index, and it lives
       here instead of in the DOM class: what asks "is it open?" is the ESC key,
       and reading a class back off the element just to answer that would be
       asking the DOM for a fact the UI already knows. */
    this.logOpen = false;
    this.logIdx = 0;
  }

  /* As tres variaveis de cor de um eixo, escritas inline no elemento. E o
     unico lugar do arquivo que decide cor: se um dia a paleta mudar, ela muda
     aqui e no :root, e nao em quarenta interpolacoes.

     `null` devolve OSSO — e o caso da passiva, que e global e nao pertence a
     build nenhuma, e o do que ainda nao tem eixo. */
  eixoVars(axisId) {
    if (!axisId || !UI_PAL.eixo[axisId]) {
      return `--eixo:${UI_PAL.osso};--eixo-300:${UI_PAL.osso};--eixo-900:${UI_PAL.obs}`;
    }
    return `--eixo:${UI_PAL.eixo[axisId]};--eixo-300:${UI_PAL.brasa[axisId]};` +
           `--eixo-900:${UI_PAL.cravado[axisId]}`;
  }

  /* --- menu ----------------------------------------------------------------
     As duas cartas de classe trancada sairam: ocupavam dois tercos da selecao
     anunciando o que o jogo nao tem. Quando o Mago existir, ele ganha uma
     placa igual — e a de agora ja e essa placa. */

  buildMenu() {
    const g = this.game;
    let html = "";
    const livres = Object.keys(CLASSES).filter((id) => CLASSES[id].available);
    for (const id of livres) {
      const c = CLASSES[id];
      /* O glifo sai de `cls.glyph`. Estava cravado em "warlock", entao toda
         classe nova nasceria com a placa desenhando um warlock — e a etiqueta
         dizia "Única" mesmo quando deixasse de ser verdade. */
      html += `<div class="classe livre ${id === g.selectedClass ? "sel" : ""}" data-cls="${id}">
        <span class="gl-box" style="width:72px;height:72px">${Glyph.svg(c.glyph || id, 46)}</span>
        <span class="classe-txt">
          <span class="classe-nome">${c.name}</span>
          <span class="rotulo">${c.tag}</span>
        </span>
        ${livres.length === 1 ? `<span class="tag tag-raro">Única</span>` : ""}</div>`;
    }
    this.el.classGrid.innerHTML = html;
    for (const card of this.el.classGrid.children) {
      const id = card.dataset.cls;
      card.onclick = () => {
        g.selectedClass = id;
        for (const c of this.el.classGrid.children) c.classList.remove("sel");
        card.classList.add("sel");
      };
    }
    /* Sem nome o botao nao inicia — e ele FOCA o campo em vez de nao fazer
       nada. Botao morto que nao explica o que falta e a mesma tela cobrando
       atencao e devolvendo vazio que o nivel sem oferta ja conserta. */
    this.el.startBtn.onclick = () => {
      if (!Leaderboard.temNome()) { this.el.lbNome.focus(); return; }
      g.start();
    };
  }

  onStart() {
    this.closeChangelog();
    this.el.menu.classList.add("hidden");
    this.el.gameover.classList.add("hidden");
    this.el.levelup.classList.add("hidden");
    this.el.milestone.classList.add("hidden");
    this.el.starter.classList.add("hidden");
    this.el.chest.classList.add("hidden");
    this.el.pause.classList.add("hidden");
    this.el.hud.classList.remove("hidden");
    this.live.length = 0;
    this.el.toasts.innerHTML = "";
    this.comboShown = 0;
    this.comboTierShown = -1;
    this.el.combo.classList.add("hidden");
    this.updatePieceBar();
  }

  toMenu() {
    this.loadBoard();
    this.syncStart();
    this.focaNome();
    this.el.pause.classList.add("hidden");
    this.el.gameover.classList.add("hidden");
    this.el.starter.classList.add("hidden");
    this.el.hud.classList.add("hidden");
    this.el.menu.classList.remove("hidden");
  }

  /* --- HUD (9.4) -----------------------------------------------------------
     Cinco lugares, margem de 24 em todos, nada no meio. O medidor de dano por
     peca NAO mora mais aqui: dano acumulado e informacao de pos-run, ninguem
     corrige a jogada com ela. Ela e a estrela da Pausa e do Game over, e o HUD
     perde um canto disputado.

     O relogio tambem perdeu a terceira linha e as tres cores. Etapa e abates
     nao sao estados de eixo, entao nao podem falar em cor de eixo — viraram
     uma linha so, de contexto, em osso. */

  updateHUD() {
    const g = this.game, p = g.player, e = this.el;
    e.timer.textContent = mmss(g.elapsed);
    e.timer.classList.toggle("hard", g.elapsed >= BALANCE.spawn.hardAt);

    /* Marco que chega sem aviso nao estrutura ritmo nenhum: o valor de uma
       batida lenta esta em VER a decisao se aproximando. Perto dela a linha
       acende — em osso, que e o unico jeito de acender sem mentir sobre eixo.

       O que falta e contado em CORPOS, nao em segundos, porque e matar que paga
       o marco: um relogio ali diria ao jogador para esperar, e esperar nao e a
       jogada. E o limiar do aviso e fracao do marco atual, senao ele seria meio
       minuto de antecedencia no primeiro e nenhum no decimo. */
    const left = g.nextMilestoneIn();
    e.hudCtx.textContent = left == null
      ? `${fmtNum(p.kills)} abates`
      : `Etapa em ${fmtNum(left)} abates · ${fmtNum(p.kills)} no total`;
    e.hudCtx.classList.toggle("soon",
      left != null && left <= g.milestoneSpan() * BALANCE.milestones.warnAt);

    const hp = Math.max(0, p.hp);
    e.hpFill.style.width = (hp / p.maxHp * 100) + "%";
    /* O outro consumidor de `lowHpPulse`. A barra nao muda de lugar nem de
       tamanho: ela desbota, no MESMO compasso em que a vinheta fecha em
       vermelho no canvas. Uma classe com `@keyframes` seria mais barata e nao
       ficaria em fase com o mundo — e o que faz os dois lerem como um evento
       so e serem a mesma curva, nao dois relogios com a mesma duracao.

       `opacity`, nunca cor nem largura: opacidade nao refaz layout, e a
       largura ja esta dizendo outra coisa (quanta vida sobrou). */
    e.hpFill.style.opacity = 1 - 0.38 * g.lowHpPulse();
    const lim = p.maxShield > 0 ? p.maxShield : p.maxHp;
    e.shieldFill.style.width = (Math.min(1, p.shield / lim) * 100) + "%";
    e.hpLabel.textContent = p.shield > 0
      ? `${Math.ceil(hp)} / ${p.maxHp} (+${Math.ceil(p.shield)})`
      : `${Math.ceil(hp)} / ${p.maxHp}`;
    e.xpFill.style.width = (p.xp / p.xpToNext * 100) + "%";
    e.xpLabel.textContent = "Nível " + p.level;

    this.updateCombo();
  }

  /* A CADEIA — o numero grande da esquerda.

     Ela e a leitura em numero do que a ceifa desenha em anel, e as duas dizem
     a mesma coisa por caminhos diferentes: a ceifa e um evento no chao, que
     acontece e passa; a cadeia e um ESTADO, e estado se desenha enquanto dura
     — a mesma regra que separa a casca do escudo de um vfx de escudo.

     Em osso e nao na cor da build (que e o que a ceifa usa) porque isto e UI:
     cor e predicado de eixo, e uma cadeia nao fala de eixo nenhum.

     O salto e escrito em `transform`, nao em `font-size`: mudar a fonte
     reposiciona o texto e obriga o browser a refazer o layout do HUD inteiro
     sessenta vezes por segundo. O tamanho por degrau muda, mas so quando o
     degrau muda. */
  updateCombo() {
    const g = this.game, C = BALANCE.combo, e = this.el;
    const n = g.comboCount >= C.min ? g.comboCount : 0;
    if (!n && !this.comboShown) return;      // fora de cadeia nao custa nada

    if (n !== this.comboShown) {
      if (!n || !this.comboShown) e.combo.classList.toggle("hidden", !n);
      if (n) e.comboNum.textContent = n;
      this.comboShown = n;
    }
    if (!n) { this.comboTierShown = -1; return; }

    const t = g.comboTier();
    if (t !== this.comboTierShown) {
      e.combo.style.setProperty("--combo-sz", C.size[t] + "px");
      this.comboTierShown = t;
    }
    // o numero SALTA e volta; o degrau so decide quanto
    const s = 1 + g.comboPulse() * C.swell[t];
    e.comboNum.style.transform = s > 1.001 ? `scale(${s.toFixed(3)})` : "";
    // o pavio: quanto falta da janela de um segundo
    const left = Math.max(0, (g.comboUntil - g.clock) / C.window);
    e.comboFuse.style.width = (left * 100).toFixed(1) + "%";
  }

  /* Barras de eixo, no canto OPOSTO ao da tira de pecas. Elas viviam empilhadas
     debaixo dela — dois widgets disputando o mesmo canto, e nenhum dos dois
     legivel de relance. Eixo com 0 ponto fica em osso com o quadrado VAZADO:
     cor e para o que existe. */
  updateAxisBar() {
    const b = this.game.build;
    let html = "";
    for (const id of b.axes) {
      const a = AXES[id], v = b.axis[id];
      /* Eixo SELADO nao pode ler como eixo em que nao investi: o primeiro
         ainda e uma escolha, o segundo saiu da run. O que separa e a tarja e o
         `—` no lugar do numero — o `0/15` de um eixo selado seria uma promessa
         de que ele ainda pode crescer. */
      const selado = b.axisSealed(id);
      html += `<div class="hud-ax${selado ? " selado" : ""}" style="${this.eixoVars(id)}"` +
        ` title="${a.name} — ${selado ? "selado pelo pacto: a run já tem dois eixos" : a.tag}">
        <b class="${v ? "" : "vazio"}"></b>
        <div class="barra"><i style="width:${v / AXIS_RULES.capPerAxis * 100}%"></i></div>
        <span>${selado ? "—" : v + "/" + AXIS_RULES.capPerAxis}</span></div>`;
    }
    const left = b.axisLeft;
    html += `<div class="hud-pool rotulo dim">${b.axisTotal} gastos · ${left} por gastar</div>`;
    this.el.axisBar.innerHTML = html;
  }

  /* A tira de pecas: glifo de 56 e os pips do estado da build embaixo. O que
     passa do teto vira UM tile contador — o HUD nao rola e a tira nao pode
     virar duas fileiras cobrindo meia tela. */
  updatePieceBar() {
    const b = this.game.build;
    let html = "", n = 0;
    for (const inst of b.pieces.values()) {
      if (n >= STRIP.hud) break;
      n++;
      const d = inst.def;
      /* Os pips contam o caminho MAIS FUNDO, os cinco degraus, como em toda
         outra tela. Antes eram tres — um por caminho, aceso acima do tier
         gratuito —, e isso responde "tem caminho investido?" quando a pergunta
         que a tira faz e "quao fundo esta a minha build?". */
      let top = 0;
      for (const pid in inst.paths) if (inst.paths[pid] > top) top = inst.paths[pid];
      let pips = "";
      for (let i = 0; i < PATH_RULES.tiers; i++) {
        pips += `<i class="${i < top ? "on" : ""}"></i>`;
      }
      /* Spell CONCLUIDA: ela e a unica que ganha adorno em volta do warlock, e
         a tira precisa dizer QUAL esta ardendo la. Uma linha na cor do eixo no
         topo do tile — nao um glow, que o orcamento de brilho proibe. */
      const aura = b.isComplete(inst);
      html += `<div class="pb ${aura ? "pb-aura" : ""}" style="${this.eixoVars(d.axis)}"
        title="${d.name}${aura ? " — concluída, aura acesa" : ""}">
        ${Glyph.svg(d.id, 30)}<div class="pb-pips">${pips}</div></div>`;
    }
    const sobra = b.pieces.size - n;
    if (sobra > 0) html += `<div class="pb mais">+${sobra}</div>`;
    this.el.pieceBar.innerHTML = html;
    this.updateAxisBar();
  }

  /* --- toast (8.9) ---------------------------------------------------------
     340x44, teto de TRES, e a tarja de 4x20 na cor do eixo e a unica cor do
     componente. A opacidade do fundo cai por idade e o excedente vira UMA
     linha de contador: cinco toasts empilhados nunca mais. */

  toast(t) {
    this.toastCount++;
    this.live.push(t);
    setTimeout(() => { this.live.shift(); this.renderToasts(); }, 4200);
    this.renderToasts();
  }

  renderToasts() {
    const vis = this.live.slice(-TOASTS.max);
    const sobra = this.live.length - vis.length;
    let html = sobra > 0
      ? `<div class="toast-mais">+${sobra} evento${sobra > 1 ? "s" : ""}</div>` : "";
    for (let i = 0; i < vis.length; i++) {
      const t = vis[i];
      // o mais novo e o mais opaco; a coluna e invertida, entao ele fica embaixo
      const idade = vis.length - 1 - i;
      const txt = t.head ? `${t.head} — ${t.name}` : t.name;
      html += `<div class="toast${idade ? " t" + (idade + 1) : ""}" style="${this.eixoVars(t.axis)}">
        <b></b><span>${txt}</span>${t.value ? `<em>${t.value}</em>` : ""}</div>`;
    }
    this.el.toasts.innerHTML = html;
  }

  /* --- level up (9.3) ------------------------------------------------------
     Tres CARTAS verticais sobre o mundo APAGADO, e so o relogio sobrevive do
     HUD. O mundo continua atras — e isso, e nao a cor, que separa esta tela do
     preto chapado da Etapa —, mas a 8%: com mil inimigos em campo os pontos
     brancos ficavam mais claros que o texto das cartas.

     A HIERARQUIA INTERNA mudou de dono, e a razao e medida. Antes o item mais
     claro da carta era a frase do tier (`.lv-plain`), e o que decidia a compra
     — `27/s -> 38/s` contra `270 -> 378` — ficava em mono cinza no rodape. Duas
     unidades diferentes, convertidas de cabeca, 17 a 70 vezes por run: o que
     era IGUAL entre as ofertas ("+40% de dano", duas vezes) estava grande e o
     que DIFERIA estava pequeno.

     Hoje o heroi e a REGUA: o ganho em dano/s (`js/systems/dps.js`) em mono 38
     e uma barra em escala COMPARTILHADA entre as tres cartas — a mais longa
     ganha mais, e isso se le sem numero. A frase do tier desce para o corpo e
     passa a dizer a unica coisa que o numero nao diz: COMO a peca se comporta.
     Ela nunca repete o numero. */

  openLevelUp() {
    const g = this.game;
    g.state = STATE.LEVELUP;
    g.sfx.levelUp();
    const offers = g.build.getOffers(3);
    /* Bolo vazio: o nivel vira cura em vez de sumir em silencio — subir de
       nivel e nao receber nada e o jogo cobrando atencao e devolvendo vazio.

       Mas vazio tem DOIS motivos desde o gate de eixo, e eles pedem coisas
       opostas do jogador: "todo caminho fechado" e fim de linha, "trilha
       travada" e um ponto de eixo que ele ainda vai ganhar na etapa. Dizer
       "arsenal completo" com tres spells no tier 2 seria mentira, e a pior
       delas: a que faz o jogador parar de procurar o que destrava. */
    if (!offers.length) {
      g.player.pendingLevels = 0;
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + g.player.maxHp * 0.35);
      /* O toast tem 340px e uma linha so: a frase inteira ("ponto de eixo so
         vem de etapa") sairia cortada por reticencias, e frase cortada nao
         ensina nada. O numero vai no campo `value`, que e mono e alinhado a
         direita — e ele e o que o jogador precisa levar para a etapa. */
      const gate = g.build.nearestGate();
      this.toast(gate
        ? { head: "Trilha travada", axis: gate.axisId,
            name: `Tier ${gate.tier} · ${AXES[gate.axisId].name}`,
            value: `${gate.have}/${gate.need}` }
        : { head: "Arsenal completo", name: "Todo caminho fechado — o nível virou fôlego." });
      g.state = STATE.PLAYING;
      return;
    }

    /* O nivel que ESTA escolha paga. Com varios niveis na fila o jogador
       escolhe uma vez por nivel, entao o rotulo anda com a fila em vez de
       repetir o nivel ja alcancado tres vezes seguidas. */
    const lv = g.player.level - g.player.pendingLevels;
    this.el.lvEyebrow.textContent = `Nível ${lv} → ${lv + 1}`;
    this.el.lvClock.textContent = mmss(g.elapsed);

    this.lvOffers = offers;
    this.lvViews = offers.map((o) => this.offerView(o));
    this.lvScale(this.lvViews);
    this.lvHover = -1;
    this.el.lvRows.innerHTML = "";
    for (let i = 0; i < offers.length; i++) {
      const v = this.lvViews[i];
      const row = document.createElement("div");
      row.className = "lv-card ch2" + (v.top ? " lv-top" : "");
      row.setAttribute("style", this.eixoVars(v.axisId));
      row.innerHTML = this.cardHtml(v, i + 1);
      row.onclick = () => this.applyOffer(offers[i]);
      // O hover so re-renderiza a TIRA: mexer nas cartas mataria a transicao
      // que o CSS esta rodando naquele instante.
      row.onmouseenter = () => this.lvHoverTo(i);
      row.onmouseleave = () => this.lvHoverTo(-1);
      this.el.lvRows.appendChild(row);
    }
    this.el.lvBuild.innerHTML = this.buildStripHtml(-1);
    /* O HUD SAI. Tira de pecas, painel de eixos, barra de vida e cadeia
       seguiam acesos numa tela onde o jogo esta parado e nada disso decide
       nada — quatro camadas pedindo atencao contra tres cartas. So o relogio
       fica, e ele e o proprio da tela (`.lv-timer`). */
    this.el.hud.classList.add("hidden");
    this.el.levelup.classList.remove("hidden");
  }

  /* A ESCALA COMPARTILHADA. Ela e a tela inteira: comparar tres barras so
     significa alguma coisa se as tres estiverem na mesma regua, e e por isso
     que ela e calculada sobre a MESA e nao dentro de `offerView`, que so ve
     uma oferta por vez.

     So uma carta pode ser marcada como maior ganho, e a marcacao e um FATO
     aritmetico, nao uma recomendacao de estilo de jogo — por isso ela e osso e
     nao cor de eixo. Empate nao marca ninguem: duas cartas em osso cheio na
     mesma tela colidiriam, e "as duas rendem igual" nao e o que a marcacao
     existe para dizer. */
  lvScale(views) {
    let topo = 0, topoIdx = -1, empate = false;
    for (let i = 0; i < views.length; i++) {
      const d = views[i].dps;
      if (!(d > 0)) continue;
      if (d > topo * 1.001) { topo = d; topoIdx = i; empate = false; }
      else if (d > topo * 0.999) empate = true;
    }
    if (empate) topoIdx = -1;
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      /* PISO DE 3%. Uma evolucao pode render trinta vezes o que o tier vizinho
         rende, e a barra proporcional daquele vizinho sai com meio pixel — o
         que le como zero, e zero e outra coisa: "esta oferta nao move o dano".
         O piso mantem a distincao que importa (rende alguma coisa / nao rende)
         sem mexer na ordem, que e o que a barra promete. */
      v.pct = topo > 0 && v.dps > 0
        ? Math.max(3, Math.min(100, v.dps / topo * 100)) : 0;
      v.top = i === topoIdx;
    }
    return views;
  }

  /* As tres cartas atendem por `1`, `2` e `3`. Nao e atalho de conveniencia: e
     o input CERTO desta tela. Sao 17 a 70 escolhas por run, e mirar o mouse em
     uma de tres colunas custa mais que a decisao em si depois da decima vez.
     A carta continua clicavel — a tecla e o rotulo, nao a unica porta. */
  levelUpKey(k) {
    if (this.game.state !== STATE.LEVELUP) return false;
    const i = "123".indexOf(k);
    if (i < 0 || !this.lvOffers || i >= this.lvOffers.length) return false;
    this.applyOffer(this.lvOffers[i]);
    return true;
  }

  lvHoverTo(i) {
    if (this.lvHover === i) return;
    this.lvHover = i;
    this.el.lvBuild.innerHTML = this.buildStripHtml(i);
  }

  /* Tudo o que a carta mostra, derivado do que a oferta ja carrega. Roda uma
     vez por oferta (nao por hover): o resultado fica em `this.lvViews`.

     Nenhum texto novo por tier: sao 645 tiers no catalogo, e escrever
     "antes -> depois" a mao em cada um seria conteudo que envelhece no
     primeiro rebalanceamento. */
  offerView(o) {
    const axis = o.axis || null;
    const v = { axisId: axis ? axis.id : null, axis, pips: null, delta: [] };
    /* A REGUA. O ganho em dano/s e a unica coisa da carta que nao sai do
       catalogo: ele e simulado contra a build de agora (`BuildSystem.offerGain`
       -> `js/systems/dps.js`), entao ele ja tem tier, passiva e capstone
       dentro. Zero e resposta legitima — tier de controle, de cura ou de
       deslocamento nao move a regua —, e a carta diz isso com palavra em vez
       de fingir um numero. */
    v.dps = this.game.build.offerGain(o);
    v.pct = 0;
    v.top = false;

    if (o.kind === "passive") {
      v.kind = "Passiva";
      v.glyph = "✦";
      v.round = true;       // circulo: a unica forma redonda do jogo e a passiva
      v.tagCls = "tag-cat"; // categoria, nao raridade
      v.id = o.def.id;
      v.name = o.def.name;
      /* A linha de contexto de uma passiva conta QUANTAS pecas ela toca: e o
         que separa "multiplica quase nada" de "multiplica a build inteira", e
         e a unica coisa que faz o ganho dela ser lido como grande ou pequeno
         com razao. */
      v.hits = this.passiveReach(o.def);
      v.subtitle = `não dispara · ${v.hits} peça${v.hits === 1 ? "" : "s"} na build`;
      /* A linha de valores crus so existe quando ha valor. "Soma das 5 pecas
         afetadas" embaixo de "nao muda o dano" seria a carta se contradizendo
         na mesma coluna. */
      v.crus = v.dps > 0.5 ? `Soma das ${v.hits} peças afetadas` : "";
      /* A regua nao ve HOOK. Passiva ligada a evento (`on`) roda codigo
         imperativo em `js/hooks.js` — Eco do Vazio repete golpe grande,
         Contagio faz o DoT saltar —, e nada disso esta no dado que o modelo
         percorre. Dizer "nao muda o dano" ali seria a carta MENTINDO sobre
         uma passiva que muda o dano; ela diz que o ganho nao cabe na regua. */
      v.foraDaRegua = !!o.def.on;
      v.plain = o.def.desc;
      /* `why` so aparece quando ACRESCENTA. Numa carta o nome esta logo acima e
         repetir a identidade e ruido; sobram os dois casos com informacao nova
         — passiva exclusiva, que fecha uma porta, e evolucao, que troca a peca
         de identidade inteira. */
      v.why = o.def.exclusive
        ? `Fecha a porta de ${PASSIVES[o.def.exclusive].name} — a build tem que optar.`
        : "";
      /* VEREDITO, nao coordenada — e a linha de contexto logo acima ja diz a
         coordenada. Repetir "toda a build" aqui seria a mesma informacao duas
         vezes na mesma carta, que e metade do defeito que esta tela conserta. */
      v.progHead = "Multiplica o que a build já tem";
    } else {
      const evo = o.isEvo && o.evo ? o.evo : null;
      /* Evolucao ganha etiqueta propria em vez de "Melhoria": ela nao e um
         degrau a mais, e conversao — a peca troca de nome, arte, trigger e
         efeitos. Chamar as duas coisas de melhoria some com o climax
         justamente na carta em que ele acontece. Por isso ela e a etiqueta de
         RARIDADE (cheia em osso), e melhoria e a de categoria (contornada). */
      v.kind = evo ? "Evolução" : "Melhoria";
      v.glyph = evo ? "★" : "▲";
      v.tagCls = evo ? "tag-raro" : "tag-cat";
      // O selo do tier existe porque o icone de uma melhoria MENTE: e o icone
      // de uma spell que voce ja tem, e sozinho nao diz quao fundo ela esta.
      v.badge = o.tierIndex + 1;
      v.id = evo ? evo.id : o.def.id;
      /* O slot do nome carrega a SPELL, nao o nome de fantasia do tier. O
         jogador reconhece "Incinerate" de imediato; "Brasa" nao quer dizer nada
         ate ser lido. O nome do tier desce para o subtitulo. */
      v.name = evo ? evo.name : o.def.name;
      /* A linha de contexto diz de ONDE para ONDE, em uma unidade so: o tier
         que sai e o que entra. O nome de fantasia do tier saiu daqui junto com
         a regua — o slot e estreito, e "Brasa" nao ajuda a decidir. */
      v.subtitle = evo
        ? `${o.def.name} · tier ${o.tierIndex} → ${o.tierIndex + 1}`
        : `${o.path.name} · tier ${o.tierIndex} → ${o.tierIndex + 1}`;
      /* O `desc` dos tiers de evolucao comeca com "EVOLUÇÃO — ", de quando a
         carta nao tinha onde marcar isso. Agora a etiqueta marca. Tirado na
         exibicao, nao no dado: o `desc` continua servindo a quem le o catalogo. */
      /* O SLOT EM ECZAR NUNCA REPETE O NUMERO. 528 dos 660 tiers do catalogo
         sao gerados e o texto deles e puro numero ("+40% de dano.", "Dispara
         25% mais rapido.") — o mesmo dado que a regua ja imprime em mono 38 e
         que os valores crus ja imprimem em "antes -> depois". Tres vezes a
         mesma coisa, e nenhuma delas dizendo o que a compra muda no jogo.

         Tier puramente numerico (tem `mods`, nao tem `patch`) cede o slot para
         `LINE_ABOUT` — a frase da LINHA, e nao o `desc` da peca: duas das tres
         cartas costumam ser da mesma spell em linhas diferentes, e o `desc`
         sairia identico nas duas. Tier estrutural fica com o proprio texto:
         ali ele E o comportamento novo, e essa e a unica carta em que ele
         aparece. */
      const numerico = !!(o.tier.mods && !o.tier.patch);
      const plain = ((numerico && LINE_ABOUT[o.pathId]) || o.tier.desc)
        .replace(/^EVOLUÇÃO\s*[—-]\s*/, "");
      v.plain = plain.charAt(0).toUpperCase() + plain.slice(1);
      v.why = evo ? evo.desc : "";
      v.delta = this.tierDelta(o);
      v.pips = o.tierIndex + 1;
      /* Veredito, nao coordenada: o subtitulo ja diz "caminho · tier N de 5";
         aqui vai o que aquilo SIGNIFICA para a compra. */
      const falta = PATH_RULES.tiers - (o.tierIndex + 1);
      v.progHead = falta === 0 ? "Fecha o caminho"
        : falta === 1 ? "A um tier do fim"
        : `Faltam ${falta} para fechar`;
      /* O gancho da aura vira TEXTO no veredito em vez de um chip na cor do
         eixo. O eixo ja aparece em quatro lugares nesta carta (quadrado, barra
         da regua, brasa e pips) e um quinto faria a carta ser lida pela cor
         antes de ser lida pelo numero. */
      if (falta === 0 && !this.game.build.isComplete(o.inst)) {
        v.progHead = "Fecha o caminho · acende a aura";
      }
      /* Os valores crus continuam ali, para quem quiser conferir — em mono,
         embaixo do numero que decide, e nao no lugar dele. O valor novo sai na
         BRASA do eixo: e a unica cor da linha, e ela marca exatamente o que
         mudou. */
      v.crus = v.delta.length
        ? v.delta.map((d) => `${d[0]} → <em>${d[1]}</em>`).join(" · ")
        : "";
      /* Evolucao nao promete numero: ela troca trigger, efeitos e forma, entao
         a regua dela e uma ESTIMATIVA de uma peca que ainda nao foi jogada.
         Dizer isso e o que impede a carta mais espetacular da tela de parecer
         uma promessa aritmetica. */
      if (evo) v.crus = "Estimado · muda como a peça joga";
    }

    return v;
  }

  /* Quantas pecas da build uma passiva toca. `_matches` e a mesma funcao que o
     pipeline de stats usa — perguntar de outro jeito seria uma segunda regra
     de casamento para divergir da primeira. */
  passiveReach(def) {
    const b = this.game.build;
    let n = 0;
    for (const inst of b.pieces.values()) if (b._matches(inst.def, def.match, inst)) n++;
    return n;
  }

  /* "antes -> depois" saido dos MODS do tier, aplicados aos stats JA resolvidos
     da instancia (com passivas e capstone dentro). E o numero que o jogador vai
     passar a ter, nao o da tabela — e nunca desatualiza quando o balanceamento
     muda. Tier so-estrutural (mods nulo, `patch` presente) nao tem delta: a
     frase do tier ja E a mudanca. */
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
      // Duas linhas e o teto: a terceira empurra o "porque" para fora da carta.
      if (out.length === 2) break;
    }
    return out;
  }

  /* Capstone mais perto de abrir, contando `extra` pontos que ainda nao foram
     gastos. Capstone que nao cabe mais no pool nao entra: apontar para um alvo
     inalcancavel e pior que nao apontar nenhum. */
  nearestCapstone(extraAxis, extra) {
    const b = this.game.build;
    const left = b.axisLeft - (extra || 0);
    /* O pacto DEPOIS da previa, nao antes: a carta sob o mouse pode ser
       justamente a que abre o segundo eixo, e nesse instante o terceiro se
       fecha. Apontar para um capstone daquele terceiro seria a tela prometer
       um destino que o proprio clique acabou de emparedar. */
    const depois = (a) => b.axis[a] + (a === extraAxis ? (extra || 0) : 0);
    let abertos = 0;
    for (const a in b.axis) if (depois(a) > 0) abertos++;
    const selado = (a) => depois(a) === 0 && abertos >= AXIS_RULES.maxAxes;
    let best = null;
    for (const id in CAPSTONES) {
      if (b.capstones.has(id) || !b.owns(CAPSTONES[id])) continue;
      const c = CAPSTONES[id];
      let missing = 0, morto = false;
      const gaps = [], paid = [];
      for (const a in c.req) {
        const have = depois(a);
        const need = c.req[a] - have;
        // Capstone que pede um eixo selado nao esta longe: esta fora.
        if (need > 0 && selado(a)) { morto = true; break; }
        if (need > 0) { missing += need; gaps.push({ axis: AXES[a], need }); }
        else paid.push(AXES[a]);
      }
      if (morto || missing > left) continue;
      if (!best || missing < best.missing) best = { cap: c, missing, gaps, paid };
    }
    return best;
  }

  /* A carta, 348 x min-height 436, em retrato. Da frente para tras: etiqueta
     de tipo, cabecalho, REGUA, efeito, rodape.

     O eixo aparece em QUATRO lugares pequenos — quadrado de 9px, barra da
     regua, brasa nos valores crus, pips — e nunca na moldura: a marcacao de
     maior ganho e osso, e osso e cor de eixo na mesma moldura brigariam por
     dizer coisas diferentes sobre a mesma carta. */
  cardHtml(v, tecla) {
    /* O ganho zero nao vira "+0": "+0 dano/s" le como uma peca quebrada, e o
       que esta acontecendo e outra coisa — a oferta muda controle, cura ou
       deslocamento, que a regua nao mede. A carta diz isso com palavra. */
    const zero = !(v.dps > 0.5);
    const num = zero ? "—" : `+${fmtNum(Math.round(v.dps))}`;
    const un = !zero ? "dano/s"
      : v.foraDaRegua ? "ganho fora da régua" : "não muda o dano";
    return `
      <div class="lv-topo">
        <span class="tag ${v.tagCls} lv-kind ch1"><i>${v.glyph}</i>${v.kind}</span>
        <b></b>
      </div>
      <div class="lv-what">
        <div class="lv-tile${v.round ? " round" : ""}">${Glyph.svg(v.id, 32)}${
          v.badge ? `<b>${v.badge}</b>` : ""}</div>
        <div class="lv-what-txt">
          <div class="lv-name">${v.name}</div>
          <div class="lv-subtitle">${v.subtitle}</div>
        </div>
      </div>
      <div class="lv-hr"></div>
      <div class="lv-regua">
        ${v.top ? `<div class="lv-top-lbl">Maior ganho</div>` : ""}
        <div class="lv-ganho"><b>${num}</b><span>${un}</span></div>
        <div class="lv-escala"><i style="width:${v.pct.toFixed(1)}%"></i></div>
        ${v.crus ? `<div class="lv-crus">${v.crus}</div>` : ""}
      </div>
      <div class="lv-hr"></div>
      <div class="lv-plain">${v.plain}</div>
      ${v.why ? `<div class="lv-why">${v.why}</div>` : ""}
      <div class="lv-foot-card">
        <div class="lv-prog-head">${v.progHead}</div>
        <div class="lv-foot-row">
          ${v.pips != null ? this.pipsHtml(v.pips) : "<span></span>"}
          <span class="lv-tecla">${tecla || 1}</span>
        </div>
      </div>`;
  }

  /* Cinco pips. O degrau que ACABOU DE SUBIR sai na brasa (`-300`), e cinco
     cheios saem em OSSO: a peca deixa o sistema de eixo, porque nao ha mais
     decisao ali. */
  pipsHtml(n, lockAt) {
    let s = `<span class="lv-pips${n >= PATH_RULES.tiers ? " max" : ""}">`;
    for (let i = 0; i < PATH_RULES.tiers; i++) {
      const cls = i < n ? (i === n - 1 ? "on brasa" : "on") : (i === lockAt ? "lock" : "");
      s += `<i class="${cls}"></i>`;
    }
    return s + `</span>`;
  }

  /* As tres barras de eixo do rodape da ETAPA. `axisId`/`add` desenham a
     PREVIA: a barra cravada mostra onde o eixo PARA se a oferta sob o mouse for
     comprada, e o numero vira "4 → 7". E o unico jeito de ver o custo antes de
     pagar. Eixo com 0 ponto fica em osso com o quadrado vazado — cor e para o
     que existe. */
  axesHtml(axisId, add) {
    const b = this.game.build;
    const pct = (n) => Math.min(100, n / AXIS_RULES.capPerAxis * 100);

    /* Os tracos na barra sao os tiers que o ponto DESTRAVA. Sem eles a barra
       diz quanto o eixo cresceu e nao o que o crescimento compra — e o gate de
       profundidade e justamente a razao de a etapa importar. Sao marca e nao
       texto porque a barra tem 8px de altura: quem quer o numero passa o mouse,
       quem quer a distancia ve a previa cravar antes ou depois do traco. */
    let marcos = "";
    for (let t = 0; t < PATH_RULES.axisGate.length; t++) {
      const need = PATH_RULES.axisGate[t];
      if (!need) continue;
      // O traco do tier 5 cai no teto do eixo, e `left:100%` num filho de um
      // `overflow:hidden` desenha fora da barra. Encostar pela direita.
      const p = pct(need);
      marcos += `<b class="lv-ax-gate" style="${p >= 100 ? "right:0" : `left:${p}%`}"` +
                ` title="tier ${t + 1} das spells deste eixo · ${need} ponto${need > 1 ? "s" : ""}"></b>`;
    }

    let out = "";
    for (const id of b.axes) {
      const a = AXES[id], val = b.axis[id];
      const gain = id === axisId ? (add || 0) : 0;
      /* Selado pelo pacto: o numero sai. `0 / 15` diria que o eixo ainda pode
         andar, e ele nao pode — o que ocupa o lugar e a palavra que explica
         por que ele parou de aparecer nas cartas. */
      const selado = b.axisSealed(id);
      out += `<div class="lv-ax${selado ? " selado" : ""}" style="${this.eixoVars(val || gain ? id : null)}">
        <div class="lv-ax-head">
          <span class="lv-ax-ic ${val || gain ? "" : "vazio"}"></span>
          <span class="lv-ax-name ${val ? "" : "off"}">${a.name}</span>
          ${selado
            ? `<span class="lv-ax-selo">selado</span>`
            : `<span class="lv-ax-num ${gain ? "lit" : ""}">${
                gain ? `${val} → ${val + gain}` : val} / ${AXIS_RULES.capPerAxis}</span>`}
        </div>
        <div class="lv-ax-track">
          <i class="ghost" style="width:${pct(val + gain)}%"></i>
          <i style="width:${pct(val)}%"></i>
          ${marcos}
        </div></div>`;
    }
    return out;
  }

  /* A build de agora, em UMA TIRA — nunca duas, porque overlay de jogo nao
     rola. Eixo e capstone NAO moram aqui: nenhuma oferta desta tela os move, e
     a tela de etapa, que e onde eles mudam, ja os mostra com previa ao vivo.
     Sobra a unica pergunta que esta tela faz: em que degrau estao as minhas
     outras spells? */
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
      rows.push({ def: inst.def, top, nome, hit: inst.key === alvo,
                  done: b.isComplete(inst), gate: b.pieceGate(inst) });
    }
    // A spell afetada vai para a frente: numa tira ela nunca pode cair no "+N".
    rows.sort((a, z) => (z.hit ? 1 : 0) - (a.hit ? 1 : 0));

    const teto = STRIP.spells;
    let list = "";
    for (let i = 0; i < rows.length && i < teto; i++) {
      const r = rows[i];
      /* A trava vem NUMERADA e na cor do eixo. Pip apagado diz que a spell
         parou; so o numero diz onde ela volta a andar, e e ele que liga esta
         tela a etapa, que e a unica que entrega ponto de eixo. */
      const trava = r.gate
        ? `<span class="lv-sp-lock">${r.gate.have}/${r.gate.need}</span>` : "";
      list += `<div class="lv-sp${r.hit ? " hit" : ""}${r.done ? " done" : ""}${
        r.gate ? " lock" : ""}"
        style="${this.eixoVars(r.def.axis)}" title="${r.def.name}${
        r.nome ? ` — ${r.nome} tier ${r.top}` : ""}${
        r.gate ? ` · tier ${r.gate.tier} pede ${r.gate.need} de ${AXES[r.gate.axisId].name}` : ""}">
        <span class="lv-sp-name">${r.def.name}</span>
        ${this.pipsHtml(r.top, r.gate ? r.top : -1)}${trava}</div>`;
    }
    /* O contador fica FORA da lista: ela corta o que nao cabe (`overflow`
       hidden, porque a tira e uma linha so), e o contador cortado pela metade
       e a unica peca da tira que nao pode desaparecer. */
    let mais = "";
    if (rows.length > teto) {
      const n = rows.length - teto;
      mais = `<div class="lv-sp more">+${n} peça${n > 1 ? "s" : ""}</div>`;
    }

    let chips = "";
    let np = 0;
    for (const id of b.passives.keys()) {
      if (np >= STRIP.chips) break;
      const p = PASSIVES[id];
      chips += `<span class="lv-chip" title="${p.name}: ${p.desc}">${Glyph.svg(id, 18)}</span>`;
      np++;
    }
    if (b.passives.size > np) chips += `<span class="lv-chip more">+${b.passives.size - np}</span>`;

    return `<span class="lv-strip-lbl">Sua build</span>
      <div class="lv-strip-list">${list}</div>
      ${mais}
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
      this.toast({ head: "Evolução", axis: res.evolved.to.axis,
        name: `${res.evolved.from} → ${res.evolved.to.name}` });
    }
    if (res.completed) this.auraToast(res.completed);
    /* O Apice antes dos capstones: quando o eixo enche, os dois costumam cair
       na mesma escolha (15 e o limiar do capstone puro), e o que o jogador
       precisa ler primeiro e o que ele esta vendo acontecer em tela. */
    if (res.apex) {
      this.toast({ head: "Ápice", axis: AXES[res.apex], name: "eixo no máximo" });
    }
    for (const cap of res.caps) this.capToast(cap);
    this.checkForm(res.caps[res.caps.length - 1]);
    this.updatePieceBar();

    g.player.pendingLevels--;
    this.el.levelup.classList.add("hidden");
    if (g.player.pendingLevels > 0) this.openLevelUp();
    // O HUD so volta quando a FILA acaba: com varios niveis enfileirados ele
    // piscaria uma vez por carta escolhida.
    else { this.el.hud.classList.remove("hidden"); g.state = STATE.PLAYING; }
  }

  /* Aura: a spell fechou um caminho ate o fim e passou a arder em volta do
     warlock. E o unico jeito de ganhar adorno no personagem. */
  auraToast(def) {
    const g = this.game;
    g.sfx.combo();
    g.addShake(14);
    g.spawnParticles(g.player.x, g.player.y, def.color, 34);
    g.player.comboPulse(def.color);
    this.toast({ head: "Aura", axis: def.axis, name: `${def.name} concluída` });
  }

  capToast(cap) {
    const g = this.game;
    g.sfx.combo();
    g.addShake(18);
    g.spawnParticles(g.player.x, g.player.y, cap.color, 40);
    g.player.comboPulse(cap.color);
    this.toast({ head: "Capstone", axis: cap.axis, name: cap.name });
  }

  /* Metamorfose visual: ancorada nos CAPSTONES fechados. `cause` e o capstone
     que acabou de abrir, quando houver — a transformacao sai na cor de quem a
     causou, e nao numa cor generica de forma. */
  checkForm(cause) {
    const g = this.game, p = g.player;
    let done = 0;
    for (const inst of g.build.pieces.values()) if (g.build.isComplete(inst)) done++;
    const idx = p.formIndex(g.build.capstones, cause && cause.id, done);
    if (idx === p.formIdx) return;
    p.formIdx = idx;
    const f = p.forms[idx];
    /* Antes o toast so saia quando o INDICE subia, porque a lista era uma
       escada. Ela nao e mais: as oito formas de capstone sao irmas, e trocar da
       de Colheita para a de Tirania anda para tras no array sem andar para tras
       na run. Quem decide agora e ter nome — a forma base nao tem, e e a unica
       que nao anuncia nada. */
    if (!f.name) return;
    const color = (cause && cause.color) || f.color;
    g.sfx.combo();
    g.addShake(22);
    g.spawnParticles(p.x, p.y, color, 44);
    p.comboPulse(color);
    this.toast({ head: "Metamorfose", axis: cause ? cause.axis : null, name: f.name });
  }

  /* --- etapa (9.2 / 9.8) ---------------------------------------------------
     A BATIDA LENTA, e a unica fonte de ponto de eixo do jogo.

     Ela e o oposto da tela de level up de proposito, e a diferenca mais forte
     entre as duas nao e cor: e o FUNDO. Aqui o canvas some — obsidiana
     chapada —, e e isso que diz ao jogador que a pergunta mudou. O titulo e
     alinhado a esquerda contra o centralizado de la, o acento e a barra
     vertical na ponta da linha, e o alvo sao os SELOS, nao o bloco.

     O selo e o unico botao do jogo pintado com cor de eixo, porque
     preenchimento e custo e esta e a unica tela que cobra um ponto que nao
     volta. */

  /* --- 9.9 ABERTURA --------------------------------------------------------
     A primeira tela da run. Familia da Etapa e nao do Level up, e a razao e a
     pergunta: level up e uma batida DENTRO da run (o mundo continua vivo
     atras), abertura e capitulo — o canvas apaga, porque nao ha run ainda.

     Ela nao cobra ponto de eixo, e mesmo assim o botao e SELO. O selo nunca
     falou de custo, falou de IRREVERSIVEL: nao ha como devolver a spell com
     que a run comecou, e esta e a unica tela alem da etapa em que isso vale.

     O rodape carrega as tres barras zeradas e a regra do pacto — e o unico
     momento em que as tres aparecem lado a lado sem nenhuma escolhida, que e
     exatamente quando explicar "so duas cabem" custa nada e vale tudo. */

  openStarter() {
    const g = this.game;
    const offers = g.build.getStarterOffers();
    /* Classe sem abertura declarada nao pode travar a run numa tela vazia: cai
       no jogo direto, como fazia o kit que esta tela substituiu. */
    if (!offers.length) { g.state = STATE.PLAYING; return; }
    this.stOffers = offers;

    const cls = CLASSES[g.selectedClass];
    this.el.stEyebrow.innerHTML =
      `<span>Abertura</span><s></s><span>${cls.name}</span><s></s>` +
      `<span>${offers.length} spells · uma escolha</span>`;
    this.el.stSub.textContent =
      "Uma por família, e todas disparam sozinhas desde o primeiro segundo. " +
      "Ela não cobra ponto de eixo: o que você escolhe aqui é com o que a run " +
      "começa, não para onde ela vai.";

    this.el.stRows.innerHTML = "";
    for (const o of offers) {
      const row = document.createElement("div");
      row.className = "ms-row";
      row.setAttribute("style", this.eixoVars(o.axisId));
      row.innerHTML = this.stRowHtml(o);
      for (const btn of row.querySelectorAll(".ms-take")) {
        btn.onclick = (ev) => { ev.stopPropagation(); this.takeStarter(o); };
        btn.onmouseenter = () => this.stHoverTo(o);
        btn.onmouseleave = () => this.stHoverTo(null);
      }
      this.el.stRows.appendChild(row);
    }
    this.stHover = null;
    this.stRender(null);
    this.el.starter.classList.remove("hidden");
  }

  /* Como nas outras duas telas de escolha, o hover re-renderiza so o RODAPE:
     mexer nas linhas mataria a transicao que o CSS esta rodando naquele
     instante. Aqui ele nao move barra nenhuma (a abertura nao da eixo) — o que
     ele faz e acender a familia da linha sob o mouse. */
  stHoverTo(o) {
    const tag = o ? o.axisId : null;
    if (this.stHover === tag) return;
    this.stHover = tag;
    this.stRender(o);
  }

  stRender(o) {
    this.el.stPool.innerHTML = this.axesHtml(o ? o.axisId : null, 0);
    this.el.stPacto.innerHTML =
      `<div class="ms-pacto">Uma run cabe em <b>${AXIS_RULES.maxAxes} famílias</b> — ` +
      `a terceira fecha quando a segunda abrir</div>`;
  }

  /* A manchete e a SPELL, como na carta sorteada da etapa: e ela que esta
     sendo escolhida. O eixo vira etiqueta abaixo, na cor dele — por ele no
     topo seria anunciar como titulo algo que nao e a decisao desta tela. */
  stRowHtml(o) {
    return `
      <span class="ms-eixo"></span>
      <span class="ms-ic">${Glyph.svg(o.piece.id, 54)}</span>
      <div class="ms-txt">
        <div class="ms-head"><span class="ms-axis">${o.piece.name}</span></div>
        <div class="ms-tag">${o.axis.name} · ${o.axis.tag}</div>
        <div class="ms-desc">${o.piece.desc}</div>
      </div>
      <div class="ms-takes">
        <div>
          <button class="ms-take"><span>Começar</span></button>
          <div class="ms-take-note">não custa eixo</div>
        </div>
      </div>`;
  }

  takeStarter(o) {
    this.el.starter.classList.add("hidden");
    this.game.takeStarter(o.piece.id);
    this.toast({ head: "Abertura", axis: o.piece.axis, name: o.piece.name });
  }

  openMilestone() {
    const g = this.game;
    /* Pool cheio: nao ha mais ponto para dar, entao a tela nao tem pergunta a
       fazer. Some em silencio em vez de abrir vazia. */
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
       acaba. "Etapa 4 de 7" mentiria justo para quem mais precisa saber que
       ainda vem mais — o jogador que levou spell toda vez e esta atrasado. */
    const falta = g.build.axisLeft;
    this.el.msEyebrow.innerHTML =
      `<span>Etapa ${idx + 1}</span><s></s>` +
      `<span>${fmtNum(g.milestoneKillsAt(idx))} abates</span><s></s>` +
      `<span>${falta} ponto${falta === 1 ? "" : "s"} por gastar</span>`;

    /* O subtitulo muda de assunto junto com a fase. Enquanto nenhum eixo abriu,
       a pergunta e descoberta; com um eixo aberto, ela vira quanto investir
       nele — e isso precisa estar dito antes das linhas, nao deduzido delas. */
    const aberta = offers.find((o) => o.locked);
    this.el.msSub.textContent = aberta
      ? `${aberta.axis.name} já está aberta: o eixo sozinho não cobra mais nada. A spell, sim.`
      : "O único ponto que não volta. Escolha o eixo — a spell vem junto, cobrando um ponto.";

    this.el.msRows.innerHTML = "";
    for (let i = 0; i < offers.length; i++) {
      const o = offers[i];
      const row = document.createElement("div");
      row.className = "ms-row" + (o.locked ? " aberta" : "");
      row.setAttribute("style", this.eixoVars(o.axisId));
      row.innerHTML = this.msRowHtml(o);
      /* O ALVO e o botao, nao o bloco: o bloco e um eixo e o eixo tem duas
         maneiras de ser levado. Bloco inteiro clicavel precisaria de um padrao
         escolhido por nos, e escolher pelo jogador a metade irreversivel da
         decisao e o oposto do que esta tela existe para fazer. */
      for (const btn of row.querySelectorAll(".ms-take")) {
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

  /* Como no level up, o hover re-renderiza so o RODAPE: mexer nas linhas
     mataria a transicao que o CSS esta rodando naquele instante. */
  msRender(o, wet) {
    const step = !o ? null : ((wet ? o.wet : o.dry) || o.wet || o.dry);
    this.el.msPool.innerHTML = this.axesHtml(o ? o.axisId : null, step ? step.gain : 0);
    this.el.msCap.innerHTML = this.capLineHtml(o, step);
  }

  /* O alvo, com previa. Capstone e a unica coisa que os pontos de eixo compram
     a longo prazo, entao a tela que os entrega tem que dizer onde eles levam. */
  capLineHtml(o, step) {
    const before = this.nearestCapstone();
    const after = step && step.gain ? this.nearestCapstone(o.axisId, step.gain) : before;
    if (!after) return `<div class="ms-cap">Nenhum capstone cabe no pool restante</div>`;
    if (!after.missing) {
      return `<div class="ms-cap open"><b>${after.cap.name}</b> abre agora</div>`;
    }
    const falta = after.gaps.map((x) => `${x.need} de ${x.axis.name}`).join(" e ");
    const closer = before && after.missing < before.missing;
    return `<div class="ms-cap${closer ? " open" : ""}"><b>${after.cap.name}</b> a ${falta}</div>`;
  }

  /* Duas formas de linha, e o CABECALHO e onde elas se separam.

     ABERTA (eixo em `unlockAt`+): a manchete e o EIXO, porque a pergunta e
     quanto investir nele — a spell e uma das duas maneiras de levar, nao o
     assunto. Ela ganha o selo `aberto`, moldura, e os dois botoes.

     SORTEADA: a manchete e a SPELL, porque e ela que esta sendo escolhida; o
     eixo vira etiqueta abaixo, na cor dele. Por o eixo no topo de uma linha
     sorteada seria anunciar como titulo algo que o jogador nao escolheu — o
     sorteio e que pos aquele eixo ali. */
  msRowHtml(o) {
    const b = this.game.build, cur = b.axis[o.axisId];
    const M = BALANCE.milestones;

    /* Os botoes carregam o numero REAL. Com o eixo no teto ou o pool no fim,
       `addAxis` entrega menos do que a tabela promete — e esta e a unica tela
       do jogo cujo numero nao pode ser desfeito, entao ela e a ultima que pode
       arredondar a verdade. */
    const take = (step, wet, label) => {
      if (!step) return "";
      const dead = step.gain <= 0;
      const nota = dead
        ? (cur >= AXIS_RULES.capPerAxis ? "eixo no teto" : "pool no fim")
        : `${o.axis.name} ${cur} → ${cur + step.gain}`;
      return `<div>
        <button class="ms-take${wet ? "" : " seco"}${dead ? " dead" : ""}" data-wet="${wet ? 1 : 0}">
          <span>${label}</span><em>${dead ? "+0" : "+" + step.gain}</em>
        </button>
        <div class="ms-take-note">${nota}</div></div>`;
    };

    if (!o.locked) {
      return `
        <span class="ms-eixo"></span>
        <span class="ms-ic">${Glyph.svg(o.piece.id, 54)}</span>
        <div class="ms-txt">
          <div class="ms-head"><span class="ms-axis">${o.piece.name}</span></div>
          <div class="ms-tag">${o.axis.name}</div>
          <div class="ms-desc">${o.piece.desc}</div>
        </div>
        <div class="ms-takes">${take(o.wet, true, "Levar")}</div>`;
    }

    const spell = o.piece
      ? `<div class="ms-desc"><b>${o.piece.name}</b> — ${o.piece.desc}</div>`
      : `<div class="ms-desc">Todas as spells de ${o.axis.name} já estão na build.</div>`;
    return `
      <span class="ms-eixo"></span>
      <span class="ms-ic">${Glyph.svg(o.piece ? o.piece.id : o.axisId, 64)}</span>
      <div class="ms-txt">
        <div class="ms-head">
          <span class="ms-axis">${o.axis.name}</span>
          <span class="tag tag-eixo ch1" title="Eixo com ${M.unlockAt}+ pontos: nunca mais sai da mesa">aberto</span>
          <span class="ms-num">${cur}/${AXIS_RULES.capPerAxis}</span>
        </div>
        <div class="ms-tag">${o.axis.tag}</div>
        ${spell}
      </div>
      <div class="ms-takes">
        ${take(o.dry, false, "Só o eixo")}
        ${take(o.wet, true, "Com a spell")}
      </div>`;
  }

  applyMilestone(o, takePiece) {
    const g = this.game;
    const res = g.build.applyMilestone(o, takePiece);

    if (res.piece) {
      this.toast({ head: "Spell nova", axis: res.piece.axis, name: res.piece.name });
    }
    /* O pacto se fechando e a segunda coisa irreversivel desta tela, e a unica
       que nenhuma linha dela anuncia: o terceiro eixo simplesmente para de
       aparecer nas cartas. Sem o toast ele sumiria em silencio. */
    for (const a of res.sealed || []) {
      this.toast({ head: "Pacto selado", axis: a,
                   name: `${AXES[a].name} sai desta run` });
    }
    for (const cap of res.caps) this.capToast(cap);
    this.checkForm(res.caps[res.caps.length - 1]);
    this.updatePieceBar();

    g.pendingMilestones--;
    this.el.milestone.classList.add("hidden");
    if (g.pendingMilestones > 0) this.openMilestone();
    else if (g.player.pendingLevels > 0) this.openLevelUp();
    else g.state = STATE.PLAYING;
  }

  /* --- bau (9.7) -----------------------------------------------------------
     Coluna de 640 sobre preto, contra os 1360 da placa de Etapa: mesma
     familia, silhueta diferente. Nada esta sendo cobrado aqui, entao o botao e
     OSSO e nunca selo.

     A escada de raridade nao tem matiz novo — o ciano saiu. Quem diz o tamanho
     do premio e a ESPESSURA DA LUZ no topo da placa e o numero de linhas. */

  openChest() {
    const g = this.game;
    /* O bau termina o que voce comecou: sorteando tiers uniformemente ele
       espalhava investimento e empurrava a build para longe das evolucoes, que
       exigem cinco compras na MESMA trilha. Ordenado por profundidade, ele
       vira o empurrao final. */
    const cands = [];
    for (const inst of g.build.pieces.values()) {
      for (const pid in inst.def.paths) {
        if (g.build.canUpgradePath(inst, pid)) cands.push({ inst, pathId: pid });
      }
    }
    shuffle(cands);
    cands.sort((a, b) => b.inst.paths[b.pathId] - a.inst.paths[a.pathId]);

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
      this.toast({ head: "Evolução", axis: r.evolved.to.axis,
        name: `${r.evolved.from} → ${r.evolved.to.name}` });
    }
    for (const r of results) if (r.completed) this.auraToast(r.completed);
    let lastCap = null;
    for (const cap of g.build.checkCapstones()) {
      g.build.afterChange();
      lastCap = cap;
      this.capToast(cap);
    }
    this.checkForm(lastCap);
    this.updatePieceBar();

    g.sfx.levelUp();
    g.addShake(rarity.shake);

    const luz = results.length >= 5 ? "r5" : results.length >= 3 ? "r3" : "r1";
    /* Bau comum entrega UMA linha; a 640px o botao de continuar virava o
       elemento mais largo e mais pesado de uma tela quase vazia. A coluna
       estreita junto com o premio, entao a proporcao entre o que caiu e o que
       se faz com isso continua a mesma nas tres raridades. */
    this.el.chest.style.setProperty("--bau-w",
      results.length >= 5 ? "640px" : results.length >= 3 ? "560px" : "480px");
    this.el.chestList.innerHTML = results.length
      ? results.map((r) => `<div class="chest-row ${luz}" style="${this.eixoVars(r.def.axis)}">
          <span class="bau-ic">${Glyph.svg(r.def.id, 28)}</span>
          <span class="bau-txt">
            <span class="bau-nome">${r.def.name}</span>
            <span class="bau-galho">${r.path.name}</span>
          </span>
          ${this.pipsHtml(r.to)}
          <span class="bau-step">${r.from} → ${r.to}</span></div>`).join("")
      : `<div class="chest-row r1"><span class="bau-txt">
          <span class="bau-nome">Arsenal no máximo</span>
          <span class="bau-galho">cura total</span></span></div>`;

    // O rotulo conta o que CAIU, nao o que foi sorteado: com o arsenal quase no
    // teto um Lendario entrega menos de 5 e dizer "5 tiers" seria mentira.
    const got = results.length;
    this.el.chestRarity.textContent = rarity.label;
    this.el.chestCount.textContent = got
      ? `${got} tier${got > 1 ? "s" : ""} grátis` : "arsenal no máximo";
    let pips = "";
    for (let i = 0; i < 3; i++) {
      pips += `<i class="${i < (rarity.count >= 5 ? 3 : rarity.count >= 3 ? 2 : 1) ? "on" : ""}"></i>`;
    }
    this.el.chestPips.innerHTML = pips;
    g.state = STATE.CHEST;
    this.el.chest.classList.remove("hidden");
  }

  closeChest() {
    const g = this.game;
    this.el.chest.classList.add("hidden");
    g.state = STATE.PLAYING;
    if (g.player.pendingLevels > 0) this.openLevelUp();
  }

  /* --- pausa (9.6) ---------------------------------------------------------
     Um bloco largo a esquerda (as pecas, em duas colunas de linha compacta) e
     uma pilha estreita a direita (eixos, dano, marcos). Antes cada peca gastava
     ~100px com os tres galhos escritos e a lista era cortada no meio; os galhos
     foram para o hover e a peca coube em 52px. Se a build crescer, e a coluna
     que ganha uma terceira — nao a tela que estica.

     E os tres botoes deixaram de ser tres pilulas identicas: sair convidava
     tanto quanto voltar ao jogo. */

  onPause() {
    const g = this.game, b = g.build;
    this.el.pauseMeta.textContent =
      `${mmss(g.elapsed)} · nível ${g.player.level} · ${fmtNum(g.player.kills)} abates`;

    let pecas = "";
    for (const inst of b.pieces.values()) {
      let top = 0, galhos = [];
      for (const pid in inst.def.paths) {
        const n = inst.paths[pid];
        if (n > top) top = n;
        galhos.push(`${inst.def.paths[pid].name} ${n}/${PATH_RULES.tiers}`);
      }
      /* Os tres galhos e o gatilho vivem no HOVER: antes cada peca gastava
         ~100px com eles escritos e a lista era cortada no meio. Com eles no
         title a peca cabe em 52px e a build inteira cabe na tela. */
      const gat = TRIGGER_LABEL[inst.r.trigger.type] || "";
      pecas += `<div class="pa-pw" style="${this.eixoVars(inst.def.axis)}"
        title="${inst.def.name}${gat ? ` (${gat})` : ""} — ${galhos.join(" · ")}">
        <span class="pa-pw-ic">${Glyph.svg(inst.def.id, 24)}</span>
        <span class="pa-pw-nome">${inst.def.name}</span>
        ${this.pipsHtml(top)}</div>`;
    }
    for (const id of b.passives.keys()) {
      const p = PASSIVES[id];
      pecas += `<div class="pa-pw" title="${p.name}: ${p.desc}">
        <span class="pa-pw-ic" style="border-radius:50%">${Glyph.svg(id, 24)}</span>
        <span class="pa-pw-nome">${p.name}</span>
        <span class="tag tag-cat ch1">Passiva</span></div>`;
    }
    if (!pecas) pecas = `<div class="pa-vazio">Nenhuma peça ainda.</div>`;
    this.el.pausePieces.innerHTML = pecas;
    this.el.pauseCount.textContent = `${b.pieces.size} + ${b.passives.size}`;

    this.el.pauseAxes.innerHTML = this.axesHtml(null, 0);
    this.el.pausePool.textContent = `${b.axisTotal}/${AXIS_RULES.pool}`;

    /* Dano por peca: tres linhas e o resto colapsa. E a mesma regra do Game
       over, e pelo mesmo motivo — a lista nao pode crescer com a build, senao
       ela empurra os marcos para fora da tela. */
    const rows = this.damageRows();
    const max = rows.length ? Math.max(1, rows[0].val) : 1;
    const total = rows.reduce((s, r) => s + r.val, 0);
    let dmg = "";
    for (let i = 0; i < rows.length && i < PAUSE.dmg; i++) {
      const r = rows[i];
      dmg += `<div class="pa-dmg" style="${this.eixoVars(r.def.axis)}">
        <span class="pa-dmg-nome">${r.def.name}</span>
        <div class="barra"><i style="width:${r.val / max * 100}%"></i></div>
        <span class="pa-dmg-val">${fmtNum(r.val)}</span></div>`;
    }
    if (rows.length > PAUSE.dmg) {
      const n = rows.length - PAUSE.dmg;
      dmg += `<div class="pa-dmg"><span class="pa-dmg-nome dim">+${n} peça${n > 1 ? "s" : ""}</span>
        <div class="barra"><i style="width:0"></i></div><span class="pa-dmg-val"></span></div>`;
    }
    if (!rows.length) dmg = `<div class="pa-vazio">Nada causou dano ainda.</div>`;

    dmg += `<div class="painel-div"></div>`;
    const prox = this.nearestCapstone();
    dmg += this.marcosHtml();
    dmg += `<div class="pa-linha"><span>Próximo</span><b>${
      prox ? (prox.missing
        ? `${prox.cap.name} a ${prox.gaps.map((x) => `${x.need} de ${x.axis.name}`).join(" e ")}`
        : `${prox.cap.name} abre agora`)
      : "nenhum cabe no pool"}</b></div>`;
    this.el.pauseDmg.innerHTML = dmg;
    this.el.pauseDmgTot.textContent = fmtNum(total);

    this.el.pause.classList.remove("hidden");
  }

  hidePause() { this.el.pause.classList.add("hidden"); }

  /* Metamorfose e capstones em duas linhas — ou uma so, quando a segunda
     repetiria a primeira.

     Desde que cada capstone ganhou a SUA forma, o nome da forma e o nome do
     capstone sao a mesma palavra: um game over de Colheita mostrava
     "Metamorfose: Colheita" e "Capstones: Colheita" empilhados, e duas linhas
     dizendo a mesma coisa leem como bug de dado, nao como reforco. A linha da
     forma so aparece quando ela ACRESCENTA: e o caso do Iniciado, que vem de
     spell concluida e nao de capstone, e o de quem nao fechou capstone nenhum. */
  marcosHtml() {
    const g = this.game, b = g.build;
    const f = g.player.forms[g.player.formIdx];
    const caps = [];
    for (const id of b.capstones) caps.push(CAPSTONES[id].name);
    const linha = (rot, val) => `<div class="pa-linha"><span>${rot}</span><b>${val}</b></div>`;
    const repete = f && f.name && caps.includes(f.name);
    return (repete ? "" : linha("Metamorfose", f && f.name ? f.name : "nenhuma")) +
      linha("Capstones", caps.length ? caps.join(" · ") : "nenhum");
  }

  /* Dano por peca, ordenado. Peca com 0 de dano NAO aparece: linha zerada numa
     lista ordenada por dano so ocupa o lugar de quem tem o que dizer. */
  damageRows() {
    const g = this.game;
    const rows = [];
    for (const inst of g.build.pieces.values()) {
      const val = g.damageBy.get(inst.key) || 0;
      if (val > 0) rows.push({ def: inst.def, val });
    }
    rows.sort((a, b) => b.val - a.val);
    return rows;
  }

  /* --- o placar (9.1b) -----------------------------------------------------
     Tres estados, e eles sao DIFERENTES: vazio convida, fora do ar informa, e
     carregando passa. O quarto — spinner eterno — e o unico inaceitavel, e
     quem o impede e o `timeout` de `Leaderboard.load`. */

  /* O nome vem de uma planilha que qualquer um pode escrever, e ele e desenhado
     com `innerHTML`. Escapar aqui e o que separa "meu amigo pos um nome bobo"
     de "meu amigo pos um <script> na minha pagina inicial". */
  esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  mountBoard() {
    const e = this.el;
    if (!e.lbNome) return;
    e.lbNome.value = Leaderboard.nome();
    /* `input` e nao `change`: o botao de Iniciar depende deste campo, e um
       botao que so destrava quando o campo perde o foco parece quebrado. */
    e.lbNome.oninput = () => { Leaderboard.setNome(e.lbNome.value); this.syncStart(); };
    e.lbNome.onchange = () => {
      e.lbNome.value = Leaderboard.setNome(e.lbNome.value);  // poda a vista
      this.syncStart();
      this.drawBoard();   // so a marca do "sou eu" muda: nao recarrega a rede
    };
    // Enter no campo comeca a run: o foco esta aqui, entao o botao nao o recebe.
    e.lbNome.onkeydown = (ev) => {
      if (ev.key === "Enter" && Leaderboard.temNome()) {
        e.lbNome.blur();
        this.game.start();
      }
    };
    this.syncStart();
    this.focaNome();
    this.loadBoard();
  }

  /* Botao `disabled` nao recebe clique, entao o `focus()` do onclick e a
     ultima defesa e nao o caminho normal: quem ensina o que falta e o cursor
     ja piscando no campo quando o menu abre sem nome. */
  focaNome() {
    const e = this.el;
    if (!e.lbNome || Leaderboard.temNome()) return;
    try { e.lbNome.focus(); } catch (err) { /* stub sem foco: nao e erro */ }
  }

  /* O estado do botao e do rotulo ao lado dele, num lugar so: os dois dizem a
     mesma coisa e nao podem divergir. */
  syncStart() {
    const e = this.el, ok = Leaderboard.temNome();
    if (e.startBtn) e.startBtn.disabled = !ok;
    if (e.startDica) e.startDica.textContent = ok ? "Enter" : "digite um nome para começar";
  }

  loadBoard() {
    const e = this.el;
    if (!e.lbRows || typeof Leaderboard === "undefined") return;
    this._board = null; this._boardErr = false;
    this.drawBoard();
    Leaderboard.load()
      .then((b) => { this._board = b; this.drawBoard(); })
      .catch(() => { this._boardErr = true; this.drawBoard(); });
  }

  drawBoard() {
    const e = this.el;
    if (!e.lbRows) return;
    const meu = Leaderboard.nome();

    if (this._boardErr) {
      e.lbEstado.textContent = "fora do ar";
      e.lbRows.innerHTML = '<div class="lb-vazio">Não deu para carregar o placar. O jogo funciona igual.</div>';
      return;
    }
    const b = this._board;
    if (!b) { e.lbEstado.textContent = "carregando"; e.lbRows.innerHTML = ""; return; }
    if (!b.rows.length) {
      e.lbEstado.textContent = "vazio";
      e.lbRows.innerHTML = '<div class="lb-vazio">Ninguém sobreviveu ainda. Seja o primeiro.</div>';
      return;
    }

    e.lbEstado.textContent = b.fora
      ? `${b.fora} fora da curva` : `${b.rows.length} runs`;

    const melhores = Leaderboard.melhorPorJogador(b.rows, LB_CFG.linhas);

    let h = "";
    melhores.forEach((r, i) => {
      /* A UNICA cor da tabela: o glifo da peca que mais deu dano, no eixo dela.
         Sem assinatura o lugar fica vazio — inventar um icone diria que a run
         teve uma build que ela nao teve. */
      const def = PIECES[r.assinatura];
      const cor = def && UI_PAL.eixo[def.axis];
      const gli = def && cor
        ? `<span class="lb-gli" style="color:${cor}">${Glyph.svg(def.id, 20)}</span>`
        : '<span class="lb-gli"></span>';
      const nome = Leaderboard.limpaNome(r.nome);
      h += `<div class="lb-row${nome && nome === meu ? " lb-eu" : ""}">
        <span class="lb-pos">${i + 1}</span>${gli}
        <span class="lb-nome-c">${this.esc(nome)}</span>
        <span class="lb-t">${mmss(Number(r.tempo_ms) / 1000)}</span>
        <span class="lb-k">${fmtNum(Number(r.abates))} abates</span></div>`;
    });
    e.lbRows.innerHTML = h;
  }

  /* --- version notes (9.9) -------------------------------------------------
     The version number in the menu corner is a button, and what it opens is
     the list of what went into each version — newest first.

     It exists because the game has no changelog anywhere the player can reach:
     the repository has one, and a repository is not a screen. Whoever comes
     back after a week sees the number change with no way to know what changed.

     No text here is written in this class: it all comes from `CHANGELOG`
     (js/version.js), the same list `VERSION` falls out of. */

  mountVersao() {
    const e = this.el;
    if (!e.versao || typeof VERSION === "undefined") return;
    e.versao.innerHTML = `<b>v${this.esc(VERSION)}</b><s></s><span>notas</span>`;
    e.versao.onclick = () => this.openChangelog(0);
    const fechar = document.getElementById("logClose");
    if (fechar) fechar.onclick = () => this.closeChangelog();
  }

  openChangelog(i) {
    const e = this.el;
    if (!e.changelog || !CHANGELOG.length) return;
    this.logIdx = Math.max(0, Math.min(CHANGELOG.length - 1, i | 0));
    this.drawChangelog();
    e.changelog.classList.remove("hidden");
    this.logOpen = true;
  }

  closeChangelog() {
    if (!this.el.changelog) return;
    this.el.changelog.classList.add("hidden");
    this.logOpen = false;
  }

  /* The rail is built node by node instead of by `innerHTML` plus a
     `querySelectorAll` afterwards: every row needs its own `onclick`, and this
     is the same pattern the level-up cards already use. */
  drawChangelog() {
    const e = this.el;
    e.logNav.innerHTML = "";
    CHANGELOG.forEach((v, i) => {
      const b = document.createElement("button");
      b.className = "log-v" + (i === this.logIdx ? " sel" : "");
      b.innerHTML =
        `<span class="log-v-top"><span class="log-v-num">v${this.esc(v.v)}</span>` +
        (i === 0 ? '<span class="tag tag-raro">Atual</span>' : "") +
        `</span><span class="log-v-tit">${this.esc(v.titulo)}</span>`;
      b.onclick = () => { this.logIdx = i; this.drawChangelog(); };
      e.logNav.appendChild(b);
    });

    const v = CHANGELOG[this.logIdx];
    /* `esc` because there is no reason not to: a note is text, and the day
       somebody writes a `<` for "fewer than 3 enemies" in one, the screen must
       not turn into markup. */
    let h = `<div class="log-n-head"><h3 class="display-m">${this.esc(v.titulo)}</h3>` +
            `<span class="log-n-data">${this.esc(v.data)}</span></div>`;
    for (const n of v.notas) {
      h += `<div class="log-n"><span class="tag tag-cat">` +
           `${this.esc(CHANGELOG_TIPOS[n.t] || n.t)}</span>` +
           `<p class="texto-m">${this.esc(n.txt)}</p></div>`;
    }
    e.logNotes.innerHTML = h;
    e.logCount.textContent = `${this.logIdx + 1} de ${CHANGELOG.length} versões`;
  }

  /* --- game over (9.5) -----------------------------------------------------
     Altura FIXA por construcao. Uma build de 30 pecas ocupa exatamente a mesma
     altura de uma de 6, porque a lista e `slice(0,5)` e o resto e uma linha; o
     botao esta fora do fluxo que crescia. O transbordo deixa de ser possivel em
     vez de ser evitado. */

  onGameOver() {
    const g = this.game, b = g.build;
    const rows = this.damageRows();
    const total = rows.reduce((s, r) => s + r.val, 0);

    const eixos = [];
    for (const id of b.axes) {
      const v = b.axis[id];
      eixos.push(v ? `<i style="color:${UI_PAL.eixo[id]}">${v}</i>`
                   : `<i style="color:var(--osso-200)">0</i>`);
    }
    const cel = (rot, val) => `<div class="go-cel"><span class="rotulo">${rot}</span><b>${val}</b></div>`;
    this.el.goNums.innerHTML =
      cel("Sobrevivência", mmss(g.elapsed)) +
      cel("Abates", fmtNum(g.player.kills)) +
      cel("Nível", g.player.level) +
      cel("Dano total", fmtNum(total)) +
      cel("Eixos", eixos.join("<i style='color:var(--osso-200)'>/</i>"));

    const max = rows.length ? Math.max(1, rows[0].val) : 1;
    let dmg = "";
    for (let i = 0; i < rows.length && i < GO.dmg; i++) {
      const r = rows[i];
      dmg += `<div class="go-row" style="${this.eixoVars(r.def.axis)}">
        <span class="go-row-nome">${r.def.name}</span>
        <div class="barra"><i style="width:${r.val / max * 100}%"></i></div>
        <span class="go-row-val">${fmtNum(r.val)}</span>
        <span class="go-row-pct">${total ? Math.round(r.val / total * 100) : 0}%</span></div>`;
    }
    if (rows.length > GO.dmg) {
      const n = rows.length - GO.dmg;
      dmg += `<div class="go-row mais"><span class="go-row-nome">+${n} peça${n > 1 ? "s" : ""}</span>
        <div class="barra"><i style="width:100%;background:var(--osso-100)"></i></div>
        <span class="go-row-val"></span><span class="go-row-pct"></span></div>`;
    }
    if (!rows.length) dmg = `<div class="pa-vazio">Nenhuma peça causou dano.</div>`;
    this.el.goDmg.innerHTML = dmg;

    this.el.goLine.textContent = this.runLine(rows, total);

    let auras = 0;
    for (const inst of b.pieces.values()) if (b.isComplete(inst)) auras++;
    this.el.goExtra.innerHTML = this.marcosHtml() +
      `<div class="pa-linha"><span>Auras acesas</span><b>${auras}</b></div>` +
      `<div class="pa-linha"><span>Maior cadeia</span><b>${fmtNum(g.comboBest)}</b></div>`;

    /* O placar. A ordem importa: o recorde local e cobrado ANTES do envio,
       porque ele e a metade que funciona sem rede nenhuma. */
    const run = Leaderboard.runFrom(g, total, rows.length ? rows[0].def.id : "");
    const recorde = Leaderboard.remember(run);
    const best = Leaderboard.best();
    const temNome = !!Leaderboard.nome();
    /* SO recorde pessoal e enviado, e a razao e o que o placar E: um quadro de
       melhor de sempre nunca vai desenhar uma run que nem o seu proprio dono
       bateu. Mandar as outras seria gravar linha que nada le — e encher as 50
       linhas do QUERY com as tentativas de uma pessoa so.

       `no-cors` nao devolve status, entao a tela NUNCA diz "enviado": ela diz
       que partiu e manda conferir onde da para ver de verdade. */
    const partiu = temNome && recorde && Leaderboard.submit(run);
    let ph = "";
    if (recorde) ph += `<div class="pa-linha go-novo"><span>Recorde pessoal</span><b>NOVO</b></div>`;
    ph += `<div class="pa-linha go-recorde"><span>Seu melhor</span><b>${
      best ? mmss(best.tempo_ms / 1000) : "—"}</b></div>`;
    ph += `<div class="pa-linha"><span>Placar</span><b>${
      !temNome ? "defina seu nome no menu"
        : !recorde ? "só recorde entra"
          : partiu ? "a caminho · confira no menu" : "sem conexão"}</b></div>`;
    this.el.goPlacar.innerHTML = ph;

    this.el.gameover.classList.remove("hidden");
  }

  /* A run em uma linha, gerada dos dados. Nao ha texto escrito a mao aqui pelo
     mesmo motivo que nao ha nos tiers: uma frase por combinacao possivel seria
     conteudo que envelhece no primeiro rebalanceamento. */
  runLine(rows, total) {
    const b = this.game.build;
    if (!rows.length) return "Uma run que acabou antes de a build dizer alguma coisa.";
    let dom = null;
    for (const id of b.axes) if (!dom || b.axis[id] > b.axis[dom]) dom = id;
    const zero = [];
    for (const id of b.axes) if (!b.axis[id]) zero.push(AXES[id].name);
    const top = rows[0];
    const pct = total ? Math.round(top.val / total * 100) : 0;
    const parte = pct >= 50 ? "mais da metade do seu dano" : `${pct}% do seu dano`;
    const cauda = zero.length
      ? `, e ${zero.length > 1 ? "nenhum ponto entrou em" : "o eixo"} ${zero.join(" e ")} ficou em zero até o fim`
      : "";
    return `Uma run de ${AXES[dom].name}: ${top.def.name} fez ${parte}${cauda}.`;
  }
}

/* Tetos de LEITURA, nao de dados. O overlay nao rola e a tira e uma linha so,
   entao o que passa disso vira contador. */
const STRIP = { spells: 5, chips: 6 };
const TOASTS = { max: 3 };
const PAUSE = { dmg: 3 };
const GO = { dmg: 5 };
/* Teto da tira de pecas do HUD: acima disso ela viraria duas fileiras cobrindo
   meia tela, e a tira existe justamente para ser lida de relance. */
STRIP.hud = 9;
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
  // `blast` e DANO em toda peca que o usa (Unstable Affliction, Chaos Bolt,
  // Seed of Corruption, Implosion, Soul Rupture) — quem carrega o raio e
  // `blastRadius`. Enquanto ele morava na secao de espaco rotulado como
  // "raio da explosao", o delta da carta anunciava raio no lugar de dano.
  blast:       { name: "dano da explosão", fmt: SF.n },
  heal:        { name: "cura", fmt: SF.n },
  shield:      { name: "escudo", fmt: SF.n },
  drain:       { name: "dreno", fmt: SF.ps },
  executeMul:  { name: "execução", fmt: SF.x },
  crit:        { name: "crítico", fmt: SF.pct },
  critMul:     { name: "dano crítico", fmt: SF.x },
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
  bounce:     { name: "quiques", fmt: SF.i },
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
