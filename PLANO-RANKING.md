# Plano de ranking — o placar dos amigos

Documento de trabalho. A doutrina que sobreviver à implementação sobe para o
`CLAUDE.md`; o resto morre aqui.

---

## 0. O que já está decidido

| Decisão | Escolha | Consequência |
|---|---|---|
| O que é "melhor" | **tempo de sobrevivência** | o placar precisa de uma segunda coluna que segure o cheese — ver §7 |
| A run é a mesma pra todos? | **não, run livre** | é um quadro de "melhor de sempre", não uma disputa diária; verificação por replay sai de cena (§9) |
| Onde os dados moram | **Google Form + planilha** | não há servidor, então **não há validação na escrita** — ela vira filtro de leitura (§6) |
| Onde o placar aparece | **página inicial**, no GitHub Pages | é a primeira coisa que um amigo vê ao abrir o link |

---

## 1. O terreno, apurado no código

Três fatos que decidem metade do desenho, e que não são impressão:

**O jogo não lembra de nada.** Não existe uma única chamada a `localStorage`,
`sessionStorage` ou `indexedDB` no projeto. Um reload apaga a run inteira.
Lembrar é o primeiro tijolo, antes de qualquer rede.

**O relógio é justo.** `this.elapsed += dt` mora dentro de `update(dt)`
(`js/game.js:684`), e quem chama `update` passa `step`, fatiado de
`dt * timeScale` (`js/game.js:665`). Então `elapsed` é tempo de **simulação**:
quem joga acelerado enfrenta a mesma curva de horda pelo mesmo número no
placar, com um terço do tempo de reação. É estritamente pior competitivamente,
e por isso não é brecha — mas `selectedSpeed` (`js/game.js:112`) não está
exposto ao jogador hoje. **Se um dia for exposto, o payload precisa gravar a
velocidade**, senão 1x vira a única escolha racional e o seletor morre.

**O painel de game over já é o placar.** `UI.onGameOver` (`js/ui.js:1146`) já
calcula tudo que a linha do ranking precisa: `g.elapsed`, `g.player.kills`,
`g.player.level`, `g.comboBest`, os três eixos, as auras acesas e
`damageRows()` ordenado — cuja primeira linha é a peça que mais deu dano. Não há
número novo a inventar; há um recorte a fazer.

---

## 2. Passo 1: a camada local, que não depende de nada

Vale sozinha, mesmo que o placar online nunca exista.

- `localStorage` guarda **nome do jogador** e **recorde pessoal** (a run inteira,
  não só o tempo).
- O game over ganha uma linha: `seu melhor: 8:42` — ou `NOVO RECORDE` quando a
  run bate o próprio número.
- O nome é pedido **uma vez**, na primeira run que termina, e é editável no menu.

Duas regras que vêm da identidade da UI:

- **`NOVO RECORDE` é osso, não cor de eixo.** Um recorde não fala de Corrupção,
  Domínio nem Cataclismo — cor é predicado (R2). O que separa a linha do resto é
  peso e a placa chanfrada, nunca brilho (R4).
- **Nada de `border-radius`, nada de `text-shadow`.** O
  `grep -nE 'border-radius|text-shadow|blur|gradient|backdrop' index.html`
  continua sendo metade da verificação.

---

## 3. O payload: nove campos, e nenhum a mais

Tudo sai do que `onGameOver` já tem em mãos.

| Campo | Origem | Por que está aqui |
|---|---|---|
| `nome` | `localStorage` | quem foi |
| `tempo` | `g.elapsed` (segundos, 1 casa) | **a métrica** |
| `abates` | `g.player.kills` | a coluna que segura o cheese (§7) |
| `nivel` | `g.player.level` | entra na regra de plausibilidade (§7) |
| `dano` | soma de `damageRows()` | leitura, e um segundo desempate |
| `cadeia` | `g.comboBest` | o feito mais afiado que a run produz |
| `assinatura` | `damageRows()[0].def.id` | o glifo da linha (§8) |
| `eixos` | `b.axis` → `"3/11/0"` | a build em três números |
| `versao` | constante do build | run velha não disputa com run nova depois de um rebalanceamento |

`versao` é o campo que mais gente esquece e o que mais dói depois: o catálogo
inteiro já teve o dano dobrado uma vez, e a curva de marco já mudou de segundos
para corpos. Sem ele, o placar mistura runs de jogos diferentes e ninguém
consegue explicar por que o topo é intocável.

---

## 4. Escrita: como um site estático posta numa planilha

O Google Form aceita submissão direta no endpoint dele, sem SDK e sem chave:

```js
// Fire-and-forget: the response is opaque, so success is never confirmed.
const body = new FormData();
body.append("entry.111111", nome);
body.append("entry.222222", String(tempo));
// ...one entry.<id> per field
fetch("https://docs.google.com/forms/d/e/<FORM_ID>/formResponse",
      { method: "POST", mode: "no-cors", body });
```

**Os `entry.<id>` saem do próprio form**: menu `⋮` → *Get pre-filled link*,
preencher qualquer coisa, e ler os `entry.NNNNN` da querystring que ele devolve.
Anotar os nove no topo do arquivo, porque eles não são adivinháveis.

Três armadilhas, e as três são desta opção especificamente:

- **`mode: "no-cors"` devolve uma resposta opaca.** O jogo nunca sabe se o envio
  deu certo. Então a UI **não pode** dizer "enviado" — ela diz "enviando…" e o
  placar do menu é quem confirma, na próxima abertura. Prometer sucesso que não
  se pode verificar é o tipo de mentira que só aparece no dia em que falha.
- **Envio é uma vez por run, no game over, e nunca em retry automático.** Sem
  resposta não há como distinguir falha de sucesso, então retry duplica linha.
- **Desligar a coleta de e-mail no Form.** Ela é opcional e vem ligada em alguns
  templates. A planilha vai ficar legível na web (§5) e o e-mail dos seus amigos
  não tem nada que fazer lá.

---

## 5. Leitura: a planilha vira JSON

Duas rotas, e a primeira é melhor por um motivo concreto:

**Rota A — `gviz`, com ordenação de graça.** Aceita uma query SQL-like, então o
`order by` e o `limit` acontecem antes de o dado chegar:

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq
  ?tqx=out:json&tq=select A,B,C,D order by B desc limit 25
```

A resposta **não é JSON puro** — vem embrulhada em
`/*O_o*/\ngoogle.visualization.Query.setResponse({…});`. Corta-se com
`t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)` antes do `JSON.parse`.

**Rota B — CSV publicado, o plano B do plano B.**

```
https://docs.google.com/spreadsheets/d/e/<PUB_ID>/pub?gid=0&single=true&output=csv
```

Sem query, mas com CORS confiavelmente aberto para planilhas publicadas. **Se o
`gviz` der problema de CORS, é para cá que se cai** — e aí a ordenação é feita
no cliente, o que a esta escala (dezenas de linhas) não custa nada.

Duas notas:

- **Furar o cache**: acrescentar `&_=${Date.now()}` na URL. O Google cacheia
  agressivamente e um placar que mostra o de ontem é pior que nenhum.
- **Publicar uma aba DERIVADA, não a de respostas.** Uma segunda aba com
  `=QUERY('Respostas'!A:J; "select … order by … limit 50")` expõe só o que o
  placar precisa e deixa a aba crua (e qualquer coluna que o Forms acrescente no
  futuro) fora do ar.

---

## 6. A consequência que a escolha do backend cobra

Sem servidor, **não existe validação na escrita**. Qualquer um que abra o
devtools posta `tempo: 99999`, e nada no caminho pode impedir isso.

Então a validação muda de lugar: **ela vira filtro de leitura**. A planilha
guarda tudo; o placar descarta o implausível antes de desenhar. Isso tem duas
propriedades boas e uma ruim, e vale saber quais:

- ✅ A regra mora no jogo, versionada no git, e melhora sem migrar dado nenhum.
- ✅ Você tem a planilha aberta na mão: apagar uma linha é um clique.
- ❌ O filtro é código do cliente, então quem trapaceia **lê o filtro** e ajusta
  os números para passar por ele.

O último item não tem conserto nesta arquitetura, e não vale gastar esforço
fingindo que tem. O que ele tem é contexto: são seus amigos, e §7 resolve o caso
real (o preguiçoso) enquanto §8 resolve o resto socialmente.

**Não gaste tempo assinando o payload no cliente.** A chave estaria no JS que
todo mundo baixa. É trabalho que parece segurança e não é.

---

## 7. Plausibilidade: três regras, todas derivadas do código

O princípio: **nenhuma constante copiada**. Uma tabela de limites escrita à mão
envelhece no primeiro rebalanceamento e passa a reprovar run honesta — que é o
pior defeito possível num filtro. As três regras leem funções que já existem.

**R1 — Nível exige abates.** O inimigo mais barato do catálogo dá `xp: 1`
(`js/balance.js:381`), então o XP acumulado é um piso rígido para o número de
abates:

```js
// The cheapest enemy is worth 1 xp, so total xp is a hard floor on kills.
function minKillsFor(level) {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += xpForLevel(l);
  return xp;
}
// reject when: kills < minKillsFor(level)
```

Isso usa `xpForLevel` (`js/util.js:52`) diretamente. Se a curva mudar, o filtro
muda junto, de graça.

**R2 — Tempo exige abates.** A densidade de spawn é conhecida
(`BALANCE.spawn`), e o piso é o caso em que o jogador não mata quase nada. Uma
run de 20 minutos com 400 abates é possível de verdade (é o cheese de fugir em
círculo) — então **isto não reprova, marca**: a linha entra no placar e §8
mostra os abates ao lado. O que reprova é o impossível pelo outro lado: mais
abates do que o spawner conseguiu colocar em campo naquele tempo, calculado de
`baseInterval`, `minInterval` e `rampEvery`.

**R3 — Teto de sanidade.** `tempo` acima do que a run mais longa já medida
alcança, `cadeia` acima de `abates`, `assinatura` que não existe em `PIECES`,
`eixos` somando mais que o pool de 20, ou qualquer eixo acima de 15. São
impossibilidades estruturais, não julgamento de habilidade — e `eixos` sozinho
já pega a maioria dos payloads inventados à mão, porque ninguém que edita um
número lembra de manter o pool coerente.

Linha reprovada **não some em silêncio**: ela cai numa contagem no rodapé
(`3 runs fora da curva`). Filtro invisível é filtro que você não percebe que
quebrou.

---

## 8. O placar na página inicial

**A tabela é uma placa de osso.** Tempo em `--fonte-dado`, sem cor. As cinco
regras da UI valem aqui sem exceção: canto chanfrado, fundo chapado, 1px claro
em cima e 1px escuro embaixo, nada abaixo de 14px, um só emissor por tela — e na
UI o emissor é nada.

**A única cor da tela é a assinatura da run.** Cada linha carrega o glifo da
peça que mais deu dano — `Glyph.svg(assinatura)` — pintado na cor do eixo dela.
Isso respeita R2 (aquele pixel *está* falando de eixo), dá à tabela a única cor
que ela pode ter, e faz o placar se ler de relance: **você reconhece a build do
seu amigo antes de ler o nome dele.** É o mesmo argumento da tira do HUD — cor
diz o eixo, silhueta diz a família, detalhe diz a peça.

A linha, da esquerda para a direita:

```
 1   ▸ glifo    NOME           12:04    4.3k abates    nível 31    cadeia 364
```

**Abates fica ao lado do tempo, sempre, e não é opcional.** É a coluna que
transforma o cheese em informação pública: 20 minutos com 400 abates conta a
própria história sem o placar precisar acusar ninguém. Vergonha social é o
anti-cheese mais barato que existe num grupo de amigos, e o único que esta
arquitetura pode pagar.

Três coisas que o placar **não** faz:

- **Não usa `height` fixa** — `min-height`, pela mesma razão que a linha da
  etapa: nome comprido quebra e transborda.
- **Não mostra denominador** (`3º de 12`). Quem está em 12º sabe.
- **Não anima entrada.** A página inicial é a tela mais parada do jogo; um
  placar que desliza pede atenção que ele não vai devolver.

**A tela precisa funcionar com o placar VAZIO e com o placar OFFLINE**, e os
dois estados são diferentes: "ninguém jogou ainda" convida, "não deu para
carregar" informa. Cair num spinner eterno é o terceiro estado, e é o único
inaceitável — um `timeout` de 4s e o menu segue a vida.

---

## 9. O que fica de fora, e por quê

**Replay.** O jogo tem só input de movimento, o que faria dele um candidato
perfeito: seed + sequência de inputs, reexecutada headless pelo `tools/harness.js`
que já roda o jogo inteiro em node — e `driver_balance` (`tools/driver_balance.js:219`)
já troca `Math.random` global por um LCG com seed. A infra existe pela metade.

O que falta é caro: hoje o `dt` real entra na simulação (`total = dt * scale`,
fatiado em passos de até 0,025s), então **duas máquinas com frame rates
diferentes produzem sequências de passos diferentes e divergem em segundos**.
Replay exigiria passo fixo na simulação — mudança arquitetural, não feature. E
exigiria também separar o RNG que decide a run (spawn, ofertas, baú) do RNG
cosmético (faíscas, vozes, cenário), que hoje bebem do mesmo `Math.random`.

Fica anotado como possibilidade, não como próximo passo.

**Run diária com seed comum.** Descartada junto com "run livre", e é coerente:
sem seed compartilhada o placar é uma coleção de recordes pessoais, não uma
disputa. Se um dia virar disputa, o caminho é o mesmo do replay — separar os dois
fluxos de RNG é o pré-requisito das duas coisas.

---

## 10. Ordem de construção

Cada passo vale sozinho, e nenhum depende do seguinte.

1. **Local**: `localStorage`, nome do jogador, recorde pessoal no game over.
   Não toca em rede, não toca no menu.
2. **O Form e a planilha**: criados à mão, com os nove `entry.<id>` anotados e a
   aba derivada publicada. Zero código.
3. **Escrita**: o `fetch` no game over, com a UI honesta sobre não saber se deu
   certo.
4. **Leitura + placar**: o menu busca, filtra por §7 e desenha §8.

O passo 2 é o único que eu não posso fazer por você — o resto sai daqui.
