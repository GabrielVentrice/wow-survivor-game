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
```

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
