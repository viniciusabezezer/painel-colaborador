/* A folha de respostas da primeira página, no desenho da prova bimestral da
   escola: o rótulo da série e da área, as questões em blocos de cinco com o
   "A B C D E" em cima e as marcas quadradas de alinhamento em quatro fileiras
   verticais, de cinco em cinco linhas. Não há mais "Núm. da lista" para o
   aluno marcar: quem é o aluno vem do QR da folha e qual é a prova vem da
   chave dentro dele.

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

    /* As duas primeiras linhas da coluna 1 são do rótulo (série e área). */
    const PRIMEIRA_LINHA_QUESTOES = 2;

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
    function f3(numero) { return Math.round(numero * 1000) / 1000; }

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

    /* O bloco do código fica abaixo da grade. As 28 marcas de alinhamento
       não se movem: o SVG só cresce para baixo quando a prova pede o código. */
    function geometriaCodigo() {
        const y0 = ALTURA + 2.8;
        const tituloY = y0 + 1.7;
        const cabY = y0 + 6.2;
        const yPrimeira = y0 + 8.8;
        const letras = 'ACEFPRTV';
        const digitos = '3456789';
        const bolhasLetras = [];
        const bolhasDigitos = [];
        for (let i = 0; i < letras.length; i++) {
            const yy = yPrimeira + i * PASSO;
            for (let col = 0; col < 3; col++) {
                bolhasLetras.push({ posicao: col + 1, valor: letras[i], cx: f3(11.2 + col * ENTRE_BOLHAS), cy: f3(yy) });
            }
        }
        for (let i = 0; i < digitos.length; i++) {
            const yy = yPrimeira + i * PASSO;
            for (let col = 0; col < 3; col++) {
                bolhasDigitos.push({ posicao: col + 4, valor: digitos[i], cx: f3(53.2 + col * ENTRE_BOLHAS), cy: f3(yy) });
            }
        }
        const yUltima = yPrimeira + (letras.length - 1) * PASSO;
        return {
            letras_ok: letras,
            digitos_ok: digitos,
            raio: RAIO,
            marca: MARCA,
            passo: PASSO,
            entre_bolhas: ENTRE_BOLHAS,
            largura: LARGURA,
            altura_grade: ALTURA,
            altura_svg: f3(yUltima + PASSO / 2 + 1.4),
            y0_codigo: f3(y0),
            titulo_y: f3(tituloY),
            cab_y: f3(cabY),
            x_lab_l: 6.2,
            x_lab_d: 48,
            x_b1: 11.2,
            x_b4: 53.2,
            y_primeira: f(yPrimeira),
            marcas_codigo: [
                { cx: f3(MARCA / 2), cy: f3(cabY) },
                { cx: f3(LARGURA - MARCA / 2), cy: f3(cabY) },
                { cx: f3(MARCA / 2), cy: f3(yUltima) },
                { cx: f3(LARGURA - MARCA / 2), cy: f3(yUltima) }
            ],
            bolhas_letras: bolhasLetras,
            bolhas_digitos: bolhasDigitos
        };
    }

    function blocoCodigoSvg() {
        const g = geometriaCodigo();
        const partes = [];
        partes.push(texto(g.x_lab_l - 1.2, g.titulo_y, 'Código de verificação', 2.2, 'start'));
        ['1º', '2º', '3º'].forEach(function (rot, i) {
            partes.push(texto(g.x_b1 + i * ENTRE_BOLHAS, g.cab_y, rot, 1.7, 'middle'));
        });
        partes.push(texto((g.x_b1 + g.x_b1 + 2 * ENTRE_BOLHAS) / 2, g.cab_y - 2.15, 'letras', 1.5, 'middle'));
        ['4º', '5º', '6º'].forEach(function (rot, i) {
            partes.push(texto(g.x_b4 + i * ENTRE_BOLHAS, g.cab_y, rot, 1.7, 'middle'));
        });
        partes.push(texto((g.x_b4 + g.x_b4 + 2 * ENTRE_BOLHAS) / 2, g.cab_y - 2.15, 'somas', 1.5, 'middle'));
        g.letras_ok.split('').forEach(function (ch, i) {
            partes.push(texto(g.x_lab_l, g.y_primeira + i * PASSO, ch, 2.1, 'end'));
        });
        g.digitos_ok.split('').forEach(function (ch, i) {
            partes.push(texto(g.x_lab_d, g.y_primeira + i * PASSO, ch, 2.1, 'end'));
        });
        g.bolhas_letras.concat(g.bolhas_digitos).forEach(function (b) {
            partes.push('<circle class="bolha-codigo" cx="' + f(b.cx) + '" cy="' + f(b.cy) + '" r="' + RAIO +
                '" data-pos="' + b.posicao + '" data-val="' + b.valor + '"/>');
        });
        g.marcas_codigo.forEach(function (m) {
            partes.push('<rect class="marca marca-codigo" x="' + f(m.cx - MARCA / 2) + '" y="' + f(m.cy - MARCA / 2) +
                '" width="' + MARCA + '" height="' + MARCA + '"/>');
        });
        return partes.join('');
    }

    /* Posições em mm de marcas e bolhas, para o Malu Gabaritos ler o mesmo
       cartão que esta folha desenha. O número de questões muda as bolhas
       A–E; as marcas da grade e o bloco do código ficam fixos. */
    function geometria(opcoes) {
        opcoes = opcoes || {};
        const total = Math.max(0, opcoes.total | 0);
        const alternativas = Math.max(2, Math.min(5, opcoes.alternativas || 5));
        const discursivas = opcoes.discursivas || [];
        const grade = distribuir(total);
        const codigo = geometriaCodigo();
        const marcas = [];
        for (let fileira = 0; fileira <= COLUNAS; fileira++) {
            for (let linha = 0; linha < LINHAS; linha += 5) {
                marcas.push({ cx: f3(fileira * LARGURA_COLUNA + MARCA / 2), cy: f3(y(linha)), linha: linha, fileira: fileira });
            }
        }
        const questoes = [];
        grade.questoes.forEach(function (q) {
            if (discursivas.indexOf(q.numero) !== -1) return;
            for (let k = 0; k < alternativas; k++) {
                questoes.push({ questao: q.numero, valor: LETRAS[k], cx: f3(xBolha(q.coluna, k)), cy: f3(y(q.linha)) });
            }
        });
        return Object.assign({}, codigo, {
            marcas_grade: marcas,
            bolhas_questoes: questoes,
            alternativas: LETRAS.slice(0, alternativas),
            n_questoes: grade.questoes.length
        });
    }

    /* opcoes: total, alternativas (2 a 5), rotulo (até 2 linhas),
       discursivas (números das questões sem bolhas), codigo (bloco OMR). */
    function svg(opcoes) {
        const total = Math.max(0, opcoes.total | 0);
        const alternativas = Math.max(2, Math.min(5, opcoes.alternativas || 5));
        const rotulo = (opcoes.rotulo || []).slice(0, 2);
        const discursivas = opcoes.discursivas || [];
        const comCodigo = !!opcoes.codigo;
        const grade = distribuir(total);
        const partes = [];

        /* marcas de alinhamento */
        for (let fileira = 0; fileira <= COLUNAS; fileira++) {
            for (let linha = 0; linha < LINHAS; linha += 5) {
                partes.push('<rect class="marca" x="' + f(fileira * LARGURA_COLUNA) + '" y="' + f(y(linha) - MARCA / 2) +
                    '" width="' + MARCA + '" height="' + MARCA + '"/>');
            }
        }

        /* rótulo da série e da área, nas duas linhas acima da primeira questão */
        const meioRotulo = xBolha(0, 2);
        rotulo.forEach(function (linhaRotulo, i) {
            partes.push(texto(meioRotulo, y(i), escapar(linhaRotulo), 1.9, 'middle'));
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

        if (comCodigo) partes.push(blocoCodigoSvg());
        const altura = comCodigo ? geometriaCodigo().altura_svg : ALTURA;
        const alturaSvg = Math.round((altura + 1e-8) * 100) / 100;

        return '<svg class="gabarito-svg" xmlns="http://www.w3.org/2000/svg" width="' + f(LARGURA) + 'mm" height="' + f(alturaSvg) +
            'mm" viewBox="0 0 ' + f(LARGURA) + ' ' + f(alturaSvg) + '" font-family="Arial, Helvetica, sans-serif">' +
            '<style>.marca{fill:#000}.caixa,circle{fill:none;stroke:#000;stroke-width:.22}text{fill:#000}.nota{fill:#555;font-style:italic}</style>' +
            partes.join('') + '</svg>';
    }

    const api = {
        svg: svg,
        distribuir: distribuir,
        capacidade: capacidade,
        geometria: geometria,
        geometriaCodigo: geometriaCodigo,
        LARGURA_MM: LARGURA,
        ALTURA_MM: ALTURA
    };

    global.MontarGabarito = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
