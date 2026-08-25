# Áudio: vozes, trilhas e assets

> Extraído do `CLAUDE.md` — o porquê e a medição de cada regra.
> Leia antes de mexer em `js/voices.js`, `js/music.js`, `js/track.js` ou em `audio/`.

## Áudio: agendado no relógio do AudioContext, não no do jogo

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

### As vozes: um fato, duas consumidoras

`game.emitVfx(kind, ...)` alimenta **as duas** camadas — a que desenha
(`js/render/vfx.js`) e a que toca (`js/voices.js`). **Não existe registry de som
por peça**, e não pode existir: seriam duas listas para divergir, e a que
envelhecesse deixaria uma peça muda sem ninguém notar. Evento visual novo exige
voz nova, e `driver_vfx` reprova evento sem ela.

Dois fatos não têm evento visual e por isso são chamados à mão: **`cast`** (o
conjuro em si não desenha nada — quem desenha é o efeito) e **`hit`/`crit`** (o
acerto sem raio só acende o flash branco do inimigo). Eles moram em `VOICES`
sem par em `VFX_LIFE`, e o driver conhece a exceção pelo nome.

Quatro regras, e as quatro existem porque uma build madura põe dezenas de
eventos por segundo em tela:

- **Gap por voz, não global.** `VOICES.<nome>.gap` é o intervalo mínimo entre
  duas emissões daquela voz — mesma ideia do `hitstop.cooldown`. Ele é por voz
  porque a densidade tolerada é diferente: o estalo do acerto pode ser denso, o
  rasgo do portal não.
- **Duck por leva.** Nenhum gap individual segura dezenas de vozes *diferentes*
  no mesmo segundo; o que segura é a leva inteira abaixar, exatamente como
  `death()` já fazia com `_deathBurst`.
- **Dano contínuo não fala.** Tique de DoT e de zona cobram por sub-step
  enquanto durarem — um estalo por cobrança viraria metralhadora justo quando a
  horda fecha. Quem toca é evento **discreto**: acerto de projétil, dano
  instantâneo, `big`. É a mesma regra que os mantém fora do hitstop.
- **Distância corta antes de agendar.** Além de `SFX_RANGE` a voz não é nem
  criada, e a raiz quadrada da distância só é paga depois que o gap deixou
  passar (`Sfx.can` é a metade barata de `say`).

Tudo passa por um **barramento com compressor** (`Sfx._buildBus`). Não é
polimento: é o que torna possível dar voz a cada peça. Cinquenta acertos no
mesmo frame somam amplitude linearmente e estouram o master; com o compressor a
leva é empurrada para baixo junta, e o que se perde é volume, não informação.
Sem ele o caminho seria abaixar cada voz até ela sumir sozinha — o contrário do
que se foi buscar ali.

## Uma trilha, e ela é a que NÃO acontece

`TRACKS` (`js/track.js`) é a lista, e a tecla `N` percorre ela mais o silêncio.
Hoje há uma entrada — **Vigília → mudo** —, então `N` é liga/desliga. A lista
continua sendo uma lista porque a máquina de troca é o que torna barato voltar
a ter duas.

| | **Vigília** (`focus-vigil.mp3`) | **Tempestade** (`rain-lofi.mp3`, fora de `TRACKS`) |
|---|---|---|
| o que é | leito de foco: nada acontece | lofi de chuva, com arranjo |
| gerador | `tools/make_focus_track.py` | `tools/make_track.py` |
| passeio de volume (2 s, p5–p95) | **1,4 dB** | 6,8 dB |
| maior salto de 250 ms sobre o fundo | **2,3 dB** | 7,8 dB |
| janelas de 250 ms saltando > 6 dB | **0** de 640 | 7 de 426 |

**A Vigília é a única porque uma run dura doze minutos.** Trilha de fundo de
jogo longo não é faixa: é o lugar onde o jogo acontece. O que a Tempestade fazia
de propósito — subir na seção cheia, sumir no break, responder com um trovão —
é exatamente o que um ouvinte desatento não consegue ignorar; os sete saltos
dela são os três trovões, os dois cymbal swells e as duas viradas. Cada um é
bom numa faixa e é um cutucão num fundo. Some a isso a banda: a chuva é dona de
tudo acima de 6 kHz, que é onde os efeitos dizem que alguém morreu. Foi essa
coluna da direita que tirou a Tempestade da lista; o arquivo continua em
`audio/` como alternativa, e trazê-la de volta é uma linha.

Cinco regras caem daí, e valem para qualquer mexida no leito:

- **Quem carrega a Vigília é o ruído**, não a harmonia — é a camada que por
  construção não tem evento dentro. E ele é ESCURO: marrom abaixo do joelho de
  220 Hz, **−10 dB/oitava acima** e teto de banda em 1,8 kHz.
  **Esses números já foram 300 Hz / −4,2 dB/oitava / 7,2 kHz, mais uma camada
  `air` de ruído puro de 900 Hz a 11 kHz — e aquilo não lia como leito, lia
  como CHUVA.** O argumento antigo era que um leito marrom a `0.055` de ganho
  some no laptop, e ele estava certo sobre o volume e errado sobre a saída:
  compensou com rosa até 7 kHz, que é a receita de chiado. Medido, banda a
  banda, em dB de energia:

| banda | antes | depois |
|---|---|---|
| 30–120 Hz | 81,2 | **82,7** |
| 120–400 Hz | 82,1 | **85,2** |
| 400–1000 Hz | 78,4 | 75,8 |
| 1–2 kHz | 75,7 | 63,7 |
| 2–4 kHz | 74,6 | **45,8** |
| 4–8 kHz | 71,1 | **17,9** |
| 8–16 kHz | 56,5 | **−7,0** |

  A correção é de BANDA e não de nível — baixar o ganho só daria um chiado
  quieto. O grave sobe 3 dB porque a mesma energia se concentrou embaixo, e a
  faixa de 4–8 kHz, que é onde o som de acerto e de morte falam, ficou vazia.
- **O `air` saiu inteiro.** Não existe ajuste de banda que faça 900 Hz–11 kHz
  de ruído puro soar como outra coisa que não chiado: ele *era* o brilho, e
  brilho feito de ruído é exatamente o som que se foi remover.
- **E nada mais se move junto.** Levantar as camadas com nota em 1,5 dB para
  "ocupar o espaço que o `air` deixou" empurrou o passeio de RMS de 1,40 para
  **1,65 dB**, acima do `< 1,5` a que o leito é preso — o passeio vem das
  camadas que ANDAM, e o ruído é a que não anda. O `air` estava a −33 dBFS:
  não havia espaço nenhum para ocupar.
- **Nada acontece.** Sem bateria, sem virada, sem lead, sem poeira, sem trovão,
  sem seção. A harmonia se move devagar demais para chegar (um acorde a cada
  32 s, 8 s de cruzamento), e ela **não puxa**: Ré menor natural sem sensível,
  então sem dominante, então sem expectativa esperando resolver. `make_track.py`
  faz o oposto de propósito, porque uma faixa quer essa tensão.
- **O baixo é um PEDAL, e quem pediu foi a medição.** Com uma fundamental por
  acorde a banda de 20–120 Hz passeava **6,35 dB** ao longo do loop — um Si
  bemol 1 carrega muito mais energia lá embaixo que um Sol 2 — e isso sozinho
  era a maior parte do passeio da faixa.
- **O pulso é estrutura de tempo, não groove**: 60 BPM exatos, seno filtrado com
  **30 ms de ataque**. Todo tambor de `make_track.py` ataca em menos de 4 ms
  porque uma faixa quer o estalo; aqui o estalo é a única coisa capaz de fazer
  alguém levantar a cabeça de um leito estável.
- **Camada nova entra pelo teste de evento.** Os dois geradores imprimem o
  passeio de RMS e o maior salto de 250 ms; no leito o alvo é `< 1,5 dB` e zero
  janelas acima de 6 dB. Passou disso, é um som avulso — e som avulso não entra
  num leito.

**Carregar é preguiçoso e a troca espera.** Só desce a trilha que vai tocar, e a
troca só efetiva quando o arquivo novo fica pronto — até lá continua tocando o
antigo, e se o novo falhar fica o antigo. O jogo nunca fica mudo por causa de um
download. `driver_track` cobra os três com uma lista de duas montada só para o
teste, porque a máquina não pode enferrujar enquanto `TRACKS` tem uma.

## Assets: três, e todos com plano B

Sprites, chão, efeitos sonoros e a trilha de reserva são gerados em runtime.
**Não adicione arquivos de imagem.** Os assets de áudio que existem seguem duas
regras diferentes, e a diferença é `file://`. Nenhum vem de banco de sons: as
trilhas são sintetizadas por `tools/make_focus_track.py` e `tools/make_track.py`
— **inclusive a chuva** da Tempestade, que era ruído modelado no espectro e não
gravação de campo — e o estalo de osso está embutido; não há licença de terceiro
a conferir em nada que o jogo toca.

| Asset | Como carrega | Por quê |
|---|---|---|
| `audio/focus-vigil.mp3` (trilha; as alternativas em `audio/` entram do mesmo jeito) | `<audio src>` em `js/track.js` | `fetch`/XHR são bloqueados em `file://` (origem opaca); elemento de mídia com caminho relativo carrega. Volume por `.volume`, não por GainNode — `createMediaElementSource` sobre mídia de origem opaca sai em silêncio. |
| osso quebrando (efeito) | base64 → `atob` → `decodeAudioData` | Precisa sobrepor e variar de tom dezenas de vezes por segundo; `<audio>` não dá isso. Base64 não passa por rede, então funciona em `file://`. 21 KB. |

**Os dois caminhos têm fallback e o jogo nunca fica mudo:** `Soundtrack` cai
para a trilha procedural se nenhum mp3 carregar (e a procedural cobre o menu
enquanto o arquivo baixa), e `Sfx.death` volta aos estalos sintéticos se a
amostra não decodificar. Os drivers `driver_track` e `driver_audio` testam
esses caminhos.

**Modo de repetição da trilha.** `Track` tem dois, e escolher errado estraga a
faixa. `seamless` (padrão) usa `loop = true` nativo, para faixa montada para
emendar — é o caso de **todas as do projeto**, que fecham em si mesmas por
construção (compassos inteiros, caudas dobradas de volta no começo, LFOs com
número inteiro de ciclos dentro do loop, filtros de master circulares, e as
camadas de ruído — leito aqui, chuva na Tempestade — geradas no domínio da
frequência, periódicas por construção). Na Vigília entra mais uma: toda frequência de oscilador é
arredondada para um número inteiro de ciclos por loop, correção de no máximo
0,00625 Hz, senão cada voz sustentada termina no meio de um ciclo e a volta é um
clique. `{ crossfade: 3.5 }` usa dois elementos que se cruzam no fim, para faixa
que *não* emenda. Cruzar uma faixa que já emenda é pior que não fazer nada: o
cruzamento sobrepõe a faixa com ela mesma e dobra a batida na volta.

Volume de fundo mora em `TRACK_LEVEL` (`js/track.js`) e em `Music._applyLevel`.
É **um par de níveis para as duas trilhas** — elas estão a 0,3 dB de RMS uma da
outra, e um volume por faixa seria uma segunda tabela para divergir. Trilha tem
que ficar **atrás** dos efeitos: se competir com o som de morte, o jogador perde
informação de combate.

