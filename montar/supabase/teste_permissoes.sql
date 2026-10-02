-- Teste das permissões (RLS) do Montador, para rodar no SQL Editor do
-- Supabase. Cria cinco pessoas de mentira (gestão, PCA de Ciências da
-- Natureza, professor de Biologia, de Física e de História), percorre o fluxo
-- da prova da área e, no fim, desfaz tudo com um erro proposital — que traz
-- na mensagem a lista de verificações. Nada fica gravado.
--
-- Esperado: 25 linhas terminando em "ok", nenhuma "FALHA".

do $teste$
declare
  g uuid := gen_random_uuid(); p uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  f uuid := gen_random_uuid(); h uuid := gen_random_uuid();
  prova uuid; sbio uuid; sfis uuid; squi uuid; n int; ok boolean; erro text;
  resultados text[] := '{}';
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-' || u || '@exemplo.invalid', '', now(), '{}', '{}', now(), now()
  from unnest(array[g,p,b,f,h]) u;
  insert into public.montador_perfis (id, nome, email, papel, area) values
    (g,'Gestao','g@x','gestao',null),(p,'PCA NAT','p@x','pca','NAT'),(b,'Prof Bio','b@x','professor','NAT'),
    (f,'Prof Fis','f@x','professor','NAT'),(h,'Prof Hist','h@x','professor','HUM');

  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.montador_provas (titulo, componente) values ('Bimestral CN', 'NAT') returning id into prova;
  resultados := resultados || 'PCA cria prova da área: ok'::text;
  begin
    insert into public.montador_provas (titulo, componente) values ('Outra', 'HUM');
    resultados := resultados || 'FALHA: PCA criou prova de outra área'::text;
  exception when others then resultados := resultados || 'PCA não cria prova de outra área: ok'::text; end;
  insert into public.montador_secoes (prova_id, titulo, responsavel, ordem) values (prova,'BIOLOGIA',b,0) returning id into sbio;
  insert into public.montador_secoes (prova_id, titulo, responsavel, ordem) values (prova,'FÍSICA',f,1) returning id into sfis;
  insert into public.montador_secoes (prova_id, titulo, responsavel, ordem) values (prova,'QUÍMICA',p,2) returning id into squi;
  insert into public.montador_questoes (id, prova_id, secao_id, dados) values ('q-pca', prova, squi, '{"enunciado":"da PCA"}');
  resultados := resultados || 'PCA cria seções e escreve na sua: ok'::text;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.montador_provas where id = prova;
  resultados := resultados || ('Bio vê a prova: ' || case when n=1 then 'ok' else 'FALHA' end);
  select count(*) into n from public.montador_questoes where prova_id = prova;
  resultados := resultados || ('Bio lê as questões dos colegas: ' || case when n=1 then 'ok' else 'FALHA' end);
  insert into public.montador_questoes (id, prova_id, secao_id, dados) values ('q-bio', prova, sbio, '{"enunciado":"bio"}');
  resultados := resultados || 'Bio escreve na seção dele: ok'::text;
  begin
    insert into public.montador_questoes (id, prova_id, secao_id, dados) values ('q-bio-fis', prova, sfis, '{}');
    resultados := resultados || 'FALHA: Bio escreveu na Física'::text;
  exception when others then resultados := resultados || 'Bio não escreve na Física: ok'::text; end;
  update public.montador_questoes set dados = '{"x":1}' where id = 'q-pca';
  get diagnostics n = row_count;
  resultados := resultados || ('Bio não altera questão da PCA: ' || case when n=0 then 'ok' else 'FALHA' end);
  update public.montador_provas set titulo = 'hack' where id = prova;
  get diagnostics n = row_count;
  resultados := resultados || ('Bio não altera o formato da prova: ' || case when n=0 then 'ok' else 'FALHA' end);
  update public.montador_secoes set titulo = 'hack' where id = sbio;
  get diagnostics n = row_count;
  resultados := resultados || ('Bio não renomeia a seção: ' || case when n=0 then 'ok' else 'FALHA' end);
  perform public.montador_marcar_secao(sbio, true, 'Terminei');
  resultados := resultados || 'Bio marca a seção dele como pronta: ok'::text;
  begin
    perform public.montador_marcar_secao(sfis, true, null);
    resultados := resultados || 'FALHA: Bio marcou a Física'::text;
  exception when others then resultados := resultados || 'Bio não marca a seção da Física: ok'::text; end;
  begin
    insert into public.montador_comentarios (prova_id, secao_id, texto, tipo) values (prova, sfis, 'x', 'devolucao');
    resultados := resultados || 'FALHA: professor devolveu seção'::text;
  exception when others then resultados := resultados || 'Professor não devolve seção: ok'::text; end;
  insert into public.montador_comentarios (prova_id, secao_id, texto) values (prova, sfis, 'dúvida na física');
  resultados := resultados || 'Professor comenta: ok'::text;
  ok := montador_priv.montador_pode_ver_pasta(prova::text);
  resultados := resultados || ('Bio vê as imagens da prova: ' || case when ok then 'ok' else 'FALHA' end);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.montador_provas where id = prova;
  resultados := resultados || ('História não vê a prova de CN: ' || case when n=0 then 'ok' else 'FALHA' end);
  select count(*) into n from public.montador_questoes where prova_id = prova;
  resultados := resultados || ('História não vê as questões: ' || case when n=0 then 'ok' else 'FALHA' end);
  ok := montador_priv.montador_pode_ver_pasta(prova::text);
  resultados := resultados || ('História não vê as imagens: ' || case when not ok then 'ok' else 'FALHA' end);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.montador_questoes set dados = '{"enunciado":"bio corrigida"}' where id = 'q-bio';
  get diagnostics n = row_count;
  resultados := resultados || ('PCA edita questão do professor: ' || case when n=1 then 'ok' else 'FALHA' end);
  update public.montador_secoes set situacao = 'devolvida' where id = sbio;
  insert into public.montador_comentarios (prova_id, secao_id, texto, tipo) values (prova, sbio, 'questão 2 sem gabarito', 'devolucao');
  resultados := resultados || 'PCA devolve com comentário: ok'::text;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.montador_questoes set dados = '{"enunciado":"bio refeita"}' where id = 'q-bio';
  execute 'reset role';
  select situacao into erro from public.montador_secoes where id = sbio;
  resultados := resultados || ('Seção devolvida volta a rascunho quando o professor mexe: ' || case when erro='rascunho' then 'ok' else 'FALHA ' || erro end);
  select criada_por = b and atualizada_por = b into ok from public.montador_questoes where id = 'q-bio';
  resultados := resultados || ('Autoria registrada: ' || case when ok then 'ok' else 'FALHA' end);

  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.montador_secoes set situacao = 'aprovada' where id = sbio;
  update public.montador_provas set situacao = 'travada' where id = prova;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.montador_questoes (id, prova_id, secao_id, dados) values ('q-fis', prova, sfis, '{}');
    resultados := resultados || 'FALHA: escreveu com a prova travada'::text;
  exception when others then resultados := resultados || 'Prova travada não aceita questões: ok'::text; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.montador_questoes where prova_id = prova;
  resultados := resultados || ('Gestão vê todas as questões: ' || case when n=2 then 'ok' else 'FALHA ' || n end);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.montador_provas;
    resultados := resultados || ('Sem login não vê nada: ' || case when n=0 then 'ok' else 'FALHA' end);
  exception when others then resultados := resultados || 'Sem login não vê nada: ok (sem permissão)'::text; end;
  execute 'reset role';

  raise exception 'RESULTADO|%', array_to_string(resultados, ' || ');
end
$teste$;
