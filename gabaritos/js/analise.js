/* Nota, análise de itens e CSV do Malu Gabaritos. Sem dados de aluno aqui. */
(function (global) {
    'use strict';

    function arred(n) { return Math.round(n * 10) / 10; }
    function arred2(n) { return Math.round(n * 100) / 100; }

    function nota(op) {
        if (global.MontarCodigo) return global.MontarCodigo.notaDaProva(op);
        return { nota: null };
    }

    function acertosDe(respostas, gabarito) {
        let acertos = 0;
        let total = 0;
        Object.keys(gabarito || {}).forEach(function (q) {
            total++;
            const r = respostas[q];
            const valor = r && typeof r === 'object' ? r.valor : r;
            const status = r && typeof r === 'object' ? r.status : (valor ? 'marcada' : 'branca');
            if (status === 'marcada' && valor === gabarito[q]) acertos++;
        });
        return { acertos: acertos, total: total };
    }

    /* A nota é a das questões, mais 1 se o código estiver certo. */
    function notaLeitura(leitura, prova) {
        const g = prova.gabarito || {};
        const contagem = acertosDe(leitura.respostas || {}, g);
        return nota({
            acertos: contagem.acertos,
            total: contagem.total,
            comCodigo: !!prova.codigoVerificacao,
            statusCodigo: leitura.statusCodigo
        });
    }

    function media(nums) {
        if (!nums.length) return null;
        return nums.reduce(function (s, n) { return s + n; }, 0) / nums.length;
    }

    function desvio(nums) {
        if (nums.length < 2) return 0;
        const m = media(nums);
        const v = nums.reduce(function (s, n) { return s + (n - m) * (n - m); }, 0) / nums.length;
        return Math.sqrt(v);
    }

    /* Dificuldade = proporção de acerto. Discriminação = ponto bisserial.
       Distratores = quantas vezes cada letra foi marcada. */
    function itens(leituras, gabarito, letras) {
        letras = letras || ['A', 'B', 'C', 'D', 'E'];
        const notasBase = leituras.map(function (l) {
            return acertosDe(l.respostas || {}, gabarito).acertos;
        });
        const s = desvio(notasBase);
        return Object.keys(gabarito).map(function (q) {
            const certa = gabarito[q];
            let certos = 0;
            let marcadas = 0;
            const dist = {};
            letras.forEach(function (L) { dist[L] = 0; });
            dist.branco = 0;
            const notasCertos = [];
            const notasErrados = [];
            leituras.forEach(function (l, i) {
                const r = (l.respostas || {})[q];
                const valor = r && typeof r === 'object' ? r.valor : r;
                const status = r && typeof r === 'object' ? r.status : (valor ? 'marcada' : 'branca');
                if (status === 'marcada' && letras.indexOf(valor) !== -1) {
                    dist[valor]++;
                    marcadas++;
                } else dist.branco++;
                const ok = status === 'marcada' && valor === certa;
                if (ok) { certos++; notasCertos.push(notasBase[i]); }
                else notasErrados.push(notasBase[i]);
            });
            const n = leituras.length || 1;
            const p = leituras.length ? certos / leituras.length : 0;
            const m1 = media(notasCertos);
            const m0 = media(notasErrados);
            let disc = null;
            if (leituras.length >= 4 && s > 0 && m1 != null && m0 != null) {
                disc = arred2(((m1 - m0) / s) * Math.sqrt(p * (1 - p)));
            }
            let faixa = 'média';
            if (p >= 0.7) faixa = 'fácil';
            else if (p < 0.3) faixa = 'difícil';
            return {
                questao: Number(q),
                gabarito: certa,
                acertos: certos,
                marcadas: marcadas,
                proporcao: arred2(p),
                faixa: faixa,
                discriminacao: disc,
                alerta: disc != null && disc < 0,
                distratores: dist,
                branco: dist.branco
            };
        }).sort(function (a, b) { return a.questao - b.questao; });
    }

    function csv(linhas) {
        function cel(v) {
            const s = v == null ? '' : String(v);
            return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }
        return linhas.map(function (l) { return l.map(cel).join(';'); }).join('\r\n');
    }

    const api = {
        nota: nota,
        acertosDe: acertosDe,
        notaLeitura: notaLeitura,
        itens: itens,
        csv: csv,
        arred: arred
    };
    global.MaluAnalise = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
