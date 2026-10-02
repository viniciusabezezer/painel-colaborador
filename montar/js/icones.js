/* Um ícone ilustrativo para cada disciplina, ao lado do título da seção.
   Traço fino, sem preenchimento: ajuda o aluno a se achar na prova e gasta
   quase nada de tinta. O ícone sai sozinho pelo título (BIOLOGIA → folha) e o
   professor pode trocar ou tirar em cada seção. */
(function (global) {
    'use strict';

    const ICONES = {
        portugues: { nome: 'Língua Portuguesa', svg: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>' },
        linguas: { nome: 'Língua estrangeira', svg: '<path d="M3 4h12v9H8l-4 3v-3H3z"/><path d="M15 9h6v8h-1v3l-3-3h-5v-2"/>' },
        arte: { nome: 'Arte', svg: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.2-1-1.6-1-2.6 0-.9.8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>' },
        edfisica: { nome: 'Educação Física', svg: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3.2 3 3.2 15 0 18"/><path d="M12 3c-3.2 3-3.2 15 0 18"/>' },
        biologia: { nome: 'Biologia', svg: '<path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z"/><path d="M5 19l9-9"/>' },
        fisica: { nome: 'Física', svg: '<ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.2"/>' },
        quimica: { nome: 'Química', svg: '<path d="M9 3h6"/><path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>' },
        historia: { nome: 'História', svg: '<path d="M12 3l8 5H4z"/><path d="M4 21h16"/><path d="M5 18h14"/><path d="M7 8v10M12 8v10M17 8v10"/>' },
        geografia: { nome: 'Geografia', svg: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>' },
        filosofia: { nome: 'Filosofia', svg: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>' },
        sociologia: { nome: 'Sociologia', svg: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M15.5 14.6c3 .1 5.5 2.1 5.5 5.4"/>' },
        matematica: { nome: 'Matemática', svg: '<path d="M4 7h6M7 4v6"/><path d="M14 7h6"/><path d="M5 14l4 4M9 14l-4 4"/><path d="M14 15h6M14 18h6"/>' },
        redacao: { nome: 'Redação', svg: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/><path d="M13 20h7"/>' },
        ciencias: { nome: 'Ciências (geral)', svg: '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20"/><path d="M8 10h4M10 8v4"/>' },
        geral: { nome: 'Geral', svg: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>' }
    };

    /* Do título da seção ao ícone. Vale o começo de palavra, sem acento. */
    const REGRAS = [
        [/PORTUGU|LITERATURA|GRAMATIC|LEITURA|INTERPRETA/, 'portugues'],
        [/INGL|ESPANHOL|FRANC|ESTRANGEIRA|ENGLISH/, 'linguas'],
        [/\bARTES?\b/, 'arte'],
        [/EDUCACAO FISICA|ED\. FISICA|ESPORTE/, 'edfisica'],
        [/BIOLOG/, 'biologia'],
        [/FISICA/, 'fisica'],
        [/QUIMIC/, 'quimica'],
        [/HISTORI/, 'historia'],
        [/GEOGRAF/, 'geografia'],
        [/FILOSOF/, 'filosofia'],
        [/SOCIOLOG/, 'sociologia'],
        [/MATEMAT|ALGEBRA|GEOMETRI|ESTATISTIC/, 'matematica'],
        [/REDACA|PRODUCAO TEXTUAL|PRODUCAO DE TEXTO/, 'redacao'],
        [/CIENCIAS/, 'ciencias']
    ];

    function semAcento(t) {
        return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    }

    function detectar(titulo) {
        const t = semAcento(titulo);
        for (const [regra, chave] of REGRAS) if (regra.test(t)) return chave;
        return null;
    }

    /* escolha: 'auto' (pelo título), uma chave, ou 'nenhum' */
    function resolver(escolha, titulo) {
        if (escolha === 'nenhum') return null;
        if (escolha && escolha !== 'auto' && ICONES[escolha]) return escolha;
        return detectar(titulo);
    }

    function svg(chave, classe) {
        const icone = ICONES[chave];
        if (!icone) return '';
        return '<svg class="' + (classe || 'icone-disc') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icone.svg + '</svg>';
    }

    function lista() {
        return Object.keys(ICONES).map(function (k) { return { chave: k, nome: ICONES[k].nome }; });
    }

    const api = { detectar: detectar, resolver: resolver, svg: svg, lista: lista };
    global.MontarIcones = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
