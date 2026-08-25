# Fora da run: o placar e o changelog

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `js/leaderboard.js` ou `js/version.js`.

## O placar: sem servidor, a validação vira filtro de LEITURA

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

**O nome é obrigatório para começar, e por isso ele SAIU do painel do placar.**
O painel some abaixo de 1240px — o cartaz é a prioridade da tela —, e um campo
obrigatório que desaparece com a largura da janela tranca o jogo em tela
estreita. Ele mora na coluna do menu, junto do `Iniciar`, porque virou parte de
entrar no jogo e não de olhar o quadro. Vale como regra: **o que bloqueia uma
ação não pode morar num elemento que a responsividade esconde.**

Três detalhes que caem daí:

- **O portão é `Leaderboard.temNome()`, que pergunta ao `limpaNome`.** Um nome
  de três espaços passaria num `!== ""` e o jogador só descobriria no game over
  — depois de doze minutos, quando não há mais o que fazer a respeito.
- **Quem ensina o que falta é o cursor, não o clique.** Botão `disabled` não
  recebe evento, então o `focus()` do `onclick` é última defesa e não caminho
  normal: o campo já abre focado quando não há nome, e o rótulo ao lado do
  botão troca `Enter` por `digite um nome para começar`.
- **O campo escuta `input`, não `change`.** O botão depende dele, e um botão que
  só destrava quando o campo perde o foco parece quebrado.
- **Campo de texto com foco COME a tecla** (`digitando`, em `js/util.js`). O
  `InputManager` dá `preventDefault` em w/a/s/d para a página não rolar, e isso
  apagava essas quatro letras de dentro do nome — a letra A simplesmente não
  entrava. M e N eram pior: mutavam o som no meio de uma palavra. Todo `keydown`
  do jogo consulta `digitando` antes de qualquer coisa, e `driver_leaderboard`
  cobra isso lendo o fonte, porque o harness descarta listeners e nenhum driver
  consegue disparar uma tecla.

A camada local (`localStorage`: nome e recorde pessoal) é a metade que **sempre**
funciona: sem rede, sem form, sem planilha. Ela nunca lança — storage bloqueado
devolve estado vazio, senão o game over inteiro morreria junto. O plano completo,
com o que ficou de fora e por quê, está em `PLANO-RANKING.md`; o setup do form é
`tools/setup-leaderboard.gs`, que roda uma vez e imprime as constantes.

## A versão e o changelog: uma lista só, e ela é a fonte

`js/version.js` é o arquivo inteiro: `CHANGELOG` é a lista de versões (a mais
nova **no topo**) e `VERSION` **cai dela** — `CHANGELOG[0].v`, nunca digitado.
Amarrados assim, subir a versão sem dizer o que entrou deixa de ser possível:
a menor mudança que o jogo aceita é uma entrada com pelo menos uma nota.

O número já morava em **dois** lugares — cravado no `.menu-versao` do
`index.html` e cravado de novo em `LB_CFG.versao`, com um comentário pedindo
que os dois andassem juntos. Comentário não é mecanismo, e a cópia que
envelhecesse carimbaria toda run enviada ao placar com uma versão que o jogo
não tem mais, em silêncio. Hoje os dois **leem** de `VERSION`, e o rodapé do
menu é escrito por `UI.mountVersao`.

**Os dados moram em JS e não num `CHANGELOG.md`** pelo mesmo motivo que não há
`fetch` em lugar nenhum: o jogo abre por `file://`, onde origem opaca bloqueia
a leitura. Um markdown ao lado teria que ser lido em runtime — ou copiado à mão
para cá, que é a segunda lista de novo.

Formato de uma entrada, e cada campo tem um consumidor:

```js
{ v: "0.10.0", data: "2026-08-24", titulo: "A versao fala",
  notas: [ { t: "novo" | "ajuste" | "conserto", txt: "..." } ] }
```

- **`v` é SemVer**, e a régua deste jogo é: **maior** = a run muda de forma
  (uma classe nova, outra tela de escolha); **menor** = conteúdo ou sistema
  novo (peça, capstone, placar, este changelog); **patch** = conserto e ajuste
  de número, incluindo rebalanceamento que não muda a forma de nada.
- **`data` é o dia em que aquilo SUBIU para a master**, não o dia em que foi
  escrito — é a data que a tela mostra e a única que o jogador pode conferir
  contra a própria memória.
- **A nota diz o que mudou para QUEM JOGA, na voz do jogo.** "As três cartas
  passam a ser comparadas na mesma régua, em dano por segundo" é uma nota;
  "refatora `offerGain`" não é. Mecanismo e medição moram aqui no CLAUDE.md,
  que é onde alguém os procura — a nota é a linha que o jogador lê no menu.
- **Três tipos, e são poucos de propósito.** Com sete rótulos ninguém escolhe o
  mesmo duas vezes e a etiqueta para de significar algo.

**A tela (9.9)** abre ao clicar na versão, no canto do menu: trilho de versões à
esquerda, notas à direita — a mesma silhueta do placar, e de propósito, porque
as duas respondem "o que aconteceu fora desta run". Três coisas que caem daí:

- **Ela não apaga o canvas.** Apagar o canvas é o que separa a tela de etapa de
  todas as outras, e esta não cobra nada.
- **O botão de fechar é fantasma**, e o único cheio do menu continua sendo o
  `Iniciar` — preenchimento é custo, e escolher versão não custa.
- **Zero cor de eixo.** Uma nota de versão não fala de Corrupção, Domínio nem
  Cataclismo (R2): tudo ali é osso sobre obsidiana.

`driver_version` guarda sete coisas: que `VERSION` é a entrada mais nova, que a
lista desce sem repetir versão nem inverter data, que toda entrada tem data ISO,
título e ao menos uma nota, que o número **não** existe num segundo lugar (ele
faz `grep` no `index.html` e compara `LB_CFG.versao`), que a tela desenha uma
linha por versão e as notas certas, que a nota é **escapada** (ela é texto,
nunca markup) e que o `ESC` fecha as notas **antes** de pausar.

### Ao subir para a master: bumpar e escrever a nota, na mesma mudança

**Toda mudança que chega na `master` mexe em `js/version.js`** — não há exceção
por tamanho: conserto de uma linha é um `patch`, e um `patch` sem nota é o
defeito que esta lista existe para impedir.

O fluxo, e ele é curto de propósito:

1. **Decida o degrau** pela régua acima (maior / menor / patch).
2. **Se a versão do topo ainda não foi para a master, ACRESCENTE a nota nela**
   em vez de criar uma entrada nova. Uma versão por trabalho, não por commit —
   dez entradas de um dia só é a lista de commits com outro nome, e ninguém lê
   a lista de commits.
3. **Entrada nova vai no TOPO**, com a data do dia em que ela sobe.
4. Rode `node tools/run-all.js` (ou ao menos `fast`, que inclui o
   `driver_version`) — ele reprova ordem, data e versão repetida.
5. O commit que sobe leva `js/version.js` junto. `VERSION` acompanha o código
   que ela nomeia: bumpar depois é carimbar run com a versão errada até lá.

