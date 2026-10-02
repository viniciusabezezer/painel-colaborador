/* Leitura de questões coladas de uma vez — do Word, de um PDF, de um banco de
   questões. Reconhece o formato de prova da escola:

     BIOLOGIA
     01. (Uece) Dentre as características apresentadas abaixo, marque…
     a) Possuem ciclo de vida assexuado e sexuado.
     b) Apresentam cnidócitos como mecanismo de defesa.
     …
     Gabarito: D

   Cuidados que o texto real pede:
   - uma questão nova só começa no número SEGUINTE ao da anterior, para uma
     lista "1. esquistossomose; 2. teníase" dentro do enunciado não virar
     questões;
   - as alternativas só contam em ordem (a, b, c…); se um "a)" aparece de novo,
     o que parecia alternativa era uma lista do enunciado, e volta para ele;
   - linha quebrada pelo PDF (que termina sem pontuação e continua em
     minúscula) é emendada na anterior. */
(function (global) {
    'use strict';

    const INICIO_QUESTAO = /^\s*(?:quest[ãa]o\s*)?(\d{1,3})\s*[.)\-–:]\s*(.*)$/i;
    const SO_NUMERO = /^\s*quest[ãa]o\s*(\d{1,3})\s*[.:\-–]?\s*$/i;
    const ALTERNATIVA = /^\s*\(?([a-eA-E])\s*[).\-–]\s*(.*)$/;
    const RESPOSTA = /^\s*(?:gabarito|resposta|resp\.?|alternativa correta)\s*[:\-–]?\s*\(?([a-eA-E])\)?\s*\.?\s*$/i;
    const LETRAS = 'abcde';

    function ehTitulo(linha) {
        const t = linha.trim();
        if (t.length < 3 || t.length > 40 || /\d/.test(t)) return false;
        if (!/[A-ZÀ-Ý]/.test(t)) return false;
        if (/^(TEXTO|FRAGMENTO|QUADRO|TABELA|FIGURA|GR[ÁA]FICO|IMAGEM|TIRINHA|CHARGE)\b/.test(t)) return false;
        return t === t.toUpperCase() && /^[A-ZÀ-Ý\s\-–/&,]+$/.test(t);
    }

    function separarFonte(texto) {
        const achado = /^\(([^()]{2,40})\)\s*(.*)$/.exec(texto);
        if (!achado) return { fonte: '', resto: texto };
        return { fonte: achado[1].trim(), resto: achado[2] };
    }

    /* "a) x  b) y  c) z" numa linha só vira três linhas. */
    function abrirAlternativasNaLinha(linha) {
        if (!/^\s*\(?a\s*\)/i.test(linha)) return [linha];
        return linha.split(/\s+(?=\(?[b-e]\s*\)\s)/i);
    }

    function emendar(anterior, linha) {
        if (!anterior) return linha;
        const terminou = /[.:;?!)"”]$/.test(anterior.trim());
        const continua = /^[a-zà-ú,;]/.test(linha.trim());
        return (!terminou && continua) ? null : undefined;
    }

    /* Acrescenta a linha ao parágrafo atual ou abre outro. */
    function juntarTexto(texto, linha) {
        if (!texto) return linha;
        const linhas = texto.split('\n');
        const ultima = linhas[linhas.length - 1];
        if (emendar(ultima, linha) === null) {
            linhas[linhas.length - 1] = ultima + ' ' + linha;
            return linhas.join('\n');
        }
        return texto + '\n' + linha;
    }

    function ler(texto, opcoes) {
        opcoes = opcoes || {};
        const maxAlternativas = opcoes.alternativas || 5;
        const secoes = [];
        const avisos = [];
        let secao = null;
        let questao = null;
        let ultimoNumero = null;
        let textoSolto = ''; /* texto-base antes da questão: entra no enunciado dela */

        function secaoAtual() {
            if (!secao) { secao = { titulo: '', questoes: [] }; secoes.push(secao); }
            return secao;
        }

        function fecharQuestao() {
            if (!questao) return;
            questao.enunciado = questao.enunciado.trim();
            questao.alternativas = questao.alternativas.map(function (a) { return a.replace(/\n/g, ' '); });
            if (questao.alternativas.length === 0) questao.tipo = 'discursiva';
            questao = null;
        }

        function abrirQuestao(numero, resto) {
            fecharQuestao();
            const partes = separarFonte(resto.trim());
            const enunciado = textoSolto ? textoSolto + (partes.resto ? '\n' + partes.resto : '') : partes.resto;
            textoSolto = '';
            questao = { tipo: 'objetiva', fonte: partes.fonte, enunciado: enunciado, alternativas: [], correta: '', numeroOriginal: numero };
            secaoAtual().questoes.push(questao);
            ultimoNumero = numero;
        }

        const linhas = String(texto || '').replace(/\r/g, '').split('\n');
        let linhasBrutas = [];
        linhas.forEach(function (l) { linhasBrutas = linhasBrutas.concat(abrirAlternativasNaLinha(l)); });

        linhasBrutas.forEach(function (bruta) {
            const linha = bruta.replace(/\s+/g, ' ').trim();
            if (!linha) return;

            const resposta = RESPOSTA.exec(linha);
            if (resposta && questao) {
                questao.correta = resposta[1].toUpperCase();
                return;
            }

            const soNumero = SO_NUMERO.exec(linha);
            const inicio = soNumero ? [linha, soNumero[1], ''] : INICIO_QUESTAO.exec(linha);
            if (inicio) {
                const numero = parseInt(inicio[1], 10);
                const seguinte = ultimoNumero === null || numero === ultimoNumero + 1;
                if (seguinte && (inicio[2] || soNumero)) {
                    abrirQuestao(numero, inicio[2] || '');
                    return;
                }
            }

            if (ehTitulo(linha) && (!questao || questao.alternativas.length >= 2)) {
                fecharQuestao();
                secao = { titulo: linha, questoes: [] };
                secoes.push(secao);
                return;
            }

            if (!questao) {
                textoSolto = juntarTexto(textoSolto, linha);
                return;
            }

            const alt = ALTERNATIVA.exec(linha);
            if (alt) {
                const letra = alt[1].toLowerCase();
                const esperada = LETRAS[questao.alternativas.length];
                if (letra === esperada && questao.alternativas.length < maxAlternativas) {
                    questao.alternativas.push(alt[2].trim());
                    return;
                }
                if (letra === 'a' && questao.alternativas.length) {
                    /* era uma lista do enunciado: devolve e recomeça */
                    questao.alternativas.forEach(function (a, i) {
                        questao.enunciado += '\n' + LETRAS[i] + ') ' + a;
                    });
                    questao.enunciado = questao.enunciado.replace(/^\n/, '');
                    questao.alternativas = [alt[2].trim()];
                    return;
                }
            }

            if (questao.alternativas.length) {
                const i = questao.alternativas.length - 1;
                questao.alternativas[i] = juntarTexto(questao.alternativas[i], linha);
            } else {
                questao.enunciado = juntarTexto(questao.enunciado, linha);
            }
        });
        fecharQuestao();
        if (textoSolto) avisos.push('Um trecho de texto no fim não pertence a nenhuma questão e ficou de fora.');

        const vazias = secoes.filter(function (s) { return !s.questoes.length; });
        const cheias = secoes.filter(function (s) { return s.questoes.length; });
        const total = cheias.reduce(function (soma, s) { return soma + s.questoes.length; }, 0);
        if (!total) avisos.push('Nenhuma questão reconhecida. Confira se cada questão começa com o número (01. ou 1.) e as alternativas com a), b), c)…');
        cheias.forEach(function (s) {
            s.questoes.forEach(function (q) {
                if (q.tipo === 'objetiva' && q.alternativas.length !== maxAlternativas) {
                    avisos.push('Questão ' + (q.numeroOriginal || '?') + ': ' + q.alternativas.length + ' alternativas lidas (o formato pede ' + maxAlternativas + ').');
                }
            });
        });
        /* título sem questão no fim (ex.: "BIOLOGIA" colado sozinho) */
        if (vazias.length && !total) return { secoes: [], avisos: avisos, total: 0 };
        return { secoes: cheias, avisos: avisos, total: total };
    }

    const api = { ler: ler, ehTitulo: ehTitulo, separarFonte: separarFonte };

    global.MontarImportar = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
