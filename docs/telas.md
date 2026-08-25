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
primeira tela do jogo é uma escolha entre **três spells, uma por eixo**
(`CLASSES.<id>.starters` — Corruption, Wild Imps, Incinerate no warlock), e o
jogo só roda o primeiro quadro depois que ela é respondida.

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

**Ela NÃO cobra ponto de eixo**, e essa é a linha que separa esta tela da etapa.
O que a abertura decide é *com o que* a run começa; para onde ela vai continua
sendo pergunta da etapa. Misturar as duas devolveria a run pré-comprometida
antes do primeiro marco — que é exatamente o defeito que tirou a segunda peça do
kit inicial em primeiro lugar. O preço declarado é que a spell de abertura pode
ficar órfã: quem começa com Wild Imps e nunca abre Domínio para no tier 2 pelo
gate de eixo. É a mesma conta de qualquer spell levada num eixo abandonado, e a
tira do level-up já mostra o `have/need` que explica isso.

**Ela é da família da Etapa, não do Level up**, e o motivo é o tamanho da
pergunta: level up é uma batida *dentro* da run (o mundo continua vivo atrás),
abertura é capítulo — o canvas apaga, porque ainda não há run. Daí a mesma placa
sobre preto, o mesmo título à esquerda e as mesmas linhas.

E o botão é **selo**, apesar de não cobrar ponto. O selo nunca falou de custo,
falou de **irreversível**: não há como devolver a spell com que a run começou.
Esta é a única tela além da etapa em que isso vale.

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
- **Mas o level-up CONSULTA o eixo, e é isso que faz as duas telas
  conversarem.** Depois que o tier deixou de custar ponto, profundidade virou
  de graça e a etapa passou a decidir só a largura da run. O gate de eixo
  (`PATH_RULES.axisGate`, cobrado em `canUpgradePath`) devolve a conversa sem
  devolver o imposto: **a etapa decide QUAIS spells podem ficar fundas, o
  level-up decide qual delas fica.** Espalhar eixo continua sendo uma escolha —
  ela só passou a ter preço, e o preço é chegar ao fim da run com spells largas
  em vez de uma fechada.
- **A trava vale para TODA fonte de tier**, porque quem pergunta é
  `canUpgradePath`: level-up, baú e o que vier depois. Isentar o baú faria dele
  a brecha que desmonta a regra — ele é a única fonte de tier grátis.
- **Oferta travada some do bolo, então a tela tem que dizer por quê.** A tira da
  build marca a spell parada (`lv-sp-lock`, `have/need` na cor do eixo, pip
  vazado no degrau bloqueado) e o nível sem oferta troca "Arsenal completo" por
  "Trilha travada" com o número que falta — `build.nearestGate()`. Sumir com a
  trilha em silêncio é a tela cobrando atenção e devolvendo vazio, que é o
  mesmo defeito que o fôlego já conserta do outro lado.
- **Passiva fica no level-up, e não é exceção.** Ela não tem tier, não tem eixo
  e não pede investimento depois: só multiplica o que a build já tem
  (`pieceMods` sobre um `match`). Isso é aprofundar, não alargar — e é a mesma
  razão pela qual ela só entra a partir do nível `passiveAt`: cedo demais não
  há o que multiplicar.
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

O ganho é a pool fechar e o capstone acontecer. O custo é **profundidade**: a
fase fechada só aceita spell, então toda build sai dela com 9–12 spells, e os
tiers do level-up se espalham entre elas em vez de fechar caminhos. Se o alvo
mudar e evolução voltar a importar mais que capstone, a alavanca é `unlockAt` —
baixá-lo encurta a fase fechada e é o número que decide quantas spells a run é
obrigada a carregar.

Efeito colateral bom: o sorteio olha o **catálogo inteiro**, então Domínio
voltou a aparecer. Enquanto as cartas eram uma por eixo e o kit inicial não
semeava Domínio, ninguém escolhia aquele eixo e o catálogo de demônios ficava
sem uso — `driver_balance` listava dez peças em `NUNCA ESCOLHIDA`.

## A tela de level-up: a régua comum

Três **cartas verticais** de 348x436 lado a lado, e abaixo uma tira com a build
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

O jogo já sabe cadência, alvos e dano de cada peça. Ele pode fazer a conta que o
jogador não faz — e é isso que a régua é.

**A hierarquia interna, e ela trocou de dono:**

1. **a régua** — o ganho em **dano/s** em mono 38, e a barra de 12px logo
   abaixo. É o maior elemento da carta depois do nome.
2. **os valores crus** em `rotulo`, com o valor novo na **brasa** do eixo
   (`crítico 5% → 30% · dano crítico 2x → 2.5x`). Continuam ali para quem
   quiser conferir; deixaram de ser o único lugar onde a diferença aparecia.
3. nome da spell, linha de contexto e etiqueta de tipo.
4. o slot em Eczar, `.lv-why`, ícone, pips e tecla.

**As três barras compartilham a mesma escala** (`UI.lvScale`, calculada sobre a
mesa e não dentro de `offerView`, que só vê uma oferta por vez): a mais longa
ganha mais, e isso se lê **sem número**. A legenda embaixo do título ensina a
régua uma vez; depois disso o jogador só lê as barras.

Regras que caem daí:

- **A régua é honesta, não promocional.** Ela não sabe o que é espetacular —
  ela sabe quanto rende. Se a evolução não for o maior ganho, ela não é marcada
  como maior ganho: uma régua que só confirmasse a opção mais vistosa não
  estaria informando nada.
- **`MAIOR GANHO` é osso, nunca cor de eixo.** "Esta rende mais" é um fato
  aritmético, não um eixo falando. A marcação é luz de 2px no topo + moldura de
  osso + o rótulo na régua + a tecla em osso cheio.
- **Empate não marca ninguém.** Duas cartas em osso cheio na mesma tela
  colidiriam, e "as duas rendem igual" não é o que a marcação existe para dizer.
- **O piso da barra é 3%.** Uma evolução pode render trinta vezes o tier
  vizinho, e a barra proporcional daquele vizinho sairia com meio pixel — que
  lê como zero, e zero é outra coisa ("esta oferta não move o dano"). O piso
  mantém a distinção que importa sem mexer na ordem.
- **Ganho zero não vira `+0`.** `+0 dano/s` lê como peça quebrada quando o que
  houve foi a régua não medir aquilo: a carta escreve `—` e diz `não muda o
  dano` (controle, cura, deslocamento) ou `ganho fora da régua` (passiva ligada
  a hook, que roda código imperativo que o modelo não percorre).
- **A tecla substitui os três botões `ESCOLHER`.** 34px no canto em vez de 44px
  na largura inteira, três vezes, repetindo a mesma palavra. A carta inteira
  continua sendo o alvo de clique; `1`/`2`/`3` são o input certo de uma tela que
  aparece 70 vezes por run (`UI.levelUpKey`, chamada do `keydown` do `Game`).

**O eixo aparece em quatro lugares pequenos** — quadrado de 9px, barra da
régua, brasa nos valores crus, pips — e **nunca na moldura**: moldura de eixo
faria a carta ser lida pela cor antes de ser lida pelo número, e o número é o
assunto desta tela. Foi por isso que o chip de recomendação (`acende a aura`)
saiu: ele era um quinto lugar em cor de eixo, e o mesmo fato cabe no veredito
do rodapé em texto.

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
- **Veredito, não coordenada.** A linha de contexto já diz `Aceleração · tier
  2 → 3`; o rodapé diz o que aquilo *significa* (`Fecha o caminho`, `A um tier
  do fim`). Ele deixou de imprimir `Tier N de 5` justamente porque isso era a
  coordenada duas vezes na mesma carta.
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
| ganho em dano/s | `BuildSystem.offerGain` → `js/systems/dps.js` |
| antes → depois | `tier.mods` aplicado a `inst.r.stats` (`UI.tierDelta`) |
| frase em Eczar | `LINE_ABOUT[pathId]` no tier numérico, `tier.desc` no estrutural |
| onde chega | `tierIndex` contra `PATH_RULES.tiers` |
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
- **O slot em Eczar nunca repete o número, e por isso ele não é o `desc` da
  peça.** 528 dos 660 tiers são gerados e o texto deles é puro número ("+40% de
  dano.") — o mesmo dado que a régua imprime em mono 38 e que os valores crus
  imprimem em "antes → depois". Trocar por `def.desc` conserta a repetição e
  cria outra: **duas das três cartas costumam ser da mesma spell em linhas
  diferentes**, e o `desc` sairia idêntico nas duas. Quem ocupa o slot é
  `LINE_ABOUT` (`js/content/paths.js`), a frase da **linha** — o que precisa
  diferir entre as duas cartas é exatamente o que a linha muda; nome, ícone e
  tira já dizem qual spell é. Tier estrutural fica com o próprio texto: ali ele
  **é** o comportamento novo. `driver_cards` cobra a regra.

### A régua: `js/systems/dps.js`

O ganho é a única coisa da carta que **não** sai do catálogo — ele é simulado.
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
3. **Ele promete ORDEM, não valor.** A barra é comparativa, então errar a
   escala não mente para ninguém; inverter duas ofertas mente.

**Quem cobra a terceira é o próprio `driver_bench`**, no bloco `REGUA x CAMPO`:
ele já mede toda peça com o motor rodando, então a comparação mora ao lado da
medida em vez de virar um segundo banco. Hoje o **rho de Spearman entre as duas
ordens é 0.75**, com piso de 0.6 — frouxo de propósito, porque o modelo assume
**um** campo e o banco mede seis, dois deles de alvo único. E ele reprova mudez
nos dois sentidos: régua zero com campo medindo dano (a carta diria "não muda o
dano" sobre uma peça que muda) e régua com dano onde o campo mede zero (a carta
prometeria um número que não existe). A isenção é a mesma que o banco já
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

