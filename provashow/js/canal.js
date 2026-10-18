/* O canal da aula: liga o app do professor, o scanner (celular) e o telão.

   Duas vias ao mesmo tempo, com o mesmo código de aula:
   - BroadcastChannel do navegador: janelas e abas do mesmo aparelho
     (telão aberto pelo app, scanner pela webcam do computador);
   - Supabase Realtime Broadcast: aparelhos diferentes (o celular do
     professor e o computador do projetor), quando há internet.
   Cada mensagem leva um id; a que chega pelas duas vias é tratada uma vez.
   Imagens das questões só vão pela via local (o tempo real tem limite de
   tamanho por mensagem). */
(function (global) {
    'use strict';

    const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    function novoCodigo() {
        let c = '';
        const aleatorio = new Uint32Array(6);
        (global.crypto || { getRandomValues: (a) => a.map(() => Math.random() * 1e9) }).getRandomValues(aleatorio);
        for (const n of aleatorio) c += LETRAS_CODIGO[n % LETRAS_CODIGO.length];
        return c;
    }

    function normalizarCodigo(texto) {
        return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    }

    let clienteNuvem = null;
    function nuvem() {
        const cfg = global.PROVASHOW_NUVEM;
        if (!cfg || !global.supabase || !global.supabase.createClient) return null;
        if (!clienteNuvem) {
            clienteNuvem = global.supabase.createClient(cfg.url, cfg.chave, {
                auth: { persistSession: false, autoRefreshToken: false },
                realtime: { params: { eventsPerSecond: 20 } }
            });
        }
        return clienteNuvem;
    }

    /* papel: 'app' | 'scanner' | 'telao'. aoReceber(tipo, dados, origem).
       aoMudarConexao({ local, nuvem }) informa o estado das vias. */
    function abrir(codigo, papel, aoReceber, aoMudarConexao) {
        const nome = 'provashow-' + normalizarCodigo(codigo);
        const eu = Math.random().toString(36).slice(2, 10);
        const vistos = new Set();
        const fila = [];
        const conexao = { local: false, nuvem: 'desligada' };
        const avisar = () => aoMudarConexao && aoMudarConexao(Object.assign({}, conexao));

        function lembrar(id) {
            vistos.add(id);
            fila.push(id);
            if (fila.length > 500) vistos.delete(fila.shift());
        }

        function receber(msg) {
            if (!msg || !msg.id || vistos.has(msg.id) || msg.de === papel + ':' + eu) return;
            lembrar(msg.id);
            aoReceber(msg.tipo, msg.dados, msg.papel);
        }

        let local = null;
        if (typeof global.BroadcastChannel === 'function') {
            local = new global.BroadcastChannel(nome);
            local.onmessage = (e) => receber(e.data);
            conexao.local = true;
        }

        let canalNuvem = null;
        const cliente = nuvem();
        if (cliente) {
            conexao.nuvem = 'conectando';
            canalNuvem = cliente.channel(nome, { config: { broadcast: { self: false, ack: false } } });
            canalNuvem.on('broadcast', { event: 'msg' }, (p) => receber(p.payload));
            canalNuvem.subscribe((status) => {
                conexao.nuvem = status === 'SUBSCRIBED' ? 'ligada' : (status === 'CLOSED' ? 'desligada' : (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'falhou' : 'conectando'));
                avisar();
            });
        }
        avisar();

        function enviar(tipo, dados, opcoes) {
            const o = opcoes || {};
            const msg = { id: eu + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), de: papel + ':' + eu, papel, tipo, dados };
            lembrar(msg.id);
            if (local) local.postMessage(msg);
            if (canalNuvem && conexao.nuvem === 'ligada') {
                const leve = o.paraNuvem ? Object.assign({}, msg, { dados: o.paraNuvem }) : msg;
                canalNuvem.send({ type: 'broadcast', event: 'msg', payload: leve });
            }
        }

        function fechar() {
            if (local) local.close();
            if (canalNuvem && cliente) cliente.removeChannel(canalNuvem);
        }

        return { enviar, fechar, codigo: normalizarCodigo(codigo), conexao: () => Object.assign({}, conexao) };
    }

    const Canal = { abrir, novoCodigo, normalizarCodigo };

    if (typeof module === 'object' && module.exports) module.exports = Canal;
    else global.Canal = Canal;
})(typeof self !== 'undefined' ? self : this);
