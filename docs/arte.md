# A arte: paleta mestre, sprites e cenário

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `js/sprites.js`, `js/render/tiles.js`, `js/render/debris.js` ou `AXIS_PALETTE`.

## A paleta mestre: uma paleta, não dezenove

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

## Sprite novo: a imagem gerada é referência, nunca o asset

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

## Uma build, uma família de cor

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

## Cenário: determinístico por posição, nunca por ordem de visita

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

