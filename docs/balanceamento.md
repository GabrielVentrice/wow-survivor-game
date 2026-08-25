# Balanceamento: a horda, a curva e a autópsia

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `ENEMIES`, `BALANCE.spawn`, `xpForLevel` ou em número de dano do catálogo.

## Balanceamento: mais corpos, menos vida cada

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

## A autópsia: média de dps não enxerga morte instantânea

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

