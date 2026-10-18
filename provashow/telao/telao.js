/* Telão do ProvaShow Malu: o que a turma vê no projetor. Só mostra; quem
   decide (pergunta, gráfico, resposta, cronômetro) é o app do professor.

   A chamada no rodapé segue o ajuste da aula: durante a leitura dos
   cartões, sempre ou nunca; com as respostas individuais escondidas (o
   normal) mostra só quem já respondeu. "Tela compartilhada" (S) esconde a
   chamada e a contagem — para projetar numa chamada de vídeo. F = tela cheia;
   clicar na imagem da pergunta amplia. */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const esc = Texto.esc;
    const parametros = new URLSearchParams(location.search);
    const codigo = Canal.normalizarCodigo(parametros.get('sala'));
    const aparelho = Math.random().toString(36).slice(2, 10);
    let compartilhar = parametros.get('compartilhar') === '1';

    if (codigo.length < 6) {
        $('#form-codigo').addEventListener('submit', (e) => {
            e.preventDefault();
            const c = Canal.normalizarCodigo($('#campo-codigo').value);
            if (c.length === 6) location.search = '?sala=' + c;
        });
        return;
    }
    $('#form-codigo').hidden = true;
    $('#espera-titulo').textContent = 'Aguardando o professor…';
    $('#espera-texto').textContent = 'Aula ' + codigo + '. A pergunta aparece aqui assim que o app do professor estiver aberto.';

    const canal = Canal.abrir(codigo, 'telao', receber);
    const ola = () => canal.enviar('ola', { aparelho });
    ola();
    setInterval(ola, 4000);

    let estado = null;
    let recebidoEm = 0;
    let ultimaMidia = null;
    let chaveSlide = '';
    let avisouFim = false;

    function receber(tipo, e) {
        if (tipo === 'encerrada') {
            $('#palco').hidden = true;
            $('#espera').hidden = false;
            $('#espera-titulo').textContent = 'Aula encerrada';
            $('#espera-texto').textContent = 'Obrigado, turma!';
            return;
        }
        if (tipo !== 'estado' || !e || !e.questao) return;
        if (!estado || estado.questao.id !== e.questao.id) avisouFim = false;
        estado = e;
        recebidoEm = Date.now();
        /* a mídia (imagem/áudio) só vem pela via local; pela internet vem só o vídeo */
        if (e.questao.midia && e.questao.midia.src) ultimaMidia = { id: e.questao.id, midia: e.questao.midia };
        else if (!e.questao.temMidia || (ultimaMidia && ultimaMidia.id !== e.questao.id)) ultimaMidia = null;
        desenhar();
    }

    function desenhar() {
        const e = estado;
        $('#espera').hidden = true;
        $('#palco').hidden = false;
        document.body.style.setProperty('--cor', e.turma.cor || '#4c2a85');
        document.body.classList.toggle('compartilhando', compartilhar);
        const alunos = e.turma.alunos;
        const respondeu = new Set(e.respondidos || []);
        $('#t-turma').textContent = e.turma.nome;
        $('#t-progresso').textContent = `${e.conjunto} · ${e.indice + 1}/${e.total}`;
        $('#t-n').textContent = respondeu.size;
        $('#t-de').textContent = 'de ' + alunos.length;
        $('#t-faixa').hidden = !e.travada;
        $('#t-faixa').textContent = '🔒 Respostas encerradas';
        $('#t-aparelho').hidden = !e.aparelhos || compartilhar;
        $('#t-aparelho').innerHTML = `Pelo aparelho: <b>${esc(new URL('../aluno/', location.href).host + new URL('../aluno/', location.href).pathname)}</b> · código <b>${esc(e.codigo)}</b>`;

        const q = Object.assign({}, e.questao, { midia: ultimaMidia ? ultimaMidia.midia : null });
        const total = respondeu.size;
        /* o vídeo não pode ser recriado a cada atualização (voltaria do início) */
        const chave = JSON.stringify([q.id, q.enunciado, q.opcoes, !!q.midia, q.layout, e.mostrarGrafico, e.revelar, e.contagem, q.corretas]);
        if (chave !== chaveSlide) {
            const video = $('#t-questao .midia-video');
            const mesmaQuestao = chaveSlide && JSON.parse(chaveSlide)[0] === q.id;
            $('#t-questao').innerHTML = Slide.html(q, { mostrarGrafico: e.mostrarGrafico, revelar: e.revelar, contagem: e.contagem || {}, total, tocar: true });
            if (video && mesmaQuestao) {
                const novo = $('#t-questao .midia-video');
                if (novo) novo.replaceWith(video);
            }
            chaveSlide = chave;
        }
        const mostrarLista = !compartilhar && (e.telao.lista === 'sempre' || (e.telao.lista === 'leitura' && e.lendo));
        $('#t-chamada').hidden = !mostrarLista;
        $('#t-chamada').innerHTML = alunos.slice().sort((a, b) => a.cartao - b.cartao).map((a) => {
            const r = (e.respostas || {})[a.cartao];
            let classe = respondeu.has(a.cartao) ? 'feito' : '';
            let letra = '';
            if (r && !e.telao.esconderRespostas && (e.revelar || e.mostrarGrafico)) {
                letra = ` <span class="letra letra-${r}">${r}</span>`;
                if (e.revelar && e.questao.corretas.length) classe += e.questao.corretas.includes(r) ? ' certo' : ' errado';
            }
            return `<span class="chip ${classe}" title="Cartão ${a.cartao}"><b>${a.cartao}</b> ${esc((a.nome || '').split(' ')[0])}${letra}</span>`;
        }).join('');
        relogio();
    }

    function relogio() {
        if (!estado) return;
        const c = estado.cronometro;
        const el = $('#t-relogio');
        const ativo = c && (c.rodando || c.decorrido > 0);
        el.hidden = !ativo;
        if (!ativo) return;
        const decorrido = c.decorrido + (c.rodando ? Date.now() - recebidoEm : 0);
        const ms = c.modo === 'regressivo' ? Math.max(0, c.segundos * 1000 - decorrido) : decorrido;
        const s = c.modo === 'regressivo' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
        el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        el.classList.toggle('acabando', c.modo === 'regressivo' && ms < 5000 && ms > 0);
        el.classList.toggle('zerado', c.modo === 'regressivo' && ms === 0);
        if (c.modo === 'regressivo' && ms === 0 && !avisouFim && c.rodando !== undefined) { avisouFim = true; bipeFinal(); }
    }
    setInterval(relogio, 250);

    function bipeFinal() {
        try {
            const a = new (window.AudioContext || window.webkitAudioContext)();
            [0, 0.25, 0.5].forEach((t) => {
                const o = a.createOscillator(), g = a.createGain();
                o.frequency.value = 880;
                g.gain.setValueAtTime(0.15, a.currentTime + t);
                g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t + 0.2);
                o.connect(g).connect(a.destination);
                o.start(a.currentTime + t); o.stop(a.currentTime + t + 0.22);
            });
        } catch (erro) { /* sem som */ }
    }

    function telaCheia() {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
    }
    function alternarCompartilhar() { compartilhar = !compartilhar; if (estado) desenhar(); }

    $('#tela-cheia').addEventListener('click', telaCheia);
    $('#modo-compartilhar').addEventListener('click', alternarCompartilhar);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') telaCheia();
        if (e.key === 's' || e.key === 'S') alternarCompartilhar();
        if (e.key === 'Escape') $('#ampliada').hidden = true;
    });
    document.addEventListener('click', (e) => {
        const img = e.target.closest('.palco-questao .midia-imagem, .palco-questao .opcao-imagem');
        if (img) { $('#ampliada').innerHTML = `<img src="${esc(img.src)}" alt="">`; $('#ampliada').hidden = false; return; }
        if (e.target.closest('#ampliada')) $('#ampliada').hidden = true;
    });
})();
