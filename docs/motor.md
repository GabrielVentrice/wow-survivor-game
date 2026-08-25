# O motor: dado, pipeline e laços

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `js/systems/`, `js/entities.js` ou `js/game.js`.

## Conteúdo é dado, motor é genérico

Adicionar peça = adicionar entrada em `PIECES` (num arquivo de `js/content/`).
Zero mudança no motor. Mesma coisa para passiva, capstone e tipo de demônio.

Schema de uma peça:

```js
{
  id, cls, key, name, color, axis, axisPoints, tags, desc,
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

## `key` é a identidade estável, `id` é a aparência

`id`, `name`, `icon`, `trigger` e `effects` mudam na evolução. **`key` nunca.**
É a `key` que serve de `source` no funil de dano, e ela tem três papéis:
chave do medidor de dano, guarda anti-recursão e origem dos eventos. Uma
evolução com `key` diferente da forma base zera o medidor e quebra os efeitos
ligados à fonte — o validador do harness rejeita isso.

**E a evolução carrega os MESMOS ids de caminho da forma base.** Não é
convenção: `inst.paths` sobrevive à troca, então um caminho que a forma nova
não declarasse ficaria com o contador preso num objeto que ninguém lê — e os
tiers já comprados deixariam de ser aplicados. O que muda entre as duas é o
CONTEÚDO dos tiers, nunca a chave deles. O validador cobra
(`falta o caminho "<id>" da forma base`), e é isso que faz o tier 3 comprado
como Arcane Shot continuar valendo depois de virar Aimed Shot.

**A CORRENTE de duas evoluções.** `Arcane Shot → Aimed Shot → Kill Shot` é a
primeira peça do jogo que evolui duas vezes, e ela só é possível porque as duas
regras acima seguram: a `key` é `arcaneShot` nas três formas e os ids de
caminho — que desde as três linhas são sempre `haste`/`mastery`/`crit` —
atravessam inteiras.

Três coisas caem daí:

- **A segunda evolução sai de um caminho DIFERENTE do primeiro.** O que evoluiu
  já está no tier 5 e não sobe mais, então a corrente precisa de dois caminhos
  fechados — e `PATH_RULES.maxDeep` permite exatamente dois. Ela cabe com folga
  zero, que é o comprometimento que ela cobra. Na corrente do Arcane Shot a
  primeira conversão mora em `mastery` e a segunda em `crit`.
- **O medidor de dano atravessa as duas trocas**, porque a `key` não muda.
  Medido em `driver_evo`: 6420 como Aimed Shot → 24470 como Kill Shot, mesma
  entrada de `damageBy`.
- **Uma corrente é uma decisão de conteúdo, não uma mecânica nova.** O motor já
  fazia isso desde sempre; ninguém tinha declarado dois `evolvesInto` na mesma
  linhagem.

**E o que a evolução custa, medido — contra a outra classe, sempre.**
`driver_class ... imortal 5 ambas`, política de level-up aleatória:

| | warlock | hunter |
|---|---|---|
| pool ao fim (mediana) | 20/20 | 8/20 |
| abates (mediana) | 19,3 mil | 3,3 mil |
| runs com capstone | 4/5 | 1/5 |
| runs com evolução | 2/5 | 1/5 |

**Sem a coluna do warlock nenhum desses números quer dizer nada**, e é por isso
que o regime `ambas` existe. Uma medida só do hunter diz "a pool fecha em 11/20"
e não diz se a do warlock fecha em 20 ou em 11 — sem a linha de base, todo
número deste driver vira regressão aparente na primeira vez que o
balanceamento do jogo inteiro se mexe.

(Cinco seeds é pouco, e mexer no catálogo desloca todo sorteio seguinte: entre
duas medidas o hunter oscilou entre 8/20 e 11/20 sem nenhuma mudança de
balanceamento entre elas. O que não oscila é a distância para a coluna do
warlock, que ficou idêntica nas duas.)

O que a tabela diz é que **o hunter fecha a progressão pior que o warlock, por
cerca de 3× em abates**, e abate é a moeda do marco. Três coisas que a causa
**não** é, cada uma descartada por medida:

- **Não é peça fraca.** No `driver_bench` o catálogo do hunter rende mais que o
  do warlock nos seis cenários (pico mediano fechado 3,1k contra 1,2k), e os
  tetos são da mesma ordem (rainOfFire 165k e incinerate 52k contra
  explosiveShot 76k e trueshotAura 32k).
- **Não é a abertura.** As três spells iniciais do hunter batem mais que as do
  warlock no tier 0 (killCommand 90/500/610/1300 contra corruption 28/27/103/15).
- **Não é o corpo.** `CLASSES.hunter.base` tem mais vida e mais passo que o do
  warlock (110/250 contra 100/240).

O que sobra é a **conversão na horda densa**: numa run de 8 min o warlock põe
28,5M de dano com 17 peças, todas registrando dano, e o hunter põe 5,0M com 13.
Quem mede isso é `driver_balance` — com políticas e seeds —, não este driver, e
enquanto ninguém rodar essa bateria com o hunter o número acima é um diagnóstico
em aberto, não um alvo já perseguido.

Sobre evolução especificamente: só 9 das 51 peças do hunter têm caminho que
evolui, e o tier 5 pede 10 pontos no eixo DA PEÇA — é a mesma escolha que a
separação das duas telas documentou ("o custo é profundidade").

**E `driver_class` não responde sobrevivência.** O regime `mortal` roda as duas
classes com a mesma política de movimento e as duas morrem em 0,3 min — o que
esse número mede é o círculo que o bot anda, não a classe. Quem mede tempo de
vida é `driver_balance`, que tem políticas para isso.

## O pipeline de stats

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

## Trigger é o que diferencia as peças

Com input só de movimento, é o trigger que decide como a peça reage ao
jogador — `rooted` pune andar, `trail` premia andar, `aura` premia ficar no
meio da horda, `auto_target` não pede nada. Trocar `trigger.type` por dado muda
o comportamento sem tocar em código: é literalmente o que a evolução faz.

Todo agendamento usa `game.clock` (relógio de simulação). **`update(dt)` roda
várias vezes por frame** (sub-stepping) — um trigger que contasse frames
dispararia 2–4× por frame em timeScale 3x.

**Trigger novo é uma entrada em `TRIGGERS`, e nada mais.** O Hunter trouxe três,
e cada um existe por uma regra que o `autonomous` não tem — sem ela seria uma
cópia com outro nome, que é exatamente o que `driver_trigger` reprova:

| trigger | a regra que o faz existir |
|---|---|
| `leading` | cai **à frente**, no vetor de movimento, e **não desliga quando o jogador para** |
| `pack` | nasce em **leva** e reparte o leque de formação em slots |
| `trap` | fica **inerte** até alguém pisar; carga é o que está plantado, não um contador |

**`leading` é `directional` menos uma linha, e a linha é a peça.** `directional`
exige `p.moving` porque a mira *é* o deslocamento; `leading` é antecipação —
cobra o chão para onde o jogador está indo. Parar de andar não pode desligá-lo,
senão a bomba some exatamente quando o jogador estanca para deixar a horda
chegar. A regra "parado, usa a última direção válida" não precisa de estado
próprio: `p.dirX/dirY` já *é* o último vetor não-nulo normalizado.

**No `pack`, o `angle` do spawn é o número do slot — e quem o reparte é o
trigger.** `MINION_AI._slot` e `MINION_AI.flank` usam `m.angle` como identidade
de posição, e `MinionSystem.summon` sorteava a fase. Sorteando, dois bichos
caem no mesmo ponto do flanco e a matilha volta a ser um borrão. Só o trigger
sabe quantos vão existir, então é ele que reparte — via `c.slot`, que
**`pushCtx` zera na fonte**: a pilha de contexto é reaproveitada, e um campo
opcional que só um trigger escreve vaza para a próxima peça daquela
profundidade. `_told` já ensinou isso uma vez.

E nascer em leva não é estética: com `interval` de 6s e `count` 5, entrando um
por vez, os dois primeiros já morreram quando o quinto chega — a matilha nunca
está em campo inteira, que é a única coisa que o eixo Matilha mede.

**A armadilha é uma `area_persistent` com `armed: true`.** O motor já tinha
posição fixa, raio, vida, consulta pelo grid e payload; o que faltava era o
estado inerte. Quatro regras caem daí, e a primeira foi um bug medido:

- **Carga é o que está ESPERANDO, e `countArmed` filtra por isso.** Contando
  toda zona da peça, a poça que a própria armadilha abre entra na conta — mesma
  `source` — e consome a própria carga: com `charges: 2` e uma poça de 6s no
  chão, a peça parava de rearmar até a poça vencer. A contagem mora no mundo e
  não num contador do trigger porque **o trigger não é avisado quando a
  armadilha dispara**; contador local sairia do ar no primeiro inimigo que
  pisasse.
- **Quem pisou vira `c.target` do `onEnd`.** Sem isso `Freezing Trap` congelaria
  "o raio" e não o corpo, e todo efeito que mira perderia o único alvo que a
  armadilha tem certeza de ter. Poça que expira continua sem alvo — não há um.
- **Vencer o prazo NÃO detona.** Detonar no vencimento faria o `onEnd` virar o
  comportamento normal da peça, e ela deixaria de cobrar posicionamento.
- **A busca é gasta no `tickInterval`, não por sub-step.** Por sub-step seriam
  3–4 consultas de grid por armadilha por frame, e a horda não atravessa um raio
  de 70 unidades em 0,1s.

**E a armadilha é VISÍVEL** (`look: "trap"` — aro tracejado com quatro presas
apontando para dentro, no raio real). É a mesma objeção do meteoro sem sombra no
chão: com input só de movimento, armadilha escondida não muda decisão nenhuma
do jogador, ela vira sorteio. O aro fica no raio exato como o de toda zona,
porque é ele que informa onde o efeito pega.

**`MINION_AI.flank` é a outra metade do `pack`.** `chase` leva todo bicho pela
mesma linha — a que liga ele ao inimigo mais próximo —, então cinco bichos
empilham no mesmo lado e a matilha lê como um bicho grande e borrado. O que faz
cinco parecerem uma matilha é chegarem por lados **diferentes**. O deslocamento
do slot **morre conforme o bicho chega**: longe ele corre para o flanco dele,
perto ele fecha no corpo — sem essa morte ele orbitaria o alvo sem encostar, que
é o defeito que tirou a órbita de todo demônio com passo próprio. E o raio do
cerco sai do `radius` do alvo, não de tabela: cercar um ghoul e cercar um chefe
são distâncias diferentes.

## `damageEnemy(e, amount, key, big, dotKey)` é o funil

Todo dano em inimigo passa por aqui. Enquanto os eventos de um acerto estão
sendo despachados, a `key` fica em `game._chain` e um trigger reativo daquela
mesma key não dispara. É a generalização do antigo `source !== "corruption"`:
sem ela, um DoT que aplica DoT trava o browser. `MAX_FX_DEPTH` é o backstop.

## O DoT pode vencer com o corpo, e é `clear()` que cobra

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

## Marcar e varrer, nunca remover no meio do laço

Um efeito disparado durante a varredura de um pool pode acrescentar entidades
**ao mesmo pool** — DoT que aplica DoT, projétil que gera projétil, demônio que
invoca demônio. Com `release()` dentro de um laço que cresce, o índice nunca
alcança o fim e o frame trava.

Padrão obrigatório nesses laços: congelar `const n = list.length`, iterar até
`n` marcando `dead = true`, e no fim chamar `pool.sweep(DEAD)`. Vale para
`dots`, `projectiles`, `areas`, `minions` e `enemies`.

## Consultas espaciais

`SpatialGrid` é limpo e reconstruído dentro de `updateEnemies`, que roda **antes**
de `build.tick`. A ordem das chamadas em `Game.update` é significativa.

`nearestEnemy`/`nearestEnemies`/`nearestRangedEnemy`/`nearestEnemyExcept` passam
todas pelo grid — nada de varredura linear sobre `enemies.active`.

## Canvas desenha o mundo, DOM desenha a UI

O sistema de efeitos **nunca** chama `ctx.`: ele emite `game.emitVfx(kind, x, y,
r, color)` e `js/render/vfx.js` consome. HUD, cartas, pausa, baú e medidor de
dano são HTML, atualizados por `js/ui.js`. Elemento novo de UI = markup no
`index.html` + ref em `UI.el`.

A ordem das chamadas em `Game.render()` **é** a ordem de profundidade.

