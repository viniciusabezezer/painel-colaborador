/**
 * ============================================================
 *  RELATÓRIO DE OCORRÊNCIAS - Painel do Colaborador (Malu Serviços)
 *  EEMTI Prof. Maria Luiza Saboia Ribeiro
 * ============================================================
 *
 *  O QUE FAZ:
 *  Lê a PLANILHA DE RESPOSTAS do formulário de ocorrências, extrai os
 *  campos de dentro do texto colado (código, estudante, tipo, turma, data)
 *  e devolve os números para o app montar o relatório. Protegido por PIN.
 *  Nada é gravado; só leitura.
 *
 *  ⚠️ DEFINA SEU PIN abaixo (linha "var PIN = ..."). NÃO precisa contar a ninguém
 *     fora da coordenação. É ele que protege os nomes dos alunos.
 *
 *  PASSO A PASSO (faça uma vez):
 *
 *  1. Abra a PLANILHA DE RESPOSTAS do formulário de Ocorrências (a que recebe
 *     o que você cola). Em geral: no formulário, aba "Respostas" > ícone verde
 *     do Sheets > abre a planilha.
 *
 *  2. Nessa planilha: Extensões > Apps Script.
 *
 *  3. Apague o que estiver lá e COLE TODO este arquivo.
 *
 *  4. Troque o PIN na linha  var PIN = '1234';  pelo seu (4 a 6 dígitos).
 *
 *  5. Implantar > Nova implantação > App da Web:
 *       - Executar como: "Eu"
 *       - Quem tem acesso: "Qualquer pessoa"   (a proteção é o PIN)
 *       - Implantar e AUTORIZAR.
 *
 *  6. Copie a URL do app da Web (termina em /exec) e cole no index.html em:
 *         const RELATORIO_SCRIPT_URL = '';
 *
 *  Se mudar este código depois: Implantar > Gerenciar implantações > editar >
 *  "Nova versão".
 */

var PIN = '1234';        // <<< TROQUE pelo seu PIN
var SHEET_NAME = '';     // vazio = primeira aba (respostas). Preencha se a aba tiver outro nome.

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (String(p.pin || '') !== String(PIN)) return _j({ success: false, error: 'PIN' });

    var rows = readRecords_();
    var action = p.action || 'overview';

    if (action === 'student') {
      var q = norm_(p.q || '');
      var regs = [];
      for (var i = 0; i < rows.length; i++) {
        if (q && norm_(rows[i].estudante).indexOf(q) !== -1) {
          regs.push({ data: rows[i].data, tipo: rows[i].tipo, codigo: rows[i].codigo, turma: rows[i].turma });
        }
      }
      regs.sort(function (a, b) { return _key(a.data).localeCompare(_key(b.data)); });
      return _j({ success: true, nome: p.q || '', total: regs.length, registros: regs });
    }

    var porTipo = {}, porTurma = {}, porMes = {}, total = 0;
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k];
      total++;
      if (r.tipo) porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
      if (r.turma) porTurma[r.turma] = (porTurma[r.turma] || 0) + 1;
      if (r.mes) porMes[r.mes] = (porMes[r.mes] || 0) + 1;
    }
    return _j({ success: true, total: total, porTipo: porTipo, porTurma: porTurma, porMes: porMes });

  } catch (err) {
    return _j({ success: false, error: String(err) });
  }
}

function readRecords_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  var header = values[0].map(function (h) { return String(h).toLowerCase(); });
  var blobCol = findCol_(header, 'cole o texto');
  if (blobCol < 0) blobCol = findCol_(header, 'texto');
  var tsCol = findCol_(header, 'carimbo'); if (tsCol < 0) tsCol = 0;
  var turmaCol = findCol_(header, 'série');
  if (turmaCol < 0) turmaCol = findCol_(header, 'serie');
  if (turmaCol < 0) turmaCol = findCol_(header, 'turma');

  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var blob = blobCol >= 0 ? String(row[blobCol] || '') : '';
    var rec = parseBlob_(blob);
    if (!rec.codigo && !rec.estudante) continue;
    if (!rec.turma && turmaCol >= 0) rec.turma = String(row[turmaCol] || '').trim();

    var mes = '';
    if (rec.data) { var d = rec.data.split('/'); if (d.length === 3) mes = d[2] + '-' + d[1]; }
    if (tsCol >= 0 && row[tsCol] instanceof Date) {
      var t = row[tsCol];
      if (!mes) mes = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2);
      if (!rec.data) rec.data = ('0' + t.getDate()).slice(-2) + '/' + ('0' + (t.getMonth() + 1)).slice(-2) + '/' + t.getFullYear();
    }
    rec.mes = mes;
    out.push(rec);
  }
  return out;
}

function parseBlob_(blob) {
  function m(re) { var x = blob.match(re); return x ? x[1].trim() : ''; }
  return {
    codigo: m(/c[óo]digo:\s*([0-9A-Za-z\-]+)/i),
    estudante: m(/estudante\(s\):\s*([^\n\r]+)/i),
    tipo: m(/tipo:\s*([^\n\r]+)/i),
    turma: m(/turma\/s[ée]rie:\s*([^\n\r]+)/i),
    data: m(/(\d{2}\/\d{2}\/\d{4})/)
  };
}

function findCol_(header, needle) {
  for (var i = 0; i < header.length; i++) { if (header[i].indexOf(needle) !== -1) return i; }
  return -1;
}

function _key(dataBR) {
  var d = String(dataBR || '').split('/');
  return d.length === 3 ? (d[2] + d[1] + d[0]) : '';
}

function norm_(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function _j(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
