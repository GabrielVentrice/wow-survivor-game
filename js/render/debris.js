"use strict";
/* =========================================================================
   DEBRIS — os destroços do mapa como grade, não como código de desenho.

   Mesma virada das lajes (`js/render/tiles.js`), e as regras que caem daí são
   mais duras aqui, porque prop é objeto e não fundo:

   1. UM TAMANHO SÓ, e ele é 1 célula = 1 pixel de buffer. O desenho antigo era
      vetor e aceitava `s` contínuo entre 0,7 e 1,45; grade aceita degrau, e o
      único degrau que não briga com o resto do elenco é o 1:1. Prop desenhado
      em `step 2` é o mixel silencioso — escala inteira que não bate com o
      ghoul ao lado.
   2. Variação vem do ESPELHO, não da rotação. Girar uma grade fora de 90° é
      reamostrar; espelhar é inteiro. Dois lados por tipo.
   3. O sprite NÃO carrega brilho nem sombra. `drawShadow` põe a elipse no pé e
      `glowBlob` acende o que tem que acender — desenhados na arte, os dois
      vazam para fora da silhueta e apagam onde o objeto termina.

   `foot` diz onde o objeto toca o chão: `base` é o pé de quem fica em pé,
   `mid` é o centro de quem está deitado no chão.
   ========================================================================= */

const PROP_ART = {
  // coluna partida, com o fel escorrendo pela fratura
  pillar: {
    foot: "base",
    pal: { o: PAL.inkDeep, d: PAL.stone0, m: PAL.stone1, l: PAL.stone2, e: PAL.fel0, E: PAL.fel1 },
    rows: [
      ".......ool......",
      "......olllll....",
      "......lllmmlll..",
      ".....olllmmmlllo",
      ".....lllmmmmmddo",
      "....olllmmmmdddo",
      "....lllmmmmmddd.",
      "...ollmmmmmddd..",
      "...ollmmmmdddo..",
      ".....ommmmddd...",
      "..olleEemmddo...",
      "..ollmmEmedd....",
      "..ollmmmmddd....",
      "..ollmmmmddd....",
      "..ollmmmmddd....",
      "..ollmmmmddd....",
      "..ollmmmmddd....",
      "..ollmmmmddd....",
      "..ollmmmmddd....",
      "..ollmmmmddd....",
      "..lllmmmmmddo...",
      ".ollmmmmmmddd...",
      "olllmmmmmmmddd..",
      "lllmmmmmmmmddd..",
    ],
  },

  // lasca de obsidiana cravada no chao
  spike: {
    foot: "base",
    pal: { o: PAL.inkDeep, d: PAL.stone0, m: PAL.stone1, D: PAL.steel0 },
    rows: [
      "..........o.",
      ".........oo.",
      "........ooo.",
      ".......odoo.",
      ".......mooo.",
      "......odooo.",
      "......doooo.",
      ".....oDoooo.",
      ".....odoooo.",
      ".....ddooo..",
      "....odoooo..",
      "....DDoooo..",
      "...odooooo..",
      "..omoooooo..",
      "..ooooooomm.",
      "..Dooooommd.",
      "..ooooommdd.",
      "..ooooommdd.",
      ".ooooommdddo",
      "oooommmddddd",
    ],
  },

  // braseiro de ferro; a chama e do motor, nao do sprite
  brazier: {
    foot: "base",
    pal: { o: PAL.inkDeep, D: PAL.steel0, M: PAL.steel1, L: PAL.steel2 },
    rows: [
      "....DoDoooo...",
      "..DDooooDoooo.",
      "oMLLLMMMMMMDDo",
      ".oDLDMMMMMDDD.",
      ".oMLLMMMMMDDo.",
      "...oLMMMDDD...",
      "....oLMoDo....",
      ".....oDDo.....",
      ".....oMDD.....",
      ".....oMMD.....",
      ".....LMMD.....",
      "....oLMMDo....",
      "...oLLMMDDo...",
      ".ooLLMMMMDDoo.",
    ],
  },

  // aglomerado de cristais de fel
  crystal: {
    foot: "base",
    pal: { o: PAL.inkDeep, d: PAL.stone0, m: PAL.stone1, e: PAL.fel0, E: PAL.fel1, F: PAL.fel2 },
    rows: [
      ".........o......",
      "........oEE.....",
      ".......oEEEo....",
      "......oeEEEE....",
      ".o....Feeeee....",
      "oFEE..eeeeeo....",
      "oEEEo.eeeeeo..o.",
      "oeeeeoeeeeeooEEo",
      ".eeemoeeemooeeEo",
      ".oeeemeeemoeeeo.",
      "..oeemoeemoeem..",
      "...eeemeeoeemo..",
      "..moeeodddeeod..",
      ".odddddmddddddd.",
    ],
  },

  // ossada: cranio e dois ossos cruzados, desenhada a mao
  bones: {
    foot: "mid",
    pal: { o: PAL.inkDeep, m: PAL.bone1, l: PAL.bone2 },
    rows: [
      "......................",
      "......................",
      "..oooooo....oo.....oo.",
      ".olllllllo.ollo...ollo",
      "olooloolo...loo..omlo.",
      "olooloolo...oomoomoo..",
      "olmmmmmmo.....ommo....",
      "olmmoommo....omoomo...",
      ".ommmmmo....ooo..omoo.",
      "..o.o.o....ollo...ollo",
      "............lo.....lo.",
      "............o......o..",
    ],
  },

  // fenda no basalto com fel correndo por dentro
  fissure: {
    foot: "mid",
    pal: { o: PAL.inkDeep, m: PAL.vio1, l: PAL.vio2, e: PAL.fel0, E: PAL.fel1 },
    rows: [
      "..................................",
      "..................................",
      ".............................o....",
      ".......................llmmmm.....",
      "....................lommmm........",
      ".............m.olmmmmmmllml.......",
      "........mmmmmmmmmmmllmml..........",
      ".........lmmmmmmllllEo............",
      ".........lmmmllleeo...............",
      ".......mmmmlllelEl................",
      "....lmmmlllool....................",
      "...mmo............................",
      "..................................",
      "..................................",
    ],
  },

  // sigilo gravado no chao
  sigil: {
    foot: "mid",
    pal: { o: PAL.inkDeep, d: PAL.vio0, m: PAL.vio1, e: PAL.arc0 },
    rows: [
      "................................",
      "............oeeooeeee...........",
      "........eee..........eeeo.......",
      "......ee...eeee..eedee...ee.....",
      "....oe..oeee.........eeeo..eo...",
      "...ee..ee..ee.......e...ee..eo..",
      "..oe..e.....oeeeeeee.....me.ee..",
      "..ee.oe.....e......ee.....eo.ee.",
      "..e..ee....ee.......ee....ee.ee.",
      "..oe.oe.....ee.....ee....eeo.em.",
      "...e..e......eeeeeee......e.oe..",
      "...oe..ee...e......ee...oe..e...",
      ".....ee..eee........oeee..om....",
      "......eee...eeeeeoode...ee......",
      ".........eeee.......ode.........",
      "................................",
    ],
  },

};
