# tools/ — verificação headless

O jogo não tem build nem test runner. Estes scripts sobem um stub mínimo de
DOM/canvas no node, carregam os mesmos `<script src>` que o `index.html` carrega
(na mesma ordem) e rodam a simulação sem browser. Servem para pegar erro de
runtime, hook morto, evolução quebrada e travamento de frame — coisas que só
aparecem depois de vários minutos de jogo.

```bash
node tools/run-all.js                      # A BATERIA INTEIRA, em paralelo (~70s)
node tools/run-all.js fast                 # so o que roda em menos de 1s (~8s)
node tools/run-all.js bench,cards          # um subconjunto, por nome parcial
node tools/harness.js .                    # run completa, seed 1, 12 min
node tools/harness.js . 3 15               # seed 3, 15 min de jogo
DRIVER=driver_evo.js   node tools/harness.js .   # as 7 evoluções + regras de eixo/caminho
DRIVER=driver_hooks.js node tools/harness.js .   # todo hook de capstone/passiva dispara?
DRIVER=driver_dot.js   node tools/harness.js .   # DoT: cadência, stacking, expiração e a conta que vence com o corpo
DRIVER=driver_audio.js node tools/harness.js .   # som de morte: grafo, throttle, mudo
DRIVER=driver_music.js node tools/harness.js .   # trilha: andamento, camadas, estados
DRIVER=driver_render.js node tools/harness.js .  # cenário, demônios e explosão: render e caches
DRIVER=driver_track.js node tools/harness.js .   # trilha em arquivo: loop, fallback, estados
DRIVER=driver_cards.js node tools/harness.js .   # level up: gate de eixo, pips, progresso, teto do painel
DRIVER=driver_milestone.js node tools/harness.js .  # etapa: rampa de abates, tres eixos, ganho real, quem mira fecha capstone
DRIVER=driver_portal.js node tools/harness.js .  # portal: moldura, boca, runas, abertura
DRIVER=driver_chest.js node tools/harness.js .   # baú: cadência de aparição e tamanho do prêmio
DRIVER=driver_form.js  node tools/harness.js .   # metamorfose por capstone e aura por spell concluída
DRIVER=driver_apex.js  node tools/harness.js .   # o Ápice: eixo cheio, a onda que varre a tela, o chefe que sobra
DRIVER=driver_pixel.js node tools/harness.js .   # grid de pixel: buffer, câmera, escala igual p/ todos, laje
DRIVER=driver_palette.js node tools/harness.js . # paleta mestre: cor fora da PAL, rampa chapada, corpo aceso
DRIVER=driver_leaderboard.js node tools/harness.js . # placar: payload inteiro, parser gviz, filtro, escape, camada local
DRIVER=driver_feel.js  node tools/harness.js .   # impacto: hitstop, soco de câmera, curvas de evento
DRIVER=driver_vfx.js   node tools/harness.js .   # vfx: assinatura de cada peça, cor no render, voz de cada evento, ceifa e cadeia
DRIVER=driver_spread.js node tools/harness.js .   # projétil: leque que o homing não fecha, e alvo próprio por tiro
DRIVER=driver_bench.js node tools/harness.js .   # banco: dano de cada peça em 6 cenários controlados
DRIVER=driver_bench.js node tools/harness.js . 20 full        # 20s/célula, os três caminhos
DRIVER=driver_bench.js node tools/harness.js . 12 "" cataclysm  # só um eixo (~7s, para iterar)
DRIVER=driver_preview.js node tools/harness.js . # escreve tools/telas-preview.html: as 6 telas de UI (revisão visual)
PAGE=vfx.html DRIVER=driver_gallery.js node tools/harness.js .      # galeria de animações: todo card monta, anima e desenha
PAGE=sprites.html DRIVER=driver_gallery.js node tools/harness.js .  # galeria de sprites: só o smoke de carga
PAGE=icons.html   DRIVER=driver_gallery.js node tools/harness.js .  # folha de contato dos ícones: idem
DRIVER=driver_balance.js node tools/harness.js . 5 16   # balanceamento (5 runs x 4 políticas)
DRIVER=driver_balance.js node tools/harness.js . 4 16 40,90,45  # o mesmo, com outra rampa de etapa
DRIVER=driver_perf.js node tools/harness.js . 12        # custo de frame com a horda no teto
DRIVER=driver_autopsy.js node tools/harness.js . 8 4          # autopsia: QUEM matou o jogador
DRIVER=driver_autopsy.js node tools/harness.js . 8 4 sweep    # o mesmo, comparando variantes de tuning
```

## `run-all` — a bateria em paralelo

A bateria era serial por acidente e nao por necessidade. Cada driver e um
processo que carrega a propria copia do jogo e nao fala com ninguem, entao o
relogio de parede era a SOMA de todos por nenhuma razao alem de o laco estar
escrito em `bash`. Medido, nesta maquina de 4 nucleos: **175s viraram 70s**.

Duas decisoes fazem a conta fechar, e a segunda e a que envelhece bem:

- **O mais lento entra primeiro.** Com um driver de 58s e um pool de 3, a ordem
  alfabetica termina com ele comecando por ultimo e o pool inteiro esperando um
  processo so. Ordenado por custo decrescente, o resto da bateria cabe DENTRO
  da janela dele — o piso do relogio passa a ser o driver mais lento, e nada
  alem dele.
- **O custo e medido, nao digitado.** Cada rodada grava os tempos em
  `tools/.run-all-times.json` (fora do repo) e a proxima ordena por eles. Uma
  tabela de pesos escrita a mao envelheceria calada no primeiro driver novo, e
  um driver que ficou lento sem ninguem notar e exatamente o que esta ferramenta
  deveria tornar visivel.

Tres tiers: `fast` e o que roda a cada edit (~8s, so mecanismo), `full` e o que
roda antes de commitar (~70s, inclui os que simulam minutos de jogo e as
galerias), `deep` sao `balance`/`perf`/`autopsy`, que MEDEM em vez de verificar
e saem por pedido.

**O que NAO e a alavanca, medido:** baixar `maxAlive` de 4400 para 1500 corta
so 23% do tempo de simulacao (60,8s -> 46,9s em 4 min de jogo) e muda o que os
drivers veem. O custo do frame e a horda — 40% dele mora no `SpatialGrid`, e a
segunda metade em `updateEnemies` —, mas o teto de vivos nao e o que o decide
nos primeiros minutos; o fluxo de spawn e. Encolher a horda paga pouco e paga
em cima do unico numero que varios drivers existem para exercitar.

A alavanca que sobra, e ela e um refactor de verdade: **uma simulacao, varios
observadores**. `driver.js`, `driver_audio`, `driver_chest` e `driver_render`
simulam 3, 5, 12 e 3 minutos do MESMO jogo do zero — 170 dos 206 segundos de
CPU da bateria sao quatro processos construindo o mesmo mundo. Um unico run de
12 min com quatro conjuntos de sondas custaria o tempo de um deles. O preco e
isolamento: hoje um driver que estoura nao derruba os outros tres.

## `browser.js` — o que o stub nao ve

Todo o resto desta pasta sobe um stub de DOM/canvas no node. E isso que torna
a bateria barata, e e tambem o teto dela: **o canvas stub aceita tudo**.

Um bug real passou por 24 drivers verdes por causa disso. `Projectile.reset`
gravava `rgb` so no ramo do cometa, e o tiro comum fechava o gradiente em
`rgba(undefined,0)` — string que o stub engole e o browser recusa, lancando de
dentro de `addColorStop`. Como a excecao escapava de `render`, `present()` nao
rodava e o quadro inteiro nao era apresentado. Nao travava (o `_loop` reagenda
na primeira linha), entao lia como o jogo perdendo quadros perto de tiro
inimigo. Nenhum driver podia ver isso.

E o stub nao tem preco: ele CONTA chamadas de desenho e nao pode dizer quanto
cada uma custa. `driver_perf` mede a simulacao; quem mede o render e aqui.

```bash
# playwright fica FORA do repo — nao ha package.json aqui e nao vai haver
mkdir -p ~/.pacto-browser && cd ~/.pacto-browser && npm init -y && npm i playwright
npx playwright install chromium
cd -

export NODE_PATH=~/.pacto-browser/node_modules
node tools/browser.js bench 4          # ms por quadro, horda de ~1850 corpos
node tools/browser.js shot ref         # fotografa a cena fixa como "ref"
node tools/browser.js shot novo ref    # ... e compara a de agora com ela
```

Por isso ele fica **fora do `run-all.js`**: a bateria nao pode depender de algo
que o repo nao carrega. Ele sai por pedido, quando se mexe em render.

**`bench` mede, `shot` protege.** Otimizar render sem o segundo e apostar — e
duas das tres tentativas de acelerar a sombra do inimigo sairiam se nao
houvesse com que conferir. `shot` monta uma cena FIXA (um corpo de cada tipo em
grade, mais um aglomerado sobreposto, camera cravada) e devolve o hash da
imagem: ou e identica pixel a pixel, ou ele diz de quanto foi o desvio. Um
quadro de batalha nao serve de referencia, porque ele depende da run inteira.

**O ruido do `bench` entre rodadas e ~0.5ms**, e a maquina varia mais que isso
sob carga. Diferenca menor nao e diferenca: rode as duas variantes
INTERCALADAS, tres vezes cada, e compare as medianas. Foi assim que tres
otimizacoes de sombra que pareciam boas foram medidas e descartadas — a de
cache empatou, a que juntava tudo num path so ficou 60% mais lenta (o
rasterizador passa a computar a uniao de 1850 sub-elipses), e o custo real
acabou sendo overhead POR CHAMADA, nao a forma desenhada. Depois do culling,
canvas2d nao tem mais o que dar aqui sem desenhar menos coisas.

## `driver_bench` — a peca sozinha, em cenario controlado

`driver_balance` responde "esta RUN funciona?". Ele nao responde "esta PECA faz
muito ou pouco dano?", e nao pode: o que ele mede passa por um bot que se
posiciona, por uma curva de XP, por um sorteio de oferta e por 44 pecas
dividindo o mesmo funil. Uma peca que aparece com 0,4% de share pode estar
quebrada, pode ter sido comprada tarde, ou pode nunca ter caido na mesa — e a
tabela nao distingue os tres casos. A lista `NUNCA ESCOLHIDA` e a prova: hoje
ela mistura "o sorteio nao ofereceu" com "nao faz nada".

O banco tira a run da conta. Cada celula e um mundo montado a mao — spawner
desligado, N dummies em posicao conhecida, jogador imortal — e a matriz inteira
sai em **20s: 450 celulas de 12s de jogo cada**. O que corta o custo nao e
simular menos jogo, e sim simular menos HORDA: 40 dummies em vez de 4400 corpos.
O motor continua sendo o mesmo `Game`, de proposito — uma planilha de dano seria
mais rapida e seria uma segunda lista para divergir da primeira.

Seis cenarios (`SCENARIOS`, dado): alvo unico, aglomerado em volta, cerco com o
jogador andando, leva mortal com reposicao, atiradores e chefe. Duas
configuracoes por peca: recem-comprada e com um caminho fechado no tier 5.

Foi ele que achou os dois defeitos que a grade de tres linhas trouxe: o Demonic
Circle piorava ao saltar mais cedo (fugir antes de a horda fechar pega menos
corpos) e a linha de Critico do Shadowburn fechava sem nunca disparar — 100% de
critico sobre um golpe que nao acontece continua sendo zero.

Uma reprovacao dele e ARTEFATO DE CENARIO e continua vermelha de proposito:
`rainOfFire mastery5` evolui para Cataclysm, que e `directional`, e o piloto do
banco fica parado na maioria dos cenarios. Ela ja era vermelha antes da grade
(como `strike5`, e com zero em vez de 5,5k).

Duas coisas custaram uma rodada cada, e as duas sao a mesma licao — **o banco
tem que montar um mundo que o jogo pode entregar**:

- **O kit inicial FICA.** A primeira versao limpava a build para deixar uma peca
  so, e voltou com um bloco de zeros: `shadowburn` (executa quem tem pouca
  vida), `soulLeech` e toda peca `reactive` nao tem como disparar sem alguem
  batendo antes. Isso nao e a peca sendo fraca — e o banco tendo montado uma
  build que nao existe, porque `CLASSES.warlock.starting` da `incinerate` de
  graca em toda run. O que mantem o numero limpo nao e a build vazia, e a `key`:
  `damageBy` e por fonte.
- **`requires` e honrado.** O jogo nao oferece Conflagrate sem um DoT na build,
  entao medi-la sem habilitadora mede uma build impossivel. Com a habilitadora,
  as quatro pecas com `requires` sairam de zero.

O que ele reprova, e por isso e driver e nao relatorio:

- **peca de dano com caminho fechado que nao causa dano em cenario nenhum** — o
  zero ambiguo do `driver_balance`, agora sem ambiguidade. "Peca de dano" sai do
  MECANISMO (a build resolvida tem algum efeito que causa dano?) e nao da tag:
  `reactive` cobre tanto Shadowburn quanto o escudo do Soul Leech, e `reflect`
  so causa dano se um tier comprou isso;
- **caminho fechado que rende MENOS que a peca crua** — um tier que piorou a
  peca. Ninguem le 660 tiers a procura disso — e desde que as tres linhas
  viraram uma grade so (`js/content/paths.js`), o modo `full` e o unico lugar
  que mede as tres: o modo padrao fecha o PRIMEIRO caminho, que hoje e sempre a
  Aceleracao.

- **a REGUA discordando do CAMPO** (bloco `REGUA x CAMPO`). `js/systems/dps.js`
  e o numero que a tela de level up imprime, e ele e um modelo fechado: nao roda
  o motor, resolve uma conta. Um modelo que ninguem confere vira a segunda lista
  que o projeto passa o tempo inteiro evitando, e esta e a unica lista contra a
  qual da para conferir — porque ela e a medida. O que se cobra e ORDEM e nao
  valor (a barra da carta e comparativa: "a mais longa ganha mais"), pelo rho de
  Spearman entre as duas ordens: **0.75 hoje, piso 0.6**. O piso e frouxo de
  proposito — o modelo assume UM campo e o banco mede seis, dois deles de alvo
  unico, entao peca de area sai subestimada la e o desacordo e do cenario. E ele
  reprova mudez nos dois sentidos: regua zero onde o campo mede dano (a carta
  diria "nao muda o dano" sobre uma peca que muda) e regua com dano onde o campo
  mede zero (a carta prometeria um numero que nao existe). A isenção é a mesma
  que a reprovacao de peca muda ja carrega: `player_below` e `enemy_below` nunca
  viram verdade num campo em que o jogador e imortal e os dummies tambem.

O que ele NAO responde, e nao deve: se o jogador CHEGA ao tier 5. O banco
credita o gate de eixo de uma vez e nunca chama `checkCapstones`, porque o
assunto e dano e nao economia — misturar as duas perguntas e o que faz a
resposta nao servir para nenhuma das duas. Economia e `driver_milestone` e
`driver_balance`.

## `driver_autopsy` — quem matou, e o que consertaria

`driver_balance` responde **quanto tempo** se sobrevive. Ele não responde a
pergunta que uma morte instantânea faz: **quem** cobrou, e cobrou de uma vez ou
ao longo de dez segundos. Uma média de dps não enxerga um golpe único — ela
dilui exatamente o frame que interessa.

A autópsia instrumenta `Game.damagePlayer` e devolve o dano tomado repartido por
inimigo nomeado, em três recortes (run inteira, primeiros 2 min, últimos 2s de
vida), mais o **histograma de dano por frame**: quantos frames cobram 10%, 25%,
50% da barra de uma vez. É esse histograma que separa "o jogo está difícil" de
"tem uma coisa te matando do nada".

Nada disso muda uma linha do jogo. A atribuição sai de três ganchos:

| fonte | como o nome é reconstruído |
|---|---|
| `blast` | o wrapper de `deathBlast(e)` anota o autor antes de cobrar |
| `touch` | `updateEnemies(dt)` entrega o passo, então `amount / dt` é o `touchDps` de quem está encostado — e o grid diz quais corpos estão lá |
| `projectile` | o `shootDamage` identifica qual casta `ranged` atirou |

O modo `sweep` é a outra metade, e é o que evita noites jogando para testar uma
hipótese: cada entrada de `VARIANTS` é um patch **reversível** sobre os dados,
rodado com as mesmas seeds das outras. Variante nova é uma entrada nova ali, não
um branch no jogo — a comparação acontece antes de o número entrar no
`balance.js`. O 5º argumento filtra quais rodar (`... sweep base,raio-48`):
varredura larga e barata primeiro, rodada funda só nos finalistas.

Duas regras, e as duas custaram uma rodada para serem aprendidas:

- **Variante troca dado, nunca substitui método.** Uma versão anterior testou o
  falloff reescrevendo `deathBlast` inteiro, e a reescrita deixou de fora o
  `spawnParticles` — que sorteia. Com um número de sorteios diferente do jogo,
  as duas runs divergem no primeiro spawn: o resultado prometeu 1/8 de mortes e
  o patch de verdade entregou 5/8. Hipótese que só cabe em código entra no jogo
  atrás de um campo de dado e é medida de lá.
- **Mesma seed não é mesma run.** No instante em que um número muda, o jogador
  toma dano diferente, mata em outra ordem e o próximo `Math.random()` cai em
  outro lugar. A comparação é estatística, nunca par a par: uma ou duas mortes
  de diferença em oito runs é ruído.

## Sprite novo a partir de imagem gerada

Dois scripts, e eles são as duas metades do mesmo fluxo. Nenhum dos dois entra
na verificação — são ferramenta de autoria, não driver.

```bash
# 1. o prompt, já com a PAL de verdade dentro dele
python3 tools/make_sprite_prompt.py --silhouette --name "a plague-bloated ghoul" --grid 14x16
python3 tools/make_sprite_prompt.py --name "a plague-bloated ghoul" --grid 14x16 \
    --view front --ramp rot0 --ink warm --second bone0 --accent blood1

# 2. a volta: imagem gerada -> primeiro passe de grid, preso à PAL
python3 tools/image2grid.py ghoul.png --grid 14x16 --ramp rot0 --ink warm \
    --second bone0 --accent blood1
```

`--ramp`/`--second` recebem o **primeiro passo** de uma rampa e usam três
consecutivos: a fatia é a identidade (ver CLAUDE.md). `--accent` só aceita cor
de energia — passar `bone1` ali é erro, e o script diz para usar `--second`.

`--pose` (repetível) troca a figura única por uma **folha de poses**: o mesmo
personagem, mesma altura, mesma linha de base, uma pose por painel. É assim que
um sprite ganha o que o grid não gera sozinho — `walkFrames` deriva um passo de
uma grade só, porque passo é a perna se mexendo dentro dela; **pose de cast é
outro desenho**, e nenhum deslocamento de linha produz um. A folha volta pelo
`split_sheet.py` e cada painel vira uma grade.

```bash
python3 tools/warlock_forms.py                  # UM prompt, as dez formas
python3 tools/warlock_forms.py --form colheita  # uma só, prompt avulso
python3 tools/warlock_forms.py --silhouette     # a rodada de silhueta, que vem antes
```

`warlock_forms.py` guarda os **argumentos** das dez formas do warlock
(aprendiz, experiente e uma por capstone), não o texto: um .md de prompts
colados envelheceria calado, pedindo cores que a `PAL` não tem mais.

**O modo padrão é UM prompt só, e essa é a decisão que importa aqui.** Dez
colagens são dez conversas, e o modelo não tem como saber que a quarta pertence
ao mesmo elenco da primeira: volta com outro peso de contorno, outra proporção
de cabeça, outro jeito de fechar o manto. O defeito não aparece olhando um
sprite por vez — aparece com os dez lado a lado, que é exatamente como o jogador
vê a progressão do próprio personagem. O contrato de estilo é escrito uma vez e
vale para as dez; só o corpo e a fatia da rampa mudam. Não cabe uma imagem só
com todas: são 26 painéis, e cada figura sairia pequena demais para ter detalhe
que sobreviva ao downscale — então é um prompt, uma imagem por forma, na mesma
conversa.

É lá também que está escrito que a **aura não entra na referência** — fogo em
volta, alma verde e rastro de voo são `VfxLayer` na cor da forma, e brilho
pedido ao modelo vaza para fora da silhueta e apaga a única informação que a
imagem tinha para dar. Voo, esse sim, é pose: a forma que flutua não tem perna
no chão, e `findLegs` cai sozinho no balanço em vez do passo.

O chão tem o seu próprio par, porque o defeito dele é outro — laje boa sozinha
e treliça óbvia quando ladrilhada:

```bash
python3 tools/sheet2tiles.py folha.png /tmp/rows.js /tmp/zoom.png /tmp/campo.png
```

`/tmp/campo.png` é o que decide: ele ladrilha as oito com peso e espelho, do
mesmo jeito que `Scenery.draw`. As grades saem prontas para `TILE_ROWS`
(`js/render/tiles.js`).

```bash
# 3. conferir com os olhos: o novo sozinho, e o novo no meio do elenco
python3 tools/spritesheet.py --zoom 14 --cols 2 --only <novo> ghoul --out /tmp/zoom.png
python3 tools/spritesheet.py --out /tmp/sheet.png
```

`spritesheet.py` é o que o `sprites.html` faz, em PNG: serve para quem não pode
abrir um browser, e responde a pergunta que ninguém faz sozinho ao acrescentar
um sprite — não "isso está bom?", e sim "isso pertence a este jogo?".

As duas pontas também existem como skill (`.claude/skills/`), para descrever a
criatura em português e receber o prompt pronto: `sprite-prompt` decide rampa,
fatia, tinta, acento, vista e tamanho; `sprite-from-image` faz a volta inteira
até o sprite entrar no jogo verificado.

`image2grid` é **primeiro passe, não conversor**. Ele resolve a parte mecânica
(fundo fora, caixa delimitadora, uma cor dominante por célula, presa ao punhado
de tokens que aquela criatura pode usar) para o trabalho à mão começar de uma
forma em vez de um grid vazio. Olho no lugar errado, membro fino que quebra e
simetria fora por um pixel são o que sobra para você — e são exatamente o que
uma média não resolve.

## Balanceamento

`driver_balance` põe um bot no controle e roda muitas runs sob quatro políticas
de escolha. O bot não é um humano — é um piloto de referência, e os números
absolutos dele valem menos que as comparações.

O alvo **não** é sobreviver X minutos. É o **degrau de poder**: abates/segundo
do último terço da run divididos pelos do primeiro. Abaixo de 2x o jogador não
sente que ficou mais forte, só que o jogo ficou mais difícil.

Estado medido (20 runs):

| métrica | alvo | agora |
|---|---|---|
| degrau de poder | ≥ 4x | 4.6 – 6.8x (3 de 4 políticas) |
| sobrevivência mediana | 8 – 14 min | 7:26 – 12:42 |
| runs que terminam em morte | ~todas | 19/20 |
| pool de eixos gasta | 20/20 | 20/20 |
| runs com evolução | ≥ 25% | 25% |
| runs com capstone | ≥ 25% | 40% |
| runs com aura (spell concluída) | ≥ 25% | 50% |
| runs com metamorfose | ≥ 25% | 40% |

A política `agressivo` marca 1.2x: ela ignora defesa e controle por construção,
morre cedo, e o terço inicial curto distorce a razão. É arquétipo glass cannon
falhando, não regressão.

`driver_preview` também não mede nada: escreve `tools/telas-preview.html`,
com as telas de UI montadas a partir de builds de verdade. Os
quatro estados do level-up são **caçados na simulação**, não fixados por número
de rodada: build crua, build média, tira no teto com contador e **evolução na
mesa** — esse último é o mais raro de encontrar jogando e o que tem etiqueta
própria. A etapa sai nos dois extremos: primeiro marco (2 pontos, build crua,
capstone longe) e marco final (5 pontos, eixo carregado, capstone ao alcance),
que é onde os números da linha mudam de peso.
Depois delas saem as outras quatro — **HUD, pausa, baú e game over** —, pelo
mesmo argumento: o baú depende de sorteio, a pausa só é vista quando alguém
pausa e o game over só existe quando a run acaba, então nenhuma delas se revisa
jogando de propósito. O baú é capturado no meio do laço e não no fim: com todo
caminho no tier 5 ele só entrega "arsenal no máximo", que é o estado que menos
precisa de revisão.

O HTML sai dos mesmos `UI.cardHtml`/`UI.buildStripHtml`/`UI.msRowHtml`/
`UI.onPause`/`UI.openChest`/`UI.onGameOver` do jogo e o CSS é lido do
`index.html`, então prévia que diverge do jogo não existe. As cascas das quatro
telas novas são escritas no driver, e por isso ele **confere cada id contra o
`index.html`**: casca desatualizada é exatamente como uma prévia diverge em
silêncio.

## As duas telas de escolha

`driver_cards` cobre a batida rápida e `driver_milestone` a lenta, e a divisão
entre eles é a mesma do jogo: level-up só aprofunda, etapa é a única fonte de
ponto de eixo.

`driver_cards` reprova, além do que já checava, **oferta de peça nova no
level-up** e **escolha de level-up que mova o pool de eixo** — as duas são a
mesma regressão vista de dois lados: uma tela em que largura e profundidade
disputam a mesma escolha, e largura ganha sempre. Depois que a tela virou
cartas, ele cobra mais três: **carta sem `.lv-plain`** (o slot em Eczar existe em
toda carta), **`lv-ax` de volta na tira** (eixo não é assunto desta tela) e a
**trava de nível das passivas**, verificada no nível 1 antes de subir o nível
para medir o resto.

Desde a **régua comum** ele cobra outras quatro, e as quatro são sobre o número
que virou o herói da carta:

- o ganho em dano/s é **número finito e nunca negativo** — uma oferta que
  piorasse a peça seria uma barra crescendo para trás;
- **a barra existe** (`lv-escala`) e **a tecla existe** (`lv-tecla`), e o botão
  `ESCOLHER` não voltou: 44px de largura inteira, três vezes, repetindo a mesma
  palavra, contra 34px no canto;
- ganho zero **não imprime `+0`** — "+0 dano/s" lê como peça quebrada quando o
  que houve foi a régua não medir aquilo;
- **tier numérico não repete o número no slot em Eczar**: 528 dos 660 tiers são
  gerados e o texto deles é puro número, o mesmo dado que a régua e os valores
  crus já imprimem. Ali vai `LINE_ABOUT[pathId]`, a frase da linha.

Quem confere se a régua ORDENA como o campo é `driver_bench`, não este — ver o
bloco `REGUA x CAMPO` acima.

`driver_milestone` guarda a tela em suas duas fases, e a parte que mais importa
é que ele **refaz a conta da cadência por simulação** em vez de conferir uma
tabela — não existe tabela de pontos, a rampa é emergente:

- enquanto sobrar ponto, um marco ainda vem. As etapas não acabam numa contagem,
  acabam quando a pool acaba. Enquanto uma lista fixa era o fim da linha, runs
  terminavam em **12/20 e 13/20** com ponto que o jogo nunca entregava;
- na fase **fechada** nenhuma carta tem lado seco, e o sorteio vê o catálogo
  inteiro (o driver exige ver eixo repetido numa etapa);
- na fase **aberta** o eixo comprometido **nunca falta**. É o que separa isto de
  uma loteria: o eixo em que o jogador já investiu não pode depender do sorteio
  para reaparecer;
- o número anunciado é o creditado, nos dois lados; a spell credita no eixo
  **dela** e não cobra eixo duas vezes (entra como `free`);
- e **quem mira, chega** — fecha a pool inteira, dentro de uma run jogável, e
  com capstone. Sem esta última o resto é contabilidade.

O marco é contado em **abates** e não em segundos, então a cobrança de "run
jogável" mudou de unidade: o teto era um relógio (11 min) e virou um **orçamento
de corpos** (20 mil, o que uma run competente do piloto acumula um pouco depois
dos 10 min). Junto disso ele cobra que a rampa exista e **cresça a cada marco** —
com quota fixa por corpo, uma run que engata a bola de neve esvaziaria a pool
nos primeiros minutos, e o clímax chegaria antes de haver build para gastá-lo.
Este driver não roda a simulação, ele exercita a tela: quem re-mede a curva de
abates é `driver_balance`, que ganhou a linha `marco N em X abates` e um sweep
da rampa por argv (`... 4 16 40,90,45`).

**A rampa é um ponto fixo, não um número que se deriva** — e isso custou uma
rodada para ser aprendido. A primeira tentativa (`50/200/80`) foi calibrada para
acompanhar a curva de abates medida no jogo de marco por tempo, e mesmo colada
nela derrubou a pool mediana de 12/20 para 5/20: com relógio o jogador recebe o
ponto *e por isso* produz aquela curva; com corpos, ficar atrás cedo se acumula.
Por isso o sweep existe — achar o ponto exige rodar a bateria inteira com rampas
diferentes, e sem ele isso seriam três árvores de trabalho.

O capstone é a única dessas cobranças feita por **taxa**, e não por seed. A
fase fechada obriga a levar a spell que o sorteio pôs na mesa, então o eixo
alvo termina com 14 a 16 dos 20 pontos conforme a mão — e 14/4/2 erra o puro
(15) e o híbrido (10+5) por um ponto de cada lado. Cobrar isso em cinco seeds
fixas mede o baralho e não o jogo: **qualquer peça nova reembaralha o sorteio**
e derruba uma seed que estava verde sem que a tela tenha mudado. Então ele roda
20 mãos e exige 80%; hoje marca 18/20. Mecanismo, não sorte de seed.

**Driver que roda a simulação em laço precisa resolver a tela de etapa.** Ela
para o `update` como o level-up e o baú, e sem um `openMilestone` de stub o
driver roda até o primeiro marco e chama de minutos — `driver_audio` estava
medindo 40 segundos de jogo e anunciando quatro minutos. Nove drivers ganharam
o stub de uma linha; quem mede etapa de verdade é `driver_milestone`.

## Impacto

`driver_feel` guarda a camada que faz um acerto **aterrissar** em vez de apenas
acontecer: hitstop, soco de câmera e as curvas dos eventos visuais. São as três
coisas que não se revisam jogando — hitstop mal limitado só aparece depois de a
build ficar grande, tremor que voltou a ser ruído branco só aparece em
movimento, e curva linear parece aceitável isolada e genérica no conjunto.

O que ele reprova:

- **Hitstop sem teto.** Ele para a *simulação*. O driver roda 8 min pelo
  `_loop` e mede que fração do tempo **real** o jogo passou congelado, quantos
  stops por segundo, e o stop mais longo em frames. Hoje: 6,1% e 1,2 stops/s.
  O teto vem da própria cadência (`BALANCE.camera.hitstop.cooldown`), então
  afrouxar a cadência afrouxa o teste junto — de propósito: o número que
  interessa é o medido, e ele fica impresso.
- **Hitstop no relógio errado.** O mesmo stop é medido a 1x e a 3x. Preso ao
  `clock` (escalado), 50ms virariam 150ms no timeScale 3 — e o modo rápido
  seria o que mais trava.
- **Tremor sem continuidade.** Mede o passo entre frames contra a amplitude.
  Ruído branco salta até 2x a amplitude; oscilação amostrada 7x por ciclo fica
  em 0,68x. Também cobra que o soco saia **na direção do golpe** em 6 direções,
  que o eixo não mude no meio do evento, que 100 eventos no mesmo frame saturem
  em vez de somar, e que o tremor termine em zero exato.
- **Curva que voltou a ser reta.** `outCubic`/`outQuint` têm que ser
  adiantadas: no primeiro quarto da vida o evento já andou mais da metade.

Duas coisas ele **não** mede, e por isso ficam como dado em `BALANCE.camera`:
se o hitstop lê como impacto ou como engasgo, e se a amplitude do soco está
alta demais. Isso é uma passada de dez segundos no browser — as alavancas são
`hitstop.big`/`hitstop.cooldown` e `shake.max`.

## Galerias

`PAGE` escolhe a página que o harness carrega — `index.html` (padrão) é o jogo,
`sprites.html` e `vfx.html` são as galerias. Os `<script>` rodam na **ordem do
documento**, `src` e inline misturados, igual ao browser: `sprites.html` declara
`MINIONS` num inline antes de carregar quem usa, e inverter isso quebra.

`driver_gallery` monta TODO card, roda 6 segundos de relógio nele e desenha
quadro a quadro com o canvas stub contando traço. Ele reprova três coisas:

- card que estoura no `setup`, no `tick` ou no desenho;
- card **mudo** — que monta e não desenha nada além do fundo;
- (só em `vfx.html`) registry que passou na frente da galeria: efeito, trigger,
  hook, peça, passiva, capstone, demônio ou evento visual **sem card**, e card
  marcado "sem demo nesta galeria".

Esse terceiro item é o que mantém a galeria honesta. Conteúdo novo entra no
registry e aparece na galeria na mesma leva, ou o driver reclama. A tarja
laranja "sem animação própria", ao contrário, **não** é falha: é a lista do que
o jogo muda sem avisar em tela — hoje 25 mecânicas.

`make_track.py` e `make_focus_track.py` não são drivers: são os geradores das
duas trilhas de fundo — `audio/rain-lofi.mp3` (Tempestade, o lofi de chuva) e
`audio/focus-vigil.mp3` (Vigília, o leito de foco, que é a padrão). Precisam de
numpy e scipy, rodam em ~7 s e ~25 s, e os dois imprimem o nível de cada
barramento e o degrau no ponto de volta do loop — degrau menor que o típico
entre amostras é a prova de que a faixa emenda e pode rodar com `loop` nativo.

**O gerador de foco imprime mais dois números, e eles são o teste da faixa**:
o passeio de RMS em janela de 2 s (alvo `< 1,5 dB`) e o maior salto de 250 ms
sobre o fundo dos 6 s anteriores (alvo: zero janelas acima de 6 dB). É o que
separa um leito de fundo de uma faixa — a Tempestade mede 6,8 dB e sete saltos,
que é o certo para ela e o errado para o fundo de uma run de doze minutos. O
argumento inteiro, a tabela comparativa e como reencodar estão em
`audio/README.md`.

O stub de `AudioContext` monta o grafo de verdade e explode em rampa
exponencial com alvo <= 0, então erro de WebAudio aparece aqui e não só no
browser.

O driver padrão também valida o registry antes de simular: tiers faltando,
efeito ou hook inexistente, `key` que muda na evolução, mod em stat que não
existe, `requires` apontando para nada e cor fora da paleta do eixo.

Onde a condição do teste é específica demais para sair de uma simulação
aleatória — Colheita precisa de um inimigo com 3+ DoTs *morrendo*, Contágio
precisa de um DoT expirando num alvo *vivo* — o driver provoca a condição à
mão. Testar mecanismo, não sorte de seed.
