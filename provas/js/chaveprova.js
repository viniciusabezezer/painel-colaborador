/* Chave da prova que vem dentro do PDF do Montador.

   Ao imprimir uma prova da área, o Montador dá ao PDF um nome com a chave da
   prova (PROVA-2026-B3-1S-LIN-K8F3A2C1D) e o navegador grava o mesmo nome como
   título do PDF. Aqui o Identificador lê esse nome e esse título:

   - a chave vai para o QR de cada aluno, e o Malu Gabaritos acha a prova por
     ela, sem ninguém escolher nada;
   - o que o nome diz (ano, bimestre, série, componente) é conferido com o
     espaço em que a pessoa soltou o arquivo, para um PDF de Ciências da
     Natureza não sair no espaço de Linguagens.

   O título tem prioridade sobre o nome do arquivo, porque sobrevive a quem
   renomeia o arquivo. PDF de outra origem, JPG e PNG não têm chave: seguem como
   sempre. */
(function (global) {
    'use strict';

    var COMPONENTES = {
        LIN: 'Linguagens e Códigos', NAT: 'Ciências da Natureza', HUM: 'Ciências Humanas',
        MAT: 'Matemática', RED: 'Redação'
    };

    var NOME = /^PROVA-(\d{4})-(B[1-4])-([123])([A-FS])-([A-Z0-9]+)/;
    var CHAVE = /(?:^|-)K([0-9A-F]{8})(?=-|$)/;

    /* "PROVA-2026-B3-1S-LIN-K8F3A2C1D.pdf" → { chave, ano, bimestre, serie, componente } */
    function doTexto(texto) {
        var t = String(texto || '').trim().toUpperCase().replace(/\.PDF$/, '');
        var chave = t.match(CHAVE);
        var nome = t.match(NOME);
        if (!chave && !nome) return null;
        return {
            chave: chave ? chave[1] : '',
            ano: nome ? nome[1] : '',
            bimestre: nome ? nome[2] : '',
            serie: nome ? nome[3] : '',
            componente: nome ? nome[5] : ''
        };
    }

    function leitorDePdf() {
        if (global.PDFLib) return global.PDFLib;
        if (typeof require === 'function') {
            try { return require('../vendor/pdf-lib.min.js'); } catch (e) { /* sem leitor */ }
        }
        return null;
    }

    async function tituloDoPdf(bytes) {
        var lib = leitorDePdf();
        if (!lib || !bytes) return '';
        try {
            var doc = await lib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
            return doc.getTitle() || '';
        } catch (e) {
            return '';
        }
    }

    /* arquivo: { nome, tipo, bytes }, como o Identificador guarda. */
    async function doArquivo(arquivo) {
        if (!arquivo) return null;
        var titulo = arquivo.tipo === 'pdf' ? await tituloDoPdf(arquivo.bytes) : '';
        var porTitulo = doTexto(titulo);
        var porNome = doTexto(arquivo.nome);
        if (porTitulo && porTitulo.chave) return porTitulo;
        if (porNome && porNome.chave) return porNome;
        return porTitulo || porNome || null;
    }

    function nomeDoComponente(codigo) { return COMPONENTES[codigo] || codigo; }

    /* O arquivo está no espaço certo? espaco: { ano, bimestre, serie, componente }.
       Devolve '' se tudo bate (ou se o arquivo não diz nada), ou o que está errado. */
    function conferir(info, espaco) {
        if (!info || !espaco) return '';
        var problemas = [];
        if (info.componente && espaco.componente && info.componente !== espaco.componente) {
            problemas.push('o arquivo é de ' + nomeDoComponente(info.componente) + ', mas está no espaço de ' + nomeDoComponente(espaco.componente));
        }
        if (info.serie && espaco.serie && info.serie !== String(espaco.serie)) {
            problemas.push('o arquivo é da ' + info.serie + 'ª série, mas está no espaço da ' + espaco.serie + 'ª série');
        }
        if (info.bimestre && espaco.bimestre && info.bimestre !== String(espaco.bimestre)) {
            problemas.push('o arquivo é do ' + info.bimestre.replace('B', '') + 'º bimestre, mas o passo 1 diz ' + String(espaco.bimestre).replace('B', '') + 'º');
        }
        if (info.ano && espaco.ano && info.ano !== String(espaco.ano)) {
            problemas.push('o arquivo é de ' + info.ano + ', mas o passo 1 diz ' + espaco.ano);
        }
        return problemas.join('; ');
    }

    var api = { doTexto: doTexto, doArquivo: doArquivo, conferir: conferir, tituloDoPdf: tituloDoPdf };

    global.ProvasChaveProva = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
