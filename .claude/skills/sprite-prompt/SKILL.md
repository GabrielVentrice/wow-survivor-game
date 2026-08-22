---
name: sprite-prompt
description: Gera o prompt de imagem (para Gemini/qualquer modelo) de um sprite novo deste jogo, a partir de uma descrição solta do que o usuário quer. Escolhe rampa, fatia, tinta, acento, vista e tamanho de grade seguindo as regras da PAL, e imprime o prompt de silhueta e o prompt final prontos para colar. Use quando o usuário pedir "quero um inimigo/demônio/chefe novo", "faz o prompt pra eu gerar a arte de X", "/sprite-prompt", ou descrever uma criatura que ainda não existe no jogo.
---

# Prompt de sprite novo

O usuário descreve a criatura em linguagem solta. **Você decide os parâmetros
técnicos** — ele não deve precisar saber o que é `rot1` ou `inkWarm` — roda
`tools/make_sprite_prompt.py` e devolve os dois prompts prontos.

Task de leitura: **não crie worktree.** Nada aqui edita arquivo do jogo.

## 1. Leia o estado antes de escolher

```bash
sed -n '/^const PAL = {/,/^};/p' js/sprites.js          # a paleta de verdade
grep -n 'pal: { ' js/sprites.js                          # que fatias já estão em uso
```

Nunca invente hex nem token: o script lê a `PAL` sozinho, e o seu trabalho é
escolher **quais** tokens, não quais cores.

## 2. Decida os parâmetros

**Material do corpo → `--ramp`** (passe o primeiro passo; o script usa três
consecutivos):

| A criatura é feita de | rampa |
|---|---|
| carne apodrecida, verde, morto-vivo vegetal | `rot` |
| carne pálida, pele costurada, cadáver fresco | `meat` |
| osso, casco, quitina clara | `bone` |
| couro demoníaco roxo, manto, sombra encarnada | `vio` |
| couro laranja-ferrugem, pele chamuscada, brasa | `emb` |
| pele dourada, latão, criatura de coroa | `gold` |
| carne fria azul, void, afogado | `void` |
| pedra, entulho, golem | `stone` |
| aço, placa, construto | `steel` |

**`--second`** só quando há um segundo material com volume real: armadura
(`steel`), chifre/presa/garra (`bone`), asa de pedra (`stone`). Adorno de dois
pixels não é material — é acento ou nem entra.

**`--accent`** só aceita cor de **energia**, e a família diz de quem a
criatura é:

- do eixo Corrupção → `fel1`/`fel2` · Domínio → `arc1`/`arc2` · Cataclismo → `pyr1`/`pyr2`
- inimigo da horda (não é build de ninguém) → `blood1` olho vermelho, `gold2`
  olho dourado, `azure1` olho frio
- criatura sem nada aceso → **omita**. Bicho sem brilho é permitido e às vezes
  é a escolha certa.

Um acento, no máximo dois. O prompt já cobra o teto de 14% dos pixels.

**`--prop` — e o default é NÃO ter.** Sem a flag o prompt proíbe qualquer objeto
na mão, e isso é de propósito: um adereço comprido é a coisa que mais estraga
uma referência. A pá do ghoul veio segurada na horizontal, atravessando o dobro
da largura do corpo — no tamanho final ela vira **uma barra**, e ainda empurra o
corpo para fora do centro do enquadramento.

Só passe `--prop` quando o objeto for a identidade da criatura (o machado do
felguard, o cajado do conjurador), e saiba que o prompt vai exigir que ele seja
segurado **na vertical, colado ao corpo**. Nenhuma outra orientação sobrevive:
a 14 colunas, qualquer coisa atravessada some dentro de si mesma.

Se o adereço é característico mas não cabe na vertical, a decisão certa é
**deixar ele fora do prompt** e resolver na descrição — "gravedigger", "ghoul de
cemitério" — em vez de gerar uma imagem que vai ser recortada depois.

**`--ink`** pela temperatura do corpo: `cold` para void/steel/azul, `warm`
para rot/meat/emb/gold/stone, `deep` para vio e para corpo de material misto.

**`--view`**: bípede → `front`; besta de quatro patas, cão, serpente → `side`.
É a convenção que o próprio `SPRITE_DATA` já segue.

**`--grid`** pelo papel, não pelo gosto — e **personagem é vertical, bicho é
cabeçudo**. São duas famílias de proporção e elas não se misturam:

| Papel | grade | proporção |
|---|---|---|
| lixo da horda | `13x14` a `16x16` | cabeçudo, quase quadrado |
| elite / demônio invocado | `16x16` a `20x18` | cabeçudo, largo |
| chefe | `20x18` a `24x20` | cabeçudo, o mais largo de todos |
| **personagem / humanoide** | `11x16` a `13x20` | **vertical**, aspecto ~0.65 |

Personagem (forma do jogador, humano, conjurador) segue a proporção de um
corpo em pé: alto e estreito, com o capuz/cabeça em torno de **1/3** da altura.
Bicho segue o oposto — cabeça enorme, corpo curto, silhueta larga. Misturar as
duas faz o elenco parecer de dois jogos.

A outra regra: **ameaça se lê como tamanho antes de se ler como cor.** Nenhuma
criatura pode ser maior que um chefe. Em progressão de formas (aprendiz →
corrompido → demônio), cada degrau é uma linha ou duas a mais.

**Sprite que já existe tem a ALTURA trancada.** Trocar a arte de uma criatura do
elenco não é escolher grade nova: o número de linhas está amarrado ao `art`
(`ENEMIES`) ou ao `scale` (`MINIONS`), e mudar isso muda o tuning. Confira antes
de decidir:

```bash
grep -n -A3 '<id>:' js/balance.js            # art atual
awk '/^  <id>: \{/,/^  \},$/' js/sprites.js  # quantas linhas a grade tem hoje
```

Mantenha as linhas e a substituição sai com zero mudança de balanceamento. A
**largura é livre** — ela não entra na conta do degrau, então dá para alargar a
grade sem mexer em número nenhum.

**Dois pixels é o piso de qualquer coisa que precise ser lida como massa.** O
prompt já cobra isso do modelo, mas vale na hora de escolher a criatura: chifre,
presa, cauda, garra e antena desenhados com um pixel de espessura leem como
*linha*, não como parte do corpo. O ghoul passou uma rodada inteira parecendo
inseto por causa disso. Se a criatura só se distingue por um apêndice fino, ela
não se distingue neste tamanho — escolha outra assinatura.

## 3. Sobre fatia repetida

`CLAUDE.md` diz que a fatia é a identidade — mas hoje quase toda família já tem
as fatias tomadas (ghoul `rot0-2`, vilefiend `rot1-3`, e por aí). **Repetir
fatia é normal e não é defeito**: o que precisa separar duas criaturas é a
**silhueta**. Se ela não separa, o problema não é cor e trocar token não vai
resolver.

Só proponha estender uma rampa (`rot4`, etc.) se a criatura genuinamente não
couber em nenhuma família — e avise que isso mexe na `PAL` e passa por
`driver_palette`.

## 4. Rode e entregue

```bash
python3 tools/make_sprite_prompt.py --silhouette --name "<em inglês>" --grid <WxH> \
    --view <front|side> [--vary "o que varia entre as seis"]
python3 tools/make_sprite_prompt.py --name "<em inglês>" --grid <WxH> --view <front|side> \
    --ramp <tok> --ink <cold|deep|warm> [--second <tok>] [--accent <tok> ...] \
    [--living] [--prop "<objeto na mão>"]
```

**`--living`** sempre que a criatura estiver viva: sem ele o script descreve
`meat` como *"pale dead flesh, stitched skin"*, que é a descrição do
abomination, e o modelo desenha carne morta num humano vivo. Os hexes não
mudam — as palavras entregues ao modelo, sim.

**`--vary`** no prompt de silhueta quando a criatura tiver algo proibido: o
default fala de contorno e massa em geral, mas se as formas evoluídas do
personagem é que têm chifre e asa, peça a variação em outra coisa (formato do
capuz, barra do manto, postura) para as seis silhuetas não voltarem todas com
chifre.

`--name` **em inglês** e concreto — o modelo é treinado em inglês, e "a
plague-bloated gravedigger ghoul" devolve muito mais que "a ghoul".

Entregue nesta ordem:

1. Uma linha dizendo **o que você escolheu e por quê** (material, eixo,
   tamanho pelo papel). Se você teve que adivinhar algo relevante, diga qual.
2. O **prompt de silhueta**, em bloco de código, e a frase de que ele vem
   primeiro: forma antes de detalhe é a ordem certa, e é barato descobrir ali
   que a leitura não fecha.
3. O **prompt completo**, em bloco de código.
4. Uma linha final: depois de gerar, a imagem volta pela skill
   `sprite-from-image`.

## 5. O que sobrevive ao downscale

O prompt já cobra as duas, mas vale saber por que estão lá — as duas foram
aprendidas errando:

- **contorno fino desaparece.** Uma linha de 4px numa imagem de 2048 perde toda
  votação numa célula de 128px. Sem contorno o personagem se dissolve no fundo,
  e para o warlock isso é a regra nº1 da hierarquia de leitura.
- **acento pequeno evapora.** Olhos de 2px na referência somem no voto por
  célula. Eles precisam ser desenhados **grandes e simples** na referência
  justamente para sobrar um pixel depois.

Se você ainda assim receber uma imagem sem contorno ou sem olhos, isso não é
motivo para regerar: a imagem serve como **composição**, e a grade se desenha
à mão. É o que a `sprite-from-image` faz.

**Pergunte só se a resposta mudar o resultado de verdade** — tipicamente
"isso é inimigo ou demônio seu?" quando a descrição não deixa claro, porque
muda o acento e o tamanho. Ambiguidade menor: escolha, e diga o que escolheu.
