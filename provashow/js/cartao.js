/* Os cartões do ProvaShow Malu.

   Cada cartão é um quadrado 7×7: uma moldura preta de uma casa e, dentro,
   25 casas (5×5) que formam o código do cartão. O aluno responde girando o
   cartão: a letra que fica em cima é a resposta. O código foi escolhido para
   que as quatro posições de cada cartão — e as de todos os 63 cartões — difiram
   em pelo menos 6 casas; assim o leitor ainda acerta com até 2 casas mal lidas
   e nunca confunde um cartão com outro, nem uma letra com outra.

   O desenho é próprio do ProvaShow Malu (não é cópia de nenhum outro sistema):
   os códigos saem de uma busca gulosa determinística, refeita nos testes. */
(function (global) {
    'use strict';

    const LADO_DADOS = 5;      /* casas de código por lado */
    const LADO = 7;            /* com a moldura */
    const DISTANCIA_MINIMA = 6;
    const ERROS_ACEITOS = 2;
    const TOTAL = 63;

    /* bit (y*5 + x) = casa preta na linha y, coluna x, com o cartão em pé (A em cima) */
    const CODIGOS = [
        8869299, 13591466, 21797434, 3106246, 711903, 6688766, 31393843, 16282263, 22299670,
        3721168, 6367713, 19262581, 20648560, 28989827, 29165415, 17614753, 26504452, 17179371,
        19312248, 32835012, 29057232, 30049731, 13828760, 13301860, 16470616, 33319133, 10724693,
        29817644, 15778861, 21019816, 3091498, 25310915, 16485975, 10442345, 10882255, 23681085,
        32539257, 4164258, 27338724, 13707033, 15805862, 30257593, 6076689, 16484486, 16622357,
        13087668, 21717234, 20499817, 15010342, 1796769, 5150661, 18950623, 17001903, 22813692,
        30619744, 11473349, 6974297, 26557128, 16055577, 20271178, 27564252, 3591701, 30569909
    ];

    /* Qual lado fica em cima quando o desenho aparece girado k vezes 90° no sentido horário. */
    const LETRA_POR_GIRO = ['A', 'D', 'C', 'B'];
    const LETRAS = ['A', 'B', 'C', 'D'];

    function girar(codigo) {
        /* 90° no sentido horário: (x, y) -> (4 - y, x) */
        let r = 0;
        for (let y = 0; y < LADO_DADOS; y++) {
            for (let x = 0; x < LADO_DADOS; x++) {
                if ((codigo >> (y * LADO_DADOS + x)) & 1) r |= 1 << (x * LADO_DADOS + (LADO_DADOS - 1 - y));
            }
        }
        return r;
    }

    function contarBits(v) {
        let n = 0;
        while (v) { v &= v - 1; n++; }
        return n;
    }

    /* Todas as posições de todos os cartões, para a leitura. */
    const POSICOES = [];
    CODIGOS.forEach((codigo, i) => {
        let c = codigo;
        for (let k = 0; k < 4; k++) {
            POSICOES.push({ codigo: c, cartao: i + 1, giro: k });
            c = girar(c);
        }
    });

    /* Recebe os 25 bits lidos (na orientação da imagem) e devolve o cartão e o
       giro, ou null. `erros` diz quantas casas não bateram. */
    function identificar(bits) {
        let melhor = null;
        for (const p of POSICOES) {
            const d = contarBits(p.codigo ^ bits);
            if (d <= ERROS_ACEITOS && (!melhor || d < melhor.erros)) {
                melhor = { cartao: p.cartao, giro: p.giro, erros: d };
                if (d === 0) break;
            }
        }
        return melhor;
    }

    /* Grade 7×7 (true = preta) do cartão em pé. */
    function grade(numero) {
        const codigo = CODIGOS[numero - 1];
        const g = [];
        for (let y = 0; y < LADO; y++) {
            const linha = [];
            for (let x = 0; x < LADO; x++) {
                const moldura = x === 0 || y === 0 || x === LADO - 1 || y === LADO - 1;
                linha.push(moldura || !!((codigo >> ((y - 1) * LADO_DADOS + (x - 1))) & 1));
            }
            g.push(linha);
        }
        return g;
    }

    function escapar(t) {
        return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    /* O cartão para imprimir, em SVG. Unidade = uma casa; a folga branca em
       volta (1,6 casa) é o que separa o cartão da mão e da roupa do aluno. */
    function svg(numero, opcoes) {
        const o = Object.assign({ nome: '', tamanho: '100%' }, opcoes);
        const folga = 1.6;
        const total = LADO + folga * 2;
        const g = grade(numero);
        let casas = '';
        for (let y = 0; y < LADO; y++) {
            for (let x = 0; x < LADO; x++) {
                if (g[y][x]) casas += `<rect x="${x + folga}" y="${y + folga}" width="1.02" height="1.02"/>`;
            }
        }
        const m = total / 2;
        const letra = (l, x, y, giro) =>
            `<text x="${x}" y="${y}" transform="rotate(${giro} ${x} ${y})" text-anchor="middle" dominant-baseline="central" font-size="0.62" font-weight="700" fill="#555">${l}</text>`;
        const rotulo = `${numero}${o.nome ? ' · ' + o.nome : ''}`;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${o.tamanho}" class="cartao-svg" role="img" aria-label="Cartão ${numero}">` +
            `<rect width="${total}" height="${total}" fill="#fff"/>` +
            `<g fill="#000">${casas}</g>` +
            letra('A', m, folga / 2, 0) +
            letra('B', total - folga / 2, m, 90) +
            letra('C', m, total - folga / 2, 180) +
            letra('D', folga / 2, m, -90) +
            `<text x="0.35" y="${folga * 0.5}" font-size="0.4" fill="#888" dominant-baseline="central">${escapar(rotulo.slice(0, 16))}</text>` +
            `</svg>`;
    }

    const Cartao = {
        LADO, LADO_DADOS, TOTAL, DISTANCIA_MINIMA, ERROS_ACEITOS, CODIGOS, LETRAS, LETRA_POR_GIRO,
        girar, contarBits, identificar, grade, svg
    };

    if (typeof module === 'object' && module.exports) module.exports = Cartao;
    else global.Cartao = Cartao;
})(typeof self !== 'undefined' ? self : this);
