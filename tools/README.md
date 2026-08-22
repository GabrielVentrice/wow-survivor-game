# tools/ — verificação headless

O jogo não tem build nem test runner. Estes scripts sobem um stub mínimo de
DOM/canvas no node, carregam os mesmos `<script src>` que o `index.html` carrega
(na mesma ordem) e rodam a simulação sem browser. Servem para pegar erro de
runtime, hook morto, evolução quebrada e travamento de frame — coisas que só
aparecem depois de vários minutos de jogo.

```bash
node tools/harness.js .                    # run completa, seed 1, 12 min
node tools/harness.js . 3 15               # seed 3, 15 min de jogo
DRIVER=driver_evo.js   node tools/harness.js .   # as 7 evoluções + regras de eixo/caminho
DRIVER=driver_hooks.js node tools/harness.js .   # todo hook de capstone/passiva dispara?
DRIVER=driver_dot.js   node tools/harness.js .   # cadência, stacking e expiração de DoT
DRIVER=driver_audio.js node tools/harness.js .   # som de morte: grafo, throttle, mudo
DRIVER=driver_music.js node tools/harness.js .   # trilha: andamento, camadas, estados
DRIVER=driver_render.js node tools/harness.js .  # cenário, demônios e explosão: render e caches
DRIVER=driver_track.js node tools/harness.js .   # trilha em arquivo: loop, fallback, estados
DRIVER=driver_cards.js node tools/harness.js .   # cartas de level up: faixa de tipo, pips, custo
DRIVER=driver_portal.js node tools/harness.js .  # portal: moldura, boca, runas, abertura
DRIVER=driver_chest.js node tools/harness.js .   # baú: cadência de aparição e tamanho do prêmio
DRIVER=driver_form.js  node tools/harness.js .   # metamorfose por capstone e aura por spell concluída
DRIVER=driver_pixel.js node tools/harness.js .   # grid de pixel: buffer, câmera, escala de sprite, laje
PAGE=vfx.html DRIVER=driver_gallery.js node tools/harness.js .      # galeria de animações: todo card monta, anima e desenha
PAGE=sprites.html DRIVER=driver_gallery.js node tools/harness.js .  # galeria de sprites: só o smoke de carga
DRIVER=driver_balance.js node tools/harness.js . 5 16   # balanceamento (5 runs x 4 políticas)
DRIVER=driver_perf.js node tools/harness.js . 12        # custo de frame com a horda no teto
```

## Balanceamento

`driver_balance` põe um bot no controle e roda muitas runs sob quatro políticas
de escolha. O bot não é um humano — é um piloto de referência, e os números
absolutos dele valem menos que as comparações.

O alvo **não** é sobreviver X minutos. É o **degrau de poder**: abates/segundo
do último terço da run divididos pelos do primeiro. Abaixo de 2x o jogador não
sente que ficou mais forte, só que o jogo ficou mais difícil.

Estado medido (20 runs):

| métrica | alvo | agora |
|---|---|---|
| degrau de poder | ≥ 4x | 4.6 – 6.8x (3 de 4 políticas) |
| sobrevivência mediana | 8 – 14 min | 7:26 – 12:42 |
| runs que terminam em morte | ~todas | 19/20 |
| pool de eixos gasta | 20/20 | 20/20 |
| runs com evolução | ≥ 25% | 25% |
| runs com capstone | ≥ 25% | 40% |
| runs com aura (spell concluída) | ≥ 25% | 50% |
| runs com metamorfose | ≥ 25% | 40% |

A política `agressivo` marca 1.2x: ela ignora defesa e controle por construção,
morre cedo, e o terço inicial curto distorce a razão. É arquétipo glass cannon
falhando, não regressão.

`make_track.py` não é driver: é o gerador da trilha de fundo
(`audio/gothic-lofi.mp3`). Precisa de numpy e scipy, roda em ~7 s e imprime o
nível de cada barramento e o degrau no ponto de volta do loop. Como reencodar
está em `audio/README.md`.

O stub de `AudioContext` monta o grafo de verdade e explode em rampa
exponencial com alvo <= 0, então erro de WebAudio aparece aqui e não só no
browser.

O driver padrão também valida o registry antes de simular: tiers faltando,
efeito ou hook inexistente, `key` que muda na evolução, mod em stat que não
existe, `requires` apontando para nada e cor fora da paleta do eixo.

Onde a condição do teste é específica demais para sair de uma simulação
aleatória — Colheita precisa de um inimigo com 3+ DoTs *morrendo*, Contágio
precisa de um DoT expirando num alvo *vivo* — o driver provoca a condição à
mão. Testar mecanismo, não sorte de seed.
