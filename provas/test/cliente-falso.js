/* Um Supabase de mentira para os testes de navegador do Identificador:
   duas contas (uma da gestão, outra de professor) e só o pedaço da API que o
   js/acesso.js usa. Entra pela página antes dos scripts dela
   (addInitScript). window.ACESSO_SESSAO_INICIAL = 'gestao' já abre logado. */
(function () {
    const contas = {
        'gestao@teste.local': { senha: 'senha-gestao', perfil: { id: 'u-gestao', nome: 'Gestão Teste', email: 'gestao@teste.local', papel: 'gestao', ativo: true } },
        'prof@teste.local': { senha: 'senha-prof', perfil: { id: 'u-prof', nome: 'Professor Teste', email: 'prof@teste.local', papel: 'professor', ativo: true } }
    };
    const porId = (id) => Object.values(contas).find((c) => c.perfil.id === id);
    let sessao = null;
    if (window.ACESSO_SESSAO_INICIAL === 'gestao') sessao = { user: { id: 'u-gestao', email: 'gestao@teste.local' } };
    window.IDENTIFICADOR_CLIENTE_FALSO = {
        auth: {
            async getSession() { return { data: { session: sessao } }; },
            async signInWithPassword({ email, password }) {
                const c = contas[email];
                if (!c || c.senha !== password) return { error: { message: 'Invalid login credentials' } };
                sessao = { user: { id: c.perfil.id, email: email } };
                return { error: null };
            },
            async signOut() { sessao = null; return { error: null }; }
        },
        from() {
            const consulta = { id: null };
            return {
                select() { return this; },
                eq(_coluna, valor) { consulta.id = valor; return this; },
                async maybeSingle() { const c = porId(consulta.id); return { data: c ? c.perfil : null, error: null }; }
            };
        }
    };
})();
