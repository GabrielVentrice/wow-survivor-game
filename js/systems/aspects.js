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
  /* A PRESSAO — que fracao da horda em volta esta COLADA em voce.

     E a leitura posicional, e ela existe porque a contagem crua nao servia:
     medida numa run de 8 min, a densidade dentro de 360 unidades vai de 21
     corpos no minuto 3 para 160 no minuto 7. Um limiar em numero de corpos nao
     mede posicao, mede RELOGIO — a postura ligaria pelo minuto da run e nao
     pelo lugar em que o jogador se meteu, que e o contrario do que um aspecto
     e. Foi o que acontecia: "sem inimigo por perto" (Guepardo) valia 1,3% do
     tempo e "cinco por perto" (Aguia) valia 98%. Uma nunca ligava, a outra
     nunca desligava, e nenhuma das duas era uma postura.

     A razao entre o anel de dentro e o de fora e ESTAVEL na mesma run: 0,20 ·
     0,22 · 0,22 · 0,22 · 0,21 · 0,23 · 0,20 · 0,17 por minuto, enquanto a
     contagem crua multiplicava por oito. Ela mede o que o jogador controla —
     estar no meio ou na beirada —, e nao o quanto o spawner ja cresceu.

     A linha de base e geometrica: com densidade uniforme a razao seria
     `inner²/range²` (0,37 nos raios de hoje). Acima disso o jogador esta
     cercado; abaixo, na borda. E com pouca gente no anel de fora a razao vira
     ruido de um corpo so, entao ela devolve 0 — que e a leitura certa: campo
     vazio E a borda. */
  press(game, a, lim) {
    /* Recebe os limiares JA resolvidos (`_when`), e nao `a.when` cru: hoje o
       afrouxamento do tier 5 so mexe em `on`/`off`, mas ler a geometria de um
       objeto e comparar contra outro e a armadilha que espera o primeiro
       afrouxamento que mexa em `range`. */
    const p = game.player, w = lim || a.when;
    const r = w.range || 360, ri = w.inner || Math.round(r * 0.6), ri2 = ri * ri;
    let dentro = 0, fora = 0;
    game.grid.forRadius(p.x, p.y, r, (e) => {
      if (e.hp <= 0) return;
      fora++;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy <= ri2) dentro++;
    });
    return fora >= (w.minPop || 4) ? dentro / fora : 0;
  },
  hp(game) { return game.player.hp / game.player.maxHp; },
  still(game) { return game.player.stillTime; },
  /* A MATILHA GRANDE — quantos bichos vivos, e nada de denominador.

     Contagem crua com o limiar antigo (3 bichos) valia 100% do tempo numa
     build de Matilha e 0% em toda outra: nao era postura, era um `if` sobre o
     eixo escolhido. O limiar de hoje sai da medida — numa build de Matilha a
     conta oscila entre 6 e 14 o tempo todo, porque bicho morre —, entao 8/5
     e um estado que se perde e se recupera. Oito e onde uma build de Matilha
     ja comprometida se sustenta no tier 0 (medido em mesa: 8 bichos com cinco
     pecas que invocam); acima disso o limiar so ligaria depois dos tiers, e a
     peca nasceria morta na etapa em que o jogador a escolhe.

     E ele nao tem denominador de proposito. A primeira versao dividia pela
     "capacidade da build", somando os tetos dos efeitos `summon` resolvidos, e
     o numero estava errado por construcao: o motor NAO mantem essa conta. O
     teto e cobrado por peca (`countOf(c.key)`), hook tambem invoca sem
     declarar `summon`, e o resultado media 14 bichos contra um teto calculado
     de 8 — a fracao saturava em 1 e o aspecto ficava 95,7% ligado. Leitura que
     inventa um numero que o jogo nao tem mede a propria invencao. */
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
    desc: "Na borda da horda, você corre muito mais rápido.",
    when: { read: "press", range: 360, inner: 220, on: 0.10, off: 0.16 },
    buff: { speedMul: 1.6 },
  },
  hawk: {
    id: "hawk", name: "Falcão", color: "#3878e0", group: "postura", priority: 2,
    desc: "Parado há um segundo, seus tiros batem muito mais forte.",
    when: { read: "still", on: 1, off: 0.4 },
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
    desc: "Cercado de perto, todas as suas peças alcançam mais longe.",
    when: { read: "press", range: 360, inner: 220, on: 0.32, off: 0.24 },
    buff: { rangeMul: 1.5 },
  },
  wild: {
    id: "wild", name: "Selvagem", color: "#f5d45c", group: null, priority: 1,
    desc: "Com a matilha grande em campo, ela fica mais rápida e bate mais.",
    when: { read: "beasts", on: 8, off: 5 },
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
    this.loose = new Set();  // aspectos com a condicao afrouxada pelo tier 5
    this.active = [];       // ids ativos AGORA, para o render
    this.ch = {};
    resetChannels(this.ch);
    this.nextAt = 0;
  }

  reset() {
    this.slots.length = 0;
    this.state.clear();
    this.loose.clear();
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
  /* Ainda cabe a postura desta peca? Quem pergunta e o filtro de oferta
     (`meetsRequires`, via `requires: { slot: "aspect" }`): com os slots cheios
     a peca entraria na build e ficaria muda, porque `register` recusa e o
     trigger `aspect` nao pulsa sem registro. Ja possuida continua cabendo — o
     level up precisa poder oferecer TIER dela. */
  hasRoom(def) {
    const id = def && def.trigger && def.trigger.aspect;
    if (!id) return true;
    if (this.slots.indexOf(id) >= 0) return true;
    return this.slots.length < BALANCE.aspect.slots;
  }
  // A postura esta DE PE agora — o que o trigger `aspect` pergunta antes de
  // pulsar. `active` ja e a lista dos vencedores da exclusao mutua, entao
  // aspecto que perdeu o grupo nao pulsa, do mesmo jeito que nao contribui.
  isActive(id) { return this.active.indexOf(id) >= 0; }

  /* O tier 5 de toda peca de aspecto: a postura AFROUXA — liga mais cedo e sai
     mais tarde. O ajuste mora na instancia do sistema e nao em `ASPECTS`, que e
     registry compartilhado: mexer la vazaria para a proxima run.

     E ele move os DOIS limiares na mesma direcao, cada um para o seu lado, em
     vez de encostar `on` em `off`. Encostando, o vao entre eles morreria — e o
     vao E a histerese. O tier 5 de uma peca nao pode desfazer a regra que
     impede a peca de piscar. */
  loosen(id) {
    if (!ASPECTS[id] || this.loose.has(id)) return;
    this.loose.add(id);
  }
  /* Limiares efetivos: os do dado, ou os afrouxados.

     Os dois andam JUNTOS, na mesma direcao e na mesma distancia — e nao um em
     direcao ao outro. Mover um contra o outro fecha o vao, e o vao E a
     histerese: a primeira versao deste metodo levava a Vibora de 0.9/0.75 para
     0.825/0.825, e um aspecto sem vao pisca. `driver_bench` mediu o estrago
     antes de qualquer outro driver — o caminho fechado rendia 1162 contra 3688
     da peca crua, porque a postura passava mais tempo virando do que ligada.

     Deslocar os dois pelo mesmo `delta` preserva o vao por construcao: o
     aspecto liga mais cedo E sai mais tarde, que e o que o tier 5 promete. */
  _when(a) {
    if (!this.loose.has(a.id)) return a.when;
    const w = a.when, delta = (w.on - w.off) * 0.5;
    return { read: w.read, range: w.range, on: w.on - delta, off: w.off - delta };
  }

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
      const w = this._when(a);
      const v = ASPECT_READS[w.read](this.game, a, w);
      const sobe = w.on > w.off;
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
      if (!st.on && podeVirar) quer = sobe ? v >= w.on : v <= w.on;
      else if (st.on && podeVirar) quer = sobe ? v > w.off : v < w.off;
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
