"use strict";
/* =========================================================================
   TRIGGERS — QUANDO uma peca dispara. Estrategias plugaveis: a peca declara
   `trigger: { type: "...", ...params }` e trocar o tipo por dado muda o
   comportamento sem tocar em codigo — e o que a evolucao faz.

   Cada trigger reage ao movimento do player de um jeito diferente. Como o
   unico input em combate e movimento, e AQUI que a decisao de posicionamento
   do jogador vira mecanica.

   Todo agendamento usa `now` (relogio de simulacao) em vez de contar frames:
   `update` roda varias vezes por frame no sub-stepping, e um trigger baseado
   em "uma vez por frame" dispararia 2-4x em timeScale 3x.
   ========================================================================= */

// Dispara a lista de efeitos da peca a partir de um ponto/alvo.
function firePiece(game, inst, x, y, target, dirX, dirY, now, amount, slot) {
  const c = pushCtx(game);
  c.key = inst.key;
  c.color = inst.def.color;
  c.now = now;
  c.x = x; c.y = y;
  c.target = target;
  c.dirX = dirX; c.dirY = dirY;
  /* `amount` e o valor que o EVENTO trouxe, e ele existe por causa de um bug
     que so apareceu quando alguem foi procurar por que a peca nao desenhava
     nada: Soul Leech promete "todo dano que voce causa vira casca" e converte
     uma fracao de `c.amount` — que era zerado aqui, sempre. A peca dava zero
     de escudo desde que existe. Quem dispara por evento passa o numero do
     evento; quem dispara por cooldown continua comecando do zero, porque nao
     ha nada anterior para herdar. */
  c.amount = amount || 0;
  // Posicao no leque, so para quem invoca em formacao (`pack`). `pushCtx` ja
  // zerou, entao quem nao manda nada continua sorteando.
  if (slot != null) c.slot = slot;
  c._told = false;              // a pilha e reaproveitada; ver telegraph()
  runEffects(game, inst.r.effects, c);
  popCtx(game);
  inst.casts++;
  /* O corpo participa do que a build faz. Aqui e o unico funil por onde TODA
     peca dispara, entao e o unico lugar que nao precisa ser repetido em cada
     trigger — e `reactive` fica de fora porque ele e o tique de um DoT que ja
     esta no ar, nao um novo conjuro. */
  if (inst.r.trigger.type !== "reactive") {
    game.player.castPulse();
    game.emitSfx("cast", x, y, 0);
  }
}

// Nihilam deixa TODOS os cooldowns 30% mais lentos. Aplicado num unico ponto
// em vez de espalhado pelos stats: os nomes de campo variam demais entre os
// triggers (cooldown, interval, chargeTime, respawn) para virar mod numerico.
function cd(game, v) { return v * game.cooldownMul; }

const TRIGGERS = {

  /* Dispara no cooldown, mirando no(s) inimigo(s) mais proximo(s).
     O baseline: recompensa manter inimigos dentro do alcance. */
  auto_target: {
    init(s) { s.nextAt = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (now < s.nextAt) return;
      const n = Math.max(1, Math.round(t.targets || 1));
      if (n === 1) {
        const target = game.nearestEnemy(p.x, p.y, t.range);
        if (!target) return;
        s.nextAt = now + cd(game, t.cooldown);
        firePiece(game, inst, p.x, p.y, target, p.dirX, p.dirY, now);
      } else {
        const list = game.nearestEnemies(p.x, p.y, t.range, n);
        if (!list.length) return;
        s.nextAt = now + cd(game, t.cooldown);
        for (let i = 0; i < list.length; i++) {
          firePiece(game, inst, p.x, p.y, list[i], p.dirX, p.dirY, now);
        }
      }
    },
  },

  /* Pulsa em intervalo num raio ao redor do player. Nao mira: recompensa
     ficar no meio da horda, o oposto do auto_target. */
  aura: {
    init(s) { s.nextAt = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (now < s.nextAt) return;
      s.nextAt = now + cd(game, t.interval);
      firePiece(game, inst, p.x, p.y, null, p.dirX, p.dirY, now);
    },
  },

  /* Mantem N entidades girando em torno do player. Dano por contato: o
     jogador "empurra" o orbital contra os inimigos com o proprio movimento. */
  orbital: {
    init(s) { s.nextAt = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (now < s.nextAt) return;
      if (game.minions.countOf(inst.key) >= (t.count || 1)) return;
      s.nextAt = now + cd(game, t.respawn || 1.5);
      firePiece(game, inst, p.x, p.y, null, p.dirX, p.dirY, now);
    },
  },

  /* Deixa efeito no chao conforme o player anda. Amostrado por DISTANCIA
     percorrida, nao por tempo: andar em circulos apertados nao gera mais
     poca do que atravessar o mapa, e a cadencia nao muda com a velocidade. */
  trail: {
    init(s) { s.lastDist = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (!p.moving) return;
      const step = t.distance || 90;
      if (p.trailDist - s.lastDist < step) return;
      s.lastDist = p.trailDist;
      firePiece(game, inst, p.x, p.y, null, p.dirX, p.dirY, now);
    },
  },

  /* Acumula carga enquanto o player esta parado. Andar DRENA a carga em vez
     de zera-la.

     O zero era uma regra elegante e um desastre medido: `rainOfFire` fez 0% de
     dano em 9 de 9 runs, e `maleficRapture` idem. Num survivors voce corrige a
     posicao o tempo todo, e cada meio passo apagava a carga inteira — a peca
     nunca disparava. Com dreno a 2x, parar continua sendo a mecanica (fica
     pronta em 1 chargeTime), mas um ajuste de meio segundo custa um segundo de
     carga em vez da barra toda. A identidade "torre" sobrevive; a punicao
     binaria, nao. */
  rooted: {
    init(s) { s.charge = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (p.moving) { s.charge = Math.max(0, s.charge - dt * 2); return; }
      s.charge += dt;
      if (s.charge < cd(game, t.chargeTime)) return;
      s.charge = 0;
      const target = t.range > 0 ? game.nearestEnemy(p.x, p.y, t.range) : null;
      if (t.needsTarget && !target) return;
      firePiece(game, inst, p.x, p.y, target, p.dirX, p.dirY, now);
    },
    // fracao carregada, para a HUD desenhar o anel de carga
    charge(inst) {
      const t = inst.r.trigger;
      return Math.min(1, inst.s.charge / (t.chargeTime * (window.game ? window.game.cooldownMul : 1)));
    },
  },

  /* Dispara no vetor de movimento do player. So enquanto ele anda: a mira
     e o proprio deslocamento. */
  directional: {
    init(s) { s.nextAt = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (!p.moving) return;
      if (now < s.nextAt) return;
      s.nextAt = now + cd(game, t.cooldown);
      const d = t.distance || 0;
      firePiece(game, inst, p.x + p.dirX * d, p.y + p.dirY * d, null, p.dirX, p.dirY, now);
    },
  },

  /* Mantem uma populacao de demonios com IA propria. O trigger so repoe;
     quem decide como o demonio se comporta e o `ai` no efeito `summon`. */
  autonomous: {
    init(s) { s.nextAt = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (now < s.nextAt) return;
      if (game.minions.countOf(inst.key) >= (t.count || 1)) return;
      s.nextAt = now + cd(game, t.interval || 4);
      firePiece(game, inst, p.x, p.y, null, p.dirX, p.dirY, now);
    },
  },

  /* Planta o efeito A FRENTE do player, no vetor de movimento, a uma distancia
     configuravel. O irmao de `directional`, e a diferenca e uma linha: aquele
     exige `p.moving`, este nao.

     Nao e detalhe. `directional` e uma peca que so existe enquanto o jogador
     anda — a mira E o deslocamento. `leading` e uma peca de ANTECIPACAO: ela
     cobra o chao para onde o jogador esta indo, e parar de andar nao pode
     desligar isso, senao a bomba deixa de sair exatamente quando o jogador
     estanca para deixar a horda chegar.

     `p.dirX/dirY` ja e "ultimo vetor de movimento nao-nulo, normalizado"
     (Player.reset), entao a regra de "se estiver parado, usa a ultima direcao
     valida" nao precisa de estado proprio: ela ja e o contrato do campo. */
  leading: {
    init(s) { s.nextAt = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (now < s.nextAt) return;
      s.nextAt = now + cd(game, t.cooldown);
      const d = t.distance || 160;
      firePiece(game, inst, p.x + p.dirX * d, p.y + p.dirY * d, null, p.dirX, p.dirY, now);
    },
  },

  /* Mantem uma MATILHA. A populacao e reposta como `autonomous` faz, e o que
     muda e como ela nasce e como ela anda.

     Duas coisas, e nenhuma cabe no `autonomous`:

     1. Nasce em LEVA (`litter`), nao um por intervalo. Uma matilha que entra
        um bicho de cada vez nunca e uma matilha em tela: com `interval` de 4s
        e `count` 5, os dois primeiros ja morreram quando o quinto chega.
     2. O `angle` do spawn e o INDICE do slot, nao um angulo sorteado.
        `MINION_AI._slot` ja usa `m.angle` como identidade de posicao no leque
        — sorteando, dois bichos caem no mesmo ponto do flanco e a formacao
        vira uma pilha. Quem reparte o leque e o trigger, porque so ele sabe
        quantos vao existir.

     A IA de cercar mora em `MINION_AI.flank`: o trigger repoe, o `ai` do efeito
     `summon` decide o comportamento. E a mesma separacao que `autonomous` ja
     tem, e e ela que deixa uma peca de matilha usar `chase` se o dado quiser. */
  pack: {
    init(s) { s.nextAt = 0; s.slot = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (now < s.nextAt) return;
      const cap = Math.max(1, Math.round(t.count || 3));
      const alive = game.minions.countOf(inst.key);
      if (alive >= cap) return;
      s.nextAt = now + cd(game, t.interval || 6);
      const litter = Math.min(cap - alive, Math.max(1, Math.round(t.litter || cap)));
      for (let i = 0; i < litter; i++) {
        /* O slot avanca em volta do circulo e nunca reinicia: um bicho que
           morre e reposto ocupa a proxima posicao do leque em vez de renascer
           por cima do irmao que sobreviveu. */
        const slot = (s.slot++ % cap) / cap * Math.PI * 2;
        firePiece(game, inst, p.x, p.y, null, Math.cos(slot), Math.sin(slot), now, 0, slot);
      }
    },
  },

  /* ARMADILHA. Planta no ponto onde o player esta, fica INERTE, e cobra quando
     um inimigo encosta. Cargas limitadas, rearme por cooldown.

     "Carga" aqui e quantas podem estar plantadas AO MESMO TEMPO, e ela e
     contada no mundo (`game.countArmed`) em vez de num contador do trigger. E
     a mesma escolha de `orbital` e `autonomous`, que perguntam
     `minions.countOf` em vez de guardarem populacao propria — e ela existe
     porque o trigger nao e avisado quando a armadilha dispara. Um contador
     local sairia do ar no primeiro inimigo que pisasse, e a peca pararia de
     rearmar sem ninguem perceber.

     A armadilha em si e uma `area_persistent` com `armed: true`: o motor ja
     tinha posicao fixa, raio, vida, consulta pelo grid e payload. O que faltava
     era o estado inerte — ver Game.updateAreas. */
  trap: {
    init(s) { s.nextAt = 0; },
    tick(game, inst, dt, now) {
      const s = inst.s, t = inst.r.trigger, p = game.player;
      if (now < s.nextAt) return;
      if (game.countArmed(inst.key) >= Math.max(1, Math.round(t.charges || 1))) return;
      s.nextAt = now + cd(game, t.cooldown || 4);
      firePiece(game, inst, p.x, p.y, null, p.dirX, p.dirY, now);
    },
  },

  /* Dispara em evento, nao em cooldown. O cooldown existe so como piso
     anti-spam — e ele que impede que uma leva morrendo junto dispare
     cinquenta explosoes no mesmo frame. */
  reactive: {
    init(s) { s.nextAt = 0; },
    tick() {},
    onEvent(game, inst, payload, now) {
      const s = inst.s, t = inst.r.trigger;
      if (now < s.nextAt) return;
      const p = game.player;

      let target = payload.enemy || null;
      if (t.condition === "enemy_below") {
        if (!target || target.hp / target.maxHp > (t.pct || 0.2)) return;
      } else if (t.condition === "player_below") {
        if (p.hp / p.maxHp > (t.pct || 0.35)) return;
      } else if (t.condition === "has_dot") {
        // sem `dotKey`, basta ter qualquer DoT ativo
        if (!target) return;
        if (t.dotKey ? !game.dots.find(target, t.dotKey) : !target.dots.length) return;
      }
      if (t.retarget === "nearest") target = game.nearestEnemy(p.x, p.y, t.range || 400);
      if (t.needsTarget && !target) return;

      s.nextAt = now + cd(game, t.cooldown || 0.4);
      const x = t.atPlayer || !target ? p.x : target.x;
      const y = t.atPlayer || !target ? p.y : target.y;
      firePiece(game, inst, x, y, target, p.dirX, p.dirY, now, payload.amount);
    },
  },
};
