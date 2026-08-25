# O render: grid de pixel, impacto e o que cada mecânica desenha

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `js/render/`, no desenho de `js/entities.js` ou em `Game.render`.

## Um grid de pixel, e todo mundo dentro dele

O mundo **não** é desenhado na tela: é desenhado num buffer de baixa resolução
(`Game.world`, um terço da janela) e só então copiado em `Game.present()`.
`PIXEL_UNIT` (`js/game.js`) é quantas unidades de mundo cabem num pixel desse
buffer, e a transform de `1/PIXEL_UNIT` no `wctx` deixa todo o código de desenho
continuar falando em unidades de mundo — ninguém além de `resize`/`present`
precisa saber que o buffer existe.

O que precisa ser inteiro **não é o `dpr`**: é `Game.cell`, quantos pixels do
dispositivo um pixel de arte ocupa. Arredondar o `dpr` foi a alavanca errada e
custou uma rodada — em tela Retina com resolução escalada o `devicePixelRatio` é
1.5 ou 1.7, e forçar 1 deixava o browser esticar o frame pronto por 1.7 **com
filtro**, que é borrão em cima de pixel art. Por isso o canvas tem `width`/
`height` em pixel de dispositivo e um `style.width` em px que mapeia 1:1 neles;
deixar no `width: 100%` do CSS devolve o borrão.

Isso não é firula: sem ele, `drawH / srcH` caía em escala fracionária e uma
linha do sprite ocupava 3 pixels enquanto a de baixo ocupava 2 — e como a
câmera anda em float, **quais** linhas ganhavam o pixel extra mudava a cada
frame, então o sprite fervia enquanto o jogador andava. Junto disso, arte de 1px
convivia com gradiente de resolução livre na mesma tela: o "mixel", que lê como
dois jogos misturados.

As regras que caem daí:

- **`PIXEL_GRID` (`js/sprites.js`) é a régua, e `placeSprite` é quem aplica.**
  Toda arte feita de células passa por `drawSprite`/`drawSpriteRim`/
  `drawSpriteGlow`/`drawPixelCanvas`. Blit novo de pixel art escrito à mão com
  `ctx.drawImage` direto está fora do grid e vai fervilhar.
- **Nada de rotacionar nem espremer sprite: movimento é pose.** Rotação de
  0.05rad e squash de 1.05 são frações de pixel — em vez de animar a arte,
  reamostravam ela. O que anima agora são **quadros**, gerados da mesma grade em
  `walkFrames` (`js/sprites.js`) e escolhidos por `anim.frame`: quem tem duas
  pernas na linha de baixo levanta um pé por vez, quem tem uma massa só (manto,
  portão, nuvem) ginga um pixel para cada lado. `walkAnim`/`minionAnim` devolvem
  `bob` **e** `frame`, da mesma fase — o corpo está no alto exatamente quando o
  pé está no ar. Os campos `sclX/sclY/rot` continuam no contrato porque
  funcionam quando a célula é grande, mas em 1:1 são no-op.
  Pose desenhada à mão continua sendo melhor que pose gerada: o gerador é o
  piso, não o teto.
- **E o degrau é o MESMO para todo mundo.** `step` é quantos pixels do buffer
  um pixel de arte ocupa, e cai de `drawH / (PIXEL_UNIT * linhas)`. Nada obrigava
  ele a ser igual para todos — e silenciosamente não era: o Abomination e o
  Dreadlord desenhavam em `step 2`, com pixel de arte do dobro do tamanho dos
  outros dezesseis. É o mixel na versão silenciosa: não é escala fracionária,
  que ferve; é escala inteira que **não bate com o resto do elenco**, e as duas
  criaturas leem como se viessem de um jogo de resolução menor.
  O conserto nunca é reduzir a altura desenhada — isso encolheria o bicho para
  metade do próprio hitbox. É **redesenhar a grade no tamanho em que ela
  aparece**: 16x14 virou 28x28 e 22x19 virou 44x38, com `art` intacto nos dois,
  então nada de balanceamento mudou. `driver_pixel` cobra a igualdade agora,
  porque o defeito é invisível num sprite sozinho e óbvio ao lado de um ghoul.

- **Tamanho de sprite é degrau, não contínuo.** Uma grade de 14 linhas só existe
  com 42, 84 ou 126 pixels de altura. Por isso a altura é dado explícito
  (`ENEMIES.art`, `MINIONS.scale`, `CLASSES.<id>.forms[].scale`) e os valores
  são exatos: quem escolhe o degrau é o autor, não o `Math.round`. Se um bicho
  não cabe em degrau nenhum, o conserto é **redesenhar a grade** no tamanho em
  que ele aparece — fração não encolhe desenho, ela apaga pedaço dele.
- **Canvas nasce em pixel de buffer.** A laje (`makeFelTile`, hoje pintada de
  `TILE_ROWS`) e os props estáticos (`propSprite`) são feitos já na resolução
  final — 42x42 no caso da laje, que é `tile` sobre `PIXEL_UNIT`; gerados
  grandes e reduzidos no blit, perderiam dois de cada três pixels e o granulado
  viraria chiado. É também por isso que `propSprite` cacheia por **degrau de
  tamanho**: o `s` contínuo do chunk vira um dos `PROP_BUCKETS`.
- **`BALANCE.world.tile` tem que ser múltiplo de `PIXEL_UNIT`**, senão o chão
  desalinha do resto.
- **A câmera tem duas posições, e a diferença é a rolagem suave.** `rawLeft` é
  onde ela está de verdade (float, porque o lerp é o que dá vida a ela);
  `left` é onde o mundo é **desenhado**, preso ao grid e com um pixel de margem.
  O resto não é jogado fora: `present` entrega ele ao blit como deslocamento em
  pixel de **dispositivo**. Desenhar no grid é o que tira o fervilhar; deslizar
  o blit é o que tira o trancos. Sem a segunda metade a tela inteira pula um
  pixel de arte por vez, e com câmera em lerp esses pulos saem irregulares —
  andar parecia engasgar.

Exceções de propósito: gradiente, elipse, partícula e o vórtice do portal são
arte de resolução livre e não passam pelo grid — o portal ainda escala
continuamente porque a abertura dele *é* a animação. A explosão fica no meio:
o tamanho vira uma das grades de `EXPLO.GRIDS` e a bola nasce já no tamanho
final, então o raio aparente é degrau. Isso é honesto porque quem diz a verdade
sobre o alcance é a onda de choque, desenhada no raio real.

`driver_pixel` guarda tudo isso.

## Hierarquia de leitura: o personagem primeiro

Com mil inimigos, trinta zonas e a build inteira acesa, brilho vira ruído e o
jogador perde de vista a única coisa que ele controla. A ordem de prioridade é
fixa e vale para qualquer adorno novo:

1. **O warlock.** Contorno escuro (`drawSpriteRim`) para a arte não se dissolver
   dentro do próprio brilho, e luz **no chão** — elipse achatada aos pés, nunca
   disco centrado no corpo.
2. **O que decide a jogada:** inimigo, zona de dano, projétil. Zona tem aro no
   raio exato; o preenchimento é fraco de propósito, quem informa é a borda.
3. **Feedback de estado** (DoT, controle, invocação) — decoração proporcional à
   informação: o anel de podridão só aparece em quem carrega 3+ DoTs, e adorno
   em volta do jogador é privilégio de spell **concluída** (ver abaixo), com
   teto de `MAX_PIECE_VFX` desenhando de fato.
4. **Cenário.** Vive numa faixa de luz abaixo de tudo que o jogador conjura. Se
   o chão brilha tanto quanto uma explosão, a explosão não significa nada.

Regra prática ao acrescentar efeito: pergunte quantos deles cabem na tela ao
mesmo tempo. Bonito com um e ilegível com cinquenta significa que a alpha
divide por quantidade (`1/sqrt(n)`), que existe um teto, ou que o efeito só
aparece acima de um limiar.

## Impacto: o acerto tem que aterrissar, não só acontecer

Efeito bonito não é o que separa VFX profissional de amador — **antecipação,
impacto e recuperação** são. Antes desta camada, todo evento visual do jogo era
pura *emissão*: nascia no tamanho final, sumia com alpha linear, acabou. Três
peças consertam isso, e as três moram em `BALANCE.camera`.

**1. Hitstop congela a simulação por alguns milissegundos.** É a coisa mais
barata que existe num jogo de ação para fazer um golpe aterrissar: o frame em
que ele conecta fica no ar tempo suficiente para ser visto. Três regras:

- **Segundos reais, nunca `clock`.** Ele vive em `Game._loop`, fora do
  sub-stepping. No relógio de simulação (que é escalado) um stop de 50ms
  duraria 150ms no timeScale 3, e o modo rápido seria o que mais trava.
- **Cadência obrigatória.** Este jogo põe dezenas de acertos grandes em tela ao
  mesmo tempo; um stop por acerto é apresentação de slides. `hitstop.cooldown`
  é o que segura, e `force` é só para o que acontece uma vez por run (morte de
  chefe) e não pode ser comido pela cadência de outro evento.
- **Dano contínuo fica de fora.** `touch` cobra por sub-step enquanto houver
  encosto — um stop por cobrança faria o jogo arrastar exatamente quando a
  horda fecha. Quem para o jogo é evento **discreto**: acerto `big`, morte de
  chefe, projétil no jogador.

**2. Tremor de tela é um SOCO, não ruído.** A câmera é empurrada de uma vez na
direção em que o golpe viajou e volta oscilando, morrendo em ~0,35s. É isso que
diz *de onde* veio a pancada, e não apenas que veio — por isso `addShake` aceita
`(mag, dx, dy)` e quem tem posição passa direção.

A versão antiga sorteava `Math.random()` por frame. Isso não é tremor, é
chuvisco: o desvio cai num ponto novo de uma caixa de ±22 unidades a cada frame,
sem nenhuma continuidade, e depois do `snapUnit` lê como a tela inteira piscando
um pixel por vez. **Trocar o sorteio por ruído de senoide não resolveria** — a
60fps qualquer coisa acima de ~7Hz é amostrada perto de Nyquist e volta a
aliasar. Uma oscilação amortecida a 8,6Hz dá ~7 amostras por ciclo, então o
caminho é desenhado de verdade em vez de sugerido.

Duas coisas que custaram uma rodada e estão no driver para não voltarem:

- **`updateShake` amostra ANTES de avançar o relógio.** O deslocamento máximo
  está em `t = 0`: é o quadro do soco. Avançando primeiro, a primeira amostra
  já sai 0,9rad adiantada, o pico nunca chega a ser desenhado, e o que aparece
  é a câmera começando na metade do caminho de volta.
- **`Math.max` na amplitude, e nunca soma.** Dez acertos no mesmo frame não
  podem virar uma câmera arremessada para fora do mapa. O golpe mais forte
  manda e reinicia a fase.

**3. Nada num acerto é linear.** `VfxLayer.draw` calcula **duas** curvas e elas
não andam juntas de propósito: `e = outCubic(k)` governa o tamanho (sai rápido e
desacelera) e `a = (1-k)²` governa o brilho (cai antes de a forma parar). Quando
as duas caem na mesma reta, o efeito lê como um círculo sendo apagado e não como
energia se dissipando.

A exceção é a **onda de choque da explosão**, e ela é a exceção porque é a única
parte desenhada no raio real do dano: o raio usa a curva, mas a alpha cai
parelho — ela é o tempo que o jogador tem para ler até onde a explosão pegou.
Amarrar a alpha na curva do raio apagaria o anel no primeiro décimo da vida,
quando ele ainda está dizendo o que importa.

`driver_feel` guarda as três. O que ele **não** mede é se o hitstop lê como
impacto ou como engasgo — isso é uma passada de dez segundos no browser, e as
alavancas são `hitstop.big`/`hitstop.cooldown` e `shake.max`.

## O número de dano: quanto, e o único desenho fora do buffer

A cadeia diz **quantos** caem, a ceifa diz que aconteceu **agora**, o hitstop e
o tranco de câmera dizem que **pesou**. Nenhum dizia **quanto**, e essa era a
última peça de feedback bruto que faltava. `js/render/numbers.js` diz.

**Ele é a única coisa do jogo desenhada DEPOIS do `present()`**, e o motivo não
é profundidade, é resolução: o mundo mora num buffer a um terço da janela, onde
o menor tamanho da faixa (20px) sairia com **seis pixels de altura** — que não
desenha dígito, desenha mancha. Ele continua sendo mundo (está preso num corpo,
não num canto do HUD) e continua sendo canvas; só não é feito de células, como
gradiente, elipse e partícula também não são. A posição vem de
`cam.rawLeft/rawTop` e não de `cam.left/top`: o buffer é que precisa estar preso
ao grid, o texto por cima dele não — e usar o *raw* é o que faz o número
acompanhar a rolagem em vez de tremer um pixel de arte por vez junto com ela.

**E ele é a única mecânica do jogo que se estraga por SUCESSO.** `maxAlive` é
4400 e a curva mede ~100 abates/s aos 10 min: quanto melhor a build fica, mais
ele aparece, e a partir de algum ponto ele deixa de informar. Por isso ele tem
o mesmo tipo de orçamento que a ceifa tem em `reap.tiers` — três travas, em
`BALANCE.dano`, e cada uma cobre o que a outra deixa passar:

1. **Limiar por FRAÇÃO do corpo** (`fracMin`), nunca por valor absoluto. Um
   limiar absoluto ou some com o ghoul de 20 HP ou entope a tela quando a build
   madura tira dois mil por golpe. É a mesma razão pela qual a ceifa conta
   abates **por tempo** e não abates totais.
2. **Teto de vivos** (`pool`), sem alocar — ver abaixo, é a regra menos óbvia.
3. **Fusão por corpo e por quadro.** Os quatro projéteis de uma Salva no mesmo
   inimigo no mesmo frame são **um** número somado; sem isso são quatro dígitos
   no mesmo pixel, que não é mais informação, é menos.

### A regra do teto: cede o MENOR, nunca o mais velho

A versão óbvia do teto é um anel — cheio, o mais **velho** cede o lugar. Medido
(`driver_dano`, 11 min com o piloto imortal), ela não sobrevive ao próprio jogo:
aos 10 min o pool inteiro gira em 0,55s e **80–90% dos números eram reescritos
antes de terminar o voo**. A tela não ficava cheia, ficava **estroboscópica**.

E `fracMin` não conserta isso, que é o achado que custou a medição: o limiar por
fração é uma trava excelente no começo e **deixa de existir no fim** — com a
build madura quase todo golpe leva 100% do corpo, então subir de 20% para 50%
derrubou o corte de 80% para 67% e mais nada. **Fração não discrimina quando
tudo morre de um golpe.**

Quem discrimina é o **valor**. Cheio, quem cede a vez é o menor número em tela,
e só para um maior:

| teto cedendo por… | em tela no min 10 | cortados no voo |
|---|---|---|
| idade (anel) | 42 | **80%** |
| menor valor | 32–42 | **20–29%** |

Duas coisas caem juntas dessa regra, e são as duas que importam: nada é
interrompido por algo **menos** informativo, e a tela converge para os maiores
golpes do instante — que é literalmente a pergunta que o número existe para
responder. Golpe pequeno numa horda que morre em leva não é informação: a
cadeia já está contando os corpos. O dano **tomado** é a exceção declarada
(`_take(Infinity)`): ele nunca cede a vez, e é raro o bastante para não disputar
espaço com nada.

### O resto das regras

- **Cor é predicado (R2): o eixo da PEÇA que bateu**, na brasa quando o golpe
  leva `fracAlta` do corpo. De brinde o número vira leitura de build — tela
  verde é a Corrupção fazendo o trabalho. Dano sem peça dona (o Ápice, o
  estouro de um corpo) cai no eixo em que a build mais investiu, que é a mesma
  escolha que a ceifa faz.
- **A paleta é a da UI (`UI_PAL`), não a do mundo (`AXIS_PALETTE`).** O número
  é elemento de **leitura** por cima da horda, e `UI_PAL` é a família calibrada
  para sobreviver nesse fundo.
- **Osso puro nunca**, e vermelho só no dano tomado. As duas reservas de sempre.
- **Contorno, nunca brilho** — a mesma saída do `.combo-num`, e é por isso que
  a R4 continua de pé. (Ela governa a UI; o canvas tem orçamento próprio, e
  nele o emissor é a build.)
- **A fonte é `--fonte-display`, não a mono.** O precedente é o `.combo-num`:
  número que fala de impacto usa display, número que fala de dado (relógio,
  tier) usa mono.
- **O texto não é o `fmtNum` do HUD.** "1.0k" apaga justamente os dígitos que
  separam um golpe do vizinho: cru até dez mil, abreviado daí para cima.
- **Tempo REAL, como o hitstop e pelo mesmo motivo:** isto é leitura, não
  simulação. No timeScale 3 um número preso ao relógio do jogo duraria um terço
  do tempo em tela justo quando há mais o que ler.
- **Dano contínuo não fala.** O encosto (`touch`) cobra por sub-step enquanto
  durar — mesma regra que o mantém fora do hitstop e fora das vozes.
- **`Enemy` é pooled, então `dmgSlot` é zerado no `reset`.** Sem isso o corpo
  reciclado herdaria a ranhura do anterior e o primeiro acerto dele somaria num
  número que pertence a outro bicho.

## A resposta de vida baixa: uma curva, dois consumidores

Abaixo de `vidaBaixa.em` o mundo responde, e **nada muda de lugar**: a vinheta
que já existe fecha em vermelho (`Scenery.drawAtmosphere`) e a barra de vida do
rodapé desbota no mesmo compasso (`UI.updateHUD`). Vermelho aqui é legal porque
é exatamente a reserva que a R2 concede — barra de vida e dano recebido.

`Game.lowHpPulse` é **um** número lido pelos dois, pela mesma razão que
`apexFront` mora no util e não junto do desenho: uma classe de CSS com
`@keyframes` seria mais barata e **não ficaria em fase** com o mundo, e aí os
dois leriam como duas animações que por acaso coincidem em vez de um evento só.
O relógio é o real (`_vfxClock`): um aviso de que você está morrendo não pode
pulsar três vezes mais rápido no timeScale 3.

## A morte: o corpo se desfaz, e a leva se anuncia

Matar é a coisa que o jogador mais faz, e era a que o jogo menos comentava:
**seis bolinhas redondas em `type.color`**, iguais para os dezoito inimigos,
redondas em cima de arte em grade inteira, e o orbe de XP simplesmente
existindo no chão no quadro seguinte. Três peças consertam isso.

**1. O corpo se desfaz nas cores DELE.** `spriteShards(id)` (`js/sprites.js`)
lê a mesma grade que já desenha a criatura e guarda até 24 células como
estilhaço — então um ghoul morre verde-podre, um esqueleto morre osso e um Fel
Lord morre em brasa, **sem arte nova e sem um campo a mais no dado**.
`driver_vfx` cobra que as paletas de estilhaço sejam distintas uma por inimigo:
dois bichos que se desfazem igual são dois bichos que morrem igual.

- **Contorno não vira estilhaço.** `o` é uma das tintas quase-pretas; estilhaço
  nessa cor num chão de obsidiana é um pixel invisível voando.
- **A amostragem é por passada larga, não sorteio.** Sorteio agrupa, e um
  punhado de pixels saindo todos do mesmo ombro lê como respingo em vez de
  desmanche.
- **Os dois eixos normalizam pela ALTURA.** `drawSprite` deriva a largura do
  degrau que a altura escolheu; com cada eixo normalizado pelo próprio tamanho,
  `0.5` significaria coisas diferentes em x e em y e sprite largo não
  espalharia.
- **`shardBurst` mora fora do `Game`**, e recebe um `emit`: o jogo entrega um
  `Pool` e a galeria entrega um array, e os dois precisam sair idênticos — card
  que redesenha "parecido" é card que mente.

O estilhaço é uma **segunda espécie de partícula** (`PART_SHARD`), e a
diferença não é cosmética: ele é quadrado, preso ao grid (`snapUnit`), **não
encolhe** — encolher um pixel é a operação que o grid não sabe fazer — e
**cai**, porque estilhaço que desacelera no ar e some lê como fumaça. O `blob`
redondo continua existindo para os eventos de UI (nível, evolução, capstone),
que são raros e acontecem sobre uma tela parada.

**Existe orçamento** (`SHARD_BUDGET`). A morte é o único evento que acontece
cinquenta vezes no mesmo frame; o que passa do teto volta ao punhado de
faíscas — pouca coisa, mas nunca nada, porque corpo que some sem nada lê como
bug de pool.

**2. A alma sai do corpo.** O orbe de XP nasce com um arco de 0,42s
(`ORB_BIRTH`). `birth` desloca só o **desenho**: o raio de ímã continua medido
onde o orbe realmente está, então a coleta não muda.

**3. A ceifa (`BALANCE.reap`).** Vinte corpos caindo no mesmo pulso é a dopamina
que o gênero existe para entregar, e o jogo não dizia nada sobre isso — vinte
mortes juntas eram vinte eventos isolados no mesmo frame.

`heat` sobe um por abate e esfria a `cool` por segundo, então mede abates **por
tempo** e não abates totais: é a diferença entre "a run está indo bem" e "isto
acabou de acontecer". Consequências:

- **Três degraus, não um.** Limiar único ou dispara o tempo todo no fim da run
  (quando matar em leva é o normal) ou nunca dispara no começo.
- **O degrau só rearma quando o calor cai abaixo de `reset`** — senão uma leva
  grande anuncia o mesmo degrau a cada corpo. `driver_vfx` mede as duas pontas:
  60 abates em leva dão **três** anúncios (um por degrau), e abate esparso
  (um a cada 0,5s) não acende nenhum.
- **A ceifa é desenhada NO CHÃO**, elipse achatada como a luz aos pés do
  warlock — círculo neste raio leria como uma cúpula em cima da cena. Dois
  anéis com curvas diferentes (`outQuint` fora, `outCubic` dentro), porque um
  anel só leria como a onda de choque de uma explosão grande, que é o evento
  com que ela mais poderia ser confundida.
- **A cor é a do eixo em que a build mais investiu** (`Game.buildColor`). A
  ceifa não pertence a uma peça, mas também não pode inventar matiz: o que ela
  diz é "a SUA build acabou de fazer isso".
- A voz dela é **o único som do jogo que sobe** em altura e brilho ao mesmo
  tempo. Todo o resto do combate cai (explosão, morte, execução, choque), e
  subir é o que faz o ouvido ler recompensa em vez de dano.

**4. A cadeia (`BALANCE.combo`) — a ceifa dita em número.** As duas medem o
mesmo fato (abates por tempo) e é de propósito que não se derivem uma da outra:
a ceifa é um **evento** no chão, que acontece e passa; a cadeia é um **estado**,
e estado se desenha enquanto dura — a mesma regra que separa a casca do escudo
de um vfx de escudo. Um abate dentro de `window` do anterior continua a conta,
um intervalo maior a zera, e o pavio de 3px embaixo do número é o que diz que a
regra é *tempo entre abates* e não abates totais.

- **É leitura, não bônus.** A cadeia não multiplica dano, não dá recurso e não
  entra em nenhum stat. No dia em que ela pagar alguma coisa, o número vira
  input de decisão e o desenho tem que mudar junto (ele hoje não diz o que
  compra) — a alavanca de dificuldade continua sendo `ENEMIES`.
- **O relógio é o da simulação.** A 3x, um segundo real daria três de folga
  para manter a conta viva, e o modo rápido seria o que mais encadeia.
- **`min` existe pelo mesmo motivo que a ceifa tem três degraus e não um.**
  Dois abates seguidos é o estado normal deste jogo; contador que nunca apaga
  não está dizendo nada.
- **`pulse` é UM número, e é a duração do salto E o intervalo mínimo entre dois
  saltos.** Com decaimento e cadência separados, uma build madura (dezenas de
  corpos por segundo) rearmaria o salto no meio dele mesmo, e o número passaria
  a **vibrar num tamanho fixo** em vez de pulsar. Amarrados, cada salto sempre
  termina antes que o próximo possa começar — é a mesma lição do
  `hitstop.cooldown` e do `gap` das vozes. `driver_vfx` mede as duas pontas:
  100 abates em 1s dão ~9 saltos e não 100, e nenhum rearma antes da hora.
- **Osso, nunca cor de eixo.** A ceifa é canvas e usa `buildColor`; a cadeia é
  UI, e cor é predicado de eixo — uma cadeia não fala de eixo nenhum. O que
  impede o número de se dissolver numa pilha de corpos é **contorno** de
  obsidiana, a mesma decisão do `drawSpriteRim` do warlock, e não brilho.
- **O salto é `transform`, nunca `font-size`.** Mudar a fonte refaz o layout do
  HUD inteiro sessenta vezes por segundo. O tamanho por degrau muda — mas só
  quando o degrau muda.
- **Ela não tem voz nem evento visual**, e por isso não passa por `emitVfx`: a
  ceifa já é a voz desse fato, e dar um segundo som ao mesmo pulso seria
  anunciar duas vezes. A cadeia é o que a run guarda para o game over
  (`comboBest`, no painel "A run em uma linha").

**A janela é a alavanca, e ela está em 0,1s.** `window` é o único número do
bloco que decide se a cadeia **quebra**. Medido, run de 12 min com a horda no
teto:

| janela | recorde | em tela | quebras | quadros no degrau 3 |
|---|---|---|---|---|
| 1s | 7584 | 100% | 0 | 93% |
| 0,3s | 743 | 87% | 234 | 3% |
| **0,1s** | **364** | **57%** | **605** | **0%** |

Em 1s esta horda é densa demais para dar um segundo de silêncio: o número nunca
zerava e era um **medidor de rampagem**, não um feito que se perde. Em 0,1s ele
só continua enquanto os corpos caem no mesmo pulso — some de quase metade dos
quadros e volta a ser um feito.

O preço está na última coluna: os degraus de cima (40 / 120) praticamente não
acendem mais, então `tiers` e `size` passam a viver quase só no degrau 0. Se a
intenção for o número voltar a variar de tamanho, quem desce é `tiers`, não
`window` que sobe — os degraus estão no arco de uma janela de 1s (10 / 40 / 120,
e não 10/25/50, que acendiam os três nos primeiros vinte segundos).

## Os dois drops: objeto, não retângulo

Baú e Ímã de Almas foram as duas últimas coisas do mundo desenhadas como
geometria — `fillRect` dentro de `Pickup.draw`, um quadrado vazado e um
quadrado chanfrado. Quadrado não é objeto: ele diz "tem alguma coisa aqui" e
nada além disso, e estes dois são os únicos itens do jogo cujas respostas são
**opostas** (um abre uma tela, o outro limpa o chão de XP). A diferença entre
eles era matiz, entre osso e osso um pouco mais quente.

Hoje são grade em `SPRITE_DATA` como o resto do elenco, e o dado é o mesmo par
que inimigo e demônio carregam: `sprite` aponta para a grade e `art` é a altura
desenhada em unidades de mundo — `linhas × PIXEL_UNIT`, que é o degrau 1.
`driver_pixel` mede o degrau dos itens junto com o dos inimigos (é o único
número do elenco digitado à mão, sem raio de onde cair) e `driver_render` cobra
que todo item tenha grade, pelo mesmo motivo que cobra sprite de demônio.

Três coisas que caem daí:

- **A silhueta é que separa os dois**: caixa fechada com fecho contra ferradura
  de duas pontas. Cor é a última variável, não a primeira.
- **O drop ganhou o que todo corpo em tela já tinha** — contorno
  (`drawSpriteRim`), para a arte não se dissolver dentro do próprio halo, e
  sombra no chão. Sem a sombra, um objeto que flutua lê como adesivo colado na
  câmera.
- **A sombra sai do `y` SEM o hop**, e o hop mora em `anim.bob` (dentro de
  `placeSprite`, então cai em pixel inteiro). É a diferença entre o objeto
  subir e o desenho inteiro escorregar para cima.

## O gerador de formas: uma máquina, quatro eventos

A explosão já era gerada do jeito certo — um campo de calor amostrado numa
grade, silhueta irregular vinda de harmônicos no ângulo, quantizado em quatro
bandas. O que ela não era é **genérica**: era uma função chamada
`buildExplosionFrame`, e por isso o jogo inteiro tinha **uma** forma de evento.
Dezesseis peças emitindo a mesma bola de fogo, distinguidas só pela matiz do
eixo — e como matiz é predicado do eixo, duas peças do mesmo eixo saíam
idênticas.

`FX_SHAPES` (`js/render/fx-shapes.js`) é a mesma máquina aceitando mais de um
formato. Um arquétipo declara **duas funções** e todo o resto é compartilhado:

```js
begin(u, variant, half)  // -> `st`, o estado daquele quadro
depth(st, dx, dy)        // -> 0..1, quanto aquela célula está acesa
```

Tamanho de grade, rampa de quatro bandas, quantização, cache por (forma, cor,
grade), variantes e espelho no blit são iguais para todos — é isso que faz
quatro formas custarem o que uma custava.

**O que separa os arquétipos não é a silhueta, é a curva de calor.** Duas
formas com o mesmo desenho e a mesma curva são um tuning, não um evento novo:

| forma | células quentes por quadro | o que ela conta |
|---|---|---|
| `bloom` | 10/20/25/**85**/59/14/0/0 | queima cedo, esvazia por dentro, esfria |
| `implode` | 0/0/38/56/50/**89**/86/0 | a casca converge fria e **o clarão chega no fim** |
| `nova` | 16/84/**128**/112/67/3/0/0 | só a casca, nunca o miolo |
| `rip` | 0/34/62/**72**/66/38/0/0 | fenda vertical que abre e fecha |

`rip` existe justamente por não ser radial: com quatro arquétipos redondos o
catálogo continuaria com uma silhueta só. O eixo dela é vertical de propósito,
porque tudo o mais em tela é horizontal — o chão, a horda, o rastro do
projétil.

Três regras que `driver_vfx` cobra:

- **`bloom` é a explosão de hoje, célula por célula.** A extração foi mecânica
  de propósito e o campo dela está preso a um **hash de referência** tirado do
  gerador anterior (5 grades × 3 variantes × 8 quadros). Forma nova não pode
  mexer de raspão na forma que dezesseis peças já usam.
- **Nenhuma forma nasce vazia, e nenhuma nasce igual à vizinha** — o campo do
  quadro do meio é comparado entre todas.
- **Toda forma tem que ESFRIAR.** O que se mede é a área *quente* (bandas 0 e
  1) e não a área acesa: o `bloom` termina em arcos rasgados que ainda ocupam
  muita célula, e é certo que ocupem — o que não pode é continuar branco no
  último quadro. Evento que termina no próprio pico é cortado pelo fim da vida
  em vez de se dissipar, que é a diferença entre energia sumindo e alguém
  apagando o desenho.

O campo (`fxField`) vive separado do desenho pelos dois motivos acima: é o que
o driver compara, e é a única coisa que muda entre arquétipos — o painter é um
só.

## A forma mora no EFEITO, não na peça

Ligar o gerador ao catálogo é uma linha de dado:

```js
{ type: "damage_instant", amount: "@blast", radius: "@radius", shape: "implode" }
```

Sem `shape`, `burst` — a detonação continua sendo o padrão, e as dezesseis
peças que não declaram nada não mudaram. Dois motivos para o campo morar no
efeito e não na peça, e o segundo é o que decide:

1. Uma peça pode ter dois efeitos com formas diferentes.
2. **Um tier que reescreve `effects.N` troca a forma de graça**, sem nenhuma
   maquinaria de patch nova — e trocar a identidade da peça é literalmente o
   que um caminho de upgrade faz.

**A cor não pode ajudar a distinguir, então a forma tem que fazer o trabalho
sozinha.** O par mais claro é Infernal e Demonic Tyrant: as duas invocam algo
grande que bate em área, e matiz já está ocupado dizendo o eixo (laranja porque
é Cataclismo, roxo porque é Domínio). O Infernal é impacto de meteoro (`bloom`);
o Tirano é **onda de comando** (`nova`), sem miolo de fogo.

**E há um terceiro formato além de forma e cor: a RELAÇÃO.** Três peças eram
indistinguíveis de vizinhas até ganharem um segundo ponto:

| peça | era lida como | o que faltava |
|---|---|---|
| Grimoire of Sacrifice | Implosion (as duas devoram um pet e dão escudo) | o pacto é uma **transferência**: o filamento do demônio até o warlock |
| Enslave Demon | invocar um felguard | escravizar **toma** um corpo que já estava ali: a coleira sai do warlock |
| Demonic Circle | dois anéis sem parentesco | era **um** movimento: o rastro liga saída e chegada |

As três só existem porque `VfxLayer` aprendeu a carregar um segundo ponto na
fase anterior — e nenhuma delas é uma forma nova.

## Nenhuma cor cravada no render

Toda cor que aparece em tela sai de `PAL`, `AXIS_PALETTE` ou `UI_PAL` — ou veio
do dado da peça. `driver_vfx` varre `js/render/*.js` e `js/entities.js` e
reprova qualquer literal com croma ≥ 24 que não esteja na paleta; neutro passa
sozinho, porque contorno, sombra, vinheta e o branco de um flash não são
decisão de identidade.

**Cor de inimigo e de demônio NÃO entram na lista de autorizadas.** Elas são
dado, e dado se referencia (`e.type.color`, `def.color`). O mesmo hex escrito à
mão no render não é a cor daquele bicho, é coincidência — foi assim que o anel
de stun virou o âmbar do Tirano e o de fear virou o roxo do Darkglare, e a
coincidência passou anos lendo como intenção.

Duas das quinze eram bug e não estilo:

- **O projétil desbotava para roxo.** A última parada do gradiente era um roxo
  cravado, então todo tiro que não fosse roxo terminava roxo no último pixel. O
  cometa (a outra metade do mesmo arquivo) sempre usou a cor própria, e ninguém
  comparou os dois.
- **A barra do chefe tinha um segundo vermelho**, diferente do `UI_PAL.vida`
  que a identidade declara. Duas listas divergem.

O resto eram fallbacks (`cls.color || <hex>`) e o cenário inventando a própria
família de verde — a décima-nona paleta que a `PAL` existe para não deixar
acontecer.

## As quatro batidas: antecipação e resíduo

Um evento tem quatro batidas — **antecipação, impacto, dissipação, resíduo** —
e o jogo tinha as duas do meio. As duas das pontas são o que separa "piscou" de
"aconteceu", e cada uma conserta um defeito diferente.

**Resíduo: o chão lembra.** Sem ele o mundo esquece — uma explosão que apagou o
vão inteiro da horda deixava exatamente o mesmo chão que um tiro que não
acertou ninguém. `SCORCH_KINDS` diz quem marca e quanto: só o que **abre
espaço** (`burst`, `nova`, `rip`) deixa chamusco; implosão recolhe, salto e
deslocamento não tocam o chão, cura não queima nada.

- **O chamusco vive num pool separado do resto do vfx**, e os dois motivos são
  de profundidade: ele dura dez vezes mais que o evento que o criou, e é
  desenhado logo depois do chão e antes de qualquer entidade. **Evento acontece
  SOBRE o mundo; resíduo acontece NELE.**
- **Ele é escuro, não aceso.** Chão queimado não brilha — é a ausência de chão
  limpo. Quem carrega a cor da peça é só o aro, e fraco: chamusco que brilhasse
  como a explosão faria a explosão parar de significar algo.

**Antecipação: o golpe avisa onde vai cair.** Não é enfeite — golpe que cai
**longe** do jogador, num ponto que ele poderia ter deixado, é dano que ele não
teve como ler. Meteoro sem sombra no chão não é dificuldade, é sorteio.

`tell: 0.16` num efeito **adia o efeito de verdade** e emite o anel que fecha.
Desenhar o telegrafo sem atrasar o golpe seria um aviso que não antecede nada —
e é por isso que isto é, declaradamente, uma mudança de jogo e não só de arte.
Três consequências:

- **O anel FECHA.** Um anel que abrisse leria como algo que já aconteceu;
  fechar é o que dá a contagem regressiva. Ele também não usa `lighter` nem tem
  miolo: é o único evento do jogo que conta o futuro, e não pode ser confundido
  com um golpe.
- **O ponto é congelado e o alvo descartado.** Em 0,16s o inimigo mirado pode
  ter morrido, e um meteoro que persegue o cadáver é pior que um que cai onde
  foi anunciado.
- **O atraso e a vida do anel são o mesmo número**, e `driver_vfx` mantém os
  dois iguais. Não há como um derivar do outro — um é dado de conteúdo, o outro
  de render —, então o que resta é cobrar a igualdade. Se divergirem, o anel
  fecha e nada acontece.

Quem NÃO recebe telegrafo: o que sai do jogador (o alcance já é a leitura) e o
golpe repetido de um demônio plantado — telegrafar cada golpe de uma torre é
aviso constante, que é ruído.

## Fatia, não desenho novo

Depois que as quatro formas existiram, três grupos de peças continuavam
idênticos — e **nenhum deles precisou de um desenho novo**. Precisaram de um
parâmetro declarado no dado, do mesmo jeito que a paleta resolve "duas
criaturas do mesmo material diferem por QUAIS três passos da rampa".

| o que dura | a fatia | quem lê |
|---|---|---|
| casca de escudo | `veil: { sides, spin, thick, spikes }` | `EFFECTS.shield` → `Player.setVeil` |
| zona no chão | `look: "fire" \| "rot" \| "ash" \| "trap"` | `EFFECTS.area_persistent` → `AreaEffect.draw` |
| orbe de DoT | `look: "rot" \| "fire" \| "curse" \| "unstable" \| "doom"` | `DotSystem.apply` → `Enemy.drawDotOver` |

Três regras que caem daí:

- **A casca é polígono, não círculo.** Polígono tem orientação: girando, ele
  diz que existe alguma coisa em volta do corpo; círculo girando é círculo
  parado. E os lados são poucos de propósito — a 20px de raio, doze lados já
  são um círculo de novo. A cor sai de **quem deu o escudo**, e o ciano
  cravado (a mesma casca para as seis peças) morreu junto.
- **Na zona, o que muda é o ARO — nunca o raio.** É o aro que informa onde o
  dano termina; qualquer estilo que mexesse no raio estaria mentindo sobre o
  alcance. Fogo tremula no brilho e na espessura, podridão gira em arcos
  partidos, brasa fica parada e tracejada como chão chamuscado.
- **No DoT, o que muda é o MOVIMENTO do orbe.** Podridão orbita, fogo sobe,
  maldição fica parada em fila sobre a cabeça (uma marca por acúmulo, que é o
  que uma maldição de acúmulo precisa dizer), instabilidade treme mais perto de
  estourar, sentença fecha para dentro conforme o prazo acaba. É o mesmo orbe
  nos cinco casos.

**Estado final: 95 peças, 95 assinaturas distintas, zero mudas.** Nenhuma peça
do jogo desenha o mesmo que outra, e `driver_vfx` reprova a primeira que voltar
a colidir.

O catálogo do hunter dobrou o número de peças e o driver cobrou cada colisão —
onze delas. **Nenhuma foi paga com desenho novo**, e é isso que prova que os
canais de distinção que já existiam bastam:

| o que colidia | o que separou |
|---|---|
| seis peças de tiro, todas `proj` | o que cada tiro FAZ ao acertar: `arcaneShot` enfraquece, `aimedShot` soca, `rapidFire` incendeia, `multiShot` abre em leque, `aspectOfTheHydra` envenena |
| duas peças que só davam escudo | a fatia do `veil` — 6 lados com espinho contra 9 girando ao contrário |
| Kill Command contra outro `rip` | a **relação**: o filamento do bicho até o alvo, que é o que a peça literalmente é |
| dois sangramentos `rot` | o `look` do orbe: estilhaço cravado é `unstable`, não podridão |

A lição é a de sempre neste arquivo: quando duas peças desenham igual, quase
nunca falta arte — falta a peça dizer em tela o que ela já faz na simulação.

## Mecânica que cobra, avisa

Vinte e cinco mecânicas mudavam o jogo sem gastar um pixel. Três formatos de
tell cobrem quase todas, e **qual dos três usar sai da natureza do fato**, não
do gosto:

| A mecânica é… | O tell é… | Exemplos |
|---|---|---|
| um **estado** do inimigo | **marca** de 9×9 sobre a cabeça | atordoado, medo, lento, enfraquecido, marcado |
| uma **relação entre dois lugares** | evento de **dois pontos** | `chain`, Contágio, empurrão, puxão, o blink |
| um **estado** do jogador que dura | **sobreposição** presa ao corpo | Burning Rush, escudo, carga do `rooted` |

**As marcas de estado (`STATE_MARKS`, `js/sprites.js`).** Eram três anéis de 4
pixels em amarelo, roxo e ciano — cores cravadas no código, fora da paleta, e
os três com a **mesma forma**: a diferença era lida por matiz num círculo de
quatro pixels, que é a coisa menos legível que existe no meio de uma horda. E
`weaken` e `mark` não tinham nada.

- **9×9, e não os 16×16 de `UI_ICONS`.** O ícone da peça trabalha num tile de
  30px na UI; a marca trabalha sobre um corpo de 13 pixels no meio de mil.
  Encolher a grade de 16 para 9 não devolve o desenho, devolve mancha — são
  trabalhos diferentes, então são grades diferentes.
- **Forma, nunca cor.** X, seta dupla, ampulheta, seta para baixo e olho. Matiz
  é a variável mais ocupada do projeto e ela já pertence ao eixo.
- **Silhueta pura; o contorno vem do render** (`drawSpriteRim`), porque a 9×9
  não há duas células para gastar com contorno desenhado à mão.
- **Uma marca por corpo**, por prioridade — e a ordem é por quanto o estado
  muda a jogada: atordoado para o corpo, medo o manda embora, lento muda a
  rota, e os dois de baixo só mudam a conta de dano. Duas marcas sobre o mesmo
  inimigo são a mesma parede que o anel de podridão evita aparecendo só em quem
  tem 3+ DoTs.
- **Degrau 1, sempre.** Amarrar o tamanho ao raio do corpo daria marca em
  degrau 2 no chefe — o mixel silencioso.

**Os eventos de dois pontos (`link` e `dash`).** `VfxLayer` ganhou `x2/y2`
porque duas mecânicas do jogo são uma **relação** e não um acontecimento: o
salto (`chain`, Contágio) e o deslocamento (`knockback`, `pull`, o blink do
Demonic Circle). Sem o par, a única maneira de desenhar um salto seria piscar
algo no destino — que é o que o jogo fazia, e por isso ninguém via de onde
veio. O filamento do `link` é **quebrado e não reto** (reta lê como régua) e a
amplitude morre nas duas pontas, porque ele nasce ancorado nos dois corpos.

O `dash` não desfaz o teletransporte — ele **conta que houve um**. Tornar o
empurrão gradual seria mexer na simulação para consertar um defeito de
apresentação.

**A sobreposição do jogador (Burning Rush).** Estado que dura **não pode ser
evento**: emitir algo a cada pulso da aura é o mesmo erro que emitir um evento
a cada 0,5s para dizer "você tem escudo". Estado se desenha enquanto dura, como
a casca do escudo e o anel de carga do `rooted` já faziam. As riscas ficam
**atrás** do movimento (é o rastro do que já passou) e **no chão** (a faixa de
cima já pertence à build acesa, e o corpo do warlock é o que não pode ser
coberto). Quem entrega a cor é o efeito (`self_speed` grava
`player.speedBoostColor`); quem desenha é `Player.draw`.

`driver_vfx` mede as três: marca e sobreposição contam como **desenho**, não
como evento — um driver que só olhasse `emitVfx` diria que elas não existem.

