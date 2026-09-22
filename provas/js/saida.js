/* Nomes de arquivo, CSV de conferência e download.
   O CSV é a única forma de a coordenação levar embora a ligação entre o código
   e o nome do aluno — o app não guarda nada depois que a aba fecha. */
(function (global) {
    'use strict';

    function apenasSeguro(texto) {
        return String(texto || '')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^A-Za-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toUpperCase();
    }

    function nomeArquivo(prefixo, dados, extensao) {
        const partes = [prefixo, dados.ano, dados.bimestre, dados.turma, dados.componente]
            .filter(Boolean).map(apenasSeguro);
        return partes.join('-') + '.' + extensao;
    }

    /* Ponto e vírgula como separador e BOM na frente: é assim que o Excel em
       português abre o arquivo com as colunas já separadas e os acentos certos. */
    function montarCsv(provas, dados) {
        const linhas = [['NUMERO', 'ALUNO', 'TURMA', 'SERIE', 'COMPONENTE', 'BIMESTRE', 'ANO', 'IDENTIFICACAO']];
        provas.forEach(function (prova) {
            linhas.push([
                prova.numeroCurto,
                prova.nome,
                prova.turma,
                dados.serieNome || '',
                prova.componenteNome,
                dados.bimestre || '',
                dados.ano || '',
                prova.id
            ]);
        });
        const texto = linhas.map(function (linha) {
            return linha.map(function (celula) {
                const valor = String(celula == null ? '' : celula);
                return /[";\n]/.test(valor) ? '"' + valor.replace(/"/g, '""') + '"' : valor;
            }).join(';');
        }).join('\r\n');
        return '﻿' + texto;
    }

    function baixar(nome, conteudo, tipo) {
        const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const ligacao = document.createElement('a');
        ligacao.href = url;
        ligacao.download = nome;
        document.body.appendChild(ligacao);
        ligacao.click();
        document.body.removeChild(ligacao);
        /* Solta a memória depois que o navegador começou o download. */
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    const api = {
        apenasSeguro: apenasSeguro,
        nomeArquivo: nomeArquivo,
        montarCsv: montarCsv,
        baixar: baixar
    };

    global.ProvasSaida = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
