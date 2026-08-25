# audio/

**Uma trilha em `TRACKS` (`js/track.js`), e a tecla `N` alterna entre ela e o
silêncio.**

| | `focus-vigil.mp3` — **Vigília** |
|---|---|
| o que é | leito de foco: nada acontece |
| gerada por | `tools/make_focus_track.py` |
| duração / tamanho | 160 s / 1,92 MB |

**A Tempestade — o lofi de chuva — saiu de `TRACKS`.** O arquivo continua aqui,
junto com as outras alternativas (ver o fim deste documento), e o argumento
está na seção abaixo: ela cobrava atenção de propósito, e o que este jogo
precisa é de fundo. Voltar a ter duas é uma linha em `js/track.js`.

Ela não veio de banco de sons: é sintetizada aqui — como era a chuva da
Tempestade, ruído modelado no domínio da frequência e não gravação de campo.
Não há licença de terceiro a conferir em nada que o jogo toca.

**Carregar é preguiçoso, uma por vez**, e a máquina de troca continua de pé
para a próxima trilha que entrar: a troca só acontece quando o arquivo novo
fica pronto, até lá continua tocando o antigo, e se o novo nunca carregar fica
o antigo — o jogo nunca fica mudo por causa de um download. `driver_track`
cobra os três, com uma lista de duas montada só para o teste.

---

## `focus-vigil.mp3` — a trilha padrão

Um leito grave e contínuo: ruído modelado, um pedal de Ré que não sai do lugar,
cinco harmonias que passam por cima dele sem nunca chegar, e um pulso de 60 BPM
— um por segundo, batida de repouso. Sem bateria, sem melodia, sem estalo de
vinil, sem trovão, sem seções.

**Ela é a única porque uma run dura doze minutos.** Trilha de fundo de jogo
longo não é faixa: é o lugar onde o jogo acontece. E o que a Tempestade fazia
de propósito — subir na seção cheia, sumir no break, responder com um trovão —
é exatamente o que uma pessoa com TDAH não consegue ignorar. Todo degrau de
volume e todo som avulso é um evento de novidade, e novidade é o que tira o
olho da tela. Foi essa medição, feita nas duas com as mesmas ferramentas, que
tirou a Tempestade da lista:

| | Vigília | Tempestade |
|---|---|---|
| passeio de volume (janela de 2 s, p5–p95) | **1,4 dB** | 6,8 dB |
| maior salto de 250 ms sobre o fundo dos 6 s anteriores | **2,3 dB** | 7,8 dB |
| janelas de 250 ms saltando acima de 6 dB | **0** de 640 | 7 de 426 |
| centroide espectral | 688 Hz | 510 Hz |
| emenda: degrau na volta / degrau típico | 0,041 / 0,112 | 0,023 / 0,134 |

Os sete saltos da Tempestade são os três trovões, os dois cymbal swells e as
duas viradas de rim. Cada um é bom numa faixa e é um cutucão num fundo. E há
uma segunda razão para a chuva ter saído: ela é dona de tudo acima de 6 kHz, a
mesma banda em que os efeitos dizem que alguém morreu — fundo que disputa
banda com o combate custa informação de jogo, não só atenção.

### As seis regras do arranjo

Elas estão escritas assim no cabeçalho de `tools/make_focus_track.py`, e cada
número do script serve a uma delas.

**1. Quem carrega a trilha é o ruído.** Ruído de banda larga é a única parte
disto com literatura por trás para ouvinte desatento (a linha de trabalho de
excitação moderada / ressonância estocástica), e é também a camada que, por
construção, não tem evento nenhum dentro.

**Ele é ESCURO, e a versão anterior deste parágrafo estava errada.** Ela dizia
que o leito não podia ser marrom puro — o jogo toca a trilha em `0.055` de
ganho, e a −6 dB/oitava isso some no alto-falante de laptop — e compensava com
rosa até 7,2 kHz mais uma camada `air` de ruído de 900 Hz a 11 kHz. O
diagnóstico do volume estava certo; a saída estava errada. Ruído rosa a −19
dBFS, o barramento mais alto da faixa por 5 dB, não lê como leito: lê como
**chuva**, e depois de doze minutos lê como chiado. Foi assim que foi relatado.

Hoje o leito é marrom abaixo do joelho de **220 Hz**, cai a **−10 dB/oitava**
acima dele e tem teto de banda em **1,8 kHz** (4ª ordem, então ~−24 dB em
3,6 kHz). O `air` saiu inteiro. Medido, banda a banda, em dB de energia:

| banda | antes | depois |
|---|---|---|
| 30–120 Hz | 81,2 | **82,7** |
| 120–400 Hz | 82,1 | **85,2** |
| 400–1000 Hz | 78,4 | 75,8 |
| 1–2 kHz | 75,7 | 63,7 |
| 2–4 kHz | 74,6 | **45,8** |
| 4–8 kHz | 71,1 | **17,9** |
| 8–16 kHz | 56,5 | **−7,0** |

A correção é de **banda e não de nível**: baixar o ganho daria um chiado
quieto. O grave sobe 3 dB porque a mesma energia se concentrou embaixo — o
leito continua sendo um chão que se sente — e a faixa de 4–8 kHz, que é onde o
som de acerto e de morte falam, ficou vazia. O que se ouve agora são as camadas
que têm ALTURA.

**2. Nada acontece.** Sem bateria, sem virada, sem lead, sem poeira de vinil,
sem trovão, sem mudança de seção. A única coisa que se move é a harmonia, e ela
se move devagar demais para chegar: um acorde a cada 32 s, com 8 s de
cruzamento. Em qualquer instante ela é uma cor, não uma mudança.

**3. A harmonia não puxa.** Ré menor natural, cinco encadeamentos que
compartilham quase todas as notas, e **nenhuma sensível** — não existe dó
sustenido, então não existe dominante, então não existe expectativa que o
ouvido fique esperando resolver. `make_track.py` faz o oposto de propósito (o
Lá maior do menor harmônico), porque uma faixa quer essa tensão.

**4. O baixo é um PEDAL, e quem pediu isso foi a medição.** Com uma fundamental
por acorde, a banda grave (20–120 Hz) passeava **6,35 dB** ao longo do loop —
um Si bemol 1 simplesmente carrega muito mais energia lá embaixo que um Sol 2 —
e isso sozinho era a maior parte do passeio de volume da faixa inteira. Um
pedal de Ré tira o passeio e tira o aviso de "o acorde mudou" no mesmo gesto;
todos os cinco encadeamentos são consonantes sobre Ré, então a harmonia
continua se lendo.

**5. O pulso é estrutura de tempo, não groove.** 60 BPM exatos, um por segundo.
É seno filtrado com **30 ms de ataque**: cada tambor de `make_track.py` ataca em
menos de 4 ms porque uma faixa quer o estalo, e aqui o estalo é o inimigo — é a
única coisa num leito estável capaz de fazer alguém levantar a cabeça. O leito
abaixa 0,6 dB debaixo dele (uma faixa usaria 4 dB), e isso não é groove: é o
que impede o pulso de ler como um objeto separado em cima do ruído.

**6. Volume constante é requisito medido, não esperança.** O script imprime o
passeio de RMS em janela de 2 s e o maior salto de 250 ms sobre o fundo, e o
alvo está escrito ao lado de cada um (`< 1,5 dB` e `0` janelas acima de 6 dB).
Mexeu no arranjo, roda e confere.

### O que fica de regra para mexida futura

- **Camada nova entra pelo teste de evento, não pelo de gosto.** Se ela mover o
  "maior salto de 250 ms" acima de ~3 dB, ela não é uma camada de fundo — é um
  som avulso, e som avulso não entra num leito.
- **Nada de saturação, fita, estalo ou brilho.** As três são energia transiente
  de alta frequência, que é precisamente o que um leito de fundo não pode ter.
  O teto está em 9 kHz e não há nenhum estágio não-linear no master.
- **Registro novo mexe no grave sem avisar.** Foi o que o pedal consertou: antes
  de acrescentar qualquer coisa abaixo de 120 Hz, rode e olhe o passeio.

### A faixa fecha em si mesma, por construção

40 compassos exatos a 60 BPM, 160 s cravados, 7.056.000 quadros — e o mp3
decodifica nesses 7.056.000 sem sobra de encoder (tag gapless do LAME). O ruído
é desenhado no domínio da frequência e trazido por um `irfft`, o que o torna
periódico por construção (ruído branco filtrado **não** é: o estado do filtro no
fim não bate com o do começo, e essa diferença é a emenda). Toda frequência de
oscilador é arredondada para um número inteiro de ciclos por loop — a correção
é de no máximo 0,00625 Hz —, todo LFO completa ciclos inteiros, impactos são
colocados módulo N, as caudas de reverb são somadas de volta no começo e os
filtros de master rodam circulares.

Por isso `js/track.js` toca com `loop = true` nativo. **Não passe
`{ crossfade: ... }` nela**: sobrepor uma faixa que já emenda dobra o material.

### Regenerar

```bash
python3 tools/make_focus_track.py /tmp/vigil.wav
ffmpeg -y -i /tmp/vigil.wav -codec:a libmp3lame -b:a 96k -ar 44100 -ac 2 \
       -write_xing 1 -id3v2_version 0 -map_metadata -1 audio/focus-vigil.mp3
```

96 kbps e não 80: a 80 o pico decodificado sobe de 0,84 para 0,91 e o degrau na
emenda quase dobra (0,023 → 0,043) — as duas coisas que esta faixa não pode
gastar. A mixagem inteira mora na tabela `LEVELS` (dBFS enquanto o barramento
soa), e é lá — em nenhum outro lugar — que se resolve "tal coisa está alta
demais". Leito alto demais é `LEVELS["bed"]`; pulso audível demais é
`LEVELS["pulse"]`.

---

## Faixas fora de `TRACKS`, mantidas como alternativa

Nenhuma delas toca hoje; entrar é uma linha em `js/track.js`.

### `rain-lofi.mp3` — **Tempestade**, a trilha que saiu

Lofi de chuva: uma tempestade ouvida de dentro, com um boom-bap lento por baixo
— fita com wow e flutter, estalo de vinil, Rhodes no contratempo, caixa
escovada — sobre a mesma harmonia que o Vampire Survivors herdou do
Castlevania: Ré menor descendo `Dm – C – Bb – A`, com o A maior do menor
harmônico puxando de volta para o Dm. 72 BPM, 106,666667 s, 96 kbps estéreo,
1,28 MB.

Ela deixou de ser a padrão e depois saiu de `TRACKS` (a medição está na tabela
acima), mas o arquivo continua inteiro e o arranjo abaixo continua valendo para
quem quiser trazê-la de volta ou reaproveitar as camadas.

**A chuva entra DEPOIS da fita, e isso não é detalhe de implementação.** A
música passa pela coloração lofi (corte em 6,8 kHz, saturação, poeira); a sala
— leito de chuva, tamborilar, pingos e trovão — é somada em cima. Chuva é o
lugar onde a fita está tocando, não algo que a fita gravou: passada pela mesma
saturação ela deixa de soar como ar e passa a soar como chiado. Pela mesma
razão o teto da música desceu de 8,2 para 6,8 kHz — **a chuva é dona de tudo
acima de 6 kHz**, e duas fontes na mesma banda é o que deixa uma mixagem
embaçada.

Três consequências que valem para qualquer mexida no arranjo:

- **A caixa é escovada, com 12 ms de ataque.** Caixa estalada abre um buraco na
  chuva em toda contratempo e as duas camadas passam a brigar; amaciar o
  transiente é o que deixa a tempestade contínua embaixo da batida.
- **O cravo (Karplus-Strong) saiu e entrou um Rhodes.** O pluck era seco e
  brilhante, na mesma faixa de 2–6 kHz da chuva. O Rhodes tem a energia por
  baixo do tempo, então os dois se ouvem juntos.
- **Os pingos de calha não caem na grade.** É a única camada que *não* pode
  bater com o pulso, senão o ouvido os arquiva como percussão em vez de água.

**A faixa fecha em si mesma, por construção.** São 32 compassos exatos; as
caudas de reverb e delay que passam do fim são somadas de volta no começo, todo
LFO completa um número inteiro de ciclos dentro do loop, os filtros de master
rodam circulares, e a sala inteira é gerada de forma circular — o ruído sai de
um espectro modelado com `irfft` (periódico por construção, ao contrário de
ruído branco filtrado) e todo impacto é colocado módulo N. O terceiro trovão
começa no compasso 30,5 e a cauda dele **cai em cima do ponto de volta**, que é
o seguro mais barato que existe contra emenda audível: o ouvido está seguindo um
ronco atravessando a volta em vez de procurar um clique.

Medido no mp3 já decodificado: degrau no ponto de volta 0,023 contra 0,134 de
degrau típico entre amostras — a emenda é mais suave que o próprio material. O
arquivo decodifica em 4.704.000 quadros cravados (tag gapless do LAME, sem
sobra de encoder). Por isso `js/track.js` toca com `loop = true` nativo.
**Não passe `{ crossfade: ... }` nesta faixa**: sobrepor uma faixa que já emenda
dobra a batida.

Para mexer no arranjo, edite `tools/make_track.py` e rode:

```bash
python3 tools/make_track.py /tmp/track.wav
ffmpeg -y -i /tmp/track.wav -codec:a libmp3lame -b:a 96k -ar 44100 -ac 2 \
       -write_xing 1 -id3v2_version 0 -map_metadata -1 audio/rain-lofi.mp3
```

O script imprime o nível de cada barramento e o degrau no ponto de volta; a
mixagem inteira mora na tabela `LEVELS` (dBFS enquanto o barramento soa), e é
lá — em nenhum outro lugar — que se resolve "tal coisa está alta demais". A
sala está na mesma tabela que a música mesmo entrando depois da fita: uma
tabela só, um lugar só para discutir equilíbrio. Chuva alta demais é
`LEVELS["rain"]`, e o quanto ela cresce quando a bateria sai é o `swell`.

### As faixas anteriores

`gothic-lofi.mp3` — a trilha anterior, também gerada por `make_track.py` (a
versão do arranjo está no histórico do git). Boom-bap a 84 BPM com órgão, coro,
cravo e sino FM, sem chuva. 91,4 s, 1,05 MB. Também emenda sozinha e também
roda em `seamless`.

`lofi-loop.mp3` — Freesound **679187** ("Aesthetic Lofi Loop", de
`Seth_Makes_Sounds`), **CC0**. 160 s, 1,9 MB. Também emenda sozinha. Chill
demais para o jogo.

`battle-march.mp3` — Freesound **6935**, 11 s, 22 kHz. Também emenda sozinha.
**Confira a licença antes de publicar o jogo**: sons do Freesound são CC0,
CC-BY ou CC-BY-NC dependendo do autor, e a desta não foi confirmada.

Fora estes arquivos, todo o áudio é gerado em runtime — sprites, chão, efeitos
sonoros e a trilha de reserva — e o estalo de osso vive embutido em base64
(`js/assets/sfx-bone.js`). Se o arquivo da trilha sumir ou o navegador recusar
carregá-lo, `Soundtrack` cai para a trilha procedural em `js/music.js`.
