-- Malu Gabaritos — leituras dos cartões e códigos de verificação.
--
-- NÃO foi aplicado em produção. Rode este arquivo uma vez no SQL Editor do
-- projeto MapaDeAulas (yncpicdkrntvwfdxrvab), depois das migrações 001 a 004.
-- Não altera as tabelas montador_* que já existem. Só cria tabelas corretor_*,
-- um bucket privado para as fotos e uma rotina que apaga foto com mais de 3 dias.
--
-- Quem corrige: o PCA da área da prova e o professor da turma.
-- Se a cópia não tiver professor_id, vale o professor responsável por uma seção
-- da prova (o mesmo vínculo que o Montador já usa).
-- A gestão vê o resultado e não grava leitura nem recuperação.

-- ===================== tabelas =====================

create table public.corretor_copias (
    id uuid primary key default gen_random_uuid(),
    prova_id uuid not null references public.montador_provas (id) on delete cascade,
    turma text not null default '',
    sala text not null default '',
    lista integer,
    copia_id text not null,
    qr_codigo text,
    codigo text not null,
    semente text not null,
    letras jsonb not null default '[]'::jsonb,
    contas jsonb not null default '[]'::jsonb,
    professor_id uuid references public.montador_perfis (id) on delete set null,
    criado_em timestamptz not null default now(),
    unique (prova_id, copia_id)
);
create index corretor_copias_prova on public.corretor_copias (prova_id);
create index corretor_copias_professor on public.corretor_copias (professor_id);

create table public.corretor_leituras (
    id uuid primary key default gen_random_uuid(),
    prova_id uuid not null references public.montador_provas (id) on delete cascade,
    copia_id text,
    turma text not null default '',
    sala text not null default '',
    lista integer,
    lido_por uuid references public.montador_perfis (id) on delete set null default auth.uid(),
    lido_em timestamptz not null default now(),
    respostas jsonb not null default '{}'::jsonb,
    codigo_lido text,
    status_codigo text check (status_codigo is null or status_codigo in ('correto', 'em_branco', 'incorreto', 'ambiguo')),
    confianca numeric,
    alertas jsonb not null default '[]'::jsonb,
    versao_chave integer not null default 1,
    imagem_path text,
    imagem_expira_em timestamptz,
    nome_lista text
);
create index corretor_leituras_prova on public.corretor_leituras (prova_id);

create table public.corretor_recuperacoes (
    id uuid primary key default gen_random_uuid(),
    leitura_id uuid not null references public.corretor_leituras (id) on delete cascade,
    prova_id uuid not null references public.montador_provas (id) on delete cascade,
    status text not null default 'aberta' check (status in ('aberta', 'recuperada', 'nao_recuperada')),
    modalidade text check (modalidade is null or modalidade in ('a_tarefa', 'b_restaurativa', 'c_oral')),
    quando date,
    por uuid references public.montador_perfis (id) on delete set null,
    obs text,
    prazo date
);
create index corretor_recuperacoes_prova on public.corretor_recuperacoes (prova_id);

create table public.corretor_chave_ajustes (
    id uuid primary key default gen_random_uuid(),
    prova_id uuid not null references public.montador_provas (id) on delete cascade,
    questao integer not null,
    de text,
    para text,
    por uuid references public.montador_perfis (id) on delete set null default auth.uid(),
    quando timestamptz not null default now()
);

create table public.corretor_prazos (
    ano text not null,
    bimestre text not null,
    prazo date not null,
    primary key (ano, bimestre)
);

-- ===================== quem pode corrigir =====================

create function montador_priv.corretor_pode_corrigir(p_prova uuid, p_turma text) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1
        from public.montador_perfis eu
        join public.montador_provas p on p.id = p_prova
        where eu.id = (select auth.uid())
          and eu.ativo
          and eu.papel <> 'gestao'
          and (
            (eu.papel = 'pca' and eu.area = p.componente)
            or exists (
                select 1 from public.corretor_copias c
                where c.prova_id = p_prova
                  and c.professor_id = eu.id
                  and (p_turma is null or c.turma = p_turma)
            )
            or (
                eu.papel = 'professor'
                and exists (
                    select 1 from public.montador_secoes s
                    where s.prova_id = p_prova and s.responsavel = eu.id
                )
                and (
                    p_turma is null
                    or not exists (
                        select 1 from public.corretor_copias c
                        where c.prova_id = p_prova and c.turma = p_turma and c.professor_id is not null
                    )
                )
            )
          )
    )
$$;

revoke all on function montador_priv.corretor_pode_corrigir(uuid, text) from public, anon;
grant execute on function montador_priv.corretor_pode_corrigir(uuid, text) to authenticated;

-- ===================== fotos: 3 dias =====================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('corretor-cartoes', 'corretor-cartoes', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function montador_priv.corretor_limpar_fotos() returns integer
language plpgsql security definer set search_path = '' as $$
declare
    n integer := 0;
begin
    delete from storage.objects o
    using public.corretor_leituras l
    where o.bucket_id = 'corretor-cartoes'
      and l.imagem_path = o.name
      and l.imagem_expira_em is not null
      and l.imagem_expira_em < now();
    update public.corretor_leituras
        set imagem_path = null
        where imagem_path is not null
          and imagem_expira_em is not null
          and imagem_expira_em < now();
    get diagnostics n = row_count;
    return n;
end
$$;

revoke all on function montador_priv.corretor_limpar_fotos() from public, anon, authenticated;

-- Se o projeto tiver pg_cron, a limpeza roda todo dia às 3h. Sem a extensão,
-- o Malu Gabaritos também apaga as fotos vencidas quando um professor abre o app.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.schedule(
            'corretor-limpar-fotos',
            '0 3 * * *',
            'select montador_priv.corretor_limpar_fotos()'
        );
    end if;
exception when others then
    null;
end
$$;

-- ===================== regras =====================

alter table public.corretor_copias enable row level security;
alter table public.corretor_leituras enable row level security;
alter table public.corretor_recuperacoes enable row level security;
alter table public.corretor_chave_ajustes enable row level security;
alter table public.corretor_prazos enable row level security;

create policy "ver copias" on public.corretor_copias for select to authenticated
    using (
        montador_priv.montador_pode_ver(prova_id)
        or montador_priv.corretor_pode_corrigir(prova_id, turma)
    );
create policy "gravar copias" on public.corretor_copias for insert to authenticated
    with check (montador_priv.montador_coordena(prova_id));
create policy "atualizar copias" on public.corretor_copias for update to authenticated
    using (montador_priv.montador_coordena(prova_id))
    with check (montador_priv.montador_coordena(prova_id));
create policy "apagar copias" on public.corretor_copias for delete to authenticated
    using (montador_priv.montador_coordena(prova_id));

create policy "ver leituras" on public.corretor_leituras for select to authenticated
    using (montador_priv.montador_pode_ver(prova_id) or montador_priv.corretor_pode_corrigir(prova_id, turma));
create policy "gravar leituras" on public.corretor_leituras for insert to authenticated
    with check (montador_priv.corretor_pode_corrigir(prova_id, nullif(turma, '')));
create policy "atualizar leituras" on public.corretor_leituras for update to authenticated
    using (montador_priv.corretor_pode_corrigir(prova_id, nullif(turma, '')))
    with check (montador_priv.corretor_pode_corrigir(prova_id, nullif(turma, '')));
create policy "apagar leituras" on public.corretor_leituras for delete to authenticated
    using (montador_priv.corretor_pode_corrigir(prova_id, nullif(turma, '')));

create policy "ver recuperacoes" on public.corretor_recuperacoes for select to authenticated
    using (montador_priv.montador_pode_ver(prova_id) or montador_priv.corretor_pode_corrigir(prova_id, null));
create policy "gravar recuperacoes" on public.corretor_recuperacoes for insert to authenticated
    with check (montador_priv.corretor_pode_corrigir(prova_id, null));
create policy "atualizar recuperacoes" on public.corretor_recuperacoes for update to authenticated
    using (montador_priv.corretor_pode_corrigir(prova_id, null))
    with check (montador_priv.corretor_pode_corrigir(prova_id, null));

create policy "ver ajustes de chave" on public.corretor_chave_ajustes for select to authenticated
    using (montador_priv.montador_pode_ver(prova_id));
create policy "gravar ajuste de chave" on public.corretor_chave_ajustes for insert to authenticated
    with check (montador_priv.corretor_pode_corrigir(prova_id, null));

create policy "ver prazos" on public.corretor_prazos for select to authenticated
    using (montador_priv.montador_papel() is not null);
create policy "gestao grava prazo" on public.corretor_prazos for insert to authenticated
    with check (montador_priv.montador_papel() = 'gestao');
create policy "gestao altera prazo" on public.corretor_prazos for update to authenticated
    using (montador_priv.montador_papel() = 'gestao')
    with check (montador_priv.montador_papel() = 'gestao');

create policy "corretor ver fotos" on storage.objects for select to authenticated
    using (
        bucket_id = 'corretor-cartoes'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and (
            montador_priv.montador_pode_ver(((storage.foldername(name))[1])::uuid)
            or montador_priv.corretor_pode_corrigir(((storage.foldername(name))[1])::uuid, null)
        )
    );
create policy "corretor enviar fotos" on storage.objects for insert to authenticated
    with check (
        bucket_id = 'corretor-cartoes'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and montador_priv.corretor_pode_corrigir(((storage.foldername(name))[1])::uuid, null)
    );
create policy "corretor apagar fotos" on storage.objects for delete to authenticated
    using (
        bucket_id = 'corretor-cartoes'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and montador_priv.corretor_pode_corrigir(((storage.foldername(name))[1])::uuid, null)
    );
