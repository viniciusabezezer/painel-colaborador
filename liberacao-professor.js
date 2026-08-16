/* =========================================================================
   Liberação de Alunos — Registro pelo PROFESSOR
   Painel do Colaborador · Malu Serviços — EEMTI Prof. Maria Luíza Saboia
   -------------------------------------------------------------------------
   Add-on independente. Para ativar, adicione UMA linha no index.html,
   logo antes de </body>:

       <script src="liberacao-professor.js"></script>

   O script injeta sozinho: o card no painel, o modal, o CSS e as funções.
   Nada é enviado a servidores — tudo é processado no aparelho do professor.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------- Configuração ---------------- */
  var FORM_LIBERACAO_URL = 'https://forms.gle/ieY7upRLTwfVKwtk9'; // formulário oficial
  var ESCOLA = 'EEMTI PROF. MARIA LUÍZA SABÓIA RIBEIRO';

  var TURMAS = ['1º A', '1º B', '1º C', '2º A', '2º B', '2º C', '3º A', '3º B'];

  /* Campos do formulário rápido do professor. O detalhamento (motivo, horário,
     responsável etc.) continua sendo feito no formulário oficial do Google. */
  var CAMPOS = ['lib-teacher', 'lib-student', 'lib-class'];

  var libWhatsAppMessage = '';
  var libPlainText = '';
  var libCode = '';

  /* ---------------- Helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function v(id) { var el = $(id); return el ? (el.value || '').trim() : ''; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* Protocolo local: LIB + DDMMAA + ordem no dia (ex.: LIB16082601) */
  function nextLibCode(now) {
    var ddmmaa = pad(now.getDate()) + pad(now.getMonth() + 1) + String(now.getFullYear()).slice(-2);
    var ymd = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
    var seq = 1;
    try {
      seq = parseInt(localStorage.getItem('lib_seq_' + ymd) || '0', 10) + 1;
      localStorage.setItem('lib_seq_' + ymd, String(seq));
    } catch (e) { seq = 1; }
    return 'LIB' + ddmmaa + pad(seq);
  }

  /* ---------------- CSS (reaproveita o visual do painel) ---------------- */
  function injectCss() {
    var css =
      '.lib-resumo{border:1px solid rgba(43,111,63,.35);background:rgba(43,111,63,.07);' +
      'border-radius:14px;padding:14px 16px;margin:4px 0 18px;display:none;animation:libFade .25s ease}' +
      '.lib-resumo.on{display:block}' +
      '@keyframes libFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}' +
      '.lib-resumo-title{font-size:.78rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;' +
      'margin:0 0 10px;display:flex;align-items:center;gap:6px}' +
      '.lib-resumo-row{display:flex;gap:10px;font-size:.86rem;line-height:1.65;align-items:baseline}' +
      '.lib-resumo-k{flex:0 0 40%;max-width:170px;font-weight:700;opacity:.8}' +
      '.lib-resumo-v{flex:1;word-break:break-word}' +
      '.lib-resumo-v.empty{opacity:.45;font-style:italic}' +
      '.lib-resumo-foot{margin:12px 0 0;padding-top:10px;border-top:1px dashed rgba(43,111,63,.3);' +
      'font-size:.76rem;line-height:1.5;opacity:.85}' +
      '.lib-aprov-box{border:1px dashed rgba(43,111,63,.45);border-radius:12px;padding:12px 14px;' +
      'margin:14px 0;font-size:.8rem;line-height:1.55;opacity:.9}' +
      '.lib-aprov-box strong{display:block;margin-bottom:4px}' +
      '.lib-passos{border:1px solid rgba(194,89,13,.35);background:rgba(194,89,13,.07);' +
      'border-radius:14px;padding:14px 16px;margin:0 0 18px}' +
      '.lib-passos-title{font-size:.78rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;' +
      'margin:0 0 10px}' +
      '.lib-passos ol{margin:0;padding-left:20px;font-size:.84rem;line-height:1.7}' +
      '.lib-passos li{margin-bottom:4px}' +
      '.lib-passos-foot{margin:10px 0 0;font-size:.76rem;line-height:1.5;opacity:.85}' +
      '.lib-fallback{display:none;margin:0 0 12px;font-size:.82rem;line-height:1.6}' +
      '.lib-fallback.on{display:block}' +
      '.lib-fallback a{display:block;padding:10px 12px;margin-top:6px;border:1px solid #cfdcd3;' +
      'border-radius:10px;text-decoration:none;font-weight:700}' +
      '.lib-popup-overlay{position:fixed;inset:0;background:rgba(10,25,15,.65);display:none;' +
      'align-items:center;justify-content:center;z-index:99999;padding:20px}' +
      '.lib-popup-overlay.on{display:flex}' +
      '.lib-popup-box{background:#fff;border-radius:18px;padding:24px 20px;max-width:340px;width:100%;' +
      'text-align:center;font-size:.92rem;line-height:1.65;color:#16261d;' +
      'box-shadow:0 18px 50px rgba(0,0,0,.3);animation:libFade .25s ease}' +
      '.lib-popup-emoji{font-size:2.2rem;margin-bottom:10px}' +
      '.lib-popup-box p{margin:0 0 18px}' +
      '.lib-popup-box button{width:100%;padding:13px;border:0;border-radius:12px;font:inherit;' +
      'font-weight:700;cursor:pointer;background:#2b6f3f;color:#fff}';
    var st = document.createElement('style');
    st.id = 'lib-professor-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------------- Card no painel ---------------- */
  function injectCard() {
    var grid = document.querySelector('.form-grid');
    if (!grid) return;

    var btn = document.createElement('button');
    btn.className = 'form-card glass reveal delay-5';
    btn.id = 'lib-professor-card';
    btn.type = 'button';
    btn.setAttribute('onclick', 'openLiberacaoModal()');
    btn.innerHTML =
      '<div class="card-head">' +
        '<div class="icon-wrapper lib-card-icon">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
          '<polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>' +
        '</div>' +
        '<div class="card-text">' +
          '<h3>🧑‍🏫 Liberação de Alunos (Professor)</h3>' +
          '<p>O professor registra a liberação, confere o resumo e envia à gestão pelo WhatsApp com o botão de aprovação.</p>' +
        '</div>' +
      '</div>' +
      '<div class="card-footer"><span>Registrar liberação</span><div class="arrow">&rarr;</div></div>';

    /* Posiciona logo depois do card "Liberação de alunos" já existente. */
    var vizinho = grid.querySelector('a[href*="ieY7upRLTwfVKwtk9"]');
    if (vizinho && vizinho.parentNode === grid) {
      grid.insertBefore(btn, vizinho.nextSibling);
    } else {
      grid.appendChild(btn);
    }
  }

  /* ---------------- Modal ---------------- */
  function optionsHtml(arr) {
    return '<option value="">Selecione...</option>' +
      arr.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
  }

  function injectModal() {
    var wrap = document.createElement('div');
    wrap.id = 'liberacao-overlay';
    wrap.className = 'chat-overlay';
    wrap.setAttribute('onclick', 'closeLiberacaoFromOverlay(event)');
    wrap.innerHTML =
      '<div class="copies-modal" onclick="event.stopPropagation()">' +
        '<div class="copies-header ocorrencia-header">' +
          '<div class="chat-header-info">' +
            '<div class="copies-avatar">🧑‍🏫</div>' +
            '<h3>Liberação de Aluno (Professor)</h3>' +
          '</div>' +
          '<button class="chat-close-btn" onclick="closeLiberacaoModal()" aria-label="Fechar">&times;</button>' +
        '</div>' +
        '<div class="copies-body">' +

          '<div id="lib-form-step">' +
            '<div class="lib-passos">' +
              '<p class="lib-passos-title">📌 Leia antes de começar</p>' +
              '<ol>' +
                '<li>Preencha os <strong>três campos</strong> abaixo e toque em <strong>Gerar liberação</strong>.</li>' +
                '<li>No passo seguinte, um único botão vai <strong>abrir o WhatsApp com a mensagem pronta</strong> ' +
                'e, ao mesmo tempo, <strong>abrir o formulário oficial em outra aba</strong>.</li>' +
                '<li><strong>Envie a mensagem no WhatsApp primeiro.</strong> Depois volte ao navegador e ' +
                'complete o formulário, que já estará aberto esperando por você.</li>' +
              '</ol>' +
              '<p class="lib-passos-foot">O texto da liberação também é copiado automaticamente, ' +
              'para você poder colá-lo numa mensagem a um dos coordenadores, se precisar. ' +
              'Tudo é processado <strong>localmente no seu aparelho</strong>.</p>' +
            '</div>' +

            '<div class="copies-field">' +
              '<label for="lib-teacher">Nome do(a) professor(a) que está liberando</label>' +
              '<input type="text" id="lib-teacher" placeholder="Ex: Joana Costa" autocomplete="off">' +
            '</div>' +
            '<div class="copies-field">' +
              '<label for="lib-student">Nome do(a) estudante</label>' +
              '<input type="text" id="lib-student" placeholder="Ex: João da Silva" autocomplete="off">' +
            '</div>' +
            '<div class="copies-field">' +
              '<label for="lib-class">Turma / Série</label>' +
              '<select id="lib-class">' + optionsHtml(TURMAS) + '</select>' +
            '</div>' +

            '<div class="lib-resumo" id="lib-resumo">' +
              '<p class="lib-resumo-title">📄 Resumo desta liberação</p>' +
              '<div class="lib-resumo-row"><span class="lib-resumo-k">👨‍🎓 Estudante</span><span class="lib-resumo-v empty" id="lib-r-student">a preencher</span></div>' +
              '<div class="lib-resumo-row"><span class="lib-resumo-k">🏷️ Turma / Série</span><span class="lib-resumo-v empty" id="lib-r-class">a preencher</span></div>' +
              '<div class="lib-resumo-row"><span class="lib-resumo-k">🧑‍🏫 Professor(a)</span><span class="lib-resumo-v empty" id="lib-r-teacher">a preencher</span></div>' +
              '<p class="lib-resumo-foot">Esta mensagem será enviada à <strong>gestão</strong> pelo WhatsApp, ' +
              'junto com o link para a gestão responder <strong>“Liberação recebida e aprovada”</strong>.</p>' +
            '</div>' +

            '<button class="generate-btn ocorrencia-gen-btn" onclick="generateLiberacao()">Gerar liberação ✓</button>' +
          '</div>' +

          '<div id="lib-result-step" style="display:none">' +
            '<p class="oc-privacy-note">🔒 Gerado localmente — nenhum dado saiu do seu aparelho.</p>' +
            '<div class="oc-code-box">' +
              '<span class="oc-code-label">Protocolo da liberação</span>' +
              '<span class="oc-code-value" id="lib-code-value">—</span>' +
              '<span class="oc-code-hint">Informe este protocolo à gestão e à portaria na saída do(a) estudante.</span>' +
            '</div>' +
            '<div class="message-preview" id="lib-message-preview"></div>' +
            '<div class="lib-aprov-box">' +
              '<strong>✅ Como a gestão aprova</strong>' +
              'A mensagem já vai com um link no final. A gestão só toca nesse link e o WhatsApp abre com a resposta ' +
              '<em>“Liberação recebida e aprovada”</em> pronta — basta enviar de volta ao professor.' +
            '</div>' +
            '<div class="lib-passos">' +
              '<p class="lib-passos-title">📌 O que vai acontecer ao tocar no botão</p>' +
              '<ol>' +
                '<li>O texto da liberação é <strong>copiado</strong> — se precisar, cole-o numa ' +
                'mensagem para um dos coordenadores.</li>' +
                '<li>O <strong>formulário oficial</strong> abre primeiro, em outra aba.</li>' +
                '<li>O <strong>WhatsApp abre com a mensagem pronta</strong> — ' +
                '<strong>envie-a para a gestão</strong>.</li>' +
                '<li>Volte ao navegador e <strong>preencha o formulário</strong>.</li>' +
              '</ol>' +
            '</div>' +
            '<div class="oc-copy-status" id="lib-copy-status"></div>' +
            '<div class="lib-fallback" id="lib-fallback"></div>' +
            '<button class="whatsapp-btn" onclick="enviarLiberacaoCompleta()">📲 Enviar à gestão e abrir o formulário</button>' +
            '<button class="print-btn" onclick="printLiberacao()">🖨️ Imprimir / Salvar em PDF</button>' +
            '<button class="back-btn" onclick="showLiberacaoForm()">← Nova liberação</button>' +
          '</div>' +

        '</div>' +
      '</div>' +
      '<div class="lib-popup-overlay" id="lib-popup">' +
        '<div class="lib-popup-box" onclick="event.stopPropagation()">' +
          '<div class="lib-popup-emoji">📋</div>' +
          '<p><strong>O texto da liberação foi copiado!</strong><br>' +
          'Cole-o numa mensagem de WhatsApp para um dos <strong>coordenadores</strong>. ' +
          'O <strong>formulário oficial</strong> já está aberto em outra aba — preencha-o ' +
          'depois de enviar a mensagem.</p>' +
          '<button onclick="fecharLibPopup()">Entendi ✓</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    /* Resumo ao vivo */
    CAMPOS.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', updateLiberacaoResumo);
      el.addEventListener('change', updateLiberacaoResumo);
    });
  }

  /* ---------------- Resumo ao vivo ---------------- */
  function setResumo(id, value) {
    var el = $(id);
    if (!el) return;
    if (value) { el.textContent = value; el.classList.remove('empty'); }
    else { el.textContent = 'a preencher'; el.classList.add('empty'); }
  }

  function updateLiberacaoResumo() {
    var teacher = v('lib-teacher'), student = v('lib-student'), turma = v('lib-class');

    var box = $('lib-resumo');
    if (box) box.classList.toggle('on', !!(teacher || student || turma));

    setResumo('lib-r-student', student);
    setResumo('lib-r-class', turma);
    setResumo('lib-r-teacher', teacher);
  }

  /* ---------------- Abrir / fechar ---------------- */
  function openLiberacaoModal() {
    $('liberacao-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    showLiberacaoForm();
    setTimeout(function () { var el = $('lib-teacher'); if (el) el.focus(); }, 300);
  }

  function closeLiberacaoModal() {
    $('liberacao-overlay').classList.remove('active');
    document.body.style.overflow = '';
  }

  function closeLiberacaoFromOverlay(event) {
    if (event.target === event.currentTarget) closeLiberacaoModal();
  }

  function showLiberacaoForm() {
    $('lib-form-step').style.display = 'block';
    $('lib-result-step').style.display = 'none';
    CAMPOS.forEach(function (id) { var el = $(id); if (el) el.value = ''; });
    var st = $('lib-copy-status'); if (st) { st.textContent = ''; st.style.color = ''; }
    var fb = $('lib-fallback'); if (fb) { fb.innerHTML = ''; fb.classList.remove('on'); }
    fecharLibPopup();
    updateLiberacaoResumo();
  }

  /* ---------------- Geração da mensagem ---------------- */
  function generateLiberacao() {
    var teacher = v('lib-teacher'), student = v('lib-student'), turma = v('lib-class');

    if (!teacher || !student) {
      alert('Preencha o nome do(a) professor(a) e o nome do(a) estudante.');
      return;
    }

    var now = new Date();
    var dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    libCode = nextLibCode(now);

    /* Resposta pronta da gestão — vira link clicável dentro do WhatsApp. */
    var respostaGestao =
      '✅ LIBERAÇÃO RECEBIDA E APROVADA\n' +
      'Protocolo ' + libCode + ' — ' + student + (turma ? ' (' + turma + ')' : '') + '\n' +
      'Prof(a). ' + teacher + '\n' +
      'OK, a Gestão autoriza a saída do(a) estudante.';
    var linkAprovacao = 'https://wa.me/?text=' + encodeURIComponent(respostaGestao);

    libWhatsAppMessage =
      '🏫 *' + ESCOLA + '*\n' +
      '*SOLICITAÇÃO DE LIBERAÇÃO DE ESTUDANTE*\n\n' +
      '🔖 Protocolo: ' + libCode + '\n' +
      '📅 ' + dateStr + ' às ' + timeStr + '\n\n' +
      '👨‍🎓 Estudante: ' + student + '\n' +
      (turma ? '🏷️ Turma/Série: ' + turma + '\n' : '') +
      '🧑‍🏫 Professor(a) que está liberando: ' + teacher + '\n' +
      '\n📋 _Os demais dados seguem no formulário oficial de liberação._\n' +
      '\n———————————————\n' +
      '✅ *GESTÃO — CONFIRMAR RECEBIMENTO*\n' +
      'Toque no link abaixo para responder automaticamente “Liberação recebida e aprovada”:\n' +
      linkAprovacao + '\n' +
      '———————————————\n' +
      '\n_Registrado localmente via Painel do Colaborador — Malu Serviços._';

    /* Versão limpa (sem markdown), copiada para a área de transferência. */
    libPlainText = libWhatsAppMessage.replace(/\*/g, '').replace(/_/g, '');

    $('lib-message-preview').textContent = libWhatsAppMessage;
    $('lib-code-value').textContent = libCode;

    buildLiberacaoPrint({
      dateStr: dateStr, timeStr: timeStr, teacher: teacher,
      student: student, turma: turma, code: libCode
    });

    $('lib-form-step').style.display = 'none';
    $('lib-result-step').style.display = 'block';
    var body = document.querySelector('#liberacao-overlay .copies-body');
    if (body) body.scrollTop = 0;
  }

  /* ---------------- Ações do resultado ---------------- */
  function whatsAppUrl() {
    return 'https://wa.me/?text=' + encodeURIComponent(libWhatsAppMessage);
  }

  /* Botão único: copia o texto, abre o formulário atrás e o WhatsApp na frente.
     Se o navegador bloquear alguma aba, mostra os links para abrir na mão. */
  function enviarLiberacaoCompleta() {
    if (!libWhatsAppMessage) return;
    var status = $('lib-copy-status');
    var fb = $('lib-fallback');
    fb.classList.remove('on');
    fb.innerHTML = '';

    /* 1. cópia (assíncrona, não atrasa a abertura das abas) */
    copyLiberacaoToClipboard().then(function (ok) {
      status.textContent = ok
        ? '✓ Texto copiado. Envie a mensagem a um coordenador e depois preencha o formulário.'
        : '⚠️ Não consegui copiar sozinho — selecione o texto acima e copie à mão.';
      status.style.color = ok ? '' : 'var(--orange-deep)';
      if (ok) abrirLibPopup();
    });

    /* 2. formulário abre primeiro; 3. WhatsApp abre em seguida, com a mensagem pronta */
    var abaForm = window.open(FORM_LIBERACAO_URL, '_blank');
    var abaZap = window.open(whatsAppUrl(), '_blank');

    var bloqueados = [];
    if (!abaForm) bloqueados.push(['📝 Abrir o formulário oficial', FORM_LIBERACAO_URL]);
    if (!abaZap) bloqueados.push(['📲 Abrir o WhatsApp com a mensagem', whatsAppUrl()]);

    if (bloqueados.length) {
      fb.innerHTML = '<strong>O navegador bloqueou a abertura automática.</strong> ' +
        'Toque nos links abaixo para continuar:' +
        bloqueados.map(function (b) {
          return '<a href="' + b[1] + '" target="_blank" rel="noopener">' + b[0] + '</a>';
        }).join('');
      fb.classList.add('on');
    }
  }

  function copyLiberacaoToClipboard() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(libPlainText).then(function () { return true; })
        .catch(function () { return legacyCopy(); });
    }
    return Promise.resolve(legacyCopy());
  }

  function legacyCopy() {
    try {
      var ta = document.createElement('textarea');
      ta.value = libPlainText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function abrirLibPopup() {
    var p = $('lib-popup');
    if (p) p.classList.add('on');
  }

  function fecharLibPopup() {
    var p = $('lib-popup');
    if (p) p.classList.remove('on');
  }

  function printLiberacao() { window.print(); }

  /* Reaproveita o container de impressão já existente (#ocorrencia-print). */
  function buildLiberacaoPrint(d) {
    var alvo = $('ocorrencia-print');
    if (!alvo) return;
    var lista = $('lista-print'); if (lista) lista.innerHTML = '';
    var rel = $('relatorio-print'); if (rel) rel.innerHTML = '';

    alvo.innerHTML =
      '<div style="text-align:center;border-bottom:3px solid #2b6f3f;padding-bottom:12px;margin-bottom:24px;">' +
        '<img src="logo.png" style="height:90px;margin-bottom:8px;" alt="">' +
        '<div style="font-size:16px;font-weight:700;color:#16261d;">' + ESCOLA + '</div>' +
        '<div style="font-size:12px;color:#444;">Coordenação Pedagógica · Paracuru — CE</div>' +
      '</div>' +
      '<h2 style="text-align:center;font-size:17px;letter-spacing:1px;margin:0 0 20px;color:#16261d;">' +
      'REGISTRO DE LIBERAÇÃO DE ESTUDANTE</h2>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:18px;">' +
        '<tr><td style="padding:6px 0;width:38%;font-weight:700;vertical-align:top;">Protocolo:</td>' +
          '<td style="font-weight:700;letter-spacing:1px;">' + esc(d.code) + '</td></tr>' +
        '<tr><td style="padding:6px 0;font-weight:700;vertical-align:top;">Data / Hora do registro:</td>' +
          '<td>' + esc(d.dateStr) + ' — ' + esc(d.timeStr) + '</td></tr>' +
        '<tr><td style="padding:6px 0;font-weight:700;vertical-align:top;">Estudante:</td>' +
          '<td>' + esc(d.student) + '</td></tr>' +
        (d.turma ? '<tr><td style="padding:6px 0;font-weight:700;vertical-align:top;">Turma / Série:</td><td>' + esc(d.turma) + '</td></tr>' : '') +
        '<tr><td style="padding:6px 0;font-weight:700;vertical-align:top;">Professor(a) que liberou:</td>' +
          '<td>' + esc(d.teacher) + '</td></tr>' +
      '</table>' +
      '<div style="font-size:12px;color:#444;line-height:1.6;margin-bottom:16px;">' +
      'Registro preliminar. Motivo, horário de saída e responsável constam no formulário oficial ' +
      'de liberação, sob este mesmo protocolo.</div>' +
      '<table style="width:100%;margin-top:72px;font-size:13px;text-align:center;border-collapse:collapse;">' +
        '<tr>' +
          '<td style="width:50%;padding:0 18px;vertical-align:bottom;">' +
            '<div style="border-top:1px solid #000;padding-top:6px;">' + esc(d.teacher) + '</div>' +
            '<div style="color:#444;font-size:12px;">Professor(a) solicitante</div></td>' +
          '<td style="width:50%;padding:0 18px;vertical-align:bottom;">' +
            '<div style="border-top:1px solid #000;padding-top:6px;">&nbsp;</div>' +
            '<div style="color:#444;font-size:12px;">Gestão — liberação recebida e aprovada</div></td>' +
        '</tr>' +
      '</table>' +
      '<div style="margin-top:40px;font-size:10px;color:#777;text-align:center;">' +
      'Documento gerado pelo Painel do Colaborador — Malu Serviços · ' + esc(d.dateStr) + ' ' + esc(d.timeStr) + '</div>';
  }

  /* ---------------- Exposição global (usada pelos onclick) ---------------- */
  window.openLiberacaoModal = openLiberacaoModal;
  window.closeLiberacaoModal = closeLiberacaoModal;
  window.closeLiberacaoFromOverlay = closeLiberacaoFromOverlay;
  window.showLiberacaoForm = showLiberacaoForm;
  window.generateLiberacao = generateLiberacao;
  window.enviarLiberacaoCompleta = enviarLiberacaoCompleta;
  window.fecharLibPopup = fecharLibPopup;
  window.printLiberacao = printLiberacao;
  window.updateLiberacaoResumo = updateLiberacaoResumo;

  /* ---------------- Boot ---------------- */
  function init() {
    if ($('liberacao-overlay')) return;
    injectCss();
    injectCard();
    injectModal();
    updateLiberacaoResumo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
