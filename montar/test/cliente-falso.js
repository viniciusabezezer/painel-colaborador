/* Cliente de mentira, com a mesma cara do supabase-js na parte que o
   Montador usa. Entra no lugar do Supabase só nos testes (o teste injeta este
   arquivo antes do app) e fala com o servidor de teste por POST /__falso. */
(function () {
    'use strict';
    const CHAVE = 'falso-token';
    const token = () => { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } };

    async function chamar(corpo) {
        const r = await fetch('/__falso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ token: token() }, corpo)) });
        return r.json();
    }

    function consulta(tabela) {
        const q = { tabela: tabela, acao: 'select', filtros: [] };
        const construtor = {
            select: function () { if (q.acao === 'select' || !q.acao) q.acao = q.acao || 'select'; return construtor; },
            eq: function (col, val) { q.filtros.push({ tipo: 'eq', col: col, val: val }); return construtor; },
            in: function (col, val) { q.filtros.push({ tipo: 'in', col: col, val: val }); return construtor; },
            order: function (col, opcoes) { q.ordem = { col: col, asc: !opcoes || opcoes.ascending !== false }; return construtor; },
            maybeSingle: function () { q.unico = 'maybe'; return construtor; },
            single: function () { q.unico = 'single'; return construtor; },
            insert: function (dados) { q.acao = 'insert'; q.dados = dados; return construtor; },
            upsert: function (dados) { q.acao = 'upsert'; q.dados = dados; return construtor; },
            update: function (dados) { q.acao = 'update'; q.dados = dados; return construtor; },
            delete: function () { q.acao = 'delete'; return construtor; },
            then: function (ok, falha) {
                return chamar({ op: 'consulta', q: q }).then(function (r) {
                    return { data: r.data === undefined ? null : r.data, error: r.error || null };
                }, function (erro) { return { data: null, error: { message: 'Failed to fetch: ' + erro.message } }; }).then(ok, falha);
            }
        };
        return construtor;
    }

    const ouvintes = [];
    const cliente = {
        auth: {
            getSession: async function () {
                const t = token();
                return { data: { session: t ? { user: { id: t } } : null } };
            },
            signInWithPassword: async function (dados) {
                try {
                    const r = await chamar({ op: 'login', email: dados.email, senha: dados.password });
                    if (r.error) return { error: r.error };
                    localStorage.setItem(CHAVE, r.data.token);
                    return { error: null };
                } catch (e) { return { error: { message: 'Failed to fetch' } }; }
            },
            signOut: async function () {
                localStorage.removeItem(CHAVE);
                ouvintes.forEach(function (fn) { fn('SIGNED_OUT', null); });
                return { error: null };
            },
            updateUser: async function (dados) {
                const r = await chamar({ op: 'senha', senha: dados.password });
                return { error: r.error || null };
            },
            onAuthStateChange: function (fn) { ouvintes.push(fn); return { data: { subscription: { unsubscribe: function () {} } } }; }
        },
        from: consulta,
        rpc: async function (nome, args) {
            try {
                const r = await chamar({ op: 'rpc', nome: nome, args: args });
                return { data: r.data, error: r.error || null };
            } catch (e) { return { data: null, error: { message: 'Failed to fetch' } }; }
        },
        functions: {
            invoke: async function (nome, opcoes) {
                const r = await chamar({ op: 'funcao', corpo: opcoes.body });
                const d = r.data || {};
                if (d.status && d.status >= 400) {
                    return { data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { json: async function () { return { erro: d.erro }; } } } };
                }
                return { data: d, error: null };
            }
        },
        storage: {
            from: function () {
                return {
                    upload: async function (caminho, blob) {
                        const dataUrl = await new Promise(function (ok) { const l = new FileReader(); l.onload = function () { ok(l.result); }; l.readAsDataURL(blob); });
                        try {
                            const r = await chamar({ op: 'upload', caminho: caminho, dataUrl: dataUrl });
                            return { data: r.data, error: r.error || null };
                        } catch (e) { return { data: null, error: { message: 'Failed to fetch' } }; }
                    },
                    download: async function (caminho) {
                        const r = await chamar({ op: 'download', caminho: caminho });
                        if (r.error) return { data: null, error: r.error };
                        return { data: await (await fetch(r.data)).blob(), error: null };
                    }
                };
            }
        },
        /* "tempo real": confere a versão do servidor a cada meio segundo */
        channel: function () {
            const fns = [];
            let relogio = null;
            let versao = null;
            const canal = {
                on: function (_tipo, _filtro, fn) { fns.push(fn); return canal; },
                subscribe: function () {
                    relogio = setInterval(async function () {
                        try {
                            const r = await chamar({ op: 'versao' });
                            if (versao !== null && r.data !== versao) fns.forEach(function (fn) { fn({}); });
                            versao = r.data;
                        } catch (e) { /* sem rede */ }
                    }, 500);
                    return canal;
                },
                parar: function () { clearInterval(relogio); }
            };
            return canal;
        },
        removeChannel: function (canal) { canal.parar(); }
    };
    window.MONTADOR_CLIENTE_FALSO = cliente;
})();
