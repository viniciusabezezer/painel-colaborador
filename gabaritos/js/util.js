/* Utilitários de interface: escape, ícones SVG, toast, folha inferior, imagens, mini-cartão SVG. */
(function (global) {
  'use strict';

  var U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Número com vírgula e uma casa decimal (ex.: 8,5)
  U.fmt = function (n, casas) { return Number(n).toFixed(casas == null ? 1 : casas).replace('.', ','); };
  U.dataBR = function (iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  U.agora = function () { var d = new Date(); return d.toISOString().slice(0, 16).replace('T', ' '); };
  U.hoje = function () { return new Date().toISOString().slice(0, 10); };

  /* ---------- ícones (traço simples, 24×24) ---------- */
  var ICONES = {
    casa: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    revisar: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 13l2 2 4-4"/>',
    grafico: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="14" width="3" height="3"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    enviar: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    baixar: '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18v.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    nuvem: '<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>',
    semrede: '<path d="M3 3l18 18"/><path d="M8.5 16a5 5 0 017-1M5 12.5a9 9 0 013-2M12 20h.01M16 9.5A9 9 0 0121 12.5"/>',
    lanterna: '<path d="M8 3h8v5l-2 3v10h-4V11L8 8z"/><path d="M12 3v3"/>',
    trocar: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
    pausa: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    busca: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
    arquivo: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    imprimir: '<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    voltar: '<path d="M15 5l-7 7 7 7"/>',
    chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M16 7l3 3"/>',
    olho: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5M8.5 11h5M11 8.5v5"/>'
  };
  U.ic = function (nome, tam) {
    var t = tam || 24;
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONES[nome] || '') + '</svg>';
  };

  /* ---------- feedback ---------- */
  U.anunciar = function (texto) { var v = document.getElementById('vivo'); v.textContent = ''; setTimeout(function () { v.textContent = texto; }, 30); };
  var tToast;
  U.toast = function (texto, ms) {
    var el = document.getElementById('toast');
    el.textContent = texto; el.hidden = false;
    clearTimeout(tToast); tToast = setTimeout(function () { el.hidden = true; }, ms || 3200);
  };

  /* Folha inferior (diálogo). conteudo: HTML; aoMontar(el) liga os eventos. */
  var focoAntes = null;
  U.folha = function (titulo, conteudo, aoMontar) {
    var f = document.getElementById('folha'), fundo = document.getElementById('folha-fundo');
    focoAntes = document.activeElement;
    f.innerHTML = '<div class="puxador"></div><button class="btn mini fecha" data-fechar aria-label="Fechar">' + U.ic('x', 20) + '</button>' +
      '<h2 id="folha-titulo">' + U.esc(titulo) + '</h2><div class="pilha" style="margin-top:12px">' + conteudo + '</div>';
    f.hidden = false; fundo.hidden = false;
    f.querySelectorAll('[data-fechar]').forEach(function (b) { b.addEventListener('click', U.fecharFolha); });
    fundo.onclick = U.fecharFolha;
    f.onkeydown = function (e) { if (e.key === 'Escape') U.fecharFolha(); };
    if (aoMontar) aoMontar(f);
    var primeiro = f.querySelector('button, input, select, textarea, a');
    if (primeiro) primeiro.focus();
    return f;
  };
  U.fecharFolha = function () {
    document.getElementById('folha').hidden = true; document.getElementById('folha-fundo').hidden = true;
    if (focoAntes && focoAntes.focus && document.contains(focoAntes)) focoAntes.focus();
  };

  /* ---------- imagens ---------- */
  U.carregarImagem = function (src) {
    return new Promise(function (ok, erro) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { erro(new Error('imagem inválida')); }; im.src = src; });
  };
  // Lê pixels de uma imagem; reduz se for enorme (fotos de celular) para manter a leitura rápida.
  U.imageDataDe = function (img, canvasDestino, alturaMax) {
    var w = img.naturalWidth || img.videoWidth || img.width, h = img.naturalHeight || img.videoHeight || img.height;
    var k = Math.min(1, (alturaMax || 2400) / Math.max(w, h));
    var cv = canvasDestino || document.createElement('canvas');
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return ctx.getImageData(0, 0, cv.width, cv.height);
  };

  /* ---------- mini-cartão SVG, desenhado pela geometria ----------
     aluno: {lista, respostas, codigo_lido}; opções: {questao: n} para dar zoom numa questão. */
  U.cartaoSVG = function (aluno, opc) {
    opc = opc || {};
    var G = global.MALU_GEOMETRIA, p = [], i;
    var lista = ('0' + aluno.lista).slice(-2);
    var cod = (aluno.codigo_lido || '').split('');
    function bol(cx, cy, cheio, texto, fraca) {
      p.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + G.raio + '" fill="' + (cheio ? '#111' : fraca ? '#bbb' : 'none') + '" stroke="#000" stroke-width=".22"/>');
    }
    var com = opc.codigo !== false;
    (com ? G.marcas_grade.concat(G.marcas_codigo) : G.marcas_grade).forEach(function (m) {
      p.push('<rect x="' + (m.cx - G.marca / 2) + '" y="' + (m.cy - G.marca / 2) + '" width="' + G.marca + '" height="' + G.marca + '"/>');
    });
    G.bolhas_lista.forEach(function (b) { bol(b.cx, b.cy, b.valor === lista.charAt(b.casa === 'dezena' ? 0 : 1)); });
    G.bolhas_questoes.forEach(function (b) {
      var r = aluno.respostas[b.questao] || '';
      bol(b.cx, b.cy, r.indexOf(b.valor) >= 0, '', opc.fracas && opc.fracas.indexOf(b.questao) >= 0 && r.indexOf(b.valor) >= 0);
    });
    if (com) G.bolhas_letras.concat(G.bolhas_digitos).forEach(function (b) { bol(b.cx, b.cy, cod[b.posicao - 1] === b.valor); });
    var vb = '0 0 ' + G.largura + ' ' + ((com ? G.marcas_codigo[3] : G.marcas_grade[G.marcas_grade.length - 1]).cy + 4);
    if (opc.questao) { // recorte ampliado ao redor de uma questão
      var qs = G.bolhas_questoes.filter(function (b) { return b.questao === opc.questao; });
      vb = (qs[0].cx - 8) + ' ' + (qs[0].cy - 4) + ' ' + 28 + ' ' + 8;
    }
    return '<svg class="mini" viewBox="' + vb + '" role="img" aria-label="' + U.esc(opc.rotulo || 'Cartão-resposta redesenhado a partir da leitura') + '">' +
      '<rect x="-5" y="-5" width="120" height="200" fill="#fff"/>' + p.join('') + '</svg>';
  };

  // Selo "Com código" (verde) / "Sem código" (cinza)
  U.seloCodigo = function (com) {
    return com ? '<span class="chip selo-codigo">Com código</span>' : '<span class="chip neutro selo-codigo">Sem código</span>';
  };
  // Como o código de verificação é montado (texto único, usado na demo e na ficha do aluno)
  U.explicaCodigo = function () {
    return '<p class="suave pequeno explica-codigo" style="margin:0"><b>Como é o código:</b> as <b>letras</b> são a primeira letra de uma palavra do enunciado que aparece com essa letra <u>sublinhada</u>; os <b>algarismos</b> são o resultado de somas simples escritas no meio dos enunciados, sem marca. Letras possíveis: A C E F P R T V. Algarismos: de 3 a 9.</p>';
  };

  // Cartões de exemplo que existem como imagem (lista da 1ª A → arquivo)
  U.imagemDoAluno = function (a) {
    if (a.turma !== '1A') return null;
    return { 7: 'cartoes/cartao_007.png', 3: 'cartoes/cartao_003_ambiguo.png', 6: 'cartoes/cartao_006_dupla.png', 4: 'cartoes/cartao_004_codigo.png' }[a.lista] || null;
  };

  global.U = U;
})(window);
