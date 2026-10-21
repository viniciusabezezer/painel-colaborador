/* Onde os dados moram: no próprio aparelho (localStorage), como nos outros
   apps da Malu. Sem internet, funciona igual. O backup é um arquivo .json
   com o perfil da escola, as regras e TODOS os eventos — serve para levar
   para outro aparelho ou para juntar o trabalho de dois professores. */
(function (global) {
    'use strict';

    const CHAVE = 'saga:dados:v1';
    const FORMATO = 'saga-backup';

    function vazio() {
        return { perfil: null, regras: null, eventos: [], professor: '', turma: '', semeado: false };
    }

    function carregar(armazenamento) {
        const ls = armazenamento || global.localStorage;
        try {
            const bruto = ls && ls.getItem(CHAVE);
            if (!bruto) return vazio();
            return Object.assign(vazio(), JSON.parse(bruto));
        } catch (erro) {
            return vazio();
        }
    }

    /* Devolve null quando deu certo, ou a mensagem do problema. */
    function salvar(dados, armazenamento) {
        const ls = armazenamento || global.localStorage;
        try {
            ls.setItem(CHAVE, JSON.stringify(dados));
            return null;
        } catch (erro) {
            return 'Não deu para salvar neste aparelho (o espaço pode ter acabado). Faça um backup na aba Escola.';
        }
    }

    function paraBackup(dados, agora) {
        return {
            formato: FORMATO, versao: 1,
            geradoEm: (agora ? new Date(agora) : new Date()).toISOString(),
            professor: dados.professor || '',
            perfil: dados.perfil, regras: dados.regras, eventos: dados.eventos
        };
    }

    /* Lê um backup. Devolve { backup } ou { erro }. */
    function lerBackup(texto) {
        let b;
        try { b = JSON.parse(texto); } catch (erro) { return { erro: 'O arquivo não é um backup da Saga (JSON inválido).' }; }
        if (!b || b.formato !== FORMATO || !Array.isArray(b.eventos)) return { erro: 'O arquivo não é um backup da Saga.' };
        return { backup: b };
    }

    const api = { CHAVE, vazio, carregar, salvar, paraBackup, lerBackup };

    global.SagaArmazem = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
