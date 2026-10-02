/* A tela do Montador de Provas: início (modelos, provas guardadas e últimos
   arquivos gerados), editor da prova com a prévia paginada ao lado, e editor
   de modelos. */
(function () {
    'use strict';

    const Modelos = window.MontarModelos;
    const Texto = window.MontarTexto;
    const Paginar = window.MontarPaginar;
    const Armazem = window.MontarArmazem;
    const Importar = window.MontarImportar;
    const Gabarito = window.MontarGabarito;
    const Icones = window.MontarIcones;
    const Colar = window.MontarColar;
    const Nuvem = window.MontarNuvem;

    const $ = function (id) { return document.getElementById(id); };
    const esc = Texto.escapar;

    let prova = null;
    let abertas = new Set();
    let modeloEdit = null;
    let zoom = 'ajustar';
    let escalaAtual = 1;
    let lidoColar = null;
    let ultimoResultado = null;
    let historico = [];

    const CORPOS = [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14];
    const DISPOSICOES = [
        ['auto', 'Automática (a mais econômica)'],
        ['lista', 'Uma por linha'],
        ['duas', 'Duas por linha'],
        ['linha', 'Todas numa linha']
    ];
    const NOMES_DISPOSICAO = { lista: 'uma por linha', duas: 'duas por linha', linha: 'todas numa linha' };
    const POSICOES = [['abaixo', 'Abaixo do texto'], ['acima', 'Acima do texto'], ['lado', 'Ao lado do texto']];

    function el(tag, classe, html) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (html != null) e.innerHTML = html;
        return e;
    }

    function debounce(fn, ms) {
        let t = null;
        const chamar = function () { clearTimeout(t); t = setTimeout(function () { t = null; fn(); }, ms); };
        chamar.agora = function () { clearTimeout(t); t = null; fn(); };
        chamar.pendente = function () { return t !== null; };
        return chamar;
    }

    function guardado(chave, padrao) {
        try { const v = localStorage.getItem('montar-provas:' + chave); return v == null ? padrao : v; } catch (e) { return padrao; }
    }
    function guardar(chave, valor) {
        try { localStorage.setItem('montar-provas:' + chave, valor); } catch (e) { /* sem problema */ }
    }

    function opcoesHtml(lista, atual) {
        return lista.map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(atual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('');
    }

    function virgula(n) { return String(n).replace('.', ','); }

    /* ===================== telas ===================== */

    function mostrar(tela) {
        ['inicio', 'editor', 'modelo', 'entrar', 'admin'].forEach(function (t) { $('tela-' + t).hidden = t !== tela; });
        document.body.dataset.tela = tela;
        window.scrollTo(0, 0);
    }

    async function rota() {
        if (prova) salvar.agora();
        fecharNuvem();
        const partes = location.hash.replace(/^#\/?/, '').split('/');
        if (partes[0] === 'area' && partes[1]) {
            prova = null;
            abrirProvaNuvem(decodeURIComponent(partes[1]));
            return;
        }
        if (partes[0] === 'entrar') { prova = null; abrirEntrar(); return; }
        if (partes[0] === 'admin') { prova = null; abrirAdmin(); return; }
        if (partes[0] === 'prova' && partes[1]) {
            const achada = await Armazem.obter(decodeURIComponent(partes[1]));
            if (!achada) { location.hash = '#/'; return; }
            abrirProva(achada);
            return;
        }
        prova = null;
        if (partes[0] === 'modelo') { abrirModelo(partes[1] ? decodeURIComponent(partes[1]) : null); return; }
        mostrar('inicio');
        document.title = 'Montador de Provas da Malu — EEMTI Prof. Maria Luiza Saboia';
        desenharInicio();
    }

    /* ===================== início ===================== */

    function resumoLayout(layout) {
        const itens = [];
        itens.push({ faixa: 'faixa para o Identificador', completo: 'cabeçalho completo com brasão', nenhum: 'sem cabeçalho' }[layout.cabecalho]);
        if (layout.instrucoes) itens.push('instruções');
        if (layout.gabarito) itens.push('gabarito com bolhas');
        itens.push(layout.colunas === 2 ? 'duas colunas' : 'uma coluna');
        itens.push((Modelos.FONTES[layout.fonte] || {}).nome + ' ' + virgula(layout.corpoPt));
        return itens.join(' · ');
    }

    function cartaoModelo(m) {
        const fixo = !!m.fixo;
        const zero = m.id === Modelos.DO_ZERO_ID;
        const c = el('div', 'cartao' + (fixo ? ' cartao--fixo' : ''));
        c.innerHTML =
            '<div><span class="selo' + (fixo ? ' selo--fixo' : '') + '">' + (fixo ? '🔒 Modelo fixo' : zero ? 'Formato livre' : 'Modelo') + '</span></div>' +
            '<h3>' + esc(m.nome) + '</h3>' +
            '<p>' + esc(m.descricao || '') + (zero ? '' : '<br><small>' + esc(resumoLayout(m.layout)) + '</small>') + '</p>' +
            '<div class="cartao-acoes">' +
            '<button type="button" class="btn btn--primary btn--pequeno" data-usar="' + esc(m.id) + '">Montar prova</button>' +
            (fixo ? '<a class="btn btn--pequeno" href="#/modelo/' + encodeURIComponent(m.id) + '" title="Cria um modelo novo partindo deste formato">Criar variação</a>' : '') +
            (!fixo && !zero ? '<a class="btn btn--pequeno" href="#/modelo/' + encodeURIComponent(m.id) + '">Editar</a>' +
                '<button type="button" class="btn btn--pequeno" data-apagar-modelo="' + esc(m.id) + '">Apagar</button>' : '') +
            '</div>';
        return c;
    }

    function dataHora(ms) {
        const d = new Date(ms);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    let provasDoInicio = [];

    async function desenharInicio() {
        const lista = $('lista-modelos');
        lista.innerHTML = '';
        Modelos.listar().forEach(function (m) { lista.appendChild(cartaoModelo(m)); });
        lista.appendChild(cartaoModelo(Modelos.obter(Modelos.DO_ZERO_ID)));
        lista.appendChild(el('div', 'cartao cartao--novo',
            '<h3>+ Criar um modelo</h3><p>Um formato próprio — recuperação, simulado, lista de exercícios — para reaproveitar sempre que quiser.</p>' +
            '<div class="cartao-acoes"><a class="btn btn--pequeno" href="#/modelo">Criar modelo</a></div>'));

        desenharConta();
        desenharArea();
        provasDoInicio = (await Armazem.listar()).filter(function (p) { return !p.nuvem; });
        $('busca-provas').hidden = provasDoInicio.length < 6;
        desenharListaProvas();
        desenharArquivos();
        $('aviso-armazem').hidden = await Armazem.persistente();
    }

    function desenharListaProvas() {
        const termo = Texto.semMarcas($('busca-provas').value || '').toLowerCase();
        const destino = $('lista-provas');
        destino.innerHTML = '';
        if (!provasDoInicio.length) destino.appendChild(el('p', 'vazio', 'Nenhuma prova ainda. Escolha um modelo acima para começar.'));
        provasDoInicio.forEach(function (p) {
            const total = Modelos.questoesNumeradas(p).length;
            const meta = [p.modeloNome, p.serie ? p.serie + 'ª série' : '', p.componente || p.disciplina,
                total + (total === 1 ? ' questão' : ' questões'), 'editada em ' + dataHora(p.atualizadaEm)].filter(Boolean).join(' · ');
            if (termo && (p.titulo + ' ' + meta).toLowerCase().indexOf(termo) === -1) return;
            destino.appendChild(el('div', 'prova-linha',
                '<div class="info"><strong>' + esc(p.titulo || 'Prova sem título') + '</strong><span class="meta">' + esc(meta) + '</span></div>' +
                '<div class="acoes">' +
                '<a class="btn btn--primary btn--pequeno" href="#/prova/' + encodeURIComponent(p.id) + '">Abrir</a>' +
                '<button type="button" class="btn btn--pequeno" data-duplicar="' + esc(p.id) + '">Duplicar</button>' +
                '<button type="button" class="btn btn--pequeno" data-exportar="' + esc(p.id) + '">Exportar</button>' +
                '<button type="button" class="btn btn--pequeno" data-apagar-prova="' + esc(p.id) + '">Apagar</button>' +
                '</div>'));
        });
    }
    $('busca-provas').addEventListener('input', desenharListaProvas);

    async function desenharArquivos() {
        $('limite-arquivos').textContent = Armazem.LIMITE_ARQUIVOS;
        const arquivos = await Armazem.listarArquivos();
        const destino = $('lista-arquivos');
        destino.innerHTML = '';
        if (!arquivos.length) destino.appendChild(el('p', 'vazio', 'Nada impresso ainda. As provas impressas ou salvas em PDF aparecem aqui.'));
        arquivos.forEach(function (a) {
            const tipo = a.tipo === 'gabarito' ? 'Gabarito do professor' : a.tipo === 'gabaritos' ? 'Folhas de respostas' : (a.paginas + (a.paginas === 1 ? ' página' : ' páginas'));
            destino.appendChild(el('div', 'prova-linha',
                '<div class="info"><strong>' + esc(a.nome) + '</strong><span class="meta">' + esc(a.titulo + ' · ' + tipo + ' · gerado em ' + dataHora(a.criadoEm)) + '</span></div>' +
                '<div class="acoes">' +
                '<button type="button" class="btn btn--primary btn--pequeno" data-reabrir="' + esc(a.id) + '" title="Abre uma cópia desta versão para imprimir de novo ou ajustar">Abrir esta versão</button>' +
                '<button type="button" class="btn btn--pequeno" data-exportar-arquivo="' + esc(a.id) + '">Exportar</button>' +
                '<button type="button" class="btn btn--pequeno" data-apagar-arquivo="' + esc(a.id) + '">Apagar</button>' +
                '</div>'));
        });
    }

    async function usarModelo(id) {
        const m = Modelos.obter(id);
        if (!m) return;
        const nova = Modelos.criarProva(m);
        await Armazem.salvar(nova);
        location.hash = '#/prova/' + encodeURIComponent(nova.id);
    }

    function baixar(nome, conteudo, tipo) {
        const blob = new Blob([conteudo], { type: tipo });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    function exportar(p, nome) {
        baixar((nome || Modelos.nomeArquivo(p)) + '.json', JSON.stringify({ app: 'montador-provas-malu', versao: 2, prova: p }, null, 1), 'application/json');
    }

    async function copiaComoNova(p, titulo) {
        const copia = Modelos.normalizarProva(Modelos.copiar(p));
        delete copia.nuvem;
        copia.id = Modelos.novoId('prova');
        copia.titulo = titulo;
        copia.criadaEm = Date.now();
        await Armazem.salvar(copia);
        return copia;
    }

    $('lista-modelos').addEventListener('click', function (e) {
        const usar = e.target.closest('[data-usar]');
        if (usar) { usarModelo(usar.dataset.usar); return; }
        const apagar = e.target.closest('[data-apagar-modelo]');
        if (apagar) {
            const m = Modelos.obter(apagar.dataset.apagarModelo);
            if (m && confirm('Apagar o modelo "' + m.nome + '"? As provas já feitas com ele continuam como estão.')) {
                Modelos.apagar(m.id);
                desenharInicio();
            }
        }
    });

    $('lista-provas').addEventListener('click', async function (e) {
        const alvo = e.target.closest('button');
        if (!alvo) return;
        if (alvo.dataset.duplicar) {
            const p = await Armazem.obter(alvo.dataset.duplicar);
            await copiaComoNova(p, (p.titulo || 'Prova') + ' (cópia)');
            desenharInicio();
        } else if (alvo.dataset.exportar) {
            exportar(await Armazem.obter(alvo.dataset.exportar));
        } else if (alvo.dataset.apagarProva) {
            const p = await Armazem.obter(alvo.dataset.apagarProva);
            if (p && confirm('Apagar a prova "' + (p.titulo || 'sem título') + '"? As versões impressas continuam em "Últimos arquivos gerados".')) {
                await Armazem.apagar(p.id);
                desenharInicio();
            }
        }
    });

    $('lista-arquivos').addEventListener('click', async function (e) {
        const alvo = e.target.closest('button');
        if (!alvo) return;
        const id = alvo.dataset.reabrir || alvo.dataset.exportarArquivo || alvo.dataset.apagarArquivo;
        const a = await Armazem.obterArquivo(id);
        if (!a) return;
        if (alvo.dataset.reabrir) {
            const nova = await copiaComoNova(a.prova, a.titulo + ' (versão de ' + new Date(a.criadoEm).toLocaleDateString('pt-BR') + ')');
            location.hash = '#/prova/' + encodeURIComponent(nova.id);
        } else if (alvo.dataset.exportarArquivo) {
            exportar(a.prova, a.nome);
        } else if (confirm('Apagar "' + a.nome + '" dos arquivos gerados?')) {
            await Armazem.apagarArquivo(a.id);
            desenharArquivos();
        }
    });

    $('importar-prova').addEventListener('change', async function () {
        const arquivo = this.files[0];
        this.value = '';
        if (!arquivo) return;
        try {
            const dados = JSON.parse(await arquivo.text());
            const p = dados && dados.prova;
            if (!p || !Array.isArray(p.secoes)) throw new Error('formato');
            Modelos.normalizarProva(p);
            p.id = Modelos.novoId('prova');
            await Armazem.salvar(p);
            desenharInicio();
        } catch (erro) {
            alert('Este arquivo não é uma prova exportada pelo Montador de Provas.');
        }
    });

    /* ===================== formato (prova e modelo) ===================== */

    function opcoesFonte(atual) {
        return opcoesHtml(Object.keys(Modelos.FONTES).map(function (k) {
            return [k, Modelos.FONTES[k].nome + (k === 'times' ? ' (padrão)' : '')];
        }), atual);
    }
    function opcoesCorpo(atual) {
        return opcoesHtml(CORPOS.map(function (c) { return [c, virgula(c) + ' pt' + (c === 10 ? ' (padrão)' : '')]; }), atual);
    }

    /* Monta o formulário do formato e mexe direto no objeto `layout`.
       comAparencia: o editor de modelos mostra também fonte, corpo etc.;
       numa prova, essas opções ficam no passo "Aparência". */
    function formLayout(caixa, layout, aoMudar, comAparencia) {
        caixa.innerHTML =
            '<div class="linha-campos">' +
            '<label class="campo-largo">Cabeçalho da 1ª página<select data-l="cabecalho">' + opcoesHtml([
                ['faixa', 'Faixa para o Identificador (com brasão)'],
                ['completo', 'Cabeçalho completo com brasão'],
                ['nenhum', 'Sem cabeçalho']], layout.cabecalho) + '</select></label>' +
            '<label data-se="faixa">Altura da faixa<select data-l="faixaCm" data-num>' + opcoesHtml([[2.5, '2,5 cm'], [3, '3 cm'], [3.5, '3,5 cm'], [4, '4 cm']], layout.faixaCm) + '</select></label>' +
            '</div>' +
            (comAparencia ?
                '<div class="linha-campos">' +
                '<label class="campo-largo">Fonte<select data-l="fonte">' + opcoesFonte(layout.fonte) + '</select></label>' +
                '<label>Tamanho<select data-l="corpoPt" data-num>' + opcoesCorpo(layout.corpoPt) + '</select></label>' +
                '<label>Espaçamento<select data-l="espacamento">' + opcoesHtml([['compacto', 'Compacto'], ['normal', 'Normal'], ['amplo', 'Amplo']], layout.espacamento) + '</select></label>' +
                '</div>' +
                '<div class="linha-campos"><label class="campo-largo">Margens da folha<select data-l="margemCm" data-num>' + opcoesHtml(Modelos.MARGENS, layout.margemCm) + '</select></label></div>' : '') +
            '<div class="linha-campos">' +
            '<label>Colunas<select data-l="colunas" data-num>' + opcoesHtml([[2, 'Duas'], [1, 'Uma']], layout.colunas) + '</select></label>' +
            '<label>Alternativas<select data-l="alternativas" data-num>' + opcoesHtml([[5, 'Cinco (a–e)'], [4, 'Quatro (a–d)']], layout.alternativas) + '</select></label>' +
            '<label>Letras<select data-l="letras">' + opcoesHtml([['a)', 'a) b) c)'], ['A)', 'A) B) C)'], ['(A)', '(A) (B) (C)']], layout.letras) + '</select></label>' +
            '<label>Numeração<select data-l="numeracao">' + opcoesHtml([['01.', '01. 02.'], ['1.', '1. 2.'], ['QUESTÃO 01', 'QUESTÃO 01']], layout.numeracao) + '</select></label>' +
            '</div>' +
            (comAparencia ?
                '<label class="opcao"><input type="checkbox" data-l="gabarito"' + (layout.gabarito ? ' checked' : '') + '> Gabarito (folha de respostas com bolhas e marcas de alinhamento)</label>' +
                '<div class="linha-campos"><label class="campo-largo">Onde fica o gabarito<select data-l="gabaritoLocal">' +
                opcoesHtml([['prova', 'Na 1ª página da prova'], ['separado', 'Em folha à parte, 4 por folha A4']], layout.gabaritoLocal) + '</select></label></div>' +
                '<label class="opcao"><input type="checkbox" data-l="linhaColunas"' + (layout.linhaColunas ? ' checked' : '') + '> Linha entre as colunas</label>' +
                '<label class="opcao"><input type="checkbox" data-l="icones"' + (layout.icones ? ' checked' : '') + '> Ícone da disciplina nos títulos das seções</label>' +
                '<label class="opcao"><input type="checkbox" data-l="imagensCinza"' + (layout.imagensCinza ? ' checked' : '') + '> Imagens em tons de cinza (economiza tinta)</label>' : '') +
            '<label class="opcao"><input type="checkbox" data-l="numeroPagina"' + (layout.numeroPagina ? ' checked' : '') + '> Número da página no pé (1/8)</label>' +
            (comAparencia ?
                '<label class="opcao"><input type="checkbox" data-l="instrucoes"' + (layout.instrucoes ? ' checked' : '') + '> Quadro de instruções</label>' +
                '<label data-se="instrucoes" class="campo-coluna"><textarea data-l="textoInstrucoes" rows="5" placeholder="Uma instrução por linha. **negrito** vale aqui também.">' +
                esc(layout.textoInstrucoes.join('\n')) + '</textarea></label>' +
                '<p class="dica dica--pequena">São as instruções com que a prova nasce; o professor pode mudá-las em cada prova.</p>' : '');

        function visibilidade() {
            caixa.querySelector('[data-se="faixa"]').hidden = layout.cabecalho !== 'faixa';
            const instr = caixa.querySelector('[data-se="instrucoes"]');
            if (instr) instr.hidden = !layout.instrucoes;
        }
        visibilidade();

        caixa.oninput = caixa.onchange = function (e) {
            const campo = e.target.dataset.l;
            if (!campo) return;
            if (e.target.type === 'checkbox') layout[campo] = e.target.checked;
            else if (campo === 'textoInstrucoes') layout[campo] = e.target.value.split('\n');
            else if ('num' in e.target.dataset) layout[campo] = Number(e.target.value);
            else layout[campo] = e.target.value;
            visibilidade();
            aoMudar(campo);
        };
    }

    /* ===================== editor da prova ===================== */

    const salvar = debounce(function () {
        if (!prova) return;
        const alvo = prova;
        if (alvo.nuvem) {
            /* prova da área: cópia local (para abrir sem internet) e envio ao servidor */
            Armazem.salvar(alvo).catch(function () {});
            enviarNuvem();
            return;
        }
        $('ed-status').textContent = 'Salvando…';
        Armazem.salvar(alvo).then(function () {
            if (prova === alvo) $('ed-status').textContent = 'Salvo neste navegador';
        });
    }, 600);

    const paginar = debounce(repaginar, 250);

    function mudou() {
        /* na prova da área, quem diz o estado é o selo da nuvem */
        $('ed-status').textContent = prova.nuvem ? '' : 'Alterado';
        salvar();
        paginar();
        $('ed-titulo').textContent = prova.titulo || 'Prova sem título';
    }

    /* ----- desfazer ----- */

    function marcar() {
        if (!prova) return;
        const foto = JSON.stringify(prova);
        if (historico[historico.length - 1] === foto) return;
        historico.push(foto);
        if (historico.length > 30) historico.shift();
        $('ed-desfazer').disabled = false;
    }

    function desfazer() {
        if (!historico.length) return;
        const atual = JSON.stringify(prova);
        let anterior = historico.pop();
        /* a foto tirada ao entrar no campo pode ser igual ao estado atual */
        while (anterior === atual && historico.length) anterior = historico.pop();
        if (anterior === atual) { $('ed-desfazer').disabled = true; return; }
        const nuvemAtual = prova.nuvem;
        prova = JSON.parse(anterior);
        /* o que já foi para o servidor não volta atrás: só o conteúdo */
        if (nuvemAtual) prova.nuvem = nuvemAtual;
        $('ed-desfazer').disabled = !historico.length;
        redesenharTudo();
        mudou();
        $('ed-status').textContent = 'Desfeito';
    }
    $('ed-desfazer').onclick = desfazer;
    document.addEventListener('keydown', function (e) {
        if (document.body.dataset.tela !== 'editor') return;
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
            e.preventDefault();
            desfazer();
        }
    });
    /* foto ao entrar num campo: o desfazer volta ao que estava antes de digitar */
    $('editor').addEventListener('focusin', function (e) {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) marcar();
    });

    /* ----- abrir ----- */

    function abrirProva(p) {
        prova = Modelos.normalizarProva(p);
        abertas = new Set();
        historico = [];
        $('ed-desfazer').disabled = true;
        $('proposta').hidden = true;
        if (!p.nuvem && !Modelos.questoesNumeradas(p).length && !p.secoes.some(function (s) { return s.questoes.length; })) {
            /* prova nova: a primeira seção já ganha uma questão aberta */
            const q = Modelos.novaQuestao('objetiva', 5);
            p.secoes[0].questoes.push(q);
            abertas.add(q.id);
        }
        mostrar('editor');
        $('ed-modelo').textContent = (p.fixo ? '🔒 ' : '') + p.modeloNome;
        $('ed-modelo').className = 'selo' + (p.fixo ? ' selo--fixo' : '');
        $('ed-status').textContent = p.nuvem ? '' : 'Salvo neste navegador';
        document.title = (p.titulo || 'Prova') + ' — Montador de Provas da Malu';
        $('copias').value = guardado('copias', '35');
        zoom = 'ajustar';
        redesenharTudo();
        repaginar();
    }

    function redesenharTudo() {
        $('ed-titulo').textContent = prova.titulo || 'Prova sem título';
        aplicarPermissoes();
        preencherDados();
        preencherAparencia();
        preencherInstrucoes();
        desenharFormato();
        desenharSecoes();
    }

    function preencherDados() {
        document.querySelectorAll('#editor [data-p]').forEach(function (campo) {
            campo.value = prova[campo.dataset.p] == null ? '' : prova[campo.dataset.p];
        });
        visibilidadeDados();
    }

    function visibilidadeDados() {
        const layout = Modelos.layoutDaProva(prova);
        document.querySelectorAll('#editor [data-so-completo]').forEach(function (e) { e.hidden = layout.cabecalho !== 'completo'; });
        document.querySelectorAll('#editor [data-so-faixa]').forEach(function (e) { e.hidden = layout.cabecalho !== 'faixa'; });
    }

    function secoesVazias(p) {
        return p.secoes.every(function (s) {
            return s.questoes.every(function (q) { return !String(q.enunciado || '').trim() && !(q.imagens || []).length; });
        });
    }

    document.querySelectorAll('#editor [data-p]').forEach(function (campo) {
        campo.addEventListener('input', aoMudarDado);
        campo.addEventListener('change', aoMudarDado);
    });

    function aoMudarDado(e) {
        const nome = e.target.dataset.p;
        const valor = e.target.value;
        if (prova[nome] === valor) return;
        const modelo = Modelos.obter(prova.modeloId);
        const tituloAntes = modelo ? Modelos.tituloPadrao(modelo, prova) : null;
        const antes = Modelos.copiar(prova);
        prova[nome] = valor;
        /* o nome da avaliação acompanha a área enquanto o professor não o mudou */
        if (modelo && (nome === 'componente' || nome === 'disciplina') && prova.titulo === tituloAntes) {
            prova.titulo = Modelos.tituloPadrao(modelo, prova);
            document.querySelector('#editor [data-p="titulo"]').value = prova.titulo;
        }
        /* trocou a área numa prova ainda vazia: as seções viram as da área nova */
        if (nome === 'componente' && modelo && modelo.secoesIniciais === 'componente' && secoesVazias(antes)) {
            prova.secoes = Modelos.secoesDoModelo(modelo, prova.componente);
            const q = Modelos.novaQuestao('objetiva', 5);
            prova.secoes[0].questoes.push(q);
            abertas.add(q.id);
            desenharSecoes();
        }
        mudou();
    }

    /* ----- aparência ----- */

    $('ap-fonte').innerHTML = opcoesFonte('times');
    $('ap-margem').innerHTML = opcoesHtml(Modelos.MARGENS, 0.5);
    $('ap-corpo').innerHTML = opcoesCorpo(10);

    function preencherAparencia() {
        const layout = Modelos.layoutDaProva(prova);
        document.querySelectorAll('#editor [data-a]').forEach(function (campo) {
            const v = layout[campo.dataset.a];
            if (campo.type === 'checkbox') campo.checked = !!v;
            else campo.value = v;
        });
        visibilidadeGabarito();
    }

    function visibilidadeGabarito() {
        const layout = Modelos.layoutDaProva(prova);
        document.querySelectorAll('#editor [data-se-gabarito]').forEach(function (e) { e.hidden = !layout.gabarito; });
        document.querySelectorAll('#editor [data-se-gabarito-imagem]').forEach(function (e) { e.hidden = layout.gabaritoOrigem !== 'imagem'; });
        document.querySelectorAll('#editor [data-se-gabarito-separado]').forEach(function (e) { e.hidden = layout.gabaritoLocal !== 'separado'; });
        const img = prova.gabaritoImagem;
        $('gab-miniatura').hidden = !img;
        if (img) $('gab-miniatura').src = img.src;
        $('gab-tirar').hidden = !img;
        $('gab-escolher').textContent = img ? 'Trocar imagem…' : 'Escolher imagem…';
    }

    /* ----- instruções: o texto é do professor, em qualquer modelo ----- */

    function linhasInstrucoes() {
        return Modelos.layoutDaProva(prova).textoInstrucoes.filter(function (l) { return String(l).trim(); });
    }

    function preencherInstrucoes() {
        const layout = Modelos.layoutDaProva(prova);
        $('ins-ligado').checked = !!layout.instrucoes;
        $('ins-corpo').hidden = !layout.instrucoes;
        if (document.activeElement !== $('ins-texto')) $('ins-texto').value = layout.textoInstrucoes.join('\n').replace(/\n+$/, '');
        desenharSugestoes();
    }

    function desenharSugestoes() {
        const atuais = linhasInstrucoes().map(function (l) { return Texto.semMarcas(l).toLowerCase(); });
        $('ins-sugestoes').innerHTML = Modelos.SUGESTOES_INSTRUCOES.map(function (s, i) {
            const ja = atuais.indexOf(s.toLowerCase()) !== -1;
            return '<button type="button" class="sugestao" data-sugestao="' + i + '"' + (ja ? ' disabled title="Já está no quadro"' : '') + '>+ ' + esc(s.replace(/;$/, '')) + '</button>';
        }).join('');
    }

    function definirInstrucoes(linhas) {
        prova.ajustes.textoInstrucoes = linhas;
        mudou();
    }

    $('ins-ligado').addEventListener('change', function () {
        marcar();
        prova.ajustes.instrucoes = this.checked;
        if (this.checked && !linhasInstrucoes().length) prova.ajustes.textoInstrucoes = Modelos.INSTRUCOES_BIMESTRAL.slice();
        preencherInstrucoes();
        mudou();
    });
    $('ins-texto').addEventListener('input', function () {
        definirInstrucoes(this.value.split('\n'));
        desenharSugestoes();
    });
    $('ins-texto').addEventListener('keydown', function (e) {
        const tecla = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && (tecla === 'b' || tecla === 'i')) { e.preventDefault(); aplicarMarca(this, tecla); }
    });
    document.querySelectorAll('[data-fmt-ins]').forEach(function (b) {
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () { aplicarMarca($('ins-texto'), b.dataset.fmtIns); });
    });
    $('ins-sugestoes').addEventListener('click', function (e) {
        const b = e.target.closest('[data-sugestao]');
        if (!b || b.disabled) return;
        marcar();
        const linhas = linhasInstrucoes();
        const nova = Modelos.SUGESTOES_INSTRUCOES[Number(b.dataset.sugestao)];
        /* entra antes da última, que costuma ser a regra em negrito do fim */
        const fim = linhas.length && /^\*\*/.test(linhas[linhas.length - 1]) ? linhas.length - 1 : linhas.length;
        linhas.splice(fim, 0, nova);
        definirInstrucoes(linhas);
        preencherInstrucoes();
    });
    $('ins-restaurar').onclick = function () {
        marcar();
        delete prova.ajustes.textoInstrucoes;
        delete prova.ajustes.instrucoes;
        preencherInstrucoes();
        mudou();
    };

    /* ----- gabarito como imagem ----- */

    async function receberGabarito(arquivos) {
        const arquivo = Array.from(arquivos || []).filter(function (f) { return /^image\//.test(f.type); })[0];
        if (!arquivo) return;
        try {
            marcar();
            /* mais resolução que nas questões: as bolhas precisam sair nítidas */
            const img = await carregarImagem(arquivo, 2400);
            prova.gabaritoImagem = { src: img.src, w: img.w, h: img.h };
            prova.ajustes.gabarito = true;
            prova.ajustes.gabaritoOrigem = 'imagem';
            preencherAparencia();
            mudou();
        } catch (erro) {
            alert('Não consegui abrir esta imagem. Tente salvar como PNG ou JPG.');
        }
    }

    $('gab-escolher').onclick = function () { $('arquivo-gabarito').click(); };
    $('arquivo-gabarito').addEventListener('change', function () { receberGabarito(this.files); this.value = ''; });
    $('gab-tirar').onclick = function () {
        marcar();
        prova.gabaritoImagem = null;
        visibilidadeGabarito();
        mudou();
    };
    $('gab-zona').addEventListener('paste', function (e) {
        e.preventDefault();
        const lido = Colar.ler(e);
        if (lido.imagens.length) receberGabarito(lido.imagens);
        else $('ed-status').textContent = 'Não veio imagem: copie a imagem do gabarito (ou um print) e cole de novo';
    });
    $('gab-zona').addEventListener('beforeinput', function (e) { if (e.inputType !== 'insertFromPaste') e.preventDefault(); });
    $('gab-zona').addEventListener('dragover', function (e) { e.preventDefault(); });
    $('gab-zona').addEventListener('drop', function (e) { e.preventDefault(); receberGabarito(e.dataTransfer.files); });

    document.querySelectorAll('#editor [data-a]').forEach(function (campo) {
        campo.addEventListener('change', function () {
            const nome = campo.dataset.a;
            prova.ajustes = prova.ajustes || {};
            prova.ajustes[nome] = campo.type === 'checkbox' ? campo.checked : ('num' in campo.dataset ? Number(campo.value) : campo.value);
            $('proposta').hidden = true;
            visibilidadeGabarito();
            mudou();
        });
    });

    function desenharFormato() {
        const caixa = $('formato');
        if (prova.fixo) {
            const layout = Modelos.layoutDaProva(prova);
            caixa.innerHTML = '<div class="formato-travado"><strong>🔒 Formato fixo da Avaliação Bimestral Malu</strong>' +
                '<ul><li>Espaço em branco de ' + virgula(layout.faixaCm) + ' cm no alto, para a gestão acrescentar a identificação (cabeçalho do Identificador de Provas, com o brasão)</li>' +
                '<li>Quadro de instruções — o texto é seu, no passo 3</li><li>Gabarito com as marcas de alinhamento (até ' + Gabarito.capacidade() + ' questões) — pode tirar ou pôr à parte no passo 2</li>' +
                '<li>Duas colunas, alternativas de a) a e), numeração 01.</li></ul>' +
                'Fonte, tamanho, espaçamento e gabarito você ajusta no passo 2; as instruções, no passo 3. Se esta prova precisa de outro formato, ' +
                '<button type="button" class="btn btn--pequeno" id="tornar-livre">fazer uma cópia com formato livre</button></div>';
            $('tornar-livre').onclick = async function () {
                if (!confirm('Criar uma cópia desta prova com o formato livre? A cópia deixa de ser a Avaliação Bimestral padrão; esta continua como está.')) return;
                salvar.agora();
                const copia = Modelos.tornarLivre(Modelos.copiar(prova));
                copia.id = Modelos.novoId('prova');
                copia.titulo = (prova.titulo || 'Prova') + ' (formato livre)';
                await Armazem.salvar(copia);
                location.hash = '#/prova/' + encodeURIComponent(copia.id);
            };
            return;
        }
        caixa.innerHTML = '';
        const form = el('div');
        caixa.appendChild(form);
        formLayout(form, prova.layout, function (campo) {
            visibilidadeDados();
            if (campo === 'alternativas' || campo === 'letras') desenharSecoes();
            mudou();
        }, false);
        const salvarModelo = el('div', 'acoes-lista', '<button type="button" class="btn btn--pequeno">Salvar este formato como modelo</button>');
        salvarModelo.querySelector('button').onclick = function () {
            const nome = prompt('Nome do novo modelo (ex.: Recuperação Paralela):');
            if (!nome || !nome.trim()) return;
            Modelos.salvar(Modelos.modeloDaProva(prova, nome.trim()));
            $('ed-status').textContent = 'Modelo "' + nome.trim() + '" criado — aparece no início';
        };
        caixa.appendChild(salvarModelo);
    }

    /* ----- seções e questões ----- */

    function acharQuestao(id) {
        for (const s of prova.secoes) {
            const i = s.questoes.findIndex(function (q) { return q.id === id; });
            if (i !== -1) return { secao: s, indice: i, questao: s.questoes[i] };
        }
        return null;
    }

    function resumo(q) {
        const primeiro = Texto.paragrafos(q.enunciado)[0];
        if (primeiro) return { texto: (q.fonte ? '(' + q.fonte + ') ' : '') + Texto.semMarcas(primeiro), vazio: false };
        return { texto: (q.imagens || []).length ? '(só imagem)' : (q.tipo === 'texto' ? 'texto de apoio vazio' : 'enunciado ainda vazio'), vazio: !(q.imagens || []).length };
    }

    function etiqueta(q) {
        if (q.tipo === 'texto') return '<span class="q-tag texto">texto de apoio</span>';
        if (q.tipo === 'discursiva') return '<span class="q-tag">discursiva</span>';
        return q.correta ? '<span class="q-tag certa">' + q.correta + '</span>' : '<span class="q-tag falta">sem resposta</span>';
    }

    function ferramentasTexto() {
        return '<div class="fmt" role="toolbar" aria-label="Formatação">' +
            '<button type="button" data-fmt="b" title="Negrito (Ctrl+B)"><b>N</b></button>' +
            '<button type="button" data-fmt="i" title="Itálico (Ctrl+I)"><i>I</i></button>' +
            '<button type="button" data-fmt="sub" title="Índice (H₂O)">x<sub>2</sub></button>' +
            '<button type="button" data-fmt="sup" title="Expoente (x²)">x<sup>2</sup></button>' +
            '</div>';
    }

    function controleTamanho(campo, valor) {
        return '<label class="tamanho">Tamanho <input type="range" min="15" max="100" step="5" data-campo="' + campo + '" value="' + valor + '"><output>' + valor + '%</output></label>';
    }

    function imagensHtml(q) {
        const lista = (q.imagens || []).map(function (img) {
            return '<div class="img-item" data-img="' + img.id + '"><img src="' + img.src + '" alt="">' +
                '<div class="img-controles">' +
                '<label>Posição<select data-campo="img-posicao">' + opcoesHtml(POSICOES, img.posicao) + '</select></label>' +
                controleTamanho('img-largura', img.largura || 100) +
                '</div><button type="button" class="icone icone--perigo" data-acao="img-remover" title="Tirar a imagem">✕</button></div>';
        }).join('');
        return '<div class="imagens">' + lista + '</div>' +
            '<div class="zona-linha"><div class="zona-colar" contenteditable="true" spellcheck="false" data-zona ' +
            'title="Clique aqui e cole (Ctrl+V), ou arraste uma imagem" aria-label="Área para colar imagem ou texto"></div>' +
            '<button type="button" class="btn btn--pequeno" data-acao="img-escolher">Escolher imagem…</button></div>';
    }

    function questaoHtml(q, numero, layout, leitura) {
        const r = resumo(q);
        const texto = q.tipo === 'texto';
        if (q.tipo === 'objetiva') while (q.alternativas.length < 5) q.alternativas.push('');
        let corpo = '<div class="linha-campos">' +
            '<label>Tipo<select data-campo="tipo">' + opcoesHtml([['objetiva', 'Objetiva'], ['discursiva', 'Discursiva'], ['texto', 'Texto de apoio']], q.tipo) + '</select></label>' +
            (texto ? '' : '<label class="campo-largo">Fonte <small>(sai entre parênteses)</small><input type="text" data-campo="fonte" value="' + esc(q.fonte || '') + '" placeholder="Ex.: Enem, Uece, autoral"></label>') +
            '</div>' +
            (texto ? '<p class="dica dica--pequena">Texto, tirinha, gráfico ou tabela que serve a várias questões. Não leva número nem entra no gabarito.</p>' : '') +
            '<div class="campo-texto"><div class="campo-texto-cab"><span>' + (texto ? 'Texto' : 'Enunciado') + '</span>' + ferramentasTexto() + '</div>' +
            '<textarea data-campo="enunciado" rows="4" placeholder="' + (texto ? 'TEXTO I&#10;Cole ou escreva o texto de apoio.' : 'Texto da questão. Cada linha é um parágrafo.') + '">' + esc(q.enunciado || '') + '</textarea></div>' +
            imagensHtml(q);

        if (q.tipo === 'objetiva') {
            corpo += '<div class="alternativas">' +
                '<div class="disposicao"><label>Alternativas<select data-campo="disposicao">' + opcoesHtml(DISPOSICOES, q.disposicao || 'auto') + '</select></label>' +
                '<span class="disp-auto" data-disp-auto></span></div>';
            for (let i = 0; i < layout.alternativas; i++) {
                const letraMaiuscula = 'ABCDE'[i];
                const img = (q.altImagens || [])[i];
                corpo += '<div class="alt" data-i="' + i + '"><label class="alt-letra" title="Marcar como a resposta certa">' +
                    '<input type="radio" name="certa-' + q.id + '" value="' + letraMaiuscula + '" data-campo="correta"' + (q.correta === letraMaiuscula ? ' checked' : '') + '>' +
                    esc(Modelos.letra(i, layout.letras)) + '</label>' +
                    '<div class="alt-corpo"><textarea rows="1" data-campo="alt" data-i="' + i + '">' + esc(q.alternativas[i] || '') + '</textarea>' +
                    (img ? '<div class="alt-img"><img src="' + img.src + '" alt="">' + controleTamanho('alt-img-largura', img.largura || 40) +
                        '<button type="button" class="icone icone--perigo" data-acao="alt-img-remover" title="Tirar a imagem">✕</button></div>' : '') +
                    '</div>' +
                    (img ? '' : '<button type="button" class="icone" data-acao="alt-img" title="Pôr uma imagem nesta alternativa">🖼</button>') +
                    '</div>';
            }
            corpo += '<small>Marque a bolinha da alternativa certa: ela vai para o gabarito do professor, nunca para a prova. Alternativa só com imagem: deixe o texto vazio.</small></div>';
        } else if (q.tipo === 'discursiva') {
            corpo += '<div class="linha-campos"><label>Linhas para a resposta<input type="number" min="0" max="40" data-campo="linhas" value="' + (q.linhas | 0) + '"></label></div>';
        }

        corpo += '<div class="q-acoes">' +
            '<button type="button" class="icone" data-acao="q-subir" title="Subir">↑</button>' +
            '<button type="button" class="icone" data-acao="q-descer" title="Descer">↓</button>' +
            '<button type="button" class="btn btn--pequeno" data-acao="q-duplicar">Duplicar</button>' +
            '<button type="button" class="btn btn--pequeno" data-acao="q-apagar">Apagar</button></div>';

        if (leitura) {
            /* seção de outro professor: dá para ler tudo, não dá para mexer */
            corpo = '<fieldset disabled>' + corpo.replace(/contenteditable="true"/g, 'contenteditable="false"') + '</fieldset>';
        }
        const rotulo = texto ? '<span class="q-numero q-numero--texto">T</span>' : '<span class="q-numero">' + (numero < 10 ? '0' : '') + numero + '</span>';
        return '<details class="questao' + (texto ? ' questao--texto' : '') + '" data-q="' + q.id + '"' + (abertas.has(q.id) ? ' open' : '') + '>' +
            '<summary>' + rotulo +
            '<span class="q-resumo' + (r.vazio ? ' vazio-q' : '') + '">' + esc(r.texto) + '</span>' + etiqueta(q) + '</summary>' +
            '<div class="q-corpo">' + corpo + '</div></details>';
    }

    function opcoesIcone(secao) {
        const detectado = Icones.detectar(secao.titulo);
        const nomeDetectado = detectado ? Icones.lista().filter(function (i) { return i.chave === detectado; })[0].nome : 'nenhum';
        return opcoesHtml([['auto', 'Ícone automático (' + nomeDetectado + ')']]
            .concat(Icones.lista().map(function (i) { return [i.chave, i.nome]; }))
            .concat([['nenhum', 'Sem ícone']]), secao.icone || 'auto');
    }

    function desenharSecoes() {
        const layout = Modelos.layoutDaProva(prova);
        const caixa = $('secoes');
        const rolagem = $('editor').scrollTop;
        let n = 0;
        const formata = Nuvem.podeFormatar(prova);
        caixa.innerHTML = prova.secoes.map(function (s, i) {
            const icone = Icones.resolver(s.icone, s.titulo);
            const escreve = Nuvem.podeEscrever(prova, s);
            const travaSecao = formata ? '' : ' disabled';
            return '<div class="secao' + (escreve ? '' : ' secao--leitura') + '" data-s="' + s.id + '">' +
                '<div class="secao-cab"><span class="secao-icone">' + (icone ? Icones.svg(icone, 'icone-ui') : '') + '</span>' +
                '<input type="text" data-campo="secao-titulo" value="' + esc(s.titulo || '') + '" placeholder="Título da seção (ex.: BIOLOGIA) — opcional"' + travaSecao + '>' +
                (formata ?
                    '<button type="button" class="icone" data-acao="secao-subir" title="Subir a seção"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
                    '<button type="button" class="icone" data-acao="secao-descer" title="Descer a seção"' + (i === prova.secoes.length - 1 ? ' disabled' : '') + '>↓</button>' +
                    '<button type="button" class="icone icone--perigo" data-acao="secao-apagar" title="Apagar a seção">✕</button>' : '') + '</div>' +
                '<div class="secao-icone-escolha"><select data-campo="secao-icone" aria-label="Ícone da seção"' + travaSecao + '>' + opcoesIcone(s) + '</select></div>' +
                (prova.nuvem ? donoDaSecao(s, escreve) : '') +
                s.questoes.map(function (q) {
                    if (q.tipo !== 'texto') n++;
                    return questaoHtml(q, n, layout, !escreve);
                }).join('') +
                (escreve ?
                    '<div class="secao-acoes"><button type="button" class="btn btn--pequeno" data-acao="add-objetiva">+ Objetiva</button>' +
                    '<button type="button" class="btn btn--pequeno" data-acao="add-discursiva">+ Discursiva</button>' +
                    '<button type="button" class="btn btn--pequeno" data-acao="add-texto">+ Texto de apoio</button></div>' : '') +
                (prova.nuvem ? comentariosDaSecao(s) : '') +
                '</div>';
        }).join('');
        if (prova.nuvem) desenharPainelArea();
        $('editor').scrollTop = rolagem;
        ajustarAlturas(caixa);
        mostrarDisposicoes();
    }

    /* as caixas das alternativas crescem com o texto */
    function ajustarAlturas(raiz) {
        raiz.querySelectorAll('textarea[data-campo="alt"]').forEach(crescer);
    }
    function crescer(t) {
        if (!t.offsetParent) return;
        t.style.height = 'auto';
        t.style.height = (t.scrollHeight + 2) + 'px';
    }

    function atualizarResumo(questaoEl, q) {
        const r = resumo(q);
        const span = questaoEl.querySelector('.q-resumo');
        span.textContent = r.texto;
        span.classList.toggle('vazio-q', r.vazio);
        questaoEl.querySelector('.q-tag').outerHTML = etiqueta(q);
    }

    /* mostra, nas questões em "automática", o que a paginação escolheu */
    function mostrarDisposicoes() {
        if (!ultimoResultado) return;
        document.querySelectorAll('#secoes [data-q]').forEach(function (qel) {
            const alvo = qel.querySelector('[data-disp-auto]');
            if (!alvo) return;
            const achado = acharQuestao(qel.dataset.q);
            const escolha = ultimoResultado.disposicoes[qel.dataset.q];
            alvo.textContent = achado && achado.questao.disposicao === 'auto' && escolha ? 'na prova: ' + NOMES_DISPOSICAO[escolha] : '';
        });
    }

    const caixaSecoes = $('secoes');

    caixaSecoes.addEventListener('toggle', function (e) {
        const d = e.target;
        if (!d.dataset || !d.dataset.q) return;
        if (d.open) { abertas.add(d.dataset.q); ajustarAlturas(d); } else abertas.delete(d.dataset.q);
    }, true);

    function imagemDoElemento(qel, alvo) {
        const achado = acharQuestao(qel.dataset.q);
        const item = alvo.closest('[data-img]');
        return { achado: achado, img: item ? achado.questao.imagens.find(function (i) { return i.id === item.dataset.img; }) : null };
    }

    function aoEditarQuestao(e) {
        const campo = e.target.dataset.campo;
        if (!campo) return;
        const secaoEl = e.target.closest('[data-s]');
        if (campo === 'secao-titulo' || campo === 'secao-icone') {
            const s = prova.secoes.find(function (x) { return x.id === secaoEl.dataset.s; });
            if (campo === 'secao-titulo') {
                s.titulo = e.target.value;
                const icone = Icones.resolver(s.icone, s.titulo);
                secaoEl.querySelector('.secao-icone').innerHTML = icone ? Icones.svg(icone, 'icone-ui') : '';
                secaoEl.querySelector('[data-campo="secao-icone"]').innerHTML = opcoesIcone(s);
            } else {
                if (e.type !== 'change') return;
                s.icone = e.target.value;
                const icone = Icones.resolver(s.icone, s.titulo);
                secaoEl.querySelector('.secao-icone').innerHTML = icone ? Icones.svg(icone, 'icone-ui') : '';
            }
            mudou();
            return;
        }
        const qel = e.target.closest('[data-q]');
        if (!qel) return;
        const achado = acharQuestao(qel.dataset.q);
        const q = achado.questao;
        if (campo === 'tipo') {
            if (e.type !== 'change') return;
            q.tipo = e.target.value;
            if (q.tipo === 'objetiva') while (q.alternativas.length < 5) q.alternativas.push('');
            desenharSecoes();
        } else if (campo === 'disposicao') {
            if (e.type !== 'change') return;
            q.disposicao = e.target.value;
        } else if (campo === 'alt') {
            q.alternativas[Number(e.target.dataset.i)] = e.target.value.replace(/\n/g, ' ');
            crescer(e.target);
        } else if (campo === 'correta') {
            q.correta = e.target.value;
            atualizarResumo(qel, q);
        } else if (campo === 'linhas') {
            q.linhas = Math.max(0, Math.min(40, parseInt(e.target.value, 10) || 0));
        } else if (campo === 'img-largura' || campo === 'img-posicao') {
            const img = imagemDoElemento(qel, e.target).img;
            if (campo === 'img-largura') { img.largura = Number(e.target.value); e.target.nextElementSibling.textContent = img.largura + '%'; }
            else img.posicao = e.target.value;
        } else if (campo === 'alt-img-largura') {
            const i = Number(e.target.closest('[data-i]').dataset.i);
            q.altImagens[i].largura = Number(e.target.value);
            e.target.nextElementSibling.textContent = e.target.value + '%';
        } else {
            q[campo] = e.target.value;
            atualizarResumo(qel, q);
        }
        mudou();
    }

    caixaSecoes.addEventListener('input', aoEditarQuestao);
    caixaSecoes.addEventListener('change', function (e) {
        const campo = e.target.dataset.campo;
        if (['tipo', 'correta', 'img-posicao', 'disposicao', 'secao-icone'].indexOf(campo) !== -1) aoEditarQuestao(e);
    });

    /* ----- formatação: botões e atalhos ----- */

    const MARCAS = { b: ['**', '**'], i: ['*', '*'], sub: ['~', '~'], sup: ['^', '^'] };
    let ultimoCampoTexto = null;

    caixaSecoes.addEventListener('focusin', function (e) {
        if (e.target.tagName === 'TEXTAREA') ultimoCampoTexto = e.target;
    });

    function aplicarMarca(campo, tipo) {
        const m = MARCAS[tipo];
        const ini = campo.selectionStart;
        const fim = campo.selectionEnd;
        const selecionado = campo.value.slice(ini, fim);
        if (selecionado) {
            campo.setRangeText(m[0] + selecionado + m[1], ini, fim, 'end');
        } else {
            campo.setRangeText(m[0] + m[1], ini, fim, 'end');
            campo.selectionStart = campo.selectionEnd = ini + m[0].length;
        }
        campo.focus();
        campo.dispatchEvent(new Event('input', { bubbles: true }));
    }

    caixaSecoes.addEventListener('mousedown', function (e) {
        /* o botão não rouba o foco (e a seleção) da caixa de texto */
        if (e.target.closest('[data-fmt]')) e.preventDefault();
    });

    caixaSecoes.addEventListener('keydown', function (e) {
        if (e.target.tagName !== 'TEXTAREA' || !(e.ctrlKey || e.metaKey)) return;
        const tecla = e.key.toLowerCase();
        if (tecla === 'b' || tecla === 'i') {
            e.preventDefault();
            aplicarMarca(e.target, tecla);
        }
    });

    /* ----- imagens: colar, arrastar, escolher ----- */

    let alvoImagem = null;

    /* A imagem entra reduzida (até 1600 px no lado maior): dá nitidez de
       sobra no papel e não pesa a prova guardada. */
    async function carregarImagem(arquivo, maximo) {
        const url = URL.createObjectURL(arquivo);
        try {
            const img = new Image();
            img.src = url;
            await img.decode();
            const k = Math.min(1, (maximo || 1600) / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(1, Math.round(img.naturalWidth * k));
            const h = Math.max(1, Math.round(img.naturalHeight * k));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            let src = canvas.toDataURL('image/png');
            if (!/png|gif/.test(arquivo.type) || src.length > 1500000) src = canvas.toDataURL('image/jpeg', 0.88);
            /* largura inicial: figura pequena não estica (a 96 dpi da tela) */
            const larguraNatural = Math.round(Math.min(100, Math.max(25, (w / 330) * 100)) / 5) * 5;
            return { id: Modelos.novoId('img'), src: src, w: w, h: h, largura: larguraNatural, posicao: 'abaixo' };
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /* alvo: { qid, alt (índice da alternativa) | undefined } */
    async function receberImagens(alvo, arquivos) {
        arquivos = Array.from(arquivos || []).filter(function (f) { return /^image\//.test(f.type); });
        if (!arquivos.length) return;
        const achado = acharQuestao(alvo.qid);
        if (!achado) return;
        marcar();
        try {
            for (const arquivo of arquivos) {
                const imagem = await carregarImagem(arquivo);
                if (alvo.alt != null) {
                    imagem.largura = 40;
                    achado.questao.altImagens[alvo.alt] = imagem;
                    break; /* uma por alternativa */
                }
                achado.questao.imagens.push(imagem);
            }
            abertas.add(alvo.qid);
            desenharSecoes();
            mudou();
        } catch (erro) {
            alert('Não consegui abrir esta imagem. Tente salvar como PNG ou JPG e enviar pelo botão.');
        }
    }

    $('arquivo-imagem').addEventListener('change', function () {
        if (alvoImagem) receberImagens(alvoImagem, this.files);
        this.value = '';
    });

    function escolherImagem(alvo) {
        alvoImagem = alvo;
        $('arquivo-imagem').multiple = alvo.alt == null;
        $('arquivo-imagem').click();
    }

    caixaSecoes.addEventListener('paste', function (e) {
        const qel = e.target.closest('[data-q]');
        if (!qel) return;
        const lido = Colar.ler(e);
        const naAlternativa = e.target.dataset.campo === 'alt' ? Number(e.target.dataset.i) : null;
        const ehTexto = e.target.tagName === 'TEXTAREA';

        if (lido.imagens.length && !(ehTexto && lido.texto.trim())) {
            e.preventDefault();
            receberImagens({ qid: qel.dataset.q, alt: naAlternativa }, lido.imagens);
            return;
        }
        if (lido.perdidas) $('ed-status').textContent = 'Imagem do Word não veio junto: copie a imagem sozinha e cole de novo';

        const temHtml = e.clipboardData && e.clipboardData.getData('text/html');
        if (ehTexto && temHtml && lido.texto) {
            /* texto formatado do Word ou de um site: entra com a marcação */
            e.preventDefault();
            marcar();
            const texto = e.target.dataset.campo === 'alt' ? lido.texto.replace(/\n/g, ' ') : lido.texto;
            e.target.setRangeText(texto, e.target.selectionStart, e.target.selectionEnd, 'end');
            e.target.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
        if (!ehTexto) {
            /* a zona de colar não guarda nada: o texto vai para o fim do enunciado */
            e.preventDefault();
            if (!lido.texto.trim()) return;
            marcar();
            const q = acharQuestao(qel.dataset.q).questao;
            q.enunciado = (q.enunciado ? q.enunciado.replace(/\s+$/, '') + '\n' : '') + lido.texto;
            abertas.add(q.id);
            desenharSecoes();
            mudou();
        }
    });

    /* na zona de colar não se digita: ela só recebe o que é colado ou arrastado */
    caixaSecoes.addEventListener('beforeinput', function (e) {
        if (e.target.dataset && 'zona' in e.target.dataset && e.inputType !== 'insertFromPaste') e.preventDefault();
    });

    caixaSecoes.addEventListener('dragover', function (e) {
        const qel = e.target.closest('[data-q]');
        if (!qel || !e.dataTransfer) return;
        if (Array.from(e.dataTransfer.types || []).indexOf('Files') === -1) return;
        e.preventDefault();
        qel.classList.add('arrastando');
    });
    caixaSecoes.addEventListener('dragleave', function (e) {
        const qel = e.target.closest('[data-q]');
        if (qel && !qel.contains(e.relatedTarget)) qel.classList.remove('arrastando');
    });
    caixaSecoes.addEventListener('drop', function (e) {
        const qel = e.target.closest('[data-q]');
        if (!qel || !e.dataTransfer || !e.dataTransfer.files.length) return;
        e.preventDefault();
        qel.classList.remove('arrastando');
        const alt = e.target.closest('.alt');
        receberImagens({ qid: qel.dataset.q, alt: alt ? Number(alt.dataset.i) : null }, e.dataTransfer.files);
    });

    /* ----- botões das seções e questões ----- */

    caixaSecoes.addEventListener('click', function (e) {
        const fmt = e.target.closest('[data-fmt]');
        if (fmt) {
            const qel = fmt.closest('[data-q]');
            const campo = (ultimoCampoTexto && qel.contains(ultimoCampoTexto)) ? ultimoCampoTexto : qel.querySelector('textarea[data-campo="enunciado"]');
            aplicarMarca(campo, fmt.dataset.fmt);
            return;
        }
        const botao = e.target.closest('[data-acao]');
        if (!botao || botao.tagName === 'INPUT') return;
        const acao = botao.dataset.acao;
        const secaoEl = botao.closest('[data-s]');
        const secao = secaoEl && prova.secoes.find(function (s) { return s.id === secaoEl.dataset.s; });
        const qel = botao.closest('[data-q]');
        const achado = qel && acharQuestao(qel.dataset.q);

        if (/^nv-/.test(acao)) { acaoDaArea(acao, secao, botao); return; }
        if (prova.nuvem) {
            /* o banco recusaria; a tela nem tenta */
            if (/^secao-/.test(acao) && !Nuvem.podeFormatar(prova)) return;
            if (secao && !/^secao-/.test(acao) && !Nuvem.podeEscrever(prova, secao)) return;
        }

        if (acao === 'img-escolher') { escolherImagem({ qid: qel.dataset.q }); return; }
        if (acao === 'alt-img') { escolherImagem({ qid: qel.dataset.q, alt: Number(botao.closest('[data-i]').dataset.i) }); return; }

        marcar();
        if (acao === 'add-objetiva' || acao === 'add-discursiva' || acao === 'add-texto') {
            const q = Modelos.novaQuestao(acao.slice(4), 5);
            secao.questoes.push(q);
            abertas.add(q.id);
            desenharSecoes();
            const novo = caixaSecoes.querySelector('[data-q="' + q.id + '"] textarea[data-campo="enunciado"]');
            if (novo) novo.focus();
        } else if (acao === 'secao-subir' || acao === 'secao-descer') {
            const i = prova.secoes.indexOf(secao);
            const j = acao === 'secao-subir' ? i - 1 : i + 1;
            if (j < 0 || j >= prova.secoes.length) return;
            prova.secoes.splice(i, 1);
            prova.secoes.splice(j, 0, secao);
            desenharSecoes();
        } else if (acao === 'secao-apagar') {
            if (secao.questoes.length && !confirm('Apagar a seção "' + (secao.titulo || 'sem título') + '" com as ' + secao.questoes.length + ' questões dela? (Dá para desfazer.)')) return;
            prova.secoes.splice(prova.secoes.indexOf(secao), 1);
            if (!prova.secoes.length) prova.secoes.push(Modelos.novaSecao(''));
            desenharSecoes();
        } else if (acao === 'q-subir' || acao === 'q-descer') {
            moverQuestao(achado, acao === 'q-subir' ? -1 : 1);
            desenharSecoes();
        } else if (acao === 'q-duplicar') {
            const copia = Modelos.copiar(achado.questao);
            copia.id = Modelos.novoId('q');
            achado.secao.questoes.splice(achado.indice + 1, 0, copia);
            abertas.add(copia.id);
            desenharSecoes();
        } else if (acao === 'q-apagar') {
            achado.secao.questoes.splice(achado.indice, 1);
            $('ed-status').textContent = 'Questão apagada — ↶ Desfazer traz de volta';
            desenharSecoes();
        } else if (acao === 'img-remover') {
            const img = imagemDoElemento(qel, botao).img;
            achado.questao.imagens = achado.questao.imagens.filter(function (i) { return i !== img; });
            desenharSecoes();
        } else if (acao === 'alt-img-remover') {
            achado.questao.altImagens[Number(botao.closest('[data-i]').dataset.i)] = null;
            desenharSecoes();
        } else {
            return;
        }
        mudou();
    });

    function moverQuestao(achado, passo) {
        const secoes = prova.secoes;
        const si = secoes.indexOf(achado.secao);
        const destino = achado.indice + passo;
        if (destino >= 0 && destino < achado.secao.questoes.length) {
            const lista = achado.secao.questoes;
            lista.splice(achado.indice, 1);
            lista.splice(destino, 0, achado.questao);
            return;
        }
        /* passou da borda: vai para a seção vizinha (se a pessoa puder escrever nela) */
        const vizinha = secoes[si + passo];
        if (!vizinha || !Nuvem.podeEscrever(prova, vizinha)) return;
        achado.secao.questoes.splice(achado.indice, 1);
        if (passo < 0) vizinha.questoes.push(achado.questao);
        else vizinha.questoes.unshift(achado.questao);
    }

    $('add-secao').onclick = function () {
        if (!Nuvem.podeFormatar(prova)) return;
        marcar();
        const nova = Modelos.novaSecao('');
        /* na prova da área a seção nasce com o id que vai para o banco */
        if (prova.nuvem) nova.id = Nuvem.uuid();
        prova.secoes.push(nova);
        desenharSecoes();
        const inputs = caixaSecoes.querySelectorAll('[data-campo="secao-titulo"]');
        inputs[inputs.length - 1].focus();
        mudou();
    };
    $('abrir-todas').onclick = function () {
        prova.secoes.forEach(function (s) { s.questoes.forEach(function (q) { abertas.add(q.id); }); });
        desenharSecoes();
    };
    $('fechar-todas').onclick = function () { abertas.clear(); desenharSecoes(); };

    /* ----- prévia e economia ----- */

    function folhasPorAluno(paginas) { return Math.ceil(paginas / 2); }

    function repaginar() {
        if (!prova || $('tela-editor').hidden) return;
        const r = Paginar.montar(prova, $('paginas'), {});
        ultimoResultado = r;
        const total = Modelos.questoesNumeradas(prova).length;
        const folhas = folhasPorAluno(r.paginas);
        $('previa-info').innerHTML = '<strong>' + r.paginas + (r.paginas === 1 ? ' página' : ' páginas') + '</strong> · ' +
            folhas + (folhas === 1 ? ' folha' : ' folhas') + ' por aluno (frente e verso) · ' + total + (total === 1 ? ' questão' : ' questões');
        atualizarTotalFolhas();
        aplicarZoom($('paginas'), $('previa-escala'), $('previa'));
        desenharGabaritosAParte();
        mostrarAvisos(r, Modelos.pendencias(prova));
        mostrarDisposicoes();
    }

    function gabaritoAParte() {
        const layout = Modelos.layoutDaProva(prova);
        return layout.gabarito && layout.gabaritoLocal === 'separado';
    }

    function atualizarTotalFolhas() {
        if (!ultimoResultado) return;
        const copias = Math.max(1, parseInt($('copias').value, 10) || 1);
        const daProva = folhasPorAluno(ultimoResultado.paginas) * copias;
        /* 4 gabaritos por folha A4 */
        const deGabarito = gabaritoAParte() ? Math.ceil(copias / 4) : 0;
        $('folhas-total').textContent = (daProva + deGabarito) + ' folhas' + (deGabarito ? ' (' + deGabarito + ' de gabarito)' : '');
    }

    function desenharGabaritosAParte() {
        const mostrar = gabaritoAParte();
        $('previa-gabaritos').hidden = !mostrar;
        if (!mostrar) { $('paginas-gabaritos').innerHTML = ''; return; }
        Paginar.montarGabaritos(prova, $('paginas-gabaritos'), { porFolha: 4 });
        aplicarZoomFixo($('paginas-gabaritos'), $('previa-gab-escala'), escalaAtual);
    }

    function aplicarZoomFixo(paginas, escala, s) {
        paginas.style.transform = 'scale(' + s + ')';
        escala.style.width = (paginas.offsetWidth * s) + 'px';
        escala.style.height = (paginas.offsetHeight * s) + 'px';
    }
    $('copias').addEventListener('input', function () { guardar('copias', this.value); atualizarTotalFolhas(); });

    function mostrarAvisos(r, pendencias) {
        const caixa = $('avisos');
        caixa.innerHTML = '';
        r.avisos.forEach(function (a) { caixa.appendChild(el('div', 'aviso aviso--erro', esc(a))); });
        if (r.paginas > 1 && r.ocupacaoUltima < 0.3) {
            caixa.appendChild(el('div', 'aviso', 'A última página está ' + (r.ocupacaoUltima < 0.1 ? 'quase vazia' : 'com pouco conteúdo') +
                '. Clique em <strong>Economizar papel</strong>, acima da prévia, para ver se dá para tirar essa página.'));
        }
        if (pendencias.length) {
            const lista = pendencias.slice(0, 12).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
                (pendencias.length > 12 ? '<li>… e mais ' + (pendencias.length - 12) + '.</li>' : '');
            caixa.appendChild(el('div', 'aviso', '<strong>Antes de imprimir, confira:</strong><ul>' + lista + '</ul>'));
        }
        caixa.hidden = !caixa.childNodes.length;
    }

    /* Procura o menor número de páginas sem sacrificar a leitura: tenta
       espaçamento compacto e letra um pouco menor (nunca abaixo de 9 pt) e,
       entre as que empatam no mínimo, fica com a mais legível. */
    function economizar() {
        if (paginar.pendente()) paginar.agora();
        const atual = Modelos.layoutDaProva(prova);
        const paginasAtuais = ultimoResultado.paginas;
        const corpos = CORPOS.filter(function (c) { return c <= atual.corpoPt && c >= Math.min(9, atual.corpoPt) && c >= atual.corpoPt - 1; });
        const espacos = ['amplo', 'normal', 'compacto'].filter(function (e, i, l) { return l.indexOf(atual.espacamento) <= i; });
        const ordem = { amplo: 0, normal: 1, compacto: 2 };
        const destino = $('simulacao');
        let melhor = { paginas: paginasAtuais, corpoPt: atual.corpoPt, espacamento: atual.espacamento };
        corpos.slice().sort(function (a, b) { return b - a; }).forEach(function (corpo) {
            espacos.forEach(function (espacamento) {
                if (corpo === atual.corpoPt && espacamento === atual.espacamento) return;
                const n = Paginar.montar(prova, destino, { ajustes: { corpoPt: corpo, espacamento: espacamento } }).paginas;
                const maisLegivel = corpo > melhor.corpoPt || (corpo === melhor.corpoPt && ordem[espacamento] < ordem[melhor.espacamento]);
                if (n < melhor.paginas || (n === melhor.paginas && n < paginasAtuais && maisLegivel)) {
                    melhor = { paginas: n, corpoPt: corpo, espacamento: espacamento };
                }
            });
        });
        destino.innerHTML = '';

        const caixa = $('proposta');
        const copias = Math.max(1, parseInt($('copias').value, 10) || 1);
        const dicas = [];
        const fixas = Modelos.questoesNumeradas(prova).filter(function (i) { return i.questao.tipo === 'objetiva' && i.questao.disposicao === 'lista'; }).length;
        if (fixas) dicas.push(fixas + (fixas === 1 ? ' questão está' : ' questões estão') + ' com alternativas "uma por linha" fixo; em "automática" as curtas vão lado a lado.');
        const grandes = [];
        prova.secoes.forEach(function (s) { s.questoes.forEach(function (q) { (q.imagens || []).forEach(function (img) { if (img.largura > 70) grandes.push(img); }); }); });
        if (grandes.length) dicas.push(grandes.length + (grandes.length === 1 ? ' imagem ocupa' : ' imagens ocupam') + ' mais de 70% da coluna; reduzir o tamanho ou pôr "ao lado do texto" costuma poupar espaço.');
        if (!atual.imagensCinza) dicas.push('Ligue "Imagens em tons de cinza" no passo 2 para gastar menos tinta.');
        if (atual.margemCm > 0.5) dicas.push('As margens estão em ' + virgula(atual.margemCm) + ' cm; em 0,5 cm (a mínima) cabe mais em cada página.');

        if (melhor.paginas < paginasAtuais) {
            const poupa = (folhasPorAluno(paginasAtuais) - folhasPorAluno(melhor.paginas)) * copias;
            caixa.innerHTML = '<strong>Dá para fazer a prova em ' + melhor.paginas + (melhor.paginas === 1 ? ' página' : ' páginas') + '</strong> em vez de ' + paginasAtuais +
                ' com ' + (Modelos.FONTES[atual.fonte] || {}).nome + ' ' + virgula(melhor.corpoPt) + ' pt e espaçamento ' + melhor.espacamento +
                (poupa > 0 ? ' — economia de <strong>' + poupa + ' folhas</strong> para ' + copias + ' alunos.' : '.') +
                (dicas.length ? '<ul>' + dicas.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
                '<div class="acoes-lista"><button type="button" class="btn btn--primary btn--pequeno" id="aplicar-proposta">Aplicar</button>' +
                '<button type="button" class="btn btn--pequeno" id="fechar-proposta">Deixar como está</button></div>';
            $('aplicar-proposta').onclick = function () {
                marcar();
                prova.ajustes.corpoPt = melhor.corpoPt;
                prova.ajustes.espacamento = melhor.espacamento;
                preencherAparencia();
                caixa.hidden = true;
                mudou();
            };
        } else {
            caixa.innerHTML = '<strong>A prova já está no menor número de páginas</strong> sem descer a letra para menos de 9 pt.' +
                (dicas.length ? '<ul>' + dicas.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
                '<div class="acoes-lista"><button type="button" class="btn btn--pequeno" id="fechar-proposta">Fechar</button></div>';
        }
        $('fechar-proposta').onclick = function () { caixa.hidden = true; };
        caixa.hidden = false;
        repaginar();
    }
    $('economizar').onclick = economizar;

    function aplicarZoom(paginas, escala, area) {
        const largura = paginas.offsetWidth;
        const altura = paginas.offsetHeight;
        if (!largura) return;
        let s = zoom === 'ajustar' ? (area.clientWidth - 40) / largura : zoom;
        s = Math.max(0.25, Math.min(2, s));
        if (zoom === 'ajustar') s = Math.min(s, 1.1);
        escalaAtual = s;
        paginas.style.transform = 'scale(' + s + ')';
        escala.style.width = (largura * s) + 'px';
        escala.style.height = (altura * s) + 'px';
    }

    document.querySelectorAll('[data-zoom]').forEach(function (b) {
        b.onclick = function () {
            const z = b.dataset.zoom;
            zoom = z === 'ajustar' ? 'ajustar' : escalaAtual * (z === '+' ? 1.15 : 1 / 1.15);
            aplicarZoom($('paginas'), $('previa-escala'), $('previa'));
            if (gabaritoAParte()) aplicarZoomFixo($('paginas-gabaritos'), $('previa-gab-escala'), escalaAtual);
        };
    });

    window.addEventListener('resize', debounce(function () {
        if (document.body.dataset.tela === 'editor') {
            aplicarZoom($('paginas'), $('previa-escala'), $('previa'));
            if (prova && gabaritoAParte()) aplicarZoomFixo($('paginas-gabaritos'), $('previa-gab-escala'), escalaAtual);
        }
        if (document.body.dataset.tela === 'modelo') aplicarZoomModelo();
    }, 150));

    /* ----- impressão ----- */

    let tituloAntesDeImprimir = null;

    function imprimir(chave) {
        depoisDeImprimir();
        salvar.agora();
        if (paginar.pendente()) paginar.agora();
        const nome = Modelos.nomeArquivo(prova) + (chave ? '-GABARITO-PROFESSOR' : '');
        tituloAntesDeImprimir = document.title;
        document.title = nome;
        if (chave) {
            Paginar.montarChave(prova, $('chave'));
            document.body.classList.add('imprimindo-chave');
        }
        /* a versão que vai para a impressão fica guardada */
        Armazem.guardarArquivo(prova, { nome: nome, tipo: chave ? 'gabarito' : 'prova', paginas: chave ? 1 : ultimoResultado.paginas });
        window.print();
        /* o afterprint desfaz o modo de impressão; cada impressão nova também
           começa limpando o anterior, caso o navegador não avise */
    }

    /* Folhas de respostas avulsas: 4 por A4, ou uma por página de 10,5 ×
       14,85 cm (o tamanho que a aba Gabaritos do Identificador recebe). */
    function imprimirGabaritos(porFolha) {
        depoisDeImprimir();
        salvar.agora();
        const nome = Modelos.nomeArquivo(prova) + (porFolha === 4 ? '-GABARITOS-4-POR-FOLHA' : '-GABARITO');
        tituloAntesDeImprimir = document.title;
        document.title = nome;
        Paginar.montarGabaritos(prova, $('gabaritos-impressao'), { porFolha: porFolha });
        if (porFolha === 1) {
            const pagina = document.createElement('style');
            pagina.id = 'pagina-quarto';
            pagina.textContent = '@page { size: 105mm 148.5mm; margin: 0; }';
            document.head.appendChild(pagina);
        }
        document.body.classList.add('imprimindo-gabaritos');
        Armazem.guardarArquivo(prova, { nome: nome, tipo: 'gabaritos', paginas: 1 });
        window.print();
    }
    $('gab-imprimir4').onclick = function () { imprimirGabaritos(4); };
    $('gab-imprimir1').onclick = function () { imprimirGabaritos(1); };

    function depoisDeImprimir() {
        document.body.classList.remove('imprimindo-chave');
        document.body.classList.remove('imprimindo-gabaritos');
        const pagina = $('pagina-quarto');
        if (pagina) pagina.remove();
        if (tituloAntesDeImprimir) document.title = tituloAntesDeImprimir;
        tituloAntesDeImprimir = null;
    }
    window.addEventListener('afterprint', depoisDeImprimir);

    $('ed-imprimir').onclick = function () { imprimir(false); };
    $('ed-chave').onclick = function () { imprimir(true); };
    $('ed-exportar').onclick = function () { salvar.agora(); exportar(prova); };

    /* ----- versão B ----- */

    $('ed-versaob').onclick = async function () {
        const objetivas = Modelos.questoesNumeradas(prova).filter(function (i) { return i.questao.tipo === 'objetiva'; }).length;
        if (!objetivas) { alert('A versão B troca a ordem das alternativas, e esta prova ainda não tem questões objetivas.'); return; }
        if (!confirm('Criar uma cópia desta prova com as alternativas em outra ordem (Tipo B)? A resposta certa acompanha, e o gabarito do professor da versão B sai certo. Esta prova não muda.')) return;
        salvar.agora();
        const r = Modelos.versaoEmbaralhada(prova, 'B');
        delete r.prova.nuvem;
        r.prova.id = Modelos.novoId('prova');
        await Armazem.salvar(r.prova);
        if (r.presas.length) alert('Ficaram na ordem original as questões ' + r.presas.join(', ') + ', porque têm alternativas como "todas as anteriores" ou "a e b".');
        location.hash = '#/prova/' + encodeURIComponent(r.prova.id);
    };

    /* ----- colar várias questões ----- */

    function abrirColar() {
        $('colar-texto').value = '';
        $('colar-resultado').innerHTML = '';
        $('colar-acrescentar').disabled = true;
        lidoColar = null;
        $('dialogo-colar').showModal();
        $('colar-texto').focus();
    }
    $('add-colar').onclick = abrirColar;

    $('colar-texto').addEventListener('paste', function (e) {
        const html = e.clipboardData && e.clipboardData.getData('text/html');
        if (!html) return;
        const texto = Colar.htmlParaMarcacao(html);
        if (!texto.trim()) return;
        e.preventDefault();
        this.setRangeText(texto, this.selectionStart, this.selectionEnd, 'end');
        this.dispatchEvent(new Event('input', { bubbles: true }));
    });

    $('colar-texto').addEventListener('input', debounce(function () {
        const layout = Modelos.layoutDaProva(prova);
        lidoColar = Importar.ler($('colar-texto').value, { alternativas: layout.alternativas });
        const r = lidoColar;
        let html = '';
        if (r.total) {
            html += '<div class="aviso aviso--ok"><strong>' + r.total + (r.total === 1 ? ' questão' : ' questões') + '</strong> reconhecida' + (r.total === 1 ? '' : 's') +
                (r.secoes.some(function (s) { return s.titulo; }) ? ', nas seções: ' + r.secoes.map(function (s) { return esc(s.titulo || '(sem título)') + ' (' + s.questoes.length + ')'; }).join(', ') : '') + '.</div>';
        }
        if (r.avisos.length) html += '<div class="aviso"><ul>' + r.avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
        $('colar-resultado').innerHTML = html;
        $('colar-acrescentar').disabled = !r.total;
    }, 200));

    function normalizar(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase(); }

    function temConteudo(q) {
        return String(q.enunciado || '').trim() || (q.imagens || []).length || (q.alternativas || []).some(function (a) { return String(a || '').trim(); });
    }

    /* Põe questões (já no formato da prova) na seção de mesmo título; sem
       título, na última seção. */
    function acrescentar(grupos) {
        marcar();
        const minhas = prova.secoes.filter(function (s) { return Nuvem.podeEscrever(prova, s); });
        if (!minhas.length) { alert('Você não tem nenhuma seção para escrever nesta prova.'); return; }
        grupos.forEach(function (grupo) {
            let alvo = null;
            if (prova.nuvem && !Nuvem.podeFormatar(prova)) {
                /* o professor só põe questões nas seções dele */
                alvo = minhas.find(function (s) { return normalizar(s.titulo) === normalizar(grupo.titulo); }) || minhas[0];
            } else if (grupo.titulo) {
                alvo = prova.secoes.find(function (s) { return normalizar(s.titulo) === normalizar(grupo.titulo); });
                if (!alvo) {
                    alvo = prova.secoes.find(function (s) { return !String(s.titulo || '').trim() && !s.questoes.some(temConteudo); });
                    if (alvo) alvo.titulo = grupo.titulo;
                }
                if (!alvo) {
                    alvo = Modelos.novaSecao(grupo.titulo);
                    if (prova.nuvem) alvo.id = Nuvem.uuid();
                    prova.secoes.push(alvo);
                }
            } else {
                alvo = prova.secoes[prova.secoes.length - 1];
            }
            alvo.questoes = alvo.questoes.filter(temConteudo).concat(grupo.questoes);
        });
        prova.secoes.forEach(function (s) { if (Nuvem.podeEscrever(prova, s)) s.questoes = s.questoes.filter(temConteudo); });
        abertas.clear();
        desenharSecoes();
        mudou();
    }

    $('colar-acrescentar').onclick = function () {
        if (!lidoColar || !lidoColar.total) return;
        acrescentar(lidoColar.secoes.map(function (lida) {
            return {
                titulo: lida.titulo,
                questoes: lida.questoes.map(function (lq) {
                    const q = Modelos.novaQuestao(lq.tipo, 5);
                    q.fonte = lq.fonte;
                    q.enunciado = lq.enunciado;
                    if (lq.tipo === 'objetiva') {
                        lq.alternativas.slice(0, 5).forEach(function (a, i) { q.alternativas[i] = a; });
                        q.correta = lq.correta || '';
                    }
                    return q;
                })
            };
        }));
        $('dialogo-colar').close();
    };

    /* ----- trazer de outra prova ----- */

    let bancoProvas = [];

    $('add-banco').onclick = async function () {
        bancoProvas = (await Armazem.listar()).filter(function (p) { return p.id !== prova.id; }).map(Modelos.normalizarProva);
        if (!bancoProvas.length) { alert('Ainda não há outras provas guardadas neste navegador.'); return; }
        $('banco-prova').innerHTML = opcoesHtml(bancoProvas.map(function (p, i) {
            return [i, (p.titulo || 'Prova sem título') + ' — ' + Modelos.questoesNumeradas(p).length + ' questões'];
        }), 0);
        $('banco-busca').value = '';
        desenharBanco();
        $('dialogo-banco').showModal();
    };

    function desenharBanco() {
        const p = bancoProvas[Number($('banco-prova').value) || 0];
        const termo = normalizar($('banco-busca').value);
        let n = 0;
        let html = '';
        p.secoes.forEach(function (s, si) {
            s.questoes.forEach(function (q, qi) {
                if (q.tipo !== 'texto') n++;
                const r = resumo(q);
                if (termo && normalizar(q.enunciado + ' ' + q.fonte + ' ' + s.titulo).indexOf(termo) === -1) return;
                html += '<label class="banco-item"><input type="checkbox" data-s="' + si + '" data-q="' + qi + '">' +
                    '<span class="q-numero">' + (q.tipo === 'texto' ? 'T' : (n < 10 ? '0' : '') + n) + '</span>' +
                    '<span class="banco-texto">' + esc(r.texto) + (s.titulo ? ' <small>' + esc(s.titulo) + '</small>' : '') + '</span>' + etiqueta(q) + '</label>';
            });
        });
        $('banco-lista').innerHTML = html || '<p class="vazio">Nenhuma questão encontrada.</p>';
        $('banco-acrescentar').disabled = true;
    }
    $('banco-prova').addEventListener('change', desenharBanco);
    $('banco-busca').addEventListener('input', desenharBanco);
    $('banco-lista').addEventListener('change', function () {
        $('banco-acrescentar').disabled = !$('banco-lista').querySelector('input:checked');
    });
    $('banco-acrescentar').onclick = function () {
        const p = bancoProvas[Number($('banco-prova').value) || 0];
        const grupos = [];
        $('banco-lista').querySelectorAll('input:checked').forEach(function (c) {
            const s = p.secoes[Number(c.dataset.s)];
            const q = Modelos.copiar(s.questoes[Number(c.dataset.q)]);
            q.id = Modelos.novoId('q');
            (q.imagens || []).forEach(function (i) { i.id = Modelos.novoId('img'); });
            let g = grupos.find(function (x) { return x.titulo === s.titulo; });
            if (!g) { g = { titulo: s.titulo, questoes: [] }; grupos.push(g); }
            g.questoes.push(q);
        });
        acrescentar(grupos);
        $('dialogo-banco').close();
    };

    /* ===================== provas da área (montadas a várias mãos) ===================== */

    const NOMES_PAPEL = { gestao: 'Gestão', pca: 'PCA', professor: 'Professor(a)' };
    const NOMES_SITUACAO = { rascunho: 'em andamento', pronta: 'pronta para revisão', devolvida: 'devolvida', aprovada: 'aprovada', nova: 'nova (ainda não enviada)' };
    const NOMES_AREA = { LIN: 'Linguagens e Códigos', NAT: 'Ciências da Natureza', HUM: 'Ciências Humanas', MAT: 'Matemática', RED: 'Redação' };

    let comentariosNuvem = [];
    let perfisNuvem = [];
    let pararAssinatura = null;
    let esperandoParaReceber = false;
    let relogioNuvem = null;
    const comentariosAbertos = new Set();

    function situacaoHtml(situacao, texto) {
        return '<span class="situacao situacao--' + esc(situacao) + '">' + esc(texto || NOMES_SITUACAO[situacao] || situacao) + '</span>';
    }

    function nomeDe(id) {
        if (!id) return 'ninguém';
        const p = perfisNuvem.find(function (x) { return x.id === id; });
        return (p && p.nome) || (prova && prova.nuvem && prova.nuvem.nomes[id]) || 'professor';
    }

    function dataCurta(iso) {
        if (!iso) return '';
        const p = String(iso).slice(0, 10).split('-');
        return p.length === 3 ? p[2] + '/' + p[1] : iso;
    }

    function euNuvem() { return Nuvem.perfil() || {}; }
    function coordenoEsta() { return !!(prova && prova.nuvem && Nuvem.coordena(prova.nuvem.componente)); }

    function donoDaSecao(s, escreve) {
        const n = prova.nuvem;
        const meta = n.secoes[s.id];
        const situacao = meta ? meta.situacao : 'nova';
        const aberta = n.situacao === 'aberta';
        const coord = coordenoEsta();
        const minha = meta && meta.responsavel === euNuvem().id;
        let html = '<div class="secao-dono">';
        if (coord && aberta) {
            const opcoes = [['', '— sem responsável —']].concat(perfisNuvem.filter(function (p) {
                return p.ativo && (p.area === n.componente || p.papel === 'gestao' || p.id === s.responsavel);
            }).map(function (p) { return [p.id, p.nome + (p.papel === 'pca' ? ' (PCA)' : '')]; }));
            html += 'Responsável <select data-campo="secao-responsavel">' + opcoesHtml(opcoes, s.responsavel || '') + '</select>';
        } else {
            html += 'Responsável: <strong>' + esc(nomeDe(s.responsavel)) + '</strong>';
        }
        html += situacaoHtml(situacao);
        html += '<span class="fluxo">';
        if (aberta && meta) {
            if (minha && (situacao === 'rascunho' || situacao === 'devolvida')) html += '<button type="button" class="btn btn--pequeno btn--verde" data-acao="nv-pronta">✔ Marcar como pronta</button>';
            if (minha && situacao === 'pronta' && !coord) html += '<button type="button" class="btn btn--pequeno" data-acao="nv-editar">Voltar a editar</button>';
            if (coord && situacao !== 'aprovada') html += '<button type="button" class="btn btn--pequeno btn--verde" data-acao="nv-aprovar">Aprovar</button>';
            if (coord && situacao !== 'devolvida') html += '<button type="button" class="btn btn--pequeno" data-acao="nv-devolver">Devolver com comentário</button>';
            if (coord && situacao === 'aprovada') html += '<button type="button" class="btn btn--pequeno" data-acao="nv-reabrir">Reabrir</button>';
        }
        html += '</span></div>';
        if (!escreve) {
            html += '<p class="so-leitura-aviso">' + (n.situacao !== 'aberta' ? 'Prova travada para impressão: ninguém altera até o PCA destravar.'
                : situacao === 'aprovada' && minha ? 'Seção aprovada pelo PCA: para mudar algo, peça que ele a reabra.'
                    : 'Seção de ' + esc(nomeDe(s.responsavel)) + ': você lê, mas só o responsável e o PCA alteram.') + '</p>';
        }
        return html;
    }

    function comentariosDaSecao(s) {
        const lista = comentariosNuvem.filter(function (c) { return c.secao_id === s.id; });
        const abertos = comentariosAbertos.has(s.id) || lista.some(function (c) { return c.tipo === 'devolucao' && !c.resolvido; });
        return '<details class="comentarios" data-comentarios="' + s.id + '"' + (abertos ? ' open' : '') + '>' +
            '<summary>💬 Comentários e histórico (' + lista.length + ')</summary>' +
            lista.map(function (c) {
                return '<div class="comentario comentario--' + esc(c.tipo) + '"><small>' + esc(nomeDe(c.autor)) + ' · ' +
                    new Date(c.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) +
                    (c.tipo === 'devolucao' ? ' · devolveu a seção' : c.tipo === 'aprovacao' ? ' · aprovou' : c.tipo === 'pronta' ? ' · marcou como pronta' : '') +
                    '</small>' + esc(c.texto) + '</div>';
            }).join('') +
            '<div class="comentar"><input type="text" data-comentar placeholder="Escreva um comentário para o PCA e os colegas…" maxlength="1000">' +
            '<button type="button" class="btn btn--pequeno" data-acao="nv-comentar">Enviar</button></div></details>';
    }

    function desenharPainelArea() {
        const n = prova.nuvem;
        const caixa = $('area-painel');
        const hoje = new Date().toISOString().slice(0, 10);
        const linhas = prova.secoes.map(function (s) {
            const meta = n.secoes[s.id];
            const total = s.questoes.filter(function (q) { return q.tipo !== 'texto'; }).length;
            return '<tr><td>' + esc(s.titulo || '(sem título)') + '</td><td>' + esc(nomeDe(s.responsavel)) + '</td><td>' + total +
                '</td><td>' + situacaoHtml(meta ? meta.situacao : 'nova') + '</td></tr>';
        }).join('');
        const prontas = prova.secoes.filter(function (s) { const m = n.secoes[s.id]; return m && (m.situacao === 'pronta' || m.situacao === 'aprovada'); }).length;
        const prazo = n.prazo ? '<span class="prazo' + (n.prazo < hoje && n.situacao === 'aberta' ? ' vencido' : '') + '">Prazo: ' + dataCurta(n.prazo) + '</span> · ' : '';
        caixa.innerHTML = '<strong>Prova da área — ' + esc(NOMES_AREA[n.componente] || n.componente) + '</strong> · ' + prazo +
            prontas + ' de ' + prova.secoes.length + ' seções prontas · ' +
            situacaoHtml(n.situacao, n.situacao === 'travada' ? '🔒 travada para impressão' : 'aberta para edição') +
            (coordenoEsta() && n.situacao === 'aberta' ? ' · <label class="prazo-editar">mudar prazo <input type="date" id="nv-prazo" value="' + esc(n.prazo || '') + '"></label>' : '') +
            '<table><tr><th>Seção</th><th>Responsável</th><th>Questões</th><th>Situação</th></tr>' + linhas + '</table>';
        caixa.hidden = false;
        const campoPrazo = $('nv-prazo');
        if (campoPrazo) campoPrazo.onchange = async function () {
            try { await Nuvem.mudarPrazo(n.id, this.value); n.prazo = this.value || null; desenharPainelArea(); }
            catch (e) { alert(Nuvem.mensagem(e)); }
        };
    }

    /* Na prova da área, o casco (dados, aparência, instruções, formato) é do
       PCA; o professor vê tudo, mas os campos ficam travados. */
    function aplicarPermissoes() {
        const formata = !prova || Nuvem.podeFormatar(prova);
        const passos = document.querySelectorAll('#editor fieldset.passo');
        for (let i = 0; i < 4 && i < passos.length; i++) {
            passos[i].disabled = !formata;
            let aviso = passos[i].querySelector('.trava-aviso');
            if (!formata && !aviso) {
                aviso = el('p', 'trava-aviso', prova.nuvem.situacao === 'travada' ? '🔒 Prova travada para impressão.' : '🔒 Só o PCA da área altera esta parte.');
                passos[i].insertBefore(aviso, passos[i].children[1] || null);
            }
            if (formata && aviso) aviso.remove();
        }
        const nuvem = !!(prova && prova.nuvem);
        const componente = document.querySelector('#editor [data-p="componente"]');
        if (componente) componente.disabled = nuvem || !formata;
        $('add-secao').hidden = !formata;
        const algumaMinha = !prova || prova.secoes.some(function (s) { return Nuvem.podeEscrever(prova, s); });
        $('add-colar').hidden = !algumaMinha;
        $('add-banco').hidden = !algumaMinha;
        $('area-painel').hidden = !nuvem;
        $('ed-nuvem').hidden = !nuvem;
        $('ed-travar').hidden = !(nuvem && coordenoEsta());
        if (nuvem) {
            $('ed-travar').textContent = prova.nuvem.situacao === 'travada' ? '🔓 Destravar' : '🔒 Travar para impressão';
            $('ed-modelo').textContent = 'Prova da área · ' + (prova.fixo ? '🔒 ' : '') + prova.modeloNome;
        }
    }

    function atualizarChipNuvem(estado) {
        if (!prova || !prova.nuvem) return;
        const chip = $('ed-nuvem');
        const pendentes = Nuvem.pendencias(prova);
        chip.classList.remove('pendente', 'erro');
        let curto;
        let longo;
        if (prova.nuvem.erro) {
            curto = '⚠ Erro ao salvar';
            longo = prova.nuvem.erro;
            chip.classList.add('erro');
        } else if (estado === 'enviando') {
            curto = '☁ Enviando…';
            longo = 'Enviando as alterações ao servidor.';
            chip.classList.add('pendente');
        } else if (pendentes && (prova.nuvem.offline || !navigator.onLine)) {
            curto = '☁ Sem conexão (' + pendentes + ')';
            longo = 'Sem conexão: ' + pendentes + (pendentes === 1 ? ' alteração guardada' : ' alterações guardadas') + ' neste aparelho. Vão sozinhas quando a internet voltar.';
            chip.classList.add('pendente');
        } else if (pendentes) {
            curto = '☁ ' + pendentes + ' a enviar';
            longo = pendentes + (pendentes === 1 ? ' alteração' : ' alterações') + ' esperando para ir ao servidor.';
            chip.classList.add('pendente');
        } else {
            curto = '☁ Salvo';
            longo = 'Tudo salvo no servidor: os colegas já veem esta versão.';
        }
        chip.textContent = curto;
        chip.title = longo;
        chip.setAttribute('aria-label', longo);
    }

    async function enviarNuvem() {
        if (!prova || !prova.nuvem) return;
        const alvo = prova;
        atualizarChipNuvem('enviando');
        const r = await Nuvem.sincronizar(alvo);
        if (prova !== alvo) return;
        Armazem.salvar(alvo).catch(function () {});
        atualizarChipNuvem();
        if (r.erro) $('ed-status').textContent = '';
    }

    /* o cursor volta ao mesmo campo (e à mesma posição) depois de redesenhar */
    function lembrarFoco() {
        const a = document.activeElement;
        if (!a || !$('editor').contains(a)) return null;
        const q = a.closest('[data-q]');
        const s = a.closest('[data-s]');
        return { q: q && q.dataset.q, s: s && s.dataset.s, campo: a.dataset.campo, i: a.dataset.i, p: a.dataset.p, inicio: a.selectionStart, fim: a.selectionEnd, rolagem: $('editor').scrollTop };
    }
    function devolverFoco(f) {
        if (!f) return;
        let seletor = f.p ? '[data-p="' + f.p + '"]' : '[data-campo="' + f.campo + '"]' + (f.i != null ? '[data-i="' + f.i + '"]' : '');
        if (f.q) seletor = '[data-q="' + f.q + '"] ' + seletor;
        else if (f.s) seletor = '[data-s="' + f.s + '"] ' + seletor;
        const campo = document.querySelector('#editor ' + seletor);
        if (!campo || campo.disabled) return;
        campo.focus({ preventScroll: true });
        try { if (f.inicio != null) campo.setSelectionRange(f.inicio, f.fim); } catch (e) { /* campo sem seleção */ }
        $('editor').scrollTop = f.rolagem;
    }

    /* Redesenhar a prova no meio de uma frase tiraria o cursor do lugar:
       enquanto a pessoa digita, as mudanças dos colegas esperam um pouco. */
    let ultimaDigitacao = 0;
    $('editor').addEventListener('input', function () { ultimaDigitacao = Date.now(); });
    function digitando() {
        const a = document.activeElement;
        return !!a && $('editor').contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|search|number|date)$/.test(a.type))) &&
            Date.now() - ultimaDigitacao < 3000;
    }

    const receberMudancas = debounce(async function () {
        if (!prova || !prova.nuvem) return;
        if (digitando()) {
            esperandoParaReceber = true;
            setTimeout(function () { if (esperandoParaReceber) receberMudancas(); }, 3200);
            return;
        }
        esperandoParaReceber = false;
        const alvo = prova;
        try {
            const r = await Nuvem.atualizarDoServidor(alvo);
            if (prova !== alvo) return;
            if (r.apagada) { alert('Esta prova foi apagada pelo PCA.'); location.hash = '#/'; return; }
            comentariosNuvem = await Nuvem.comentarios(alvo.nuvem.id).catch(function () { return comentariosNuvem; });
            if (prova !== alvo) return;
            const foco = lembrarFoco();
            redesenharTudo();
            devolverFoco(foco);
            paginar();
            Armazem.salvar(alvo).catch(function () {});
            atualizarChipNuvem();
        } catch (e) { /* sem rede: tenta de novo na próxima mudança */ }
    }, 700);

    $('editor').addEventListener('focusout', function () {
        if (esperandoParaReceber) setTimeout(function () { if (!digitando()) receberMudancas(); }, 400);
    });
    window.addEventListener('online', function () { if (prova && prova.nuvem) { enviarNuvem().then(receberMudancas); } });
    window.addEventListener('offline', function () { if (prova && prova.nuvem) { prova.nuvem.offline = true; atualizarChipNuvem(); } });

    async function abrirProvaNuvem(id) {
        if (!Nuvem.perfil()) { location.hash = '#/entrar'; return; }
        mostrar('editor');
        $('ed-titulo').textContent = 'Abrindo a prova da área…';
        $('secoes').innerHTML = '<p class="vazio">Carregando…</p>';
        const cache = await Armazem.obter('nuvem:' + id).catch(function () { return null; });
        let p = null;
        try {
            p = await Nuvem.carregarProva(id);
            if (!p) { alert('Esta prova não existe mais ou você não tem acesso a ela.'); location.hash = '#/'; return; }
            if (cache && cache.nuvem && Nuvem.pendencias(cache) > 0) {
                /* havia alterações feitas sem internet: elas valem e vão agora */
                p = cache;
            }
        } catch (erro) {
            if (!cache) { alert('Sem conexão, e esta prova ainda não foi aberta neste aparelho.'); location.hash = '#/'; return; }
            p = cache;
            p.nuvem.offline = true;
        }
        perfisNuvem = await Nuvem.perfis().catch(function () { return perfisNuvem; });
        comentariosNuvem = await Nuvem.comentarios(p.nuvem.id).catch(function () { return []; });
        abrirProva(p);
        Armazem.salvar(p).catch(function () {});
        atualizarChipNuvem();
        if (Nuvem.pendencias(p) > 0) enviarNuvem().then(receberMudancas);
        pararAssinatura = Nuvem.assinar(id, function () { receberMudancas(); });
        /* rede de segurança: se o tempo real cair, confere de tempos em tempos */
        relogioNuvem = setInterval(function () {
            if (!prova || !prova.nuvem) return;
            if (Nuvem.pendencias(prova) > 0) enviarNuvem();
            receberMudancas();
        }, 45000);
    }

    function fecharNuvem() {
        if (prova && prova.nuvem && Nuvem.pendencias(prova) > 0) Nuvem.sincronizar(prova);
        if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
        if (relogioNuvem) { clearInterval(relogioNuvem); relogioNuvem = null; }
        comentariosNuvem = [];
    }

    async function acaoDaArea(acao, secao, botao) {
        const n = prova.nuvem;
        try {
            if (acao === 'nv-comentar') {
                const campo = botao.closest('.comentar').querySelector('[data-comentar]');
                const texto = campo.value.trim();
                if (!texto) return;
                await Nuvem.comentar(n.id, secao.id, texto);
                comentariosAbertos.add(secao.id);
                campo.value = '';
            } else if (acao === 'nv-pronta') {
                await enviarNuvem();
                if (Nuvem.pendencias(prova) > 0) { alert('Ainda há alterações que não chegaram ao servidor. Confira a conexão e tente de novo.'); return; }
                const nota = prompt('Recado para o PCA (opcional):', '');
                if (nota === null) return;
                await Nuvem.marcarSecao(secao.id, true, nota);
            } else if (acao === 'nv-editar') {
                await Nuvem.marcarSecao(secao.id, false);
            } else if (acao === 'nv-aprovar') {
                await enviarNuvem();
                await Nuvem.decidirSecao(n.id, secao.id, 'aprovada', '');
            } else if (acao === 'nv-reabrir') {
                await Nuvem.decidirSecao(n.id, secao.id, 'rascunho', 'Seção reaberta para ajustes.');
            } else if (acao === 'nv-devolver') {
                const texto = prompt('O que precisa ser ajustado? (vai para o professor, junto com a seção)', '');
                if (texto === null) return;
                if (!texto.trim()) { alert('Escreva o que precisa ser ajustado.'); return; }
                await Nuvem.decidirSecao(n.id, secao.id, 'devolvida', texto);
                comentariosAbertos.add(secao.id);
            }
            receberMudancas.agora();
        } catch (erro) {
            alert(Nuvem.mensagem(erro));
        }
    }

    caixaSecoes.addEventListener('change', function (e) {
        if (e.target.dataset.campo !== 'secao-responsavel') return;
        const secao = prova.secoes.find(function (s) { return s.id === e.target.closest('[data-s]').dataset.s; });
        marcar();
        secao.responsavel = e.target.value || null;
        mudou();
    });
    caixaSecoes.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-comentar]')) {
            e.preventDefault();
            e.target.closest('.comentar').querySelector('[data-acao="nv-comentar"]').click();
        }
    });
    caixaSecoes.addEventListener('toggle', function (e) {
        const d = e.target;
        if (!d.dataset || !d.dataset.comentarios) return;
        if (d.open) comentariosAbertos.add(d.dataset.comentarios); else comentariosAbertos.delete(d.dataset.comentarios);
    }, true);

    $('ed-travar').onclick = async function () {
        const n = prova.nuvem;
        const travar = n.situacao !== 'travada';
        if (travar) {
            await enviarNuvem();
            const faltam = prova.secoes.filter(function (s) { const m = n.secoes[s.id]; return !m || m.situacao !== 'aprovada'; });
            const aviso = faltam.length ? '\n\nAinda não aprovadas: ' + faltam.map(function (s) { return s.titulo || '(sem título)'; }).join(', ') + '.' : '';
            if (!confirm('Travar a prova para impressão? Ninguém mais altera até você destravar.' + aviso)) return;
        }
        try {
            await Nuvem.travar(n.id, travar);
            n.situacao = travar ? 'travada' : 'aberta';
            redesenharTudo();
            receberMudancas();
        } catch (e) { alert(Nuvem.mensagem(e)); }
    };

    /* ----- início: conta e provas da área ----- */

    function desenharConta() {
        const caixa = $('conta');
        if (!Nuvem.disponivel()) { caixa.innerHTML = ''; return; }
        const p = Nuvem.perfil();
        if (!p) {
            caixa.innerHTML = '<a class="btn btn--pequeno" href="#/entrar">Entrar para as provas da área</a>';
            return;
        }
        caixa.innerHTML = '<span class="conta-nome">' + esc(p.nome) + '<small>' + esc(NOMES_PAPEL[p.papel] || p.papel) +
            (p.area ? ' · ' + esc(NOMES_AREA[p.area] || p.area) : '') + '</small></span>' +
            (p.papel === 'gestao' ? '<a class="btn btn--pequeno" href="#/admin">Professores</a>' : '') +
            '<button type="button" class="btn btn--pequeno" id="conta-senha">Trocar senha</button>' +
            '<button type="button" class="btn btn--pequeno" id="conta-sair">Sair</button>';
        $('conta-sair').onclick = async function () { await Nuvem.sair(); desenharInicio(); };
        $('conta-senha').onclick = function () {
            $('senha-nova').value = '';
            $('senha-nova2').value = '';
            $('senha-erro').hidden = true;
            $('dialogo-senha').showModal();
        };
    }

    $('senha-salvar').onclick = async function () {
        const a = $('senha-nova').value;
        const b = $('senha-nova2').value;
        const erro = $('senha-erro');
        erro.hidden = true;
        if (a !== b) { erro.textContent = 'As duas senhas não são iguais.'; erro.hidden = false; return; }
        try {
            await Nuvem.trocarSenha(a);
            $('dialogo-senha').close();
            alert('Senha trocada.');
        } catch (e) { erro.textContent = e.message; erro.hidden = false; }
    };

    async function desenharArea() {
        const bloco = $('bloco-area');
        const p = Nuvem.perfil();
        bloco.hidden = !p;
        if (!p) return;
        const coordenaAlguma = p.papel === 'gestao' || p.papel === 'pca';
        $('nova-prova-area').hidden = !coordenaAlguma;
        const destino = $('lista-area');
        let provas;
        let local = false;
        try {
            provas = await Nuvem.listarProvas();
        } catch (e) {
            /* sem internet: as que já foram abertas neste aparelho */
            local = true;
            provas = (await Armazem.listar()).filter(function (x) { return x.nuvem; }).map(function (x) {
                return { id: x.nuvem.id, titulo: x.titulo, serie: x.serie, bimestre: x.bimestre, ano: x.ano, componente: x.nuvem.componente,
                    situacao: x.nuvem.situacao, prazo: x.nuvem.prazo, secoes: x.secoes.map(function (s) {
                        return { id: s.id, titulo: s.titulo, responsavel: s.responsavel, situacao: (x.nuvem.secoes[s.id] || {}).situacao || 'rascunho', total: s.questoes.length };
                    }) };
            });
        }
        destino.innerHTML = '';
        if (local) destino.appendChild(el('p', 'aviso', 'Sem conexão: mostrando as provas da área já abertas neste aparelho.'));
        if (!provas.length) {
            destino.appendChild(el('p', 'vazio', coordenaAlguma ? 'Nenhuma prova da área ainda. Crie a primeira em "+ Nova prova da área".'
                : 'Nenhuma prova da área para você ainda. Quando o PCA criar uma com uma seção sua, ela aparece aqui.'));
            return;
        }
        provas.forEach(function (x) {
            const minhas = x.secoes.filter(function (s) { return s.responsavel === p.id; });
            const prontas = x.secoes.filter(function (s) { return s.situacao === 'pronta' || s.situacao === 'aprovada'; }).length;
            const coord = Nuvem.coordena(x.componente);
            const meta = [NOMES_AREA[x.componente] || x.componente, x.serie ? x.serie + 'ª série' : '', x.bimestre ? x.bimestre.replace('B', '') + 'º bim.' : '',
                prontas + '/' + x.secoes.length + ' seções prontas', x.prazo ? 'prazo ' + dataCurta(x.prazo) : ''].filter(Boolean).join(' · ');
            destino.appendChild(el('div', 'prova-linha',
                '<div class="info"><strong>' + situacaoHtml(x.situacao === 'travada' ? 'travada' : 'aberta', x.situacao === 'travada' ? '🔒 travada' : 'aberta') + ' ' +
                esc(x.titulo || 'Prova da área') + '</strong><span class="meta">' + esc(meta) + '</span>' +
                (minhas.length ? '<div class="minhas-secoes">' + minhas.map(function (s) {
                    return '<span class="situacao situacao--' + esc(s.situacao) + '">' + esc((s.titulo || 'Seção') + ': ' + s.total + ' questões · ' + (NOMES_SITUACAO[s.situacao] || s.situacao)) + '</span>';
                }).join('') + '</div>' : '') + '</div>' +
                '<div class="acoes"><a class="btn btn--primary btn--pequeno" href="#/area/' + encodeURIComponent(x.id) + '">Abrir</a>' +
                (coord && !local ? '<button type="button" class="btn btn--pequeno" data-apagar-area="' + esc(x.id) + '">Apagar</button>' : '') + '</div>'));
        });
    }

    $('lista-area').addEventListener('click', async function (e) {
        const b = e.target.closest('[data-apagar-area]');
        if (!b) return;
        if (!confirm('Apagar esta prova da área para todos os professores? As questões dela somem junto. Não dá para desfazer.')) return;
        try { await Nuvem.apagarProva(b.dataset.apagarArea); desenharArea(); }
        catch (erro) { alert(Nuvem.mensagem(erro)); }
    });

    /* ----- nova prova da área ----- */

    function linhaSecaoArea(titulo, responsavel, componente) {
        const opcoes = [['', '— escolher depois —']].concat(perfisNuvem.filter(function (p) {
            return p.ativo && (p.area === componente || p.papel === 'gestao');
        }).map(function (p) { return [p.id, p.nome + (p.papel === 'pca' ? ' (PCA)' : '') + (p.disciplinas && p.disciplinas.length ? ' — ' + p.disciplinas.join(', ') : '')]; }));
        const linha = el('div', 'area-secao',
            '<input type="text" data-area-titulo value="' + esc(titulo) + '" placeholder="Título da seção">' +
            '<select data-area-resp>' + opcoesHtml(opcoes, responsavel || '') + '</select>' +
            '<button type="button" class="icone icone--perigo" data-area-tirar title="Tirar a seção">✕</button>');
        return linha;
    }

    /* o professor cuja disciplina tem o nome da seção é o responsável sugerido */
    function responsavelSugerido(titulo, componente) {
        const alvo = normalizar(titulo);
        const achado = perfisNuvem.find(function (p) {
            return p.ativo && p.area === componente && (p.disciplinas || []).some(function (d) {
                const nd = normalizar(d);
                return nd && (alvo.indexOf(nd) !== -1 || nd.indexOf(alvo) !== -1);
            });
        });
        return achado ? achado.id : '';
    }

    function preencherSecoesArea() {
        const componente = $('area-componente').value;
        const caixa = $('area-secoes');
        caixa.innerHTML = '';
        const comp = Modelos.COMPONENTES[componente];
        (comp ? comp.secoes : ['']).forEach(function (t) {
            caixa.appendChild(linhaSecaoArea(t, responsavelSugerido(t, componente), componente));
        });
    }

    $('nova-prova-area').onclick = async function () {
        const p = Nuvem.perfil();
        perfisNuvem = await Nuvem.perfis().catch(function () { return perfisNuvem; });
        $('area-modelo').innerHTML = opcoesHtml(Modelos.listar().map(function (m) { return [m.id, m.nome]; }), Modelos.FIXO_ID);
        $('area-componente').value = p.area || 'NAT';
        $('area-componente').disabled = p.papel !== 'gestao';
        $('area-serie').value = '1';
        $('area-bimestre').value = 'B' + Math.min(4, Math.max(1, Math.ceil((new Date().getMonth() + 1 - 1) / 3)));
        $('area-ano').value = String(new Date().getFullYear());
        $('area-prazo').value = '';
        $('area-erro').hidden = true;
        preencherSecoesArea();
        $('dialogo-area').showModal();
    };
    $('area-componente').addEventListener('change', preencherSecoesArea);
    $('area-mais').onclick = function () { $('area-secoes').appendChild(linhaSecaoArea('', '', $('area-componente').value)); };
    $('area-secoes').addEventListener('click', function (e) {
        const b = e.target.closest('[data-area-tirar]');
        if (b) b.closest('.area-secao').remove();
    });
    $('area-criar').onclick = async function () {
        const erro = $('area-erro');
        erro.hidden = true;
        const secoes = Array.from($('area-secoes').querySelectorAll('.area-secao')).map(function (l) {
            return { titulo: l.querySelector('[data-area-titulo]').value.trim().toUpperCase(), responsavel: l.querySelector('[data-area-resp]').value || null };
        }).filter(function (s) { return s.titulo; });
        if (!secoes.length) { erro.textContent = 'Crie pelo menos uma seção.'; erro.hidden = false; return; }
        $('area-criar').disabled = true;
        try {
            const id = await Nuvem.criarProva({
                modeloId: $('area-modelo').value, componente: $('area-componente').value, serie: $('area-serie').value,
                bimestre: $('area-bimestre').value, ano: $('area-ano').value, prazo: $('area-prazo').value || null, secoes: secoes
            });
            $('dialogo-area').close();
            location.hash = '#/area/' + encodeURIComponent(id);
        } catch (e) {
            erro.textContent = Nuvem.mensagem(e);
            erro.hidden = false;
        } finally {
            $('area-criar').disabled = false;
        }
    };

    /* ----- entrar ----- */

    async function abrirEntrar() {
        mostrar('entrar');
        document.title = 'Entrar — Montador de Provas da Malu';
        $('entrar-erro').hidden = true;
        $('form-primeiro').hidden = true;
        if (Nuvem.perfil()) { location.hash = '#/'; return; }
        $('form-primeiro').hidden = !(await Nuvem.primeiroAcessoAberto());
    }

    $('form-entrar').addEventListener('submit', async function (e) {
        e.preventDefault();
        const erro = $('entrar-erro');
        erro.hidden = true;
        $('entrar-botao').disabled = true;
        try {
            await Nuvem.entrar($('entrar-email').value, $('entrar-senha').value);
            $('entrar-senha').value = '';
            location.hash = '#/';
        } catch (falha) {
            erro.textContent = falha.message;
            erro.hidden = false;
        } finally {
            $('entrar-botao').disabled = false;
        }
    });

    $('form-primeiro').addEventListener('submit', async function (e) {
        e.preventDefault();
        const erro = $('primeiro-erro');
        erro.hidden = true;
        if ($('primeiro-senha').value !== $('primeiro-senha2').value) { erro.textContent = 'As duas senhas não são iguais.'; erro.hidden = false; return; }
        $('primeiro-botao').disabled = true;
        try {
            await Nuvem.primeiroAcesso({ nome: $('primeiro-nome').value, email: $('primeiro-email').value, senha: $('primeiro-senha').value });
            location.hash = '#/admin';
        } catch (falha) {
            erro.textContent = falha.message;
            erro.hidden = false;
        } finally {
            $('primeiro-botao').disabled = false;
        }
    });

    /* ----- administração (gestão) ----- */

    let professoresAdmin = [];

    async function abrirAdmin() {
        const p = Nuvem.perfil();
        if (!p) { location.hash = '#/entrar'; return; }
        if (p.papel !== 'gestao') { location.hash = '#/'; return; }
        mostrar('admin');
        document.title = 'Professores — Montador de Provas da Malu';
        limparFormProfessor();
        await desenharProfessores();
    }

    async function desenharProfessores() {
        const destino = $('lista-prof');
        try {
            professoresAdmin = await Nuvem.perfis();
        } catch (e) {
            destino.innerHTML = '<p class="aviso aviso--erro">' + esc(Nuvem.mensagem(e)) + '</p>';
            return;
        }
        const termo = normalizar($('busca-prof').value);
        destino.innerHTML = '';
        const lista = professoresAdmin.filter(function (x) {
            return !termo || normalizar([x.nome, x.email, NOMES_AREA[x.area], (x.disciplinas || []).join(' ')].join(' ')).indexOf(termo) !== -1;
        });
        if (!lista.length) destino.appendChild(el('p', 'vazio', 'Ninguém cadastrado ainda.'));
        lista.forEach(function (x) {
            const meta = [NOMES_PAPEL[x.papel], NOMES_AREA[x.area], (x.disciplinas || []).join(', '), x.email].filter(Boolean).join(' · ');
            destino.appendChild(el('div', 'prova-linha',
                '<div class="info"><strong>' + esc(x.nome) + (x.ativo ? '' : ' ' + situacaoHtml('devolvida', 'desativado')) + '</strong><span class="meta">' + esc(meta) + '</span></div>' +
                '<div class="acoes">' +
                '<button type="button" class="btn btn--pequeno" data-prof-editar="' + esc(x.id) + '">Editar</button>' +
                '<button type="button" class="btn btn--pequeno" data-prof-ativo="' + esc(x.id) + '">' + (x.ativo ? 'Desativar' : 'Reativar') + '</button>' +
                (x.id === Nuvem.perfil().id ? '' : '<button type="button" class="btn btn--pequeno" data-prof-excluir="' + esc(x.id) + '">Excluir</button>') +
                '</div>'));
        });
    }
    $('busca-prof').addEventListener('input', desenharProfessores);

    function limparFormProfessor() {
        $('prof-id').value = '';
        ['prof-nome', 'prof-email', 'prof-disciplinas', 'prof-senha'].forEach(function (id) { $(id).value = ''; });
        $('prof-papel').value = 'professor';
        $('prof-area').value = '';
        $('form-professor-titulo').textContent = 'Cadastrar professor';
        $('prof-senha-rotulo').textContent = 'Senha provisória (mín. 8)';
        $('prof-salvar').textContent = 'Cadastrar';
        $('prof-cancelar').hidden = true;
        $('prof-erro').hidden = true;
    }

    function senhaAleatoria() {
        const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const n = new Uint32Array(10);
        (window.crypto || {}).getRandomValues ? crypto.getRandomValues(n) : n.forEach(function (_, i) { n[i] = Math.random() * 1e9; });
        return Array.from(n).map(function (v) { return letras[v % letras.length]; }).join('');
    }
    $('prof-gerar').onclick = function () { $('prof-senha').value = senhaAleatoria(); };
    $('prof-cancelar').onclick = limparFormProfessor;

    $('form-professor').addEventListener('submit', async function (e) {
        e.preventDefault();
        const erro = $('prof-erro');
        const ok = $('prof-ok');
        erro.hidden = true;
        ok.hidden = true;
        const id = $('prof-id').value;
        const dados = {
            nome: $('prof-nome').value.trim(), email: $('prof-email').value.trim(), papel: $('prof-papel').value,
            area: $('prof-area').value || null, disciplinas: $('prof-disciplinas').value
        };
        const senha = $('prof-senha').value;
        if (senha) dados.senha = senha;
        if (!id && !senha) { erro.textContent = 'Defina a senha provisória (o botão Gerar cria uma).'; erro.hidden = false; return; }
        $('prof-salvar').disabled = true;
        try {
            if (id) await Nuvem.atualizarProfessor(id, dados);
            else await Nuvem.criarProfessor(dados);
            ok.textContent = (id ? 'Alterações salvas: ' : 'Cadastrado: ') + dados.nome + (senha ? ' — senha: ' + senha + ' (anote e passe ao professor)' : '') + '.';
            ok.hidden = false;
            limparFormProfessor();
            await desenharProfessores();
        } catch (falha) {
            erro.textContent = falha.message;
            erro.hidden = false;
        } finally {
            $('prof-salvar').disabled = false;
        }
    });

    $('lista-prof').addEventListener('click', async function (e) {
        const b = e.target.closest('button');
        if (!b) return;
        const id = b.dataset.profEditar || b.dataset.profAtivo || b.dataset.profExcluir;
        const x = professoresAdmin.find(function (y) { return y.id === id; });
        if (!x) return;
        try {
            if (b.dataset.profEditar) {
                $('prof-id').value = x.id;
                $('prof-nome').value = x.nome;
                $('prof-email').value = x.email;
                $('prof-papel').value = x.papel;
                $('prof-area').value = x.area || '';
                $('prof-disciplinas').value = (x.disciplinas || []).join(', ');
                $('prof-senha').value = '';
                $('form-professor-titulo').textContent = 'Editar ' + x.nome;
                $('prof-senha-rotulo').textContent = 'Nova senha (deixe vazio para manter a atual)';
                $('prof-salvar').textContent = 'Salvar alterações';
                $('prof-cancelar').hidden = false;
                $('prof-ok').hidden = true;
                window.scrollTo(0, 0);
                $('prof-nome').focus();
            } else if (b.dataset.profAtivo) {
                if (x.ativo && !confirm('Desativar ' + x.nome + '? A pessoa não consegue mais entrar; as questões dela continuam nas provas.')) return;
                await Nuvem.atualizarProfessor(x.id, { ativo: !x.ativo });
                await desenharProfessores();
            } else if (b.dataset.profExcluir) {
                if (!confirm('Excluir a conta de ' + x.nome + '? As questões dela continuam nas provas, sem o nome. Para só impedir o acesso, use Desativar.')) return;
                await Nuvem.excluirProfessor(x.id);
                await desenharProfessores();
            }
        } catch (falha) { alert(falha.message); }
    });


    /* ===================== editor de modelo ===================== */

    const EXEMPLO_TEXTO = 'Este é um enunciado de exemplo, com o tamanho de uma questão comum, para mostrar como o texto corre pelas colunas, onde quebra a linha e quanto espaço sobra entre uma questão e outra.';

    function abrirModelo(id) {
        const base = id ? Modelos.obter(id) : null;
        if (id && !base) { location.hash = '#/'; return; }
        if (base && base.fixo) {
            modeloEdit = Modelos.copiar(base);
            delete modeloEdit.id;
            delete modeloEdit.fixo;
            modeloEdit.nome = base.nome + ' (variação)';
            modeloEdit.descricao = 'Variação do modelo padrão.';
            $('mo-cabecalho').textContent = 'Novo modelo a partir da Avaliação Bimestral Malu';
        } else if (base) {
            modeloEdit = Modelos.copiar(base);
            $('mo-cabecalho').textContent = 'Editar modelo';
        } else {
            modeloEdit = { nome: '', descricao: '', tituloPadrao: '', secoesIniciais: [], layout: Modelos.completarLayout({}) };
            $('mo-cabecalho').textContent = 'Novo modelo';
        }
        mostrar('modelo');
        document.title = 'Modelo — Montador de Provas da Malu';
        $('mo-nome').value = modeloEdit.nome;
        $('mo-descricao').value = modeloEdit.descricao || '';
        $('mo-titulo').value = modeloEdit.tituloPadrao || '';
        const porComponente = modeloEdit.secoesIniciais === 'componente';
        document.querySelector('input[name="mo-secoes"][value="componente"]').checked = porComponente;
        document.querySelector('input[name="mo-secoes"][value="lista"]').checked = !porComponente;
        $('mo-lista-secoes').value = porComponente ? '' : (modeloEdit.secoesIniciais || []).join('\n');
        formLayout($('mo-formato'), modeloEdit.layout, previaModelo, true);
        previaModelo();
    }

    function lerSecoesModelo() {
        const porComponente = document.querySelector('input[name="mo-secoes"][value="componente"]').checked;
        return porComponente ? 'componente' : $('mo-lista-secoes').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    }

    const previaModelo = debounce(function () {
        if (!modeloEdit) return;
        modeloEdit.secoesIniciais = lerSecoesModelo();
        const demo = Modelos.criarProva(Object.assign({}, modeloEdit, { fixo: false, id: 'demo' }), { serie: '2', componente: 'NAT', disciplina: 'Biologia' });
        demo.professor = 'Nome do(a) professor(a)';
        demo.turma = 'B';
        let n = 0;
        demo.secoes.forEach(function (s, i) {
            const quantas = i === 0 ? 4 : 2;
            for (let k = 0; k < quantas; k++) {
                n++;
                const discursiva = k === quantas - 1 && i === demo.secoes.length - 1;
                const q = Modelos.novaQuestao(discursiva ? 'discursiva' : 'objetiva', 5);
                q.fonte = n % 2 ? 'Enem' : '';
                q.enunciado = EXEMPLO_TEXTO + (n % 3 === 0 ? '\n' + EXEMPLO_TEXTO : '');
                q.alternativas = n % 2
                    ? ['Primeira alternativa de exemplo.', 'Segunda alternativa, um pouco mais comprida que a primeira.', 'Terceira alternativa.', 'Quarta alternativa de exemplo.', 'Quinta alternativa.']
                    : ['12', '15', '18', '21', '24'];
                q.linhas = 5;
                s.questoes.push(q);
            }
        });
        Paginar.montar(demo, $('mo-paginas'), {});
        aplicarZoomModelo();
    }, 200);

    function aplicarZoomModelo() {
        const salvo = zoom;
        zoom = 'ajustar';
        aplicarZoom($('mo-paginas'), $('mo-previa-escala'), $('mo-previa-escala').parentElement);
        zoom = salvo;
    }

    ['mo-titulo', 'mo-lista-secoes'].forEach(function (id) { $(id).addEventListener('input', previaModelo); });
    document.querySelectorAll('input[name="mo-secoes"]').forEach(function (r) { r.addEventListener('change', previaModelo); });

    $('mo-salvar').onclick = function () {
        const nome = $('mo-nome').value.trim();
        if (!nome) { alert('Dê um nome ao modelo.'); $('mo-nome').focus(); return; }
        modeloEdit.nome = nome;
        modeloEdit.descricao = $('mo-descricao').value.trim();
        modeloEdit.tituloPadrao = $('mo-titulo').value.trim();
        modeloEdit.secoesIniciais = lerSecoesModelo();
        Modelos.salvar(modeloEdit);
        modeloEdit = null;
        location.hash = '#/';
    };

    /* ===================== partida ===================== */

    window.addEventListener('hashchange', rota);
    window.addEventListener('beforeunload', function () { if (prova && salvar.pendente()) salvar.agora(); });
    window.MontadorProvas = { estado: function () { return prova; }, repaginar: repaginar, resultado: function () { return ultimoResultado; } };
    /* a sessão (se houver) é lida antes da primeira tela; sem internet vale a última */
    (Nuvem.disponivel() ? Nuvem.iniciar().catch(function () { return null; }) : Promise.resolve(null)).then(rota);
})();
