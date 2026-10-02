/* Os modelos de prova. Um modelo diz o FORMATO (cabeçalho, instruções,
   folha de respostas, colunas, letra, numeração) e com que seções a prova
   nasce; o conteúdo é sempre do professor.

   - A Avaliação Bimestral Malu é o modelo FIXO: mora aqui no código, não se
     edita nem se apaga, e toda prova feita com ele segue o formato da versão
     atual do app. É a prova que vai depois para o Identificador de Provas.
   - Os demais modelos ficam guardados no navegador e podem ser criados,
     editados e apagados. A Avaliação Parcial vem de exemplo na primeira vez.
   - "Do zero" é uma prova com o formato livre e sem seção nenhuma. */
(function (global) {
    'use strict';

    const CHAVE_MODELOS = 'montar-provas:modelos';
    const CHAVE_SEMEADO = 'montar-provas:semeado';

    const ESCOLA = 'EEMTI PROFESSORA MARIA LUIZA SABOIA RIBEIRO';

    /* As mesmas siglas do Identificador (RED, LIN, NAT, HUM, MAT). */
    const COMPONENTES = {
        LIN: { nome: 'Linguagens e Códigos', sigla: 'L.C.', secoes: ['LÍNGUA PORTUGUESA', 'LÍNGUA INGLESA', 'ARTE', 'EDUCAÇÃO FÍSICA'] },
        NAT: { nome: 'Ciências da Natureza', sigla: 'C.N.', secoes: ['BIOLOGIA', 'FÍSICA', 'QUÍMICA'] },
        HUM: { nome: 'Ciências Humanas', sigla: 'C.H.', secoes: ['HISTÓRIA', 'GEOGRAFIA', 'FILOSOFIA', 'SOCIOLOGIA'] },
        MAT: { nome: 'Matemática', sigla: 'MAT', secoes: ['MATEMÁTICA'] },
        RED: { nome: 'Redação', sigla: 'RED', secoes: ['REDAÇÃO'] }
    };

    const INSTRUCOES_BIMESTRAL = [
        'Esta avaliação deverá ser feita individual e sem consulta;',
        'Todas as respostas deverão ser inseridas à caneta (azul ou preta), **nas folhas de respostas**, devidamente assinadas;',
        'Não será aceita revisão de avaliações feitas a lápis;',
        'O Gabarito deverá estar preenchido à caneta (azul ou preta);',
        '**O descumprimento de qualquer regra acarretará na anulação da avaliação**.'
    ];

    /* Formato livre de partida: o que vale quando um campo não foi dito. */
    const LAYOUT_PADRAO = {
        cabecalho: 'completo',      /* 'faixa' | 'completo' | 'nenhum' */
        faixaCm: 3,                 /* altura da faixa em branco, abaixo da margem de 1 cm */
        instrucoes: false,
        textoInstrucoes: [],
        gabarito: false,            /* folha de respostas com bolhas na 1ª página */
        colunas: 2,
        corpoPt: 10.5,
        alternativas: 5,
        letras: 'a)',               /* 'a)' | 'A)' | '(A)' */
        numeracao: '01.',           /* '01.' | '1.' | 'QUESTÃO 01' */
        linhaColunas: false,
        numeroPagina: true
    };

    const FIXO = {
        id: 'bimestral-malu',
        nome: 'Avaliação Bimestral Malu',
        descricao: 'Modelo padrão da escola. Faixa em branco para o Identificador de Provas, quadro de instruções, gabarito com as marcas de alinhamento na primeira página e duas colunas.',
        fixo: true,
        tituloPadrao: 'Avaliação Bimestral de {componente}',
        secoesIniciais: 'componente',
        layout: {
            cabecalho: 'faixa',
            faixaCm: 3,
            instrucoes: true,
            textoInstrucoes: INSTRUCOES_BIMESTRAL,
            gabarito: true,
            colunas: 2,
            corpoPt: 10.5,
            alternativas: 5,
            letras: 'a)',
            numeracao: '01.',
            linhaColunas: false,
            numeroPagina: true
        }
    };

    const EXEMPLOS = [
        {
            id: 'parcial',
            nome: 'Avaliação Parcial',
            descricao: 'Cabeçalho completo com aluno, turma, data e nota; instruções curtas e duas colunas, sem folha de respostas.',
            tituloPadrao: 'Avaliação Parcial de {disciplina}',
            secoesIniciais: [],
            layout: {
                cabecalho: 'completo',
                instrucoes: true,
                textoInstrucoes: [
                    'Leia com atenção cada questão antes de responder;',
                    'Responda à caneta (azul ou preta);',
                    '**Questões rasuradas serão anuladas.**'
                ],
                gabarito: false,
                colunas: 2,
                corpoPt: 11,
                alternativas: 5,
                letras: 'a)',
                numeracao: '01.',
                linhaColunas: false,
                numeroPagina: true
            }
        }
    ];

    const DO_ZERO = {
        id: 'do-zero',
        nome: 'Prova do zero',
        descricao: 'Formato livre e nenhuma seção pronta: tudo se ajusta na própria prova.',
        tituloPadrao: '',
        secoesIniciais: [],
        layout: LAYOUT_PADRAO
    };

    function copiar(objeto) { return JSON.parse(JSON.stringify(objeto)); }

    function novoId(prefixo) {
        return (prefixo || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    /* Completa um layout guardado com o padrão: modelos antigos continuam
       abrindo quando o app ganha um campo novo. */
    function completarLayout(layout) {
        const pronto = Object.assign(copiar(LAYOUT_PADRAO), copiar(layout || {}));
        pronto.colunas = pronto.colunas === 1 ? 1 : 2;
        pronto.alternativas = Math.max(2, Math.min(5, Number(pronto.alternativas) || 5));
        pronto.corpoPt = Math.max(8, Math.min(14, Number(pronto.corpoPt) || 10.5));
        pronto.faixaCm = Math.max(1, Math.min(8, Number(pronto.faixaCm) || 3));
        if (!Array.isArray(pronto.textoInstrucoes)) pronto.textoInstrucoes = [];
        return pronto;
    }

    /* ----- guarda no navegador ----- */

    function armazenamento() {
        try { return global.localStorage || null; } catch (erro) { return null; }
    }

    let memoria = null; /* quando o navegador não deixa guardar */

    function lerGuardados() {
        const loja = armazenamento();
        if (!loja) return memoria || (memoria = copiar(EXEMPLOS));
        try {
            if (!loja.getItem(CHAVE_SEMEADO)) {
                loja.setItem(CHAVE_MODELOS, JSON.stringify(copiar(EXEMPLOS)));
                loja.setItem(CHAVE_SEMEADO, '1');
            }
            const lidos = JSON.parse(loja.getItem(CHAVE_MODELOS) || '[]');
            return Array.isArray(lidos) ? lidos : [];
        } catch (erro) {
            return memoria || (memoria = copiar(EXEMPLOS));
        }
    }

    function gravar(lista) {
        const loja = armazenamento();
        memoria = lista;
        if (!loja) return;
        try { loja.setItem(CHAVE_MODELOS, JSON.stringify(lista)); } catch (erro) { /* fica na memória */ }
    }

    /* Todos os modelos, o fixo primeiro. Cada um com o layout completo. */
    function listar() {
        return [FIXO].concat(lerGuardados()).map(function (m) {
            const pronto = copiar(m);
            pronto.layout = completarLayout(m.layout);
            return pronto;
        });
    }

    function obter(id) {
        if (id === DO_ZERO.id) return Object.assign(copiar(DO_ZERO), { layout: completarLayout(DO_ZERO.layout) });
        return listar().filter(function (m) { return m.id === id; })[0] || null;
    }

    function salvar(modelo) {
        if (!modelo || modelo.id === FIXO.id || modelo.fixo) throw new Error('O modelo bimestral padrão é fixo e não pode ser alterado.');
        const lista = lerGuardados();
        const limpo = {
            id: modelo.id || novoId('modelo'),
            nome: String(modelo.nome || 'Modelo sem nome').trim(),
            descricao: String(modelo.descricao || '').trim(),
            tituloPadrao: String(modelo.tituloPadrao || ''),
            secoesIniciais: modelo.secoesIniciais === 'componente' ? 'componente' : (modelo.secoesIniciais || []).map(String),
            layout: completarLayout(modelo.layout)
        };
        const i = lista.findIndex(function (m) { return m.id === limpo.id; });
        if (i === -1) lista.push(limpo); else lista[i] = limpo;
        gravar(lista);
        return limpo;
    }

    function apagar(id) {
        if (id === FIXO.id) throw new Error('O modelo bimestral padrão é fixo e não pode ser apagado.');
        gravar(lerGuardados().filter(function (m) { return m.id !== id; }));
    }

    /* ----- a prova ----- */

    function novaQuestao(tipo, alternativas) {
        return {
            id: novoId('q'),
            tipo: tipo === 'discursiva' ? 'discursiva' : 'objetiva',
            fonte: '',
            enunciado: '',
            imagem: null,
            alternativas: tipo === 'discursiva' ? [] : new Array(alternativas || 5).fill(''),
            correta: '',
            linhas: 6
        };
    }

    function novaSecao(titulo) {
        return { id: novoId('s'), titulo: titulo || '', questoes: [] };
    }

    function secoesDoModelo(modelo, componente) {
        if (modelo.secoesIniciais === 'componente') {
            const comp = COMPONENTES[componente];
            return (comp ? comp.secoes : ['']).map(novaSecao);
        }
        const lista = (modelo.secoesIniciais || []).map(novaSecao);
        return lista.length ? lista : [novaSecao('')];
    }

    function criarProva(modelo, dados) {
        dados = dados || {};
        const prova = {
            id: novoId('prova'),
            modeloId: modelo.id,
            modeloNome: modelo.nome,
            fixo: !!modelo.fixo,
            titulo: '',
            serie: dados.serie || '1',
            componente: dados.componente != null ? dados.componente : (modelo.secoesIniciais === 'componente' ? 'NAT' : ''),
            disciplina: dados.disciplina || '',
            bimestre: dados.bimestre || 'B' + bimestreAtual(),
            ano: dados.ano || String(new Date().getFullYear()),
            turma: '',
            professor: '',
            data: '',
            valor: '',
            layout: completarLayout(modelo.layout),
            secoes: [],
            criadaEm: Date.now(),
            atualizadaEm: Date.now()
        };
        prova.secoes = secoesDoModelo(modelo, prova.componente);
        prova.titulo = tituloPadrao(modelo, prova);
        return prova;
    }

    function bimestreAtual() {
        /* fev–abr, mai–jul, ago–out, nov–dez; o professor corrige se precisar */
        const mes = new Date().getMonth(); /* 0 = janeiro */
        if (mes <= 3) return 1;
        if (mes <= 6) return 2;
        if (mes <= 9) return 3;
        return 4;
    }

    function tituloPadrao(modelo, prova) {
        const comp = COMPONENTES[prova.componente];
        return String(modelo.tituloPadrao || '')
            .replace('{componente}', comp ? comp.nome : '')
            .replace('{disciplina}', prova.disciplina || (comp ? comp.nome : ''))
            .replace(/\s+de\s*$/, '')
            .trim();
    }

    /* O formato que vale para a prova: o do modelo fixo, sempre o atual; o
       da própria prova, nos demais. */
    function layoutDaProva(prova) {
        if (prova.fixo && prova.modeloId === FIXO.id) return completarLayout(FIXO.layout);
        return completarLayout(prova.layout);
    }

    /* Desliga a prova do modelo fixo: o formato passa a ser dela e se edita. */
    function tornarLivre(prova) {
        prova.layout = layoutDaProva(prova);
        prova.fixo = false;
        prova.modeloNome = prova.modeloNome + ' (cópia livre)';
        return prova;
    }

    /* Modelo novo a partir de uma prova: formato e nomes das seções, sem as
       questões. */
    function modeloDaProva(prova, nome) {
        return {
            nome: nome,
            descricao: 'Criado a partir da prova "' + (prova.titulo || 'sem título') + '".',
            tituloPadrao: '',
            secoesIniciais: prova.secoes.map(function (s) { return s.titulo; }).filter(Boolean),
            layout: layoutDaProva(prova)
        };
    }

    /* ----- números e letras ----- */

    const LETRAS = 'ABCDE';

    function letra(indice, estilo) {
        const l = LETRAS[indice];
        if (estilo === 'A)') return l + ')';
        if (estilo === '(A)') return '(' + l + ')';
        return l.toLowerCase() + ')';
    }

    function numero(n, estilo) {
        const dois = (n < 10 ? '0' : '') + n;
        if (estilo === '1.') return n + '.';
        if (estilo === 'QUESTÃO 01') return 'QUESTÃO ' + dois;
        return dois + '.';
    }

    function nomeSerie(serie) {
        return serie ? serie + 'ª SÉRIE' : '';
    }

    /* Nome do PDF sugerido na hora de imprimir, no padrão do Identificador. */
    function nomeArquivo(prova) {
        const partes = ['PROVA', prova.ano, prova.bimestre];
        if (prova.serie) partes.push(prova.serie + (prova.turma ? String(prova.turma).toUpperCase() : 'S'));
        partes.push(prova.fixo ? prova.componente : (semAcento(prova.disciplina || prova.componente || '').toUpperCase().replace(/[^A-Z0-9]+/g, '') || 'PROVA'));
        return partes.filter(Boolean).join('-');
    }

    function semAcento(texto) {
        return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    /* Todas as questões em ordem, com o número que levam na prova. */
    function questoesNumeradas(prova) {
        const lista = [];
        prova.secoes.forEach(function (secao) {
            secao.questoes.forEach(function (q) {
                lista.push({ numero: lista.length + 1, questao: q, secao: secao });
            });
        });
        return lista;
    }

    /* O que falta ou está estranho, para avisar antes de imprimir. */
    function pendencias(prova) {
        const avisos = [];
        const layout = layoutDaProva(prova);
        questoesNumeradas(prova).forEach(function (item) {
            const q = item.questao;
            const n = numero(item.numero, '01.').replace('.', '');
            if (!String(q.enunciado || '').trim() && !q.imagem) avisos.push('Questão ' + n + ' sem enunciado.');
            if (q.tipo === 'objetiva') {
                const vazias = q.alternativas.slice(0, layout.alternativas).filter(function (a) { return !String(a || '').trim(); }).length;
                if (vazias) avisos.push('Questão ' + n + ': ' + vazias + (vazias > 1 ? ' alternativas vazias.' : ' alternativa vazia.'));
                if (!q.correta) avisos.push('Questão ' + n + ' sem a resposta certa marcada (só faz falta no gabarito do professor).');
            }
        });
        return avisos;
    }

    const api = {
        ESCOLA: ESCOLA,
        COMPONENTES: COMPONENTES,
        FIXO_ID: FIXO.id,
        DO_ZERO_ID: DO_ZERO.id,
        LAYOUT_PADRAO: LAYOUT_PADRAO,
        listar: listar,
        obter: obter,
        salvar: salvar,
        apagar: apagar,
        completarLayout: completarLayout,
        criarProva: criarProva,
        novaQuestao: novaQuestao,
        novaSecao: novaSecao,
        secoesDoModelo: secoesDoModelo,
        tituloPadrao: tituloPadrao,
        layoutDaProva: layoutDaProva,
        tornarLivre: tornarLivre,
        modeloDaProva: modeloDaProva,
        letra: letra,
        numero: numero,
        nomeSerie: nomeSerie,
        nomeArquivo: nomeArquivo,
        questoesNumeradas: questoesNumeradas,
        pendencias: pendencias,
        novoId: novoId,
        copiar: copiar
    };

    global.MontarModelos = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
