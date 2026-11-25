/* Leitor do QR da prova no Malu Gabaritos.
   O contrato (MLSPROVA1) está em provas/README.md. A função ler é a mesma de
   provas/js/qrprova.js: o teste gabaritos/test/qrprova.test.cjs confere as duas.
   Este arquivo não conhece o cartão de entrada do Malu Presente e não guarda
   credencial nenhuma. */
(function (global) {
    'use strict';

    var PREFIXO = 'MLSPROVA1';

    function matriculaLimpa(valor) {
        var texto = String(valor == null ? '' : valor).trim();
        return /^\d{4,12}$/.test(texto) ? texto : '';
    }

    /* Chave da prova no Montador: 8 caracteres de 0-9 e A-F. */
    function chaveLimpa(valor) {
        var texto = String(valor == null ? '' : valor).trim().toUpperCase();
        return /^[0-9A-F]{8}$/.test(texto) ? texto : '';
    }

    function partesDoCodigo(id) {
        var partes = String(id || '').trim().toUpperCase().split('-');
        if (partes.length !== 7 || partes[0] !== 'MLS') return null;
        if (!partes[1] || !partes[2] || !partes[3] || !partes[4] || !partes[5] || !partes[6]) return null;
        return { codigo: partes.join('-'), turma: partes[3], numero: partes[4] };
    }

    function abrirCampo(texto) {
        return String(texto || '').split('+').join(' ').replace(/\s+/g, ' ').trim();
    }

    function ler(texto) {
        var bruto = String(texto || '').replace(/^\uFEFF/, '').trim();
        if (!bruto) return null;

        if (bruto.indexOf(PREFIXO + '|') === 0) {
            var campos = bruto.split('|');
            if (campos.length < 6) return null;
            var novo = partesDoCodigo(campos[1]);
            if (!novo) return null;
            return {
                formato: PREFIXO,
                codigo: novo.codigo,
                turma: abrirCampo(campos[2]) || novo.turma,
                numero: abrirCampo(campos[3]) || novo.numero,
                nome: abrirCampo(campos[4]),
                titulo: abrirCampo(campos[5]),
                matricula: campos.length > 6 ? matriculaLimpa(campos[6]) : '',
                chave: campos.length > 7 ? chaveLimpa(campos[7]) : ''
            };
        }

        var linhas = bruto.split(/[\r\n]+/).map(function (l) { return l.trim(); }).filter(Boolean);
        var antigo = partesDoCodigo(linhas[0]);
        if (!antigo) return null;
        return {
            formato: 'antigo',
            codigo: antigo.codigo,
            turma: antigo.turma,
            numero: antigo.numero,
            nome: linhas.slice(1).join(' ').trim(),
            titulo: '',
            matricula: '',
            chave: ''
        };
    }

    /* "1º A", "1ª série A" e "1A" são a mesma turma. */
    function turmaCurta(turma) {
        var limpo = String(turma || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        var achou = limpo.match(/^([123])(?:ANO|SERIE)?([A-F])$/);
        return achou ? achou[1] + achou[2] : limpo;
    }

    /* O número da lista sozinho repete entre turmas. Com o QR, a turma desempata. */
    function casarAluno(alunos, lista, qr) {
        var n = lista == null || lista === '' ? NaN : Number(lista);
        if (!isFinite(n) && qr && qr.numero) n = parseInt(qr.numero, 10);
        var candidatos = (alunos || []).filter(function (a) { return Number(a.lista) === n; });
        if (qr && qr.turma) {
            var curta = turmaCurta(qr.turma);
            var daTurma = candidatos.filter(function (a) { return turmaCurta(a.turma) === curta; });
            if (daTurma.length) return daTurma[0];
        }
        return candidatos[0] || null;
    }

    function escolher(visto, colado) {
        if (ler(visto)) return String(visto).trim();
        if (ler(colado)) return String(colado).trim();
        return '';
    }

    var api = {
        PREFIXO: PREFIXO,
        ler: ler,
        turmaCurta: turmaCurta,
        casarAluno: casarAluno,
        escolher: escolher
    };

    global.MaluQrProva = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
