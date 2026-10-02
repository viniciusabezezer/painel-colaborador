/* A paginação: transforma a prova em folhas A4 de verdade, no navegador.

   A prova vira uma fila de blocos (título de seção, parágrafos do enunciado,
   imagens, alternativas, linhas de resposta), e os blocos entram um a um na
   coluna da vez. Quem decide se cabe é o próprio navegador: o bloco é posto na
   coluna e, se passou do fim, sai. Assim a medida é exata para a fonte, o
   corpo e a impressora que vão imprimir.

   Como na prova da escola, um parágrafo comprido pode começar no pé de uma
   coluna e continuar na seguinte (a quebra é por palavra, com pelo menos duas
   linhas de cada lado), e um título ou o começo de uma questão nunca fica
   sozinho no fim da coluna.

   Economia de papel: as alternativas curtas vão para duas colunas ou para uma
   linha só sempre que cabem (disposição "automática"), e nada de espaço
   sobrando entre as questões além do que a leitura pede. */
(function (global) {
    'use strict';

    const Texto = global.MontarTexto;
    const Modelos = global.MontarModelos;
    const Gabarito = global.MontarGabarito;
    const Icones = global.MontarIcones;

    const PX_POR_PT = 96 / 72;
    const PX_POR_CM = 96 / 2.54;
    const ESPACOS = {
        compacto: { entre: 0.55, lh: 1.13 },
        normal: { entre: 0.85, lh: 1.2 },
        amplo: { entre: 1.3, lh: 1.32 }
    };
    const VAO_ALT_CM = 0.35; /* espaço entre alternativas lado a lado */

    function el(tag, classe, html) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (html != null) e.innerHTML = html;
        return e;
    }

    /* ----- partes fixas da primeira página ----- */

    /* A faixa sai em branco no papel: o Identificador cola ali o cabeçalho
       dele, com o brasão da escola. Na tela, uma simulação desse cabeçalho
       mostra ao professor como a prova vai ficar. */
    function topoFaixa(prova, layout, base) {
        const faixa = el('div', 'faixa');
        faixa.style.height = layout.faixaCm + 'cm';
        const serie = prova.serie ? prova.serie + 'ª SÉRIE' : 'SÉRIE';
        faixa.innerHTML =
            '<div class="faixa-simulada so-tela" aria-hidden="true">' +
            '<img class="faixa-brasao" src="' + base + 'logo.png" alt="">' +
            '<div class="faixa-textos">' +
            '<div class="faixa-aval">' + Texto.escapar((prova.titulo || 'Nome da avaliação').toUpperCase()) + '</div>' +
            '<div class="faixa-nome">NOME DO ALUNO</div>' +
            '<div class="faixa-linha">' + serie + ' · TURMA __ · Nº __ <span>DATA: ___/___/_____</span></div>' +
            '</div><div class="faixa-qr"></div></div>' +
            '<span class="faixa-dica so-tela">Simulação — o <strong>Identificador de Provas</strong> cola aqui o brasão, o nome, a turma e o QR. Na impressão desta prova, a faixa sai em branco.</span>';
        return faixa;
    }

    function campo(rotulo, valor, colunas) {
        return '<td' + (colunas > 1 ? ' colspan="' + colunas + '"' : '') + '><span class="rot">' + rotulo + '</span> ' +
            (valor ? '<span class="val">' + Texto.escapar(valor) + '</span>' : '') + '</td>';
    }

    function topoCompleto(prova, base) {
        const comp = Modelos.COMPONENTES[prova.componente];
        const subtitulo = [prova.titulo || '', bimestreTexto(prova)].filter(Boolean).join(' · ');
        const serieTurma = prova.serie ? prova.serie + 'ª série' + (prova.turma ? ' ' + String(prova.turma).toUpperCase() : '') : '';
        const disciplina = prova.disciplina || (comp ? comp.nome : '');
        const tabela = el('table', 'cab-completo');
        /* cinco colunas: brasão | três campos | data e nota; o brasão ocupa as duas primeiras linhas */
        tabela.innerHTML =
            '<colgroup><col class="c-logo"><col><col><col><col class="c-fim"></colgroup>' +
            '<tr><td class="cab-logo" rowspan="2"><img src="' + base + 'logo.png" alt=""></td>' +
            '<td class="cab-escola" colspan="4">' + Modelos.ESCOLA + '</td></tr>' +
            '<tr><td class="cab-titulo" colspan="4">' + Texto.escapar(subtitulo.toUpperCase()) + '</td></tr>' +
            '<tr>' + campo('Aluno(a):', '', 4) + campo('Nº:', '', 1) + '</tr>' +
            '<tr>' + campo('Professor(a):', prova.professor, 2) + campo('Disciplina:', disciplina, 1) +
            campo('Série/Turma:', serieTurma, 1) + campo('Data:', prova.data ? dataBr(prova.data) : '____/____/______', 1) + '</tr>' +
            '<tr>' + campo('Valor:', prova.valor, 4) + campo('Nota:', '', 1) + '</tr>';
        return tabela;
    }

    function dataBr(iso) {
        const p = String(iso).split('-');
        return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
    }

    function bimestreTexto(prova) {
        const n = String(prova.bimestre || '').replace(/\D/g, '');
        return n ? n + 'º bimestre ' + (prova.ano || '') : '';
    }

    function quadroInstrucoes(layout) {
        const caixa = el('div', 'instrucoes');
        caixa.appendChild(el('div', 'instrucoes-titulo', 'Instruções:'));
        const lista = el('ul');
        layout.textoInstrucoes.filter(function (l) { return String(l).trim(); }).forEach(function (linha) {
            lista.appendChild(el('li', null, Texto.html(linha)));
        });
        caixa.appendChild(lista);
        return caixa;
    }

    /* ----- imagens e alternativas ----- */

    function tamanho(img, larguraMax, alturaMax) {
        const proporcao = (img.h || 1) / (img.w || 1);
        let w = larguraMax * Math.max(15, Math.min(100, img.largura || 100)) / 100;
        let h = w * proporcao;
        if (h > alturaMax) { h = alturaMax; w = h / proporcao; }
        return { w: Math.max(4, w), h: Math.max(4, h) };
    }

    function imgHtml(img, t, classe) {
        return '<img class="q-foto ' + (classe || '') + '" src="' + img.src + '" alt="" style="width:' + t.w.toFixed(1) + 'px;height:' + t.h.toFixed(1) + 'px">';
    }

    function altConteudo(q, i, layout) {
        return '<span class="alt-rotulo">' + Texto.escapar(Modelos.letra(i, layout.letras)) + '</span> ' +
            Texto.palavrasHtml(Texto.palavras(q.alternativas[i] || ''));
    }

    /* A disposição mais compacta em que todas as alternativas cabem sem
       quebrar linha: todas numa linha, duas por linha ou uma por linha. */
    function medirDisposicao(q, layout, coluna) {
        const largura = coluna.clientWidth;
        const vao = VAO_ALT_CM * PX_POR_CM;
        const sonda = el('div', 'alt-sonda');
        coluna.appendChild(sonda);
        let maior = 0;
        for (let i = 0; i < layout.alternativas; i++) {
            sonda.innerHTML = altConteudo(q, i, layout);
            let w = sonda.offsetWidth;
            const img = (q.altImagens || [])[i];
            if (img) w = Math.max(w, tamanho(img, largura, 1e9).w);
            maior = Math.max(maior, w);
        }
        coluna.removeChild(sonda);
        const n = layout.alternativas;
        if (maior <= (largura - vao * (n - 1)) / n) return 'linha';
        if (maior <= (largura - vao) / 2) return 'duas';
        return 'lista';
    }

    /* ----- os blocos ----- */

    function rotuloGabarito(prova) {
        const comp = Modelos.COMPONENTES[prova.componente];
        return [prova.serie ? prova.serie + 'º Ano' : '', comp ? comp.sigla : (prova.disciplina || '')].filter(Boolean);
    }

    function blocos(prova, layout, disposicaoDe) {
        const fila = [];
        const numeradas = Modelos.questoesNumeradas(prova);

        if (layout.gabarito) {
            const discursivas = numeradas.filter(function (i) { return i.questao.tipo === 'discursiva'; }).map(function (i) { return i.numero; });
            fila.push({
                tipo: 'gabarito',
                html: '<div class="gabarito-titulo">GABARITO (NÃO RASURE)</div>' + Gabarito.svg({
                    total: numeradas.length,
                    alternativas: layout.alternativas,
                    rotulo: rotuloGabarito(prova),
                    discursivas: discursivas
                })
            });
        }

        let n = 0;
        prova.secoes.forEach(function (secao) {
            if (!secao.questoes.length) return;
            if (String(secao.titulo || '').trim()) {
                const icone = layout.icones ? Icones.resolver(secao.icone, secao.titulo) : null;
                fila.push({
                    tipo: 'titulo', manter: true,
                    html: (icone ? Icones.svg(icone) : '') + '<span>' + Texto.escapar(secao.titulo.trim().toUpperCase()) + '</span>'
                });
            }
            secao.questoes.forEach(function (q) {
                const texto = q.tipo === 'texto';
                if (!texto) n++;
                const doItem = [];
                const ref = texto ? null : n;
                const imagens = (q.imagens || []).filter(function (i) { return i && i.src; });
                const acima = imagens.filter(function (i) { return i.posicao === 'acima'; });
                const lado = imagens.filter(function (i) { return i.posicao === 'lado'; })[0] || null;
                const abaixo = imagens.filter(function (i) { return i !== lado && i.posicao !== 'acima'; });

                let prefixo = [];
                if (!texto) {
                    const numeroTexto = Modelos.numero(n, layout.numeracao);
                    if (layout.numeracao === 'QUESTÃO 01') doItem.push({ tipo: 'questao-titulo', html: numeroTexto, manter: true });
                    else prefixo.push([{ t: numeroTexto, s: [] }]);
                    if (q.fonte && String(q.fonte).trim()) prefixo = prefixo.concat(Texto.palavras('(' + String(q.fonte).trim().replace(/^\(|\)$/g, '') + ')'));
                }
                const classePar = texto ? 'q-par texto-apoio' : 'q-par';

                if (acima.length && prefixo.length) {
                    doItem.push({ tipo: 'par', classe: classePar, palavras: prefixo, manter: true });
                    prefixo = [];
                }
                acima.forEach(function (img) { doItem.push({ tipo: 'img', imagem: img, manter: true }); });

                const pars = Texto.paragrafos(q.enunciado);
                if (lado) {
                    doItem.push({ tipo: 'lado', imagem: lado, prefixo: prefixo, pars: pars, classe: classePar, manter: true });
                } else {
                    if (!pars.length && prefixo.length) pars.push('');
                    pars.forEach(function (p, i) {
                        const palavras = (i === 0 ? prefixo : []).concat(Texto.palavras(p));
                        if (!palavras.length) return;
                        doItem.push({ tipo: 'par', classe: classePar, palavras: palavras, manter: i === pars.length - 1 });
                    });
                }
                abaixo.forEach(function (img, i) { doItem.push({ tipo: 'img', imagem: img, manter: i === abaixo.length - 1 }); });

                if (q.tipo === 'objetiva') {
                    const disp = q.disposicao && q.disposicao !== 'auto' ? q.disposicao : disposicaoDe(q);
                    const total = layout.alternativas;
                    if (disp === 'lista') {
                        for (let i = 0; i < total; i++) {
                            const img = (q.altImagens || [])[i];
                            if (img) doItem.push({ tipo: 'alt-img', q: q, i: i, layout: layout, primeira: i === 0 });
                            else doItem.push({
                                tipo: 'par',
                                classe: 'q-alt' + (i === 0 ? ' q-alt-primeira' : ''),
                                palavras: [[{ t: Modelos.letra(i, layout.letras), s: [] }]].concat(Texto.palavras(q.alternativas[i] || ''))
                            });
                        }
                    } else {
                        const porLinha = disp === 'linha' ? total : 2;
                        for (let i = 0; i < total; i += porLinha) {
                            doItem.push({ tipo: 'alt-grade', q: q, de: i, ate: Math.min(total, i + porLinha), porLinha: porLinha, layout: layout, primeira: i === 0 });
                        }
                    }
                } else if (q.tipo === 'discursiva') {
                    const linhas = Math.max(0, Math.min(40, q.linhas | 0));
                    for (let i = 0; i < linhas; i++) doItem.push({ tipo: 'linha', primeira: i === 0 });
                }

                if (!doItem.length) return;
                doItem[0].inicio = true;
                /* o último bloco do item nunca segura o seguinte */
                doItem[doItem.length - 1].manter = false;
                doItem.forEach(function (b) { b.questao = ref; fila.push(b); });
            });
        });
        return fila;
    }

    function criarBloco(bloco, coluna) {
        const larguraCol = coluna.clientWidth;
        const alturaMax = coluna.clientHeight * 0.85;
        let e;
        if (bloco.tipo === 'gabarito') e = el('div', 'bloco-gabarito', bloco.html);
        else if (bloco.tipo === 'titulo') e = el('div', 'secao-titulo', bloco.html);
        else if (bloco.tipo === 'questao-titulo') e = el('div', 'q-titulo', bloco.html);
        else if (bloco.tipo === 'linha') e = el('div', 'q-linha' + (bloco.primeira ? ' q-linha-primeira' : ''));
        else if (bloco.tipo === 'img') {
            e = el('figure', 'q-img', imgHtml(bloco.imagem, tamanho(bloco.imagem, larguraCol, alturaMax)));
        } else if (bloco.tipo === 'lado') {
            const t = tamanho(Object.assign({}, bloco.imagem, { largura: Math.min(60, bloco.imagem.largura || 40) }), larguraCol, alturaMax);
            let html = imgHtml(bloco.imagem, t, 'q-foto-lado');
            const pars = bloco.pars.length ? bloco.pars : [''];
            html += pars.map(function (p, i) {
                return '<p class="' + bloco.classe + '">' + Texto.palavrasHtml((i === 0 ? bloco.prefixo : []).concat(Texto.palavras(p))) + '</p>';
            }).join('');
            e = el('div', 'q-lado', html);
        } else if (bloco.tipo === 'alt-img') {
            const img = bloco.q.altImagens[bloco.i];
            e = el('div', 'q-alt q-alt-com-img' + (bloco.primeira ? ' q-alt-primeira' : ''),
                altConteudo(bloco.q, bloco.i, bloco.layout) + '<br>' + imgHtml(img, tamanho(img, larguraCol, alturaMax / 2)));
        } else if (bloco.tipo === 'alt-grade') {
            const vao = VAO_ALT_CM * PX_POR_CM;
            const celula = (larguraCol - vao * (bloco.porLinha - 1)) / bloco.porLinha;
            let html = '';
            for (let i = bloco.de; i < bloco.ate; i++) {
                const img = (bloco.q.altImagens || [])[i];
                let foto = '';
                if (img) {
                    /* a largura da imagem conta em relação à coluna, limitada à célula */
                    const t = tamanho(img, larguraCol, alturaMax / 2);
                    if (t.w > celula) { t.h = t.h * celula / t.w; t.w = celula; }
                    foto = '<br>' + imgHtml(img, t);
                }
                html += '<div class="alt-celula">' + altConteudo(bloco.q, i, bloco.layout) + foto + '</div>';
            }
            e = el('div', 'alt-grade' + (bloco.primeira ? ' q-alt-primeira' : ''), html);
            e.style.gridTemplateColumns = 'repeat(' + bloco.porLinha + ', minmax(0, 1fr))';
            e.style.columnGap = VAO_ALT_CM + 'cm';
        } else {
            e = el('p', bloco.classe, Texto.palavrasHtml(bloco.palavras));
        }
        if (bloco.inicio) e.classList.add('item-inicio');
        return e;
    }

    /* ----- as folhas ----- */

    function estiloFolha(folha, layout) {
        const espaco = ESPACOS[layout.espacamento] || ESPACOS.normal;
        folha.style.setProperty('--corpo', layout.corpoPt + 'pt');
        folha.style.setProperty('--fonte', (Modelos.FONTES[layout.fonte] || Modelos.FONTES.times).css);
        folha.style.setProperty('--entre', espaco.entre + 'em');
        folha.style.setProperty('--lh', String(espaco.lh));
        folha.classList.toggle('tinta', !!layout.imagensCinza);
    }

    function novaFolha(destino, layout, numero) {
        const folha = el('section', 'folha');
        estiloFolha(folha, layout);
        const miolo = el('div', 'miolo');
        folha.appendChild(miolo);
        folha.appendChild(el('div', 'rodape'));
        folha.dataset.pagina = numero;
        destino.appendChild(folha);
        return { folha: folha, miolo: miolo };
    }

    function abrirColunas(miolo, layout) {
        const grade = el('div', 'colunas' + (layout.colunas === 2 ? ' duas' : '') + (layout.linhaColunas ? ' com-linha' : ''));
        const lista = [];
        for (let i = 0; i < layout.colunas; i++) {
            const c = el('div', 'coluna');
            grade.appendChild(c);
            lista.push(c);
        }
        miolo.appendChild(grade);
        return lista;
    }

    function fimDoConteudo(coluna) {
        const ultimo = coluna.lastElementChild;
        return ultimo ? ultimo.offsetTop + ultimo.offsetHeight : 0;
    }

    function transborda(coluna) {
        return fimDoConteudo(coluna) > coluna.clientHeight + 0.5;
    }

    function sobra(coluna) {
        return coluna.clientHeight - fimDoConteudo(coluna);
    }

    /* Põe no elemento o máximo de palavras que cabe na coluna. Devolve o
       bloco com o resto, ou null se não valeu a pena partir. */
    function partir(elemento, bloco, coluna, linhaPx) {
        const palavras = bloco.palavras;
        if (!palavras || palavras.length < 4) return null;
        let baixo = 1;
        let alto = palavras.length - 1;
        let melhor = 0;
        while (baixo <= alto) {
            const meio = (baixo + alto) >> 1;
            elemento.innerHTML = Texto.palavrasHtml(palavras, 0, meio);
            if (transborda(coluna)) alto = meio - 1;
            else { melhor = meio; baixo = meio + 1; }
        }
        if (!melhor) return null;
        elemento.innerHTML = Texto.palavrasHtml(palavras, 0, melhor);
        /* pelo menos duas linhas de cada lado */
        if (elemento.offsetHeight < linhaPx * 1.8 || palavras.length - melhor < 4) return null;
        elemento.classList.add('partido');
        return Object.assign({}, bloco, {
            palavras: palavras.slice(melhor),
            classe: bloco.classe.replace('q-alt-primeira', '') + ' continua',
            inicio: false
        });
    }

    /* Monta as folhas dentro de `destino` (que precisa estar no documento,
       em tamanho real; uma escala por transform no pai não atrapalha). */
    function montar(prova, destino, opcoes) {
        opcoes = opcoes || {};
        const base = opcoes.base || '';
        const layout = Object.assign(Modelos.layoutDaProva(prova), opcoes.ajustes || {});
        const avisos = [];
        destino.innerHTML = '';
        destino.classList.add('paginas');

        const espaco = ESPACOS[layout.espacamento] || ESPACOS.normal;
        const linhaPx = layout.corpoPt * PX_POR_PT * espaco.lh;

        if (layout.gabarito) {
            const total = Modelos.questoesNumeradas(prova).length;
            if (total > Gabarito.capacidade()) {
                avisos.push('A folha de respostas comporta ' + Gabarito.capacidade() + ' questões; esta prova tem ' + total + '.');
            }
        }

        const folhas = [];
        let colunas = [];
        let indice = 0;

        function abrirFolha() {
            const f = novaFolha(destino, layout, folhas.length + 1);
            folhas.push(f.folha);
            if (folhas.length === 1) {
                const topo = el('div', 'topo');
                if (layout.cabecalho === 'faixa') topo.appendChild(topoFaixa(prova, layout, base));
                else if (layout.cabecalho === 'completo') topo.appendChild(topoCompleto(prova, base));
                if (layout.instrucoes && layout.textoInstrucoes.some(function (l) { return String(l).trim(); })) {
                    topo.appendChild(quadroInstrucoes(layout));
                }
                if (topo.childNodes.length) f.miolo.appendChild(topo);
            }
            colunas = abrirColunas(f.miolo, layout);
            indice = 0;
        }

        function avancar() {
            indice++;
            if (indice >= colunas.length) abrirFolha();
        }

        abrirFolha();
        /* todas as colunas têm a mesma largura: a da primeira serve de régua */
        const regua = colunas[0];
        const disposicoes = {};
        const lay = Object.assign({}, layout);
        const fila = blocos(prova, lay, function (q) {
            return disposicoes[q.id] || (disposicoes[q.id] = medirDisposicao(q, lay, regua));
        });

        for (let i = 0; i < fila.length; i++) {
            let bloco = fila[i];
            for (let tentativas = 0; tentativas < 400; tentativas++) {
                const coluna = colunas[indice];
                const vazia = !coluna.firstElementChild;
                const elemento = criarBloco(bloco, coluna);
                coluna.appendChild(elemento);
                const reserva = bloco.manter ? linhaPx * 2.2 : 0;
                if (!transborda(coluna) && (vazia || sobra(coluna) >= reserva)) break;

                if (!transborda(coluna)) {
                    /* coube, mas ficaria sozinho no pé da coluna */
                    coluna.removeChild(elemento);
                    avancar();
                    continue;
                }
                if (bloco.palavras && sobra(coluna) + elemento.offsetHeight > linhaPx * 2) {
                    const resto = partir(elemento, bloco, coluna, linhaPx);
                    if (resto) { bloco = resto; avancar(); continue; }
                }
                if (vazia) {
                    /* maior que uma coluna inteira: fica, cortado, e avisa */
                    elemento.classList.add('grande-demais');
                    avisos.push((bloco.questao ? 'Questão ' + bloco.questao : 'Um texto de apoio') + ' tem um trecho maior que uma coluna inteira e foi cortado. Divida o texto em parágrafos ou reduza a imagem.');
                    break;
                }
                coluna.removeChild(elemento);
                avancar();
            }
        }

        /* uma folha a mais, vazia, aberta no fim, sai */
        while (folhas.length > 1) {
            const ultima = folhas[folhas.length - 1];
            if (ultima.querySelector('.coluna > *')) break;
            ultima.remove();
            folhas.pop();
        }

        if (layout.numeroPagina) {
            folhas.forEach(function (f, i) {
                f.querySelector('.rodape').textContent = (i + 1) + '/' + folhas.length;
            });
        }

        /* quanto da última folha foi usado (0 a 1): pouco = papel sobrando */
        const ultimasColunas = Array.from(folhas[folhas.length - 1].querySelectorAll('.coluna'));
        const ocupacao = ultimasColunas.reduce(function (soma, c) {
            return soma + Math.min(1, fimDoConteudo(c) / (c.clientHeight || 1));
        }, 0) / (ultimasColunas.length || 1);

        return { paginas: folhas.length, avisos: avisos, ocupacaoUltima: ocupacao, disposicoes: disposicoes };
    }

    /* A folha de correção do professor: a resposta certa de cada questão. */
    function montarChave(prova, destino) {
        const layout = Modelos.layoutDaProva(prova);
        destino.innerHTML = '';
        destino.classList.add('paginas');
        const f = novaFolha(destino, Object.assign({}, layout, { corpoPt: 11 }), 1);
        const numeradas = Modelos.questoesNumeradas(prova);
        const cab = el('div', 'chave-cab',
            '<strong>GABARITO DO PROFESSOR</strong> — não entregar ao aluno<br>' +
            Texto.escapar([prova.titulo, prova.serie ? prova.serie + 'ª série' : '', bimestreTexto(prova)].filter(Boolean).join(' · ')));
        f.miolo.appendChild(cab);
        const grade = el('div', 'chave-grade');
        numeradas.forEach(function (item) {
            const q = item.questao;
            const resposta = q.tipo === 'discursiva' ? 'discursiva' : (q.correta || '—');
            grade.appendChild(el('div', 'chave-item',
                '<span class="chave-n">' + Modelos.numero(item.numero, '01.').replace('.', '') + '</span>' +
                '<span class="chave-r' + (q.correta || q.tipo === 'discursiva' ? '' : ' falta') + '">' + resposta + '</span>' +
                (item.secao.titulo ? '<span class="chave-s">' + Texto.escapar(item.secao.titulo) + '</span>' : '')));
        });
        f.miolo.appendChild(grade);
        return { paginas: 1 };
    }

    const api = { montar: montar, montarChave: montarChave, blocos: blocos, ESPACOS: ESPACOS };
    global.MontarPaginar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
