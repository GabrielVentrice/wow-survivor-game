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
`tools/levelup-preview.html`, a **tela de level-up** montada com builds de
verdade em três tamanhos (2, 6 e 11 spells). Mesmo argumento da galeria: tela
que só aparece por segundos, em estados sorteados, não se revisa jogando.

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
| `js/ui.js` | `UI` — HUD, tela de level-up, pausa, baú, game over |
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

Evolução e capstone são o clímax da progressão. Se a medição mostrar menos de
~25% das runs chegando lá, o problema é de OFERTA e não de números — as
alavancas são o peso de caminho já iniciado em `getOffers` e a ordenação do
baú em `UI.openChest`.

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
e que peça comprada sem caminho fechado não acende nada. Medido em 20 runs:
50% acendem ao menos uma aura, 40% ganham ao menos uma forma.

### Regras estruturais que forçam comprometimento

- Pool de **20** pontos de eixo, teto de **15** por eixo → impossível maximizar dois.
- No máximo **2** caminhos por peça passam do tier 2 → impossível maximizar três.
- Passivas podem declarar `exclusive` → `Fúria Contida` e `Pés de Cinza` nunca coexistem.
- Peça com `requires` só é oferecida depois que a habilitadora está na build.
- O kit inicial da classe entra **de graça** (`acquirePiece(id, true)`), para o
  pool de 20 ficar inteiro para as escolhas do jogador.
- **Baú é a única fonte de tiers grátis**, e por isso é dado: `BALANCE.spawn`
  diz com que frequência ele nasce (avulso pelo spawner a partir dos 45s, e de
  todo Dreadlord morto) e `BALANCE.chest.rarity` diz quantos tiers ele entrega —
  1, 3 ou 5, com `lateWeight` trocando os pesos depois de `hardAt`, quando um
  tier avulso não muda mais o jogo. Mexer nesses números é mexer na velocidade
  em que a build fecha; `driver_chest` mede as duas pontas.

### A tela de level-up compara linhas, não cartas

É a única tela em que o jogador decide algo que não é posição, e a decisão é
**irreversível** — ponto de eixo não volta. Ela é três **linhas** com as mesmas
três colunas (o que é / o que muda no jogo / custo) mais um painel com a build
de agora, e não três cartas verticais. Cartas obrigam a ler três blocos
separados para comparar um mesmo campo; linhas deixam o olho correr na vertical.

O que caiu junto com as cartas: a legenda de tipos do topo (o tipo agora vive na
própria linha) e o chip minúsculo de custo no rodapé (custo virou coluna).

**A coluna do meio é a manchete.** Quem decide a compra é o que a oferta *faz* —
não o nome de fantasia do tier, não o ícone, não o botão. A primeira versão
errava isso: o efeito saía em 17px lavanda apagada disputando com um nome de
20px branco, um tile de 52px e um botão de preenchimento sólido, e o olho
pousava em tudo menos na informação. A hierarquia hoje:

1. **`.lv-plain`, 21px** — o que muda no jogo, o item mais claro da linha.
2. **o delta** logo abaixo, com o número que o jogador vai passar a ter.
3. nome da spell, custo e etiqueta de tipo — um degrau abaixo, legíveis sem
   competir.
4. `.lv-why`, ícone e botão — o fundo da pilha.

Três regras que caem daí, e que valem para qualquer coisa nova nesta tela:

- **O slot do nome carrega a SPELL, não o nome do tier.** O jogador reconhece
  "Incinerate" de imediato — está na build dele, no painel e no HUD; "Brasa" não
  quer dizer nada até ser lido. O nome do tier desce para o subtítulo. Em
  evolução o nome é a **forma nova** e o subtítulo diz de onde ela veio.
- **A linha inteira é clicável, então o botão é lembrete e não alvo.**
  Preenchido em repouso ele era o segundo bloco mais barulhento de cada linha.
  Vazado em repouso, enche no hover da linha — que é quando ele tem algo a dizer.
- **Veredito antes de detalhe no custo.** A pergunta é "gasta ou não?", e ela
  cabe em três palavras (`Custa 2` / `Não gasta ponto`); o detalhe
  (`Domínio 0 → 2`) vem abaixo, menor e mais fraco. Numa frase única e forte o
  custo quebrava em duas linhas e virava o bloco mais pesado da coluna.

Regra prática ao acrescentar qualquer coisa à linha: se ela chama mais atenção
que `.lv-plain`, ela está errada — ou ela é mais importante que o efeito, e aí
o argumento precisa ser feito.

**O tipo da oferta é carregado por forma, nunca por cor.** A cor da linha é a do
**eixo** — qual build ela alimenta —, então uma melhoria verde e uma spell nova
verde são a mesma cor: cor já está ocupada. Quem separa as três é:

- **etiqueta sólida com glifo** (`◈` spell nova, `▲` melhoria, `✦` passiva) em
  vez de legenda solta na cor do eixo, que lia como comentário e não como rótulo;
- **tile redondo quando é passiva** — a mesma convenção que a barra de peças do
  HUD já usa (`.pb-icon.pb-passive`);
- **selo com o tier no canto do tile quando é melhoria**, porque aí o ícone
  *mente*: ele é o ícone de uma spell que o jogador já tem, idêntico ao de uma
  spell nova com aquele mesmo ícone. O número é o que diz "isto é profundidade,
  não largura".
- **evolução tem etiqueta própria** (`⭐ Evolução`), não `Melhoria · evolução`:
  ela não é um degrau a mais, é conversão — a peça troca de nome, arte, trigger
  e efeitos. Chamar as duas coisas de melhoria some com o clímax justamente na
  linha em que ele acontece. Os sete `desc` de evolução começam com
  `"EVOLUÇÃO — "`, de quando a carta não tinha onde marcar isso; o prefixo é
  removido **na exibição**, não no dado.

Os glifos são os mesmos da legenda que a tela perdeu: o vocabulário não mudou,
só saiu do topo e entrou na linha. `driver_cards` cobra os três marcadores em
toda oferta.

**Nenhum texto novo por tier.** São 645 tiers no catálogo — escrever "antes →
depois" à mão em cada um seria conteúdo que envelhece no primeiro rebalanceamento.
Tudo o que a linha mostra sai do que já existe:

| Campo da linha | De onde vem |
|---|---|
| frase principal | `tier.desc` / `def.desc` — já são frases em pt-BR |
| antes → depois | `tier.mods` aplicado a `inst.r.stats` (`UI.tierDelta`) |
| porquê | a peça que o tier melhora, ou o eixo que a spell alimenta |
| custo | `Math.min(custo, teto do eixo, pool livre)` — o que `addAxis` vai cobrar |
| chip verde | abre/aproxima um capstone, ou fecha um caminho (acende a aura) |
| painel inteiro | `build.pieces`, `build.passives`, `build.axis`, `CAPSTONES` |

Consequências:

- **O delta sai dos stats RESOLVIDOS da instância**, com passivas e capstone
  dentro — é o número que o jogador vai passar a ter, não o da tabela. Tier
  só-estrutural (`mods` nulo, `patch` presente) não tem delta numérico e a
  frase do tier carrega sozinha; um tier pode escrever `was`/`now` à mão quando
  o texto disser mais que o número.
- **`STAT_FMT` (`js/ui.js`) é quem sabe a unidade.** `duration: 6` é seis
  segundos, `frac: 0.06` é seis por cento e `radius: 440` não tem sufixo — sem
  a tabela o delta imprimiria "limiar 0.35 → 0.5". Stat sem entrada não aparece,
  e `driver_cards` reprova mod que mexa em stat fora da tabela: o silêncio não
  passa batido.
- **O custo anunciado é o custo real.** Com o eixo no teto ou o pool no fim,
  `addAxis` entrega menos do que a oferta pede; dizer "custa 2" quando vai
  custar 0 é a mentira mais cara que esta tela pode contar. O driver compara os
  dois em toda oferta de toda rodada.
- **Chip de recomendação só com gancho real.** Recomendação decorativa vira
  ruído e o jogador para de ler o chip que importa.

**O painel não rola — ele resume.** Overlay de jogo não tem barra de rolagem, e
a build cresce a run inteira. Em ordem: densidade automática (`PANEL.fullRows`
spells → linha inteira; acima disso → linha única), teto de linhas visíveis
(`PANEL.slimRows`) com o excedente virando contador, passivas sempre em chips
(elas não têm tier, só existência), e a spell afetada pela oferta sob o mouse
sobe para o topo para nunca cair dentro do contador. **Eixos e capstone são
`flex-shrink: 0`**: são a informação que decide a compra, então são a última
que pode sumir — quem cede espaço é a lista de spells.

Estado novo é **um só**: o índice da oferta sob o mouse. O hover re-renderiza
só o painel (`lvBuild`) e o chip de orçamento; mexer nas linhas mataria a
transição de `transform` que o CSS está rodando naquele instante.

**O chip de orçamento antecipa o gasto.** No hover o saldo cai para o que
sobraria (`20 → 18`) e o chip vira alarme. Ponto de eixo é o único número desta
tela que não se desfaz depois, então é o único que se antecipa ao clique — e o
número mostrado é `v.gain`, o custo real, não o de tabela. Sem custo (passiva,
tier livre, eixo no teto) nada muda: alarme que acende sempre para de alarmar.
O vermelho é `#ff6b8a`, o mesmo que o relógio assume na fase dura — o laranja
de "custa" não serve aqui porque ele **é** a cor do eixo Cataclismo, e numa
oferta de Cataclismo o alarme sumiria dentro da própria linha.

Tipografia: **Outfit** e **IBM Plex Mono**, vindas do Google Fonts. É a exceção
à regra de "nenhum asset novo" — baixar os `.woff2` adicionaria arquivo ao repo.
Offline as pilhas de fallback em `--ui`/`--mono` assumem e a tela continua
legível, só perde o desenho da fonte.

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
