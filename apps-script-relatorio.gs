/**
 * ============================================================
 *  RELATÓRIO DE OCORRÊNCIAS (página interna SEDUC) - Malu Serviços
 *  EEMTI Prof. Maria Luiza Saboia Ribeiro
 * ============================================================
 *
 *  O QUE FAZ:
 *  Serve uma PÁGINA (dentro do Google/SEDUC) com o relatório de ocorrências.
 *  Lê a planilha de respostas do formulário, extrai os campos do texto colado
 *  (código, estudante, tipo, turma, data) e monta os números. Só leitura.
 *
 *  SEGURANÇA: como é implantado "Qualquer pessoa dentro da SEDUC", só quem
 *  está logado numa conta SEDUC abre a página. O PIN abaixo é a 2ª camada,
 *  para restringir à coordenação. Os dados nunca saem do ambiente SEDUC.
 *
 *  ⚠️ DEFINA SEU PIN na linha  var PIN = '1234';
 *
 *  PASSO A PASSO:
 *  1. Abra a PLANILHA DE RESPOSTAS do formulário de Ocorrências.
 *  2. Extensões > Apps Script. Apague tudo e cole ESTE arquivo.
 *  3. Troque o PIN.
 *  4. Implantar > Gerenciar implantações > (sua implantação) > Editar (lápis)
 *     > Versão: "Nova versão" > Implantar.  (assim a URL continua a mesma)
 *     - Executar como: "Eu"
 *     - Quem tem acesso: "Qualquer pessoa dentro da [SEDUC]"
 *  5. A URL /exec já está ligada no site. Se mudar, me avise.
 */

var PIN = '1234';        // <<< TROQUE pelo seu PIN
var SHEET_NAME = '';     // vazio = primeira aba (respostas)

function doGet(e) {
  return HtmlService.createHtmlOutput(PAGE_HTML_())
    .setTitle('Relatório de Ocorrências — Malu Serviços')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function checkPin_(pin) { return String(pin || '') === String(PIN); }

function apiOverview(pin) {
  if (!checkPin_(pin)) return { success: false, error: 'PIN' };
  var rows = readRecords_();
  var porTipo = {}, porTurma = {}, porMes = {}, total = 0;
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k]; total++;
    if (r.tipo) porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
    if (r.turma) porTurma[r.turma] = (porTurma[r.turma] || 0) + 1;
    if (r.mes) porMes[r.mes] = (porMes[r.mes] || 0) + 1;
  }
  return { success: true, total: total, porTipo: porTipo, porTurma: porTurma, porMes: porMes };
}

function apiStudent(pin, q) {
  if (!checkPin_(pin)) return { success: false, error: 'PIN' };
  var nq = norm_(q || ''), regs = [], rows = readRecords_();
  for (var i = 0; i < rows.length; i++) {
    if (nq && norm_(rows[i].estudante).indexOf(nq) !== -1) {
      regs.push({ data: rows[i].data, tipo: rows[i].tipo, codigo: rows[i].codigo, turma: rows[i].turma });
    }
  }
  regs.sort(function (a, b) { return _key(a.data).localeCompare(_key(b.data)); });
  return { success: true, nome: q || '', total: regs.length, registros: regs };
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

function PAGE_HTML_() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; margin:0; background:#f4f4f8; color:#16261d; }
  .wrap { max-width:560px; margin:0 auto; background:#fff; min-height:100vh; }
  .hd { background:linear-gradient(135deg,#6a5acd,#4b3fae); color:#fff; padding:18px 20px; display:flex; align-items:center; gap:10px; }
  .hd h1 { font-size:18px; margin:0; font-weight:600; }
  .bd { padding:20px; }
  .instr { color:#56655c; font-size:14px; margin:0 0 16px; line-height:1.5; }
  label { display:block; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#56655c; margin:0 0 6px; }
  input { width:100%; padding:12px 14px; border:1.5px solid #e5e7eb; border-radius:12px; font-size:16px; outline:none; font-family:inherit; }
  input:focus { border-color:#6a5acd; }
  button { width:100%; padding:14px; border:none; border-radius:12px; font-size:16px; font-weight:700; cursor:pointer; margin-top:10px; font-family:inherit; }
  .btn-primary { background:linear-gradient(135deg,#6a5acd,#4b3fae); color:#fff; }
  .btn-wa { background:linear-gradient(135deg,#25D366,#128C7E); color:#fff; }
  .btn-print { background:#fff; color:#16261d; border:1.5px solid #d8dee4; }
  .status { font-size:13px; text-align:center; margin:10px 0; min-height:1em; color:#b3401a; }
  .total { display:flex; align-items:baseline; gap:8px; margin-bottom:16px; }
  .total .n { font-size:34px; font-weight:800; color:#4b3fae; }
  .total .l { color:#56655c; font-size:14px; }
  .sec { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#56655c; margin:16px 0 8px; }
  .bar { display:flex; align-items:center; gap:10px; margin-bottom:7px; font-size:14px; }
  .bar .lab { flex:0 0 40%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bar .trk { flex:1; height:9px; background:#eef0f4; border-radius:100px; overflow:hidden; }
  .bar .fil { display:block; height:100%; background:linear-gradient(90deg,#7d6ee0,#4b3fae); }
  .bar .v { font-weight:700; min-width:18px; text-align:right; }
  .divider { height:1px; background:#e5e7eb; margin:22px 0; }
  .sbox { background:#f3f1fb; border:1px solid #d9d4f3; border-radius:12px; padding:14px; margin-top:12px; }
  .shead { font-size:15px; margin-bottom:10px; }
  .rec { display:flex; gap:10px; font-size:13px; padding:6px 0; border-top:1px solid #e3def5; }
  .rec .d { color:#56655c; }
  .rec .t { flex:1; }
  .rec .c { font-family:monospace; font-weight:700; color:#4b3fae; }
  .toggle { display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin:18px 0 8px; font-size:14px; }
  .toggle .lab { font-weight:700; color:#56655c; }
  .empty { color:#56655c; font-size:14px; padding:6px 0; }
  @media print { .noprint { display:none !important; } .hd { color:#000; background:none; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="hd"><span style="font-size:22px;">📊</span><h1>Consultar Ocorrências</h1></div>
  <div class="bd">
    <div id="pinStep">
      <p class="instr">Área restrita à coordenação. Os relatórios mostram nomes de estudantes — digite o PIN para entrar.</p>
      <label for="pin">PIN de coordenador</label>
      <input id="pin" type="password" inputmode="numeric" placeholder="••••••" onkeydown="if(event.key==='Enter')unlock()">
      <div class="status" id="pinStatus"></div>
      <button class="btn-primary" onclick="unlock()">Entrar</button>
    </div>
    <div id="reportStep" style="display:none">
      <div id="overview"></div>
      <div class="divider noprint"></div>
      <div class="noprint">
        <label for="sq">Consultar por aluno</label>
        <input id="sq" type="text" placeholder="Nome do estudante" onkeydown="if(event.key==='Enter')buscar()">
        <button class="btn-primary" onclick="buscar()">🔎 Buscar aluno</button>
      </div>
      <div id="sresults"></div>
      <div class="toggle noprint"><span class="lab">Ao compartilhar:</span><label><input type="radio" name="anon" value="c" checked> Completo</label><label><input type="radio" name="anon" value="a"> Anonimizado</label></div>
      <button class="btn-wa noprint" onclick="enviarWa()">Enviar relatório (WhatsApp)</button>
      <button class="btn-print noprint" onclick="window.print()">🖨️ Imprimir / Salvar em PDF</button>
    </div>
  </div>
</div>
<script>
  var NL = String.fromCharCode(10);
  var PINV='', OV=null, LAST=null;
  function unlock(){
    var pin=document.getElementById('pin').value.trim();
    var st=document.getElementById('pinStatus');
    if(!pin){ st.textContent='Digite o PIN.'; return; }
    st.textContent='Verificando...';
    google.script.run.withSuccessHandler(function(d){
      if(!d.success){ st.textContent = d.error==='PIN' ? 'PIN incorreto.' : ('Erro: '+d.error); return; }
      PINV=pin; OV=d; renderOv(d);
      document.getElementById('pinStep').style.display='none';
      document.getElementById('reportStep').style.display='block';
    }).withFailureHandler(function(e){ st.textContent='Erro: '+e.message; }).apiOverview(pin);
  }
  function bars(o){
    var ks=Object.keys(o||{}); if(!ks.length) return '<div class="empty">Sem dados.</div>';
    ks.sort(function(a,b){ return o[b]-o[a]; });
    var max=0; ks.forEach(function(k){ if(o[k]>max) max=o[k]; });
    var s=''; ks.forEach(function(k){ var w=max>0?Math.round(o[k]/max*100):0; s+='<div class="bar"><span class="lab">'+esc(k)+'</span><span class="trk"><span class="fil" style="width:'+w+'%"></span></span><span class="v">'+o[k]+'</span></div>'; });
    return s;
  }
  function mesList(o){
    var ks=Object.keys(o||{}); if(!ks.length) return '<div class="empty">Sem dados.</div>';
    ks.sort(); var M=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']; var s='';
    ks.forEach(function(k){ var p=k.split('-'); s+='<div class="bar"><span class="lab">'+(M[parseInt(p[1],10)-1]||p[1])+'/'+p[0]+'</span><span class="v">'+o[k]+'</span></div>'; });
    return s;
  }
  function renderOv(d){
    OV=d;
    document.getElementById('overview').innerHTML='<div class="total"><span class="n">'+(d.total||0)+'</span><span class="l">ocorrências registradas</span></div><div class="sec">Por tipo</div>'+bars(d.porTipo)+'<div class="sec">Por turma</div>'+bars(d.porTurma)+'<div class="sec">Por mês</div>'+mesList(d.porMes);
  }
  function buscar(){
    var q=document.getElementById('sq').value.trim();
    var el=document.getElementById('sresults');
    if(!q){ el.innerHTML=''; return; }
    el.innerHTML='<div class="empty">Buscando...</div>';
    google.script.run.withSuccessHandler(function(d){
      if(!d.success){ el.innerHTML='<div class="empty">'+esc(d.error||'Erro')+'</div>'; return; }
      LAST=d; renderSt(d);
    }).withFailureHandler(function(e){ el.innerHTML='<div class="empty">Erro: '+e.message+'</div>'; }).apiStudent(PINV,q);
  }
  function renderSt(d){
    LAST=d; var el=document.getElementById('sresults');
    if(!d.total){ el.innerHTML='<div class="sbox empty">Nenhuma ocorrência encontrada para "'+esc(d.nome)+'".</div>'; return; }
    var s='<div class="sbox"><div class="shead">'+esc(d.nome)+' — <strong>'+d.total+'</strong> ocorrência(s)</div>';
    d.registros.forEach(function(r){ s+='<div class="rec"><span class="d">'+esc(r.data||'')+'</span><span class="t">'+esc(r.tipo||'—')+(r.turma?' · '+esc(r.turma):'')+'</span><span class="c">'+esc(r.codigo||'')+'</span></div>'; });
    s+='</div>'; el.innerHTML=s;
  }
  function isAnon(){ var e=document.querySelector('input[name=anon]:checked'); return !!(e && e.value==='a'); }
  function anonNome(n){ var p=String(n).trim().split(/ +/).filter(Boolean); if(!p.length) return '—'; if(p.length===1) return p[0][0].toUpperCase()+'.'; return p[0][0].toUpperCase()+'. '+p[p.length-1][0].toUpperCase()+'.'; }
  function shareText(){
    if(!OV) return '';
    var a=isAnon();
    var t='📊 *RELATÓRIO DE OCORRÊNCIAS*'+NL+'🏫 EEMTI Profa. Maria Luíza Saboia'+NL+NL+'Total: '+(OV.total||0)+NL+NL+'*Por tipo:*'+NL;
    var pt=OV.porTipo||{}; Object.keys(pt).sort(function(a,b){return pt[b]-pt[a];}).forEach(function(k){ t+='• '+k+': '+pt[k]+NL; });
    t+=NL+'*Por turma:*'+NL; var pu=OV.porTurma||{}; Object.keys(pu).sort(function(a,b){return pu[b]-pu[a];}).forEach(function(k){ t+='• '+k+': '+pu[k]+NL; });
    if(LAST && LAST.total){ t+=NL+'*Aluno consultado:* '+(a?anonNome(LAST.nome):LAST.nome)+' — '+LAST.total+' ocorrência(s)'+NL; LAST.registros.forEach(function(r){ t+='• '+(r.data||'')+' — '+(r.tipo||'')+(r.turma?' ('+r.turma+')':'')+NL; }); }
    t+=NL+'_Gerado pelo Painel do Colaborador — Malu Serviços._';
    return t;
  }
  function enviarWa(){ var t=shareText(); if(!t) return; window.open('https://wa.me/?text='+encodeURIComponent(t), '_blank'); }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
</script>
</body>
</html>`;
}
