-- As funções que as regras usam saem da API (esquema montador_priv, que o
-- PostgREST não expõe): ninguém as chama por /rest/v1/rpc. As regras (RLS)
-- continuam apontando para elas, porque o Postgres guarda a função, não o nome.
-- Só montador_marcar_secao fica pública: é o "avisar que terminei" do professor.

create schema if not exists montador_priv;
revoke all on schema montador_priv from public, anon;
grant usage on schema montador_priv to authenticated;

alter function public.montador_papel() set schema montador_priv;
alter function public.montador_area() set schema montador_priv;
alter function public.montador_coordena(uuid) set schema montador_priv;
alter function public.montador_pode_ver(uuid) set schema montador_priv;
alter function public.montador_pode_ver_pasta(text) set schema montador_priv;
alter function public.montador_pode_escrever(uuid) set schema montador_priv;

create or replace function montador_priv.montador_pode_ver_pasta(p_pasta text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
    if p_pasta !~ '^[0-9a-f-]{36}$' then return false; end if;
    return montador_priv.montador_pode_ver(p_pasta::uuid);
end
$$;

create or replace function montador_priv.montador_pode_escrever(p_secao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.montador_secoes s
        join public.montador_provas p on p.id = s.prova_id
        where s.id = p_secao and p.situacao = 'aberta'
          and (montador_priv.montador_coordena(p.id)
               or (s.responsavel = (select auth.uid()) and s.situacao <> 'aprovada'
                   and montador_priv.montador_papel() is not null))
    )
$$;

create or replace function public.montador_marcar_secao(p_secao uuid, p_pronta boolean, p_nota text default null)
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
    if not (s.responsavel = auth.uid() or montador_priv.montador_coordena(s.prova_id)) then
        raise exception 'Só o responsável pela seção pode marcá-la.';
    end if;
    if s.situacao = 'aprovada' and not montador_priv.montador_coordena(s.prova_id) then
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
revoke execute on function public.montador_marcar_secao(uuid, boolean, text) from public, anon;
grant execute on function public.montador_marcar_secao(uuid, boolean, text) to authenticated;

revoke execute on all functions in schema montador_priv from public, anon;
grant execute on all functions in schema montador_priv to authenticated;
