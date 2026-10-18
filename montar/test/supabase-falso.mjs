/* Um Supabase de mentira, para o teste de navegador das provas da área.
   Guarda as tabelas montador_* em memória e aplica as MESMAS regras do banco
   (supabase/001_montador.sql): quem vê, quem cria, quem altera. Também faz o
   papel da função montador-usuarios, do login e do storage das imagens.
   O cliente correspondente (cliente-falso.js) roda no navegador e fala com
   este servidor por POST /__falso — assim vários navegadores (gestão, PCA,
   professores) compartilham a mesma prova, como no servidor de verdade. */
import { randomUUID } from 'node:crypto';

export function criarServidorFalso() {
    const db = {
        usuarios: [],            /* { id, email, senha, banido } */
        montador_perfis: [],
        montador_provas: [],
        montador_secoes: [],
        montador_questoes: [],
        montador_comentarios: [],
        storage: {},
        versao: 0
    };
    const agora = () => new Date().toISOString();

    /* ----- as regras (espelho do RLS) ----- */
    const perfil = (uid) => db.montador_perfis.find((p) => p.id === uid && p.ativo);
    const papel = (uid) => (perfil(uid) || {}).papel || null;
    const prova = (id) => db.montador_provas.find((p) => p.id === id);
    function coordena(uid, provaId) {
        const eu = perfil(uid);
        const p = prova(provaId);
        return !!eu && !!p && (eu.papel === 'gestao' || (eu.papel === 'pca' && eu.area === p.componente));
    }
    function podeVer(uid, provaId) {
        const eu = perfil(uid);
        const p = prova(provaId);
        return !!eu && !!p && (eu.papel === 'gestao' || eu.area === p.componente ||
            db.montador_secoes.some((s) => s.prova_id === provaId && s.responsavel === uid));
    }
    function podeEscrever(uid, secaoId) {
        const s = db.montador_secoes.find((x) => x.id === secaoId);
        if (!s) return false;
        const p = prova(s.prova_id);
        return p.situacao === 'aberta' && (coordena(uid, p.id) || (s.responsavel === uid && s.situacao !== 'aprovada' && !!papel(uid)));
    }
    const regras = {
        montador_perfis: {
            ver: (uid, r) => !!papel(uid) || r.id === uid,
            alterar: (uid) => papel(uid) === 'gestao'
        },
        montador_provas: {
            ver: (uid, r) => podeVer(uid, r.id),
            criar: (uid, r) => papel(uid) === 'gestao' || (papel(uid) === 'pca' && perfil(uid).area === r.componente),
            alterar: (uid, r) => coordena(uid, r.id),
            apagar: (uid, r) => coordena(uid, r.id)
        },
        montador_secoes: {
            ver: (uid, r) => podeVer(uid, r.prova_id),
            criar: (uid, r) => coordena(uid, r.prova_id),
            alterar: (uid, r) => coordena(uid, r.prova_id),
            apagar: (uid, r) => coordena(uid, r.prova_id)
        },
        montador_questoes: {
            ver: (uid, r) => podeVer(uid, r.prova_id),
            criar: (uid, r) => podeEscrever(uid, r.secao_id),
            alterar: (uid, r) => podeEscrever(uid, r.secao_id),
            apagar: (uid, r) => podeEscrever(uid, r.secao_id)
        },
        montador_comentarios: {
            ver: (uid, r) => podeVer(uid, r.prova_id),
            criar: (uid, r) => podeVer(uid, r.prova_id) && r.autor === uid && (r.tipo === 'comentario' || coordena(uid, r.prova_id)),
            alterar: (uid, r) => r.autor === uid || coordena(uid, r.prova_id),
            apagar: (uid, r) => r.autor === uid || coordena(uid, r.prova_id)
        }
    };
    const recusa = (msg = 'new row violates row-level security policy') => ({ error: { message: msg } });

    function filtrar(linhas, filtros) {
        return linhas.filter((r) => (filtros || []).every((f) => f.tipo === 'in' ? f.val.includes(r[f.col]) : r[f.col] === f.val));
    }

    /* gatilhos (espelho dos triggers) */
    function carimbarQuestao(uid, nova, velha) {
        const s = db.montador_secoes.find((x) => x.id === nova.secao_id);
        nova.prova_id = s ? s.prova_id : nova.prova_id;
        nova.atualizada_por = uid;
        nova.atualizada_em = agora();
        nova.criada_por = velha ? velha.criada_por : uid;
        nova.criada_em = velha ? velha.criada_em : agora();
        if (s && s.situacao === 'devolvida' && s.responsavel === uid) s.situacao = 'rascunho';
        const p = prova(nova.prova_id);
        if (p) { p.atualizada_em = agora(); p.atualizada_por = uid; }
    }

    function consulta(uid, q) {
        const tabela = db[q.tabela];
        const r = regras[q.tabela];
        if (!tabela || !r || !uid) return recusa('permission denied');
        if (q.acao === 'select') {
            let linhas = filtrar(tabela, q.filtros).filter((x) => r.ver(uid, x));
            if (q.ordem) {
                const { col, asc } = q.ordem;
                linhas = linhas.slice().sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
            }
            linhas = JSON.parse(JSON.stringify(linhas));
            if (q.unico) {
                if (linhas.length > 1) return { error: { message: 'mais de uma linha' } };
                if (!linhas.length && q.unico === 'single') return { error: { message: 'nenhuma linha' } };
                return { data: linhas[0] || null };
            }
            return { data: linhas };
        }
        if (q.acao === 'insert' || q.acao === 'upsert') {
            const lista = Array.isArray(q.dados) ? q.dados : [q.dados];
            const feitas = [];
            for (const original of lista) {
                const linha = JSON.parse(JSON.stringify(original));
                const existente = q.acao === 'upsert' ? tabela.find((x) => x.id === linha.id) : null;
                if (existente) {
                    const nova = Object.assign({}, existente, linha);
                    if (q.tabela === 'montador_questoes') carimbarQuestao(uid, nova, existente);
                    if (!r.alterar(uid, existente) || !r.alterar(uid, nova)) return recusa();
                    Object.assign(existente, nova);
                    feitas.push(existente);
                    continue;
                }
                linha.id = linha.id || randomUUID();
                if (q.tabela === 'montador_provas') Object.assign(linha, { situacao: 'aberta', criada_por: uid, criada_em: agora(), atualizada_em: agora(), dados: linha.dados || {} });
                if (q.tabela === 'montador_secoes') Object.assign(linha, { situacao: linha.situacao || 'rascunho', atualizada_em: agora(), icone: linha.icone || 'auto' });
                if (q.tabela === 'montador_comentarios') Object.assign(linha, { autor: linha.autor || uid, criado_em: agora(), resolvido: false, tipo: linha.tipo || 'comentario' });
                if (q.tabela === 'montador_questoes') carimbarQuestao(uid, linha, null);
                if (!r.criar || !r.criar(uid, linha)) return recusa();
                tabela.push(linha);
                feitas.push(linha);
            }
            db.versao++;
            return { data: q.unico ? JSON.parse(JSON.stringify(feitas[0])) : JSON.parse(JSON.stringify(feitas)) };
        }
        if (q.acao === 'update') {
            const alvos = filtrar(tabela, q.filtros).filter((x) => r.ver(uid, x) && r.alterar(uid, x));
            for (const x of alvos) {
                const nova = Object.assign({}, x, q.dados);
                if (q.tabela === 'montador_provas' && !(papel(uid) === 'gestao' || (papel(uid) === 'pca' && perfil(uid).area === nova.componente))) return recusa();
                if (q.tabela === 'montador_questoes') carimbarQuestao(uid, nova, x);
                if (q.tabela === 'montador_secoes' || q.tabela === 'montador_provas') nova.atualizada_em = agora();
                Object.assign(x, nova);
            }
            if (alvos.length) db.versao++;
            return { data: JSON.parse(JSON.stringify(alvos)) };
        }
        if (q.acao === 'delete') {
            const alvos = filtrar(tabela, q.filtros).filter((x) => r.ver(uid, x) && r.apagar(uid, x));
            for (const x of alvos) {
                tabela.splice(tabela.indexOf(x), 1);
                /* em cascata, como no banco */
                if (q.tabela === 'montador_provas') {
                    ['montador_secoes', 'montador_questoes', 'montador_comentarios'].forEach((t) => {
                        db[t] = db[t].filter((y) => y.prova_id !== x.id);
                    });
                }
                if (q.tabela === 'montador_secoes') db.montador_questoes = db.montador_questoes.filter((y) => y.secao_id !== x.id);
            }
            if (alvos.length) db.versao++;
            return { data: [] };
        }
        return recusa('ação desconhecida');
    }

    function rpc(uid, nome, args) {
        if (nome !== 'montador_marcar_secao') return recusa('função desconhecida');
        const s = db.montador_secoes.find((x) => x.id === args.p_secao);
        if (!s) return { error: { message: 'Seção não encontrada.' } };
        const p = prova(s.prova_id);
        if (p.situacao !== 'aberta') return { error: { message: 'A prova está travada para impressão.' } };
        if (!(s.responsavel === uid || coordena(uid, p.id))) return { error: { message: 'Só o responsável pela seção pode marcá-la.' } };
        if (s.situacao === 'aprovada' && !coordena(uid, p.id)) return { error: { message: 'A seção já foi aprovada pelo PCA.' } };
        s.situacao = args.p_pronta ? 'pronta' : 'rascunho';
        s.atualizada_em = agora();
        if (args.p_pronta) {
            db.montador_comentarios.push({ id: randomUUID(), prova_id: p.id, secao_id: s.id, autor: uid, texto: (args.p_nota || '').trim() || 'Seção pronta para revisão.',
                tipo: 'pronta', resolvido: false, criado_em: agora() });
        }
        db.versao++;
        return { data: s.situacao };
    }

    /* a função montador-usuarios */
    function funcao(uid, corpo) {
        const gestoes = () => db.montador_perfis.filter((p) => p.papel === 'gestao' && p.ativo).length;
        const criar = (d, papelFixo) => {
            const papelNovo = papelFixo || d.papel;
            if (!d.nome) return { status: 400, erro: 'Informe o nome.' };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) return { status: 400, erro: 'E-mail inválido.' };
            if (String(d.senha || '').length < 8) return { status: 400, erro: 'A senha precisa ter pelo menos 8 caracteres.' };
            if (papelNovo !== 'gestao' && !d.area) return { status: 400, erro: 'Escolha a área do professor.' };
            const email = d.email.toLowerCase();
            if (db.usuarios.some((u) => u.email === email)) return { status: 400, erro: 'Já existe uma conta com este e-mail.' };
            const id = randomUUID();
            db.usuarios.push({ id, email, senha: d.senha, banido: false });
            const disciplinas = (Array.isArray(d.disciplinas) ? d.disciplinas : String(d.disciplinas || '').split(/[,;\n]/)).map((x) => x.trim()).filter(Boolean);
            const p = { id, nome: d.nome, email, papel: papelNovo, area: d.area || null, disciplinas, ativo: true, criado_em: agora() };
            db.montador_perfis.push(p);
            db.versao++;
            return { status: 200, ok: true, perfil: p };
        };
        if (corpo.acao === 'situacao') return { status: 200, primeiroAcesso: gestoes() === 0 };
        if (corpo.acao === 'primeiro-acesso') {
            if (gestoes() > 0) return { status: 403, erro: 'A gestão já tem conta. Peça o seu cadastro a ela.' };
            return criar(corpo, 'gestao');
        }
        if (!uid) return { status: 401, erro: 'Entre com a sua conta.' };
        if (papel(uid) !== 'gestao') return { status: 403, erro: 'Só a gestão cadastra e altera professores.' };
        if (corpo.acao === 'criar') return criar(corpo);
        const alvo = db.montador_perfis.find((p) => p.id === corpo.id);
        if (!alvo) return { status: 404, erro: 'Professor não encontrado.' };
        const tira = alvo.papel === 'gestao' && alvo.ativo && (corpo.acao === 'excluir' || corpo.ativo === false || (corpo.papel && corpo.papel !== 'gestao'));
        if (tira && gestoes() <= 1) return { status: 400, erro: 'É a única conta da gestão: cadastre outra antes de tirar esta.' };
        const usuario = db.usuarios.find((u) => u.id === alvo.id);
        if (corpo.acao === 'excluir') {
            if (alvo.id === uid) return { status: 400, erro: 'Você não pode excluir a própria conta.' };
            db.usuarios = db.usuarios.filter((u) => u.id !== alvo.id);
            db.montador_perfis = db.montador_perfis.filter((p) => p.id !== alvo.id);
            db.versao++;
            return { status: 200, ok: true };
        }
        ['nome', 'papel', 'area', 'ativo'].forEach((k) => { if (corpo[k] !== undefined) alvo[k] = corpo[k]; });
        if (corpo.disciplinas !== undefined) alvo.disciplinas = String(corpo.disciplinas).split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
        if (corpo.email) { alvo.email = corpo.email.toLowerCase(); usuario.email = alvo.email; }
        if (corpo.senha) usuario.senha = corpo.senha;
        if (corpo.ativo !== undefined) usuario.banido = !corpo.ativo;
        db.versao++;
        return { status: 200, ok: true };
    }

    function tratar(corpo) {
        const uid = corpo.token && db.usuarios.some((u) => u.id === corpo.token && !u.banido) ? corpo.token : null;
        switch (corpo.op) {
            case 'login': {
                const u = db.usuarios.find((x) => x.email === String(corpo.email).toLowerCase() && x.senha === corpo.senha);
                if (!u) return { error: { message: 'Invalid login credentials' } };
                if (u.banido) return { error: { message: 'User is banned' } };
                return { data: { token: u.id } };
            }
            case 'senha': {
                if (!uid) return { error: { message: 'not logged' } };
                db.usuarios.find((u) => u.id === uid).senha = corpo.senha;
                return { data: true };
            }
            case 'sessao': return { data: uid ? { id: uid } : null };
            case 'consulta': return consulta(uid, corpo.q);
            case 'rpc': return uid ? rpc(uid, corpo.nome, corpo.args) : recusa();
            case 'funcao': return { data: funcao(uid, corpo.corpo || {}) };
            case 'upload': {
                const pasta = corpo.caminho.split('/')[0];
                if (!uid || !podeVer(uid, pasta)) return recusa();
                db.storage[corpo.caminho] = corpo.dataUrl;
                return { data: { path: corpo.caminho } };
            }
            case 'download': {
                const pasta = corpo.caminho.split('/')[0];
                if (!uid || !podeVer(uid, pasta) || !db.storage[corpo.caminho]) return { error: { message: 'Object not found' } };
                return { data: db.storage[corpo.caminho] };
            }
            case 'versao': return { data: db.versao };
            default: return { error: { message: 'op desconhecida' } };
        }
    }

    return { tratar, db };
}
