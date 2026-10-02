/* A tela do Montador de Provas: início (modelos e provas guardadas), editor
   da prova com a prévia paginada ao lado, e editor de modelos. */
(function () {
    'use strict';

    const Modelos = window.MontarModelos;
    const Texto = window.MontarTexto;
    const Paginar = window.MontarPaginar;
    const Armazem = window.MontarArmazem;
    const Importar = window.MontarImportar;
    const Gabarito = window.MontarGabarito;

    const $ = function (id) { return document.getElementById(id); };
    const esc = Texto.escapar;

    let prova = null;
    let abertas = new Set();
    let modeloEdit = null;
    let zoom = 'ajustar';
    let escalaAtual = 1;
    let lidoColar = null;

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
        itens.push({ faixa: 'faixa para o Identificador', completo: 'cabeçalho completo', nenhum: 'sem cabeçalho' }[layout.cabecalho]);
        if (layout.instrucoes) itens.push('instruções');
        if (layout.gabarito) itens.push('gabarito com bolhas');
        itens.push(layout.colunas === 2 ? 'duas colunas' : 'uma coluna');
        itens.push(layout.alternativas + ' alternativas');
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

    async function desenharInicio() {
        const lista = $('lista-modelos');
        lista.innerHTML = '';
        Modelos.listar().forEach(function (m) { lista.appendChild(cartaoModelo(m)); });
        lista.appendChild(cartaoModelo(Modelos.obter(Modelos.DO_ZERO_ID)));
        lista.appendChild(el('div', 'cartao cartao--novo',
            '<h3>+ Criar um modelo</h3><p>Um formato próprio — recuperação, simulado, lista de exercícios — para reaproveitar sempre que quiser.</p>' +
            '<div class="cartao-acoes"><a class="btn btn--pequeno" href="#/modelo">Criar modelo</a></div>'));

        const provas = await Armazem.listar();
        const destino = $('lista-provas');
        destino.innerHTML = '';
        if (!provas.length) destino.appendChild(el('p', 'vazio', 'Nenhuma prova ainda. Escolha um modelo acima para começar.'));
        provas.forEach(function (p) {
            const total = Modelos.questoesNumeradas(p).length;
            const meta = [p.modeloNome, p.serie ? p.serie + 'ª série' : '', p.componente || p.disciplina,
                total + (total === 1 ? ' questão' : ' questões'), 'editada em ' + dataHora(p.atualizadaEm)].filter(Boolean).join(' · ');
            const linha = el('div', 'prova-linha',
                '<div class="info"><strong>' + esc(p.titulo || 'Prova sem título') + '</strong><span class="meta">' + esc(meta) + '</span></div>' +
                '<div class="acoes">' +
                '<a class="btn btn--primary btn--pequeno" href="#/prova/' + encodeURIComponent(p.id) + '">Abrir</a>' +
                '<button type="button" class="btn btn--pequeno" data-duplicar="' + esc(p.id) + '">Duplicar</button>' +
                '<button type="button" class="btn btn--pequeno" data-exportar="' + esc(p.id) + '">Exportar</button>' +
                '<button type="button" class="btn btn--pequeno" data-apagar-prova="' + esc(p.id) + '">Apagar</button>' +
                '</div>');
            destino.appendChild(linha);
        });
        $('aviso-armazem').hidden = await Armazem.persistente();
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

    function exportar(p) {
        baixar(Modelos.nomeArquivo(p) + '.json', JSON.stringify({ app: 'montador-provas-malu', versao: 1, prova: p }, null, 1), 'application/json');
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
            const copia = Modelos.copiar(p);
            copia.id = Modelos.novoId('prova');
            copia.titulo = (p.titulo || 'Prova') + ' (cópia)';
            copia.criadaEm = Date.now();
            await Armazem.salvar(copia);
            desenharInicio();
        } else if (alvo.dataset.exportar) {
            exportar(await Armazem.obter(alvo.dataset.exportar));
        } else if (alvo.dataset.apagarProva) {
            const p = await Armazem.obter(alvo.dataset.apagarProva);
            if (p && confirm('Apagar a prova "' + (p.titulo || 'sem título') + '"? Não dá para desfazer.')) {
                await Armazem.apagar(p.id);
                desenharInicio();
            }
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
            p.id = Modelos.novoId('prova');
            await Armazem.salvar(p);
            desenharInicio();
        } catch (erro) {
            alert('Este arquivo não é uma prova exportada pelo Montador de Provas.');
        }
    });

    /* ===================== formato (prova e modelo) ===================== */

    function opcoesHtml(lista, atual) {
        return lista.map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(atual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('');
    }

    /* Monta o formulário do formato e mexe direto no objeto `layout`. */
    function formLayout(caixa, layout, aoMudar) {
        caixa.innerHTML =
            '<div class="linha-campos">' +
            '<label class="campo-largo">Cabeçalho da 1ª página<select data-l="cabecalho">' + opcoesHtml([
                ['faixa', 'Faixa em branco para o Identificador'],
                ['completo', 'Cabeçalho completo (escola, aluno, turma, nota)'],
                ['nenhum', 'Sem cabeçalho']], layout.cabecalho) + '</select></label>' +
            '<label data-se="faixa">Altura da faixa<select data-l="faixaCm" data-num>' + opcoesHtml([[2.5, '2,5 cm'], [3, '3 cm'], [3.5, '3,5 cm'], [4, '4 cm']], layout.faixaCm) + '</select></label>' +
            '</div>' +
            '<div class="linha-campos">' +
            '<label>Colunas<select data-l="colunas" data-num>' + opcoesHtml([[2, 'Duas'], [1, 'Uma']], layout.colunas) + '</select></label>' +
            '<label>Letra<select data-l="corpoPt" data-num>' + opcoesHtml([[9, '9 pt'], [9.5, '9,5 pt'], [10, '10 pt'], [10.5, '10,5 pt'], [11, '11 pt'], [11.5, '11,5 pt'], [12, '12 pt'], [13, '13 pt']], layout.corpoPt) + '</select></label>' +
            '<label>Alternativas<select data-l="alternativas" data-num>' + opcoesHtml([[5, 'Cinco (a–e)'], [4, 'Quatro (a–d)']], layout.alternativas) + '</select></label>' +
            '</div>' +
            '<div class="linha-campos">' +
            '<label>Letras<select data-l="letras">' + opcoesHtml([['a)', 'a) b) c)'], ['A)', 'A) B) C)'], ['(A)', '(A) (B) (C)']], layout.letras) + '</select></label>' +
            '<label>Numeração<select data-l="numeracao">' + opcoesHtml([['01.', '01. 02. 03.'], ['1.', '1. 2. 3.'], ['QUESTÃO 01', 'QUESTÃO 01']], layout.numeracao) + '</select></label>' +
            '</div>' +
            '<label class="opcao"><input type="checkbox" data-l="gabarito"' + (layout.gabarito ? ' checked' : '') + '> Gabarito com bolhas e marcas de alinhamento na 1ª página</label>' +
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

    function abrirProva(p) {
        prova = p;
        abertas = new Set();
        const todas = Modelos.questoesNumeradas(p);
        if (!todas.length) {
            /* prova nova: a primeira seção já ganha uma questão aberta */
            const q = Modelos.novaQuestao('objetiva', 5);
            p.secoes[0] = p.secoes[0] || Modelos.novaSecao('');
            p.secoes[0].questoes.push(q);
            abertas.add(q.id);
        }
        mostrar('editor');
        $('ed-titulo').textContent = p.titulo || 'Prova sem título';
        $('ed-modelo').textContent = (p.fixo ? '🔒 ' : '') + p.modeloNome;
        $('ed-modelo').className = 'selo' + (p.fixo ? ' selo--fixo' : '');
        $('ed-status').textContent = 'Salvo neste navegador';
        document.title = (p.titulo || 'Prova') + ' — Montador de Provas da Malu';
        preencherDados();
        desenharFormato();
        desenharSecoes();
        zoom = 'ajustar';
        repaginar();
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
            return s.questoes.every(function (q) { return !String(q.enunciado || '').trim() && !q.imagem; });
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

    function desenharFormato() {
        const caixa = $('formato');
        if (prova.fixo) {
            const layout = Modelos.layoutDaProva(prova);
            caixa.innerHTML = '<div class="formato-travado"><strong>🔒 Formato fixo da Avaliação Bimestral Malu</strong>' +
                '<ul><li>Faixa de ' + String(layout.faixaCm).replace('.', ',') + ' cm em branco para o Identificador de Provas</li>' +
                '<li>Quadro de instruções da escola</li><li>Gabarito com as marcas de alinhamento na 1ª página (até ' + Gabarito.capacidade() + ' questões)</li>' +
                '<li>Duas colunas, Arial ' + String(layout.corpoPt).replace('.', ',') + ' pt, alternativas de a) a e), numeração 01.</li></ul>' +
                'O conteúdo é todo seu; o formato é o da escola e não muda. Se esta prova precisa de outro formato, ' +
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
            if (campo === 'alternativas') desenharSecoes();
            mudou();
        });
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
        return { texto: q.imagem ? '(só imagem)' : 'enunciado ainda vazio', vazio: !q.imagem };
    }

    function etiqueta(q) {
        if (q.tipo === 'discursiva') return '<span class="q-tag">discursiva</span>';
        return q.correta ? '<span class="q-tag certa">' + q.correta + '</span>' : '<span class="q-tag falta">sem resposta</span>';
    }

    function questaoHtml(q, numero, layout) {
        const r = resumo(q);
        while (q.alternativas.length < 5 && q.tipo === 'objetiva') q.alternativas.push('');
        let corpo = '<div class="linha-campos">' +
            '<label>Tipo<select data-campo="tipo">' + opcoesHtml([['objetiva', 'Objetiva'], ['discursiva', 'Discursiva']], q.tipo) + '</select></label>' +
            '<label class="campo-largo">Fonte <small>(sai entre parênteses)</small><input type="text" data-campo="fonte" value="' + esc(q.fonte || '') + '" placeholder="Ex.: Enem, Uece, autoral"></label>' +
            '</div>' +
            '<label>Enunciado<textarea data-campo="enunciado" rows="4" placeholder="Texto da questão. Cada linha é um parágrafo.">' + esc(q.enunciado || '') + '</textarea></label>';

        corpo += '<div class="q-imagem">';
        if (q.imagem) {
            corpo += '<img src="' + q.imagem.src + '" alt="">' +
                '<label>Largura<select data-campo="img-largura">' + opcoesHtml([[100, 'Coluna toda'], [80, '80%'], [60, '60%'], [40, '40%']], q.imagem.largura || 100) + '</select></label>' +
                '<button type="button" class="btn btn--pequeno" data-acao="img-remover">Tirar a imagem</button>';
        } else {
            corpo += '<label class="btn btn--pequeno">+ Imagem<input type="file" accept="image/*" data-acao="img-arquivo" hidden></label>' +
                '<small class="dica">ou cole (Ctrl+V) no enunciado</small>';
        }
        corpo += '</div>';

        if (q.tipo === 'objetiva') {
            corpo += '<div class="alternativas">';
            for (let i = 0; i < layout.alternativas; i++) {
                const letraMaiuscula = 'ABCDE'[i];
                corpo += '<div class="alt"><label class="alt-letra" title="Marcar como a resposta certa">' +
                    '<input type="radio" name="certa-' + q.id + '" value="' + letraMaiuscula + '" data-campo="correta"' + (q.correta === letraMaiuscula ? ' checked' : '') + '>' +
                    esc(Modelos.letra(i, layout.letras)) + '</label>' +
                    '<textarea rows="1" data-campo="alt" data-i="' + i + '">' + esc(q.alternativas[i] || '') + '</textarea></div>';
            }
            corpo += '<small>Marque a bolinha da alternativa certa: ela vai para o gabarito do professor, nunca para a prova.</small></div>';
        } else {
            corpo += '<div class="linha-campos"><label>Linhas para a resposta<input type="number" min="0" max="40" data-campo="linhas" value="' + (q.linhas | 0) + '"></label></div>';
        }

        corpo += '<div class="q-acoes">' +
            '<button type="button" class="icone" data-acao="q-subir" title="Subir">↑</button>' +
            '<button type="button" class="icone" data-acao="q-descer" title="Descer">↓</button>' +
            '<button type="button" class="btn btn--pequeno" data-acao="q-duplicar">Duplicar</button>' +
            '<button type="button" class="btn btn--pequeno" data-acao="q-apagar">Apagar</button></div>';

        return '<details class="questao" data-q="' + q.id + '"' + (abertas.has(q.id) ? ' open' : '') + '>' +
            '<summary><span class="q-numero">' + (numero < 10 ? '0' : '') + numero + '</span>' +
            '<span class="q-resumo' + (r.vazio ? ' vazio-q' : '') + '">' + esc(r.texto) + '</span>' + etiqueta(q) + '</summary>' +
            '<div class="q-corpo">' + corpo + '</div></details>';
    }

    function desenharSecoes() {
        const layout = Modelos.layoutDaProva(prova);
        const caixa = $('secoes');
        const rolagem = $('editor').scrollTop;
        let n = 0;
        caixa.innerHTML = prova.secoes.map(function (s, i) {
            return '<div class="secao" data-s="' + s.id + '">' +
                '<div class="secao-cab"><input type="text" data-campo="secao-titulo" value="' + esc(s.titulo || '') + '" placeholder="Título da seção (ex.: BIOLOGIA) — opcional">' +
                '<button type="button" class="icone" data-acao="secao-subir" title="Subir a seção"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
                '<button type="button" class="icone" data-acao="secao-descer" title="Descer a seção"' + (i === prova.secoes.length - 1 ? ' disabled' : '') + '>↓</button>' +
                '<button type="button" class="icone icone--perigo" data-acao="secao-apagar" title="Apagar a seção">✕</button></div>' +
                s.questoes.map(function (q) { n++; return questaoHtml(q, n, layout); }).join('') +
                '<div class="secao-acoes"><button type="button" class="btn btn--pequeno" data-acao="add-objetiva">+ Questão objetiva</button>' +
                '<button type="button" class="btn btn--pequeno" data-acao="add-discursiva">+ Questão discursiva</button></div></div>';
        }).join('');
        $('editor').scrollTop = rolagem;
        ajustarAlturas(caixa);
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

    const caixaSecoes = $('secoes');

    caixaSecoes.addEventListener('toggle', function (e) {
        const d = e.target;
        if (!d.dataset || !d.dataset.q) return;
        if (d.open) { abertas.add(d.dataset.q); ajustarAlturas(d); } else abertas.delete(d.dataset.q);
    }, true);

    function aoEditarQuestao(e) {
        const campo = e.target.dataset.campo;
        if (!campo) return;
        if (campo === 'secao-titulo') {
            const s = prova.secoes.find(function (x) { return x.id === e.target.closest('[data-s]').dataset.s; });
            s.titulo = e.target.value;
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
        } else if (campo === 'alt') {
            q.alternativas[Number(e.target.dataset.i)] = e.target.value.replace(/\n/g, ' ');
            crescer(e.target);
        } else if (campo === 'correta') {
            q.correta = e.target.value;
            atualizarResumo(qel, q);
        } else if (campo === 'linhas') {
            q.linhas = Math.max(0, Math.min(40, parseInt(e.target.value, 10) || 0));
        } else if (campo === 'img-largura') {
            q.imagem.largura = Number(e.target.value);
        } else {
            q[campo] = e.target.value;
            atualizarResumo(qel, q);
        }
        mudou();
    }

    caixaSecoes.addEventListener('input', aoEditarQuestao);
    caixaSecoes.addEventListener('change', function (e) {
        if (e.target.dataset.acao === 'img-arquivo') {
            const arquivo = e.target.files[0];
            const qel = e.target.closest('[data-q]');
            if (arquivo && qel) definirImagem(qel.dataset.q, arquivo);
            return;
        }
        const campo = e.target.dataset.campo;
        if (campo === 'tipo' || campo === 'correta' || campo === 'img-largura') aoEditarQuestao(e);
    });

    caixaSecoes.addEventListener('paste', function (e) {
        if (e.target.dataset.campo !== 'enunciado') return;
        const itens = Array.from((e.clipboardData && e.clipboardData.files) || []);
        const imagem = itens.find(function (f) { return /^image\//.test(f.type); });
        if (!imagem) return;
        e.preventDefault();
        definirImagem(e.target.closest('[data-q]').dataset.q, imagem);
    });

    caixaSecoes.addEventListener('click', function (e) {
        const botao = e.target.closest('[data-acao]');
        if (!botao || botao.tagName === 'INPUT') return;
        const acao = botao.dataset.acao;
        const secaoEl = botao.closest('[data-s]');
        const secao = secaoEl && prova.secoes.find(function (s) { return s.id === secaoEl.dataset.s; });
        const qel = botao.closest('[data-q]');
        const achado = qel && acharQuestao(qel.dataset.q);

        if (acao === 'add-objetiva' || acao === 'add-discursiva') {
            const q = Modelos.novaQuestao(acao === 'add-objetiva' ? 'objetiva' : 'discursiva', 5);
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
            if (secao.questoes.length && !confirm('Apagar a seção "' + (secao.titulo || 'sem título') + '" com as ' + secao.questoes.length + ' questões dela?')) return;
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
            const q = achado.questao;
            const temConteudo = String(q.enunciado || '').trim() || q.imagem || q.alternativas.some(function (a) { return String(a || '').trim(); });
            if (temConteudo && !confirm('Apagar esta questão?')) return;
            achado.secao.questoes.splice(achado.indice, 1);
            desenharSecoes();
        } else if (acao === 'img-remover') {
            achado.questao.imagem = null;
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
            if (!/png|gif/.test(arquivo.type) || src.length > 1500000) src = canvas.toDataURL('image/jpeg', 0.9);
            return { src: src, w: w, h: h, largura: 100 };
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    async function definirImagem(qid, arquivo) {
        try {
            const imagem = await carregarImagem(arquivo);
            const achado = acharQuestao(qid);
            if (!achado) return;
            achado.questao.imagem = imagem;
            abertas.add(qid);
            desenharSecoes();
            mudou();
        } catch (erro) {
            alert('Não consegui abrir esta imagem. Tente salvar como PNG ou JPG.');
        }
    }

    $('add-secao').onclick = function () {
        prova.secoes.push(Modelos.novaSecao(''));
        desenharSecoes();
        const inputs = caixaSecoes.querySelectorAll('[data-campo="secao-titulo"]');
        inputs[inputs.length - 1].focus();
        mudou();
    };
    $('abrir-todas').onclick = function () {
        Modelos.questoesNumeradas(prova).forEach(function (i) { abertas.add(i.questao.id); });
        desenharSecoes();
    };
    $('fechar-todas').onclick = function () { abertas.clear(); desenharSecoes(); };

    /* ----- prévia ----- */

    function repaginar() {
        if (!prova || $('tela-editor').hidden) return;
        const r = Paginar.montar(prova, $('paginas'), {});
        const total = Modelos.questoesNumeradas(prova).length;
        $('previa-info').textContent = r.paginas + (r.paginas === 1 ? ' página' : ' páginas') + ' · ' +
            total + (total === 1 ? ' questão' : ' questões') + (r.paginas % 2 ? ' · número ímpar de páginas' : '');
        aplicarZoom($('paginas'), $('previa-escala'), $('previa'));
        mostrarAvisos(r.avisos, Modelos.pendencias(prova));
    }

    function mostrarAvisos(graves, pendencias) {
        const caixa = $('avisos');
        caixa.innerHTML = '';
        graves.forEach(function (a) { caixa.appendChild(el('div', 'aviso aviso--erro', esc(a))); });
        if (pendencias.length) {
            const lista = pendencias.slice(0, 12).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
                (pendencias.length > 12 ? '<li>… e mais ' + (pendencias.length - 12) + '.</li>' : '');
            caixa.appendChild(el('div', 'aviso', '<strong>Antes de imprimir, confira:</strong><ul>' + lista + '</ul>'));
        }
        caixa.hidden = !caixa.childNodes.length;
    }

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
        tituloAntesDeImprimir = document.title;
        document.title = Modelos.nomeArquivo(prova) + (chave ? '-GABARITO-PROFESSOR' : '');
        if (chave) {
            Paginar.montarChave(prova, $('chave'));
            document.body.classList.add('imprimindo-chave');
        }
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

    /* ----- colar várias questões ----- */

    function abrirColar() {
        $('colar-texto').value = '';
        $('colar-resultado').innerHTML = '';
        $('colar-acrescentar').disabled = true;
        lidoColar = null;
        $('dialogo-colar').showModal();
        $('colar-texto').focus();
    }
    $('ed-colar').onclick = abrirColar;
    $('add-colar').onclick = abrirColar;

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

    $('colar-acrescentar').onclick = function () {
        if (!lidoColar || !lidoColar.total) return;
        lidoColar.secoes.forEach(function (lida) {
            let alvo = null;
            if (lida.titulo) {
                alvo = prova.secoes.find(function (s) { return normalizar(s.titulo) === normalizar(lida.titulo); });
                if (!alvo) {
                    alvo = prova.secoes.find(function (s) { return !String(s.titulo || '').trim() && !s.questoes.some(temConteudo); });
                    if (alvo) alvo.titulo = lida.titulo;
                }
                if (!alvo) { alvo = Modelos.novaSecao(lida.titulo); prova.secoes.push(alvo); }
            } else {
                alvo = prova.secoes[prova.secoes.length - 1];
            }
            /* a questão vazia que a prova nova traz dá lugar às coladas */
            alvo.questoes = alvo.questoes.filter(temConteudo);
            lida.questoes.forEach(function (lq) {
                const q = Modelos.novaQuestao(lq.tipo, 5);
                q.fonte = lq.fonte;
                q.enunciado = lq.enunciado;
                if (lq.tipo === 'objetiva') {
                    lq.alternativas.slice(0, 5).forEach(function (a, i) { q.alternativas[i] = a; });
                    q.correta = lq.correta || '';
                }
                alvo.questoes.push(q);
            });
        });
        prova.secoes.forEach(function (s) { s.questoes = s.questoes.filter(temConteudo); });
        $('dialogo-colar').close();
        abertas.clear();
        desenharSecoes();
        mudou();
    };

    function temConteudo(q) {
        return String(q.enunciado || '').trim() || q.imagem || q.alternativas.some(function (a) { return String(a || '').trim(); });
    }

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
        formLayout($('mo-formato'), modeloEdit.layout, previaModelo);
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
                q.alternativas = ['Primeira alternativa de exemplo.', 'Segunda alternativa, um pouco mais comprida que a primeira.', 'Terceira alternativa.', 'Quarta alternativa de exemplo.', 'Quinta alternativa.'];
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
    window.MontadorProvas = { estado: function () { return prova; }, repaginar: repaginar };
    rota();
})();
