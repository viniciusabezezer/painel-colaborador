/* Por onde o celular do professor (scanner) e o telão conversam com o app
   quando estão em aparelhos diferentes: o tempo real (Realtime Broadcast) do
   projeto Supabase "MapaDeAulas", o mesmo do Montador de Provas.

   Só passam mensagens de passagem, num canal com o código da aula — nada é
   gravado no banco, e não há tabela do ProvaShow lá. A chave é a publicável,
   feita para ir no navegador. Para usar só no mesmo computador (scanner pela
   webcam e telão numa janela ao lado), basta apagar este arquivo: o app cai
   sozinho no canal local do navegador. */
window.PROVASHOW_NUVEM = {
    url: 'https://yncpicdkrntvwfdxrvab.supabase.co',
    chave: 'sb_publishable_LbDAh1pdkGAlWc7KY0v1ow_LusWcVg-'
};
