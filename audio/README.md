# audio/

`battle-march.mp3` — trilha de fundo. Origem: Freesound, som **6935**
(`freesound_community-battle-march-action-loop-6935.mp3`), 11s, 22 kHz.

**A faixa emenda sozinha** (começa e termina no talo, sem fade nas pontas),
então `js/track.js` a toca com `loop = true` nativo. Se um dia for trocada por
uma faixa que *não* emenda, passe `{ crossfade: 3.5 }` ao `Soundtrack` — mas
não use cruzamento nesta: sobrepor 3,5s de um loop de 11s dobra a batida.

**Confira a licença antes de publicar o jogo.** Sons do Freesound são CC0,
CC-BY ou CC-BY-NC dependendo do autor. Se for CC-BY, o crédito precisa aparecer
em algum lugar visível. A página do som é `https://freesound.org/s/6935/`.

Este é o único arquivo de áudio do projeto — sprites, chão, efeitos sonoros e a
trilha de reserva são gerados em runtime, e o estalo de osso vive embutido em
base64 (`js/assets/sfx-bone.js`). Se este arquivo sumir ou o navegador recusar
carregá-lo, `Soundtrack` cai para a trilha procedural em `js/music.js`.
