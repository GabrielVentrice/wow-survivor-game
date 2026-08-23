"use strict";
/* =========================================================================
   ASPECTOS — o subsistema exclusivo do Hunter.

   Uma stance que liga e desliga SOZINHA conforme o estado do jogo. Não há
   input: o único input em combate continua sendo movimento, e o aspecto é a
   leitura que o motor faz da posição em que o jogador se meteu.

   Três coisas decidem o desenho, e as três estão nos comentários abaixo:

   1. O pipeline de stats roda UMA VEZ POR AQUISIÇÃO, não por tique. Um aspecto
      que mudasse `inst.r` teria que re-resolver a build inteira toda vez que
      ligasse — e `resolveAll` clona a árvore de efeitos de toda peça. Então o
      aspecto NÃO mexe em stat: ele escreve em canais vivos, lidos no ponto de
      uso. É a mesma forma de `game.cooldownMul` (ver `TRIGGERS.cd`), que
      existe pela mesma razão: os nomes de campo variam demais para virar mod.

   2. Sem HISTERESE o aspecto pisca. Um limiar único faz o estado bater e voltar
      no exato momento em que o jogador está na borda da condição — que é onde
      ele mais fica, porque a condição é sobre a posição dele. São dois guardas:
      o VÃO entre ligar e desligar, e o TEMPO MÍNIMO de permanência.

   3. Aspecto é ESTADO, não evento. Ele não emite vfx: quem desenha é
      `Player.draw`, enquanto dura — a mesma regra que separa a casca do escudo
      de um "vfx de escudo", e que já tinha tirado o Burning Rush do evento.
   ========================================================================= */

/* As LEITURAS. Cada uma devolve um número, e a condição compara esse número
   contra `on`/`off`. São poucas de propósito: leitura nova é um estado novo do
   jogo que passa a ser observável, não uma variação de tuning. */
const ASPECT_READS = {
  // quantos inimigos dentro do alcance — a única que custa consulta de grid,
  // e é por isso que a avaliação inteira é gasta em `BALANCE.aspect.interval`
  enemies(game, a) {
    let n = 0;
    const p = game.player, r = a.when.range || 320;
    game.grid.forRadius(p.x, p.y, r, (e) => { if (e.hp > 0) n++; });
    return n;
  },
  hp(game) { return game.player.hp / game.player.maxHp; },
  still(game) { return game.player.stillTime; },
  beasts(game) { return game.minions.count(); },
};

/* O catálogo. `when` declara a condição e `buff` o que ela liga.

   A DIREÇÃO da condição é implícita: se `on > off` ela é de subida (liga ao
   passar de `on`, desliga ao cair abaixo de `off`); se `on < off` é de descida.
   O vão entre os dois É a histerese, e ele não pode ser esquecido porque não é
   um campo separado — `driver_aspect` reprova `on === off`.

   `group` é a exclusão mútua: dentro de um grupo só o de maior `priority` que
   estiver satisfeito fica de pé. */
const ASPECTS = {
  cheetah: {
    id: "cheetah", name: "Guepardo", color: "#e0b833", group: "postura", priority: 1,
    desc: "Sem inimigo por perto, você corre muito mais rápido.",
    when: { read: "enemies", range: 340, on: 0, off: 2 },
    buff: { speedMul: 1.6 },
  },
  hawk: {
    id: "hawk", name: "Falcão", color: "#3878e0", group: "postura", priority: 2,
    desc: "Parado há dois segundos, seus tiros batem muito mais forte.",
    when: { read: "still", on: 2, off: 0.6 },
    buff: { tagDamage: { tag: "shot", mul: 1.4 } },
  },
  turtle: {
    id: "turtle", name: "Tartaruga", color: "#8790a8", group: "vitalidade", priority: 2,
    desc: "Abaixo de 30% de vida, você quase não toma dano — e quase não causa.",
    when: { read: "hp", on: 0.3, off: 0.45 },
    buff: { dmgReduction: 0.85, damageMul: 0.15 },
  },
  viper: {
    id: "viper", name: "Víbora", color: "#2fd47e", group: "vitalidade", priority: 1,
    desc: "Acima de 90% de vida, parte do dano que você causa volta como cura.",
    when: { read: "hp", on: 0.9, off: 0.75 },
    buff: { lifesteal: 0.2 },
  },
  eagle: {
    id: "eagle", name: "Águia", color: "#6ea6f5", group: null, priority: 1,
    desc: "Com cinco ou mais inimigos por perto, todas as suas peças alcançam mais longe.",
    when: { read: "enemies", range: 360, on: 5, off: 3 },
    buff: { rangeMul: 1.5 },
  },
  wild: {
    id: "wild", name: "Selvagem", color: "#f5d45c", group: null, priority: 1,
    desc: "Com três ou mais bichos vivos, a matilha inteira fica mais rápida e bate mais.",
    when: { read: "beasts", on: 3, off: 2 },
    buff: { beastMul: 1.45 },
  },
};

/* `rgb` resolvido UMA vez: o render lê a cor dos aspectos ativos por frame, e
   `hexRgb` aloca uma string. Três por frame são 180 por segundo para dizer
   sempre a mesma coisa. */
for (const id in ASPECTS) ASPECTS[id].rgb = hexRgb(ASPECTS[id].color);

/* Os CANAIS. Zerados e recompostos a cada avaliação — nunca acumulados, senão
   um aspecto que desliga deixa resíduo. */
function resetChannels(ch) {
  ch.speedMul = 1;
  ch.rangeMul = 1;
  ch.dmgReduction = 0;
  ch.damageMul = 1;
  ch.lifesteal = 0;
  ch.beastMul = 1;
  ch.tagKeys = null;      // Set de `key` das peças que casam com a tag
  ch.tagMul = 1;
}

class AspectSystem {
  constructor(game) {
    this.game = game;
    this.slots = [];        // ids registrados, na ordem de aquisição
    this.state = new Map(); // id -> { on, since }
    this.active = [];       // ids ativos AGORA, para o render
    this.ch = {};
    resetChannels(this.ch);
    this.nextAt = 0;
  }

  reset() {
    this.slots.length = 0;
    this.state.clear();
    this.active.length = 0;
    resetChannels(this.ch);
    this.nextAt = 0;
  }

  /* Registrado pelo trigger `aspect`. O teto de slots é o que faz a escolha
     existir: com seis aspectos no catálogo e três slots, levar um é recusar
     outro — a mesma regra do pool de eixo, em miniatura. */
  register(id) {
    if (!ASPECTS[id] || this.slots.indexOf(id) >= 0) return false;
    if (this.slots.length >= BALANCE.aspect.slots) return false;
    this.slots.push(id);
    this.state.set(id, { on: false, since: -99 });
    return true;
  }

  has(id) { return this.slots.indexOf(id) >= 0; }

  /* A avaliação. Gasta em `interval` e não por sub-step: a leitura `enemies` é
     uma consulta de grid, e três por frame por aspecto seria trabalho por nada
     — nenhuma dessas condições muda em 0,15s de um jeito que o jogador perceba. */
  tick(dt, now) {
    if (!this.slots.length) return;
    if (now < this.nextAt) return;
    this.nextAt = now + BALANCE.aspect.interval;

    const hold = BALANCE.aspect.hold;
    const querem = [];
    for (const id of this.slots) {
      const a = ASPECTS[id], st = this.state.get(id);
      const v = ASPECT_READS[a.when.read](this.game, a);
      const sobe = a.when.on > a.when.off;
      /* Dois guardas, e cada um mata um jeito diferente de piscar.

         O VÃO mata o tremor no limiar: com `on` 5 e `off` 3, um inimigo
         entrando e saindo do alcance não liga e desliga a Águia — ele teria
         que levar a conta de 5 para 2.

         O TEMPO mata o pisca de quem atravessa o vão inteiro rápido: a horda
         fecha e abre em menos de um segundo, e sem o piso o aspecto seguiria
         essa cadência. Ele vale para os dois lados: ligar cedo demais é tão
         ruim quanto desligar cedo demais. */
      const podeVirar = now - st.since >= hold;
      let quer = st.on;
      if (!st.on && podeVirar) quer = sobe ? v >= a.when.on : v <= a.when.on;
      else if (st.on && podeVirar) quer = sobe ? v > a.when.off : v < a.when.off;
      if (quer !== st.on) { st.on = quer; st.since = now; }
      if (st.on) querem.push(a);
    }

    /* EXCLUSÃO MÚTUA. Dentro de um grupo só o de maior prioridade fica de pé —
       Guepardo (correndo, sem ninguém perto) e Falcão (parado, mirando) são
       posturas opostas, e vê-las acesas juntas diria que o corpo está fazendo
       as duas coisas. O aspecto perdedor continua "ligado" no estado: ele só
       não CONTRIBUI. Desligá-lo aqui reiniciaria o relógio de permanência dele
       e o pisca voltaria pela porta dos fundos. */
    const porGrupo = new Map();
    const vencedores = [];
    for (const a of querem) {
      if (!a.group) { vencedores.push(a); continue; }
      const atual = porGrupo.get(a.group);
      if (!atual || a.priority > atual.priority) porGrupo.set(a.group, a);
    }
    for (const a of porGrupo.values()) vencedores.push(a);

    const ch = this.ch;
    resetChannels(ch);
    this.active.length = 0;
    for (const a of vencedores) {
      this.active.push(a.id);
      const b = a.buff;
      if (b.speedMul) ch.speedMul *= b.speedMul;
      if (b.rangeMul) ch.rangeMul *= b.rangeMul;
      if (b.dmgReduction) ch.dmgReduction = Math.max(ch.dmgReduction, b.dmgReduction);
      if (b.damageMul != null) ch.damageMul *= b.damageMul;
      if (b.lifesteal) ch.lifesteal += b.lifesteal;
      if (b.beastMul) ch.beastMul *= b.beastMul;
      if (b.tagDamage) {
        /* O bônus por TAG vira um Set de `key`, montado aqui e não consultado
           no funil de dano. `damageEnemy` roda milhares de vezes por segundo:
           perguntar `build.pieces.get(key).def.tags.indexOf(...)` ali dentro
           seria uma busca por acerto. O Set é montado uma vez por virada. */
        ch.tagKeys = ch.tagKeys || new Set();
        ch.tagMul *= b.tagDamage.mul;
        for (const inst of this.game.build.pieces.values()) {
          const tags = inst.def.tags;
          if (tags && tags.indexOf(b.tagDamage.tag) >= 0) ch.tagKeys.add(inst.key);
        }
      }
    }
  }
}
