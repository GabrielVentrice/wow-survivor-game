# As classes: catálogo, formas e o kit do Hunter

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `js/content/classes.js`, `CLASSES`, ou nas peças de uma classe.

## A classe decide QUAL catálogo existe

`PIECES`, `PASSIVES`, `CAPSTONES` e `MINIONS` continuam sendo **um namespace
só** — e cada entrada declara de quem é, num campo `cls`. A oferta filtra
(`BuildSystem.owns`); o resto do motor nunca precisa saber que classes existem.

A alternativa — um registry por classe (`PIECES.warlock.*`) — obrigaria a
reescrever `resolvePiece`, `evolve`, `js/hooks.js`, o `PIECES[path.evolvesInto]`
de `upgradePath` e o validador inteiro. Isso é refatoração de motor para
resolver um problema de pertencimento, que é uma linha de dado.

Três campos em `CLASSES` carregam a abstração inteira:

| campo | o que faz |
|---|---|
| `axes` | os três eixos da classe, **na ordem em que o HUD os desenha** |
| `systems` | subsistemas exclusivos (`[]` no warlock, `["aspect"]` no hunter) |
| `glyph` | a grade da placa do menu |

**`AXES` deixou de ser "os três eixos" e virou a UNIÃO de todas as classes.**
Quem itera itera `build.axes`, não `AXES` — eram 11 sítios, sete em `js/ui.js` e
quatro em `js/systems/build.js`, e não pode voltar a ter um décimo segundo.

Quatro coisas que caem daí, e as duas primeiras são bugs que a mudança preveniu:

- **`checkCapstones` sem filtro abre capstone de outra classe, em silêncio.**
  Ele lê `req` contra o contador de eixo, e numa run de warlock
  `this.axis.trapping` é `undefined` — `undefined < 15` é **false**, então o
  requisito passa. Não dá erro, não dá toast estranho: dá capstones errados.
- **`this.axis` não pode ser literal.** Ele nasce de `cls.axes` no `reset`, e
  `axisTotal` soma a lista em vez de somar três nomes.
- **A regra de matiz do driver virou POR CLASSE, e por geometria.** Com
  corruption em 98°, dominion em 266° e cataclysm em 24°, sobra **um** único
  ponto no círculo a 60° dos três: seis famílias globais não cabem, não são
  difíceis. O que precisa ficar longe é o que divide tela, e uma run é uma
  classe. Um eixo pertence a uma classe só — duas dividindo eixo fariam o
  catálogo vazar sem que `cls` percebesse.
- **`driver_form` cobra cobertura de capstone por classe, e só de quem declara
  mais de uma forma.** Forma única é uma posição coerente ("o meu corpo não
  conta a progressão"); o que não pode existir é cobertura pela metade — três
  formas para oito finais é o corpo dizendo que a run chegou longe sem dizer
  para onde, que é o defeito que tirou a metamorfose do acúmulo de pontos.

As cores do Hunter saem das três especializações do WoW, uma cada: **Matilha**
`#e0b833` (ouro fulvo de pelo e presa, Beast Mastery), **Precisão** `#3878e0`
(azul-aço de ponta de flecha, Marksmanship), **Armadilha** `#2fd47e` (jade de
veneno e alcatrão, Survival). Separação entre elas: 103° / 68° / 171°. Vermelho
ficou de fora dos dois conjuntos — é reserva da barra de vida, do relógio da
fase dura e do eyebrow do game over.

## O Hunter: uma forma só, e isso é uma posição

O warlock tem dez formas porque o corpo dele **conta a progressão** — uma por
capstone, mais o Iniciado. O hunter tem **uma**, e a diferença não é dívida de
arte: são duas respostas diferentes para "o que o corpo diz sobre a run".

`driver_form` cobra cobertura de capstone **só de quem declara mais de uma
forma**. Forma única é coerente ("o meu corpo não conta a progressão"); o que
ele continua proibindo é a cobertura pela metade — três formas para oito finais
é o corpo dizendo que a run chegou longe sem dizer para onde, que é o defeito
que tirou a metamorfose do acúmulo de pontos. E ele também reprova forma única
que aponte para um capstone: ou cobre todos, ou nenhum.

Quatro coisas do hunter que valem para classe nova:

- **A abertura da classe é uma por eixo, e a mais neutra vem primeiro.** Desde
  que o kit inicial virou a pergunta da abertura (ver "A abertura"), o que a
  classe declara em `starters` são três spells — uma de cada eixo — e o jogador
  escolhe. No hunter são `killCommand` (Matilha), `arcaneShot` (Precisão) e
  `serpentSting` (Armadilha). A regra que sobrevive é a de cobertura: uma por
  eixo, senão a abertura decide o eixo antes de o jogador escolher.
- **`DEFAULT_FORMS` desenha o WARLOCK.** Classe nova sem `forms` aparece em
  campo com o corpo de outra, em silêncio. Ele existe só para quem monta um
  `Player` fora de uma run (as galerias); toda classe jogável declara `forms`.
- **Bicho novo pede grade nova.** `driver_render` reprova tipo de demônio sem
  sprite próprio, então a matilha custou seis grades: lobo, javali, urso,
  wyvern, tartaruga e espectro. O javali pega `fur0..2` e o urso `fur1..3` —
  mesma pelagem, três passos acima, que é a regra da fatia que já separa o
  ghoul do vilefiend.
- **A rampa `fur` nasceu com QUATRO passos de propósito.** Três passos servem um
  bicho; quatro servem dois, e é isso que impede a matilha de ler como um
  animal em dois tamanhos.

## O tiro do Hunter: reto, antecipado e com quique

Um projétil que **curva no ar é uma spell**. Foi assim que o hunter nasceu — as
nove peças de tiro declaravam `homing: true` com `turnRate` de 4 a 6 —, e o
resultado era um míssil mágico com nome de flecha: ele dava a volta, alcançava
qualquer corpo e nunca errava porque perseguia.

`shot: true` no efeito `projectile` é a bandeira que separa as duas coisas, e
ela liga **três** comportamentos porque as três são a mesma decisão:

| o que liga | por quê |
|---|---|
| a mira **antecipa** (`aimAt`) | reto e certeiro, sem curvar |
| cada tiro da rajada pega **um corpo** | salva de flechas, não cone de spell |
| desenha como **risca** (`look: "tracer"`) | não é orbe com cauda |

**A antecipação é interceptação, não chute.** Resolve o instante em que tiro e
alvo ocupam o mesmo ponto — `(v·v − sp²)t² + 2(d·v)t + d·d = 0` — e aponta para
lá. A velocidade do alvo é DERIVADA (`Enemy.velocityAt`) e não um par `vx/vy`
cacheado: a regra de movimento cabe em quatro linhas, e um par cacheado é a
segunda lista para divergir da primeira.

**Nesta horda a correção costuma ser zero, e isso é geometria e não sorte:**
todo corpo anda em direção ao jogador e o tiro sai DO jogador, então o encontro
é quase de frente. Medido numa run de warlock, o desvio mediano é **0,0 grau** e
a taxa de acerto é **100%** com ou sem antecipação. Quem ela salva é o caso que
a reta perdia — alvo cruzando de lado, corpo empurrado, e a **perna de um
quique**, que nasce num corpo e não no jogador.

**Ela é OPT-IN por causa disso, e o motivo é medido.** Ligada para todo mundo,
ela não tirava dano do warlock (5 seeds, medianas a 3% uma da outra) e mesmo
assim mandava a run de semente fixa do smoke para outro lugar: 22,5 mil abates
viravam 4,9 mil e o `driver_chest` ia de 230s para 365s. Não era regressão — era
**outra run**, porque a antecipação muda os últimos bits do float e doze minutos
de simulação são caóticos. Perturbar de graça a classe que ninguém pediu para
mexer custa toda leitura de semente fixa do repositório.

### O quique: o tiro morre no corpo e sai outro dali

O que cobrava vários corpos antes era `pierce` alto — e um `pierce` de 12 só
alcançava doze corpos porque a curva ia atrás deles. Reta, a perfuração cobra
quem está **na linha**, que é o certo e é pouco: medido, a linha de Aceleração
fechada do Arcane Shot caiu de 44,7k para 23,1k só por isso.

O ricochete (`bounce`, `bounceRange`, `bounceFalloff`) devolve o alcance com a
leitura certa: cada perna sai de um corpo e vai para outro, então o jogador
**consegue contar**. Quatro regras, e cada uma fecha um jeito de sair errado:

- **Nunca volta para quem já foi atingido.** O conjunto `hits` é herdado pela
  perna nova — inclusive pela ÚLTIMA, que já não quica (`inheritHits`). Sem
  isso o quique volta para trás exatamente onde ninguém mais está olhando; foi
  o que `driver_spread` pegou.
- **A perna nova nasce NO CORPO**, não na boca da arma. Saindo do jogador seria
  um segundo disparo, não um ricochete.
- **Sem alvo no alcance o quique acaba** — ele não vira tiro para o vazio.
- **O dano cai por perna**, senão um tiro em horda densa é dano ilimitado.

`driver_spread` guarda as três coisas do `shot` e as duas do quique.

## O Aspecto: canal vivo, porque stat é cozido na aquisição

O subsistema exclusivo do Hunter, declarado em `CLASSES.hunter.systems`. Uma
stance que liga e desliga **sozinha** conforme o estado do jogo — não há input,
e o aspecto é a leitura que o motor faz da posição em que o jogador se meteu.

**O pipeline de stats roda uma vez por AQUISIÇÃO, não por tique.** Um aspecto
que mexesse em `inst.r` teria que re-resolver a build inteira toda vez que
ligasse, e `resolveAll` clona a árvore de efeitos de toda peça — isso é trabalho
de aquisição. Então o aspecto **não mexe em stat**: ele escreve em canais vivos,
lidos no ponto de uso. O precedente já existia e é o mesmo argumento —
`TRIGGERS.cd()`, que aplica o `cooldownMul` do Nihilam num ponto só *"porque os
nomes de campo variam demais entre os triggers para virar mod numérico"*.

| canal | lido em | quem usa |
|---|---|---|
| `speedMul` | `applyPassives` | Guepardo |
| `dmgReduction` | `applyPassives` → `Player.takeDamage` | Tartaruga |
| `damageMul` | `damageEnemy` | Tartaruga |
| `tagKeys`/`tagMul` | `damageEnemy` | Falcão |
| `lifesteal` | `damageEnemy` | Víbora |
| `rangeMul` | `TRIGGERS.rng()`, 4 sítios | Águia |
| `beastMul` | `MinionSystem.update` e `_attack` | Selvagem |

Regras que caem daí, e cada uma conserta um defeito:

- **O bônus por tag é um `Set` de `key`, montado quando o aspecto vira.**
  `damageEnemy` roda milhares de vezes por segundo; perguntar
  `build.pieces.get(key).def.tags.indexOf(...)` ali dentro seria uma busca por
  acerto. O Set é montado uma vez por virada.
- **`AspectSystem.tick` roda ANTES de `build.tick`.** Os triggers leem
  `rangeMul` no mesmo frame, e um aspecto avaliado depois deles valeria sempre
  um frame atrasado.
- **A avaliação é gasta em `interval` (0,15s), não por sub-step.** A leitura
  `enemies` é consulta de grid e `update` roda de 2 a 4 vezes por frame — seriam
  12 consultas por aspecto por frame para responder uma pergunta que não muda
  nesse ritmo.
- **Passo e cadência do bicho viraram DERIVADOS.** Dois sistemas mexem neles —
  `HOOKS.farejarSangue` (frenesi timado, por bicho) e o aspecto Selvagem
  (estado, global). Enquanto os dois escreviam direto em `m.speed`, o último a
  rodar vencia e o outro sumia sem erro nenhum. Hoje `m.baseSpeed` fica intacto
  e os dois multiplicam.

### A condição se MEDE, e a contagem crua mede o relógio

A histerese abaixo impede o aspecto de piscar. Ela não diz nada sobre o aspecto
**acontecer** — e essa é a outra metade, que custou uma rodada inteira para
aparecer porque nenhum driver olhava para ela.

Os seis limiares nasceram de intuição sobre o jogo. Medidos numa run de verdade
(8 min, política de movimento do bot), quatro dos seis não eram condição
nenhuma:

| aspecto | condição original | quanto tempo ficava ligada |
|---|---|---|
| Guepardo | zero inimigos em 340 | **1,3%** |
| Falcão | parado há 2s | **0,0%** |
| Águia | 5+ inimigos em 360 | **98%** |
| Selvagem | 3+ bichos | 100% na build de Matilha, 0% em toda outra |

Duas nunca ligavam e duas nunca desligavam. Postura que nunca liga é carta
morta; postura que nunca desliga é buff fixo com nome de postura. E o defeito
não aparecia em `driver_aspect`, porque uma mesa monta a condição à mão — ela
prova que o mecanismo FUNCIONA, e não que o jogo o alcança.

**A causa é uma só: contagem crua de inimigos mede o relógio da run, não a
posição do jogador.** A densidade dentro de 360 unidades vai de 21 corpos no
minuto 3 a 160 no minuto 7 — oito vezes. Um limiar em número de corpos liga pelo
minuto em que a run está, que é o contrário do que um aspecto é.

O conserto é a leitura `press`: a **razão** entre o anel de dentro e o de fora.
Ela é estável na mesma run — 0,20 · 0,22 · 0,22 · 0,22 · 0,21 · 0,23 · 0,20 ·
0,17 por minuto, enquanto a contagem crua multiplicava por oito — porque mede o
que o jogador controla (estar no meio ou na beirada) e não o quanto o spawner já
cresceu. A linha de base é geométrica: com densidade uniforme a razão seria
`inner²/range²`.

Com os limiares tirados da distribuição medida, as três posturas posicionais
viraram posturas de verdade — Guepardo **30,5%**, Falcão **11,8%**, Águia
**31,9%**, com o vão e o `hold` segurando o pisca.

**E três dos seis são FASE, não postura, porque a variável é lenta.** Vida e
tamanho da matilha andam num sentido só dentro de uma run: Tartaruga (60%),
Víbora (38%) e Selvagem (55%) ligam uma vez e ficam. Isso é coerente — "quando
você está para morrer, você se fecha no casco" é uma fase —, mas é bom saber que
o subsistema tem duas espécies dentro dele, e que só a posicional responde ao
único input do jogo.

**Leitura que inventa um número que o jogo não tem mede a própria invenção.** O
Selvagem passou por uma versão com denominador — bichos vivos sobre a
"capacidade da build", somando os tetos dos efeitos `summon` resolvidos — e o
número estava errado por construção: o motor **não mantém** essa conta. O teto é
cobrado por peça (`countOf(c.key)`), hook também invoca sem declarar `summon`, e
o resultado media 14 bichos contra um teto calculado de 8. A fração saturava em
1 e o aspecto ficava 95,7% ligado. Ele voltou para contagem crua com o limiar
medido (8/5, que é onde uma build de Matilha se sustenta no tier 0).

### Pulso que produz a própria condição não pode ser cobrado por ela

O trigger `aspect` pulsa **enquanto a postura estiver de pé**, e isso é o certo
para cinco das seis peças: o efeito é a recompensa de a postura estar ligada.

O Selvagem é a exceção, e ela tem regra. A postura dele liga com a matilha
grande em campo, e o pulso dele **é** o que põe lobo em campo. Gatilhado pela
postura, ele nunca teria o primeiro lobo, nunca alcançaria o limiar e a peça
ficaria morta para sempre — medido no banco, **zero dano nos seis cenários com o
caminho fechado**, que é exatamente a regra que `driver_bench` reprova.

`whileActive: false` no trigger desliga a cobrança. A postura deixa de ser o
interruptor do pulso e volta a ser só o que sempre foi: o multiplicador nos
canais vivos. E a régua acompanha — `dpsTrigger` usa cadência cheia em vez de
`aspectUptime` quando o campo está declarado, senão a carta prometeria 40% do
que a peça entrega.

Vale para qualquer peça futura cujo efeito alimente a leitura da própria
condição — é auto-referência, não um caso especial do Selvagem.

### O slot cheio tem que sumir da oferta

Com seis aspectos e três slots, a quarta peça de aspecto entra na build e **não
faz nada**: `register` recusa, e o trigger `aspect` não pulsa sem registro. É a
mesma coisa que a carta de +0 que o sorteio já pula, e pior — esta cobra o ponto
de eixo da etapa antes de não fazer nada.

Quem responde é o subsistema, porque é quem sabe o próprio teto:
`requires: { slot: "aspect" }` no dado da peça, e `AspectSystem.hasRoom` em
`meetsRequires`. Peça já possuída continua cabendo, senão o level up não poderia
oferecer **tier** dela.

**A HISTERESE são dois guardas, e cada um mata um jeito diferente de piscar.**

O primeiro é o **vão**: a condição declara `on` e `off`, e a direção é
implícita — se `on > off` ela é de subida, se `on < off` é de descida. O vão
entre os dois *é* a histerese, e ele não pode ser esquecido porque não é um
campo opcional: `driver_aspect` reprova `on === off`. Com a Águia em 0,32/0,24,
um corpo atravessando o anel de dentro não liga e desliga nada — a razão teria
que cair um terço.

O segundo é o **tempo** (`BALANCE.aspect.hold`): o piso de permanência mata o
pisca de quem atravessa o vão inteiro depressa, e a horda fecha e abre em menos
de um segundo. Ele vale para os dois lados — ligar cedo demais é tão ruim
quanto desligar cedo demais.

**A exclusão mútua não desliga o perdedor, ela só não o CONTA.** Dentro de um
grupo, o de maior `priority` que estiver satisfeito é o único que contribui;
os outros continuam "ligados" no estado. Desligá-los ali reiniciaria o relógio
de permanência deles e o pisca voltaria pela porta dos fundos. Guepardo
(na borda da horda) e Falcão (parado, mirando) são posturas opostas:
com o campo vazio e o jogador parado as duas condições valem ao mesmo tempo, e
é justamente aí que o par não pode aparecer aceso junto.

**E o aspecto é ESTADO, então ele não emite evento.** Emitir um vfx a cada
avaliação seria o mesmo erro que emitir um evento a cada 0,5s para dizer "você
tem escudo". Ele se desenha enquanto dura: pips **no chão**, aos pés — a faixa
de cima já pertence à build acesa e o corpo do personagem é a coisa que a
hierarquia de leitura não deixa cobrir. É a mesma regra da casca do escudo e do
rastro do Burning Rush. O teto de três é o dos slots, então não há o que limitar.

`driver_aspect` guarda tudo isso, e a medida que importa é a última: o jogador é
posto **na borda** da condição e sacudido em volta dela — que é o que acontece
de verdade quando ele corrige posição num survivors.

## O corpo do warlock conta a progressão: capstone vira forma, spell vira aura

São dois marcos, com dois donos, e não podem trocar de dono:

| Marco | Gatilho | O que muda | Onde mora |
|---|---|---|---|
| **Metamorfose** | **qual** capstone fechou | troca o sprite do personagem, a escala e a cor da luz no chão | `CLASSES.<id>.forms[].cap` |
| **Iniciado** | a primeira spell concluída | a forma do meio, entre o aprendiz e os capstones | `CLASSES.<id>.forms[].spells` |
| **Aura** | uma spell concluída (qualquer caminho no tier 5) | acende o `PIECE_VFX` daquela peça em volta do warlock | `BuildSystem.isComplete` → `rebuildVfx` |

A versão antiga amarrava as duas coisas no **acúmulo de pontos de eixo**: a
forma vinha em 6 e 14 pontos, e a aura era uma propriedade da forma
(`aura: true`), o que dava adorno a toda peça comprada de uma vez só. Isso
falhava dos dois lados — a transformação chegava por inércia (todo upgrade
empurra o eixo, então ela não marcava escolha nenhuma) e o adorno virava ruído
justo quando a build ficava grande.

Consequências que valem para conteúdo novo:

- **Forma é indexada por QUAL capstone, não por quantos.** A versão anterior
  contava — dois capstones cabem numa run, então eram três formas. Mas contagem
  dá **duas** formas para **oito** finais diferentes: o corpo dizia que a run
  chegou longe e não dizia para ONDE. Hoje são dez formas: aprendiz, Iniciado, e
  uma por capstone, e `driver_form` cobra **cobertura** — capstone sem forma é um
  final que o corpo não sabe contar, e quem fechou justo aquele fica com a
  silhueta de quem não fechou nada.
- **O degrau do meio não podia sair de ponto de eixo.** Ponto entra sozinho a
  cada compra, e a forma voltaria a chegar por inércia — que é o defeito que
  tirou a metamorfose do acúmulo em primeiro lugar. O gatilho é `spells`: fechar
  um caminho até o tier 5, a outra conquista merecida que o jogo tem.
- **As oito formas de capstone são IRMÃS, não uma escada.** Trocar da forma de
  Colheita para a de Tirania anda para trás no array sem andar para trás na run,
  então quem decide se o toast sai é a forma **ter nome** — só a base não tem.
  Comparar índices ali fazia a segunda metamorfose chegar calada.
- **A conclusão da peça é que acende a aura, não a compra.** `upgradePath`
  devolve `completed` **só na primeira** vez que a peça fecha um caminho:
  fechar o segundo caminho da mesma peça não acende uma segunda aura.
- **A `key` atravessa a evolução, então a aura também.** A peça troca de `def`
  no tier 5 e o halo continua aceso, agora com o `vfx` da forma evoluída.
- **Peça nova sem `vfx` simplesmente não tem aura para dar.** Se a spell é de
  assinatura, dê a ela uma entrada em `PIECE_VFX`.
- **Toda forma tem uma segunda grade, `cast`, e ela não se deriva da idle.**
  `walkFrames` tira um passo de uma grade só porque passo é a perna se mexendo
  *dentro* da grade que já existe; nenhum deslocamento de linha produz um braço
  que foi para outro lugar. A `cast` tem que ter as **mesmas linhas** da idle (o
  degrau sai de `drawH / (PIXEL_UNIT × linhas)`), e costuma ser mais **larga** —
  braço aberto não cabe na largura do corpo, e largura não entra na conta do
  degrau. Por isso `drawSprite` mede o **quadro resolvido**, não o sprite base.
- **Quem acende a pose é quem DISPARA, não quem desenha.** `firePiece` é o único
  funil por onde toda peça passa; o desenho roda uma vez por frame e o disparo
  várias (sub-stepping), então amarrar a pose ao render perderia os disparos que
  caem no mesmo frame. `reactive` fica de fora: é o tique de um DoT que já está
  no ar, não um conjuro novo.
- **A pose tem cadência (`CAST_GAP`), pela mesma razão que o hitstop tem.** Uma
  build madura dispara quase continuamente; sem intervalo a pose de cast deixa
  de ser evento e vira o estado normal do personagem — e quem passa a ser
  exceção é a caminhada.
- **Quem avança `player.formIdx` é `UI.checkForm`, e mais ninguém.** Enquanto
  `BuildSystem.afterChange` também adiantava o índice, o `idx === formIdx` de
  lá nunca dava falso e a metamorfose chegava calada — sprite novo, sem toast,
  sem partícula, sem pulso. Quem conceder capstone fora do level-up (o baú já
  faz) precisa chamar `checkForm` depois de `checkCapstones`.

`driver_form` guarda as duas regras: que ponto de eixo sozinho não move a forma,
e que peça comprada sem caminho fechado não acende nada. Desde a separação das
duas telas ele cobra uma terceira, que é a mesma ideia por outro lado: **level-up
não move o pool de eixo**. Se ele voltasse a mover, a forma voltaria a chegar por
inércia.

