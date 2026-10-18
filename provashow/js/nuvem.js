/* A nuvem da escola: login e cópia de tudo no Supabase.

   Login: as mesmas contas do Montador de Provas (criadas pela gestão, na
   tela Professores do Montador). Só entra quem tem perfil ativo. A senha é
   conferida pelo Supabase Auth (nunca passa por este código além do envio
   pela conexão segura); a sessão fica guardada no aparelho — ou só até
   fechar o navegador, se o professor desmarcar "lembrar neste aparelho".

   Sincronização: cada item (pasta, conjunto, pacote, turma, aula, sessão,
   ajustes) vira uma linha em provashow_itens. Sobe o que mudou desde a última
   vez; desce o que mudou no servidor (por qualquer aparelho do professor);
   junta com Dados.mesclar (vence a alteração mais nova). Sem internet, o app
   segue com a cópia do aparelho e sobe tudo quando a conexão volta.
   As regras do banco (supabase/001_provashow.sql) garantem que cada um só
   mexe no que é seu e que nada é apagado de verdade. */
(function (global) {
    'use strict';

    const TABELA = 'provashow_itens';
    const LISTAS = { pasta: 'pastas', conjunto: 'conjuntos', pacote: 'pacotes', turma: 'turmas', aula: 'aulas', sessao: 'sessoes' };
    const CHAVE_LEMBRAR = 'provashow-lembrar';
    const CHAVE_PERFIL = 'provashow-perfil';

    function lembrar() {
        try { return global.localStorage.getItem(CHAVE_LEMBRAR) !== 'nao'; } catch (e) { return true; }
    }

    /* A sessão vai para o localStorage (lembrar) ou para o sessionStorage
       (some ao fechar o navegador — computador compartilhado). */
    const guardaSessao = {
        getItem: (k) => { try { return global.sessionStorage.getItem(k) || global.localStorage.getItem(k); } catch (e) { return null; } },
        setItem: (k, v) => {
            try {
                if (lembrar()) { global.localStorage.setItem(k, v); global.sessionStorage.removeItem(k); }
                else { global.sessionStorage.setItem(k, v); global.localStorage.removeItem(k); }
            } catch (e) { /* sem armazenamento */ }
        },
        removeItem: (k) => { try { global.localStorage.removeItem(k); global.sessionStorage.removeItem(k); } catch (e) { /* nada */ } }
    };

    let cliente = null;
    function obterCliente() {
        const cfg = global.PROVASHOW_NUVEM;
        if (!cfg || !global.supabase || !global.supabase.createClient) return null;
        if (!cliente) {
            cliente = global.supabase.createClient(cfg.url, cfg.chave, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'provashow-sessao', storage: guardaSessao },
                realtime: { params: { eventsPerSecond: 20 } }
            });
            /* o canal da aula usa o mesmo cliente */
            global.ProvaShowCliente = cliente;
        }
        return cliente;
    }

    let usuario = null;
    let perfil = null;

    function guardarPerfil(p) {
        try { if (p) global.localStorage.setItem(CHAVE_PERFIL, JSON.stringify(p)); else global.localStorage.removeItem(CHAVE_PERFIL); } catch (e) { /* nada */ }
    }

    async function buscarPerfil(id) {
        const { data, error } = await obterCliente().from('montador_perfis').select('id, nome, email, papel, area, ativo').eq('id', id).maybeSingle();
        if (error) throw error;
        return data;
    }

    function erroDeRede(e) {
        return !global.navigator.onLine || /fetch|network|Failed to fetch|NetworkError|timeout/i.test(String(e && (e.message || e)));
    }

    /* Ao abrir o app: há sessão guardada? Sem internet, confia na sessão e no
       perfil guardados no aparelho. */
    async function iniciar() {
        const c = obterCliente();
        if (!c) return null;
        const { data } = await c.auth.getSession();
        if (!data || !data.session) return null;
        usuario = data.session.user;
        try {
            perfil = await buscarPerfil(usuario.id);
            if (!perfil || !perfil.ativo) { await sair(); return null; }
            guardarPerfil(perfil);
        } catch (e) {
            if (!erroDeRede(e)) throw e;
            try { perfil = JSON.parse(global.localStorage.getItem(CHAVE_PERFIL) || 'null'); } catch (x) { perfil = null; }
            if (!perfil || perfil.id !== usuario.id) return null;
        }
        return { usuario, perfil };
    }

    async function entrar(email, senha, manter) {
        try { global.localStorage.setItem(CHAVE_LEMBRAR, manter ? 'sim' : 'nao'); } catch (e) { /* nada */ }
        const c = obterCliente();
        if (!c) throw new Error('Sem conexão com o servidor da escola.');
        const { data, error } = await c.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: senha });
        if (error) {
            if (erroDeRede(error)) throw new Error('Sem internet. Para entrar pela primeira vez neste aparelho é preciso estar conectado.');
            if (/rate|many/i.test(error.message)) throw new Error('Muitas tentativas. Espere alguns minutos e tente de novo.');
            throw new Error('E-mail ou senha incorretos.');
        }
        usuario = data.user;
        perfil = await buscarPerfil(usuario.id);
        if (!perfil || !perfil.ativo) {
            await c.auth.signOut();
            usuario = null; perfil = null;
            throw new Error('Esta conta não tem acesso ao ProvaShow. Peça à gestão para ativá-la no Montador de Provas (tela Professores).');
        }
        guardarPerfil(perfil);
        return { usuario, perfil };
    }

    async function sair() {
        const c = obterCliente();
        try { if (c) await c.auth.signOut(); } catch (e) { /* sem internet: a sessão local sai do mesmo jeito */ }
        guardaSessao.removeItem('provashow-sessao');
        guardarPerfil(null);
        usuario = null; perfil = null;
    }

    /* Trocar a senha exige a senha atual (confirma que é a pessoa mesmo). */
    async function trocarSenha(atual, nova) {
        if (String(nova).length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
        const c = obterCliente();
        const { error: e1 } = await c.auth.signInWithPassword({ email: usuario.email, password: atual });
        if (e1) throw new Error('A senha atual não confere.');
        const { error: e2 } = await c.auth.updateUser({ password: nova });
        if (e2) throw new Error(e2.message.includes('different') ? 'A nova senha precisa ser diferente da atual.' : 'Não foi possível trocar a senha agora.');
    }

    /* ----- sincronização ----- */

    function itensDe(d) {
        const r = [];
        for (const [tipo, lista] of Object.entries(LISTAS)) {
            for (const x of d[lista] || []) {
                if (!x || !x.id) continue;
                r.push({ id: x.id, tipo, dados: x, alterado: x.alterado || x.data || '1970-01-01T00:00:00.000Z', removido: x.removido || null });
            }
        }
        return r;
    }

    function tamanho(o) { return JSON.stringify(o).length; }

    /* estado: { ultimaBaixa, enviados: { id: alterado }, config: 'json enviado' } */
    async function sincronizar(d, estado) {
        const c = obterCliente();
        if (!c || !usuario) return { enviados: 0, recebidos: 0 };
        const e = Object.assign({ ultimaBaixa: null, enviados: {}, config: null }, estado);

        /* 1. desce o que mudou no servidor (com 2 minutos de folga: o que chega
              duas vezes é ignorado pela junção) */
        const desde = e.ultimaBaixa ? new Date(new Date(e.ultimaBaixa).getTime() - 120000).toISOString() : '1970-01-01T00:00:00Z';
        const recebidos = [];
        let maior = e.ultimaBaixa;
        for (let i = 0; ; i += 500) {
            const { data, error } = await c.from(TABELA).select('id, tipo, dados, alterado, removido, atualizado_em')
                .eq('dono', usuario.id).gt('atualizado_em', desde).order('atualizado_em', { ascending: true }).range(i, i + 499);
            if (error) throw error;
            recebidos.push(...data);
            for (const x of data) if (!maior || x.atualizado_em > maior) maior = x.atualizado_em;
            if (data.length < 500) break;
        }
        const remoto = global.Dados.vazio();
        let configRemota = null;
        for (const x of recebidos) {
            if (x.tipo === 'config') { configRemota = x; continue; }
            remoto[LISTAS[x.tipo]].push(Object.assign({}, x.dados, { removido: x.removido || null, alterado: x.dados.alterado || x.alterado }));
        }
        let mudou = global.Dados.mesclar(d, remoto);
        const jsonConfig = () => JSON.stringify(Object.assign({}, d.config, { alterado: undefined }));
        if (configRemota && (configRemota.alterado || '') > (d.config.alterado || '')) {
            d.config = Object.assign(global.Dados.configPadrao(), configRemota.dados);
            e.config = jsonConfig();
            mudou++;
        }
        /* o que desceu já está no servidor: não precisa subir de volta */
        const porId = new Map(recebidos.map((y) => [y.id, y]));
        for (const x of itensDe(d)) {
            const r = porId.get(x.id);
            if (r && x.alterado === (r.dados.alterado || r.alterado)) e.enviados[x.id] = x.alterado;
        }
        e.ultimaBaixa = maior;

        /* 2. sobe o que mudou neste aparelho */
        const pendentes = itensDe(d).filter((x) => e.enviados[x.id] !== x.alterado);
        const configJson = jsonConfig();
        if (e.config === null && !d.config.alterado) {
            e.config = configJson;      /* aparelho novo: os ajustes padrão não sobrescrevem os da nuvem */
        } else if (configJson !== e.config) {
            if (e.config !== null || !d.config.alterado) d.config.alterado = new Date().toISOString();
            pendentes.push({ id: 'config', tipo: 'config', dados: d.config, alterado: d.config.alterado, removido: null });
        }
        let lote = [], pesoLote = 0;
        const enviar = async () => {
            if (!lote.length) return;
            const linhas = lote.map((x) => ({ dono: usuario.id, id: x.id, tipo: x.tipo, dados: x.dados, alterado: x.alterado, removido: x.removido }));
            const { error } = await c.from(TABELA).upsert(linhas, { onConflict: 'dono,id' });
            if (error) throw error;
            for (const x of lote) {
                if (x.tipo === 'config') e.config = configJson; else e.enviados[x.id] = x.alterado;
            }
            lote = []; pesoLote = 0;
        };
        for (const x of pendentes) {
            const p = tamanho(x.dados);
            if (lote.length && (pesoLote + p > 2000000 || lote.length >= 100)) await enviar();
            lote.push(x); pesoLote += p;
        }
        await enviar();
        return { enviados: pendentes.length, recebidos: mudou, estado: e };
    }

    function quantosPendentes(d, estado) {
        const e = estado || { enviados: {} };
        return itensDe(d).filter((x) => (e.enviados || {})[x.id] !== x.alterado).length;
    }

    /* ----- gestão: ver os relatórios de qualquer professor (só leitura) ----- */
    async function listarProfessores() {
        const { data, error } = await obterCliente().from('montador_perfis').select('id, nome, email, papel, area, ativo').order('nome');
        if (error) throw error;
        return data;
    }

    async function dadosDoProfessor(id) {
        const d = global.Dados.vazio();
        for (let i = 0; ; i += 500) {
            const { data, error } = await obterCliente().from(TABELA).select('id, tipo, dados, removido')
                .eq('dono', id).in('tipo', ['turma', 'aula', 'sessao']).order('id').range(i, i + 499);
            if (error) throw error;
            for (const x of data) d[LISTAS[x.tipo]].push(Object.assign({}, x.dados, { removido: x.removido || null }));
            if (data.length < 500) break;
        }
        return global.Dados.migrar(d);
    }

    const Nuvem = {
        iniciar, entrar, sair, trocarSenha, sincronizar, quantosPendentes, itensDe, listarProfessores, dadosDoProfessor, erroDeRede,
        usuario: () => usuario, perfil: () => perfil, lembrar, disponivel: () => !!obterCliente()
    };
    global.Nuvem = Nuvem;
})(typeof self !== 'undefined' ? self : this);
