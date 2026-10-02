/* Onde mora a parte compartilhada do Montador (provas da área): o projeto
   Supabase "MapaDeAulas", nas tabelas montador_*. A chave abaixo é a
   publicável — feita para ir no navegador; quem protege os dados são as regras
   do banco (RLS), descritas em supabase/001_montador.sql. */
window.MONTADOR_NUVEM = {
    url: 'https://yncpicdkrntvwfdxrvab.supabase.co',
    chave: 'sb_publishable_LbDAh1pdkGAlWc7KY0v1ow_LusWcVg-',
    funcaoUsuarios: 'montador-usuarios',
    bucketImagens: 'montador-imagens'
};
