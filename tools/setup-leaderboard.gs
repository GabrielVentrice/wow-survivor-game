/**
 * PACTO — one-shot setup for the friends leaderboard.
 *
 * Run `createLeaderboard()` once from script.google.com. It creates the form,
 * links a fresh spreadsheet, adds the derived `placar` sheet, opens read access
 * to the sheet, and logs the exact constants the game needs.
 *
 * Nothing here runs in the game. This file is a setup tool, not a dependency:
 * once it has printed the constants it never runs again.
 */

/* Field order IS the column order in the sheet. The response sheet always puts
   the timestamp in column A, so these land on B..J and `tempo_ms` is column C —
   which is what the derived sheet sorts by. Changing this order means changing
   the QUERY below and the reader in the game. */
var FIELDS = [
  "nome",       // B
  "tempo_ms",   // C  <- the metric
  "abates",     // D
  "nivel",      // E
  "dano",       // F
  "cadeia",     // G
  "assinatura", // H
  "eixos",      // I
  "versao",     // J
];

function createLeaderboard() {
  var form = FormApp.create("PACTO — placar");
  form.setDescription("Preenchido automaticamente pelo jogo. Nao responda a mao.");

  /* Email collection is off on purpose: this sheet becomes world-readable
     below, and a friend's address has no business being in it. */
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);  // one row per RUN, not per person
  form.setAcceptingResponses(true);
  form.setProgressBar(false);
  form.setPublishingSummary(false);
  // Workspace-only setting; personal accounts throw and do not need it.
  try { form.setRequireLogin(false); } catch (e) {}

  FIELDS.forEach(function (f) { form.addTextItem().setTitle(f); });

  var ss = SpreadsheetApp.create("PACTO — placar (respostas)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();

  // The handle we already hold predates the linked sheet: reopen to see it.
  ss = SpreadsheetApp.openById(ss.getId());

  /* The response sheet's NAME is locale-dependent ("Respostas ao formulario 1"
     / "Form Responses 1"), so find it by shape instead: it is the one with a
     header row. The blank default sheet is dropped once we know which is which. */
  var respostas = null, vazias = [];
  ss.getSheets().forEach(function (sh) {
    if (sh.getLastColumn() > 1) respostas = sh; else vazias.push(sh);
  });
  if (!respostas) throw new Error("Aba de respostas nao encontrada — rode de novo.");
  vazias.forEach(function (sh) { ss.deleteSheet(sh); });

  /* The derived sheet is what gets published. It exists so the game reads a
     stable shape: if the form ever gains a column, the game does not notice.
     Apps Script always takes US formula syntax (comma), whatever the locale. */
  var placar = ss.insertSheet("placar");
  placar.getRange("A1").setFormula(
    '=QUERY(\'' + respostas.getName() + '\'!A:J, ' +
    '"select B,C,D,E,F,G,H,I,J where C is not null order by C desc limit 50", 1)'
  );
  SpreadsheetApp.flush();

  var probe = String(placar.getRange("A1").getValue());
  var queryOk = probe.indexOf("#") !== 0;

  /* Read access for everyone: the game fetches this sheet from the browser of
     whoever opens the page, with no key. Write access stays with you — the
     form is the only way in. */
  DriveApp.getFileById(ss.getId())
          .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  /* The `entry.<id>` numbers are not derivable from the item titles, and they
     are what the POST needs. Ask the form itself: a prefilled URL carries them,
     mapped to whatever marker values we hand it. */
  var resp = form.createResponse();
  var items = form.getItems();
  items.forEach(function (it, i) {
    resp = resp.withItemResponse(it.asTextItem().createResponse("__" + i + "__"));
  });
  var prefilled = resp.toPrefilledUrl();

  var entries = FIELDS.map(function (f, i) {
    var m = prefilled.match(new RegExp("entry\\.(\\d+)=__" + i + "__"));
    return { campo: f, id: m ? m[1] : null };
  });
  var faltando = entries.filter(function (e) { return !e.id; });

  /* The POST endpoint uses the PUBLISHED id (the one after /d/e/), which is not
     the file id. Taking it from getId() is the classic way to get a silent 404. */
  var pub = form.getPublishedUrl();
  var formId = (pub.match(/\/forms\/d\/e\/([^\/]+)\//) || [])[1];

  var out = [];
  out.push("=== cole isto em js/leaderboard.js ===");
  out.push("");
  out.push("const LB = {");
  out.push("  form:  \"" + formId + "\",");
  out.push("  sheet: \"" + ss.getId() + "\",");
  out.push("  entry: {");
  entries.forEach(function (e) {
    out.push("    " + e.campo + ": \"entry." + (e.id || "FALTOU") + "\",");
  });
  out.push("  },");
  out.push("};");
  out.push("");
  out.push("=== links para guardar ===");
  out.push("form (responder a mao, so para testar): " + pub);
  out.push("planilha: " + ss.getUrl());
  out.push("leitura que o jogo usa:");
  out.push("  https://docs.google.com/spreadsheets/d/" + ss.getId() +
           "/gviz/tq?tqx=out:json&sheet=placar");
  out.push("");
  out.push("=== conferir ===");
  out.push(queryOk
    ? "ok  aba `placar` calculou sem erro"
    : "ERRO na aba `placar`: " + probe +
      "\n    Se for #ERROR!, troque as virgulas da formula por ponto-e-virgula.");
  out.push(faltando.length
    ? "ERRO: sem entry id para: " + faltando.map(function (e) { return e.campo; }).join(", ")
    : "ok  os " + entries.length + " entry ids foram encontrados");

  var txt = out.join("\n");
  Logger.log(txt);
  return txt;
}
