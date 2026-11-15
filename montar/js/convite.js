/* Convite por link: a gestão copia a mensagem e manda no WhatsApp.
   O token nasce no servidor (função montador-convites). Aqui só montamos
   o endereço, a partir de onde o app está aberto, e o texto para colar. */
(function (global) {
    'use strict';

    /* o mesmo prazo de supabase/functions/_shared/convite-regras.js */
    const PRAZO_DIAS = 7;

    function mensagem(dados) {
        const dias = dados.dias || PRAZO_DIAS;
        return 'Olá, ' + dados.nome + '! A gestão te convidou para o Montador de Provas da Malu.\n\n'
            + 'Abra o link, crie a sua senha e entre:\n' + dados.url + '\n\n'
            + 'O link vale por ' + dias + ' dias e só pode ser usado uma vez. '
            + 'Seu e-mail de acesso é ' + dados.email + '.';
    }

    function url(token) {
        const loc = global.location || { origin: '', pathname: '/' };
        const caminho = loc.pathname || '/';
        return loc.origin + caminho + '#/convite/' + encodeURIComponent(token);
    }

    const api = { PRAZO_DIAS: PRAZO_DIAS, mensagem: mensagem, url: url };
    global.MontarConvite = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
