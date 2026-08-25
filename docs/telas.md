# As telas: identidade, abertura, level-up e etapa

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `js/ui.js`, `js/ui-glyph.js`, `js/ui-icons.js`, `js/systems/dps.js` ou no CSS do `index.html`.

## A identidade da UI: osso gravado em obsidiana

A interface é uma **placa dura, sem brilho e sem cor própria**, e a única cor
saturada em tela pertence à build do jogador. Os tokens moram no `:root` do
`index.html` e a ponte com o canvas mora em `js/ui-glyph.js` (`UI_PAL`) —
duas listas divergem na primeira mudança, então há uma só.

Três defeitos motivaram o sistema, e cada regra abaixo conserta um deles:

1. **Todo ícone da UI era emoji do sistema operacional** — arte 3D arredondada
   em cima de pixel art em grade inteira, trazendo paleta própria, e mudando de
   desenho conforme o SO de quem abre o jogo.
2. **Roxo era fundo, borda, botão, brilho *e* um dos três eixos de build.** Sem
   neutro em tela, nenhum acento acentua.
3. **As duas telas de escolha se diferenciavam por matiz** — verde (= Corrupção)
   e âmbar (a menos de 20° do laranja do Cataclismo). Matiz é a variável mais
   ocupada do projeto e era ela carregando a distinção mais importante.

**Cinco regras. Tela nova que respeitar as cinco vai parecer deste jogo.**

| # | Regra | O que significa na prática |
|---|---|---|
| R1 | **O cromo é osso** | Zero roxo em botão, borda, foco ou fundo. Domínio volta a ser só um eixo. Toda UI que não fala de eixo é osso sobre obsidiana. |
| R2 | **Cor é predicado** | Verde/roxo/laranja só aparecem quando aquele pixel está falando de Corrupção, Domínio ou Cataclismo. Vermelho existe só na barra de vida, no relógio da fase dura e no eyebrow do game over. Âmbar e ciano foram removidos. |
| R3 | **Placa, não card** | Canto chanfrado — o jeito pixel de arredondar —, nunca `border-radius`. Fundo chapado. Profundidade é 1px claro em cima + 1px escuro embaixo: luz de cima-à-esquerda, a mesma regra do sprite. |
| R4 | **Brilho é orçamento** | Uma tela tem um só emissor. No jogo é a build; na UI é nada. `filter:blur`, `text-shadow`, `backdrop-filter`, glow e `box-shadow` projetada estão proibidos. |
| R5 | **Ícone sai do gerador do mundo** | Nenhum emoji, em lugar nenhum — nem no canvas (o item no chão também era `fillText` de emoji, e depois um `fillRect`; hoje é grade, ver "Os dois drops"). |

Quatro testes para tela que ainda não existe: **some a cor, ainda funciona?** ·
**conte os elementos saturados** (mais de três, ou mais de um botão cheio, e a
hierarquia caiu) · **a silhueta identifica a tela** desfocada a 20px ·
**nada abaixo de 14px, nada arredondado**, alvo de clique de 44px.

Um `grep -nE 'border-radius|text-shadow|blur|gradient|backdrop' index.html` é
metade da verificação. A única `border-radius` permitida é o tile **redondo da
passiva**, que é a forma que separa "não dispara" de "spell" sem usar cor.

### O glifo: um desenho por peça, e a primitiva só para o que não tem

`Glyph.svg(id, size)` (`js/ui-glyph.js`) devolve SVG em linha, em três fontes e
**nesta ordem**:

1. **A grade própria da peça** (`UI_ICONS`, `js/ui-icons.js`): 16×16 em osso
   monocromático, `#` cheio e `.` vazio.
2. **O gerador do mundo.** Se a peça invoca um demônio que já existe em
   `SPRITE_DATA`, o ícone é a grade *dele* — o único caso em que o ícone pode
   ser a coisa em vez de um símbolo dela.
3. **Uma das dez primitivas** de traço 4. É **fallback**, não acervo.

**A ordem custou uma regressão para ser aprendida.** Por um tempo as dez
primitivas *foram* o acervo, e o resultado, medido na tira do HUD: nove peças,
**quatro marcas distintas** — dois `|`, dois `●`, dois `=` — e duas peças
diferentes caindo na mesma forma. O emoji que elas substituíram era pior
esteticamente e **melhor em reconhecimento**, e trocar reconhecimento por
estética num elemento cuja única função é ser reconhecido é uma troca ruim.
`driver_cards` agora **reprova peça sem desenho próprio**: primitiva sem dono é
dívida, não acervo.

Regras da grade, e as três primeiras são o que separa ícone legível de mancha:

- **O vazio dentro da silhueta é que a torna legível a 30px** — buraco de olho,
  vão de costela, miolo de anel. Desenho sem furo vira borrão.
- **Traço de 2 células onde puder.** Traço de 1 célula some quando o ícone é
  desenhado a 24px na linha compacta da pausa.
- **Família importa tanto quanto distinção.** As de fogo compartilham a chama,
  as de podridão o crânio, as de defesa o escudo. Na tira o jogador lê o eixo
  pela cor, a família pela silhueta e a peça pelo detalhe — nessa ordem.
- Uma peça, uma ideia: a 16px não cabe cena, cabe um objeto.

`open icons.html` é a **folha de contato** do acervo, e ela existe pelo mesmo
motivo que `sprites.html`: um ícone sozinho sempre parece bom, e o defeito só
aparece no conjunto. Cada peça aparece nos três tamanhos em que o jogo desenha
(24 na pausa, 30 no HUD, 56 na carta) e, acima dos cards, **a tira** — os ícones
enfileirados do jeito que o HUD os enfileira, que é onde a repetição aparece.
Card bonito e tira ilegível é acervo ruim.

Saída é SVG e não canvas porque a UI é DOM: um `<svg>` entra em qualquer
`innerHTML` que já existe, herda `currentColor` e escala com a moldura sem
borrar. Continua sendo arte gerada em runtime — zero arquivo de imagem.

### As quatro espécies de botão: preenchimento é custo

É a regra que resolve "nada diz qual botão não volta".

| Espécie | Significado | Onde |
|---|---|---|
| **fantasma** (borda osso, fundo transparente) | reversível, não cobra nada | `Escolher` no level up |
| **osso** (fundo `--osso-600`) | neutro forte, cobra atenção | `Iniciar`, `Continuar`, `Tentar de novo` |
| **selo** (fundo na cor do eixo, peso 900) | **irreversível** | **etapa e abertura** |
| **recuado** (borda `--obs-500`, hover vermelho) | destrutivo, não convida | `Reiniciar`, `Sair` |

**Nunca dois botões cheios na mesma tela.** O selo é o único botão do jogo
pintado com cor de eixo, e ele só existe nas duas telas cuja resposta não volta.
Antes a pausa tinha três pílulas roxas idênticas — sair convidava tanto quanto
voltar ao jogo.

**O selo fala de IRREVERSÍVEL, não de custo**, e foi a abertura que cobrou essa
distinção: ela não tira um ponto de eixo de ninguém e mesmo assim não há como
devolver a spell com que a run começou. Lida como "cobra um ponto", a regra
teria mandado a abertura usar botão de osso — e o botão de osso é o `Continuar`
do baú, que é a tela onde nada está sendo decidido.

### A reserva do warlock

`--osso-600` puro (`#EDE7DA`) é **exclusividade do warlock no canvas**. Nenhum
outro sprite, vfx, partícula ou item usa osso cheio — é por isso que o item no
chão é `--osso-400`/`--osso-500` e não branco. Com a build inteira acesa o
jogador perdia de vista a única coisa que controla; ele passa a ser a única
coisa branca em tela. Não é mais luz: é **reserva**.

### O HUD: cinco lugares fixos, e nada no meio

Margem de 24 em todos os cantos. Topo-esquerda a tira de peças (glifos de 56 com
os pips do estado da build embaixo), topo-centro o relógio e **uma** linha de
contexto, topo-direita as três barras de eixo, base-centro vida e XP,
base-direita os toasts. Três mudanças estruturais, e cada uma remove antes de
acrescentar:

- **As barras de eixo saem de baixo da tira de peças** e vão para o canto
  oposto. Eram dois widgets empilhados no mesmo canto, e nenhum dos dois legível
  de relance.
- **O medidor de dano por peça SAI do HUD.** Dano acumulado é informação de
  pós-run: ninguém corrige a jogada com ela. Ele vira a estrela da pausa e do
  game over, e o HUD perde um canto disputado.
- **O relógio perde a terceira linha e as três cores.** Eram tempo, etapa e
  abates em branco, âmbar e verde — e etapa e abates não são estados de eixo,
  então não podem falar em cor de eixo. Viraram uma linha só, em osso.

**A linha de contexto conta CORPOS, não segundos** (`Etapa em N abates · M no
total`). Ela é o único aviso da batida lenta, e um relógio ali diria ao jogador
para *esperar* — que é a jogada que a etapa por abates existe para não premiar.
O limiar em que ela acende (`warnAt`) é **fração do marco atual** e não um
número fixo de corpos: o primeiro marco custa 40 e o décimo custa quase mil,
então 20 abates seriam meio minuto de antecedência lá e um piscar aqui.

**Os pips da tira contam o caminho MAIS FUNDO**, os cinco degraus, como em toda
outra tela. Já foram três — um por caminho, aceso acima do tier gratuito —, e
isso responde "tem caminho investido?" quando a pergunta que a tira faz é "quão
fundo está a minha build?". O trilho deles é `rgba(237,231,218,.18)` e não
`--osso-100`: dois quase-pretos encostados fazem a tira dizer **posse** em vez
de progresso.

**Toast tem teto de três**, a opacidade do fundo cai por idade
(`.92` → `.82` → `.70`) e o excedente vira uma linha `+N eventos`. Cinco toasts
empilhados nunca mais. O contador de eventos anunciados é `UI.toastCount` e não
o número de nós vivos: quem pergunta "isso avisou alguma coisa?" precisa da
resposta mesmo quando o quarto evento virou contador — `driver_form` depende
disso.

**O sexto lugar existe, e ele é a exceção que confirma a regra: a cadeia.**
Borda esquerda, na altura dos olhos — o único vão do HUD, e o único que não
cobre o warlock, que está sempre no centro. Ela pode morar lá porque **não está
sempre lá**: fora de uma cadeia o elemento não existe em tela, então ela nunca
disputa canto com nada. Lugar fixo novo continua sendo cinco.

## A abertura: a primeira coisa que a run faz é perguntar

Antes, a run começava com `incinerate` na mão e o jogador assistindo. Hoje a
primeira tela do jogo é uma escolha entre as **três famílias** da classe, e o
jogo só roda o primeiro quadro depois que ela é respondida. Cada família entrega
três coisas de uma vez: `AXIS_RULES.starterPoints` no eixo dela, a spell dela de
graça (`CLASSES.<id>.starters` — Corruption, Wild Imps, Incinerate no warlock) e
uma **spell garantida em toda etapa** pelo resto da run.

**A manchete é o EIXO, e isso já foi a spell.** A tela sempre teve uma linha por
eixo e mesmo assim perguntava "qual spell?", com o eixo em cinza no subtítulo —
e a resposta que ela colhia era sobre a família, não sobre a peça. Hoje a
pergunta é a que a resposta de fato responde: o ponto, a família garantida e o
capstone lá na frente saem todos do eixo, e a spell é só o primeiro deles.

**O defeito era que a peça de abertura não tinha dono.** Uma peça escolhida por
nós ensina o jogo (o tiro persegue sozinho, o único input é movimento) e não diz
nada sobre a run, porque não houve decisão — e num roguelike a primeira coisa
que o jogador faz não pode ser esperar. Pior: sendo sempre a mesma, as três
primeiras runs de qualquer pessoa começavam idênticas.

O que as três têm que ser, e o que `driver.js` cobra de qualquer classe nova:

- **Uma por eixo.** A escolha é entre **famílias**, não entre três cartas
  quaisquer — é o que faz a tela ser uma pergunta de identidade em vez de um
  sorteio com etapa extra.
- **Dano na base, sem condição.** É a regra de "Toda peça precisa de número
  DESDE A COMPRA", cobrada onde ela mais importa: aqui não existe tier anterior
  para compensar, e uma abertura de controle deixaria o jogador sem nada
  matando pelos primeiros quarenta abates.
- **Sem `requires` e sem `evolutionOnly`.** Nada precede a abertura.
- **Elas não são sorteadas.** São sempre as mesmas três, e é de propósito: a
  parte sorteada da descoberta já existe e chega quarenta abates depois (a fase
  fechada da etapa). Sortear aqui seria repetir a mesma batida duas vezes e
  tirar do jogador a única escolha da run que ele pode planejar antes de
  apertar Iniciar.

**Ela CREDITA ponto de eixo**, e essa frase já disse o contrário. A versão
anterior mantinha a abertura de graça para não devolver "a run pré-comprometida
antes do primeiro marco", e o preço declarado era a **spell órfã**: quem começa
com Wild Imps e nunca abre Domínio para no tier 2 pelo gate de eixo. Esse preço
era pago em silêncio, e o jogador não tinha como saber que estava pagando.

Três regras substituem aquela, e as três saem de a abertura ser uma declaração
de estilo:

- **`starterPoints` no eixo escolhido, e o pool subiu junto** (`AXIS_RULES.pool`
  20 → 21). As ETAPAS continuam entregando 20, então a cadência de marcos — que
  custou uma bateria inteira para achar em `first/every/ramp` — não se mexe.
  Tirar o ponto dos 20 seria pagar a abertura com uma etapa a menos, e ela
  deixaria de ser vantagem para virar adiantamento.
- **A garantia mata a spell órfã na raiz.** `BuildSystem.startAxis` guarda o
  eixo escolhido, e `getMilestoneOffers` reserva uma das `cards` para uma spell
  dele em toda etapa. Sem isso o jogador declara "esta run é de Corrupção" e o
  sorteio da fase fechada pode passar seis etapas sem oferecer nada daquela
  família — a tela teria cobrado uma escolha irreversível e ignorado a resposta.
  `unlockAt` (5 pontos) resolveria isso tarde demais: com `spellPoints` de 1,
  chegar lá exige exatamente as cinco primeiras etapas, que são as que o sorteio
  pode desperdiçar.
- **Ela abre UM eixo, e o pacto conta.** Com `maxAxes: 2`, a run passa a nascer
  com metade do pacto gasta: sobra uma vaga, e todo capstone híbrido vai ter a
  família de abertura como uma das pernas. É comprometimento de verdade, e é o
  que a palavra "estilo" promete — mas é uma porta que fecha antes do primeiro
  marco, e `driver.js` cobra que ela feche **uma** e não duas.

A garantia vem DEPOIS dos slots fixos e ANTES do sorteio, e por isso não
duplica: se o eixo já abriu, o slot fixo dele já carrega uma spell daquela
família. E ela **não é um slot a mais** — ocupa uma das `cards`, então a mesa
não cresce; o que encolhe é o espaço do sorteio.

**Ela é da família da Etapa, não do Level up**, e o motivo é o tamanho da
pergunta: level up é uma batida *dentro* da run (o mundo continua vivo atrás),
abertura é capítulo — o canvas apaga, porque ainda não há run. Daí a mesma placa
sobre preto, o mesmo título à esquerda e as mesmas linhas.

E o botão é **selo** — e agora pelos dois motivos ao mesmo tempo. Ele nunca
falou de custo, falou de **irreversível**, e isso já bastava quando a tela só
entregava uma spell; hoje ela também cobra o ponto que a etapa cobra. As duas
telas que usam selo são exatamente as duas que gastam eixo, o que deixou de ser
coincidência e virou a regra.

Duas consequências no código:

- **`Game.start(starterId)` aceita a peça por argumento**, e é assim que a pasta
  `tools/` roda (`STARTER_TESTE` — no `harness.js` para os drivers, declarado no
  `BOOT` do `browser.js`, que não tem harness). Sem argumento a run para em
  `STATE.STARTER` esperando o clique — num driver isso seria a run inteira
  parada **sem erro nenhum**, o pior modo de falha desta pasta. O smoke
  (`driver.js`) é o único que chama sem argumento, pelo mesmo motivo que é o
  único que monta a tela de etapa de verdade: metade do código novo de uma tela
  mora na montagem dela.
- **`update` já ignora todo estado que não é `PLAYING`**, então a abertura não
  precisou de nada no loop: o mundo fica resetado e parado atrás da placa.

## As duas batidas: level-up aprofunda, etapa compromete

O jogo tem **duas telas de escolha**, com ritmos e perguntas diferentes, e elas
não podem voltar a ser uma só.

| | Level-up | Etapa |
|---|---|---|
| **Quando** | subiu de nível (~17–70 por run) | marco de **abates**, a cada `every`+`ramp` corpos enquanto sobrar ponto |
| **A pergunta** | qual das minhas spells vira *a* spell da run? | para onde essa run vai? |
| **O que oferece** | tier de caminho; passiva global a partir do nível 10 | spell nova (+1 no eixo dela) e, no eixo aberto, +2 secos |
| **Custa** | nada | é a **única** fonte de ponto de eixo |
| **Desfaz?** | a próxima escolha corrige | **nunca** |
| **Forma** | três cartas + tira da build | três colunas + rodapé de eixos |

**Por que foram separadas.** Antes as duas moedas dividiam a mesma escolha:
comprar peça nova custava 2 pontos de eixo, tier acima do 2 custava 1. Com
apenas ~17 escolhas na run inteira, comprar largura era sempre a carta que
*parecia* maior, e o pool de 20 acabava antes de qualquer trilha chegar ao tier
5. Medido, numa run de 16 min: **13 spells na build, onze delas no tier 0**, e
em 16 runs **0 capstones, 0 metamorfoses, 2 evoluções**. O clímax da progressão
existia no código e não acontecia no jogo.

Depois da separação, nas mesmas 16 runs: evoluções 2→8, auras 7→10 (mediana 2
por run), e capstone e metamorfose deixam de ser zero — um perfil que *mira* o
eixo fecha **dois** capstones e chega à forma final. Quem não mira não chega, e
isso agora é escolha declarada e não sorteio.

Consequências que valem para qualquer coisa nova:

- **Nada no level-up pode chamar `addAxis`.** `driver_cards` compara o pool
  antes e depois de toda escolha. Um tier que voltasse a cobrar eixo
  recolocaria o imposto sobre profundidade sem que a tela dissesse isso.
- **E o level-up NÃO consulta mais o eixo.** Por um tempo ele consultava: o
  gate (`PATH_RULES.axisGate`) existia para as duas telas conversarem sem o
  tier voltar a custar ponto — "a etapa decide QUAIS spells podem ficar fundas,
  o level-up decide qual delas fica". Medido, isso cobrava a mesma escolha duas
  vezes e a conta caía em cima de quem espalhou eixo. O gate saiu; a conversa
  entre as telas mudou de canal e ficou mais forte: a etapa decide **quais
  spells a run tem** (teto de 5), **qual família aparece garantida em toda
  mesa** e **qual capstone ela alcança**. Nada disso passa por
  `canUpgradePath`.
- **Passiva fica no level-up, e não é exceção.** Ela não tem tier e não pede
  investimento depois: só multiplica o que a build já tem (`pieceMods` sobre um
  `match`). Isso é aprofundar, não alargar — e é a mesma razão pela qual ela só
  entra a partir do nível `passiveAt`: cedo demais não há o que multiplicar.
  **Ela tem eixo**, mas o eixo não é um preço: é um filtro de quais chegam à
  mesa, decidido lá atrás na abertura (ver "As passivas por eixo").
- **Peça nova só entra por etapa**, e como `free` — o eixo dela já foi pago pelo
  ponto que a carta deixou de dar.
- **Muletas que saíram junto.** O peso extra para caminho já começado e o sort
  que jogava evolução para a frente da fila compensavam um bolo poluído por
  dezenas de peças novas. Com o bolo só de profundidade, o sorteio volta a ser
  honesto: não há mais nada disputando com a trilha que o jogador começou.
- **Nível sem oferta vira fôlego.** Com toda trilha fechada e toda passiva
  tomada o bolo esvazia, e o nível cura 35% em vez de sumir em silêncio. Subir
  de nível e não receber nada é o jogo cobrando atenção e devolvendo vazio.

## A tela de etapa: duas fases, e a virada é o comprometimento

`BALANCE.milestones` é o dado inteiro, e a primeira coisa a saber é que **não há
tabela de pontos por marco**. A rampa é *emergente*: o quanto uma etapa vale sai
do estado da build, não de uma coluna de números.

Marco de **abates** e não de chefe: o primeiro Dreadlord só nasce aos 5 min e
depois vem a cada 2:30, então metade da run ficaria sem marco e a única decisão
irreversível chegaria tarde demais para ser mirada. A linha de contexto do HUD
conta os corpos que faltam para o próximo — marco que chega sem aviso não
estrutura ritmo nenhum.

**E abates, não TEMPO**, que é o que este marco media antes. Relógio entrega a
decisão irreversível por **esperar**: quem fugiu em círculo por 40s recebia o
mesmo ponto de eixo de quem varreu a horda, e a batida lenta — a única escolha
que a run não desfaz — era a única coisa do jogo que não pedia nada do jogador.
Contando corpo, o marco vira o pagamento de matar, que é o verbo do gênero, e a
tela de etapa passa a chegar mais cedo para quem está rampando e mais tarde para
quem está sobrevivendo de raspão.

Três consequências, e as três estão no código:

- **O preço cresce, e cresce acelerando.** Abates por segundo é superlinear
  nesta curva — medido, ~1/s no primeiro minuto e ~100/s aos 10. Quota fixa por
  marco entregaria a pool inteira nos primeiros minutos de uma run que engatou a
  bola de neve, e o clímax chegaria antes de existir build para gastá-lo. Daí o
  termo quadrático: `milestoneKillsAt(idx) = first + idx*every + idx²*ramp`,
  então cada marco pede `every + ramp*(2·idx−1)` corpos a mais que o anterior.
- **Dois marcos no mesmo frame deixaram de ser raros.** Com relógio isso exigia
  um travamento; com corpos, uma explosão grande ou a varredura do Ápice vencem
  dois preços de uma vez. A fila (`pendingMilestones`, teto de 3) era um caso de
  borda e virou o caminho normal.
- **`updateMilestones` roda DEPOIS de `killDeadEnemies`.** O contador que arma o
  marco é o que a varredura acabou de mexer; antes dela, todo marco chegaria um
  sub-step atrasado.

**Quem para as etapas é a POOL, não uma contagem de marcos.** O contador continua
disparando enquanto `axisLeft > 0`. Enquanto uma lista fixa era o fim da linha,
quem levava spell terminava a run com ponto no bolso e nenhuma tela para
gastá-lo — medido, runs acabando em **12/20 e 13/20**, com ponto aparecendo no
painel que o jogo nunca entregava.

### Fase fechada: três spells sorteadas

Antes de qualquer eixo chegar a `unlockAt`, as três colunas são **spells
sorteadas do catálogo inteiro** — podem cair três do mesmo eixo. Não existe
oferta seca: a única maneira de ganhar eixo é escolhendo uma spell, e cada uma
carrega `spellPoints` para o eixo **dela**.

Isso faz o começo da run ser **descoberta e não mira**. O jogador ainda não sabe
o que a run vai oferecer, e escolher spell é como ele descobre — o eixo cresce
como consequência do que ele achou bom, não como uma aposta feita no escuro.

### Fase aberta: o eixo comprometido vira slot fixo

Quando um eixo chega a `unlockAt`, ele passa a ocupar um slot **em toda etapa**,
e esse slot tem duas maneiras de ser levado: `axisPoints` secos, ou a spell
daquele eixo por `spellPoints`. Os slots restantes seguem sorteados. Quando o
segundo eixo abre, ele toma outro slot; com os três abertos não sobra sorteio.

**A garantia chega quando o comprometimento chega**, e é isso que separa este
desenho de uma loteria. O eixo em que o jogador já investiu cinco pontos nunca
mais some da mesa, então o capstone deixa de depender de o sorteio colaborar.
Antes disso ele não tem eixo para proteger.

Cai daí que largura não **gasta** o pool, ela o **desacelera**: a oferta seca
anda `axisPoints` e a com spell anda `spellPoints`, então cada spell levada num
eixo aberto custa um marco a mais. `driver_milestone` reprova
`axisPoints <= spellPoints` — sem essa diferença, arsenal deixaria de custar.

### Cadência: sai da conta, não do gosto

Pool 20; quem abre um eixo cedo gasta ~5 marcos a 1 ponto e o resto a 2, e as
linhas sorteadas nem sempre oferecem o eixo alvo — na prática **~15 marcos**.
Com `first` 40, `every` 90 e `ramp` 45 o 15º marco cai em **10,1 mil corpos**,
que é o que uma run competente do piloto acumula por volta dos 10 min — logo
antes de onde ela acaba. `driver_milestone` refaz essa conta em vez de confiar
no número, porque **marco entregue depois da morte não entrega nada**.

**Mas a conta sozinha não acha os três números, e a primeira tentativa provou
isso.** `50/200/80` foi escolhido para acompanhar a curva de abates *medida* no
jogo de marco por tempo — 50, 252, 586, 931, 1300, 2574, 3807, 5262, 6256 corpos
por marco — e mesmo colada nela derrubou a pool mediana de 12/20 para **5/20**,
com `focado` e `misto` morrendo 2:40 mais cedo. A razão é que **a curva não é
independente do marco**: com relógio o jogador recebe o ponto *e por isso*
produz aquela curva de abates; com corpos, ficar um pouco atrás cedo se acumula
— menos ponto, build mais fraca, menos abates —, que é a mesma realimentação que
a curva de XP já tem documentada acima.

A rampa é um **ponto fixo**, então ela se mede em vez de se derivar. É por isso
que `driver_balance` aceita `first,every,ramp` por argv: achar o ponto exige
rodar a bateria inteira com rampas diferentes, e sem isso seriam três árvores de
trabalho. Medido, contra o jogo de marco por tempo, mesmas seeds:

| | marco por tempo | `50/200/80` | **`40/90/45`** |
|---|---|---|---|
| pool ao fim (mediana) | 12/20 | 5/20 | **20/20** |
| runs com capstone | 4/20 | 4/20 | **7/20** |
| runs com evolução | 2/20 | 1/20 | **6/20** |
| auras (mediana) | 0 | 0 | **1** |

A bimodalidade por política continua e é esperada (ver o balanceamento acima):
`focado` e `misto` batem no teto de 16 min, `agressivo` e `amplo` fecham em
~6–8. O que mudou é que **nenhuma política termina com ponto de eixo no bolso**.

O que ele cobra mudou de unidade junto com o marco: o teto era um relógio (11
min) e virou um **orçamento de corpos** (20 mil). O driver não roda o jogo — ele
exercita a tela —, então quem re-mede a curva de abates é `driver_balance`; aqui
o que se verifica é que a conta cabe nesse orçamento, que ela cresce a cada
marco, e que `ramp` existe.

### Apresentação

- **O FUNDO é o que separa as duas telas, e não a cor.** Esta é a única tela
  que **apaga o canvas** — obsidiana chapada —, enquanto o level up deixa o
  mundo vivo atrás e mantém o relógio a 32% no topo. Um é capítulo, o outro é
  uma batida dentro da run, e o contraste entre preto chapado e mundo vivo é a
  distinção mais forte que existe: não custa um pixel de cor.
  A versão anterior tentava fazer isso por MATIZ — eyebrow âmbar aqui, verde
  lá —, e matiz é a variável mais ocupada do projeto: o âmbar ficava a menos de
  20° do laranja do Cataclismo e o verde *era* a Corrupção. Hoje os dois
  eyebrows são osso, e o que diverge é fundo, alinhamento (título à esquerda
  aqui, centralizado lá), a barra vertical de eixo na ponta da linha, o rodapé
  (barras de eixo e capstone aqui, tira de spells lá) e o **selo**.
- **Linha, e não coluna.** Ela já foi três colunas, e o argumento era o buff
  espremido na faixa do meio de uma linha de 88px. O que consertou o buff não
  foi virar coluna: foi ele deixar de ser texto cinza de 12.5px. Numa linha
  larga sobra espaço para a descrição em `texto-m` ao lado do nome em
  `display-m`, e o **bloco de commit fica sempre na mesma coluna da direita** —
  então comparar os números das três é correr o olho por uma coluna só, que é
  exatamente o que uma tela de três ofertas com a mesma estrutura pede.
- **Duas formas de bloco, e o cabeçalho é onde elas se separam.** No bloco
  **aberto** a manchete é o EIXO — a pergunta é quanto investir nele, e a spell
  é uma das duas maneiras de levar. No **sorteado** a manchete é a SPELL, porque
  é ela que está sendo escolhida; o eixo vira etiqueta abaixo, na cor dele. Pôr
  o eixo no topo de um bloco sorteado seria anunciar como título algo que o
  jogador não escolheu — o sorteio é que pôs aquele eixo ali.
- **`aberto` é o único selo da tela**, e marca a regra que mais importa: este
  eixo não depende mais do sorteio para reaparecer.
- **O alvo é o SELO, não o bloco** — e por isso a linha não carrega `cursor:
  pointer` nem levanta no hover como a carta do level-up. Bloco inteiro clicável
  exigiria escolher por ele qual das duas maneiras é o padrão, e é justamente a
  metade irreversível da decisão. Os dois selos ficam empilhados, não lado a
  lado: os números precisam ser lidos um SOBRE o outro para a diferença
  aparecer. E são a **única** coisa do jogo pintada com cor de eixo cheia — na
  etapa aberta o "só o eixo" é contornado e o "com a spell" é cheio, mesma
  família em pesos diferentes: a opção que leva mais coisa pesa mais.
- **`min-height`, nunca `height`.** Com altura fixa uma descrição que quebra em
  quatro linhas transborda e invade a linha vizinha. Vale para toda linha que
  contém texto.
- **A largura da tela vira distância entre a descrição e o selo**, então o
  conteúdo é travado em **1200px** e a coluna de texto em **720px**. Com os 1360
  da tela inteira sobrava um vão de quase 500px no meio da linha, e o selo — o
  único botão preenchido do jogo — encostava na borda direita lendo como
  etiqueta em vez de botão. Coluna de texto mais larga que 720 também deixa de
  ser lida de relance.
- **A mesa nem sempre tem três.** No fim da run o catálogo esgota e sobram duas
  ofertas, ou uma — e como são linhas empilhadas, a sobrevivente ocupa a largura
  inteira em vez de encolher num canto com dois buracos ao lado.
- **O número anunciado é o creditado.** Com o eixo no teto ou o pool no fim,
  `addAxis` entrega menos; `getMilestoneOffers` devolve `gain` real ao lado do
  `want` de tabela, e o driver compara os dois em toda oferta de toda etapa.
- **O slot do eixo aberto sai da mesa quando o eixo não anda mais.** A regra
  abaixo valia só para as cartas sorteadas: com o eixo comprometido no teto de
  15, o slot fixo continuava oferecendo `SÓ O EIXO +0 · eixo no teto` — um botão
  clicável que não faz nada, na única tela cujo clique não se desfaz. Se as duas
  maneiras zeram, o slot inteiro sai e o sorteio ocupa o lugar dele.
- **E carta que credita +0 não é oferta, é botão morto.** O sorteio pula spell
  cujo eixo não anda mais, e se ainda assim a mesa inteira ficar em zero — todo
  eixo com espaço já teve o catálogo esgotado — o fallback seco entra no lugar
  da última carta em vez de estourar o teto de `cards`. A trava é real e não
  teórica: com o eixo comprometido no teto de 15 e o catálogo dele cheio de
  spells, três cartas mortas na mesma etapa paravam a pool com ponto por gastar,
  e como quem para as etapas é a POOL, o jogo devolvia uma tela por marco até o
  fim da run sem nunca entregar o ponto. Media: 3 em 60 runs de quem mira.
- **A barra de eixo carrega os traços do gate.** Em 5, 10 e 15 — os tiers que o
  ponto destrava — e não em texto: a barra tem 8px de altura, então quem quer o
  número passa o mouse e quem quer a distância vê a prévia cravar antes ou
  depois do traço. Sem eles a barra diz quanto o eixo cresceu e não o que o
  crescimento compra, que é justamente por que esta tela importa.
- **O rodapé é o que transforma "+2" num destino**: as três barras de eixo com
  prévia (`UI.axesHtml`, compartilhada com o painel do level-up) e o capstone
  mais próximo. Sem ele, alocar é uma decisão de rota longa com feedback só no
  fim da run.
- **Sem denominador no rótulo.** "Etapa 4 de 7" mentiria justamente para quem
  mais precisa saber que ainda vem mais: o jogador que levou spell toda vez e
  está atrasado na pool. O rótulo diz quantos pontos faltam, não quantas telas.

### O que essa forma custa, medido

Ela conserta duas coisas e cobra uma terceira. Em 20 runs do `driver_balance`:

| | tabela fixa de 7 marcos | duas fases |
|---|---|---|
| pool ao fim (mediana) | 13/20 | **19/20** |
| runs com capstone | 4/20 | **8/20** |
| runs com evolução | 11/20 | 7/20 |
| auras (mediana) | 2 | 1 |

O ganho é a pool fechar e o capstone acontecer. O custo era **profundidade**: a
fase fechada só aceita spell, então toda build saía dela com 9–12 spells, e os
tiers do level-up se espalhavam entre elas em vez de fechar caminhos.

**Esse custo foi pago pelo teto de spells** — ver "O loadout e a linha única"
logo abaixo. A alavanca antiga era `unlockAt` (baixá-lo encurta a fase fechada);
ela continua existindo, mas deixou de ser a única, e é a menos direta das duas:
`unlockAt` decide quantas spells a run é *obrigada* a carregar, `maxSpells`
decide quantas ela *pode*.

Efeito colateral bom: o sorteio olha o **catálogo inteiro**, então Domínio
voltou a aparecer. Enquanto as cartas eram uma por eixo e o kit inicial não
semeava Domínio, ninguém escolhia aquele eixo e o catálogo de demônios ficava
sem uso — `driver_balance` listava dez peças em `NUNCA ESCOLHIDA`.

## O loadout e a linha única: menos opção viva, mais build fechada

Duas regras, e elas são a **mesma regra por lados opostos** — uma corta a
largura da build, a outra a largura da peça:

| | regra | dado |
|---|---|---|
| largura | a run cabe em **5 spells** | `BALANCE.loadout.maxSpells` |
| profundidade | a peça sobe por **uma linha por vez** | `PATH_RULES.maxDeep: 1` |

**O que elas consertam é uma coisa só, e ela aparece em dois lugares.** O
jogador reclama de informação demais para decidir; o `driver_balance` reprova
evolução em 1/30 runs e capstone em 4/30. As duas leituras têm a mesma causa: a
build saía da fase fechada com 9–12 spells × 3 linhas, então o bolo do level-up
tinha **~30 candidatos vivos** — e uma tela sorteada de trinta candidatos, a
cada dez segundos, não é escolha nem fecha caminho nenhum. Reduzir opção aqui
não é concessão de UX; é a alavanca de profundidade que a medição já pedia.

Cinco consequências, e cada uma custou uma decisão:

- **`maxLines: 2` existe para a corrente de evolução não morrer.** Uma peça
  evolui duas vezes (arcaneShot → aimedShot → killShot), e a segunda evolução
  precisa de uma linha diferente da primeira — a que evoluiu está no tier 5 e
  não sobe mais. Contando só `maxDeep`, a corrente ficaria impossível **em
  silêncio**. Então as duas contagens dizem coisas diferentes de propósito:
  `maxDeep` é quantas linhas estão **em progresso**, `maxLines` é quantas
  passaram da zona franca **na vida da peça**. Lido para o jogador é uma frase:
  *uma linha por vez — feche-a e a peça pode abrir a próxima.*
- **`freeTier` é a ZONA FRANCA, e ela é o que salva o caso "só uma spell".**
  Com uma peça na build, o bolo seria de um candidato e a tela não teria o que
  perguntar. Com a zona franca em 1, os três primeiros degraus (um por linha)
  são compras livres, então a mesa nasce cheia — e a decisão de linha chega
  depois de o jogador ter visto o tiro sair mais rápido, o número subir e o
  primeiro crítico. Em 0 a primeira tela seria aposta cega, e nada na carta
  salva isso: o "antes → depois" mede o próximo tier, não o destino.
- **A carta que trava imprime o DESTINO.** Enquanto duas linhas cabiam na mesma
  peça, anunciar o tier 5 num tier baixo era promessa que o jogador não precisa
  cumprir. Com a trava, escolher a linha **é** escolher o tier 5, e escondê-lo
  seria a tela cobrando a decisão mais pesada da peça sem dizer o que ela
  compra. O nome sai do próprio dado (o último tier da linha, já escrito à mão).
  E a faixa é **osso, nunca cor de eixo**: "isto não volta" é um fato sobre a
  decisão, não sobre Corrupção — a mesma razão pela qual "Maior ganho" é osso.
- **Bolo de uma oferta não abre tela.** Parar o mundo e pedir um clique para
  apresentar a única coisa que pode acontecer é o jogo cobrando atenção e
  devolvendo vazio — o mesmo defeito que o fôlego conserta do outro lado (bolo
  zero). `applyOffer(o, true)` aplica e conta por toast, e a fila continua
  andando, então vários níveis de uma vez viram vários toasts e não várias
  telas mortas. O toast já tem teto de três com `+N eventos`.
- **Largura deixou de ter PREÇO e passou a ter TETO**, e isso apagou uma
  asserção do `driver_milestone`. Antes, quem levava spell toda etapa andava de
  1 em 1 e fechava a pool bem depois de quem mirava; hoje os dois convergem,
  porque depois da quinta spell jogam a mesma etapa. O driver passou a cobrar a
  **convergência** — divergir muito significaria que o preço voltou.

E o teto criou uma **terceira espécie de carta de etapa** (`dryOnly`): eixo seco
de um eixo que pode nem ter aberto, oferecido porque não há mais spell que caiba.
Ela não pode se disfarçar de `locked` — `locked` promete slot fixo em toda
etapa, e esta não promete nada. Com o pacto de dois eixos sobram até duas
dessas, e "+2 na Corrupção ou +2 no Cataclismo" continua sendo uma decisão.

## As passivas por eixo, e o excedente que virou pressa

**Toda passiva declara `axis`, e só aparecem as do eixo escolhido na ABERTURA.**
Era o último pedaço da progressão que ignorava aquela escolha: um multiplicador
genérico sorteado de um bolo que não olhava para a run. Hoje a família decide as
três coisas — quais spells a run recebe garantidas na etapa, qual capstone ela
alcança, e como ela multiplica o que tem.

Três regras, e `driver_cards` cobra as três:

- **Par exclusivo mora no MESMO eixo.** `furiaContida`/`pesDeCinza` (e, no
  hunter, `municaoLeve`/`municaoPesada`) só significam algo se as duas puderem
  cair na mesma mesa: a escolha *é* a exclusão. Separadas por eixo, o jogador
  nunca vê as duas na mesma run e `exclusive` vira um campo que não faz nada —
  uma mecânica morrendo em silêncio.
- **Nenhum eixo fica sem.** Um eixo vazio seria um terço das aberturas jogando
  uma run inteira sem passiva nenhuma.
- **Passiva sem `axis` nunca seria oferecida**, então o driver reprova o campo
  ausente em vez de deixá-la sumir do bolo.

O preço declarado é **variedade**: das 8 do warlock, uma run vê 2 ou 3. Em
troca, a passiva parou de ser sorteio e virou parte da identidade escolhida.

### E o nível sem oferta virou PRESSA

O bolo vazio deixou de ser caso de borda. Com o teto de 5 spells e uma linha por
vez, a build inteira cabe em ~45 tiers e uma run passa dos 70 níveis: a partir
do momento em que o bolo esvazia, **todo** nível cai ali.

A resposta era curar 35%, e cura **não acumula** — ela responde bem uma vez e
responde mal quarenta: o jogador continuava subindo de nível e parava de
progredir. `BALANCE.levelup.overflow` troca isso por um stack de pressa.

- **O canal já existia**: `game.cooldownMul` é o que `TRIGGERS.cd` aplica na
  recarga de **toda** peça. Um stack acelera a build inteira sem saber quais
  spells ela tem, inclusive as que entrarem depois — e `js/systems/dps.js` lê o
  mesmo número, então a régua da carta não diverge do jogo de graça.
- **`floor` existe pela mesma razão que `self_damage` nunca reduz abaixo de um
  piso.** "Sempre aumentar" sem limite é uma recarga convergindo para zero, e
  recarga zero não é uma build rápida: é um disparo por sub-step. Em `0.97` por
  stack são ~30 níveis excedentes até o piso de `0.4`.
- **O piso é sobre a contribuição do excedente, não sobre o total.** Um capstone
  que *penaliza* recarga (Nihilam cobra `1.3`) tem o direito de deixar o total
  acima de 1; um piso no total apagaria a penalidade em silêncio.
- **`overflowHaste` é contador, não fator acumulado.** `applyGlobals` reconstrói
  do zero a cada mudança — ele não soma, ele refaz —, então guardar o fator já
  multiplicado o faria ser reaplicado sobre si mesmo a cada aquisição.
- A cura fica: ela não atrapalha, e o excedente acontece justamente quando a
  horda está no teto.

## A tela de level-up: o que a compra muda

Três **cartas verticais** de 348 x min-height 376 lado a lado, e abaixo uma tira com a build
de agora. O mundo continua atrás — é isso, e não a cor, que separa esta tela do
preto chapado da etapa —, mas a **8%**: com mil inimigos em campo os pontos
brancos do canvas ficavam mais claros que o texto das cartas, e o mundo tem que
dizer "você está numa run", não competir com a leitura. **O HUD inteiro sai**
(`openLevelUp` esconde `#hud`): tira de peças, painel de eixos, barra de vida e
cadeia seguiam acesos numa tela onde o jogo está parado e nada disso decide
nada. Só o relógio fica, e ele é o da própria tela.

**O problema não era estética, era carga cognitiva.** As cartas mostravam em
destaque o que era **igual** entre as opções (`+40% de dano`, duas vezes) e
escondiam em mono cinza no rodapé o que **diferia** (`27/s → 38/s` contra
`270 → 378`) — duas unidades diferentes que o jogador tinha que converter de
cabeça, 17 a 70 vezes por run. Sem denominador comum ninguém compara: ou chuta,
ou escolhe sempre a mesma coisa, e nos dois casos a escolha deixou de ser
decisão.

**A resposta a isso foi a RÉGUA — o ganho em dano/s, em mono 38, com uma barra
comparativa e o selo de `MAIOR GANHO` —, e ela SAIU da carta.** O que ela dizia
era uma previsão: quanto a oferta ia render num campo suposto
(`BALANCE.dps` — quantos corpos um raio pega, que fração da horda carrega um
DoT seu). Ao lado do `dano 175 → 263`, que é o número que o jogador vai passar
a ter de fato, a previsão era o elemento maior da carta e o único que podia
estar errado. Ficou o fato.

**A hierarquia interna:**

1. **o próprio upgrade** em `dado-m`, com o valor novo na **brasa** do eixo
   (`dano 175 → 263`). É o corpo da carta, e ele ocupa o lugar onde a régua
   morava — logo abaixo do primeiro filete.
2. nome da spell, linha de contexto e etiqueta de tipo.
3. o slot em Eczar (só quando há comportamento novo), `.lv-why`, ícone, pips e
   tecla.

Regras que caem daí:

- **Uma mudança por linha.** Duas na mesma linha (`crítico 5% → 30% · dano
  crítico 2x → 2.5x`) pedem que o olho ache o divisor antes de achar o segundo
  número, e o `antes → depois` já carrega uma seta por conta própria.
  Empilhadas, as duas começam na mesma coluna e se leem de uma vez. `v.crus` é
  um **array**, e o `gap` entre as linhas é 6 e não os 14 da carta: são duas
  faces do mesmo fato.
- **A carta não prevê mais nada.** Sem régua não há barra, não há escala
  compartilhada (`UI.lvScale` foi junto) e não há carta vencedora — comparar
  qual rende mais voltou a ser leitura do jogador, e o que a tela garante é que
  ele tem o número certo para fazer isso.
- **O modelo continua de pé, e continua cobrado.** `BuildSystem.offerGain` →
  `js/systems/dps.js` não foi apagado: `driver_bench` (bloco `REGUA x CAMPO`)
  continua medindo se ele ordena como o campo, e `driver_cards` passou a
  chamá-lo por oferta. Modelo sem consumidor apodrece calado — este tem dois, e
  é isso que permite a régua voltar a ser desenhada no dia em que a tela quiser
  prever de novo. `driver_cards` reprova `lv-escala`, `lv-ganho` e `lv-top-lbl`
  de volta na carta sem essa decisão ser tomada.
- **A tecla substitui os três botões `ESCOLHER`.** 34px no canto em vez de 44px
  na largura inteira, três vezes, repetindo a mesma palavra. A carta inteira
  continua sendo o alvo de clique; `1`/`2`/`3` são o input certo de uma tela que
  aparece 70 vezes por run (`UI.levelUpKey`, chamada do `keydown` do `Game`).

**O eixo aparece em três lugares pequenos** — quadrado de 9px, brasa no valor
novo, pips — e **nunca na moldura**: moldura de eixo faria a carta ser lida pela
cor antes de ser lida pelo que ela muda, e é isso que é o assunto desta tela.
Foi pela mesma conta que o chip de recomendação (`acende a aura`) saiu.

Regras que continuam valendo:

- **O slot do nome carrega a SPELL, não o nome do tier.** O jogador reconhece
  "Incinerate" de imediato; "Brasa" não quer dizer nada até ser lido. Em
  evolução o nome é a **forma nova**.
- **O tipo é carregado por forma, nunca por cor.** A cor da carta é a do
  **eixo**, então melhoria verde e evolução verde são a mesma cor. Quem separa é
  etiqueta com glifo — `▲` melhoria, `★` evolução, `✦` passiva —, tile redondo
  na passiva, e o selo do tier no canto do tile na melhoria, porque aí o ícone
  *mente*: é o ícone de uma spell que o jogador já tem e sozinho não diz quão
  fundo ela está. Os glifos são **dingbats de apresentação em texto**, nunca
  emoji: `⭐` (U+2B50) sai colorido pelo SO e por isso virou `★` (U+2605).
  E o peso da etiqueta também informa: **melhoria e passiva são contornadas**
  (falam de categoria) e **evolução é cheia em osso** (fala de raridade) — ela
  não é um degrau a mais, é conversão.
- **A coordenada do tier é DESENHO, não texto.** Os cinco pips do rodapé já
  dizem em que degrau a compra deixa a trilha; o `· tier 2 → 3` do subtítulo e
  o `Faltam 3 para fechar` do rodapé eram o mesmo fato escrito ao lado do
  desenho dele, duas vezes na mesma carta. Saíram os dois, e o subtítulo ficou
  com a **linha** sozinha (`Maestria`). `driver_cards` cobra que nenhum dos
  dois volte.
- **`.lv-why` só aparece quando acrescenta** — passiva **exclusiva** (fecha uma
  porta) e **evolução** (a peça troca de identidade inteira). Numa carta o nome
  está logo acima, e repetir a identidade é ruído.

**Passiva só entra a partir do nível `BALANCE.levelup.passiveAt`** (10). Uma
passiva não constrói nada sozinha — ela **multiplica** o que já está lá
(`pieceMods` sobre um `match`). Oferecida no nível 2, com duas spells no tier 0,
ela multiplica quase nada, e pior: ocupa uma das três cartas disputando com o
tier que abriria a trilha. São oito passivas para uma run de dezenas de níveis,
então adiar não custa variedade — custa só o começo, que é onde a spell precisa
de tier e não de multiplicador. A linha de contexto dela conta **quantas peças
ela toca** (`UI.passiveReach`, pelo mesmo `_matches` do pipeline de stats): é o
que separa "multiplica quase nada" de "multiplica a build inteira".

**E `pendingLevels` sai da conta.** O nível que importa é o que *esta* escolha
paga, não o topo da fila — é a mesma leitura que o rótulo da tela já faz. Sem
descontar, chegar ao nível 10 de uma vez faria a primeira carta (a que paga o
nível 8) oferecer passiva, e a trava de dez viraria uma de oito. `driver_cards`
cobra as duas pontas: nível 1 sem passiva, e nível 10 com fila de 3 também sem.

**Nenhum texto novo por tier.** São 660 tiers no catálogo, e só 132 deles são
escritos à mão (os tier 5, um por linha por peça) — os outros 528 saem dos
geradores das três linhas. Escrever "antes → depois" à mão em cada um seria
conteúdo que envelhece no primeiro rebalanceamento. Tudo o que a carta mostra
sai do que já existe:

| Campo da carta | De onde vem |
|---|---|
| antes → depois | `tier.mods` aplicado a `inst.r.stats` (`UI.tierDelta`) |
| frase em Eczar | `tier.desc` — e só no tier estrutural e na passiva |
| onde chega | os pips, de `tierIndex` contra `PATH_RULES.tiers` |
| porquê | só em evolução e passiva exclusiva |
| tira inteira | `build.pieces`, `build.passives` |

Consequências:

- **O delta sai dos stats RESOLVIDOS da instância**, com passivas e capstone
  dentro — é o número que o jogador vai passar a ter, não o da tabela. Tier
  só-estrutural (`mods` nulo, `patch` presente) não tem delta numérico e a
  frase do tier carrega sozinha; um tier pode escrever `was`/`now` à mão quando
  o texto disser mais que o número.
- **`STAT_FMT` (`js/ui.js`) é quem sabe a unidade.** `duration: 6` é seis
  segundos, `frac: 0.06` é seis por cento e `radius: 440` não tem sufixo — sem
  a tabela o delta imprimiria "limiar 0.35 → 0.5". Stat sem entrada não aparece,
  e `driver_cards` reprova mod que mexa em stat fora da tabela.
- **Tier numérico não tem parágrafo nenhum.** 528 dos 660 tiers são gerados e o
  texto deles é puro número ("+40% de dano.") — o mesmo dado que o próprio
  upgrade imprime logo acima. O slot já tentou duas saídas e as duas eram a mesma coisa por
  extenso: o `desc` da peça (idêntico nas duas cartas que costumam ser da mesma
  spell) e depois `LINE_ABOUT`, a frase da linha — que dizia "cada vez que a
  peça acontece, ela acontece mais forte" nas cinco cartas daquela linha, run
  atrás de run. Hoje **quem fala pelo tier numérico é o próprio upgrade**
  (`dano 175 → 263`), e o parágrafo simplesmente não é desenhado. Tier
  estrutural e passiva ficam com o próprio texto: ali ele **é** o comportamento
  novo, e é a única carta em que ele aparece. `driver_cards` cobra os dois
  lados — que o numérico não escreva parágrafo e que ele traga o "antes →
  depois".

### A régua: `js/systems/dps.js` — o modelo que a carta não desenha mais

**A régua saiu da tela e o modelo ficou.** Ela era a única coisa da carta que
não saía do catálogo — era simulada —, e é exatamente por isso que ela saiu: ao
lado do `antes → depois`, que é fato, a previsão era o maior elemento da carta
e o único que podia estar errado. O que segue de pé é o modelo, com dois
consumidores que o mantêm honesto (`driver_bench` no bloco `REGUA x CAMPO` e
`driver_cards`, que o chama por oferta) — e é isso que permite a régua voltar a
ser desenhada sem ter que ser reescrita.

`BuildSystem.offerGain(o)` monta uma **sombra** (um objeto com `def` e `paths`
trocados) e a passa pelo mesmo `resolvePiece` que o motor usa, então a previsão
vem do mesmo pipeline que vai rodar quando a carta for clicada. Passiva é o
mesmo truque pelo outro lado: ela entra no mapa, `applyGlobals` recalcula do
zero, a build inteira é re-resolvida, e o desfazer é exato porque `applyGlobals`
não soma — ele reconstrói.

Três regras mantêm o modelo honesto:

1. **Ele lê a instância RESOLVIDA** (`inst.r`), não o catálogo. Não há uma
   segunda lista de números para divergir da primeira, que é o defeito que este
   arquivo já documenta em paleta, em voz e em galeria.
2. **O campo é dado** (`BALANCE.dps`). Quantos corpos um raio pega, quanto
   tempo o jogador anda, que fração da horda carrega um DoT seu — tudo isso é
   **suposição**, e suposição escondida no meio de um `switch` é a que ninguém
   revisa.
3. **Ele promete ORDEM, não valor.** Enquanto a barra era comparativa, errar a
   escala não mentia para ninguém; inverter duas ofertas mentia. É a mesma
   promessa que os drivers cobram hoje, sem tela nenhuma dependendo dela.

**Quem cobra a terceira é o próprio `driver_bench`**, no bloco `REGUA x CAMPO`:
ele já mede toda peça com o motor rodando, então a comparação mora ao lado da
medida em vez de virar um segundo banco. Hoje o **rho de Spearman entre as duas
ordens é 0.75**, com piso de 0.6 — frouxo de propósito, porque o modelo assume
**um** campo e o banco mede seis, dois deles de alvo único. E ele reprova mudez
nos dois sentidos: régua zero com campo medindo dano e régua com dano onde o
campo mede zero — as duas eram mentira na carta enquanto a carta desenhava o
número, e continuam sendo modelo quebrado agora que ela não desenha. A isenção é a mesma que o banco já
carrega: `player_below` e `enemy_below` nunca viram verdade num campo em que o
jogador é imortal e os dummies também.

Quatro coisas que o modelo aprendeu medindo, e que valem para efeito novo:

- **DoT não rende "dano × duração por aplicação".** Ele rende o que está
  ardendo por segundo, e quem decide isso é a regra de pilha: `refresh` satura
  em um (Immolate a cada 2s num DoT de 6s rende o próprio dps, não o triplo) e
  `stack` empilha até `max` — é por isso que Agony, 18/s de tabela, mede **73/s**
  em campo. `ramp` é o terceiro fator.
- **`onExpire` cobra na taxa de VENCIMENTO, não na de aplicação.** Doom
  reaplica a cada 4s uma sentença de 8s: no mesmo alvo ela nunca vence, e o
  demônio que ela prometia nunca nasce.
- **`pierce` é a segunda vazão da peça**, e é a que a densidade da horda
  multiplica. É a mesma lição que a grade das três linhas já custou uma vez.
- **`onlyDotted` corta o alvo, não o raio.** Sem ele, Malefic Rapture — que só
  rasga quem já está apodrecendo — era contada como peça de área comum, e
  aparecia 20x acima do que o campo mede.

**A build virou uma TIRA, não um painel.** Era uma coluna de 316px com densidade
automática, teto de linhas, contador de excedente, chips, três barras de eixo e
a linha do capstone. Metade daquilo existia só para caber numa coluna estreita;
a outra metade respondia perguntas que esta tela não faz mais. **Eixo e capstone
saíram de vez**: nenhuma oferta daqui os move, e a tela de etapa — que é onde
eles mudam — já os mostra com prévia ao vivo; repetir aqui era mostrar um número
parado ao lado de três cartas que não o tocam. `driver_cards` reprova `lv-ax` de
volta na tira.

Sobrou a única pergunta que a tira responde, e ela é a desta tela: **em que
degrau estão as minhas outras spells — e qual delas parou?** Ícone, nome, pips
do caminho mais fundo, o `have/need` do gate de eixo quando a spell travou,
e a spell que a carta sob o mouse melhora acende — é o que liga a decisão ao
estado da build sem a tira ter que explicar nada por escrito. `STRIP.spells` é o
teto e o excedente vira contador, porque overlay de jogo não rola.

Estado novo é **um só**: o índice da carta sob o mouse. O hover re-renderiza só
a tira; mexer nas cartas mataria a transição de `transform` que o CSS está
rodando naquele instante. A mesma regra vale na tela de etapa, onde o hover
re-renderiza só o rodapé.

**Tipografia: três famílias, três funções.**

| Família | Função | Por quê |
|---|---|---|
| **Big Shoulders Display** | voz do jogo: logo, título, nome de peça, label de botão | condensada e de traço uniforme — cabe apertado no HUD, grita no menu, e **sobrevive à pixelização**, que é requisito do logo |
| **Eczar** | nome próprio de peça em corpo, efeito, texto corrido | traz o grimório sem virar fantasia |
| **IBM Plex Mono** | número, tempo, tier, eyebrow, etiqueta | já estava no projeto e estava certo |

**Outfit saiu**: não tem voz, é fonte de landing page.

**Piso de 14px, sem exceção**, e alvo de clique mínimo de 44px. Os 13px do
rodapé e os 12px do "1/20 pontos" do HUD antigo subiram ou sumiram.

As três vêm do Google Fonts, e essa é a **única** exceção à regra de "nenhum
asset novo" — baixar os `.woff2` adicionaria arquivo ao repo. Offline as pilhas
de fallback em `--fonte-display`/`--fonte-texto`/`--fonte-dado` assumem e a tela
continua legível, só perde o desenho da fonte.

