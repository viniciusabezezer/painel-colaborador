/* Provas Identificadas — a tela.
   Junta a lista colada, os arquivos das provas e as opções de posição, e manda
   o trabalho para os módulos de identificação e de PDF. Nada é gravado: os
   nomes vivem só na memória desta aba, e ao fechar desaparecem. */
(function () {
    'use strict';

    const Identificacao = window.ProvasIdentificacao;
    const Lista = window.ProvasLista;
    const Pdf = window.ProvasPdf;
    const Saida = window.ProvasSaida;
    const Previa = window.ProvasPrevia;

    const CM = Pdf.CM;
    const LARGURA_PREVIA = 440;

    const estado = {
        lote: { turmas: [], semTurma: [], ignoradas: [], repetidos: [], total: 0 },
        /* 'serie|COMPONENTE' -> { nome, tipo, bytes, paginas } */
        arquivos: Object.create(null),
        /* componentes marcados no modelo de etiquetas */
        etiquetas: Object.create(null),
        previa: { chave: null, medidas: null },
        resultados: []
    };

    function $(id) { return document.getElementById(id); }
    function criar(tag, classe, texto) {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto != null) elemento.textContent = texto;
        return elemento;
    }
    function limpar(elemento) { while (elemento.firstChild) elemento.removeChild(elemento.firstChild); }

    /* O logotipo da escola entra no cabeçalho de identificação. É lido uma vez
       só, do logo.png que mora ao lado do app; se falhar, o cabeçalho sai sem
       ele em vez de a geração parar. */
    let logoPromessa = null;
    function bytesDoLogo() {
        if (!logoPromessa) {
            logoPromessa = fetch('logo.png')
                .then(function (resposta) { return resposta.ok ? resposta.arrayBuffer() : null; })
                .then(function (buffer) { return buffer ? new Uint8Array(buffer) : null; })
                .catch(function () { return null; });
        }
        return logoPromessa;
    }

    /* ===================== abas ===================== */

    $('abas').addEventListener('click', function (evento) {
        const botao = evento.target.closest('.aba');
        if (!botao) return;
        Array.prototype.forEach.call(document.querySelectorAll('.aba'), function (aba) {
            aba.classList.toggle('ativa', aba === botao);
        });
        ['gerar', 'conferir', 'ajuda'].forEach(function (nome) {
            $('painel-' + nome).hidden = nome !== botao.dataset.aba;
        });
    });

    /* ===================== passo 2: a lista ===================== */

    let temporizador = null;
    $('lote').addEventListener('input', function () {
        clearTimeout(temporizador);
        temporizador = setTimeout(lerLote, 220);
    });

    $('limpar-lote').addEventListener('click', function () {
        $('lote').value = '';
        lerLote();
    });

    function lerLote() {
        estado.lote = Lista.lerLote($('lote').value);
        mostrarTurmas();
        mostrarAvisosDaLista();
        montarSlots();
        atualizarPrevia();
    }

    function mostrarTurmas() {
        const alvo = $('resumo-turmas');
        limpar(alvo);

        const total = estado.lote.total;
        $('contagem-lote').textContent = total
            ? total + (total === 1 ? ' aluno lido' : ' alunos lidos') + ' em ' + estado.lote.turmas.length + (estado.lote.turmas.length === 1 ? ' turma.' : ' turmas.')
            : 'Nenhum aluno lido ainda.';

        estado.lote.turmas.forEach(function (turma) {
            const chip = criar('span', 'turma-chip');
            chip.appendChild(criar('b', null, turma.turma));
            const serie = Identificacao.serie(turma.serie);
            chip.appendChild(criar('span', null, turma.alunos.length + (turma.alunos.length === 1 ? ' aluno · ' : ' alunos · ') + (serie ? serie.nome : turma.serie)));
            alvo.appendChild(chip);
        });
    }

    function mostrarAvisosDaLista() {
        const alvo = $('avisos-lista');
        limpar(alvo);

        if (estado.lote.semTurma.length) {
            const aviso = criar('div', 'aviso');
            aviso.appendChild(criar('strong', null, estado.lote.semTurma.length + ' aluno(a)s sem turma reconhecida.'));
            const lista = criar('ul');
            estado.lote.semTurma.slice(0, 6).forEach(function (aluno) {
                lista.appendChild(criar('li', null, aluno.nome));
            });
            if (estado.lote.semTurma.length > 6) lista.appendChild(criar('li', null, '…'));
            aviso.appendChild(lista);

            const caixa = criar('div', 'atribuir');
            caixa.appendChild(criar('span', null, 'Jogar todos para a turma:'));
            const escolha = criar('select');
            escolha.appendChild(criar('option', null, 'escolha…'));
            Identificacao.SERIES.forEach(function (serie) {
                serie.turmas.forEach(function (turma) {
                    const opcao = criar('option', null, turma);
                    opcao.value = turma;
                    escolha.appendChild(opcao);
                });
            });
            estado.lote.turmas.forEach(function (turma) {
                if (Array.prototype.some.call(escolha.options, function (o) { return o.value === turma.turma; })) return;
                const opcao = criar('option', null, turma.turma);
                opcao.value = turma.turma;
                escolha.appendChild(opcao);
            });
            const botao = criar('button', 'btn btn--pequeno', 'Atribuir');
            botao.type = 'button';
            botao.addEventListener('click', function () {
                if (!escolha.value) return;
                const texto = $('lote').value.replace(/\s*$/, '');
                $('lote').value = texto + '\n\nTURMA ' + escolha.value + '\n' +
                    estado.lote.semTurma.map(function (a) {
                        return (a.numero != null ? a.numero + ' - ' : '') + a.nome;
                    }).join('\n');
                /* Os nomes soltos viram um bloco com título de turma; assim a
                   correção fica visível no próprio texto que a coordenação colou. */
                lerLote();
            });
            caixa.appendChild(escolha);
            caixa.appendChild(botao);
            aviso.appendChild(caixa);
            alvo.appendChild(aviso);
        }

        if (estado.lote.repetidos.length) {
            const aviso = criar('div', 'aviso');
            aviso.appendChild(criar('strong', null, 'Nomes repetidos na mesma turma: ' + estado.lote.repetidos.join(', ') + '.'));
            aviso.appendChild(criar('div', null, 'Cada um recebe um número e um código diferentes, mas confira se não é a mesma pessoa colada duas vezes.'));
            alvo.appendChild(aviso);
        }

        if (estado.lote.ignoradas.length) {
            const aviso = criar('div', 'aviso');
            aviso.appendChild(criar('strong', null, estado.lote.ignoradas.length + ' linha(s) ignorada(s) (cabeçalho de planilha, total, linha solta).'));
            const lista = criar('ul');
            estado.lote.ignoradas.slice(0, 5).forEach(function (linha) {
                lista.appendChild(criar('li', null, linha));
            });
            if (estado.lote.ignoradas.length > 5) lista.appendChild(criar('li', null, '…'));
            aviso.appendChild(lista);
            alvo.appendChild(aviso);
        }
    }

    /* ===================== passo 3: os arquivos ===================== */

    function seriesPresentes() {
        const vistas = [];
        estado.lote.turmas.forEach(function (turma) {
            if (vistas.indexOf(turma.serie) === -1) vistas.push(turma.serie);
        });
        return vistas.sort();
    }

    function turmasDaSerie(codigo) {
        return estado.lote.turmas.filter(function (turma) { return turma.serie === codigo; });
    }

    function montarSlots() {
        const alvo = $('slots');
        limpar(alvo);

        const series = seriesPresentes();
        if (!series.length) {
            alvo.appendChild(criar('p', 'dica', 'Cole a lista dos alunos no passo 2 e os espaços para enviar as provas de cada série aparecem aqui.'));
            return;
        }

        const soEtiquetas = modelo() === 'etiquetas';

        series.forEach(function (codigo) {
            const serie = Identificacao.serie(codigo);
            const bloco = criar('div', 'slot-serie');
            bloco.appendChild(criar('h4', null, serie ? serie.nome : codigo + 'ª série'));
            bloco.appendChild(criar('p', 'turmas-da-serie',
                'Turmas: ' + turmasDaSerie(codigo).map(function (t) { return t.turma + ' (' + t.alunos.length + ')'; }).join(' · ')));

            const grade = criar('div', 'slot-grade');
            Identificacao.COMPONENTES.forEach(function (componente) {
                grade.appendChild(soEtiquetas
                    ? slotDeEtiqueta(codigo, componente)
                    : slotDeArquivo(codigo, componente));
            });
            bloco.appendChild(grade);
            alvo.appendChild(bloco);
        });
    }

    function chaveSlot(serie, componente) { return serie + '|' + componente; }

    function slotDeArquivo(serie, componente) {
        const chave = chaveSlot(serie, componente.codigo);
        const guardado = estado.arquivos[chave];

        const slot = criar('div', 'slot' + (guardado ? ' cheio' : ''));
        const rotulo = criar('label', 'slot-nome', componente.nome);
        slot.appendChild(rotulo);

        const entrada = criar('input');
        entrada.type = 'file';
        entrada.accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
        entrada.addEventListener('change', function () {
            receberArquivo(chave, entrada.files[0], slot);
        });
        slot.appendChild(entrada);

        const estadoTexto = criar('small', 'slot-estado', guardado
            ? guardado.nome + (guardado.paginas ? ' · ' + guardado.paginas + ' página(s)' : '')
            : 'nenhum arquivo');
        slot.appendChild(estadoTexto);
        return slot;
    }

    function slotDeEtiqueta(serie, componente) {
        const chave = chaveSlot(serie, componente.codigo);
        const slot = criar('div', 'slot' + (estado.etiquetas[chave] ? ' cheio' : ''));
        const rotulo = criar('label', 'caixa-check');
        const caixa = criar('input');
        caixa.type = 'checkbox';
        caixa.checked = !!estado.etiquetas[chave];
        caixa.addEventListener('change', function () {
            estado.etiquetas[chave] = caixa.checked;
            slot.classList.toggle('cheio', caixa.checked);
        });
        rotulo.appendChild(caixa);
        rotulo.appendChild(criar('span', null, componente.nome));
        slot.appendChild(rotulo);
        return slot;
    }

    function receberArquivo(chave, arquivo, slot) {
        const estadoTexto = slot.querySelector('.slot-estado');
        if (!arquivo) {
            delete estado.arquivos[chave];
            slot.classList.remove('cheio');
            estadoTexto.textContent = 'nenhum arquivo';
            atualizarListaDePrevia();
            return;
        }

        const extensao = (arquivo.name.split('.').pop() || '').toLowerCase();

        if (extensao === 'docx' || extensao === 'doc' || extensao === 'odt') {
            slot.classList.remove('cheio');
            estadoTexto.textContent = 'Word não dá: abra no Word e use Arquivo → Salvar como → PDF, ou escolha o modelo de etiquetas.';
            delete estado.arquivos[chave];
            atualizarListaDePrevia();
            return;
        }

        if (['pdf', 'jpg', 'jpeg', 'png'].indexOf(extensao) === -1) {
            estadoTexto.textContent = 'Formato não aceito: use PDF, JPG ou PNG.';
            return;
        }

        estadoTexto.textContent = 'lendo…';
        const leitor = new FileReader();
        leitor.onload = function () {
            estado.arquivos[chave] = {
                nome: arquivo.name,
                tipo: extensao === 'jpeg' ? 'jpg' : extensao,
                bytes: new Uint8Array(leitor.result),
                paginas: null
            };
            slot.classList.add('cheio');
            estadoTexto.textContent = arquivo.name;
            atualizarListaDePrevia();
            if (!estado.previa.chave) {
                $('previa-arquivo').value = chave;
                atualizarPrevia();
            }
        };
        leitor.onerror = function () {
            estadoTexto.textContent = 'Não consegui ler o arquivo.';
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    /* ===================== passo 4: o cabeçalho ===================== */

    function modelo() {
        const marcado = document.querySelector('input[name="modelo"]:checked');
        return marcado ? marcado.value : 'espaco-deixado';
    }

    function aoTrocarModelo() {
        const atual = modelo();
        $('opcoes-cabecalho').hidden = atual === 'etiquetas';
        document.querySelector('.previa').hidden = atual === 'etiquetas';

        /* Quando o app abre a faixa, o cabeçalho mora nela: a posição deixa de
           ser escolhida na prova e passa a ser o alto da folha. */
        const naFaixa = atual === 'abrir-espaco';
        $('cab-x').disabled = naFaixa;
        $('cab-y').disabled = naFaixa;
        if (naFaixa) {
            $('cab-x').value = '1';
            $('cab-y').value = '0.5';
        }

        montarSlots();
        atualizarPrevia();
    }

    document.querySelectorAll('input[name="modelo"]').forEach(function (radio) {
        radio.addEventListener('change', aoTrocarModelo);
    });

    ['cab-largura', 'cab-altura', 'cab-x', 'cab-y', 'cab-qr', 'cab-codigo', 'cab-moldura'].forEach(function (id) {
        $(id).addEventListener('input', atualizarPrevia);
        $(id).addEventListener('change', atualizarPrevia);
    });

    function numero(id, padrao) {
        const valor = parseFloat($(id).value);
        return isNaN(valor) ? padrao : valor;
    }

    /* O cabeçalho do jeito que a tela está agora. */
    function montarConfiguracao() {
        const atual = modelo();
        const cabecalho = {
            xCm: numero('cab-x', Pdf.PADRAO.xCm),
            yCm: numero('cab-y', Pdf.PADRAO.yCm),
            larguraCm: numero('cab-largura', Pdf.PADRAO.larguraCm),
            alturaCm: numero('cab-altura', Pdf.PADRAO.alturaCm),
            incluirQr: $('cab-qr').value !== 'sem',
            qrNaEsquerda: $('cab-qr').value === 'esquerda',
            incluirCodigo: $('cab-codigo').checked,
            moldura: $('cab-moldura').checked
        };

        /* O código escrito é o que sobra se o QR sair; não dá para tirar os
           dois, senão a prova fica sem identificação nenhuma. */
        if (!cabecalho.incluirQr) cabecalho.incluirCodigo = true;

        return {
            cabecalho: cabecalho,
            espacoTopoCm: atual === 'abrir-espaco' ? cabecalho.alturaCm + cabecalho.yCm + 0.4 : 0
        };
    }

    /* ===================== prévia ===================== */

    function atualizarListaDePrevia() {
        const escolha = $('previa-arquivo');
        const anterior = escolha.value;
        limpar(escolha);

        const chaves = Object.keys(estado.arquivos);
        chaves.forEach(function (chave) {
            const partes = chave.split('|');
            const serie = Identificacao.serie(partes[0]);
            const componente = Identificacao.COMPONENTES.filter(function (c) { return c.codigo === partes[1]; })[0];
            const opcao = criar('option', null, (serie ? serie.nome : partes[0]) + ' · ' + (componente ? componente.nome : partes[1]));
            opcao.value = chave;
            escolha.appendChild(opcao);
        });

        if (chaves.indexOf(anterior) !== -1) escolha.value = anterior;
        escolha.disabled = !chaves.length;
    }

    $('previa-arquivo').addEventListener('change', function () {
        estado.previa.chave = null;
        atualizarPrevia();
    });

    let desenhando = false;
    async function atualizarPrevia() {
        const chave = $('previa-arquivo').value;
        const arquivo = chave ? estado.arquivos[chave] : null;
        const canvas = $('previa-canvas');

        if (!arquivo) {
            canvas.hidden = true;
            $('previa-vazia').hidden = false;
            $('marca-cabecalho').hidden = true;
            $('previa-faixa').hidden = true;
            return;
        }

        $('previa-vazia').hidden = true;
        canvas.hidden = false;

        if (estado.previa.chave !== chave && !desenhando) {
            desenhando = true;
            try {
                estado.previa.medidas = await Previa.desenhar(canvas, arquivo, LARGURA_PREVIA);
                estado.previa.chave = chave;
                arquivo.paginas = estado.previa.medidas.paginas;
            } catch (erro) {
                $('previa-vazia').hidden = false;
                $('previa-vazia').textContent = 'Não consegui desenhar a prévia: ' + (erro.message || erro);
                canvas.hidden = true;
            } finally {
                desenhando = false;
            }
        }

        posicionarMarcasNaPrevia();
    }

    /* Mostra na prévia onde o cabeçalho vai cair, nas medidas da prova
       original. Quando o modelo abre espaço, a faixa aparece acima da página: é
       o tanto que a prova desce (e encolhe) para caber embaixo dela. */
    function posicionarMarcasNaPrevia() {
        const medidas = estado.previa.medidas;
        if (!medidas) return;

        const escala = $('previa-canvas').clientWidth / medidas.larguraCm;
        const configuracao = montarConfiguracao();
        const cabecalho = configuracao.cabecalho;

        const faixa = $('previa-faixa');
        let desloca = 0;
        if (configuracao.espacoTopoCm > 0) {
            desloca = configuracao.espacoTopoCm * escala;
            faixa.hidden = false;
            faixa.style.height = desloca + 'px';
            $('previa-faixa-texto').textContent = 'espaço aberto no topo: ' +
                configuracao.espacoTopoCm.toFixed(1).replace('.', ',') + ' cm';
        } else {
            faixa.hidden = true;
        }

        const caixa = $('marca-cabecalho');
        caixa.hidden = false;
        caixa.style.left = (cabecalho.xCm * escala) + 'px';
        caixa.style.top = ((configuracao.espacoTopoCm > 0 ? 0 : 0) + cabecalho.yCm * escala) + 'px';
        caixa.style.width = (cabecalho.larguraCm * escala) + 'px';
        caixa.style.height = (cabecalho.alturaCm * escala) + 'px';
    }

    /* Converte o clique em centímetros da prova original. Mede pelo retângulo
       do canvas, e não do palco, então a faixa desenhada acima não desloca a
       conta. */
    function cmDoEvento(evento) {
        const medidas = estado.previa.medidas;
        const canvas = $('previa-canvas');
        if (!medidas || canvas.hidden) return null;
        const area = canvas.getBoundingClientRect();
        const escala = medidas.larguraCm / area.width;
        return {
            x: Math.max(0, (evento.clientX - area.left) * escala),
            y: Math.max(0, (evento.clientY - area.top) * escala)
        };
    }

    $('previa-palco').addEventListener('mousemove', function (evento) {
        const ponto = cmDoEvento(evento);
        $('previa-cursor').textContent = ponto ? ponto.x.toFixed(1) + ' cm × ' + ponto.y.toFixed(1) + ' cm' : '';
    });

    $('previa-palco').addEventListener('mouseleave', function () {
        $('previa-cursor').textContent = '';
    });

    $('previa-palco').addEventListener('click', function (evento) {
        if (modelo() === 'abrir-espaco') return; /* na faixa nova a posição é fixa */
        const ponto = cmDoEvento(evento);
        if (!ponto) return;
        $('cab-x').value = (Math.round(ponto.x * 10) / 10).toFixed(1);
        $('cab-y').value = (Math.round(ponto.y * 10) / 10).toFixed(1);
        posicionarMarcasNaPrevia();
    });

    /* ===================== amostra ===================== */

    $('ver-amostra').addEventListener('click', async function () {
        const chave = $('previa-arquivo').value;
        const arquivo = chave ? estado.arquivos[chave] : null;
        const aviso = $('aviso-amostra');

        if (!arquivo) { aviso.textContent = 'Envie uma prova no passo 3 primeiro.'; return; }
        if (!estado.lote.turmas.length) { aviso.textContent = 'Cole a lista dos alunos no passo 2 primeiro.'; return; }

        const serie = chave.split('|')[0];
        const turma = turmasDaSerie(serie)[0] || estado.lote.turmas[0];
        const componente = chave.split('|')[1];
        aviso.textContent = 'montando…';

        try {
            const provas = Identificacao.identificarTurma({
                ano: $('ano').value,
                bimestre: $('bimestre').value,
                turma: turma.turma,
                componente: componente,
                alunos: turma.alunos.slice(0, 1),
                chave: $('chave').value
            });
            const configuracao = montarConfiguracao();
            const bytes = await Pdf.montarPrimeirasPaginas({
                arquivo: arquivo,
                identificacoes: provas,
                cabecalho: configuracao.cabecalho,
                espacoTopoCm: configuracao.espacoTopoCm,
                serieNome: (Identificacao.serie(serie) || {}).nome,
                avaliacao: $('avaliacao').value,
                logo: await bytesDoLogo()
            });
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            window.open(url, '_blank');
            setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
            aviso.textContent = 'abri numa aba nova.';
        } catch (erro) {
            aviso.textContent = 'Não deu: ' + (erro.message || erro);
        }
    });

    /* ===================== passo 5: gerar ===================== */

    $('gerar').addEventListener('click', gerar);

    async function gerar() {
        const atual = modelo();
        const alvo = $('resultados');
        const estadoTexto = $('estado-geracao');
        limpar(alvo);
        estado.resultados = [];

        if (!estado.lote.turmas.length) {
            estadoTexto.textContent = 'Falta colar a lista dos alunos no passo 2.';
            return;
        }

        const tarefas = [];
        seriesPresentes().forEach(function (serie) {
            Identificacao.COMPONENTES.forEach(function (componente) {
                const chave = chaveSlot(serie, componente.codigo);
                const marcado = atual === 'etiquetas' ? !!estado.etiquetas[chave] : !!estado.arquivos[chave];
                if (!marcado) return;
                turmasDaSerie(serie).forEach(function (turma) {
                    tarefas.push({ serie: serie, componente: componente, turma: turma, chave: chave });
                });
            });
        });

        if (!tarefas.length) {
            estadoTexto.textContent = atual === 'etiquetas'
                ? 'Marque no passo 3 de quais componentes você quer etiquetas.'
                : 'Falta enviar a primeira página de pelo menos uma prova no passo 3.';
            return;
        }

        $('gerar').disabled = true;
        const configuracao = montarConfiguracao();

        try {
            for (let i = 0; i < tarefas.length; i++) {
                const tarefa = tarefas[i];
                estadoTexto.textContent = 'gerando ' + (i + 1) + ' de ' + tarefas.length +
                    ' — ' + tarefa.turma.turma + ' · ' + tarefa.componente.nome + '…';
                /* Devolve o fio para o navegador, senão a barra de estado não
                   aparece e a aba parece travada em turma grande. */
                await new Promise(function (resolve) { setTimeout(resolve, 0); });

                const serieNome = (Identificacao.serie(tarefa.serie) || {}).nome;
                const provas = Identificacao.identificarTurma({
                    ano: $('ano').value,
                    bimestre: $('bimestre').value,
                    turma: tarefa.turma.turma,
                    componente: tarefa.componente.codigo,
                    alunos: tarefa.turma.alunos,
                    chave: $('chave').value
                });

                const dados = {
                    ano: $('ano').value,
                    bimestre: $('bimestre').value,
                    turma: tarefa.turma.turma,
                    componente: tarefa.componente.codigo,
                    serieNome: serieNome
                };
                const nomeAvaliacao = $('avaliacao').value.trim();
                const subtitulo = (nomeAvaliacao ? nomeAvaliacao + ' · ' : '') + serieNome + ' · Turma ' + tarefa.turma.turma + ' · ' + tarefa.componente.nome +
                    ' · ' + $('bimestre').value.replace('B', '') + 'º bimestre de ' + $('ano').value;

                const pacote = { titulo: subtitulo, dados: dados, provas: provas, arquivos: [] };

                if (atual === 'etiquetas') {
                    pacote.arquivos.push({
                        rotulo: 'Etiquetas (PDF)',
                        nome: Saida.nomeArquivo('ETIQUETAS', dados, 'pdf'),
                        tipo: 'application/pdf',
                        bytes: await Pdf.montarEtiquetas({
                            identificacoes: provas, colunas: 2, linhas: 7,
                            incluirQr: configuracao.cabecalho.incluirQr,
                            serieNome: serieNome, subtitulo: subtitulo,
                            avaliacao: $('avaliacao').value,
                            logo: await bytesDoLogo()
                        })
                    });
                } else {
                    pacote.arquivos.push({
                        rotulo: 'Provas identificadas, capa e verso (PDF)',
                        nome: Saida.nomeArquivo('PROVA', dados, 'pdf'),
                        tipo: 'application/pdf',
                        bytes: await Pdf.montarPrimeirasPaginas({
                            arquivo: estado.arquivos[tarefa.chave],
                            identificacoes: provas,
                            cabecalho: configuracao.cabecalho,
                            espacoTopoCm: configuracao.espacoTopoCm,
                            serieNome: serieNome,
                            tituloArquivo: subtitulo,
                            avaliacao: $('avaliacao').value,
                            logo: await bytesDoLogo()
                        })
                    });
                }

                pacote.arquivos.push({
                    rotulo: 'Folha de conferência (PDF)',
                    nome: Saida.nomeArquivo('CONFERENCIA', dados, 'pdf'),
                    tipo: 'application/pdf',
                    bytes: await Pdf.montarFolhaConferencia({ identificacoes: provas, subtitulo: subtitulo })
                });
                pacote.arquivos.push({
                    rotulo: 'Conferência (CSV)',
                    nome: Saida.nomeArquivo('CONFERENCIA', dados, 'csv'),
                    tipo: 'text/csv;charset=utf-8',
                    bytes: Saida.montarCsv(provas, dados)
                });

                estado.resultados.push(pacote);
                alvo.appendChild(cartaoDeResultado(pacote));
            }

            estadoTexto.textContent = 'pronto: ' + tarefas.length + (tarefas.length === 1 ? ' arquivo gerado.' : ' conjuntos gerados.');
            alvo.appendChild(barraDeTudo());
        } catch (erro) {
            estadoTexto.textContent = 'Parou no meio: ' + (erro.message || erro);
        } finally {
            $('gerar').disabled = false;
        }
    }

    function cartaoDeResultado(pacote) {
        const cartao = criar('div', 'resultado');
        const titulo = criar('div', 'resultado-titulo', pacote.titulo);
        titulo.appendChild(criar('small', null, pacote.provas.length + ' aluno(a)s · códigos de ' +
            pacote.provas[0].id + ' a ' + pacote.provas[pacote.provas.length - 1].id));
        cartao.appendChild(titulo);

        pacote.arquivos.forEach(function (arquivo) {
            const botao = criar('button', 'btn btn--pequeno', arquivo.rotulo);
            botao.type = 'button';
            botao.addEventListener('click', function () {
                Saida.baixar(arquivo.nome, arquivo.bytes, arquivo.tipo);
            });
            cartao.appendChild(botao);
        });
        return cartao;
    }

    function barraDeTudo() {
        const caixa = criar('div', 'acoes-lista');
        const botao = criar('button', 'btn btn--primary', 'Baixar tudo, um arquivo atrás do outro');
        botao.type = 'button';
        botao.addEventListener('click', async function () {
            for (const pacote of estado.resultados) {
                for (const arquivo of pacote.arquivos) {
                    Saida.baixar(arquivo.nome, arquivo.bytes, arquivo.tipo);
                    /* Um intervalo entre os downloads, senão o navegador
                       entende que a página está atirando arquivos e bloqueia. */
                    await new Promise(function (resolve) { setTimeout(resolve, 450); });
                }
            }
        });
        caixa.appendChild(botao);
        caixa.appendChild(criar('span', 'contagem', 'O navegador pode pedir permissão para baixar vários arquivos.'));
        return caixa;
    }

    /* ===================== conferência ===================== */

    $('conferir').addEventListener('click', function () {
        const alvo = $('conferir-resposta');
        limpar(alvo);

        const resultado = Identificacao.conferir($('conferir-entrada').value, $('conferir-nome').value, $('chave').value);
        const cartao = criar('div', 'conferencia-cartao ' + (resultado.valido ? 'valida' : 'invalida'));

        if (resultado.valido) {
            cartao.appendChild(criar('h4', null, 'Código autêntico.'));
            cartao.appendChild(criar('p', null, 'Esta prova é de ' + resultado.nome + '.'));
        } else if (resultado.motivo === 'formato') {
            cartao.appendChild(criar('h4', null, 'Não reconheci o código.'));
            cartao.appendChild(criar('p', null, 'O código tem sete partes, assim: MLS-2026-B3-1A-007-LIN-DRYT.'));
        } else if (resultado.motivo === 'sem-nome') {
            cartao.appendChild(criar('h4', null, 'Falta o nome.'));
            cartao.appendChild(criar('p', null, 'Digite o nome do aluno para eu conferir o verificador.'));
        } else {
            cartao.appendChild(criar('h4', null, 'O código não bate com esse nome.'));
            cartao.appendChild(criar('p', null, 'Confira se o nome está escrito como na lista da turma e se a chave da escola no passo 1 é a mesma usada na geração.'));
        }

        if (resultado.partes) {
            const lista = criar('dl');
            const serie = Identificacao.serie(resultado.partes.turma.charAt(0));
            const componente = Identificacao.COMPONENTES.filter(function (c) { return c.codigo === resultado.partes.componente; })[0];
            [
                ['Turma', resultado.partes.turma + (serie ? ' · ' + serie.nome : '')],
                ['Nº da lista', resultado.partes.numero],
                ['Componente', componente ? componente.nome : resultado.partes.componente],
                ['Avaliação', resultado.partes.bimestre.replace('B', '') + 'º bimestre de ' + resultado.partes.ano]
            ].forEach(function (par) {
                lista.appendChild(criar('dt', null, par[0]));
                lista.appendChild(criar('dd', null, par[1]));
            });
            cartao.appendChild(lista);
        }

        alvo.appendChild(cartao);
    });

    /* ===================== partida ===================== */

    aoTrocarModelo();
    montarSlots();
    atualizarListaDePrevia();
})();
