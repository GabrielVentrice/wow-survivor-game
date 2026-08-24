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

O que Bloons empresta hoje é a **profundidade**, não o vocabulário: os três
caminhos são os mesmos em toda peça — **Aceleração, Maestria e Crítico** — e a
troca de identidade mora no tier 5 de cada um. Ver "As três linhas".

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
Antes de commitar, rode a bateria headless — **`node tools/run-all.js`**, que
roda os 24 drivers em paralelo com o mais lento na frente (~140s, contra 260s
em série). `node tools/run-all.js fast` é o subconjunto de ~8s que cabe a cada
edit. **O pior caso da bateria é o `chest`**, e ele custa ~140s de propósito:
"40% dos baús dão prêmio grande" é uma propriedade distribucional e uma run de
12 min abre ~24 baús, amostra em que o piso cai dentro do ruído — medido, o
mesmo jogo dá de 33% a 74% conforme a seed. As quatro seeds que ele agrega são
o que compra a amostra, e o segundo argumento dele em `run-all.js` é onde esse
preço se negocia. Detalhe em `tools/README.md`.

**`node tools/browser.js` é a única verificação que roda num browser de
verdade, e ela existe porque o stub de canvas do harness aceita tudo.** Um bug
que derrubava um quadro inteiro do jogo — `rgba(undefined,0)` no gradiente de
todo tiro sem rastro, que faz `render` estourar antes do `present()` — passou
por 24 drivers verdes, porque `addColorStop` só recusa a string num
rasterizador real. O stub também não tem preço: ele **conta** chamadas de
desenho e não diz quanto custam. `bench` mede ms por quadro; `shot` fotografa
uma cena fixa e responde "o desenho mudou?" com hash pixel a pixel — é ele que
transforma otimização de render em medição em vez de aposta. Fica fora do
`run-all.js` de propósito: o playwright mora fora do repo, e a bateria não pode
depender do que o repo não carrega. Detalhe em `tools/README.md`.

**`DRIVER=driver_bench.js` é o banco de provas: a peça sozinha, em campo
controlado.** `driver_balance` responde "esta RUN funciona?" e não responde
"esta PEÇA faz muito ou pouco dano?" — o que ele mede passa por um bot que se
posiciona, uma curva de XP, um sorteio de oferta e 44 peças dividindo o mesmo
funil, então um 0,4% de share não separa "quebrada" de "nunca foi oferecida". O
banco tira a run da conta: spawner desligado, N dummies em posição conhecida,
jogador imortal, e 450 células de 12s de jogo em 20s — o que corta o custo não é
simular menos jogo, é simular menos **horda** (40 corpos em vez de 4400, e 40%
do frame mora no `SpatialGrid`). Duas regras que custaram uma rodada cada, e as
duas são a mesma: **o banco tem que montar um mundo que o jogo pode entregar** —
o kit inicial fica (sem alguém batendo, toda peça `reactive` mede zero e parece
quebrada) e `requires` é honrado (o jogo não oferece Conflagrate sem um DoT na
build). Ele reprova peça de dano que não causa dano em cenário nenhum e caminho
fechado que rende menos que a peça crua.

E ele é também **o único lugar onde a régua da tela de level up é conferida**
(bloco `REGUA x CAMPO`): `js/systems/dps.js` é um modelo fechado, e um modelo
que ninguém confere vira a segunda lista que este projeto passa o tempo inteiro
evitando. A comparação mora aqui porque o banco já mediu toda peça com o motor
rodando — ver "A régua" na seção da tela de level-up.

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
| `js/track.js` | `Track` + `Soundtrack` + `TRACKS` — as duas trilhas em arquivo, com fallback |
| `js/assets/sfx-bone.js` | amostra de osso quebrando embutida em base64 |
| `js/entities.js` | `Player`, `Enemy`, `Projectile`, `Minion`, `AreaEffect`, `DotInstance`, `XPOrb`, `Pickup`, `Particle`, `SpawnManager` |
| `js/systems/resolve.js` | registries (`PIECES`, `PASSIVES`, `CAPSTONES`, `MINIONS`) + pipeline de stats |
| `js/systems/effects.js` | `EFFECTS` — o que acontece |
| `js/systems/dots.js` | `DotSystem` — DoT genérico com scheduler por timestamp |
| `js/systems/minions.js` | `MINION_AI` + `MinionSystem` |
| `js/systems/triggers.js` | `TRIGGERS` — quando dispara |
| `js/systems/dps.js` | a régua da tela de level up: quanto uma peça faz por segundo |
| `js/systems/build.js` | `BuildSystem` — peças, eixos, caminhos, evoluções, passivas, capstones, ofertas |
| `js/hooks.js` | `HOOKS` — a escotilha de escape para o que não cabe em dado |
| `js/content/paths.js` | `HASTE`/`MASTERY`/`CRIT` — as três linhas de upgrade, geradas |
| `js/content/*.js` | o catálogo: 44 peças, passivas, capstones, demônios |
| `js/render/fx-shapes.js` | `FX_SHAPES` — o gerador de eventos em pixel (`bloom`, `implode`, `nova`, `rip`) |
| `js/render/tiles.js` | `TILE_ROWS` — as 8 lajes do chão, desenhadas em grade de 42x42 |
| `js/render/debris.js` | `PROP_ART` — os 7 destroços em grade, com a paleta de cada um |
| `js/render/scenery.js` | `Scenery` — chão, props por chunk, brasas, vinheta |
| `js/render/vfx.js` | `PIECE_VFX`, `VfxLayer`, `drawMinions`, `drawPieceOverlays` |
| `js/leaderboard.js` | `LB` + `Leaderboard` — recorde local, envio ao form, leitura da planilha |
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
  paths: {        // sempre estes três, sempre nesta ordem (ver "As três linhas")
    haste:   HASTE({ rate: { stat, verb }, qty?: { stat, noun, steps } }, T(assinatura)),
    mastery: MASTERY({ dmg, noun?, add?, pct?, evolvesInto? },  T(assinatura)),
    crit:    CRIT({ noun? },                                    T(assinatura)),
  },
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
   Com a grade de três linhas isso ficou barato: cada linha tem **um** tier
   estrutural (o quinto), então uma linha nunca escreve em mais de um índice.

### As três linhas: Aceleração, Maestria e Crítico

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

#### E elas são FRONT-LOADED, porque o marco é pago em abates

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

#### O crítico é um stat da peça, e quem sorteia é o funil

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

#### Toda peça precisa de número DESDE A COMPRA

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

#### E o sustain tem que CRESCER, porque as três linhas são todas ofensivas

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

#### E o terceiro buraco: `pierce` tinha sumido do catálogo

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
existem no tier 5. Quem espalha eixo sente isso, e é o preço declarado do gate
(`PATH_RULES.axisGate`) — a diferença é que agora ele atrasa o teto da peça em
vez de decidir se ela existe.

#### Onde isto está, medido

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

Ler isto com honestidade: **a grade está entregue e o motor está verde** (os 24
drivers passam), mas o clímax da run — evolução, capstone, metamorfose — quase
não acontece mais. O perfil que joga ao acaso melhorou; os que **miram** um eixo
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

1. **`PATH_RULES.axisGate`/`freeTier`** — deixar o tier 5 chegar mais cedo.
   Testado uma vez (`[0,0,0,1,5]`) e **não** foi suficiente sozinho.
2. **Um segundo salto estrutural no tier 3** de cada linha, além do tier 5. É a
   mudança que ataca o mecanismo de frente, e é a mais cara de escrever: são
   132 tiers novos à mão.
3. **`LINE_STEPS`** — subir os degraus numéricos de novo. É a mais barata e a
   que já mostrou ter teto: ela move o dano e não move a sobrevivência.

O que **não** é a alavanca, medido: dano de saída. Com o jogador imortal a build
cresce igual à antiga (tabela acima), e a bateria do banco mostra caminho
fechado rendendo mais que o equivalente antigo em quase toda peça.

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
| R5 | **Ícone sai do gerador do mundo** | Nenhum emoji, em lugar nenhum — nem no canvas (o item no chão também era `fillText` de emoji, e depois um `fillRect`; hoje é grade, ver "Os dois drops"). |

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

#### A reserva do warlock

`--osso-600` puro (`#EDE7DA`) é **exclusividade do warlock no canvas**. Nenhum
outro sprite, vfx, partícula ou item usa osso cheio — é por isso que o item no
chão é `--osso-400`/`--osso-500` e não branco. Com a build inteira acesa o
jogador perdia de vista a única coisa que controla; ele passa a ser a única
coisa branca em tela. Não é mais luz: é **reserva**.

#### O HUD: cinco lugares fixos, e nada no meio

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

**4. A cadeia (`BALANCE.combo`) — a ceifa dita em número.** As duas medem o
mesmo fato (abates por tempo) e é de propósito que não se derivem uma da outra:
a ceifa é um **evento** no chão, que acontece e passa; a cadeia é um **estado**,
e estado se desenha enquanto dura — a mesma regra que separa a casca do escudo
de um vfx de escudo. Um abate dentro de `window` do anterior continua a conta,
um intervalo maior a zera, e o pavio de 3px embaixo do número é o que diz que a
regra é *tempo entre abates* e não abates totais.

- **É leitura, não bônus.** A cadeia não multiplica dano, não dá recurso e não
  entra em nenhum stat. No dia em que ela pagar alguma coisa, o número vira
  input de decisão e o desenho tem que mudar junto (ele hoje não diz o que
  compra) — a alavanca de dificuldade continua sendo `ENEMIES`.
- **O relógio é o da simulação.** A 3x, um segundo real daria três de folga
  para manter a conta viva, e o modo rápido seria o que mais encadeia.
- **`min` existe pelo mesmo motivo que a ceifa tem três degraus e não um.**
  Dois abates seguidos é o estado normal deste jogo; contador que nunca apaga
  não está dizendo nada.
- **`pulse` é UM número, e é a duração do salto E o intervalo mínimo entre dois
  saltos.** Com decaimento e cadência separados, uma build madura (dezenas de
  corpos por segundo) rearmaria o salto no meio dele mesmo, e o número passaria
  a **vibrar num tamanho fixo** em vez de pulsar. Amarrados, cada salto sempre
  termina antes que o próximo possa começar — é a mesma lição do
  `hitstop.cooldown` e do `gap` das vozes. `driver_vfx` mede as duas pontas:
  100 abates em 1s dão ~9 saltos e não 100, e nenhum rearma antes da hora.
- **Osso, nunca cor de eixo.** A ceifa é canvas e usa `buildColor`; a cadeia é
  UI, e cor é predicado de eixo — uma cadeia não fala de eixo nenhum. O que
  impede o número de se dissolver numa pilha de corpos é **contorno** de
  obsidiana, a mesma decisão do `drawSpriteRim` do warlock, e não brilho.
- **O salto é `transform`, nunca `font-size`.** Mudar a fonte refaz o layout do
  HUD inteiro sessenta vezes por segundo. O tamanho por degrau muda — mas só
  quando o degrau muda.
- **Ela não tem voz nem evento visual**, e por isso não passa por `emitVfx`: a
  ceifa já é a voz desse fato, e dar um segundo som ao mesmo pulso seria
  anunciar duas vezes. A cadeia é o que a run guarda para o game over
  (`comboBest`, no painel "A run em uma linha").

**A janela é a alavanca, e ela está em 0,1s.** `window` é o único número do
bloco que decide se a cadeia **quebra**. Medido, run de 12 min com a horda no
teto:

| janela | recorde | em tela | quebras | quadros no degrau 3 |
|---|---|---|---|---|
| 1s | 7584 | 100% | 0 | 93% |
| 0,3s | 743 | 87% | 234 | 3% |
| **0,1s** | **364** | **57%** | **605** | **0%** |

Em 1s esta horda é densa demais para dar um segundo de silêncio: o número nunca
zerava e era um **medidor de rampagem**, não um feito que se perde. Em 0,1s ele
só continua enquanto os corpos caem no mesmo pulso — some de quase metade dos
quadros e volta a ser um feito.

O preço está na última coluna: os degraus de cima (40 / 120) praticamente não
acendem mais, então `tiers` e `size` passam a viver quase só no degrau 0. Se a
intenção for o número voltar a variar de tamanho, quem desce é `tiers`, não
`window` que sobe — os degraus estão no arco de uma janela de 1s (10 / 40 / 120,
e não 10/25/50, que acendiam os três nos primeiros vinte segundos).

### Os dois drops: objeto, não retângulo

Baú e Ímã de Almas foram as duas últimas coisas do mundo desenhadas como
geometria — `fillRect` dentro de `Pickup.draw`, um quadrado vazado e um
quadrado chanfrado. Quadrado não é objeto: ele diz "tem alguma coisa aqui" e
nada além disso, e estes dois são os únicos itens do jogo cujas respostas são
**opostas** (um abre uma tela, o outro limpa o chão de XP). A diferença entre
eles era matiz, entre osso e osso um pouco mais quente.

Hoje são grade em `SPRITE_DATA` como o resto do elenco, e o dado é o mesmo par
que inimigo e demônio carregam: `sprite` aponta para a grade e `art` é a altura
desenhada em unidades de mundo — `linhas × PIXEL_UNIT`, que é o degrau 1.
`driver_pixel` mede o degrau dos itens junto com o dos inimigos (é o único
número do elenco digitado à mão, sem raio de onde cair) e `driver_render` cobra
que todo item tenha grade, pelo mesmo motivo que cobra sprite de demônio.

Três coisas que caem daí:

- **A silhueta é que separa os dois**: caixa fechada com fecho contra ferradura
  de duas pontas. Cor é a última variável, não a primeira.
- **O drop ganhou o que todo corpo em tela já tinha** — contorno
  (`drawSpriteRim`), para a arte não se dissolver dentro do próprio halo, e
  sombra no chão. Sem a sombra, um objeto que flutua lê como adesivo colado na
  câmera.
- **A sombra sai do `y` SEM o hop**, e o hop mora em `anim.bob` (dentro de
  `placeSprite`, então cai em pixel inteiro). É a diferença entre o objeto
  subir e o desenho inteiro escorregar para cima.

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
mão — e o dobro de dano não move nenhuma das duas pontas.

**E quem matava o piloto aos dois minutos não era o encosto.** Este parágrafo
dizia que era `touchDps` dentro da parede de 4400 corpos, e isso era um palpite
que a medição derrubou: dano de saída e tempo de vida são duas curvas, e
`driver_balance` só enxerga a segunda pela borda — ele conta quando se morre,
não de quê. Ver "A autópsia" logo abaixo.

Medir por média das políticas engana aqui. `driver_balance` roda cinco perfis, e
três deles (`aleatorio`, `amplo`, `agressivo`) **não miram por construção** —
não chegar ao capstone é o preço declarado deles, não uma regressão. Quem
responde pela saúde do clímax são `focado` e `misto`.

### A autópsia: média de dps não enxerga morte instantânea

`driver_balance` responde **quanto tempo** se sobrevive. Ele não responde
**de quê** — e as duas perguntas têm respostas diferentes, o que custou um
parágrafo errado a este arquivo. `driver_autopsy` (`tools/README.md`)
instrumenta `Game.damagePlayer` e reparte cada ponto de vida perdido por
inimigo nomeado, sem tocar numa linha do jogo.

A primeira leitura dele encontrou o defeito em uma tela: o estouro de morte do
**Gan'arg Sapador** respondia por **96% de todo o dano tomado numa run** e
**99% dos dois primeiros minutos**. Três coisas que só aparecem com esse
recorte, e que valem para qualquer inimigo novo:

- **O frame não é a unidade certa.** O pior frame do jogo cobrava exatamente 32
  — nunca um número grande. O que matava era a **janela**: três estouros em dois
  segundos, e na pior run a barra inteira cabia neles. Frame mede o desenho,
  janela mede a reação, e é a janela que o jogador chama de "tomei IK".
- **Cobrança que não vê `scale.dmg` envelhece ao contrário.** `Enemy.reset`
  escala `touchDps` e `shootDamage`; `deathBlast` lia o dado do tipo cru e era a
  única exceção do elenco. O resultado era um terço da barra no minuto 1 e ruído
  no minuto 15 — exatamente o inverso de uma curva.
- **Punição só é punição se houver escolha.** O sapador foi desenhado para
  cobrar "deixei a horda chegar" de uma vez. Só que o único input é movimento e
  **toda peça dispara sozinha**: quem decide matá-lo longe é a build, não o
  jogador. Uma cobrança chata dentro de um raio de 86 unidades, num jogo com
  `maxAlive` 4400, não pune decisão nenhuma — ela taxa a horda chegar, que é o
  que a densidade garante. Inimigo novo com cobrança discreta precisa passar
  nesse teste antes do de números: **existe uma posição que evita isso?**

O conserto foi de dado — `radius` 48, `damage` 24 e o campo novo `falloff`, a
fração cobrada na borda —, e ele **não apaga o sapador**: ele continua sendo a
maior fonte isolada de dano (50%). Medido em 16 runs contra o piso de "sem
estouro nenhum": mortes antes dos 3 min de 10/16 para 2/16 (piso 1/16), abates
de 828 para 1190 (piso 1195), e a rajada de 2s na pior run de 100% da barra para
85%. Depois dele o dano tomado volta a ser repartido — sapador 53%, encosto de
esqueleto 23%, projétil de inquisidora 11% —, que é o que "morri para a horda"
deveria parecer numa tabela.

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
- **O pacto: a run cabe em DOIS eixos** (`AXIS_RULES.maxAxes`). Assim que dois
  eixos têm pelo menos um ponto, o terceiro se fecha — ver "O pacto".
- **Ponto de eixo só vem de etapa.** Level-up não cobra nada e o baú entrega tier
  — as duas moedas nunca mais disputam a mesma escolha (ver "As duas batidas").
- No máximo **2** caminhos por peça passam do tier 2 → impossível maximizar três.
- **Tier 3, 4 e 5 pedem 1, 5 e 10 pontos no eixo DA PEÇA** (`PATH_RULES.axisGate`)
  → impossível ter uma spell fechada sem ter escolhido um eixo, e `freeTier`
  deixa de ser uma segunda regra: os dois tiers de graça são exatamente os que o
  gate não cobra.
  **A escada já foi 5/10/15 — os limiares de capstone —, e ela era cara demais
  para o que cobra.** Lida em tabela ficava elegante (o tier 5 custava a mesma
  pureza que o capstone puro); jogada, exigia um eixo MÁXIMO para fechar
  qualquer caminho, então toda build que não fosse pura terminava a run com
  cada trilha parada no tier 2 — que é justamente o defeito que o gate existe
  para consertar, e não para causar. Hoje o primeiro degrau é **um ponto**, a
  coisa mais cedo que uma run pode pagar (uma etapa), e o topo custa a perna
  principal de um capstone híbrido (`hybridMain`). Profundidade continua pedindo
  comprometimento; ela parou de pedir a run inteira antes do primeiro tier 3.
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

### O pacto: duas famílias, e a terceira se fecha

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

### O Ápice: encher um eixo varre a tela

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

### A abertura: a primeira coisa que a run faz é perguntar

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

### As duas batidas: level-up aprofunda, etapa compromete

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

### A tela de etapa: duas fases, e a virada é o comprometimento

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

### A tela de level-up: a régua comum

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

#### A régua: `js/systems/dps.js`

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

### O placar: sem servidor, a validação vira filtro de LEITURA

O quadro dos amigos mora num Google Form (escrita) e numa planilha (leitura),
e essa escolha decide o resto: **não há servidor, então não há validação na
escrita.** Qualquer um posta `tempo: 99999`. A regra migra para o outro lado —
`Leaderboard.valid` roda na **leitura**, a planilha guarda tudo e o placar só
desenha o plausível. O que ela reprova vira contagem no rodapé (`3 fora da
curva`), nunca sumiço em silêncio: filtro invisível é filtro que ninguém
percebe que quebrou.

Seis regras, e as quatro primeiras já custaram um defeito cada:

- **Nenhuma constante copiada nos limites.** `minKillsFor` soma `xpForLevel` e
  `maxKillsFor` lê `BALANCE.spawn` — uma tabela escrita à mão envelheceria no
  primeiro rebalanceamento e passaria a reprovar **run honesta**, que é o pior
  defeito que um filtro pode ter. `driver_leaderboard` mexe nas duas fontes e
  cobra que o filtro se mexa junto.
- **O tempo viaja em milissegundo INTEIRO.** O Forms grava tudo como texto e o
  Sheets adivinha o tipo célula a célula: com vírgula decimal um `724.5` cai
  como texto, e coluna de texto ordena `"9"` acima de `"12"` — a métrica
  ranquearia ao contrário.
- **Uma linha por amigo.** O `QUERY` da planilha corta em 50 linhas ordenadas
  por tempo; sem `melhorPorJogador`, quem tem as 50 melhores runs **é** o placar
  inteiro. E só recorde pessoal é enviado, pela mesma razão: um quadro de melhor
  de sempre nunca desenha uma run que nem o próprio dono bateu.
- **O nome é conteúdo de terceiro.** Ele vem de uma planilha que qualquer um
  escreve e é desenhado com `innerHTML`. `UI.esc` é o que separa "meu amigo pôs
  um nome bobo" de "meu amigo pôs um `<script>` na página inicial de todos".
- **A UI nunca diz "enviado".** `no-cors` devolve resposta opaca: não há status,
  não há corpo. Por isso também não há retry — sem resposta, um retry não
  distingue falha de sucesso, ele só duplica a linha.
- **Abates fica ao lado do tempo, e não é opcional.** A métrica é sobrevivência,
  e sobrevivência premia fugir em círculo. A coluna de abates transforma isso em
  informação pública sem o placar precisar acusar ninguém.

A camada local (`localStorage`: nome e recorde pessoal) é a metade que **sempre**
funciona: sem rede, sem form, sem planilha. Ela nunca lança — storage bloqueado
devolve estado vazio, senão o game over inteiro morreria junto. O plano completo,
com o que ficou de fora e por quê, está em `PLANO-RANKING.md`; o setup do form é
`tools/setup-leaderboard.gs`, que roda uma vez e imprime as constantes.

### Duas trilhas, e a padrão é a que NÃO acontece

`TRACKS` (`js/track.js`) é a lista, e a tecla `N` percorre ela mais o silêncio:
**Vigília → Tempestade → mudo**. A ordem é a decisão — a primeira é a que o
jogo abre.

| | **Vigília** (`focus-vigil.mp3`) | **Tempestade** (`rain-lofi.mp3`) |
|---|---|---|
| o que é | leito de foco: nada acontece | lofi de chuva, com arranjo |
| gerador | `tools/make_focus_track.py` | `tools/make_track.py` |
| passeio de volume (2 s, p5–p95) | **1,4 dB** | 6,8 dB |
| maior salto de 250 ms sobre o fundo | **2,3 dB** | 7,8 dB |
| janelas de 250 ms saltando > 6 dB | **0** de 640 | 7 de 426 |

**A Vigília é a padrão porque uma run dura doze minutos.** Trilha de fundo de
jogo longo não é faixa: é o lugar onde o jogo acontece. O que a Tempestade faz
de propósito — subir na seção cheia, sumir no break, responder com um trovão —
é exatamente o que um ouvinte desatento não consegue ignorar; os sete saltos
dela são os três trovões, os dois cymbal swells e as duas viradas. Cada um é
bom numa faixa e é um cutucão num fundo.

Cinco regras caem daí, e valem para qualquer mexida no leito:

- **Quem carrega a Vigília é o ruído**, não a harmonia — é a camada que por
  construção não tem evento dentro. E ele não é ruído marrom puro: o jogo toca
  a trilha em `0.055` de ganho, e um leito a −6 dB/oitava nesse volume é
  inaudível em laptop. Marrom abaixo de 300 Hz, rosa acima.
- **Nada acontece.** Sem bateria, sem virada, sem lead, sem poeira, sem trovão,
  sem seção. A harmonia se move devagar demais para chegar (um acorde a cada
  32 s, 8 s de cruzamento), e ela **não puxa**: Ré menor natural sem sensível,
  então sem dominante, então sem expectativa esperando resolver. `make_track.py`
  faz o oposto de propósito, porque uma faixa quer essa tensão.
- **O baixo é um PEDAL, e quem pediu foi a medição.** Com uma fundamental por
  acorde a banda de 20–120 Hz passeava **6,35 dB** ao longo do loop — um Si
  bemol 1 carrega muito mais energia lá embaixo que um Sol 2 — e isso sozinho
  era a maior parte do passeio da faixa.
- **O pulso é estrutura de tempo, não groove**: 60 BPM exatos, seno filtrado com
  **30 ms de ataque**. Todo tambor de `make_track.py` ataca em menos de 4 ms
  porque uma faixa quer o estalo; aqui o estalo é a única coisa capaz de fazer
  alguém levantar a cabeça de um leito estável.
- **Camada nova entra pelo teste de evento.** Os dois geradores imprimem o
  passeio de RMS e o maior salto de 250 ms; no leito o alvo é `< 1,5 dB` e zero
  janelas acima de 6 dB. Passou disso, é um som — e som avulso mora na
  Tempestade.

**Carregar é preguiçoso e a troca espera.** As duas juntas são 3,2 MB; a segunda
só desce se alguém apertar `N`, e a troca só efetiva quando o arquivo novo fica
pronto — até lá continua tocando o antigo, e se o novo falhar fica o antigo. O
jogo nunca fica mudo por causa de um download. `driver_track` cobra os três.

### Assets: três, e todos com plano B

Sprites, chão, efeitos sonoros e a trilha de reserva são gerados em runtime.
**Não adicione arquivos de imagem.** Os três assets de áudio que existem seguem
duas regras diferentes, e a diferença é `file://`. Nenhum vem de banco de sons:
as duas trilhas são sintetizadas por `tools/make_focus_track.py` e
`tools/make_track.py` — **inclusive a chuva**, que é ruído modelado no espectro
e não gravação de campo — e o estalo de osso está embutido; não há licença de
terceiro a conferir em nada que o jogo toca.

| Asset | Como carrega | Por quê |
|---|---|---|
| `audio/focus-vigil.mp3` e `audio/rain-lofi.mp3` (trilhas) | `<audio src>` em `js/track.js` | `fetch`/XHR são bloqueados em `file://` (origem opaca); elemento de mídia com caminho relativo carrega. Volume por `.volume`, não por GainNode — `createMediaElementSource` sobre mídia de origem opaca sai em silêncio. |
| osso quebrando (efeito) | base64 → `atob` → `decodeAudioData` | Precisa sobrepor e variar de tom dezenas de vezes por segundo; `<audio>` não dá isso. Base64 não passa por rede, então funciona em `file://`. 21 KB. |

**Os dois caminhos têm fallback e o jogo nunca fica mudo:** `Soundtrack` cai
para a trilha procedural se nenhum mp3 carregar (e a procedural cobre o menu
enquanto o arquivo baixa), e `Sfx.death` volta aos estalos sintéticos se a
amostra não decodificar. Os drivers `driver_track` e `driver_audio` testam
esses caminhos.

**Modo de repetição da trilha.** `Track` tem dois, e escolher errado estraga a
faixa. `seamless` (padrão) usa `loop = true` nativo, para faixa montada para
emendar — é o caso das **duas**, que fecham em si mesmas por construção
(compassos inteiros, caudas dobradas de volta no começo, LFOs com número
inteiro de ciclos dentro do loop, filtros de master circulares, e as camadas de
ruído — chuva lá, leito aqui — geradas no domínio da frequência, periódicas por
construção). Na Vigília entra mais uma: toda frequência de oscilador é
arredondada para um número inteiro de ciclos por loop, correção de no máximo
0,00625 Hz, senão cada voz sustentada termina no meio de um ciclo e a volta é um
clique. `{ crossfade: 3.5 }` usa dois elementos que se cruzam no fim, para faixa
que *não* emenda. Cruzar uma faixa que já emenda é pior que não fazer nada: o
cruzamento sobrepõe a faixa com ela mesma e dobra a batida na volta.

Volume de fundo mora em `TRACK_LEVEL` (`js/track.js`) e em `Music._applyLevel`.
É **um par de níveis para as duas trilhas** — elas estão a 0,3 dB de RMS uma da
outra, e um volume por faixa seria uma segunda tabela para divergir. Trilha tem
que ficar **atrás** dos efeitos: se competir com o som de morte, o jogador perde
informação de combate.

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
5. As três linhas saem de `HASTE`/`MASTERY`/`CRIT` (`js/content/paths.js`): a
   peça só declara QUAL stat ela chama de recarga, de quantidade e de dano.
   Espalhe `...CRIT_BASE` em `stats` — sem `crit`/`critMul` a linha de Crítico
   não tem onde escrever, e `driver.js` reprova mod em stat inexistente.
6. Escreva os três tiers 5 à mão: são eles que carregam a assinatura, e um
   deles pode carregar a evolução (`evolvesInto` no spec daquela linha).
   Reserve um índice de `effects` distinto por linha.
7. Se depende de outra peça, declare `requires`.
8. Recarregue o browser. Não há mais nada a mudar.
