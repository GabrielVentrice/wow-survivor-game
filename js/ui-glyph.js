"use strict";
/* =========================================================================
   GLIFO — o que substitui todo emoji da interface.

   O defeito que este arquivo existe para consertar: todo icone da UI era
   emoji do sistema operacional. Arte 3D arredondada em cima de pixel art em
   grade inteira, trazendo paleta propria — o que quebrava "cor = eixo" nos
   proprios icones, e mudava de desenho conforme o SO de quem abre o jogo.

   Duas fontes, nesta ordem:

   1. O GERADOR DO MUNDO. Se a peca invoca um demonio que ja existe em
      `SPRITE_DATA`, o icone e aquela grade, desenhada em osso monocromatico.
      E literalmente a arte do jogo, sem cor propria — a silhueta e que informa.
   2. Uma das DEZ PRIMITIVAS geometricas de traco 4. Nao ha grade em osso para
      as 30 e poucas spells que nao invocam nada, e inventar uma ilustracao por
      spell seria arte que envelhece na primeira mudanca de catalogo. A
      primitiva nao ilustra a spell: ela a DISTINGUE, que e o unico trabalho
      que um icone de 32px faz de verdade.

   Saida e SVG em linha, nao canvas. A UI e DOM, entao um `<svg>` entra em
   qualquer `innerHTML` que ja existe, herda `currentColor` e escala com o
   frame sem ficar borrado. Continua sendo arte gerada em runtime: zero
   arquivo de imagem, que e a regra do repo.
   ========================================================================= */

/* A paleta da UI, do handoff. Vive aqui e nao no CSS porque js/ui.js escreve
   cor inline por eixo — e duas listas divergem na primeira mudanca. */
const UI_PAL = {
  /* Indexado por id de EIXO, e a lista e a uniao de todas as classes — a mesma
     razao de `AXIS_PALETTE`. Um eixo sem entrada aqui cai no osso de
     `UI.eixoVars`, e a build inteira perderia a cor na UI sem erro nenhum. */
  eixo:    { corruption: "#8FE04C", dominion: "#A96BFF", cataclysm: "#FF8A2E",
             pack: "#E8C23F", precision: "#4A88F0", trapping: "#3BE08C" },
  brasa:   { corruption: "#C6FF7A", dominion: "#D2B0FF", cataclysm: "#FFC182",
             pack: "#FFE08A", precision: "#9CC4FF", trapping: "#8CFFC2" },
  cravado: { corruption: "#1E3310", dominion: "#251543", cataclysm: "#40200A",
             pack: "#382B08", precision: "#101F3F", trapping: "#0A3320" },
  osso:    "#EDE7DA",
  ossoDim: "#67626E",
  obs:     "#0A0910",
  vida:    "#C9302C",
  xp:      "#7FD8FF",
  xpNucleo:"#DFF6FF",
};

/* REGRA — reserva do warlock: osso puro (`UI_PAL.osso`) e exclusividade dele no
   canvas. Nenhum outro sprite, vfx, particula ou item usa osso cheio: com a
   build inteira acesa o jogador perdia de vista a unica coisa que controla, e
   ele passa a ser a unica coisa branca em tela. Nao e luz, e reserva —
   `driver_palette` reprova qualquer grid ou item que invada o hex.

/* As dez primitivas. Traco 4 numa caixa de 32 — a mesma espessura do pixel do
   sprite ampliado em 3x, que e o que faz as duas linguagens conviverem.

   Elas sao poucas de proposito. Vinte primitivas seriam vinte formas que
   ninguem distingue; dez cabem na memoria de quem joga, e o par
   cheio/vazado de cada familia ja carrega "e isso" contra "e a versao
   contida disso". */
const PRIMITIVAS = {
  quadrado:     `<rect x="6" y="6" width="20" height="20"/>`,
  placa:        `<path d="M13 6H26V19L19 26H6V13Z"/>`,
  circulo:      `<circle cx="16" cy="16" r="10"/>`,
  anel:         `<circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" stroke-width="4"/>`,
  losango:      `<path d="M16 3L29 16L16 29L3 16Z"/>`,
  losangoVazado:`<path d="M16 6L26 16L16 26L6 16Z" fill="none" stroke="currentColor" stroke-width="4"/>`,
  barra:        `<rect x="14" y="3" width="4" height="26"/>`,
  duasBarras:   `<rect x="8" y="3" width="4" height="26"/><rect x="20" y="3" width="4" height="26"/>`,
  barraH:       `<rect x="3" y="14" width="26" height="4"/>`,
  duasBarrasH:  `<rect x="3" y="9" width="26" height="4"/><rect x="3" y="19" width="17" height="4"/>`,
};
const PRIMITIVA_ORDEM = Object.keys(PRIMITIVAS);

/* Peca que invoca demonio usa a grade DELE. E o unico caso em que o icone
   pode ser a coisa em vez de um simbolo dela. */
const GLIFO_SPRITE = {
  wildImps: "wildImp",
  dreadstalkers: "dreadstalker",
  felguard: "felguard",
  voidwalker: "voidwalker",
  infernal: "infernal",
  netherPortal: "portal",
  demonicTyrant: "tyrant",
  implosion: "wildImp",
  grimoireOfSacrifice: "felguard",
  // o warlock em pessoa, para a placa de classe do menu
  warlock: "warlock",
  // hunter: a peca que invoca a matilha usa a grade do proprio lobo — e o
  // unico caso em que o icone pode ser a coisa em vez de um simbolo dela.
  wildThrash: "wolf",
  hunter: "wolf",
};

/* A primitiva de cada peca. Nao ilustra — distingue. O criterio e a FORMA da
   mecanica: cheio para o que detona, anel para o que pulsa em volta, barra
   para o que sai em linha, barras horizontais para o que empilha. */
const PRIMITIVA_DE = {
  // corrupcao — o que apodrece
  corruption: "anel",
  agony: "duasBarrasH",
  unstableAffliction: "losango",
  soulRupture: "quadrado",
  seedOfCorruption: "circulo",
  haunt: "losangoVazado",
  maleficRapture: "barra",
  vileTaint: "placa",
  soulRot: "duasBarras",
  doom: "losangoVazado",
  // cataclismo — o que detona
  incinerate: "barra",
  immolate: "circulo",
  conflagrate: "losango",
  rainOfFire: "duasBarrasH",
  shadowburn: "losangoVazado",
  burningTrail: "barraH",
  chaosBolt: "duasBarras",
  wither: "anel",
  cataclysm: "quadrado",
  // controle e defesa — o que segura
  burningRush: "barraH",
  demonicCircle: "anel",
  shadowfury: "losango",
  curseOfExhaustion: "duasBarrasH",
  curseOfTongues: "duasBarras",
  howlOfTerror: "circulo",
  mortalCoil: "losangoVazado",
  banish: "placa",
  enslaveDemon: "quadrado",
  drainLife: "barra",
  soulLeech: "losangoVazado",
  unendingResolve: "placa",
  demonSkin: "quadrado",
  healthstone: "losango",
  netherWard: "anel",
  soulstone: "circulo",
  // passivas
  chamaVerde: "losango",
  coroaDeOssos: "anel",
  furiaContida: "barra",
  pesDeCinza: "barraH",
  vinculoDeAlma: "losangoVazado",
  ecoDoVazio: "circulo",
  contagio: "duasBarrasH",
  fome: "duasBarras",
  // capstones — todos cheios: capstone e o fim de uma rota, nao um degrau
  colheita: "circulo",
  tirania: "quadrado",
  nihilam: "losango",
  ceifador: "placa",
  chamador: "losango",
  diabolista: "quadrado",
  voraz: "circulo",
  enxame: "placa",
};

const Glyph = {
  /* Cache por (id, tamanho): a tira de pecas do HUD redesenha a cada compra e
     a tela de pausa desenha vinte glifos de uma vez. Montar a mesma string de
     SVG dezenas de vezes por tela e trabalho que nao muda de resultado. */
  _cache: new Map(),

  /* O icone de uma peca, passiva, capstone ou forma, em osso monocromatico.
     `size` e o lado da caixa desenhada, em px. */
  svg(id, size) {
    const s = size || 32;
    const chave = id + "@" + s;
    let out = this._cache.get(chave);
    if (out !== undefined) return out;
    /* Ordem: a grade PROPRIA da peca, depois a grade do demonio que ela
       invoca, e so entao a primitiva. A primitiva e fallback — quando ela
       virou o acervo inteiro, nove pecas na tira do HUD deram quatro marcas
       distintas e duas pecas diferentes caiam na mesma forma. */
    const spr = GLIFO_SPRITE[id];
    out = typeof UI_ICONS !== "undefined" && UI_ICONS[id]
      ? this._sprite({ rows: UI_ICONS[id] }, s)
      : spr && typeof SPRITE_DATA !== "undefined" && SPRITE_DATA[spr]
        ? this._sprite(SPRITE_DATA[spr], s)
        : this._prim(this.primitivaDe(id), s);
    this._cache.set(chave, out);
    return out;
  },

  /* Qual primitiva. Id desconhecido nao pode cair num quadrado generico junto
     com outros cinco desconhecidos: o hash espalha, entao peca nova nasce
     distinguivel antes de alguem escolher a forma dela a mao. */
  primitivaDe(id) {
    const p = PRIMITIVA_DE[id];
    if (p) return p;
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return PRIMITIVA_ORDEM[Math.abs(h) % PRIMITIVA_ORDEM.length];
  },

  /* Quem ainda nao tem desenho proprio. O contact sheet (`icons.html`) usa
     isto para listar o que falta: primitiva sem dono e divida, nao acervo. */
  temDesenho(id) {
    if (typeof UI_ICONS !== "undefined" && UI_ICONS[id]) return "grade";
    const spr = GLIFO_SPRITE[id];
    if (spr && typeof SPRITE_DATA !== "undefined" && SPRITE_DATA[spr]) return "sprite";
    return null;
  },

  _prim(nome, s) {
    return `<svg class="gl" viewBox="0 0 32 32" width="${s}" height="${s}" ` +
      `aria-hidden="true" fill="currentColor" shape-rendering="geometricPrecision">` +
      (PRIMITIVAS[nome] || PRIMITIVAS.quadrado) + `</svg>`;
  },

  /* A grade do mundo, chapada em osso. Corridas horizontais de celulas cheias
     viram um `<rect>` so — uma grade de 22x19 tem ~250 celulas acesas e um
     rect por celula poria 250 nos no DOM por icone. */
  _sprite(spr, s) {
    const rows = spr.rows, h = rows.length, w = rows[0].length;
    let body = "";
    for (let y = 0; y < h; y++) {
      const r = rows[y];
      let x = 0;
      while (x < w) {
        if (r[x] === "." || r[x] === undefined) { x++; continue; }
        let n = 1;
        while (x + n < w && r[x + n] !== "." && r[x + n] !== undefined) n++;
        body += `<rect x="${x}" y="${y}" width="${n}" height="1"/>`;
        x += n;
      }
    }
    return `<svg class="gl" viewBox="0 0 ${w} ${h}" width="${s}" height="${s}" ` +
      `preserveAspectRatio="xMidYMid meet" aria-hidden="true" ` +
      `fill="currentColor" shape-rendering="crispEdges">${body}</svg>`;
  },

  /* A moldura completa do handoff: caixa de `size` em obsidiana cravada com o
     glifo dentro. `cls` acrescenta modificador (`.gl-box--tier`, etc). */
  box(id, size, cls) {
    const icone = Math.round(size * 0.62);
    return `<span class="gl-box ch1 ${cls || ""}" style="width:${size}px;height:${size}px">` +
      this.svg(id, icone) + `</span>`;
  },
};
