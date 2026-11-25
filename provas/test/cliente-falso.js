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
        from(tabela) {
            /* as provas que o Montador já travou (e uma aberta e uma de formato livre,
               que o Identificador tem de deixar de fora) */
            if (tabela === 'montador_provas') {
                const filtros = [];
                const construtor = {
                    select() { return construtor; },
                    eq(coluna, valor) { filtros.push([coluna, valor]); return construtor; },
                    order() { return construtor; },
                    then(ok, falha) {
                        const todas = window.PROVAS_DO_MONTADOR_FALSAS || PROVAS_PADRAO;
                        const linhas = todas.filter((p) => filtros.every(([c, v]) => p[c] === v));
                        return Promise.resolve({ data: JSON.parse(JSON.stringify(linhas)), error: null }).then(ok, falha);
                    }
                };
                return construtor;
            }
            const consulta = { id: null };
            return {
                select() { return this; },
                eq(_coluna, valor) { consulta.id = valor; return this; },
                async maybeSingle() { const c = porId(consulta.id); return { data: c ? c.perfil : null, error: null }; }
            };
        },
        functions: {
            /* o Malu Presente, pela função presente-listas: com "turma", só ela */
            async invoke(nome, { body }) {
                if (nome !== 'presente-listas' || body.acao !== 'listas') return { data: { erro: 'ação desconhecida' }, error: null };
                const todas = window.TURMAS_DO_PRESENTE_FALSAS || TURMAS_PADRAO;
                const curta = (t) => { const m = String(t || '').toUpperCase().match(/([123]).*?([A-F])/); return m ? m[1] + m[2] : String(t); };
                const turmas = todas.filter((t) => !body.turma || curta(t.turma) === curta(body.turma));
                window.PEDIDOS_AO_PRESENTE = (window.PEDIDOS_AO_PRESENTE || []).concat([{ turma: body.turma || null, ano: body.ano }]);
                return { data: { ano: body.ano, turmas: JSON.parse(JSON.stringify(turmas)) }, error: null };
            }
        }
    };

    const PROVAS_PADRAO = [
        { id: '8f3a2c1d-5b6e-4a77-9c10-aabbccddeeff', titulo: 'Avaliação Bimestral de Linguagens e Códigos', componente: 'LIN', serie: '1', bimestre: 'B3', ano: '2026', situacao: 'travada', atualizada_em: '2026-09-20T12:00:00Z' },
        { id: '11112222-5b6e-4a77-9c10-aabbccddeeff', titulo: 'Avaliação Bimestral de Ciências da Natureza', componente: 'NAT', serie: '1', bimestre: 'B3', ano: '2026', situacao: 'travada', atualizada_em: '2026-09-21T12:00:00Z' },
        { id: '33334444-5b6e-4a77-9c10-aabbccddeeff', titulo: 'Avaliação Bimestral de Linguagens e Códigos', componente: 'LIN', serie: '2', bimestre: 'B3', ano: '2026', situacao: 'travada', atualizada_em: '2026-09-22T12:00:00Z' },
        { id: '55556666-5b6e-4a77-9c10-aabbccddeeff', titulo: 'Avaliação do 2º bimestre', componente: 'LIN', serie: '1', bimestre: 'B2', ano: '2026', situacao: 'travada', atualizada_em: '2026-06-10T12:00:00Z' },
        { id: '99990000-5b6e-4a77-9c10-aabbccddeeff', titulo: 'Ainda aberta', componente: 'MAT', serie: '1', bimestre: 'B3', ano: '2026', situacao: 'aberta', atualizada_em: '2026-09-23T12:00:00Z' },
        { id: 'aaaa0000-5b6e-4a77-9c10-aabbccddeeff', titulo: 'Prova de formato livre', componente: 'LIN', serie: null, bimestre: 'B3', ano: '2026', situacao: 'travada', atualizada_em: '2026-09-24T12:00:00Z' }
    ];
    const TURMAS_PADRAO = [
        { turma: '1ºA', alunos: [{ numero: 1, nome: 'Ana Beatriz Lima de Souza', matricula: '20260001', ativo: true }, { numero: 2, nome: 'Bruno Dias', matricula: '20260002', ativo: true }, { numero: 3, nome: 'José Ítalo Gonçalves da Conceição', matricula: '20260003', ativo: true }] },
        { turma: '1ºB', alunos: [{ numero: 1, nome: 'Carla Mendes', matricula: '20260011', ativo: true }, { numero: 2, nome: 'Daniel Souza', matricula: '20260012', ativo: true }] },
        { turma: '2ºA', alunos: [{ numero: 1, nome: 'Eva Prado', matricula: '20260021', ativo: true }, { numero: 2, nome: 'Fábio Reis', matricula: '20260022', ativo: true }] }
    ];
})();
