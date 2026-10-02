// Montador de Provas da Malu — contas dos professores.
//
// Só esta função cria e altera contas de login, porque precisa da chave de
// serviço (que nunca vai para o navegador). Quem chama precisa ser da gestão,
// com uma exceção: o "primeiro acesso", que cria a primeira conta da gestão e
// só funciona enquanto não existir nenhuma.
//
// Ações (POST, JSON { acao, ... }):
//   situacao         — { primeiroAcesso } (sem login)
//   primeiro-acesso  — { nome, email, senha } (sem login; só sem gestão)
//   criar            — { nome, email, senha, papel, area, disciplinas }
//   atualizar        — { id, nome?, email?, papel?, area?, disciplinas?, ativo?, senha? }
//   excluir          — { id }
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const PAPEIS = ['gestao', 'pca', 'professor'];
const AREAS = ['LIN', 'NAT', 'HUM', 'MAT', 'RED'];

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

function validarEmail(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Recusa('E-mail inválido.');
    return email.toLowerCase();
}

function validarSenha(senha: string) {
    if (senha.length < 8) throw new Recusa('A senha precisa ter pelo menos 8 caracteres.');
    return senha;
}

function validarPapel(papel: string, area: string | null) {
    if (!PAPEIS.includes(papel)) throw new Recusa('Papel inválido.');
    if (papel !== 'gestao' && !(area && AREAS.includes(area))) throw new Recusa('Escolha a área do professor.');
}

function disciplinasDe(v: unknown): string[] {
    const lista = Array.isArray(v) ? v : String(v ?? '').split(/[,;\n]/);
    return lista.map((d) => texto(d, 60)).filter(Boolean).slice(0, 12);
}

async function quantosGestao() {
    const { count, error } = await admin.from('montador_perfis').select('id', { count: 'exact', head: true })
        .eq('papel', 'gestao').eq('ativo', true);
    if (error) throw error;
    return count ?? 0;
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

async function criarConta(dados: Record<string, unknown>, papelFixo?: string) {
    const nome = texto(dados.nome, 120);
    if (!nome) throw new Recusa('Informe o nome.');
    const email = validarEmail(texto(dados.email, 200));
    const senha = validarSenha(String(dados.senha ?? ''));
    const papel = papelFixo || texto(dados.papel, 20);
    const area = papel === 'gestao' ? (texto(dados.area, 3) || null) : texto(dados.area, 3);
    validarPapel(papel, area);
    if (area && !AREAS.includes(area)) throw new Recusa('Área inválida.');

    const { data, error } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome, app: 'montador-provas' }
    });
    if (error || !data.user) {
        const ja = /already|registered|exists/i.test(error?.message || '');
        throw new Recusa(ja ? 'Já existe uma conta com este e-mail.' : 'Não consegui criar a conta: ' + (error?.message || ''));
    }
    const perfil = { id: data.user.id, nome, email, papel, area: area || null, disciplinas: disciplinasDe(dados.disciplinas), ativo: true };
    const { error: erroPerfil } = await admin.from('montador_perfis').insert(perfil);
    if (erroPerfil) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw new Recusa('Não consegui salvar o perfil: ' + erroPerfil.message);
    }
    return perfil;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);
    try {
        const corpo = await req.json().catch(() => ({}));
        const acao = texto(corpo.acao, 30);

        if (acao === 'situacao') {
            return resposta({ primeiroAcesso: (await quantosGestao()) === 0 });
        }

        if (acao === 'primeiro-acesso') {
            if ((await quantosGestao()) > 0) throw new Recusa('A gestão já tem conta. Peça o seu cadastro a ela.', 403);
            const perfil = await criarConta(corpo, 'gestao');
            return resposta({ ok: true, perfil });
        }

        const eu = await quemChama(req);

        if (acao === 'criar') {
            return resposta({ ok: true, perfil: await criarConta(corpo) });
        }

        if (acao === 'atualizar' || acao === 'excluir') {
            const id = texto(corpo.id, 40);
            const { data: alvo } = await admin.from('montador_perfis').select('*').eq('id', id).maybeSingle();
            if (!alvo) throw new Recusa('Professor não encontrado.', 404);

            /* só pesa tirar uma gestão ativa: a desativada já não conta */
            const deixaDeSerGestao = alvo.papel === 'gestao' && alvo.ativo &&
                (acao === 'excluir' || corpo.ativo === false || (corpo.papel && corpo.papel !== 'gestao'));
            if (deixaDeSerGestao && (await quantosGestao()) <= 1) {
                throw new Recusa('É a única conta da gestão: cadastre outra antes de tirar esta.');
            }

            if (acao === 'excluir') {
                if (alvo.id === eu.id) throw new Recusa('Você não pode excluir a própria conta.');
                const { error } = await admin.auth.admin.deleteUser(alvo.id);
                if (error) throw new Recusa('Não consegui excluir: ' + error.message);
                return resposta({ ok: true });
            }

            const mudancas: Record<string, unknown> = {};
            if (corpo.nome !== undefined) { mudancas.nome = texto(corpo.nome, 120); if (!mudancas.nome) throw new Recusa('Informe o nome.'); }
            if (corpo.papel !== undefined || corpo.area !== undefined) {
                const papel = corpo.papel !== undefined ? texto(corpo.papel, 20) : alvo.papel;
                const area = corpo.area !== undefined ? (texto(corpo.area, 3) || null) : alvo.area;
                validarPapel(papel, area);
                mudancas.papel = papel;
                mudancas.area = area;
            }
            if (corpo.disciplinas !== undefined) mudancas.disciplinas = disciplinasDe(corpo.disciplinas);
            if (corpo.ativo !== undefined) mudancas.ativo = !!corpo.ativo;

            const auth: Record<string, unknown> = {};
            if (corpo.email !== undefined && texto(corpo.email) !== alvo.email) {
                auth.email = validarEmail(texto(corpo.email));
                auth.email_confirm = true;
                mudancas.email = auth.email;
            }
            if (corpo.senha) auth.password = validarSenha(String(corpo.senha));
            /* conta desativada não entra: bloqueia o login, sem apagar autoria */
            if (corpo.ativo !== undefined) auth.ban_duration = corpo.ativo ? 'none' : '876000h';
            if (Object.keys(auth).length) {
                const { error } = await admin.auth.admin.updateUserById(alvo.id, auth);
                if (error) throw new Recusa('Não consegui alterar o login: ' + error.message);
            }
            if (Object.keys(mudancas).length) {
                const { error } = await admin.from('montador_perfis').update(mudancas).eq('id', alvo.id);
                if (error) throw new Recusa('Não consegui salvar: ' + error.message);
            }
            return resposta({ ok: true });
        }

        throw new Recusa('Ação desconhecida.');
    } catch (erro) {
        if (erro instanceof Recusa) return resposta({ erro: erro.message }, erro.status);
        console.error(erro);
        return resposta({ erro: 'Erro inesperado no servidor.' }, 500);
    }
});
