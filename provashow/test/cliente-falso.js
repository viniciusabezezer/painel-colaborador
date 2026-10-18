/* O cliente do Supabase de mentira (teste de navegador): entra no lugar de
   vendor/supabase.js e conversa com supabase-falso.mjs por POST /__falso.
   Imita só o que o ProvaShow usa: auth (sessão guardada no storage
   escolhido, login, sair, trocar senha), from().select/eq/gt/in/order/range/
   maybeSingle, upsert, e canais de tempo real que nunca conectam (a aula
   segue pelo canal local do navegador). */
(function () {
    'use strict';

    async function falar(corpo) {
        const r = await fetch('/__falso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
        return r.json();
    }

    function createClient(url, chave, opcoes) {
        const a = (opcoes && opcoes.auth) || {};
        const guarda = a.storage || window.localStorage;
        const chaveSessao = a.storageKey || 'sb-falso';
        const sessao = () => { try { return JSON.parse(guarda.getItem(chaveSessao) || 'null'); } catch (e) { return null; } };
        const token = () => (sessao() || {}).access_token;

        const auth = {
            async getSession() { return { data: { session: a.persistSession === false ? null : sessao() }, error: null }; },
            async signInWithPassword({ email, password }) {
                const r = await falar({ acao: 'login', email, senha: password });
                if (r.error) return { data: {}, error: r.error };
                if (a.persistSession !== false) guarda.setItem(chaveSessao, JSON.stringify(r.data.session));
                return { data: r.data, error: null };
            },
            async signOut() { guarda.removeItem(chaveSessao); return { error: null }; },
            async updateUser({ password }) { const r = await falar({ acao: 'senha', token: token(), senha: password }); return { data: r.data, error: r.error || null }; },
            onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }
        };

        function from(tabela) {
            const q = { tabela, filtros: { eq: [], gt: [], in: [] }, colunas: '*', unico: false };
            const consulta = {
                select(c) { q.colunas = c; return consulta; },
                eq(c, v) { q.filtros.eq.push([c, v]); return consulta; },
                gt(c, v) { q.filtros.gt.push([c, v]); return consulta; },
                in(c, vs) { q.filtros.in.push([c, vs]); return consulta; },
                order(c, o) { q.filtros.order = [c, !o || o.ascending !== false]; return consulta; },
                range(i, f) { q.filtros.range = [i, f]; return consulta; },
                maybeSingle() { q.unico = true; return consulta; },
                then(ok, falha) {
                    return falar({ acao: 'select', token: token(), tabela, colunas: q.colunas, filtros: q.filtros }).then((r) => {
                        if (r.error) return { data: null, error: r.error };
                        return { data: q.unico ? (r.data[0] || null) : r.data, error: null };
                    }).then(ok, falha);
                },
                upsert(linhas) {
                    return { then(ok, falha) { return falar({ acao: 'upsert', token: token(), tabela, linhas: [].concat(linhas) }).then((r) => ({ data: r.data, error: r.error || null })).then(ok, falha); } };
                }
            };
            return consulta;
        }

        function channel() {
            const c = { on() { return c; }, subscribe(cb) { setTimeout(() => cb && cb('CHANNEL_ERROR'), 10); return c; }, send() { return Promise.resolve('error'); } };
            return c;
        }

        return { auth, from, channel, removeChannel() {} };
    }

    window.supabase = { createClient };
})();
