/* A paginação: transforma a prova em folhas A4 de verdade, no navegador.

   A prova vira uma fila de blocos (título de seção, parágrafos do enunciado,
   imagem, alternativas, linhas de resposta), e os blocos entram um a um na
   coluna da vez. Quem decide se cabe é o próprio navegador: o bloco é posto na
   coluna e, se passou do fim, sai. Assim a medida é exata para a fonte, o
   corpo e a impressora que vão imprimir.

   Como na prova da escola, um parágrafo comprido pode começar no pé de uma
   coluna e continuar na seguinte (a quebra é por palavra, com pelo menos duas
   linhas de cada lado), e um título ou o começo de uma questão nunca fica
   sozinho no fim da coluna. */
(function (global) {
    'use strict';

    const Texto = global.MontarTexto;
    const Modelos = global.MontarModelos;
    const Gabarito = global.MontarGabarito;

    const PX_POR_PT = 96 / 72;
    const ALTURA_LINHA = 1.22;

    function el(tag, classe, html) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (html != null) e.innerHTML = html;
        return e;
    }

    /* ----- partes fixas da primeira página ----- */

    function topoFaixa(layout) {
        const faixa = el('div', 'faixa');
        faixa.style.height = layout.faixaCm + 'cm';
        faixa.appendChild(el('span', 'faixa-dica so-tela',
            'Faixa em branco para o <strong>Identificador de Provas</strong> — o nome do aluno, a turma, a data e o QR entram aqui depois. Não sai na impressão.'));
        return faixa;
    }

    function topoCompleto(prova, base) {
        const comp = Modelos.COMPONENTES[prova.componente];
        const subtitulo = [prova.titulo || '', bimestreTexto(prova)].filter(Boolean).join(' · ');
        const serieTurma = prova.serie ? prova.serie + 'ª série' + (prova.turma ? ' ' + String(prova.turma).toUpperCase() : '') : '';
        const disciplina = prova.disciplina || (comp ? comp.nome : '');
        const tabela = el('table', 'cab-completo');
        /* cinco colunas: logo | três campos | data e nota; o logo ocupa as duas primeiras linhas */
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

    function campo(rotulo, valor, colunas) {
        return '<td' + (colunas > 1 ? ' colspan="' + colunas + '"' : '') + '><span class="rot">' + rotulo + '</span> ' +
            (valor ? '<span class="val">' + Texto.escapar(valor) + '</span>' : '') + '</td>';
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

    /* ----- os blocos ----- */

    function rotuloGabarito(prova) {
        const comp = Modelos.COMPONENTES[prova.componente];
        return [prova.serie ? prova.serie + 'º Ano' : '', comp ? comp.sigla : (prova.disciplina || '')].filter(Boolean);
    }

    function blocos(prova, layout) {
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
                fila.push({ tipo: 'titulo', html: Texto.escapar(secao.titulo.trim().toUpperCase()), manter: true });
            }
            secao.questoes.forEach(function (q) {
                n++;
                const pars = Texto.paragrafos(q.enunciado);
                const numeroTexto = Modelos.numero(n, layout.numeracao);
                let prefixo = [];
                if (layout.numeracao === 'QUESTÃO 01') {
                    fila.push({ tipo: 'questao-titulo', html: numeroTexto, manter: true, questao: n });
                } else {
                    prefixo.push([{ t: numeroTexto, s: [] }]);
                }
                if (q.fonte && String(q.fonte).trim()) prefixo = prefixo.concat(Texto.palavras('(' + String(q.fonte).trim().replace(/^\(|\)$/g, '') + ')'));

                const resto = (q.imagem ? 1 : 0) + (q.tipo === 'objetiva' ? layout.alternativas : 1);
                if (!pars.length) pars.push('');
                pars.forEach(function (p, i) {
                    const palavras = (i === 0 ? prefixo : []).concat(Texto.palavras(p));
                    if (!palavras.length) return;
                    fila.push({
                        tipo: 'par',
                        classe: i === 0 ? 'q-par q-inicio' : 'q-par',
                        palavras: palavras,
                        manter: i === pars.length - 1 && resto > 0,
                        questao: n
                    });
                });
                if (q.imagem && q.imagem.src) {
                    fila.push({ tipo: 'img', imagem: q.imagem, questao: n });
                }
                if (q.tipo === 'objetiva') {
                    for (let i = 0; i < layout.alternativas; i++) {
                        fila.push({
                            tipo: 'par',
                            classe: 'q-alt' + (i === 0 ? ' q-alt-primeira' : ''),
                            palavras: [[{ t: Modelos.letra(i, layout.letras), s: [] }]].concat(Texto.palavras(q.alternativas[i] || '')),
                            questao: n
                        });
                    }
                } else {
                    const linhas = Math.max(0, Math.min(40, q.linhas | 0));
                    for (let i = 0; i < linhas; i++) fila.push({ tipo: 'linha', questao: n, primeira: i === 0 });
                }
            });
        });
        return fila;
    }

    function criarBloco(bloco, coluna) {
        if (bloco.tipo === 'gabarito') return el('div', 'bloco-gabarito', bloco.html);
        if (bloco.tipo === 'titulo') return el('div', 'secao-titulo', bloco.html);
        if (bloco.tipo === 'questao-titulo') return el('div', 'q-titulo', bloco.html);
        if (bloco.tipo === 'linha') return el('div', 'q-linha' + (bloco.primeira ? ' q-linha-primeira' : ''));
        if (bloco.tipo === 'img') {
            const fig = el('figure', 'q-img');
            const img = document.createElement('img');
            img.src = bloco.imagem.src;
            img.alt = '';
            const larguraCol = coluna.clientWidth;
            const pct = Math.max(20, Math.min(100, bloco.imagem.largura || 100)) / 100;
            let w = larguraCol * pct;
            const proporcao = (bloco.imagem.h || 1) / (bloco.imagem.w || 1);
            let h = w * proporcao;
            const maxH = coluna.clientHeight * 0.9;
            if (h > maxH) { h = maxH; w = h / proporcao; }
            img.style.width = w + 'px';
            img.style.height = h + 'px';
            fig.appendChild(img);
            return fig;
        }
        const p = el('p', bloco.classe, Texto.palavrasHtml(bloco.palavras));
        return p;
    }

    /* ----- as folhas ----- */

    function novaFolha(destino, layout, numero) {
        const folha = el('section', 'folha');
        folha.style.setProperty('--corpo', layout.corpoPt + 'pt');
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

    function transborda(coluna) {
        const ultimo = coluna.lastElementChild;
        if (!ultimo) return false;
        return ultimo.offsetTop + ultimo.offsetHeight > coluna.clientHeight + 0.5;
    }

    function sobra(coluna) {
        const ultimo = coluna.lastElementChild;
        if (!ultimo) return coluna.clientHeight;
        return coluna.clientHeight - (ultimo.offsetTop + ultimo.offsetHeight);
    }

    /* Põe no elemento o máximo de palavras que cabe na coluna. Devolve o
       elemento com o resto, ou null se não valeu a pena partir. */
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
        const altura = elemento.offsetHeight;
        /* pelo menos duas linhas de cada lado */
        if (altura < linhaPx * 1.8 || palavras.length - melhor < 4) return null;
        elemento.classList.add('partido');
        const restoBloco = Object.assign({}, bloco, {
            palavras: palavras.slice(melhor),
            classe: bloco.classe.replace('q-inicio', '').replace('q-alt-primeira', '') + ' continua'
        });
        return restoBloco;
    }

    /* Monta as folhas dentro de `destino` (que precisa estar no documento,
       em tamanho real; uma escala por transform no pai não atrapalha). */
    function montar(prova, destino, opcoes) {
        opcoes = opcoes || {};
        const base = opcoes.base || '';
        const layout = Modelos.layoutDaProva(prova);
        const avisos = [];
        destino.innerHTML = '';
        destino.classList.add('paginas');

        const linhaPx = layout.corpoPt * PX_POR_PT * ALTURA_LINHA;
        const fila = blocos(prova, layout);

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
                if (layout.cabecalho === 'faixa') topo.appendChild(topoFaixa(layout));
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
                    avisos.push((bloco.questao ? 'Questão ' + bloco.questao : 'Um bloco') + ' tem um trecho maior que uma coluna inteira e foi cortado. Divida o texto em parágrafos ou reduza a imagem.');
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

        return { paginas: folhas.length, avisos: avisos };
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

    const api = { montar: montar, montarChave: montarChave, blocos: blocos };
    global.MontarPaginar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
