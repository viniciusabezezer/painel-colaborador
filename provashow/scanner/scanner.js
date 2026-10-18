/* Scanner do ProvaShow Malu: o celular como controle remoto da aula que
   está aberta no computador. Lê os cartões (Camera) e manda as respostas;
   comanda gráfico, resposta, cronômetro e troca de pergunta. O botão de
   ler/pausar decide quando o celular registra — e o telão mostra a
   chamada "durante a leitura" só enquanto algum celular está lendo. */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const esc = Texto.esc;
    const codigo = Canal.normalizarCodigo(new URLSearchParams(location.search).get('sala'));
    const aparelho = Math.random().toString(36).slice(2, 10);

    if (!codigo || codigo.length < 6) {
        $('#tela-entrar').hidden = false;
        if (codigo) $('#campo-codigo').value = codigo;
        $('#form-codigo').addEventListener('submit', (e) => {
            e.preventDefault();
            const c = Canal.normalizarCodigo($('#campo-codigo').value);
            if (c.length === 6) location.search = '?sala=' + c;
        });
        return;
    }
    $('#tela-ler').hidden = false;

    let estado = null;
    let recebidoEm = 0;
    let questaoId = null;
    let paraEnviar = {};
    let som = true;

    const camera = Camera.criar({
        video: $('#video'), sobreposicao: $('#sobreposicao'),
        alunos: () => (estado ? new Map(estado.turma.alunos.map((a) => [a.cartao, a.nome])) : null),
        alternativas: () => (estado ? estado.questao.opcoes.length : 4),
        mostrarLetras: () => !!(estado && (estado.mostrarGrafico || estado.revelar)),
        som: () => som,
        aoConfirmar: (cartao, letra) => { if (estado && estado.travada) return; paraEnviar[cartao] = letra; desenharPainel(); }
    });

    const canal = Canal.abrir(codigo, 'scanner', receber, (c) => {
        const t = { ligada: 'online', conectando: 'conectando…', falhou: 'sem internet', desligada: 'local' }[c.nuvem];
        $('#info-conexao').textContent = t;
        $('#info-conexao').className = 'selo ' + (c.nuvem === 'ligada' ? 'selo-verde' : 'selo-cinza');
    });
    const lendo = () => camera.ligada() && !camera.pausado();
    const ola = () => canal.enviar('ola', { aparelho, lendo: lendo() });
    ola();
    setInterval(ola, 4000);

    function receber(tipo, dados) {
        if (tipo === 'encerrada') {
            camera.desligar();
            $('#tela-ler').hidden = true;
            $('#tela-fim').hidden = false;
            return;
        }
        if (tipo === 'esquecer' && dados && estado && dados.questaoId === estado.questao.id) { camera.esquecer(dados.cartao); delete paraEnviar[dados.cartao]; return; }
        if (tipo !== 'estado' || !dados || !dados.questao) return;
        const chave = dados.questao.id + ':' + (dados.questao.rodada || 0);
        if (chave !== questaoId) {
            questaoId = chave;
            paraEnviar = {};
            camera.novaPergunta({});
        }
        estado = dados;
        recebidoEm = Date.now();
        desenharPainel();
    }

    function respondidos() {
        const s = new Set(estado ? estado.respondidos : []);
        Object.keys(camera.confirmadas()).forEach((c) => s.add(+c));
        return s;
    }

    function desenharPainel() {
        if (!estado) return;
        const q = estado.questao;
        const naTurma = new Set(estado.turma.alunos.map((a) => a.cartao));
        const n = [...respondidos()].filter((c) => naTurma.has(c)).length;
        $('#info-turma').textContent = estado.turma.nome;
        $('#info-pergunta').textContent = `Pergunta ${estado.indice + 1} de ${estado.total}`;
        $('#enunciado-mini').textContent = Texto.simples(q.enunciado);
        $('#n-responderam').textContent = n;
        $('#n-total').textContent = 'de ' + estado.turma.alunos.length;
        $('#contador').hidden = false;
        $('#faixa-travada').hidden = !estado.travada;
        $('#botao-grafico').classList.toggle('btn-principal', !!estado.mostrarGrafico);
        $('#botao-revelar').classList.toggle('btn-verde', !!estado.revelar);
        $('#botao-revelar').hidden = !q.avaliada;
        $('#botao-cronometro').classList.toggle('btn-principal', !!(estado.cronometro && estado.cronometro.rodando));
        if (estado.contagem) {
            const maior = Math.max(1, ...Object.values(estado.contagem));
            $('#grafico-mini').innerHTML = Object.entries(estado.contagem).map(([l, v]) =>
                `<div class="g ${estado.revelar && q.corretas.includes(l) ? 'certa' : ''}"><span class="letra letra-${l}">${l}</span><span class="barra"><i class="letra-${l}" style="width:${v / maior * 100}%"></i></span><b>${v}</b></div>`).join('');
        } else $('#grafico-mini').innerHTML = '';
        if (!$('#lista').hidden) desenharLista();
    }

    function desenharLista() {
        const meus = camera.confirmadas();
        const todas = Object.assign({}, estado.respostas, meus);
        const feitos = respondidos();
        const q = estado.questao;
        const abertas = estado.mostrarGrafico || estado.revelar;
        $('#lista').innerHTML = estado.turma.alunos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((a) => {
            const r = todas[a.cartao];
            const classe = !feitos.has(a.cartao) ? 'falta' : (estado.revelar && q.corretas.length && r ? (q.corretas.includes(r) ? 'acertou' : 'errou') : 'ok');
            return `<div class="item ${classe}"><span class="n">${a.cartao}</span><span class="nome">${esc(a.nome)}</span><span class="r">${feitos.has(a.cartao) ? (abertas && r ? r : '✓') : '—'}</span></div>`;
        }).join('');
    }

    function relogio() {
        const el = $('#info-relogio');
        const c = estado && estado.cronometro;
        if (!c || !(c.rodando || c.decorrido > 0)) { el.hidden = true; return; }
        el.hidden = false;
        const d = c.decorrido + (c.rodando ? Date.now() - recebidoEm : 0);
        const ms = c.modo === 'regressivo' ? Math.max(0, c.segundos * 1000 - d) : d;
        const s = c.modo === 'regressivo' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
        el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }
    setInterval(relogio, 250);

    $('#botao-lista').addEventListener('click', () => {
        const lista = $('#lista');
        lista.hidden = !lista.hidden;
        $('#botao-lista').setAttribute('aria-expanded', String(!lista.hidden));
        if (!lista.hidden && estado) desenharLista();
    });
    document.querySelectorAll('[data-comando]').forEach((b) => b.addEventListener('click', () => canal.enviar('comando', { acao: b.dataset.comando, aparelho })));

    /* câmera */
    async function ligar() {
        $('#texto-camera').textContent = 'Pedindo acesso à câmera…';
        try {
            const cap = await camera.ligar();
            $('#camera-aviso').hidden = true;
            $('#botao-ler').hidden = false;
            $('#ferramentas').hidden = false;
            $('#botao-lanterna').hidden = !cap.lanterna;
            if (cap.zoom) Object.assign($('#zoom'), { hidden: false, min: cap.zoom.min, max: cap.zoom.max, step: cap.zoom.passo, value: cap.zoom.min });
            ola();
        } catch (erro) {
            $('#texto-camera').textContent = window.isSecureContext
                ? 'Não consegui usar a câmera. Confira se o navegador tem permissão para a câmera e tente de novo.'
                : 'A câmera só funciona em endereço seguro (https).';
        }
    }
    $('#ligar-camera').addEventListener('click', ligar);
    $('#botao-ler').addEventListener('click', () => {
        camera.pausar(!camera.pausado());
        $('#botao-ler').textContent = camera.pausado() ? '▶ Ler cartões' : '⏸ Pausar leitura';
        $('#botao-ler').classList.toggle('pausado', camera.pausado());
        ola();
    });
    $('#botao-trocar').addEventListener('click', () => camera.trocarCamera());
    $('#botao-lanterna').addEventListener('click', async (e) => { e.currentTarget.classList.toggle('ativo'); await camera.lanterna(e.currentTarget.classList.contains('ativo')); });
    $('#zoom').addEventListener('input', (e) => camera.zoom(+e.target.value));

    /* manda as confirmadas em lotes; a cada 2 s repete todas (se uma mensagem se perder, a próxima corrige) */
    setInterval(() => {
        if (!questaoId || !estado || !Object.keys(paraEnviar).length) return;
        canal.enviar('respostas', { questaoId: estado.questao.id, rodada: estado.questao.rodada || 0, respostas: paraEnviar, aparelho });
        paraEnviar = {};
    }, 250);
    setInterval(() => {
        const todas = camera.confirmadas();
        if (questaoId && estado && Object.keys(todas).length && !estado.travada) canal.enviar('respostas', { questaoId: estado.questao.id, rodada: estado.questao.rodada || 0, respostas: todas, aparelho });
    }, 2000);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && camera.ligada()) { camera.desligar(); $('#camera-aviso').hidden = false; $('#texto-camera').textContent = 'Câmera desligada para economizar bateria.'; $('#ligar-camera').textContent = '📷 Religar a câmera'; }
    });

    /* testes: lê uma imagem qualquer como se fosse da câmera */
    window.ProvaShowScanner = { lerImagem: (img) => camera.lerImagem(img), confirmadas: () => camera.confirmadas(), estado: () => estado };
})();
