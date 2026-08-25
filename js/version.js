"use strict";
/* =============================================================================
   THE VERSION AND WHAT WENT INTO IT — one list only.

   The version number already lived in TWO places: hardcoded in `.menu-versao`
   inside `index.html`, and hardcoded again in `LB_CFG.versao`, with a comment
   asking the two to move together. A comment is not a mechanism: two lists
   diverge on the first change, and whichever one aged would stamp every run
   sent to the leaderboard with a version the game no longer has.

   This is the source, and it is one. `VERSION` is NOT typed: it IS the version
   of the newest changelog entry, so bumping the version without saying what
   changed stopped being possible — the smallest change the game accepts is an
   entry with at least one note.

   Why the data lives in JS instead of a CHANGELOG.md: the game opens over
   `file://`, where `fetch` is blocked (opaque origin). A markdown file next to
   it would have to be read at runtime — or copied here by hand, which is the
   second list all over again.

   ENTRY FORMAT:

     v      SemVer, without the "v". This game's ruler is in CLAUDE.md:
            major = the run changes shape; minor = new content or system;
            patch = fixes and number tuning.
     data   ISO (YYYY-MM-DD). The day it SHIPPED to master.
     titulo What the version did, in three to five words. It is what the
            version rail shows before any note is read.
     notas  { t, txt }. `t` is one of the CHANGELOG_TIPOS keys.

   WHAT A NOTE SAYS: what changed for WHOEVER PLAYS, in the game's voice — not
   the subject of the commit. "The three cards are now compared on the same
   ruler, in damage per second" is a note; "refactor offerGain" is not.
   Implementation detail and mechanism live in CLAUDE.md, which is where
   somebody looks for them.

   The newest entry goes ON TOP. `driver_version` checks the order, the dates,
   the types, and that nobody hardcodes the number in a second place.
   ============================================================================= */

/* Three types, and they are few on purpose: with seven labels nobody picks the
   same one twice, and the tag stops meaning anything. */
const CHANGELOG_TIPOS = {
  novo:     "Novo",
  ajuste:   "Ajuste",
  conserto: "Conserto",
};

const CHANGELOG = [
  {
    v: "0.15.0",
    data: "2026-08-25",
    titulo: "A run abre escolhendo a família",
    notas: [
      { t: "ajuste", txt: "A abertura pergunta a FAMÍLIA, não a spell. Você escolhe Corrupção, Domínio ou Cataclismo — e a spell daquela família vem junto, de graça, como vinha antes." },
      { t: "novo", txt: "A família escolhida entra com 1 ponto de eixo. Ela é a primeira das duas que cabem na run, então a abertura passou a dizer para onde a run vai, e não só com o que ela começa." },
      { t: "novo", txt: "E ela nunca mais some da mesa: toda etapa passa a ter uma spell daquela família garantida, mesmo antes dos 5 pontos que abrem o slot fixo. O resto da mesa continua sorteado." },
      { t: "ajuste", txt: "As etapas continuam entregando os mesmos 20 pontos — o ponto da abertura é um a mais, não um adiantamento." },
    ],
  },
  {
    v: "0.14.0",
    data: "2026-08-25",
    titulo: "Cinco spells, uma linha cada",
    notas: [
      { t: "novo", txt: "A build cabe em cinco spells. Depois da quinta, a etapa para de oferecer spell nova e passa a ser só sobre onde investir o eixo." },
      { t: "novo", txt: "Cada spell termina numa linha só. O primeiro degrau das três continua aberto para você provar todas; a compra seguinte fecha as outras duas — e a carta passa a dizer em qual final a spell termina." },
      { t: "novo", txt: "Fechar uma linha até o fim devolve a escolha: a spell pode abrir a próxima. É assim que uma peça ainda evolui duas vezes." },
      { t: "ajuste", txt: "Travar uma linha custa um ponto de eixo, então a decisão mais pesada do level up só chega depois da primeira etapa." },
      { t: "ajuste", txt: "Nível que tem uma única coisa a oferecer não abre mais tela: ele aplica e avisa no canto. Tela para escolher entre uma opção só não era escolha." },
    ],
  },
  {
    v: "0.13.0",
    data: "2026-08-25",
    titulo: "A carta diz o fato, não a previsão",
    notas: [
      { t: "ajuste", txt: "A tela de level up parou de prever dano: saíram o \"+106 dano/s\", a barra e o selo de maior ganho. O que a carta mostra agora é só o que a compra muda de verdade — \"dano 175 → 263\"." },
      { t: "ajuste", txt: "Quando a compra muda duas coisas, cada uma vai numa linha própria em vez de dividirem a mesma linha com um ponto no meio." },
    ],
  },
  {
    v: "0.12.1",
    data: "2026-08-25",
    titulo: "As cartas dizem menos",
    notas: [
      { t: "ajuste", txt: "As cartas de melhoria pararam de explicar a linha por extenso: o que a compra muda agora é o próprio upgrade, \"dano 175 → 263\", logo abaixo da barra." },
      { t: "ajuste", txt: "Saíram da carta o \"faltam N para fechar\" e o \"tier 0 → 1\": os pips do rodapé já desenham os dois." },
    ],
  },
  {
    v: "0.12.0",
    data: "2026-08-25",
    titulo: "O tiro do Hunter vira tiro",
    notas: [
      { t: "ajuste", txt: "Os tiros do Hunter não dão mais a volta atrás do alvo: eles saem retos, muito mais rápidos, e miram onde o inimigo VAI estar em vez de onde ele está." },
      { t: "novo", txt: "Ricochete: quando a flecha acerta, sai outra dali para o próximo corpo — e ela nunca volta para quem já foi atingido. É o que a Rajada Arcana passou a comprar no lugar da perfuração." },
      { t: "ajuste", txt: "A flecha se desenha como uma risca dura em vez de um orbe com cauda brilhante. O comprimento da risca sai da velocidade: tiro mais rápido risca mais." },
    ],
  },
  {
    v: "0.11.0",
    data: "2026-08-24",
    titulo: "O Hunter entra em campo",
    notas: [
      { t: "novo", txt: "Segunda classe jogável: o Hunter, com três eixos próprios — Matilha, Precisão e Armadilha — e um catálogo de 51 spells que não se cruza com o do Warlock." },
      { t: "novo", txt: "Os Aspectos: posturas que ligam e desligam sozinhas conforme onde você se meteu. Na borda da horda você corre mais; cercado de perto, tudo alcança mais longe; parado, seus tiros batem mais forte. Cabem três por run." },
      { t: "novo", txt: "Armadilha fica inerte no chão até alguém pisar, e ela é visível: o aro tracejado mostra o raio exato em que ela pega." },
      { t: "novo", txt: "A matilha cerca por lados diferentes em vez de empilhar na mesma linha, e nasce em leva — cinco bichos entrando um por vez nunca estariam em campo juntos." },
      { t: "novo", txt: "Arcane Shot evolui duas vezes: vira Aimed Shot e depois Kill Shot. É a primeira spell do jogo com duas conversões na mesma linhagem, e ela pede os dois caminhos profundos que a run permite." },
    ],
  },
  {
    v: "0.10.1",
    data: "2026-08-24",
    titulo: "O nome aceita todas as letras",
    notas: [
      { t: "conserto", txt: "O campo de nome não aceitava as letras A, S, D e W — são as teclas de movimento, e o jogo as engolia antes de chegarem ao campo. Digitar M ou N ali também desligava o som." },
    ],
  },
  {
    v: "0.10.0",
    data: "2026-08-24",
    titulo: "A run abre numa escolha",
    notas: [
      { t: "novo", txt: "A run começa numa escolha: três spells básicas, uma por eixo, e o primeiro quadro do jogo só roda depois dela. Ela não cobra ponto de eixo." },
      { t: "novo", txt: "O Pacto: assim que dois eixos têm ponto, o terceiro se sela e some das ofertas. Nenhum capstone pede três eixos, e espalhar pelos três era a única forma de terminar a run sem clímax nenhum." },
      { t: "novo", txt: "A versão no canto do menu virou botão: clicar nela abre o que entrou em cada versão, da mais nova para a mais velha." },
      { t: "ajuste", txt: "O nome é pedido antes de começar: é ele que assina a sua linha no placar dos amigos." },
      { t: "ajuste", txt: "O número da versão passou a sair de um lugar só — o mesmo que o placar carimba em cada run enviada." },
    ],
  },
  {
    v: "0.9.0",
    data: "2026-08-24",
    titulo: "O placar dos amigos",
    notas: [
      { t: "novo", txt: "Placar dos amigos na página inicial: o seu recorde sai da run e volta na tabela, com o tempo, os abates e o glifo da peça que mais deu dano." },
      { t: "novo", txt: "A tela de level up ganhou uma régua comum: as três cartas mostram o ganho em dano por segundo na mesma escala, e a mais longa ganha mais." },
      { t: "novo", txt: "Toda spell sobe pelos mesmos três caminhos — Aceleração, Maestria e Crítico —, e a identidade da peça troca no quinto degrau." },
      { t: "novo", txt: "Encher um eixo até 15 dispara o Ápice: uma onda serrilhada sai do warlock e varre o que estiver em tela. O chefe sobrevive." },
      { t: "novo", txt: "A cadeia: abates no mesmo pulso viram um número na borda esquerda, com o pavio contando o tempo que falta para a conta zerar." },
      { t: "ajuste", txt: "A etapa passou a ser paga em abates, não em segundos: quem varre a horda chega mais cedo à decisão que não volta." },
      { t: "conserto", txt: "O estouro do Gan'arg Sapador respondia por 96% de todo o dano tomado numa run. Agora ele cobra dentro de um raio menor e com queda na borda." },
    ],
  },
];

/* The game's version IS the newest entry. Never type this number anywhere
   else: `LB_CFG.versao` and the menu footer read it from here. */
const VERSION = CHANGELOG[0].v;
