-- Ao criar a prova (insert … returning), o banco confere se quem grava pode
-- ver a linha nova; montador_pode_ver(id) procurava a prova na tabela, onde
-- ela ainda não está visível naquele instante. A regra de leitura passa a usar
-- a área da própria linha.

create or replace function montador_priv.montador_pode_ver_prova(p_prova uuid, p_componente text) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.montador_perfis eu
        where eu.id = (select auth.uid()) and eu.ativo
          and (eu.papel = 'gestao'
               or eu.area = p_componente
               or exists (select 1 from public.montador_secoes s where s.prova_id = p_prova and s.responsavel = eu.id))
    )
$$;
revoke execute on function montador_priv.montador_pode_ver_prova(uuid, text) from public, anon;
grant execute on function montador_priv.montador_pode_ver_prova(uuid, text) to authenticated;

alter policy "ver provas" on public.montador_provas
    using (montador_priv.montador_pode_ver_prova(id, componente));
