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

    /* As fontes oferecidas. Todas existem no Windows e no Mac; no Linux e no
       Android entram as equivalentes de mesma medida (Liberation, Tinos,
       Carlito), para a paginação não mudar de um computador para outro. */
    const FONTES = {
        times: { nome: 'Times New Roman', css: '"Times New Roman", Times, "Liberation Serif", Tinos, serif' },
        arial: { nome: 'Arial', css: 'Arial, "Liberation Sans", Arimo, Helvetica, sans-serif' },
        calibri: { nome: 'Calibri', css: 'Calibri, Carlito, "Segoe UI", sans-serif' },
        cambria: { nome: 'Cambria', css: 'Cambria, Caladea, Georgia, serif' },
        georgia: { nome: 'Georgia', css: 'Georgia, "DejaVu Serif", serif' }
    };

    /* O que toda prova ajusta, inclusive a do modelo fixo: a aparência do
       texto e o que entra ou não na folha. O resto do formato é do modelo. */
    const AJUSTAVEIS = ['fonte', 'corpoPt', 'espacamento', 'gabarito', 'gabaritoOrigem', 'gabaritoLocal', 'icones', 'imagensCinza', 'linhaColunas',
        'instrucoes', 'textoInstrucoes', 'margemCm'];

    /* Margens: a mais estreita que as impressoras costumam aceitar é o padrão
       (a área que elas não alcançam fica em torno de 4 mm). */
    const MARGENS = [[0.5, '0,5 cm — mínima (padrão)'], [0.8, '0,8 cm — estreita'], [1, '1 cm'], [1.5, '1,5 cm — larga']];

    /* Instruções que os professores costumam acrescentar: um clique põe a
       linha no quadro. */
    const SUGESTOES_INSTRUCOES = [
        'Duração da avaliação: 2 horas;',
        'Não é permitido o uso de calculadora;',
        'É permitido o uso de calculadora;',
        'Desligue o celular e guarde-o na mochila;',
        'Leia com atenção cada questão antes de responder;',
        'Nas questões discursivas, mostre os cálculos;',
        'Questões rasuradas serão anuladas;',
        'Escreva com letra legível;'
    ];

    /* Formato livre de partida: o que vale quando um campo não foi dito. */
    const LAYOUT_PADRAO = {
        fonte: 'times',             /* Times New Roman 10 é o padrão da escola */
        margemCm: 0.5,              /* margem da folha: a mínima, para caber mais em cada página */
        espacamento: 'normal',      /* 'compacto' | 'normal' | 'amplo' */
        icones: true,               /* ícone da disciplina ao lado do título da seção */
        imagensCinza: true,         /* figuras em tons de cinza: economiza tinta */
        cabecalho: 'completo',      /* 'faixa' | 'completo' | 'nenhum' */
        faixaCm: 2.5,               /* altura da faixa em branco da identificação, a 0,6 cm do alto */
        instrucoes: false,
        textoInstrucoes: [],
        gabarito: false,            /* folha de respostas com bolhas */
        gabaritoOrigem: 'gerado',   /* 'gerado' pelo app | 'imagem' enviada pelo professor */
        gabaritoLocal: 'prova',     /* 'prova' (1ª coluna da 1ª página) | 'separado' (4 por folha A4) */
        colunas: 2,
        corpoPt: 10,
        alternativas: 5,
        letras: 'a)',               /* 'a)' | 'A)' | '(A)' */
        numeracao: '01.',           /* '01.' | '1.' | 'QUESTÃO 01' */
        linhaColunas: true,         /* fio entre as colunas: guia a leitura e não pesa na tinta */
        numeroPagina: true
    };

    const FIXO = {
        id: 'bimestral-malu',
        nome: 'Avaliação Bimestral Malu',
        descricao: 'Modelo padrão da escola. Espaço de 2,5 cm para a identificação (cabeçalho do Identificador, com o brasão), quadro de instruções editável, gabarito com as marcas de alinhamento e duas colunas.',
        fixo: true,
        tituloPadrao: 'Avaliação Bimestral de {componente}',
        secoesIniciais: 'componente',
        layout: {
            cabecalho: 'faixa',
            faixaCm: 2.5,
            margemCm: 0.5,
            instrucoes: true,
            textoInstrucoes: INSTRUCOES_BIMESTRAL,
            gabarito: true,
            colunas: 2,
            fonte: 'times',
            corpoPt: 10,
            espacamento: 'normal',
            icones: true,
            imagensCinza: true,
            alternativas: 5,
            letras: 'a)',
            numeracao: '01.',
            linhaColunas: true,
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
                fonte: 'times',
                corpoPt: 10,
                alternativas: 5,
                letras: 'a)',
                numeracao: '01.',
                linhaColunas: true,
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
        pronto.corpoPt = Math.max(8, Math.min(14, Number(pronto.corpoPt) || 10));
        if (!FONTES[pronto.fonte]) pronto.fonte = 'times';
        if (['compacto', 'normal', 'amplo'].indexOf(pronto.espacamento) === -1) pronto.espacamento = 'normal';
        if (pronto.gabaritoOrigem !== 'imagem') pronto.gabaritoOrigem = 'gerado';
        if (pronto.gabaritoLocal !== 'separado') pronto.gabaritoLocal = 'prova';
        pronto.faixaCm = Math.max(1, Math.min(8, Number(pronto.faixaCm) || 2.5));
        pronto.margemCm = Math.max(0.4, Math.min(2.5, Number(pronto.margemCm) || 0.5));
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
        const t = tipo === 'discursiva' || tipo === 'texto' ? tipo : 'objetiva';
        return {
            id: novoId('q'),
            tipo: t,
            fonte: '',
            enunciado: '',
            imagens: [],
            alternativas: t === 'objetiva' ? new Array(alternativas || 5).fill('') : [],
            altImagens: [],
            disposicao: 'auto',      /* alternativas: 'auto' | 'lista' | 'duas' | 'linha' */
            correta: '',
            linhas: 6
        };
    }

    /* Provas guardadas por versões antigas do app: uma imagem só (q.imagem)
       vira a lista de imagens; campos novos ganham o valor padrão. */
    function normalizarQuestao(q) {
        if (!Array.isArray(q.imagens)) q.imagens = [];
        if (q.imagem) {
            q.imagens.push(Object.assign({ id: novoId('img'), posicao: 'abaixo' }, q.imagem));
            delete q.imagem;
        }
        q.imagens.forEach(function (img) {
            if (!img.id) img.id = novoId('img');
            if (!img.posicao) img.posicao = 'abaixo';
            img.largura = Math.max(15, Math.min(100, Number(img.largura) || 100));
        });
        if (!Array.isArray(q.alternativas)) q.alternativas = [];
        if (!Array.isArray(q.altImagens)) q.altImagens = [];
        if (!q.disposicao) q.disposicao = 'auto';
        if (q.linhas == null) q.linhas = 6;
        return q;
    }

    function normalizarProva(prova) {
        prova.secoes = Array.isArray(prova.secoes) && prova.secoes.length ? prova.secoes : [novaSecao('')];
        prova.secoes.forEach(function (s) {
            if (!s.id) s.id = novoId('s');
            if (!s.icone) s.icone = 'auto';
            s.questoes = (s.questoes || []).map(normalizarQuestao);
        });
        if (!prova.ajustes) prova.ajustes = escolher(completarLayout(prova.fixo ? FIXO.layout : prova.layout), AJUSTAVEIS);
        return prova;
    }

    function escolher(objeto, chaves) {
        const saida = {};
        chaves.forEach(function (k) { if (objeto && objeto[k] !== undefined) saida[k] = objeto[k]; });
        return saida;
    }

    function novaSecao(titulo) {
        return { id: novoId('s'), titulo: titulo || '', icone: 'auto', questoes: [] };
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
        prova.ajustes = escolher(prova.layout, AJUSTAVEIS);
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
        const base = (prova.fixo && prova.modeloId === FIXO.id) ? FIXO.layout : prova.layout;
        return completarLayout(Object.assign({}, base, escolher(prova.ajustes, AJUSTAVEIS)));
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

    /* ----- versão B ----- */

    /* Alternativas que dependem da posição ("todas as anteriores", "nenhuma
       das alternativas", "NDA", "a e b estão corretas") não podem trocar de
       lugar: a questão fica na ordem original. */
    const PRESA_A_ORDEM = /anterior|nenhuma d|todas as|\bnda\b|\b[a-e]\s*(,|e)\s*[a-e]\b|\b[a-e]\)\s*e\s*[a-e]\)|apenas\s+[a-e]\b/i;

    function embaralhar(lista, aleatorio) {
        const copia = lista.slice();
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(aleatorio() * (i + 1));
            const t = copia[i]; copia[i] = copia[j]; copia[j] = t;
        }
        return copia;
    }

    /* Uma cópia da prova com as alternativas em outra ordem (a resposta certa
       acompanha). As questões continuam na mesma ordem, para o texto de apoio
       e o "Leia o texto para as questões 3 e 4" continuarem valendo. */
    function versaoEmbaralhada(prova, rotulo, aleatorio) {
        aleatorio = aleatorio || Math.random;
        const nova = copiar(prova);
        const n = layoutDaProva(prova).alternativas;
        const presas = [];
        nova.id = novoId('prova');
        nova.titulo = (prova.titulo || 'Prova') + ' — Tipo ' + (rotulo || 'B');
        nova.criadaEm = Date.now();
        questoesNumeradas(nova).forEach(function (item) {
            const q = item.questao;
            if (q.tipo !== 'objetiva') return;
            const textos = q.alternativas.slice(0, n);
            if (textos.some(function (a) { return PRESA_A_ORDEM.test(a || ''); })) { presas.push(item.numero); return; }
            const ordem = textos.map(function (_, i) { return i; });
            let nova0 = embaralhar(ordem, aleatorio);
            /* sem embaralhar de mentira: se saiu igual, gira uma casa */
            if (nova0.every(function (v, i) { return v === i; })) nova0 = ordem.slice(1).concat(ordem[0]);
            const certaAntes = q.correta ? 'ABCDE'.indexOf(q.correta) : -1;
            q.alternativas = nova0.map(function (i) { return q.alternativas[i] || ''; }).concat(q.alternativas.slice(n));
            q.altImagens = nova0.map(function (i) { return (q.altImagens || [])[i] || null; });
            if (certaAntes >= 0) q.correta = 'ABCDE'[nova0.indexOf(certaAntes)];
        });
        return { prova: nova, presas: presas };
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
                if (q.tipo === 'texto') return; /* texto de apoio não tem número */
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
            if (!String(q.enunciado || '').trim() && !(q.imagens || []).length) avisos.push('Questão ' + n + ' sem enunciado.');
            if (q.tipo === 'objetiva') {
                const vazias = q.alternativas.slice(0, layout.alternativas).filter(function (a, i) {
                    return !String(a || '').trim() && !(q.altImagens && q.altImagens[i]);
                }).length;
                if (vazias) avisos.push('Questão ' + n + ': ' + vazias + (vazias > 1 ? ' alternativas vazias.' : ' alternativa vazia.'));
                if (!q.correta) avisos.push('Questão ' + n + ' sem a resposta certa marcada (só faz falta no gabarito do professor).');
            }
        });
        if (layout.gabarito && layout.gabaritoOrigem === 'imagem' && !(prova.gabaritoImagem && prova.gabaritoImagem.src)) {
            avisos.unshift('O gabarito está como "imagem enviada por mim", mas nenhuma imagem foi escolhida: por enquanto sai o gerado pelo app.');
        }
        return avisos;
    }

    const api = {
        ESCOLA: ESCOLA,
        FONTES: FONTES,
        AJUSTAVEIS: AJUSTAVEIS,
        SUGESTOES_INSTRUCOES: SUGESTOES_INSTRUCOES,
        MARGENS: MARGENS,
        INSTRUCOES_BIMESTRAL: INSTRUCOES_BIMESTRAL,
        normalizarQuestao: normalizarQuestao,
        normalizarProva: normalizarProva,
        versaoEmbaralhada: versaoEmbaralhada,
        escolher: escolher,
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
