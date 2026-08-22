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
| `js/util.js` | helpers puros (`xpForLevel`, `fmtNum`, `hexRgb`, `deepClone`, `setPath`) |
| `js/balance.js` | `BALANCE`, `ENEMIES`, `AXES`, `AXIS_RULES`, `PATH_RULES`, `CLASSES`, `ITEMS` |
| `js/sprites.js` | `SPRITE_DATA` + geração de pixel-art e do tile de chão em runtime |
| `js/engine.js` | `Pool`, `SpatialGrid`, `Sfx`, `InputManager`, `Camera`, `EventBus`, `EVENTS` |
| `js/music.js` | `MUSIC` + `Music` — trilha procedural (a **reserva**) |
| `js/track.js` | `Track` + `Soundtrack` — toca `audio/legion.mp3`, com fallback |
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
| `js/ui.js` | `UI` — HUD, cartas de level-up, pausa, baú, game over |
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

### Regras estruturais que forçam comprometimento

- Pool de **20** pontos de eixo, teto de **15** por eixo → impossível maximizar dois.
- No máximo **2** caminhos por peça passam do tier 2 → impossível maximizar três.
- Passivas podem declarar `exclusive` → `Fúria Contida` e `Pés de Cinza` nunca coexistem.
- Peça com `requires` só é oferecida depois que a habilitadora está na build.
- O kit inicial da classe entra **de graça** (`acquirePiece(id, true)`), para o
  pool de 20 ficar inteiro para as escolhas do jogador.

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
regras diferentes, e a diferença é `file://`:

| Asset | Como carrega | Por quê |
|---|---|---|
| `audio/battle-march.mp3` (trilha) | `<audio src>` em `js/track.js` | `fetch`/XHR são bloqueados em `file://` (origem opaca); elemento de mídia com caminho relativo carrega. Volume por `.volume`, não por GainNode — `createMediaElementSource` sobre mídia de origem opaca sai em silêncio. |
| osso quebrando (efeito) | base64 → `atob` → `decodeAudioData` | Precisa sobrepor e variar de tom dezenas de vezes por segundo; `<audio>` não dá isso. Base64 não passa por rede, então funciona em `file://`. 21 KB. |

**Os dois têm fallback e o jogo nunca fica mudo:** `Soundtrack` cai para a
trilha procedural se o mp3 não carregar (e a procedural cobre o menu enquanto
o arquivo baixa), e `Sfx.death` volta aos estalos sintéticos se a amostra não
decodificar. Os drivers `driver_track` e `driver_audio` testam esses caminhos.

**Modo de repetição da trilha.** `Track` tem dois, e escolher errado estraga a
faixa. `seamless` (padrão) usa `loop = true` nativo, para faixa montada para
emendar — é o caso da atual, que começa e termina no talo. `{ crossfade: 3.5 }`
usa dois elementos que se cruzam no fim, para faixa que *não* emenda. Cruzar uma
faixa que já emenda é pior que não fazer nada: num loop de 11s, 3,5s de
cruzamento sobrepõem um terço da faixa com ela mesma e dobram a batida.

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
