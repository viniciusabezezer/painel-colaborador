/* Convite por link, sem navegador: as regras puras, o servidor de mentira
   (os mesmos fluxos da função) e os controles de admin que não podem mudar.
   Rode com:  node --test montar/test/convite.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { avaliarConvite, erroSenha, expiraEm, hashToken, novoToken, PRAZO_DIAS, tokenNoFormato } from '../supabase/functions/_shared/convite-regras.js';
import { criarServidorFalso } from './supabase-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const exigir = createRequire(import.meta.url);
const Convite = exigir(join(aqui, '..', 'js', 'convite.js'));
const raiz = join(aqui, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

const agora = new Date('2026-06-01T12:00:00.000Z');
const perfilOk = { ativo: true, nome: 'Professora Exemplo', email: 'exemplo@escola.test' };
function convite(parcial) {
    return Object.assign({
        expira_em: '2026-06-08T12:00:00.000Z',
        usado_em: null,
        revogado_em: null
    }, parcial);
}

test('o prazo do convite é de 7 dias, no cliente e no servidor', () => {
    assert.equal(PRAZO_DIAS, 7);
    assert.equal(Convite.PRAZO_DIAS, 7);
    assert.equal(expiraEm(agora), '2026-06-08T12:00:00.000Z');
});

test('token novo tem o formato do link e o hash é SHA-256, sem guardar o token', async () => {
    const token = novoToken();
    assert.equal(tokenNoFormato(token), true);
    assert.equal(tokenNoFormato('curto'), false);
    assert.equal(tokenNoFormato(token + '/../'), false);
    assert.notEqual(novoToken(), token);
    assert.equal(await hashToken(token), createHash('sha256').update(token).digest('hex'));
    assert.equal((await hashToken(token)).length, 64);
});

test('convite inválido, vencido, usado, substituído ou de conta desativada', () => {
    assert.equal(avaliarConvite(null, perfilOk, agora).erro, 'Convite inválido.');
    assert.equal(avaliarConvite(convite(), null, agora).status, 404);
    assert.match(avaliarConvite(convite({ revogado_em: '2026-06-02T00:00:00.000Z' }), perfilOk, agora).erro, /substituído/);
    assert.match(avaliarConvite(convite({ usado_em: '2026-06-02T00:00:00.000Z' }), perfilOk, agora).erro, /já foi usado/);
    assert.match(avaliarConvite(convite({ expira_em: '2026-05-01T00:00:00.000Z' }), perfilOk, agora).erro, /venceu/);
    assert.match(avaliarConvite(convite(), { ativo: false }, agora).erro, /desativada/);
    assert.equal(avaliarConvite(convite(), perfilOk, agora).ok, true);
    assert.equal(erroSenha('1234567'), 'A senha precisa ter pelo menos 8 caracteres.');
    assert.equal(erroSenha('12345678'), '');
});

test('a mensagem do WhatsApp leva o link e o e-mail, e não uma senha', () => {
    const url = 'https://montador-provas-malu.vercel.app/#/convite/abc';
    const texto = Convite.mensagem({ nome: 'Professora Exemplo', email: 'exemplo@escola.test', url, dias: 7 });
    assert.match(texto, /Professora Exemplo/);
    assert.match(texto, /exemplo@escola\.test/);
    assert.ok(texto.includes(url));
    assert.match(texto, /7 dias/);
    assert.match(texto, /uma vez/);
    assert.equal(texto.includes('senha-provisoria'), false);
    globalThis.location = { origin: 'https://montador-provas-malu.vercel.app', pathname: '/' };
    assert.equal(Convite.url('abc'), 'https://montador-provas-malu.vercel.app/#/convite/abc');
    globalThis.location = { origin: 'https://exemplo.test', pathname: '/montar/' };
    assert.equal(Convite.url('a/b'), 'https://exemplo.test/montar/#/convite/a%2Fb');
});

function corpo(falso, token, nome, dados) {
    return falso.tratar({ op: 'funcao', nome, token, corpo: dados }).data;
}

test('fluxo do convite no servidor de mentira, e a tabela não entrega o token', () => {
    const falso = criarServidorFalso();
    assert.match(corpo(falso, null, 'montador-usuarios', { acao: 'primeiro-acesso', nome: 'Gestão', email: 'g@escola.test' }).erro, /8 caracteres/);
    const gestao = corpo(falso, null, 'montador-usuarios', {
        acao: 'primeiro-acesso', nome: 'Ana Gestão', email: 'ana@escola.test', senha: 'senha-da-ana'
    });
    assert.equal(gestao.ok, true);
    assert.equal('senha' in gestao.perfil, false);
    const login = falso.tratar({ op: 'login', email: 'ana@escola.test', senha: 'senha-da-ana' });
    const tokenAna = login.data.token;

    const semSenha = corpo(falso, tokenAna, 'montador-usuarios', {
        acao: 'criar', nome: 'Ivo Convite', email: 'ivo@escola.test', papel: 'professor', area: 'MAT'
    });
    assert.equal(semSenha.ok, true);
    assert.equal(JSON.stringify(semSenha).includes('tmp-'), false);
    const guardada = falso.db.usuarios.find((u) => u.email === 'ivo@escola.test');
    const senhaInterna = guardada.senha;
    assert.ok(senhaInterna.length >= 8);
    assert.equal(guardada.entrou, false);
    assert.ok(falso.tratar({ op: 'login', email: 'ivo@escola.test', senha: '' }).error);

    assert.equal(corpo(falso, null, 'montador-convites', { acao: 'gerar', id: semSenha.perfil.id }).status, 401);
    const professor = corpo(falso, tokenAna, 'montador-usuarios', {
        acao: 'criar', nome: 'Bruno', email: 'bruno@escola.test', papel: 'professor', area: 'NAT', senha: 'senha-do-bruno'
    });
    const tokenBruno = falso.tratar({ op: 'login', email: 'bruno@escola.test', senha: 'senha-do-bruno' }).data.token;
    assert.equal(corpo(falso, tokenBruno, 'montador-convites', { acao: 'gerar', id: semSenha.perfil.id }).status, 403);
    assert.equal(corpo(falso, tokenBruno, 'montador-usuarios', { acao: 'criar', nome: 'X', email: 'x@escola.test', senha: 'senha-qualquer', papel: 'professor', area: 'NAT' }).status, 403);

    const gerado = corpo(falso, tokenAna, 'montador-convites', { acao: 'gerar', id: semSenha.perfil.id });
    assert.equal(gerado.nome, 'Ivo Convite');
    assert.equal(tokenNoFormato(gerado.token), true);
    assert.equal(JSON.stringify(falso.db.montador_convites).includes(gerado.token), false);
    assert.equal(falso.db.montador_convites[0].token_hash.length, 64);
    const leitura = falso.tratar({
        op: 'consulta', token: tokenAna,
        q: { tabela: 'montador_convites', acao: 'select', filtros: [] }
    });
    assert.deepEqual(leitura.data, []);
    const gravar = falso.tratar({
        op: 'consulta', token: tokenAna,
        q: { tabela: 'montador_convites', acao: 'insert', dados: { perfil_id: semSenha.perfil.id, token_hash: 'ab'.repeat(32) } }
    });
    assert.ok(gravar.error);

    assert.equal(corpo(falso, null, 'montador-convites', { acao: 'ver', token: 'lixo' }).erro, 'Convite inválido.');
    const visto = corpo(falso, null, 'montador-convites', { acao: 'ver', token: gerado.token });
    assert.equal(visto.nome, 'Ivo Convite');
    assert.equal(visto.email, 'ivo@escola.test');
    assert.match(corpo(falso, null, 'montador-convites', { acao: 'aceitar', token: gerado.token, senha: 'curta' }).erro, /8 caracteres/);
    assert.equal(falso.db.montador_convites.find((c) => c.perfil_id === semSenha.perfil.id).usado_em, null);

    const aceito = corpo(falso, null, 'montador-convites', { acao: 'aceitar', token: gerado.token, senha: 'senha-do-ivo' });
    assert.equal(aceito.email, 'ivo@escola.test');
    assert.ok(falso.tratar({ op: 'login', email: 'ivo@escola.test', senha: senhaInterna }).error);
    assert.ok(falso.tratar({ op: 'login', email: 'ivo@escola.test', senha: 'senha-do-ivo' }).data.token);
    assert.match(corpo(falso, null, 'montador-convites', { acao: 'ver', token: gerado.token }).erro, /já foi usado/);

    const outro = corpo(falso, tokenAna, 'montador-convites', { acao: 'gerar', id: semSenha.perfil.id });
    const terceiro = corpo(falso, tokenAna, 'montador-convites', { acao: 'gerar', id: semSenha.perfil.id });
    assert.match(corpo(falso, null, 'montador-convites', { acao: 'ver', token: outro.token }).erro, /substituído/);
    const abertos = falso.db.montador_convites.filter((c) => c.perfil_id === semSenha.perfil.id && !c.usado_em && !c.revogado_em);
    assert.equal(abertos.length, 1);

    const linha = falso.db.montador_convites.find((c) => c.token_hash !== undefined && c.revogado_em === null && c.usado_em === null && c.perfil_id === semSenha.perfil.id);
    linha.expira_em = '2020-01-01T00:00:00.000Z';
    assert.match(corpo(falso, null, 'montador-convites', { acao: 'ver', token: terceiro.token }).erro, /venceu/);

    const novo = corpo(falso, tokenAna, 'montador-convites', { acao: 'gerar', id: semSenha.perfil.id });
    corpo(falso, tokenAna, 'montador-usuarios', { acao: 'atualizar', id: semSenha.perfil.id, ativo: false });
    assert.match(corpo(falso, null, 'montador-convites', { acao: 'ver', token: novo.token }).erro, /desativada/);
    assert.match(corpo(falso, tokenAna, 'montador-convites', { acao: 'gerar', id: semSenha.perfil.id }).erro, /desativada/);
    corpo(falso, tokenAna, 'montador-usuarios', { acao: 'atualizar', id: semSenha.perfil.id, ativo: true });
    assert.equal(corpo(falso, null, 'montador-convites', { acao: 'ver', token: novo.token }).nome, 'Ivo Convite');

    const acessos = corpo(falso, tokenAna, 'montador-convites', { acao: 'acessos' });
    const ivo = acessos.acessos.find((a) => a.id === semSenha.perfil.id);
    const ana = acessos.acessos.find((a) => a.id === gestao.perfil.id);
    assert.equal(ivo.nuncaEntrou, false);
    assert.equal(ana.nuncaEntrou, false);
    assert.equal(corpo(falso, tokenBruno, 'montador-convites', { acao: 'acessos' }).status, 403);
});

test('os controles de admin seguem iguais: última gestão, a própria conta, senha, exclusão e questões', () => {
    const falso = criarServidorFalso();
    const gestao = corpo(falso, null, 'montador-usuarios', {
        acao: 'primeiro-acesso', nome: 'Ana Gestão', email: 'ana@escola.test', senha: 'senha-da-ana'
    }).perfil;
    const tokenAna = falso.tratar({ op: 'login', email: 'ana@escola.test', senha: 'senha-da-ana' }).data.token;
    assert.match(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'atualizar', id: gestao.id, ativo: false }).erro, /única conta da gestão/);
    assert.match(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'excluir', id: gestao.id }).erro, /única conta da gestão/);
    assert.match(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'criar', nome: 'Sem', email: 'sem@escola.test', papel: 'professor', senha: 'senha-qualquer' }).erro, /área/);
    assert.match(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'criar', nome: 'Curta', email: 'curta@escola.test', papel: 'professor', area: 'NAT', senha: '123' }).erro, /8 caracteres/);

    const segunda = corpo(falso, tokenAna, 'montador-usuarios', {
        acao: 'criar', nome: 'Bia Gestão', email: 'bia@escola.test', papel: 'gestao', senha: 'senha-da-bia'
    }).perfil;
    assert.match(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'excluir', id: gestao.id }).erro, /própria conta/);
    const prof = corpo(falso, tokenAna, 'montador-usuarios', {
        acao: 'criar', nome: 'Helena', email: 'helena@escola.test', papel: 'professor', area: 'HUM', disciplinas: 'História', senha: 'senha-da-helena'
    }).perfil;
    corpo(falso, tokenAna, 'montador-convites', { acao: 'gerar', id: prof.id });
    falso.db.montador_questoes.push({ id: 'q-helena', prova_id: 'prova', secao_id: 'secao', dados: { enunciado: 'fica' }, criada_por: prof.id });
    assert.equal(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'excluir', id: prof.id }).ok, true);
    assert.equal(falso.db.montador_perfis.some((p) => p.id === prof.id), false);
    assert.equal(falso.db.montador_convites.some((c) => c.perfil_id === prof.id), false);
    assert.equal(falso.db.montador_questoes.some((q) => q.id === 'q-helena' && q.dados.enunciado === 'fica'), true);
    corpo(falso, tokenAna, 'montador-usuarios', { acao: 'atualizar', id: segunda.id, nome: 'Bia Coordenação', email: 'bia2@escola.test', papel: 'pca', area: 'LIN', disciplinas: 'Português', senha: 'senha-nova-bia' });
    const bia = falso.db.montador_perfis.find((p) => p.id === segunda.id);
    assert.equal(bia.nome, 'Bia Coordenação');
    assert.equal(bia.email, 'bia2@escola.test');
    assert.equal(bia.papel, 'pca');
    assert.equal(bia.area, 'LIN');
    assert.deepEqual(bia.disciplinas, ['Português']);
    assert.equal(falso.db.usuarios.find((u) => u.id === bia.id).senha, 'senha-nova-bia');
    assert.equal(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'atualizar', id: segunda.id, ativo: false }).ok, true);
    assert.equal(falso.db.usuarios.find((u) => u.id === segunda.id).banido, true);
    assert.equal(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'atualizar', id: segunda.id, ativo: true }).ok, true);
    assert.equal(falso.db.usuarios.find((u) => u.id === segunda.id).banido, false);
    assert.match(corpo(falso, tokenAna, 'montador-usuarios', { acao: 'atualizar', id: gestao.id, ativo: false }).erro, /única conta da gestão/);
});

test('o SQL e as funções não abrem o Auth compartilhado nem a tabela de convites', () => {
    const sql = ler('supabase/004_montador_convites.sql');
    assert.match(sql, /create table public\.montador_convites/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /force row level security/);
    assert.match(sql, /revoke all on table public\.montador_convites from public, anon, authenticated/);
    assert.match(sql, /grant select, insert, update, delete on table public\.montador_convites to service_role/);
    assert.match(sql, /montador_convites_um_aberto/);
    assert.match(sql, /on delete cascade/);
    const sqlSemComentario = sql.replace(/--.*$/gm, '');
    assert.equal(/create policy/i.test(sqlSemComentario), false);
    assert.equal(/auth\.|smtp|site_url/i.test(sqlSemComentario), false);
    assert.equal(/alter table public\.montador_perfis/i.test(sqlSemComentario), false);

    const convites = ler('supabase/functions/montador-convites/index.ts');
    assert.match(convites, /updateUserById/);
    assert.match(convites, /hashToken/);
    assert.equal(/generateLink|inviteUserByEmail|resetPasswordForEmail/.test(convites), false);
    const usuarios = ler('supabase/functions/montador-usuarios/index.ts');
    assert.match(usuarios, /Você não pode excluir a própria conta/);
    assert.match(usuarios, /única conta da gestão/);
    assert.match(usuarios, /senhaOpcional/);
    assert.match(usuarios, /senhaAleatoria/);
});
