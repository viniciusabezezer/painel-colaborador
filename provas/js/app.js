/* Identificador de Provas da Malu — a tela.
   Junta a lista colada, os arquivos das provas e as opções de posição, e manda
   o trabalho para os módulos de identificação e de PDF. A lista colada vive só
   na memória desta aba; os arquivos gerados (os 60 últimos) ficam guardados
   neste navegador, na aba Arquivos recentes. */
(function () {
    'use strict';

    const Identificacao = window.ProvasIdentificacao;
    const Lista = window.ProvasLista;
    const Mapa = window.ProvasMapa;
    const Pdf = window.ProvasPdf;
    const Saida = window.ProvasSaida;
    const Previa = window.ProvasPrevia;
    const Historico = window.ProvasHistorico;

    const CM = Pdf.CM;
    const LARGURA_PREVIA = 440;

    const estado = {
        lote: { turmas: [], semTurma: [], ignoradas: [], repetidos: [], total: 0 },
        /* 'serie|COMPONENTE' -> { nome, tipo, bytes, paginas } */
        arquivos: Object.create(null),
        /* componentes marcados no modelo de etiquetas */
        etiquetas: Object.create(null),
        /* 'serie|COMPONENTE' -> arquivo do gabarito, quando a coordenação
           quiser identificar também a folha de respostas separada */
        gabaritos: Object.create(null),
        previaGabarito: { chave: null, medidas: null, medidasTocadas: false },
        previa: { chave: null, medidas: null },
        resultados: [],
        /* Mapa de salas lido do JSON ou da tabela mapas_salas. Fica só na memória desta aba. */
        mapa: null,
        casamento: null,
        origem: null,
        mapasSalvos: []
    };

    function $(id) { return document.getElementById(id); }
    function criar(tag, classe, texto) {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto != null) elemento.textContent = texto;
        return elemento;
    }
    function limpar(elemento) { while (elemento.firstChild) elemento.removeChild(elemento.firstChild); }

    /* O brasão da escola entra sempre no cabeçalho de identificação. É lido
       uma vez só, do logo.png que mora ao lado do app; se o arquivo não vier
       (pasta aberta direto do computador, sem internet), vale a cópia
       embutida em js/brasao.js. */
    let logoPromessa = null;
    function bytesDoLogo() {
        if (!logoPromessa) {
            logoPromessa = fetch('logo.png')
                .then(function (resposta) { return resposta.ok ? resposta.arrayBuffer() : null; })
                .then(function (buffer) { return buffer ? new Uint8Array(buffer) : null; })
                .catch(function () { return null; })
                .then(function (lido) { return lido || (window.ProvasBrasao ? window.ProvasBrasao.bytes() : null); });
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
        ['gerar', 'gabaritos', 'recentes', 'conferir', 'ajuda'].forEach(function (nome) {
            $('painel-' + nome).hidden = nome !== botao.dataset.aba;
        });
        if (botao.dataset.aba === 'recentes') mostrarRecentes();
        if (botao.dataset.aba === 'gabaritos') montarSlotsDeGabarito();
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
        montarSlotsDeGabarito();
        atualizarPrevia();
        atualizarMapa();
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

    /* ===================== organizar por sala ===================== */

    function mapaAtivo() {
        return !!(estado.casamento && estado.casamento.casados);
    }

    function modoImpressao() {
        const marcado = document.querySelector('input[name="modo-impressao"]:checked');
        return marcado ? marcado.value : 'turma';
    }

    let pedidoMapas = 0;

    function mostrarAvisoMapas(texto, ok) {
        const aviso = $('aviso-mapas');
        if (!aviso) return;
        aviso.hidden = !texto;
        aviso.textContent = texto || '';
        aviso.className = ok ? 'aviso aviso--ok' : 'aviso';
    }

    function preencherMapasSalvos() {
        const escolha = $('mapas-salvos');
        if (!escolha) return;
        const atual = escolha.value;
        limpar(escolha);
        const vazio = criar('option', null, estado.mapasSalvos.length ? 'Escolha um mapa salvo' : 'Carrega ao escolher Imprimir por sala');
        vazio.value = '';
        escolha.appendChild(vazio);
        estado.mapasSalvos.forEach(function (mapa) {
            const opcao = criar('option', null, Mapa.rotuloSalvo(mapa));
            opcao.value = String(mapa.id);
            escolha.appendChild(opcao);
        });
        if (atual && Array.prototype.some.call(escolha.options, function (opcao) { return opcao.value === atual; })) {
            escolha.value = atual;
        }
    }

    function aplicarMapaSalvo(mapa) {
        estado.origem = 'salvo';
        estado.mapa = mapa;
        if ($('mapas-salvos')) $('mapas-salvos').value = String(mapa.id);
        if ($('mapa-salas')) $('mapa-salas').value = '';
        mostrarAvisoMapas(Mapa.rotuloSalvo(mapa), true);
        atualizarMapa();
    }

    /* Lê public.mapas_salas com a sessão do Montador. Se a tabela não existir,
       ou a leitura falhar, o passo continua e o arquivo .json segue valendo. */
    async function carregarMapasSalvos() {
        if (estado.origem === 'arquivo') return;
        const acesso = window.IdentificadorAcesso;
        const cliente = acesso && acesso.cliente && acesso.cliente();
        if (!cliente) {
            mostrarAvisoMapas('Entre com a conta da gestão para ler o mapa salvo. Dá para subir o arquivo.', false);
            return;
        }
        const meu = ++pedidoMapas;
        mostrarAvisoMapas('lendo o último mapa salvo…', false);
        try {
            let resposta;
            try {
                resposta = await cliente.from('mapas_salas')
                    .select('id, avaliacao, periodo, mapa, criado_por, criado_em')
                    .order('criado_em', { ascending: false })
                    .limit(15);
            } catch (erro) {
                resposta = { error: erro };
            }
            if (meu !== pedidoMapas || estado.origem === 'arquivo') return;
            if (!resposta || resposta.error) {
                estado.mapasSalvos = [];
                preencherMapasSalvos();
                if ($('mapas-salvos') && $('mapas-salvos').options[0]) {
                    $('mapas-salvos').options[0].textContent = 'Nenhum mapa salvo ainda';
                }
                mostrarAvisoMapas(Mapa.tabelaAusente(resposta && resposta.error)
                    ? 'O Randomizador ainda não gravou mapas neste banco. Suba o arquivo .json.'
                    : 'Não consegui ler os mapas salvos. Suba o arquivo .json.', false);
                return;
            }
            const linhas = resposta.data || [];
            const ids = [];
            linhas.forEach(function (linha) {
                if (Mapa.ehUuid(linha.criado_por) && ids.indexOf(linha.criado_por) === -1) ids.push(linha.criado_por);
            });
            const nomes = Object.create(null);
            if (ids.length) {
                try {
                    const perfis = await cliente.from('montador_perfis').select('id, nome').in('id', ids);
                    if (perfis && !perfis.error && perfis.data) {
                        perfis.data.forEach(function (perfil) { nomes[perfil.id] = perfil.nome; });
                    }
                } catch (erro) { /* sem o nome, o mapa entra do mesmo jeito */ }
            }
            if (meu !== pedidoMapas || estado.origem === 'arquivo') return;
            estado.mapasSalvos = linhas.map(function (linha) {
                const mapa = Mapa.deLinha(linha);
                if (mapa.ok && nomes[linha.criado_por]) mapa.criadoPorNome = nomes[linha.criado_por];
                return mapa;
            }).filter(function (mapa) { return mapa.ok; });
            preencherMapasSalvos();
            if (!estado.mapasSalvos.length) {
                mostrarAvisoMapas('Ainda não há mapa salvo. Suba o arquivo .json.', false);
                const escolha = $('mapas-salvos');
                if (escolha && escolha.options[0]) escolha.options[0].textContent = 'Nenhum mapa salvo ainda';
                return;
            }
            aplicarMapaSalvo(estado.mapasSalvos[0]);
        } catch (erro) {
            if (meu !== pedidoMapas || estado.origem === 'arquivo') return;
            mostrarAvisoMapas('Não consegui ler os mapas salvos. Suba o arquivo .json.', false);
        }
    }

    function doisDigitos(numero) {
        const texto = String(numero);
        return /^\d$/.test(texto) ? '0' + texto : texto;
    }

    function dataCurta(iso) {
        const casamento = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return casamento ? casamento[3] + '/' + casamento[2] + '/' + casamento[1] : '';
    }

    function atualizarMapa() {
        if (!estado.mapa || !estado.mapa.ok) {
            estado.casamento = null;
            mostrarResumoMapa();
            return;
        }
        estado.casamento = Mapa.casar(estado.lote, estado.mapa);
        mostrarResumoMapa();
    }

    function chavesDe(origem) {
        const guardados = origem === 'gabaritos' ? estado.gabaritos : estado.arquivos;
        return Object.keys(guardados).map(function (chave) {
            const partes = chave.split('|');
            const componente = Identificacao.COMPONENTES.filter(function (item) { return item.codigo === partes[1]; })[0];
            if (!componente) return null;
            return { chave: chave, serie: partes[0], componente: componente, arquivo: guardados[chave] };
        }).filter(Boolean);
    }

    /* Monta as salas já com a identificação de cada via, pronta para o PDF. */
    function salasParaImprimir(origem) {
        const chaves = chavesDe(origem);
        const plano = Mapa.plano(estado.casamento, chaves.map(function (item) {
            return item.serie + '|' + item.componente.codigo;
        }));
        const porChave = Object.create(null);
        chaves.forEach(function (item) { porChave[item.serie + '|' + item.componente.codigo] = item; });

        const salas = plano.salas.map(function (sala) {
            const vias = sala.vias.map(function (via) {
                const tarefa = porChave[via.chave];
                const serieNome = (Identificacao.serie(via.serie) || {}).nome || '';
                const identificacao = Identificacao.identificar({
                    ano: $('ano').value,
                    bimestre: $('bimestre').value,
                    turma: via.turmaCurta,
                    numero: via.numero,
                    componente: via.componente,
                    nome: via.nome,
                    chave: $('chave').value,
                    titulo: $('avaliacao').value,
                    matricula: via.matricula || ''
                });
                identificacao.sala = sala.sala;
                identificacao.posicao = via.posicao;
                identificacao.serieNome = serieNome;
                return {
                    chave: via.chave,
                    arquivo: tarefa.arquivo,
                    serieNome: serieNome,
                    identificacao: identificacao,
                    posicao: via.posicao,
                    turma: via.turma,
                    numero: via.numero,
                    nome: via.nome,
                    componente: tarefa.componente.codigo,
                    componenteNome: tarefa.componente.nome
                };
            });
            const reservas = sala.reservas.map(function (reserva) {
                const tarefa = porChave[reserva.chave];
                return {
                    chave: reserva.chave,
                    arquivo: tarefa.arquivo,
                    serie: reserva.serie,
                    serieNome: (Identificacao.serie(reserva.serie) || {}).nome || '',
                    componente: tarefa.componente.codigo,
                    componenteNome: tarefa.componente.nome
                };
            });
            const alunos = [];
            const vistos = Object.create(null);
            vias.forEach(function (via) {
                const marca = via.posicao + '|' + via.turma + '|' + via.numero;
                if (vistos[marca]) return;
                vistos[marca] = true;
                alunos.push({ posicao: via.posicao, turma: via.turma, numero: via.numero, nome: via.nome });
            });
            return {
                sala: sala.sala,
                ordem: sala.ordem,
                provas: sala.provas,
                alunos: alunos,
                vias: vias,
                reservas: reservas,
                reservasTexto: reservas.map(function (reserva) {
                    return reserva.serieNome + ' · ' + reserva.componenteNome;
                }).join('; ')
            };
        });
        return { salas: salas, semArquivo: plano.semArquivo, provas: plano.provas };
    }

    function subtituloDasSalas() {
        const partes = [];
        const nome = $('avaliacao').value.trim();
        if (nome) partes.push(nome);
        partes.push($('bimestre').value.replace('B', '') + 'º bimestre de ' + $('ano').value);
        const periodo = estado.mapa && estado.mapa.periodo;
        if (periodo && (periodo.inicio || periodo.fim)) {
            const inicio = dataCurta(periodo.inicio);
            const fim = dataCurta(periodo.fim);
            if (inicio && fim) partes.push(inicio + ' a ' + fim);
            else if (inicio || fim) partes.push(inicio || fim);
        }
        return partes.join(' · ');
    }

    function listaDe(itens, texto) {
        const aviso = criar('div', 'aviso');
        aviso.appendChild(criar('strong', null, texto));
        const ul = criar('ul');
        itens.slice(0, 12).forEach(function (item) { ul.appendChild(criar('li', null, item)); });
        if (itens.length > 12) ul.appendChild(criar('li', null, '… e mais ' + (itens.length - 12)));
        aviso.appendChild(ul);
        return aviso;
    }

    function mostrarResumoMapa() {
        const alvo = $('resumo-mapa');
        const ver = $('ver-rosto');
        if (!alvo) return;
        limpar(alvo);
        if (ver) ver.disabled = true;
        if (!estado.mapa) return;

        if (!estado.mapa.ok) {
            const erro = criar('div', 'aviso aviso--erro');
            erro.textContent = estado.mapa.mensagem;
            alvo.appendChild(erro);
            return;
        }

        const casamento = estado.casamento;
        const intro = criar('div', casamento.casados ? 'aviso aviso--ok' : 'aviso');
        const salasComGente = casamento.salas.filter(function (sala) { return sala.alunos.length; }).length;
        intro.textContent = casamento.casados + (casamento.casados === 1 ? ' aluno casado com a lista' : ' alunos casados com a lista') +
            ' em ' + salasComGente + (salasComGente === 1 ? ' sala.' : ' salas.');
        if (estado.mapa.avaliacao) intro.textContent += ' Mapa: ' + estado.mapa.avaliacao + '.';
        alvo.appendChild(intro);

        const nomePasso = $('avaliacao').value.trim();
        if (nomePasso && estado.mapa.avaliacao && Identificacao.normalizarNome(nomePasso) !== Identificacao.normalizarNome(estado.mapa.avaliacao)) {
            const nota = criar('div', 'aviso');
            nota.textContent = 'O passo 1 diz «' + nomePasso + '» e o mapa diz «' + estado.mapa.avaliacao + '». A prova sai com o nome do passo 1.';
            alvo.appendChild(nota);
        }

        const tabela = criar('table', 'mapa-tabela');
        const cabeca = criar('tr');
        ['Sala', 'Ordem', 'Com prova', 'Lugares no mapa'].forEach(function (titulo) {
            cabeca.appendChild(criar('th', null, titulo));
        });
        const thead = criar('thead');
        thead.appendChild(cabeca);
        tabela.appendChild(thead);
        const corpo = criar('tbody');
        casamento.salas.forEach(function (sala) {
            const comProva = sala.alunos.filter(function (aluno) { return aluno.casado; }).length;
            const linha = criar('tr');
            [sala.sala, String(sala.ordem), String(comProva), String(sala.alunos.length)].forEach(function (celula) {
                linha.appendChild(criar('td', null, celula));
            });
            corpo.appendChild(linha);
        });
        tabela.appendChild(corpo);
        alvo.appendChild(tabela);

        if (casamento.avisosNome.length) {
            alvo.appendChild(listaDe(casamento.avisosNome.map(function (aviso) {
                return aviso.sala + ', posição ' + aviso.posicao + ', ' + aviso.turma + ' nº ' + doisDigitos(aviso.numero) +
                    ': no mapa «' + (aviso.nomeMapa || 'sem nome') + '», na lista «' + aviso.nomeLista + '». A prova sai com o nome da lista.';
            }), 'Nome diferente no mapa e na lista. Isto não impede a impressão.'));
        }
        if (casamento.semSala.length) {
            alvo.appendChild(listaDe(casamento.semSala.map(function (aluno) {
                return aluno.turma + ' nº ' + doisDigitos(aluno.numero) + ' · ' + aluno.nome;
            }), 'Da lista, sem sala no mapa (' + casamento.semSala.length + ').'));
        }
        if (casamento.semProva.length) {
            alvo.appendChild(listaDe(casamento.semProva.map(function (aluno) {
                return aluno.sala + ', posição ' + aluno.posicao + ', ' + aluno.turma + ' nº ' + doisDigitos(aluno.numero) +
                    (aluno.nome ? ' · ' + aluno.nome : '');
            }), 'Do mapa, sem aluno correspondente na lista (' + casamento.semProva.length + ').'));
        }
        if (estado.mapa.ignorados && estado.mapa.ignorados.length) {
            alvo.appendChild(listaDe(estado.mapa.ignorados, 'Lugares do mapa sem turma ou número, deixados de fora.'));
        }

        const chaves = chavesDe('arquivos');
        if (chaves.length && casamento.casados) {
            const plano = Mapa.plano(casamento, chaves.map(function (item) { return item.serie + '|' + item.componente.codigo; }));
            if (plano.semArquivo.length) {
                alvo.appendChild(listaDe(plano.semArquivo.map(function (aluno) {
                    return aluno.sala + ', posição ' + aluno.posicao + ', ' + aluno.turma + ' nº ' + doisDigitos(aluno.numero) + ' · ' + aluno.nome;
                }), 'Com sala, mas sem arquivo de prova da série no passo 3.'));
            }
        }

        if (ver) ver.disabled = !casamento.casados;
    }

    async function abrirFolhaDeRosto() {
        if (!mapaAtivo()) return;
        const aviso = $('resumo-mapa');
        const comArquivo = salasParaImprimir('arquivos');
        const salas = comArquivo.salas.length ? comArquivo.salas : estado.casamento.salas.map(function (sala) {
            const alunos = sala.alunos.filter(function (aluno) { return aluno.casado; }).map(function (aluno) {
                return { posicao: aluno.posicao, turma: aluno.turmaMapa || aluno.turma, numero: aluno.numero, nome: aluno.nome };
            });
            return { sala: sala.sala, provas: alunos.length, alunos: alunos, reservasTexto: '' };
        }).filter(function (sala) { return sala.alunos.length; });
        try {
            const bytes = await Pdf.montarFolhasRosto({
                salas: salas,
                subtitulo: subtituloDasSalas(),
                logo: await bytesDoLogo(),
                tituloArquivo: 'Folhas de rosto · ' + subtituloDasSalas()
            });
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            window.open(url, '_blank');
            setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
        } catch (erro) {
            if (aviso) {
                const falha = criar('div', 'aviso aviso--erro');
                falha.textContent = 'Não deu para abrir a folha de rosto: ' + (erro.message || erro);
                aviso.appendChild(falha);
            }
        }
    }

    $('mapa-salas').addEventListener('change', function () {
        const arquivo = this.files && this.files[0];
        if (!arquivo) return;
        const leitor = new FileReader();
        leitor.onload = function () {
            pedidoMapas++;
            estado.origem = 'arquivo';
            estado.mapa = Mapa.ler(String(leitor.result || ''));
            if ($('mapas-salvos')) $('mapas-salvos').value = '';
            mostrarAvisoMapas(estado.mapa.ok ? 'Usando o arquivo enviado.' : '', !!estado.mapa.ok);
            atualizarMapa();
        };
        leitor.onerror = function () {
            estado.mapa = { ok: false, mensagem: 'Não consegui ler o arquivo do mapa.' };
            estado.casamento = null;
            mostrarResumoMapa();
        };
        leitor.readAsText(arquivo);
    });

    $('limpar-mapa').addEventListener('click', function () {
        pedidoMapas++;
        $('mapa-salas').value = '';
        if ($('mapas-salvos')) $('mapas-salvos').value = '';
        estado.origem = null;
        estado.mapa = null;
        estado.casamento = null;
        mostrarAvisoMapas('', false);
        mostrarResumoMapa();
    });

    $('mapas-salvos').addEventListener('change', function () {
        const escolhido = estado.mapasSalvos.filter(function (mapa) { return String(mapa.id) === $('mapas-salvos').value; })[0];
        if (!escolhido) return;
        aplicarMapaSalvo(escolhido);
    });

    document.getElementById('modo-impressao').addEventListener('change', function () {
        if (modoImpressao() === 'sala' && estado.origem !== 'arquivo') carregarMapasSalvos();
    });
    preencherMapasSalvos();

    $('ver-rosto').addEventListener('click', abrirFolhaDeRosto);
    $('avaliacao').addEventListener('input', function () {
        if (estado.mapa) mostrarResumoMapa();
    });

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
            mostrarResumoMapa();
            return;
        }

        const extensao = (arquivo.name.split('.').pop() || '').toLowerCase();

        if (extensao === 'docx' || extensao === 'doc' || extensao === 'odt') {
            slot.classList.remove('cheio');
            estadoTexto.textContent = 'Word não dá: abra no Word e use Arquivo → Salvar como → PDF, ou escolha o modelo de etiquetas.';
            delete estado.arquivos[chave];
            atualizarListaDePrevia();
            mostrarResumoMapa();
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
            mostrarResumoMapa();
        };
        leitor.onerror = function () {
            estadoTexto.textContent = 'Não consegui ler o arquivo.';
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    /* ===================== aba: gabaritos identificados =====================

       Opcional, para quando a folha de respostas vem separada da prova. Reaproveita
       a lista de alunos do passo 2 e o cabeçalho do passo 4: o gabarito recebe a
       mesma identificação da prova daquele aluno — inclusive o mesmo código —,
       de modo que as duas folhas se cruzem. */

    /* Os gabaritos carregados, um por série e componente. O envio não depende da
       lista de alunos: a folha de respostas é arquivo separado e pode ser
       carregada antes de qualquer coisa. A lista só faz falta na hora de gerar,
       porque é dela que sai a identificação. */
    function montarSeletoresDeGabarito() {
        const serie = $('gab-serie');
        const componente = $('gab-componente');
        if (!serie || serie.options.length) return;

        Identificacao.SERIES.forEach(function (s) {
            const opcao = criar('option', null, s.nome);
            opcao.value = s.codigo;
            serie.appendChild(opcao);
        });
        Identificacao.COMPONENTES.forEach(function (c) {
            const opcao = criar('option', null, c.nome);
            opcao.value = c.codigo;
            componente.appendChild(opcao);
        });
    }

    function montarSlotsDeGabarito() {
        const alvo = $('slots-gabarito');
        if (!alvo) return;
        montarSeletoresDeGabarito();
        limpar(alvo);

        const chaves = Object.keys(estado.gabaritos);
        if (!chaves.length) {
            alvo.appendChild(criar('p', 'dica', 'Nenhum gabarito carregado ainda. Escolha a série e o componente acima e envie o arquivo.'));
            return;
        }

        chaves.sort().forEach(function (chave) {
            const partes = chave.split('|');
            const serie = Identificacao.serie(partes[0]);
            const componente = Identificacao.COMPONENTES.filter(function (c) { return c.codigo === partes[1]; })[0];
            const guardado = estado.gabaritos[chave];

            const linha = criar('div', 'gabarito-carregado');
            const qual = criar('div', 'qual', (serie ? serie.nome : partes[0]) + ' · ' + (componente ? componente.nome : partes[1]));
            qual.appendChild(criar('small', null, guardado.nome +
                (guardado.paginas ? ' · ' + guardado.paginas + ' página(s)' : '') +
                ' · turmas: ' + (turmasDaSerie(partes[0]).map(function (t) { return t.turma; }).join(', ') || 'a lista do passo 2 ainda não tem turma desta série')));
            linha.appendChild(qual);

            /* Quase sempre a mesma folha de respostas serve para os cinco
               componentes da série. */
            const repetir = criar('button', 'btn btn--pequeno', 'Usar nos outros componentes');
            repetir.type = 'button';
            repetir.addEventListener('click', function () {
                Identificacao.COMPONENTES.forEach(function (outro) {
                    estado.gabaritos[chaveSlot(partes[0], outro.codigo)] = guardado;
                });
                montarSlotsDeGabarito();
                atualizarListaDePreviaGabarito();
            });
            linha.appendChild(repetir);

            const remover = criar('button', 'btn btn--pequeno', 'Remover');
            remover.type = 'button';
            remover.addEventListener('click', function () {
                delete estado.gabaritos[chave];
                if (estado.previaGabarito.chave === chave) estado.previaGabarito.chave = null;
                montarSlotsDeGabarito();
                atualizarListaDePreviaGabarito();
                atualizarPreviaGabarito();
            });
            linha.appendChild(remover);

            alvo.appendChild(linha);
        });
    }

    $('gab-arquivo').addEventListener('change', function () {
        const entrada = $('gab-arquivo');
        receberGabarito(chaveSlot($('gab-serie').value, $('gab-componente').value), entrada.files[0]);
        entrada.value = '';
    });

    function receberGabarito(chave, arquivo) {
        const aviso = $('aviso-gab-arquivo');
        if (!arquivo) return;

        const extensao = (arquivo.name.split('.').pop() || '').toLowerCase();
        if (extensao === 'docx' || extensao === 'doc' || extensao === 'odt') {
            aviso.textContent = 'Word não dá: abra no Word e use Arquivo → Salvar como → PDF.';
            return;
        }
        if (['pdf', 'jpg', 'jpeg', 'png'].indexOf(extensao) === -1) {
            aviso.textContent = 'Formato não aceito: use PDF, JPG ou PNG.';
            return;
        }

        aviso.textContent = 'lendo…';
        const leitor = new FileReader();
        leitor.onload = function () {
            estado.gabaritos[chave] = {
                nome: arquivo.name,
                tipo: extensao === 'jpeg' ? 'jpg' : extensao,
                bytes: new Uint8Array(leitor.result),
                paginas: null
            };
            aviso.textContent = arquivo.name + ' carregado.';
            montarSlotsDeGabarito();
            atualizarListaDePreviaGabarito();
            if (!estado.previaGabarito.chave) $('previa-gabarito-arquivo').value = chave;
            atualizarPreviaGabarito();
        };
        leitor.onerror = function () {
            aviso.textContent = 'Não consegui ler o arquivo.';
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    /* O cabeçalho do gabarito tem geometria própria: num quarto de folha A4 não
       cabe o bloco de 19 cm da capa da prova. O estilo (código legível, moldura,
       rótulo) acompanha o do passo 4, para as duas folhas do aluno terem a mesma
       cara; os quadros de acertos e pontos ficam de fora, porque são da capa. */
    function montarConfiguracaoGabarito() {
        const daProva = montarConfiguracao().cabecalho;
        const altura = numero('gab-altura', 1.6);
        return {
            cabecalho: {
                xCm: numero('gab-x', 0.5),
                yCm: numero('gab-y', 0.3),
                larguraCm: numero('gab-largura', 9.5),
                alturaCm: altura,
                incluirQr: $('gab-qr').value !== 'sem',
                qrNaEsquerda: $('gab-qr').value === 'esquerda',
                incluirCodigo: $('gab-qr').value === 'sem' ? true : daProva.incluirCodigo,
                moldura: daProva.moldura,
                rotulo: daProva.rotulo,
                incluirCorrecao: false,
                /* Numa folha pequena a linha da data só rouba espaço do nome. */
                incluirData: false,
                /* O QR e o logo encolhem junto com a altura do bloco. */
                ladoQrCm: Math.max(0.9, Math.min(2, altura - 0.25)),
                ladoLogoCm: Math.max(0.8, Math.min(1.9, altura - 0.3))
            },
            /* O gabarito nunca é redimensionado: as marcas de alinhamento da
               leitura óptica têm de ficar onde estão. */
            espacoTopoCm: 0,
            quatroPorFolha: $('gab-quatro').checked
        };
    }

    async function gerarGabaritos() {
        const alvo = $('resultados-gabaritos');
        const estadoTexto = $('estado-gabaritos');
        limpar(alvo);
        const resultados = [];

        if (!estado.lote.turmas.length) {
            estadoTexto.textContent = 'Falta colar a lista dos alunos no passo 2, na aba Gerar as provas.';
            return;
        }

        if (modoImpressao() === 'sala') {
            if (!estado.mapa && estado.origem !== 'arquivo') {
                try { await carregarMapasSalvos(); } catch (erro) { /* o aviso já explica; segue por turma */ }
            }
            if (mapaAtivo()) {
                $('gerar-gabaritos').disabled = true;
                try {
                    const fez = await gerarGabaritosPorSala(alvo, estadoTexto);
                    if (!fez) {
                        estadoTexto.textContent = chavesDe('gabaritos').length
                            ? 'O mapa está carregado, mas nenhum gabarito enviado cobre as séries das salas. Envie esses gabaritos, ou marque Imprimir por turma.'
                            : 'Carregue o arquivo de pelo menos um gabarito aqui em cima.';
                    }
                } catch (erro) {
                    estadoTexto.textContent = 'Parou no meio: ' + (erro.message || erro);
                } finally {
                    $('gerar-gabaritos').disabled = false;
                }
                return;
            }
            estadoTexto.textContent = 'Para os gabaritos por sala, falta o mapa. Escolha um mapa salvo ou suba o arquivo. Imprimir por turma continua disponível.';
            return;
        }

        const tarefas = [];
        const semTurma = [];
        Object.keys(estado.gabaritos).sort().forEach(function (chave) {
            const partes = chave.split('|');
            const componente = Identificacao.COMPONENTES.filter(function (c) { return c.codigo === partes[1]; })[0];
            const turmas = turmasDaSerie(partes[0]);
            if (!turmas.length) {
                semTurma.push((Identificacao.serie(partes[0]) || {}).nome || partes[0]);
                return;
            }
            turmas.forEach(function (turma) {
                tarefas.push({ serie: partes[0], componente: componente, turma: turma, chave: chave });
            });
        });

        if (!tarefas.length) {
            estadoTexto.textContent = semTurma.length
                ? 'A lista do passo 2 não tem turma da ' + semTurma[0] + ', que é a série do gabarito carregado.'
                : 'Carregue o arquivo de pelo menos um gabarito aqui em cima.';
            return;
        }

        $('gerar-gabaritos').disabled = true;
        const configuracao = montarConfiguracaoGabarito();

        try {
            for (let i = 0; i < tarefas.length; i++) {
                const tarefa = tarefas[i];
                estadoTexto.textContent = 'gerando ' + (i + 1) + ' de ' + tarefas.length +
                    ' — ' + tarefa.turma.turma + ' · ' + tarefa.componente.nome + '…';
                await new Promise(function (resolve) { setTimeout(resolve, 0); });

                const serieNome = (Identificacao.serie(tarefa.serie) || {}).nome;
                /* Mesma chamada da prova: o aluno recebe no gabarito o código
                   que já está na prova dele. */
                const provas = Identificacao.identificarTurma({
                    ano: $('ano').value,
                    bimestre: $('bimestre').value,
                    turma: tarefa.turma.turma,
                    componente: tarefa.componente.codigo,
                    alunos: tarefa.turma.alunos,
                    chave: $('chave').value,
                    titulo: $('avaliacao').value
                });

                const dados = {
                    ano: $('ano').value,
                    bimestre: $('bimestre').value,
                    turma: tarefa.turma.turma,
                    componente: tarefa.componente.codigo,
                    serieNome: serieNome
                };
                const nomeAvaliacao = $('avaliacao').value.trim();
                const subtitulo = 'Gabarito · ' + (nomeAvaliacao ? nomeAvaliacao + ' · ' : '') + serieNome +
                    ' · Turma ' + tarefa.turma.turma + ' · ' + tarefa.componente.nome +
                    ' · ' + $('bimestre').value.replace('B', '') + 'º bimestre de ' + $('ano').value;

                const pacote = { titulo: subtitulo, dados: dados, provas: provas, arquivos: [] };

                const comum = {
                    arquivo: estado.gabaritos[tarefa.chave],
                    cabecalho: configuracao.cabecalho,
                    serieNome: serieNome,
                    avaliacao: $('avaliacao').value,
                    logo: await bytesDoLogo()
                };

                if (configuracao.quatroPorFolha) {
                    const bytes = await Pdf.montarGabaritosEmQuartos(Object.assign({}, comum, {
                        identificacoes: provas,
                        tituloArquivo: subtitulo
                    }));
                    /* Arquivo maior que um quarto de A4 entra reduzido; quem
                       lê gabarito por leitura óptica precisa saber disso. */
                    const encolheu = bytes.escalaUsada && bytes.escalaUsada < 0.99;
                    pacote.arquivos.push({
                        rotulo: 'Gabaritos identificados, quatro por folha A4 (PDF)' +
                            (encolheu ? ' — reduzido a ' + Math.round(bytes.escalaUsada * 100) + '%' : ''),
                        nome: Saida.nomeArquivo('GABARITO', dados, 'pdf'),
                        tipo: 'application/pdf',
                        bytes: bytes
                    });
                    pacote.arquivos.push({
                        rotulo: 'Gabarito reserva, sem identificação (PDF)',
                        nome: Saida.nomeArquivo('GABARITO-RESERVA', dados, 'pdf'),
                        tipo: 'application/pdf',
                        bytes: await Pdf.montarGabaritosEmQuartos(Object.assign({}, comum, {
                            copiasEmBranco: 4,
                            tituloArquivo: 'Gabarito reserva · ' + subtitulo
                        }))
                    });
                } else {
                    pacote.arquivos.push({
                        rotulo: 'Gabaritos identificados (PDF)',
                        nome: Saida.nomeArquivo('GABARITO', dados, 'pdf'),
                        tipo: 'application/pdf',
                        bytes: await Pdf.montarPrimeirasPaginas(Object.assign({}, comum, {
                            identificacoes: provas,
                            espacoTopoCm: configuracao.espacoTopoCm,
                            /* Uma via por aluno com todas as páginas do arquivo. */
                            provaInteira: true,
                            tituloArquivo: subtitulo
                        }))
                    });
                    pacote.arquivos.push({
                        rotulo: 'Gabarito reserva, sem identificação (PDF)',
                        nome: Saida.nomeArquivo('GABARITO-RESERVA', dados, 'pdf'),
                        tipo: 'application/pdf',
                        bytes: await Pdf.montarProvaGenerica(Object.assign({}, comum, {
                            turma: tarefa.turma.turma,
                            componente: tarefa.componente.codigo,
                            espacoTopoCm: configuracao.espacoTopoCm,
                            provaInteira: true,
                            tituloArquivo: 'Gabarito reserva · ' + subtitulo
                        }))
                    });
                }

                resultados.push(pacote);
                alvo.appendChild(cartaoDeResultado(pacote));
            }

            estadoTexto.textContent = 'guardando nos arquivos recentes…';
            const guardou = await guardarNoHistorico(resultados);
            estadoTexto.textContent = 'pronto: ' + tarefas.length +
                (tarefas.length === 1 ? ' gabarito gerado.' : ' conjuntos de gabarito gerados.') +
                (guardou ? '' : ' (Não consegui guardar nos arquivos recentes: baixe agora.)');
            alvo.appendChild(barraDeTudo(resultados));
        } catch (erro) {
            estadoTexto.textContent = 'Parou no meio: ' + (erro.message || erro);
        } finally {
            $('gerar-gabaritos').disabled = false;
        }
    }

    /* --- prévia do gabarito: mesma mecânica da prévia da prova, sem a faixa,
           porque o gabarito nunca é redimensionado. --- */

    function atualizarListaDePreviaGabarito() {
        const escolha = $('previa-gabarito-arquivo');
        if (!escolha) return;
        const anterior = escolha.value;
        limpar(escolha);

        const chaves = Object.keys(estado.gabaritos);
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

    let desenhandoGabarito = false;
    async function atualizarPreviaGabarito() {
        const escolha = $('previa-gabarito-arquivo');
        if (!escolha) return;
        const chave = escolha.value;
        const arquivo = chave ? estado.gabaritos[chave] : null;
        const canvas = $('previa-gabarito-canvas');

        if (!arquivo) {
            canvas.hidden = true;
            $('previa-gabarito-vazia').hidden = false;
            $('marca-gabarito').hidden = true;
            return;
        }

        $('previa-gabarito-vazia').hidden = true;
        canvas.hidden = false;

        if (estado.previaGabarito.chave !== chave && !desenhandoGabarito) {
            desenhandoGabarito = true;
            try {
                estado.previaGabarito.medidas = await Previa.desenhar(canvas, arquivo, LARGURA_PREVIA);
                estado.previaGabarito.chave = chave;
                arquivo.paginas = estado.previaGabarito.medidas.paginas;
                ajustarMedidasAoGabarito();
            } catch (erro) {
                $('previa-gabarito-vazia').hidden = false;
                $('previa-gabarito-vazia').textContent = 'Não consegui desenhar a prévia: ' + (erro.message || erro);
                canvas.hidden = true;
            } finally {
                desenhandoGabarito = false;
            }
        }

        posicionarMarcaDoGabarito();
    }

    /* Enquanto a coordenação não mexer nas medidas, elas se ajustam ao tamanho
       real da folha enviada — um quarto de A4 não comporta o bloco da capa. */
    function ajustarMedidasAoGabarito() {
        if (estado.previaGabarito.medidasTocadas) return;
        const medidas = estado.previaGabarito.medidas;
        if (!medidas) return;

        const largura = Math.max(4, Math.round((medidas.larguraCm - 1) * 10) / 10);
        $('gab-largura').value = largura.toFixed(1);
        $('gab-altura').value = (medidas.larguraCm > 15 ? 2.5 : 1.6).toFixed(1);
        $('gab-x').value = '0.5';
        $('gab-y').value = '0.3';
    }

    function posicionarMarcaDoGabarito() {
        const medidas = estado.previaGabarito.medidas;
        if (!medidas) return;
        const escala = $('previa-gabarito-canvas').clientWidth / medidas.larguraCm;
        const cabecalho = montarConfiguracaoGabarito().cabecalho;
        const caixa = $('marca-gabarito');
        caixa.hidden = false;
        caixa.style.left = (cabecalho.xCm * escala) + 'px';
        caixa.style.top = (cabecalho.yCm * escala) + 'px';
        caixa.style.width = (cabecalho.larguraCm * escala) + 'px';
        caixa.style.height = (cabecalho.alturaCm * escala) + 'px';
    }

    function cmDoEventoGabarito(evento) {
        const medidas = estado.previaGabarito.medidas;
        const canvas = $('previa-gabarito-canvas');
        if (!medidas || canvas.hidden) return null;
        const area = canvas.getBoundingClientRect();
        const escala = medidas.larguraCm / area.width;
        return {
            x: Math.max(0, (evento.clientX - area.left) * escala),
            y: Math.max(0, (evento.clientY - area.top) * escala)
        };
    }

    $('previa-gabarito-palco').addEventListener('mousemove', function (evento) {
        const ponto = cmDoEventoGabarito(evento);
        $('previa-gabarito-cursor').textContent = ponto ? ponto.x.toFixed(1) + ' cm × ' + ponto.y.toFixed(1) + ' cm' : '';
    });
    $('previa-gabarito-palco').addEventListener('mouseleave', function () {
        $('previa-gabarito-cursor').textContent = '';
    });
    $('previa-gabarito-palco').addEventListener('click', function (evento) {
        const ponto = cmDoEventoGabarito(evento);
        if (!ponto) return;
        estado.previaGabarito.medidasTocadas = true;
        $('gab-x').value = (Math.round(ponto.x * 10) / 10).toFixed(1);
        $('gab-y').value = (Math.round(ponto.y * 10) / 10).toFixed(1);
        posicionarMarcaDoGabarito();
    });

    $('previa-gabarito-arquivo').addEventListener('change', function () {
        estado.previaGabarito.chave = null;
        atualizarPreviaGabarito();
    });

    ['gab-largura', 'gab-altura', 'gab-x', 'gab-y'].forEach(function (id) {
        $(id).addEventListener('input', function () {
            estado.previaGabarito.medidasTocadas = true;
            posicionarMarcaDoGabarito();
        });
    });
    $('gab-qr').addEventListener('change', posicionarMarcaDoGabarito);
    $('gab-quatro').addEventListener('change', function () { $('aviso-amostra-gabarito').textContent = ''; });

    $('ver-amostra-gabarito').addEventListener('click', async function () {
        const chave = $('previa-gabarito-arquivo').value;
        const arquivo = chave ? estado.gabaritos[chave] : null;
        const aviso = $('aviso-amostra-gabarito');

        if (!arquivo) { aviso.textContent = 'Envie um gabarito aqui em cima primeiro.'; return; }
        if (!estado.lote.turmas.length) { aviso.textContent = 'Cole a lista dos alunos no passo 2 primeiro.'; return; }

        const serie = chave.split('|')[0];
        const turma = turmasDaSerie(serie)[0] || estado.lote.turmas[0];
        aviso.textContent = 'montando…';

        try {
            const provas = Identificacao.identificarTurma({
                ano: $('ano').value,
                bimestre: $('bimestre').value,
                turma: turma.turma,
                componente: chave.split('|')[1],
                alunos: turma.alunos.slice(0, 1),
                chave: $('chave').value,
                titulo: $('avaliacao').value
            });
            const configuracao = montarConfiguracaoGabarito();
            const comum = {
                arquivo: arquivo,
                identificacoes: provas,
                cabecalho: configuracao.cabecalho,
                serieNome: (Identificacao.serie(serie) || {}).nome,
                avaliacao: $('avaliacao').value,
                logo: await bytesDoLogo()
            };
            /* A amostra sai do mesmo jeito que a impressão vai sair. */
            const bytes = configuracao.quatroPorFolha
                ? await Pdf.montarGabaritosEmQuartos(comum)
                : await Pdf.montarPrimeirasPaginas(Object.assign({}, comum, { espacoTopoCm: 0, provaInteira: true }));
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            window.open(url, '_blank');
            setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
            aviso.textContent = 'abri numa aba nova.';
        } catch (erro) {
            aviso.textContent = 'Não deu: ' + (erro.message || erro);
        }
    });

    /* ===================== passo 4: o cabeçalho ===================== */

    function modelo() {
        const marcado = document.querySelector('input[name="modelo"]:checked');
        return marcado ? marcado.value : 'espaco-deixado';
    }

    function aoTrocarModelo() {
        const atual = modelo();
        /* Etiqueta não usa a prova enviada: a escolha das páginas sai de cena. */
        $('paginas-prova').hidden = atual === 'etiquetas';
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

        const paginas = document.querySelector('input[name="paginas"]:checked');
        return {
            cabecalho: cabecalho,
            provaInteira: !!paginas && paginas.value === 'inteira',
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
                chave: $('chave').value,
                titulo: $('avaliacao').value
            });
            const configuracao = montarConfiguracao();
            const bytes = await Pdf.montarPrimeirasPaginas({
                arquivo: arquivo,
                identificacoes: provas,
                cabecalho: configuracao.cabecalho,
                espacoTopoCm: configuracao.espacoTopoCm,
                provaInteira: configuracao.provaInteira,
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

    async function gerarPorSalas(alvo, estadoTexto, configuracao) {
        const montado = salasParaImprimir('arquivos');
        if (!montado.salas.length) return false;

        estadoTexto.textContent = 'gerando o PDF das salas…';
        await new Promise(function (resolve) { setTimeout(resolve, 0); });
        const subtitulo = subtituloDasSalas();
        const base = {
            cabecalho: configuracao.cabecalho,
            espacoTopoCm: configuracao.espacoTopoCm,
            provaInteira: configuracao.provaInteira,
            avaliacao: $('avaliacao').value,
            logo: await bytesDoLogo(),
            subtitulo: subtitulo,
            rotulo: 'provas',
            rotuloUma: 'prova'
        };
        const dados = { ano: $('ano').value, bimestre: $('bimestre').value };
        const provas = [];
        montado.salas.forEach(function (sala) {
            sala.vias.forEach(function (via) { provas.push(via.identificacao); });
        });

        const pacote = { titulo: 'Provas na ordem das salas', provas: provas, arquivos: [] };
        pacote.arquivos.push({
            rotulo: 'PDF único, salas em sequência (' + (configuracao.provaInteira ? 'prova inteira' : 'capa e verso') + ')',
            nome: Saida.nomeArquivo('PROVAS-SALAS', dados, 'pdf'),
            tipo: 'application/pdf',
            bytes: await Pdf.montarPacotePorSala(Object.assign({}, base, {
                salas: montado.salas,
                tituloArquivo: 'Provas por sala · ' + subtitulo
            }))
        });

        if ($('pdf-por-sala').checked) {
            for (let i = 0; i < montado.salas.length; i++) {
                const sala = montado.salas[i];
                estadoTexto.textContent = 'gerando o PDF da ' + sala.sala + '…';
                await new Promise(function (resolve) { setTimeout(resolve, 0); });
                pacote.arquivos.push({
                    rotulo: 'PDF só da ' + sala.sala,
                    nome: Saida.nomeArquivo('PROVA', { ano: dados.ano, bimestre: dados.bimestre, turma: sala.sala }, 'pdf'),
                    tipo: 'application/pdf',
                    bytes: await Pdf.montarPacotePorSala(Object.assign({}, base, {
                        salas: [sala],
                        tituloArquivo: sala.sala + ' · ' + subtitulo
                    }))
                });
            }
        }

        pacote.arquivos.push({
            rotulo: 'Folha de conferência (PDF)',
            nome: Saida.nomeArquivo('CONFERENCIA-SALAS', dados, 'pdf'),
            tipo: 'application/pdf',
            bytes: await Pdf.montarFolhaConferencia({ identificacoes: provas, subtitulo: subtitulo })
        });
        pacote.arquivos.push({
            rotulo: 'Conferência (CSV)',
            nome: Saida.nomeArquivo('CONFERENCIA-SALAS', dados, 'csv'),
            tipo: 'text/csv;charset=utf-8',
            bytes: Saida.montarCsv(provas, dados)
        });

        estado.resultados.push(pacote);
        alvo.appendChild(cartaoDeResultado(pacote));
        estadoTexto.textContent = 'guardando nos arquivos recentes…';
        const guardou = await guardarNoHistorico(estado.resultados);
        estadoTexto.textContent = 'pronto: provas na ordem das salas.' +
            (guardou ? '' : ' (Não consegui guardar nos arquivos recentes: baixe agora.)');
        alvo.appendChild(barraDeTudo());
        return true;
    }

    async function gerarGabaritosPorSala(alvo, estadoTexto) {
        const montado = salasParaImprimir('gabaritos');
        if (!montado.salas.length) return false;

        const configuracao = montarConfiguracaoGabarito();
        const subtitulo = 'Gabaritos · ' + subtituloDasSalas();
        const base = {
            cabecalho: configuracao.cabecalho,
            avaliacao: $('avaliacao').value,
            logo: await bytesDoLogo(),
            subtitulo: subtitulo,
            quatroPorFolha: configuracao.quatroPorFolha,
            espacoTopoCm: configuracao.espacoTopoCm
        };
        const dados = { ano: $('ano').value, bimestre: $('bimestre').value };
        const provas = [];
        montado.salas.forEach(function (sala) {
            sala.vias.forEach(function (via) { provas.push(via.identificacao); });
        });

        estadoTexto.textContent = 'gerando os gabaritos na ordem das salas…';
        const bytes = await Pdf.montarGabaritosPorSala(Object.assign({}, base, {
            salas: montado.salas,
            tituloArquivo: subtitulo
        }));
        const encolheu = configuracao.quatroPorFolha && bytes.escalaUsada && bytes.escalaUsada < 0.99;
        const pacote = {
            titulo: 'Gabaritos na ordem das salas',
            provas: provas,
            arquivos: [{
                rotulo: (configuracao.quatroPorFolha
                    ? 'Gabaritos identificados, quatro por folha A4, na ordem das salas (PDF)'
                    : 'Gabaritos identificados, na ordem das salas (PDF)') +
                    (encolheu ? ' — reduzido a ' + Math.round(bytes.escalaUsada * 100) + '%' : ''),
                nome: Saida.nomeArquivo('GABARITOS-SALAS', dados, 'pdf'),
                tipo: 'application/pdf',
                bytes: bytes
            }]
        };

        if ($('pdf-por-sala').checked) {
            for (let i = 0; i < montado.salas.length; i++) {
                const sala = montado.salas[i];
                pacote.arquivos.push({
                    rotulo: 'Gabaritos só da ' + sala.sala,
                    nome: Saida.nomeArquivo('GABARITO', { ano: dados.ano, bimestre: dados.bimestre, turma: sala.sala }, 'pdf'),
                    tipo: 'application/pdf',
                    bytes: await Pdf.montarGabaritosPorSala(Object.assign({}, base, {
                        salas: [sala],
                        tituloArquivo: sala.sala + ' · ' + subtitulo
                    }))
                });
            }
        }

        const resultados = [pacote];
        alvo.appendChild(cartaoDeResultado(pacote));
        estadoTexto.textContent = 'guardando nos arquivos recentes…';
        const guardou = await guardarNoHistorico(resultados);
        estadoTexto.textContent = 'pronto: gabaritos na ordem das salas.' +
            (guardou ? '' : ' (Não consegui guardar nos arquivos recentes: baixe agora.)');
        alvo.appendChild(barraDeTudo(resultados));
        return true;
    }

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
            if (atual !== 'etiquetas' && modoImpressao() === 'sala') {
                if (!estado.mapa && estado.origem !== 'arquivo') await carregarMapasSalvos();
                if (!mapaAtivo()) {
                    estadoTexto.textContent = 'Para imprimir por sala, escolha um mapa salvo ou suba o arquivo .json. Imprimir por turma continua disponível.';
                    return;
                }
                const fez = await gerarPorSalas(alvo, estadoTexto, configuracao);
                if (!fez) {
                    estadoTexto.textContent = 'O mapa está carregado, mas nenhuma prova enviada cobre as séries das salas. Envie essas provas no passo 3, ou marque Imprimir por turma.';
                }
                return;
            }
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
                    chave: $('chave').value,
                    titulo: $('avaliacao').value
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
                        rotulo: 'Provas identificadas, ' + (configuracao.provaInteira ? 'prova inteira' : 'capa e verso') + ' (PDF)',
                        nome: Saida.nomeArquivo('PROVA', dados, 'pdf'),
                        tipo: 'application/pdf',
                        bytes: await Pdf.montarPrimeirasPaginas({
                            arquivo: estado.arquivos[tarefa.chave],
                            identificacoes: provas,
                            cabecalho: configuracao.cabecalho,
                            espacoTopoCm: configuracao.espacoTopoCm,
                            provaInteira: configuracao.provaInteira,
                            serieNome: serieNome,
                            tituloArquivo: subtitulo,
                            avaliacao: $('avaliacao').value,
                            logo: await bytesDoLogo()
                        })
                    });
                    pacote.arquivos.push({
                        rotulo: 'Prova reserva, sem identificação (PDF)',
                        nome: Saida.nomeArquivo('PROVA-RESERVA', dados, 'pdf'),
                        tipo: 'application/pdf',
                        bytes: await Pdf.montarProvaGenerica({
                            arquivo: estado.arquivos[tarefa.chave],
                            turma: tarefa.turma.turma,
                            componente: tarefa.componente.codigo,
                            cabecalho: configuracao.cabecalho,
                            espacoTopoCm: configuracao.espacoTopoCm,
                            provaInteira: configuracao.provaInteira,
                            serieNome: serieNome,
                            tituloArquivo: 'Prova reserva · ' + subtitulo,
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

            estadoTexto.textContent = 'guardando nos arquivos recentes…';
            const guardou = await guardarNoHistorico(estado.resultados);
            estadoTexto.textContent = 'pronto: ' + tarefas.length + (tarefas.length === 1 ? ' arquivo gerado.' : ' conjuntos gerados.') +
                (guardou ? '' : ' (Não consegui guardar nos arquivos recentes: baixe agora.)');
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

    /* Serve às duas abas: recebe a lista de pacotes que acabou de ser gerada. */
    function barraDeTudo(pacotes) {
        const lista = pacotes || estado.resultados;
        const caixa = criar('div', 'acoes-lista');
        const botao = criar('button', 'btn btn--primary', 'Baixar tudo, um arquivo atrás do outro');
        botao.type = 'button';
        botao.addEventListener('click', async function () {
            for (const pacote of lista) {
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

    /* ===================== arquivos recentes ===================== */

    async function guardarNoHistorico(pacotes) {
        if (!Historico) return false;
        try {
            for (const pacote of pacotes) await Historico.guardar(pacote.arquivos, pacote.titulo);
            return true;
        } catch (erro) {
            return false;
        }
    }

    function tamanhoLegivel(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
        return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    const formatoData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    async function mostrarRecentes() {
        const alvo = $('lista-recentes');
        const contagem = $('contagem-recentes');
        const apagarTodos = $('apagar-recentes');
        let itens;
        try {
            itens = await Historico.listar();
        } catch (erro) {
            limpar(alvo);
            contagem.textContent = 'Este navegador não deixou guardar arquivos (janela anônima ou armazenamento bloqueado).';
            apagarTodos.hidden = true;
            return;
        }
        limpar(alvo);
        apagarTodos.hidden = !itens.length;
        contagem.textContent = itens.length
            ? itens.length + ' de ' + Historico.LIMITE + ' arquivos guardados.'
            : 'Nenhum arquivo guardado ainda. Os próximos que você gerar aparecem aqui.';

        itens.forEach(function (item) {
            const cartao = criar('div', 'resultado');
            const titulo = criar('div', 'resultado-titulo', item.rotulo);
            titulo.appendChild(criar('small', null, item.titulo));
            titulo.appendChild(criar('small', null, item.nome + ' · ' + tamanhoLegivel(item.tamanho)));
            cartao.appendChild(titulo);
            cartao.appendChild(criar('span', 'resultado-quando', formatoData.format(new Date(item.criadoEm))));

            const baixar = criar('button', 'btn btn--pequeno', 'Baixar');
            baixar.type = 'button';
            baixar.addEventListener('click', async function () {
                const completo = await Historico.obter(item.id);
                if (completo) Saida.baixar(completo.nome, completo.bytes, completo.tipo);
                else mostrarRecentes();
            });
            cartao.appendChild(baixar);

            const apagar = criar('button', 'btn btn--pequeno btn--apagar', 'Apagar');
            apagar.type = 'button';
            apagar.addEventListener('click', async function () {
                await Historico.apagar(item.id);
                mostrarRecentes();
            });
            cartao.appendChild(apagar);
            alvo.appendChild(cartao);
        });
    }

    $('apagar-recentes').addEventListener('click', async function () {
        if (!confirm('Apagar todos os arquivos recentes deste navegador? Não dá para desfazer.')) return;
        await Historico.apagarTudo();
        mostrarRecentes();
    });

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

    $('gerar-gabaritos').addEventListener('click', gerarGabaritos);

    /* ===================== partida ===================== */

    aoTrocarModelo();
    montarSlots();
    montarSlotsDeGabarito();
    atualizarListaDePrevia();
    atualizarListaDePreviaGabarito();
})();
