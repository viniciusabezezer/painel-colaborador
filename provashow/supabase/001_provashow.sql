-- ProvaShow Malu — os dados de cada professor guardados na nuvem da escola.
--
-- Mora no projeto Supabase "MapaDeAulas", ao lado do Montador de Provas,
-- separado pelo prefixo provashow_. O login é o mesmo do Montador: só entra
-- quem tem perfil ativo em montador_perfis (contas criadas pela gestão, na
-- tela Professores do Montador). Conta sem perfil ativo não vê nada.
--
-- Cada item do app (pasta, conjunto, pacote, turma, aula, sessão = uma
-- pergunta apresentada, ajustes) é uma linha em provashow_itens. O app guarda
-- uma cópia no aparelho (funciona sem internet) e sincroniza: vence a
-- alteração mais nova ("alterado", o relógio do item).
--
-- Relatórios não se perdem:
--   - ninguém apaga linha nenhuma pela API (não há regra de DELETE): excluir
--     no app é só marcar "removido", e dá para restaurar;
--   - toda mudança em turmas, aulas e sessões guarda a versão anterior em
--     provashow_versoes, que só recebe linhas (ninguém altera nem apaga);
--   - os dados não dependem da conta continuar existindo (sem chave
--     estrangeira para auth.users) e a gestão lê os dados de todos.

-- ===================== quem é quem =====================

create schema if not exists provashow_priv;
revoke all on schema provashow_priv from public, anon;
grant usage on schema provashow_priv to authenticated;

create function provashow_priv.membro() returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.montador_perfis where id = (select auth.uid()) and ativo)
$$;

create function provashow_priv.gestao() returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.montador_perfis where id = (select auth.uid()) and ativo and papel = 'gestao')
$$;

revoke execute on function provashow_priv.membro(), provashow_priv.gestao() from public, anon;
grant execute on function provashow_priv.membro(), provashow_priv.gestao() to authenticated;

-- ===================== tabelas =====================

create table public.provashow_itens (
    dono uuid not null default auth.uid(),
    id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    tipo text not null check (tipo in ('pasta', 'conjunto', 'pacote', 'turma', 'aula', 'sessao', 'config')),
    dados jsonb not null check (octet_length(dados::text) < 8000000),
    alterado timestamptz not null,                 -- relógio do item (quem vence a sincronização)
    removido timestamptz,                          -- na lixeira do app (nunca apagado de fato)
    atualizado_em timestamptz not null default now(),  -- relógio do servidor (baixar só o que mudou)
    criado_em timestamptz not null default now(),
    primary key (dono, id)
);
create index provashow_itens_baixar on public.provashow_itens (dono, atualizado_em);
create index provashow_itens_tipo on public.provashow_itens (tipo, atualizado_em);

create table public.provashow_versoes (
    seq bigint generated always as identity primary key,
    dono uuid not null,
    id text not null,
    tipo text not null,
    dados jsonb not null,
    alterado timestamptz not null,
    removido timestamptz,
    substituida_por uuid,
    substituida_em timestamptz not null default now()
);
create index provashow_versoes_item on public.provashow_versoes (dono, id, seq);

-- ===================== carimbos =====================

-- Antes de gravar: dono, id e tipo não mudam; uma versão mais velha não
-- sobrescreve uma mais nova (o aparelho atrasado não desfaz o trabalho do
-- outro); o relógio do servidor marca a mudança.
create function provashow_priv.antes_de_gravar() returns trigger
language plpgsql set search_path = '' as $$
begin
    if tg_op = 'UPDATE' then
        if new.alterado < old.alterado then
            return null;
        end if;
        new.dono := old.dono;
        new.id := old.id;
        new.tipo := old.tipo;
        new.criado_em := old.criado_em;
    else
        new.dono := coalesce(auth.uid(), new.dono);
        new.criado_em := now();
    end if;
    new.atualizado_em := clock_timestamp();
    return new;
end
$$;
create trigger provashow_itens_antes before insert or update on public.provashow_itens
    for each row execute function provashow_priv.antes_de_gravar();

-- Depois de alterar turma, aula ou sessão: a versão anterior vai para o histórico.
create function provashow_priv.guardar_versao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if old.tipo in ('turma', 'aula', 'sessao')
       and (old.dados is distinct from new.dados or old.removido is distinct from new.removido) then
        insert into public.provashow_versoes (dono, id, tipo, dados, alterado, removido, substituida_por)
        values (old.dono, old.id, old.tipo, old.dados, old.alterado, old.removido, auth.uid());
    end if;
    return null;
end
$$;
create trigger provashow_itens_versao after update on public.provashow_itens
    for each row execute function provashow_priv.guardar_versao();

revoke execute on function provashow_priv.antes_de_gravar(), provashow_priv.guardar_versao() from public, anon, authenticated;

-- ===================== regras (RLS) =====================

alter table public.provashow_itens enable row level security;
alter table public.provashow_versoes enable row level security;

create policy "ver os seus (e a gestão vê todos)" on public.provashow_itens for select to authenticated
    using ((dono = (select auth.uid()) and (select provashow_priv.membro())) or (select provashow_priv.gestao()));
create policy "criar os seus" on public.provashow_itens for insert to authenticated
    with check (dono = (select auth.uid()) and (select provashow_priv.membro()));
create policy "alterar os seus" on public.provashow_itens for update to authenticated
    using (dono = (select auth.uid()) and (select provashow_priv.membro()))
    with check (dono = (select auth.uid()) and (select provashow_priv.membro()));
-- de propósito, nenhuma regra de DELETE: nada se apaga pela API.

create policy "ver o histórico dos seus (e a gestão vê todos)" on public.provashow_versoes for select to authenticated
    using ((dono = (select auth.uid()) and (select provashow_priv.membro())) or (select provashow_priv.gestao()));
-- o histórico só recebe linhas pelo gatilho: ninguém insere, altera ou apaga pela API.

revoke all on public.provashow_itens, public.provashow_versoes from anon, public;
grant select, insert, update on public.provashow_itens to authenticated;
grant select on public.provashow_versoes to authenticated;

-- Segunda camada: além das regras (RLS) sem DELETE, as contas não têm nem a
-- permissão de tabela para apagar, esvaziar (TRUNCATE) ou mexer no histórico
-- (o Supabase dá todas por padrão a "authenticated").
revoke all on public.provashow_itens, public.provashow_versoes from authenticated;
grant select, insert, update on public.provashow_itens to authenticated;
grant select on public.provashow_versoes to authenticated;
