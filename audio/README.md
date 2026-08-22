# audio/

`rain-lofi.mp3` — **a trilha em uso.** Não veio de banco de sons: é gerada por
`tools/make_track.py` (numpy + scipy, sem sample de terceiro), então é nossa e
não tem licença a conferir — **a chuva também é sintetizada**, ruído modelado
no domínio da frequência e milhares de estalos curtos, não gravação de campo.

Lofi de chuva: uma tempestade ouvida de dentro, com um boom-bap lento por baixo
— fita com wow e flutter, estalo de vinil, Rhodes no contratempo, caixa
escovada — sobre a mesma harmonia que o Vampire Survivors herdou do
Castlevania: Ré menor descendo `Dm – C – Bb – A`, com o A maior do menor
harmônico puxando de volta para o Dm. 72 BPM, 106,666667 s, 96 kbps estéreo,
1,28 MB.

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

## Faixas antigas, mantidas como alternativa

Trocar é uma linha em `js/game.js`.

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
