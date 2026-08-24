"use strict";
/* =========================================================================
   O NUMERO DE DANO

   O jogo dizia tudo sobre um acerto menos o valor dele. A cadeia conta
   QUANTOS caem, a ceifa anuncia que ACONTECEU AGORA, o hitstop e o tranco de
   camera dizem que PESOU — e nenhum dos tres diz QUANTO. Este arquivo diz.

   --- Por que ele nao mora no buffer do mundo ---------------------------

   Todo o resto do que se ve e desenhado em `Game.world`, um buffer a um terco
   da janela (`PIXEL_UNIT` 3), e depois ampliado em bloco inteiro. Texto ali
   dentro nao e uma escolha de estilo, e uma impossibilidade: o menor tamanho
   da faixa (20px) cairia em SEIS pixels de buffer de altura, que nao desenha
   digito nenhum — desenha mancha. E o numero existe para ser lido.

   Entao ele e desenhado depois do `present()`, direto no canvas da tela, em
   pixel de dispositivo. Continua sendo mundo (ele esta ancorado num corpo,
   nao num canto do HUD), continua sendo canvas, e nao entra no grid de pixel
   pelo mesmo motivo que gradiente, elipse e particula nao entram: nao e arte
   feita de celulas. A posicao vem de `cam.rawLeft/rawTop` e nao de
   `cam.left/top` — o buffer e que precisa estar preso ao grid, o texto por
   cima dele nao, e usar o raw e o que faz o numero acompanhar a rolagem em
   vez de tremer um pixel de arte por vez junto com ela.

   --- O orcamento -------------------------------------------------------

   Ver `BALANCE.dano`. As tres travas — limiar por fracao, teto de vivos e
   fusao por corpo e por quadro — sao o que separa "diz quanto" de "parede de
   digitos", e cada uma cobre o que a outra deixa passar. O pool nasce inteiro
   no construtor e este arquivo nunca aloca depois disso.

   A segunda trava e a que tem a regra menos obvia, e ela esta documentada em
   `_take`: cheio, quem cede a vez e o MENOR numero em tela, nunca o mais
   velho. Ceder por idade foi medido e reprovado.

   --- A cor -------------------------------------------------------------

   Cor e predicado (R2): o numero sai na cor do EIXO da peca que bateu, na
   brasa quando o golpe leva `fracAlta` do corpo. De brinde ele vira leitura
   de build — tela verde e a Corrupcao fazendo o trabalho. Vermelho continua
   reservado ao dano TOMADO, e osso puro nao aparece aqui de jeito nenhum:
   ele e reserva do warlock.

   A paleta e a da UI (`UI_PAL`), nao a do mundo (`AXIS_PALETTE`). O numero e
   elemento de LEITURA por cima da horda, e `UI_PAL` e a familia que foi
   calibrada para sobreviver nesse fundo. Contorno de obsidiana, nunca
   brilho — a mesma saida do `.combo-num`, e a razao de a R4 continuar de pe.
   ========================================================================= */

// A pilha de `--fonte-display` do `index.html`, escrita aqui porque `ctx.font`
// nao le variavel de CSS. Sem a pilha inteira, um browser sem a Google Font
// baixada desenharia o numero na serifada do body.
const DANO_FONTE = '"Big Shoulders Display", Impact, "Haettenschweiler", "Arial Narrow", sans-serif';

/* O texto do numero NAO e o `fmtNum` do HUD, e a diferenca aparece cedo: um
   golpe de mil sai como "1.0k" ali, e "1.0k" diz menos sobre um acerto do que
   "1000" — ele apaga justamente os digitos que separam um golpe do vizinho.
   Cru ate dez mil, abreviado dai para cima, que e onde a largura do numero
   passaria a competir com a leitura em vez de ajudar. */
const danoTexto = (n) => (n < 10000 ? "" + Math.round(n) : fmtNum(n));

// A fracao final da vida em que o numero apaga. Ele sobe o tempo todo e so
// desbota no fim: fade parelho desde o inicio leria como um numero que nasce
// ja indo embora, e o que se quer dizer e que ele ACONTECEU.
const DANO_FADE = 0.4;

class DamageNumbers {
  constructor(game) {
    this.game = game;
    this.slots = [];
    for (let i = 0; i < BALANCE.dano.pool; i++) {
      this.slots.push({
        alive: false, owner: null, frame: -1,
        x: 0, y: 0, drift: 0, t: 0, value: 0, frac: 0,
        color: "", text: "", px: 0,
      });
    }
    this.frame = 0;
  }

  reset() {
    for (const s of this.slots) { s.alive = false; s.owner = null; s.frame = -1; s.value = 0; }
    this.frame = 0;
  }

  /* O eixo da peca que bateu. `key` e a identidade estavel da peca, entao ela
     atravessa evolucao — o numero de Chaos Bolt sai no mesmo laranja do
     Incinerate que virou ele.

     Dano sem peca dona (o Apice, o estouro de um corpo) cai na cor do eixo em
     que a build mais investiu, que e a mesma escolha que a ceifa faz: o evento
     nao pertence a uma peca, mas tambem nao pode inventar matiz. */
  _tint(key, forte) {
    const b = this.game.build;
    let axis = null;
    if (key) {
      const inst = b.pieces.get(key);
      if (inst && inst.def) axis = inst.def.axis;
    }
    if (!axis) {
      let top = -1;
      for (const a in b.axis) if (b.axis[a] > top) { top = b.axis[a]; axis = a; }
    }
    const fam = forte ? UI_PAL.brasa : UI_PAL.eixo;
    return fam[axis] || fam.corruption;
  }

  /* --- o dano CAUSADO ---------------------------------------------------
     Chamado de dentro do funil (`Game.damageEnemy`), que e o unico lugar onde
     o valor, o HP maximo daquele corpo e a peca que bateu existem no mesmo
     escopo — sem os tres juntos nem a regra de limiar nem a de cor podem ser
     avaliadas. */
  hit(e, amount, key, killed) {
    const D = BALANCE.dano;
    const frac = amount / (e.maxHp || 1);
    if (!killed && frac < D.fracMin) return;

    /* A FUSAO. Se este corpo ja tem um numero nascido neste mesmo quadro, o
       golpe soma nele em vez de abrir outro. Sem isso os quatro projeteis de
       uma Salva, ou os tres tiques que caem no mesmo frame com sub-stepping,
       viram quatro digitos no mesmo pixel — que nao e mais informacao, e
       menos: nenhum dos quatro fica legivel. */
    const cur = e.dmgSlot;
    if (cur && cur.alive && cur.owner === e && cur.frame === this.frame) {
      this._fill(cur, cur.value + amount, frac + cur.frac, key);
      return;
    }
    const s = this._take(amount);
    if (!s) return;
    s.owner = e;
    s.x = e.x;
    s.y = e.y - e.radius;
    // Deriva por corpo, nao por sorteio: dois numeros que nascem no mesmo
    // ponto precisam se separar, e o mesmo corpo precisa cair sempre do mesmo
    // lado — senao o numero fundido pularia de lado ao ser somado.
    s.drift = ((e.gen * 2654435761) % 1000) / 500 - 1;
    s.drift *= D.deriva;
    this._fill(s, amount, frac, key);
    e.dmgSlot = s;
  }

  /* --- o dano TOMADO ----------------------------------------------------
     O unico vermelho da tela alem da barra, e por isso o mais caro. O encosto
     (`touch`) cobra por sub-step enquanto durar, entao ele nao fala nunca:
     mesma regra que mantem DoT e area fora do hitstop e fora das vozes. Quem
     fala e o discreto — projetil e estouro — e so acima de `tomadoMin`. */
  hurt(amount, source) {
    if (source === "touch") return;
    const D = BALANCE.dano, p = this.game.player;
    if (amount / (p.maxHp || 1) < D.tomadoMin) return;
    // `Infinity`: o dano TOMADO nunca cede a vez. Ele e o unico numero da tela
    // que o jogador precisa ver, e ele e raro — nao disputa espaco com nada.
    const s = this._take(Infinity);
    if (!s) return;      // impossivel com `Infinity`, e barato de garantir
    s.owner = null;
    s.x = p.x;
    // Acima da cabeca do warlock, nao em cima dela: ele e a unica coisa em
    // tela que o jogador controla, e a reserva de osso existe para ele nunca
    // ser coberto — inclusive por isto.
    s.y = p.y - p.radius - 22;
    s.drift = 0;
    s.t = 0;
    s.frame = this.frame;
    s.value = amount;
    /* O dobro da fracao, e nao a fracao crua: a faixa de tamanho foi calibrada
       para "quanto do CORPO o golpe levou", e um corpo cai em um ou dois
       golpes enquanto o jogador aguenta muitos. Sem o dobro, a mordida que
       tira um quarto da sua vida sairia do tamanho de um tique. */
    s.frac = clamp(amount / (p.maxHp || 1) * 2, 0, 1);
    s.color = UI_PAL.vida;
    s.text = "−" + danoTexto(amount);
    s.px = this._size(s.frac);
  }

  _fill(s, value, frac, key) {
    const D = BALANCE.dano;
    s.t = 0;
    s.frame = this.frame;
    s.value = value;
    s.frac = clamp(frac, 0, 1);
    s.color = this._tint(key, s.frac >= D.fracAlta);
    s.text = danoTexto(value);
    s.px = this._size(s.frac);
  }

  // O tamanho conta a fracao do corpo que o golpe levou, entao golpe grande le
  // como golpe grande sem precisar de cor nova. O piso e o limiar: abaixo dele
  // o numero nem existe, e interpolar de zero desperdicaria metade da faixa.
  _size(frac) {
    const D = BALANCE.dano;
    const k = clamp((frac - D.fracMin) / (1 - D.fracMin), 0, 1);
    return D.px[0] + (D.px[1] - D.px[0]) * k;
  }

  /* O TETO, e a regra dele e a peca de desenho mais cara deste arquivo.

     A versao obvia e um anel: cheio, o mais VELHO cede o lugar. Medido, ela
     nao sobrevive ao proprio jogo. Aos 10 min a run mata ~100 corpos por
     segundo e o pool inteiro gira em 0,55s, entao 80–90% dos numeros eram
     reescritos antes de terminar o voo — a tela nao ficava cheia, ficava
     ESTROBOSCOPICA: digitos aparecendo pela metade e sumindo.

     E `fracMin` nao conserta isso, o que e o achado que custou a medicao. O
     limiar por fracao e uma trava excelente no comeco e deixa de existir no
     fim: com a build madura quase todo golpe leva 100% do corpo, entao subir
     de 20% para 50% derrubou o corte de 80% para 67% e nada mais. Fracao nao
     discrimina quando tudo morre de um golpe.

     Quem discrimina e o VALOR, e a regra que sai daí e uma so: com o pool
     cheio, quem cede e o MENOR numero em tela, e so para um maior. Duas coisas
     caem juntas dela — nada e interrompido por algo menos informativo, e a
     tela converge para os maiores golpes do instante, que e literalmente a
     pergunta que o numero existe para responder. O golpe pequeno numa horda
     que morre em leva nao e informacao: a cadeia ja esta contando os corpos.

     O laco varre o pool inteiro, e isso e barato de proposito: 48 comparacoes
     so acontecem quando ele esta CHEIO e so depois de o limiar ter deixado o
     golpe passar. */
  _take(value) {
    let fraco = null;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.alive) return this._claim(s);
      if (!fraco || s.value < fraco.value) fraco = s;
    }
    if (value <= fraco.value) return null;
    return this._claim(fraco);
  }

  _claim(s) {
    if (s.owner && s.owner.dmgSlot === s) s.owner.dmgSlot = null;
    s.alive = true;
    return s;
  }

  /* Uma vez por QUADRO, em segundos reais — nunca por sub-step. O contador de
     quadro e o que a fusao usa, e o relogio e o mesmo do hitstop pelo mesmo
     motivo: isto e leitura, e leitura nao acelera no timeScale 3. */
  update(dt) {
    this.frame++;
    const vida = BALANCE.dano.vida;
    for (const s of this.slots) {
      if (!s.alive) continue;
      s.t += dt;
      if (s.t >= vida) {
        s.alive = false;
        if (s.owner && s.owner.dmgSlot === s) s.owner.dmgSlot = null;
        s.owner = null;
      }
    }
  }

  /* Desenhado no canvas da TELA, depois do `present()`, em pixel de
     dispositivo. `cell / PIXEL_UNIT` e quantos pixels de dispositivo cabem numa
     unidade de mundo; `dpr` e o que converte os px de tabela (que sao px de
     CSS, como todo numero do HUD) para o mesmo espaco. */
  draw(ctx, cam, cell, dpr) {
    const D = BALANCE.dano;
    const k2w = cell / PIXEL_UNIT;
    // O corte e feito em unidades de MUNDO e nao em pixel de tela: o mesmo
    // `offScreen` que todo laco de render usa, com margem generosa porque o
    // numero sobe e e desenhado a partir do centro.
    const l = cam.rawLeft - 120, r = cam.rawLeft + cam.w + 120;
    const t0 = cam.rawTop - 160, b = cam.rawTop + cam.h + 120;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    for (const s of this.slots) {
      if (!s.alive) continue;
      if (s.x < l || s.x > r || s.y < t0 || s.y > b) continue;
      const k = s.t / D.vida;
      // Sobe desacelerando e so entao apaga: as duas curvas nao andam juntas
      // de proposito, pela mesma razao que as do `VfxLayer` nao andam — quando
      // forma e brilho caem na mesma reta, o evento le como algo sendo apagado
      // e nao como algo que aconteceu.
      const rise = D.sobe * (1 - Math.pow(1 - k, 3));
      const a = k < 1 - DANO_FADE ? 1 : (1 - k) / DANO_FADE;
      const px = s.px * dpr;
      const x = (s.x - cam.rawLeft) * k2w + s.drift * dpr;
      const y = (s.y - cam.rawTop) * k2w - rise * dpr;
      ctx.globalAlpha = a;
      ctx.font = `900 ${px}px ${DANO_FONTE}`;
      // Contorno ANTES do preenchimento, e grosso: e o mesmo recurso do
      // `.combo-num`, e o unico que faz um numero sobreviver em cima de uma
      // pilha de corpos sem acender nada.
      ctx.lineWidth = Math.max(2, px * 0.09);
      ctx.strokeStyle = UI_PAL.obs;
      ctx.strokeText(s.text, x, y);
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, x, y);
    }
    ctx.restore();
  }
}
