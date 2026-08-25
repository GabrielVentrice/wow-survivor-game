# CLAUDE.md

Guia para o Claude Code (claude.ai/code) trabalhar neste repositório.

**Este arquivo é o índice e as regras. O PORQUÊ de cada regra — o mecanismo, a
medição que a produziu e o que quebra ao violá-la — mora em `docs/`.** As regras
abaixo são curtas de propósito, e curtas elas são fáceis de desfazer por engano:
antes de mexer num subsistema, leia o doc dele.

## O que é

**PACTO** — nome **provisório**, e vale saber que ele é provisório: veio junto
com a identidade visual (é sobre trocar carne por poder, que é o que a
metamorfose faz literalmente no corpo), está no `<title>` e no menu, mas não foi
decidido. O repositório e as pastas continuam `wow-survivor-game`; trocar isso é
decisão do dono do projeto.

Survivors-like (Vampire Survivors) com tema WoW, duas classes jogáveis (Warlock
e Hunter), e um sistema de build roguelike inspirado em Bloons TD 6 (caminhos de
upgrade que trocam a identidade da peça) e Echoes of Mystralia (composição livre
de efeitos). O que Bloons empresta é a **profundidade**, não o vocabulário: os
três caminhos são os mesmos em toda peça — **Aceleração, Maestria e Crítico** —
e a troca de identidade mora no tier 5 de cada um.

**O único input em combate é movimento.** Nada é conjurado à mão; toda peça
dispara sozinha pelo seu trigger. Posicionamento é a única decisão em tempo real.

Sem build, sem dependências, sem package.json, sem testes no repo.

## Rodar

```bash
open index.html                 # abre direto no browser (file:// funciona)
python3 -m http.server 8000     # alternativa se precisar de http://
```

Verificação = abrir no browser e jogar; reload manual após cada edit.
**Antes de commitar, `node tools/run-all.js`** (27 drivers em paralelo, ~140s).
`node tools/run-all.js fast` é o subconjunto de ~8s que cabe a cada edit.

**Scripts são clássicos (`<script src>`), nunca `type="module"`.** Módulo ES é
buscado com CORS e `file://` tem origem opaca — o browser bloquearia e "abrir o
index.html direto" pararia de funcionar. O preço é escopo global compartilhado e
ordem dos `<script>` significativa (ver o fim do `index.html`).

O argumento de cada ferramenta está em `tools/README.md`. O que existe:

| Ferramenta | Para quê |
|---|---|
| `open sprites.html` | galeria de arte: toda a pixel-art nas funções de render do jogo. Arte órfã cai em "Sem uso" |
| `open icons.html` | folha de contato dos ícones nos três tamanhos, mais a tira — é na tira que a repetição aparece |
| `open vfx.html` | galeria de animações: uma cena viva por mecânica. Mecânica sem tell ganha tarja laranja |
| `DRIVER=driver_preview.js node tools/harness.js .` | monta as sete telas de UI a partir de builds de verdade, em `tools/telas-preview.html` |
| `DRIVER=driver_bench.js ...` | banco de provas: a peça sozinha, spawner desligado, dummies em posição conhecida. É onde a régua do level up é conferida (`REGUA x CAMPO`) |
| `DRIVER=driver_balance.js ...` | "esta RUN funciona?" — 5 políticas de bot, sobrevivência, pool, capstone |
| `DRIVER=driver_autopsy.js ...` | "morri DE QUÊ?" — reparte cada ponto de vida perdido por inimigo nomeado |
| `DRIVER=driver_aspect.js ...` | o pisca: põe o jogador na BORDA da condição de aspecto e sacode em volta dela |
| `DRIVER=driver_class.js ... 12` | uma classe fecha a própria progressão, e nada vaza entre classes |
| `DRIVER=driver_trigger.js ...` | o contrato de cada gatilho — trigger errado roda, não estoura, e parece o `autonomous` |
| `node tools/browser.js` | a única verificação num browser de verdade (o stub de canvas do harness aceita tudo). `bench` mede ms/quadro, `shot` compara pixel a pixel. Fora do `run-all.js`: playwright mora fora do repo |

## Mapa dos arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | CSS, markup e a lista ordenada de `<script src>` |
| `sprites.html` | galeria de toda a arte gerada em runtime — revisão visual, fora do jogo |
| `vfx.html` | galeria de tudo que se mexe: uma cena viva por mecânica, com o que não anima marcado |
| `js/util.js` | helpers puros (`xpForLevel`, `fmtNum`, `hexRgb`, `deepClone`, `setPath`) |
| `js/version.js` | `VERSION` + `CHANGELOG` + `CHANGELOG_TIPOS` — a versão e o que entrou nela |
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
| `js/systems/aspects.js` | `ASPECTS` + `AspectSystem` — o subsistema do hunter |
| `js/systems/build.js` | `BuildSystem` — peças, eixos, caminhos, evoluções, passivas, capstones, ofertas |
| `js/hooks.js` | `HOOKS` — a escotilha de escape para o que não cabe em dado |
| `js/content/paths.js` | `HASTE`/`MASTERY`/`CRIT` — as três linhas de upgrade, geradas |
| `js/content/pieces.*.js` | o catálogo por eixo: 44 do warlock + 51 do hunter (9 delas só por evolução) |
| `js/content/{passives,capstones,minions}.js` | passivas, capstones e o tuning dos demônios |
| `js/content/hunter.meta.js` | as 8 passivas e os 8 capstones do hunter |
| `js/render/fx-shapes.js` | `FX_SHAPES` — o gerador de eventos em pixel (`bloom`, `implode`, `nova`, `rip`) |
| `js/render/tiles.js` | `TILE_ROWS` — as 8 lajes do chão, desenhadas em grade de 42x42 |
| `js/render/debris.js` | `PROP_ART` — os 7 destroços em grade, com a paleta de cada um |
| `js/render/scenery.js` | `Scenery` — chão, props por chunk, brasas, vinheta |
| `js/render/vfx.js` | `PIECE_VFX`, `VfxLayer`, `drawMinions`, `drawPieceOverlays` |
| `js/render/numbers.js` | `DamageNumbers` — o número de dano, o único desenho fora do buffer |
| `js/leaderboard.js` | `LB` + `Leaderboard` — recorde local, envio ao form, leitura da planilha |
| `js/ui-icons.js` | `UI_ICONS` — a grade 16x16 de cada peça, passiva e capstone |
| `js/ui-glyph.js` | `UI_PAL` + `Glyph` — a paleta da UI e o que substitui todo emoji |
| `js/ui.js` | `UI` — HUD, tela de level-up, tela de etapa, pausa, baú, game over |
| `js/game.js` | `Game` — estado, loop, funil de dano, colisões |

Ponto de entrada: `new Game()` no `DOMContentLoaded`, fim de `js/game.js`.

## Onde mora o porquê

| Doc | A pergunta que ele responde | Leia antes de mexer em |
|---|---|---|
| `docs/motor.md` | como conteúdo vira comportamento sem tocar no motor | `js/systems/`, `js/entities.js`, `js/game.js` |
| `docs/classes.md` | o que uma classe declara, e o kit do Hunter (tiro, quique, aspecto, formas) | `CLASSES`, `js/systems/aspects.js`, peças de uma classe |
| `docs/build.md` | as três linhas, o gate de eixo, o pacto, o Ápice | `js/content/paths.js`, `js/systems/build.js`, `AXIS_RULES`/`PATH_RULES` |
| `docs/telas.md` | a identidade da UI e as duas telas de escolha (level-up e etapa) | `js/ui.js`, `js/ui-glyph.js`, `js/ui-icons.js`, `js/systems/dps.js`, CSS do `index.html` |
| `docs/render.md` | o grid de pixel, o impacto, e o que cada mecânica desenha | `js/render/`, desenho de `js/entities.js`, `Game.render` |
| `docs/arte.md` | a paleta mestre, sprite novo e o cenário | `js/sprites.js`, `js/render/tiles.js`, `js/render/debris.js`, `AXIS_PALETTE` |
| `docs/balanceamento.md` | por que a horda é densa e frágil, e de que o jogador morre | `ENEMIES`, `BALANCE.spawn`, `xpForLevel`, número de dano do catálogo |
| `docs/audio.md` | as vozes, as duas trilhas e os três assets | `js/voices.js`, `js/music.js`, `js/track.js`, `audio/` |
| `docs/meta.md` | o placar sem servidor e o changelog | `js/leaderboard.js`, `js/version.js` |

Fora de `docs/`: `tools/README.md` (as ferramentas), `PLANO-RANKING.md` e
`PLANO-VFX.md` (o que ficou de fora e por quê).

## As regras

Cada linha aqui é a conclusão de uma seção de `docs/`. Quando uma delas parecer
arbitrária, **o argumento existe** — vá lê-lo antes de contrariá-la.

### Motor e dado — `docs/motor.md`

- **Conteúdo é dado, motor é genérico.** Peça, passiva, capstone e demônio novos
  são entrada num registry. Zero mudança no motor.
- **`key` é a identidade estável, `id` é a aparência.** `id`, `name`, `trigger` e
  `effects` mudam na evolução; `key` nunca — ela é o `source` no funil de dano, a
  guarda anti-recursão e a origem dos eventos.
- **Números só existem em `stats`.** Trigger e efeitos apontam com `"@nome"`,
  `"@nome*3"`, `"@nome+2"`. Número cru em `trigger`/`effects` faz o tier que
  mexeria naquele valor virar no-op.
- **O pipeline roda uma vez por AQUISIÇÃO, não por tique**; o resultado fica em
  `inst.r`. Em runtime nada é parseado e nada é alocado por frame.
- **Cada linha de upgrade escreve num índice reservado de `effects`**, e a lista
  fica esparsa: todo laço sobre ela precisa de `if (!e) continue`.
- **Todo dano em inimigo passa por `damageEnemy`.** Enquanto os eventos de um
  acerto são despachados, `game._chain` impede um reativo da mesma `key` de
  disparar; `MAX_FX_DEPTH` é o backstop.
- **Todo agendamento usa `game.clock`.** `update(dt)` roda várias vezes por frame
  (sub-stepping) — trigger que contasse frames dispararia 2–4× por frame no 3x.
- **Marcar e varrer, nunca remover no meio do laço.** Congele `const n =
  list.length`, marque `dead = true`, e no fim `pool.sweep(DEAD)`. Vale para
  `dots`, `projectiles`, `areas`, `minions` e `enemies`.
- **A ordem das chamadas em `Game.update` é significativa.** `SpatialGrid` é
  reconstruído em `updateEnemies`, que roda antes de `build.tick`. Consulta
  espacial nunca é varredura linear sobre `enemies.active`.
- **Canvas desenha o mundo, DOM desenha a UI.** Efeito nunca chama `ctx.`: emite
  `game.emitVfx(...)`. A ordem em `Game.render()` **é** a ordem de profundidade.
- **O `desc` de uma peça diz o MECANISMO, não o clima**: como dispara, depois o
  que faz. Sem número (quem diz quanto é `stats`) e sem piada de identidade.

### Classes — `docs/classes.md`

- **Um namespace só**, e `cls` explícito em toda entrada. Não há default: peça
  sem dono cai no catálogo da outra classe, em silêncio.
- **Itere `build.axes`, nunca `AXES`** — `AXES` é a união de todas as classes.
  Um eixo pertence a uma classe só.
- **`starters` é uma spell por eixo**, com dano na base, sem `requires` e sem
  `evolutionOnly` — senão a abertura decide o eixo antes de o jogador escolher.
- **Classe jogável declara `forms`.** `DEFAULT_FORMS` desenha o warlock, e existe
  só para quem monta um `Player` fora de uma run. Cobertura de capstone é tudo ou
  nada: forma única é uma posição, cobertura pela metade é um defeito.
- **Aspecto não mexe em stat** — o pipeline é de aquisição. Ele escreve em canal
  vivo, lido no ponto de uso.
- **Condição de aspecto se mede na run**, e declara `on`/`off` distintos: o vão
  entre os dois é a histerese, e `driver_aspect` reprova `on === off`.

### A build — `docs/build.md`

- **Toda peça sobe pelas mesmas três linhas.** Tiers 1–4 saem de
  `HASTE`/`MASTERY`/`CRIT`; o tier 5 é escrito à mão e carrega a assinatura.
- **Degrau novo se mede pelo PRIMEIRO, não pelo total.** Linha cujo primeiro
  degrau vale menos que `1.3x` não é mais lenta — é uma linha que a run não paga.
- **Toda peça precisa de número DESDE A COMPRA**: no instante em que é comprada
  ela tem que fazer a coisa que as três linhas multiplicam.
- **Linha nova não pode ser só dano.** Com as três linhas ofensivas, o sustain
  precisa estar na BASE das peças que o têm e crescer com elas.
- **Crítico garantido não é payoff sozinho.** Peça com condição de disparo precisa
  afrouxar a condição no mesmo tier que crava `crit: { set: 1 }`.
- **O sorteio de crítico mora em `Game.damageEnemy`**, nunca dentro de um efeito.
  Peça sem dano dobra o número principal via `critRoll`.
- **Pool de 20, teto de 15 por eixo, no máximo 2 eixos** (o pacto), gate de eixo
  de 1/5/10 pontos nos tiers 3/4/5, no máximo 2 caminhos por peça acima do tier 2.
- **Ponto de eixo só vem de etapa.** Nada no level-up pode chamar `addAxis` —
  `driver_cards` compara o pool antes e depois de toda escolha.
- **Quem credita eixo é `addAxis`**, e por isso o pacto e o Ápice moram lá: baú,
  capstone e fonte futura respeitam os dois de graça.
- **Carta que credita +0 não é oferta, é botão morto** — o sorteio pula.

### As telas — `docs/telas.md`

As cinco regras da identidade visual, e tela nova que respeitar as cinco vai
parecer deste jogo:

1. **O cromo é osso.** Zero roxo em botão, borda, foco ou fundo.
2. **Cor é predicado.** Verde/roxo/laranja só quando aquele pixel fala de um
   eixo. Vermelho só na barra de vida, no relógio da fase dura e no game over.
3. **Placa, não card.** Canto chanfrado, fundo chapado, 1px claro em cima e 1px
   escuro embaixo. Nada de `border-radius`.
4. **Brilho é orçamento.** Nada de `filter:blur`, `text-shadow`, `backdrop-filter`
   ou `box-shadow` projetada.
5. **Ícone sai do gerador do mundo.** Nenhum emoji, em lugar nenhum.

E mais:

- **Duas telas de escolha, e não podem voltar a ser uma.** Level-up **aprofunda**
  (não custa nada, o mundo fica vivo atrás a 8%); etapa **compromete** (é a única
  fonte de ponto de eixo, apaga o canvas, e não desfaz).
- **Preenchimento é custo.** Nunca dois botões cheios na mesma tela; o **selo**
  (cor de eixo cheia) só existe onde a resposta não volta.
- **Nada abaixo de 14px, nada arredondado, alvo de clique de 44px**, `min-height`
  nunca `height`, e piso de três famílias tipográficas (display / texto / mono).
- **Nenhum texto novo por tier.** A carta se monta do que já existe: `tier.mods`
  sobre `inst.r.stats` no antes → depois, `STAT_FMT` na unidade. Mod em stat fora
  de `STAT_FMT` é reprovado.
- **Tier numérico não escreve parágrafo** — quem fala por ele é o próprio upgrade
  (`dano 175 → 263`). Parágrafo é só de tier estrutural e passiva.
- **A coordenada do tier é desenho, não texto.** Os pips já a dizem; escrevê-la ao
  lado deles é o mesmo fato duas vezes na mesma carta.
- **A régua (`js/systems/dps.js`) lê a instância RESOLVIDA**, o campo dela é dado
  em `BALANCE.dps`, e ela promete **ordem**, não valor. `driver_bench` confere.
- **O HUD tem cinco lugares fixos e nada no meio** (a cadeia é a exceção, e só
  porque não está sempre lá).

### Render e arte — `docs/render.md`, `docs/arte.md`

- **Tudo que é feito de células passa por `drawSprite`/`drawSpriteRim`/
  `drawSpriteGlow`/`drawPixelCanvas`.** Blit de pixel art com `ctx.drawImage`
  direto está fora do grid e vai fervilhar.
- **Tamanho de sprite é degrau, nunca contínuo** (`linhas × PIXEL_UNIT`), e o
  `step` é o MESMO para todo o elenco. Não cabe num degrau? Redesenhe a grade.
- **Nada de rotacionar nem espremer sprite: movimento é pose.** Quem anima são
  quadros (`walkFrames`), escolhidos por `anim.frame`.
- **Hierarquia de leitura**, e ela decide todo adorno novo: o personagem primeiro,
  depois o que decide a jogada, depois feedback de estado, depois o cenário.
  Pergunte quantos do efeito novo cabem em tela ao mesmo tempo.
- **Nenhuma cor cravada no render.** Tudo sai de `PAL`, `AXIS_PALETTE`, `UI_PAL`
  ou do dado da peça. Cor de inimigo e de demônio se **referencia**, não se copia.
- **Matéria é dessaturada, energia é saturada** (teto de 14% dos pixels por
  grade); **rampa desloca matiz** (mín. 8°); **rampa é compartilhada, a fatia
  não**; **luz de cima-à-esquerda**, sempre.
- **Evento visual novo exige voz nova** (`VOICES`) — não existe registry de som
  por peça, e não pode existir.
- **Mecânica que cobra, avisa**, num dos três formatos: marca de 9×9 (estado do
  inimigo), evento de dois pontos (relação entre dois lugares) ou sobreposição
  presa ao corpo (estado do jogador que dura).
- **Dano contínuo não fala, não trava e não imprime número.** Tique de DoT e de
  área cobram por sub-step: fora da voz, fora do hitstop, fora do número de dano.
- **Estado se desenha enquanto dura; evento acontece e passa.** Emitir vfx a cada
  pulso para dizer "isto está ligado" é o erro.
- **Sprite novo: a imagem gerada é referência, o asset é a grade.** Nunca peça
  "pixel art" ao modelo — use `tools/make_sprite_prompt.py`.
- **Cenário é determinístico por posição** (`hash2(chunkX, chunkY)`), nunca por
  ordem de visita, e nada de gradiente por frame em código quente.

### Balanceamento — `docs/balanceamento.md`

- **Horda densa e frágil, ameaça no chefe.** O eixo do tuning é a sensação de
  rampagem: `maxAlive` alto, `hpGrowth` baixo, `bossHpExp` alto.
- **A curva de XP tem realimentação** (íngreme → menos escolhas → build fraca →
  menos XP). Mexer aqui pede `driver_balance`, não intuição.
- **Dreno permanente sem input mata**: `self_damage` nunca reduz abaixo de um
  piso. E `rooted` **drena** a carga ao andar, nunca zera.
- **Cobrança de inimigo tem que ver `scale.dmg`**, senão ela envelhece ao
  contrário. E a unidade que importa é a **janela**, não o frame.
- **Punição só é punição se houver escolha**: com movimento como único input,
  cobrança discreta precisa passar em "existe uma posição que evita isso?".
- **Não meça por média das políticas.** Três dos cinco perfis não miram por
  construção; quem responde pela saúde do clímax são `focado` e `misto`.

### Áudio — `docs/audio.md`

- **Nada é marcado para "agora".** `Music.update()` empurra uma fila com
  `lookahead` de 250ms; a trilha vive em tempo real e ignora `timeScale`.
- **`exponentialRampToValueAtTime` precisa de alvo e valor inicial > 0.**
- **Gap por voz, duck por leva, e distância corta antes de agendar.**
- **Nenhum arquivo de imagem novo.** Os três assets de áudio existentes têm plano
  B; áudio novo precisa de um também.

### Fora da run — `docs/meta.md`

- **Sem servidor, a validação do placar roda na LEITURA**, sem nenhuma constante
  copiada, e o que ela reprova vira contagem — nunca sumiço em silêncio.
- **Nome de jogador é conteúdo de terceiro**: passa por `UI.esc`.
- **`VERSION` cai de `CHANGELOG[0].v`**, nunca digitado, e não existe num segundo
  lugar.

## Convenções

- Nomes de domínio e comentários existentes estão em pt-BR (projeto pessoal).
  **Comentários novos, porém, sempre em inglês** — regra global do usuário.
- `"use strict"`, sem módulos, sem `export`. Tudo em escopo global.
- Peça nunca referencia `game` direto: só o contexto `c` que o efeito recebe.
  Se uma peça precisa de algo novo, adicione um efeito em `EFFECTS` ou um método
  em `Game`, não um acesso a `game` dentro do dado.
- Comportamento genuinamente imperativo vai para `js/hooks.js`, nomeado, e é
  referenciado por string — nunca `if` espalhado dentro das peças.
- **Mudança que sobe para a `master` mexe em `js/version.js`**: bumpe a versão
  e escreva a nota do que entrou, na mesma mudança. A régua do degrau e o fluxo
  estão em `docs/meta.md`.

## Como adicionar uma peça nova

1. Escolha o arquivo de `js/content/` pelo eixo.
2. Adicione a entrada em `Object.assign(PIECES, { ... })` seguindo o schema
   (em `docs/motor.md`).
3. `key` igual ao `id`, a menos que seja evolução de outra peça. E **`cls`
   explícito** — não há default: peça sem dono cairia no catálogo da outra
   classe e ninguém veria. O `axis` tem que ser um dos três de `cls`.
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
