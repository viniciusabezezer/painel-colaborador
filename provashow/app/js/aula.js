/* Aula ao vivo. Este aparelho (computador ou celular) é quem manda: guarda
   as respostas, decide o que o telão mostra e repete o estado no canal da
   aula para o telão, os scanners e os alunos que respondem pelo aparelho.

   O que dá para fazer: ler os cartões aqui mesmo (câmera do celular ou
   webcam) ou com outros celulares (scanner), cronômetro livre ou
   regressivo, travar as respostas, gráfico e resposta certa, lista de
   alunos no telão (durante a leitura, sempre ou nunca) com ou sem as
   respostas individuais, lançar respostas à mão, respostas pelo aparelho
   (modo aluno, para aulas remotas ou híbridas) e atalhos de teclado. */
(function () {
    'use strict';
    const { esc } = PS;
    const L = Dados.LETRAS;
    const CHAVE_AULA = 'provashow-malu-aula';

    let aula = null;
    let canal = null;
    let conexao = { local: false, nuvem: 'desligada' };
    const aparelhos = new Map();      /* papel:id -> { papel, quando, lendo } */
    let pulso = null;
    let relogio = null;
    let camera = null;
    let cameraAberta = false;

    Object.defineProperty(PS, 'aulaViva', { get: () => aula });

    function guardar() {
        try {
            if (aula) localStorage.setItem(CHAVE_AULA, JSON.stringify(aula));
            else localStorage.removeItem(CHAVE_AULA);
        } catch (erro) { /* sem armazenamento */ }
    }

    const conjuntoDaAula = () => PS.conjunto(aula.conjuntoId);
    const turmaDaAula = () => PS.turma(aula.turmaId);
    const questaoCrua = () => conjuntoDaAula().questoes[aula.indice];
    function questaoApresentada() {
        const q = questaoCrua();
        const base = Object.assign({}, q, { corretas: Dados.corretasDe(q) });
        return conjuntoDaAula().embaralhar ? Dados.embaralhar(base, aula.id + q.id) : base;
    }
    function sessaoAtual() {
        const id = aula.sessoes[questaoCrua().id];
        return id ? PS.d.sessoes.find((s) => s.id === id) : null;
    }
    const respostasAtuais = () => { const s = sessaoAtual(); return s ? s.respostas : {}; };

    function garantirSessao() {
        let s = sessaoAtual();
        if (!s) {
            const q = questaoApresentada();
            s = {
                id: Dados.novoId(), aulaId: aula.id, turmaId: aula.turmaId, conjuntoId: aula.conjuntoId, questaoId: questaoCrua().id,
                conjuntoTitulo: conjuntoDaAula().titulo,
                questao: { enunciado: q.enunciado, opcoes: q.opcoes.map((o) => o.texto), corretas: q.corretas.slice(), tipo: q.tipo, temMidia: !!q.midia, ordem: q.ordem || null },
                respostas: {}, origem: {}, ignorada: false, data: new Date().toISOString(), alterado: new Date().toISOString()
            };
            PS.d.sessoes.push(s);
            aula.sessoes[questaoCrua().id] = s.id;
            guardar();
        }
        return s;
    }

    function descartarSeVazia(s) {
        if (s && !Object.keys(s.respostas).length) {
            PS.d.sessoes = PS.d.sessoes.filter((x) => x !== s);
            delete aula.sessoes[s.questaoId];
            guardar();
        }
    }

    /* ----- cronômetro ----- */
    const decorrido = () => { const c = aula.cronometro; return c.acumulado + (c.rodando ? Date.now() - c.inicio : 0); };
    function textoRelogio() {
        const c = aula.cronometro;
        const ms = c.modo === 'regressivo' ? Math.max(0, c.segundos * 1000 - decorrido()) : decorrido();
        const s = Math.ceil(ms / 1000 - (c.modo === 'regressivo' ? 0 : 0.999));
        return Math.floor(Math.max(0, s) / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0');
    }
    function cronometroNovo() {
        const cfg = PS.d.config.cronometro;
        return { modo: cfg.modo, segundos: cfg.segundos, inicio: null, acumulado: 0, rodando: false, avisou: false };
    }
    function tiquetaque() {
        if (!aula) return;
        const c = aula.cronometro;
        const r = PS.$('#relogio');
        if (r) { r.textContent = textoRelogio(); r.classList.toggle('acabando', c.modo === 'regressivo' && c.rodando && c.segundos * 1000 - decorrido() < 5000); }
        if (c.modo === 'regressivo' && c.rodando && decorrido() >= c.segundos * 1000 && !c.avisou) {
            c.avisou = true;
            c.acumulado = c.segundos * 1000;
            c.rodando = false;
            if (PS.d.config.cronometro.travarAoZerar) aula.travada = true;
            mudou();
            PS.avisar(aula.travada ? 'Tempo esgotado: respostas encerradas.' : 'Tempo esgotado.');
        }
    }

    /* ----- canal ----- */
    function ligarCanal() {
        if (canal) canal.fechar();
        canal = Canal.abrir(aula.codigo, 'app', receber, (c) => { conexao = c; atualizarConexao(); });
        clearInterval(pulso);
        pulso = setInterval(() => { enviarEstado(); atualizarConexao(); }, 3000);
        clearInterval(relogio);
        relogio = setInterval(tiquetaque, 250);
        enviarEstado();
    }

    function lendoAgora() {
        if (cameraAberta && camera && camera.ligada() && !camera.pausado()) return true;
        const agora = Date.now();
        for (const v of aparelhos.values()) if (v.papel === 'scanner' && v.lendo && agora - v.quando < 12000) return true;
        return false;
    }

    function estado(paraNuvem) {
        const t = turmaDaAula(), c = conjuntoDaAula(), q = questaoApresentada();
        const respostas = respostasAtuais();
        const naTurma = new Set(PS.alunosAtivos(t).map((a) => a.cartao));
        const abertas = aula.mostrarGrafico || aula.revelar;
        const tiraImagem = (src) => (paraNuvem && /^data:/.test(src || '') ? '' : src);
        const midia = q.midia ? Object.assign({}, q.midia, { src: tiraImagem(q.midia.src) }) : null;
        const contagem = {};
        q.opcoes.forEach((o, k) => { contagem[L[k]] = 0; });
        Object.entries(respostas).forEach(([cartao, l]) => { if (naTurma.has(+cartao) && l in contagem) contagem[l]++; });
        return {
            codigo: aula.codigo, aulaId: aula.id,
            /* pelo canal vai só o primeiro nome e a inicial do sobrenome */
            turma: { nome: t.nome, cor: t.cor, alunos: PS.alunosAtivos(t).map((a) => ({ cartao: a.cartao, nome: abreviar(a.nome) || 'Cartão ' + a.cartao })) },
            conjunto: c.titulo, indice: aula.indice, total: c.questoes.length,
            questao: {
                id: questaoCrua().id, rodada: aula.rodada || 0, enunciado: q.enunciado, layout: q.layout, midia, temMidia: !!q.midia,
                opcoes: q.opcoes.map((o) => ({ texto: o.texto, imagem: tiraImagem(o.imagem) })),
                avaliada: q.corretas.length > 0, corretas: aula.revelar ? q.corretas : []
            },
            respondidos: Object.keys(respostas).map(Number).filter((n) => naTurma.has(n)),
            respostas: abertas ? respostas : {},
            contagem: abertas ? contagem : null,
            mostrarGrafico: aula.mostrarGrafico, revelar: aula.revelar, travada: !!aula.travada,
            lendo: lendoAgora(),
            cronometro: Object.assign({}, aula.cronometro, { decorrido: decorrido(), enviado: Date.now() }),
            telao: aula.telao, aparelhos: aula.aceitarAparelhos
        };
    }

    function abreviar(nome) {
        const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
        return partes.length > 1 ? partes[0] + ' ' + partes[partes.length - 1][0] + '.' : (partes[0] || '');
    }

    function enviarEstado() {
        if (!canal || !aula || !conjuntoDaAula() || !turmaDaAula()) return;
        canal.enviar('estado', estado(false), { paraNuvem: estado(true) });
    }

    function receber(tipo, dados, papel) {
        if (!aula) return;
        if (dados && dados.aparelho) {
            const antes = aparelhos.get(papel + ':' + dados.aparelho) || {};
            aparelhos.set(papel + ':' + dados.aparelho, { papel, quando: Date.now(), lendo: 'lendo' in dados ? !!dados.lendo : antes.lendo });
        }
        if (tipo === 'ola') { enviarEstado(); atualizarConexao(); return; }
        if (tipo === 'lendo') { mudou(true); return; }
        if (tipo === 'respostas' && dados && dados.respostas) {
            if (dados.questaoId && dados.questaoId !== questaoCrua().id) return;
            if ((dados.rodada || 0) !== (aula.rodada || 0) || aula.travada) return;
            receberRespostas(dados.respostas, 'cartao');
            return;
        }
        if (tipo === 'ola-aluno' && dados && dados.chave) {
            const a = PS.alunosAtivos(turmaDaAula()).find((x) => x.chave === dados.chave);
            canal.enviar('aluno-ok', { chave: dados.chave, nome: a ? abreviar(a.nome) : null, cartao: a ? a.cartao : null, turma: turmaDaAula().nome });
            if (a) enviarEstado();
            return;
        }
        if (tipo === 'resposta-aluno' && dados && dados.chave) {
            if (!aula.aceitarAparelhos || aula.travada || dados.questaoId !== questaoCrua().id || (dados.rodada || 0) !== (aula.rodada || 0)) return;
            const a = PS.alunosAtivos(turmaDaAula()).find((x) => x.chave === dados.chave);
            if (a) receberRespostas({ [a.cartao]: dados.letra }, 'aparelho');
            return;
        }
        if (tipo === 'comando' && dados) {
            const mapa = { grafico: 'aula-grafico', revelar: 'aula-revelar', proxima: 'aula-proxima', anterior: 'aula-anterior', cronometro: 'aula-cronometro' };
            if (mapa[dados.acao]) PS.acoes[mapa[dados.acao]]();
        }
    }

    function receberRespostas(lote, origem) {
        const t = turmaDaAula();
        const s = garantirSessao();
        let mudouAlgo = false;
        for (const [cartao, letra] of Object.entries(lote)) {
            /* o que o professor lançou à mão não é desfeito pelo reenvio dos scanners */
            if (origem === 'cartao' && s.origem && s.origem[cartao] === 'manual') continue;
            if (s.respostas[cartao] !== letra && Dados.registrarResposta(s, t, cartao, letra, origem)) mudouAlgo = true;
        }
        descartarSeVazia(s);
        if (mudouAlgo) { PS.salvar(); mudou(); }
    }

    /* ----- começar e terminar ----- */
    PS.comecarAula = function (turmaId, conjuntoId) {
        const t = PS.turma(turmaId), c = PS.conjunto(conjuntoId);
        if (!t || !c) return;
        if (!c.questoes.length) { PS.avisar('Esse conjunto não tem perguntas.'); return; }
        if (!PS.alunosAtivos(t).length) { PS.avisar('Cadastre os alunos da turma antes de começar.'); PS.ir('turma/' + t.id + '/alunos'); return; }
        if (aula) fecharRegistroDaAula();
        const codigo = aula ? aula.codigo : Canal.novoCodigo();
        const id = Dados.novoId();
        PS.d.aulas.push({ id, turmaId, conjuntoId, titulo: c.titulo, inicio: new Date().toISOString(), fim: null, alterado: new Date().toISOString() });
        aula = {
            id, codigo, turmaId, conjuntoId, indice: 0, mostrarGrafico: false, revelar: false, travada: false,
            cronometro: cronometroNovo(), telao: Object.assign({}, PS.d.config.telao), aceitarAparelhos: true, sessoes: {}
        };
        guardar();
        PS.salvar();
        ligarCanal();
        if (camera) camera.novaPergunta({});
        PS.ir('aula');
    };

    PS.escolherTurmaParaApresentar = function (c) {
        const turmas = Dados.ativos(PS.d.turmas).filter((t) => !t.arquivada);
        if (!turmas.length) { PS.avisar('Crie uma turma primeiro.'); return; }
        if (turmas.length === 1) { PS.comecarAula(turmas[0].id, c.id); return; }
        PS.dialogo(`<h2>Apresentar “${esc(c.titulo)}” para:</h2><div class="lista-marcar">${turmas.map((t, i) => `<label><input type="radio" name="turma" value="${t.id}" ${i === 0 ? 'checked' : ''}> <span class="bolinha" style="--cor:${t.cor}"></span> ${esc(t.nome)} <small>(${PS.alunosAtivos(t).length})</small></label>`).join('')}</div>`,
            (dlg) => PS.comecarAula(dlg.querySelector('input:checked').value, c.id), { confirmar: '▶ Começar' });
    };

    function fecharRegistroDaAula() {
        const registro = PS.aula(aula.id);
        const temRespostas = PS.d.sessoes.some((s) => s.aulaId === aula.id);
        if (registro) {
            if (!temRespostas) PS.d.aulas = PS.d.aulas.filter((a) => a !== registro);
            else { registro.fim = new Date().toISOString(); registro.alterado = registro.fim; }
        }
        return temRespostas;
    }

    function encerrar(tirarDaFila) {
        const id = aula.id;
        const t = turmaDaAula();
        if (tirarDaFila && t) { t.fila = t.fila.filter((x) => x !== aula.conjuntoId); PS.tocar(t); }
        const teveRespostas = fecharRegistroDaAula();
        if (canal) { canal.enviar('encerrada', {}); canal.fechar(); }
        canal = null;
        clearInterval(pulso); clearInterval(relogio);
        fecharCamera();
        aula = null;
        guardar();
        aparelhos.clear();
        PS.salvar(true);
        PS.ir(teveRespostas ? 'relatorio-aula/' + id : 'aula');
    }

    function irPara(i) {
        const c = conjuntoDaAula();
        if (i < 0 || i >= c.questoes.length) return;
        aula.indice = i;
        aula.mostrarGrafico = false;
        aula.revelar = false;
        aula.travada = false;
        aula.rodada = 0;
        aula.cronometro = cronometroNovo();
        if (camera) camera.novaPergunta(respostasAtuais());
        mudou();
    }

    function mudou(soEstado) {
        guardar();
        enviarEstado();
        if (!soEstado && PS.rota().nome === 'aula') desenharAula();
        else if (PS.rota().nome === 'aula') atualizarConexao();
    }

    /* ----- câmera embutida ----- */
    function abrirCamera() {
        const video = PS.$('#aula-video');
        if (!video) return;
        camera = Camera.criar({
            video, sobreposicao: PS.$('#aula-sobre'),
            alunos: () => new Map(PS.alunosAtivos(turmaDaAula()).map((a) => [a.cartao, a.nome])),
            alternativas: () => questaoCrua().opcoes.length,
            mostrarLetras: () => aula.mostrarGrafico || aula.revelar,
            som: () => PS.d.config.leitura.som,
            aoConfirmar: (cartao, letra) => { if (!aula.travada) receberRespostas({ [cartao]: letra }, 'cartao'); }
        });
        camera.novaPergunta(respostasAtuais());
        cameraAberta = true;
        camera.ligar().then((cap) => {
            PS.$('#camera-aviso').hidden = true;
            const lan = PS.$('#botao-lanterna');
            if (lan) lan.hidden = !cap.lanterna;
            const z = PS.$('#zoom-camera');
            if (z && cap.zoom) { z.hidden = false; z.min = cap.zoom.min; z.max = cap.zoom.max; z.step = cap.zoom.passo; z.value = cap.zoom.min; }
            mudou(true);
        }).catch(() => {
            const aviso = PS.$('#camera-aviso');
            if (aviso) { aviso.hidden = false; aviso.querySelector('p').textContent = window.isSecureContext ? 'Não consegui usar a câmera. Confira a permissão do navegador.' : 'A câmera só funciona em endereço seguro (https).'; }
        });
    }
    function fecharCamera() {
        if (camera) camera.desligar();
        camera = null;
        cameraAberta = false;
    }

    /* ----- telas ----- */
    PS.telas.aula = function () {
        if (!aula) { telaEscolher(); return; }
        desenharAula();
    };

    function telaEscolher() {
        const turmas = Dados.ativos(PS.d.turmas).filter((t) => !t.arquivada);
        PS.$('#conteudo').innerHTML = `
            <div class="cabeca"><div><h1>Aula ao vivo</h1>
            <p class="sub">Escolha a turma e o que apresentar. O telão mostra a pergunta; você lê os cartões com este aparelho (ou com outro celular) e as respostas aparecem na hora.</p></div></div>
            ${!turmas.length ? '<p class="vazio">Crie uma turma primeiro, em <a href="#turmas">Turmas</a>.</p>' : `<div class="grade-cartoes">${turmas.map((t) => {
                const fila = t.fila.map(PS.conjunto).filter((c) => c && !c.removido);
                return `<section class="cartao-painel escolher-turma" style="--cor:${t.cor}">
                    <h3>${esc(t.nome)}</h3><small>${PS.plural(PS.alunosAtivos(t).length, 'aluno')}</small>
                    <div class="lista-comecar">${fila.map((c) => `<div class="linha-comecar"><div><strong>${esc(c.titulo)}</strong><small>${PS.plural(c.questoes.length, 'pergunta')}</small></div>
                        <button class="btn btn-verde btn-p" data-acao="comecar-aula" data-turma="${t.id}" data-conjunto="${c.id}">▶ Começar</button></div>`).join('') || '<p class="vazio">Fila vazia.</p>'}</div>
                    <button class="btn btn-p" data-acao="comecar-outro" data-turma="${t.id}">Outro conjunto da biblioteca…</button>
                </section>`;
            }).join('')}</div>`}`;
    }

    function desenharAula() {
        const t = turmaDaAula(), c = conjuntoDaAula();
        if (!t || !c || !c.questoes[aula.indice]) { encerrar(false); return; }
        const q = questaoApresentada();
        const respostas = respostasAtuais();
        const ativos = PS.alunosAtivos(t).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        const naTurma = new Set(ativos.map((a) => a.cartao));
        const n = Object.keys(respostas).filter((x) => naTurma.has(+x)).length;
        const contagem = {};
        q.opcoes.forEach((o, k) => { contagem[L[k]] = 0; });
        Object.entries(respostas).forEach(([cartao, l]) => { if (naTurma.has(+cartao) && l in contagem) contagem[l]++; });
        const cron = aula.cronometro;
        const conteudo = PS.$('#conteudo');
        if (!PS.$(`.aula[data-aula="${aula.id}"]`)) {
            if (cameraAberta) fecharCamera();
            conteudo.innerHTML = `
            <div class="aula" data-aula="${aula.id}">
                <div class="aula-cabeca">
                    <div><span class="selo selo-vivo">● AO VIVO · ${esc(t.nome)}</span><h1>${esc(c.titulo)}</h1></div>
                    <div class="botoes">
                        <button class="btn" data-acao="aula-telao" title="Abrir o telão nesta tela ou noutra janela">🖥 Telão</button>
                        <button class="btn btn-p btn-icone" data-acao="aula-ajustes" title="Ajustes do telão e da aula">⚙</button>
                        <button class="btn btn-perigo" data-acao="aula-encerrar">Encerrar</button>
                    </div>
                </div>
                <div class="aula-corpo">
                    <section class="aula-principal">
                        <div id="lugar-camera"></div>
                        <div class="cartao-painel aula-questao" id="aula-questao"></div>
                    </section>
                    <aside class="aula-lado" id="aula-lado"></aside>
                </div>
            </div>`;
        }
        PS.$('.aula').style.setProperty('--cor', t.cor);
        PS.$('#aula-questao').innerHTML = `
                            <div class="aula-nav">
                                <button class="btn btn-p" data-acao="aula-anterior" ${aula.indice === 0 ? 'disabled' : ''} aria-label="Pergunta anterior">←</button>
                                <div class="pontos">${c.questoes.map((x, i) => `<button class="pontinho ${i === aula.indice ? 'atual' : ''} ${aula.sessoes[x.id] ? 'feita' : ''}" data-acao="aula-ir" data-indice="${i}" title="Pergunta ${i + 1}">${i + 1}</button>`).join('')}</div>
                                <button class="btn btn-p" data-acao="aula-proxima" ${aula.indice === c.questoes.length - 1 ? 'disabled' : ''} aria-label="Próxima pergunta">→</button>
                            </div>
                            <div class="slide-app">${Slide.html(q, { mostrarGrafico: aula.mostrarGrafico, revelar: aula.revelar, contagem, total: n })}</div>
                            <div class="aula-controles">
                                <button class="btn btn-grande-leitura ${cameraAberta && camera && !camera.pausado() ? 'lendo' : ''}" data-acao="aula-ler">${!cameraAberta ? '📷 Ler cartões aqui' : camera && camera.pausado() ? '▶ Continuar leitura' : '⏸ Pausar leitura'}</button>
                                <button class="btn ${aula.mostrarGrafico ? 'btn-principal' : ''}" data-acao="aula-grafico" title="Atalho: G">📊 ${aula.mostrarGrafico ? 'Esconder gráfico' : 'Gráfico'}</button>
                                ${q.corretas.length ? `<button class="btn ${aula.revelar ? 'btn-verde' : ''}" data-acao="aula-revelar" title="Atalho: R">✔ ${aula.revelar ? 'Esconder resposta' : 'Revelar resposta'}</button>` : '<span class="selo selo-cinza">Enquete</span>'}
                                <div class="cronometro ${cron.rodando ? 'rodando' : ''}">
                                    <button class="btn btn-p" data-acao="aula-cronometro" title="Iniciar/pausar (atalho: T)">${cron.rodando ? '⏸' : '⏱'}</button>
                                    <span id="relogio" class="relogio">${textoRelogio()}</span>
                                    <button class="btn btn-p btn-icone" data-acao="aula-cronometro-zerar" title="Zerar">↺</button>
                                    <select id="modo-cronometro" aria-label="Modo do cronômetro"><option value="livre" ${cron.modo === 'livre' ? 'selected' : ''}>Cronômetro</option>${[15, 30, 45, 60, 90, 120, 180, 300].map((x) => `<option value="${x}" ${cron.modo === 'regressivo' && cron.segundos === x ? 'selected' : ''}>Contagem ${Midia.tempo(x)}</option>`).join('')}</select>
                                </div>
                                <button class="btn btn-p ${aula.travada ? 'btn-principal' : ''}" data-acao="aula-travar" title="Parar de aceitar respostas">${aula.travada ? '🔒 Respostas encerradas' : '🔓 Aceitando respostas'}</button>
                                <button class="btn btn-p btn-perigo" data-acao="aula-limpar" ${sessaoAtual() ? '' : 'disabled'}>Ler de novo</button>
                            </div>`;
        const s = sessaoAtual();
        const via = (cartao) => { const o = s && s.origem ? s.origem[cartao] : ''; return o === 'aparelho' ? ' 📱' : o === 'manual' ? ' ✋' : ''; };
        PS.$('#aula-lado').innerHTML = `
                        <section class="cartao-painel">
                            <div class="secao-topo"><h3>Responderam</h3><span class="selo ${n === ativos.length ? 'selo-verde' : ''}" id="contagem-aula">${n} de ${ativos.length}</span></div>
                            <div class="progresso-barra"><i style="width:${ativos.length ? n / ativos.length * 100 : 0}%"></i></div>
                            <p class="sub">Toque num aluno para lançar ou trocar a resposta à mão.</p>
                            <div class="chamada">${ativos.map((a) => {
                                const r = respostas[a.cartao];
                                const classe = !r ? '' : (aula.revelar && q.corretas.length ? (q.corretas.includes(r) ? 'acertou' : 'errou') : 'respondeu');
                                return `<button class="aluno ${classe}" data-acao="aula-resposta-manual" data-cartao="${a.cartao}" title="Cartão ${a.cartao}">
                                    <span class="n">${a.cartao}</span><span class="nome">${esc(a.nome || 'Cartão ' + a.cartao)}${via(a.cartao)}</span>${r ? `<span class="r letra-${r}">${aula.mostrarGrafico || aula.revelar ? r : '✓'}</span>` : ''}
                                </button>`;
                            }).join('')}</div>
                        </section>
                        <section class="cartao-painel ligar">
                            <h3>Conectar aparelhos</h3>
                            <div class="ligar-corpo">
                                <div class="qr">${qrSvg(new URL('../scanner/?sala=' + aula.codigo, location.href).href)}</div>
                                <div><p><strong>Outro celular lendo os cartões:</strong> aponte a câmera para o código ou abra o scanner e digite</p><p class="codigo-aula">${aula.codigo}</p></div>
                            </div>
                            <p class="sub">${aula.aceitarAparelhos ? `<strong>Alunos pelo aparelho:</strong> abrem o link pessoal (em Turmas → Alunos) ou <strong>${esc(new URL('../aluno/', location.href).href)}</strong> com o mesmo código.` : 'Respostas pelo aparelho dos alunos: desligadas (⚙).'}</p>
                            <div class="conexao" id="conexao"></div>
                        </section>
                        <p class="dica-atalhos">Atalhos: <kbd>←</kbd> <kbd>→</kbd> perguntas · <kbd>G</kbd> gráfico · <kbd>R</kbd> resposta · <kbd>T</kbd> cronômetro · <kbd>L</kbd> ler/pausar</p>`;
        PS.$('#modo-cronometro').onchange = (e) => {
            const v = e.target.value;
            aula.cronometro = Object.assign(cronometroNovo(), v === 'livre' ? { modo: 'livre' } : { modo: 'regressivo', segundos: +v });
            PS.d.config.cronometro.modo = aula.cronometro.modo;
            PS.d.config.cronometro.segundos = aula.cronometro.segundos;
            PS.salvar();
            mudou();
        };
        atualizarConexao();
    }

    function blocoCamera() {
        return `<div class="aula-camera cartao-painel" id="aula-camera">
            <div class="camera-quadro"><video id="aula-video" playsinline muted autoplay></video><canvas id="aula-sobre"></canvas>
                <div class="camera-aviso" id="camera-aviso"><p>Ligando a câmera…</p></div></div>
            <div class="camera-botoes">
                <button class="btn btn-p" data-acao="camera-trocar" title="Câmera da frente/de trás">🔄</button>
                <button class="btn btn-p" data-acao="camera-lanterna" id="botao-lanterna" hidden title="Lanterna">🔦</button>
                <input type="range" id="zoom-camera" hidden aria-label="Zoom">
                <button class="btn btn-p" data-acao="camera-som" title="Bipe a cada cartão">${PS.d.config.leitura.som ? '🔔' : '🔕'}</button>
                <button class="btn btn-p btn-perigo" data-acao="camera-fechar">Fechar câmera</button>
            </div>
        </div>`;
    }

    function qrSvg(texto) {
        try { const qr = qrcode(0, 'M'); qr.addData(texto); qr.make(); return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (erro) { return ''; }
    }

    function aparelhosLigados(papel) {
        const agora = Date.now();
        let n = 0;
        for (const [chave, v] of aparelhos) {
            if (agora - v.quando > 12000) aparelhos.delete(chave);
            else if (v.papel === papel) n++;
        }
        return n;
    }

    function atualizarConexao() {
        const caixa = PS.$('#conexao');
        if (!caixa) return;
        const nuvem = { ligada: 'internet ligada', conectando: 'conectando…', falhou: 'sem internet (só neste aparelho)', desligada: 'só neste aparelho' }[conexao.nuvem];
        const sc = aparelhosLigados('scanner'), tl = aparelhosLigados('telao'), al = aparelhosLigados('aluno');
        caixa.innerHTML = `<span class="selo ${conexao.nuvem === 'ligada' ? 'selo-verde' : 'selo-cinza'}">● ${nuvem}</span>
            <span class="selo ${sc ? 'selo-verde' : 'selo-cinza'}">📱 ${PS.plural(sc, 'scanner')}</span>
            <span class="selo ${tl ? 'selo-verde' : 'selo-cinza'}">🖥 ${tl} ${tl === 1 ? 'telão' : 'telões'}</span>
            ${aula.aceitarAparelhos ? `<span class="selo ${al ? 'selo-verde' : 'selo-cinza'}">🙋 ${PS.plural(al, 'aluno')} no aparelho</span>` : ''}`;
    }

    function respostaManual(cartao) {
        const t = turmaDaAula();
        const a = PS.alunosAtivos(t).find((x) => x.cartao === cartao);
        const q = questaoApresentada();
        const atual = respostasAtuais()[cartao];
        PS.dialogo(`<h2>${esc(a.nome || 'Cartão ' + cartao)}</h2><p class="sub">Lançar a resposta à mão (por exemplo, aluno sem cartão).</p>
            <div class="escolher-letra">${q.opcoes.map((o, k) => `<label class="${atual === L[k] ? 'marcada' : ''}"><input type="radio" name="letra" value="${L[k]}" ${atual === L[k] ? 'checked' : ''}><span class="letra letra-${L[k]}">${L[k]}</span> ${PS.html(o.texto)}</label>`).join('')}
            <label><input type="radio" name="letra" value="" ${!atual ? 'checked' : ''}> Sem resposta</label></div>`, (dlg) => {
            const l = (dlg.querySelector('input:checked') || {}).value;
            const s = garantirSessao();
            if (l) Dados.registrarResposta(s, t, cartao, l, 'manual');
            else Dados.apagarResposta(s, cartao);
            if (camera) camera.esquecer(cartao);
            if (canal) canal.enviar('esquecer', { questaoId: questaoCrua().id, cartao });
            descartarSeVazia(s);
            PS.salvar(); mudou();
        }, { confirmar: 'Salvar' });
    }

    function ajustes() {
        const cfg = PS.d.config;
        PS.dialogo(`<h2>Ajustes da aula</h2>
            <label for="aj-lista">Lista de alunos no telão</label>
            <select id="aj-lista"><option value="leitura">Só durante a leitura dos cartões</option><option value="sempre">Sempre</option><option value="nunca">Nunca</option></select>
            <label class="interruptor"><input type="checkbox" id="aj-esconder" ${aula.telao.esconderRespostas ? 'checked' : ''}> Esconder as respostas individuais no telão (mesmo ao revelar)</label>
            <label class="interruptor"><input type="checkbox" id="aj-aparelhos" ${aula.aceitarAparelhos ? 'checked' : ''}> Aceitar respostas pelo aparelho dos alunos (aula remota/híbrida)</label>
            <label class="interruptor"><input type="checkbox" id="aj-travar" ${cfg.cronometro.travarAoZerar ? 'checked' : ''}> Encerrar as respostas quando a contagem regressiva zerar</label>
            <label class="interruptor"><input type="checkbox" id="aj-som" ${cfg.leitura.som ? 'checked' : ''}> Bipe a cada cartão lido</label>
            <p class="sub">Estes ajustes ficam guardados para as próximas aulas.</p>`, (dlg) => {
            aula.telao = { lista: dlg.querySelector('#aj-lista').value, esconderRespostas: dlg.querySelector('#aj-esconder').checked };
            aula.aceitarAparelhos = dlg.querySelector('#aj-aparelhos').checked;
            cfg.telao = Object.assign({}, aula.telao);
            cfg.cronometro.travarAoZerar = dlg.querySelector('#aj-travar').checked;
            cfg.leitura.som = dlg.querySelector('#aj-som').checked;
            PS.salvar(); mudou();
        }, { aoAbrir: (dlg) => { dlg.querySelector('#aj-lista').value = aula.telao.lista; }, confirmar: 'Salvar' });
    }

    Object.assign(PS.acoes, {
        'comecar-aula': (e, b) => PS.comecarAula(b.dataset.turma, b.dataset.conjunto),
        'comecar-outro': (e, b) => {
            const todos = Dados.ativos(PS.d.conjuntos).sort((a, x) => a.titulo.localeCompare(x.titulo, 'pt-BR'));
            PS.dialogo(`<h2>Qual conjunto?</h2><div class="lista-marcar rolar">${todos.map((c, i) => `<label><input type="radio" name="c" value="${c.id}" ${i === 0 ? 'checked' : ''}> ${esc(c.titulo)} <small>(${c.questoes.length})</small></label>`).join('')}</div>`,
                (dlg) => { const x = dlg.querySelector('input:checked'); if (x) PS.comecarAula(b.dataset.turma, x.value); }, { confirmar: '▶ Começar' });
        },
        'aula-anterior': () => aula && irPara(aula.indice - 1),
        'aula-proxima': () => aula && irPara(aula.indice + 1),
        'aula-ir': (e, b) => irPara(+b.dataset.indice),
        'aula-grafico': () => { if (!aula) return; aula.mostrarGrafico = !aula.mostrarGrafico; mudou(); },
        'aula-revelar': () => { if (!aula || !questaoApresentada().corretas.length) return; aula.revelar = !aula.revelar; mudou(); },
        'aula-travar': () => { aula.travada = !aula.travada; mudou(); },
        'aula-cronometro': () => {
            if (!aula) return;
            const c = aula.cronometro;
            if (c.rodando) { c.acumulado = decorrido(); c.rodando = false; } else {
                if (c.modo === 'regressivo' && decorrido() >= c.segundos * 1000) { c.acumulado = 0; c.avisou = false; aula.travada = false; }
                c.inicio = Date.now(); c.rodando = true;
            }
            mudou();
        },
        'aula-cronometro-zerar': () => { const modo = aula.cronometro; aula.cronometro = Object.assign(cronometroNovo(), { modo: modo.modo, segundos: modo.segundos }); mudou(); },
        'aula-limpar': () => PS.confirmar('Apagar as respostas desta pergunta e ler de novo?', () => {
            const s = sessaoAtual();
            if (s) { PS.d.sessoes = PS.d.sessoes.filter((x) => x !== s); delete aula.sessoes[questaoCrua().id]; PS.salvar(); }
            aula.revelar = false; aula.mostrarGrafico = false; aula.travada = false;
            aula.rodada = (aula.rodada || 0) + 1;
            if (camera) camera.novaPergunta({});
            mudou();
        }),
        'aula-resposta-manual': (e, b) => respostaManual(+b.dataset.cartao),
        'aula-telao': () => {
            const url = '../telao/?sala=' + aula.codigo;
            PS.dialogo(`<h2>Telão</h2><p class="sub">No computador ligado ao projetor ou à TV, abra o endereço abaixo e digite o código <strong>${aula.codigo}</strong> — ou abra numa janela deste computador e arraste para a tela do projetor.</p>
                <p class="endereco">${esc(new URL('../telao/', location.href).href)}</p>`, () => { const w = window.open(url, 'provashow-telao'); if (!w) PS.avisar('O navegador bloqueou a janela.'); },
                { confirmar: 'Abrir nesta tela' });
        },
        'aula-ajustes': ajustes,
        'aula-encerrar': () => {
            const c = conjuntoDaAula();
            const feitas = c.questoes.filter((x) => aula.sessoes[x.id]).length;
            PS.dialogo(`<h2>Encerrar a aula ao vivo?</h2><p class="sub">${feitas} de ${c.questoes.length} perguntas têm respostas. Tudo já está guardado nos relatórios.</p>
                <label class="interruptor"><input type="checkbox" id="tirar-fila" ${feitas === c.questoes.length ? 'checked' : ''}> Tirar “${esc(c.titulo)}” da fila da turma</label>`,
                (dlg) => encerrar(dlg.querySelector('#tirar-fila').checked), { confirmar: 'Encerrar' });
        },
        'aula-ler': () => {
            if (!cameraAberta) {
                const lugar = PS.$('#lugar-camera');
                lugar.outerHTML = blocoCamera();
                abrirCamera();
                PS.$('#aula-camera').scrollIntoView({ block: 'nearest' });
            } else if (camera) camera.pausar(!camera.pausado());
            const b = PS.$('[data-acao="aula-ler"]');
            if (b && camera) { b.textContent = camera.pausado() ? '▶ Continuar leitura' : '⏸ Pausar leitura'; b.classList.toggle('lendo', !camera.pausado()); }
            mudou(true);
        },
        'camera-fechar': () => { fecharCamera(); desenharAula(); mudou(true); },
        'camera-trocar': async () => { if (camera) await camera.trocarCamera(); },
        'camera-lanterna': async (e, b) => { b.classList.toggle('btn-principal'); if (camera) await camera.lanterna(b.classList.contains('btn-principal')); },
        'camera-som': (e, b) => { PS.d.config.leitura.som = !PS.d.config.leitura.som; PS.salvar(); b.textContent = PS.d.config.leitura.som ? '🔔' : '🔕'; }
    });

    document.addEventListener('input', (e) => { if (e.target.id === 'zoom-camera' && camera) camera.zoom(+e.target.value); });

    PS.atalhos.push(
        { tela: 'aula', teclas: ['ArrowLeft', 'PageUp'], f: () => PS.acoes['aula-anterior']() },
        { tela: 'aula', teclas: ['ArrowRight', 'PageDown'], f: () => PS.acoes['aula-proxima']() },
        { tela: 'aula', teclas: ['g', 'G'], f: () => PS.acoes['aula-grafico']() },
        { tela: 'aula', teclas: ['r', 'R'], f: () => PS.acoes['aula-revelar']() },
        { tela: 'aula', teclas: ['t', 'T'], f: () => PS.acoes['aula-cronometro']() },
        { tela: 'aula', teclas: ['l', 'L', ' '], f: () => aula && PS.acoes['aula-ler']() }
    );

    /* a câmera não fica ligada em outras telas */
    PS.aoTrocarTela.push((r) => { if (r.nome !== 'aula' && cameraAberta) fecharCamera(); });

    PS.prontos.push(() => {
        try {
            const guardada = JSON.parse(localStorage.getItem(CHAVE_AULA) || 'null');
            if (guardada && PS.turma(guardada.turmaId) && PS.conjunto(guardada.conjuntoId)) {
                aula = Object.assign({ cronometro: cronometroNovo(), telao: Object.assign({}, PS.d.config.telao), aceitarAparelhos: true }, guardada);
                ligarCanal();
            }
        } catch (erro) { /* começa sem aula */ }
    });

    /* testes: a câmera embutida lendo uma imagem */
    PS.cameraDaAula = () => camera;
})();
