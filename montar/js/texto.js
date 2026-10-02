/* O texto das questões: uma marcação mínima, que o professor digita sem
   botão nenhum, e a divisão em palavras que a paginação usa para quebrar um
   parágrafo entre duas colunas, como na prova impressa da escola.

     **negrito**   *itálico*   H~2~O (índice)   x^2^ (expoente)

   Cada linha do campo é um parágrafo. Um marcador só vale quando tem par na
   mesma linha; sozinho, sai como foi digitado (um "~5 cm" continua "~5 cm").
   Para um asterisco de verdade: \*. */
(function (global) {
    'use strict';

    const MARCAS = [
        { abre: '**', estilo: 'b' },
        { abre: '*', estilo: 'i' },
        { abre: '~', estilo: 'sub' },
        { abre: '^', estilo: 'sup' }
    ];
    const ESCAPE = '\u0000';

    function escapar(texto) {
        return String(texto).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* Acha a marca que abre mais cedo e que tem par adiante. */
    function proximaMarca(texto, desde) {
        let melhor = null;
        MARCAS.forEach(function (marca) {
            let i = texto.indexOf(marca.abre, desde);
            while (i !== -1) {
                /* "*" não pode ser metade de um "**". */
                const dupla = marca.abre === '*' && (texto[i + 1] === '*' || texto[i - 1] === '*');
                if (!dupla) {
                    let fim = texto.indexOf(marca.abre, i + marca.abre.length);
                    while (fim !== -1 && marca.abre === '*' && (texto[fim + 1] === '*' || texto[fim - 1] === '*')) {
                        fim = texto.indexOf(marca.abre, fim + 1);
                    }
                    if (fim > i + marca.abre.length && (!melhor || i < melhor.inicio)) {
                        melhor = { marca: marca, inicio: i, fim: fim };
                    }
                    break;
                }
                i = texto.indexOf(marca.abre, i + 2);
            }
        });
        return melhor;
    }

    function trechos(texto, estilos, saida) {
        let pos = 0;
        for (;;) {
            const achada = proximaMarca(texto, pos);
            if (!achada) break;
            if (achada.inicio > pos) saida.push({ t: texto.slice(pos, achada.inicio), s: estilos });
            const dentro = texto.slice(achada.inicio + achada.marca.abre.length, achada.fim);
            trechos(dentro, estilos.concat(achada.marca.estilo), saida);
            pos = achada.fim + achada.marca.abre.length;
        }
        if (pos < texto.length) saida.push({ t: texto.slice(pos), s: estilos });
        return saida;
    }

    /* Uma linha vira uma lista de palavras; cada palavra é uma lista de
       trechos com estilo (H~2~O é uma palavra só, com três trechos). */
    function palavras(linha) {
        const protegido = String(linha || '').replace(/\\\*/g, ESCAPE);
        const lista = [];
        let atual = [];
        trechos(protegido, [], []).forEach(function (trecho) {
            const partes = trecho.t.split(/(\s+)/);
            partes.forEach(function (parte) {
                if (!parte) return;
                if (/^\s+$/.test(parte)) {
                    if (atual.length) { lista.push(atual); atual = []; }
                    return;
                }
                atual.push({ t: parte.split(ESCAPE).join('*'), s: trecho.s });
            });
        });
        if (atual.length) lista.push(atual);
        return lista;
    }

    function trechoHtml(trecho) {
        let html = escapar(trecho.t);
        trecho.s.forEach(function (estilo) {
            const tag = { b: 'strong', i: 'em', sub: 'sub', sup: 'sup' }[estilo];
            html = '<' + tag + '>' + html + '</' + tag + '>';
        });
        return html;
    }

    function palavrasHtml(lista, inicio, fim) {
        return lista.slice(inicio || 0, fim == null ? lista.length : fim).map(function (palavra) {
            return palavra.map(trechoHtml).join('');
        }).join(' ');
    }

    /* Atalho para quem só quer o HTML de uma linha. */
    function html(linha) {
        return palavrasHtml(palavras(linha));
    }

    /* Texto puro, sem marcas — para resumos e nomes de arquivo. */
    function semMarcas(linha) {
        return palavras(linha).map(function (p) {
            return p.map(function (t) { return t.t; }).join('');
        }).join(' ');
    }

    /* Linhas não vazias do campo: cada uma é um parágrafo. */
    function paragrafos(texto) {
        return String(texto || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    }

    const api = {
        escapar: escapar,
        palavras: palavras,
        palavrasHtml: palavrasHtml,
        html: html,
        semMarcas: semMarcas,
        paragrafos: paragrafos
    };

    global.MontarTexto = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
