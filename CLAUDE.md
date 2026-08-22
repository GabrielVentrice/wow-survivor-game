# CLAUDE.md

Guia para o Claude Code (claude.ai/code) trabalhar neste repositório.

## O que é

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
`tools/levelup-preview.html`, com as **duas telas de escolha** montadas a partir
de builds de verdade: o level-up em três tamanhos (2, 6 e 11 spells) e a etapa
nos dois extremos (primeiro marco e marco final). Mesmo argumento da galeria:
tela que só aparece por segundos, em estados sorteados, não se revisa jogando —
e a etapa aparece sete vezes por run carregando a única decisão irreversível.

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
| `js/sprites.js` | `SPRITE_DATA` + geração de pixel-art e do tile de chão em runtime |
| `js/engine.js` | `Pool`, `SpatialGrid`, `Sfx`, `InputManager`, `Camera`, `EventBus`, `EVENTS` |
| `js/music.js` | `MUSIC` + `Music` — trilha procedural (a **reserva**) |
| `js/track.js` | `Track` + `Soundtrack` — toca `audio/gothic-lofi.mp3`, com fallback |
| `js/assets/sfx-bone.js` | amostra de osso quebrando embutida em base64 |
| `js/entities.js` | `Player`, `Enemy`, `Projectile`, `Minion`, `AreaEffect`, `DotInstance`, `XPOrb`, `Pickup`, `Particle`, `SpawnManager` |
| `js/systems/resolve.js` | registries (`PIECES`, `PASSIVES`, `CAPSTONES`, `MINIONS`) + pipeline de stats |
| `js/systems/effects.js` | `EFFECTS` — o que acontece |
| `js/systems/dots.js` | `DotSystem` — DoT genérico com scheduler por timestamp |
| `js/systems/minions.js` | `MINION_AI` + `MinionSystem` |
| `js/systems/triggers.js` | `TRIGGERS` — quando dispara |
| `js/systems/build.js` | `BuildSystem` — peças, eixos, caminhos, evoluções, passivas, capstones, ofertas |
| `js/hooks.js` | `HOOKS` — a escotilha de escape para o que não cabe em dado |
| `js/content/*.js` | o catálogo: 31 peças, passivas, capstones, demônios |
| `js/render/scenery.js` | `Scenery` — chão, props por chunk, brasas, vinheta |
| `js/render/vfx.js` | `PIECE_VFX`, `VfxLayer`, `drawMinions`, `drawPieceOverlays` |
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
  id, key, name, icon, color, axis, axisPoints, tags, desc,
  requires?,      // { piece: "<key>" } ou { tag: "<tag>" } — gate de oferta
  vfx?,           // nome em PIECE_VFX
  evolutionOnly?, // true = só chega por evolução, não entra no sorteio
  stats:   { ... },              // ÚNICA fonte de números
  trigger: { type, ...params },  // só referências "@stat"
  effects: [ { type, ... } ],    // efeitos aninham efeitos
  paths: { a: { name, evolvesInto?, tiers: [T(), T(), T(), T(), T()] }, b, c },
}
```

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
- **Canvas procedural nasce em pixel de buffer.** A laje (`makeFelTile`) e os
  props estáticos (`propSprite`) são gerados já na resolução final; gerados
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

Medir por média das políticas engana aqui. `driver_balance` roda cinco perfis, e
três deles (`aleatorio`, `amplo`, `agressivo`) **não miram por construção** —
não chegar ao capstone é o preço declarado deles, não uma regressão. Quem
responde pela saúde do clímax são `focado` e `misto`.

### O corpo do warlock conta a progressão: capstone vira forma, spell vira aura

São dois marcos, com dois donos, e não podem trocar de dono:

| Marco | Gatilho | O que muda | Onde mora |
|---|---|---|---|
| **Metamorfose** | um capstone fechado | troca o sprite do personagem, a escala e a cor da luz no chão | `CLASSES.<id>.forms[].caps` |
| **Aura** | uma spell concluída (qualquer caminho no tier 5) | acende o `PIECE_VFX` daquela peça em volta do warlock | `BuildSystem.isComplete` → `rebuildVfx` |

A versão antiga amarrava as duas coisas no **acúmulo de pontos de eixo**: a
forma vinha em 6 e 14 pontos, e a aura era uma propriedade da forma
(`aura: true`), o que dava adorno a toda peça comprada de uma vez só. Isso
falhava dos dois lados — a transformação chegava por inércia (todo upgrade
empurra o eixo, então ela não marcava escolha nenhuma) e o adorno virava ruído
justo quando a build ficava grande.

Consequências que valem para conteúdo novo:

- **Forma é indexada por capstone, não por ponto.** Com pool 20 e teto 15 cabem
  no máximo **2** capstones numa run — então uma classe tem sentido com 3
  formas (`caps: 0, 1, 2`). Uma quarta seria arte morta.
- **A conclusão da peça é que acende a aura, não a compra.** `upgradePath`
  devolve `completed` **só na primeira** vez que a peça fecha um caminho:
  fechar o segundo caminho da mesma peça não acende uma segunda aura.
- **A `key` atravessa a evolução, então a aura também.** A peça troca de `def`
  no tier 5 e o halo continua aceso, agora com o `vfx` da forma evoluída.
- **Peça nova sem `vfx` simplesmente não tem aura para dar.** Se a spell é de
  assinatura, dê a ela uma entrada em `PIECE_VFX`.
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
- Passivas podem declarar `exclusive` → `Fúria Contida` e `Pés de Cinza` nunca coexistem.
- Peça com `requires` só é oferecida depois que a habilitadora está na build.
- O kit inicial da classe entra **de graça** (`acquirePiece(id, true)`), para o
  pool de 20 ficar inteiro para as escolhas do jogador — e a spell que vem numa
  etapa também, porque o eixo dela já foi pago pelo ponto que a carta deixou de
  dar.
- **Baú é a única fonte de tiers grátis**, e por isso é dado: `BALANCE.spawn`
  diz com que frequência ele nasce (avulso pelo spawner a partir dos 45s, e de
  todo Dreadlord morto) e `BALANCE.chest.rarity` diz quantos tiers ele entrega —
  1, 3 ou 5, com `lateWeight` trocando os pesos depois de `hardAt`, quando um
  tier avulso não muda mais o jogo. Mexer nesses números é mexer na velocidade
  em que a build fecha; `driver_chest` mede as duas pontas.

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
| **Forma** | três cartas + tira da build | três cartas + rodapé de eixos |

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
- **Passiva fica no level-up, e não é exceção.** Ela não tem tier, não tem eixo
  e não pede investimento depois: só multiplica o que a build já tem
  (`pieceMods` sobre um `match`). Isso é aprofundar, não alargar — e é a mesma
  razão pela qual ela só entra a partir do nível `passiveFrom`: cedo demais não
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

Antes de qualquer eixo chegar a `unlockAt`, as três cartas são **spells
sorteadas do catálogo inteiro** — podem cair três do mesmo eixo. Não existe
carta seca: a única maneira de ganhar eixo é escolhendo uma spell, e cada uma
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

Cai daí que largura não **gasta** o pool, ela o **desacelera**: a carta seca
anda `axisPoints` e a com spell anda `spellPoints`, então cada spell levada num
eixo aberto custa um marco a mais. `driver_milestone` reprova
`axisPoints <= spellPoints` — sem essa diferença, arsenal deixaria de custar.

#### Cadência: sai da conta, não do gosto

Pool 20; quem abre um eixo cedo gasta ~5 marcos a 1 ponto e o resto a 2, e as
cartas sorteadas nem sempre oferecem o eixo alvo — na prática **~15 marcos**. A
`every` 40s isso fecha em **10:00**, logo antes de onde uma run competente
acaba. `driver_milestone` refaz essa conta em vez de confiar no número: se a
pool só fechasse depois dos 11 min, ele reprova, porque **marco entregue depois
da morte não entrega nada**.

#### Apresentação

- **Duas formas de carta, e o cabeçalho é onde elas se separam.** Na carta
  **aberta** a manchete é o EIXO — a pergunta é quanto investir nele, e a spell
  é uma das duas maneiras de levar. Na **sorteada** a manchete é a SPELL, porque
  é ela que está sendo escolhida; o eixo vira etiqueta ao lado, na cor dele. Pôr
  o eixo no topo de uma carta sorteada seria anunciar como título algo que o
  jogador não escolheu — o sorteio é que pôs aquele eixo ali.
- **`aberto` é o único selo da tela**, e marca a regra que mais importa: este
  eixo não depende mais do sorteio para reaparecer.
- **As duas telas são cartas, então o que as separa é outra coisa.** Enquanto o
  level-up era linhas a diferença se via de longe; hoje ela mora no rodapé (a
  etapa tem barras de eixo e a linha do capstone, o level-up tem a tira de
  spells), no selo `aberto`, nos **dois botões** por carta, e na cor do eyebrow
  — âmbar aqui, verde lá. Isso importa: o jogador precisa perceber que a
  pergunta mudou, e a desta é a única que ele não desfaz.
- **O alvo é o botão, não a carta.** Carta inteira clicável exigiria escolher
  por ele qual das duas maneiras é o padrão, e é justamente a metade
  irreversível da decisão.
- **O número anunciado é o creditado.** Com o eixo no teto ou o pool no fim,
  `addAxis` entrega menos; `getMilestoneOffers` devolve `gain` real ao lado do
  `want` de tabela, e o driver compara os dois em toda carta de toda etapa.
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
  etiqueta sólida com glifo (`▲` melhoria, `⭐` evolução, `✦` passiva — `◈`
  spell nova só existe na tela de etapa), tile redondo na passiva, e o selo do
  tier no canto do tile na melhoria, porque aí o ícone *mente*: é o ícone de uma
  spell que o jogador já tem e sozinho não diz quão fundo ela está.
- **Veredito, não coordenada.** O subtítulo já diz "caminho · tier N de 5"; o
  rodapé da carta diz o que aquilo *significa* (`Fecha o caminho` / `A um tier
  do fim`).
- **`.lv-why` só aparece quando acrescenta.** Na linha ele carregava sempre o
  que a spell é, porque a coluna existia de qualquer jeito. Numa carta o nome
  está logo acima e repetir a identidade é ruído — sobram os dois casos em que
  há informação nova: passiva **exclusiva** (fecha uma porta) e **evolução** (a
  peça troca de identidade inteira).

**Passiva só entra a partir do nível `BALANCE.levelup.passiveFrom`** (10). Uma
passiva não adiciona nada — ela **multiplica** o que já está lá (`pieceMods`
sobre um `match`). Oferecida no nível 2, com duas spells no tier 0, ela
multiplica quase nada, e pior: ocupa uma das três cartas disputando com o tier
que faria diferença agora. São oito passivas para uma run de dezenas de níveis,
então adiar não custa variedade — custa só o começo, que é onde a spell precisa
de tier e não de multiplicador. `driver_cards` confere a trava no nível 1 antes
de subir o nível para medir o resto.

**Nenhum texto novo por tier.** São 645 tiers no catálogo — escrever "antes →
depois" à mão em cada um seria conteúdo que envelhece no primeiro
rebalanceamento. Tudo o que a carta mostra sai do que já existe:

| Campo da carta | De onde vem |
|---|---|
| frase principal | `tier.desc` / `def.desc` — já são frases em pt-BR |
| antes → depois | `tier.mods` aplicado a `inst.r.stats` (`UI.tierDelta`) |
| onde chega | `tierIndex` contra `PATH_RULES.tiers` |
| porquê | só em evolução e passiva exclusiva |
| chip verde | fecha um caminho (acende a aura) |
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
degrau estão as minhas outras spells?** Ícone, nome, pips do caminho mais fundo,
e a spell que a carta sob o mouse melhora acende — é o que liga a decisão ao
estado da build sem a tira ter que explicar nada por escrito. `STRIP.spells` é o
teto e o excedente vira contador, porque overlay de jogo não rola.

Estado novo é **um só**: o índice da carta sob o mouse. O hover re-renderiza só
a tira; mexer nas cartas mataria a transição de `transform` que o CSS está
rodando naquele instante. A mesma regra vale na tela de etapa, onde o hover
re-renderiza só o rodapé.

Tipografia: **Outfit** e **IBM Plex Mono**, vindas do Google Fonts. É a exceção
à regra de "nenhum asset novo" — baixar os `.woff2` adicionaria arquivo ao repo.
Offline as pilhas de fallback em `--ui`/`--mono` assumem e a tela continua
legível, só perde o desenho da fonte.

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

### Cenário: determinístico por posição, nunca por ordem de visita

O mundo é infinito e gerado em runtime. Duas regras:

- **Props saem de `hash2(chunkX, chunkY)`**, não de `Math.random()` na hora de
  desenhar. Voltar andando para o mesmo lugar tem que mostrar os mesmos
  destroços; senão o mundo "reembaralha" nas costas do jogador e a leitura de
  espaço vai junto.
- **Nada de gradiente por frame em código quente.** Props sem animação
  (`STATIC_PROPS`) são renderizados uma vez num canvas e depois só copiados —
  `createLinearGradient` dentro do laço de desenho é alocação a 60fps.

O chão usa 8 variantes de laje escolhidas por hash da célula: um tile único
repetido é o que mais denuncia cenário procedural barato.

`Scenery.corruption` (0..1) vem de `elapsed / hardAt` e faz o mundo apodrecer
junto com a run — veios mais vivos, mais brasa no ar, vinheta mais fechada.

### Assets: dois, e ambos com plano B

Sprites, chão, efeitos sonoros e a trilha de reserva são gerados em runtime.
**Não adicione arquivos de imagem.** Os dois assets de áudio que existem seguem
regras diferentes, e a diferença é `file://`. Nenhum dos dois vem de banco de
sons: a trilha é sintetizada por `tools/make_track.py` e o estalo de osso está
embutido — não há licença de terceiro a conferir em nada que o jogo toca.

| Asset | Como carrega | Por quê |
|---|---|---|
| `audio/gothic-lofi.mp3` (trilha) | `<audio src>` em `js/track.js` | `fetch`/XHR são bloqueados em `file://` (origem opaca); elemento de mídia com caminho relativo carrega. Volume por `.volume`, não por GainNode — `createMediaElementSource` sobre mídia de origem opaca sai em silêncio. |
| osso quebrando (efeito) | base64 → `atob` → `decodeAudioData` | Precisa sobrepor e variar de tom dezenas de vezes por segundo; `<audio>` não dá isso. Base64 não passa por rede, então funciona em `file://`. 21 KB. |

**Os dois têm fallback e o jogo nunca fica mudo:** `Soundtrack` cai para a
trilha procedural se o mp3 não carregar (e a procedural cobre o menu enquanto
o arquivo baixa), e `Sfx.death` volta aos estalos sintéticos se a amostra não
decodificar. Os drivers `driver_track` e `driver_audio` testam esses caminhos.

**Modo de repetição da trilha.** `Track` tem dois, e escolher errado estraga a
faixa. `seamless` (padrão) usa `loop = true` nativo, para faixa montada para
emendar — é o caso da atual, que fecha em si mesma por construção (32 compassos
exatos, caudas dobradas de volta no começo, LFOs com período que divide o loop,
filtros de master circulares). `{ crossfade: 3.5 }`
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
5. Três caminhos, cinco tiers cada. Reserve índices distintos por caminho.
6. Se depende de outra peça, declare `requires`.
7. Recarregue o browser. Não há mais nada a mudar.
