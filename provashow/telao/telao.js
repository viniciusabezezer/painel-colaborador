/* Telão do ProvaShow Malu: o que a turma vê no projetor. Só mostra; quem
   decide (pergunta, gráfico, resposta) é o app do professor. A chamada no
   rodapé mostra quem já respondeu, nunca o que cada um respondeu. */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const codigo = Canal.normalizarCodigo(new URLSearchParams(location.search).get('sala'));
    const aparelho = Math.random().toString(36).slice(2, 10);

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

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

    let ultimaImagem = '';

    function receber(tipo, e) {
        if (tipo === 'encerrada') {
            $('#palco').hidden = true;
            $('#espera').hidden = false;
            $('#espera-titulo').textContent = 'Aula encerrada';
            $('#espera-texto').textContent = 'Obrigado, turma!';
            return;
        }
        if (tipo !== 'estado' || !e || !e.questao) return;
        $('#espera').hidden = true;
        $('#palco').hidden = false;
        const q = e.questao;
        const alunos = e.turma.alunos;
        const naTurma = new Set(alunos.map((a) => a.cartao));
        const respondeu = new Set(Object.keys(e.respostas).map(Number).filter((c) => naTurma.has(c)));
        $('#t-turma').textContent = e.turma.nome;
        $('#t-progresso').textContent = `${e.conjunto} · ${e.indice + 1}/${e.total}`;
        $('#t-n').textContent = respondeu.size;
        $('#t-de').textContent = 'de ' + alunos.length;
        $('#t-enunciado').textContent = q.enunciado;
        /* imagem: a que veio pela via local; pela internet ela não vem */
        if (q.imagem) ultimaImagem = q.imagem;
        else if (!q.temImagem) ultimaImagem = '';
        const img = $('#t-imagem');
        img.hidden = !ultimaImagem;
        if (ultimaImagem && img.src !== ultimaImagem) img.src = ultimaImagem;

        const cont = {};
        q.opcoes.forEach((o, k) => { cont['ABCD'[k]] = 0; });
        Object.entries(e.respostas).forEach(([c, l]) => { if (naTurma.has(+c) && l in cont) cont[l]++; });
        const total = Math.max(1, respondeu.size);
        const mostrar = e.mostrarGrafico || e.revelar;
        $('#t-opcoes').className = 'opcoes' + (mostrar ? ' com-grafico' : '') + (q.opcoes.length <= 2 ? ' duas' : '');
        $('#t-opcoes').innerHTML = q.opcoes.map((o, k) => {
            const l = 'ABCD'[k];
            const certa = e.revelar && q.correta === l;
            const apagada = e.revelar && q.correta && !certa;
            const pct = Math.round(cont[l] / total * 100);
            return `<div class="opcao ${certa ? 'certa' : ''} ${apagada ? 'apagada' : ''}">
                <span class="letra letra-${l}">${l}</span>
                <span class="texto">${esc(o)}</span>
                ${mostrar ? `<span class="barra"><i class="letra-${l}" style="width:${pct}%"></i></span><span class="conta">${cont[l]}</span>` : ''}
                ${certa ? '<span class="selo-certa">✔ certa</span>' : ''}
            </div>`;
        }).join('');

        $('#t-chamada').innerHTML = alunos.slice().sort((a, b) => a.cartao - b.cartao).map((a) =>
            `<span class="chip ${respondeu.has(a.cartao) ? 'feito' : ''}" title="Cartão ${a.cartao}"><b>${a.cartao}</b> ${esc((a.nome || '').split(' ')[0])}</span>`).join('');
    }

    $('#tela-cheia').addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
    });
})();
