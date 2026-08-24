"use strict";

/* =============================================================================
   O PLACAR DOS AMIGOS — a run sai daqui e volta na pagina inicial.

   Duas metades que NAO se conhecem:

   1. A camada local (`localStorage`): o nome e o recorde pessoal. Ela funciona
      offline, sem form, sem planilha, e e a unica que o game over precisa.
   2. A camada remota (Google Form -> planilha): escrita cega no form, leitura
      pela planilha. Ela pode falhar inteira sem levar a primeira junto.

   A escolha de backend cobra uma consequencia que decide o formato deste
   arquivo: NAO HA SERVIDOR, entao nao ha validacao na escrita. Qualquer um
   posta o que quiser. A validacao vira FILTRO DE LEITURA (`valid`), e a
   planilha guarda tudo enquanto o placar so desenha o plausivel.

   Nada aqui roda no carregamento. `localStorage` e `fetch` nao existem no
   sandbox do harness, entao todo acesso e tardio e protegido — os 24 drivers
   carregam este arquivo junto com o resto do jogo.
   ============================================================================= */

/* Gerado por `tools/setup-leaderboard.gs`. Os `entry.<id>` nao sao derivaveis
   dos titulos dos campos, e `form` e o id PUBLICADO (o que vem depois de
   `/d/e/`), que nao e o id do arquivo — usar o errado da 404 silencioso. */
const LB = {
  form:  "1FAIpQLSdm0hoLyaQ0izGMhZqnRAo2PPCNYk9wuwZheP1OWxEdXy7pCQ",
  sheet: "1VO7rGNQFD60TG1fL3BvB39xuvHxUBS1rWLIcAHJLvYA",
  entry: {
    nome:       "entry.1990181677",
    tempo_ms:   "entry.868692054",
    abates:     "entry.1419328173",
    nivel:      "entry.1866208429",
    dano:       "entry.695426644",
    cadeia:     "entry.1423275109",
    assinatura: "entry.79143210",
    eixos:      "entry.1692111214",
    versao:     "entry.897333282",
  },
};

/* A ORDEM e a das colunas da aba `placar`, que e a ordem dos campos no form.
   Mudar aqui sem mudar o form desalinha a leitura inteira. */
const LB_FIELDS = ["nome", "tempo_ms", "abates", "nivel", "dano", "cadeia",
                   "assinatura", "eixos", "versao"];

const LB_CFG = {
  key:      "pacto.placar",  // localStorage
  versao:   "0.9",           // acompanha `.menu-versao` no index.html
  linhas:   8,               // quantas cabem na pagina inicial
  nomeMax:  16,              // um nome que nao empurra a coluna do tempo
  timeout:  4000,            // ms ate desistir da leitura e seguir a vida
  // Sanidade bruta, nao julgamento de habilidade: nenhuma run passa de 1h.
  maxMs:    60 * 60 * 1000,
};

const Leaderboard = {

  /* --- 1. a camada local ---------------------------------------------------
     Ela nunca lanca. Um `localStorage` bloqueado (modo privativo, cookies
     desligados) devolve o estado vazio e o jogo segue sem placar, em vez de
     morrer na tela de game over. */

  _local: null,

  local() {
    if (this._local) return this._local;
    let d = null;
    try {
      const raw = typeof localStorage !== "undefined" && localStorage.getItem(LB_CFG.key);
      if (raw) d = JSON.parse(raw);
    } catch (e) { d = null; }
    if (!d || typeof d !== "object") d = {};
    this._local = { nome: typeof d.nome === "string" ? d.nome : "", best: d.best || null };
    return this._local;
  },

  _save() {
    try {
      if (typeof localStorage !== "undefined")
        localStorage.setItem(LB_CFG.key, JSON.stringify(this._local));
    } catch (e) { /* cota cheia ou storage bloqueado: o jogo nao para por isso */ }
  },

  /* O nome vai para uma planilha legivel na web, entao ele e podado aqui e
     ESCAPADO no desenho (`UI.esc`). Controle e quebra de linha sairiam do form
     como colunas tortas. */
  limpaNome(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, LB_CFG.nomeMax);
  },

  nome() { return this.local().nome; },

  setNome(n) {
    this.local().nome = this.limpaNome(n);
    this._save();
    return this._local.nome;
  },

  best() { return this.local().best; },

  /* Devolve true so quando a run BATE o recorde — e o que acende o selo no game
     over. Empate nao e recorde. */
  remember(run) {
    const L = this.local();
    const novo = !L.best || run.tempo_ms > L.best.tempo_ms;
    if (novo) { L.best = run; this._save(); }
    return novo;
  },

  /* --- 2. o payload --------------------------------------------------------
     Todo campo numerico viaja como INTEIRO. O Forms grava tudo como texto e o
     Sheets adivinha o tipo celula a celula: com locale de virgula decimal um
     `724.5` pode cair como texto, e coluna de texto ordena "9" acima de "12" —
     a metrica ranquearia ao contrario. */

  runFrom(game, dano, assinatura) {
    const g = game, b = g.build, p = g.player;
    /* Os eixos DA RUN, na ordem da classe — e nao `AXES`, que virou a uniao de
       todas elas. Contra a uniao a coluna sairia com seis numeros, tres deles
       sempre zero, e a planilha passaria a guardar o formato de uma run que
       nao existe. */
    const eixos = [];
    for (const id of b.axes) eixos.push(b.axis[id] | 0);
    return {
      nome:       this.nome(),
      tempo_ms:   Math.round(g.elapsed * 1000),
      abates:     p.kills | 0,
      nivel:      p.level | 0,
      dano:       Math.round(dano || 0),
      cadeia:     g.comboBest | 0,
      assinatura: assinatura || "",
      eixos:      eixos.join("/"),
      versao:     LB_CFG.versao,
    };
  },

  /* --- 3. a escrita --------------------------------------------------------
     `no-cors` devolve uma resposta OPACA: nao ha status, nao ha corpo, nao ha
     como saber se entrou. Por isso nao existe retry aqui — sem resposta, um
     retry nao distingue falha de sucesso, ele so duplica a linha. E por isso a
     UI nunca diz "enviado": ela manda conferir no placar. */

  submit(run) {
    if (typeof fetch !== "function" || typeof FormData !== "function") return false;
    try {
      const body = new FormData();
      for (const campo of LB_FIELDS) body.append(LB.entry[campo], String(run[campo]));
      fetch("https://docs.google.com/forms/d/e/" + LB.form + "/formResponse",
            { method: "POST", mode: "no-cors", body }).catch(() => {});
      return true;
    } catch (e) { return false; }
  },

  /* --- 4. a leitura --------------------------------------------------------
     A aba `placar` ja vem ordenada e cortada pelo QUERY da planilha, entao o
     jogo so precisa desembrulhar, validar e desenhar. */

  url() {
    return "https://docs.google.com/spreadsheets/d/" + LB.sheet +
           "/gviz/tq?tqx=out:json&sheet=placar&_=" + Date.now();
  },

  /* A resposta NAO e JSON puro: ela vem embrulhada num comentario seguido de
     `google.visualization.Query.setResponse( ... );` — dai recortar entre a
     primeira chave e a ultima em vez de dar `JSON.parse` no corpo inteiro. */
  parse(text) {
    const i = text.indexOf("{"), j = text.lastIndexOf("}");
    if (i < 0 || j < i) throw new Error("resposta fora do formato gviz");
    const data = JSON.parse(text.slice(i, j + 1));
    const linhas = (data.table && data.table.rows) || [];
    return linhas.map((linha) => {
      const cel = linha.c || [];
      const row = {};
      LB_FIELDS.forEach((campo, k) => {
        const v = cel[k] ? cel[k].v : null;
        row[campo] = v == null ? "" : v;
      });
      return row;
    });
  },

  load() {
    if (typeof fetch !== "function") return Promise.reject(new Error("sem fetch"));
    /* Sem timeout, uma rede que so pendura deixa o menu num spinner eterno —
       o unico estado inaceitavel dos tres que esta tela pode ter. */
    const corta = new Promise((_, rej) =>
      setTimeout(() => rej(new Error("tempo esgotado")), LB_CFG.timeout));
    /* Devolve `fora` junto: linha reprovada NAO some em silencio, ela vira uma
       contagem no rodape do painel. Filtro invisivel e filtro que voce nao
       percebe que quebrou. */
    const busca = fetch(this.url(), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then((t) => {
        const todas = this.parse(t);
        const rows = todas.filter((row) => this.valid(row));
        return { rows, fora: todas.length - rows.length };
      });
    return Promise.race([busca, corta]);
  },

  /* UMA linha por amigo. As linhas ja chegam ordenadas por tempo, entao a
     primeira ocorrencia de um nome e a melhor run dele. Sem isto uma pessoa com
     as cinquenta melhores runs seria o placar inteiro — e o quadro e de melhor
     de sempre, nao de quem jogou mais vezes. */
  melhorPorJogador(rows, limite) {
    const vistos = new Set(), fora = [];
    for (const r of rows) {
      const n = this.limpaNome(r.nome).toUpperCase();
      if (!n || vistos.has(n)) continue;
      vistos.add(n); fora.push(r);
      if (limite && fora.length >= limite) break;
    }
    return fora;
  },

  /* --- 5. plausibilidade ---------------------------------------------------
     Nenhuma constante copiada. Uma tabela de limites escrita a mao envelhece no
     primeiro rebalanceamento e passa a reprovar run HONESTA, que e o pior
     defeito que um filtro pode ter. As tres regras leem o proprio jogo. */

  // O inimigo mais barato do catalogo vale 1 de xp, entao o xp acumulado ate um
  // nivel e um piso rigido para o numero de abates.
  minKillsFor(nivel) {
    let xp = 0;
    for (let l = 1; l < nivel; l++) xp += xpForLevel(l);
    return xp;
  },

  /* O teto de nascimentos. Generoso DE PROPOSITO: ele existe para reprovar
     `999999`, nao para medir a curva — quem mede e o `driver_balance`. Toma o
     intervalo mais apertado que o spawner alcanca, soma as waves densas e um
     campo ja cheio na entrada. */
  maxKillsFor(seg) {
    const B = BALANCE.spawn;
    const porSegundo = 1 / B.hardMinInterval;
    const waves = Math.ceil(seg / B.hardWaveEvery + 1) * B.waveBase * 3;
    return porSegundo * seg + waves + B.hardMaxAlive;
  },

  valid(row) {
    const nome = this.limpaNome(row.nome);
    if (!nome) return false;

    const ms = Number(row.tempo_ms), abates = Number(row.abates);
    const nivel = Number(row.nivel), cadeia = Number(row.cadeia);
    const dano = Number(row.dano);
    for (const n of [ms, abates, nivel, cadeia, dano])
      if (!isFinite(n) || n < 0) return false;

    if (ms <= 0 || ms > LB_CFG.maxMs) return false;
    if (nivel < 1) return false;

    // R1 — nivel exige abates.
    if (abates < this.minKillsFor(nivel)) return false;
    // R2 — o spawner nao consegue por tanta coisa em campo nesse tempo.
    if (abates > this.maxKillsFor(ms / 1000)) return false;
    // R3 — impossibilidades estruturais.
    if (cadeia > abates) return false;
    if (row.assinatura && !PIECES[row.assinatura]) return false;

    const eixos = String(row.eixos).split("/").map(Number);
    if (eixos.length !== 3) return false;
    let soma = 0;
    for (const v of eixos) {
      if (!isFinite(v) || v < 0 || v > AXIS_RULES.capPerAxis) return false;
      soma += v;
    }
    if (soma > AXIS_RULES.pool) return false;

    return true;
  },
};
