/* Leitura da lista de alunos colada pela coordenação.
   Aceita o que costuma sair do SIGE e das planilhas da escola: um nome por
   linha, com ou sem o número da chamada na frente, e linhas de planilha com
   colunas separadas por ponto e vírgula, tabulação ou vírgula. A turma pode vir
   como título de bloco ("TURMA 3B") ou como coluna da própria linha.
   Nada aqui guarda nome de aluno: as funções recebem texto e devolvem dados. */
(function (global) {
    'use strict';

    const identificacao = global.ProvasIdentificacao || (typeof require === 'function' ? require('./identificacao.js') : null);

    /* Cabeçalhos de planilha que não são nome de aluno. */
    const CABECALHOS = ['NOME', 'NOME DO ALUNO', 'NOME DO ESTUDANTE', 'NOME COMPLETO', 'ALUNO', 'ALUNO A', 'ALUNA', 'ESTUDANTE',
        'N', 'NO', 'NUM', 'NUMERO', 'NUM DA LISTA', 'NUMERO DA LISTA', 'ORDEM', 'CHAMADA', 'MATRICULA', 'TURMA', 'SERIE', 'SERIE TURMA'];

    function temLetras(texto, minimo) {
        const letras = identificacao.semAcento(texto).replace(/[^A-Za-z]/g, '');
        return letras.length >= (minimo || 2);
    }

    function ehCabecalho(texto) {
        return CABECALHOS.indexOf(identificacao.normalizarNome(texto)) !== -1;
    }

    /* Separa as colunas da linha. A vírgula só conta como separador quando não
       está entre números (para não partir "1.234" nem datas). */
    function separarCampos(linha) {
        return String(linha).split(/[;\t]|,(?=\s*\D)/).map(function (c) { return c.trim(); }).filter(Boolean);
    }

    /* Reconhece a turma escrita de qualquer jeito: "3B", "3º B", "3-B",
       "TURMA 3 B", "1ª série B". Devolve sempre no formato curto, "3B". */
    function reconhecerTurma(texto) {
        const limpo = identificacao.semAcento(String(texto || '')).toUpperCase().replace(/\s+/g, ' ').trim();
        const casamento = limpo.match(/(?:^|\b|TURMA\s*:?\s*)([123])\s*[ºª°oO]?\s*(?:ANO|SERIE)?\s*[-–\/ ]?\s*([A-F])\b/);
        if (!casamento) return null;
        return casamento[1] + casamento[2];
    }

    /* A linha é só o título de uma turma? ("TURMA 3B", "3º ANO - B") */
    function turmaDaLinhaInteira(linha) {
        const limpo = identificacao.semAcento(String(linha)).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        if (limpo.length > 26) return null;
        const semRotulo = limpo.replace(/^(TURMA|SERIE|ANO)\s*/g, '').trim();
        if (!/^[123]\s*(O|A)?\s*(ANO|SERIE)?\s*[A-F]$/.test(semRotulo)) return null;
        return reconhecerTurma(limpo);
    }

    /* A turma também aparece grudada na linha do aluno: "3B - JOSÉ CARLOS",
       "MARIA DE FÁTIMA, 2C". Separa os dois, sem confundir com a numeração da
       chamada: sem o rótulo "TURMA", exige a turma escrita junta ("3B", "3-B"),
       porque "1 - Ana" é número de chamada, não turma. */
    const TURMA_NO_INICIO = [
        /^(?:TURMA|SERIE|ANO)\s*:?\s*([123])\s*[ºª°oO]?\s*(?:ANO|SERIE)?\s*[-–\/ ]?\s*([A-F])\b\s*[-–—:;,]?\s*(.+)$/i,
        /^([123])\s*[ºª°oO]?\s*[-–\/]?\s*([A-F])\b\s*[-–—:;,]\s*(.+)$/i
    ];
    const TURMA_NO_FIM = /^(.+?)\s*[-–—:;,]\s*(?:TURMA\s*:?\s*)?([123])\s*[ºª°oO]?\s*(?:ANO|SERIE)?\s*[-–\/ ]?\s*([A-F])\s*$/i;

    function separarTurma(linha) {
        const texto = String(linha);
        const sem = identificacao.semAcento(texto);

        for (const padrao of TURMA_NO_INICIO) {
            const achou = sem.match(padrao);
            if (achou && temLetras(achou[3], 3)) {
                /* Recorta do texto original para não perder os acentos do nome. */
                return { turma: (achou[1] + achou[2]).toUpperCase(), resto: texto.slice(texto.length - achou[3].length) };
            }
        }

        const fim = sem.match(TURMA_NO_FIM);
        if (fim && temLetras(fim[1], 3)) {
            return { turma: (fim[2] + fim[3]).toUpperCase(), resto: texto.slice(0, fim[1].length) };
        }

        return { turma: null, resto: texto };
    }

    function ehCampoDeTurma(campo) {
        const limpo = String(campo).trim();
        if (limpo.length > 14) return false;
        return reconhecerTurma(limpo) !== null && !temLetras(limpo, 4);
    }

    /* Puxa da linha o número da chamada (quando houver) e o nome do aluno.
       Números de até três casas são chamada; de quatro para cima são matrícula
       e vão ignorados. */
    function extrairNumeroENome(linha) {
        const campos = separarCampos(linha);
        let numero = null;
        let nome = '';

        for (let i = 0; i < campos.length && !nome; i++) {
            const campo = campos[i];

            if (/^\d{1,3}$/.test(campo)) {
                if (numero === null) numero = parseInt(campo, 10);
                continue;
            }
            if (/^\d{4,}$/.test(campo)) continue; /* matrícula */
            if (ehCabecalho(campo)) continue;

            /* Numeração colada no nome: "1 - João", "07. João". */
            const comNumero = campo.match(/^[\s\-–—.·•*)\]]*(\d{1,3})[\s\-–—.·•*)\]]+(.+)$/);
            const candidato = comNumero ? comNumero[2].trim() : campo;
            if (!temLetras(candidato) || ehCabecalho(candidato)) continue;

            if (comNumero && numero === null) numero = parseInt(comNumero[1], 10);
            nome = candidato.replace(/\s+/g, ' ').trim();

            /* Planilha com o nome partido em duas colunas ("JOSÉ" | "SILVA"):
               junta o sobrenome. Só quando a coluna seguinte é texto puro, para
               não colar turma nem matrícula no nome. */
            const seguinte = (campos[i + 1] || '').trim();
            if (nome.indexOf(' ') === -1 && temLetras(seguinte) && !/\d/.test(seguinte) && !ehCabecalho(seguinte)) {
                nome = (nome + ' ' + seguinte.replace(/\s+/g, ' ').trim()).trim();
            }
        }

        return { numero: numero, nome: nome };
    }

    function extrairNome(linha) {
        return extrairNumeroENome(linha).nome;
    }

    /* Lista de uma turma só: devolve { alunos, ignoradas, repetidos }. */
    function lerLista(texto) {
        const alunos = [];
        const ignoradas = [];
        const repetidos = [];
        const vistos = Object.create(null);

        String(texto || '').split(/[\r\n]+/).forEach(function (bruta) {
            const linha = bruta.trim();
            if (!linha) return;
            const achado = extrairNumeroENome(linha);
            if (!achado.nome || !temLetras(achado.nome, 3)) {
                ignoradas.push(linha);
                return;
            }
            const chave = identificacao.normalizarNome(achado.nome);
            if (vistos[chave]) repetidos.push(achado.nome);
            vistos[chave] = true;
            alunos.push({ nome: achado.nome, numero: achado.numero });
        });

        return { alunos: alunos, ignoradas: ignoradas, repetidos: repetidos };
    }

    /* Leitura do lote inteiro: a coordenação cola todas as turmas de uma vez e a
       turma vem no próprio texto, seja como título de bloco, seja como coluna.
       A série sai do primeiro dígito da turma. */
    function lerLote(texto) {
        const porTurma = Object.create(null);
        const ordem = [];
        const semTurma = [];
        const ignoradas = [];
        const repetidos = [];

        let turmaAtual = null;

        function abrir(turma) {
            if (!porTurma[turma]) {
                porTurma[turma] = [];
                ordem.push(turma);
            }
            return porTurma[turma];
        }

        String(texto || '').split(/[\r\n]+/).forEach(function (bruta) {
            const linha = bruta.trim();
            if (!linha) return;

            const titulo = turmaDaLinhaInteira(linha);
            if (titulo) {
                turmaAtual = titulo;
                abrir(titulo);
                return;
            }

            const campos = separarCampos(linha);
            const campoTurma = campos.filter(ehCampoDeTurma)[0] || null;
            let turmaDaLinha = campoTurma ? reconhecerTurma(campoTurma) : null;
            let restante = campoTurma ? campos.filter(function (c) { return c !== campoTurma; }).join(';') : linha;

            if (!turmaDaLinha) {
                const separada = separarTurma(restante);
                if (separada.turma) {
                    turmaDaLinha = separada.turma;
                    restante = separada.resto;
                }
            }

            const achado = extrairNumeroENome(restante);

            if (!achado.nome || !temLetras(achado.nome, 3)) {
                ignoradas.push(linha);
                return;
            }

            const turma = turmaDaLinha || turmaAtual;
            if (!turma) {
                semTurma.push({ nome: achado.nome, numero: achado.numero });
                return;
            }

            const lista = abrir(turma);
            const chave = identificacao.normalizarNome(achado.nome);
            if (lista.some(function (a) { return identificacao.normalizarNome(a.nome) === chave; })) {
                repetidos.push(turma + ' · ' + achado.nome);
            }
            lista.push({ nome: achado.nome, numero: achado.numero });
        });

        const turmas = ordem.slice().sort().map(function (turma) {
            return { turma: turma, serie: turma.charAt(0), alunos: porTurma[turma] };
        }).filter(function (t) { return t.alunos.length > 0; });

        return {
            turmas: turmas,
            semTurma: semTurma,
            ignoradas: ignoradas,
            repetidos: repetidos,
            total: turmas.reduce(function (s, t) { return s + t.alunos.length; }, 0)
        };
    }

    const api = {
        lerLista: lerLista,
        lerLote: lerLote,
        extrairNome: extrairNome,
        extrairNumeroENome: extrairNumeroENome,
        reconhecerTurma: reconhecerTurma,
        separarTurma: separarTurma,
        turmaDaLinhaInteira: turmaDaLinhaInteira
    };

    global.ProvasLista = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
