-- Montador de Provas — convite por link (a gestão copia e manda no WhatsApp).
--
-- Aditivo: só cria a tabela montador_convites. Não altera tabelas, regras,
-- Auth, Site URL, Redirect URLs, modelos de e-mail nem SMTP (o projeto é
-- compartilhado com o Mapa de Aulas).
--
-- O token em claro só existe no link. Aqui fica o SHA-256 em hexadecimal.
-- A Edge Function montador-convites (chave de serviço) é quem lê e grava.
-- A RLS fica ligada, forçada, e sem política: anon e authenticated não
-- passam, nem pela API nem se alguém tentar a tabela direto.
--
-- Rode este arquivo uma vez, no SQL Editor, depois de 001, 002 e 003.

create table public.montador_convites (
    id uuid primary key default gen_random_uuid(),
    perfil_id uuid not null references public.montador_perfis (id) on delete cascade,
    token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
    criado_em timestamptz not null default now(),
    expira_em timestamptz not null,
    usado_em timestamptz,
    revogado_em timestamptz,
    criado_por uuid references public.montador_perfis (id) on delete set null
);

comment on table public.montador_convites is
    'Convites do Montador. O token só entra como hash. Sem política de RLS: apenas a função montador-convites, com a chave de serviço, acessa.';

create unique index montador_convites_token_hash on public.montador_convites (token_hash);

-- no máximo um convite em aberto por pessoa; gerar outro revoga o anterior
create unique index montador_convites_um_aberto
    on public.montador_convites (perfil_id)
    where usado_em is null and revogado_em is null;

alter table public.montador_convites enable row level security;
alter table public.montador_convites force row level security;

revoke all on table public.montador_convites from public, anon, authenticated;
grant select, insert, update, delete on table public.montador_convites to service_role;
