/* O perfil da escola. É o que torna a Saga adaptável: qualquer escola
   estadual do Ceará troca nome, CREDE, tipo, turmas, PDTs e moeda na aba
   Escola, sem mexer em código. A EEMTI MALU vem como modelo de partida. */
(function (global) {
    'use strict';

    const CREDES = [
        'CREDE 1 — Maracanaú', 'CREDE 2 — Itapipoca', 'CREDE 3 — Acaraú', 'CREDE 4 — Camocim',
        'CREDE 5 — Tianguá', 'CREDE 6 — Sobral', 'CREDE 7 — Canindé', 'CREDE 8 — Baturité',
        'CREDE 9 — Horizonte', 'CREDE 10 — Russas', 'CREDE 11 — Jaguaribe', 'CREDE 12 — Quixadá',
        'CREDE 13 — Crateús', 'CREDE 14 — Senador Pompeu', 'CREDE 15 — Tauá', 'CREDE 16 — Iguatu',
        'CREDE 17 — Icó', 'CREDE 18 — Crato', 'CREDE 19 — Juazeiro do Norte', 'CREDE 20 — Brejo Santo',
        'SEFOR 1 — Fortaleza', 'SEFOR 2 — Fortaleza', 'SEFOR 3 — Fortaleza'
    ];

    const TIPOS = [
        { id: 'EEMTI', nome: 'EEMTI — Ensino Médio em Tempo Integral' },
        { id: 'EEEP', nome: 'EEEP — Educação Profissional' },
        { id: 'EEM', nome: 'EEM — Ensino Médio regular' }
    ];

    const MALU = {
        nome: 'EEMTI Profa. Maria Luíza Saboia Ribeiro',
        sigla: 'MALU',
        municipio: 'Paracuru',
        crede: 'CREDE 2 — Itapipoca',
        tipo: 'EEMTI',
        turmas: ['1ª A', '1ª B', '1ª C', '2ª A', '2ª B', '2ª C', '3ª A', '3ª B'],
        pdts: {
            '1ª A': 'Simone B', '1ª B': 'Sandra', '1ª C': 'Simone A', '2ª A': 'Jannaina',
            '2ª B': 'Neyla', '2ª C': 'Paulo', '3ª A': 'Tony', '3ª B': 'Talita'
        },
        areas: [
            { nome: 'Matemática', pca: 'Ulysses' },
            { nome: 'Ciências da Natureza', pca: 'Sullivan' },
            { nome: 'Ciências Humanas', pca: 'Nadja' },
            { nome: 'Linguagens e Códigos', pca: 'Juliana' }
        ],
        moeda: { nome: 'Ouro', simbolo: '🪙' },
        ocorrenciasUrl: 'https://forms.gle/2Rbqkx6xHxqc1zy37'
    };

    const GENERICA = {
        nome: 'Minha escola',
        sigla: '',
        municipio: '',
        crede: CREDES[0],
        tipo: 'EEM',
        turmas: ['1ª A', '2ª A', '3ª A'],
        pdts: {},
        areas: [
            { nome: 'Matemática', pca: '' },
            { nome: 'Ciências da Natureza', pca: '' },
            { nome: 'Ciências Humanas', pca: '' },
            { nome: 'Linguagens e Códigos', pca: '' }
        ],
        moeda: { nome: 'Ouro', simbolo: '🪙' },
        ocorrenciasUrl: ''
    };

    function copiar(x) { return JSON.parse(JSON.stringify(x)); }

    function perfilPadrao(modelo) {
        return copiar(modelo === 'generica' ? GENERICA : MALU);
    }

    /* "1a A", "1ºA", "1ª a" → "1ª A". Deixa como veio o que não reconhece
       (EEEP às vezes nomeia a turma pelo curso). */
    function normalizarTurma(texto) {
        const t = String(texto || '').trim().replace(/\s+/g, ' ');
        const m = t.match(/^([1-4])\s*[ªaº°o]?\s*(?:s[ée]rie|ano)?\s*([A-Za-z])$/i);
        if (m) return `${m[1]}ª ${m[2].toUpperCase()}`;
        return t;
    }

    function lerTurmas(texto) {
        const vistas = new Set();
        const turmas = [];
        for (const parte of String(texto || '').split(/[\n,;]+/)) {
            const t = normalizarTurma(parte);
            if (t && !vistas.has(t)) { vistas.add(t); turmas.push(t); }
        }
        return turmas;
    }

    function validar(perfil) {
        const erros = [];
        if (!perfil || typeof perfil !== 'object') return ['Perfil vazio.'];
        if (!String(perfil.nome || '').trim()) erros.push('Dê um nome à escola.');
        if (!Array.isArray(perfil.turmas) || !perfil.turmas.length) erros.push('Cadastre ao menos uma turma.');
        if (!TIPOS.some((t) => t.id === perfil.tipo)) erros.push('Escolha o tipo de escola.');
        if (!perfil.moeda || !String(perfil.moeda.nome || '').trim()) erros.push('Dê um nome à moeda.');
        return erros;
    }

    /* Rótulo curto para o topo da tela: "MALU · Paracuru · CREDE 2". */
    function rotulo(perfil) {
        const crede = String(perfil.crede || '').split(' — ')[0];
        return [perfil.sigla || perfil.nome, perfil.municipio, crede].filter(Boolean).join(' · ');
    }

    const api = { CREDES, TIPOS, perfilPadrao, normalizarTurma, lerTurmas, validar, rotulo };

    global.SagaEscola = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
