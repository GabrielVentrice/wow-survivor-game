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
DRIVER=driver_dot.js   node tools/harness.js .   # cadência, stacking e expiração de DoT
DRIVER=driver_audio.js node tools/harness.js .   # som de morte: grafo, throttle, mudo
DRIVER=driver_music.js node tools/harness.js .   # trilha: andamento, camadas, estados
DRIVER=driver_render.js node tools/harness.js .  # cenário, demônios e explosão: render e caches
DRIVER=driver_track.js node tools/harness.js .   # trilha em arquivo: loop, fallback, estados
DRIVER=driver_cards.js node tools/harness.js .   # level up: tipo, pips, custo real, teto do painel
DRIVER=driver_portal.js node tools/harness.js .  # portal: moldura, boca, runas, abertura
DRIVER=driver_chest.js node tools/harness.js .   # baú: cadência de aparição e tamanho do prêmio
DRIVER=driver_form.js  node tools/harness.js .   # metamorfose por capstone e aura por spell concluída
DRIVER=driver_pixel.js node tools/harness.js .   # grid de pixel: buffer, câmera, escala de sprite, laje
DRIVER=driver_palette.js node tools/harness.js . # paleta mestre: cor fora da PAL, rampa chapada, corpo aceso
DRIVER=driver_feel.js  node tools/harness.js .   # impacto: hitstop, soco de câmera, curvas de evento
DRIVER=driver_preview.js node tools/harness.js . # escreve tools/levelup-preview.html (revisão visual)
PAGE=vfx.html DRIVER=driver_gallery.js node tools/harness.js .      # galeria de animações: todo card monta, anima e desenha
PAGE=sprites.html DRIVER=driver_gallery.js node tools/harness.js .  # galeria de sprites: só o smoke de carga
DRIVER=driver_balance.js node tools/harness.js . 5 16   # balanceamento (5 runs x 4 políticas)
DRIVER=driver_perf.js node tools/harness.js . 12        # custo de frame com a horda no teto
```

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

`driver_preview` também não mede nada: escreve `tools/levelup-preview.html`, a
tela de level-up montada com builds de verdade. Os quatro estados que valem
revisão são **caçados na simulação**, não fixados por número de rodada: linha
completa, linha compacta, compacta com excedente e **evolução na mesa** — esse
último é o mais raro de encontrar jogando e o que tem etiqueta própria. O hover
cai na linha que cobra ponto (para o chip de orçamento aparecer em alarme), ou
na evolução quando há uma.
O HTML sai do mesmo `UI.rowHtml`/`UI.buildPanelHtml` do jogo e o CSS é lido do
`index.html`, então prévia que diverge do jogo não existe. Mesmo argumento do
`sprites.html`: tela que só aparece por segundos, em estados sorteados, não se
revisa jogando.

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
(`audio/gothic-lofi.mp3`). Precisa de numpy e scipy, roda em ~7 s e imprime o
nível de cada barramento e o degrau no ponto de volta do loop. Como reencodar
está em `audio/README.md`.

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
