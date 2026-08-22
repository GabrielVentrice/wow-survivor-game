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
   ========================================================================= */

Object.assign(PASSIVES, {

  chamaVerde: {
    id: "chamaVerde", name: "Chama Verde", icon: "🟩", color: "#7fdc4a",
    desc: "Todo DoT tica 20% mais rápido — vale para qualquer peça que aplique DoT.",
    global: { dotHaste: 1.2 },
  },

  coroaDeOssos: {
    id: "coroaDeOssos", name: "Coroa de Ossos", icon: "🦴", color: "#e8e0c8",
    desc: "Todo demônio invocado dura +50%.",
    global: { minionDuration: 1.5 },
  },

  // Mutuamente exclusiva com Pes de Cinza: a build tem que escolher entre ser
  // torre e ser corredor. Sem a exclusao, a resposta certa seria sempre "as duas".
  furiaContida: {
    id: "furiaContida", name: "Fúria Contida", icon: "🗿", color: "#ffd24a",
    desc: "+2% de dano por segundo parado. Zera assim que você anda.",
    exclusive: "pesDeCinza",
    dynamic: { on: "still", perSec: 0.02, cap: 1.2 },
  },

  pesDeCinza: {
    id: "pesDeCinza", name: "Pés de Cinza", icon: "💨", color: "#9fe6ff",
    desc: "+2% de dano por segundo em movimento. Zera assim que você para.",
    exclusive: "furiaContida",
    dynamic: { on: "move", perSec: 0.02, cap: 1.2 },
  },

  vinculoDeAlma: {
    id: "vinculoDeAlma", name: "Vínculo de Alma", icon: "🔗", color: "#5acfff",
    desc: "Cada demônio vivo te dá +5% de escudo máximo, recarregado continuamente.",
    global: { shieldPerMinion: 0.05 },
  },

  ecoDoVazio: {
    id: "ecoDoVazio", name: "Eco do Vazio", icon: "🕳", color: "#a06bff",
    desc: "Golpes grandes se repetem a 40% de dano depois de 3 segundos.",
    on: { big_hit: "voidEcho" },
  },

  contagio: {
    id: "contagio", name: "Contágio", icon: "🦠", color: "#9adc4a",
    desc: "Todo DoT que expira salta para o inimigo mais próximo.",
    on: { dot_expired: "contagion" },
  },

  fome: {
    id: "fome", name: "Fome", icon: "🍖", color: "#ff6b6b",
    desc: "Cura 5% de todo dano em área que você causar.",
    global: { areaLifesteal: 0.05 },
  },

});
