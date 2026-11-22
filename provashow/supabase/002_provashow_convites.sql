-- ProvaShow Malu — convite para professor NOVO criar o próprio login.
--
-- A gestão (Administração, no app) digita só o nome; o app gera um link e
-- manda pelo WhatsApp. A pessoa abre, escolhe o e-mail e a senha, e a conta
-- nasce já com perfil ativo em montador_perfis (vale no ProvaShow e no
-- Montador). Para quem JÁ tem conta, o app usa o convite do Montador
-- (montador_convites), que só define a senha.
--
-- Aditivo: só cria esta tabela. Não mexe em Auth, Site URL, Redirect URLs,
-- e-mail nem em tabelas existentes (o projeto é compartilhado com o Mapa de
-- Aulas). O token em claro só existe no link; aqui fica o SHA-256. Só a
-- Edge Function provashow-convites (chave de serviço) lê e grava: RLS
-- ligada, forçada e sem política.

create table public.provashow_convites (
    id uuid primary key default gen_random_uuid(),
    nome text not null check (char_length(nome) between 2 and 120),
    papel text not null default 'professor' check (papel in ('pca', 'professor')),
    area text check (area in ('LIN', 'NAT', 'HUM', 'MAT', 'RED')),
    telefone text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
    token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
    criado_em timestamptz not null default now(),
    expira_em timestamptz not null,
    usado_em timestamptz,
    revogado_em timestamptz,
    criado_por uuid references public.montador_perfis (id) on delete set null,
    perfil_id uuid references public.montador_perfis (id) on delete set null
);

comment on table public.provashow_convites is
    'Convites do ProvaShow para professor novo criar login e senha. Token só como hash. Sem política de RLS: apenas a função provashow-convites acessa.';

create unique index provashow_convites_token_hash on public.provashow_convites (token_hash);
create index provashow_convites_criado_em on public.provashow_convites (criado_em desc);

alter table public.provashow_convites enable row level security;
alter table public.provashow_convites force row level security;

revoke all on table public.provashow_convites from public, anon, authenticated;
grant select, insert, update, delete on table public.provashow_convites to service_role;
