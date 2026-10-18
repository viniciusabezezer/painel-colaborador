/* Núcleo do app do professor: os dados em memória, guardar, rotas, avisos,
   diálogos e o despacho dos cliques ([data-acao]). Cada tela mora no seu
   arquivo e se registra aqui (PS.telas, PS.acoes). */
(function (global) {
    'use strict';

    const PS = {
        d: null,
        telas: {},
        acoes: {},
        atalhos: [],
        aoTrocarTela: [],
        $: (s, r) => (r || document).querySelector(s),
        $$: (s, r) => Array.from((r || document).querySelectorAll(s)),
        esc: Texto.esc,
        html: Texto.html,
        simples: Texto.simples
    };
    global.PS = PS;

    /* ----- guardar ----- */
    let tempoSalvar = null;
    let salvando = Promise.resolve();
    PS.salvar = function (agora) {
        clearTimeout(tempoSalvar);
        const fazer = () => {
            salvando = salvando.then(() => Armazem.salvar(PS.d)).catch(() => PS.avisar('Não foi possível guardar neste aparelho. Baixe uma cópia de segurança.'));
            return salvando;
        };
        if (agora) return fazer();
        tempoSalvar = setTimeout(fazer, 250);
        return salvando;
    };
    window.addEventListener('pagehide', () => { clearTimeout(tempoSalvar); Armazem.salvar(PS.d); });

    PS.tocar = function (item) {
        if (item) item.alterado = new Date().toISOString();
        PS.salvar();
    };

    /* ----- buscas rápidas ----- */
    PS.conjunto = (id) => PS.d.conjuntos.find((c) => c.id === id);
    PS.turma = (id) => PS.d.turmas.find((t) => t.id === id);
    PS.pasta = (id) => PS.d.pastas.find((p) => p.id === id);
    PS.pacote = (id) => PS.d.pacotes.find((p) => p.id === id);
    PS.aula = (id) => PS.d.aulas.find((a) => a.id === id);
    PS.alunosAtivos = (t) => t.alunos.filter((a) => !a.arquivado);
    PS.dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    PS.horaCurta = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    PS.plural = (n, um, varios) => `${n} ${n === 1 ? um : (varios || um + 's')}`;

    /* ----- avisos ----- */
    let tempoAviso = null;
    PS.avisar = function (texto, desfazer) {
        const a = PS.$('#aviso');
        a.innerHTML = PS.esc(texto) + (desfazer ? ' <button class="desfazer">Desfazer</button>' : '');
        a.hidden = false;
        if (desfazer) a.querySelector('.desfazer').onclick = () => { a.hidden = true; desfazer(); };
        clearTimeout(tempoAviso);
        tempoAviso = setTimeout(() => { a.hidden = true; }, desfazer ? 6000 : 3200);
    };

    /* ----- diálogos ----- */
    PS.dialogo = function (html, aoConfirmar, opcoes) {
        const o = opcoes || {};
        const dlg = PS.$('#dialogo');
        dlg.className = 'dialogo' + (o.largo ? ' largo' : '');
        dlg.innerHTML = `<form method="dialog">${html}
            <div class="dialogo-botoes">${o.semCancelar ? '' : '<button class="btn" value="nao">Cancelar</button>'}<button class="btn btn-principal" value="sim">${PS.esc(o.confirmar || 'Confirmar')}</button></div></form>`;
        const form = dlg.querySelector('form');
        form.addEventListener('submit', (e) => {
            if (e.submitter && e.submitter.value === 'sim' && aoConfirmar) {
                if (aoConfirmar(dlg) === false) e.preventDefault();
            }
        });
        if (o.aoAbrir) o.aoAbrir(dlg);
        dlg.showModal();
        const foco = dlg.querySelector('[autofocus], input, textarea, select');
        if (foco) foco.focus();
        return dlg;
    };
    PS.confirmar = (texto, aoConfirmar, detalhe) => PS.dialogo(`<h2>${PS.esc(texto)}</h2>${detalhe ? `<p class="sub">${PS.esc(detalhe)}</p>` : ''}`, aoConfirmar);
    PS.perguntar = (titulo, valor, aoConfirmar) => PS.dialogo(`<h2>${PS.esc(titulo)}</h2><input type="text" name="valor" value="${PS.esc(valor || '')}" maxlength="120" autofocus>`,
        (dlg) => { const v = dlg.querySelector('input').value.trim(); if (!v) return false; aoConfirmar(v); });

    PS.baixar = function (nome, texto, tipo) {
        const url = URL.createObjectURL(texto instanceof Blob ? texto : new Blob([texto], { type: tipo }));
        const a = document.createElement('a');
        a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    PS.escolherArquivo = function (aceita) {
        return new Promise((ok) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = aceita || '';
            input.onchange = () => ok(input.files[0] || null);
            input.click();
        });
    };

    PS.nomeArquivo = (t) => Dados.semAcento(t).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'provashow';

    /* ----- rotas ----- */
    PS.rota = function () {
        const partes = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/').map(decodeURIComponent);
        return { nome: partes[0], params: partes.slice(1) };
    };
    PS.ir = (hash) => { if (location.hash === '#' + hash) PS.desenhar(); else location.hash = hash; };

    const ABA_DA_TELA = {
        inicio: 'inicio', biblioteca: 'biblioteca', conjunto: 'biblioteca', busca: 'biblioteca', lixeira: 'biblioteca', pacotes: 'biblioteca', pacote: 'biblioteca', explorar: 'biblioteca',
        turmas: 'turmas', turma: 'turmas', aula: 'aula', relatorios: 'relatorios', aulas: 'relatorios', 'relatorio-aula': 'relatorios', 'relatorio-aluno': 'relatorios',
        sincronizar: 'mais', ajustes: 'mais', mais: 'mais'
    };

    PS.desenhar = function () {
        const r = PS.rota();
        const aba = ABA_DA_TELA[r.nome] || 'inicio';
        PS.$$('[data-aba]').forEach((a) => a.classList.toggle('ativa', a.dataset.aba === aba));
        PS.$$('.ponto-vivo').forEach((p) => { p.hidden = !PS.aulaViva; });
        document.body.dataset.tela = r.nome;
        PS.aoTrocarTela.forEach((f) => f(r));
        const tela = PS.telas[r.nome] || PS.telas.inicio;
        const conteudo = PS.$('#conteudo');
        conteudo.innerHTML = '';
        tela(...r.params);
    };
    window.addEventListener('hashchange', () => { PS.desenhar(); window.scrollTo(0, 0); });

    /* ----- cliques e atalhos ----- */
    document.addEventListener('click', (e) => {
        const mais = PS.$('#menu-mais');
        if (e.target.closest('#botao-mais')) {
            mais.hidden = !mais.hidden;
            PS.$('#botao-mais').setAttribute('aria-expanded', String(!mais.hidden));
            return;
        }
        if (mais && !e.target.closest('#menu-mais')) mais.hidden = true;
        const botao = e.target.closest('[data-acao]');
        if (!botao || botao.disabled) return;
        const f = PS.acoes[botao.dataset.acao];
        if (f) { e.preventDefault(); f(e, botao); }
    });

    document.addEventListener('keydown', (e) => {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
        const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || PS.$('#dialogo').open;
        if (digitando) return;
        for (const a of PS.atalhos) {
            if (a.tela && a.tela !== PS.rota().nome) continue;
            if (a.teclas.includes(e.key)) { e.preventDefault(); a.f(e); return; }
        }
    });

    /* ----- início ----- */
    PS.iniciar = async function () {
        PS.d = await Armazem.carregar();
        Dados.limparLixeira(PS.d);
        Armazem.aoMudarFora(async () => {
            if (PS.aulaViva) return; /* durante a aula, este aparelho manda */
            PS.d = await Armazem.carregar();
            if (!PS.$('#dialogo').open) PS.desenhar();
        });
        PS.prontos.forEach((f) => f());
        PS.desenhar();
        /* no app nativo (Capacitor) os arquivos já estão no aparelho: sem service worker */
        if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) navigator.serviceWorker.register('../sw.js').catch(() => {});
    };
    PS.prontos = [];

    /* Para os testes de navegador. */
    global.ProvaShowApp = { dados: () => PS.d, aula: () => PS.aulaViva };
})(typeof self !== 'undefined' ? self : this);
