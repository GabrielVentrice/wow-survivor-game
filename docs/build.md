# A build: as três linhas, os eixos e os marcos

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `js/content/paths.js`, `js/systems/build.js` ou nas regras de eixo de `js/balance.js`.

## As três linhas: Aceleração, Maestria e Crítico

Toda peça sobe pelos **mesmos três caminhos**, e a pergunta de cada um é sempre
a mesma: com que **frequência** a peça acontece, **quanto** ela pesa quando
acontece, e com que sorte ela pesa o dobro.

Antes cada peça inventava os próprios três caminhos — "Chama", "Barragem",
"Enraizado" —, e a tela de level up cobrava do jogador ler quinze nomes novos
por peça para saber o que estava comprando. Com 44 peças isso são 132 caminhos
e 660 tiers de vocabulário. A grade única troca isso por uma leitura só: o
jogador aprende as três linhas uma vez e passa a decidir por **peça**, não por
nome de trilha.

**Os quatro primeiros degraus de cada linha são GERADOS** (`js/content/paths.js`),
e o quinto é escrito à mão. Essa divisão é o acordo inteiro:

| | tiers 1–4 | tier 5 |
|---|---|---|
| o que são | números, na categoria da linha | a **assinatura** da peça |
| de onde vêm | `HASTE`/`MASTERY`/`CRIT` | escrito por peça |
| o que a peça declara | qual stat é recarga, quantidade e dano | o tier inteiro |

Sem o tier 5 a grade viraria planilha e as **7 evoluções** não teriam onde
morar — e evolução, aura e metamorfose são o clímax da run. Cada evolução hoje
está ancorada na linha que combina com ela (`evolvesInto` no spec daquela
linha), e `driver.js` continua cobrando que a forma evoluída tenha os mesmos
três caminhos da base — o que com ids fixos passou a ser de graça.

**Uma tabela só balanceia o catálogo inteiro** (`LINE_STEPS` e `CRIT_STEPS`).
Fechadas, as três linhas chegam perto uma da outra de propósito:

| linha | o que ela compra fechada |
|---|---|
| Aceleração | `1/0.4875 = 2.05x` de cadência, e a quantidade quadruplicando |
| Maestria | `1.5 × 1.4 × 1.45 × 1.5 = 4.57x` no número principal |
| Crítico | 80% de chance a 4.5x → `3.80x` de dano médio |

### E elas são FRONT-LOADED, porque o marco é pago em abates

O degrau mais caro de cada linha é o **primeiro**. Não é gosto: a primeira
versão da grade abria em `+30%` de dano, `-20%` de recarga e `+15%` de crítico
— totais na mesma faixa dos caminhos antigos — e a medição a reprovou de forma
brutal (`driver_balance`, 4 runs × 5 políticas, mesmas seeds):

| | caminhos antigos | grade v1 (degraus parelhos) |
|---|---|---|
| sobrevivência mediana (`focado`) | 9:59 | **2:05** |
| mortes antes dos 3 min | 4/20 | **12/20** |
| pool de eixo ao fim (mediana) | 20/20 | **2/20** |
| runs com evolução | 9/20 | **0/20** |
| runs com capstone | 10/20 | **2/20** |

O total quase não tinha mudado; o que mudou foi **quando** ele chega. Os
caminhos antigos abriam em "+50% de dano" ou "dobra o dano", e era isso que
segurava a realimentação: o marco é cobrado em **abates**, então menos dano
cedo vira menos marco, que vira tier travado pelo gate de eixo, que vira menos
dano ainda. É a mesma realimentação que a curva de XP já documenta acima, e ela
é implacável — só **9 de 20 runs** chegaram aos 400 abates, contra 20 de 20 na
base.

Regra que fica: **degrau novo se mede pelo primeiro, não pelo total.** Uma linha
cujo primeiro degrau vale menos que `1.3x` não é uma linha mais lenta, é uma
linha que a run não consegue pagar.

Três regras que caíram daí, e as três custaram uma medição:

- **`qty` é opcional, e sem ele a linha não fica com buraco.** Peça que não tem
  o que multiplicar (uma aura pulsa e pronto) recebe quatro degraus de recarga
  em vez de dois degraus e dois lugares vazios.
- **Três stats do catálogo são FATORES e não grandezas**, e multiplicar quebra
  os três: `speedMul` (1.35 = anda 35% mais rápido) viraria um personagem a
  cinco vezes a velocidade base, e o `factor` das duas maldições (0.65 = o alvo
  anda a 65%) **subiria** — que é o contrário do que a peça faz. Daí o modo
  `add` da `MASTERY`.
- **A linha que carrega a evolução decide o que a forma evoluída herda.** Chaos
  Bolt vinha do caminho "Enraizado" e por isso chegava com três degraus de
  redução de carga embutidos: ele nunca foi jogado com `chargeTime` de 1.0s.
  Pela Maestria ele chega com a carga crua, e `driver_evo` pegou isso na hora —
  zero de dano em 6s. O conserto é o número base valer sozinho, não a linha
  compensar depois.

**E o banco de provas cobra o resto** (`DRIVER=driver_bench.js ... 12 full` — o
modo padrão fecha só o primeiro caminho, que hoje é sempre a Aceleração). Ele
achou os dois defeitos que a grade trouxe, e os dois são a mesma armadilha —
**degrau que parece upgrade na tabela e não é upgrade em campo**:

- **Demonic Circle piorava** ao descer o limiar de 7 para 3 inimigos: saltar
  mais cedo tira o warlock de perto antes de a horda fechar, então cada saída
  pega menos corpos. O raio maior é o que paga a pressa.
- **A linha de Crítico do Shadowburn fechava sem nunca disparar**: 100% de
  crítico sobre um golpe que não acontece continua sendo zero. A peça só executa
  abaixo de um limiar, e o limiar tinha que subir junto.

Vale como regra para tier 5 novo: **crítico garantido não é payoff sozinho.** Se
a peça tem condição de disparo (limiar de vida, alvo com DoT, cerco), o tier que
crava `crit: { set: 1 }` precisa afrouxar a condição no mesmo degrau — senão a
linha inteira é comprada por nada.

### O crítico é um stat da peça, e quem sorteia é o funil

`crit` (chance) e `critMul` (multiplicador) entram em toda peça por
`...CRIT_BASE` — 5% e 2x. A base existe para o crítico ser um **fato do jogo
antes de ser uma compra**: sem ela a mecânica só apareceria depois que alguém
investisse, e ninguém investe no que nunca viu.

- **O sorteio mora em `Game.damageEnemy`**, e não dentro de cada efeito. São
  cinco caminhos de dano — instantâneo, projétil, DoT, área e demônio — e uma
  regra só; uma cópia por efeito seria a mesma lista escrita cinco vezes, e a
  que envelhecesse deixaria uma peça sem a linha de Crítico **em silêncio**.
  `BuildSystem.rebuildCrit` escreve `game.critBy` (key → `{chance, mul}`) a
  cada aquisição, dos stats **já resolvidos** — então passiva e capstone que
  mexam em crítico entram de graça, e peça sem a linha comprada nem aparece no
  mapa, que é a consulta mais barata possível no código quente.
- **Dez peças não causam dano nenhum**, e nelas o crítico **dobra o número
  principal**: a cura, o escudo, a duração do controle. Quem faz isso é
  `critRoll` (`js/systems/effects.js`), consumido por `heal`, `shield`, `stun`,
  `fear`, `slow`, `weaken`, `mark`, `knockback`, `pull` e `convert` — e também
  pelos hooks `healthstone` e `grimoire`, que curam e escudam fora do funil.
- **O crítico se lê no corpo e fala, mas só no dano DISCRETO.** O flash branco
  do inimigo dobra de fôlego (0.1s → 0.2s) e a voz é a `crit` que o golpe
  grande já usava. Tique de DoT e de área **não falam**: eles cobram por
  sub-step enquanto durarem, e um estalo por cobrança viraria metralhadora
  justo quando a horda fecha. É a mesma regra que os mantém fora do hitstop, e
  é ela que exige o sexto parâmetro `cont` do funil — sem ele não há como
  separar o tique de uma área do impacto de um projétil.
- **Crítico não é `big`.** Fosse, cada crítico emitiria `BIG_HIT` e dispararia
  os reativos que escutam esse evento — o crítico deixaria de ser dano e
  passaria a ser gatilho.

### Toda peça precisa de número DESDE A COMPRA

Esta é a regra mais cara que a grade trouxe, e ela quase passou despercebida
porque não aparece em nenhum driver de peça: **onze peças do catálogo não
causavam dano nenhum**, e no catálogo antigo elas ganhavam dano no **tier 1 ou
2** de um caminho temático — "Corrosão: a aura também causa dano" (Curse of
Exhaustion), "Estilhaço" (Howl of Terror, Mortal Coil), "Espinhos" (Demon Skin,
Soul Leech), "Casca" (Healthstone), "Sentinela" (Soulstone). Eram tiers baratos,
dentro do `freeTier`, e eram eles que transformavam uma carta de controle numa
peça que contribui.

Na grade, esse salto estrutural passou a morar no **tier 5** — que pede 10
pontos no eixo da peça. Uma run que sorteia controle ou defesa ficava com nada
que a Maestria pudesse multiplicar e nada que o Crítico pudesse dobrar, pelo
resto da run.

Medido com o jogador **imortal** (tira a morte da conta e mede só o crescimento
da build), política aleatória, 8 seeds, mediana de abates:

| | caminhos antigos | grade sem número base | com número base |
|---|---|---|---|
| 60s | 376 | 160 | 268 |
| 120s | 1056 | **399** | 1009 |
| 180s | 2055 | **630** | 2018 |
| 240s | 3174 | 2881 | 3099 |
| tiers comprados aos 240s | 29 | **18** | 30 |

A coluna do meio é a mesma realimentação de sempre, e a última linha é a prova
dela: menos dano → menos abates → menos XP e menos marco → **menos tiers
comprados** → menos dano. Onze peças mudas bastaram para derrubar o jogo pela
metade, sem que uma única peça de dano tivesse ficado mais fraca — o
`driver_bench` mostrava Incinerate fechado **5,6x mais forte** que o caminho
antigo equivalente no mesmo momento.

O conserto foi dar a cada uma **o número que ela já ganhava no tier 1**, agora
na base: dano de aura nas duas maldições, estouro no grito e no revide,
espinhos no couro e na casca, servos na alma guardada, dano devolvido na
barreira, esteira no Burning Rush e estouro de saída no Demonic Circle.

**Regra que fica: peça nova tem que fazer, no instante em que é comprada, a
coisa que as três linhas multiplicam.** Se o que ela faz só existe depois de um
tier, ela é uma carta morta na tela — e carta morta numa tela de três ofertas é
um terço da tela.

### E o sustain tem que CRESCER, porque as três linhas são todas ofensivas

Este é o segundo buraco, e ele é mais sutil que o primeiro: com a build inteira
em paridade de dano, o piloto continuava morrendo aos 3 min sob as políticas que
MIRAM um eixo. A curva de vida diz o que acontece — a base mergulha a 90% e
**volta a 100%**, e a grade mergulha e morre.

O motivo é estrutural: no catálogo antigo os três caminhos de uma peça eram
três **espécies** diferentes de upgrade, e uma boa parte dos terceiros caminhos
era sustain — "Alma" no Shadowburn (cura por execução), "Sacrifício" no Felguard
(escudo por golpe), "Sustento" no Malefic Rapture, "Aura" no Drain Life (a
fração curada indo de 25% a 80%). Comprar profundidade trazia sustain junto,
sem o jogador pedir.

Nas três linhas **tudo é ofensivo**, então uma build que aprofunda termina o
começo da run com dano de sobra e zero cura. Medido no probe de política, 6
seeds: as runs que morrem antes dos 3 min curaram/escudaram **0 de vida**; as
que chegam aos 6 min curaram 2200–2600.

O conserto foi devolver o sustain à base das quatro peças que o perdiam, com a
Maestria multiplicando ele junto com o dano (`MASTERY({ dmg: [...], also })`):
cura por execução no Shadowburn, escudo por golpe no Felguard, cura por pulso no
Malefic Rapture e a fração curada crescendo no Drain Life. Num probe de 6 seeds
sob a política `focado` isso levou a mediana de 3:28 para 6:00 — mas **6 seeds
não bastam para esta pergunta**, e a bateria de 30 runs não confirmou o ganho
(ver "Onde isto está"). O sustain era um buraco real; ele não era o único.

**Regra que fica: linha nova não pode ser só dano.** Se as três linhas forem
todas ofensivas, o sustain precisa estar na BASE das peças que o têm e crescer
com elas — senão a build fica com dano de sobra e morre com a barra cheia de
poder e vazia de vida.

### E o terceiro buraco: `pierce` tinha sumido do catálogo

O caminho "Barragem" do Incinerate dava **perfuração 1 e depois 4**, e a linha
de Aceleração só herdou `count`. Numa horda densa isso não é um detalhe: um tiro
que atravessa 4 mata 5, então trocar perfuração por cadência é dividir a vazão
da peça inicial — a que está em 100% das runs — por um número grande.

Foi o que explicou uma leitura que não fechava: uma build com Incinerate a
**16x de dps** por tier comprado matava só o dobro de uma sem tier nenhum. Dps
não era o limite; **alcance de alvo** era.

**Regra que fica: quando `qty` escolhe um stat, verifique se a peça tem DOIS.**
`count` (quantos tiros saem) e `pierce` (quantos corpos cada tiro toca) são
vazões diferentes, e a segunda é a que a densidade da horda multiplica. Por isso
`HASTE` aceita `qty.also`.

**Os nomes das linhas são uma linha de dado** (`LINE_NAMES`, em
`js/content/paths.js`), e os dos degraus outra (`LINE_TIERS`). Eles aparecem no
subtítulo da carta e na tira da build; trocar "Aceleração" por "Haste" é essa
linha e mais nada.

O que sobra de custo é honesto e continua de pé: tiers estruturais de peças que
**já** causam dano ("os tiros explodem em área", "as mordidas sangram") hoje só
existem no tier 5. Isso já foi cobrado **duas** vezes — o tier 5 era caro *e* o
gate de eixo pedia 10 pontos para chegar nele. O gate saiu; o que atrasa o teto
agora é só a profundidade em si.

### Onde isto está, medido

`driver_balance`, 30 runs (6 por política, teto de 12 min), mesmos argumentos
nos dois lados. É o estado da grade **depois** dos quatro consertos acima:

| | caminhos antigos | as três linhas |
|---|---|---|
| `aleatorio` | 6:03 | **7:45** |
| `agressivo` | 8:29 | 6:34 |
| `focado` | 9:59 | **2:46** |
| `misto` | 11:59 | **2:46** |
| `amplo` | 6:54 | **2:39** |
| mortes antes dos 3 min | 8/30 | 14/30 |
| pool de eixo ao fim (mediana) | 20/20 | 6/20 |
| runs com evolução | 13/30 | 1/30 |
| runs com capstone | 14/30 | 4/30 |

Ler isto com honestidade: **a grade está entregue e o motor está verde** (a
bateria inteira passa), mas o clímax da run — evolução, capstone, metamorfose
— quase não acontece mais. O perfil que joga ao acaso melhorou; os que **miram** um eixo
e o que **alarga** a build pioraram muito, e são justamente eles que o
`driver_balance` existe para proteger (ver "Medir por média das políticas engana
aqui", no balanceamento).

O mecanismo que sobra é o que a fase anterior deixou de pé e não foi medido até
o fim: no catálogo antigo, os tiers 1 e 2 de um caminho temático eram
**estruturais** em quase toda peça — "os tiros explodem em área", "as mordidas
sangram", "o portal também dispara projéteis". Uma build larga e rasa colhia
dezenas desses. Nas três linhas, tiers 1–4 são numéricos e todo salto estrutural
mora no tier 5, atrás de 10 pontos de eixo — então largura deixou de comprar
capacidade e passou a comprar só multiplicadores pequenos espalhados.

As alavancas, em ordem de quanto mexem e de quanto custam:

1. **`PATH_RULES.freeTier`** — a zona franca, e o que sobrou desta alavanca
   depois que o gate de eixo saiu. O gate já foi testado em duas escadas
   (`[0,0,0,1,5]` e `[0,1,1,5,10]`) e **nenhuma** foi suficiente sozinha; a
   terceira tentativa foi remover a régua inteira.
2. **Um segundo salto estrutural no tier 3** de cada linha, além do tier 5. É a
   mudança que ataca o mecanismo de frente, e é a mais cara de escrever: são
   132 tiers novos à mão.
3. **`LINE_STEPS`** — subir os degraus numéricos de novo. É a mais barata e a
   que já mostrou ter teto: ela move o dano e não move a sobrevivência.

O que **não** é a alavanca, medido: dano de saída. Com o jogador imortal a build
cresce igual à antiga (tabela acima), e a bateria do banco mostra caminho
fechado rendendo mais que o equivalente antigo em quase toda peça.

## Regras estruturais que forçam comprometimento

- Pool de **21** pontos de eixo (1 da abertura + 20 das etapas), teto de **15**
  por eixo → impossível maximizar dois.
- **O pacto: a run cabe em DOIS eixos** (`AXIS_RULES.maxAxes`). Assim que dois
  eixos têm pelo menos um ponto, o terceiro se fecha — ver "O pacto".
- **Ponto de eixo vem de etapa — e da abertura, uma vez.** Level-up não cobra
  nada e o baú entrega tier: as duas moedas nunca mais disputam a mesma escolha
  (ver "As duas batidas"). A abertura é a exceção declarada, e ela é única
  porque acontece antes do primeiro quadro (ver "A abertura").
- **A run cabe em CINCO spells** (`BALANCE.loadout.maxSpells`) → batido o teto, a
  etapa para de oferecer spell e vira uma pergunta só sobre eixo. Ver "O loadout
  e a linha única".
- **Uma linha por vez** (`PATH_RULES.maxDeep` 1), **duas na vida da peça**
  (`maxLines` 2) → a peça casa com uma linha e só reabre quando fecha o tier 5.
- **O gate de eixo SAIU.** `PATH_RULES.axisGate` cobrava pontos no eixo da peça
  para liberar os tiers de cima, e a ideia era que as duas telas conversassem.
  Na prática ele cobrava a mesma escolha duas vezes — o jogador já pagara
  comprometimento na etapa — e punia mais quem tinha se comprometido menos: a
  build que espalhou eixo terminava a run com toda trilha parada, sem que
  nenhuma tela dissesse que aquele era o preço. Quem segura profundidade agora
  são `maxDeep`/`maxLines` e o teto de spells, e nenhum dos dois depende de um
  recurso que a outra tela distribui. `driver_cards` cobra a **ausência**: um
  gate reintroduzido por acidente faria as trilhas pararem em silêncio.
- **Passiva é do EIXO DA ABERTURA** (`PASSIVES.<id>.axis`) → a família escolhida
  decide também como a run multiplica o que tem. Ver "As passivas por eixo".
- Passivas podem declarar `exclusive` → `Fúria Contida` e `Pés de Cinza` nunca coexistem.
- Peça com `requires` só é oferecida depois que a habilitadora está na build.
- **A run começa numa ESCOLHA, não num presente** (`CLASSES.<id>.starters`) —
  três spells, uma por eixo, e o jogador leva uma. Ela entra **de graça**
  (`acquirePiece(id, true)`), para o pool de 20 ficar inteiro para as escolhas
  do jogador — e a spell que vem numa etapa também, porque o eixo dela já foi
  pago pelo ponto que a carta deixou de dar. Ver "A abertura".
- **Baú é a única fonte de tiers grátis**, e por isso é dado: `BALANCE.spawn`
  diz com que frequência ele nasce (avulso pelo spawner a partir dos 45s, e de
  todo Dreadlord morto) e `BALANCE.chest.rarity` diz quantos tiers ele entrega —
  1, 3 ou 5, com `lateWeight` trocando os pesos depois de `hardAt`, quando um
  tier avulso não muda mais o jogo. Mexer nesses números é mexer na velocidade
  em que a build fecha; `driver_chest` mede as duas pontas.
  **A largura da tela acompanha o prêmio** (480 / 560 / 640): a 640 fixos, um
  baú comum entrega uma linha só e o `CONTINUAR` — 64px de altura, largura
  inteira — vira o elemento mais pesado de uma tela que quase não tem conteúdo,
  e o botão passa a ser o assunto.

## O pacto: duas famílias, e a terceira se fecha

`AXIS_RULES.maxAxes` é 2. Assim que **dois** eixos têm pelo menos um ponto, o
terceiro para de receber pelo resto da run: some das cartas de etapa, some da
mira do capstone e some do baú e de qualquer fonte futura de eixo.

**O que ele conserta é uma build legal que não chega a lugar nenhum.** Pool 20 e
teto 15 já tornavam impossível maximizar dois eixos, e não diziam nada sobre o
terceiro — 7/7/6 passava. E 7/7/6 é a única maneira de gastar a run inteira e
terminar sem clímax nenhum, porque **nenhum dos oito capstones pede três eixos**:
são três puros (15) e cinco híbridos (10+5). Espalhar pelos três é comprar
distância de todos eles ao mesmo tempo.

Medido, `driver_milestone` com o perfil que mira, as mesmas 20 seeds, e a única
diferença entre as colunas é `maxAxes`:

| | sem o pacto (`maxAxes: 3`) | com o pacto |
|---|---|---|
| runs que fecham capstone | 18/20 | **20/20** |
| etapa em que o eixo abre | 7 | **6** |
| pool ao fim | 20/20 | 20/20 |
| etapas até fechar a pool | 15 | 15 |
| abates até fechar a pool | 10.120 | 10.120 |

A cadência não muda — nada aqui mexe em quanto custa um marco. O que muda é
**onde os pontos caem**: sem o pacto, o sorteio da fase fechada empurra ponto
para o terceiro eixo, e o eixo alvo abre uma etapa inteira mais tarde. E esse é
o perfil que **mira**; o que se espalha por gosto não tinha nem esse piso.

Cinco regras, e cada uma custou uma decisão:

- **Quem cobra é `addAxis`, e por isso quem quiser creditar eixo no futuro já
  respeita o pacto.** É a mesma razão pela qual o Ápice mora lá: quem sabe que
  um eixo abriu é quem soma o ponto. Cobrar na tela de etapa deixaria baú e
  capstone como brecha — e o baú é justamente a fonte que não passa por
  `getMilestoneOffers`.
- **O predicado é sobre o eixo em ZERO, nunca sobre um que já andou.** Eixo
  aberto continua aberto até o fim; senão a segunda perna de um capstone
  híbrido poderia ser selada *depois de paga*, e a run perderia um final que
  já tinha comprado.
- **Selado ≠ vazio, e a UI tem que dizer isso.** Eixo em que não investi ainda
  é uma escolha; eixo selado saiu da run. O `0 / 15` de um eixo selado é uma
  promessa de que ele ainda anda — no HUD e no rodapé da etapa ele vira tarja
  mais a palavra `selado`, e o número sai. `driver_milestone` cobra as duas
  pontas: que a marca apareça e que o número não.
- **O capstone que pede um eixo selado sai da mira** (`UI.nearestCapstone`), e
  ele sai contando o pacto **depois** da prévia: a carta sob o mouse pode ser
  justamente a que abre o segundo eixo, e nesse instante o terceiro fecha.
  Apontar para um capstone daquele terceiro seria a tela prometer um destino
  que o próprio clique acabou de emparedar.
- **O fechamento é a segunda coisa irreversível da tela de etapa, e a única que
  nenhuma linha dela anuncia** — o terceiro eixo simplesmente para de aparecer.
  `applyMilestone` devolve `sealed` (o diff dos selados antes e depois) e a UI
  solta um toast. Sem ele a mecânica acontece em silêncio, que é exatamente o
  defeito que a metamorfose já teve uma vez.

O que **não** muda: o pacto não mexe em `capPerAxis` nem na pool, então toda
build que já era possível com dois eixos continua idêntica. Ele só apaga as de
três.

## O Ápice: encher um eixo varre a tela

Chegar aos 15 pontos de um eixo é a coisa mais irreversível que uma run pode
fazer — com pool de 20 e teto de 15, só **um** eixo cabe lá, e chegar exige ter
recusado os outros dois marco após marco. O jogo cobrava esse comprometimento e
não devolvia nada em tela: o número virava 15 no rodapé da etapa e a run seguia
igual. O Ápice é o pagamento — uma onda serrilhada sai do corpo do warlock e
varre o que está em tela, e o que ela alcança morre.

O tuning inteiro é `BALANCE.apex` (três números: `sweep`, `bossFrac`, `shake`),
e as regras que caem daí:

- **Quem arma é a TRAVESSIA do teto, não estar nele.** O gatilho mora em
  `BuildSystem.addAxis`, e não na tela de etapa: baú, capstone ou peça que
  credite eixo no futuro ganham o mesmo evento sem uma linha nova. O `Set`
  `apexed` existe porque `addAxis(x, 0)` no eixo cheio passa por ali em toda
  etapa seguinte — sem ele a onda sairia a cada marco.
- **Ela nasce em FILA (`Game.queueApex`) e sai no primeiro quadro de jogo.** O
  `addAxis` que a descobre roda com a tela de etapa aberta, e essa é a única
  tela que **apaga o canvas**: a onda sairia por cima de preto chapado, matando
  uma horda que o jogador não está vendo.
- **O raio é o canto VISÍVEL mais distante, medido do jogador** — não um número
  de tabela. Raio fixo mente em metade das resoluções: em tela larga sobra
  horda viva na borda, que é exatamente o que o evento existe para não deixar
  acontecer. E a câmera persegue com lerp, então o jogador quase nunca está no
  centro dela; meia diagonal deixaria viva a faixa para onde a câmera ainda
  está andando.
- **Uma curva, dois consumidores.** `apexFront` mora em `js/util.js` e não junto
  do desenho, onde toda outra curva de evento mora, porque `Game.tickApex` mata
  com ela e `VfxLayer.draw` desenha com ela. Pelo mesmo motivo `VFX_LIFE.apex`
  **referencia** `BALANCE.apex.sweep` em vez de repetir o número: é o caso do
  telegrafo, só que aqui dá para referenciar em vez de cobrar por driver, e
  referenciar é melhor. O anel é a única coisa em tela desenhada no raio em que
  ela realmente mata.
- **A frente é uma FRONTEIRA, não um anel.** Cobrar só a faixa entre a frente de
  antes e a de agora é a versão óbvia, e está errada porque o alvo **se mexe**:
  a horda anda para dentro, então um corpo que a onda ultrapassou a 660 unidades
  caminha para 620 no tique seguinte, cai atrás da frente sem nunca ter estado
  na faixa, e sobrevive ao evento que existe para limpar a tela. Medido: doze de
  doze vivos na borda. Para o corpo comum a repetição não custa nada — ele já
  morreu; quem precisa de guarda é o chefe, e a guarda é um `Set` de mordidos.
- **Ela VARRE em vez de matar de uma vez**, e os dois motivos são o mesmo:
  duzentos corpos caindo no mesmo frame são um pico de frame no instante em que
  o jogo mais precisa não engasgar, **e** leem como uma tela que apagou em vez
  de uma onda que passou. Varrendo, a ceifa acende os três degraus em sequência
  e o massacre se conta sozinho.
- **A onda segura as duas telas de escolha** (`if (this.apex) return` no fim do
  `update`). O XP de duzentos corpos abre level up quase sempre no meio da
  varredura, e uma carta subindo por cima cortaria justamente o pagamento da
  escolha que não volta. Não é só apresentação: a tela para `update` e **não**
  para `VfxLayer`, então a frente da simulação congelaria enquanto o anel
  continuaria correndo — e as duas coisas que `apexFront` existe para manter
  iguais divergiriam.
- **O chefe NÃO morre** (`bossFrac`). A ameaça deste jogo mora nele (ver
  `bossHpExp`), e um botão que apaga o único perigo real tiraria o perigo da run
  inteira. Subir para 1 mata o chefe junto: é um número, não um `if`.
- **Serrilhada, e é só isso que a separa da ceifa.** As duas são anéis achatados
  em volta do jogador, na cor da build, e a ceifa acontece dezenas de vezes por
  run. Serra lê como coisa cortando; anel liso, por mais grosso, leria como a
  onda de choque de uma explosão. Ela gira porque polígono parado neste raio
  volta a ser círculo, e a alpha cai quase parelho — é a mesma exceção da onda
  de choque: quando o anel diz **até onde** o dano chegou, ele precisa continuar
  legível enquanto chega lá.
- **O teto do pool de vfx não pode descartá-la** (`VFX_ALWAYS`). Caindo no
  `return` do teto, a horda sumiria sem nada desenhado — e horda que some sem
  nada lê como bug de pool.

`driver_apex` guarda as seis primeiras.

