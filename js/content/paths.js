"use strict";
/* =========================================================================
   AS TRES LINHAS — Aceleracao, Maestria e Critico.

   Toda peca do catalogo sobe pelos mesmos tres caminhos, e a pergunta de cada
   um e sempre a mesma: com que FREQUENCIA a peca acontece, QUANTO ela pesa
   quando acontece, e com que sorte ela pesa o dobro.

   Antes cada peca inventava os proprios tres caminhos ("Chama", "Barragem",
   "Enraizado"), e a tela de level up cobrava do jogador ler quinze nomes
   novos por peca para saber o que estava comprando. Uma grade igual em todas
   as 44 troca isso por uma leitura so: o jogador aprende as tres linhas uma
   vez e passa a decidir por PECA, nao por vocabulario.

   O preco e conhecido e esta pago no tier 5: os quatro primeiros degraus de
   cada linha sao numericos e gerados aqui, e o quinto continua escrito a mao,
   peca por peca — e ele que carrega a assinatura, a evolucao e o salto
   estrutural. Sem esse topo a grade viraria uma planilha, e a evolucao (que e
   o climax da run) nao teria onde morar.

   Cada peca declara so QUAL stat ela chama de recarga, de quantidade e de
   dano. Nenhum texto de tier e escrito duas vezes.
   ========================================================================= */

/* Os degraus. Uma tabela so, e ela e o balanceamento das tres linhas — mexer
   aqui mexe no catalogo inteiro de uma vez, que e exatamente o motivo de a
   grade existir.

   Fechadas, as tres linhas chegam perto uma da outra de proposito:
     Aceleracao  1/0.4875 = 2.05x de cadencia, e a quantidade quadruplicando
     Maestria    1.5 * 1.4 * 1.45 * 1.5 = 4.57x no numero principal
     Critico     80% de chance a 4.5x = 3.80x de dano medio
   Nenhuma domina; o que decide e a peca.

   E elas sao FRONT-LOADED: o degrau mais caro da linha e o PRIMEIRO. A versao
   anterior abria em +30% / -20% / +15% de critico e a medicao a reprovou de
   forma brutal — sobrevivencia mediana de 9:59 para 2:05, mortes antes dos 3
   min de 4/20 para 12/20, pool de eixo de 20/20 para 2/20. O motivo nao e o
   total, que estava perto do dos caminhos antigos: e que o marco e pago em
   ABATES, entao menos dano cedo vira menos marco, que vira tier travado pelo
   gate de eixo, que vira menos dano. E a mesma realimentacao da curva de XP,
   e ela e implacavel — os caminhos antigos abriam em "+50% de dano" e era isso
   que a mantinha do lado bom. */
const LINE_STEPS = {
  // sem stat de quantidade, a linha inteira e recarga: quatro degraus
  rateOnly: [0.75, 0.75, 0.7, 0.7],
  // com quantidade, a recarga leva dois degraus e cede os outros dois
  rate: [0.75, 0.65],
  dmg: [1.5, 1.4, 1.45, 1.5],
};

/* Os degraus do Critico sao um par (chance, multiplicador) e nao um numero,
   entao eles tem tabela propria. O primeiro degrau leva os dois de proposito:
   chance sozinha sobre um multiplicador de 2x e o degrau mais fraco que a
   grade sabe oferecer, e ele estava sendo o primeiro que o jogador via. */
const CRIT_STEPS = [
  { crit: 0.25, mul: 0.5 },
  { crit: 0.25 },
  { mul: 1 },
  { crit: 0.25, mul: 1 },
];

const LINE_NAMES = { haste: "Aceleração", mastery: "Maestria", crit: "Crítico" };

// Nomes dos degraus. Sao SUBTITULO na carta (o slot do nome carrega a spell),
// entao eles marcam a posicao na linha em vez de inventar identidade.
const LINE_TIERS = {
  rateOnly: ["Cadência", "Compasso", "Ritmo", "Frenesi"],
  rate: ["Cadência", "Ritmo"],
  qty: ["Duplo", "Salva"],
  dmg: ["Gume", "Peso", "Fúria", "Devastação"],
  crit: ["Sorte", "Gume Fino", "Instinto", "Golpe Certeiro"],
};

const pctDown = (m) => Math.round((1 - m) * 100);
const pctUp = (m) => Math.round((m - 1) * 100);

/* --- Aceleracao ----------------------------------------------------------
   spec.rate  { stat, verb }        — a recarga da peca e o verbo dela
   spec.qty   { stat, noun, steps } — quantos projeteis/alvos/demonios
   spec.evolvesInto                 — quando a assinatura desta linha evolui

   `qty` e opcional porque nem toda peca tem o que multiplicar: uma aura
   pulsa e pronto. Sem ele a linha vira quatro degraus de recarga, e nao dois
   degraus e dois buracos. */
function HASTE(spec, top) {
  const tiers = [];
  const verb = (spec.rate && spec.rate.verb) || "Dispara";
  if (spec.qty) {
    const rs = LINE_STEPS.rate;
    for (let i = 0; i < 2; i++) {
      tiers.push(T(LINE_TIERS.rate[i], `${verb} ${pctDown(rs[i])}% mais rápido.`,
                   { [spec.rate.stat]: { mul: rs[i] } }));
      const n = spec.qty.steps[i];
      tiers.push(T(LINE_TIERS.qty[i], `${n} ${spec.qty.noun}.`,
                   { [spec.qty.stat]: { set: n } }));
    }
  } else {
    const rs = LINE_STEPS.rateOnly;
    for (let i = 0; i < 4; i++) {
      tiers.push(T(LINE_TIERS.rateOnly[i], `${verb} ${pctDown(rs[i])}% mais rápido.`,
                   { [spec.rate.stat]: { mul: rs[i] } }));
    }
  }
  tiers.push(top);
  return { name: LINE_NAMES.haste, evolvesInto: spec.evolvesInto, tiers };
}

/* --- Maestria ------------------------------------------------------------
   spec.dmg   stat ou lista de stats que sobem juntos
   spec.noun  como esta peca chama o proprio numero principal
   spec.add   quatro somas, quando o stat NAO pode ser multiplicado
   spec.pct   `add` lido como porcentagem

   `noun` existe porque dez pecas do catalogo nao causam dano nenhum: nelas o
   numero principal e o escudo, a cura ou a duracao do controle, e a linha faz
   o mesmo trabalho com a palavra certa.

   `add` existe porque tres stats do catalogo sao FATORES e nao grandezas:
   `speedMul` (1.35 = anda 35% mais rapido) e o `factor` das duas maldicoes
   (0.65 = o alvo anda a 65%). Multiplicar o primeiro por 3.69 daria um
   personagem a cinco vezes a velocidade base, e multiplicar os outros dois
   AUMENTARIA o numero, que e o contrario do que a peca faz. */
function MASTERY(spec, top) {
  const stats = Array.isArray(spec.dmg) ? spec.dmg : [spec.dmg];
  const noun = spec.noun || "dano";
  const steps = spec.add || LINE_STEPS.dmg;
  const tiers = steps.map((v, i) => {
    const mods = {};
    for (const st of stats) mods[st] = spec.add ? { add: v } : { mul: v };
    const txt = spec.add
      ? `${v > 0 ? "+" : ""}${spec.pct ? Math.round(v * 100) + "%" : v}`
      : `+${pctUp(v)}%`;
    return T(LINE_TIERS.dmg[i], `${txt} de ${noun}.`, mods);
  });
  tiers.push(top);
  return { name: LINE_NAMES.mastery, evolvesInto: spec.evolvesInto, tiers };
}

/* --- Critico -------------------------------------------------------------
   Nao pede stat nenhum: `crit` e `critMul` tem o mesmo nome em toda peca, e
   quem sorteia e o funil de dano (Game.damageEnemy) para o que bate e
   `critRoll` (js/systems/effects.js) para o que cura, escuda ou controla.

   Os dois degraus de chance vem antes dos de multiplicador de proposito: com
   5% de base, dobrar o multiplicador primeiro seria comprar um evento que
   quase nunca acontece. */
function CRIT(spec, top) {
  const noun = (spec && spec.noun) || "dano";
  const tiers = CRIT_STEPS.map((st, i) => {
    const mods = {};
    if (st.crit) mods.crit = { add: st.crit };
    if (st.mul) mods.critMul = { add: st.mul };
    const chance = st.crit ? `+${Math.round(st.crit * 100)}% de crítico` : "";
    const peso = st.mul ? `+${st.mul}x no ${noun} crítico` : "";
    const desc = chance && peso ? `${chance} e ${peso}.`
      : chance ? `${chance.replace("de crítico", "de chance de crítico")}.` : `${peso}.`;
    return T(LINE_TIERS.crit[i], desc, mods);
  });
  tiers.push(top);
  return { name: LINE_NAMES.crit, evolvesInto: (spec && spec.evolvesInto), tiers };
}

/* O par que toda peca espalha em `stats` (`...CRIT_BASE`). A base de 5%
   existe para o critico ser um fato do jogo antes de ser uma compra: sem ela
   a mecanica so aparece depois que alguem investe, e ninguem investe no que
   nunca viu. Peca que queira outro valor declara DEPOIS do espalhamento. */
const CRIT_BASE = { crit: 0.05, critMul: 2 };
