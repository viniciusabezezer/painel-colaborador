/* A folha de respostas da primeira página, no desenho da prova bimestral da
   escola: o "Núm. da lista" com dois dígitos para marcar, o rótulo da série e
   da área, as questões em blocos de cinco com o "A B C D E" em cima e as
   marcas quadradas de alinhamento em quatro fileiras verticais, de cinco em
   cinco linhas.

   Sai como SVG em milímetros, para imprimir no tamanho certo em qualquer
   impressora. A grade é sempre a mesma (três colunas de 31 linhas): só muda
   quantas linhas têm bolhas. Assim as marcas ficam sempre no mesmo lugar,
   seja a prova de 20 ou de 60 questões. */
(function (global) {
    'use strict';

    const PASSO = 3.45;          /* altura de uma linha */
    const LINHAS = 31;           /* linhas por coluna */
    const MARCA = 2.6;           /* lado da marca quadrada */
    const LARGURA_COLUNA = 28;   /* de uma fileira de marcas à seguinte */
    const COLUNAS = 3;
    const RAIO = 1.4;
    const ENTRE_BOLHAS = 3.6;
    const TOPO = 1;
    const LETRAS = 'ABCDE';

    const LARGURA = COLUNAS * LARGURA_COLUNA + MARCA;
    const ALTURA = TOPO * 2 + LINHAS * PASSO;

    /* As primeiras linhas da coluna 1 são do número da lista e do rótulo. */
    const PRIMEIRA_LINHA_QUESTOES = 14;

    function y(linha) { return TOPO + linha * PASSO + PASSO / 2; }
    function xColuna(coluna) { return coluna * LARGURA_COLUNA + MARCA + 1.2; }
    function xBolha(coluna, k) { return xColuna(coluna) + 7.2 + k * ENTRE_BOLHAS; }

    /* Onde cada questão cai na grade. Um cabeçalho "A B C D E" abre cada
       coluna e cada bloco de cinco (1, 6, 11…); um cabeçalho nunca fica
       sozinho no pé da coluna. */
    function distribuir(total) {
        const questoes = [];
        const cabecalhos = [];
        let coluna = 0;
        let linha = PRIMEIRA_LINHA_QUESTOES;
        let inicioColuna = true;
        let desdeCabecalho = 0;
        let cabeu = true;

        function proximaColuna() {
            coluna++;
            linha = 0;
            inicioColuna = true;
            if (coluna >= COLUNAS) cabeu = false;
        }

        for (let n = 1; n <= total && cabeu; n++) {
            /* o cabeçalho do topo da coluna já serve ao bloco que começa logo
               abaixo dele (na prova da escola: 15 a 20 sob um cabeçalho só) */
            const abreBloco = inicioColuna || ((n - 1) % 5 === 0 && desdeCabecalho >= 3);
            if (abreBloco && linha + 2 > LINHAS) proximaColuna();
            else if (!abreBloco && linha + 1 > LINHAS) proximaColuna();
            if (!cabeu) break;
            if (abreBloco || inicioColuna) {
                cabecalhos.push({ coluna: coluna, linha: linha });
                linha++;
                desdeCabecalho = 0;
            }
            desdeCabecalho++;
            questoes.push({ numero: n, coluna: coluna, linha: linha });
            linha++;
            inicioColuna = false;
        }
        return { questoes: questoes, cabecalhos: cabecalhos, cabeu: cabeu && questoes.length === total };
    }

    /* Quantas questões a grade comporta. */
    function capacidade() {
        let n = 1;
        while (distribuir(n + 1).cabeu) n++;
        return n;
    }

    function f(numero) { return Math.round(numero * 100) / 100; }

    function texto(x, yy, conteudo, tamanho, ancora, extra) {
        return '<text x="' + f(x) + '" y="' + f(yy + tamanho * 0.35) + '" font-size="' + tamanho + '"' +
            (ancora ? ' text-anchor="' + ancora + '"' : '') + (extra || '') + '>' + conteudo + '</text>';
    }

    function bolha(x, yy) {
        return '<circle cx="' + f(x) + '" cy="' + f(yy) + '" r="' + RAIO + '"/>';
    }

    function escapar(t) {
        return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }

    /* opcoes: total, alternativas (2 a 5), rotulo (até 2 linhas),
       discursivas (números das questões sem bolhas). */
    function svg(opcoes) {
        const total = Math.max(0, opcoes.total | 0);
        const alternativas = Math.max(2, Math.min(5, opcoes.alternativas || 5));
        const rotulo = (opcoes.rotulo || []).slice(0, 2);
        const discursivas = opcoes.discursivas || [];
        const grade = distribuir(total);
        const partes = [];

        /* marcas de alinhamento */
        for (let fileira = 0; fileira <= COLUNAS; fileira++) {
            for (let linha = 0; linha < LINHAS; linha += 5) {
                partes.push('<rect class="marca" x="' + f(fileira * LARGURA_COLUNA) + '" y="' + f(y(linha) - MARCA / 2) +
                    '" width="' + MARCA + '" height="' + MARCA + '"/>');
            }
        }

        /* número da lista */
        const meioLista = (xBolha(0, 0) + xBolha(0, 1)) / 2;
        partes.push(texto(meioLista, y(0), 'Núm. da lista', 1.9, 'middle'));
        [0, 1].forEach(function (k) {
            partes.push('<rect class="caixa" x="' + f(xBolha(0, k) - 1.75) + '" y="' + f(y(1) - 1.6) + '" width="3.5" height="3.2"/>');
        });
        for (let d = 0; d <= 9; d++) {
            partes.push(texto(xColuna(0) + 4.6, y(d + 2), String(d), 2.1, 'end'));
            partes.push(bolha(xBolha(0, 0), y(d + 2)));
            partes.push(bolha(xBolha(0, 1), y(d + 2)));
        }
        rotulo.forEach(function (linhaRotulo, i) {
            partes.push(texto(meioLista + 3, y(12 + i), escapar(linhaRotulo), 1.9, 'middle'));
        });

        grade.cabecalhos.forEach(function (c) {
            for (let k = 0; k < alternativas; k++) {
                partes.push(texto(xBolha(c.coluna, k), y(c.linha), LETRAS[k], 1.8, 'middle'));
            }
        });

        grade.questoes.forEach(function (q) {
            partes.push(texto(xColuna(q.coluna) + 4.6, y(q.linha), String(q.numero), 2.1, 'end'));
            if (discursivas.indexOf(q.numero) !== -1) {
                partes.push(texto((xBolha(q.coluna, 0) + xBolha(q.coluna, alternativas - 1)) / 2, y(q.linha), 'discursiva', 1.8, 'middle', ' class="nota"'));
                return;
            }
            for (let k = 0; k < alternativas; k++) partes.push(bolha(xBolha(q.coluna, k), y(q.linha)));
        });

        return '<svg class="gabarito-svg" xmlns="http://www.w3.org/2000/svg" width="' + f(LARGURA) + 'mm" height="' + f(ALTURA) +
            'mm" viewBox="0 0 ' + f(LARGURA) + ' ' + f(ALTURA) + '" font-family="Arial, Helvetica, sans-serif">' +
            '<style>.marca{fill:#000}.caixa,circle{fill:none;stroke:#000;stroke-width:.22}text{fill:#000}.nota{fill:#555;font-style:italic}</style>' +
            partes.join('') + '</svg>';
    }

    const api = {
        svg: svg,
        distribuir: distribuir,
        capacidade: capacidade,
        LARGURA_MM: LARGURA,
        ALTURA_MM: ALTURA
    };

    global.MontarGabarito = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
