# CLAUDE.md

Guia para o Claude Code (claude.ai/code) trabalhar neste repositório.

## O que é

**PACTO** — nome **provisório**, e vale saber que ele é provisório: veio junto
com a identidade visual (é sobre trocar carne por poder, que é o que a
metamorfose faz literalmente no corpo), está no `<title>` e no menu, mas não foi
decidido. O repositório e as pastas continuam `wow-survivor-game`; trocar isso é
decisão do dono do projeto, não consequência do handoff.

Survivors-like (Vampire Survivors) com tema WoW, classe Warlock, e um sistema de
build roguelike inspirado em Bloons TD 6 (caminhos de upgrade que trocam a
identidade da peça) e Echoes of Mystralia (composição livre de efeitos).

**O único input em combate é movimento.** Nada é conjurado à mão; toda peça
dispara sozinha pelo seu trigger. Posicionamento é a única decisão em tempo real.

Sem build, sem dependências, sem package.json, sem testes no repo.

## Rodar

```bash
open index.html                 # abre direto no browser (file:// funciona)
python3 -m http.server 8000     # alternativa se precisar de http://
```

`open sprites.html` abre a **galeria de arte**: toda a pixel-art do jogo
(formas do warlock, inimigos, demônios, portão, quadros da explosão, lajes de
chão e destroços) desenhada pelas mesmas funções de render do jogo, com zoom,
troca de fundo, silhueta e flash de dano. Clicar num card copia o `id` do
sprite e os botões copiam a referência pronta (`SPRITE_DATA.ghoul
(js/sprites.js)`) para pedir um ajuste. Sprite sem dono aparece na seção
"Sem uso" — é lá que arte órfã fica visível antes de virar peso morto.

`open icons.html` abre a **folha de contato dos ícones**: as 59 grades em osso
nos três tamanhos em que o jogo as desenha, e a tira de cada eixo acima dos
cards — é na tira que a repetição aparece, e foi ela que denunciou as
primitivas. Peça sem desenho próprio nasce com tarja vermelha.

`open vfx.html` abre a **galeria de animações**: o que cada mecânica DESENHA em
tela. Cada card monta um mundo minúsculo com as mesmas classes do jogo
(`Player`, `Enemy`, `Projectile`, `AreaEffect`, `Minion`, `VfxLayer`) e desenha
na mesma ordem de profundidade de `Game.render()` — evento visual, aura de
spell, gatilho, efeito, hook, debuff, buff, peça, passiva, capstone, demônio e
projétil, cada um tocando sozinho. O valor não está só no que anima: mecânica
sem tell em tela ganha tarja laranja, e o filtro "só o que não anima" lista as
25 que hoje mudam o jogo em silêncio. `driver_gallery` reprova card que estoura,
card mudo e registry que passou na frente da galeria.

`DRIVER=driver_preview.js node tools/harness.js .` escreve
`tools/telas-preview.html`, com as **seis telas de UI** montadas a partir de
builds de verdade: o level-up em quatro estados (build crua, média, tira no teto
e evolução na mesa), a etapa nas duas fases, e HUD, pausa, baú e game over.
Mesmo argumento da galeria: tela que só aparece por segundos, em estados
sorteados, não se revisa jogando — e a etapa carrega a única decisão
irreversível da run.

Verificação = abrir no browser e jogar. Reload manual após cada edit.
Antes de commitar, rode a bateria headless: veja `tools/README.md`.

**Scripts são clássicos (`<script src>`), nunca `type="module"`.** Módulo ES é
buscado com CORS e `file://` tem origem opaca — o browser bloquearia e "abrir o
index.html direto" pararia de funcionar. O preço é escopo global compartilhado e
ordem dos `<script>` significativa (ver o fim do `index.html`).

## Mapa dos arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | CSS, markup e a lista ordenada de `<script src>` |
| `sprites.html` | galeria de toda a arte gerada em runtime — revisão visual, fora do jogo |
| `vfx.html` | galeria de tudo que se mexe: uma cena viva por mecânica, com o que não anima marcado |
| `js/util.js` | helpers puros (`xpForLevel`, `fmtNum`, `hexRgb`, `deepClone`, `setPath`) |
| `js/balance.js` | `BALANCE`, `ENEMIES`, `AXES`, `AXIS_RULES`, `PATH_RULES`, `CLASSES`, `ITEMS` |
| `js/sprites.js` | `SPRITE_DATA`, `STATE_MARKS` + geração de pixel-art, chão e estilhaços |
| `js/engine.js` | `Pool`, `SpatialGrid`, `Sfx`, `InputManager`, `Camera`, `EventBus`, `EVENTS` |
| `js/voices.js` | `VOICES` — o que cada evento visual SOA (o irmão de `js/render/vfx.js`) |
| `js/music.js` | `MUSIC` + `Music` — trilha procedural (a **reserva**) |
| `js/track.js` | `Track` + `Soundtrack` — toca `audio/rain-lofi.mp3`, com fallback |
| `js/assets/sfx-bone.js` | amostra de osso quebrando embutida em base64 |
| `js/entities.js` | `Player`, `Enemy`, `Projectile`, `Minion`, `AreaEffect`, `DotInstance`, `XPOrb`, `Pickup`, `Particle`, `SpawnManager` |
| `js/systems/resolve.js` | registries (`PIECES`, `PASSIVES`, `CAPSTONES`, `MINIONS`) + pipeline de stats |
| `js/systems/effects.js` | `EFFECTS` — o que acontece |
| `js/systems/dots.js` | `DotSystem` — DoT genérico com scheduler por timestamp |
| `js/systems/minions.js` | `MINION_AI` + `MinionSystem` |
| `js/systems/triggers.js` | `TRIGGERS` — quando dispara |
| `js/systems/build.js` | `BuildSystem` — peças, eixos, caminhos, evoluções, passivas, capstones, ofertas |
| `js/hooks.js` | `HOOKS` — a escotilha de escape para o que não cabe em dado |
| `js/content/*.js` | o catálogo: 44 peças, passivas, capstones, demônios |
| `js/render/fx-shapes.js` | `FX_SHAPES` — o gerador de eventos em pixel (`bloom`, `implode`, `nova`, `rip`) |
| `js/render/tiles.js` | `TILE_ROWS` — as 8 lajes do chão, desenhadas em grade de 42x42 |
| `js/render/debris.js` | `PROP_ART` — os 7 destroços em grade, com a paleta de cada um |
| `js/render/scenery.js` | `Scenery` — chão, props por chunk, brasas, vinheta |
| `js/render/vfx.js` | `PIECE_VFX`, `VfxLayer`, `drawMinions`, `drawPieceOverlays` |
| `js/ui-icons.js` | `UI_ICONS` — a grade 16x16 de cada peça, passiva e capstone |
| `js/ui-glyph.js` | `UI_PAL` + `Glyph` — a paleta da UI e o que substitui todo emoji |
| `js/ui.js` | `UI` — HUD, tela de level-up, tela de etapa, pausa, baú, game over |
| `js/game.js` | `Game` — estado, loop, funil de dano, colisões |

Ponto de entrada: `new Game()` no `DOMContentLoaded`, fim de `js/game.js`.

## Arquitetura

### Conteúdo é dado, motor é genérico

Adicionar peça = adicionar entrada em `PIECES` (num arquivo de `js/content/`).
Zero mudança no motor. Mesma coisa para passiva, capstone e tipo de demônio.

Schema de uma peça:

```js
{
  id, key, name, color, axis, axisPoints, tags, desc,
  requires?,      // { piece: "<key>" } ou { tag: "<tag>" } — gate de oferta
  vfx?,           // nome em PIECE_VFX
  evolutionOnly?, // true = só chega por evolução, não entra no sorteio
  stats:   { ... },              // ÚNICA fonte de números
  trigger: { type, ...params },  // só referências "@stat"
  effects: [ { type, ... } ],    // efeitos aninham efeitos
  paths: { a: { name, evolvesInto?, tiers: [T(), T(), T(), T(), T()] }, b, c },
}
```

**O `desc` de uma peça diz o MECANISMO, não o clima.** Ele é o único texto que
explica a spell na tela de etapa — a tela que cobra o ponto que não volta —, e
lá não há rótulo de trigger nem carta de tier para completar a frase. Então a
forma é fixa e vale para peça nova: **como dispara, depois o que faz**, na
ordem em que o jogador precisa. "Mira sozinha", "Aura constante", "Enquanto
você anda", "Enquanto você fica parado", "Quando você toma dano", "Sempre que
você causa dano" abrem a frase; o efeito fecha. O que sobra de espaço vai para
a condição que decide a compra (`requires`, limiar, recarga, teto).

Duas coisas ficam **fora** do `desc`, e as duas por envelhecimento: **número**
(quem diz quanto é `stats`, e a carta imprime o antes → depois resolvido) e
**piada de identidade** ("o arroz com feijão do Cataclismo" não diz se a peça
mira sozinha). Frase de clima não é proibida — ela só não pode ocupar o lugar
da informação.

Demônio é a mesma ideia: a entrada em `MINIONS` (`js/content/minions.js`)
carrega o tuning **e** o visual — `sprite` aponta para uma grade em
`SPRITE_DATA`, `scale` é a altura desenhada em raios e `gait` diz como ele se
mexe (`walk` pisa, `float` paira, `static` fica plantado). Sem `sprite` o
render cai no orbe genérico, que é fallback e não padrão: `driver_render`
reprova tipo de demônio sem sprite próprio. Com uma dúzia deles em campo, a
silhueta é a única coisa que diz o que está ali.

**Demônio que anda por conta própria SEGUE o jogador — não gira em volta dele.**
`MINION_AI._follow` leva cada um a um slot de formação *atrás* do jogador (na
direção oposta à do último movimento), e o `angle` do spawn deixa de ser um
ângulo que cresce para virar só o número do slot no leque. Ângulo que cresce com
o tempo é literalmente o que faz um pet orbitar em vez de acompanhar, e com meia
dúzia deles em campo a órbita lia como decoração girando, não como bicho. Vale
para `chase`, `hunter`, `ranged` e `anchor` — e para o `_returnHome` deles, que
agora é o mesmo passo com zona morta, em vez de um corte seco em 90 unidades que
fazia o demônio tremer na borda.

As duas exceções são de propósito: `turret` (Infernal, Nether Portal, Darkglare)
fica plantado onde nasceu, e `orbit` é o **Voidwalker**, cuja peça inteira é a
órbita — trigger `orbital`, caminho "Órbita", tiers de raio de anel e velocidade
de giro. Ali o giro é a mecânica, não o transporte.

### `key` é a identidade estável, `id` é a aparência

`id`, `name`, `icon`, `trigger` e `effects` mudam na evolução. **`key` nunca.**
É a `key` que serve de `source` no funil de dano, e ela tem três papéis:
chave do medidor de dano, guarda anti-recursão e origem dos eventos. Uma
evolução com `key` diferente da forma base zera o medidor e quebra os efeitos
ligados à fonte — o validador do harness rejeita isso.

### O pipeline de stats

```
piece.stats (base)
  → mods dos tiers comprados, na ordem dos tiers
    → mods das passivas globais que casam com `match`
      → mods do capstone ativo
        → patches estruturais em trigger e effects
          → resolução das referências "@stat" para números
```

Roda **uma vez por aquisição**, não por tick; o resultado fica em `inst.r`.
Em runtime nenhuma string é parseada e nenhum objeto é alocado por frame.

Duas consequências:

1. **Números só existem em `stats`.** Trigger e efeitos apontam com `"@nome"`,
   `"@nome*3"`, `"@nome+2"`. Escrever um número cru em `trigger`/`effects` faz o
   tier que mexeria naquele valor deixar de ter efeito.
2. **Cada caminho de upgrade escreve em índices reservados.** Dois caminhos que
   escrevem `effects.1` colidem e o último comprado vence. Reserve faixas
   (caminho A → `effects.2`, B → `effects.4`, C → `effects.6`) e lembre que a
   lista fica **esparsa**: qualquer laço sobre `effects` precisa de `if (!e) continue`.

### Trigger é o que diferencia as peças

Com input só de movimento, é o trigger que decide como a peça reage ao
jogador — `rooted` pune andar, `trail` premia andar, `aura` premia ficar no
meio da horda, `auto_target` não pede nada. Trocar `trigger.type` por dado muda
o comportamento sem tocar em código: é literalmente o que a evolução faz.

Todo agendamento usa `game.clock` (relógio de simulação). **`update(dt)` roda
várias vezes por frame** (sub-stepping) — um trigger que contasse frames
dispararia 2–4× por frame em timeScale 3x.

### `damageEnemy(e, amount, key, big, dotKey)` é o funil

Todo dano em inimigo passa por aqui. Enquanto os eventos de um acerto estão
sendo despachados, a `key` fica em `game._chain` e um trigger reativo daquela
mesma key não dispara. É a generalização do antigo `source !== "corruption"`:
sem ela, um DoT que aplica DoT trava o browser. `MAX_FX_DEPTH` é o backstop.

### O DoT pode vencer com o corpo, e é `clear()` que cobra

`onExpire` é o que um DoT faz quando o prazo acaba. Ele sozinho não sustenta
uma peça cujo dano inteiro mora na detonação final: nesta horda — densa,
frágil, morrendo em leva — o alvo quase nunca sobrevive ao próprio tique, e a
peça vira uma promessa que o campo cancela. `expireOnDeath: true` no efeito de
DoT inverte isso: a conta vence do mesmo jeito quando o corpo cai antes.

Três regras que caem daí:

- **Quem roda é `DotSystem.clear()`, não o `update`.** `killDeadEnemies` limpa
  os DoTs do morto no mesmo frame em que ele cai, então o laço de update nunca
  vê aquele DoT de novo. Pôr a chamada lá dentro seria escrever código morto.
- **A morte não emite `DOT_EXPIRED`.** Esse fato é "a conta venceu num alvo
  **vivo**", e é o que Contágio e Chamador escutam; emiti-lo numa morte os
  faria disparar duas vezes no mesmo corpo, junto de `ENEMY_KILLED`.
- **É dado, não peça.** Qualquer DoT do catálogo pode declarar o campo; hoje
  quem declara é `soulRupture`. `driver_dot` cobra os dois lados — que detona
  com o corpo, e que um DoT normal continua morrendo calado.

### Marcar e varrer, nunca remover no meio do laço

Um efeito disparado durante a varredura de um pool pode acrescentar entidades
**ao mesmo pool** — DoT que aplica DoT, projétil que gera projétil, demônio que
invoca demônio. Com `release()` dentro de um laço que cresce, o índice nunca
alcança o fim e o frame trava.

Padrão obrigatório nesses laços: congelar `const n = list.length`, iterar até
`n` marcando `dead = true`, e no fim chamar `pool.sweep(DEAD)`. Vale para
`dots`, `projectiles`, `areas`, `minions` e `enemies`.

### Consultas espaciais

`SpatialGrid` é limpo e reconstruído dentro de `updateEnemies`, que roda **antes**
de `build.tick`. A ordem das chamadas em `Game.update` é significativa.

`nearestEnemy`/`nearestEnemies`/`nearestRangedEnemy`/`nearestEnemyExcept` passam
todas pelo grid — nada de varredura linear sobre `enemies.active`.

### Canvas desenha o mundo, DOM desenha a UI

O sistema de efeitos **nunca** chama `ctx.`: ele emite `game.emitVfx(kind, x, y,
r, color)` e `js/render/vfx.js` consome. HUD, cartas, pausa, baú e medidor de
dano são HTML, atualizados por `js/ui.js`. Elemento novo de UI = markup no
`index.html` + ref em `UI.el`.

A ordem das chamadas em `Game.render()` **é** a ordem de profundidade.

### A identidade da UI: osso gravado em obsidiana

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
| R5 | **Ícone sai do gerador do mundo** | Nenhum emoji, em lugar nenhum — nem no canvas (o item no chão também era `fillText` de emoji). |

Quatro testes para tela que ainda não existe: **some a cor, ainda funciona?** ·
**conte os elementos saturados** (mais de três, ou mais de um botão cheio, e a
hierarquia caiu) · **a silhueta identifica a tela** desfocada a 20px ·
**nada abaixo de 14px, nada arredondado**, alvo de clique de 44px.

Um `grep -nE 'border-radius|text-shadow|blur|gradient|backdrop' index.html` é
metade da verificação. A única `border-radius` permitida é o tile **redondo da
passiva**, que é a forma que separa "não dispara" de "spell" sem usar cor.

#### O glifo: um desenho por peça, e a primitiva só para o que não tem

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

#### As quatro espécies de botão: preenchimento é custo

É a regra que resolve "nada diz qual botão não volta".

| Espécie | Significado | Onde |
|---|---|---|
| **fantasma** (borda osso, fundo transparente) | reversível, não cobra nada | `Escolher` no level up |
| **osso** (fundo `--osso-600`) | neutro forte, cobra atenção | `Iniciar`, `Continuar`, `Tentar de novo` |
| **selo** (fundo na cor do eixo, peso 900) | **irreversível, cobra um ponto de eixo** | **só na etapa** |
| **recuado** (borda `--obs-500`, hover vermelho) | destrutivo, não convida | `Reiniciar`, `Sair` |

**Nunca dois botões cheios na mesma tela.** O selo é o único botão do jogo
pintado com cor de eixo, e ele só existe na tela que cobra o ponto que não
volta. Antes a pausa tinha três pílulas roxas idênticas — sair convidava tanto
quanto voltar ao jogo.

#### A reserva do warlock

`--osso-600` puro (`#EDE7DA`) é **exclusividade do warlock no canvas**. Nenhum
outro sprite, vfx, partícula ou item usa osso cheio — é por isso que o item no
chão é `--osso-400`/`--osso-500` e não branco. Com a build inteira acesa o
jogador perdia de vista a única coisa que controla; ele passa a ser a única
coisa branca em tela. Não é mais luz: é **reserva**.

#### O HUD: cinco lugares, e nada no meio

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

### Um grid de pixel, e todo mundo dentro dele

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

### Hierarquia de leitura: o personagem primeiro

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

### Impacto: o acerto tem que aterrissar, não só acontecer

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

### A morte: o corpo se desfaz, e a leva se anuncia

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

### O gerador de formas: uma máquina, quatro eventos

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

### A forma mora no EFEITO, não na peça

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

### Nenhuma cor cravada no render

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

### As quatro batidas: antecipação e resíduo

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

### Fatia, não desenho novo

Depois que as quatro formas existiram, três grupos de peças continuavam
idênticos — e **nenhum deles precisou de um desenho novo**. Precisaram de um
parâmetro declarado no dado, do mesmo jeito que a paleta resolve "duas
criaturas do mesmo material diferem por QUAIS três passos da rampa".

| o que dura | a fatia | quem lê |
|---|---|---|
| casca de escudo | `veil: { sides, spin, thick, spikes }` | `EFFECTS.shield` → `Player.setVeil` |
| zona no chão | `look: "fire" \| "rot" \| "ash"` | `EFFECTS.area_persistent` → `AreaEffect.draw` |
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

**Estado final: 43 peças, 43 assinaturas distintas, zero mudas.** Nenhuma peça
do jogo desenha o mesmo que outra, e `driver_vfx` reprova a primeira que voltar
a colidir.

### Mecânica que cobra, avisa

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

### Balanceamento: mais corpos, menos vida cada

O eixo do tuning é a **sensação de rampagem**. Um inimigo que exige três tiros
não dá dopamina; vinte que caem no mesmo pulso, sim. Por isso a horda é densa e
frágil (`maxAlive` alto, `hpGrowth` baixo) e a **ameaça mora no chefe**
(`bossHpExp` alto). Baixar o HP do lixo sem subir o do chefe tira o perigo do
jogo inteiro — medido: zero mortes em 9 runs, vida em 100% do começo ao fim.

Três armadilhas que a medição pegou:

- **A curva de XP tem realimentação.** Íngreme demais → menos escolhas → build
  fraca → menos abates → menos XP. Entre nível 124 e nível 10 havia um décimo
  de diferença no termo quadrático. Por isso ela é cúbica: barata cedo (o
  bola-de-neve pega) e cara tarde (existe teto). Mexer aqui pede
  `driver_balance`, não intuição.
- **Dreno permanente sem input mata.** `self_damage` nunca reduz abaixo de um
  piso: sem botão para desligar, dreno letal vira carta-armadilha — Burning
  Rush sozinha respondia por 4 de cada 5 mortes antes dos 3 minutos.
- **Zerar carga ao andar mata a peça.** `rooted` drena em vez de zerar: num
  survivors você corrige posição o tempo todo, e o reset binário deixou
  `rainOfFire` com 0% de dano em 9 de 9 runs.

Evolução e capstone são o clímax da progressão. Se a medição mostrar que um
perfil que MIRA não chega lá, o problema é de OFERTA e não de números — e as
alavancas mudaram de lugar junto com o custo: hoje são `BALANCE.milestones`
(`unlockAt`, `axisPoints`, `every`) para o capstone, e a ordenação do baú em
`UI.openChest` para a evolução. O peso de caminho já iniciado em `getOffers`
saiu: ele era muleta para um bolo poluído por peças novas, que não existe mais.

**O dano do jogador DOBROU no catálogo inteiro** — `damage`, `dps`, `dotDps`,
`blast` e `impDamage` de toda peça, evoluções e demônios junto. É a outra
metade da dobra que o elenco de inimigos levou: as duas coisas que se encostam
no funil de dano tinham que andar juntas.

O que ele conserta e o que ele **não** conserta, medido (`driver_balance`,
4 runs x 5 políticas, mesmas seeds):

| | antes | com o dobro |
|---|---|---|
| dano por run (mediana, `focado`) | 25k | **44k** |
| sobrevivência mediana | 1:54 – 4:03 | 1:49 – 2:06 |
| runs que morrem antes dos 3 min | 15/20 | 17/20 |

O dano sai do lugar; a **sobrevivência não**, e a razão é que ela nunca foi
limitada por dano. Ela é bimodal por política, e continua sendo: as que ceifam
cedo (`aleatorio`, `agressivo`) ocasionalmente engatam a bola de neve e chegam
aos 11 min com 40 mil abates, as outras morrem aos dois minutos em quase toda
mão — e o dobro de dano não move nenhuma das duas pontas. Quem mata o piloto aos dois minutos é `touchDps` dentro da
parede de 4400 corpos, e nenhuma quantidade de dano de saída compra tempo
contra encosto — o jogador morre com a horda no chão em volta dele. As
alavancas para devolver run continuam sendo as declaradas no bloco de
`ENEMIES`: `touchDps` nos corpos comuns e `hardDmgGrowth`, que compõe em cima
deles a cada 15s depois de `hardAt`. Enquanto elas não mexerem, evolução,
capstone e metamorfose seguem sendo coisas que a run não vive para ver.

Medir por média das políticas engana aqui. `driver_balance` roda cinco perfis, e
três deles (`aleatorio`, `amplo`, `agressivo`) **não miram por construção** —
não chegar ao capstone é o preço declarado deles, não uma regressão. Quem
responde pela saúde do clímax são `focado` e `misto`.

### O corpo do warlock conta a progressão: capstone vira forma, spell vira aura

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

### Regras estruturais que forçam comprometimento

- Pool de **20** pontos de eixo, teto de **15** por eixo → impossível maximizar dois.
- **Ponto de eixo só vem de etapa.** Level-up não cobra nada e o baú entrega tier
  — as duas moedas nunca mais disputam a mesma escolha (ver "As duas batidas").
- No máximo **2** caminhos por peça passam do tier 2 → impossível maximizar três.
- **Tier 3, 4 e 5 pedem 5, 10 e 15 pontos no eixo DA PEÇA** (`PATH_RULES.axisGate`)
  → impossível ter uma spell fechada sem ter escolhido um eixo. Os três números
  são os limiares de capstone (`hybridSide`/`hybridMain`/`pureAt`), então o tier
  5 custa a mesma pureza que o capstone puro, e `freeTier` deixa de ser uma
  segunda regra: os dois tiers de graça são exatamente os que o gate não cobra.
- Passivas podem declarar `exclusive` → `Fúria Contida` e `Pés de Cinza` nunca coexistem.
- Peça com `requires` só é oferecida depois que a habilitadora está na build.
- **O kit inicial é UMA peça só**, e ela entra **de graça**
  (`acquirePiece(id, true)`), para o pool de 20 ficar inteiro para as escolhas
  do jogador — e a spell que vem numa etapa também, porque o eixo dela já foi
  pago pelo ponto que a carta deixou de dar. No warlock é `incinerate`: o tiro
  que persegue sozinho e não pede nada do jogador, que é o que uma peça
  entregue antes de qualquer escolha tem que ser.
  Duas peças davam meia identidade de graça — quem nascia com Corruption
  nascia com o eixo escolhido, e a primeira etapa deixava de ser descoberta
  para virar confirmação. Com uma só, as três spells sorteadas da fase fechada
  voltam a ser a primeira coisa que diz para onde a run vai.
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

### As duas batidas: level-up aprofunda, etapa compromete

O jogo tem **duas telas de escolha**, com ritmos e perguntas diferentes, e elas
não podem voltar a ser uma só.

| | Level-up | Etapa |
|---|---|---|
| **Quando** | subiu de nível (~17–70 por run) | marco de tempo, a cada `every` enquanto sobrar ponto |
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
  ela só passou a ter preço, e o preço é uma build inteira presa no tier 2.
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

### A tela de etapa: duas fases, e a virada é o comprometimento

`BALANCE.milestones` é o dado inteiro, e a primeira coisa a saber é que **não há
tabela de pontos por marco**. A rampa é *emergente*: o quanto uma etapa vale sai
do estado da build, não de uma coluna de números.

Marco de **tempo** e não de chefe: o primeiro Dreadlord só nasce aos 5 min e
depois vem a cada 2:30, então metade da run ficaria sem marco e a única decisão
irreversível chegaria tarde demais para ser mirada. `#msClock` no HUD conta para
o próximo — marco que chega sem aviso não estrutura ritmo nenhum.

**Quem para as etapas é a POOL, não uma contagem de marcos.** `every` continua
disparando enquanto `axisLeft > 0`. Enquanto uma lista fixa era o fim da linha,
quem levava spell terminava a run com ponto no bolso e nenhuma tela para
gastá-lo — medido, runs acabando em **12/20 e 13/20**, com ponto aparecendo no
painel que o jogo nunca entregava.

#### Fase fechada: três spells sorteadas

Antes de qualquer eixo chegar a `unlockAt`, as três colunas são **spells
sorteadas do catálogo inteiro** — podem cair três do mesmo eixo. Não existe
oferta seca: a única maneira de ganhar eixo é escolhendo uma spell, e cada uma
carrega `spellPoints` para o eixo **dela**.

Isso faz o começo da run ser **descoberta e não mira**. O jogador ainda não sabe
o que a run vai oferecer, e escolher spell é como ele descobre — o eixo cresce
como consequência do que ele achou bom, não como uma aposta feita no escuro.

#### Fase aberta: o eixo comprometido vira slot fixo

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

#### Cadência: sai da conta, não do gosto

Pool 20; quem abre um eixo cedo gasta ~5 marcos a 1 ponto e o resto a 2, e as
linhas sorteadas nem sempre oferecem o eixo alvo — na prática **~15 marcos**. A
`every` 40s isso fecha em **10:00**, logo antes de onde uma run competente
acaba. `driver_milestone` refaz essa conta em vez de confiar no número: se a
pool só fechasse depois dos 11 min, ele reprova, porque **marco entregue depois
da morte não entrega nada**.

#### Apresentação

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

#### O que essa forma custa, medido

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

### A tela de level-up: três cartas em coluna

Três **cartas verticais** lado a lado, e abaixo uma tira com a build de agora.

**Ela já foi três linhas, e a razão era boa enquanto valia.** Enquanto a tela
oferecia três coisas *diferentes* — spell nova, melhoria, passiva —, comparar
significava correr o mesmo campo nas três, e linha com colunas fixas (o que é /
o que muda / custo) é a forma que deixa o olho fazer isso na vertical. Depois
que spell nova mudou para a tela de etapa, as ofertas viraram a mesma coisa: um
degrau numa spell que o jogador já tem. Grade de três colunas para comparar
campos que não divergem mais é só moldura, e a coluna de custo já tinha virado
progresso porque não havia mais custo.

**A hierarquia interna é a regra que sobrevive à mudança de forma:**

1. **`.lv-plain`, 19px** — o que muda no jogo, o item mais claro da carta.
2. **o delta** logo abaixo, com o número que o jogador vai passar a ter.
3. nome da spell, subtítulo e etiqueta de tipo — um degrau abaixo.
4. `.lv-why`, ícone, pips e botão — o fundo da pilha.

Numa carta o nome vem **antes no espaço**, então ele tem que perder no
**tamanho** — senão a leitura pousa no rótulo em vez de no efeito, que é
exatamente o defeito que esta tela já corrigiu uma vez. `driver_cards` reprova
carta sem `.lv-plain`.

Regras que continuam valendo:

- **O slot do nome carrega a SPELL, não o nome do tier.** O jogador reconhece
  "Incinerate" de imediato; "Brasa" não quer dizer nada até ser lido. O nome do
  tier desce para o subtítulo. Em evolução o nome é a **forma nova**.
- **A carta inteira é clicável, então o botão é lembrete e não alvo** — vazado
  em repouso, enche no hover. Na tela de **etapa** é o contrário, e de
  propósito: lá os botões *são* a decisão, porque cada um carrega um número
  diferente que precisa ser comparado antes de mirar o mouse.
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
- **Veredito, não coordenada.** O subtítulo já diz "caminho · tier N de 5"; o
  rodapé da carta diz o que aquilo *significa* (`Fecha o caminho` / `A um tier
  do fim`).
- **`.lv-why` só aparece quando acrescenta.** Na linha ele carregava sempre o
  que a spell é, porque a coluna existia de qualquer jeito. Numa carta o nome
  está logo acima e repetir a identidade é ruído — sobram os dois casos em que
  há informação nova: passiva **exclusiva** (fecha uma porta) e **evolução** (a
  peça troca de identidade inteira).

**Passiva só entra a partir do nível `BALANCE.levelup.passiveAt`** (10). Uma
passiva não constrói nada sozinha — ela **multiplica** o que já está lá
(`pieceMods` sobre um `match`). Oferecida no nível 2, com duas spells no tier 0,
ela multiplica quase nada, e pior: ocupa uma das três cartas disputando com o
tier que abriria a trilha. São oito passivas para uma run de dezenas de níveis,
então adiar não custa variedade — custa só o começo, que é onde a spell precisa
de tier e não de multiplicador.

**E `pendingLevels` sai da conta.** O nível que importa é o que *esta* escolha
paga, não o topo da fila — é a mesma leitura que o rótulo da tela já faz. Sem
descontar, chegar ao nível 10 de uma vez faria a primeira carta (a que paga o
nível 8) oferecer passiva, e a trava de dez viraria uma de oito. `driver_cards`
cobra as duas pontas: nível 1 sem passiva, e nível 10 com fila de 3 também sem.

**Nenhum texto novo por tier.** São 645 tiers no catálogo — escrever "antes →
depois" à mão em cada um seria conteúdo que envelhece no primeiro
rebalanceamento. Tudo o que a carta mostra sai do que já existe:

| Campo da carta | De onde vem |
|---|---|
| frase principal | `tier.desc` / `def.desc` — já são frases em pt-BR |
| antes → depois | `tier.mods` aplicado a `inst.r.stats` (`UI.tierDelta`) |
| onde chega | `tierIndex` contra `PATH_RULES.tiers` |
| porquê | só em evolução e passiva exclusiva |
| chip na cor do eixo | fecha um caminho (acende a aura) |
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
- **Chip de recomendação só com gancho real.** Sobrou um, e é o certo: fechar um
  caminho acende a aura. O de capstone migrou para a tela de etapa — apontar
  para ele numa tela que não entrega ponto de eixo seria apontar para uma porta
  que está na outra sala.

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

### A paleta mestre: uma paleta, não dezenove

Antes da `PAL` (`js/sprites.js`) havia **108 hexes distintos em 18 sprites, com
quase zero reuso**: cada criatura tinha inventado o próprio roxo, o próprio
osso, o próprio quase-preto. Um conjunto pintado assim lê como dezoito assets
avulsos e não como a arte de um jogo — e o defeito é invisível olhando um
sprite por vez, que é exatamente como se acrescenta um sprite.

Hoje são **47 cores**, organizadas em rampas compartilhadas, e três regras que
`driver_palette` cobra:

**1. Matéria é dessaturada, energia é saturada.** A ponta saturada da paleta
(`fel`/`arc`/`pyr` — que vêm *referenciadas* de `AXIS_PALETTE`, não copiadas)
é de olho, runa e fogo. **Nunca de corpo.** É a metade de sprite da hierarquia
de leitura acima: com quarenta corpos em tela, a spell só se destaca se os
corpos não estiverem competindo com ela. O driver cobra o teto de **14% dos
pixels** por grid. Corpo pintado em verde-fel é corpo que parece spell — foi o
que o felhunter era, com 38%, e por isso as antenas dele viraram matéria.

Duas exceções declaradas, e as duas são a mesma exceção — *o brilho é o
assunto*: o `portal` (a boca **é** a magia) e o `darkglare` (o olho **é** a
criatura). Elas moram nomeadas no driver, com o motivo escrito. Qualquer
terceira precisa do mesmo argumento.

**2. Rampa desloca matiz, não só escurece.** Toda rampa escurece **em direção
ao violeta** e clareia **em direção ao creme**. Rampa de matiz fixo que só
perde brilho é o tell mais claro de pixel art amadora: lê como a mesma tinta
sob menos luz, e não como superfície iluminada. O driver reprova rampa com
menos de 8° de deslocamento — e isenta as três famílias de eixo, que são
identidade de build e não são nossas para re-matizar.

**3. Rampa é compartilhada, a fatia não.** Uma criatura toma três passos
consecutivos de uma rampa; duas criaturas do mesmo material diferem por
**quais** três. O ghoul pega `rot0..rot2` e o vilefiend `rot1..rot3`, então
leem como a mesma carne em estágios diferentes em vez de dois verdes sem
parentesco. Mesma coisa com voidwalker (`void0..2`) e felhunter (`void1..3`).

Junto disso:

- **Contorno é uma das três tintas** (`inkCold`/`inkDeep`/`inkWarm`), escolhida
  pela temperatura do corpo — nunca o passo mais escuro da própria rampa, senão
  a sombra desaparece dentro da silhueta.
- **A luz vem de cima-à-esquerda, em todo sprite.** É a única regra de arte com
  assinatura mensurável, e o driver a mede: a metade de cima da rampa tem que
  ser mais clara que a de baixo. O esqueleto é a exceção tolerada — membro de
  1px de espessura é todo borda, e o sombreamento não tem onde acontecer.
- **Cor de matéria sem uso é peso morto** e o driver reprova: a paleta estaria
  dizendo que o conjunto tem uma cor que ele não tem.

**O vocabulário de char é compartilhado entre todos os grids**, então qualquer
grade se lê sem consultar a chave dela: `o` contorno, `d`/`m`/`l` a rampa
principal (sombra/base/luz), `D`/`M`/`L` uma segunda rampa, `b`/`B` osso,
`s`/`S` metal, `e`/`E` energia e seu núcleo, `f`/`F` fogo.

**Volume vem de duas coisas, e nenhuma é cor.** Luz de borda (a fileira que
toca o vazio por cima ou pela esquerda sobe um passo) **e oclusão** (as duas
fileiras de baixo de uma massa descem um passo). Sem a segunda, corpo largo
continua um retângulo chapado por mais bonita que seja a rampa — foi o que
manteve o voidwalker e o dreadlord como blocos até a oclusão entrar.

**E quando nem isso salva, o problema é a grade.** Dois sprites não tinham
conserto por cor: o esqueleto (órbitas pintadas *por cima* do osso em vez de
serem buracos, costelas sem vão) e o dreadlord, que é **chefe** e ocupava 16×14
— menor que o dreadstalker que o próprio jogador invoca. Ameaça se lê como
tamanho e silhueta antes de se ler como cor: ele foi redesenhado em 22×19, com
asas abertas, e o `art` dele subiu de `2.21` para `3.0` — o degrau exato para
19 linhas, pela mesma regra de `ENEMIES.art`.

### Sprite novo: a imagem gerada é referência, nunca o asset

O fluxo é gerar uma imagem num modelo, ler dela, e desenhar a grade. Duas
ferramentas em `tools/` seguram as duas pontas — `make_sprite_prompt.py` emite
o prompt **com a `PAL` viva dentro dele**, e `image2grid.py` traz a imagem de
volta como primeiro passe de grade. Detalhe de uso em `tools/README.md`.

O que importa aqui é *por que* o prompt é como é:

- **Nunca peça "pixel art".** Modelo de imagem devolve pixel art falsa —
  suavizada, fora de grade, com centenas de cores e célula de tamanho
  irregular. Como referência isso é pior que uma ilustração limpa em alta
  resolução, porque convida a copiar pixel que mente. O prompt pede o oposto:
  desenho grande e limpo, e diz explicitamente para não pixelizar.
- **Peça cel shading de exatamente três valores por material.** É o pedido de
  maior retorno da lista inteira: três valores com borda dura mapeiam 1:1 na
  rampa `d`/`m`/`l`, então ler a imagem vira classificar região em vez de
  julgar gradiente.
- **Luz do topo-esquerda, sempre**, porque é a regra do jogo e `driver_palette`
  a mede.
- **Fundo `#FF00FF` chapado.** Nada na `PAL` chega perto de magenta, então o
  recorte é exato. Sombra no chão, vinheta e cenário voltam como pixel de corpo.
- **Proibir brilho é tão importante quanto pedir a pose.** Glow, bloom, faísca e
  sombra projetada vazam para fora da silhueta e destroem justamente a
  informação que se foi buscar ali — onde a criatura termina.
- **Proporção exagerada, não realista.** Cabeça a um terço da altura, mãos e
  arma grandes. Anatomia correta vira mingau a 16px.
- **A fatia da rampa entra no prompt.** Pedir "verde" devolve um verde qualquer;
  pedir `rot0/rot1/rot2` com os hexes devolve algo que já nasce dentro da
  família — e o script lê os hexes da `PAL` em vez de guardar cópia, porque
  prompt com paleta velha é pior que prompt nenhum: ele pede em silêncio uma
  cor que o jogo não tem.

E a regra que não muda: **a imagem é referência, o asset é a grade.** A 16
pixels de altura cada pixel é uma decisão, e média é o contrário de decidir —
por isso `image2grid` vota num token por célula em vez de tirar a média (média
de dois passos de rampa é uma cor que a paleta não contém), e por isso o que
ele imprime é ponto de partida para discussão, não resultado.

### Uma build, uma família de cor

Cada eixo é uma família de cor, e as três ficam longe uma da outra em matiz:
**corrupção verde, domínio roxo, cataclismo laranja**. Vermelho saiu do jogo —
ao lado do laranja, em movimento, os dois liam igual e a tela deixava de dizer
de qual build era o efeito.

`AXIS_PALETTE` (`js/balance.js`) é a fonte única: três tons por família —
`base` para as peças de assinatura, `light` para as barulhentas (evoluções,
detonações, capstones puros), `deep` para maldição e defesa.

- **Peça, capstone e todo `color:` dentro de efeitos** usam um tom da paleta do
  próprio eixo. O driver padrão recusa qualquer cor fora dela, e recusa também
  duas famílias com menos de 60° de matiz entre si.
- **`PIECE_VFX` não escolhe cor.** Ele recebe `p.color`/`p.rgb`, que é a cor da
  peça — é isso que faz o warlock brilhar na cor da build. Hardcodar hex num
  vfx quebra a regra em silêncio.
- **Hook e método do `Game` também não.** A cor sai de `c.color`, ou de
  `CAPSTONES[id].color` / `PASSIVES[id].color` quando não há contexto.
- Demônios (`MINIONS`) e passivas ficam fora da regra de propósito: demônio é
  criatura, com sprite e cor próprios; passiva é global, não é build.

Classe nova segue a mesma regra: as builds dela precisam ter contraste entre si.

### Áudio: agendado no relógio do AudioContext, não no do jogo

Efeitos e trilha são gerados em runtime. Duas regras que não dá para violar:

- **Nada é marcado para "agora".** O `requestAnimationFrame` varia de 8ms a 30ms
  por frame; nota marcada no instante em que o frame roda chega sempre atrasada e
  desigual. `Music.update()` só empurra uma fila com `lookahead` de 250ms — quem
  toca no tempo certo é o hardware de áudio. Por isso a trilha também **ignora
  `timeScale`**: ela vive em tempo real.
- **`exponentialRampToValueAtTime` precisa de alvo e valor inicial > 0.** Rampa
  partindo de zero é inválida; `_burst`/`_sweep`/`_voice` fazem `if (vol < 0.0005) return`.
- **`setState` para o mesmo estado é no-op.** `Music` nasce em `"off"`, não em
  `"menu"` — nascer já no estado de destino fazia o primeiro `setState("menu")`
  não ligar nada e o menu ficava mudo.

A intensidade da trilha (`Game.musicIntensity`) vem do estado real da run —
tempo, fase dura, chefe em campo — nunca de um contador próprio da música.

#### As vozes: um fato, duas consumidoras

`game.emitVfx(kind, ...)` alimenta **as duas** camadas — a que desenha
(`js/render/vfx.js`) e a que toca (`js/voices.js`). **Não existe registry de som
por peça**, e não pode existir: seriam duas listas para divergir, e a que
envelhecesse deixaria uma peça muda sem ninguém notar. Evento visual novo exige
voz nova, e `driver_vfx` reprova evento sem ela.

Dois fatos não têm evento visual e por isso são chamados à mão: **`cast`** (o
conjuro em si não desenha nada — quem desenha é o efeito) e **`hit`/`crit`** (o
acerto sem raio só acende o flash branco do inimigo). Eles moram em `VOICES`
sem par em `VFX_LIFE`, e o driver conhece a exceção pelo nome.

Quatro regras, e as quatro existem porque uma build madura põe dezenas de
eventos por segundo em tela:

- **Gap por voz, não global.** `VOICES.<nome>.gap` é o intervalo mínimo entre
  duas emissões daquela voz — mesma ideia do `hitstop.cooldown`. Ele é por voz
  porque a densidade tolerada é diferente: o estalo do acerto pode ser denso, o
  rasgo do portal não.
- **Duck por leva.** Nenhum gap individual segura dezenas de vozes *diferentes*
  no mesmo segundo; o que segura é a leva inteira abaixar, exatamente como
  `death()` já fazia com `_deathBurst`.
- **Dano contínuo não fala.** Tique de DoT e de zona cobram por sub-step
  enquanto durarem — um estalo por cobrança viraria metralhadora justo quando a
  horda fecha. Quem toca é evento **discreto**: acerto de projétil, dano
  instantâneo, `big`. É a mesma regra que os mantém fora do hitstop.
- **Distância corta antes de agendar.** Além de `SFX_RANGE` a voz não é nem
  criada, e a raiz quadrada da distância só é paga depois que o gap deixou
  passar (`Sfx.can` é a metade barata de `say`).

Tudo passa por um **barramento com compressor** (`Sfx._buildBus`). Não é
polimento: é o que torna possível dar voz a cada peça. Cinquenta acertos no
mesmo frame somam amplitude linearmente e estouram o master; com o compressor a
leva é empurrada para baixo junta, e o que se perde é volume, não informação.
Sem ele o caminho seria abaixar cada voz até ela sumir sozinha — o contrário do
que se foi buscar ali.

### Cenário: determinístico por posição, nunca por ordem de visita

O mundo é infinito e gerado em runtime. Duas regras:

- **Props saem de `hash2(chunkX, chunkY)`**, não de `Math.random()` na hora de
  desenhar. Voltar andando para o mesmo lugar tem que mostrar os mesmos
  destroços; senão o mundo "reembaralha" nas costas do jogador e a leitura de
  espaço vai junto.
- **Nada de gradiente por frame em código quente.** Os props eram desenho
  vetorial e criavam `CanvasGradient` dentro do laço — sessenta alocações por
  segundo por pedra. Hoje são grade (`PROP_ART`, `js/render/debris.js`) e o
  canvas de cada um é feito uma vez.

Os destroços seguem a mesma virada das lajes, e cobram duas regras a mais
porque prop é objeto e não fundo:

- **Um tamanho só, e ele é 1 célula = 1 pixel de buffer.** O desenho vetorial
  aceitava `s` contínuo entre 0,7 e 1,45; grade aceita degrau, e o único degrau
  que não briga com o resto do elenco é o 1:1 — prop em `step 2` é o mixel
  silencioso. A escala saiu do sorteio do chunk junto com a rotação: girar
  grade fora de 90° é reamostrar.
- **Variação é o espelho**, dois lados por tipo, e o cache passa a ser finito
  por construção (tipo × espelho), sem `PROP_BUCKETS`.
- **Sprite não carrega brilho nem sombra.** `PROP_SHADOW` diz quem projeta
  elipse (só quem fica em pé) e `PROP_GLOW` diz o que acende por cima, com a
  cor vindo de `AXIS_PALETTE`. Desenhados na arte, halo e sombra vazam para
  fora da silhueta e apagam onde o objeto termina.
- **Paleta declarada é contrato**: `driver_render` reprova char sem cor e cor
  sem char, que é a mesma regra de "cor de matéria sem uso é peso morto".

O chão usa 8 variantes de laje escolhidas por hash da célula: um tile único
repetido é o que mais denuncia cenário procedural barato. As oito são **dado**
(`TILE_ROWS`, grade de 42x42 em tokens da PAL) e não mais ruído gerado, e três
regras vieram junto — todas visíveis no instante em que são quebradas:

- **Estrutura sim, mancha não.** Uma laje é vista quarenta vezes na mesma tela.
  Junta, fenda e grão repetem sem incomodar; uma face mais clara que as outras
  vira pastilha acesa carimbada pelo chão inteiro. Foi o que a referência
  entregou, e o conserto foi passar um high-pass em cada laje antes de
  quantizar: o que sobrevive é o que tem borda, o que morre é o nível.
- **Laje com marca é rara.** Veio de fel e runa são a coisa mais reconhecível do
  chão; sorteadas uniformemente, saem numa célula a cada oito e o olho acha a
  treliça na hora. `TILE_BAG` pesa cinco de pedra lisa para uma marcada, e a
  lista de marcadas sai do próprio dado (`TILE_MARKED`), não de uma lista à mão.
- **Oito ainda são oito carimbos.** O espelho (bit 0 horizontal, bit 1 vertical)
  é inteiro — não reamostra, então não sai do grid — e devolve 32 leituras a
  partir de 8. É o que quebra a repetição do grão caindo sempre no mesmo ponto.

`driver_render` cobra as três, mais o teto de 3% de energia no chão: se a laje
brilhar tanto quanto uma spell, a spell para de significar alguma coisa.

`Scenery.corruption` (0..1) vem de `elapsed / hardAt` e faz o mundo apodrecer
junto com a run — veios mais vivos, mais brasa no ar, vinheta mais fechada.

### Assets: dois, e ambos com plano B

Sprites, chão, efeitos sonoros e a trilha de reserva são gerados em runtime.
**Não adicione arquivos de imagem.** Os dois assets de áudio que existem seguem
regras diferentes, e a diferença é `file://`. Nenhum dos dois vem de banco de
sons: a trilha é sintetizada por `tools/make_track.py` — **inclusive a chuva**,
que é ruído modelado no espectro e não gravação de campo — e o estalo de osso
está embutido; não há licença de terceiro a conferir em nada que o jogo toca.

| Asset | Como carrega | Por quê |
|---|---|---|
| `audio/rain-lofi.mp3` (trilha) | `<audio src>` em `js/track.js` | `fetch`/XHR são bloqueados em `file://` (origem opaca); elemento de mídia com caminho relativo carrega. Volume por `.volume`, não por GainNode — `createMediaElementSource` sobre mídia de origem opaca sai em silêncio. |
| osso quebrando (efeito) | base64 → `atob` → `decodeAudioData` | Precisa sobrepor e variar de tom dezenas de vezes por segundo; `<audio>` não dá isso. Base64 não passa por rede, então funciona em `file://`. 21 KB. |

**Os dois têm fallback e o jogo nunca fica mudo:** `Soundtrack` cai para a
trilha procedural se o mp3 não carregar (e a procedural cobre o menu enquanto
o arquivo baixa), e `Sfx.death` volta aos estalos sintéticos se a amostra não
decodificar. Os drivers `driver_track` e `driver_audio` testam esses caminhos.

**Modo de repetição da trilha.** `Track` tem dois, e escolher errado estraga a
faixa. `seamless` (padrão) usa `loop = true` nativo, para faixa montada para
emendar — é o caso da atual, que fecha em si mesma por construção (32 compassos
exatos, caudas dobradas de volta no começo, LFOs com número inteiro de ciclos
dentro do loop, filtros de master circulares, e a camada de chuva gerada no
domínio da frequência, que é periódica por construção). `{ crossfade: 3.5 }`
usa dois elementos que se cruzam no fim, para faixa que *não* emenda. Cruzar uma
faixa que já emenda é pior que não fazer nada: o cruzamento sobrepõe a faixa
com ela mesma e dobra a batida na volta.

Volume de fundo mora em `TRACK_LEVEL` (`js/track.js`) e em `Music._applyLevel`.
Trilha tem que ficar **atrás** dos efeitos: se competir com o som de morte, o
jogador perde informação de combate.

## Convenções

- Nomes de domínio e comentários existentes estão em pt-BR (projeto pessoal).
  **Comentários novos, porém, sempre em inglês** — regra global do usuário.
- `"use strict"`, sem módulos, sem `export`. Tudo em escopo global.
- Peça nunca referencia `game` direto: só o contexto `c` que o efeito recebe.
  Se uma peça precisa de algo novo, adicione um efeito em `EFFECTS` ou um método
  em `Game`, não um acesso a `game` dentro do dado.
- Comportamento genuinamente imperativo vai para `js/hooks.js`, nomeado, e é
  referenciado por string — nunca `if` espalhado dentro das peças.

## Como adicionar uma peça nova

1. Escolha o arquivo de `js/content/` pelo eixo.
2. Adicione a entrada em `Object.assign(PIECES, { ... })` seguindo o schema.
3. `key` igual ao `id`, a menos que seja evolução de outra peça.
4. Todo número em `stats`; trigger e efeitos só com `"@ref"`.
   **Não há campo `icon`**: o ícone sai de `Glyph.svg(id)` — mapeie o `id` em
   `GLIFO_SPRITE` (se a peça invoca um demônio que já tem grade) ou em
   `PRIMITIVA_DE` (`js/ui-glyph.js`). Sem mapa o hash escolhe uma das dez, o que
   já é distinguível — escolher à mão só é melhor porque a forma pode dizer algo
   sobre a mecânica.
5. Três caminhos, cinco tiers cada. Reserve índices distintos por caminho.
6. Se depende de outra peça, declare `requires`.
7. Recarregue o browser. Não há mais nada a mudar.
