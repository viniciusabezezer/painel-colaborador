-- Montador de Provas da Malu — provas da área, montadas a várias mãos.
--
-- Mora no projeto Supabase "MapaDeAulas" (o plano gratuito só tem duas vagas
-- de projeto), separado de tudo o que é de lá pelo prefixo montador_.
--
-- Papéis (montador_perfis.papel):
--   gestao    — cadastra professores e vê/edita todas as provas;
--   pca       — coordena as provas da sua área: formato, seções, revisão,
--               travar; edita qualquer questão da área e escreve as suas;
--   professor — escreve as questões das seções atribuídas a ele e vê a prova
--               inteira da área, sem mexer no que é dos colegas.
-- Quem não tem perfil ativo (inclusive contas do MapaDeAulas) não vê nada.
--
-- As regras moram aqui, no banco (RLS): a tela só esconde o que o banco já
-- não deixaria fazer.

-- ===================== tabelas =====================

create table public.montador_perfis (
    id uuid primary key references auth.users (id) on delete cascade,
    nome text not null,
    email text not null,
    papel text not null check (papel in ('gestao', 'pca', 'professor')),
    area text check (area in ('LIN', 'NAT', 'HUM', 'MAT', 'RED')),
    disciplinas text[] not null default '{}',
    ativo boolean not null default true,
    criado_em timestamptz not null default now()
);

create table public.montador_provas (
    id uuid primary key default gen_random_uuid(),
    titulo text not null default '',
    componente text not null check (componente in ('LIN', 'NAT', 'HUM', 'MAT', 'RED')),
    serie text,
    bimestre text,
    ano text,
    modelo_id text not null default 'bimestral-malu',
    dados jsonb not null default '{}'::jsonb,      -- o "casco" da prova: formato, aparência, instruções, gabarito
    prazo date,
    situacao text not null default 'aberta' check (situacao in ('aberta', 'travada')),
    criada_por uuid references public.montador_perfis (id) on delete set null default auth.uid(),
    criada_em timestamptz not null default now(),
    atualizada_por uuid references public.montador_perfis (id) on delete set null,
    atualizada_em timestamptz not null default now()
);

create table public.montador_secoes (
    id uuid primary key default gen_random_uuid(),
    prova_id uuid not null references public.montador_provas (id) on delete cascade,
    titulo text not null default '',
    icone text not null default 'auto',
    ordem integer not null default 0,
    responsavel uuid references public.montador_perfis (id) on delete set null,
    situacao text not null default 'rascunho' check (situacao in ('rascunho', 'pronta', 'devolvida', 'aprovada')),
    atualizada_em timestamptz not null default now()
);
create index montador_secoes_prova on public.montador_secoes (prova_id);
create index montador_secoes_responsavel on public.montador_secoes (responsavel);

-- id em texto: a questão nasce no navegador (q-…), também sem internet
create table public.montador_questoes (
    id text primary key,
    prova_id uuid not null references public.montador_provas (id) on delete cascade,
    secao_id uuid not null references public.montador_secoes (id) on delete cascade,
    ordem integer not null default 0,
    dados jsonb not null,
    criada_por uuid references public.montador_perfis (id) on delete set null default auth.uid(),
    criada_em timestamptz not null default now(),
    atualizada_por uuid references public.montador_perfis (id) on delete set null default auth.uid(),
    atualizada_em timestamptz not null default now()
);
create index montador_questoes_prova on public.montador_questoes (prova_id);
create index montador_questoes_secao on public.montador_questoes (secao_id);

create table public.montador_comentarios (
    id uuid primary key default gen_random_uuid(),
    prova_id uuid not null references public.montador_provas (id) on delete cascade,
    secao_id uuid references public.montador_secoes (id) on delete cascade,
    questao_id text,
    autor uuid references public.montador_perfis (id) on delete set null default auth.uid(),
    texto text not null check (length(texto) between 1 and 4000),
    tipo text not null default 'comentario' check (tipo in ('comentario', 'devolucao', 'aprovacao', 'pronta')),
    resolvido boolean not null default false,
    criado_em timestamptz not null default now()
);
create index montador_comentarios_prova on public.montador_comentarios (prova_id);
create index montador_comentarios_secao on public.montador_comentarios (secao_id);

-- ===================== quem é quem =====================

create function public.montador_papel() returns text
language sql stable security definer set search_path = '' as $$
    select papel from public.montador_perfis where id = (select auth.uid()) and ativo
$$;

create function public.montador_area() returns text
language sql stable security definer set search_path = '' as $$
    select area from public.montador_perfis where id = (select auth.uid()) and ativo
$$;

-- gestão, ou PCA da área da prova
create function public.montador_coordena(p_prova uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.montador_perfis eu
        where eu.id = (select auth.uid()) and eu.ativo
          and (eu.papel = 'gestao'
               or (eu.papel = 'pca' and eu.area = (select componente from public.montador_provas where id = p_prova)))
    )
$$;

-- coordena, é da área, ou tem seção na prova
create function public.montador_pode_ver(p_prova uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.montador_perfis eu
        where eu.id = (select auth.uid()) and eu.ativo
          and (eu.papel = 'gestao'
               or eu.area = (select componente from public.montador_provas where id = p_prova)
               or exists (select 1 from public.montador_secoes s where s.prova_id = p_prova and s.responsavel = eu.id))
    )
$$;

-- a pasta das imagens no storage é o id da prova
create function public.montador_pode_ver_pasta(p_pasta text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
    if p_pasta !~ '^[0-9a-f-]{36}$' then return false; end if;
    return public.montador_pode_ver(p_pasta::uuid);
end
$$;

-- escrever na seção: prova aberta e (coordena, ou é o responsável e a seção
-- ainda não foi aprovada)
create function public.montador_pode_escrever(p_secao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.montador_secoes s
        join public.montador_provas p on p.id = s.prova_id
        where s.id = p_secao and p.situacao = 'aberta'
          and (public.montador_coordena(p.id)
               or (s.responsavel = (select auth.uid()) and s.situacao <> 'aprovada'
                   and public.montador_papel() is not null))
    )
$$;

-- ===================== carimbos =====================

create function public.montador_carimbo_questao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    -- a questão sempre pertence à prova da sua seção
    select prova_id into new.prova_id from public.montador_secoes where id = new.secao_id;
    new.atualizada_por := auth.uid();
    new.atualizada_em := now();
    if tg_op = 'INSERT' then
        new.criada_por := coalesce(auth.uid(), new.criada_por);
        new.criada_em := now();
    else
        new.criada_por := old.criada_por;
        new.criada_em := old.criada_em;
    end if;
    -- quem escreve numa seção devolvida volta a trabalhar nela
    update public.montador_secoes set situacao = 'rascunho', atualizada_em = now()
        where id = new.secao_id and situacao = 'devolvida' and responsavel = auth.uid();
    update public.montador_provas set atualizada_em = now(), atualizada_por = auth.uid() where id = new.prova_id;
    return new;
end
$$;
create trigger montador_questoes_carimbo before insert or update on public.montador_questoes
    for each row execute function public.montador_carimbo_questao();

create function public.montador_carimbo_tempo() returns trigger
language plpgsql set search_path = '' as $$
begin
    new.atualizada_em := now();
    return new;
end
$$;
create trigger montador_secoes_carimbo before update on public.montador_secoes
    for each row execute function public.montador_carimbo_tempo();

create function public.montador_carimbo_prova() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    new.atualizada_em := now();
    new.atualizada_por := auth.uid();
    if tg_op = 'UPDATE' then
        new.criada_por := old.criada_por;
        new.criada_em := old.criada_em;
    end if;
    return new;
end
$$;
create trigger montador_provas_carimbo before insert or update on public.montador_provas
    for each row execute function public.montador_carimbo_prova();

-- ===================== o professor avisa que terminou =====================

-- O professor não altera a seção diretamente (título, responsável e ordem são
-- do PCA); só muda a situação dela entre rascunho e pronta, por aqui.
create function public.montador_marcar_secao(p_secao uuid, p_pronta boolean, p_nota text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
    s record;
begin
    select sec.*, pr.situacao as prova_situacao into s
        from public.montador_secoes sec join public.montador_provas pr on pr.id = sec.prova_id
        where sec.id = p_secao;
    if not found then raise exception 'Seção não encontrada.'; end if;
    if s.prova_situacao <> 'aberta' then raise exception 'A prova está travada para impressão.'; end if;
    if not (s.responsavel = auth.uid() or public.montador_coordena(s.prova_id)) then
        raise exception 'Só o responsável pela seção pode marcá-la.';
    end if;
    if s.situacao = 'aprovada' and not public.montador_coordena(s.prova_id) then
        raise exception 'A seção já foi aprovada pelo PCA.';
    end if;
    update public.montador_secoes set situacao = case when p_pronta then 'pronta' else 'rascunho' end
        where id = p_secao;
    if p_pronta then
        insert into public.montador_comentarios (prova_id, secao_id, texto, tipo)
            values (s.prova_id, p_secao, coalesce(nullif(trim(p_nota), ''), 'Seção pronta para revisão.'), 'pronta');
    end if;
    return case when p_pronta then 'pronta' else 'rascunho' end;
end
$$;

-- ===================== permissões (RLS) =====================

alter table public.montador_perfis enable row level security;
alter table public.montador_provas enable row level security;
alter table public.montador_secoes enable row level security;
alter table public.montador_questoes enable row level security;
alter table public.montador_comentarios enable row level security;

-- perfis: todo membro ativo vê a lista (nomes nas seções); só a gestão altera.
-- Criar conta é pela função montador-usuarios, que tem a chave de serviço.
create policy "membros veem perfis" on public.montador_perfis for select to authenticated
    using (public.montador_papel() is not null or id = (select auth.uid()));
create policy "gestao altera perfis" on public.montador_perfis for update to authenticated
    using (public.montador_papel() = 'gestao') with check (public.montador_papel() = 'gestao');

-- provas
create policy "ver provas" on public.montador_provas for select to authenticated
    using (public.montador_pode_ver(id));
create policy "criar provas" on public.montador_provas for insert to authenticated
    with check (public.montador_papel() = 'gestao'
                or (public.montador_papel() = 'pca' and public.montador_area() = componente));
create policy "coordenar provas" on public.montador_provas for update to authenticated
    using (public.montador_coordena(id))
    with check (public.montador_papel() = 'gestao'
                or (public.montador_papel() = 'pca' and public.montador_area() = componente));
create policy "apagar provas" on public.montador_provas for delete to authenticated
    using (public.montador_coordena(id));

-- seções: o PCA monta; o professor muda a situação pela função acima
create policy "ver secoes" on public.montador_secoes for select to authenticated
    using (public.montador_pode_ver(prova_id));
create policy "criar secoes" on public.montador_secoes for insert to authenticated
    with check (public.montador_coordena(prova_id));
create policy "alterar secoes" on public.montador_secoes for update to authenticated
    using (public.montador_coordena(prova_id)) with check (public.montador_coordena(prova_id));
create policy "apagar secoes" on public.montador_secoes for delete to authenticated
    using (public.montador_coordena(prova_id));

-- questões
create policy "ver questoes" on public.montador_questoes for select to authenticated
    using (public.montador_pode_ver(prova_id));
create policy "criar questoes" on public.montador_questoes for insert to authenticated
    with check (public.montador_pode_escrever(secao_id));
create policy "alterar questoes" on public.montador_questoes for update to authenticated
    using (public.montador_pode_escrever(secao_id)) with check (public.montador_pode_escrever(secao_id));
create policy "apagar questoes" on public.montador_questoes for delete to authenticated
    using (public.montador_pode_escrever(secao_id));

-- comentários: quem vê a prova comenta; devolver e aprovar é do PCA
create policy "ver comentarios" on public.montador_comentarios for select to authenticated
    using (public.montador_pode_ver(prova_id));
create policy "comentar" on public.montador_comentarios for insert to authenticated
    with check (public.montador_pode_ver(prova_id) and autor = (select auth.uid())
                and (tipo = 'comentario' or public.montador_coordena(prova_id)));
create policy "resolver comentarios" on public.montador_comentarios for update to authenticated
    using (autor = (select auth.uid()) or public.montador_coordena(prova_id))
    with check (public.montador_pode_ver(prova_id));
create policy "apagar comentarios" on public.montador_comentarios for delete to authenticated
    using (autor = (select auth.uid()) or public.montador_coordena(prova_id));

-- as funções auxiliares não ficam à mão de quem não está logado
revoke execute on function public.montador_papel(), public.montador_area(), public.montador_coordena(uuid),
    public.montador_pode_ver(uuid), public.montador_pode_ver_pasta(text), public.montador_pode_escrever(uuid),
    public.montador_marcar_secao(uuid, boolean, text) from public, anon;
grant execute on function public.montador_papel(), public.montador_area(), public.montador_coordena(uuid),
    public.montador_pode_ver(uuid), public.montador_pode_ver_pasta(text), public.montador_pode_escrever(uuid),
    public.montador_marcar_secao(uuid, boolean, text) to authenticated;
revoke execute on function public.montador_carimbo_questao(), public.montador_carimbo_tempo(),
    public.montador_carimbo_prova() from public, anon, authenticated;

-- ===================== imagens das questões =====================

-- privado: a prova é sigilosa até ser aplicada
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('montador-imagens', 'montador-imagens', false, 5242880, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy "montador ver imagens" on storage.objects for select to authenticated
    using (bucket_id = 'montador-imagens' and public.montador_pode_ver_pasta((storage.foldername(name))[1]));
create policy "montador enviar imagens" on storage.objects for insert to authenticated
    with check (bucket_id = 'montador-imagens' and public.montador_pode_ver_pasta((storage.foldername(name))[1]));
create policy "montador apagar imagens" on storage.objects for delete to authenticated
    using (bucket_id = 'montador-imagens' and public.montador_pode_ver_pasta((storage.foldername(name))[1]));

-- ===================== tempo real =====================

alter publication supabase_realtime add table public.montador_provas, public.montador_secoes,
    public.montador_questoes, public.montador_comentarios;
