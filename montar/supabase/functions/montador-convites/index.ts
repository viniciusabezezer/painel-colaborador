// Montador de Provas da Malu — convite por link.
//
// A gestão gera um link, copia a mensagem e manda pelo WhatsApp. A pessoa
// abre o link, cria a senha e entra. Não manda e-mail e não usa o fluxo de
// convite/redirect do Auth (Site URL e Redirect URLs são do projeto inteiro,
// compartilhado com o Mapa de Aulas).
//
// O token em claro só volta uma vez, na resposta de "gerar". No banco fica
// o SHA-256 (tabela montador_convites, RLS fechada). Quem grava a senha é
// esta função, com a chave de serviço.
//
// Ações (POST, JSON { acao, ... }):
//   acessos  — gestão: quem ainda não entrou ({ id, nuncaEntrou })
//   gerar    — gestão: { id } → { token, expiraEm, nome, email }
//   ver      — público: { token } → { nome, email, expiraEm }
//   aceitar  — público: { token, senha } define a senha e queima o convite
import { createClient } from 'npm:@supabase/supabase-js@2';
import { avaliarConvite, erroSenha, expiraEm, hashToken, novoToken, tokenNoFormato } from '../_shared/convite-regras.js';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

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

function banido(user: { banned_until?: string | null } | null | undefined) {
    if (!user?.banned_until) return false;
    const ate = new Date(user.banned_until).getTime();
    return Number.isFinite(ate) && ate > Date.now();
}

async function quemChama(req: Request) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new Recusa('Entre com a sua conta.', 401);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) throw new Recusa('Sessão expirada. Entre de novo.', 401);
    const { data: perfil } = await admin.from('montador_perfis').select('*').eq('id', data.user.id).maybeSingle();
    if (!perfil || !perfil.ativo || perfil.papel !== 'gestao') throw new Recusa('Só a gestão cadastra e altera professores.', 403);
    return perfil;
}

async function perfilAtivoEfetivo(id: string) {
    const { data: perfil, error } = await admin.from('montador_perfis').select('*').eq('id', id).maybeSingle();
    if (error) throw new Recusa('Não consegui ler o professor: ' + error.message);
    if (!perfil) return null;
    const { data: authData } = await admin.auth.admin.getUserById(id);
    const user = authData?.user;
    if (!user) return null;
    return { perfil, ativo: !!perfil.ativo && !banido(user) };
}

async function buscarConvite(hash: string) {
    const { data, error } = await admin.from('montador_convites').select('*').eq('token_hash', hash).maybeSingle();
    if (error) throw new Recusa('Não consegui ler o convite: ' + error.message);
    return data;
}

async function julgar(hash: string) {
    const convite = await buscarConvite(hash);
    const achado = convite ? await perfilAtivoEfetivo(convite.perfil_id) : null;
    const perfil = achado ? { ativo: achado.ativo, nome: achado.perfil.nome, email: achado.perfil.email } : null;
    const julgado = avaliarConvite(convite, perfil, new Date());
    return { convite, achado, julgado };
}

async function gerar(perfilId: string, criadoPor: string) {
    const achado = await perfilAtivoEfetivo(perfilId);
    if (!achado) throw new Recusa('Professor não encontrado.', 404);
    if (!achado.ativo) throw new Recusa('Conta desativada não recebe convite. Reative a pessoa antes.', 403);

    for (let tentativa = 0; tentativa < 2; tentativa++) {
        const { data: revogados, error: erroRev } = await admin.from('montador_convites')
            .update({ revogado_em: new Date().toISOString() })
            .eq('perfil_id', perfilId)
            .is('usado_em', null)
            .is('revogado_em', null)
            .select('id');
        if (erroRev) throw new Recusa('Não consegui revogar o convite anterior: ' + erroRev.message);

        const token = novoToken();
        const tokenHash = await hashToken(token);
        const expira = expiraEm();
        const { error } = await admin.from('montador_convites').insert({
            perfil_id: perfilId,
            token_hash: tokenHash,
            expira_em: expira,
            criado_por: criadoPor
        });
        if (!error) {
            return { ok: true, token, expiraEm: expira, nome: achado.perfil.nome, email: achado.perfil.email };
        }
        if (revogados?.length) {
            await admin.from('montador_convites').update({ revogado_em: null }).in('id', revogados.map((r: { id: string }) => r.id));
        }
        if (error.code !== '23505') throw new Recusa('Não consegui guardar o convite: ' + error.message);
    }
    throw new Recusa('Não consegui guardar o convite. Tente de novo.');
}

/* Só ids de montador_perfis. Usuários do Mapa de Aulas, no mesmo Auth, não saem daqui. */
async function acessos() {
    const { data: perfis, error } = await admin.from('montador_perfis').select('id');
    if (error) throw new Recusa('Não consegui ler os professores: ' + error.message);
    const ids = new Set((perfis || []).map((p: { id: string }) => p.id));
    const nunca = new Map<string, boolean>();
    for (let pagina = 1; pagina <= 20; pagina++) {
        const { data, error: erroLista } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
        if (erroLista) throw new Recusa('Não consegui consultar os acessos: ' + erroLista.message);
        const users = data?.users || [];
        for (const u of users) {
            if (ids.has(u.id)) nunca.set(u.id, !u.last_sign_in_at);
        }
        if (users.length < 200 || nunca.size === ids.size) break;
    }
    return [...ids].map((id) => ({ id, nuncaEntrou: nunca.has(id) ? nunca.get(id) : true }));
}

async function aceitar(token: string, senha: string) {
    const hash = await hashToken(token);
    const { convite, achado, julgado } = await julgar(hash);
    if (!julgado.ok || !convite || !achado) {
        throw new Recusa(julgado.ok ? 'Convite inválido.' : julgado.erro, julgado.ok ? 404 : julgado.status);
    }

    const { data: reivindicado, error: erroClaim } = await admin.from('montador_convites')
        .update({ usado_em: new Date().toISOString() })
        .eq('id', convite.id)
        .is('usado_em', null)
        .is('revogado_em', null)
        .gt('expira_em', new Date().toISOString())
        .select('id')
        .maybeSingle();
    if (erroClaim) throw new Recusa('Não consegui reservar o convite: ' + erroClaim.message);
    if (!reivindicado) {
        const deNovo = await julgar(hash);
        if (!deNovo.julgado.ok) throw new Recusa(deNovo.julgado.erro, deNovo.julgado.status);
        throw new Recusa('Este convite já foi usado. Entre com o seu e-mail e a senha, ou peça um novo à gestão.', 410);
    }

    const { error } = await admin.auth.admin.updateUserById(achado.perfil.id, { password: senha });
    if (error) {
        await admin.from('montador_convites').update({ usado_em: null }).eq('id', reivindicado.id);
        throw new Recusa('Não consegui definir a senha. Tente de novo.');
    }
    return { ok: true, email: achado.perfil.email, nome: achado.perfil.nome };
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
                const { achado, convite, julgado } = await julgar(await hashToken(token));
                if (!julgado.ok || !achado || !convite) {
                    throw new Recusa(julgado.ok ? 'Convite inválido.' : julgado.erro, julgado.ok ? 404 : julgado.status);
                }
                return resposta({ ok: true, nome: achado.perfil.nome, email: achado.perfil.email, expiraEm: convite.expira_em });
            }
            const falhaSenha = erroSenha(corpo.senha);
            if (falhaSenha) throw new Recusa(falhaSenha);
            return resposta(await aceitar(token, String(corpo.senha)));
        }

        const eu = await quemChama(req);
        if (acao === 'acessos') return resposta({ ok: true, acessos: await acessos() });
        if (acao === 'gerar') return resposta(await gerar(texto(corpo.id, 40), eu.id));
        throw new Recusa('Ação desconhecida.');
    } catch (erro) {
        if (erro instanceof Recusa) return resposta({ erro: erro.message }, erro.status);
        console.error(erro);
        return resposta({ erro: 'Erro inesperado no servidor.' }, 500);
    }
});
