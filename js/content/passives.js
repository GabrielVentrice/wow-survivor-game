"use strict";
/* =========================================================================
   PASSIVAS GLOBAIS — modificam CATEGORIAS inteiras, nunca pecas individuais.
   E o que impede a build de virar "sobe o numero da peca favorita": a passiva
   premia ter escolhido muitas pecas da mesma familia.

   Quatro canais, em ordem de preferencia:
     global     multiplicador de jogo inteiro (dotHaste, minionDuration...)
     pieceMods  mods numericos em toda peca que casar com `match`
     piecePatch patch estrutural em toda peca que casar com `match`
     dynamic    multiplicador que varia por segundo (parado/andando)
     on         hook nomeado ligado a um evento

   TODA PASSIVA TEM `axis`, e ele nao e etiqueta: e ele que decide se ela chega
   a ser oferecida. So aparecem as passivas do eixo escolhido na ABERTURA (ver
   `BuildSystem.getOffers`), entao a familia deixou de decidir so quais spells a
   run vai ter e passou a decidir tambem como ela multiplica o que tem.

   Duas regras caem daí, e `driver_cards` cobra as duas:

     - PAR EXCLUSIVO MORA NO MESMO EIXO. `furiaContida`/`pesDeCinza` (e, no
       hunter, `municaoLeve`/`municaoPesada`) so significam alguma coisa se as
       duas puderem cair na mesma mesa: a escolha E a exclusao. Separadas por
       eixo, o jogador nunca ve as duas na mesma run e o `exclusive` vira um
       campo que nao faz nada — uma mecanica morrendo em silencio, que e
       exatamente o modo de falha que este projeto passa o tempo cacando.
     - NENHUM EIXO FICA SEM. Com `passiveAt` 10 e uma run de dezenas de niveis,
       um eixo com zero passivas seria um terco das aberturas jogando um jogo
       sem passiva nenhuma.

   O preco declarado e a VARIEDADE: das 8 do warlock, uma run ve 2 ou 3. Em
   troca, a passiva parou de ser um multiplicador generico sorteado do bolo e
   virou parte da identidade que a abertura escolheu. */

Object.assign(PASSIVES, {

  chamaVerde: {
    id: "chamaVerde", cls: "warlock", axis: "corruption", name: "Chama Verde", color: "#7fdc4a",
    desc: "Todo DoT tica 20% mais rápido — vale para qualquer peça que aplique DoT.",
    global: { dotHaste: 1.2 },
  },

  coroaDeOssos: {
    id: "coroaDeOssos", cls: "warlock", axis: "dominion", name: "Coroa de Ossos", color: "#e8e0c8",
    desc: "Todo demônio invocado dura +50%.",
    global: { minionDuration: 1.5 },
  },

  // Mutuamente exclusiva com Pes de Cinza: a build tem que escolher entre ser
  // torre e ser corredor. Sem a exclusao, a resposta certa seria sempre "as duas".
  furiaContida: {
    id: "furiaContida", cls: "warlock", axis: "cataclysm", name: "Fúria Contida", color: "#ffd24a",
    desc: "+2% de dano por segundo parado. Zera assim que você anda.",
    exclusive: "pesDeCinza",
    dynamic: { on: "still", perSec: 0.02, cap: 1.2 },
  },

  pesDeCinza: {
    id: "pesDeCinza", cls: "warlock", axis: "cataclysm", name: "Pés de Cinza", color: "#9fe6ff",
    desc: "+2% de dano por segundo em movimento. Zera assim que você para.",
    exclusive: "furiaContida",
    dynamic: { on: "move", perSec: 0.02, cap: 1.2 },
  },

  vinculoDeAlma: {
    id: "vinculoDeAlma", cls: "warlock", axis: "dominion", name: "Vínculo de Alma", color: "#5acfff",
    desc: "Cada demônio vivo te dá +5% de escudo máximo, recarregado continuamente.",
    global: { shieldPerMinion: 0.05 },
  },

  ecoDoVazio: {
    id: "ecoDoVazio", cls: "warlock", axis: "cataclysm", name: "Eco do Vazio", color: "#a06bff",
    desc: "Golpes grandes se repetem a 40% de dano depois de 3 segundos.",
    on: { big_hit: "voidEcho" },
  },

  contagio: {
    id: "contagio", cls: "warlock", axis: "corruption", name: "Contágio", color: "#9adc4a",
    desc: "Todo DoT que expira salta para o inimigo mais próximo.",
    on: { dot_expired: "contagion" },
  },

  fome: {
    id: "fome", cls: "warlock", axis: "corruption", name: "Fome", color: "#ff6b6b",
    desc: "Cura 5% de todo dano em área que você causar.",
    global: { areaLifesteal: 0.05 },
  },

});
