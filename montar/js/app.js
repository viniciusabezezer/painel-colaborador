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
        ['inicio', 'editor', 'modelo'].forEach(function (t) { $('tela-' + t).hidden = t !== tela; });
        document.body.dataset.tela = tela;
        window.scrollTo(0, 0);
    }

    async function rota() {
        if (prova) salvar.agora();
        const partes = location.hash.replace(/^#\/?/, '').split('/');
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

        provasDoInicio = await Armazem.listar();
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
            const tipo = a.tipo === 'gabarito' ? 'Gabarito do professor' : (a.paginas + (a.paginas === 1 ? ' página' : ' páginas'));
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
                '</div>' : '') +
            '<div class="linha-campos">' +
            '<label>Colunas<select data-l="colunas" data-num>' + opcoesHtml([[2, 'Duas'], [1, 'Uma']], layout.colunas) + '</select></label>' +
            '<label>Alternativas<select data-l="alternativas" data-num>' + opcoesHtml([[5, 'Cinco (a–e)'], [4, 'Quatro (a–d)']], layout.alternativas) + '</select></label>' +
            '<label>Letras<select data-l="letras">' + opcoesHtml([['a)', 'a) b) c)'], ['A)', 'A) B) C)'], ['(A)', '(A) (B) (C)']], layout.letras) + '</select></label>' +
            '<label>Numeração<select data-l="numeracao">' + opcoesHtml([['01.', '01. 02.'], ['1.', '1. 2.'], ['QUESTÃO 01', 'QUESTÃO 01']], layout.numeracao) + '</select></label>' +
            '</div>' +
            (comAparencia ?
                '<label class="opcao"><input type="checkbox" data-l="gabarito"' + (layout.gabarito ? ' checked' : '') + '> Gabarito com bolhas e marcas de alinhamento na 1ª página</label>' +
                '<label class="opcao"><input type="checkbox" data-l="icones"' + (layout.icones ? ' checked' : '') + '> Ícone da disciplina nos títulos das seções</label>' +
                '<label class="opcao"><input type="checkbox" data-l="imagensCinza"' + (layout.imagensCinza ? ' checked' : '') + '> Imagens em tons de cinza (economiza tinta)</label>' : '') +
            '<label class="opcao"><input type="checkbox" data-l="linhaColunas"' + (layout.linhaColunas ? ' checked' : '') + '> Linha entre as colunas</label>' +
            '<label class="opcao"><input type="checkbox" data-l="numeroPagina"' + (layout.numeroPagina ? ' checked' : '') + '> Número da página no pé (1/8)</label>' +
            '<label class="opcao"><input type="checkbox" data-l="instrucoes"' + (layout.instrucoes ? ' checked' : '') + '> Quadro de instruções</label>' +
            '<label data-se="instrucoes" class="campo-coluna"><textarea data-l="textoInstrucoes" rows="5" placeholder="Uma instrução por linha. **negrito** vale aqui também.">' +
            esc(layout.textoInstrucoes.join('\n')) + '</textarea></label>';

        function visibilidade() {
            caixa.querySelector('[data-se="faixa"]').hidden = layout.cabecalho !== 'faixa';
            caixa.querySelector('[data-se="instrucoes"]').hidden = !layout.instrucoes;
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
        $('ed-status').textContent = 'Salvando…';
        const alvo = prova;
        Armazem.salvar(alvo).then(function () {
            if (prova === alvo) $('ed-status').textContent = 'Salvo neste navegador';
        });
    }, 600);

    const paginar = debounce(repaginar, 250);

    function mudou() {
        $('ed-status').textContent = 'Alterado';
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
        prova = JSON.parse(anterior);
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
        if (!Modelos.questoesNumeradas(p).length && !p.secoes.some(function (s) { return s.questoes.length; })) {
            /* prova nova: a primeira seção já ganha uma questão aberta */
            const q = Modelos.novaQuestao('objetiva', 5);
            p.secoes[0].questoes.push(q);
            abertas.add(q.id);
        }
        mostrar('editor');
        $('ed-modelo').textContent = (p.fixo ? '🔒 ' : '') + p.modeloNome;
        $('ed-modelo').className = 'selo' + (p.fixo ? ' selo--fixo' : '');
        $('ed-status').textContent = 'Salvo neste navegador';
        document.title = (p.titulo || 'Prova') + ' — Montador de Provas da Malu';
        $('copias').value = guardado('copias', '35');
        zoom = 'ajustar';
        redesenharTudo();
        repaginar();
    }

    function redesenharTudo() {
        $('ed-titulo').textContent = prova.titulo || 'Prova sem título';
        preencherDados();
        preencherAparencia();
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
    $('ap-corpo').innerHTML = opcoesCorpo(10);

    function preencherAparencia() {
        const layout = Modelos.layoutDaProva(prova);
        document.querySelectorAll('#editor [data-a]').forEach(function (campo) {
            const v = layout[campo.dataset.a];
            if (campo.type === 'checkbox') campo.checked = !!v;
            else campo.value = v;
        });
    }

    document.querySelectorAll('#editor [data-a]').forEach(function (campo) {
        campo.addEventListener('change', function () {
            const nome = campo.dataset.a;
            prova.ajustes = prova.ajustes || {};
            prova.ajustes[nome] = campo.type === 'checkbox' ? campo.checked : ('num' in campo.dataset ? Number(campo.value) : campo.value);
            $('proposta').hidden = true;
            mudou();
        });
    });

    function desenharFormato() {
        const caixa = $('formato');
        if (prova.fixo) {
            const layout = Modelos.layoutDaProva(prova);
            caixa.innerHTML = '<div class="formato-travado"><strong>🔒 Formato fixo da Avaliação Bimestral Malu</strong>' +
                '<ul><li>Faixa de ' + virgula(layout.faixaCm) + ' cm para o cabeçalho do Identificador de Provas, com o brasão</li>' +
                '<li>Quadro de instruções da escola</li><li>Gabarito com as marcas de alinhamento (até ' + Gabarito.capacidade() + ' questões) — pode tirar no passo 2</li>' +
                '<li>Duas colunas, alternativas de a) a e), numeração 01.</li></ul>' +
                'Fonte, tamanho, espaçamento e gabarito você ajusta no passo 2. Se esta prova precisa de outro formato, ' +
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

    function questaoHtml(q, numero, layout) {
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
        caixa.innerHTML = prova.secoes.map(function (s, i) {
            const icone = Icones.resolver(s.icone, s.titulo);
            return '<div class="secao" data-s="' + s.id + '">' +
                '<div class="secao-cab"><span class="secao-icone">' + (icone ? Icones.svg(icone, 'icone-ui') : '') + '</span>' +
                '<input type="text" data-campo="secao-titulo" value="' + esc(s.titulo || '') + '" placeholder="Título da seção (ex.: BIOLOGIA) — opcional">' +
                '<button type="button" class="icone" data-acao="secao-subir" title="Subir a seção"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
                '<button type="button" class="icone" data-acao="secao-descer" title="Descer a seção"' + (i === prova.secoes.length - 1 ? ' disabled' : '') + '>↓</button>' +
                '<button type="button" class="icone icone--perigo" data-acao="secao-apagar" title="Apagar a seção">✕</button></div>' +
                '<div class="secao-icone-escolha"><select data-campo="secao-icone" aria-label="Ícone da seção">' + opcoesIcone(s) + '</select></div>' +
                s.questoes.map(function (q) {
                    if (q.tipo !== 'texto') n++;
                    return questaoHtml(q, n, layout);
                }).join('') +
                '<div class="secao-acoes"><button type="button" class="btn btn--pequeno" data-acao="add-objetiva">+ Objetiva</button>' +
                '<button type="button" class="btn btn--pequeno" data-acao="add-discursiva">+ Discursiva</button>' +
                '<button type="button" class="btn btn--pequeno" data-acao="add-texto">+ Texto de apoio</button></div></div>';
        }).join('');
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
    async function carregarImagem(arquivo) {
        const url = URL.createObjectURL(arquivo);
        try {
            const img = new Image();
            img.src = url;
            await img.decode();
            const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
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
        /* passou da borda: vai para a seção vizinha */
        const vizinha = secoes[si + passo];
        if (!vizinha) return;
        achado.secao.questoes.splice(achado.indice, 1);
        if (passo < 0) vizinha.questoes.push(achado.questao);
        else vizinha.questoes.unshift(achado.questao);
    }

    $('add-secao').onclick = function () {
        marcar();
        prova.secoes.push(Modelos.novaSecao(''));
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
        mostrarAvisos(r, Modelos.pendencias(prova));
        mostrarDisposicoes();
    }

    function atualizarTotalFolhas() {
        if (!ultimoResultado) return;
        const copias = Math.max(1, parseInt($('copias').value, 10) || 1);
        $('folhas-total').textContent = (folhasPorAluno(ultimoResultado.paginas) * copias) + ' folhas';
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
        };
    });

    window.addEventListener('resize', debounce(function () {
        if (document.body.dataset.tela === 'editor') aplicarZoom($('paginas'), $('previa-escala'), $('previa'));
        if (document.body.dataset.tela === 'modelo') aplicarZoomModelo();
    }, 150));

    /* ----- impressão ----- */

    let tituloAntesDeImprimir = null;

    function imprimir(chave) {
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
        /* No Chrome o print() espera a janela fechar; nos outros, o afterprint
           arruma. */
        setTimeout(depoisDeImprimir, 500);
    }

    function depoisDeImprimir() {
        document.body.classList.remove('imprimindo-chave');
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
        grupos.forEach(function (grupo) {
            let alvo = null;
            if (grupo.titulo) {
                alvo = prova.secoes.find(function (s) { return normalizar(s.titulo) === normalizar(grupo.titulo); });
                if (!alvo) {
                    alvo = prova.secoes.find(function (s) { return !String(s.titulo || '').trim() && !s.questoes.some(temConteudo); });
                    if (alvo) alvo.titulo = grupo.titulo;
                }
                if (!alvo) { alvo = Modelos.novaSecao(grupo.titulo); prova.secoes.push(alvo); }
            } else {
                alvo = prova.secoes[prova.secoes.length - 1];
            }
            alvo.questoes = alvo.questoes.filter(temConteudo).concat(grupo.questoes);
        });
        prova.secoes.forEach(function (s) { s.questoes = s.questoes.filter(temConteudo); });
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
    rota();
})();
