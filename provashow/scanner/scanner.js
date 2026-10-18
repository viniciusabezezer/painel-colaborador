/* Scanner do ProvaShow Malu: a câmera do celular (ou a webcam) lê os
   cartões e manda as respostas para o app do professor pelo canal da aula.

   Uma leitura só vale quando o mesmo cartão aparece com a mesma letra em
   dois quadros seguidos (ou num quadro sem nenhuma casa duvidosa): evita
   registrar o cartão no meio do giro. O aluno pode mudar de ideia; vale a
   última letra confirmada. Ao passar para a próxima pergunta, os cartões
   que ainda estão no ar com a resposta anterior ficam em espera até o aluno
   baixar o cartão (ou girar para outra letra). */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const parametros = new URLSearchParams(location.search);
    const codigo = Canal.normalizarCodigo(parametros.get('sala'));
    const aparelho = Math.random().toString(36).slice(2, 10);

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

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

    $('#tela-entrar').hidden = true;
    $('#tela-ler').hidden = false;

    let estado = null;
    let questaoId = null;
    let confirmadas = {};        /* cartao -> letra (desta pergunta) */
    let paraEnviar = {};
    const candidatos = new Map(); /* cartao -> { letra, vezes, quando } */
    const emEspera = new Map();   /* cartao -> { letra, visto } (resposta da pergunta anterior) */
    let ultimasLeituras = [];

    const canal = Canal.abrir(codigo, 'scanner', receber, (c) => {
        const t = { ligada: 'online', conectando: 'conectando…', falhou: 'sem internet', desligada: 'local' }[c.nuvem];
        $('#info-conexao').textContent = t;
        $('#info-conexao').className = 'selo ' + (c.nuvem === 'ligada' ? 'selo-verde' : 'selo-cinza');
    });
    const ola = () => canal.enviar('ola', { aparelho });
    ola();
    setInterval(ola, 4000);

    function receber(tipo, dados) {
        if (tipo === 'encerrada') {
            pararCamera();
            $('#tela-ler').hidden = true;
            $('#tela-fim').hidden = false;
            return;
        }
        if (tipo !== 'estado' || !dados || !dados.questao) return;
        if (dados.questao.id !== questaoId) {
            const agora = Date.now();
            emEspera.clear();
            if (questaoId) {
                for (const [cartao, c] of candidatos) if (agora - c.quando < 1500) emEspera.set(cartao, { letra: c.letra, visto: c.quando });
            }
            questaoId = dados.questao.id;
            confirmadas = {};
            paraEnviar = {};
            candidatos.clear();
        }
        estado = dados;
        desenharPainel();
    }

    /* ----- painel ----- */

    function respostasJuntas() {
        return Object.assign({}, estado ? estado.respostas : {}, confirmadas);
    }

    function desenharPainel() {
        if (!estado) return;
        const q = estado.questao;
        const respostas = respostasJuntas();
        const alunos = estado.turma.alunos;
        const naTurma = new Set(alunos.map((a) => a.cartao));
        const n = Object.keys(respostas).filter((c) => naTurma.has(+c)).length;
        $('#info-turma').textContent = estado.turma.nome;
        $('#info-pergunta').textContent = `Pergunta ${estado.indice + 1} de ${estado.total}`;
        $('#enunciado-mini').textContent = q.enunciado;
        $('#n-responderam').textContent = n;
        $('#n-total').textContent = 'de ' + alunos.length;
        $('#contador').hidden = false;
        $('#botao-grafico').classList.toggle('btn-principal', !!estado.mostrarGrafico);
        $('#botao-revelar').classList.toggle('btn-verde', !!estado.revelar);
        $('#botao-revelar').hidden = !q.correta;
        if (estado.mostrarGrafico || estado.revelar) {
            const cont = {};
            q.opcoes.forEach((o, k) => { cont['ABCD'[k]] = 0; });
            Object.values(respostas).forEach((l) => { if (l in cont) cont[l]++; });
            const maior = Math.max(1, ...Object.values(cont));
            $('#grafico-mini').innerHTML = Object.entries(cont).map(([l, v]) =>
                `<div class="g ${estado.revelar && q.correta === l ? 'certa' : ''}"><span class="letra letra-${l}">${l}</span><span class="barra"><i class="letra-${l}" style="width:${v / maior * 100}%"></i></span><b>${v}</b></div>`).join('');
        } else {
            $('#grafico-mini').innerHTML = '';
        }
        if (!$('#lista').hidden) desenharLista();
    }

    function desenharLista() {
        const respostas = respostasJuntas();
        const q = estado.questao;
        const alunos = estado.turma.alunos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        $('#lista').innerHTML = alunos.map((a) => {
            const r = respostas[a.cartao];
            const classe = !r ? 'falta' : (estado.revelar && q.correta ? (r === q.correta ? 'acertou' : 'errou') : 'ok');
            return `<div class="item ${classe}"><span class="n">${a.cartao}</span><span class="nome">${esc(a.nome)}</span><span class="r">${r ? (estado.mostrarGrafico || estado.revelar ? r : '✓') : '—'}</span></div>`;
        }).join('');
    }

    $('#botao-lista').addEventListener('click', () => {
        const lista = $('#lista');
        lista.hidden = !lista.hidden;
        $('#botao-lista').setAttribute('aria-expanded', String(!lista.hidden));
        if (!lista.hidden && estado) desenharLista();
    });

    document.querySelectorAll('[data-comando]').forEach((b) => b.addEventListener('click', () => {
        canal.enviar('comando', { acao: b.dataset.comando, aparelho });
    }));

    /* ----- câmera ----- */

    const video = $('#video');
    const sobre = $('#sobreposicao');
    const tela = document.createElement('canvas');
    const ctx = tela.getContext('2d', { willReadFrequently: true });
    let fluxo = null;
    let lendo = false;

    async function ligarCamera() {
        $('#texto-camera').textContent = 'Pedindo acesso à câmera…';
        try {
            fluxo = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            video.srcObject = fluxo;
            await video.play();
            $('#camera-aviso').hidden = true;
            lendo = true;
            requestAnimationFrame(ciclo);
        } catch (erro) {
            $('#texto-camera').textContent = window.isSecureContext
                ? 'Não consegui usar a câmera. Confira se o navegador tem permissão para a câmera e tente de novo.'
                : 'A câmera só funciona em endereço seguro (https).';
        }
    }

    function pararCamera() {
        lendo = false;
        if (fluxo) fluxo.getTracks().forEach((t) => t.stop());
    }

    $('#ligar-camera').addEventListener('click', ligarCamera);

    let ultimoQuadro = 0;
    function ciclo(agora) {
        if (!lendo) return;
        requestAnimationFrame(ciclo);
        if (agora - ultimoQuadro < 80 || !video.videoWidth) return;
        ultimoQuadro = agora;
        const escala = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        tela.width = Math.round(video.videoWidth * escala);
        tela.height = Math.round(video.videoHeight * escala);
        ctx.drawImage(video, 0, 0, tela.width, tela.height);
        const leituras = Leitor.lerQuadro(ctx.getImageData(0, 0, tela.width, tela.height));
        processar(leituras);
        desenharMarcas(leituras, escala);
    }

    function processar(leituras) {
        const agora = Date.now();
        let nova = false;
        for (const [cartao, e] of emEspera) if (agora - e.visto > 800) emEspera.delete(cartao);
        for (const l of leituras) {
            const espera = emEspera.get(l.cartao);
            if (espera) {
                if (espera.letra === l.letra) { espera.visto = agora; continue; }
                emEspera.delete(l.cartao);
            }
            const c = candidatos.get(l.cartao);
            const mesma = c && c.letra === l.letra && agora - c.quando < 1500;
            const vezes = (mesma ? c.vezes : 0) + (l.erros === 0 ? 2 : 1);
            candidatos.set(l.cartao, { letra: l.letra, vezes, quando: agora });
            if (vezes >= 2 && confirmadas[l.cartao] !== l.letra) {
                if (!estado || estado.turma.alunos.some((a) => a.cartao === l.cartao)) {
                    const valida = !estado || 'ABCD'.indexOf(l.letra) < estado.questao.opcoes.length;
                    if (valida) {
                        if (!confirmadas[l.cartao]) nova = true;
                        confirmadas[l.cartao] = l.letra;
                        paraEnviar[l.cartao] = l.letra;
                    }
                }
            }
        }
        ultimasLeituras = leituras;
        if (nova && navigator.vibrate) navigator.vibrate(12);
        if (Object.keys(paraEnviar).length) desenharPainel();
    }

    /* Manda as confirmadas em lotes; a cada 2 s repete todas (se uma
       mensagem se perder pelo caminho, a próxima corrige). */
    setInterval(() => {
        if (!questaoId || !Object.keys(paraEnviar).length) return;
        canal.enviar('respostas', { questaoId, respostas: paraEnviar, aparelho });
        paraEnviar = {};
    }, 250);
    setInterval(() => {
        if (questaoId && Object.keys(confirmadas).length) canal.enviar('respostas', { questaoId, respostas: confirmadas, aparelho });
    }, 2000);

    function desenharMarcas(leituras, escala) {
        const r = video.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        sobre.width = Math.round(r.width * dpr);
        sobre.height = Math.round(r.height * dpr);
        const g = sobre.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        /* o vídeo preenche a área (object-fit: cover): mesma conta aqui */
        const vw = video.videoWidth * escala, vh = video.videoHeight * escala;
        const k = Math.max(r.width / vw, r.height / vh);
        const ox = (r.width - vw * k) / 2, oy = (r.height - vh * k) / 2;
        const nomes = new Map(estado ? estado.turma.alunos.map((a) => [a.cartao, a.nome]) : []);
        for (const l of leituras) {
            const daTurma = !estado || nomes.has(l.cartao);
            const ok = confirmadas[l.cartao] === l.letra;
            const esperando = emEspera.has(l.cartao);
            g.beginPath();
            l.cantos.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, ox + x * k, oy + y * k));
            g.closePath();
            g.lineWidth = 4;
            g.strokeStyle = !daTurma || esperando ? 'rgba(200,200,200,.8)' : ok ? '#2ecc71' : '#f5b700';
            g.fillStyle = !daTurma || esperando ? 'rgba(120,120,120,.25)' : ok ? 'rgba(46,204,113,.28)' : 'rgba(245,183,0,.2)';
            g.fill();
            g.stroke();
            const cx = ox + l.centro[0] * k, cy = oy + l.centro[1] * k;
            const rotulo = !daTurma ? '#' + l.cartao + ' (sem aluno)' : esperando ? 'baixe o cartão' : (nomes.get(l.cartao) || '#' + l.cartao).split(' ')[0];
            g.font = '700 15px Outfit, system-ui, sans-serif';
            g.textAlign = 'center';
            const larg = g.measureText(rotulo).width + 14;
            g.fillStyle = 'rgba(28,22,48,.85)';
            g.fillRect(cx - larg / 2, cy - 30, larg, 22);
            g.fillStyle = '#fff';
            g.fillText(rotulo, cx, cy - 14);
            if (daTurma && !esperando) {
                g.font = '800 26px Outfit, system-ui, sans-serif';
                g.fillText(estado && !(estado.mostrarGrafico || estado.revelar) ? '✓' : l.letra, cx, cy + 16);
            }
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pararCamera();
        else if (fluxo && !lendo) ligarCamera();
    });

    /* Para os testes de navegador: lê uma imagem qualquer como se fosse da câmera. */
    window.ProvaShowScanner = {
        lerImagem(imagem) {
            const leituras = Leitor.lerQuadro(imagem);
            processar(leituras);
            return leituras;
        },
        confirmadas: () => Object.assign({}, confirmadas),
        estado: () => estado
    };
})();
