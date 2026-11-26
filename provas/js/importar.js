/* Importar do Montador: as provas que a coordenação já travou para impressão.

   O Identificador busca no Montador a lista de provas travadas, a gestão escolhe
   as do bimestre e cada PDF solto é reconhecido pela chave da prova, que o
   Montador grava no título do PDF (ver chaveprova.js). Assim ninguém escolhe o
   espaço de série e componente na mão, e a chave certa vai para o QR de cada
   aluno.

   Este arquivo só decide: não toca na tela nem no banco. */
(function (global) {
    'use strict';

    var NOMES = {
        LIN: 'Linguagens e Códigos', NAT: 'Ciências da Natureza', HUM: 'Ciências Humanas',
        MAT: 'Matemática', RED: 'Redação'
    };
    var ORDEM_COMPONENTES = ['LIN', 'NAT', 'HUM', 'MAT', 'RED'];
    var SERIES = ['1', '2', '3'];
    var LETRAS_DE_TURMA = ['A', 'B', 'C', 'D', 'E', 'F'];

    /* Os 8 primeiros caracteres do id da prova na nuvem, em maiúsculas: a mesma
       chave que o Montador põe no PDF e que o QR leva. */
    function chaveDoId(id) {
        var s = String(id || '');
        return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) ? s.replace(/-/g, '').slice(0, 8).toUpperCase() : '';
    }

    /* Uma linha de montador_provas → a prova como o Identificador a usa. Prova
       de formato livre (sem série ou sem componente da escola) não serve ao
       Identificador e fica de fora. */
    function normalizar(linha) {
        if (!linha) return null;
        var chave = chaveDoId(linha.id);
        var serie = String(linha.serie == null ? '' : linha.serie).replace(/\D/g, '').charAt(0);
        var componente = String(linha.componente || '').toUpperCase();
        var bimestre = String(linha.bimestre || '').toUpperCase();
        var ano = String(linha.ano == null ? '' : linha.ano);
        if (!chave || SERIES.indexOf(serie) === -1 || !NOMES[componente] || !/^B[1-4]$/.test(bimestre) || !/^\d{4}$/.test(ano)) return null;
        return { id: linha.id, chave: chave, titulo: String(linha.titulo || '').trim(), componente: componente, serie: serie, bimestre: bimestre, ano: ano };
    }

    function normalizarTodas(linhas) {
        var provas = [];
        var descartadas = 0;
        (linhas || []).forEach(function (l) {
            var p = normalizar(l);
            if (p) provas.push(p); else descartadas++;
        });
        return { provas: provas, descartadas: descartadas };
    }

    function nomeDoComponente(codigo) { return NOMES[codigo] || codigo; }

    function rotuloDoBimestre(bimestre, ano) { return String(bimestre).replace('B', '') + 'º bimestre de ' + ano; }

    function rotulo(p) {
        return nomeDoComponente(p.componente) + ' · ' + p.serie + 'ª série · ' + rotuloDoBimestre(p.bimestre, p.ano);
    }

    /* O espaço do passo 3 em que esta prova entra: 'série|COMPONENTE'. */
    function chaveSlot(p) { return p.serie + '|' + p.componente; }

    function comparar(a, b) {
        return a.serie.localeCompare(b.serie) ||
            (ORDEM_COMPONENTES.indexOf(a.componente) - ORDEM_COMPONENTES.indexOf(b.componente));
    }

    /* Por bimestre, o mais novo primeiro; dentro dele, por série e componente. */
    function agrupar(provas) {
        var mapa = Object.create(null);
        provas.forEach(function (p) {
            var k = p.ano + '|' + p.bimestre;
            if (!mapa[k]) mapa[k] = { ano: p.ano, bimestre: p.bimestre, rotulo: rotuloDoBimestre(p.bimestre, p.ano), provas: [] };
            mapa[k].provas.push(p);
        });
        return Object.keys(mapa).map(function (k) { return mapa[k]; })
            .sort(function (a, b) { return b.ano.localeCompare(a.ano) || b.bimestre.localeCompare(a.bimestre); })
            .map(function (g) { g.provas.sort(comparar); return g; });
    }

    /* A seleção pode ser usada? Tem de ser do mesmo bimestre e ter uma prova só por
       série e componente (o Identificador tem um espaço para cada). */
    function validarSelecao(escolhidas) {
        if (!escolhidas.length) return { ok: false, erro: 'Marque pelo menos uma prova.' };
        var primeira = escolhidas[0];
        var outroBimestre = escolhidas.filter(function (p) { return p.ano !== primeira.ano || p.bimestre !== primeira.bimestre; })[0];
        if (outroBimestre) {
            return { ok: false, erro: 'Marque provas de um bimestre só: há ' + rotuloDoBimestre(primeira.bimestre, primeira.ano) +
                ' e ' + rotuloDoBimestre(outroBimestre.bimestre, outroBimestre.ano) + '.' };
        }
        var vistos = Object.create(null);
        for (var i = 0; i < escolhidas.length; i++) {
            var k = chaveSlot(escolhidas[i]);
            if (vistos[k]) {
                return { ok: false, erro: 'Há duas provas para ' + nomeDoComponente(escolhidas[i].componente) + ' da ' + escolhidas[i].serie +
                    'ª série (' + vistos[k].titulo + ' e ' + escolhidas[i].titulo + '). Marque só uma.' };
            }
            vistos[k] = escolhidas[i];
        }
        return { ok: true, ano: primeira.ano, bimestre: primeira.bimestre, titulo: primeira.titulo };
    }

    /* Um PDF solto: de qual prova importada ele é?
       info vem de ProvasChaveProva.doArquivo (nome e título do PDF).
       Devolve { prova, tipo } ou { prova: null, motivo }. */
    function parear(info, importadas) {
        /* a folha do professor sai sem chave, então o tipo é conferido antes dela */
        if (info && info.tipo === 'professor') return { prova: null, motivo: 'professor' };
        if (info && info.tipo === 'quatro') return { prova: null, motivo: 'quatro' };
        if (!info || !info.chave) return { prova: null, motivo: 'sem-chave' };
        var prova = (importadas || []).filter(function (p) { return p.chave === info.chave; })[0];
        if (!prova) return { prova: null, motivo: 'desconhecida' };
        return { prova: prova, tipo: info.tipo === 'gabarito' ? 'gabarito' : 'prova' };
    }

    /* O que a tela diz de cada PDF solto. */
    function mensagem(resultado, info) {
        if (resultado.prova) {
            return (resultado.tipo === 'gabarito' ? 'Gabarito' : 'Prova') + ' de ' + rotulo(resultado.prova) +
                ' (chave ' + resultado.prova.chave + ').';
        }
        switch (resultado.motivo) {
            case 'professor': return 'Esta é a folha do professor: não vai para o Identificador.';
            case 'quatro': return 'Este é o PDF com 4 gabaritos por folha, para imprimir direto. O Identificador recebe o de 1 por página (nome terminado em -GABARITO).';
            case 'desconhecida': return 'A chave ' + (info && info.chave) + ' não é de nenhuma das provas importadas. Traga essa prova do Montador (passo 1) ou confira se o PDF é do bimestre certo.';
            default: return 'Este PDF não tem a chave da prova (não veio do Montador, ou foi salvo por outro programa). Solte-o no espaço dele, no fim do passo 3.';
        }
    }

    /* As turmas que dá para escolher no passo 2: A a F de cada série das provas
       importadas (ou das três séries, se ainda não há prova importada). */
    function turmasDasSeries(importadas) {
        var series = [];
        (importadas || []).forEach(function (p) { if (series.indexOf(p.serie) === -1) series.push(p.serie); });
        if (!series.length) series = SERIES.slice();
        series.sort();
        var turmas = [];
        series.forEach(function (s) { LETRAS_DE_TURMA.forEach(function (l) { turmas.push(s + l); }); });
        return turmas;
    }

    /* Junta as turmas que acabaram de vir do Malu Presente com as que já estão na
       caixa (que podem ter edições): as novas entram no lugar das de mesmo nome. */
    function juntarTurmas(atuais, novas) {
        var nomes = (novas || []).map(function (t) { return t.turma; });
        return (atuais || []).filter(function (t) { return nomes.indexOf(t.turma) === -1; }).concat(novas || [])
            .sort(function (a, b) { return a.turma.localeCompare(b.turma); });
    }

    var api = {
        chaveDoId: chaveDoId,
        normalizar: normalizar,
        normalizarTodas: normalizarTodas,
        rotulo: rotulo,
        chaveSlot: chaveSlot,
        agrupar: agrupar,
        validarSelecao: validarSelecao,
        parear: parear,
        mensagem: mensagem,
        turmasDasSeries: turmasDasSeries,
        juntarTurmas: juntarTurmas
    };

    global.ProvasImportar = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
