/* Um Supabase de mentira para o teste de navegador do ProvaShow (a rede do
   ambiente de teste não alcança o Supabase de verdade).

   Guarda em memória as contas, os perfis do Montador e as tabelas
   provashow_*, e aplica as MESMAS regras do banco (supabase/001_provashow.sql):
   só quem tem perfil ativo lê e grava, cada um só o que é seu, a gestão lê
   tudo, uma versão mais velha não sobrescreve a mais nova, toda mudança em
   turma/aula/sessão vai para o histórico e não existe apagar.
   O cliente correspondente (cliente-falso.js) roda no navegador no lugar de
   vendor/supabase.js e fala com este servidor por POST /__falso — assim
   vários navegadores (computador, celular, gestão) compartilham a mesma nuvem. */
import { randomUUID } from 'node:crypto';

export function criarSupabaseFalso() {
    const db = { usuarios: [], perfis: [], itens: [], versoes: [] };
    let relogio = Date.now();
    const agora = () => new Date(++relogio).toISOString();

    function conta(email, senha, perfil) {
        const id = randomUUID();
        db.usuarios.push({ id, email, senha });
        if (perfil) db.perfis.push(Object.assign({ id, email, ativo: true, area: null }, perfil));
        return id;
    }

    const perfilAtivo = (uid) => db.perfis.find((p) => p.id === uid && p.ativo);
    const membro = (uid) => !!perfilAtivo(uid);
    const gestao = (uid) => (perfilAtivo(uid) || {}).papel === 'gestao';

    function quem(token) {
        const m = /^tok-(.+)$/.exec(token || '');
        return m && db.usuarios.some((u) => u.id === m[1]) ? m[1] : null;
    }

    function filtrar(linhas, f) {
        let r = linhas.filter((l) => (f.eq || []).every(([c, v]) => l[c] === v)
            && (f.gt || []).every(([c, v]) => l[c] > v)
            && (f.in || []).every(([c, vs]) => vs.includes(l[c])));
        if (f.order) r = r.slice().sort((a, b) => (a[f.order[0]] > b[f.order[0]] ? 1 : a[f.order[0]] < b[f.order[0]] ? -1 : 0) * (f.order[1] ? 1 : -1));
        if (f.range) r = r.slice(f.range[0], f.range[1] + 1);
        return r;
    }

    function escolher(linhas, colunas) {
        if (!colunas || colunas === '*') return linhas;
        const cs = colunas.split(',').map((c) => c.trim());
        return linhas.map((l) => Object.fromEntries(cs.map((c) => [c, l[c]])));
    }

    function tratar(p) {
        const uid = quem(p.token);
        if (p.acao === 'login') {
            const u = db.usuarios.find((x) => x.email === String(p.email).toLowerCase() && x.senha === p.senha);
            if (!u) return { error: { message: 'Invalid login credentials' } };
            return { data: { user: { id: u.id, email: u.email }, session: { access_token: 'tok-' + u.id, user: { id: u.id, email: u.email } } } };
        }
        if (p.acao === 'senha') {
            if (!uid) return { error: { message: 'JWT expired' } };
            db.usuarios.find((u) => u.id === uid).senha = p.senha;
            return { data: {} };
        }
        if (!uid) return { error: { message: 'JWT expired', code: '401' } };
        if (p.acao === 'select') {
            let linhas;
            if (p.tabela === 'montador_perfis') linhas = db.perfis.filter((x) => membro(uid) || x.id === uid);
            else if (p.tabela === 'provashow_itens') linhas = db.itens.filter((x) => (x.dono === uid && membro(uid)) || gestao(uid));
            else if (p.tabela === 'provashow_versoes') linhas = db.versoes.filter((x) => (x.dono === uid && membro(uid)) || gestao(uid));
            else return { error: { message: 'tabela desconhecida' } };
            const r = escolher(filtrar(linhas, p.filtros || {}), p.colunas);
            return { data: JSON.parse(JSON.stringify(r)) };
        }
        if (p.acao === 'upsert' && p.tabela === 'provashow_itens') {
            if (!membro(uid)) return { error: { message: 'new row violates row-level security policy', code: '42501' } };
            for (const linha of p.linhas) {
                if (linha.dono && linha.dono !== uid) return { error: { message: 'new row violates row-level security policy', code: '42501' } };
                if (!/^[A-Za-z0-9_-]{1,64}$/.test(linha.id)) return { error: { message: 'id inválido' } };
                const velho = db.itens.find((x) => x.dono === uid && x.id === linha.id);
                if (!velho) {
                    db.itens.push({ dono: uid, id: linha.id, tipo: linha.tipo, dados: linha.dados, alterado: linha.alterado, removido: linha.removido || null, atualizado_em: agora(), criado_em: agora() });
                } else if (new Date(linha.alterado) >= new Date(velho.alterado)) {
                    if (['turma', 'aula', 'sessao'].includes(velho.tipo) && (JSON.stringify(velho.dados) !== JSON.stringify(linha.dados) || velho.removido !== (linha.removido || null))) {
                        db.versoes.push({ dono: velho.dono, id: velho.id, tipo: velho.tipo, dados: velho.dados, alterado: velho.alterado, removido: velho.removido, substituida_em: agora() });
                    }
                    Object.assign(velho, { dados: linha.dados, alterado: linha.alterado, removido: linha.removido || null, atualizado_em: agora() });
                }
            }
            return { data: null };
        }
        return { error: { message: 'operação não permitida' } };
    }

    return { db, conta, tratar };
}
