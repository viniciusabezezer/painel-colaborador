/* Modo aluno: responder pelo próprio aparelho (aula remota ou híbrida).
   O link pessoal (?k=...) guarda a chave do aluno neste aparelho; em cada
   aula ele digita o código do telão (ou abre ?sala=...). As respostas
   entram na mesma pergunta que os cartões lidos na sala. O aluno vê só a
   própria resposta; o gráfico e a resposta certa aparecem quando o
   professor mostra. */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const esc = Texto.esc;
    const p = new URLSearchParams(location.search);
    const CHAVE = 'provashow-aluno-chave';
    const aparelho = Math.random().toString(36).slice(2, 10);
    const L = ['A', 'B', 'C', 'D'];

    let chave = p.get('k');
    try {
        if (chave) localStorage.setItem(CHAVE, chave);
        else chave = localStorage.getItem(CHAVE);
    } catch (erro) { /* sem armazenamento: vale só o link */ }
    if (p.get('k')) history.replaceState(null, '', location.pathname + (p.get('sala') ? '?sala=' + p.get('sala') : ''));

    const mostrar = (id) => ['sem-link', 'entrar', 'esperando', 'pergunta'].forEach((x) => { $('#' + x).hidden = x !== id; });

    if (!chave) { mostrar('sem-link'); return; }
    const codigo = Canal.normalizarCodigo(p.get('sala'));
    if (codigo.length < 6) {
        mostrar('entrar');
        $('#form-codigo').onsubmit = (e) => { e.preventDefault(); const c = Canal.normalizarCodigo($('#campo-codigo').value); if (c.length === 6) location.search = '?sala=' + c; };
        return;
    }

    mostrar('esperando');
    $('#esperando-texto').textContent = 'Aula ' + codigo;
    let eu = null;              /* { nome, cartao } quando o app reconhece a chave */
    let estado = null;
    let minha = null;           /* { questao, letra } */
    let confirmada = false;

    const canal = Canal.abrir(codigo, 'aluno', receber);
    const ola = () => canal.enviar('ola-aluno', { chave, aparelho });
    ola();
    setInterval(ola, 5000);

    function receber(tipo, d) {
        if (tipo === 'aluno-ok' && d && d.chave === chave) {
            if (!d.nome) { $('#esperando-titulo').textContent = 'Link não reconhecido nesta turma'; $('#esperando-texto').textContent = 'Confira com o professor se este é o seu link.'; return; }
            eu = { nome: d.nome, cartao: d.cartao };
            $('#quem').hidden = false;
            $('#quem').textContent = d.nome;
            if (!estado) { $('#esperando-titulo').textContent = 'Olá, ' + d.nome.split(' ')[0] + '!'; $('#esperando-texto').textContent = 'Espere a próxima pergunta.'; }
            return;
        }
        if (tipo === 'encerrada') { mostrar('esperando'); $('#esperando-titulo').textContent = 'Aula encerrada'; $('#esperando-texto').textContent = 'Até a próxima!'; return; }
        if (tipo !== 'estado' || !d || !d.questao || !d.aparelhos) {
            if (tipo === 'estado' && d && !d.aparelhos) { mostrar('esperando'); $('#esperando-titulo').textContent = 'Respostas pelo aparelho desligadas'; $('#esperando-texto').textContent = 'Use o seu cartão nesta aula.'; }
            return;
        }
        const chaveQ = d.questao.id + ':' + (d.questao.rodada || 0);
        if (!minha || minha.questao !== chaveQ) { minha = { questao: chaveQ, letra: null }; confirmada = false; }
        estado = d;
        if (eu && eu.cartao != null && d.respondidos.includes(eu.cartao)) confirmada = !!minha.letra || confirmada;
        desenhar();
    }

    function desenhar() {
        const q = estado.questao;
        mostrar('pergunta');
        $('#progresso').textContent = `${estado.conjunto} · ${estado.indice + 1}/${estado.total}`;
        $('#enunciado').innerHTML = Texto.html(q.enunciado);
        $('#midia').innerHTML = q.midia && q.midia.tipo === 'video' ? Midia.html(q.midia) : (q.temMidia ? '<p class="sub">Veja a imagem no telão.</p>' : '');
        const contagem = estado.contagem;
        const total = Math.max(1, (estado.respondidos || []).length);
        $('#botoes').innerHTML = q.opcoes.map((o, k) => {
            const l = L[k];
            const certa = estado.revelar && q.corretas.includes(l);
            const marcada = minha.letra === l;
            return `<button class="resposta letra-fundo-${l} ${marcada ? 'marcada' : ''} ${certa ? 'certa' : ''} ${estado.revelar && q.corretas.length && !certa ? 'apagada' : ''}" data-letra="${l}" ${estado.travada || estado.revelar ? 'disabled' : ''}>
                <span class="letra letra-${l}">${l}</span><span class="t">${Texto.html(o.texto)}</span>
                ${contagem ? `<span class="pct">${Math.round((contagem[l] || 0) / total * 100)}%</span>` : ''}
            </button>`;
        }).join('');
        let s = '';
        if (estado.revelar && q.corretas.length && minha.letra) s = q.corretas.includes(minha.letra) ? '🎉 Você acertou!' : `Resposta certa: ${q.corretas.join(', ')}`;
        else if (estado.travada) s = minha.letra ? `Respostas encerradas. Você respondeu ${minha.letra}.` : 'Respostas encerradas.';
        else if (minha.letra) s = confirmada ? `✓ Resposta ${minha.letra} recebida. Pode trocar até o professor encerrar.` : `Enviando ${minha.letra}…`;
        else s = 'Toque na sua resposta.';
        $('#situacao').textContent = s;
    }

    $('#botoes').addEventListener('click', (e) => {
        const b = e.target.closest('[data-letra]');
        if (!b || b.disabled) return;
        minha.letra = b.dataset.letra;
        confirmada = false;
        enviar();
        if (navigator.vibrate) navigator.vibrate(10);
        desenhar();
    });

    function enviar() {
        if (!estado || !minha || !minha.letra) return;
        canal.enviar('resposta-aluno', { chave, letra: minha.letra, questaoId: estado.questao.id, rodada: estado.questao.rodada || 0, aparelho });
    }
    /* reenvia até o app confirmar (se uma mensagem se perder pelo caminho) */
    setInterval(() => { if (minha && minha.letra && !confirmada && estado && !estado.travada) enviar(); }, 2000);
})();
