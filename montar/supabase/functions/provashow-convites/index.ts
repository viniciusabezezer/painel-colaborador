// ProvaShow Malu — convite para professor NOVO criar o próprio login.
//
// A gestão digita o nome, o app gera um link e manda pelo WhatsApp. A pessoa
// abre, escolhe o e-mail e a senha, e a conta nasce com perfil ativo em
// montador_perfis (a mesma conta vale no ProvaShow e no Montador). Sem
// e-mail e sem o fluxo de convite/redirect do Auth, que é compartilhado com
// o Mapa de Aulas. Para quem já tem conta, o app usa montador-convites.
//
// O token em claro só volta uma vez, na resposta de "criar"/"renovar". No
// banco fica o SHA-256 (tabela provashow_convites, RLS fechada).
//
// Ações (POST, JSON { acao, ... }):
//   criar    — gestão: { nome, papel?, area?, telefone? } → { id, token, expiraEm, nome }
//   listar   — gestão: convites dos últimos 90 dias, com a situação de cada um
//   renovar  — gestão: { id } → cancela o link anterior e devolve um novo
//   cancelar — gestão: { id }
//   ver      — público: { token } → { nome, expiraEm }
//   aceitar  — público: { token, email, senha } cria a conta e queima o convite
import { createClient } from 'npm:@supabase/supabase-js@2';
import { avaliarConvite, erroSenha, expiraEm, hashToken, novoToken, tokenNoFormato } from '../_shared/convite-regras.js';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const PAPEIS = ['pca', 'professor'];
const AREAS = ['LIN', 'NAT', 'HUM', 'MAT', 'RED'];
const TABELA = 'provashow_convites';

class Recusa extends Error {
    status: number;
    constructor(mensagem: string, status = 400) { super(mensagem); this.status = status; }
}

function resposta(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }
});

function texto(v: unknown, max = 200) { return String(v ?? '').trim().slice(0, max); }

async function quemChama(req: Request) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new Recusa('Entre com a sua conta.', 401);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) throw new Recusa('Sessão expirada. Entre de novo.', 401);
    const { data: perfil } = await admin.from('montador_perfis').select('*').eq('id', data.user.id).maybeSingle();
    if (!perfil || !perfil.ativo || perfil.papel !== 'gestao') throw new Recusa('Só a gestão convida professores.', 403);
    return perfil;
}

function situacao(c: { usado_em: string | null; revogado_em: string | null; expira_em: string }) {
    if (c.usado_em) return 'usado';
    if (c.revogado_em) return 'cancelado';
    if (new Date(c.expira_em).getTime() <= Date.now()) return 'vencido';
    return 'aberto';
}

async function novoLink(dados: { nome: string; papel: string; area: string | null; telefone: string | null }, criadoPor: string) {
    const token = novoToken();
    const expira = expiraEm();
    const { data, error } = await admin.from(TABELA).insert({
        ...dados, token_hash: await hashToken(token), expira_em: expira, criado_por: criadoPor
    }).select('id').single();
    if (error) throw new Recusa('Não consegui guardar o convite: ' + error.message);
    return { ok: true, id: data.id, token, expiraEm: expira, nome: dados.nome, telefone: dados.telefone };
}

async function criar(corpo: Record<string, unknown>, criadoPor: string) {
    const nome = texto(corpo.nome, 120).replace(/\s+/g, ' ');
    if (nome.length < 2) throw new Recusa('Digite o nome do professor.');
    const papel = texto(corpo.papel, 20) || 'professor';
    if (!PAPEIS.includes(papel)) throw new Recusa('Função inválida.');
    const area = texto(corpo.area, 5) || null;
    if (area && !AREAS.includes(area)) throw new Recusa('Área inválida.');
    let telefone: string | null = texto(corpo.telefone, 30).replace(/\D/g, '') || null;
    if (telefone && telefone.length <= 11) telefone = '55' + telefone;
    if (telefone && !/^[0-9]{12,13}$/.test(telefone)) throw new Recusa('WhatsApp inválido. Use DDD + número, por exemplo (88) 99999-0000.');
    return novoLink({ nome, papel, area, telefone }, criadoPor);
}

async function listar() {
    const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin.from(TABELA)
        .select('id, nome, papel, area, telefone, criado_em, expira_em, usado_em, revogado_em, perfil_id')
        .gte('criado_em', desde).order('criado_em', { ascending: false }).limit(200);
    if (error) throw new Recusa('Não consegui ler os convites: ' + error.message);
    const ids = (data || []).map((c) => c.perfil_id).filter(Boolean);
    const emails = new Map<string, string>();
    if (ids.length) {
        const { data: perfis } = await admin.from('montador_perfis').select('id, email').in('id', ids);
        (perfis || []).forEach((p: { id: string; email: string }) => emails.set(p.id, p.email));
    }
    return (data || []).map((c) => ({
        id: c.id, nome: c.nome, papel: c.papel, area: c.area, telefone: c.telefone,
        criadoEm: c.criado_em, expiraEm: c.expira_em, usadoEm: c.usado_em,
        situacao: situacao(c), email: c.perfil_id ? emails.get(c.perfil_id) || null : null
    }));
}

async function lerPorId(id: string) {
    const { data, error } = await admin.from(TABELA).select('*').eq('id', id).maybeSingle();
    if (error) throw new Recusa('Não consegui ler o convite: ' + error.message);
    if (!data) throw new Recusa('Convite não encontrado.', 404);
    return data;
}

async function cancelar(id: string) {
    const c = await lerPorId(id);
    if (c.usado_em) throw new Recusa('Este convite já foi usado: a conta já existe.');
    if (!c.revogado_em) {
        const { error } = await admin.from(TABELA).update({ revogado_em: new Date().toISOString() }).eq('id', id).is('usado_em', null);
        if (error) throw new Recusa('Não consegui cancelar: ' + error.message);
    }
    return { ok: true };
}

async function renovar(id: string, criadoPor: string) {
    const c = await lerPorId(id);
    if (c.usado_em) throw new Recusa('Este convite já foi usado: a conta já existe. Para trocar a senha, use "Criar senha" na lista de professores.');
    await cancelar(id);
    return novoLink({ nome: c.nome, papel: c.papel, area: c.area, telefone: c.telefone }, criadoPor);
}

async function julgar(token: string) {
    const { data: convite, error } = await admin.from(TABELA).select('*').eq('token_hash', await hashToken(token)).maybeSingle();
    if (error) throw new Recusa('Não consegui ler o convite: ' + error.message);
    const julgado = avaliarConvite(convite, convite ? { ativo: true } : null, new Date());
    if (!julgado.ok || !convite) throw new Recusa(julgado.ok ? 'Convite inválido.' : julgado.erro, julgado.ok ? 404 : julgado.status);
    return convite;
}

async function aceitar(token: string, emailBruto: string, senha: string) {
    const email = emailBruto.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Recusa('E-mail inválido.');
    const convite = await julgar(token);

    /* reserva o convite antes de criar a conta: dois cliques não criam duas */
    const { data: reservado, error: erroReserva } = await admin.from(TABELA)
        .update({ usado_em: new Date().toISOString() })
        .eq('id', convite.id).is('usado_em', null).is('revogado_em', null)
        .gt('expira_em', new Date().toISOString())
        .select('id').maybeSingle();
    if (erroReserva) throw new Recusa('Não consegui reservar o convite: ' + erroReserva.message);
    if (!reservado) { await julgar(token); throw new Recusa('Este convite já foi usado. Entre com o seu e-mail e a senha.', 410); }
    const devolver = () => admin.from(TABELA).update({ usado_em: null }).eq('id', convite.id);

    const { data, error } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome: convite.nome, app: 'provashow' }
    });
    if (error || !data.user) {
        await devolver();
        if (/already|registered|exists/i.test(error?.message || '')) {
            throw new Recusa('Já existe uma conta com este e-mail. Use outro e-mail, ou entre com ele na tela de login (se esqueceu a senha, peça à gestão um link para criar uma nova).', 409);
        }
        throw new Recusa('Não consegui criar a conta. Tente de novo.');
    }
    const perfil = { id: data.user.id, nome: convite.nome, email, papel: convite.papel, area: convite.area, disciplinas: [], ativo: true };
    const { error: erroPerfil } = await admin.from('montador_perfis').insert(perfil);
    if (erroPerfil) {
        await admin.auth.admin.deleteUser(data.user.id);
        await devolver();
        throw new Recusa('Não consegui salvar o seu perfil. Tente de novo.');
    }
    await admin.from(TABELA).update({ perfil_id: data.user.id }).eq('id', convite.id);
    return { ok: true, email, nome: convite.nome };
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);
    try {
        const corpo = await req.json().catch(() => ({}));
        const acao = texto(corpo.acao, 30);

        if (acao === 'ver' || acao === 'aceitar') {
            const token = texto(corpo.token, 200);
            if (!tokenNoFormato(token)) throw new Recusa('Convite inválido.', 404);
            if (acao === 'ver') {
                const c = await julgar(token);
                return resposta({ ok: true, nome: c.nome, expiraEm: c.expira_em });
            }
            const falhaSenha = erroSenha(corpo.senha);
            if (falhaSenha) throw new Recusa(falhaSenha);
            return resposta(await aceitar(token, texto(corpo.email, 200), String(corpo.senha)));
        }

        const eu = await quemChama(req);
        if (acao === 'criar') return resposta(await criar(corpo, eu.id));
        if (acao === 'listar') return resposta({ ok: true, convites: await listar() });
        if (acao === 'renovar') return resposta(await renovar(texto(corpo.id, 40), eu.id));
        if (acao === 'cancelar') return resposta(await cancelar(texto(corpo.id, 40)));
        throw new Recusa('Ação desconhecida.');
    } catch (erro) {
        if (erro instanceof Recusa) return resposta({ erro: erro.message }, erro.status);
        console.error(erro);
        return resposta({ erro: 'Erro inesperado no servidor.' }, 500);
    }
});
