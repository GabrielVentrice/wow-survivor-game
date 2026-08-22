# audio/

`gothic-lofi.mp3` — **a trilha em uso.** Não veio de banco de sons: é gerada por
`tools/make_track.py` (numpy + scipy, sem sample de terceiro), então é nossa e
não tem licença a conferir. Lofi de fato — boom-bap a 84 BPM, fita com wow e
flutter, estalo de vinil, filtro em 8,2 kHz e saturação —, mas em cima da
harmonia que o Vampire Survivors herdou do Castlevania: Ré menor descendo
`Dm – C – Bb – A`, com o A maior do menor harmônico puxando de volta para o Dm.
Órgão e coro no fundo, cravo (Karplus-Strong) no contratempo, sino FM na
melodia. 91,428571 s, 96 kbps estéreo, 1,05 MB.

**A faixa fecha em si mesma, por construção.** São 32 compassos exatos; as
caudas de reverb e delay que passam do fim são somadas de volta no começo, todo
LFO tem período que divide o loop, os filtros de master rodam circulares e os
dois últimos compassos afinam num rufo de aro que entrega o downbeat para o
compasso 0. Medido: o degrau no ponto de volta é 0,012 contra 0,139 de degrau
típico entre amostras — ou seja, a emenda é mais suave que o próprio material.
Por isso `js/track.js` a toca com `loop = true` nativo. O mp3 decodifica em
4.032.000 quadros cravados (a tag gapless do LAME está lá, sem sobra de
encoder). **Não passe `{ crossfade: ... }` nesta faixa**: sobrepor uma faixa que
já emenda dobra a batida.

Para mexer no arranjo, edite `tools/make_track.py` e rode:

```bash
python3 tools/make_track.py /tmp/track.wav
ffmpeg -y -i /tmp/track.wav -codec:a libmp3lame -b:a 96k -ar 44100 -ac 2 \
       -write_xing 1 -id3v2_version 0 -map_metadata -1 audio/gothic-lofi.mp3
```

O script imprime o nível de cada barramento e o degrau no ponto de volta; a
mixagem inteira mora na tabela `LEVELS` (dBFS enquanto o barramento soa), e é
lá — em nenhum outro lugar — que se resolve "tal coisa está alta demais".

## Faixas antigas, mantidas como alternativa

Trocar é uma linha em `js/game.js`.

`lofi-loop.mp3` — Freesound **679187** ("Aesthetic Lofi Loop", de
`Seth_Makes_Sounds`), **CC0**. 160 s, 1,9 MB. Também emenda sozinha e também
roda em `seamless`. Chill demais para o jogo — foi o que motivou a troca.

`battle-march.mp3` — Freesound **6935**, 11 s, 22 kHz. Também emenda sozinha.
**Confira a licença antes de publicar o jogo**: sons do Freesound são CC0,
CC-BY ou CC-BY-NC dependendo do autor, e a desta não foi confirmada.

Fora estes arquivos, todo o áudio é gerado em runtime — sprites, chão, efeitos
sonoros e a trilha de reserva — e o estalo de osso vive embutido em base64
(`js/assets/sfx-bone.js`). Se o arquivo da trilha sumir ou o navegador recusar
carregá-lo, `Soundtrack` cai para a trilha procedural em `js/music.js`.
