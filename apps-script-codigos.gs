/**
 * ============================================================
 *  NUMERAÇÃO DE OCORRÊNCIAS - Painel do Colaborador (Malu Serviços)
 *  EEMTI Prof. Maria Luiza Saboia Ribeiro
 * ============================================================
 *
 *  IMPORTANTE / PRIVACIDADE:
 *  Este banco guarda APENAS o código (8 dígitos) + data/hora + quem registrou.
 *  NENHUM dado de aluno (nome, descrição, turma) é enviado para cá.
 *  Serve só para a numeração ser única entre todos os aparelhos e evitar
 *  códigos repetidos no mesmo dia. O conteúdo da ocorrência continua local
 *  e vai para a gestão pelo WhatsApp / formulário, por ação do coordenador.
 *
 *  PASSO A PASSO (faça uma vez):
 *
 *  1. Em https://sheets.google.com (com o e-mail da escola), crie uma planilha.
 *     Nome sugerido: "Numeração de Ocorrências - Malu".
 *
 *  2. Na planilha: Extensões > Apps Script.
 *
 *  3. Apague o que estiver lá e COLE TODO este arquivo.
 *
 *  4. Implantar (Deploy) > Nova implantação:
 *       - Tipo: "App da Web"
 *       - Executar como: "Eu"
 *       - Quem tem acesso: "Qualquer pessoa"
 *       - Implantar e AUTORIZAR.
 *
 *  5. Copie a "URL do app da Web" (termina em /exec).
 *
 *  6. No index.html, encontre:
 *         const CODIGOS_SCRIPT_URL = '';
 *     e cole a URL entre as aspas.
 *
 *  Sem essa URL, o site funciona igual, mas usando um contador por aparelho.
 *  Se mudar este código depois, faça Implantar > Gerenciar implantações >
 *  editar > "Nova versão".
 */

var SHEET_NAME = 'Codigos';

function doGet(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var date = (e && e.parameter && e.parameter.date) || '';   // formato YYYYMMDD
    var resp = (e && e.parameter && e.parameter.resp) || '';

    if (!/^\d{8}$/.test(date)) {
      return _json({ success: false, error: 'data inválida' });
    }

    // DDMMAA a partir de YYYYMMDD
    var ddmmaa = date.substring(6, 8) + date.substring(4, 6) + date.substring(2, 4);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(SHEET_NAME);
      sh.appendRow(['Código', 'Data/Hora', 'Registrado por']);
      sh.getRange(1, 1, 1, 3).setFontWeight('bold');
      sh.setFrozenRows(1);
    }

    // Conta quantos códigos já existem para este dia (mesmo prefixo DDMMAA)
    var values = sh.getDataRange().getValues();
    var seq = 0;
    for (var i = 1; i < values.length; i++) {
      var code = String(values[i][0]);
      if (code.substring(0, 6) === ddmmaa) seq++;
    }
    seq = seq + 1;

    var fullCode = ddmmaa + ('0' + seq).slice(-2);
    sh.appendRow([fullCode, new Date(), resp]);

    return _json({ success: true, code: fullCode });

  } catch (err) {
    return _json({ success: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
