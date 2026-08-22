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

  rebuildVfx() {
    this.vfx.length = 0;
    for (const inst of this.pieces.values()) {
      const v = PIECE_VFX[inst.def.vfx];
      if (!v) continue;
      this.vfx.push({
        under: v.under, over: v.over, color: inst.def.color,
        rgb: hexRgb(inst.def.color), lvl: this.pieceTier(inst),
      });
    }
  }

  /* --- pecas ------------------------------------------------------------- */

  has(key) { return this.pieces.has(key); }
  get(key) { return this.pieces.get(key); }
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
     `freeTier`. E o que impede uma peca de virar tudo ao mesmo tempo. */
  canUpgradePath(inst, pathId) {
    const cur = inst.paths[pathId];
    if (cur >= PATH_RULES.tiers) return false;
    if (cur < PATH_RULES.freeTier) return true;
    let deep = 0;
    for (const p in inst.paths) {
      if (p !== pathId && inst.paths[p] > PATH_RULES.freeTier) deep++;
    }
    return deep < PATH_RULES.maxDeep;
  }

  upgradePath(inst, pathId) {
    if (!this.canUpgradePath(inst, pathId)) return null;
    const tierIdx = inst.paths[pathId];
    inst.paths[pathId] = tierIdx + 1;
    // investir fundo num caminho aprofunda o eixo da peca
    if (tierIdx + 1 > PATH_RULES.freeTier) this.addAxis(inst.def.axis, 1);

    let evolved = null;
    const path = inst.def.paths[pathId];
    if (inst.paths[pathId] === PATH_RULES.tiers && path.evolvesInto) {
      evolved = this.evolve(inst, path.evolvesInto);
    }
    this.afterChange();
    return { tier: inst.paths[pathId], evolved };
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
    this.game.player.formIdx = this.game.player.formIndex(this.axisTotal);
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
     Um unico pool: peca nova, tier de caminho, ou passiva global. */
  getOffers(count) {
    const pool = [];

    // 1. pecas novas que ainda cabem no pool de eixos
    for (const id in PIECES) {
      const def = PIECES[id];
      if (def.evolutionOnly || this.pieces.has(def.key)) continue;
      if (!this.meetsRequires(def)) continue;
      const cost = def.axisPoints != null ? def.axisPoints : 2;
      if (!this.axisRoom(def.axis, cost)) continue;
      pool.push({ kind: "piece", id, def, axis: AXES[def.axis] });
    }

    // 2. tiers de caminho das pecas possuidas
    for (const inst of this.pieces.values()) {
      for (const pathId in inst.def.paths) {
        if (!this.canUpgradePath(inst, pathId)) continue;
        const path = inst.def.paths[pathId];
        const idx = inst.paths[pathId];
        const tier = path.tiers[idx];
        const isEvo = idx + 1 === PATH_RULES.tiers && !!path.evolvesInto;
        pool.push({
          kind: "path", inst, pathId, path, tier, tierIndex: idx,
          def: inst.def, isEvo,
          evo: isEvo ? PIECES[path.evolvesInto] : null,
          axis: AXES[inst.def.axis],
        });
      }
    }

    // 3. passivas globais nao possuidas e nao bloqueadas
    for (const id in PASSIVES) {
      if (this.passives.has(id) || this.passiveBlocked(id)) continue;
      pool.push({ kind: "passive", id, def: PASSIVES[id] });
    }

    shuffle(pool);

    // Garante variedade: no maximo 2 ofertas da mesma peca no mesmo saque.
    const out = [], perPiece = new Map();
    for (let i = 0; i < pool.length && out.length < count; i++) {
      const o = pool[i];
      if (o.kind === "path") {
        const n = perPiece.get(o.inst.key) || 0;
        if (n >= 1) continue;
        perPiece.set(o.inst.key, n + 1);
      }
      out.push(o);
    }
    return out;
  }

  // Aplica uma oferta escolhida. Retorna { caps, evolved } para os toasts.
  applyOffer(o) {
    let evolved = null;
    if (o.kind === "piece") this.acquirePiece(o.id);
    else if (o.kind === "passive") this.acquirePassive(o.id);
    else if (o.kind === "path") {
      const res = this.upgradePath(o.inst, o.pathId);
      if (res) evolved = res.evolved;
    }
    const caps = this.checkCapstones();
    if (caps.length) this.afterChange();
    return { caps, evolved };
  }
}
