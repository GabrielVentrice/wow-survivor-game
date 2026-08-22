---
name: sprite-from-image
description: Transforma uma imagem gerada (Gemini/qualquer modelo) em sprite de verdade deste jogo — primeiro passe pelo image2grid, conserto à mão, entrada em SPRITE_DATA, tuning em ENEMIES/MINIONS no degrau exato, e verificação visual no contact sheet mais a bateria de drivers. Use quando o usuário mandar um arquivo de imagem de criatura, disser "já gerei a arte", "transforma isso em sprite", "monta o sprite dessa imagem", ou "/sprite-from-image".
---

# Imagem gerada → sprite

Task que **edita arquivo do jogo**: crie worktree a partir de `origin/master`
antes do primeiro edit, conforme a regra global.

E **rode as ferramentas de dentro do worktree**, não do clone principal.
`spritesheet.py` e `image2grid.py` resolvem `js/sprites.js` a partir da própria
localização: chamar a cópia do clone principal depois de editar o worktree
renderiza a **arte antiga** e não avisa nada. O script imprime `lido de <path>`
justamente para isso — confira a linha antes de olhar a imagem.

## 1. Olhe a imagem antes de tocar em qualquer script

Leia o arquivo com a ferramenta de imagem e diga em uma linha o que está lá.
Depois confira contra o que o prompt pediu:

- fundo chapado e único? (se não for `#FF00FF`, descubra a cor e passe `--bg`)
- tem **glow, bloom, faísca ou sombra no chão**? Isso vaza para fora da
  silhueta e é o defeito que mais estraga a conversão;
- as sombras são **três valores de borda dura**, ou é gradiente/aerógrafo?
- o corpo está **inteiro e centralizado**, sem membro cortado?
- a proporção sobrevive ao tamanho alvo, ou é anatomia realista?
- **tem adereço saindo do corpo?** Arma, cajado, pá, corrente, cauda longa. Se
  ele sai do envelope do corpo, a decisão é agora, não depois: no tamanho final
  um objeto atravessado vira **uma barra** e leva o sprite inteiro junto.

**Decida o adereço antes do `image2grid`, não depois.** Ou ele entra (e aí vira
uma coluna vertical colada ao corpo), ou sai — e sair significa **mascarar em
magenta** as partes fora do corpo antes de rodar o script, senão elas puxam o
bounding box e o corpo sai descentralizado e espremido:

```python
from PIL import Image, ImageDraw
im = Image.open(src).convert("RGB"); d = ImageDraw.Draw(im)
d.rectangle([x0, y0, x1, y1], fill=(254, 30, 251))   # a cor exata do fundo
```

**Meça o aspecto do corpo antes de escolher quantas colunas ele ocupa.** Esta é
a conta que evita a criatura sair achatada:

```
colunas_do_corpo = (largura_do_corpo / altura_do_corpo) * linhas_da_grade
```

Corpo com aspecto 0.76 numa grade de 13 linhas ocupa **10 colunas**, não 14. As
colunas que sobram são **margem**, ou são para o que genuinamente se abre —
chifre, braço estendido, asa. Esticar o corpo para preencher a grade é o que
faz um brutamontes ler como sapo, e foi literalmente a segunda rodada do ghoul.

**Se a imagem viola isso de forma grave, diga e recomende gerar de novo.** Uma
imagem com gradiente e glow custa mais para consertar do que uma nova rodada
no modelo — e o resultado ainda sai pior. Não lute contra a referência.

## 2. Primeiro passe

Se o prompt saiu da skill `sprite-prompt`, **reaproveite exatamente os mesmos
parâmetros**. Senão, escolha pela tabela daquela skill.

```bash
python3 tools/image2grid.py <img> --grid <WxH> --ramp <tok> --ink <cold|deep|warm> \
    [--second <tok>] [--accent <tok> ...] [--bg '#xxxxxx'] [--tol N] [--fill 0.42]
```

`--fill` é a alavanca da silhueta: mais alto afina o bicho, mais baixo engorda.
Se o resultado saiu esburacado ou gordo demais, mexa aqui antes de mexer à mão.

## 3. Conserte à mão — é aqui que o sprite acontece

**Antes de inventar uma solução de forma, leia o sprite que já resolveu ela.**
O elenco tem resposta pronta para quase toda pergunta: asa aberta é o
`dreadlord`, quadrúpede é o `felhunter`, manto é o `warlock`, massa larga sem
perna é o `portal`. Uma leitura de grade responde "como ESTE jogo desenha X"
melhor que três rodadas de render:

```bash
awk '/^  dreadlord: \{/,/^  \},$/' js/sprites.js
```

Foi assim que a asa da 3ª forma do warlock saiu do impasse: o dreadlord mostra
que asa que lê é **borda diagonal em escada**, numa **fatia mais escura da
mesma rampa**, ocupando **tantas colunas quanto o corpo**. Nenhuma das três
estava escrita em lugar nenhum — estavam na grade.

O que o script imprime é **ponto de partida para discussão**, e às vezes o
ponto de partida é "descarta os pixels e usa a composição". Isso é normal e
não é falha do fluxo: contorno fino e acento de 2px somem no voto por célula,
então é comum receber um primeiro passe sem contorno, sem olhos e com a rampa
esmagada em dois tons. Quando os três acontecem juntos, **redesenhe a grade à
mão** usando a imagem para o que ela de fato entregou — silhueta, proporção,
onde ficam capuz, mãos, adereço e pés.

Desenhar 16 linhas contando char na cabeça erra. Monte a grade num script com
`assert len(linha) == W` e deixe o erro aparecer — cada linha errada custa uma
rodada de render se passar batido.

**Simetria aqui NÃO é espelho puro.** Todo sprite do elenco é iluminado de lado
— o warlock base é `ollmmddo`, `l` na esquerda e `d` na direita —, então um
`assert r[c] == r[W-1-c]` reprova cada sprite bom do jogo. O que se espelha é a
metade esquerda **com troca de luz**:

```python
SWAP = {"l": "d", "d": "l", "L": "D", "D": "L", "b": "B", "B": "b"}
full = half + "".join(SWAP.get(c, c) for c in reversed(half))
```

E esse espelho tem duas armadilhas que custaram uma rodada cada:

- **Massa chapada que CRUZA o eixo sai partida ao meio.** Um manto escrito
  `dddd` volta `llll` do outro lado, e o peito fica metade escuro e metade
  claro com um corte vertical no centro — lê como bug, não como sombra. Linha
  que atravessa o eixo se escreve **literal**, com os W chars na mão.
- **Segunda rampa usada como fatia mais ESCURA inverte.** Pintar a asa com
  `d/m` da rampa principal parece inofensivo até o swap mandar `d` para `l`: a
  asa direita sai na **fatia mais clara do jogo** e a profundidade vira do
  avesso. Material que recua vai em `D/M/L`, sempre.

Quando as duas aparecerem no mesmo sprite, largue o espelho e escreva as W
colunas de cada linha na mão. São 20 linhas — mais barato que descobrir no
render.

E escreva esse script **uma vez, parametrizado**, para as iterações seguintes
serem uma linha de comando em vez de um novo patch por rodada:

```python
# /tmp/set<id>.py — recebe as linhas separadas por "|", valida e troca em SPRITE_DATA
ROWS = sys.argv[2].split("|")
```

São 3 a 5 rodadas de desenho até fechar. O que decide se elas são baratas é não
reescrever o encanamento em cada uma.

Percorra:

- **Olhos**: 1px cada, separados por pelo menos 1px escuro, no token de
  energia. Órbita de morto-vivo é **buraco** (`o`) com a chama dentro, nunca
  cor pintada por cima do osso — foi exatamente o que deixou o esqueleto
  ilegível antes.
- **Simetria**: bípede de frente é simétrico. Espelhe a metade esquerda em vez
  de confiar no voto por célula, que erra por um pixel.
- **Pernas**: para `walkFrames` fazer a criatura **pisar** em vez de gingar, a
  última linha precisa de **duas corridas separadas** de pixel sólido, e elas
  têm que continuar separadas por 2+ linhas acima. Uma massa só (manto, nuvem,
  portão) ginga — o que é certo para quem não tem perna e errado para quem tem.
  **E o vão entre elas é `.`, nunca `o`**: `rowRuns` conta contorno como pixel
  sólido, então duas pernas com uma coluna de contorno no meio são **uma
  corrida só** e o bicho ginga. Cobre no script, que é onde custa nada:
  `[len(s) for s in rows[-1].replace(".", " ").split()]` tem que dar duas.
- **Contorno fechado** em toda a silhueta, na tinta escolhida.
- **Quatro materiais estouram o vocabulário.** `d/m/l` é o corpo, `D/M/L` é a
  segunda rampa, `b/B` é osso e `e/E` é energia — e acabou. Corpo + asa + osso
  + pele deixa um material sem letra. Fica com `D/M/L` o de **maior área e que
  mais precisa de luz direcional** (a asa, a armadura); o que sobrar pega um
  par livre (`s/S`, `f/F`) e **o desvio vai escrito no comentário do sprite**,
  senão a chave passa a mentir para quem ler depois.
- **Duas massas encostadas viram uma.** Cabeça e ombro, braço e tronco, coxa e
  quadril: sem uma faixa escura entre elas — uma linha de `d` ou de `o` — o olho
  lê um bicho só. Cabeça colada no ombro é o que transforma qualquer humanoide
  largo em sapo, e braço sem sua própria coluna de contorno simplesmente não
  existe. As duas custaram uma rodada cada.
- **Dois pixels de espessura é o piso** de qualquer coisa que deva ler como
  massa: chifre, presa, garra, cauda, arma. A um pixel elas viram *linha*, e
  linha saindo da cabeça lê como antena — não importa a cor.
- **Nada de empilhar marcas claras na vertical na cara.** Duas brasas com dois
  pixels de osso logo abaixo leem como **dois pares de olhos**. Presa vai no
  canto da mandíbula, onde ela quebra o contorno; o meio da cara é da boca.
- **Oclusão**: as duas linhas de baixo de cada massa descem um passo da rampa.
  Sem isso corpo largo continua retângulo chapado, por melhor que seja a cor.
- **E a figura INTEIRA tem gradiente vertical, não só cada massa.**
  `driver_palette` tira a luminância média dos chars de rampa (`dmlDML`) na
  metade de cima e na de baixo, e cobra que a de cima seja mais clara. Massa
  escura concentrada no alto — asa, manto, capuz — reprova mesmo com cada peça
  sombreada certo por dentro. O conserto não é clarear a asa: é o ombro pegar
  luz e o que está sob o manto não. Meça sem rodar o driver:

  ```python
  L = lambda h: .2126*int(h[1:3],16) + .7152*int(h[3:5],16) + .0722*int(h[5:7],16)
  v = [(y, L(PAL[c])) for y, r in enumerate(ROWS) for c in r if c in "dmlDML"]
  hi = [x for y, x in v if y < len(ROWS)/2]; lo = [x for y, x in v if y >= len(ROWS)/2]
  ```
- **Luz do topo-esquerda**: borda que toca o vazio por cima ou pela esquerda
  sobe um passo.
- **Largura uniforme**: toda linha do grid com o mesmo número de chars.
- **Proporção**: personagem é **vertical** (aspecto ~0.65, cabeça/capuz em 1/3
  da altura); bicho é cabeçudo e largo. As duas famílias não se misturam.

## 4. Entre no jogo

Adicione em `SPRITE_DATA` (`js/sprites.js`), com um comentário curto dizendo
**o que a criatura precisa comunicar** naquele tamanho — não o que ela é.

Depois o tuning, conforme o papel:

| Papel | onde | campo de altura |
|---|---|---|
| inimigo da horda | `ENEMIES` (`js/balance.js`) | `art` |
| demônio invocado | `MINIONS` (`js/content/minions.js`) | `scale` + `sprite` + `gait` |
| forma do personagem | `CLASSES.<id>.forms[]` | `scale` + `caps` |

**A altura é degrau exato, nunca arredondamento.** Com `PIXEL_UNIT = 3`:

```
altura_em_raios = 3 * step * linhas_do_grid / radius        # step inteiro, normalmente 1
```

Escolha o `step` que dá uma altura coerente com o papel, e escreva o valor
resultante. Grade que não cabe em degrau nenhum pede **redesenho da grade no
tamanho em que ela aparece** — fração não encolhe desenho, apaga pedaço dele.

Demônio novo: `gait` é `walk` (pisa), `float` (paira) ou `static` (plantado), e
`driver_render` reprova tipo de demônio sem sprite próprio.

## 5. Verifique com os olhos, não só com os drivers

```bash
python3 tools/spritesheet.py --zoom 14 --cols 2 --only <novo> <um parecido> --out /tmp/zoom.png
python3 tools/spritesheet.py --out /tmp/sheet.png
```

**Escreva cada iteração num arquivo NOVO** (`/tmp/<id>_v2.png`, `_v3.png`).
Reescrever o mesmo caminho a cada rodada devolve imagem velha na leitura, e
julgar arte por um render defasado é a pior forma de gastar uma rodada — você
conserta o que já estava certo.

**Leia as duas imagens.** A primeira responde "isso lê?"; a segunda responde
"isso pertence a este jogo?" — e é a segunda que ninguém faz sozinho ao
acrescentar um sprite. Itere no desenho até fechar; drivers não sabem dizer se
está feio.

Vale também renderizar o sprite **antigo** ao lado quando é substituição: sem o
antes, "melhorou" é achismo.

Teste de silhueta: se você não consegue nomear a criatura só pelo contorno, o
problema é a forma, e nenhuma cor conserta.

## 6. Bateria

```bash
DRIVER=driver_palette.js node tools/harness.js .   # cor fora da PAL, rampa chapada, corpo aceso
DRIVER=driver_pixel.js   node tools/harness.js .   # grid, degrau de escala, quadros de passo
DRIVER=driver_render.js  node tools/harness.js .   # demônio sem sprite próprio, caches
node tools/harness.js .                            # a run inteira
```

`driver_palette` vai reclamar se o corpo estiver pintado com cor de energia, se
o contorno não for uma tinta, ou se a luz vier de baixo. Trate a reclamação
dele como verdade: cada uma dessas ele já pegou de verdade.

## 7. Feche

Contact sheet para o usuário (`SendUserFile`), commit no padrão do repo
(pt-BR, `feat(art): ...`), e diga **quais decisões de arte você tomou sozinho**
— fatia de rampa, tamanho, o que foi cortado do desenho original por não caber
no tamanho. São decisões que ele pode querer discordar, e discordar é trocar um
token, não redesenhar.
