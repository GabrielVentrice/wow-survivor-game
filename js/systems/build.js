"use strict";
/* =========================================================================
   BUILD — pecas possuidas, eixos, caminhos de upgrade, evolucoes, passivas
   globais e capstones. E o unico lugar que sabe o que a run "e".

   Regras estruturais que forcam comprometimento:
     - pool de 20 pontos de eixo, teto de 15 por eixo -> impossivel maximizar 2
     - no maximo 2 caminhos por peca passam do tier 2 -> impossivel maximizar 3
     - passivas podem ser mutuamente exclusivas -> torre OU corredor, nao ambos
   ========================================================================= */

class BuildSystem {
  constructor(game) {
    this.game = game;
    this.pieces = new Map();       // key -> instancia
    this.passives = new Map();     // id -> nivel (1)
    this.capstones = new Set();
    this.axis = { corruption: 0, dominion: 0, cataclysm: 0 };
    this.reactives = new Map();    // evento -> [instancias]
    this.vfx = [];                 // pecas com efeito visual no personagem
  }

  reset() {
    this.pieces.clear();
    this.passives.clear();
    this.capstones.clear();
    this.axis.corruption = 0; this.axis.dominion = 0; this.axis.cataclysm = 0;
    this.reactives.clear();
    this.vfx.length = 0;
    this.wireEvents();
    this.applyGlobals();
  }

  get axisTotal() { return this.axis.corruption + this.axis.dominion + this.axis.cataclysm; }
  get axisLeft() { return AXIS_RULES.pool - this.axisTotal; }

  /* --- eventos ---------------------------------------------------------- */

  /* Um unico despachante por tipo de evento. Trocar a peca (evolucao) nao
     exige des-inscrever nada: o dispatch le a lista atual.

     Re-inscreve SEMPRE: Game.start() limpa o barramento inteiro antes de
     chamar reset(), entao um guard de "ja inscrevi" deixaria a segunda run da
     sessao sem nenhum ouvinte — todo reativo, capstone e passiva de evento
     morreriam em silencio ao apertar Reiniciar. */
  wireEvents() {
    const g = this.game;
    for (const name of Object.values(EVENTS)) {
      g.events.on(name, (payload) => this.dispatch(name, payload));
    }
    g.events.on("minion_summoned", (p) => this.dispatch("minion_summoned", p));
  }

  dispatch(name, payload) {
    const list = this.reactives.get(name);
    if (list) {
      const g = this.game, now = g.clock;
      for (let i = 0; i < list.length; i++) {
        // Anti-recursao: uma peca nao reage ao proprio dano enquanto ele ainda
        // esta sendo despachado. Sem isto, um reativo que causa dano se
        // realimenta ate estourar a pilha.
        if (g._chain.has(list[i].key)) continue;
        TRIGGERS.reactive.onEvent(g, list[i], payload, now);
      }
    }
    const hooks = this.eventHooks && this.eventHooks.get(name);
    if (hooks) for (let i = 0; i < hooks.length; i++) hooks[i](this.game, payload);
  }

  rebuildReactives() {
    this.reactives.clear();
    for (const inst of this.pieces.values()) {
      if (inst.r.trigger.type !== "reactive") continue;
      const ev = inst.r.trigger.event;
      let l = this.reactives.get(ev);
      if (!l) { l = []; this.reactives.set(ev, l); }
      l.push(inst);
    }
  }

  // Passivas e capstones podem escutar eventos via hooks nomeados.
  rebuildEventHooks() {
    this.eventHooks = new Map();
    const add = (ev, name) => {
      const fn = HOOKS[name];
      if (!fn) return;
      let l = this.eventHooks.get(ev);
      if (!l) { l = []; this.eventHooks.set(ev, l); }
      l.push(fn);
    };
    for (const id of this.passives.keys()) {
      const on = PASSIVES[id].on;
      if (on) for (const ev in on) add(ev, on[ev]);
    }
    for (const id of this.capstones) {
      const on = CAPSTONES[id].on;
      if (on) for (const ev in on) add(ev, on[ev]);
    }
  }

  /* --- resolucao (chamado por resolvePiece) ------------------------------ */

  _matches(def, match, inst) {
    if (!match) return true;
    if (match.key && match.key !== def.key) return false;
    if (match.axis && match.axis !== def.axis) return false;
    if (match.tag && (!def.tags || def.tags.indexOf(match.tag) < 0)) return false;
    if (match.trigger && def.trigger.type !== match.trigger) return false;
    return true;
  }

  collectMods(def, stats, inst) {
    for (const id of this.passives.keys()) {
      const p = PASSIVES[id];
      if (p.pieceMods && this._matches(def, p.match, inst)) applyMods(stats, p.pieceMods);
    }
    for (const id of this.capstones) {
      const c = CAPSTONES[id];
      if (c.pieceMods && this._matches(def, c.match, inst)) applyMods(stats, c.pieceMods);
    }
  }

  collectPatches(def, shell, inst) {
    const apply = (src) => {
      if (!src) return;
      for (const k in src) setPath(shell, k, deepClone(src[k]));
    };
    for (const id of this.passives.keys()) {
      const p = PASSIVES[id];
      if (p.piecePatch && this._matches(def, p.match, inst)) apply(p.piecePatch);
    }
    for (const id of this.capstones) {
      const c = CAPSTONES[id];
      if (c.piecePatch && this._matches(def, c.match, inst)) apply(c.piecePatch);
    }
  }

  // Multiplicadores de jogo inteiro (nao por peca). Recalculados do zero a
  // cada aquisicao, como o antigo BuffSystem.recompute.
  applyGlobals() {
    const g = this.game;
    g.dotHaste = 1;
    g.dotDurationMul = 1;
    g.minionDurationMul = 1;
    g.minionPermanent = false;
    g.shieldPerMinion = 0;
    g.areaLifesteal = 0;
    g.cooldownMul = 1;
    g.noExternalHeal = false;
    g.bigHitCrit = false;
    for (const id of this.passives.keys()) this._mergeGlobal(PASSIVES[id].global);
    for (const id of this.capstones) this._mergeGlobal(CAPSTONES[id].global);
    g.player.noExternalHeal = g.noExternalHeal;
  }
  _mergeGlobal(gl) {
    if (!gl) return;
    const g = this.game;
    if (gl.dotHaste) g.dotHaste *= gl.dotHaste;
    if (gl.dotDuration) g.dotDurationMul *= gl.dotDuration;
    if (gl.minionDuration) g.minionDurationMul *= gl.minionDuration;
    if (gl.minionPermanent) g.minionPermanent = true;
    if (gl.shieldPerMinion) g.shieldPerMinion += gl.shieldPerMinion;
    if (gl.areaLifesteal) g.areaLifesteal += gl.areaLifesteal;
    if (gl.cooldownMul) g.cooldownMul *= gl.cooldownMul;
    if (gl.noExternalHeal) g.noExternalHeal = true;
    if (gl.bigHitCrit) g.bigHitCrit = true;
  }

  resolveAll() {
    for (const inst of this.pieces.values()) inst.r = resolvePiece(inst, this);
    this.rebuildReactives();
    this.rebuildVfx();
  }

  /* AURAS do personagem. So spell CONCLUIDA entra aqui.

     Antes toda peca comprada acendia adorno em volta do warlock, e com seis
     pecas na build o personagem virava um borrao de cor — exatamente o que a
     hierarquia de leitura proibe. Agora o halo e recompensa: aparece quando um
     caminho chega ao tier 5, que e o momento em que a spell esta pronta. */
  rebuildVfx() {
    this.vfx.length = 0;
    for (const inst of this.pieces.values()) {
      const v = PIECE_VFX[inst.def.vfx];
      if (!v || !this.isComplete(inst)) continue;
      this.vfx.push({
        under: v.under, over: v.over, color: inst.def.color,
        rgb: hexRgb(inst.def.color), lvl: this.pieceTier(inst),
      });
    }
  }

  /* --- pecas ------------------------------------------------------------- */

  has(key) { return this.pieces.has(key); }
  get(key) { return this.pieces.get(key); }

  /* Spell concluida = qualquer caminho dela chegou ao ultimo tier. Vale tanto
     para o caminho que evolui quanto para o que so termina: os dois exigem as
     mesmas cinco compras na MESMA trilha, que e o comprometimento que a aura
     paga. */
  isComplete(inst) {
    for (const p in inst.paths) if (inst.paths[p] >= PATH_RULES.tiers) return true;
    return false;
  }
  pieceTier(inst) {
    let n = 0;
    for (const p in inst.paths) n += inst.paths[p];
    return n;
  }

  /* `free` = kit inicial da classe: entra sem cobrar pontos de eixo. Cobrar
     tornaria a run pre-comprometida antes da primeira escolha do jogador, o
     que contraria o proposito do pool de 20. */
  acquirePiece(id, free) {
    const def = PIECES[id];
    if (!def || this.pieces.has(def.key)) return null;
    const inst = {
      key: def.key, defId: def.id, def,
      paths: {}, s: {}, r: null, casts: 0, evolvedInto: null,
    };
    for (const p in def.paths) inst.paths[p] = 0;
    this.pieces.set(def.key, inst);
    if (!free) this.addAxis(def.axis, def.axisPoints != null ? def.axisPoints : 2);
    inst.r = resolvePiece(inst, this);
    (TRIGGERS[inst.r.trigger.type] || TRIGGERS.auto_target).init(inst.s, this.game);
    this.afterChange();
    return inst;
  }

  /* Regra dos caminhos: no maximo `maxDeep` caminhos podem passar do tier
     `freeTier`. E o que impede uma peca de virar tudo ao mesmo tempo.

     E o gate de eixo (`PATH_RULES.axisGate`): o tier so abre se o eixo DA PECA
     ja tiver os pontos. Vale para toda fonte de tier — level up, bau e
     qualquer coisa que venha depois —, porque quem pergunta e este metodo. */
  canUpgradePath(inst, pathId) {
    const cur = inst.paths[pathId];
    if (cur >= PATH_RULES.tiers) return false;
    if (this.axis[inst.def.axis] < PATH_RULES.axisGate[cur]) return false;
    if (cur < PATH_RULES.freeTier) return true;
    let deep = 0;
    for (const p in inst.paths) {
      if (p !== pathId && inst.paths[p] > PATH_RULES.freeTier) deep++;
    }
    return deep < PATH_RULES.maxDeep;
  }

  /* O que falta de eixo para esta peca voltar a subir. Devolve null quando ela
     nao esta travada POR EIXO — ou porque algum caminho ja pode subir, ou
     porque o que trava e `maxDeep`/tier 5, que sao outra conversa.

     A UI precisa disto porque oferta travada simplesmente NAO entra no bolo do
     level up: sem dizer o motivo, a tela some com a trilha em silencio e o
     jogador nao tem como saber que a etapa e quem destrava. */
  pieceGate(inst) {
    let best = null;
    for (const pathId in inst.paths) {
      if (this.canUpgradePath(inst, pathId)) return null;
      const cur = inst.paths[pathId];
      if (cur >= PATH_RULES.tiers) continue;
      const need = PATH_RULES.axisGate[cur];
      if (this.axis[inst.def.axis] >= need) continue;   // travado por maxDeep
      if (!best || need < best.need) {
        best = { axisId: inst.def.axis, need, have: this.axis[inst.def.axis], tier: cur + 1 };
      }
    }
    return best;
  }

  /* A trava mais PERTO de cair, entre todas as pecas — nao a de menor tier.
     Quem le esta mensagem quer saber onde investir o proximo ponto, e o eixo
     que esta a um ponto do tier 4 vale mais que o que esta a cinco do tier 3. */
  nearestGate() {
    let best = null;
    for (const inst of this.pieces.values()) {
      const g = this.pieceGate(inst);
      if (!g) continue;
      if (!best || g.need - g.have < best.need - best.have) best = g;
    }
    return best;
  }

  upgradePath(inst, pathId) {
    if (!this.canUpgradePath(inst, pathId)) return null;
    const wasComplete = this.isComplete(inst);
    const tierIdx = inst.paths[pathId];
    inst.paths[pathId] = tierIdx + 1;
    /* Tier NAO paga mais eixo. Enquanto pagava, aprofundar e alargar
       disputavam a mesma bolsa de 20 pontos, e alargar sempre ganhava — a
       carta de spell nova parece maior que "+18% de dano". Hoje o eixo so vem
       de etapa, entao profundidade e de graca e a tela de level up nao tem
       orcamento nenhum para o jogador administrar. */

    let evolved = null;
    const path = inst.def.paths[pathId];
    if (inst.paths[pathId] === PATH_RULES.tiers && path.evolvesInto) {
      evolved = this.evolve(inst, path.evolvesInto);
    }
    this.afterChange();
    // `completed` = a peca ACABOU de fechar o primeiro caminho, entao ganhou
    // aura agora. Fechar o segundo caminho da mesma peca nao acende de novo.
    const completed = !wasComplete && this.isComplete(inst) ? inst.def : null;
    return { tier: inst.paths[pathId], evolved, completed };
  }

  /* Evolucao: a peca troca id, nome, arte, trigger e efeitos — nao e upgrade
     numerico, e conversao. `key` NAO muda: e ela que mantem o medidor de dano,
     a propagacao de DoT e o anti-recursao funcionando atraves da troca. */
  evolve(inst, intoId) {
    const next = PIECES[intoId];
    if (!next) return null;
    const prevName = inst.def.name;
    inst.def = next;
    inst.defId = next.id;
    inst.evolvedInto = next.id;
    inst.s = {};
    inst.r = resolvePiece(inst, this);
    (TRIGGERS[inst.r.trigger.type] || TRIGGERS.auto_target).init(inst.s, this.game);
    return { from: prevName, to: next };
  }

  /* --- eixos e capstones -------------------------------------------------- */

  addAxis(axisId, n) {
    if (!axisId || !this.axis.hasOwnProperty(axisId)) return 0;
    const room = Math.min(
      AXIS_RULES.capPerAxis - this.axis[axisId],   // teto do eixo
      AXIS_RULES.pool - this.axisTotal,            // pool total
    );
    const gained = Math.max(0, Math.min(n, room));
    this.axis[axisId] += gained;
    return gained;
  }

  // Custo em pontos que uma oferta cobraria; usado para esconder ofertas que
  // nao caberiam mais no pool (senao o jogador escolhe algo que nao pontua).
  axisRoom(axisId, cost) {
    return Math.min(AXIS_RULES.capPerAxis - this.axis[axisId], this.axisLeft) >= cost;
  }

  checkCapstones() {
    const newly = [];
    for (const id in CAPSTONES) {
      if (this.capstones.has(id)) continue;
      const req = CAPSTONES[id].req;
      let ok = true;
      for (const a in req) if (this.axis[a] < req[a]) { ok = false; break; }
      if (!ok) continue;
      this.capstones.add(id);
      newly.push(CAPSTONES[id]);
    }
    return newly;
  }

  /* --- passivas ---------------------------------------------------------- */

  acquirePassive(id) {
    const p = PASSIVES[id];
    if (!p || this.passives.has(id)) return null;
    this.passives.set(id, 1);
    this.afterChange();
    return p;
  }
  passiveBlocked(id) {
    const p = PASSIVES[id];
    return !!(p.exclusive && this.passives.has(p.exclusive));
  }

  // Recalcula tudo que depende do estado da build. Chamado uma vez por
  // aquisicao — nunca por frame. Nao checa capstone: quem decide o momento de
  // checar e applyOffer, para conseguir mostrar o toast do desbloqueio.
  afterChange() {
    this.applyGlobals();
    this.rebuildEventHooks();
    this.resolveAll();
    /* A FORMA nao e mexida aqui de proposito. Quem avanca `player.formIdx` e
       `UI.checkForm`, depois de checkCapstones — se a build adiantasse o
       indice, o `idx === formIdx` de la nunca seria falso e a metamorfose
       aconteceria em silencio: sprite novo, sem toast, sem particula, sem
       pulso. O clímax da run nao pode chegar sem ninguem avisar. */
  }

  /* --- multiplicadores dinamicos ----------------------------------------
     Furia Contida / Pes de Cinza variam por segundo parado/andando, entao nao
     podem ser cozinhados no cache de resolucao. Ficam num segundo canal,
     aplicado no momento do dano. */
  updateDynamic() {
    const p = this.game.player;
    let mul = 1;
    for (const id of this.passives.keys()) {
      const d = PASSIVES[id].dynamic;
      if (!d) continue;
      const t = d.on === "still" ? p.stillTime : p.moveTime;
      mul *= 1 + Math.min(d.cap || 1, t * d.perSec);
    }
    this.game.dynDamage = mul;
  }

  /* --- tick -------------------------------------------------------------- */

  tick(dt, now) {
    for (const inst of this.pieces.values()) {
      const strat = TRIGGERS[inst.r.trigger.type];
      if (strat) strat.tick(this.game, inst, dt, now);
    }
  }

  /* Peca que so funciona junto de outra so pode ser oferecida depois que a
     habilitadora ja esta na build. Conflagrate sem Immolate, Seed of Corruption
     sem nenhum DoT ou Implosion sem nenhum demonio seriam cartas mortas: o
     jogador gasta a escolha e o poder nunca dispara.

     `requires: { piece: "<key>" }` exige a peca; `{ tag: "<tag>" }` exige
     qualquer peca daquela familia. */
  meetsRequires(def) {
    const r = def.requires;
    if (!r) return true;
    if (r.piece && !this.pieces.has(r.piece)) return false;
    if (r.tag) {
      let ok = false;
      for (const inst of this.pieces.values()) {
        if (inst.def.tags && inst.def.tags.indexOf(r.tag) >= 0) { ok = true; break; }
      }
      if (!ok) return false;
    }
    return true;
  }

  /* --- ofertas de level up ------------------------------------------------
     O level up e a BATIDA RAPIDA: so profundidade. Duas coisas entram no
     bolo, e as duas melhoram o que a build JA tem:

       - tier de caminho de uma peca possuida;
       - passiva global A PARTIR do nivel `passiveAt` — ela nao e uma spell a
         mais: nao tem tier, nao tem eixo e nao pede investimento depois. Ela so
         multiplica o que ja esta la (`pieceMods` sobre um `match`), e por isso
         cedo demais ela nao tem o que multiplicar.

     Peca nova SAIU daqui e mora nas etapas (`getMilestoneOffers`). Medido
     antes da separacao, numa run de 16 min: 17 escolhas no total, 13 spells na
     build e onze delas no tier 0 — o pool de 20 pontos era consumido por
     largura antes de qualquer trilha chegar perto do tier 5, e em 16 runs
     deram 0 capstones, 0 metamorfoses e 2 evolucoes. Com uma unica moeda de
     escolha por level up, comprar largura era sempre a carta que PARECIA
     maior, e o climax da progressao nunca chegava.

     Duas muletas sairam junto, e elas eram sintoma do mesmo problema: o peso
     extra para caminho ja comecado e o sort que jogava evolucao para a frente
     da fila existiam para compensar um bolo poluido por dezenas de pecas
     novas. Com o bolo so de profundidade, o sorteio volta a ser honesto —
     nao ha mais nada disputando com a trilha que o jogador comecou. */
  getOffers(count) {
    const pool = [];

    for (const inst of this.pieces.values()) {
      for (const pathId in inst.def.paths) {
        if (!this.canUpgradePath(inst, pathId)) continue;
        const path = inst.def.paths[pathId];
        const idx = inst.paths[pathId];
        const isEvo = idx + 1 === PATH_RULES.tiers && !!path.evolvesInto;
        pool.push({
          kind: "path", inst, pathId, path, tier: path.tiers[idx], tierIndex: idx,
          def: inst.def, isEvo,
          evo: isEvo ? PIECES[path.evolvesInto] : null,
          axis: AXES[inst.def.axis],
        });
      }
    }

    /* Passiva so entra no bolo a partir de `BALANCE.levelup.passiveAt`. Ela nao
       constroi nada sozinha: multiplica o que a build ja tem, entao nos
       primeiros niveis e um multiplicador de quase nada ocupando o lugar do
       tier que abriria a trilha.

       `pendingLevels` SAI DA CONTA porque o nivel que importa e o que ESTA
       escolha paga, nao o topo da fila. Com tres niveis enfileirados de uma vez,
       contar so `level` deixaria passiva aparecer na carta que paga o nivel 8 —
       e a trava seria de dois niveis em vez de dez. E a mesma leitura que o
       rotulo da tela ja faz (`UI.openLevelUp`). */
    const lv = this.game.player
      ? this.game.player.level - this.game.player.pendingLevels : 1;
    if (lv >= BALANCE.levelup.passiveAt) {
      for (const id in PASSIVES) {
        if (this.passives.has(id) || this.passiveBlocked(id)) continue;
        pool.push({ kind: "passive", id, def: PASSIVES[id] });
      }
    }

    shuffle(pool);

    /* Trava: no maximo 2 caminhos da mesma peca por saque. Com 1, aprofundar
       dependia de a peca certa cair de novo no sorteio seguinte; sem trava, um
       saque inteiro podia ser a mesma spell e a tela deixava de ser escolha. */
    const out = [], perPiece = new Map();
    for (let i = 0; i < pool.length && out.length < count; i++) {
      const o = pool[i];
      if (o.kind === "path") {
        const n = perPiece.get(o.inst.key) || 0;
        if (n >= 2) continue;
        perPiece.set(o.inst.key, n + 1);
      }
      out.push(o);
    }
    return out;
  }

  /* --- ofertas de etapa ----------------------------------------------------
     A BATIDA LENTA, e a unica fonte de ponto de eixo. As cartas mudam de forma
     conforme a run se define, e a virada e o eixo chegar a `unlockAt`:

     ANTES de qualquer eixo abrir, as tres cartas sao SPELLS sorteadas do
     catalogo inteiro — pode cair tres do mesmo eixo. Nao ha carta seca, entao
     no comeco a unica maneira de ganhar eixo e escolhendo uma spell, e cada
     uma carrega `spellPoints` para o eixo DELA. Isso faz o comeco da run ser
     descoberta e nao mira: o jogador ainda nao sabe o que a run vai oferecer,
     e escolher spell e como ele descobre.

     DEPOIS que um eixo chega a `unlockAt`, ele passa a ocupar um slot FIXO em
     toda etapa, e esse slot tem duas maneiras de ser levado: `axisPoints` secos
     ou a spell daquele eixo por `spellPoints`. Os slots que sobram continuam
     sorteados. Quando o segundo eixo abre, ele toma outro slot fixo; com os
     tres abertos nao sobra sorteio nenhum.

     A garantia chega quando o comprometimento chega — e e isso que separa este
     desenho de uma loteria. O eixo em que o jogador ja investiu cinco pontos
     nunca mais some da mesa, entao o capstone deixa de depender de o sorteio
     colaborar. Antes disso ele nao tem eixo para proteger.

     Cai daqui que a rampa de pontos e EMERGENTE e nao tabelada: cedo o jogador
     ganha de 1 em 1 (so ha spell), tarde ganha de 2 em 2 (a carta seca abriu).
     A curva vem da progressao dele, nao de uma coluna de numeros. */
  getMilestoneOffers() {
    const M = BALANCE.milestones;
    /* Ganho REAL, nao o de tabela: com o eixo no teto ou o pool no fim,
       `addAxis` entrega menos. Anunciar 2 e creditar 1 e a mentira mais cara
       que esta tela pode contar, porque nao ha como desfazer. */
    const real = (axisId, want) => Math.max(0, Math.min(want,
      AXIS_RULES.capPerAxis - this.axis[axisId], this.axisLeft));

    // Catalogo disponivel, por eixo — a mesma lista serve ao slot fixo e ao
    // sorteio, entao um eixo esgotado some das duas pontas de uma vez.
    const porEixo = {}, todas = [];
    for (const id in PIECES) {
      const def = PIECES[id];
      if (def.evolutionOnly || this.pieces.has(def.key)) continue;
      if (!this.meetsRequires(def)) continue;
      (porEixo[def.axis] || (porEixo[def.axis] = [])).push(def);
      todas.push(def);
    }
    for (const a in porEixo) shuffle(porEixo[a]);
    shuffle(todas);

    const out = [], usadas = new Set();
    const pegar = (lista, ok) => {
      for (const def of lista) {
        if (usadas.has(def.id) || (ok && !ok(def))) continue;
        usadas.add(def.id); return def;
      }
      return null;
    };

    // 1. slots fixos: um por eixo aberto, na ordem em que os eixos estao no
    //    dado (estavel entre etapas — carta fixa que dança de lugar deixa de
    //    ser referencia visual).
    for (const axisId in AXES) {
      if (this.axis[axisId] < M.unlockAt) continue;
      /* Maneira que credita ZERO nao entra. A regra ja valia para as cartas
         sorteadas e faltava aqui: com o eixo comprometido no teto de 15, o slot
         fixo oferecia "SÓ O EIXO +0 · eixo no teto" — um botao que o jogador
         pode clicar e que nao faz nada, na unica tela do jogo cujo clique nao
         se desfaz. Se as duas maneiras zeram, o slot inteiro sai da mesa e o
         sorteio ocupa o lugar dele: eixo que nao anda nao tem pergunta a fazer. */
      const seco = real(axisId, M.axisPoints);
      const piece = seco || real(axisId, M.spellPoints) ? pegar(porEixo[axisId] || []) : null;
      const molhado = piece ? real(axisId, M.spellPoints) : 0;
      if (!seco && !molhado) continue;
      out.push({
        kind: "milestone", axisId, axis: AXES[axisId], piece, locked: true,
        dry: seco ? { want: M.axisPoints, gain: seco } : null,
        wet: molhado ? { want: M.spellPoints, gain: molhado } : null,
      });
    }

    /* 2. o resto: spell sorteada do catalogo INTEIRO. Sem carta seca — antes de
          abrir um eixo, ganhar ponto e escolher spell.

          O sorteio ignora spell cujo eixo nao credita mais nada. Carta que
          anuncia +0 nao e oferta, e um botao morto numa tela cujo assunto
          INTEIRO e o ponto de eixo — e com o eixo comprometido no teto de 15 e
          o catalogo dele cheio de spells, tres cartas mortas na mesma etapa
          deixam de ser azar: elas travam a pool com ponto por gastar. */
    while (out.length < M.cards) {
      const piece = pegar(todas, (def) => real(def.axis, M.spellPoints) > 0);
      if (!piece) break;
      out.push({
        kind: "milestone", axisId: piece.axis, axis: AXES[piece.axis], piece, locked: false,
        dry: null,
        wet: { want: M.spellPoints, gain: real(piece.axis, M.spellPoints) },
      });
    }

    /* Mesa que nao anda: sem este fallback a etapa abriria vazia (fim do
       catalogo antes de abrir eixo) ou com tres cartas de +0 (todo eixo com
       espaco ja teve o catalogo esgotado). Nos dois casos a pool ficaria sem
       como ser gasta, e quem para as etapas e a POOL — o jogo devolveria uma
       tela por marco ate o fim da run sem nunca entregar o ponto.

       Entrega o eixo seco de quem tem mais espaco: nao ha spell para oferecer,
       entao nao ha troca a fazer. Se a mesa ja esta cheia, ele toma o lugar da
       ultima carta em vez de estourar o teto de `cards`. */
    if (!out.some((o) => (o.dry && o.dry.gain > 0) || (o.wet && o.wet.gain > 0))) {
      let melhor = null;
      for (const axisId in AXES) {
        const g = real(axisId, M.axisPoints);
        if (!melhor || g > melhor.g) melhor = { axisId, g };
      }
      if (melhor && melhor.g > 0) {
        const carta = {
          kind: "milestone", axisId: melhor.axisId, axis: AXES[melhor.axisId],
          piece: null, locked: true,
          dry: { want: M.axisPoints, gain: melhor.g }, wet: null,
        };
        if (out.length >= M.cards) out[out.length - 1] = carta;
        else out.push(carta);
      }
    }
    return out;
  }

  /* `takePiece` diz qual das maneiras o jogador escolheu. Carta sorteada so tem
     a maneira com spell; carta de eixo aberto tem as duas.

     A spell entra como `free`: o eixo dela ja foi pago pelo `spellPoints` que a
     propria carta creditou. Cobrar de novo em `acquirePiece` seria cobrar duas
     vezes pela mesma largura. */
  applyMilestone(o, takePiece) {
    const take = o.dry ? !!(takePiece && o.piece) : !!o.piece;
    const step = take ? o.wet : o.dry;
    const gained = step ? this.addAxis(o.axisId, step.want) : 0;
    if (take) this.acquirePiece(o.piece.id, true);
    else this.afterChange();
    const caps = this.checkCapstones();
    if (caps.length) this.afterChange();
    return { gained, piece: take ? o.piece : null, caps };
  }

  /* Aplica uma oferta de LEVEL UP. Retorna { caps, evolved, completed } para
     os toasts: `completed` vira aura, `caps` vira metamorfose.

     `caps` continua sendo checado aqui apesar de nenhuma oferta de level up
     dar ponto de eixo: uma passiva pode mexer em stats que um capstone le, e
     custa uma varredura de oito entradas por escolha. Capstone que abre em
     silencio e o climax da run chegando sem ninguem avisar. */
  applyOffer(o) {
    let evolved = null, completed = null;
    if (o.kind === "passive") this.acquirePassive(o.id);
    else if (o.kind === "path") {
      const res = this.upgradePath(o.inst, o.pathId);
      if (res) { evolved = res.evolved; completed = res.completed; }
    }
    const caps = this.checkCapstones();
    if (caps.length) this.afterChange();
    return { caps, evolved, completed };
  }
}
