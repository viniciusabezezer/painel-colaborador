/* Contrato do QR impresso na prova e no gabarito identificado.
   Versão MLSPROVA1. Não é o QR do cartão de entrada do Malu Presente:
   este texto não leva credencial, token, segredo nem nada daquele cartão.
   O formato está documentado em provas/README.md, na seção
   "Contrato do QR da prova". */
(function (global) {
    'use strict';

    var PREFIXO = 'MLSPROVA1';
    /* Cabe em um QR versão 6 (41 módulos, correção M): no quadrado de 2 cm da
       prova isso continua legível. Nome e título maiores são cortados. */
    var LIMITE_NOME = 28;
    var LIMITE_TITULO = 19;
    var LIMITE_TEXTO = 106;

    function semAcento(texto) {
        return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    /* Campo curto e seguro para ir no QR e, trocando o | por %7C, num endereço.
       Acento sai, caixa alta, e o que não é letra vira +, que o leitor lê como espaço. */
    function campo(texto, limite) {
        var s = semAcento(texto).toUpperCase().replace(/[^A-Z0-9]+/g, '+').replace(/^\+|\+$/g, '');
        if (limite && s.length > limite) {
            var resto = s.slice(limite);
            s = s.slice(0, limite);
            /* Só volta até a palavra anterior quando o corte caiu no meio dela. */
            if (resto.charAt(0) !== '+' && s.slice(-1) !== '+') {
                var corte = s.lastIndexOf('+');
                if (corte >= Math.floor(limite * 0.5)) s = s.slice(0, corte);
            }
            s = s.replace(/\+$/, '');
        }
        return s;
    }

    /* Matrícula da lista oficial: só dígitos, de 4 a 12. Qualquer outro valor
       — inclusive um token ou a credencial do cartão — fica de fora. */
    function matriculaLimpa(valor) {
        var texto = String(valor == null ? '' : valor).trim();
        return /^\d{4,12}$/.test(texto) ? texto : '';
    }

    /* Chave da prova no Montador: 8 caracteres de 0-9 e A-F. Liga o QR à prova
       certa no Malu Gabaritos, sem ninguém escolher nada. Qualquer outro valor
       fica de fora. */
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

    /* Monta o texto do QR. Só entram estes campos: código, turma, número,
       nome, título e, quando a lista tem, a matrícula. */
    function montar(dados) {
        dados = dados || {};
        var partes = partesDoCodigo(dados.codigo || dados.id);
        if (!partes) throw new Error('código da prova inválido');
        var turmaInformada = String(dados.turma || '').toUpperCase();
        var turma = /^[123][A-F]$/.test(turmaInformada) ? turmaInformada : partes.turma;
        var numeroBruto = String(dados.numero == null ? '' : dados.numero).trim();
        var numero = /^\d{1,3}$/.test(numeroBruto) ? numeroBruto.padStart(3, '0') : partes.numero;
        var nome = campo(dados.nome, LIMITE_NOME);
        var titulo = campo(dados.titulo || dados.avaliacao, LIMITE_TITULO);
        var matricula = matriculaLimpa(dados.matricula);
        var chave = chaveLimpa(dados.chaveProva);
        /* A chave é o oitavo campo. Com ela, a matrícula (sétimo) fica no lugar
           mesmo vazia, para o leitor contar os campos certo. */
        function compor() {
            var texto = [PREFIXO, partes.codigo, turma, numero, nome, titulo].join('|');
            if (chave) return texto + '|' + matricula + '|' + chave;
            return matricula ? texto + '|' + matricula : texto;
        }
        var texto = compor();
        /* Se o código ou o nome estourar o tamanho que a impressão aguenta,
           o título sai primeiro e depois o nome, sempre num corte de palavra. */
        while (texto.length > LIMITE_TEXTO && titulo) {
            titulo = titulo.slice(0, -1).replace(/\+$/, '');
            texto = compor();
        }
        while (texto.length > LIMITE_TEXTO && nome.length > 8) {
            nome = nome.slice(0, -1).replace(/\+$/, '');
            texto = compor();
        }
        return texto;
    }

    /* Lê o formato novo e o antigo (código na primeira linha, nome na segunda),
       que é o que está nas provas já impressas. */
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

    var api = {
        PREFIXO: PREFIXO,
        LIMITE_NOME: LIMITE_NOME,
        LIMITE_TITULO: LIMITE_TITULO,
        LIMITE_TEXTO: LIMITE_TEXTO,
        campo: campo,
        matriculaLimpa: matriculaLimpa,
        chaveLimpa: chaveLimpa,
        partesDoCodigo: partesDoCodigo,
        montar: montar,
        ler: ler
    };

    global.ProvasQrProva = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
