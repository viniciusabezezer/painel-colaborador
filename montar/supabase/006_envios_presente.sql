-- Malu Gabaritos — histórico de envio das notas ao Malu Presente.
--
-- NÃO foi aplicado em produção. Rode este arquivo uma vez no SQL Editor do
-- projeto MapaDeAulas (yncpicdkrntvwfdxrvab), depois das migrações 001 a 005.
-- Não altera prova, leitura nem recuperação. Só cria corretor_envios_presente.
--
-- Quem grava a linha é a Edge Function gabaritos-enviar-presente, com a chave
-- de serviço. O navegador não insere. Gestão, PCA e professor da prova podem
-- ler o histórico (turma e número da lista, sem nome e sem nota avulsa além
-- do que o envio já registrou). Quem envia, a função confere: só o PCA ativo
-- da área.

create table public.corretor_envios_presente (
    id uuid primary key default gen_random_uuid(),
    prova_id uuid not null references public.montador_provas (id) on delete cascade,
    lote_id uuid not null unique,
    enviado_por uuid references public.montador_perfis (id) on delete set null,
    enviado_por_nome text not null default '',
    enviado_em timestamptz not null default now(),
    recebidas integer,
    sem_correspondencia jsonb not null default '[]'::jsonb,
    assinatura text not null default '',
    ok boolean not null default false,
    erro text
);
create index corretor_envios_presente_prova
    on public.corretor_envios_presente (prova_id, enviado_em desc);

alter table public.corretor_envios_presente enable row level security;

create policy "ver envios ao presente" on public.corretor_envios_presente
    for select to authenticated
    using (montador_priv.montador_pode_ver(prova_id));

revoke all on public.corretor_envios_presente from anon;
grant select on public.corretor_envios_presente to authenticated;
