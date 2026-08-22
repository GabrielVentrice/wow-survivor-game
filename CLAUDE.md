# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Survivors-like (Vampire Survivors) com tema WoW, classe Warlock. **Todo o jogo vive em um único `index.html`** (~2.6k linhas): CSS, markup e o JS inteiro num `<script>` inline. Sem build, sem dependências, sem package.json, sem testes, sem git.

## Rodar

```bash
open index.html                 # abre direto no browser (file:// funciona, zero deps)
python3 -m http.server 8000     # alternativa se precisar de http://
```

Não há build/lint/test. Verificação = abrir no browser e jogar. Reload manual após cada edit.

## Layout do arquivo

O `<script>` é dividido em 5 blocos marcados por banners `/* ===== NOME ===== */` (linhas aproximadas, vão driftar):

| Bloco | ~Linha | Conteúdo |
|---|---|---|
| `CONFIG` | 516 | `BALANCE`, `ENEMIES`, `CLASSES`, `SPELLS`, `BUFFS`, `ITEMS`, `COMBOS` — data pura |
| `ASSETS` | 1005 | `SPRITE_DATA` + `makeSprite`/`makeGroundTile` — pixel-art gerada em runtime |
| `ENGINE` | 1218 | `Pool`, `SpatialGrid`, `Sfx`, `InputManager`, `Camera` |
| `ENTIDADES` | 1389 | `Player`, `Enemy`, `Projectile`, `XPOrb`, `Pickup`, `Particle`, `AreaEffect`, `SpawnManager`, e os 4 systems (`Ability`, `Buff`, `Upgrade`, `Combo`) |
| `GAME` | 1836 | `class Game` — estado, loop, máquina de estados, HUD |

Ponto de entrada: `new Game()` no `DOMContentLoaded`, no fim do arquivo.

## Arquitetura

### Conteúdo é data, não código

Adicionar uma spell = uma entrada em `SPELLS`; um inimigo = uma entrada em `ENEMIES`; um buff = uma entrada em `BUFFS`. Nada mais precisa mudar — os systems iteram sobre esses objetos. Toda constante de tuning (velocidade do player, curva de spawn, quando o boss entra) mora em `BALANCE`.

Uma spell é `{ id, name, tags, icon, color, maxLevel, stats(l), desc(l), tick(dt, api, inst) }`. O `tick` é o auto-cast — não existe input de ataque, tudo dispara sozinho por cooldown em `inst.timer`.

### O pipeline de stats é o contrato central

```
def.stats(level)                    // números base, crus
  → Game.buffedStats()              // multiplica pelos BuffSystem.mods
    → aplica COMBOS[].empower       // multiplicadores do combo, se desbloqueado
```

Duas consequências que quebram tudo se ignoradas:

1. **Dentro de `tick`, sempre `api.stats(this, inst.level)` — nunca `this.stats(level)`.** Chamar `stats` direto pula buffs e combos silenciosamente; a spell simplesmente para de escalar.
2. **Os nomes dos campos são a interface.** `buffedStats` só conhece `damage`, `dps`, `cooldown`, `tickInterval`, `count`, `radius`, `duration`. Um stat com outro nome é invisível para os buffs. Dano vai em `damage` (instantâneo) ou `dps` (contínuo) — não invente `hitDamage`.

`BuffSystem.recompute()` reconstrói o objeto de modifiers do zero a partir dos buffs possuídos a cada aquisição; `apply(m, level)` recebe o nível **acumulado**, não o incremento.

### Combos: dois canais de efeito

Combo = par SPELL+BUFF em níveis mínimos (`requires`). `ComboSystem.check()` roda após cada escolha de level-up e devolve os recém-desbloqueados (viram toast). O efeito chega de duas formas, e a maioria dos combos usa as duas:

- **Declarativo** — `empower: { spell, damage, cooldown, area, duration }` multiplica os stats via `buffedStats`.
- **Imperativo** — `if (api.hasCombo("id"))` dentro do `tick` da spell (muda o comportamento: perfura, cai em dobro, cura mais), ou dentro de `Game.damageEnemy` (Demonic Pact, Unstable Affliction).

### `damageEnemy(e, amount, source)` é o funil de dano

Todo dano passa por aqui, e o `source` (id da spell) tem três papéis: chave do medidor de dano (`abilities.record`), guarda anti-recursão, e trigger de efeitos.

Corruption é um **DoT passivo**: seu `tick()` é vazio e ela é aplicada dentro de `damageEnemy` sempre que qualquer outra spell acerta. Por isso `source !== "corruption"` é o guard que impede o DoT de se re-aplicar em loop. Ao criar uma spell nova, passe um `source` correto ou ela some do medidor e não propaga Corruption.

### Loop e sub-stepping

`requestAnimationFrame` → `dt` clampado em 0.1s → multiplicado por `timeScale` (1x/2x/3x escolhido no menu) → consumido em passos de no máximo 0.025s. **`update(dt)` roda várias vezes por frame.** Qualquer coisa temporal usa `dt`; contar frames quebra nas velocidades 2x/3x.

`update()` faz early-return se `state !== PLAYING` — pause, level-up, baú e game over congelam a simulação sem parar o `render()`.

### Pooling e grid

Toda entidade transiente (`enemies`, `projectiles`, `orbs`, `areas`, `particles`, `pickups`) vem de um `Pool` com free-list; `release(i)` faz **swap-and-pop**, então loops que liberam elementos precisam iterar de trás pra frente. O objetivo é zero alocação no loop — evite criar objetos/arrays por frame em código quente.

O `SpatialGrid` é limpo e reconstruído a cada frame dentro de `updateEnemies`; `api.forEnemiesInRadius` usa ele. Já `api.nearestEnemy`/`nearestEnemies` são varredura linear sobre todos os inimigos — barato o bastante hoje, mas não chame em loop aninhado.

### Canvas desenha o mundo, DOM desenha a UI

O canvas só renderiza mundo. HUD, menus, cartas de level-up, toasts de combo, medidor de dano e tela de baú são HTML no `<body>`, mostrados/escondidos pela classe `.hidden` e atualizados por `Game.updateHUD()` / `updateAbilityBar()` / `updateDamageHud()` (esse último throttled a 4x/s). Elemento novo de UI = markup no `<body>` + ref em `this.ui`.

A ordem das chamadas em `render()` **é** a ordem de profundidade (chão → áreas → orbes → pickups → inimigos → partículas → player → projéteis → overlays de habilidade).

### Zero assets externos

Sprites saem de grids ASCII em `SPRITE_DATA` (`pal` mapeia char→hex, `.` e espaço = transparente); `makeSprite` também gera uma silhueta branca usada no flash de dano. O chão é um tile procedural repetido via `CanvasPattern`. O som é WebAudio procedural (`Sfx`, toggle com M). Não adicione arquivos de imagem/áudio — mantenha tudo gerado em runtime.

## Convenções

- Nomes de domínio e comentários existentes estão em pt-BR (é um projeto pessoal). **Comentários novos, porém, sempre em inglês** — regra global.
- `"use strict"`, sem módulos, sem `export`. Tudo em escopo global do `<script>`.
- Spells nunca tocam o `Game` direto — só o objeto `api` (`buildApi()`). Se uma spell precisa de algo novo, adicione o método em `api`, não referencie `game` no `tick`.
- `CLASSES` já tem Mage e Hunter como `available: false` (placeholder de UI). O `spellPool` da classe define quais spells entram no sorteio de level-up.

## Nota

Encontrei config do Gemini CLI em `~/.gemini`. Se quiser importar (MCP servers, comandos, skills, instruções), responda `/import` — ele lista o que é importável e depois você aplica com `/import --yes=<digest>`.
