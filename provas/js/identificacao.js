/* Identificação das provas: turmas, componentes, numeração e código único.
   Nenhuma função aqui toca no navegador nem guarda nada: é só cálculo, para
   poder ser conferida pelos testes em test/provas.test.cjs. */
(function (global) {
    'use strict';

    const sha256 = global.ProvasSha256 || (typeof require === 'function' ? require('./sha256.js') : null);

    const ESCOLA = 'MLS'; /* EEMTI Prof. Maria Luiza Saboia Ribeiro */

    const COMPONENTES = [
        { codigo: 'RED', nome: 'Redação' },
        { codigo: 'LIN', nome: 'Linguagens e Códigos' },
        { codigo: 'NAT', nome: 'Ciências da Natureza' },
        { codigo: 'HUM', nome: 'Ciências Humanas' },
        { codigo: 'MAT', nome: 'Matemática' }
    ];

    /* A escola escreve a série como "1ª SÉRIE" no cabeçalho das provas, então é
       assim que ela sai impressa. As turmas são as de 2026 e servem de sugestão:
       quem manda é a lista que a coordenação colar. */
    const SERIES = [
        { codigo: '1', nome: '1ª SÉRIE', turmas: ['1A', '1B', '1C'] },
        { codigo: '2', nome: '2ª SÉRIE', turmas: ['2A', '2B', '2C'] },
        { codigo: '3', nome: '3ª SÉRIE', turmas: ['3A', '3B'] }
    ];

    function serie(codigo) {
        return SERIES.filter(function (s) { return s.codigo === String(codigo); })[0] || null;
    }

    /* Alfabeto sem I, L, O e U: ninguém confunde 1 com I nem 0 com O ao copiar
       o código à mão. */
    const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    function semAcento(texto) {
        return String(texto)
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '');
    }

    /* Forma canônica do nome: é ela que entra no código verificador, para o
       código não mudar se o nome vier com acento diferente ou espaço sobrando. */
    function normalizarNome(nome) {
        return semAcento(nome)
            .toUpperCase()
            .replace(/[^A-Z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* Nome como sai impresso na prova: acentos preservados, caixa alta. */
    function nomeParaImpressao(nome) {
        return String(nome).replace(/\s+/g, ' ').trim().toUpperCase();
    }

    function compararNomes(a, b) {
        const na = normalizarNome(a);
        const nb = normalizarNome(b);
        if (na < nb) return -1;
        if (na > nb) return 1;
        return 0;
    }

    /* A numeração sai da ordem alfabética, não da ordem em que a lista foi
       colada: assim a mesma turma gera sempre os mesmos códigos, mesmo que a
       coordenação cole a lista de outro jeito no ano seguinte. */
    function ordenarAlunos(nomes) {
        return nomes.slice().sort(compararNomes);
    }

    function textoCanonico(dados) {
        return [
            ESCOLA,
            dados.ano,
            dados.bimestre,
            dados.turma,
            formatarNumero(dados.numero),
            dados.componente,
            normalizarNome(dados.nome)
        ].join('|');
    }

    function formatarNumero(numero) {
        return String(numero).padStart(3, '0');
    }

    /* O grid da folha de respostas tem duas casas para o "Núm. da lista", então
       o número impresso segue o mesmo tamanho. */
    function numeroCurto(numero) {
        const n = parseInt(numero, 10);
        if (!isNaN(n) && n < 100) return String(n).padStart(2, '0');
        return formatarNumero(numero);
    }

    /* 20 bits do SHA-256 em quatro caracteres. Como a chave da escola entra no
       resumo, um código válido não se inventa de fora: trocar o nome ou a turma
       na caneta derruba a conferência. */
    function codigoVerificador(canonico, chave) {
        const bytes = sha256.bytes(String(chave || '') + '#' + canonico);
        const bits = (bytes[0] << 12) | (bytes[1] << 4) | (bytes[2] >> 4);
        let saida = '';
        for (let i = 3; i >= 0; i--) {
            saida += ALFABETO[(bits >> (i * 5)) & 31];
        }
        return saida;
    }

    /* Monta a identificação de uma prova: o código impresso, o conteúdo do QR
       e os pedaços separados, para a folha de conferência. */
    function identificar(dados) {
        const canonico = textoCanonico(dados);
        const verificador = codigoVerificador(canonico, dados.chave);
        const numero = formatarNumero(dados.numero);
        const id = [ESCOLA, dados.ano, dados.bimestre, dados.turma, numero, dados.componente, verificador].join('-');
        const componente = COMPONENTES.find(function (c) { return c.codigo === dados.componente; });
        return {
            id: id,
            canonico: canonico,
            verificador: verificador,
            numero: numero,
            numeroCurto: numeroCurto(dados.numero),
            turma: dados.turma,
            componente: dados.componente,
            componenteNome: componente ? componente.nome : dados.componente,
            nome: nomeParaImpressao(dados.nome),
            conteudoQr: id + '\n' + nomeParaImpressao(dados.nome)
        };
    }

    /* Aceita a lista como nomes soltos ou como { nome, numero }. Quando a lista
       colada já vem numerada, é esse número que vale: é o "Núm. da lista" que o
       aluno preenche na folha de respostas. Sem numeração, a ordem alfabética
       manda — e aí a mesma turma gera sempre os mesmos códigos. */
    function prepararAlunos(alunos) {
        const entradas = (alunos || []).map(function (item) {
            if (typeof item === 'string') return { nome: item, numero: null };
            const numero = parseInt(item.numero, 10);
            return { nome: item.nome, numero: isNaN(numero) ? null : numero };
        }).filter(function (item) { return item.nome; });

        const algumNumerado = entradas.some(function (item) { return item.numero !== null; });

        if (!algumNumerado) {
            return entradas
                .sort(function (a, b) { return compararNomes(a.nome, b.nome); })
                .map(function (item, indice) { return { nome: item.nome, numero: indice + 1 }; });
        }

        /* Lista numerada: respeita o número e completa quem veio sem ele com o
           primeiro número livre. */
        const usados = Object.create(null);
        entradas.forEach(function (item) {
            if (item.numero !== null) usados[item.numero] = true;
        });
        let proximo = 1;
        entradas.forEach(function (item) {
            if (item.numero !== null) return;
            while (usados[proximo]) proximo++;
            item.numero = proximo;
            usados[proximo] = true;
        });

        return entradas.sort(function (a, b) { return a.numero - b.numero; });
    }

    /* Identifica a turma inteira de um componente. */
    function identificarTurma(opcoes) {
        return prepararAlunos(opcoes.alunos).map(function (aluno) {
            return identificar({
                ano: opcoes.ano,
                bimestre: opcoes.bimestre,
                turma: opcoes.turma,
                numero: aluno.numero,
                componente: opcoes.componente,
                nome: aluno.nome,
                chave: opcoes.chave
            });
        });
    }

    /* Desmonta um código lido no QR ou digitado à mão. */
    function separarId(id) {
        const partes = String(id).trim().toUpperCase().split('-');
        if (partes.length !== 7 || partes[0] !== ESCOLA) return null;
        return {
            escola: partes[0],
            ano: partes[1],
            bimestre: partes[2],
            turma: partes[3],
            numero: partes[4],
            componente: partes[5],
            verificador: partes[6]
        };
    }

    /* Conferência: o código bate com este nome? Aceita tanto o texto completo
       do QR (código + nome em duas linhas) quanto código e nome separados. */
    function conferir(entrada, nomeInformado, chave) {
        const linhas = String(entrada || '').split(/[\r\n]+/).map(function (l) { return l.trim(); }).filter(Boolean);
        const id = linhas[0] || '';
        const nome = nomeInformado || linhas[1] || '';
        const partes = separarId(id);
        if (!partes) {
            return { valido: false, motivo: 'formato', id: id, nome: nome };
        }
        if (!nome) {
            return { valido: false, motivo: 'sem-nome', id: id, partes: partes, nome: '' };
        }
        const canonico = textoCanonico({
            ano: partes.ano,
            bimestre: partes.bimestre,
            turma: partes.turma,
            numero: partes.numero,
            componente: partes.componente,
            nome: nome
        });
        const esperado = codigoVerificador(canonico, chave);
        return {
            valido: esperado === partes.verificador,
            motivo: esperado === partes.verificador ? null : 'verificador',
            id: id,
            nome: nomeParaImpressao(nome),
            partes: partes,
            esperado: esperado
        };
    }

    const api = {
        ESCOLA: ESCOLA,
        COMPONENTES: COMPONENTES,
        SERIES: SERIES,
        serie: serie,
        ALFABETO: ALFABETO,
        semAcento: semAcento,
        normalizarNome: normalizarNome,
        nomeParaImpressao: nomeParaImpressao,
        ordenarAlunos: ordenarAlunos,
        formatarNumero: formatarNumero,
        numeroCurto: numeroCurto,
        prepararAlunos: prepararAlunos,
        textoCanonico: textoCanonico,
        codigoVerificador: codigoVerificador,
        identificar: identificar,
        identificarTurma: identificarTurma,
        separarId: separarId,
        conferir: conferir
    };

    global.ProvasIdentificacao = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
