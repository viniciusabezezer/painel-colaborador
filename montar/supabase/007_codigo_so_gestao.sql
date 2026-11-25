-- Código de verificação: só a coordenação (papel Gestão) liga, configura e gera.
--
-- NÃO foi aplicado em produção. Rode este arquivo uma vez no SQL Editor do
-- projeto MapaDeAulas (yncpicdkrntvwfdxrvab), depois das migrações 001 a 004.
-- Se 005 já tiver sido aplicada, este arquivo também fecha a escrita dos
-- códigos gerados; se não, essa parte é pulada (rode 007 de novo depois de 005).
--
-- A tela já esconde a opção de quem não é Gestão. Isto aqui é o que vale de
-- verdade: o PCA e o professor não conseguem ligar nem alterar o código nem
-- por fora da tela.
--
-- 1) montador_provas.dados guarda o "casco" da prova. Quando quem grava não é
--    Gestão, as quatro chaves do código voltam ao valor que já estava gravado
--    (ou somem, se a prova nunca teve): codigoVerificacao, codigos,
--    turmasCodigo e prazoNotas. Não dá erro: o PCA segue salvando formato,
--    instruções e o resto normalmente, e um navegador com a prova desatualizada
--    não desliga por engano um código que a Gestão ligou depois. copiaPrevia
--    (qual cópia aparece na prévia) fica livre.
--    Sem pessoa logada (SQL Editor, chave de serviço) nada é mexido.
-- 2) corretor_copias (os códigos de cada aluno): só a Gestão grava, atualiza e
--    apaga. Quem corrige continua lendo, como antes.

-- ===================== o casco da prova =====================

create or replace function montador_priv.montador_guardar_codigo() returns trigger
language plpgsql set search_path = '' as $$
declare
    chaves constant text[] := array['codigoVerificacao', 'codigos', 'turmasCodigo', 'prazoNotas'];
    k text;
    novo jsonb;
begin
    if auth.uid() is null or montador_priv.montador_papel() = 'gestao' then
        return new;
    end if;
    novo := coalesce(new.dados, '{}'::jsonb) - chaves;
    if tg_op = 'UPDATE' then
        foreach k in array chaves loop
            if old.dados ? k then
                novo := novo || jsonb_build_object(k, old.dados -> k);
            end if;
        end loop;
    end if;
    new.dados := novo;
    return new;
end
$$;

revoke execute on function montador_priv.montador_guardar_codigo() from public, anon;
grant execute on function montador_priv.montador_guardar_codigo() to authenticated;

drop trigger if exists montador_guardar_codigo on public.montador_provas;
create trigger montador_guardar_codigo
    before insert or update on public.montador_provas
    for each row execute function montador_priv.montador_guardar_codigo();

-- ===================== os códigos de cada aluno =====================

do $$
begin
    if to_regclass('public.corretor_copias') is null then
        raise notice 'corretor_copias ainda não existe (migração 005): pulei as regras dos códigos gerados.';
        return;
    end if;

    drop policy if exists "gravar copias" on public.corretor_copias;
    drop policy if exists "atualizar copias" on public.corretor_copias;
    drop policy if exists "apagar copias" on public.corretor_copias;

    create policy "gravar copias" on public.corretor_copias for insert to authenticated
        with check (montador_priv.montador_papel() = 'gestao');
    create policy "atualizar copias" on public.corretor_copias for update to authenticated
        using (montador_priv.montador_papel() = 'gestao')
        with check (montador_priv.montador_papel() = 'gestao');
    create policy "apagar copias" on public.corretor_copias for delete to authenticated
        using (montador_priv.montador_papel() = 'gestao');
end
$$;
