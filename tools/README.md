# tools/ — verificação headless

O jogo não tem build nem test runner. Estes scripts sobem um stub mínimo de
DOM/canvas no node, carregam os mesmos `<script src>` que o `index.html` carrega
(na mesma ordem) e rodam a simulação sem browser. Servem para pegar erro de
runtime, hook morto, evolução quebrada e travamento de frame — coisas que só
aparecem depois de vários minutos de jogo.

```bash
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
DRIVER=driver_milestone.js node tools/harness.js .  # etapa: tabela, tres eixos, ganho real, quem mira fecha capstone
DRIVER=driver_portal.js node tools/harness.js .  # portal: moldura, boca, runas, abertura
DRIVER=driver_chest.js node tools/harness.js .   # baú: cadência de aparição e tamanho do prêmio
DRIVER=driver_form.js  node tools/harness.js .   # metamorfose por capstone e aura por spell concluída
DRIVER=driver_apex.js  node tools/harness.js .   # o Ápice: eixo cheio, a onda que varre a tela, o chefe que sobra
DRIVER=driver_pixel.js node tools/harness.js .   # grid de pixel: buffer, câmera, escala igual p/ todos, laje
DRIVER=driver_palette.js node tools/harness.js . # paleta mestre: cor fora da PAL, rampa chapada, corpo aceso
DRIVER=driver_feel.js  node tools/harness.js .   # impacto: hitstop, soco de câmera, curvas de evento
DRIVER=driver_vfx.js   node tools/harness.js .   # vfx: assinatura de cada peça, cor no render, voz de cada evento, ceifa e cadeia
DRIVER=driver_spread.js node tools/harness.js .   # projétil: leque que o homing não fecha, e alvo próprio por tiro
DRIVER=driver_preview.js node tools/harness.js . # escreve tools/telas-preview.html: as 6 telas de UI (revisão visual)
PAGE=vfx.html DRIVER=driver_gallery.js node tools/harness.js .      # galeria de animações: todo card monta, anima e desenha
PAGE=sprites.html DRIVER=driver_gallery.js node tools/harness.js .  # galeria de sprites: só o smoke de carga
PAGE=icons.html   DRIVER=driver_gallery.js node tools/harness.js .  # folha de contato dos ícones: idem
DRIVER=driver_balance.js node tools/harness.js . 5 16   # balanceamento (5 runs x 4 políticas)
DRIVER=driver_perf.js node tools/harness.js . 12        # custo de frame com a horda no teto
DRIVER=driver_autopsy.js node tools/harness.js . 8 4          # autopsia: QUEM matou o jogador
DRIVER=driver_autopsy.js node tools/harness.js . 8 4 sweep    # o mesmo, comparando variantes de tuning
```

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
cartas, ele cobra mais três: **carta sem `.lv-plain`** (a manchete é o efeito, e
numa carta o nome vem antes no espaço — só o tamanho segura a hierarquia),
**`lv-ax` de volta na tira** (eixo não é assunto desta tela) e a **trava de
nível das passivas**, verificada no nível 1 antes de subir o nível para medir o
resto.

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
- e **quem mira, chega** — fecha a pool inteira, dentro de uma run jogável
  (o driver reprova se isso só acontecer depois dos 11 min: marco entregue
  depois da morte não entrega nada), e com capstone. Sem esta última o resto é
  contabilidade.

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

`make_track.py` não é driver: é o gerador da trilha de fundo
(`audio/rain-lofi.mp3`, o lofi de chuva). Precisa de numpy e scipy, roda em ~7 s
e imprime o nível de cada barramento e o degrau no ponto de volta do loop —
degrau menor que o típico entre amostras é a prova de que a faixa emenda e pode
rodar com `loop` nativo. Como reencodar, e por que a chuva entra depois da
fita, está em `audio/README.md`.

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
