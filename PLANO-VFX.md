# Plano de VFX — de "acontece alguma coisa" para "eu FIZ aquilo"

Documento de trabalho. A doutrina que sobreviver às fases sobe para o
`CLAUDE.md`; o resto morre aqui.

---

## 1. O diagnóstico, medido

Não é impressão: são contagens tiradas do registry (`DRIVER=_inv.js`) e da
própria galeria (`driver_gallery`).

| Fato | Número |
|---|---|
| Peças no catálogo | **43** |
| Peças que acendem aura no warlock (`vfx:`) | **14** |
| Desenhos de aura distintos (`PIECE_VFX`) | **7** — `rot`, `ember`, `thorn`, `chain`, `meteor`, `blood`, `sigil` |
| Peças que **nunca** acendem nada no personagem | **29** |
| Eventos visuais no jogo inteiro (`VFX_LIFE`) | **11** |
| Peças que emitem `burst` (a MESMA bola de fogo) | **16** + 4 hooks + capstones + a morte do Gan'arg |
| Desenhos de projétil | **2** (bola / cometa) para todo tiro do jogo e de todo demônio |
| Desenhos de zona no chão | **1** (`AreaEffect.draw`) para Rain of Fire, Vile Taint, Burning Trail, Nether Portal… |
| Desenhos de partícula | **1** (círculo AA), e morte de inimigo comum são **6** delas |
| Mecânicas que a galeria marca **sem tell nenhum** | **25** |
| Sons de combate | **0** |

Cinco defeitos, e cada um explica uma parte da queixa:

**D1 — Uma forma para dezesseis peças.** `damage_instant` com raio sempre emite
`burst`. Shadowfury (nova de sombra), Implosion (imp detonando por dentro),
Malefic Rapture (todos os DoTs sendo rasgados de uma vez), Cataclysm (meteoro),
Seed of Corruption, Conflagrate, Voraz, Nihilam — **a mesma bola de fogo em
matiz diferente.** E como a regra de cor amarra matiz ao *eixo*, duas peças do
mesmo eixo saem **idênticas**. A cor nunca vai poder diferenciá-las: quem tem
que diferenciar é a forma, e hoje há uma só.

**D2 — 29 peças não têm assinatura.** Fechar Curse of Tongues no tier 5 e fechar
Banish no tier 5 dão exatamente o mesmo nada. A aura era o prêmio por concluir
uma spell, e dois terços do catálogo não têm prêmio.

**D3 — 25 mecânicas cobram do jogador em silêncio.** A própria galeria já
acusa: `weaken` não desenha nada, `mark` (Haunt) amplifica todo dano recebido e
é invisível, `knockback` teleporta sem rastro, `pull` idem, `self_speed` e
`self_damage` (Burning Rush) não têm um pixel, `chain` **não desenha a ligação
entre os dois alvos**, `heal` não existe no mundo. Slow/stun/fear são um anel de
**4 pixels** acima da cabeça, em amarelo/roxo/ciano cravados no código.

**D4 — A morte não é recompensa.** O único momento de dopamina garantido de um
survivors — vinte corpos caindo no mesmo pulso — são **6 bolinhas** na cor do
inimigo, sem dissolução do sprite, sem estilhaço, sem evento visual, sem
combo, sem som escalando. O sprite simplesmente some do pool.

**D5 — O combate é mudo.** `Sfx` tem `death`, `hurt`, `levelUp`, `combo`,
`boss`, `item`, `gameOver`. **Nenhuma peça toca som.** Nenhum conjuro, nenhum
impacto, nenhuma explosão, nenhuma invocação. Metade de "não fica claro que
está acontecendo" é literalmente isto — falta o canal inteiro que os jogos do
gênero usam para dizer que o golpe conectou.

Dois defeitos menores que caem junto, os dois violando regras que o projeto já
escreveu para si:

- **Cor fora da paleta no código de render.** O escudo é `rgba(120,200,255)` —
  ciano, cor que a identidade extinguiu — e é **a mesma casca para as 6 peças
  de escudo**. Os anéis de controle são `#ffd24a`/`#c850ff`/`#5acfff`. O
  gradiente do projétil sem rastro termina em `rgba(122,60,255,0)`, então
  **todo tiro de fogo desbota para roxo na borda**. `driver_palette` só olha
  `SPRITE_DATA`; `driver.js` só olha `color:` de conteúdo. Ninguém olha
  `js/render/` nem `js/entities.js`.
- **Gradiente onde deveria haver grade.** Zona, projétil, partícula e aura são
  desenho vetorial suave por cima de pixel art em grade inteira — é o mixel que
  o `CLAUDE.md` já proíbe para sprite, entrando pela porta dos efeitos.

**O que NÃO está quebrado, e não deve ser tocado:** o gerador de explosão
(`explosionFrames`), o portal, o hitstop/shake de `BALANCE.camera`, as duas
curvas de `VfxLayer.draw`, o teto de 160 vfx e o `1/sqrt(n)` das auras. A
infraestrutura é boa. **O que falta é variedade de formas e cobertura.**

---

## 2. A tese

> VFX profissional não é mais brilho. É que cada peça tenha **uma silhueta em
> movimento**, **uma cadência** e **um som**.

Hoje o jogo tem uma silhueta (bola), uma cadência (impacto → dissipação) e
nenhum som.

E como **cor é predicado do eixo** (regra existente, e ela fica), a
diferenciação tem que sair inteira de **forma, movimento e tempo**. Isso é
restrição, não obstáculo: é o mesmo aperto que fez a paleta mestre ficar boa.

### As quatro batidas de um evento

| Batida | Duração | O que faz | Hoje |
|---|---|---|---|
| **Antecipação** | 0,08–0,15s | telégrafo: sombra no chão, carga no ponto, runa acendendo | **não existe** |
| **Impacto** | 1 quadro | flash + forma nascendo + shake direcional + hitstop + som | existe pela metade (sem som) |
| **Dissipação** | 0,3–0,6s | duas curvas (tamanho ≠ brilho) | existe, e está certo |
| **Resíduo** | 0,5–1,5s | chamusco, poça, estilhaço, marca no chão | **não existe** |

Antecipação e resíduo são o que separa "piscou" de "aconteceu". Antecipação
também é **justiça**: um meteoro que cai sem sombra no chão é dano que o
jogador não teve como ler.

### As seis regras (candidatas a subir para o `CLAUDE.md`)

| # | Regra | O que significa |
|---|---|---|
| **V1** | **Uma peça, uma silhueta** | Nenhum evento visual serve duas peças sem parâmetro que as separe de relance. Duas peças do mesmo eixo lado a lado têm que ser reconhecíveis com a cor apagada. |
| **V2** | **Mecânica que cobra, avisa** | Efeito que muda o estado do inimigo ou do jogador desenha alguma coisa. `weaken` invisível é imposto cobrado sem nota fiscal. |
| **V3** | **Forma diz o QUÊ, cor diz DE QUEM** | Matiz continua reservado ao eixo. Toda identidade nova vem de silhueta, direção, ritmo e contagem. |
| **V4** | **Todo golpe tem som** | Som é o canal mais barato de "aterrissou", e o único que o jogo não usa. Sujeito à mesma cadência do hitstop. |
| **V5** | **Escala com a quantidade** | Todo efeito novo declara: quantos cabem em tela? Teto, `1/sqrt(n)` ou limiar — a regra que já vale para as auras vale para tudo. |
| **V6** | **Evento é grade, luz é gradiente** | Corpo do efeito nasce em pixel na resolução do buffer (como `explosionFrames`). Gradiente fica só para luz difusa e halo. |

---

## 3. A arquitetura: archetype + parâmetros

Trinta e poucos desenhos à mão envelhecem no primeiro rebalanceamento — é o
mesmo argumento que impediu texto por tier. A saída é a que a paleta já usa:

> **Rampa compartilhada, fatia não.** Doze archetypes de evento, e cada peça
> toma uma fatia própria de parâmetros.

Concretamente: generalizar `explosionFrames` (`js/sprites.js`) num gerador de
eventos em pixel, `js/render/fx-shapes.js`, com a mesma estrutura que a
explosão já provou — campo de distância + harmônicos no ângulo + curva de
crescimento + rampa de bandas, gerado uma vez e cacheado por
`(archetype, cor, grade, variante)`. Custo de runtime: um blit. Igual hoje.

### Os doze archetypes

| id | Silhueta | Cobre |
|---|---|---|
| `bloom` | bola de fogo irregular que se esvazia (o atual) | Conflagrate, Chaos Bolt, detonações de Cataclismo |
| `implode` | anéis convergindo, colapso, flash **depois** | Implosion, Voraz, Nihilam, Doom fechando |
| `nova` | anel achatado varrendo o chão, sem corpo central | Shadowfury, stun em área, Howl of Terror |
| `rip` | talho vertical, duas metades separando, luz vazando | Malefic Rapture, Shadowburn/execute, Unstable Affliction |
| `spore` | nuvem irregular subindo, esporos se soltando | Corruption, aplicação de DoT, spread |
| `arc` | filamento quebrado ligando **dois pontos** | `chain`, Contágio, salto de DoT (hoje: nada) |
| `spike` | estacas subindo do chão em anel | Seed of Corruption, Demon Skin (espinhos) |
| `sigil` | runa em grade que grava no chão, gira e queima | maldições, Agony, Banish |
| `slam` | impacto de cima com cratera e poeira | Infernal, Cataclysm, Felguard aterrissando |
| `veil` | casca facetada em volta do dono | os 6 escudos (mata o ciano) |
| `siphon` | filamentos puxando do alvo para o warlock | Drain Life, Soul Rot, lifesteal, cura |
| `gate` | o portal (já existe, `drawPortal`) | Nether Portal, invocações grandes |

Doze desenhos, 43 leituras — porque cada peça declara a **fatia**: escala,
contagem, ritmo, direção, quantos quadros, se tem resíduo, se tem antecipação.

### O schema: `fx` é irmão de `vfx`, e é dado

Conteúdo continua sendo dado; o motor continua genérico.

```js
{
  id: "shadowfury", …
  vfx: "sigil",              // aura no warlock quando a spell fecha (já existe)
  fx: {                      // NOVO: a assinatura do disparo
    shape: "nova",           // um dos doze archetypes
    tell: 0.12,              // antecipação, em segundos (0 = sem)
    residue: "scorch",       // resíduo no chão
    sfx: "boom",             // família de som
    count: 1, spin: -1,      // a fatia
  },
}
```

`EFFECTS.damage_instant` deixa de emitir `"burst"` cravado e passa a emitir o
`fx` da peça, com fallback para `bloom`. Peça sem `fx` continua funcionando —
só não tem identidade, e o driver reprova.

### Marcas de debuff: 8×8 em osso, não anel de 4px

Os anéis de controle viram grades pequenas monocromáticas sobre o inimigo, pela
mesma razão pela qual o `Glyph` existe na UI: forma distingue onde a cor já
está ocupada.

| Estado | Marca | Hoje |
|---|---|---|
| stun | corrente partida | anel amarelo 4px |
| fear | crânio virado de costas | anel roxo 4px |
| slow | âncora / peso | anel ciano 4px |
| weaken | boca costurada | **nada** |
| mark (Haunt) | olho aberto que pisca a cada dano amplificado | **nada** |
| convert (Enslave) | coleira + contorno trocado | anel de summon genérico |

---

## 4. As fases

Ordenadas por dopamina-por-hora, não por elegância. Cada uma fecha sozinha,
roda a bateria e commita.

> **Estado:** fases 0 a 3 entregues (`feat/vfx-impacto`). Placar do
> `driver_vfx`, do começo até aqui:
>
> | | fase 0 | fase 3 |
> |---|---|---|
> | assinaturas visuais distintas | 14 | **24** |
> | peças que disparam sem desenhar nada | 8 | **1** |
> | cores fora da paleta no render | 15 | **11** |
> | vozes | 0 | **17** |
> | mecânicas sem tell (galeria) | 25 | **16** |

### ~~Fase 0 — Instrumentação~~ ✅
Sem isso as fases seguintes não têm como provar nada.
`tools/driver_vfx.js`. **A assinatura de cada peça não sai de uma tabela: cada
peça é adquirida sozinha numa build limpa e DISPARADA pelo funil real
(`firePiece`), e o que ela faz aparecer é anotado.** Tabela de "o que cada
efeito desenha" seria uma segunda lista para divergir da primeira.

Três checagens, todas contra uma **DÍVIDA declarada** — o que já está quebrado
está listado com a fase que o mata. O driver falha quando aparece algo **novo**
fora da lista, e falha também quando um item da lista foi **consertado e não
saiu dela**: lista que mente é pior que lista nenhuma.

1. **Cor cravada em `js/render/` e `js/entities.js`.** A regra é objetiva: cor
   com croma ≥ 24 que aparece literal no código de desenho tem que sair de
   `PAL`/`AXIS_PALETTE`/`UI_PAL`. Neutro passa sozinho — contorno, sombra e o
   branco de um flash não são decisão de identidade. Cor de inimigo e de
   demônio **não** entram na lista de autorizadas: elas são dado, e dado se
   referencia. Foi assim que o anel de stun virou o âmbar do Tirano e o de fear
   virou o roxo do Darkglare — coincidência lida como intenção.
2. **Peça muda**: assinatura desenhada vazia. A mesa de teste não pode ser
   homogênea — `onlyDotted` (Malefic Rapture) sai calada num inimigo limpo e
   `execute` (Shadowburn) só acende abaixo do limiar, então um em cada três
   alvos nasce na faixa de execução, metade já apodrecida, e o jogador em 40%
   de vida para as peças de emergência acordarem. Sem isso o driver estaria
   medindo o próprio cenário.
3. **Irmãs visuais**: duas peças com a mesma assinatura. Contagem de pico e não
   de fim — um projétil nasce e morre dentro do intervalo (a 480 u/s ele cobre
   os 70 até o alvo em 0,15s), e olhar só o estado final dava Incinerate como
   peça que não desenha nada.

### ~~Fase 1 — Som de combate~~ ✅
`js/voices.js`, o irmão de `js/render/vfx.js`. **Não há registry de som por
peça, e não pode haver**: seriam duas listas para divergir, e a que
envelhecesse deixaria uma peça muda sem ninguém notar. O mesmo fato
(`game.emitVfx`) alimenta as duas camadas, então evento visual novo exige voz
nova — e `driver_vfx` reprova evento sem ela.

14 vozes: os 11 eventos visuais mais `cast`, `hit` e `crit`, que são os fatos
sem evento visual (o conjuro não desenha por si; o acerto sem raio só acende o
flash do inimigo).

Quatro travas de densidade, porque uma build madura põe dezenas de eventos por
segundo em tela:

- **gap por voz**, não global — o estalo do acerto pode ser denso, o rasgo do
  portal não;
- **duck por leva** (o mesmo mecanismo que `death()` já usava), porque nenhum
  gap individual segura dezenas de vozes *diferentes* no mesmo segundo;
- **dano contínuo não fala** — tique de DoT e de zona cobram por sub-step, e um
  estalo por cobrança viraria metralhadora justo quando a horda fecha. É a
  mesma regra que os mantém fora do hitstop;
- **distância corta antes de agendar**, e a raiz quadrada só é paga depois que
  o gap deixou passar.

Tudo passa por um **barramento com compressor**. Não é polimento: é o que torna
possível dar voz a cada peça — sem ele o caminho seria abaixar cada voz até ela
sumir sozinha.

**Verificação:** `driver_audio` estendido — as 14 vozes montam o grafo, o gap
segura 40 acertos em 0,4s dentro de 8 sons, além de `SFX_RANGE` a voz não é nem
criada, o mudo silencia, e **90s de jogo de verdade usam 4 vozes diferentes**
(`cast`, `hit`, `summon`, `burst`). Esse último é o que pega o caso que motivou
a fase: grafo perfeito, registry completo, e nenhuma chamada partindo do jogo.

### ~~Fase 2 — A morte~~ ✅
Três peças, e a que mais importa não é a mais vistosa:

**O corpo se desfaz nas cores DELE.** `spriteShards` lê a mesma grade que
desenha a criatura — o plano falava em usar `spr.white`, mas a silhueta branca
dá o formato e joga fora a informação que interessa. Lendo `SPRITE_DATA.rows`
+ `pal` direto, cada inimigo morre na própria paleta: ghoul verde-podre,
esqueleto osso, Fel Lord brasa. **Zero arte nova.** E funciona headless, que a
amostragem do canvas não faria.

Estilhaço virou uma **segunda espécie de partícula**: quadrada, presa ao grid,
que não encolhe e que **cai**. A bolinha redonda suavizada ficou só para os
eventos de UI. `shardBurst` mora fora do `Game` e recebe um `emit`, então a
galeria monta o mesmo estilhaço com um array no lugar do `Pool`.

**A alma sai do corpo**: arco de 0,42s no orbe de XP, deslocando só o desenho —
o raio de ímã continua medido onde o orbe está.

**A ceifa** (`BALANCE.reap`): calor que sobe um por abate e esfria por segundo,
três degraus, e o degrau só rearma quando o calor cai. Anel duplo no chão na
cor do eixo dominante + a única voz do jogo que **sobe**.

**Verificação:** `driver_vfx` ganhou quatro checagens — 9 paletas de estilhaço
distintas (uma por inimigo), o orçamento respeitado com o pool a 416/420, 60
abates em leva dando **três** anúncios (um por degrau, nunca um por corpo) e
abate esparso não acendendo nenhum. `driver_perf`: 0,7ms de 16,7ms no pior
bucket com a horda no teto.

### ~~Fase 3 — As mudas~~ ✅
O achado da fase: **não é um formato de tell, são três**, e qual usar sai da
natureza do fato.

- **Estado do inimigo → marca 9×9 sobre a cabeça** (`STATE_MARKS`). Os três
  anéis de 4px em amarelo/roxo/ciano viraram cinco formas em osso — X, seta
  dupla, ampulheta, seta para baixo, olho —, e `weaken` e `mark`, que não
  tinham nada, entraram. Nove e não os 16 de `UI_ICONS`: encolher aquela grade
  não devolve o desenho, devolve mancha.
- **Relação entre dois lugares → evento de dois pontos.** `VfxLayer` ganhou
  `x2/y2`, e `link`/`dash` cobrem `chain`, Contágio, empurrão, puxão e o blink
  do Demonic Circle. O salto acontecia ENTRE dois corpos e era exatamente esse
  entre que não era desenhado.
- **Estado do jogador que dura → sobreposição**, nunca evento por pulso. É o
  Burning Rush, que era a mecânica mais invisível do jogo.

Três das quatro cores cravadas mais visíveis morreram junto (os anéis de
controle), então parte da fase 7 veio de graça.

**Verificação:** o driver precisou aprender a enxergar tell que não é evento
emitido — marca e sobreposição contam como desenho. Mudas 8 → 1 (sobrou Soul
Leech, cuja casca é a mesma das outras cinco peças de escudo: fase 5), tarjas
da galeria 25 → 16, e a mesa de teste passou a satisfazer toda condição que uma
peça declara (Demonic Circle pede 7 inimigos em volta; com 6 na mesa o driver
media a própria mesa).

### Fase 4 — O gerador (1–2 sessões)
`js/render/fx-shapes.js`: generaliza `explosionFrames`. Entra com quatro
archetypes (`bloom` migrado, `implode`, `nova`, `rip`). Nenhuma mudança de
conteúdo ainda — a explosão de hoje tem que sair pixel a pixel igual.

### Fase 5 — Assinatura por peça (2–3 sessões)
Os oito archetypes restantes e o campo `fx` em todas as 43. É aqui que "repetido"
acaba. Sub-lotes por eixo, para cada commit ser revisável na galeria.

### Fase 6 — Antecipação e resíduo (1 sessão)
A batida 1 e a batida 4 em quem ganha mais com elas: sombra no chão antes do
meteoro, carga antes do Chaos Bolt, chamusco depois da explosão, poça depois da
zona. Revisar `hitstop`/`shake` para os eventos novos.
**Verificação:** `driver_feel`.

### Fase 7 — Limpeza de paleta (meia sessão)
Ciano do escudo → `veil` na cor da peça. Anéis de controle → marcas em osso.
Parada roxa do gradiente do projétil → cor do próprio tiro. Orbe genérico de
demônio. Fecha o que a Fase 0 passou a reprovar.

---

## 5. O teste de fim de linha

Quatro perguntas, na linha das que a UI já tem:

1. **Com a cor apagada, dá para dizer qual peça disparou?** Se não, V1 falhou.
2. **Cinquenta na tela ao mesmo tempo — ainda dá para achar o warlock?** A
   hierarquia de leitura não se negocia por causa de efeito bonito.
3. **De olhos fechados, dá para saber que o golpe conectou?** É a Fase 1.
4. **Vinte mortes no mesmo pulso dão vontade de fazer de novo?** É a Fase 2, e
   é a pergunta que o resto do plano existe para responder.
